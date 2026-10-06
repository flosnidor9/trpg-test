(() => {
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

  function rotate(vertex, angles) {
    let [x,y,z] = vertex;
    const [ax,ay,az] = angles;
    [y,z] = [y * Math.cos(ax) - z * Math.sin(ax), y * Math.sin(ax) + z * Math.cos(ax)];
    [x,z] = [x * Math.cos(ay) + z * Math.sin(ay), -x * Math.sin(ay) + z * Math.cos(ay)];
    return [x * Math.cos(az) - y * Math.sin(az), x * Math.sin(az) + y * Math.cos(az), z];
  }

  function hull(vertices) {
    const planes = new Map();
    for (let a = 0; a < vertices.length; a++) for (let b = a + 1; b < vertices.length; b++) for (let c = b + 1; c < vertices.length; c++) {
      const normal = cross(subtract(vertices[b], vertices[a]), subtract(vertices[c], vertices[a]));
      if (Math.hypot(...normal) < 1e-7) continue;
      const distances = vertices.map(vertex => dot(normal, subtract(vertex, vertices[a])));
      if (!distances.every(value => value <= 1e-6) && !distances.every(value => value >= -1e-6)) continue;
      const indices = distances.flatMap((value, index) => Math.abs(value) < 1e-6 ? [index] : []);
      planes.set(indices.join(','), indices);
    }
    return [...planes.values()].map(indices => {
      const center = indices.reduce((sum, i) => sum.map((value, axis) => value + vertices[i][axis] / indices.length), [0,0,0]);
      const outward = unit(center);
      const u = unit(subtract(vertices[indices[0]], center));
      const v = cross(outward, u);
      return indices.sort((a,b) => Math.atan2(dot(subtract(vertices[a], center), v), dot(subtract(vertices[a], center), u)) - Math.atan2(dot(subtract(vertices[b], center), v), dot(subtract(vertices[b], center), u)));
    });
  }
  function makeDie(type) {
    const sides = type === 100 ? 10 : type;
    let vertices = [], faces;
    if (sides === 4) vertices = [[1,1,1],[1,-1,-1],[-1,1,-1],[-1,-1,1]];
    else if (sides === 6) {
      for (const x of [-1,1]) for (const y of [-1,1]) for (const z of [-1,1]) vertices.push([x,y,z]);
    } else if (sides === 8) vertices = [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
    else if (sides === 10) {
      // Pentagonal trapezohedron: ten planar kite faces, not a bipyramid.
      vertices = [[0,0,1.3],[0,0,-1.3]];
      const ringHeight = 1.3 * (1 - Math.cos(Math.PI / 5)) / (1 + Math.cos(Math.PI / 5));
      for (let i = 0; i < 10; i++) vertices.push([Math.cos(i*Math.PI/5), Math.sin(i*Math.PI/5), i % 2 ? -ringHeight : ringHeight]);
    } else if (sides === 12 || sides === 20) {
      const golden = (1 + Math.sqrt(5)) / 2;
      for (const a of [-1,1]) for (const b of [-golden,golden]) vertices.push([0,a,b], [a,b,0], [b,0,a]);
      if (sides === 12) {
        // The dual of an icosahedron gives a regular dodecahedron.
        const ico = vertices;
        vertices = hull(ico).map(indices => indices.reduce((sum, i) => sum.map((value, axis) => value + ico[i][axis] / 3), [0,0,0]));
      }
    } else throw new Error('Unsupported die: ' + type);
    const radius = Math.max(...vertices.map(vertex => Math.hypot(...vertex)));
    vertices = vertices.map(vertex => vertex.map(value => value / radius));
    faces = hull(vertices).map(indices => {
      const center = indices.reduce((sum, i) => sum.map((value, axis) => value + vertices[i][axis] / indices.length), [0,0,0]);
      let normal = cross(subtract(vertices[indices[1]], vertices[indices[0]]), subtract(vertices[indices[2]], vertices[indices[0]]));
      if (dot(normal, center) < 0) { indices.reverse(); normal = normal.map(value => -value); }
      const outward = unit(normal);
      const horizontal = unit(subtract(vertices[indices[1]], vertices[indices[0]]));
      const vertical = cross(outward, horizontal);
      const inset = Math.min(...indices.map((i, edge) => Math.hypot(...cross(subtract(center, vertices[i]), subtract(vertices[indices[(edge+1)%indices.length]], vertices[i]))) / Math.hypot(...subtract(vertices[indices[(edge+1)%indices.length]], vertices[i]))));
      return { indices, center, outward, horizontal, vertical, height: inset * 1.05 };
    });
    const assigned = new Set();
    let next = 1;
    faces.forEach((face, index) => {
      if (assigned.has(index)) return;
      face.value = next;
      assigned.add(index);
      if (sides !== 4) {
        const opposite = faces.findIndex((other, i) => i !== index && !assigned.has(i) && dot(face.outward, other.outward) < -.99999);
        if (opposite >= 0) { faces[opposite].value = sides + 1 - next; assigned.add(opposite); }
      }
      next++;
    });
    function inkFor(label, center, horizontal, vertical, height) {
      const width = label.length * .6 + (label.length - 1) * .18;
      return [...label].flatMap((digit, digitIndex) => {
        const strokes = digit === '6' || digit === '9' ? [...numeralStrokes[digit], [[.06,1.16],[.54,1.16]]] : numeralStrokes[digit];
        return strokes.map(stroke => stroke.map(([x,y]) => {
        const localX = (x + digitIndex * .78 - width / 2) * height;
        const localY = (y - .5) * height;
        return center.map((value, axis) => value + horizontal[axis]*localX + vertical[axis]*localY);
        }));
      });
    }
    faces.forEach(face => {
      face.label = type === 100 ? String((face.value - 1) * 10).padStart(2,'0') : String(face.value);
      face.ink = inkFor(face.label, face.center, face.horizontal, face.vertical, face.height);
    });
    return { type, vertices, faces };
  }
  window.TRPGDice = { makeDie, rotate, subtract, cross, dot };
})();
