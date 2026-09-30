import { describe, it, expect } from 'vitest';
import glossary from '../content/glossary.json';
import bank from '../content/bank.json';
// @ts-ignore — шаблоны написаны на JS
import fractions6 from '../content/templates/fractions6.mjs';
// @ts-ignore
import { rng } from '../content/templates/lib.mjs';
// @ts-ignore
import { skills, skillById } from '../content/skills.mjs';
// @ts-ignore
import { MISCONCEPTIONS } from '../content/misconceptions.mjs';

const T = fractions6 as any[];
const SEEDS = 300;

// ---------- Независимая арифметика дробей (не использует Q из lib.mjs) ----------
type Fr = [number, number];
const g = (a: number, b: number): number => (b ? g(b, a % b) : Math.abs(a));
const mk = (n: number, d: number): Fr => { const k = g(n, d) || 1; return [n / k, d / k]; };
const add = (x: Fr, y: Fr) => mk(x[0] * y[1] + y[0] * x[1], x[1] * y[1]);
const sub = (x: Fr, y: Fr) => mk(x[0] * y[1] - y[0] * x[1], x[1] * y[1]);
const mul = (x: Fr, y: Fr) => mk(x[0] * y[0], x[1] * y[1]);
const dvd = (x: Fr, y: Fr) => mk(x[0] * y[1], x[1] * y[0]);
const eq = (x: Fr, y: Fr) => x[0] === y[0] && x[1] === y[1];
const val = (x: Fr) => x[0] / x[1];
const parse = (s: string): Fr | null => {
  let m;
  if ((m = /^(\d+) (\d+)\/(\d+)$/.exec(s))) return mk(+m[1] * +m[3] + +m[2], +m[3]);
  if ((m = /^(\d+)\/(\d+)$/.exec(s))) return mk(+m[1], +m[2]);
  if (/^\d+$/.test(s)) return mk(+s, 1);
  return null;
};
const P = (s: string): Fr => { const x = parse(s); if (!x) throw new Error('не число: ' + s); return x; };
const ints = (s: string) => (s.match(/\d+/g) || []).map(Number);
// числа условия по порядку: смешанное, дробь или целое
const NUM_RE = /\d+ \d+\/\d+|\d+\/\d+|\d+/g;
const numsIn = (s: string): Fr[] => (s.match(NUM_RE) || []).map(P);
// дроби (не целые) и целые вне дробей — по отдельности
const FRACS_RE = /\d+\/\d+/g;
const fracsIn = (s: string): Fr[] => (s.match(FRACS_RE) || []).map(P);
const intsOutside = (s: string): number[] => (s.replace(/\d+ \d+\/\d+|\d+\/\d+/g, ' ').match(/\d+/g) || []).map(Number);

type Item = { kz: string; ru: string; choices: { text: string; tag: string }[]; answer: number; sol: { kz: string; ru: string }; hints: { kz: string; ru: string }[]; oneWhole?: boolean };
const texts = (it: Item) => it.choices.map(c => c.text);
const ans = (it: Item) => it.choices[it.answer].text;
const want = (it: Item, w: Fr) => expect(eq(P(ans(it)), w), `${it.kz} → ${ans(it)}, ожидалось ${w[0]}/${w[1]}`).toBe(true);
const onlyOne = (it: Item, pred: (t: string) => boolean) => {
  const hits = texts(it).filter(pred);
  expect(hits, it.kz).toEqual([ans(it)]);
};
// результат в виде «целое остаток»: несократимый, остаток меньше знаменателя (для ответов-смешанных чисел)
function tidy(s: string) {
  const m = /^(?:(\d+) )?(\d+)\/(\d+)$/.exec(s);
  if (m) { expect(g(+m[2], +m[3]), s).toBe(1); expect(+m[2], s).toBeLessThan(+m[3]); }
}
// значение выражения «N · f», «f · N», «N : f» из варианта ответа
const exprVal = (t: string): Fr => {
  const [x, y] = numsIn(t);
  return /:/.test(t) ? dvd(x, y) : mul(x, y);
};

