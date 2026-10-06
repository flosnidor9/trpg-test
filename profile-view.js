/* Shared profile screen for the result page and participant tabs. */
globalThis.TRPGProfileView = `
    <div class="profile-overview">
      <section class="result-intro"><p class="eyebrow">YOUR PLAY PROFILE</p><h1 id="profile-title">나의 플레이 성향</h1><p id="profile-copy" class="lede"></p><div id="profile-focus" class="profile-focus" hidden></div><a class="button primary profile-cta" href="compare.html">파티와 취향 맞춰보기 <span aria-hidden="true">↗</span></a><p class="profile-note">취향은 우열이 아니라, 함께할 모험의 방향입니다.</p></section>
      <article class="radar-card" aria-labelledby="map-title"><div class="map-heading"><p class="label">PLAYSTYLE MAP</p><span>나의 플레이 좌표</span></div><h2 id="map-title">나의 성향 지도</h2><div class="result-radar-visual"><canvas id="radar" width="640" height="640" aria-hidden="true"></canvas><div id="radar-axis-labels" class="radar-axis-labels"></div></div><details class="map-reading"><summary>성향 지도 텍스트로 읽기</summary><div class="map-reading-content"><ul id="radar-summary"></ul></div></details></article>
    </div>
    <section class="taste-section" aria-labelledby="taste-title">
      <div class="taste-heading"><div><p class="label">YOUR SESSION HANDOUTS</p><h2 id="taste-title">나의 세션 취향 카드</h2></div><p class="small-copy">답변 속에서 함께 나타난 취향을 모았어요.<br>세션을 준비할 때, 나를 소개하는 핸드아웃으로 써보세요.</p></div>
      <div id="taste-cards" class="taste-cards"></div>
      <p id="taste-empty" class="empty-card" hidden>아직 카드를 고를 응답이 충분하지 않아요. <a href="test.html?edit=1">답변을 확인해 주세요.</a></p>
    </section>
    <section id="export-section" class="details export-section">
      <div class="export-heading"><div><p class="label">TAKE YOUR PROFILE</p><h2>다음 모험에 가져가세요.</h2></div><p class="section-copy">결과는 이 브라우저에 저장됩니다.<br>JSON을 저장해 파티 비교에 불러올 수 있어요.</p></div>
      <label class="question-field" for="display-name">공유할 이름<input id="display-name" maxlength="80"></label>
      <p class="small-copy">캐릭터 전개·소재별 허용 범위와 직접 적은 조건·일정·불호 요소·메모가 JSON에 포함됩니다.</p>
      <details><summary>내보낼 JSON 미리보기</summary><label class="sr-only" for="export-preview">내보낼 결과 JSON</label><textarea id="export-preview" readonly rows="14" spellcheck="false"></textarea></details>
      <button type="button" id="download" class="button primary">결과 JSON 저장 ↓</button><p id="export-message" class="form-message" role="status"></p>
    </section>
`;
const profileHost = document.querySelector("#result-content");
if (profileHost) profileHost.innerHTML = globalThis.TRPGProfileView;
