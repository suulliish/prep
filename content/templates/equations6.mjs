// 5 класс: уравнения «x с двух сторон» (eq.both_sides_nat) и «скобки двумя способами» (eq.brackets_nat), C9.
// docs/systems/MASTERPLAN.md §3: весы → обратные действия → x с двух сторон → скобки двумя способами → составить по словам → проверка подстановкой.
// eq.both_sides_nat (5): a x = c x + d (қиындық 1), a x + b = c x + d (2), «какое число — корень» (2), a x − b = c x + d (3), задача словами (3: коробки, копилки, весы).
// eq.brackets_nat (5):  a(x ± b) = c (1), a(x + b) ± e = c и (x ± b) : a = c (2), «какое число — корень» (2), скобки и x с двух сторон (3), задача словами (3: коробки, возраст).
// Правила: gen(r) -> { kz, ru, choices (5), answer, sol }; подсказки — в content/hint_keys.mjs; метки ошибок — MISCONCEPTIONS_EQ6 ниже (kz + ru),
// они входят в content/misconceptions.mjs, русские названия — в src/engine/mistakeNames.ts.
// Ответ всегда считается кодом (в целых числах, без плавающей точки); числа подобраны так, чтобы корень был натуральным и единственным (уравнения линейные, коэффициенты при x разные).
// Неправильные варианты — типичные ошибки: не сменил знак при переносе, раскрыл скобки только у первого слагаемого, не умножил на скобку, разделил не всё.
// Казахский — черновик, нужна проверка носителем. Термины — из content/glossary.json (жақшаны ашу, теңдеу, тексеру, кері амал).
// Функции с export (bothEq, bracketsEq, …) нужны урокам content/lessons_week11.mjs: их мини-игры берут задачи отсюда.
import { num, choices5, dat } from './lib.mjs';

const T = (kz, ru) => ({ kz, ru });
const VARS = ['x', 'y', 'm', 'n', 'k'];                 // без «a»: латинская a рядом с цифрой читается как кириллическая «а»
const ITEMS = [
  { kz: 'қарындаш', ru: 'карандашей' }, { kz: 'кітап', ru: 'книг' }, { kz: 'алма', ru: 'яблок' }, { kz: 'дәптер', ru: 'тетрадей' }, { kz: 'кәмпит', ru: 'конфет' },
];
const PAIRS = [
  { n1: 'Дана', l1: 'Данада', n2: 'Марат', l2: 'Маратта' },
  { n1: 'Айжан', l1: 'Айжанда', n2: 'Бекзат', l2: 'Бекзатта' },
  { n1: 'Әлия', l1: 'Әлияда', n2: 'Нұрлан', l2: 'Нұрланда' },
];

export const MISCONCEPTIONS_EQ6 = {
  // ---- x с двух сторон ----
  eqb_x_sign: T('x-ті екінші жаққа өткізгенде таңба өзгереді: қосылғыш болса азайтамыз. Екі жағынан да кіші x-ті азайт, сонда x бір жақта қалады.', 'При переносе x в другую часть знак меняется: слагаемое нужно вычесть из обеих частей. Вычти меньший x из обеих частей, и x останется в одной части.'),
  eqb_const_sign: T('Санды екінші жаққа өткізгенде таңба өзгереді: қосылған санды азайтамыз, азайтылған санды қосамыз. Тексеріп көр: жауабың теңдікті бұзады.', 'Число при переносе меняет знак: прибавленное вычитаем, вычтенное прибавляем. Подставь свой ответ: равенство не получится.'),
  eqb_one_coef: T('Бөлгенде x-тің екі жақтағы санын айырып алу керек: x-тің алдындағы сандардың айырмасына бөлеміз, біреуіне ғана емес.', 'Делить нужно на разность чисел перед x с двух сторон, а не на одно из них: сначала собери x в одной части.'),
  // ---- скобки ----
  eqbr_first_only: T('Жақшаны ашқанда санды жақшаның ішіндегі екі санға да көбейту керек, біріншісіне ғана емес: 4 · (x + 3) = 4x + 12, ал 4x + 3 емес.', 'При раскрытии скобок число умножают на каждое слагаемое в скобках, а не только на первое: 4 · (x + 3) = 4x + 12, а не 4x + 3.'),
  eqbr_ignored_factor: T('Жақшаның алдындағы санды ұмытып кеттің: ол жақшаның ішіндегі бүкіл өрнекті көбейтеді. Теңдеудің екі жағын сол санға бөл немесе жақшаны аш.', 'Ты потерял число перед скобкой: оно умножает всё выражение в скобках. Раздели обе части на это число или раскрой скобки.'),
};

