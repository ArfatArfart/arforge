import gsap from 'gsap';
import { SplitText } from 'gsap/SplitText';
import { ScrambleTextPlugin } from 'gsap/ScrambleTextPlugin';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(SplitText, ScrambleTextPlugin, ScrollTrigger);

/*
  Semantic motion.
  Rule of the system: every word moves the way it means.
  Each effect below carries its own reason (`why`), which the Why mode
  prints next to the word on screen.
*/

const R = gsap.utils.random;
const accent = () => getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#ff5a1f';
const fgc = () => getComputedStyle(document.documentElement).getPropertyValue('--fg').trim() || '#ffffff';
const GLYPHS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const rndChar = () => GLYPHS[Math.floor(Math.random() * GLYPHS.length)];

function chars(el) {
  if (!el._split) el._split = SplitText.create(el, { type: 'chars', charsClass: 'ch', tag: 'span' });
  return el._split.chars;
}
function add(el, cls, tag = 'span') {
  const n = document.createElement(tag);
  n.className = cls;
  n.setAttribute('aria-hidden', 'true');
  el.appendChild(n);
  return n;
}
function shakeHeading(el, amt = 7) {
  const h = el.closest('h1,h2,h3') || el;
  gsap.fromTo(h, { x: -amt }, { x: 0, duration: 0.6, ease: 'elastic.out(1, 0.3)', clearProps: 'x' });
}

