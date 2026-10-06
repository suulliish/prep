// 5 класс: әріпті өрнектер және теңдеулер (C6, docs/systems/specs/content.md: «equations5.mjs: 15 генераторов, қиындық 1–3 для expr.variables и тем уравнений»).
// expr.variables (4): подстановка в выражение (1 и 2 буквы), составление выражения по словам (одно и два действия).
// eq.linear_basic (5): x + a = b, x − a = b, a · x = b, x : a = b; a − x = b и a : x = b; «какое число — корень» (проверка подстановкой); задача словами → число.
// eq.two_step (6): a · x ± b = c, x : a ± b = c, «задуманное число», задача словами, a − k · x = c.
// Правила: gen(r) -> { kz, ru, choices (5), answer, sol }; подсказки — в content/hint_keys.mjs; метки ошибок — MISCONCEPTIONS_EQ ниже (kz + ru),
// они входят в content/misconceptions.mjs, русские названия — в src/engine/mistakeNames.ts.
// Ответ всегда считается кодом (в целых числах, без плавающей точки); числа подобраны так, чтобы корень был натуральным.
// Неправильные варианты — типичные ошибки: то же действие вместо обратного, один из двух шагов, шаги в неверном порядке, «5n = 54».
// Казахский — черновик, нужна проверка носителем. Термины — только из content/glossary.json (қосылғыш, азайғыш, азайтқыш, көбейткіш, бөлінгіш, бөлгіш, бөлінді).
// Функции с export (oneStepEq, twoStepEq, …) нужны урокам content/lessons_week10.mjs: их мини-игры берут задачи отсюда.
import { num, choices5, dat } from './lib.mjs';

const T = (kz, ru) => ({ kz, ru });
const VARS = ['x', 'y', 'm', 'n', 'k'];
const ITEMS = [
  { kz: 'қарындаш', dat: 'қарындашқа', acc: 'қарындашты', abl: 'қарындаштан', ru: 'карандашей' },
  { kz: 'кітап', dat: 'кітапқа', acc: 'кітапты', abl: 'кітаптан', ru: 'книг' },
  { kz: 'алма', dat: 'алмаға', acc: 'алманы', abl: 'алмадан', ru: 'яблок' },
  { kz: 'дәптер', dat: 'дәптерге', acc: 'дәптерді', abl: 'дәптерден', ru: 'тетрадей' },
  { kz: 'кәмпит', dat: 'кәмпитке', acc: 'кәмпитті', abl: 'кәмпиттен', ru: 'конфет' },
];

export const MISCONCEPTIONS_EQ = {
  // ---- өрнекке мән қою ----
  expr_concat: T('Әріптің жанындағы сан көбейтуді білдіреді: 5n = 5 · n. n = 4 болса, 5n = 5 · 4 = 20, ал 54 емес.', 'Число рядом с буквой означает умножение: 5n = 5 · n. При n = 4 получится 5 · 4 = 20, а не 54.'),
  expr_dropped_coef: T('Әріптің алдындағы санды ұмыттың: ол әріпті сонша есе көбейтеді. Алдымен әріптің орнына санды қой, сосын көбейт.', 'Забыл число перед буквой: оно умножает букву. Сначала подставь число вместо буквы, потом умножь.'),
  expr_dropped_term: T('Өрнекте тағы бір қосылғыш (немесе азайтқыш) бар: оны есептен тастап кетпе.', 'В выражении есть ещё слагаемое (или вычитаемое): не теряй его.'),
  expr_wrong_sign: T('Таңбаны тексер: қосу мен азайтуды шатастырма. Өрнекте қандай амал тұрғанын қайта оқы.', 'Проверь знак: не путай сложение и вычитание. Перечитай, какое действие стоит в выражении.'),
  expr_bracket_ignored: T('Жақша бар: алдымен жақшаның ішін есепте, сосын көбейт.', 'Есть скобки: сначала посчитай то, что в скобках, потом умножай.'),
  expr_added_all: T('Барлық сандарды қосып шығуға болмайды: көбейту белгісі (немесе әріптің жанындағы сан) көбейтуді білдіреді.', 'Нельзя просто складывать все числа: знак умножения (или число рядом с буквой) означает умножение.'),
  // ---- шартты өрнекпен жазу ----
  compose_opposite: T('Амал кері алынған: «артық» және «қосты»: қосу, «кем» және «алды»: азайту. Шартты қайта оқы.', 'Выбрано обратное действие: «больше» и «добавили» — сложение, «меньше» и «забрали» — вычитание. Перечитай условие.'),
  compose_mix: T('Сөздерді ажырат: «a-ға артық»: қосу, ал «a есе көп»: көбейту; бөлінген сан: бөлу.', 'Различай слова: «на a больше» — сложение, «в a раз больше» — умножение; «поровну между» — деление.'),
  compose_reversed: T('Орны ауысып кеткен: кеміген сан бастапқы саннан алынады. Алдымен бастапқы санды (әріпті) жаз, сосын қанша алынғанын.', 'Числа поменялись местами: вычитают из начального количества (буквы) то, что забрали. Сначала пиши начальное количество.'),
  compose_brackets: T('Жақша қажет емес: көбейткіш бір ғана санға қатысты, қосындының бәріне емес.', 'Скобки здесь лишние: множитель относится только к одному числу, а не ко всей сумме.'),
  compose_dropped: T('Бір әрекетті жіберіп алдың: шартта екі әрекет бар, өрнекте де екеуі болуы керек.', 'Пропущено одно действие: в условии два действия, в выражении тоже должно быть два.'),
  compose_one_box: T('Екі қорапты да есепке қос: бірінші қорапта n, екінші қорапта одан басқаша, ал сұрақ: екеуі бірге.', 'Учти обе коробки: в первой n, во второй иначе, а спрашивают про обе вместе.'),
  // ---- бір қадамды теңдеулер ----
  eq_same_op: T('Белгісізді табу үшін кері амал керек: қосудың кері амалы: азайту, азайтудың кері амалы: қосу, көбейтудің кері амалы: бөлу, бөлудің кері амалы: көбейту.', 'Нужно обратное действие: к сложению обратное вычитание, к вычитанию сложение, к умножению деление, к делению умножение.'),
  eq_wrong_op: T('Басқа амал қолдандың: көбейтуге кері амал: бөлу, бөлуге кері амал: көбейту. Қосу мен азайту бұл жерде керек емес.', 'Выбрано не то действие: обратное к умножению деление, обратное к делению умножение. Сложение и вычитание тут не нужны.'),
  eq_sub_swapped: T('Азайтқыш белгісіз болса: x = азайғыш − айырма. Табылған санды орнына қойып көр: теңдік шықпайды.', 'Если неизвестно вычитаемое: x = уменьшаемое − разность. Подставь найденное число: равенство не получится.'),
  eq_div_swapped: T('Бөлгіш белгісіз болса: x = бөлінгіш : бөлінді, көбейтуге болмайды. Табылған санды орнына қойып көр.', 'Если неизвестен делитель: x = делимое : частное, умножать нельзя. Подставь найденное число.'),
  // ---- екі қадамды теңдеулер ----
  eq2_stopped_midway: T('Тоқтап қалдың: екі кері амалдың біреуі ғана орындалды. Белгісіз әлі коэффициентпен тұр, екінші амалды да орында.', 'Остановился на полпути: выполнено только одно из двух обратных действий. Неизвестное всё ещё с множителем (делителем), сделай и второй шаг.'),
  eq2_order: T('Кері амалдарды кері ретпен орында: алдымен қосу немесе азайту, сосын көбейту немесе бөлу. Бөлгенде екі жағын толық бөл.', 'Обратные действия делай в обратном порядке: сначала сложение или вычитание, потом умножение или деление. Делить нужно обе части целиком.'),
  eq2_sign: T('Қосылған санды жою үшін азайту керек, азайтылған санды жою үшін қосу керек. Таңбаны тексер.', 'Чтобы убрать прибавленное число, нужно вычесть, чтобы убрать вычтенное, нужно прибавить. Проверь знак.'),
};

