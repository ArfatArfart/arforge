import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

/*
  A flagship class phone, engineered in code to real proportions
  (147.6 × 71.6 × 8.25 mm, 1 unit = 10 cm). No free licensed scan of a
  modern phone exists, so every part is built here with physically based
  materials: anisotropic titanium frame, frosted glass back with a gloss
  etched mark, ceramic front glass, iridescent lens coatings, antenna
  bands, buttons, port and speaker holes. Nothing is a picture.
*/
export const PHONE = { W: 0.716, H: 1.476, D: 0.0825, R: 0.112 };

export function rrShape(w, h, r, k = 0.64) {
  const s = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.bezierCurveTo(x + w - r + r * k, y, x + w, y + r - r * k, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.bezierCurveTo(x + w, y + h - r + r * k, x + w - r + r * k, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.bezierCurveTo(x + r - r * k, y + h, x, y + h - r + r * k, x, y + h - r);
  s.lineTo(x, y + r);
  s.bezierCurveTo(x, y + r - r * k, x + r - r * k, y, x + r, y);
  return s;
}

function flatUV(geo, w, h) {
  const p = geo.attributes.position, uv = geo.attributes.uv;
  for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / w + 0.5, p.getY(i) / h + 0.5);
  uv.needsUpdate = true;
  return geo;
}

/* matte glass micro texture + the brand mark etched in gloss (roughness map) */
function backRoughness() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 1024;
  const g = c.getContext('2d');
  const img = g.createImageData(512, 1024);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 112 + (Math.random() - 0.5) * 26;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  // mark drawn mirrored: the back face is seen from behind
  g.save(); g.translate(256, 512); g.scale(-1, 1);
  g.strokeStyle = 'rgb(18,18,18)'; g.lineWidth = 9; g.lineCap = 'round'; g.lineJoin = 'round';
  g.beginPath(); g.moveTo(-46, 52); g.lineTo(0, -54); g.lineTo(46, 52); g.stroke();
  g.beginPath(); g.moveTo(-26, 18); g.lineTo(44, 18); g.stroke();
  g.fillStyle = 'rgb(18,18,18)'; g.beginPath(); g.arc(58, 18, 7, 0, 7); g.fill();
  g.restore();
  const t = new THREE.CanvasTexture(c);
  t.anisotropy = 8;
  return t;
}

function frameNormal() {
  // fine brushing for the titanium band
  const c = document.createElement('canvas'); c.width = 8; c.height = 512;
  const g = c.getContext('2d');
  for (let y = 0; y < 512; y++) { const v = 128 + (Math.random() - 0.5) * 18; g.fillStyle = `rgb(128,${v},255)`; g.fillRect(0, y, 8, 1); }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1, 6);
  t.colorSpace = THREE.NoColorSpace;
  return t;
}

