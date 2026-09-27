// 5 класс, октябрь: натуральные числа, порядок действий, степени, делимость, НОД/НОК.
// hints — лестница подсказок (1 наводящий вопрос, 2 правило, 3 первый шаг); 4-я ступень — sol.
import { num, choices5, near, dat, abl, gcd, lcm } from './lib.mjs';

const fmt = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' '); // 4 030 005
const factor = n => { const f = []; for (let p = 2; p * p <= n; p++) while (n % p === 0) { f.push(p); n /= p; } if (n > 1) f.push(n); return f; };
const isPrime = n => n > 1 && factor(n).length === 1;
const powStr = f => { const c = {}; f.forEach(p => (c[p] = (c[p] || 0) + 1)); return Object.entries(c).map(([p, k]) => (k > 1 ? `${p}${sup(k)}` : p)).join(' · '); };
const sup = k => String(k).split('').map(c => '⁰¹²³⁴⁵⁶⁷⁸⁹'[+c]).join('');

export default [
  {
    id: 'nat.write_number',
    examType: 'compute', skills: ['nat.place_value'], from: [], difficulty: 1,
    title: { kz: 'Санды цифрмен жазу', ru: 'Записать число цифрами' },
    gen(r) {
      const mln = r.int(1, 99), th = r.pick([0, r.int(1, 9), r.int(10, 99), r.int(100, 999)]), un = r.pick([r.int(1, 9), r.int(10, 99), r.int(100, 999)]);
      const n = mln * 1e6 + th * 1e3 + un;
      const words = `${mln} миллион${th ? ` ${th} мың` : ''} ${un}`;
      const pad = (x, k) => String(x).padStart(k, '0');
      const wrong1 = +(`${mln}${th ? th : ''}${un}`);            // забыл нули в разрядах
      const wrong2 = mln * 1e6 + th * 1e4 + un;                    // сдвиг разряда тысяч
      const wrong3 = +(`${mln}${pad(th, 3)}${un}`);                // забыл нули в единицах
      const { choices, answer } = choices5(r, fmt(n), [
        { v: fmt(wrong1), tag: 'missing_zeros' }, { v: fmt(wrong2), tag: 'place_shift' },
        { v: fmt(wrong3), tag: 'missing_zeros' }, { v: fmt(n * 10), tag: 'extra_zero' },
      ], () => fmt(n + r.pick([1, -1]) * r.pick([1000, 10000, 100])));
      return {
        kz: `Санды цифрмен жазыңыз: ${words}.`, ru: `Запишите число цифрами: ${mln} млн ${th ? th + ' тыс. ' : ''}${un}.`,
        choices, answer,
        hints: [
          { kz: 'Миллиондар, мыңдар, бірліктер — әр топта қанша цифр болуы керек?', ru: 'Сколько цифр в каждом классе: миллионы, тысячи, единицы?' },
          { kz: 'Әр класта (мың, бірлік) дәл 3 цифр болады. Жетпесе — алдына нөл қоямыз.', ru: 'В каждом классе ровно 3 цифры; недостающие — нули впереди.' },
          { kz: `Мыңдар класы: ${pad(th, 3)}. Бірліктер класы: ${pad(un, 3)}.`, ru: `Класс тысяч: ${pad(th, 3)}, класс единиц: ${pad(un, 3)}.` },
        ],
        sol: { kz: `${mln} | ${pad(th, 3)} | ${pad(un, 3)} → ${fmt(n)}.`, ru: `${mln} | ${pad(th, 3)} | ${pad(un, 3)} → ${fmt(n)}.` },
      };
    },
  },

  {
    id: 'nat.divide_remainder',
    examType: 'compute', skills: ['nat.ops'], from: [], difficulty: 1,
    title: { kz: 'Қалдықпен бөлу', ru: 'Деление с остатком' },
    gen(r) {
      for (;;) {
        const d = r.int(3, 12), q = r.int(12, 180), rem = r.int(1, d - 1), n = d * q + rem;
        const T = (a, b) => `${a} (қалдық ${b})`;
        const { choices, answer } = choices5(r, T(q, rem), [
          { v: T(q, rem + 1 < d ? rem + 1 : rem - 1), tag: 'arith' }, { v: T(q + 1, 0), tag: 'rounded_up' },
          { v: T(q - 1, rem + d), tag: 'remainder_too_big' }, { v: T(Math.floor(n / (d + 1)), n % (d + 1)), tag: 'wrong_divisor' },
        ], () => T(q + r.int(-3, 3), r.int(0, d - 1)));
        return {
          kz: `Қалдықпен бөліңіз: ${n} : ${d}`, ru: `Разделите с остатком: ${n} : ${d}`, choices, answer,
          hints: [
            { kz: `${n} ішінде ${d} неше рет толық сыяды?`, ru: `Сколько раз ${d} целиком помещается в ${n}?` },
            { kz: `Қалдық әрқашан бөлгіштен кіші болады: 0 ≤ қалдық < ${d}.`, ru: `Остаток всегда меньше делителя: 0 ≤ остаток < ${d}.` },
            { kz: `${d} · ${q} = ${d * q}.`, ru: `${d} · ${q} = ${d * q}.` },
          ],
          sol: { kz: `${n} = ${d} · ${q} + ${rem}. Бөлінді ${q}, қалдық ${rem}.`, ru: `${n} = ${d} · ${q} + ${rem}. Частное ${q}, остаток ${rem}.` },
        };
      }
    },
  },

  {
    id: 'nat.order_of_ops',
    examType: 'compute', skills: ['nat.order_ops'], from: [], difficulty: 1,
    title: { kz: 'Амалдар реті', ru: 'Порядок действий' },
    gen(r) {
      for (;;) {
        const a = r.int(2, 40), b = r.int(2, 9), c = r.int(2, 9), d = r.int(2, 9), e = d * r.int(2, 12);
        const kind = r.int(0, 2);
        let txt, ans, ltr, steps;
        if (kind === 0) { txt = `${a} + ${b} · ${c}`; ans = a + b * c; ltr = (a + b) * c; steps = [`${b} · ${c} = ${b * c}`, `${a} + ${b * c} = ${ans}`]; }
        else if (kind === 1) { txt = `${e} : ${d} + ${b} · ${c}`; ans = e / d + b * c; ltr = (e / d + b) * c; steps = [`${e} : ${d} = ${e / d}`, `${b} · ${c} = ${b * c}`, `${e / d} + ${b * c} = ${ans}`]; }
        else { txt = `(${a} + ${b}) · ${c} − ${e} : ${d}`; ans = (a + b) * c - e / d; ltr = ((a + b) * c - e) / d; if (!Number.isInteger(ltr)) ltr = a + b * c - e / d; steps = [`${a} + ${b} = ${a + b}`, `${a + b} · ${c} = ${(a + b) * c}`, `${e} : ${d} = ${e / d}`, `${(a + b) * c} − ${e / d} = ${ans}`]; }
        if (ans < 0 || ans === ltr) continue;
        const { choices, answer } = choices5(r, num(ans), [
          { v: num(ltr), tag: 'left_to_right' }, { v: num(ans + b), tag: 'arith' }, { v: num(ans - c), tag: 'arith' }, { v: num(ans * 2), tag: 'random' },
        ], () => num(near(r, ans, 0.3, 1)));
        return {
          kz: `Өрнектің мәнін табыңыз:\n${txt}`, ru: `Найдите значение выражения:\n${txt}`, choices, answer,
          hints: [
            { kz: 'Қай амалды бірінші орындаймыз?', ru: 'Какое действие выполняем первым?' },
            { kz: 'Алдымен жақша, сосын көбейту мен бөлу, соңында қосу мен азайту.', ru: 'Сначала скобки, потом умножение и деление, в конце сложение и вычитание.' },
            { kz: `Бірінші қадам: ${steps[0]}.`, ru: `Первый шаг: ${steps[0]}.` },
          ],
          sol: { kz: steps.join('; ') + '.', ru: steps.join('; ') + '.' },
        };
      }
    },
  },

  {
    id: 'nat.powers_value',
    examType: 'compute', skills: ['nat.powers'], from: [], difficulty: 1,
    title: { kz: 'Дәреженің мәні', ru: 'Значение степени' },
    gen(r) {
      const a = r.int(2, 5), n = r.int(2, a === 2 ? 6 : 3), b = r.int(2, 9), m = 2;
      const ans = a ** n + b ** m;
      const { choices, answer } = choices5(r, num(ans), [
        { v: num(a * n + b * m), tag: 'power_as_product' }, { v: num(a ** n + b * m), tag: 'power_as_product' },
        { v: num((a + b) ** 2), tag: 'wrong_rule' }, { v: num(ans + a), tag: 'arith' },
      ], () => num(near(r, ans, 0.3, 1)));
      return {
        kz: `Есептеңіз: ${a}${sup(n)} + ${b}²`, ru: `Вычислите: ${a}${sup(n)} + ${b}²`, choices, answer,
        hints: [
          { kz: `${a}${sup(n)} деген не? ${a} · ${n} пе, әлде басқа ма?`, ru: `Что такое ${a}${sup(n)}? Это ${a} · ${n} или что-то другое?` },
          { kz: `Дәреже — санды өзіне-өзі бірнеше рет көбейту: ${a}${sup(n)} = ${Array(n).fill(a).join(' · ')}.`, ru: `Степень — число умножается само на себя: ${a}${sup(n)} = ${Array(n).fill(a).join(' · ')}.` },
          { kz: `${a}${sup(n)} = ${a ** n}.`, ru: `${a}${sup(n)} = ${a ** n}.` },
        ],
        sol: { kz: `${a}${sup(n)} = ${a ** n}, ${b}² = ${b * b}. Қосындысы: ${ans}.`, ru: `${a}${sup(n)} = ${a ** n}, ${b}² = ${b * b}. Сумма: ${ans}.` },
      };
    },
  },

  {
    id: 'div.which_divisible',
    examType: 'divisibility', skills: ['div.rules'], from: [], difficulty: 1,
    title: { kz: 'Бөлінгіштік белгілері', ru: 'Признаки делимости' },
    gen(r) {
      const k = r.pick([2, 3, 4, 5, 9, 10, 6]);
      const rule = {
        2: ['соңғы цифры жұп', 'последняя цифра чётная'], 3: ['цифрларының қосындысы 3-ке бөлінеді', 'сумма цифр делится на 3'],
        4: ['соңғы екі цифрынан құралған сан 4-ке бөлінеді', 'число из двух последних цифр делится на 4'], 5: ['0 немесе 5 цифрына аяқталады', 'оканчивается на 0 или 5'],
        9: ['цифрларының қосындысы 9-ға бөлінеді', 'сумма цифр делится на 9'], 10: ['0 цифрына аяқталады', 'оканчивается на 0'],
        6: ['2-ге де, 3-ке де бөлінеді', 'делится и на 2, и на 3'],
      }[k];
      let good; do { good = r.int(100, 9999) * k; } while (good > 99999);
      const trap = { 9: x => x % 3 === 0 && x % 9, 4: x => x % 2 === 0 && x % 4, 6: x => x % 3 === 0 && x % 2, 10: x => x % 5 === 0 && x % 10, 3: x => x % 3 === 1, 2: x => x % 2, 5: x => x % 10 === 6 }[k];
      const bad = new Set(); let guard = 0;
      while (bad.size < 4 && guard++ < 5000) { const x = r.int(1000, 99999); if (x % k && (bad.size < 2 ? trap(x) : true)) bad.add(x); }
      const { choices, answer } = choices5(r, fmt(good), [...bad].map(x => ({ v: fmt(x), tag: trap(x) ? 'partial_rule' : 'random' })), () => fmt(r.int(1000, 99999) * 1 + 1));
      return {
        kz: `Қай сан ${dat(k)} қалдықсыз бөлінеді?`, ru: `Какое число делится на ${k} без остатка?`, choices, answer,
        hints: [
          { kz: `${dat(k)} бөлінетінін бөлмей-ақ қалай білуге болады?`, ru: `Как узнать делимость на ${k}, не деля?` },
          { kz: `Белгі: сан ${dat(k)} бөлінеді, егер ${rule[0]}.`, ru: `Признак: число делится на ${k}, если ${rule[1]}.` },
          { kz: 'Әр нұсқаны белгі бойынша тексеріп шық, сәйкес келмейтіндерін сыз.', ru: 'Проверь каждый вариант по признаку и вычеркни неподходящие.' },
        ],
        sol: { kz: `${fmt(good)}: ${rule[0]} → ${dat(k)} бөлінеді.`, ru: `${fmt(good)}: ${rule[1]} → делится на ${k}.` },
      };
    },
  },

  {
    id: 'div.which_prime',
    examType: 'divisibility', skills: ['div.primes'], from: [], difficulty: 2,
    title: { kz: 'Жай сандар', ru: 'Простые числа' },
    gen(r) {
      const primes = []; for (let x = 11; x < 200; x++) if (isPrime(x)) primes.push(x);
      const traps = [51, 57, 87, 91, 111, 119, 133, 143, 161, 169, 187, 1, 27, 39, 49, 77, 93, 117];
      const good = r.pick(primes);
      const bad = r.shuffle(traps.filter(x => x !== good)).slice(0, 4);
      const { choices, answer } = choices5(r, num(good), bad.map(x => ({ v: num(x), tag: x === 1 ? 'one_is_prime' : 'looks_prime' })), () => num(r.int(4, 99) * 2));
      const why = x => (x === 1 ? '1 — жай да, құрама да емес' : `${x} = ${factor(x).join(' · ')}`);
      return {
        kz: 'Қай сан жай сан?', ru: 'Какое число простое?', choices, answer,
        hints: [
          { kz: 'Жай сан деген не? Оның неше бөлгіші бар?', ru: 'Что такое простое число? Сколько у него делителей?' },
          { kz: 'Жай санның тек екі бөлгіші бар: 1 және өзі. Кіші жай сандарға (2, 3, 5, 7, 11, 13) бөліп көр.', ru: 'У простого числа ровно два делителя: 1 и само число. Попробуй разделить на 2, 3, 5, 7, 11, 13.' },
          { kz: `Мысалы: ${why(bad[0])}.`, ru: `Например: ${why(bad[0])}.` },
        ],
        sol: { kz: `${good} ешбір кіші жай санға бөлінбейді. Қалғандары: ${bad.map(why).join('; ')}.`, ru: `${good} не делится ни на одно меньшее простое. Остальные: ${bad.map(why).join('; ')}.` },
      };
    },
  },

  {
    id: 'div.factorize',
    examType: 'divisibility', skills: ['div.factorization'], from: [], difficulty: 2,
    title: { kz: 'Жай көбейткіштерге жіктеу', ru: 'Разложение на простые множители' },
    gen(r) {
      for (;;) {
        const f = Array.from({ length: r.int(3, 5) }, () => r.pick([2, 2, 3, 3, 5, 7, 11]));
        const n = f.reduce((a, b) => a * b, 1); if (n > 2000 || n < 30) continue;
        const ok = factor(n);
        const wrongComposite = (() => { const g = ok.slice(); const i = g.indexOf(2); if (i >= 0 && g.filter(x => x === 2).length >= 2) { g.splice(i, 2, 4); return g.map(String).join(' · '); } return null; })();
        const off = ok.slice(); off[off.length - 1] = off[off.length - 1] === 2 ? 3 : 2;
        const { choices, answer } = choices5(r, powStr(ok), [
          { v: wrongComposite, tag: 'composite_factor' },
          { v: powStr(off.sort((a, b) => a - b)), tag: 'arith' },
          { v: powStr([...ok, 2].sort((a, b) => a - b)), tag: 'extra_factor' },
          { v: powStr(ok.slice(1)), tag: 'missing_factor' },
        ], () => powStr(Array.from({ length: 3 }, () => r.pick([2, 3, 5, 7])).sort((a, b) => a - b)));
        return {
          kz: `${n} санын жай көбейткіштерге жіктеңіз.`, ru: `Разложите ${n} на простые множители.`, choices, answer,
          hints: [
            { kz: `${n} қай ең кіші жай санға бөлінеді?`, ru: `На какое наименьшее простое число делится ${n}?` },
            { kz: 'Санды ең кіші жай санға бөле береміз, бөлінбей қалғанша; сосын келесі жай санға.', ru: 'Делим на наименьшее простое, пока делится; потом на следующее.' },
            { kz: `${n} : ${ok[0]} = ${n / ok[0]}.`, ru: `${n} : ${ok[0]} = ${n / ok[0]}.` },
          ],
          sol: { kz: `${n} = ${ok.join(' · ')} = ${powStr(ok)}. Барлық көбейткіштер жай сандар болуы керек (4, 6, 9 — жай емес).`, ru: `${n} = ${ok.join(' · ')} = ${powStr(ok)}. Все множители должны быть простыми (4, 6, 9 — не простые).` },
        };
      }
    },
  },

  {
    id: 'div.gcd_pair',
    examType: 'divisibility', skills: ['div.gcd'], from: [], difficulty: 2,
    title: { kz: 'Ең үлкен ортақ бөлгіш', ru: 'Наибольший общий делитель' },
    gen(r) {
      for (;;) {
        const g = r.pick([2, 3, 4, 5, 6, 8, 9, 12, 14, 15, 18, 24]), x = r.int(2, 12), y = r.int(2, 12);
        if (x === y || gcd(x, y) !== 1) continue;
        const a = g * x, b = g * y; if (a > 400 || b > 400) continue;
        const smallerCommon = [...Array(g).keys()].map(i => i + 1).filter(d => g % d === 0 && d < g && d > 1).pop();
        const { choices, answer } = choices5(r, num(g), [
          { v: num(lcm(a, b)), tag: 'confused_lcm' }, { v: smallerCommon ? num(smallerCommon) : null, tag: 'not_greatest' },
          { v: num(Math.min(a, b)), tag: 'smaller_number' }, { v: num(a * b), tag: 'product' },
        ], () => num(g + r.int(1, 6)));
        return {
          kz: `ЕҮОБ(${a}; ${b}) табыңыз.`, ru: `Найдите НОД(${a}; ${b}).`, choices, answer,
          hints: [
            { kz: `${a} мен ${b} екеуі де қай сандарға бөлінеді?`, ru: `На какие числа делятся и ${a}, и ${b}?` },
            { kz: 'Екі санды да жай көбейткіштерге жікте. ЕҮОБ — ортақ көбейткіштердің көбейтіндісі.', ru: 'Разложи оба числа на простые множители. НОД — произведение общих множителей.' },
            { kz: `${a} = ${factor(a).join(' · ')}, ${b} = ${factor(b).join(' · ')}.`, ru: `${a} = ${factor(a).join(' · ')}, ${b} = ${factor(b).join(' · ')}.` },
          ],
          sol: { kz: `${a} = ${factor(a).join(' · ')}, ${b} = ${factor(b).join(' · ')}. Ортақ көбейткіштер: ${factor(g).join(' · ')} = ${g}.`, ru: `Общие множители: ${factor(g).join(' · ')} = ${g}.` },
        };
      }
    },
  },

  {
    id: 'div.lcm_pair',
    examType: 'divisibility', skills: ['div.lcm'], from: [], difficulty: 2,
    title: { kz: 'Ең кіші ортақ еселік', ru: 'Наименьшее общее кратное' },
    gen(r) {
      for (;;) {
        const a = r.int(4, 40), b = r.int(4, 40); if (a === b || a % b === 0 || b % a === 0) continue;
        const L = lcm(a, b); if (L > 600 || L === a * b && r.chance(0.5)) continue;
        const { choices, answer } = choices5(r, num(L), [
          { v: num(a * b), tag: 'product' }, { v: num(gcd(a, b)), tag: 'confused_gcd' },
          { v: num(Math.max(a, b)), tag: 'larger_number' }, { v: num(L * 2), tag: 'not_least' },
        ], () => num(L + r.int(1, 5) * Math.min(a, b)));
        return {
          kz: `ЕКОЕ(${a}; ${b}) табыңыз.`, ru: `Найдите НОК(${a}; ${b}).`, choices, answer,
          hints: [
            { kz: `${a}-ге де, ${b}-ге де бөлінетін ең кіші сан қандай?`, ru: `Какое наименьшее число делится и на ${a}, и на ${b}?` },
            { kz: 'Үлкен санның еселіктерін жазып шық: ол кіші санға бөлінген бойда тоқта.', ru: 'Выписывай кратные большего числа, пока не найдёшь делящееся на меньшее.' },
            { kz: `${Math.max(a, b)}, ${2 * Math.max(a, b)}, ${3 * Math.max(a, b)}, …`, ru: `${Math.max(a, b)}, ${2 * Math.max(a, b)}, ${3 * Math.max(a, b)}, …` },
          ],
          sol: { kz: `${a} = ${factor(a).join(' · ')}, ${b} = ${factor(b).join(' · ')}. ЕКОЕ = ${L}. Тексеру: ${L} : ${a} = ${L / a}, ${L} : ${b} = ${L / b}.`, ru: `НОК = ${L}. Проверка: ${L} : ${a} = ${L / a}, ${L} : ${b} = ${L / b}.` },
        };
      }
    },
  },

  {
    id: 'div.gcd_lcm_story',
    examType: 'divisibility', skills: ['div.gcd_lcm_word'], from: [], difficulty: 2,
    title: { kz: 'ЕҮОБ пен ЕКОЕ-ге есептер', ru: 'Задачи на НОД и НОК' },
    gen(r) {
      if (r.chance(0.5)) {
        for (;;) {
          const g = r.int(3, 15), x = r.int(2, 9), y = r.int(2, 9); if (x === y || gcd(x, y) !== 1) continue;
          const a = g * x, b = g * y;
          const { choices, answer } = choices5(r, num(g), [
            { v: num(lcm(a, b)), tag: 'confused_lcm' }, { v: num(x + y), tag: 'answered_items' },
            { v: num(Math.min(a, b)), tag: 'smaller_number' }, { v: num(g > 3 ? g / (g % 2 ? 1 : 2) : g + 1), tag: 'not_greatest' },
          ], () => num(g + r.int(1, 5)));
          return {
            kz: `${a} алма мен ${b} алмұрт бар. Оларды бірдей сыйлықтарға бөліп, ештеңе артық қалмауы керек. Ең көп дегенде неше сыйлық жасауға болады?`,
            ru: `Есть ${a} яблок и ${b} груш. Их раскладывают в одинаковые подарки без остатка. Какое наибольшее число подарков можно сделать?`,
            choices, answer,
            hints: [
              { kz: 'Сыйлық саны алма санын да, алмұрт санын да бөлуі керек. Бұл қандай сан?', ru: 'Число подарков должно делить и число яблок, и число груш. Что это за число?' },
              { kz: '«Ең көп сыйлық» — ең үлкен ортақ бөлгіш (ЕҮОБ).', ru: '«Наибольшее число подарков» — это НОД.' },
              { kz: `ЕҮОБ(${a}; ${b}) табу керек.`, ru: `Нужно найти НОД(${a}; ${b}).` },
            ],
            sol: { kz: `ЕҮОБ(${a}; ${b}) = ${g}. Әр сыйлықта ${x} алма және ${y} алмұрт.`, ru: `НОД(${a}; ${b}) = ${g}. В каждом подарке ${x} яблок и ${y} груш.` },
          };
        }
      }
      for (;;) {
        const a = r.int(4, 30), b = r.int(4, 30); if (a === b) continue; const L = lcm(a, b); if (L > 240 || L === Math.max(a, b)) continue;
        const { choices, answer } = choices5(r, num(L), [
          { v: num(a * b), tag: 'product' }, { v: num(gcd(a, b)), tag: 'confused_gcd' }, { v: num(a + b), tag: 'sum' }, { v: num(Math.max(a, b)), tag: 'larger_number' },
        ], () => num(L + r.int(1, 4) * 5));
        return {
          kz: `Бекеттен бір автобус әр ${a} минут сайын, екіншісі әр ${b} минут сайын шығады. Қазір екеуі бірге шықты. Неше минуттан кейін олар қайтадан бірге шығады?`,
          ru: `Один автобус отходит каждые ${a} мин, другой — каждые ${b} мин. Сейчас они отошли вместе. Через сколько минут они снова отойдут вместе?`,
          choices, answer,
          hints: [
            { kz: `Бұл уақыт ${dat(a)} де, ${dat(b)} де бөлінуі керек. Ең кішісін іздейміз.`, ru: `Это время должно делиться и на ${a}, и на ${b}; ищем наименьшее.` },
            { kz: '«Қайтадан бірге» — ең кіші ортақ еселік (ЕКОЕ).', ru: '«Снова вместе» — это НОК.' },
            { kz: `ЕКОЕ(${a}; ${b}) табу керек.`, ru: `Нужно найти НОК(${a}; ${b}).` },
          ],
          sol: { kz: `ЕКОЕ(${a}; ${b}) = ${L} минут.`, ru: `НОК(${a}; ${b}) = ${L} мин.` },
        };
      }
    },
  },

  {
    id: 'div.star_digit_9',
    examType: 'divisibility', skills: ['div.star_digit'], from: ['bolashak1-43'], difficulty: 2,
    title: { kz: 'Жұлдызшаның орнына цифр', ru: 'Цифра вместо звёздочки' },
    gen(r) {
      for (;;) {
        const k = r.pick([3, 9, 45, 18]);
        const len = r.int(4, 5), digits = Array.from({ length: len }, (_, i) => (i === 0 ? r.int(1, 9) : r.int(0, 9)));
        const pos = r.int(1, len - 2);
        if (k === 45 || k === 18) digits[len - 1] = k === 45 ? r.pick([0, 5]) : r.pick([0, 2, 4, 6, 8]);
        const cands = [];
        for (let d = 0; d <= 9; d++) { const x = digits.slice(); x[pos] = d; if (+x.join('') % k === 0) cands.push(d); }
        if (cands.length !== 1) continue;
        const ans = cands[0], shown = digits.map((d, i) => (i === pos ? '*' : d)).join('');
        const sum = digits.reduce((s, d, i) => (i === pos ? s : s + d), 0);
        const { choices, answer } = choices5(r, num(ans), [
          { v: num((ans + 3) % 10), tag: 'div3_only' }, { v: num((9 - (sum % 9)) % 9 === ans ? (ans + 1) % 10 : (9 - (sum % 9)) % 9), tag: 'arith' },
          { v: num((ans + 5) % 10), tag: 'random' }, { v: num((ans + 7) % 10), tag: 'random' },
        ], () => num(r.int(0, 9)));
        const rule = k === 45 ? ['45 = 5 · 9: сан 5-ке (соңы 0 не 5) және 9-ға (цифрлар қосындысы) бөлінуі керек', '45 = 5 · 9: делится на 5 (конец 0 или 5) и на 9 (сумма цифр)']
          : k === 18 ? ['18 = 2 · 9: сан жұп және цифрларының қосындысы 9-ға бөлінуі керек', '18 = 2 · 9: чётное и сумма цифр делится на 9']
          : [`${dat(k)} бөлінеді, егер цифрларының қосындысы ${dat(k)} бөлінсе`, `делится на ${k}, если сумма цифр делится на ${k}`];
        return {
          kz: `${shown} саны ${dat(k)} бөлінеді. Жұлдызшаның (*) орнында қандай цифр тұр?`,
          ru: `Число ${shown} делится на ${k}. Какая цифра стоит вместо звёздочки?`,
          choices, answer,
          hints: [
            { kz: `${dat(k)} бөлінудің белгісін еске түсір.`, ru: `Вспомни признак делимости на ${k}.` },
            { kz: rule[0] + '.', ru: rule[1] + '.' },
            { kz: `Белгілі цифрлардың қосындысы: ${sum}.`, ru: `Сумма известных цифр: ${sum}.` },
          ],
          sol: { kz: `Цифрлар қосындысы ${sum} + * болуы керек. Тек * = ${ans} жарайды: ${digits.map((d, i) => (i === pos ? ans : d)).join('')}.`, ru: `Сумма цифр ${sum} + *. Подходит только * = ${ans}.` },
        };
      }
    },
  },
];
