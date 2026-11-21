import * as THREE from 'three';
import { MeshSurfaceSampler } from 'three/addons/math/MeshSurfaceSampler.js';

/*
  Particle targets.
  Every "shot" on the page is described by the same N points: a position
  (xyz + size in w) and a colour. Real models are sampled on their actual
  scanned surface and coloured from their actual albedo texture, so when the
  particles fly between shots you are watching the real objects come apart.
*/

const readCache = new WeakMap();

function textureReader(tex) {
  if (!tex || !tex.image) return null;
  if (readCache.has(tex)) return readCache.get(tex);
  const img = tex.image;
  const S = 256;
  const c = document.createElement('canvas');
  c.width = S; c.height = S;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  try {
    ctx.drawImage(img, 0, 0, S, S);
    const data = ctx.getImageData(0, 0, S, S).data;
    const flip = tex.flipY;
    const read = (u, v, out) => {
      u = u - Math.floor(u); v = v - Math.floor(v);
      const x = Math.min(S - 1, Math.floor(u * S));
      const y = Math.min(S - 1, Math.floor((flip ? 1 - v : v) * S));
      const i = (y * S + x) * 4;
      out[0] = data[i]; out[1] = data[i + 1]; out[2] = data[i + 2];
    };
    readCache.set(tex, read);
    return read;
  } catch (e) {
    readCache.set(tex, null);
    return null;
  }
}

function triArea(geo, matrix) {
  const pos = geo.attributes.position;
  const idx = geo.index;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const count = idx ? idx.count : pos.count;
  let area = 0;
  for (let i = 0; i < count; i += 3) {
    const ia = idx ? idx.getX(i) : i, ib = idx ? idx.getX(i + 1) : i + 1, ic = idx ? idx.getX(i + 2) : i + 2;
    a.fromBufferAttribute(pos, ia).applyMatrix4(matrix);
    b.fromBufferAttribute(pos, ib).applyMatrix4(matrix);
    c.fromBufferAttribute(pos, ic).applyMatrix4(matrix);
    area += new THREE.Triangle(a, b, c).getArea();
  }
  return area;
}

export function makeTarget(N) {
  return { pos: new Float32Array(N * 4), col: new Uint8Array(N * 4) };
}

/** Sample N points on every mesh under `pivot`, in pivot space. */
export function sampleModel(pivot, N, opts = {}) {
  const t = makeTarget(N);
  pivot.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(pivot.matrixWorld).invert();
  const meshes = [];
  pivot.traverse((o) => { if (o.isMesh && o.geometry?.attributes?.position && !o.userData.skipSample) meshes.push(o); });
  const rels = meshes.map((m) => new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld));
  const areas = meshes.map((m, i) => triArea(m.geometry, rels[i]));
  const total = areas.reduce((s, a) => s + a, 0) || 1;

  const p = new THREE.Vector3(), n = new THREE.Vector3(), uv = new THREE.Vector2(), c = new THREE.Color();
  const rgb = [200, 200, 200];
  let k = 0;
  meshes.forEach((mesh, mi) => {
    const share = mi === meshes.length - 1 ? N - k : Math.round((areas[mi] / total) * N);
    if (share <= 0) return;
    const sampler = new MeshSurfaceSampler(mesh).build();
    const hasUV = !!mesh.geometry.attributes.uv;
    const mat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    const read = hasUV ? textureReader(mat?.map) : null;
    const base = new THREE.Color(0.8, 0.8, 0.8);
    if (mat?.color) mat.color.getRGB(base, THREE.SRGBColorSpace);
    for (let s = 0; s < share && k < N; s++, k++) {
      sampler.sample(p, n, c, uv);
      p.applyMatrix4(rels[mi]);
      // push points a hair off the surface along the normal so they glint
      t.pos[k * 4] = p.x; t.pos[k * 4 + 1] = p.y; t.pos[k * 4 + 2] = p.z;
      t.pos[k * 4 + 3] = 0.6 + Math.random() * 0.8;
      if (read) read(uv.x, uv.y, rgb);
      else { rgb[0] = base.r * 255; rgb[1] = base.g * 255; rgb[2] = base.b * 255; }
      const lift = opts.lift ?? 1.15;
      t.col[k * 4] = Math.min(255, rgb[0] * lift);
      t.col[k * 4 + 1] = Math.min(255, rgb[1] * lift);
      t.col[k * 4 + 2] = Math.min(255, rgb[2] * lift);
      t.col[k * 4 + 3] = 255;
    }
  });
  return t;
}

/* ---------------- procedural targets ---------------- */

const rand = (a, b) => a + Math.random() * (b - a);

