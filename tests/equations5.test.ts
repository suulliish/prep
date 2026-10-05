// C6: 15 генераторов (content/templates/equations5.mjs) для expr.variables, eq.linear_basic, eq.two_step.
// Ответ каждого генератора пересчитан здесь независимо: разбор текста задачи, подстановка каждого варианта в уравнение, перебор корней, своя оценка
// выражений. Код шаблона не вызывается ни для ответа, ни для разбора условия.
import { describe, it, expect } from 'vitest';
import glossary from '../content/glossary.json';
// @ts-ignore — шаблоны написаны на JS
import equations5 from '../content/templates/equations5.mjs';
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

const T = equations5 as any[];
const SEEDS = 300;
type Item = { kz: string; ru: string; choices: { text: string; tag: string }[]; answer: number; sol: { kz: string; ru: string } };
const gen = (id: string, seed = 5, n = SEEDS): Item[] => { const t = byId[id], r = rng(seed); return Array.from({ length: n }, () => t.gen(r)); };
const texts = (it: Item) => it.choices.map(c => c.text);
const ans = (it: Item) => it.choices[it.answer].text;
const byTag = (it: Item, tag: string) => it.choices.filter(c => c.tag === tag).map(c => +c.text);
import { LETTER, evalExpr, sides, roots, compose1, compose2, storyEq } from './_eq_helpers';
const eqOf = (it: Item) => it.kz.split('\n')[1];

const IDS: Record<string, string[]> = {
  'expr.variables': ['expr.substitute', 'expr.substitute_two', 'expr.compose_one', 'expr.compose_two'],
  'eq.linear_basic': ['eq.add_sub_unknown', 'eq.mul_div_unknown', 'eq.reverse_order', 'eq.check_root', 'eq.story_one'],
  'eq.two_step': ['eq.two_step_mul_add', 'eq.two_step_mul_sub', 'eq.two_step_div', 'eq.think_number', 'eq.two_step_story', 'eq.two_step_minus'],
};

describe('equations5: структура и привязка к темам', () => {
  it('ровно 15 генераторов, id уникальны во всём курсе', () => {
    expect(T).toHaveLength(15);
    const all = (templates as any[]).map(t => t.id);
    expect(new Set(all).size).toBe(all.length);
  });
  it('каждая из трёх тем: свой набор генераторов, ≥ 2, есть қиындық ≥ 2; каждый привязан к своей теме', () => {
    for (const [sk, ids] of Object.entries(IDS)) {
      expect([...skillById[sk].templates].sort(), sk).toEqual([...ids].sort());
      const own = ids.map(id => byId[id]);
      expect(own.length, sk).toBeGreaterThanOrEqual(2);
      expect(own.some(t => t.difficulty >= 2), sk).toBe(true);
      expect(own.some(t => t.difficulty === 1), `${sk}: нет қиындық 1`).toBe(true);
    }
    for (const t of T) for (const sk of t.skills) expect(skillById[sk].templates, `${sk} ← ${t.id}`).toContain(t.id);
    expect(skillById['eq.two_step'].prereqs).toEqual(['eq.linear_basic']);
    expect(skillById['eq.linear_basic'].prereqs).toEqual(['nat.ops', 'expr.variables']);
  });
  it('в одношаговой теме нет двухшаговых уравнений, в двухшаговой нет одношаговых (лесенка не перескакивает тему)', () => {
    const ops = (l: string) => (l.match(/[+−·:]/g) ?? []).length + (/\d[a-z]/.test(l) ? 1 : 0);
    for (const id of ['eq.add_sub_unknown', 'eq.mul_div_unknown', 'eq.reverse_order']) for (const it of gen(id, 3, 100)) expect(ops(sides(eqOf(it))[0]), eqOf(it)).toBe(1);
    for (const id of ['eq.two_step_mul_add', 'eq.two_step_mul_sub', 'eq.two_step_div', 'eq.two_step_minus']) for (const it of gen(id, 3, 100)) expect(ops(sides(eqOf(it))[0]), eqOf(it)).toBe(2);
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
      }
    });
  }
  it('у каждого шаблона есть подсказка-вопрос и ключевая идея, русские названия меток и разбор ошибок на месте', () => {
    for (const t of T) { const h = (HINT_KEYS as any)[t.id]; expect(h?.q?.kz?.length, t.id).toBeGreaterThan(10); expect(h?.idea?.ru?.length, t.id).toBeGreaterThan(10); }
    const tags = new Set<string>();
    for (const t of T) for (const it of gen(t.id, 7, 200)) for (const c of it.choices) if (c.tag !== 'correct' && c.tag !== 'random') tags.add(c.tag);
    for (const tag of tags) {
      expect((MISCONCEPTIONS as any)[tag], `разбор метки ${tag}`).toBeTruthy();
      expect((MISCONCEPTIONS as any)[tag].kz.length, tag).toBeGreaterThan(20); expect((MISCONCEPTIONS as any)[tag].ru.length, tag).toBeGreaterThan(20);
      expect((MISCONCEPTIONS as any)[tag].kz, tag).not.toContain('—');
      expect((MISTAKE_NAMES as any)[tag], `русское название ${tag}`).toBeTruthy();
    }
  });
});

