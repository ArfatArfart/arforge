import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import {
  siReact, siNextdotjs, siVuedotjs, siTypescript, siTailwindcss, siThreedotjs, siVite, siFigma,
  siFlutter, siDart, siSwift, siKotlin, siAndroid, siApple, siExpo,
  siNodedotjs, siPython, siGo, siFastapi, siDjango, siGraphql, siStripe, siRust,
  siPostgresql, siMongodb, siRedis, siFirebase, siSupabase, siPrisma,
  siDocker, siKubernetes, siGooglecloud, siVercel, siCloudflare, siGithubactions, siNginx,
} from 'simple-icons';
import { CONFIG } from './config.js';
import SNAPSHOT from './data/repos.snapshot.json';

const BASE = import.meta.env.BASE_URL;
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));

/* =================================================================== GitHub
   One shared request for the whole page, cached for ten minutes so the
   hero, the terminal and the work grid never spend the API rate limit twice. */
let ghPromise = null;
export function github() {
  if (ghPromise) return ghPromise;
  const KEY = 'arforge-gh-v1';
  ghPromise = (async () => {
    try {
      const c = JSON.parse(sessionStorage.getItem(KEY) || 'null');
      if (c && Date.now() - c.t < 6e5) return { ...c.d, cached: true };
    } catch { /* storage may be blocked */ }
    const time = async (url) => {
      const ctrl = new AbortController(); const to = setTimeout(() => ctrl.abort(), 7000);
      const t0 = performance.now();
      const res = await fetch(url, { signal: ctrl.signal, headers: { Accept: 'application/vnd.github+json' } });
      clearTimeout(to);
      if (!res.ok) throw new Error(String(res.status));
      const txt = await res.text();
      return { ms: Math.round(performance.now() - t0), bytes: txt.length, data: JSON.parse(txt), status: res.status };
    };
    try {
      const [u, r] = await Promise.all([
        time(`https://api.github.com/users/${CONFIG.githubUser}`),
        time(`https://api.github.com/users/${CONFIG.githubUser}/repos?per_page=100&sort=updated`),
      ]);
      const d = { user: u.data, repos: r.data, timing: { user: u.ms, repos: r.ms, bytes: u.bytes + r.bytes }, live: true };
      try { sessionStorage.setItem(KEY, JSON.stringify({ t: Date.now(), d })); } catch { /* ignore */ }
      return d;
    } catch (e) {
      return { user: { public_repos: SNAPSHOT.length }, repos: SNAPSHOT, timing: null, live: false, error: String(e.message || e) };
    }
  })();
  return ghPromise;
}

const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
function ago(iso) {
  const s = (new Date(iso).getTime() - Date.now()) / 1000;
  const units = [['year', 31536000], ['month', 2592000], ['week', 604800], ['day', 86400], ['hour', 3600], ['minute', 60]];
  for (const [u, n] of units) if (Math.abs(s) >= n) return rtf.format(Math.round(s / n), u);
  return 'just now';
}

/* ===================================================================== Hero */
export async function initHeroProof() {
  const d = await github();
  const repos = d.repos || [];
  const live = repos.filter((r) => r.has_pages).length;
  const count = (el, to) => { const o = { v: 0 }; gsap.to(o, { v: to, duration: 1.4, ease: 'expo.out', onUpdate: () => { el.textContent = Math.round(o.v); } }); };
  count(document.getElementById('proof-repos'), d.user?.public_repos ?? repos.length);
  count(document.getElementById('proof-live'), live);
}

export function initMarquee(lenis) {
  const track = document.getElementById('marquee');
  if (!track) return;
  track.innerHTML += track.innerHTML;
  let x = 0, skew = 0;
  const skewTo = gsap.quickSetter(track, 'skewX', 'deg');
  gsap.ticker.add((t, dt) => {
    const v = lenis ? lenis.velocity : 0;
    x -= (0.04 + Math.abs(v) * 0.02) * dt;
    const half = track.scrollWidth / 2;
    if (-x > half) x += half;
    track.style.transform = `translate3d(${x}px,0,0)`;
    skew += (clamp(v * -0.6, -14, 14) - skew) * 0.1;
    skewTo(skew);
  });
}

