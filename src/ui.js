import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

/* ------------------------------------------------------------------ cursor
   A ring that lags behind the pointer (it has mass) and a dot that does not
   (it is the truth). Over interactive things the ring grows and names the
   action, so you know what a click will do before you make it.            */
export function initCursor() {
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const el = document.getElementById('cursor');
  if (!fine || !el) return;
  document.body.classList.add('has-cursor');
  const ring = el.querySelector('.c-ring'), dot = el.querySelector('.c-dot'), label = el.querySelector('.c-label');
  const rx = gsap.quickTo(ring, 'x', { duration: 0.45, ease: 'power3.out' });
  const ry = gsap.quickTo(ring, 'y', { duration: 0.45, ease: 'power3.out' });
  const lx = gsap.quickTo(label, 'x', { duration: 0.3, ease: 'power3.out' });
  const ly = gsap.quickTo(label, 'y', { duration: 0.3, ease: 'power3.out' });
  window.addEventListener('pointermove', (e) => {
    gsap.set(dot, { x: e.clientX, y: e.clientY });
    rx(e.clientX); ry(e.clientY); lx(e.clientX); ly(e.clientY);
    const t = e.target.closest?.('[data-cursor], a, button, summary, .chip, input, textarea');
    const text = t ? t.dataset.cursor || (t.matches('a') ? 'Open' : t.matches('input, textarea') ? '' : t.matches('summary') ? 'Toggle' : 'Click') : '';
    if (text) { label.textContent = text; el.classList.add('has-label'); } else el.classList.remove('has-label');
  }, { passive: true });
  window.addEventListener('pointerdown', () => el.classList.add('is-down'));
  window.addEventListener('pointerup', () => el.classList.remove('is-down'));
  document.addEventListener('mouseleave', () => gsap.to(el, { opacity: 0, duration: 0.3 }));
  document.addEventListener('mouseenter', () => gsap.to(el, { opacity: 1, duration: 0.3 }));
}

/* --------------------------------------------------------------- magnetic
   Primary buttons lean toward the pointer: the next step meets you halfway. */
export function initMagnetic() {
  if (!matchMedia('(hover: hover)').matches) return;
  document.querySelectorAll('.magnetic').forEach((b) => {
    const xTo = gsap.quickTo(b, 'x', { duration: 0.6, ease: 'elastic.out(1, 0.4)' });
    const yTo = gsap.quickTo(b, 'y', { duration: 0.6, ease: 'elastic.out(1, 0.4)' });
    b.addEventListener('pointermove', (e) => {
      const r = b.getBoundingClientRect();
      xTo((e.clientX - (r.left + r.width / 2)) * 0.3);
      yTo((e.clientY - (r.top + r.height / 2)) * 0.4);
    });
    b.addEventListener('pointerleave', () => { xTo(0); yTo(0); });
    b.addEventListener('pointerenter', () => window.__sound?.tick(520));
  });
}

