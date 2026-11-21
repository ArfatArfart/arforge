import * as THREE from 'three';
import gsap from 'gsap';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { MorphField, Embers, Sparks } from './particles.js';
import { patchForge, forgeUniforms, earthMaterial, atmosphereMaterial } from './materials.js';
import { sampleModel, dustTarget, sheetTarget, sphereTarget, ringsTarget, earthTarget, toTextures } from './targets.js';
import { LaptopScreen } from './screen.js';

const BASE = import.meta.env.BASE_URL;
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;

// Byte sizes of the critical assets, used when a server hides Content-Length.
const SIZE = { 'models/marble_bust_01.glb': 847948, 'hdri/studio_small_09_1k.hdr': 1615248 };

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
  Shot list. Order matches the page. `rest` is how visible the particle field
  is when the shot is settled: 0 for real meshes (the mesh is the hero),
  1 for procedural shots (the particles are the hero).
*/
const SHOTS = [
  { id: 'bust', file: 'models/marble_bust_01.glb', norm: 'height', rest: 0 },
  { id: 'dust', proc: dustTarget, rest: 1 },
  { id: 'laptop', file: 'models/classic_laptop.glb', norm: 'max', rest: 0 },
  { id: 'watch', file: 'models/digital_wrist_watch.glb', norm: 'max', rest: 0 },
  { id: 'board', file: 'models/circuit_board.glb', norm: 'max', rest: 0 },
  { id: 'hammer', file: 'models/cross_pein_hammer.glb', norm: 'height', rest: 0 },
  { id: 'sheet', proc: sheetTarget, rest: 1 },
  { id: 'sphere', proc: sphereTarget, rest: 1 },
  { id: 'rings', proc: ringsTarget, rest: 1 },
  { id: 'earth', earth: true, rest: 0 },
];

