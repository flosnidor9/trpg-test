/* PNG 원본의 iTXt에만 비교 데이터를 저장합니다. 이미지 디코딩·업로드는 하지 않습니다. */
(() => {
  'use strict';
  const keyword = 'TRPG Playstyle', format = 'trpg-playstyle-png';
  const maxDataSize = 2_000_000, maxFileSize = 50_000_000;
  const signature = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const encoder = new TextEncoder(), decoder = new TextDecoder('utf-8', { fatal: true });
  const crcTable = Uint32Array.from({ length: 256 }, (_, n) => {
    for (let i = 0; i < 8; i++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1;
    return n >>> 0;
  });
  function crc(bytes) {
    let value = 0xffffffff;
    for (const byte of bytes) value = crcTable[(value ^ byte) & 255] ^ (value >>> 8);
    return (value ^ 0xffffffff) >>> 0;
  }
  function chunks(bytes) {
    if (bytes.length > maxFileSize) throw new Error('PNG는 50MB 이하로 불러와 주세요.');
    const invalid = () => new Error('PNG 파일이 손상되었거나 형식이 올바르지 않아요. 원본 파일을 불러와 주세요.');
    if (bytes.length < 8 || !signature.every((byte, i) => byte === bytes[i])) throw invalid();
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), result = [];
    let offset = 8;
    while (offset < bytes.length) {
      if (offset + 12 > bytes.length) throw invalid();
      const size = view.getUint32(offset), end = offset + size + 12;
      if (end > bytes.length) throw invalid();
      const type = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8));
      if (!/^[A-Za-z]{4}$/.test(type) || crc(bytes.subarray(offset + 4, end - 4)) !== view.getUint32(end - 4)) throw invalid();
      if (!result.length && (type !== 'IHDR' || size !== 13)) throw invalid();
      result.push({ type, offset, end, data: bytes.subarray(offset + 8, end - 4) });
      offset = end;
      if (type === 'IEND') {
        if (size !== 0 || offset !== bytes.length || !result.some(chunk => chunk.type === 'IDAT')) throw invalid();
        return result;
      }
    }
    throw invalid();
  }
  function isMetadata(chunk) {
    return chunk.type === 'iTXt' && chunk.data.indexOf(0) === keyword.length &&
      keyword.split('').every((char, i) => chunk.data[i] === char.charCodeAt(0));
  }
  async function embed(blob, profiles) {
    const json = encoder.encode(JSON.stringify({ format, version: 1, profiles }));
    if (json.length > maxDataSize) throw new Error('비교 데이터가 2MB를 넘어요. 참가자를 나눠 저장해 주세요.');
    // keyword, NUL, compression flag/method, empty language/translated keyword, UTF-8 JSON.
    const header = encoder.encode(keyword), data = new Uint8Array(header.length + 5 + json.length);
    data.set(header); data.set(json, header.length + 5);
    const chunk = new Uint8Array(data.length + 12), view = new DataView(chunk.buffer);
    view.setUint32(0, data.length); chunk.set(encoder.encode('iTXt'), 4); chunk.set(data, 8);
    view.setUint32(chunk.length - 4, crc(chunk.subarray(4, chunk.length - 4)));
    const bytes = new Uint8Array(await blob.arrayBuffer()), parts = [signature];
    for (const item of chunks(bytes)) {
      if (isMetadata(item)) continue;
      if (item.type === 'IEND') parts.push(chunk);
      parts.push(bytes.subarray(item.offset, item.end));
    }
    return new Blob(parts, { type: 'image/png' });
  }
  async function read(file) {
    if (file.size > maxFileSize) throw new Error('PNG는 50MB 이하로 불러와 주세요.');
    const entries = chunks(new Uint8Array(await file.arrayBuffer())).filter(isMetadata);
    if (!entries.length) throw new Error('비교 데이터가 없어요. 원본 PNG 또는 JSON을 불러와 주세요.');
    if (entries.length !== 1) throw new Error('PNG의 비교 데이터가 중복되어 있어요. 원본 파일을 불러와 주세요.');
    const data = entries[0].data;
    let offset = keyword.length + 1;
    if (data[offset++] !== 0 || data[offset++] !== 0) throw new Error('지원하지 않는 PNG 메타데이터 형식이에요. JSON을 불러와 주세요.');
    for (let i = 0; i < 2; i++) {
      const end = data.indexOf(0, offset);
      if (end < 0) throw new Error('PNG의 비교 데이터 형식이 올바르지 않아요.');
      offset = end + 1;
    }
    if (data.length - offset > maxDataSize) throw new Error('비교 데이터는 2MB 이하로 불러와 주세요.');
    let payload;
    try { payload = JSON.parse(decoder.decode(data.subarray(offset))); }
    catch { throw new Error('PNG의 비교 JSON을 읽지 못했어요. 원본 PNG 또는 JSON을 불러와 주세요.'); }
    if (payload?.format !== format || payload.version !== 1 || !Array.isArray(payload.profiles) || !payload.profiles.length) {
      throw new Error('지원하지 않는 PNG 비교 데이터예요. 원본 PNG 또는 JSON을 불러와 주세요.');
    }
    return payload.profiles;
  }
  globalThis.TRPGPngMetadata = { embed, read };
})();
