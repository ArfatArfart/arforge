import * as THREE from 'three';

/*
  iPhone 15 Pro Max · real model by polyman on Sketchfab (CC BY 4.0).
  Loaded as glTF, re-encoded with meshopt. The Apple logo patch on the back
  is hidden; the display mesh gets a live canvas so it can run Arfat's real
  websites inside a Safari style browser, or an app you can touch.
*/
export const IPHONE = {
  file: 'models/iphone_15_pro_max.glb',
  screenNode: 'xXDHkMplTIDAXLN',
  logoNode: 'IykfmVvLplTsTEW',
  // materials that keep their own colour when the titanium finish changes
  keep: new Set(['zFdeDaGNRwzccye', 'ujsvqBWRMnqdwPx', 'hUlRcbieVuIiOXG', 'jlzuBkUzuJqgiAK', 'xNrofRCqOXXHVZt', 'pIJKfZsazmcpEiU']),
  H: 0.1595,
};
export const FINISH = {
  black: null,
  natural: '#9a958c',
  desert: '#bda48c',
  white: '#e6e4df',
};

/**
 * Clone the loaded phone, give it its own materials (so each copy can
 * dissolve and take its own finish), hide the logo and mount a screen.
 * Returns a holder scaled so the phone is exactly 1 unit tall, facing +Z.
 */
const COPY = ['name', 'color', 'map', 'normalMap', 'normalScale', 'roughness', 'roughnessMap', 'metalness', 'metalnessMap', 'aoMap', 'aoMapIntensity', 'emissive', 'emissiveMap', 'emissiveIntensity', 'transparent', 'opacity', 'side', 'alphaMap', 'depthWrite', 'alphaTest'];
function toPhysical(m) {
  const p = new THREE.MeshPhysicalMaterial();
  COPY.forEach((k) => { if (m[k] !== undefined && m[k] !== null) p[k] = m[k] && m[k].clone && !m[k].isTexture ? m[k].clone() : m[k]; });
  return p;
}

export function makeIPhone(src, { screenTexture, finish = 'black', envMap, chrome = false } = {}) {
  const root = src.clone(true);
  let screen = null;
  root.traverse((o) => {
    if (!o.isMesh) return;
    if (o.name === IPHONE.logoNode) { o.visible = false; o.userData.skipSample = true; return; }
    o.material = o.material.clone();
    const m = o.material;
    if (envMap) { m.envMap = envMap; m.envMapIntensity = 1.15; }
    if (o.name === IPHONE.screenNode) {
      screen = o;
      o.material = new THREE.MeshStandardMaterial({ color: '#000000', map: screenTexture, emissive: '#ffffff', emissiveMap: screenTexture, emissiveIntensity: 1.0, roughness: 0.06, metalness: 0, envMap, envMapIntensity: 0.6 });
      o.material.name = 'screen';
      return;
    }
    if (chrome && !IPHONE.keep.has(m.name) && !m.transparent) {
      // holographic chrome: thin film interference over polished metal
      const p = toPhysical(m);
      p.color = new THREE.Color('#d9dbe2'); p.metalness = 1; p.roughness = Math.min(p.roughness, 0.22);
      p.iridescence = 1; p.iridescenceIOR = 1.7; p.iridescenceThicknessRange = [180, 760];
      p.clearcoat = 1; p.clearcoatRoughness = 0.06; p.envMap = envMap; p.envMapIntensity = 1.35;
      o.material = p;
      return;
    }
    if (FINISH[finish] && !IPHONE.keep.has(m.name)) m.color = new THREE.Color(FINISH[finish]);
  });
  const box = new THREE.Box3().setFromObject(root);
  const c = box.getCenter(new THREE.Vector3());
  const k = 1 / (box.max.y - box.min.y);
  root.position.copy(c).multiplyScalar(-k);
  root.scale.multiplyScalar(k);
  const face = new THREE.Group();
  face.rotation.y = Math.PI; // the model's screen looks down -Z
  face.add(root);
  const holder = new THREE.Group();
  holder.add(face);
  holder.userData.screen = screen;
  return holder;
}

/* ======================================================================
   Safari, running Arfat's real sites. Full length mobile captures scroll
   with human pacing (flick, glide, settle), then the browser swipes to
   the next tab. Status bar colour follows the page underneath it.
   ====================================================================== */
