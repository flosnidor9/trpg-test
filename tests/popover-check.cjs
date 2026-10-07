const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require(process.env.TRPG_PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
const server = http.createServer((req, res) => {
  const file = path.resolve(root, '.' + new URL(req.url, 'http://localhost').pathname);
  if (!file.startsWith(root + path.sep)) return res.writeHead(403).end();
  try {
    res.setHeader('Content-Type', file.endsWith('.css') ? 'text/css' : file.endsWith('.js') ? 'application/javascript' : 'text/html');
    res.end(fs.readFileSync(file));
  } catch { res.writeHead(404).end(); }
});
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  const browser = await chromium.launch({ executablePath: process.env.TRPG_BROWSER || (fs.existsSync(chrome) ? chrome : undefined) });
  try {
    for (const viewport of [{ width: 1200, height: 800 }, { width: 390, height: 500 }]) {
      const page = await browser.newPage({ viewport, reducedMotion: 'reduce' });
      await page.goto(`http://127.0.0.1:${server.address().port}/compare.html`);
      const profiles = await page.evaluate(() => Array.from({ length: 8 }, (_, i) => {
        const responses = {};
        TRPGData.questions.forEach(q => {
          responses[q.id] = { value: q.type === 'matrix' ? Object.fromEntries(q.rows.map(([id]) => [id, q.options[0][0]])) : q.type === 'text' ? '' : q.options[0][0] };
        });
        return TRPGApp.makeProfile(responses, '참가자 ' + (i + 1));
      }));
      await page.locator('.paste-disclosure summary').click();
      for (const profile of profiles) {
        await page.locator('#json-input').fill(JSON.stringify(profile));
        await page.locator('#add-json').click();
      }
      for (const [triggerSelector, popupSelector] of [['.group-answer', '.answer-popover'], ['.preparation-row', '.preparation-popover']]) {
        const trigger = page.locator(triggerSelector).last();
        await trigger.scrollIntoViewIfNeeded();
        await trigger.evaluate(el => scrollTo(0, scrollY + el.getBoundingClientRect().bottom - innerHeight + 24));
        await page.waitForTimeout(100);
        const before = await page.evaluate(() => ({ height: document.documentElement.scrollHeight, y: scrollY }));
        await trigger.hover();
        const popup = trigger.locator(popupSelector);
        await popup.waitFor({ state: 'visible' });
        const bounds = await popup.boundingBox();
        const anchor = await trigger.boundingBox();
        assert.ok(bounds.y >= 7 && bounds.y + bounds.height <= viewport.height - 7, '팝업 세로 범위');
        assert.ok(bounds.x >= 7 && bounds.x + bounds.width <= viewport.width - 7, '팝업 가로 범위');
        assert.ok(bounds.y < anchor.y, '화면 아래쪽 팝업은 위로 열림');
        assert.equal(await popup.evaluate(el => el.scrollHeight > el.clientHeight), true, '많은 참가자는 팝업 내부 스크롤');
        for (let i = 0; i < 5; i++) {
          await page.waitForTimeout(60);
          const after = await page.evaluate(() => ({ height: document.documentElement.scrollHeight, y: scrollY }));
          assert.deepEqual(after, before, '팝업 표시가 페이지 높이와 스크롤을 바꾸지 않음');
          assert.equal(await popup.isVisible(), true, '팝업 깜빡임 없음');
        }
        await page.mouse.move(1, 1);
        await page.keyboard.press('Tab');
        await trigger.focus();
        assert.equal(await popup.isVisible(), true, '키보드 포커스 팝업');
        const focused = await popup.boundingBox();
        assert.ok(focused.y >= 7 && focused.y + focused.height <= viewport.height - 7);
        await trigger.evaluate(el => el.blur());
      }
      console.log(`${viewport.width}px: 팝업 범위·위쪽 배치·내부 스크롤·페이지 안정성·키보드 확인 통과`);
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => server.close());
