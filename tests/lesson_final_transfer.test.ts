// Перенос, а не память (аудит 01.10, раздел 3.2): финал проверяет, умеет ли ребёнок, а не помнит ли ответ из примера.
// Цель и финал урока стоят на соседней задаче того же типа (другие числа, тот же приём), пример «Көр» решает свою задачу.
// Финал как на экзамене: 5 вариантов. Ответы 25 переработанных финалов пересчитаны независимо от текста урока.
import { describe, it, expect } from 'vitest';
// @ts-ignore
import { LESSONS } from '../content/lessons.mjs';

const L = LESSONS as Record<string, any[]>;
const norm = (t: string) => t.replace(/(\d) (?=\d{3}(?!\d))/g, '$1');               // 5 214 → 5214
const fracText = (t: string) => t.replace(/\{"n":(\d+),"d":(\d+)[^}]*\}/g, '$1/$2');   // {"n":4,"d":7} → 4/7
/** Числа, дроби и слова-ребусы из текста: «5214», «4/7», «ВВГ». */
const tokens = (t: string) => new Set(norm(fracText(t)).match(/\d+\/\d+|\d+|[А-ЯӘІҢҒҮҰҚӨҺ]{2,}/g) ?? []);
/** «Значимые» токены: дроби, числа от 10 и слова-ребусы; если таких нет (задача на 5, 8, 9), то все. */
const significant = (set: Set<string>) => { const s = [...set].filter(x => x.includes('/') || x.length >= 2); return s.length ? s : [...set]; };
const exampleText = (ex: any) => JSON.stringify([ex.kz, ex.scene, ex.frames.map((f: any) => [f.kz, f.math ?? '', f.s, f.scene])]);

const TOPICS = ['div.rules', 'div.primes', 'div.gcd', 'div.gcd_lcm_word', 'div.count_multiples', 'frac.concept', 'frac.magnitude', 'frac.reduce',
  'frac.common_denominator', 'frac.compare', 'frac.add_sub', 'frac.mixed', 'logic.weighing', 'div.trailing_zeros', 'frac.mul', 'frac.div',
  'frac.part_of_number', 'frac.find_whole', 'logic.page_digits', 'logic.permutations', 'logic.pairs_tournament', 'pat.sequences', 'logic.calendar',
  'vis.count_squares', 'logic.cryptarithm'];

describe('финал как на экзамене: 5 вариантов (все 51 урок)', () => {
  it('в курсе 51 урок (36 + 5 десятичных + 5 аварийных, C5 + 3 про букву и уравнения, C7 + 2 про x с двух сторон и скобки, C9), последний шаг каждого — final', () => {
    expect(Object.keys(L).length).toBe(51);
    for (const [sk, steps] of Object.entries(L)) expect(steps.at(-1).type, sk).toBe('final');
  });
  it('у финала 5 разных вариантов, answer — целое в диапазоне 0–4', () => {
    for (const [sk, steps] of Object.entries(L)) {
      const f = steps.at(-1);
      expect(f.choices.length, `${sk}: вариантов`).toBe(5);
      expect(new Set(f.choices).size, `${sk}: повторы`).toBe(5);
      expect(Number.isInteger(f.answer) && f.answer >= 0 && f.answer <= 4, `${sk}: answer ${f.answer}`).toBe(true);
    }
  });
  it('после перемешивания верный вариант не всегда на одной позиции', () => {
    const pos = new Set(Object.values(L).map(s => s.at(-1).answer));
    expect(pos.size).toBeGreaterThanOrEqual(4);
  });
});

