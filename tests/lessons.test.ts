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
// @ts-ignore
import { WEEK6 as W6 } from '../content/lessons_week6.mjs';
// @ts-ignore
import { WEEK7 as W7 } from '../content/lessons_week7.mjs';
const WEEK1 = W1 as Record<string, any[]>, WEEK2 = W2 as Record<string, any[]>, WEEK3 = W3 as Record<string, any[]>, WEEK4 = W4 as Record<string, any[]>, WEEK5 = W5 as Record<string, any[]>, WEEK6 = W6 as Record<string, any[]>, WEEK7 = W7 as Record<string, any[]>;
const FULL = { ...WEEK1, ...WEEK2, ...WEEK3, ...WEEK4, ...WEEK5, ...WEEK6, ...WEEK7 };
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

describe('недели 1–7 — полный сценарий', () => {
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
  it('мини-игры недели 6 считают правильно', () => {
    const r = rng(31), bl = (id: string) => WEEK6[id].find((s: any) => s.type === 'blitz')!;
    const g = (a: number, b: number): number => (b ? g(b, a % b) : a);
    // значение варианта («3/4» или «5») как число-дробь [n, d]; сравнение по перекрёстному умножению
    const val = (t: string) => { const m = /^(\d+)(?:\/(\d+))?$/.exec(t); if (!m) throw new Error('не число: ' + t); return [+m[1], +(m[2] ?? 1)]; };
    const same = (a: number[], b: number[]) => a[0] * b[1] === b[0] * a[1];
    const fr = (q: string) => [...q.matchAll(/(\d+)\/(\d+)/g)].map(m => [+m[1], +m[2]]);
    const digitsOf = (P: number) => { let d = 0; for (let i = 1; i <= P; i++) d += String(i).length; return d; };
    const onlyRight = (it: any, want: number[]) => {
      expect(it.choices.filter((c: string) => same(val(c), want)), it.q + it.choices).toHaveLength(1);
      expect(same(val(it.choices[it.answer]), want), it.q).toBe(true);
    };
    for (let k = 0; k < 300; k++) {
      // frac.mul: произведение, площадь пересечения, «больше или меньше множителя»
      let it = bl('frac.mul').make(r);
      if (it.q.startsWith('Квадратты')) {
        const [d1, d2, n1, n2] = it.q.match(/\d+/g)!.map(Number);
        expect(n1).toBeLessThan(d1); expect(n2).toBeLessThan(d2);
        expect(it.choices[it.answer], it.q).toBe(String(n1 * n2));
      } else if (it.q.includes('көбейтіндісі')) {
        const [f, gg] = it.q.split(' көбейтіндісі')[0].split(' · ').map((t: string) => val(t)), fv = f[0] / f[1];
        expect(it.choices).toEqual(['Кіші', 'Үлкен', 'Тең']);
        expect(it.choices[it.answer], it.q).toBe(fv < 1 ? 'Кіші' : fv > 1 ? 'Үлкен' : 'Тең');
        expect(gg[0]).toBeGreaterThan(0);
      } else {
        const [[a, b], [c, d]] = fr(it.q);
        onlyRight(it, [a * c, b * d]);
        expect(it.choices[it.answer]).toBe(`${a * c / g(a * c, b * d)}/${b * d / g(a * c, b * d)}`);   // ответ сокращён
      }
      // frac.div: деление на дробь, «сколько поместится», кері сан
      it = bl('frac.div').make(r);
      if (it.q.includes('кері саны')) {
        const [[n, d]] = fr(it.q);
        onlyRight(it, [d, n]);
      } else if (it.q.includes('батарея')) {
        const [w] = it.q.match(/\d+/g)!.map(Number), [[n, d]] = fr(it.q);
        expect(it.choices[it.answer], it.q).toBe(String((w * d) / n)); expect((w * d) % n).toBe(0);
      } else if (/^\d+ : 1\//.test(it.q)) {
        const [a, , kk] = it.q.match(/\d+/g)!.map(Number);
        onlyRight(it, [a * kk, 1]);
      } else {
        const [[a, b], [c, d]] = fr(it.q);
        onlyRight(it, [a * d, b * c]);
      }
      // frac.part_of_number: N : d · n (или остаток)
      it = bl('frac.part_of_number').make(r);
      const [N, pn, pd] = it.q.match(/\d+/g)!.map(Number);
      expect(N % pd).toBe(0);
      expect(it.choices[it.answer], it.q).toBe(String((N / pd) * (it.q.includes('қалды') ? pd - pn : pn)));
      // frac.find_whole: бүтін = бөлік : алым · бөлім
      it = bl('frac.find_whole').make(r);
      const q = it.q, nn = q.match(/\d+/g)!.map(Number);
      let whole: number;
      if (q.startsWith('Жолдың')) { const [a, d, p] = nn; expect(p % (d - a)).toBe(0); whole = (p / (d - a)) * d; }
      else if (q.startsWith('Санның')) { const [n, d, p] = nn; expect(p % n).toBe(0); whole = (p / n) * d; }
      else { const [p, n, d] = nn; expect(p % n).toBe(0); whole = (p / n) * d; }
      expect(it.choices[it.answer], q).toBe(String(whole));
      // logic.page_digits
      it = bl('logic.page_digits').make(r);
      const pg = it.q.match(/\d+/g)!.map(Number);
      if (it.q.includes('нөмірлеуге неше цифр')) expect(it.choices[it.answer], it.q).toBe(String(digitsOf(pg[0])));
      else if (it.q.includes('цифр кетті')) { const D = pg[1]; const P = +it.choices[it.answer]; expect(digitsOf(P), it.q).toBe(D); }
      else expect(it.choices[it.answer], it.q).toBe(String(pg[1] - pg[0] + 1));
    }
  });
  it('мини-игры недели 7 считают правильно (независимая проверка)', () => {
    const r = rng(77), bl = (id: string) => WEEK7[id].find((s: any) => s.type === 'blitz')!;
    const fact = (n: number): number => (n <= 1 ? 1 : n * fact(n - 1));
    const DAYS = ['дүйсенбі', 'сейсенбі', 'сәрсенбі', 'бейсенбі', 'жұма', 'сенбі', 'жексенбі'];
    const dayIn = (q: string) => DAYS.findIndex(d => new RegExp(`(^|[^а-яәіңғүұқөһ])${d}([^а-яәіңғүұқөһ]|$)`).test(q.toLowerCase()));   // «сенбі» есть внутри «жексенбі»
    const mod = (a: number) => ((a % 7) + 7) % 7;
    const LEN: Record<string, number> = { 'Қаңтардың': 31, 'Наурыздың': 31, 'Сәуірдің': 30, 'Мамырдың': 31, 'Маусымның': 30, 'Шілденің': 31, 'Тамыздың': 31, 'Қыркүйектің': 30, 'Қазанның': 31, 'Қарашаның': 30, 'Желтоқсанның': 31 };
    const isAP = (a: number[]) => a.length >= 2 && a.every((x, i) => !i || x - a[i - 1] === a[1] - a[0]);
    // все заготовки закономерностей: любая применимая обязана давать ровно верный ответ, и применима хотя бы одна
    const preds = (t: number[]) => {
      const out: number[] = [], L = t.length, d = t.slice(1).map((x, i) => x - t[i]);
      if (isAP(t)) out.push(t[L - 1] + d[0]);
      if (L >= 5 && !isAP(t) && isAP(d)) out.push(t[L - 1] + d[d.length - 1] + d[1] - d[0]);
      if (L >= 6) { const ev = t.filter((_, i) => i % 2 === 0), od = t.filter((_, i) => i % 2); if (isAP(ev) && isAP(od)) { const nx = L % 2 ? od : ev; out.push(nx[nx.length - 1] + nx[1] - nx[0]); } }
      if (t[0] > 0 && t[1] % t[0] === 0 && t[1] / t[0] >= 2 && t.every((x, i) => !i || x === t[i - 1] * (t[1] / t[0]))) out.push(t[L - 1] * (t[1] / t[0]));
      return out;
    };
    const kinds = new Set<string>();
    for (let k = 0; k < 400; k++) {
      // logic.permutations
      let it = bl('logic.permutations').make(r), nn = it.q.match(/\d+/g)!.map(Number), got = it.choices[it.answer];
      if (it.q.includes('бір қатарға неше түрлі')) { kinds.add('line'); expect(got, it.q).toBe(String(fact(nn[0]))); }
      else if (it.q.includes('спортшыдан')) { kinds.add('top'); const kk = it.q.includes('екі орынға') ? 2 : 3; let v = 1; for (let i = 0; i < kk; i++) v *= nn[0] - i; expect(got, it.q).toBe(String(v)); }
      else if (it.q.includes('цифрларынан')) { kinds.add('code'); const kk = it.q.includes('екі таңбалы') ? 2 : 3; const digs = nn.length; let v = 1; for (let i = 0; i < kk; i++) v *= digs - i; expect(nn).toEqual(Array.from({ length: digs }, (_, i) => i + 1)); expect(got, it.q).toBe(String(v)); }
      else { kinds.add('first'); expect(it.q).toContain('Арман'); expect(got, it.q).toBe(String(fact(nn[0] - 1))); }
      // logic.pairs_tournament
      it = bl('logic.pairs_tournament').make(r); nn = it.q.match(/\d+/g)!.map(Number); got = it.choices[it.answer];
      if (it.q.includes('Неше команда')) { kinds.add('rev'); expect((+got * (+got - 1)) / 2, it.q).toBe(nn[0]); }
      else if (it.q.includes('үйде және қонақта')) { kinds.add('home'); expect(got, it.q).toBe(String(nn[0] * (nn[0] - 1))); }
      else { kinds.add('games'); expect(got, it.q).toBe(String((nn[0] * (nn[0] - 1)) / 2)); }
      // pat.sequences: подходящая закономерность единственная и даёт верный ответ, вариантов нет среди ответов «по другой закономерности»
      it = bl('pat.sequences').make(r); nn = it.q.split('...')[0].match(/\d+/g)!.map(Number);
      const pr = preds(nn); expect(pr.length, it.q).toBeGreaterThan(0); expect(new Set(pr).size, it.q).toBe(1); expect(got_(it), it.q).toBe(String(pr[0]));
      // logic.calendar
      it = bl('logic.calendar').make(r); nn = it.q.match(/\d+/g)!.map(Number); const d0 = dayIn(it.q); expect(d0, it.q).toBeGreaterThanOrEqual(0);
      let want: number;
      if (it.q.includes('күннен кейін')) want = mod(d0 + nn[0]);
      else if (it.q.includes('күн бұрын')) want = mod(d0 - nn[0]);
      else if (it.q.startsWith('Айдың')) want = mod(d0 + nn[1] - nn[0]);
      else { const len = LEN[it.q.split(' ')[0]]; expect(len, it.q).toBeTruthy(); want = mod(d0 + len - nn[0] + nn[1]); }
      expect(got_(it).toLowerCase(), it.q).toBe(DAYS[want]);
      // vis.count_squares
      it = bl('vis.count_squares').make(r); nn = it.q.match(/\d+/g)!.map(Number);
      const cnt = (w: number, h: number) => { let s = 0; for (let a = 1; a <= Math.min(w, h); a++) s += (w - a + 1) * (h - a + 1); return s; };
      if (it.q.includes('қабырғасы')) expect(got_(it), it.q).toBe(String((nn[0] - nn[2] + 1) ** 2));
      else expect(got_(it), it.q).toBe(String(cnt(nn[0], nn[1])));
    }
    for (const kd of ['line', 'top', 'code', 'first', 'rev', 'home', 'games']) expect(kinds.has(kd), kd).toBe(true);
    function got_(x: any) { return x.choices[x.answer]; }
  });
  it('неделя 7: голосовые реплики без латиницы и знака ×, у мини-игр по 3–4 варианта', () => {
    const r = rng(9);
    for (const [id, steps] of Object.entries(WEEK7)) {
      steps.forEach((s: any, i: number) => {
        const voiced = ['goal', 'widget', 'say'].includes(s.type) ? [s.kz] : s.type === 'example' ? s.frames.map((f: any) => f.kz) : [];
        for (const t of voiced) expect(t, `${id}_${i}`).not.toMatch(/[A-Za-z×²³]/);
      });
      expect(steps.at(-1).scene, `${id}: сцена final = сцене goal (до победы final берёт props цели)`).toBe(steps[0].scene);
      const b = steps.find((s: any) => s.type === 'blitz');
      for (let k = 0; k < 200; k++) expect(b.make(r).choices.length, id).toBeGreaterThanOrEqual(3);
    }
  });
  it('уроки: сцены и виджеты зарегистрированы, запрещённых слов нет', () => {
    const scenes = readFileSync('src/lesson/Scene.svelte', 'utf8'), lesson = readFileSync('src/screens/Lesson.svelte', 'utf8');
    const avoid: string[] = (GLOSSARY as any).terms.flatMap((t: any) => t.avoid ?? []).filter((w: string) => w.length > 3);
    for (const [id, steps] of Object.entries({ ...WEEK4, ...WEEK5, ...WEEK6, ...WEEK7 })) {
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

describe('недели 4–7: равные дроби среди вариантов', () => {
  const WEEKS47 = { ...WEEK4, ...WEEK5, ...WEEK6, ...WEEK7 };
  const FR = /^(?:(\d+)\s+)?(\d+)\/(\d+)$/;
  const val = (t: string): number | null => { const m = FR.exec(t.trim()); return m ? (m[1] ? +m[1] : 0) + +m[2] / +m[3] : null; };
  /** Вопрос прямо просит равную/сокращённую запись — тогда несколько равных дробей в вариантах допустимы. */
  const asksEquivalent = (text: string) => /қысқарт|тең бөлшек|бөлшекке келтір|\?\/\d+|бірдей мән|тең/.test(text);
  /** Ошибки: два варианта одного вопроса равны как числа, а вопрос не про равные записи. */
  function clash(where: string, text: string, choices: string[], out: string[]) {
    if (asksEquivalent(text) || choices.includes('Тең')) return;   // «Тең» среди вариантов — равенство и есть один из ответов
    const vs = choices.map(val);
    for (let i = 0; i < vs.length; i++) for (let j = i + 1; j < vs.length; j++)
      if (vs[i] !== null && vs[j] !== null && Math.abs(vs[i]! - vs[j]!) < 1e-9) out.push(`${where}: «${choices[i]}» = «${choices[j]}» в «${text.slice(0, 60)}»`);
  }
  it('faded / why / final / predict: нет двух равных дробей среди вариантов, если не просят сократить', () => {
    const bad: string[] = [];
    for (const [id, steps] of Object.entries(WEEKS47) as [string, any[]][]) for (const s of steps) {
      if (s.type === 'faded') for (const x of s.steps) if (x.blank) clash(id + ' faded', x.math, x.blank.choices, bad);
      if (['why', 'final', 'predict', 'quiz'].includes(s.type)) clash(id + ' ' + s.type, s.kz, s.choices, bad);
    }
    expect(bad).toEqual([]);
  });
  it('blitz: за 400 раундов нет двух равных дробей среди вариантов, если не просят сократить', () => {
    const bad = new Set<string>();
    for (const [id, steps] of Object.entries(WEEKS47) as [string, any[]][]) {
      const b = steps.find(s => s.type === 'blitz'); if (!b) continue;
      const r = rng(4747);
      for (let k = 0; k < 400; k++) { const it = b.make(r), out: string[] = []; clash(id + ' blitz', it.q, it.choices, out); out.forEach(o => bad.add(o)); }
    }
    expect([...bad].slice(0, 10)).toEqual([]);
  });
  it('шаг «12/72 = ▢» просит сократить и не содержит равных вариантов', () => {
    const st = WEEK6['frac.mul'].filter((s: any) => s.type === 'faded').flatMap((s: any) => s.steps).find((x: any) => x.math.startsWith('12/72'));
    expect(st.math).toContain('қысқарт');
    expect(st.blank.choices[st.blank.answer]).toBe('1/6');
  });
});