/* -------------------------------------------------------------------- nav */
export function initNav(lenis) {
  const nav = document.getElementById('nav');
  const pill = nav.querySelector('.nav-pill');
  const links = [...nav.querySelectorAll('.nav-links a')];
  const movePill = (a) => {
    if (!a) { pill.style.opacity = 0; return; }
    pill.style.opacity = 1;
    pill.style.width = a.offsetWidth + 'px';
    pill.style.transform = `translateX(${a.offsetLeft}px)`;
  };
  const sections = { web: ['web', 'apps', 'backend'], process: ['process'], work: ['work'], stack: ['stack', 'metrics'], faq: ['faq'] };
  Object.entries(sections).forEach(([key, ids]) => {
    ids.forEach((id) => {
      const sec = document.getElementById(id);
      if (!sec) return;
      ScrollTrigger.create({
        trigger: sec, start: 'top 50%', end: 'bottom 50%',
        onToggle: (self) => {
          const a = links.find((l) => l.dataset.nav === key);
          if (self.isActive) { links.forEach((l) => { l.classList.toggle('is-active', l === a); l.removeAttribute('aria-current'); }); a.setAttribute('aria-current', 'true'); movePill(a); }
        },
      });
    });
  });
  ScrollTrigger.create({ trigger: '#hero', start: 'top top', end: 'bottom 50%', onToggle: (s) => { if (s.isActive) { links.forEach((l) => l.classList.remove('is-active')); movePill(null); } } });
  ScrollTrigger.create({ trigger: '#contact', start: 'top 50%', onToggle: (s) => { if (s.isActive) { links.forEach((l) => l.classList.remove('is-active')); movePill(null); } } });

  // hide while reading downward, return the moment you scroll up
  let last = 0;
  lenis?.on('scroll', ({ scroll, direction }) => {
    if (Math.abs(scroll - last) < 6) return;
    nav.classList.toggle('is-hidden', direction === 1 && scroll > 300 && !document.body.classList.contains('menu-open'));
    last = scroll;
  });

  // mobile menu
  const toggle = document.getElementById('menu-toggle');
  const menu = document.getElementById('mobile-menu');
  const items = [...menu.querySelectorAll('a')];
  const open = (on) => {
    toggle.setAttribute('aria-expanded', String(on));
    toggle.setAttribute('aria-label', on ? 'Close menu' : 'Open menu');
    document.body.classList.toggle('menu-open', on);
    if (on) {
      menu.hidden = false;
      gsap.fromTo(menu, { opacity: 0 }, { opacity: 1, duration: 0.5, ease: 'expo.out' });
      gsap.fromTo(items, { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.5, ease: 'expo.out', stagger: { each: 0.06, amount: Math.min(0.4, items.length * 0.06) } });
      lenis?.stop();
    } else {
      gsap.to(menu, { opacity: 0, duration: 0.3, onComplete: () => { menu.hidden = true; } });
      lenis?.start();
    }
  };
  toggle.addEventListener('click', () => open(toggle.getAttribute('aria-expanded') !== 'true'));
  items.forEach((a) => a.addEventListener('click', () => open(false)));
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !menu.hidden) open(false); });
}