export function initHud(stage) {
  const pct = document.getElementById('scan-pct'), hx = document.getElementById('hud-x'), hy = document.getElementById('hud-y');
  const label = document.getElementById('scanline-label');
  const hero = document.getElementById('hero');
  let inHero = true, ready = false;
  gsap.delayedCall(3.2, () => { ready = true; });
  hero.addEventListener('pointermove', () => { stage.heroPointerY = 1; });
  hero.addEventListener('pointerleave', () => { stage.heroPointerY = null; });
  gsap.ticker.add(() => {
    inHero = hero.getBoundingClientRect().bottom > window.innerHeight * 0.35;
    label.classList.toggle('on', inHero && ready);
    if (!inHero) return;
    if (stage.scanPct !== undefined) pct.textContent = stage.scanPct.toFixed(1).padStart(4, '0');
    hx.textContent = stage.mouseWorld.x.toFixed(3); hy.textContent = stage.mouseWorld.y.toFixed(3);
    if (stage.scanScreen) {
      const hr = hero.querySelector('.hero-hud').getBoundingClientRect();
      label.style.transform = `translate(${Math.min(hr.width - 80, stage.scanScreen.x - hr.left)}px, ${stage.scanScreen.y - hr.top - 20}px)`;
    }
  });
}

/* ===================================================================== Work */
const CURATE = [
  { name: 'forge-gym-demo', title: 'Forge Athletic Club', img: 'forge-gym-demo.webp', big: true, kind: 'Landing page' },
  { name: 'medinest-pharmacy-demo', title: 'MediNest Pharmacy', img: 'medinest-pharmacy-demo.webp', big: true, kind: 'Mobile first website' },
  { name: 'NWF-WEB', title: 'NWF Studio', img: 'nwf-web.webp', desc: 'Studio landing page with full bleed art direction and editorial type.', kind: 'Agency site' },
  { name: 'stationery-point', title: 'Stationery Point', img: 'stationery-point.webp', desc: 'Storefront website for a local stationery shop, built around a real shop photo.', kind: 'Business site' },
  { name: 'crazypin', title: 'Crazypin Arena', img: 'crazypin.webp', kind: 'Web app' },
  { name: 'investigation-workspace', title: 'Investigation Console', img: 'investigation-workspace.webp', desc: 'Investigation workspace with sign in and account creation flows.', kind: 'Web app' },
];
const ARROW = '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17L17 7M9 7h8v8"/></svg>';

export async function initWork() {
  const grid = document.getElementById('work-grid');
  const d = await github();
  const repos = d.repos || SNAPSHOT;
  const byName = Object.fromEntries(repos.map((r) => [r.name, r]));
  const user = (d.user && d.user.login) || CONFIG.githubUser;
  grid.innerHTML = CURATE.map((c, i) => {
    const r = byName[c.name] || SNAPSHOT.find((x) => x.name === c.name) || {};
    const live = r.homepage || (r.has_pages ? `https://${user.toLowerCase()}.github.io/${c.name}/` : null);
    const desc = r.description || c.desc || 'Source available on GitHub.';
    return `
      <article class="card ${c.big ? 'big' : ''}">
        <a class="card-media" href="${live || r.html_url}" target="_blank" rel="noopener" data-cursor="${live ? 'Open live' : 'Open repo'}">
          <img src="${BASE}work/${c.img}" alt="Screenshot of the ${c.title} live site" loading="lazy" decoding="async" width="1200" height="750" />
          <span class="shine" aria-hidden="true"></span>
        </a>
        <div class="card-body">
          <div class="card-top"><h3 class="title-1">${c.title}</h3><span class="caption-3 mono card-idx">${String(i + 1).padStart(2, '0')}</span></div>
          <p class="body-6 card-desc">${desc}</p>
          <div class="card-meta caption-4">
            ${r.language ? `<span class="lang"><i></i>${r.language}</span><span aria-hidden="true">·</span>` : ''}
            <span>${c.kind}</span>
            ${r.updated_at ? `<span aria-hidden="true">·</span><span>Updated ${ago(r.updated_at)}</span>` : ''}
          </div>
          <div class="card-links">
            ${live ? `<a class="caption-1" href="${live}" target="_blank" rel="noopener">Live site ${ARROW}</a>` : ''}
            ${r.html_url ? `<a class="caption-1" href="${r.html_url}" target="_blank" rel="noopener" data-cursor="Source">Source ${ARROW}</a>` : ''}
          </div>
        </div>
      </article>`;
  }).join('') + (d.live ? '' : `<p class="work-error caption-2">GitHub is not answering right now, so these cards use a saved snapshot. Live links still work.</p>`);
  grid.dataset.why = 'Cards drop in with a slight tilt that settles, like prints laid on a desk, and lean toward your cursor so the one you are reading comes forward.';

  const cards = [...grid.querySelectorAll('.card')];
  gsap.set(cards, { opacity: 0, y: 60, rotate: () => gsap.utils.random(-3, 3) });
  ScrollTrigger.batch(cards, { start: 'top 88%', once: true, onEnter: (b) => gsap.to(b, { opacity: 1, y: 0, rotate: 0, duration: 0.9, ease: 'expo.out', stagger: 0.08 }) });
  if (matchMedia('(hover: hover)').matches) {
    cards.forEach((c) => {
      const rx = gsap.quickTo(c, 'rotationX', { duration: 0.6, ease: 'power3.out' });
      const ry = gsap.quickTo(c, 'rotationY', { duration: 0.6, ease: 'power3.out' });
      gsap.set(c, { transformPerspective: 900 });
      c.addEventListener('pointermove', (e) => {
        const r = c.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
        rx((0.5 - py) * 7); ry((px - 0.5) * 9);
        c.style.setProperty('--mx', `${px * 100}%`); c.style.setProperty('--my', `${py * 100}%`);
      });
      c.addEventListener('pointerleave', () => { rx(0); ry(0); });
    });
  }
  ScrollTrigger.refresh();
}

