import * as THREE from 'three';

/*
  Ink trail. Not a spreading fluid: your cursor leaves a ribbon of thick ink a
  little wider than the pointer, wider still when you move fast. The ribbon
  holds its shape, wobbles at the edge like something wet, and thins from its
  oldest end until it is gone. Under it lives the second edition of the hero.

  One half-float texture stores ink amount. Each frame it decays a little and
  drifts on a slow noise current; new strokes are stamped as capsules with a
  domed profile, so the cut at 0.5 gives a crisp edge that narrows as it fades.
*/
const MAX = 24;
const VERT = 'varying vec2 vUv; void main(){ vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 0.0, 1.0); }';

const FADE = /* glsl */ `
  precision highp float; varying vec2 vUv;
  uniform sampler2D uSrc; uniform float uDecay, uT, uAspect, uDrift;
  vec2 hash2(vec2 p){ p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3))); return fract(sin(p) * 43758.5453) * 2.0 - 1.0; }
  float noise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(dot(hash2(i), f), dot(hash2(i + vec2(1, 0)), f - vec2(1, 0)), u.x), mix(dot(hash2(i + vec2(0, 1)), f - vec2(0, 1)), dot(hash2(i + vec2(1, 1)), f - vec2(1, 1)), u.x), u.y); }
  void main(){
    vec2 p = vec2(vUv.x * uAspect, vUv.y) * 3.0;
    float e = 0.01;
    float n0 = noise(p + uT * 0.12), nx = noise(p + vec2(e, 0.0) + uT * 0.12), ny = noise(p + vec2(0.0, e) + uT * 0.12);
    vec2 curl = vec2(ny - n0, -(nx - n0)) / e;
    // a slow wet current, and the faintest pull downward
    vec2 uv = vUv - curl * uDrift * vec2(1.0 / uAspect, 1.0) + vec2(0.0, uDrift * 0.35);
    gl_FragColor = vec4(texture2D(uSrc, uv).r * uDecay, 0.0, 0.0, 1.0);
  }`;

const STAMP = /* glsl */ `
  precision highp float; varying vec2 vUv;
  uniform sampler2D uSrc; uniform float uAspect; uniform int uN;
  uniform vec4 uSeg[${MAX}]; uniform vec3 uRad[${MAX}];
  void main(){
    float v = texture2D(uSrc, vUv).r;
    vec2 p = vec2(vUv.x * uAspect, vUv.y);
    for (int i = 0; i < ${MAX}; i++) {
      if (i >= uN) break;
      vec2 a = vec2(uSeg[i].x * uAspect, uSeg[i].y), b = vec2(uSeg[i].z * uAspect, uSeg[i].w);
      vec2 ab = b - a; float L = dot(ab, ab);
      float t = L > 1e-9 ? clamp(dot(p - a, ab) / L, 0.0, 1.0) : 0.0;
      float r = mix(uRad[i].x, uRad[i].y, t);
      float d = length(p - (a + ab * t)) / r;
      if (d < 1.0) v = max(v, uRad[i].z * (1.0 - d * d));
    }
    gl_FragColor = vec4(v, 0.0, 0.0, 1.0);
  }`;

function rt(w, h) {
  return new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, format: THREE.RGBAFormat, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false });
}

