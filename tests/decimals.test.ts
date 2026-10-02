import { describe, it, expect } from 'vitest';
// @ts-ignore — шаблоны написаны на JS
import decimals, { MISCONCEPTIONS_DEC } from '../content/templates/decimals.mjs';
// @ts-ignore
import { rng } from '../content/templates/lib.mjs';
// @ts-ignore
import { skills, skillById } from '../content/skills.mjs';
// @ts-ignore
import { MISCONCEPTIONS } from '../content/misconceptions.mjs';

// C2 (02.10): 16 генераторов десятичных. Ответ проверяется по тексту условия независимой арифметикой
// (в целых: десятичная строка → [m, p]), не кодом генератора.
const T = decimals as any[];
type Item = { kz: string; ru: string; choices: { text: string; tag: string }[]; answer: number; sol: { kz: string; ru: string }; hints: { kz: string; ru: string }[] };
const SEEDS = 400;
const items = (id: string, n = SEEDS): Item[] => { const t = T.find(x => x.id === id)!; return Array.from({ length: n }, (_, i) => t.gen(rng(i * 7919 + 3))); };
const ans = (it: Item) => it.choices[it.answer].text;

// ---------- точная десятичная арифметика на BigInt-free целых (числа маленькие) ----------
type D = { m: number; p: number };
const D = (s: string): D => { const [i, f = ''] = s.replace('−', '-').split(','); return { m: Number(i + f), p: f.length }; };
const scale = (x: D, p: number) => x.m * 10 ** (p - x.p);
const eqD = (a: D, b: D) => { const p = Math.max(a.p, b.p); return scale(a, p) === scale(b, p); };
const cmpD = (a: D, b: D) => { const p = Math.max(a.p, b.p); return Math.sign(scale(a, p) - scale(b, p)); };
const addD = (a: D, b: D): D => { const p = Math.max(a.p, b.p); return { m: scale(a, p) + scale(b, p), p }; };
const subD = (a: D, b: D): D => { const p = Math.max(a.p, b.p); return { m: scale(a, p) - scale(b, p), p }; };
const mulD = (a: D, b: D): D => ({ m: a.m * b.m, p: a.p + b.p });
const fromFrac = (n: number, d: number): D => { for (let p = 0; p <= 6; p++) if ((n * 10 ** p) % d === 0) return { m: (n * 10 ** p) / d, p }; throw new Error('бесконечная'); };
const DEC = /\d+(?:,\d+)?/g;
const decs = (s: string) => (s.match(DEC) ?? []) as unknown as [string, string, ...string[]];
// ответ — каноническая запись (без лишних нулей в конце)
const canon = (s: string) => !/,\d*0$/.test(s);
const onlyOne = (it: Item, pred: (t: string) => boolean) => expect(it.choices.map(c => c.text).filter(pred), it.kz).toEqual([ans(it)]);

