import * as THREE from 'three';
import gsap from 'gsap';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { MorphField, Sparks } from './particles.js';
import { patchForge, forgeUniforms, earthMaterial, cloudMaterial, atmosphereMaterial } from './materials.js';
import { sampleModel, dustTarget, sheetTarget, sphereTarget, ringsTarget, earthTarget, toTextures } from './targets.js';
import { LaptopScreen } from './screen.js';
import { makeIPhone, SafariScreen, ShipApp, IPHONE } from './phone.js';
import { Fluid, inkMaterial } from './fluid.js';
import { HeroTitle, titleMaterial } from './title.js';

const BASE = import.meta.env.BASE_URL;
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
const damp = (a, b, k, dt) => lerp(a, b, 1 - Math.exp(-k * dt));
const easeIO = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

const SIZE = { [IPHONE.file]: 1150484, 'hdri/studio_small_09_1k.hdr': 1615248 };
export const SITES = [
  { name: 'forge-gym-demo', host: 'arfatarfart.github.io', src: 'work/scroll/forge-gym-demo.webp' },
  { name: 'medinest-pharmacy-demo', host: 'arfatarfart.github.io', src: 'work/scroll/medinest-pharmacy-demo.webp' },
  { name: 'stationery-point', host: 'arfatarfart.github.io', src: 'work/scroll/stationery-point.webp' },
  { name: 'NWF-WEB', host: 'arfatarfart.github.io', src: 'work/scroll/nwf-web.webp' },
];

async function fetchBytes(path, onChunk) {
  const res = await fetch(BASE + path);
  if (!res.ok) throw new Error(`${path} ${res.status}`);
  const reader = res.body && res.body.getReader ? res.body.getReader() : null;
  if (!reader) { const b = await res.arrayBuffer(); onChunk(b.byteLength); return b; }
  const chunks = []; let len = 0;
  for (;;) { const { done, value } = await reader.read(); if (done) break; chunks.push(value); len += value.length; onChunk(value.length); }
  const out = new Uint8Array(len); let o = 0;
  for (const c of chunks) { out.set(c, o); o += c.length; }
  return out.buffer;
}

export function latLonToVec3(lat, lon, r = 1) {
  const phi = THREE.MathUtils.degToRad(lon + 180), th = THREE.MathUtils.degToRad(lat);
  return new THREE.Vector3(-Math.cos(phi) * Math.cos(th) * r, Math.sin(th) * r, Math.sin(phi) * Math.cos(th) * r);
}
export function sunLatLon(date = new Date()) {
  const start = Date.UTC(date.getUTCFullYear(), 0, 0);
  const day = (date.getTime() - start) / 864e5;
  const lat = -23.44 * Math.cos(((2 * Math.PI) / 365) * (day + 10));
  const hours = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;
  return { lat, lon: (12 - hours) * 15 };
}

/* product photography studio as an environment: soft boxes and strips */
function studioEnvironment(renderer) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#020202');
  const panel = (w, h, pos, intensity, color = '#ffffff') => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), side: THREE.DoubleSide }));
    m.position.set(...pos); m.lookAt(0, 0, 0); scene.add(m);
  };
  panel(10, 2.4, [0, 7, 0.5], 3.4);
  panel(0.9, 9, [-6.5, 0.5, 2], 6.5);
  panel(0.6, 9, [6.5, 0.5, -1], 5, '#dbe8ff');
  panel(7, 1.2, [0, 1.2, 7], 1.2);
  panel(14, 0.7, [0, -3.4, -6], 0.8, '#ffc9a8');
  panel(2.2, 2.2, [4.2, 4, 4], 2.4);
  panel(0.5, 6, [-3, 2, -6], 3.2);
  const pm = new THREE.PMREMGenerator(renderer);
  const env = pm.fromScene(scene, 0.0, 0.1, 100, { size: 1024 }).texture;
  pm.dispose();
  return env;
}

