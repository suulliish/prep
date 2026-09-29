import { describe, it, expect } from 'vitest';
import glossary from '../content/glossary.json';
// @ts-ignore — шаблоны написаны на JS
import fractions5 from '../content/templates/fractions5.mjs';
// @ts-ignore
import { rng } from '../content/templates/lib.mjs';
// @ts-ignore
import { skills, skillById } from '../content/skills.mjs';
// @ts-ignore
import { MISCONCEPTIONS } from '../content/misconceptions.mjs';

const T = fractions5 as any[];
const SEEDS = 300;

// ---------- Независимая арифметика дробей (не использует Q из lib.mjs) ----------
type Fr = [number, number];
const g = (a: number, b: number): number => (b ? g(b, a % b) : Math.abs(a));
const mk = (n: number, d: number): Fr => { const k = g(n, d) || 1; return [n / k, d / k]; };
const add = (x: Fr, y: Fr) => mk(x[0] * y[1] + y[0] * x[1], x[1] * y[1]);
const sub = (x: Fr, y: Fr) => mk(x[0] * y[1] - y[0] * x[1], x[1] * y[1]);
const eq = (x: Fr, y: Fr) => x[0] === y[0] && x[1] === y[1];
const cmp = (x: Fr, y: Fr) => Math.sign(x[0] * y[1] - y[0] * x[1]);
const val = (x: Fr) => x[0] / x[1];
const lcm = (a: number, b: number) => (a / g(a, b)) * b;
const parse = (s: string): Fr | null => {
  let m;
  if ((m = /^(\d+) (\d+)\/(\d+)$/.exec(s))) return mk(+m[1] * +m[3] + +m[2], +m[3]);
  if ((m = /^(\d+)\/(\d+)$/.exec(s))) return mk(+m[1], +m[2]);
  if (/^\d+$/.test(s)) return mk(+s, 1);
  return null;
};
const P = (s: string): Fr => { const x = parse(s); if (!x) throw new Error('не дробь: ' + s); return x; };
const fracsIn = (s: string): [number, number][] => [...s.matchAll(/(\d+)\/(\d+)/g)].map(m => [+m[1], +m[2]]);
const mixedIn = (s: string): Fr[] => [...s.matchAll(/(\d+) (\d+)\/(\d+)/g)].map(m => mk(+m[1] * +m[3] + +m[2], +m[3]));
const ints = (s: string) => (s.match(/\d+/g) || []).map(Number);
const F = ([n, d]: [number, number]): Fr => mk(n, d);

// ---------- Проверка ответа по тексту условия, каждый шаблон отдельно ----------
type Item = { kz: string; ru: string; choices: { text: string; tag: string }[]; answer: number; sol: { kz: string; ru: string }; hints: { kz: string; ru: string }[] };
const texts = (it: Item) => it.choices.map(c => c.text);
const ans = (it: Item) => it.choices[it.answer].text;
// среди вариантов ровно один удовлетворяет условию, и он и есть ответ
const onlyOne = (it: Item, pred: (t: string) => boolean) => {
  const hits = texts(it).filter(pred);
  expect(hits, it.kz).toEqual([ans(it)]);
};
const closest = (it: Item, dist: (t: string) => number) => {
  const d = texts(it).map(dist), best = Math.min(...d);
  expect(d.filter(x => Math.abs(x - best) < 1e-12), it.kz).toHaveLength(1);
  expect(d[it.answer], it.kz).toBe(best);
};

