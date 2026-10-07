// C9: 10 генераторов (content/templates/equations6.mjs) для eq.both_sides_nat и eq.brackets_nat.
// Ответ каждого генератора пересчитан здесь независимо: уравнение берётся из текста задачи, корень ищется точным перебором 0..3000 и точным решением
// (tests/_eq_exact.ts, рациональные числа), каждый вариант подставляется в уравнение, ловушки сверены с ошибкой, о которой говорит метка.
// Код шаблонов не вызывается ни для ответа, ни для разбора условия. Проверяющие функции проверены на заведомо сломанных задачах (самопроверка).
import { describe, it, expect } from 'vitest';
import glossary from '../content/glossary.json';
// @ts-ignore — шаблоны написаны на JS
import equations6 from '../content/templates/equations6.mjs';
// @ts-ignore
import { templates, byId } from '../content/templates/index.mjs';
// @ts-ignore
import { rng } from '../content/templates/lib.mjs';
// @ts-ignore
import { skillById } from '../content/skills.mjs';
// @ts-ignore
import { MISCONCEPTIONS } from '../content/misconceptions.mjs';
// @ts-ignore
import { HINT_KEYS } from '../content/hint_keys.mjs';
import { MISTAKE_NAMES } from '../src/engine/mistakeNames';
import { exactRoots, holdsAt, solveLinear, lin, evalAt, eqQ } from './_eq_exact';

const T = equations6 as any[];
type Item = { kz: string; ru: string; choices: { text: string; tag: string }[]; answer: number; sol: { kz: string; ru: string } };
const gen = (id: string, seed = 5, n = 300): Item[] => { const t = byId[id], r = rng(seed); return Array.from({ length: n }, () => t.gen(r)); };
const texts = (it: Item) => it.choices.map(c => c.text);
const ans = (it: Item) => +it.choices[it.answer].text;
const byTag = (it: Item, tag: string) => it.choices.filter(c => c.tag === tag).map(c => +c.text);
const eqOf = (it: Item) => it.kz.split('\n')[1];
const rootEqOf = (it: Item) => /Қай сан (.+) теңдеуінің түбірі/.exec(it.kz)![1];
const nat = (v: number) => Number.isInteger(v) && v > 0;

const IDS: Record<string, string[]> = {
  'eq.both_sides_nat': ['eq.both_simple', 'eq.both_full', 'eq.both_check', 'eq.both_minus', 'eq.both_story'],
  'eq.brackets_nat': ['eq.brackets_divide', 'eq.brackets_expand', 'eq.brackets_check', 'eq.brackets_both', 'eq.brackets_story'],
};
const BOTH = ['eq.both_simple', 'eq.both_full', 'eq.both_minus'], BR = ['eq.brackets_divide', 'eq.brackets_expand', 'eq.brackets_both'];

// Арифметика в разборах (sol): каждая цепочка чисел «52 − 32 = 20» верна. Раньше ошибка в разборе (diff + 1) никем не ловилась.
const NUMR = '\\d+', CH = new RegExp(`${NUMR}(?: [·:+−] ${NUMR})*(?: = ${NUMR}(?: [·:+−] ${NUMR})*)+`, 'g');
const evalChain = (s: string) => Function(`return (${s.replace(/·/g, '*').replace(/:/g, '/').replace(/−/g, '-')})`)() as number;
const badSol = (text: string): string | null => {
  const t = text.replace(/(?<![\w])(?:\d+ · )?\d*[a-z] = (?=\d)/g, '');
  for (const m of t.matchAll(CH)) {
    const before = t.slice(0, m.index!), after = t.slice(m.index! + m[0].length);
    // цепочка должна быть целой; «:» после слова («Сосын: 18 − 3») знак препинания, а « : » с пробелом перед ним деление
    if (/(?:[A-Za-z+−·=(]|\s:)\s*$/.test(before) || /^(?:\s?[A-Za-z+−·=)]|\s:)/.test(after)) continue;
    const vals = m[0].split(' = ').map(evalChain);
    if (vals.some(v => Math.abs(v - vals[0]) > 1e-9)) return `${m[0]} (${vals.join(' ≠ ')})`;
  }
  return null;
};
describe('equations6: арифметика в разборах верна', () => {
  it('самопроверка валидатора', () => {
    expect(badSol('4x = 52 − 32 = 20. x = 20 : 4 = 5')).toBeNull();
    expect(badSol('4x = 52 − 32 = 21')).not.toBeNull();
    expect(badSol('x = 20 : 4 = 6')).not.toBeNull();
  });
  for (const t of T) it(`${t.id}: все цепочки чисел в sol.kz и sol.ru верны (400 задач)`, () => {
    for (const it of gen(t.id, 11, 400)) for (const lang of ['kz', 'ru'] as const) expect(badSol(it.sol[lang]), `${it.kz} → ${it.sol[lang]}`).toBeNull();
  });
});

