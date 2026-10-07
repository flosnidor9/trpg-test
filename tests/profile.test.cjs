const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const context = vm.createContext({});
for (const file of ['questionnaire.js', 'narratives.js', 'cards.js', 'app.js', 'comparison.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), context, { filename: file });
}
const A = context.TRPGApp, D = context.TRPGData, C = context.TRPGCompare;
const questionSimilarity = (profiles, id) => C.playstyleSimilarity(profiles).questions.find(q => q.id === id).score;
const areaSimilarity = (profiles, id) => C.playstyleSimilarity(profiles).areas.find(area => area.id === id);
test('완료한 전체 응답을 8개 고정 영역으로 비교한다', () => {
  const profiles = [fixture(), fixture()];
  const result = C.playstyleSimilarity(profiles);
  assert.equal(result.score, 100);
  assert.equal(result.scoreRange, null);
  assert.equal(result.areas.length, 8);
  assert.ok(result.areas.every(area => area.weight === 1 / 8 && area.coverage === 1));
  assert.equal(result.questions.length, 35, '역할은 배정 정보로 유지하고 불호 태그를 포함');
  assert.equal(result.totalCount, 66);
  assert.equal(result.comparedCount, 66);
  assert.equal(C.similarityValue(result), '100%');
});
test('범주형 점수는 응답 비율이 같으면 인원수와 순서에 영향을 받지 않는다', () => {
  const profiles = [fixture(), fixture(), fixture()];
  profiles[2].responses.P01.value = 'roll20';
  const first = C.playstyleSimilarity(profiles), repeated = C.playstyleSimilarity([...profiles, ...profiles]);
  assert.equal(first.score, repeated.score);
  assert.equal(questionSimilarity(profiles, 'P01'), questionSimilarity([...profiles, ...profiles], 'P01'));
  assert.equal(first.score, C.playstyleSimilarity([...profiles].reverse()).score);
});
test('범주형 집중도는 가장 큰 집단 이외의 응답 분포도 반영한다', () => {
  const two = Array.from({ length: 6 }, () => fixture()), three = Array.from({ length: 6 }, () => fixture());
  ['0', '0', '0', '1', '1', '1'].forEach((value, i) => two[i].responses.O08.value = value);
  ['0', '0', '0', '1', '1', '2'].forEach((value, i) => three[i].responses.O08.value = value);
  assert.ok(questionSimilarity(three, 'O08') < questionSimilarity(two, 'O08'));
  assert.ok(C.playstyleSimilarity(three).score <= C.playstyleSimilarity(two).score);
});
test('고정 범주는 균등 분포가 0이고 같은 응답이 100이다', () => {
  const profiles = Array.from({ length: 4 }, () => fixture());
  profiles.forEach((profile, i) => profile.responses.O08.value = String(i));
  assert.equal(questionSimilarity(profiles, 'O08'), 0);
  profiles.forEach(profile => profile.responses.O08.value = '2');
  assert.equal(questionSimilarity(profiles, 'O08'), 100);
});
test('명시한 수치·순서 척도는 평균 절대편차로 양 끝을 대칭적으로 비교한다', () => {
  const low = fixture(), mid = fixture(), high = fixture();
  low.responses.T1.value = 0; mid.responses.T1.value = 50; high.responses.T1.value = 100;
  assert.equal(questionSimilarity([low, high], 'T1'), 0);
  assert.equal(questionSimilarity([low, mid], 'T1'), 50);
  assert.equal(questionSimilarity([high, mid], 'T1'), 50);
  assert.equal(Math.round(questionSimilarity([low, low, high], 'T1')), 11);
  assert.equal(questionSimilarity([low, low, high, high], 'T1'), 0);
  assert.equal(questionSimilarity([low, low, low, high], 'T1'), 25);
  assert.equal(questionSimilarity([low, high], 'T1'), questionSimilarity([low, high, low, high], 'T1'));
});
test('선택지 저장 번호를 임의의 수치 척도로 해석하지 않는다', () => {
  const first = fixture(), second = fixture();
  first.responses.A04.value = '0'; second.responses.A04.value = '1';
  assert.equal(questionSimilarity([first, second], 'A04'), questionSimilarity([first, { ...second, responses: { ...second.responses, A04: { value: '3' } } }], 'A04'));
  first.responses.maxHours.value = second.responses.maxHours.value = 'flexible';
  assert.equal(questionSimilarity([first, second], 'maxHours'), 100);
});
test('시간·플랫폼·경계 차이가 전체 점수와 각 영역에 반영된다', () => {
  const first = fixture(), second = fixture();
  second.responses.O02.value = '20'; second.responses.P01.value = 'roll20'; second.responses.B01.value.pvp = 'no';
  const result = C.playstyleSimilarity([first, second]);
  assert.ok(result.score < 100);
  assert.ok(areaSimilarity([first, second], 'participation').score < 100);
  assert.ok(areaSimilarity([first, second], 'platform').score < 100);
  assert.ok(areaSimilarity([first, second], 'boundary').score < 100);
  assert.equal(C.groupAnalysis([first, second]).restrictions.some(item => item.title === 'PC 간 공격'), true);
});
test('자유 메모 추가와 문장 표현 차이는 정형 점수를 희석하지 않는다', () => {
  const first = fixture(), second = fixture(); second.responses.O02.value = '20';
  const before = C.playstyleSimilarity([first, second]).score;
  first.responses.O02.note = second.responses.O02.note = '동일한 메모';
  first.responses.maxHours.fields.availability = '화요일'; second.responses.maxHours.fields.availability = '금요일';
  assert.equal(C.playstyleSimilarity([first, second]).score, before);
  assert.equal(questionSimilarity([first, second], 'O02'), 0);
});
test('불호는 구조화된 예시 태그만 비교하고 자유 문장의 의미를 추정하지 않는다', () => {
  const first = fixture(), second = fixture();
  first.responses.P04.value = '긴 대기 시간\n큰 음량의 BGM'; second.responses.P04.value = ' 큰  음량의 BGM \n긴 대기 시간\n긴 대기 시간';
  assert.equal(questionSimilarity([first, second], 'P04'), 100);
  first.responses.P04.value = '큰 음량의 BGM'; second.responses.P04.value = '시끄러운 음악';
  const result = C.playstyleSimilarity([first, second]);
  assert.equal(questionSimilarity([first, second], 'P04'), null);
  assert.equal(result.score, null);
  assert.ok(result.scoreRange);
  assert.match(C.similarityNote(result), /가능한 점수 범위/);
  assert.equal(C.dislikeEntries([first, second])[1].text, '시끄러운 음악');
});
test('최소 필요·GM 제공·진지한 장면 조건은 별도 비교하고 주 점수를 바꾸지 않는다', () => {
  const profiles = [fixture(), fixture(), fixture()];
  profiles[0].responses.role.value = profiles[1].responses.role.value = 'GM';
  profiles[0].responses.A02.fields.offered = '0'; profiles[1].responses.A02.fields.offered = '4';
  profiles[0].responses.A01.fields.minimum = '0'; profiles[1].responses.A01.fields.minimum = '3';
  profiles[1].responses.C02.fields.serious = 'outside';
  const result = C.playstyleSimilarity(profiles);
  assert.equal(result.score, 100);
  const offered = result.conditions.find(condition => condition.id === 'A02.offered');
  assert.equal(offered.participantCount, 2, 'PL이 함께 있어도 GM끼리 제공 가능 수준 비교');
  assert.equal(offered.comparedCount, 2);
  assert.ok(offered.score < 100);
  assert.ok(result.conditions.find(condition => condition.id === 'A01.minimum').score < 100);
  assert.ok(result.conditions.find(condition => condition.id === 'C02.serious').score < 100);
});
test('별도 플랫폼 이름은 한 번만 비교하고 이름 미공유는 동일 응답으로 추정하지 않는다', () => {
  const first = fixture(), second = fixture();
  first.responses.P01 = { value: 'other', fields: { platform: 'Foundry' } }; second.responses.P01 = { value: 'other', fields: { platform: 'Tabletop' } };
  const before = C.playstyleSimilarity([first, second]).score;
  first.responses.P01.note = second.responses.P01.note = '동일 메모';
  assert.equal(C.playstyleSimilarity([first, second]).score, before);
  assert.equal(questionSimilarity([first, second], 'P01'), 50);
  assert.ok(!C.playstyleSimilarity([first, second]).conditions.some(condition => condition.id === 'P01.platform'));
  delete second.responses.P01.fields.platform;
  assert.equal(C.playstyleSimilarity([first, second]).score, null);
  assert.equal(C.playstyleSimilarity([first, second]).scoreRange, null, '플랫폼 영역 비교 범위 50%라 전체 점수 보류');
});
test('영역의 고정 비중은 문항 수에 좌우되지 않는다', () => {
  const first = fixture(), second = fixture();
  const result = C.playstyleSimilarity([first, second]);
  assert.ok(result.areas.every(area => area.weight === .125));
  assert.notEqual(result.areas.find(area => area.id === 'schedule').totalCount, result.areas.find(area => area.id === 'platform').totalCount);
});
test('일부 RP만 답하거나 영역 비교 범위가 부족하면 전체 점수를 보류한다', () => {
  assert.equal(C.playstyleSimilarity([]).score, null);
  assert.equal(C.playstyleSimilarity([fixture()]).score, null);
  const partial = A.makeProfile({ T1: { value: 0 }, D1: { value: 0 }, S1: { value: 0 } });
  assert.equal(C.playstyleSimilarity([partial, partial]).score, null);
  assert.equal(C.playstyleSimilarity([partial, partial]).scoreRange, null);
  assert.equal(C.playstyleSimilarity([partial, partial]).comparedCount, 3);
  assert.match(C.similarityNote(C.playstyleSimilarity([partial, partial])), /보류/);
});
test('미공유 항목을 없애 100으로 올리는 대신 가능한 점수 구간을 표시한다', () => {
  const first = fixture(), second = fixture(); second.responses.O02.value = '20';
  const before = C.playstyleSimilarity([first, second]); delete second.responses.O02;
  const after = C.playstyleSimilarity([first, second]);
  assert.equal(after.score, null);
  assert.ok(after.scoreRange[0] <= before.score && after.scoreRange[1] >= before.score);
  assert.ok(after.scoreRange[0] < after.scoreRange[1]);
  assert.match(C.similarityValue(after), /^\d+–\d+%$/);
});
test('경계 비공개를 일치 응답으로 취급하지 않는다', () => {
  const first = fixture(), second = fixture(); first.responses.B02.value.gore = second.responses.B02.value.gore = 'private';
  const result = C.playstyleSimilarity([first, second]);
  assert.ok(result.partial);
  assert.ok(result.comparedCount < result.totalCount);
  assert.equal(result.score, null);
  assert.ok(!C.similarityNote(result).includes('레이더 표시 선택'));
  assert.ok(!C.similarityNote(result).includes('운영 조건과 경계'));
});
test('명시적으로 불호가 없다는 응답은 공유 후에도 비교 정보로 보존한다', () => {
  const profile = fixture(); profile.responses.P04.value = '';
  const shared = A.exportProfile(profile);
  assert.equal(shared.responses.P04.value, '');
  assert.equal(C.playstyleSimilarity([profile, shared]).score, 100);
  assert.equal(A.exportProfile(profile, { notes: false }).responses.P04, undefined);
});
function fixture(value = 75, boundary = 'ask') {
  const responses = {};
  for (const q of D.questions) {
    responses[q.id] = { value: q.type === 'trait' ? (q.options.some(([v]) => v === value) ? value : 50) : q.type === 'matrix' ? Object.fromEntries(q.rows.map(([id]) => [id, q.boundary ? boundary : q.options[0][0]])) : q.type === 'text' ? '' : q.options[0][0] };
    if (q.fields) responses[q.id].fields = Object.fromEntries(q.fields.filter(f => !f.when || f.when === responses[q.id].value).map(f => [f.key, f.type === 'select' ? f.options[0][0] : f.type === 'number' ? '3' : '메모']));
  }
  return A.makeProfile(responses, '테스트 참가자');
}

test('파티 지도 텍스트는 참가자별 목록 대신 함께 적용할 조건의 기준을 따른다', () => {
  const first = fixture(25), second = fixture(75);
  first.displayName = '첫 참가자'; second.displayName = '둘째 참가자';
  first.responses.O01.value = '120'; second.responses.O01.value = '480';
  first.responses.O05.value = '2'; second.responses.O05.value = '0';
  first.context.role = 'GM'; second.context.role = 'GM';
  first.responses.A01.fields = { offered: '1' }; second.responses.A01.fields = { offered: '3' };
  const profiles = [first, second];
  const reading = C.partyMapReading(profiles);
  assert.equal(reading.length, 6);
  for (const [key, id] of [['session', 'O01'], ['chat', 'O05']]) {
    const q = D.questions.find(question => question.id === id);
    assert.ok(reading.find(item => item.axis.key === key).text.includes(q.name + ': ' + C.governingAnswer(q, undefined, profiles).label));
  }
  const preparation = D.questions.find(question => question.id === 'A01');
  assert.ok(reading.find(item => item.axis.key === 'preparation').text.includes(preparation.name + ': ' + C.preparationRepresentative(preparation, profiles).label));
  assert.ok(reading.find(item => item.axis.key === 'session').text.includes('휴식 주기: 약 120분마다'));
  assert.ok(reading.every(item => !item.text.includes('첫 참가자') && !item.text.includes('둘째 참가자')));
});

test('36개 문항 묶음: 시작 2, RP 5, 운영 27, 경계 2', () => {
  assert.equal(D.questions.length, 36);
  assert.equal(D.setup.length, 2);
  assert.equal(D.traits.length, 5);
  assert.equal(D.axes.length, 5);
  assert.equal(D.operation.length, 27);
  assert.equal(new Set(D.questions.map(q => q.id)).size, 36);
  assert.equal(D.questions[D.questions.findIndex(q => q.id === 'M1') + 1].id, 'P03');
  assert.equal(D.operation.find(q => q.id === 'P03').group, 'RP');
  D.axes.forEach(a => assert.equal(D.traits.filter(q => q.axis === a.key).length, 1));
  D.questions.forEach(q => q.options.forEach(([, label]) => assert.doesNotMatch(label, /편이다|편이 좋음|편해요/)));
  assert.equal(D.traits.find(q => q.id === 'D1').examples, undefined);
  assert.deepEqual(Array.from(D.traits.find(q => q.id === 'D1').options, ([v, t]) => [v, t]), [[0, '단문 (1~2줄)'], [50, '중문 (3~4줄)'], [100, '장문 (5줄 이상)']]);
  assert.ok(!D.questions.some(q => q.id === 'E1'));
  assert.ok(D.questions.some(q => q.id === 'O15'));
  assert.ok(!D.questions.some(q => ['basis', 'medium', 'format', 'groupSize', 'A05'].includes(q.id)));
  assert.equal(D.operation.find(q => q.id === 'O04').options.length, 4);
  assert.equal(D.operation.find(q => q.id === 'O05').options.length, 3);
  assert.doesNotMatch(D.operation.find(q => q.id === 'O09').options.map(([, label]) => label).join(' '), /게스트/);
  assert.deepEqual(Array.from(D.operation.find(q => q.id === 'O10').options, ([, t]) => t), ['취소한 날 바로 새 날짜 확정', '원래 정해둔 다음 회차에 진행']);
  assert.ok(D.operation.some(q => q.id === 'O16'));
  assert.deepEqual(Array.from(D.operation.find(q => q.id === 'O14').options, ([v]) => v), ['3', '7', '14', '30']);
  assert.deepEqual(Array.from(D.operation.find(q => q.id === 'P01').options, ([, t]) => t), ['코코포리아', 'Roll20', '별도 플랫폼']);
  assert.deepEqual(Array.from(D.operation.find(q => q.id === 'P02').options, ([, t]) => t), ['디스코드', '오픈카톡', '트위터', '별도 채널']);
  assert.deepEqual(Array.from(D.operation.find(q => q.id === 'P03').options, ([, t]) => t), ['1~3분 이내', '5분 이상', '10분 이상']);
  assert.equal(D.operation.find(q => q.id === 'P04').type, 'text');
  assert.ok(D.operation.find(q => q.id === 'P04').suggestions.includes('조용한 사담방'));
  assert.ok(!D.operation.find(q => q.id === 'C02').options.some(([v]) => v === 'ok'));
  assert.equal(D.operation.find(q => q.id === 'C03').options.find(([value]) => value === 'na')[1], '사용하지 않음');
  D.questions.filter(q => q.type === 'matrix').forEach(q => assert.ok(q.options.some(([value]) => value === 'ask')));
  D.boundaries.forEach(q => assert.ok(!q.options.some(([value]) => value === 'private')));
});

test('미응답을 50으로 채우지 않음', () => {
  const p = A.makeProfile({});
  assert.equal(p.radar.tempo, null);
  assert.equal(p.dimensions.tempo.count, 0);
  assert.equal(A.dimensionLabel(p, 'tempo'), '정보 부족');
  assert.equal(p.radar.detail, null);
});

test('각 축의 단일 응답과 가운데 선택을 그대로 해석', () => {
  const p = fixture(); p.responses.T1.value = 50;
  const computed = A.makeProfile(p.responses);
  assert.equal(computed.radar.tempo, 50);
  assert.equal(computed.dimensions.tempo.count, 1);
  assert.equal(A.dimensionLabel(computed, 'tempo'), '두 방향 사이');
  assert.match(A.axisStory(computed, 'tempo').text, /모두 가능/);
});

test('이전 문항 결과는 남은 답변으로 다시 계산', () => {
  const old = fixture();
  old.questionnaireVersion = 'rp-2026-10-v1';
  old.responses.T1.value = 0;
  old.responses.T2 = { value: 100 };
  old.responses.basis = { value: 'usual' };
  old.responses.O10 = { value: '0' };
  old.responses.O14 = { value: '3' };
  old.responses.O01 = { value: '60', fields: { need: 'need' } };
  old.radar.tempo = 50;
  const migrated = A.validateProfile(old);
  assert.equal(migrated.questionnaireVersion, D.version);
  assert.equal(migrated.radar.tempo, 0);
  assert.equal(migrated.responses.T2, undefined);
  assert.equal(migrated.responses.basis, undefined);
  assert.equal(migrated.responses.O10, undefined);
  assert.equal(migrated.responses.O14, undefined);
  assert.equal(migrated.responses.O01, undefined);
});

test('v3에서 의미가 바뀐 응답은 재사용하지 않음', () => {
  const old = fixture();
  old.questionnaireVersion = 'rp-2026-10-v3';
  old.responses.O04.value.notes = 'ok';
  old.responses.B01.value.pvp = 'private';
  old.responses.C03.value.dialogue = 'na';
  const migrated = A.validateProfile(old);
  for (const id of ['E1', 'O04', 'O05', 'O09', 'O10']) assert.equal(migrated.responses[id], undefined);
  assert.equal(migrated.responses.A04.value, old.responses.A04.value);
  assert.equal(migrated.responses.B01.value.pvp, 'private');
  assert.equal(migrated.responses.C03.value.dialogue, undefined);
  assert.equal(A.validateProfile(migrated).responses.B01.value.pvp, 'private');
});

test('v4 결과의 바뀐 지문 분량과 일정 확정은 다시 답함', () => {
  const old = fixture();
  old.questionnaireVersion = 'rp-2026-10-v4';
  delete old.responses.P04;
  const migrated = A.validateProfile(old);
  assert.equal(migrated.responses.D1, undefined);
  assert.equal(migrated.responses.O14, undefined);
  assert.equal(migrated.responses.P04, undefined);
});

test('v5의 개그 가능 응답만 재선택하고 나머지 새 답변은 유지', () => {
  const old = fixture();
  old.questionnaireVersion = 'rp-2026-10-v5';
  old.responses.C02.value.character = 'ok';
  old.responses.C02.value.player = '1';
  old.responses.P04.value = '조용한 사담방';
  const migrated = A.validateProfile(old);
  assert.equal(migrated.responses.C02.value.character, undefined);
  assert.equal(migrated.responses.C02.value.player, '1');
  assert.equal(migrated.responses.D1.value, 50);
  assert.equal(migrated.responses.O14.value, '3');
  assert.equal(migrated.responses.P04.value, '조용한 사담방');
});

test('v6 결과는 RP 문항 재배치 후에도 응답을 유지', () => {
  const old = fixture();
  old.questionnaireVersion = 'rp-2026-10-v6';
  old.responses.P03.value = '10+';
  const migrated = A.validateProfile(old);
  assert.equal(migrated.questionnaireVersion, D.version);
  assert.equal(migrated.responses.P03.value, '10+');
  assert.equal(migrated.responses.T1.value, old.responses.T1.value);
});

test('파티 레이더는 응답을 여섯 가지 성향으로 묶고 원래 응답을 보존', () => {
  const p = fixture();
  const keys = C.comparisonAxes.map(axis => axis.key);
  assert.equal(keys.length, 6);
  assert.ok(keys.includes('rpFlow') && keys.includes('session') && keys.includes('preparation'));
  assert.ok(!keys.includes('P01') && !keys.includes('B01'));
  p.responses.P03.value = '10+';
  p.responses.maxHours.value = 'flexible';
  p.responses.O01.value = '120';
  p.responses.O02.value = '20';
  p.responses.O13.value = '30';
  p.responses.O14.value = '30';
  const values = C.comparisonRadar(p);
  assert.equal(values.rpFlow, 56);
  assert.equal(values.expression, 63);
  assert.equal(values.session, 17);
  assert.equal(values.schedule, 100);
  assert.match(C.comparisonAnswer(p, C.comparisonAxes.find(axis => axis.key === 'rpFlow')), /타이핑 시간: 10분 이상/);
  assert.match(C.comparisonAnswer(p, C.comparisonAxes.find(axis => axis.key === 'session')), /휴식 길이: 약 20분 이상/);
  const context = Object.fromEntries(['setTransform', 'clearRect', 'beginPath', 'moveTo', 'lineTo', 'closePath', 'stroke', 'fill', 'arc', 'rect', 'setLineDash', 'fillText'].map(name => [name, () => {}]));
  const canvas = { width: 600, height: 600, getContext: () => context };
  assert.doesNotThrow(() => A.drawRadar(canvas, [{ id: 'test', data: values }], false, true, C.comparisonAxes));
});

test('세션 호흡은 모든 완료 응답 조합에서 표시하고 유동적인 선택도 반영한다', () => {
  const p = fixture();
  for (const hours of D.questions.find(q => q.id === 'maxHours').options) {
    for (const interval of D.questions.find(q => q.id === 'O01').options) {
      for (const rest of D.questions.find(q => q.id === 'O02').options) {
        p.responses.maxHours.value = hours[0];
        p.responses.O01.value = interval[0];
        p.responses.O02.value = rest[0];
        const session = C.comparisonRadar(p).session;
        assert.ok(Number.isFinite(session) && session >= 0 && session <= 100);
      }
    }
  }
  p.responses.maxHours.value = 'flexible';
  p.responses.O01.value = 'asNeeded';
  p.responses.O02.value = '5';
  assert.equal(C.comparisonRadar(p).session, 67);
  p.responses.O02.value = '20';
  assert.equal(C.comparisonRadar(p).session, 33);
  const text = C.comparisonAnswer(p, C.comparisonAxes.find(axis => axis.key === 'session'));
  assert.match(text, /회차마다 조율/);
  assert.match(text, /필요할 때 쉬기/);
  delete p.responses.maxHours;
  delete p.responses.O01;
  assert.equal(C.comparisonRadar(p).session, null);
});

test('파티 레이더의 최저값은 중심이 아닌 첫 눈금에 그린다', () => {
  let path = [], polygon;
  const context = {
    setTransform() {}, clearRect() {}, beginPath() { path = []; }, moveTo(x, y) { path.push([x, y]); },
    lineTo(x, y) { path.push([x, y]); }, closePath() {}, stroke() {},
    fill() { if (path.length === 6) polygon = path; }, arc() {}, rect() {}, setLineDash() {}, fillText() {}
  };
  const canvas = { width: 600, height: 600, getContext: () => context };
  const data = Object.fromEntries(C.comparisonAxes.map(axis => [axis.key, 0]));
  A.drawRadar(canvas, [{ id: 'minimum', data, minRadius: .25 }], false, true, C.comparisonAxes, false);
  assert.equal(polygon.length, 6);
  assert.deepEqual(polygon[0], [300, 253.5]);
});

test('가져온 레이더는 재계산하고 잘못된 값·버전·인원을 거부', () => {
  const p = fixture(); p.radar.tempo = 0;
  assert.equal(A.validateProfile(p).radar.tempo, 75);
  assert.throws(() => A.validateProfile({ ...p, schemaVersion: '2.0' }), /이전 설계/);
  assert.throws(() => A.validateProfile({ ...p, radar: { ...p.radar, tempo: Infinity } }), /유한한/);
  assert.throws(() => A.validateProfile({ ...p, responses: { ...p.responses, T1: { value: '100' } } }), /선택지/);
  assert.throws(() => A.validateProfile({ ...p, responses: { ...p.responses, T1: { value: 'unknown' } } }), /선택지/);
  assert.throws(() => A.validateProfile({ ...p, responses: { ...p.responses, O12: { value: '2', fields: { minimum: '-1' } } } }), /인원/);
  assert.throws(() => A.validateProfile({ ...p, responses: { ...p.responses, P04: { value: 'x'.repeat(2001) } } }), /2,000자/);
});

test('경계·자유 입력·개인 일정은 기본 포함하고 기존 비공개 항목은 제외', () => {
  const p = fixture(); p.responses.B01.value.pvp = 'private'; p.responses.B01.note = '비공개 상세';
  p.responses.O01.note = '개인 메모'; p.responses.maxHours.fields = { availability: '개인 일정' };
  p.responses.P04.value = '피하고 싶은 요소';
  const basic = A.exportProfile(p, { boundaries: false, notes: false });
  assert.equal(basic.responses.B01, undefined);
  assert.equal(basic.responses.O01.note, undefined);
  assert.equal(basic.responses.maxHours.fields.availability, undefined);
  assert.equal(basic.responses.P04, undefined);
  const shared = A.exportProfile(p);
  assert.equal(shared.responses.B01.value.pvp, undefined);
  assert.equal(shared.responses.B01.note, undefined);
  assert.equal(shared.responses.O01.note, '개인 메모');
  assert.equal(shared.responses.maxHours.fields.availability, '개인 일정');
  assert.equal(shared.responses.B01.value.loss, 'ask');
  assert.equal(shared.responses.P04.value, '피하고 싶은 요소');
  assert.equal(A.validateProfile(shared).schemaVersion, '3.0');
});

test('모두 같은 포함 제외·사전 확인 응답도 경계와 대화 대상으로 유지', () => {
  const no = C.groupAnalysis([fixture(0, 'no'), fixture(100, 'no')]);
  assert.equal(no.restrictions.length, 15);
  const ask = C.groupAnalysis([fixture(50, 'ask'), fixture(50, 'ask')]);
  assert.equal(ask.pending.filter(c => c.label === '사전협의').length, 15);
  const missing = C.groupAnalysis([A.exportProfile(fixture(), { boundaries: false }), A.exportProfile(fixture(), { boundaries: false })]);
  assert.equal(missing.pending.filter(c => c.label === '응답 확인').length, 15);
});

test('묶음의 모두 사전협의 응답은 사전 대화 대상으로 유지', () => {
  const p = fixture();
  p.responses.B02.value = Object.fromEntries(D.boundaries.find(q => q.id === 'B02').rows.map(([row]) => [row, 'ask']));
  const loaded = A.validateProfile(p);
  assert.equal(loaded.responses.B02.value.violence, 'ask');
  assert.equal(C.groupAnalysis([loaded]).pending.filter(c => c.label === '사전협의').length, 15);
});

test('조율 카드 제목은 항목명으로 두고 참가자별 실제 응답을 설명', () => {
  const first = fixture(0, 'no'), second = fixture(100, 'ask');
  first.displayName = '가람'; second.displayName = '누리';
  const analysis = C.groupAnalysis([first, second]);
  const boundary = analysis.restrictions.find(c => c.title === 'PC 간 공격');
  assert.deepEqual(Array.from(boundary.details, item => [item.label, item.names]), [['포함하지 마세요', '가람'], ['사전협의', '누리']]);
  const tempo = analysis.suggestions.find(c => c.title === 'RP 템포');
  assert.equal(tempo.label, 'RP 성향 차이');
  assert.match(tempo.details[0].label, /반응을 충분히 정리/);
  assert.equal(tempo.details[0].names, '가람');
  assert.match(tempo.details[1].label, /즉시 주고받는 진행/);
  assert.equal(tempo.details[1].names, '누리');
});

test('준비 수준 차이는 최소 필요와 GM 제공 가능 수준을 카드에서 보여줌', () => {
  const gm = fixture(), player = fixture();
  gm.displayName = 'GM'; player.displayName = 'PL';
  gm.context.role = 'GM';
  gm.responses.A01.fields.offered = '0';
  player.responses.A01.fields.minimum = '3';
  const card = C.groupAnalysis([gm, player]).pending.find(c => c.title === '세션카드');
  assert.ok(card);
  assert.ok(card.details.some(item => item.label === '최소 필요 · PL' && item.names === '회차·장면에 맞춘 카드'));
  assert.ok(card.details.some(item => item.label === 'GM 제공 가능 · GM' && item.names === '없어도 됨'));
});

test('여러 GM은 가장 낮은 제공 가능 수준, 포트레이트는 가장 낮은 참가자 선호를 표시', () => {
  const first = fixture(), second = fixture(), player = fixture();
  first.context.role = 'GM'; second.context.role = 'GM';
  first.responses.A01.fields.offered = '1';
  second.responses.A01.fields.offered = '3';
  player.responses.A01.fields.minimum = '2';
  const card = D.operation.find(q => q.id === 'A01');
  assert.equal(C.preparationRepresentative(card, [first, second, player]).label, '제목·일정 등 기본 정보');
  assert.ok(C.groupAnalysis([first, second, player]).pending.some(item => item.title === '세션카드'));
  first.responses.A04.value = '3';
  second.responses.A04.value = '2';
  player.responses.A04.value = '0';
  assert.equal(C.preparationRepresentative(D.operation.find(q => q.id === 'A04'), [first, second, player]).label, '없어도 됨');
  assert.equal(D.operation.find(q => q.id === 'A04').fields.some(field => field.key === 'offered'), false);
});

test('휴식 간격을 평균으로 상쇄하지 않음', () => {
  const first = fixture(), second = fixture();
  first.displayName = '가람'; second.displayName = '누리';
  first.responses.O01 = { value: '120' };
  second.responses.O01 = { value: '240' };
  first.responses.O02.value = '10'; second.responses.O02.value = '5';
  const card = C.groupAnalysis([first, second]).suggestions.find(c => c.title === '휴식 주기');
  assert.equal(card.text, '약 120분마다 10분 휴식');
  assert.deepEqual(Array.from(card.details, item => [item.label, item.names]), [
    ['가람', '휴식 간격: 약 2시간 · 휴식 길이: 약 10분'],
    ['누리', '휴식 간격: 약 4시간 · 휴식 길이: 약 5분']
  ]);
  const schedule = C.groupAnalysis([first, second]).suggestions.find(c => c.title === '일정 확정');
  assert.equal(schedule.details.length, 2);
  assert.ok(schedule.details.every(item => item.names.includes('일정 확정:')));
  const session = C.groupAnalysis([first, second]).suggestions.find(c => c.title === '회차 길이');
  assert.equal(session.details.length, 2);
  assert.equal(C.constraintRank(D.operation.find(q => q.id === 'O01'), first), -120);
  assert.equal(C.constraintRank(D.operation.find(q => q.id === 'O01'), second), -240);
});

test('한 명과 많은 참가자의 비교 카드 생성, 텍스트 삽입 이스케이프', () => {
  assert.ok(C.groupAnalysis([fixture()]).suggestions.length > 0);
  const many = Array.from({ length: 30 }, (_, i) => fixture(i % 5 * 25));
  assert.ok(C.groupAnalysis(many).suggestions.length > 0);
  assert.equal(A.escape('<img src=x onerror=alert(1)>'), '&lt;img src=x onerror=alert(1)&gt;');
  assert.equal(A.overview(fixture()).length, 3);
  D.operation.forEach(q => assert.ok(A.operationStory(fixture(), q).length > 50));
});

test('명확한 운영 기준과 경계만 제한 순서를 정함', () => {
  const p = fixture();
  const q = id => D.questions.find(item => item.id === id);
  p.responses.B01.value.pvp = 'no';
  assert.equal(C.constraintRank(q('B01'), p, 'pvp'), 3);
  assert.equal(C.constraintRank(q('P01'), p), null);
  assert.equal(C.constraintRank(q('O14'), p), 3);
});

test('파티 기본 응답은 가장 제한적인 답을 표시하고 미확인을 별도 알림', () => {
  const no = fixture(), ask = fixture(), missing = fixture();
  no.responses.B01.value.pvp = 'no';
  ask.responses.B01.value.pvp = 'ask';
  delete missing.responses.B01.value.pvp;
  const boundary = D.boundaries.find(q => q.id === 'B01');
  const result = C.governingAnswer(boundary, 'pvp', [ask, missing, no]);
  assert.equal(result.label, '포함하지 마세요');
  assert.equal(result.unknownCount, 1);
  assert.equal(result.constrained, true);
  assert.equal(result.differs, true);
  assert.equal(C.governingAnswer(boundary, 'pvp', [no, no]).differs, false);
  const preference = D.operation.find(q => q.id === 'P01');
  ask.responses.P01.value = preference.options[1][0];
  assert.equal(C.governingAnswer(preference, undefined, [ask, no]).label, '최다 득표 동률 · 조율 필요');
  assert.equal(C.governingAnswer(preference, undefined, [ask, no]).differs, true);
});

test('선호 플랫폼은 유효한 응답의 최다 득표를 따르고 동률은 조율', () => {
  const q = D.operation.find(item => item.id === 'P01');
  const cocofolia = fixture(), roll20 = fixture(), secondRoll20 = fixture(), unknown = fixture();
  roll20.responses.P01.value = 'roll20';
  secondRoll20.responses.P01.value = 'roll20';
  unknown.responses.P01.value = 'unknown';
  const result = C.governingAnswer(q, undefined, [cocofolia, roll20, secondRoll20, unknown]);
  assert.equal(result.label, 'Roll20');
  assert.equal(result.voteCount, '2/3명 선택');
  assert.equal(result.unknownCount, 1);
  const tie = C.governingAnswer(q, undefined, [cocofolia, roll20]);
  assert.equal(tie.label, '최다 득표 동률 · 조율 필요');
  assert.equal(tie.voteCount, '');
  const otherA = fixture(), otherB = fixture();
  otherA.responses.P01 = { value: 'other', fields: { platform: 'A' } };
  otherB.responses.P01 = { value: 'other', fields: { platform: 'B' } };
  assert.equal(C.governingAnswer(q, undefined, [otherA, otherB]).label, '최다 득표 동률 · 조율 필요');
});

test('연락 채널도 유효한 응답의 최다 득표를 따르고 동률은 조율', () => {
  const q = D.operation.find(item => item.id === 'P02');
  const discord = fixture(), kakao = fixture(), secondKakao = fixture(), unknown = fixture();
  kakao.responses.P02.value = 'openKakao';
  secondKakao.responses.P02.value = 'openKakao';
  delete unknown.responses.P02;
  const result = C.governingAnswer(q, undefined, [discord, kakao, secondKakao, unknown]);
  assert.equal(result.label, '오픈카톡');
  assert.equal(result.voteCount, '2/3명 선택');
  assert.equal(result.unknownCount, 1);
  assert.equal(C.governingAnswer(q, undefined, [discord, kakao]).label, '최다 득표 동률 · 조율 필요');
  const otherA = fixture(), otherB = fixture();
  otherA.responses.P02 = { value: 'other', fields: { channel: 'A' } };
  otherB.responses.P02 = { value: 'other', fields: { channel: 'B' } };
  assert.equal(C.governingAnswer(q, undefined, [otherA, otherB]).label, '최다 득표 동률 · 조율 필요');
});

test('불호 요소는 모든 참가자의 공유된 원문을 유지한다', () => {
  const first = fixture(), second = fixture(), empty = fixture();
  first.displayName = '가'; second.displayName = '나'; empty.displayName = '다';
  first.responses.P04.value = '긴 대기 시간\n큰 음량의 BGM';
  second.responses.P04.value = '잦은 일정 변경';
  assert.deepEqual(Array.from(C.dislikeEntries([first, second, empty]), item => [item.name, item.text]), [
    ['가', '긴 대기 시간\n큰 음량의 BGM'], ['나', '잦은 일정 변경'], ['다', '']
  ]);
});

test('순서를 정할 수 있는 운영 응답은 더 조심스러운 조건을 고름', () => {
  const open = fixture(), careful = fixture();
  const q = id => D.questions.find(item => item.id === id);
  open.responses.O04.value.social = 'responsive'; careful.responses.O04.value.social = 'break';
  assert.equal(C.governingAnswer(q('O04'), 'social', [open, careful]).label, '휴식 시간에만');
  open.responses.O03.value = '0'; careful.responses.O03.value = '2';
  assert.equal(C.governingAnswer(q('O03'), undefined, [open, careful]).label, '내 차례를 알려주면 다시 집중하기 편함');
  open.responses.O05.value = '2'; careful.responses.O05.value = '0';
  assert.equal(C.governingAnswer(q('O05'), undefined, [open, careful]).label, '사담은 거의 없이');
  open.responses.O06.value = '0'; careful.responses.O06.value = '3';
  assert.equal(C.governingAnswer(q('O06'), undefined, [open, careful]).label, '최다 득표 동률 · 조율 필요');
  open.responses.O08.value = '2'; careful.responses.O08.value = '3';
  assert.equal(C.governingAnswer(q('O08'), undefined, [open, careful]).label, '짧은 사전 대화·체험 후 모두 확인');
  open.responses.O09.value = '2'; careful.responses.O09.value = '3';
  assert.equal(C.governingAnswer(q('O09'), undefined, [open, careful]).label, '빈자리 대체는 원하지 않음');
  open.responses.O16.value = 'week'; careful.responses.O16.value = 'now';
  assert.equal(C.governingAnswer(q('O16'), undefined, [open, careful]).label, '최다 득표 동률 · 조율 필요');
  open.responses.A01.value = '1'; careful.responses.A01.value = '3';
  assert.equal(C.governingAnswer(q('A01'), undefined, [open, careful]).label, C.cellLabel(q('A01'), careful));
  open.responses.C03.value.dialogue = 'ok'; careful.responses.C03.value.dialogue = 'na';
  assert.equal(C.governingAnswer(q('C03'), 'dialogue', [open, careful]).label, '사용하지 않음');
  open.responses.C01.value.rules = 'during'; careful.responses.C01.value.rules = 'ask';
  assert.equal(C.governingAnswer(q('C01'), 'rules', [open, careful]).label, '사전협의');
});

test('고정 일정 등 비교할 수 없는 답은 미확인으로 표시하지 않음', () => {
  const numeric = fixture(), fixed = fixture();
  numeric.responses.O13.value = '14'; fixed.responses.O13.value = 'fixed';
  const result = C.governingAnswer(D.operation.find(q => q.id === 'O13'), undefined, [numeric, fixed]);
  assert.equal(result.label, '최다 득표 동률 · 조율 필요');
  assert.equal(result.unknownCount, 0);
  assert.equal(result.incomparableCount, 0);
  numeric.responses.O06.value = '1'; fixed.responses.O06.value = '2';
  assert.equal(C.governingAnswer(D.operation.find(q => q.id === 'O06'), undefined, [numeric, fixed]).label, '최다 득표 동률 · 조율 필요');
});

test('롤방 선호와 GM 제공 가능 수준을 분리', () => {
  const gm = fixture();
  gm.context.role = 'GM';
  gm.responses.A01.fields.minimum = '1';
  gm.responses.A01.fields.offered = '3';
  const label = C.cellLabel(D.operation.find(q => q.id === 'A01'), gm);
  assert.match(label, /최소 필요/);
  assert.doesNotMatch(label, /제공할 수 있는 수준/);
});

test('상위 답을 바꾼 뒤 적용되지 않는 추가 조건은 버림', () => {
  const p = fixture();
  p.responses.O12 = { value: '0', fields: { minimum: '3' } };
  assert.equal(A.validateProfile(p).responses.O12.fields.minimum, undefined);
});

test('사담 위치는 최다 득표를 표시하고 동률과 미확인을 구분', () => {
  const q = D.operation.find(q => q.id === 'O06');
  const first = fixture(), second = fixture(), third = fixture(), missing = fixture();
  first.responses.O06.value = '1'; second.responses.O06.value = '1'; third.responses.O06.value = '3';
  delete missing.responses.O06;
  const result = C.governingAnswer(q, undefined, [first, second, third, missing]);
  assert.equal(result.label, q.options.find(([value]) => value === '1')[1]);
  assert.equal(result.voteCount, '2/3명 선택');
  assert.equal(result.unknownCount, 1);
  assert.equal(C.governingAnswer(q, undefined, [first, third]).label, '최다 득표 동률 · 조율 필요');
  assert.equal(C.governingAnswer(q, undefined, [missing]).label, '미확인');
});

test('공통 카드는 응답이 달라도 참가자 모두가 가진 경우에만 표시', () => {
  const first = fixture(75), second = fixture(100), missing = A.makeProfile({}, '미응답');
  first.displayName = '가람'; second.displayName = '누리';
  const common = C.sharedPlaystyle([first, second]);
  const card = common.find(item => item.id === 'live-exchange');
  assert.ok(card);
  assert.equal(card.names.length, 2);
  assert.match(card.evidence, /2\/2명/);
  assert.equal(C.sharedPlaystyle([first, second, missing]).length, 0);
  const third = fixture(75);
  assert.ok(C.sharedPlaystyle([first, second, third]).every(item => item.names.length === 3));
  assert.ok(C.sharedPlaystyle([first, second, third]).some(item => item.id === 'live-exchange'));
  assert.equal(C.sharedPlaystyle([]).length, 0);
  assert.equal(C.sharedPlaystyle([first]).length, 0);
  assert.equal(C.sharedPlaystyle([first, missing]).length, 0);
});

test('일정과 변경은 최다 득표를 따르고 미확인과 동률을 구분', () => {
  const first = fixture(), second = fixture(), third = fixture(), missing = fixture();
  for (const q of D.operation.filter(q => q.group === '일정과 변경')) {
    first.responses[q.id] = { value: q.options[0][0] };
    second.responses[q.id] = { value: q.options[0][0] };
    third.responses[q.id] = { value: q.options[1][0] };
    delete missing.responses[q.id];
    const result = C.governingAnswer(q, undefined, [first, second, third, missing]);
    assert.equal(result.label, q.options[0][1]);
    assert.equal(result.voteCount, '2/3명 선택');
    assert.equal(result.unknownCount, 1);
    assert.equal(C.governingAnswer(q, undefined, [first, third]).label, '최다 득표 동률 · 조율 필요');
  }
});


test('응답 기준 전환은 대표 응답을 바꾸되 경계와 순서 없는 항목을 유지', () => {
  const profiles = [fixture(), fixture(), fixture()];
  profiles.forEach((profile, i) => { profile.responses.O05.value = i === 2 ? '0' : '2'; });
  const q = D.questions.find(q => q.id === 'O05');
  assert.equal(C.governingAnswer(q, undefined, profiles, 'majority').label, q.options[2][1]);
  assert.equal(C.governingAnswer(q, undefined, profiles, 'majority').voteCount, '2/3명 선택');
  assert.equal(C.governingAnswer(q, undefined, profiles, 'narrow').label, q.options[0][1]);
  const boundary = D.boundaries[0], row = boundary.rows[0][0];
  profiles.forEach((profile, i) => { profile.responses[boundary.id].value[row] = i === 2 ? 'no' : 'ok'; });
  assert.equal(C.governingAnswer(boundary, row, profiles, 'majority').label, '포함하지 마세요');
  const platform = D.questions.find(q => q.id === 'P01');
  assert.equal(C.governingAnswer(platform, undefined, profiles, 'narrow').label, platform.options[0][1]);
});

test('롤방 준비 기준 전환은 GM 제공 범위로만 집계', () => {
  const profiles = [fixture(), fixture(), fixture(), fixture()];
  profiles.forEach((profile, i) => {
    profile.context.role = i === 3 ? 'PL' : 'GM';
    profile.responses.A01.fields = { offered: i === 2 ? '0' : '3' };
  });
  const q = D.questions.find(q => q.id === 'A01');
  assert.equal(C.preparationRepresentative(q, profiles, 'narrow').value, '0');
  const majority = C.preparationRepresentative(q, profiles, 'majority');
  assert.equal(majority.value, '3');
  assert.equal(majority.voteCount, '2/3명 선택');
  profiles[1].responses.A01.fields.offered = '0';
  assert.equal(C.preparationRepresentative(q, profiles, 'majority').value, '0');
  assert.match(C.preparationRepresentative(q, profiles.slice(0, 2), 'majority').label, /동률/);
});


test('전체 기준은 지도 텍스트와 휴식 주기 요약에도 동일하게 적용', () => {
  const profiles = [fixture(), fixture(), fixture()];
  profiles.forEach((profile, i) => {
    profile.responses.O01.value = i === 2 ? '120' : '480';
    profile.responses.O02.value = i === 2 ? '20' : '5';
    profile.responses.O05.value = i === 2 ? '0' : '2';
  });
  const summary = mode => C.groupAnalysis(profiles, mode).suggestions.find(item => item.title === '휴식 주기').text;
  assert.equal(summary('majority'), '약 480분마다 5분 휴식');
  assert.equal(summary('narrow'), '약 120분마다 20분 휴식');
  const reading = mode => C.partyMapReading(profiles, mode).map(item => item.text).join('\n');
  assert.match(reading('majority'), /약 480분마다 5분 휴식/);
  assert.match(reading('narrow'), /약 120분마다 20분 휴식/);
  delete profiles[1].responses.O01;
  assert.match(summary('majority'), /조율 필요/);
});


test('모든 항목의 기준 문구는 상단에서 선택한 기준과 일치', () => {
  for (const q of D.questions) {
    assert.equal(C.criterionCopy(q, 'majority'), '최다 득표 기준', q.id);
    assert.equal(C.criterionCopy(q, 'narrow'), '좁은 범위 기준', q.id);
    if (q.preparation) {
      assert.equal(C.preparationRepresentative(q, [fixture()], 'majority').source, '최다 득표 기준');
      assert.equal(C.preparationRepresentative(q, [fixture()], 'narrow').source, '좁은 범위 기준');
    }
  }
});


test('일정과 변경의 순서 없는 응답은 최다 득표를 유지하고 비교 가능한 응답만 기준 전환', () => {
  const profiles = [fixture(), fixture(), fixture()];
  for (const q of D.operation.filter(q => q.group === '일정과 변경')) {
    profiles.forEach((profile, i) => { profile.responses[q.id] = { value: q.options[i === 2 ? 1 : 0][0] }; });
    const majority = C.governingAnswer(q, undefined, profiles, 'majority');
    assert.equal(majority.label, q.options[0][1], q.id);
    assert.equal(majority.voteCount, '2/3명 선택', q.id);
    const narrow = C.governingAnswer(q, undefined, profiles, 'narrow');
    const ranks = profiles.map(profile => C.constraintRank(q, profile));
    if (ranks.every(rank => rank === null)) {
      assert.equal(narrow.label, majority.label, q.id);
      assert.equal(narrow.voteCount, '2/3명 선택', q.id);
    } else {
      assert.equal(narrow.voteCount, undefined, q.id);
      assert.equal(narrow.label, q.options[ranks[2] > ranks[0] ? 1 : 0][1], q.id);
    }
    assert.equal(C.criterionCopy(q, 'narrow'), '좁은 범위 기준');
    profiles[2].responses[q.id] = { value: q.options[0][0] };
    assert.equal(C.governingAnswer(q, undefined, profiles, 'narrow').label, q.options[0][1], q.id);
  }
});


test('구인과 합류는 외부 구인 범위를 포함해 두 기준으로 재계산', () => {
  const profiles = [fixture(), fixture(), fixture()];
  for (const id of ['O07', 'O08', 'O09']) {
    const q = D.questions.find(q => q.id === id);
    const row = q.type === 'matrix' ? q.rows[0][0] : undefined;
    const common = id === 'O07' ? 'ok' : '2';
    const limiting = id === 'O07' ? 'no' : '3';
    profiles.forEach((profile, i) => {
      const value = i === 2 ? limiting : common;
      profile.responses[id] = { value: row ? { [row]: value } : value };
    });
    const majority = C.governingAnswer(q, row, profiles, 'majority');
    assert.equal(majority.label, q.options.find(([value]) => value === common)[1], id);
    assert.equal(majority.voteCount, '2/3명 선택', id);
    const narrow = C.governingAnswer(q, row, profiles, 'narrow');
    assert.equal(narrow.label, q.options.find(([value]) => value === limiting)[1], id);
    assert.equal(narrow.voteCount, undefined, id);
  }
});


test('메타발언의 채널과 시점 제한은 좁은 범위에서 함께 반영', () => {
  const q = D.questions.find(q => q.id === 'C01');
  for (const [row] of q.rows) {
    const profiles = [fixture(), fixture(), fixture()];
    profiles[0].responses.C01.value[row] = 'channel';
    profiles[1].responses.C01.value[row] = 'channel';
    profiles[2].responses.C01.value[row] = 'between';
    const narrow = C.governingAnswer(q, row, profiles, 'narrow');
    assert.equal(narrow.label, '별도 채널에서 장면 전후에만', row);
    assert.equal(narrow.constrained, true, row);
    assert.equal(C.governingAnswer(q, row, profiles.reverse(), 'narrow').label, narrow.label, row);
    assert.equal(C.governingAnswer(q, row, profiles, 'majority').label, '별도 채널에서 가능', row);
    profiles[0].responses.C01.value[row] = 'ask';
    assert.equal(C.governingAnswer(q, row, profiles, 'narrow').label, '사전협의', row);
  }
});
