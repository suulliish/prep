// Вторые генераторы для 5 аварийных тем (C5, docs/systems/specs/content.md: «logic9.mjs: вторые для 5 аварийных тем»):
// logic.new_operation, logic.clock_angle, logic.deduction, div.last_digit, pat.bracket.
// Правила как у остальных файлов: gen(r) -> { kz, ru, choices (5), answer, sol }, подсказки лежат в content/hint_keys.mjs,
// метки ошибок этого файла — в MISCONCEPTIONS9 (kz/ru), они входят в общий список content/misconceptions.mjs.
// Казахский — черновик, нужна проверка носителем. Функции с export (newOp*, clock*, lastDigit*, bracket*, deduction*) нужны урокам
// content/lessons_week9.mjs: их мини-игры берут задачи отсюда, а тесты пересчитывают ответы независимо.
import { num, choices5, genKz } from './lib.mjs';

const T = (kz, ru) => ({ kz, ru });
const sup = k => String(k).split('').map(c => '⁰¹²³⁴⁵⁶⁷⁸⁹'[+c]).join('');

export const MISCONCEPTIONS9 = {
  regrouped: T('Жақшаны орнында қалдыр: (a ※ b) ※ c мен a ※ (b ※ c) әртүрлі нәтиже береді. Жақша ішін бірінші есепте.', 'Скобки стоят там, где стоят: (a ※ b) ※ c и a ※ (b ※ c) — разные значения. Сначала считай то, что в скобках.'),
  stopped_early: T('Бұл жақшаның ішінің мәні ғана. Алынған санмен амалды тағы бір рет орында.', 'Это значение только внутренней скобки. С полученным числом нужно выполнить операцию ещё раз.'),
  skipped_step: T('Кері амалды толық орында: теңдіктегі әр амалдың кері амалын бір-бірлеп қолдан.', 'Обратные действия нужно выполнить все: отмени каждое действие по одному.'),
  answered_result: T('Бұл амалдың нәтижесі, ал белгісіз санды табу керек.', 'Это результат операции, а нужно найти неизвестное число.'),
  wrong_rate: T('Тілдердің жылдамдығын шатастырма: минуттық тіл минутына 6°, сағаттық тіл минутына 0,5° (сағатына 30°).', 'Не путай скорости стрелок: минутная — 6° в минуту, часовая — 0,5° в минуту (30° в час).'),
  guessed_one: T('Шарттар бірнеше нұсқаны қалдырса, бір нұсқаны болжауға болмайды. Кестеде бірнеше ұяшық қалса, жауап анықталмайды.', 'Если условия оставляют несколько вариантов, угадывать один нельзя: в таблице осталось несколько клеток — ответ не определяется.'),
  nobody: T('Әр жануардың иесі бар: үшеуі де (төртеуі де) бөлініп беріледі, сондықтан «ешкімде жоқ» болмайды.', 'У каждого питомца есть хозяин: все они розданы, поэтому «ни у кого» быть не может.'),
  square_as_double: T('Квадрат дегеніміз санды өзіне көбейту: 8² = 8 · 8 = 64, ал 8 · 2 емес.', 'Квадрат — число на само себя: 8² = 8 · 8 = 64, а не 8 · 2.'),
  wrong_deduction: T('Бір ғана шарттан бұл қорытынды шықпайды. Кестеге шарттарды ✘ деп түсір де, қай ұяшықта ✔ қалғанын қара.', 'Из условий такой вывод не следует. Отметь условия в таблице крестиками и посмотри, в какой клетке остаётся галочка.'),
  reflex: T('Екі тілдің арасындағы бұрыш 180°-тан үлкен болмайды: үлкен шықса, 360°-тан азайт.', 'Угол между стрелками не больше 180°: если получился больший, вычти его из 360°.'),
};

// ---------- общий вспомогательный код ----------
const perms = n => (n <= 1 ? [[0]] : perms(n - 1).flatMap(p => Array.from({ length: n }, (_, i) => [...p.slice(0, i), n - 1, ...p.slice(i)])));
const PERMS3 = perms(3), PERMS4 = perms(4);
const uniq = a => [...new Set(a)];

// =========================================================================================================
// logic.new_operation: жаңа амал
// =========================================================================================================
/** Формулы «a ※ b = …» (p, q — коэффициенты). ok(a, b): результат — натуральное число (в 5 классе отрицательных нет). */
export function newOpKinds(p, q) {
  return [
    { id: 'lin', txt: `${p} · a + ${q} · b`, f: (a, b) => p * a + q * b, sub: (a, b) => `${p} · ${a} + ${q} · ${b}`, ok: () => true },
    { id: 'prod_minus', txt: `a · b − ${p} · a`, f: (a, b) => a * b - p * a, sub: (a, b) => `${a} · ${b} − ${p} · ${a}`, ok: (a, b) => a * b > p * a },
    { id: 'mul_minus_b', txt: `${p} · a − b`, f: (a, b) => p * a - b, sub: (a, b) => `${p} · ${a} − ${b}`, ok: (a, b) => p * a > b },
    { id: 'sum_times', txt: `(a + b) · ${p} − b`, f: (a, b) => (a + b) * p - b, sub: (a, b) => `(${a} + ${b}) · ${p} − ${b}`, ok: () => true },
    { id: 'sq_minus', txt: `a · a − ${q} · b`, f: (a, b) => a * a - q * b, sub: (a, b) => `${a} · ${a} − ${q} · ${b}`, ok: (a, b) => a * a > q * b },
    { id: 'prod_plus', txt: 'a · b + a + b', f: (a, b) => a * b + a + b, sub: (a, b) => `${a} · ${b} + ${a} + ${b}`, ok: () => true },
  ];
}

