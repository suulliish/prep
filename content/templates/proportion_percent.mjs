// Отношения, пропорции, масштаб, проценты, смеси, части.
import { Q, num, frac, nice, choices5, near, dat, loc, abl, genKz, datKz, ablKz, pct } from './lib.mjs';

const UNITS = [
  { big: { kz: 'тонна', ru: 'т' }, small: { kz: 'килограмм', ru: 'кг' }, f: 1000, bigN: [1, 2, 3, 4, 5, 6, 8, 9], smallN: [20, 25, 40, 50, 60, 75, 80, 100, 125, 200, 250] },
  { big: { kz: 'метр', ru: 'м' }, small: { kz: 'сантиметр', ru: 'см' }, f: 100, bigN: [1, 2, 3, 4, 5, 6, 8, 9, 12], smallN: [4, 5, 8, 10, 20, 25, 40, 50] },
  { big: { kz: 'сағат', ru: 'ч' }, small: { kz: 'минут', ru: 'мин' }, f: 60, bigN: [1, 2, 3, 4, 5, 6], smallN: [4, 5, 10, 12, 15, 20, 30, 40, 45] },
  { big: { kz: 'километр', ru: 'км' }, small: { kz: 'метр', ru: 'м' }, f: 1000, bigN: [1, 2, 3, 4, 5, 6], smallN: [20, 25, 40, 50, 100, 125, 200, 250, 400, 500] },
];