// ---------- общие утилиты ----------
const pos = v => Number.isInteger(v) && v > 0;
const pick = (r, a) => r.pick(a);
const SIG_AT = [7, 11, 13, 17];
/** «Отпечаток» выражения: значения при нескольких n. Два выражения с одним отпечатком равны (в вариантах ответа этого быть не должно). */
export const sig = f => SIG_AT.map(n => Math.round(f(n) * 1e6) / 1e6).join('|');

/** Пять вариантов-чисел: верный + типичные ошибки (traps: [{v, tag}], только натуральные и не равные верному) + ±1 + случайные. */
function packNum(r, ans, traps) {
  const wrong = traps.filter(t => pos(t.v) && t.v !== ans).map(t => ({ v: num(t.v), tag: t.tag }));
  wrong.push({ v: num(ans + 1), tag: 'off_by_one' });
  if (ans > 1) wrong.push({ v: num(ans - 1), tag: 'off_by_one' });
  return choices5(r, num(ans), wrong, () => num(Math.max(1, ans + r.int(-9, 9))));
}

// =========================================================================================================
// Одношаговые уравнения (eq.linear_basic)
// =========================================================================================================
/** Уравнение в один шаг. kind: add | sub | mul | div (қиындық 1), subtrahend | divisor (қиындық 2). Возвращает уравнение, корень, ловушки и разбор. */
export function oneStepEq(r, kind) {
  const v = pick(r, VARS);
  if (kind === 'add') {
    const a = r.int(4, 70), x = r.int(3, 95), b = a + x, left = r.chance(0.6);
    return {
      kind, v, a, b, x, eq: left ? `${v} + ${a} = ${b}` : `${a} + ${v} = ${b}`,
      traps: [{ v: b + a, tag: 'eq_same_op' }, { v: b, tag: 'copied' }, { v: a, tag: 'copied' }],
      sol: T(`Қосылғыш белгісіз, оны табу үшін қосындыдан екінші қосылғышты азайтамыз. ${v} = ${b} − ${a} = ${x}. Тексеру: ${left ? `${x} + ${a}` : `${a} + ${x}`} = ${b}.`,
        `Неизвестно слагаемое: чтобы его найти, из суммы вычитаем второе слагаемое. ${v} = ${b} − ${a} = ${x}. Проверка: ${left ? `${x} + ${a}` : `${a} + ${x}`} = ${b}.`),
    };
  }
  if (kind === 'sub') {
    const a = r.int(3, 60), b = r.int(3, 80), x = a + b;
    return {
      kind, v, a, b, x, eq: `${v} − ${a} = ${b}`,
      traps: [{ v: b - a, tag: 'eq_same_op' }, { v: b, tag: 'copied' }, { v: a, tag: 'copied' }],
      sol: T(`Азайғыш белгісіз, оны табу үшін айырмаға азайтқышты қосамыз. ${v} = ${b} + ${a} = ${x}. Тексеру: ${x} − ${a} = ${b}.`,
        `Неизвестно уменьшаемое: чтобы его найти, к разности прибавляем вычитаемое. ${v} = ${b} + ${a} = ${x}. Проверка: ${x} − ${a} = ${b}.`),
    };
  }
  if (kind === 'mul') {
    const a = r.int(2, 9), x = r.int(3, 25), b = a * x, form = r.int(0, 2);
    return {
      kind, v, a, b, x, eq: form === 0 ? `${a} · ${v} = ${b}` : form === 1 ? `${v} · ${a} = ${b}` : `${a}${v} = ${b}`,
      traps: [{ v: b * a, tag: 'eq_same_op' }, { v: b - a, tag: 'eq_wrong_op' }, { v: b + a, tag: 'eq_wrong_op' }, { v: b, tag: 'copied' }],
      sol: T(`Көбейткіш белгісіз, оны табу үшін көбейтіндіні белгілі көбейткішке бөлеміз. ${v} = ${b} : ${a} = ${x}. Тексеру: ${a} · ${x} = ${b}.`,
        `Неизвестен множитель: чтобы его найти, произведение делим на известный множитель. ${v} = ${b} : ${a} = ${x}. Проверка: ${a} · ${x} = ${b}.`),
    };
  }
  if (kind === 'div') {
    const a = r.int(2, 9), b = r.int(2, 20), x = a * b;
    return {
      kind, v, a, b, x, eq: `${v} : ${a} = ${b}`,
      traps: [{ v: b % a === 0 ? b / a : 0, tag: 'eq_same_op' }, { v: b + a, tag: 'eq_wrong_op' }, { v: b - a, tag: 'eq_wrong_op' }, { v: b, tag: 'copied' }],
      sol: T(`Бөлінгіш белгісіз, оны табу үшін бөліндіні бөлгішке көбейтеміз. ${v} = ${b} · ${a} = ${x}. Тексеру: ${x} : ${a} = ${b}.`,
        `Неизвестно делимое: чтобы его найти, частное умножаем на делитель. ${v} = ${b} · ${a} = ${x}. Проверка: ${x} : ${a} = ${b}.`),
    };
  }
  if (kind === 'subtrahend') {
    const a = r.int(20, 150), x = r.int(3, a - 3), b = a - x;
    return {
      kind, v, a, b, x, eq: `${a} − ${v} = ${b}`,
      traps: [{ v: a + b, tag: 'eq_sub_swapped' }, { v: b, tag: 'copied' }, { v: a, tag: 'copied' }],
      sol: T(`Азайтқыш белгісіз, оны табу үшін азайғыштан айырманы азайтамыз. ${v} = ${a} − ${b} = ${x}. Тексеру: ${a} − ${x} = ${b}.`,
        `Неизвестно вычитаемое: чтобы его найти, из уменьшаемого вычитаем разность. ${v} = ${a} − ${b} = ${x}. Проверка: ${a} − ${x} = ${b}.`),
    };
  }
  if (kind === 'divisor') {
    const x = r.int(2, 12), b = r.int(2, 15), a = x * b;
    return {
      kind, v, a, b, x, eq: `${a} : ${v} = ${b}`,
      traps: [{ v: a * b, tag: 'eq_div_swapped' }, { v: a - b, tag: 'eq_wrong_op' }, { v: b, tag: 'copied' }, { v: a, tag: 'copied' }],
      sol: T(`Бөлгіш белгісіз, оны табу үшін бөлінгішті бөліндіге бөлеміз. ${v} = ${a} : ${b} = ${x}. Тексеру: ${a} : ${x} = ${b}.`,
        `Неизвестен делитель: чтобы его найти, делимое делим на частное. ${v} = ${a} : ${b} = ${x}. Проверка: ${a} : ${x} = ${b}.`),
    };
  }
  throw new Error('oneStepEq ' + kind);
}
export const ONE_STEP_KINDS = ['add', 'sub', 'mul', 'div', 'subtrahend', 'divisor'];

