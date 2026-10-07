/* n명 비교: 선택한 사람의 레이더와 전체 참가자의 조율 항목을 표시합니다. */
(() => {
  'use strict';
  const A = globalThis.TRPGApp;
  const { D, escape: e } = A;
  const comparisonAxes = [
    { key: 'rpFlow', name: 'RP 흐름', left: '천천히 정리', right: '바로 이어가기' },
    { key: 'expression', name: '표현·장면', left: '간결하게 전환', right: '자세히 이어가기' },
    { key: 'session', name: '세션 호흡', left: '짧고 자주 쉬기', right: '길고 드물게 쉬기' },
    { key: 'chat', name: '사담 비중', left: '적게', right: '많게' },
    { key: 'preparation', name: '롤방 준비', left: '간단히', right: '세밀히' },
    { key: 'schedule', name: '일정 준비', left: '가까운 시점', right: '미리' }
  ];
  const preparationQuestions = D.operation.filter(q => q.preparation);
  const comparisonQuestionIds = {
    rpFlow: ['T1', 'I1', 'M1', 'P03'], expression: ['D1', 'S1'],
    session: ['maxHours', 'O01', 'O02'], chat: ['O05'],
    preparation: preparationQuestions.map(q => q.id), schedule: ['O13', 'O14']
  };
  function meanKnown(values, minimum) {
    const known = values.filter(A.known);
    return known.length >= minimum ? Math.round(known.reduce((sum, value) => sum + value, 0) / known.length) : null;
  }
  function comparisonValue(profile, key) {
    const value = id => A.valueOf(profile, id);
    if (key === 'rpFlow') return meanKnown([profile.radar.tempo, profile.radar.initiative, profile.radar.meta, { '1-3': 100, '5+': 50, '10+': 0 }[value('P03')]], 2);
    if (key === 'expression') return meanKnown([profile.radar.detail, profile.radar.scene], 2);
    if (key === 'session') return meanKnown([
      // 유동적인 응답도 중간값으로 반영해 완료한 응답의 축이 비지 않게 한다.
      { '2': 0, '3': 25, '4': 50, '6': 100, flexible: 50 }[value('maxHours')],
      { '120': 0, '240': 33, '360': 67, '480': 100, asNeeded: 50 }[value('O01')],
      { '5': 100, '10': 67, '15': 33, '20': 0 }[value('O02')]
    ], 2);
    if (key === 'chat') return { '0': 0, '1': 50, '2': 100 }[value('O05')] ?? null;
    if (key === 'schedule') {
      const scale = { '3': 0, '7': 33, '14': 67, '30': 100 };
      return meanKnown([value('O13'), value('O14')].map(answer => scale[answer]), 1);
    }
    if (key === 'preparation') {
      const levels = preparationQuestions.map(q => q.options.findIndex(([option]) => option === value(q.id)) / (q.options.length - 1) * 100);
      return levels.every(level => level >= 0) ? Math.round(levels.reduce((sum, level) => sum + level, 0) / levels.length) : null;
    }
    return null;
  }
  const comparisonRadar = profile => Object.fromEntries(comparisonAxes.map(axis => [axis.key, comparisonValue(profile, axis.key)]));
  const similarityAreas = [
    { id: 'rp', name: 'RP', ids: ['T1', 'D1', 'S1', 'I1', 'M1', 'P03'] },
    { id: 'participation', name: '참여와 휴식', ids: ['maxHours', 'O01', 'O02', 'O03', 'O04'] },
    { id: 'communication', name: '교류와 소통', ids: ['O05', 'O06', 'C01', 'C02', 'C03', 'P04'] },
    { id: 'recruitment', name: '구인과 합류', ids: ['O07', 'O08', 'O09'] },
    { id: 'schedule', name: '일정', ids: ['O10', 'O11', 'O16', 'O15', 'O12', 'O13', 'O14'] },
    { id: 'preparation', name: '롤방 준비', ids: ['A01', 'A02', 'A03', 'A04'] },
    { id: 'platform', name: '플랫폼과 연락', ids: ['P01', 'P02'] },
    { id: 'boundary', name: '경계', ids: ['B01', 'B02'] }
  ];
  // 저장용 선택지 번호를 측정값으로 추정하지 않고, 비교할 척도를 명시합니다.
  const similarityCoordinates = {
    T1: new Map([[0, 0], [25, 25], [50, 50], [75, 75], [100, 100]]),
    D1: new Map([[0, 0], [50, 50], [100, 100]]),
    S1: new Map([[0, 0], [25, 25], [50, 50], [75, 75], [100, 100]]),
    I1: new Map([[0, 0], [25, 25], [50, 50], [75, 75], [100, 100]]),
    M1: new Map([[0, 0], [25, 25], [50, 50], [75, 75], [100, 100]]),
    O02: new Map([['5', 0], ['10', 100 / 3], ['15', 200 / 3], ['20', 100]]),
    O05: new Map([['0', 0], ['1', 50], ['2', 100]]),
    O14: new Map([['3', 0], ['7', 400 / 27], ['14', 1100 / 27], ['30', 100]])
  };
  const minimumSimilarityCoverage = .8;
  function normalizedText(value) {
    return value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('ko');
  }
  function responseSimilarity(values, coordinates, categoryCount) {
    if (coordinates) {
      const points = values.map(value => coordinates.get(value));
      const mean = points.reduce((sum, value) => sum + value, 0) / points.length;
      const deviation = points.reduce((sum, value) => sum + Math.abs(value - mean), 0) / points.length;
      return Math.max(0, Math.min(100, 100 - 2 * deviation));
    }
    // 응답 비율 전체를 사용해 같은 분포의 점수가 인원수나 복제에 따라 바뀌지 않게 합니다.
    const counts = new Map();
    values.forEach(value => counts.set(value, (counts.get(value) || 0) + 1));
    const concentration = [...counts.values()].reduce((sum, count) => sum + (count / values.length) ** 2, 0);
    // 고정 선택지는 균등 분포를 0, 동일 응답을 100으로 정규화합니다.
    // 이름으로 식별하는 플랫폼·연락 채널은 범주 수가 제한되지 않아 기준값 0을 사용합니다.
    const baseline = categoryCount ? 1 / categoryCount : 0;
    return Math.max(0, Math.min(100, 100 * (concentration - baseline) / (1 - baseline)));
  }
  function dislikeTags(profile, q) {
    const value = A.valueOf(profile, q.id);
    if (typeof value !== 'string') return null;
    const lines = [...new Set(value.split(/\r?\n/).map(normalizedText).filter(Boolean))];
    const tags = q.suggestions.map(normalizedText);
    const hasFreeText = lines.some(line => !tags.includes(line));
    // 자유 문장으로 태그 미선택을 추측하지 않고 명시한 태그만 비교합니다.
    return tags.map(tag => lines.includes(tag) ? true : hasFreeText ? undefined : false);
  }
  function playstyleSimilarity(profiles) {
    const questions = [];
    for (const area of similarityAreas) for (const id of area.ids) {
      const q = D.questions.find(question => question.id === id), items = [];
      const compare = (key, values, valid, coordinates, categoryCount) => {
        const score = profiles.length >= 2 && values.every(valid)
          ? responseSimilarity(values, coordinates, categoryCount) : null;
        items.push({ key, score });
      };
      const valid = value => q.options.some(([option]) => option === value);
      const values = profiles.map(profile => A.valueOf(profile, id));
      if (q.type === 'matrix') {
        q.rows.forEach(([row]) => compare(row, values.map(value => value?.[row]), valid, null, q.options.length));
      } else if (id === 'P04') {
        const tags = profiles.map(profile => dislikeTags(profile, q));
        q.suggestions.forEach((tag, index) => compare(tag, tags.map(value => value?.[index]), value => typeof value === 'boolean', null, 2));
      } else if (id === 'P01' || id === 'P02') {
        const field = id === 'P01' ? 'platform' : 'channel';
        const identities = profiles.map((profile, index) => {
          if (!valid(values[index])) return undefined;
          if (values[index] !== 'other') return 'option:' + values[index];
          const name = A.response(profile, id)?.fields?.[field];
          return typeof name === 'string' && name.trim() ? 'name:' + normalizedText(name) : undefined;
        });
        compare(id, identities, value => typeof value === 'string', null, null);
      } else compare(id, values, valid, similarityCoordinates[id] || null, q.options.length);
      const known = items.filter(item => item.score !== null);
      questions.push({ id, area: area.id, score: known.length ? known.reduce((sum, item) => sum + item.score, 0) / known.length : null,
        comparedCount: known.length, totalCount: items.length, coverage: known.length / items.length,
        lower: known.reduce((sum, item) => sum + item.score, 0) / items.length,
        upper: (known.reduce((sum, item) => sum + item.score, 0) + 100 * (items.length - known.length)) / items.length });
    }
    const areas = similarityAreas.map(area => {
      const items = questions.filter(q => q.area === area.id), known = items.filter(q => q.score !== null);
      return { id: area.id, name: area.name, weight: 1 / similarityAreas.length,
        score: known.length ? known.reduce((sum, q) => sum + q.score, 0) / known.length : null,
        lower: items.reduce((sum, q) => sum + q.lower, 0) / items.length,
        upper: items.reduce((sum, q) => sum + q.upper, 0) / items.length,
        coverage: items.reduce((sum, q) => sum + q.coverage, 0) / items.length,
        comparedCount: items.reduce((sum, q) => sum + q.comparedCount, 0), totalCount: items.reduce((sum, q) => sum + q.totalCount, 0) };
    });
    // 최소 조건·제공 가능 범위는 적용 대상 참가자끼리 별도로 비교합니다.
    const conditions = [];
    for (const q of D.questions) for (const field of q.fields || []) {
      if (!['select', 'number'].includes(field.type)) continue;
      const eligible = profiles.filter(profile => (!field.gmOnly || ['GM', 'both'].includes(A.valueOf(profile, 'role'))) &&
        (!field.when || A.valueOf(profile, q.id) === field.when));
      if (!eligible.length) continue;
      const values = eligible.map(profile => A.response(profile, q.id)?.fields?.[field.key]);
      if (!values.some(value => value !== undefined && value !== '')) continue;
      const valid = field.type === 'select' ? value => field.options.some(([option]) => option === value)
        : value => value !== undefined && value !== '' && Number.isInteger(Number(value)) && Number(value) >= field.min && Number(value) <= field.max;
      const known = values.filter(valid), numeric = field.type === 'number';
      const coordinates = numeric ? new Map(known.map(value => [Number(value), 100 * (Number(value) - field.min) / (field.max - field.min)])) : null;
      conditions.push({ id: q.id + '.' + field.key, name: q.name + ' · ' + field.label,
        participantCount: eligible.length, comparedCount: known.length,
        score: eligible.length >= 2 && known.length === eligible.length ? responseSimilarity(numeric ? values.map(Number) : values, coordinates, numeric ? null : field.options.length) : null });
    }
    const completeEnough = profiles.length >= 2 && areas.every(area => area.coverage >= minimumSimilarityCoverage && area.score !== null);
    const partial = questions.some(q => q.coverage < 1);
    return { score: completeEnough && !partial ? Math.round(areas.reduce((sum, area) => sum + area.score * area.weight, 0)) : null,
      scoreRange: completeEnough && partial ? [Math.floor(areas.reduce((sum, area) => sum + area.lower * area.weight, 0)), Math.ceil(areas.reduce((sum, area) => sum + area.upper * area.weight, 0))] : null,
      participantCount: profiles.length, comparedCount: questions.reduce((sum, q) => sum + q.comparedCount, 0),
      totalCount: questions.reduce((sum, q) => sum + q.totalCount, 0), partial,
      minimumCoverage: minimumSimilarityCoverage, questions, areas, conditions };
  }
  function similarityNote(similarity) {
    if (similarity.participantCount < 2) return '참가자가 두 명 이상이면 파티 전체의 응답 유사도를 볼 수 있어요.';
    const coverage = '전체 ' + similarity.participantCount + '명 · ' + similarity.comparedCount + '/' + similarity.totalCount + '개 정형 항목 비교';
    if (similarity.scoreRange) return coverage + ' · 미확인 항목이 있어 가능한 점수 범위로 표시했어요.';
    if (similarity.score === null) return coverage + ' · 비교 범위가 부족해 전체 점수를 보류했어요.';
    return coverage + ' · 8개 영역에 같은 비중을 적용했어요.';
  }
  function similarityValue(similarity) {
    return similarity.scoreRange ? similarity.scoreRange.join('–') + '%' : similarity.score === null ? '—' : similarity.score + '%';
  }
  function comparisonAnswer(profile, axis, separator = ' · ') {
    return (comparisonQuestionIds[axis.key] || []).map(id => {
      const q = D.questions.find(question => question.id === id);
      return q.name + ': ' + A.answerLabel(q, A.response(profile, id));
    }).join(separator) || '미확인';
  }
  const unresolved = v => v == null || ['unknown', 'private', 'other', 'conditional'].includes(v);
  function sharedPlaystyle(profiles) {
    if (profiles.length < 2) return [];
    const cards = new Map();
    profiles.forEach(profile => {
      for (const card of globalThis.TRPGCards.featuredCards(profile.responses)) {
        if (!cards.has(card.id)) cards.set(card.id, { id: card.id, title: card.title, category: card.category, descriptions: [], names: [] });
        cards.get(card.id).names.push(profile.displayName);
        cards.get(card.id).descriptions.push(card.description.split(/(?<=[.!?])\s+/));
      }
    });
    return [...cards.values()].filter(card => card.names.length === profiles.length)
      .sort((a, b) => b.names.length - a.names.length)
      .map(card => ({ ...card, description: card.descriptions[0].filter(sentence => card.descriptions.every(description => description.includes(sentence))).join('\n') || '모두가 가진 취향 카드예요. 각자가 편한 세부 방식은 성향 지도 텍스트에서 확인해 주세요.', text: card.names.join(', '), evidence: card.names.length + '/' + profiles.length + '명 · ' + card.category }));
  }
  const usesMajority = q => ['P01', 'P02', 'O06'].includes(q.id) || q.group === '일정과 변경';
  const fixedBoundary = q => q.boundary;
  const supportsNarrow = q => q.options.some(([value]) => constraintRank(q, { responses: { [q.id]: { value } } }) !== null);
  const majorityMode = (q, mode) => !fixedBoundary(q) && (mode === 'majority' || (usesMajority(q) && (mode !== 'narrow' || !supportsNarrow(q))));
  const criterionLabel = mode => mode === 'majority' ? '최다 득표 기준' : '좁은 범위 기준';
  function criterionCopy(q, mode) {
    return criterionLabel(mode ?? (majorityMode(q) ? 'majority' : 'narrow'));
  }
  const namesFor = (profiles, predicate) => profiles.filter(predicate).map(p => p.displayName).join(', ');
  function answerGroups(profiles, q, valueOf = p => A.valueOf(p, q.id)) {
    const groups = new Map();
    profiles.forEach(p => {
      const value = valueOf(p);
      const label = q.options.find(([option]) => String(option) === String(value))?.[1] || '미확인';
      if (!groups.has(label)) groups.set(label, []);
      groups.get(label).push(p.displayName);
    });
    return [...groups].map(([label, names]) => ({ label, names: names.join(', ') }));
  }
  function groupAnalysis(profiles, modes) {
    const restrictions = [], pending = [], suggestions = [];
    const personDetails = ids => profiles.map(p => ({
      label: p.displayName,
      names: ids.map(id => {
        const q = D.questions.find(question => question.id === id);
        return q.name + ': ' + A.answerLabel(q, A.response(p, id));
      }).join(' · ')
    }));
    for (const q of D.boundaries) for (const [row, name] of q.rows) {
      const vals = profiles.map(p => A.valueOf(p, q.id)?.[row]);
      const details = [
        { label: '포함하지 마세요', names: namesFor(profiles, p => A.valueOf(p, q.id)?.[row] === 'no') },
        { label: '사전협의', names: namesFor(profiles, p => A.valueOf(p, q.id)?.[row] === 'ask') },
        { label: '가능해요', names: namesFor(profiles, p => A.valueOf(p, q.id)?.[row] === 'ok') },
        { label: '미확인', names: namesFor(profiles, p => unresolved(A.valueOf(p, q.id)?.[row])) }
      ].filter(item => item.names);
      if (vals.includes('no')) restrictions.push({ title: name, text: '파티에서 이 소재나 전개를 제외합니다.', details });
      else if (vals.includes('ask')) pending.push({ title: name, text: '', label: '사전협의', details });
      else if (vals.some(unresolved)) pending.push({ title: name, text: '공유되지 않은 응답을 확인한 뒤 범위를 정해 주세요.', label: '응답 확인', details });
    }
    const values = id => profiles.map(p => A.valueOf(p, id));
    const breaks = values('O01').map(Number).filter(v => Number.isFinite(v) && v > 0);
    const lengths = values('O02').map(Number).filter(v => Number.isFinite(v) && v > 0);
    if (breaks.length || lengths.length) {
      let interval = breaks.length ? Math.min(...breaks) : null;
      let duration = lengths.length ? Math.max(...lengths) : null;
      const mode = typeof modes === 'string' ? modes : modes?.['휴식과 집중'];
      if (mode === 'majority') {
        const selected = id => {
          const q = D.questions.find(question => question.id === id);
          const answer = governingAnswer(q, undefined, profiles, mode);
          return q.options.find(([, label]) => label === answer.label)?.[0];
        };
        const selectedInterval = selected('O01'), selectedDuration = selected('O02');
        if (selectedInterval === undefined || selectedDuration === undefined) {
          suggestions.push({ title: '휴식 주기', text: '휴식 간격·길이 조율 필요', details: personDetails(['O01', 'O02']), perPerson: true });
        } else {
          interval = Number(selectedInterval) || null;
          duration = Number(selectedDuration) || null;
        }
      }
      if (!suggestions.some(item => item.title === '휴식 주기')) suggestions.push({ title: '휴식 주기', text: (interval ? '약 ' + interval + '분마다' : '필요할 때') + (duration ? ' ' + duration + '분 휴식' : ' 휴식'), details: personDetails(['O01', 'O02']), perPerson: true });
    }
    const schedules = ['O13', 'O14'];
    schedules.forEach(id => {
      const nums = values(id).map(Number).filter(v => Number.isFinite(v) && v > 0);
      if (nums.length) suggestions.push({ title: D.operation.find(q => q.id === id).name, text: Math.max(...nums) + '일 전', details: personDetails([id]), perPerson: true });
    });
    const durations = values('maxHours').map(Number).filter(v => Number.isFinite(v) && v > 0);
    if (durations.length) suggestions.push({ title: '회차 길이', text: '휴식 포함 최대 ' + Math.min(...durations) + '시간', details: personDetails(['maxHours']), perPerson: true });
    const spreads = D.axes.map(axis => {
      const vals = profiles.map(p => p.radar[axis.key]).filter(A.known);
      return { axis, count: vals.length, spread: vals.length > 1 ? Math.max(...vals) - Math.min(...vals) : 0 };
    });
    const divergent = spreads.filter(s => s.count > 1 && s.spread >= 50).sort((a, b) => b.spread - a.spread);
    divergent.forEach(({ axis }) => {
      const q = D.traits.find(trait => trait.axis === axis.key);
      suggestions.push({ title: axis.name, label: 'RP 성향 차이', text: '선호하는 방식이 달라요. 장면에서 어느 흐름을 따를지 함께 정해 보세요.', details: answerGroups(profiles, q) });
    });
    D.operation.filter(q => q.preparation).forEach(q => {
      const wanted = profiles.map(p => Number(A.valueOf(p, q.id))).filter(v => Number.isInteger(v) && v >= 0);
      if (q.id === 'A04') {
        if (wanted.length > 1 && new Set(wanted).size > 1) suggestions.push({ title: q.name, text: '가장 낮은 선호 수준을 기준으로 포트레이트 사용 범위를 함께 정해 주세요.', label: '포트레이트 선호 차이', details: answerGroups(profiles, q) });
        return;
      }
      const providers = profiles.filter(p => ['GM', 'both'].includes(p.context.role));
      const offered = providers.map(p => p.responses[q.id]?.fields?.offered).filter(v => v !== undefined && v !== '').map(Number);
      const minimum = profiles.map(p => p.responses[q.id]?.fields?.minimum).filter(v => v !== undefined && v !== '').map(Number);
      const fieldDetails = ['minimum', 'offered'].flatMap(key => profiles.filter(p => p.responses[q.id]?.fields?.[key] !== undefined && p.responses[q.id]?.fields?.[key] !== '').map(p => ({ label: (key === 'minimum' ? '최소 필요' : 'GM 제공 가능') + ' · ' + p.displayName, names: q.options.find(([value]) => value === p.responses[q.id].fields[key])?.[1] || '미확인' })));
      const details = [...answerGroups(profiles, q), ...fieldDetails];
      if (offered.length && minimum.some(v => v > Math.min(...offered))) pending.push({ title: q.name, text: '필요한 최소 수준이 GM의 제공 가능 범위보다 높습니다. 가능한 준비 범위를 함께 정해 주세요.', label: '준비 범위 확인', details });
      else if (wanted.length > 1 && new Set(wanted).size > 1) suggestions.push({ title: q.name, text: '원하는 준비 수준을 비교하고 실제 준비 범위를 정해 주세요.', label: '준비 선호 차이', details });
    });
    return { restrictions, pending, suggestions };
  }
  function cellLabel(q, p, row) {
    if (row) {
      const value = A.valueOf(p, q.id)?.[row];
      return value === 'unknown' ? '모르겠음' : value === 'private' ? '비공개' : q.options.find(o => o[0] === value)?.[1] || '미확인';
    }
    let text = A.answerLabel(q, A.response(p, q.id));
    if (q.preparation) {
      const minimum = p.responses[q.id]?.fields?.minimum;
      if (minimum !== undefined && minimum !== '') text += ' · 최소 필요: ' + (q.options.find(([value]) => value === minimum)?.[1] || '미확인');
      return text;
    }
    const fields = A.fieldLabels(q, A.response(p, q.id), p.context.role);
    if (fields.length) text += ' · ' + fields.join(' · ');
    return text;
  }
  const dislikeEntries = profiles => profiles.map(profile => ({ name: profile.displayName, text: A.valueOf(profile, 'P04')?.trim() || '' }));
  function constraintRank(q, p, row) {
    const value = row ? A.valueOf(p, q.id)?.[row] : A.valueOf(p, q.id);
    if (q.boundary || q.id === 'O07') return { ok: 1, ask: 2, no: 3 }[value] ?? null;
    if (q.id === 'O03') return { '0': 1, '1': 2, '2': 3, '3': 4 }[value] ?? null;
    if (q.id === 'O04') return { responsive: 1, outside: 2, break: 3, ask: 4 }[value] ?? null;
    if (q.id === 'O05') return { '2': 1, '1': 2, '0': 3 }[value] ?? null;
    if (q.id === 'O08') return { '2': 1, '0': 2, '1': 3, '3': 4 }[value] ?? null;
    if (q.id === 'O09') return { '2': 1, '0': 2, '1': 3, '3': 4 }[value] ?? null;
    if (q.id === 'C02') return { '3': 1, '2': 2, '1': 3, '0': 4, ask: 5 }[value] ?? null;
    if (q.id === 'C01') return { during: 1, channel: 2, between: 2, ask: 3 }[value] ?? null;
    if (q.id === 'C03') return { ok: 1, short: 2, full: 3, ask: 4, na: 5 }[value] ?? null;
    if (q.preparation) {
      if (q.id === 'A02' && value === '0') return 100;
      const preferred = /^\d+$/.test(value ?? '') ? Number(value) : null;
      const minimum = p.responses[q.id]?.fields?.minimum;
      return preferred === null ? null : Math.max(preferred, /^\d+$/.test(minimum ?? '') ? Number(minimum) : preferred);
    }
    if (q.id === 'maxHours' || q.id === 'O01') return /^\d+$/.test(value ?? '') ? -Number(value) : null;
    if (['O02', 'O13', 'O14'].includes(q.id)) return /^\d+$/.test(value ?? '') ? Number(value) : null;
    if (q.id === 'O16') return { week: 1, three: 2, day: 3, now: 4 }[value] ?? null;
    if (q.id === 'P03') return { '1-3': 1, '5+': 2, '10+': 3 }[value] ?? null;
    return null;
  }
  function governingAnswer(q, row, profiles, mode) {
    const entries = profiles.map(profile => ({ label: cellLabel(q, profile, row), rank: constraintRank(q, profile, row), value: row ? A.valueOf(profile, q.id)?.[row] : A.valueOf(profile, q.id) }));
    if (majorityMode(q, mode)) {
      const validValues = new Set(q.options.map(([value]) => value));
      const votes = entries.filter(entry => validValues.has(entry.value) && !['unknown', 'private', 'conditional'].includes(entry.value));
      const counts = new Map();
      votes.forEach(entry => counts.set(entry.label, (counts.get(entry.label) || 0) + 1));
      const mostVotes = Math.max(0, ...counts.values());
      const winners = [...counts].filter(([, count]) => count === mostVotes);
      const differs = new Set(entries.map(entry => entry.label)).size > 1;
      return {
        label: !votes.length ? '미확인' : winners.length > 1 ? '최다 득표 동률 · 조율 필요' : winners[0][0],
        unknownCount: entries.length - votes.length,
        incomparableCount: 0,
        constrained: winners.length === 1,
        differs,
        voteCount: counts.size > 1 && winners.length === 1 ? mostVotes + '/' + votes.length + '명 선택' : ''
      };
    }
    const ranked = entries.filter(entry => entry.rank !== null);
    const unknownCount = entries.filter(entry => entry.rank === null && (entry.value == null || ['unknown', 'private'].includes(entry.value))).length;
    const incomparableCount = entries.length - ranked.length - unknownCount;
    const differs = new Set(entries.map(entry => entry.label)).size > 1;
    if (ranked.length) {
      const limiting = ranked.reduce((best, entry) => entry.rank > best.rank ? entry : best);
      if (q.id === 'C01' && new Set(ranked.filter(entry => entry.rank === limiting.rank).map(entry => entry.value)).size > 1) {
        return { label: '별도 채널에서 장면 전후에만', unknownCount, incomparableCount, constrained: true, differs };
      }
      return { label: limiting.label, unknownCount, incomparableCount, constrained: true, differs };
    }
    const labels = new Set(entries.map(entry => entry.label));
    return { label: labels.size === 1 ? entries[0].label : '응답이 달라요', unknownCount, incomparableCount: 0, constrained: false, differs };
  }
  function preparationRepresentative(q, profiles, mode) {
    const allowed = new Set(q.options.map(([value]) => value));
    const values = q.id === 'A04'
      ? profiles.map(p => A.valueOf(p, q.id))
      : profiles.filter(p => ['GM', 'both'].includes(p.context.role)).map(p => p.responses[q.id]?.fields?.offered);
    if (mode === 'majority') {
      const voters = q.id === 'A04' ? profiles : profiles.filter(p => ['GM', 'both'].includes(p.context.role));
      const ballots = voters.map(p => ({ ...p, responses: { ...p.responses, [q.id]: { value: q.id === 'A04' ? A.valueOf(p, q.id) : p.responses[q.id]?.fields?.offered } } }));
      const answer = governingAnswer({ ...q, preparation: false }, undefined, ballots, 'majority');
      return { value: q.options.find(([, label]) => label === answer.label)?.[0] ?? null, label: answer.label, source: criterionLabel(mode), voteCount: answer.voteCount };
    }
    const known = values.filter(value => allowed.has(value)).map(Number);
    const selected = known.length ? String(Math.min(...known)) : null;
    return { value: selected, label: q.options.find(([value]) => value === selected)?.[1] || (q.id === 'A04' ? '미확인' : 'GM 응답 없음'), source: criterionLabel(mode) };
  }
  function partyMapReading(profiles, modes = {}) {
    const analysis = groupAnalysis(profiles, modes);
    return comparisonAxes.map(axis => ({ axis, text: comparisonQuestionIds[axis.key].map(id => {
      const q = D.questions.find(question => question.id === id);
      if (q.type === 'trait') return q.name + ': ' + [...new Set(profiles.map(profile => A.answerLabel(q, A.response(profile, id))))].join(' / ');
      if (q.preparation) {
        const representative = preparationRepresentative(q, profiles, (typeof modes === 'string' ? modes : modes[q.group]));
        return q.name + ': ' + representative.label + ' · ' + representative.source;
      }
      const answer = governingAnswer(q, undefined, profiles, (typeof modes === 'string' ? modes : modes[q.group]));
      const notices = [answer.voteCount, answer.unknownCount ? '미확인 ' + answer.unknownCount + '명' : '', answer.incomparableCount ? '별도 조율 ' + answer.incomparableCount + '명' : ''].filter(Boolean);
      return q.name + ': ' + answer.label + (notices.length ? ' · ' + notices.join(' · ') : '');
    }).concat(axis.key === 'session' ? analysis.suggestions.filter(item => item.title === '휴식 주기').map(item => item.title + ': ' + item.text) : []).join('\n') }));
  }
  globalThis.TRPGCompare = { groupAnalysis, cellLabel, dislikeEntries, constraintRank, governingAnswer, preparationRepresentative, comparisonAxes, comparisonRadar, comparisonAnswer, partyMapReading, playstyleSimilarity, similarityNote, similarityValue, sharedPlaystyle, usesMajority, criterionCopy };
  if (typeof document === 'undefined' || !document.querySelector('#comparison-output')) return;
  const { $ } = A;
  let people = [], nextId = 1, selected = new Set(), selectionTouched = false, activePerson = null;
  let comparisonMode = 'narrow';
  const modeFor = () => comparisonMode;
  let headingFrame = null;
  function updateCurrentHeading() {
    headingFrame = null;
    const toolbar = $('#comparison-toolbar');
    if (!toolbar || !toolbar.getClientRects().length) return;
    const groups = [...$('#group-tables').querySelectorAll('.operation-group')];
    const edge = toolbar.getBoundingClientRect().top + 8;
    const current = groups.findLast(group => group.getBoundingClientRect().top <= edge) || groups[0];
    const title = current?.querySelector('h3')?.textContent || '함께 적용할 조건';
    $('#current-operation-title').textContent = title;
    toolbar.querySelector('.criterion-controls').hidden = title === '경계 확인';
    positionVisiblePopovers();
  }
  addEventListener('scroll', () => {
    if (headingFrame === null) headingFrame = requestAnimationFrame(updateCurrentHeading);
  }, { passive: true });
  addEventListener('resize', updateCurrentHeading);
  function operationHeading(group) {
    return '<div class="operation-heading"><h3>' + e(group) + '</h3></div>';
  }

  const style = person => ({ color: A.COLORS[(person.id - 1) % 6], shape: A.SHAPES[(person.id - 1) % 6] });
  const marker = person => '<span class="person-symbol" style="color:' + style(person).color + '">' + style(person).shape + '</span>';
  function setMessage(message, error = false) {
    $('#import-message').textContent = message;
    $('#import-message').classList.toggle('error-message', error);
  }
  function add(raw) {
    const profile = A.validateProfile(raw);
    people.push({ id: nextId++, profile });
    if (!selectionTouched) selected = new Set(people.slice(0, 6).map(p => p.id));
  }
  function rowsFor(questions) {
    return questions.flatMap(q => q.id === 'role' ? [{ q, role: 'GM', title: 'GM 역할' }, { q, role: 'PL', title: 'PL 역할' }] : q.type === 'matrix' ? q.rows.map(([row, title]) => ({ q, row, title: q.boundary || q.group === '표현과 소통' ? title : q.name + ' · ' + title })) : [{ q, title: q.name }]);
  }
  function roleRow(role, title) {
    const members = people.filter(p => p.profile.context.role === role || p.profile.context.role === 'both');
    return '<tr><th scope="row">' + e(title) + '</th><td>' + (members.length ? members.map(p => '<span class="role-member">' + marker(p) + e(p.profile.displayName) + '</span>').join('') : '<span class="empty-answer">해당 참가자 없음</span>') + '</td></tr>';
  }
  function preparationTable(questions, analysis) {
    const answer = (q, value) => q.options.find(([option]) => option === value)?.[1] || '미확인';
    return '<div class="table-scroll compact-table preparation-table"><table><caption class="sr-only">각 행에 마우스를 올리거나 키보드로 선택하면 참가자별 선호와 최소 필요 수준을 볼 수 있습니다.</caption><thead><tr><th scope="col">항목</th><th scope="col">기준 응답</th></tr></thead><tbody>' + questions.map(q => {
      const notice = analysis.pending.find(item => item.title === q.name && item.label === '준비 범위 확인') || analysis.suggestions.find(item => item.title === q.name && ['준비 선호 차이', '포트레이트 선호 차이'].includes(item.label));
      const representative = preparationRepresentative(q, people.map(p => p.profile), modeFor(q));
      const selectedNames = representative.value === null ? [] : people.filter(person => {
        if (q.id !== 'A04' && !['GM', 'both'].includes(person.profile.context.role)) return false;
        const value = q.id === 'A04' ? A.valueOf(person.profile, q.id) : person.profile.responses[q.id]?.fields?.offered;
        return value !== undefined && value !== '' && String(value) === representative.value;
      }).map(person => person.profile.displayName);
      const selectors = modeFor(q) === 'majority' ? (representative.voteCount ? '<span class="vote-count">' + e(representative.voteCount) + '</span>' : '') : selectedNames.length && selectedNames.length < people.length ? '<span class="answer-selectors">' + e(selectedNames.join(', ')) + '</span>' : '';

      const members = people.map(p => {
        const response = p.profile.responses[q.id];
        const minimum = response?.fields?.minimum;
        return '<li><span class="preparation-person">' + marker(p) + e(p.profile.displayName) + '</span><span class="preparation-values"><span>선호 <strong>' + e(answer(q, A.valueOf(p.profile, q.id))) + '</strong></span>' + (minimum !== undefined && minimum !== '' ? '<span>최소 필요 <strong>' + e(answer(q, minimum)) + '</strong></span>' : '') + '</span></li>';
      }).join('');
      const spoken = people.map(p => {
        const minimum = p.profile.responses[q.id]?.fields?.minimum;
        return p.profile.displayName + ': 선호 ' + answer(q, A.valueOf(p.profile, q.id)) + (minimum !== undefined && minimum !== '' ? ', 최소 필요 ' + answer(q, minimum) : '');
      }).join('; ');
      return '<tr class="preparation-row" tabindex="0" aria-label="' + e(q.name + ': ' + representative.label + '. ' + representative.source + '. 참가자별 선호와 최소 필요: ' + spoken) + '"><th scope="row">' + e(q.name) + '</th><td><span class="preparation-primary">' + e(representative.label) + '</span>' + selectors + '<div id="preparation-details-' + e(q.id) + '" class="preparation-popover"><strong class="preparation-popover-title">참가자별 선호와 최소 필요</strong><ul class="preparation-people">' + members + '</ul>' + (notice ? '<p class="preparation-note">' + e(notice.text) + '</p>' : '') + '</div></td></tr>';
    }).join('') + '</tbody></table></div>';
  }
  function summaryRow(item) {
    const details = item.details || [];
    const responseText = details.map(detail => detail.label + ': ' + detail.names).join('; ');
    const popover = details.map(detail => '<span class="answer-person"><strong>' + e(detail.label) + '</strong><span>' + e(detail.names) + '</span></span>').join('');
    const differs = new Set(details.map(detail => detail.names)).size > 1;
    return '<tr class="combined-row"><th scope="row">' + e(item.title) + '</th><td><button type="button" class="group-answer" aria-label="' + e(item.title + ': ' + item.text + '. 참가자별 응답: ' + responseText) + '"><span class="' + (differs ? 'different-answer' : '') + '">' + e(item.text) + '</span><span class="answer-cue" aria-hidden="true">자세히</span><span class="answer-popover" aria-hidden="true"><span class="popover-title">참가자별 응답</span>' + popover + '</span></button></td></tr>';
  }
  function compactTable(rows, analysis, caption = '파티에 적용할 응답 · 각 응답을 선택하면 참가자별 답을 볼 수 있습니다') {
    const breakSummary = analysis.suggestions.find(item => item.title === '휴식 주기');
    return '<div class="table-scroll compact-table"><table><caption>' + e(caption) + '</caption><thead><tr><th scope="col">항목</th><th scope="col">함께 적용할 응답</th></tr></thead><tbody>' + rows.map(({ q, row, role, title }) => {
      if (role) return roleRow(role, title);
      const heading = e(title);
      if (q.id === 'P04') return '<tr><th scope="row">' + heading + '</th><td><ul class="all-dislikes">' + dislikeEntries(people.map(person => person.profile)).map((item, index) => '<li><strong>' + marker(people[index]) + e(item.name) + '</strong><span>' + e(item.text || '기재 없음 또는 공유하지 않음') + '</span></li>').join('') + '</ul></td></tr>';
      const governing = governingAnswer(q, row, people.map(p => p.profile), modeFor(q));
      const limitingRank = Math.max(...people.map(p => constraintRank(q, p.profile, row)).filter(value => value !== null));
      const selectedNames = !majorityMode(q, modeFor(q)) && governing.constrained
        ? people.filter(person => {
          const rank = constraintRank(q, person.profile, row);
          return rank !== null && rank === limitingRank;
        }).map(person => person.profile.displayName)
        : [];
      const selectors = selectedNames.length && selectedNames.length < people.length ? '<span class="answer-selectors">' + e(selectedNames.join(', ')) + '</span>' : '';
      const answers = people.map(p => '<span class="answer-person"><strong>' + marker(p) + e(p.profile.displayName) + '</strong><span>' + e(cellLabel(q, p.profile, row)) + (p.profile.responses[q.id]?.note ? ' · ' + e(p.profile.responses[q.id].note) : '') + '</span></span>').join('');
      const notice = (governing.voteCount ? '<span class="vote-count">' + e(governing.voteCount) + '</span>' : '') + (governing.unknownCount ? '<span class="unconfirmed-count">미확인 ' + governing.unknownCount + '명</span>' : '') + (governing.incomparableCount ? '<span class="unconfirmed-count">별도 조율 ' + governing.incomparableCount + '명</span>' : '');
      const spoken = people.map(p => p.profile.displayName + ': ' + cellLabel(q, p.profile, row)).join('; ');
      return '<tr><th scope="row">' + heading + '</th><td><button type="button" class="group-answer" aria-label="' + e(title + ': ' + governing.label + '. 참가자별 응답: ' + spoken) + '"><span class="' + (governing.differs ? 'different-answer' : '') + '">' + e(governing.label) + '</span>' + selectors + notice + '<span class="answer-cue" aria-hidden="true">자세히</span><span class="answer-popover" aria-hidden="true"><span class="popover-title">참가자별 응답</span>' + answers + '</span></button>' + '</td></tr>' + (q.id === 'O02' && breakSummary ? summaryRow(breakSummary) : '');
    }).join('') + '</tbody></table></div>';
  }
  function rpDistributions(questions) {
    return '<div class="rp-distributions">' + questions.map(q => {
      const axis = D.axes.find(axis => axis.key === q.axis);
      const buckets = q.options.map(([value, label]) => ({ label, members: people.filter(person => A.valueOf(person.profile, q.id) === value) }));
      const unknown = people.filter(person => !q.options.some(([value]) => value === A.valueOf(person.profile, q.id)));
      const personPoint = (person, label) => '<button type="button" class="distribution-person" aria-label="' + e(person.profile.displayName + ' · ' + q.name + ': ' + label) + '">' + marker(person) + '<span class="distribution-name">' + e(person.profile.displayName) + '</span><span class="distribution-tooltip" aria-hidden="true">' + e(person.profile.displayName + ': ' + label) + '</span></button>';
      return '<article class="rp-distribution" aria-labelledby="distribution-' + e(q.id) + '"><h4 id="distribution-' + e(q.id) + '">' + e(q.name) + '</h4><div class="distribution-endpoints"><span>' + e(axis?.left || q.options[0][1]) + '</span><span>' + e(axis?.right || q.options.at(-1)[1]) + '</span></div><div class="distribution-track" style="--steps:' + buckets.length + '">' + buckets.map(bucket => '<div class="distribution-bucket"><span class="distribution-tick" aria-hidden="true"></span>' + bucket.members.slice(0, 3).map(person => personPoint(person, bucket.label)).join('') + (bucket.members.length > 3 ? '<details class="distribution-more"><summary>+' + (bucket.members.length - 3) + '명</summary>' + bucket.members.slice(3).map(person => personPoint(person, bucket.label)).join('') + '</details>' : '') + '</div>').join('') + '</div>' + (unknown.length ? '<p class="distribution-unknown">미확인 · ' + e(unknown.map(person => person.profile.displayName).join(', ')) + '</p>' : '') + '<ul class="sr-only">' + people.map(person => '<li>' + e(person.profile.displayName + ': ' + A.answerLabel(q, A.response(person.profile, q.id))) + '</li>').join('') + '</ul></article>';
    }).join('') + '</div>';
  }
  function renderTables(analysis) {
    const questionsForTables = [...D.setup, ...D.traits, ...D.operation, ...D.boundaries];
    const groups = [...new Set(questionsForTables.map(q => q.group))];
    $('#group-tables').innerHTML = groups.map(group => {
      const questions = questionsForTables.filter(q => q.group === group);
      const heading = operationHeading(group);
      if (group === 'RP') return '<section class="operation-group rp-group">' + heading + rpDistributions(questions) + '</section>';
      if (['경계 확인', '표현과 소통'].includes(group)) return '<section class="operation-group boundary-group">' + heading + questions.map(q => '<section class="boundary-subgroup" aria-labelledby="boundary-' + e(q.id) + '"><h4 id="boundary-' + e(q.id) + '">' + e(q.name) + '</h4>' + compactTable(rowsFor([q]), analysis, q.name + '의 세부 항목과 파티 응답') + '</section>').join('') + '</section>';
      if (group === '롤방 준비') return '<section class="operation-group preparation-group">' + heading + preparationTable(questions, analysis) + '</section>';
      return '<section class="operation-group">' + heading + compactTable(rowsFor(questions), analysis) + '</section>';
    }).join('');
    updateCurrentHeading();
  }
  function positionAnswerPopover(trigger) {
    const popup = trigger.querySelector('.answer-popover, .preparation-popover');
    const host = popup?.closest('td');
    if (!popup || !host) return;
    popup.style.visibility = 'hidden';
    popup.style.display = 'block';
    const anchor = trigger.getBoundingClientRect(), parent = host.getBoundingClientRect();
    const margin = 8, limit = popup.classList.contains('preparation-popover') ? 310 : 320;
    const naturalHeight = Math.min(limit, popup.scrollHeight + 2);
    const above = Math.max(0, anchor.top - margin + 2);
    const below = Math.max(0, innerHeight - anchor.bottom - margin + 2);
    const upwards = below < naturalHeight && above > below;
    popup.style.maxHeight = Math.min(limit, upwards ? above : below) + 'px';
    popup.style.maxWidth = Math.max(0, innerWidth - margin * 2) + 'px';
    const size = popup.getBoundingClientRect();
    const x = Math.max(margin, Math.min(parent.right - 8 - size.width, innerWidth - margin - size.width));
    const y = Math.max(margin, Math.min(upwards ? anchor.top + 2 - size.height : anchor.bottom - 2, innerHeight - margin - size.height));
    popup.style.left = (x - parent.left) + 'px';
    popup.style.right = 'auto';
    popup.style.top = (y - parent.top) + 'px';
    popup.style.visibility = '';
    popup.style.display = '';
  }
  function positionVisiblePopovers() {
    $('#group-tables').querySelectorAll('.group-answer:hover, .group-answer:focus, .preparation-row:hover, .preparation-row:focus-visible, .preparation-row.is-open').forEach(positionAnswerPopover);
  }
  for (const eventName of ['pointerover', 'focusin']) {
    $('#group-tables').addEventListener(eventName, event => {
      const trigger = event.target.closest('.group-answer, .preparation-row');
      if (trigger) positionAnswerPopover(trigger);
    });
  }
  addEventListener('resize', positionVisiblePopovers);
  function closePreparationDetails() {
    $('#group-tables').querySelectorAll('.preparation-row.is-open').forEach(row => row.classList.remove('is-open'));
  }
  $('#comparison-toolbar').addEventListener('click', event => {
    const toggle = event.target.closest('[data-criterion-mode]');
    if (!toggle) return;
    comparisonMode = toggle.dataset.criterionMode;
    $('#comparison-toolbar').querySelectorAll('[data-criterion-mode]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.criterionMode === comparisonMode)));
    renderTables(groupAnalysis(people.map(p => p.profile), comparisonMode));
    renderRadar();
    globalThis.TRPGCompareMotion?.update(people.map(p => p.id));
  });
  $('#group-tables').addEventListener('click', event => {
    const row = event.target.closest('.preparation-row');
    if (!row) return;
    const opening = !row.classList.contains('is-open');
    closePreparationDetails();
    row.classList.toggle('is-open', opening);
    if (opening) positionAnswerPopover(row);
  });
  document.addEventListener('click', event => {
    if (event.target.closest('.preparation-row')) return;
    closePreparationDetails();
  });
  document.addEventListener('keydown', event => {
    const row = event.target.closest?.('.preparation-row');
    if (row && ['Enter', ' '].includes(event.key)) { event.preventDefault(); row.classList.toggle('is-open'); if (row.classList.contains('is-open')) positionAnswerPopover(row); return; }
    if (event.key !== 'Escape') return;
    if (event.target.closest?.('[data-criterion-mode]')) event.target.closest('[data-criterion-mode]').blur();
    closePreparationDetails();
    row?.blur();
  });
  function renderRadar() {
    const chosen = people.filter(p => selected.has(p.id));
    const radars = chosen.map(p => comparisonRadar(p.profile));
    $('#comparison-radar').closest('.comparison-radar-card').hidden = false;
    $('#comparison-radar').closest('.comparison-radar-visual').hidden = chosen.length === 0;
    $('#radar-selection-copy').textContent = chosen.length ? '선택한 ' + chosen.length + '명의 여러 응답을 여섯 가지 성향으로 대략 묶었습니다. 위치는 취향의 방향이며 우열이 아닙니다. 가장 안쪽 눈금부터 표시해 낮은 값도 면적으로 보입니다. 축 이름에서 방향을 확인하고, 실제 응답과 경계·플랫폼은 아래 표에서 확인해 주세요.' : '위에서 참가자를 선택하면 레이더를 볼 수 있어요.';
    const radarVisible = globalThis.TRPGCompareMotion?.radarVisible() ?? true;
    A.drawRadar($('#comparison-radar'), chosen.map((p, i) => ({ id: p.id, data: radars[i], index: p.id - 1, color: style(p).color, minRadius: .25 })), radarVisible, true, comparisonAxes, false, { revealFromCenter: radarVisible });
    $('#selected-legend').innerHTML = chosen.map(p => '<span class="legend-item">' + marker(p) + e(p.profile.displayName) + '</span>').join('');
    $('#radar-axis-labels').innerHTML = chosen.length ? comparisonAxes.map((axis, index) => {
      const angle = -Math.PI / 2 + index * Math.PI * 2 / comparisonAxes.length;
      const x = 50 + Math.cos(angle) * 37.5;
      const y = 50 + Math.sin(angle) * 35.5;
      const side = x < 25 ? ' radar-axis-left' : x > 75 ? ' radar-axis-right' : '';
      const vertical = y < 25 ? ' radar-axis-top' : '';
      const direction = axis.left + ' → ' + axis.right;
      return '<button type="button" class="radar-axis-label' + side + vertical + '" style="left:' + x + '%;top:' + y + '%" aria-label="' + e(axis.name + ': ' + direction) + '">' + e(axis.name) + '<span class="radar-axis-tooltip" aria-hidden="true">' + e(direction) + '</span></button>';
    }).join('') : '';
    $('#radar-data-summary').innerHTML = '<table><caption>전체 ' + people.length + '명의 함께 적용할 조건 · RP는 선호 분포를 함께 표시합니다.</caption><thead><tr><th scope="col">성향</th><th scope="col">함께 적용할 응답</th></tr></thead><tbody>' + partyMapReading(people.map(person => person.profile), comparisonMode).map(item => '<tr><th scope="row">' + e(item.axis.name) + '</th><td>' + e(item.text) + '</td></tr>').join('') + '</tbody></table>';
    const similarity = playstyleSimilarity(people.map(person => person.profile));
    $('#playstyle-similarity-value').textContent = similarityValue(similarity);
    $('#playstyle-similarity-note').textContent = similarityNote(similarity);
    const similarityScore = score => score === null ? '미확인' : Math.round(score) + '%';
    $('#similarity-breakdown').innerHTML = '<table><caption>영역별 유사도 · 각 영역의 비중은 12.5%입니다.</caption><thead><tr><th scope="col">영역</th><th scope="col">유사도</th></tr></thead><tbody>' + similarity.areas.map(area =>
      '<tr><th scope="row">' + e(area.name) + '</th><td>' + similarityScore(area.score) + (area.coverage < 1 && area.score !== null ? ' · 일부' : '') + '</td></tr>').join('') + '</tbody></table>';
    const common = sharedPlaystyle(chosen.map(person => person.profile));
    $('#party-common-note').textContent = chosen.length < 2 ? '두 명 이상을 선택하면 함께 선호하는 방식을 살펴볼 수 있어요.' : '선택한 참가자 모두가 가진 세션 취향 카드만 표시해요. 응답이 완전히 같을 필요는 없어요.';
    $('#party-png').disabled = chosen.length === 0;
    $('#party-original-png').disabled = chosen.length === 0;
    const commonItem = item => '<article class="common-item common-card"><div class="common-card-art">' + globalThis.TRPGHandoutArt.render(item.id) + '</div><div class="common-card-copy"><span class="taste-category">' + e(item.category) + '</span><h4>' + e(item.title) + '</h4><p>' + e(item.description) + '</p><small>' + e(item.evidence) + '</small></div></article>';
    $('#party-common-list').innerHTML = common.length ? common.slice(0, 3).map(commonItem).join('') + (common.length > 3 ? '<details class="common-more"><summary>공통점 더 보기 (' + (common.length - 3) + ')</summary>' + common.slice(3).map(commonItem).join('') + '</details>' : '') : chosen.length >= 2 ? '<p class="common-empty">아직 함께 가진 세션 취향 카드가 없어요. 아래 분포에서 각자의 선호를 살펴보세요.</p>' : '';
  }
  for (const [id, format] of [['party-original-png', 'original'], ['party-png', 'comparison']]) {
    $('#' + id).onclick = () => {
      const chosen = people.filter(person => selected.has(person.id));
      if (!chosen.length) return;
      globalThis.TRPGPng.preview({ party: true, criteria: comparisonMode, title: '우리 파티의 플레이 성향', readingProfiles: people.map(person => person.profile), members: chosen.map(person => ({ id: person.id, profile: person.profile, color: style(person).color, index: person.id - 1 })), cards: sharedPlaystyle(chosen.map(person => person.profile)), format }, $('#' + id));
    };
  }
  let disposePersonalMotion;
  function renderTabs() {
    disposePersonalMotion?.();
    const oldRadar = $('#personal-panel canvas');
    if (oldRadar?._frame) cancelAnimationFrame(oldRadar._frame);
    oldRadar?._revealObserver?.disconnect();
    if (!people.some(person => person.id === activePerson)) activePerson = null;
    const tabs = [{ id: null, name: '전체' }, ...people.map(person => ({ id: person.id, name: person.profile.displayName }))];
    $('#comparison-tabs').innerHTML = tabs.map(tab => '<button type="button" role="tab" id="' + (tab.id === null ? 'party-tab' : 'person-tab-' + tab.id) + '" data-tab="' + (tab.id ?? 'all') + '" aria-selected="' + (activePerson === tab.id) + '" aria-controls="' + (tab.id === null ? 'party-panel' : 'personal-panel') + '" tabindex="' + (activePerson === tab.id ? '0' : '-1') + '">' + e(tab.name) + '</button>').join('');
    $('#party-panel').hidden = activePerson !== null;
    $('#personal-panel').hidden = activePerson === null;
    $('#personal-panel').innerHTML = '';
    if (activePerson !== null) {
      const person = people.find(person => person.id === activePerson);
      $('#personal-panel').setAttribute('aria-labelledby', 'person-tab-' + activePerson);
      // Prefix IDs so the personal radar and the party radar remain independently addressable.
      const container = document.createElement('div');
      container.className = 'result-page';
      container.innerHTML = globalThis.TRPGProfileView;
      container.querySelectorAll('[id]').forEach(element => { element.id = 'personal-' + element.id; });
      for (const attribute of ['aria-labelledby', 'aria-describedby', 'for']) {
        container.querySelectorAll('[' + attribute + ']').forEach(element => { element.setAttribute(attribute, element.getAttribute(attribute).split(' ').map(id => 'personal-' + id).join(' ')); });
      }
      $('#personal-panel').append(container);
      A.renderProfile(container, structuredClone(person.profile), { idPrefix: 'personal-', persistProfile: false });
      container.querySelector('.profile-cta').setAttribute('href', '#comparison-tabs');
      container.querySelector('.profile-cta').addEventListener('click', event => { event.preventDefault(); $('#party-tab').click(); $('#comparison-tabs').scrollIntoView({ block: 'start' }); });
      container.querySelector('#personal-taste-empty').textContent = '아직 카드를 고를 응답이 충분하지 않아요. 공유한 응답을 확인해 주세요.';
      container.querySelector('.export-heading .section-copy').textContent = '이 참가자의 결과 JSON 또는 PNG를 저장해 파티 비교에 다시 불러올 수 있어요.';
      disposePersonalMotion = globalThis.TRPGResultMotion.init(container);
    }
  }
  $('#comparison-tabs').addEventListener('click', event => {
    const tab = event.target.closest('[data-tab]');
    if (!tab) return;
    activePerson = tab.dataset.tab === 'all' ? null : Number(tab.dataset.tab);
    renderTabs();
    globalThis.TRPGCompareMotion?.panel();
    document.getElementById(tab.id).focus();
  });
  $('#comparison-tabs').addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    const tabs = [...$('#comparison-tabs').querySelectorAll('[role="tab"]')];
    const index = tabs.indexOf(event.target);
    if (index < 0) return;
    event.preventDefault();
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    tabs[next].click();
  });
  function renderParticipants() {
    $('#legend').innerHTML = people.map(p => '<div class="participant-control"><label><input type="checkbox" aria-label="레이더에 표시: ' + e(p.profile.displayName) + '" data-person="' + p.id + '"' + (selected.has(p.id) ? ' checked' : '') + '>' + marker(p) + '</label><input class="participant-name" aria-label="참가자 ' + p.id + ' 이름" data-name="' + p.id + '" maxlength="80" value="' + e(p.profile.displayName) + '"><button class="remove-person" type="button" data-remove="' + p.id + '" aria-label="' + e(p.profile.displayName) + ' 제거">×</button></div>').join('');
    $('#legend').querySelectorAll('[data-person]').forEach(input => input.addEventListener('change', () => {
      const id = Number(input.dataset.person);
      if (input.checked && selected.size >= 6) { input.checked = false; $('#selection-message').textContent = '레이더는 최대 6명까지 선택할 수 있어요. 아래 조건 표에는 모두 포함됩니다.'; return; }
      selectionTouched = true;
      if (input.checked) selected.add(id); else selected.delete(id);
      $('#selection-message').textContent = selected.size + '명을 레이더에 표시해요.';
      renderRadar();
    }));
    $('#legend').querySelectorAll('[data-name]').forEach(input => input.addEventListener('change', () => {
      people.find(p => p.id === Number(input.dataset.name)).profile.displayName = input.value.trim() || '참가자 ' + input.dataset.name;
      render();
    }));
    $('#legend').querySelectorAll('[data-remove]').forEach(button => button.addEventListener('click', () => {
      const id = Number(button.dataset.remove);
      people = people.filter(p => p.id !== id); selected.delete(id);
      render();
      setMessage('이 비교 화면에서 참가자를 제거했어요. 원본 파일은 유지됩니다.');
    }));
  }
  function render() {
    $('#comparison-output').hidden = !people.length;
    $('#comparison-empty').hidden = Boolean(people.length);
    $('#participant-count').textContent = String(people.length);
    if (!people.length) { selected.clear(); selectionTouched = false; globalThis.TRPGCompareMotion?.update([]); return; }
    renderParticipants(); renderTabs();
    const analysis = groupAnalysis(people.map(p => p.profile), comparisonMode);
    renderRadar(); renderTables(analysis);
    globalThis.TRPGCompareMotion?.update(people.map(p => p.id));
  }
  $('#add-json').onclick = () => {
    try {
      if ($('#json-input').value.length > 2_000_000) throw new Error('결과 JSON은 2MB 이하로 불러와 주세요.');
      add(JSON.parse($('#json-input').value)); $('#json-input').value = ''; render(); setMessage('참가자를 추가했어요. 원하면 표시 이름을 바꿀 수 있습니다.');
    } catch (error) { setMessage(error instanceof SyntaxError ? 'JSON 형식을 읽지 못했어요. 결과 파일의 전체 내용을 붙여 넣어주세요.' : error.message, true); }
  };
  async function importFiles(files) {
    let added = 0;
    const errors = [];
    for (const file of files) {
      try {
        const png = /\.(png|jpe?g|webp)$/i.test(file.name) || /^image\//.test(file.type);
        let profiles;
        if (png) profiles = await TRPGPngMetadata.read(file);
        else {
          if (file.size > 2_000_000) throw new Error('JSON 파일은 2MB 이하로 불러와 주세요.');
          profiles = [JSON.parse(await file.text())];
        }
        // 파티 파일 전체를 검증한 뒤 추가해 잘못된 파일이 일부만 반영되지 않게 합니다.
        const validated = profiles.map(profile => A.validateProfile(profile));
        validated.forEach(add); added += validated.length;
      } catch (err) { errors.push(file.name + ': ' + (err instanceof SyntaxError ? 'JSON 형식이 올바르지 않아요.' : err.message)); }
    }
    render(); setMessage((added ? added + '명의 결과를 추가했어요. ' : '') + errors.join(' '), errors.length > 0);
  }
  $('#file-input').onchange = async event => { await importFiles(event.target.files); event.target.value = ''; };
  const drop = $('#dropzone');
  drop.addEventListener('dragover', event => { event.preventDefault(); drop.classList.add('drag-active'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('drag-active'));
  drop.addEventListener('drop', async event => { event.preventDefault(); drop.classList.remove('drag-active'); await importFiles(event.dataTransfer.files); });
  $('#use-my-profile').onclick = () => {
    try {
      const text = localStorage.getItem(A.STORAGE);
      if (!text) throw new Error('이 기기에 저장한 결과가 없어요. 테스트에 먼저 답해주세요.');
      add(A.exportProfile(A.validateProfile(JSON.parse(text)), { boundaries: true, notes: true }));
      render(); setMessage('이 기기의 결과를 비교에 추가했어요. 비공개 경계는 제외했습니다.');
    } catch (err) { setMessage(err.message, true); }
  };
  render();
})();
