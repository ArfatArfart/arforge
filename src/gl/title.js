import * as THREE from 'three';

/*
  The hero wordmark lives inside the WebGL scene, under the ink and the
  controller, so the ink can turn its letters white. ARFAT rises letter by
  letter. "studio" is handwritten: the script glyphs are thinned to their
  centre line, each point of the line gets the time a pen would reach it
  (walking the stroke from its left end, pen lifts between pieces, dots
  last), and every pixel of the glyph inherits the time of its nearest
  point on the line. Revealing by that time draws the word like a pen.
*/

function thin(B, W, H) {
  // Zhang-Suen thinning to a one pixel centre line
  const del = [];
  let changed = true;
  while (changed) {
    changed = false;
    for (let pass = 0; pass < 2; pass++) {
      del.length = 0;
      for (let y = 1; y < H - 1; y++) {
        for (let x = 1; x < W - 1; x++) {
          const i = y * W + x;
          if (!B[i]) continue;
          const p2 = B[i - W], p3 = B[i - W + 1], p4 = B[i + 1], p5 = B[i + W + 1], p6 = B[i + W], p7 = B[i + W - 1], p8 = B[i - 1], p9 = B[i - W - 1];
          const n = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9;
          if (n < 2 || n > 6) continue;
          const s = (!p2 && p3 ? 1 : 0) + (!p3 && p4 ? 1 : 0) + (!p4 && p5 ? 1 : 0) + (!p5 && p6 ? 1 : 0) + (!p6 && p7 ? 1 : 0) + (!p7 && p8 ? 1 : 0) + (!p8 && p9 ? 1 : 0) + (!p9 && p2 ? 1 : 0);
          if (s !== 1) continue;
          if (pass === 0 ? (p2 && p4 && p6) || (p4 && p6 && p8) : (p2 && p4 && p8) || (p2 && p6 && p8)) continue;
          del.push(i);
        }
      }
      if (del.length) { changed = true; for (const i of del) B[i] = 0; }
    }
  }
}

const N8 = (W) => [-W - 1, -W, -W + 1, -1, 1, W - 1, W, W + 1];

/** glyph coverage plus a write-on time for every pixel, 0 at the first touch of the pen, 1 at the last */
function handwriting(text, px, color = '#0a0a0a') {
  const pad = Math.ceil(px * 0.45);
  const c = document.createElement('canvas');
  const g = c.getContext('2d', { willReadFrequently: true });
  g.font = `400 ${px}px "Yellowtail", cursive`;
  const tw = Math.ceil(g.measureText(text).width);
  const W = tw + pad * 2, H = Math.ceil(px * 1.5) + pad * 2;
  c.width = W; c.height = H;
  const base = Math.round(pad + px * 1.0);
  g.font = `400 ${px}px "Yellowtail", cursive`;
  g.fillStyle = '#000';
  g.fillText(text, pad, base);
  const img = g.getImageData(0, 0, W, H);
  const A = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) A[i] = img.data[i * 4 + 3];
  const B = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) B[i] = A[i] > 110 ? 1 : 0;
  thin(B, W, H);
  const nb = N8(W);
  // pieces of the centre line (letters joined by the script are one piece)
  const comp = new Int32Array(W * H).fill(-1);
  const pieces = [];
  for (let i = 0; i < W * H; i++) {
    if (!B[i] || comp[i] >= 0) continue;
    const id = pieces.length, q = [i]; comp[i] = id;
    let start = i, size = 0;
    for (let k = 0; k < q.length; k++) {
      const j = q[k]; size++;
      const jx = j % W, sx = start % W;
      if (jx < sx || (jx === sx && j > start)) start = j;
      for (const o of nb) { const m = j + o; if (B[m] && comp[m] < 0) { comp[m] = id; q.push(m); } }
    }
    pieces.push({ id, start, size, minX: start % W });
  }
  const total = pieces.reduce((a, p) => a + p.size, 0) || 1;
  // write the strokes left to right; tiny pieces (the dot of the i) come last, like a pen going back
  pieces.sort((a, b) => ((a.size < total * 0.03) - (b.size < total * 0.03)) || a.minX - b.minX);
  const T = new Float32Array(W * H).fill(-1);
  let offset = 0;
  for (const p of pieces) {
    const q = [p.start]; T[p.start] = offset;
    let far = offset;
    for (let k = 0; k < q.length; k++) {
      const j = q[k];
      for (const o of nb) { const m = j + o; if (B[m] && T[m] < 0) { T[m] = T[j] + 1; far = Math.max(far, T[m]); q.push(m); } }
    }
    offset = far + px * 0.12;
  }
  const end = offset || 1;
  // every inked pixel inherits the time of the nearest centre line point
  const q = [];
  for (let i = 0; i < W * H; i++) if (T[i] >= 0) q.push(i);
  for (let k = 0; k < q.length; k++) {
    const j = q[k];
    for (const o of nb) { const m = j + o; if (m >= 0 && m < W * H && A[m] > 0 && T[m] < 0) { T[m] = T[j]; q.push(m); } }
  }
  for (let i = 0; i < W * H; i++) T[i] = T[i] < 0 ? 1 : T[i] / end;
  const col = new THREE.Color(color);
  const out = document.createElement('canvas'); out.width = W; out.height = H;
  const og = out.getContext('2d');
  const od = og.createImageData(W, H);
  for (let i = 0; i < W * H; i++) { od.data[i * 4] = col.r * 255; od.data[i * 4 + 1] = col.g * 255; od.data[i * 4 + 2] = col.b * 255; }
  return { W, H, A, T, pad, base, tw, out, og, od, px, last: -1 };
}

