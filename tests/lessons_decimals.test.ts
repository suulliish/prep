import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
// @ts-ignore
import { DECIMALS } from '../content/lessons_decimals.mjs';
// @ts-ignore
import { LESSONS } from '../content/lessons.mjs';
// @ts-ignore
import { rng } from '../content/templates/lib.mjs';
// @ts-ignore
import GLOSSARY from '../content/glossary.json';
import { commaValue } from '../src/widgets/DecPlace.svelte';
import { column } from '../src/widgets/DecColumn.svelte';
import { decStr } from '../src/widgets/NumberLine.svelte';
// @ts-ignore
import { speakable, numeralLeak } from '../scripts/voice/lesson-lines.mjs';

// C3 (02.10): 5 уроков десятичных. Сценарий, мини-игры (ответ пересчитан независимо), виджеты, голос.
const D = DECIMALS as Record<string, any[]>;
const IDS = ['dec.concept', 'dec.compare_round', 'dec.add_sub', 'dec.mul_div', 'dec.frac_convert'];
// точная десятичная арифметика: «0,45» → [45, 2]
type N = { m: number; p: number };
const P = (s: string): N => { const [i, f = ''] = s.split(','); return { m: Number(i + f), p: f.length }; };
const at = (x: N, p: number) => x.m * 10 ** (p - x.p);
const cmp = (a: N, b: N) => { const p = Math.max(a.p, b.p); return Math.sign(at(a, p) - at(b, p)); };
const eqN = (a: N, b: N) => cmp(a, b) === 0;
const add = (a: N, b: N): N => { const p = Math.max(a.p, b.p); return { m: at(a, p) + at(b, p), p }; };
const sub = (a: N, b: N): N => { const p = Math.max(a.p, b.p); return { m: at(a, p) - at(b, p), p }; };
const mul = (a: N, b: N): N => ({ m: a.m * b.m, p: a.p + b.p });
const frac = (s: string) => s.split('/').map(Number) as [number, number];

describe('уроки десятичных: полный сценарий', () => {
  it('все 5 тем есть в LESSONS', () => { for (const id of IDS) expect(LESSONS[id], id).toBeTruthy(); });
  for (const id of IDS) it(`${id}: цель → … → возврат к цели`, () => {
    const t = D[id].map(s => s.type);
    expect(t[0]).toBe('goal'); expect(t.at(-1)).toBe('final');
    for (const need of ['widget', 'predict', 'example', 'faded', 'why', 'bug', 'blitz', 'rule']) expect(t, need).toContain(need);
    expect(t.filter(x => x === 'faded').length).toBeGreaterThanOrEqual(2);
    const goal = D[id][0], fin = D[id].at(-1);
    expect(goal.kz.split(/\s+/).length, 'цель длиннее 30 слов').toBeLessThanOrEqual(30);
    expect(fin.s?.math ?? fin.kz, 'финал возвращает к цели').toBeTruthy();
  });
  it('сцены и виджеты зарегистрированы, запрещённых слов нет', () => {
    const scenes = readFileSync('src/lesson/Scene.svelte', 'utf8'), lesson = readFileSync('src/screens/Lesson.svelte', 'utf8');
    const avoid: string[] = (GLOSSARY as any).terms.flatMap((t: any) => t.avoid ?? []).filter((w: string) => w.length > 3);
    for (const id of IDS) {
      const txt: string[] = [];
      for (const s of D[id]) {
        if (s.scene) expect(scenes, `${id}: сцена ${s.scene}`).toMatch(new RegExp(`\\b${s.scene}\\b`));
        for (const f of s.frames ?? []) if (f.scene) expect(scenes, `${id}: сцена ${f.scene}`).toMatch(new RegExp(`\\b${f.scene}\\b`));
        if (s.w) expect(lesson, `${id}: виджет ${s.w}`).toMatch(new RegExp(`WIDGETS[^\\n]*\\b${s.w}\\b`));
        txt.push(s.kz ?? '', s.task ?? '', s.reveal ?? '', s.why ?? '', s.fix ?? '', ...(s.lines ?? []), ...(s.choices ?? []), ...(s.frames ?? []).map((f: any) => f.kz ?? ''));
      }
      const all = txt.join(' ').toLowerCase();
      for (const w of avoid) expect(all, `${id}: «${w}»`).not.toContain(w.toLowerCase());
    }
  });
});