const FinalShader = {
  uniforms: { tDiffuse: { value: null }, uVig: { value: 0.35 }, uCA: { value: 0.0025 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse; uniform float uVig, uCA; varying vec2 vUv;
    void main(){
      vec2 d = vUv - 0.5; float r2 = dot(d, d);
      vec2 o = d * uCA * (0.4 + r2 * 2.5);
      vec3 c = vec3(texture2D(tDiffuse, vUv + o).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv - o).b);
      c *= mix(1.0, smoothstep(0.95, 0.1, r2 * 2.2), uVig);
      gl_FragColor = vec4(c, 1.0);
    }`,
};

/* the slow light behind everything: soft lobes of colour drifting like a lit studio backdrop */
function auraMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 }, uOpacity: { value: 1 }, uAspect: { value: 1 },
      uC1: { value: new THREE.Color('#10264f') }, uC2: { value: new THREE.Color('#2e2216') }, uC3: { value: new THREE.Color('#1c1233') },
    },
    transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: /* glsl */ `
      uniform float uTime, uOpacity, uAspect; uniform vec3 uC1, uC2, uC3; varying vec2 vUv;
      float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      void main(){
        vec2 p = vUv - 0.5; p.x *= uAspect;
        float t = uTime * 0.045;
        vec2 a = vec2(sin(t * 1.3) * 0.42, cos(t * 1.1) * 0.16 - 0.08);
        vec2 b = vec2(cos(t * 0.9 + 1.0) * 0.5, sin(t * 1.7) * 0.22 + 0.12);
        vec2 c = vec2(sin(t * 0.7 + 2.0) * 0.36, -0.42 + cos(t) * 0.06);
        vec3 col = uC1 * exp(-dot(p - a, p - a) * 4.2) + uC2 * exp(-dot(p - b, p - b) * 5.0) + uC3 * exp(-dot(p - c, p - c) * 3.0);
        col += (h(gl_FragCoord.xy + fract(uTime)) - 0.5) / 255.0;
        gl_FragColor = vec4(col * uOpacity, 1.0);
      }`,
  });
}

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

const LAYOUT = {
  devices: (w, h, m) => (m ? { x: w * 0.14, y: h * 0.06, s: h * 0.36 } : { x: Math.max(w * 0.2, w * 0.5 - h * 0.42), y: -h * 0.02, s: h * 0.68 }),
  bust:   (w, h, m) => (m ? { x: w * 0.12, y: h * 0.22, s: h * 0.42 } : { x: w * 0.3, y: -h * 0.06, s: h * 0.8 }),
  laptop: (w, h, m) => (m ? { x: 0, y: h * 0.25, s: Math.min(w * 0.75, h * 0.34), ry: -0.25, rx: 0.2 } : { x: w * 0.25, y: -h * 0.04, s: h * 0.5, ry: -0.45, rx: 0.16 }),
  phone:  (w, h, m) => ({ x: m ? 0 : w * 0.25, y: 0, s: h * (m ? 0.5 : 0.62) }),
  board:  (w, h, m) => (m ? { x: 0, y: h * 0.26, s: Math.min(w * 0.8, h * 0.4), rx: 0.8 } : { x: w * 0.27, y: -h * 0.1, s: h * 0.68, rx: 0.78 }),
  hammer: (w, h, m) => (m ? { x: w * 0.2, y: h * 0.12, s: h * 0.28 } : { x: w * 0.36, y: h * 0.06, s: h * 0.34 }),
  sheet:  (w, h, m) => ({ x: 0, y: -h * (m ? 0.55 : 0.46), s: m ? 0.7 : 1.05, rx: 0.42 }),
  sphere: (w, h, m) => (m ? { x: 0, y: -h * 0.2, s: w * 0.3 } : { x: w * 0.22, y: 0, s: h * 0.3 }),
  rings:  (w, h, m) => (m ? { x: 0, y: h * 0.2, s: w * 0.34, rx: 1.05 } : { x: w * 0.26, y: 0.0, s: h * 0.36, rx: 1.05 }),
  earth:  (w, h, m) => (m ? { x: 0, y: h * 0.27, s: Math.min(w * 0.36, h * 0.2) } : { x: Math.max(w * 0.3, w * 0.5 - h * 0.36), y: h * 0.04, s: h * 0.33 }),
};

export class Stage {
  constructor(canvas, { onProgress, mobile, reduced } = {}) {
    this.canvas = canvas;
    this.onProgress = onProgress || (() => {});
    this.mobile = !!mobile;
    this.reduced = !!reduced;
    this.s = 0; this.sTarget = 0; this.heroT = 0; this.heroTs = 0;
    this.intro = 0; this.lights = 0;
    this.pointer = new THREE.Vector2(); this.ptr = new THREE.Vector2();
    this.pointerActive = false;
    this.stats = { fps: 60, ms: 16, tris: 0, calls: 0, points: 0, ready: 0 };
    this.shake = 0; this.earthDrag = 0; this.sphereSpin = { x: 0.25, y: 0 }; this.particleGain = 1;
    this.callouts = {}; this.sweepT = 3.5; this.logoFilter = 'all'; this.hoverLogo = -1;

    const r = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', alpha: false, stencil: false });
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.NeutralToneMapping;
    r.toneMappingExposure = 1.0;
    r.info.autoReset = false;
    this.maxDPR = this.mobile ? 1.5 : 1.75;
    this.dpr = Math.min(window.devicePixelRatio || 1, this.maxDPR);
    r.setPixelRatio(this.dpr);
    r.setClearColor('#000000', 1);
    this.renderer = r;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(30, 1, 0.1, 200);
    this.camera.position.set(0, 0, 7);
    this.studioEnv = studioEnvironment(r);

    const key = new THREE.DirectionalLight('#fff1e0', 1.2); key.position.set(-3, 4, 5);
    const rim = new THREE.PointLight('#ff5a1f', 22, 12, 2); rim.position.set(3, 2, -2.5);
    this.scene.add(key, rim); this.rim = rim;
    RectAreaLightUniformsLib.init();
    this.area = {
      key: new THREE.RectAreaLight('#fff5ea', 0, 3.2, 3.6),
      rim: new THREE.RectAreaLight('#dbe7ff', 0, 1.0, 5.2),
      rim2: new THREE.RectAreaLight('#ffe2c8', 0, 1.0, 5.2),
      sweep: new THREE.RectAreaLight('#ffffff', 0, 0.35, 6),
    };
    this.area.key.position.set(-3.6, 2.4, 3.8);
    this.area.rim.position.set(4.2, 0.6, -2.6);
    this.area.rim2.position.set(-4.2, 0.4, -2.6);
    this.area.sweep.position.set(-5, 0.6, 3.2);
    Object.values(this.area).forEach((l) => { l.lookAt(0, 0, 0); this.scene.add(l); });

    // layers drawn before the 3D scene: aura light, hero wordmark, fluid ink
    this.bg = new THREE.Scene();
    this.bgCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.aura = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), auraMaterial());
    this.aura.frustumCulled = false; this.aura.renderOrder = 0;
    this.title = new HeroTitle();
    this.titleMesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), titleMaterial(this.title.texture));
    this.titleMesh.frustumCulled = false; this.titleMesh.renderOrder = 1;
    this.fluid = new Fluid(r, { sim: this.mobile ? 96 : 128, dye: this.mobile ? 512 : 1024 });
    this.ink = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), inkMaterial(this.fluid));
    this.ink.frustumCulled = false; this.ink.renderOrder = 2;
    this.bg.add(this.aura, this.titleMesh, this.ink);
    this.inkT = 0; this.lastPhone = null; this.lastPtr = null;

    this.N = this.mobile ? 256 * 48 : 256 * 96;
    this.W = 256;
    this.field = new MorphField(this.N, this.W);
    this.stats.particles = this.N;
    this.sparks = new Sparks(this.mobile ? 220 : 480);
    this.scene.add(this.field.points, this.sparks.points);

    this.shots = SHOTS.map((def, index) => {
      const pivot = new THREE.Group(), spin = new THREE.Group(), norm = new THREE.Group();
      pivot.add(spin); spin.add(norm); pivot.visible = false;
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

    if (!this.mobile) {
      const rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: 4 });
      this.composer = new EffectComposer(r, rt);
      this.composer.addPass(new RenderPass(this.bg, this.bgCam));
      const main = new RenderPass(this.scene, this.camera);
      main.clear = false; main.clearDepth = true;
      this.composer.addPass(main);
      this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.42, 0.55, 0.97);
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
    const [phoneBuf, hdrBuf] = await Promise.all([
      fetchBytes(IPHONE.file, (n) => bump(n, 'iphone_15_pro_max.glb')),
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
    this.phoneScene = (await this.gltf.parseAsync(phoneBuf, BASE + 'models/')).scene;
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

  prepShot(shot, uniforms, root = shot.spin) {
    shot.uniforms = uniforms;
    shot.meshes = [];
    root.traverse((o) => {
      if (!o.isMesh || !o.visible) return;
      shot.meshes.push(o);
      (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => patchForge(m, uniforms));
    });
  }
  finishShot(shot, lift = 1.3) {
    this.layoutShot(shot);
    shot.pivot.updateMatrixWorld(true);
    shot.tex = toTextures(sampleModel(shot.spin, this.N, { lift }), this.W);
    shot.mesh = shot.spin; shot.ready = true;
    this._fromTex = null; this._B = null;
  }

  /* Hero: one real iPhone in holographic chrome, floating in ink */
  mountDevices() {
    const shot = this.byId.devices;
    this.safari = new SafariScreen(SITES.map((x) => ({ ...x, src: BASE + x.src })));
    const front = makeIPhone(this.phoneScene, { screenTexture: this.safari.texture, envMap: this.studioEnv, chrome: true });
    shot.spin.add(front);
    shot.front = front;
    const u = forgeUniforms(); u.uNoiseScale.value = 4.5;
    this.prepShot(shot, u);
    this.finishShot(shot, 1.25);
  }

  /* Apps: a single iPhone running an app you can drag */
  mountApps() {
    const shot = this.byId.phone;
    this.app = new ShipApp();
    const phone = makeIPhone(this.phoneScene, { screenTexture: this.app.texture, finish: 'desert', envMap: this.studioEnv });
    shot.spin.add(phone);
    shot.phone = phone;
    this.appScreen = phone.userData.screen;
    const u = forgeUniforms(); u.uNoiseScale.value = 4.5;
    this.prepShot(shot, u);
    this.app.draw(0);
    this.finishShot(shot, 1.25);
  }

  mountModel(shot, root) {
    const box = new THREE.Box3().setFromObject(root);
    const size = box.getSize(new THREE.Vector3()), center = box.getCenter(new THREE.Vector3());
    const k = 1 / (shot.norm === 'height' ? size.y : Math.max(size.x, size.y, size.z));
    root.position.copy(center).multiplyScalar(-k);
    root.scale.setScalar(k);
    shot.norm.add(root);
    if (shot.id === 'hammer') {
      shot.norm.position.y = 0.5;
      shot.head = new THREE.Object3D(); shot.head.position.set(0.04, 0.44, 0); root.parent.add(shot.head);
      shot.spin.rotation.z = Math.PI / 2 - 0.5;
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
    const geo = mesh.geometry, pos = geo.attributes.position;
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
    this.screen = new LaptopScreen(1024, Math.round(1024 / aspect));
    this.screenTex = new THREE.CanvasTexture(this.screen.canvas);
    this.screenTex.colorSpace = THREE.SRGBColorSpace;
    this.screenTex.anisotropy = 8;
    mesh.material = new THREE.MeshStandardMaterial({ color: '#000000', emissive: '#ffffff', emissiveMap: this.screenTex, emissiveIntensity: 1.2, roughness: 0.18, metalness: 0 });
  }

  /* Stack: real brand marks extruded into glossy 3D, orbiting the problem */
  buildLogos(items) {
    const shot = this.byId.sphere;
    const loader = new SVGLoader();
    const group = new THREE.Group();
    const n = items.length, ga = Math.PI * (3 - Math.sqrt(5));
    this.logos = items.map((it, i) => {
      const data = loader.parse(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><g transform="matrix(1 0 0 -1 0 24)"><path d="${it.path}"/></g></svg>`);
      const shapes = data.paths.flatMap((p) => SVGLoader.createShapes(p));
      const geo = new THREE.ExtrudeGeometry(shapes, { depth: 3, bevelEnabled: true, bevelThickness: 0.7, bevelSize: 0.35, bevelSegments: 3, curveSegments: 10 });
      geo.computeBoundingBox(); const c = geo.boundingBox.getCenter(new THREE.Vector3());
      geo.translate(-c.x, -c.y, -c.z);
      geo.scale(1 / 24, 1 / 24, 1 / 24);
      const col = new THREE.Color(`#${it.hex}`);
      const hsl = {}; col.getHSL(hsl);
      if (hsl.l < 0.22) col.set('#e9e9ee');
      const mat = new THREE.MeshPhysicalMaterial({ color: col, metalness: 0.25, roughness: 0.26, clearcoat: 1, clearcoatRoughness: 0.08, envMap: this.studioEnv, envMapIntensity: 1.2 });
      const mesh = new THREE.Mesh(geo, mat);
      const y = 1 - (i / (n - 1)) * 2, rr = Math.sqrt(1 - y * y), th = ga * i;
      const base = new THREE.Vector3(Math.cos(th) * rr, y, Math.sin(th) * rr).multiplyScalar(1.22);
      mesh.position.copy(base);
      mesh.scale.setScalar(0.2);
      mesh.userData = { i, cat: it.cat, base, title: it.title };
      group.add(mesh);
      return mesh;
    });
    shot.norm.add(group);
    shot.logoGroup = group;
    const u = forgeUniforms(); u.uNoiseScale.value = 5.0;
    this.prepShot(shot, u, group);
    shot.mesh = group;
  }
  pickLogo(cx, cy) {
    if (!this.logos || !this.byId.sphere.pivot.visible) return -1;
    const ndc = new THREE.Vector2((cx / window.innerWidth) * 2 - 1, -(cy / window.innerHeight) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const hit = this.raycaster.intersectObjects(this.logos, false)[0];
    return hit ? hit.object.userData.i : -1;
  }

  async loadEarth() {
    const tl = new THREE.TextureLoader();
    const L = (f, srgb = true) => tl.loadAsync(BASE + 'textures/earth/' + f).then((t) => { if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 16; return t; });
    const [day, night, water, clouds, normal, sky] = await Promise.all([
      L('earth_day_4096.jpg'), L('earth_night_4096.jpg'), L('earth_water_2048.jpg', false), L('earth_clouds_2048.jpg', false), L('earth_normal_2048.jpg', false), L('night_sky_4096.jpg'),
    ]);
    clouds.wrapS = THREE.RepeatWrapping;
    const shot = this.byId.earth;
    const uniforms = forgeUniforms({ uSunWorld: { value: new THREE.Vector3(1, 0, 0) }, uAtmo: { value: 1 } });
    uniforms.uNoiseScale.value = 3.0;
    shot.uniforms = uniforms;
    const mat = earthMaterial({ day, night, water, clouds, normal }, uniforms);
    this.earthMat = mat;
    const sphere = new THREE.Mesh(new THREE.SphereGeometry(1, 160, 100), mat);
    this.cloudMat = cloudMaterial({ clouds }, uniforms);
    const cloudLayer = new THREE.Mesh(new THREE.SphereGeometry(1.012, 128, 80), this.cloudMat);
    const atmo = new THREE.Mesh(new THREE.SphereGeometry(1.12, 96, 64), atmosphereMaterial(uniforms));
    cloudLayer.userData.skipSample = atmo.userData.skipSample = true;
    shot.norm.add(sphere, cloudLayer, atmo);
    shot.meshes = [sphere];
    const skyMesh = new THREE.Mesh(new THREE.SphereGeometry(60, 64, 32), new THREE.MeshBasicMaterial({ map: sky, side: THREE.BackSide, transparent: true, opacity: 0, depthWrite: false }));
    skyMesh.renderOrder = -50; skyMesh.visible = false;
    this.scene.add(skyMesh); this.sky = skyMesh;
    const tz = this.visitor || { lat: 20, lon: 0 };
    const marker = new THREE.Group();
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.014, 16, 12), new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false }));
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.026, 0.032, 48), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, side: THREE.DoubleSide, toneMapped: false, depthWrite: false }));
    dot.userData.skipSample = ring.userData.skipSample = true;
    marker.add(dot, ring);
    marker.position.copy(latLonToVec3(tz.lat, tz.lon, 1.013));
    marker.lookAt(latLonToVec3(tz.lat, tz.lon, 2));
    shot.norm.add(marker);
    this.marker = { group: marker, ring };
    const iss = new THREE.Group();
    const issDot = new THREE.Mesh(new THREE.SphereGeometry(0.016, 16, 12), new THREE.MeshBasicMaterial({ color: '#ffd28a', toneMapped: false }));
    const issGlow = new THREE.Mesh(new THREE.SphereGeometry(0.045, 16, 12), new THREE.MeshBasicMaterial({ color: '#ffb347', transparent: true, opacity: 0.25, depthWrite: false, toneMapped: false }));
    iss.add(issDot, issGlow); iss.visible = false;
    issDot.userData.skipSample = issGlow.userData.skipSample = true;
    shot.norm.add(iss);
    this.iss = { group: iss, path: null };
    const face = latLonToVec3(0, tz.lon);
    this.earthFace = Math.atan2(-face.x, face.z);
    this.earthTilt = THREE.MathUtils.degToRad(tz.lat) * 0.55;
    this.layoutShot(shot);
    shot.pivot.updateMatrixWorld(true);
    shot.tex = toTextures(earthTarget(this.N, day.image, night.image), this.W);
    shot.mesh = sphere; shot.ready = true;
    this._fromTex = null; this._B = null;
  }

  /** live ISS telemetry: current fix plus the next stretch of its orbit */
  setISS(now, path) {
    if (!this.iss) return;
    this.iss.group.position.copy(latLonToVec3(now.latitude, now.longitude, 1 + Math.max(0.05, now.altitude / 6371)));
    this.iss.group.visible = true;
    this.issInfo = now;
    if (path?.length > 2) {
      if (this.iss.path) { this.iss.path.geometry.dispose(); this.iss.path.parent.remove(this.iss.path); }
      const pts = path.map((p) => latLonToVec3(p.latitude, p.longitude, 1 + Math.max(0.05, p.altitude / 6371)));
      const geo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 240, 0.0035, 6, false);
      const line = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: '#ffcf8a', transparent: true, opacity: 0.55, depthWrite: false, toneMapped: false }));
      line.userData.skipSample = true;
      this.byId.earth.norm.add(line);
      this.iss.path = line;
    }
  }

  /* ---------------------------------------------------------------- layout */
  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.mobile = w < 760;
    this.renderer.setSize(w, h, false);
    if (this.composer) { this.composer.setPixelRatio(this.dpr); this.composer.setSize(w, h); }
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.viewH = 2 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) * this.camera.position.z;
    this.viewW = this.viewH * this.camera.aspect;
    this.aura.material.uniforms.uAspect.value = w / h;
    if (this.title) this.title.resize();
    if (this.fluid) { this.fluid.resize(w / h); this.ink.material.uniforms.uTexel.value = this.fluid.dyeTexel; }
    this.field.uniforms.uPR.value = this.dpr;
    this.field.uniforms.uSize.value = (this.mobile ? 20 : 24) * (h / 900);
    this.sparks.uniforms.uPR.value = this.dpr;
    this.shots.forEach((s) => this.layoutShot(s));
  }
  layoutShot(shot) {
    const L = LAYOUT[shot.id](this.viewW, this.viewH, this.mobile);
    const anchor = !this.mobile && shot.id === 'sphere' ? document.getElementById('orb') : null;
    if (anchor) { const r = anchor.getBoundingClientRect(); if (r.width) L.x = ((r.left + r.width / 2) / window.innerWidth - 0.5) * this.viewW; }
    shot.pivot.position.set(L.x || 0, L.y || 0, L.z || 0);
    shot.pivot.scale.setScalar(L.s || 1);
    shot.pivot.rotation.set(L.rx || 0, L.ry || 0, L.rz || 0);
    shot.layout = L;
  }
  screenToWorld(x, y) {
    const ndc = new THREE.Vector2((x / window.innerWidth) * 2 - 1, -(y / window.innerHeight) * 2 + 1);
    const rc = new THREE.Raycaster(); rc.setFromCamera(ndc, this.camera);
    const p = new THREE.Vector3(); rc.ray.intersectPlane(this.plane, p); return p;
  }

  /* ---------------------------------------------------------------- theme */
  setTheme(t, dur = 0.9) {
    const fu = this.field.uniforms;
    const bg = new THREE.Color(); this.renderer.getClearColor(bg);
    const target = new THREE.Color(t.bg), acc = new THREE.Color(t.accent);
    const srgb = (hex) => { const c = new THREE.Color(hex); const o = {}; c.getRGB(o, THREE.SRGBColorSpace); return new THREE.Vector3(o.r, o.g, o.b); };
    const accSRGB = srgb(t.accent), inkS = srgb(t.fg);
    gsap.to(bg, { r: target.r, g: target.g, b: target.b, duration: dur, ease: 'power2.out', onUpdate: () => this.renderer.setClearColor(bg) });
    gsap.to(fu.uInk.value, { x: inkS.x, y: inkS.y, z: inkS.z, duration: dur });
    gsap.to(fu.uInkMix, { value: t.dark ? 0 : 0.82, duration: dur });
    gsap.to(fu.uAccent.value, { x: accSRGB.x, y: accSRGB.y, z: accSRGB.z, duration: dur });
    gsap.to(this, { particleGain: t.particles ?? 1, duration: dur });
    gsap.to(this.rim.color, { r: acc.r, g: acc.g, b: acc.b, duration: dur });
    gsap.to(this.rim, { intensity: t.dark ? 22 : 2, duration: dur });
    gsap.to(this.scene, { environmentIntensity: t.env ?? 0.9, duration: dur });
    if (this.bloom) gsap.to(this.bloom, { strength: t.dark ? 0.42 : 0.08, duration: dur });
    if (this.finalPass) gsap.to(this.finalPass.uniforms.uVig, { value: t.dark ? 0.35 : 0.06, duration: dur });
    const au = this.aura.material.uniforms;
    const pal = (t.aura || [t.accent, t.accent, t.fg]).map((h) => new THREE.Color(h));
    const k = t.aura ? 1 : 0.08;
    ['uC1', 'uC2', 'uC3'].forEach((key, i) => gsap.to(au[key].value, { r: pal[i].r * k, g: pal[i].g * k, b: pal[i].b * k, duration: dur }));
    gsap.to(au.uOpacity, { value: t.dark ? 1 : 0, duration: dur });
    for (const s of this.shots) if (s.uniforms) gsap.to(s.uniforms.uEdge.value, { r: acc.r, g: acc.g, b: acc.b, duration: dur });
    if (this.screen) this.screen.accent = t.accent;
  }

  /* ---------------------------------------------------------------- interactions */
  setPointer(nx, ny) { this.pointer.set(nx, ny); this.pointerActive = true; }
  pickScreen(cx, cy) {
    if (!this.appScreen || !this.byId.phone.pivot.visible) return null;
    const ndc = new THREE.Vector2((cx / window.innerWidth) * 2 - 1, -(cy / window.innerHeight) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const hit = this.raycaster.intersectObject(this.appScreen, false)[0];
    return hit ? hit.uv : null;
  }
  celebrate() {
    const p = new THREE.Vector3(); this.byId.phone.phone.localToWorld(p.set(0, -0.32, 0.05));
    this.sparks.fire(p);
  }

  /**
   * The hammer travels to a point on the page and strikes it. The swing
   * pivots at the end of the handle, placed so the head lands exactly on
   * the target at the bottom of the arc.
   */
  strikeAt(index, sx, sy) {
    const s = this.byId.hammer;
    if (!s.ready || !s.head) return;
    const T = this.screenToWorld(sx, sy);
    const sc = s.pivot.scale.x;
    const hit = Math.PI / 2 + 0.04;
    const head = new THREE.Vector3(0.04, 0.94, 0).applyAxisAngle(new THREE.Vector3(0, 0, 1), hit).multiplyScalar(sc);
    const P = T.clone().sub(head);
    gsap.killTweensOf(s.pivot.position); gsap.killTweensOf(s.spin.rotation);
    gsap.timeline()
      .to(s.pivot.position, { x: P.x, y: P.y + sc * 0.06, duration: 0.42, ease: 'power3.inOut' }, 0)
      .to(s.spin.rotation, { z: Math.PI / 2 - 1.15, duration: 0.42, ease: 'power2.out' }, 0)
      .to(s.pivot.position, { y: P.y, duration: 0.16, ease: 'power2.in' }, 0.42)
      .to(s.spin.rotation, {
        z: hit, duration: 0.16, ease: 'power4.in',
        onComplete: () => { this.sparks.fire(T); this.shake = 1; this.onStrike && this.onStrike(index); },
      }, 0.42)
      .to(s.spin.rotation, { z: Math.PI / 2 - 0.5, duration: 0.8, ease: 'elastic.out(1, 0.45)' });
  }
  strike(index = 0) {
    const s = this.byId.hammer;
    if (!s.ready) return;
    gsap.killTweensOf(s.spin.rotation);
    gsap.timeline()
      .to(s.spin.rotation, { z: Math.PI / 2 - 1.15, duration: 0.3, ease: 'power2.out' })
      .to(s.spin.rotation, { z: Math.PI / 2 + 0.04, duration: 0.15, ease: 'power4.in', onComplete: () => { const p = new THREE.Vector3(); s.head.getWorldPosition(p); this.sparks.fire(p); this.shake = 1; this.onStrike && this.onStrike(index); } })
      .to(s.spin.rotation, { z: Math.PI / 2 - 0.5, duration: 0.8, ease: 'elastic.out(1, 0.45)' });
  }

  setXray(on) {
    for (const s of this.shots) {
      if (!s.meshes) continue;
      for (const m of s.meshes) {
        if (!m.userData.wire && on) {
          const w = new THREE.Mesh(m.geometry, new THREE.MeshBasicMaterial({ color: '#ffffff', wireframe: true, transparent: true, opacity: 0.14, depthWrite: false, toneMapped: false }));
          w.userData.skipSample = true; w.renderOrder = 3; m.add(w); m.userData.wire = w;
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
    this.aura.material.uniforms.uTime.value = time;
    this.sparks.tick(dt);

    this.s = Math.abs(this.sTarget - this.s) < 1e-4 ? this.sTarget : damp(this.s, this.sTarget, 5.5, dt);
    this.heroTs = damp(this.heroTs, this.heroT, 4.5, dt);
    this.ptr.x = damp(this.ptr.x, this.pointer.x, 2.6, dt);
    this.ptr.y = damp(this.ptr.y, this.pointer.y, 2.6, dt);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    this.raycaster.ray.intersectPlane(this.plane, this.mouseWorld);
    if (this.pointerActive) fu.uMouse.value.lerp(this.mouseWorld, 0.15);

    const n = this.shots.length;
    const s = clamp(this.s, 0, n - 1);
    let i = Math.floor(s), t = s - i;
    if (i >= n - 1) { i = n - 1; t = 0; }
    const j = Math.min(i + 1, n - 1);
    let A = this.shots[i], B = this.shots[j];
    let morph = smooth(0.08, 0.92, t);
    let opacity = Math.max(lerp(A.rest, B.rest, smooth(0, 1, t)), Math.pow(Math.sin(Math.PI * t), 0.6));
    let fromTex = A.tex, fromM = null;
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
    this.field.points.visible = fu.uOpacity.value > 0.003;

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

    const dv = this.byId.devices, ph = this.byId.phone;
    const studio = Math.max(dv.vis || 0, ph.vis || 0);
    const L = this.lights;
    this.sweepT += dt;
    const sp = (this.sweepT % 7.5) / 2.6;
    const sweepOn = sp < 1 ? Math.sin(Math.PI * sp) : 0;
    const tgt = (dv.vis || 0) >= (ph.vis || 0) ? dv.pivot.position : ph.pivot.position;
    this.area.sweep.position.set(tgt.x + lerp(-3.8, 3.8, easeIO(clamp(sp))), tgt.y + 0.8, 3.2);
    this.area.sweep.lookAt(tgt);
    this.area.key.intensity = 5 * studio * smooth(0.0, 0.35, L);
    this.area.rim.intensity = 7 * studio * smooth(0.2, 0.6, L);
    this.area.rim2.intensity = 5 * studio * smooth(0.35, 0.75, L);
    this.area.sweep.intensity = 24 * studio * sweepOn * smooth(0.8, 1, L);
    if (this.safari && L > 0.45) this.safari.boot = Math.min(1.01, this.safari.boot + dt / 1.4);
    if (this.sky) { const ev = this.byId.earth.vis || 0; this.sky.material.opacity = ev * 0.85; this.sky.visible = ev > 0.01; this.sky.rotation.y = time * 0.004; }

    this.screenAcc += dt;
    if (this.screenAcc > 1 / 30) {
      const sdt = this.screenAcc; this.screenAcc = 0;
      if (this.safari && dv.pivot.visible) this.safari.draw(sdt);
      if (this.app && ph.pivot.visible) this.app.draw(sdt);
      if (this.screen && this.byId.laptop.pivot.visible) { this.screen.draw(sdt); this.screenTex.needsUpdate = true; }
    }
    if (this.marker) { const k = (time * 0.7) % 1; this.marker.ring.scale.setScalar(1 + k * 2.4); this.marker.ring.material.opacity = 1 - k; }
    if (this.earthMat && this.byId.earth.pivot.visible) {
      const sun = sunLatLon(new Date());
      const sv = latLonToVec3(sun.lat, sun.lon);
      this.earthMat.uniforms.uSun.value.copy(sv);
      this.cloudMat.uniforms.uSun.value.copy(sv);
      const shift = (time * 0.0009) % 1;
      this.earthMat.uniforms.uCloudShift.value = shift; this.cloudMat.uniforms.uCloudShift.value = shift;
      const e = this.byId.earth;
      e.uniforms.uSunWorld.value.copy(sv.clone().applyQuaternion(e.spin.getWorldQuaternion(new THREE.Quaternion())));
      if (this.iss?.group.visible) {
        const p = new THREE.Vector3(); this.iss.group.getWorldPosition(p);
        const q = p.clone().project(this.camera);
        const facing = p.clone().sub(e.pivot.position).normalize().dot(this.camera.position.clone().sub(p).normalize());
        this.issScreen = { x: (q.x * 0.5 + 0.5) * window.innerWidth, y: (-q.y * 0.5 + 0.5) * window.innerHeight, f: facing > 0 ? (e.vis || 0) : 0 };
        this.iss.group.children[1].scale.setScalar(1 + Math.sin(time * 3) * 0.2);
      }
    }
    this.updateInk(dt, time, dv);

    this.shake *= Math.pow(0.0008, dt);
    const sx = (Math.random() - 0.5) * 0.05 * this.shake, sy = (Math.random() - 0.5) * 0.05 * this.shake;
    this.camera.position.x = this.ptr.x * 0.12 + sx;
    this.camera.position.y = this.ptr.y * 0.08 + sy;
    this.camera.lookAt(0, 0, 0);

    this.renderer.info.reset();
    if (this.composer) this.composer.render(dt);
    else {
      const r = this.renderer; r.autoClear = false; r.setRenderTarget(null); r.clear();
      r.render(this.bg, this.bgCam); r.clearDepth(); r.render(this.scene, this.camera); r.autoClear = true;
    }

    const info = this.renderer.info.render;
    this.stats.tris = info.triangles; this.stats.calls = info.calls; this.stats.points = info.points;
    this.frames++; this.fpsT += dt;
    if (this.fpsT >= 0.5) {
      this.stats.fps = Math.round(this.frames / this.fpsT);
      this.stats.ms = +((1000 * this.fpsT) / this.frames).toFixed(1);
      this.frames = 0; this.fpsT = 0;
      if (this.stats.fps < 45 && document.visibilityState === 'visible' && time > 6) this.lowT += 0.5; else this.lowT = 0;
      if (this.lowT >= 1.5) {
        if (this.dpr > 1.25) { this.dpr = Math.max(1.25, this.dpr - 0.25); this.renderer.setPixelRatio(this.dpr); this.resize(); }
        else if (this.bloom && this.bloom.enabled) this.bloom.enabled = false;
        else if (this.dpr > 1) { this.dpr = 1; this.renderer.setPixelRatio(1); this.resize(); }
        this.lowT = 0;
      }
    }
  }

  /*
    Ink. It only runs while the hero is on screen. The cursor drags ink with
    its real velocity; the phone sheds slow swirling ink around its outline,
    so the liquid looks pushed by the object rather than painted on.
  */
  updateInk(dt, time, dv) {
    const vis = dv.vis || 0;
    const show = vis * clamp(1 - (window.scrollY / window.innerHeight) * 0.9);
    this.titleMesh.visible = this.ink.visible = show > 0.005;
    this.titleMesh.material.uniforms.uOpacity.value = show;
    this.titleMesh.material.uniforms.uShift.value = (window.scrollY / window.innerHeight) * 1.1;
    this.ink.material.uniforms.uOpacity.value = show;
    if (!this.titleMesh.visible) return;
    this.title.draw();
    const f = this.fluid;
    // cursor
    const ptr = { x: (this.pointer.x + 1) / 2, y: (this.pointer.y + 1) / 2 };
    if (this.pointerActive && this.lastPtr) {
      const vx = (ptr.x - this.lastPtr.x) / Math.max(dt, 1e-3), vy = (ptr.y - this.lastPtr.y) / Math.max(dt, 1e-3);
      if (Math.abs(vx) + Math.abs(vy) > 0.02) f.splat(ptr.x, ptr.y, vx * 900, vy * 900, 0.22, 0.0016);
    }
    this.lastPtr = ptr;
    // the phone: centre motion plus a slow orbit of ink around its silhouette
    if (dv.front && dv.pivot.visible) {
      const c = new THREE.Vector3(); dv.front.getWorldPosition(c);
      const q = c.clone().project(this.camera);
      const pc = { x: q.x * 0.5 + 0.5, y: q.y * 0.5 + 0.5 };
      const hgt = (dv.pivot.scale.x / this.viewH) * 0.5, wid = hgt * 0.5 * (this.viewH / this.viewW);
      if (this.lastPhone) {
        const vx = (pc.x - this.lastPhone.x) / Math.max(dt, 1e-3), vy = (pc.y - this.lastPhone.y) / Math.max(dt, 1e-3);
        if (Math.abs(vx) + Math.abs(vy) > 0.01) f.splat(pc.x, pc.y, vx * 700, vy * 700, 0.05, 0.004);
      }
      this.lastPhone = pc;
      this.inkT += dt;
      while (this.inkT > 0.085) {
        this.inkT -= 0.085;
        const a = time * 1.7 + Math.random() * 6.28;
        const ex = pc.x + Math.cos(a) * wid * 1.25, ey = pc.y + Math.sin(a) * hgt * 1.02;
        const sp = 260 + Math.random() * 220;
        const mob = this.mobile ? 0.4 : 1;
        f.splat(ex, ey, -Math.sin(a) * sp + Math.cos(a) * 60, Math.cos(a) * sp + Math.sin(a) * 60, 0.11 * mob * smooth(0.35, 0.9, this.lights), this.mobile ? 0.0009 : 0.0016);
      }
    }
    f.step(Math.min(dt, 1 / 30));
    this.ink.material.uniforms.uDye.value = f.texture;
  }

  /** a burst of ink when the phone first appears */
  inkBurst() {
    const dv = this.byId.devices;
    if (!dv.front) return;
    const c = new THREE.Vector3(); dv.front.getWorldPosition(c);
    const q = c.project(this.camera);
    const x = q.x * 0.5 + 0.5, y = q.y * 0.5 + 0.5;
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      this.fluid.splat(x + Math.cos(a) * 0.03, y + Math.sin(a) * 0.05, Math.cos(a) * 1600, Math.sin(a) * 1600, this.mobile ? 0.35 : 0.7, this.mobile ? 0.0015 : 0.003);
    }
  }

  animateShots(time, dt) {
    const px = this.ptr.x, py = this.ptr.y;
    const b = this.byId;
    // hero: the phone floats, sways and leans toward the hand, never still
    const dv = b.devices;
    if (dv.layout && dv.front) {
      const L = dv.layout;
      dv.pivot.position.set(L.x + Math.sin(time * 0.4) * 0.05, L.y + Math.sin(time * 0.9) * 0.04, 0);
      dv.spin.rotation.set(0.14 - py * 0.22 + Math.sin(time * 0.6) * 0.06, -0.42 + px * 0.6 + Math.sin(time * 0.3) * 0.78, 0.18 + Math.sin(time * 0.5) * 0.07);
    }
    const ph = b.phone;
    if (ph.layout) {
      const slot = this.slot || (this.slot = document.querySelector('.phone-slot'));
      if (slot) {
        const r = slot.getBoundingClientRect();
        if (r.height) {
          ph.pivot.position.set(((r.left + r.width / 2) / window.innerWidth - 0.5) * this.viewW, (0.5 - (r.top + r.height / 2) / window.innerHeight) * this.viewH, 0);
          ph.pivot.scale.setScalar((r.height / window.innerHeight) * this.viewH * 0.95);
        }
      }
      ph.spin.rotation.set(0.03 - py * 0.05, -0.14 + px * 0.12, 0);
      ph.spin.position.y = Math.sin(time * 0.9) * 0.008;
    }
    b.bust.spin.rotation.y = damp(b.bust.spin.rotation.y, -0.55 + px * 0.45, 3, dt);
    b.bust.spin.rotation.x = damp(b.bust.spin.rotation.x, -py * 0.1, 3, dt);
    b.laptop.spin.rotation.y = damp(b.laptop.spin.rotation.y, px * 0.3 + Math.sin(time * 0.4) * 0.06, 3, dt);
    b.laptop.spin.position.y = Math.sin(time * 0.9) * 0.02;
    b.board.spin.rotation.y = time * 0.12 + px * 0.25;
    b.sheet.spin.rotation.y = Math.sin(time * 0.1) * 0.08;
    // logo orbit: drag spins it, filters pull the right tools to the front
    const sh = b.sphere;
    sh.spin.rotation.set(this.sphereSpin.x, this.sphereSpin.y, 0);
    if (this.logos && sh.pivot.visible) {
      const inv = sh.spin.quaternion.clone().invert();
      const sel = this.logos.filter((l) => this.logoFilter !== 'all' && l.userData.cat === this.logoFilter);
      const cols = Math.max(1, Math.ceil(Math.sqrt(sel.length))), rows = Math.ceil(sel.length / cols);
      this.logos.forEach((l) => {
        let tgt = l.userData.base, sc = 0.2;
        if (this.logoFilter !== 'all') {
          const k = sel.indexOf(l);
          if (k >= 0) { tgt = new THREE.Vector3(((k % cols) - (cols - 1) / 2) * 0.46, ((rows - 1) / 2 - Math.floor(k / cols)) * 0.46, 1.5).applyQuaternion(inv); sc = 0.27; }
          else { tgt = l.userData.base.clone().multiplyScalar(0.8); sc = 0.11; }
        }
        if (l.userData.i === this.hoverLogo) sc *= 1.3;
        l.position.lerp(tgt, 1 - Math.exp(-6 * dt));
        l.scale.setScalar(damp(l.scale.x, sc, 8, dt));
        l.lookAt(this.camera.position);
        l.rotateY(Math.sin(time * 0.8 + l.userData.i) * 0.28);
      });
    }
    b.rings.spin.rotation.y = time * 0.06;
    b.rings.spin.rotation.z = Math.sin(time * 0.3) * 0.05;
    const lift = this.footerT || 0;
    if (b.earth.layout) {
      b.earth.pivot.position.y = b.earth.layout.y + lift * this.viewH * (this.mobile ? 0.12 : 0.26);
      b.earth.pivot.position.x = b.earth.layout.x + lift * this.viewW * (this.mobile ? 0 : 0.06);
    }
    if (this.earthFace !== undefined) {
      b.earth.spin.rotation.y = this.earthFace + this.earthDrag + Math.sin(time * 0.08) * 0.1 + px * 0.12;
      b.earth.spin.rotation.x = this.earthTilt + py * 0.06;
    }
  }
}
