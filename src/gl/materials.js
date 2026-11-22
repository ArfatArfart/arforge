import * as THREE from 'three';
import { NOISE } from './noise.js';

/*
  Forge dissolve.
  Real PBR materials from the scans get two extra behaviours:
  1. Dissolve: fragments below a noise threshold are discarded and the
     surviving edge glows like metal fresh out of the fire.
  2. Scan (hero only): below a horizontal plane the marble turns into glowing
     contour slices. Above it is the sculpture, below it is the system.
*/
export function patchForge(material, shared) {
  material.userData.forge = shared;
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, shared);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vFWorld;\nvarying vec3 vFNormal;')
      .replace(
        '#include <worldpos_vertex>',
        '#include <worldpos_vertex>\nvFWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvFNormal = normalize(mat3(modelMatrix) * objectNormal);'
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vFWorld;
        varying vec3 vFNormal;
        uniform float uDissolve, uTime, uScanY, uScanOn, uNoiseScale, uXray;
        uniform vec3 uEdge, uScanColor;
        ${NOISE}`
      )
      .replace(
        'void main() {',
        `void main() {
          float fn = 1.0;
          if (uDissolve > 0.0001) {
            fn = snoise(vFWorld * uNoiseScale) * 0.5 + 0.5;
            fn = mix(fn, snoise(vFWorld * uNoiseScale * 3.1) * 0.5 + 0.5, 0.3);
            if (fn < uDissolve) discard;
          }
          float below = uScanOn * step(vFWorld.y, uScanY);
          float slice = 0.0;
          if (below > 0.5) {
            float s1 = abs(fract(vFWorld.y * 26.0) - 0.5);
            float s2 = abs(fract((vFWorld.x * 0.7 + vFWorld.z) * 14.0) - 0.5);
            slice = max(smoothstep(0.36, 0.47, s1), smoothstep(0.44, 0.49, s2) * 0.5);
            if (slice < 0.08) discard;
          }`
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
          float edge = (1.0 - smoothstep(0.0, 0.07, fn - uDissolve)) * step(0.0001, uDissolve);
          totalEmissiveRadiance += uEdge * edge * 7.0;
          if (below > 0.5) {
            vec3 V = normalize(cameraPosition - vFWorld);
            float fres = pow(1.0 - abs(dot(normalize(vFNormal), V)), 2.0);
            totalEmissiveRadiance += uScanColor * (slice * 2.2 + fres * 1.4);
          }
          float band = uScanOn * smoothstep(0.018, 0.0, abs(vFWorld.y - uScanY));
          totalEmissiveRadiance += uScanColor * band * 9.0;`
      )
      .replace(
        '#include <dithering_fragment>',
        `#include <dithering_fragment>
          if (below > 0.5) gl_FragColor.rgb = mix(gl_FragColor.rgb, uScanColor * (0.5 + slice * 0.9), 0.75);`
      );
    if (material.userData.extraPatch) material.userData.extraPatch(shader);
  };
  material.customProgramCacheKey = () => (material.userData.extraPatch ? 'forge-v2-' + (material.userData.patchKey || 'screen') : 'forge-v2');
  material.needsUpdate = true;
}

export function forgeUniforms(extra = {}) {
  return {
    uDissolve: { value: 1 },
    uTime: { value: 0 },
    uScanY: { value: -99 },
    uScanOn: { value: 0 },
    uNoiseScale: { value: 2.2 },
    uXray: { value: 0 },
    uEdge: { value: new THREE.Color('#ff5a1f').multiplyScalar(1.0) },
    uScanColor: { value: new THREE.Color('#ff5a1f') },
    ...extra,
  };
}

/* ---------------------------------------------------------------- Earth
   NASA Blue Marble day map, Black Marble night lights, a normal map for
   relief, an ocean mask for sun glint, and shadows from the separate cloud
   layer. Lighting runs in Earth space from the real subsolar point.        */