// =========================================================================================================
// Двухшаговые уравнения (eq.two_step)
// =========================================================================================================
/** Уравнение в два шага. kind: mul_add | mul_sub | div_add | div_sub | minus_mul. */
export function twoStepEq(r, kind) {
  const v = pick(r, VARS);
  if (kind === 'mul_add') {
    const a = r.int(2, 9), x = r.int(2, 15), b = r.chance(0.5) ? a * r.int(1, 4) : r.int(2, 30), c = a * x + b, form = r.int(0, 2);
    const eq = form === 0 ? `${a} · ${v} + ${b} = ${c}` : form === 1 ? `${b} + ${a} · ${v} = ${c}` : `${a}${v} + ${b} = ${c}`;
    return {
      kind, v, a, b, c, x, eq,
      traps: [{ v: c - b, tag: 'eq2_stopped_midway' }, { v: c % a === 0 ? c / a - b : 0, tag: 'eq2_order' }, { v: (c + b) % a === 0 ? (c + b) / a : 0, tag: 'eq2_sign' }, { v: (c - b) * a, tag: 'eq_same_op' }],
      sol: T(`Алдымен қосылғышты жоямыз: екі жағынан да ${b} азайтамыз. ${a} · ${v} = ${c} − ${b} = ${c - b}. Сосын ${dat(a)} бөлеміз: ${v} = ${c - b} : ${a} = ${x}. Тексеру: ${a} · ${x} + ${b} = ${c}.`,
        `Сначала убираем слагаемое: из обеих частей вычитаем ${b}. ${a} · ${v} = ${c} − ${b} = ${c - b}. Затем делим на ${a}: ${v} = ${c - b} : ${a} = ${x}. Проверка: ${a} · ${x} + ${b} = ${c}.`),
    };
  }
  if (kind === 'mul_sub') {
    const a = r.int(2, 9), x = r.int(3, 20), b = r.chance(0.5) ? a * r.int(1, 3) : r.int(2, 30);
    if (b >= a * x) return twoStepEq(r, kind);
    const c = a * x - b, form = r.int(0, 1);
    return {
      kind, v, a, b, c, x, eq: form === 0 ? `${a} · ${v} − ${b} = ${c}` : `${a}${v} − ${b} = ${c}`,
      traps: [{ v: (c - b) % a === 0 ? (c - b) / a : 0, tag: 'eq2_sign' }, { v: c + b, tag: 'eq2_stopped_midway' }, { v: c % a === 0 ? c / a + b : 0, tag: 'eq2_order' }, { v: (c + b) * a, tag: 'eq_same_op' }],
      sol: T(`Алдымен азайтқышты жоямыз: екі жағына да ${b} қосамыз. ${a} · ${v} = ${c} + ${b} = ${c + b}. Сосын ${dat(a)} бөлеміз: ${v} = ${c + b} : ${a} = ${x}. Тексеру: ${a} · ${x} − ${b} = ${c}.`,
        `Сначала убираем вычитаемое: к обеим частям прибавляем ${b}. ${a} · ${v} = ${c} + ${b} = ${c + b}. Затем делим на ${a}: ${v} = ${c + b} : ${a} = ${x}. Проверка: ${a} · ${x} − ${b} = ${c}.`),
    };
  }
  if (kind === 'div_add') {
    const a = r.int(2, 9), q = r.int(2, 15), b = r.int(2, 25), c = q + b, x = a * q;
    return {
      kind, v, a, b, c, x, eq: `${v} : ${a} + ${b} = ${c}`,
      traps: [{ v: q, tag: 'eq2_stopped_midway' }, { v: a * c - b, tag: 'eq2_order' }, { v: (c + b) * a, tag: 'eq2_sign' }, { v: q % a === 0 ? q / a : 0, tag: 'eq_same_op' }],
      sol: T(`Алдымен қосылғышты жоямыз: екі жағынан да ${b} азайтамыз. ${v} : ${a} = ${c} − ${b} = ${q}. Сосын ${dat(a)} көбейтеміз: ${v} = ${q} · ${a} = ${x}. Тексеру: ${x} : ${a} + ${b} = ${c}.`,
        `Сначала убираем слагаемое: из обеих частей вычитаем ${b}. ${v} : ${a} = ${c} − ${b} = ${q}. Затем умножаем на ${a}: ${v} = ${q} · ${a} = ${x}. Проверка: ${x} : ${a} + ${b} = ${c}.`),
    };
  }
  if (kind === 'div_sub') {
    const a = r.int(2, 9), q = r.int(5, 20), b = r.int(2, q - 2), c = q - b, x = a * q;
    return {
      kind, v, a, b, c, x, eq: `${v} : ${a} − ${b} = ${c}`,
      traps: [{ v: q, tag: 'eq2_stopped_midway' }, { v: a * c + b, tag: 'eq2_order' }, { v: (c - b) * a, tag: 'eq2_sign' }, { v: q % a === 0 ? q / a : 0, tag: 'eq_same_op' }],
      sol: T(`Алдымен азайтқышты жоямыз: екі жағына да ${b} қосамыз. ${v} : ${a} = ${c} + ${b} = ${q}. Сосын ${dat(a)} көбейтеміз: ${v} = ${q} · ${a} = ${x}. Тексеру: ${x} : ${a} − ${b} = ${c}.`,
        `Сначала убираем вычитаемое: к обеим частям прибавляем ${b}. ${v} : ${a} = ${c} + ${b} = ${q}. Затем умножаем на ${a}: ${v} = ${q} · ${a} = ${x}. Проверка: ${x} : ${a} − ${b} = ${c}.`),
    };
  }
  if (kind === 'minus_mul') {
    const k = r.int(2, 8), x = r.int(2, 14), c = r.int(2, 40), a = k * x + c, form = r.int(0, 1);
    return {
      kind, v, a, b: k, c, x, eq: form === 0 ? `${a} − ${k} · ${v} = ${c}` : `${a} − ${k}${v} = ${c}`,
      traps: [{ v: (a + c) % k === 0 ? (a + c) / k : 0, tag: 'eq2_sign' }, { v: a - c, tag: 'eq2_stopped_midway' }, { v: (a - c) * k, tag: 'eq_same_op' }, { v: a % k === 0 ? a / k - c : 0, tag: 'eq2_order' }],
      sol: T(`Азайтқыш ${k} · ${v} белгісіз: оны табу үшін азайғыштан айырманы азайтамыз. ${k} · ${v} = ${a} − ${c} = ${a - c}. Сосын ${dat(k)} бөлеміз: ${v} = ${a - c} : ${k} = ${x}. Тексеру: ${a} − ${k} · ${x} = ${c}.`,
        `Неизвестно вычитаемое ${k} · ${v}: из уменьшаемого вычитаем разность. ${k} · ${v} = ${a} − ${c} = ${a - c}. Затем делим на ${k}: ${v} = ${a - c} : ${k} = ${x}. Проверка: ${a} − ${k} · ${x} = ${c}.`),
    };
  }
  throw new Error('twoStepEq ' + kind);
}
export const TWO_STEP_KINDS = ['mul_add', 'mul_sub', 'div_add', 'div_sub', 'minus_mul'];

