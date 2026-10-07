const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require(process.env.TRPG_PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
const server = http.createServer((req, res) => {
  const file = path.resolve(root, '.' + new URL(req.url, 'http://localhost').pathname);
  if (!file.startsWith(root + path.sep)) return res.writeHead(403).end();
  try { res.setHeader('Content-Type', file.endsWith('.html') ? 'text/html' : 'text/javascript'); res.end(fs.readFileSync(file)); }
  catch { res.writeHead(404).end(); }
});
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({ headless: true, executablePath: process.env.TRPG_BROWSER || undefined });
    const page = await browser.newPage();
    await page.goto(`http://127.0.0.1:${server.address().port}/watermark-demo.html`);
    const result = await page.evaluate(async () => {
      const W = JsonWatermark, C = WatermarkCodec;
      const fixture = { version: 1, name: '테스트 캐릭터', id: 12345, tags: ['캐릭터', '테스트'], description: '한글 데이터 복원 테스트' };
      function equal(a, b, label) { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(label); }
      async function rejects(action, pattern) {
        try { await action(); } catch (error) { if (pattern.test(error.message)) return error.message; throw error; }
        throw new Error('Expected failure: ' + pattern);
      }
      async function image(style, width = 768, height = 768) {
        const c = new OffscreenCanvas(width, height), ctx = c.getContext('2d');
        if (style === 'transparent') ctx.clearRect(0, 0, width, height);
        else if (style === 'white' || style === 'black') { ctx.fillStyle = style; ctx.fillRect(0, 0, width, height); }
        else {
          const pixels = ctx.createImageData(width, height); let state = 1234567;
          for (let i = 0; i < pixels.data.length; i += 4) {
            state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
            const x = (i / 4) % width, y = Math.floor(i / 4 / width);
            pixels.data[i] = 32 + (x / width) * 180;
            pixels.data[i + 1] = 32 + (y / height) * 180;
            pixels.data[i + 2] = 64 + (state >>> 26); pixels.data[i + 3] = 255;
          }
          ctx.putImageData(pixels, 0, 0);
        }
        return c.convertToBlob({ type: 'image/png' });
      }
      async function convert(blob, type, quality, scale = 1) {
        const bitmap = await createImageBitmap(blob);
        try {
          const c = new OffscreenCanvas(Math.round(bitmap.width * scale), Math.round(bitmap.height * scale));
          c.getContext('2d').drawImage(bitmap, 0, 0, c.width, c.height);
          return c.convertToBlob({ type, quality });
        } finally { bitmap.close(); }
      }
      const passed = [], robustness = [];
      for (const style of ['texture', 'white', 'black', 'transparent']) {
        const input = await image(style);
        await rejects(() => W.extractJsonFromImage(input), /Watermark not found/);
        const encoded = await W.embedJsonIntoImage(input, fixture);
        if (encoded.type !== 'image/png') throw new Error('Wrong MIME');
        equal(await W.extractJsonFromImage(encoded), fixture, style + ' PNG round-trip');
        equal(await W.extractJsonFromImage(await convert(encoded, 'image/png')), fixture, style + ' PNG re-encode');
        // Test file bytes only here: implementation must never inspect PNG chunks.
        const bytes = new Uint8Array(await encoded.arrayBuffer()), view = new DataView(bytes.buffer);
        for (let offset = 8; offset < bytes.length;) {
          const type = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8));
          if (['iTXt', 'tEXt', 'zTXt', 'eXIf'].includes(type)) throw new Error('Metadata carrier found');
          offset += view.getUint32(offset) + 12;
        }
        passed.push(style + ': PNG/UTF-8/re-encode/no watermark/no text chunks');
        for (const quality of [.9, .75, .5]) {
          try { equal(await W.extractJsonFromImage(await convert(encoded, 'image/jpeg', quality)), fixture, 'JPEG'); robustness.push({ style, quality, recovered: true }); }
          catch (error) { robustness.push({ style, quality, recovered: false, error: error.message }); }
        }
      }
      const source = await image('texture');
      await rejects(() => W.extractJsonFromImage(new Blob(['not an image'])), /Image decoding failed/);
      for (const options of [{ strength: 10, redundancy: 3 }, { strength: 80, redundancy: 7 }, { blockSize: 16, redundancy: 1, coefficients: [[3, 4], [4, 3]] }]) {
        const input = options.blockSize === 16 ? await image('texture', 1024, 1024) : source;
        equal(await W.extractJsonFromImage(await W.embedJsonIntoImage(input, fixture, options)), fixture, 'Options');
      }
      passed.push('strength/redundancy/blockSize/coefficient options');
      const nativeCompression = globalThis.CompressionStream;
      try {
        globalThis.CompressionStream = undefined;
        equal(await W.extractJsonFromImage(await W.embedJsonIntoImage(source, fixture)), fixture, 'Raw fallback');
      } finally { globalThis.CompressionStream = nativeCompression; }
      passed.push('uncompressed fallback');
      for (const value of [null, false, 123, '문자열 🎲', [1, '한글'], {}]) equal(await W.extractJsonFromImage(await W.embedJsonIntoImage(source, value)), value, 'JSON scalar');
      passed.push('all JSON root types');
      const small = await image('white', 64, 64);
      await rejects(() => W.embedJsonIntoImage(small, fixture), /Payload too large/);
      // Capacity boundary with compression disabled: exactly capacity succeeds, one byte beyond fails.
      const capacity = W.getWatermarkCapacity(768, 768, { redundancy: 1 });
      try {
        globalThis.CompressionStream = undefined;
        const exact = 'x'.repeat(capacity - 2);
        equal(await W.extractJsonFromImage(await W.embedJsonIntoImage(source, exact, { redundancy: 1 })), exact, 'Exact capacity');
        await rejects(() => W.embedJsonIntoImage(source, exact + 'x', { redundancy: 1 }), /Payload too large.*\nRequired: \d+ bits\nAvailable: \d+ bits/);
      } finally { globalThis.CompressionStream = nativeCompression; }
      passed.push('capacity exact boundary and oversize rejection');
      const encoded = await W.embedJsonIntoImage(source, fixture);
      const pixels = await W.blobToImageData(encoded), positions = W.generateBlockPositions(pixels.width, pixels.height);
      const packet = await C.encode(fixture, { strength: 40, redundancy: 5, blockSize: 8, coefficients: [[2, 3], [3, 2]] });
      const headerBlocks = C.HEADER_BYTES * 8 * C.HEADER_REDUNDANCY, bodyBits = packet.body.length * 8;
      function erase(start, length) {
        for (let i = start; i < start + length; i++) {
          const block = positions[i], left = block % 96 * 8, top = Math.floor(block / 96) * 8;
          for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
            const p = ((top + y) * pixels.width + left + x) * 4;
            pixels.data[p] = pixels.data[p + 1] = pixels.data[p + 2] = 128;
          }
        }
      }
      erase(0, C.HEADER_BYTES * 8 * 2); erase(headerBlocks, bodyBits * 2);
      equal(await W.extractJsonFromImage(await W.imageDataToPng(pixels)), fixture, 'Replica damage');
      erase(headerBlocks + bodyBits * 2, bodyBits);
      await rejects(async () => W.extractJsonFromImage(await W.imageDataToPng(pixels)), /Watermark checksum mismatch/);
      passed.push('2/5 destroyed replicas recover, 3/5 fail CRC');
      const resizeError = await rejects(async () => W.extractJsonFromImage(await convert(encoded, 'image/png', undefined, .75)), /Watermark not found/);
      robustness.push({ resize: .75, recovered: false, error: resizeError });
      const bitmapApi = globalThis.createImageBitmap, offscreen = globalThis.OffscreenCanvas;
      try {
        globalThis.createImageBitmap = undefined; globalThis.OffscreenCanvas = undefined;
        equal(await W.extractJsonFromImage(await W.embedJsonIntoImage(source, fixture)), fixture, 'DOM API fallback');
      } finally { globalThis.createImageBitmap = bitmapApi; globalThis.OffscreenCanvas = offscreen; }
      passed.push('HTMLImageElement/HTMLCanvasElement fallback');
      return { passed, robustness };
    });
    assert.ok(result.passed.length >= 10);
    console.log(JSON.stringify(result, null, 2));
  } finally { await browser?.close(); server.close(); }
})().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
