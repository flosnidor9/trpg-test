/* 기존 응답에서 읽을 수 있는 세션 취향 카드. 경계와 자유 입력은 사용하지 않습니다. */
(() => {
  'use strict';
  const value = (responses, id) => responses?.[id]?.value;
  const number = (responses, id) => typeof value(responses, id) === 'number' ? value(responses, id) : null;
  const choice = (id, scores) => r => scores[value(r, id)] || 0;
  const trait = (id, side) => r => {
    const n = number(r, id);
    if (n === null) return 0;
    if (side === 'high') return n === 100 ? 3 : n === 75 ? 2 : 0;
    return n === 0 ? 3 : n === 25 ? 2 : 0;
  };
  const row = (id, key, scores) => r => scores[value(r, id)?.[key]] || 0;
  const signals = [
    ['rapid-talk', 'RP', '번개 대화', '빠른 반응으로 대사와 행동을 주고받는 호흡이 편해요.', 'RP 템포', trait('T1', 'high')],
    ['thinking-space', 'RP', '생각의 틈', '반응을 정리할 시간을 두고 이어가는 호흡이 편해요.', 'RP 템포', trait('T1', 'low')],
    ['short-brush', 'RP', '짧은 붓', '한 번의 지문을 간결하게 쓰고 싶어요.', '표현 분량', trait('D1', 'low')],
    ['long-brush', 'RP', '긴 붓', '한 번의 지문에 행동과 표현을 자세히 담고 싶어요.', '표현 분량', trait('D1', 'high')],
    ['lingering-scene', 'RP', '여운의 방', '핵심이 끝난 뒤에도 같은 장면의 교류를 이어가고 싶어요.', '장면 호흡', trait('S1', 'high')],
    ['next-scene', 'RP', '다음 문', '장면의 핵심을 담은 뒤 다음 흐름으로 넘어가고 싶어요.', '장면 호흡', trait('S1', 'low')],
    ['first-spark', 'RP', '첫 불씨', '새 대화나 상호작용의 계기를 먼저 만들기 편해요.', 'RP 시작', trait('I1', 'high')],
    ['echo', 'RP', '메아리', '건네받은 계기에 반응하며 참여하기 편해요.', 'RP 시작', trait('I1', 'low')],
    ['open-map', 'RP', '열린 지도', '필요한 확인을 진행 중에 나누기 편해요.', '조율 시점', trait('M1', 'high')],
    ['bookmark', 'RP', '책갈피', '장면이 일단락된 뒤 진행을 확인하기 편해요.', '조율 시점', trait('M1', 'low')],
    ['campfire-chat', '대화', '수다의 모닥불', '진행 중에도 사담을 충분히 나누는 편이 좋아요.', '사담 비중', choice('O05', { '2': 3 })],
    ['side-chat', '대화', '옆방의 수다', '사담은 별도 채널에서 병행하는 방식이 편해요.', '사담 위치', choice('O06', { '1': 2 })],
    ['interlude-chat', '대화', '막간의 수다', '사담은 장면 사이에 나누는 방식이 편해요.', '사담 위치', choice('O06', { '2': 2, '3': 2 })],
    ['character-humor', '대화', '캐릭터의 웃음', '캐릭터의 개그성 대사와 행동을 즐기고 싶어요.', '캐릭터 개그', row('C02', 'character', { '2': 2, '3': 3 })],
    ['player-humor', '대화', '플레이어의 웃음', '플레이어끼리 농담과 밈을 나누고 싶어요.', '플레이어 농담', row('C02', 'player', { '2': 2, '3': 3 })],
    ['serious-tone', '대화', '진지한 장면의 온도', '진지한 장면에서는 농담을 줄이거나 장면 밖으로 옮기고 싶어요.', '진지한 장면의 농담', r => ['less', 'outside'].includes(r?.C02?.fields?.serious) ? 2 : 0],
    ['rules-signal', '대화', '규칙의 신호', '규칙과 절차는 진행 중에도 확인하는 방식이 편해요.', '규칙·절차 확인', row('C01', 'rules', { during: 2 })],
    ['intent-signal', '대화', '의도의 신호', '행동과 표현의 의도는 진행 중에도 확인하는 방식이 편해요.', '행동·표현 의도 확인', row('C01', 'intent', { during: 2 })],
    ['frequent-break', '휴식과 참여', '잦은 쉼표', '짧은 간격으로 쉬며 참여하는 편이 편해요.', '휴식 간격', choice('O01', { '120': 3, '240': 2 })],
    ['long-focus', '휴식과 참여', '긴 집중 구간', '긴 구간을 이어간 뒤 쉬는 흐름도 편해요.', '휴식 간격', choice('O01', { '360': 2, '480': 3 })],
    ['long-interlude', '휴식과 참여', '넉넉한 막간', '한 번 쉴 때 충분한 시간을 갖는 편이 편해요.', '휴식 길이', choice('O02', { '15': 2, '20': 3 })],
    ['turn-signal', '휴식과 참여', '차례의 종', '내 반응이 필요할 때 알려주면 다시 집중하기 편해요.', '집중 유지 방식', choice('O03', { '2': 2 })],
    ['follow-all', '휴식과 참여', '전체를 따라가는 눈', '다른 인물의 대화와 행동도 계속 따라가는 편이 편해요.', '집중 유지 방식', choice('O03', { '0': 2 })],
    ['session-card', '연출', '첫 장의 카드', '분위기나 장면에 맞춘 세션카드가 있으면 좋아요.', '세션카드', choice('A01', { '2': 2, '3': 3 })],
    ['scene-music', '연출', '장면의 음악', '장면에 맞춰 BGM을 쓰는 편이 좋아요.', 'BGM', choice('A02', { '2': 2, '3': 3, '4': 3 })],
    ['quiet-scene', '연출', '고요한 장면', 'BGM을 사용하지 않는 편이 좋아요.', 'BGM', choice('A02', { '0': 3 })],
    ['scene-map', '연출', '공간의 지도', '주요 공간을 보여주는 맵시트가 있으면 좋아요.', '맵시트', choice('A03', { '2': 2, '3': 3 })],
    ['character-standing', '연출', '인물의 얼굴', '캐릭터 스탠딩을 사용하는 편이 좋아요.', '스탠딩', choice('A04', { '1': 2, '2': 3, '3': 3 })],
    ['early-calendar', '운영', '미리 적는 달력', '날짜를 넉넉히 앞서 공유하고 확정하는 편이 편해요.', '일정 후보·확정', r => {
      const early = ['14', '30'];
      return early.includes(value(r, 'O13')) && early.includes(value(r, 'O14')) ? 3 : early.includes(value(r, 'O13')) || early.includes(value(r, 'O14')) ? 2 : 0;
    }],
    ['fixed-calendar', '운영', '정해진 요일', '고정 일정으로 다음 회차를 준비하는 편이 편해요.', '일정 후보 공유', choice('O13', { fixed: 3 })],
    ['everyone-present', '운영', '모두 모이는 장면', '본 세션은 전원이 참여할 때 진행하는 기준이 편해요.', '진행 인원', choice('O12', { '0': 2 })],
    ['keep-going', '운영', '이어지는 모험', '최소 인원이 모이면 진행할 수 있는 기준이 편해요.', '진행 인원', choice('O12', { '2': 2 })]
  ].map(([id, category, title, description, evidence, match]) => ({ id, category, title, description, evidence, match }));
  // 서로 관련된 응답을 묶습니다. 한 문항만으로는 카드를 만들지 않습니다.
  const cards = [
    ['live-exchange', 'RP', '주고받는 모험', ['rapid-talk', 'first-spark', 'open-map']],
    ['thoughtful-roleplay', 'RP', '차분히 여는 장면', ['thinking-space', 'echo', 'bookmark']],
    ['rich-scenes', 'RP', '깊게 머무는 이야기', ['long-brush', 'lingering-scene', 'thinking-space']],
    ['light-scenes', 'RP', '가볍게 이어가는 이야기', ['short-brush', 'next-scene', 'rapid-talk']],
    ['social-table', '대화', '웃음이 모이는 테이블', ['campfire-chat', 'character-humor', 'player-humor']],
    ['scene-boundaries', '대화', '장면에 집중하는 호흡', ['interlude-chat', 'serious-tone', 'bookmark']],
    ['open-coordination', '대화', '함께 맞추는 흐름', ['open-map', 'rules-signal', 'intent-signal', 'side-chat']],
    ['restful-session', '휴식과 참여', '쉼이 있는 모험', ['frequent-break', 'long-interlude', 'turn-signal']],
    ['focused-session', '휴식과 참여', '몰입을 이어가는 모험', ['long-focus', 'follow-all', 'lingering-scene']],
    ['cinematic-table', '연출', '눈과 귀로 만나는 세계', ['session-card', 'scene-music', 'scene-map', 'character-standing']],
    ['quiet-roleplay', '연출', '말과 글에 머무는 세계', ['quiet-scene', 'long-brush', 'lingering-scene']],
    ['planned-party', '운영', '미리 준비하는 파티', ['early-calendar', 'everyone-present']],
    ['steady-adventure', '운영', '꾸준히 이어가는 파티', ['fixed-calendar', 'keep-going']]
  ].map(([id, category, title, members]) => ({ id, category, title, members }));
  function rankCards(responses) {
    return cards.map((card, index) => {
      const matched = card.members.map(id => signals.find(signal => signal.id === id))
        .map(signal => ({ ...signal, strength: signal.match(responses) })).filter(signal => signal.strength > 0);
      return {
        id: card.id, category: card.category, title: card.title, index,
        strength: matched.reduce((sum, signal) => sum + signal.strength, 0),
        matchCount: matched.length,
        description: matched.map(signal => signal.description).join('\n'),
        evidence: [...new Set(matched.map(signal => signal.evidence))].join(' · ')
      };
    }).filter(card => card.matchCount >= 2)
      .sort((a, b) => b.strength - a.strength || b.matchCount - a.matchCount || a.index - b.index);
  }
  function featuredCards(responses, limit = 5) {
    return rankCards(responses).slice(0, limit);
  }
  globalThis.TRPGCards = { cards, rankCards, featuredCards };
})();
