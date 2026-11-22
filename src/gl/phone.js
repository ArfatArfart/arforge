import * as THREE from 'three';

/*
  Devices.
  · iPhone 15 Pro Max, real model by polyman on Sketchfab (CC BY 4.0).
    The Apple logo patch is hidden; the display runs a live canvas.
  · MacBook Pro, real model from the pmndrs examples (MIT).
  Screens are not pictures: they are canvases redrawn at 30 fps and pushed
  through a shader that can sweep a wave of coloured pixels between sites
  and flip pixels, cell by cell, wherever the hero's ink touches the glass.
*/
export const IPHONE = {
  file: 'models/iphone_15_pro_max.glb',
  screenNode: 'xXDHkMplTIDAXLN',
  logoNode: 'IykfmVvLplTsTEW',
  keep: new Set(['zFdeDaGNRwzccye', 'ujsvqBWRMnqdwPx', 'hUlRcbieVuIiOXG', 'jlzuBkUzuJqgiAK', 'xNrofRCqOXXHVZt', 'pIJKfZsazmcpEiU']),
};
export const MACBOOK = { file: 'models/macbook_pro.glb', screenMat: 'screen.001', hinge: 'screenflip' };
export const FINISH = { black: null, natural: '#9a958c', desert: '#bda48c', white: '#e6e4df' };

export function screenUniforms() {
  return {
    uPrev: { value: null }, uSweep: { value: 1 }, uSweepOn: { value: 0 },
    uInk: { value: null }, uInkGain: { value: 0 }, uRes: { value: new THREE.Vector2(1, 1) },
    uCols: { value: 64 }, uAspectInv: { value: 2.16 }, uScreenTime: { value: 0 },
    uAltA: { value: new THREE.Color('#ff3d8b') }, uAltB: { value: new THREE.Color('#fff36b') },
  };
}

/* the screen shader: pixel sweep between sites, and the ink's night edition */
export function screenPatch(u) {
  return (shader) => {
    Object.assign(shader.uniforms, u);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform sampler2D uPrev, uInk; uniform float uSweep, uSweepOn, uInkGain, uCols, uAspectInv, uScreenTime;
        uniform vec2 uRes; uniform vec3 uAltA, uAltB;`)
      .replace('#include <emissivemap_fragment>', `
        #ifdef USE_EMISSIVEMAP
          vec2 suv = vEmissiveMapUv;
          vec2 grid = vec2(uCols, uCols * uAspectInv);
          vec2 cell = (floor(suv * grid) + 0.5) / grid;
          float hc = fract(sin(dot(cell, vec2(12.9898, 78.233))) * 43758.5453);
          vec3 cur = texture2D(emissiveMap, suv).rgb;
          // a wave of pixels runs from the top of the glass to the bottom when the site changes
          float front = 1.12 - uSweep * 1.26;
          float dy = cell.y - front + (hc - 0.5) * 0.07;
          vec3 col = (dy > 0.0 || uSweepOn < 0.5) ? cur : texture2D(uPrev, suv).rgb;
          vec3 hot = 0.5 + 0.5 * cos(6.2831 * (hc + uScreenTime * 0.6 + vec3(0.0, 0.33, 0.67)));
          float sband = (1.0 - smoothstep(0.0, 0.085, abs(dy))) * uSweepOn;
          col = mix(col, hot * 1.15, sband * step(0.22, hc));
          // ink: inside the fluid each cell flips to the night edition of the same page
          float ink = texture2D(uInk, gl_FragCoord.xy / uRes).r * uInkGain;
          float thr = 0.1 + hc * 0.3;
          float flip = step(thr, ink);
          vec3 px = texture2D(emissiveMap, cell).rgb;
          float lum = dot(px, vec3(0.299, 0.587, 0.114));
          vec3 night = mix(vec3(0.02, 0.015, 0.04), mix(uAltA, uAltB, smoothstep(0.3, 0.9, lum)), smoothstep(0.05, 0.5, lum));
          col = mix(col, night, flip);
          col += hot * flip * (1.0 - step(thr + 0.1, ink)) * 0.9;
          totalEmissiveRadiance *= col;
        #endif`);
  };
}

