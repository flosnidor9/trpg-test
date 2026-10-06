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
      { '2': 0, '3': 25, '4': 50, '6': 100 }[value('maxHours')],
      { '120': 0, '240': 33, '360': 67, '480': 100 }[value('O01')],
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
  function polygonArea(points) {
    return Math.abs(points.reduce((sum, [x, y], i) => {
      const [nextX, nextY] = points[(i + 1) % points.length];
      return sum + x * nextY - nextX * y;
    }, 0)) / 2;
  }
  function clipPolygon(subject, clip) {
    let result = subject;
    for (let i = 0; i < clip.length && result.length; i++) {
      const a = clip[i], b = clip[(i + 1) % clip.length], input = result;
      result = [];
      const side = p => (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
      for (let j = 0; j < input.length; j++) {
        const current = input[j], previous = input[(j + input.length - 1) % input.length];
        const currentSide = side(current), previousSide = side(previous);
        if ((currentSide >= 0) !== (previousSide >= 0)) {
          const ratio = previousSide / (previousSide - currentSide);
          result.push([previous[0] + (current[0] - previous[0]) * ratio, previous[1] + (current[1] - previous[1]) * ratio]);
        }
        if (currentSide >= 0) result.push(current);
      }
    }
    return result;
  }
  function radarOverlap(radars) {
    if (radars.length < 2 || radars.some(radar => comparisonAxes.some(axis => !A.known(radar[axis.key])))) return null;
    const directions = comparisonAxes.map((_, i) => {
      const angle = -Math.PI / 2 + i * Math.PI * 2 / comparisonAxes.length;
      return [Math.cos(angle), Math.sin(angle)];
    });
    let intersection = 0, union = 0;
    for (let axis = 0; axis < comparisonAxes.length; axis++) {
      const next = (axis + 1) % comparisonAxes.length;
      const triangles = radars.map(radar => {
        const distance = key => .25 + .75 * radar[key] / 100;
        const first = distance(comparisonAxes[axis].key), second = distance(comparisonAxes[next].key);
        return [[0, 0], [directions[axis][0] * first, directions[axis][1] * first], [directions[next][0] * second, directions[next][1] * second]];
      });
      for (let mask = 1; mask < 1 << triangles.length; mask++) {
        let clipped = null, count = 0;
        for (let i = 0; i < triangles.length; i++) if (mask & (1 << i)) {
          clipped = clipped ? clipPolygon(clipped, triangles[i]) : triangles[i];
          count++;
          if (!clipped.length) break;
        }
        const area = clipped?.length >= 3 ? polygonArea(clipped) : 0;
        if (count === triangles.length) intersection += area;
        union += count % 2 ? area : -area;
      }
    }
    return union > 1e-12 ? Math.round(Math.max(0, Math.min(100, intersection / union * 100))) : null;
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
        if (!cards.has(card.id)) cards.set(card.id, { id: card.id, title: card.title, category: card.category, names: [] });
        cards.get(card.id).names.push(profile.displayName);
      }
    });
    return [...cards.values()].filter(card => card.names.length === profiles.length)
      .sort((a, b) => b.names.length - a.names.length)
      .map(card => ({ ...card, text: card.names.join(', '), evidence: card.names.length + '/' + profiles.length + '명 · ' + card.category }));
  }
  const usesMajority = q => ['P01', 'P02', 'O06'].includes(q.id) || q.group === '일정과 변경';
  function criterionCopy(questions) {
    const policies = questions.map(q => {
      if (q.group === 'RP') return '분포로 보기 · 대표 응답을 고르지 않고 각자의 선호 위치를 보여줍니다.';
      if (usesMajority(q)) return '최다 득표 기준 · 같은 응답이 가장 많은 선택을 표시하며, 동률은 함께 조율합니다. 미확인은 투표에서 제외합니다.';
      if (q.preparation) return '준비 가능 범위 기준 · 자료는 GM이 제공할 수 있는 가장 낮은 수준, 스탠딩은 참가자 선호 중 가장 낮은 수준을 표시합니다. 최소 필요 수준은 별도로 확인합니다.';
      if (q.boundary) return '경계 존중 기준 · 한 명이라도 포함하지 않기를 요청하면 제외하며, 사전협의는 동의가 아니라 대화가 필요하다는 뜻입니다.';
      if (q.type === 'trait') return '각자의 선호를 함께 확인합니다.';
      if (['O01', 'O02', 'maxHours'].includes(q.id)) return '참여 가능 범위 기준 · 회차와 휴식 간격은 가장 짧은 응답, 휴식 길이는 가장 긴 응답을 반영합니다.';
      if (q.id === 'role' || q.id === 'P04') return '개별 응답 기준 · 참가자별로 공유한 내용을 모두 표시합니다.';
      if (q.group === '표현과 소통' || ['O03', 'O04', 'O05', 'O07', 'O08', 'O09'].includes(q.id)) return '확인 범위 우선 · 사용·참여 범위가 더 좁거나 사전 확인이 필요한 응답을 먼저 반영합니다. 미확인과 별도 조건은 함께 조율합니다.';
      return '개별 응답 기준 · 응답을 한 가지 기준으로 정하기 어려우면 참가자별 내용을 함께 확인합니다.';
    });
    return [...new Set(policies)].join(' ');
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
  function groupAnalysis(profiles) {
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
      const interval = breaks.length ? Math.min(...breaks) : null;
      const duration = lengths.length ? Math.max(...lengths) : null;
      suggestions.push({ title: '휴식 주기', text: (interval ? '약 ' + interval + '분마다' : '필요할 때') + (duration ? ' ' + duration + '분 휴식' : ' 휴식'), details: personDetails(['O01', 'O02']), perPerson: true });
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
        if (wanted.length > 1 && new Set(wanted).size > 1) suggestions.push({ title: q.name, text: '가장 낮은 선호 수준을 기준으로 스탠딩 사용 범위를 함께 정해 주세요.', label: '스탠딩 선호 차이', details: answerGroups(profiles, q) });
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
  function governingAnswer(q, row, profiles) {
    const entries = profiles.map(profile => ({ label: cellLabel(q, profile, row), rank: constraintRank(q, profile, row), value: row ? A.valueOf(profile, q.id)?.[row] : A.valueOf(profile, q.id) }));
    if (usesMajority(q)) {
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
        return { label: '응답이 달라요', unknownCount, incomparableCount, constrained: false, differs };
      }
      return { label: limiting.label, unknownCount, incomparableCount, constrained: true, differs };
    }
    const labels = new Set(entries.map(entry => entry.label));
    return { label: labels.size === 1 ? entries[0].label : '응답이 달라요', unknownCount, incomparableCount: 0, constrained: false, differs };
  }
  function preparationRepresentative(q, profiles) {
    const allowed = new Set(q.options.map(([value]) => value));
    const values = q.id === 'A04'
      ? profiles.map(p => A.valueOf(p, q.id))
      : profiles.filter(p => ['GM', 'both'].includes(p.context.role)).map(p => p.responses[q.id]?.fields?.offered);
    const known = values.filter(value => allowed.has(value)).map(Number);
    const selected = known.length ? String(Math.min(...known)) : null;
    return { label: q.options.find(([value]) => value === selected)?.[1] || (q.id === 'A04' ? '미확인' : 'GM 응답 없음'), source: q.id === 'A04' ? '참가자 선호 중 가장 낮은 수준' : 'GM 제공 가능 중 가장 낮은 수준' };
  }
  globalThis.TRPGCompare = { groupAnalysis, cellLabel, dislikeEntries, constraintRank, governingAnswer, preparationRepresentative, comparisonAxes, comparisonRadar, comparisonAnswer, radarOverlap, sharedPlaystyle, usesMajority, criterionCopy };
  if (typeof document === 'undefined' || !document.querySelector('#comparison-output')) return;
  const { $ } = A;
  let people = [], nextId = 1, selected = new Set(), selectionTouched = false, activePerson = null;
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
      const notice = analysis.pending.find(item => item.title === q.name && item.label === '준비 범위 확인') || analysis.suggestions.find(item => item.title === q.name && ['준비 선호 차이', '스탠딩 선호 차이'].includes(item.label));
      const representative = preparationRepresentative(q, people.map(p => p.profile));
      const members = people.map(p => {
        const response = p.profile.responses[q.id];
        const minimum = response?.fields?.minimum;
        return '<li><span class="preparation-person">' + marker(p) + e(p.profile.displayName) + '</span><span class="preparation-values"><span>선호 <strong>' + e(answer(q, A.valueOf(p.profile, q.id))) + '</strong></span>' + (minimum !== undefined && minimum !== '' ? '<span>최소 필요 <strong>' + e(answer(q, minimum)) + '</strong></span>' : '') + '</span></li>';
      }).join('');
      const spoken = people.map(p => {
        const minimum = p.profile.responses[q.id]?.fields?.minimum;
        return p.profile.displayName + ': 선호 ' + answer(q, A.valueOf(p.profile, q.id)) + (minimum !== undefined && minimum !== '' ? ', 최소 필요 ' + answer(q, minimum) : '');
      }).join('; ');
      return '<tr class="preparation-row" tabindex="0" aria-label="' + e(q.name + ': ' + representative.label + '. ' + representative.source + '. 참가자별 선호와 최소 필요: ' + spoken) + '"><th scope="row">' + e(q.name) + '</th><td><strong class="preparation-primary">' + e(representative.label) + '</strong><span class="preparation-source">' + e(representative.source) + '</span><div id="preparation-details-' + e(q.id) + '" class="preparation-popover"><strong class="preparation-popover-title">참가자별 선호와 최소 필요</strong><ul class="preparation-people">' + members + '</ul>' + (notice ? '<p class="preparation-note">' + e(notice.text) + '</p>' : '') + '</div></td></tr>';
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
      if (q.id === 'P04') return '<tr><th scope="row">' + e(title) + '</th><td><ul class="all-dislikes">' + dislikeEntries(people.map(person => person.profile)).map((item, index) => '<li><strong>' + marker(people[index]) + e(item.name) + '</strong><span>' + e(item.text || '기재 없음 또는 공유하지 않음') + '</span></li>').join('') + '</ul></td></tr>';
      const governing = governingAnswer(q, row, people.map(p => p.profile));
      const answers = people.map(p => '<span class="answer-person"><strong>' + marker(p) + e(p.profile.displayName) + '</strong><span>' + e(cellLabel(q, p.profile, row)) + (p.profile.responses[q.id]?.note ? ' · ' + e(p.profile.responses[q.id].note) : '') + '</span></span>').join('');
      const notice = (governing.voteCount ? '<span class="vote-count">' + e(governing.voteCount) + '</span>' : '') + (governing.unknownCount ? '<span class="unconfirmed-count">미확인 ' + governing.unknownCount + '명</span>' : '') + (governing.incomparableCount ? '<span class="unconfirmed-count">별도 조율 ' + governing.incomparableCount + '명</span>' : '');
      const spoken = people.map(p => p.profile.displayName + ': ' + cellLabel(q, p.profile, row)).join('; ');
      return '<tr><th scope="row">' + e(title) + '</th><td><button type="button" class="group-answer" aria-label="' + e(title + ': ' + governing.label + '. 참가자별 응답: ' + spoken) + '"><span class="' + (governing.differs ? 'different-answer' : '') + '">' + e(governing.label) + '</span>' + notice + '<span class="answer-cue" aria-hidden="true">자세히</span><span class="answer-popover" aria-hidden="true"><span class="popover-title">참가자별 응답</span>' + answers + '</span></button>' + '</td></tr>' + (q.id === 'O02' && breakSummary ? summaryRow(breakSummary) : '');
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
      const criterion = '<p class="aggregation-copy">' + e(criterionCopy(questions)) + '</p>';
      if (group === 'RP') return '<section class="operation-group rp-group"><h3>RP</h3>' + criterion + rpDistributions(questions) + '</section>';
      if (['경계 확인', '표현과 소통'].includes(group)) return '<section class="operation-group boundary-group"><h3>' + e(group) + '</h3>' + questions.map(q => '<section class="boundary-subgroup" aria-labelledby="boundary-' + e(q.id) + '"><h4 id="boundary-' + e(q.id) + '">' + e(q.name) + '</h4><p class="aggregation-copy">' + e(criterionCopy([q])) + '</p>' + compactTable(rowsFor([q]), analysis, q.name + '의 세부 항목과 파티 응답') + '</section>').join('') + '</section>';
      if (group === '롤방 준비') return '<section class="operation-group preparation-group"><h3>' + e(group) + '</h3>' + criterion + preparationTable(questions, analysis) + '</section>';
      return '<section class="operation-group"><h3>' + e(group) + '</h3>' + criterion + compactTable(rowsFor(questions), analysis) + '</section>';
    }).join('');
  }
  function closePreparationDetails() {
    $('#group-tables').querySelectorAll('.preparation-row.is-open').forEach(row => row.classList.remove('is-open'));
  }
  $('#group-tables').addEventListener('click', event => {
    const row = event.target.closest('.preparation-row');
    if (!row) return;
    const opening = !row.classList.contains('is-open');
    closePreparationDetails();
    row.classList.toggle('is-open', opening);
  });
  document.addEventListener('click', event => {
    if (event.target.closest('.preparation-row')) return;
    closePreparationDetails();
  });
  document.addEventListener('keydown', event => {
    const row = event.target.closest?.('.preparation-row');
    if (row && ['Enter', ' '].includes(event.key)) { event.preventDefault(); row.classList.toggle('is-open'); return; }
    if (event.key !== 'Escape') return;
    closePreparationDetails();
    row?.blur();
  });
  function renderRadar() {
    const chosen = people.filter(p => selected.has(p.id));
    const radars = chosen.map(p => comparisonRadar(p.profile));
    $('#comparison-radar').closest('.comparison-radar-card').hidden = chosen.length === 0;
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
    $('#radar-data-summary').innerHTML = '<table><caption>선택한 참가자의 RP·운영 레이더 응답</caption><thead><tr><th>참가자</th>' + comparisonAxes.map(axis => '<th>' + e(axis.name) + '</th>').join('') + '</tr></thead><tbody>' + chosen.map(person => '<tr><th>' + e(person.profile.displayName) + '</th>' + comparisonAxes.map(axis => '<td>' + e(comparisonAnswer(person.profile, axis)) + '</td>').join('') + '</tr>').join('') + '</tbody></table>';
    const overlap = radarOverlap(radars);
    $('#radar-overlap-value').textContent = overlap === null ? '—' : overlap + '%';
    $('#radar-overlap-note').textContent = chosen.length < 2 ? '두 명 이상을 선택하면 공통 면적을 볼 수 있어요.' : overlap === null ? '미확인 축이 있어 면적을 계산할 수 없어요.' : '모두 겹치는 면적 ÷ 전체가 차지하는 면적. 취향의 우열이나 궁합 점수는 아니에요.';
    const common = sharedPlaystyle(chosen.map(person => person.profile));
    $('#party-common-note').textContent = chosen.length < 2 ? '두 명 이상을 선택하면 함께 선호하는 방식을 살펴볼 수 있어요.' : '선택한 참가자 모두가 가진 세션 취향 카드만 표시해요. 응답이 완전히 같을 필요는 없어요.';
    const commonItem = item => '<article class="common-item"><h4>' + e(item.title) + '</h4><p>' + e(item.text) + '</p><small>' + e(item.evidence) + '</small></article>';
    $('#party-common-list').innerHTML = common.length ? common.slice(0, 3).map(commonItem).join('') + (common.length > 3 ? '<details class="common-more"><summary>공통점 더 보기 (' + (common.length - 3) + ')</summary>' + common.slice(3).map(commonItem).join('') + '</details>' : '') : chosen.length >= 2 ? '<p class="common-empty">아직 함께 가진 세션 취향 카드가 없어요. 아래 분포에서 각자의 선호를 살펴보세요.</p>' : '';
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
      container.querySelector('.export-heading .section-copy').textContent = '이 참가자의 결과 JSON을 저장해 파티 비교에 다시 불러올 수 있어요.';
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
    const analysis = groupAnalysis(people.map(p => p.profile));
    renderRadar(); renderTables(analysis);
    const topics = [...analysis.restrictions.map(item => ({ ...item, label: '존중할 경계' })), ...analysis.pending, ...analysis.suggestions.filter(item => item.label)];
    $('#party-conversation-list').innerHTML = topics.length ? topics.slice(0, 3).map(item => '<article><p class="conversation-label">' + e(item.label || '함께 확인') + '</p><h3>' + e(item.title) + '</h3><p>' + e(item.text || '사전협의는 동의가 아니에요. 세션 전에 각자의 범위를 함께 확인해주세요.') + '</p></article>').join('') + (topics.length > 3 ? '<a class="conversation-more" href="#group-tables">전체 응답에서 나머지 항목 확인 ↗</a>' : '') : '<article class="conversation-empty"><h3>' + (people.length < 2 ? '동료의 결과를 더해보세요.' : '서로의 응답을 천천히 읽어보세요.') + '</h3><p>아래 전체 응답에서 편안한 세션의 조건을 함께 정할 수 있어요.</p></article>';
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
        if (file.size > 2_000_000) throw new Error('파일은 2MB 이하로 불러와 주세요.');
        add(JSON.parse(await file.text())); added++;
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
