/* ============================================================
   PORTFOLIO — script.js
   Particle starfield, navigation, scroll reveal, interactions
   ============================================================ */

'use strict';

/* ── 1. STARFIELD PARTICLE SYSTEM ─────────────────────────── */
(function initStarfield() {

  const canvas = document.getElementById('starfield');
  const ctx    = canvas.getContext('2d');

  // ── Config ──────────────────────────────────────────────
  const CONFIG = {
    particleCount: 180,
    speedMin:      0.08,
    speedMax:      0.35,
    sizeMin:       0.8,
    sizeMax:       2.8,
    connectionDist: 110,
    mouseRadius:    130,
    mouseForce:     0.045,
    returnForce:    0.028,
    colors: {
      node:       { r: 11,  g: 255, b: 231 },   // --cyan
      nodeAlt:    { r: 110, g: 126, b: 255 },   // --violet
      nodeWhite:  { r: 200, g: 215, b: 255 },   // near-white
    },
    twinkleSpeed:   0.012,
  };

  // ── State ────────────────────────────────────────────────
  let W, H, dpr;
  let mouse  = { x: -9999, y: -9999 };
  let raf;
  let particles = [];

  // ── Particle class ───────────────────────────────────────
  class Particle {
    constructor() {
      this.reset(true);
    }

    reset(initial) {
      this.x    = Math.random() * W;
      this.y    = initial ? Math.random() * H : (Math.random() > 0.5 ? -5 : H + 5);
      this.ox   = this.x;   // origin x
      this.oy   = this.y;   // origin y
      const angle = Math.random() * Math.PI * 2;
      const speed = CONFIG.speedMin + Math.random() * (CONFIG.speedMax - CONFIG.speedMin);
      this.vx   = Math.cos(angle) * speed;
      this.vy   = Math.sin(angle) * speed;
      this.size = CONFIG.sizeMin + Math.random() * (CONFIG.sizeMax - CONFIG.sizeMin);

      // colour: 60% cyan, 25% violet, 15% white
      const r = Math.random();
      if (r < 0.60)       this.color = CONFIG.colors.node;
      else if (r < 0.85)  this.color = CONFIG.colors.nodeAlt;
      else                this.color = CONFIG.colors.nodeWhite;

      this.alpha       = 0.2 + Math.random() * 0.7;
      this.twinkleOff  = Math.random() * Math.PI * 2;
      this.twinkleMag  = 0.1 + Math.random() * 0.3;
      this.pulse       = 0;    // 0–1 when near mouse
    }

    update(t) {
      // Drift
      this.x += this.vx;
      this.y += this.vy;

      // Mouse repulsion
      const dx = this.x - mouse.x;
      const dy = this.y - mouse.y;
      const distSq = dx * dx + dy * dy;
      const radSq  = CONFIG.mouseRadius * CONFIG.mouseRadius;

      if (distSq < radSq && distSq > 0) {
        const dist   = Math.sqrt(distSq);
        const force  = (1 - dist / CONFIG.mouseRadius) * CONFIG.mouseForce;
        this.x += (dx / dist) * force * CONFIG.mouseRadius;
        this.y += (dy / dist) * force * CONFIG.mouseRadius;
        this.pulse = Math.max(this.pulse, 1 - dist / CONFIG.mouseRadius);
      } else {
        this.pulse *= 0.92;
      }

      // Gentle return-to-origin pull (keeps field from thinning)
      const ox_diff = this.ox - this.x;
      const oy_diff = this.oy - this.y;
      this.x += ox_diff * CONFIG.returnForce * 0.25;
      this.y += oy_diff * CONFIG.returnForce * 0.25;

      // Advance origin slowly in drift direction
      this.ox += this.vx * 0.5;
      this.oy += this.vy * 0.5;

      // Wrap
      if (this.ox < -10)  this.ox = W + 10;
      if (this.ox > W+10) this.ox = -10;
      if (this.oy < -10)  this.oy = H + 10;
      if (this.oy > H+10) this.oy = -10;

      // Twinkle
      const twinkle   = Math.sin(t * CONFIG.twinkleSpeed + this.twinkleOff);
      this.curAlpha   = Math.max(0.05,
        this.alpha + twinkle * this.twinkleMag + this.pulse * 0.4
      );
    }

    draw(ctx) {
      const { r, g, b } = this.color;
      const boost = 1 + this.pulse * 2.5;
      const s     = this.size * boost;

      // Glow aura for pulse
      if (this.pulse > 0.1) {
        const grad = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, s * 5);
        grad.addColorStop(0, `rgba(${r},${g},${b},${this.pulse * 0.3})`);
        grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
        ctx.beginPath();
        ctx.arc(this.x, this.y, s * 5, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();
      }

      // Core dot
      ctx.beginPath();
      ctx.arc(this.x, this.y, s, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${r},${g},${b},${this.curAlpha})`;
      ctx.fill();
    }
  }

  // ── Build particle pool ──────────────────────────────────
  function buildParticles() {
    particles = [];
    const count = Math.min(CONFIG.particleCount, Math.floor((W * H) / 7000));
    for (let i = 0; i < count; i++) {
      particles.push(new Particle());
    }
  }

  // ── Draw connections between nearby particles ────────────
  function drawConnections(ctx) {
    const d = CONFIG.connectionDist;
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const a  = particles[i];
        const b  = particles[j];
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > d) continue;

        const t    = 1 - dist / d;
        const alpha = t * t * 0.35;

        // Interpolate colour between the two particles
        const ra = a.color.r, ga = a.color.g, ba_c = a.color.b;
        const rb = b.color.r, gb = b.color.g, bb_c = b.color.b;

        const grad = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
        grad.addColorStop(0, `rgba(${ra},${ga},${ba_c},${alpha})`);
        grad.addColorStop(1, `rgba(${rb},${gb},${bb_c},${alpha})`);

        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.strokeStyle = grad;
        ctx.lineWidth   = t * 0.9;
        ctx.stroke();
      }
    }
  }

  // ── Render loop ──────────────────────────────────────────
  let tick = 0;

  function render() {
    ctx.clearRect(0, 0, W, H);
    tick++;

    drawConnections(ctx);
    for (const p of particles) {
      p.update(tick);
      p.draw(ctx);
    }

    raf = requestAnimationFrame(render);
  }

  // ── Resize ───────────────────────────────────────────────
  function onResize() {
    dpr    = window.devicePixelRatio || 1;
    W      = window.innerWidth;
    H      = window.innerHeight;
    canvas.width  = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width  = W + 'px';
    canvas.style.height = H + 'px';
    ctx.scale(dpr, dpr);
    buildParticles();
  }

  // ── Mouse tracking ────────────────────────────────────────
  function onMouseMove(e) {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
  }

  function onMouseLeave() {
    mouse.x = -9999;
    mouse.y = -9999;
  }

  // Touch support
  function onTouchMove(e) {
    if (e.touches.length > 0) {
      mouse.x = e.touches[0].clientX;
      mouse.y = e.touches[0].clientY;
    }
  }

  // ── Reduced-motion guard ─────────────────────────────────
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReduced) return;

  // ── Init ─────────────────────────────────────────────────
  onResize();
  render();

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      cancelAnimationFrame(raf);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      onResize();
      render();
    }, 100);
  });

  window.addEventListener('mousemove',  onMouseMove,  { passive: true });
  window.addEventListener('mouseleave', onMouseLeave);
  window.addEventListener('touchmove',  onTouchMove,  { passive: true });

})();


/* ── 2. NAVIGATION ────────────────────────────────────────── */
(function initNav() {

  const navbar = document.getElementById('navbar');
  const links  = navbar.querySelectorAll('.nav-links a');
  const burger = document.getElementById('burger');
  const navList = navbar.querySelector('.nav-links');

  // Scrolled state
  function onScroll() {
    if (window.scrollY > 30) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }
    updateActiveLink();
  }

  // Active section highlight
  function updateActiveLink() {
    const sections = document.querySelectorAll('section[id]');
    const scrollY  = window.scrollY + window.innerHeight * 0.35;

    let current = '';
    sections.forEach(sec => {
      if (scrollY >= sec.offsetTop) current = sec.id;
    });

    links.forEach(a => {
      const href = a.getAttribute('href').replace('#', '');
      a.classList.toggle('active', href === current);
    });
  }

  // Smooth scroll on link click
  links.forEach(a => {
    a.addEventListener('click', e => {
      const target = document.querySelector(a.getAttribute('href'));
      if (!target) return;
      e.preventDefault();
      navList.classList.remove('open');
      burger.classList.remove('open');
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  // Logo / any anchor clicks
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    if (a.classList.contains('nav-links')) return; // handled above
    a.addEventListener('click', e => {
      const href   = a.getAttribute('href');
      const target = document.querySelector(href);
      if (!target || href === '#') return;
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  // Burger toggle
  burger.addEventListener('click', () => {
    burger.classList.toggle('open');
    navList.classList.toggle('open');
  });

  // Close menu on outside click
  document.addEventListener('click', e => {
    if (!navbar.contains(e.target)) {
      burger.classList.remove('open');
      navList.classList.remove('open');
    }
  });

  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

})();


/* ── 3. SCROLL REVEAL ─────────────────────────────────────── */
(function initReveal() {

  const targets = [
    '#about .about-grid',
    '#about .section-label',
    '#projects .section-label',
    '#projects .section-title',
    '#projects .card',
    '#stack .section-label',
    '#stack .section-title',
    '#stack .stack-category',
    '#contact .section-label',
    '#contact .contact-grid > *',
  ];

  const elements = [];

  targets.forEach(sel => {
    document.querySelectorAll(sel).forEach((el, i) => {
      el.classList.add('reveal');
      // Stagger siblings
      el.style.transitionDelay = (i % 6) * 0.08 + 's';
      elements.push(el);
    });
  });

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, {
    threshold:   0.12,
    rootMargin: '0px 0px -40px 0px',
  });

  elements.forEach(el => observer.observe(el));

})();


/* ── 4. CONTACT FORM ──────────────────────────────────────── */
(function initForm() {

  const form = document.getElementById('contactForm');
  const note = document.getElementById('formNote');
  if (!form) return;

  form.addEventListener('submit', e => {
    e.preventDefault();

    const btn = form.querySelector('button[type="submit"]');
    btn.textContent = 'Sending…';
    btn.disabled = true;

    // Simulate async send (replace with real fetch to your endpoint)
    setTimeout(() => {
      note.textContent = '✓ Message sent! I\'ll get back to you within 24 hours.';
      note.style.color = 'var(--cyan)';
      form.reset();
      btn.textContent = 'Send Message';
      btn.disabled = false;

      setTimeout(() => { note.textContent = ''; }, 6000);
    }, 1200);
  });

})();


/* ── 5. CARD TILT (subtle 3-D hover) ─────────────────────── */
(function initTilt() {

  const TILT = 6; // max degrees

  document.querySelectorAll('.card:not(.card--more)').forEach(card => {

    card.addEventListener('mousemove', e => {
      const rect = card.getBoundingClientRect();
      const cx   = rect.left + rect.width  / 2;
      const cy   = rect.top  + rect.height / 2;
      const dx   = (e.clientX - cx) / (rect.width  / 2);
      const dy   = (e.clientY - cy) / (rect.height / 2);
      card.style.transform = `
        translateY(-4px)
        rotateX(${-dy * TILT}deg)
        rotateY(${dx  * TILT}deg)
      `;
    });

    card.addEventListener('mouseleave', () => {
      card.style.transform = '';
    });
  });

})();


/* ── 6. TYPING CURSOR EFFECT in hero title ────────────────── */
(function initCursor() {

  const gradEl = document.querySelector('.hero-title .gradient-text');
  if (!gradEl) return;

  const originalText = gradEl.textContent;
  // Add a blinking cursor after the title briefly on load
  const cursor = document.createElement('span');
  cursor.textContent = '|';
  cursor.style.cssText = `
    display: inline-block;
    margin-left: 2px;
    color: #0BFFE7;
    animation: fadeIn 0.6s ease infinite alternate;
    font-weight: 300;
  `;

  // Only show cursor for 3s then fade out
  gradEl.parentNode.insertBefore(cursor, gradEl.nextSibling);
  setTimeout(() => {
    cursor.style.transition = 'opacity 1s';
    cursor.style.opacity    = '0';
    setTimeout(() => cursor.remove(), 1100);
  }, 3200);

})();
