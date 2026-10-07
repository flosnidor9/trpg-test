/* Browser pixel watermark API. Requires watermark-codec.js and watermark-dct.js. */
(() => {
  'use strict';
  const C = globalThis.WatermarkCodec, D = globalThis.WatermarkDct;
  const HEADER_BLOCKS = C.HEADER_BYTES * 8 * C.HEADER_REDUNDANCY;
  const BOOTSTRAP_COEFFICIENTS = [[2, 3], [3, 2]], BOOTSTRAP_STRENGTH = 64;
  const MAX_PIXELS = 32_000_000;
  function settings(options = {}) {
    const result = { strength: 40, redundancy: 5, blockSize: 8, coefficients: BOOTSTRAP_COEFFICIENTS, ...options };
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
  function getWatermarkCapacity(width, height, options) {
    const o = settings(options);
    return Math.max(0, Math.floor((blockCount(width, height, o.blockSize) - HEADER_BLOCKS) / (8 * o.redundancy)) - 4);
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
  function carrier(data, size, coefficients) {
    const b1 = D.coefficientBasis(size, coefficients[0]), b2 = D.coefficientBasis(size, coefficients[1]);
    const basis = Float64Array.from(b1, (value, i) => value - b2[i]);
    const columns = Math.floor(data.width / size), pixels = data.data;
    function indices(block, visit) {
      const left = (block % columns) * size, top = Math.floor(block / columns) * size;
      for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) visit(((top + y) * data.width + left + x) * 4, y * size + x);
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
    return { embed, read: block => difference(block) > 0 ? 1 : 0 };
  }
  async function pause() { await new Promise(resolve => setTimeout(resolve, 0)); }
  async function writeBits(data, positions, offset, bits, size, coefficients, strength) {
    const block = carrier(data, size, coefficients);
    for (let i = 0; i < bits.length; i++) {
      block.embed(positions[offset + i], bits[i], strength);
      if (i % 2048 === 2047) await pause();
    }
  }
  async function readBits(data, positions, offset, length, size, coefficients) {
    const block = carrier(data, size, coefficients), bits = new Uint8Array(length);
    for (let i = 0; i < length; i++) {
      bits[i] = block.read(positions[offset + i]);
      if (i % 4096 === 4095) await pause();
    }
    return bits;
  }
  async function embedJsonIntoImage(image, json, options) {
    const o = settings(options), { header, body } = await C.encode(json, o);
    const data = await blobToImageData(image), positions = generateBlockPositions(data.width, data.height, o.blockSize);
    const required = HEADER_BLOCKS + body.length * 8 * o.redundancy;
    if (required > positions.length) throw new Error(`Payload too large\nRequired: ${required} bits\nAvailable: ${positions.length} bits`);
    await writeBits(data, positions, 0, C.repeat(C.bytesToBits(header), C.HEADER_REDUNDANCY), o.blockSize, BOOTSTRAP_COEFFICIENTS, BOOTSTRAP_STRENGTH);
    await writeBits(data, positions, HEADER_BLOCKS, C.repeat(C.bytesToBits(body), o.redundancy), o.blockSize, o.coefficients, o.strength);
    return imageDataToPng(data);
  }
  async function extractJsonFromImage(image) {
    const data = await blobToImageData(image); let failure;
    for (const size of [8, 16]) {
      const positions = generateBlockPositions(data.width, data.height, size);
      if (positions.length < HEADER_BLOCKS) continue;
      try {
        const bits = await readBits(data, positions, 0, HEADER_BLOCKS, size, BOOTSTRAP_COEFFICIENTS);
        const header = C.decodeHeader(C.bitsToBytes(C.majority(bits, C.HEADER_REDUNDANCY)));
        const o = settings(header);
        if (o.blockSize !== size) throw new Error('Invalid watermark block size');
        const length = (header.length + 4) * 8 * o.redundancy;
        if (length > positions.length - HEADER_BLOCKS) throw new Error('Invalid watermark payload length');
        const body = await readBits(data, positions, HEADER_BLOCKS, length, size, o.coefficients);
        return await C.decodeBody(C.bitsToBytes(C.majority(body, o.redundancy)), header);
      } catch (error) { if (error.message !== 'Watermark not found') failure = error; }
    }
    throw failure || new Error('Watermark not found');
  }
  globalThis.JsonWatermark = { embedJsonIntoImage, extractJsonFromImage, getWatermarkCapacity,
    generateBlockPositions, blobToImageData, imageDataToPng };
})();