/* ==================================================================== Stack */
const STACK = [
  [siReact, 'web', 'Frontend'], [siNextdotjs, 'web', 'Frontend'], [siVuedotjs, 'web', 'Frontend'], [siTypescript, 'web', 'Frontend'],
  [siTailwindcss, 'web', 'Frontend'], [siThreedotjs, 'web', 'Frontend'], [siVite, 'web', 'Frontend'], [siFigma, 'web', 'Design'],
  [siFlutter, 'mobile', 'Mobile'], [siDart, 'mobile', 'Mobile'], [siSwift, 'mobile', 'Mobile'], [siKotlin, 'mobile', 'Mobile'],
  [siAndroid, 'mobile', 'Mobile'], [siApple, 'mobile', 'Mobile'], [siExpo, 'mobile', 'Mobile'],
  [siNodedotjs, 'backend', 'Backend'], [siPython, 'backend', 'Backend'], [siGo, 'backend', 'Backend'], [siFastapi, 'backend', 'Backend'],
  [siDjango, 'backend', 'Backend'], [siGraphql, 'backend', 'Backend'], [siStripe, 'backend', 'Backend'], [siRust, 'backend', 'Backend'],
  [siPostgresql, 'data', 'Data'], [siMongodb, 'data', 'Data'], [siRedis, 'data', 'Data'], [siFirebase, 'data', 'Data'],
  [siSupabase, 'data', 'Data'], [siPrisma, 'data', 'Data'],
  [siDocker, 'infra', 'Infra'], [siKubernetes, 'infra', 'Infra'], [siGooglecloud, 'infra', 'Infra'], [siVercel, 'infra', 'Infra'],
  [siCloudflare, 'infra', 'Infra'], [siGithubactions, 'infra', 'Infra'], [siNginx, 'infra', 'Infra'],
];