describe('equations6: структура и привязка к темам', () => {
  it('ровно 10 генераторов, id уникальны во всём курсе, у каждой темы свой набор', () => {
    expect(T).toHaveLength(10);
    const all = (templates as any[]).map(t => t.id);
    expect(new Set(all).size).toBe(all.length);
    for (const [sk, ids] of Object.entries(IDS)) expect([...skillById[sk].templates].sort(), sk).toEqual([...ids].sort());
    for (const t of T) for (const sk of t.skills) expect(skillById[sk].templates, `${sk} ← ${t.id}`).toContain(t.id);
  });
  it('у каждой темы есть қиындық 1, 2 и 3 (үйренді требует две высшие ступени), по 5 генераторов', () => {
    for (const [sk, ids] of Object.entries(IDS)) {
      const d = ids.map(id => byId[id].difficulty);
      for (const k of [1, 2, 3]) expect(d, `${sk}: нет қиындық ${k}`).toContain(k);
      expect(ids).toHaveLength(5);
    }
  });
  it('граф: eq.both_sides_nat ← eq.two_step; eq.brackets_nat ← eq.two_step и eq.both_sides_nat; предпосылки сами имеют генераторы', () => {
    expect(skillById['eq.both_sides_nat'].prereqs).toEqual(['eq.two_step']);
    expect(skillById['eq.brackets_nat'].prereqs).toEqual(['eq.two_step', 'eq.both_sides_nat']);
    for (const sk of Object.keys(IDS)) { expect(skillById[sk].cat).toBe('A'); expect(skillById[sk].grade).toBe(5); for (const p of skillById[sk].prereqs) expect(skillById[p].templates.length, p).toBeGreaterThan(0); }
  });
  const avoid: string[] = (glossary as any).terms.flatMap((t: any) => t.avoid ?? []).filter((w: string) => w.length > 3);
  for (const t of T) {
    it(`${t.id}: 5 разных вариантов, верный помечен correct, есть kz и ru, нет «—», нет русских терминов`, () => {
      for (const it of gen(t.id)) {
        expect(it.choices).toHaveLength(5);
        expect(new Set(texts(it)).size).toBe(5);
        expect(it.choices[it.answer].tag).toBe('correct');
        expect(it.choices.filter(c => c.tag === 'correct')).toHaveLength(1);
        expect(it.kz.length).toBeGreaterThan(8); expect(it.ru.length).toBeGreaterThan(8);
        expect(it.sol.kz.length).toBeGreaterThan(8); expect(it.sol.ru.length).toBeGreaterThan(8);
        expect(JSON.stringify(it)).not.toMatch(/NaN|undefined|Infinity|null/);
        expect(it.kz + it.sol.kz + t.title.kz, 'длинное тире').not.toContain('—');
        const low = (it.kz + ' ' + it.sol.kz + ' ' + t.title.kz).toLowerCase();
        for (const w of avoid) expect(low, `${t.id}: «${w}»`).not.toContain(w.toLowerCase());
        for (const c of it.choices) expect(nat(+c.text), `${t.id}: «${c.text}»`).toBe(true);        // все варианты — натуральные числа
      }
    });
  }
  it('у каждого шаблона есть подсказка-вопрос и ключевая идея, русские названия меток и разбор ошибок на месте; пять новых меток встречаются', () => {
    for (const t of T) { const h = (HINT_KEYS as any)[t.id]; expect(h?.q?.kz?.length, t.id).toBeGreaterThan(10); expect(h?.idea?.ru?.length, t.id).toBeGreaterThan(10); expect(h.q.kz + h.idea.kz, t.id).not.toContain('—'); }
    const tags = new Set<string>();
    for (const t of T) for (const it of gen(t.id, 7, 300)) for (const c of it.choices) if (c.tag !== 'correct' && c.tag !== 'random') tags.add(c.tag);
    for (const tag of ['eqb_x_sign', 'eqb_const_sign', 'eqb_one_coef', 'eqbr_first_only', 'eqbr_ignored_factor', 'eq2_stopped_midway', 'eq2_sign']) expect(tags.has(tag), tag).toBe(true);
    for (const tag of tags) {
      expect((MISCONCEPTIONS as any)[tag], `разбор метки ${tag}`).toBeTruthy();
      expect((MISCONCEPTIONS as any)[tag].kz.length, tag).toBeGreaterThan(20); expect((MISCONCEPTIONS as any)[tag].ru.length, tag).toBeGreaterThan(20);
      expect((MISCONCEPTIONS as any)[tag].kz, tag).not.toContain('—');
      expect((MISTAKE_NAMES as any)[tag], `русское название ${tag}`).toBeTruthy();
    }
  });
});