// ───────────────────────── уравнения: подстановка каждого варианта, единственный корень ─────────────────────────
const EQ_IDS = ['eq.add_sub_unknown', 'eq.mul_div_unknown', 'eq.reverse_order', 'eq.two_step_mul_add', 'eq.two_step_mul_sub', 'eq.two_step_div', 'eq.two_step_minus'];
describe('уравнения: верный вариант — единственный корень, ни одна ловушка корнем не является', () => {
  for (const id of EQ_IDS) it(id, () => {
    for (const it of gen(id, 11)) {
      const e = eqOf(it), v = e.match(LETTER)![0], [l, r] = sides(e);
      const holds = (x: number) => Math.abs(evalExpr(l, { [v]: x }) - evalExpr(r, { [v]: x })) < 1e-9;
      expect(roots(e), e).toEqual([+ans(it)]);                                     // перебор 1..3000: корень один и это верный вариант
      it.choices.forEach((c, i) => expect(holds(+c.text), `${e}: ${c.text}`).toBe(i === it.answer));
      expect(it.sol.kz, e).toContain(`Тексеру`);                                 // разбор ведёт к проверке подстановкой
    }
  });
  it('check_root: условие содержит уравнение, корень — единственный вариант, подходящий при подстановке', () => {
    for (const it of gen('eq.check_root', 12)) {
      const e = /Қай сан (.+) теңдеуінің/.exec(it.kz)![1];
      expect(roots(e), e).toEqual([+ans(it)]);
      const v = e.match(LETTER)![0], [l, r] = sides(e);
      it.choices.forEach((c, i) => expect(Math.abs(evalExpr(l, { [v]: +c.text }) - evalExpr(r, { [v]: +c.text })) < 1e-9, `${e}: ${c.text}`).toBe(i === it.answer));
    }
  });
});

