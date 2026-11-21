# ARFORGE · Software foundry by Arfat

**Live:** https://arfatarfart.github.io/arforge/

A portfolio built like one long hero section. One WebGL stage sits behind the whole page and
travels between **real, photoscanned 3D objects** as you scroll. Every section has its own
theme, every headline word moves the way it means, and every number on the page is measured live.

## What is real here

| Asset | Source | Licence |
|---|---|---|
| Marble bust, classic laptop, circuit board, digital watch, cross pein hammer | [Poly Haven](https://polyhaven.com/models) photogrammetry scans | CC0 |
| Studio lighting (`studio_small_09`) | Poly Haven HDRI | CC0 |
| Earth day, night lights, clouds, specular | NASA imagery via the three.js examples | Public domain |
| Technology logos | [Simple Icons](https://simpleicons.org) | CC0 |
| Work screenshots | Headless captures of Arfat's live GitHub Pages projects | Own work |
| Work data, repo counts, terminal requests | GitHub REST API, called live from the browser | n/a |

## The ideas

- **One continuous stage.** `src/gl/stage.js` maps scroll position to a float like `2.4`
  (40% of the way from shot 2 to shot 3). The outgoing mesh burns away with a glowing forge edge,
  its surface becomes ~28k particles sampled from the real scan and coloured by its real texture,
  the particles ride a curl noise current, and the next object is forged in.
- **Semantic motion.** `src/fx/words.js` holds 32 word effects. "Blink" blinks, "late" arrives late,
  "Zero" empties into an outline, "measured" prints its own pixel width. Each effect carries a reason.
- **Why mode.** Press `W` (or the Why button) and every animated element shows a pin explaining
  why it moves the way it does. The 3D scene switches to x-ray wireframe.
- **Themes from materials.** Obsidian, ivory, blueprint, acid, phosphor, ember, paper, spectrum,
  instrument, chalk and void. Colours, cursor shape, background texture and particle ink change together.
- **Proof, not claims.** The proof panel reads frame rate, frame time, points drawn, draw calls,
  bytes transferred and time to first strike from your own browser.
- **The footer is a hero too.** A real Earth lit by where the sun is this minute, pointed at your
  time zone, with letters that heat up near your cursor and cool slowly like metal.

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
  themes.js          the eleven section themes
  ui.js              cursor, magnetic buttons, nav, Why mode, synthesised sound
  sections.js        work, stack sphere, live metrics, terminal, phone demo, process, footer
  fx/words.js        semantic word effects and the tagline reveal
  gl/stage.js        renderer, shots, layouts, loading, hammer strikes, Earth
  gl/particles.js    morph field, embers, sparks
  gl/materials.js    forge dissolve, hero scan slices, Earth and atmosphere shaders
  gl/targets.js      surface sampling of real meshes into particle targets
  gl/screen.js       the live code display mapped onto the laptop screen
public/
  models/            meshopt + WebP compressed GLBs
  hdri/  textures/   lighting and Earth maps
  work/              screenshots of live projects
```

Designed and engineered by Arfat.