const VERIFY: Record<string, (it: Item) => void> = {
  'dec.place_digit'(it) {
    const [x] = decs(it.kz), f = x.split(',')[1]!;
    const k = /ондық үлестер/.test(it.kz) ? 0 : /жүздік/.test(it.kz) ? 1 : 2;
    expect(ans(it)).toBe(f[k]);
  },
  'dec.from_fraction10'(it) {
    const [, n, d] = /(\d+)\/(\d+)/.exec(it.kz)!.map(Number);
    onlyOne(it, t => eqD(D(t), fromFrac(n, d)));
  },
  'dec.units'(it) {
    const m = /^(\d+) (\S+) (\d+) (\S+)/.exec(it.kz)!; const a = +m[1], b = +m[3];
    const f = m[2] === 'м' ? 100 : 1000;
    onlyOne(it, t => eqD(D(t), addD({ m: a, p: 0 }, fromFrac(b, f))));
  },
  'dec.expanded'(it) {
    const expr = it.kz.split(' өрнегін')[0];
    const sum = expr.split(' + ').reduce((acc, term) => { const [n, d] = term.split('/').map(Number); return addD(acc, d ? fromFrac(n, d) : { m: n, p: 0 }); }, { m: 0, p: 0 } as D);
    onlyOne(it, t => eqD(D(t), sum));
  },
  'dec.compare_true'(it) {
    const truth = (s: string) => { const [a, op, b] = s.split(' '); const c = cmpD(D(a), D(b)); return op === '<' ? c < 0 : op === '>' ? c > 0 : c === 0; };
    onlyOne(it, truth);
  },
  'dec.order_extreme'(it) {
    const list = it.kz.split(': ')[1].replace(/\.$/, '').split('; ');
    expect(list.sort()).toEqual(it.choices.map(c => c.text).sort());
    const max = /Ең үлкен/.test(it.kz);
    const best = list.reduce((a, b) => ((max ? cmpD(D(b), D(a)) > 0 : cmpD(D(b), D(a)) < 0) ? b : a));
    expect(ans(it)).toBe(best);
    expect(list.filter(x => eqD(D(x), D(best)))).toHaveLength(1);
  },
  'dec.round'(it) {
    const [x] = decs(it.kz), k = /бірліктерге/.test(it.kz) ? 0 : /ондық/.test(it.kz) ? 1 : 2;
    const v = D(x), u = 10 ** (v.p - k), q = Math.floor(v.m / u), rem = v.m % u;
    const want: D = { m: q + (rem * 2 >= u ? 1 : 0), p: k };
    expect(eqD(D(ans(it)), want), it.kz).toBe(true);
    expect(D(ans(it)).p, it.kz).toBe(k);                           // записано ровно до нужного разряда
  },
  'dec.between'(it) {
    const [a, b] = decs(it.kz);
    onlyOne(it, t => cmpD(D(t), D(a)) > 0 && cmpD(D(t), D(b)) < 0);
  },
  'dec.add_align'(it) {
    const [a, b] = decs(it.kz);
    onlyOne(it, t => eqD(D(t), addD(D(a), D(b))));
  },
  'dec.sub_from_whole'(it) {
    const [a, b] = decs(it.kz);
    onlyOne(it, t => eqD(D(t), subD(D(a), D(b))));
  },
  'dec.add_word'(it) {
    const [a, b] = decs(it.kz).map(D);
    const more = /одан [\d,]+ \S+ (ұзын|ауыр|артық)\./.test(it.kz);   // «ұзындығы» — не «ұзын»
    const second = more ? addD(a, b) : subD(a, b);
    expect(second.m).toBeGreaterThan(0);
    onlyOne(it, t => eqD(D(t), addD(a, second)));
  },
  'dec.mul_pow10'(it) {
    const [x, P] = decs(it.kz), mul = it.kz.includes('·'), k = P.length - 1;
    const v = D(x), want: D = mul ? { m: v.m, p: v.p - k } : { m: v.m, p: v.p + k };
    const norm = (d: D): D => (d.p < 0 ? { m: d.m * 10 ** -d.p, p: 0 } : d);
    onlyOne(it, t => eqD(D(t), norm(want)));
  },
  'dec.mul_dec'(it) {
    const [a, b] = decs(it.kz);
    onlyOne(it, t => eqD(D(t), mulD(D(a), D(b))));
  },
  'dec.div_nat'(it) {
    const [a, n] = decs(it.kz);
    onlyOne(it, t => eqD(mulD(D(t), D(n)), D(a)));
  },
  'dec.frac_to_dec'(it) {
    const [, n, d] = /(\d+)\/(\d+)/.exec(it.kz)!.map(Number);
    onlyOne(it, t => eqD(D(t), fromFrac(n, d)));
  },
  'dec.dec_to_frac'(it) {
    const [x] = decs(it.kz), v = D(x);
    const g = (a: number, b: number): number => (b ? g(b, a % b) : a);
    const [n, d] = ans(it).split('/').map(Number);
    expect(g(n, d), it.kz).toBe(1);                                // несократимая
    expect(n * 10 ** v.p, it.kz).toBe(v.m * d);                      // и равна числу
    const same = it.choices.filter(c => { const [a, b] = c.text.split('/').map(Number); return a * 10 ** v.p === v.m * b; });
    expect(same.map(c => c.text), it.kz).toEqual([ans(it)]);
  },
};