// =========================================================================================================
// Выражения с буквой (expr.variables)
// =========================================================================================================
/** Выражение с одной буквой, подстановка. Возвращает текст, значение и ловушки. Записи вида «5n» (implicit) подставляются как 5 · n. */
export function substituteExpr(r, hard = false) {
  const v = pick(r, ['n', 'm', 'k', 'x', 'y', 'p']);   // без «a»: латинская a рядом с цифрой читается как кириллическая «а» («3a» ≈ «За»)
  const forms = hard ? ['bracket', 'rev_minus', 'rev_plus', 'plus', 'minus'] : ['plus', 'minus', 'rev_plus', 'rev_minus'];
  const form = pick(r, forms);
  const val = r.int(2, 9), a = r.int(2, 9), implicit = r.chance(hard ? 0.7 : 0.5);
  const term = implicit ? `${a}${v}` : `${a} · ${v}`;
  const cat = x => Number(`${a}${x}`);                      // «5n» при n = 4, прочитанное как число 54
  let b = r.int(2, 30), expr, ans, traps, steps;
  if (form === 'plus') {
    ans = a * val + b; expr = `${term} + ${b}`;
    traps = [{ v: implicit ? cat(val) + b : 0, tag: 'expr_concat' }, { v: a * val, tag: 'expr_dropped_term' }, { v: val + b, tag: 'expr_dropped_coef' }, { v: a + val + b, tag: 'expr_added_all' }, { v: a * val - b, tag: 'expr_wrong_sign' }];
    steps = [`${a} · ${val} = ${a * val}`, `${a * val} + ${b} = ${ans}`];
  } else if (form === 'minus') {
    if (b >= a * val) b = r.int(1, a * val - 1);
    ans = a * val - b; expr = `${term} − ${b}`;
    traps = [{ v: implicit ? cat(val) - b : 0, tag: 'expr_concat' }, { v: a * val, tag: 'expr_dropped_term' }, { v: val - b, tag: 'expr_dropped_coef' }, { v: a * val + b, tag: 'expr_wrong_sign' }, { v: a + val - b, tag: 'expr_added_all' }];
    steps = [`${a} · ${val} = ${a * val}`, `${a * val} − ${b} = ${ans}`];
  } else if (form === 'rev_plus') {
    ans = b + a * val; expr = `${b} + ${term}`;
    traps = [{ v: (b + a) * val, tag: 'left_to_right' }, { v: implicit ? b + cat(val) : 0, tag: 'expr_concat' }, { v: b, tag: 'expr_dropped_term' }, { v: b + val, tag: 'expr_dropped_coef' }, { v: b - a * val, tag: 'expr_wrong_sign' }];
    steps = [`${a} · ${val} = ${a * val}`, `${b} + ${a * val} = ${ans}`];
  } else if (form === 'rev_minus') {
    b = r.int(a * val + 1, a * val + 40);
    ans = b - a * val; expr = `${b} − ${term}`;
    traps = [{ v: (b - a) * val, tag: 'left_to_right' }, { v: implicit ? b - cat(val) : 0, tag: 'expr_concat' }, { v: b + a * val, tag: 'expr_wrong_sign' }, { v: b - val, tag: 'expr_dropped_coef' }, { v: a * val, tag: 'expr_dropped_term' }];
    steps = [`${a} · ${val} = ${a * val}`, `${b} − ${a * val} = ${ans}`];
  } else {                                                 // bracket: a(v + b)
    ans = a * (val + b); expr = implicit ? `${a}(${v} + ${b})` : `(${v} + ${b}) · ${a}`;
    traps = [{ v: a * val + b, tag: 'expr_bracket_ignored' }, { v: val + b, tag: 'expr_dropped_coef' }, { v: a + val + b, tag: 'expr_added_all' }, { v: a * (val - b > 0 ? val - b : val + b + 1), tag: 'expr_wrong_sign' }];
    steps = [`${val} + ${b} = ${val + b}`, `${a} · ${val + b} = ${ans}`];
  }
  const sub = form === 'bracket' ? (implicit ? `${a} · (${val} + ${b})` : `(${val} + ${b}) · ${a}`) : form === 'rev_plus' ? `${b} + ${a} · ${val}` : form === 'rev_minus' ? `${b} − ${a} · ${val}` : `${a} · ${val} ${form === 'plus' ? '+' : '−'} ${b}`;
  return { v, val, a, b, form, implicit, expr, ans, traps, steps, sub };
}

/** Две буквы: p·u ± q·v, u·v ± c, (u + v)·p, p·(u − v). */
export function substituteTwo(r) {
  const [u, w] = pick(r, [['b', 'd'], ['m', 'n'], ['x', 'y'], ['p', 'q'], ['c', 'd']]);
  const form = pick(r, ['lin_plus', 'lin_minus', 'prod_plus', 'prod_minus', 'sum_times', 'diff_times']);
  const U = r.int(2, 9), W = r.int(2, 9), p = r.int(2, 7), q = r.int(2, 7), c = r.int(2, 30);
  let expr, ans, traps, steps, sub;
  const cat = (x, y) => Number(`${x}${y}`);
  if (form === 'lin_plus') {
    ans = p * U + q * W; expr = `${p}${u} + ${q}${w}`; sub = `${p} · ${U} + ${q} · ${W}`;
    traps = [{ v: cat(p, U) + cat(q, W), tag: 'expr_concat' }, { v: p + U + q + W, tag: 'expr_added_all' }, { v: p * U + W, tag: 'expr_dropped_coef' }, { v: p * (U + q * W), tag: 'expr_bracket_ignored' }];
    steps = [`${p} · ${U} = ${p * U}`, `${q} · ${W} = ${q * W}`, `${p * U} + ${q * W} = ${ans}`];
  } else if (form === 'lin_minus') {
    if (p * U <= q * W) return substituteTwo(r);
    ans = p * U - q * W; expr = `${p}${u} − ${q}${w}`; sub = `${p} · ${U} − ${q} · ${W}`;
    traps = [{ v: cat(p, U) - cat(q, W), tag: 'expr_concat' }, { v: p * U + q * W, tag: 'expr_wrong_sign' }, { v: p * U - W, tag: 'expr_dropped_coef' }, { v: p + U - q - W, tag: 'expr_added_all' }];
    steps = [`${p} · ${U} = ${p * U}`, `${q} · ${W} = ${q * W}`, `${p * U} − ${q * W} = ${ans}`];
  } else if (form === 'prod_plus') {
    ans = U * W + c; expr = `${u}${w} + ${c}`; sub = `${U} · ${W} + ${c}`;
    traps = [{ v: cat(U, W) + c, tag: 'expr_concat' }, { v: U + W + c, tag: 'expr_added_all' }, { v: U * W, tag: 'expr_dropped_term' }, { v: U * (W + c), tag: 'expr_bracket_ignored' }];
    steps = [`${U} · ${W} = ${U * W}`, `${U * W} + ${c} = ${ans}`];
  } else if (form === 'prod_minus') {
    if (U * W <= c) return substituteTwo(r);
    ans = U * W - c; expr = `${u}${w} − ${c}`; sub = `${U} · ${W} − ${c}`;
    traps = [{ v: cat(U, W) - c, tag: 'expr_concat' }, { v: U + W - c, tag: 'expr_added_all' }, { v: U * W, tag: 'expr_dropped_term' }, { v: U * W + c, tag: 'expr_wrong_sign' }];
    steps = [`${U} · ${W} = ${U * W}`, `${U * W} − ${c} = ${ans}`];
  } else if (form === 'sum_times') {
    ans = (U + W) * p; expr = `(${u} + ${w}) · ${p}`; sub = `(${U} + ${W}) · ${p}`;
    traps = [{ v: U + W * p, tag: 'expr_bracket_ignored' }, { v: U * p + W, tag: 'expr_bracket_ignored' }, { v: U + W + p, tag: 'expr_added_all' }, ...(U !== W ? [{ v: Math.abs(U - W) * p, tag: 'expr_wrong_sign' }] : [])];   // знак наоборот: (U − W) · p; при U = W такой ошибки нет (получился бы 0)
    steps = [`${U} + ${W} = ${U + W}`, `${U + W} · ${p} = ${ans}`];
  } else {
    if (U <= W) return substituteTwo(r);
    ans = p * (U - W); expr = `${p}(${u} − ${w})`; sub = `${p} · (${U} − ${W})`;
    traps = [{ v: p * U - W, tag: 'expr_bracket_ignored' }, { v: p + U - W, tag: 'expr_added_all' }, { v: p * (U + W), tag: 'expr_wrong_sign' }, { v: U - W, tag: 'expr_dropped_coef' }];
    steps = [`${U} − ${W} = ${U - W}`, `${p} · ${U - W} = ${ans}`];
  }
  return { u, w, U, W, form, expr, ans, traps, steps, sub };
}