/* --------------------------------------------------------- smooth anchors */
export function initAnchors(lenis) {
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = a.getAttribute('href');
    const target = id === '#' ? null : document.querySelector(id);
    if (!target) return;
    e.preventDefault();
    if (lenis) lenis.scrollTo(target, { duration: 1.8, easing: (t) => 1 - Math.pow(1 - t, 4) });
    else target.scrollIntoView({ behavior: 'smooth' });
    history.replaceState(null, '', id);
    if (id === '#main' || id === '#contact') setTimeout(() => target.querySelector('input, a, button')?.focus({ preventScroll: true }), 1600);
  });
  document.getElementById('to-top')?.addEventListener('click', () => {
    window.__sound?.whoosh();
    lenis ? lenis.scrollTo(0, { duration: 2.6, easing: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2) }) : window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

/* --------------------------------------------------------------- why mode
   Pins appear on every element that carries a reason. Hover or focus a pin
   to read why that motion exists. The 3D scene switches to x-ray too.      */
export function initWhy(stage) {
  const btn = document.getElementById('why-toggle');
  const panel = document.getElementById('why-panel');
  let layer = null, raf = 0, pins = [];
  const build = () => {
    layer = document.createElement('div'); layer.className = 'why-layer';
    document.body.appendChild(layer);
    const els = [...document.querySelectorAll('[data-why]')].filter((el) => el.id !== 'loader');
    pins = els.map((el, i) => {
      const p = document.createElement('button');
      p.className = 'why-pin'; p.type = 'button';
      p.setAttribute('aria-label', `Why: ${el.dataset.why}`);
      const name = el.dataset.fx ? `“${(el.getAttribute('aria-label') || el.textContent).trim()}” · ${el.dataset.fx}` : 'Motion logic';
      p.innerHTML = `${i + 1}<span class="why-tip"><b>${name}</b>${el.dataset.why}</span>`;
      p.addEventListener('click', () => p.classList.toggle('open'));
      layer.appendChild(p);
      return { el, p };
    });
    const loop = () => {
      const vh = innerHeight, vw = innerWidth;
      pins.forEach(({ el, p }) => {
        const r = el.getBoundingClientRect();
        const vis = r.bottom > 0 && r.top < vh && r.width > 0;
        p.classList.toggle('show', vis);
        if (vis) { p.style.left = Math.min(vw - 20, Math.max(16, r.right)) + 'px'; p.style.top = Math.min(vh - 20, Math.max(70, r.top)) + 'px'; }
      });
      raf = requestAnimationFrame(loop);
    };
    loop();
  };
  const set = (on) => {
    btn.setAttribute('aria-pressed', String(on));
    document.documentElement.classList.toggle('why-on', on);
    panel.hidden = !on;
    stage?.setXray(on);
    if (on) build(); else { cancelAnimationFrame(raf); layer?.remove(); layer = null; pins = []; }
    window.__sound?.tick(on ? 660 : 330);
  };
  btn.addEventListener('click', () => set(btn.getAttribute('aria-pressed') !== 'true'));
  window.addEventListener('keydown', (e) => {
    if (e.target.closest('input, textarea')) return;
    if (e.key === 'w' || e.key === 'W') set(btn.getAttribute('aria-pressed') !== 'true');
  });
}

/* ------------------------------------------------------------------ sound
   Off by default. Everything is synthesised with WebAudio: no files.
   The strike uses inharmonic partials, which is what makes metal ring.    */
export function initSound() {
  const btn = document.getElementById('sound-toggle');
  let ctx = null, on = false, master = null;
  const ensure = () => {
    if (ctx) return;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = 0.22; master.connect(ctx.destination);
  };
  const env = (node, a, d, peak = 1) => {
    const g = ctx.createGain(); const t = ctx.currentTime;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
    node.connect(g); g.connect(master); return g;
  };
  const api = {
    tick(freq = 440) {
      if (!on) return;
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = freq;
      env(o, 0.004, 0.08, 0.5); o.start(); o.stop(ctx.currentTime + 0.12);
    },
    key() {
      if (!on) return;
      const b = ctx.createBuffer(1, 600, ctx.sampleRate); const d = b.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 6);
      const s = ctx.createBufferSource(); s.buffer = b; const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 2400; s.connect(f); env(f, 0.001, 0.04, 0.4); s.start();
    },
    strike() {
      if (!on) return;
      [1, 2.76, 5.4, 8.93].forEach((m, i) => {
        const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = 620 * m;
        env(o, 0.002, 1.4 / (i + 1), 0.55 / (i + 1)); o.start(); o.stop(ctx.currentTime + 1.6);
      });
      const b = ctx.createBuffer(1, 4000, ctx.sampleRate); const d = b.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3);
      const s = ctx.createBufferSource(); s.buffer = b; env(s, 0.001, 0.12, 0.8); s.start();
    },
    whoosh() {
      if (!on) return;
      const b = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate); const d = b.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      const s = ctx.createBufferSource(); s.buffer = b;
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 3;
      f.frequency.setValueAtTime(300, ctx.currentTime); f.frequency.exponentialRampToValueAtTime(3000, ctx.currentTime + 0.8);
      s.connect(f); env(f, 0.3, 0.6, 0.35); s.start(); s.stop(ctx.currentTime + 1);
    },
  };
  window.__sound = api;
  btn.addEventListener('click', () => {
    ensure(); on = !on; ctx.resume();
    btn.setAttribute('aria-pressed', String(on));
    btn.setAttribute('aria-label', on ? 'Turn interface sound off' : 'Turn interface sound on');
    if (on) api.strike();
  });
}

/* ------------------------------------------------------------------ glass
   Cards carry a hairline border lit by the cursor, like a softbox catching
   the bevel of a glass panel. Only cards on screen are measured.           */
export function initGlass() {
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const visible = new Set();
  const io = new IntersectionObserver((es) => es.forEach((e) => (e.isIntersecting ? visible.add(e.target) : visible.delete(e.target))));
  const add = (el) => io.observe(el);
  document.querySelectorAll('.glass').forEach(add);
  window.__glass = add;
  if (!fine) return;
  let px = 0, py = 0, raf = 0;
  window.addEventListener('pointermove', (e) => {
    px = e.clientX; py = e.clientY;
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      visible.forEach((el) => {
        const r = el.getBoundingClientRect();
        el.style.setProperty('--gx', `${(px - r.left).toFixed(0)}px`);
        el.style.setProperty('--gy', `${(py - r.top).toFixed(0)}px`);
      });
    });
  }, { passive: true });
}
