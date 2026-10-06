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
  const radar = value => Object.fromEntries(C.comparisonAxes.map(axis => [axis.key, value]));
  assert.equal(C.radarOverlap([radar(75), radar(75)]), 100);
  assert.equal(C.radarOverlap([radar(50), radar(100)]), 39);
  assert.equal(C.radarOverlap([radar(50), radar(75), radar(100)]), 39);
  assert.equal(C.radarOverlap([radar(0), radar(0)]), 100);
  assert.equal(C.radarOverlap([radar(50), { ...radar(50), [C.comparisonAxes[0].key]: null }]), null);
  assert.equal(C.radarOverlap([radar(50)]), null);
});
function fixture(value = 75, boundary = 'ask') {
  const responses = {};
  for (const q of D.questions) {
    responses[q.id] = { value: q.type === 'trait' ? (q.options.some(([v]) => v === value) ? value : 50) : q.type === 'matrix' ? Object.fromEntries(q.rows.map(([id]) => [id, q.boundary ? boundary : q.options[0][0]])) : q.type === 'text' ? '' : q.options[0][0] };
    if (q.fields) responses[q.id].fields = Object.fromEntries(q.fields.filter(f => !f.when || f.when === responses[q.id].value).map(f => [f.key, f.type === 'select' ? f.options[0][0] : f.type === 'number' ? '3' : '메모']));
  }
  return A.makeProfile(responses, '테스트 참가자');
}

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
  assert.equal(D.traits.find(q => q.id === 'D1').examples.length, 3);
  assert.deepEqual(Array.from(D.traits.find(q => q.id === 'D1').options, ([v, t]) => [v, t]), [[0, '단문'], [50, '중문'], [100, '장문']]);
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
  assert.equal(values.session, 0);
  assert.equal(values.schedule, 100);
  assert.match(C.comparisonAnswer(p, C.comparisonAxes.find(axis => axis.key === 'rpFlow')), /타이핑 시간: 10분 이상/);
  assert.match(C.comparisonAnswer(p, C.comparisonAxes.find(axis => axis.key === 'session')), /휴식 길이: 약 20분 이상/);
  const context = Object.fromEntries(['clearRect', 'beginPath', 'moveTo', 'lineTo', 'closePath', 'stroke', 'fill', 'arc', 'rect', 'setLineDash', 'fillText'].map(name => [name, () => {}]));
  const canvas = { width: 600, height: 600, getContext: () => context };
  assert.doesNotThrow(() => A.drawRadar(canvas, [{ id: 'test', data: values }], false, true, C.comparisonAxes));
});

