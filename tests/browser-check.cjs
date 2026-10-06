/* TRPG_PLAYWRIGHT_MODULE에 Playwright 패키지 경로를 지정할 수 있습니다. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const { chromium } = require(process.env.TRPG_PLAYWRIGHT_MODULE || 'playwright');
const AxeBuilder = process.env.TRPG_AXE_MODULE ? require(process.env.TRPG_AXE_MODULE).default : null;
const root = path.resolve(__dirname, '..');
const artifacts = process.env.TRPG_CHECK_ARTIFACTS || fs.mkdtempSync(path.join(os.tmpdir(), 'trpg-ui-'));
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };
const server = http.createServer((req, res) => {
  const requested = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const file = path.resolve(root, '.' + (requested === '/' ? '/index.html' : requested));
  if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
  try { res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' }); res.end(fs.readFileSync(file)); }
  catch { res.writeHead(404).end('Not found'); }
});
function fixtureInBrowser({ value = 75, name = '참가자', boundary = 'ask' } = {}) {
  const A = globalThis.TRPGApp, D = globalThis.TRPGData;
  const responses = {};
  D.questions.forEach(q => {
    responses[q.id] = { value: q.type === 'trait' ? value : q.type === 'matrix' ? Object.fromEntries(q.rows.map(([id]) => [id, q.boundary ? boundary : q.options[0][0]])) : q.options[0][0] };
    if (q.fields) responses[q.id].fields = Object.fromEntries(q.fields.filter(f => !f.when || f.when === responses[q.id].value).map(f => [f.key, f.type === 'select' ? f.options[0][0] : f.type === 'number' ? '3' : '메모']));
  });
  return A.makeProfile(responses, name);
}
async function noPageOverflow(page) {
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, '화면 바깥 가로 넘침');
}
async function accessibility(page, name) {
  if (!AxeBuilder) return;
  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  assert.deepEqual(violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) })), [], name + ' 접근성');
}
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  const macChrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  const browser = await chromium.launch({ headless: true, executablePath: process.env.TRPG_BROWSER || (fs.existsSync(macChrome) ? macChrome : undefined) });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', err => errors.push(err.message));
  // 폰트 CDN 연결 여부와 별개로 앱 동작을 확인합니다.
  await context.route('https://cdn.jsdelivr.net/**', route => route.abort());
  try {
    await page.goto(base + '/result.html');
    await page.getByText('아직 결과가 없어요.', { exact: true }).waitFor();
    await page.goto(base + '/test.html');
    assert.equal(await page.locator('#prev, #next').count(), 0);
    assert.equal(await page.locator('.question-card').count(), 1);
    await page.locator('#question-basis .choice input').first().focus();
    await page.keyboard.press('ArrowDown');
    assert.equal(await page.locator('#question-basis .choice input').nth(1).isChecked(), true);
    assert.equal(await page.locator('.question-card').count(), 2);
    await page.waitForFunction(() => window.scrollY > 0);
    await page.locator('#question-basis .choice').first().click();
    assert.equal(await page.locator('.question-card').count(), 2, '이전 답변 수정은 다음 문항을 추가하지 않음');
    await accessibility(page, '테스트');
    await page.reload();
    assert.equal(await page.locator('#question-basis .choice input').first().isChecked(), true);
    assert.equal(await page.locator('.question-card').count(), 2);
    // 필수 자유 입력은 작성 도중 이동하지 않고, 작성 완료 후 다음 문항을 표시합니다.
    await page.locator('#question-medium input[value="other"]').check();
    await page.locator('#field-medium-note').fill('별도 매체에서 참여하고 싶어요');
    assert.equal(await page.locator('.question-card').count(), 2);
    await page.keyboard.press('Tab');
    assert.equal(await page.locator('.question-card').count(), 3);
    await page.locator('#question-medium input[value="voice"]').check();
    assert.equal(await page.locator('.question-card').count(), 3);
    const questionIds = await page.evaluate(() => TRPGData.questions.map(q => q.id));
    for (let i = 2; i < questionIds.length; i++) {
      const card = page.locator('#question-' + questionIds[i]);
      const rows = card.locator('[data-row]');
      if (await rows.count()) {
        for (let j = 0; j < await rows.count(); j++) await rows.nth(j).selectOption({ index: 1 });
        if (await card.locator('[data-row="pvp"]').count()) await card.locator('[data-row="pvp"]').selectOption('private');
      } else await card.locator('.choice').first().click();
      const fields = card.locator('[data-field][required]');
      for (let j = 0; j < await fields.count(); j++) {
        const field = fields.nth(j);
        const tag = await field.evaluate(el => el.tagName);
        if (tag === 'SELECT') await field.selectOption({ index: 1 });
        else { await field.fill('3'); await field.blur(); }
      }
      assert.equal(await page.locator('.question-card').count(), Math.min(i + 2, questionIds.length), '문항 ' + (i + 1));
    }
    assert.equal(await page.locator('#finish-test').isEnabled(), true);
    await page.locator('#finish-test').scrollIntoViewIfNeeded();
    const desktopReset = await page.locator('#reset-test').boundingBox();
    assert.ok(desktopReset.y >= 0 && desktopReset.y + desktopReset.height < 100, '데스크톱 스크롤 중 우측 상단 초기화 유지');
    // 앞선 필수 답변을 지우면 결과를 확정할 수 없고, 뒤 문항은 유지합니다.
    await page.locator('#field-O01-need').selectOption('');
    assert.equal(await page.locator('#finish-test').isDisabled(), true);
    assert.equal(await page.locator('.question-card').count(), 42);
    await page.locator('#field-O01-need').selectOption('need');
    assert.equal(await page.locator('#finish-test').isEnabled(), true);
    await page.locator('#finish-test').click();
    await page.waitForURL('**/result.html');
    assert.equal(await page.locator('#answer-notes .narrative-card').count(), 6);
    assert.equal(await page.locator('#operation-notes .narrative-card').count(), 22);
    assert.ok(await page.locator('#profile-story').textContent());
    await noPageOverflow(page);
    await accessibility(page, '결과');
    await page.screenshot({ path: path.join(artifacts, 'result-desktop.png') });
    await page.locator('#share-boundaries').check();
    const preview = JSON.parse(await page.locator('#export-preview').inputValue());
    assert.equal(preview.schemaVersion, '3.0');
    assert.ok(preview.responses.B01);
    assert.equal(preview.responses.B01.value.pvp, undefined);
    const downloadEvent = page.waitForEvent('download');
    await page.locator('#download').click();
    const download = await downloadEvent;
    await download.saveAs(path.join(artifacts, 'export-check.json'));
    const exported = JSON.parse(fs.readFileSync(path.join(artifacts, 'export-check.json'), 'utf8'));
    assert.equal(exported.responses.B01.value.pvp, undefined);
    const profile = await page.evaluate(() => JSON.parse(localStorage.getItem('trpg-playstyle-profile')));
    await page.goto(base + '/compare.html');
    await page.locator('#json-input').fill('{invalid'); await page.locator('#add-json').click();
    await page.getByText('JSON 형식을 읽지 못했어요.', { exact: false }).waitFor();
    await page.locator('#json-input').fill(JSON.stringify(profile)); await page.locator('#add-json').click();
    assert.equal(await page.locator('#participant-count').textContent(), '1');
    await page.getByText('한 명 더 불러오면 파티를 비교할 수 있어요.', { exact: true }).waitFor();
    for (let i = 1; i <= 7; i++) {
      const generated = await page.evaluate(fixtureInBrowser, { name: '참가자 ' + (i + 1), value: i % 5 * 25, boundary: i === 1 ? 'no' : 'ask' });
      await page.locator('#json-input').fill(JSON.stringify(generated)); await page.locator('#add-json').click();
      if (i === 1) { assert.equal(await page.locator('#participant-count').textContent(), '2'); assert.ok((await page.locator('#alignment-notes').textContent()).includes('포함하지 않음')); }
    }
    assert.equal(await page.locator('#participant-count').textContent(), '8');
    assert.equal(await page.locator('[data-person]:checked').count(), 0);
    assert.equal(await page.locator('.distribution-card').count(), 6);
    assert.ok(await page.locator('.count-chip').count() > 0);
    await accessibility(page, '다수 비교');
    for (let i = 0; i < 6; i++) await page.locator('[data-person]').nth(i).check();
    await page.locator('[data-person]').nth(6).click();
    assert.equal(await page.locator('[data-person]:checked').count(), 6);
    await page.locator('.distribution-marker').first().click();
    assert.equal(await page.locator('.distribution-card details').first().getAttribute('open'), '');
    await noPageOverflow(page);
    await page.screenshot({ path: path.join(artifacts, 'comparison-desktop.png') });
    const malicious = await page.evaluate(fixtureInBrowser, { name: '<img src=x onerror="window.pwned=true">' });
    await page.locator('#json-input').fill(JSON.stringify(malicious)); await page.locator('#add-json').click();
    assert.equal(await page.evaluate(() => Boolean(window.pwned)), false);
    assert.equal(await page.locator('#legend img').count(), 0);
    await page.locator('#file-input').setInputFiles({ name: 'shared-profile.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(exported)) });
    await page.getByText('1명의 결과를 추가했어요.', { exact: false }).waitFor();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await noPageOverflow(page);
    await page.screenshot({ path: path.join(artifacts, 'comparison-mobile.png') });
    await page.goto(base + '/result.html'); await noPageOverflow(page);
    await accessibility(page, '모바일 결과');
    await page.screenshot({ path: path.join(artifacts, 'result-mobile.png') });
    await page.goto(base + '/test.html?edit=1');
    assert.equal(await page.locator('.question-card').count(), 42);
    await page.locator('#question-medium .choice').nth(2).click();
    await page.locator('#question-role .choice').nth(1).click();
    assert.equal(await page.locator('#field-A01-offered').count(), 1, '역할 수정 시 GM 추가 입력도 갱신');
    await page.locator('#question-basis').scrollIntoViewIfNeeded();
    assert.equal(await page.locator('#question-basis .choice input').first().isChecked(), true);
    await noPageOverflow(page);
    assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('.question-card')).animationName), 'none');
    await page.screenshot({ path: path.join(artifacts, 'test-mobile.png') });
    await page.locator('#finish-test').scrollIntoViewIfNeeded();
    const mobileReset = await page.locator('#reset-test').boundingBox();
    assert.ok(mobileReset.y >= 0 && mobileReset.y + mobileReset.height < 100, '모바일 스크롤 중 초기화 유지');
    const savedResult = await page.evaluate(() => localStorage.getItem('trpg-playstyle-profile'));
    await page.locator('#reset-test').focus();
    await page.keyboard.press('Space');
    assert.equal(await page.locator('.question-card').count(), 1);
    assert.equal(await page.locator('input:checked').count(), 0);
    assert.equal(await page.locator('#test-progress').getAttribute('aria-valuenow'), '0');
    assert.equal(await page.locator('#finish-test').isVisible(), false);
    assert.equal(await page.evaluate(() => localStorage.getItem('trpg-rp-draft-v3')), null);
    assert.equal(await page.evaluate(() => new URL(location.href).searchParams.has('edit')), false);
    assert.equal(await page.evaluate(() => localStorage.getItem('trpg-playstyle-profile')), savedResult);
    await page.reload();
    assert.equal(await page.locator('.question-card').count(), 1, '초기화 후 새로고침에도 이전 답변을 복원하지 않음');
    await page.locator('#question-basis .choice').first().click();
    assert.equal(await page.locator('.question-card').count(), 2, '초기화 후 다시 응답 가능');
    await noPageOverflow(page);
    await page.evaluate(() => localStorage.setItem('trpg-playstyle-profile', JSON.stringify({ schemaVersion: '2.0', radar: { pace: 50 } })));
    await page.goto(base + '/result.html'); await page.getByText('이전 설계의 결과입니다.', { exact: true }).waitFor();
    assert.equal(await page.locator('#legacy-download').isVisible(), true);
    assert.deepEqual(errors, []);
    console.log('브라우저 확인 통과: 전체 응답, 중간 저장, 수정, 결과, 1·2·다수 비교, JSON 오류·비공개, 모바일·모션 감소.');
    console.log('스크린샷:', artifacts);
  } finally { await browser.close(); server.close(); }
})().catch(err => { console.error(err); server.close(); process.exitCode = 1; });