describe('25 тем: цель и финал стоят на задаче, которой нет в примере', () => {
  for (const sk of TOPICS) {
    const steps = L[sk], goal = steps.find(s => s.type === 'goal'), ex = steps.find(s => s.type === 'example'), fin = steps.at(-1);
    it(`${sk}: числа цели не встречаются все вместе в примере`, () => {
      const g = tokens(goal.task), e = tokens(exampleText(ex));
      expect(g.size, 'в цели нет чисел').toBeGreaterThan(0);
      expect([...g].filter(x => !e.has(x)).length, `цель ${[...g]} целиком есть в примере`).toBeGreaterThan(0);
      const sig = significant(g);
      expect(sig.filter(x => !e.has(x)).length, `значимые числа цели ${sig} целиком есть в примере`).toBeGreaterThan(0);
    });
    it(`${sk}: цель и финал про одну задачу (значимые числа цели есть в финале)`, () => {
      const need = significant(tokens(goal.kz + ' ' + goal.task)), have = tokens(fin.kz + ' ' + fracText(JSON.stringify(fin.s)) + ' ' + fin.why);
      for (const x of need) expect(have.has(x), `«${x}» из цели нет в финале`).toBe(true);
    });
  }
});

// ---- независимый пересчёт ответов ----
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
const lcm = (a: number, b: number) => a / gcd(a, b) * b;
const frac = (n: number, d: number) => `${n / gcd(n, d)}/${d / gcd(n, d)}`;
const isPrime = (n: number) => { if (n < 2) return false; for (let p = 2; p * p <= n; p++) if (n % p === 0) return false; return true; };
const DAYS = ['Жексенбі', 'Дүйсенбі', 'Сейсенбі', 'Сәрсенбі', 'Бейсенбі', 'Жұма', 'Сенбі'];

/** [входные числа из задачи (обязаны стоять в task цели), как пересчитать верный ответ] */
const CHECKS: Record<string, [string[], () => string]> = {
  'div.rules': [['5214'], () => [2, 3, 5, 9].filter(d => 5214 % d === 0).join(' және ')],
  'div.primes': [['50'], () => String(Array.from({ length: 50 }, (_, i) => i + 1).filter(isPrime).length)],
  'div.gcd': [['54', '90'], () => String(gcd(54, 90))],
  'div.gcd_lcm_word': [['42', '56'], () => String(gcd(42, 56))],
  'div.count_multiples': [['60', '3', '5'], () => String(Array.from({ length: 60 }, (_, i) => i + 1).filter(k => k % 3 && k % 5).length)],
  'frac.concept': [['12', '5'], () => frac(12 - 5, 12)],
  'frac.magnitude': [['4/9', '5/12', '7/13'], () => [[4, 9], [5, 12], [7, 13]].filter(([n, d]) => 2 * n > d).map(([n, d]) => `${n}/${d}`).join()],
  'frac.reduce': [['60/84'], () => frac(60, 84)],
  'frac.common_denominator': [['7/15', '9/20'], () => String(lcm(15, 20))],
  'frac.compare': [['7/12', '9/16'], () => (7 * 16 > 9 * 12 ? '7/12' : '9/16')],
  'frac.add_sub': [['7/10', '8/15'], () => { const d = lcm(10, 15), n = 7 * (d / 10) + 8 * (d / 15); return `${n}/${d}`; }],
  'frac.mixed': [['2 5/7', '1/7'], () => String(2 * 7 + 5)],
  'logic.weighing': [['22'], () => { let v = 22; const pick: number[] = []; for (const w of [16, 8, 4, 2, 1]) if (w <= v) { v -= w; pick.push(w); } return pick.join(' + '); }],
  'div.trailing_zeros': [['50'], () => { let f = 1n; for (let i = 1n; i <= 50n; i++) f *= i; let z = 0; while (f % 10n === 0n) { f /= 10n; z++; } return String(z); }],
  'frac.mul': [['5/6', '4/15'], () => frac(5 * 4, 6 * 15)],
  'frac.div': [['4', '2/3'], () => String(4 * 3 / 2)],
  'frac.part_of_number': [['54', '7/9'], () => `${54 / 9 * 7} г`],
  'frac.find_whole': [['4/7', '36'], () => `${36 / 4 * 7} г`],
  'logic.page_digits': [['393'], () => { let total = 0, p = 0; while (total < 393) { p++; total += String(p).length; } return total === 393 ? String(p) : 'нет такого числа страниц'; }],
  'logic.permutations': [['8'], () => { let c = 0; for (let a = 0; a < 8; a++) for (let b = 0; b < 8; b++) for (let d = 0; d < 8; d++) if (a !== b && b !== d && a !== d) c++; return String(c); }],
  'logic.pairs_tournament': [['9'], () => { let c = 0; for (let i = 0; i < 9; i++) for (let j = i + 1; j < 9; j++) c++; return String(c); }],
  'pat.sequences': [['1', '3', '7', '13', '21'], () => { const a = [1, 3, 7, 13, 21], d = a.slice(1).map((x, i) => x - a[i]); return String(a.at(-1)! + d.at(-1)! + (d[1] - d[0])); }],
  'logic.calendar': [['38'], () => DAYS[(5 + 38) % 7]],                       // пятница = 5; воскресенье = 0 (Жексенбі)
  'vis.count_squares': [['6'], () => { let c = 0; for (let s = 1; s <= 6; s++) c += (6 - s + 1) ** 2; return String(c); }],
  'logic.cryptarithm': [['ВВГ'], () => { const vals = new Set<number>(); for (let a = 1; a <= 9; a++) for (let b = 1; b <= 9; b++) for (let v = 1; v <= 9; v++) for (let g = 0; g <= 9; g++) { if (new Set([a, b, v, g]).size < 4) continue; if (10 * a + b + 10 * b + a === 110 * v + g) vals.add(g); } return vals.size === 1 ? String([...vals][0]) : 'неоднозначно'; }],
};