// ---------- общие утилиты ----------
const pos = v => Number.isInteger(v) && v > 0;
const pick = (r, a) => r.pick(a);
/** Член с буквой: «x», «5x» или «5 · x» (form 0 — со знаком, 1 — слитно). */
const co = (k, v, form = 0) => (k === 1 ? v : form === 1 ? `${k}${v}` : `${k} · ${v}`);
/** Скобка с множителем: a · (x + b), a(x + b), (x + b) · a. */
const br = (a, v, sign, b, form) => (form === 0 ? `${a} · (${v} ${sign} ${b})` : form === 1 ? `${a}(${v} ${sign} ${b})` : `(${v} ${sign} ${b}) · ${a}`);
const frac = (n, d) => (d !== 0 && n % d === 0 ? n / d : 0);   // целое частное или 0 (0 не пройдёт фильтр «натуральное»)

/** Пять вариантов-чисел: верный + типичные ошибки (traps: [{v, tag}], только натуральные и не равные верному) + ±1 + случайные. */
function packNum(r, ans, traps) {
  const wrong = traps.filter(t => pos(t.v) && t.v !== ans).map(t => ({ v: num(t.v), tag: t.tag }));
  wrong.push({ v: num(ans + 1), tag: 'off_by_one' });
  if (ans > 1) wrong.push({ v: num(ans - 1), tag: 'off_by_one' });
  return choices5(r, num(ans), wrong, () => num(Math.max(1, ans + r.int(-9, 9))));
}
/** Ловушки линейного уравнения a x + B = c x + D (a > c; B, D со знаком): сторона с большим x слева. */
function sideTraps(a, c, B, D) {
  const k = a - c, diff = D - B;
  return [
    { v: diff, tag: 'eq2_stopped_midway' },                       // (a − c) x = D − B, не поделил
    { v: frac(diff, a + c), tag: 'eqb_x_sign' },                  // x «перенесён» без смены знака: коэффициенты сложены
    { v: frac(D + B, k), tag: 'eqb_const_sign' },                 // число перенесено без смены знака
    { v: frac(diff, a), tag: 'eqb_one_coef' },                    // поделил на коэффициент одной стороны
    { v: frac(diff, c), tag: 'eqb_one_coef' },
  ];
}
const eqItem = (r, e, ask = 'Теңдеуді шешіңіз:', askRu = 'Решите уравнение:') => {
  const { choices, answer } = packNum(r, e.x, e.traps);
  return { kz: `${ask}\n${e.eq}`, ru: `${askRu}\n${e.eq}`, choices, answer, sol: e.sol };
};
const checkItem = (r, e) => {
  const { choices, answer } = packNum(r, e.x, e.traps);
  return {
    kz: `Қай сан ${e.eq} теңдеуінің түбірі? Сандарды теңдеуге қойып тексеріңіз.`, ru: `Какое число — корень уравнения ${e.eq}? Проверьте числа подстановкой.`, choices, answer,
    sol: T(`Түбір: орнына қойғанда екі жағы тең болатын сан. ${e.sol.kz}`, `Корень — число, при подстановке которого обе части равны. ${e.sol.ru}`),
  };
};

// =========================================================================================================
// x с двух сторон (eq.both_sides_nat)
// =========================================================================================================
/** a x ± b = c x + d (a > c). kind: simple (b = 0, қиындық 1) | full (a x + b = c x + d, 2) | minus (a x − b = c x + d, 3). Стороны меняются местами случайно. */
export function bothEq(r, kind) {
  const v = pick(r, VARS), form = r.int(0, 1), mirror = r.chance(0.5);
  let a, b = 0, c, d, x, bs = 1;
  if (kind === 'simple') { c = r.int(1, 4); const k = r.int(1, 5); a = c + k; x = r.int(2, 16); d = k * x; }
  else if (kind === 'full') { c = r.int(1, 5); const k = r.int(1, 5); a = c + k; x = r.int(2, 16); b = r.int(2, 24); d = b + k * x; }
  else if (kind === 'minus') { c = r.int(1, 5); const k = r.int(2, 6); a = c + k; x = r.int(3, 16); bs = -1; b = r.int(2, k * x - 1); d = k * x - b; }
  else throw new Error('bothEq ' + kind);
  const k = a - c, left = `${co(a, v, form)}${b ? ` ${bs > 0 ? '+' : '−'} ${b}` : ''}`, right = `${co(c, v, form)} + ${d}`;
  const diff = d - bs * b, kk = co(k, v), cc = co(c, v);
  const div = k > 1 ? ` Екі жағын да ${dat(k)} бөлеміз: ${v} = ${diff} : ${k} = ${x}.` : '';
  const divRu = k > 1 ? ` Делим обе части на ${k}: ${v} = ${diff} : ${k} = ${x}.` : '';
  const chk = `${a} · ${x}${b ? ` ${bs > 0 ? '+' : '−'} ${b}` : ''} = ${a * x + bs * b}, ${c === 1 ? x : `${c} · ${x}`} + ${d} = ${c * x + d}`;
  let kz, ru;
  if (kind === 'simple') {
    kz = `${v} екі жақта: екі жағынан да ${cc} азайтамыз, сонда ${v} бір жақта қалады: ${kk} = ${d}.${div}`;
    ru = `${v} в обеих частях: вычитаем из обеих частей ${cc}, и ${v} остаётся в одной части: ${kk} = ${d}.${divRu}`;
  } else if (kind === 'full') {
    kz = `${v} екі жақта: екі жағынан да ${cc} азайтамыз: ${kk} + ${b} = ${d}. Сосын екі жағынан да ${b} азайтамыз: ${kk} = ${d} − ${b} = ${diff}.${div}`;
    ru = `${v} в обеих частях: вычитаем из обеих частей ${cc}: ${kk} + ${b} = ${d}. Затем вычитаем из обеих частей ${b}: ${kk} = ${d} − ${b} = ${diff}.${divRu}`;
  } else {
    kz = `${v} екі жақта: екі жағынан да ${cc} азайтамыз: ${kk} − ${b} = ${d}. Азайтылған санды жою үшін екі жағына да ${b} қосамыз: ${kk} = ${d} + ${b} = ${diff}.${div}`;
    ru = `${v} в обеих частях: вычитаем из обеих частей ${cc}: ${kk} − ${b} = ${d}. Чтобы убрать вычтенное число, прибавляем ${b} к обеим частям: ${kk} = ${d} + ${b} = ${diff}.${divRu}`;
  }
  return {
    kind, v, a, b, bs, c, d, x, eq: mirror ? `${right} = ${left}` : `${left} = ${right}`,
    traps: sideTraps(a, c, bs * b, d),
    sol: T(`${kz} Тексеру: ${chk}.`, `${ru} Проверка: ${chk}.`),
  };
}
export const BOTH_KINDS = ['simple', 'full', 'minus'];

