import { describe, it, expect, vi } from 'vitest';
vi.setConfig({ testTimeout: 180000 });   // независимый полный перебор: в общем прогоне при нагрузке дольше 5 с
import glossary from '../content/glossary.json';
// @ts-ignore — шаблоны написаны на JS
import logic8, { solveCrypt, optimize, pickPuzzle, pickExtreme, SHAPES } from '../content/templates/logic8.mjs';
// @ts-ignore
import { templates, byId } from '../content/templates/index.mjs';
// @ts-ignore
import { rng } from '../content/templates/lib.mjs';
// @ts-ignore
import { skillById } from '../content/skills.mjs';
// @ts-ignore
import { MISCONCEPTIONS } from '../content/misconceptions.mjs';

const T = logic8 as any[];
const SEEDS = 300, HEAVY = 120;   // HEAVY — для проверок с полным перебором (каждая задача пересчитывается независимо)
type Item = { kz: string; ru: string; choices: { text: string; tag: string }[]; answer: number; sol: { kz: string; ru: string }; hints: { kz: string; ru: string }[] };
const texts = (it: Item) => it.choices.map(c => c.text);
const ans = (it: Item) => it.choices[it.answer].text;
const nums = (s: string) => (s.match(/\d+/g) || []).map(Number);

// ---------- независимый перебор (без solveCrypt): все расстановки цифр по буквам, значение проверяется в листе ----------
type Asg = Record<string, number>;
function brute(words: string[], sum: string, { lead = true, distinct = true } = {}): Asg[] {
  const ls = [...new Set([...words, sum].join(''))];
  const leadL = new Set(lead ? [...words, sum].filter(w => w.length > 1).map(w => w[0]) : []);
  const res: Asg[] = [], asg: Asg = {}, used = Array(10).fill(false);
  const val = (w: string) => { let n = 0; for (const c of w) n = n * 10 + asg[c]; return n; };
  (function rec(i: number) {
    if (i === ls.length) { if (words.reduce((s, w) => s + val(w), 0) === val(sum)) res.push({ ...asg }); return; }
    for (let d = leadL.has(ls[i]) ? 1 : 0; d <= 9; d++) {
      if (distinct && used[d]) continue;
      used[d] = true; asg[ls[i]] = d; rec(i + 1); used[d] = false;
    }
  })(0);
  return res;
}
/** Наибольшее/наименьшее значение выражения (сумма слов или разность) по всем допустимым расстановкам. */
function bruteExtreme(expr: string, mode: 'max' | 'min', { lead = true, distinct = true } = {}) {
  const diff = expr.includes(' − ');
  const words = expr.split(diff ? ' − ' : '+');
  const ls = [...new Set(words.join(''))];
  const leadL = new Set(lead ? words.map(w => w[0]) : []);
  const asg: Asg = {}, used = Array(10).fill(false);
  const val = (w: string) => { let n = 0; for (const c of w) n = n * 10 + asg[c]; return n; };
  let best: number | null = null;
  (function rec(i: number) {
    if (i === ls.length) {
      const v = diff ? val(words[0]) - val(words[1]) : words.reduce((s, w) => s + val(w), 0);
      if (best === null || (mode === 'max' ? v > best : v < best)) best = v;
      return;
    }
    for (let d = leadL.has(ls[i]) ? 1 : 0; d <= 9; d++) {
      if (distinct && used[d]) continue;
      used[d] = true; asg[ls[i]] = d; rec(i + 1); used[d] = false;
    }
  })(0);
  return best as unknown as number;
}
/** Разбор условия ребуса «найди цифру»: слова, сумма, что спрашивают. */
function parseLetter(it: Item) {
  const [head, eq] = it.kz.split('\n');
  const [left, sum] = eq.split(' = '), words = left.split(' + ');
  const one = /Төмендегі теңдікте (\S) әріп/.exec(head), two = /(\S) \+ (\S) қосындысы/.exec(head);
  expect(one || two, head).toBeTruthy();
  return { words, sum, eq, target: two ? ([two[1], two[2]] as [string, string]) : ([one![1]] as [string]) };
}
const valueOf = (t: string[], a: Asg) => (t.length === 2 ? a[t[0]] + a[t[1]] : a[t[0]]);