// ───────────────────────── независимые проверяющие ─────────────────────────
/** Порядок ловушек в коде известен; совпавшие значения оставляют первую метку (choices5 не повторяет варианты); берутся не больше четырёх. */
function expectedTraps(it: Item, ordered: [string, number | null][], answer: number): Record<string, number[]> {
  const seen = new Set<number>([answer]), want: Record<string, number[]> = {};
  let used = 0;
  for (const [tag, v] of ordered) {
    if (used === 4) break;
    if (v !== null && nat(v) && !seen.has(v)) { seen.add(v); (want[tag] ??= []).push(v); used++; }
  }
  return want;
}
const q = (n: number, d: number): number | null => (d !== 0 && n % d === 0 ? n / d : null);
/** Уравнение a x + B = c x + D (a > c): стороны по наклону, независимо от порядка записи. */
function sidesOf(eq: string) {
  const L = lin(eq), big = L.l.s[0] > L.r.s[0] ? L.l : L.r, small = big === L.l ? L.r : L.l;
  return { a: big.s[0], B: big.i[0], c: small.s[0], D: small.i[0], v: L.v! };
}

/** Общие проверки: единственный корень, верный вариант — корень, ни один другой вариант корнем не является. Возвращает текст нарушения или null. */
function rootProblem(eq: string, it: Item): string | null {
  const v = lin(eq).v!;
  const rs = exactRoots(eq), ex = solveLinear(eq);
  if (rs.length !== 1) return `${eq}: корней ${rs.length}`;
  if (!ex || !eqQ(ex, [rs[0], 1])) return `${eq}: точное решение ${ex} ≠ перебор ${rs[0]}`;
  if (rs[0] !== ans(it)) return `${eq}: ответ ${ans(it)}, корень ${rs[0]}`;
  for (let i = 0; i < it.choices.length; i++) if (holdsAt(eq, +it.choices[i].text) !== (i === it.answer)) return `${eq}: вариант ${it.choices[i].text} (${v})`;
  return null;
}
const trapProblem = (it: Item, ordered: [string, number | null][], eq: string): string | null => {
  const want = expectedTraps(it, ordered, ans(it)), tags = new Set([...Object.keys(want), ...it.choices.map(c => c.tag).filter(t => !['correct', 'random', 'off_by_one'].includes(t))]);
  for (const tag of tags) {
    const got = byTag(it, tag).sort((x, y) => x - y), exp = (want[tag] ?? []).slice().sort((x, y) => x - y);
    if (JSON.stringify(got) !== JSON.stringify(exp)) return `${eq}: метка ${tag}: есть ${got}, ожидалось ${exp}`;
  }
  return null;
};
/** Ловушки «x с двух сторон» по уравнению a x + B = c x + D: порядок в коде: стоп, x без смены знака, число без смены знака, делил на a, делил на c. */
const bothOrdered = (eq: string): [string, number | null][] => {
  const { a, B, c, D } = sidesOf(eq), k = a - c, diff = D - B;
  return [['eq2_stopped_midway', diff], ['eqb_x_sign', q(diff, a + c)], ['eqb_const_sign', q(D + B, k)], ['eqb_one_coef', q(diff, a)], ['eqb_one_coef', q(diff, c)]];
};

