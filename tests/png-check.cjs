const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const os = require('node:os');
const { chromium } = require(process.env.TRPG_PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
const artifacts = fs.mkdtempSync(path.join(os.tmpdir(), 'trpg-png-'));
const server = http.createServer((req, res) => {
  const file = path.resolve(root, '.' + new URL(req.url, 'http://localhost').pathname);
  if (!file.startsWith(root + path.sep)) return res.writeHead(403).end();
  try {
    res.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' })[path.extname(file)] || 'application/octet-stream');
    res.end(fs.readFileSync(file));
  } catch { res.writeHead(404).end(); }
});
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.route('https://cdn.jsdelivr.net/**', route => route.abort());
    const base = 'http://127.0.0.1:' + server.address().port;
    await page.goto(base + '/result.html');
    assert.equal(await page.locator('#profile-png').isVisible(), false);
    const profile = await page.evaluate(() => {
      const responses = {};
      TRPGData.questions.forEach(q => {
        responses[q.id] = { value: q.type === 'trait' ? q.options.at(-1)[0] : q.type === 'matrix' ? Object.fromEntries(q.rows.map(([id]) => [id, q.options[0][0]])) : q.type === 'text' ? '' : q.options[0][0] };
      });
      const profile = TRPGApp.makeProfile(responses, '모험가 유나');
      localStorage.setItem(TRPGApp.STORAGE, JSON.stringify(profile)); return profile;
    });
    await page.reload();
    const cardRendering = await page.evaluate(async profile => {
      const cards = TRPGCards.featuredCards(profile.responses);
      const card = { ...cards[0], description: '첫 번째 선호입니다.\r\n두 번째 선호입니다.\n\n세 번째 선호입니다.' };
      const proto = CanvasRenderingContext2D.prototype;
      const drawImage = proto.drawImage, fillText = proto.fillText;
      const images = [], texts = [];
      proto.drawImage = function(...args) {
        if (args.length === 9) images.push({ sourceRatio: args[3] / args[4], outputRatio: args[7] / args[8] });
        return drawImage.apply(this, args);
      };
      proto.fillText = function(...args) { texts.push({ text: args[0], y: args[2] }); return fillText.apply(this, args); };
      try {
        await TRPGPng.create({ title: '줄바꿈 확인', members: [{ id: 1, profile, color: TRPGApp.COLORS[0], index: 0 }], cards: [card] });
        return { images, texts, descriptions: cards.map(card => card.description) };
      } finally { proto.drawImage = drawImage; proto.fillText = fillText; }
    }, profile);
    assert.equal(cardRendering.images.length, 1);
    assert.ok(Math.abs(cardRendering.images[0].sourceRatio - cardRendering.images[0].outputRatio) < 1e-10, '그림 원본 비율 유지');
    const paragraphs = ['첫 번째 선호입니다.', '두 번째 선호입니다.', '세 번째 선호입니다.'].map(value => cardRendering.texts.find(item => item.text === value));
    assert.ok(paragraphs.every(Boolean));
    assert.ok(paragraphs[1].y - paragraphs[0].y > 31 && paragraphs[2].y - paragraphs[1].y > 31, '설명 개행과 문단 간격 유지');
    assert.ok(cardRendering.descriptions.every(value => value.includes('\n')), '카드 데이터 문장별 개행 유지');
    assert.equal(await page.locator('#profile-png').evaluate(el => !!el.closest('#export-section')), true);
    await page.locator('#export-section').screenshot({ path: path.join(artifacts, 'export-controls.png') });
    async function save(button, filename) {
      await page.locator(button).click();
      await page.locator('.png-dialog[open] img').waitFor();
      assert.equal(await page.locator('.png-dialog img').evaluate(img => img.complete && img.naturalWidth === 1920), true);
      const downloadPromise = page.waitForEvent('download');
      await page.locator('.png-save').click();
      const download = await downloadPromise;
      await download.saveAs(path.join(artifacts, filename));
      const buffer = fs.readFileSync(path.join(artifacts, filename));
      assert.equal(buffer.subarray(1, 4).toString(), 'PNG');
      assert.ok(buffer.readUInt32BE(20) > 1000);
      await page.keyboard.press('Escape');
      assert.equal(await page.locator(button).evaluate(el => el === document.activeElement), true);
    }
    await save('#profile-png', 'personal.png');
    await page.goto(base + '/compare.html');
    assert.equal(await page.locator('#party-png').isVisible(), false);
    await page.locator('.paste-disclosure summary').click();
    for (let i = 0; i < 6; i++) {
      await page.locator('#json-input').fill(JSON.stringify({ ...profile, displayName: i === 5 ? '긴 이름을 가진 마지막 모험가'.repeat(3) : '참가자 ' + (i + 1) }));
      await page.locator('#add-json').click();
      if (i === 0) await save('#party-png', 'one-person.png');
      if (i === 1) {
        await page.locator('.party-map-reading summary').click();
        assert.equal(await page.locator('#radar-data-summary table').isVisible(), true);
        assert.equal(await page.locator('#radar-data-summary tbody tr').count(), 6);
        assert.equal(await page.locator('#radar-data-summary').textContent().then(text => /참가자 1|참가자 2/.test(text)), false);
        await page.locator('.party-map-heading').screenshot({ path: path.join(artifacts, 'party-controls.png') });
        assert.ok(await page.locator('.common-card-art svg').count() > 0);
        assert.equal(await page.locator('#radar-overlap-value').textContent(), '100%');
        await save('#party-png', 'party.png');
      }
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await save('#party-png', 'six-person.png');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
    await page.locator('#person-tab-1').click();
    await save('#personal-profile-png', 'participant.png');
    await page.locator('#party-tab').click();
    for (const checkbox of await page.locator('[data-person]').all()) await checkbox.uncheck();
    assert.equal(await page.locator('#party-png').isDisabled(), true);
    await page.locator('#json-input').fill('{invalid'); await page.locator('#add-json').click();
    assert.match(await page.locator('#import-message').textContent(), /JSON/);
    const empty = await page.evaluate(async () => {
      const profile = TRPGApp.makeProfile({}, '미확인 모험가');
      const canvas = await TRPGPng.create({ title: '미확인 지도', party: true, members: [{ id: 1, profile, color: TRPGApp.COLORS[0], index: 0 }], cards: [] });
      return canvas.toDataURL();
    });
    fs.writeFileSync(path.join(artifacts, 'empty.png'), Buffer.from(empty.split(',')[1], 'base64'));
    assert.deepEqual(errors, []);
    console.log('PNG export checks passed. Artifacts: ' + artifacts);
  } finally { await browser.close(); server.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; server.close(); });