/** Задача словами: уравнение a x + B = c x + D, ответ — натуральное число. Возвращает уравнение для проверки в тестах (eq) и разбор. */
export function bothStory(r) {
  const kind = pick(r, ['boxes', 'savings', 'scales']);
  if (kind === 'boxes') {
    const it = pick(r, ITEMS), noun = it.kz, p = r.int(2, 5), k = r.int(1, 4), s = p + k, x = r.int(3, 14), t = r.chance(0.3) ? 0 : r.int(2, 12), q = t + k * x;
    const second = t ? `${s} қорап пен тағы ${t} ${noun}` : `${s} қорап`, secondRu = t ? `${s} коробок и ещё ${t} шт.` : `${s} коробок`;
    const tt = t ? ` + ${t}` : '';   // при t = 0 слагаемое «+ 0» не пишем
    return { kind, x, eq: `${p}x + ${q} = ${s}x${tt}`,
      kz: `Бірінші сөреде ${p} бірдей қорап пен тағы ${q} ${noun} тұр, екінші сөреде сондай ${second} тұр. Екі сөреде ${noun} саны тең. Бір қорапта неше ${noun} бар?`,
      ru: `На первой полке ${p} одинаковых коробок и ещё ${q} шт. (${it.ru}), на второй полке столько же таких коробок: ${secondRu}. На двух полках штук поровну. Сколько в одной коробке?`,
      traps: sideTraps(s, p, t, q),
      sol: T(`Бір қорапта x ${noun} болсын: ${co(p, 'x', 1)} + ${q} = ${co(s, 'x', 1)}${tt}. Екі жағынан да ${co(p, 'x')} азайтамыз: ${q} = ${co(k, 'x')}${tt}. ${t ? `Екі жағынан ${t} азайтамыз: ${co(k, 'x')} = ${q} − ${t} = ${q - t}. ` : ''}${k > 1 ? `${dat(k)} бөлеміз: x = ${q - t} : ${k} = ${x}. ` : ''}Тексеру: ${p} · ${x} + ${q} = ${p * x + q}, ${s} · ${x}${tt} = ${s * x + t}.`,
        `Пусть в одной коробке x шт.: ${p}x + ${q} = ${s}x${tt}. Вычтем из обеих частей ${co(p, 'x')}: ${q} = ${co(k, 'x')}${tt}. ${t ? `Вычтем ${t}: ${co(k, 'x')} = ${q} − ${t} = ${q - t}. ` : ''}${k > 1 ? `Разделим на ${k}: x = ${q - t} : ${k} = ${x}. ` : ''}Проверка: ${p} · ${x} + ${q} = ${p * x + q}, ${s} · ${x}${tt} = ${s * x + t}.`) };
  }
  if (kind === 'savings') {
    const pr = pick(r, PAIRS), Q = 10 * r.int(1, 5), k = 10 * r.int(1, 4), P = Q + k, A = 10 * r.int(2, 12), x = r.int(3, 12), B = A + k * x;   // (P − Q) · x = B − A
    return { kind, x, eq: `${A} + ${P}x = ${B} + ${Q}x`,
      kz: `${pr.l1} ${A} теңге бар, ол күн сайын ${P} теңге жинайды. ${pr.l2} ${B} теңге бар, ол күн сайын ${Q} теңге жинайды. Неше күннен кейін екеуінде ақша тең болады?`,
      ru: `У ${pr.n1} ${A} тенге, она копит по ${P} тенге в день. У ${pr.n2} ${B} тенге, он копит по ${Q} тенге в день. Через сколько дней денег станет поровну?`,
      traps: sideTraps(P, Q, A, B),
      sol: T(`x күннен кейін ақша тең болсын: ${A} + ${P}x = ${B} + ${Q}x. Екі жағынан да ${Q}x азайтамыз: ${A} + ${k}x = ${B}. Сосын ${A} азайтамыз: ${k}x = ${B} − ${A} = ${B - A}. ${dat(k)} бөлеміз: x = ${B - A} : ${k} = ${x}. Тексеру: ${A} + ${P} · ${x} = ${A + P * x}, ${B} + ${Q} · ${x} = ${B + Q * x}.`,
        `Пусть через x дней денег поровну: ${A} + ${P}x = ${B} + ${Q}x. Вычтем ${Q}x: ${A} + ${k}x = ${B}. Вычтем ${A}: ${k}x = ${B} − ${A} = ${B - A}. Разделим на ${k}: x = ${B - A} : ${k} = ${x}. Проверка: ${A} + ${P} · ${x} = ${A + P * x}, ${B} + ${Q} · ${x} = ${B + Q * x}.`) };
  }
  const p = r.int(2, 4), k = r.int(1, 4), s = p + k, x = r.int(3, 14) * 5, t = r.int(1, 6) * 5, q = t + k * x;   // грамм: гири кратны 5
  return { kind, x, eq: `${p}x + ${q} = ${s}x + ${t}`,
    kz: `Таразының сол табағында ${p} бірдей қап пен ${q} граммдық гір, оң табағында сондай ${s} қап пен ${t} граммдық гір тұр. Таразы тепе-теңдікте. Бір қап неше грамм?`,
    ru: `На левой чаше весов ${p} одинаковых мешков и гиря ${q} г, на правой такие же ${s} мешков и гиря ${t} г. Весы в равновесии. Сколько граммов в одном мешке?`,
    traps: sideTraps(s, p, t, q),
    sol: T(`Бір қап x грамм болсын: ${p}x + ${q} = ${s}x + ${t}. Екі табақтан да ${co(p, 'x')} аламыз: ${q} = ${co(k, 'x')} + ${t}. Екі жағынан ${t} азайтамыз: ${co(k, 'x')} = ${q} − ${t} = ${q - t}. ${k > 1 ? `${dat(k)} бөлеміз: x = ${q - t} : ${k} = ${x}. ` : ''}Тексеру: ${p} · ${x} + ${q} = ${p * x + q}, ${s} · ${x} + ${t} = ${s * x + t}.`,
      `Пусть в одном мешке x г: ${p}x + ${q} = ${s}x + ${t}. Снимем с обеих чаш по ${co(p, 'x')}: ${q} = ${co(k, 'x')} + ${t}. Вычтем ${t}: ${co(k, 'x')} = ${q} − ${t} = ${q - t}. ${k > 1 ? `Разделим на ${k}: x = ${q - t} : ${k} = ${x}. ` : ''}Проверка: ${p} · ${x} + ${q} = ${p * x + q}, ${s} · ${x} + ${t} = ${s * x + t}.`) };
}