test('파티 레이더의 최저값은 중심이 아닌 첫 눈금에 그린다', () => {
  let path = [], polygon;
  const context = {
    clearRect() {}, beginPath() { path = []; }, moveTo(x, y) { path.push([x, y]); },
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

test('기존 비공개 경계는 계속 제외하고 자유 입력·개인 일정은 기본 제외', () => {
  const p = fixture(); p.responses.B01.value.pvp = 'private'; p.responses.B01.note = '비공개 상세';
  p.responses.O01.note = '개인 메모'; p.responses.maxHours.fields = { availability: '개인 일정' };
  p.responses.P04.value = '피하고 싶은 요소';
  const basic = A.exportProfile(p);
  assert.equal(basic.responses.B01, undefined);
  assert.equal(basic.responses.O01.note, undefined);
  assert.equal(basic.responses.maxHours.fields.availability, undefined);
  assert.equal(basic.responses.P04, undefined);
  const shared = A.exportProfile(p, { boundaries: true, notes: true });
  assert.equal(shared.responses.B01.value.pvp, undefined);
  assert.equal(shared.responses.B01.note, undefined);
  assert.equal(shared.responses.O01.note, '개인 메모');
  assert.equal(shared.responses.P04.value, '피하고 싶은 요소');
  assert.equal(A.validateProfile(shared).schemaVersion, '3.0');
});

test('모두 같은 포함 제외·사전 확인 응답도 경계와 대화 대상으로 유지', () => {
  const no = C.groupAnalysis([fixture(0, 'no'), fixture(100, 'no')]);
  assert.equal(no.restrictions.length, 15);
  const ask = C.groupAnalysis([fixture(50, 'ask'), fixture(50, 'ask')]);
  assert.equal(ask.pending.filter(c => c.label === '사전 대화').length, 15);
  const missing = C.groupAnalysis([A.exportProfile(fixture()), A.exportProfile(fixture())]);
  assert.equal(missing.pending.filter(c => c.label === '응답 확인').length, 15);
});

test('묶음의 모두 먼저 이야기해요 응답은 사전 대화 대상으로 유지', () => {
  const p = fixture();
  p.responses.B02.value = Object.fromEntries(D.boundaries.find(q => q.id === 'B02').rows.map(([row]) => [row, 'ask']));
  const loaded = A.validateProfile(p);
  assert.equal(loaded.responses.B02.value.violence, 'ask');
  assert.equal(C.groupAnalysis([loaded]).pending.filter(c => c.label === '사전 대화').length, 15);
});

test('조율 카드 제목은 항목명으로 두고 참가자별 실제 응답을 설명', () => {
  const first = fixture(0, 'no'), second = fixture(100, 'ask');
  first.displayName = '가람'; second.displayName = '누리';
  const analysis = C.groupAnalysis([first, second]);
  const boundary = analysis.restrictions.find(c => c.title === 'PC 간 공격');
  assert.deepEqual(Array.from(boundary.details, item => [item.label, item.names]), [['포함하지 마세요', '가람'], ['먼저 이야기해요', '누리']]);
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

test('여러 GM은 가장 낮은 제공 가능 수준, 스탠딩은 가장 낮은 참가자 선호를 표시', () => {
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
  assert.equal(C.governingAnswer(q('O06'), undefined, [open, careful]).label, '휴식·종료 후에 나누기');
  open.responses.O08.value = '2'; careful.responses.O08.value = '3';
  assert.equal(C.governingAnswer(q('O08'), undefined, [open, careful]).label, '짧은 사전 대화·체험 후 모두 확인');
  open.responses.O09.value = '2'; careful.responses.O09.value = '3';
  assert.equal(C.governingAnswer(q('O09'), undefined, [open, careful]).label, '빈자리 대체는 원하지 않음');
  open.responses.O16.value = 'week'; careful.responses.O16.value = 'now';
  assert.equal(C.governingAnswer(q('O16'), undefined, [open, careful]).label, '알게 된 즉시');
  open.responses.A01.value = '1'; careful.responses.A01.value = '3';
  assert.equal(C.governingAnswer(q('A01'), undefined, [open, careful]).label, C.cellLabel(q('A01'), careful));
  open.responses.C03.value.dialogue = 'ok'; careful.responses.C03.value.dialogue = 'na';
  assert.equal(C.governingAnswer(q('C03'), 'dialogue', [open, careful]).label, '사용하지 않음');
  open.responses.C01.value.rules = 'during'; careful.responses.C01.value.rules = 'ask';
  assert.equal(C.governingAnswer(q('C01'), 'rules', [open, careful]).label, '먼저 합의 필요');
});

test('고정 일정 등 비교할 수 없는 답은 미확인으로 표시하지 않음', () => {
  const numeric = fixture(), fixed = fixture();
  numeric.responses.O13.value = '14'; fixed.responses.O13.value = 'fixed';
  const result = C.governingAnswer(D.operation.find(q => q.id === 'O13'), undefined, [numeric, fixed]);
  assert.equal(result.label, '약 2주 전');
  assert.equal(result.unknownCount, 0);
  assert.equal(result.incomparableCount, 1);
  numeric.responses.O06.value = '1'; fixed.responses.O06.value = '2';
  assert.equal(C.governingAnswer(D.operation.find(q => q.id === 'O06'), undefined, [numeric, fixed]).label, '응답이 달라요');
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
