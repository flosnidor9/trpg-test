/* 전용 캔버스로 그리는 로컬 PNG. 화면의 애니메이션·스크롤 상태에 의존하지 않습니다. */
(() => {
  'use strict';
  const font = 'Paperlogy, "Malgun Gothic", sans-serif';
  const ink = '#342744', muted = '#675973', purple = '#7050b3';
  function lines(ctx, text, width) {
    const result = [];
    for (const paragraph of String(text).split(/\r?\n/)) {
      let line = '';
      for (const char of paragraph) {
        if (line && ctx.measureText(line + char).width > width) {
          const space = line.lastIndexOf(' ');
          if (space > line.length / 3) { result.push(line.slice(0, space)); line = line.slice(space + 1); }
          else { result.push(line); line = ''; }
        }
        line += char;
      }
      result.push(line);
    }
    return result;
  }
  function text(ctx, value, x, y, width, size = 22, color = ink, weight = 400) {
    ctx.font = `${weight} ${size}px ${font}`; ctx.fillStyle = color;
    const rows = lines(ctx, value, width);
    rows.forEach((row, i) => ctx.fillText(row, x, y + i * size * 1.55));
    return y + rows.length * size * 1.55;
  }
  function box(ctx, x, y, width, height, color = '#ffffff') {
    ctx.fillStyle = color; ctx.beginPath(); ctx.roundRect(x, y, width, height, 24); ctx.fill();
  }
  async function artwork(card) {
    const holder = document.createElement('div');
    holder.innerHTML = TRPGHandoutArt.render(card.id);
    const colors = TRPGHandoutArt.scenes[card.id].colors;
    let content = [...holder.querySelectorAll('svg')].map(svg => svg.innerHTML).join('');
    colors.forEach((color, i) => { content = content.replaceAll(`var(--art-${i})`, color); });
    const blob = new Blob([`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 310 620" width="310" height="620">${content}</svg>`], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    try {
      const img = new Image(); img.src = url; await img.decode(); return img;
    } finally { URL.revokeObjectURL(url); }
  }
  async function create({ title, members, cards, party = false, readingProfiles = members.map(member => member.profile) }) {
    await document.fonts.ready;
    const A = TRPGApp, C = TRPGCompare;
    const canvas = document.createElement('canvas'); canvas.width = 1920; canvas.height = 100;
    let ctx = canvas.getContext('2d');
    const leftX = 64, rightX = 820, leftWidth = 716;
    const contentWidth = canvas.width - 128, rightWidth = canvas.width - rightX - 64;
    const cardColumns = 2, cardGap = 32, cardWidth = (rightWidth - cardGap * (cardColumns - 1)) / cardColumns;
    const copyWidth = cardWidth - 48, paragraphWidth = cardWidth - 68;
    const legend = members.map(member => ({ ...member, rows: (() => { ctx.font = `500 22px ${font}`; return lines(ctx, member.profile.displayName, 590); })() }));
    const legendHeight = legend.reduce((sum, member) => sum + member.rows.length * 34 + 16, 0);
    const headingEnd = text(ctx, title, 64, 105, contentWidth, 46, ink, 700);
    const top = headingEnd + 66;
    const readingStart = top + 754 + legendHeight;
    let readingY = readingStart + 58;
    const readings = party ? C.partyMapReading(readingProfiles).map(item => ({ axis: item.axis, entries: [{ value: item.text }] })) : C.comparisonAxes.map(axis => {
      const groups = new Map();
      members.forEach(member => {
        const value = C.comparisonAnswer(member.profile, axis, '\n');
        if (!groups.has(value)) groups.set(value, []);
        groups.get(value).push(member.profile.displayName);
      });
      return { axis, entries: [...groups].map(([value, names]) => ({ name: names.join(' · '), value })) };
    });
    const measure = (value, width, size, weight = 400) => { ctx.font = `${weight} ${size}px ${font}`; return lines(ctx, value, width).length * size * 1.55; };
    for (const reading of readings) {
      readingY += measure(reading.axis.name + ' · ' + reading.axis.left + ' → ' + reading.axis.right, 636, 20, 600) + 38;
      for (const entry of reading.entries) readingY += measure(entry.value, 636, 20) + 20;
    }
    // 그림의 원래 좌표 비율을 유지합니다. 설명은 화면 카드처럼 문장별 항목으로 읽습니다.
    const artWidth = cardWidth - 24, artHeight = artWidth * 330 / 310;
    const copyStart = 12 + artHeight + 24;
    const cardParagraphs = cards.map(card => card.description.split(/\r?\n|(?<=[.!?])\s+/).map(value => value.trim()).filter(Boolean));
    const cardHeights = cards.map((card, i) => Math.max(cardWidth * 1.35,
      copyStart + 17 * 1.55 + 12 + measure(card.title, copyWidth, 26, 700) + 18 +
      cardParagraphs[i].reduce((height, paragraph) => height + measure(paragraph, paragraphWidth, 20) + 12, 0) + 24));
    const cardStart = top + (party ? 230 : 58);
    let cardEnd = cardStart;
    for (let i = 0; i < cards.length; i += cardColumns) cardEnd += Math.max(...cardHeights.slice(i, i + cardColumns)) + cardGap;
    canvas.height = Math.ceil(Math.max(readingY, cardEnd, top + 900) + 126);
    ctx = canvas.getContext('2d'); ctx.textBaseline = 'top';
    ctx.fillStyle = '#f7f4fa'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    text(ctx, party ? 'PARTY PLAY PROFILE' : 'YOUR PLAY PROFILE', 64, 48, contentWidth, 19, purple, 600);
    text(ctx, title, 64, 105, contentWidth, 46, ink, 700);
    text(ctx, party ? `선택한 ${members.length}명의 플레이 좌표 · 함께할 모험을 준비하는 지도` : '플레이 좌표와 세션 취향을 한 장에', 64, headingEnd + 8, contentWidth, 22, muted);
    box(ctx, leftX, top, leftWidth, readingY - top + 30);
    text(ctx, '성향 지도', leftX + 40, top + 32, 636, 30, ink, 700);
    const radar = document.createElement('canvas'); radar.width = 680; radar.height = 680;
    const sets = members.map(member => ({ id: member.id, data: C.comparisonRadar(member.profile), color: member.color, index: member.index, minRadius: .25 }));
    A.drawRadar(radar, sets, false, true, C.comparisonAxes, false);
    ctx.drawImage(radar, leftX + 18, top + 52);
    C.comparisonAxes.forEach((axis, i) => {
      const angle = -Math.PI / 2 + i * Math.PI * 2 / C.comparisonAxes.length;
      ctx.font = `600 20px ${font}`; ctx.fillStyle = ink; ctx.textAlign = 'center';
      ctx.fillText(axis.name, leftX + 358 + Math.cos(angle) * 276, top + 385 + Math.sin(angle) * 264);
    });
    ctx.textAlign = 'left';
    let y = top + 710;
    legend.forEach(member => {
      ctx.strokeStyle = member.color; ctx.lineWidth = 4; ctx.setLineDash(member.index % 2 ? [8, 5] : []);
      ctx.beginPath(); ctx.moveTo(leftX + 40, y + 12); ctx.lineTo(leftX + 70, y + 12); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = member.color; ctx.beginPath();
      if (member.index % 3 === 0) ctx.arc(leftX + 55, y + 12, 5, 0, Math.PI * 2);
      else if (member.index % 3 === 1) ctx.rect(leftX + 50, y + 7, 10, 10);
      else { ctx.moveTo(leftX + 55, y + 6); ctx.lineTo(leftX + 61, y + 17); ctx.lineTo(leftX + 49, y + 17); }
      ctx.fill();
      y = text(ctx, member.profile.displayName, leftX + 86, y, 590, 22, ink, 500) + 16;
    });
    y = readingStart;
    text(ctx, party ? '함께 적용할 조건 · 전체 ' + readingProfiles.length + '명 기준' : '성향 지도를 텍스트로 읽기', leftX + 40, y, 636, 26, ink, 700);
    y += 58;
    for (const { axis, entries } of readings) {
      y = text(ctx, axis.name + ' · ' + axis.left + ' → ' + axis.right, leftX + 40, y, 636, 20, purple, 600) + 20;
      for (const entry of entries) y = text(ctx, entry.value, leftX + 40, y, 636, 20, muted) + 20;
      y += 18;
    }
    if (party) {
      const overlap = C.radarOverlap(sets.map(set => set.data));
      box(ctx, rightX, top, rightWidth, 154, '#ede7f5');
      text(ctx, '공통 면적  ' + (overlap === null ? '—' : overlap + '%'), rightX + 30, top + 24, rightWidth - 60, 32, purple, 700);
      text(ctx, members.length < 2 ? '두 명 이상일 때 계산합니다.' : overlap === null ? '미확인 축이 있어 계산할 수 없습니다.' : '모두 겹치는 면적 ÷ 전체 면적\n취향의 방향을 읽는 참고이며 궁합 점수가 아닙니다.', rightX + 30, top + 78, rightWidth - 60, 19, muted);
    }
    text(ctx, party ? '함께 가진 세션 취향 카드' : '세션 취향 카드', rightX, cardStart - 52, rightWidth, 30, ink, 700);
    if (!cards.length) {
      box(ctx, rightX, cardStart, rightWidth, 160);
      text(ctx, party ? '아직 함께 가진 세션 취향 카드가 없어요.\n각자의 선호를 지도에서 살펴보세요.' : '아직 카드를 고를 응답이 충분하지 않아요.', rightX + 30, cardStart + 36, rightWidth - 60, 22, muted);
    }
    let cardY = cardStart;
    for (let i = 0; i < cards.length; i += cardColumns) {
      const height = Math.max(...cardHeights.slice(i, i + cardColumns));
      for (let j = i; j < Math.min(i + cardColumns, cards.length); j++) {
        const card = cards[j], x = rightX + (j % cardColumns) * (cardWidth + cardGap);
        const surface = TRPGHandoutArt.scenes[card.id].colors[0];
        box(ctx, x, cardY, cardWidth, height, surface);
        ctx.save(); ctx.beginPath(); ctx.roundRect(x + 12, cardY + 12, artWidth, artHeight, 14); ctx.clip();
        ctx.drawImage(await artwork(card), 0, 0, 310, 330, x + 12, cardY + 12, artWidth, artHeight); ctx.restore();
        let copyY = text(ctx, card.category, x + 24, cardY + copyStart, copyWidth, 17, '#dfceee', 600) + 12;
        copyY = text(ctx, card.title, x + 24, copyY, copyWidth, 26, '#f7f2ff', 700) + 18;
        for (const paragraph of cardParagraphs[j]) {
          text(ctx, '•', x + 24, copyY, 16, 20, '#c5aedc');
          copyY = text(ctx, paragraph, x + 44, copyY, paragraphWidth, 20, '#ddd2e8') + 12;
        }
      }
      cardY += height + cardGap;
    }
    text(ctx, 'TRPG 성향 테스트 · 취향은 우열이 아니라, 함께할 모험의 방향입니다.', 64, canvas.height - 65, contentWidth, 20, muted);
    return canvas;
  }
  async function preview(options, button) {
    if (button.disabled) return;
    button.disabled = true;
    const original = button.textContent; button.textContent = '이미지 준비 중…';
    let dialog;
    try {
      const canvas = await create(options);
      const image = await new Promise((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('PNG 생성 실패')), 'image/png'));
      const profiles = (options.readingProfiles || options.members.map(member => member.profile)).map(profile => TRPGApp.exportProfile(profile));
      const blob = await TRPGPngMetadata.embed(image, profiles);
      const url = URL.createObjectURL(blob);
      dialog = document.createElement('dialog'); dialog.className = 'png-dialog'; dialog.setAttribute('aria-label', 'PNG 저장 미리보기');
      dialog.innerHTML = '<div class="png-dialog-heading"><div><h2>PNG 저장 미리보기</h2><p>지도와 세션 카드를 한 장에 담았어요.</p></div><button type="button" class="button secondary png-close" aria-label="미리보기 닫기">닫기</button></div><div class="png-preview"><img alt="성향 지도와 텍스트 설명, 세션 취향 카드 저장 이미지"></div><div class="png-dialog-actions"><button type="button" class="button primary png-save">PNG 저장</button><p class="form-message" role="status"></p></div>';
      dialog.querySelector('.png-dialog-heading p').textContent = '비교용 결과 데이터 ' + profiles.length + '명분을 이미지 픽셀에 저장해요. JSON과 같은 공개 기준으로 경계·메모를 담고 비공개 항목은 제외해요. 크기 변경·편집 시 복구가 어려울 수 있어요.';
      if (options.party) dialog.querySelector('.png-dialog-heading p').textContent += ' 텍스트 요약에 참여한 전체 참가자의 데이터를 포함해요.';
      dialog.querySelector('img').src = url;
      dialog.querySelector('.png-close').onclick = () => dialog.close();
      dialog.querySelector('.png-save').onclick = () => {
        const link = document.createElement('a'); link.href = url; link.download = options.party ? 'trpg-party-playstyle.png' : 'trpg-playstyle.png'; link.click();
        dialog.querySelector('[role="status"]').textContent = 'PNG 저장을 요청했어요.';
      };
      dialog.addEventListener('close', () => { URL.revokeObjectURL(url); dialog.remove(); button.focus(); }, { once: true });
      document.body.append(dialog); dialog.showModal();
    } catch (error) {
      dialog?.remove();
      let message = button.parentElement.querySelector('.png-error');
      if (!message) { message = document.createElement('p'); message.className = 'png-error form-message'; message.setAttribute('role', 'status'); button.after(message); }
      message.textContent = error.message || '이미지를 만들지 못했어요. 다시 시도해 주세요.';
      console.error(error);
    } finally { button.disabled = false; button.textContent = original; }
  }
  globalThis.TRPGPng = { create, preview };
})();