function paint(hw, p) {
  if (Math.abs(p - hw.last) < 1e-4) return;
  hw.last = p;
  const { A, T, od, W, H } = hw;
  const soft = 0.018, edge = p * (1 + soft);
  const d = od.data;
  for (let i = 0; i < W * H; i++) {
    const a = A[i];
    if (!a) { d[i * 4 + 3] = 0; continue; }
    const k = (edge - T[i]) / soft;
    d[i * 4 + 3] = k >= 1 ? a : k <= 0 ? 0 : a * k;
  }
  hw.og.putImageData(od, 0, 0);
}

export class HeroTitle {
  constructor() {
    this.canvas = document.createElement('canvas');
    this.g = this.canvas.getContext('2d');
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.minFilter = THREE.LinearFilter;
    this.texture.generateMipmaps = false;
    this.rise = 0; this.write = 0; this.dirty = true;
    this.hw = null;
    this.resize();
  }
  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = window.innerWidth; this.h = window.innerHeight; this.dpr = dpr;
    this.canvas.width = Math.round(this.w * dpr); this.canvas.height = Math.round(this.h * dpr);
    this.dirty = true;
  }
  draw() {
    if (!this.dirty) return;
    this.dirty = false;
    const { g, w, h, dpr } = this;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    const mobile = w < 760;
    const word = 'ARFAT';
    // fit the word to the screen: 92% of the width on phones, 86% on desktop
    g.font = '700 100px "Geist Variable", system-ui, sans-serif';
    if ('letterSpacing' in g) g.letterSpacing = '0px';
    const per = (g.measureText(word).width - 100 * 0.055 * (word.length - 1)) / 100;
    const size = Math.min((w * (mobile ? 0.92 : 0.86)) / per, mobile ? w * 0.34 : h * 0.44);
    g.font = `700 ${size}px "Geist Variable", system-ui, sans-serif`;
    const tw = per * size;
    const x0 = (w - tw) / 2;
    const y0 = mobile ? h * 0.36 : h * 0.6;
    // bold letters rise out of a baseline mask, one after another
    g.save();
    g.beginPath(); g.rect(0, y0 - size * 0.95, w, size * 1.12); g.clip();
    g.fillStyle = '#0a0a0a';
    let x = x0;
    for (let i = 0; i < word.length; i++) {
      const ch = word[i];
      const k = Math.min(1, Math.max(0, this.rise * 1.6 - i * 0.09));
      const e = 1 - Math.pow(1 - k, 4);
      g.fillText(ch, x, y0 + (1 - e) * size * 1.05);
      x += g.measureText(ch).width - size * 0.055;
    }
    g.restore();
    // "studio", written by hand
    const ss = size * (mobile ? 0.4 : 0.34);
    const fpx = Math.round(Math.min(ss * dpr, 280));
    if (!document.fonts.check(`400 ${fpx}px "Yellowtail"`)) { this.dirty = true; this.texture.needsUpdate = true; return; }
    if (!this.hw || Math.abs(this.hw.px - fpx) > 2) this.hw = handwriting('studio', fpx);
    const hw = this.hw;
    paint(hw, this.write);
    const k = ss * dpr / fpx / dpr; // canvas px per handwriting px, in CSS units
    const sw = hw.tw * k;
    g.save();
    g.translate(x0 + tw - sw * 0.9, y0 + ss * 0.78);
    g.rotate(-0.09);
    g.drawImage(hw.out, -hw.pad * k, -hw.base * k, hw.W * k, hw.H * k);
    g.restore();
    this.texture.needsUpdate = true;
  }
}

export function titleMaterial(texture) {
  return new THREE.ShaderMaterial({
    uniforms: { uTex: { value: texture }, uOpacity: { value: 1 }, uShift: { value: 0 } },
    transparent: true, depthTest: false, depthWrite: false,
    vertexShader: 'uniform float uShift; varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.x, position.y + uShift, 0.0, 1.0); }',
    fragmentShader: 'uniform sampler2D uTex; uniform float uOpacity; varying vec2 vUv; void main(){ float a = texture2D(uTex, vUv).a; gl_FragColor = vec4(vec3(0.0035), a * uOpacity); }',
  });
}