export function initStack(stage) {
  const orb = document.getElementById('orb');
  const hover = document.getElementById('stack-hover');
  const n = STACK.length;
  const ga = Math.PI * (3 - Math.sqrt(5));
  const items = STACK.map(([si, cat, label], i) => {
    const y = 1 - (i / (n - 1)) * 2, r = Math.sqrt(1 - y * y), th = ga * i;
    const el = document.createElement('button');
    el.className = 'orb-item'; el.type = 'button';
    el.style.setProperty('--brand', `#${si.hex}`);
    el.setAttribute('aria-label', `${si.title}, ${label}`);
    el.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${si.path}"/></svg>`;
    const show = () => { hover.textContent = `${si.title} · ${label}`; };
    el.addEventListener('pointerenter', show); el.addEventListener('focus', show);
    orb.appendChild(el);
    return { el, cat, base: [Math.cos(th) * r, y, Math.sin(th) * r], cur: [0, 0, 0], tgt: [0, 0, 0] };
  });
  let yaw = 0, pitch = 0.25, vy = 0.0025, vp = 0, filter = 'all', drag = null, visible = false;
  ScrollTrigger.create({ trigger: '#stack', start: 'top bottom', end: 'bottom top', onToggle: (s) => { visible = s.isActive; } });

  orb.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY }; orb.setPointerCapture(e.pointerId); });
  orb.addEventListener('pointermove', (e) => {
    if (!drag) return;
    vy = (e.clientX - drag.x) * 0.004; vp = (e.clientY - drag.y) * 0.004;
    drag = { x: e.clientX, y: e.clientY };
  });
  const end = () => { drag = null; };
  orb.addEventListener('pointerup', end); orb.addEventListener('pointercancel', end);

  document.querySelectorAll('#stack-chips .chip').forEach((c) => c.addEventListener('click', () => {
    filter = c.dataset.cat;
    document.querySelectorAll('#stack-chips .chip').forEach((x) => { const on = x === c; x.classList.toggle('is-on', on); x.setAttribute('aria-pressed', String(on)); });
    hover.textContent = filter === 'all' ? 'Hover a logo' : `${items.filter((it) => it.cat === filter).length} tools brought forward`;
    window.__sound?.tick(440);
  }));

  gsap.ticker.add(() => {
    if (!visible) return;
    yaw += vy; pitch = clamp(pitch + vp, -1.2, 1.2);
    if (!drag) { vy += (0.0025 - vy) * 0.03; vp *= 0.92; }
    stage.sphereSpin.y = yaw; stage.sphereSpin.x = pitch * 0.5;
    const sph = stage.byId?.sphere;
    const R = sph && !stage.mobile ? (sph.layout.s / stage.viewH) * window.innerHeight * 1.02 : Math.min(orb.clientWidth, orb.clientHeight) * 0.42;
    const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
    const sel = items.filter((it) => filter !== 'all' && it.cat === filter);
    items.forEach((it) => {
      const [x0, y0, z0] = it.base;
      const x1 = x0 * cy + z0 * sy, z1 = -x0 * sy + z0 * cy;
      const y2 = y0 * cp - z1 * sp, z2 = y0 * sp + z1 * cp;
      let t = [x1, y2, z2];
      if (filter !== 'all') {
        const k = sel.indexOf(it);
        if (k >= 0) { const cols = Math.ceil(Math.sqrt(sel.length)); t = [((k % cols) - (cols - 1) / 2) * 0.42, (Math.floor(k / cols) - (Math.ceil(sel.length / cols) - 1) / 2) * 0.42, 1.15]; }
        else t = [x1 * 1.1, y2 * 1.1, Math.min(z2, -0.2) - 0.5];
      }
      for (let a = 0; a < 3; a++) it.cur[a] += (t[a] - it.cur[a]) * 0.09;
      const [x, y, z] = it.cur;
      const sc = 0.55 + (z + 1) * 0.35;
      it.el.style.transform = `translate3d(${x * R}px, ${y * R}px, 0) scale(${sc.toFixed(3)})`;
      it.el.style.opacity = String(clamp(0.18 + (z + 1) * 0.45, 0.12, 1).toFixed(2));
      it.el.style.zIndex = String(Math.round((z + 2) * 100));
      it.el.classList.toggle('is-hot', filter !== 'all' && it.cat === filter);
    });
  });
}