const COPY = ['name', 'color', 'map', 'normalMap', 'normalScale', 'roughness', 'roughnessMap', 'metalness', 'metalnessMap', 'aoMap', 'aoMapIntensity', 'emissive', 'emissiveMap', 'emissiveIntensity', 'transparent', 'opacity', 'side', 'alphaMap', 'depthWrite', 'alphaTest'];
function toPhysical(m) {
  const p = new THREE.MeshPhysicalMaterial();
  COPY.forEach((k) => { if (m[k] !== undefined && m[k] !== null) p[k] = m[k] && m[k].clone && !m[k].isTexture ? m[k].clone() : m[k]; });
  return p;
}

/** iPhone holder, 1 unit tall, facing +Z, with its own materials and a live screen */
export function makeIPhone(src, { screenTexture, finish = 'black', envMap, fx } = {}) {
  const root = src.clone(true);
  let screen = null;
  root.traverse((o) => {
    if (!o.isMesh) return;
    if (o.name === IPHONE.logoNode) { o.visible = false; o.userData.skipSample = true; return; }
    o.material = o.material.clone();
    const m = o.material;
    if (envMap) { m.envMap = envMap; m.envMapIntensity = 1.2; }
    if (o.name === IPHONE.screenNode) {
      screen = o;
      const sm = new THREE.MeshStandardMaterial({ color: '#000000', map: screenTexture, emissive: '#ffffff', emissiveMap: screenTexture, emissiveIntensity: 1.0, roughness: 0.05, metalness: 0, envMap, envMapIntensity: 0.55 });
      sm.name = 'screen';
      if (fx) sm.userData.extraPatch = screenPatch(fx);
      o.material = sm;
      return;
    }
    if (!IPHONE.keep.has(m.name) && !m.transparent) {
      // real titanium: polished, faintly anisotropic, under a thin clear coat
      const p = toPhysical(m);
      if (FINISH[finish]) p.color = new THREE.Color(FINISH[finish]);
      p.clearcoat = 0.6; p.clearcoatRoughness = 0.12; p.envMap = envMap; p.envMapIntensity = 1.3;
      o.material = p;
    }
  });
  const box = new THREE.Box3().setFromObject(root);
  const c = box.getCenter(new THREE.Vector3());
  const k = 1 / (box.max.y - box.min.y);
  root.position.copy(c).multiplyScalar(-k);
  root.scale.multiplyScalar(k);
  const face = new THREE.Group(); face.rotation.y = Math.PI; face.add(root);
  const holder = new THREE.Group(); holder.add(face);
  holder.userData.screen = screen;
  return holder;
}

/** MacBook holder, 1 unit wide, lid opened to a natural angle, with a live screen */
export function makeMacBook(src, { screenTexture, envMap } = {}) {
  const root = src.clone(true);
  root.traverse((o) => {
    if (o.name === MACBOOK.hinge) o.rotation.x = -0.32;
    if (!o.isMesh) return;
    const m = o.material;
    if (m && m.name === MACBOOK.screenMat) {
      o.material = new THREE.MeshStandardMaterial({ color: '#000000', map: screenTexture, emissive: '#ffffff', emissiveMap: screenTexture, emissiveIntensity: 1.0, roughness: 0.1, metalness: 0, envMap, envMapIntensity: 0.4 });
      return;
    }
    o.material = m.clone();
    if (envMap) { o.material.envMap = envMap; o.material.envMapIntensity = 1.2; }
  });
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const c = box.getCenter(new THREE.Vector3());
  const k = 1 / (box.max.x - box.min.x);
  root.position.copy(c).multiplyScalar(-k);
  root.scale.multiplyScalar(k);
  const holder = new THREE.Group(); holder.add(root);
  return holder;
}

/* ======================================================================
   Scroll pacing shared by synced screens: hold, flick, settle, then glide
   back to the top. Two devices reading the same pacer scroll as one.
   ====================================================================== */
const ease = (t) => 1 - Math.pow(1 - t, 3);
const ease2 = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export class Pacer {
  constructor() { this.p = 0; this.phase = 'hold'; this.t = 0; this.from = 0; this.to = 0; this.dur = 1; }
  update(dt) {
    this.t += dt;
    if (this.phase === 'hold' && this.t > 1.7) {
      this.from = this.p;
      if (this.p >= 0.999) { this.to = 0; this.dur = 2.6; } else { this.to = Math.min(1, this.p + 0.13 + Math.random() * 0.08); this.dur = 1.35; }
      this.phase = 'move'; this.t = 0;
    }
    if (this.phase === 'move') {
      const k = Math.min(1, this.t / this.dur);
      this.p = this.from + (this.to - this.from) * (this.to === 0 ? ease2(k) : ease(k));
      if (k >= 1) { this.phase = 'hold'; this.t = 0; }
    }
  }
}

