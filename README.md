# Arfat Studio · Websites, apps and backends

**Live:** https://arfatarfart.github.io/arforge/

A portfolio built like one long hero section. One WebGL stage sits behind the whole page and
travels between **real 3D objects** as you scroll. Every section has its own theme, every piece
of text moves for a reason, and every number on the page is measured live.

## What is real here

| Asset | Source | Licence |
|---|---|---|
| Marble bust, classic laptop, circuit board, cross pein hammer (2K) | [Poly Haven](https://polyhaven.com/models) photogrammetry scans | CC0 |
| Studio lighting (`studio_small_09`) | Poly Haven HDRI | CC0 |
| iPhone 15 Pro Max (Apps phone) | [polyman on Sketchfab](https://sketchfab.com/3d-models/apple-iphone-15-pro-max-black-df17520841214c1792fb8a44c6783ee7), logo hidden, materials and screen replaced | CC BY 4.0 |
| PlayStation 5 DualSense (hero) | [AHarmlessPotato on Sketchfab](https://sketchfab.com/3d-models/playstation-5-dualsense-878c1f882808477ab81c2fe86d5a3936), logos removed, materials and lights replaced | CC BY 4.0 |
| MacBook Pro (Apps) | [pmndrs/examples](https://github.com/pmndrs/examples), floating laptop demo, screen replaced | MIT |
| Earth day, night lights, clouds, normals, star map | NASA Blue Marble and Black Marble (via the three-globe package) | Public domain |
| Technology logos | [Simple Icons](https://simpleicons.org) | CC0 |
| Script type | Yellowtail via Fontsource | OFL |
| Work section concepts (Lumen, Nocturne, Ember & Oak, Pulse Club, Wander Atlas) | Designed and built in the studio, hosted under `public/concepts/` | Own work |
| MacBook and iPhone screens | A studio wallpaper painted in code (`src/gl/wallpaper.js`) | Own work |
| Repo counts, terminal requests, ISS position | GitHub REST API and wheretheiss.at, called live from the browser | n/a |

## The ideas

- **An ink hero.** A yellow stage, the ARFAT wordmark and a "studio" written by hand (the
  script is thinned to its centre line and revealed in pen order). A real DualSense floats in
  the centre: its sticks lean toward your cursor, a click presses the cross button, squeezes the
  triggers and lights the mute LED, and a red light bar glows along both touchpad seams. Your
  cursor leaves a ribbon of black ink a little wider than itself. Under the ink is a second
  edition of the hero: white letters, and a controller made of bright pixels. Fast moves tear it
  into glitch slices.
- **A dotted intro.** One yellow dot, a gooey X, then a diamond grid of dots with cyan and magenta
  rims that swell along a diagonal wave, melt into ribbons and flood the screen yellow.
- **Exact colour.** Flat sections use a tone curve that only rolls off highlights, and their
  colours are fed through its inverse, so the yellow on screen is the yellow in the CSS.
- **One site, two screens.** In Apps a MacBook and a smaller iPhone in front of it run the same
  site and scroll together off one shared clock, so you see the page reflow from laptop to phone.
- **Six strikes.** In Process the real 3D hammer flies to each milestone and strikes its plate.
  Each blow cracks the plate where it lands; the sixth blow breaks it into falling shards.
- **Text with motion design.** Body copy rises line by line out of masks, section labels decode
  from random glyphs, spec rows wipe in the direction you read, FAQ questions arrive word by word,
  and headline words move the way they mean (`src/fx/words.js`).
- **Cinematic finish.** MSAA HDR buffer, bloom, Neutral tone mapping, vignette and a touch of
  chromatic aberration on desktop. Every motion is damped.
- **One continuous stage.** `src/gl/stage.js` maps scroll position to a float like `2.4`
  (40% of the way from shot 2 to shot 3). The outgoing mesh burns away with a glowing forge edge,
  its surface becomes particles sampled from the real model and coloured by its texture,
  and the next object is forged in. The Earth forms slowly so its colours have time to settle.
- **Why mode.** Press `W` (or the Why button) and every animated element shows a pin explaining
  why it moves the way it does.
- **Proof, not claims.** The proof panel reads frame rate, frame time, points drawn, draw calls,
  bytes transferred and time to first strike from your own browser.
- **The footer is a hero too.** A real Earth lit by where the sun is this minute, with the live
  position of the International Space Station.

## Run it

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # outputs dist/ with base /arforge/
```

Pushing to `main` builds and deploys to GitHub Pages through `.github/workflows/deploy.yml`.

## Configure

`src/config.js` holds the GitHub username and an optional contact email. With an email set,
the contact form opens a ready to send message. Without one it copies the brief and offers a GitHub issue.

## Structure

```
src/
  main.js            boot, scroll to shot mapping, theme triggers
  themes.js          the section themes
  ui.js              cursor, magnetic buttons, nav, Why mode, synthesised sound
  sections.js        work, stack sphere, live metrics, terminal, process, footer
  fx/intro.js        the opening spark and colour flood
  fx/words.js        semantic word effects and the tagline reveal
  fx/textmotion.js   line, label, spec and FAQ text motion
  fx/texture.js      gradient typography with a cursor sheen
  gl/stage.js        renderer, shots, layouts, loading, hammer strikes, Earth
  gl/fluid.js        stable fluids solver and the ink that reveals the second edition
  gl/title.js        the ARFAT wordmark drawn for the fluid
  gl/phone.js        iPhone and MacBook setup, Safari and macOS screens, pixel VFX
  gl/particles.js    morph field and sparks
  gl/materials.js    forge dissolve, Earth and atmosphere shaders
  gl/targets.js      surface sampling of real meshes into particle targets
  gl/screen.js       the live code display mapped onto the laptop screen
public/
  models/            compressed GLBs
  hdri/  textures/   lighting and Earth maps
  work/              screenshots of live projects
```

Designed and engineered by Arfat.