const VERIFY: Record<string, (it: Item) => void> = {
  'frac.concept_part'(it) {
    const [N, k] = ints(it.kz);
    const want = /қалды\?/.test(it.kz) ? mk(N - k, N) : mk(k, N);
    expect(eq(P(ans(it)), want), it.kz).toBe(true);
    expect(ans(it)).toMatch(/^\d+\/\d+$/);
  },
  'frac.concept_equal'(it) {
    let m;
    if ((m = /^(\d+)\/(\d+) бөлшегінің (алымы|бөлімі)/.exec(it.kz))) expect(ans(it)).toBe(m[3] === 'алымы' ? m[1] : m[2]);
    else if ((m = /Пиццаның (\d+)\/(\d+) бөлігін алу/.exec(it.kz))) expect(ans(it)).toBe(`Пиццаны ${m[2]} тең бөлікке кесіп, ${m[1]} бөлігін алу`);
    else throw new Error('неизвестный вариант: ' + it.kz);
  },
  'frac.magnitude_half'(it) {
    const gt = /(үлкен|көп)\?$/.test(it.kz), half: Fr = [1, 2];
    onlyOne(it, t => cmp(P(t), half) === (gt ? 1 : -1));
  },
  'frac.magnitude_near'(it) {
    const target = /1\/2 санына/.test(it.kz) ? 0.5 : /0 санына/.test(it.kz) ? 0 : 1; // «толық зарядқа» = 1
    closest(it, t => Math.abs(val(P(t)) - target));
    // запас: победитель заметно ближе остальных (разница видна без вычислений)
    const d = texts(it).map(t => Math.abs(val(P(t)) - target)).sort((a, b) => a - b);
    expect(d[1] / d[0], it.kz + ' ' + texts(it)).toBeGreaterThanOrEqual(1.5);
  },
  'frac.magnitude_estimate'(it) {
    const [a, b] = fracsIn(it.kz), s = val(F(a)) + val(F(b));
    closest(it, t => Math.abs(val(P(t)) - s));
  },
  'frac.equal_missing'(it) {
    let m;
    let want: number;
    if ((m = /: (\d+)\/(\d+) = \?\/(\d+)$/.exec(it.kz))) want = (+m[1] * +m[3]) / +m[2];
    else if ((m = /: (\d+)\/(\d+) = (\d+)\/\?$/.exec(it.kz))) want = (+m[2] * +m[3]) / +m[1];
    else if ((m = /Торт (\d+) тең бөлікке кесілген\. Оның (\d+)\/(\d+)/.exec(it.kz))) want = (+m[2] * +m[1]) / +m[3];
    else throw new Error('неизвестный вариант: ' + it.kz);
    expect(Number.isInteger(want), it.kz).toBe(true);
    expect(ans(it)).toBe(String(want));
  },
  'frac.equal_which'(it) {
    const m = /Қай бөлшек (\d+)\/(\d+) бөлшегіне (тең емес|тең)\?/.exec(it.kz)!;
    const x = F([+m[1], +m[2]]), notEq = m[3] === 'тең емес';
    const flags = texts(it).map(t => eq(P(t), x));
    if (notEq) { expect(flags.filter(f => !f)).toHaveLength(1); expect(flags[it.answer]).toBe(false); }
    else { expect(flags.filter(f => f)).toHaveLength(1); expect(flags[it.answer]).toBe(true); }
  },
  'frac.reduce_lowest'(it) {
    if (/болмайды\?$/.test(it.kz)) return onlyOne(it, t => { const [n, d] = fracsIn(t)[0]; return g(n, d) === 1; });
    const [n, d] = fracsIn(it.kz)[0], want = mk(n, d);
    expect(ans(it)).toBe(`${want[0]}/${want[1]}`);
    // единственный несократимый вариант, равный исходной дроби
    const hits = texts(it).filter(t => { const [a, b] = fracsIn(t)[0]; return g(a, b) === 1 && eq(P(t), want); });
    expect(hits).toEqual([ans(it)]);
  },
  'frac.reduce_context'(it) {
    const x = ints(it.kz)[0];
    const W = /килограмның/.test(it.kz) ? 1000 : /километрдің/.test(it.kz) ? 1000 : /метрдің/.test(it.kz) ? 100 : /сағаттың/.test(it.kz) ? 60 : /жылдың/.test(it.kz) ? 12 : 0;
    expect(W, it.kz).toBeGreaterThan(0);
    const want = mk(x, W);
    expect(ans(it)).toBe(`${want[0]}/${want[1]}`);
    const hits = texts(it).filter(t => { const p = parse(t)!; const f = fracsIn(t)[0]; return f && g(f[0], f[1]) === 1 && eq(p, want); });
    expect(hits).toEqual([ans(it)]);
  },
  'frac.lcd_find'(it) {
    const [[, b], [, d]] = fracsIn(it.kz);
    expect(ans(it)).toBe(String(lcm(b, d)));
  },
  'frac.lcd_numerators'(it) {
    const [[a, b], [c, d]] = fracsIn(it.kz), L = lcm(b, d);
    expect(ans(it)).toBe(`${(a * L) / b}/${L} және ${(c * L) / d}/${L}`);
  },
  'frac.lcd_factor'(it) {
    let m;
    if ((m = /^(\d+)\/(\d+) бөлшегінің бөлімін (\d+) ету/.exec(it.kz))) expect(ans(it)).toBe(String(+m[3] / +m[2]));
    else {
      const [[, b], [, d]] = fracsIn(it.kz);
      expect(ans(it)).toBe(String(lcm(b, d) / d));
    }
  },
  'frac.compare_extreme'(it) {
    const max = /(ең үлкен\?|көп жеген)/.test(it.kz);
    const vs = texts(it).map(t => val(P(t))), t = max ? Math.max(...vs) : Math.min(...vs);
    expect(vs.filter(v => v === t)).toHaveLength(1);
    expect(vs[it.answer]).toBe(t);
  },
  'frac.compare_order'(it) {
    const asc = /өсу/.test(it.kz), fs = fracsIn(it.kz.split(': ')[1]).map(F);
    const sorted = fs.slice().sort((x, y) => (asc ? cmp(x, y) : cmp(y, x)));
    const want = [...it.kz.split(': ')[1].matchAll(/\d+\/\d+/g)].map(m => m[0]);
    const order = sorted.map(x => want.find(w => eq(P(w), x))!);
    expect(ans(it)).toBe(order.join(asc ? ' < ' : ' > '));
  },
  'frac.compare_true'(it) {
    const truth = (t: string) => { const m = /^(\d+\/\d+) ([<>]) (\d+\/\d+)$/.exec(t)!; const c = cmp(P(m[1]), P(m[3])); return (m[2] === '>' ? 1 : -1) === c; };
    onlyOne(it, truth);
  },
  'frac.add_same'(it) {
    const [a, c] = fracsIn(it.kz).map(F);
    const isSub = /−/.test(it.kz) || /Енді батончиктің/.test(it.kz);
    const want = isSub ? sub(a, c) : add(a, c);
    expect(eq(P(ans(it)), want), it.kz + ans(it)).toBe(true);
    lowestTerms(ans(it));
  },
  'frac.add_diff'(it) {
    const [a, c] = fracsIn(it.kz).map(F);
    const isSub = /−/.test(it.kz) || /Құмырада/.test(it.kz);
    const want = isSub ? sub(a, c) : add(a, c);
    expect(eq(P(ans(it)), want), it.kz + ans(it)).toBe(true);
    lowestTerms(ans(it));
  },
  'frac.to_whole'(it) {
    const [f] = fracsIn(it.kz).map(F), whole: Fr = /^2 −/.test(it.kz) ? [2, 1] : [1, 1];
    expect(eq(P(ans(it)), sub(whole, f)), it.kz + ans(it)).toBe(true);
    lowestTerms(ans(it));
  },
  'frac.rest_of_path'(it) {
    const [a, c] = fracsIn(it.kz).map(F);
    expect(eq(P(ans(it)), sub(sub([1, 1], a), c)), it.kz + ans(it)).toBe(true);
    lowestTerms(ans(it));
  },
  'frac.mixed_convert'(it) {
    let m;
    if ((m = /^(\d+) (\d+)\/(\d+) аралас санын/.exec(it.kz))) expect(ans(it)).toBe(`${+m[1] * +m[3] + +m[2]}/${m[3]}`);
    else if ((m = /^(\d+)\/(\d+) бұрыс бөлшегін/.exec(it.kz))) expectMixed(ans(it), +m[1], +m[2]);
    else if ((m = /кесілген\. Балалар (\d+) бөлік/.exec(it.kz))) expectMixed(ans(it), +m[1], +/әрқайсысы (\d+) тең/.exec(it.kz)![1]);
    else throw new Error('неизвестный вариант: ' + it.kz);
  },
  'frac.mixed_arith'(it) {
    const [A, B] = mixedIn(it.kz), isSub = /−/.test(it.kz) || /қанша километр қалды/i.test(it.kz);
    expect(eq(P(ans(it)), isSub ? sub(A, B) : add(A, B)), it.kz + ans(it)).toBe(true);
    lowestTerms(ans(it));
  },
  'frac.mixed_time'(it) {
    let m;
    if ((m = /^(?:(\d+) )?(\d+)\/(\d+) сағат неше минут/.exec(it.kz)) || (m = /^(\d+) сағат неше минут/.exec(it.kz))) {
      const min = m.length === 4 ? 60 * (+m[1]) + (60 * +m[2]) / +m[3] : 60 * +m[1];
      expect(ans(it)).toBe(String(min));
    } else if ((m = /^(\d+) сағат (\d+) минутты/.exec(it.kz))) {
      expect(eq(P(ans(it)), mk(+m[1] * 60 + +m[2], 60)), it.kz + ans(it)).toBe(true);
      lowestTerms(ans(it));
    } else throw new Error('неизвестный вариант: ' + it.kz);
  },
};
function lowestTerms(s: string) { const f = fracsIn(s)[0]; if (f) expect(g(f[0], f[1]), s).toBe(1); }
function expectMixed(s: string, N: number, d: number) {
  const w = Math.floor(N / d), r = N % d, k = g(r, d);
  expect(s).toBe(r ? `${w} ${r / k}/${d / k}` : String(w));
}