const VERIFY: Record<string, (it: Item) => void> = {
  'logic.crypt_two_digit'(it) { letterCheck(it); },
  'logic.crypt_three_digit'(it) { letterCheck(it); },
  'logic.crypt_lead'(it) {
    const { words, sum, target } = parseLetter(it);
    letterCheck(it);
    // спрашивают первую букву суммы, сумма длиннее слагаемых, ответ 1
    expect(target).toEqual([sum[0]]);
    expect(sum.length).toBeGreaterThan(Math.max(...words.map(w => w.length)));
    expect(ans(it)).toBe('1');
  },
  'logic.crypt_extreme'(it) {
    const expr = it.kz.split('\n')[1];
    expect(it.ru.split('\n')[1]).toBe(expr);
    const mode = it.kz.includes('ең кіші') ? 'min' : 'max';
    expect(it.ru).toContain(mode === 'min' ? 'наименьшее' : 'наибольшее');
    const v = bruteExtreme(expr, mode);
    expect(ans(it), expr).toBe(String(v));
    // ошибочные варианты: их метки честно описывают, откуда число берётся
    for (const c of it.choices) {
      if (c.tag === 'same_digit_two_letters') expect(+c.text, `${expr} ${c.tag}`).toBe(bruteExtreme(expr, mode, { distinct: false }));
      if (c.tag === 'zero_first_allowed') expect(+c.text, `${expr} ${c.tag}`).toBe(bruteExtreme(expr, mode, { lead: false }));
    }
  },
};
let n = 0;   // счётчик: дорогие проверки нарушенных правил — на каждом третьем ребусе
function letterCheck(it: Item) {
  const { words, sum, eq, target } = parseLetter(it);
  expect(it.ru).toContain(eq);
  if (target.length === 2) expect(it.ru).toContain(`${target[0]} + ${target[1]}`); else expect(it.ru).toMatch(new RegExp(`букв[аы] ${target[0]}\\?`));
  for (const c of [it.kz, it.ru]) expect(c.split('\n')).toHaveLength(2);
  const sols = brute(words, sum);
  expect(sols.length, eq).toBeGreaterThan(0);
  const vals = new Set(sols.map(a => valueOf(target, a)));
  expect(vals.size, `${eq}: ответ должен быть единственным`).toBe(1);
  expect(ans(it), eq).toBe(String([...vals][0]));
  // варианты: 5 разных, в диапазоне; метки описывают настоящую причину ошибки
  const nl = new Set(eq.replace(/[ +=]/g, '')).size, heavy = n++ % 3 === 0;
  const noLead = heavy && nl <= 5 ? new Set(brute(words, sum, { lead: false }).map(a => valueOf(target, a))) : null;
  const noDist = heavy && nl <= 4 ? new Set(brute(words, sum, { distinct: false }).map(a => valueOf(target, a))) : null;
  for (const c of it.choices) {
    const x = +c.text;
    expect(Number.isInteger(x) && x >= 0 && x <= (target.length === 2 ? 18 : 9), `${eq}: вариант ${c.text}`).toBe(true);
    if (c.tag === 'zero_first_allowed' && noLead) expect(noLead.has(x) || x === 0, `${eq} zero_first_allowed ${x}`).toBe(true);
    if (c.tag === 'same_digit_two_letters' && noDist) expect(noDist.has(x), `${eq} same_digit ${x}`).toBe(true);
    if (c.tag === 'forgot_carry') expect(Math.abs(x - +ans(it))).toBe(1);
    if (c.tag === 'mixed_letters') expect(sols.some(a => Object.values(a).includes(x)), `${eq} mixed ${x}`).toBe(true);
  }
}

const avoid = (glossary as any).terms.flatMap((t: any) => (t.avoid || []).map((a: string) => ({ a, kz: t.kz })));
const findAvoid = (text: string) =>
  avoid.filter(({ a }: any) => (a === a.toUpperCase() ? new RegExp(`(^|[^А-Яа-я])${a}([^А-Яа-я]|$)`) : new RegExp(`(^|[^а-яё])${a}`, 'i')).test(text));
const ASCII_MINUS = /(^|[^\wа-яәіңғүұқөһ])-\d/i;

