/* 내 결과와 동일한 화면을 파티 개인 탭에 표시합니다. */
globalThis.TRPGProfileView = `
    <section class="result-intro"><p class="eyebrow">YOUR PLAY PROFILE</p><h1 id="profile-title">나의 플레이 성향</h1><p id="profile-copy" class="lede"></p></section>
    <section class="taste-section" aria-labelledby="taste-title">
      <div class="taste-heading"><div><p class="label">SESSION CARDS</p><h2 id="taste-title">나의 세션 취향 카드</h2></div></div>
      <div id="taste-cards" class="taste-cards"></div>
      <p id="taste-empty" class="empty-card" hidden>아직 카드를 고를 응답이 충분하지 않아요. 공유한 응답을 확인해 주세요.</p>
    </section>
    <div class="profile-grid result-profile-grid">
      <article class="radar-card"><p class="label">PLAYSTYLE MAP</p><h2>나의 성향 지도</h2><p id="radar-summary" class="sr-only"></p><div class="result-radar-visual"><canvas id="radar" width="640" height="640" aria-hidden="true"></canvas><div id="radar-axis-labels" class="radar-axis-labels"></div></div></article>
    </div>
`;
