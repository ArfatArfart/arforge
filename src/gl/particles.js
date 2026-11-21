import * as THREE from 'three';
import { NOISE } from './noise.js';

/*
  The morph field.
  One draw call, N points. Each point reads where it lives in the shot we are
  leaving (uFrom*) and the shot we are entering (uTo*) from float textures,
  then travels between them on a curl noise current. Particles leave with a
  per-point delay so objects come apart grain by grain rather than as a block.
*/
export class MorphField {
  constructor(N, W) {
    this.N = N;
    this.W = W;
    const H = Math.ceil(N / W);
    const ref = new Float32Array(N * 2);
    const rnd = new Float32Array(N * 4);
    for (let i = 0; i < N; i++) {
      ref[i * 2] = ((i % W) + 0.5) / W;
      ref[i * 2 + 1] = (Math.floor(i / W) + 0.5) / H;
      rnd.set([Math.random(), Math.random(), Math.random(), Math.random()], i * 4);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
    geo.setAttribute('aRef', new THREE.BufferAttribute(ref, 2));
    geo.setAttribute('aRand', new THREE.BufferAttribute(rnd, 4));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 100);

    this.uniforms = {
      uFromPos: { value: null }, uToPos: { value: null },
      uFromCol: { value: null }, uToCol: { value: null },
      uFromM: { value: new THREE.Matrix4() }, uToM: { value: new THREE.Matrix4() },
      uMorph: { value: 0 },
      uTime: { value: 0 },
      uSize: { value: 26 },
      uPR: { value: 1 },
      uOpacity: { value: 0 },
      uMouse: { value: new THREE.Vector3(99, 99, 99) },
      uInk: { value: new THREE.Vector3(1, 1, 1) },
      uInkMix: { value: 0 },
      uAccent: { value: new THREE.Vector3(1, 0.35, 0.12) },
      uLight: { value: 0 },
      uScatter: { value: 0 },
    };

    this.material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
      vertexShader: /* glsl */ `
        uniform sampler2D uFromPos, uToPos, uFromCol, uToCol;
        uniform mat4 uFromM, uToM;
        uniform float uMorph, uTime, uSize, uPR, uOpacity, uScatter;
        uniform vec3 uMouse, uInk, uAccent;
        uniform float uInkMix;
        attribute vec2 aRef;
        attribute vec4 aRand;
        varying vec3 vCol;
        varying float vAlpha;
        ${NOISE}
        void main() {
          vec4 pf = texture2D(uFromPos, aRef);
          vec4 pt = texture2D(uToPos, aRef);
          vec3 a = (uFromM * vec4(pf.xyz, 1.0)).xyz;
          vec3 b = (uToM * vec4(pt.xyz, 1.0)).xyz;

          // staggered departure: each grain leaves at its own moment
          float d = aRand.x * 0.45;
          float t = clamp((uMorph - d) / 0.55, 0.0, 1.0);
          t = t * t * (3.0 - 2.0 * t);
          float mid = sin(t * 3.14159265);

          vec3 p = mix(a, b, t);
          if (uMorph > 0.0001 && uMorph < 0.9999) {
            p += curlNoise(p * 0.45 + vec3(0.0, uTime * 0.08, 0.0)) * mid * (0.55 + aRand.y * 0.9);
            p.y += mid * (aRand.z - 0.35) * 0.9;
          }
          // living surface: a slow breath so the field never freezes
          p += vec3(
            sin(uTime * 0.7 + aRand.y * 40.0),
            cos(uTime * 0.6 + aRand.z * 40.0),
            sin(uTime * 0.5 + aRand.w * 40.0)
          ) * (0.004 + uScatter * 0.08);

          // the cursor pushes grains aside like a hand through sparks
          vec3 dm = p - uMouse;
          float md = length(dm.xy);
          p += normalize(dm + 1e-4) * smoothstep(0.75, 0.0, md) * 0.22;

          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          float sz = mix(pf.w, pt.w, t) * (0.65 + aRand.w * 0.7);
          gl_PointSize = uSize * sz * uPR * (1.0 + mid * 0.6) / max(0.5, -mv.z);

          vec3 c = mix(texture2D(uFromCol, aRef).rgb, texture2D(uToCol, aRef).rgb, t);
          c = mix(c, uAccent, mid * 0.55);          // hot while in flight
          c = mix(c, uInk, uInkMix);                // readable on paper themes
          vCol = c;
          vAlpha = uOpacity;
        }
      `,
      fragmentShader: /* glsl */ `
        varying vec3 vCol;
        varying float vAlpha;
        void main() {
          vec2 q = gl_PointCoord - 0.5;
          float r = length(q);
          if (r > 0.5) discard;
          float a = smoothstep(0.5, 0.0, r);
          gl_FragColor = vec4(vCol, a * a * vAlpha);
        }
      `,
    });
    this.points = new THREE.Points(geo, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
  }
}

