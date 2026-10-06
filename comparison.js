/* n명 비교: 전체 분포와 조건표를 기본으로, 레이더는 선택한 사람만 표시합니다. */
(() => {
  'use strict';
  const A = globalThis.TRPGApp;
  const { D, escape: e } = A;
  const unresolved = v => v === undefined || ['unknown', 'private', 'other', 'conditional'].includes(v);
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
    if (radars.length < 2 || radars.some(radar => D.axes.some(axis => !A.known(radar[axis.key])))) return null;
    const directions = D.axes.map((_, i) => {
      const angle = -Math.PI / 2 + i * Math.PI * 2 / D.axes.length;
      return [Math.cos(angle), Math.sin(angle)];
    });
    let intersection = 0, union = 0;
    for (let axis = 0; axis < D.axes.length; axis++) {
      const next = (axis + 1) % D.axes.length;
      const triangles = radars.map(radar => {
        const first = radar[D.axes[axis].key] / 100, second = radar[D.axes[next].key] / 100;
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
  function groupAnalysis(profiles) {
    const restrictions = [], pending = [], suggestions = [];
    for (const q of D.boundaries) for (const [row, name] of q.rows) {
      const vals = profiles.map(p => A.valueOf(p, q.id)?.[row]);
      if (vals.includes('no')) restrictions.push({ title: name + ' · 포함하지 않음', text: '이 소재나 전개는 제외합니다.' });
      else if (vals.includes('ask')) pending.push({ title: name + ' · 사전 대화', text: '포함하려면 먼저 범위를 정해야 합니다.', label: '사전 대화' });
      else if (vals.some(unresolved)) pending.push({ title: name + ' · 답변 없음·미공유', text: '답변이 없거나 공유되지 않았습니다.', label: '답변 없음·미공유' });
    }
    const values = id => profiles.map(p => A.valueOf(p, id));
    const breaks = values('O01').map(Number).filter(v => Number.isFinite(v) && v > 0);
    const lengths = values('O02').map(Number).filter(v => Number.isFinite(v) && v > 0);
    if (breaks.length || lengths.length) {
      const interval = breaks.length ? Math.min(...breaks) : null;
      const duration = lengths.length ? Math.max(...lengths) : null;
      suggestions.push({ title: '휴식 주기', text: (interval ? '약 ' + interval + '분마다' : '필요할 때') + (duration ? ' ' + duration + '분 휴식' : ' 휴식') });
    }
    const schedules = ['O13', 'O14'];
    schedules.forEach(id => {
      const nums = values(id).map(Number).filter(v => Number.isFinite(v) && v > 0);
      if (nums.length) suggestions.push({ title: D.operation.find(q => q.id === id).name, text: Math.max(...nums) + '일 전' });
    });
    const durations = values('maxHours').map(Number).filter(v => Number.isFinite(v) && v > 0);
    if (durations.length) suggestions.push({ title: '회차 길이', text: '휴식 포함 최대 ' + Math.min(...durations) + '시간' });
    const spreads = D.axes.map(axis => {
      const vals = profiles.map(p => p.radar[axis.key]).filter(A.known);
      return { axis, count: vals.length, spread: vals.length > 1 ? Math.max(...vals) - Math.min(...vals) : 0 };
    });
    const divergent = spreads.filter(s => s.count > 1 && s.spread >= 50).sort((a, b) => b.spread - a.spread);
    divergent.forEach(({ axis }) => suggestions.push({ title: axis.name + ' 차이', text: '선호하는 방향이 다릅니다.' }));
    D.operation.filter(q => q.preparation).forEach(q => {
      const wanted = profiles.map(p => Number(A.valueOf(p, q.id))).filter(v => Number.isInteger(v) && v >= 0);
      const providers = profiles.filter(p => ['GM', 'both'].includes(p.context.role));
      const offered = providers.map(p => p.responses[q.id]?.fields?.offered).filter(v => v !== undefined && v !== '').map(Number);
      const minimum = profiles.map(p => p.responses[q.id]?.fields?.minimum).filter(v => v !== undefined && v !== '').map(Number);
      if (offered.length && minimum.some(v => v > Math.max(...offered))) pending.push({ title: q.name + ' · 준비 수준 차이', text: '필요 수준이 GM 제공 수준보다 높습니다.', label: '준비 수준 차이' });
      else if (wanted.length > 1 && new Set(wanted).size > 1) suggestions.push({ title: q.name + ' · 선호 차이', text: '원하는 준비 수준이 다릅니다.' });
    });
    return { restrictions, pending, suggestions };
  }
  function cellLabel(q, p, row) {
    if (row) {
      const value = A.valueOf(p, q.id)?.[row];
      return value === 'unknown' ? '모르겠음' : value === 'private' ? '비공개' : q.options.find(o => o[0] === value)?.[1] || '미확인';
    }
    let text = A.answerLabel(q, A.response(p, q.id));
    const fields = A.fieldLabels(q, A.response(p, q.id), p.context.role);
    if (fields.length) text += ' · ' + fields.join(' · ');
    return text;
  }
  function constraintRank(q, p, row) {
    const value = row ? A.valueOf(p, q.id)?.[row] : A.valueOf(p, q.id);
    if (q.boundary || q.id === 'O07') return { ok: 1, ask: 2, no: 3 }[value] ?? null;
    if (q.id === 'maxHours' || q.id === 'O01') return /^\d+$/.test(value ?? '') ? -Number(value) : null;
    if (['O02', 'O13', 'O14'].includes(q.id)) return /^\d+$/.test(value ?? '') ? Number(value) : null;
    if (q.id === 'O16') return { now: 1, day: 2, three: 3, week: 4 }[value] ?? null;
    if (q.id === 'P03') return { '1-3': 1, '5+': 2, '10+': 3 }[value] ?? null;
    return null;
  }
  globalThis.TRPGCompare = { groupAnalysis, cellLabel, constraintRank, radarOverlap };
  if (typeof document === 'undefined' || !document.querySelector('#comparison-output')) return;
  const { $ } = A;
  let people = [], nextId = 1, selected = new Set(), selectionTouched = false;
  const style = person => ({ color: A.COLORS[(person.id - 1) % 6], shape: A.SHAPES[(person.id - 1) % 6] });
  const marker = person => '<span class="person-symbol" style="color:' + style(person).color + '">' + style(person).shape + '</span>';
  function setMessage(message, error = false) {
    $('#import-message').textContent = message;
    $('#import-message').classList.toggle('error-message', error);
  }
  function add(raw) {
    const profile = A.validateProfile(raw);
    people.push({ id: nextId++, profile });
    if (!selectionTouched) selected = new Set(people.length <= 5 ? people.map(p => p.id) : []);
  }
  function distribution(axis) {
    const values = people.filter(p => A.known(p.profile.radar[axis.key]));
    const groups = new Map();
    values.forEach(person => {
      const value = person.profile.radar[axis.key];
      if (!groups.has(value)) groups.set(value, []);
      groups.get(value).push(person);
    });
    const missing = people.length - values.length;
    const points = [...groups.entries()].map(([value, members]) => '<button type="button" class="distribution-marker" style="left:' + value + '%" aria-label="' + e(axis.name + ' 좌표 ' + value + ': ' + members.map(p => p.profile.displayName).join(', ')) + '" title="' + e(members.map(p => p.profile.displayName).join(', ')) + '">' + (members.length > 1 ? '<span class="cluster-count">' + members.length + '</span>' : marker(members[0])) + '</button>').join('');
    const table = '<div class="table-scroll"><table><caption>' + axis.name + ' 참가자별 위치와 응답</caption><thead><tr><th>참가자</th><th>선호 방향</th><th>문항 응답</th></tr></thead><tbody>' + people.map(p => '<tr><th>' + e(p.profile.displayName) + '</th><td>' + e(A.dimensionLabel(p.profile, axis.key)) + '</td><td>' + D.traits.filter(q => q.axis === axis.key).map(q => e(A.answerLabel(q, A.response(p.profile, q.id)))).join('<br>') + '</td></tr>').join('') + '</tbody></table></div>';
    return '<article class="distribution-card"><div class="axis-heading"><h3>' + axis.name + '</h3><span>' + values.length + '명 응답' + (missing ? ' · ' + missing + '명 좌표 미확인' : '') + '</span></div><div class="distribution-track">' + points + '</div><div class="axis-ends"><span>' + axis.left + '</span><span>' + axis.right + '</span></div><details><summary>참가자별 응답 보기</summary>' + table + '</details></article>';
  }
  function rowsFor(questions) {
    return questions.flatMap(q => q.type === 'matrix' ? q.rows.map(([row, title]) => ({ q, row, title: q.name + ' · ' + title })) : [{ q, title: q.name }]);
  }
  function fullTable(rows) {
    return '<div class="table-scroll"><table><caption>전체 참가자의 응답과 조건</caption><thead><tr><th>항목</th>' + people.map(p => '<th>' + marker(p) + e(p.profile.displayName) + '</th>').join('') + '</tr></thead><tbody>' + rows.map(({ q, row, title }) => {
      const ranks = people.map(p => constraintRank(q, p.profile, row)).filter(rank => rank !== null);
      const limit = ranks.length > 1 ? Math.max(...ranks) : null;
      return '<tr><th>' + e(title) + '</th>' + people.map(p => {
        const label = e(cellLabel(q, p.profile, row));
        const answer = limit !== null && constraintRank(q, p.profile, row) === limit ? '<strong class="limiting-answer">' + label + '</strong>' : label;
        return '<td>' + answer + (p.profile.responses[q.id]?.note ? '<p class="table-note">' + e(p.profile.responses[q.id].note) + '</p>' : '') + '</td>';
      }).join('') + '</tr>';
    }).join('') + '</tbody></table></div>';
  }
  function summaryTable(rows) {
    return '<div class="table-scroll"><table><caption>많은 참가자의 전체 응답 분포</caption><thead><tr><th>항목</th><th>응답별 인원</th></tr></thead><tbody>' + rows.map(({ q, row, title }) => {
      const counts = new Map();
      const ranks = people.map(p => constraintRank(q, p.profile, row)).filter(rank => rank !== null);
      const limit = ranks.length > 1 ? Math.max(...ranks) : null;
      people.forEach(p => {
        const label = cellLabel(q, p.profile, row);
        const item = counts.get(label) || { count: 0, limiting: false };
        item.count++;
        item.limiting ||= limit !== null && constraintRank(q, p.profile, row) === limit;
        counts.set(label, item);
      });
      return '<tr><th>' + e(title) + '</th><td>' + [...counts].map(([label, item]) => '<span class="count-chip' + (item.limiting ? ' limiting-answer' : '') + '">' + e(label) + ' · ' + item.count + '명</span>').join(' ') + '</td></tr>';
    }).join('') + '</tbody></table></div><details><summary>이 구간의 참가자별 전체 표 보기</summary>' + fullTable(rows) + '</details>';
  }
  function renderTables() {
    const groups = [...new Set([...D.setup, ...D.operation, ...D.boundaries].map(q => q.group))];
    $('#group-tables').innerHTML = groups.map(group => {
      const rows = rowsFor([...D.setup, ...D.operation, ...D.boundaries].filter(q => q.group === group));
      return '<section class="operation-group"><h3>' + group + '</h3>' + (people.length > 6 ? summaryTable(rows) : fullTable(rows)) + '</section>';
    }).join('');
  }
  function renderRadar() {
    const chosen = people.filter(p => selected.has(p.id));
    $('#comparison-radar').closest('.comparison-radar-card').hidden = chosen.length === 0;
    $('#radar-selection-copy').textContent = chosen.length ? chosen.map(p => p.profile.displayName).join(' · ') : '전체 분포를 먼저 읽고, 최대 6명을 선택해 레이더를 비교하세요.';
    A.drawRadar($('#comparison-radar'), chosen.map(p => ({ id: p.id, data: p.profile.radar, index: p.id - 1, color: style(p).color })));
    $('#selected-legend').innerHTML = chosen.map(p => '<span class="legend-item">' + marker(p) + e(p.profile.displayName) + '</span>').join('');
    $('#radar-data-summary').innerHTML = chosen.map(p => '<p><strong>' + e(p.profile.displayName) + '</strong> · ' + D.axes.map(a => a.name + ': ' + e(A.dimensionLabel(p.profile, a.key))).join(' · ') + '</p>').join('');
    const overlap = radarOverlap(chosen.map(p => p.profile.radar));
    $('#radar-overlap-value').textContent = overlap === null ? '—' : overlap + '%';
    $('#radar-overlap-note').textContent = chosen.length < 2 ? '두 명 이상을 선택하면 공통 면적을 볼 수 있어요.' : overlap === null ? '미확인 축이 있거나 면적이 없어 계산할 수 없어요.' : '선택한 ' + chosen.length + '명의 레이더가 모두 겹치는 면적 ÷ 전체가 차지하는 면적';
  }
  function renderParticipants() {
    $('#legend').innerHTML = people.map(p => '<div class="participant-control"><label><input type="checkbox" aria-label="레이더에 표시: ' + e(p.profile.displayName) + '" data-person="' + p.id + '"' + (selected.has(p.id) ? ' checked' : '') + '>' + marker(p) + '</label><input class="participant-name" aria-label="참가자 ' + p.id + ' 이름" data-name="' + p.id + '" maxlength="80" value="' + e(p.profile.displayName) + '"><button class="remove-person" type="button" data-remove="' + p.id + '" aria-label="' + e(p.profile.displayName) + ' 제거">×</button></div>').join('');
    $('#legend').querySelectorAll('[data-person]').forEach(input => input.addEventListener('change', () => {
      const id = Number(input.dataset.person);
      if (input.checked && selected.size >= 6) { input.checked = false; $('#selection-message').textContent = '레이더는 최대 6명까지 선택할 수 있어요. 전체 분포와 운영표에는 모두 포함됩니다.'; return; }
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
    if (!people.length) { selected.clear(); selectionTouched = false; return; }
    renderParticipants();
    const analysis = groupAnalysis(people.map(p => p.profile));
    const cards = [...analysis.restrictions.map(c => ({ ...c, kind: 'restriction', label: '제외할 항목' })), ...analysis.pending.map(c => ({ ...c, kind: 'pending' })), ...analysis.suggestions.map(c => ({ ...c, kind: 'suggestion', label: '운영 기준' }))];
    const cardHTML = c => '<article class="alignment-card ' + c.kind + '"><p class="label">' + c.label + '</p><h3>' + e(c.title) + '</h3><p>' + e(c.text) + '</p></article>';
    $('#alignment-title').textContent = people.length === 1 ? '한 명 더 불러오면 파티를 비교할 수 있어요.' : '필요한 조건과 경계를 먼저 확인하세요.';
    $('#alignment-notes').innerHTML = cards.slice(0, 4).map(cardHTML).join('') || '<p>현재 응답에서 비교할 조건이 충분하지 않습니다. 미확인 항목을 먼저 나눠주세요.</p>';
    $('#all-alignment').innerHTML = cards.slice(4).map(cardHTML).join('');
    $('#all-alignment-details').hidden = cards.length <= 4;
    $('#axis-distributions').innerHTML = D.axes.map(distribution).join('');
    $('#axis-distributions').querySelectorAll('.distribution-marker').forEach(button => button.onclick = () => { button.closest('article').querySelector('details').open = true; });
    renderRadar(); renderTables();
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