// =========================================================================================================
// Выражение по словам (expr.variables)
// =========================================================================================================
const fn = {
  plus: (v, a) => ({ s: `${v} + ${a}`, f: n => n + a }), minus: (v, a) => ({ s: `${v} − ${a}`, f: n => n - a }),
  times: (v, a) => ({ s: `${a} · ${v}`, f: n => a * n }), div: (v, a) => ({ s: `${v} : ${a}`, f: n => n / a }),
  rminus: (v, a) => ({ s: `${a} − ${v}`, f: n => a - n }), rdiv: (v, a) => ({ s: `${a} : ${v}`, f: n => a / n }),
};
const TAGS = { opposite: 'compose_opposite', mix: 'compose_mix', reversed: 'compose_reversed' };
/** Одно действие. Возвращает условие (kz/ru), верное выражение и ловушки [{s, f, tag}]. */
export function composeOne(r) {
  const v = pick(r, ['n', 'x', 'k', 'm']), it = pick(r, ITEMS), a = r.int(2, 9) + (r.chance(0.5) ? r.int(0, 6) : 0);
  const kind = pick(r, ['more', 'less', 'times', 'share', 'took', 'each', 'added']);
  const t = k => ({ ...fn[k](v, a), tag: '' });
  const tr = (k, tag) => ({ ...fn[k](v, a), tag });
  const noun = it.kz, ruN = it.ru;
  let kz, ru, correct, traps;
  if (kind === 'more') {
    kz = `Бірінші қорапта ${v} ${noun} бар. Екінші қорапта бірінші қорапқа қарағанда ${a} ${it.dat} артық. Екінші қорапта неше ${noun} бар?`;
    ru = `В первой коробке ${v} шт. (${ruN}). Во второй на ${a} шт. больше, чем в первой. Сколько во второй коробке?`;
    correct = t('plus'); traps = [tr('minus', TAGS.opposite), tr('times', TAGS.mix), tr('div', TAGS.mix), tr('rminus', TAGS.reversed)];
  } else if (kind === 'less') {
    kz = `Бірінші қорапта ${v} ${noun} бар. Екінші қорапта бірінші қорапқа қарағанда ${a} ${it.dat} кем. Екінші қорапта неше ${noun} бар?`;
    ru = `В первой коробке ${v} шт. (${ruN}). Во второй на ${a} шт. меньше, чем в первой. Сколько во второй коробке?`;
    correct = t('minus'); traps = [tr('plus', TAGS.opposite), tr('rminus', TAGS.reversed), tr('div', TAGS.mix), tr('times', TAGS.mix)];
  } else if (kind === 'times') {
    kz = `Бірінші қорапта ${v} ${noun} бар. Екінші қорапта бірінші қорапқа қарағанда ${a} есе көп ${noun} бар. Екінші қорапта неше ${noun} бар?`;
    ru = `В первой коробке ${v} шт. (${ruN}). Во второй в ${a} раз больше, чем в первой. Сколько во второй коробке?`;
    correct = t('times'); traps = [tr('plus', TAGS.mix), tr('div', TAGS.opposite), tr('minus', TAGS.mix), tr('rdiv', TAGS.reversed)];
  } else if (kind === 'share') {
    kz = `${v} ${it.acc} ${a} балаға тең бөлді. Әр балаға неше ${noun} тиді?`;
    ru = `${v} шт. (${ruN}) разделили поровну между ${a} детьми. Сколько получил каждый ребёнок?`;
    correct = t('div'); traps = [tr('times', TAGS.opposite), tr('rdiv', TAGS.reversed), tr('minus', TAGS.mix), tr('plus', TAGS.mix)];
  } else if (kind === 'took') {
    kz = `Қорапта ${v} ${noun} болды. Одан ${a} ${noun} алды. Қорапта неше ${noun} қалды?`;
    ru = `В коробке было ${v} шт. (${ruN}). Из неё забрали ${a} шт. Сколько осталось?`;
    correct = t('minus'); traps = [tr('plus', TAGS.opposite), tr('rminus', TAGS.reversed), tr('div', TAGS.mix), tr('times', TAGS.mix)];
  } else if (kind === 'each') {
    kz = `Әр қорапта ${v} ${noun} бар. ${a} қорапта барлығы неше ${noun} бар?`;
    ru = `В каждой коробке по ${v} шт. (${ruN}). Сколько всего в ${a} коробках?`;
    correct = t('times'); traps = [tr('plus', TAGS.mix), tr('div', TAGS.opposite), tr('minus', TAGS.mix), tr('rdiv', TAGS.reversed)];
  } else {
    kz = `Қорапта ${v} ${noun} болды. Оған тағы ${a} ${noun} салды. Қорапта барлығы неше ${noun} болды?`;
    ru = `В коробке было ${v} шт. (${ruN}). В неё положили ещё ${a} шт. Сколько стало?`;
    correct = t('plus'); traps = [tr('minus', TAGS.opposite), tr('times', TAGS.mix), tr('rminus', TAGS.reversed), tr('div', TAGS.mix)];
  }
  return { v, a, kind, kz, ru, correct, traps };
}