const VERIFY: Record<string, (it: Item) => void> = {
  'frac.mul_whole'(it) {
    const [f] = fracsIn(it.kz), [W] = intsOutside(it.kz);
    expect(intsOutside(it.kz)).toHaveLength(1);
    want(it, mul(f, [W, 1]));
    tidy(ans(it));
  },
  'frac.mul_frac'(it) {
    const fs = fracsIn(it.kz);
    expect(fs, it.kz).toHaveLength(2);
    expect(intsOutside(it.kz), it.kz).toHaveLength(0);
    want(it, mul(fs[0], fs[1]));
    tidy(ans(it));
    if (it.oneWhole) expect(val(P(ans(it)))).toBeLessThan(1);
  },
  'frac.mul_mixed'(it) {
    const ns = numsIn(it.kz);
    expect(ns, it.kz).toHaveLength(2);
    want(it, mul(ns[0], ns[1]));
    tidy(ans(it));
  },
  'frac.mul_size'(it) {
    const N = +/(\d+) санынан/.exec(it.kz)?.[1]!;
    if (/кіші\?$/.test(it.kz) && /санынан/.test(it.kz)) onlyOne(it, t => val(exprVal(t)) < N);
    else if (/үлкен\?$/.test(it.kz) && /санынан/.test(it.kz)) onlyOne(it, t => val(exprVal(t)) > N);
    else {
      expect(it.kz).toMatch(/ең кіші\?$/);
      const vs = texts(it).map(t => val(exprVal(t))), best = Math.min(...vs);
      expect(vs.filter(v => v === best)).toHaveLength(1);
      expect(vs[it.answer]).toBe(best);
    }
    for (const c of it.choices) if (c.tag !== 'correct') expect(c.tag).toBe('mul_always_bigger');
  },
  'frac.div_whole_by_frac'(it) {
    const [f] = fracsIn(it.kz), [W] = intsOutside(it.kz);
    expect(intsOutside(it.kz)).toHaveLength(1);
    want(it, dvd([W, 1], f));
    tidy(ans(it));
    if (!/^Есептеңіз/.test(it.kz)) expect(ans(it), it.kz).toMatch(/^\d+$/);   // в историях число стаканов, пакетов, частей — целое
  },
  'frac.div_frac_by_whole'(it) {
    const [f] = fracsIn(it.kz), [W] = intsOutside(it.kz);
    expect(intsOutside(it.kz)).toHaveLength(1);
    want(it, dvd(f, [W, 1]));
    expect(ans(it)).toMatch(/^\d+\/\d+$/);
    if (it.oneWhole) expect(val(P(ans(it)))).toBeLessThan(1);
  },
  'frac.div_frac_frac'(it) {
    const fs = fracsIn(it.kz);
    expect(fs).toHaveLength(2);
    expect(intsOutside(it.kz)).toHaveLength(0);
    want(it, dvd(fs[0], fs[1]));
    tidy(ans(it));
    if (!/^Есептеңіз/.test(it.kz)) expect(ans(it), it.kz).toMatch(/^\d+$/);
  },
  'frac.div_size'(it) {
    if (/санынан/.test(it.kz)) {
      const N = +/(\d+) санынан/.exec(it.kz)![1];
      if (/кіші\?$/.test(it.kz)) onlyOne(it, t => val(exprVal(t)) < N);
      else onlyOne(it, t => val(exprVal(t)) > N);
    } else {
      expect(it.kz).toMatch(/ең үлкен\?$/);
      const vs = texts(it).map(t => val(exprVal(t))), best = Math.max(...vs);
      expect(vs.filter(v => v === best)).toHaveLength(1);
      expect(vs[it.answer]).toBe(best);
    }
    for (const c of it.choices) if (c.tag !== 'correct') expect(c.tag).toBe('div_always_smaller');
  },
  'frac.part_of_number_direct'(it) {
    const [f] = fracsIn(it.kz), [N] = intsOutside(it.kz);
    expect(intsOutside(it.kz)).toHaveLength(1);
    want(it, mul(f, [N, 1]));
    expect(ans(it)).toMatch(/^\d+$/);
  },
  'frac.part_of_number_more'(it) {
    const fs = fracsIn(it.kz), [N] = intsOutside(it.kz);
    expect(intsOutside(it.kz)).toHaveLength(1);
    const q: Fr = [N, 1];
    if (/(көп|артық)\?$/.test(it.kz)) {
      expect(fs).toHaveLength(2);
      want(it, mul(q, sub(fs[0], fs[1])));
      expect(it.oneWhole).toBe(true);
      expect(val(add(fs[0], fs[1])), it.kz).toBeLessThanOrEqual(1);
    } else if (/(оқыды|жүрді|барады)\?$/.test(it.kz)) {
      expect(fs).toHaveLength(2);
      want(it, mul(q, add(fs[0], fs[1])));
      expect(it.oneWhole).toBe(true);
      expect(val(add(fs[0], fs[1])), it.kz).toBeLessThanOrEqual(1);
    } else if (/(қалды|керек)\?$/.test(it.kz)) {
      expect(fs).toHaveLength(1);
      want(it, mul(q, sub([1, 1], fs[0])));
    } else throw new Error('неизвестный вариант: ' + it.kz);
    expect(ans(it)).toMatch(/^\d+$/);
  },
  'frac.find_whole_story'(it) {
    const [f] = fracsIn(it.kz), [Pn] = intsOutside(it.kz);
    expect(intsOutside(it.kz)).toHaveLength(1);
    want(it, dvd([Pn, 1], f));
    expect(ans(it)).toMatch(/^\d+$/);
    // часть из условия меньше целого
    expect(+ans(it)).toBeGreaterThan(Pn);
  },
  'frac.find_whole_rest'(it) {
    const [f] = fracsIn(it.kz), [Rn] = intsOutside(it.kz);
    expect(intsOutside(it.kz)).toHaveLength(1);
    want(it, dvd([Rn, 1], sub([1, 1], f)));
    expect(ans(it)).toMatch(/^\d+$/);
    expect(+ans(it)).toBeGreaterThan(Rn);
  },
};

