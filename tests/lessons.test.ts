import { describe, it, expect } from 'vitest';
// @ts-ignore
import { LESSONS as LS } from '../content/lessons.mjs';
const LESSONS = LS as Record<string, any[]>;
// @ts-ignore
import { WEEK1 as W1 } from '../content/lessons_week1.mjs';
// @ts-ignore
import { WEEK2 as W2 } from '../content/lessons_week2.mjs';
// @ts-ignore
import { WEEK3 as W3 } from '../content/lessons_week3.mjs';
// @ts-ignore
import { WEEK4 as W4 } from '../content/lessons_week4.mjs';
// @ts-ignore
import { WEEK5 as W5 } from '../content/lessons_week5.mjs';
const WEEK1 = W1 as Record<string, any[]>, WEEK2 = W2 as Record<string, any[]>, WEEK3 = W3 as Record<string, any[]>, WEEK4 = W4 as Record<string, any[]>, WEEK5 = W5 as Record<string, any[]>;
const FULL = { ...WEEK1, ...WEEK2, ...WEEK3, ...WEEK4, ...WEEK5 };
// @ts-ignore
import { skillById } from '../content/skills.mjs';
// @ts-ignore
import { rng, kzWords, Q } from '../content/templates/lib.mjs';
// @ts-ignore
import GLOSSARY from '../content/glossary.json';
import { readFileSync } from 'node:fs';

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