// Layout per shot in world units of the visible frustum at z = 0.
const LAYOUT = {
  bust:   (w, h, m) => m ? { x: w * 0.12, y: h * 0.23, s: h * 0.42 } : { x: Math.max(w * 0.2, w * 0.5 - h * 0.42), y: -h * 0.03, s: h * 0.84 },
  dust:   () => ({ x: 0, y: 0, s: 1 }),
  laptop: (w, h, m) => m ? { x: 0, y: h * 0.25, s: Math.min(w * 0.75, h * 0.34), ry: -0.25, rx: 0.2 } : { x: w * 0.25, y: -h * 0.04, s: h * 0.5, ry: -0.45, rx: 0.16 },
  watch:  (w, h, m) => m ? { x: 0, y: h * 0.25, s: h * 0.36 } : { x: w * 0.07, y: 0, s: h * 0.7 },
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
    this.s = 0;
    this.intro = 0;
    this.pointer = new THREE.Vector2(0, 0);
    this.pointerActive = false;
    this.heroPointerY = null;
    this.stats = { fps: 60, ms: 16, tris: 0, calls: 0, particles: 0, ready: 0 };
    this.xray = false;
    this.shake = 0;
    this.earthDrag = 0;
    this.sphereSpin = { x: 0, y: 0 };
    this.particleGain = 1;

    const r = new THREE.WebGLRenderer({ canvas, antialias: !this.mobile, powerPreference: 'high-performance', alpha: false, stencil: false });
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.05;
    this.maxDPR = this.mobile ? 1.5 : 1.75;
    this.dpr = Math.min(window.devicePixelRatio || 1, this.maxDPR);
    r.setPixelRatio(this.dpr);
    r.setClearColor('#000000', 1);
    this.renderer = r;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
    this.camera.position.set(0, 0, 6);
    this.camBase = new THREE.Vector3(0, 0, 6);

    const key = new THREE.DirectionalLight('#fff1e0', 1.4); key.position.set(-3, 4, 5);
    const rim = new THREE.PointLight('#ff5a1f', 28, 12, 2); rim.position.set(3, 2, -2.5);
    this.scene.add(key, rim);
    this.rim = rim;

    this.N = this.mobile ? 256 * 48 : 256 * 112;
    this.W = 256;
    this.field = new MorphField(this.N, this.W);
    this.stats.particles = this.N;
    this.embers = new Embers(this.mobile ? 260 : 700);
    this.sparks = new Sparks(this.mobile ? 220 : 420);
    this.scene.add(this.field.points, this.embers.points, this.sparks.points);

    this.shots = SHOTS.map((def, index) => {
      const pivot = new THREE.Group();
      const spin = new THREE.Group();
      const norm = new THREE.Group();
      pivot.add(spin); spin.add(norm);
      this.scene.add(pivot);
      return { ...def, index, pivot, spin, norm, tex: null, mesh: null, uniforms: null, ready: false };
    });
    this.byId = Object.fromEntries(this.shots.map((s) => [s.id, s]));
    this.pair = [-1, -1];
    this.raycaster = new THREE.Raycaster();
    this.plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    this.mouseWorld = new THREE.Vector3();
    this.clock = new THREE.Timer(); this.clock.connect?.(document);
    this.frames = 0; this.fpsT = 0; this.lowT = 0;

    // procedural targets exist immediately, so every shot has *something*
    const fallback = toTextures(dustTarget(this.N), this.W);
    for (const s of this.shots) {
      s.tex = s.proc ? toTextures(s.proc(this.N), this.W) : fallback;
      s.ready = !!s.proc;
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

    const [bustBuf, hdrBuf] = await Promise.all([
      fetchBytes('models/marble_bust_01.glb', (n) => bump(n, 'marble_bust_01.glb')),
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

    const bust = await this.gltf.parseAsync(bustBuf, BASE + 'models/');
    this.mountModel(this.byId.bust, bust.scene);
    const bu = this.byId.bust.uniforms;
    bu.uScanOn.value = 1;
    bu.uNoiseScale.value = 6.0;
    this.stats.ready = Math.round(performance.now() - t0);
    this.onProgress(1, 'ready');
    this.renderer.compile(this.scene, this.camera);
  }

  async loadRest() {
    const jobs = this.shots.filter((s) => s.file && !s.ready).map(async (s) => {
      try {
        const g = await this.gltf.loadAsync(BASE + s.file);
        this.mountModel(s, g.scene);
      } catch (e) { console.warn('model failed', s.id, e); }
    });
    jobs.push(this.loadEarth().catch((e) => console.warn('earth failed', e)));
    await Promise.all(jobs);
  }

  mountModel(shot, root) {
    const box = new THREE.Box3().setFromObject(root);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const k = 1 / (shot.norm === 'height' ? size.y : Math.max(size.x, size.y, size.z));
    root.position.copy(center).multiplyScalar(-k);
    root.scale.setScalar(k);
    shot.norm.add(root);
    if (shot.id === 'watch') shot.norm.rotation.x = Math.PI / 2;
    if (shot.id === 'hammer') {
      shot.norm.position.y = 0.5; // pivot the swing at the end of the handle
      shot.head = new THREE.Object3D(); shot.head.position.set(0.05, 0.42, 0); root.parent.add(shot.head);
    }
    const uniforms = forgeUniforms();
    shot.uniforms = uniforms;
    shot.meshes = [];
    root.traverse((o) => {
      if (!o.isMesh) return;
      shot.meshes.push(o);
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      mats.forEach((m) => {
        if (shot.id === 'laptop' && /screen/i.test(m.name)) { this.makeScreen(o, root); return; }
        m.envMapIntensity = 1.0;
        patchForge(m, uniforms);
      });
    });
    this.layoutShot(shot);
    shot.pivot.updateMatrixWorld(true);
    shot.tex = toTextures(sampleModel(shot.spin, this.N, { lift: shot.id === 'bust' ? 1.25 : 1.35 }), this.W);
    shot.mesh = root;
    shot.ready = true;
    shot.pivot.visible = false;
    this.pair = [-1, -1];
  }

  makeScreen(mesh, root) {
    root.updateMatrixWorld(true);
    const geo = mesh.geometry;
    const pos = geo.attributes.position;
    const m = new THREE.Matrix4().copy(mesh.matrixWorld).premultiply(new THREE.Matrix4().copy(root.matrixWorld).invert());
    const P = []; const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) P.push(v.fromBufferAttribute(pos, i).applyMatrix4(m).clone());
    // area weighted normal of the panel
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
    const mat = new THREE.MeshStandardMaterial({ color: '#000000', emissive: '#ffffff', emissiveMap: this.screenTex, emissiveIntensity: 1.35, roughness: 0.18, metalness: 0 });
    mesh.material = mat;
    mesh.userData.skipSample = false;
    this._screenMat = mat;
  }

  async loadEarth() {
    const tl = new THREE.TextureLoader();
    const L = (f, srgb = true) => tl.loadAsync(BASE + 'textures/earth/' + f).then((t) => { if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; });
    const [day, night, spec, clouds] = await Promise.all([
      L('earth_atmos_2048.jpg'), L('earth_lights_2048.png'), L('earth_specular_2048.jpg', false), L('earth_clouds_1024.png', false),
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
    shot.mesh = sphere;
    // visitor marker from the time zone (no geolocation permission needed)
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
    shot.ready = true;
    shot.pivot.visible = false;
    this.pair = [-1, -1];
  }

  /* ---------------------------------------------------------------- layout */
  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.mobile = w < 760;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.viewH = 2 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) * this.camera.position.z;
    this.viewW = this.viewH * this.camera.aspect;
    this.field.uniforms.uPR.value = this.dpr;
    this.field.uniforms.uSize.value = (this.mobile ? 20 : 26) * (h / 900);
    this.embers.uniforms.uPR.value = this.dpr;
    this.embers.uniforms.uSpan.value.set(this.viewW * 1.2, this.viewH * 1.2);
    this.sparks.uniforms.uPR.value = this.dpr;
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
    const accSRGB = (() => { const c = new THREE.Color(t.accent); const o = {}; c.getRGB(o, THREE.SRGBColorSpace); return new THREE.Vector3(o.r, o.g, o.b); })();
    const inkS = (() => { const c = new THREE.Color(t.fg); const o = {}; c.getRGB(o, THREE.SRGBColorSpace); return new THREE.Vector3(o.r, o.g, o.b); })();
    gsap.to(bg, { r: target.r, g: target.g, b: target.b, duration: dur, ease: 'power2.out', onUpdate: () => this.renderer.setClearColor(bg) });
    gsap.to(fu.uInk.value, { x: inkS.x, y: inkS.y, z: inkS.z, duration: dur });
    gsap.to(fu.uInkMix, { value: t.dark ? 0 : 0.82, duration: dur });
    gsap.to(fu.uAccent.value, { x: accSRGB.x, y: accSRGB.y, z: accSRGB.z, duration: dur });
    gsap.to(this, { particleGain: t.particles ?? 1, duration: dur });
    gsap.to(this.embers.uniforms.uOpacity, { value: t.embers ?? 0.2, duration: dur });
    gsap.to(this.embers.uniforms.uColor.value, { x: accSRGB.x, y: accSRGB.y, z: accSRGB.z, duration: dur });
    gsap.to(this.rim.color, { r: acc.r, g: acc.g, b: acc.b, duration: dur });
    gsap.to(this.scene, { environmentIntensity: t.env ?? 0.9, duration: dur });
    for (const s of this.shots) if (s.uniforms) {
      gsap.to(s.uniforms.uEdge.value, { r: acc.r, g: acc.g, b: acc.b, duration: dur });
      gsap.to(s.uniforms.uScanColor.value, { r: acc.r, g: acc.g, b: acc.b, duration: dur });
    }
    if (this.screen) this.screen.accent = t.accent;
  }

  /* ---------------------------------------------------------------- interactions */
  setPointer(nx, ny) { this.pointer.set(nx, ny); this.pointerActive = true; }

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
          const w = new THREE.Mesh(m.geometry, new THREE.MeshBasicMaterial({ color: '#ffffff', wireframe: true, transparent: true, opacity: 0.16, depthWrite: false, toneMapped: false }));
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

    // pointer → world, for repulsion and the hero scan line
    this.raycaster.setFromCamera(this.pointer, this.camera);
    this.raycaster.ray.intersectPlane(this.plane, this.mouseWorld);
    if (this.pointerActive) fu.uMouse.value.lerp(this.mouseWorld, 0.2);

    // which two shots are we between?
    const n = this.shots.length;
    let s = clamp(this.s, 0, n - 1);
    let i = Math.floor(s), t = s - i;
    if (i >= n - 1) { i = n - 1; t = 0; }
    const j = Math.min(i + 1, n - 1);
    let A = this.shots[i], B = this.shots[j];
    let morph = smooth(0.08, 0.92, t);
    let opacity = Math.max(lerp(A.rest, B.rest, smooth(0, 1, t)), Math.pow(Math.sin(Math.PI * t), 0.6));

    // intro: the dust condenses into the bust
    const introActive = this.intro < 1 && i === 0 && t < 0.02;
    if (introActive) {
      A = this.byId.dust; B = this.byId.bust;
      morph = smooth(0, 0.85, this.intro);
      opacity = Math.min(1, this.intro * 4) * (1 - smooth(0.78, 1, this.intro));
    }
    if (A !== this._A || B !== this._B) {
      fu.uFromPos.value = A.tex.pos; fu.uFromCol.value = A.tex.col;
      fu.uToPos.value = B.tex.pos; fu.uToCol.value = B.tex.col;
      this._A = A; this._B = B;
    }

    this.animateShots(time, dt);
    for (const sh of this.shots) sh.pivot.updateMatrixWorld(true);
    fu.uFromM.value.copy(A.spin.matrixWorld);
    fu.uToM.value.copy(B.spin.matrixWorld);
    fu.uMorph.value = morph;
    fu.uOpacity.value = opacity * this.particleGain;
    fu.uScatter.value = A.id === 'dust' ? 1 - morph : B.id === 'dust' ? morph : 0;

    // meshes: the one we leave burns away, the one we enter is forged in
    for (const sh of this.shots) {
      if (!sh.mesh || !sh.uniforms) { sh.pivot.visible = false; continue; }
      let d = 1;
      if (introActive) d = sh.id === 'bust' ? 1 - smooth(0.55, 1, this.intro) : 1;
      else if (sh === A && sh === B) d = 0;
      else if (sh === A) d = smooth(0.0, 0.32, t);
      else if (sh === B) d = 1 - smooth(0.68, 1.0, t);
      sh.uniforms.uDissolve.value = d;
      sh.uniforms.uTime.value = time;
      if (sh.uniforms.uAtmo) sh.uniforms.uAtmo.value = 1 - d;
      sh.pivot.visible = d < 0.999;
    }

    // hero scan line follows the hand, or sweeps on its own
    const bust = this.byId.bust;
    if (bust.uniforms) {
      const L = bust.layout, h = L.s, cy = L.y;
      let target = cy + Math.sin(time * 0.55) * h * 0.42;
      if (this.heroPointerY !== null && this.pointerActive) target = clamp(this.mouseWorld.y, cy - h * 0.5, cy + h * 0.5);
      this.scanY = this.scanY === undefined ? target : lerp(this.scanY, target, 0.08);
      bust.uniforms.uScanY.value = this.scanY;
      this.scanPct = clamp((this.scanY - (cy - h * 0.5)) / h) * 100;
      const sp = new THREE.Vector3(L.x + h * 0.24, this.scanY, 0).project(this.camera);
      this.scanScreen = { x: (sp.x * 0.5 + 0.5) * window.innerWidth, y: (-sp.y * 0.5 + 0.5) * window.innerHeight };
    }

    if (this.screen && this.byId.laptop.pivot.visible) { this.screen.draw(dt); this.screenTex.needsUpdate = true; }
    if (this.marker) { const k = (time * 0.8) % 1; this.marker.ring.scale.setScalar(1 + k * 2.2); this.marker.ring.material.opacity = 1 - k; }
    if (this.earthMat) {
      const sun = sunLatLon(new Date());
      this.earthMat.uniforms.uSun.value.copy(latLonToVec3(sun.lat, sun.lon));
      const e = this.byId.earth;
      const ws = latLonToVec3(sun.lat, sun.lon).applyQuaternion(e.spin.getWorldQuaternion(new THREE.Quaternion()));
      e.uniforms.uSunWorld.value.copy(ws);
    }

    // camera: a slow parallax toward the cursor, plus impact shake
    this.shake *= Math.pow(0.0008, dt);
    const sx = (Math.random() - 0.5) * 0.06 * this.shake, sy = (Math.random() - 0.5) * 0.06 * this.shake;
    this.camera.position.x = lerp(this.camera.position.x, this.pointer.x * 0.12, 0.04) + sx;
    this.camera.position.y = lerp(this.camera.position.y, this.pointer.y * 0.08, 0.04) + sy;
    this.camera.lookAt(0, 0, 0);

    this.renderer.render(this.scene, this.camera);

    // live stats for the proof panel
    const info = this.renderer.info.render;
    this.stats.tris = info.triangles; this.stats.calls = info.calls; this.stats.points = info.points;
    this.frames++; this.fpsT += dt;
    if (this.fpsT >= 0.5) {
      this.stats.fps = Math.round(this.frames / this.fpsT);
      this.stats.ms = +(1000 * this.fpsT / this.frames).toFixed(1);
      this.frames = 0; this.fpsT = 0;
      // adaptive resolution keeps motion smooth on weaker GPUs
      if (this.stats.fps < 40 && document.visibilityState === 'visible') this.lowT += 0.5; else this.lowT = 0;
      if (this.lowT >= 2 && this.dpr > 1) { this.dpr = Math.max(1, this.dpr - 0.25); this.renderer.setPixelRatio(this.dpr); this.resize(); this.lowT = 0; }
    }
  }

  animateShots(time) {
    const px = this.pointer.x, py = this.pointer.y;
    const L = (a, b) => lerp(a, b, 0.06);
    const b = this.byId;
    b.bust.spin.rotation.y = L(b.bust.spin.rotation.y, -0.32 + px * 0.55);
    b.bust.spin.rotation.x = L(b.bust.spin.rotation.x, -py * 0.12);
    b.laptop.spin.rotation.y = L(b.laptop.spin.rotation.y, px * 0.3 + Math.sin(time * 0.4) * 0.06);
    b.laptop.spin.position.y = Math.sin(time * 0.9) * 0.02;
    b.watch.spin.rotation.y = time * 0.35;
    b.watch.spin.rotation.x = L(b.watch.spin.rotation.x, -0.15 - py * 0.2);
    b.watch.spin.rotation.z = Math.sin(time * 0.5) * 0.12;
    b.board.spin.rotation.y = time * 0.12 + px * 0.25;
    b.sheet.spin.rotation.y = Math.sin(time * 0.1) * 0.08;
    b.sphere.spin.rotation.y = time * 0.08 + this.sphereSpin.y;
    b.sphere.spin.rotation.x = this.sphereSpin.x;
    b.rings.spin.rotation.y = time * 0.06;
    b.rings.spin.rotation.z = Math.sin(time * 0.3) * 0.05;
    b.dust.spin.rotation.y = time * 0.02;
    // near the very bottom the planet rises out of the way of the footer links
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
