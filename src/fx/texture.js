/*
  Material typography.
  Each heading is filled with a real photographic material (Poly Haven,
  re-graded per theme): titanium, black marble, blue steel, molten metal,
  brass and more. Every glyph-holding element samples the same texture at
  its own offset, so the material runs continuously across letters even
  while they animate. A specular band follows the cursor across the type,
  the way a light reflects off engraved metal.
*/
const SKIP = '.loadbar,.slash,.sketch-line,.mark-bg,.rec-dot,.ruler,.ruler-val,.swipe-pill,.type-caret,svg,br';

function leaves(h) {
  // give bare text inside the heading a span so it can carry the material too
  [...h.childNodes].forEach((n) => {
    if (n.nodeType === 3 && n.textContent.trim()) {
      const s = document.createElement('span'); s.className = 'pw'; s.textContent = n.textContent; n.replaceWith(s);
    }
  });
  const out = [];
  const walk = (el) => {
    if (el !== h && [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) out.push(el);
    [...el.children].forEach((c) => { if (!c.matches(SKIP)) walk(c); });
  };
  walk(h);
  return out;
}

export function initTextures({ reduced } = {}) {
  const heads = [...document.querySelectorAll('[data-tex]')];
  const map = new Map();
  heads.forEach((h) => {
    h.classList.add('textured');
    map.set(h, leaves(h));
  });
  const measure = () => map.forEach((ls, h) => {
    const hr = h.getBoundingClientRect();
    h.style.setProperty('--hw', `${hr.width.toFixed(0)}px`);
    h.style.setProperty('--hh', `${hr.height.toFixed(0)}px`);
    ls.forEach((l) => {
      l.classList.add('tx');
      const r = l.getBoundingClientRect();
      l.style.setProperty('--lx', `${(r.left - hr.left).toFixed(1)}px`);
      l.style.setProperty('--ly', `${(r.top - hr.top).toFixed(1)}px`);
    });
  });
  measure();
  let rz;
  window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(measure, 250); });

  // the specular band: follows the pointer, sweeps by itself when idle
  const visible = new Set();
  const io = new IntersectionObserver((es) => es.forEach((e) => (e.isIntersecting ? visible.add(e.target) : visible.delete(e.target))));
  heads.forEach((h) => io.observe(h));
  let px = -9999, last = 0, raf = 0;
  const paint = (x) => {
    const hs = [...visible], lefts = hs.map((h) => h.getBoundingClientRect().left);
    hs.forEach((h, i) => h.style.setProperty('--sx', `${(x - lefts[i]).toFixed(0)}px`));
  };
  window.addEventListener('pointermove', (e) => {
    px = e.clientX; last = performance.now();
    if (!raf) raf = requestAnimationFrame(() => { raf = 0; paint(px); });
  }, { passive: true });
  return { measure };
}
