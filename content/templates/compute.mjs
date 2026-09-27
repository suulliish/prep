// Вычисления: дроби, десятичные, модуль, упрощение одночленов.
import { Q, num, frac, mixed, nice, choices5, near, abl } from './lib.mjs';

export default [
  {
    id: 'compute.signed_mixed_product',
    examType: 'compute', skills: ['rational.mul', 'frac.mixed', 'dec.mul'], from: ['daryn2023-02'], difficulty: 2,
    title: { kz: 'Аралас сан, бүтін сан және ондық бөлшектің көбейтіндісі', ru: 'Произведение смешанного числа, целого и десятичной дроби' },
    gen(r) {
      for (;;) {
        const den = r.pick([2, 4, 5, 8]), w = r.int(1, 6), p = r.int(1, den - 1);
        const m = new Q(-(w * den + p), den);            // −w p/den
        const k = r.int(2, 6) * (r.chance(0.7) ? -1 : 1);
        const dec = new Q(r.int(2, 96) * 2, 100);        // 0,04 … 1,92
        const ans = m.mul(k).mul(dec);
        if (!ans.isFiniteDecimal() || Math.abs(ans) > 200) continue;
        const exprTxt = `(${mixed(m)}) · (${num(k)}) · ${num(dec)}`;
        const noWhole = new Q(-p, den).mul(k).mul(dec);
        const { choices, answer } = choices5(r, num(ans), [
          { v: num(ans.neg()), tag: 'sign' },
          { v: num(noWhole), tag: 'lost_whole_part' },
          { v: num(ans.mul(10)), tag: 'decimal_shift' },
          { v: num(ans.div(10)), tag: 'decimal_shift' },
        ], () => num(Q.of(near(r, +ans, 0.4, 0.01))));
        return {
          kz: `Есептеңіз:\n${exprTxt}`,
          ru: `Вычислите:\n${exprTxt}`,
          choices, answer,
          sol: {
            kz: `${mixed(m)} = ${frac(m)}. Таңбаны бөлек анықтаймыз: теріс көбейткіштер саны ${k < 0 ? 'жұп — нәтиже оң' : 'тақ — нәтиже теріс'}. ${frac(m.abs())} · ${Math.abs(k)} · ${num(dec)} = ${num(ans.abs())}. Жауабы: ${num(ans)}.`,
            ru: `${mixed(m)} = ${frac(m)}. Знак отдельно: отрицательных множителей ${k < 0 ? 'чётное число — результат положительный' : 'нечётное число — результат отрицательный'}. ${frac(m.abs())} · ${Math.abs(k)} · ${num(dec)} = ${num(ans.abs())}. Ответ: ${num(ans)}.`,
          },
        };
      }
    },
  },

  {
    id: 'compute.continued_fraction',
    examType: 'compute', skills: ['frac.ops', 'frac.mixed'], from: ['daryn2023-07'], difficulty: 3,
    title: { kz: 'Көп қабатты бөлшек', ru: 'Многоэтажная (цепная) дробь' },
    gen(r) {
      const a = r.int(1, 2), b = r.int(2, 3), c = r.int(2, 3), d = r.int(3, 6), e = r.int(2, 3);
      // a + 1/(b + 1/(c + 1/(d − 1/e)))
      const inner = new Q(d).sub(new Q(1, e));
      const l2 = new Q(c).add(new Q(1).div(inner));
      const l1 = new Q(b).add(new Q(1).div(l2));
      const ans = new Q(a).add(new Q(1).div(l1));
      const plusVariant = (() => { const i = new Q(d).add(new Q(1, e)); const x = new Q(c).add(new Q(1).div(i)); const y = new Q(b).add(new Q(1).div(x)); return new Q(a).add(new Q(1).div(y)); })();
      const { choices, answer } = choices5(r, mixed(ans), [
        { v: mixed(ans.sub(a)), tag: 'forgot_whole_part' },
        { v: mixed(new Q(1).div(ans.sub(a)).add(a)), tag: 'flipped' },
        { v: mixed(plusVariant), tag: 'sign_inside' },
        { v: mixed(new Q(ans.n + ans.d, ans.d + 12)), tag: 'random' },
      ], () => mixed(new Q(r.int(20, 140), r.int(13, 70))));
      const txt = `${a} + 1 / (${b} + 1 / (${c} + 1 / (${d} − 1/${e})))`;
      return {
        kz: `Өрнектің мәнін табыңыз:\n${txt}`,
        ru: `Найдите значение выражения:\n${txt}`,
        choices, answer,
        sol: {
          kz: `Ең ішкі қабаттан бастаймыз: ${d} − 1/${e} = ${frac(inner)}. Сосын ${c} + ${frac(new Q(1).div(inner))} = ${frac(l2)}. Сосын ${b} + ${frac(new Q(1).div(l2))} = ${frac(l1)}. Соңында ${a} + ${frac(new Q(1).div(l1))} = ${mixed(ans)}.`,
          ru: `Начинаем с самого нижнего этажа: ${d} − 1/${e} = ${frac(inner)}. Затем ${c} + ${frac(new Q(1).div(inner))} = ${frac(l2)}. Затем ${b} + ${frac(new Q(1).div(l2))} = ${frac(l1)}. В конце ${a} + ${frac(new Q(1).div(l1))} = ${mixed(ans)}.`,
        },
      };
    },
  },

  {
    id: 'compute.abs_product',
    examType: 'compute', skills: ['rational.abs', 'dec.mul'], from: ['daryn2023-08'], difficulty: 2,
    title: { kz: 'Модульдері бар көбейтінді', ru: 'Произведение с модулями' },
    gen(r) {
      for (;;) {
        const a = -r.pick([2, 4, 5, 8, 10, 20]), b = new Q(r.pick([1, 2, 5]), 10);
        const c = Q.of(r.int(11, 95) / 10).neg(), d = Q.of(r.pick([0.5, 1.5, 2.5, 0.2, 1.2, 0.4, 3.5])).neg();
        const ans = new Q(Math.abs(a)).mul(b).mul(c).mul(d.abs());
        if (!ans.isFiniteDecimal()) continue;
        const raw = new Q(a).mul(b).mul(c).mul(d); // забыл про модули
        const txt = `|${num(a)}| · ${num(b)} · (${num(c)}) · |${num(d)}|`;
        const { choices, answer } = choices5(r, num(ans), [
          { v: num(raw), tag: 'ignored_abs' },
          { v: num(ans.neg()), tag: 'sign' },
          { v: num(ans.mul(5)), tag: 'decimal_shift' },
          { v: num(ans.div(10)), tag: 'decimal_shift' },
        ], () => num(Q.of(near(r, +ans, 0.4, 0.1))));
        return {
          kz: `Есептеңіз:\n${txt}`, ru: `Вычислите:\n${txt}`, choices, answer,
          sol: {
            kz: `Модуль — санның минусыз мәні: |${num(a)}| = ${num(-a)}, |${num(d)}| = ${num(d.abs())}. Модульсіз қалған теріс сан жалғыз (${num(c)}), сондықтан нәтиже теріс: ${num(ans)}.`,
            ru: `Модуль — число без минуса: |${num(a)}| = ${num(-a)}, |${num(d)}| = ${num(d.abs())}. Отрицательный множитель без модуля один (${num(c)}), поэтому результат отрицательный: ${num(ans)}.`,
          },
        };
      }
    },
  },

  {
    id: 'compute.monomial_fraction',
    examType: 'compute', skills: ['power.basic', 'frac.reduce', 'expr.simplify'], from: ['daryn2023-14'], difficulty: 3,
    title: { kz: 'Дәрежелері бар бөлшекті қысқарту', ru: 'Сокращение дроби со степенями' },
    gen(r) {
      for (;;) {
        const p = r.pick([6, 10, 12, 15, 18, 20]), s = r.pick([24, 30, 40, 60, 80]);
        const m = r.pick([2, 3]), q = r.pick([2, 3]), k = r.int(2, 5);
        if (m === q) continue;
        const ans = new Q(p * q * q, s);          // p·m²·q³ / (s·m²·q) = p·q²/s
        if (!ans.isFiniteDecimal()) continue;
        const txt = `(${p}a${sup(k)} · (${m}b)² · ${q}³) / (${s} · ${m}² · a${sup(k)} · ${q}b²)`;
        const { choices, answer } = choices5(r, num(ans), [
          { v: num(ans.div(m)), tag: 'forgot_square_bracket' },
          { v: num(new Q(p * q, s)), tag: 'power_cancel' },
          { v: num(ans.mul(2)), tag: 'arith' },
          { v: num(ans.div(2)) + 'a', tag: 'variable_left' },
        ], () => num(Q.of(near(r, +ans, 0.5, 0.125))));
        return {
          kz: `Бөлшекті қысқартыңыз:\n${txt}`, ru: `Сократите дробь:\n${txt}`, choices, answer,
          sol: {
            kz: `a${sup(k)} және b² қысқарады. (${m}b)² = ${m * m}b², ол ${m}² = ${m * m} санымен қысқарады. ${q}³ / ${q} = ${q * q}. Қалады: ${p} · ${q * q} / ${s} = ${num(ans)}.`,
            ru: `a${sup(k)} и b² сокращаются. (${m}b)² = ${m * m}b², сокращается с ${m}² = ${m * m}. ${q}³ / ${q} = ${q * q}. Остаётся: ${p} · ${q * q} / ${s} = ${num(ans)}.`,
          },
        };
      }
    },
  },

  {
    id: 'compute.factor_substitute',
    examType: 'equations', skills: ['expr.factor', 'expr.substitute'], from: ['daryn2023-15'], difficulty: 2,
    title: { kz: 'Ортақ көбейткішті шығарып, мәнін табу', ru: 'Вынести общий множитель и подставить' },
    gen(r) {
      for (;;) {
        const c = r.int(2, 3), k = r.int(2, 6), L = r.pick([12, 18, 24, 30, 36, 40, 45, 60]);
        const val = new Q(r.int(1, 19), r.pick([2, 4, 5, 10]));
        const ans = val.mul(k).div(L);
        if (!ans.isFiniteDecimal() || ans.eq(0)) continue;
        const cond = `m + ${c}n = ${frac(val)}`;
        const expr = `(${k}m + ${k * c}n) / ${L}`;
        const { choices, answer } = choices5(r, num(ans), [
          { v: num(val.div(L)), tag: 'forgot_factor' },
          { v: num(val.mul(k)), tag: 'forgot_denominator' },
          { v: num(val.mul(k * c).div(L)), tag: 'wrong_factor' },
          { v: num(val), tag: 'copied_condition' },
        ], () => num(Q.of(near(r, +ans, 0.5, 0.05))));
        return {
          kz: `${cond} екені белгілі болса, ${expr} өрнегінің мәнін табыңыз.`,
          ru: `Найдите значение выражения ${expr}, если известно, что ${cond}.`,
          choices, answer,
          sol: {
            kz: `Алымда ${k}-ні жақша сыртына шығарамыз: ${k}m + ${k * c}n = ${k}(m + ${c}n) = ${k} · ${frac(val)} = ${nice(val.mul(k))}. Онда ${nice(val.mul(k))} / ${L} = ${num(ans)}.`,
            ru: `В числителе выносим ${k}: ${k}m + ${k * c}n = ${k}(m + ${c}n) = ${k} · ${frac(val)} = ${nice(val.mul(k))}. Тогда ${nice(val.mul(k))} / ${L} = ${num(ans)}.`,
          },
        };
      }
    },
  },

  {
    id: 'compute.decimal_from_digits',
    examType: 'compute', skills: ['dec.place_value', 'dec.compare'], from: ['daryn2023-27'], difficulty: 3,
    title: { kz: 'Берілген цифрлардан ондық бөлшек құрау', ru: 'Составить десятичные дроби из цифр' },
    gen(r) {
      for (;;) {
        const ds = r.shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]).slice(0, 3).sort();
        const limit = r.pick([10, 100]);
        const all = [];
        for (const p of perms(ds)) for (const cut of [1, 2]) {
          const s = p.slice(0, cut).join('') + '.' + p.slice(cut).join('');
          all.push(Q.of(+s));
        }
        const ok = all.filter(x => +x <= limit);
        const max = ok.reduce((a, b) => (b > a ? b : a)), min = ok.reduce((a, b) => (b < a ? b : a));
        const ans = max.sub(min);
        const maxAll = all.reduce((a, b) => (b > a ? b : a));
        const second = ok.filter(x => !x.eq(min)).reduce((a, b) => (b < a ? b : a));
        const { choices, answer } = choices5(r, num(ans), [
          { v: num(maxAll.sub(min)), tag: 'ignored_limit' },
          { v: num(max.sub(second)), tag: 'wrong_min' },
          { v: num(max.add(min)), tag: 'sum_not_diff' },
          { v: num(ans.div(10)), tag: 'decimal_shift' },
        ], () => num(Q.of(near(r, +ans, 0.3, 0.01))));
        const dl = ds.join(', ');
        return {
          kz: `${dl} цифрларын және үтірді бір реттен пайдаланып жазуға болатын ${abl(limit)} аспайтын ең үлкен және ең кіші ондық бөлшектердің айырмасын табыңыз.`,
          ru: `Найдите разность наибольшей и наименьшей десятичных дробей, которые не больше ${limit} и которые можно записать с помощью цифр ${dl} и одной запятой (каждую цифру по одному разу).`,
          choices, answer,
          sol: {
            kz: `${abl(limit)} аспайтын ең үлкені: ${num(max)}. Ең кішісі: ${num(min)} (кіші цифрлар алдыда, үтір бірінші цифрдан кейін). Айырмасы: ${num(max)} − ${num(min)} = ${num(ans)}.`,
            ru: `Наибольшая, не больше ${limit}: ${num(max)}. Наименьшая: ${num(min)} (меньшие цифры впереди, запятая после первой цифры). Разность: ${num(max)} − ${num(min)} = ${num(ans)}.`,
          },
        };
      }
    },
  },
];

function sup(k) { return String(k).split('').map(c => '⁰¹²³⁴⁵⁶⁷⁸⁹'[+c]).join(''); }
function* perms(a) { if (a.length <= 1) { yield a; return; } for (let i = 0; i < a.length; i++) for (const p of perms([...a.slice(0, i), ...a.slice(i + 1)])) yield [a[i], ...p]; }