/** Два действия: a · v ± b, 2 · v ± b. */
export function composeTwo(r) {
  const v = pick(r, ['n', 'x', 'k', 'm']), it = pick(r, ITEMS), a = r.int(2, 9), b = r.int(2, 9) + r.int(0, 8);
  const kind = pick(r, ['times_took', 'each_plus', 'two_more', 'two_less']);
  const noun = it.kz, ruN = it.ru;
  const lin = (k, c, sign) => ({ s: `${k} · ${v} ${sign} ${c}`, f: n => k * n + (sign === '+' ? c : -c) });
  const brk = (k, c, sign) => ({ s: `${k} · (${v} ${sign} ${c})`, f: n => k * (n + (sign === '+' ? c : -c)) });
  const one = (c, sign) => ({ s: `${v} ${sign} ${c}`, f: n => n + (sign === '+' ? c : -c) });
  let kz, ru, correct, traps;
  if (kind === 'times_took') {
    kz = `Бірінші қорапта ${v} ${noun} бар. Екінші қорапта бірінші қорапқа қарағанда ${a} есе көп ${noun} бар. Екінші қораптан ${b} ${noun} алды. Екінші қорапта неше ${noun} қалды?`;
    ru = `В первой коробке ${v} шт. (${ruN}). Во второй в ${a} раз больше. Из второй забрали ${b} шт. Сколько осталось во второй коробке?`;
    correct = lin(a, b, '−');
    traps = [{ ...lin(a, b, '+'), tag: 'compose_opposite' }, { s: `${a} · ${v}`, f: n => a * n, tag: 'compose_dropped' }, { ...brk(a, b, '−'), tag: 'compose_brackets' }, { ...one(b, '−'), tag: 'compose_dropped' }];
  } else if (kind === 'each_plus') {
    kz = `${a} қорапта әрқайсысында ${v} ${noun} бар, тағы ${b} ${noun} бөлек жатыр. Барлығы неше ${noun}?`;
    ru = `В ${a} коробках по ${v} шт. (${ruN}) и ещё ${b} шт. лежат отдельно. Сколько всего?`;
    correct = lin(a, b, '+');
    traps = [{ ...lin(a, b, '−'), tag: 'compose_opposite' }, { s: `${a} · ${v}`, f: n => a * n, tag: 'compose_dropped' }, { ...brk(a, b, '+'), tag: 'compose_brackets' }, { ...one(b, '+'), tag: 'compose_dropped' }];
  } else if (kind === 'two_more') {
    kz = `Бірінші қорапта ${v} ${noun} бар. Екінші қорапта бірінші қорапқа қарағанда ${b} ${it.dat} артық. Екі қорапта барлығы неше ${noun} бар?`;
    ru = `В первой коробке ${v} шт. (${ruN}). Во второй на ${b} шт. больше. Сколько всего в двух коробках?`;
    correct = lin(2, b, '+');
    traps = [{ ...one(b, '+'), tag: 'compose_one_box' }, { ...brk(2, b, '+'), tag: 'compose_brackets' }, { ...lin(2, b, '−'), tag: 'compose_opposite' }, { s: `${v} + 2 · ${b}`, f: n => n + 2 * b, tag: 'compose_dropped' }];
  } else {
    kz = `Бірінші қорапта ${v} ${noun} бар. Екінші қорапта бірінші қорапқа қарағанда ${b} ${it.dat} кем. Екі қорапта барлығы неше ${noun} бар?`;
    ru = `В первой коробке ${v} шт. (${ruN}). Во второй на ${b} шт. меньше. Сколько всего в двух коробках?`;
    correct = lin(2, b, '−');
    traps = [{ ...one(b, '−'), tag: 'compose_one_box' }, { ...brk(2, b, '−'), tag: 'compose_brackets' }, { ...lin(2, b, '+'), tag: 'compose_opposite' }, { s: `${v} − 2 · ${b}`, f: n => n - 2 * b, tag: 'compose_dropped' }];
  }
  return { v, a, b, kind, kz, ru, correct, traps };
}

/** Пять вариантов-выражений: верное + ловушки без эквивалентных ему (по отпечатку), недостающее добираем «случайными». */
function packExpr(r, v, correct, traps) {
  const seen = new Set([sig(correct.f)]);
  const wrong = [];
  for (const t of traps) { const g = sig(t.f); if (seen.has(g)) continue; seen.add(g); wrong.push({ v: t.s, tag: t.tag }); }
  const filler = () => {
    for (let k = 0; k < 40; k++) {
      const c = r.int(2, 9), f = pick(r, [n => n + c, n => n - c, n => c * n, n => c * n + 1, n => c * n - 1]);
      const s = f(7) === 7 + c ? `${v} + ${c}` : f(7) === 7 - c ? `${v} − ${c}` : f(7) === c * 7 ? `${c} · ${v}` : f(7) === c * 7 + 1 ? `${c} · ${v} + 1` : `${c} · ${v} − 1`;
      const g = sig(f); if (!seen.has(g)) { seen.add(g); return s; }
    }
    return null;
  };
  return choices5(r, correct.s, wrong, filler);
}

// =========================================================================================================
// Задачи словами
// =========================================================================================================
/** Одношаговая задача словами: ответ — число (начальное количество, число коробок и т.п.). */
export function storyOne(r) {
  const it = pick(r, ITEMS), kind = pick(r, ['took', 'added', 'boxes', 'share']), noun = it.kz;
  if (kind === 'took') {
    const a = r.int(3, 30), b = r.int(3, 40), x = a + b;
    return { kind, x, a, b, kz: `Қорапта бірнеше ${noun} болды. Одан ${a} ${noun} алғанда, ${b} ${noun} қалды. Алғашында қорапта неше ${noun} болды?`,
      ru: `В коробке было несколько штук (${it.ru}). Когда из неё забрали ${a} шт., осталось ${b} шт. Сколько было вначале?`,
      traps: [{ v: b - a, tag: 'eq_same_op' }, { v: b, tag: 'copied' }, { v: a, tag: 'copied' }],
      sol: T(`Қорапта x ${noun} болсын: x − ${a} = ${b}. Азайғыш белгісіз, оны табу үшін айырмаға азайтқышты қосамыз: x = ${b} + ${a} = ${x}.`,
        `Пусть было x шт.: x − ${a} = ${b}. Неизвестно уменьшаемое: x = ${b} + ${a} = ${x}.`) };
  }
  if (kind === 'added') {
    const a = r.int(3, 30), x = r.int(5, 60), b = a + x;
    return { kind, x, a, b, kz: `Қорапта бірнеше ${noun} болды. Оған ${a} ${noun} қосқанда, барлығы ${b} ${noun} болды. Алғашында қорапта неше ${noun} болды?`,
      ru: `В коробке было несколько штук (${it.ru}). Когда к ним добавили ${a} шт., стало ${b} шт. Сколько было вначале?`,
      traps: [{ v: a + b, tag: 'eq_same_op' }, { v: b, tag: 'copied' }, { v: a, tag: 'copied' }],
      sol: T(`Қорапта x ${noun} болсын: x + ${a} = ${b}. Қосылғыш белгісіз, оны табу үшін қосындыдан екінші қосылғышты азайтамыз: x = ${b} − ${a} = ${x}.`,
        `Пусть было x шт.: x + ${a} = ${b}. Неизвестно слагаемое: x = ${b} − ${a} = ${x}.`) };
  }
  if (kind === 'boxes') {
    const a = r.int(2, 9), x = r.int(3, 15), b = a * x;
    return { kind, x, a, b, kz: `Әр қорапта бірдей ${a} ${noun} бар. Барлығы ${b} ${noun} болса, неше қорап бар?`,
      ru: `В каждой коробке по ${a} шт. (${it.ru}). Всего ${b} шт. Сколько коробок?`,
      traps: [{ v: a * b, tag: 'eq_same_op' }, { v: b - a, tag: 'eq_wrong_op' }, { v: b + a, tag: 'eq_wrong_op' }, { v: b, tag: 'copied' }],
      sol: T(`Қорап саны x болсын: ${a} · x = ${b}. Көбейткіш белгісіз, оны табу үшін көбейтіндіні белгілі көбейткішке бөлеміз: x = ${b} : ${a} = ${x}.`,
        `Пусть коробок x: ${a} · x = ${b}. Неизвестен множитель: x = ${b} : ${a} = ${x}.`) };
  }
  const a = r.int(2, 9), b = r.int(2, 15), x = a * b;
  return { kind, x, a, b, kz: `Бірнеше ${noun} ${a} балаға тең бөлгенде, әр балаға ${b} ${it.abl} тиді. Барлығы неше ${noun} болды?`,
    ru: `Несколько штук (${it.ru}) разделили поровну между ${a} детьми, каждому досталось по ${b} шт. Сколько всего было?`,
    traps: [{ v: b % a === 0 ? b / a : 0, tag: 'eq_same_op' }, { v: a + b, tag: 'eq_wrong_op' }, { v: b - a, tag: 'eq_wrong_op' }, { v: b, tag: 'copied' }],
    sol: T(`Барлығы x ${noun} болсын: x : ${a} = ${b}. Бөлінгіш белгісіз, оны табу үшін бөліндіні бөлгішке көбейтеміз: x = ${b} · ${a} = ${x}.`,
      `Пусть всего x шт.: x : ${a} = ${b}. Неизвестно делимое: x = ${b} · ${a} = ${x}.`) };
}