// ---------- Общие проверки ----------
const avoid = (glossary as any).terms.flatMap((t: any) => (t.avoid || []).map((a: string) => ({ a, kz: t.kz })));
const findAvoid = (text: string) =>
  avoid.filter(({ a }: any) => (a === a.toUpperCase() ? new RegExp(`(^|[^А-Яа-я])${a}([^А-Яа-я]|$)`) : new RegExp(`(^|[^а-яё])${a}`, 'i')).test(text));
const ASCII_MINUS = /(^|[^\wа-яәіңғүұқөһ])-\d/i;
// эквивалентные по значению варианты допустимы только там, где вопрос про сокращение
const EQUIV_OK = new Set(['frac.reduce_lowest', 'frac.reduce_context', 'frac.equal_which']);
// подсказка 3 у этих шаблонов разбирает «первый вариант» (любой, не обязательно верный), поэтому цитирует вариант
const QUOTES_FIRST_CHOICE = new Set(['frac.magnitude_half', 'frac.magnitude_near', 'frac.magnitude_estimate', 'frac.reduce_lowest']);

describe('дроби 5 класса: шаблоны', () => {
  it('заявлено 22 шаблона, у каждого проверка ответа', () => {
    expect(T).toHaveLength(22);
    for (const t of T) expect(VERIFY[t.id], t.id).toBeTypeOf('function');
  });

  for (const t of T) {
    describe(t.id, () => {
      it('устройство: 5 разных вариантов, метки, тексты kz/ru, три подсказки, разбор', () => {
        const r = rng(2026);
        for (let i = 0; i < SEEDS; i++) {
          const it: Item = t.gen(r);
          expect(it.choices, it.kz).toHaveLength(5);
          expect(new Set(texts(it)).size, it.kz).toBe(5);
          expect(it.choices.filter(c => c.tag === 'correct'), it.kz).toHaveLength(1);
          expect(it.choices[it.answer].tag).toBe('correct');
          expect(it.kz.length).toBeGreaterThan(5); expect(it.ru.length).toBeGreaterThan(5);
          expect(it.sol.kz.length).toBeGreaterThan(5); expect(it.sol.ru.length).toBeGreaterThan(5);
          expect(t.title.kz && t.title.ru).toBeTruthy();
          expect(JSON.stringify(it)).not.toMatch(/NaN|undefined|Infinity|null/);
          expect(it.hints, it.kz).toHaveLength(3);
          for (const h of it.hints) { expect(h.kz.length).toBeGreaterThan(5); expect(h.ru.length).toBeGreaterThan(5); }
          // третья подсказка не выдаёт ответ-дробь
          const n = (x: string) => x.replace(/\s+/g, '');
          if (ans(it).includes('/') && !QUOTES_FIRST_CHOICE.has(t.id) && !n(it.kz).includes(n(ans(it))))
            expect(n(it.hints[2].kz).includes(n(ans(it))), `${it.kz} | ${it.hints[2].kz} | ${ans(it)}`).toBe(false);
        }
      });

      it('ответ верен: пересчитан независимо по тексту условия', () => {
        const r = rng(7);
        for (let i = 0; i < SEEDS; i++) VERIFY[t.id](t.gen(r));
      });

      it('нет эквивалентных дублей среди вариантов (1/2 и 2/4)', () => {
        if (EQUIV_OK.has(t.id)) return;
        const r = rng(11);
        for (let i = 0; i < SEEDS; i++) {
          const it: Item = t.gen(r), vs = texts(it).map(parse).filter(Boolean) as Fr[];
          const keys = vs.map(v => v[0] + '/' + v[1]);
          expect(new Set(keys).size, it.kz + texts(it).join(' | ')).toBe(keys.length);
        }
      });

      it('нет слов из glossary.avoid в казахском тексте, подсказках и вариантах; нет ASCII-минуса перед цифрой', () => {
        const r = rng(13);
        for (let i = 0; i < SEEDS; i++) {
          const it: Item = t.gen(r);
          const kz = [it.kz, it.sol.kz, t.title.kz, ...it.hints.map(h => h.kz), ...texts(it)].join('\n');
          expect(findAvoid(kz).map((h: any) => `${h.a} → ${h.kz}`), kz.slice(0, 200)).toEqual([]);
          const all = [kz, it.ru, it.sol.ru, ...it.hints.map(h => h.ru)].join('\n');
          expect(all, all.slice(0, 200)).not.toMatch(ASCII_MINUS);
        }
      });

      it('метки ошибок известны (есть разбор в misconceptions.mjs)', () => {
        const r = rng(17), seen = new Set<string>();
        for (let i = 0; i < SEEDS; i++) for (const c of (t.gen(r) as Item).choices) seen.add(c.tag);
        for (const tag of seen) if (tag !== 'correct' && tag !== 'random') expect((MISCONCEPTIONS as any)[tag], `${t.id}: нет разбора для «${tag}»`).toBeTruthy();
      });

      it('разнообразие условий и неправильных вариантов', () => {
        const r = rng(19), stems = new Set<string>(), tags = new Set<string>();
        for (let i = 0; i < 400; i++) { const it: Item = t.gen(r); stems.add(it.kz + '|' + texts(it).join('|')); it.choices.forEach(c => tags.add(c.tag)); }
        expect(stems.size).toBeGreaterThanOrEqual(40);
        expect(tags.size).toBeGreaterThanOrEqual(t.id === 'frac.magnitude_estimate' ? 3 : 4);
      });
    });
  }
});