export class InkTrail {
  constructor(renderer, { res = 900 } = {}) {
    this.r = renderer; this.res = res;
    this.scene = new THREE.Scene();
    this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2)); this.quad.frustumCulled = false;
    this.scene.add(this.quad);
    this.fade = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FADE, depthTest: false, depthWrite: false,
      uniforms: { uSrc: { value: null }, uDecay: { value: 1 }, uT: { value: 0 }, uAspect: { value: 1 }, uDrift: { value: 0 } } });
    this.stamp = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: STAMP, depthTest: false, depthWrite: false,
      uniforms: { uSrc: { value: null }, uAspect: { value: 1 }, uN: { value: 0 },
        uSeg: { value: Array.from({ length: MAX }, () => new THREE.Vector4()) }, uRad: { value: Array.from({ length: MAX }, () => new THREE.Vector3()) } } });
    this.queue = [];
    this.life = 1.7;
    this.resize(window.innerWidth / window.innerHeight);
  }
  resize(aspect) {
    this.aspect = aspect;
    const w = aspect >= 1 ? this.res : Math.round(this.res * aspect), h = aspect >= 1 ? Math.round(this.res / aspect) : this.res;
    this.a?.dispose(); this.b?.dispose();
    this.a = rt(w, h); this.b = rt(w, h);
    this.texel = new THREE.Vector2(1 / w, 1 / h);
    this.clear();
  }
  get texture() { return this.a.texture; }
  /** a stroke from (x0, y0) to (x1, y1) in 0..1 screen space (y up); radii as a fraction of the screen height */
  stroke(x0, y0, x1, y1, r0, r1, amount = 1.9) {
    if (this.queue.length >= MAX) this.queue.shift();
    this.queue.push([x0, y0, x1, y1, r0, r1, amount]);
  }
  clear() {
    // clear to zero ink, not to the renderer's (yellow) clear colour
    const r = this.r, prev = r.getRenderTarget(), col = new THREE.Color(), alpha = r.getClearAlpha();
    r.getClearColor(col);
    r.setClearColor(0x000000, 1);
    for (const t of [this.a, this.b]) { r.setRenderTarget(t); r.clear(); }
    r.setClearColor(col, alpha);
    r.setRenderTarget(prev);
  }
  run(mat, src, dst) {
    mat.uniforms.uSrc.value = src.texture;
    this.quad.material = mat;
    this.r.setRenderTarget(dst);
    this.r.render(this.scene, this.cam);
  }
  step(dt, time) {
    const r = this.r, prev = r.getRenderTarget(), auto = r.autoClear;
    r.autoClear = false;
    // amount 1.9 reaches the 0.5 cut after `life` seconds
    const f = this.fade.uniforms;
    f.uDecay.value = Math.pow(0.5 / 1.9, dt / this.life);
    f.uT.value = time; f.uAspect.value = this.aspect; f.uDrift.value = dt * 0.006;
    this.run(this.fade, this.a, this.b);
    [this.a, this.b] = [this.b, this.a];
    if (this.queue.length) {
      const s = this.stamp.uniforms;
      s.uAspect.value = this.aspect; s.uN.value = this.queue.length;
      this.queue.forEach((q, i) => { s.uSeg.value[i].set(q[0], q[1], q[2], q[3]); s.uRad.value[i].set(q[4], q[5], q[6]); });
      this.queue.length = 0;
      this.run(this.stamp, this.a, this.b);
      [this.a, this.b] = [this.b, this.a];
    }
    r.setRenderTarget(prev); r.autoClear = auto;
  }
}

/* flat black ink with a wet, wobbling edge; inside it the wordmark turns white */
export function inkMaterial(trail) {
  return new THREE.ShaderMaterial({
    uniforms: { uInk: { value: trail.texture }, uTexel: { value: trail.texel }, uOpacity: { value: 1 }, uTime: { value: 0 }, uTitle: { value: null }, uShift: { value: 0 },
      uLetter: { value: new THREE.Color('#ffffff') }, uInkCol: { value: new THREE.Color('#0b0b0c') }, uAspect: { value: 1 } },
    transparent: true, depthTest: false, depthWrite: false,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: /* glsl */ `
      uniform sampler2D uInk, uTitle; uniform vec2 uTexel; uniform float uOpacity, uTime, uShift, uAspect; uniform vec3 uLetter, uInkCol; varying vec2 vUv;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
      void main(){
        vec2 q = vec2(vUv.x * uAspect, vUv.y);
        float wob = (n(q * 18.0 + uTime * 0.6) - 0.5) * 0.16 + (n(q * 55.0 - uTime * 0.9) - 0.5) * 0.06;
        float v = texture2D(uInk, vUv).r + wob;
        float aa = max(fwidth(v), 0.004);
        float a = smoothstep(0.5 - aa, 0.5 + aa, v);
        if (a < 0.002) discard;
        // a faint wet sheen only along the thick middle of fresh strokes
        float sheen = smoothstep(1.2, 1.8, v) * 0.05;
        float letter = texture2D(uTitle, vec2(vUv.x, vUv.y - uShift * 0.5)).a;
        vec3 col = mix(uInkCol + sheen, uLetter, letter);
        gl_FragColor = vec4(col, a * uOpacity);
      }`,
  });
}
