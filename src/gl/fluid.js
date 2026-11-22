import * as THREE from 'three';

/*
  Ink. A real time incompressible fluid solver on the GPU
  (semi Lagrangian advection, vorticity confinement, Jacobi pressure
  projection). Velocity runs at a coarse grid, dye at a finer one.
  The cursor and the moving phone push ink around it, so the hero
  behaves like a liquid instead of an animation.
*/
const VERT = /* glsl */ `
  uniform vec2 texelSize;
  varying vec2 vUv, vL, vR, vT, vB;
  void main(){
    vUv = position.xy * 0.5 + 0.5;
    vL = vUv - vec2(texelSize.x, 0.0); vR = vUv + vec2(texelSize.x, 0.0);
    vT = vUv + vec2(0.0, texelSize.y); vB = vUv - vec2(0.0, texelSize.y);
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }`;
const H = 'precision highp float; varying vec2 vUv, vL, vR, vT, vB;';

const FRAG = {
  splat: `${H} uniform sampler2D uTarget; uniform float aspect, radius; uniform vec3 color; uniform vec2 point;
    void main(){ vec2 p = vUv - point; p.x *= aspect; vec3 s = exp(-dot(p, p) / radius) * color; gl_FragColor = vec4(texture2D(uTarget, vUv).xyz + s, 1.0); }`,
  advect: `${H} uniform sampler2D uVelocity, uSource; uniform vec2 texelSize; uniform float dt, dissipation;
    void main(){ vec2 c = vUv - dt * texture2D(uVelocity, vUv).xy * texelSize; gl_FragColor = texture2D(uSource, c) / (1.0 + dissipation * dt); }`,
  divergence: `${H} uniform sampler2D uVelocity;
    void main(){
      float L = texture2D(uVelocity, vL).x, R = texture2D(uVelocity, vR).x, T = texture2D(uVelocity, vT).y, B = texture2D(uVelocity, vB).y;
      vec2 C = texture2D(uVelocity, vUv).xy;
      if (vL.x < 0.0) L = -C.x; if (vR.x > 1.0) R = -C.x; if (vT.y > 1.0) T = -C.y; if (vB.y < 0.0) B = -C.y;
      gl_FragColor = vec4(0.5 * (R - L + T - B), 0.0, 0.0, 1.0);
    }`,
  curl: `${H} uniform sampler2D uVelocity;
    void main(){ float L = texture2D(uVelocity, vL).y, R = texture2D(uVelocity, vR).y, T = texture2D(uVelocity, vT).x, B = texture2D(uVelocity, vB).x;
      gl_FragColor = vec4(0.5 * (R - L - T + B), 0.0, 0.0, 1.0); }`,
  vorticity: `${H} uniform sampler2D uVelocity, uCurl; uniform float curl, dt;
    void main(){
      float L = texture2D(uCurl, vL).x, R = texture2D(uCurl, vR).x, T = texture2D(uCurl, vT).x, B = texture2D(uCurl, vB).x, C = texture2D(uCurl, vUv).x;
      vec2 f = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L)); f /= length(f) + 0.0001; f *= curl * C; f.y *= -1.0;
      vec2 v = texture2D(uVelocity, vUv).xy + f * dt;
      gl_FragColor = vec4(clamp(v, -1000.0, 1000.0), 0.0, 1.0);
    }`,
  pressure: `${H} uniform sampler2D uPressure, uDivergence;
    void main(){ float L = texture2D(uPressure, vL).x, R = texture2D(uPressure, vR).x, T = texture2D(uPressure, vT).x, B = texture2D(uPressure, vB).x;
      gl_FragColor = vec4((L + R + B + T - texture2D(uDivergence, vUv).x) * 0.25, 0.0, 0.0, 1.0); }`,
  gradient: `${H} uniform sampler2D uPressure, uVelocity;
    void main(){ float L = texture2D(uPressure, vL).x, R = texture2D(uPressure, vR).x, T = texture2D(uPressure, vT).x, B = texture2D(uPressure, vB).x;
      vec2 v = texture2D(uVelocity, vUv).xy - vec2(R - L, T - B); gl_FragColor = vec4(v, 0.0, 1.0); }`,
  clear: `${H} uniform sampler2D uTexture; uniform float value; void main(){ gl_FragColor = value * texture2D(uTexture, vUv); }`,
};

