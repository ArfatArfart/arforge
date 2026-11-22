/*
  The intro. One spark waits while the real bytes load. Then it splits into
  a cross, the cross becomes a field of iridescent points, and a diagonal
  wave melts the field into molten orange, the colour of the hero beneath.
  Logic: a single spark becomes a pattern, the pattern becomes metal.
*/
const ease = (t) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);
const easeIO = (t) => { t = Math.min(1, Math.max(0, t)); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };

export class Intro {
  constructor(root, color = '#ff5c1b') {
    this.root = root;
    this.color = color;
    this.c = document.createElement('canvas');
    this.c.className = 'intro-canvas';
    root.prepend(this.c);
    this.g = this.c.getContext('2d');
    this.p = 0; this.shown = 0; this.t0 = performance.now(); this.playing = null;
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
  }
  resize() {
    const d = Math.min(window.devicePixelRatio || 1, 2);
    this.w = window.innerWidth; this.h = window.innerHeight; this.d = d;
    this.c.width = this.w * d; this.c.height = this.h * d;
    const gap = this.w < 760 ? 22 : 26;
    this.dots = [];
    const cx = this.w / 2, cy = this.h / 2;
    for (let y = gap / 2; y < this.h + gap; y += gap) {
      for (let x = gap / 2 + ((Math.round(y / gap) % 2) * gap) / 2; x < this.w + gap; x += gap) {
        const dx = x - cx, dy = y - cy;
        this.dots.push({ x, y, dist: Math.hypot(dx, dy), ang: Math.atan2(dy, dx), diag: (x + (this.h - y)) / (this.w + this.h), jit: Math.random() });
      }
    }
    this.gap = gap;
    this.maxDist = Math.hypot(cx, cy);
  }
  progress(p) { this.p = Math.max(this.p, p); }
  play() { this.playing = performance.now(); return new Promise((r) => { this.done = r; }); }
  loop(now) {
    const { g, w, h, d } = this;
    g.setTransform(d, 0, 0, d, 0, 0);
    g.fillStyle = '#050505'; g.fillRect(0, 0, w, h);
    const cx = w / 2, cy = h / 2;
    this.shown += (this.p - this.shown) * 0.12;
    const T = (now - this.t0) / 1000;
    if (!this.playing) {
      // waiting: one breathing spark and a hairline ring of real progress
      const pulse = 4 + Math.sin(T * 4) * 1.2;
      g.fillStyle = this.color; g.shadowColor = this.color; g.shadowBlur = 24;
      g.beginPath(); g.arc(cx, cy, pulse, 0, 7); g.fill(); g.shadowBlur = 0;
      g.strokeStyle = 'rgba(255,255,255,0.12)'; g.lineWidth = 1;
      g.beginPath(); g.arc(cx, cy, 26, 0, 7); g.stroke();
      g.strokeStyle = 'rgba(255,255,255,0.85)';
      g.beginPath(); g.arc(cx, cy, 26, -Math.PI / 2, -Math.PI / 2 + this.shown * Math.PI * 2); g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.45)'; g.font = '500 11px "Geist Mono Variable", monospace'; g.textAlign = 'center';
      g.fillText(String(Math.round(this.shown * 100)).padStart(3, '0'), cx, cy + 52);
      requestAnimationFrame(this.loop);
      return;
    }
    const t = (now - this.playing) / 1000;
    // 1 · the spark splits into a cross
    if (t < 0.9) {
      const k = easeIO(t / 0.5), off = k * 15, rot = k * Math.PI / 4, fade = 1 - ease((t - 0.55) / 0.35);
      g.save(); g.translate(cx, cy); g.rotate(rot);
      g.globalAlpha = fade; g.fillStyle = '#d8ff3d'; g.shadowColor = '#d8ff3d'; g.shadowBlur = 16;
      [[0, 0], [off, 0], [-off, 0], [0, off], [0, -off]].forEach(([x, y]) => { g.beginPath(); g.arc(x, y, 4.2, 0, 7); g.fill(); });
      g.restore(); g.globalAlpha = 1; g.shadowBlur = 0;
    }
    // 2 · a field of iridescent points opens from the centre
    const R = this.maxDist * easeIO((t - 0.45) / 0.95) * 1.05;
    for (const p of this.dots) {
      if (p.dist > R) continue;
      const flood = ease((t - 1.15 - p.diag * 0.75 - p.jit * 0.08) / 0.42);
      const edge = Math.min(1, (R - p.dist) / 60);
      let r = (1.6 + 1.2 * Math.sin(p.dist * 0.05 - t * 6) * (1 - flood)) * edge;
      r += flood * this.gap * 0.86;
      if (flood > 0.02) g.fillStyle = this.color;
      else { const hue = (p.ang * 57.3 + p.dist * 0.35 + t * 140) % 360; g.fillStyle = `hsl(${hue}, 95%, ${60 + 10 * Math.sin(p.dist * 0.04 - t * 5)}%)`; }
      g.beginPath(); g.arc(p.x, p.y, Math.max(0.1, r), 0, 7); g.fill();
    }
    // 3 · the wave has melted everything into orange
    if (t > 2.35) {
      g.fillStyle = this.color; g.fillRect(0, 0, w, h);
      if (!this.finished) { this.finished = true; this.done?.(); }
    }
    if (t < 3.4) requestAnimationFrame(this.loop);
  }
}
