import gsap from 'gsap';
import { SplitText } from 'gsap/SplitText';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ScrambleTextPlugin } from 'gsap/ScrambleTextPlugin';

gsap.registerPlugin(SplitText, ScrollTrigger, ScrambleTextPlugin);

/*
  Motion for every piece of text, each kind with its own reason:
  · body copy rises line by line out of a mask, the way type is set on a press
  · section labels decode from random glyphs, like a terminal resolving a name
  · spec rows wipe in left to right, the direction you read them
  · FAQ questions arrive word by word, at the pace of someone asking
*/
const once = (el, start = 'top 88%') => ({ trigger: el, start, once: true });

export function initTextMotion({ reduced } = {}) {
  if (reduced) return;
  const paras = document.querySelectorAll('.chapter-body, .work-sub, .stack-copy > p.body-3, .metrics-head > p, .footer-sub, .tagline-note, .process-note, .step > p.body-3, .gpu');
  paras.forEach((p) => {
    const split = SplitText.create(p, { type: 'lines', mask: 'lines', linesClass: 'ln-m' });
    gsap.from(split.lines, { yPercent: 115, duration: 1.05, ease: 'expo.out', stagger: 0.075, scrollTrigger: once(p) });
  });
  document.querySelectorAll('.sec-label').forEach((l) => {
    const node = [...l.childNodes].find((n) => n.nodeType === 3 && n.textContent.trim());
    if (!node) return;
    const lab = document.createElement('span'); lab.className = 'lab'; lab.textContent = node.textContent.trim();
    node.replaceWith(' ', lab);
    const text = lab.textContent;
    gsap.set(lab, { opacity: 0 });
    ScrollTrigger.create({ ...once(l, 'top 90%'), onEnter: () => {
      gsap.set(lab, { opacity: 1 });
      gsap.to(lab, { duration: 1.1, scrambleText: { text, chars: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/', revealDelay: 0.25, speed: 0.6 } });
    } });
    gsap.from(l.querySelector('span'), { scale: 0, rotate: -90, duration: 0.8, ease: 'back.out(2.4)', scrollTrigger: once(l, 'top 90%') });
  });
  document.querySelectorAll('.spec-list').forEach((list) => {
    const rows = list.querySelectorAll('li');
    gsap.from(rows, { clipPath: 'inset(0% 100% 0% 0%)', duration: 0.9, ease: 'expo.inOut', stagger: 0.09, scrollTrigger: once(list) });
    rows.forEach((r, i) => {
      const cap = r.querySelector('.caption-4'); if (!cap) return;
      const t = cap.textContent;
      ScrollTrigger.create({ ...once(list), onEnter: () => gsap.to(cap, { delay: 0.2 + i * 0.09, duration: 0.8, scrambleText: { text: t, chars: 'lowerCase', speed: 0.8 } }) });
    });
  });
  document.querySelectorAll('.qa summary .title-1').forEach((q) => {
    const split = SplitText.create(q, { type: 'words', wordsClass: 'qw' });
    gsap.from(split.words, { y: 18, opacity: 0, duration: 0.7, ease: 'expo.out', stagger: 0.035, scrollTrigger: once(q, 'top 92%') });
  });
  document.querySelectorAll('.card-body .title-1, .card-desc').forEach((t) => {
    gsap.from(t, { y: 16, opacity: 0, duration: 0.8, ease: 'expo.out', scrollTrigger: once(t, 'top 94%') });
  });
}

/* the hero's small type, after the wordmark has risen */
export function heroTextIn({ reduced = false, delay = 1 } = {}) {
  const els = [...document.querySelectorAll('#hero .reveal-up')];
  if (reduced) { gsap.set(els, { opacity: 1, y: 0 }); return; }
  gsap.set(els, { opacity: 1, y: 0 });
  const line = document.querySelector('.hero-line');
  if (line) {
    const split = SplitText.create(line, { type: 'lines', mask: 'lines' });
    gsap.from(split.lines, { yPercent: 120, duration: 1.1, ease: 'expo.out', stagger: 0.1, delay });
  }
  const acts = document.querySelectorAll('.hero-actions > *');
  gsap.from(acts, { y: 26, opacity: 0, scale: 0.92, duration: 0.9, ease: 'back.out(1.8)', stagger: 0.1, delay: delay + 0.25 });
  document.querySelectorAll('.hero-hint, .hero-proof').forEach((el, i) => {
    const t = el.textContent;
    gsap.fromTo(el, { opacity: 0 }, { opacity: 1, duration: 0.2, delay: delay + 0.4 + i * 0.15 });
    const target = el.children.length ? null : el;
    if (target) gsap.to(target, { delay: delay + 0.4 + i * 0.15, duration: 1, scrambleText: { text: t.trim(), chars: '01<>/·', speed: 0.7 } });
  });
}
