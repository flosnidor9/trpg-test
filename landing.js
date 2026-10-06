(() => {
  const art = document.querySelector('.playstyle-art');
  const actions = document.querySelector('.landing-actions');
  if (!art || !actions) return;
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  let hovered = null;
  let focused = null;
  const sync = () => { art.dataset.feature = (hovered || focused)?.dataset.feature || 'discover'; };
  actions.querySelectorAll('[data-feature]').forEach(link => {
    link.addEventListener('pointerenter', event => { if (event.pointerType === 'touch') return; hovered = link; sync(); });
    link.addEventListener('pointerleave', () => { hovered = null; sync(); });
    link.addEventListener('focus', () => { focused = link; sync(); });
    link.addEventListener('blur', () => { focused = null; sync(); });
  });
  const stage = art.querySelector('.art-stage');
  const bodies = [...stage.querySelectorAll('.orbit-body')];
  const svgNS = 'http://www.w3.org/2000/svg';
  const subtract = (a, b) => a.map((value, i) => value - b[i]);
  const dot = (a, b) => a.reduce((sum, value, i) => sum + value * b[i], 0);
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const unit = vector => vector.map(value => value / Math.hypot(...vector));
  // Numeral strokes live in each face's local plane, then share its 3D projection.
  const numeralStrokes = {
    0: [[[.3,0],[.12,.04],[.02,.2],[0,.5],[.02,.8],[.12,.96],[.3,1],[.48,.96],[.58,.8],[.6,.5],[.58,.2],[.48,.04],[.3,0]]],
    1: [[[.08,.2],[.3,0],[.3,1]],[[.08,1],[.52,1]]],
    2: [[[0,.18],[.08,.04],[.3,0],[.5,.04],[.6,.2],[.58,.36],[.44,.52],[.04,.86],[0,1],[.6,1]]],
    3: [[[0,.1],[.2,0],[.44,.02],[.6,.16],[.58,.32],[.44,.46],[.24,.48]],[[.24,.48],[.46,.5],[.6,.66],[.58,.86],[.44,.98],[.2,1],[0,.9]]],
    4: [[[.45,1],[.45,0],[0,.68],[.6,.68]]],
    5: [[[.6,0],[.04,0],[0,.48],[.24,.42],[.48,.46],[.6,.62],[.58,.84],[.44,.98],[.2,1],[0,.9]]],
    6: [[[.54,.08],[.36,0],[.16,.06],[.02,.26],[0,.66],[.06,.88],[.24,1],[.44,.98],[.58,.82],[.6,.62],[.48,.48],[.26,.46],[.04,.56]]],
    7: [[[0,0],[.6,0],[.24,1]]],
    8: [[[.3,.48],[.08,.36],[.02,.18],[.12,.04],[.3,0],[.48,.04],[.58,.18],[.52,.36],[.3,.48],[.06,.62],[0,.8],[.12,.96],[.3,1],[.48,.96],[.6,.8],[.54,.62],[.3,.48]]],
    9: [[[.56,.44],[.34,.54],[.12,.52],[0,.38],[.02,.18],[.16,.02],[.36,0],[.54,.12],[.6,.34],[.58,.74],[.44,.94],[.24,1],[.06,.92]]]
  };
  function makeDie(sides) {
    let vertices = [];
    let faces = [];
    if (sides === 6) {
      vertices = [[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]];
      faces = [[0,1,2,3],[4,7,6,5],[0,4,5,1],[3,2,6,7],[0,3,7,4],[1,5,6,2]];
    } else if (sides === 10) {
      vertices = [[0,0,1.3],[0,0,-1.3]];
      const ringHeight = 1.3 * (1 - Math.cos(Math.PI / 5)) / (1 + Math.cos(Math.PI / 5));
      for (let i = 0; i < 10; i++) {
        const angle = i * Math.PI / 5;
        vertices.push([Math.cos(angle), Math.sin(angle), i % 2 ? -ringHeight : ringHeight]);
      }
      for (let i = 0; i < 10; i += 2) {
        faces.push([0, 2 + i, 2 + (i + 1) % 10, 2 + (i + 2) % 10]);
        faces.push([1, 2 + (i + 1) % 10, 2 + (i + 2) % 10, 2 + (i + 3) % 10]);
      }
    } else {
      const golden = (1 + Math.sqrt(5)) / 2;
      for (const a of [-1,1]) for (const b of [-golden,golden]) {
        vertices.push([0,a,b], [a,b,0], [b,0,a]);
      }
      for (let a = 0; a < vertices.length; a++) for (let b = a + 1; b < vertices.length; b++) for (let c = b + 1; c < vertices.length; c++) {
        const normal = cross(subtract(vertices[b], vertices[a]), subtract(vertices[c], vertices[a]));
        const distances = vertices.map(vertex => dot(normal, subtract(vertex, vertices[a])));
        if (distances.every(value => value <= 1e-6) || distances.every(value => value >= -1e-6)) faces.push([a,b,c]);
      }
    }
    const radius = Math.max(...vertices.map(vertex => Math.hypot(...vertex)));
    vertices = vertices.map(vertex => vertex.map(value => value / radius));
    faces = faces.map((indices, index) => {
      const center = indices.reduce((sum, i) => sum.map((value, axis) => value + vertices[i][axis] / indices.length), [0,0,0]);
      const normal = cross(subtract(vertices[indices[1]], vertices[indices[0]]), subtract(vertices[indices[2]], vertices[indices[0]]));
      if (dot(normal, center) < 0) indices.reverse();
      const outward = unit(dot(normal, center) < 0 ? normal.map(value => -value) : normal);
      const horizontal = unit(subtract(vertices[indices[1]], vertices[indices[0]]));
      const vertical = cross(outward, horizontal);
      const inset = Math.min(...indices.map((vertexIndex, edgeIndex) => {
        const start = vertices[vertexIndex];
        const edge = subtract(vertices[indices[(edgeIndex + 1) % indices.length]], start);
        return Math.hypot(...cross(subtract(center, start), edge)) / Math.hypot(...edge);
      }));
      const label = String(index + 1);
      const height = inset * 1.12;
      const width = label.length * .6 + (label.length - 1) * .18;
      const ink = [...label].flatMap((digit, digitIndex) => numeralStrokes[digit].map(stroke => stroke.map(([x,y]) => {
        const localX = (x + digitIndex * .78 - width / 2) * height;
        const localY = (y - .5) * height;
        return center.map((value, axis) => value + horizontal[axis] * localX + vertical[axis] * localY);
      })));
      return { indices, label, ink, height };
    });
    return { vertices, faces };
  }
  function rotate(vertex, angles) {
    let [x,y,z] = vertex;
    const [ax,ay,az] = angles;
    [y,z] = [y * Math.cos(ax) - z * Math.sin(ax), y * Math.sin(ax) + z * Math.cos(ax)];
    [x,z] = [x * Math.cos(ay) + z * Math.sin(ay), -x * Math.sin(ay) + z * Math.cos(ay)];
    return [x * Math.cos(az) - y * Math.sin(az), x * Math.sin(az) + y * Math.cos(az), z];
  }
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
  function draw(time) {
    dice.forEach(die => {
      const body = die.body;
      const plane = planes[Number(body.dataset.orbit)];
      const angle = Number(body.dataset.phase) + time / plane.period * Math.PI * 2;
      const point = project(angle, plane);
      const scale = point.scale * (.88 + (point.depth + 1) * .14);
      body.style.transform = `translate3d(calc(-50% + ${point.x}px), calc(-50% + ${point.y}px), 0) scale(${scale})`;
      body.style.opacity = String(.58 + (point.depth + 1) * .21);
      body.style.zIndex = point.z >= 0 ? '4' : '-1';
      renderDie(die);
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
    if (motion.matches) draw(0);
    else if (visible && !document.hidden) frame = requestAnimationFrame(tick);
  }
  measure();
  if ('ResizeObserver' in window) new ResizeObserver(measure).observe(stage);
  else window.addEventListener('resize', measure);
  motion.addEventListener('change', updateAnimation);
  document.addEventListener('visibilitychange', updateAnimation);
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