describe('недели 1–5 — полный сценарий', () => {
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
  it('мини-игры недели 3 считают правильно', () => {
    const r = rng(8), bl = (id: string) => WEEK3[id].find((s: any) => s.type === 'blitz')!;
    const nums = (q: string) => q.match(/\d+/g)!.map(Number);
    const parse = (t: string) => (t === '∅' ? [] : t.slice(1, -1).split(', ').map(Number));
    for (let k = 0; k < 300; k++) {
      let it = bl('div.count_multiples').make(r); let [, n, d] = nums(it.q); expect(it.choices[it.answer]).toBe(String(Math.floor(n / d)));
      it = bl('div.star_digit').make(r); const [a, b, dv] = nums(it.q);
      it.choices.forEach((c: string, i: number) => expect((a + b + +c) % dv === 0).toBe(i === it.answer));
      it = bl('div.powers_count').make(r); [, n] = nums(it.q); const p = it.q.includes('квадрат') ? 2 : 3;
      const kk = +it.choices[it.answer]; expect(kk ** p <= n && (kk + 1) ** p > n).toBe(true);
      it = bl('sets.basics').make(r); const [As, Bs] = it.q.match(/\{[^}]*\}/g)!.map(parse);
      const want = it.q.includes('∩') ? As.filter((x: number) => Bs.includes(x)) : [...new Set([...As, ...Bs])];
      expect(parse(it.choices[it.answer]).sort((x: number, y: number) => x - y)).toEqual(want.sort((x: number, y: number) => x - y));
      it = bl('sets.venn').make(r); const [fa, fb, fc] = nums(it.q); expect(it.choices[it.answer]).toBe(String(fa + fb - fc));
    }
  });
  it('мини-игры недели 4 (дроби) считают правильно', () => {
    const r = rng(11), bl = (id: string) => WEEK4[id].find((s: any) => s.type === 'blitz')!;
    const g = (a: number, b: number): number => (b ? g(b, a % b) : a), lcm = (a: number, b: number) => (a / g(a, b)) * b;
    const fr = (t: string) => { const [a, b] = t.split('/').map(Number); return new Q(a, b); };
    const half = new Q(1, 2);
    for (let k = 0; k < 300; k++) {
      // frac.concept: бөлімде — барлық бөлік; «тең емес» — бөлшек жоқ
      let it = bl('frac.concept').make(r);
      if (it.q.includes('тең емес')) expect(it.choices[it.answer]).toBe('Жоқ');
      else {
        const [d, kk] = it.q.match(/\d+/g)!.map(Number), rest = it.q.includes('қалды');
        expect(it.choices[it.answer]).toBe(rest ? `${d - kk}/${d}` : `${kk}/${d}`);
      }
      // frac.magnitude: ең жақын тірек 0, 1/2, 1 немесе қай бөлшек 1/2-ден үлкен
      it = bl('frac.magnitude').make(r);
      if (it.q.startsWith('Қайсысы')) {
        it.choices.forEach((c: string, i: number) => expect(fr(c).lt(half) ? 1 : 0, it.q + it.choices).toBe(i === it.answer ? 0 : 1));
      } else {
        const v = fr(it.q.match(/^\d+\/\d+/)![0]).valueOf(), d = [v, Math.abs(v - 0.5), 1 - v];
        expect(d[it.answer]).toBeCloseTo(Math.min(...d), 9);
        expect(d.filter(x => Math.abs(x - Math.min(...d)) < 1e-9).length).toBe(1);
        expect(it.choices).toEqual(['0', '1/2', '1']);
      }
      // frac.basic_property: тең бөлшек, ал қосу — қате
      it = bl('frac.basic_property').make(r);
      const [a, b] = it.q.match(/\d+/g)!.map(Number), c = it.choices[it.answer];
      if (it.q.includes('?/')) {
        const D = +it.q.match(/\?\/(\d+)/)![1]; expect(new Q(a, b).eq(new Q(+c, D))).toBe(true);
        it.choices.forEach((x: string, i: number) => expect(new Q(a, b).eq(new Q(+x, D)), it.q).toBe(i === it.answer));
      } else {
        it.choices.forEach((x: string, i: number) => expect(fr(x).eq(new Q(a, b)), it.q + x).toBe(i === it.answer));
      }
      // frac.reduce: қысқартылмайтын түр; немесе тек бір бөлшек қысқартылмайды
      it = bl('frac.reduce').make(r);
      if (it.q.includes('қысқартылмайтын?')) {
        it.choices.forEach((x: string, i: number) => { const [n, d] = x.split('/').map(Number); expect(g(n, d) === 1, it.q + x).toBe(i === it.answer); });
      } else {
        const [n, d] = it.q.match(/\d+/g)!.map(Number), gg = g(n, d);
        expect(it.choices[it.answer]).toBe(`${n / gg}/${d / gg}`);
        it.choices.forEach((x: string, i: number) => { if (i !== it.answer) expect(x).not.toBe(`${n / gg}/${d / gg}`); });
      }
      // frac.common_denominator: ЕКОЕ; жаңа алым
      it = bl('frac.common_denominator').make(r);
      const [n1, d1, n2, d2] = it.q.match(/\d+/g)!.map(Number), L = lcm(d1, d2);
      if (it.q.includes('алымы')) expect(it.choices[it.answer]).toBe(String(n1 * (L / d1)));
      else expect(it.choices[it.answer]).toBe(String(L));
      expect(n2).toBeGreaterThan(0);
    }
  });
  it('мини-игры недели 5 считают правильно', () => {
    const r = rng(23), bl = (id: string) => WEEK5[id].find((s: any) => s.type === 'blitz')!;
    const g = (a: number, b: number): number => (b ? g(b, a % b) : a);
    const red = ([n, d]: number[]) => { const k = g(n, d); return [n / k, d / k]; };
    // значение варианта («3/4», «1 3/4», «5») как несократимая дробь
    const val = (t: string) => {
      let m;
      if ((m = /^(\d+) (\d+)\/(\d+)$/.exec(t))) return red([+m[1] * +m[3] + +m[2], +m[3]]);
      if ((m = /^(\d+)\/(\d+)$/.exec(t))) return red([+m[1], +m[2]]);
      if (/^\d+$/.test(t)) return [+t, 1];
      throw new Error('не число: ' + t);
    };
    const same = (a: number[], b: number[]) => a[0] === b[0] && a[1] === b[1];
    const fr = (q: string) => [...q.matchAll(/(\d+)\/(\d+)/g)].map(m => [+m[1], +m[2]]);
    const tz = (nums: number[]) => { let p = 1n; for (const x of nums) p *= BigInt(x); let c = 0; while (p % 10n === 0n) { p /= 10n; c++; } return c; };
    const v5 = (k: number) => { let c = 0; while (k % 5 === 0) { k /= 5; c++; } return c; };
    for (let k = 0; k < 300; k++) {
      // frac.compare: кто больше (или «Тең»), из трёх — наибольший
      let it = bl('frac.compare').make(r); let F = fr(it.q);
      if (it.q.includes('ең үлкен')) {
        const vs = F.map(([a, b]) => a / b), best = vs.indexOf(Math.max(...vs));
        expect(it.choices.map((c: string) => c.trim())).toEqual(F.map(([a, b]) => `${a}/${b}`));
        expect(vs.filter(x => Math.abs(x - vs[best]) < 1e-9)).toHaveLength(1);
        expect(it.answer, it.q).toBe(best);
      } else {
        const [[a, b], [c, d]] = F, cmp = Math.sign(a * d - c * b);
        expect(it.choices.slice(0, 2), it.q).toEqual([`${a}/${b}`, `${c}/${d}`]);
        expect(it.choices[2]).toBe('Тең');
        expect(it.choices[it.answer], it.q).toBe(cmp > 0 ? `${a}/${b}` : cmp < 0 ? `${c}/${d}` : 'Тең');
      }
      // frac.add_sub: ровно один вариант равен верному значению
      it = bl('frac.add_sub').make(r); F = fr(it.q);
      let want: number[];
      if (it.q.includes('жетіспейді')) { const [a, b] = F[0]; want = red([b - a, b]); }
      else {
        const [[a, b], [c, d]] = F, L = (b / g(b, d)) * d, sgn = it.q.includes('−') ? -1 : 1;
        want = red([a * (L / b) + sgn * c * (L / d), L]);
        if (sgn < 0) expect(a * d).toBeGreaterThan(c * b);
      }
      expect(it.choices.filter((c: string) => same(val(c), want)), it.q + it.choices).toHaveLength(1);
      expect(same(val(it.choices[it.answer]), want), it.q).toBe(true);
      // frac.mixed: перевод в обе стороны и порции
      it = bl('frac.mixed').make(r);
      const nn = it.q.match(/\d+/g)!.map(Number);
      let mw: number[];
      if (it.q.includes('бұрыс бөлшекке')) { const [w, n, d] = nn; mw = [w * d + n, d]; }
      else if (it.q.includes('аралас санға')) { const [p, d] = nn; mw = red([p, d]); }
      else { const [w, n, d] = nn; mw = [w * d + n, 1]; }
      expect(it.choices.filter((c: string) => same(val(c), red(mw))), it.q + it.choices).toHaveLength(1);
      expect(same(val(it.choices[it.answer]), red(mw)), it.q).toBe(true);
      if (it.q.includes('аралас санға')) { const m = /^(\d+) (\d+)\/(\d+)$/.exec(it.choices[it.answer])!; expect(+m[2]).toBeLessThan(+m[3]); }
      // logic.weighing: гири
      it = bl('logic.weighing').make(r);
      const ans = it.choices[it.answer], q = it.q, num = q.match(/\d+/g)!.map(Number), N = num[num.length - 1];
      if (q.includes('екі табаққа')) {
        const side = (t: string) => t.split(/[+—]/).map(x => +x).filter(Boolean);
        const sums = (c: string) => { const m = /^оң: (.*); сол: (.*)$/.exec(c)!; return side(m[1]).reduce((s: number, x: number) => s + x, 0) - side(m[2]).reduce((s: number, x: number) => s + x, 0); };
        it.choices.forEach((c: string, i: number) => expect(sums(c) === N, q + c).toBe(i === it.answer));
        expect(ans).toMatch(/сол: \d/);
      } else if (q.includes('неше гір')) {
        expect(ans).toBe(String(N.toString(2).replace(/0/g, '').length));
      } else if (q.includes('тағы неше грамм')) {
        const [n0, g0] = num; expect(ans).toBe(String(n0 - g0));
      } else {
        const sum = (c: string) => c.split(' + ').reduce((s, x) => s + +x, 0);
        it.choices.forEach((c: string, i: number) => expect(sum(c) === N, q + c).toBe(i === it.answer));
      }
      // div.trailing_zeros
      it = bl('div.trailing_zeros').make(r); const zn = it.q.match(/\d+/g)!.map(Number);
      if (it.q.startsWith('1-ден')) {
        const n = zn[1]; expect(n).not.toBe(50);
        const nums = Array.from({ length: n }, (_, i) => i + 1);
        expect(ans_(it), it.q).toBe(String(tz(nums)));
      } else if (it.q.includes('жіктегенде')) expect(ans_(it)).toBe(String(v5(zn[0])));
      else expect(ans_(it), it.q).toBe(String(tz(zn)));
    }
    function ans_(it: any) { return it.choices[it.answer]; }
  });
  it('уроки: сцены и виджеты зарегистрированы, запрещённых слов нет', () => {
    const scenes = readFileSync('src/lesson/Scene.svelte', 'utf8'), lesson = readFileSync('src/screens/Lesson.svelte', 'utf8');
    const avoid: string[] = (GLOSSARY as any).terms.flatMap((t: any) => t.avoid ?? []).filter((w: string) => w.length > 3);
    for (const [id, steps] of Object.entries({ ...WEEK4, ...WEEK5 })) {
      const txt: string[] = [];
      for (const s of steps) {
        if (s.scene) expect(scenes, `${id}: сцена ${s.scene}`).toMatch(new RegExp(`\\b${s.scene}\\b`));
        for (const f of s.frames ?? []) if (f.scene) expect(scenes, `${id}: сцена ${f.scene}`).toMatch(new RegExp(`\\b${f.scene}\\b`));
        if (s.w) expect(lesson, `${id}: виджет ${s.w}`).toMatch(new RegExp(`WIDGETS[^\\n]*\\b${s.w}\\b`));
        txt.push(s.kz ?? '', s.task ?? '', s.reveal ?? '', s.why ?? '', s.fix ?? '', ...(s.lines ?? []), ...(s.choices ?? []), ...(s.frames ?? []).map((f: any) => f.kz ?? ''));
        if (s.type === 'goal') expect(s.kz.split(/\s+/).length, `${id}: цель длиннее 30 слов`).toBeLessThanOrEqual(30);
      }
      const all = txt.join(' ').toLowerCase();
      for (const w of avoid) expect(all, `${id}: «${w}»`).not.toContain(w.toLowerCase());
    }
  });
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