// =========================================================================================================
// Скобки (eq.brackets_nat)
// =========================================================================================================
/** Уравнение со скобкой. kind: add | sub (a(x ± b) = c, қиындық 1); plus_e | minus_e (a(x + b) ± e = c), div_add | div_sub ((x ± b) : a = c) (2). */
export function bracketsEq(r, kind) {
  const v = pick(r, VARS), form = r.int(0, 2), mirror = r.chance(0.3);
  const wrap = (left, c) => (mirror ? `${c} = ${left}` : `${left} = ${c}`);
  if (kind === 'add' || kind === 'sub') {
    const plus = kind === 'add', a = r.int(2, 9), b = r.chance(0.4) ? a * r.int(1, 3) : r.int(1, 12), x = plus ? r.int(2, 16) : b + r.int(2, 14);
    const inner = plus ? x + b : x - b, c = a * inner, s = plus ? '+' : '−', inv = plus ? '−' : '+';
    return {
      kind, v, a, b, c, x, eq: wrap(br(a, v, s, b, form), c),
      traps: [
        { v: inner, tag: 'eq2_stopped_midway' },                                          // x ± b = c : a, не убрал b
        { v: frac(plus ? c - b : c + b, a), tag: 'eqbr_first_only' },                     // раскрыл скобки только у x: a x ± b = c
        { v: plus ? c - b : c + b, tag: 'eqbr_ignored_factor' },                          // «забыл» множитель перед скобкой
        { v: plus ? inner + b : inner - b, tag: 'eq2_sign' },                             // b перенесён с неверным знаком
      ],
      sol: T(`Екі жағын да ${dat(a)} бөлеміз: ${v} ${s} ${b} = ${c} : ${a} = ${inner}. Сосын ${v} = ${inner} ${inv} ${b} = ${x}. Жақшаны ашып та шешуге болады: ${a} · ${v} ${s} ${a * b} = ${c}, ${a} · ${v} = ${c} ${inv} ${a * b} = ${a * x}, ${v} = ${x}. Тексеру: ${a} · (${x} ${s} ${b}) = ${c}.`,
        `Делим обе части на ${a}: ${v} ${s} ${b} = ${c} : ${a} = ${inner}. Затем ${v} = ${inner} ${inv} ${b} = ${x}. Можно раскрыть скобки: ${a} · ${v} ${s} ${a * b} = ${c}, ${a} · ${v} = ${c} ${inv} ${a * b} = ${a * x}, ${v} = ${x}. Проверка: ${a} · (${x} ${s} ${b}) = ${c}.`),
    };
  }
  if (kind === 'plus_e' || kind === 'minus_e') {
    const plus = kind === 'plus_e', a = r.int(2, 9), b = r.chance(0.4) ? a * r.int(1, 3) : r.int(1, 12), x = r.int(2, 14), e = r.int(2, 30), inner = x + b, M = a * inner;
    const c = plus ? M + e : M - e;
    if (c < 1) return bracketsEq(r, kind);
    const left = plus && r.chance(0.4) ? `${e} + ${br(a, v, '+', b, form)}` : `${br(a, v, '+', b, form)} ${plus ? '+' : '−'} ${e}`;
    return {
      kind, v, a, b, c, e, x, eq: wrap(left, c),
      traps: [
        { v: inner, tag: 'eq2_stopped_midway' },
        { v: frac(M - b, a), tag: 'eqbr_first_only' },
        { v: M - b, tag: 'eqbr_ignored_factor' },
        { v: frac(plus ? c + e : c - e, a) - b, tag: 'eq2_sign' },                       // e перенесено с неверным знаком
      ],
      sol: T(`Алдымен ${plus ? 'қосылғышты' : 'азайтқышты'} жоямыз: ${plus ? `екі жағынан да ${e} азайтамыз` : `екі жағына да ${e} қосамыз`}: ${a} · (${v} + ${b}) = ${c} ${plus ? '−' : '+'} ${e} = ${M}. Сосын екі жағын да ${dat(a)} бөлеміз: ${v} + ${b} = ${M} : ${a} = ${inner}. Енді ${v} = ${inner} − ${b} = ${x}. Тексеру: ${plus ? `${a} · (${x} + ${b}) + ${e}` : `${a} · (${x} + ${b}) − ${e}`} = ${c}.`,
        `Сначала убираем ${plus ? 'слагаемое' : 'вычитаемое'}: ${plus ? `вычитаем ${e} из обеих частей` : `прибавляем ${e} к обеим частям`}: ${a} · (${v} + ${b}) = ${c} ${plus ? '−' : '+'} ${e} = ${M}. Делим обе части на ${a}: ${v} + ${b} = ${M} : ${a} = ${inner}. Тогда ${v} = ${inner} − ${b} = ${x}. Проверка: ${plus ? `${a} · (${x} + ${b}) + ${e}` : `${a} · (${x} + ${b}) − ${e}`} = ${c}.`),
    };
  }
  if (kind === 'div_add' || kind === 'div_sub') {
    const plus = kind === 'div_add', a = r.int(2, 9), q = r.int(2, 12), b = r.int(1, 12), x = plus ? a * q - b : a * q + b;
    if (x < 2) return bracketsEq(r, kind);
    const s = plus ? '+' : '−', inv = plus ? '−' : '+';
    return {
      kind, v, a, b, c: q, x, eq: wrap(`(${v} ${s} ${b}) : ${a}`, q),
      traps: [
        { v: a * q, tag: 'eq2_stopped_midway' },
        { v: plus ? a * (q - b) : a * (q + b), tag: 'eqbr_first_only' },                // поделил только x: x : a ± b = c
        { v: plus ? q - b : q + b, tag: 'eqbr_ignored_factor' },                         // не умножил на a
        { v: plus ? a * q + b : a * q - b, tag: 'eq2_sign' },
      ],
      sol: T(`Жақшаның ішіндегі бүкіл өрнек ${dat(a)} бөлінген, кері амал: көбейту. Екі жағын да ${dat(a)} көбейтеміз: ${v} ${s} ${b} = ${q} · ${a} = ${a * q}. Сосын ${v} = ${a * q} ${inv} ${b} = ${x}. Тексеру: (${x} ${s} ${b}) : ${a} = ${q}.`,
        `Всё выражение в скобках разделено на ${a}, обратное действие: умножение. Умножаем обе части на ${a}: ${v} ${s} ${b} = ${q} · ${a} = ${a * q}. Затем ${v} = ${a * q} ${inv} ${b} = ${x}. Проверка: (${x} ${s} ${b}) : ${a} = ${q}.`),
    };
  }
  throw new Error('bracketsEq ' + kind);
}
export const BRACKET_KINDS = ['add', 'sub', 'plus_e', 'minus_e', 'div_add', 'div_sub'];

