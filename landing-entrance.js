(() => {
  const body = document.body;
  const stage = document.querySelector('.playstyle-art .art-stage');
  if (!stage) return;
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  let clone = null;
  let started = false;
  let finished = false;
  const animations = new Set();

  function phase(value) {
    body.dataset.entrance = value;
    document.dispatchEvent(new Event('landingphasechange'));
  }
  function finish() {
    if (finished) return;
    finished = true;
    phase('ready');
    animations.forEach(animation => animation.cancel());
    animations.clear();
    clone?.remove();
    clone = null;
    document.removeEventListener('landingintroend', start);
    document.removeEventListener('focusin', onFocus);
    document.removeEventListener('keydown', onKey);
    document.removeEventListener('click', onClick);
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('resize', finish);
    window.removeEventListener('scroll', onScroll);
    window.removeEventListener('pagehide', finish);
    motion.removeEventListener('change', onMotion);
  }
  function animate(element, frames, options) {
    const animation = element.animate(frames, { fill: 'both', ...options });
    animations.add(animation);
    if (document.hidden) animation.pause();
    return animation.finished;
  }
  function onFocus(event) {
    if (!event.target.closest('.landing-intro')) finish();
  }
  function onClick(event) {
    if (!started || finished || event.target.closest('.landing-intro')) return;
    event.preventDefault();
    event.stopPropagation();
    finish();
  }
  function onKey(event) {
    if (event.defaultPrevented || event.repeat) return;
    if (!started || finished || body.dataset.intro === 'playing') return;
    if (!['Escape', 'Enter', ' '].includes(event.key)) return;
    event.preventDefault();
    finish();
  }
  function onMotion() { if (motion.matches) finish(); }
  function onScroll() { if (started) finish(); }
  function onVisibility() {
    animations.forEach(animation => document.hidden ? animation.pause() : animation.play());
  }
  async function start() {
    if (started || finished) return;
    started = true;
    if (motion.matches || typeof stage.animate !== 'function') { finish(); return; }
    phase('compass');
    const rect = stage.getBoundingClientRect();
    const dial = stage.querySelector('.compass-dial').getBoundingClientRect();
    clone = stage.cloneNode(true);
    clone.classList.add('entrance-compass');
    // Keep SVG gradient IDs unique while the compass copy is in the document.
    clone.querySelectorAll('[id]').forEach(element => { element.id += '-entrance'; });
    clone.querySelectorAll('[fill^="url(#"]').forEach(element => {
      element.setAttribute('fill', element.getAttribute('fill').replace(')', '-entrance)'));
    });
    Object.assign(clone.style, { left: rect.left + 'px', top: rect.top + 'px', width: rect.width + 'px', height: rect.height + 'px' });
    body.append(clone);
    const dx = innerWidth/2 - (rect.left + rect.width/2);
    const dy = innerHeight*.46 - (rect.top + rect.height/2);
    const scale = Math.min(1.65, innerWidth*.82/dial.width, innerHeight*.72/dial.height);
    const centered = size => `translate(${dx}px, ${dy}px) scale(${size})`;
    try {
      await animate(clone, [
        { opacity: 0, transform: centered(scale*.65) },
        { opacity: 1, transform: centered(scale) }
      ], { duration: 420, easing: 'cubic-bezier(.16,.75,.22,1)' });
      if (finished) return;
      await animate(clone, [
        { transform: centered(scale), offset: 0 },
        { transform: centered(scale), offset: .16 },
        { transform: 'translate(0, 0) scale(1)', offset: 1 }
      ], { duration: 860, easing: 'cubic-bezier(.4,0,.18,1)' });
      if (finished) return;
      phase('content');
      clone.remove(); clone = null;
      const reveal = (element, delay = 0, duration = 360) => animate(element, [
        { opacity: 0, transform: 'translateY(12px)' },
        { opacity: 1, transform: 'translateY(0)' }
      ], { delay, duration, easing: 'cubic-bezier(.2,.7,.2,1)' });
      const pending = [];
      const lines = [...document.querySelectorAll('.hero-copy > .eyebrow, .hero-title-line, .hero-description-line')];
      lines.forEach((line, index) => pending.push(reveal(line, 100 + index*180)));
      document.querySelectorAll('.landing-action').forEach((button, index) => pending.push(reveal(button, 1050 + index*160)));
      pending.push(reveal(document.querySelector('.hero-note'), 1460));
      document.querySelectorAll('.landing-header, .art-topline, .art-bottomline, .journey-guide, .landing-footer').forEach((element, index) => pending.push(reveal(element, 120 + index*100)));
      await Promise.all(pending);
      finish();
    } catch {
      // Cancellation by focus, resize or motion preferences reveals the page immediately.
      finish();
    }
  }
  document.addEventListener('focusin', onFocus);
  document.addEventListener('keydown', onKey);
  document.addEventListener('click', onClick);
  document.addEventListener('visibilitychange', onVisibility);
  document.addEventListener('landingintroend', start);
  window.addEventListener('resize', finish);
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('pagehide', finish);
  motion.addEventListener('change', onMotion);
  if (body.dataset.intro !== 'playing') start();
})();
