/*
  The laptop screen.
  A 2D canvas that types real looking JSX on the left and renders the
  matching layout on the right, block by block, as each line lands.
  It is mapped onto the scanned laptop's display panel every frame.
*/
const CODE = [
  ['k', 'export default function '], ['f', 'Home'], ['p', '() {'],
  ['n'],
  ['p', '  return ('],
  ['n'],
  ['t', '    <Nav '], ['a', 'sticky '], ['t', '/>'],
  ['n'],
  ['t', '    <Hero '], ['a', 'title='], ['s', '"Ship it."'], ['t', ' />'],
  ['n'],
  ['t', '    <Button '], ['a', 'primary'], ['t', '>Start</Button>'],
  ['n'],
  ['t', '    <Grid '], ['a', 'cols={3}'], ['t', '>'],
  ['n'],
  ['t', '      {cards.map(Card)}'],
  ['n'],
  ['t', '    </Grid>'],
  ['n'],
  ['t', '    <Footer />'],
  ['n'],
  ['p', '  );'],
  ['n'],
  ['p', '}'],
];
const COLORS = { k: '#c792ea', f: '#82aaff', p: '#d6deeb', t: '#7fdbca', a: '#ffcb6b', s: '#c3e88d' };
// which rendered block becomes visible once N characters are typed
const STAGES = [{ at: 60, b: 'nav' }, { at: 89, b: 'hero' }, { at: 123, b: 'btn' }, { at: 165, b: 'grid' }, { at: 190, b: 'foot' }];

export class LaptopScreen {
  constructor(w = 640, h = 480) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = w; this.canvas.height = h;
    this.ctx = this.canvas.getContext('2d');
    this.w = w; this.h = h;
    this.t = 0;
    this.total = CODE.reduce((s, c) => s + (c[1] ? c[1].length : 0), 0);
    this.accent = '#5cc8ff';
  }
  draw(dt) {
    this.t += dt;
    const { ctx, w, h } = this;
    const cps = 38;
    const cycle = this.total / cps + 4.5;
    const lt = this.t % cycle;
    const typed = Math.min(this.total, Math.floor(lt * cps));
    const fade = lt > cycle - 0.8 ? (cycle - lt) / 0.8 : 1;

    ctx.fillStyle = '#0b1220';
    ctx.fillRect(0, 0, w, h);
    const split = w * 0.5;
    // editor chrome
    ctx.fillStyle = '#0f1a2e'; ctx.fillRect(0, 0, w, 26);
    ['#ff5f57', '#febc2e', '#28c840'].forEach((c, i) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(14 + i * 14, 13, 4, 0, 7); ctx.fill(); });
    ctx.fillStyle = '#6b7a99'; ctx.font = '500 11px "Geist Mono Variable", monospace'; ctx.fillText('app/page.tsx', 64, 17);
    ctx.fillText('localhost:3000', split + 14, 17);

    // code
    ctx.globalAlpha = fade;
    ctx.font = '500 13px "Geist Mono Variable", monospace';
    let x = 14, y = 52, n = 0, line = 1;
    ctx.fillStyle = '#34415c'; ctx.fillText(String(line).padStart(2, ' '), 0, y);
    x = 24;
    for (const [type, text] of CODE) {
      if (type === 'n') { y += 21; x = 24; line++; ctx.fillStyle = '#34415c'; ctx.fillText(String(line).padStart(2, ' '), 0, y); continue; }
      if (n >= typed) break;
      const part = text.slice(0, Math.max(0, typed - n));
      ctx.fillStyle = COLORS[type];
      ctx.fillText(part, x, y);
      x += ctx.measureText(part).width;
      n += text.length;
    }
    if (Math.floor(this.t * 2) % 2 === 0) { ctx.fillStyle = this.accent; ctx.fillRect(x + 1, y - 12, 7, 15); }

    // preview pane
    ctx.fillStyle = '#f4f2ee'; ctx.fillRect(split, 26, w - split, h - 26);
    ctx.fillStyle = '#1a2233'; ctx.fillRect(split - 1, 26, 1, h - 26);
    const px = split + 16, pw = w - split - 32;
    const on = (b) => { const s = STAGES.find((q) => q.b === b); return s && typed >= s.at ? Math.min(1, (typed - s.at) / 14) : 0; };
    const ease = (v) => 1 - Math.pow(1 - v, 3);
    let k;
    if ((k = on('nav'))) { ctx.globalAlpha = fade * k; ctx.fillStyle = '#111'; ctx.fillRect(px, 42, 40, 8); ctx.fillStyle = '#bbb'; for (let i = 0; i < 3; i++) ctx.fillRect(px + pw - 110 + i * 34, 43, 24, 6); }
    if ((k = on('hero'))) {
      ctx.globalAlpha = fade * k; ctx.fillStyle = '#111';
      ctx.font = '600 38px "Geist Variable", sans-serif';
      ctx.fillText('Ship it.', px, 110 + (1 - ease(k)) * 16);
      ctx.fillStyle = '#999'; ctx.fillRect(px, 126, pw * 0.8, 6); ctx.fillRect(px, 138, pw * 0.55, 6);
    }
    if ((k = on('btn'))) { ctx.globalAlpha = fade * k; ctx.fillStyle = this.accent; this.round(px, 156, 86 * ease(k), 26, 8); ctx.fillStyle = '#04101f'; ctx.font = '600 12px "Geist Variable", sans-serif'; if (k > 0.6) ctx.fillText('Start', px + 26, 173); }
    if ((k = on('grid'))) {
      for (let i = 0; i < 3; i++) {
        const kk = Math.max(0, Math.min(1, k * 3 - i));
        ctx.globalAlpha = fade * kk;
        const cw = (pw - 16) / 3;
        ctx.fillStyle = ['#ffd2bf', '#cfe8ff', '#e3f5c4'][i];
        this.round(px + i * (cw + 8), 206 + (1 - ease(kk)) * 14, cw, 110, 8);
        ctx.fillStyle = '#222'; ctx.fillRect(px + i * (cw + 8) + 10, 300, cw * 0.6, 6);
      }
    }
    if ((k = on('foot'))) { ctx.globalAlpha = fade * k; ctx.fillStyle = '#111'; ctx.fillRect(px, h - 60, pw, 36); ctx.fillStyle = '#666'; ctx.fillRect(px + 12, h - 46, 60, 6); }
    ctx.globalAlpha = 1;
    // scanline sheen so it reads as a lit display
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, 'rgba(255,255,255,0.06)'); g.addColorStop(0.5, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(255,255,255,0.03)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  }
  round(x, y, w, h, r) {
    const c = this.ctx; c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.fill();
  }
}