/** Скобки и x с двух сторон (қиындық 3). kind: x (a(x + b) = c x + d) | minus (a(x − b) = c x + d) | br (a(x + b) = c(x + d)). */
export function bracketsBoth(r, kind) {
  const v = pick(r, VARS), form = r.int(0, 1), mirror = r.chance(0.4);
  for (let guard = 0; guard < 400; guard++) {
    const c = r.int(1, 4), k = r.int(1, 4), a = c + k, b = r.int(1, 9);
    let x = r.int(2, 14), d, P, Q, rightText, sgn = '+';
    if (kind === 'x') { d = k * x + a * b; P = a * b; Q = d; rightText = `${co(c, v, form)} + ${d}`; }
    else if (kind === 'minus') {
      x = r.int(b + 1, b + 12); d = k * x - a * b; if (d < 1) continue;
      sgn = '−'; P = -a * b; Q = d; rightText = `${co(c, v, form)} + ${d}`;
    } else if (kind === 'br') {
      const L = a * (x + b); if (c === 1 || L % c || L / c - x < 1) continue;      // c = 1: «1(x + d)» скобкой не пишут
      d = L / c - x; P = a * b; Q = c * d; rightText = br(c, v, '+', d, form);
    } else throw new Error('bracketsBoth ' + kind);
    const left = br(a, v, sgn, b, form), kk = co(k, v), bP = Math.abs(P), diff = Q - P;
    const open = `${a} · ${v} ${sgn} ${bP}`, openRight = kind === 'br' ? `${c} · ${v} + ${Q}` : rightText.replace(/ · /g, ' · ');
    const lv = a * (sgn === '+' ? x + b : x - b), rv = kind === 'br' ? c * (x + d) : c * x + d;
    const chk = `${a} · (${x} ${sgn} ${b}) = ${lv}, ${kind === 'br' ? `${c} · (${x} + ${d})` : `${c === 1 ? x : `${c} · ${x}`} + ${d}`} = ${rv}`;
    const stepKz = P > 0 ? `Екі жағынан ${bP} азайтамыз: ${kk} = ${Q} − ${bP} = ${diff}.` : `Екі жағына да ${bP} қосамыз: ${kk} = ${Q} + ${bP} = ${diff}.`;
    const stepRu = P > 0 ? `Вычитаем ${bP}: ${kk} = ${Q} − ${bP} = ${diff}.` : `Прибавляем ${bP}: ${kk} = ${Q} + ${bP} = ${diff}.`;
    const divKz = k > 1 ? ` Екі жағын да ${dat(k)} бөлеміз: ${v} = ${diff} : ${k} = ${x}.` : '', divRu = k > 1 ? ` Делим на ${k}: ${v} = ${diff} : ${k} = ${x}.` : '';
    const both = kind === 'br' ? `, ${c} · (${v} + ${d}) = ${c} · ${v} + ${Q}` : '';
    const sideTrap = sideTraps(a, c, P, Q);                 // [стоп, x без смены знака, число без смены знака, делил на a, делил на c]
    return {
      kind, v, a, b, c, d, x, eq: mirror ? `${rightText} = ${left}` : `${left} = ${rightText}`,
      traps: [sideTrap[0], { v: frac(Q - (P > 0 ? b : -b), k), tag: 'eqbr_first_only' }, sideTrap[1], sideTrap[2], sideTrap[3], sideTrap[4]],   // «первый только у x»: a x ± b вместо a x ± a b
      sol: T(`Алдымен жақшаны ашамыз: ${a} · (${v} ${sgn} ${b}) = ${a} · ${v} ${sgn} ${bP}${both}. Теңдеу: ${open} = ${openRight}. Екі жағынан да ${co(c, v)} азайтамыз: ${kk} ${sgn} ${bP} = ${Q}. ${stepKz}${divKz} Тексеру: ${chk}.`,
        `Сначала раскрываем скобки: ${a} · (${v} ${sgn} ${b}) = ${a} · ${v} ${sgn} ${bP}${both}. Получаем: ${open} = ${openRight}. Вычитаем из обеих частей ${co(c, v)}: ${kk} ${sgn} ${bP} = ${Q}. ${stepRu}${divRu} Проверка: ${chk}.`),
    };
  }
  throw new Error('bracketsBoth: не подобрались числа ' + kind);
}
export const BRACKET_BOTH_KINDS = ['x', 'minus', 'br'];

