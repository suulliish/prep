// C7: три урока (content/lessons_week10.mjs): expr.variables, eq.linear_basic, eq.two_step.
// Сценарий, зарегистрированные сцены и виджеты, запрещённые слова, голос (как у тестов озвучки), перенос (цель = финал, пример другой),
// все равенства и корни уравнений в текстах пересчитаны независимо, равновесие весов в виджетах единственное (перебор), 3000 раундов каждой мини-игры.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
// @ts-ignore
import { LESSONS } from '../content/lessons.mjs';
// @ts-ignore
import { WEEK10 } from '../content/lessons_week10.mjs';
// @ts-ignore
import { rng } from '../content/templates/lib.mjs';
// @ts-ignore
import GLOSSARY from '../content/glossary.json';
// @ts-ignore
import { TECHNIQUES } from '../content/techniques.mjs';
// @ts-ignore
import { skillById } from '../content/skills.mjs';
// @ts-ignore
import PENDING from '../content/voice_pending.json';
// @ts-ignore
import { buildLines, numeralLeak, UNKNOWN, speakable } from '../scripts/voice/lesson-lines.mjs';
import { planGaps } from '../src/lesson/gap';
import { menuCards } from '../src/lesson/teachback';
import { totals } from '../src/widgets/scalesmath';
import { evalExpr, sides, roots, compose1, compose2, LETTER } from './_eq_helpers';

const IDS = ['expr.variables', 'eq.linear_basic', 'eq.two_step'];
const W = WEEK10 as Record<string, any[]>, L = LESSONS as Record<string, any[]>;
const steps = (id: string, type: string) => W[id].filter(s => s.type === type);
const one = (id: string, type: string) => steps(id, type)[0];
const textOf = (s: any): string[] => [s.kz ?? '', s.task ?? '', s.reveal ?? '', s.why ?? '', s.fix ?? '', ...(s.lines ?? []), ...(s.choices ?? []), ...(s.frames ?? []).flatMap((f: any) => [f.kz ?? '', f.math ?? '']),
  ...(s.steps ?? []).flatMap((x: any) => [x.math ?? '', x.blank?.why ?? '', ...(x.blank?.choices ?? [])])];
const root1 = (eq: string): number => { const r = roots(eq); expect(r, eq).toHaveLength(1); return r[0]; };

