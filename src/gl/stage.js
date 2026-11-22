import * as THREE from 'three';
import gsap from 'gsap';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { MorphField, Embers, Sparks } from './particles.js';
import { patchForge, forgeUniforms, earthMaterial, atmosphereMaterial } from './materials.js';
import { sampleModel, dustTarget, sheetTarget, sphereTarget, ringsTarget, earthTarget, toTextures } from './targets.js';
import { LaptopScreen } from './screen.js';
import { buildPhone, ShowcaseScreen, ShipApp, PHONE } from './phone.js';

const BASE = import.meta.env.BASE_URL;
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
const damp = (a, b, k, dt) => lerp(a, b, 1 - Math.exp(-k * dt));
const easeIO = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

// Byte sizes of the critical assets, used when a server hides Content-Length.
const SIZE = { 'models/digital_wrist_watch.glb': 774156, 'hdri/studio_small_09_1k.hdr': 1615248 };
export const WORK_MOBILE = ['forge-gym-demo', 'medinest-pharmacy-demo', 'stationery-point', 'nwf-web', 'crazypin', 'investigation-workspace'];
const FLOOR_Y = -(PHONE.H / 2) - 0.34;

async function fetchBytes(path, onChunk) {
  const res = await fetch(BASE + path);
  if (!res.ok) throw new Error(`${path} ${res.status}`);
  const reader = res.body && res.body.getReader ? res.body.getReader() : null;
  if (!reader) { const b = await res.arrayBuffer(); onChunk(b.byteLength); return b; }
  const chunks = []; let len = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value); len += value.length; onChunk(value.length);
  }
  const out = new Uint8Array(len); let o = 0;
  for (const c of chunks) { out.set(c, o); o += c.length; }
  return out.buffer;
}

export function latLonToVec3(lat, lon, r = 1) {
  const phi = THREE.MathUtils.degToRad(lon + 180), th = THREE.MathUtils.degToRad(lat);
  return new THREE.Vector3(-Math.cos(phi) * Math.cos(th) * r, Math.sin(th) * r, Math.sin(phi) * Math.cos(th) * r);
}

/** Where the sun is overhead right now (declination + subsolar longitude). */
export function sunLatLon(date = new Date()) {
  const start = Date.UTC(date.getUTCFullYear(), 0, 0);
  const day = (date.getTime() - start) / 864e5;
  const lat = -23.44 * Math.cos(((2 * Math.PI) / 365) * (day + 10));
  const hours = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;
  return { lat, lon: (12 - hours) * 15 };
}

/*
  A product photography studio, built as an environment map: soft boxes,
  strip lights and a warm kicker. Glass and titanium reflect these crisp
  shapes, which is what makes a render read as a photograph.
*/
function studioEnvironment(renderer) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#030303');
  const panel = (w, h, pos, intensity, color = '#ffffff') => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), side: THREE.DoubleSide }));
    m.position.set(...pos); m.lookAt(0, 0, 0); scene.add(m);
  };
  panel(9, 2.6, [0, 7, 1], 3.2);
  panel(1.1, 8, [-6.5, 1, 2.5], 5.5);
  panel(0.6, 8, [6.5, 0.5, -1.5], 4, '#d6e6ff');
  panel(6, 1.4, [0, 1.5, 7], 1.4);
  panel(12, 0.8, [0, -3.2, -6], 0.9, '#ffb48a');
  panel(2, 2, [4, 4, 4], 2.2);
  const pm = new THREE.PMREMGenerator(renderer);
  const env = pm.fromScene(scene, 0.0, 0.1, 100, { size: 512 }).texture;
  pm.dispose();
  return env;
}

const FinalShader = {
  uniforms: {
    tDiffuse: { value: null }, uTime: { value: 0 }, uGrain: { value: 0.05 }, uVig: { value: 0.4 }, uCA: { value: 0.004 },
    uRes: { value: new THREE.Vector2(1, 1) },
  },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse; uniform float uTime, uGrain, uVig, uCA; uniform vec2 uRes; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main(){
      vec2 d = vUv - 0.5; float r2 = dot(d, d);
      vec2 o = d * uCA * (0.4 + r2 * 2.5);
      vec3 c = vec3(texture2D(tDiffuse, vUv + o).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv - o).b);
      c *= mix(1.0, smoothstep(0.9, 0.12, r2 * 2.3), uVig);
      float n = h(floor(vUv * uRes) + fract(uTime) * 61.0) - 0.5;
      c += n * uGrain * (1.0 - dot(c, vec3(0.3333)) * 0.6);
      gl_FragColor = vec4(c, 1.0);
    }`,
};

function floorMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color('#000000') }, uOpacity: { value: 1 } },
    transparent: true, depthWrite: false,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; uniform float uOpacity; varying vec2 vUv;
      void main(){
        float d = length((vUv - 0.5) * vec2(16.0, 10.0));
        float a = mix(0.66, 1.0, smoothstep(0.4, 3.0, d));
        gl_FragColor = vec4(uColor, mix(1.0, a, uOpacity));
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}
function poolMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uOpacity: { value: 1 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: /* glsl */ `
      uniform float uOpacity; varying vec2 vUv;
      void main(){ float d = length(vUv - 0.5) * 2.0; float a = pow(smoothstep(1.0, 0.0, d), 2.2) * 0.16 * uOpacity;
        gl_FragColor = vec4(vec3(1.0, 0.93, 0.86) * a, a); }`,
  });
}
function beamMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uOpacity: { value: 1 }, uTime: { value: 0 } }, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    vertexShader: `varying vec3 vN; varying vec3 vV; varying float vY;
      void main(){ vY = uv.y; vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: /* glsl */ `
      uniform float uOpacity, uTime; varying vec3 vN; varying vec3 vV; varying float vY;
      void main(){
        float core = pow(abs(dot(vN, vV)), 2.5);
        float fade = smoothstep(0.0, 0.45, vY) * smoothstep(1.0, 0.75, vY);
        float flick = 0.92 + 0.08 * sin(uTime * 1.7 + vY * 6.0);
        float a = core * fade * 0.085 * uOpacity * flick;
        gl_FragColor = vec4(vec3(1.0, 0.95, 0.88) * a, a);
      }`,
  });
}
/* dust floating inside the light beam */
function motes(count = 260) {
  const geo = new THREE.BufferGeometry();
  const seed = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) seed.set([Math.random(), Math.random(), Math.random(), Math.random()], i * 4);
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uOpacity: { value: 1 }, uPR: { value: 1 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `uniform float uTime, uPR; attribute vec4 aSeed; varying float vA;
      void main(){
        float y = fract(aSeed.y + uTime * (0.006 + aSeed.w * 0.01));
        float r = mix(0.25, 1.45, 1.0 - y) * sqrt(aSeed.x);
        float a = aSeed.z * 6.2831 + uTime * 0.05 * (aSeed.w - 0.5);
        vec3 p = vec3(cos(a) * r, -0.7 + y * 4.2, sin(a) * r - 0.3);
        vA = sin(y * 3.14159) * (0.4 + 0.6 * sin(uTime * 2.0 + aSeed.x * 40.0) * 0.5 + 0.3);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = (1.0 + aSeed.w * 2.2) * uPR * 3.2 / max(0.5, -mv.z) * 2.0;
      }`,
    fragmentShader: `uniform float uOpacity; varying float vA;
      void main(){ float r = length(gl_PointCoord - 0.5); if (r > 0.5) discard; float a = smoothstep(0.5, 0.0, r) * vA * uOpacity * 0.55; gl_FragColor = vec4(vec3(1.0, 0.96, 0.9) * a, a); }`,
  });
  const p = new THREE.Points(geo, mat); p.frustumCulled = false; return p;
}

