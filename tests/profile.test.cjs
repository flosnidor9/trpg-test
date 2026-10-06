const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const context = vm.createContext({});
for (const file of ['questionnaire.js', 'narratives.js', 'app.js', 'comparison.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), context, { filename: file });
}
const A = context.TRPGApp, D = context.TRPGData, C = context.TRPGCompare;
test('선택한 레이더의 공통 면적은 합집합 대비 비율로 계산한다', () => {
  const radar = value => Object.fromEntries(D.axes.map(axis => [axis.key, value]));
  assert.equal(C.radarOverlap([radar(75), radar(75)]), 100);
  assert.equal(C.radarOverlap([radar(50), radar(100)]), 25);
  assert.equal(C.radarOverlap([radar(50), radar(75), radar(100)]), 25);
  assert.equal(C.radarOverlap([radar(0), radar(0)]), null);
  assert.equal(C.radarOverlap([radar(50), { ...radar(50), [D.axes[0].key]: null }]), null);
  assert.equal(C.radarOverlap([radar(50)]), null);
});
function fixture(value = 75, boundary = 'ask') {
  const responses = {};
  for (const q of D.questions) {
    responses[q.id] = { value: q.type === 'trait' ? value : q.type === 'matrix' ? Object.fromEntries(q.rows.map(([id]) => [id, q.boundary ? boundary : q.options[0][0]])) : q.options[0][0] };
    if (q.fields) responses[q.id].fields = Object.fromEntries(q.fields.filter(f => !f.when || f.when === responses[q.id].value).map(f => [f.key, f.type === 'select' ? f.options[0][0] : f.type === 'number' ? '3' : '메모']));
  }
  return A.makeProfile(responses, '테스트 참가자');
}

test('42개 문항 묶음: 맥락 6, RP 12, 운영 22, 경계 2', () => {
  assert.equal(D.questions.length, 42);
  assert.equal(D.operation.length, 22);
  assert.equal(new Set(D.questions.map(q => q.id)).size, 42);
  D.axes.forEach(a => assert.equal(D.traits.filter(q => q.axis === a.key).length, 2));
});

test('미응답을 50으로 채우지 않고 조건부 응답도 점수에서 제외', () => {
  const p = A.makeProfile({ T1: { value: 'conditional', note: '중요한 장면에서는 천천히' }, T2: { value: 'unknown' } });
  assert.equal(p.radar.tempo, null);
  assert.equal(p.dimensions.tempo.conditional, 1);
  assert.match(A.axisStory(p, 'tempo').text, /상황에 따라/);
  assert.equal(p.radar.detail, null);
});

test('상반된 응답의 중간 평균을 유연함으로 해석하지 않음', () => {
  const p = fixture(); p.responses.T1.value = 0; p.responses.T2.value = 100;
  const computed = A.makeProfile(p.responses);
  assert.equal(computed.radar.tempo, 50);
  assert.equal(A.dimensionLabel(computed, 'tempo'), '문항별 선호가 다름');
  assert.match(A.axisStory(computed, 'tempo').text, /평균 위치만으로/);
});

test('가져온 레이더는 재계산하고 잘못된 값·버전·인원을 거부', () => {
  const p = fixture(); p.radar.tempo = 0;
  assert.equal(A.validateProfile(p).radar.tempo, 75);
  assert.throws(() => A.validateProfile({ ...p, schemaVersion: '2.0' }), /이전 설계/);
  assert.throws(() => A.validateProfile({ ...p, radar: { ...p.radar, tempo: Infinity } }), /유한한/);
  assert.throws(() => A.validateProfile({ ...p, responses: { ...p.responses, T1: { value: '100' } } }), /선택지/);
  assert.throws(() => A.validateProfile({ ...p, responses: { ...p.responses, O12: { value: '2', fields: { minimum: '-1' } } } }), /인원/);
});

test('비공개 경계는 항상 제외하고 자유 입력·개인 일정은 기본 제외', () => {
  const p = fixture(); p.responses.B01.value.pvp = 'private'; p.responses.B01.note = '비공개 상세';
  p.responses.O01.note = '개인 메모'; p.responses.maxHours.fields = { availability: '개인 일정' };
  const basic = A.exportProfile(p);
  assert.equal(basic.responses.B01, undefined);
  assert.equal(basic.responses.O01.note, undefined);
  assert.equal(basic.responses.maxHours.fields.availability, undefined);
  const shared = A.exportProfile(p, { boundaries: true, notes: true });
  assert.equal(shared.responses.B01.value.pvp, undefined);
  assert.equal(shared.responses.B01.note, undefined);
  assert.equal(shared.responses.O01.note, '개인 메모');
  assert.equal(A.validateProfile(shared).schemaVersion, '3.0');
});

test('모두 같은 포함 제외·사전 확인 응답도 경계와 대화 대상으로 유지', () => {
  const no = C.groupAnalysis([fixture(0, 'no'), fixture(100, 'no')]);
  assert.equal(no.restrictions.length, 15);
  const ask = C.groupAnalysis([fixture(50, 'ask'), fixture(50, 'ask')]);
  assert.equal(ask.pending.filter(c => c.title.includes('사전 대화')).length, 15);
  const missing = C.groupAnalysis([A.exportProfile(fixture()), A.exportProfile(fixture())]);
  assert.equal(missing.pending.filter(c => c.title.includes('미확인')).length, 15);
});

test('휴식의 필요한 상한을 평균으로 상쇄하지 않음', () => {
  const first = fixture(), second = fixture();
  first.responses.O01 = { value: '60', fields: { need: 'need' } };
  second.responses.O01 = { value: '120', fields: { need: 'prefer' } };
  first.responses.O02.value = '10'; second.responses.O02.value = '5';
  const card = C.groupAnalysis([first, second]).suggestions.find(c => c.title === '휴식 주기 확인');
  assert.match(card.text, /60분마다 10분/);
  assert.match(card.text, /평균 간격으로 덮지/);
});

test('한 명과 많은 참가자의 해설 생성, 텍스트 삽입 이스케이프', () => {
  assert.match(C.groupAnalysis([fixture()]).paragraphs[0], /한 명/);
  const many = Array.from({ length: 30 }, (_, i) => fixture(i % 5 * 25));
  assert.ok(C.groupAnalysis(many).paragraphs.length > 0);
  assert.equal(A.escape('<img src=x onerror=alert(1)>'), '&lt;img src=x onerror=alert(1)&gt;');
  assert.equal(A.overview(fixture()).length, 3);
  D.operation.forEach(q => assert.ok(A.operationStory(fixture(), q).length > 50));
});

test('상위 답을 바꾼 뒤 적용되지 않는 추가 조건은 버림', () => {
  const p = fixture();
  p.responses.O12 = { value: '0', fields: { minimum: '3' } };
  assert.equal(A.validateProfile(p).responses.O12.fields.minimum, undefined);
});