export default [
  {
    id: 'prop.unit_ratio',
    examType: 'proportion', skills: ['ratio.units', 'units.convert'], from: ['daryn2023-01'], difficulty: 1,
    title: { kz: 'Әртүрлі өлшем бірліктердің қатынасы', ru: 'Отношение величин в разных единицах' },
    gen(r) {
      for (;;) {
        const U = r.pick(UNITS), X = r.pick(U.bigN), Y = r.pick(U.smallN);
        const ans = new Q(X * U.f, Y);
        if (!ans.isFiniteDecimal()) continue;
        const { choices, answer } = choices5(r, num(ans), [
          { v: num(new Q(X, Y)), tag: 'no_conversion' },
          { v: num(new Q(Y, X * U.f)), tag: 'inverted' },
          { v: num(ans.mul(10)), tag: 'wrong_factor' },
          { v: num(ans.div(10)), tag: 'wrong_factor' },
        ], () => num(Q.of(near(r, +ans, 0.5, 1))));
        return {
          kz: `${X} ${genKz(U.big.kz)} ${Y} ${datKz(U.small.kz)} қатынасын табыңыз.`,
          ru: `Найдите отношение ${X} ${U.big.ru} к ${Y} ${U.small.ru}.`,
          choices, answer,
          sol: {
            kz: `Алдымен бірдей өлшем бірлікке келтіреміз: ${X} ${U.big.ru} = ${X * U.f} ${U.small.ru}. ${X * U.f} : ${Y} = ${num(ans)}.`,
            ru: `Сначала приводим к одним единицам: ${X} ${U.big.ru} = ${X * U.f} ${U.small.ru}. ${X * U.f} : ${Y} = ${num(ans)}.`,
          },
        };
      }
    },
  },

  {
    id: 'prop.two_maps_scale',
    examType: 'proportion', skills: ['scale.find'], from: ['daryn2023-09'], difficulty: 2,
    title: { kz: 'Екі картаның масштабы', ru: 'Масштабы двух карт' },
    gen(r) {
      for (;;) {
        const S1 = r.pick([500, 1000, 2000, 5000, 10000]), d1 = r.int(1, 6), d2 = r.int(2, 12);
        if (d1 === d2) continue;
        const real = d1 * S1;
        if (real % d2) continue;
        const S2 = real / d2;
        const [a, b] = r.shuffle(['Арман', 'Марат', 'Айжан', 'Дана', 'Нұрлан']).slice(0, 2);
        const opts = [S1 * d2 / d1, real, S1 * d1 * d2, S1 / d1 * d2 + 0].filter(Number.isInteger);
        const { choices, answer } = choices5(r, '1:' + S2, opts.map(v => ({ v: '1:' + v, tag: 'inverted_ratio' })),
          () => '1:' + r.pick([125, 200, 250, 400, 500, 1000, 1250, 2000, 2500, 4000, 5000]));
        return {
          kz: `${andNames(a, b)} үйлерінің арасы бірінші картада ${d1} см, ал екінші картада ${d2} см болатын кесінділерге сәйкес. Бірінші картаның масштабы 1:${S1}. Екінші картаның масштабын табыңыз.`,
          ru: `Расстояние между домами ${a} и ${b} на первой карте — ${d1} см, на второй — ${d2} см. Масштаб первой карты 1:${S1}. Найдите масштаб второй карты.`,
          choices, answer,
          sol: {
            kz: `Нақты арақашықтық: ${d1} · ${S1} = ${real} см. Екінші картада ${d2} см ↔ ${real} см, яғни 1 см ↔ ${S2} см. Масштаб 1:${S2}.`,
            ru: `Реальное расстояние: ${d1} · ${S1} = ${real} см. На второй карте ${d2} см ↔ ${real} см, то есть 1 см ↔ ${S2} см. Масштаб 1:${S2}.`,
          },
        };
      }
    },
  },

  {
    id: 'prop.product_of_extremes',
    examType: 'proportion', skills: ['proportion.property'], from: ['daryn2023-13'], difficulty: 1,
    title: { kz: 'Пропорцияның негізгі қасиеті', ru: 'Основное свойство пропорции' },
    gen(r) {
      if (r.chance(0.5)) {
        const k = r.int(3, 15), ans = k * k;
        const { choices, answer } = choices5(r, num(ans), [
          { v: num(k), tag: 'forgot_square' }, { v: num(2 * k), tag: 'doubled' },
          { v: num(ans / 2), tag: 'arith' }, { v: num(k + 2), tag: 'random' },
        ], () => num(ans + r.int(-10, 10)));
        return {
          kz: `b · c = ${k}² және a : b = c : d екені белгілі. ad мәнін табыңыз.`,
          ru: `Известно, что b · c = ${k}² и a : b = c : d. Найдите ad.`,
          choices, answer,
          sol: { kz: `Пропорцияда шеткі мүшелердің көбейтіндісі ортаңғы мүшелердің көбейтіндісіне тең: ad = bc = ${k}² = ${ans}.`, ru: `В пропорции произведение крайних членов равно произведению средних: ad = bc = ${k}² = ${ans}.` },
        };
      }
      // a : b = c : d, известны a, b, d — найти c
      const b0 = r.int(2, 12), c0 = r.int(2, 15), m = r.int(2, 6);
      const a0 = b0 * m, d0 = c0 * 1; const cAns = new Q(a0 * d0, b0 * m * m).mul(m); // c = a·d / b
      const cVal = new Q(a0 * d0, b0);
      const { choices, answer } = choices5(r, num(cVal), [
        { v: num(new Q(b0 * d0, a0)), tag: 'wrong_cross' }, { v: num(new Q(a0 * b0, d0)), tag: 'wrong_cross' },
        { v: num(a0 + d0 - b0), tag: 'additive' }, { v: num(cVal.add(1)), tag: 'arith' },
      ], () => num(cVal.add(r.int(-6, 6))));
      return {
        kz: `a : b = c : d пропорциясында a = ${a0}, b = ${b0}, d = ${d0}. c-ны табыңыз.`,
        ru: `В пропорции a : b = c : d известно: a = ${a0}, b = ${b0}, d = ${d0}. Найдите c.`,
        choices, answer,
        sol: { kz: `Негізгі қасиет: ad = bc. c = ad : b = ${a0} · ${d0} : ${b0} = ${num(cVal)}.`, ru: `Основное свойство: ad = bc. c = ad : b = ${a0} · ${d0} : ${b0} = ${num(cVal)}.` },
      };
    },
  },

  {
    id: 'prop.map_then_speed',
    examType: 'proportion', skills: ['scale.real_distance', 'motion.basic'], from: ['daryn2023-36'], difficulty: 2,
    title: { kz: 'Масштаб және жылдамдық', ru: 'Масштаб и скорость' },
    gen(r) {
      for (;;) {
        const S = r.pick([500000, 1000000, 1500000, 2000000, 2500000, 4500000, 3000000]), d = r.int(2, 12), v = r.pick([40, 45, 50, 60, 75, 80, 90]);
        const km = d * S / 100000;
        if (km % v) continue;
        const t = km / v;
        const { choices, answer } = choices5(r, num(t), [
          { v: num(km), tag: 'answered_distance' }, { v: num(t * 10), tag: 'unit_error' },
          { v: num(new Q(km * 10, v)), tag: 'unit_error' }, { v: num(new Q(d * S / 1000, v)), tag: 'unit_error' },
        ], () => num(t + r.int(-3, 3)));
        const Ssp = S.toLocaleString('ru-RU').replace(/ /g, ' ');
        return {
          kz: `Масштабы 1:${Ssp} картада темір жолдың ұзындығы ${d} см. Пойыз осы жолды ${v} км/сағ жылдамдықпен неше сағатта жүріп өтеді?`,
          ru: `Длина железной дороги на карте масштаба 1:${Ssp} равна ${d} см. За сколько часов поезд проедет её со скоростью ${v} км/ч?`,
          choices, answer,
          sol: {
            kz: `Нақты ұзындық: ${d} · ${Ssp} см = ${km} км (1 км = 100 000 см). Уақыт = жол : жылдамдық = ${km} : ${v} = ${t} сағ.`,
            ru: `Реальная длина: ${d} · ${Ssp} см = ${km} км (1 км = 100 000 см). Время = путь : скорость = ${km} : ${v} = ${t} ч.`,
          },
        };
      }
    },
  },

  {
    id: 'prop.workers_days',
    examType: 'word', skills: ['proportion.direct', 'work.productivity'], from: ['daryn2023-20'], difficulty: 3,
    title: { kz: 'Жұмысшылар, күндер, өнім', ru: 'Работники, дни, продукция' },
    gen(r) {
      for (;;) {
        const W = r.int(4, 16), D = r.int(3, 9), rate = new Q(r.int(1, 6), r.pick([1, 2]));
        const N = rate.mul(W * D); if (!N.isInt()) continue;
        const w = r.int(2, W + 4), d = r.int(2, 9); if (w === W && d === D) continue;
        const n = rate.mul(w * d); if (!n.isInt()) continue;
        const askDiff = n.n < N.n && r.chance(0.6);
        const ans = askDiff ? N.n - n.n : n.n;
        const job = r.pick([{ kz: 'тігінші', what: 'костюм', past: 'тікті', fut: 'тігеді', ru: 'портных', rw: 'костюмов' }, { kz: 'шебер', what: 'орындық', past: 'жасады', fut: 'жасайды', ru: 'мастеров', rw: 'стульев' }, { kz: 'наубайшы', what: 'нан', past: 'пісірді', fut: 'пісіреді', ru: 'пекарей', rw: 'буханок хлеба' }]);
        const { choices, answer } = choices5(r, num(ans), [
          { v: num(askDiff ? n.n : N.n - n.n), tag: 'wrong_question' },
          { v: num(Math.round(N.n * w / W * D / d)), tag: 'inverse_days' },
          { v: num(Math.round(+N * w / W)), tag: 'ignored_days' },
          { v: num(ans + 3), tag: 'random' },
        ], () => num(ans + r.int(-12, 12)));
        return {
          kz: `${W} ${job.kz} ${D} күнде ${N.n} ${job.what} ${job.past}. Дәл сондай өнімділікпен ${w} ${job.kz} ${d} күнде ${askDiff ? `неше ${datKz(job.what)} кем ${job.fut}` : `неше ${job.what} ${job.fut}`}?`,
          ru: `${W} ${job.ru} за ${D} дней сделали ${N.n} ${job.rw}. ${askDiff ? `На сколько меньше сделают ${w} ${job.ru} за ${d} дней` : `Сколько сделают ${w} ${job.ru} за ${d} дней`} с той же производительностью?`,
          choices, answer,
          sol: {
            kz: `Бір адамның бір күндегі өнімі: ${N.n} : (${W} · ${D}) = ${nice(rate)}. ${w} адам ${d} күнде: ${nice(rate)} · ${w} · ${d} = ${n.n}.${askDiff ? ` Айырмасы: ${N.n} − ${n.n} = ${ans}.` : ''}`,
            ru: `Выработка одного за день: ${N.n} : (${W} · ${D}) = ${nice(rate)}. ${w} человек за ${d} дней: ${nice(rate)} · ${w} · ${d} = ${n.n}.${askDiff ? ` Разность: ${N.n} − ${n.n} = ${ans}.` : ''}`,
          },
        };
      }
    },
  },

  {
    id: 'pct.part_of_unit_mass',
    examType: 'percent', skills: ['percent.of_whole'], from: ['daryn2023-10'], difficulty: 2,
    title: { kz: 'Бүтіннің неше пайызы', ru: 'Сколько процентов от целого' },
    gen(r) {
      for (;;) {
        const k = r.int(2, 5), one = r.pick([4, 5, 6, 8, 10, 12]), p = r.pick([60, 75, 80, 85, 88, 90, 91, 92, 95]);
        const part = new Q(one * p, 100); if (!part.isFiniteDecimal()) continue;
        const M = one * k;
        const { choices, answer } = choices5(r, num(p) + '%', [
          { v: num(new Q(part.mul(100).n, M * part.mul(100).d)) + '%', tag: 'forgot_divide_by_count' },
          { v: num(Math.round(p / 2 * 10) / 10) + '%', tag: 'random' },
          { v: num(100 - p) + '%', tag: 'complement' },
          { v: num(p * k > 100 ? Math.round(p / k * 100) / 100 : p + 5) + '%', tag: 'random' },
        ], () => num(r.int(20, 99)) + '%');
        return {
          kz: `Бір қарбыздағы судың массасы ${num(part)} кг. Осындай ${k} бірдей қарбыздың массасы ${M} кг болса, қарбыздың неше пайызы су?`,
          ru: `В одном арбузе ${num(part)} кг воды. ${k} таких одинаковых арбуза весят ${M} кг. Сколько процентов массы арбуза составляет вода?`,
          choices, answer,
          sol: {
            kz: `Бір қарбыздың массасы: ${M} : ${k} = ${one} кг. Су үлесі: ${num(part)} : ${one} · 100% = ${p}%.`,
            ru: `Масса одного арбуза: ${M} : ${k} = ${one} кг. Доля воды: ${num(part)} : ${one} · 100% = ${p}%.`,
          },
        };
      }
    },
  },

  {
    id: 'pct.group_of_group',
    examType: 'percent', skills: ['percent.ratio'], from: ['daryn2023-21', 'daryn2023-39'], difficulty: 1,
    title: { kz: 'Бір топ екінші топтың неше пайызы', ru: 'Какой процент одна группа составляет от другой' },
    gen(r) {
      for (;;) {
        const b = r.pick([4, 5, 8, 10, 20, 25, 40]), rest = r.int(1, b - 1), a = r.int(1, 6);
        const T = a + b + rest, p = new Q(rest * 100, b);
        if (!p.isFiniteDecimal()) continue;
        const { choices, answer } = choices5(r, num(p) + '%', [
          { v: pct(new Q(rest * 100, T)), tag: 'of_total' },
          { v: pct(new Q(b * 100, T)), tag: 'wrong_group' },
          { v: pct(new Q(100 * b, rest)), tag: 'inverted' },
          { v: pct(new Q(100 * a, b)), tag: 'wrong_group' },
        ], () => num(r.int(5, 95)) + '%');
        return {
          kz: `Сөмкеде барлығы ${T} дәптер бар. Оның ${a} дәптері торкөз, ${b} дәптері жол, ал қалғаны – қалың дәптерлер. Қалың дәптерлер саны жол дәптерлер санының неше пайызын құрайды?`,
          ru: `В сумке ${T} тетрадей: ${a} в клетку, ${b} в линейку, остальные — общие. Сколько процентов составляет количество общих тетрадей от количества тетрадей в линейку?`,
          choices, answer,
          sol: {
            kz: `Қалың дәптерлер: ${T} − ${a} − ${b} = ${rest}. «Жол дәптерлерінің» пайызы сұралып тұр, сондықтан бөлгіш — ${b}: ${rest} : ${b} · 100% = ${num(p)}%.`,
            ru: `Общих тетрадей: ${T} − ${a} − ${b} = ${rest}. Спрашивают процент «от тетрадей в линейку», значит делим на ${b}: ${rest} : ${b} · 100% = ${num(p)}%.`,
          },
        };
      }
    },
  },

  {
    id: 'pct.dilution',
    examType: 'word', skills: ['mixture.dilution', 'percent.of_number'], from: ['daryn2023-12'], difficulty: 3,
    title: { kz: 'Ерітіндіні сұйылту', ru: 'Разбавление раствора' },
    gen(r) {
      for (;;) {
        const p = r.pick([4, 5, 6, 7, 8, 10, 12, 15]), q = r.pick([1, 2, 3, 4, 5]); if (q >= p) continue;
        const M = r.int(2, 30) * 10;
        const total = new Q(M * p, q); if (!total.isInt()) continue;
        const ans = total.n - M;
        const { choices, answer } = choices5(r, num(ans) + ' кг', [
          { v: num(total.n) + ' кг', tag: 'answered_total' },
          { v: num(new Q(M * p, 100)) + ' кг', tag: 'answered_salt' },
          { v: num(M) + ' кг', tag: 'random' },
          { v: num(new Q(M * (p - q), 100)) + ' кг', tag: 'wrong_model' },
        ], () => num(near(r, ans, 0.3, 10)) + ' кг');
        return {
          kz: `Теңіз суы салмағының ${p}%-ы тұз. ${M} кг теңіз суына ондағы тұз үлесі ${q}% болуы үшін қанша тұщы су қосу керек?`,
          ru: `Морская вода на ${p}% состоит из соли. Сколько пресной воды нужно добавить к ${M} кг морской воды, чтобы соли стало ${q}%?`,
          choices, answer,
          sol: {
            kz: `Тұз мөлшері өзгермейді: ${M} · ${p}% = ${num(new Q(M * p, 100))} кг. Жаңа ерітіндіде бұл ${q}%, сондықтан бүкіл масса ${num(new Q(M * p, 100))} : ${q}% = ${total.n} кг. Қосылатын су: ${total.n} − ${M} = ${ans} кг.`,
            ru: `Соль не меняется: ${M} · ${p}% = ${num(new Q(M * p, 100))} кг. В новом растворе это ${q}%, значит вся масса ${num(new Q(M * p, 100))} : ${q}% = ${total.n} кг. Добавить воды: ${total.n} − ${M} = ${ans} кг.`,
          },
        };
      }
    },
  },

  {
    id: 'pct.mix_two',
    examType: 'word', skills: ['mixture.concentration'], from: ['daryn2023-43'], difficulty: 2,
    title: { kz: 'Екі ерітіндіні араластыру', ru: 'Смешивание двух растворов' },
    gen(r) {
      for (;;) {
        const v1 = r.int(1, 5), v2 = r.int(1, 5), p1 = r.pick([5, 10, 15, 20, 25, 30, 40]), p2 = r.pick([10, 20, 25, 30, 35, 40, 50, 60]);
        if (p1 === p2 || v1 === v2) continue;
        const c = new Q(v1 * p1 + v2 * p2, v1 + v2); if (!c.isFiniteDecimal()) continue;
        const { choices, answer } = choices5(r, num(c), [
          { v: num(new Q(p1 + p2, 2)), tag: 'simple_average' },
          { v: num(p1 + p2), tag: 'sum' },
          { v: num(new Q(v1 * p2 + v2 * p1, v1 + v2)), tag: 'swapped_volumes' },
          { v: num(c.add(5)), tag: 'random' },
        ], () => num(r.int(8, 55)));
        return {
          kz: `${v1} л ${p1}%-дық және ${v2} л ${p2}%-дық екі тұз ерітіндісі араластырылып ${v1 + v2} л ерітінді алынды. Жаңа ерітіндінің концентрациясы неше пайыз?`,
          ru: `Смешали ${v1} л ${p1}%-го и ${v2} л ${p2}%-го раствора соли и получили ${v1 + v2} л. Найдите концентрацию соли в новом растворе (в %).`,
          choices, answer,
          sol: {
            kz: `Тұз: ${v1} · ${p1}% + ${v2} · ${p2}% = ${num(new Q(v1 * p1 + v2 * p2, 100))} л. Концентрация: ${num(new Q(v1 * p1 + v2 * p2, 100))} : ${v1 + v2} · 100% = ${num(c)}%. Пайыздарды жай қосып, екіге бөлуге болмайды — көлемдері әртүрлі.`,
            ru: `Соли: ${v1} · ${p1}% + ${v2} · ${p2}% = ${num(new Q(v1 * p1 + v2 * p2, 100))} л. Концентрация: ${num(new Q(v1 * p1 + v2 * p2, 100))} : ${v1 + v2} · 100% = ${num(c)}%. Просто усреднять проценты нельзя — объёмы разные.`,
          },
        };
      }
    },
  },

  {
    id: 'pct.drying',
    examType: 'word', skills: ['mixture.drying', 'percent.of_number'], from: ['daryn2023-52'], difficulty: 3,
    title: { kz: 'Кептіру есебі', ru: 'Задача на высушивание' },
    gen(r) {
      for (;;) {
        const p = r.pick([80, 85, 88, 90, 92, 95, 99]), q = r.pick([10, 12, 15, 20, 25, 28, 40]), M = r.int(2, 50);
        if (q >= p) continue;
        const dry = new Q(M * (100 - p), 100 - q); if (!dry.isFiniteDecimal()) continue;
        const item = r.pick([{ kz: 'саңырауқұлақ', ru: 'грибов' }, { kz: 'жүзім', ru: 'винограда' }, { kz: 'өрік', ru: 'абрикосов' }]);
        const { choices, answer } = choices5(r, num(dry), [
          { v: num(new Q(M * (100 - p), 100)), tag: 'answered_dry_matter' },
          { v: num(new Q(M * q, p)), tag: 'wrong_model' },
          { v: num(new Q(M * (p - q), 100)), tag: 'wrong_model' },
          { v: num(dry.mul(2)), tag: 'arith' },
        ], () => num(Q.of(near(r, +dry, 0.5, 0.25))));
        return {
          kz: `Жаңа ${genKz(item.kz)} ${p}%-ы, кепкен ${genKz(item.kz)} ${q}%-ы су. ${M} кг жаңа ${ablKz(item.kz)} қанша кг кепкен ${item.kz} алуға болады?`,
          ru: `Свежие ${item.ru === 'грибов' ? 'грибы' : item.ru === 'винограда' ? 'виноград' : 'абрикосы'} содержат ${p}% воды, сушёные — ${q}%. Сколько килограммов сушёных ${item.ru} получится из ${M} кг свежих?`,
          choices, answer,
          sol: {
            kz: `Құрғақ зат өзгермейді. Жаңасында құрғақ зат ${100 - p}%: ${M} · ${100 - p}% = ${num(new Q(M * (100 - p), 100))} кг. Кепкенінде құрғақ зат ${100 - q}%, сондықтан масса ${num(new Q(M * (100 - p), 100))} : ${100 - q}% = ${num(dry)} кг.`,
            ru: `Сухое вещество не меняется. В свежих его ${100 - p}%: ${M} · ${100 - p}% = ${num(new Q(M * (100 - p), 100))} кг. В сушёных сухого вещества ${100 - q}%, значит масса ${num(new Q(M * (100 - p), 100))} : ${100 - q}% = ${num(dry)} кг.`,
          },
        };
      }
    },
  },

  {
    id: 'pct.successive_parts',
    examType: 'percent', skills: ['frac.of_number', 'percent.successive'], from: ['daryn2023-33'], difficulty: 2,
    title: { kz: 'Алдымен бөлігі, сосын қалғанның бөлігі', ru: 'Сначала часть, потом часть остатка' },
    gen(r) {
      for (;;) {
        const f1 = r.pick([new Q(1, 4), new Q(1, 5), new Q(1, 2), new Q(2, 5), new Q(3, 4)]), f2 = r.pick([new Q(1, 2), new Q(1, 3), new Q(1, 4), new Q(2, 3)]);
        const M = r.int(4, 60) * 20;
        const s1 = f1.mul(M), rest = new Q(M).sub(s1), s2 = f2.mul(rest), tot = s1.add(s2);
        if (!s1.isInt() || !s2.isInt()) continue;
        const name = r.pick(['Марат', 'Айжан', 'Нұрлан', 'Дана']);
        const { choices, answer } = choices5(r, num(tot), [
          { v: num(f1.add(f2).mul(M)), tag: 'part_of_total_twice' },
          { v: num(rest.sub(s2)), tag: 'answered_rest' },
          { v: num(s2), tag: 'second_only' },
          { v: num(s1), tag: 'first_only' },
        ], () => num(near(r, +tot, 0.3, 10)));
        const dec = q => (q.isFiniteDecimal() ? num(q) : frac(q));
        return {
          kz: `${genKz(name)} ${M} теңгесі болды. Ол соның ${dec(f1)} бөлігін, сосын қалған ақшаның ${dec(f2)} бөлігін жұмсады. ${name} барлығы қанша теңге жұмсады?`,
          ru: `${name} получил(а) ${M} тг. Сначала потратил(а) ${dec(f1)} всех денег, затем ${dec(f2)} оставшихся. Сколько всего потрачено?`,
          choices, answer,
          sol: {
            kz: `1) ${M} · ${dec(f1)} = ${num(s1)} тг. Қалды: ${num(rest)} тг. 2) ${num(rest)} · ${dec(f2)} = ${num(s2)} тг. Барлығы: ${num(s1)} + ${num(s2)} = ${num(tot)} тг.`,
            ru: `1) ${M} · ${dec(f1)} = ${num(s1)} тг. Осталось ${num(rest)} тг. 2) ${num(rest)} · ${dec(f2)} = ${num(s2)} тг. Всего: ${num(s1)} + ${num(s2)} = ${num(tot)} тг.`,
          },
        };
      }
    },
  },

  {
    id: 'pct.three_days_pages',
    examType: 'percent', skills: ['percent.find_whole'], from: ['daryn2023-48'], difficulty: 2,
    title: { kz: 'Пайыз бойынша бүтінді табу', ru: 'Найти целое по проценту' },
    gen(r) {
      for (;;) {
        const p1 = r.pick([10, 20, 25, 30, 35, 40, 45]), p3 = r.pick([10, 15, 20, 25, 30]); const p2 = 100 - p1 - p3;
        if (p2 <= 5) continue;
        const T = r.int(4, 40) * 10; const pages = T * p2 / 100; if (!Number.isInteger(pages)) continue;
        const { choices, answer } = choices5(r, num(T), [
          { v: num(Math.round(pages * 100 / p1)), tag: 'wrong_percent' },
          { v: num(pages * 100 / (p1 + p3)), tag: 'wrong_percent' },
          { v: num(pages + Math.round(T * (p1 + p3) / 100) + 5), tag: 'random' },
          { v: num(T + 10), tag: 'random' },
        ], () => num(T + r.int(-3, 3) * 10));
        return {
          kz: `Теруші кітапты үш күн терді. Бірінші күні кітаптың ${p1}%-ін, екінші күні ${pages} бетін терді. Үшінші күні қалған ${p3}%-ін терді. Кітап неше бет?`,
          ru: `Наборщик набирал книгу три дня. В первый день — ${p1}%, во второй — ${pages} страниц, в третий — оставшиеся ${p3}%. Сколько страниц в книге?`,
          choices, answer,
          sol: {
            kz: `Екінші күнге қалғаны: 100% − ${p1}% − ${p3}% = ${p2}%. ${p2}% — ${pages} бет, 1% — ${num(new Q(pages, p2))} бет. Барлығы: ${T} бет.`,
            ru: `На второй день приходится 100% − ${p1}% − ${p3}% = ${p2}%. ${p2}% — это ${pages} страниц, 1% — ${num(new Q(pages, p2))} стр. Всего ${T} страниц.`,
          },
        };
      }
    },
  },

  {
    id: 'frac.find_whole',
    examType: 'compute', skills: ['frac.find_whole'], from: ['daryn2023-17'], difficulty: 2,
    title: { kz: 'Бөлігі бойынша бүтінді табу', ru: 'Найти целое по его части' },
    gen(r) {
      for (;;) {
        const b = r.pick([4, 5, 8, 10, 16, 20]), a = r.int(1, b - 1); if (new Q(a, b).d !== b) continue;
        const k = r.int(3, 20); const after = a * k, whole = b * k;
        const { choices, answer } = choices5(r, whole + ' г', [
          { v: num(new Q(after * a, b)) + ' г', tag: 'multiplied_instead' },
          { v: after * b + ' г', tag: 'forgot_numerator' },
          { v: whole - after + ' г', tag: 'answered_lost' },
          { v: whole + 20 + ' г', tag: 'random' },
        ], () => near(r, whole, 0.3, 10) + ' г');
        return {
          kz: `Алманы кептірген соң ол бастапқы массасының тек ${a}/${b} бөлігін сақтайды. Кептірген соң массасы ${after} г болса, бастапқы массасы қандай болған?`,
          ru: `После сушки яблоко сохраняет только ${a}/${b} первоначальной массы. Какой была исходная масса, если после сушки она ${after} г?`,
          choices, answer,
          sol: {
            kz: `Бөлігі бойынша бүтінді табу үшін бөлшекке бөлеміз: ${after} : ${a}/${b} = ${after} · ${b} / ${a} = ${whole} г.`,
            ru: `Чтобы найти целое по части, делим на дробь: ${after} : ${a}/${b} = ${after} · ${b} / ${a} = ${whole} г.`,
          },
        };
      }
    },
  },
];

function andNames(a, b) {
  const g = n => genKz(n);
  const conj = /[кқпстфхцчшщ]$/.test(a) ? ' пен ' : /[жз]$/.test(a) ? ' бен ' : ' мен ';
  return a + conj + g(b);
}
