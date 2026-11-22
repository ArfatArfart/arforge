import gsap from 'gsap';

/*
  Every section is its own world. Colours are not decoration here: each
  palette is chosen from the material the section talks about.
  obsidian  marble in a dark studio         blueprint  engineering drawings
  ivory     the paper a manifesto lives on  acid       OLED phone screens
  phosphor  terminal green on black         ember      the forge itself
  paper     editorial print for real work   spectrum   every tool, every hue
  instrument amber dials on a dark panel    chalk      a whiteboard of questions
  void      space around the planet
*/
export const THEMES = {
  molten:     { bg: '#FDEA2C', fg: '#0A0A0A', muted: '#3D360A', accent: '#0A0A0A', accentInk: '#FDEA2C', line: 'rgba(10,10,10,0.2)', surface: 'rgba(10,10,10,0.06)', gradA: '#0A0A0A', gradB: '#3D360A', dark: false, flat: true, env: 1.0, particles: 0.9 },
  obsidian:   { aura: ['#10264f', '#2e2216', '#1c1233'], bg: '#000000', fg: '#F5F5F7', muted: '#86868B', accent: '#FF5A1F', accentInk: '#000000', line: 'rgba(242,239,233,0.14)', surface: 'rgba(255,255,255,0.05)', gradA: '#FFFFFF', gradB: '#9B9B9B', dark: true, embers: 0.75, env: 0.9, particles: 1 },
  ivory:      { bg: '#EDEAE3', fg: '#131209', muted: '#6E6A62', accent: '#E8461A', accentInk: '#FFFFFF', line: 'rgba(19,18,9,0.14)', surface: 'rgba(19,18,9,0.04)', gradA: '#000000', gradB: '#666666', dark: false, embers: 0, env: 1.1, particles: 0.55 },
  blueprint:  { bg: '#0A1A33', fg: '#E6EEFF', muted: '#8FA3C7', accent: '#5CC8FF', accentInk: '#04101F', line: 'rgba(92,200,255,0.16)', surface: 'rgba(92,200,255,0.06)', gradA: '#FFFFFF', gradB: '#8FA3C7', dark: true, embers: 0.12, env: 1.0, particles: 1 },
  acid:       { bg: '#0E0F0B', fg: '#F4F7EC', muted: '#9EA393', accent: '#C6FF3D', accentInk: '#0E0F0B', line: 'rgba(198,255,61,0.16)', surface: 'rgba(198,255,61,0.05)', gradA: '#FFFFFF', gradB: '#9EA393', dark: true, embers: 0.1, env: 1.1, particles: 1 },
  phosphor:   { bg: '#030805', fg: '#C9FFD9', muted: '#5FA77A', accent: '#39FF88', accentInk: '#021006', line: 'rgba(57,255,136,0.18)', surface: 'rgba(57,255,136,0.05)', gradA: '#C9FFD9', gradB: '#5FA77A', dark: true, embers: 0.15, env: 0.8, particles: 1 },
  ember:      { bg: '#131209', fg: '#FFE9D6', muted: '#B59A84', accent: '#FF6A1A', accentInk: '#131209', line: 'rgba(255,106,26,0.22)', surface: 'rgba(255,106,26,0.06)', gradA: '#FFFFFF', gradB: '#B59A84', dark: true, embers: 1, env: 0.75, particles: 1 },
  paper:      { bg: '#F2F0EB', fg: '#111111', muted: '#6B6861', accent: '#2B4BFF', accentInk: '#FFFFFF', line: 'rgba(17,17,17,0.12)', surface: 'rgba(17,17,17,0.04)', gradA: '#000000', gradB: '#666666', dark: false, embers: 0, env: 1.1, particles: 0.5 },
  spectrum:   { bg: '#181818', fg: '#F5F5F5', muted: '#9A9A9A', accent: '#B69CFF', accentInk: '#120D21', line: 'rgba(255,255,255,0.12)', surface: 'rgba(255,255,255,0.05)', gradA: '#FFFFFF', gradB: '#9B9B9B', dark: true, embers: 0.1, env: 1.0, particles: 1 },
  instrument: { bg: '#1F1F1F', fg: '#F7F3E8', muted: '#A39E92', accent: '#FFB000', accentInk: '#1F1F1F', line: 'rgba(255,176,0,0.2)', surface: 'rgba(255,176,0,0.05)', gradA: '#FFFFFF', gradB: '#A39E92', dark: true, embers: 0.2, env: 1.0, particles: 0.9 },
  chalk:      { bg: '#E9E6DF', fg: '#1B1B1B', muted: '#6A665E', accent: '#E8336F', accentInk: '#FFFFFF', line: 'rgba(27,27,27,0.14)', surface: 'rgba(27,27,27,0.04)', gradA: '#000000', gradB: '#666666', dark: false, embers: 0, env: 1.1, particles: 0.3 },
  void:       { bg: '#000000', fg: '#FFFFFF', muted: '#8E8E93', accent: '#FF7A2F', accentInk: '#000000', line: 'rgba(255,255,255,0.14)', surface: 'rgba(255,255,255,0.05)', gradA: '#FFFFFF', gradB: '#9B9B9B', dark: true, embers: 0.35, env: 1.0, particles: 1 },
};

let current = null;
export function applyTheme(name, stage, instant = false) {
  if (name === current || !THEMES[name]) return;
  current = name;
  const t = THEMES[name];
  const root = document.documentElement;
  root.dataset.theme = name;
  const vars = {
    '--bg': t.bg, '--fg': t.fg, '--muted': t.muted, '--accent': t.accent, '--accent-ink': t.accentInk,
    '--line': t.line, '--surface': t.surface, '--grad-a': t.gradA, '--grad-b': t.gradB,
  };
  if (instant) Object.entries(vars).forEach(([k, v]) => root.style.setProperty(k, v));
  else gsap.to(root, { ...vars, duration: 0.9, ease: 'power2.out', overwrite: 'auto' });
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t.bg);
  stage?.setTheme(t, instant ? 0 : 0.9);
}