// ---------- Общие проверки ----------
const avoid = (glossary as any).terms.flatMap((t: any) => (t.avoid || []).map((a: string) => ({ a, kz: t.kz })));
const findAvoid = (text: string) =>
  avoid.filter(({ a }: any) => (a === a.toUpperCase() ? new RegExp(`(^|[^А-Яа-я])${a}([^А-Яа-я]|$)`) : new RegExp(`(^|[^а-яё])${a}`, 'i')).test(text));
const ASCII_MINUS = /(^|[^\wа-яәіңғүұқөһ])-\d/i;
// эквивалентные по значению варианты запрещены везде (выражения-строки «12 · 3/4» сравниваются по значению)
const valueKey = (t: string) => { const x = parse(t); return x ? x[0] + '/' + x[1] : /[·:]/.test(t) ? exprVal(t).join('/') : t; };
// в этих шаблонах ответ — само выражение, и в условии его нет; подсказки называют только числа условия
const tokenRe = (a: string) => new RegExp('(^|[^\\d/])' + a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?![\\d/])');

describe('дроби: умножение, деление, часть от числа — шаблоны', () => {
  it('заявлено 12 шаблонов, у каждого проверка ответа', () => {
    expect(T).toHaveLength(12);
    expect(new Set(T.map(t => t.id)).size).toBe(12);
    for (const t of T) expect(VERIFY[t.id], t.id).toBeTypeOf('function');
  });

  for (const t of T) {
    describe(t.id, () => {
      it('устройство: 5 разных вариантов, метки, тексты kz/ru, три подсказки, разбор, числа условия не больше 100', () => {
        const r = rng(2027);
        for (let i = 0; i < SEEDS; i++) {
          const it: Item = t.gen(r);
          expect(it.choices, it.kz).toHaveLength(5);
          expect(new Set(texts(it)).size, it.kz).toBe(5);
          expect(it.choices.filter(c => c.tag === 'correct'), it.kz).toHaveLength(1);
          expect(it.choices[it.answer].tag).toBe('correct');
          expect(it.kz.length).toBeGreaterThan(5); expect(it.ru.length).toBeGreaterThan(5);
          expect(it.sol.kz.length).toBeGreaterThan(5); expect(it.sol.ru.length).toBeGreaterThan(5);
          expect(t.title.kz && t.title.ru).toBeTruthy();
          expect(t.skills.length).toBeGreaterThan(0);
          expect(JSON.stringify(it)).not.toMatch(/NaN|undefined|Infinity|null/);
          expect(it.hints, it.kz).toHaveLength(3);
          for (const h of it.hints) { expect(h.kz.length).toBeGreaterThan(5); expect(h.ru.length).toBeGreaterThan(5); }
          expect(Math.max(...ints(it.kz)), it.kz).toBeLessThanOrEqual(100);
          expect(Math.max(...ints(it.ru)), it.ru).toBeLessThanOrEqual(100);
          for (const c of it.choices) expect(Math.max(...ints(c.text)), it.kz + ' | ' + c.text).toBeLessThanOrEqual(150);
          expect(typeof it.oneWhole === 'boolean' || it.oneWhole === undefined).toBe(true);
        }
      });

      it('ответ верен: пересчитан независимо по тексту условия', () => {
        const r = rng(7);
        for (let i = 0; i < SEEDS; i++) VERIFY[t.id](t.gen(r));
      });

      it('нет эквивалентных по значению дублей среди вариантов (1/2 и 2/4)', () => {
        const r = rng(11);
        for (let i = 0; i < SEEDS; i++) {
          const it: Item = t.gen(r), keys = texts(it).map(valueKey);
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
          expect(it.kz + it.sol.kz + it.hints.map(h => h.kz).join(''), 'длинное тире в тексте для ученика').not.toMatch(/—[^ ]/);
        }
      });

      it('метки ошибок известны (есть разбор в misconceptions.mjs)', () => {
        const r = rng(17), seen = new Set<string>();
        for (let i = 0; i < SEEDS; i++) for (const c of (t.gen(r) as Item).choices) seen.add(c.tag);
        for (const tag of seen) if (tag !== 'correct' && tag !== 'random') expect((MISCONCEPTIONS as any)[tag], `${t.id}: нет разбора для «${tag}»`).toBeTruthy();
      });

      it('разнообразие условий и типичных ошибок', () => {
        const r = rng(19), stems = new Set<string>(), tags = new Set<string>();
        for (let i = 0; i < 400; i++) { const it: Item = t.gen(r); stems.add(it.kz + '|' + texts(it).join('|')); it.choices.forEach(c => tags.add(c.tag)); }
        expect(stems.size).toBeGreaterThanOrEqual(t.id.endsWith('_size') ? 40 : 60);
        expect(tags.size).toBeGreaterThanOrEqual(t.id.endsWith('_size') ? 2 : 4);
      });
    });
  }
});

