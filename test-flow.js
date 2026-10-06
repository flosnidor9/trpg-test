/* 한 화면에 한 문항. 선택한 뒤 다음 버튼으로 진행합니다. */
(() => {
  'use strict';
  const A = globalThis.TRPGApp;
  const D = A.D;
  const { $, escape: e } = A;
  const draftKey = 'trpg-rp-draft-v3';
  let current = 0;
  let responses = {};
  let resumed = false;
  try {
    const draft = JSON.parse(localStorage.getItem(draftKey) || 'null');
    if (draft?.version === D.version && A.isObject(draft.responses)) {
      responses = A.validateProfile(A.makeProfile(draft.responses)).responses;
      current = Number.isInteger(draft.current) ? Math.max(0, Math.min(D.questions.length - 1, draft.current)) : 0;
      resumed = Object.keys(responses).length > 0;
    }
    if (new URLSearchParams(location.search).has('edit')) {
      const profile = A.validateProfile(JSON.parse(localStorage.getItem(A.STORAGE)));
      responses = profile.responses; current = 0; resumed = true;
    }
  } catch { responses = {}; current = 0; }
  const save = () => localStorage.setItem(draftKey, JSON.stringify({ version: D.version, current, responses }));
  const activeFields = q => A.fieldsFor(q, responses.role?.value).filter(f => !f.when || responses[q.id]?.value === f.when);
  function complete(q) {
    const answer = responses[q.id];
    if (!answer || answer.value === undefined) return false;
    if (q.type === 'matrix' && A.isObject(answer.value) && !q.rows.every(([key]) => answer.value[key] !== undefined)) return false;
    if (answer.value === 'conditional' || answer.value === 'other') return Boolean(answer.note?.trim());
    if (answer.value === 'unknown') return true;
    return activeFields(q).filter(f => f.required).every(f => {
      const value = answer.fields?.[f.key];
      if (value === undefined || value === '') return false;
      return f.type !== 'number' || (Number.isInteger(Number(value)) && Number(value) >= f.min && Number(value) <= f.max);
    });
  }
  const status = () => {
    const q = D.questions[current];
    $('#next').disabled = !complete(q);
    const done = D.questions.filter(complete).length;
    $('#progress-label').textContent = (current + 1) + ' / ' + D.questions.length + ' · ' + q.group;
    $('#progress-bar').style.width = done / D.questions.length * 100 + '%';
    $('#test-progress').setAttribute('aria-valuenow', String(done));
    $('#test-progress').setAttribute('aria-valuetext', done + '개 문항에 답했어요');
    $('#answered-status').textContent = done + '개 문항에 답했어요 · 자동으로 이 기기에 저장돼요';
  };
  function fieldHTML(q) {
    const answer = responses[q.id] || {};
    const generic = ['unknown', 'other', 'conditional'].includes(answer.value);
    const defs = activeFields(q).filter(f => f.key === 'note' || !generic);
    return defs.map(f => {
      const value = f.key === 'note' ? answer.note || '' : answer.fields?.[f.key] ?? '';
      const label = f.key === 'note' && ['conditional', 'other'].includes(answer.value) ? '어떤 조건이나 방식이 필요한지 적어주세요' : f.label;
      const required = f.required || (f.key === 'note' && ['conditional', 'other'].includes(answer.value));
      const id = 'field-' + q.id + '-' + f.key;
      let control;
      if (f.type === 'select') control = '<select id="' + id + '" data-field="' + f.key + '"' + (required ? ' required' : '') + '><option value="">선택해주세요</option>' + f.options.map(([v, t]) => '<option value="' + e(v) + '"' + (value === v ? ' selected' : '') + '>' + e(t) + '</option>').join('') + '</select>';
      else if (f.type === 'textarea') control = '<textarea id="' + id + '" data-field="' + f.key + '" maxlength="2000" rows="3"' + (required ? ' required' : '') + '>' + e(value) + '</textarea>';
      else control = '<input id="' + id + '" data-field="' + f.key + '" type="' + f.type + '" value="' + e(value) + '"' + (f.type === 'number' ? ' min="' + f.min + '" max="' + f.max + '" step="1"' : ' maxlength="2000"') + (required ? ' required' : '') + '>';
      return '<div class="question-field"><label for="' + id + '">' + e(label) + (required ? ' <span class="required-label">필수</span>' : '') + '</label>' + control + '</div>';
    }).join('');
  }
  function renderFields(q) {
    $('#question-fields').innerHTML = fieldHTML(q);
    $('#question-fields').querySelectorAll('[data-field]').forEach(input => input.addEventListener('input', () => {
      const a = responses[q.id] ||= {};
      if (input.dataset.field === 'note') a.note = input.value;
      else { a.fields ||= {}; a.fields[input.dataset.field] = input.value; }
      save(); status();
    }));
  }
  function choose(q, value) {
    const previous = responses[q.id] || {};
    responses[q.id] = { ...previous, value };
    if (previous.fields) {
      responses[q.id].fields = Object.fromEntries(Object.entries(previous.fields).filter(([key]) => {
        const f = (q.fields || []).find(field => field.key === key);
        return f && (!f.when || f.when === value);
      }));
    }
    save(); renderFields(q); status();
    $('#question-card').querySelectorAll('.choice').forEach(label => label.classList.toggle('selected', label.querySelector('input')?.checked));
    if (['conditional', 'other'].includes(value)) $('#field-' + q.id + '-note')?.focus();
  }
  function render(focus = false) {
    const q = D.questions[current];
    const a = responses[q.id];
    const inputName = 'answer-' + q.id;
    let controls;
    if (q.type === 'matrix') {
      controls = '<div class="matrix-questions">' + q.rows.map(([key, label]) => '<div class="matrix-question"><label for="row-' + key + '">' + e(label) + '</label><select id="row-' + key + '" data-row="' + key + '"><option value="">선택해주세요</option>' + q.options.map(([v, t]) => '<option value="' + e(v) + '"' + (a?.value?.[key] === v ? ' selected' : '') + '>' + e(t) + '</option>').join('') + '</select></div>').join('') + '</div><button class="text-button" id="unknown-all" type="button">이 묶음은 아직 판단하기 어려워요</button>';
    } else {
      const extra = q.type === 'trait' ? [['conditional', '상황에 따라 선호가 달라요'], ['unknown', '아직 판단하기 어려워요'], ['other', '두 설명 모두 맞지 않아요']] : [['unknown', '아직 모르겠어요'], ['other', '다른 방식이 필요해요']];
      controls = '<fieldset class="choices"><legend class="sr-only">' + e(q.text) + '</legend>' + [...q.options, ...extra].map(([v, t]) => '<label class="choice' + (a?.value === v ? ' selected' : '') + '"><input type="radio" name="' + inputName + '" value="' + e(v) + '"' + (a?.value === v ? ' checked' : '') + '><span>' + e(t) + '</span></label>').join('') + '</fieldset>';
    }
    $('#question-card').innerHTML = '<p class="question-group">' + e(q.group) + ' · ' + e(q.name) + '</p><span class="question-num">' + String(current + 1).padStart(2, '0') + '</span><h2 id="question-title" tabindex="-1">' + e(q.text) + '</h2><p class="question-hint">' + e(q.hint || (q.type === 'trait' ? '잘하는 방식이나 캐릭터 성격이 아니라, 내가 편하게 즐길 방식을 골라주세요.' : q.explanation)) + '</p>' + controls + '<div id="question-fields"></div>';
    if (q.type === 'matrix' && a?.value === 'unknown') {
      $('#question-fields').insertAdjacentHTML('beforebegin', '<p class="selected-answer">이 묶음은 미확인으로 기록했어요.</p>');
    }
    $('#question-card').querySelectorAll('input[type="radio"]').forEach(input => input.addEventListener('change', () => choose(q, q.type === 'trait' && /^\d+$/.test(input.value) ? Number(input.value) : input.value)));
    $('#question-card').querySelectorAll('[data-row]').forEach(input => input.addEventListener('change', () => {
      const before = responses[q.id] || {};
      const value = A.isObject(before.value) ? { ...before.value } : {};
      if (input.value) value[input.dataset.row] = input.value; else delete value[input.dataset.row];
      responses[q.id] = { ...before, value }; save(); status();
    }));
    if ($('#unknown-all')) $('#unknown-all').onclick = () => {
      if (q.options.some(o => o[0] === 'unknown')) {
        choose(q, Object.fromEntries(q.rows.map(r => [r[0], 'unknown'])));
      } else choose(q, 'unknown');
      render(); $('#question-title').focus();
    };
    renderFields(q);
    $('#prev').disabled = current === 0;
    $('#next').textContent = current === D.questions.length - 1 ? '결과 보기 →' : '다음 →';
    status();
    if (focus) { $('#question-title').focus(); window.scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' }); }
  }
  $('#prev').onclick = () => { if (current > 0) { current--; save(); render(true); } };
  $('#next').onclick = () => {
    if (!complete(D.questions[current])) return;
    if (current < D.questions.length - 1) { current++; save(); render(true); return; }
    const previous = localStorage.getItem(A.STORAGE);
    if (previous) localStorage.setItem('trpg-playstyle-profile-previous', previous);
    let name = '나의 모험가';
    try { name = JSON.parse(previous)?.displayName || name; } catch {}
    localStorage.setItem(A.STORAGE, JSON.stringify(A.makeProfile(responses, name)));
    localStorage.removeItem(draftKey);
    location.href = 'result.html';
  };
  $('#resume-message').textContent = resumed ? '이 기기에 저장한 답변을 이어서 볼 수 있어요.' : '답변은 이 기기에 저장됩니다. 선택한 뒤 다음 버튼으로 진행하세요.';
  $('#test-progress').setAttribute('aria-valuemax', String(D.questions.length));
  render();
})();
