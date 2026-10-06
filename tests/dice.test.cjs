const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'dice-geometry.js'), 'utf8'), sandbox);
const { makeDie, subtract, cross, dot } = sandbox.window.TRPGDice;

for (const [type, count, corners] of [[4,4,3],[6,6,4],[8,8,3],[10,10,4],[12,12,5],[20,20,3],[100,10,4]]) {
  test(`D${type}: closed solid, planar faces and valid numbering`, () => {
    const mesh = makeDie(type);
    assert.equal(mesh.faces.length, count);
    const edges = new Map();
    for (const face of mesh.faces) {
      assert.equal(face.indices.length, corners);
      assert.ok(dot(face.outward, face.center) > 0);
      const origin = mesh.vertices[face.indices[0]];
      for (const i of face.indices) assert.ok(Math.abs(dot(face.outward, subtract(mesh.vertices[i], origin))) < 1e-6);
      face.indices.forEach((a, i) => {
        const b = face.indices[(i + 1) % corners];
        const edge = [a,b].sort((x,y) => x-y).join(',');
        edges.set(edge, (edges.get(edge) || 0) + 1);
      });
      assert.ok(face.ink.length > 0);
      assert.ok(face.ink.flat().every(point => point.every(Number.isFinite)));
      // Every numeral point belongs to its face plane and stays inside its edges.
      for (const point of face.ink.flat()) {
        assert.ok(Math.abs(dot(face.outward, subtract(point, origin))) < 1e-6);
        face.indices.forEach((a, i) => {
          const b = face.indices[(i + 1) % corners];
          assert.ok(dot(cross(subtract(mesh.vertices[b],mesh.vertices[a]), subtract(point,mesh.vertices[a])), face.outward) >= -1e-6);
        });
      }
    }
    assert.ok([...edges.values()].every(uses => uses === 2));
    assert.equal(mesh.vertices.length - edges.size + mesh.faces.length, 2);
    const labels = Array.from(mesh.faces, face => face.label).sort();
    const expected = Array.from({length:count}, (_, i) => type === 100 ? String(i*10).padStart(2,'0') : String(i+1)).sort();
    assert.deepEqual(labels, expected);
    if (type !== 4) for (const face of mesh.faces) {
      const opposite = mesh.faces.find(other => dot(face.outward,other.outward) < -.99999);
      assert.ok(opposite);
      assert.equal(face.value + opposite.value, count + 1);
    }
  });
}