describe('дроби: умножение и деление — граф навыков', () => {
  it('навыки frac.mul, frac.div, frac.part_of_number, frac.find_whole имеют генераторы, и навык знает каждый шаблон', () => {
    for (const t of T) for (const sk of t.skills) {
      expect(skillById[sk], `${t.id} → ${sk}`).toBeTruthy();
      expect(skillById[sk].templates, `${sk} не содержит ${t.id}`).toContain(t.id);
    }
    for (const id of ['frac.mul', 'frac.div', 'frac.part_of_number']) expect(skillById[id].templates.length, id).toBeGreaterThanOrEqual(2);
    expect(skillById['frac.mul'].templates).toHaveLength(4);
    expect(skillById['frac.div'].templates).toHaveLength(4);
    expect(skillById['frac.find_whole'].templates).toEqual(expect.arrayContaining(['frac.find_whole', 'frac.find_whole_story', 'frac.find_whole_rest']));
  });
  it('порядок навыков не изменился: frac.mul → frac.div → frac.find_whole', () => {
    expect(skillById['frac.mul'].prereqs).toContain('frac.reduce');   // + замки порядка (весы, нули, смешанные) — см. tests/progression.test.ts
    expect(skillById['frac.div'].prereqs).toEqual(['frac.mul']);
    expect(skillById['frac.part_of_number'].prereqs).toEqual(['frac.mul']);
    expect(skillById['frac.find_whole'].prereqs).toEqual(['frac.div']);
  });
});

// ---------- Красный отряд: смысл условий, подсказки не выдают ответ, ловушки на месте ----------
const SEM_SEEDS = 5000;
const items = (id: string, n = SEM_SEEDS): any[] => { const t = T.find(x => x.id === id)!; return Array.from({ length: n }, (_, i) => t.gen(rng(i * 104729 + 11))); };

