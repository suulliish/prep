import { describe, it, expect } from 'vitest';
// @ts-ignore
import { LESSONS as LS } from '../content/lessons.mjs';
const LESSONS = LS as Record<string, any[]>;
// @ts-ignore
import { WEEK1 as W1 } from '../content/lessons_week1.mjs';
// @ts-ignore
import { WEEK2 as W2 } from '../content/lessons_week2.mjs';
const WEEK1 = W1 as Record<string, any[]>, WEEK2 = W2 as Record<string, any[]>;
const FULL = { ...WEEK1, ...WEEK2 };
// @ts-ignore
import { skillById } from '../content/skills.mjs';
// @ts-ignore
import { rng, kzWords } from '../content/templates/lib.mjs';

const WIDGETS = Object.keys(import.meta.glob('../src/widgets/*.svelte')).map(f => f.split('/').pop()!.replace('.svelte', ''));
const TYPES = ['say', 'goal', 'widget', 'predict', 'example', 'faded', 'why', 'bug', 'blitz', 'rule', 'final', 'quiz'];

describe('уроки', () => {
  for (const [id, steps] of Object.entries(LESSONS) as [string, any[]][]) {
    it(`${id}: шаги корректны`, () => {
      expect(skillById[id], 'навык есть в графе').toBeTruthy();
      for (const s of steps) {
        expect(TYPES).toContain(s.type);
        if (s.type === 'widget') expect(WIDGETS).toContain(s.w);
        if (['predict', 'why', 'final', 'quiz'].includes(s.type)) {
          expect(s.answer).toBeGreaterThanOrEqual(0); expect(s.answer).toBeLessThan(s.choices.length);
          expect(new Set(s.choices).size).toBe(s.choices.length);
        }
        if (s.type === 'faded') {
          expect(s.steps.some((x: any) => x.blank)).toBe(true);
          for (const x of s.steps) {
            if (x.blank) { expect(x.math).toContain('▢'); expect(x.blank.answer).toBeLessThan(x.blank.choices.length); expect(new Set(x.blank.choices).size).toBe(x.blank.choices.length); }
            else expect(x.math).not.toContain('▢');
          }
        }
        if (s.type === 'bug') { expect(s.bad).toBeLessThan(s.lines.length); expect(s.follows ?? []).not.toContain(s.bad); }
        if (s.type === 'example') expect(s.frames.length).toBeGreaterThan(0);
      }
    });
  }
});

describe('недели 1–2 — полный сценарий', () => {
  for (const [id, steps] of Object.entries(FULL) as [string, any[]][]) {
    it(`${id}: цель → … → возврат к цели`, () => {
      const t = steps.map(s => s.type);
      expect(t[0]).toBe('goal'); expect(t.at(-1)).toBe('final');
      for (const need of ['widget', 'predict', 'example', 'faded', 'why', 'bug', 'blitz', 'rule']) expect(t, need).toContain(need);
      expect(t.filter(x => x === 'faded').length).toBeGreaterThanOrEqual(2);
    });
    it(`${id}: мини-игра выдаёт верные раунды`, () => {
      const b = steps.find(s => s.type === 'blitz');
      const r = rng(7);
      for (let k = 0; k < 300; k++) {
        const it = b.make(r);
        expect(new Set(it.choices).size, it.q + ' ' + it.choices).toBe(it.choices.length);
        expect(it.choices.length).toBeGreaterThanOrEqual(2);
        expect(it.answer).toBeGreaterThanOrEqual(0); expect(it.answer).toBeLessThan(it.choices.length);
        expect(it.choices.join()).not.toMatch(/NaN|undefined|-\d/);
      }
    });
  }
  it('мини-игры недели 2 считают правильно', () => {
    const r = rng(5), g = (a: number, b: number): number => (b ? g(b, a % b) : a);
    const pr = (n: number) => { for (let d = 2; d * d <= n; d++) if (n % d === 0) return false; return n > 1; };
    const bl = (id: string) => WEEK2[id].find((s: any) => s.type === 'blitz')!;
    for (let k = 0; k < 300; k++) {
      let it = bl('div.primes').make(r); expect(it.answer).toBe(pr(+it.q) ? 0 : 1);
      it = bl('div.gcd').make(r); let [a, b] = it.q.match(/\d+/g)!.map(Number); expect(it.choices[it.answer]).toBe(String(g(a, b)));
      it = bl('div.lcm').make(r); [a, b] = it.q.match(/\d+/g)!.map(Number); expect(it.choices[it.answer]).toBe(String(a * b / g(a, b)));
      it = bl('div.factorization').make(r); const n = +it.q.match(/\d+/)![0];
      const val = it.choices[it.answer].split(' · ').reduce((s: number, t: string) => { const m = t.match(/^(\d+)(.*)$/)!; const e = m[2] ? +[...m[2]].map(c => '⁰¹²³⁴⁵⁶⁷⁸⁹'.indexOf(c)).join('') : 1; return s * (+m[1]) ** e; }, 1);
      expect(val).toBe(n);
      it.choices[it.answer].split(' · ').forEach((t: string) => expect(pr(+t.match(/^\d+/)![0])).toBe(true));
    }
  });
  it('мини-игры считают правильно', () => {
    const r = rng(3), ev = (q: string) => Function(`return ${q.replace(/·/g, '*').replace(/ : /g, '/').replace(/−/g, '-')}`)();
    const b = WEEK1['nat.order_ops'].find((s: any) => s.type === 'blitz')!;
    for (let k = 0; k < 200; k++) { const it = b.make(r); expect(String(ev(it.q))).toBe(it.choices[it.answer]); }
    const d = WEEK1['div.rules'].find((s: any) => s.type === 'blitz')!;
    for (let k = 0; k < 200; k++) {
      const it = d.make(r), [n, div] = it.q.replace(/ /g, '').match(/\d+/g)!.map(Number);
      expect(it.answer).toBe(n % div === 0 ? 0 : 1);
    }
  });
});

describe('озвучка', () => {
  it('числа словами', () => {
    expect(kzWords(7008012)).toBe('жеті миллион сегіз мың он екі');
    expect(kzWords(7245)).toBe('жеті мың екі жүз қырық бес');
    expect(kzWords(100)).toBe('жүз');
    expect(kzWords(1000)).toBe('мың');
    expect(kzWords(47)).toBe('қырық жеті');
  });
});