describe('уроки десятичных: ответы верны', () => {
  it('финалы и пошаговые: верный вариант пересчитан', () => {
    const fin = (id: string) => { const s = LESSONS[id].at(-1); return s.choices[s.answer]; };
    expect(fin('dec.concept')).toBe('0,04');
    expect(fin('dec.compare_round')).toBe('0,5 > 0,45');
    expect(eqN(P(fin('dec.add_sub')), add(P('3,7'), P('1,25')))).toBe(true);
    expect(eqN(P(fin('dec.mul_div')), mul(P('0,3'), P('0,2')))).toBe(true);
    expect(fin('dec.frac_convert')).toBe('0,75');
    // итог каждого пошагового разбора — последняя строка «Жауабы: …»
    const last = (id: string, k: number) => LESSONS[id].filter((s: any) => s.type === 'faded')[k].steps.at(-1).math.replace('Жауабы: ', '');
    expect(last('dec.concept', 0)).toBe('0,3');
    expect(last('dec.concept', 1)).toBe('5,006');
    expect(last('dec.compare_round', 0)).toBe('0,4 > 0,38');
    expect(last('dec.compare_round', 1)).toBe('12,836 ≈ 12,84');
    expect(eqN(P(last('dec.add_sub', 0)), add(P('5,8'), P('3,47')))).toBe(true);
    expect(eqN(P(last('dec.add_sub', 1)), sub(P('10'), P('3,26')))).toBe(true);
    expect(eqN(P(last('dec.mul_div', 0)), mul(P('0,7'), P('0,8')))).toBe(true);
    expect(eqN(mul(P(last('dec.mul_div', 1)), P('8')), P('7,2'))).toBe(true);
    expect(last('dec.frac_convert', 0)).toBe('0,25');
    expect(last('dec.frac_convert', 1)).toBe('4/5');
  });

  const blitz = (id: string) => D[id].find((s: any) => s.type === 'blitz');
  const rounds = (id: string, n = 400) => { const r = rng(11), b = blitz(id); return Array.from({ length: n }, () => b.make(r)); };
  const valid = (it: any) => {
    expect(new Set(it.choices).size, it.q).toBe(it.choices.length);
    expect(it.choices.length).toBeGreaterThanOrEqual(2);
    expect(it.choices.join()).not.toMatch(/NaN|undefined|-\d|\./);
  };
  it('мини-игра dec.concept: разряд и дробь со знаменателем 10ⁿ', () => {
    for (const it of rounds('dec.concept')) {
      valid(it);
      const a = it.choices[it.answer];
      const m = /^(\d+),(\d+) санында (\S+) үлестер/.exec(it.q);
      if (m) { const k = ['ондық', 'жүздік', 'мыңдық'].indexOf(m[3]); expect(a, it.q).toBe(m[2][k]); continue; }
      const [n, d] = frac(it.q.split(' = ')[0]);
      expect(it.choices.filter((c: string) => eqN(P(c), { m: n, p: String(d).length - 1 })), it.q).toEqual([a]);
    }
  });
  it('мини-игра dec.compare_round: больший из двух, округление', () => {
    for (const it of rounds('dec.compare_round')) {
      valid(it);
      const a = it.choices[it.answer];
      if (it.q === 'Үлкен санды таңда.') { const [x, y] = it.choices.map(P); expect(cmp(x, y), it.choices.join(' ')).not.toBe(0); expect(P(a)).toEqual(cmp(x, y) > 0 ? x : y); continue; }
      const x = P(/^(\S+) санын/.exec(it.q)![1]), k = /ондық/.test(it.q) ? 1 : 2, u = 10 ** (x.p - k);
      const want = { m: Math.floor(x.m / u) + ((x.m % u) * 2 >= u ? 1 : 0), p: k };
      expect(eqN(P(a), want), it.q).toBe(true);
      expect(it.choices.filter((c: string) => eqN(P(c), want))).toEqual([a]);
    }
  });
  it('мини-игра dec.add_sub: сумма и разность', () => {
    for (const it of rounds('dec.add_sub')) {
      valid(it);
      const [l] = it.q.split(' = ?'), plus = l.includes(' + '), [x, y] = l.split(plus ? ' + ' : ' − ').map(P);
      const want = plus ? add(x, y) : sub(x, y);
      expect(it.choices.filter((c: string) => eqN(P(c), want)), it.q).toEqual([it.choices[it.answer]]);
    }
  });
  it('мини-игра dec.mul_div: × ÷ 10ⁿ и произведение десятичных', () => {
    for (const it of rounds('dec.mul_div')) {
      valid(it);
      const [l] = it.q.split(' = ?');
      let want: N;
      if (l.includes(' : ')) { const [x, t] = l.split(' : '); const k = t.length - 1, v = P(x); want = { m: v.m, p: v.p + k }; }
      else { const [x, y] = l.split(' · ').map(P); want = mul(x, y); }
      expect(it.choices.filter((c: string) => eqN(P(c), want)), it.q).toEqual([it.choices[it.answer]]);
    }
  });
  it('мини-игра dec.frac_convert: обыкновенная ↔ десятичная, ответ несократим', () => {
    const g = (a: number, b: number): number => (b ? g(b, a % b) : a);
    for (const it of rounds('dec.frac_convert')) {
      valid(it);
      const a = it.choices[it.answer];
      if (/^\d+\/\d+ = \?$/.test(it.q)) {
        const [n, d] = frac(it.q.split(' = ')[0]);
        expect(it.choices.filter((c: string) => { const v = P(c); return v.m * d === n * 10 ** v.p; }), it.q).toEqual([a]);
      } else {
        const v = P(it.q.split(' = ')[0]), [n, d] = frac(a);
        expect(g(n, d), it.q).toBe(1);
        expect(it.choices.filter((c: string) => { const [p, q] = frac(c); return p * 10 ** v.p === v.m * q; }), it.q).toEqual([a]);
      }
    }
  });
});