export function earthMaterial(tex, shared) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uDay: { value: tex.day }, uNight: { value: tex.night }, uWater: { value: tex.water },
      uClouds: { value: tex.clouds }, uNormal: { value: tex.normal },
      uSun: { value: new THREE.Vector3(1, 0, 0) }, uCloudShift: { value: 0 },
      ...shared,
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv; varying vec3 vLocalN; varying vec3 vWorldN; varying vec3 vW; varying vec3 vVl;
      void main() {
        vUv = uv; vLocalN = normalize(position);
        vWorldN = normalize(mat3(modelMatrix) * normal);
        vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz;
        vVl = transpose(mat3(modelMatrix)) * (cameraPosition - w.xyz);
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D uDay, uNight, uWater, uClouds, uNormal;
      uniform vec3 uSun; uniform float uDissolve, uTime, uNoiseScale, uCloudShift;
      uniform vec3 uEdge;
      varying vec2 vUv; varying vec3 vLocalN; varying vec3 vWorldN; varying vec3 vW; varying vec3 vVl;
      ${NOISE}
      void main() {
        float fn = 1.0;
        if (uDissolve > 0.0001) { fn = snoise(vW * uNoiseScale) * 0.5 + 0.5; if (fn < uDissolve) discard; }
        vec3 N = normalize(vLocalN);
        vec3 T = normalize(cross(vec3(0.0, 1.0, 0.0), N) + vec3(1e-5, 0.0, 0.0));
        vec3 B = cross(N, T);
        vec3 nm = texture2D(uNormal, vUv).xyz * 2.0 - 1.0;
        vec3 Nr = normalize(T * nm.x * 0.8 + B * nm.y * 0.8 + N * nm.z);
        vec3 S = normalize(uSun);
        float l = dot(N, S), lr = dot(Nr, S);
        float day = smoothstep(-0.14, 0.24, l);
        vec3 dayC = texture2D(uDay, vUv).rgb;
        vec3 nightC = texture2D(uNight, vUv).rgb;
        float water = texture2D(uWater, vUv).r;
        vec2 cuv = vUv + vec2(uCloudShift, 0.0);
        float cloudShadow = texture2D(uClouds, cuv + vec2(0.0015, 0.001)).r;
        vec3 lit = dayC * (0.06 + max(lr, 0.0) * 1.35) * (1.0 - cloudShadow * 0.45 * day);
        float dusk = smoothstep(0.25, -0.05, l) * smoothstep(-0.35, 0.0, l);
        vec3 lights = nightC * vec3(1.0, 0.74, 0.46) * (2.4 + dusk * 1.5);
        vec3 col = mix(lights * (1.0 - cloudShadow * 0.6), lit, day);
        vec3 V = normalize(cameraPosition - vW);
        vec3 Nw = normalize(vWorldN);
        vec3 Hl = normalize(S + normalize(vVl));
        float glint = pow(max(dot(Nr, Hl), 0.0), 260.0) * 0.9 + pow(max(dot(N, Hl), 0.0), 30.0) * 0.06;
        col += vec3(1.0, 0.9, 0.74) * water * day * glint;
        col += vec3(1.0, 0.45, 0.2) * dusk * 0.08 * (1.0 - water);
        float fres = pow(1.0 - max(dot(Nw, V), 0.0), 3.0);
        col += vec3(0.3, 0.58, 1.0) * fres * (0.18 + day * 0.85);
        float edge = (1.0 - smoothstep(0.0, 0.07, fn - uDissolve)) * step(0.0001, uDissolve);
        col += uEdge * edge * 5.0;
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}

export function cloudMaterial(tex, shared) {
  return new THREE.ShaderMaterial({
    uniforms: { uClouds: { value: tex.clouds }, uSun: { value: new THREE.Vector3(1, 0, 0) }, uCloudShift: { value: 0 }, uOpacity: shared.uAtmo },
    transparent: true, depthWrite: false,
    vertexShader: `varying vec2 vUv; varying vec3 vN; void main(){ vUv = uv; vN = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D uClouds; uniform vec3 uSun; uniform float uCloudShift, uOpacity;
      varying vec2 vUv; varying vec3 vN;
      void main(){
        float d = texture2D(uClouds, vUv + vec2(uCloudShift, 0.0)).r;
        float l = dot(normalize(vN), normalize(uSun));
        float day = smoothstep(-0.18, 0.3, l);
        vec3 c = mix(vec3(0.04, 0.05, 0.08), vec3(1.0) * (0.3 + max(l, 0.0) * 0.95), day);
        c = mix(c, vec3(1.0, 0.62, 0.38), smoothstep(0.2, 0.0, abs(l - 0.02)) * 0.5);
        gl_FragColor = vec4(c, d * 0.92 * uOpacity);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}

export function atmosphereMaterial(shared) {
  return new THREE.ShaderMaterial({
    uniforms: { uSun: shared.uSunWorld, uOpacity: shared.uAtmo },
    side: THREE.FrontSide,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      varying vec3 vN; varying vec3 vW;
      void main() {
        vN = normalize(mat3(modelMatrix) * normal);
        vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uSun; uniform float uOpacity;
      varying vec3 vN; varying vec3 vW;
      void main() {
        vec3 V = normalize(cameraPosition - vW);
        float rim = 1.0 - max(dot(vN, V), 0.0);
        float halo = smoothstep(0.25, 0.56, rim) * (1.0 - smoothstep(0.56, 1.0, rim));
        float lit = 0.35 + 0.65 * smoothstep(-0.4, 0.6, dot(vN, normalize(uSun)));
        gl_FragColor = vec4(vec3(0.3, 0.6, 1.0) * halo * lit * 1.4 * uOpacity, 1.0);
      }
    `,
  });
}