// ───────────────────────── сценарий ─────────────────────────
describe('уроки уравнений: полный сценарий', () => {
  it('все 3 темы есть в LESSONS и в графе, с приёмом, карточками «Биткә түсіндір» и без озвучки (voice_pending)', () => {
    for (const id of IDS) {
      expect(L[id], id).toBeTruthy(); expect(skillById[id], id).toBeTruthy();
      expect(TECHNIQUES.find((t: any) => t.skill === id), `приём ${id}`).toBeTruthy();
      expect(menuCards(id), `Биткә түсіндір ${id}`).not.toBeNull();
      expect(PENDING, `voice_pending ${id}`).toContain(id);
    }
    expect(Object.keys(W).sort()).toEqual([...IDS].sort());
  });
  for (const id of IDS) it(`${id}: цель → руками (весы) → … → возврат к цели`, () => {
    const t = W[id].map(s => s.type);
    expect(t).toEqual(['goal', 'widget', 'predict', 'example', 'faded', 'faded', 'why', 'bug', 'blitz', 'rule', 'final']);
    const goal = W[id][0], fin = W[id].at(-1);
    expect(goal.kz.split(/\s+/).length, 'цель длиннее 30 слов').toBeLessThanOrEqual(30);
    expect(fin.scene, 'сцена финала = сцене цели').toBe(goal.scene);
    expect(goal.task.length).toBeGreaterThan(5);
    expect(one(id, 'widget').w).toBe('Scales');
  });
  it('финал как на экзамене: 5 разных вариантов; после перемешивания в LESSONS верный не всегда первый', () => {
    const pos = new Set<number>();
    for (const id of IDS) {
      const f = L[id].at(-1), raw = W[id].at(-1);
      expect(f.choices).toHaveLength(5); expect(new Set(f.choices).size).toBe(5);
      expect([...f.choices].sort()).toEqual([...raw.choices].sort());
      expect(f.choices[f.answer]).toBe(raw.choices[raw.answer]);
      pos.add(f.answer);
    }
    expect(pos.size).toBeGreaterThanOrEqual(2);
  });
  it('варианты ответов различны, верный индекс в границах, пошаговые согласованы, у мини-игр ≥ 3 варианта, 3000 раундов без сбоев', () => {
    const r = rng(9);
    for (const id of IDS) {
      for (const s of W[id]) {
        if (['predict', 'why', 'final'].includes(s.type)) { expect(s.answer).toBeGreaterThanOrEqual(0); expect(s.answer).toBeLessThan(s.choices.length); expect(new Set(s.choices).size).toBe(s.choices.length); }
        if (s.type === 'faded') {
          expect(s.steps.some((x: any) => x.blank)).toBe(true);
          for (const x of s.steps) {
            if (x.blank) { expect(x.math).toContain('▢'); expect(x.blank.answer).toBeLessThan(x.blank.choices.length); expect(new Set(x.blank.choices).size).toBe(x.blank.choices.length); }
            else expect(x.math).not.toContain('▢');
          }
        }
        if (s.type === 'bug') { expect(s.bad).toBeLessThan(s.lines.length); expect(s.follows ?? []).not.toContain(s.bad); for (const k of s.follows ?? []) expect(k).toBeGreaterThan(s.bad); }
      }
      const b = one(id, 'blitz');
      for (let k = 0; k < 3000; k++) {
        const it = b.make(r);
        expect(it.q.length).toBeGreaterThan(5);
        expect(new Set(it.choices).size, it.q + ' ' + it.choices).toBe(it.choices.length);
        expect(it.choices.length, it.q).toBeGreaterThanOrEqual(3);
        expect(it.answer).toBeGreaterThanOrEqual(0); expect(it.answer).toBeLessThan(it.choices.length);
        expect(it.choices.join(), it.q).not.toMatch(/NaN|undefined|-\d/);
      }
    }
  });
  it('сцены и виджеты зарегистрированы, запрещённых слов нет, нет длинного тире в казахском тексте', () => {
    const scenes = readFileSync('src/lesson/Scene.svelte', 'utf8'), lesson = readFileSync('src/screens/Lesson.svelte', 'utf8');
    const avoid: string[] = (GLOSSARY as any).terms.flatMap((t: any) => t.avoid ?? []).filter((w: string) => w.length > 3);
    for (const id of IDS) {
      const txt: string[] = [];
      for (const s of W[id]) {
        if (s.scene) expect(scenes, `${id}: сцена ${s.scene}`).toMatch(new RegExp(`\\b${s.scene}\\b`));
        for (const f of s.frames ?? []) if (f.scene) expect(scenes, `${id}: сцена ${f.scene}`).toMatch(new RegExp(`\\b${f.scene}\\b`));
        if (s.w) expect(lesson, `${id}: виджет ${s.w}`).toMatch(new RegExp(`WIDGETS[^\\n]*\\b${s.w}\\b`));
        txt.push(...textOf(s));
      }
      const all = txt.join(' ').toLowerCase();
      for (const w of avoid) expect(all, `${id}: «${w}»`).not.toContain(w.toLowerCase());
      expect(txt.join(' '), `${id}: длинное тире`).not.toContain('—');
      expect(txt.join(' '), `${id}: смесь латиницы и кириллицы в слове`).not.toMatch(/[A-Za-z][А-Яа-яӘәІіҢңҒғҮүҰұҚқӨөҺһ]|[А-Яа-яӘәІіҢңҒғҮүҰұҚқӨөҺһ][A-Za-z]/);
    }
  });
  it('новые термины (кері амал, тексеру, теңдік, таразы / тепе-теңдік) есть в glossary.json с пометкой для носителя', () => {
    const terms = (GLOSSARY as any).terms.filter((t: any) => ['кері амал', 'тексеру', 'теңдік', 'таразы / тепе-теңдік'].includes(t.kz));
    expect(terms).toHaveLength(4);
    for (const t of terms) expect(t.note, t.kz).toMatch(/носител/);
  });
  it('ничего не лишнего: нового виджета нет (kz_review.json ведёт отдельный скрипт, C4)', () => {
    for (const id of IDS) for (const s of W[id]) if (s.w) expect(['Scales']).toContain(s.w);
  });
});

