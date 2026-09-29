// 5 класс, ноябрь: обыкновенные дроби. Понятие, величина (ориентиры 0, 1/2, 1), основное свойство, сокращение,
// общий знаменатель, сравнение, сложение и вычитание, смешанные числа.
// Дробь в тексте: «3/4», смешанное «2 3/4» (интерфейс рисует этажную запись). Минус — «−».
// Неправильные варианты — реальные ошибки детей (метки в content/misconceptions.mjs).
// hints — лестница из трёх ступеней: вопрос → идея → первый шаг (без ответа); 4-я ступень — sol.
import { Q, gcd, lcm, num, frac, mixed, choices5, near, NAMES_KZ, dat } from './lib.mjs';

// ---------- Общие утилиты ----------
const T = (kz, ru) => ({ kz, ru });
const R_ = (n, d) => `${n}/${d}`;                           // дробь как есть, без сокращения
const M = (w, n, d) => mixed(new Q(w * d + n, d));          // смешанное число, сокращённое
const cap = s => s[0].toUpperCase() + s.slice(1);
const FEM = new Set(['Айжан', 'Дана', 'Әлия', 'Аружан', 'Томирис', 'Мадина']);
const ruV = (name, stem) => stem + (FEM.has(name) ? 'а' : '');
const ruPl = (n, one, few, many) => { const a = n % 100, b = n % 10; return a > 10 && a < 20 ? many : b === 1 ? one : b >= 2 && b <= 4 ? few : many; };
const ruParts = N => (N >= 2 && N <= 4 ? `${N} равные части` : `${N} равных частей`);
const twoNames = r => { const a = r.pick(NAMES_KZ); let b; do { b = r.pick(NAMES_KZ); } while (b === a); return [a, b]; };
const coprimeIn = (r, d, lo = 1, hi = d - 1) => { const c = []; for (let x = lo; x <= hi; x++) if (gcd(x, d) === 1) c.push(x); return r.pick(c); };
const minPrime = n => { for (let p = 2; p * p <= n; p++) if (n % p === 0) return p; return n; };
const isComposite = n => n > 3 && minPrime(n) < n;
const nn = x => String(Math.max(1, x));                      // положительное целое как строка (без ASCII-минуса)
// запасной вариант: правдоподобная дробь со знаменателем рядом с данным (когда типичных ошибок не хватило)
const anyFrac = (r, d0) => { const d = r.int(Math.max(3, d0 - 2), d0 + 6); return R_(r.int(1, d - 1), d); };
// вариант для разбора в подсказке: НЕ правильный (подсказка не должна называть ответ)
const sampleWrong = (choices, answer) => parseNd(choices[answer === 0 ? 1 : 0].text);
const parseNd = s => { const m = /(\d+)\/(\d+)$/.exec(s); return m ? { n: +m[1], d: +m[2] } : null; };

// Значение варианта ответа для защиты от эквивалентных дублей: «1/2» и «2/4» — один ключ.
function val(s) {
  let m;
  if ((m = /^(\d+) (\d+)\/(\d+)$/.exec(s))) return new Q(+m[1] * +m[3] + +m[2], +m[3]);
  if ((m = /^(\d+)\/(\d+)$/.exec(s))) return new Q(+m[1], +m[2]);
  if (/^\d+$/.test(s)) return new Q(+s);
  return null;
}
const valKey = s => { const q = val(s); return q ? q.n + '/' + q.d : 's:' + s; };

// Сборка 5 вариантов. eq=false: эквивалентные по значению варианты выбрасываются (ответ единственный).
// eq=true: сравниваются только строки (вопрос про сокращение или равенство, где равные значения нужны намеренно).
function pack(r, correct, wrong, filler, eq = false, allowInt = false) {
  const kf = eq ? (s => s) : valKey;
  const seen = new Set([kf(correct)]);
  const cq = val(correct), noInt = !allowInt && cq && !cq.isInt();
  const silly = v => noInt && val(v) && val(v).isInt();     // «16/1», «17/17»: целое среди дробных ответов выглядит нелепо
  const ws = [];
  for (const w of wrong) {
    if (!w || w.v == null || silly(w.v)) continue;
    const k = kf(w.v);
    if (seen.has(k)) continue;
    seen.add(k); ws.push(w);
  }
  // реальные ошибки идут первыми (в случайном порядке), «случайные» — в запас
  const ordered = [...r.shuffle(ws.filter(w => w.tag !== 'random')), ...ws.filter(w => w.tag === 'random')];
  const f = () => { const v = filler(); if (v == null || silly(v)) return null; const k = kf(v); if (seen.has(k)) return null; seen.add(k); return v; };
  return choices5(r, correct, ordered, f);
}

const IDEA_PART = T(
  'Бөлшектің бөлімі — бүтін неше тең бөлікке бөлінгенін, алымы — неше бөлік алынғанын көрсетеді.',
  'Знаменатель показывает, на сколько равных частей разделено целое, а числитель — сколько частей взято.');
const IDEA_PROP = T(
  'Бөлшектің негізгі қасиеті: алымы мен бөлімін бірдей санға көбейтсең (немесе бөлсең), бөлшек өзгермейді.',
  'Основное свойство дроби: если числитель и знаменатель умножить (или разделить) на одно число, дробь не изменится.');

// Пары знаменателей для общего знаменателя: взаимно простые, один делит другой, общий случай.
const PAIRS = {
  coprime: [[3, 4], [3, 5], [4, 5], [5, 6], [3, 7], [4, 7], [2, 5], [5, 7], [6, 7], [2, 9], [8, 9], [2, 7]],
  divisible: [[3, 6], [4, 8], [5, 10], [3, 9], [4, 12], [6, 12], [5, 15], [8, 16], [2, 8], [3, 12], [4, 16], [6, 18], [2, 6], [5, 20]],
  general: [[4, 6], [6, 8], [6, 9], [8, 12], [10, 15], [9, 12], [12, 18], [4, 10], [6, 10], [9, 15], [14, 21], [10, 25], [12, 16], [8, 20], [15, 20], [6, 15]],
};
const pickPair = (r, w = { general: 6, divisible: 2, coprime: 2 }) => {
  const kinds = Object.entries(w).flatMap(([k, n]) => Array(n).fill(k));
  const p = r.pick(PAIRS[r.pick(kinds)]);
  return r.chance(0.5) ? p : [p[1], p[0]];
};

