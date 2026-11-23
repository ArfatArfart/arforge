import * as THREE from 'three';

/*
  The hero object: a real PlayStation 5 DualSense scan-level model
  ("Playstation 5 Dualsense" by AHarmlessPotato, CC BY 4.0, logos removed).
  Every control is its own node, so the sticks lean toward your cursor and
  the face button and trigger press when you click: it answers your hand
  the way the real one does.

  Its second edition lives under the ink: wherever the ink covers it, the
  shell breaks into a grid of bright pixels, cell by cell, and fast cursor
  moves tear it into glitch slices.
*/
export const PAD = { file: 'models/dualsense.glb', bytes: 722260 };

export function padUniforms() {
  return {
    uInk: { value: null },
    uInkGain: { value: 0 },
    uRes: { value: new THREE.Vector2(1, 1) },
    uCell: { value: 9 },
    uPix: { value: 0 },
    uGlitch: { value: 0 },
    uPadT: { value: 0 },
  };
}

/** shader patch, chained after the forge dissolve through material.userData.extraPatch */
export function padPatch(u) {
  return (shader) => {
    Object.assign(shader.uniforms, u);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uGlitch, uPadT;')
      .replace(
        '#include <project_vertex>',
        `#include <project_vertex>
        {
          // fast hands tear the object into horizontal slices
          float yb = gl_Position.y / gl_Position.w;
          float band = floor(yb * 24.0 + floor(uPadT * 11.0) * 5.0);
          float hb = fract(sin(band * 91.7) * 43758.5453);
          float on = step(0.68, fract(sin(band * 12.31 + 7.0) * 9631.7));
          gl_Position.x += (hb - 0.5) * on * uGlitch * 0.085 * gl_Position.w;
        }`
      );
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D uInk; uniform vec2 uRes; uniform float uCell, uPix, uInkGain, uPadT;\nfloat padHash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }')
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
        // the black face plate is glossier than the satin white shell
        roughnessFactor = mix(0.3, 0.44, smoothstep(0.08, 0.6, dot(diffuseColor.rgb, vec3(0.3333))));`
      )
      .replace(
        '#include <aomap_fragment>',
        `#include <aomap_fragment>
        {
          float dk = 1.0 - smoothstep(0.06, 0.32, dot(diffuseColor.rgb, vec3(0.3333)));
          reflectedLight.indirectSpecular *= mix(1.0, 0.3, dk);
          reflectedLight.directSpecular *= mix(1.0, 0.55, dk);
        }`
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        #ifndef USE_TRANSMISSION
        // plastic scatters light, so the shell reads as white, not grey
        totalEmissiveRadiance += diffuseColor.rgb * 0.16 * smoothstep(0.55, 0.85, dot(diffuseColor.rgb, vec3(0.3333)));
        #endif`
      )
      .replace(
        '#include <tonemapping_fragment>',
        `{
          vec2 fc = gl_FragCoord.xy;
          vec2 cell = floor(fc / uCell);
          float h = padHash(cell);
          float ink = texture2D(uInk, (cell + 0.5) * uCell / uRes).r * uInkGain;
          float flip = max(step(0.5 + (h - 0.5) * 0.4, ink), step(h, uPix));
          if (flip > 0.5) {
            float lum = dot(gl_FragColor.rgb, vec3(0.2126, 0.7152, 0.0722));
            float q = floor(clamp(lum * 1.35, 0.0, 0.999) * 4.0);
            q = mod(q + step(0.94, padHash(cell + floor(uPadT * 14.0))), 4.0);
            vec3 c = q < 0.5 ? vec3(0.025, 0.012, 0.06) : q < 1.5 ? vec3(0.62, 0.03, 0.36) : q < 2.5 ? vec3(0.0, 0.72, 0.78) : vec3(1.0, 0.96, 0.86);
            vec2 f = fract(fc / uCell);
            float grid = step(0.12, f.x) * step(0.12, f.y);
            c *= (0.7 + 0.6 * h) * mix(0.3, 1.0, grid) * 1.5;
            gl_FragColor.rgb = c;
          }
        }
        #include <tonemapping_fragment>`
      );
  };
}

