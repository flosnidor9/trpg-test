/* Browser pixel watermark API. Requires watermark-codec.js and watermark-dct.js. */
(() => {
  'use strict';
  const C = globalThis.WatermarkCodec, D = globalThis.WatermarkDct;
  const HEADER_BLOCKS = C.HEADER_BYTES * 8 * C.HEADER_REDUNDANCY;
  const LEGACY_PAIR = [[2, 3], [3, 2]];
  // Equal radial frequency avoids unequal JPEG quantization. Moving from
  // [2,3]/[3,2] to [1,2]/[2,1] retains more energy after down/up-sampling.
  const DEFAULT_PAIR = [[1, 2], [2, 1]], BOOTSTRAP_STRENGTH = 120;
  const NORMALIZATIONS = [1200, 1024, 768, 1600, 2048, 2400, 3200, 4096];
  const SYNC_REDUNDANCY = 7, CHUNK_BYTES = 128, MARKER_REDUNDANCY = 3;
  const SYNC = Uint8Array.from({ length: 64 }, (_, i) => {
    let n = Math.imul(i + 1, 0x45d9f3b); n ^= n >>> 16; return n & 1;
  });
  const MARKER = SYNC.slice(0, 16), SYNC_BLOCKS = SYNC.length * SYNC_REDUNDANCY;
  const MARKER_BLOCKS = MARKER.length * MARKER_REDUNDANCY;
  const MAX_PIXELS = 32_000_000;
  function settings(options = {}) {
    const result = { strength: 100, redundancy: 7, blockSize: 8, coefficients: DEFAULT_PAIR,
      maxDimension: 1200, outputCanonicalizedImage: true, ...options };
    if (!Number.isInteger(result.maxDimension) || result.maxDimension < 64 || result.maxDimension > 4096) throw new Error('maxDimension must be an integer between 64 and 4096');
    if (typeof result.outputCanonicalizedImage !== 'boolean') throw new Error('outputCanonicalizedImage must be boolean');
    if (!Number.isFinite(result.strength) || result.strength < 4 || result.strength > 200) throw new Error('strength must be between 4 and 200');
    if (!Number.isInteger(result.redundancy) || result.redundancy < 1 || result.redundancy > 31 || !(result.redundancy & 1)) throw new Error('redundancy must be odd, between 1 and 31');
    // Blind extraction searches these sizes; no original image is needed.
    if (![8, 16].includes(result.blockSize)) throw new Error('blockSize must be 8 or 16');
    const pairs = result.coefficients;
    if (!Array.isArray(pairs) || pairs.length !== 2 || pairs.some(p => !Array.isArray(p) || p.length !== 2 || p.some(n => !Number.isInteger(n) || n < 0 || n >= result.blockSize) || p[0] + p[1] < 3 || p[0] + p[1] > result.blockSize - 2) || pairs[0].join() === pairs[1].join()) throw new Error('Choose two distinct mid-frequency coefficients');
    return result;
  }
  function blockCount(width, height, size) {
    if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width * height > MAX_PIXELS) throw new Error('Invalid image dimensions (maximum 32000000 pixels)');
    return Math.floor(width / size) * Math.floor(height / size);
  }
  function normalizedDimensions(width, height, maxDimension) {
    blockCount(width, height, 8);
    const scale = maxDimension / Math.max(width, height);
    return [Math.max(1, Math.round(width * scale)), Math.max(1, Math.round(height * scale))];
  }
  function requiredBlocks(bodyLength, o) {
    return SYNC_BLOCKS + HEADER_BLOCKS + bodyLength * 8 * o.redundancy +
      Math.ceil(bodyLength / CHUNK_BYTES) * MARKER_BLOCKS;
  }
  function capacityAt(width, height, o) {
    const blocks = blockCount(width, height, o.blockSize);
    let low = 0, high = Math.floor(blocks / (8 * o.redundancy));
    while (low < high) {
      const middle = Math.ceil((low + high) / 2);
      if (requiredBlocks(middle + 4, o) <= blocks) low = middle; else high = middle - 1;
    }
    return low;
  }
  function getWatermarkCapacity(width, height, options) {
    const o = settings(options), [w, h] = normalizedDimensions(width, height, o.maxDimension);
    // Report the preferred/fixed normalization, not an optimistic auto-expanded capacity.
    return capacityAt(w, h, o);
  }
  function generateBlockPositions(width, height, size = 8, seed = 0x574a3031) {
    const count = blockCount(width, height, size), positions = Uint32Array.from({ length: count }, (_, i) => i);
    let state = seed >>> 0;
    const random = () => { state ^= state << 13; state ^= state >>> 17; state ^= state << 5; return (state >>> 0) / 4294967296; };
    // Fisher-Yates: fixed seed, full-image dispersion, no reused blocks.
    for (let i = count - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [positions[i], positions[j]] = [positions[j], positions[i]]; }
    return positions;
  }
  function canvas(width, height) {
    const surface = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(width, height) : document.createElement('canvas');
    surface.width = width; surface.height = height;
    const context = surface.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('Canvas 2D is unavailable');
    return { surface, context };
  }
  async function blobToImageData(blob) {
    if (!(blob instanceof Blob) || !blob.size || blob.size > 50_000_000) throw new Error('Image must be a nonempty Blob under 50MB');
    let image, url, decoded = false;
    try {
      if (typeof createImageBitmap !== 'undefined') image = await createImageBitmap(blob);
      else { url = URL.createObjectURL(blob); image = new Image(); image.src = url; await image.decode(); }
      decoded = true;
      const width = image.width || image.naturalWidth, height = image.height || image.naturalHeight;
      blockCount(width, height, 8);
      const { context } = canvas(width, height);
      // Flatten alpha onto white; invisible transparent carriers cannot survive decoding.
      context.fillStyle = '#fff'; context.fillRect(0, 0, width, height); context.drawImage(image, 0, 0);
      return context.getImageData(0, 0, width, height);
    } catch (error) {
      if (!decoded) throw new Error('Image decoding failed');
      throw error;
    } finally { image?.close?.(); if (url) URL.revokeObjectURL(url); }
  }
  async function imageDataToPng(data) {
    const { surface, context } = canvas(data.width, data.height); context.putImageData(data, 0, 0);
    if (surface.convertToBlob) return surface.convertToBlob({ type: 'image/png' });
    return new Promise((resolve, reject) => surface.toBlob(blob => blob ? resolve(blob) : reject(new Error('PNG encoding failed')), 'image/png'));
  }
  function carrier(data, size, coefficients, offset = [0, 0]) {
    const b1 = D.coefficientBasis(size, coefficients[0]), b2 = D.coefficientBasis(size, coefficients[1]);
    const basis = Float64Array.from(b1, (value, i) => value - b2[i]);
    const columns = Math.floor(data.width / size), pixels = data.data;
    function indices(block, visit) {
      const left = (block % columns) * size + offset[0], top = Math.floor(block / columns) * size + offset[1];
      for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) visit((Math.max(0, Math.min(data.height - 1, top + y)) * data.width + Math.max(0, Math.min(data.width - 1, left + x))) * 4, y * size + x);
    }
    function difference(block) {
      let value = 0;
      indices(block, (p, i) => { value += (.299 * pixels[p] + .587 * pixels[p + 1] + .114 * pixels[p + 2]) * basis[i]; });
      return value;
    }
    function embed(block, bit, strength) {
      const sign = bit ? 1 : -1;
      // DCT pair ordering with a margin, NOT LSB. [2,3]/[3,2] have equal
      // radial frequency: avoid DC/high frequencies and similar JPEG quantization.
      // Two projections + inverse basis deltas are exactly DCT/IDCT for the
      // two changed coefficients, without calculating unused frequencies.
      // Re-check actual rounded RGB; clipping destroys orthogonality on flat
      // white/black blocks, so repeat until the requested margin is reached.
      for (let attempt = 0; attempt < 12; attempt++) {
        const current = difference(block);
        if (sign * current >= strength * .9) return;
        const delta = (sign * (strength + 2) - current) / 2;
        indices(block, (p, i) => {
          const shift = delta * basis[i];
          for (let c = 0; c < 3; c++) pixels[p + c] = Math.round(Math.max(0, Math.min(255, pixels[p + c] + shift)));
        });
      }
      throw new Error('Unable to embed watermark in clipped pixels; reduce strength');
    }
    return { embed, read: difference };
  }
  async function pause() { await new Promise(resolve => setTimeout(resolve, 0)); }
  async function writeBits(data, positions, offset, bits, size, coefficients, strength) {
    const block = carrier(data, size, coefficients);
    for (let i = 0; i < bits.length; i++) {
      block.embed(positions[offset + i], bits[i], strength);
      if (i % 2048 === 2047) await pause();
    }
  }
  async function readBits(data, positions, offset, length, size, coefficients, phase = [0, 0]) {
    const block = carrier(data, size, coefficients, phase), bits = new Float64Array(length);
    for (let i = 0; i < length; i++) {
      bits[i] = block.read(positions[offset + i]);
      if (i % 4096 === 4095) await pause();
    }
    return bits;
  }
  function resize(data, width, height) {
    if (data.width === width && data.height === height) return data;
    const source = canvas(data.width, data.height), target = canvas(width, height);
    source.context.putImageData(data, 0, 0);
    target.context.imageSmoothingEnabled = true; target.context.imageSmoothingQuality = 'high';
    target.context.drawImage(source.surface, 0, 0, width, height);
    return target.context.getImageData(0, 0, width, height);
  }
  async function normalizeForWatermark(image, options = {}) {
    const o = settings(options), data = await blobToImageData(image);
    return resize(data, ...normalizedDimensions(data.width, data.height, o.maxDimension));
  }
  function vote(values, count, mode, strength = 100) {
    const length = values.length / count, bits = new Uint8Array(length);
    for (let i = 0; i < length; i++) {
      let sum = 0;
      for (let r = 0; r < count; r++) {
        const d = values[r * length + i];
        if (mode === 'hard') sum += d > 0 ? 1 : -1;
        else if (mode !== 'erasure' || Math.abs(d) >= strength * .15)
          sum += Math.max(-strength * 2, Math.min(strength * 2, d));
      }
      bits[i] = sum > 0 ? 1 : 0;
    }
    return bits;
  }
  function correlation(values, pattern) {
    let agreement = 0, weight = 0;
    for (let i = 0; i < values.length; i++) {
      const d = Math.max(-BOOTSTRAP_STRENGTH, Math.min(BOOTSTRAP_STRENGTH, values[i]));
      agreement += d * (pattern[i % pattern.length] ? 1 : -1); weight += Math.abs(d);
    }
    return weight ? (1 + agreement / weight) / 2 : 0;
  }
  async function embedJsonIntoImage(image, json, options = {}) {
    const o = settings(options), { header, body } = await C.encode(json, { ...o, wireVersion: 2 });
    const original = await blobToImageData(image);
    const sizes = options.maxDimension === undefined ? [1200, 1600, 2048, 2400, 3200, 4096] : [o.maxDimension];
    let data;
    const required = requiredBlocks(body.length, o);
    for (const dimension of sizes) {
      const [width, height] = normalizedDimensions(original.width, original.height, dimension);
      if (required <= blockCount(width, height, o.blockSize)) { data = resize(original, width, height); break; }
    }
    if (!data) throw new Error(`Payload too large\nRequired: ${required} blocks\nAvailable: ${blockCount(...normalizedDimensions(original.width, original.height, sizes.at(-1)), o.blockSize)} blocks`);
    const positions = generateBlockPositions(data.width, data.height, o.blockSize);
    await writeBits(data, positions, 0, C.repeat(SYNC, SYNC_REDUNDANCY), o.blockSize, o.coefficients, BOOTSTRAP_STRENGTH);
    await writeBits(data, positions, SYNC_BLOCKS, C.repeat(C.bytesToBits(header), C.HEADER_REDUNDANCY), o.blockSize, o.coefficients, BOOTSTRAP_STRENGTH);
    let offset = SYNC_BLOCKS + HEADER_BLOCKS;
    for (let start = 0; start < body.length; start += CHUNK_BYTES) {
      const chunk = body.subarray(start, start + CHUNK_BYTES), bits = C.repeat(C.bytesToBits(chunk), o.redundancy);
      await writeBits(data, positions, offset, bits, o.blockSize, o.coefficients, o.strength); offset += bits.length;
      await writeBits(data, positions, offset, C.repeat(MARKER, MARKER_REDUNDANCY), o.blockSize, o.coefficients, BOOTSTRAP_STRENGTH); offset += MARKER_BLOCKS;
    }
    if (!o.outputCanonicalizedImage) data = resize(data, original.width, original.height);
    return imageDataToPng(data);
  }
  async function legacy(data, debug) {
    for (const size of [8, 16]) {
      const positions = generateBlockPositions(data.width, data.height, size);
      if (positions.length < HEADER_BLOCKS) continue;
      const attempt = { width: data.width, height: data.height, blockSize: size,
        coefficientPair: LEGACY_PAIR.flat(), legacy: true, magicOk: false, crcOk: false };
      debug.triedNormalizations.push(attempt);
      try {
        const values = await readBits(data, positions, 0, HEADER_BLOCKS, size, LEGACY_PAIR);
        const header = C.decodeHeader(C.bitsToBytes(vote(values, C.HEADER_REDUNDANCY, 'hard')));
        attempt.magicOk = true;
        if (header.wireVersion !== 1) continue;
        const o = settings(header), length = (header.length + 4) * 8 * o.redundancy;
        if (o.blockSize !== size || length > positions.length - HEADER_BLOCKS) throw new Error('Invalid watermark payload length');
        const body = await readBits(data, positions, HEADER_BLOCKS, length, size, o.coefficients);
        const json = await C.decodeBody(C.bitsToBytes(vote(body, o.redundancy, 'hard')), header);
        attempt.crcOk = true; return { json, debug };
      } catch (error) { attempt.error = error.message; }
    }
  }
  async function extractJsonFromImageDetailed(image, options = {}) {
    const source = await blobToImageData(image);
    const debug = { inputWidth: source.width, inputHeight: source.height, triedNormalizations: [] };
    const compatible = await legacy(source, debug); if (compatible) return compatible;
    const sizes = [...new Set(options.maxDimensions || NORMALIZATIONS)];
    if (sizes.length > 16 || sizes.some(n => !Number.isInteger(n) || n < 64 || n > 4096)) throw new Error('Invalid normalization candidates');
    const pairs = options.coefficientPairs || [DEFAULT_PAIR, LEGACY_PAIR, [[1, 3], [3, 1]]];
    if (!pairs.length || pairs.length > 8) throw new Error('Invalid coefficient candidates');
    pairs.forEach(coefficients => settings({ coefficients, blockSize: 16 }));
    const dimensions = [[source.width, source.height], ...sizes.map(n => normalizedDimensions(source.width, source.height, n))];
    const seen = new Set();
    let failure = debug.triedNormalizations.find(attempt => attempt.legacy && attempt.magicOk && attempt.error);
    failure = failure ? new Error(failure.error) : undefined;
    for (const [width, height] of dimensions) {
      const key = `${width}x${height}`; if (seen.has(key)) continue; seen.add(key);
      // The short edge may have rounded differently during rendition generation.
      for (const adjustment of [0, -1, 1]) {
        const w = width >= height ? width : Math.max(1, width + adjustment);
        const h = width >= height ? Math.max(1, height + adjustment) : height;
        const data = resize(source, w, h);
        for (const size of [8, 16]) {
          const positions = generateBlockPositions(w, h, size);
          if (positions.length < SYNC_BLOCKS + HEADER_BLOCKS) continue;
          for (const pair of pairs) {
            if (pair.flat().some(n => n >= size)) continue;
            for (const phase of [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1]]) {
              const sync = await readBits(data, positions, 0, SYNC_BLOCKS, size, pair, phase);
              const score = correlation(sync, SYNC);
              const attempt = { width: w, height: h, blockSize: size, coefficientPair: pair.flat(), phase, score, magicOk: false, headerCrcOk: false, crcOk: false };
              debug.triedNormalizations.push(attempt);
              if (score < .72) continue;
              const values = await readBits(data, positions, SYNC_BLOCKS, HEADER_BLOCKS, size, pair, phase);
              for (const mode of ['soft', 'hard', 'erasure']) {
                try {
                  const bytes = C.bitsToBytes(vote(values, C.HEADER_REDUNDANCY, mode, BOOTSTRAP_STRENGTH));
                  attempt.magicOk ||= [87, 74, 48, 50].every((b, i) => bytes[i] === b);
                  const header = C.decodeHeader(bytes), o = settings(header);
                  if (header.wireVersion !== 2 || o.blockSize !== size || o.coefficients.flat().join() !== pair.flat().join()) continue;
                  attempt.headerCrcOk = true; attempt.redundancy = o.redundancy;
                  const length = header.length + 4;
                  if (requiredBlocks(length, o) > positions.length) throw new Error('Invalid watermark payload length');
                  const chunks = []; let offset = SYNC_BLOCKS + HEADER_BLOCKS;
                  attempt.markerScores = []; let uncertain = 0, total = 0;
                  for (let start = 0; start < length; start += CHUNK_BYTES) {
                    const bytes = Math.min(CHUNK_BYTES, length - start), count = bytes * 8 * o.redundancy;
                    const chunk = await readBits(data, positions, offset, count, size, pair, phase);
                    chunks.push(chunk); offset += count;
                    for (const d of chunk) { total++; if (Math.abs(d) < o.strength * .15) uncertain++; }
                    const marker = await readBits(data, positions, offset, MARKER_BLOCKS, size, pair, phase); offset += MARKER_BLOCKS;
                    attempt.markerScores.push(correlation(marker, MARKER));
                  }
                  attempt.uncertainFraction = uncertain / total;
                  for (const bodyMode of ['soft', 'hard', 'erasure']) {
                    const body = new Uint8Array(length); let start = 0;
                    for (const chunk of chunks) {
                      const bytes = C.bitsToBytes(vote(chunk, o.redundancy, bodyMode, o.strength)); body.set(bytes, start); start += bytes.length;
                    }
                    try {
                      const json = await C.decodeBody(body, header);
                      attempt.crcOk = true; attempt.voting = bodyMode;
                      return { json, debug };
                    } catch (error) { failure = error; attempt.error = error.message; }
                  }
                  // Header decoded; its remaining voting variants would read identical data.
                  break;
                } catch (error) {
                  attempt.error = error.message;
                  // A later failed header vote must not hide a verified-header
                  // payload CRC error with a generic "not found" message.
                  if (attempt.magicOk && error.message !== 'Watermark not found' && !failure) failure = error;
                }
              }
            }
          }
        }
      }
      await pause();
    }
    const error = failure || new Error('Watermark not found'); error.debug = debug; throw error;
  }
  async function extractJsonFromImage(image, options) {
    return (await extractJsonFromImageDetailed(image, options)).json;
  }
  globalThis.JsonWatermark = { embedJsonIntoImage, extractJsonFromImage, extractJsonFromImageDetailed,
    normalizeForWatermark, getWatermarkCapacity, generateBlockPositions, blobToImageData, imageDataToPng };
})();
