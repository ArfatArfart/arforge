import '@fontsource-variable/geist';
import '@fontsource-variable/geist-mono';
import '@fontsource/yellowtail';
import './styles/main.css';
import './styles/fx.css';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { Stage } from './gl/stage.js';
import { applyTheme } from './themes.js';
import { initWords, initTagline } from './fx/words.js';
import { initCursor, initMagnetic, initNav, initAnchors, initWhy, initSound, initGlass } from './ui.js';
import { initTextures } from './fx/texture.js';
import { Intro } from './fx/intro.js';
import { initTextMotion, heroTextIn } from './fx/textmotion.js';
import * as S from './sections.js';

gsap.registerPlugin(ScrollTrigger);
const T0 = performance.now();
const STILL = new URLSearchParams(location.search).has('still'); // instant final frame, used to render the share image
const reduced = STILL || matchMedia('(prefers-reduced-motion: reduce)').matches;
const mobile = innerWidth < 760;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
document.body.classList.add('is-loading');
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
window.scrollTo(0, 0);

/* ---------- visitor time zone → where to point the globe (no permission prompt) */
function visitorTZ() {
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const lon = clamp((-new Date().getTimezoneOffset() / 60) * 15, -180, 180);
  const region = zone.split('/')[0];
  const LAT = { Asia: 24, Europe: 48, Africa: 6, America: 36, Australia: -28, Pacific: -12, Atlantic: 30, Indian: -10, Antarctica: -75 };
  let lat = LAT[region] ?? 20;
  if (region === 'America' && /Sao_Paulo|Argentina|Santiago|Lima|Bogota|Caracas|Montevideo|La_Paz|Asuncion|Recife|Manaus/.test(zone)) lat = -15;
  return { zone: zone.replace(/_/g, ' '), lat, lon };
}
const tz = visitorTZ();

/* ---------- smooth scroll, one clock for everything */
const lenis = reduced ? null : new Lenis({ lerp: 0.075, smoothWheel: true, wheelMultiplier: 0.9, syncTouch: false });
if (lenis) {
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
  lenis.stop();
}

/* ---------- the stage (with a graceful fallback when WebGL is missing) */
const loaderFile = document.getElementById('loader-file');
const intro = new Intro(document.getElementById('loader'), '#FDEA2C');
const onProgress = (p, file) => {
  intro.progress(p);
  if (file && file !== 'ready') loaderFile.textContent = `Loading ${file}, ${Math.round(p * 100)} percent`;
};

let stage;
try {
  stage = new Stage(document.getElementById('stage'), { onProgress, mobile, reduced });
} catch (e) {
  console.warn('WebGL unavailable, continuing without the 3D stage', e);
  document.documentElement.classList.add('no-gl');
  stage = {
    stats: { fps: 0, ms: 0, tris: 0, calls: 0, ready: 0 }, N: 0, field: { uniforms: { uOpacity: { value: 0 } } },
    mouseWorld: { x: 0, y: 0 }, sphereSpin: { x: 0, y: 0 }, earthDrag: 0, renderer: { getContext: () => ({ getParameter: () => '', getExtension: () => null, RENDERER: 0 }) },
    loadCritical: async () => onProgress(1, 'ready'), loadRest: async () => {}, update() {}, resize() {}, setTheme() {}, setPointer() {}, strike() {}, setXray() {},
  };
}
stage.visitor = tz;
if (import.meta.env.DEV) window.__stage = stage;
gsap.ticker.add(() => stage.update());

/* ---------- scroll position → which 3D shot (a float: 2.4 = 40% from shot 2 to 3) */
let shotMap = [];
function buildShotMap() {
  const groups = [];
  document.querySelectorAll('[data-shot]').forEach((el) => {
    const outer = el.parentElement?.classList.contains('pin-spacer') ? el.parentElement : el;
    const r = outer.getBoundingClientRect();
    const top = r.top + window.scrollY, bottom = top + r.height;
    const id = el.dataset.shot;
    const last = groups[groups.length - 1];
    if (last && last.id === id) last.bottom = bottom; else groups.push({ id, top, bottom });
  });
  shotMap = groups.map((g) => ({ ...g, index: stage.shots ? stage.shots.findIndex((s) => s.id === g.id) : 0 }));
  stage.anchorTop = Object.fromEntries(groups.map((g) => [g.id, g.top]));
}
function shotAt(y) {
  const vh = window.innerHeight;
  for (let k = 0; k < shotMap.length; k++) {
    const cur = shotMap[k], next = shotMap[k + 1];
    if (!next) return cur.index;
    const holdEnd = Math.max(cur.top - 0.15 * vh, cur.bottom - 0.85 * vh);
    const nextStart = next.top - 0.15 * vh;
    if (y <= holdEnd) return cur.index;
    if (y < nextStart) return cur.index + ((y - holdEnd) / Math.max(1, nextStart - holdEnd)) * (next.index - cur.index);
  }
  return 0;
}
const footerEl = document.getElementById('contact');
// page metrics are measured on refresh and resize, never inside the frame (no forced layout)
const metrics = { max: 1, start: 0 };
const measure = () => { metrics.max = document.documentElement.scrollHeight - innerHeight; metrics.start = footerEl.offsetTop; if (stage.slotBox) stage.slotBox.stale = true; };
ScrollTrigger.addEventListener('refresh', measure);
gsap.ticker.add(() => {
  if (shotMap.length) stage.sTarget = shotAt(window.scrollY);
  stage.footerT = clamp((window.scrollY - metrics.start) / Math.max(1, metrics.max - metrics.start), 0, 1);
});
ScrollTrigger.addEventListener('refresh', buildShotMap);