/** a DualSense holder, 1 unit wide, face toward the camera and tilted back like a product shot */
export function makePad(src, { envMap, fx } = {}) {
  const root = src.clone(true);
  const CLEAR = /^(btn_cross|btn_circle|btn_square|btn_triangle|btn_ps)$/;
  const RED = new THREE.Color(9, 0.4, 0.45), BLUE = new THREE.Color(0.6, 1.6, 12);
  const SYMBOL = { btn_triangle: RED, btn_circle: RED, btn_cross: BLUE, btn_square: BLUE };
  root.traverse((o) => {
    if (!o.isMesh) return;
    const src0 = o.material;
    let part = o;
    while (part && !/^(body|btn_|dpad|stick_|touchpad|l1|l2|r1|r2)/.test(part.name)) part = part.parent;
    const name = part ? part.name.replace(/_\d+$/, '') : '';
    let p;
    if (CLEAR.test(name)) {
      // face buttons and the PS button: clear, slightly blue-grey plastic you can see into
      p = new THREE.MeshPhysicalMaterial({
        map: src0.map || null, color: '#dfe3e9', roughness: 0.24, metalness: 0,
        clearcoat: 0.6, clearcoatRoughness: 0.14, ior: 1.49,
        iridescence: 0.15, iridescenceIOR: 1.35, iridescenceThicknessRange: [220, 480],
        envMap: envMap || null, envMapIntensity: 1.1,
        alphaTest: src0.alphaTest || 0, side: src0.side,
      });
    } else {
      // the shell: a clean satin white, the face plate a deep gloss black (roughness split in the shader)
      p = new THREE.MeshPhysicalMaterial({
        map: src0.map || null, color: '#ffffff', roughness: 0.4, metalness: 0,
        clearcoat: 0.25, clearcoatRoughness: 0.2,
        iridescence: 0.06, iridescenceIOR: 1.3, iridescenceThicknessRange: [180, 520],
        envMap: envMap || null, envMapIntensity: 0.85,
        alphaTest: src0.alphaTest || 0, side: src0.side,
      });
    }
    p.name = src0.name;
    if (fx) { p.userData.extraPatch = padPatch(fx); p.userData.patchKey = CLEAR.test(name) ? 'pad-clear' : 'pad'; }
    // the printed symbols on the face buttons light up: red, and the cross in the studio yellow
    const sym = SYMBOL[name];
    if (sym && src0.name === 'dualsense_mat1') {
      const base = p.userData.extraPatch;
      p.userData.extraPatch = (shader) => {
        if (base) base(shader);
        shader.uniforms.uSym = { value: sym };
        shader.fragmentShader = shader.fragmentShader
          .replace('#include <common>', '#include <common>\nuniform vec3 uSym;')
          .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += uSym * (1.0 - smoothstep(0.25, 0.5, dot(diffuseColor.rgb, vec3(0.3333))));');
      };
      p.userData.patchKey = sym === BLUE ? 'pad-sym-b' : 'pad-sym-r';
    }
    o.material = p;
  });
  // the sticks are only caps in the model; give each a pivot deep inside the shell so it tilts like a real stick
  const sticks = [];
  for (const name of ['stick_l', 'stick_r']) {
    const s = root.getObjectByName(name);
    if (!s) continue;
    const pivot = new THREE.Group();
    pivot.position.copy(s.position).add(new THREE.Vector3(0, -70, 0));
    s.parent.add(pivot);
    pivot.add(s);
    s.position.set(0, 70, 0);
    sticks.push(pivot);
  }
  const pick = (n) => root.getObjectByName(n);
  const buttons = ['btn_cross', 'btn_circle', 'btn_square', 'btn_triangle'].map(pick).filter(Boolean).map((b) => ({ o: b, y: b.position.y }));
  const triggers = ['r2', 'l2'].map(pick).filter(Boolean).map((t) => ({ o: t, rx: t.rotation.x }));

  const box = new THREE.Box3().setFromObject(root);
  const c = box.getCenter(new THREE.Vector3());
  const k = 1 / (box.max.x - box.min.x);
  root.position.copy(c).multiplyScalar(-k);
  root.scale.multiplyScalar(k);
  const tilt = new THREE.Group(); tilt.rotation.x = Math.PI / 2 - 0.5; tilt.add(root);
  const holder = new THREE.Group(); holder.add(tilt);
  holder.userData = { sticks, buttons, triggers, press: 0, root };
  return holder;
}