export function buildPhone({ envMap, screenTexture, finish = 'black' } = {}) {
  const { W, H, D, R } = PHONE;
  const g = new THREE.Group();
  g.name = 'phone';
  const titaniumColor = finish === 'natural' ? '#a39d93' : '#43423f';
  const mats = {
    titanium: new THREE.MeshPhysicalMaterial({ color: titaniumColor, metalness: 1, roughness: 0.32, anisotropy: 0.7, anisotropyRotation: Math.PI / 2, clearcoat: 0.25, clearcoatRoughness: 0.3, normalMap: frameNormal(), normalScale: new THREE.Vector2(0.15, 0.15), envMap, envMapIntensity: 1.15 }),
    polished: new THREE.MeshPhysicalMaterial({ color: titaniumColor, metalness: 1, roughness: 0.12, envMap, envMapIntensity: 1.3 }),
    frontGlass: new THREE.MeshPhysicalMaterial({ color: '#020203', metalness: 0, roughness: 0.03, clearcoat: 1, clearcoatRoughness: 0.02, ior: 1.52, specularIntensity: 1, envMap, envMapIntensity: 1.1 }),
    screen: new THREE.MeshPhysicalMaterial({ color: '#000000', emissive: '#ffffff', emissiveMap: screenTexture, map: screenTexture, emissiveIntensity: 0.94, roughness: 0.04, clearcoat: 1, clearcoatRoughness: 0.03, envMap, envMapIntensity: 0.55 }),
    island: new THREE.MeshPhysicalMaterial({ color: '#000000', roughness: 0.25, clearcoat: 0.6, envMap }),
    back: new THREE.MeshPhysicalMaterial({ color: finish === 'natural' ? '#b9b2a7' : '#27282b', metalness: 0, roughness: 1, roughnessMap: backRoughness(), clearcoat: 1, clearcoatRoughness: 0.5, sheen: 0.4, sheenRoughness: 0.6, sheenColor: '#6b6b70', envMap, envMapIntensity: 1 }),
    plateau: new THREE.MeshPhysicalMaterial({ color: finish === 'natural' ? '#c2bbb0' : '#2c2d30', roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.08, envMap, envMapIntensity: 1.1 }),
    lensGlass: new THREE.MeshPhysicalMaterial({ color: '#04060a', roughness: 0.02, clearcoat: 1, clearcoatRoughness: 0.01, iridescence: 1, iridescenceIOR: 1.38, iridescenceThicknessRange: [260, 620], envMap, envMapIntensity: 1.4 }),
    lensInner: new THREE.MeshPhysicalMaterial({ color: '#0b0d12', metalness: 0.6, roughness: 0.25, envMap }),
    flash: new THREE.MeshPhysicalMaterial({ color: '#efe6d2', roughness: 0.35, transmission: 0.25, thickness: 0.01, envMap }),
    black: new THREE.MeshPhysicalMaterial({ color: '#060606', roughness: 0.5, envMap }),
    band: new THREE.MeshPhysicalMaterial({ color: '#2a2b2d', roughness: 0.55, envMap }),
  };

  // titanium frame: rounded slab with real bevels
  const b = 0.009;
  const frameGeo = new THREE.ExtrudeGeometry(rrShape(W - 2 * b, H - 2 * b, R - b), { depth: D - 2 * b, bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: 8, curveSegments: 72 });
  frameGeo.translate(0, 0, -(D - 2 * b) / 2);
  const frame = new THREE.Mesh(frameGeo, mats.titanium);
  g.add(frame);

  // front ceramic glass
  const glassGeo = flatUV(new THREE.ShapeGeometry(rrShape(W - 0.014, H - 0.014, R - 0.007), 72), W, H);
  const glass = new THREE.Mesh(glassGeo, mats.frontGlass);
  glass.position.z = D / 2 + 0.0007;
  g.add(glass);

  // the display
  const sw = W - 0.042, sh = H - 0.042;
  const screenGeo = flatUV(new THREE.ShapeGeometry(rrShape(sw, sh, R - 0.024), 72), sw, sh);
  const screen = new THREE.Mesh(screenGeo, mats.screen);
  screen.position.z = D / 2 + 0.0013;
  screen.name = 'screen';
  g.add(screen);

  // dynamic island
  const isl = new THREE.Mesh(new THREE.ShapeGeometry(rrShape(0.172, 0.05, 0.025, 0.552), 32), mats.island);
  isl.position.set(0, sh / 2 - 0.058, D / 2 + 0.0019);
  isl.userData.skipSample = true;
  g.add(isl);

  // back glass with etched mark
  const backGeo = flatUV(new THREE.ShapeGeometry(rrShape(W - 0.014, H - 0.014, R - 0.007), 72), W, H);
  const back = new THREE.Mesh(backGeo, mats.back);
  back.rotation.y = Math.PI;
  back.position.z = -D / 2 - 0.0007;
  g.add(back);

  // camera plateau, top left when seen from behind
  const backG = new THREE.Group();
  backG.rotation.y = Math.PI;
  backG.position.z = -D / 2 - 0.0007;
  g.add(backG);
  const pc = new THREE.Vector2(-(W / 2 - 0.032 - 0.168), H / 2 - 0.032 - 0.168);
  const platGeo = new THREE.ExtrudeGeometry(rrShape(0.336, 0.336, 0.09), { depth: 0.006, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.004, bevelSegments: 5, curveSegments: 48 });
  const plat = new THREE.Mesh(platGeo, mats.plateau);
  plat.position.set(pc.x, pc.y, 0.0015);
  backG.add(plat);
  const top = 0.0015 + 0.006 + 0.003;
  const lens = (x, y) => {
    const L = new THREE.Group();
    L.position.set(pc.x + x, pc.y + y, top);
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.064, 0.018, 72), mats.polished);
    ring.rotation.x = Math.PI / 2; ring.position.z = 0.009;
    const glassL = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.052, 0.003, 72), mats.lensGlass);
    glassL.rotation.x = Math.PI / 2; glassL.position.z = 0.0185;
    const inner = new THREE.Mesh(new THREE.TorusGeometry(0.032, 0.0045, 16, 64), mats.lensInner);
    inner.position.z = 0.0172;
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.022, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2), mats.lensGlass);
    cap.rotation.x = Math.PI / 2; cap.position.z = 0.013; cap.scale.set(1, 0.35, 1);
    L.add(ring, glassL, inner, cap);
    backG.add(L);
  };
  lens(-0.074, 0.074); lens(-0.074, -0.074); lens(0.082, 0.0);
  const flash = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.004, 40), mats.flash);
  flash.rotation.x = Math.PI / 2; flash.position.set(pc.x + 0.09, pc.y + 0.11, top + 0.002);
  const lidar = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.017, 0.004, 40), mats.lensGlass);
  lidar.rotation.x = Math.PI / 2; lidar.position.set(pc.x + 0.09, pc.y - 0.11, top + 0.002);
  const mic = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.003, 16), mats.black);
  mic.rotation.x = Math.PI / 2; mic.position.set(pc.x + 0.13, pc.y + 0.02, top + 0.0015);
  backG.add(flash, lidar, mic);

  // buttons on the frame
  const btn = (h, x, y) => {
    const m = new THREE.Mesh(new RoundedBoxGeometry(0.012, h, 0.032, 4, 0.005), mats.polished);
    m.position.set(x, y, 0); g.add(m);
  };
  btn(0.2, W / 2 + 0.0035, 0.21);
  btn(0.066, -W / 2 - 0.0035, 0.44);
  btn(0.12, -W / 2 - 0.0035, 0.27);
  btn(0.12, -W / 2 - 0.0035, 0.1);

  // antenna bands
  const band = (w, h, x, y) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, D * 0.82), mats.band); m.position.set(x, y, 0); m.userData.skipSample = true; g.add(m); };
  [1, -1].forEach((s) => { band(0.012, 0.005, s * (W / 2 - 0.0015), H / 2 - 0.17); band(0.012, 0.005, s * (W / 2 - 0.0015), -H / 2 + 0.17); });
  band(0.005, 0.012, 0.21, H / 2 - 0.0015); band(0.005, 0.012, -0.21, -H / 2 + 0.0015);

  // port and speaker grille on the bottom edge
  const port = new THREE.Mesh(new RoundedBoxGeometry(0.094, 0.006, 0.03, 3, 0.0028), mats.black);
  port.position.set(0, -H / 2 - 0.0006, 0); port.userData.skipSample = true; g.add(port);
  for (let i = 0; i < 6; i++) {
    [1, -1].forEach((s) => {
      const hole = new THREE.Mesh(new THREE.CylinderGeometry(0.0042, 0.0042, 0.004, 16), mats.black);
      hole.position.set(s * (0.1 + i * 0.019), -H / 2 - 0.0004, 0); hole.userData.skipSample = true; g.add(hole);
    });
  }
  return { group: g, screen, mats };
}

