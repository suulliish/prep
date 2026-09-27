// Текстовые задачи (движение, возраст) и геометрия (окружность, квадрат).
import { Q, num, frac, nice, choices5, near, dat, genKz, andKz } from './lib.mjs';

export default [
  {
    id: 'motion.river_ratio',
    examType: 'word', skills: ['motion.river'], from: ['daryn2023-18'], difficulty: 3,
    title: { kz: 'Өзен ағысымен және ағысқа қарсы', ru: 'По течению и против течения' },
    gen(r) {
      const u = r.int(1, 4), v = u * r.int(3, 16) / (r.chance(0.7) ? 1 : 1);
      const t1 = r.int(2, 6), t2 = r.int(2, 6);
      const s1 = (v + u) * t1, s2 = (v - u) * t2;
      const ask = r.pick(['ratio', 'own', 'current']);
      const ans = ask === 'ratio' ? new Q(v, u) : ask === 'own' ? new Q(v) : new Q(u);
      const { choices, answer } = choices5(r, num(ans), [
        { v: num(new Q(v + u, v - u)), tag: 'ratio_of_speeds' },
        { v: num(v + u), tag: 'downstream_speed' },
        { v: num(ask === 'current' ? v : u), tag: 'other_speed' },
        { v: num(new Q(s1 + s2, t1 + t2)), tag: 'average_speed' },
      ], () => num(Q.of(Math.max(1, near(r, +ans, 0.4, 1)))));
      const q = { ratio: ['қайықтың меншікті жылдамдығының ағыс жылдамдығына қатынасы қандай', 'каково отношение собственной скорости лодки к скорости течения'], own: ['қайықтың меншікті жылдамдығы неше км/сағ', 'какова собственная скорость лодки (км/ч)'], current: ['ағыс жылдамдығы неше км/сағ', 'какова скорость течения (км/ч)'] }[ask];
      return {
        kz: `Қайық өзен ағысымен ${t1} сағатта ${s1} км жүзеді, ал ағысқа қарсы ${t2} сағатта ${s2} км жүзеді. ${q[0][0].toUpperCase() + q[0].slice(1)}?`,
        ru: `Лодка по течению проплывает ${s1} км за ${t1} ч, а против течения — ${s2} км за ${t2} ч. ${q[1][0].toUpperCase() + q[1].slice(1)}?`,
        choices, answer,
        sol: {
          kz: `Ағыспен: ${s1} : ${t1} = ${v + u} км/сағ, ағысқа қарсы: ${s2} : ${t2} = ${v - u} км/сағ. Меншікті жылдамдық — олардың жартылай қосындысы: (${v + u} + ${v - u}) : 2 = ${v}. Ағыс — жартылай айырмасы: (${v + u} − ${v - u}) : 2 = ${u}.${ask === 'ratio' ? ` Қатынасы: ${v} : ${u} = ${num(ans)}.` : ''}`,
          ru: `По течению: ${s1} : ${t1} = ${v + u} км/ч, против: ${s2} : ${t2} = ${v - u} км/ч. Собственная скорость — полусумма: (${v + u} + ${v - u}) : 2 = ${v}. Течение — полуразность: (${v + u} − ${v - u}) : 2 = ${u}.${ask === 'ratio' ? ` Отношение: ${v} : ${u} = ${num(ans)}.` : ''}`,
        },
      };
    },
  },

  {
    id: 'motion.opposite_directions',
    examType: 'word', skills: ['motion.apart'], from: ['daryn2023-38'], difficulty: 2,
    title: { kz: 'Қарама-қарсы бағытта қозғалыс', ru: 'Движение в противоположных направлениях' },
    gen(r) {
      for (;;) {
        const v1 = r.int(6, 12) * 10, v2 = r.int(5, 14) * 10, th = r.int(2, 7), half = r.chance(0.5);
        const t = new Q(th * 2 + (half ? 1 : 0), 2), D = t.mul(v1 + v2);
        if (!D.isInt() || v1 === v2) continue;
        const { choices, answer } = choices5(r, num(v2), [
          { v: num(v1 + v2), tag: 'answered_sum_speed' },
          { v: num(D.n / th - v1 | 0), tag: 'ignored_half_hour' },
          { v: num(v1 + v2 + v1), tag: 'added_instead' },
          { v: num(Math.abs(v2 - v1) || v2 + 20), tag: 'random' },
        ], () => num(v2 + r.int(-4, 4) * 10));
        const tk = half ? `${th} сағат 30 минуттан` : `${th} сағаттан`, tr = half ? `${th} ч 30 мин` : `${th} ч`;
        return {
          kz: `Бір станциядан бір мезгілде екі пойыз қарама-қарсы бағытта шықты. ${tk} кейін олардың арақашықтығы ${D.n} км болды. Бірінші пойыздың жылдамдығы ${v1} км/сағ болса, екінші пойыздың жылдамдығы қанша км/сағ?`,
          ru: `Два поезда одновременно вышли с одной станции в противоположных направлениях. Через ${tr} расстояние между ними стало ${D.n} км. Скорость первого ${v1} км/ч. Найдите скорость второго (км/ч).`,
          choices, answer,
          sol: {
            kz: `Олар бір-бірінен ${v1} + x км/сағ жылдамдықпен алыстайды. ${half ? `${th} сағ 30 мин = ${num(t)} сағ. ` : ''}${D.n} : ${num(t)} = ${v1 + v2} км/сағ — алшақтау жылдамдығы. x = ${v1 + v2} − ${v1} = ${v2}.`,
            ru: `Они удаляются со скоростью ${v1} + x км/ч. ${half ? `${th} ч 30 мин = ${num(t)} ч. ` : ''}${D.n} : ${num(t)} = ${v1 + v2} км/ч — скорость удаления. x = ${v1 + v2} − ${v1} = ${v2}.`,
          },
        };
      }
    },
  },

  {
    id: 'age.grandma_at_birth',
    examType: 'word', skills: ['age.difference_invariant'], from: ['daryn2023-28'], difficulty: 2,
    title: { kz: 'Жас айырмасы өзгермейді', ru: 'Разница возрастов не меняется' },
    gen(r) {
      const a = r.int(8, 14), m = r.int(28, 42), g = r.int(55, 75);
      const s1 = a + m, s2 = m + g, ans = g - a;
      const name = r.pick(['Айжан', 'Дана', 'Нұрлан', 'Бекзат', 'Мадина']);
      const { choices, answer } = choices5(r, num(ans), [
        { v: num(s2), tag: 'answered_sum' }, { v: num(Math.round((s1 + s2) / 2)), tag: 'wrong_model' },
        { v: num(ans + 1), tag: 'off_by_one' }, { v: num(g - m), tag: 'wrong_pair' },
      ], () => num(ans + r.int(-6, 6)));
      return {
        kz: `${andKz(name)} анасының жастарының қосындысы – ${s1}, ал анасы мен әжесінің жастарының қосындысы – ${s2}. ${name} туған кезде әжесі неше жаста еді?`,
        ru: `Сумма возрастов ${name} и мамы — ${s1}, а мамы и бабушки — ${s2}. Сколько лет было бабушке, когда родился(ась) ${name}?`,
        choices, answer,
        sol: {
          kz: `Сұралғаны — әжесі мен ${genKz(name)} жас айырмасы, ол жыл өткен сайын өзгермейді. (Анасы + әжесі) − (${name} + анасы) = әжесі − ${name} = ${s2} − ${s1} = ${ans}.`,
          ru: `Спрашивают разницу возрастов бабушки и ${name} — она не меняется со временем. (мама + бабушка) − (${name} + мама) = бабушка − ${name} = ${s2} − ${s1} = ${ans}.`,
        },
      };
    },
  },

  {
    id: 'geo.circumference_units',
    examType: 'geometry', skills: ['circle.length', 'units.convert'], from: ['daryn2023-04'], difficulty: 1,
    title: { kz: 'Шеңбер ұзындығы, өлшем бірлігін ауыстыру', ru: 'Длина окружности с переводом единиц' },
    gen(r) {
      const rcm = r.pick([10, 20, 25, 30, 40, 50, 60, 75, 80, 150]), pi = r.pick([3, 3.14]);
      const C = Q.of(pi).mul(2 * rcm).div(100);
      const { choices, answer } = choices5(r, num(C), [
        { v: num(C.mul(100)), tag: 'no_conversion' },
        { v: num(C.div(2)), tag: 'forgot_2' },
        { v: num(Q.of(pi).mul(rcm * rcm).div(10000)), tag: 'area_formula' },
        { v: num(C.mul(10)), tag: 'wrong_factor' },
      ], () => num(Q.of(near(r, +C, 0.5, 0.1))));
      return {
        kz: `Радиусы ${rcm} см болатын шеңбердің ұзындығы неше метр? (π = ${num(pi)} деп есептеңіз)`,
        ru: `Скольким метрам равна длина окружности радиуса ${rcm} см? (π = ${num(pi)})`,
        choices, answer,
        sol: {
          kz: `C = 2πr = 2 · ${num(pi)} · ${rcm} = ${num(C.mul(100))} см = ${num(C)} м (1 м = 100 см).`,
          ru: `C = 2πr = 2 · ${num(pi)} · ${rcm} = ${num(C.mul(100))} см = ${num(C)} м (1 м = 100 см).`,
        },
      };
    },
  },

  {
    id: 'geo.circle_estimate_radius',
    examType: 'geometry', skills: ['circle.length', 'ineq.double'], from: ['daryn2023-24'], difficulty: 2,
    title: { kz: 'Шеңбер радиусын бағалау', ru: 'Оценка радиуса окружности' },
    gen(r) {
      const lo = r.int(2, 8) * 6, hi = lo + r.int(1, 5) * 6;
      const a = lo / 6, b = hi / 6;
      const c = `${a} < x < ${b}`;
      const { choices, answer } = choices5(r, c, [
        { v: `${lo} ≤ x ≤ ${hi}`, tag: 'used_length' },
        { v: `${a} < x ≤ ${b}`, tag: 'strictness' },
        { v: `${lo / 3} < x < ${hi / 3}`, tag: 'forgot_2' },
        { v: `${a} < x < ${hi}`, tag: 'mixed' },
      ], () => `${a + r.int(1, 3)} < x < ${b + r.int(1, 3)}`);
      return {
        kz: `Шеңбердің ұзындығы ${lo} см-ден артық, бірақ ${hi} см-ден кем. Радиусын x деп алып, бағалаңыз (π = 3 деп есептеңіз).`,
        ru: `Длина окружности больше ${lo} см, но меньше ${hi} см. Оцените радиус x (π = 3).`,
        choices, answer,
        sol: {
          kz: `C = 2πx = 6x. ${lo} < 6x < ${hi}. Барлық бөлікті 6-ға бөлеміз: ${a} < x < ${b}.`,
          ru: `C = 2πx = 6x. ${lo} < 6x < ${hi}. Делим все части на 6: ${a} < x < ${b}.`,
        },
      };
    },
  },

  {
    id: 'geo.inscribed_circle_length',
    examType: 'geometry', skills: ['circle.length', 'circle.inscribed'], from: ['daryn2023-41'], difficulty: 2,
    title: { kz: 'Квадратқа іштей сызылған шеңбер', ru: 'Окружность, вписанная в квадрат' },
    gen(r) {
      const s = r.int(2, 40), pi = new Q(314, 100);
      const C = pi.mul(s);
      const { choices, answer } = choices5(r, num(C) + ' см', [
        { v: num(C.mul(2)) + ' см', tag: 'side_as_radius' },
        { v: num(pi.mul(s * s).div(4)) + ' см', tag: 'area_formula' },
        { v: num(3 * s) + ' см', tag: 'pi_as_3' },
        { v: num(4 * s) + ' см', tag: 'square_perimeter' },
      ], () => num(Q.of(near(r, +C, 0.3, 0.01))) + ' см');
      return {
        kz: `Қабырғасы ${s} см болатын квадратқа іштей сызылған шеңбердің ұзындығын табыңыз (π = 3,14).`,
        ru: `Найдите длину окружности, вписанной в квадрат со стороной ${s} см (π = 3,14).`,
        choices, answer,
        sol: {
          kz: `Іштей сызылған шеңбердің диаметрі квадраттың қабырғасына тең: d = ${s} см. C = πd = 3,14 · ${s} = ${num(C)} см.`,
          ru: `Диаметр вписанной окружности равен стороне квадрата: d = ${s} см. C = πd = 3,14 · ${s} = ${num(C)} см.`,
        },
      };
    },
  },

  {
    id: 'geo.inscribed_corner_area',
    examType: 'geometry', skills: ['circle.area', 'area.composite'], from: ['daryn2023-40'], difficulty: 3,
    title: { kz: 'Квадрат пен шеңбер арасындағы бұрыштың ауданы', ru: 'Площадь уголка между квадратом и кругом' },
    gen(r) {
      const s = 2 * r.int(1, 10), corners = r.pick([1, 2, 4]);
      const R2 = new Q(s * s, 4), area = new Q(s * s).sub(new Q(314, 100).mul(R2)).mul(corners).div(4);
      const { choices, answer } = choices5(r, num(area) + ' м²', [
        { v: num(new Q(s * s).sub(new Q(314, 100).mul(R2))) + ' м²', tag: 'all_corners' },
        { v: num(new Q(s * s).sub(new Q(314, 100).mul(s * s)).abs().mul(corners).div(4)) + ' м²', tag: 'side_as_radius' },
        { v: num(area.mul(2)) + ' м²', tag: 'arith' },
        { v: num(area.div(2)) + ' м²', tag: 'arith' },
      ], () => num(Q.of(near(r, +area, 0.4, 0.01))) + ' м²');
      return {
        kz: `Квадраттың ауданы ${s * s} м². Квадратқа іштей шеңбер сызылған. Суретте боялған бөліктің ауданын табыңыз (π ≈ 3,14).`,
        ru: `Площадь квадрата ${s * s} м², в него вписана окружность. Найдите площадь закрашенной части (π ≈ 3,14).`,
        figure: { kind: 'svg', svg: cornerSvg(corners) },
        choices, answer,
        sol: {
          kz: `Қабырғасы ${s} м, радиусы ${num(s / 2)} м. Дөңгелек ауданы: 3,14 · ${num(R2)} = ${num(new Q(314, 100).mul(R2))} м². Төрт бұрыштың ауданы: ${s * s} − ${num(new Q(314, 100).mul(R2))} = ${num(new Q(s * s).sub(new Q(314, 100).mul(R2)))} м². Боялғаны ${corners} бұрыш: ${num(area)} м².`,
          ru: `Сторона ${s} м, радиус ${num(s / 2)} м. Площадь круга: 3,14 · ${num(R2)} = ${num(new Q(314, 100).mul(R2))} м². Четыре уголка: ${s * s} − ${num(new Q(314, 100).mul(R2))} = ${num(new Q(s * s).sub(new Q(314, 100).mul(R2)))} м². Закрашено уголков: ${corners}, площадь ${num(area)} м².`,
        },
      };
    },
  },
];

// Квадрат со вписанной окружностью, закрашено n уголков (1, 2 или 4)
function cornerSvg(n) {
  const ids = n === 1 ? [3] : n === 2 ? [0, 3] : [0, 1, 2, 3];
  const corner = [
    'M0,0 L50,0 A50,50 0 0 0 0,50 Z', 'M100,0 L100,50 A50,50 0 0 0 50,0 Z',
    'M0,100 L0,50 A50,50 0 0 0 50,100 Z', 'M100,100 L50,100 A50,50 0 0 0 100,50 Z',
  ];
  return `<svg viewBox="-2 -2 104 104" width="160" height="160" xmlns="http://www.w3.org/2000/svg">
<defs><pattern id="h" width="6" height="6" patternUnits="userSpaceOnUse"><path d="M0,6 L6,0" stroke="currentColor" stroke-width="1"/></pattern></defs>
${ids.map(i => `<path d="${corner[i]}" fill="url(#h)"/>`).join('')}
<rect x="0" y="0" width="100" height="100" fill="none" stroke="currentColor" stroke-width="1.5"/>
<circle cx="50" cy="50" r="50" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>`;
}