export const FX = {
  rough: {
    why: 'Raw arrives jagged and never fully settles. Raw things are unfinished.',
    build(el) {
      const c = chars(el);
      return gsap.timeline()
        .from(c, { opacity: 0, x: () => R(-40, 40), y: () => R(-50, 50), rotate: () => R(-40, 40), duration: 0.09, stagger: 0.035 })
        .to(c, { x: () => R(-3, 3), y: () => R(-3, 3), rotate: () => R(-8, 8), duration: 0.06, repeat: 5, yoyo: true, ease: 'none' })
        .to(c, { x: 0, y: 0, rotate: () => R(-3, 3), duration: 0.5, ease: 'power3.out' });
    },
  },
  focus: {
    why: 'Ideas start blurry and wide, then snap into focus.',
    build(el) {
      return gsap.timeline().fromTo(el, { opacity: 0, filter: 'blur(18px)', letterSpacing: '0.3em' },
        { opacity: 1, filter: 'blur(0px)', letterSpacing: '-0.05em', duration: 1.3, ease: 'expo.out', clearProps: 'filter,letterSpacing' });
    },
  },
  enter: {
    why: 'The word "in" literally enters the line from outside it.',
    build(el) {
      return gsap.timeline().fromTo(el, { xPercent: 70, opacity: 0, clipPath: 'inset(0% 0% 0% 100%)' },
        { xPercent: 0, opacity: 1, clipPath: 'inset(0% 0% 0% 0%)', duration: 1, ease: 'expo.out', clearProps: 'clipPath' });
    },
  },
  flap: {
    why: 'Shipped flips like a departures board, because shipping is a departure.',
    build(el) {
      const c = chars(el);
      const final = c.map((x) => x.textContent);
      const tl = gsap.timeline();
      tl.set(c, { opacity: 1, transformPerspective: 500, transformOrigin: '50% 50%' }, 0);
      c.forEach((ch, i) => {
        const steps = 4 + i * 2;
        let r = 0;
        ch.textContent = rndChar();
        tl.to(ch, {
          rotateX: -90, duration: 0.05, ease: 'power1.in', repeat: steps * 2 - 1, yoyo: true,
          onRepeat() { r++; if (r % 2 === 1) ch.textContent = r >= steps * 2 - 1 ? final[i] : rndChar(); },
          onComplete() { ch.textContent = final[i]; gsap.set(ch, { rotateX: 0 }); },
        }, 0);
      });
      return tl;
    },
    prep(el) { gsap.set(chars(el), { opacity: 0 }); },
  },
  decode: {
    why: 'Software resolves out of random symbols. Code is noise turned into meaning.',
    build(el) {
      const text = el.dataset.text || el.textContent;
      el.dataset.text = text;
      return gsap.timeline().set(el, { opacity: 1 }).to(el, {
        duration: 1.6, ease: 'none',
        scrambleText: { text, chars: '01<>/{}#=+*', revealDelay: 0.35, speed: 0.7 },
      });
    },
    prep(el) { el.dataset.text = el.textContent; gsap.set(el, { opacity: 0 }); },
  },
  launch: {
    why: 'Launches upward letter by letter, like a release leaving the pad.',
    build(el) {
      const c = chars(el);
      return gsap.timeline()
        .from(c, { yPercent: 130, rotate: 14, opacity: 0, duration: 0.9, ease: 'back.out(2.2)', stagger: 0.05 })
        .to(c[c.length - 1], { y: -36, duration: 0.28, ease: 'power2.out' }, '-=0.3')
        .to(c[c.length - 1], { y: 0, duration: 0.7, ease: 'bounce.out' });
    },
  },
  count: {
    why: 'A number word counts up to itself before turning back into a word.',
    build(el) {
      const word = el.dataset.word || el.textContent;
      el.dataset.word = word;
      const to = +el.dataset.to || 3;
      const o = { v: 0 };
      return gsap.timeline()
        .set(el, { opacity: 1 })
        .call(() => el.classList.add('is-num'))
        .to(o, { v: to, duration: 0.7, ease: 'steps(' + to + ')', onUpdate: () => { el.textContent = String(Math.round(o.v)); } })
        .call(() => el.classList.remove('is-num'))
        .to(el, { duration: 0.5, scrambleText: { text: word, chars: '0123456789', speed: 1 } });
    },
    prep(el) { el.dataset.word = el.textContent; gsap.set(el, { opacity: 0 }); },
  },
  weight: {
    why: 'Gains weight as it lands. Discipline is weight you accumulate.',
    build(el) {
      return gsap.timeline().fromTo(el, { fontWeight: 100, scaleX: 1.25, opacity: 0, transformOrigin: 'left center' },
        { fontWeight: 600, scaleX: 1, opacity: 1, duration: 1.3, ease: 'expo.out', clearProps: 'fontWeight,scale' });
    },
  },
  stamp: {
    why: 'Struck once, hard, like a stamp on hot metal. One word, one impact.',
    build(el) {
      return gsap.timeline().fromTo(el, { scale: 2.6, opacity: 0, filter: 'blur(6px)' },
        { scale: 1, opacity: 1, filter: 'blur(0px)', duration: 0.32, ease: 'power4.in', clearProps: 'filter', onComplete: () => { shakeHeading(el); window.__sound?.tick(180); } });
    },
  },
  vanish: {
    why: 'Zero empties itself, leaving only the outline of the word.',
    build(el) {
      return gsap.timeline()
        .from(el, { y: 30, opacity: 0, duration: 0.6, ease: 'expo.out' })
        .call(() => el.classList.add('hollow'), null, '+=0.5');
    },
  },
  relay: {
    why: 'A highlight is passed letter to letter, the way work moves through handoffs. Then it is gone.',
    build(el) {
      const c = chars(el);
      const tl = gsap.timeline().from(c, { y: 20, opacity: 0, duration: 0.5, ease: 'expo.out', stagger: 0.03 });
      c.forEach((ch, i) => {
        tl.to(ch, { y: -10, color: accent, duration: 0.12, ease: 'power2.out' }, 0.5 + i * 0.09)
          .to(ch, { y: 0, color: fgc, duration: 0.2, ease: 'power2.in', clearProps: 'color' }, 0.62 + i * 0.09);
      });
      return tl;
    },
  },
  type: {
    why: 'Websites are typed by hand, one keystroke at a time.',
    build(el) {
      const c = chars(el);
      const caret = document.createElement('span'); caret.className = 'type-caret'; caret.setAttribute('aria-hidden', 'true');
      const tl = gsap.timeline().set(el, { opacity: 1 }).call(() => c[0].before(caret));
      c.forEach((ch, i) => tl.set(ch, { opacity: 1 }, 0.1 + i * 0.075).call(() => { ch.after(caret); window.__sound?.key(); }, null, 0.1 + i * 0.075));
      tl.call(() => caret.remove(), null, '+=1.2');
      return tl;
    },
    prep(el) { gsap.set(chars(el), { opacity: 0 }); },
  },
  load: {
    why: 'A loading bar fills under the word load. The most familiar progress there is.',
    build(el) {
      const bar = el.querySelector('.loadbar') || add(el, 'loadbar');
      return gsap.timeline()
        .set(el, { opacity: 0.35 })
        .fromTo(bar, { scaleX: 0 }, { scaleX: 1, duration: 1.1, ease: 'steps(9)' })
        .to(el, { opacity: 1, duration: 0.2 })
        .to(bar, { opacity: 0, duration: 0.5 }, '+=0.3');
    },
  },
  blink: {
    why: 'Blink blinks. Literally, twice, at the speed of an eyelid.',
    build(el) {
      return gsap.timeline()
        .from(el, { opacity: 0, duration: 0.4 })
        .to(el, { scaleY: 0.06, duration: 0.07, yoyo: true, repeat: 1, ease: 'power2.in', transformOrigin: '50% 60%' }, '+=0.25')
        .to(el, { scaleY: 0.06, duration: 0.06, yoyo: true, repeat: 1, ease: 'power2.in' }, '+=0.12');
    },
  },
  swipe: {
    why: 'Apps unlock with a swipe up from the bottom edge.',
    build(el) {
      const pill = el.querySelector('.swipe-pill') || add(el, 'swipe-pill');
      return gsap.timeline()
        .fromTo(pill, { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: 0.3 })
        .fromTo(el, { clipPath: 'inset(100% 0% 0% 0%)', y: 30 }, { clipPath: 'inset(0% 0% 0% 0%)', y: 0, duration: 0.8, ease: 'expo.out', clearProps: 'clipPath' })
        .to(pill, { y: -40, opacity: 0, duration: 0.5, ease: 'power2.in' }, '<');
    },
  },
  doors: {
    why: 'Open splits from the centre outward, like doors.',
    build(el) {
      const c = chars(el);
      const mid = (c.length - 1) / 2;
      return gsap.timeline().from(c, { x: (i) => (mid - i) * 18, opacity: 0, scaleX: 0.2, duration: 1, ease: 'expo.out' });
    },
  },
  instant: {
    why: 'No animation at all. Without thinking means without delay.',
    build() { return gsap.timeline(); },
    prep(el) { gsap.set(el, { opacity: 1 }); el.dataset.instant = '1'; },
  },
  pulse: {
    why: 'A signal travels down the word like a request down a wire.',
    build(el) {
      const c = chars(el);
      return gsap.timeline()
        .from(c, { opacity: 0, duration: 0.3, stagger: 0.02 })
        .to(c, { color: accent, textShadow: () => `0 0 18px ${accent()}`, duration: 0.1, stagger: { each: 0.05, repeat: 1, yoyo: true }, clearProps: 'color,textShadow' })
        .to(c, { color: accent, textShadow: () => `0 0 18px ${accent()}`, duration: 0.1, stagger: { each: 0.05, repeat: 1, yoyo: true }, clearProps: 'color,textShadow' });
    },
  },
  calm: {
    why: 'Starts in chaos, then the jitter decays until it is still. Calm is dampened noise.',
    build(el) {
      const c = chars(el);
      return gsap.timeline().from(c, { y: () => R(-30, 30), rotate: () => R(-30, 30), opacity: 0, duration: 2.2, ease: 'elastic.out(1, 0.22)', stagger: 0.04 });
    },
  },
  clock: {
    why: 'A clock runs to 03:00, the hour a good backend is never noticed.',
    build(el) {
      const word = el.dataset.word;
      const o = { m: 0 };
      return gsap.timeline()
        .set(el, { opacity: 1 })
        .call(() => el.classList.add('is-num'))
        .to(o, { m: 180, duration: 1.1, ease: 'power2.in', onUpdate: () => { const m = Math.round(o.m); el.textContent = `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; } })
        .call(() => el.classList.remove('is-num'), null, '+=0.25')
        .to(el, { duration: 0.5, scrambleText: { text: word, chars: '0123456789:', speed: 1 } });
    },
    prep(el) { el.dataset.word = el.textContent; gsap.set(el, { opacity: 0 }); },
  },
  strike: {
    why: 'Drops from above and lands with impact, then a slash marks the blow.',
    build(el) {
      const c = chars(el);
      const slash = el.querySelector('.slash') || add(el, 'slash');
      return gsap.timeline()
        .from(c, { yPercent: -160, opacity: 0, duration: 0.42, ease: 'power4.in', stagger: 0.03, onComplete: () => shakeHeading(el, 10) })
        .fromTo(slash, { scaleX: 0 }, { scaleX: 1, duration: 0.18, ease: 'power3.out' }, '-=0.05')
        .to(slash, { opacity: 0, duration: 0.6 }, '+=0.4');
    },
  },
  sketch: {
    why: 'Underlined by hand, because a sketch is made by hand.',
    build(el) {
      let svg = el.querySelector('.sketch-line');
      if (!svg) {
        el.insertAdjacentHTML('beforeend', '<svg class="sketch-line" viewBox="0 0 240 14" preserveAspectRatio="none" aria-hidden="true"><path d="M2 9 C 40 3, 80 13, 120 7 S 200 4, 238 9"/></svg>');
        svg = el.querySelector('.sketch-line');
      }
      const p = svg.querySelector('path');
      const L = 260;
      return gsap.timeline()
        .from(el, { opacity: 0, duration: 0.4 })
        .fromTo(p, { strokeDasharray: L, strokeDashoffset: L }, { strokeDashoffset: 0, duration: 0.9, ease: 'power2.inOut' });
    },
  },
  mark: {
    why: 'Highlighted the way an editor selects a passage.',
    build(el) {
      const m = el.querySelector('.mark-bg') || add(el, 'mark-bg');
      return gsap.timeline()
        .from(el, { opacity: 0, duration: 0.3 })
        .fromTo(m, { scaleX: 0 }, { scaleX: 1, duration: 0.7, ease: 'expo.inOut' });
    },
  },
  rec: {
    why: 'A blinking recording light means live.',
    build(el) {
      const d = el.querySelector('.rec-dot') || (() => { const n = document.createElement('span'); n.className = 'rec-dot'; n.setAttribute('aria-hidden', 'true'); el.prepend(n); return n; })();
      return gsap.timeline().from(el, { opacity: 0, x: -10, duration: 0.5, ease: 'expo.out' }).from(d, { scale: 0, duration: 0.4, ease: 'back.out(3)' }, '<');
    },
  },
  orbit: {
    why: 'Letters spiral in from orbit before falling into line.',
    build(el) {
      const c = chars(el);
      const box = el.getBoundingClientRect();
      const cx = box.width / 2;
      const offs = c.map((ch) => ch.offsetLeft + ch.offsetWidth / 2 - cx);
      const Rr = Math.max(60, box.width * 0.6);
      const o = { p: 1 };
      const draw = () => c.forEach((ch, i) => {
        const a = (i / c.length) * Math.PI * 2 + (1 - o.p) * 4;
        gsap.set(ch, { x: -offs[i] * o.p + Math.cos(a) * Rr * o.p, y: Math.sin(a) * Rr * 0.45 * o.p, rotate: o.p * 120, opacity: 1 - o.p * 0.7 });
      });
      return gsap.timeline().set(el, { opacity: 1 }).call(draw).to(o, { p: 0, duration: 1.6, ease: 'expo.inOut', onUpdate: draw });
    },
    prep(el) { gsap.set(el, { opacity: 0 }); },
  },
  anchor: {
    why: 'The problem drops heavily and stays put. Everything else orbits it.',
    build(el) {
      return gsap.timeline().from(el, { y: -70, opacity: 0, duration: 0.55, ease: 'power4.in', onComplete: () => shakeHeading(el, 5) });
    },
  },
  shake: {
    why: 'Never shakes its head.',
    build(el) {
      return gsap.timeline().from(el, { opacity: 0, duration: 0.3 }).to(el, { keyframes: { x: [-12, 12, -9, 9, -5, 5, 0] }, duration: 0.7, ease: 'power1.inOut' });
    },
  },
  spin: {
    why: 'Round turns one full circle.',
    build(el) {
      return gsap.timeline().fromTo(el, { rotate: -360, scale: 0.5, opacity: 0 }, { rotate: 0, scale: 1, opacity: 1, duration: 1.4, ease: 'expo.out' });
    },
  },
  cheap: {
    why: 'Shrinks and dims as its value drops, then gets crossed out.',
    build(el) {
      const slash = el.querySelector('.slash') || add(el, 'slash');
      return gsap.timeline()
        .from(el, { opacity: 0, duration: 0.4 })
        .to(el, { scale: 0.84, opacity: 0.5, transformOrigin: 'left bottom', duration: 0.8, ease: 'power2.inOut' }, '+=0.3')
        .fromTo(slash, { scaleX: 0 }, { scaleX: 1, duration: 0.3, ease: 'power3.out' }, '-=0.3');
    },
  },
  measure: {
    why: 'A ruler measures this word and prints its real rendered width.',
    build(el) {
      const ruler = el.querySelector('.ruler') || add(el, 'ruler');
      const val = el.querySelector('.ruler-val') || add(el, 'ruler-val caption-4 mono');
      return gsap.timeline()
        .from(el, { opacity: 0, duration: 0.4 })
        .fromTo(ruler, { scaleX: 0 }, { scaleX: 1, duration: 0.9, ease: 'expo.inOut' })
        .call(() => { val.textContent = `${el.getBoundingClientRect().width.toFixed(1)} px`; })
        .from(val, { opacity: 0, y: 6, duration: 0.4 });
    },
  },
  curious: {
    why: 'Letters tilt the way a head tilts when it asks something.',
    build(el) {
      const c = chars(el);
      return gsap.timeline()
        .from(c, { opacity: 0, y: 20, duration: 0.5, stagger: 0.03, ease: 'expo.out' })
        .to(c, { rotate: (i) => (i % 2 ? 10 : -10), y: -4, duration: 0.3, stagger: 0.02 })
        .to(c, { rotate: 0, y: 0, duration: 0.9, ease: 'elastic.out(1, 0.35)', stagger: 0.02 });
    },
  },
  before: {
    why: 'Before animates before every other word in its sentence.',
    order: -1,
    build(el) {
      return gsap.timeline().fromTo(el, { x: 80, opacity: 0 }, { x: 0, opacity: 1, duration: 0.8, ease: 'expo.out' });
    },
  },
};

/* Wrap plain words in a heading so they can enter too. */
function wrapPlain(h) {
  const walk = (node) => {
    [...node.childNodes].forEach((n) => {
      if (n.nodeType === 3 && n.textContent.trim()) {
        const frag = document.createDocumentFragment();
        n.textContent.split(/(\s+)/).forEach((part) => {
          if (!part) return;
          if (/^\s+$/.test(part)) frag.appendChild(document.createTextNode(part));
          else { const s = document.createElement('span'); s.className = 'pw'; s.textContent = part; frag.appendChild(s); }
        });
        n.replaceWith(frag);
      } else if (n.nodeType === 1 && !n.classList.contains('w') && n.tagName !== 'BR') walk(n);
    });
  };
  walk(h);
}

export function headingTimeline(h, reduced) {
  const words = [...h.querySelectorAll('.w[data-fx]')];
  const plain = [...h.querySelectorAll('.pw')];
  const tl = gsap.timeline({ paused: true });
  if (reduced) {
    tl.fromTo([...words, ...plain], { opacity: 0 }, { opacity: 1, duration: 0.4, stagger: 0.02 });
    return tl;
  }
  tl.fromTo(plain, { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.9, ease: 'expo.out', stagger: 0.04 }, 0.15);
  words.forEach((w, i) => {
    const fx = FX[w.dataset.fx];
    if (!fx) return;
    const at = fx.order === -1 ? 0 : 0.25 + i * 0.16;
    tl.add(() => { gsap.set(w, { opacity: 1 }); const sub = fx.build(w); sub.play(); }, at);
  });
  tl.to({}, { duration: 2 });
  return tl;
}

const CHAR_FX = new Set(['rough', 'flap', 'launch', 'relay', 'type', 'pulse', 'calm', 'strike', 'orbit', 'curious', 'doors']);

export function initWords({ reduced }) {
  const heads = [...document.querySelectorAll('h1,h2,h3')].filter((h) => h.querySelector('.w[data-fx]'));
  const result = new Map();
  heads.forEach((h) => {
    wrapPlain(h);
    h.querySelectorAll('.w[data-fx]').forEach((w) => {
      const fx = FX[w.dataset.fx];
      if (!fx) return;
      if (!w.dataset.why) w.dataset.why = fx.why;
      // split letter based effects up front so material textures can map every glyph
      if (CHAR_FX.has(w.dataset.fx)) chars(w);
      w.setAttribute('aria-label', w.textContent.trim());
      if (reduced) return;
      if (fx.prep) fx.prep(w);
      else gsap.set(w, { opacity: 0 });
    });
    if (!reduced) gsap.set(h.querySelectorAll('.pw'), { opacity: 0 });
    result.set(h, headingTimeline(h, reduced));
  });
  // headings play once when they enter, except the hero (played by the intro)
  result.forEach((tl, h) => {
    if (h.id === 'hero-title') return;
    ScrollTrigger.create({ trigger: h, start: 'top 82%', once: true, onEnter: () => tl.play() });
  });
  return result;
}

/* ---------------- Tagline: words light up as you reach them ---------------- */
export function initTagline(el, { reduced }) {
  const split = SplitText.create(el, { type: 'words', wordsClass: 'tw', tag: 'span' });
  const words = split.words;
  if (reduced) { words.forEach((w) => w.classList.add('on')); return; }
  words.forEach((w) => { const sem = w.closest('[data-sem]'); if (sem) w.dataset.sem = sem.dataset.sem; });
  let lit = -1;
  const setLit = (n) => {
    if (n === lit) return;
    words.forEach((w, i) => {
      const on = i <= n;
      if (on === w.classList.contains('on')) return;
      w.classList.toggle('on', on);
      const sem = w.dataset.sem;
      if (!sem) return;
      w.classList.remove('sem-run');
      if (on) { void w.offsetWidth; w.classList.add('sem-run'); if (sem === 'hardened') window.__sound?.tick(140); }
    });
    lit = n;
  };
  ScrollTrigger.create({
    trigger: el, start: 'top 78%', end: 'bottom 42%', scrub: true,
    onUpdate: (self) => setLit(Math.floor(self.progress * (words.length + 0.999)) - 1),
  });
}
