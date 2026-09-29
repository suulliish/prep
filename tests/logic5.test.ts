import { describe, it, expect } from 'vitest';
import glossary from '../content/glossary.json';
// @ts-ignore — шаблоны написаны на JS
import logic5, { MISCONCEPTIONS5 } from '../content/templates/logic5.mjs';
// @ts-ignore
import { templates, byId } from '../content/templates/index.mjs';
// @ts-ignore
import { rng } from '../content/templates/lib.mjs';
// @ts-ignore
import { skillById } from '../content/skills.mjs';
// @ts-ignore
import { MISCONCEPTIONS } from '../content/misconceptions.mjs';
import { totals, tiltTarget, springStep, vp, zerosOfProduct, MAX_TILT } from '../src/widgets/scalesmath';

const T = logic5 as any[];
const SEEDS = 300;
type Item = { kz: string; ru: string; choices: { text: string; tag: string }[]; answer: number; sol: { kz: string; ru: string }; hints: { kz: string; ru: string }[] };
const texts = (it: Item) => it.choices.map(c => c.text);
const ans = (it: Item) => it.choices[it.answer].text;
const nums = (s: string) => (s.match(/\d+/g) || []).map(Number);

// ---------- независимая проверка (перебором, без формул шаблона) ----------
const tz = (xs: number[]) => { let p = 1n; for (const x of xs) p *= BigInt(x); let c = 0; while (p % 10n === 0n) { p /= 10n; c++; } return c; };
const sideSum = (t: string) => t.split('+').map(x => +x.trim()).filter(x => x > 0).reduce((s, x) => s + x, 0);
const balance = (c: string) => { const m = /^оң: (.*); сол: (.*)$/.exec(c)!; return sideSum(m[1]) - sideSum(m[2]); };
/** Наибольшее M, такое что все массы 1..M отмеряются: subset-sum (одна чаша) или коэффициенты −1, 0, 1 (обе чаши). */
function reach(ws: number[], both: boolean): number {
  let set = new Set<number>([0]);
  for (const w of ws) { const nx = new Set<number>(); for (const s of set) for (const c of both ? [-1, 0, 1] : [0, 1]) nx.add(s + c * w); set = nx; }
  let M = 0; while (set.has(M + 1)) M++;
  return M;
}

const VERIFY: Record<string, (it: Item) => void> = {
  'logic.weighing_set'(it) {
    const N = nums(it.kz)[0];
    if (it.kz.includes('екі табаққа')) {
      const ws = (/Гірлер: ([\d, ]+) г/.exec(it.kz)![1]).split(',').map(x => +x);
      texts(it).forEach((c, i) => {
        expect(balance(c) === N, it.kz + ' | ' + c).toBe(i === it.answer);
        // каждая гиря не более одного раза и только из набора
        for (const w of [...(/оң: (.*); сол/.exec(c)![1]).split('+'), ...(/сол: (.*)$/.exec(c)![1]).split('+')].map(x => +x.trim()).filter(Boolean)) expect(ws).toContain(w);
      });
    } else {
      texts(it).forEach((c, i) => {
        const ps = c.split(' + ').map(Number);
        expect(new Set(ps).size, c).toBe(ps.length);
        for (const w of ps) expect([1, 2, 4, 8, 16]).toContain(w);
        expect(ps.reduce((s, x) => s + x, 0) === N, it.kz + ' | ' + c).toBe(i === it.answer);
      });
    }
  },
  'logic.weighing_range'(it) {
    const ws = (/Гірлер: ([\d, ]+) г/.exec(it.kz)![1]).split(',').map(x => +x);
    expect(ans(it)).toBe(String(reach(ws, it.kz.includes('екі табаққа'))));
  },
  'div.trailing_zeros_factorial'(it) {
    const n = nums(it.ru)[1];
    expect(n).not.toBe(50);            // holdout daryn2025-51
    expect(ans(it)).toBe(String(tz(Array.from({ length: n }, (_, i) => i + 1))));
    expect(nums(it.kz)[1]).toBe(n);    // kz и ru про одно и то же число
  },
  'div.trailing_zeros_product'(it) {
    const xs = nums(it.kz);
    expect(nums(it.ru)).toEqual(xs);
    expect(ans(it)).toBe(String(tz(xs)));
  },
};

const avoid = (glossary as any).terms.flatMap((t: any) => (t.avoid || []).map((a: string) => ({ a, kz: t.kz })));
const findAvoid = (text: string) =>
  avoid.filter(({ a }: any) => (a === a.toUpperCase() ? new RegExp(`(^|[^А-Яа-я])${a}([^А-Яа-я]|$)`) : new RegExp(`(^|[^а-яё])${a}`, 'i')).test(text));
const ASCII_MINUS = /(^|[^\wа-яәіңғүұқөһ])-\d/i;