// ───────────────────────── перенос: цель = финал, пример другой ─────────────────────────
describe('цель и финал про одну задачу, в примере другая', () => {
  const nums = (t: string) => new Set(t.replace(/(\d) (?=\d{3}(?!\d))/g, '$1').match(/\d+/g) ?? []);
  const exampleText = (ex: any) => JSON.stringify([ex.kz, ex.frames.map((f: any) => [f.kz, f.math ?? '', f.s])]);
  for (const id of IDS) it(`${id}: числа цели не встречаются все вместе в примере; значимые числа цели есть в финале; ответ финала не назван ни в правиле, ни в примере`, () => {
    const goal = W[id][0], fin = W[id].at(-1), ex = one(id, 'example');
    const g = nums(goal.task + ' ' + goal.kz), e = nums(exampleText(ex)), f = nums(fin.kz + JSON.stringify(fin.s) + fin.why);
    expect(g.size).toBeGreaterThan(0);
    expect([...g].filter(x => !e.has(x)).length, `цель ${[...g]} целиком есть в примере`).toBeGreaterThan(0);
    const sig = [...g].filter(x => x.length >= 2), need = sig.length ? sig : [...g];
    expect(need.filter(x => !e.has(x)).length, `значимые ${need} целиком есть в примере`).toBeGreaterThan(0);
    for (const x of need) expect(f.has(x), `«${x}» из цели нет в финале`).toBe(true);
    expect(goal.kz, 'финал = цель по тексту').toBe(fin.kz);
    // ответ финала до финала нигде не называется как результат: ни в правиле, ни в примере, ни в пошаговых
    const ans = fin.choices[fin.answer], before = [...steps(id, 'rule'), ...steps(id, 'example')].flatMap(textOf).join(' ');
    expect(new RegExp(`= \\[?${ans}\\]?(?![\\d,])`).test(before.replace(/\s+/g, ' ')), `ответ ${ans} уже стоит результатом в правиле, примере или пошаговых`).toBe(false);
  });
});