/*
  Shot list, in page order. `rest` is how visible the particle field is when
  the shot is settled: 0 for real objects, 1 for procedural shots.
*/
const SHOTS = [
  { id: 'devices', custom: true, rest: 0 },
  { id: 'bust', file: 'models/marble_bust_01.glb', norm: 'height', rest: 0 },
  { id: 'laptop', file: 'models/classic_laptop.glb', norm: 'max', rest: 0 },
  { id: 'phone', custom: true, rest: 0 },
  { id: 'board', file: 'models/circuit_board.glb', norm: 'max', rest: 0 },
  { id: 'hammer', file: 'models/cross_pein_hammer.glb', norm: 'height', rest: 0 },
  { id: 'sheet', proc: sheetTarget, rest: 1 },
  { id: 'sphere', proc: sphereTarget, rest: 1 },
  { id: 'rings', proc: ringsTarget, rest: 1 },
  { id: 'earth', earth: true, rest: 0 },
];

// Layout per shot in world units of the visible frustum at z = 0.
const LAYOUT = {
  devices: (w, h, m) => m ? { x: w * 0.06, y: h * 0.26, s: (h * 0.25) / PHONE.H } : { x: Math.max(w * 0.24, w * 0.5 - h * 0.48), y: h * 0.02, s: (h * 0.6) / PHONE.H },
  bust:   (w, h, m) => m ? { x: w * 0.12, y: h * 0.22, s: h * 0.42 } : { x: w * 0.3, y: -h * 0.06, s: h * 0.8 },
  laptop: (w, h, m) => m ? { x: 0, y: h * 0.25, s: Math.min(w * 0.75, h * 0.34), ry: -0.25, rx: 0.2 } : { x: w * 0.25, y: -h * 0.04, s: h * 0.5, ry: -0.45, rx: 0.16 },
  phone:  (w, h, m) => ({ x: m ? 0 : w * 0.25, y: 0, s: (h * (m ? 0.5 : 0.62)) / PHONE.H }),
  board:  (w, h, m) => m ? { x: 0, y: h * 0.26, s: Math.min(w * 0.8, h * 0.4), rx: 0.8 } : { x: w * 0.27, y: -h * 0.1, s: h * 0.68, rx: 0.78 },
  hammer: (w, h, m) => m ? { x: w * 0.2, y: h * 0.12, s: h * 0.28 } : { x: w * 0.36, y: h * 0.06, s: h * 0.44 },
  sheet:  (w, h, m) => ({ x: 0, y: -h * (m ? 0.55 : 0.46), s: m ? 0.7 : 1.05, rx: 0.42 }),
  sphere: (w, h, m) => m ? { x: 0, y: -h * 0.2, s: w * 0.36 } : { x: w * 0.22, y: 0, s: h * 0.34 },
  rings:  (w, h, m) => m ? { x: 0, y: h * 0.2, s: w * 0.34, rx: 1.05 } : { x: w * 0.26, y: 0.0, s: h * 0.36, rx: 1.05 },
  earth:  (w, h, m) => m ? { x: 0, y: h * 0.27, s: Math.min(w * 0.36, h * 0.2) } : { x: Math.max(w * 0.3, w * 0.5 - h * 0.36), y: h * 0.04, s: h * 0.33 },
};