describe('ловушки уравнений — это те ошибки, о которых говорит метка', () => {
  const parse = (e: string) => { const [l, r] = sides(e); return { l, r: +r, nums: (l.match(/\d+/g) ?? []).map(Number) }; };
  it('a − x = b: ловушка eq_sub_swapped — a + b (125 − x = 48 → 173); a : x = b: eq_div_swapped — a · b', () => {
    let sub = 0, div = 0;
    for (const it of gen('eq.reverse_order', 13)) {
      const { l, r, nums } = parse(eqOf(it)), a = nums[0];
      if (l.includes('−')) { sub++; expect(byTag(it, 'eq_sub_swapped'), eqOf(it)).toEqual([a + r]); }
      else { div++; expect(byTag(it, 'eq_div_swapped'), eqOf(it)).toEqual([a * r]); }
    }
    expect(sub).toBeGreaterThan(80); expect(div).toBeGreaterThan(80);
  });
  it('x + a = b: eq_same_op = b + a; x − a = b: eq_same_op = b − a (если натуральное); a · x = b: eq_same_op = b · a; x : a = b: = b : a (целое)', () => {
    for (const it of gen('eq.add_sub_unknown', 14)) {
      const { l, r, nums } = parse(eqOf(it)), a = nums[0];
      const want = l.includes('+') ? [r + a] : r - a > 0 ? [r - a] : [];
      expect(byTag(it, 'eq_same_op'), eqOf(it)).toEqual(want);
    }
    for (const it of gen('eq.mul_div_unknown', 14)) {
      const { l, r } = parse(eqOf(it)), a = +(l.match(/\d+/)![0]);
      if (l.includes(':')) expect(byTag(it, 'eq_same_op'), eqOf(it)).toEqual(r % a === 0 ? [r / a] : []);
      else expect(byTag(it, 'eq_same_op'), eqOf(it)).toEqual([r * a]);
    }
  });
  /** Ловушки идут в коде в известном порядке; если два значения совпали, остаётся первое (choices5 не повторяет варианты). */
  const expectTraps = (it: Item, ordered: [string, number | null][], eq: string) => {
    const seen = new Set<number>([+ans(it)]);
    const want: Record<string, number[]> = {};
    for (const [tag, v] of ordered) { if (v !== null && Number.isInteger(v) && v > 0 && !seen.has(v)) { seen.add(v); (want[tag] ??= []).push(v); } }
    for (const [tag] of ordered) expect(byTag(it, tag).sort((x, y) => x - y), `${eq}: ${tag}`).toEqual((want[tag] ?? []).sort((x, y) => x - y));
  };
  it('a · x + b = c: stopped_midway = c − b, order = c : a − b, sign = (c + b) : a, same_op = (c − b) · a; a · x − b = c: sign = (c − b) : a, stopped = c + b, order = c : a + b, same_op = (c + b) · a', () => {
    for (const it of gen('eq.two_step_mul_add', 15)) {
      const e = eqOf(it), { l, r: c, nums } = parse(e), implicit = /\d[a-z]/.test(l), a = implicit || /^\d+ ·/.test(l) ? nums[0] : nums[1], b = nums[0] === a && (implicit || /^\d+ ·/.test(l)) ? nums[1] : nums[0];
      expect(a * +ans(it) + b, e).toBe(c);
      // порядок в коде: stopped, order, sign, same_op; «стоп» занимает значение раньше остальных
      expectTraps(it, [['eq2_stopped_midway', c - b], ['eq2_order', c % a === 0 ? c / a - b : null], ['eq2_sign', (c + b) % a === 0 ? (c + b) / a : null], ['eq_same_op', (c - b) * a]], e);
    }
    for (const it of gen('eq.two_step_mul_sub', 15)) {
      const e = eqOf(it), { r: c, nums } = parse(e), [a, b] = nums;
      expect(a * +ans(it) - b, e).toBe(c);
      expectTraps(it, [['eq2_sign', c - b > 0 && (c - b) % a === 0 ? (c - b) / a : null], ['eq2_stopped_midway', c + b], ['eq2_order', c % a === 0 ? c / a + b : null], ['eq_same_op', (c + b) * a]], e);
    }
  });
  it('главная ловушка «стоп на полпути» и «не тот порядок» встречаются у всех двухшаговых видов', () => {
    for (const id of ['eq.two_step_mul_add', 'eq.two_step_mul_sub', 'eq.two_step_div', 'eq.two_step_minus']) {
      const tags = new Set(gen(id, 16).flatMap(it => it.choices.map(c => c.tag)));
      expect(tags.has('eq2_stopped_midway'), id).toBe(true);
      expect(tags.has('eq2_sign'), id).toBe(true);
      expect(tags.has('eq_same_op'), id).toBe(true);
    }
  });
});

describe('x в целых, числа в разумных границах', () => {
  it('корень натуральный, числа в условии не больше 3 знаков, верный вариант на всех 5 позициях', () => {
    for (const id of EQ_IDS) {
      const pos = new Set<number>();
      for (const it of gen(id, 17)) { const x = +ans(it); expect(Number.isInteger(x) && x >= 2 && x <= 400, `${id}: ${x}`).toBe(true); expect(eqOf(it).match(/\d+/g)!.every(n => n.length <= 3), eqOf(it)).toBe(true); pos.add(it.answer); }
      expect(pos.size, id).toBe(5);
    }
  });
});