const SW = 640, SH = 1384, PT = SW / 430;
const SAFE_TOP = Math.round(59 * PT), BAR = Math.round(84 * PT);
function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function statusBar(g, dark) {
  const c = dark ? '#000' : '#fff';
  const t = new Date();
  g.fillStyle = c;
  g.font = `600 ${Math.round(17 * PT)}px "Geist Variable", system-ui, sans-serif`;
  g.fillText(`${t.getHours() % 12 || 12}:${String(t.getMinutes()).padStart(2, '0')}`, 52 * PT, 37 * PT);
  const x0 = 330 * PT, y0 = 37 * PT;
  for (let i = 0; i < 4; i++) g.fillRect(x0 + i * 6 * PT, y0 - (i + 1) * 3 * PT, 4 * PT, (i + 1) * 3 * PT);
  g.strokeStyle = c; g.lineWidth = 2.2 * PT; g.lineCap = 'round';
  for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(x0 + 37 * PT, y0 + 1 * PT, (3 + i * 4) * PT, Math.PI * 1.25, Math.PI * 1.75); g.stroke(); }
  g.globalAlpha = 0.4; rr(g, x0 + 50 * PT, y0 - 12 * PT, 25 * PT, 12 * PT, 3.5 * PT); g.lineWidth = 1.2 * PT; g.stroke(); g.globalAlpha = 1;
  g.fillStyle = c; rr(g, x0 + 52 * PT, y0 - 10 * PT, 19 * PT, 8 * PT, 2 * PT); g.fill();
}
function loadSite(s, onFirst) {
  const img = new Image(); img.decoding = 'async'; img.src = s.src;
  img.onload = () => {
    s.img = img;
    const c = document.createElement('canvas'); c.width = 16; c.height = 4;
    const x = c.getContext('2d'); x.drawImage(img, 0, 0, img.naturalWidth, 60, 0, 0, 16, 4);
    const d = x.getImageData(0, 0, 16, 4).data; let r = 0, gg = 0, b = 0;
    for (let p = 0; p < d.length; p += 4) { r += d[p]; gg += d[p + 1]; b += d[p + 2]; }
    const n = d.length / 4; r /= n; gg /= n; b /= n;
    s.top = `rgb(${r | 0},${gg | 0},${b | 0})`;
    s.dark = 0.2126 * r + 0.7152 * gg + 0.0722 * b > 140;
    onFirst?.();
  };
}

