(() => {
  const scene = document.querySelector('.orbit-scene');
  if (!scene) return;

  const people = [...scene.querySelectorAll('.orbit-person')];
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const turn = Math.PI * 2;
  const period = 18000;
  let frame = 0;
  let start = 0;
  let elapsed = 0;
  let visible = true;

  function position(time) {
    const size = scene.clientWidth;
    const radiusX = size * .405;
    const radiusY = size * .213;
    const tilt = -18 * Math.PI / 180;
    const angle = time / period * turn;

    people.forEach((person, index) => {
      const phase = index * turn / people.length;
      const x = Math.cos(angle + phase) * radiusX;
      const y = Math.sin(angle + phase) * radiusY;
      const dx = x * Math.cos(tilt) - y * Math.sin(tilt);
      const dy = x * Math.sin(tilt) + y * Math.cos(tilt);
      const depth = Math.sin(angle + phase);
      const scale = .78 + (depth + 1) * .17;
      person.style.transform = `translate3d(calc(-50% + ${dx}px), calc(-50% + ${dy}px), 0) scale(${scale})`;
      person.style.zIndex = depth > 0 ? '4' : '2';
      person.style.opacity = String(.78 + (depth + 1) * .11);
    });
  }

  function tick(now) {
    if (!start) start = now - elapsed;
    elapsed = now - start;
    position(elapsed);
    frame = requestAnimationFrame(tick);
  }

  function sync() {
    cancelAnimationFrame(frame);
    frame = 0;
    start = 0;
    if (motion.matches) {
      position(0);
    } else if (visible && !document.hidden) {
      frame = requestAnimationFrame(tick);
    }
  }

  const observer = new IntersectionObserver(entries => {
    visible = entries[0].isIntersecting;
    sync();
  });
  observer.observe(scene);
  motion.addEventListener('change', sync);
  document.addEventListener('visibilitychange', sync);
  window.addEventListener('resize', () => position(motion.matches ? 0 : elapsed));
  position(0);
})();