describe('x с двух сторон: единственный корень, ловушки = ошибки по меткам', () => {
  for (const id of [...BOTH, 'eq.both_check']) it(id, () => {
    let k = 0;
    for (const it of gen(id, 11, 400)) {
      const eq = id === 'eq.both_check' ? rootEqOf(it) : eqOf(it);
      expect(rootProblem(eq, it), id).toBeNull();
      expect(it.sol.kz, eq).toContain('Тексеру');
      const { a, c, v } = sidesOf(eq);
      expect(a, eq).toBeGreaterThan(c);                                                // сторона с большим x есть всегда, x справа и слева
      expect(eq.split('=').every(s => s.includes(v)), `${eq}: x не с двух сторон`).toBe(true);
      expect(trapProblem(it, bothOrdered(eq), eq), id).toBeNull();
      k++;
    }
    expect(k).toBe(400);
  });
  it('виды: simple — у стороны с большим x нет числа; full — оба числа с «+»; minus — у большой стороны «−»; стороны меняются местами; обе записи «5x» и «5 · x» встречаются', () => {
    const big = (eq: string) => { const L = lin(eq); return L.l.s[0] > L.r.s[0] ? 'left' : 'right'; };
    for (const [id, check] of [['eq.both_simple', (B: number, D: number, eq: string) => { expect(B, eq).toBe(0); expect(D, eq).toBeGreaterThan(0); }],
      ['eq.both_full', (B: number, D: number, eq: string) => { expect(B, eq).toBeGreaterThan(0); expect(D, eq).toBeGreaterThan(0); expect(eq, eq).not.toContain('−'); }],
      ['eq.both_minus', (B: number, D: number, eq: string) => { expect(B, eq).toBeLessThan(0); expect(D, eq).toBeGreaterThan(0); expect(eq, eq).toContain('−'); }]] as const) {
      const sidesSeen = new Set<string>(), forms = new Set<string>();
      for (const it of gen(id, 12, 300)) {
        const eq = eqOf(it), { B, D } = sidesOf(eq); check(B, D, eq); sidesSeen.add(big(eq)); forms.add(/\d[a-z]/.test(eq) ? 'слитно' : 'со знаком');
      }
      expect([...sidesSeen].sort(), id).toEqual(['left', 'right']); expect([...forms].sort(), id).toEqual(['слитно', 'со знаком']);
    }
  });
  it('корень натуральный, ≥ 2, числа не длиннее 3 знаков, верный вариант на всех 5 позициях', () => {
    for (const id of BOTH) {
      const pos = new Set<number>();
      for (const it of gen(id, 17, 300)) { const x = ans(it); expect(x >= 2 && x <= 20, `${id}: ${x}`).toBe(true); expect(eqOf(it).match(/\d+/g)!.every(n => n.length <= 3), eqOf(it)).toBe(true); pos.add(it.answer); }
      expect(pos.size, id).toBe(5);
    }
  });
  it('главные ловушки встречаются у каждого вида: «стоп на полпути», «x без смены знака», «число без смены знака», «делил на одно число»', () => {
    for (const id of ['eq.both_full', 'eq.both_minus']) {
      const tags = new Set(gen(id, 16, 400).flatMap(it => it.choices.map(c => c.tag)));
      for (const t of ['eq2_stopped_midway', 'eqb_x_sign', 'eqb_const_sign', 'eqb_one_coef']) expect(tags.has(t), `${id}: ${t}`).toBe(true);
    }
    const tags = new Set(gen('eq.both_simple', 16, 400).flatMap(it => it.choices.map(c => c.tag)));
    for (const t of ['eq2_stopped_midway', 'eqb_x_sign', 'eqb_one_coef']) expect(tags.has(t), `simple: ${t}`).toBe(true);
  });
  it('ловушка «число без смены знака» у minus — это (d − b) : k, а не (d + b) : k: тот самый перенос −b со знаком «+»', () => {
    let seen = 0;
    for (const it of gen('eq.both_minus', 18, 400)) {
      const { a, B, c, D } = sidesOf(eqOf(it)), v = q(D + B, a - c);                   // B = −b: D + B = d − b
      if (v !== null && nat(v) && v !== ans(it)) { const got = byTag(it, 'eqb_const_sign'); if (got.length) { seen++; expect(got, eqOf(it)).toEqual([v]); } }
    }
    expect(seen).toBeGreaterThan(40);
  });
});