/** Вложенная запись: (x ※ y) ※ z или x ※ (y ※ z). */
export function newOpNested(r) {
  for (let t = 0; t < 400; t++) {
    const p = r.int(2, 5), q = r.int(2, 5), K = r.pick(newOpKinds(p, q));
    const x = r.int(1, 9), y = r.int(1, 9), z = r.int(1, 9), left = r.chance(0.5);
    const inner = left ? K.f(x, y) : K.f(y, z);
    if (left ? !K.ok(x, y) || !K.ok(inner, z) : !K.ok(y, z) || !K.ok(x, inner)) continue;
    const ans = left ? K.f(inner, z) : K.f(x, inner);
    const other = left ? K.f(x, K.f(y, z)) : K.f(K.f(x, y), z);       // скобки в другом месте
    const swapped = left ? K.f(z, inner) : K.f(inner, x);              // внешняя операция с переставленными числами
    if (ans > 400 || ans < 1 || other < 1 || swapped < 1 || new Set([ans, other, swapped, inner]).size < 4) continue;
    return { K, p, q, x, y, z, left, inner, ans, other, swapped };
  }
  throw new Error('newOpNested');
}

export const NEWOP = [
  {
    id: 'logic.new_operation_nested',
    examType: 'logic', skills: ['logic.new_operation'], from: [], difficulty: 2,
    title: T('Жаңа амал: жақшалы өрнек', 'Новая операция: выражение со скобками'),
    gen(r) {
      const { K, x, y, z, left, inner, ans, other, swapped } = newOpNested(r);
      const expr = left ? `(${x} ※ ${y}) ※ ${z}` : `${x} ※ (${y} ※ ${z})`;
      const { choices, answer } = choices5(r, num(ans), [
        { v: num(other), tag: 'regrouped' }, { v: num(swapped), tag: 'swapped_args' }, { v: num(inner), tag: 'stopped_early' }, { v: num(ans + 1), tag: 'arith' },
      ], () => num(ans + r.int(-9, 9)));
      const i1 = left ? [x, y] : [y, z], outer = left ? [inner, z] : [x, inner];
      return {
        kz: `Жаңа амал «※» былай анықталған: a ※ b = ${K.txt}. ${expr} өрнегінің мәнін табыңыз.`,
        ru: `Новая операция «※» задана так: a ※ b = ${K.txt}. Найдите значение выражения ${expr}.`,
        choices, answer,
        sol: {
          kz: `Алдымен жақшаның ішін есептейміз: ${i1[0]} ※ ${i1[1]} = ${K.sub(...i1)} = ${inner}. Сосын ${outer[0]} ※ ${outer[1]} = ${K.sub(...outer)} = ${ans}.`,
          ru: `Сначала считаем то, что в скобках: ${i1[0]} ※ ${i1[1]} = ${K.sub(...i1)} = ${inner}. Затем ${outer[0]} ※ ${outer[1]} = ${K.sub(...outer)} = ${ans}.`,
        },
      };
    },
  },
  {
    id: 'logic.new_operation_unknown',
    examType: 'logic', skills: ['logic.new_operation'], from: [], difficulty: 3,
    title: T('Жаңа амал: белгісіз сан', 'Новая операция: неизвестное число'),
    gen(r) {
      for (;;) {
        const p = r.int(2, 5), q = r.int(2, 5), k = r.int(2, 9), x = r.int(2, 14);
        const kinds = [
          { txt: `${p} · a + b`, V: p * x + k, shown: V => `x ※ ${k} = ${V}`,
            wrong: V => [[V - k, 'skipped_step'], [(V + k) / p, 'wrong_operation'], [V / p - k, 'wrong_operation'], [V, 'answered_result']],
            put: V => `${p} · x + ${k} = ${V}`, back: V => `${p} · x = ${V} − ${k} = ${V - k}, x = ${V - k} : ${p} = ${x}` },
          { txt: `${p} · a − b`, V: p * x - k, shown: V => `x ※ ${k} = ${V}`,
            wrong: V => [[V + k, 'skipped_step'], [(V - k) / p, 'wrong_operation'], [V / p + k, 'wrong_operation'], [V, 'answered_result']],
            put: V => `${p} · x − ${k} = ${V}`, back: V => `${p} · x = ${V} + ${k} = ${V + k}, x = ${V + k} : ${p} = ${x}` },
          { txt: `a · b + ${p}`, V: x * k + p, shown: V => `x ※ ${k} = ${V}`,
            wrong: V => [[V - p, 'skipped_step'], [(V + p) / k, 'wrong_operation'], [V / k - p, 'wrong_operation'], [V, 'answered_result']],
            put: V => `x · ${k} + ${p} = ${V}`, back: V => `x · ${k} = ${V} − ${p} = ${V - p}, x = ${V - p} : ${k} = ${x}` },
          { txt: `${p} · a + ${q} · b`, V: p * k + q * x, shown: V => `${k} ※ x = ${V}`,
            wrong: V => [[V - p * k, 'skipped_step'], [(V + p * k) / q, 'wrong_operation'], [(V - k) / q, 'wrong_operation'], [V, 'answered_result']],
            put: V => `${p} · ${k} + ${q} · x = ${V}`, back: V => `${q} · x = ${V} − ${p * k} = ${V - p * k}, x = ${V - p * k} : ${q} = ${x}` },
        ];
        const K = r.pick(kinds), V = K.V;
        if (V < 1) continue;
        const bad = K.wrong(V).filter(([v]) => Number.isInteger(v) && v > 0 && v !== x).map(([v, tag]) => ({ v: num(v), tag }));
        const { choices, answer } = choices5(r, num(x), bad, () => num(x + r.int(-6, 6)));
        return {
          kz: `Жаңа амал «※» былай анықталған: a ※ b = ${K.txt}. ${K.shown(V)} теңдігінде x-ті табыңыз.`,
          ru: `Новая операция «※» задана так: a ※ b = ${K.txt}. Найдите x в равенстве ${K.shown(V)}.`,
          choices, answer,
          sol: {
            kz: `Формулаға белгілі санды қоямыз: ${K.put(V)}. Сосын белгісізге кері амалдарды бір-бірлеп қолданамыз: ${K.back(V)}.`,
            ru: `Подставляем известное число в формулу: ${K.put(V)}. Затем по одному отменяем действия с неизвестным: ${K.back(V)}.`,
          },
        };
      }
    },
  },
];

