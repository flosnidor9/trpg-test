/* 물체의 표면·장식·그림자는 하나의 그룹, 하나의 패럴랙스 평면에 둡니다. */
(() => {
  'use strict';
  const D = 'var(--art-0)', M = 'var(--art-1)', L = 'var(--art-2)', A = 'var(--art-3)', W = 'var(--art-4)';
  const PAPER = 'url(#@paper)', SKY = 'url(#@sky)', WOOD = 'url(#@wood)', GLOW = 'url(#@glow)';
  const p = (d, fill, extra = '') => `<path d="${d}" fill="${fill}" ${extra}/>`;
  const r = (x, y, w, h, fill, radius = 0) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${radius}" fill="${fill}"/>`;
  const e = (x, y, rx, ry, fill, extra = '') => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${fill}" ${extra}/>`;
  const line = (d, color = W, width = 1.4) => `<path d="${d}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round"/>`;
  const g = (x, y, scale, content, rotate = 0) => `<g transform="translate(${x} ${y}) scale(${scale}) rotate(${rotate})">${content}</g>`;
  const object = (name, ...parts) => `<g data-art-object="${name}">${parts.flat(Infinity).join('')}</g>`;
  // 최대 패럴랙스 이동량보다 넉넉하게 칠해 카드 안쪽에 바탕의 틈이 생기지 않게 합니다.
  const backdrop = fill => r(-32, -32, 374, 684, fill);
  const book = e(0, 58, 86, 12, D, 'opacity=".22"') + p('M-84 5Q-40-14 0 5Q40-14 84 5L78 60Q35 44 0 64Q-35 44-78 60Z', W) + p('M-80 0Q-40-20 0 0V58Q-39 37-75 51Z', PAPER) + p('M0 0Q40-20 80 0L75 51Q39 37 0 58Z', L) + line('M0 0V58', W, 2) + line('M-65 13Q-37 4-14 14M-63 24Q-37 15-14 25M-61 35Q-37 26-14 36M14 14Q37 4 65 13M14 25Q37 15 63 24M14 36Q37 26 61 35', W, 1.1);
  const candle = e(0, 51, 19, 5, D, 'opacity=".2"') + r(-9, 2, 18, 48, PAPER, 3) + p('M-9 7Q-5 14-2 7T5 10L9 5V2H-9Z', L) + line('M0 3V-5', D, 1.5) + p('M0-26Q-14-8 0 0Q14-8 0-26Z', L) + p('M0-15Q-5-5 0-1Q5-5 0-15Z', W);
  const window = (x, y, w, h) => r(x - 7, y - 7, w + 14, h + 14, D, w / 2) + r(x, y, w, h, SKY, w / 2) + e(x + w * .64, y + h * .28, 15, 15, L) + line(`M${x + w / 2} ${y + 2}V${y + h - 2}M${x} ${y + h * .6}H${x + w}`, W, 4);
  const desk = p('M-10 274 249 244 328 274 45 313Z', WOOD) + p('M-10 274 45 313 328 274V295L45 333-10 294Z', D);
  const shelf = r(0, 0, 97, 218, D, 3) + [0, 1, 2].map(row => {
    const y = row * 68 + 17;
    return r(5, y + 45, 87, 5, W) + [0, 1, 2, 3, 4].map(v => r(9 + v * 16, y + v % 2 * 8, 12, 45 - v % 2 * 8, [M, A, W, L, M][v], 1)).join('');
  }).join('');
  const trees = p('M0 343V60L23 42 28 343Z', D) + p('M10 145-43 81-32 72 14 125 64 55 72 61Z', D) + p('M282 343 287 48 304 39 321 343Z', D) + p('M294 125 245 63 252 50 299 105 333 62 343 73Z', D);
  const scenes = {
    'live-exchange': {
      colors: ['#262038', '#796a9a', '#efddbe', '#b2a3c7', '#b28674'],
      back: object('bench', r(22, 102, 266, 166, M, 30), r(40, 117, 230, 141, A, 24)),
      middle: object('conversation-table',
        object('left-player',
          p('M28 278Q28 229 54 218L76 217Q91 223 99 248L127 259 120 274 79 259 65 242 69 278Z', M),
          p('M53 196H69L72 223Q61 232 51 222Z', W),
          p('M45 166Q47 148 65 153L79 171 83 183 75 185 71 201Q58 212 47 192Z', W),
          p('M43 181Q28 148 56 139T83 168L72 174 67 157Q49 155 43 181Z', D)),
        object('right-player',
          p('M282 276Q280 226 258 216L239 214Q224 222 215 247L188 257 193 271 235 258 248 239 248 276Z', M),
          p('M242 194H259L263 220Q253 229 241 220Z', L),
          p('M239 162Q256 151 268 165L266 190Q257 210 242 201L237 185 230 182 237 173Z', L),
          p('M238 147Q273 138 278 171L266 184 263 165 238 165Z', D)),
        object('table', desk),
        object('shared-notes', p('M118 269 170 263 196 281 139 291Z', PAPER), line('m134 275 29-4m-20 11 29-4', W, 1.2)),
        object('left-pawn', e(71, 281, 15, 5, D), p('M62 278 66 254H76L80 278Z', W), e(71, 248, 8, 8, W)),
        object('right-pawn', e(245, 268, 15, 5, D), p('M236 265 240 241H250L254 265Z', A), e(245, 235, 8, 8, A))),
      front: ''
    },
    'thoughtful-roleplay': {
      colors: ['#1c2939', '#516c88', '#f3dfb7', '#94a6bc', '#b88e6b'],
      back: object('folding-screen', p('M15 58 117 35 153 59V279H15Z', M), p('M117 35 185 55V270L153 279V59Z', A)),
      middle: object('chair', p('M146 280V186Q145 152 108 154T68 185V280Z', D), p('M83 192Q104 179 132 192L126 245H89Z', A)),
      front: object('writing-desk',
        object('table', desk),
        object('lamp', e(217, 262, 29, 6, D, 'opacity=".2"'), e(217, 259, 25, 5, W), r(214, 145, 6, 114, W, 2), p('M174 151 199 81H235L260 151Z', PAPER), e(217, 151, 43, 7, W)),
        object('notebook', p('M69 269 124 299 240 279V285L124 305 69 275Z', W), p('M69 269 175 255 240 279 124 299Z', PAPER), line('m100 272 30-4m-15 12 53-8', W, 1.4)),
        object('pencil', p('M163 273 208 263 210 268 165 278Z', D), p('M157 277 163 273 165 278Z', L)))
    },
    'rich-scenes': {
      colors: ['#342533', '#90707e', '#f6e3c0', '#c9a5b1', '#bb8765'],
      back: object('scroll-rack', r(26, 52, 82, 214, M, 4), r(32, 58, 70, 195, D, 3),
        [0, 1, 2, 3].map(i => object('stored-scroll-' + i, g(38 + i * 16, 72, 1, r(0, 0, 12, 146, PAPER, 6) + e(6, 2, 6, 4, W) + r(-1, 96, 14, 8, W, 2))))),
      middle: '',
      front: object('scribe-desk',
        object('table', desk),
        object('scroll', e(151, 277, 81, 10, D, 'opacity=".2"'),
          p('M66 129Q82 119 101 129L105 165H220Q240 165 237 189L225 263Q224 274 211 274H97Q75 274 78 252L88 144 67 146Z', PAPER),
          p('M88 144 78 252Q75 274 97 274H211L213 265H105Q87 265 89 250L100 144Z', W),
          p('M65 129Q83 116 101 129V144Q82 152 65 143Z', L), e(83, 129, 18, 7, W), e(83, 129, 13, 3.5, D, 'opacity=".25"'),
          line('M113 185H210M111 197H198M110 209H205M108 221H173', W, 2)),
        object('ink-and-quill', e(244, 278, 23, 6, D, 'opacity=".2"'), r(226, 255, 34, 21, D, 4),
          p('M239 256 253 147Q266 107 287 105 289 138 261 169Z', A),
          line('M242 258 274 123', W, 2),
          e(243, 255, 17, 6, W), e(243, 255, 12, 3.5, D)))
    },
    'light-scenes': {
      colors: ['#18343d', '#518891', '#f6e5b6', '#9cc6c6', '#b69b6b'],
      back: object('wall', backdrop(M)),
      middle: object('doorway',
        r(54, 46, 167, 256, D, 3), r(67, 57, 140, 242, PAPER, 1), p('M67 223 138 184 207 203V299H67Z', A),
        object('door-light', p('M67 299 111 329 29 359-14 339Z', L, 'opacity=".25"')),
        object('threshold', p('M51 299H222L240 333H35Z', W), p('M35 333H240V343H35Z', D)),
        object('door-leaf', p('M207 57 111 87V329L207 299Z', WOOD), p('M193 80 126 101V307L193 286Z', M), r(132, 184, 5, 27, L, 2))),
      front: ''
    },
    'social-table': {
      colors: ['#302a2c', '#795d61', '#ffe0a4', '#b99b8a', '#bc7950'],
      back: object('woodland', p('M-32 233Q60 166 125 209T342 189V390H-32Z', M), trees),
      middle: object('left-camp-chair',
        line('M44 256 83 297M85 246 49 298', D, 5), p('M40 243 89 224 98 263 51 281Z', WOOD),
        line('M39 247 31 215M88 228 83 207', W, 6)),
      front: object('right-camp-chair',
        line('M264 256 225 297M223 246 260 298', D, 5), p('M214 224 265 243 253 281 205 263Z', WOOD),
        line('M222 228 227 207M262 247 278 215', W, 6)) +
        object('campfire', e(154, 236, 95, 102, GLOW), e(154, 300, 53, 12, D, 'opacity=".45"'),
          p('m111 286 87 23 4-12-87-23Z', WOOD), p('m112 306 89-25-4-12-89 25Z', WOOD),
          p('M129 287Q109 262 131 236 142 221 136 199 156 214 157 235 173 226 174 212 201 260 177 287Z', W),
          p('M140 287Q127 263 151 239 150 254 165 262 179 278 165 289Z', L)) +
        object('foreground-ground', p('M0 331Q88 310 154 335T310 327V390H0Z', D))
    },
    'scene-boundaries': {
      colors: ['#2c2035', '#865f86', '#f6dfc6', '#c49cad', '#b98d73'],
      back: object('theater-wall', backdrop(D)),
      middle: object('stage',
        r(22, 32, 266, 270, D, 2), e(155, 209, 110, 108, GLOW),
        object('stage-floor', p('M22 278 155 250 288 278V305H22Z', WOOD), r(14, 302, 282, 17, M), r(7, 319, 296, 18, D)),
        object('stool', e(155, 277, 33, 6, D, 'opacity=".2"'), r(133, 192, 8, 85, W, 2), r(169, 192, 8, 85, W, 2), r(138, 239, 35, 5, W, 2), r(125, 185, 60, 11, WOOD, 4)),
        object('curtains',
          p('M25 27H118Q118 111 84 178L67 287H22Z', M), p('M285 27H192Q192 111 226 178L243 287H288Z', M),
          p('M38 31Q59 124 31 192L37 273H51L47 187Q84 113 69 31Z', A), p('M272 31Q251 124 279 192L273 273H259L263 187Q226 113 241 31Z', A),
          p('M31 190 82 174 86 184 34 201Zm248 0-51-16-4 10 52 17Z', W),
          p('M15 17H295V46Q230 80 155 45 80 80 15 46Z', WOOD))),
      front: ''
    },
    'open-coordination': {
      colors: ['#1d3435', '#527e78', '#eee1b9', '#9abcb0', '#b48f68'],
      back: object('map-table', backdrop(WOOD)),
      middle: object('navigation-kit',
        object('map', p('M37 65 102 50 187 74 271 55 257 273 179 292 96 266 28 286Z', PAPER),
          p('M44 130Q95 81 122 136T208 102 250 152L243 224Q179 261 146 218T41 226Z', M),
          p('M102 50 96 266 179 292 187 74Z', W, 'opacity=".12"'),
          p('M64 177Q98 144 120 179T175 207Q201 213 229 163', 'none', `stroke="${L}" stroke-width="3" stroke-dasharray="2 7" stroke-linecap="round"`),
          e(64, 177, 5, 5, L), e(175, 207, 5, 5, L), e(229, 163, 5, 5, L)),
        object('compass', e(233, 282, 40, 10, D, 'opacity=".2"'), e(233, 267, 36, 36, W), e(233, 261, 34, 34, D), e(233, 261, 28, 28, PAPER),
          line('M233 235V239M233 283V287M207 261H211M255 261H259', W, 1.5),
          p('M233 239 241 261 233 283 225 261Z', M), p('M233 239 241 261H233Z', D), e(233, 261, 2.5, 2.5, L))),
      front: ''
    },
    'restful-session': {
      colors: ['#21352e', '#5f8f7b', '#f2e2b4', '#a8c4a2', '#bd9e77'],
      back: object('room', backdrop(M)),
      middle: object('sofa-setting',
        object('rug', p('M14 326 99 290 294 321 204 350Z', A)),
        object('sofa', e(155, 303, 116, 12, D, 'opacity=".15"'),
          r(44, 276, 10, 31, D, 2), r(253, 276, 10, 31, D, 2),
          r(36, 140, 238, 126, D, 28), r(44, 148, 222, 101, A, 22), r(32, 229, 246, 53, PAPER, 18),
          r(23, 187, 37, 103, W, 15), r(249, 187, 37, 103, W, 15),
          p('M65 167Q82 157 101 164L109 213Q85 224 65 212Z', L), p('M169 167Q193 154 224 169L229 207Q195 225 175 212Z', M),
          object('blanket', p('M111 226Q147 220 169 238V302Q136 316 104 300Z', M),
            p('M111 226Q144 229 153 244V307L169 302V238Q147 220 111 226Z', A), line('M114 292Q133 300 146 297', A, 1.5)))),
      front: ''
    },
    'focused-session': {
      colors: ['#292637', '#6b6384', '#f1dfbc', '#aaa0c3', '#c39d73'],
      back: object('wall', backdrop(M)),
      middle: object('hourglass-table',
        object('table', p('M18 290 226 268 302 288 78 321Z', WOOD), p('M18 290 78 321 302 288V305L78 338 18 305Z', D)),
        object('hourglass', e(158, 291, 56, 9, D, 'opacity=".2"'),
          p('M123 102H193Q190 162 163 185V196Q190 222 193 277H123Q126 222 153 196V185Q126 162 123 102Z', A, 'opacity=".5"'),
          p('M132 130H184Q177 164 158 179 139 164 132 130Z', L),
          p('M158 222Q146 243 133 273H183Q170 243 158 222Z', L), line('M158 179V230', L, 1.5),
          r(113, 98, 5, 184, W, 2), r(198, 98, 5, 184, W, 2), r(109, 88, 98, 14, WOOD, 4), r(109, 277, 98, 14, WOOD, 4))),
      front: ''
    },
    'cinematic-table': {
      colors: ['#26263b', '#6d6895', '#f0d6bd', '#b3a5d0', '#b99b87'],
      back: object('projection-screen', r(39, 48, 241, 211, D, 4), r(48, 58, 223, 188, PAPER, 2),
        p('M48 58H95Q101 147 73 199L67 246H48ZM271 58H224Q218 147 246 199L252 246H271Z', M),
        p('M82 228H244V246H82Z', A),
        object('projected-players', p('M115 228 124 149H140L147 228ZM192 228 198 173H210L216 228Z', D), e(132, 139, 11, 11, D), e(204, 165, 9, 9, D)),
        r(34, 43, 251, 8, W, 3)),
      middle: '',
      front: object('projection-desk',
        object('table', p('M0 305 310 278V620H0Z', D), p('M0 305 310 278V286L0 313Z', W)),
        object('projector', p('M170 269 252 137V245L170 280Z', L, 'opacity=".14"'),
          e(77, 226, 31, 31, D), e(132, 230, 26, 26, D),
          [0, 1, 2].map(i => e(77 + Math.cos(i * Math.PI * 2 / 3) * 16, 226 + Math.sin(i * Math.PI * 2 / 3) * 16, 7, 7, M)),
          [0, 1, 2].map(i => e(132 + Math.cos(i * Math.PI * 2 / 3) * 13, 230 + Math.sin(i * Math.PI * 2 / 3) * 13, 6, 6, M)),
          r(63, 250, 7, 13, D), r(129, 251, 7, 12, D), r(43, 255, 107, 45, WOOD, 6),
          p('M150 264 173 269V288L150 294Z', D), r(55, 265, 16, 10, A, 2)),
        object('mixing-console', p('M200 293 263 286 284 303 221 311Z', A),
          [0, 1, 2].map(i => line('M' + (215 + i * 15) + ' ' + (293 - i * 1.7) + 'l10 10', D, 2) + p('m' + (216 + i * 15) + ' ' + (296 - i * 1.7) + ' 6-.7 3 3-6 .7Z', L))))
    },
    'quiet-roleplay': {
      colors: ['#1d2c38', '#586f83', '#f2dfb8', '#9db0bb', '#b99472'],
      back: object('left-bookshelf', g(18, 35, 1, shelf)) + object('right-bookshelf', g(224, 35, 1, shelf)) + object('window', window(133, 33, 74, 203)),
      middle: object('reading-desk',
        object('table', desk), object('open-book', g(172, 252, .78, book, -7)),
        object('candle', e(65, 225, 39, 48, GLOW), g(65, 227, .78, candle))),
      front: ''
    },
    'planned-party': {
      colors: ['#312737', '#8e7489', '#f7e4c6', '#c9adb7', '#c19a76'],
      back: object('wall', backdrop(SKY)),
      middle: object('planning-desk',
        object('table', p('M0 302 310 247V620H0Z', WOOD)),
        object('calendar', e(151, 283, 104, 10, D, 'opacity=".2"'),
          p('M58 73H257L269 282H46Z', D),
          // 종이·머리글·날짜·고리에 같은 기울기를 적용합니다.
          '<g transform="translate(58 69) skewX(-3)">',
          r(-3, 4, 202, 207, W, 2), r(0, 0, 196, 201, PAPER, 2), r(0, 0, 196, 42, M),
          r(25, -19, 9, 39, D, 4), r(162, -19, 9, 39, D, 4),
          [0, 1, 2].map(row => [0, 1, 2, 3].map(col => r(15 + col * 42, 61 + row * 39, 25, 23, (row === 1 && col === 2) ? W : A, 3))),
          line('M104 112 110 118 120 106', D, 2.5), '</g>'),
        object('envelope', p('M25 294 78 281 104 294 46 308Z', PAPER), line('M25 294 64 298 78 281', W, 1.4)),
        object('pencil', p('M141 294 217 273 219 278 143 299Z', D), p('M135 298 141 294 143 299Z', L))),
      front: ''
    },
    'steady-adventure': {
      colors: ['#23343a', '#597f8c', '#efe0b7', '#a4b9af', '#baa184'],
      back: object('mountains', p('M-20 260 93 80 166 220 228 131 335 274V390H-20Z', M),
        p('M93 80 166 220 129 181 121 142Z', D, 'opacity=".3"'), p('M70 117 93 80 113 118 92 108Z', L), p('M205 167 228 131 248 168 226 160Z', A)),
      middle: object('trail', p('M-15 306Q51 209 123 258T244 230 329 281V390H-15Z', A),
        p('M61 351Q218 301 149 274 120 260 196 229 94 252 125 282 166 306 9 351Z', L),
        object('signpost', p('M53 278V195H63V278Z', WOOD), p('M35 196 82 183 90 193 83 204 35 216Z', W), e(58, 199, 2, 2, D))),
      front: object('foreground-hill', p('M-20 333Q45 279 103 327T214 308 330 331V390H-20Z', M),
        p('M11 334 27 253 43 334Zm247 4 24-100 23 100Z', D), p('M-3 333Q18 297 31 311T54 348Z', A))
    }
  };
  const palette = id => (scenes[id] || scenes['steady-adventure']).colors.map((color, i) => '--art-' + i + ':' + color).join(';');
  let serial = 0;
  function render(id) {
    const scene = scenes[id] || scenes['steady-adventure'];
    const prefix = 'handout-' + (++serial) + '-';
    const layers = [backdrop(SKY), scene.back, scene.middle, scene.front];
    return '<div class="handout-art" data-art="' + id + '" style="' + palette(id) + '" aria-hidden="true">' + layers.map((content, i) => {
      const key = prefix + i + '-';
      const defs = `<defs><linearGradient id="${key}sky" x2=".25" y2="1"><stop stop-color="${scene.colors[3]}"/><stop offset=".52" stop-color="${scene.colors[1]}"/><stop offset="1" stop-color="${scene.colors[0]}"/></linearGradient><linearGradient id="${key}wood" x2="0" y2="1"><stop stop-color="${scene.colors[4]}"/><stop offset="1" stop-color="${scene.colors[1]}"/></linearGradient><linearGradient id="${key}paper" x2=".7" y2="1"><stop stop-color="${scene.colors[2]}"/><stop offset="1" stop-color="${scene.colors[4]}"/></linearGradient><radialGradient id="${key}glow"><stop stop-color="${scene.colors[2]}" stop-opacity=".38"/><stop offset="1" stop-color="${scene.colors[2]}" stop-opacity="0"/></radialGradient></defs>`;
      // 카드 설명이 길어져도 원과 물체의 비율은 유지하고, 바탕만 카드 전체로 늘립니다.
      return '<svg class="handout-art-layer handout-art-' + (i === 0 ? 'orbit' : i - 1) + '" viewBox="0 0 310 620" preserveAspectRatio="' + (i === 0 ? 'none' : 'xMidYMin meet') + '" fill="none" focusable="false">' + defs + content.replaceAll('#@', '#' + key) + '</svg>';
    }).join('') + '</div>';
  }
  globalThis.TRPGHandoutArt = { render, scenes, palette };
})();
