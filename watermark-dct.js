/* Orthonormal DCT-II. Coordinates: [vertical frequency, horizontal frequency]. */
(() => {
  'use strict';
  const cache = new Map();
  function basis(size) {
    if (!cache.has(size)) cache.set(size, Array.from({ length: size }, (_, u) =>
      Float64Array.from({ length: size }, (_, x) => Math.sqrt((u === 0 ? 1 : 2) / size) * Math.cos(Math.PI * (2 * x + 1) * u / (2 * size)))));
    return cache.get(size);
  }
  function dct(input, size = 8, inverse = false) {
    const b = basis(size), temp = new Float64Array(size * size), out = new Float64Array(size * size);
    for (let y = 0; y < size; y++) for (let u = 0; u < size; u++) for (let x = 0; x < size; x++)
      temp[y * size + u] += input[y * size + x] * (inverse ? b[x][u] : b[u][x]);
    for (let v = 0; v < size; v++) for (let x = 0; x < size; x++) for (let y = 0; y < size; y++)
      out[v * size + x] += temp[y * size + x] * (inverse ? b[y][v] : b[v][y]);
    return out;
  }
  function coefficientBasis(size, [v, u]) {
    const b = basis(size);
    return Float64Array.from({ length: size * size }, (_, i) => b[v][Math.floor(i / size)] * b[u][i % size]);
  }
  globalThis.WatermarkDct = { dct, inverseDct: (input, size = 8) => dct(input, size, true), coefficientBasis };
})();