/** Drifting dust in a wide volume: the idea after it has broken apart. */
export function dustTarget(N) {
  const t = makeTarget(N);
  for (let i = 0; i < N; i++) {
    t.pos.set([rand(-7, 7), rand(-4, 4), rand(-5, 1.5), rand(0.3, 1.2)], i * 4);
    const g = rand(150, 255);
    t.col.set([g, g * 0.97, g * 0.92, 255], i * 4);
  }
  return t;
}

/** A molten sheet: a wide rolling surface the work cards float above. */
export function sheetTarget(N) {
  const t = makeTarget(N);
  const cols = 256, rows = Math.ceil(N / cols);
  for (let i = 0; i < N; i++) {
    const x = (i % cols) / (cols - 1), z = Math.floor(i / cols) / Math.max(1, rows - 1);
    const X = (x - 0.5) * 12, Z = (z - 0.5) * 6;
    const Y = Math.sin(X * 0.8) * 0.25 + Math.cos(Z * 1.3 + X * 0.3) * 0.2;
    t.pos.set([X, Y, Z, 0.5 + Math.random() * 0.5], i * 4);
    const h = 0.6 + 0.4 * z;
    t.col.set([40 * h, 70 * h, 255 * h, 255], i * 4);
  }
  return t;
}

/** Fibonacci sphere coloured by longitude: every tool on one surface. */
export function sphereTarget(N) {
  const t = makeTarget(N);
  const ga = Math.PI * (3 - Math.sqrt(5));
  const c = new THREE.Color();
  for (let i = 0; i < N; i++) {
    const y = 1 - (i / (N - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const th = ga * i;
    const jitter = 1 + rand(-0.015, 0.015);
    t.pos.set([Math.cos(th) * r * jitter, y * jitter, Math.sin(th) * r * jitter, rand(0.4, 1.0)], i * 4);
    c.setHSL(((th / (Math.PI * 2)) % 1 + 1) % 1, 0.75, 0.68);
    t.col.set([c.r * 255, c.g * 255, c.b * 255, 255], i * 4);
  }
  return t;
}

/** Concentric instrument rings: the shape of a gauge face. */
export function ringsTarget(N) {
  const t = makeTarget(N);
  const R = [0.55, 0.85, 1.15, 1.45, 1.75];
  for (let i = 0; i < N; i++) {
    const ring = i % R.length;
    const a = Math.random() * Math.PI * 2;
    const tick = (Math.floor(a / (Math.PI / 36)) % 2 === 0) ? 1 : 0.55;
    const r = R[ring] + rand(-0.012, 0.012);
    t.pos.set([Math.cos(a) * r, rand(-0.01, 0.01), Math.sin(a) * r, rand(0.4, 1.0) * tick], i * 4);
    const k = 0.55 + 0.45 * (ring / (R.length - 1));
    t.col.set([255 * k, 176 * k, 20 * k, 255], i * 4);
  }
  return t;
}

/** Earth as particles coloured by real night lights + day albedo. */
export function earthTarget(N, dayImg, nightImg) {
  const t = makeTarget(N);
  const S = 512;
  const mk = (img) => {
    if (!img) return null;
    const c = document.createElement('canvas'); c.width = S; c.height = S / 2;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, S, S / 2);
    return ctx.getImageData(0, 0, S, S / 2).data;
  };
  const day = mk(dayImg), night = mk(nightImg);
  for (let i = 0; i < N; i++) {
    const u = Math.random(), v = Math.acos(1 - 2 * Math.random()) / Math.PI;
    const phi = u * Math.PI * 2, th = v * Math.PI;
    const x = -Math.cos(phi) * Math.sin(th), y = Math.cos(th), z = Math.sin(phi) * Math.sin(th);
    const r = 1.005;
    t.pos.set([x * r, y * r, z * r, rand(0.4, 1.0)], i * 4);
    const px = Math.min(S - 1, Math.floor(u * S)), py = Math.min(S / 2 - 1, Math.floor(v * S / 2));
    const j = (py * S + px) * 4;
    if (day && night) {
      const nl = night[j] / 255;
      t.col.set([
        Math.min(255, day[j] * 0.7 + 255 * nl * 1.2),
        Math.min(255, day[j + 1] * 0.7 + 190 * nl * 1.2),
        Math.min(255, day[j + 2] * 0.9 + 110 * nl * 1.2),
        255,
      ], i * 4);
    } else t.col.set([120, 170, 255, 255], i * 4);
  }
  return t;
}

/** Upload a target into GPU textures the particle shader reads with texelFetch. */
export function toTextures(target, W) {
  const N = target.pos.length / 4;
  const H = Math.ceil(N / W);
  const pos = new THREE.DataTexture(target.pos, W, H, THREE.RGBAFormat, THREE.FloatType);
  pos.needsUpdate = true;
  const col = new THREE.DataTexture(target.col, W, H, THREE.RGBAFormat, THREE.UnsignedByteType);
  col.needsUpdate = true;
  return { pos, col };
}