describe('ответы 25 финалов пересчитаны независимо', () => {
  it('таблица покрывает все 25 тем', () => expect(Object.keys(CHECKS).sort()).toEqual([...TOPICS].sort()));
  for (const sk of TOPICS) {
    const [inputs, calc] = CHECKS[sk];
    it(`${sk}: входные числа стоят в цели, ответ финала совпадает с пересчётом`, () => {
      const goal = L[sk].find(s => s.type === 'goal'), fin = L[sk].at(-1), g = tokens(goal.task + ' ' + goal.kz);
      for (const x of inputs) expect(g.has(x.replace(/^\d+ /, '')) || g.has(x), `«${x}» не найдено в цели`).toBe(true);
      expect(fin.choices[fin.answer]).toBe(calc());
    });
  }
  it('div.rules: 5214 делится на 2 и 3, но не на 5 и 9 (сумма цифр 12); ни один неверный вариант не равен набору {2, 3}', () => {
    expect([2, 3, 5, 9].filter(d => 5214 % d === 0)).toEqual([2, 3]);
    const f = L['div.rules'].at(-1);
    f.choices.forEach((c: string, i: number) => { if (i !== f.answer) expect((c.match(/\d+/g) ?? []).join() === '2,3', c).toBe(false); });
  });
  it('logic.weighing: ровно один вариант даёт 22 г, остальные суммы другие', () => {
    const sums = L['logic.weighing'].at(-1).choices.map((c: string) => c.split(' + ').map(Number).reduce((a: number, b: number) => a + b, 0));
    expect(sums.filter((s: number) => s === 22).length).toBe(1);
  });
  it('frac.reduce: неверные варианты либо сократимы, либо не равны 60/84', () => {
    const f = L['frac.reduce'].at(-1);
    f.choices.forEach((c: string, i: number) => {
      const [n, d] = c.split('/').map(Number), equal = n * 84 === d * 60;
      if (i === f.answer) expect(equal && gcd(n, d) === 1).toBe(true); else expect(!equal || gcd(n, d) > 1, c).toBe(true);
    });
  });
  it('финалы-дроби (кроме сокращения): среди вариантов нет равного верному по значению', () => {
    const val = (c: string) => { const m = /^(\d+)\/(\d+)$/.exec(c); return m ? +m[1] / +m[2] : null; };
    for (const sk of ['frac.concept', 'frac.add_sub', 'frac.mul', 'frac.compare', 'frac.magnitude']) {
      const f = L[sk].at(-1), right = val(f.choices[f.answer]);
      if (right === null) continue;
      f.choices.forEach((c: string, i: number) => { const v = val(c); if (i !== f.answer && v !== null) expect(Math.abs(v - right) > 1e-9, `${sk}: «${c}» равно верному`).toBe(true); });
    }
  });
});