describe('десятичные (C2): 16 генераторов, каждый проверен по условию', () => {
  it('ровно 16 генераторов, у каждого — проверка', () => {
    expect(T).toHaveLength(16);
    expect(T.map(t => t.id).sort()).toEqual(Object.keys(VERIFY).sort());
  });
  for (const t of T) it(t.id, () => {
    for (const it of items(t.id)) {
      expect(it.choices).toHaveLength(5);
      expect(new Set(it.choices.map(c => c.text)).size).toBe(5);
      expect(it.choices[it.answer].tag).toBe('correct');
      expect(JSON.stringify(it)).not.toMatch(/NaN|undefined|Infinity|-\d|\.\d/);   // минус — типографский, дробная часть — через запятую
      expect(it.hints).toHaveLength(3);
      if (t.id !== 'dec.compare_true' && t.id !== 'dec.dec_to_frac') expect(canon(ans(it)), `${t.id}: ${ans(it)}`).toBe(true);
      VERIFY[t.id](it);
    }
  });
});

describe('десятичные: подсказки, ловушки, граф', () => {
  const tokenRe = (a: string) => new RegExp('(^|[^\\d,/])' + a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?![\\d,/])');
  it('подсказки не называют верный ответ', () => {
    for (const t of T) for (const it of items(t.id, 200)) {
      if (t.id === 'dec.place_digit') continue;                     // ответ — одна цифра, она есть в самом условии
      const a = ans(it);
      // ступень 2 — общее правило темы (одно на все задачи, например «5–9 — бірге артады»), её не проверяем
      for (const h of [it.hints[0], it.hints[2]]) expect(tokenRe(a).test(h.kz), `${t.id}: «${h.kz}» → ${a}`).toBe(false);
    }
  });
  it('у каждой метки ошибки есть разбор (kz и ru)', () => {
    for (const t of T) for (const it of items(t.id, 200)) for (const c of it.choices)
      if (c.tag !== 'correct' && c.tag !== 'random') expect((MISCONCEPTIONS as any)[c.tag], `${t.id}: ${c.tag}`).toBeTruthy();
    for (const [k, v] of Object.entries(MISCONCEPTIONS_DEC as Record<string, { kz: string; ru: string }>)) { expect(v.kz.length, k).toBeGreaterThan(10); expect(v.ru.length, k).toBeGreaterThan(10); }
  });
  it('главные ловушки встречаются: 0,5 против 0,45 и 0,3 · 0,2 ≠ 0,6', () => {
    const tags = (id: string) => new Set(items(id).flatMap(it => it.choices.map(c => c.tag)));
    expect(tags('dec.compare_true').has('dec_longer_bigger')).toBe(true);
    expect(tags('dec.order_extreme').has('dec_longer_bigger')).toBe(true);
    expect(tags('dec.mul_dec').has('dec_mul_places')).toBe(true);
    expect(tags('dec.from_fraction10').has('dec_zeros_lost')).toBe(true);
    expect(tags('dec.add_align').has('dec_align_right')).toBe(true);
  });
  it('каждый шаблон привязан к своей теме, у каждой из 5 тем ≥ 2 генераторов и один — қиындық ≥ 2', () => {
    for (const t of T) for (const sk of t.skills) expect(skillById[sk].templates, `${sk} ← ${t.id}`).toContain(t.id);
    for (const id of ['dec.concept', 'dec.compare_round', 'dec.add_sub', 'dec.mul_div', 'dec.frac_convert']) {
      const own = T.filter(t => t.skills.includes(id));
      expect(own.length, id).toBeGreaterThanOrEqual(2);
      expect(own.some(t => t.difficulty >= 2), id).toBe(true);
    }
    expect((skills as any[]).filter(s => s.id.startsWith('dec.') && s.templates.length).length).toBeGreaterThanOrEqual(6);
  });
});