/*
  Lights where the real controller has them: a thin red light bar on the seam
  down each side of the touchpad, five player LEDs in a row beneath it with
  the middle one lit, and the mute LED, orange while the button is held.
*/
/** add the lights; call after the shot has been sampled into particles */
let GLOW_TEX = null;
function glowTexture() {
  if (GLOW_TEX) return GLOW_TEX;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  GLOW_TEX = new THREE.CanvasTexture(c);
  return GLOW_TEX;
}

/** glowSprites: where no bloom pass runs (phones), soft light sprites along the bar make the same glow */
export function addPadLights(holder, { glowSprites = false } = {}) {
  const u = holder.userData, root = u.root;
  holder.updateMatrixWorld(true);
  u.bars = [];
  const tp = root.getObjectByName('touchpad');
  if (tp) {
    // The light bar on the real controller is one thin line per side, in the gap between the
    // touchpad and the shell: it follows the touchpad's curved side from the top edge down and
    // bends inward at the bottom corner. Trace that outline from the vertices the camera sees.
    const P = tp.geometry.attributes.position, N = tp.geometry.attributes.normal;
    const view = new THREE.Vector3(0, 0.877, 0.479);   // toward the camera, in model space
    const up = new THREE.Vector3(0, 0.479, -0.877);    // screen up, in model space
    const pts = [];
    const v = new THREE.Vector3(), n = new THREE.Vector3();
    for (let i = 0; i < P.count; i++) {
      n.fromBufferAttribute(N, i);
      if (n.dot(view) < 0.35) continue;
      v.fromBufferAttribute(P, i);
      pts.push({ p: v.clone(), t: v.dot(up) });
    }
    const t0 = Math.min(...pts.map((q) => q.t)), t1 = Math.max(...pts.map((q) => q.t));
    const NB = 22;
    for (const sign of [-1, 1]) {
      const edge = [];
      for (let k = 3; k <= NB; k++) {
        const lo = t1 - ((t1 - t0) * k) / NB, hi = lo + (t1 - t0) / NB;
        let best = null;
        for (const q of pts) if (q.t <= hi && q.t >= lo - 1e-6 && (!best || q.p.x * sign > best.p.x * sign)) best = q;
        if (best && best.p.x * sign > 0.2) edge.push(best.p.clone().add(new THREE.Vector3(sign * 0.008, 0, 0)).addScaledVector(view, 0.006));
      }
      if (edge.length < 4) continue;
      const curve = new THREE.CatmullRomCurve3(edge, false, 'centripetal');
      const core = new THREE.Mesh(new THREE.TubeGeometry(curve, 96, 0.012, 8, false), new THREE.MeshBasicMaterial({ color: new THREE.Color(0, 0, 0) }));
      tp.add(core);
      u.bars.push(core.material);
      if (glowSprites) {
        // phones render without a bloom pass: two layers of soft light along the bar, a bright
        // inner glow and a wide halo, drawn untoned so the light reads as light, not paint
        for (let k = 0; k < 14; k++) {
          const t = 0.08 + (k / 13) * 0.92;
          for (const [size, layer] of [[0.075, 'inner'], [0.24, 'halo']]) {
            const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: new THREE.Color(0, 0, 0), blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, transparent: true, toneMapped: false }));
            sp.position.copy(curve.getPoint(t)).addScaledVector(view, 0.01);
            sp.scale.setScalar(size * (0.75 + 0.5 * t));
            sp.renderOrder = 4;
            sp.userData.layer = layer;
            tp.add(sp);
            (u.glows || (u.glows = [])).push(sp);
          }
        }
      }
      // a real light source in the gap, so the glow lands on the touchpad edge and the shell beside it
      const lamp = new THREE.PointLight('#2f7dff', 0, 0.6, 2);
      lamp.position.copy(curve.getPoint(0.55)).addScaledVector(view, 0.06);
      tp.add(lamp);
      (u.lamps || (u.lamps = [])).push(lamp);
    }
  }
  // player LED row, found by casting down onto the shell just below the touchpad
  const body = [];
  root.getObjectByName('body')?.traverse((o) => { if (o.isMesh) body.push(o); });
  const rc = new THREE.Raycaster();
  const q = new THREE.Quaternion(); root.getWorldQuaternion(q);
  const down = new THREE.Vector3(0, -1, 0).applyQuaternion(q);
  const ledMat = (c) => new THREE.MeshBasicMaterial({ color: c, toneMapped: true, transparent: true, opacity: 0 });
  u.leds = [];
  [-16, -8, 0, 8, 16].forEach((x, i) => {
    const o = root.localToWorld(new THREE.Vector3(x, 300, -73));
    rc.set(o, down);
    const hit = rc.intersectObjects(body, false)[0];
    if (!hit) return;
    const pLocal = root.worldToLocal(hit.point.clone());
    const led = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 1.5), ledMat(i === 2 ? new THREE.Color(2.4, 2.4, 2.3) : new THREE.Color(0.06, 0.06, 0.07)));
    led.position.copy(pLocal).add(new THREE.Vector3(0, 0.6, 0));
    led.rotation.x = -Math.PI / 2;
    root.add(led); u.leds.push(led);
  });
  const mute = root.getObjectByName('btn_mute');
  if (mute) {
    const mm = [];
    mute.traverse((o) => { if (o.isMesh) mm.push(o); });
    u.muteMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 0.75, 0.1), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    mm.forEach((m) => { const g = new THREE.Mesh(m.geometry, u.muteMat); g.renderOrder = 3; m.add(g); });
  }
}