describe('виджеты десятичных', () => {
  it('DecPlace «Үтірді жылжыт»: верное место запятой даёт результат примера', () => {
    const w = LESSONS['dec.mul_div'].find((s: any) => s.w === 'DecPlace');
    for (const R of w.props.rounds) {
      expect(commaValue(R.digits, R.from), `исходное число ${R.said}`).toBe(R.said.split(' ')[0]);
      const [x, op, t] = R.said.split(' '), k = t.length - 1, v = P(x);
      const want: N = op === '·' ? { m: v.m, p: v.p - k } : { m: v.m, p: v.p + k };
      const norm = want.p < 0 ? { m: want.m * 10 ** -want.p, p: 0 } : want;
      expect(eqN(P(commaValue(R.digits, R.to)), norm), R.said).toBe(true);
    }
  });
  it('DecPlace «fill»: подпись совпадает с цифрами', () => {
    const w = LESSONS['dec.concept'].find((s: any) => s.w === 'DecPlace').props;
    expect(`${w.whole},${w.frac}`).toBe('2,05');
  });
  it('DecColumn: числа выровнены по запятой, результат верный', () => {
    const c = column('3,7', '1,25', '+');
    expect(c.a.f).toBe('70'); expect(c.a.pad).toBe(1); expect(c.b.pad).toBe(0);
    expect(`${c.res.w.trim()},${c.res.f}`).toBe('4,95');
    const d = column('10', '3,26', '−');
    expect(`${d.res.w.trim()},${d.res.f}`).toBe('6,74');
    const w = LESSONS['dec.add_sub'].find((s: any) => s.w === 'DecColumn').props;
    const e = column(w.a, w.b, w.op);
    expect(eqN(P(`${e.res.w.trim()},${e.res.f}`), add(P(w.a), P(w.b)))).toBe(true);
  });
  it('NumberLine: десятичные подписи', () => {
    expect(decStr(0.45)).toBe('0,45'); expect(decStr(1)).toBe('1'); expect(decStr(0.1 + 0.2)).toBe('0,3');
  });
});

describe('голос десятичных', () => {
  it('десятичная читается словами, с окончанием', () => {
    expect(speakable('0,45')).toBe('нөл бүтін жүзден қырық бес');
    expect(speakable('2,005')).toBe('екі бүтін мыңнан бес');
    expect(speakable('0,3-тен кіші')).toBe('нөл бүтін оннан үштен кіші');
    expect(speakable('1, 2, 3')).toBe('бір, екі, үш');      // перечисление с пробелом — не десятичная
  });
  it('numeralLeak находит десятичный ответ цифрами и словами, не путает с бо́льшим числом', () => {
    expect(numeralLeak('7/100 = 0,07.', '0,07')).toBe('0,07');
    expect(numeralLeak('нөл бүтін жүзден жеті', '0,07')).toBe('нөл бүтін жүзден жеті');
    expect(numeralLeak('10,07 и 0,071', '0,07')).toBeNull();
  });
});