describe('дроби 5 класса: граф навыков', () => {
  const S = skills as any[];
  it('frac.magnitude: после frac.concept, до frac.compare', () => {
    expect(skillById['frac.magnitude'].prereqs).toEqual(['frac.concept']);
    expect(skillById['frac.magnitude'].grade).toBe(5);
    expect(skillById['frac.compare'].prereqs).toContain('frac.magnitude');
    expect(skillById['frac.compare'].prereqs).toContain('frac.common_denominator');
  });
  it('logic.weighing и div.trailing_zeros — 5 класс (планировщик ставит olymp последним)', () => {
    expect(skillById['logic.weighing'].grade).toBe(5);
    expect(skillById['div.trailing_zeros'].grade).toBe(5);
  });
  it('каждый шаблон привязан к навыку из списка skills шаблона, а навык знает шаблон', () => {
    for (const t of T) for (const sk of t.skills) {
      expect(skillById[sk], `${t.id} → ${sk}`).toBeTruthy();
      expect(skillById[sk].templates, `${sk} не содержит ${t.id}`).toContain(t.id);
    }
  });
  it('все восемь дробных навыков теперь имеют генераторы', () => {
    for (const id of ['frac.concept', 'frac.magnitude', 'frac.basic_property', 'frac.reduce', 'frac.common_denominator', 'frac.compare', 'frac.add_sub', 'frac.mixed'])
      expect(S.find(s => s.id === id).templates.length, id).toBeGreaterThanOrEqual(2);
  });
});
