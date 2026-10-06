/* 답변한 문항은 남겨두고, 다음 문항을 아래에 이어서 표시합니다. */
(() => {
  'use strict';
  const A = globalThis.TRPGApp;
  const D = A.D;
  const { $, escape: e } = A;
  const allValues = { O04: 'responsive', O07: 'ok', C01: 'during', C03: 'ok', B01: 'ok', B02: 'ok' };
  const draftKey = 'trpg-rp-draft-v3';
  let current = 0;
  let responses = {};
  let resumed = false;
  try {
    const draft = JSON.parse(localStorage.getItem(draftKey) || 'null');
    if ([D.version, 'rp-2026-10-v1', 'rp-2026-10-v2', 'rp-2026-10-v3', 'rp-2026-10-v4', 'rp-2026-10-v5', 'rp-2026-10-v6'].includes(draft?.version) && A.isObject(draft.responses)) {
      const saved = A.makeProfile(draft.responses);
      saved.questionnaireVersion = draft.version;
      responses = A.validateProfile(saved).responses;
      current = draft.version === D.version && Number.isInteger(draft.current) ? Math.max(0, Math.min(D.questions.length - 1, draft.current)) : 0;
      resumed = Object.keys(responses).length > 0;
    }
    if (new URLSearchParams(location.search).has('edit')) {
      const profile = A.validateProfile(JSON.parse(localStorage.getItem(A.STORAGE)));
      responses = profile.responses; current = 0; resumed = true;
    }
  } catch { responses = {}; current = 0; }
  const save = () => localStorage.setItem(draftKey, JSON.stringify({ version: D.version, current, responses }));
  const activeFields = q => A.fieldsFor(q, responses.role?.value).filter(f => (!f.when || responses[q.id]?.value === f.when) && !(q.id === 'C02' && f.key === 'serious' && q.rows.every(([row]) => ['ask', 'unknown'].includes(responses.C02?.value?.[row]))));
  function complete(q) {
    const answer = responses[q.id];
    if (!answer || answer.value === undefined) return false;
    if (q.type === 'text') return typeof answer.value === 'string';
    if (q.type === 'matrix' && A.isObject(answer.value) && !q.rows.every(([key]) => answer.value[key] !== undefined)) return false;
    return activeFields(q).filter(f => f.required).every(f => {
      const value = answer.fields?.[f.key];
      if (value === undefined || value === '') return false;
      return f.type !== 'number' || (Number.isInteger(Number(value)) && Number(value) >= f.min && Number(value) <= f.max);
    });
  }
  const cardFor = q => document.getElementById('question-' + q.id);
  const status = () => {
    const done = D.questions.filter(complete).length;
    $('#progress-label').textContent = done + ' / ' + D.questions.length + ' 완료';
    $('#progress-bar').style.width = done / D.questions.length * 100 + '%';
    $('#test-progress').setAttribute('aria-valuenow', String(done));
    $('#test-progress').setAttribute('aria-valuetext', done + '개 문항에 답했어요');
    $('#answered-status').textContent = done + '개 문항에 답했어요 · 자동으로 이 기기에 저장돼요';
    $('#finish-test').hidden = current < D.questions.length - 1;
    $('#finish-test').disabled = done !== D.questions.length;
  };
  function advance(q) {
    // 이전 답변을 수정할 때는 현재 위치와 뒤에 이어진 문항을 유지합니다.
    if (D.questions[current].id !== q.id || !complete(q)) return;
    let target;
    if (current < D.questions.length - 1) {
      current++;
      renderQuestion(current);
      target = cardFor(D.questions[current]);
    } else target = $('#finish-test');
    save(); status();
    target.querySelector('h2')?.focus({ preventScroll: true });
    if (target === $('#finish-test')) target.focus({ preventScroll: true });
    target.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  }
  function fieldHTML(q) {
    const answer = responses[q.id] || {};
    return activeFields(q).map(f => {
      const value = f.key === 'note' ? answer.note || '' : answer.fields?.[f.key] ?? '';
      const label = f.label;
      const required = Boolean(f.required);
      const id = 'field-' + q.id + '-' + f.key;
      let control;
      if (f.type === 'select') control = '<select id="' + id + '" data-field="' + f.key + '"' + (required ? ' required' : '') + '><option value="">선택해주세요</option>' + f.options.map(([v, t]) => '<option value="' + e(v) + '"' + (value === v ? ' selected' : '') + '>' + e(t) + '</option>').join('') + '</select>';
      else if (f.type === 'textarea') control = '<textarea id="' + id + '" data-field="' + f.key + '" maxlength="2000" rows="3"' + (required ? ' required' : '') + '>' + e(value) + '</textarea>';
      else control = '<input id="' + id + '" data-field="' + f.key + '" type="' + f.type + '" value="' + e(value) + '"' + (f.type === 'number' ? ' min="' + f.min + '" max="' + f.max + '" step="1"' : ' maxlength="2000"') + (required ? ' required' : '') + '>';
      return '<div class="question-field"><label for="' + id + '">' + e(label) + (required ? ' <span class="required-label">필수</span>' : '') + '</label>' + control + '</div>';
    }).join('');
  }
  function renderFields(q) {
    const container = cardFor(q).querySelector('.question-fields');
    container.innerHTML = fieldHTML(q);
    container.querySelectorAll('[data-field]').forEach(input => {
      input.addEventListener('input', () => {
        const a = responses[q.id] ||= {};
        if (input.dataset.field === 'note') a.note = input.value;
        else { a.fields ||= {}; a.fields[input.dataset.field] = input.value; }
        save(); status();
      });
      // 자유 입력은 입력을 마친 뒤 이동해 작성 중 포커스를 빼앗지 않습니다.
      input.addEventListener('change', () => advance(q));
    });
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
    cardFor(q).querySelectorAll('.choice').forEach(label => label.classList.toggle('selected', label.querySelector('input')?.checked));
    if (q.id === 'role') D.questions.slice(0, current + 1).filter(item => item.preparation).forEach(renderFields);
    if (!complete(q)) cardFor(q).querySelector('[data-field][required]')?.focus();
    advance(q);
  }
  function renderQuestion(index) {
    const q = D.questions[index];
    let card = cardFor(q);
    if (!card) {
      card = document.createElement('section');
      card.id = 'question-' + q.id;
      card.className = 'question-card';
      card.setAttribute('aria-labelledby', 'question-title-' + q.id);
      $('#question-list').append(card);
    }
    const a = responses[q.id];
    const inputName = 'answer-' + q.id;
    let controls;
    if (q.type === 'matrix') {
      controls = '<div class="matrix-questions">' + q.rows.map(([key, label]) => '<div class="matrix-question"><label for="row-' + q.id + '-' + key + '">' + e(label) + '</label><select id="row-' + q.id + '-' + key + '" data-row="' + key + '"><option value="">선택해주세요</option>' + q.options.map(([v, t]) => '<option value="' + e(v) + '"' + (a?.value?.[key] === v ? ' selected' : '') + '>' + e(t) + '</option>').join('') + (a?.value?.[key] === 'unknown' ? '<option value="unknown" selected>모르겠음</option>' : '') + (a?.value?.[key] === 'private' ? '<option value="private" selected>비공개</option>' : '') + '</select></div>').join('') + '</div><div class="matrix-actions"><button class="text-button talk-all" type="button">' + (q.id === 'O07' ? '모두 사전확인' : '모두 먼저 이야기해요') + '</button>' + (q.id === 'C02' ? '' : '<button class="text-button possible-all" type="button">모두 가능</button>') + (q.id === 'O07' ? '<button class="text-button impossible-all" type="button">모두 불가능</button>' : '') + '</div>';
    } else if (q.type === 'text') {
      controls = '<div class="suggestion-group"><p>예시에서 선택</p><div class="suggestion-chips">' + (q.suggestions || []).map(t => '<button class="suggestion-chip" type="button" aria-pressed="' + String((a?.value || '').split('\n').some(line => line.trim() === t)) + '">' + e(t) + '</button>').join('') + '</div></div><div class="question-field"><label for="text-' + q.id + '">직접 적기 (선택)</label><textarea id="text-' + q.id + '" data-text-answer maxlength="2000" rows="5">' + e(a?.value ?? '') + '</textarea></div><button class="button secondary text-next" type="button">다음 문항 →</button>';
    } else {
      controls = '<fieldset class="choices"><legend class="sr-only">' + e(q.text) + '</legend>' + q.options.map(([v, t], optionIndex) => '<label class="choice' + (a?.value === v ? ' selected' : '') + '"><input type="radio" name="' + inputName + '" value="' + e(v) + '"' + (a?.value === v ? ' checked' : '') + '><span>' + e(t) + (q.examples?.[optionIndex] ? '<small class="choice-example">예: ' + e(q.examples[optionIndex]) + '</small>' : '') + '</span></label>').join('') + '</fieldset>';
    }
    card.innerHTML = '<p class="question-group">' + e(q.group) + ' · ' + e(q.name) + '</p><span class="question-num">' + String(index + 1).padStart(2, '0') + '</span><h2 id="question-title-' + q.id + '" tabindex="-1">' + e(q.text) + '</h2>' + (q.hint ? '<p class="question-hint">' + e(q.hint) + '</p>' : '') + controls + '<div class="question-fields"></div>';
    card.querySelectorAll('input[type="radio"]').forEach(input => input.addEventListener('change', () => choose(q, q.type === 'trait' && /^\d+$/.test(input.value) ? Number(input.value) : input.value)));
    card.querySelector('[data-text-answer]')?.addEventListener('input', input => {
      responses[q.id] = { value: input.target.value };
      card.querySelectorAll('.suggestion-chip').forEach(chip => chip.setAttribute('aria-pressed', String(input.target.value.split('\n').some(line => line.trim() === chip.textContent))));
      save(); status();
    });
    card.querySelectorAll('.suggestion-chip').forEach(chip => chip.addEventListener('click', () => {
      const textarea = card.querySelector('[data-text-answer]');
      const lines = textarea.value.split('\n').filter(line => line.trim());
      const selected = lines.some(line => line.trim() === chip.textContent);
      const next = selected ? lines.filter(line => line.trim() !== chip.textContent) : [...lines, chip.textContent];
      textarea.value = next.join('\n').slice(0, 2000);
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
    }));
    card.querySelector('.text-next')?.addEventListener('click', () => choose(q, card.querySelector('[data-text-answer]').value));
    card.querySelectorAll('[data-row]').forEach(input => input.addEventListener('change', () => {
      const before = responses[q.id] || {};
      const value = A.isObject(before.value) ? { ...before.value } : {};
      if (input.value) value[input.dataset.row] = input.value; else delete value[input.dataset.row];
      responses[q.id] = { ...before, value }; save(); renderFields(q); status();
      advance(q);
    }));
    card.querySelector('.talk-all')?.addEventListener('click', () => {
      choose(q, Object.fromEntries(q.rows.map(([row]) => [row, 'ask'])));
      renderQuestion(index);
    });
    card.querySelector('.possible-all')?.addEventListener('click', () => {
      choose(q, Object.fromEntries(q.rows.map(([row]) => [row, allValues[q.id]])));
      renderQuestion(index);
    });
    card.querySelector('.impossible-all')?.addEventListener('click', () => {
      choose(q, Object.fromEntries(q.rows.map(([row]) => [row, 'no'])));
      renderQuestion(index);
    });
    renderFields(q);
  }
  $('#reset-test').onclick = () => {
    responses = {};
    current = 0;
    localStorage.removeItem(draftKey);
    // 결과 수정 경로에서도 새로고침으로 이전 답변이 다시 들어오지 않게 합니다.
    const url = new URL(location.href);
    url.searchParams.delete('edit');
    history.replaceState(null, '', url);
    $('#question-list').replaceChildren();
    renderQuestion(0);
    status();
    $('#resume-message').textContent = '답변을 초기화했어요. 첫 문항부터 다시 시작하세요.';
    $('#question-title-' + D.questions[0].id).focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: 'instant' });
  };
  $('#finish-test').onclick = () => {
    if (!D.questions.every(complete)) return;
    const previous = localStorage.getItem(A.STORAGE);
    if (previous) localStorage.setItem('trpg-playstyle-profile-previous', previous);
    let name = '나의 모험가';
    try { name = JSON.parse(previous)?.displayName || name; } catch {}
    localStorage.setItem(A.STORAGE, JSON.stringify(A.makeProfile(responses, name)));
    localStorage.removeItem(draftKey);
    location.href = 'result.html';
  };
  $('#resume-message').textContent = (resumed ? '저장한 답변을 이어서 볼 수 있어요. ' : '') + '답변하면 다음 문항으로 내려갑니다. 이전 답변은 위로 스크롤해 수정할 수 있어요.';
  $('#test-progress').setAttribute('aria-valuemax', String(D.questions.length));
  // 기존 버튼 방식의 중간 저장도 답변을 잃지 않고 이어서 보여줍니다.
  const lastAnswered = D.questions.reduce((last, q, index) => responses[q.id] ? index : last, -1);
  const nextIndex = lastAnswered < 0 ? 0 : lastAnswered + (complete(D.questions[lastAnswered]) ? 1 : 0);
  current = Math.max(current, Math.min(nextIndex, D.questions.length - 1));
  for (let index = 0; index <= current; index++) renderQuestion(index);
  status();
})();
