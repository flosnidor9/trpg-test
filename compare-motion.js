/* Reveal comparison sections once, when scrolling brings them into view. */
(() => {
  'use strict';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const running = new Set(), pending = new Map(), revealed = new Set();
  let previous = [], armed = false;
  function animate(element, frames, options = {}) {
    if (!element || reduced.matches) return;
    const animation = element.animate(frames, { duration: 260, easing: 'cubic-bezier(.2,.7,.2,1)', ...options });
    running.add(animation);
    animation.finished.catch(() => {}).finally(() => running.delete(animation));
  }
  function enter(element, delay = 0, distance = 20) {
    animate(element, [{ opacity: 0, transform: `translateY(${distance}px)` }, { opacity: 1, transform: 'translateY(0)' }], { delay });
  }
  function reveal(element, motion = true) {
    const key = pending.get(element);
    if (!key) return;
    pending.delete(element);
    observer.unobserve(element);
    revealed.add(key);
    element.classList.remove('scroll-reveal-pending');
    element.dataset.revealState = 'revealed';
    if (motion) enter(element, 0, 28);
    if (key === 'radar') {
      const canvas = document.querySelector('#comparison-radar');
      const sets = canvas._sets || [];
      canvas._sets = [];
      globalThis.TRPGApp.drawRadar(canvas, sets, motion, true, globalThis.TRPGCompare.comparisonAxes, false, { revealFromCenter: motion });
    }
    if (motion && key === 'conversation') element.querySelectorAll('article').forEach((card, i) => enter(card, 60 + i * 60, 16));
  }
  function revealVisible() {
    if (!armed || reduced.matches) return;
    pending.forEach((key, element) => {
      const rect = element.getBoundingClientRect();
      if (rect.top < innerHeight * .88 && rect.bottom > 0 && element.getClientRects().length) reveal(element);
    });
  }
  const observer = new IntersectionObserver(revealVisible, { threshold: 0, rootMargin: '0px 0px -12% 0px' });
  function queue(element, key) {
    if (!element) return;
    if (reduced.matches || revealed.has(key)) {
      element.classList.remove('scroll-reveal-pending');
      element.dataset.revealState = 'revealed';
      return;
    }
    element.classList.add('scroll-reveal-pending');
    element.dataset.revealState = 'waiting';
    pending.set(element, key);
    observer.observe(element);
  }
  function observeResults() {
    pending.forEach((key, element) => {
      if (!element.isConnected) { observer.unobserve(element); pending.delete(element); }
    });
    queue(document.querySelector('.compare-radar-section'), 'radar');
    queue(document.querySelector('.party-conversation'), 'conversation');
    queue(document.querySelector('.agreements-heading'), 'agreements');
    document.querySelectorAll('.operation-group').forEach((element, i) => queue(element, 'group-' + i));
    revealVisible();
  }
  addEventListener('scroll', () => {
    if (!previous.length) return;
    armed = true;
    revealVisible();
  }, { passive: true });
  document.querySelector('#comparison-output').addEventListener('focusin', event => {
    pending.forEach((key, element) => {
      if (element.contains(event.target)) reveal(element, false);
    });
  });
  reduced.addEventListener('change', () => {
    if (!reduced.matches) return;
    running.forEach(animation => animation.finish());
    pending.forEach((key, element) => reveal(element, false));
  });
  enter(document.querySelector('.compare-header'));
  globalThis.TRPGCompareMotion = {
    radarVisible() { return reduced.matches || revealed.has('radar'); },
    update(ids) {
      if (!ids.length || !previous.length) {
        armed = false;
        revealed.clear();
        observer.disconnect();
        pending.forEach((key, element) => element.classList.remove('scroll-reveal-pending'));
        pending.clear();
      }
      document.querySelectorAll('.participant-control').forEach(element => {
        const id = Number(element.querySelector('[data-person]').dataset.person);
        if (!previous.includes(id)) enter(element, 0, 14);
      });
      previous = ids;
      if (ids.length) observeResults();
    },
    panel() {
      enter(document.querySelector('#party-panel:not([hidden]), #personal-panel:not([hidden])'), 0, 12);
      revealVisible();
    }
  };
})();