describe('дроби: части ОДНОГО целого не дают больше целого', () => {
  it('frac.mul_frac: условие про плитку, торт, стену, бакшу помечено oneWhole, ответ меньше 1; «Есептеңіз» не помечено', () => {
    let flagged = 0, plain = 0;
    for (const it of items('frac.mul_frac')) {
      expect(typeof it.oneWhole, it.kz).toBe('boolean');
      const story = !/^Есептеңіз/.test(it.kz);
      expect(it.oneWhole, it.kz).toBe(story);
      if (story) { flagged++; expect(val(P(ans(it))), it.kz).toBeLessThan(1); } else plain++;
    }
    expect(flagged).toBeGreaterThan(SEM_SEEDS / 3); expect(plain).toBeGreaterThan(SEM_SEEDS / 5);
  });
  it('frac.part_of_number_more: у «сумма/разность частей» части одного целого, сумма долей не больше 1', () => {
    let flagged = 0, rest = 0;
    for (const it of items('frac.part_of_number_more')) {
      if (it.oneWhole) { flagged++; const fs = (it.kz.match(/\d+\/\d+/g) || []).map(P); expect(fs).toHaveLength(2); expect(val(add(fs[0], fs[1])), it.kz).toBeLessThan(1); }
      else { rest++; expect(it.oneWhole, it.kz).toBeFalsy(); }
    }
    expect(flagged).toBeGreaterThan(SEM_SEEDS / 4); expect(rest).toBeGreaterThan(SEM_SEEDS / 4);
  });
  it('frac.div_frac_by_whole: «плитка» помечена oneWhole (доля меньше 1)', () => {
    let flagged = 0;
    for (const it of items('frac.div_frac_by_whole')) if (it.oneWhole) { flagged++; expect(it.kz).toMatch(/плитка/); expect(val(P(ans(it)))).toBeLessThan(1); }
    expect(flagged).toBeGreaterThan(SEM_SEEDS / 10);
  });
});

describe('дроби: подсказки не называют ответ', () => {
  // ответ как отдельный токен: не часть более длинного числа/дроби. Числа, уже стоящие в условии, не «выдача».
  const leaks = (it: Item, lang: 'kz' | 'ru') => {
    const a = ans(it), re = tokenRe(a);
    if (re.test(it[lang])) return [];
    if (/^\d+$/.test(a) && ints(it[lang]).includes(+a)) return [];
    return it.hints.map((h, i) => ({ i, h: h[lang] })).filter(({ h }) => {
      if (!re.test(h)) return false;
      const listed = texts(it).filter(x => x !== a && tokenRe(x).test(h));
      return listed.length < 2;
    });
  };
  for (const t of T) {
    it(`${t.id}: ни одна из подсказок (kz и ru) не содержит ответ отдельным токеном (${SEM_SEEDS} зёрен)`, () => {
      for (const it of items(t.id)) for (const lang of ['kz', 'ru'] as const)
        expect(leaks(it, lang), `${it[lang]} | ответ ${ans(it)}`).toEqual([]);
    });
  }
  it('подсказки не содержат готового результата шага (числа условия допускаются, вычисленные — нет)', () => {
    // третья ступень называет только действие; проверяем, что «= число» в подсказках нет
    for (const t of T) for (const it of items(t.id, 500)) for (const h of it.hints) {
      expect(h.kz, `${t.id}: ${h.kz}`).not.toMatch(/=\s*\d/);
      expect(h.ru, `${t.id}: ${h.ru}`).not.toMatch(/=\s*\d/);
    }
  });
});

