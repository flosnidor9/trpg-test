(() => {
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  if (motion.matches) return;

  const intro = document.createElement('div');
  intro.className = 'landing-intro';
  intro.innerHTML = `<canvas class="intro-dice" aria-hidden="true"></canvas>
    <div class="intro-title" aria-hidden="true"><span>TRPG</span><span>성향</span><span>테스트</span></div>
    <button class="intro-skip" type="button">건너뛰기 <span aria-hidden="true">↗</span></button>`;
  const canvas = intro.querySelector('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  document.body.dataset.entrance = 'waiting';
  document.body.dataset.intro = 'playing';
  document.body.append(intro);
  const words = [...intro.querySelectorAll('.intro-title span')];
  const palette = [265, 164, 318, 247];
  let width, height, count, frame = 0, previous = null, elapsed = 0, finished = false;
  const dice = [];
  const random = (min, max) => min + Math.random() * (max - min);
  const { makeDie, rotate, subtract, dot, cross } = window.TRPGDice;
  const types = [4, 6, 8, 10, 12, 20, 100];
  const meshes = new Map(types.map(type => [type, makeDie(type)]));

  function measure() {
    const oldWidth = width || innerWidth;
    const oldHeight = height || innerHeight;
    width = intro.clientWidth;
    height = intro.clientHeight;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const averageRadius = width < 600 ? 62 : 87.5;
    count = Math.min(110, Math.max(24, Math.round(width * height * .78 / (Math.PI * (averageRadius * .92) ** 2))));
    dice.forEach(die => { die.x *= width / oldWidth; die.y += height - oldHeight; });
  }
  function finish() {
    if (finished) return;
    finished = true;
    cancelAnimationFrame(frame);
    intro.remove();
    document.body.dataset.intro = 'done';
    document.dispatchEvent(new Event('landingintroend'));
    window.removeEventListener('resize', measure);
    window.removeEventListener('pagehide', finish);
    document.removeEventListener('keydown', onKey);
    document.removeEventListener('focusin', onFocus);
    document.removeEventListener('visibilitychange', onVisibility);
    motion.removeEventListener('change', onMotion);
  }
  function onClick(event) {
    // One click advances only this scene, not the entrance it starts.
    event.stopPropagation();
    finish();
  }
  function onKey(event) {
    if (event.repeat) return;
    if (!['Escape', 'Enter', ' '].includes(event.key)) return;
    event.preventDefault();
    finish();
  }
  // Keyboard navigation reveals the focused landing action immediately.
  function onFocus(event) { if (!intro.contains(event.target)) finish(); }
  function onMotion() { if (motion.matches) finish(); }
  function onVisibility() {
    cancelAnimationFrame(frame);
    previous = null;
    if (!finished && !document.hidden) frame = requestAnimationFrame(tick);
  }
  function spawn() {
    const r = random(width < 600 ? 48 : 70, width < 600 ? 76 : 105);
    const type = types[dice.length % types.length];
    const hue = palette[dice.length % palette.length];
    dice.push({ x: random(r, width - r), y: -r * 2, r, vx: random(-90, 90), vy: random(50, 180), angle: random(0, Math.PI * 2), spin: random(-4, 4), type, sprite: makeSprite(meshes.get(type), hue, r) });
  }
  function simulate(dt, released) {
    dice.forEach(die => {
      die.vy += 1450 * dt;
      die.x += die.vx * dt;
      die.y += die.vy * dt;
      die.angle += die.spin * dt;
      if (die.x < die.r || die.x > width - die.r) {
        die.x = Math.max(die.r, Math.min(width - die.r, die.x));
        die.vx *= -.35;
      }
      if (!released && die.y > height - die.r) {
        die.y = height - die.r;
        die.vy = die.vy > 70 ? -die.vy * .18 : 0;
        die.vx *= .88;
        die.spin *= .8;
      }
    });
    if (released) return;
    // A few short collision passes keep the pile stable without a physics dependency.
    for (let pass = 0; pass < 3; pass++) {
      for (let i = 0; i < dice.length; i++) for (let j = i + 1; j < dice.length; j++) {
        const a = dice[i], b = dice[j];
        const dx = b.x - a.x, dy = b.y - a.y, radius = (a.r + b.r) * .92;
        if (Math.abs(dx) >= radius || Math.abs(dy) >= radius) continue;
        const distance = Math.hypot(dx, dy) || .01;
        if (distance >= radius) continue;
        const nx = dx / distance, ny = dy / distance;
        const overlap = (radius - distance) / 2;
        a.x -= nx * overlap; a.y -= ny * overlap;
        b.x += nx * overlap; b.y += ny * overlap;
        const approach = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
        if (approach < 0) {
          const impulse = -approach * .55;
          a.vx -= impulse * nx; a.vy -= impulse * ny;
          b.vx += impulse * nx; b.vy += impulse * ny;
          a.spin *= .94; b.spin *= .94;
        }
      }
      dice.forEach(die => {
        die.x = Math.max(die.r, Math.min(width - die.r, die.x));
        die.y = Math.min(height - die.r, die.y);
      });
    }
  }
  function makeSprite(mesh, hue, radius) {
    const sprite = document.createElement('canvas');
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const size = Math.ceil(radius * 2 + 6);
    sprite.width = sprite.height = Math.ceil(size * dpr);
    const paint = sprite.getContext('2d');
    paint.setTransform(dpr, 0, 0, dpr, size/2*dpr, size/2*dpr);
    const angles = [random(0,Math.PI*2), random(0,Math.PI*2), random(0,Math.PI*2)];
    const vertices = mesh.vertices.map(vertex => rotate(vertex, angles));
    const project = point => [point[0] * radius, point[1] * radius];
    const faces = mesh.faces.map(face => {
      const points = face.indices.map(i => vertices[i]);
      const normal = cross(subtract(points[1], points[0]), subtract(points[2], points[0]));
      const center = points.reduce((sum, point) => sum.map((value, axis) => value + point[axis]/points.length), [0,0,0]);
      return { face, points, normal, center };
    }).filter(face => face.normal[2] > 1e-6).sort((a,b) => a.center[2] - b.center[2]);
    paint.lineJoin = 'round'; paint.lineCap = 'round';
    faces.forEach(({ face, points, normal }) => {
      const length = Math.hypot(...normal);
      const light = dot(normal.map(value => value/length), [-.3,-.4,.85]);
      paint.beginPath();
      points.forEach((point, index) => { const [x,y] = project(point); index ? paint.lineTo(x,y) : paint.moveTo(x,y); });
      paint.closePath();
      paint.fillStyle = 'hsl(' + hue + ' 34% ' + (43 + Math.max(0,light)*28) + '%)';
      paint.fill(); paint.strokeStyle = '#ffffff99'; paint.lineWidth = .7; paint.stroke();
      paint.beginPath();
      face.ink.forEach(stroke => stroke.forEach((point, index) => {
        const [x,y] = project(rotate(point, angles));
        index ? paint.lineTo(x,y) : paint.moveTo(x,y);
      }));
      paint.strokeStyle = '#fff'; paint.lineWidth = Math.max(.7, radius*face.height*.08); paint.stroke();
    });
    return { canvas: sprite, size };
  }
  function drawDie(die) {
    if (die.y - die.r > height || die.y + die.r < 0) return;
    ctx.save(); ctx.translate(die.x,die.y); ctx.rotate(die.angle);
    ctx.drawImage(die.sprite.canvas, -die.sprite.size/2, -die.sprite.size/2, die.sprite.size, die.sprite.size);
    ctx.restore();
  }
  function tick(now) {
    if (finished) return;
    const dt = previous === null ? 0 : Math.min((now - previous) / 1000, .04);
    previous = now; elapsed += dt;
    const target = Math.floor(count * Math.min(1, elapsed / 2.5));
    while (dice.length < target) spawn();
    const released = elapsed >= 3.45;
    for (let step = 0; step < 3; step++) simulate(dt / 3, released);
    ctx.clearRect(0, 0, width, height);
    dice.forEach(drawDie);
    words.forEach((word, index) => {
      const age = elapsed - (.4 + index * .48);
      const falling = Math.max(0, elapsed - (3.38 + index * .1));
      const pop = Math.min(1, Math.max(0, age / .24));
      word.style.opacity = age < 0 ? '0' : '1';
      word.style.transform = `translateY(${(1-pop)*24 + 900*falling*falling}px) rotate(${falling * (index === 1 ? -22 : 17)}deg) scale(${.78 + .22 * (1 - (1-pop)**3)})`;
    });
    if (elapsed >= 4.55) intro.style.opacity = String(Math.max(0, 1 - (elapsed - 4.55) / .25));
    if (elapsed >= 4.8) finish();
    else frame = requestAnimationFrame(tick);
  }
  intro.addEventListener('click', onClick);
  window.addEventListener('resize', measure);
  window.addEventListener('pagehide', finish);
  document.addEventListener('keydown', onKey);
  document.addEventListener('focusin', onFocus);
  document.addEventListener('visibilitychange', onVisibility);
  motion.addEventListener('change', onMotion);
  measure();
  if (!document.hidden) frame = requestAnimationFrame(tick);
})();
