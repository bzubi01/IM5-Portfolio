/**
 * benizubi – Kinetic Sports Type
 * Portfolio hero. GSAP + ScrollTrigger control the word morph; Canvas handles the physics.
 * Based on the original interactive prototype; styles adjusted to brand blue #003053.
 * Edit WORDS and CONFIG to customise.
 */
(() => {
  'use strict';
  const root = document.getElementById('start');
  if (!root || root.dataset.initialized) return;
  root.dataset.initialized = 'true';

  const box = root;
  const cv = root.querySelector('canvas');
  const c = cv.getContext('2d');
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const scrollState = { word: 0 };
  let inView = true;
  let scrollMedia = null;
  let accessibleWord = -1;


  if (!c) return;
  const backdrop = document.createElement('canvas');
  const bg = backdrop.getContext('2d');

  const WORDS = ['benizubi', 'FOTOGRAFIE', 'FILM & MOTION', 'DIGITAL', 'DESIGN'];
  const CONFIG = {
    brand: '#003053',
    background: '#f7f9fb',
    radius: 125,
    energy: 1.5,
    trails: 0.65,
    scrollPerWord: 0.75, // Viewport heights per transition.
    scrollHold: 0.35,
    scrollMorph: 0.65,
    scrollScrub: 0.3,
    spring: 0.035,
    damping: 0.88,
    maxParticles: 2400,
    samplingStep: 5,
    keepProbability: 0.9
  };

  const off = document.createElement('canvas');
  off.width = 1100; off.height = 250;
  const o = off.getContext('2d', { willReadFrequently: true });
  let W = 0, H = 0, D = 1, shapes = [], parts = [], prev = 0, randseed = 31;
  const mouse = { x: -9999, y: -9999, speed: 0, active: false };
  let rafId = 0;

  function rand() { randseed = (1664525 * randseed + 1013904223) >>> 0; return randseed / 4294967296; }
  const mix = (a, b, t) => a + (b - a) * t;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  function shape(word) {
    o.clearRect(0, 0, 1100, 250);
    o.fillStyle = '#fff'; o.textAlign = 'center'; o.textBaseline = 'middle';
    let fs = 190;
    while (fs > 25) {
      o.font = `900 ${fs}px Arial,sans-serif`;
      if (o.measureText(word).width < 1010) break;
      fs -= 3;
    }
    o.fillText(word, 550, 122);
    const pixels = o.getImageData(0, 0, 1100, 250).data;
    const points = [];
    for (let y = 20; y < 230; y += CONFIG.samplingStep) {
      for (let x = 20; x < 1080; x += CONFIG.samplingStep) {
        if (pixels[(y * 1100 + x) * 4 + 3] > 140 && rand() < CONFIG.keepProbability) {
          points.push({ x: (x - 550) / 1100, y: (y - 125) / 250 });
        }
      }
    }
    return points;
  }

  function target(k, i) {
    const a = shapes[k];
    return a.length ? a[Math.min(a.length - 1, Math.floor(i * a.length / parts.length))] : { x: 0, y: 0 };
  }
  function coords(s) { return [W * 0.5 + s.x * W * 0.92, H * 0.5 + s.y * Math.min(H * 0.86, W * 0.3)]; }

  function resize() {
    const r = box.getBoundingClientRect();
    W = r.width; H = r.height; D = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = Math.round(W * D); cv.height = Math.round(H * D);
    c.setTransform(D, 0, 0, D, 0, 0);
    randseed = 31;
    shapes = WORDS.map(shape);
    const n = Math.min(CONFIG.maxParticles, Math.max(...shapes.map(s => s.length)));

    parts = [];
    for (let i = 0; i < n; i++) {
      const k = Math.min(WORDS.length - 1, Math.floor(scrollState.word));
      const k2 = Math.min(WORDS.length - 1, k + 1);
      const sample = (index) => shapes[index][Math.min(shapes[index].length - 1, Math.floor(i * shapes[index].length / n))];
      const a = sample(k), b = sample(k2);
      const u = scrollState.word - k;
      const eased = u * u * (3 - 2 * u);
      const s = { x: mix(a.x, b.x, eased), y: mix(a.y, b.y, eased) };
      const p = coords(s);
      const v = rand();
      parts.push({ x: p[0], y: p[1], vx: 0, vy: 0, r: (v < 0.08 ? 2 : 1 + rand() * 0.6) * Math.min(1, W / 800), mx: 0, my: 0, hue: rand() });
    }
    prepareBackground();
    renderStatic();
  }

  function pointer(e) {
    if (motion.matches || (e.pointerType === 'touch' && e.buttons === 0)) return;
    const b = box.getBoundingClientRect();
    const x = e.clientX - b.left, y = e.clientY - b.top;
    mouse.speed = Math.min(70, Math.hypot(x - mouse.x, y - mouse.y));
    mouse.x = x; mouse.y = y; mouse.active = true;
  }
  box.addEventListener('pointermove', pointer);
  box.addEventListener('pointerleave', () => { mouse.active = false; mouse.x = -9999; mouse.y = -9999; });
  // The click impulse is independent of scroll-driven word changes.
  function burst() {
    if (motion.matches) return;
    const cx = W * 0.5, cy = H * 0.5;
    for (const p of parts) {
      const dx = p.x - cx, dy = p.y - cy, d = Math.hypot(dx, dy) || 1;
      const v = 5 + rand() * 9;
      p.vx += dx / d * v; p.vy += dy / d * v;
    }
  }
  cv.addEventListener('click', burst);
  cv.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (!event.repeat) burst();
    }
  });
  box.addEventListener('pointerup', (event) => {
    if (event.pointerType !== 'mouse') mouse.active = false;
  });
  box.addEventListener('pointercancel', () => { mouse.active = false; });
  // Sparse movement traces and offset registration marks, cached on resize.
  // The centre stays open for the particle lettering. No grain or dot pattern.
  function prepareBackground() {
    backdrop.width = cv.width;
    backdrop.height = cv.height;
    bg.setTransform(D, 0, 0, D, 0, 0);
    bg.fillStyle = CONFIG.background;
    bg.fillRect(0, 0, W, H);

    // An off-centre cut, like the exposed edge of a photographic contact sheet.
    bg.fillStyle = 'rgba(0,48,83,.025)';
    bg.beginPath();
    bg.moveTo(W * .86, 0); bg.lineTo(W, 0);
    bg.lineTo(W, H); bg.lineTo(W * .95, H); bg.closePath(); bg.fill();

    // Different curves rather than a repeated surface texture.
    bg.strokeStyle = 'rgba(0,48,83,.12)'; bg.lineWidth = .75;
    const tracks = [
      [-.08, .89, .19, .53, .61, 1.34, 1.08, .70],
      [-.04, .94, .24, .63, .67, 1.25, 1.10, .76],
      [.30, -.13, .54, .32, .89, -.12, 1.07, .29]
    ];
    for (const p of tracks) {
      bg.beginPath(); bg.moveTo(W * p[0], H * p[1]);
      bg.bezierCurveTo(W * p[2], H * p[3], W * p[4], H * p[5], W * p[6], H * p[7]);
      bg.stroke();
    }
    // Three deliberately displaced register crosses; no regular grid.
    bg.strokeStyle = 'rgba(0,48,83,.38)';
    for (const [x, y] of [[.065, .18], [.915, .25], [.73, .87]]) {
      const cx = W * x, cy = H * y;
      bg.beginPath(); bg.moveTo(cx - 6, cy); bg.lineTo(cx + 6, cy);
      bg.moveTo(cx, cy - 6); bg.lineTo(cx, cy + 6); bg.stroke();
    }
  }
  function background() { c.drawImage(backdrop, 0, 0, W, H); }

  function renderStatic() {
    background();
    c.fillStyle = CONFIG.brand;
    for (const p of parts) {
      c.beginPath(); c.arc(p.x, p.y, p.r, 0, Math.PI * 2); c.fill();
    }
  }
  function frame(t) {
    const dt = Math.min((t - prev) / 16.67 || 1, 2); prev = t;
    background();
    const v = scrollState.word;
    const k = Math.min(WORDS.length - 1, Math.floor(v));
    const k2 = Math.min(WORDS.length - 1, k + 1);
    let u = v - k; u = u * u * (3 - 2 * u);
    const strength = CONFIG.energy, tail = CONFIG.trails;
    c.lineCap = 'round';
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i], a = target(k, i), b = target(k2, i);
      const xy = coords({ x: mix(a.x, b.x, u), y: mix(a.y, b.y, u) });
      const dx = p.x - mouse.x, dy = p.y - mouse.y, dist = Math.hypot(dx, dy);
      if (mouse.active && dist < CONFIG.radius && dist > 0.1) {
        const f = Math.pow(1 - dist / CONFIG.radius, 2) * (3.6 + mouse.speed * 0.065) * strength;
        p.vx += dx / dist * f * dt; p.vy += dy / dist * f * dt;
      }
      // Constant small random impulses, damped by a spring: Mini-Feder-Unruhe.
      p.mx += (rand() - 0.5) * 0.052 * dt; p.my += (rand() - 0.5) * 0.052 * dt;
      p.mx *= 0.95; p.my *= 0.95;
      p.vx += (xy[0] - p.x) * CONFIG.spring * dt + p.mx * dt;
      p.vy += (xy[1] - p.y) * CONFIG.spring * dt + p.my * dt;
      p.vx *= Math.pow(CONFIG.damping, dt); p.vy *= Math.pow(CONFIG.damping, dt);
      p.x += p.vx * dt; p.y += p.vy * dt;
      const speed = Math.hypot(p.vx, p.vy), ang = Math.atan2(p.vy, p.vx);
      const len = 1.6 + Math.min(45, speed * 2.3) * tail;
      const glowing = speed > 1.4 || (mouse.active && dist < 130);
      if (glowing) {
        c.strokeStyle = 'rgba(0,48,83,.14)';
        c.lineWidth = 3.5 + Math.min(4, speed * 0.15);
        c.beginPath(); c.moveTo(p.x, p.y);
        c.lineTo(p.x - Math.cos(ang) * len * 2, p.y - Math.sin(ang) * len * 2); c.stroke();
      }
      c.strokeStyle = CONFIG.brand;
      c.lineWidth = p.r;
      c.beginPath(); c.moveTo(p.x, p.y);
      c.lineTo(p.x - Math.cos(ang) * Math.min(28, len), p.y - Math.sin(ang) * Math.min(28, len)); c.stroke();
      if (speed < 0.6) {
        c.fillStyle = CONFIG.brand; c.beginPath(); c.arc(p.x, p.y, p.r * 0.82, 0, Math.PI * 2); c.fill();
      }
    }
    if (mouse.active) mouse.speed *= 0.89;
    rafId = requestAnimationFrame(frame);
  }

  function updateAccessibleWord() {
    const index = Math.min(WORDS.length - 1, Math.round(scrollState.word));
    if (index === accessibleWord) return;
    accessibleWord = index;
    cv.setAttribute('aria-label', `Partikelschrift: ${WORDS[index]}. Partikelimpuls auslösen.`);
  }

  function setupScroll() {
    const { gsap, ScrollTrigger } = window;
    // If the CDN is unavailable, keep a usable hero without a long empty pin area.
    if (!gsap || !ScrollTrigger) return;
    gsap.registerPlugin(ScrollTrigger);
    scrollMedia = gsap.matchMedia();
    scrollMedia.add('(prefers-reduced-motion: no-preference)', () => {
      root.classList.add('is-scroll-driven');
      resize();
      const timeline = gsap.timeline({
        defaults: { ease: 'none' },
        onUpdate: updateAccessibleWord,
        scrollTrigger: {
          id: 'hero-word-scroll',
          trigger: root,
          start: 'top top',
          end: () => `+=${(WORDS.length - 1) * clamp(window.innerHeight * CONFIG.scrollPerWord, 360, 680)}`,
          pin: true,
          pinSpacing: true,
          scrub: CONFIG.scrollScrub,
          anticipatePin: 1
        }
      });
      // These durations describe scroll proportions, not automatic playback time.
      timeline.to({}, { duration: CONFIG.scrollHold });
      for (let i = 1; i < WORDS.length; i++) {
        timeline.to(scrollState, { word: i, duration: CONFIG.scrollMorph });
        timeline.to({}, { duration: CONFIG.scrollHold });
      }
      updateAccessibleWord();
      return () => {
        root.classList.remove('is-scroll-driven');
        scrollState.word = 0;
        resize();
        updateAccessibleWord();
      };
    });
  }
  function stop() { cancelAnimationFrame(rafId); rafId = 0; }
  function start() {
    stop(); prev = 0;
    if (!motion.matches && inView && !document.hidden) rafId = requestAnimationFrame(frame);
  }
  const ro = new ResizeObserver(resize);
  const visibility = new IntersectionObserver(([entry]) => {
    inView = entry.isIntersecting;
    start();
  });
  ro.observe(box);
  visibility.observe(box);
  resize(); setupScroll(); updateAccessibleWord(); start();
  document.addEventListener('visibilitychange', start);
  motion.addEventListener('change', () => { resize(); start(); });
  window.addEventListener('pagehide', (event) => {
    stop(); ro.disconnect(); visibility.disconnect();
    if (!event.persisted) scrollMedia?.revert();
  });
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) {
      ro.observe(box); visibility.observe(box);
      window.ScrollTrigger?.refresh();
      resize(); start();
    }
  });
})();