/* Safari on the iPhone: real full length captures with human pacing */
export class SafariScreen {
  constructor(sites, { pacer = null } = {}) {
    this.canvas = document.createElement('canvas'); this.canvas.width = SW; this.canvas.height = SH;
    this.g = this.canvas.getContext('2d');
    this.prev = document.createElement('canvas'); this.prev.width = SW; this.prev.height = SH;
    this.prev.getContext('2d').fillRect(0, 0, SW, SH);
    this.texture = new THREE.CanvasTexture(this.canvas); this.texture.colorSpace = THREE.SRGBColorSpace; this.texture.anisotropy = 16;
    this.prevTexture = new THREE.CanvasTexture(this.prev); this.prevTexture.colorSpace = THREE.SRGBColorSpace;
    this.sites = sites.map((s) => ({ ...s, img: null, top: '#ffffff', dark: true }));
    this.pacer = pacer;
    this.t = 0; this.boot = 0; this.i = 0; this.scroll = 0; this.from = 0; this.to = 0; this.st = 0; this.phase = 'hold'; this.pt = 0;
    this.sweep = 1; this.sweepOn = 0; this.booted = false;
    this.sites.forEach((s, k) => loadSite(s, () => { if (k === 0) this.draw(0); }));
  }
  page(k) { return this.sites[((k % this.sites.length) + this.sites.length) % this.sites.length]; }
  startSweep() {
    this.prev.getContext('2d').drawImage(this.canvas, 0, 0);
    this.prevTexture.needsUpdate = true;
    this.sweep = 0; this.sweepOn = 1;
  }
  drawPage(s, scroll) {
    const g = this.g;
    g.fillStyle = s.top; g.fillRect(0, 0, SW, SH);
    if (s.img) g.drawImage(s.img, 0, SAFE_TOP - scroll, SW, (s.img.naturalHeight * SW) / s.img.naturalWidth);
    g.fillStyle = s.top; g.fillRect(0, 0, SW, SAFE_TOP);
    statusBar(g, s.dark);
    const y = SH - BAR;
    g.fillStyle = s.dark ? 'rgba(246,246,248,0.95)' : 'rgba(28,28,30,0.95)'; g.fillRect(0, y, SW, BAR);
    g.fillStyle = s.dark ? 'rgba(118,118,128,0.14)' : 'rgba(118,118,128,0.3)'; rr(g, 16 * PT, y + 8 * PT, SW - 32 * PT, 36 * PT, 12 * PT); g.fill();
    g.fillStyle = s.dark ? '#1c1c1e' : '#f2f2f7';
    g.font = `500 ${Math.round(15 * PT)}px "Geist Variable", system-ui, sans-serif`; g.textAlign = 'center';
    g.fillText(s.host, SW / 2 + 6 * PT, y + 31 * PT); g.textAlign = 'left';
    const lw = g.measureText(s.host).width, lx = SW / 2 - lw / 2 - 12 * PT, ly = y + 22 * PT;
    rr(g, lx - 5 * PT, ly, 10 * PT, 8 * PT, 1.5 * PT); g.fill();
    g.strokeStyle = g.fillStyle; g.lineWidth = 1.6 * PT; g.beginPath(); g.arc(lx, ly, 3.3 * PT, Math.PI, 0); g.stroke();
    g.fillStyle = s.dark ? 'rgba(0,0,0,0.85)' : 'rgba(255,255,255,0.85)'; rr(g, SW / 2 - 67 * PT, SH - 9 * PT, 134 * PT, 5 * PT, 2.5 * PT); g.fill();
  }
  draw(dt) {
    const g = this.g; this.t += dt;
    if (this.sweepOn) { this.sweep = Math.min(1, this.sweep + dt / 1.15); if (this.sweep >= 1) this.sweepOn = 0; }
    if (this.boot < 1) {
      g.fillStyle = '#000'; g.fillRect(0, 0, SW, SH);
      g.globalAlpha = Math.sin(Math.min(1, this.boot) * Math.PI);
      g.strokeStyle = '#f5f5f7'; g.lineWidth = 12; g.lineCap = 'round'; g.lineJoin = 'round';
      g.beginPath(); g.moveTo(262, 760); g.lineTo(320, 620); g.lineTo(378, 760); g.stroke();
      g.beginPath(); g.moveTo(288, 712); g.lineTo(372, 712); g.stroke();
      g.globalAlpha = 1; this.texture.needsUpdate = true; return;
    }
    if (!this.booted) { this.booted = true; this.startSweep(); }
    const s = this.page(this.i);
    const viewH = SH - SAFE_TOP - BAR;
    const maxScroll = s.img ? Math.max(0, (s.img.naturalHeight * SW) / s.img.naturalWidth - viewH) : 0;
    if (this.pacer) this.scroll = this.pacer.p * maxScroll;
    else {
      this.pt += dt;
      if (this.phase === 'hold' && this.pt > 1.6) {
        if (this.scroll >= maxScroll - 4 || this.st >= 3) { this.startSweep(); this.i++; this.scroll = 0; this.st = 0; this.pt = 0; }
        else { this.phase = 'flick'; this.pt = 0; this.from = this.scroll; this.to = Math.min(maxScroll, this.scroll + 520 + Math.random() * 380); this.st++; }
      }
      if (this.phase === 'flick') {
        const k = Math.min(1, this.pt / 1.3);
        this.scroll = this.from + (this.to - this.from) * ease(k);
        if (k >= 1) { this.phase = 'hold'; this.pt = 0; }
      }
    }
    this.drawPage(this.page(this.i), this.scroll);
    // Dynamic Island live activity as each site arrives
    const il = !this.pacer && this.phase === 'hold' && this.st === 0 && this.pt > 0.5 && this.pt < 1.55 ? Math.min(1, (this.pt - 0.5) / 0.3, (1.55 - this.pt) / 0.3) : 0;
    if (il > 0) {
      const e = ease(il), w = 126 * PT + e * 210 * PT, h = 37 * PT + e * 26 * PT, x = (SW - w) / 2, y = 11 * PT;
      g.fillStyle = '#000'; rr(g, x, y, w, h, h / 2); g.fill();
      if (e > 0.65) {
        g.globalAlpha = (e - 0.65) / 0.35;
        g.fillStyle = '#30d158'; g.beginPath(); g.arc(x + 26 * PT, y + h / 2, 5 * PT, 0, 7); g.fill();
        g.fillStyle = '#fff'; g.font = `600 ${Math.round(13 * PT)}px "Geist Variable", sans-serif`; g.fillText('Live on GitHub Pages', x + 40 * PT, y + h / 2 - 2 * PT);
        g.fillStyle = 'rgba(255,255,255,0.6)'; g.font = `500 ${Math.round(11 * PT)}px "Geist Mono Variable", monospace`; g.fillText(s.name, x + 40 * PT, y + h / 2 + 13 * PT);
        g.globalAlpha = 1;
      }
    }
    this.texture.needsUpdate = true;
  }
}

