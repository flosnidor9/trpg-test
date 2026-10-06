/* 공통 계산, 로컬 결과 화면. 질문 진행은 test-flow.js에서만 처리합니다. */
(() => {
  'use strict';
  const D = globalThis.TRPGData;
  const N = globalThis.TRPGNarratives;
  const STORAGE = 'trpg-playstyle-profile';
  const LEGACY_REMOVED = new Set(['T2', 'D2', 'E2', 'S2', 'I2', 'M2', 'D1', 'E1', 'basis', 'medium', 'format', 'groupSize', 'A05', 'O05', 'O09', 'O10', 'O14']);
  const COLORS = ['#6547da', '#a54b31', '#24786c', '#876316', '#3161a2', '#964577'];
  const SHAPES = ['●', '■', '▲', '◆', '✚', '⬟'];
  const $ = selector => document.querySelector(selector);
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const questionById = id => D.questions.find(q => q.id === id);
  const response = (p, id) => p.responses?.[id];
  const valueOf = (p, id) => response(p, id)?.value;
  const known = value => typeof value === 'number' && Number.isFinite(value);
  const isObject = x => x !== null && typeof x === 'object' && !Array.isArray(x);
  const optionsFor = q => q.options;
  function fieldsFor(q, role) {
    if (q.type === 'text') return [];
    return [...(q.fields || []).filter(f => !f.gmOnly || role === 'GM' || role === 'both'), ...D.commonFields];
  }
  function makeProfile(responses, name = '나의 모험가', createdAt = new Date().toISOString()) {
    const dimensions = {};
    const radar = {};
    for (const axis of D.axes) {
      const items = D.traits.filter(q => q.axis === axis.key);
      const vals = items.map(q => responses[q.id]?.value).filter(known);
      const conditions = items.filter(q => responses[q.id]?.value === 'conditional');
      const spread = vals.length > 1 ? Math.max(...vals) - Math.min(...vals) : 0;
      const value = vals.length ? vals.reduce((sum, v) => sum + v, 0) / vals.length : null;
      radar[axis.key] = value;
      dimensions[axis.key] = { value, count: vals.length, spread, conditional: conditions.length };
    }
    const context = Object.fromEntries(D.setup.map(q => [q.id, responses[q.id]?.value ?? 'unknown']));
    return {
      schemaVersion: '3.0', questionnaireVersion: D.version,
      displayName: String(name || '나의 모험가').slice(0, 80), context, responses,
      radar, dimensions, createdAt
    };
  }
  function validateProfile(raw) {
    if (!isObject(raw)) throw new Error('JSON의 최상위 값은 결과 객체여야 해요.');
    if (raw.schemaVersion !== '3.0') throw new Error('이전 설계의 결과는 새 5축과 의미가 달라 함께 비교할 수 없어요. 새 테스트 결과를 불러와 주세요.');
    const priorToV5 = ['rp-2026-10-v1', 'rp-2026-10-v2', 'rp-2026-10-v3', 'rp-2026-10-v4'].includes(raw.questionnaireVersion);
    const previousVersion = priorToV5 || raw.questionnaireVersion === 'rp-2026-10-v5';
    const earlyVersion = ['rp-2026-10-v1', 'rp-2026-10-v2'].includes(raw.questionnaireVersion);
    if (raw.questionnaireVersion !== D.version && !previousVersion && raw.questionnaireVersion !== 'rp-2026-10-v6') throw new Error('문항 버전이 다른 결과예요. 현재 테스트로 다시 답해주세요.');
    if (!isObject(raw.responses)) throw new Error('문항별 응답이 없는 결과예요.');
    if (raw.displayName !== undefined && (typeof raw.displayName !== 'string' || raw.displayName.length > 80)) throw new Error('이름은 80자 이내의 문자열이어야 해요.');
    if (!isObject(raw.radar) || !D.axes.every(a => raw.radar[a.key] === null || (known(raw.radar[a.key]) && raw.radar[a.key] >= 0 && raw.radar[a.key] <= 100))) throw new Error('성향 좌표는 0–100의 유한한 수 또는 미확인 값이어야 해요.');
    const clean = {};
    for (const [id, answer] of Object.entries(raw.responses)) {
      if (previousVersion && ((priorToV5 && LEGACY_REMOVED.has(id)) || (earlyVersion && id === 'A04') || (id === 'O04' && isObject(answer?.value) && Object.values(answer.value).includes('ok')) || (id === 'O01' && !['120', '240', '360', '480', 'asNeeded'].includes(answer?.value)) || ['unknown', 'conditional'].includes(answer?.value) || (priorToV5 && answer?.value === 'other'))) continue;
      const q = questionById(id);
      if (!q || !isObject(answer)) throw new Error('알 수 없는 문항이나 올바르지 않은 응답이 있어요.');
      const allowed = q.options.map(o => o[0]);
      if (q.type === 'text') {
        if (typeof answer.value !== 'string' || answer.value.length > 2000) throw new Error('자유 입력은 2,000자 이내의 문자열이어야 해요.');
        clean[id] = { value: answer.value };
      } else if (q.type === 'matrix' && isObject(answer.value)) {
        const cells = {};
        for (const [row, v] of Object.entries(answer.value)) {
          if (!q.rows.some(r => r[0] === row)) throw new Error('세부 항목의 응답 값이 올바르지 않아요.');
          if (previousVersion && ((id === 'C03' && priorToV5 && v === 'na') || (id === 'C02' && v === 'ok'))) continue;
          if (!allowed.includes(v) && v !== 'unknown' && !(q.boundary && v === 'private')) throw new Error('세부 항목의 응답 값이 올바르지 않아요.');
          cells[row] = v;
        }
        clean[id] = { value: cells };
      } else {
        if (!allowed.includes(answer.value)) throw new Error('문항의 선택지에 없는 응답이 있어요.');
        clean[id] = { value: answer.value };
      }
      if (answer.note !== undefined) {
        if (typeof answer.note !== 'string' || answer.note.length > 2000) throw new Error('추가 내용은 2,000자 이내의 문자열이어야 해요.');
        clean[id].note = answer.note;
      }
      if (answer.fields !== undefined) {
        if (!isObject(answer.fields)) throw new Error('추가 조건의 형식이 올바르지 않아요.');
        clean[id].fields = {};
        for (const [key, val] of Object.entries(answer.fields)) {
          const field = (q.fields || []).find(f => f.key === key);
          if (previousVersion && !field) continue;
          if (!field || (typeof val !== 'string' && typeof val !== 'number') || String(val).length > 2000) throw new Error('추가 조건의 값이 올바르지 않아요.');
          if (field.type === 'select' && val !== '' && !field.options.some(o => o[0] === val)) throw new Error('추가 선택지 값이 올바르지 않아요.');
          if (field.type === 'number' && val !== '' && (!known(Number(val)) || !Number.isInteger(Number(val)) || Number(val) < field.min || Number(val) > field.max)) throw new Error('인원 범위가 올바르지 않아요.');
          // 상위 응답에 적용되지 않는 조건은 보존하거나 비교에 사용하지 않습니다.
          if (!field.when || answer.value === field.when) clean[id].fields[key] = val;
        }
      }
    }
    // 가져온 계산 결과를 신뢰하지 않고 공유된 응답으로 다시 계산합니다.
    return makeProfile(clean, raw.displayName, typeof raw.createdAt === 'string' ? raw.createdAt.slice(0, 40) : undefined);
  }
  function exportProfile(p, { boundaries = false, notes = false } = {}) {
    const clean = {};
    for (const q of D.questions) {
      const a = response(p, q.id);
      if (!a || (q.boundary && !boundaries) || (q.type === 'text' && (!notes || !a.value?.trim()))) continue;
      const item = { value: a.value };
      if (q.type === 'matrix' && isObject(a.value)) {
        item.value = Object.fromEntries(Object.entries(a.value).filter(([, v]) => v !== 'private'));
        if (!Object.keys(item.value).length) continue;
      }
      // 개인 일정·자유 입력·캐릭터 정보는 명시적으로 포함할 때만 공유합니다.
      if (a.fields) {
        item.fields = Object.fromEntries(Object.entries(a.fields).filter(([key]) => {
          const f = (q.fields || []).find(x => x.key === key);
          return f && (notes || f.type === 'select' || f.type === 'number') && (!f.when || a.value === f.when) && (!f.gmOnly || ['GM', 'both'].includes(p.context.role));
        }));
      }
      if (notes && a.note && !q.boundary) item.note = a.note;
      if (notes && a.note && q.boundary && !Object.values(a.value || {}).includes('private')) item.note = a.note;
      clean[q.id] = item;
    }
    return makeProfile(clean, p.displayName, p.createdAt);
  }
  function answerLabel(q, answer) {
    if (!answer) return '미확인';
    const v = answer.value;
    if (q.type === 'text') return v.trim() || '기재 없음';
    if (v === 'unknown') return '아직 판단하지 않음';
    if (v === 'conditional') return '상황에 따라 선호가 다름';
    if (v === 'other') return '다른 방식이 필요함';
    if (q.type === 'matrix' && isObject(v)) return q.rows.map(([key, name]) => {
      const text = v[key] === 'unknown' ? '모르겠음' : v[key] === 'private' ? '비공개' : q.options.find(o => o[0] === v[key])?.[1] || '미확인';
      return name + ': ' + text;
    }).join(' · ');
    return q.options.find(o => o[0] === v)?.[1] || '미확인';
  }
  function fieldLabels(q, a, role) {
    return (q.fields || []).filter(f => a?.fields?.[f.key] !== undefined && a.fields[f.key] !== '' && (!f.when || a.value === f.when) && (!f.gmOnly || ['GM', 'both'].includes(role))).map(f => {
      const v = a.fields[f.key];
      return f.label.replace(' (선택)', '') + ': ' + (f.options?.find(o => o[0] === v)?.[1] || v);
    });
  }
  function dimensionLabel(p, key) {
    const axis = D.axes.find(a => a.key === key);
    const d = p.dimensions[key];
    if (!d || d.value === null) return d?.conditional ? '상황별 선호' : '정보 부족';
    const text = d.value < 40 ? axis.left : d.value > 60 ? axis.right : '두 방향 사이';
    return text + (d.conditional ? ' · 상황별 조건 있음' : '');
  }
  function axisStory(p, key) {
    const d = p.dimensions[key];
    const story = N.stories[key];
    const notes = D.traits.filter(q => q.axis === key && response(p, q.id)?.note).map(q => response(p, q.id).note);
    let text;
    if (d.value === null) {
      text = d.conditional ? '이 항목은 상황에 따라 선호가 달라진다고 답했습니다. 어떤 조건에서 방향이 달라지는지 남긴 내용을 함께 읽어주세요. 하나의 좌표로 바꾸거나 양쪽이 모두 편하다고 단정하지 않습니다.' : '이 항목의 선호는 아직 확인되지 않았습니다. 다음 세션에서 두 방식 중 어떤 흐름이 편한지 살펴볼 수 있습니다. 다른 응답으로 이 항목을 추정하지 않습니다.';
    } else if (d.value < 40) text = story.low;
    else if (d.value > 60) text = story.high;
    else text = story.middle;
    return { text, notes };
  }
  function combinations(p) {
    const sure = key => p.dimensions[key]?.count === 1 && !p.dimensions[key].conditional;
    const high = key => sure(key) && p.radar[key] > 60;
    const low = key => sure(key) && p.radar[key] < 40;
    const result = [];
    if (high('tempo') && high('detail')) result.push('빠른 반응과 자세한 표현을 함께 선호합니다. 준비 속도와 표현 분량은 독립적입니다. 길게 표현할 때도 상대가 반응할 지점을 나눌 수 있는지 확인해보세요.');
    if (high('tempo') && high('scene')) result.push('반응은 빠르게 주고받으면서 장면 자체는 충분히 이어가고 싶어 합니다. 대화의 속도와 다음 장면으로 넘어가는 속도를 따로 맞추면 이 조합을 살릴 수 있습니다.');
    if (low('initiative') && high('tempo')) result.push('시작할 계기를 받는 편이 편하지만, 장면이 열리면 빠르게 반응하고 싶다고 답했습니다. 질문이나 차례 초대가 대화를 여는 데 도움이 될 수 있습니다.');
    if (['2', '3', '4'].includes(valueOf(p, 'O05')) && valueOf(p, 'O06') === '1') result.push('사담도 즐기면서 그 위치는 RP와 나누고 싶다고 답했습니다. 교류를 줄이기보다 플레이어의 대화와 캐릭터의 대화가 어디에서 이어지는지 구분하는 선호입니다.');
    return result.slice(0, 3);
  }
  function overview(p) {
    const confident = D.axes.filter(a => p.dimensions[a.key].value !== null && p.dimensions[a.key].spread < 50);
    const first = confident.slice(0, 4).map(a => a.name + '는 ' + dimensionLabel(p, a.key)).join(', ');
    const paragraphs = [first ? '응답을 바탕으로 읽으면 ' + first + ' 쪽을 선택했습니다. 각각은 독립적인 선호이며, 한 방향이 더 좋은 플레이 방식이라는 뜻은 아닙니다.' : '아직 하나의 방향으로 요약할 수 있는 RP 응답이 충분하지 않습니다. 상황별 조건과 실제 선택을 먼저 읽어주세요.'];
    const combo = combinations(p);
    if (combo.length) paragraphs.push(combo[0]);
    else if (p.dimensions.initiative.value !== null) paragraphs.push(axisStory(p, 'initiative').text);
    const ops = ['O01', 'O02', 'O05', 'O06', 'A02', 'A04', 'O13', 'O14'].filter(id => response(p, id));
    if (ops.length) paragraphs.push('운영에서는 ' + ops.map(id => questionById(id).name + '는 “' + answerLabel(questionById(id), response(p, id)) + '”').join(', ') + '라고 답했습니다. 필요한 조건과 선호를 구분하고 실제 제공 가능한 범위를 함께 확인해보세요.');
    return paragraphs;
  }
  function operationStory(p, q) {
    const a = response(p, q.id);
    if (!a || a.value === 'unknown') return '아직 이 항목의 선호를 확인하지 않았습니다. 다른 응답으로 허용이나 필요 수준을 추정하지 않습니다. ' + q.explanation;
    if (a.value === 'other') return '기본 선택지와 다른 방식이 필요하다고 답했습니다. 적어둔 조건을 먼저 확인해주세요. ' + q.explanation;
    if (q.type === 'matrix') return '세부 활동·위치별로 범위를 나누어 답했습니다. 아래 응답표에서 같은 항목의 허용 시점과 확인 조건을 각각 읽어주세요. ' + q.explanation;
    return '이 항목에서는 “' + answerLabel(q, a) + '”를 선택했습니다. ' + q.explanation;
  }
  function downloadJSON(p) {
    const blob = new Blob([JSON.stringify(p, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = 'trpg-playstyle-profile.json'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function point(c, shape, x, y, color, size = 4) {
    c.fillStyle = color; c.beginPath();
    if (shape % 3 === 0) c.arc(x, y, size, 0, Math.PI * 2);
    else if (shape % 3 === 1) c.rect(x - size, y - size, size * 2, size * 2);
    else { c.moveTo(x, y - size - 1); c.lineTo(x + size + 1, y + size); c.lineTo(x - size - 1, y + size); c.closePath(); }
    c.fill();
  }
  function drawRadar(canvas, sets, animate = true, showAxisNames = true, axes = D.axes, drawAxisNames = true) {
    const c = canvas.getContext('2d');
    if (!c) return;
    const w = canvas.width, h = canvas.height, cx = w / 2, cy = h / 2, radius = w * (showAxisNames ? .31 : .27);
    const n = axes.length;
    if (canvas._frame) cancelAnimationFrame(canvas._frame);
    const previous = canvas._sets || [];
    canvas._sets = sets;
    const positions = axes.map((a, i) => { const angle = -Math.PI / 2 + i * Math.PI * 2 / n; return [Math.cos(angle), Math.sin(angle)]; });
    const paint = progress => {
      c.clearRect(0, 0, w, h);
      c.font = '14px Paperlogy, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.lineWidth = 1; c.setLineDash([]);
      for (let level = 1; level <= 4; level++) {
        c.beginPath();
        positions.forEach(([x, y], i) => { const xx = cx + x * radius * level / 4, yy = cy + y * radius * level / 4; i ? c.lineTo(xx, yy) : c.moveTo(xx, yy); });
        c.closePath(); c.strokeStyle = '#e1dae9'; c.stroke();
      }
      axes.forEach((a, i) => {
        const [x, y] = positions[i];
        c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + x * radius, cy + y * radius); c.strokeStyle = '#e1dae9'; c.stroke();
        if (showAxisNames && drawAxisNames) { c.fillStyle = '#554767'; c.fillText(a.name, cx + x * (radius + 39), cy + y * (radius + 27)); }
      });
      sets.forEach((set, i) => {
        const color = set.color || COLORS[i % 6], shape = set.index ?? i;
        const coords = axes.map((a, ai) => {
          const val = set.data[a.key]; if (!known(val)) return null;
          const oldSet = previous.find(s => s.id === set.id);
          const old = oldSet?.data[a.key];
          const v = known(old) ? old + (val - old) * progress : val;
          const distance = (set.minRadius || 0) + (1 - (set.minRadius || 0)) * v / 100;
          return [cx + positions[ai][0] * radius * distance, cy + positions[ai][1] * radius * distance];
        });
        c.strokeStyle = color; c.lineWidth = 2.5; c.setLineDash(shape % 2 ? [7, 4] : []);
        if (coords.every(Boolean)) {
          c.beginPath(); coords.forEach(([x, y], j) => j ? c.lineTo(x, y) : c.moveTo(x, y)); c.closePath(); c.fillStyle = color + '14'; c.fill(); c.stroke();
        } else {
          coords.forEach((xy, j) => { const next = coords[(j + 1) % n]; if (xy && next) { c.beginPath(); c.moveTo(...xy); c.lineTo(...next); c.stroke(); } });
        }
        c.setLineDash([]); coords.filter(Boolean).forEach(([x, y]) => point(c, shape, x, y, color));
      });
    };
    const reduced = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (!animate || reduced || !previous.length) { paint(1); return; }
    const start = performance.now();
    const frame = time => { const t = Math.min(1, (time - start) / 220); paint(1 - Math.pow(1 - t, 3)); if (t < 1) canvas._frame = requestAnimationFrame(frame); };
    canvas._frame = requestAnimationFrame(frame);
  }
  function responseHTML(p, q) {
    const a = response(p, q.id);
    if (q.type === 'matrix' && isObject(a?.value)) return '<ul class="answer-list">' + q.rows.map(([id, text]) => '<li><span>' + text + '</span><strong>' + escape(q.options.find(o => o[0] === a.value[id])?.[1] || '미확인') + '</strong></li>').join('') + '</ul>';
    return '<p class="selected-answer">' + escape(answerLabel(q, a)) + '</p>';
  }
  function levelHTML(p, q) {
    if (!q.levels) return '';
    const a = response(p, q.id);
    const index = q.options.findIndex(o => o[0] === a?.value);
    const offered = q.options.findIndex(o => o[0] === a?.fields?.offered);
    const minimum = q.options.findIndex(o => o[0] === a?.fields?.minimum);
    return '<div class="level-track" aria-hidden="true">' + q.options.map(([, t], i) => '<span class="' + (i === index ? 'active' : '') + '" title="' + escape(t) + '">' + (i + 1) + '</span>').join('') + '</div>' + (offered >= 0 ? '<p class="field-note">GM 제공 가능: ' + escape(q.options[offered][1]) + '</p>' : '') + (minimum >= 0 ? '<p class="field-note">최소 필요: ' + escape(q.options[minimum][1]) + '</p>' : '');
  }
  function resultNotice(title, text, legacy) {
    $('#result-content').hidden = true; $('#result-notice').hidden = false;
    $('#notice-title').textContent = title; $('#notice-copy').textContent = text;
    if (legacy) {
      const oldNames = { pace: '응답 리듬', expression: '장면 서술', immersion: '인물 시점', structure: '진행 설계', cooperation: '파티 운영', conflict: '캐릭터 간 긴장', relationship: '서사 초점', challenge: '도전 압력' };
      $('#legacy-content').innerHTML = '<p>이전 결과 좌표를 보존하고 있어요. 새 문항의 다섯 축으로 자동 변환하지 않습니다.</p><dl class="legacy-grid">' + Object.entries(oldNames).map(([key, label]) => '<div><dt>' + label + '</dt><dd>' + escape(legacy.radar?.[key] ?? '미확인') + '</dd></div>').join('') + '</dl>';
      $('#legacy-download').hidden = false; $('#legacy-download').onclick = () => downloadJSON(legacy);
    }
  }
  function initResult() {
    const rawText = localStorage.getItem(STORAGE) || localStorage.getItem('session-zero-profile');
    if (!rawText) { resultNotice('아직 결과가 없어요.', '테스트에 답하면 성향 그래프와 자세한 해설을 볼 수 있어요.'); return; }
    let raw, p;
    try {
      raw = JSON.parse(rawText);
      if (raw.schemaVersion === '2.0' || (!raw.schemaVersion && raw.radar)) { resultNotice('이전 설계의 결과입니다.', '문항과 축의 의미가 달라졌어요. 새 테스트로 다시 답하면 RP와 운영 해설을 볼 수 있습니다.', raw); return; }
      p = validateProfile(raw);
    } catch (err) { resultNotice('결과를 읽지 못했어요.', err.message + ' 새 테스트로 다시 답할 수 있습니다.'); return; }
    $('#profile-title').textContent = p.displayName + '의 플레이 성향';
    $('#profile-copy').textContent = '그래프는 취향의 방향이며 실력이나 등급이 아닙니다.';
    drawRadar($('#radar'), [{ id: 'self', data: p.radar, color: COLORS[0] }], true, false);
    $('#radar-summary').textContent = D.axes.map(a => a.name + ': ' + dimensionLabel(p, a.key)).join(' · ');
    $('#radar-axis-labels').innerHTML = D.axes.map((a, i) => {
      const [direction, condition] = dimensionLabel(p, a.key).split(' · ');
      return '<div class="radar-axis radar-axis-' + i + '"><strong>' + escape(a.name) + '</strong><span>' + escape(direction) + '</span>' + (condition ? '<small>' + escape(condition) + '</small>' : '') + '</div>';
    }).join('');
    $('#display-name').value = p.displayName;
    const preview = () => {
      p.displayName = $('#display-name').value.trim().slice(0, 80) || '나의 모험가';
      $('#export-preview').value = JSON.stringify(exportProfile(p, { boundaries: $('#share-boundaries').checked, notes: $('#share-notes').checked }), null, 2);
    };
    ['#display-name', '#share-boundaries', '#share-notes'].forEach(s => $(s).addEventListener('input', preview));
    $('#download').onclick = () => {
      preview(); localStorage.setItem(STORAGE, JSON.stringify(p));
      downloadJSON(exportProfile(p, { boundaries: $('#share-boundaries').checked, notes: $('#share-notes').checked }));
      $('#export-message').textContent = '선택한 범위의 결과를 저장했어요.';
    };
    preview();
  }
  globalThis.TRPGApp = { D, STORAGE, COLORS, SHAPES, $, escape, isObject, known, makeProfile, validateProfile, exportProfile, questionById, response, valueOf, answerLabel, dimensionLabel, axisStory, combinations, overview, operationStory, fieldsFor, fieldLabels, drawRadar };
  if (typeof document !== 'undefined' && document.querySelector('#result-content')) initResult();
})();