// ───────────────────────── скобки ─────────────────────────
const bracketOf = (eq: string) => /\d+ · \([a-z] [+−] \d+\)|\d+\([a-z] [+−] \d+\)|\([a-z] [+−] \d+\) · \d+/.exec(eq)![0];
const parseBracket = (b: string) => { const m = /(\d+) · \(([a-z]) ([+−]) (\d+)\)|^(\d+)\(([a-z]) ([+−]) (\d+)\)|\(([a-z]) ([+−]) (\d+)\) · (\d+)/.exec(b)!; return m[1] ? { a: +m[1], s: m[3], b: +m[4] } : m[5] ? { a: +m[5], s: m[7], b: +m[8] } : { a: +m[12], s: m[10], b: +m[11] }; };

describe('скобки: единственный корень, ловушки = ошибки по меткам', () => {
  it('brackets_divide: a(x ± b) = c; корень, раскрытие скобок и деление дают один ответ; ловушки: x ± b без смены, a x ± b, c ∓ b, c : a ± b', () => {
    let add = 0, sub = 0, first = 0;
    for (const it of gen('eq.brackets_divide', 21, 500)) {
      const eq = eqOf(it);
      expect(rootProblem(eq, it), eq).toBeNull();
      const { a, s, b } = parseBracket(bracketOf(eq)), side = eq.split('=').map(z => z.trim()), cs = side.find(z => /^\d+$/.test(z))!, c = +cs;
      const inner = c / a, sign = s === '+' ? 1 : -1;
      expect(Number.isInteger(inner), eq).toBe(true);
      expect(ans(it), eq).toBe(inner - sign * b);                                       // деление: x ± b = c : a
      expect(ans(it), eq).toBe((c - sign * a * b) / a);                                 // раскрытие: a x ± a b = c
      expect(trapProblem(it, [['eq2_stopped_midway', inner], ['eqbr_first_only', q(c - sign * b, a)], ['eqbr_ignored_factor', c - sign * b], ['eq2_sign', inner + sign * b]], eq), eq).toBeNull();
      s === '+' ? add++ : sub++;
      if (byTag(it, 'eqbr_first_only').length) first++;
    }
    expect(add).toBeGreaterThan(200); expect(sub).toBeGreaterThan(100); expect(first).toBeGreaterThan(60);
  });
  it('brackets_expand: a(x + b) ± e = c и (x ± b) : a = c; ловушки: x + b, a x + b, M − b, неверный знак при e', () => {
    let pe = 0, me = 0, da = 0, ds = 0;
    for (const it of gen('eq.brackets_expand', 22, 800)) {
      const eq = eqOf(it);
      expect(rootProblem(eq, it), eq).toBeNull();
      if (eq.includes(' : ')) {
        const m = /\(([a-z]) ([+−]) (\d+)\) : (\d+)/.exec(eq)!, b = +m[3], a = +m[4], plus = m[2] === '+', c = +eq.split('=').map(z => z.trim()).find(z => /^\d+$/.test(z))!;
        expect(ans(it), eq).toBe(plus ? a * c - b : a * c + b);
        expect(trapProblem(it, [['eq2_stopped_midway', a * c], ['eqbr_first_only', plus ? a * (c - b) : a * (c + b)], ['eqbr_ignored_factor', plus ? c - b : c + b], ['eq2_sign', plus ? a * c + b : a * c - b]], eq), eq).toBeNull();
        plus ? da++ : ds++;
        continue;
      }
      const br = parseBracket(bracketOf(eq)), rest = eq.replace(bracketOf(eq), '#'), sides = rest.split('=').map(z => z.trim());
      const cSide = sides.find(z => /^\d+$/.test(z))!, c = +cSide, other = sides.find(z => z !== cSide)!;
      const em = /(\d+) \+ #|# ([+−]) (\d+)/.exec(other)!, sE = em[1] ? +em[1] : (em[2] === '+' ? 1 : -1) * +em[3];
      const { a, b } = br, M = c - sE, inner = M / a;
      expect(br.s).toBe('+');
      expect(Number.isInteger(inner) && ans(it) === inner - b, eq).toBe(true);
      expect(trapProblem(it, [['eq2_stopped_midway', inner], ['eqbr_first_only', q(M - b, a)], ['eqbr_ignored_factor', M - b], ['eq2_sign', (q(c + sE, a) ?? 0) - b]], eq), eq).toBeNull();
      sE > 0 ? pe++ : me++;
    }
    expect(pe).toBeGreaterThan(100); expect(me).toBeGreaterThan(100); expect(da).toBeGreaterThan(100); expect(ds).toBeGreaterThan(100);
  });
  it('brackets_both: скобки и x с двух сторон; x в обеих частях; ловушки по меткам; три вида (x, minus, br) встречаются', () => {
    let kindX = 0, kindMinus = 0, kindBr = 0;
    for (const it of gen('eq.brackets_both', 23, 500)) {
      const eq = eqOf(it);
      expect(rootProblem(eq, it), eq).toBeNull();
      const { a, B, c, D, v } = sidesOf(eq), k = a - c, diff = D - B;
      expect(eq.split('=').every(z => z.includes(v)), eq).toBe(true);
      expect(eq).toMatch(/\(/);
      const nBr = (eq.match(/\(/g) ?? []).length;
      nBr === 2 ? kindBr++ : B < 0 ? kindMinus++ : kindX++;
      const all = eq.match(/\d+ · \([a-z] [+−] \d+\)|\d+\([a-z] [+−] \d+\)|\([a-z] [+−] \d+\) · \d+/g)!.map(parseBracket), bb = all.find(z => z.a === a)!;   // скобка стороны с большим x
      const P1 = B > 0 ? bb.b : -bb.b;                                                  // «скобки раскрыты только у x»: a x ± b
      expect(Math.abs(B), eq).toBe(bb.a * bb.b);
      expect(trapProblem(it, [['eq2_stopped_midway', diff], ['eqbr_first_only', q(D - P1, k)], ['eqb_x_sign', q(diff, a + c)], ['eqb_const_sign', q(D + B, k)], ['eqb_one_coef', q(diff, a)], ['eqb_one_coef', q(diff, c)]], eq), eq).toBeNull();
    }
    expect(kindX).toBeGreaterThan(80); expect(kindMinus).toBeGreaterThan(80); expect(kindBr).toBeGreaterThan(80);
  });
  it('brackets_check: корень единственный (перебор и подстановка каждого варианта), в разборе есть тексеру', () => {
    const kinds = new Set<string>();
    for (const it of gen('eq.brackets_check', 24, 500)) {
      const eq = rootEqOf(it);
      expect(rootProblem(eq, it), eq).toBeNull(); expect(it.sol.kz).toContain('Тексеру');
      kinds.add(eq.includes(' : ') ? 'div' : /\d+ [+−] \d+ = |= \d+ [+−] /.test(eq) || /\) [+−] \d+|\d+ \+ [\d(]/.test(eq) ? 'e' : 'plain');
    }
    expect([...kinds].sort()).toEqual(['div', 'e', 'plain']);
  });
  it('главные ловушки скобок встречаются: «только первое слагаемое» и «потерял множитель»', () => {
    for (const id of ['eq.brackets_divide', 'eq.brackets_expand', 'eq.brackets_both']) {
      const tags = new Set(gen(id, 25, 400).flatMap(it => it.choices.map(c => c.tag)));
      for (const t of ['eqbr_first_only', 'eq2_stopped_midway']) expect(tags.has(t), `${id}: ${t}`).toBe(true);
    }
    for (const id of ['eq.brackets_divide', 'eq.brackets_expand']) expect(new Set(gen(id, 25, 400).flatMap(it => it.choices.map(c => c.tag))).has('eqbr_ignored_factor'), id).toBe(true);
  });
  it('записи скобки разные: «a · (x + b)», «a(x + b)», «(x + b) · a»; корень не слишком большой', () => {
    const forms = new Set<string>();
    for (const it of gen('eq.brackets_divide', 26, 400)) { const b = bracketOf(eqOf(it)); forms.add(b.replace(/\d+/g, '#').replace(/[a-z]/g, 'v').replace(/[+−]/, 's')); expect(ans(it)).toBeLessThanOrEqual(40); }
    expect(forms.size).toBe(3);
  });
});

// ───────────────────────── задачи словами ─────────────────────────
/** Уравнение из текста задачи (свой разбор по ключевым словам). Возвращает строку уравнения с буквой x. */
function storyEquation(kz: string): string {
  let m: RegExpExecArray | null;
  if ((m = /Бірінші сөреде (\d+) бірдей қорап пен тағы (\d+) \S+ тұр, екінші сөреде сондай (\d+) қорап(?: пен тағы (\d+) \S+)? тұр/.exec(kz))) return `${m[1]}x + ${m[2]} = ${m[3]}x + ${m[4] ?? 0}`;
  if ((m = /(\d+) теңге бар, ол күн сайын (\d+) теңге жинайды\. \S+ (\d+) теңге бар, ол күн сайын (\d+) теңге жинайды/.exec(kz))) return `${m[1]} + ${m[2]}x = ${m[3]} + ${m[4]}x`;
  if ((m = /сол табағында (\d+) бірдей қап пен (\d+) граммдық гір, оң табағында сондай (\d+) қап пен (\d+) граммдық гір/.exec(kz))) return `${m[1]}x + ${m[2]} = ${m[3]}x + ${m[4]}`;
  if ((m = /^(\d+) қорапта .* Әр қорапқа тағы (\d+) \S+ салды, сонда барлығы (\d+)/.exec(kz))) return `${m[1]}(x + ${m[2]}) = ${m[3]}`;
  if ((m = /^(\d+) қорапта .* Әр қораптан (\d+) \S+ алды, сонда барлығы (\d+)/.exec(kz))) return `${m[1]}(x − ${m[2]}) = ${m[3]}`;
  if ((m = /Әкесі (\d+) жаста, ұлы (\d+) жаста\. .* (\d+) есе көп/.exec(kz))) return `${m[1]} + x = ${m[3]}(${m[2]} + x)`;
  throw new Error('не распознано: ' + kz);
}
describe('задачи словами: ответ пересчитан по тексту, корень единственный, ни один другой вариант корнем не является', () => {
  for (const id of ['eq.both_story', 'eq.brackets_story']) it(id, () => {
    const shapes = new Set<string>();
    for (const it of gen(id, 31, 500)) {
      const eq = storyEquation(it.kz);
      expect(rootProblem(eq, it), it.kz).toBeNull();
      expect(ans(it), it.kz).toBeGreaterThanOrEqual(1);
      shapes.add(it.kz.replace(/\d+/g, '#').replace(/(қарындаш|кітап|алма|дәптер|кәмпит)/g, 'N').replace(/(Дана|Марат|Айжан|Бекзат|Әлия|Нұрлан)\S*/g, 'P'));
    }
    expect(shapes.size, id).toBeGreaterThanOrEqual(3);
  });
  it('both_story: три сюжета (коробки, копилки, весы), с одной стороны x больше, значения в условии — до 3 знаков', () => {
    const kinds = new Set<string>();
    for (const it of gen('eq.both_story', 32, 300)) {
      kinds.add(/сөре/.test(it.kz) ? 'boxes' : /теңге/.test(it.kz) ? 'savings' : 'scales');
      const { a, c } = sidesOf(storyEquation(it.kz)); expect(a).toBeGreaterThan(c);
      expect(it.kz.match(/\d+/g)!.every(n => n.length <= 3), it.kz).toBe(true);
      expect(trapProblem(it, bothOrdered(storyEquation(it.kz)), it.kz), it.kz).toBeNull();
    }
    expect([...kinds].sort()).toEqual(['boxes', 'savings', 'scales']);
  });
  it('brackets_story: три сюжета (добавили в каждую, забрали из каждой, возраст); у возраста отец старше сына на 20–42 года, ответ натуральный', () => {
    const kinds = new Set<string>();
    for (const it of gen('eq.brackets_story', 33, 400)) {
      const eq = storyEquation(it.kz);
      kinds.add(/Әкесі/.test(it.kz) ? 'age' : /салды/.test(it.kz) ? 'add' : 'take');
      if (/Әкесі/.test(it.kz)) { const [A, B] = it.kz.match(/\d+/g)!.map(Number); expect(A - B).toBeGreaterThanOrEqual(20); expect(A - B).toBeLessThanOrEqual(42); expect(A).toBeLessThanOrEqual(55); expect(ans(it) + B, 'возраст сына через x лет').toBeLessThan(40); }
      else { const lin1 = solveLinear(eq)!; expect(lin1[1]).toBe(1); }
      for (const t of ['eqbr_first_only', 'eqbr_ignored_factor']) for (const w of byTag(it, t)) expect(holdsAt(eq, w)).toBe(false);
    }
    expect([...kinds].sort()).toEqual(['add', 'age', 'take']);
  });
  it('возраст: «стоп» — возраст сына через x лет или (k − 1) x, а не сам x; ловушки не являются корнем', () => {
    let seen = 0;
    for (const it of gen('eq.brackets_story', 34, 400)) {
      if (!/Әкесі/.test(it.kz)) continue;
      const [A, B, k] = it.kz.match(/\d+/g)!.map(Number), x = ans(it), f = A - k * B;
      expect(f, it.kz).toBe((k - 1) * x);
      for (const w of byTag(it, 'eq2_stopped_midway')) { expect([x + B, f], it.kz).toContain(w); seen++; }
    }
    expect(seen).toBeGreaterThan(40);
  });
});

// ───────────────────────── самопроверка проверяющих (мутации) ─────────────────────────
describe('самопроверка: проверяющие функции ловят заведомо сломанные задачи', () => {
  const good = () => { const it = gen('eq.both_full', 41, 1)[0]; return { it, eq: eqOf(it) }; };
  it('сдвинутый ответ, чужой корень среди вариантов, перепутанная метка ловушки — всё замечено', () => {
    const { it, eq } = good();
    expect(rootProblem(eq, it)).toBeNull();
    const bad1: Item = JSON.parse(JSON.stringify(it)); bad1.choices[bad1.answer].text = String(ans(it) + 1);                      // ответ не корень
    expect(rootProblem(eq, bad1)).not.toBeNull();
    const j = it.choices.findIndex((c, i) => i !== it.answer); const bad2: Item = JSON.parse(JSON.stringify(it)); bad2.choices[j].text = String(ans(it)); // дубль корня
    expect(rootProblem(eq, bad2)).not.toBeNull();
    const bad3: Item = JSON.parse(JSON.stringify(it)), jj = bad3.choices.findIndex(c => c.tag === 'eq2_stopped_midway');
    if (jj >= 0) { bad3.choices[jj].tag = 'eqb_x_sign'; expect(trapProblem(bad3, bothOrdered(eq), eq)).not.toBeNull(); }
  });
  it('точный вычислитель: «3(x + 4) = 27» → единственный корень 5; «5x + 3 = 2x + 18» → 5; «7 = (x + 6) : 8» → 50; несуществующий корень не находится', () => {
    expect(exactRoots('3(x + 4) = 27')).toEqual([5]); expect(exactRoots('5x + 3 = 2x + 18')).toEqual([5]); expect(exactRoots('7 = (x + 6) : 8')).toEqual([50]);
    expect(exactRoots('x + 1 = x + 2')).toEqual([]); expect(exactRoots('2(x + 1) = 2x + 2')).toHaveLength(3001);   // нет корней / любое число
    expect(evalAt('2 · (x + 4) − 3', 5)).toEqual([15, 1]);
    expect(solveLinear('x + 1 = x + 2')).toBeNull();
  });
});

// ───────────────────────── перебор и устойчивость ─────────────────────────
describe('стойкость: 3000 прогонов каждого генератора без исключений, быстро', () => {
  for (const t of T) it(`${t.id}: 3000 раундов, 5 вариантов, без NaN и повторов; ответ — корень (выборочно по перебору)`, () => {
    const t0 = Date.now(), r = rng(777);
    for (let k = 0; k < 3000; k++) {
      const it: Item = t.gen(r);
      if (it.choices.length !== 5 || new Set(it.choices.map(c => c.text)).size !== 5 || it.choices[it.answer].tag !== 'correct') throw new Error(`${t.id}: ${JSON.stringify(it)}`);
      if (it.choices.some(c => !nat(+c.text))) throw new Error(`${t.id}: не натуральный вариант ${JSON.stringify(it.choices)}`);
      if (k % 100 === 0) {   // выборочный точный перебор: 30 задач на генератор
        const eq = /\n/.test(it.kz) ? eqOf(it) : /Қай сан/.test(it.kz) ? rootEqOf(it) : storyEquation(it.kz);
        const e = rootProblem(eq, it); if (e) throw new Error(`${t.id}: ${e}`);
      }
    }
    expect(Date.now() - t0).toBeLessThan(1500);
  });
});