/* Safari on the MacBook: a macOS window running the desktop capture */
export class MacScreen {
  constructor(site, pacer) {
    this.W = 1600; this.H = 1036;
    this.canvas = document.createElement('canvas'); this.canvas.width = this.W; this.canvas.height = this.H;
    this.g = this.canvas.getContext('2d');
    this.texture = new THREE.CanvasTexture(this.canvas); this.texture.colorSpace = THREE.SRGBColorSpace; this.texture.anisotropy = 16;
    this.texture.flipY = false; // the MacBook's screen UVs run top to bottom
    this.site = { ...site, img: null, top: '#000', dark: false };
    this.pacer = pacer; this.t = 0;
    loadSite(this.site, () => this.draw(0));
  }
  draw(dt) {
    const { g, W, H } = this; this.t += dt;
    g.fillStyle = '#1d1d1f'; g.fillRect(0, 0, W, H);
    // menu bar
    g.fillStyle = 'rgba(30,30,32,0.96)'; g.fillRect(0, 0, W, 34);
    g.fillStyle = '#f5f5f7'; g.font = '600 18px "Geist Variable", sans-serif'; g.fillText('Safari', 52, 23);
    g.font = '500 17px "Geist Variable", sans-serif'; ['File', 'Edit', 'View', 'History'].forEach((m, i) => g.fillText(m, 128 + i * 64, 23));
    const tt = new Date(); g.textAlign = 'right'; g.fillText(tt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }), W - 24, 23); g.textAlign = 'left';
    // window
    const wx = 40, wy = 60, ww = W - 80, wh = H - 96;
    g.save(); rr(g, wx, wy, ww, wh, 18); g.clip();
    g.fillStyle = '#2b2b2e'; g.fillRect(wx, wy, ww, 64);
    ['#ff5f57', '#febc2e', '#28c840'].forEach((c, i) => { g.fillStyle = c; g.beginPath(); g.arc(wx + 28 + i * 24, wy + 32, 7.5, 0, 7); g.fill(); });
    g.fillStyle = '#3a3a3d'; rr(g, wx + ww / 2 - 260, wy + 16, 520, 34, 10); g.fill();
    g.fillStyle = '#d1d1d6'; g.font = '500 17px "Geist Variable", sans-serif'; g.textAlign = 'center';
    g.fillText(`${this.site.host}/${this.site.name}`, wx + ww / 2, wy + 39); g.textAlign = 'left';
    const cy = wy + 64, ch = wh - 64;
    if (this.site.img) {
      const ih = (this.site.img.naturalHeight * ww) / this.site.img.naturalWidth;
      const scroll = this.pacer.p * Math.max(0, ih - ch);
      g.drawImage(this.site.img, wx, cy - scroll, ww, ih);
    }
    g.restore();
    // a pointer drifts like someone reading
    const px = W * (0.55 + Math.sin(this.t * 0.4) * 0.18), py = H * (0.55 + Math.cos(this.t * 0.31) * 0.2);
    g.fillStyle = '#fff'; g.strokeStyle = '#000'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(px, py); g.lineTo(px, py + 30); g.lineTo(px + 8, py + 23); g.lineTo(px + 14, py + 36); g.lineTo(px + 19, py + 34); g.lineTo(px + 13, py + 21); g.lineTo(px + 23, py + 21); g.closePath(); g.fill(); g.stroke();
    this.texture.needsUpdate = true;
  }
}

export const SCREEN_SIZE = { w: SW, h: SH };