describe('дроби: ловушки на месте (реальные ошибки детей)', () => {
  const tagRate = (id: string, tag: string) => items(id, 2000).filter(it => it.choices.some((c: any) => c.tag === tag)).length / 2000;
  it('frac.mul_frac: «только алымдар» и «ортақ бөлім как при сложении» встречаются часто', () => {
    expect(tagRate('frac.mul_frac', 'mul_numerators_only')).toBeGreaterThan(0.8);
    expect(tagRate('frac.mul_frac', 'mul_common_denominator')).toBeGreaterThan(0.5);
  });
  it('frac.mul_whole / mul_mixed: ловушки бүтін→бөлімге, бүтін бөлікті ұмыту', () => {
    expect(tagRate('frac.mul_whole', 'whole_into_denominator')).toBeGreaterThan(0.8);
    expect(tagRate('frac.mul_mixed', 'lost_whole_part')).toBeGreaterThan(0.8);
    expect(tagRate('frac.mul_mixed', 'mul_only_whole_part')).toBeGreaterThan(0.5);
  });
  it('frac.mul_size / div_size: «умножение всегда больше», «деление всегда меньше»', () => {
    expect(tagRate('frac.mul_size', 'mul_always_bigger')).toBe(1);
    expect(tagRate('frac.div_size', 'div_always_smaller')).toBe(1);
  });
  it('frac.div_*: перевёрнута не та дробь, не перевёрнута совсем, делили только числители', () => {
    expect(tagRate('frac.div_whole_by_frac', 'flipped_wrong_fraction')).toBeGreaterThan(0.8);
    expect(tagRate('frac.div_whole_by_frac', 'div_no_flip')).toBeGreaterThan(0.8);
    expect(tagRate('frac.div_frac_by_whole', 'flipped_wrong_fraction')).toBeGreaterThan(0.8);
    expect(tagRate('frac.div_frac_frac', 'flipped_wrong_fraction')).toBeGreaterThan(0.8);
    expect(tagRate('frac.div_frac_frac', 'div_no_flip')).toBeGreaterThan(0.8);
    expect(tagRate('frac.div_frac_frac', 'div_numerators_only')).toBeGreaterThan(0.5);
  });
  it('frac.part_of_number_direct: «делят на алым, умножают на бөлім» встречается в большинстве задач', () => {
    expect(tagRate('frac.part_of_number_direct', 'part_inverted_operation')).toBeGreaterThan(0.5);
  });
  it('frac.find_whole_*: ловушки multiplied_instead и «остаток принят за часть»', () => {
    expect(tagRate('frac.find_whole_story', 'multiplied_instead')).toBeGreaterThan(0.8);
    expect(tagRate('frac.find_whole_rest', 'rest_fraction_mixup')).toBeGreaterThan(0.5);
  });
  it('ловушка-значение действительно получается «неправильным» действием (независимый пересчёт)', () => {
    // part_inverted_operation: N : a · b
    for (const it of items('frac.part_of_number_direct', 500)) {
      const c = it.choices.find((x: any) => x.tag === 'part_inverted_operation');
      if (!c) continue;
      const [f] = fracsIn(it.kz), [N] = intsOutside(it.kz);
      expect(+c.text, it.kz).toBe((N / f[0]) * f[1]);
    }
    // div_no_flip (число ÷ дробь): число · дробь
    for (const it of items('frac.div_whole_by_frac', 500)) {
      const c = it.choices.find((x: any) => x.tag === 'div_no_flip');
      if (!c) continue;
      const [f] = fracsIn(it.kz), [W] = intsOutside(it.kz);
      expect(eq(P(c.text), mul([W, 1], f)), it.kz).toBe(true);
    }
    // mul_numerators_only: a·c / b или a·c / d
    for (const it of items('frac.mul_frac', 500)) {
      const [x, y] = fracsIn(it.kz);
      for (const c of it.choices.filter((z: any) => z.tag === 'mul_numerators_only'))
        expect([mk(x[0] * y[0], x[1]), mk(x[0] * y[0], y[1])].some(w => eq(P(c.text), w)), it.kz + ' ' + c.text).toBe(true);
    }
  });
});

describe('дроби: не копия задач банка', () => {
  const pool = (bank as any).items.filter((x: any) => x.pool === 'holdout' || x.pool === 'mock');
  const norm = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase();
  const stems = new Set(pool.map((x: any) => norm(x.stem.kz || '')));
  it('ни одно условие не совпадает дословно с задачей holdout/mock (daryn2025, daryn2024, bolashak)', () => {
    expect(pool.length).toBeGreaterThan(100);
    for (const t of T) for (const it of items(t.id, 600)) expect(stems.has(norm(it.kz)), it.kz).toBe(false);
  });
  it('нет условий про сушку яблока и «240 теңге» из практического пула', () => {
    for (const t of T) for (const it of items(t.id, 600)) expect(it.kz).not.toMatch(/кептір|240 тең/);
  });
});