/** Задача словами для скобок: каждому ящику добавили / из каждого забрали; возраст через несколько лет. */
export function bracketsStory(r) {
  const kind = pick(r, ['each_add', 'each_take', 'age']);
  if (kind === 'age') {
    for (let guard = 0; guard < 400; guard++) {
      const k = r.int(2, 4), B = r.int(5, 13), x = r.int(2, 12), A = k * B + (k - 1) * x;
      if (A - B < 20 || A - B > 42 || A > 55) continue;
      const f = A - k * B;     // (k − 1) x
      return { kind, x, eq: `${A} + x = ${k}(${B} + x)`,
        kz: `Әкесі ${A} жаста, ұлы ${B} жаста. Неше жылдан кейін әкесінің жасы ұлының жасынан ${k} есе көп болады?`,
        ru: `Отцу ${A} лет, сыну ${B}. Через сколько лет возраст отца будет в ${k} раз больше возраста сына?`,
        traps: [{ v: x + B, tag: 'eq2_stopped_midway' }, { v: f, tag: 'eq2_stopped_midway' }, { v: frac(f, k + 1), tag: 'eqb_x_sign' }, { v: frac(f, k), tag: 'eqb_one_coef' }],
        sol: T(`x жылдан кейін: әкесі ${A} + x, ұлы ${B} + x жаста. Шарт бойынша ${A} + x = ${k} · (${B} + x). Жақшаны ашамыз: ${A} + x = ${k * B} + ${k}x. Екі жағынан x азайтамыз: ${A} = ${k * B} + ${k - 1}x. ${A} − ${k * B} = ${f}, сонда ${co(k - 1, 'x')} = ${f}${k > 2 ? `, x = ${f} : ${k - 1} = ${x}` : ''}. Тексеру: ${A} + ${x} = ${A + x}, ${k} · (${B} + ${x}) = ${k * (B + x)}.`,
          `Через x лет: отцу ${A} + x, сыну ${B} + x. По условию ${A} + x = ${k} · (${B} + x). Раскрываем скобки: ${A} + x = ${k * B} + ${k}x. Вычитаем x: ${A} = ${k * B} + ${k - 1}x. ${A} − ${k * B} = ${f}, значит ${co(k - 1, 'x')} = ${f}${k > 2 ? `, x = ${f} : ${k - 1} = ${x}` : ''}. Проверка: ${A} + ${x} = ${A + x}, ${k} · (${B} + ${x}) = ${k * (B + x)}.`) };
    }
    throw new Error('bracketsStory: возраст');
  }
  const it = pick(r, ITEMS), noun = it.kz, a = r.int(2, 9), b = r.chance(0.4) ? a * r.int(1, 3) : r.int(1, 9);
  if (kind === 'each_add') {
    const x = r.int(3, 16), c = a * (x + b);
    return { kind, x, eq: `${a}(x + ${b}) = ${c}`,
      kz: `${a} қорапта әрқайсысында бірдей санда ${noun} бар. Әр қорапқа тағы ${b} ${noun} салды, сонда барлығы ${c} ${noun} болды. Басында бір қорапта неше ${noun} болды?`,
      ru: `В ${a} коробках поровну штук (${it.ru}). В каждую коробку добавили ещё по ${b} шт., и всего стало ${c} шт. Сколько было в одной коробке вначале?`,
      traps: [{ v: x + b, tag: 'eq2_stopped_midway' }, { v: frac(c - b, a), tag: 'eqbr_first_only' }, { v: c - b, tag: 'eqbr_ignored_factor' }, { v: x + 2 * b, tag: 'eq2_sign' }],
      sol: T(`Бір қорапта x ${noun} болсын: ${a} · (x + ${b}) = ${c}. Екі жағын да ${dat(a)} бөлеміз: x + ${b} = ${c} : ${a} = ${x + b}. Сосын x = ${x + b} − ${b} = ${x}. Тексеру: ${a} · (${x} + ${b}) = ${c}.`,
        `Пусть в одной коробке x шт.: ${a} · (x + ${b}) = ${c}. Делим на ${a}: x + ${b} = ${c} : ${a} = ${x + b}. Тогда x = ${x + b} − ${b} = ${x}. Проверка: ${a} · (${x} + ${b}) = ${c}.`) };
  }
  const x = b + r.int(2, 14), c = a * (x - b);
  return { kind, x, eq: `${a}(x − ${b}) = ${c}`,
    kz: `${a} қорапта әрқайсысында бірдей санда ${noun} бар. Әр қораптан ${b} ${noun} алды, сонда барлығы ${c} ${noun} қалды. Басында бір қорапта неше ${noun} болды?`,
    ru: `В ${a} коробках поровну штук (${it.ru}). Из каждой коробки забрали по ${b} шт., и всего осталось ${c} шт. Сколько было в одной коробке вначале?`,
    traps: [{ v: x - b, tag: 'eq2_stopped_midway' }, { v: frac(c + b, a), tag: 'eqbr_first_only' }, { v: c + b, tag: 'eqbr_ignored_factor' }, { v: x - 2 * b, tag: 'eq2_sign' }],
    sol: T(`Бір қорапта x ${noun} болсын: ${a} · (x − ${b}) = ${c}. Екі жағын да ${dat(a)} бөлеміз: x − ${b} = ${c} : ${a} = ${x - b}. Сосын x = ${x - b} + ${b} = ${x}. Тексеру: ${a} · (${x} − ${b}) = ${c}.`,
      `Пусть в одной коробке x шт.: ${a} · (x − ${b}) = ${c}. Делим на ${a}: x − ${b} = ${c} : ${a} = ${x - b}. Тогда x = ${x - b} + ${b} = ${x}. Проверка: ${a} · (${x} − ${b}) = ${c}.`) };
}