/* Rising embers: something is always being made. */
export class Embers {
  constructor(count = 700) {
    const geo = new THREE.BufferGeometry();
    const seed = new Float32Array(count * 4);
    for (let i = 0; i < count; i++) seed.set([Math.random(), Math.random(), Math.random(), Math.random()], i * 4);
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
    this.uniforms = {
      uTime: { value: 0 }, uPR: { value: 1 }, uOpacity: { value: 0.6 },
      uColor: { value: new THREE.Vector3(1, 0.4, 0.12) },
      uSpan: { value: new THREE.Vector2(8, 5) },
    };
    this.material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */ `
        uniform float uTime, uPR;
        uniform vec2 uSpan;
        attribute vec4 aSeed;
        varying float vLife;
        void main() {
          float speed = 0.05 + aSeed.y * 0.08;
          float life = fract(aSeed.x + uTime * speed);
          vec3 p = vec3(
            (aSeed.z - 0.5) * uSpan.x + sin(uTime * 0.6 + aSeed.w * 30.0) * 0.25 * life,
            -uSpan.y * 0.5 + life * uSpan.y,
            -1.5 + aSeed.w * 2.5
          );
          vLife = life;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = (2.0 + aSeed.y * 5.0) * uPR * (1.0 - life * 0.6);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor;
        uniform float uOpacity;
        varying float vLife;
        void main() {
          float r = length(gl_PointCoord - 0.5);
          if (r > 0.5) discard;
          float a = smoothstep(0.5, 0.0, r) * sin(vLife * 3.14159) * uOpacity;
          vec3 c = mix(vec3(1.0, 0.95, 0.8), uColor, vLife);
          gl_FragColor = vec4(c, a);
        }
      `,
    });
    this.points = new THREE.Points(geo, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = 6;
  }
}

/* Sparks thrown off when the hammer lands. Pure ballistic maths in the shader. */
export class Sparks {
  constructor(count = 420) {
    const geo = new THREE.BufferGeometry();
    const v = new Float32Array(count * 4);
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const up = 0.4 + Math.random() * 1.0;
      const sp = 1.2 + Math.random() * 3.2;
      v.set([Math.cos(a) * sp, up * sp * 0.9, Math.sin(a) * sp * 0.6, Math.random()], i * 4);
    }
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    geo.setAttribute('aVel', new THREE.BufferAttribute(v, 4));
    this.uniforms = {
      uT: { value: 99 }, uOrigin: { value: new THREE.Vector3() }, uPR: { value: 1 },
      uColor: { value: new THREE.Vector3(1, 0.45, 0.1) },
    };
    this.material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */ `
        uniform float uT, uPR;
        uniform vec3 uOrigin;
        attribute vec4 aVel;
        varying float vK;
        void main() {
          float t = uT * (0.7 + aVel.w * 0.6);
          vec3 p = uOrigin + aVel.xyz * t * 0.55 + vec3(0.0, -4.2, 0.0) * t * t * 0.5;
          vK = clamp(1.0 - t / 1.1, 0.0, 1.0);
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = (1.5 + aVel.w * 4.0) * uPR * vK * 2.0;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor;
        varying float vK;
        void main() {
          float r = length(gl_PointCoord - 0.5);
          if (r > 0.5 || vK <= 0.0) discard;
          vec3 c = mix(uColor, vec3(1.0, 0.95, 0.75), vK * vK);
          gl_FragColor = vec4(c, smoothstep(0.5, 0.0, r) * vK);
        }
      `,
    });
    this.points = new THREE.Points(geo, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = 7;
  }
  fire(origin) {
    this.uniforms.uOrigin.value.copy(origin);
    this.uniforms.uT.value = 0;
  }
  tick(dt) { this.uniforms.uT.value += dt; }
}
