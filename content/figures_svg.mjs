// Рисунки задач банка, нарисованные вручную в SVG (там, где в оригинале рисунка нет, он мелкий,
// или оригинал — фото, но рисунок однозначно следует из условия). Цвета: currentColor (линии) + акценты,
// чтобы рисунок читался на тёмной теме сайта. Проверено: рисунок не выдаёт ответ и не противоречит ему.
const W = (w, h, body) => `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" font-family="Nunito, sans-serif" font-weight="800" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
const T = (x, y, s, size = 16, anchor = 'middle', color = 'currentColor') => `<text x="${x}" y="${y}" font-size="${size}" text-anchor="${anchor}" fill="${color}" stroke="none">${s}</text>`;
const dot = (x, y, r = 3.5, c = 'currentColor') => `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}" stroke="none"/>`;
const GOLD = '#ffc94a', CYAN = '#3ff0ff', PINK = '#ff4fb8', SHADE = 'rgba(63,240,255,.28)';

function ray(cx, cy, deg, len) { const a = (deg * Math.PI) / 180; return [cx + Math.cos(a) * len, cy - Math.sin(a) * len]; }

export const FIGURES_SVG = {
  // Дарын 2025 №30 — числовая ось: b далеко слева, 0, a близко справа
  'daryn2025-30': W(340, 80, `<line x1="10" y1="40" x2="325" y2="40"/><path d="M318 34 L328 40 L318 46" /><line x1="60" y1="33" x2="60" y2="47"/><line x1="210" y1="33" x2="210" y2="47"/><line x1="245" y1="33" x2="245" y2="47"/>${T(60, 72, 'b', 20)}${T(210, 72, '0', 20)}${T(245, 72, 'a', 20)}`),

  // Дарын 2024 №36 — большой равносторонний треугольник со стороной 5, сетка маленьких треугольников
  'daryn2024-36': (() => {
    const s = 44, h = s * Math.sqrt(3) / 2, x0 = 20, y0 = 10 + 5 * h; let p = '';
    const P = (i, j) => [x0 + s * (i + j / 2), y0 - h * j]; // i — по основанию, j — вверх
    for (let j = 0; j <= 5; j++) { const [a, b] = P(0, j), [c, d] = P(5 - j, j); p += `<line x1="${a}" y1="${b}" x2="${c}" y2="${d}"/>`; }
    for (let i = 0; i <= 5; i++) { const [a, b] = P(i, 0), [c, d] = P(i, 5 - i); p += `<line x1="${a}" y1="${b}" x2="${c}" y2="${d}"/>`; const [e, f] = P(0, i), [g, k] = P(i, 0); p += `<line x1="${e}" y1="${f}" x2="${g}" y2="${k}"/>`; }
    return W(260, y0 + 34, p + T(130, y0 + 26, '5 дм', 16));
  })(),

  // Дарын 2023 №22 — три прямые через O: KL (гориз.), NP (верт.), AB; ∠KOB = 34° (B — между K и P)
  'daryn2023-22': (() => {
    const c = 150, L = 115; const [bx, by] = ray(c, c, 214, L), [ax, ay] = ray(c, c, 34, L);
    const arc = ray(c, c, 214, 34);
    return W(300, 300, `<line x1="${c - L}" y1="${c}" x2="${c + L}" y2="${c}"/><line x1="${c}" y1="${c - L}" x2="${c}" y2="${c + L}"/><line x1="${bx}" y1="${by}" x2="${ax}" y2="${ay}"/>
      <path d="M${c - 34} ${c} A34 34 0 0 0 ${arc[0]} ${arc[1]}" stroke="${GOLD}"/>${T(c - 52, c + 22, '34°', 14, 'middle', GOLD)}
      <rect x="${c}" y="${c - 14}" width="14" height="14" stroke-width="1.5"/>${dot(c, c)}
      ${T(c - L - 8, c + 6, 'K', 18, 'end')}${T(c + L + 8, c + 6, 'L', 18, 'start')}${T(c, c - L - 8, 'N', 18)}${T(c, c + L + 22, 'P', 18)}
      ${T(bx - 10, by + 16, 'B', 18)}${T(ax + 10, ay - 4, 'A', 18)}${T(c + 18, c + 22, 'O', 16)}`);
  })(),

  // Дарын 2023 №32 — таблица x (сағ/ч) и y (мин)
  'daryn2023-32': W(340, 120, `<rect x="2" y="2" width="336" height="116" rx="6"/><line x1="2" y1="60" x2="338" y2="60"/><line x1="112" y1="2" x2="112" y2="118"/><line x1="187" y1="2" x2="187" y2="118"/><line x1="262" y1="2" x2="262" y2="118"/>
    ${T(57, 38, 'x, сағ/ч', 17)}${T(57, 96, 'y, мин', 17)}${T(150, 40, '1/2', 22)}${T(225, 40, '2/3', 22)}${T(300, 40, '7/20', 22)}${T(150, 98, '30', 22)}${T(225, 98, '40', 22)}${T(300, 98, '21', 22)}`),

  // Дарын 2023 №50 — три пересекающихся круга (без чисел в областях — их нужно найти)
  'daryn2023-50': W(300, 260, `<circle cx="115" cy="100" r="72" stroke="${CYAN}" fill="rgba(63,240,255,.10)"/><circle cx="185" cy="100" r="72" stroke="${PINK}" fill="rgba(255,79,184,.10)"/><circle cx="150" cy="160" r="72" stroke="${GOLD}" fill="rgba(255,201,74,.10)"/>
    ${T(70, 22, 'Музыка 11', 15, 'middle', CYAN)}${T(232, 22, 'Өнер 7', 15, 'middle', PINK)}${T(150, 252, 'Спорт 12', 15, 'middle', GOLD)}`),

  // Bolashak 1 №6 — треугольник TLR, P на TL, Q на TR, PR и QL пересекаются в M, основание LR
  'bolashak1-06': (() => {
    const Tp = [150, 20], Lp = [30, 230], Rp = [270, 230], P = [90, 125], Q = [210, 125];
    const M = [150, 160]; // PR ∩ QL: по симметрии x = 150, на PR при x = 150 → y = 125 + 105/3
    const seg = (a, b) => `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}"/>`;
    return W(300, 260, seg(Tp, Lp) + seg(Tp, Rp) + seg(Lp, Rp) + seg(P, Rp) + seg(Q, Lp) +
      [Tp, Lp, Rp, P, Q, M].map(p => dot(p[0], p[1], 5, GOLD)).join('') +
      T(150, 14, 'T', 16) + T(18, 248, 'L', 16) + T(282, 248, 'R', 16) + T(74, 124, 'P', 16) + T(226, 124, 'Q', 16) + T(150, 196, 'M', 16));
  })(),

  // Bolashak 1 №12 — 10 монет треугольником 1-2-3-4
  'bolashak1-12': (() => {
    const r = 24, dx = 52, dy = 45; let p = '';
    for (let row = 0; row < 4; row++) for (let k = 0; k <= row; k++) {
      const x = 150 + (k - row / 2) * dx, y = 32 + row * dy;
      p += `<circle cx="${x}" cy="${y}" r="${r}" fill="rgba(255,201,74,.25)" stroke="${GOLD}"/>`;
    }
    return W(300, 200, p);
  })(),

  // Bolashak 1 №13 — сетка 3×3 перевёрнутых карточек, стрелки вправо и вверх (от меньшего к большему)
  'bolashak1-13': (() => {
    const s = 56, g = 40, x0 = 30, y0 = 20; let p = '';
    const X = i => x0 + i * (s + g), Y = j => y0 + (2 - j) * (s + g); // j=0 — нижний ряд
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
      p += `<rect x="${X(i)}" y="${Y(j)}" width="${s}" height="${s}" rx="6" fill="rgba(63,240,255,.12)"/>`;
      if (i < 2) p += `<line x1="${X(i) + s + 4}" y1="${Y(j) + s / 2}" x2="${X(i + 1) - 6}" y2="${Y(j) + s / 2}"/><path d="M${X(i + 1) - 13} ${Y(j) + s / 2 - 6} L${X(i + 1) - 5} ${Y(j) + s / 2} L${X(i + 1) - 13} ${Y(j) + s / 2 + 6}"/>`;
      if (j < 2) p += `<line x1="${X(i) + s / 2}" y1="${Y(j) - 4}" x2="${X(i) + s / 2}" y2="${Y(j + 1) + s + 6}"/><path d="M${X(i) + s / 2 - 6} ${Y(j + 1) + s + 13} L${X(i) + s / 2} ${Y(j + 1) + s + 5} L${X(i) + s / 2 + 6} ${Y(j + 1) + s + 13}"/>`;
    }
    p += T(X(0) + s / 2, Y(0) + s / 2 + 8, 'M', 24, 'middle', GOLD) + T(X(2) + s / 2, Y(2) + s / 2 + 8, 'N', 24, 'middle', GOLD);
    return W(340, 330, p);
  })(),

  // Bolashak 1 №14 — таблица 5×5 с данными клетками
  'bolashak1-14': (() => {
    const s = 44, x0 = 10, y0 = 10, given = { '1,1': 3, '1,2': 4, '1,5': 5, '2,1': 2, '5,5': 4 }; let p = '';
    for (let r = 1; r <= 5; r++) for (let c = 1; c <= 5; c++) {
      const x = x0 + (c - 1) * s, y = y0 + (r - 1) * s, v = given[`${r},${c}`];
      p += `<rect x="${x}" y="${y}" width="${s}" height="${s}"${r === 3 && c === 3 ? ` fill="${SHADE}" stroke="${GOLD}"` : ''}/>`;
      if (v) p += T(x + s / 2, y + s / 2 + 8, v, 22);
      if (r === 3 && c === 3) p += T(x + s / 2, y + s / 2 + 8, '?', 22, 'middle', GOLD);
    }
    return W(240, 240, p);
  })(),

  // Bolashak 1 №23 — квадрат, две средние линии и квадрат, соединяющий середины сторон
  'bolashak1-23': W(220, 220, `<rect x="10" y="10" width="200" height="200"/><line x1="110" y1="10" x2="110" y2="210"/><line x1="10" y1="110" x2="210" y2="110"/><path d="M110 10 L210 110 L110 210 L10 110 Z"/>`),

  // Bolashak 1 №32 — фигурка (полоска из 4 клеток) и поле 9×9
  'bolashak1-32': (() => {
    const s = 22; let p = '';
    for (let i = 0; i < 4; i++) p += `<rect x="${10 + i * s}" y="10" width="${s}" height="${s}" fill="rgba(255,201,74,.35)" stroke="${GOLD}"/>`;
    for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) p += `<rect x="${120 + c * s}" y="${10 + r * s}" width="${s}" height="${s}" stroke-width="1"/>`;
    p += `<rect x="120" y="10" width="${9 * s}" height="${9 * s}" stroke-width="3"/>` + T(54, 60, 'фигурка', 13) + T(219, 222, '9 × 9', 14);
    return W(330, 230, p);
  })(),

  // Bolashak 1 №39 — развёртка куба: 1 над закрашенной, ряд 2-■-3-4, 5 под закрашенной
  'bolashak1-39': (() => {
    const s = 56, x0 = 16, y0 = 10; let p = '';
    const sq = (c, r, label, shaded) => `<rect x="${x0 + c * s}" y="${y0 + r * s}" width="${s}" height="${s}"${shaded ? ` fill="rgba(255,255,255,.55)"` : ''}/>` + (label ? T(x0 + c * s + s / 2, y0 + r * s + s / 2 + 8, label, 22) : '');
    p += sq(1, 0, '1') + sq(0, 1, '2') + sq(1, 1, '', true) + sq(2, 1, '3') + sq(3, 1, '4') + sq(1, 2, '5');
    return W(260, 190, p);
  })(),

  // Bolashak 1 №4 — пять кругов с секторами (перерисовано по условию: закрашенная четверть только в D)
  'bolashak1-04': (() => {
    const pie = (cx, cy, r, n, shaded) => {
      let p = `<circle cx="${cx}" cy="${cy}" r="${r}"/>`;
      for (let k = 0; k < n; k++) {
        const a0 = (k / n) * 2 * Math.PI - Math.PI / 2, a1 = ((k + 1) / n) * 2 * Math.PI - Math.PI / 2;
        const [x0, y0, x1, y1] = [cx + r * Math.cos(a0), cy + r * Math.sin(a0), cx + r * Math.cos(a1), cy + r * Math.sin(a1)];
        if (shaded.includes(k)) p += `<path d="M${cx} ${cy} L${x0} ${y0} A${r} ${r} 0 0 1 ${x1} ${y1} Z" fill="rgba(255,255,255,.6)" stroke="none"/>`;
        p += `<line x1="${cx}" y1="${cy}" x2="${x0}" y2="${y0}" stroke-width="1.5"/>`;
      }
      return p;
    };
    // A: 3/8, B: 1/3, C: 1/2, D: 1/4, E: 3/10
    const cfg = [[8, [0, 1, 2]], [6, [1, 2]], [10, [0, 1, 2, 3, 4]], [8, [2, 3]], [10, [5, 6, 7]]];
    return W(430, 120, cfg.map(([n, sh], i) => pie(45 + i * 85, 50, 36, n, sh) + T(45 + i * 85, 112, 'ABCDE'[i], 16)).join(''));
  })(),

  // Bolashak 2 №21 — квадратный лист, от углов отрезаны 4 одинаковых квадрата → крест
  'bolashak2-21': W(220, 220, `<path d="M70 10 H150 V70 H210 V150 H150 V210 H70 V150 H10 V70 H70 Z" fill="${SHADE}"/>
    <path d="M10 10 H70 V70 H10 Z M150 10 H210 V70 H150 Z M10 150 H70 V210 H10 Z M150 150 H210 V210 H150 Z" stroke-dasharray="5 5" stroke-width="1.5"/>`),

  // Bolashak 2 №27 — квадрат со стороной 4 см и вписанный круг
  'bolashak2-27': W(220, 230, `<rect x="20" y="10" width="180" height="180"/><circle cx="110" cy="100" r="90" fill="${SHADE}"/>${T(110, 222, '4 см', 16)}`),

  // Bolashak 2 №32 — два одинаковых прямоугольника внахлёст дают прямоугольник из 3 равных квадратов
  'bolashak2-32': W(320, 150, `<rect x="10" y="30" width="300" height="100" stroke-width="1.5" stroke-dasharray="4 4"/><line x1="110" y1="30" x2="110" y2="130" stroke-width="1" stroke-dasharray="4 4"/><line x1="210" y1="30" x2="210" y2="130" stroke-width="1" stroke-dasharray="4 4"/>
    <rect x="10" y="30" width="200" height="100" stroke="${CYAN}" stroke-width="3" fill="rgba(63,240,255,.12)"/><rect x="110" y="30" width="200" height="100" stroke="${PINK}" stroke-width="3" fill="rgba(255,79,184,.12)"/>
    ${T(60, 20, '18 см²', 14, 'middle', CYAN)}${T(260, 20, '18 см²', 14, 'middle', PINK)}`),

  // Bolashak 2 №36 — два равных квадрата: 1) середины сторон соединены, внутренний квадрат закрашен (9);
  // 2) в углах 4 квадрата со стороной 1/3 стороны большого (закрашены, площадь — ?)
  'bolashak2-36': W(360, 190, `<rect x="10" y="10" width="150" height="150"/><path d="M85 10 L160 85 L85 160 L10 85 Z" fill="${SHADE}"/>${T(85, 92, '9', 20)}
    <rect x="200" y="10" width="150" height="150"/><rect x="200" y="10" width="50" height="50" fill="${SHADE}"/><rect x="300" y="10" width="50" height="50" fill="${SHADE}"/><rect x="200" y="110" width="50" height="50" fill="${SHADE}"/><rect x="300" y="110" width="50" height="50" fill="${SHADE}"/>${T(275, 92, '?', 22, 'middle', GOLD)}
    ${T(85, 184, '1', 14)}${T(275, 184, '2', 14)}`),

  // Bolashak 2 №42 — от углов квадратного листа отрезаны квадраты со сторонами 1, 2, 3, 6
  'bolashak2-42': (() => {
    const k = 20, S = 10 * k, x0 = 10, y0 = 10;
    const cut = (x, y, a) => `<rect x="${x}" y="${y}" width="${a * k}" height="${a * k}" stroke-dasharray="4 4" stroke-width="1.5"/>`;
    const path = `M${x0 + 1 * k} ${y0} H${x0 + S - 2 * k} V${y0 + 2 * k} H${x0 + S} V${y0 + S - 6 * k} H${x0 + S - 6 * k} V${y0 + S} H${x0 + 3 * k} V${y0 + S - 3 * k} H${x0} V${y0 + 1 * k} H${x0 + 1 * k} Z`;
    return W(S + 20, S + 20, `<path d="${path}" fill="${SHADE}" stroke-width="2.5"/>` + cut(x0, y0, 1) + cut(x0 + S - 2 * k, y0, 2) + cut(x0, y0 + S - 3 * k, 3) + cut(x0 + S - 6 * k, y0 + S - 6 * k, 6) +
      T(x0 + 0.5 * k, y0 + 0.5 * k + 5, '1', 12) + T(x0 + S - k, y0 + k + 5, '2', 14) + T(x0 + 1.5 * k, y0 + S - 1.5 * k + 6, '3', 16) + T(x0 + S - 3 * k, y0 + S - 3 * k + 7, '6', 20));
  })(),

  // Bolashak 2 №50 — 6 лучей из одной точки: x, x+20°, 3x и вертикальные им углы
  'bolashak2-50': (() => {
    const c = [150, 130], L = 115, x = 32, dirs = [0, x, 2 * x + 20, 180, 180 + x, 180 + 2 * x + 20];
    const lab = [[x / 2, 'x'], [x + (x + 20) / 2, 'x+20°'], [2 * x + 20 + (3 * x) / 2, '3x'], [180 + x / 2, 'x'], [180 + x + (x + 20) / 2, 'x+20°'], [180 + 2 * x + 20 + (3 * x) / 2, '3x']];
    let p = dirs.map(d => { const [a, b] = ray(c[0], c[1], d, L); return `<line x1="${c[0]}" y1="${c[1]}" x2="${a}" y2="${b}"/>`; }).join('') + dot(c[0], c[1]);
    p += lab.map(([d, s]) => { const [a, b] = ray(c[0], c[1], d, 62); return T(a, b + 5, s, 14, 'middle', GOLD); }).join('');
    return W(300, 260, p);
  })(),
};

// Условия достаточно без рисунка (или рисунок выдал бы ответ)
export const TEXT_ONLY = new Set(['daryn2024-44', 'bolashak1-20', 'bolashak2-31', 'daryn2025-27']);
