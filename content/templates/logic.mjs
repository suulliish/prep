// Логика и свойства чисел: часы, календарь, новая операция, закономерности,
// перебор, множества, промежутки, «кто в каком классе».
import { Q, num, choices5, near, DAYS, dat, loc, abl, genKz, andKz } from './lib.mjs';

export default [
  {
    id: 'logic.clock_angle',
    examType: 'logic', skills: ['clock.angle'], from: ['daryn2023-19'], difficulty: 3,
    title: { kz: 'Сағат тілдерінің арасындағы бұрыш', ru: 'Угол между стрелками часов' },
    gen(r) {
      for (;;) {
        const h = r.int(1, 23), m = r.int(1, 11) * 5;
        if (m % 2) continue;                   // 5,5·m должно быть целым
        const hh = h % 12, hand = 30 * hh + m / 2, mn = 6 * m;
        let a = Math.abs(hand - mn); if (a > 180) a = 360 - a;
        if (a === 0 || a === 180) continue;
        let naive = Math.abs(30 * hh - mn); if (naive > 180) naive = 360 - naive;
        const time = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        const { choices, answer } = choices5(r, num(a) + '°', [
          { v: num(naive) + '°', tag: 'hour_hand_static' },
          { v: num(360 - a) + '°', tag: 'reflex' },
          { v: num(a + 10) + '°', tag: 'random' },
          { v: num(Math.abs(a - 30)) + '°', tag: 'random' },
        ], () => num(r.int(1, 17) * 10) + '°');
        return {
          kz: `Сағат ${time} болғанда сағаттық тіл мен минуттық тілдің арасындағы бұрыштың градустық өлшемін табыңыз.`,
          ru: `Найдите угол (в градусах) между часовой и минутной стрелками, когда часы показывают ${time}.`,
          choices, answer,
          sol: {
            kz: `Минуттық тіл минутына 6°: 6 · ${m} = ${mn}°. Сағаттық тіл сағатына 30° және минутына 0,5° жылжиды: 30 · ${hh} + 0,5 · ${m} = ${num(hand)}°. Айырмасы: ${num(a)}°.`,
            ru: `Минутная стрелка — 6° в минуту: 6 · ${m} = ${mn}°. Часовая — 30° в час и 0,5° в минуту: 30 · ${hh} + 0,5 · ${m} = ${num(hand)}°. Разница: ${num(a)}°.`,
          },
        };
      }
    },
  },

  {
    id: 'logic.every_k_days',
    examType: 'logic', skills: ['calendar.mod7'], from: ['daryn2023-49'], difficulty: 2,
    title: { kz: 'Әр k күн сайын: аптаның қай күні', ru: 'Каждые k дней: какой день недели' },
    gen(r) {
      const k = r.int(2, 9), n = r.int(4, 15), start = r.int(0, 6);
      const idx = (start + k * (n - 1)) % 7, off = (start + k * n) % 7;
      const correct = DAYS[idx];
      const pool = DAYS.filter((_, i) => i !== idx);
      const { choices, answer } = choices5(r, correct.kz + ' / ' + correct.ru, [
        idx !== off ? { v: DAYS[off].kz + ' / ' + DAYS[off].ru, tag: 'off_by_one' } : { v: null },
      ], () => { const d = r.pick(pool); return d.kz + ' / ' + d.ru; });
      return {
        kz: `Асан әр ${k} күн сайын бассейнге барады. Алғаш рет ол ${DAYS[start].kz} күні барды. Аптаның қай күні ол ${n}-ші рет барады?`,
        ru: `Асан ходит в бассейн каждые ${k} дней. Первый раз он пошёл ${DAYS[start].ru === 'вторник' ? 'во' : 'в'} ${DAYS[start].ru}. В какой день недели он пойдёт в ${n}-й раз?`,
        choices, answer,
        sol: {
          kz: `${n}-ші рет — біріншіден кейін ${n - 1} рет, яғни ${k} · ${n - 1} = ${k * (n - 1)} күннен соң. ${k * (n - 1)} : 7 = ${Math.floor(k * (n - 1) / 7)} апта, қалдық ${k * (n - 1) % 7}. ${DAYS[start].kz} + ${k * (n - 1) % 7} күн = ${correct.kz}.`,
          ru: `${n}-й раз — это через ${n - 1} посещений после первого, то есть через ${k} · ${n - 1} = ${k * (n - 1)} дней. ${k * (n - 1)} : 7 = ${Math.floor(k * (n - 1) / 7)} недель, остаток ${k * (n - 1) % 7}. ${DAYS[start].ru} + ${k * (n - 1) % 7} дн. = ${correct.ru}.`,
        },
      };
    },
  },

  {
    id: 'logic.new_operation',
    examType: 'logic', skills: ['logic.new_operation', 'expr.substitute'], from: ['daryn2023-29'], difficulty: 1,
    title: { kz: 'Жаңа амал', ru: 'Новая операция' },
    gen(r) {
      const kinds = [
        { f: (a, b) => r0.p * a + r0.q * b, txt: () => `${r0.p}·a + ${r0.q}·b` },
        { f: (a, b) => a * b - r0.p * a, txt: () => `a·b − ${r0.p}·a` },
        { f: (a, b) => a * a - r0.q * b, txt: () => `a² − ${r0.q}·b` },
        { f: (a, b) => (a + b) * r0.p - b, txt: () => `(a + b)·${r0.p} − b` },
      ];
      const r0 = { p: r.int(2, 6), q: r.int(2, 6) };
      const K = r.pick(kinds), x = r.int(2, 12), y = r.int(2, 12);
      if (x === y) return this.gen(r);
      const ans = K.f(x, y), swapped = K.f(y, x);
      const { choices, answer } = choices5(r, num(ans), [
        { v: num(swapped), tag: 'swapped_args' }, { v: num(ans + r0.p), tag: 'arith' },
        { v: num(ans - r0.q), tag: 'arith' }, { v: num(x * y), tag: 'plain_product' },
      ], () => num(ans + r.int(-9, 9)));
      return {
        kz: `Жаңа амал «※» былай анықталған: a ※ b = ${K.txt()}. ${x} ※ ${y} өрнегінің мәнін табыңыз.`,
        ru: `Новая операция «※» задана так: a ※ b = ${K.txt()}. Найдите ${x} ※ ${y}.`,
        choices, answer,
        sol: {
          kz: `Формулаға a = ${x}, b = ${y} қоямыз (ретін шатастырмау керек!): ${K.txt().replace(/a/g, `(${x})`).replace(/b/g, `(${y})`)} = ${ans}.`,
          ru: `Подставляем a = ${x}, b = ${y} (порядок важен!): ${K.txt().replace(/a/g, `(${x})`).replace(/b/g, `(${y})`)} = ${ans}.`,
        },
      };
    },
  },

  {
    id: 'logic.bracket_pattern',
    examType: 'patterns', skills: ['pattern.number_rule'], from: ['daryn2023-42'], difficulty: 2,
    title: { kz: 'Жақшадағы санның заңдылығы', ru: 'Закономерность с числом в скобках' },
    gen(r) {
      const rules = [
        { make: k => { const x = r.int(1, k * k - 1); return [x, k, k * k - x]; }, kz: 'шеткі сандардың қосындысы жақшадағы санның квадратына тең', ru: 'сумма крайних чисел равна квадрату числа в скобках', ks: [4, 9] },
        { make: k => { const y = r.int(1, 30); return [y + k * k, k, y]; }, kz: 'шеткі сандардың айырмасы жақшадағы санның квадратына тең', ru: 'разность крайних чисел равна квадрату числа в скобках', ks: [3, 8] },
        { make: k => { const x = r.int(1, 3 * k - 1); return [x, k, 3 * k - x]; }, kz: 'шеткі сандардың қосындысы жақшадағы саннан 3 есе көп', ru: 'сумма крайних чисел в 3 раза больше числа в скобках', ks: [5, 15] },
        { make: k => { const d = r.pick([2, 3, 4]); const x = k * d; return [x, k, d]; }, kz: 'сол жақ сан — жақшадағы сан мен оң жақ санның көбейтіндісі', ru: 'левое число — произведение числа в скобках и правого числа', ks: [3, 12] },
      ];
      const R = r.pick(rules);
      const ks = r.shuffle(Array.from({ length: R.ks[1] - R.ks[0] + 1 }, (_, i) => R.ks[0] + i)).slice(0, 3);
      const rows = ks.map(k => R.make(k));
      const ans = rows[2][2];
      const { choices, answer } = choices5(r, num(ans), [
        { v: num(ans + 1), tag: 'arith' }, { v: num(ans + rows[2][1]), tag: 'wrong_rule' },
        { v: num(Math.abs(ans - 3)), tag: 'random' }, { v: num(rows[2][0]), tag: 'copied' },
      ], () => num(ans + r.int(-7, 7)));
      const show = rows.map((x, i) => `${x[0]} (${x[1]}) ${i === 2 ? '?' : x[2]}`).join('\n');
      return {
        kz: `Заңдылықты анықтап, сұрақ белгісінің орнына сәйкес санды табыңыз:\n${show}`,
        ru: `Определите закономерность и найдите число вместо знака вопроса:\n${show}`,
        choices, answer,
        sol: { kz: `Заңдылық: ${R.kz}. Үшінші жолда: ? = ${ans}.`, ru: `Закономерность: ${R.ru}. В третьей строке: ? = ${ans}.` },
      };
    },
  },

  {
    id: 'logic.count_after_removal',
    examType: 'divisibility', skills: ['div.count_multiples', 'sets.inclusion_exclusion'], from: ['daryn2023-30'], difficulty: 2,
    title: { kz: 'Еселіктерді сызып тастағаннан кейін неше сан қалады', ru: 'Сколько чисел останется после вычёркивания кратных' },
    gen(r) {
      const [a, b] = r.pick([[2, 5], [2, 3], [3, 5], [2, 7], [3, 4]]);
      const N = r.int(20, 60);
      let cnt = 0; for (let i = 1; i <= N; i++) if (i % a && i % b) cnt++;
      const na = Math.floor(N / a), nb = Math.floor(N / b), nab = Math.floor(N / (a * b / gcdI(a, b)));
      const nm = { 2: ['жұп сандарды', 'все чётные числа'], 3: ['3-ке бөлінетін сандарды', 'все числа, кратные 3'] };
      const txtA = nm[a] || [`${dat(a)} бөлінетін сандарды`, `все числа, кратные ${a}`];
      const { choices, answer } = choices5(r, num(cnt), [
        { v: num(N - na - nb), tag: 'double_removed' },
        { v: num(N - na), tag: 'only_first' },
        { v: num(cnt + 1), tag: 'off_by_one' },
        { v: num(na + nb - nab), tag: 'answered_removed' },
      ], () => num(cnt + r.int(-5, 5)));
      return {
        kz: `1; 2; 3; ...; ${N} сандар тізбегінен ${txtA[0]}, сонымен қатар ${dat(b)} бөлінетін сандарды сызып тастады. Тізбекте неше сан қалады?`,
        ru: `Из чисел 1; 2; 3; ...; ${N} вычеркнули ${txtA[1]}, а также все числа, кратные ${b}. Сколько чисел осталось?`,
        choices, answer,
        sol: {
          kz: `${dat(a)} бөлінетіндер: ${na}. ${dat(b)} бөлінетіндер: ${nb}. Екеуіне де бөлінетіндер (${a * b / gcdI(a, b)}-ке еселі) екі рет санамау үшін: ${nab}. Сызылғаны: ${na} + ${nb} − ${nab} = ${na + nb - nab}. Қалды: ${N} − ${na + nb - nab} = ${cnt}.`,
          ru: `Кратных ${a}: ${na}. Кратных ${b}: ${nb}. Кратные обоим (кратные ${a * b / gcdI(a, b)}) не считаем дважды: ${nab}. Вычеркнули ${na} + ${nb} − ${nab} = ${na + nb - nab}. Осталось ${N} − ${na + nb - nab} = ${cnt}.`,
        },
      };
    },
  },

  {
    id: 'logic.line_up',
    examType: 'logic', skills: ['comb.permutations'], from: ['daryn2023-31'], difficulty: 1,
    title: { kz: 'Бір қатарға тұру тәсілдері', ru: 'Сколькими способами встать в ряд' },
    gen(r) {
      const n = r.int(3, 6), f = [1, 1, 2, 6, 24, 120, 720][n];
      const nm = r.shuffle(['Арман', 'Марат', 'Сәкен', 'Дамир', 'Айжан', 'Дана', 'Ерлан', 'Мадина']).slice(0, n);
      const firstK = r.chance(0.3);
      const ans = firstK ? n * (n - 1) : f;
      const { choices, answer } = choices5(r, num(ans), [
        { v: num(n * n), tag: 'n_squared' }, { v: num(n * (n - 1) / 2), tag: 'pairs' },
        { v: num(firstK ? f : n * (n - 1)), tag: 'wrong_question' }, { v: num(n + (n - 1) + (n - 2)), tag: 'sum_not_product' },
      ], () => { const v = ans + r.int(-6, 6); return v > 0 ? num(v) : null; });
      return firstK ? {
        kz: `${n} оқушының ішінен бірінші және екінші орынға жүлдегерлерді неше тәсілмен таңдауға болады?`,
        ru: `Сколькими способами из ${n} учеников можно выбрать победителей на 1-е и 2-е место?`,
        choices, answer,
        sol: { kz: `Бірінші орынға ${n} таңдау, екінші орынға қалған ${n - 1}: ${n} · ${n - 1} = ${ans}.`, ru: `На 1-е место ${n} вариантов, на 2-е — оставшиеся ${n - 1}: ${n} · ${n - 1} = ${ans}.` },
      } : {
        kz: `${nm.join(', ')} — ${n} сыныптас сахнада бір қатарға тұруы керек. Олар неше түрлі ретпен тұра алады?`,
        ru: `${n} одноклассников (${nm.join(', ')}) должны встать в один ряд на сцене. Сколькими разными способами это можно сделать?`,
        choices, answer,
        sol: { kz: `Бірінші орынға ${n} адам, екіншіге ${n - 1}, … соңғысына 1: ${Array.from({ length: n }, (_, i) => n - i).join(' · ')} = ${f}.`, ru: `На первое место ${n} человек, на второе ${n - 1}, … на последнее 1: ${Array.from({ length: n }, (_, i) => n - i).join(' · ')} = ${f}.` },
      };
    },
  },

  {
    id: 'logic.page_digits',
    examType: 'logic', skills: ['number.digit_count'], from: ['daryn2023-37'], difficulty: 3,
    title: { kz: 'Беттерді нөмірлеуге кеткен цифрлар', ru: 'Цифры для нумерации страниц' },
    gen(r) {
      const P = r.pick([r.int(15, 99), r.int(100, 300)]);
      const D = digits(P);
      const { choices, answer } = choices5(r, num(P), [
        { v: num(Math.floor(D / 2)), tag: 'all_two_digit' },
        { v: num(Math.floor((D - 9) / 2)), tag: 'forgot_single_digit_pages' },
        { v: num(D), tag: 'copied' },
        { v: num(P + 9), tag: 'arith' },
      ], () => num(P + r.int(-8, 8)));
      return {
        kz: `Кітаптың беттерін 1-ден бастап нөмірлеуге ${D} цифр жұмсалды. Кітапта неше бет бар?`,
        ru: `Для нумерации страниц книги, начиная с 1, использовали ${D} цифр. Сколько страниц в книге?`,
        choices, answer,
        sol: P < 100 ? {
          kz: `1–9 беттерге 9 цифр. Қалған ${D - 9} цифр екі таңбалы нөмірлерге: ${D - 9} : 2 = ${(D - 9) / 2} бет (10-нан ${P}-ге дейін). Барлығы: 9 + ${(D - 9) / 2} = ${P}.`,
          ru: `Страницы 1–9 — 9 цифр. Остальные ${D - 9} цифр на двузначные номера: ${D - 9} : 2 = ${(D - 9) / 2} страниц (с 10 по ${P}). Всего: 9 + ${(D - 9) / 2} = ${P}.`,
        } : {
          kz: `1–9: 9 цифр; 10–99: 90 · 2 = 180 цифр; барлығы 189. Қалған ${D - 189} цифр үш таңбалы нөмірлерге: ${D - 189} : 3 = ${(D - 189) / 3} бет. Барлығы: 99 + ${(D - 189) / 3} = ${P}.`,
          ru: `1–9: 9 цифр; 10–99: 90 · 2 = 180 цифр; итого 189. Остальные ${D - 189} цифр — трёхзначные номера: ${D - 189} : 3 = ${(D - 189) / 3} стр. Всего: 99 + ${(D - 189) / 3} = ${P}.`,
        },
      };
    },
  },

  {
    id: 'div.last_digit_power',
    examType: 'divisibility', skills: ['number.last_digit_cycle'], from: ['daryn2023-51'], difficulty: 2,
    title: { kz: 'Дәреженің соңғы цифры', ru: 'Последняя цифра степени' },
    gen(r) {
      const b = r.pick([2, 3, 7, 8, 4, 9, 12, 13, 17]), e = r.int(10, 60);
      const cyc = []; let x = b % 10; while (!cyc.includes(x)) { cyc.push(x); x = x * b % 10; }
      const ans = cyc[(e - 1) % cyc.length];
      const { choices, answer } = choices5(r, num(ans), cyc.filter(c => c !== ans).map(c => ({ v: num(c), tag: 'wrong_position' })),
        () => num(r.int(0, 9)));
      return {
        kz: `${b}${sup(e)} санының соңғы цифрын табыңыз.`,
        ru: `Найдите последнюю цифру числа ${b}${sup(e)}.`,
        choices, answer,
        sol: {
          kz: `${b} дәрежелерінің соңғы цифрлары қайталанады: ${cyc.join(', ')} (период ${cyc.length}). ${e} : ${cyc.length} — қалдық ${e % cyc.length}${e % cyc.length === 0 ? ' (қалдық 0 — периодтың соңғы цифры)' : ''}. Жауабы: ${ans}.`,
          ru: `Последние цифры степеней ${b} повторяются: ${cyc.join(', ')} (период ${cyc.length}). ${e} : ${cyc.length} — остаток ${e % cyc.length}${e % cyc.length === 0 ? ' (остаток 0 — последняя цифра периода)' : ''}. Ответ: ${ans}.`,
        },
      };
    },
  },

  {
    id: 'div.count_powers',
    examType: 'divisibility', skills: ['power.squares_cubes'], from: ['daryn2023-54'], difficulty: 2,
    title: { kz: 'Аралықтағы квадраттар/кубтар саны', ru: 'Сколько квадратов/кубов в промежутке' },
    gen(r) {
      const cube = r.chance(0.5), N = cube ? r.int(200, 3000) : r.int(50, 900);
      const p = cube ? 3 : 2;
      let k = 0; while ((k + 1) ** p <= N) k++;
      const { choices, answer } = choices5(r, num(k), [
        { v: num(k + 1), tag: 'off_by_one' }, { v: num(k - 1), tag: 'off_by_one' },
        { v: num(cube ? Math.floor(Math.sqrt(N)) : Math.floor(N / 2)), tag: 'wrong_power' }, { v: num(Math.floor(N / (cube ? 3 : 2) / 10)), tag: 'random' },
      ], () => { const v = k + r.int(-4, 4); return v > 0 ? num(v) : null; });
      return {
        kz: `1-ден ${N}-ге дейінгі сандардың ішінде натурал санның ${cube ? 'кубы' : 'квадраты'} болатын неше сан бар?`,
        ru: `Сколько среди чисел от 1 до ${N} ${cube ? 'кубов' : 'квадратов'} натуральных чисел?`,
        choices, answer,
        sol: {
          kz: `${k}${cube ? '³' : '²'} = ${k ** p} ≤ ${N}, ал ${k + 1}${cube ? '³' : '²'} = ${(k + 1) ** p} > ${N}. Демек 1${cube ? '³' : '²'}, 2${cube ? '³' : '²'}, …, ${k}${cube ? '³' : '²'} — барлығы ${k}.`,
          ru: `${k}${cube ? '³' : '²'} = ${k ** p} ≤ ${N}, а ${k + 1}${cube ? '³' : '²'} = ${(k + 1) ** p} > ${N}. Значит 1${cube ? '³' : '²'}, …, ${k}${cube ? '³' : '²'} — всего ${k}.`,
        },
      };
    },
  },

  {
    id: 'sets.venn3_none',
    examType: 'logic', skills: ['sets.venn3'], from: ['daryn2023-50'], difficulty: 3,
    title: { kz: 'Үш жиын: ешқайсысына кірмейтіндер', ru: 'Три множества: не входит ни в одно' },
    gen(r) {
      for (;;) {
        const t = r.int(0, 2), ab = r.int(1, 5) + t, ac = r.int(1, 5) + t, bc = r.int(0, 4) + t;
        const A = ab + ac - t + r.int(2, 8), B = ab + bc - t + r.int(1, 6), C = ac + bc - t + r.int(2, 8);
        const U = A + B + C - ab - ac - bc + t, none = r.int(2, 9), T = U + none;
        const { choices, answer } = choices5(r, num(none), [
          { v: num(U), tag: 'answered_attending' },
          { v: num(T - (A + B + C - ab - ac - bc)), tag: 'forgot_triple' },
          { v: num(none + t + 1), tag: 'random' },
          { v: num(T - U + ab), tag: 'random' },
        ], () => num(none + r.int(-4, 4)));
        const tri = t === 0 ? ['Үш мектепке де баратын бала жоқ.', 'Во все три школы не ходит никто.'] : [`${t} бала үш мектепке де барады.`, `${t} детей ходят во все три школы.`];
        return {
          kz: `Сыныптағы ${T} оқушының ${A} баласы музыка мектебіне, ${B} баласы өнер мектебіне, ${C} баласы спорт мектебіне барады. ${ab} бала музыка мен өнерге, ${ac} бала музыка мен спортқа, ${bc} бала өнер мен спортқа барады (үшеуін санағанда). ${tri[0]} Ешбір қосымша мектепке бармайтын бала саны неше?`,
          ru: `Из ${T} учеников ${A} ходят в музыкальную школу, ${B} — в художественную, ${C} — в спортивную. ${ab} ходят в музыкальную и художественную, ${ac} — в музыкальную и спортивную, ${bc} — в художественную и спортивную (включая тех, кто ходит во все три). ${tri[1]} Сколько учеников не ходят ни в одну школу?`,
          choices, answer,
          sol: {
            kz: `Кем дегенде бір мектепке баратындар: ${A} + ${B} + ${C} − ${ab} − ${ac} − ${bc} + ${t} = ${U} (екі рет саналғандарды шегереміз, үшеуіне баратындарды қайта қосамыз). Бармайтындар: ${T} − ${U} = ${none}.`,
            ru: `Ходят хотя бы в одну: ${A} + ${B} + ${C} − ${ab} − ${ac} − ${bc} + ${t} = ${U} (вычитаем посчитанных дважды, возвращаем тех, кто во всех трёх). Не ходят: ${T} − ${U} = ${none}.`,
          },
        };
      }
    },
  },

  {
    id: 'sets.union_intersection',
    examType: 'logic', skills: ['sets.operations'], from: ['daryn2023-16'], difficulty: 1,
    title: { kz: 'Жиындардың бірігуі мен қиылысуы', ru: 'Объединение и пересечение множеств' },
    gen(r) {
      const pool = r.shuffle(Array.from({ length: 25 }, (_, i) => i + 5));
      const common = pool.slice(0, r.int(2, 4)), onlyA = pool.slice(4, 4 + r.int(1, 3)), onlyB = pool.slice(8, 8 + r.int(1, 3));
      const A = [...common, ...onlyA].sort((a, b) => a - b), B = [...common, ...onlyB].sort((a, b) => a - b);
      const union = [...new Set([...A, ...B])].sort((a, b) => a - b), inter = common.slice().sort((a, b) => a - b);
      const ask = r.pick(['union', 'inter']);
      const S = a => '{' + a.join(', ') + '}';
      const correct = S(ask === 'union' ? union : inter);
      const { choices, answer } = choices5(r, correct, [
        { v: S(ask === 'union' ? inter : union), tag: 'confused_operation' },
        { v: S([...onlyA, ...onlyB].sort((a, b) => a - b)), tag: 'symmetric_difference' },
        { v: S(A), tag: 'one_set' },
        { v: S(B), tag: 'one_set' },
      ], () => S(r.shuffle(union).slice(0, r.int(2, union.length - 1)).sort((a, b) => a - b)));
      return {
        kz: `A = ${S(A)} және B = ${S(B)} жиындарының ${ask === 'union' ? 'бірігуін' : 'қиылысуын'} табыңыз.`,
        ru: `Найдите ${ask === 'union' ? 'объединение' : 'пересечение'} множеств A = ${S(A)} и B = ${S(B)}.`,
        choices, answer,
        sol: ask === 'union'
          ? { kz: `Бірігу — екі жиынның барлық элементтері, қайталамай: ${correct}.`, ru: `Объединение — все элементы обоих множеств без повторов: ${correct}.` }
          : { kz: `Қиылысу — екі жиынға да ортақ элементтер: ${correct}.`, ru: `Пересечение — элементы, общие для обоих множеств: ${correct}.` },
      };
    },
  },

  {
    id: 'coord.interval_intersection',
    examType: 'coordinate', skills: ['intervals.intersection', 'ineq.integers'], from: ['daryn2023-23'], difficulty: 2,
    title: { kz: 'Сан аралықтарының қиылысуы', ru: 'Пересечение числовых промежутков' },
    gen(r) {
      for (;;) {
        const iv = () => { const a = r.int(-10, 4), b = a + r.int(3, 12); return { a, b, lc: r.chance(0.5), rc: r.chance(0.5) }; };
        const I = [iv(), iv(), iv()];
        const ints = []; for (let x = -12; x <= 20; x++) if (I.every(v => (v.lc ? x >= v.a : x > v.a) && (v.rc ? x <= v.b : x < v.b))) ints.push(x);
        if (ints.length < 2) continue;
        const wantMax = r.chance(0.6), ans = wantMax ? ints[ints.length - 1] : ints[0];
        const lo = Math.max(...I.map(v => v.a)), hi = Math.min(...I.map(v => v.b));
        const T = v => `${v.lc ? '[' : '('}${num(v.a)}; ${num(v.b)}${v.rc ? ']' : ')'}`;
        const { choices, answer } = choices5(r, num(ans), [
          { v: num(wantMax ? hi : lo), tag: 'ignored_open_end' },
          { v: num(wantMax ? Math.max(...I.map(v => v.b)) : Math.min(...I.map(v => v.a))), tag: 'union_not_intersection' },
          { v: num(wantMax ? ans - 1 : ans + 1), tag: 'off_by_one' },
          { v: num(wantMax ? ints[0] : ints[ints.length - 1]), tag: 'min_max_swap' },
        ], () => num(ans + r.int(-4, 4)));
        return {
          kz: `${I.map(T).join(', ')} сан аралықтарының қиылысуындағы ең ${wantMax ? 'үлкен' : 'кіші'} бүтін санды табыңыз.`,
          ru: `Найдите ${wantMax ? 'наибольшее' : 'наименьшее'} целое число, принадлежащее пересечению промежутков ${I.map(T).join(', ')}.`,
          choices, answer,
          sol: {
            kz: `Қиылысу — үш аралыққа да кіретін сандар: сол шегі ең үлкен сол шек, оң шегі ең кіші оң шек. Жақша «( )» болса, шеткі сан кірмейді. Қиылысудағы бүтін сандар: ${ints.map(num).join(', ')}. Жауабы: ${num(ans)}.`,
            ru: `Пересечение — числа, входящие во все три промежутка: левый край — наибольший из левых, правый — наименьший из правых. Круглая скобка не включает край. Целые в пересечении: ${ints.map(num).join(', ')}. Ответ: ${num(ans)}.`,
          },
        };
      }
    },
  },

  {
    id: 'logic.who_in_which_class',
    examType: 'logic', skills: ['logic.deduction'], from: ['daryn2023-35'], difficulty: 2,
    title: { kz: 'Кім нешінші сыныпта', ru: 'Кто в каком классе' },
    gen(r) {
      const names = r.shuffle(['Айжан', 'Балжан', 'Айнұр', 'Аружан', 'Дана', 'Мадина']).slice(0, 4);
      const perm = r.shuffle([1, 2, 3, 4]); // perm[i] — класс ученицы i
      const all = permsOf([1, 2, 3, 4]);
      const pool = [];
      names.forEach((n, i) => {
        pool.push({ kz: `${n} ${perm[i]}-сыныпта оқиды`, ru: `${n} учится в ${perm[i]}-м классе`, ok: p => p[i] === perm[i] });
        const not = [1, 2, 3, 4].filter(c => c !== perm[i]);
        const [x, y] = r.shuffle(not);
        pool.push({ kz: `${n} ${x}-сыныпта да, ${y}-сыныпта да оқымайды`, ru: `${n} не учится ни в ${x}-м, ни в ${y}-м классе`, ok: p => p[i] !== x && p[i] !== y });
        if (perm[i] !== 1) pool.push({ kz: `${n} ең кішісі емес`, ru: `${n} не самая младшая`, ok: p => p[i] !== 1 });
        if (perm[i] !== 4) pool.push({ kz: `${n} ең үлкені емес`, ru: `${n} не самая старшая`, ok: p => p[i] !== 4 });
      });
      const target = r.int(0, 3);
      for (let tries = 0; tries < 200; tries++) {
        const clues = r.shuffle(pool).slice(0, 3).filter(c => !c.kz.startsWith(names[target] + ' '));
        if (clues.length < 3) continue;
        const sols = all.filter(p => clues.every(c => c.ok(p)));
        const vals = new Set(sols.map(p => p[target]));
        if (vals.size !== 1) continue;
        const ans = perm[target];
        const opts = [1, 2, 3, 4].map(c => ({ v: `${c}` }));
        const correct = `${ans}`;
        const ch = r.shuffle([1, 2, 3, 4]).map(c => ({ text: `${c}-сынып / ${c}-й класс`, tag: c === ans ? 'correct' : 'wrong_deduction' }));
        ch.push({ text: 'анықтау мүмкін емес / определить невозможно', tag: 'gave_up' });
        return {
          kz: `Кезекте 1-, 2-, 3- және 4-сынып оқушылары тұр (әр сыныптан бір оқушы): ${names.join(', ')}. ${clues.map(c => c.kz).join('; ')}. ${names[target]} нешінші сыныпта оқиды?`,
          ru: `В очереди стоят ученицы 1-го, 2-го, 3-го и 4-го классов (по одной из каждого): ${names.join(', ')}. ${clues.map(c => c.ru).join('; ')}. В каком классе учится ${names[target]}?`,
          choices: ch.map(c => ({ text: c.text, tag: c.tag })), answer: ch.findIndex(c => c.tag === 'correct'),
          sol: {
            kz: sols.length === 1
              ? `Кесте сызып (аттар × сыныптар), әр шарт бойынша мүмкін емес ұяшықтарды сызамыз. Жалғыз нұсқа қалады: ${names.map((n, i) => `${n} — ${perm[i]}`).join(', ')}. ${names[target]} — ${ans}-сыныпта.`
              : `Кесте сызып (аттар × сыныптар), әр шарт бойынша мүмкін емес ұяшықтарды сызамыз. Қалғандардың орны толық анықталмайды, бірақ шарттарға сай келетін барлық нұсқада ${names[target]} — ${ans}-сыныпта.`,
            ru: sols.length === 1
              ? `Рисуем таблицу (имена × классы) и по каждому условию вычёркиваем невозможные клетки. Остаётся один вариант: ${names.map((n, i) => `${n} — ${perm[i]}`).join(', ')}. ${names[target]} — в ${ans}-м классе.`
              : `Рисуем таблицу (имена × классы) и вычёркиваем невозможные клетки. Остальных однозначно не расставить, но во всех подходящих вариантах ${names[target]} — в ${ans}-м классе.`,
          },
          _unique: sols.length === 1 ? 'full' : 'target',
        };
      }
      return this.gen(r);
    },
  },
];

function gcdI(a, b) { while (b) [a, b] = [b, a % b]; return a; }
function digits(P) { let d = 0; for (let i = 1; i <= P; i++) d += String(i).length; return d; }
function sup(k) { return String(k).split('').map(c => '⁰¹²³⁴⁵⁶⁷⁸⁹'[+c]).join(''); }
function permsOf(a) { if (a.length <= 1) return [a]; return a.flatMap((x, i) => permsOf([...a.slice(0, i), ...a.slice(i + 1)]).map(p => [x, ...p])); }