describe('шаблоны logic5: таразы и нули', () => {
  it('4 шаблона, у каждого проверка ответа; они привязаны к навыкам', () => {
    expect(T.map(t => t.id)).toEqual(['logic.weighing_set', 'logic.weighing_range', 'div.trailing_zeros_factorial', 'div.trailing_zeros_product']);
    for (const t of T) {
      expect(VERIFY[t.id], t.id).toBeTypeOf('function');
      for (const sk of t.skills) expect(skillById[sk].templates, `${sk} не содержит ${t.id}`).toContain(t.id);
      expect(byId[t.id]).toBe(t);
    }
    expect(templates.length).toBeGreaterThan(80);
    expect(skillById['logic.weighing'].grade).toBe(5);
    expect(skillById['div.trailing_zeros'].grade).toBe(5);
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
          // третья подсказка не выдаёт ответ целиком (для ответов-наборов гирь и сумм)
          if (ans(it).includes(';') || ans(it).includes('+')) expect(it.hints[2].kz.replace(/\s+/g, '').includes(ans(it).replace(/\s+/g, ''))).toBe(false);
        }
      });
      it('ответ верен: пересчитан независимо', () => {
        const r = rng(7);
        for (let i = 0; i < SEEDS; i++) VERIFY[t.id](t.gen(r));
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
      it('метки ошибок известны: есть в misconceptions.mjs или в MISCONCEPTIONS5', () => {
        const r = rng(17), seen = new Set<string>();
        for (let i = 0; i < SEEDS; i++) for (const c of (t.gen(r) as Item).choices) seen.add(c.tag);
        for (const tag of seen) if (tag !== 'correct' && tag !== 'random') expect((MISCONCEPTIONS as any)[tag] ?? (MISCONCEPTIONS5 as any)[tag], `${t.id}: нет разбора для «${tag}»`).toBeTruthy();
      });
      it('разнообразие условий и неправильных вариантов', () => {
        const r = rng(19), stems = new Set<string>(), tags = new Set<string>();
        for (let i = 0; i < 400; i++) { const it: Item = t.gen(r); stems.add(it.kz + '|' + texts(it).join('|')); it.choices.forEach(c => tags.add(c.tag)); }
        expect(stems.size).toBeGreaterThanOrEqual(40);
        expect(tags.size).toBeGreaterThanOrEqual(4);
      });
    });
  }

  it('тексты MISCONCEPTIONS5 на двух языках и без слов из avoid', () => {
    for (const [tag, m] of Object.entries(MISCONCEPTIONS5 as Record<string, any>)) {
      expect(m.kz.length, tag).toBeGreaterThan(10); expect(m.ru.length, tag).toBeGreaterThan(10);
      expect(findAvoid(m.kz), tag).toEqual([]);
    }
  });
});

describe('scalesmath: таразы и нули', () => {
  it('totals: слева зат и левые гири, справа правые; гиря в руке (skip) не считается', () => {
    expect(totals([1, 2, 4], ['R', 'L', null], 10)).toEqual({ L: 12, R: 1 });
    expect(totals([1, 2, 4], ['R', 'L', 'R'], 10, 2)).toEqual({ L: 12, R: 1 });
    expect(totals([], [], 7)).toEqual({ L: 7, R: 0 });
  });
  it('tiltTarget: слева тяжелее — минус (левая чаша вниз), равно — 0, симметрия, насыщение, монотонность', () => {
    expect(tiltTarget(5, 5)).toBe(0);
    expect(tiltTarget(10, 0)).toBeLessThan(0);
    expect(tiltTarget(0, 10)).toBeGreaterThan(0);
    expect(tiltTarget(3, 9)).toBeCloseTo(-tiltTarget(9, 3), 9);
    expect(Math.abs(tiltTarget(0, 1000))).toBeLessThanOrEqual(MAX_TILT);
    const a = [0, 1, 2, 4, 8].map(d => tiltTarget(0, d)); for (let i = 1; i < a.length; i++) expect(a[i]).toBeGreaterThan(a[i - 1]);
    expect(Math.abs(tiltTarget(11, 10))).toBeGreaterThan(1);   // разница в 1 г заметна
  });
  it('springStep: приходит в цель и не улетает', () => {
    let s = { a: 0, v: 0 }, peak = 0;
    for (let i = 0; i < 400; i++) { s = springStep(s.a, s.v, 12, 1 / 60); peak = Math.max(peak, s.a); }
    expect(s.a).toBeCloseTo(12, 1); expect(Math.abs(s.v)).toBeLessThan(0.01); expect(peak).toBeLessThan(16);
    // без гладкости было бы 0 → 12 за один кадр; после одного кадра — ещё далеко
    expect(springStep(0, 0, 12, 1 / 60).a).toBeLessThan(2);
  });
  it('vp и zerosOfProduct', () => {
    expect(vp(25, 5)).toBe(2); expect(vp(40, 2)).toBe(3); expect(vp(7, 5)).toBe(0);
    expect(zerosOfProduct(Array.from({ length: 30 }, (_, i) => i + 1))).toBe(7);
    expect(zerosOfProduct(Array.from({ length: 25 }, (_, i) => i + 1))).toBe(6);
    expect(zerosOfProduct([5, 25, 15, 4])).toBe(2);
    for (let n = 1; n <= 60; n++) expect(zerosOfProduct(Array.from({ length: n }, (_, i) => i + 1))).toBe(tz(Array.from({ length: n }, (_, i) => i + 1)));
  });
  it('гири 1, 2, 4, 8, 16 покрывают 1..31, а 1, 4, 16 на двух чашах — не всё (перебор)', () => {
    expect(reach([1, 2, 4, 8, 16], false)).toBe(31);
    expect(reach([1, 3, 9, 27], true)).toBe(40);
    expect(reach([1, 4, 16], true)).toBe(1);   // 2 не получить: 1, 3, 4, 5 есть, а 2 нет
  });
});
