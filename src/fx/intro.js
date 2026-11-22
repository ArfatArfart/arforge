/*
  The intro, drawn on the GPU.
  1. While the real bytes load, one yellow dot breathes on charcoal.
  2. It opens into a gooey X of five dots, which folds away.
  3. A diamond grid of dots grows out from the centre, each dot ringed in
     cyan and magenta like misregistered print.
  4. A diagonal wave swells the dots until neighbours melt into each other
     (metaballs), forming wavy yellow ribbons.
  5. The ribbons flood the screen, leaving a grid of black holes that close
     one by one, and the page underneath is the same yellow.
  Logic: one point becomes a pattern, the pattern becomes the surface.
*/
const VS = 'attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }';
const FS = /* glsl */ `
precision highp float;
uniform vec2 uRes; uniform float uT, uWait, uLoad, uPx, uGap; uniform vec3 uY, uBg;
const vec3 CY = vec3(0.10, 0.85, 1.0), MG = vec3(1.0, 0.18, 0.62);
float smin(float a, float b, float k){ float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0); return mix(b, a, h) - k * h * (1.0 - h); }
float cap(vec2 p, vec2 a, vec2 b, float r){ vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return length(pa - ba * h) - r; }
float ease(float t){ t = clamp(t, 0.0, 1.0); return t * t * (3.0 - 2.0 * t); }
vec2 rot(vec2 v){ return vec2(v.x + v.y, v.y - v.x) * 0.70710678; }
// radius of the dot whose centre is c, at time t
float radius(vec2 c, float t, float D){
  float d = length(c);
  float front = ease((t - 0.62) / 0.95) * D * 1.15;
  float appear = clamp((front - d) / (uGap * 3.0), 0.0, 1.0);
  float r = appear * uGap * (0.1 + 0.05 * sin(d * 0.045 - t * 7.0));
  float wave = 0.5 + 0.5 * sin((c.x + c.y) * 6.2831 / (uGap * 4.6) + sin((c.x - c.y) * 6.2831 / (uGap * 9.0)) * 1.4 - t * 5.0);
  r += appear * wave * uGap * 0.5 * ease((t - 1.15) / 0.55);
  float diag = (c.x - c.y) / (uRes.x + uRes.y) * uPx;
  r += uGap * 1.25 * ease((t - 1.85 - diag * 0.45) / 0.6);
  return r;
}
// gooey union (smooth minimum of distances) of the 3x3 neighbourhood on a 45 degree grid
float field(vec2 p, float t, float D, float add){
  vec2 g = rot(p) / uGap;
  vec2 id = floor(g);
  float d = 1e5, k = uGap * 0.32;
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec2 cid = id + vec2(float(i), float(j)) + 0.5;
    vec2 c = vec2(cid.x - cid.y, cid.x + cid.y) * 0.70710678 * uGap;
    float r = radius(c, t, D);
    if (r <= 0.02) continue;
    d = smin(d, length(p - c) - r - add, k);
  }
  return d;
}
void main(){
  vec2 p = (gl_FragCoord.xy - uRes * 0.5) / uPx;
  float D = length(uRes * 0.5) / uPx;
  float t = uT;
  vec3 col = uBg;
  if (t < 0.0) {
    // waiting: one breathing yellow dot that swells a little as bytes arrive
    float r = 4.2 + 1.1 * sin(uWait * 4.0) + uLoad * 1.6;
    float d = length(p) - r;
    col = mix(col, uY, 1.0 - smoothstep(-0.8, 0.8, d));
    col += uY * exp(-max(d, 0.0) * 0.22) * 0.08;
    gl_FragColor = vec4(col, 1.0); return;
  }
  // the X: five dots joined into one soft shape, then folding away
  float open = ease(t / 0.32), fold = ease((t - 0.42) / 0.3);
  float arm = 17.0 * open * (1.0 - fold * 0.7);
  float sx = length(p) - 5.0;
  for (int k = 0; k < 4; k++) {
    float a = 0.785398 + float(k) * 1.570796;
    vec2 e = vec2(cos(a), sin(a)) * arm;
    sx = smin(sx, length(p - e) - 5.2, 3.0);
    sx = smin(sx, cap(p, vec2(0.0), e, 2.6), 2.0);
  }
  float xa = (1.0 - smoothstep(-0.8, 0.8, sx)) * (1.0 - ease((t - 0.5) / 0.25));
  col = mix(col, uY, xa);
  // the field: three slightly different growths give the cyan and magenta rims
  float rim = 1.0 - ease((t - 2.1) / 0.4);
  float dy = field(p, t, D, 0.0);
  float dc = field(p, t, D, 3.0 * rim);
  float dm = field(p, t, D, 1.5 * rim);
  float cC = (1.0 - smoothstep(-0.8, 0.8, dc)) * rim;
  float cM = (1.0 - smoothstep(-0.8, 0.8, dm)) * rim;
  float cY = 1.0 - smoothstep(-0.8, 0.8, dy);
  col = mix(col, CY, cC);
  col = mix(col, MG, cM);
  col = mix(col, uY, cY);
  // last holes close
  col = mix(col, uY, ease((t - 2.55) / 0.3));
  gl_FragColor = vec4(col, 1.0);
}`;

const hex = (h) => { const n = parseInt(h.slice(1), 16); return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; };

export class Intro {
  constructor(root, color = '#FDEA2C') {
    this.root = root;
    this.c = document.createElement('canvas');
    this.c.className = 'intro-canvas';
    root.prepend(this.c);
    this.p = 0; this.shown = 0; this.t0 = performance.now(); this.playing = null;
    const gl = (this.gl = this.c.getContext('webgl', { antialias: false, alpha: false, premultipliedAlpha: false }));
    if (gl) {
      const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) console.warn(gl.getShaderInfoLog(s)); return s; };
      const prog = gl.createProgram();
      gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
      gl.linkProgram(prog); gl.useProgram(prog);
      const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      this.u = Object.fromEntries(['uRes', 'uT', 'uWait', 'uLoad', 'uPx', 'uGap', 'uY', 'uBg'].map((k) => [k, gl.getUniformLocation(prog, k)]));
      gl.uniform3fv(this.u.uY, hex(color));
      gl.uniform3fv(this.u.uBg, hex('#17181b'));
    }
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
  }
  resize() {
    const d = Math.min(window.devicePixelRatio || 1, 1.5);
    this.d = d;
    this.c.width = Math.round(window.innerWidth * d); this.c.height = Math.round(window.innerHeight * d);
    if (!this.gl) return;
    this.gl.viewport(0, 0, this.c.width, this.c.height);
    this.gl.uniform2f(this.u.uRes, this.c.width, this.c.height);
    this.gl.uniform1f(this.u.uPx, d);
    this.gl.uniform1f(this.u.uGap, window.innerWidth < 760 ? 30 : 40);
  }
  progress(p) { this.p = Math.max(this.p, p); }
  play() { this.playing = performance.now(); return new Promise((r) => { this.done = r; }); }
  loop(now) {
    this.shown += (this.p - this.shown) * 0.12;
    const t = this.playing ? (now - this.playing) / 1000 : -1;
    const gl = this.gl;
    if (gl) {
      gl.uniform1f(this.u.uT, t);
      gl.uniform1f(this.u.uWait, (now - this.t0) / 1000);
      gl.uniform1f(this.u.uLoad, this.shown);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    if (this.playing && (t > 2.9 || !gl) && !this.finished) { this.finished = true; this.done?.(); }
    if (!this.finished || t < 3.4) requestAnimationFrame(this.loop);
  }
}
