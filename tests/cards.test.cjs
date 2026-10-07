const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const context = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'cards.js'), 'utf8'), context);
const { cards, rankCards, featuredCards } = context.TRPGCards;
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'handout-art.js'), 'utf8'), context);

test('모든 취향 카드가 서로 다른 전면 벡터 장면을 가진다', () => {
  const { scenes, render } = context.TRPGHandoutArt;
  assert.deepEqual(Object.keys(scenes).sort(), Array.from(cards, card => card.id).sort());
  assert.equal(new Set(Object.values(scenes).map(scene => scene.back + scene.middle + scene.front)).size, cards.length);
  cards.forEach(card => {
    const art = render(card.id);
    assert.equal((art.match(/viewBox="0 0 310 620"/g) || []).length, 4);
    assert.ok(art.includes('data-art="' + card.id + '"'));
  });
});

test('응답이 없거나 하나의 문항만 맞으면 카드를 배정하지 않는다', () => {
  assert.equal(rankCards({}).length, 0);
  assert.equal(featuredCards({ T1: { value: 100 } }).length, 0);
});

test('빠른 응답과 장면 시작 선호를 하나의 취향 카드로 묶는다', () => {
  const result = rankCards({ T1: { value: 100 }, I1: { value: 75 } });
  assert.deepEqual(Array.from(result, card => card.id), ['live-exchange']);
  assert.equal(result[0].matchCount, 2);
  assert.match(result[0].evidence, /RP 템포 · RP 시작/);
  assert.match(result[0].description, /빠른 반응/);
  assert.match(result[0].description, /상호작용/);
});

test('연관 응답이 많이 모인 카드가 두 응답으로 만든 카드보다 먼저 나온다', () => {
  const result = featuredCards({
    T1: { value: 100 }, I1: { value: 100 }, M1: { value: 100 },
    O05: { value: '2' }, C02: { value: { character: '2' } }
  });
  assert.deepEqual(Array.from(result, card => card.id), ['live-exchange', 'social-table']);
  assert.ok(result[0].strength > result[1].strength);
});

test('반대 방향과 경계 응답은 묶음 근거로 사용하지 않는다', () => {
  const result = rankCards({ T1: { value: 100 }, I1: { value: 0 }, B01: { value: { pvp: 'ok' } } });
  assert.equal(result.length, 0);
  const quiet = rankCards({ A02: { value: '0' }, D1: { value: 100 } });
  assert.deepEqual(Array.from(quiet, card => card.id), ['quiet-roleplay']);
});

test('관측된 선호만 카드 설명에 포함하고 최대 다섯 장을 선택한다', () => {
  const responses = {
    T1: { value: 100 }, D1: { value: 100 }, S1: { value: 100 }, I1: { value: 100 }, M1: { value: 100 },
    O05: { value: '2' }, C02: { value: { character: '3', player: '3' } },
    O01: { value: '480' }, O03: { value: '0' }, A01: { value: '3' }, A02: { value: '4' }, A03: { value: '3' }
  };
  const result = featuredCards(responses);
  assert.equal(result.length, 5);
  assert.ok(result.every(card => card.matchCount >= 2));
  assert.ok(result.every((card, index) => !index || result[index - 1].strength >= card.strength));
  assert.doesNotMatch(result.find(card => card.id === 'cinematic-table').description, /포트레이트/);
});