function rt(w, h) {
  return new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, format: THREE.RGBAFormat, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, wrapS: THREE.ClampToEdgeWrapping, wrapT: THREE.ClampToEdgeWrapping, depthBuffer: false });
}
class Double {
  constructor(w, h) { this.a = rt(w, h); this.b = rt(w, h); }
  get read() { return this.a; } get write() { return this.b; }
  swap() { const t = this.a; this.a = this.b; this.b = t; }
}

export class Fluid {
  constructor(renderer, { sim = 128, dye = 768 } = {}) {
    this.r = renderer;
    this.simRes = sim; this.dyeRes = dye;
    this.scene = new THREE.Scene();
    this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
    this.quad.frustumCulled = false;
    this.scene.add(this.quad);
    this.mats = {};
    for (const [k, f] of Object.entries(FRAG)) {
      this.mats[k] = new THREE.ShaderMaterial({
        vertexShader: VERT, fragmentShader: f, depthTest: false, depthWrite: false,
        uniforms: {
          texelSize: { value: new THREE.Vector2() }, uTarget: { value: null }, aspect: { value: 1 }, radius: { value: 0.002 }, color: { value: new THREE.Vector3() }, point: { value: new THREE.Vector2() },
          uVelocity: { value: null }, uSource: { value: null }, dt: { value: 0.016 }, dissipation: { value: 0 }, uCurl: { value: null }, curl: { value: 0 },
          uPressure: { value: null }, uDivergence: { value: null }, uTexture: { value: null }, value: { value: 0 },
        },
      });
    }
    this.params = { velDiss: 1.1, dyeDiss: 0.85, pressure: 0.8, curl: 26, iters: 18 };
    this.queue = [];
    this.resize(window.innerWidth / window.innerHeight);
  }
  resize(aspect) {
    this.aspect = aspect;
    const dims = (res) => (aspect >= 1 ? [Math.round(res * aspect), res] : [res, Math.round(res / aspect)]);
    const [sw, sh] = dims(this.simRes), [dw, dh] = dims(this.dyeRes);
    [this.vel, this.dye, this.prs].forEach((d) => { if (d) { d.a.dispose(); d.b.dispose(); } });
    [this.div, this.curlT].forEach((t) => t && t.dispose());
    this.vel = new Double(sw, sh); this.dye = new Double(dw, dh); this.prs = new Double(sw, sh);
    this.div = rt(sw, sh); this.curlT = rt(sw, sh);
    this.simTexel = new THREE.Vector2(1 / sw, 1 / sh); this.dyeTexel = new THREE.Vector2(1 / dw, 1 / dh);
  }
  get texture() { return this.dye.read.texture; }
  pass(name, target, set) {
    const m = this.mats[name];
    set(m.uniforms);
    this.quad.material = m;
    this.r.setRenderTarget(target);
    this.r.render(this.scene, this.cam);
  }
  /** x, y in 0..1 (y up), dx, dy velocity in pixels per second, ink density */
  splat(x, y, dx, dy, ink = 1, radius = 0.0022) { this.queue.push({ x, y, dx, dy, ink, radius }); }
  step(dt) {
    const r = this.r;
    const prev = r.getRenderTarget(), auto = r.autoClear;
    r.autoClear = false;
    const p = this.params, st = this.simTexel;
    for (const s of this.queue) {
      this.pass('splat', this.vel.write, (u) => { u.texelSize.value.copy(st); u.uTarget.value = this.vel.read.texture; u.aspect.value = this.aspect; u.point.value.set(s.x, s.y); u.color.value.set(s.dx, s.dy, 0); u.radius.value = s.radius; });
      this.vel.swap();
      this.pass('splat', this.dye.write, (u) => { u.texelSize.value.copy(this.dyeTexel); u.uTarget.value = this.dye.read.texture; u.color.value.set(s.ink, s.ink, s.ink); });
      this.dye.swap();
    }
    this.queue.length = 0;
    this.pass('curl', this.curlT, (u) => { u.texelSize.value.copy(st); u.uVelocity.value = this.vel.read.texture; });
    this.pass('vorticity', this.vel.write, (u) => { u.texelSize.value.copy(st); u.uVelocity.value = this.vel.read.texture; u.uCurl.value = this.curlT.texture; u.curl.value = p.curl; u.dt.value = dt; });
    this.vel.swap();
    this.pass('divergence', this.div, (u) => { u.texelSize.value.copy(st); u.uVelocity.value = this.vel.read.texture; });
    this.pass('clear', this.prs.write, (u) => { u.uTexture.value = this.prs.read.texture; u.value.value = p.pressure; });
    this.prs.swap();
    for (let i = 0; i < p.iters; i++) {
      this.pass('pressure', this.prs.write, (u) => { u.texelSize.value.copy(st); u.uPressure.value = this.prs.read.texture; u.uDivergence.value = this.div.texture; });
      this.prs.swap();
    }
    this.pass('gradient', this.vel.write, (u) => { u.texelSize.value.copy(st); u.uPressure.value = this.prs.read.texture; u.uVelocity.value = this.vel.read.texture; });
    this.vel.swap();
    this.pass('advect', this.vel.write, (u) => { u.texelSize.value.copy(st); u.uVelocity.value = this.vel.read.texture; u.uSource.value = this.vel.read.texture; u.dt.value = dt; u.dissipation.value = p.velDiss; });
    this.vel.swap();
    this.pass('advect', this.dye.write, (u) => { u.texelSize.value.copy(st); u.uVelocity.value = this.vel.read.texture; u.uSource.value = this.dye.read.texture; u.dt.value = dt; u.dissipation.value = p.dyeDiss; });
    this.dye.swap();
    r.setRenderTarget(prev); r.autoClear = auto;
  }
}