// ───────────────────────── выражения ─────────────────────────
describe('expr.substitute: значение выражения', () => {
  it('значение пересчитано по тексту; ровно один вариант равен ему; метки ловушек верны', () => {
    let concat = 0, bracket = 0, ltr = 0;
    for (const it of gen('expr.substitute', 21, 600)) {
      const m = /^([a-z]) = (\d+) болса, (.+) өрнегінің/.exec(it.kz)!, v = m[1], val = +m[2], e = m[3];
      const want = evalExpr(e, { [v]: val });
      expect(+ans(it), it.kz).toBe(want);
      expect(texts(it).filter(t => +t === want), it.kz).toHaveLength(1);
      // «5n» прочитанное как число 54: ловушка есть только у записи без знака
      const cat = e.replace(/(\d+)([a-z])/g, (_, d, c) => d + val);
      if (/\d[a-z]/.test(e) && !e.includes('(')) { const w = evalExpr(cat, {}); if (w !== want && w > 0) { expect(byTag(it, 'expr_concat'), it.kz).toEqual([w]); concat++; } }
      if (!/\d[a-z]/.test(e) || e.includes('(')) expect(byTag(it, 'expr_concat')).toEqual([]);
      if (e.includes('(')) { bracket++; expect(byTag(it, 'expr_bracket_ignored').length, it.kz).toBe(1); }
      if (/^\d+ [+−] \d*\s?·?\s?[a-z]/.test(e) || /^\d+ [+−] \d+[a-z]/.test(e)) { ltr++; expect(byTag(it, 'left_to_right').length, it.kz).toBe(1); }
    }
    expect(concat).toBeGreaterThan(100); expect(bracket).toBe(0);                       // скобки только у более трудного шаблона substitute_two
    expect(ltr).toBeGreaterThan(50);
  });
  it('главная ловушка «5n = 54» ловится у записи без знака умножения', () => {
    const items = gen('expr.substitute', 22, 400).filter(it => /\d[a-z] [+−] \d/.test(it.kz));
    expect(items.length).toBeGreaterThan(40);
    for (const it of items) expect(byTag(it, 'expr_concat'), it.kz).toHaveLength(1);
  });
});
describe('expr.substitute_two: две буквы', () => {
  it('значение пересчитано; один вариант равен ему; «ab» и «3a» прочитаны слитно как ловушка', () => {
    let bracket = 0, conc = 0;
    for (const it of gen('expr.substitute_two', 23, 600)) {
      const m = /^([a-z]) = (\d+), ([a-z]) = (\d+) болса, (.+) өрнегінің/.exec(it.kz)!, vars: Record<string, number> = { [m[1]]: +m[2], [m[3]]: +m[4] }, e = m[5];
      const want = evalExpr(e, vars);
      expect(+ans(it), it.kz).toBe(want);
      expect(texts(it).filter(t => +t === want), it.kz).toHaveLength(1);
      expect(m[1]).not.toBe(m[3]);
      if (e.includes('(')) { bracket++; expect(byTag(it, 'expr_concat'), it.kz).toEqual([]); continue; }
      // слитное чтение: «3a» при a = 5 как число 35, «ab» при a = 4, b = 3 как 43
      const glued = e.replace(/([a-z])([a-z])/g, (_, x, y) => `${vars[x]}${vars[y]}`).replace(/(\d+)([a-z])/g, (_, d, c) => `${d}${vars[c]}`);
      const w = evalExpr(glued, {});
      if (w !== want && w > 0) { conc++; expect(byTag(it, 'expr_concat'), it.kz).toEqual([w]); }
    }
    expect(bracket).toBeGreaterThan(60); expect(conc).toBeGreaterThan(100);
  });
});

