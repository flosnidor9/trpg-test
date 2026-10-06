/* n명 비교: 전체 분포와 조건표를 기본으로, 레이더는 선택한 사람만 표시합니다. */
(() => {
  'use strict';
  const A = globalThis.TRPGApp;
  const { D, escape: e } = A;
  const unresolved = v => v === undefined || ['unknown', 'private', 'other', 'conditional'].includes(v);
  function groupAnalysis(profiles) {
    const restrictions = [], pending = [], suggestions = [];
    for (const q of D.boundaries) for (const [row, name] of q.rows) {
      const vals = profiles.map(p => A.valueOf(p, q.id)?.[row]);
      if (vals.includes('no')) restrictions.push({ title: name + ' · 포함하지 않음', text: '이 항목을 포함하지 않는 운영안을 기준으로 정합니다. 다른 선호나 다수결로 이 경계를 상쇄하지 않습니다.' });
      else if (vals.includes('ask')) pending.push({ title: name + ' · 사전 대화 필요', text: '구체적인 범위와 장면을 확인하기 전에는 포함하지 않습니다. 모두 같은 답이어도 허용 완료가 아닙니다.' });
      else if (vals.some(unresolved)) pending.push({ title: name + ' · 미확인 응답 있음', text: '공유되지 않았거나 아직 판단하지 않은 범위가 있습니다. 다른 사람의 허용으로 대신하지 말고 당사자가 선택한 방법으로 확인해주세요.' });
    }
    const values = id => profiles.map(p => A.valueOf(p, id));
    const breaks = values('O01').map(Number).filter(v => Number.isFinite(v) && v > 0);
    const lengths = values('O02').map(Number).filter(v => Number.isFinite(v) && v > 0);
    const needs = profiles.filter(p => p.responses.O01?.fields?.need === 'need' && !unresolved(A.valueOf(p, 'O01')));
    if (breaks.length || lengths.length) {
      const interval = breaks.length ? Math.min(...breaks) : null;
      const duration = lengths.length ? Math.max(...lengths) : null;
      suggestions.push({ title: '휴식 주기 확인', text: (interval ? '약 ' + interval + '분마다' : '필요할 때') + (duration ? ' ' + duration + '분 휴식' : ' 쉬는 방식') + '을 초안으로 확인해볼 수 있습니다. ' + (needs.length ? '참여에 필요한 휴식 조건이 있으므로 평균 간격으로 덮지 않습니다. ' : '선호를 바탕으로 한 초안이며 합의 완료가 아닙니다. ') + (breaks.length < profiles.length ? '정기 간격 미확인·필요 시 휴식 응답도 따로 확인해주세요.' : '') });
    }
    const schedules = ['O13', 'O14'];
    schedules.forEach(id => {
      const nums = values(id).map(Number).filter(v => Number.isFinite(v) && v > 0);
      if (nums.length) suggestions.push({ title: D.operation.find(q => q.id === id).name, text: '가장 이른 준비 기준은 ' + Math.max(...nums) + '일 전입니다. 필요한 조건인지 선호인지 구분하고 ' + (id === 'O13' ? '후보 공유일' : '최종 확정일') + '을 함께 정해주세요. 고정 일정·미확인 응답은 별도로 확인합니다.' });
    });
    const durations = values('maxHours').map(Number).filter(v => Number.isFinite(v) && v > 0);
    if (durations.length) suggestions.push({ title: '회차 길이', text: '최대 참여 시간 중 가장 짧은 응답은 약 ' + Math.min(...durations) + '시간입니다. 휴식을 포함해 이 범위에서 진행할 수 있는지 확인해주세요.' });
    const medium = new Set(values('medium').filter(v => !unresolved(v)));
    if (medium.size > 1) pending.unshift({ title: '진행 매체가 다른 응답', text: '보이스·실시간 텍스트·비동기 텍스트의 선호가 함께 있습니다. 이번 세션의 기준을 먼저 정하고 RP 템포를 비교해주세요.' });
    const formats = values('format').filter(v => !unresolved(v));
    if (formats.includes('online') && formats.includes('offline')) pending.unshift({ title: '플레이 환경 확인', text: '온라인만 가능한 응답과 오프라인만 가능한 응답이 함께 있습니다. 현재 응답만으로 공통 환경이 확인되지 않습니다.' });
    const spreads = D.axes.map(axis => {
      const vals = profiles.map(p => p.radar[axis.key]).filter(A.known);
      return { axis, count: vals.length, spread: vals.length > 1 ? Math.max(...vals) - Math.min(...vals) : 0 };
    });
    const divergent = spreads.filter(s => s.count > 1 && s.spread >= 50).sort((a, b) => b.spread - a.spread);
    divergent.forEach(({ axis }) => suggestions.push({ title: axis.name + '의 선호 방향 확인', text: '“' + axis.left + '”와 “' + axis.right + '” 쪽의 응답이 함께 있습니다. ' + globalThis.TRPGNarratives.stories[axis.key].talk }));
    D.operation.filter(q => q.preparation).forEach(q => {
      const wanted = profiles.map(p => Number(A.valueOf(p, q.id))).filter(v => Number.isInteger(v) && v >= 0);
      const providers = profiles.filter(p => ['GM', 'both'].includes(p.context.role));
      const offered = providers.map(p => p.responses[q.id]?.fields?.offered).filter(v => v !== undefined && v !== '').map(Number);
      const minimum = profiles.map(p => p.responses[q.id]?.fields?.minimum).filter(v => v !== undefined && v !== '').map(Number);
      if (offered.length && minimum.some(v => v > Math.max(...offered))) pending.push({ title: q.name + '의 준비 범위 확인', text: '최소 필요 수준과 GM이 제공할 수 있다고 표시한 수준이 다릅니다. 분담하거나 준비 범위를 바꿀 수 있는지 함께 확인해주세요.' });
      else if (wanted.length > 1 && new Set(wanted).size > 1) suggestions.push({ title: q.name + '의 선호와 제공 범위', text: '원하는 준비 수준이 서로 다릅니다. 최소 필요와 실제 제공 가능한 수준을 구분해 공통 준비안을 확인해주세요.' });
    });
    const common = spreads.filter(s => s.count === profiles.length && s.spread <= 25 && profiles.every(p => p.dimensions[s.axis.key].spread < 50 && !p.dimensions[s.axis.key].conditional));
    const paragraphs = [];
    if (profiles.length === 1) paragraphs.push('한 명의 결과를 불러왔습니다. 현재는 개인의 선호와 확인할 조건을 볼 수 있으며, 한 명 더 추가하면 파티의 공통점과 차이를 비교할 수 있어요.');
    else {
      paragraphs.push(common.length ? '이 파티에서는 ' + common.map(s => s.axis.name).join('·') + '의 응답이 비교적 가까운 방향에 모여 있습니다. 비슷한 좌표는 운영 합의가 끝났다는 뜻이 아니며, 각자 적어둔 조건도 함께 확인해야 합니다.' : '여러 선호가 함께 있는 파티입니다. 평균값 하나로 파티를 설명하기보다 각 축의 분포와 실제 응답을 함께 읽어주세요. 선호 차이는 사람의 적합도나 실력 차이가 아닙니다.');
      if (divergent.length) paragraphs.push('먼저 맞춰볼 RP 항목은 ' + divergent.slice(0, 3).map(s => s.axis.name).join('·') + '입니다. 양끝의 응답이 함께 있어 기본 호흡과 적용 조건을 정하는 대화가 도움이 될 수 있습니다. 준비 시간이 필요한 장면, 차례를 여는 계기, 마무리 신호를 각각 확인해보세요.');
      if (restrictions.length || pending.length) paragraphs.push('포함하지 않을 범위와 사전 확인할 항목이 있습니다. 이것은 누구의 선호가 더 좋은지를 정하는 과정이 아닙니다. 필요한 조건과 경계를 먼저 확인하고, 제공 가능한 운영안을 바탕으로 각자의 수용 여부를 확인해주세요.');
    }
    return { restrictions, pending, suggestions, paragraphs };
  }
  function cellLabel(q, p, row) {
    if (row) {
      const value = A.valueOf(p, q.id)?.[row];
      return q.options.find(o => o[0] === value)?.[1] || '미확인';
    }
    let text = A.answerLabel(q, A.response(p, q.id));
    const fields = A.fieldLabels(q, A.response(p, q.id), p.context.role);
    if (fields.length) text += ' · ' + fields.join(' · ');
    return text;
  }
  globalThis.TRPGCompare = { groupAnalysis, cellLabel };
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
    return '<div class="table-scroll"><table><caption>전체 참가자의 응답과 조건</caption><thead><tr><th>항목</th>' + people.map(p => '<th>' + marker(p) + e(p.profile.displayName) + '</th>').join('') + '</tr></thead><tbody>' + rows.map(({ q, row, title }) => '<tr><th>' + e(title) + '</th>' + people.map(p => '<td>' + e(cellLabel(q, p.profile, row)) + (p.profile.responses[q.id]?.note ? '<p class="table-note">' + e(p.profile.responses[q.id].note) + '</p>' : '') + '</td>').join('') + '</tr>').join('') + '</tbody></table></div>';
  }
  function summaryTable(rows) {
    return '<div class="table-scroll"><table><caption>많은 참가자의 전체 응답 분포</caption><thead><tr><th>항목</th><th>응답별 인원</th></tr></thead><tbody>' + rows.map(({ q, row, title }) => {
      const counts = new Map();
      people.forEach(p => { const label = cellLabel(q, p.profile, row); counts.set(label, (counts.get(label) || 0) + 1); });
      return '<tr><th>' + e(title) + '</th><td>' + [...counts].map(([label, n]) => '<span class="count-chip">' + e(label) + ' · ' + n + '명</span>').join(' ') + '</td></tr>';
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
    $('#group-story').innerHTML = analysis.paragraphs.map(text => '<p>' + e(text) + '</p>').join('');
    const cards = [...analysis.restrictions.map(c => ({ ...c, kind: 'restriction', label: '적용할 경계' })), ...analysis.pending.map(c => ({ ...c, kind: 'pending', label: '확인 필요' })), ...analysis.suggestions.map(c => ({ ...c, kind: 'suggestion', label: '운영 초안' }))];
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