describe('шаблоны logic8: ребусы (әріп = цифр)', () => {
  it('4 шаблона, у каждого проверка ответа; они привязаны к навыку logic.cryptarithm', () => {
    expect(T).toHaveLength(4);
    for (const t of T) {
      expect(VERIFY[t.id], t.id).toBeTypeOf('function');
      expect(t.skills).toEqual(['logic.cryptarithm']);
      expect(skillById['logic.cryptarithm'].templates, `навык не содержит ${t.id}`).toContain(t.id);
      expect(byId[t.id]).toBe(t);
    }
    expect(templates.length).toBeGreaterThan(100);
  });

  it('навык: 5 класс, логика, ждёт разряды и действия, четыре шаблона', () => {
    const s = skillById['logic.cryptarithm'];
    expect(s.grade).toBe(5); expect(s.cat).toBe('I');
    expect(s.prereqs).toEqual(['nat.place_value', 'nat.ops']);
    expect(s.templates).toHaveLength(4);
    for (const tid of s.templates) expect(byId[tid], tid).toBeTruthy();
    // ноябрьская тема: декабрьские × ÷ ждут её (весы, ребусы, нули — конец ноября)
    expect(skillById['frac.mul'].prereqs).toContain('logic.cryptarithm');
  });

  it('решатель solveCrypt совпадает с независимым перебором на формах ребусов (все решения, три режима)', () => {
    const r = rng(101);
    for (const [name, list] of Object.entries(SHAPES) as [string, string[]][]) {
      for (const shape of r.shuffle(list).slice(0, name.startsWith('mirror3') || name === 'three' || name === 'lead' ? 6 : 10)) {
        const [left, sum] = shape.split('='), words = left.split('+');
        const ls = new Set(shape.replace(/[+=]/g, ''));
        const key = (a: Asg) => JSON.stringify(Object.entries(a).sort());
        for (const opts of [{}, ...(ls.size <= 4 ? [{ lead: false }, { distinct: false }] : [])] as any[]) {
          const a = solveCrypt(words, sum, { ...opts, limit: 1e9 }).map(key).sort(), b = brute(words, sum, opts).map(key).sort();
          expect(a, `${shape} ${JSON.stringify(opts)}`).toEqual(b);
        }
      }
    }
  });

  it('оптимум optimize совпадает с независимым перебором (сумма слов и разность)', () => {
    const r = rng(103);
    for (let i = 0; i < 200; i++) {
      const p = pickExtreme(r);
      const mode = p.kind === 'min' ? 'min' : 'max';
      expect(p.v, p.expr).toBe(bruteExtreme(p.expr, mode));
      expect(optimize(p.coef, p.lead, mode).value).toBe(p.v);
    }
  });

  it('генератор отбрасывает ребус, где ответ не единственный: AB+CD=EFG про A', () => {
    const r = rng(5);
    expect(() => pickPuzzle(r, { mode: 'digit', pickShape: () => 'AB+CD=EFG' })).toThrow();
    // а пара из реального банка (ребус с DDDD) в формы не входит
    for (const list of Object.values(SHAPES) as string[][]) expect(list).not.toContain('ABC+CBA=DDDD');
  });

  for (const t of T) {
    describe(t.id, () => {
      it('устройство: 5 разных вариантов, метки, kz/ru, три подсказки, разбор', () => {
        const r = rng(2026);
        for (let i = 0; i < SEEDS; i++) {
          const it: Item = t.gen(r);
          expect(it.choices, it.kz).toHaveLength(5);
          expect(new Set(texts(it)).size, it.kz).toBe(5);
          expect(it.choices.filter(c => c.tag === 'correct'), it.kz).toHaveLength(1);
          expect(it.choices[it.answer].tag).toBe('correct');
          expect(it.kz.length).toBeGreaterThan(5); expect(it.ru.length).toBeGreaterThan(5);
          expect(it.sol.kz.length).toBeGreaterThan(5); expect(it.sol.ru.length).toBeGreaterThan(5);
          expect(JSON.stringify(it)).not.toMatch(/NaN|undefined|Infinity|null/);
          expect(it.hints).toHaveLength(3);
          for (const h of it.hints) { expect(h.kz.length).toBeGreaterThan(5); expect(h.ru.length).toBeGreaterThan(5); }
        }
      });
      it('ответ верен и единственный: пересчитан независимым перебором', () => {
        const r = rng(7);
        for (let i = 0; i < HEAVY; i++) VERIFY[t.id](t.gen(r));
      }, 180000);
      it('подсказки не выдают ответ; разбор его содержит', () => {
        const r = rng(23);
        for (let i = 0; i < SEEDS; i++) {
          const it: Item = t.gen(r), a = ans(it);
          for (const h of it.hints) { expect(nums(h.kz), `${h.kz} | ответ ${a}`).not.toContain(+a); expect(nums(h.ru), `${h.ru} | ответ ${a}`).not.toContain(+a); }
          expect(it.sol.kz).toContain(a); expect(it.sol.ru).toContain(a);
        }
      });
      it('нет слов из glossary.avoid, нет ASCII-минуса перед цифрой', () => {
        const r = rng(13);
        for (let i = 0; i < SEEDS; i++) {
          const it: Item = t.gen(r);
          const kz = [it.kz, it.sol.kz, t.title.kz, ...it.hints.map(h => h.kz), ...texts(it)].join('\n');
          expect(findAvoid(kz).map((h: any) => `${h.a} → ${h.kz}`), kz.slice(0, 200)).toEqual([]);
          expect([kz, it.ru, it.sol.ru, ...it.hints.map(h => h.ru)].join('\n')).not.toMatch(ASCII_MINUS);
        }
      });
      it('метки ошибок известны в misconceptions.mjs, их не меньше трёх видов', () => {
        const r = rng(17), seen = new Set<string>();
        for (let i = 0; i < SEEDS; i++) for (const c of (t.gen(r) as Item).choices) seen.add(c.tag);
        for (const tag of seen) if (tag !== 'correct' && tag !== 'random') expect((MISCONCEPTIONS as any)[tag], `${t.id}: нет разбора для «${tag}»`).toBeTruthy();
        expect([...seen].filter(x => x !== 'correct').length).toBeGreaterThanOrEqual(3);
      });
      it('разнообразие условий', () => {
        const r = rng(19), stems = new Set<string>();
        for (let i = 0; i < 400; i++) { const it: Item = t.gen(r); stems.add(it.kz + '|' + texts(it).join('|')); }
        expect(stems.size).toBeGreaterThanOrEqual(150);
      });
    });
  }

  it('три главные ошибки ребусов встречаются среди вариантов: нуль в начале, одна цифра двум буквам, забытый перенос', () => {
    const r = rng(41), tags = new Set<string>();
    for (const id of ['logic.crypt_two_digit', 'logic.crypt_three_digit', 'logic.crypt_lead', 'logic.crypt_extreme'])
      for (let i = 0; i < 300; i++) for (const c of (byId[id].gen(r) as Item).choices) tags.add(c.tag);
    for (const x of ['zero_first_allowed', 'same_digit_two_letters', 'forgot_carry', 'mixed_letters', 'carry_more_than_one', 'ignored_place_value', 'greedy_by_order', 'zero_unused']) expect(tags.has(x), x).toBe(true);
  });

  it('вопросы ребуса бывают всех видов: цифра буквы, сумма двух букв, наибольшее, наименьшее, разность', () => {
    const r = rng(47), kinds = new Set<string>();
    for (let i = 0; i < 300; i++) {
      const a: Item = byId['logic.crypt_two_digit'].gen(r), b: Item = byId['logic.crypt_extreme'].gen(r);
      kinds.add(/қосындысы неге тең/.test(a.kz) ? 'sum' : 'letter');
      kinds.add(b.kz.includes(' − ') ? 'diff' : b.kz.includes('ең кіші') ? 'min' : 'max');
    }
    expect([...kinds].sort()).toEqual(['diff', 'letter', 'max', 'min', 'sum']);
  });

  it('тексты для новых меток на двух языках и без слов из avoid', () => {
    const r = rng(43), tags = new Set<string>();
    for (const t of T) for (let i = 0; i < 100; i++) for (const c of (t.gen(r) as Item).choices) tags.add(c.tag);
    for (const tag of tags) {
      if (tag === 'correct' || tag === 'random') continue;
      const m = (MISCONCEPTIONS as any)[tag];
      expect(m.kz.length, tag).toBeGreaterThan(10); expect(m.ru.length, tag).toBeGreaterThan(10);
      expect(findAvoid(m.kz), tag).toEqual([]);
    }
  });
});
