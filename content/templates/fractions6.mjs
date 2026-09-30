// 5 класс, декабрь: умножение и деление дробей, часть от числа, число по его части.
// Дробь в тексте: «3/4», смешанное «2 3/4». Минус — «−». Неправильные варианты — реальные ошибки детей
// (метки в content/misconceptions.mjs). hints — лестница из трёх ступеней: вопрос → идея → первый шаг (без ответа);
// 4-я ступень — sol. Числа в условиях историй не больше 100; oneWhole = части одного целого (их сумма ≤ 1).
import { Q, gcd, lcm, num, frac, mixed, choices5, near, NAMES_KZ, genKz } from './lib.mjs';

// ---------- Общие утилиты (как в fractions5.mjs) ----------
const T = (kz, ru) => ({ kz, ru });
const R_ = (n, d) => `${n}/${d}`;
const FEM = new Set(['Айжан', 'Дана', 'Әлия', 'Аружан', 'Томирис', 'Мадина']);
// Ілік септік: қосымша соңғы дауыстыға қарай (Томирис → Томиристің). genKz «о» сияқты бұрынғы қатаң дауыстыға қарап қателеседі, «и» соңғы дауысты болса жіңішке.
const genName = name => {
  const lv = (name.toLowerCase().match(/[аәеиоөұүыіяю]/g) || []).pop(), last = name.slice(-1).toLowerCase();
  if (lv !== 'и') return genKz(name);
  return name + (/[аәеиоөұүыіэюямнң]/.test(last) ? 'нің' : /[жзлрйу]/.test(last) ? 'дің' : 'тің');
};
const ruV = (name, stem) => stem + (FEM.has(name) ? 'а' : '');
const ruPl = (n, one, few, many) => { const a = n % 100, b = n % 10; return a > 10 && a < 20 ? many : b === 1 ? one : b >= 2 && b <= 4 ? few : many; };
const coprimeIn = (r, d, lo = 1, hi = d - 1) => { const c = []; for (let x = lo; x <= hi; x++) if (gcd(x, d) === 1) c.push(x); return r.pick(c); };
const nn = x => String(Math.max(1, x));
const pos = q => (q.n > 0 ? mixed(q) : null);                       // положительное значение как смешанное число, иначе нет варианта
const posInt = q => (q.n > 0 && q.isInt() ? String(q.n) : null);    // только целое положительное
const mx = s => Math.max(0, ...(String(s).match(/\d+/g) || []).map(Number));
const CAP = 150;                                                    // числа-ловушки не больше 150

function val(s) {
  let m;
  if ((m = /^(\d+) (\d+)\/(\d+)$/.exec(s))) return new Q(+m[1] * +m[3] + +m[2], +m[3]);
  if ((m = /^(\d+)\/(\d+)$/.exec(s))) return new Q(+m[1], +m[2]);
  if (/^\d+$/.test(s)) return new Q(+s);
  return null;
}
const valKey = s => { const q = val(s); return q ? q.n + '/' + q.d : 's:' + s; };

// Сборка 5 вариантов: эквивалентные по значению выбрасываются, числа больше CAP не берём.
// allowInt=false: если ответ дробный, целые числа среди вариантов выбрасываются.
function pack(r, correct, wrong, filler, allowInt = false) {
  const seen = new Set([valKey(correct)]);
  const cq = val(correct), noInt = !allowInt && cq && !cq.isInt();
  const bad = v => mx(v) > CAP || (noInt && val(v) && val(v).isInt());
  const ws = [];
  for (const w of wrong) {
    if (!w || w.v == null || bad(w.v)) continue;
    const k = valKey(w.v);
    if (seen.has(k)) continue;
    seen.add(k); ws.push(w);
  }
  const ordered = [...r.shuffle(ws.filter(w => w.tag !== 'random')), ...ws.filter(w => w.tag === 'random')];
  const f = () => { const v = filler(); if (v == null || bad(v)) return null; const k = valKey(v); if (seen.has(k)) return null; seen.add(k); return v; };
  return choices5(r, correct, ordered, f);
}

// Запасной вариант: правдоподобное число рядом с ответом (целое, дробь или смешанное — в стиле ответа)
const nearQ = (r, ans, step = new Q(1)) => {
  const q = ans.add(step.mul(r.int(-6, 8) || 1));
  return q.n > 0 ? mixed(q) : null;
};

const FRAC_Q = (a, b) => new Q(a, b);

// ---------- Ключевые идеи ----------
const IDEA_MUL_WHOLE = T(
  'Бөлшекті бүтін санға көбейткенде алымын сол санға көбейтеміз, бөлім өзгермейді. Қысқартуға болса, алдымен қысқарт.',
  'Дробь умножают на целое так: числитель умножают на это число, знаменатель не меняется. Если можно сократить, сократи сначала.');
const IDEA_MUL_FRAC = T(
  'Бөлшекті бөлшекке көбейткенде алымын алымына, бөлімін бөліміне көбейтеміз. Ортақ бөлім керек емес. Қысқартуға болса, көбейтпес бұрын қысқарт.',
  'Дробь на дробь умножают так: числитель на числитель, знаменатель на знаменатель. Общий знаменатель не нужен. Если можно сократить, сократи до умножения.');
const IDEA_DIV = T(
  'Бөлшекке бөлу — оған кері бөлшекке көбейту. Кері бөлшек алым мен бөлімнің орнын ауыстырғанда шығады.',
  'Деление на дробь — это умножение на обратную дробь. Обратная дробь получается, если поменять числитель и знаменатель местами.');
const IDEA_PART = T(
  'Санның бөлігін табу: санды бөлімге бөліп бір бөлікті табамыз, сосын алымға көбейтеміз.',
  'Чтобы найти часть числа, делим число на знаменатель (получаем одну долю), потом умножаем на числитель.');
const IDEA_WHOLE = T(
  'Бөлігі бойынша бүтінді табу: бөлікті алымға бөлеміз (бір бөлік шығады), сосын бөлімге көбейтеміз. Бүтін = бөлік : бөлшек.',
  'Чтобы найти целое по части, делим часть на числитель (получаем одну долю), потом умножаем на знаменатель. Целое = часть : дробь.');
const IDEA_SIZE_MUL = T(
  'Санды 1-ден кіші санға көбейтсең, нәтиже кемиді; 1-ден үлкен санға көбейтсең, нәтиже өседі; 1-ге көбейтсең, өзгермейді.',
  'Умножение на число меньше 1 уменьшает результат, на число больше 1 увеличивает, на 1 не меняет.');
const IDEA_SIZE_DIV = T(
  'Санды 1-ден кіші санға бөлсең, нәтиже өседі; 1-ден үлкен санға бөлсең, нәтиже кемиді; 1-ге бөлсең, өзгермейді.',
  'Деление на число меньше 1 увеличивает результат, на число больше 1 уменьшает, на 1 не меняет.');