/* glossy black ink: thickness from density, highlights from its gradient */
export function inkMaterial(fluid) {
  return new THREE.ShaderMaterial({
    uniforms: { uDye: { value: null }, uTexel: { value: fluid.dyeTexel }, uOpacity: { value: 1 }, uLight: { value: new THREE.Vector3(-0.45, 0.6, 1).normalize() }, uTitle: { value: null }, uShift: { value: 0 }, uLetter: { value: new THREE.Color('#fbfbf7') } },
    transparent: true, depthTest: false, depthWrite: false,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: /* glsl */ `
      uniform sampler2D uDye, uTitle; uniform vec2 uTexel; uniform float uOpacity, uShift; uniform vec3 uLight, uLetter; varying vec2 vUv;
      float d(vec2 o){ return texture2D(uDye, vUv + o * uTexel).r; }
      void main(){
        float c = d(vec2(0.0));
        float dx = d(vec2(1.5, 0.0)) - d(vec2(-1.5, 0.0));
        float dy = d(vec2(0.0, 1.5)) - d(vec2(0.0, -1.5));
        vec3 n = normalize(vec3(-dx * 6.0, -dy * 6.0, 1.0));
        float spec = pow(max(dot(reflect(-uLight, n), vec3(0.0, 0.0, 1.0)), 0.0), 36.0);
        float rim = smoothstep(0.0, 0.25, length(vec2(dx, dy)));
        float a = smoothstep(0.04, 0.26, c);
        // inside the ink lives the second edition of the hero: the same wordmark, in white
        float letter = texture2D(uTitle, vec2(vUv.x, vUv.y - uShift * 0.5)).a;
        vec3 base = mix(vec3(0.015), uLetter, letter);
        vec3 col = base + spec * 0.85 + rim * 0.03;
        gl_FragColor = vec4(col, a * uOpacity);
      }`,
  });
}
