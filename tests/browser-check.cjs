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
function fixtureInBrowser({ value = 75, name = '참가자', boundary = 'ask', role = 'PL' } = {}) {
  const A = globalThis.TRPGApp, D = globalThis.TRPGData;
  const responses = {};
  D.questions.forEach(q => {
    responses[q.id] = { value: q.type === 'trait' ? (q.options.some(([v]) => v === value) ? value : 50) : q.type === 'matrix' ? Object.fromEntries(q.rows.map(([id]) => [id, q.boundary ? boundary : q.options[0][0]])) : q.type === 'text' ? '' : q.options[0][0] };
    if (q.fields) responses[q.id].fields = Object.fromEntries(q.fields.filter(f => !f.when || f.when === responses[q.id].value).map(f => [f.key, f.type === 'select' ? f.options[0][0] : f.type === 'number' ? '3' : '메모']));
  });
  responses.role.value = role;
  return A.makeProfile(responses, name);
}
async function noPageOverflow(page) {
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, '화면 바깥 가로 넘침');
}
async function cardParallax(page, selector, name) {
  const slot = page.locator(selector + ' .handout-slot').first();
  const card = slot.locator('.taste-card');
  assert.equal(await card.locator('.handout-frame').count(), 1, name + ' 독립 테두리');
  assert.equal(await card.locator('.handout-frame svg').count(), 0, name + ' 불필요한 테두리 선 장식 제거');
  const surface = await card.evaluate(el => {
    const frame = el.querySelector('.handout-frame'), copy = el.querySelector('.handout-copy');
    const face = el.getBoundingClientRect(), text = copy.getBoundingClientRect();
    return { frameColor: getComputedStyle(frame).borderTopColor, copyColor: getComputedStyle(copy).backgroundColor, left: text.left - face.left, right: face.right - text.right, bottom: face.bottom - text.bottom };
  });
  assert.equal(surface.frameColor, surface.copyColor, name + ' 테두리와 설명판 동일 색');
  assert.ok(Math.abs(surface.left) < 2 && Math.abs(surface.right) < 2 && Math.abs(surface.bottom) < 2, name + ' 설명판이 카드 가장자리에 붙음');
  assert.equal(await card.locator('.handout-art-layer').count(), 4, name + ' 카드 전체 바탕·배경·주제 장면·전경');
  const artwork = await card.locator('.handout-art').boundingBox();
  const face = await card.boundingBox();
  assert.ok(Math.abs(artwork.height - face.height) < 2, name + ' 카드 전체를 채우는 벡터 그림');
  await slot.scrollIntoViewIfNeeded();
  // 등장 애니메이션이 끝난 뒤 고정된 슬롯을 기준으로 포인터 좌표를 잡습니다.
  await slot.evaluate(el => Promise.all(el.getAnimations().map(a => a.finished.catch(() => {}))));
  const bounds = await slot.boundingBox();
  await page.mouse.move(bounds.x + bounds.width * .8, bounds.y + bounds.height * .3);
  await page.waitForFunction(selector => {
    const style = document.querySelector(selector + ' .taste-card').style;
    return Number(style.getPropertyValue('--parallax-depth')) > .99 && Number(style.getPropertyValue('--parallax-x')) > .4;
  }, selector);
  const layers = await card.evaluate(el => ['.handout-frame', '.handout-art-orbit', '.handout-art-0', '.handout-art-1', '.handout-art-2'].map(selector => {
    const matrix = new DOMMatrix(getComputedStyle(el.querySelector(selector)).transform);
    return { x: matrix.m41, z: matrix.m43 };
  }));
  assert.ok(layers[2].x < layers[3].x && layers[3].x < layers[4].x, name + ' 안쪽 풍경의 큰 패럴랙스 이동');
  assert.ok(layers[1].z < layers[2].z && layers[2].z < layers[3].z && layers[3].z < layers[4].z && layers[4].z < layers[0].z, name + ' 테두리가 가장 앞, 중앙 풍경은 안쪽');
  await page.mouse.move(bounds.x + bounds.width * .2, bounds.y + bounds.height * .7);
  await page.waitForFunction(selector => Number(document.querySelector(selector + ' .taste-card').style.getPropertyValue('--parallax-x')) < -.4, selector);
  await page.mouse.move(0, 0);
  await page.waitForFunction(selector => !document.querySelector(selector + ' .taste-card').style.transform, selector);
  await card.focus();
  await page.waitForFunction(selector => Number(document.querySelector(selector + ' .taste-card').style.getPropertyValue('--parallax-depth')) > .99, selector);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  assert.equal(await card.evaluate(el => getComputedStyle(el).transform), 'none', name + ' 모션 감소');
  assert.equal(await card.locator('.handout-art-2').evaluate(el => getComputedStyle(el).transform), 'none', name + ' 레이어 모션 감소');
  await card.evaluate(el => el.blur());
  await page.emulateMedia({ reducedMotion: 'no-preference' });
}
async function accessibility(page, name) {
  if (!AxeBuilder) return;
  // 스크롤로 등장하는 비교 내용은 각 영역을 실제로 열고 최종 상태를 검사합니다.
  for (const section of await page.locator('#comparison-output:not([hidden]) #party-panel:not([hidden]) .scroll-reveal-pending').elementHandles()) {
    await section.scrollIntoViewIfNeeded();
    await section.evaluate(element => element.dispatchEvent(new Event('scroll', { bubbles: true })));
  }
  // 등장 중의 투명도가 아니라 읽을 수 있는 최종 상태의 대비를 검사합니다.
  await page.evaluate(() => Promise.all(document.getAnimations()
    .filter(animation => animation.effect?.getTiming().iterations !== Infinity)
    .map(animation => animation.finished.catch(() => {}))));
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
    await noPageOverflow(page);
    await page.locator('.question-card').evaluate(el => Promise.all(el.getAnimations().map(animation => animation.finished)));
    await page.screenshot({ path: path.join(artifacts, 'test-desktop.png') });
    await page.locator('#question-role .choice input').first().focus();
    await page.keyboard.press('ArrowDown');
    assert.equal(await page.locator('#question-role .choice input').nth(1).isChecked(), true);
    assert.equal(await page.locator('.question-card').count(), 2);
    await page.waitForFunction(() => window.scrollY > 0);
    await page.locator('#question-role .choice').first().click();
    assert.equal(await page.locator('.question-card').count(), 2, '이전 답변 수정은 다음 문항을 추가하지 않음');
    await accessibility(page, '테스트');
    await page.reload();
    assert.equal(await page.locator('#question-role .choice input').first().isChecked(), true);
    assert.equal(await page.locator('.question-card').count(), 2);
    await page.locator('#question-maxHours .choice').first().click();
    assert.equal(await page.locator('.question-card').count(), 3);
    const questionIds = await page.evaluate(() => TRPGData.questions.map(q => q.id));
    for (let i = 2; i < questionIds.length; i++) {
      const card = page.locator('#question-' + questionIds[i]);
      if (questionIds[i] === 'D1') {
        assert.equal(await card.locator('.choice-example').count(), 0);
        assert.deepEqual(await card.locator('.choice > span').allTextContents(), ['단문 (1~2줄)', '중문 (3~4줄)', '장문 (5줄 이상)']);
      }
      if (questionIds[i] === 'C02') {
        assert.equal(await card.locator('.possible-all').count(), 0);
        assert.equal(await card.locator('[data-row="character"] option[value="ok"]').count(), 0);
      }
      if (questionIds[i] === 'T1') assert.equal(await card.locator('.choice').count(), 5);
      const rows = card.locator('[data-row]');
      if (questionIds[i] === 'O04') {
        await card.locator('.possible-all').click();
        assert.equal(await card.locator('[data-row="notes"]').inputValue(), 'responsive');
      } else if (questionIds[i] === 'O07') {
        assert.deepEqual(await card.locator('.matrix-actions button').allTextContents(), ['모두 사전확인', '모두 가능', '모두 불가능']);
        await card.locator('.impossible-all').click();
        assert.equal(await card.locator('[data-row="friends"]').inputValue(), 'no');
      } else if (questionIds[i] === 'B02') {
        await card.locator('.talk-all').click();
        assert.equal(await card.locator('[data-row="violence"]').inputValue(), 'ask');
      } else if (questionIds[i] === 'P04') {
        await card.locator('.suggestion-chip').first().click();
        assert.equal(await card.locator('.suggestion-chip').first().getAttribute('aria-pressed'), 'true');
        await card.locator('[data-text-answer]').fill('조용한 사담방\n피하고 싶은 요소');
        await card.locator('.text-next').click();
      } else if (await rows.count()) {
        for (let j = 0; j < await rows.count(); j++) await rows.nth(j).selectOption({ index: 1 });
        if (await card.locator('[data-row="pvp"]').count()) await card.locator('[data-row="pvp"]').selectOption('no');
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
    await page.locator('#question-O12 input[value="2"]').check();
    assert.equal(await page.locator('#finish-test').isDisabled(), true);
    assert.equal(await page.locator('.question-card').count(), questionIds.length);
    await page.locator('#field-O12-minimum').fill('3');
    await page.locator('#field-O12-minimum').blur();
    assert.equal(await page.locator('#finish-test').isEnabled(), true);
    await page.locator('#finish-test').click();
    await page.waitForURL('**/result.html');
    assert.equal(await page.locator('#profile-reading, #answer-notes, #operation-notes, #talk-prompts').count(), 0);
    assert.ok(await page.locator('#radar-summary').textContent());
    assert.equal(await page.locator('#radar-axis-labels button').count(), 6);
    assert.equal(await page.locator('#profile-copy').evaluate(el => getComputedStyle(el).whiteSpace), 'pre-line');
    assert.equal((await page.locator('#profile-copy').textContent()).split('\n').length, 2);
    assert.equal(await page.evaluate(() => document.querySelector('#radar')._sets[0].minRadius), .25);
    assert.deepEqual(await page.evaluate(() => document.querySelector('#radar')._sets[0].data), await page.evaluate(() => TRPGCompare.comparisonRadar(JSON.parse(localStorage.getItem(TRPGApp.STORAGE)))));
    await page.locator('#radar-axis-labels button').first().focus();
    assert.equal(await page.locator('#radar-axis-labels button').first().locator('.radar-axis-tooltip').isVisible(), true);
    await noPageOverflow(page);
    await accessibility(page, '결과');
    await page.screenshot({ path: path.join(artifacts, 'result-desktop.png') });
    await cardParallax(page, '#taste-cards', '내 결과');
    assert.equal(await page.locator('#share-boundaries, #share-notes').count(), 0);
    const preview = JSON.parse(await page.locator('#export-preview').inputValue());
    assert.equal(preview.schemaVersion, '3.0');
    assert.ok(preview.responses.B01);
    assert.equal(preview.responses.B01.value.pvp, 'no');
    const downloadEvent = page.waitForEvent('download');
    await page.locator('#download').click();
    const download = await downloadEvent;
    await download.saveAs(path.join(artifacts, 'export-check.json'));
    const exported = JSON.parse(fs.readFileSync(path.join(artifacts, 'export-check.json'), 'utf8'));
    assert.equal(exported.responses.B01.value.pvp, 'no');
    const profile = await page.evaluate(() => JSON.parse(localStorage.getItem('trpg-playstyle-profile')));
    await page.goto(base + '/compare.html');
    await accessibility(page, '비교 빈 화면');
    await page.locator('.paste-disclosure summary').focus();
    await page.keyboard.press('Enter');
    await page.locator('#json-input').fill('{invalid'); await page.locator('#add-json').click();
    await page.getByText('JSON 형식을 읽지 못했어요.', { exact: false }).waitFor();
    await page.locator('#json-input').fill(JSON.stringify(profile)); await page.locator('#add-json').click();
    assert.equal(await page.locator('.compare-radar-section').getAttribute('data-reveal-state'), 'waiting', '불러오기만으로 결과 연출을 시작하지 않음');
    assert.equal(await page.locator('.party-conversation').getAttribute('data-reveal-state'), 'waiting');
    await page.locator('.compare-radar-section').scrollIntoViewIfNeeded();
    await page.waitForFunction(() => document.querySelector('.compare-radar-section').dataset.revealState === 'revealed');
    assert.equal(await page.locator('.party-conversation').getAttribute('data-reveal-state'), 'waiting', '아직 내려가지 않은 다음 영역은 대기');
    assert.equal(await page.locator('#participant-count').textContent(), '1');
    assert.ok(await page.locator('#group-tables').getByRole('rowheader', { name: 'GM 역할' }).count());
    assert.ok(await page.locator('#group-tables').getByRole('rowheader', { name: 'PL 역할' }).count());
    assert.equal(await page.locator('#group-tables').getByRole('heading', { name: '타이핑 시간', exact: true }).count(), 1);
    assert.equal(await page.locator('#group-tables').getByRole('heading', { name: 'RP 템포', exact: true }).count(), 1);
    assert.equal(await page.locator('#radar-axis-labels button').count(), 6);
    assert.equal(await page.locator('#radar-axis-guide').count(), 0);
    assert.equal(await page.locator('.rp-distribution').count(), 6);
    assert.equal(await page.locator('.rp-group table').count(), 0);
    assert.equal(await page.locator('#radar-overlap-value').textContent(), '—');
    await page.locator('.distribution-person').first().focus();
    assert.ok(await page.locator('.distribution-tooltip').first().isVisible());
    assert.match(await page.locator('#radar-axis-labels button').first().getAttribute('aria-label'), /천천히 정리 → 바로 이어가기/);
    assert.match(await page.locator('#radar-data-summary').textContent(), /타이핑 시간/);
    for (let i = 1; i <= 7; i++) {
      const generated = await page.evaluate(fixtureInBrowser, { name: '참가자 ' + (i + 1), value: i % 5 * 25, boundary: i === 1 ? 'no' : 'ask', role: i <= 2 ? 'GM' : 'PL' });
      await page.locator('#json-input').fill(JSON.stringify(generated)); await page.locator('#add-json').click();
      if (i === 1) {
        assert.equal(await page.locator('#participant-count').textContent(), '2');
        assert.match(await page.locator('#radar-overlap-value').textContent(), /^\d+%$/);
        assert.equal(await page.locator('#alignment-section').count(), 0);
        assert.equal(await page.locator('.boundary-subgroup').count(), 5);
        assert.equal(await page.locator('.boundary-subgroup').nth(3).locator('h4').textContent(), '캐릭터 권한과 경계');
        assert.equal(await page.locator('.boundary-subgroup').nth(3).locator('tbody th').first().textContent(), 'PC 간 말다툼');
        assert.equal(await page.locator('#group-tables').getByRole('rowheader', { name: 'PC 간 말다툼' }).count(), 1);
        assert.ok((await page.locator('#group-tables').textContent()).includes('포함하지 마세요'));
        assert.equal(await page.locator('#group-story').count(), 0);
        assert.ok(await page.locator('.different-answer').count() > 0);
        assert.equal(await page.locator('.preparation-table tbody tr').count(), 4);
        assert.equal(await page.locator('.preparation-table tbody tr').first().locator('.preparation-primary').textContent(), '없어도 됨');
        assert.match(await page.locator('.preparation-table tbody tr').first().locator('.preparation-popover').textContent(), /최소 필요/);
        await page.locator('.preparation-table tbody tr').first().hover();
        assert.equal(await page.locator('.preparation-popover').first().isVisible(), true);
        const breakRow = page.locator('#group-tables tr.combined-row').filter({ hasText: '휴식 주기' });
        await breakRow.locator('.group-answer').hover();
        assert.match(await breakRow.locator('.answer-popover').textContent(), /휴식 간격:.*휴식 길이:/);
        assert.match(await breakRow.locator('.answer-popover').textContent(), /참가자 2/);
        await page.locator('.group-answer').first().hover();
        assert.equal(await page.locator('.answer-popover').first().isVisible(), true);
        assert.match(await page.locator('.answer-popover').first().textContent(), /참가자 2/);
        await page.locator('.group-answer').first().focus();
        assert.equal(await page.locator('.answer-popover').first().isVisible(), true);
      }
      if (i === 2) {
        assert.equal(await page.locator('.preparation-table tbody tr').first().locator('.preparation-primary').textContent(), '없어도 됨');
        assert.match(await page.locator('.preparation-table tbody tr').last().locator('.preparation-source').textContent(), /참가자 선호/);
      }
    }
    assert.equal(await page.locator('#participant-count').textContent(), '8');
    assert.equal(await page.getByRole('tab').count(), 9);
    assert.equal(await page.getByRole('tab').first().textContent(), '전체');
    assert.equal(await page.locator('.preparation-status').count(), 0);
    assert.ok(await page.locator('.party-common').isVisible());
    const storedBeforeTabs = await page.evaluate(() => localStorage.getItem('trpg-playstyle-profile'));
    await page.getByRole('tab').nth(1).focus();
    await page.keyboard.press('ArrowRight');
    assert.equal(await page.locator('#party-panel').isVisible(), false);
    assert.equal(await page.locator('#personal-profile-title').textContent(), '참가자 2의 플레이 성향');
    assert.equal(await page.locator('#personal-radar-axis-labels button').count(), 6);
    assert.ok(await page.locator('#personal-taste-cards .taste-card').count() > 0);
    assert.equal(await page.locator('#personal-panel .profile-overview > .result-intro + .radar-card').count(), 1, '내 결과와 같은 소개·레이더 배치');
    assert.equal(await page.locator('#personal-taste-cards .handout-slot .handout-art').count(), await page.locator('#personal-taste-cards .taste-card').count(), '내 결과와 같은 핸드아웃 카드');
    await cardParallax(page, '#personal-taste-cards', '개인 탭');
    await page.locator('#personal-display-name').fill('개인 탭 내보내기');
    assert.equal(JSON.parse(await page.locator('#personal-export-preview').inputValue()).displayName, '개인 탭 내보내기');
    const personalDownloadEvent = page.waitForEvent('download');
    await page.locator('#personal-download').click();
    await personalDownloadEvent;
    assert.equal(await page.evaluate(() => localStorage.getItem('trpg-playstyle-profile')), storedBeforeTabs, '참가자 JSON 저장은 내 결과를 덮어쓰지 않음');
    await accessibility(page, '개인 탭');
    await noPageOverflow(page);
    await page.getByRole('tab', { selected: true }).focus();
    await page.keyboard.press('Home');
    assert.equal(await page.locator('#party-panel').isVisible(), true);
    assert.equal(await page.evaluate(() => localStorage.getItem('trpg-playstyle-profile')), storedBeforeTabs);

    assert.equal(await page.locator('.preparation-table tbody tr').count(), 4);
    assert.equal(await page.locator('.preparation-table thead').textContent(), '항목기준 응답');
    assert.equal(await page.locator('.preparation-table tbody button').count(), 0);
    await page.locator('.preparation-table tbody tr').first().focus();
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('.preparation-table tbody tr').first().getAttribute('class'), 'preparation-row is-open');
    assert.equal(await page.locator('.preparation-popover').first().isVisible(), true);
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('.preparation-table tbody tr').first().getAttribute('class'), 'preparation-row');
    assert.equal(await page.locator('[data-person]:checked').count(), 6);
    assert.equal(await page.locator('#axis-distributions').count(), 0);
    assert.equal(await page.locator('.count-chip').count(), 0);
    assert.ok(await page.locator('.group-answer').count() > 0);
    await accessibility(page, '다수 비교');
    assert.equal(await page.locator('.compare-radar-section').evaluate(el => el.compareDocumentPosition(document.querySelector('.combined-row')) & Node.DOCUMENT_POSITION_FOLLOWING), 4);
    await page.locator('[data-person]').nth(6).click();
    assert.equal(await page.locator('[data-person]:checked').count(), 6);
    assert.equal(await page.locator('#radar-data-summary summary').count(), 0);
    assert.equal(await page.locator('#radar-points, .radar-point-target, .radar-point-tooltip').count(), 0);
    assert.match(await page.locator('#radar-data-summary').textContent(), /RP 템포/);
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
    await page.getByRole('tab').nth(1).click();
    await noPageOverflow(page);
    await accessibility(page, '모바일 개인 탭');
    await page.screenshot({ path: path.join(artifacts, 'personal-mobile.png') });
    await page.getByRole('tab').first().click();
    await page.goto(base + '/index.html');
    await noPageOverflow(page);
    await page.screenshot({ path: path.join(artifacts, 'landing-mobile.png') });
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.screenshot({ path: path.join(artifacts, 'landing-desktop.png') });
    await page.setViewportSize({ width: 390, height: 844 });

    await page.goto(base + '/result.html'); await noPageOverflow(page);
    await accessibility(page, '모바일 결과');
    await page.screenshot({ path: path.join(artifacts, 'result-mobile.png') });
    await page.goto(base + '/test.html?edit=1');
    assert.equal(await page.locator('.question-card').count(), questionIds.length);
    await page.locator('#question-role .choice').nth(1).click();
    assert.equal(await page.locator('#field-A01-offered').count(), 1, '역할 수정 시 GM 추가 입력도 갱신');
    await page.locator('#question-role').scrollIntoViewIfNeeded();
    assert.equal(await page.locator('#question-role .choice input').nth(1).isChecked(), true);
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
    await page.locator('#question-role .choice').first().click();
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