describe('expr.compose_one / compose_two: выражение по словам', () => {
  for (const [id, parse] of [['expr.compose_one', compose1], ['expr.compose_two', compose2]] as const) {
    it(`${id}: верный вариант равен выражению из условия при n = 7, 11, 13, 17; ни одна ловушка ему не эквивалентна; один и тот же вид не повторён`, () => {
      const kinds = new Set<string>();
      for (const it of gen(id, 24, 600)) {
        const body = it.kz.split('\nСәйкес')[0], v = body.match(LETTER)![0], f = parse(body);
        const val = (s: string, n: number) => evalExpr(s, { [v]: n });
        for (const n of [7, 11, 13, 17]) expect(val(ans(it), n), `${body} → ${ans(it)}`).toBeCloseTo(f(n), 9);
        it.choices.forEach((c, i) => { if (i !== it.answer) expect([7, 11, 13, 17].some(n => Math.abs(val(c.text, n) - f(n)) > 1e-9), `${body}: ${c.text} равно верному`).toBe(true); });
        expect(new Set(texts(it).map(t => [7, 11, 13, 17].map(n => val(t, n)).join('|'))).size, 'эквивалентные варианты').toBe(5);
        for (const t of texts(it)) expect(t.match(LETTER) ?? [v]).toEqual([v]);
        kinds.add(body.replace(/\d+/g, '#').replace(/[a-z]/g, 'v').replace(/(қарындаш|кітап|алма|дәптер|кәмпит)\S*/g, 'N'));
      }
      expect(kinds.size, 'видов условий').toBeGreaterThanOrEqual(id === 'expr.compose_one' ? 7 : 4);
    });
  }
  it('все ловушки составления выражения встречаются, ни одна не теряется', () => {
    const t1 = new Set(gen('expr.compose_one', 25, 400).flatMap(it => it.choices.map(c => c.tag)));
    for (const tag of ['compose_opposite', 'compose_mix', 'compose_reversed']) expect(t1.has(tag), tag).toBe(true);
    const t2 = new Set(gen('expr.compose_two', 25, 400).flatMap(it => it.choices.map(c => c.tag)));
    for (const tag of ['compose_opposite', 'compose_brackets', 'compose_dropped', 'compose_one_box']) expect(t2.has(tag), tag).toBe(true);
  });
});

// ───────────────────────── задачи словами ─────────────────────────
describe('задачи словами: ответ пересчитан по тексту, корень единственный', () => {
  for (const id of ['eq.story_one', 'eq.two_step_story', 'eq.think_number']) it(id, () => {
    const shapes = new Set<string>();
    for (const it of gen(id, 31, 500)) {
      const f = storyEq(it.kz), rs: number[] = [];
      for (let x = 1; x <= 3000; x++) if (Math.abs(f(x)) < 1e-9) rs.push(x);
      expect(rs, it.kz).toEqual([+ans(it)]);
      it.choices.forEach((c, i) => expect(Math.abs(f(+c.text)) < 1e-9, `${it.kz}: ${c.text}`).toBe(i === it.answer));
      shapes.add(it.kz.replace(/\d+/g, '#').replace(/(қарындаш|кітап|алма|дәптер|кәмпит)\S*/g, 'N'));
    }
    expect(shapes.size, id).toBeGreaterThanOrEqual(id === 'eq.story_one' ? 4 : 3);
  });
  it('задуманное число: все 4 вида (× +, × −, : +, : −) встречаются', () => {
    const k = new Set(gen('eq.think_number', 32, 300).map(it => `${/көбейтіп/.test(it.kz) ? '×' : ':'}${/қосқанда/.test(it.kz) ? '+' : '−'}`));
    expect([...k].sort()).toEqual(['×+', '×−', ':+', ':−'].sort());
  });
  it('story_one: ловушка «то же действие» = обратной операции, не прочитанной из условия: 15 книг после 3 детей даёт 45, а не 5', () => {
    for (const it of gen('eq.story_one', 33, 300)) {
      const f = storyEq(it.kz), x = +ans(it);
      for (const w of byTag(it, 'eq_same_op')) expect(Math.abs(f(w)) > 1e-9, `${it.kz}: ${w}`).toBe(true);
    }
  });
});

// ───────────────────────── перебор и устойчивость ─────────────────────────
describe('стойкость: 3000 прогонов каждого генератора без исключений, быстро', () => {
  it('3000 раундов подряд, разные зёрна, без NaN и повторов вариантов', () => {
    const t0 = Date.now();
    for (const t of T) {
      const r = rng(777);
      for (let k = 0; k < 3000; k++) {
        const it = t.gen(r);
        if (it.choices.length !== 5 || new Set(it.choices.map((c: any) => c.text)).size !== 5 || it.choices[it.answer].tag !== 'correct') throw new Error(`${t.id}: ${JSON.stringify(it)}`);
      }
    }
    expect(Date.now() - t0).toBeLessThan(1500);
  });
});