// =========================================================================================================
// Генераторы
// =========================================================================================================
export default [
  // ---------------------------------- eq.both_sides_nat ----------------------------------
  {
    id: 'eq.both_simple',
    examType: 'equations', skills: ['eq.both_sides_nat'], from: [], difficulty: 1,
    title: T('x екі жақта: a x = c x + d', 'x с двух сторон: a x = c x + d'),
    gen(r) { return eqItem(r, bothEq(r, 'simple')); },
  },
  {
    id: 'eq.both_full',
    examType: 'equations', skills: ['eq.both_sides_nat'], from: [], difficulty: 2,
    title: T('x екі жақта: a x + b = c x + d', 'x с двух сторон: a x + b = c x + d'),
    gen(r) { return eqItem(r, bothEq(r, 'full')); },
  },
  {
    id: 'eq.both_check',
    examType: 'equations', skills: ['eq.both_sides_nat'], from: [], difficulty: 2,
    title: T('Қай сан түбір (x екі жақта, орнына қойып тексеру)', 'Какое число — корень (x с двух сторон, проверка подстановкой)'),
    gen(r) { return checkItem(r, bothEq(r, pick(r, ['simple', 'full', 'full', 'minus']))); },
  },
  {
    id: 'eq.both_minus',
    examType: 'equations', skills: ['eq.both_sides_nat'], from: [], difficulty: 3,
    title: T('x екі жақта: a x − b = c x + d', 'x с двух сторон: a x − b = c x + d'),
    gen(r) { return eqItem(r, bothEq(r, 'minus')); },
  },
  {
    id: 'eq.both_story',
    examType: 'word', skills: ['eq.both_sides_nat'], from: [], difficulty: 3,
    title: T('Белгісіз екі жақта тұратын теңдеуге келетін есеп', 'Задача на уравнение с x с двух сторон'),
    gen(r) {
      const e = bothStory(r);
      const { choices, answer } = packNum(r, e.x, e.traps);
      return { kz: e.kz, ru: e.ru, choices, answer, sol: e.sol };
    },
  },

  // ---------------------------------- eq.brackets_nat ----------------------------------
  {
    id: 'eq.brackets_divide',
    examType: 'equations', skills: ['eq.brackets_nat'], from: [], difficulty: 1,
    title: T('Жақшалы теңдеу: a · (x ± b) = c', 'Уравнение со скобками: a · (x ± b) = c'),
    gen(r) { return eqItem(r, bracketsEq(r, pick(r, ['add', 'add', 'sub']))); },
  },
  {
    id: 'eq.brackets_expand',
    examType: 'equations', skills: ['eq.brackets_nat'], from: [], difficulty: 2,
    title: T('Жақшалы теңдеу: a · (x + b) ± e = c, (x ± b) : a = c', 'Уравнение со скобками: a · (x + b) ± e = c, (x ± b) : a = c'),
    gen(r) { return eqItem(r, bracketsEq(r, pick(r, ['plus_e', 'minus_e', 'div_add', 'div_sub']))); },
  },
  {
    id: 'eq.brackets_check',
    examType: 'equations', skills: ['eq.brackets_nat'], from: [], difficulty: 2,
    title: T('Қай сан түбір (жақшалы теңдеу, орнына қойып тексеру)', 'Какое число — корень (скобки, проверка подстановкой)'),
    gen(r) { return checkItem(r, bracketsEq(r, pick(r, BRACKET_KINDS))); },
  },
  {
    id: 'eq.brackets_both',
    examType: 'equations', skills: ['eq.brackets_nat'], from: [], difficulty: 3,
    title: T('Жақша және x екі жақта: a · (x + b) = c x + d', 'Скобки и x с двух сторон: a · (x + b) = c x + d'),
    gen(r) { return eqItem(r, bracketsBoth(r, pick(r, BRACKET_BOTH_KINDS))); },
  },
  {
    id: 'eq.brackets_story',
    examType: 'word', skills: ['eq.brackets_nat'], from: [], difficulty: 3,
    title: T('Жақшалы теңдеуге келетін есеп', 'Задача на уравнение со скобками'),
    gen(r) {
      const e = bracketsStory(r);
      const { choices, answer } = packNum(r, e.x, e.traps);
      return { kz: e.kz, ru: e.ru, choices, answer, sol: e.sol };
    },
  },
];
