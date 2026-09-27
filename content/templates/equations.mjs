// Уравнения, выражения, модуль, системы, «составь уравнение».
import { Q, num, frac, nice, choices5, near, dat, genKz, andKz } from './lib.mjs';

export default [
  {
    id: 'eq.one_step_negative',
    examType: 'equations', skills: ['eq.linear.one_step', 'rational.add'], from: ['daryn2023-03'], difficulty: 1,
    title: { kz: 'Теріс сандары бар қарапайым теңдеу', ru: 'Простое уравнение с отрицательными числами' },
    gen(r) {
      const a = Q.of(r.int(105, 899) / 10), b = Q.of(r.int(-400, 400) / 10);
      const v = r.pick(['m', 'x', 'y', 'k']);
      const ans = b.sub(a);                 // v − (−a) = b  →  v = b − a
      const { choices, answer } = choices5(r, num(ans), [
        { v: num(b.add(a)), tag: 'double_minus' },
        { v: num(ans.neg()), tag: 'sign' },
        { v: num(b), tag: 'copied' },
        { v: num(b.add(a).neg()), tag: 'sign' },
      ], () => num(Q.of(near(r, +ans, 0.3, 0.1))));
      const txt = `${v} − (−${num(a)}) = ${num(b)}`;
      return {
        kz: `Теңдеуді шешіңіз:\n${txt}`, ru: `Решите уравнение:\n${txt}`, choices, answer,
        sol: {
          kz: `«Минус минус» — плюс: ${v} + ${num(a)} = ${num(b)}. Онда ${v} = ${num(b)} − ${num(a)} = ${num(ans)}.`,
          ru: `«Минус на минус» — плюс: ${v} + ${num(a)} = ${num(b)}. Тогда ${v} = ${num(b)} − ${num(a)} = ${num(ans)}.`,
        },
      };
    },
  },

  {
    id: 'eq.proportion_linear',
    examType: 'proportion', skills: ['proportion.solve', 'frac.reduce', 'eq.linear'], from: ['daryn2023-05'], difficulty: 2,
    title: { kz: 'Пропорцияның белгісіз мүшесі (сызықтық)', ru: 'Неизвестный член пропорции (линейный)' },
    gen(r) {
      for (;;) {
        const c = r.pick([5, 6, 7, 8, 9, 11, 12]), k = r.int(2, 4), x = -r.int(1, 3);
        const u = c + k * x;
        if (u < 1 || u >= c || new Q(u, c).d !== c) continue;
        const m = r.int(3, 9);
        const left = `${u * m}/${c * m}`;
        const { choices, answer } = choices5(r, num(x), [
          { v: num(-x), tag: 'sign' },
          { v: num(new Q(u, k)), tag: 'forgot_constant' },
          { v: num(x - 1), tag: 'arith' },
          { v: num(new Q(c - u, 1)), tag: 'arith' },
        ], () => num(r.int(-6, 6)));
        return {
          kz: `Пропорцияның белгісіз мүшесін табыңыз:\n${left} = (${c} + ${k}x) / ${c}`,
          ru: `Найдите неизвестный член пропорции:\n${left} = (${c} + ${k}x) / ${c}`,
          choices, answer,
          sol: {
            kz: `${left} бөлшегін қысқартамыз: ${u}/${c}. Бөлімдері тең болғандықтан, алымдары тең: ${c} + ${k}x = ${u}. ${k}x = ${num(u - c)}, x = ${num(x)}.`,
            ru: `Сократим ${left}: получится ${u}/${c}. Знаменатели равны, значит равны числители: ${c} + ${k}x = ${u}. ${k}x = ${num(u - c)}, x = ${num(x)}.`,
          },
        };
      }
    },
  },

  {
    id: 'eq.collect_like_terms',
    examType: 'equations', skills: ['expr.brackets', 'expr.like_terms'], from: ['daryn2023-06'], difficulty: 2,
    title: { kz: 'Жақшаларды ашып, ұқсас мүшелерді біріктіру', ru: 'Раскрыть скобки и привести подобные' },
    gen(r) {
      const v = r.pick(['z', 'x', 'y', 'a']);
      const a = r.int(1, 9), b = r.int(2, 9), c = r.int(2, 9), d = r.int(2, 9), e = r.int(2, 9), f = r.int(2, 9), g = r.int(1, 9), h = r.int(2, 9);
      // a − b v + (−c + d v) − (e + f v) + (g − h v)
      const coef = -b + d - f - h, cons = a - c - e + g;
      const fmt = (k, s) => lin(k, s, v);
      const txt = `${a} − ${b}${v} + (−${c} + ${d}${v}) − (${e} + ${f}${v}) + (${g} − ${h}${v})`;
      const { choices, answer } = choices5(r, fmt(coef, cons), [
        { v: fmt(coef + 2 * f, cons + 2 * e), tag: 'minus_before_bracket' },
        { v: fmt(-coef, -cons), tag: 'sign' },
        { v: fmt(coef, -cons), tag: 'sign' },
        { v: num(cons), tag: 'lost_variable' },
      ], () => fmt(coef + r.int(-3, 3), cons + r.int(-3, 3)));
      return {
        kz: `Ықшамдаңыз:\n${txt}`, ru: `Упростите:\n${txt}`, choices, answer,
        sol: {
          kz: `Жақша алдында минус болса, ішіндегі таңбалар өзгереді: −(${e} + ${f}${v}) = −${e} − ${f}${v}. ${v} бар мүшелер: −${b} + ${d} − ${f} − ${h} = ${num(coef)}. Сандар: ${a} − ${c} − ${e} + ${g} = ${num(cons)}. Жауабы: ${fmt(coef, cons)}.`,
          ru: `Минус перед скобкой меняет знаки внутри: −(${e} + ${f}${v}) = −${e} − ${f}${v}. Члены с ${v}: −${b} + ${d} − ${f} − ${h} = ${num(coef)}. Числа: ${a} − ${c} − ${e} + ${g} = ${num(cons)}. Ответ: ${fmt(coef, cons)}.`,
        },
      };
    },
  },

  {
    id: 'eq.abs_linear_sum_roots',
    examType: 'equations', skills: ['abs.equation', 'eq.linear'], from: ['daryn2023-11'], difficulty: 3,
    title: { kz: 'Модулі бар теңдеу: түбірлердің қосындысы', ru: 'Уравнение с модулем: сумма корней' },
    gen(r) {
      for (;;) {
        const a = r.pick([2, 4, 5]), b = r.int(-9, 9), N = r.int(3, 20);
        if (b === 0) continue;
        const [k, mm] = r.pick([[new Q(1, 2), 2], [new Q(1, 4), 4], [new Q(1), 1], [new Q(1, 5), 5]]);
        const c = r.int(2, 12), d = N - c;
        const x1 = new Q(N - b, a), x2 = new Q(-N - b, a), sum = x1.add(x2);
        const lhs = `${num(k)} · |${a}x ${b > 0 ? '+' : '−'} ${Math.abs(b)}| · ${mm} − ${c} = ${num(d)}`;
        const { choices, answer } = choices5(r, num(sum), [
          { v: num(x1), tag: 'one_root' },
          { v: num(x2), tag: 'one_root' },
          { v: num(new Q(2 * N, a)), tag: 'wrong_sum' },
          { v: num(sum.neg()), tag: 'sign' },
        ], () => num(Q.of(near(r, +sum, 0.5, 0.2))));
        return {
          kz: `Теңдеуді шешіп, түбірлерінің қосындысын табыңыз:\n${lhs}`,
          ru: `Решите уравнение и найдите сумму корней:\n${lhs}`,
          choices, answer,
          sol: {
            kz: `${num(k)} · ${mm} = 1, сондықтан |${a}x ${b > 0 ? '+' : '−'} ${Math.abs(b)}| = ${num(d)} + ${c} = ${N}. Екі жағдай: ${a}x ${b > 0 ? '+' : '−'} ${Math.abs(b)} = ${N} → x = ${num(x1)}; ${a}x ${b > 0 ? '+' : '−'} ${Math.abs(b)} = −${N} → x = ${num(x2)}. Қосындысы: ${num(sum)}.`,
            ru: `${num(k)} · ${mm} = 1, поэтому |${a}x ${b > 0 ? '+' : '−'} ${Math.abs(b)}| = ${num(d)} + ${c} = ${N}. Два случая: ${a}x ${b > 0 ? '+' : '−'} ${Math.abs(b)} = ${N} → x = ${num(x1)}; ${a}x ${b > 0 ? '+' : '−'} ${Math.abs(b)} = −${N} → x = ${num(x2)}. Сумма: ${num(sum)}.`,
          },
        };
      }
    },
  },

  {
    id: 'eq.surplus_shortage',
    examType: 'word', skills: ['eq.compose', 'word.distribution'], from: ['daryn2023-25'], difficulty: 2,
    title: { kz: 'Бөлу: артық қалады / жетпейді', ru: 'Раздача: остаётся лишнее / не хватает' },
    gen(r) {
      const p = r.int(2, 6), dp = r.pick([1, 1, 2]), q = p + dp;
      const kids = r.int(5, 14);
      const s = r.int(2, 9), t = kids * dp - s;
      if (t < 1) return this.gen(r);
      const total = p * kids + s;
      const item = r.pick([{ kz: 'өрік', abl: 'өріктен', ru: 'абрикосы', ruG: 'абрикосов' }, { kz: 'алма', abl: 'алмадан', ru: 'яблоки', ruG: 'яблок' }, { kz: 'кәмпит', abl: 'кәмпиттен', ru: 'конфеты', ruG: 'конфет' }, { kz: 'қарындаш', abl: 'қарындаштан', ru: 'карандаши', ruG: 'карандашей' }]);
      const { choices, answer } = choices5(r, num(total), [
        { v: num(kids), tag: 'answered_kids' },
        { v: num(q * kids), tag: 'wrong_side' },
        { v: num(total + s), tag: 'arith' },
        { v: num(s + t), tag: 'arith' },
      ], () => num(near(r, total, 0.3, 1)));
      return {
        kz: `Әр балаға ${p} ${item.abl} берсе, ${s} ${item.kz} артық қалады. Егер ${q} ${item.abl} берсе, ${t} ${item.kz} жетпейді. Барлығы неше ${item.kz} бар?`,
        ru: `Если раздать детям ${item.ru} по ${p} штуки каждому, то ${s} шт. останутся лишними. Если по ${q} шт., то не хватит ${t} шт. Сколько всего было ${item.ruG}?`,
        choices, answer,
        sol: {
          kz: `Балалар санын x деп алайық: ${p}x + ${s} = ${q}x − ${t}. ${dp === 1 ? `x = ${s} + ${t} = ${kids}` : `${dp}x = ${s} + ${t} = ${s + t}, x = ${kids}`}. Барлығы: ${p} · ${kids} + ${s} = ${total}.`,
          ru: `Пусть детей x: ${p}x + ${s} = ${q}x − ${t}. ${dp === 1 ? `x = ${s} + ${t} = ${kids}` : `${dp}x = ${s} + ${t} = ${s + t}, x = ${kids}`}. Всего: ${p} · ${kids} + ${s} = ${total}.`,
        },
      };
    },
  },

  {
    id: 'eq.digit_move',
    examType: 'equations', skills: ['number.place_value', 'eq.compose'], from: ['daryn2023-26'], difficulty: 3,
    title: { kz: 'Цифрды орнынан жылжыту', ru: 'Перенос цифры в числе' },
    gen(r) {
      for (;;) {
        const a = r.int(2, 9), b = r.int(0, 9), c = r.int(1, a - 1);
        const N = 100 * a + 10 * b + c, M = 100 * c + 10 * a + b, D = N - M;
        if (D <= 0) continue;
        const others = [];
        for (let aa = 1; aa <= 9; aa++) for (let bb = 0; bb <= 9; bb++) { const n = 100 * aa + 10 * bb + c; if (n !== N) others.push(n); }
        const { choices, answer } = choices5(r, num(N), [
          { v: num(M), tag: 'answered_new_number' },
          { v: num(100 * b + 10 * a + c), tag: 'swapped_digits' },
          { v: num(r.pick(others)), tag: 'random' },
          { v: num(r.pick(others)), tag: 'random' },
        ], () => num(r.pick(others)));
        return {
          kz: `Үш таңбалы сан ${c} цифрына аяқталады. Егер осы санның соңғы цифрын санның басына апарып қойсақ, пайда болған сан алғашқы саннан ${dat(D)} кіші болады. Үш таңбалы санды табыңыз.`,
          ru: `Трёхзначное число оканчивается на ${c}. Если перенести последнюю цифру в начало, получится число на ${D} меньше исходного. Найдите исходное число.`,
          choices, answer,
          sol: {
            kz: `Сан 100a + 10b + ${c}, жаңа сан ${c * 100} + 10a + b. Айырмасы: 90a + 9b − ${c * 99} = ${D}, яғни 10a + b = ${(D + 99 * c) / 9}. Сан: ${N}. Тексеру: ${N} − ${M} = ${D}.`,
            ru: `Число 100a + 10b + ${c}, новое ${c * 100} + 10a + b. Разность: 90a + 9b − ${c * 99} = ${D}, то есть 10a + b = ${(D + 99 * c) / 9}. Число: ${N}. Проверка: ${N} − ${M} = ${D}.`,
          },
        };
      }
    },
  },

  {
    id: 'eq.three_shelves',
    examType: 'word', skills: ['eq.compose'], from: ['daryn2023-45'], difficulty: 2,
    title: { kz: 'Үш сөредегі кітаптар', ru: 'Книги на трёх полках' },
    gen(r) {
      const m = r.int(8, 30), p = r.int(2, 7), q = r.int(1, 6);
      const top = m + p, bottom = m - q, S = top + m + bottom;
      const askTop = r.chance(0.6);
      const ans = askTop ? top : bottom;
      const { choices, answer } = choices5(r, num(ans), [
        { v: num(m), tag: 'answered_middle' },
        { v: num(askTop ? bottom : top), tag: 'other_shelf' },
        { v: num(askTop ? m - p : m + q), tag: 'sign' },
        { v: num(Math.round(S / 3)), tag: 'average' },
      ], () => num(near(r, ans, 0.3, 1)));
      return {
        kz: `Үш сөреде ${S} кітап бар. Ортаңғы сөреде жоғарғы сөреге қарағанда ${p} кітапқа кем және төменгі сөреге қарағанда ${q} кітапқа артық. ${askTop ? 'Жоғарғы' : 'Төменгі'} сөреде қанша кітап бар?`,
        ru: `На трёх полках ${S} книг. На средней полке на ${p} книг меньше, чем на верхней, но на ${q} больше, чем на нижней. Сколько книг на ${askTop ? 'верхней' : 'нижней'} полке?`,
        choices, answer,
        sol: {
          kz: `Ортаңғы сөреде x кітап. Жоғарғыда x + ${p}, төменгіде x − ${q}. 3x ${p - q >= 0 ? '+' : '−'} ${Math.abs(p - q)} = ${S}, x = ${m}. ${askTop ? 'Жоғарғыда' : 'Төменгіде'}: ${ans}.`,
          ru: `На средней x книг. На верхней x + ${p}, на нижней x − ${q}. 3x ${p - q >= 0 ? '+' : '−'} ${Math.abs(p - q)} = ${S}, x = ${m}. На ${askTop ? 'верхней' : 'нижней'}: ${ans}.`,
        },
      };
    },
  },

  {
    id: 'eq.append_digit',
    examType: 'equations', skills: ['number.place_value', 'eq.compose'], from: ['daryn2023-46'], difficulty: 3,
    title: { kz: 'Санның оң жағына цифр тіркеу', ru: 'Приписать цифру справа' },
    gen(r) {
      const N = r.int(12, 89), dg = r.int(1, 9), k = r.int(2, 5);
      const S = 10 * N + dg + k * N;
      const kTxt = { 2: 'екі еселеп', 3: 'үш еселеп', 4: 'төрт еселеп', 5: 'бес еселеп' }[k];
      const kRu = { 2: 'удвоенное', 3: 'утроенное', 4: 'учетверённое', 5: 'упятерённое' }[k];
      const { choices, answer } = choices5(r, num(N), [
        { v: num(Math.round((S - dg) / 10)), tag: 'forgot_added_part' },
        { v: num(N + 2), tag: 'arith' },
        { v: num(N - 4), tag: 'arith' },
        { v: num(Math.round(S / (k + 1))), tag: 'wrong_model' },
      ], () => num(near(r, N, 0.2, 1)));
      return {
        kz: `Ойлаған санның оң жағына ${dg} цифрын тіркеп жазып, шыққан санға алғашқы санды ${kTxt} қоссақ, ${S} шығады. Ойлаған санды табыңыз.`,
        ru: `Если справа от задуманного числа приписать цифру ${dg}, а затем прибавить ${kRu} задуманное число, получится ${S}. Найдите задуманное число.`,
        choices, answer,
        sol: {
          kz: `Санның оң жағына цифр тіркеу — 10-ға көбейтіп, цифрды қосу: 10x + ${dg}. Теңдеу: 10x + ${dg} + ${k}x = ${S}, ${10 + k}x = ${S - dg}, x = ${N}.`,
          ru: `Приписать цифру справа — умножить на 10 и прибавить цифру: 10x + ${dg}. Уравнение: 10x + ${dg} + ${k}x = ${S}, ${10 + k}x = ${S - dg}, x = ${N}.`,
        },
      };
    },
  },

  {
    id: 'eq.pair_sums',
    examType: 'equations', skills: ['eq.system.sum_trick'], from: ['daryn2023-47'], difficulty: 2,
    title: { kz: 'Жұптардың қосындылары', ru: 'Суммы по парам' },
    gen(r) {
      const [n1, n2, n3] = r.shuffle(['Марат', 'Самат', 'Қанат', 'Ерлан', 'Дәурен']).slice(0, 3);
      const A = r.int(30, 60), B = r.int(30, 60), C = r.int(30, 60);
      const s1 = A + B, s2 = B + C, s3 = A + C;
      const { choices, answer } = choices5(r, num(B), [
        { v: num(A), tag: 'other_person' },
        { v: num(C), tag: 'other_person' },
        { v: num(Math.round((s1 + s2 + s3) / 3)), tag: 'wrong_model' },
        { v: num((s1 + s2 + s3) / 2), tag: 'total_not_person' },
      ], () => num(near(r, B, 0.2, 1)));
      return {
        kz: `${andKz(n1)} ${genKz(n2)} салмағын қосқанда ${s1} кг, ${andKz(n2)} ${genKz(n3)} салмағын қосқанда ${s2} кг, ${andKz(n1)} ${genKz(n3)} салмағын қосқанда ${s3} кг. ${genKz(n2)} салмағы қанша килограмм?`,
        ru: `${n1} и ${n2} вместе весят ${s1} кг, ${n2} и ${n3} — ${s2} кг, ${n1} и ${n3} — ${s3} кг. Сколько килограммов весит ${n2}?`,
        choices, answer,
        sol: {
          kz: `Үш қосындыны қоссақ, әр адам екі рет кіреді: 2 · (барлығы) = ${s1 + s2 + s3}, барлығы = ${(s1 + s2 + s3) / 2}. ${n2} = ${(s1 + s2 + s3) / 2} − ${s3} = ${B} кг.`,
          ru: `Сложим три суммы — каждый входит дважды: 2 · (все) = ${s1 + s2 + s3}, все вместе = ${(s1 + s2 + s3) / 2}. ${n2} = ${(s1 + s2 + s3) / 2} − ${s3} = ${B} кг.`,
        },
      };
    },
  },

  {
    id: 'eq.system_fractions',
    examType: 'equations', skills: ['eq.system.2x2', 'frac.ops'], from: ['daryn2023-44'], difficulty: 3,
    title: { kz: 'Бөлшек коэффициентті теңдеулер жүйесі', ru: 'Система с дробными коэффициентами' },
    gen(r) {
      for (;;) {
        const x = r.int(-6, 8), y = r.int(-6, 8);
        if (x === 0 || y === 0 || x === y) continue;
        const c = () => { for (;;) { const q = new Q(r.int(1, 9) * (r.chance(0.8) ? 1 : -1), r.pick([2, 3, 4, 5, 6, 7, 12])); if (q.d > 1 || r.chance(0.25)) return q; } };
        const a1 = c(), b1 = c(), a2 = c(), b2 = c();
        const det = a1.mul(b2).sub(b1.mul(a2));
        if (det.eq(0)) continue;
        const e1 = a1.mul(x).add(b1.mul(y)), e2 = a2.mul(x).add(b2.mul(y));
        if (!e1.isInt() || !e2.isInt()) continue;
        const ask = r.pick(['x-y', 'x+y', 'xy']);
        const ans = ask === 'x-y' ? x - y : ask === 'x+y' ? x + y : x * y;
        const { choices, answer } = choices5(r, num(ans), [
          { v: num(ask === 'x-y' ? y - x : x - y), tag: 'wrong_combination' },
          { v: num(ask === 'x+y' ? x - y : x + y), tag: 'wrong_combination' },
          { v: num(x), tag: 'only_x' },
          { v: num(-ans), tag: 'sign' },
        ], () => num(ans + r.int(-5, 5)));
        const t = (a, v) => (a.n < 0 ? '−' : '') + (Math.abs(a.n) === 1 ? '' : Math.abs(a.n)) + v + (a.d === 1 ? '' : '/' + a.d);
        const eq1 = `${t(a1, 'x')} ${b1.n < 0 ? '−' : '+'} ${t(b1.abs(), 'y')} = ${num(e1)}`;
        const eq2 = `${t(a2, 'x')} ${b2.n < 0 ? '−' : '+'} ${t(b2.abs(), 'y')} = ${num(e2)}`;
        const askTxt = ask === 'x-y' ? '(x − y)' : ask === 'x+y' ? '(x + y)' : 'xy';
        return {
          kz: `Теңдеулер жүйесін шешіп, ${askTxt} өрнегінің мәнін табыңыз:\n{ ${eq1}\n{ ${eq2}`,
          ru: `Решите систему уравнений и найдите значение ${askTxt}:\n{ ${eq1}\n{ ${eq2}`,
          choices, answer,
          sol: {
            kz: `Әр теңдеуді бөлімдердің ортақ еселігіне көбейтіп, бөлшектерден құтыламыз. Сосын бір айнымалыны жоямыз (қосу немесе алмастыру тәсілі). Шешімі: x = ${num(x)}, y = ${num(y)}. Онда ${askTxt} = ${num(ans)}.`,
            ru: `Умножаем каждое уравнение на общий знаменатель, чтобы избавиться от дробей. Затем исключаем одну переменную (сложением или подстановкой). Решение: x = ${num(x)}, y = ${num(y)}. Тогда ${askTxt} = ${num(ans)}.`,
          },
        };
      }
    },
  },

  {
    id: 'eq.line_through_origin',
    examType: 'coordinate', skills: ['coord.point_on_graph', 'eq.linear'], from: ['daryn2023-34'], difficulty: 2,
    title: { kz: 'График координаталар басынан өтеді', ru: 'График проходит через начало координат' },
    gen(r) {
      const a = r.int(2, 15), b = r.int(2, 9), c = Q.of(r.int(11, 39) / 10), d = r.int(1, 12);
      if (a === d) return this.gen(r);
      const ans = a - d;
      const { choices, answer } = choices5(r, num(ans), [
        { v: num(d - a), tag: 'sign' },
        { v: num(a + d), tag: 'arith' },
        { v: num(Q.of(a - d).sub(c)), tag: 'used_coefficient' },
        { v: num(a), tag: 'partial' },
      ], () => num(ans + r.int(-4, 4)));
      const eq = `${a} − ${b}x + ${num(c)}y = ${d} + m`;
      return {
        kz: `m-нің қандай мәнінде ${eq} теңдеуінің графигі координаталар басынан өтеді?`,
        ru: `При каком значении m график ${eq} проходит через начало координат?`,
        choices, answer,
        sol: {
          kz: `Координаталар басы — (0; 0) нүктесі. x = 0, y = 0 қоямыз: ${a} = ${d} + m, m = ${num(ans)}.`,
          ru: `Начало координат — точка (0; 0). Подставляем x = 0, y = 0: ${a} = ${d} + m, m = ${num(ans)}.`,
        },
      };
    },
  },
];

function lin(k, c, v) {
  const kk = k === 0 ? '' : (k === 1 ? '' : k === -1 ? '−' : num(k)) + v;
  if (!kk) return num(c);
  if (c === 0) return kk;
  return kk + (c > 0 ? ' + ' : ' − ') + Math.abs(c);
}
