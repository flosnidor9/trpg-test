/* 빠른 회전의 관성, 포인터를 따라 눌리는 카드와 대각선 반사광. */
(() => {
function init(root = document) {
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const pointer = matchMedia('(hover: hover) and (pointer: fine)');
  const slots = root.querySelectorAll('.handout-slot');
  const resets = [];
  const listeners = new AbortController();
  const listen = (target, type, handler) => target.addEventListener(type, handler, { signal: listeners.signal });
  const sizeReflection = slot => {
    const card = slot.querySelector('.taste-card');
    const copy = card.querySelector('.handout-copy');
    const cutout = card.querySelector('.handout-shine-cutout');
    if (!cutout || !card.offsetWidth || !card.offsetHeight) return;
    const sx = 310 / card.offsetWidth, sy = 620 / card.offsetHeight;
    cutout.setAttribute('x', String(14 * sx));
    cutout.setAttribute('y', String(14 * sy));
    cutout.setAttribute('width', String((card.offsetWidth - 28) * sx));
    cutout.setAttribute('height', String(Math.max(0, copy.offsetTop - 14) * sy));
  };
  const resizeObserver = globalThis.ResizeObserver && new ResizeObserver(entries => entries.forEach(entry => sizeReflection(entry.target)));
  slots.forEach(slot => { sizeReflection(slot); resizeObserver?.observe(slot); });
  let observer;
  if (!motion.matches && globalThis.IntersectionObserver) {
    observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-revealed');
        observer.unobserve(entry.target);
      });
    }, { threshold: .12 });
    slots.forEach(slot => { slot.classList.add('motion-ready'); observer.observe(slot); });
  }
  slots.forEach(slot => {
    const card = slot.querySelector('.taste-card');
    const shine = slot.querySelector('.handout-shine');
    let hovered = false, focused = false, active = false, frame = 0, last = 0;
    let angle = 0, angularVelocity = 0, spinGoal = 0;
    let spinFinished = true;
    let scale = 1, scaleVelocity = 0, tiltX = 0, tiltY = 0, velocityX = 0, velocityY = 0;
    let x = 0, y = 0;
    let depth = 0;
    const tick = time => {
      const dt = Math.min((time - last) / 1000 || 1 / 60, .032);
      last = time;
      // 한 바퀴를 빠르게 통과한 뒤, 목표 각도 너머로 살짝 넘어갔다가 감쇠합니다.
      angularVelocity += ((spinGoal - angle) * 100 - angularVelocity * 17) * dt;
      angle += angularVelocity * dt;
      if (!spinFinished && Math.abs(spinGoal - angle) < .5 && Math.abs(angularVelocity) < 8) {
        angle = spinGoal; angularVelocity = 0; spinFinished = true;
      }
      const scaleGoal = active ? 1.14 : 1;
      scaleVelocity += ((scaleGoal - scale) * 180 - scaleVelocity * 23) * dt;
      scale += scaleVelocity * dt;
      const targetX = active && spinFinished ? -y * 10 : 0;
      const targetY = active && spinFinished ? x * 12 : 0;
      velocityX += ((targetX - tiltX) * 160 - velocityX * 22) * dt;
      velocityY += ((targetY - tiltY) * 160 - velocityY * 22) * dt;
      tiltX += velocityX * dt; tiltY += velocityY * dt;
      const depthGoal = active && spinFinished ? 1 : 0;
      depth += (depthGoal - depth) * (1 - Math.exp(-20 * dt));
      card.style.transform = `translateY(${-(scale - 1) * 85}px) rotateY(${angle + tiltY}deg) rotateX(${tiltX}deg) scale(${scale})`;
      const strength = Math.min(1, Math.max(0, (scale - 1) / .14));
      shine.style.opacity = String(.45 + strength * .35);
      card.style.setProperty('--shine-offset-x', `${tiltY * 5}px`);
      card.style.setProperty('--shine-offset-y', `${-tiltX * 5}px`);
      card.style.setProperty('--parallax-x', String(tiltY / 12));
      card.style.setProperty('--parallax-y', String(-tiltX / 10));
      card.style.setProperty('--parallax-depth', String(depth));
      const settled = Math.abs(spinGoal - angle) < .03 && Math.abs(angularVelocity) < .08
        && Math.abs(scaleGoal - scale) < .0002 && Math.abs(scaleVelocity) < .001
        && Math.abs(targetX - tiltX) < .02 && Math.abs(targetY - tiltY) < .02
        && Math.abs(velocityX) + Math.abs(velocityY) < .08 && Math.abs(depthGoal - depth) < .001;
      if (!settled) frame = requestAnimationFrame(tick);
      else {
        frame = 0;
        if (!active) { slot.classList.remove('is-active'); card.style.transform = ''; shine.style.opacity = ''; clearLayers(); }
      }
    };
    const wake = () => { if (!frame) { last = performance.now(); frame = requestAnimationFrame(tick); } };
    const update = () => {
      const next = !motion.matches && (hovered || focused);
      if (next && !active) {
        angle %= 360; spinGoal = 360; angularVelocity = 2800;
        spinFinished = false; tiltX = tiltY = velocityX = velocityY = 0;
        slot.classList.add('is-active');
      }
      active = next; wake();
    };
    const position = event => {
      const bounds = slot.getBoundingClientRect();
      x = Math.max(-1, Math.min(1, (event.clientX - bounds.left) / bounds.width * 2 - 1));
      y = Math.max(-1, Math.min(1, (event.clientY - bounds.top) / bounds.height * 2 - 1));
      if (active) wake();
    };
    listen(slot, 'pointerenter', event => {
      if (!pointer.matches || motion.matches || event.pointerType === 'touch') return;
      hovered = true; position(event); update();
    });
    listen(slot, 'pointermove', event => { if (hovered) position(event); });
    const leave = () => { if (!hovered) return; hovered = false; x = y = 0; update(); };
    listen(slot, 'pointerleave', leave);
    listen(slot, 'pointercancel', leave);
    listen(card, 'focus', () => {
      slot.classList.add('is-revealed'); observer?.unobserve(slot);
      if (motion.matches || !pointer.matches) return;
      focused = true; update();
    });
    listen(card, 'blur', () => { if (!focused) return; focused = false; update(); });
    const clearLayers = () => {
      ['--parallax-x', '--parallax-y', '--parallax-depth', '--shine-offset-x', '--shine-offset-y'].forEach(name => card.style.removeProperty(name));
    };
    resets.push(() => {
      cancelAnimationFrame(frame); frame = 0;
      hovered = focused = active = false;
      angle = angularVelocity = spinGoal = scaleVelocity = tiltX = tiltY = velocityX = velocityY = x = y = 0;
      scale = 1; depth = 0; card.style.transform = ''; shine.style.opacity = '';
      clearLayers();
      spinFinished = true;
      slot.classList.remove('is-active', 'motion-ready');
    });
  });
  const onMotionChange = event => {
    if (!event.matches) return;
    observer?.disconnect(); resets.forEach(reset => reset());
  };
  motion.addEventListener('change', onMotionChange);
  const onPointerChange = () => { if (!pointer.matches) resets.forEach(reset => reset()); };
  pointer.addEventListener('change', onPointerChange);
  return () => { observer?.disconnect(); resizeObserver?.disconnect(); resets.forEach(reset => reset()); listeners.abort(); motion.removeEventListener('change', onMotionChange); pointer.removeEventListener('change', onPointerChange); };
}
globalThis.TRPGResultMotion = { init };
document.addEventListener('DOMContentLoaded', () => { if (document.body.classList.contains('result-page')) init(); }, { once: true });
})();