/* ================================================================== Metrics */
export function initMetrics(stage, t0) {
  const gauges = [...document.querySelectorAll('.gauge')];
  const MAX = { fps: 144, ms: 50, points: 40000, calls: 30, bytes: 8000, ready: 6000 };
  gauges.forEach((g) => gsap.set(g.querySelector('.needle'), { rotation: -90, svgOrigin: '60 62' }));
  let visible = false;
  ScrollTrigger.create({ trigger: '#metrics', start: 'top bottom', end: 'bottom top', onToggle: (s) => { visible = s.isActive; } });
  const bytes = () => {
    let b = 0;
    for (const e of performance.getEntriesByType('resource')) b += Math.max(e.transferSize || 0, e.encodedBodySize || 0);
    const nav = performance.getEntriesByType('navigation')[0];
    if (nav) b += Math.max(nav.transferSize || 0, nav.encodedBodySize || 0);
    return Math.round(b / 1024);
  };
  const read = () => ({ fps: stage.stats.fps, ms: stage.stats.ms, points: stage.stats.points || 0, calls: stage.stats.calls || 0, bytes: bytes(), ready: stage.introAt ? Math.round(stage.introAt - t0) : 0 });
  const fmt = (k, v) => (k === 'ms' ? v.toFixed(1) : Math.round(v).toLocaleString('en'));
  setInterval(() => {
    if (!visible) return;
    const v = read();
    gauges.forEach((g) => {
      const k = g.dataset.key, val = v[k] ?? 0, f = clamp(val / MAX[k]);
      gsap.to(g.querySelector('.needle'), { rotation: -90 + f * 180, svgOrigin: '60 62', duration: 1.2, ease: 'elastic.out(1, 0.5)', overwrite: true });
      gsap.to(g.querySelector('.arc'), { strokeDashoffset: 157.08 * (1 - f), duration: 0.8, ease: 'power3.out', overwrite: true });
      g.querySelector('.val').textContent = fmt(k, val);
    });
  }, 400);
  // the GPU actually rendering this page
  try {
    const gl = stage.renderer.getContext();
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    let s = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
    const m = /ANGLE \([^,]*,\s*([^(,]+?)(?:\s+Direct3D|\s+\(|,|\))/.exec(s);
    if (m) s = m[1];
    s = s.replace(/\s+(vs|ps)_\d_\d.*$/, '').trim();
    if (s) document.getElementById('gpu').innerHTML = `Rendering on <b>${s.replace(/[<>&]/g, '')}</b>, at ${window.devicePixelRatio.toFixed(2)}x pixel density.`;
  } catch { /* fine */ }
}

/* ================================================================= Terminal */
export function initTerminal(stage, tz) {
  const term = document.getElementById('term');
  let started = false;
  const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const line = async (text, cls = '', speed = 14) => {
    const s = document.createElement('span'); if (cls) s.className = cls; term.appendChild(s);
    for (let i = 0; i <= text.length; i += 2) { s.textContent = text.slice(0, i); await sleep(speed); }
    s.textContent = text; term.appendChild(document.createTextNode('\n'));
    while (term.scrollHeight > term.clientHeight + 4 && term.firstChild) term.removeChild(term.firstChild);
  };
  const kb = (b) => (b > 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB');
  const run = async () => {
    await line(`$ whoami`, 'k');
    await line(`visitor · ${tz} · ${navigator.hardwareConcurrency || '?'} cpu threads`, 'm');
    await line(`$ curl -s api.github.com/users/${CONFIG.githubUser}`, 'k');
    const d = await github();
    if (d.live && d.timing) await line(`200 OK · ${d.timing.user} ms · public_repos=${d.user.public_repos}`, 'ok');
    else if (d.cached) await line(`200 OK · served from this tab's cache · public_repos=${d.user.public_repos}`, 'ok');
    else await line(`offline (${d.error}) · using saved snapshot`, 'warn');
    await line(`$ curl -s api.github.com/zen`, 'k');
    try {
      const t = performance.now();
      const r = await fetch('https://api.github.com/zen');
      const z = await r.text();
      await line(`${r.status} OK · ${Math.round(performance.now() - t)} ms`, r.ok ? 'ok' : 'warn');
      if (r.ok) await line(`"${z.trim()}"`, '');
    } catch { await line('rate limited · try again in a minute', 'warn'); }
    await line(`$ tail network.log`, 'k');
    const res = performance.getEntriesByType('resource').filter((e) => /\.(glb|hdr|jpg|png|webp)$/.test(e.name)).slice(0, 6);
    for (const e of res) {
      const name = e.name.split('/').pop().split('?')[0];
      await line(`GET ${name.padEnd(26, ' ').slice(0, 26)}${kb(Math.max(e.encodedBodySize || 0, e.transferSize || 0)).padStart(8)}${String(Math.round(e.duration)).padStart(6)} ms`, '', 6);
    }
    await line(`$ uptime`, 'k');
    const up = Math.round(performance.now() / 1000);
    await line(`page alive ${String(Math.floor(up / 60)).padStart(2, '0')}:${String(up % 60).padStart(2, '0')} · ${stage.stats.fps} fps · ${stage.stats.tris.toLocaleString('en')} triangles`, 'ok');
    const c = document.createElement('span'); c.className = 'caret'; term.appendChild(document.createTextNode('$ ')); term.appendChild(c);
  };
  ScrollTrigger.create({ trigger: term, start: 'top 85%', once: true, onEnter: () => { if (!started) { started = true; run(); } } });
  void esc;
}

/* ==================================================================== Phone */
export function initPhone() {
  const time = document.getElementById('phone-time');
  const tick = () => { time.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }); };
  tick(); setInterval(tick, 15000);
  // chart: a smooth random walk that keeps moving, like live usage data
  const path = document.getElementById('phone-line');
  const pts = Array.from({ length: 24 }, (_, i) => 40 + Math.sin(i / 2) * 10);
  const draw = () => {
    pts.shift(); pts.push(clamp(pts[pts.length - 1] + (Math.random() - 0.45) * 14, 8, 62));
    path.setAttribute('d', pts.map((y, i) => `${i ? 'L' : 'M'}${(i / (pts.length - 1)) * 200} ${70 - y}`).join(' '));
  };
  draw(); setInterval(draw, 700);
  const checks = [...document.querySelectorAll('.phone-checks .chk')];
  ScrollTrigger.create({ trigger: '.phone', start: 'top 75%', once: true, onEnter: () => checks.forEach((c, i) => setTimeout(() => { c.classList.add('ok'); window.__sound?.tick(700 + i * 90); }, 300 + i * 320)) });

  const slider = document.getElementById('ship-slider');
  const knob = slider.querySelector('.slider-knob'), fill = slider.querySelector('.slider-fill'), text = slider.querySelector('.slider-text');
  const toast = document.getElementById('phone-toast');
  let x = 0, start = null, done = false;
  const max = () => slider.clientWidth - knob.offsetWidth - 8;
  const set = (v) => {
    x = clamp(v, 0, max());
    knob.style.transform = `translateX(${x}px)`;
    fill.style.transform = `scaleX(${(x + 26) / slider.clientWidth})`;
    text.style.opacity = String(1 - x / max());
    slider.setAttribute('aria-valuenow', String(Math.round((x / max()) * 100)));
  };
  const complete = () => {
    done = true; set(max());
    toast.textContent = 'Build 1.0.0 shipped to testers.';
    window.__sound?.strike();
    gsap.fromTo(toast, { y: 10, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: 'expo.out' });
    setTimeout(() => { const o = { v: x }; gsap.to(o, { v: 0, duration: 0.8, ease: 'expo.inOut', onUpdate: () => set(o.v), onComplete: () => { done = false; toast.textContent = ''; } }); }, 2600);
  };
  knob.addEventListener('pointerdown', (e) => { if (done) return; start = e.clientX - x; knob.setPointerCapture(e.pointerId); });
  knob.addEventListener('pointermove', (e) => { if (start !== null) set(e.clientX - start); });
  const release = () => {
    if (start === null) return; start = null;
    if (x > max() * 0.85) complete();
    else { const o = { v: x }; gsap.to(o, { v: 0, duration: 0.7, ease: 'elastic.out(1, 0.5)', onUpdate: () => set(o.v) }); }
  };
  knob.addEventListener('pointerup', release); knob.addEventListener('pointercancel', release);
  slider.addEventListener('keydown', (e) => {
    if (done) return;
    if (e.key === 'ArrowRight') { set(x + max() / 8); if (x >= max()) complete(); e.preventDefault(); }
    if (e.key === 'ArrowLeft') { set(x - max() / 8); e.preventDefault(); }
    if (e.key === 'Enter' || e.key === ' ') { complete(); e.preventDefault(); }
  });
}

/* ================================================================== Process */
export function initProcess(stage, reduced) {
  const steps = [...document.querySelectorAll('.step')];
  const rail = document.getElementById('rail-fill');
  let active = -1;
  const hit = (i) => {
    if (i === active) return;
    const forward = i > active;
    active = i;
    steps.forEach((s, k) => s.classList.toggle('is-hit', k <= i));
    gsap.to(rail, { scaleX: (i + 1) / steps.length, duration: 0.6, ease: 'expo.out' });
    if (forward && i >= 0) stage.strike(i);
  };
  stage.onStrike = () => { window.__sound?.strike(); };
  const mm = gsap.matchMedia();
  mm.add('(min-width: 901px)', () => {
    const track = document.getElementById('process-track');
    const dist = () => Math.max(0, track.scrollWidth - window.innerWidth);
    const tw = gsap.to(track, {
      x: () => -dist(), ease: 'none',
      scrollTrigger: {
        trigger: '#process', pin: true, start: 'top top', end: () => '+=' + (dist() + window.innerHeight * 0.6), scrub: reduced ? true : 1, invalidateOnRefresh: true,
        onUpdate: (self) => hit([0.04, 0.3, 0.56, 0.82].filter((x) => self.progress >= x).length - 1),
        onLeaveBack: () => hit(-1),
      },
    });
    return () => tw.scrollTrigger?.kill();
  });
  mm.add('(max-width: 900px)', () => {
    const sts = steps.map((s, i) => ScrollTrigger.create({ trigger: s, start: 'top 65%', onEnter: () => hit(i), onLeaveBack: () => hit(i - 1) }));
    return () => sts.forEach((s) => s.kill());
  });
}

/* ==================================================================== FAQ */
export function initFaq() {
  const all = [...document.querySelectorAll('.qa')];
  all.forEach((d) => d.addEventListener('toggle', () => {
    if (d.open) { all.forEach((o) => { if (o !== d) o.open = false; }); window.__sound?.tick(560); }
    setTimeout(() => ScrollTrigger.refresh(), 520);
  }));
}

/* ================================================================== Footer */
export function initFooter(stage, tzInfo) {
  document.getElementById('year').textContent = String(new Date().getFullYear());
  document.getElementById('tz').textContent = tzInfo.zone;
  const clock = () => { document.getElementById('tz-time').textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }); };
  clock(); setInterval(clock, 10000);

  // heat letters: they heat instantly near the cursor and cool slowly, like metal
  const title = document.querySelector('.footer-title');
  const split = SplitText.create(title.querySelectorAll('.ln'), { type: 'chars', charsClass: 'ch', tag: 'span' });
  const chars = split.chars;
  const heat = new Float32Array(chars.length);
  const mix = gsap.utils.interpolate;
  let px = -9999, py = -9999, visible = false;
  ScrollTrigger.create({ trigger: '#contact', start: 'top bottom', end: 'bottom top', onToggle: (s) => { visible = s.isActive; } });
  window.addEventListener('pointermove', (e) => { px = e.clientX; py = e.clientY; }, { passive: true });
  gsap.ticker.add((t, dt) => {
    if (!visible) return;
    const cs = getComputedStyle(document.documentElement);
    const fg = cs.getPropertyValue('--fg').trim(), acc = cs.getPropertyValue('--accent').trim();
    chars.forEach((c, i) => {
      const r = c.getBoundingClientRect();
      const d = Math.hypot(r.left + r.width / 2 - px, r.top + r.height / 2 - py);
      const target = clamp(1 - d / 240);
      heat[i] = target > heat[i] ? heat[i] + (target - heat[i]) * 0.35 : Math.max(target, heat[i] - dt * 0.0006);
      const h = heat[i];
      c.style.color = h < 0.02 ? '' : h < 0.65 ? mix(fg, acc, h / 0.65) : mix(acc, '#fff3c4', (h - 0.65) / 0.35);
      c.style.transform = h < 0.02 ? '' : `translateY(${(-h * 10).toFixed(2)}px)`;
      c.style.textShadow = h < 0.05 ? '' : `0 0 ${Math.round(h * 36)}px ${acc}`;
    });
  });
  // entrance for the footer title
  gsap.from(chars, { yPercent: 110, opacity: 0, duration: 1.1, ease: 'expo.out', stagger: 0.02, scrollTrigger: { trigger: title, start: 'top 85%', once: true } });

  // the wordmark is outlined; your cursor is the heat that fills it
  const wm = document.getElementById('wordmark');
  wm.addEventListener('pointermove', (e) => { const r = wm.getBoundingClientRect(); wm.style.setProperty('--wx', `${e.clientX - r.left}px`); wm.style.setProperty('--wy', `${e.clientY - r.top}px`); });
  wm.addEventListener('pointerleave', () => { wm.style.setProperty('--wx', '-999px'); wm.style.setProperty('--wy', '-999px'); });

  // drag the globe
  let drag = null;
  const canvasDrag = (e) => {
    const footer = document.getElementById('contact');
    const r = footer.getBoundingClientRect();
    return e.clientX > r.left + r.width * 0.55 && e.clientY > r.top && e.clientY < r.top + r.height * 0.7;
  };
  document.getElementById('contact').addEventListener('pointerdown', (e) => { if (e.target.closest('input, textarea, button, a') || !canvasDrag(e)) return; drag = e.clientX; });
  window.addEventListener('pointermove', (e) => { if (drag === null) return; stage.earthDrag += (e.clientX - drag) * 0.006; drag = e.clientX; });
  window.addEventListener('pointerup', () => { drag = null; });

  // dialogs
  document.querySelectorAll('[data-dialog]').forEach((b) => b.addEventListener('click', () => document.getElementById(`dlg-${b.dataset.dialog}`).showModal()));
  initForm();
}