export default [
  // =====================================================================================================
  // frac.concept: бөлшек ұғымы
  // =====================================================================================================
  {
    id: 'frac.concept_part',
    examType: 'compute', skills: ['frac.concept'], from: [], difficulty: 1,
    title: { kz: 'Бөлшек — бүттің бөлігі', ru: 'Дробь как часть целого' },
    gen(r) {
      const kind = r.pick(['eaten', 'eaten', 'rest', 'group']);
      let N, k, kz, ru, correct, wrong, step, sol;
      if (kind === 'group') {
        N = r.int(6, 15); k = coprimeIn(r, N);
        const g = r.pick([
          { kz: `Қорапта ${N} шар бар. ${k} шар қызыл, қалғаны көк. Қызыл шарлар барлық шардың қандай бөлігін құрайды?`, ru: `В коробке ${N} шаров, ${k} из них красные, остальные синие. Какую часть всех шаров составляют красные?` },
          { kz: `Сыныпта ${N} оқушы бар. ${k} оқушы қыз бала. Қыз балалар сыныптың қандай бөлігін құрайды?`, ru: `В классе ${N} учеников, ${k} из них девочки. Какую часть класса составляют девочки?` },
          { kz: `Тұрақта ${N} көлік тұр. ${k} көлік ақ түсті. Ақ көліктер барлық көліктің қандай бөлігін құрайды?`, ru: `На стоянке ${N} машин, ${k} из них белые. Какую часть всех машин составляют белые?` },
        ]);
        ({ kz, ru } = g);
        correct = R_(k, N);
        wrong = [
          { v: R_(k, N - k), tag: 'part_to_part' }, { v: R_(N - k, N), tag: 'answered_rest' },
          { v: R_(N, k), tag: 'flipped_fraction' }, { v: R_(k, N + k), tag: 'random' },
        ];
        step = T(`Бөлімге барлығының санын жаз: ${N}. Алымға сұралған топтың санын жаз.`, `В знаменатель запиши, сколько всего: ${N}. В числитель — сколько в нужной группе.`);
        sol = T(`Барлығы — ${N} (бөлім), сұралған топта — ${k} (алым). Жауабы: ${k}/${N}.`, `Всего — ${N} (знаменатель), в нужной группе — ${k} (числитель). Ответ: ${k}/${N}.`);
      } else {
        const ctx = r.pick([
          { cut: N => `Пицца ${N} тең бөлікке кесілді.`, gen: 'пиццаның', ruCut: p => `Пицца разрезана на ${p}.`, ruGen: 'пиццы' },
          { cut: N => `Шоколад плиткасы ${N} тең бөлікке бөлінген.`, gen: 'плитканың', ruCut: p => `Шоколадная плитка разделена на ${p}.`, ruGen: 'плитки' },
          { cut: N => `Торт ${N} тең бөлікке кесілді.`, gen: 'торттың', ruCut: p => `Торт разрезан на ${p}.`, ruGen: 'торта' },
        ]);
        const nm = r.pick(NAMES_KZ);
        N = r.pick([4, 5, 6, 8, 9, 10, 12]); k = coprimeIn(r, N);
        const eaten = kind === 'eaten';
        kz = `${ctx.cut(N)} ${nm} ${k} бөлігін жеді. ${eaten ? `${nm} ${ctx.gen} қандай бөлігін жеді?` : `${cap(ctx.gen)} қандай бөлігі қалды?`}`;
        ru = `${ctx.ruCut(ruParts(N))} ${nm} ${ruV(nm, 'съел')} ${k} ${ruPl(k, 'часть', 'части', 'частей')}. ${eaten ? `Какую часть ${ctx.ruGen} ${ruV(nm, 'съел')} ${nm}?` : `Какая часть ${ctx.ruGen} осталась?`}`;
        if (eaten) {
          correct = R_(k, N);
          wrong = [
            { v: R_(k, N - k), tag: 'part_to_part' }, { v: R_(N - k, N), tag: 'answered_rest' },
            { v: R_(N, k), tag: 'flipped_fraction' }, { v: R_(k + 1, N), tag: 'random' },
          ];
          step = T(`Бүтін ${N} тең бөлікке бөлінген: бөлімге ${N} жаз. Алымға не жазылатынын өзің ойла.`, `Целое разделено на ${N} равных частей: в знаменатель пиши ${N}. Что писать в числитель, подумай сам.`);
          sol = T(`Бүтін ${N} тең бөлікке бөлінген, бөлім — ${N}. ${nm} ${k} бөлік жеді, алым — ${k}. Жауабы: ${k}/${N}.`, `Целое разделено на ${N} равных частей, знаменатель — ${N}. Съедено ${k} частей, числитель — ${k}. Ответ: ${k}/${N}.`);
        } else {
          correct = R_(N - k, N);
          wrong = [
            { v: R_(k, N), tag: 'answered_given_part' }, { v: R_(N - k, k), tag: 'part_to_part' },
            { v: R_(N, N - k), tag: 'flipped_fraction' }, { v: R_(k, N - k), tag: 'part_to_part' },
          ];
          step = T(`Алдымен неше бөлік қалғанын тап: ${N} − ${k}.`, `Сначала найди, сколько частей осталось: ${N} − ${k}.`);
          sol = T(`Қалған бөлік: ${N} − ${k} = ${N - k}. Бөлім — ${N}. Жауабы: ${N - k}/${N}.`, `Осталось: ${N} − ${k} = ${N - k} частей. Знаменатель — ${N}. Ответ: ${N - k}/${N}.`);
        }
      }
      const { choices, answer } = pack(r, correct, wrong, () => anyFrac(r, N));
      return {
        kz, ru, choices, answer,
        hints: [
          T('Бүтін неше тең бөлікке бөлінген? Оның қандай бөлігі туралы сұралып тұр?', 'На сколько равных частей разделено целое? О какой его части спрашивают?'),
          IDEA_PART, step,
        ],
        sol,
      };
    },
  },

  {
    id: 'frac.concept_equal',
    examType: 'compute', skills: ['frac.concept'], from: [], difficulty: 1,
    title: { kz: 'Алым, бөлім және тең бөліктер', ru: 'Числитель, знаменатель и равные части' },
    gen(r) {
      const kind = r.pick(['den', 'num', 'action', 'action']);
      if (kind === 'action') {
        const b = r.int(3, 9), a = coprimeIn(r, b, 1, b - 1);
        const correct = `Пиццаны ${b} тең бөлікке кесіп, ${a} бөлігін алу`;
        const wrong = [
          { v: `Пиццаны ${b} бөлікке кесіп (бөліктері тең емес), ${a} бөлігін алу`, tag: 'unequal_parts' },
          { v: `Пиццаны бөліктерге кесіп, ${a} бөлігін алып, ${b} бөлігін қалдыру`, tag: 'part_to_part' },
          { v: `Пиццаны ${b} тең бөлікке кесіп, ${b - a} бөлігін алу`, tag: 'mixed_up_rest' },
          { v: `Пиццаны ${a} тең бөлікке кесіп, ${b} бөлігін алу`, tag: 'swapped_num_den' },
        ];
        const { choices, answer } = pack(r, correct, wrong, () => `Пиццаны ${b + r.int(1, 3)} тең бөлікке кесіп, ${a} бөлігін алу`);
        return {
          kz: `Пиццаның ${a}/${b} бөлігін алу үшін не істеу керек?`,
          ru: `Что нужно сделать, чтобы взять ${a}/${b} пиццы?`,
          choices, answer,
          hints: [
            T('Бөлшектің астындағы сан нені, үстіндегі сан нені көрсетеді?', 'Что показывает число под чертой дроби, а что — над чертой?'),
            IDEA_PART,
            T(`Бөлшектегі сандарды осылай оқы: ${a}/${b}. Бөліктер тең болуы шарт екенін ұмытпа.`, `Прочитай числа дроби ${a}/${b} по этому правилу. Не забудь: части должны быть равными.`),
          ],
          sol: {
            kz: `${a}/${b}: бөлім ${b} — пиццаны ${b} тең бөлікке кесеміз; алым ${a} — ${a} бөлікті аламыз.`,
            ru: `${a}/${b}: знаменатель ${b} — режем пиццу на ${b} равных частей; числитель ${a} — берём ${a} части.`,
          },
        };
      }
      const d = r.int(5, 20), n = r.int(1, d - 1), askDen = kind === 'den';
      const correct = String(askDen ? d : n);
      const wrong = [
        { v: String(askDen ? n : d), tag: 'swapped_num_den' }, { v: String(d - n), tag: 'random' },
        { v: String(d + n), tag: 'random' }, { v: String(n * d), tag: 'random' },
      ];
      const { choices, answer } = pack(r, correct, wrong, () => nn(near(r, +correct, 0.5, 1)));
      return {
        kz: `${n}/${d} бөлшегінің ${askDen ? 'бөлімі' : 'алымы'} қандай сан?`,
        ru: `Какое число является ${askDen ? 'знаменателем' : 'числителем'} дроби ${n}/${d}?`,
        choices, answer,
        hints: [
          T('Бөлшек сызығының үстінде не, астында не тұр?', 'Что стоит над чертой дроби, а что — под чертой?'),
          IDEA_PART,
          T(`Астындағы сан — бөлім, үстіндегісі — алым. Осылай ажыратып, ${n}/${d} бөлшегіне қара.`, `Нижнее число — знаменатель, верхнее — числитель. Разбери так дробь ${n}/${d}.`),
        ],
        sol: {
          kz: `${n}/${d}: үстіндегі сан ${n} — алым, астындағы сан ${d} — бөлім. Жауабы: ${correct}.`,
          ru: `${n}/${d}: верхнее число ${n} — числитель, нижнее ${d} — знаменатель. Ответ: ${correct}.`,
        },
      };
    },
  },

  // =====================================================================================================
  // frac.magnitude: бөлшектің шамасы (тірек сандар 0, 1/2, 1)
  // =====================================================================================================
  {
    id: 'frac.magnitude_half',
    examType: 'compute', skills: ['frac.magnitude'], from: [], difficulty: 1,
    title: { kz: '1/2 санымен салыстыру', ru: 'Сравнение с 1/2' },
    gen(r) {
      const gt = r.chance(0.5);
      const d = r.int(7, 15);
      let correct, wrong;
      if (gt) {
        const n = r.int(Math.floor(d / 2) + 1, d - 1), k = r.int(2, 6);
        correct = R_(n, d);
        const n2 = n + r.int(1, 3), m4 = r.int(5, 20);
        wrong = [
          { v: R_(k, 2 * k), tag: 'equal_to_half' },
          { v: R_(n2, 2 * n2 + r.int(1, 6)), tag: 'numerator_only_compare' },
          { v: R_(r.int(1, 3), d + r.int(3, 9)), tag: 'bigger_denominator_bigger' },
          { v: R_(r.int(1, Math.floor((m4 - 1) / 2)), m4), tag: 'random' },
        ];
      } else {
        const n = r.int(1, Math.floor((d - 1) / 2)), k = r.int(2, 6), m5 = r.int(5, 20);
        correct = R_(n, d);
        const small = r.pick([[2, 3], [3, 4], [3, 5], [4, 5], [5, 6], [4, 7], [5, 8]]);
        let numTrap = null;
        if (n >= 3) { const n1 = r.int(2, n - 1); numTrap = { v: R_(n1, r.int(n1 + 1, 2 * n1 - 1)), tag: 'numerator_only_compare' }; }
        wrong = [
          { v: R_(k, 2 * k), tag: 'equal_to_half' },
          numTrap,
          { v: R_(small[0], small[1]), tag: 'whole_number_bias' },
          { v: R_(r.int(Math.floor(m5 / 2) + 1, m5 - 1), m5), tag: 'random' },
        ];
      }
      const filler = () => { const m = r.int(5, 20); return gt ? R_(r.int(1, Math.floor((m - 1) / 2)), m) : R_(r.int(Math.floor(m / 2) + 1, m - 1), m); };
      const { choices, answer } = pack(r, correct, wrong, filler);
      const ctx = r.pick(['plain', 'phone', 'bar']);
      const w = gt ? ['үлкен', 'больше', 'көп', 'больше'] : ['кіші', 'меньше', 'аз', 'меньше'];
      const kz = ctx === 'plain' ? `Қай бөлшек 1/2 санынан ${w[0]}?`
        : ctx === 'phone' ? `Телефон батареясының қай заряды жартысынан ${w[2]}?` : `Энергия батончигінің қай бөлігі жартысынан ${w[2]}?`;
      const ru = ctx === 'plain' ? `Какая дробь ${w[1]} 1/2?`
        : ctx === 'phone' ? `Какой заряд батареи телефона ${w[3]} половины?` : `Какая часть энергетического батончика ${w[3]} половины?`;
      const f = sampleWrong(choices, answer);
      const cn = parseNd(correct);
      return {
        kz, ru, choices, answer,
        hints: [
          T('Бөлшекті 1/2 санымен салыстыру үшін бөлімнің жартысын қарасақ қайтеді?', 'Что даст половина знаменателя, когда сравниваешь дробь с 1/2?'),
          T('Бөлшек 1/2 санынан үлкен, егер алымы бөлімнің жартысынан үлкен болса; алымы жартысынан кіші болса — бөлшек кіші.', 'Дробь больше 1/2, если числитель больше половины знаменателя; если меньше — дробь меньше 1/2.'),
          T(`Мысалы, ${f.n}/${f.d} нұсқасын тексер: бөлімнің жартысы ${num(f.d / 2)}, алымы ${f.n}. Салыстыр.`, `Например, проверь вариант ${f.n}/${f.d}: половина знаменателя ${num(f.d / 2)}, числитель ${f.n}. Сравни.`),
        ],
        sol: {
          kz: `${cn.n}/${cn.d}: бөлімнің жартысы ${num(cn.d / 2)}, ал алым ${cn.n} — одан ${gt ? 'үлкен' : 'кіші'}. Демек, ${cn.n}/${cn.d} ${gt ? '>' : '<'} 1/2.`,
          ru: `${cn.n}/${cn.d}: половина знаменателя ${num(cn.d / 2)}, а числитель ${cn.n} — ${gt ? 'больше' : 'меньше'}. Значит, ${cn.n}/${cn.d} ${gt ? '>' : '<'} 1/2.`,
        },
      };
    },
  },

  {
    id: 'frac.magnitude_near',
    examType: 'compute', skills: ['frac.magnitude'], from: [], difficulty: 2,
    title: { kz: 'Тірек санға ең жақын бөлшек', ru: 'Дробь, ближайшая к ориентиру' },
    gen(r) {
      const mode = r.pick(['one', 'zero', 'half']);
      let target, correct, wrong, filler, dist, hint3, hint2, hint1;
      const wrongs = [];
      const fmt2 = x => num(Math.round(x * 1000) / 1000);
      if (mode === 'one') {
        const D = r.int(9, 20);
        correct = R_(D - 1, D); target = 1;
        const mk = () => { for (let i = 0; ; i++) { const g = r.int(2, 3), b = r.int(D + 1, 3 * D - 1); if (gcd(g, b) !== 1 || g * D < 1.6 * b) continue; return { n: b - g, b }; } };
        for (let i = 0; i < 6; i++) { const x = mk(); wrongs.push({ v: R_(x.n, x.b), tag: x.n > D - 1 ? 'numerator_only_compare' : 'random' }); }
        wrong = wrongs; filler = () => { const x = mk(); return R_(x.n, x.b); };
        dist = t => { const p = parseNd(t); return (p.d - p.n) / p.d; };
        hint1 = T('Бөлшек 1 санына дейін қаншаға жетпейді?', 'Сколько не хватает дроби до 1?');
        hint2 = T('Бөлшек неше бөлікке жетпей тұр — соны қара: (бөлім − алым)/бөлім. Жетпейтін бөлік неғұрлым кіші болса, бөлшек 1 санына соғұрлым жақын.', 'Смотри, сколько долей не хватает до единицы: (знаменатель − числитель)/знаменатель. Чем меньше недостающая доля, тем ближе дробь к 1.');
        hint3 = t => { const p = parseNd(t); return T(`Мысалы, ${t} нұсқасы: 1 санына дейін ${p.d - p.n}/${p.d} жетпейді. Қалғандарын да осылай тексер.`, `Например, вариант ${t}: до 1 не хватает ${p.d - p.n}/${p.d}. Так же проверь остальные.`); };
      } else if (mode === 'zero') {
        const n0 = r.int(2, 3);
        let m0; do { m0 = r.int(n0 * 8, n0 * 14); } while (gcd(n0, m0) !== 1);
        correct = R_(n0, m0); target = 0;
        const far = (n, m) => n * m0 >= 1.6 * n0 * m;      // значение хотя бы в 1,6 раза больше: разница видна без вычислений
        const kmax = Math.floor(m0 / (1.6 * n0));
        for (let i = 0; i < 3; i++) wrongs.push({ v: R_(1, r.int(3, Math.max(3, kmax))), tag: 'numerator_only_compare' });
        for (let i = 0; i < 30; i++) {
          const n = r.int(n0 + 1, n0 + 4), m = r.int(m0 + 1, m0 + 12);
          if (far(n, m) && gcd(n, m) === 1) wrongs.push({ v: R_(n, m), tag: 'bigger_denominator_bigger' });
        }
        for (let i = 0; i < 6; i++) { const n = r.int(n0 + 1, n0 + 4), m = r.int(n + 1, m0); if (far(n, m) && gcd(n, m) === 1) wrongs.push({ v: R_(n, m), tag: 'random' }); }
        wrong = r.shuffle(wrongs.filter(w => w.tag === 'numerator_only_compare')).slice(0, 1)
          .concat(r.shuffle(wrongs.filter(w => w.tag === 'bigger_denominator_bigger')).slice(0, 2), wrongs.filter(w => w.tag === 'random'));
        filler = () => { const n = r.int(n0 + 2, n0 + 6), m = r.int(n + 1, m0); return far(n, m) ? R_(n, m) : null; };
        dist = t => { const p = parseNd(t); return p.n / p.d; };
        hint1 = T('Қай бөлшектің шамасы 0 санына ең жақын? Бөлім алымнан қаншалықты үлкен?', 'Значение какой дроби ближе всего к 0? Во сколько раз знаменатель больше числителя?');
        hint2 = T('Бөлшек 0 санына жақын, егер алымы бөліммен салыстырғанда өте кіші болса. Әр бөлшекте бөлім алымнан неше есе үлкенін салыстыр.', 'Дробь близка к 0, если числитель очень мал по сравнению со знаменателем. Сравни, во сколько раз знаменатель больше числителя.');
        hint3 = t => { const p = parseNd(t); return T(`Мысалы, ${t} нұсқасы: бөлім алымнан шамамен ${num(Math.round(p.d / p.n * 10) / 10)} есе үлкен. Қалғандарын да осылай тексер.`, `Например, вариант ${t}: знаменатель примерно в ${num(Math.round(p.d / p.n * 10) / 10)} раза больше числителя. Так же проверь остальные.`); };
      } else {
        const k = r.int(4, 9), mc = 2 * k + 1, nc = r.chance(0.5) ? k : k + 1;
        correct = R_(nc, mc); target = 0.5;
        const gapC = 1 / (2 * mc);
        const mk = () => { for (;;) { const m = r.int(3, 14), n = r.int(1, m - 1); if (gcd(n, m) === 1 && Math.abs(2 * n - m) / (2 * m) >= 2 * gapC) return { n, m }; } };
        for (let i = 0; i < 6; i++) { const x = mk(); wrongs.push({ v: R_(x.n, x.m), tag: x.n > nc ? 'numerator_only_compare' : 'random' }); }
        wrong = wrongs; filler = () => { const x = mk(); return R_(x.n, x.m); };
        dist = t => { const p = parseNd(t); return Math.abs(p.n / p.d - 0.5); };
        hint1 = T('Қай бөлшектің шамасы 1/2 санына ең жақын? Алым бөлімнің жартысына қаншалықты жақын?', 'Значение какой дроби ближе всего к 1/2? Насколько числитель близок к половине знаменателя?');
        hint2 = T('Алым бөлімнің жартысына неғұрлым жақын болса, бөлшек 1/2 санына соғұрлым жақын. Әр бөлшекте бөлімнің жартысын алыммен салыстыр.', 'Чем ближе числитель к половине знаменателя, тем ближе дробь к 1/2. В каждой дроби сравни половину знаменателя с числителем.');
        hint3 = t => { const p = parseNd(t); return T(`Мысалы, ${t} нұсқасы: бөлімнің жартысы ${num(p.d / 2)}, алымы ${p.n}, айырмасы ${num(Math.abs(p.n - p.d / 2))}. Қалғандарын да осылай тексер.`, `Например, вариант ${t}: половина знаменателя ${num(p.d / 2)}, числитель ${p.n}, разница ${num(Math.abs(p.n - p.d / 2))}. Так же проверь остальные.`); };
      }
      const { choices, answer } = pack(r, correct, wrong, filler);
      const tk = mode === 'half' ? '1/2' : String(target);
      const phone = mode === 'one' && r.chance(0.5);
      const kz = phone ? 'Қай телефонның заряды толық зарядқа ең жақын?' : `Қай бөлшек ${tk} санына ең жақын?`;
      const ru = phone ? 'Заряд какого телефона ближе всего к полному?' : `Какая дробь ближе всего к ${tk}?`;
      const list = choices.map(c => `${c.text} (${fmt2(dist(c.text))})`).join(', ');
      return {
        kz, ru, choices, answer,
        hints: [hint1, hint2, hint3(choices[answer === 0 ? 1 : 0].text)],
        sol: {
          kz: `Әр бөлшектің ${tk} санынан қашықтығы: ${list}. Ең кіші қашықтық — ${correct}.`,
          ru: `Расстояние каждой дроби до ${tk}: ${list}. Наименьшее расстояние у ${correct}.`,
        },
      };
    },
  },

  {
    id: 'frac.magnitude_estimate',
    examType: 'compute', skills: ['frac.magnitude'], from: [], difficulty: 3,
    title: { kz: 'Қосындыны бағалау', ru: 'Оценка суммы без счёта' },
    gen(r) {
      const near1 = () => { const D = r.int(10, 20); return { n: D - 1, d: D, b: 1 }; };
      const near0 = () => ({ n: 1, d: r.int(10, 20), b: 0 });
      const nearH = () => { const m = 2 * r.int(4, 10) + 1; return { n: (m + (r.chance(0.5) ? 1 : -1)) / 2, d: m, b: 0.5 }; };
      const types = [[near1, near1, 2], [near1, nearH, 1.5], [nearH, nearH, 1], [near0, near1, 1], [near0, nearH, 0.5]];
      const [g1, g2, target] = r.pick(types);
      const p = g1(), q = g2();
      const [f1, f2] = r.chance(0.5) ? [p, q] : [q, p];
      const SET = [0.5, 1, 1.5, 2, 3], TXT = { 0.5: '1/2', 1: '1', 1.5: '1 1/2', 2: '2', 3: '3' };
      const naive = (p.n + q.n) / (p.d + q.d);   // «сложил числители и знаменатели»: одна дробь, округлённая к ближайшему варианту
      const naiveNear = SET.reduce((a, b) => (Math.abs(b - naive) < Math.abs(a - naive) ? b : a));
      const wrong = SET.filter(x => x !== target).map(x => ({ v: TXT[x], tag: x === naiveNear ? 'added_denominators' : 'random' }));
      const { choices, answer } = pack(r, TXT[target], wrong, () => null, false, true);
      const benchTxt = b => (b === 0.5 ? '1/2' : String(b));
      const s1 = `${R_(f1.n, f1.d)}`, s2 = `${R_(f2.n, f2.d)}`;
      return {
        kz: `Дәл есептемей, бағалаңыз: ${s1} + ${s2} қосындысы қай санға жақын?`,
        ru: `Не считая точно, оцените: сумма ${s1} + ${s2} ближе всего к какому числу?`,
        choices, answer,
        hints: [
          T('Әр қосылғыш қай санға жақын: 0-ге, 1/2-ге ме, әлде 1-ге ме?', 'К какому числу ближе каждое слагаемое: к 0, к 1/2 или к 1?'),
          T('Әр бөлшекті ең жақын тірек санмен (0, 1/2 немесе 1) ауыстыр да, сол сандарды қос.', 'Замени каждую дробь ближайшим ориентиром (0, 1/2 или 1) и сложи эти числа.'),
          T(`Бірінші қосылғыш ${s1} — ${benchTxt(f1.b)} санына жақын. Екіншісін өзің бағала.`, `Первое слагаемое ${s1} близко к ${benchTxt(f1.b)}. Второе оцени сам.`),
        ],
        sol: {
          kz: `${s1} ≈ ${benchTxt(f1.b)}, ${s2} ≈ ${benchTxt(f2.b)}. ${benchTxt(f1.b)} + ${benchTxt(f2.b)} = ${TXT[target]}. Жауабы: шамамен ${TXT[target]}.`,
          ru: `${s1} ≈ ${benchTxt(f1.b)}, ${s2} ≈ ${benchTxt(f2.b)}. ${benchTxt(f1.b)} + ${benchTxt(f2.b)} = ${TXT[target]}. Ответ: примерно ${TXT[target]}.`,
        },
      };
    },
  },

  // =====================================================================================================
  // frac.basic_property: бөлшектің негізгі қасиеті
  // =====================================================================================================
  {
    id: 'frac.equal_missing',
    examType: 'compute', skills: ['frac.basic_property'], from: [], difficulty: 2,
    title: { kz: 'Жетіспейтін санды табу', ru: 'Найти пропущенное число' },
    gen(r) {
      const kind = r.pick(['num_up', 'den_up', 'num_down', 'cake']);
      const b = r.int(3, 9), a = coprimeIn(r, b), k = r.int(2, 9), D = b * k, A = a * k;
      let kz, ru, correct, wrong, h1, h3, sol;
      if (kind === 'num_up' || kind === 'cake') {
        correct = A;
        wrong = [{ v: a + (D - b), tag: 'added_not_multiplied' }, { v: k, tag: 'factor_as_answer' }, { v: a * (k + 1), tag: 'random' }, { v: D, tag: 'random' }];
        if (kind === 'num_up') {
          kz = `Жетіспейтін санды табыңыз: ${a}/${b} = ?/${D}`; ru = `Найдите пропущенное число: ${a}/${b} = ?/${D}`;
        } else {
          kz = `Торт ${D} тең бөлікке кесілген. Оның ${a}/${b} бөлігі неше кесек болады?`;
          ru = `Торт разрезан на ${D} равных кусков. Сколько кусков составляют ${a}/${b} торта?`;
        }
        h1 = T('Бөлім неше есе өсті?', 'Во сколько раз вырос знаменатель?');
        h3 = T(`Бөлім ${b} → ${D}. Неше есе өскенін тап: ${D} : ${b}.`, `Знаменатель ${b} → ${D}. Найди, во сколько раз он вырос: ${D} : ${b}.`);
        sol = T(`Бөлім ${b} → ${D}: ${k} есе өсті. Алымды да ${k} есе өсіреміз: ${a} · ${k} = ${A}. Жауабы: ${A}.`, `Знаменатель ${b} → ${D}: вырос в ${k} раз. Числитель тоже умножаем на ${k}: ${a} · ${k} = ${A}. Ответ: ${A}.`);
      } else if (kind === 'den_up') {
        correct = D;
        wrong = [{ v: b + (A - a), tag: 'added_not_multiplied' }, { v: k, tag: 'factor_as_answer' }, { v: D + b, tag: 'random' }, { v: A, tag: 'random' }];
        kz = `Жетіспейтін санды табыңыз: ${a}/${b} = ${A}/?`; ru = `Найдите пропущенное число: ${a}/${b} = ${A}/?`;
        h1 = T('Алым неше есе өсті?', 'Во сколько раз вырос числитель?');
        h3 = T(`Алым ${a} → ${A}. Неше есе өскенін тап: ${A} : ${a}.`, `Числитель ${a} → ${A}. Найди, во сколько раз он вырос: ${A} : ${a}.`);
        sol = T(`Алым ${a} → ${A}: ${k} есе өсті. Бөлімді де ${k} есе өсіреміз: ${b} · ${k} = ${D}. Жауабы: ${D}.`, `Числитель ${a} → ${A}: вырос в ${k} раз. Знаменатель тоже умножаем на ${k}: ${b} · ${k} = ${D}. Ответ: ${D}.`);
      } else {
        correct = a;
        wrong = [{ v: A - (D - b) > 0 ? A - (D - b) : null, tag: 'added_not_multiplied' }, { v: k, tag: 'factor_as_answer' }, { v: a + 1, tag: 'random' }, { v: b, tag: 'random' }];
        kz = `Жетіспейтін санды табыңыз: ${A}/${D} = ?/${b}`; ru = `Найдите пропущенное число: ${A}/${D} = ?/${b}`;
        h1 = T('Бөлім неше есе кеміді?', 'Во сколько раз уменьшился знаменатель?');
        h3 = T(`Бөлім ${D} → ${b}. Неше есе кемігенін тап: ${D} : ${b}.`, `Знаменатель ${D} → ${b}. Найди, во сколько раз он уменьшился: ${D} : ${b}.`);
        sol = T(`Бөлім ${D} → ${b}: ${k} есе кеміді. Алымды да ${k} есе кемітеміз: ${A} : ${k} = ${a}. Жауабы: ${a}.`, `Знаменатель ${D} → ${b}: уменьшился в ${k} раз. Числитель тоже делим на ${k}: ${A} : ${k} = ${a}. Ответ: ${a}.`);
      }
      const { choices, answer } = pack(r, String(correct), wrong.map(w => ({ ...w, v: w.v == null ? null : String(w.v) })), () => nn(near(r, correct, 0.5, 1)));
      return { kz, ru, choices, answer, hints: [h1, IDEA_PROP, h3], sol };
    },
  },

  {
    id: 'frac.equal_which',
    examType: 'compute', skills: ['frac.basic_property'], from: [], difficulty: 2,
    title: { kz: 'Тең бөлшектерді табу', ru: 'Найти равные дроби' },
    gen(r) {
      const b = r.int(3, 9), a = coprimeIn(r, b), notEqual = r.chance(0.4);
      const step = T(`Әр нұсқаны ${a}/${b} бөлшегімен салыстыр: алымы мен бөлімі бірдей санға көбейтілген бе?`, `Сравни каждый вариант с ${a}/${b}: числитель и знаменатель умножены на одно и то же число?`);
      const q = T('Алым мен бөлім қанша есе өзгерді, екеуі де бірдей өзгерді ме?', 'Во сколько раз изменились числитель и знаменатель, одинаково ли?');
      if (!notEqual) {
        const k = r.int(2, 5), m = r.int(1, 4);
        const correct = R_(a * k, b * k);
        const wrong = [
          { v: R_(a + m, b + m), tag: 'added_not_multiplied' }, { v: R_(a * k, b), tag: 'changed_one_part' },
          { v: R_(a, b * k), tag: 'changed_one_part' }, { v: R_(b, a), tag: 'flipped_fraction' }, { v: R_(a * k + 1, b * k), tag: 'random' },
        ];
        const { choices, answer } = pack(r, correct, wrong, () => R_(a * r.int(2, 5) + r.int(1, 2), b * r.int(2, 5)));
        return {
          kz: `Қай бөлшек ${a}/${b} бөлшегіне тең?`, ru: `Какая дробь равна ${a}/${b}?`, choices, answer,
          hints: [q, IDEA_PROP, step],
          sol: {
            kz: `${a}/${b} бөлшегінің алымы мен бөлімін ${k} санына көбейтеміз: ${a} · ${k} = ${a * k}, ${b} · ${k} = ${b * k}. Жауабы: ${correct}.`,
            ru: `Умножим числитель и знаменатель дроби ${a}/${b} на ${k}: ${a} · ${k} = ${a * k}, ${b} · ${k} = ${b * k}. Ответ: ${correct}.`,
          },
        };
      }
      const ks = r.shuffle([2, 3, 4, 5, 6, 7, 8, 9]).slice(0, 4), m = r.int(1, 4);
      const correct = R_(a + m, b + m);
      const wrong = ks.map(k => ({ v: R_(a * k, b * k), tag: 'equal_fraction' }));
      const { choices, answer } = pack(r, correct, wrong, () => null, true);
      return {
        kz: `Қай бөлшек ${a}/${b} бөлшегіне тең емес?`, ru: `Какая дробь не равна ${a}/${b}?`, choices, answer,
        hints: [q, IDEA_PROP, step],
        sol: {
          kz: `${correct}: алымы мен бөліміне ${m} қосылған, көбейтілмеген, сондықтан бөлшек ${a}/${b} бөлшегіне тең емес. Қалғандарында алым мен бөлім бірдей санға көбейтілген (${ks.join(', ')} есе).`,
          ru: `${correct}: к числителю и знаменателю прибавили ${m}, а не умножили, поэтому дробь не равна ${a}/${b}. Остальные получены умножением на ${ks.join(', ')}.`,
        },
      };
    },
  },

  // =====================================================================================================
  // frac.reduce: бөлшекті қысқарту
  // =====================================================================================================
  {
    id: 'frac.reduce_lowest',
    examType: 'compute', skills: ['frac.reduce'], from: [], difficulty: 2,
    title: { kz: 'Бөлшекті қысқарту', ru: 'Сокращение дроби' },
    gen(r) {
      if (r.chance(0.25)) return irreducibleWhich(r);
      const big = r.chance(0.4);
      const b = big ? r.int(5, 13) : r.int(3, 11), a = coprimeIn(r, b, 2, b - 1) , g = big ? r.int(9, 18) : r.int(3, 12);
      const n = a * g, d = b * g;
      const p = minPrime(g), divs = [];
      for (let x = 2; x < g; x++) if (g % x === 0) divs.push(x);
      const partial = divs.map(x => ({ v: R_(n / x, d / x), tag: 'partial_reduce' }));
      const correct = R_(a, b);
      const wrong = [
        ...r.shuffle(partial).slice(0, 2),
        { v: R_(n / g, d), tag: 'changed_one_part' }, { v: R_(b, a), tag: 'flipped_fraction' }, { v: R_(n, d), tag: 'not_reduced' },
        { v: R_(a + 1, b), tag: 'random' },
      ];
      const { choices, answer } = pack(r, correct, wrong, () => R_(a + r.int(1, 2), b + r.int(0, 1)), true);
      return {
        kz: `Бөлшекті қысқартыңыз (қысқартылмайтын түрге келтіріңіз): ${n}/${d}`,
        ru: `Сократите дробь до несократимого вида: ${n}/${d}`,
        choices, answer,
        hints: [
          T('Алым мен бөлімнің ортақ бөлгіші бар ма? Ең үлкен ортақ бөлгіші қандай?', 'Есть ли у числителя и знаменателя общий делитель? Какой из них наибольший?'),
          T('Қысқарту — алым мен бөлімді ЕҮОБ-қа бөлу. Бөлшек қысқартылмайтын болады, егер ЕҮОБ = 1 болса.', 'Сократить — значит разделить числитель и знаменатель на их НОД. Дробь несократима, когда НОД = 1.'),
          T(`Алдымен ${n} және ${d} сандарының ортақ бөлгішін тап (2, 3, 5, 7-ге бөліп көр).`, `Сначала найди общий делитель чисел ${n} и ${d} (попробуй 2, 3, 5, 7).`),
        ],
        sol: {
          kz: `${n} және ${d} сандарының ЕҮОБ-ы ${g}. Екеуін де ${dat(g)} бөлеміз: ${n} : ${g} = ${a}, ${d} : ${g} = ${b}. Жауабы: ${correct}.`,
          ru: `НОД чисел ${n} и ${d} равен ${g}. Делим и числитель, и знаменатель на ${g}: ${n} : ${g} = ${a}, ${d} : ${g} = ${b}. Ответ: ${correct}.`,
        },
      };
    },
  },

  {
    id: 'frac.reduce_context',
    examType: 'compute', skills: ['frac.reduce'], from: [], difficulty: 2,
    title: { kz: 'Өлшем бірліктері мен бөлшектер', ru: 'Дроби в единицах измерения' },
    gen(r) {
      const U = r.pick([
        { W: 60, vals: [10, 12, 15, 18, 20, 24, 25, 35, 40, 45, 50], wrongW: 100, whole: T('1 сағат = 60 минут', '1 час = 60 минут'),
          q: x => T(`${x} минут — сағаттың қандай бөлігі? Жауабын қысқартылмайтын бөлшекпен жазыңыз.`, `Какую часть часа составляют ${x} ${ruPl(x, 'минута', 'минуты', 'минут')}? Запишите несократимой дробью.`) },
        { W: 1000, vals: [125, 200, 250, 400, 600, 750, 800], wrongW: 100, whole: T('1 килограмм = 1000 грамм', '1 килограмм = 1000 граммов'),
          q: x => T(`${x} грамм — килограмның қандай бөлігі? Жауабын қысқартылмайтын бөлшекпен жазыңыз.`, `Какую часть килограмма составляют ${x} ${ruPl(x, 'грамм', 'грамма', 'граммов')}? Запишите несократимой дробью.`) },
        { W: 100, vals: [20, 25, 35, 40, 45, 60, 65, 75, 80], wrongW: 1000, whole: T('1 метр = 100 сантиметр', '1 метр = 100 сантиметров'),
          q: x => T(`${x} сантиметр — метрдің қандай бөлігі? Жауабын қысқартылмайтын бөлшекпен жазыңыз.`, `Какую часть метра составляют ${x} ${ruPl(x, 'сантиметр', 'сантиметра', 'сантиметров')}? Запишите несократимой дробью.`) },
        { W: 12, vals: [3, 4, 6, 8, 9, 10], wrongW: null, whole: T('1 жыл = 12 ай', '1 год = 12 месяцев'),
          q: x => T(`${x} ай — жылдың қандай бөлігі? Жауабын қысқартылмайтын бөлшекпен жазыңыз.`, `Какую часть года составляют ${x} ${ruPl(x, 'месяц', 'месяца', 'месяцев')}? Запишите несократимой дробью.`) },
        { W: 1000, vals: [125, 200, 250, 400, 600, 750, 800], wrongW: 100, whole: T('1 километр = 1000 метр', '1 километр = 1000 метров'),
          q: x => T(`${x} метр — километрдің қандай бөлігі? Жауабын қысқартылмайтын бөлшекпен жазыңыз.`, `Какую часть километра составляют ${x} ${ruPl(x, 'метр', 'метра', 'метров')}? Запишите несократимой дробью.`) },
      ]);
      const x = r.pick(U.vals), g = gcd(x, U.W), n = x / g, d = U.W / g;
      const correct = R_(n, d);
      // частичное сокращение: делитель меньше НОД, а знаменатель остаётся «детским» (≤ 100): не «400/500», а «80/100»
      const qs = []; for (let q = 2; q < g; q++) if (g % q === 0 && U.W / q <= 100) qs.push(q);
      const wrong = [
        { v: R_(x, U.W), tag: 'not_reduced' },
        qs.length ? { v: (q => R_(x / q, U.W / q))(r.pick(qs)), tag: 'partial_reduce' } : null,
        U.wrongW && U.wrongW / gcd(x, U.wrongW) <= 100 ? { v: frac(new Q(x, U.wrongW)), tag: 'wrong_factor' } : null,
        { v: frac(new Q(U.W, x)), tag: 'flipped_fraction' },
        { v: R_(n + 1, d), tag: 'random' },
      ];
      const { choices, answer } = pack(r, correct, wrong, () => R_(Math.max(1, n + r.int(-1, 2)), d + r.int(0, 2)), true);
      const qq = U.q(x);
      return {
        kz: qq.kz, ru: qq.ru, choices, answer,
        hints: [
          T(`Бүтін неше бөліктен тұрады? ${U.whole.kz}.`, `Из скольких частей состоит целое? ${U.whole.ru}.`),
          T('Алдымен бөлшекті жаз: берілген бөлік / бүтін. Сосын алым мен бөлімді ортақ бөлгішке бөліп қысқарт.', 'Сначала запиши дробь: данная часть / целое. Потом сократи числитель и знаменатель на общий делитель.'),
          T(`Бөлшек: ${x}/${U.W}. ${x} және ${U.W} сандарының ең үлкен ортақ бөлгішін тап.`, `Дробь: ${x}/${U.W}. Найди наибольший общий делитель чисел ${x} и ${U.W}.`),
        ],
        sol: {
          kz: `${U.whole.kz}. Бөлшек: ${x}/${U.W}. ЕҮОБ = ${g}, екеуін де ${dat(g)} бөлеміз: ${x} : ${g} = ${n}, ${U.W} : ${g} = ${d}. Жауабы: ${correct}.`,
          ru: `${U.whole.ru}. Дробь: ${x}/${U.W}. НОД = ${g}, делим на ${g}: ${x} : ${g} = ${n}, ${U.W} : ${g} = ${d}. Ответ: ${correct}.`,
        },
      };
    },
  },

  // =====================================================================================================
  // frac.common_denominator: ортақ бөлімге келтіру
  // =====================================================================================================
  {
    id: 'frac.lcd_find',
    examType: 'compute', skills: ['frac.common_denominator'], from: [], difficulty: 2,
    title: { kz: 'Ең кіші ортақ бөлім', ru: 'Наименьший общий знаменатель' },
    gen(r) {
      const [b, d] = pickPair(r), a = coprimeIn(r, b), c = coprimeIn(r, d), L = lcm(b, d), G = gcd(b, d);
      const wrong = [
        b * d !== L ? { v: String(b * d), tag: 'product_not_lcm' } : null,
        Math.max(b, d) !== L ? { v: String(Math.max(b, d)), tag: 'used_one_denominator' } : null,
        G > 1 ? { v: String(G), tag: 'confused_gcd' } : null,
        { v: String(2 * L), tag: 'not_least' },
        { v: String(b + d), tag: 'added_denominators' },
      ];
      const { choices, answer } = pack(r, String(L), wrong, () => nn(L + r.int(1, 4) * r.pick([-1, 1])));
      const dmax = Math.max(b, d), dmin = Math.min(b, d);
      return {
        kz: `${a}/${b} және ${c}/${d} бөлшектерінің ең кіші ортақ бөлімін табыңыз.`,
        ru: `Найдите наименьший общий знаменатель дробей ${a}/${b} и ${c}/${d}.`,
        choices, answer,
        hints: [
          T('Екі бөлімге де қалдықсыз бөлінетін ең кіші сан қандай?', 'Какое наименьшее число делится без остатка на оба знаменателя?'),
          T('Ең кіші ортақ бөлім — бөлімдердің ЕКОЕ-сі (ең кіші ортақ еселік).', 'Наименьший общий знаменатель — это НОК знаменателей (наименьшее общее кратное).'),
          T(`Үлкен бөлімнен (${dmax}) бастап, оның еселіктерін кезекпен кіші бөлімге (${dmin}) бөліп тексер.`, `Начни с большего знаменателя (${dmax}) и по очереди проверяй его кратные: делятся ли они на меньший (${dmin}).`),
        ],
        sol: {
          kz: `ЕКОЕ(${b}, ${d}) = ${L}. Демек, ең кіші ортақ бөлім — ${L}.`,
          ru: `НОК(${b}, ${d}) = ${L}. Значит, наименьший общий знаменатель — ${L}.`,
        },
      };
    },
  },

  {
    id: 'frac.lcd_numerators',
    examType: 'compute', skills: ['frac.common_denominator'], from: [], difficulty: 2,
    title: { kz: 'Бөлшектерді ортақ бөлімге келтіру', ru: 'Приведение к общему знаменателю' },
    gen(r) {
      const [b, d] = pickPair(r), a = coprimeIn(r, b), c = coprimeIn(r, d), L = lcm(b, d), fa = L / b, fc = L / d;
      const S = (x, y, m, n2) => `${x}/${m} және ${y}/${n2}`;
      const correct = S(a * fa, c * fc, L, L);
      const wrong = [
        { v: S(a, c, L, L), tag: 'forgot_numerators' },
        fa !== fc ? { v: S(a * fc, c * fa, L, L), tag: 'swapped_factors' } : null,
        b * d !== L && b * d <= 100 ? { v: S(a * d, c * b, b * d, b * d), tag: 'product_not_lcm' } : null,   // «260/300» детям не нужно
        { v: S(a * fa, c, L, d), tag: 'converted_one_only' },
        a + L - b !== c + L - d ? { v: S(a + L - b, c + L - d, L, L), tag: 'added_not_multiplied' } : null,
      ].filter(w => !w || Math.max(...w.v.match(/\d+/g).map(Number)) <= 100);   // числа-ловушки не больше 100
      const { choices, answer } = pack(r, correct, wrong, () => S(a * fa, c * fc + r.int(1, 2), L, L), true);
      return {
        kz: `${a}/${b} және ${c}/${d} бөлшектерін ең кіші ортақ бөлімге келтіріңіз.`,
        ru: `Приведите дроби ${a}/${b} и ${c}/${d} к наименьшему общему знаменателю.`,
        choices, answer,
        hints: [
          T('Ең кіші ортақ бөлім қандай? Әр бөлшектің бөлімі оған неше есе өседі?', 'Каким будет наименьший общий знаменатель? Во сколько раз вырастет знаменатель каждой дроби?'),
          IDEA_PROP,
          T(`Алдымен екі бөлімнің (${b} және ${d}) ЕКОЕ-сін тап. Сосын әр бөлшектің қосымша көбейткішін тап.`, `Сначала найди НОК знаменателей (${b} и ${d}). Потом найди дополнительный множитель каждой дроби.`),
        ],
        sol: {
          kz: `ЕКОЕ(${b}, ${d}) = ${L}. Қосымша көбейткіштер: ${L} : ${b} = ${fa}, ${L} : ${d} = ${fc}. ${a} · ${fa} = ${a * fa}, ${c} · ${fc} = ${c * fc}. Жауабы: ${correct}.`,
          ru: `НОК(${b}, ${d}) = ${L}. Дополнительные множители: ${L} : ${b} = ${fa}, ${L} : ${d} = ${fc}. ${a} · ${fa} = ${a * fa}, ${c} · ${fc} = ${c * fc}. Ответ: ${correct.replace(' және ', ' и ')}.`,
        },
      };
    },
  },

  {
    id: 'frac.lcd_factor',
    examType: 'compute', skills: ['frac.common_denominator'], from: [], difficulty: 2,
    title: { kz: 'Қосымша көбейткіш', ru: 'Дополнительный множитель' },
    gen(r) {
      const single = r.chance(0.5);
      let kz, ru, correct, wrong, sol, step;
      if (single) {
        const b = r.int(2, 9), a = coprimeIn(r, b, 1, b), k = r.int(2, 9), D = b * k;
        correct = k;
        wrong = [{ v: D, tag: 'answered_items' }, { v: b, tag: 'denominator_as_factor' }, { v: D - b, tag: 'added_not_multiplied' }, { v: a * k, tag: 'answered_items' }];
        kz = `${a}/${b} бөлшегінің бөлімін ${D} ету үшін оның алымы мен бөлімін қандай санға көбейту керек?`;
        ru = `На какое число нужно умножить числитель и знаменатель дроби ${a}/${b}, чтобы знаменатель стал ${D}?`;
        step = T(`Бөлім ${b} → ${D}. Неше есе өскенін тап: ${D} : ${b}.`, `Знаменатель ${b} → ${D}. Найди, во сколько раз он вырос: ${D} : ${b}.`);
        sol = T(`${D} : ${b} = ${k}. Алым мен бөлімді ${k} санына көбейтеміз: ${a}/${b} = ${a * k}/${D}. Жауабы: ${k}.`, `${D} : ${b} = ${k}. Умножаем числитель и знаменатель на ${k}: ${a}/${b} = ${a * k}/${D}. Ответ: ${k}.`);
      } else {
        const [b, d] = pickPair(r), a = coprimeIn(r, b), c = coprimeIn(r, d), L = lcm(b, d), fa = L / b, fc = L / d;
        correct = fc;
        wrong = [{ v: fa, tag: 'swapped_factors' }, { v: d, tag: 'denominator_as_factor' }, { v: L, tag: 'answered_items' }, { v: L - d, tag: 'added_not_multiplied' }];
        kz = `${a}/${b} және ${c}/${d} бөлшектерін ең кіші ортақ бөлімге келтіргенде, ${c}/${d} бөлшегінің қосымша көбейткіші қандай?`;
        ru = `Каков дополнительный множитель дроби ${c}/${d} при приведении дробей ${a}/${b} и ${c}/${d} к наименьшему общему знаменателю?`;
        step = T(`Алдымен ${b} және ${d} бөлімдерінің ЕКОЕ-сін тап. Сосын оны ${c}/${d} бөлшегінің өз бөліміне бөл.`, `Сначала найди НОК знаменателей ${b} и ${d}. Потом раздели его на знаменатель дроби ${c}/${d}.`);
        sol = T(`ЕКОЕ(${b}, ${d}) = ${L}. ${c}/${d} бөлшегінің қосымша көбейткіші: ${L} : ${d} = ${fc}. Жауабы: ${fc}.`, `НОК(${b}, ${d}) = ${L}. Дополнительный множитель дроби ${c}/${d}: ${L} : ${d} = ${fc}. Ответ: ${fc}.`);
      }
      const { choices, answer } = pack(r, String(correct), wrong.map(w => ({ ...w, v: String(w.v) })), () => nn(near(r, correct, 0.6, 1)));
      return {
        kz, ru, choices, answer,
        hints: [
          T('Бөлім неше есе өсуі керек?', 'Во сколько раз должен вырасти знаменатель?'),
          T('Қосымша көбейткіш = жаңа (ортақ) бөлім : бөлшектің өз бөлімі. Алым да, бөлім де осы санға көбейеді.', 'Дополнительный множитель = новый (общий) знаменатель : прежний знаменатель. На него умножают и числитель, и знаменатель.'),
          step,
        ],
        sol,
      };
    },
  },

  // =====================================================================================================
  // frac.compare: бөлшектерді салыстыру
  // =====================================================================================================
  {
    id: 'frac.compare_extreme',
    examType: 'compute', skills: ['frac.compare'], from: [], difficulty: 2,
    title: { kz: 'Ең үлкен және ең кіші бөлшек', ru: 'Наибольшая и наименьшая дробь' },
    gen(r) {
      const mode = r.pick(['sameDen', 'sameNum', 'bench', 'bench']), big = r.chance(0.5);
      let list; // [{n, d, correct}]
      for (let guard = 0; ; guard++) {
        if (guard > 200) throw new Error('compare_extreme: cannot build');
        if (mode === 'sameDen') {
          const d = r.int(8, 17), ns = r.shuffle(Array.from({ length: d - 1 }, (_, i) => i + 1)).slice(0, 5);
          list = ns.map(n => ({ n, d }));
        } else if (mode === 'sameNum') {
          const n = r.int(1, 7), ds = r.shuffle(Array.from({ length: 20 - n }, (_, i) => n + 1 + i)).slice(0, 5);
          list = ds.map(d => ({ n, d }));
        } else if (big) {
          const d = r.int(5, 12), n = r.int(Math.floor(d / 2) + 1, d - 1);
          const trapN = n + r.int(1, 3);
          list = [{ n, d }, { n: trapN, d: 2 * trapN + r.int(1, 4) }];
          while (list.length < 5) { const m = r.int(d + 1, 30), k = r.int(1, Math.floor((m - 1) / 2)); list.push({ n: k, d: m }); }
        } else {
          const d = r.int(7, 15), n = r.int(3, Math.floor((d - 1) / 2)), n1 = r.int(2, n - 1);
          list = [{ n, d }, { n: n1, d: r.int(n1 + 1, 2 * n1 - 1) }];
          while (list.length < 5) { const m = r.int(3, 9), k = r.int(Math.floor(m / 2) + 1, m - 1); list.push({ n: k, d: m }); }
        }
        const vals = list.map(f => f.n / f.d);
        if (new Set(vals.map(v => v.toFixed(9))).size < 5) continue;
        break;
      }
      const vals = list.map(f => f.n / f.d);
      const target = big ? Math.max(...vals) : Math.min(...vals);
      const ci = vals.indexOf(target);
      const maxN = Math.max(...list.map(f => f.n)), minN = Math.min(...list.map(f => f.n));
      const maxD = Math.max(...list.map(f => f.d)), minD = Math.min(...list.map(f => f.d));
      const numVaries = maxN !== minN, denVaries = maxD !== minD;
      const wrong = list.map((f, i) => {
        if (i === ci) return null;
        let tag = 'random';
        if (big) { if (numVaries && f.n === maxN) tag = 'numerator_only_compare'; else if (denVaries && f.d === maxD) tag = 'bigger_denominator_bigger'; }
        else if (numVaries && f.n === minN) tag = 'numerator_only_compare'; else if (denVaries && f.d === minD) tag = 'whole_number_bias';
        return { v: R_(f.n, f.d), tag };
      });
      const correct = R_(list[ci].n, list[ci].d);
      const { choices, answer } = pack(r, correct, wrong, () => { throw new Error('compare_extreme: filler'); });
      const kids = r.chance(0.4);
      const kz = kids ? `Бес бала бірдей шоколад плиткасынан әртүрлі бөлік жеді. Ең ${big ? 'көп' : 'аз'} жеген баланың үлесі қайсы?` : `Қай бөлшек ең ${big ? 'үлкен' : 'кіші'}?`;
      const ru = kids ? `Пять детей съели разные части одинаковых шоколадок. Какая из долей самая ${big ? 'большая' : 'маленькая'}?` : `Какая дробь самая ${big ? 'большая' : 'маленькая'}?`;
      const shown = list.map(f => R_(f.n, f.d)).join(', ');
      const idea = { sameDen: T('Бөлімдері бірдей болса, алымы үлкен бөлшек үлкен.', 'Если знаменатели одинаковы, больше та дробь, у которой числитель больше.'),
        sameNum: T('Алымдары бірдей болса, бөлімі кіші бөлшек үлкен: бүтін аз бөлікке бөлінсе, әр бөлік ірі болады.', 'Если числители одинаковы, больше та дробь, у которой знаменатель меньше: чем на меньшее число частей поделено целое, тем крупнее каждая часть.'),
        bench: T('Әр бөлшекті 1/2 санымен салыстыр: алым бөлімнің жартысынан үлкен бе?', 'Сравни каждую дробь с 1/2: больше ли числитель половины знаменателя?') }[mode];
      const step = { sameDen: T(`Бөлімдері бірдей (${list[0].d}). Енді алымдарды салыстыр.`, `Знаменатели одинаковы (${list[0].d}). Теперь сравни числители.`),
        sameNum: T(`Алымдары бірдей (${list[0].n}). Енді бөлімдерді салыстыр.`, `Числители одинаковы (${list[0].n}). Теперь сравни знаменатели.`),
        bench: T('Әр бөлшек үшін: бөлімнің жартысы алымнан үлкен бе, кіші ме? Соны жаз.', 'Для каждой дроби: половина знаменателя больше числителя или меньше? Запиши это.') }[mode];
      const solTxt = { sameDen: [`Бөлімдері бірдей: алымы ${big ? 'ең үлкен' : 'ең кіші'} бөлшек ${big ? 'ең үлкен' : 'ең кіші'}.`, `Знаменатели одинаковы: ${big ? 'наибольшая' : 'наименьшая'} дробь — с ${big ? 'наибольшим' : 'наименьшим'} числителем.`],
        sameNum: [`Алымдары бірдей: бөлімі ${big ? 'ең кіші' : 'ең үлкен'} бөлшек ${big ? 'ең үлкен' : 'ең кіші'}.`, `Числители одинаковы: ${big ? 'наибольшая' : 'наименьшая'} дробь — с ${big ? 'наименьшим' : 'наибольшим'} знаменателем.`],
        bench: [`${correct} — 1/2 санынан ${big ? 'үлкен' : 'кіші'}, ал қалғандары 1/2 санынан ${big ? 'кіші' : 'үлкен'}.`, `${correct} ${big ? 'больше' : 'меньше'} 1/2, а остальные ${big ? 'меньше' : 'больше'} 1/2.`] }[mode];
      return {
        kz, ru, choices, answer,
        hints: [T('Бөлшектердің бөлімдері немесе алымдары бірдей ме? Салыстырудың ең оңай жолы қандай?', 'Одинаковы ли у дробей знаменатели или числители? Какой способ сравнения самый простой?'), idea, step],
        sol: { kz: `${shown}. ${solTxt[0]} Жауабы: ${correct}.`, ru: `${shown}. ${solTxt[1]} Ответ: ${correct}.` },
      };
    },
  },

  {
    id: 'frac.compare_order',
    examType: 'compute', skills: ['frac.compare'], from: [], difficulty: 2,
    title: { kz: 'Бөлшектерді ретке келтіру', ru: 'Упорядочить дроби' },
    gen(r) {
      const asc = r.chance(0.5);
      let fs, L;
      for (;;) {
        const ds = [3, 4, 5, 6, 8, 9, 10, 12];
        fs = [0, 1, 2].map(() => { const d = r.pick(ds); return { d, n: coprimeIn(r, d) }; });
        L = lcm(lcm(fs[0].d, fs[1].d), fs[2].d);
        const vs = fs.map(f => f.n * (L / f.d));
        if (L <= 60 && new Set(vs).size === 3 && new Set(fs.map(f => f.d)).size >= 2) break;
      }
      const key = f => f.n * (L / f.d);
      const txt = f => R_(f.n, f.d);
      const sep = asc ? ' < ' : ' > ';
      const fmt = arr => arr.map(txt).join(sep);
      const sortBy = (fn, up) => fs.slice().sort((x, y) => (up ? fn(x) - fn(y) : fn(y) - fn(x)));
      const correctArr = sortBy(key, asc);
      const correct = fmt(correctArr);
      const perms = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]].map(p => fmt(p.map(i => fs[i])));
      const wrong = [
        { v: fmt(sortBy(key, !asc)), tag: 'reversed_order' },
        { v: fmt(sortBy(f => f.n, asc)), tag: 'numerator_only_compare' },
        { v: fmt(sortBy(f => f.d, asc)), tag: 'bigger_denominator_bigger' },
        ...perms.map(v => ({ v, tag: 'random' })),
      ];
      const { choices, answer } = pack(r, correct, wrong, () => { throw new Error('compare_order: filler'); }, true);
      const list = fs.map(txt).join(', ');
      return {
        kz: `Бөлшектерді ${asc ? 'өсу' : 'кему'} ретімен орналастырыңыз: ${list}.`,
        ru: `Расположите дроби в порядке ${asc ? 'возрастания' : 'убывания'}: ${list}.`,
        choices, answer,
        hints: [
          T('Бөлшектердің бөлімдері әртүрлі. Оларды қалай салыстыруға болады?', 'У дробей разные знаменатели. Как их можно сравнить?'),
          T('Ортақ бөлімге келтір: бөлімдері бірдей болса, алымы үлкен бөлшек үлкен.', 'Приведи к общему знаменателю: при одинаковых знаменателях больше дробь с большим числителем.'),
          T(`Үш бөлімнің (${fs.map(f => f.d).join(', ')}) ЕКОЕ-сін тап.`, `Найди НОК трёх знаменателей (${fs.map(f => f.d).join(', ')}).`),
        ],
        sol: {
          kz: `Ортақ бөлім ${L}: ${fs.map(f => `${f.n * (L / f.d)}/${L}`).join(', ')}. Алымдарын салыстырамыз. Жауабы: ${correct}.`,
          ru: `Общий знаменатель ${L}: ${fs.map(f => `${f.n * (L / f.d)}/${L}`).join(', ')}. Сравниваем числители. Ответ: ${correct}.`,
        },
      };
    },
  },

  {
    id: 'frac.compare_true',
    examType: 'compute', skills: ['frac.compare'], from: [], difficulty: 2,
    title: { kz: 'Дұрыс теңсіздікті табу', ru: 'Верное неравенство' },
    gen(r) {
      const mkPair = () => {
        for (;;) {
          const kind = r.pick(['den', 'num', 'cross', 'cross']);
          let p, q;
          if (kind === 'den') { const d = r.int(4, 12); p = { n: r.int(1, d - 1), d }; q = { n: r.int(1, d - 1), d }; }
          else if (kind === 'num') { const n = r.int(1, 5); p = { n, d: r.int(n + 1, 14) }; q = { n, d: r.int(n + 1, 14) }; }
          else { const d1 = r.int(2, 12), d2 = r.int(2, 12); p = { n: r.int(1, d1 - 1), d: d1 }; q = { n: r.int(1, d2 - 1), d: d2 }; }
          if (p.n * q.d === q.n * p.d) continue;
          return [p, q];
        }
      };
      const pairs = [], seen = new Set();
      while (pairs.length < 5) {
        const [p, q] = mkPair(), k = [R_(p.n, p.d), R_(q.n, q.d)].sort().join('|');
        if (seen.has(k)) continue;
        seen.add(k); pairs.push([p, q]);
      }
      const stmt = ([p, q], rel) => `${R_(p.n, p.d)} ${rel} ${R_(q.n, q.d)}`;
      const trueRel = ([p, q]) => (p.n * q.d > q.n * p.d ? '>' : '<');
      const flip = rel => (rel === '>' ? '<' : '>');
      const correct = stmt(pairs[0], trueRel(pairs[0]));
      const wrong = pairs.slice(1).map(pr => {
        const [p, q] = pr, rel = flip(trueRel(pr));
        const naiveRel = p.n !== q.n ? (p.n > q.n ? '>' : '<') : (p.d > q.d ? '>' : '<');
        let tag = 'random';
        if (naiveRel === rel) tag = p.n !== q.n ? 'numerator_only_compare' : 'bigger_denominator_bigger';
        return { v: stmt(pr, rel), tag };
      });
      const { choices, answer } = pack(r, correct, wrong, () => { throw new Error('compare_true: filler'); }, true);
      return {
        kz: 'Қай теңсіздік дұрыс?', ru: 'Какое неравенство верно?', choices, answer,
        hints: [
          T('Әр жұпта бөлшектерді салыстырудың қандай ыңғайлы жолы бар?', 'Какой удобный способ сравнения есть в каждой паре?'),
          T('Бөлімдері бірдей болса — алымдарын салыстыр; алымдары бірдей болса — бөлімі кіші бөлшек үлкен; әйтпесе 1/2 санымен немесе ортақ бөлім арқылы салыстыр.', 'Одинаковые знаменатели: сравни числители. Одинаковые числители: больше дробь с меньшим знаменателем. Иначе сравни с 1/2 или приведи к общему знаменателю.'),
          T('Алдымен бөлімдері немесе алымдары бірдей жұптарды тексер.', 'Сначала проверь пары, где одинаковы знаменатели или числители.'),
        ],
        sol: {
          kz: `Дұрыс теңсіздік: ${correct}. Қалғандарында белгі кері қойылған.`,
          ru: `Верное неравенство: ${correct}. В остальных знак стоит наоборот.`,
        },
      };
    },
  },

  // =====================================================================================================
  // frac.add_sub: қосу және азайту
  // =====================================================================================================
  {
    id: 'frac.add_same',
    examType: 'compute', skills: ['frac.add_sub'], from: [], difficulty: 1,
    title: { kz: 'Бөлімдері бірдей бөлшектерді қосу және азайту', ru: 'Сложение и вычитание дробей с равными знаменателями' },
    gen(r) {
      for (;;) {
        const d = r.int(5, 12), sub = r.chance(0.35);
        const a = r.int(1, d - 1), c = r.int(1, d - 1);
        if (sub && a <= c) continue;
        const sn = sub ? a - c : a + c;
        const rest = sn % d;
        if (gcd(rest || sn, d) !== 1 || rest === 0) continue;
        const ans = new Q(sn, d);
        const correct = mixed(ans);
        const [n1, n2] = twoNames(r);
        const wrong = sub ? [
          { v: mixed(new Q(a + c, d)), tag: 'wrong_operation' }, { v: R_(a - c, 2 * d), tag: 'added_denominators' },
          { v: frac(new Q(d, a - c)), tag: 'flipped_fraction' }, { v: mixed(new Q(sn + 1, d)), tag: 'random' }, { v: mixed(new Q(sn - 1, d)), tag: 'random' },
        ] : [
          { v: R_(a + c, 2 * d), tag: 'added_denominators' }, { v: a > c ? R_(a - c, d) : null, tag: 'wrong_operation' },
          { v: frac(new Q(d, sn)), tag: 'flipped_fraction' }, { v: mixed(new Q(sn + 1, d)), tag: 'random' }, { v: mixed(new Q(sn - 1, d)), tag: 'random' },
        ];
        // части ОДНОГО целого (пицца, путь, батончик) в сумме не превышают целого; сумма больше 1 бывает только у раздельных величин (литры)
        const ctx = sub ? r.pick(['bar', 'expr']) : r.pick(sn < d ? ['pizza', 'path', 'litres', 'expr'] : ['litres', 'expr']);
        const oneWhole = ctx === 'pizza' || ctx === 'path' || ctx === 'bar';
        let kz, ru;
        if (ctx === 'litres') {
          kz = `${n1} ${a}/${d} литр су ішті, ${n2} ${c}/${d} литр су ішті. Екеуі бірге қанша литр су ішті?`;
          ru = `${n1} ${ruV(n1, 'выпил')} ${a}/${d} литра воды, а ${n2} ${ruV(n2, 'выпил')} ${c}/${d} литра. Сколько литров воды они выпили вместе?`;
        } else if (ctx === 'pizza') {
          kz = `${n1} пиццаның ${a}/${d} бөлігін, ${n2} ${c}/${d} бөлігін жеді. Екеуі бірге пиццаның қандай бөлігін жеді?`;
          ru = `${n1} ${ruV(n1, 'съел')} ${a}/${d} пиццы, а ${n2} ${ruV(n2, 'съел')} ${c}/${d}. Какую часть пиццы они съели вместе?`;
        } else if (ctx === 'path') {
          kz = `Турист жолдың ${a}/${d} бөлігін таңертең, ${c}/${d} бөлігін түстен кейін жүрді. Барлығы жолдың қандай бөлігін жүрді?`;
          ru = `Турист прошёл ${a}/${d} пути утром и ${c}/${d} пути днём. Какую часть пути он прошёл всего?`;
        } else if (ctx === 'bar') {
          kz = `Энергия батончигінің ${a}/${d} бөлігі қалды. ${n1} бүтін батончиктің ${c}/${d} бөлігін жеді. Енді батончиктің қандай бөлігі қалды?`;
          ru = `Осталось ${a}/${d} энергетического батончика. ${n1} ${ruV(n1, 'съел')} ${c}/${d} целого батончика. Какая часть батончика осталась теперь?`;
        } else {
          kz = `Есептеңіз: ${a}/${d} ${sub ? '−' : '+'} ${c}/${d}`; ru = `Вычислите: ${a}/${d} ${sub ? '−' : '+'} ${c}/${d}`;
        }
        const { choices, answer } = pack(r, correct, wrong, () => mixed(new Q(Math.max(1, sn + r.int(-2, 3)), d)));
        const rawS = R_(sn, d);
        return {
          kz, ru, choices, answer, oneWhole,
          hints: [
            T(`Бөлімдері бірдей бөлшектерді ${sub ? 'азайтқанда' : 'қосқанда'} бөлімге не болады?`, `Что происходит со знаменателем, когда ${sub ? 'вычитаешь' : 'складываешь'} дроби с одинаковыми знаменателями?`),
            T(`Бөлімі бірдей бөлшектерді ${sub ? 'азайтқанда' : 'қосқанда'} алымдарын ${sub ? 'азайтамыз' : 'қосамыз'}, бөлім сол күйінде қалады.`, `Дроби с одинаковыми знаменателями ${sub ? 'вычитают' : 'складывают'} так: числители ${sub ? 'вычитают' : 'складывают'}, знаменатель остаётся тем же.`),
            T(`Алымдарды ${sub ? 'азайт' : 'қос'}: ${a} ${sub ? '−' : '+'} ${c}.`, `${sub ? 'Вычти' : 'Сложи'} числители: ${a} ${sub ? '−' : '+'} ${c}.`),
          ],
          sol: {
            kz: `Бөлімдері бірдей, сондықтан алымдарын ${sub ? 'азайтамыз' : 'қосамыз'}, бөлім өзгермейді: ${a}/${d} ${sub ? '−' : '+'} ${c}/${d} = ${rawS}${rawS !== correct ? ` = ${correct}` : ''}.`,
            ru: `Знаменатели одинаковы, поэтому числители ${sub ? 'вычитаем' : 'складываем'}, знаменатель не меняется: ${a}/${d} ${sub ? '−' : '+'} ${c}/${d} = ${rawS}${rawS !== correct ? ` = ${correct}` : ''}.`,
          },
        };
      }
    },
  },

  {
    id: 'frac.add_diff',
    examType: 'compute', skills: ['frac.add_sub'], from: [], difficulty: 2,
    title: { kz: 'Бөлімдері әртүрлі бөлшектерді қосу және азайту', ru: 'Сложение и вычитание дробей с разными знаменателями' },
    gen(r) {
      for (;;) {
        const [b, d] = pickPair(r, { general: 5, divisible: 3, coprime: 2 });
        const a = coprimeIn(r, b), c = coprimeIn(r, d), L = lcm(b, d), fa = L / b, fc = L / d;
        const P = new Q(a, b), S = new Q(c, d);
        const sub = r.chance(0.4);
        if (sub && !S.lt(P)) continue;
        const ans = sub ? P.sub(S) : P.add(S);
        if (ans.n === 0) continue;
        const correct = mixed(ans);
        const sn = sub ? a * fa - c * fc : a * fa + c * fc;
        const pos = x => (x > 0 ? x : null);
        const wrong = sub ? [
          { v: mixed(P.add(S)), tag: 'wrong_operation' },
          { v: a > c ? R_(a - c, L) : null, tag: 'no_common_denominator' },
          { v: a > c ? R_(a - c, b + d) : null, tag: 'added_denominators' },
          { v: pos(a * fa - c) ? R_(a * fa - c, L) : null, tag: 'converted_one_only' },
          { v: mixed(new Q(Math.max(1, sn + 1), L)), tag: 'random' },
        ] : [
          { v: R_(a + c, b + d), tag: 'added_denominators' }, { v: R_(a + c, L), tag: 'no_common_denominator' },
          { v: R_(a * fa + c, L), tag: 'converted_one_only' }, { v: mixed(new Q(sn + 1, L)), tag: 'random' }, { v: mixed(new Q(sn - 1, L)), tag: 'random' },
        ];
        // «путь» = части одного целого: сумма не больше 1; при сумме больше 1 — только раздельные величины (литры)
        const ctx = sub ? r.pick(['juice', 'expr']) : r.pick(P.add(S).lt(1) ? ['path', 'litres', 'expr'] : ['litres', 'expr']);
        const oneWhole = ctx === 'path';
        let kz, ru;
        if (ctx === 'litres') {
          kz = `Бірінші құмыраға ${a}/${b} литр, екіншісіне ${c}/${d} литр су құйды. Барлығы қанша литр су құйды?`;
          ru = `В первый кувшин налили ${a}/${b} литра воды, во второй ${c}/${d} литра. Сколько литров воды налили всего?`;
        } else if (ctx === 'path') {
          kz = `Турист бірінші күні жолдың ${a}/${b} бөлігін, екінші күні ${c}/${d} бөлігін жүрді. Барлығы жолдың қандай бөлігін жүрді?`;
          ru = `Турист в первый день прошёл ${a}/${b} пути, во второй день ${c}/${d} пути. Какую часть пути он прошёл всего?`;
        } else if (ctx === 'juice') {
          kz = `Құмырада ${a}/${b} литр шырын бар еді. ${c}/${d} литрін ішті. Қанша литр шырын қалды?`;
          ru = `В кувшине было ${a}/${b} литра сока. Выпили ${c}/${d} литра. Сколько литров сока осталось?`;
        } else {
          kz = `Есептеңіз: ${a}/${b} ${sub ? '−' : '+'} ${c}/${d}`; ru = `Вычислите: ${a}/${b} ${sub ? '−' : '+'} ${c}/${d}`;
        }
        const { choices, answer } = pack(r, correct, wrong, () => (r.chance(0.5) ? mixed(new Q(Math.max(1, sn + r.int(-3, 3)), L)) : anyFrac(r, L)));
        const rawS = R_(sn, L);
        const tail = rawS !== correct ? ` = ${correct}` : '';
        return {
          kz, ru, choices, answer, oneWhole,
          hints: [
            T('Бөлімдері әртүрлі бөлшектерді бірден қосуға (азайтуға) бола ма? Алдымен не істеу керек?', 'Можно ли сразу складывать (вычитать) дроби с разными знаменателями? Что нужно сделать сначала?'),
            T('Алдымен ортақ бөлімге келтір (ЕКОЕ), сосын алымдарын қос (азайт), бөлім өзгермейді. Соңында қысқарт.', 'Сначала приведи к общему знаменателю (НОК), потом сложи (вычти) числители, знаменатель не меняется. В конце сократи.'),
            T(`Алдымен ${b} және ${d} бөлімдерінің ЕКОЕ-сін тап.`, `Сначала найди НОК знаменателей ${b} и ${d}.`),
          ],
          sol: {
            kz: `ЕКОЕ(${b}, ${d}) = ${L}. ${a}/${b} = ${a * fa}/${L}, ${c}/${d} = ${c * fc}/${L}. ${a * fa}/${L} ${sub ? '−' : '+'} ${c * fc}/${L} = ${rawS}${tail}.`,
            ru: `НОК(${b}, ${d}) = ${L}. ${a}/${b} = ${a * fa}/${L}, ${c}/${d} = ${c * fc}/${L}. ${a * fa}/${L} ${sub ? '−' : '+'} ${c * fc}/${L} = ${rawS}${tail}.`,
          },
        };
      }
    },
  },

  {
    id: 'frac.to_whole',
    examType: 'word', skills: ['frac.add_sub'], from: [], difficulty: 1,
    title: { kz: 'Бүтінге дейін қанша жетіспейді', ru: 'Сколько не хватает до целого' },
    gen(r) {
      const b = r.int(3, 20), a = coprimeIn(r, b), rest = R_(b - a, b);
      const ctx = r.pick(['phone', 'pool', 'expr', 'plus', 'two']);
      let kz, ru, correct = rest, wrong;
      const base = [
        { v: R_(a, b), tag: 'answered_given_part' }, { v: R_(b - a, a), tag: 'part_to_part' },
        { v: R_(Math.max(1, b - a - 1), b), tag: 'random' }, { v: R_(b - a + 1, b), tag: 'random' },
      ];
      wrong = base;
      if (ctx === 'phone') {
        kz = `Телефон батареясы ${a}/${b} бөлігіне дейін зарядталған. Батареяны толық зарядтау үшін оның қандай бөлігі жетіспейді?`;
        ru = `Батарея телефона заряжена на ${a}/${b}. Какой части не хватает до полного заряда?`;
      } else if (ctx === 'pool') {
        kz = `Бассейн ${a}/${b} бөлігіне дейін толтырылды. Бассейннің қандай бөлігін әлі толтыру керек?`;
        ru = `Бассейн наполнен на ${a}/${b}. Какую часть бассейна ещё нужно наполнить?`;
      } else if (ctx === 'expr') {
        kz = `1 − ${a}/${b} өрнегінің мәнін табыңыз.`; ru = `Найдите значение выражения 1 − ${a}/${b}.`;
      } else if (ctx === 'plus') {
        kz = `${a}/${b} + ? = 1. Жетіспейтін бөлшекті табыңыз.`; ru = `${a}/${b} + ? = 1. Найдите недостающую дробь.`;
      } else {
        correct = M(1, b - a, b);
        wrong = [
          { v: `1 ${a}/${b}`, tag: 'borrow_forgotten' }, { v: rest, tag: 'lost_whole_part' },
          { v: `2 ${b - a}/${b}`, tag: 'borrow_forgotten' }, { v: `1 ${Math.max(1, a + 1)}/${b}`, tag: 'random' }, { v: `1 ${b - a === 1 ? 2 : b - a - 1}/${b}`, tag: 'random' },
        ];
        kz = `2 − ${a}/${b} өрнегінің мәнін табыңыз.`; ru = `Найдите значение выражения 2 − ${a}/${b}.`;
      }
      const { choices, answer } = pack(r, correct, wrong, () => (ctx === 'two' ? `${r.int(1, 2)} ${r.int(1, b - 1)}/${b}` : anyFrac(r, b)));
      const two = ctx === 'two';
      return {
        kz, ru, choices, answer,
        hints: [
          T(`Бүтін 1 санын бөлімі ${b} болатын бөлшек түрінде қалай жазуға болады?`, `Как записать единицу в виде дроби со знаменателем ${b}?`),
          T(`Бүтінді бөлшек ретінде жаз: 1 = ${b}/${b}${two ? ', сондықтан 2 = 1 + ' + b + '/' + b : ''}. Сосын алымдарын азайт, бөлім өзгермейді.`, `Запиши целое как дробь: 1 = ${b}/${b}${two ? ', поэтому 2 = 1 + ' + b + '/' + b : ''}. Потом вычти числители, знаменатель не меняется.`),
          T(two ? `Бір бүтінді бөлшекке айналдыр: 2 = 1 + ${b}/${b}. Енді ${b}/${b} − ${a}/${b} есепте.` : `Алымдарды азайт: ${b} − ${a}. Бөлім — ${b}.`, two ? `Займи единицу: 2 = 1 + ${b}/${b}. Теперь вычисли ${b}/${b} − ${a}/${b}.` : `Вычти числители: ${b} − ${a}. Знаменатель — ${b}.`),
        ],
        sol: {
          kz: two ? `2 = 1 + ${b}/${b}. ${b}/${b} − ${a}/${b} = ${b - a}/${b}. Жауабы: ${correct}.` : `1 = ${b}/${b}. ${b}/${b} − ${a}/${b} = ${b - a}/${b}. Жауабы: ${correct}.`,
          ru: two ? `2 = 1 + ${b}/${b}. ${b}/${b} − ${a}/${b} = ${b - a}/${b}. Ответ: ${correct}.` : `1 = ${b}/${b}. ${b}/${b} − ${a}/${b} = ${b - a}/${b}. Ответ: ${correct}.`,
        },
      };
    },
  },

  {
    id: 'frac.rest_of_path',
    examType: 'word', skills: ['frac.add_sub'], from: [], difficulty: 3,
    title: { kz: 'Қалған бөлікті табу', ru: 'Найти оставшуюся часть' },
    gen(r) {
      for (;;) {
        const [b, d] = r.chance(0.25) ? (() => { const x = r.int(5, 12); return [x, x]; })() : pickPair(r, { general: 5, divisible: 3, coprime: 3 });
        const a = coprimeIn(r, b), c = coprimeIn(r, d), P = new Q(a, b), S = new Q(c, d), U = P.add(S);
        if (!U.lt(1)) continue;
        const ans = new Q(1).sub(U);
        const pos = q => (q.n > 0 ? mixed(q) : null);
        const wrong = [
          { v: frac(U), tag: 'answered_used' }, { v: pos(new Q(1).sub(P)), tag: 'one_part_only' }, { v: pos(new Q(1).sub(S)), tag: 'one_part_only' },
          { v: pos(P.lt(S) ? S.sub(P) : P.sub(S)), tag: 'wrong_operation' },
          { v: (a + c) < (b + d) ? pos(new Q(1).sub(new Q(a + c, b + d))) : null, tag: 'added_denominators' },
        ];
        const correct = frac(ans), nm = r.pick(NAMES_KZ);
        const ctx = r.pick(['path', 'book', 'wall']);
        const kz = ctx === 'path' ? `Турист жолдың ${a}/${b} бөлігін таңертең, ${c}/${d} бөлігін түстен кейін жүрді. Жолдың қандай бөлігі қалды?`
          : ctx === 'book' ? `${nm} кітаптың ${a}/${b} бөлігін бірінші күні, ${c}/${d} бөлігін екінші күні оқыды. Кітаптың қандай бөлігі оқылмай қалды?`
            : `Қабырғаның ${a}/${b} бөлігін ақ, ${c}/${d} бөлігін көк түске бояды. Қабырғаның қандай бөлігі бояусыз қалды?`;
        const ru = ctx === 'path' ? `Турист прошёл ${a}/${b} пути утром и ${c}/${d} пути днём. Какая часть пути осталась?`
          : ctx === 'book' ? `${nm} ${ruV(nm, 'прочитал')} ${a}/${b} книги в первый день и ${c}/${d} книги во второй. Какая часть книги осталась непрочитанной?`
            : `${a}/${b} стены покрасили в белый цвет, ${c}/${d} стены — в синий. Какая часть стены осталась некрашеной?`;
        const { choices, answer } = pack(r, correct, wrong, () => (r.chance(0.5) ? frac(new Q(Math.max(1, ans.n + r.int(-2, 2)), ans.d)) : anyFrac(r, ans.d)));
        return {
          kz, ru, choices, answer,
          hints: [
            T('Екі бөлік қосылғанда бүтіннің қандай бөлігін алады? Сосын қалғанын қалай табуға болады?', 'Какую часть целого занимают две части вместе? Как после этого найти остаток?'),
            T('Қалғаны = 1 − (бірінші бөлік + екінші бөлік). Бөлімдері әртүрлі болса, алдымен ортақ бөлімге келтір.', 'Остаток = 1 − (первая часть + вторая часть). Если знаменатели разные, сначала приведи к общему.'),
            T(`Алдымен екі бөлікті қос: ${a}/${b} + ${c}/${d}.`, `Сначала сложи две части: ${a}/${b} + ${c}/${d}.`),
          ],
          sol: {
            kz: `Барлығы: ${a}/${b} + ${c}/${d} = ${frac(U)}. Қалғаны: 1 − ${frac(U)} = ${correct}.`,
            ru: `Всего: ${a}/${b} + ${c}/${d} = ${frac(U)}. Осталось: 1 − ${frac(U)} = ${correct}.`,
          },
        };
      }
    },
  },

  // =====================================================================================================
  // frac.mixed: аралас сандар
  // =====================================================================================================
  {
    id: 'frac.mixed_convert',
    examType: 'compute', skills: ['frac.mixed'], from: [], difficulty: 2,
    title: { kz: 'Аралас сан және бұрыс бөлшек', ru: 'Смешанное число и неправильная дробь' },
    gen(r) {
      const kind = r.pick(['toImp', 'toMix', 'story']);
      const d = r.int(2, 9), n = coprimeIn(r, d), w = r.int(1, 9), N = w * d + n;
      if (kind === 'toImp') {
        const correct = R_(N, d);
        const wrong = [
          { v: R_(n, d), tag: 'lost_whole_part' }, { v: R_(w + n, d), tag: 'whole_added_to_numerator' },
          { v: R_(+`${w}${n}`, d), tag: 'concatenated_digits' }, { v: R_(w * n + d, d), tag: 'whole_times_numerator' }, { v: R_(N + 1, d), tag: 'random' },
        ];
        const { choices, answer } = pack(r, correct, wrong, () => R_(Math.max(1, N + r.int(-3, 3) * (r.chance(0.5) ? 1 : d)), d));
        return {
          kz: `${w} ${n}/${d} аралас санын бұрыс бөлшек түрінде жазыңыз.`,
          ru: `Запишите смешанное число ${w} ${n}/${d} в виде неправильной дроби.`,
          choices, answer,
          hints: [
            T(`Бір бүтіннің ішінде бөлімі ${d} болатын неше бөлік бар?`, `Сколько долей со знаменателем ${d} помещается в одном целом?`),
            T('Аралас санды бұрыс бөлшекке айналдыру: бүтін бөлікті бөлімге көбейтіп, алымды қос; бөлім өзгермейді.', 'Смешанное число в неправильную дробь: целую часть умножь на знаменатель и прибавь числитель; знаменатель не меняется.'),
            T(`Бүтін бөлікті бөлімге көбейт: ${w} · ${d}.`, `Умножь целую часть на знаменатель: ${w} · ${d}.`),
          ],
          sol: { kz: `${w} ${n}/${d} = (${w} · ${d} + ${n})/${d} = ${N}/${d}.`, ru: `${w} ${n}/${d} = (${w} · ${d} + ${n})/${d} = ${N}/${d}.` },
        };
      }
      const correct = `${w} ${n}/${d}`;
      const wrong = [
        { v: `${w + 1} ${n}/${d}`, tag: 'rounded_up' }, w < d ? { v: `${n} ${w}/${d}`, tag: 'swapped_whole_remainder' } : null,
        { v: `${w} ${d - n}/${d}`, tag: 'random' }, { v: `${w - 1 || w + 2} ${n}/${d}`, tag: 'random' },
      ];
      const { choices, answer } = pack(r, correct, wrong, () => `${Math.max(1, w + r.int(-3, 4))} ${r.int(1, d - 1)}/${d}`);
      return {
        kz: kind === 'toMix' ? `${N}/${d} бұрыс бөлшегін аралас сан түрінде жазыңыз.` : `Пиццалардың әрқайсысы ${d} тең бөлікке кесілген. Балалар ${N} бөлік жеді. Балалар неше пицца жеді?`,
        ru: kind === 'toMix' ? `Запишите неправильную дробь ${N}/${d} в виде смешанного числа.` : `Каждая пицца разрезана на ${d} равных частей. Дети съели ${N} частей. Сколько пицц съели дети?`,
        choices, answer,
        hints: [
          T(`Бөлімі ${d} болатын неше бөлік бір бүтінді құрайды?`, `Сколько долей со знаменателем ${d} составляют одно целое?`),
          T('Бұрыс бөлшекті аралас санға айналдыру: алымды бөлімге қалдықпен бөл; бөлінді — бүтін бөлік, қалдық — жаңа алым.', 'Неправильную дробь в смешанное число: раздели числитель на знаменатель с остатком; частное — целая часть, остаток — новый числитель.'),
          T(`${N} : ${d} бөлуді қалдықпен орында.`, `Выполни деление ${N} : ${d} с остатком.`),
        ],
        sol: { kz: `${N} : ${d} = ${w} (қалдық ${n}). Демек, ${N}/${d} = ${w} ${n}/${d}.`, ru: `${N} : ${d} = ${w} (остаток ${n}). Значит, ${N}/${d} = ${w} ${n}/${d}.` },
      };
    },
  },

  {
    id: 'frac.mixed_arith',
    examType: 'compute', skills: ['frac.mixed'], from: [], difficulty: 3,
    title: { kz: 'Аралас сандарды қосу және азайту', ru: 'Сложение и вычитание смешанных чисел' },
    gen(r) {
      for (;;) {
        const kind = r.pick(['add_same', 'add_same', 'add_diff', 'sub']);
        let d1, d2, n1, n2, w1, w2, sub = false;
        if (kind === 'add_same') { d1 = d2 = r.pick([4, 5, 6, 8]); n1 = coprimeIn(r, d1); n2 = coprimeIn(r, d1); w1 = r.int(1, 5); w2 = r.int(1, 5); }
        else if (kind === 'add_diff') { [d1, d2] = r.pick([[2, 4], [3, 6], [2, 6], [4, 8], [3, 4], [2, 3], [4, 6], [3, 9]]); n1 = coprimeIn(r, d1); n2 = coprimeIn(r, d2); w1 = r.int(1, 5); w2 = r.int(1, 5); }
        else { sub = true; d1 = d2 = r.pick([4, 5, 6, 8]); n1 = coprimeIn(r, d1, 1, d1 - 2); n2 = coprimeIn(r, d1, n1 + 1, d1 - 1); w2 = r.int(1, 4); w1 = w2 + r.int(1, 4); }
        const A = new Q(w1 * d1 + n1, d1), B = new Q(w2 * d2 + n2, d2);
        const ans = sub ? A.sub(B) : A.add(B);
        if (ans.isInt()) continue;
        const L = lcm(d1, d2);
        const correct = mixed(ans);
        const fa = M(w1, n1, d1), fb = M(w2, n2, d2);
        let wrong;
        if (sub) {
          wrong = [
            { v: mixed(new Q((w1 - w2) * d1 + (n2 - n1), d1)), tag: 'smaller_from_larger' },
            { v: mixed(new Q((w1 - w2) * d1 + (n1 + d1 - n2), d1)), tag: 'borrow_forgotten' },
            { v: String(w1 - w2), tag: 'lost_whole_part' }, { v: mixed(A.add(B)), tag: 'wrong_operation' },
            { v: mixed(ans.add(new Q(1, d1))), tag: 'random' },
          ];
        } else {
          const fracSum = new Q(n1, d1).add(new Q(n2, d2));
          wrong = [
            fracSum.lt(1) ? null : { v: mixed(new Q((w1 + w2) * fracSum.d + (fracSum.n % fracSum.d), fracSum.d)), tag: 'carry_forgotten' },
            { v: mixed(fracSum), tag: 'forgot_whole_part' },
            { v: `${w1 + w2} ${n1 + n2}/${d1 + d2}`, tag: 'added_denominators' },
            { v: mixed(ans.add(new Q(1, L))), tag: 'random' },
          ];
        }
        const ctx = r.pick(['ctx', 'expr']);
        let kz, ru;
        if (ctx === 'expr') { kz = `Есептеңіз: ${fa} ${sub ? '−' : '+'} ${fb}`; ru = `Вычислите: ${fa} ${sub ? '−' : '+'} ${fb}`; }
        else if (sub) {
          kz = `Арман ${fa} километр жолдың ${fb} километрін жүріп өтті. Қанша километр қалды?`;
          ru = `Арман прошёл ${fb} километра из ${fa} километра пути. Сколько километров осталось?`;
        } else {
          kz = `Арман бір күні ${fa} сағат сабақ оқыды, ${fb} сағат сурет салды. Барлығы неше сағат жұмсады?`;
          ru = `Арман занимался ${fa} часа и рисовал ${fb} часа. Сколько всего часов он потратил?`;
        }
        const { choices, answer } = pack(r, correct, wrong, () => mixed(ans.add(new Q(r.int(-2, 3) || 1, L))));
        return {
          kz, ru, choices, answer,
          hints: [
            T(sub ? 'Бөлшек бөліктерді азайтуға бола ма, әлде бүтіннен алу керек пе?' : 'Бүтін бөліктерді және бөлшек бөліктерді бөлек қосуға бола ма? Бөлшек бөліктердің қосындысы 1-ден асса не болады?', sub ? 'Можно ли вычесть дробные части, или нужно занять у целой части?' : 'Можно ли складывать целые и дробные части отдельно? Что будет, если сумма дробных частей больше 1?'),
            sub ? T('Азайтқанда алым жетпесе, бүтін бөліктен 1-ді бөліп алып, бөлшекке қос (1 = бөлім/бөлім).', 'Если числителя не хватает, займи 1 у целой части и добавь к дроби (1 = знаменатель/знаменатель).')
              : T('Аралас сандарды қосқанда: бүтіндерін бөлек, бөлшектерін бөлек қос; бөлшек бөліктің қосындысы 1-ден асса, артығын бүтінге қос.', 'Смешанные числа складывают так: целые отдельно, дробные отдельно; если сумма дробных больше 1, лишнюю единицу прибавь к целым.'),
            sub ? T(`Алдымен бөлшек бөліктерді қара: ${n1}/${d1} және ${n2}/${d2}. Қайсысы үлкен?`, `Сначала посмотри на дробные части: ${n1}/${d1} и ${n2}/${d2}. Какая больше?`)
              : T(`Алдымен бөлшек бөліктерін қос: ${n1}/${d1} + ${n2}/${d2}.`, `Сначала сложи дробные части: ${n1}/${d1} + ${n2}/${d2}.`),
          ],
          sol: {
            kz: sub ? `${fa} − ${fb}: бүтіндері ${w1} − ${w2}, бөлшектері ${n1}/${d1} − ${n2}/${d2}. Алым жетпейді, сондықтан бір бүтінді бөлшекке айналдырамыз: ${A.n}/${A.d} − ${B.n}/${B.d} = ${correct}.`
              : `${fa} + ${fb} = ${A.n}/${A.d} + ${B.n}/${B.d} = ${correct}. (Бүтіндері: ${w1} + ${w2}, бөлшектері: ${n1}/${d1} + ${n2}/${d2}.)`,
            ru: sub ? `${fa} − ${fb}: целые ${w1} − ${w2}, дроби ${n1}/${d1} − ${n2}/${d2}. Числителя не хватает, занимаем единицу: ${A.n}/${A.d} − ${B.n}/${B.d} = ${correct}.`
              : `${fa} + ${fb} = ${A.n}/${A.d} + ${B.n}/${B.d} = ${correct}. (Целые: ${w1} + ${w2}, дроби: ${n1}/${d1} + ${n2}/${d2}.)`,
          },
        };
      }
    },
  },

  {
    id: 'frac.mixed_time',
    examType: 'word', skills: ['frac.mixed'], from: [], difficulty: 2,
    title: { kz: 'Сағат пен минут бөлшекпен', ru: 'Часы и минуты дробью' },
    gen(r) {
      if (r.chance(0.5)) {
        const d = r.pick([2, 3, 4, 5, 6, 10, 12]), n = coprimeIn(r, d), w = r.int(1, 4), A = M(w, n, d);
        const total = 60 * w + 60 * n / d, dec = 100 * n / d;
        const wrong = [
          { v: String(60 * w + n), tag: 'numerator_as_minutes' },
          Number.isInteger(dec) ? { v: String(60 * w + dec), tag: 'decimal_time' } : null,
          { v: String(60 * n / d), tag: 'lost_whole_part' }, { v: String(60 * w + d), tag: 'numerator_as_minutes' }, { v: String(60 * (w + n)), tag: 'random' },
        ];
        const { choices, answer } = pack(r, String(total), wrong, () => nn(total + r.int(-3, 3) * 5));
        return {
          kz: `${A} сағат неше минут?`, ru: `Сколько минут в ${A} часа?`, choices, answer,
          hints: [
            T('1 сағат неше минут? Бөлшек бөлік неше минутқа тең?', 'Сколько минут в 1 часе? Чему равна дробная часть в минутах?'),
            T('Бүтін сағаттарды 60-қа көбейт. Бөлшек бөлік үшін 60-ты бөлімге бөліп, алымға көбейт.', 'Целые часы умножь на 60. Для дробной части раздели 60 на знаменатель и умножь на числитель.'),
            T(`Алдымен бүтін бөлікті минутқа айналдыр: ${w} · 60.`, `Сначала переведи целую часть в минуты: ${w} · 60.`),
          ],
          sol: {
            kz: `${w} сағат = ${w} · 60 = ${60 * w} мин. ${n}/${d} сағат = 60 : ${d} · ${n} = ${60 * n / d} мин. Барлығы: ${total} мин.`,
            ru: `${w} ч = ${w} · 60 = ${60 * w} мин. ${n}/${d} ч = 60 : ${d} · ${n} = ${60 * n / d} мин. Всего: ${total} мин.`,
          },
        };
      }
      const m = r.pick([10, 12, 15, 20, 24, 30, 40, 45, 50]), h = r.int(1, 3), q = new Q(m, 60);
      const correct = M(h, q.n, q.d);
      const wrong = [
        { v: M(h, m, 100), tag: 'decimal_time' }, { v: M(h, 60 - m, 60), tag: 'answered_rest' }, { v: frac(q), tag: 'lost_whole_part' },
        { v: M(h + 1, m, 60), tag: 'random' }, { v: M(h, 1, Math.max(2, q.d + 1)), tag: 'random' },
      ];
      const { choices, answer } = pack(r, correct, wrong, () => M(h, r.int(1, 5), r.pick([6, 7, 8, 9])));
      const hr = ruPl(h, 'час', 'часа', 'часов');
      return {
        kz: `${h} сағат ${m} минутты сағатпен жазыңыз (аралас сан түрінде).`,
        ru: `Запишите ${h} ${hr} ${m} ${ruPl(m, 'минута', 'минуты', 'минут')} в часах в виде смешанного числа.`,
        choices, answer,
        hints: [
          T('1 сағат неше минут? Минутты сағаттың қандай бөлігі деп жазуға болады?', 'Сколько минут в 1 часе? Какой частью часа можно записать минуты?'),
          T('m минут = m/60 сағат. Бөлшекті қысқарт, бүтін сағатты алдына жаз.', 'm минут = m/60 часа. Сократи дробь, а целые часы запиши впереди.'),
          T(`Минуттарды бөлшек етіп жаз: ${m}/60. Оны қысқартуға бола ма?`, `Запиши минуты дробью: ${m}/60. Можно ли её сократить?`),
        ],
        sol: {
          kz: `${m} мин = ${m}/60 сағ = ${frac(q)} сағ. Барлығы: ${correct} сағат.`,
          ru: `${m} мин = ${m}/60 ч = ${frac(q)} ч. Всего: ${correct} ч.`,
        },
      };
    },
  },
];