export class Stage {
  constructor(canvas, { onProgress, mobile, reduced } = {}) {
    this.canvas = canvas;
    this.onProgress = onProgress || (() => {});
    this.mobile = !!mobile;
    this.reduced = !!reduced;
    this.s = 0; this.sTarget = 0;
    this.heroT = 0; this.heroTs = 0;
    this.intro = 0; this.lights = 0;
    this.pointer = new THREE.Vector2(0, 0);
    this.ptr = new THREE.Vector2(0, 0);
    this.pointerActive = false;
    this.stats = { fps: 60, ms: 16, tris: 0, calls: 0, points: 0, ready: 0 };
    this.xray = false;
    this.shake = 0;
    this.earthDrag = 0;
    this.sphereSpin = { x: 0, y: 0 };
    this.particleGain = 1;
    this.callouts = {};
    this.sweepT = 3.5;

    const r = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', alpha: false, stencil: false });
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.NeutralToneMapping;
    r.toneMappingExposure = 1.0;
    this.maxDPR = this.mobile ? 1.5 : 1.6;
    this.dpr = Math.min(window.devicePixelRatio || 1, this.maxDPR);
    r.setPixelRatio(this.dpr);
    r.setClearColor('#000000', 1);
    r.info.autoReset = false; // count the whole frame, not just the last post pass
    this.renderer = r;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
    this.camera.position.set(0, 0, 6.6);
    this.studioEnv = studioEnvironment(r);

    // lights for the scanned models
    const key = new THREE.DirectionalLight('#fff1e0', 1.2); key.position.set(-3, 4, 5);
    const rim = new THREE.PointLight('#ff5a1f', 22, 12, 2); rim.position.set(3, 2, -2.5);
    this.scene.add(key, rim);
    this.rim = rim;
    // product photography rig: area lights give long soft highlights on glass and metal
    RectAreaLightUniformsLib.init();
    this.area = {
      key: new THREE.RectAreaLight('#fff3e6', 0, 3, 3.4),
      rim: new THREE.RectAreaLight('#d8e6ff', 0, 1.2, 4.8),
      top: new THREE.RectAreaLight('#ffffff', 0, 4.4, 1.2),
      sweep: new THREE.RectAreaLight('#ffffff', 0, 0.4, 5.6),
    };
    this.area.key.position.set(-3.4, 2.6, 3.6);
    this.area.rim.position.set(3.8, 0.8, -2.4);
    this.area.top.position.set(0, 4.2, 0.6);
    this.area.sweep.position.set(-5, 0.6, 3.2);
    Object.values(this.area).forEach((l) => { l.lookAt(0, 0, 0); this.scene.add(l); });

    this.N = this.mobile ? 256 * 48 : 256 * 112;
    this.W = 256;
    this.field = new MorphField(this.N, this.W);
    this.stats.particles = this.N;
    this.embers = new Embers(this.mobile ? 220 : 520);
    this.sparks = new Sparks(this.mobile ? 220 : 420);
    this.scene.add(this.field.points, this.embers.points, this.sparks.points);

    this.shots = SHOTS.map((def, index) => {
      const pivot = new THREE.Group();
      const spin = new THREE.Group();
      const norm = new THREE.Group();
      pivot.add(spin); spin.add(norm);
      pivot.visible = false;
      this.scene.add(pivot);
      return { ...def, index, pivot, spin, norm, tex: null, mesh: null, uniforms: null, ready: false };
    });
    this.byId = Object.fromEntries(this.shots.map((s) => [s.id, s]));
    this.raycaster = new THREE.Raycaster();
    this.plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    this.mouseWorld = new THREE.Vector3();
    this.clock = new THREE.Timer();
    this.frames = 0; this.fpsT = 0; this.lowT = 0; this.screenAcc = 0;

    this.dustTex = toTextures(dustTarget(this.N), this.W);
    for (const s of this.shots) { s.tex = s.proc ? toTextures(s.proc(this.N), this.W) : this.dustTex; s.ready = !!s.proc; }

    // cinematic finish on desktop: MSAA HDR buffer, bloom, grade, grain
    if (!this.mobile) {
      const rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: 4 });
      this.composer = new EffectComposer(r, rt);
      this.composer.addPass(new RenderPass(this.scene, this.camera));
      this.bloom = new UnrealBloomPass(new THREE.Vector2(512, 512), 0.5, 0.65, 0.96);
      this.composer.addPass(this.bloom);
      this.composer.addPass(new OutputPass());
      this.finalPass = new ShaderPass(FinalShader);
      this.composer.addPass(this.finalPass);
    }
    this.resize();
  }

  /* ---------------------------------------------------------------- loading */
  async loadCritical() {
    const t0 = performance.now();
    const total = Object.values(SIZE).reduce((a, b) => a + b, 0);
    let got = 0;
    const bump = (n, file) => { got += n; this.onProgress(Math.min(0.99, got / total), file); };
    MeshoptDecoder.ready && (await MeshoptDecoder.ready);
    this.gltf = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
    const [watchBuf, hdrBuf] = await Promise.all([
      fetchBytes('models/digital_wrist_watch.glb', (n) => bump(n, 'digital_wrist_watch.glb')),
      fetchBytes('hdri/studio_small_09_1k.hdr', (n) => bump(n, 'studio_small_09_1k.hdr')),
    ]);
    const hdrURL = URL.createObjectURL(new Blob([hdrBuf]));
    const hdr = await new HDRLoader().loadAsync(hdrURL);
    URL.revokeObjectURL(hdrURL);
    hdr.mapping = THREE.EquirectangularReflectionMapping;
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromEquirectangular(hdr).texture;
    this.scene.environmentIntensity = 0.9;
    hdr.dispose(); pmrem.dispose();

    const watch = await this.gltf.parseAsync(watchBuf, BASE + 'models/');
    this.watchScene = watch.scene;
    this.mountDevices();
    this.mountApps();
    this.stats.ready = Math.round(performance.now() - t0);
    this.onProgress(1, 'ready');
    this.renderer.compile(this.scene, this.camera);
  }

  async loadRest() {
    const jobs = this.shots.filter((s) => s.file && !s.ready).map(async (s) => {
      try { const g = await this.gltf.loadAsync(BASE + s.file); this.mountModel(s, g.scene); }
      catch (e) { console.warn('model failed', s.id, e); }
    });
    jobs.push(this.loadEarth().catch((e) => console.warn('earth failed', e)));
    await Promise.all(jobs);
  }

  cloneWatch() {
    const root = this.watchScene.clone(true);
    root.traverse((o) => {
      if (!o.isMesh) return;
      o.material = o.material.clone();
      o.material.envMap = this.studioEnv;
      o.material.envMapIntensity = 1.25;
    });
    const box = new THREE.Box3().setFromObject(root);
    const size = box.getSize(new THREE.Vector3()), center = box.getCenter(new THREE.Vector3());
    const k = 1 / Math.max(size.x, size.y, size.z);
    root.position.copy(center).multiplyScalar(-k); root.scale.setScalar(k);
    const face = new THREE.Group(); face.rotation.x = Math.PI / 2; face.add(root);
    const holder = new THREE.Group(); holder.add(face);
    return holder;
  }

  prepShot(shot, uniforms) {
    shot.uniforms = uniforms;
    shot.meshes = [];
    shot.spin.traverse((o) => {
      if (!o.isMesh) return;
      shot.meshes.push(o);
      (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => patchForge(m, uniforms));
    });
  }

  finishShot(shot, lift = 1.3) {
    this.layoutShot(shot);
    shot.pivot.updateMatrixWorld(true);
    shot.tex = toTextures(sampleModel(shot.spin, this.N, { lift }), this.W);
    shot.mesh = shot.spin;
    shot.ready = true;
    this._fromTex = null; this._B = null;
  }

  /* Hero: an engineered phone and a scanned watch in a dark studio */
  mountDevices() {
    const shot = this.byId.devices;
    const imgs = WORK_MOBILE.map((n) => { const i = new Image(); i.decoding = 'async'; i.src = `${BASE}work/mobile/${n}.webp`; return i; });
    this.showcase = new ShowcaseScreen(imgs, WORK_MOBILE);
    const phone = buildPhone({ envMap: this.studioEnv, screenTexture: this.showcase.texture, finish: 'black' });
    shot.phone = phone;
    shot.spin.add(phone.group);
    const watch = this.cloneWatch();
    watch.position.set(-0.98, -0.5, 0.28); watch.scale.setScalar(1.0); watch.rotation.set(0.55, 0.42, -0.3);
    shot.spin.add(watch);
    shot.watch = watch;
    const u = forgeUniforms(); u.uNoiseScale.value = 4.5;
    this.prepShot(shot, u);
    // glossy studio floor: a mirrored copy under a floor that fades into black
    const mirror = new THREE.Group(); mirror.scale.y = -1; mirror.position.y = 2 * FLOOR_Y;
    const mspin = new THREE.Group(); mirror.add(mspin);
    mspin.add(phone.group.clone(true), watch.clone(true));
    shot.pivot.add(mirror); shot.mirrorSpin = mspin;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(16, 10), floorMaterial());
    floor.rotation.x = -Math.PI / 2; floor.position.y = FLOOR_Y; floor.renderOrder = 2;
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 4.2), poolMaterial());
    pool.rotation.x = -Math.PI / 2; pool.position.set(-0.2, FLOOR_Y + 0.002, 0); pool.renderOrder = 3;
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 1.6, 4.4, 64, 1, true), beamMaterial());
    beam.position.set(0, FLOOR_Y + 2.2, -0.35); beam.renderOrder = 4;
    const dust = motes(this.mobile ? 120 : 280); dust.renderOrder = 4;
    shot.pivot.add(floor, pool, beam, dust);
    shot.set = { floor, pool, beam, dust };
    this.finishShot(shot, 1.2);
  }

  /* Apps: the same engineering, running an app you can drag */
  mountApps() {
    const shot = this.byId.phone;
    this.app = new ShipApp();
    const phone = buildPhone({ envMap: this.studioEnv, screenTexture: this.app.texture, finish: 'natural' });
    shot.phone = phone;
    this.appScreen = phone.screen;
    shot.spin.add(phone.group);
    const watch = this.cloneWatch();
    watch.position.set(0.82, -0.42, -0.5); watch.scale.setScalar(1.05); watch.rotation.set(0.28, -0.7, 0.4);
    shot.spin.add(watch);
    const u = forgeUniforms(); u.uNoiseScale.value = 4.5;
    this.prepShot(shot, u);
    this.app.draw(0);
    this.finishShot(shot, 1.2);
  }

  mountModel(shot, root) {
    const box = new THREE.Box3().setFromObject(root);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const k = 1 / (shot.norm === 'height' ? size.y : Math.max(size.x, size.y, size.z));
    root.position.copy(center).multiplyScalar(-k);
    root.scale.setScalar(k);
    shot.norm.add(root);
    if (shot.id === 'hammer') {
      shot.norm.position.y = 0.5;
      shot.head = new THREE.Object3D(); shot.head.position.set(0.05, 0.42, 0); root.parent.add(shot.head);
    }
    const uniforms = forgeUniforms();
    if (shot.id === 'bust') uniforms.uNoiseScale.value = 6.0;
    shot.uniforms = uniforms;
    shot.meshes = [];
    root.traverse((o) => {
      if (!o.isMesh) return;
      shot.meshes.push(o);
      (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => {
        if (shot.id === 'laptop' && /screen/i.test(m.name)) { this.makeScreen(o, root); return; }
        m.envMapIntensity = 1.0;
        patchForge(m, uniforms);
      });
    });
    this.finishShot(shot, shot.id === 'bust' ? 1.25 : 1.35);
  }

  makeScreen(mesh, root) {
    root.updateMatrixWorld(true);
    const geo = mesh.geometry;
    const pos = geo.attributes.position;
    const m = new THREE.Matrix4().copy(mesh.matrixWorld).premultiply(new THREE.Matrix4().copy(root.matrixWorld).invert());
    const P = []; const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) P.push(v.fromBufferAttribute(pos, i).applyMatrix4(m).clone());
    const n = new THREE.Vector3(); const idx = geo.index;
    const tri = idx ? idx.count : pos.count;
    for (let i = 0; i < tri; i += 3) {
      const a = P[idx ? idx.getX(i) : i], b = P[idx ? idx.getX(i + 1) : i + 1], c = P[idx ? idx.getX(i + 2) : i + 2];
      const cr = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a));
      if (cr.z < 0) cr.negate();
      n.add(cr);
    }
    n.normalize();
    const up = new THREE.Vector3(0, 1, 0);
    const vv = up.clone().sub(n.clone().multiplyScalar(up.dot(n))).normalize();
    const uu = new THREE.Vector3().crossVectors(vv, n).normalize();
    let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity;
    const UV = P.map((p) => { const a = p.dot(uu), b = p.dot(vv); minU = Math.min(minU, a); maxU = Math.max(maxU, a); minV = Math.min(minV, b); maxV = Math.max(maxV, b); return [a, b]; });
    const uv = new Float32Array(pos.count * 2);
    UV.forEach(([a, b], i) => { uv[i * 2] = (a - minU) / (maxU - minU); uv[i * 2 + 1] = (b - minV) / (maxV - minV); });
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    const aspect = (maxU - minU) / (maxV - minV) || 1.33;
    this.screen = new LaptopScreen(768, Math.round(768 / aspect));
    this.screenTex = new THREE.CanvasTexture(this.screen.canvas);
    this.screenTex.colorSpace = THREE.SRGBColorSpace;
    this.screenTex.anisotropy = 4;
    mesh.material = new THREE.MeshStandardMaterial({ color: '#000000', emissive: '#ffffff', emissiveMap: this.screenTex, emissiveIntensity: 1.2, roughness: 0.18, metalness: 0 });
  }

  async loadEarth() {
    const tl = new THREE.TextureLoader();
    const L = (f, srgb = true) => tl.loadAsync(BASE + 'textures/earth/' + f).then((t) => { if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; });
    const [day, night, spec, clouds] = await Promise.all([
      L('earth_atmos_2048.jpg'), L('earth_lights_2048.png'), L('earth_specular_2048.jpg', false), L('earth_clouds_2048.jpg', false),
    ]);
    const shot = this.byId.earth;
    const uniforms = forgeUniforms({ uSunWorld: { value: new THREE.Vector3(1, 0, 0) }, uAtmo: { value: 1 } });
    uniforms.uNoiseScale.value = 3.0;
    shot.uniforms = uniforms;
    const mat = earthMaterial({ day, night, spec, clouds }, uniforms);
    this.earthMat = mat;
    const sphere = new THREE.Mesh(new THREE.SphereGeometry(1, 96, 64), mat);
    const atmo = new THREE.Mesh(new THREE.SphereGeometry(1.12, 64, 48), atmosphereMaterial(uniforms));
    atmo.userData.skipSample = true;
    shot.norm.add(sphere, atmo);
    shot.meshes = [sphere];
    const tz = this.visitor || { lat: 20, lon: 0 };
    const marker = new THREE.Group();
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.018, 16, 12), new THREE.MeshBasicMaterial({ color: '#ff7a2f', toneMapped: false }));
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.03, 0.038, 48), new THREE.MeshBasicMaterial({ color: '#ff7a2f', transparent: true, side: THREE.DoubleSide, toneMapped: false, depthWrite: false }));
    dot.userData.skipSample = ring.userData.skipSample = true;
    marker.add(dot, ring);
    marker.position.copy(latLonToVec3(tz.lat, tz.lon, 1.01));
    marker.lookAt(latLonToVec3(tz.lat, tz.lon, 2));
    shot.norm.add(marker);
    this.marker = { group: marker, ring };
    const face = latLonToVec3(0, tz.lon);
    this.earthFace = Math.atan2(-face.x, face.z);
    this.earthTilt = THREE.MathUtils.degToRad(tz.lat) * 0.55;
    this.layoutShot(shot);
    shot.pivot.updateMatrixWorld(true);
    shot.tex = toTextures(earthTarget(this.N, day.image, night.image), this.W);
    shot.mesh = sphere;
    shot.ready = true;
    this._fromTex = null; this._B = null;
  }

  /* ---------------------------------------------------------------- layout */
  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.mobile = w < 760;
    this.renderer.setSize(w, h, false);
    if (this.composer) {
      this.composer.setPixelRatio(this.dpr);
      this.composer.setSize(w, h);
      this.finalPass.uniforms.uRes.value.set(w * this.dpr, h * this.dpr);
    }
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.viewH = 2 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) * this.camera.position.z;
    this.viewW = this.viewH * this.camera.aspect;
    this.field.uniforms.uPR.value = this.dpr;
    this.field.uniforms.uSize.value = (this.mobile ? 20 : 26) * (h / 900);
    this.embers.uniforms.uPR.value = this.dpr;
    this.embers.uniforms.uSpan.value.set(this.viewW * 1.2, this.viewH * 1.2);
    this.sparks.uniforms.uPR.value = this.dpr;
    const d = this.byId.devices.set; if (d) d.dust.material.uniforms.uPR.value = this.dpr;
    this.shots.forEach((s) => this.layoutShot(s));
  }

  layoutShot(shot) {
    const L = LAYOUT[shot.id](this.viewW, this.viewH, this.mobile);
    const anchor = !this.mobile && shot.id === 'sphere' ? document.getElementById('orb') : null;
    if (anchor) {
      const r = anchor.getBoundingClientRect();
      if (r.width) L.x = ((r.left + r.width / 2) / window.innerWidth - 0.5) * this.viewW;
    }
    shot.pivot.position.set(L.x || 0, L.y || 0, L.z || 0);
    shot.pivot.scale.setScalar(L.s || 1);
    shot.pivot.rotation.set(L.rx || 0, L.ry || 0, L.rz || 0);
    if (shot.id === 'hammer') shot.pivot.position.y -= (L.s || 1) * 0.5;
    shot.layout = L;
  }

  /* ---------------------------------------------------------------- theme */
  setTheme(t, dur = 0.9) {
    const fu = this.field.uniforms;
    const bg = new THREE.Color(); this.renderer.getClearColor(bg);
    const target = new THREE.Color(t.bg);
    const acc = new THREE.Color(t.accent);
    const srgb = (hex) => { const c = new THREE.Color(hex); const o = {}; c.getRGB(o, THREE.SRGBColorSpace); return new THREE.Vector3(o.r, o.g, o.b); };
    const accSRGB = srgb(t.accent), inkS = srgb(t.fg);
    gsap.to(bg, { r: target.r, g: target.g, b: target.b, duration: dur, ease: 'power2.out', onUpdate: () => this.renderer.setClearColor(bg) });
    gsap.to(fu.uInk.value, { x: inkS.x, y: inkS.y, z: inkS.z, duration: dur });
    gsap.to(fu.uInkMix, { value: t.dark ? 0 : 0.82, duration: dur });
    gsap.to(fu.uAccent.value, { x: accSRGB.x, y: accSRGB.y, z: accSRGB.z, duration: dur });
    gsap.to(this, { particleGain: t.particles ?? 1, duration: dur });
    gsap.to(this.embers.uniforms.uOpacity, { value: t.embers ?? 0.2, duration: dur });
    gsap.to(this.embers.uniforms.uColor.value, { x: accSRGB.x, y: accSRGB.y, z: accSRGB.z, duration: dur });
    gsap.to(this.rim.color, { r: acc.r, g: acc.g, b: acc.b, duration: dur });
    gsap.to(this.rim, { intensity: t.dark ? 22 : 2, duration: dur });
    gsap.to(this.scene, { environmentIntensity: t.env ?? 0.9, duration: dur });
    if (this.bloom) gsap.to(this.bloom, { strength: t.dark ? 0.5 : 0.1, duration: dur });
    if (this.finalPass) gsap.to(this.finalPass.uniforms.uVig, { value: t.dark ? 0.42 : 0.08, duration: dur });
    for (const s of this.shots) if (s.uniforms) {
      gsap.to(s.uniforms.uEdge.value, { r: acc.r, g: acc.g, b: acc.b, duration: dur });
      gsap.to(s.uniforms.uScanColor.value, { r: acc.r, g: acc.g, b: acc.b, duration: dur });
    }
    const floor = this.byId.devices.set?.floor;
    if (floor) gsap.to(floor.material.uniforms.uColor.value, { r: target.r, g: target.g, b: target.b, duration: dur });
    if (this.screen) this.screen.accent = t.accent;
  }

  /* ---------------------------------------------------------------- interactions */
  setPointer(nx, ny) { this.pointer.set(nx, ny); this.pointerActive = true; }

  /** uv on the interactive phone screen under a client point, or null */
  pickScreen(cx, cy) {
    if (!this.appScreen || !this.byId.phone.pivot.visible) return null;
    const ndc = new THREE.Vector2((cx / window.innerWidth) * 2 - 1, -(cy / window.innerHeight) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const hit = this.raycaster.intersectObject(this.appScreen, false)[0];
    return hit ? hit.uv : null;
  }

  celebrate() {
    const p = new THREE.Vector3(); this.byId.phone.phone.group.localToWorld(p.set(0, -0.45, 0.1));
    this.sparks.fire(p);
  }

  strike(index = 0) {
    const s = this.byId.hammer;
    if (!s.ready || !s.head) return Promise.resolve();
    gsap.killTweensOf(s.spin.rotation);
    return new Promise((resolve) => {
      gsap.timeline({ onComplete: resolve })
        .to(s.spin.rotation, { z: 0.75, duration: 0.32, ease: 'power2.out' })
        .to(s.spin.rotation, {
          z: -0.32, duration: 0.15, ease: 'power4.in',
          onComplete: () => {
            const p = new THREE.Vector3(); s.head.getWorldPosition(p);
            this.sparks.fire(p);
            this.shake = 1;
            this.onStrike && this.onStrike(index);
          },
        })
        .to(s.spin.rotation, { z: 0.12, duration: 0.9, ease: 'elastic.out(1, 0.45)' });
    });
  }

  setXray(on) {
    this.xray = on;
    for (const s of this.shots) {
      if (!s.meshes) continue;
      for (const m of s.meshes) {
        if (!m.userData.wire && on) {
          const w = new THREE.Mesh(m.geometry, new THREE.MeshBasicMaterial({ color: '#ffffff', wireframe: true, transparent: true, opacity: 0.14, depthWrite: false, toneMapped: false }));
          w.userData.skipSample = true; w.renderOrder = 3;
          m.add(w); m.userData.wire = w;
        }
        if (m.userData.wire) m.userData.wire.visible = on;
      }
    }
  }

  /* ---------------------------------------------------------------- frame */
  update() {
    this.clock.update();
    const dt = Math.min(0.05, this.clock.getDelta());
    const time = this.clock.getElapsed();
    const fu = this.field.uniforms;
    fu.uTime.value = time;
    this.embers.uniforms.uTime.value = time;
    this.sparks.tick(dt);

    // everything that follows the user is damped: nothing snaps
    this.s = Math.abs(this.sTarget - this.s) < 1e-4 ? this.sTarget : damp(this.s, this.sTarget, 6.5, dt);
    this.heroTs = damp(this.heroTs, this.heroT, 5, dt);
    this.ptr.x = damp(this.ptr.x, this.pointer.x, 3.2, dt);
    this.ptr.y = damp(this.ptr.y, this.pointer.y, 3.2, dt);

    this.raycaster.setFromCamera(this.pointer, this.camera);
    this.raycaster.ray.intersectPlane(this.plane, this.mouseWorld);
    if (this.pointerActive) fu.uMouse.value.lerp(this.mouseWorld, 0.2);

    const n = this.shots.length;
    const s = clamp(this.s, 0, n - 1);
    let i = Math.floor(s), t = s - i;
    if (i >= n - 1) { i = n - 1; t = 0; }
    const j = Math.min(i + 1, n - 1);
    let A = this.shots[i], B = this.shots[j];
    let morph = smooth(0.08, 0.92, t);
    let opacity = Math.max(lerp(A.rest, B.rest, smooth(0, 1, t)), Math.pow(Math.sin(Math.PI * t), 0.6));
    let fromTex = A.tex, fromM = null;

    // intro: dust condenses into the devices, then the studio lights come on
    const introActive = this.intro < 1 && i === 0 && t < 0.02;
    if (introActive) {
      A = this.byId.devices; B = this.byId.devices;
      fromTex = this.dustTex; fromM = new THREE.Matrix4();
      morph = smooth(0, 0.85, this.intro);
      opacity = Math.min(1, this.intro * 4) * (1 - smooth(0.78, 1, this.intro));
    }
    if (fromTex !== this._fromTex || B !== this._B) {
      fu.uFromPos.value = fromTex.pos; fu.uFromCol.value = fromTex.col;
      fu.uToPos.value = B.tex.pos; fu.uToCol.value = B.tex.col;
      this._fromTex = fromTex; this._B = B;
    }

    this.animateShots(time, dt);
    for (const sh of this.shots) sh.pivot.updateMatrixWorld(true);
    fu.uFromM.value.copy(fromM || A.spin.matrixWorld);
    fu.uToM.value.copy(B.spin.matrixWorld);
    fu.uMorph.value = morph;
    fu.uOpacity.value = opacity * this.particleGain;
    fu.uScatter.value = 0;

    // meshes: the one we leave burns away, the one we enter is forged in
    for (const sh of this.shots) {
      if (!sh.mesh || !sh.uniforms) { sh.pivot.visible = false; sh.vis = 0; continue; }
      let d = 1;
      if (introActive) d = sh.id === 'devices' ? 1 - smooth(0.55, 1, this.intro) : 1;
      else if (sh === A && sh === B) d = 0;
      else if (sh === A) d = smooth(0.0, 0.32, t);
      else if (sh === B) d = 1 - smooth(0.68, 1.0, t);
      sh.uniforms.uDissolve.value = d;
      sh.uniforms.uTime.value = time;
      if (sh.uniforms.uAtmo) sh.uniforms.uAtmo.value = 1 - d;
      sh.pivot.visible = d < 0.999;
      sh.vis = 1 - d;
    }

    // the studio set and its light rig follow the devices
    const dv = this.byId.devices, ph = this.byId.phone;
    const studio = Math.max(dv.vis || 0, ph.vis || 0);
    const L = this.lights;
    if (dv.set) {
      const k = (dv.vis || 0) * smooth(0.2, 0.9, L);
      dv.set.floor.material.uniforms.uOpacity.value = dv.vis || 0;
      dv.set.pool.material.uniforms.uOpacity.value = k;
      dv.set.beam.material.uniforms.uOpacity.value = k;
      dv.set.beam.material.uniforms.uTime.value = time;
      dv.set.dust.material.uniforms.uOpacity.value = k;
      dv.set.dust.material.uniforms.uTime.value = time;
    }
    this.sweepT += dt;
    const cyc = 7.5, sp = (this.sweepT % cyc) / 2.4;
    const sweepOn = sp < 1 ? Math.sin(Math.PI * sp) : 0;
    const tgt = (dv.vis || 0) >= (ph.vis || 0) ? dv.pivot.position : ph.pivot.position;
    this.area.sweep.position.set(tgt.x + lerp(-3.6, 3.6, easeIO(clamp(sp))), tgt.y + 0.5, 3.0);
    this.area.sweep.lookAt(tgt);
    this.area.key.intensity = 5.2 * studio * smooth(0.0, 0.35, L);
    this.area.rim.intensity = 6.5 * studio * smooth(0.25, 0.65, L);
    this.area.top.intensity = 3.0 * studio * smooth(0.45, 0.9, L);
    this.area.sweep.intensity = 26 * studio * sweepOn * smooth(0.8, 1, L);
    if (this.showcase && this.lights > 0.45) this.showcase.boot = Math.min(1.01, this.showcase.boot + dt / 1.5);

    // live screens redraw at 30 fps, only while they can be seen
    this.screenAcc += dt;
    if (this.screenAcc > 1 / 30) {
      const sdt = this.screenAcc; this.screenAcc = 0;
      if (this.showcase && dv.pivot.visible) this.showcase.draw(sdt);
      if (this.app && ph.pivot.visible) this.app.draw(sdt);
      if (this.screen && this.byId.laptop.pivot.visible) { this.screen.draw(sdt); this.screenTex.needsUpdate = true; }
    }
    if (this.marker) { const k = (time * 0.8) % 1; this.marker.ring.scale.setScalar(1 + k * 2.2); this.marker.ring.material.opacity = 1 - k; }
    if (this.earthMat && this.byId.earth.pivot.visible) {
      const sun = sunLatLon(new Date());
      this.earthMat.uniforms.uSun.value.copy(latLonToVec3(sun.lat, sun.lon));
      const e = this.byId.earth;
      e.uniforms.uSunWorld.value.copy(latLonToVec3(sun.lat, sun.lon).applyQuaternion(e.spin.getWorldQuaternion(new THREE.Quaternion())));
    }
    if (dv.pivot.visible && dv.phone) this.projectCallouts(dv);

    // camera: slow damped parallax plus impact shake
    this.shake *= Math.pow(0.0008, dt);
    const sx = (Math.random() - 0.5) * 0.06 * this.shake, sy = (Math.random() - 0.5) * 0.06 * this.shake;
    this.camera.position.x = this.ptr.x * 0.14 + sx;
    this.camera.position.y = this.ptr.y * 0.09 + sy;
    this.camera.lookAt(0, 0, 0);

    this.renderer.info.reset();
    if (this.composer) { this.finalPass.uniforms.uTime.value = time; this.composer.render(dt); }
    else this.renderer.render(this.scene, this.camera);

    const info = this.renderer.info.render;
    this.stats.tris = info.triangles; this.stats.calls = info.calls; this.stats.points = info.points;
    this.frames++; this.fpsT += dt;
    if (this.fpsT >= 0.5) {
      this.stats.fps = Math.round(this.frames / this.fpsT);
      this.stats.ms = +((1000 * this.fpsT) / this.frames).toFixed(1);
      this.frames = 0; this.fpsT = 0;
      // keep motion smooth on weaker GPUs: first resolution, then bloom
      if (this.stats.fps < 42 && document.visibilityState === 'visible' && time > 6) this.lowT += 0.5; else this.lowT = 0;
      if (this.lowT >= 2) {
        if (this.dpr > 1) { this.dpr = Math.max(1, this.dpr - 0.2); this.renderer.setPixelRatio(this.dpr); this.resize(); }
        else if (this.bloom && this.bloom.enabled) this.bloom.enabled = false;
        this.lowT = 0;
      }
    }
  }

  projectCallouts(dv) {
    const W = window.innerWidth, H = window.innerHeight;
    const g = dv.phone.group;
    const cam = this.camera.position;
    const out = {};
    const one = (key, local, normal, obj = g) => {
      const p = obj.localToWorld(local.clone());
      const nrm = normal.clone().transformDirection(obj.matrixWorld);
      const facing = clamp(nrm.dot(cam.clone().sub(p).normalize()) * 2.2);
      const q = p.project(this.camera);
      out[key] = { x: (q.x * 0.5 + 0.5) * W, y: (-q.y * 0.5 + 0.5) * H, f: facing * (dv.vis || 0) };
    };
    const { W: PW, H: PH, D } = PHONE;
    one('screen', new THREE.Vector3(0.18, 0.3, D / 2), new THREE.Vector3(0, 0, 1));
    one('lens', new THREE.Vector3(PW / 2 - 0.2, PH / 2 - 0.2, -D / 2 - 0.05), new THREE.Vector3(0, 0, -1));
    one('frame', new THREE.Vector3(PW / 2 + 0.006, 0.21, 0), new THREE.Vector3(1, 0, 0.4));
    one('watch', new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 1), dv.watch);
    this.callouts = out;
  }

  animateShots(time, dt) {
    const px = this.ptr.x, py = this.ptr.y;
    const b = this.byId;

    // hero: the phone floats, follows the hand, and turns around as you scroll
    const ht = easeIO(clamp(this.heroTs / 0.9));
    const dv = b.devices;
    if (dv.layout) {
      dv.spin.rotation.set(0.08 - py * 0.1 + Math.sin(time * 0.5) * 0.012, -0.5 + px * 0.32 + ht * (Math.PI + 0.12), 0.05 * (1 - ht) + Math.sin(time * 0.37) * 0.01);
      dv.spin.position.y = Math.sin(time * 0.8) * 0.028;
      dv.pivot.position.x = dv.layout.x * (1 - 0.35 * ht);
      dv.pivot.scale.setScalar(dv.layout.s * (1 + 0.1 * ht));
      if (dv.mirrorSpin) { dv.mirrorSpin.rotation.copy(dv.spin.rotation); dv.mirrorSpin.position.copy(dv.spin.position); }
    }
    // apps: the phone sits in the page layout, so it is anchored to its DOM slot
    const ph = b.phone;
    if (ph.layout) {
      const slot = this.slot || (this.slot = document.querySelector('.phone-slot'));
      if (slot) {
        const r = slot.getBoundingClientRect();
        if (r.height) {
          ph.pivot.position.set(((r.left + r.width / 2) / window.innerWidth - 0.5) * this.viewW, (0.5 - (r.top + r.height / 2) / window.innerHeight) * this.viewH, 0);
          ph.pivot.scale.setScalar(((r.height / window.innerHeight) * this.viewH * 0.92) / PHONE.H);
        }
      }
      ph.spin.rotation.set(0.04 - py * 0.06, -0.16 + px * 0.14, 0);
      ph.spin.position.y = Math.sin(time * 0.9) * 0.012;
    }
    b.bust.spin.rotation.y = damp(b.bust.spin.rotation.y, -0.55 + px * 0.45, 3, dt);
    b.bust.spin.rotation.x = damp(b.bust.spin.rotation.x, -py * 0.1, 3, dt);
    b.laptop.spin.rotation.y = damp(b.laptop.spin.rotation.y, px * 0.3 + Math.sin(time * 0.4) * 0.06, 3, dt);
    b.laptop.spin.position.y = Math.sin(time * 0.9) * 0.02;
    b.board.spin.rotation.y = time * 0.12 + px * 0.25;
    b.sheet.spin.rotation.y = Math.sin(time * 0.1) * 0.08;
    b.sphere.spin.rotation.y = time * 0.08 + this.sphereSpin.y;
    b.sphere.spin.rotation.x = this.sphereSpin.x;
    b.rings.spin.rotation.y = time * 0.06;
    b.rings.spin.rotation.z = Math.sin(time * 0.3) * 0.05;
    const lift = this.footerT || 0;
    if (b.earth.layout) {
      b.earth.pivot.position.y = b.earth.layout.y + lift * this.viewH * (this.mobile ? 0.12 : 0.26);
      b.earth.pivot.position.x = b.earth.layout.x + lift * this.viewW * (this.mobile ? 0 : 0.06);
    }
    if (this.earthFace !== undefined) {
      b.earth.spin.rotation.y = this.earthFace + this.earthDrag + Math.sin(time * 0.12) * 0.12 + px * 0.15;
      b.earth.spin.rotation.x = this.earthTilt + py * 0.08;
    }
  }
}