window.addEventListener('pointermove', (e) => stage.setPointer((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1), { passive: true });
let rz;
window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => { stage.resize(); ScrollTrigger.refresh(); }, 180); });

/* ---------- build the page */
applyTheme('molten', stage, true);
await Promise.all([document.fonts.ready, document.fonts.load('700 120px "Geist Variable"'), document.fonts.load('400 120px Yellowtail')]).catch(() => {});
// heavy setup runs in short pieces with breaks between them, so the intro never stutters
const breathe = () => new Promise((r) => (globalThis.scheduler?.yield ? scheduler.yield().then(r) : setTimeout(r, 0)));
const headings = initWords({ reduced });
await breathe();
initTagline(document.getElementById('tagline'), { reduced });
initTextures({ reduced });
await breathe();
initGlass();
initTextMotion({ reduced });
await breathe();
S.initProcess(stage, reduced);
// themes follow whichever section crosses 55% of the screen, measured from real
// layout (pin spacers included), so jumping anywhere always lands on the right world
let themeMap = [];
const buildThemeMap = () => {
  themeMap = [...document.querySelectorAll('main [data-theme], footer[data-theme]')].map((sec) => {
    const outer = sec.parentElement?.classList.contains('pin-spacer') ? sec.parentElement : sec;
    const r = outer.getBoundingClientRect();
    return { theme: sec.dataset.theme, top: r.top + window.scrollY, bottom: r.bottom + window.scrollY };
  });
};
ScrollTrigger.addEventListener('refresh', buildThemeMap);
gsap.ticker.add(() => {
  const y = window.scrollY + window.innerHeight * 0.55;
  const hit = themeMap.find((t) => y >= t.top && y < t.bottom) || themeMap[themeMap.length - 1];
  if (hit) applyTheme(hit.theme, stage);
});
initCursor();
initMagnetic();
initNav(lenis);
initAnchors(lenis);
initSound();
initWhy(stage);
S.initHero(stage);
S.initStack(stage);
await breathe();
S.initMetrics(stage, T0);
S.initTerminal(stage, tz.zone);
S.initPhone(stage);
S.initFaq();
await breathe();
S.initFooter(stage, tz);
S.initWork();
await breathe();

// generic reveals: blocks rise 32px and fade once, on the base curve
const revealSel = '.model-note, .slot-help, .terminal, .gauge, .chips, .brief, .footer-mid, .chapter-num';
document.querySelectorAll(revealSel).forEach((el) => {
  if (el.closest('#hero')) return;
  if (reduced) return;
  gsap.from(el, { y: 32, opacity: 0, duration: 0.8, ease: 'expo.out', scrollTrigger: { trigger: el, start: 'top 90%', once: true } });
});
// icons animate only once they are on screen
document.querySelectorAll('.chapter-num').forEach((n) => ScrollTrigger.create({ trigger: n, start: 'top 85%', once: true, onEnter: () => n.classList.add('in') }));

ScrollTrigger.refresh();

/* ---------- load the forge, then strike */
async function boot() {
  try { await stage.loadCritical(); }
  catch (e) { console.error(e); loaderFile.textContent = 'The 3D scan could not load. Continuing without it.'; onProgress(1, 'ready'); }
  await intro.play();
  const loader = document.getElementById('loader');
  stage.introAt = performance.now();
  // the yellow flood hands over to the live hero, which is the same yellow
  gsap.to(loader, { opacity: 0, duration: 0.45, ease: 'power2.out', onComplete: () => loader.remove() });
  gsap.to(stage, { intro: 1, duration: reduced ? 0.01 : 2.2, ease: 'power2.inOut' });
  gsap.to(stage, { lights: 1, duration: reduced ? 0.01 : 2.0, delay: reduced ? 0 : 0.6, ease: 'power1.inOut' });
  gsap.delayedCall(reduced ? 0 : 1.5, () => stage.inkBurst?.());
  if (stage.title) {
    // the script is written at a hand's pace, not wiped
    // the name, then "studio", written at a hand's pace (one clock, pen order baked into a texture)
    gsap.to(stage.title, { write: 1, duration: reduced ? 0.01 : 3.0, ease: 'sine.inOut', delay: 0.35 });
  }
  if (STILL) document.documentElement.classList.add('still');
  heroTextIn({ reduced, delay: 1.1 });
  S.initHeroProof();
  document.body.classList.remove('is-loading');
  lenis?.start();
  ScrollTrigger.refresh();
  await stage.loadRest();
}
boot();