export default [
  // =====================================================================================================
  // frac.mul: бөлшектерді көбейту
  // =====================================================================================================
  {
    id: 'frac.mul_whole',
    examType: 'compute', skills: ['frac.mul'], from: [], difficulty: 1,
    title: { kz: 'Бөлшекті бүтін санға көбейту', ru: 'Умножение дроби на целое число' },
    gen(r) {
      const kind = r.pick(['fw', 'wf', 'story', 'story', 'story']);
      const b = r.pick([2, 3, 4, 5, 6, 8, 10]), a = coprimeIn(r, b);
      let W;
      if (r.chance(0.6)) W = b * r.int(2, Math.min(9, Math.floor(100 / b)));
      else { do { W = r.int(2, 14); } while (W % b === 0); }
      const q = new Q(a, b), ans = q.mul(W), correct = mixed(ans);
      const f = R_(a, b), nm = r.pick(NAMES_KZ);
      const wrong = [
        { v: frac(q), tag: 'whole_into_denominator' },   // бөлімге де көбейтсе, бөлшек өзгермейді: сол қысқартылған a/b (ал 5/10 түрі өзгеше көрінеді)
        { v: String(a * W), tag: 'part_forgot_divide' },
        { v: pos(new Q(W, b)), tag: 'part_forgot_numerator' },
        { v: posInt(new Q(W * b, a)), tag: 'part_inverted_operation' },
      ];
      let kz, ru;
      if (kind === 'fw') { kz = `Есептеңіз: ${f} · ${W}`; ru = `Вычислите: ${f} · ${W}`; }
      else if (kind === 'wf') { kz = `Есептеңіз: ${W} · ${f}`; ru = `Вычислите: ${W} · ${f}`; }
      else {
        const s = r.pick([
          { kz: `Әр құтыға ${f} литрден шырын құйды. ${W} құтыға барлығы қанша литр шырын керек?`, ru: `В каждую банку налили по ${f} литра сока. Сколько литров сока нужно для ${W} ${ruPl(W, 'банки', 'банок', 'банок')}?` },
          { kz: `Бір жіптің ұзындығы ${f} м. Осындай ${W} жіптің жалпы ұзындығы қанша метр?`, ru: `Длина одной верёвки ${f} м. Какова общая длина ${W} таких ${ruPl(W, 'верёвки', 'верёвок', 'верёвок')} в метрах?` },
          { kz: `${nm} күніне ${f} сағат кітап оқиды. ${W} күнде ${nm} барлығы неше сағат оқиды?`, ru: `${nm} читает по ${f} часа в день. Сколько всего часов ${nm} будет читать за ${W} ${ruPl(W, 'день', 'дня', 'дней')}?` },
          { kz: `Бір орамның массасы ${f} кг. Осындай ${W} орамның массасы қанша килограмм?`, ru: `Масса одного свёртка ${f} кг. Сколько килограммов весят ${W} таких ${ruPl(W, 'свёртка', 'свёртков', 'свёртков')}?` },
        ]);
        kz = s.kz; ru = s.ru;
      }
      const { choices, answer } = pack(r, correct, wrong, () => nearQ(r, ans, new Q(1, b)));
      const raw = R_(a * W, b), tail = raw !== correct ? ` = ${correct}` : '';
      const div = W % b === 0;
      return {
        kz, ru, choices, answer,
        hints: [
          T('Бөлшекті бүтін санға көбейткенде алым мен бөлімнің қайсысы өзгереді?', 'Когда дробь умножают на целое число, что меняется: числитель или знаменатель?'),
          IDEA_MUL_WHOLE,
          T(div ? `${W} санын ${b} санына қысқартуға бола ма? Соны қара.` : `Алымды бүтін санға көбейт: ${a} · ${W}. Бөлім — ${b}.`, div ? `Можно ли сократить ${W} и ${b}? Посмотри.` : `Умножь числитель на целое число: ${a} · ${W}. Знаменатель — ${b}.`),
        ],
        sol: {
          kz: div ? `${W} : ${b} = ${W / b}, ${W / b} · ${a} = ${correct}.` : `${f} · ${W} = ${a} · ${W}/${b} = ${raw}${tail}.`,
          ru: div ? `${W} : ${b} = ${W / b}, ${W / b} · ${a} = ${correct}.` : `${f} · ${W} = ${a} · ${W}/${b} = ${raw}${tail}.`,
        },
      };
    },
  },

  {
    id: 'frac.mul_frac',
    examType: 'compute', skills: ['frac.mul'], from: [], difficulty: 2,
    title: { kz: 'Бөлшекті бөлшекке көбейту', ru: 'Умножение дроби на дробь' },
    gen(r) {
      for (;;) {
        const kind = r.pick(['expr', 'expr', 'area', 'area', 'area']);
        const b = r.pick([2, 3, 4, 5, 6, 8, 9, 10]), d = r.pick([2, 3, 4, 5, 6, 8, 9, 10]);
        const a = coprimeIn(r, b), c = coprimeIn(r, d);
        const P = new Q(a, b), S = new Q(c, d), ans = P.mul(S), L = lcm(b, d);
        const correct = frac(ans), f1 = R_(a, b), f2 = R_(c, d);
        const wrong = [
          { v: pos(new Q(a * c, b)), tag: 'mul_numerators_only' },
          { v: pos(new Q(a * c, d)), tag: 'mul_numerators_only' },
          { v: pos(new Q(a * (L / b) * c * (L / d), L)), tag: 'mul_common_denominator' },
          kind === 'area' ? { v: frac(S), tag: 'answered_one_factor' } : { v: pos(P.div(S)), tag: 'random' },
          { v: pos(P.add(S)), tag: 'random' },
        ];
        let kz, ru, oneWhole = false;
        if (kind === 'expr') { kz = `Есептеңіз: ${f1} · ${f2}`; ru = `Вычислите: ${f1} · ${f2}`; }
        else {
          oneWhole = true;
          const nm = r.pick(NAMES_KZ);
          const s = r.pick([
            { kz: `Шоколад плиткасының ${f1} бөлігі қалды. ${nm} қалған бөліктің ${f2} бөлігін жеді. ${nm} бүтін плитканың қандай бөлігін жеді?`,
              ru: `Осталось ${f1} шоколадной плитки. ${nm} ${ruV(nm, 'съел')} ${f2} оставшейся части. Какую часть целой плитки ${ruV(nm, 'съел')} ${nm}?` },
            { kz: `Торттың ${f1} бөлігі қалды. ${nm} қалғанының ${f2} бөлігін жеді. ${nm} бүтін торттың қандай бөлігін жеді?`,
              ru: `Осталось ${f1} торта. ${nm} ${ruV(nm, 'съел')} ${f2} остатка. Какую часть целого торта ${ruV(nm, 'съел')} ${nm}?` },
            { kz: `Қабырғаның ${f1} бөлігі боялған. Боялған бөліктің ${f2} бөлігі көк түсті. Көк түсті бөлік бүкіл қабырғаның қандай бөлігі?`,
              ru: `Покрашено ${f1} стены. ${f2} покрашенной части — синего цвета. Какую часть всей стены составляет синяя часть?` },
            { kz: `Бақшаның ${f1} бөлігіне көкөніс егілді. Оның ${f2} бөлігі — картоп. Картоп бүкіл бақшаның қандай бөлігін алып жатыр?`,
              ru: `${f1} огорода занято овощами. ${f2} этой части — картофель. Какую часть всего огорода занимает картофель?` },
          ]);
          kz = s.kz; ru = s.ru;
        }
        const { choices, answer } = pack(r, correct, wrong, () => {
          if (r.chance(0.5)) { const m = Math.max(3, b * d + r.int(-1, 3)); return R_(r.int(1, m - 1), m); }
          const q = ans.add(new Q(r.int(-8, 8) || 1, b * d)); return q.n > 0 && q.lt(1) ? frac(q) : null;
        }, true);
        const rawN = a * c, rawD = b * d, raw = R_(rawN, rawD), tail = raw !== correct ? ` = ${correct}` : '';
        return {
          kz, ru, choices, answer, oneWhole,
          hints: [
            kind === 'area' ? T('Бөліктің бөлігін табу қандай амалмен орындалады?', 'Каким действием находят часть от части?')
              : T('Бөлшекті бөлшекке көбейткенде алымдар мен бөлімдерге не істейміз?', 'Что делают с числителями и знаменателями, когда умножают дробь на дробь?'),
            IDEA_MUL_FRAC,
            kind === 'area' ? T(`Шартты көбейту түрінде жаз: ${f1} · ${f2}. Сосын алымын алымына, бөлімін бөліміне көбейт.`, `Запиши условие как умножение: ${f1} · ${f2}. Потом числитель на числитель, знаменатель на знаменатель.`)
              : T(`Алымдарды көбейт: ${a} · ${c}. Бөлімдерді көбейт: ${b} · ${d}. Қысқартуға бола ма, соны қара.`, `Умножь числители: ${a} · ${c}. Умножь знаменатели: ${b} · ${d}. Посмотри, можно ли сократить.`),
          ],
          sol: {
            kz: `${f1} · ${f2} = (${a} · ${c})/(${b} · ${d}) = ${raw}${tail}.`,
            ru: `${f1} · ${f2} = (${a} · ${c})/(${b} · ${d}) = ${raw}${tail}.`,
          },
        };
      }
    },
  },

  {
    id: 'frac.mul_mixed',
    examType: 'compute', skills: ['frac.mul'], from: [], difficulty: 3,
    title: { kz: 'Аралас санды көбейту', ru: 'Умножение смешанных чисел' },
    gen(r) {
      for (;;) {
        const kind = r.pick(['mf', 'mw', 'mm', 'rect', 'speed']);
        const w = r.int(1, 4), b = r.pick([2, 3, 4, 5, 6]), a = coprimeIn(r, b);
        const X = new Q(w * b + a, b), xs = `${w} ${a}/${b}`;
        let Y, ys, kz, ru;
        if (kind === 'mw') { const W = r.int(2, 12); Y = new Q(W); ys = String(W); }
        else if (kind === 'mm') {
          const w2 = r.int(1, 3), d = r.pick([2, 3, 4, 5]), c = coprimeIn(r, d);
          Y = new Q(w2 * d + c, d); ys = `${w2} ${c}/${d}`;
        } else { const d = r.pick([2, 3, 4, 5, 6, 8]), c = coprimeIn(r, d); Y = new Q(c, d); ys = R_(c, d); }
        const ans = X.mul(Y);
        if (ans.n > 60 * ans.d) continue;
        const correct = mixed(ans);
        const nm = r.pick(NAMES_KZ);
        if (kind === 'rect') {
          kz = `Тіктөртбұрыштың ұзындығы ${xs} м, ені ${ys} м. Тіктөртбұрыштың ауданы неше шаршы метр?`;
          ru = `Длина прямоугольника ${xs} м, ширина ${ys} м. Сколько квадратных метров составляет его площадь?`;
        } else if (kind === 'speed') {
          kz = `${nm} сағатына ${xs} км жүреді. ${ys} сағатта ${nm} неше километр жүреді?`;
          ru = `${nm} проходит ${xs} км в час. Сколько километров ${nm} пройдёт за ${ys} часа?`;
        } else { kz = `Есептеңіз: ${xs} · ${ys}`; ru = `Вычислите: ${xs} · ${ys}`; }
        const P = new Q(a, b);
        const wrong = [
          { v: pos(P.mul(Y)), tag: 'lost_whole_part' },
          { v: pos(new Q(w + a, b).mul(Y)), tag: 'whole_added_to_numerator' },
          { v: pos(new Q(w * a + b, b).mul(Y)), tag: 'whole_times_numerator' },
          { v: pos(new Q(w).mul(Y).add(P)), tag: 'mul_only_whole_part' },
          { v: pos(new Q((w * b + a) * Y.n, b)), tag: 'mul_numerators_only' },
        ];
        const N = w * b + a;
        const { choices, answer } = pack(r, correct, wrong, () => nearQ(r, ans, new Q(1, Math.max(2, ans.d))), true);
        const Ysol = kind === 'mm' ? `${Y.n}/${Y.d}` : ys;
        return {
          kz, ru, choices, answer,
          hints: [
            T('Аралас санды көбейту үшін алдымен оны қандай түрге келтіру керек?', 'В какой вид нужно сначала привести смешанное число, чтобы его умножать?'),
            T('Аралас санды көбейтпес бұрын бұрыс бөлшекке айналдыр: бүтін бөлікті бөлімге көбейтіп, алымды қос. Сосын алымын алымына, бөлімін бөліміне көбейт.', 'Перед умножением переведи смешанное число в неправильную дробь: целую часть умножь на знаменатель и прибавь числитель. Потом числитель на числитель, знаменатель на знаменатель.'),
            T(`${xs} санын бұрыс бөлшекке айналдыр: ${w} · ${b} + ${a}.`, `Переведи ${xs} в неправильную дробь: ${w} · ${b} + ${a}.`),
          ],
          sol: {
            kz: `${xs} = (${w} · ${b} + ${a})/${b} = ${N}/${b}. ${N}/${b} · ${Ysol} = ${correct}.`,
            ru: `${xs} = (${w} · ${b} + ${a})/${b} = ${N}/${b}. ${N}/${b} · ${Ysol} = ${correct}.`,
          },
        };
      }
    },
  },

  {
    id: 'frac.mul_size',
    examType: 'compute', skills: ['frac.mul'], from: [], difficulty: 2,
    title: { kz: 'Көбейту нәтижесін бағалау', ru: 'Оценка результата умножения' },
    gen(r) {
      const PROPER = [[1, 2], [2, 3], [3, 4], [3, 5], [4, 5], [5, 6], [2, 5], [5, 8], [7, 8], [3, 8], [1, 3], [1, 4], [7, 10], [9, 10]];
      const IMPROPER = [[5, 4], [3, 2], [7, 6], [9, 8], [4, 3], [5, 3], [7, 4], [11, 10], [9, 5], [8, 5], [2, 1], [3, 1]];
      const mode = r.pick(['less', 'greater', 'smallest', 'less', 'greater']);
      const N = r.pick([6, 8, 9, 10, 12, 15, 16, 18, 20, 24, 25, 30, 36, 40, 48, 50, 60]);
      const fx = ([p, q]) => (q === 1 ? String(p) : R_(p, q));
      const left = r.chance(0.5);
      const ex = f => (left ? `${N} · ${fx(f)}` : `${fx(f)} · ${N}`);
      let correctF, wrongFs, kz, ru;
      if (mode === 'less') {
        [correctF] = r.shuffle(PROPER); wrongFs = r.shuffle(IMPROPER).slice(0, 4);
        kz = `Қай өрнектің мәні ${N} санынан кіші?`; ru = `Значение какого выражения меньше ${N}?`;
      } else if (mode === 'greater') {
        [correctF] = r.shuffle(IMPROPER); wrongFs = r.shuffle(PROPER).slice(0, 4);
        kz = `Қай өрнектің мәні ${N} санынан үлкен?`; ru = `Значение какого выражения больше ${N}?`;
      } else {
        const k = r.int(2, 3), pr = r.shuffle(PROPER).slice(0, k), im = r.shuffle(IMPROPER).slice(0, 5 - k);
        const vals = pr.map(f => f[0] / f[1]), best = Math.min(...vals);
        correctF = pr[vals.indexOf(best)]; wrongFs = [...pr.filter(f => f !== correctF), ...im];
        kz = 'Қай өрнектің мәні ең кіші?'; ru = 'Значение какого выражения наименьшее?';
      }
      const correct = ex(correctF);
      const wrong = wrongFs.map(f => ({ v: ex(f), tag: 'mul_always_bigger' }));
      const { choices, answer } = pack(r, correct, wrong, () => null);
      const c = correctF;
      return {
        kz, ru, choices, answer,
        hints: [
          T('Санды бөлшекке көбейткенде нәтиже қалай өзгереді? Көбейткішті 1 санымен салыстыр.', 'Как меняется число при умножении на дробь? Сравни множитель с единицей.'),
          IDEA_SIZE_MUL,
          T('Әр өрнектегі бөлшекті 1 санымен салыстыр: алымы бөлімінен үлкен бе, кіші ме?', 'В каждом выражении сравни дробь с единицей: числитель больше знаменателя или меньше?'),
        ],
        sol: {
          kz: `${fx(c)} ${c[0] < c[1] ? '< 1: нәтиже кемиді' : '> 1: нәтиже өседі'}, ${mode === 'smallest' ? 'ең кіші мән ең кіші көбейткіште' : `сондықтан жауап ${correct}`}. Жауабы: ${correct}.`,
          ru: `${fx(c)} ${c[0] < c[1] ? '< 1: результат уменьшается' : '> 1: результат увеличивается'}, ${mode === 'smallest' ? 'наименьшее значение при наименьшем множителе' : `поэтому подходит ${correct}`}. Ответ: ${correct}.`,
        },
      };
    },
  },

  // =====================================================================================================
  // frac.div: бөлшектерді бөлу
  // =====================================================================================================
  {
    id: 'frac.div_whole_by_frac',
    examType: 'compute', skills: ['frac.div'], from: [], difficulty: 2,
    title: { kz: 'Бүтін санды бөлшекке бөлу', ru: 'Деление целого числа на дробь' },
    gen(r) {
      const FR = [[1, 2], [1, 3], [1, 4], [1, 5], [1, 6], [1, 8], [2, 3], [3, 4], [2, 5], [3, 5], [3, 8], [5, 6], [3, 10], [4, 5]];
      for (;;) {
        const kind = r.pick(['expr', 'story', 'story', 'story']);
        const [a, b] = r.pick(FR);
        let W;
        if (kind === 'expr' && a > 1 && r.chance(0.25)) { do { W = r.int(2, 12); } while (W % a === 0); }
        else { const c = []; for (let x = 2; x <= 30; x++) if (x % a === 0 && (x * b) / a <= 100) c.push(x); W = r.pick(c); }
        const ans = new Q(W * b, a);
        if (ans.n > 100 * ans.d) continue;
        const correct = mixed(ans), f = R_(a, b);
        const wrong = [
          { v: pos(new Q(W * a, b)), tag: 'div_no_flip' },
          { v: frac(new Q(a, b * W)), tag: 'flipped_wrong_fraction' },
          { v: pos(new Q(W, b)), tag: 'divided_by_denominator' },
          { v: String(W * b), tag: 'forgot_numerator' },
        ];
        let kz, ru;
        if (kind === 'expr') { kz = `Есептеңіз: ${W} : ${f}`; ru = `Вычислите: ${W} : ${f}`; }
        else {
          const s = r.pick([
            { kz: `${W} литр шырынды сыйымдылығы ${f} литр стақандарға құйды. Неше стақан керек болды?`, ru: `${W} ${ruPl(W, 'литр', 'литра', 'литров')} сока разлили в стаканы вместимостью ${f} литра. Сколько потребовалось стаканов?` },
            { kz: `Ұзындығы ${W} м жіпті ${f} м-ден бөліктерге кесті. Неше бөлік шықты?`, ru: `Верёвку длиной ${W} м разрезали на части по ${f} м. Сколько получилось частей?` },
            { kz: `${W} кг қантты ${f} кг-нан пакеттерге салды. Неше пакет шықты?`, ru: `${W} кг сахара разложили в пакеты по ${f} кг. Сколько получилось пакетов?` },
            { kz: `Шебер бір бұйымға ${f} сағат жұмсайды. ${W} сағатта ол неше бұйым жасайды?`, ru: `Мастер тратит на одно изделие ${f} часа. Сколько изделий он сделает за ${W} ${ruPl(W, 'час', 'часа', 'часов')}?` },
          ]);
          kz = s.kz; ru = s.ru;
        }
        const { choices, answer } = pack(r, correct, wrong, () => nearQ(r, ans), true);
        return {
          kz, ru, choices, answer,
          hints: [
            T(`Бір бүтінде ${R_(1, b)} бөлік неше рет сияды?`, `Сколько раз ${R_(1, b)} помещается в одном целом?`),
            IDEA_DIV,
            T(`Бөлгіш бөлшекті аудар: ${f} → ${b}/${a}. Енді ${W} · ${b}/${a} көбейтуін орында.`, `Переверни делитель: ${f} → ${b}/${a}. Теперь выполни умножение ${W} · ${b}/${a}.`),
          ],
          sol: {
            kz: `${W} : ${f} = ${W} · ${b}/${a} = ${W * b}/${a} = ${correct}.`,
            ru: `${W} : ${f} = ${W} · ${b}/${a} = ${W * b}/${a} = ${correct}.`,
          },
        };
      }
    },
  },

  {
    id: 'frac.div_frac_by_whole',
    examType: 'compute', skills: ['frac.div'], from: [], difficulty: 2,
    title: { kz: 'Бөлшекті бүтін санға бөлу', ru: 'Деление дроби на целое число' },
    gen(r) {
      const kind = r.pick(['expr', 'story', 'story', 'story', 'plate']);
      const b = r.pick([2, 3, 4, 5, 6, 7, 8, 9, 10]), a = coprimeIn(r, b), W = r.int(2, 9);
      const ans = new Q(a, b * W), correct = frac(ans), f = R_(a, b);
      const wrong = [
        { v: pos(new Q(a * W, b)), tag: 'div_no_flip' },
        { v: pos(new Q(b, a * W)), tag: 'flipped_wrong_fraction' },
        { v: pos(new Q(W * b, a)), tag: 'swapped_dividend_divisor' },
        { v: R_(a, b + W), tag: 'random' },
      ];
      let kz, ru, oneWhole = false;
      if (kind === 'expr') { kz = `Есептеңіз: ${f} : ${W}`; ru = `Вычислите: ${f} : ${W}`; }
      else if (kind === 'plate') {
        oneWhole = true;
        kz = `Шоколад плиткасының ${f} бөлігі қалды. Оны ${W} баланың арасында тең бөлді. Әр бала бүтін плитканың қандай бөлігін алды?`;
        ru = `Осталось ${f} шоколадной плитки. Её поровну разделили между ${W} детьми. Какую часть целой плитки получил каждый ребёнок?`;
      } else {
        const s = r.pick([
          { kz: `${f} кг кәмпитті ${W} балаға тең бөлді. Әр балаға қанша килограмм кәмпит тиді?`, ru: `${f} кг конфет поровну разделили между ${W} детьми. Сколько килограммов конфет получил каждый?` },
          { kz: `${f} л сүтті ${W} стақанға тең бөліп құйды. Әр стақанға қанша литр сүт құйылды?`, ru: `${f} л молока поровну разлили в ${W} ${ruPl(W, 'стакан', 'стакана', 'стаканов')}. Сколько литров молока налили в каждый стакан?` },
          { kz: `Ұзындығы ${f} м лентаны ${W} тең бөлікке кесті. Бір бөліктің ұзындығы қанша метр?`, ru: `Ленту длиной ${f} м разрезали на ${W} ${ruPl(W, 'равную часть', 'равные части', 'равных частей')}. Какова длина одной части в метрах?` },
        ]);
        kz = s.kz; ru = s.ru;
      }
      const { choices, answer } = pack(r, correct, wrong, () => R_(a, b * W + r.int(-2, 3) || b * W + 1), true);
      return {
        kz, ru, choices, answer, oneWhole,
        hints: [
          T('Бөлшекті бүтін санға бөлгенде бөлшектің шамасы кішірейе ме, әлде үлкейе ме?', 'Когда дробь делят на целое число, её величина уменьшается или растёт?'),
          T('Бөлшекті бүтін санға бөлу — сол санның кері бөлшегіне көбейту: n санының кері бөлшегі — 1/n.', 'Деление дроби на целое — это умножение на обратную дробь: обратная для n — это 1/n.'),
          T(`${W} санының кері бөлшегін жаз: 1/${W}. Енді ${f} · 1/${W} көбейтуін орында.`, `Запиши обратную для ${W}: 1/${W}. Теперь выполни умножение ${f} · 1/${W}.`),
        ],
        sol: {
          kz: `${f} : ${W} = ${f} · 1/${W} = ${a}/${b * W}${R_(a, b * W) !== correct ? ` = ${correct}` : ''}.`,
          ru: `${f} : ${W} = ${f} · 1/${W} = ${a}/${b * W}${R_(a, b * W) !== correct ? ` = ${correct}` : ''}.`,
        },
      };
    },
  },

  {
    id: 'frac.div_frac_frac',
    examType: 'compute', skills: ['frac.div'], from: [], difficulty: 3,
    title: { kz: 'Бөлшекті бөлшекке бөлу', ru: 'Деление дроби на дробь' },
    gen(r) {
      for (;;) {
        const kind = r.pick(['expr', 'expr', 'story', 'story']);
        let A, B;
        if (kind === 'story') {
          const d = r.pick([4, 6, 8, 10, 12]), c = r.int(1, 2);
          if (gcd(c, d) !== 1) continue;
          B = new Q(c, d);
          const m = r.int(2, 12); A = B.mul(m);
          if (!A.lt(1) || A.n === 0) continue;
        } else {
          const b = r.pick([2, 3, 4, 5, 6, 8, 9, 10]), d = r.pick([2, 3, 4, 5, 6, 8, 9]);
          A = new Q(coprimeIn(r, b), b); B = new Q(coprimeIn(r, d), d);
        }
        const ans = A.div(B);
        if (A.d * B.n > 80 || A.n * B.d > 80 || ans.eq(A) ) continue;
        const a = A.n, b = A.d, c = B.n, d = B.d, f1 = R_(a, b), f2 = R_(c, d), correct = mixed(ans);
        const wrong = [
          { v: pos(new Q(b * c, a * d)), tag: 'flipped_wrong_fraction' },
          { v: pos(new Q(a * c, b * d)), tag: 'div_no_flip' },
          { v: pos(new Q(a, b * c)), tag: 'div_numerators_only' },
          { v: pos(new Q(a * d, b * c).add(new Q(1))), tag: 'random' },
        ];
        let kz, ru;
        if (kind === 'expr') { kz = `Есептеңіз: ${f1} : ${f2}`; ru = `Вычислите: ${f1} : ${f2}`; }
        else {
          const s = r.pick([
            { kz: `${f1} литр шырынды сыйымдылығы ${f2} литр стақандарға құйды. Неше стақан керек болды?`, ru: `${f1} литра сока разлили в стаканы вместимостью ${f2} литра. Сколько потребовалось стаканов?` },
            { kz: `Ұзындығы ${f1} м лентаны ${f2} м-ден бөліктерге кесті. Неше бөлік шықты?`, ru: `Ленту длиной ${f1} м разрезали на части по ${f2} м. Сколько получилось частей?` },
            { kz: `${f1} кг ұнды ${f2} кг-нан пакеттерге салды. Неше пакет шықты?`, ru: `${f1} кг муки разложили в пакеты по ${f2} кг. Сколько получилось пакетов?` },
          ]);
          kz = s.kz; ru = s.ru;
        }
        const { choices, answer } = pack(r, correct, wrong, () => nearQ(r, ans, new Q(1, Math.max(2, ans.d))), true);
        return {
          kz, ru, choices, answer,
          hints: [
            T('Бөлшекті бөлшекке бөлгенде қай бөлшекті аудару керек: бөлінгішті ме, бөлгішті ме?', 'Когда делят дробь на дробь, какую дробь нужно перевернуть: делимое или делитель?'),
            IDEA_DIV,
            T(`Бөлгіш ${f2} бөлшегінің кері бөлшегін жаз: ${d}/${c}. Сосын ${f1} · ${d}/${c} көбейтуін орында.`, `Запиши обратную дробь для делителя ${f2}: ${d}/${c}. Потом выполни умножение ${f1} · ${d}/${c}.`),
          ],
          sol: {
            kz: `${f1} : ${f2} = ${f1} · ${d}/${c} = ${a * d}/${b * c}${R_(a * d, b * c) !== correct ? ` = ${correct}` : ''}.`,
            ru: `${f1} : ${f2} = ${f1} · ${d}/${c} = ${a * d}/${b * c}${R_(a * d, b * c) !== correct ? ` = ${correct}` : ''}.`,
          },
        };
      }
    },
  },

  {
    id: 'frac.div_size',
    examType: 'compute', skills: ['frac.div'], from: [], difficulty: 2,
    title: { kz: 'Бөлу нәтижесін бағалау', ru: 'Оценка результата деления' },
    gen(r) {
      const PROPER = [[1, 2], [2, 3], [3, 4], [3, 5], [4, 5], [5, 6], [2, 5], [5, 8], [7, 8], [3, 8], [1, 3], [1, 4], [7, 10], [9, 10]];
      const IMPROPER = [[5, 4], [3, 2], [7, 6], [9, 8], [4, 3], [5, 3], [7, 4], [11, 10], [9, 5], [8, 5], [2, 1], [3, 1]];
      const mode = r.pick(['less', 'greater', 'largest', 'less', 'greater']);
      const N = r.pick([6, 8, 9, 10, 12, 15, 16, 18, 20, 24, 25, 30, 36, 40, 48, 50, 60]);
      const fx = ([p, q]) => (q === 1 ? String(p) : R_(p, q));
      const ex = f => `${N} : ${fx(f)}`;
      let correctF, wrongFs, kz, ru;
      if (mode === 'less') {
        [correctF] = r.shuffle(IMPROPER); wrongFs = r.shuffle(PROPER).slice(0, 4);
        kz = `Қай өрнектің мәні ${N} санынан кіші?`; ru = `Значение какого выражения меньше ${N}?`;
      } else if (mode === 'greater') {
        [correctF] = r.shuffle(PROPER); wrongFs = r.shuffle(IMPROPER).slice(0, 4);
        kz = `Қай өрнектің мәні ${N} санынан үлкен?`; ru = `Значение какого выражения больше ${N}?`;
      } else {
        const k = r.int(2, 3), pr = r.shuffle(PROPER).slice(0, k), im = r.shuffle(IMPROPER).slice(0, 5 - k);
        const vals = pr.map(f => f[0] / f[1]), best = Math.min(...vals);
        correctF = pr[vals.indexOf(best)]; wrongFs = [...pr.filter(f => f !== correctF), ...im];
        kz = 'Қай өрнектің мәні ең үлкен?'; ru = 'Значение какого выражения наибольшее?';
      }
      const correct = ex(correctF);
      const wrong = wrongFs.map(f => ({ v: ex(f), tag: 'div_always_smaller' }));
      const { choices, answer } = pack(r, correct, wrong, () => null);
      const c = correctF;
      return {
        kz, ru, choices, answer,
        hints: [
          T('Санды бөлшекке бөлгенде нәтиже қалай өзгереді? Бөлгішті 1 санымен салыстыр.', 'Как меняется число при делении на дробь? Сравни делитель с единицей.'),
          IDEA_SIZE_DIV,
          T('Әр өрнектегі бөлгішті 1 санымен салыстыр: алымы бөлімінен үлкен бе, кіші ме?', 'В каждом выражении сравни делитель с единицей: числитель больше знаменателя или меньше?'),
        ],
        sol: {
          kz: `${fx(c)} ${c[0] < c[1] ? '< 1: бөлгенде нәтиже өседі' : '> 1: бөлгенде нәтиже кемиді'}. Жауабы: ${correct}.`,
          ru: `${fx(c)} ${c[0] < c[1] ? '< 1: при делении результат растёт' : '> 1: при делении результат уменьшается'}. Ответ: ${correct}.`,
        },
      };
    },
  },

  // =====================================================================================================
  // frac.part_of_number: санның бөлігін табу
  // =====================================================================================================
  {
    id: 'frac.part_of_number_direct',
    examType: 'compute', skills: ['frac.part_of_number'], from: [], difficulty: 1,
    title: { kz: 'Санның бөлігін табу', ru: 'Найти часть от числа' },
    gen(r) {
      const kind = r.pick(['expr', 'sweets', 'pupils', 'money', 'km', 'salad']);
      const b = r.pick([2, 3, 4, 5, 6, 7, 8, 9, 10]), a = coprimeIn(r, b), f = R_(a, b), nm = r.pick(NAMES_KZ);
      let N;
      if (r.chance(0.6)) { const cands = []; for (let x = a * b; x <= 100; x += a * b) cands.push(x); N = r.pick(cands); }
      else { const cands = []; for (let x = 2 * b; x <= 100; x += b) cands.push(x); N = r.pick(cands); }
      const P = N / b * a, correct = String(P);
      const wrong = [
        { v: posInt(new Q(N * b, a)), tag: 'part_inverted_operation' },
        { v: String(N / b), tag: 'part_forgot_numerator' },
        { v: String(N * a), tag: 'part_forgot_divide' },
        { v: String(N - P), tag: 'answered_rest' },
      ];
      let kz, ru;
      if (kind === 'expr') { kz = `${N} санының ${f} бөлігін табыңыз.`; ru = `Найдите ${f} числа ${N}.`; }
      else if (kind === 'sweets') { kz = `Қорапта ${N} кәмпит бар. Олардың ${f} бөлігі шоколадты кәмпит. Қорапта неше шоколадты кәмпит бар?`; ru = `В коробке ${N} ${ruPl(N, 'конфета', 'конфеты', 'конфет')}. ${f} из них — шоколадные. Сколько шоколадных конфет в коробке?`; }
      else if (kind === 'pupils') { kz = `Сыныпта ${N} оқушы бар. Олардың ${f} бөлігі үйірмеге қатысады. Үйірмеге неше оқушы қатысады?`; ru = `В классе ${N} ${ruPl(N, 'ученик', 'ученика', 'учеников')}. ${f} из них ходят в кружок. Сколько учеников ходят в кружок?`; }
      else if (kind === 'money') { kz = `${genName(nm)} ${N} мың теңгесі бар. Ол ақшасының ${f} бөлігін жұмсады. Ол неше мың теңге жұмсады?`; ru = `${nm} ${ruV(nm, 'накопил')} ${N} тысяч тенге и ${ruV(nm, 'потратил')} ${f} этой суммы. Сколько тысяч тенге ${ruV(nm, 'потратил')} ${nm}?`; }
      else if (kind === 'km') { kz = `Жолдың ұзындығы ${N} км. Автобус жолдың ${f} бөлігін жүріп өтті. Автобус неше километр жүрді?`; ru = `Длина дороги ${N} км. Автобус проехал ${f} дороги. Сколько километров проехал автобус?`; }
      else { kz = `Салаттың массасы ${N} г. Оның ${f} бөлігін қиярдың массасы құрайды. Қиярдың массасы қанша грамм?`; ru = `Масса салата ${N} г. ${f} этой массы составляют огурцы. Сколько граммов весят огурцы?`; }
      const { choices, answer } = pack(r, correct, wrong, () => nn(near(r, P, 0.5, 1)));
      return {
        kz, ru, choices, answer,
        hints: [
          a === 1 ? T(`Бүтін ${N} санын ${b} тең бөлікке бөлсек, бір бөлік неше болады?`, `Если разделить ${N} на ${b} равных частей, сколько в одной части?`)
            : T(`Бүтін ${N} санын ${b} тең бөлікке бөлсек, бір бөлік неше болады? Ал ${a} бөлік?`, `Если разделить ${N} на ${b} равных частей, сколько в одной части? А в ${a} частях?`),
          IDEA_PART,
          T(`Алдымен ${N} санын ${b} тең бөлікке бөл: ${N} : ${b}.`, `Сначала раздели ${N} на ${b} равных частей: ${N} : ${b}.`),
        ],
        sol: {
          kz: `${N} : ${b} = ${N / b} (бір бөлік). ${N / b} · ${a} = ${P}. Жауабы: ${P}.`,
          ru: `${N} : ${b} = ${N / b} (одна доля). ${N / b} · ${a} = ${P}. Ответ: ${P}.`,
        },
      };
    },
  },

  {
    id: 'frac.part_of_number_more',
    examType: 'word', skills: ['frac.part_of_number'], from: [], difficulty: 3,
    title: { kz: 'Санның бөлігі: қалғаны, қосындысы, айырмасы', ru: 'Часть от числа: остаток, сумма и разность частей' },
    gen(r) {
      const nm = r.pick(NAMES_KZ);
      const kind = r.pick(['rest', 'rest', 'two', 'two', 'diff']);
      if (kind === 'rest') {
        const b = r.pick([3, 4, 5, 6, 7, 8, 9, 10]), a = coprimeIn(r, b), f = R_(a, b);
        const cands = []; for (let x = 2 * b; x <= 100; x += b) cands.push(x);
        const N = r.pick(cands), P = N / b * a, correct = String(N - P);
        const wrong = [
          { v: String(P), tag: 'answered_given_part' },
          { v: String(N / b), tag: 'part_forgot_numerator' },
          { v: posInt(new Q(N * b, a).sub(N)), tag: 'part_inverted_operation' },
          { v: String(N * (b - a)), tag: 'part_forgot_divide' },
        ];
        const s = r.pick([
          { kz: `Дүкенде ${N} кг алма бар еді. Оның ${f} бөлігі сатылды. Неше килограмм алма қалды?`, ru: `В магазине было ${N} кг яблок. Продали ${f} этого количества. Сколько килограммов яблок осталось?` },
          { kz: `Кітапта ${N} бет бар. ${nm} кітаптың ${f} бөлігін оқыды. ${nm} әлі неше бет оқуы керек?`, ru: `В книге ${N} ${ruPl(N, 'страница', 'страницы', 'страниц')}. ${nm} ${ruV(nm, 'прочитал')} ${f} книги. Сколько страниц ${nm} ещё осталось прочитать?` },
          { kz: `Жолдың ұзындығы ${N} км. Жолаушы жолдың ${f} бөлігін жүріп өтті. Оған неше километр жүру қалды?`, ru: `Длина дороги ${N} км. Путник прошёл ${f} дороги. Сколько километров ему осталось пройти?` },
          { kz: `${genName(nm)} ${N} мың теңгесі бар еді. Ол ақшасының ${f} бөлігін жұмсады. Оның неше мың теңгесі қалды?`, ru: `${nm} ${ruV(nm, 'накопил')} ${N} тысяч тенге и ${ruV(nm, 'потратил')} ${f} этой суммы. Сколько тысяч тенге осталось?` },
        ]);
        const { choices, answer } = pack(r, correct, wrong, () => nn(near(r, N - P, 0.5, 1)));
        return {
          kz: s.kz, ru: s.ru, choices, answer,
          hints: [
            T('Сұрақ не туралы: жұмсалған бөлік туралы ма, әлде қалғаны туралы ма?', 'О чём вопрос: о потраченной части или об остатке?'),
            T('Алдымен санның бөлігін тап (бөлімге бөл, алымға көбейт). Қалғаны = бүтін − бөлік.', 'Сначала найди часть числа (раздели на знаменатель, умножь на числитель). Остаток = целое − часть.'),
            T(`Алдымен ${N} санының ${f} бөлігін тап: ${N} : ${b} · ${a}.`, `Сначала найди ${f} от ${N}: ${N} : ${b} · ${a}.`),
          ],
          sol: {
            kz: `${N} санының ${f} бөлігі: ${N} : ${b} · ${a} = ${P}. Қалғаны: ${N} − ${P} = ${N - P}. Жауабы: ${N - P}.`,
            ru: `${f} от ${N}: ${N} : ${b} · ${a} = ${P}. Остаток: ${N} − ${P} = ${N - P}. Ответ: ${N - P}.`,
          },
        };
      }
      // two / diff: две части одного целого
      for (;;) {
        const b = r.pick([2, 3, 4, 5, 6, 8, 10, 12]), d = r.pick([2, 3, 4, 5, 6, 8, 10, 12]);
        const a = coprimeIn(r, b), c = coprimeIn(r, d), F1 = new Q(a, b), F2 = new Q(c, d);
        if (!F1.add(F2).lt(1) || F1.eq(F2)) continue;
        if (kind === 'diff' && !F2.lt(F1)) continue;
        const L = lcm(b, d), cands = []; for (let x = L; x <= 100; x += L) cands.push(x);
        if (!cands.length) continue;
        const N = r.pick(cands), p1 = N / b * a, p2 = N / d * c, f1 = R_(a, b), f2 = R_(c, d);
        let correct, wrong, s, sol;
        if (kind === 'two') {
          correct = String(p1 + p2);
          wrong = [
            { v: String(p1), tag: 'part_one_only' }, { v: String(p2), tag: 'part_one_only' },
            { v: String(N - p1 - p2), tag: 'answered_rest' },
            { v: posInt(new Q(N * (a + c), b + d)), tag: 'added_denominators' },
            { v: String(Math.abs(p1 - p2)), tag: 'wrong_operation' },
          ];
          s = r.pick([
            { kz: `Кітапта ${N} бет бар. ${nm} бірінші күні кітаптың ${f1} бөлігін, екінші күні ${f2} бөлігін оқыды. ${nm} екі күнде барлығы неше бет оқыды?`, ru: `В книге ${N} ${ruPl(N, 'страница', 'страницы', 'страниц')}. ${nm} ${ruV(nm, 'прочитал')} в первый день ${f1} книги, во второй день ${f2} книги. Сколько страниц ${nm} ${ruV(nm, 'прочитал')} за два дня?` },
            { kz: `Жолдың ұзындығы ${N} км. Велосипедші таңертең жолдың ${f1} бөлігін, түстен кейін ${f2} бөлігін жүрді. Ол барлығы неше километр жүрді?`, ru: `Длина дороги ${N} км. Велосипедист проехал утром ${f1} дороги, а после обеда ${f2} дороги. Сколько километров он проехал всего?` },
            { kz: `Сыныпта ${N} оқушы бар. Олардың ${f1} бөлігі футбол секциясына, ${f2} бөлігі шахмат секциясына барады (әр оқушы тек бір секцияға барады). Секцияларға барлығы неше оқушы барады?`, ru: `В классе ${N} ${ruPl(N, 'ученик', 'ученика', 'учеников')}. ${f1} из них ходят в секцию футбола, ${f2} в секцию шахмат (каждый ходит только в одну секцию). Сколько учеников ходят в секции?` },
          ]);
          sol = `${N} : ${b} · ${a} = ${p1}, ${N} : ${d} · ${c} = ${p2}. ${p1} + ${p2} = ${p1 + p2}. Жауабы: ${p1 + p2}.`;
          sol = { kz: sol, ru: `${N} : ${b} · ${a} = ${p1}, ${N} : ${d} · ${c} = ${p2}. ${p1} + ${p2} = ${p1 + p2}. Ответ: ${p1 + p2}.` };
        } else {
          correct = String(p1 - p2);
          wrong = [
            { v: String(p1 + p2), tag: 'wrong_operation' }, { v: String(p1), tag: 'part_one_only' },
            { v: String(p2), tag: 'part_one_only' }, { v: String(N - p1 - p2), tag: 'answered_rest' },
            { v: posInt(new Q(N * (a - c), Math.abs(b - d) || 1)), tag: 'random' },
          ];
          s = r.pick([
            { kz: `Дүкенге ${N} кг жеміс әкелді. Оның ${f1} бөлігі — алма, ${f2} бөлігі — алмұрт. Алма алмұрттан неше килограмм көп?`, ru: `В магазин привезли ${N} кг фруктов. ${f1} из них — яблоки, ${f2} — груши. На сколько килограммов яблок больше, чем груш?` },
            { kz: `Бақшада ${N} ағаш бар. Олардың ${f1} бөлігі — алма ағашы, ${f2} бөлігі — шие ағашы. Алма ағашы шие ағашынан неше артық?`, ru: `В саду ${N} ${ruPl(N, 'дерево', 'дерева', 'деревьев')}. ${f1} из них — яблони, ${f2} — вишни. На сколько яблонь больше, чем вишен?` },
          ]);
          sol = { kz: `${N} : ${b} · ${a} = ${p1}, ${N} : ${d} · ${c} = ${p2}. ${p1} − ${p2} = ${p1 - p2}. Жауабы: ${p1 - p2}.`, ru: `${N} : ${b} · ${a} = ${p1}, ${N} : ${d} · ${c} = ${p2}. ${p1} − ${p2} = ${p1 - p2}. Ответ: ${p1 - p2}.` };
        }
        const cnum = +correct;
        const { choices, answer } = pack(r, correct, wrong, () => nn(near(r, cnum, 0.5, 1)));
        const two = kind === 'two';
        return {
          kz: s.kz, ru: s.ru, choices, answer, oneWhole: true,
          hints: [
            T('Екі бөлік те бір санның бөліктері. Сұрақта екі бөліктің қосындысы сұралған ба, әлде айырмасы ма?', 'Обе части — части одного числа. В вопросе просят сумму частей или их разность?'),
            T(`Әр бөлікті бөлек тап: санды бөлімге бөліп, алымға көбейт. Сосын ${two ? 'екі бөлікті қос' : 'үлкен бөліктен кішісін азайт'}.`, `Найди каждую часть отдельно: раздели число на знаменатель и умножь на числитель. Потом ${two ? 'сложи две части' : 'вычти меньшую часть из большей'}.`),
            T(`Алдымен бірінші бөлікті тап: ${N} : ${b} · ${a}.`, `Сначала найди первую часть: ${N} : ${b} · ${a}.`),
          ],
          sol,
        };
      }
    },
  },

  // =====================================================================================================
  // frac.find_whole: бөлігі бойынша санды табу
  // =====================================================================================================
  {
    id: 'frac.find_whole_story',
    examType: 'word', skills: ['frac.find_whole'], from: [], difficulty: 2,
    title: { kz: 'Бөлігі бойынша бүтінді табу (мәтінді есеп)', ru: 'Целое по его части (текстовая задача)' },
    gen(r) {
      const b = r.pick([3, 4, 5, 6, 8, 10, 12]), a = coprimeIn(r, b), f = R_(a, b), nm = r.pick(NAMES_KZ);
      const cands = []; for (let k = 2; b * k <= 100; k++) cands.push(k);
      const k = r.pick(cands), P = a * k, Wh = b * k, correct = String(Wh);
      const kind = r.pick(['girls', 'pages', 'money', 'route', 'balls']);
      const wrong = [
        { v: pos(new Q(P * a, b)), tag: 'multiplied_instead' },
        { v: String(P * b), tag: 'forgot_numerator' },
        { v: String(Wh - P), tag: 'answered_lost' },
        { v: String(Wh + b), tag: 'random' },
      ];
      let kz, ru;
      if (kind === 'girls') {
        kz = `Сыныптағы қыз балалар — барлық оқушылардың ${f} бөлігі. Сыныпта ${P} қыз бала болса, сыныпта барлығы неше оқушы бар?`;
        ru = `Девочки составляют ${f} всех учеников класса. Если в классе ${P} ${ruPl(P, 'девочка', 'девочки', 'девочек')}, сколько всего учеников в классе?`;
      } else if (kind === 'pages') {
        kz = `${nm} кітаптың ${f} бөлігін оқыды, бұл ${P} бет. Кітапта барлығы неше бет бар?`;
        ru = `${nm} ${ruV(nm, 'прочитал')} ${f} книги, это ${P} ${ruPl(P, 'страница', 'страницы', 'страниц')}. Сколько всего страниц в книге?`;
      } else if (kind === 'money') {
        kz = `${nm} ақшасының ${f} бөлігін жұмсады, бұл ${P} мың теңге. Оның бастапқы ақшасы қанша мың теңге болған?`;
        ru = `${nm} ${ruV(nm, 'потратил')} ${f} своих денег, это ${P} тысяч тенге. Сколько тысяч тенге было у ${nm} сначала?`;
      } else if (kind === 'route') {
        kz = `Турист жолдың ${f} бөлігін жүрді, бұл ${P} км. Жол барлығы неше километр?`;
        ru = `Турист прошёл ${f} пути, это ${P} км. Сколько километров весь путь?`;
      } else {
        kz = `Қорапта ${P} қызыл шар бар. Бұл барлық шарлардың ${f} бөлігі. Қорапта барлығы неше шар бар?`;
        ru = `В коробке ${P} ${ruPl(P, 'красный шар', 'красных шара', 'красных шаров')}. Это ${f} всех шаров. Сколько всего шаров в коробке?`;
      }
      const { choices, answer } = pack(r, correct, wrong, () => nn(near(r, Wh, 0.4, 1)));
      return {
        kz, ru, choices, answer,
        hints: [
          T('Берілген сан бүтіннің қандай бөлігі? Бір бөлікті қалай табуға болады?', 'Какую часть целого составляет данное число? Как найти одну долю?'),
          IDEA_WHOLE,
          a === 1 ? T(`${P} саны — бүтіннің ${R_(1, b)} бөлігі. Бүтінде осындай бөлік неше?`, `Число ${P} — это ${R_(1, b)} целого. Сколько таких долей в целом?`)
            : T(`${P} санын ${a} санына бөл: бұл бүтіннің ${R_(1, b)} бөлігі.`, `Раздели ${P} на ${a}: это ${R_(1, b)} целого.`),
        ],
        sol: {
          kz: `${P} : ${f} = ${P} · ${b}/${a} = ${Wh}. (${P} : ${a} = ${k} — бір бөлік, ${k} · ${b} = ${Wh}.) Жауабы: ${Wh}.`,
          ru: `${P} : ${f} = ${P} · ${b}/${a} = ${Wh}. (${P} : ${a} = ${k} — одна доля, ${k} · ${b} = ${Wh}.) Ответ: ${Wh}.`,
        },
      };
    },
  },

  {
    id: 'frac.find_whole_rest',
    examType: 'word', skills: ['frac.find_whole'], from: [], difficulty: 3,
    title: { kz: 'Қалған бөлігі бойынша бүтінді табу', ru: 'Целое по оставшейся части' },
    gen(r) {
      const b = r.pick([3, 4, 5, 6, 8, 10, 12]), a = coprimeIn(r, b), f = R_(a, b), nm = r.pick(NAMES_KZ), rf = R_(b - a, b);
      const cands = []; for (let k = 2; b * k <= 100; k++) cands.push(k);
      const nice = cands.filter(x => x % a === 0);          // при k, кратном a, ловушка «R : a · b» получается целой
      const k = nice.length && r.chance(0.7) ? r.pick(nice) : r.pick(cands), Rr = (b - a) * k, Wh = b * k, correct = String(Wh);
      const kind = r.pick(['pages', 'shop', 'money', 'route']);
      const wrong = [
        { v: posInt(new Q(Rr * b, a)), tag: 'rest_fraction_mixup' },
        { v: pos(new Q(Rr * (b - a), b)), tag: 'multiplied_instead' },
        { v: String(Wh - Rr), tag: 'answered_lost' },
        { v: String(Rr * b), tag: 'forgot_numerator' },
        { v: String(Wh + b), tag: 'random' },
      ];
      let kz, ru;
      if (kind === 'pages') {
        kz = `${nm} кітаптың ${f} бөлігін оқыды, оқуға ${Rr} бет қалды. Кітапта барлығы неше бет бар?`;
        ru = `${nm} ${ruV(nm, 'прочитал')} ${f} книги, осталось прочитать ${Rr} ${ruPl(Rr, 'страницу', 'страницы', 'страниц')}. Сколько всего страниц в книге?`;
      } else if (kind === 'shop') {
        kz = `Дүкенде тауардың ${f} бөлігі сатылды, ${Rr} кг тауар қалды. Дүкенде бастапқыда қанша килограмм тауар болған?`;
        ru = `В магазине продали ${f} товара, осталось ${Rr} кг товара. Сколько килограммов товара было сначала?`;
      } else if (kind === 'money') {
        kz = `${nm} ақшасының ${f} бөлігін жұмсады, оның қалған ақшасы ${Rr} мың теңге. Бастапқы ақшасы қанша мың теңге болған?`;
        ru = `${nm} ${ruV(nm, 'потратил')} ${f} своих денег, осталось ${Rr} тысяч тенге. Сколько тысяч тенге было у ${nm} сначала?`;
      } else {
        kz = `Автобус жолдың ${f} бөлігін жүрді, әлі ${Rr} км жүру керек. Жол барлығы неше километр?`;
        ru = `Автобус проехал ${f} пути, осталось проехать ${Rr} км. Сколько километров весь путь?`;
      }
      const { choices, answer } = pack(r, correct, wrong, () => nn(near(r, Wh, 0.4, 1)));
      return {
        kz, ru, choices, answer,
        hints: [
          T('Қалған сан бүтіннің қандай бөлігі? Бүтін санды 1 деп ал.', 'Какую часть целого составляет оставшееся число? Целое считай за единицу.'),
          T(`Бүтіннің ${f} бөлігі кетсе, қалғаны — 1 − ${f}. Қалған санды осы бөлшекке бөлсең, бүтін шығады.`, `Если ушло ${f} целого, осталось 1 − ${f}. Раздели остаток на эту дробь, и получишь целое.`),
          T(`Қалған бөлікті бөлшек түрінде жаз: 1 − ${f}. Бөлімі ${b} болатын бөлшек ретінде есепте.`, `Запиши оставшуюся часть дробью: 1 − ${f}. Вычисли её как дробь со знаменателем ${b}.`),
        ],
        sol: {
          kz: `Қалғаны: 1 − ${f} = ${rf}. ${Rr} : ${rf} = ${Rr} · ${b}/${b - a} = ${Wh}. (${Rr} : ${b - a} = ${k} — бір бөлік, ${k} · ${b} = ${Wh}.) Жауабы: ${Wh}.`,
          ru: `Осталось: 1 − ${f} = ${rf}. ${Rr} : ${rf} = ${Rr} · ${b}/${b - a} = ${Wh}. (${Rr} : ${b - a} = ${k} — одна доля, ${k} · ${b} = ${Wh}.) Ответ: ${Wh}.`,
        },
      };
    },
  },
];
