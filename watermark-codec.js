/* UI-independent framing and repetition codec; no PNG structure access. */
(() => {
  'use strict';
  const HEADER_BYTES = 24, HEADER_REDUNDANCY = 9, MAX_JSON_BYTES = 2_000_000;
  const table = Uint32Array.from({ length: 256 }, (_, n) => {
    for (let i = 0; i < 8; i++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1;
    return n >>> 0;
  });
  function crc32(bytes) {
    let crc = 0xffffffff;
    for (const byte of bytes) crc = table[(crc ^ byte) & 255] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
  }
  function bytesToBits(bytes) {
    return Uint8Array.from({ length: bytes.length * 8 }, (_, i) => (bytes[i >> 3] >> (7 - (i & 7))) & 1);
  }
  function bitsToBytes(bits) {
    if (bits.length % 8) throw new Error('Invalid bit length');
    const bytes = new Uint8Array(bits.length / 8);
    bits.forEach((bit, i) => { bytes[i >> 3] |= (bit & 1) << (7 - (i & 7)); });
    return bytes;
  }
  // Replica-major interleaving disperses burst errors. Replace this layer with ECC
  // under a NEW wire-format version; it is independent of the DCT carrier.
  function repeat(bits, count) {
    const out = new Uint8Array(bits.length * count);
    for (let i = 0; i < count; i++) out.set(bits, i * bits.length);
    return out;
  }
  function majority(coded, count) {
    if (coded.length % count) throw new Error('Invalid repetition length');
    const size = coded.length / count, bits = new Uint8Array(size);
    for (let i = 0; i < size; i++) {
      let votes = 0;
      for (let r = 0; r < count; r++) votes += coded[r * size + i];
      bits[i] = votes > count / 2 ? 1 : 0;
    }
    return bits;
  }
  async function transform(bytes, compress, limit = MAX_JSON_BYTES) {
    const stream = compress ? new CompressionStream('deflate') : new DecompressionStream('deflate');
    const reader = new Blob([bytes]).stream().pipeThrough(stream).getReader();
    const parts = []; let length = 0;
    try {
      while (true) {
        const { value, done } = await reader.read(); if (done) break;
        length += value.length;
        if (length > limit) throw new Error('JSON exceeds 2000000 bytes');
        parts.push(value);
      }
    } catch (error) { await reader.cancel().catch(() => {}); throw error; }
    finally { reader.releaseLock(); }
    const out = new Uint8Array(length); let offset = 0;
    for (const part of parts) { out.set(part, offset); offset += part.length; }
    return out;
  }
  async function encode(json, options) {
    const text = JSON.stringify(json);
    if (text === undefined) throw new Error('Value is not JSON serializable');
    let payload = new TextEncoder().encode(text), flags = 0;
    if (payload.length > MAX_JSON_BYTES) throw new Error('JSON exceeds 2000000 bytes');
    if (typeof CompressionStream !== 'undefined' && typeof DecompressionStream !== 'undefined') {
      const compressed = await transform(payload, true, MAX_JSON_BYTES + 1024);
      if (compressed.length < payload.length) { payload = compressed; flags = 1; }
    }
    const header = new Uint8Array(HEADER_BYTES), view = new DataView(header.buffer);
    const version = options.wireVersion || 1;
    if (![1, 2].includes(version)) throw new Error('Unsupported watermark version');
    header.set([87, 74, 48, 48 + version]); // WJ01 / WJ02, big-endian fields
    header[4] = version; header[5] = flags; header[6] = options.redundancy; header[7] = options.blockSize;
    view.setUint32(8, payload.length); header.set(options.coefficients.flat(), 12);
    view.setFloat32(16, options.strength); view.setUint32(20, crc32(header.subarray(0, 20)));
    const body = new Uint8Array(payload.length + 4); body.set(payload);
    new DataView(body.buffer).setUint32(payload.length, crc32(payload));
    return { header, body };
  }
  function decodeHeader(header) {
    if (header.length !== HEADER_BYTES || ![87, 74, 48].every((b, i) => header[i] === b) || ![49, 50].includes(header[3])) throw new Error('Watermark not found');
    const view = new DataView(header.buffer, header.byteOffset, header.byteLength);
    if (view.getUint32(20) !== crc32(header.subarray(0, 20))) throw new Error('Watermark header checksum mismatch');
    if (header[4] !== header[3] - 48 || header[5] > 1) throw new Error('Unsupported watermark version or flags');
    const length = view.getUint32(8);
    if (length > MAX_JSON_BYTES) throw new Error('Invalid watermark payload length');
    return { wireVersion: header[4], length, flags: header[5], redundancy: header[6], blockSize: header[7],
      coefficients: [[header[12], header[13]], [header[14], header[15]]], strength: view.getFloat32(16) };
  }
  async function decodeBody(body, header) {
    if (body.length !== header.length + 4) throw new Error('Invalid watermark payload length');
    const payload = body.subarray(0, header.length);
    if (new DataView(body.buffer, body.byteOffset, body.byteLength).getUint32(header.length) !== crc32(payload)) throw new Error('Watermark checksum mismatch');
    if (header.flags && typeof DecompressionStream === 'undefined') throw new Error('This browser does not support deflate decompression');
    const bytes = header.flags ? await transform(payload, false) : payload;
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  }
  globalThis.WatermarkCodec = { HEADER_BYTES, HEADER_REDUNDANCY, MAX_JSON_BYTES, crc32,
    bytesToBits, bitsToBytes, repeat, majority, encode, decodeHeader, decodeBody };
})();