// =========================================================================================================
// logic.clock_angle: сағат тілдері
// =========================================================================================================
const hhmm = (h, m) => `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
/** Угол между стрелками в h:m (меньший из двух, в градусах). */
export function clockAngle(h, m) { const a = Math.abs(30 * (h % 12) + m / 2 - 6 * m); return a > 180 ? 360 - a : a; }

export const CLOCK = [
  {
    id: 'logic.clock_angle_hands',
    examType: 'logic', skills: ['logic.clock_angle'], from: [], difficulty: 1,
    title: T('Сағат тілі: бұрылу бұрышы', 'Стрелки часов: на сколько градусов поворот'),
    gen(r) {
      const kind = r.pick(['whole', 'whole', 'minute', 'hour_min', 'hour_h']);
      if (kind === 'whole') {
        const h = r.pick([1, 2, 3, 4, 5, 7, 8, 9, 10, 11, 13, 14, 15, 16, 17, 19, 20, 21, 22, 23]), hh = h % 12, a = clockAngle(h, 0);
        const { choices, answer } = choices5(r, num(a) + '°', [
          { v: num(360 - a) + '°', tag: 'reflex' }, { v: num(6 * hh) + '°', tag: 'wrong_rate' }, { v: num(12 * hh) + '°', tag: 'wrong_rate' }, { v: num(a + 30) + '°', tag: 'arith' },
        ], () => num(r.int(1, 17) * 10) + '°');
        return {
          kz: `Сағат ${hhmm(h, 0)} болғанда сағаттық тіл мен минуттық тілдің арасындағы бұрыштың градустық өлшемін табыңыз (кіші бұрыш).`,
          ru: `Найдите угол (в градусах, меньший) между часовой и минутной стрелками, когда часы показывают ${hhmm(h, 0)}.`,
          choices, answer,
          sol: {
            kz: `Дәл ${hh} сағатта минуттық тіл 12-де тұр (0°), сағаттық тіл ${hh} санында: 30 · ${hh} = ${30 * hh}°. ${30 * hh > 180 ? `Бұл 180°-тан үлкен, сондықтан кіші бұрыш: 360° − ${30 * hh}° = ${a}°.` : `Кіші бұрыш: ${a}°.`}`,
            ru: `Ровно в ${hh} часов минутная стрелка на 12 (0°), часовая на ${hh}: 30 · ${hh} = ${30 * hh}°. ${30 * hh > 180 ? `Это больше 180°, поэтому меньший угол: 360° − ${30 * hh}° = ${a}°.` : `Меньший угол: ${a}°.`}`,
          },
        };
      }
      if (kind === 'minute') {
        const n = r.pick([5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55]), a = 6 * n;
        const { choices, answer } = choices5(r, num(a) + '°', [
          { v: num(n / 2) + '°', tag: 'wrong_rate' }, { v: num(n) + '°', tag: 'wrong_rate' }, { v: num(12 * n) + '°', tag: 'wrong_rate' }, { v: num(a + 6) + '°', tag: 'arith' },
        ], () => num(r.int(1, 30) * 10) + '°');
        return {
          kz: `Минуттық тіл ${n} минут ішінде неше градусқа бұрылады?`,
          ru: `На сколько градусов поворачивается минутная стрелка за ${n} минут?`,
          choices, answer,
          sol: { kz: `Минуттық тіл 60 минутта 360° бұрылады, яғни минутына 6°. ${n} минутта: 6 · ${n} = ${a}°.`, ru: `Минутная стрелка за 60 минут делает 360°, то есть 6° в минуту. За ${n} мин: 6 · ${n} = ${a}°.` },
        };
      }
      if (kind === 'hour_min') {
        const n = 2 * r.int(5, 30), a = n / 2;
        const { choices, answer } = choices5(r, num(a) + '°', [
          { v: num(6 * n) + '°', tag: 'wrong_rate' }, { v: num(n) + '°', tag: 'wrong_rate' }, { v: num(30) + '°', tag: 'wrong_rate' }, { v: num(a + 5) + '°', tag: 'arith' },
        ], () => num(r.int(1, 36) * 5) + '°');
        return {
          kz: `Сағаттық тіл ${n} минут ішінде неше градусқа бұрылады?`,
          ru: `На сколько градусов поворачивается часовая стрелка за ${n} минут?`,
          choices, answer,
          sol: { kz: `Сағаттық тіл 1 сағатта (60 минутта) 30° бұрылады, яғни минутына 0,5°. ${n} минутта: 0,5 · ${n} = ${num(a)}°.`, ru: `Часовая стрелка за 1 час (60 минут) поворачивается на 30°, то есть на 0,5° в минуту. За ${n} мин: 0,5 · ${n} = ${num(a)}°.` },
        };
      }
      const n = r.pick([2, 3, 4, 5, 6, 7, 8, 9, 10, 11]), a = 30 * n;
      const { choices, answer } = choices5(r, num(a) + '°', [
        { v: num(6 * n) + '°', tag: 'wrong_rate' }, { v: num(n * 60) + '°', tag: 'wrong_rate' }, { v: num(n * 12) + '°', tag: 'wrong_rate' }, { v: num(a + 30) + '°', tag: 'arith' },
      ], () => num(r.int(1, 36) * 10) + '°');
      return {
        kz: `Сағаттық тіл ${n} сағат ішінде неше градусқа бұрылады?`,
        ru: `На сколько градусов поворачивается часовая стрелка за ${n} часов?`,
        choices, answer,
        sol: { kz: `Сағаттық тіл 12 сағатта 360° бұрылады, яғни сағатына 30°. ${n} сағатта: 30 · ${n} = ${a}°.`, ru: `Часовая стрелка за 12 часов делает 360°, то есть 30° в час. За ${n} ч: 30 · ${n} = ${a}°.` },
      };
    },
  },
];

// =========================================================================================================
// div.last_digit: дәреженің соңғы цифры
// =========================================================================================================
/** Период последних цифр степеней основания b: [b, b², b³ …] mod 10 до первого повтора. */
export function lastDigitCycle(b) { const c = []; let x = b % 10; while (!c.includes(x)) { c.push(x); x = (x * b) % 10; } return c; }
/** Последняя цифра b^e. */
export function lastDigitPow(b, e) { const c = lastDigitCycle(b); return c[(e - 1) % c.length]; }

export const LASTDIGIT = [
  {
    id: 'div.last_digit_sum',
    examType: 'divisibility', skills: ['div.last_digit'], from: [], difficulty: 3,
    title: T('Екі дәреженің қосындысы/көбейтіндісінің соңғы цифры', 'Последняя цифра суммы/произведения двух степеней'),
    gen(r) {
      for (;;) {
        const bases = [2, 3, 4, 7, 8, 9, 12, 13, 14, 17, 18, 19], a = r.pick(bases), b = r.pick(bases);
        const m = r.int(10, 45), n = r.int(10, 45), prod = r.chance(0.4);
        if (a % 10 === b % 10) continue;
        const ca = lastDigitCycle(a), cb = lastDigitCycle(b);
        const da = ca[(m - 1) % ca.length], db = cb[(n - 1) % cb.length], op = (x, y) => (prod ? x * y : x + y) % 10, ans = op(da, db);
        const offA = op(ca[m % ca.length], db), offB = op(da, cb[n % cb.length]);               // позиция в периоде сдвинута на 1
        const asProduct = op((a * m) % 10, (b * n) % 10);                 // степень принята за произведение
        const otherOp = prod ? (da + db) % 10 : (da * db) % 10;
        if (new Set([ans, offA, offB, otherOp]).size < 4) continue;
        const { choices, answer } = choices5(r, num(ans), [
          { v: num(offA), tag: 'wrong_position' }, { v: num(offB), tag: 'wrong_position' }, { v: num(asProduct), tag: 'power_as_product' }, { v: num(otherOp), tag: 'wrong_operation' },
        ], () => num(r.int(0, 9)));
        const word = prod ? 'көбейтіндісінің' : 'қосындысының', wordRu = prod ? 'произведения' : 'суммы';
        return {
          kz: `${a}${sup(m)} ${prod ? '·' : '+'} ${b}${sup(n)} ${word} соңғы цифрын табыңыз.`,
          ru: `Найдите последнюю цифру ${wordRu} ${a}${sup(m)} ${prod ? '·' : '+'} ${b}${sup(n)}.`,
          choices, answer,
          sol: {
            kz: `Әр дәреженің соңғы цифрын период бойынша табамыз (қалдық 0 болса, периодтың соңғы цифры алынады). ${a}-дің периоды: ${ca.join(', ')}; ${m} : ${ca.length} қалдығы ${m % ca.length}, соңғы цифр ${da}. ${b}-дің периоды: ${cb.join(', ')}; ${n} : ${cb.length} қалдығы ${n % cb.length}, соңғы цифр ${db}. Сосын ${da} ${prod ? '·' : '+'} ${db} = ${prod ? da * db : da + db}, соңғы цифр ${ans}.`,
            ru: `Последнюю цифру каждой степени находим по периоду (при остатке 0 берём последнюю цифру периода). Период ${a}: ${ca.join(', ')}; ${m} : ${ca.length} даёт остаток ${m % ca.length}, цифра ${da}. Период ${b}: ${cb.join(', ')}; ${n} : ${cb.length} даёт остаток ${n % cb.length}, цифра ${db}. Затем ${da} ${prod ? '·' : '+'} ${db} = ${prod ? da * db : da + db}, последняя цифра ${ans}.`,
          },
        };
      }
    },
  },
];

// =========================================================================================================
// pat.bracket: жақшадағы сан заңдылығы
// =========================================================================================================
// «a (m) b»: m — жақшадағы сан. Ереже — a, m, b арасындағы байланыс. Кітапхана барлық ережені тексереді: екі толық жолға бірнеше ереже
// сай келуі мүмкін, сондықтан генератор жолдарды үшінші жолдың жауабы кітапхананың БАРЛЫҚ сай ережелерінде бірдей болғанда ғана алады.
const F = (id, kz, ru, f, t, ok) => ({ id, kz, ru, f, t, ok, test: (a, m, b) => (!ok || ok(a, b)) && f(a, b) === m, show: (a, m, b) => `${t(a, b)} = ${m}`, make: null });
const REL = (id, kz, ru, test, make, show) => ({ id, kz, ru, test, make, show });
export const BRACKET_LIB = [
  F('sum', 'шеткі сандардың қосындысы', 'сумма крайних чисел', (a, b) => a + b, (a, b) => `${a} + ${b}`),
  F('prod', 'шеткі сандардың көбейтіндісі', 'произведение крайних чисел', (a, b) => a * b, (a, b) => `${a} · ${b}`),
  F('diff', 'сол жақ сан минус оң жақ сан', 'левое число минус правое', (a, b) => a - b, (a, b) => `${a} − ${b}`, (a, b) => a > b),
  F('dsum', 'шеткі сандардың қосындысының екі еселенгені', 'удвоенная сумма крайних чисел', (a, b) => 2 * (a + b), (a, b) => `2 · (${a} + ${b})`),
  F('prodA', 'шеткі сандардың көбейтіндісі плюс сол жақ сан', 'произведение крайних чисел плюс левое число', (a, b) => a * b + a, (a, b) => `${a} · ${b} + ${a}`),
  F('prodB', 'шеткі сандардың көбейтіндісі плюс оң жақ сан', 'произведение крайних чисел плюс правое число', (a, b) => a * b + b, (a, b) => `${a} · ${b} + ${b}`),
  F('sumA', 'сол жақ санның екі еселенгені плюс оң жақ сан', 'удвоенное левое число плюс правое', (a, b) => 2 * a + b, (a, b) => `2 · ${a} + ${b}`),
  F('sumB', 'сол жақ сан плюс оң жақ санның екі еселенгені', 'левое число плюс удвоенное правое', (a, b) => a + 2 * b, (a, b) => `${a} + 2 · ${b}`),
  F('sqA', 'сол жақ санның квадраты плюс оң жақ сан', 'квадрат левого числа плюс правое', (a, b) => a * a + b, (a, b) => `${a} · ${a} + ${b}`),
  F('sqAm', 'сол жақ санның квадраты минус оң жақ сан', 'квадрат левого числа минус правое', (a, b) => a * a - b, (a, b) => `${a} · ${a} − ${b}`, (a, b) => a * a > b),
  F('sqB', 'оң жақ санның квадраты плюс сол жақ сан', 'квадрат правого числа плюс левое', (a, b) => b * b + a, (a, b) => `${b} · ${b} + ${a}`),
  F('sqsum', 'шеткі сандардың квадраттарының қосындысы', 'сумма квадратов крайних чисел', (a, b) => a * a + b * b, (a, b) => `${a} · ${a} + ${b} · ${b}`),
  F('sqdiff', 'шеткі сандардың квадраттарының айырмасы', 'разность квадратов крайних чисел', (a, b) => a * a - b * b, (a, b) => `${a} · ${a} − ${b} · ${b}`, (a, b) => a > b),
  F('sumsq', 'шеткі сандардың қосындысының квадраты', 'квадрат суммы крайних чисел', (a, b) => (a + b) * (a + b), (a, b) => `(${a} + ${b}) · (${a} + ${b})`),
  // нақты емтихандағы түр: шеткі сандар арасындағы байланыс жақшадағы санмен («12 (5) 13»: 12 + 13 = 5 · 5)
  REL('sum_sq', 'шеткі сандардың қосындысы жақшадағы санның квадратына тең', 'сумма крайних чисел равна квадрату числа в скобках',
    (a, m, b) => a + b === m * m, r => { const m = r.int(3, 12), a = r.int(1, m * m - 1); return [a, m, m * m - a]; }, (a, m, b) => `${a} + ${b} = ${m} · ${m}`),
  REL('diff_sq', 'сол жақ пен оң жақ сандардың айырмасы жақшадағы санның квадратына тең', 'разность левого и правого чисел равна квадрату числа в скобках',
    (a, m, b) => a - b === m * m, r => { const m = r.int(2, 9), b = r.int(1, 25); return [b + m * m, m, b]; }, (a, m, b) => `${a} − ${b} = ${m} · ${m}`),
  REL('sum_3m', 'шеткі сандардың қосындысы жақшадағы саннан 3 есе көп', 'сумма крайних чисел в 3 раза больше числа в скобках',
    (a, m, b) => a + b === 3 * m, r => { const m = r.int(4, 15), a = r.int(1, 3 * m - 1); return [a, m, 3 * m - a]; }, (a, m, b) => `${a} + ${b} = 3 · ${m}`),
  REL('prod_m', 'сол жақ сан жақшадағы сан мен оң жақ санның көбейтіндісіне тең', 'левое число — произведение числа в скобках и правого числа',
    (a, m, b) => a === m * b, r => { const m = r.int(3, 12), b = r.int(2, 6); return [m * b, m, b]; }, (a, m, b) => `${a} = ${m} · ${b}`),
];
const byIdBr = Object.fromEntries(BRACKET_LIB.map(x => [x.id, x]));
export const BRACKET_SIMPLE = ['sum', 'prod', 'diff', 'dsum', 'prodA', 'prodB', 'sumA', 'sumB'];
export const BRACKET_SQUARES = ['sqA', 'sqAm', 'sqB', 'sqsum', 'sqdiff', 'sumsq', 'diff_sq'];
export const BRACKET_EXAM = ['sum_sq', 'diff_sq', 'sum_3m', 'prod_m'];
const RNG = n => Array.from({ length: n }, (_, i) => i + 1);
/** Белгісіз сан (m немесе b) бойынша ереженің шешімдері. */
const solveBr = (R, ask, a3, m3, b3) => (ask === 'middle' ? RNG(600).filter(m => R.test(a3, m, b3)) : RNG(300).filter(b => R.test(a3, m3, b)));

/** Үш жол «a (m) b»; ask: 'middle' (жақшадағы сан белгісіз) | 'outer' (оң жақ сан белгісіз). Жауап кітапхананың барлық сай ережелерінде бірдей. */
export function bracketPuzzle(r, pool, ask) {
  for (let t = 0; t < 4000; t++) {
    const rid = r.pick(pool), R = byIdBr[rid], rows = [];
    for (let i = 0; i < 3; i++) {
      if (R.make) { rows.push(R.make(r)); continue; }
      const a = r.int(2, 14), b = r.int(1, 12);
      if (R.ok && !R.ok(a, b)) { i--; continue; }
      rows.push([a, R.f(a, b), b]);
    }
    if (rows.some(x => x[1] > 400 || x.some(v => v < 1)) || new Set(rows.map(x => x.join())).size < 3) continue;
    if (rows.some(x => x[0] === x[2])) continue;   // a = b в строке: правило «2a» и «2b» неотличимы от «a + b»
    const [a3, m3, b3] = rows[2], ans = ask === 'middle' ? m3 : b3;
    const fit = BRACKET_LIB.filter(X => X.test(...rows[0]) && X.test(...rows[1]));
    const sols = uniq(fit.flatMap(X => solveBr(X, ask, a3, m3, b3)));
    if (sols.length !== 1 || sols[0] !== ans) continue;
    if (hasRival(rows, ask, a3, m3, b3)) continue;
    // ложные ережелер: дұрыс ереже емес, бірінші жолға сай емес/сай, бірақ екіншіге сай емес; олардың үшінші жолдағы жауабы
    const wrongRule = uniq(BRACKET_LIB.filter(X => X.id !== R.id && !fit.includes(X)).flatMap(X => { const s = solveBr(X, ask, a3, m3, b3); return s.length === 1 ? s : []; })).filter(v => v !== ans);
    const firstOnly = BRACKET_LIB.filter(X => X.id !== R.id && X.test(...rows[0]) && !X.test(...rows[1]));
    return { R, rows, ans, ask, wrongRule, firstOnlyN: firstOnly.length, a3, m3, b3 };
  }
  throw new Error('bracketPuzzle');
}
/** Простые «соперничающие» правила m = s·a·b + t·a² + w·b² + p·a + q·b + c, подходящие под обе показанные строки, но дающие в третьей другой ответ.
 *  Библиотека правил выше их не знает, поэтому проверяем отдельно: задача, где ребёнок может найти второе правило и получить другой ответ, не годится. */
function hasRival(rows, ask, a3, m3, b3) {
  const ans = ask === 'middle' ? m3 : b3, [r1, r2] = rows;
  for (let s = -1; s <= 1; s++) for (let t = -1; t <= 1; t++) for (let w = -1; w <= 1; w++)
    for (let p = -2; p <= 3; p++) for (let q = -2; q <= 3; q++) for (let c = -3; c <= 3; c++) {
      const f = (a, b) => s * a * b + t * a * a + w * b * b + p * a + q * b + c;
      if (f(r1[0], r1[2]) !== r1[1] || f(r2[0], r2[2]) !== r2[1]) continue;
      if (ask === 'middle') { if (f(a3, b3) !== ans) return true; }
      else for (let b = 1; b <= 300; b++) if (b !== ans && f(a3, b) === m3) return true;
    }
  return false;
}
const showRows = (rows, ask) => rows.map((x, i) => (i < 2 ? `${x[0]} (${x[1]}) ${x[2]}` : ask === 'middle' ? `${x[0]} (?) ${x[2]}` : `${x[0]} (${x[1]}) ?`)).join('\n');

const bracketGen = (id, pool, difficulty, title) => ({
  id, examType: 'patterns', skills: ['pat.bracket'], from: [], difficulty, title,
  gen(r) {
    const ask = r.chance(0.5) ? 'middle' : 'outer';
    const P = bracketPuzzle(r, pool, ask), { R, rows, ans, a3, m3, b3 } = P;
    const bad = [
      ...r.shuffle(P.wrongRule).slice(0, 3).map(v => ({ v: num(v), tag: 'wrong_rule' })),
      { v: num(ask === 'middle' ? a3 : m3), tag: 'copied' }, { v: num(ans + 1), tag: 'arith' },
    ];
    // квадрат принят за «санды екіге көбейту»: 6² = 6 · 2 (емтихан түрі «қосынды = жақшадағы санның квадраты»)
    if (ask === 'outer' && (R.id === 'sum_sq' || R.id === 'diff_sq')) {
      const v = R.id === 'sum_sq' ? 2 * m3 - a3 : a3 - 2 * m3;
      if (v > 0 && v !== ans) bad.unshift({ v: num(v), tag: 'square_as_double' });
    }
    const { choices, answer } = choices5(r, num(ans), bad, () => num(Math.max(1, ans + r.int(-8, 8))));
    const evalText = ask === 'middle' ? R.show(a3, ans, b3) : R.show(a3, m3, ans);
    return {
      kz: `Заңдылықты анықтап, сұрақ белгісінің орнына сәйкес санды табыңыз:\n${showRows(rows, ask)}`,
      ru: `Определите закономерность и найдите число вместо знака вопроса:\n${showRows(rows, ask)}`,
      choices, answer,
      sol: {
        kz: `Ережені екі толық жолдан іздеп, екеуіне де тексереміз: ${R.kz}. Үшінші жолда: ${evalText}, сондықтан ${ask === 'middle' ? 'жақшадағы сан' : 'оң жақ сан'} ${ans}.`,
        ru: `Ищем правило по двум полным строкам и проверяем на обеих: ${R.ru}. В третьей строке: ${evalText}, поэтому ${ask === 'middle' ? 'число в скобках' : 'правое число'} ${ans}.`,
      },
    };
  },
});

export const BRACKET = [
  bracketGen('logic.bracket_middle', BRACKET_SIMPLE, 2, T('Жақшадағы сан: ереже екі жолда', 'Число в скобках: правило по двум строкам')),
  bracketGen('logic.bracket_square', BRACKET_SQUARES, 3, T('Жақшадағы сан: квадратты ереже', 'Число в скобках: правило с квадратами')),
];

// =========================================================================================================
// logic.deduction: кесте әдісі (кім қайда)
// =========================================================================================================
export const KIDS = ['Айжан', 'Арман', 'Дана', 'Нұрлан', 'Мадина', 'Ерлан', 'Бекзат', 'Санжар'];
export const PETS = [
  { kz: 'мысық', has: 'мысығы', da: 'да', ru: 'кошка', acc: 'кошку' },
  { kz: 'ит', has: 'иті', da: 'де', ru: 'собака', acc: 'собаку' },
  { kz: 'тотықұс', has: 'тотықұсы', da: 'да', ru: 'попугай', acc: 'попугая' },
  { kz: 'балық', has: 'балығы', da: 'да', ru: 'рыбка', acc: 'рыбку' },
];
const cap = w => w[0].toUpperCase() + w.slice(1);
const listKz = a => (a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' және ' + a.at(-1));
const listRu = a => (a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' и ' + a.at(-1));

/** Шарттар (ақиқат шарттар, hidden[i] — i-ші баланың жануары). p[i] — жануар индексі. */
export function deductionClues(names, pets, hidden) {
  const out = [];
  names.forEach((n, i) => {
    pets.forEach((P, j) => {
      if (hidden[i] === j) out.push({ kind: 'pos', i, j, kz: `${genKz(n)} ${P.has} бар`, ru: `${n} держит ${P.acc}`, ok: p => p[i] === j });
      else {
        out.push({ kind: 'neg', i, j, kz: `${genKz(n)} ${P.has} жоқ`, ru: `${n} не держит ${P.acc}`, ok: p => p[i] !== j });
        pets.forEach((Q, k) => { if (k > j && hidden[i] !== k) out.push({ kind: 'neg2', i, j, k, kz: `${genKz(n)} ${P.has} ${P.da}, ${Q.has} ${Q.da} жоқ`, ru: `${n} не держит ни ${P.acc}, ни ${Q.acc}`, ok: p => p[i] !== j && p[i] !== k }); });
      }
    });
  });
  return out;
}

/** n = 3 | 4. mode: 'unique' (жауап анық) | 'open' (анықталмайды) | 'any'. Қайтарады: { names, pets, clues, target, owners:[ықтимал иелер], ... } */
export function deductionPuzzle(r, n, mode = 'unique') {
  const all = n === 3 ? PERMS3 : PERMS4;
  for (let t = 0; t < 4000; t++) {
    const names = r.shuffle(KIDS).slice(0, n), petIdx = r.shuffle([0, 1, 2, 3]).slice(0, n), pets = petIdx.map(i => PETS[i]);
    const hidden = r.shuffle(Array.from({ length: n }, (_, i) => i));      // hidden[i] — i-ші баланың жануары (pets ішіндегі индекс)
    const pool = deductionClues(names, pets, hidden), target = r.int(0, n - 1);   // target — жануар индексі
    const clueN = n === 3 ? 3 : r.pick([3, 4]);
    const clues = r.shuffle(pool).slice(0, clueN);
    if (clues.some(c => c.kind === 'pos' && c.j === target)) continue;          // иесі тікелей айтылмайды
    const sols = all.filter(p => clues.every(c => c.ok(p)));
    if (clues.some(c => all.filter(p => clues.every(d => d === c || d.ok(p))).length === sols.length)) continue;   // артық шарт болмасын: әрбірі нұсқаны азайтады
    const owners = uniq(sols.map(p => p.findIndex(j => j === target)));
    if (mode === 'unique' && sols.length === 1 && owners.length === 1) return { names, pets, clues, target, owners, sols, hidden };
    if (mode === 'determined' && owners.length === 1) return { names, pets, clues, target, owners, sols, hidden };
    if (mode === 'open' && owners.length >= 2) return { names, pets, clues, target, owners, sols, hidden };
  }
  throw new Error('deductionPuzzle');
}

const deductionText = (D, n) => {
  const nm = D.names, pt = D.pets.map(x => x.kz), ptRu = D.pets.map(x => x.ru);
  const word = n === 3 ? 'Үш' : 'Төрт', wordRu = n === 3 ? 'Три' : 'Четыре';
  return {
    kz: `${word} бала бір-бірден үй жануарын асырайды: ${listKz(pt)} (бәрі әртүрлі). Балалар: ${listKz(nm)}. ${D.clues.map(c => c.kz[0].toUpperCase() + c.kz.slice(1)).join('. ')}. Кімде ${D.pets[D.target].kz} бар?`,
    ru: `${wordRu} ребёнка держат по одному питомцу: ${listRu(ptRu)} (все разные). Дети: ${listRu(nm)}. ${D.clues.map(c => c.ru[0].toUpperCase() + c.ru.slice(1)).join('. ')}. У кого ${D.pets[D.target].ru}?`,
  };
};

export const DEDUCTION = [
  {
    id: 'logic.deduction_table',
    examType: 'logic', skills: ['logic.deduction'], from: [], difficulty: 1,
    title: T('Кім қайда: үш бала, үш жануар', 'Кто где: три ребёнка, три питомца'),
    gen(r) {
      const D = deductionPuzzle(r, 3, 'unique'), who = D.names[D.owners[0]];
      const others = D.names.filter(x => x !== who);
      const { choices, answer } = choices5(r, who, [
        ...others.map(v => ({ v, tag: 'wrong_deduction' })), { v: 'Анықтау мүмкін емес / Определить нельзя', tag: 'gave_up' }, { v: 'Ешкімде жоқ / Ни у кого', tag: 'nobody' },
      ], () => null);
      const sol = D.sols[0], row = D.names.map((x, i) => `${x}: ${D.pets[sol[i]].kz}`).join(', ');
      const tt = deductionText(D, 3);
      return {
        kz: tt.kz, ru: tt.ru, choices, answer,
        sol: {
          kz: `Кесте сызамыз (балалар × жануарлар) да, әр шарт бойынша мүмкін емес ұяшықтарды ✘ деп белгілейміз. Жолда немесе бағанда бір ғана ұяшық қалса, оған ✔ қоямыз да, сол бағанды сызып тастаймыз. Нәтиже: ${row}. Жауабы: ${who}.`,
          ru: `Рисуем таблицу (дети × питомцы) и по каждому условию вычёркиваем невозможные клетки. Если в строке или столбце осталась одна клетка, ставим в неё ✔ и вычёркиваем её столбец. Итог: ${D.names.map((x, i) => `${x} — ${D.pets[sol[i]].ru}`).join(', ')}. Ответ: ${who}.`,
        },
      };
    },
  },
  {
    id: 'logic.deduction_enough',
    examType: 'logic', skills: ['logic.deduction'], from: [], difficulty: 3,
    title: T('Кім қайда: шарттар жеткілікті ме?', 'Кто где: хватает ли условий'),
    gen(r) {
      const open = r.chance(0.45), D = deductionPuzzle(r, 4, open ? 'open' : 'determined');
      const who = open ? null : D.names[D.owners[0]];
      const CANT = 'Анықтау мүмкін емес / Определить нельзя';
      const wrong = D.names.filter(x => x !== who).map(v => ({ v, tag: open ? 'guessed_one' : 'wrong_deduction' }));
      const { choices, answer } = choices5(r, open ? CANT : who, open ? wrong : [...wrong, { v: CANT, tag: 'gave_up' }], () => null);
      const tt = deductionText(D, 4), cands = D.owners.map(i => D.names[i]);
      return {
        kz: tt.kz, ru: tt.ru, choices, answer,
        sol: {
          kz: open
            ? `Кесте сызып, шарттар бойынша ✘ қоямыз. ${cap(D.pets[D.target].kz)} бірнеше балада бола алады (${cands.join(', ')}), кестеде бірнеше ұяшық қалады. Бір нұсқаны болжауға болмайды: жауап анықталмайды.`
            : `Кесте сызып, шарттар бойынша ✘ қоямыз. ${cap(D.pets[D.target].kz)} үшін ${who} ұяшығынан басқасы сызылады, барлық сай келетін орналасуда ол сол бала. Жауабы: ${who}.`,
          ru: open
            ? `Рисуем таблицу и вычёркиваем клетки по условиям. ${D.pets[D.target].ru} может быть у нескольких детей (${cands.join(', ')}): в таблице остаётся несколько клеток. Угадывать один вариант нельзя: ответ не определяется.`
            : `Рисуем таблицу и вычёркиваем клетки по условиям. Для этого питомца остаётся только клетка одного ребёнка: во всех подходящих расстановках он у ${who}. Ответ: ${who}.`,
        },
      };
    },
  },
];

export default [...NEWOP, ...CLOCK, ...LASTDIGIT, ...BRACKET, ...DEDUCTION];