/** Двухшаговая задача словами (a · x + b = c, a · x − b = c; две формы: коробки и цена). */
export function storyTwo(r) {
  const it = pick(r, ITEMS), noun = it.kz, kind = pick(r, ['boxes_plus', 'boxes_minus', 'price']);
  const a = r.int(2, 9), x = r.int(3, 15);
  if (kind === 'boxes_plus') {
    const b = r.int(3, 30), c = a * x + b;
    return { kind, x, a, b, c, kz: `${a} қорапта бірдей санда ${noun} бар, тағы ${b} ${noun} бөлек жатыр. Барлығы ${c} ${noun}. Бір қорапта неше ${noun} бар?`,
      ru: `В ${a} коробках поровну штук (${it.ru}), и ещё ${b} шт. лежат отдельно. Всего ${c} шт. Сколько в одной коробке?`,
      traps: [{ v: c - b, tag: 'eq2_stopped_midway' }, { v: c % a === 0 ? c / a - b : 0, tag: 'eq2_order' }, { v: (c + b) % a === 0 ? (c + b) / a : 0, tag: 'eq2_sign' }, { v: (c - b) * a, tag: 'eq_same_op' }],
      sol: T(`Бір қорапта x ${noun} болсын: ${a} · x + ${b} = ${c}. Алдымен қосылғышты жоямыз: ${a} · x = ${c} − ${b} = ${c - b}. Сосын ${dat(a)} бөлеміз: x = ${c - b} : ${a} = ${x}.`,
        `Пусть в одной коробке x шт.: ${a} · x + ${b} = ${c}. Сначала: ${a} · x = ${c} − ${b} = ${c - b}. Затем x = ${c - b} : ${a} = ${x}.`) };
  }
  if (kind === 'boxes_minus') {
    const b = r.int(2, a * x - 1 > 30 ? 30 : a * x - 1), c = a * x - b;
    return { kind, x, a, b, c, kz: `${a} қорапта бірдей санда ${noun} болды. Одан ${b} ${noun} алғанда, ${c} ${noun} қалды. Бір қорапта неше ${noun} болды?`,
      ru: `В ${a} коробках было поровну штук (${it.ru}). Когда из них забрали ${b} шт., осталось ${c} шт. Сколько было в одной коробке?`,
      traps: [{ v: (c - b) % a === 0 ? (c - b) / a : 0, tag: 'eq2_sign' }, { v: c + b, tag: 'eq2_stopped_midway' }, { v: c % a === 0 ? c / a + b : 0, tag: 'eq2_order' }, { v: (c + b) * a, tag: 'eq_same_op' }],
      sol: T(`Бір қорапта x ${noun} болсын: ${a} · x − ${b} = ${c}. Алдымен азайтқышты жоямыз: ${a} · x = ${c} + ${b} = ${c + b}. Сосын ${dat(a)} бөлеміз: x = ${c + b} : ${a} = ${x}.`,
        `Пусть в одной коробке x шт.: ${a} · x − ${b} = ${c}. Сначала: ${a} · x = ${c} + ${b} = ${c + b}. Затем x = ${c + b} : ${a} = ${x}.`) };
  }
  const b = r.int(2, 9) * 10, y = r.int(3, 18) * 10, c = a * y + b;      // цена кратна 10 тенге: числа похожи на настоящие
  return { kind, x: y, a, b, c, kz: `Бір дәптердің бағасы белгісіз. ${a} дәптер мен ${b} теңгелік қарындаш сатып алғанда, барлығы ${c} теңге төленді. Бір дәптер неше теңге тұрады?`,
    ru: `Цена одной тетради неизвестна. За ${a} тетради и карандаш за ${b} тенге заплатили всего ${c} тенге. Сколько стоит одна тетрадь (в тенге)?`,
    traps: [{ v: c - b, tag: 'eq2_stopped_midway' }, { v: c % a === 0 ? c / a - b : 0, tag: 'eq2_order' }, { v: (c + b) % a === 0 ? (c + b) / a : 0, tag: 'eq2_sign' }, { v: (c - b) * a, tag: 'eq_same_op' }],
    sol: T(`Бір дәптердің бағасы x теңге болсын: ${a} · x + ${b} = ${c}. Алдымен қарындаштың бағасын азайтамыз: ${a} · x = ${c} − ${b} = ${c - b}. Сосын ${dat(a)} бөлеміз: x = ${c - b} : ${a} = ${y}.`,
      `Пусть тетрадь стоит x тенге: ${a} · x + ${b} = ${c}. Сначала вычтем цену карандаша: ${a} · x = ${c} − ${b} = ${c - b}. Затем x = ${c - b} : ${a} = ${y}.`) };
}

/** «Задуманное число»: два действия словами. */
export function thinkNumber(r) {
  const kind = pick(r, TWO_STEP_KINDS.slice(0, 4));
  const e = twoStepEq(r, kind);
  const { a, b, c, x } = e;
  const first = kind.startsWith('mul') ? `Ойлаған санды ${dat(a)} көбейтіп` : `Ойлаған санды ${dat(a)} бөліп`;
  const second = kind.endsWith('add') ? `нәтижеге ${b} қосқанда` : `нәтижеден ${b} азайтқанда`;
  const firstRu = kind.startsWith('mul') ? `умножили на ${a}` : `разделили на ${a}`;
  const ru = `Задуманное число ${firstRu}, ${kind.endsWith('add') ? 'к результату прибавили' : 'из результата вычли'} ${b}, получили ${c}. Найдите задуманное число.`;
  return { ...e, kz: `${first}, ${second} ${c} шықты. Ойлаған санды табыңыз.`, ru, think: { a, b, c, x, kind } };
}

// =========================================================================================================
// Генераторы
// =========================================================================================================
const eqItem = (r, e, ask = 'Теңдеуді шешіңіз:', askRu = 'Решите уравнение:') => {
  const { choices, answer } = packNum(r, e.x, e.traps);
  return { kz: `${ask}\n${e.eq}`, ru: `${askRu}\n${e.eq}`, choices, answer, sol: e.sol };
};