/* ======================================================================
   Screen content 1 · Showcase: Arfat's real projects, flicking past like
   apps, with a live status bar and a Dynamic Island notification.
   ====================================================================== */
const SW = 640, SH = 1360;
function statusBar(g, color = '#fff') {
  const t = new Date();
  g.fillStyle = color;
  g.font = '600 30px "Geist Variable", system-ui, sans-serif';
  g.fillText(`${t.getHours()}:${String(t.getMinutes()).padStart(2, '0')}`, 64, 62);
  for (let i = 0; i < 4; i++) g.fillRect(452 + i * 11, 58 - (i + 1) * 6, 7, (i + 1) * 6);
  g.beginPath(); g.arc(518, 58, 16, Math.PI * 1.25, Math.PI * 1.75); g.lineWidth = 5; g.strokeStyle = color; g.stroke();
  g.beginPath(); g.arc(518, 58, 7, Math.PI * 1.25, Math.PI * 1.75); g.stroke();
  g.strokeStyle = color; g.lineWidth = 2.5; g.globalAlpha = 0.6; roundRect(g, 544, 40, 48, 24, 7); g.stroke(); g.globalAlpha = 1;
  g.fillStyle = color; roundRect(g, 548, 44, 36, 16, 4); g.fill();
}
function roundRect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export class ShowcaseScreen {
  constructor(images, names) {
    this.canvas = document.createElement('canvas'); this.canvas.width = SW; this.canvas.height = SH;
    this.g = this.canvas.getContext('2d');
    this.images = images; this.names = names;
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace; this.texture.anisotropy = 8;
    this.t = 0; this.boot = 0;
  }
  draw(dt) {
    const g = this.g; this.t += dt;
    g.fillStyle = '#000'; g.fillRect(0, 0, SW, SH);
    if (this.boot < 1) {
      g.globalAlpha = Math.sin(Math.min(1, this.boot) * Math.PI);
      g.strokeStyle = '#fff'; g.lineWidth = 10; g.lineCap = 'round'; g.lineJoin = 'round';
      g.beginPath(); g.moveTo(270, 740); g.lineTo(320, 620); g.lineTo(370, 740); g.stroke();
      g.beginPath(); g.moveTo(292, 700); g.lineTo(366, 700); g.stroke();
      g.fillStyle = '#ff5a1f'; g.beginPath(); g.arc(384, 700, 8, 0, 7); g.fill();
      g.globalAlpha = 1; this.texture.needsUpdate = true; return;
    }
    const ready = this.images.filter((i) => i && i.complete && i.naturalWidth);
    if (!ready.length) { this.texture.needsUpdate = true; return; }
    const hold = 3.6, swipe = 0.9, cyc = hold + swipe;
    const n = this.images.length;
    const k = Math.floor(this.t / cyc), lt = this.t % cyc;
    const cur = k % n, nxt = (k + 1) % n;
    const p = lt > hold ? ease((lt - hold) / swipe) : 0;
    const drawApp = (idx, off, scale) => {
      const img = this.images[idx];
      if (!img || !img.complete || !img.naturalWidth) return;
      const s = Math.max(SW / img.naturalWidth, SH / img.naturalHeight) * scale;
      const w = img.naturalWidth * s, h = img.naturalHeight * s;
      g.save();
      g.translate(off, 0);
      if (scale < 1) { roundRect(g, (SW - w) / 2, (SH - h) / 2, w, h, 60 * scale); g.clip(); }
      g.drawImage(img, (SW - w) / 2, (SH - h) / 2 + (scale >= 1 ? -Math.min(30, lt * 6) : 0), w, h);
      g.restore();
    };
    // a gentle app switcher: the current app shrinks, the next slides in
    const sc = 1 - Math.sin(p * Math.PI) * 0.12;
    drawApp(cur, -p * SW * 1.04, sc);
    if (p > 0) drawApp(nxt, (1 - p) * SW * 1.04, sc);
    // status bar scrim for legibility
    const grd = g.createLinearGradient(0, 0, 0, 120); grd.addColorStop(0, 'rgba(0,0,0,0.45)'); grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd; g.fillRect(0, 0, SW, 120);
    statusBar(g);
    // dynamic island notification on every other app
    const il = lt > 0.6 && lt < 2.6 && k % 2 === 0 ? Math.min(1, (lt - 0.6) / 0.35, (2.6 - lt) / 0.35) : 0;
    if (il > 0) {
      const e = ease(Math.max(0, il));
      const w = 186 + e * 380, h = 56 + e * 52;
      g.fillStyle = '#000'; roundRect(g, (SW - w) / 2, 22 + 8 - e * 4, w, h, h / 2); g.fill();
      if (e > 0.6) {
        g.globalAlpha = (e - 0.6) / 0.4;
        g.fillStyle = '#3dff8b'; g.beginPath(); g.arc((SW - w) / 2 + 52, 30 + h / 2 - e * 4, 10, 0, 7); g.fill();
        g.fillStyle = '#fff'; g.font = '600 26px "Geist Variable", sans-serif';
        g.fillText('Live on GitHub Pages', (SW - w) / 2 + 80, 30 + h / 2 - 2 - e * 4);
        g.fillStyle = 'rgba(255,255,255,0.6)'; g.font = '500 20px "Geist Mono Variable", monospace';
        g.fillText(this.names[cur], (SW - w) / 2 + 80, 30 + h / 2 + 24 - e * 4);
        g.globalAlpha = 1;
      }
    }
    // home indicator
    g.fillStyle = 'rgba(255,255,255,0.85)'; roundRect(g, SW / 2 - 90, SH - 30, 180, 9, 5); g.fill();
    this.texture.needsUpdate = true;
  }
}

