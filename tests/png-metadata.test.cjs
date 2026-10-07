const test = require('node:test');
const assert = require('node:assert/strict');
require('../png-metadata.js');
const M = globalThis.TRPGPngMetadata;
const image = new Blob([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR4nGNgAAIAAAUAAXpeqz8AAAAASUVORK5CYII=', 'base64')], { type: 'image/png' });

test('개인·파티 결과의 한국어와 개행을 iTXt로 보존하고 교체한다', async () => {
  const profiles = [{ displayName: '유나 🎲', note: '첫 줄\n다음 줄' }, { displayName: '두 번째' }];
  const png = await M.embed(image, profiles);
  assert.equal(png.type, 'image/png');
  assert.deepEqual(await M.read(png), profiles);
  assert.deepEqual(await M.read(await M.embed(png, [profiles[0]])), [profiles[0]]);
});

test('메타데이터 없는 PNG·손상·잘린 파일·크기 초과를 거부한다', async () => {
  await assert.rejects(M.read(image), /비교 데이터가 없어요/);
  const png = new Uint8Array(await (await M.embed(image, [{ displayName: '유나' }])).arrayBuffer());
  const damaged = png.slice(); damaged[damaged.length - 20] ^= 1;
  await assert.rejects(M.read(new Blob([damaged])), /손상/);
  await assert.rejects(M.read(new Blob([png.subarray(0, png.length - 1)])), /손상/);
  await assert.rejects(M.read({ size: 50_000_001 }), /50MB/);
  await assert.rejects(M.embed(image, [{ note: '가'.repeat(700_000) }]), /2MB/);
});

test('빈 참가자 목록과 지원하지 않는 버전을 거부한다', async () => {
  await assert.rejects(M.read(await M.embed(image, [])), /지원하지 않는/);
  const png = Buffer.from(await (await M.embed(image, [{}])).arrayBuffer());
  const marker = Buffer.from('"version":1'), offset = png.indexOf(marker);
  png[offset + marker.length - 1] = 50;
  // 잘못된 버전이지만 정상 CRC인 청크를 외부 파일처럼 구성합니다.
  let start = 8;
  while (png.toString('ascii', start + 4, start + 8) !== 'iTXt') start += png.readUInt32BE(start) + 12;
  const end = start + png.readUInt32BE(start) + 8;
  let crc = 0xffffffff;
  for (const byte of png.subarray(start + 4, end)) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
  }
  png.writeUInt32BE((crc ^ 0xffffffff) >>> 0, end);
  await assert.rejects(M.read(new Blob([png])), /지원하지 않는/);
});
