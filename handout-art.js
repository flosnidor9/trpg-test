/* Filled editorial SVG scenes, separated into four planes for recessed parallax. */
(() => {
  'use strict';
  const D = 'var(--art-0)', M = 'var(--art-1)', L = 'var(--art-2)', A = 'var(--art-3)', W = 'var(--art-4)';
  const PAPER = 'url(#@paper)', SKY = 'url(#@sky)', WOOD = 'url(#@wood)', GLOW = 'url(#@glow)';
  const p = (d, fill, extra = '') => `<path d="${d}" fill="${fill}" ${extra}/>`;
  const r = (x, y, w, h, fill, radius = 0) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${radius}" fill="${fill}"/>`;
  const e = (x, y, rx, ry, fill, extra = '') => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${fill}" ${extra}/>`;
  const line = (d, color = W, width = 1.4) => `<path d="${d}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round"/>`;
  const g = (x, y, scale, content, rotate = 0) => `<g transform="translate(${x} ${y}) scale(${scale}) rotate(${rotate})">${content}</g>`;
  const plant = line('M0 122Q-4 54 7 0', M, 3) + p('M4 30Q-39-14-43 11T4 48M3 53Q43 3 50 29T3 70M1 78Q-48 33-51 65T1 94M0 98Q40 52 43 80T0 113', A) + p('M-27 113H28L20 158H-19Z', WOOD) + e(0, 113, 28, 7, W);
  const books = r(0, 0, 68, 13, W, 2) + r(5, 13, 73, 10, L, 2) + r(-7, 23, 71, 16, A, 2) + r(-4, 27, 60, 8, PAPER, 1);
  const cup = e(0, 27, 25, 6, D, 'opacity=".2"') + `<circle cx="21" cy="8" r="10" fill="none" stroke="${W}" stroke-width="6"/>` + p('M-21 0H21V14Q21 31 0 31T-21 14Z', PAPER) + e(0, 0, 21, 5, W) + e(0, 0, 17, 3, D);
  const book = e(0, 58, 86, 12, D, 'opacity=".22"') + p('M-84 5Q-40-14 0 5Q40-14 84 5L78 60Q35 44 0 64Q-35 44-78 60Z', W) + p('M-80 0Q-40-20 0 0V58Q-39 37-75 51Z', PAPER) + p('M0 0Q40-20 80 0L75 51Q39 37 0 58Z', L) + line('M0 0V58', W, 2) + line('M-65 13Q-37 4-14 14M-63 24Q-37 15-14 25M-61 35Q-37 26-14 36M14 14Q37 4 65 13M14 25Q37 15 63 24M14 36Q37 26 61 35', W, 1.1);
  const candle = e(0, 53, 19, 5, D, 'opacity=".2"') + r(-9, 2, 18, 48, PAPER, 3) + p('M-9 7Q-5 14-2 7T5 10L9 5V2H-9Z', L) + p('M0-26Q-14-8 0 0Q14-8 0-26Z', L) + p('M0-15Q-5-5 0-1Q5-5 0-15Z', W);
  const window = (x, y, w, h) => r(x - 7, y - 7, w + 14, h + 14, D, w / 2) + r(x, y, w, h, SKY, w / 2) + line(`M${x + w / 2} ${y + 9}V${y + h}M${x} ${y + h * .6}H${x + w}`, W, 4);
  const hills = p('M-15 278Q56 181 112 217T226 202 325 250V350H-15Z', M) + p('M-20 305Q43 242 109 277T248 253 330 287V350H-20Z', A);
  const desk = p('M-10 274 249 244 328 274 45 313Z', WOOD) + p('M-10 274 45 313 328 274V295L45 333-10 294Z', D);
  const shelf = r(0, 0, 97, 218, D, 3) + [0, 1, 2].map(row => {
    const y = row * 68 + 17;
    return r(5, y + 45, 87, 5, W) + [0, 1, 2, 3, 4].map(v => r(9 + v * 16, y + v % 2 * 8, 12, 45 - v % 2 * 8, [M, A, W, L, M][v], 1)).join('');
  }).join('');
  const trees = p('M0 343V60L23 42 28 343Z', D) + p('M10 145-43 81-32 72 14 125 64 55 72 61Z', D) + p('M282 343 287 48 304 39 321 343Z', D) + p('M294 125 245 63 252 50 299 105 333 62 343 73Z', D);
  const scenes = {
    'live-exchange': {
      colors: ['#262038', '#796a9a', '#efddbe', '#b2a3c7', '#b28674'],
      back: window(64, 35, 180, 209) + e(172, 99, 26, 26, L) + p('M66 188Q122 130 164 169T244 180V244H66Z', M),
      middle: p('M28 273Q27 222 68 217L86 252 130 264 118 281 68 259Z', A) + p('M62 152Q31 163 46 194L59 207 74 202 81 173Z', W) + p('M43 180Q27 146 57 138T83 168L72 172 67 157Q46 156 43 180Z', D) + p('M69 202 71 224 53 230 51 202Z', W) + p('M282 267Q281 218 245 214L228 253 185 265 190 283 248 260Z', M) + p('M254 157Q279 166 268 194L254 207 238 199 235 173Z', L) + p('M241 144Q277 139 278 174L265 184 262 164 238 164Z', D) + p('M243 200 244 222 262 229 265 197Z', L),
      front: desk + g(153, 272, .38, book, -7) + g(72, 269, .5, cup) + g(249, 251, .45, cup) + g(278, 245, .42, plant)
    },
    'thoughtful-roleplay': {
      colors: ['#1c2939', '#516c88', '#f3dfb7', '#94a6bc', '#b88e6b'],
      back: window(27, 33, 133, 215) + e(111, 91, 27, 27, L) + e(122, 79, 25, 25, M) + p('M29 202Q65 155 112 187T159 198V248H29Z', M) + g(196, 32, .94, shelf),
      middle: p('M146 280V186Q145 152 108 154T68 185V280Z', D) + p('M83 192Q104 179 132 192L126 245H89Z', A) + r(214, 140, 5, 128, W, 2) + p('M174 151 199 81H234L260 151Z', PAPER) + e(217, 151, 43, 8, W) + e(214, 269, 29, 5, D),
      front: desk + g(147, 263, .72, book, -7) + g(250, 273, .55, cup) + g(21, 242, .66, plant) + g(64, 292, .5, books, -7)
    },
    'rich-scenes': {
      colors: ['#342533', '#90707e', '#f6e3c0', '#c9a5b1', '#bb8765'],
      back: window(43, 22, 224, 258) + e(151, 105, 40, 40, L) + p('M46 213 97 136 151 191 190 143 264 220V280H46Z', M) + p('M46 259Q109 187 172 237T264 230V280H46Z', A),
      middle: e(156, 272, 120, 21, D, 'opacity=".2"') + p('M65 122Q88 109 102 127L104 166H220Q245 166 246 190L231 266H95Q71 260 75 237L84 157 66 148Z', PAPER) + e(81, 128, 18, 8, W) + p('M95 147 88 230Q85 252 109 255H231L228 266H98Q70 261 75 238L84 150Z', W) + line('M109 185H205M107 197H194M105 209H206M103 221H172', W, 2),
      front: desk + g(254, 273, .55, candle) + g(55, 283, .72, books, -8) + p('M214 249 246 140Q270 90 286 105 280 143 246 169Z', A) + p('M217 249 263 118 224 249Z', W) + e(211, 258, 17, 10, D) + r(194, 258, 34, 19, D, 3)
    },
    'light-scenes': {
      colors: ['#18343d', '#518891', '#f6e5b6', '#9cc6c6', '#b69b6b'],
      back: e(239, 91, 35, 35, L) + hills + p('M22 280V112Q22 37 91 37T160 112V280Z', D) + p('M37 280V114Q37 54 91 54T145 114V280Z', SKY),
      middle: p('M142 73 73 107V293L142 260Z', WOOD) + p('M129 96 87 119V263L129 241Z', M) + r(110, 167, 5, 29, L, 2) + p('M34 279H161L176 296H21Z', W) + p('M23 296H176V308H23Z', D) + p('M170 293 198 277 221 288 192 304Z', L) + p('M220 323 248 307 271 318 242 334Z', L),
      front: p('M-10 332Q48 273 85 305T189 326 330 290V366H-10Z', M) + g(275, 280, .65, plant) + p('M17 337Q-10 268 22 247 39 278 17 337M19 338Q44 294 65 310 51 333 19 338', A)
    },
    'social-table': {
      colors: ['#302a2c', '#795d61', '#ffe0a4', '#b99b8a', '#bc7950'],
      back: e(154, 193, 135, 135, GLOW) + e(218, 76, 26, 26, L) + p('M0 233Q60 166 125 209T310 189V340H0Z', M) + trees,
      middle: p('M40 243 89 224 103 269 53 291Z', WOOD) + p('M214 224 265 243 253 291 200 269Z', WOOD) + p('M39 247 28 215 36 211 49 244Zm223 0 19-32-8-4-18 33Z', W) + e(154, 283, 52, 13, D) + p('M128 281Q105 256 129 229 140 217 134 191 155 206 156 229 170 221 174 202 207 261 178 282Z', W) + p('M139 280Q124 252 151 222 149 245 168 250 182 268 166 280Z', L),
      front: p('m110 294 83 19 7-13-85-19Zm4 21 87-28-5-13-87 28Z', WOOD) + g(68, 299, .53, cup) + p('M0 324Q88 303 154 328T310 320V370H0Z', D) + p('M-3 301Q22 259 41 275 33 306-3 319M301 312Q281 261 266 278 270 304 301 326', A)
    },
    'scene-boundaries': {
      colors: ['#2c2035', '#865f86', '#f6dfc6', '#c49cad', '#b98d73'],
      back: r(22, 32, 266, 287, D, 2) + e(157, 216, 111, 115, GLOW) + p('M26 282 155 253 288 282 155 320Z', WOOD),
      middle: p('M25 27H118Q118 111 84 178L67 287H22Z', M) + p('M285 27H192Q192 111 226 178L243 287H288Z', M) + p('M38 31Q59 124 31 192L37 273H51L47 187Q84 113 69 31Z', A) + p('M272 31Q251 124 279 192L273 273H259L263 187Q226 113 241 31Z', A) + p('M45 192 83 174 87 185 48 203Zm220 0-38-18-4 11 39 18Z', W),
      front: p('M0 17H310V46Q230 82 155 45 80 82 0 46Z', WOOD) + p('M-3 300H313V320H-3Z', M) + p('M-3 320H313V337H-3Z', D) + g(155, 238, .6, book) + g(155, 225, .46, candle)
    },
    'open-coordination': {
      colors: ['#1d3435', '#527e78', '#eee1b9', '#9abcb0', '#b48f68'],
      back: r(0, 0, 310, 350, WOOD) + p('M0 65 310 20V40L0 85Zm0 132 310 87v19L0 152Zm0 150 310-45v18L0 315Z', D, 'opacity=".1"'),
      middle: p('M37 65 102 50 187 74 271 55 257 273 179 292 96 266 28 286Z', PAPER) + p('M102 50 96 266 179 292 187 74Z', W, 'opacity=".2"') + p('M44 130Q95 81 122 136T208 102 250 152L243 224Q179 261 146 218T41 226Z', M) + p('M64 177Q98 144 120 179T175 207 229 163', 'none', `stroke="${W}" stroke-width="3" stroke-dasharray="2 7" stroke-linecap="round"`) + e(64, 177, 5, 5, L) + e(174, 207, 5, 5, L) + e(229, 163, 5, 5, L),
      front: e(234, 277, 45, 12, D, 'opacity=".2"') + e(233, 264, 36, 36, W) + e(233, 261, 30, 30, D) + e(233, 261, 26, 26, PAPER) + p('m233 237 8 24-8 24-8-24Z', M) + p('m233 237 8 24h-8Z', D) + g(44, 285, .64, books, -8) + g(284, 239, .39, cup)
    },
    'restful-session': {
      colors: ['#21352e', '#5f8f7b', '#f2e2b4', '#a8c4a2', '#bd9e77'],
      back: e(219, 76, 39, 39, L) + hills + trees,
      middle: p('M30 163Q151 225 281 153 220 307 147 280 77 254 30 163Z', PAPER) + p('M30 163Q146 239 281 153 191 273 106 235Z', W) + p('M54 181Q123 277 198 262L186 274Q118 273 54 181Z', A) + p('M105 215Q124 191 157 214L164 240Q132 231 105 215Z', M),
      front: p('M190 282 288 267 309 282 209 299Z', WOOD) + p('M209 299 309 282V293L209 310Z', D) + g(248, 278, .63, cup) + g(26, 278, .69, plant) + p('M0 335Q88 296 179 330T310 314V372H0Z', M)
    },
    'focused-session': {
      colors: ['#292637', '#6b6384', '#f1dfbc', '#aaa0c3', '#c39d73'],
      back: window(77, 20, 179, 261) + e(211, 83, 23, 23, L) + g(13, 81, .55, shelf),
      middle: e(158, 280, 65, 14, D, 'opacity=".2"') + p('M119 101H196Q191 164 166 190 192 217 196 280H119Q122 217 149 190 123 164 119 101Z', A, 'opacity=".5"') + p('M129 128H186Q178 168 158 177 139 167 129 128Zm29 71Q142 228 131 262H185Q174 225 158 199Z', L) + r(109, 88, 97, 14, WOOD, 4) + r(109, 277, 97, 14, WOOD, 4) + r(113, 100, 5, 177, W, 2) + r(197, 100, 5, 177, W, 2) + line('M158 179V199', L, 2),
      front: desk + g(65, 274, .58, books) + g(250, 273, .5, cup) + p('m235 283 44-12 2 5-44 12Z', W)
    },
    'cinematic-table': {
      colors: ['#26263b', '#6d6895', '#f0d6bd', '#b3a5d0', '#b99b87'],
      back: r(39, 48, 241, 211, D, 4) + r(48, 58, 223, 188, SKY, 2) + e(229, 101, 26, 26, L) + p('M48 219 105 133 144 180 181 111 271 210V246H48Z', M) + p('M48 227Q119 179 172 218T271 219V246H48Z', A) + r(34, 43, 251, 8, W, 3),
      middle: p('M81 261 252 137 252 245Z', L, 'opacity=".14"') + e(77, 226, 31, 31, D) + e(124, 227, 26, 26, D) + [0,1,2].map(i => e(77 + Math.cos(i * 2.1) * 16, 226 + Math.sin(i * 2.1) * 16, 7, 7, M)).join('') + [0,1,2].map(i => e(124 + Math.cos(i * 2.1) * 13, 227 + Math.sin(i * 2.1) * 13, 6, 6, M)).join('') + r(43, 251, 107, 50, WOOD, 6) + p('M150 262 173 268V288L150 294Z', D) + r(55, 261, 16, 10, A, 2),
      front: p('M0 305 310 278V350H0Z', D) + p('M0 307 310 280V288L0 315Z', W) + p('M13 0H35V277L13 304ZM283 0H310V284L283 276Z', M) + g(254, 294, .55, books, -5)
    },
    'quiet-roleplay': {
      colors: ['#1d2c38', '#586f83', '#f2dfb8', '#9db0bb', '#b99472'],
      back: g(21, 35, 1.06, shelf) + g(219, 35, 1.03, shelf) + window(135, 33, 74, 203) + e(175, 91, 18, 18, L) + e(182, 83, 18, 18, M),
      middle: desk + g(149, 245, .94, book, -7) + e(76, 213, 41, 52, GLOW) + g(79, 227, .78, candle) + g(250, 263, .67, books, -4),
      front: g(272, 286, .66, cup) + g(26, 278, .65, plant) + p('m194 280 43-12 2 5-43 12Z', W)
    },
    'planned-party': {
      colors: ['#312737', '#8e7489', '#f7e4c6', '#c9adb7', '#c19a76'],
      back: r(0, 0, 310, 350, SKY) + p('M0 302 310 247V350H0Z', WOOD) + g(279, 201, .75, plant),
      middle: e(150, 293, 108, 13, D, 'opacity=".2"') + p('M52 73H258L247 281H42Z', W) + p('M57 69H253L242 270H47Z', PAPER) + p('M57 69H253L250 111H55Z', M) + r(82, 50, 9, 39, D, 4) + r(219, 50, 9, 39, D, 4) + [0,1,2].map(row=>[0,1,2,3].map(col=>r(67+col*42, 130+row*39, 25, 23, (row===1&&col===2)?W:A, 3)).join('')).join('') + line('m158 180 6 6 12-13', D, 2.5),
      front: g(63, 288, .6, books, -8) + g(262, 279, .6, cup) + p('m137 299 80-22 2 5-80 22Z', D) + p('m135 300 7-7 2 5Z', L)
    },
    'steady-adventure': {
      colors: ['#23343a', '#597f8c', '#efe0b7', '#a4b9af', '#baa184'],
      back: e(222, 79, 40, 40, L) + p('M-20 260 93 80 166 220 228 131 335 274V350H-20Z', M) + p('M93 80 166 220 129 181 121 142Z', D, 'opacity=".3"') + p('m70 117 23-37 20 38-21-10Z', L) + p('m205 167 23-36 20 37-22-8Z', A),
      middle: p('M-15 306Q51 209 123 258T244 230 329 281V356H-15Z', A) + p('M61 351Q218 301 149 274 120 260 196 229 94 252 125 282 166 306 9 351Z', L) + p('M53 275V191H63V278Z', WOOD) + p('M35 196 82 183 90 193 83 204 35 216Z', W),
      front: p('M-20 333Q45 279 103 327T214 308 330 331V367H-20Z', M) + p('M11 334 27 253 43 334Zm247 4 24-100 23 100Z', D) + p('M-3 333Q18 297 31 311T54 348Z', A)
    }
  };
  const palette = id => (scenes[id] || scenes['steady-adventure']).colors.map((color, i) => '--art-' + i + ':' + color).join(';');
  let serial = 0;
  function render(id) {
    const scene = scenes[id] || scenes['steady-adventure'];
    const prefix = 'handout-' + (++serial) + '-';
    const layers = [r(0, 0, 310, 620, SKY), scene.back, scene.middle, scene.front];
    return '<div class="handout-art" data-art="' + id + '" style="' + palette(id) + '" aria-hidden="true">' + layers.map((content, i) => {
      const key = prefix + i + '-';
      const defs = `<defs><linearGradient id="${key}sky" x2=".25" y2="1"><stop stop-color="${scene.colors[3]}"/><stop offset=".52" stop-color="${scene.colors[1]}"/><stop offset="1" stop-color="${scene.colors[0]}"/></linearGradient><linearGradient id="${key}wood" x2="0" y2="1"><stop stop-color="${scene.colors[4]}"/><stop offset="1" stop-color="${scene.colors[1]}"/></linearGradient><linearGradient id="${key}paper" x2=".7" y2="1"><stop stop-color="${scene.colors[2]}"/><stop offset="1" stop-color="${scene.colors[4]}"/></linearGradient><radialGradient id="${key}glow"><stop stop-color="${scene.colors[2]}" stop-opacity=".38"/><stop offset="1" stop-color="${scene.colors[2]}" stop-opacity="0"/></radialGradient></defs>`;
      return '<svg class="handout-art-layer handout-art-' + (i === 0 ? 'orbit' : i - 1) + '" viewBox="0 0 310 620" preserveAspectRatio="none" fill="none" focusable="false">' + defs + content.replaceAll('#@', '#' + key) + '</svg>';
    }).join('') + '</div>';
  }
  globalThis.TRPGHandoutArt = { render, scenes, palette };
})();
