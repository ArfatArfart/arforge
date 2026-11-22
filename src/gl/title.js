import * as THREE from 'three';

/*
  The hero wordmark lives inside the WebGL scene, under the ink and the
  phone, so liquid can flow over the letters. The bold word rises letter by
  letter; the script word is written in left to right like a pen stroke.
*/
export class HeroTitle {
  constructor() {
    this.canvas = document.createElement('canvas');
    this.g = this.canvas.getContext('2d');
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.minFilter = THREE.LinearFilter;
    this.texture.generateMipmaps = false;
    this.rise = 0; this.write = 0; this.dirty = true;
    this.resize();
  }
  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = window.innerWidth; this.h = window.innerHeight; this.dpr = dpr;
    this.canvas.width = Math.round(this.w * dpr); this.canvas.height = Math.round(this.h * dpr);
    this.dirty = true;
  }
  draw() {
    if (!this.dirty) return;
    this.dirty = false;
    const { g, w, h, dpr } = this;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    const mobile = w < 760;
    const word = 'ARFAT';
    // fit the word to the screen: 90% of the width on phones, 78% on desktop
    g.font = '700 100px "Geist Variable", system-ui, sans-serif';
    if ('letterSpacing' in g) g.letterSpacing = '0px';
    const per = (g.measureText(word).width - 100 * 0.055 * (word.length - 1)) / 100;
    const size = Math.min((w * (mobile ? 0.92 : 0.86)) / per, mobile ? w * 0.34 : h * 0.44);
    g.font = `700 ${size}px "Geist Variable", system-ui, sans-serif`;
    const tw = per * size;
    const x0 = (w - tw) / 2;
    const y0 = mobile ? h * 0.36 : h * 0.6;
    // bold letters rise out of a baseline mask, one after another
    g.save();
    g.beginPath(); g.rect(0, y0 - size * 0.95, w, size * 1.12); g.clip();
    g.fillStyle = '#0a0a0a';
    let x = x0;
    for (let i = 0; i < word.length; i++) {
      const ch = word[i];
      const k = Math.min(1, Math.max(0, this.rise * 1.6 - i * 0.09));
      const e = 1 - Math.pow(1 - k, 4);
      g.fillText(ch, x, y0 + (1 - e) * size * 1.05);
      x += g.measureText(ch).width - size * 0.055;
    }
    g.restore();
    // script word, revealed like ink from a pen
    const ss = size * (mobile ? 0.36 : 0.3);
    g.save();
    g.font = `400 ${ss}px "Yellowtail", cursive`;
    const sw = g.measureText('studio').width;
    const sx = x0 + tw - sw * 0.92;
    const sy = y0 + ss * 0.95;
    g.translate(sx, sy); g.rotate(-0.09);
    g.beginPath(); g.rect(-ss * 0.2, -ss * 1.2, (sw + ss * 0.4) * this.write, ss * 2); g.clip();
    g.fillStyle = '#0a0a0a';
    g.fillText('studio', 0, 0);
    g.restore();
    this.texture.needsUpdate = true;
  }
}

export function titleMaterial(texture) {
  return new THREE.ShaderMaterial({
    uniforms: { uTex: { value: texture }, uOpacity: { value: 1 }, uShift: { value: 0 } },
    transparent: true, depthTest: false, depthWrite: false,
    vertexShader: 'uniform float uShift; varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.x, position.y + uShift, 0.0, 1.0); }',
    fragmentShader: 'uniform sampler2D uTex; uniform float uOpacity; varying vec2 vUv; void main(){ float a = texture2D(uTex, vUv).a; gl_FragColor = vec4(vec3(0.03), a * uOpacity); }',
  });
}