// «Қай бөлшекті қысқартуға болмайды?» — вариант frac.reduce_lowest (вынесен, чтобы не раздувать gen)
function irreducibleWhich(r) {
  let a, b;
  for (;;) { a = r.int(8, 49); b = r.int(a + 1, 60); if (gcd(a, b) === 1 && isComposite(a) && isComposite(b)) break; }
  const correct = R_(a, b), wrong = [];
  for (let guard = 0; wrong.length < 6 && guard < 200; guard++) {
    const g = r.pick([2, 3, 5, 7]), x = r.int(Math.ceil(8 / g), Math.floor(30 / g)), y = r.int(x + 1, Math.floor(60 / g));
    if (y <= x || gcd(x, y) === 0) continue;
    wrong.push({ v: R_(x * g, y * g), tag: 'has_common_divisor' });
  }
  const { choices, answer } = pack(r, correct, wrong, () => { const g = r.pick([2, 3, 5]); const x = r.int(4, 12); return R_(x * g, (x + r.int(1, 8)) * g); }, true);
  const first = sampleWrong(choices, answer);
  const list = choices.map(c => { const p = parseNd(c.text); return `${c.text} (ЕҮОБ = ${gcd(p.n, p.d)})`; }).join(', ');
  const listRu = list.replace(/ЕҮОБ/g, 'НОД');
  return {
    kz: 'Қай бөлшекті қысқартуға болмайды?', ru: 'Какую дробь нельзя сократить?', choices, answer,
    hints: [
      T('Алым мен бөлімнің ортақ бөлгіші бар ма? Ең кіші жай сандарға (2, 3, 5, 7) бөліп көр.', 'Есть ли у числителя и знаменателя общий делитель? Попробуй поделить на 2, 3, 5, 7.'),
      T('Бөлшек қысқартылмайды, егер алым мен бөлімнің ЕҮОБ-ы 1 болса (олар өзара жай сандар).', 'Дробь нельзя сократить, если НОД числителя и знаменателя равен 1 (числа взаимно простые).'),
      T(`Мысалы, ${first.n}/${first.d} нұсқасы: екі санды да 2, 3, 5, 7-ге бөлінуін тексер.`, `Например, вариант ${first.n}/${first.d}: проверь, делятся ли оба числа на 2, 3, 5, 7.`),
    ],
    sol: {
      kz: `${list}. Тек ${correct} бөлшегінің ЕҮОБ-ы 1, сондықтан оны қысқартуға болмайды. Жауабы: ${correct}.`,
      ru: `${listRu}. Только у ${correct} НОД равен 1, поэтому только её нельзя сократить. Ответ: ${correct}.`,
    },
  };
}
