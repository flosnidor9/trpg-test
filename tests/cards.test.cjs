const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const context = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'cards.js'), 'utf8'), context);
const { cards, rankCards, featuredCards } = context.TRPGCards;

test('32개 카드는 응답이 없으면 배정되지 않는다', () => {
  assert.equal(cards.length, 32);
  assert.equal(rankCards({}).length, 0);
  assert.equal(featuredCards({}).length, 0);
});

test('사담과 휴식 응답은 RP 카드보다 앞에 올 수 있다', () => {
  const result = featuredCards({ O05: { value: '2' }, O01: { value: '120' }, T1: { value: 75 } });
  assert.deepEqual(Array.from(result, card => card.id), ['campfire-chat', 'frequent-break', 'rapid-talk']);
});

test('서로 반대인 선호와 경계 응답을 같은 카드로 읽지 않는다', () => {
  const result = rankCards({ A02: { value: '0' }, B01: { value: { pvp: 'ok' } } });
  assert.deepEqual(Array.from(result, card => card.id), ['quiet-scene']);
});

test('대표 카드는 한 영역에 몰리지 않게 고른다', () => {
  const responses = {
    T1: { value: 100 }, D1: { value: 100 }, S1: { value: 100 }, I1: { value: 100 }, M1: { value: 100 },
    O05: { value: '2' }, O01: { value: '120' }, A02: { value: '4' }, O13: { value: 'fixed' }
  };
  const result = featuredCards(responses);
  assert.equal(result.length, 5);
  assert.equal(result[0].id, 'rapid-talk');
  assert.ok(new Set(Array.from(result, card => card.category)).size >= 3);
});