export default [
  // ---------------------------------- expr.variables ----------------------------------
  {
    id: 'expr.substitute',
    examType: 'equations', skills: ['expr.variables'], from: [], difficulty: 1,
    title: T('Өрнектің мәнін табу (әріптің орнына сан қою)', 'Значение выражения при заданном значении буквы'),
    gen(r) {
      const e = substituteExpr(r, false);
      const { choices, answer } = packNum(r, e.ans, e.traps);
      return {
        kz: `${e.v} = ${e.val} болса, ${e.expr} өрнегінің мәнін табыңыз.`, ru: `Найдите значение выражения ${e.expr} при ${e.v} = ${e.val}.`, choices, answer,
        sol: T(`Әріптің орнына санды қоямыз: ${e.sub}. Көбейту қосу мен азайтудан бұрын орындалады: ${e.steps.join(', ')}. Жауабы: ${e.ans}.`,
          `Подставляем число вместо буквы: ${e.sub}. Умножение выполняется раньше сложения и вычитания: ${e.steps.join(', ')}. Ответ: ${e.ans}.`),
      };
    },
  },
  {
    id: 'expr.substitute_two',
    examType: 'equations', skills: ['expr.variables'], from: [], difficulty: 2,
    title: T('Екі әріпті өрнектің мәні', 'Значение выражения с двумя буквами'),
    gen(r) {
      const e = substituteTwo(r);
      const { choices, answer } = packNum(r, e.ans, e.traps);
      return {
        kz: `${e.u} = ${e.U}, ${e.w} = ${e.W} болса, ${e.expr} өрнегінің мәнін табыңыз.`, ru: `Найдите значение выражения ${e.expr} при ${e.u} = ${e.U}, ${e.w} = ${e.W}.`, choices, answer,
        sol: T(`Әр әріптің орнына өз санын қоямыз: ${e.sub}. Алдымен жақшаны, сосын көбейтуді, соңында қосуды немесе азайтуды орындаймыз: ${e.steps.join(', ')}. Жауабы: ${e.ans}.`,
          `Каждую букву заменяем её числом: ${e.sub}. Сначала скобки, потом умножение, в конце сложение или вычитание: ${e.steps.join(', ')}. Ответ: ${e.ans}.`),
      };
    },
  },
  {
    id: 'expr.compose_one',
    examType: 'word', skills: ['expr.variables'], from: [], difficulty: 1,
    title: T('Шартты өрнекпен жазу (бір амал)', 'Записать условие выражением (одно действие)'),
    gen(r) {
      const e = composeOne(r);
      const { choices, answer } = packExpr(r, e.v, e.correct, e.traps);
      return {
        kz: `${e.kz}\nСәйкес өрнекті таңдаңыз.`, ru: `${e.ru}\nВыберите подходящее выражение.`, choices, answer,
        sol: T(`${e.v} әріпі белгісіз санды білдіреді. Шарттағы әрекетті сәйкес амалмен жазамыз: ${e.correct.s}.`,
          `Буква ${e.v} обозначает неизвестное число. Действие из условия записываем нужным знаком: ${e.correct.s}.`),
      };
    },
  },
  {
    id: 'expr.compose_two',
    examType: 'word', skills: ['expr.variables'], from: [], difficulty: 2,
    title: T('Шартты өрнекпен жазу (екі амал)', 'Записать условие выражением (два действия)'),
    gen(r) {
      const e = composeTwo(r);
      const { choices, answer } = packExpr(r, e.v, e.correct, e.traps);
      return {
        kz: `${e.kz}\nСәйкес өрнекті таңдаңыз.`, ru: `${e.ru}\nВыберите подходящее выражение.`, choices, answer,
        sol: T(`Шартта екі әрекет бар: өрнекте де екі амал болады. Әр әрекетті бір-бірден жазамыз: ${e.correct.s}.`,
          `В условии два действия, значит, и в выражении два действия. Записываем их по одному: ${e.correct.s}.`),
      };
    },
  },

  // ---------------------------------- eq.linear_basic ----------------------------------
  {
    id: 'eq.add_sub_unknown',
    examType: 'equations', skills: ['eq.linear_basic'], from: [], difficulty: 1,
    title: T('Қосу және азайту теңдеуі: x + a = b, x − a = b', 'Уравнение на сложение и вычитание: x + a = b, x − a = b'),
    gen(r) { return eqItem(r, oneStepEq(r, pick(r, ['add', 'add', 'sub']))); },
  },
  {
    id: 'eq.mul_div_unknown',
    examType: 'equations', skills: ['eq.linear_basic'], from: [], difficulty: 1,
    title: T('Көбейту және бөлу теңдеуі: a · x = b, x : a = b', 'Уравнение на умножение и деление: a · x = b, x : a = b'),
    gen(r) { return eqItem(r, oneStepEq(r, pick(r, ['mul', 'div']))); },
  },
  {
    id: 'eq.reverse_order',
    examType: 'equations', skills: ['eq.linear_basic'], from: [], difficulty: 2,
    title: T('Белгісіз азайтқыш не бөлгіш: a − x = b, a : x = b', 'Неизвестное вычитаемое или делитель: a − x = b, a : x = b'),
    gen(r) { return eqItem(r, oneStepEq(r, pick(r, ['subtrahend', 'divisor']))); },
  },
  {
    id: 'eq.check_root',
    examType: 'equations', skills: ['eq.linear_basic'], from: [], difficulty: 2,
    title: T('Қай сан теңдеудің түбірі (орнына қойып тексеру)', 'Какое число — корень уравнения (проверка подстановкой)'),
    gen(r) {
      const e = oneStepEq(r, pick(r, ONE_STEP_KINDS));
      const { choices, answer } = packNum(r, e.x, e.traps);
      return {
        kz: `Қай сан ${e.eq} теңдеуінің түбірі? Сандарды теңдеуге қойып тексеріңіз.`, ru: `Какое число — корень уравнения ${e.eq}? Проверьте числа подстановкой.`, choices, answer,
        sol: T(`Теңдеудің түбірі: орнына қойғанда теңдік дұрыс болатын сан. Белгісізді табамыз: ${e.sol.kz.split('. ').slice(1).join('. ')}`,
          `Корень уравнения — число, при подстановке которого равенство верно. Находим неизвестное: ${e.sol.ru.split('. ').slice(1).join('. ')}`),
      };
    },
  },
  {
    id: 'eq.story_one',
    examType: 'word', skills: ['eq.linear_basic'], from: [], difficulty: 2,
    title: T('Теңдеу арқылы шығатын есеп (бір қадам)', 'Задача, решаемая уравнением в один шаг'),
    gen(r) {
      const e = storyOne(r);
      const { choices, answer } = packNum(r, e.x, e.traps);
      return { kz: e.kz, ru: e.ru, choices, answer, sol: e.sol };
    },
  },

  // ---------------------------------- eq.two_step ----------------------------------
  {
    id: 'eq.two_step_mul_add',
    examType: 'equations', skills: ['eq.two_step'], from: [], difficulty: 1,
    title: T('Екі қадамды теңдеу: a · x + b = c', 'Уравнение в два шага: a · x + b = c'),
    gen(r) { return eqItem(r, twoStepEq(r, 'mul_add')); },
  },
  {
    id: 'eq.two_step_mul_sub',
    examType: 'equations', skills: ['eq.two_step'], from: [], difficulty: 2,
    title: T('Екі қадамды теңдеу: a · x − b = c', 'Уравнение в два шага: a · x − b = c'),
    gen(r) { return eqItem(r, twoStepEq(r, 'mul_sub')); },
  },
  {
    id: 'eq.two_step_div',
    examType: 'equations', skills: ['eq.two_step'], from: [], difficulty: 2,
    title: T('Екі қадамды теңдеу: x : a ± b = c', 'Уравнение в два шага: x : a ± b = c'),
    gen(r) { return eqItem(r, twoStepEq(r, pick(r, ['div_add', 'div_sub']))); },
  },
  {
    id: 'eq.think_number',
    examType: 'word', skills: ['eq.two_step'], from: [], difficulty: 3,
    title: T('Ойлаған санды табу', 'Задуманное число'),
    gen(r) {
      const e = thinkNumber(r);
      const { choices, answer } = packNum(r, e.x, e.traps);
      return { kz: e.kz, ru: e.ru, choices, answer, sol: e.sol };
    },
  },
  {
    id: 'eq.two_step_story',
    examType: 'word', skills: ['eq.two_step'], from: [], difficulty: 3,
    title: T('Екі қадамды теңдеуге келетін есеп', 'Задача на уравнение в два шага'),
    gen(r) {
      const e = storyTwo(r);
      const { choices, answer } = packNum(r, e.x, e.traps);
      return { kz: e.kz, ru: e.ru, choices, answer, sol: e.sol };
    },
  },
  {
    id: 'eq.two_step_minus',
    examType: 'equations', skills: ['eq.two_step'], from: [], difficulty: 3,
    title: T('Екі қадамды теңдеу: a − k · x = c', 'Уравнение в два шага: a − k · x = c'),
    gen(r) { return eqItem(r, twoStepEq(r, 'minus_mul')); },
  },
];
