import * as THREE from 'three';

/*
  The hero wordmark lives inside the WebGL scene, under the ink and the
  controller, so the ink can turn its letters white. "Arfat" and then
  "studio" are written by hand: the script glyphs are thinned to their
  centre line, each point of the line gets the time a pen would reach it
  (walking the stroke from its left end, pen lifts between pieces, dots
  last), and every pixel inherits the time of its nearest point on the
  line. The timing is solved small; the letters are drawn crisp at full
  size and revealed through it.
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

/** write-on timing for a word: the time the pen reaches every pixel, 0 to 1 */
function handwriting(text, px) {
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
  // every inked pixel, plus a two pixel margin, inherits the time of the nearest centre line point
  let q = [];
  for (let i = 0; i < W * H; i++) if (T[i] >= 0) q.push(i);
  for (let k = 0; k < q.length; k++) {
    const j = q[k];
    for (const o of nb) { const m = j + o; if (m >= 0 && m < W * H && A[m] > 0 && T[m] < 0) { T[m] = T[j]; q.push(m); } }
  }
  for (let pass = 0; pass < 2; pass++) {
    const nq = [];
    for (const j of q) for (const o of nb) { const m = j + o; if (m >= 0 && m < W * H && T[m] < 0) { T[m] = T[j]; nq.push(m); } }
    q = q.concat(nq);
  }
  for (let i = 0; i < W * H; i++) T[i] = T[i] < 0 ? 2 : T[i] / end;
  return { W, H, T, pad, base, tw, px };
}

/** a word written by hand: crisp letters at full size, plus its pen timing as an image */
class Written {
  constructor(text) { this.text = text; this.hw = null; this.css = 0; }
  ensure(cssPx, dpr) {
    if (this.hw && Math.abs(this.css - cssPx) < 1) return true;
    const low = Math.round(Math.min(cssPx * dpr, 220));
    if (!document.fonts.check(`400 ${low}px "Yellowtail"`)) return false;
    this.hw = handwriting(this.text, low);
    this.css = cssPx;
    const k = (cssPx * dpr) / low;
    const W = Math.ceil(this.hw.W * k), H = Math.ceil(this.hw.H * k);
    this.crisp = document.createElement('canvas'); this.crisp.width = W; this.crisp.height = H;
    const g = this.crisp.getContext('2d');
    g.font = `400 ${cssPx * dpr}px "Yellowtail", cursive`;
    g.fillStyle = '#0a0a0a';
    g.fillText(this.text, this.hw.pad * k, this.hw.base * k);
    this.k = k; this.span = null;
    return true;
  }
  /** pen time packed into red, inside [a, b] of the whole write; transparent off the glyph */
  timing(a, b) {
    if (this.span && this.span[0] === a && this.span[1] === b) return this.timeCanvas;
    const { T, W, H } = this.hw;
    const c = this.timeCanvas || (this.timeCanvas = document.createElement('canvas'));
    c.width = W; c.height = H;
    const g = c.getContext('2d'), img = g.createImageData(W, H), d = img.data;
    for (let i = 0; i < W * H; i++) {
      if (T[i] > 1.5) continue;
      d[i * 4] = Math.round((a + (b - a) * Math.min(1, T[i])) * 255);
      d[i * 4 + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    this.span = [a, b];
    return c;
  }
  draw(g, tg, x, y, dpr, a, b) {
    const hw = this.hw, s = 1 / dpr, X = x - hw.pad * this.k * s, Y = y - hw.base * this.k * s;
    const w = this.crisp.width * s, h = this.crisp.height * s;
    g.drawImage(this.crisp, X, Y, w, h);
    tg.drawImage(this.timing(a, b), X, Y, w, h);
  }
}

export class HeroTitle {
  constructor() {
    this.canvas = document.createElement('canvas');
    this.g = this.canvas.getContext('2d');
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.minFilter = THREE.LinearFilter;
    this.texture.generateMipmaps = false;
    this.timeCanvas = document.createElement('canvas');
    this.tg = this.timeCanvas.getContext('2d');
    this.timeTexture = new THREE.CanvasTexture(this.timeCanvas);
    this.timeTexture.minFilter = THREE.LinearFilter;
    this.timeTexture.generateMipmaps = false;
    this.write = 0; this.dirty = true;
    this.name = new Written('Arfat');
    this.studio = new Written('studio');
    this.resize();
  }
  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = window.innerWidth; this.h = window.innerHeight; this.dpr = dpr;
    this.canvas.width = Math.round(this.w * dpr); this.canvas.height = Math.round(this.h * dpr);
    // the timing is smooth, so it lives at CSS resolution
    this.timeCanvas.width = this.w; this.timeCanvas.height = this.h;
    this.dirty = true;
  }
  /** drawn once per size; the writing itself is a uniform on the GPU */
  draw() {
    if (!this.dirty) return;
    this.dirty = false;
    const { g, tg, w, h, dpr } = this;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    tg.setTransform(1, 0, 0, 1, 0, 0);
    tg.fillStyle = '#ff0000'; tg.fillRect(0, 0, w, h);
    const mobile = w < 760;
    // the name in script, as large as the screen allows; "studio" follows, smaller, after it
    g.font = '400 100px "Yellowtail", cursive';
    const per = g.measureText('Arfat').width / 100, perS = g.measureText('studio').width / 100;
    const size = Math.min((w * (mobile ? 0.86 : 0.6)) / per, mobile ? w * 0.42 : h * 0.5);
    const ss = size * 0.42;
    if (!this.name.ensure(size, dpr) || !this.studio.ensure(ss, dpr)) { this.dirty = true; return; }
    const nw = per * size, sw = perS * ss;
    const total = mobile ? nw : nw + sw * 0.55;
    const x0 = (w - total) / 2;
    const y0 = mobile ? h * 0.36 : h * 0.6;
    this.name.draw(g, tg, x0, y0, dpr, 0, 0.6);
    for (const c of [g, tg]) {
      c.save();
      if (mobile) c.translate(x0 + nw - sw * 0.95, y0 + ss * 1.05);
      else c.translate(x0 + nw - sw * 0.45, y0 + ss * 0.62);
      c.rotate(-0.07);
    }
    // studio's crisp letters and timing go through the same transform
    const st = this.studio, hw = st.hw, X = -hw.pad * st.k / dpr, Y = -hw.base * st.k / dpr;
    const sW = st.crisp.width / dpr, sH = st.crisp.height / dpr;
    g.drawImage(st.crisp, X, Y, sW, sH);
    tg.drawImage(st.timing(0.62, 1.0), X, Y, sW, sH);
    g.restore(); tg.restore();
    this.texture.needsUpdate = true;
    this.timeTexture.needsUpdate = true;
  }
}

export function titleMaterial(texture) {
  return new THREE.ShaderMaterial({
    uniforms: { uTex: { value: texture }, uTime: { value: null }, uWrite: { value: 0 }, uOpacity: { value: 1 }, uShift: { value: 0 } },
    transparent: true, depthTest: false, depthWrite: false,
    vertexShader: 'uniform float uShift; varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.x, position.y + uShift, 0.0, 1.0); }',
    fragmentShader: /* glsl */ `
      uniform sampler2D uTex, uTime; uniform float uOpacity, uWrite; varying vec2 vUv;
      void main(){
        // the pen has reached a pixel once the write clock passes its time
        float pen = clamp((uWrite * 1.03 - texture2D(uTime, vUv).r) / 0.03, 0.0, 1.0);
        gl_FragColor = vec4(vec3(0.0035), texture2D(uTex, vUv).a * pen * uOpacity);
      }`,
  });
}
