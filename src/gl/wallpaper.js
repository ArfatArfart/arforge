import * as THREE from 'three';

/*
  Still screens for the Apps devices. The MacBook shows a desktop and the
  iPhone a lock screen, both on one studio wallpaper: flowing bands of the
  site's colours on deep ink, with the name in the middle. Painted once;
  only the clock repaints, once a minute. Nothing scrolls, nothing streams.
*/
const BANDS = [
  ['#3d6bff', '#1b2a8c'], ['#ff3d8b', '#7a1f6b'], ['#ff8a3d', '#c2410c'], ['#fdea2c', '#f59e0b'], ['#ffffff', '#c7d2fe'],
];

function wallpaper(g, W, H, portrait) {
  const bg = g.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#0a0f2e'); bg.addColorStop(0.55, '#121a4a'); bg.addColorStop(1, '#05060f');
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  // flowing bands, each a thick curved ribbon lit along its length
  BANDS.forEach(([a, b], i) => {
    const k = i / (BANDS.length - 1);
    const y0 = H * (portrait ? 0.3 + k * 0.42 : 0.2 + k * 0.58);
    const amp = H * (portrait ? 0.12 : 0.16), th = H * (portrait ? 0.07 : 0.1) * (1 - k * 0.45);
    const grad = g.createLinearGradient(0, y0 - amp, W, y0 + amp);
    grad.addColorStop(0, b); grad.addColorStop(0.5, a); grad.addColorStop(1, b);
    g.save();
    g.globalAlpha = 0.9 - k * 0.15;
    g.beginPath();
    g.moveTo(-W * 0.1, y0 + amp * 0.6);
    g.bezierCurveTo(W * 0.25, y0 - amp * 1.4, W * 0.6, y0 + amp * 1.3, W * 1.1, y0 - amp * 0.7);
    g.lineTo(W * 1.1, y0 - amp * 0.7 + th);
    g.bezierCurveTo(W * 0.6, y0 + amp * 1.3 + th, W * 0.25, y0 - amp * 1.4 + th * 1.4, -W * 0.1, y0 + amp * 0.6 + th);
    g.closePath();
    g.shadowColor = a; g.shadowBlur = H * 0.05;
    g.fillStyle = grad; g.fill();
    g.restore();
  });
  // a soft light from the top, and the faintest grain so the gradients never band
  const glow = g.createRadialGradient(W * 0.5, -H * 0.1, 0, W * 0.5, -H * 0.1, H * 0.9);
  glow.addColorStop(0, 'rgba(255,255,255,0.14)'); glow.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = glow; g.fillRect(0, 0, W, H);
  const img = g.getImageData(0, 0, W, H), d = img.data;
  for (let i = 0; i < d.length; i += 4) { const n = (Math.random() - 0.5) * 6; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
  g.putImageData(img, 0, 0);
}

function wordmark(g, x, y, size, align = 'center') {
  g.save();
  g.textAlign = align; g.textBaseline = 'alphabetic';
  g.shadowColor = 'rgba(0,0,0,0.45)'; g.shadowBlur = size * 0.2; g.shadowOffsetY = size * 0.04;
  g.fillStyle = '#ffffff';
  g.font = `400 ${size}px "Yellowtail", cursive`;
  g.fillText('Arfat', x, y);
  g.font = `600 ${size * 0.2}px "Geist Variable", system-ui, sans-serif`;
  if ('letterSpacing' in g) g.letterSpacing = `${size * 0.06}px`;
  g.globalAlpha = 0.85;
  g.fillText('STUDIO', x, y + size * 0.42);
  g.restore();
}

const clockText = (t) => `${t.getHours() % 12 || 12}:${String(t.getMinutes()).padStart(2, '0')}`;
const dateText = (t) => t.toLocaleDateString('en', { weekday: 'long', day: 'numeric', month: 'long' });

class Paper {
  constructor(W, H, flipY) {
    this.W = W; this.H = H;
    this.canvas = document.createElement('canvas'); this.canvas.width = W; this.canvas.height = H;
    this.g = this.canvas.getContext('2d', { willReadFrequently: true });
    this.base = document.createElement('canvas'); this.base.width = W; this.base.height = H;
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace; this.texture.anisotropy = 8; this.texture.flipY = flipY;
    this.minute = -1;
  }
  /** call every frame; only does work when the minute changes */
  tick() {
    const now = new Date(), m = now.getHours() * 60 + now.getMinutes();
    if (m === this.minute) return;
    this.minute = m;
    if (!this.painted) { this.paintBase(); this.painted = true; }
    this.g.drawImage(this.base, 0, 0);
    this.paintClock(now);
    this.texture.needsUpdate = true;
  }
}

/** the MacBook desktop: menu bar, wallpaper, the name, a dock */
export class DeskPaper extends Paper {
  constructor() { super(1600, 1036, false); this.tick(); }
  paintBase() {
    const g = this.base.getContext('2d', { willReadFrequently: true }), { W, H } = this;
    wallpaper(g, W, H, false);
    wordmark(g, W / 2, H * 0.5, 230);
    // dock
    const n = 8, s = 64, gap = 18, dw = n * s + (n + 1) * gap, dx = (W - dw) / 2, dy = H - s - 2 * gap - 14;
    g.fillStyle = 'rgba(255,255,255,0.16)'; g.strokeStyle = 'rgba(255,255,255,0.28)'; g.lineWidth = 1.5;
    g.beginPath(); g.roundRect(dx, dy, dw, s + 2 * gap, 28); g.fill(); g.stroke();
    const icons = [['#3d6bff', '#22d3ee'], ['#ff3d8b', '#ff8a3d'], ['#fdea2c', '#f59e0b'], ['#10b981', '#065f46'], ['#8b5cf6', '#4f46e5'], ['#f4f4f5', '#a1a1aa'], ['#ef4444', '#7f1d1d'], ['#0ea5e9', '#1e3a8a']];
    icons.forEach(([a, b], i) => {
      const x = dx + gap + i * (s + gap), y = dy + gap;
      const gr = g.createLinearGradient(x, y, x + s, y + s); gr.addColorStop(0, a); gr.addColorStop(1, b);
      g.fillStyle = gr; g.beginPath(); g.roundRect(x, y, s, s, 15); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.85)'; g.beginPath(); g.arc(x + s / 2, y + s / 2, s * 0.16, 0, Math.PI * 2); g.fill();
    });
  }
  paintClock(now) {
    const g = this.g, { W } = this;
    g.fillStyle = 'rgba(8,10,28,0.42)'; g.fillRect(0, 0, W, 40);
    g.fillStyle = '#fff'; g.textBaseline = 'middle';
    g.font = '700 21px "Geist Variable", system-ui, sans-serif'; g.textAlign = 'left';
    g.fillText('Arfat Studio', 28, 20);
    g.font = '500 20px "Geist Variable", system-ui, sans-serif';
    ['File', 'Edit', 'View', 'Window', 'Help'].forEach((w, i) => g.fillText(w, 180 + i * 78, 20));
    g.textAlign = 'right';
    g.fillText(`${now.toLocaleDateString('en', { weekday: 'short' })} ${clockText(now)}`, W - 28, 20);
  }
}

/** the iPhone lock screen: the time, the date, the name */
export class LockPaper extends Paper {
  constructor() { super(640, 1384, true); this.tick(); }
  paintBase() {
    const g = this.base.getContext('2d', { willReadFrequently: true }), { W, H } = this;
    wallpaper(g, W, H, true);
    wordmark(g, W / 2, H * 0.62, 150);
    // flashlight and camera, and the home bar
    g.fillStyle = 'rgba(255,255,255,0.18)';
    [[96, H - 150], [W - 96, H - 150]].forEach(([x, y]) => { g.beginPath(); g.arc(x, y, 44, 0, Math.PI * 2); g.fill(); });
    g.fillStyle = 'rgba(255,255,255,0.9)'; g.beginPath(); g.roundRect(W / 2 - 120, H - 34, 240, 10, 5); g.fill();
  }
  paintClock(now) {
    const g = this.g, { W, H } = this;
    g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
    g.font = '500 30px "Geist Variable", system-ui, sans-serif';
    g.fillText(dateText(now), W / 2, H * 0.17);
    g.font = '700 190px "Geist Variable", system-ui, sans-serif';
    g.fillText(clockText(now), W / 2, H * 0.31);
  }
}