const SW = 640, SH = 1384, PT = SW / 430;
const SAFE_TOP = Math.round(59 * PT), BAR = Math.round(84 * PT);
function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
const ease = (t) => 1 - Math.pow(1 - t, 3);
const ease2 = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

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

export class SafariScreen {
  constructor(sites) {
    this.canvas = document.createElement('canvas'); this.canvas.width = SW; this.canvas.height = SH;
    this.g = this.canvas.getContext('2d');
    this.sites = sites.map((s) => ({ ...s, img: null, top: '#ffffff', dark: true }));
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = 16;
    this.t = 0; this.boot = 0; this.i = 0; this.scroll = 0; this.from = 0; this.to = 0; this.st = 0; this.phase = 'hold'; this.pt = 0; this.swipe = 0;
    this.sites.forEach((s, k) => {
      const img = new Image(); img.decoding = 'async'; img.src = s.src;
      img.onload = () => {
        s.img = img;
        // sample the top of the page so the status bar matches it
        const c = document.createElement('canvas'); c.width = 16; c.height = 4;
        const x = c.getContext('2d'); x.drawImage(img, 0, 0, img.naturalWidth, 60, 0, 0, 16, 4);
        const d = x.getImageData(0, 0, 16, 4).data; let r = 0, gg = 0, b = 0;
        for (let p = 0; p < d.length; p += 4) { r += d[p]; gg += d[p + 1]; b += d[p + 2]; }
        const n = d.length / 4; r /= n; gg /= n; b /= n;
        s.top = `rgb(${r | 0},${gg | 0},${b | 0})`;
        s.dark = 0.2126 * r + 0.7152 * gg + 0.0722 * b > 140;
        if (k === 0) this.draw(0);
      };
    });
  }
  page(k) { return this.sites[((k % this.sites.length) + this.sites.length) % this.sites.length]; }
  drawPage(s, offX, scroll, scale = 1) {
    const g = this.g;
    g.save();
    g.translate(SW / 2 + offX, SH / 2); g.scale(scale, scale); g.translate(-SW / 2, -SH / 2);
    if (scale < 1) { rr(g, 0, 0, SW, SH, 70); g.clip(); }
    g.fillStyle = s.top; g.fillRect(0, 0, SW, SH);
    if (s.img) {
      const h = (s.img.naturalHeight * SW) / s.img.naturalWidth;
      g.drawImage(s.img, 0, SAFE_TOP - scroll, SW, h);
    }
    // status bar backdrop takes the page's top colour, like Safari
    g.fillStyle = s.top; g.fillRect(0, 0, SW, SAFE_TOP);
    statusBar(g, s.dark);
    // Safari compact bar: frosted, URL pill, home indicator
    const y = SH - BAR;
    g.fillStyle = s.dark ? 'rgba(246,246,248,0.94)' : 'rgba(28,28,30,0.94)'; g.fillRect(0, y, SW, BAR);
    g.fillStyle = s.dark ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.08)'; g.fillRect(0, y, SW, 1.5);
    g.fillStyle = s.dark ? 'rgba(118,118,128,0.14)' : 'rgba(118,118,128,0.3)'; rr(g, 16 * PT, y + 8 * PT, SW - 32 * PT, 36 * PT, 12 * PT); g.fill();
    g.fillStyle = s.dark ? '#1c1c1e' : '#f2f2f7';
    g.font = `500 ${Math.round(15 * PT)}px "Geist Variable", system-ui, sans-serif`; g.textAlign = 'center';
    g.fillText(s.host, SW / 2 + 6 * PT, y + 31 * PT);
    g.textAlign = 'left';
    const lw = g.measureText(s.host).width;
    g.strokeStyle = g.fillStyle; g.lineWidth = 1.6 * PT;
    const lx = SW / 2 - lw / 2 - 12 * PT, ly = y + 22 * PT;
    rr(g, lx - 5 * PT, ly, 10 * PT, 8 * PT, 1.5 * PT); g.fill();
    g.beginPath(); g.arc(lx, ly, 3.3 * PT, Math.PI, 0); g.stroke();
    g.fillStyle = s.dark ? 'rgba(0,0,0,0.85)' : 'rgba(255,255,255,0.85)'; rr(g, SW / 2 - 67 * PT, SH - 9 * PT, 134 * PT, 5 * PT, 2.5 * PT); g.fill();
    g.restore();
  }
  draw(dt) {
    const g = this.g; this.t += dt;
    g.fillStyle = '#000'; g.fillRect(0, 0, SW, SH);
    if (this.boot < 1) {
      g.globalAlpha = Math.sin(Math.min(1, this.boot) * Math.PI);
      g.strokeStyle = '#f5f5f7'; g.lineWidth = 12; g.lineCap = 'round'; g.lineJoin = 'round';
      g.beginPath(); g.moveTo(262, 760); g.lineTo(320, 620); g.lineTo(378, 760); g.stroke();
      g.beginPath(); g.moveTo(288, 712); g.lineTo(372, 712); g.stroke();
      g.globalAlpha = 1; this.texture.needsUpdate = true; return;
    }
    const s = this.page(this.i);
    const viewH = SH - SAFE_TOP - BAR;
    const maxScroll = s.img ? Math.max(0, (s.img.naturalHeight * SW) / s.img.naturalWidth - viewH) : 0;
    this.pt += dt;
    // human pacing: hold, flick down with momentum, settle, repeat; then switch tabs
    if (this.phase === 'hold' && this.pt > 1.5) {
      if (this.scroll >= maxScroll - 4 || this.st >= 3) { this.phase = 'swipe'; this.pt = 0; }
      else { this.phase = 'flick'; this.pt = 0; this.from = this.scroll; this.to = Math.min(maxScroll, this.scroll + 520 + Math.random() * 380); this.st++; }
    }
    if (this.phase === 'flick') {
      const k = Math.min(1, this.pt / 1.3);
      this.scroll = this.from + (this.to - this.from) * ease(k);
      if (k >= 1) { this.phase = 'hold'; this.pt = 0; }
    }
    if (this.phase === 'swipe') {
      const k = Math.min(1, this.pt / 0.95), e = ease2(k);
      const sc = 1 - Math.sin(k * Math.PI) * 0.1;
      this.drawPage(s, -e * SW * 1.06, this.scroll, sc);
      this.drawPage(this.page(this.i + 1), (1 - e) * SW * 1.06, 0, sc);
      if (k >= 1) { this.i++; this.scroll = 0; this.st = 0; this.phase = 'hold'; this.pt = 0; }
    } else this.drawPage(s, 0, this.scroll);
    // Dynamic Island live activity once per site
    const il = this.phase === 'hold' && this.st === 0 && this.pt > 0.2 && this.pt < 1.45 ? Math.min(1, (this.pt - 0.2) / 0.3, (1.45 - this.pt) / 0.3) : 0;
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

/* ======================================================================
   An app you can use on the 3D phone: drag the knob on the glass to ship.
   ====================================================================== */
export class ShipApp {
  constructor() {
    this.canvas = document.createElement('canvas'); this.canvas.width = SW; this.canvas.height = SH;
    this.g = this.canvas.getContext('2d');
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace; this.texture.anisotropy = 16;
    this.accent = '#c6ff3d';
    this.knob = 0; this.drag = false; this.shipped = 0; this.checks = 0;
    this.pts = Array.from({ length: 28 }, (_, i) => 0.5 + Math.sin(i / 2.4) * 0.18);
    this.acc = 0; this.t = 0;
    this.track = { x: 40, y: SH - BAR - 150, w: SW - 80, h: 104 };
  }
  get max() { return this.track.w - this.track.h; }
  hitKnob(px, py) {
    const k = this.track; const kx = k.x + this.knob * this.max;
    return px > kx - 30 && px < kx + k.h + 30 && py > k.y - 30 && py < k.y + k.h + 30;
  }
  setKnob(v) { if (this.shipped) return; this.knob = Math.min(1, Math.max(0, v)); }
  release() {
    if (this.knob > 0.8) { this.knob = 1; this.shipped = 0.0001; this.onShip?.(); }
    this.drag = false;
  }
  draw(dt) {
    const g = this.g; this.t += dt; this.acc += dt;
    if (this.acc > 0.45) { this.acc = 0; this.pts.shift(); this.pts.push(Math.min(0.92, Math.max(0.12, this.pts[this.pts.length - 1] + (Math.random() - 0.44) * 0.18))); }
    if (!this.drag && !this.shipped && this.knob > 0) this.knob = Math.max(0, this.knob - dt * 3.2);
    if (this.shipped) { this.shipped += dt; if (this.shipped > 3.2) { this.shipped = 0; this.knob = 0; } }
    this.checks = Math.min(4, this.checks + dt * 1.4);
    const A = this.accent;
    g.fillStyle = '#0b0c09'; g.fillRect(0, 0, SW, SH);
    const bg = g.createRadialGradient(SW * 0.85, 60, 10, SW * 0.85, 60, 760); bg.addColorStop(0, 'rgba(198,255,61,0.18)'); bg.addColorStop(1, 'rgba(198,255,61,0)');
    g.fillStyle = bg; g.fillRect(0, 0, SW, SH);
    statusBar(g, false);
    const L = 40;
    g.fillStyle = A; g.font = '600 24px "Geist Mono Variable", monospace'; g.fillText('RELEASE 1.0.0', L, 170);
    g.fillStyle = '#f4f7ec'; g.font = '600 62px "Geist Variable", sans-serif';
    g.fillText(this.shipped ? 'Shipped.' : 'Ready for', L, 246);
    if (!this.shipped) g.fillText('launch', L, 314);
    g.fillStyle = 'rgba(255,255,255,0.05)'; rr(g, L, 360, SW - 2 * L, 260, 36); g.fill();
    g.fillStyle = 'rgba(244,247,236,0.6)'; g.font = '500 24px "Geist Variable", sans-serif'; g.fillText('Active users · live', L + 32, 410);
    g.beginPath();
    this.pts.forEach((v, i) => { const x = L + 32 + (i / (this.pts.length - 1)) * (SW - 2 * L - 64), y = 590 - v * 150; i ? g.lineTo(x, y) : g.moveTo(x, y); });
    g.strokeStyle = A; g.lineWidth = 5; g.lineJoin = 'round'; g.shadowColor = A; g.shadowBlur = 18; g.stroke(); g.shadowBlur = 0;
    ['Offline sync', 'Push notifications', 'Payments', 'Crash reporting'].forEach((t, i) => {
      const y = 680 + i * 80, on = this.checks > i + 0.4;
      g.fillStyle = on ? A : 'rgba(255,255,255,0.08)'; rr(g, L, y, 46, 46, 13); g.fill();
      if (on) { g.strokeStyle = '#0b0c09'; g.lineWidth = 6; g.beginPath(); g.moveTo(L + 12, y + 24); g.lineTo(L + 20, y + 32); g.lineTo(L + 34, y + 15); g.stroke(); }
      g.fillStyle = '#dfe3d6'; g.font = '500 30px "Geist Variable", sans-serif'; g.fillText(t, L + 70, y + 33);
    });
    const k = this.track, kx = k.x + this.knob * this.max;
    g.fillStyle = 'rgba(255,255,255,0.08)'; rr(g, k.x, k.y, k.w, k.h, k.h / 2); g.fill();
    g.fillStyle = A; rr(g, k.x, k.y, kx - k.x + k.h, k.h, k.h / 2); g.fill();
    g.globalAlpha = 1 - this.knob; g.fillStyle = '#a4a99a'; g.font = '600 30px "Geist Variable", sans-serif'; g.textAlign = 'center';
    g.fillText('Slide to ship', SW / 2 + 30, k.y + k.h / 2 + 11); g.textAlign = 'left'; g.globalAlpha = 1;
    g.fillStyle = '#f4f7ec'; g.beginPath(); g.arc(kx + k.h / 2, k.y + k.h / 2, k.h / 2 - 8, 0, 7); g.fill();
    g.strokeStyle = '#0b0c09'; g.lineWidth = 6; g.lineCap = 'round';
    g.beginPath(); g.moveTo(kx + k.h / 2 - 16, k.y + k.h / 2); g.lineTo(kx + k.h / 2 + 14, k.y + k.h / 2); g.moveTo(kx + k.h / 2 + 2, k.y + k.h / 2 - 13); g.lineTo(kx + k.h / 2 + 15, k.y + k.h / 2); g.lineTo(kx + k.h / 2 + 2, k.y + k.h / 2 + 13); g.stroke();
    if (this.shipped) {
      g.globalAlpha = Math.min(1, this.shipped * 3); g.fillStyle = A; g.font = '600 28px "Geist Variable", sans-serif'; g.textAlign = 'center';
      g.fillText('Build 1.0.0 shipped to testers.', SW / 2, k.y - 40); g.textAlign = 'left'; g.globalAlpha = 1;
    }
    g.fillStyle = 'rgba(255,255,255,0.85)'; rr(g, SW / 2 - 67 * PT, SH - 9 * PT, 134 * PT, 5 * PT, 2.5 * PT); g.fill();
    this.texture.needsUpdate = true;
  }
}

export const SCREEN_SIZE = { w: SW, h: SH };
