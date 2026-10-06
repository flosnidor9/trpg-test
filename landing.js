(() => {
  const art = document.querySelector('.playstyle-art');
  const actions = document.querySelector('.landing-actions');
  if (!art || !actions) return;
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  let hovered = null;
  let focused = null;
  const needle = art.querySelector('.compass-needle');
  const face = art.querySelector('.compass-face');
  const compass = { angle: 28, target: 28, bearing: 0, faceAngle: 0, velocity: 0, drag: null, coasting: false };
  const renderNeedle = () => needle.setAttribute('transform', `rotate(${compass.angle} 160 180)`);
  const renderFace = () => { face.style.transform = `rotate(${compass.faceAngle}deg)`; };
  function seekNorth() {
    compass.coasting = false;
    // Choose a nearby north alignment, keeping the momentum through the first overshoot.
    compass.target = compass.bearing + Math.round((compass.angle + compass.velocity * .12 - compass.bearing) / 360) * 360;
  }
  function spinNeedle(velocity) {
    // The compass plate receives some of the impulse; its N becomes the new heading.
    compass.bearing += velocity * .12;
    if (motion.matches) {
      compass.angle = compass.target = compass.faceAngle = compass.bearing;
      compass.velocity = 0;
      compass.coasting = false;
      renderNeedle();
      renderFace();
      return;
    }
    compass.velocity = velocity;
    compass.coasting = true;
  }
  let activeAction = null;
  const sync = () => {
    const active = hovered || focused;
    art.dataset.feature = active?.dataset.feature || 'discover';
    if (active && active !== activeAction && !compass.drag) spinNeedle(active.dataset.feature === 'profile' ? -680 : 680);
    activeAction = active;
  };
  actions.querySelectorAll('[data-feature]').forEach(link => {
    link.addEventListener('pointerenter', event => { if (event.pointerType === 'touch') return; hovered = link; sync(); });
    link.addEventListener('pointerleave', () => { hovered = null; sync(); });
    link.addEventListener('focus', () => { focused = link; sync(); });
    link.addEventListener('blur', () => { focused = null; sync(); });
  });
  const stage = art.querySelector('.art-stage');
  function pointerAngle(event) {
    // Convert into SVG coordinates so scaling and mobile layouts keep the same pivot.
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(needle.ownerSVGElement.getScreenCTM().inverse());
    const x = point.x - 160, y = point.y - 180;
    return Math.hypot(x, y) < 12 ? null : Math.atan2(y, x) * 180 / Math.PI;
  }
  const angleDelta = (from, to) => ((to - from + 540) % 360) - 180;
  needle.addEventListener('pointerdown', event => {
    if (event.button !== 0 || motion.matches || compass.drag) return;
    compass.drag = { id: event.pointerId, angle: pointerAngle(event), time: event.timeStamp };
    compass.velocity = 0;
    compass.coasting = false;
    needle.classList.add('is-dragging');
    needle.setPointerCapture(event.pointerId);
    event.preventDefault();
  });
  needle.addEventListener('pointermove', event => {
    const drag = compass.drag;
    if (!drag || drag.id !== event.pointerId || motion.matches) return;
    const angle = pointerAngle(event);
    if (angle !== null && drag.angle !== null) {
      const delta = angleDelta(drag.angle, angle);
      compass.angle += delta;
      compass.bearing += delta * .25;
      const seconds = Math.max((event.timeStamp - drag.time) / 1000, .008);
      compass.velocity = Math.max(-1440, Math.min(1440, delta / seconds * 1.5));
      renderNeedle();
    }
    drag.angle = angle;
    drag.time = event.timeStamp;
  });
  function releaseNeedle(event) {
    const drag = compass.drag;
    if (!drag || drag.id !== event.pointerId) return;
    // Holding still before release should stop the flick's momentum.
    if (event.type === 'pointercancel' || event.timeStamp - drag.time > 100) compass.velocity = 0;
    compass.drag = null;
    spinNeedle(compass.velocity);
    needle.classList.remove('is-dragging');
    if (needle.hasPointerCapture(event.pointerId)) needle.releasePointerCapture(event.pointerId);
  }
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(type => needle.addEventListener(type, releaseNeedle));
  const bodies = [...stage.querySelectorAll('.orbit-body')];
  const svgNS = 'http://www.w3.org/2000/svg';
  const { makeDie, rotate, subtract, dot, cross } = window.TRPGDice;
  const dice = bodies.map((body, index) => {
    const mesh = makeDie(Number(body.dataset.die));
    const svg = body.querySelector('svg');
    const faces = mesh.faces.map(face => {
      const group = document.createElementNS(svgNS, 'g');
      const polygon = document.createElementNS(svgNS, 'polygon');
      const ink = document.createElementNS(svgNS, 'path');
      ink.classList.add('face-number');
      ink.dataset.number = face.label;
      group.append(polygon, ink);
      svg.append(group);
      return { ...face, group, polygon, inkElement: ink };
    });
    return { body, svg, vertices: mesh.vertices, faces, angles: [.6 + index * .3, .5 + index * .7, .25], velocity: [0,0,0], hue: [170,315,245][index], drag: null };
  });
  function renderDie(die) {
    const vertices = die.vertices.map(vertex => rotate(vertex, die.angles));
    const projectVertex = ([x,y,z]) => [32 + x * 25 * 4 / (4 - z), 32 + y * 25 * 4 / (4 - z)];
    const shown = [];
    die.faces.forEach(face => {
      const points = face.indices.map(index => vertices[index]);
      const center = points.reduce((sum, point) => sum.map((value, axis) => value + point[axis] / points.length), [0,0,0]);
      const normal = cross(subtract(points[1], points[0]), subtract(points[2], points[0]));
      const length = Math.hypot(...normal);
      const facing = dot(normal, subtract([0,0,4], center)) > 0;
      face.group.style.display = facing ? '' : 'none';
      if (!facing) return;
      face.polygon.setAttribute('points', points.map(point => projectVertex(point).map(value => value.toFixed(2)).join(',')).join(' '));
      const light = dot(normal.map(value => value / length), [-.3,-.4,.85]);
      face.polygon.setAttribute('fill', `hsl(${die.hue} 42% ${44 + Math.max(0, light) * 25}%)`);
      const inkPath = face.ink.map(stroke => stroke.map((point, index) => {
        const [x,y] = projectVertex(rotate(point, die.angles));
        return `${index ? 'L' : 'M'}${x.toFixed(2)} ${y.toFixed(2)}`;
      }).join(' ')).join(' ');
      face.inkElement.setAttribute('d', inkPath);
      face.inkElement.setAttribute('stroke-width', (25 * face.height * .075 * 4 / (4 - center[2])).toFixed(2));
      face.inkElement.style.opacity = String(.8 + Math.max(0, light) * .18);
      shown.push({ group: face.group, depth: center[2] });
    });
    shown.sort((a,b) => a.depth - b.depth).forEach(face => die.svg.append(face.group));
  }
  const planes = [
    { tilt: 68 * Math.PI / 180, rotation: -25 * Math.PI / 180, radius: .55, period: 22000 },
    { tilt: 58 * Math.PI / 180, rotation: 54 * Math.PI / 180, radius: .48, period: 29000 }
  ];
  let geometry;
  let frame = 0;
  let elapsed = 0;
  let previous = null;
  let visible = true;
  function impulse(die, strength = 9) {
    if (motion.matches) {
      die.angles = die.angles.map((angle, index) => angle + .6 + index * .2);
      renderDie(die);
      return;
    }
    die.velocity = [strength * .65, strength, strength * .35];
  }
  dice.forEach(die => {
    const body = die.body;
    body.addEventListener('pointerenter', event => { if (event.pointerType !== 'touch') impulse(die, 8); });
    body.addEventListener('pointerdown', event => {
      if (event.button !== 0) return;
      impulse(die, 14);
      if (event.pointerType !== 'mouse') return;
      die.drag = { x: event.clientX, y: event.clientY, id: event.pointerId };
      body.classList.add('is-dragging');
      body.setPointerCapture(event.pointerId);
    });
    body.addEventListener('pointermove', event => {
      if (!die.drag || motion.matches) return;
      const dx = event.clientX - die.drag.x;
      const dy = event.clientY - die.drag.y;
      const clamp = value => Math.max(-24, Math.min(24, value));
      die.velocity = [clamp(-dy * .35), clamp(dx * .35), clamp((dx - dy) * .12)];
      die.angles[0] -= dy * .035;
      die.angles[1] += dx * .035;
      die.drag.x = event.clientX;
      die.drag.y = event.clientY;
    });
    const release = () => { die.drag = null; body.classList.remove('is-dragging'); };
    body.addEventListener('pointerup', release);
    body.addEventListener('pointercancel', release);
    body.addEventListener('lostpointercapture', release);
  });
  function project(angle, plane) {
    const radius = geometry.size * plane.radius;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius * Math.cos(plane.tilt);
    const z = Math.sin(angle) * radius * Math.sin(plane.tilt);
    const scale = geometry.perspective / (geometry.perspective - z);
    return {
      x: (x * Math.cos(plane.rotation) - y * Math.sin(plane.rotation)) * scale,
      y: (x * Math.sin(plane.rotation) + y * Math.cos(plane.rotation)) * scale,
      z, scale, depth: Math.sin(angle)
    };
  }
  const entranceDice = new WeakMap();
  function draw(time) {
    const entrance = document.querySelector('.entrance-compass');
    if (entrance && !entranceDice.has(entrance)) {
      entranceDice.set(entrance, dice.map(die => {
        const body = entrance.querySelector(`[data-die="${die.body.dataset.die}"]`);
        const svg = body.querySelector('svg');
        const faces = die.faces.map(face => {
          const inkElement = svg.querySelector(`[data-number="${face.label}"]`);
          const group = inkElement.parentElement;
          return { ...face, group, polygon: group.querySelector('polygon'), inkElement };
        });
        return { body, svg, faces };
      }));
    }
    dice.forEach((die, index) => {
      const body = die.body;
      const plane = planes[Number(body.dataset.orbit)];
      const angle = Number(body.dataset.phase) + time / plane.period * Math.PI * 2;
      const point = project(angle, plane);
      const scale = point.scale * (.88 + (point.depth + 1) * .14);
      body.style.transform = `translate3d(calc(-50% + ${point.x}px), calc(-50% + ${point.y}px), 0) scale(${scale})`;
      body.style.opacity = String(.58 + (point.depth + 1) * .21);
      body.style.zIndex = point.z >= 0 ? '4' : '-1';
      renderDie(die);
      const copy = entrance && entranceDice.get(entrance)[index];
      if (copy) {
        copy.body.style.transform = body.style.transform;
        copy.body.style.opacity = body.style.opacity;
        copy.body.style.zIndex = body.style.zIndex;
        renderDie({ ...die, ...copy });
      }
    });
  }
  function measure() {
    const width = stage.clientWidth;
    const height = stage.clientHeight;
    geometry = { size: Math.max(100, Math.min(width - 110, height - 60)), perspective: Math.min(width, height) * 2.2 };
    stage.querySelectorAll('.orbit-trails').forEach(svg => {
      svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
      const front = svg.classList.contains('orbit-trails-front');
      planes.forEach((plane, index) => {
        const points = [];
        for (let step = 0; step <= 90; step++) {
          const point = project((front ? 0 : Math.PI) + step / 90 * Math.PI, plane);
          points.push(`${step ? 'L' : 'M'}${(width / 2 + point.x).toFixed(2)} ${(height / 2 + point.y).toFixed(2)}`);
        }
        svg.querySelector(`[data-orbit="${index}"]`).setAttribute('d', points.join(' '));
      });
    });
    draw(motion.matches ? 0 : elapsed);
  }
  function tick(now) {
    const delta = previous === null ? 0 : Math.min(now - previous, 64) / 1000;
    elapsed += delta * 1000;
    compass.faceAngle += (compass.bearing - compass.faceAngle) * (1 - Math.exp(-8 * delta));
    renderFace();
    if (!compass.drag) {
      if (compass.coasting) {
        compass.angle += compass.velocity * (1 - Math.exp(-1.6 * delta)) / 1.6;
        compass.velocity *= Math.exp(-1.6 * delta);
        if (Math.abs(compass.velocity) < 190) seekNorth();
      } else {
        // A damped magnetic pull settles north with a small, decaying oscillation.
        let remaining = delta;
        while (remaining > 0) {
          const step = Math.min(remaining, 1 / 120);
          compass.velocity += ((compass.target - compass.angle) * 55 - compass.velocity * 7) * step;
          compass.angle += compass.velocity * step;
          remaining -= step;
        }
        if (Math.abs(compass.target - compass.angle) < .05 && Math.abs(compass.velocity) < .2) {
          compass.angle = compass.target;
          compass.velocity = 0;
        }
      }
      renderNeedle();
    }
    dice.forEach(die => {
      const speed = hovered || focused ? 2.4 : .12;
      die.angles = die.angles.map((angle, index) => (angle + (speed * [ .6, 1, .35 ][index] + die.velocity[index]) * delta) % (Math.PI * 2));
      die.velocity = die.velocity.map(value => value * Math.exp(-1.7 * delta));
    });
    previous = now;
    draw(elapsed);
    frame = requestAnimationFrame(tick);
  }
  function updateAnimation() {
    cancelAnimationFrame(frame);
    frame = 0;
    previous = null;
    if (motion.matches) {
      if (compass.drag) {
        const id = compass.drag.id;
        compass.drag = null;
        needle.classList.remove('is-dragging');
        if (needle.hasPointerCapture(id)) needle.releasePointerCapture(id);
      }
      compass.velocity = 0;
      compass.coasting = false;
      compass.angle = compass.target = compass.faceAngle = compass.bearing;
      renderNeedle();
      renderFace();
      draw(0);
    }
    else if (!document.hidden && (document.body.dataset.entrance === 'compass' || (visible && (!document.body.dataset.entrance || ['content', 'ready'].includes(document.body.dataset.entrance))))) frame = requestAnimationFrame(tick);
  }
  measure();
  if ('ResizeObserver' in window) new ResizeObserver(measure).observe(stage);
  else window.addEventListener('resize', measure);
  motion.addEventListener('change', updateAnimation);
  document.addEventListener('visibilitychange', updateAnimation);
  document.addEventListener('landingphasechange', updateAnimation);
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(entries => {
      visible = entries[0].isIntersecting;
      updateAnimation();
    }).observe(stage);
  }
  updateAnimation();
  if (!('IntersectionObserver' in window)) return;
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      if (!motion.matches) entry.target.classList.add('is-arriving');
      observer.unobserve(entry.target);
    });
  }, { threshold: .15 });
  document.querySelectorAll('.journey-steps article').forEach(card => observer.observe(card));
})();