/** sticks lean toward the cursor, a click presses cross, squeezes the triggers and lights the mute LED */
export function animatePad(pad, px, py, press, dt, time = 0, on = 1) {
  const u = pad.userData;
  for (const s of u.sticks) {
    s.rotation.x += ((-py * 0.32) - s.rotation.x) * Math.min(1, dt * 10);
    s.rotation.z += ((-px * 0.32) - s.rotation.z) * Math.min(1, dt * 10);
  }
  u.press += (press - u.press) * Math.min(1, dt * 18);
  u.buttons.forEach((b, i) => { b.o.position.y = b.y - (i === 0 ? u.press * 7 : 0); });
  u.triggers.forEach((t) => { t.o.rotation.x = t.rx + u.press * 0.32; });
  // the light bar breathes slowly, the way the real one idles
  const k = on * (0.85 + 0.15 * Math.sin(time * 1.6));
  // DualSense blue: a hot core that blooms, lamps that light the plastic around it
  if (u.bars) u.bars.forEach((m) => m.color.setRGB(0.5 * k, 2.6 * k, 16 * k));
  if (u.lamps) u.lamps.forEach((l) => { l.intensity = 0.02 * k; });
  if (u.glows) u.glows.forEach((sp) => { if (sp.userData.layer === 'inner') sp.material.color.setRGB(0.45 * k, 0.75 * k, 1.0 * k); else sp.material.color.setRGB(0.05 * k, 0.22 * k, 0.75 * k); });
  if (u.leds) u.leds.forEach((l) => { l.material.opacity = on; });
  if (u.muteMat) u.muteMat.opacity = on * u.press;
}