function initForm() {
  const form = document.getElementById('brief');
  const status = document.getElementById('form-status');
  const kinds = [...document.querySelectorAll('#f-kind .chip')];
  kinds.forEach((k) => k.addEventListener('click', () => { const on = k.getAttribute('aria-pressed') !== 'true'; k.setAttribute('aria-pressed', String(on)); k.classList.toggle('is-on', on); }));
  const fields = { name: form.elements.name, email: form.elements.email, msg: form.elements.message };
  const err = (key, text) => {
    const f = fields[key]; const box = f.closest('.field'); const e = document.getElementById(`e-${key}`);
    box.classList.toggle('has-error', !!text); e.textContent = text || '';
    f.setAttribute('aria-invalid', text ? 'true' : 'false');
    if (text) f.setAttribute('aria-describedby', `e-${key}`); else f.removeAttribute('aria-describedby');
  };
  const validate = () => {
    let ok = true;
    if (!fields.name.value.trim()) { err('name', 'Add your name so we know who to reply to.'); ok = false; } else err('name');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(fields.email.value.trim())) { err('email', 'That email address looks incomplete. Check it and try again.'); ok = false; } else err('email');
    if (fields.msg.value.trim().length < 12) { err('msg', 'Tell us a little more, at least a sentence about the project.'); ok = false; } else err('msg');
    return ok;
  };
  Object.values(fields).forEach((f) => f.addEventListener('blur', () => { if (f.value) validate(); }));
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!validate()) { form.querySelector('[aria-invalid="true"]')?.focus(); return; }
    const kind = kinds.filter((k) => k.getAttribute('aria-pressed') === 'true').map((k) => k.textContent).join(', ') || 'Not sure yet';
    const brief = `Name: ${fields.name.value.trim()}\nEmail: ${fields.email.value.trim()}\nBuilding: ${kind}\n\n${fields.msg.value.trim()}`;
    window.__sound?.strike();
    if (CONFIG.contactEmail) {
      location.href = `mailto:${CONFIG.contactEmail}?subject=${encodeURIComponent('Project brief from ' + fields.name.value.trim())}&body=${encodeURIComponent(brief)}`;
      status.textContent = 'Your email app is opening with the brief filled in. Press send there to reach Arfat.';
    } else {
      const issue = `https://github.com/${CONFIG.githubUser}/arforge/issues/new?title=${encodeURIComponent('Project brief: ' + kind)}&body=${encodeURIComponent(fields.msg.value.trim() + '\n\nBuilding: ' + kind + '\n(Add how we can reach you.)')}`;
      navigator.clipboard?.writeText(brief).catch(() => {});
      status.innerHTML = `Brief copied to your clipboard. <a href="${issue}" target="_blank" rel="noopener">Send it through GitHub</a> to reach Arfat.`;
    }
  });
}