// ───────────────────────── равенства в тексте ─────────────────────────
const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';
const NUM = String.raw`\(?\d+(?:,\d+)?(?:[⁰¹²³⁴⁵⁶⁷⁸⁹]+)?\)?`;
const EXPR = `${NUM}(?: [·:+−] ${NUM})*`;
const EQ = new RegExp(`${EXPR}(?: = ${EXPR})+`, 'g');
const ev = (s: string): number => Function(`return (${s.replace(/·/g, '*').replace(/:/g, '/').replace(/−/g, '-').replace(/,/g, '.')})`)();
const evalSeg = (raw: string): number => {
  let s = raw;
  while ((s.match(/\(/g) ?? []).length > (s.match(/\)/g) ?? []).length) s = s.replace('(', '');
  while ((s.match(/\)/g) ?? []).length > (s.match(/\(/g) ?? []).length) s = s.slice(0, s.lastIndexOf(')')) + s.slice(s.lastIndexOf(')') + 1);
  return ev(s);
};
function badEquation(text: string): string | null {
  const t = text.replace(/[\[\]]/g, '').replace(/(?<![A-Za-z])[a-z] = (?=\d)/g, '');   // «x = 52 − 17 = 35» → «52 − 17 = 35»
  for (const m of t.matchAll(EQ)) {
    // цепочка должна быть целой: слева и справа нет буквы или знака действия («x + 17 = 52», «4n − 3 = 4 · 7 − 3» — уравнения, а не числовые равенства)
    const left = t.slice(0, m.index!).trimEnd().slice(-1), right = t.slice(m.index! + m[0].length).trimStart()[0] ?? '';
    if (/[A-Za-z+−·:=(]/.test(left) || /[A-Za-z+−·:=(]/.test(right)) continue;
    const vals = m[0].split(' = ').map(evalSeg);
    if (vals.some(v => Math.abs(v - vals[0]) > 1e-9)) return `${m[0]} (${vals.join(' ≠ ')})`;
  }
  return null;
}
describe('арифметика в текстах уроков', () => {
  it('самопроверка валидатора', () => {
    expect(badEquation('3 · 6 + 7 = 18 + 7 = 25')).toBeNull();
    expect(badEquation('3 + 5 = 9')).not.toBeNull();
    expect(badEquation('(40 + 8) : 4 = 12')).toBeNull();
    expect(SUP.length).toBe(10);
  });
  for (const id of IDS) it(`${id}: все числовые равенства верны (кроме строк ошибки Глитча)`, () => {
    for (const s of W[id]) {
      const skip = new Set<number>(s.type === 'bug' ? [s.bad, ...(s.follows ?? [])] : []);
      const parts: string[] = s.type === 'bug' ? [s.kz, s.fix, ...s.lines.filter((_: string, i: number) => !skip.has(i))] : textOf(s);
      for (const t of parts) expect(badEquation(t), `${id} [${s.type}]: ${t}`).toBeNull();
    }
  });
  it('пошаговые «E = ▢»: верный вариант равен значению выражения слева', () => {
    for (const id of IDS) for (const s of steps(id, 'faded')) for (const x of s.steps) {
      if (!x.blank) continue;
      const m = new RegExp(`(${EXPR}) = ▢$`).exec(x.math);
      if (!m) continue;
      expect(String(evalSeg(m[1])), `${id}: ${x.math}`).toBe(x.blank.choices[x.blank.answer]);
    }
  });
});

// ───────────────────────── равновесие весов в виджетах ─────────────────────────
describe('виджет Scales: равновесие единственное, «зат» открывается правильным числом', () => {
  const balanced = (weights: number[], object: number) => {
    const sols: string[] = [];
    for (let m = 0; m < 3 ** weights.length; m++) {
      const side = weights.map((_, i) => (['L', 'R', null] as const)[Math.floor(m / 3 ** i) % 3]);
      if (!side.some(Boolean)) continue;
      const t = totals(weights, side as any, object);
      if (t.L === t.R) sols.push(side.map(x => x ?? '-').join(''));
    }
    return sols;
  };
  const eqOfWidget = { 'expr.variables': null, 'eq.linear_basic': 'x + 14 = 41', 'eq.two_step': '2 · x + 3 = 13' } as Record<string, string | null>;
  for (const id of IDS) it(`${id}: ровно одно положение гирь даёт равновесие; на весах скрыт «зат» (hide)`, () => {
    const p = one(id, 'widget').props;
    expect(p.hide).toBe(true); expect(p.pans).toBe('both');
    expect(balanced(p.weights, p.object), id).toHaveLength(1);
    expect(p.weights.length).toBeLessThanOrEqual(3);
  });
  it('условие виджета — это уравнение: eq.linear_basic (x + 14 = 41, x = 27), eq.two_step (2 · x + 3 = 13, зат = 2x = 10, x = 5)', () => {
    const p1 = one('eq.linear_basic', 'widget').props;
    expect(root1(eqOfWidget['eq.linear_basic']!)).toBe(p1.object);
    expect(p1.weights.slice().sort((a: number, b: number) => a - b)).toEqual([14, 41]);
    const p2 = one('eq.two_step', 'widget').props;
    expect(2 * root1(eqOfWidget['eq.two_step']!)).toBe(p2.object);
    expect(p2.weights.slice().sort((a: number, b: number) => a - b)).toEqual([3, 13]);
    // тот же счёт в подписи шага «Болжа»: 13 − 3 = 10, 10 : 2 = 5
    expect(one('eq.two_step', 'predict').reveal).toContain('13 − 3 = 10');
    expect(one('eq.two_step', 'predict').choices[one('eq.two_step', 'predict').answer]).toBe('5 грамм');
    // текст виджета называет те же числа, что props
    expect(one('eq.linear_basic', 'widget').kz).toMatch(/14 граммдық[\s\S]*41 граммдық/);
    expect(one('eq.two_step', 'widget').kz).toMatch(/3 граммдық[\s\S]*13 граммдық/);
  });
});

// ───────────────────────── ответы: буква и выражения ─────────────────────────
describe('expr.variables: ответы пересчитаны', () => {
  it('финал: n = 4, 5n + 2 = 22; ловушки 56 (54 + 2), 20, 30 (5 · (4 + 2)), 11 (5 + 4 + 2); цель = финал', () => {
    const fin = W['expr.variables'].at(-1), goal = W['expr.variables'][0];
    expect(evalExpr('5n + 2', { n: 4 })).toBe(22);
    expect(fin.choices[fin.answer]).toBe('22');
    expect([...fin.choices].sort()).toEqual([String(evalExpr('5n + 2', { n: 4 })), String(54 + 2), String(5 * 4), String(5 * (4 + 2)), String(5 + 4 + 2)].sort());
    expect(goal.task).toContain('n = 4'); expect(goal.task).toContain('5n + 2');
  });
  it('предсказание: 4n при n = 3 — 12, а не 43; ошибка Глитча: 3m + 2 при m = 5 — 17, Глитч получил 37; пример: 3m + 7 при m = 6 → 25, при m = 8 → 31', () => {
    expect(evalExpr('4n', { n: 3 })).toBe(12);
    expect(one('expr.variables', 'predict').reveal).toContain('4 · 3 = 12');
    const bug = one('expr.variables', 'bug');
    expect(evalExpr('3m + 2', { m: 5 })).toBe(17); expect(35 + 2).toBe(37);
    expect(bug.lines[3]).toBe('Жауабы: 37'); expect(bug.fix).toContain('15 + 2 = 17');
    expect(evalExpr('3m + 7', { m: 6 })).toBe(25); expect(evalExpr('3m + 7', { m: 8 })).toBe(31);
    expect(evalExpr('20 − 2n', { n: 3 })).toBe(14);
  });
  it('пошаговые: 4n − 3 при n = 7 → 25; 3n + 5 при n = 6 → 23; «неге?» 3n + 4: n = 5 → 19, n = 10 → 34; правило 3m + 2: m = 5 → 17, m = 10 → 32', () => {
    expect(evalExpr('4n − 3', { n: 7 })).toBe(25); expect(evalExpr('3n + 5', { n: 6 })).toBe(23);
    const why = one('expr.variables', 'why').why;
    expect(evalExpr('3n + 4', { n: 5 })).toBe(19); expect(why).toContain('n = 5 болса 19');
    expect(evalExpr('3n + 4', { n: 10 })).toBe(34); expect(why).toContain('34');
    const rule = one('expr.variables', 'rule').lines.join(' ');
    expect(evalExpr('3m + 2', { m: 10 })).toBe(32); expect(rule).toContain('17'); expect(rule).toContain('32');
  });
  it('мини-игра: значение выражения и составление выражения пересчитаны, верный вариант единственный', () => {
    const r = rng(101), b = one('expr.variables', 'blitz'); let sub = 0, two = 0, words = 0;
    for (let k = 0; k < 3000; k++) {
      const it = b.make(r), right = it.choices[it.answer];
      let m: RegExpExecArray | null;
      if ((m = /^([a-z]) = (\d+)\. (.+) = \?$/.exec(it.q))) {
        sub++; const want = evalExpr(m[3], { [m[1]]: +m[2] });
        expect(+right, it.q).toBe(want); expect(it.choices.filter((c: string) => +c === want), it.q).toHaveLength(1);
      } else if ((m = /^([a-z]) = (\d+), ([a-z]) = (\d+)\. (.+) = \?$/.exec(it.q))) {
        two++; const want = evalExpr(m[5], { [m[1]]: +m[2], [m[3]]: +m[4] });
        expect(+right, it.q).toBe(want); expect(it.choices.filter((c: string) => +c === want), it.q).toHaveLength(1);
      } else {
        words++;
        const body = it.q.replace(/ Өрнекті таңда\.$/, ''), v = body.match(LETTER)![0];
        const f = /Екі қорапта|бөлек жатыр|есе көп[\s\S]*алды/.test(body) ? compose2(body) : compose1(body);
        const same = (c: string) => [7, 11, 13, 17].every(n => Math.abs(evalExpr(c, { [v]: n }) - f(n)) < 1e-9);
        expect(same(right), `${body} → ${right}`).toBe(true);
        expect(it.choices.filter(same), body).toHaveLength(1);
      }
    }
    expect(sub).toBeGreaterThan(800); expect(two).toBeGreaterThan(300); expect(words).toBeGreaterThan(1000);
  });
});

// ───────────────────────── ответы: простые уравнения ─────────────────────────
describe('eq.linear_basic: корни пересчитаны перебором', () => {
  const f = (id: string, type: string) => one(id, type);
  it('финал: x + 17 = 52 → 35, единственный корень; ловушки 69 (52 + 17), 52, 17, 36; цель = финал', () => {
    const fin = W['eq.linear_basic'].at(-1);
    expect(root1('x + 17 = 52')).toBe(35);
    expect(fin.choices[fin.answer]).toBe('35');
    expect([...fin.choices].sort()).toEqual(['35', String(52 + 17), '52', '17', '36'].sort());
    expect(W['eq.linear_basic'][0].task).toContain('x + 17 = 52');
    for (const c of fin.choices) expect(Math.abs(evalExpr('x + 17', { x: +c }) - 52) < 1e-9, c).toBe(c === '35');
  });
  it('пример: x + 25 = 71 → 46; x − 18 = 30 → 48; 6 · x = 54 → 9; x : 7 = 8 → 56; 50 − x = 18 → 32; подписи называют те же числа', () => {
    const fr = f('eq.linear_basic', 'example').frames as any[], cap = fr.map(x => x.kz + ' ' + (x.math ?? '') + ' ' + x.s.math).join(' ');
    expect(root1('x + 25 = 71')).toBe(46); expect(cap).toContain('71 − 25 = 46'); expect(cap).toContain('x = 46');
    expect(root1('x − 18 = 30')).toBe(48); expect(cap).toContain('x = 30 + 18 = 48');
    expect(root1('6 · x = 54')).toBe(9); expect(cap).toContain('x = 54 : 6 = 9');
    expect(root1('x : 7 = 8')).toBe(56); expect(cap).toContain('x = 8 · 7 = 56');
    expect(root1('50 − x = 18')).toBe(32); expect(cap).toContain('x = 50 − 18 = 32');
    for (const x of fr) if (x.s.math.includes('=') && /[a-z]/.test(x.s.math) && !x.s.math.includes(' − 25 =') ) { const eq = x.s.math; if (/^x = /.test(eq)) continue; expect(roots(eq).length, eq).toBe(1); }
  });
  it('пошаговые: x + 38 = 91 → 53; 7 · x = 63 → 9; предсказание и «неге?»: x + 5 = 12 → 7', () => {
    expect(root1('x + 38 = 91')).toBe(53); expect(root1('7 · x = 63')).toBe(9); expect(root1('x + 5 = 12')).toBe(7);
    expect(one('eq.linear_basic', 'why').why).toContain('x = 7');
  });
  it('ошибка Глитча: 40 − x = 15 → 25 (а не 55: 40 − 55 не бывает); проверка подстановкой названа', () => {
    expect(root1('40 − x = 15')).toBe(25);
    const bug = one('eq.linear_basic', 'bug');
    expect(bug.lines[2]).toBe('x = 40 + 15 = 55'); expect(bug.fix).toContain('x = 40 − 15 = 25'); expect(bug.fix).toContain('40 − 25 = 15');
    expect(roots('40 − x = 55')).toEqual([]);
  });
  it('правило: каждое «P болса, x = …» верно', () => {
    const rule = one('eq.linear_basic', 'rule').lines.join(' ');
    for (const [eq, x] of [['x + 6 = 20', 14], ['x − 6 = 20', 26], ['6 · x = 24', 4], ['x : 6 = 4', 24], ['20 − x = 6', 14]] as [string, number][]) {
      expect(root1(eq), eq).toBe(x); expect(rule, eq).toContain(eq);
    }
    expect(rule).toContain('x = 20 − 6');
  });
  it('мини-игра: корни пересчитаны; выбор «какое действие» совпадает с обратным; верный вариант единственный', () => {
    const r = rng(102), b = one('eq.linear_basic', 'blitz'); let eqs = 0, which = 0;
    for (let k = 0; k < 3000; k++) {
      const it = b.make(r), right = it.choices[it.answer], m = /^(.+)\. ([a-z]) = \?$/.exec(it.q)!, eq = m[1];
      const x = root1(eq);
      if (/^\d+ [−:] \d+$|^\d+ [+·] \d+$/.test(right) && !/^\d+$/.test(right)) {
        which++;
        expect(evalExpr(right, {}), it.q).toBeCloseTo(x, 9);
        expect(it.choices.filter((c: string) => Math.abs(evalExpr(c, {}) - x) < 1e-9), it.q).toHaveLength(1);
      } else {
        eqs++; expect(+right, it.q).toBe(x);
        expect(it.choices.filter((c: string) => +c === x), it.q).toHaveLength(1);
        it.choices.forEach((c: string) => { if (+c !== x) expect(roots(eq).includes(+c), `${it.q}: ${c}`).toBe(false); });
      }
    }
    expect(eqs).toBeGreaterThan(1500); expect(which).toBeGreaterThan(400);
  });
});

// ───────────────────────── ответы: двухшаговые ─────────────────────────
describe('eq.two_step: корни пересчитаны перебором', () => {
  it('финал: 4 · x + 8 = 40 → 8, единственный корень; ловушки 32 (40 − 8), 2 (40 : 4 − 8), 12 ((40 + 8) : 4), 10 (40 : 4); цель = финал', () => {
    const fin = W['eq.two_step'].at(-1);
    expect(root1('4 · x + 8 = 40')).toBe(8);
    expect(fin.choices[fin.answer]).toBe('8');
    expect([...fin.choices].sort()).toEqual(['8', String(40 - 8), String(40 / 4 - 8), String((40 + 8) / 4), String(40 / 4)].sort());
    for (const c of fin.choices) expect(Math.abs(4 * +c + 8 - 40) < 1e-9, c).toBe(c === '8');
    expect(W['eq.two_step'][0].task).toContain('4 · x + 8 = 40');
  });
  it('пример: 5 · x + 4 = 49 → 9; 3 · x − 8 = 31 → 13; x : 4 + 6 = 15 → 36; подписи называют те же числа', () => {
    const cap = (one('eq.two_step', 'example').frames as any[]).map(x => x.kz + ' ' + (x.math ?? '') + ' ' + x.s.math).join(' ');
    expect(root1('5 · x + 4 = 49')).toBe(9); expect(cap).toContain('49 − 4 = 45'); expect(cap).toContain('x = 45 : 5 = 9'); expect(cap).toContain('5 · 9 + 4 = 49');
    expect(root1('3 · x − 8 = 31')).toBe(13); expect(cap).toContain('31 + 8 = 39'); expect(cap).toContain('x = 39 : 3 = 13');
    expect(root1('x : 4 + 6 = 15')).toBe(36); expect(cap).toContain('15 − 6 = 9'); expect(cap).toContain('x = 9 · 4 = 36');
  });
  it('пошаговые: 2 · x + 9 = 31 → 11; x : 3 − 4 = 8 → 36; «неге?»: 3 · x + 5 = 20 → 5; предсказание: 2 · x + 3 = 13 → x = 5', () => {
    expect(root1('2 · x + 9 = 31')).toBe(11); expect(root1('x : 3 − 4 = 8')).toBe(36); expect(root1('3 · x + 5 = 20')).toBe(5); expect(root1('2 · x + 3 = 13')).toBe(5);
    expect(one('eq.two_step', 'why').why).toContain('20 − 5 = 15, 15 : 3 = 5');
  });
  it('ошибка Глитча: 3 · x + 6 = 24 → 6; Глитч получил 2 (делил только 24 на 3), при x = 2 левая часть 12', () => {
    expect(root1('3 · x + 6 = 24')).toBe(6);
    expect(24 / 3 - 6).toBe(2); expect(3 * 2 + 6).toBe(12);
    const bug = one('eq.two_step', 'bug');
    expect(bug.lines[1]).toBe('Екі жағын да 3-ке бөлеміз: x + 6 = 8'); expect(bug.fix).toContain('24 − 6 = 18, 18 : 3 = 6'); expect(bug.fix).toContain('3 · 6 + 6 = 24');
  });
  it('правило: 2 · x + 3 = 13 → 5; 3 · x − 4 = 14 → 6; x : 4 + 2 = 9 → 28', () => {
    const rule = one('eq.two_step', 'rule').lines.join(' ');
    for (const [eq, x] of [['2 · x + 3 = 13', 5], ['3 · x − 4 = 14', 6], ['x : 4 + 2 = 9', 28]] as [string, number][]) expect(root1(eq), eq).toBe(x);
    expect(rule).toContain('13 − 3 = 10, 10 : 2 = 5'); expect(rule).toContain('14 + 4 = 18, 18 : 3 = 6'); expect(rule).toContain('9 − 2 = 7, 7 · 4 = 28');
  });
  it('мини-игра: корни и «первый шаг» пересчитаны независимо; верный вариант единственный', () => {
    const r = rng(103), b = one('eq.two_step', 'blitz'); let eqs = 0, first = 0;
    for (let k = 0; k < 3000; k++) {
      const it = b.make(r), right = it.choices[it.answer];
      if (it.q.includes('Бірінші қадам')) {
        first++;
        const eq = it.q.split('. Бірінші')[0], x = root1(eq), [l] = sides(eq), mul = !/[a-z] : \d/.test(l), cm = mul ? /(\d+) · [a-z]|(\d+)(?=[a-z])/.exec(l)! : /[a-z] : (\d+)/.exec(l)!, coef = +(cm[1] ?? cm[2]);   // коэффициент стоит при букве, слагаемое может быть слева
        const mid = mul ? coef * x : x / coef;                   // после первого шага остаётся a · x (или x : a)
        expect(evalExpr(right, {}), it.q).toBe(mid);
        expect(it.choices.filter((c: string) => evalExpr(c, {}) === mid), it.q).toHaveLength(1);
      } else {
        eqs++;
        const eq = /^(.+)\. [a-z] = \?$/.exec(it.q)![1], x = root1(eq);
        expect(+right, it.q).toBe(x); expect(it.choices.filter((c: string) => +c === x), it.q).toHaveLength(1);
        it.choices.forEach((c: string) => { if (+c !== x) expect(roots(eq).includes(+c), `${it.q}: ${c}`).toBe(false); });
      }
    }
    expect(eqs).toBeGreaterThan(1800); expect(first).toBeGreaterThan(500);
  });
});

// ───────────────────────── голос ─────────────────────────
describe('голос: реплики будущей озвучки собираются без цифр, латиницы и закрытых ответов', () => {
  const mine = Object.fromEntries(IDS.map(id => [id, L[id]]));
  const lines: { id: string; kz: string }[] = buildLines(mine, planGaps);
  const byId = new Map(lines.map(l => [l.id, l.kz]));
  it('все шаги озвученных типов собраны; id вида <skill>_<i>[_f<k>|_why|_reveal|_full]', () => {
    for (const { id } of lines) expect(id, id).toMatch(/^[a-z_]+\.[a-z_0-9]+_\d+(?:_f\d+|_why|_reveal|_full)?$/);
    for (const [skill, st] of Object.entries(mine)) st.forEach((s, i) => {
      const id = `${skill}_${i}`;
      if (['goal', 'widget', 'faded', 'bug', 'rule', 'why', 'predict', 'final'].includes(s.type)) expect(byId.has(id), id).toBe(true);
      if (s.type === 'predict') expect(byId.has(`${id}_reveal`)).toBe(true);
      if (s.type === 'why') expect(byId.has(`${id}_why`)).toBe(true);
      if (s.type === 'final' && s.why) expect(byId.has(`${id}_why`)).toBe(true);
    });
  });
  it('нет цифр, «[ ]», «▢», LaTeX, латиницы, слова undefined; текст не пустой; знаки, которые Piper не произносит, заменены', () => {
    for (const { id, kz } of lines) {
      expect(kz.trim().length, `${id}: пусто`).toBeGreaterThan(5);
      expect(kz, `${id}: цифры`).not.toMatch(/\d/);
      expect(kz, `${id}: скобки подсветки или пропуск`).not.toMatch(/[\[\]▢]/);
      expect(kz, `${id}: LaTeX/markdown`).not.toMatch(/[\\$`#*_{}^~|]/);
      expect(kz, `${id}: латиница`).not.toMatch(/[A-Za-z]/);
      expect(kz, `${id}: undefined`).not.toMatch(/undefined|NaN/);
      expect(kz, `${id}: знаки, которые Piper не произносит`).not.toMatch(/[×≤≥≈∩∪²³ⁿ−–+=<>/→≠※]/);
    }
  });
  it('буквы-переменные и число при букве читаются по-казахски: 5n → «бес эн», x : 4 + 6 = 15, a · x + b = c, суффикс после цифры', () => {
    expect(speakable('5n + 2')).toBe('бес эн қосу екі');
    expect(speakable('3x − 4y')).toBe('үш икс минус төрт игрек');
    expect(speakable('4 · x + 8 = 40')).toBe('төрт көбейту икс қосу сегіз тең қырық');
    expect(speakable('x : 4 + 6 = 15')).toBe('икс бөлу төрт қосу алты тең он бес');
    expect(speakable('a · x + b = c болса')).toBe('а көбейту икс қосу бэ тең цэ болса');
    expect(speakable('x 6-ға көбейтілген')).toBe('икс алтыға көбейтілген');
    expect(speakable('50 − x = 18')).toBe('елу минус икс тең он сегіз');
  });
  it('правила с пропуском: голос до решения не называет ответ, полная версия отдельно; без пропуска _full нет', () => {
    for (const [skill, st] of Object.entries(mine)) st.forEach((s, i) => {
      if (s.type !== 'rule') return;
      const g = planGaps(skill, i, s)?.rule, id = `${skill}_${i}`;
      if (!g) { expect(byId.has(`${id}_full`), id).toBe(false); return; }
      const base = byId.get(id)!, full = byId.get(`${id}_full`)!;
      expect(full, `нет ${id}_full`).toBeTruthy(); expect(base).toContain(UNKNOWN); expect(full).not.toContain(UNKNOWN);
      expect(numeralLeak(base, g.gap.answer), `база называет ответ ${g.gap.answer}: «${base}»`).toBeNull();
    });
  });
  it('кадры «Көр»: озвучиваются только кадры со сценой; пропуски в кадрах не называют закрытое число (кроме masked-подписи)', () => {
    for (const [skill, st] of Object.entries(mine)) st.forEach((s, i) => { if (s.type === 'example') s.frames.forEach((_: any, k: number) => expect(byId.has(`${skill}_${i}_f${k}`)).toBe(true)); });
    for (const id of IDS) {
      const i = L[id].findIndex(s => s.type === 'example'), gaps = planGaps(id, i, L[id][i])?.frames ?? [];
      expect(gaps.filter(Boolean).length, `${id}: в примере нет ни одного пропуска`).toBeGreaterThanOrEqual(2);
    }
  });
  it('все озвучиваемые реплики: нет «5n»-слитных и других необработанных обрывков; суффиксы к цифрам стоят через дефис', () => {
    for (const { id, kz } of lines) expect(kz, id).not.toMatch(/\d|[A-Za-z]|--/);
  });
});
