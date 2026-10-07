const test = require('node:test');
const assert = require('node:assert/strict');
require('../watermark-codec.js'); require('../watermark-dct.js'); require('../watermark.js');
const C = WatermarkCodec, D = WatermarkDct, W = JsonWatermark;
const options = { strength: 40, redundancy: 5, blockSize: 8, coefficients: [[2, 3], [3, 2]] };
test('CRC32 known vector, bit packing and replica majority', () => {
  assert.equal(C.crc32(new TextEncoder().encode('123456789')), 0xcbf43926);
  const bytes = Uint8Array.from([0, 255, 128, 1, 85, 170]);
  assert.deepEqual(C.bitsToBytes(C.bytesToBits(bytes)), bytes);
  const bits = C.bytesToBits(bytes), repeated = C.repeat(bits, 5);
  for (let i = 0; i < bits.length * 2; i++) repeated[i] ^= 1;
  assert.deepEqual(C.majority(repeated, 5), bits);
});
test('DCT and inverse preserve pixels and projected coefficients', () => {
  for (const size of [8, 16]) {
    const values = Float64Array.from({ length: size * size }, (_, i) => Math.sin(i * 1.3) * 100 + 120);
    const coefficients = D.dct(values, size), restored = D.inverseDct(coefficients, size);
    assert.ok(values.every((v, i) => Math.abs(v - restored[i]) < 1e-10));
    const basis = D.coefficientBasis(size, [2, 3]);
    assert.ok(Math.abs(values.reduce((sum, v, i) => sum + v * basis[i], 0) - coefficients[2 * size + 3]) < 1e-10);
  }
});
test('framing, UTF-8, compression, length and checksums', async () => {
  const json = { name: '테스트 캐릭터 🎲', description: '한글\n'.repeat(100) };
  const packet = await C.encode(json, options), header = C.decodeHeader(packet.header);
  assert.equal(header.flags, 1);
  assert.deepEqual(await C.decodeBody(packet.body, header), json);
  const broken = packet.body.slice(); broken[0] ^= 1;
  await assert.rejects(C.decodeBody(broken, header), /checksum/);
  await assert.rejects(C.decodeBody(packet.body.subarray(1), header), /length/);
  const badHeader = packet.header.slice(); badHeader[8] ^= 1;
  assert.throws(() => C.decodeHeader(badHeader), /header checksum/);
  assert.throws(() => C.decodeHeader(new Uint8Array(24)), /Watermark not found/);
  const unknown = packet.header.slice(); unknown[4] = 2;
  new DataView(unknown.buffer).setUint32(20, C.crc32(unknown.subarray(0, 20)));
  assert.throws(() => C.decodeHeader(unknown), /Unsupported/);
  await assert.rejects(C.encode(undefined, options), /serializable/);
  await assert.rejects(C.encode({ big: 1n }, options), /BigInt/);
  await assert.rejects(C.encode('가'.repeat(700_000), options), /2000000/);
});
test('capacity subtracts framing/repetition and validates settings', () => {
  assert.equal(W.getWatermarkCapacity(1920, 1080), 180);
  assert.equal(W.getWatermarkCapacity(8, 8, { maxDimension: 64 }), 0);
  assert.throws(() => W.getWatermarkCapacity(100, 100, { redundancy: 2 }), /odd/);
  assert.throws(() => W.getWatermarkCapacity(100, 100, { strength: NaN }), /strength/);
  assert.throws(() => W.getWatermarkCapacity(100, 100, { blockSize: 12 }), /blockSize/);
  assert.throws(() => W.getWatermarkCapacity(100, 100, { coefficients: [[0, 0], [3, 2]] }), /mid-frequency/);
  assert.throws(() => W.getWatermarkCapacity(100, 100, { coefficients: [[2, 3], [2, 3]] }), /distinct/);
});
test('deterministic dispersed permutation contains each block exactly once', () => {
  const positions = W.generateBlockPositions(512, 512);
  assert.deepEqual(positions, W.generateBlockPositions(512, 512));
  assert.equal(new Set(positions).size, 4096);
  assert.ok(positions.slice(0, 100).some(n => n > 3500));
});

test('v2 framing validates magic, version and header CRC independently', async () => {
  const packet = await C.encode({ message: 'v2 한글' }, { ...options, wireVersion: 2 });
  assert.equal(C.decodeHeader(packet.header).wireVersion, 2);
  assert.deepEqual(await C.decodeBody(packet.body, C.decodeHeader(packet.header)), { message: 'v2 한글' });
  for (const index of [0, 4, 8, 20]) {
    const corrupt = packet.header.slice(); corrupt[index] ^= 1;
    assert.throws(() => C.decodeHeader(corrupt));
  }
  assert.throws(() => W.getWatermarkCapacity(100, 100, { maxDimension: 0 }), /maxDimension/);
});