/* ======================================================================
   Screen content 2 · An app you can actually use on the 3D phone:
   drag the knob across the real screen to ship a release.
   ====================================================================== */
export class ShipApp {
  constructor() {
    this.canvas = document.createElement('canvas'); this.canvas.width = SW; this.canvas.height = SH;
    this.g = this.canvas.getContext('2d');
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace; this.texture.anisotropy = 8;
    this.accent = '#c6ff3d';
    this.knob = 0; this.drag = false; this.shipped = 0; this.checks = 0;
    this.pts = Array.from({ length: 28 }, (_, i) => 0.5 + Math.sin(i / 2.4) * 0.18);
    this.acc = 0; this.t = 0;
    this.track = { x: 48, y: SH - 230, w: SW - 96, h: 112 };
  }
  get max() { return this.track.w - this.track.h; }
  hitKnob(px, py) {
    const k = this.track; const kx = k.x + this.knob * this.max;
    return px > kx - 20 && px < kx + k.h + 20 && py > k.y - 20 && py < k.y + k.h + 20;
  }
  setKnob(v) { if (this.shipped) return; this.knob = Math.min(1, Math.max(0, v)); }
  release() {
    if (this.knob > 0.86) { this.knob = 1; this.shipped = 0.0001; this.onShip?.(); }
    this.drag = false;
  }
  draw(dt) {
    const g = this.g; this.t += dt; this.acc += dt;
    if (this.acc > 0.5) { this.acc = 0; this.pts.shift(); this.pts.push(Math.min(0.92, Math.max(0.12, this.pts[this.pts.length - 1] + (Math.random() - 0.44) * 0.18))); }
    if (!this.drag && !this.shipped && this.knob > 0) this.knob = Math.max(0, this.knob - dt * 3.2);
    if (this.shipped) { this.shipped += dt; if (this.shipped > 3) { this.shipped = 0; this.knob = 0; } }
    this.checks = Math.min(4, this.checks + dt * 1.4);
    const A = this.accent;
    g.fillStyle = '#0b0c09'; g.fillRect(0, 0, SW, SH);
    const bg = g.createRadialGradient(SW * 0.8, 80, 10, SW * 0.8, 80, 700); bg.addColorStop(0, 'rgba(198,255,61,0.16)'); bg.addColorStop(1, 'rgba(198,255,61,0)');
    g.fillStyle = bg; g.fillRect(0, 0, SW, SH);
    statusBar(g);
    g.fillStyle = A; g.font = '600 26px "Geist Mono Variable", monospace'; g.fillText('RELEASE 1.0.0', 48, 190);
    g.fillStyle = '#f4f7ec'; g.font = '600 64px "Geist Variable", sans-serif'; g.fillText(this.shipped ? 'Shipped.' : 'Ready for', 48, 268);
    if (!this.shipped) g.fillText('launch', 48, 338);
    // chart card
    g.fillStyle = 'rgba(255,255,255,0.05)'; roundRect(g, 48, 380, SW - 96, 250, 36); g.fill();
    g.fillStyle = 'rgba(244,247,236,0.6)'; g.font = '500 24px "Geist Variable", sans-serif'; g.fillText('Active users · live', 80, 430);
    g.beginPath();
    this.pts.forEach((v, i) => { const x = 80 + (i / (this.pts.length - 1)) * (SW - 160), y = 600 - v * 140; i ? g.lineTo(x, y) : g.moveTo(x, y); });
    g.strokeStyle = A; g.lineWidth = 5; g.lineJoin = 'round'; g.shadowColor = A; g.shadowBlur = 18; g.stroke(); g.shadowBlur = 0;
    // checklist
    ['Offline sync', 'Push notifications', 'Payments', 'Crash reporting'].forEach((t, i) => {
      const y = 700 + i * 78, on = this.checks > i + 0.4;
      g.fillStyle = on ? A : 'rgba(255,255,255,0.08)'; roundRect(g, 48, y, 44, 44, 13); g.fill();
      if (on) { g.strokeStyle = '#0b0c09'; g.lineWidth = 6; g.beginPath(); g.moveTo(60, y + 23); g.lineTo(68, y + 31); g.lineTo(82, y + 14); g.stroke(); }
      g.fillStyle = '#dfe3d6'; g.font = '500 30px "Geist Variable", sans-serif'; g.fillText(t, 116, y + 32);
    });
    // slider
    const k = this.track, kx = k.x + this.knob * this.max;
    g.fillStyle = 'rgba(255,255,255,0.08)'; roundRect(g, k.x, k.y, k.w, k.h, k.h / 2); g.fill();
    g.save(); roundRect(g, k.x, k.y, k.w, k.h, k.h / 2); g.clip();
    g.fillStyle = A; g.fillRect(k.x, k.y, kx - k.x + k.h, k.h); g.restore();
    g.globalAlpha = 1 - this.knob; g.fillStyle = '#a4a99a'; g.font = '600 30px "Geist Variable", sans-serif'; g.textAlign = 'center';
    g.fillText('Slide to ship', SW / 2 + 30, k.y + k.h / 2 + 11); g.textAlign = 'left'; g.globalAlpha = 1;
    g.fillStyle = '#f4f7ec'; g.beginPath(); g.arc(kx + k.h / 2, k.y + k.h / 2, k.h / 2 - 8, 0, 7); g.fill();
    g.strokeStyle = '#0b0c09'; g.lineWidth = 6; g.lineCap = 'round';
    g.beginPath(); g.moveTo(kx + k.h / 2 - 16, k.y + k.h / 2); g.lineTo(kx + k.h / 2 + 14, k.y + k.h / 2); g.moveTo(kx + k.h / 2 + 2, k.y + k.h / 2 - 13); g.lineTo(kx + k.h / 2 + 15, k.y + k.h / 2); g.lineTo(kx + k.h / 2 + 2, k.y + k.h / 2 + 13); g.stroke();
    if (this.shipped) {
      const a = Math.min(1, this.shipped * 3);
      g.globalAlpha = a; g.fillStyle = A; g.font = '600 28px "Geist Variable", sans-serif'; g.textAlign = 'center';
      g.fillText('Build 1.0.0 shipped to testers.', SW / 2, k.y - 40); g.textAlign = 'left'; g.globalAlpha = 1;
    }
    g.fillStyle = 'rgba(255,255,255,0.85)'; roundRect(g, SW / 2 - 90, SH - 30, 180, 9, 5); g.fill();
    this.texture.needsUpdate = true;
  }
}

export const SCREEN_SIZE = { w: SW, h: SH };
