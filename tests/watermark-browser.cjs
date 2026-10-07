const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require(process.env.TRPG_PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
const server = http.createServer((req, res) => {
  const file = path.resolve(root, '.' + new URL(req.url, 'http://localhost').pathname);
  if (!file.startsWith(root + path.sep)) return res.writeHead(403).end();
  try { res.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' })[path.extname(file)] || 'application/json'); res.end(fs.readFileSync(file)); }
  catch { res.writeHead(404).end(); }
});
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({ headless: true, executablePath: process.env.TRPG_BROWSER || undefined });
    const page = await browser.newPage();
    page.on('console', message => { if (message.type() === 'log') console.error(message.text()); });
    await page.route('https://cdn.jsdelivr.net/**', route => route.abort());
    await page.goto(`http://127.0.0.1:${server.address().port}/result.html`);
    // Frozen v1 implementation creates authentic old images, independent of v2.
    await page.addScriptTag({ path: path.join(__dirname, 'fixtures/watermark-v1.js') });
    await page.evaluate(() => { globalThis.LegacyWatermark = JsonWatermark; });
    await page.addScriptTag({ path: path.join(root, 'watermark.js') });
    const result = await page.evaluate(async () => {
      const W = JsonWatermark, C = WatermarkCodec;
      const fixture = { version: 1, name: '테스트 캐릭터 🎲', tags: ['캐릭터', '테스트'], description: '한글 데이터 복원 테스트' };
      function equal(a, b, label) { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(label); }
      async function rejects(action, pattern) {
        try { await action(); } catch (error) { if (pattern.test(error.message)) return error; throw error; }
        throw new Error('Expected failure: ' + pattern);
      }
      async function image(style, width = 1200, height = 1200) {
        const c = new OffscreenCanvas(width, height), ctx = c.getContext('2d');
        if (['white', 'black', 'transparent'].includes(style)) {
          if (style !== 'transparent') { ctx.fillStyle = style; ctx.fillRect(0, 0, width, height); }
        } else {
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
      async function convert(blob, type, quality, scale = 1, colorShift = 0) {
        const bitmap = await createImageBitmap(blob);
        try {
          const c = new OffscreenCanvas(Math.round(bitmap.width * scale), Math.round(bitmap.height * scale)), ctx = c.getContext('2d');
          ctx.imageSmoothingQuality = 'high'; ctx.drawImage(bitmap, 0, 0, c.width, c.height);
          if (colorShift) {
            const p = ctx.getImageData(0, 0, c.width, c.height);
            for (let i = 0; i < p.data.length; i += 4) for (let j = 0; j < 3; j++) p.data[i + j] += colorShift;
            ctx.putImageData(p, 0, 0);
          }
          return c.convertToBlob({ type, quality });
        } finally { bitmap.close(); }
      }
      const passed = [], robustness = [];
      async function checkTransforms(encoded, expected, style) {
        const cases = [
          ['round-trip', 'image/png', undefined, 1], ['canvas PNG', 'image/png', undefined, 1],
          ['JPEG .9', 'image/jpeg', .9, 1], ['resize .75', 'image/png', undefined, .75],
          ['resize .75 + JPEG .9', 'image/jpeg', .9, .75],
          ['resize .75 + JPEG .75', 'image/jpeg', .75, .75],
          ['resize .75 + WebP .8', 'image/webp', .8, .75],
          ['color +8 + JPEG .9', 'image/jpeg', .9, 1, 8],
          ['resize .5 + JPEG .9', 'image/jpeg', .9, .5],
          ['resize .25 + JPEG .75', 'image/jpeg', .75, .25],
        ];
        for (let i = 0; i < cases.length; i++) {
          const [label, type, quality, scale, shift] = cases[i];
          const input = i === 0 ? encoded : await convert(encoded, type, quality, scale, shift);
          const started = performance.now();
          try {
            const result = await W.extractJsonFromImageDetailed(input);
            equal(result.json, expected, `${style}: ${label}`);
            const attempt = result.debug.triedNormalizations.find(a => a.crcOk);
            if (!attempt || !attempt.magicOk || !attempt.headerCrcOk) throw new Error('Missing validation');
            robustness.push({ style, label, recovered: true, ms: Math.round(performance.now() - started), normalization: `${attempt.width}x${attempt.height}`, score: +attempt.score.toFixed(3), voting: attempt.voting });
          } catch (error) {
            robustness.push({ style, label, recovered: false, ms: Math.round(performance.now() - started), error: error.message });
            // Requirements 1..5 are mandatory in this controlled fixture matrix.
            if (i <= 4) throw error;
          }
        }
        console.log('Checked transformations: ' + style);
      }
      for (const style of ['texture', 'white', 'black', 'transparent']) {
        const source = await image(style), encoded = await W.embedJsonIntoImage(source, fixture);
        await checkTransforms(encoded, fixture, style);
        const bytes = new Uint8Array(await encoded.arrayBuffer()), view = new DataView(bytes.buffer);
        for (let offset = 8; offset < bytes.length;) {
          const type = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8));
          if (['iTXt', 'tEXt', 'zTXt', 'eXIf'].includes(type)) throw new Error('Metadata carrier found');
          offset += view.getUint32(offset) + 12;
        }
      }
      passed.push('PNG/re-encode/JPEG/resize/resize+JPEG: four synthetic styles; no metadata chunks');
      const profile = TRPGApp.validateProfile(await (await fetch('/examples/sample-yuna.json')).json());
      const canvas = await TRPGPng.create({ title: '유나의 플레이 성향', members: [{ id: 1, profile, color: TRPGApp.COLORS[0], index: 0 }], cards: TRPGCards.featuredCards(profile.responses) });
      const payload = { format: 'trpg-playstyle-png', version: 1, profiles: [TRPGApp.exportProfile(profile)] };
      const png = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      await checkTransforms(await W.embedJsonIntoImage(png, payload), payload, 'real profile');
      passed.push('real profile, compressed ~900 bytes, automatic capacity selection');
      const source = await image('texture');
      const missing = await rejects(() => W.extractJsonFromImage(source), /Watermark not found/);
      if (!missing.debug?.triedNormalizations.length) throw new Error('Missing failure diagnostics');
      passed.push('no watermark rejected with diagnostics');
      await rejects(() => W.extractJsonFromImage(new Blob(['not an image'])), /Image decoding failed/);
      for (const options of [
        { strength: 80, redundancy: 9, maxDimension: 1024 },
        { strength: 120, redundancy: 7, maxDimension: 1200, coefficients: [[2, 3], [3, 2]] },
        { blockSize: 16, redundancy: 3, maxDimension: 1200, coefficients: [[3, 4], [4, 3]] },
        { maxDimension: 1000, outputCanonicalizedImage: false },
      ]) {
        const encoded = await W.embedJsonIntoImage(source, fixture, options);
        equal(await W.extractJsonFromImage(encoded, { maxDimensions: [options.maxDimension], coefficientPairs: [options.coefficients || [[1, 2], [2, 1]]] }), fixture, 'Options');
      }
      passed.push('strength/redundancy/blockSize/custom coefficients/custom normalization/original-sized output');
      const normalized = await W.normalizeForWatermark(await image('texture', 1920, 1080), { maxDimension: 1200 });
      if (normalized.width !== 1200 || normalized.height !== 675) throw new Error('Wrong aspect ratio');
      // Old formats are still readable, including legacy errors.
      const legacy = await LegacyWatermark.embedJsonIntoImage(source, fixture);
      equal(await W.extractJsonFromImage(legacy), fixture, 'v1 compatibility');
      const cstream = globalThis.CompressionStream;
      try {
        globalThis.CompressionStream = undefined;
        for (const json of [null, false, 123, '문자열 🎲', [1, '한글'], {}]) equal(await W.extractJsonFromImage(await W.embedJsonIntoImage(source, json)), json, 'Raw/scalars');
        const options = { maxDimension: 1200, redundancy: 1 };
        const capacity = W.getWatermarkCapacity(1200, 1200, options), json = 'x'.repeat(capacity - 2);
        equal(await W.extractJsonFromImage(await W.embedJsonIntoImage(source, json, options)), json, 'Capacity boundary');
        await rejects(() => W.embedJsonIntoImage(source, json + 'x', options), /Payload too large/);
      } finally { globalThis.CompressionStream = cstream; }
      await rejects(() => W.embedJsonIntoImage(source, fixture, { maxDimension: 64 }), /Payload too large/);
      passed.push('v1 compatibility/raw fallback/JSON scalars/exact capacity/oversize rejection');
      // Deliberately erase three out of seven chunk replicas: soft/hard voting restores data.
      const encoded = await W.embedJsonIntoImage(source, fixture), data = await W.blobToImageData(encoded);
      const positions = W.generateBlockPositions(data.width, data.height);
      const packet = await C.encode(fixture, { strength: 100, redundancy: 7, blockSize: 8, coefficients: [[1, 2], [2, 1]], wireVersion: 2 });
      const chunkBits = Math.min(128, packet.body.length) * 8, start = 64 * 7 + C.HEADER_BYTES * 8 * C.HEADER_REDUNDANCY;
      function erase(offset, length) {
        const columns = Math.floor(data.width / 8);
        for (let i = offset; i < offset + length; i++) {
          const block = positions[i], left = block % columns * 8, top = Math.floor(block / columns) * 8;
          for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
            const p = ((top + y) * data.width + left + x) * 4;
            data.data[p] = data.data[p + 1] = data.data[p + 2] = 128;
          }
        }
      }
      erase(start, chunkBits * 3);
      equal(await W.extractJsonFromImage(await W.imageDataToPng(data)), fixture, '3/7 replicas erased');
      erase(start + chunkBits * 3, chunkBits * 4);
      const error = await rejects(async () => W.extractJsonFromImage(await W.imageDataToPng(data)), /checksum/);
      if (!error.debug.triedNormalizations.some(a => a.headerCrcOk && !a.crcOk)) throw new Error('No CRC failure diagnostics');
      passed.push('damaged replicas recover; unrecoverable payload fails CRC');
      const bitmap = globalThis.createImageBitmap, offscreen = globalThis.OffscreenCanvas;
      try {
        globalThis.createImageBitmap = undefined; globalThis.OffscreenCanvas = undefined;
        equal(await W.extractJsonFromImage(await W.embedJsonIntoImage(source, fixture)), fixture, 'DOM fallback');
      } finally { globalThis.createImageBitmap = bitmap; globalThis.OffscreenCanvas = offscreen; }
      passed.push('HTMLImageElement/HTMLCanvasElement fallback');
      return { passed, robustness };
    });
    assert.equal(result.passed.length, 7);
    console.log(JSON.stringify(result, null, 2));
  } finally { await browser?.close(); server.close(); }
})().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
