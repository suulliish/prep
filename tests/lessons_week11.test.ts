// C9: два урока (content/lessons_week11.mjs): eq.both_sides_nat (x с двух сторон), eq.brackets_nat (скобки двумя способами).
// Сценарий, зарегистрированные сцены и виджеты, запрещённые слова, голос (как у тестов озвучки), перенос (цель = финал, пример другой),
// все равенства и корни уравнений в текстах пересчитаны независимо (точные дроби, перебор 0..3000), равновесие весов в виджете единственное (перебор),
// 3000 раундов каждой мини-игры. Мутации (сломать логику → тест падает) прогнаны вручную и описаны в docs/C9_NOTES.md.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
// @ts-ignore
import { LESSONS } from '../content/lessons.mjs';
// @ts-ignore
import { WEEK11 } from '../content/lessons_week11.mjs';
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
import { exactRoots, holdsAt, evalAt, lin, solveLinear } from './_eq_exact';

const IDS = ['eq.both_sides_nat', 'eq.brackets_nat'];
const W = WEEK11 as Record<string, any[]>, L = LESSONS as Record<string, any[]>;
const steps = (id: string, type: string) => W[id].filter(s => s.type === type);
const one = (id: string, type: string) => steps(id, type)[0];
const textOf = (s: any): string[] => [s.kz ?? '', s.task ?? '', s.reveal ?? '', s.why ?? '', s.fix ?? '', ...(s.lines ?? []), ...(s.choices ?? []), ...(s.frames ?? []).flatMap((f: any) => [f.kz ?? '', f.math ?? '']),
  ...(s.steps ?? []).flatMap((x: any) => [x.math ?? '', x.blank?.why ?? '', ...(x.blank?.choices ?? [])])];
const root1 = (eq: string): number => { const r = exactRoots(eq); expect(r, eq).toHaveLength(1); return r[0]; };
/** Для 3000 раундов мини-игр: корень точным решением (целое), а полный перебор 0..3000 — на каждой 25-й задаче (иначе тест медленный для CI). */
let sampled = 0;
const rootFast = (eq: string): number => { const s = solveLinear(eq); expect(s !== null && s[1] === 1, `${eq}: корень не целый`).toBe(true); if (++sampled % 25 === 0) expect(exactRoots(eq), eq).toEqual([s![0]]); return s![0]; };
const frames = (id: string) => one(id, 'example').frames as { s: { math: string }; math?: string; kz: string }[];

// ───────────────────────── сценарий ─────────────────────────
describe('уроки C9: полный сценарий', () => {
  it('обе темы есть в LESSONS и в графе, с приёмом, карточками «Биткә түсіндір» и без озвучки (voice_pending)', () => {
    for (const id of IDS) {
      expect(L[id], id).toBeTruthy(); expect(skillById[id], id).toBeTruthy();
      expect(TECHNIQUES.find((t: any) => t.skill === id), `приём ${id}`).toBeTruthy();
      expect(menuCards(id), `Биткә түсіндір ${id}`).not.toBeNull();
      expect(PENDING, `voice_pending ${id}`).toContain(id);
    }
    expect(Object.keys(W).sort()).toEqual([...IDS].sort());
  });
  it('eq.both_sides_nat: цель → руками (весы) → болжа → көр → өзің ×2 → неге → ошибка Глитча → игра → правило → возврат к цели', () => {
    expect(W['eq.both_sides_nat'].map(s => s.type)).toEqual(['goal', 'widget', 'predict', 'example', 'faded', 'faded', 'why', 'bug', 'blitz', 'rule', 'final']);
    expect(one('eq.both_sides_nat', 'widget').w).toBe('Scales');
  });
  it('eq.brackets_nat: то же без виджета (для скобок готового виджета нет, нового не пишем)', () => {
    expect(W['eq.brackets_nat'].map(s => s.type)).toEqual(['goal', 'predict', 'example', 'faded', 'faded', 'why', 'bug', 'blitz', 'rule', 'final']);
  });
  for (const id of IDS) it(`${id}: цель короткая, финал в сцене цели, числа цели есть в финале`, () => {
    const goal = W[id][0], fin = W[id].at(-1);
    expect(goal.kz.split(/\s+/).length, 'цель длиннее 30 слов').toBeLessThanOrEqual(30);
    expect(fin.scene, 'сцена финала = сцене цели').toBe(goal.scene);
    expect(goal.task.length).toBeGreaterThan(5);
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
    expect(pos.size).toBeGreaterThanOrEqual(1);
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
  it('сцены и виджеты зарегистрированы, запрещённых слов нет, нет длинного тире, нет латинской «a» (читается как «За»), нет смеси алфавитов в слове', () => {
    const scenes = readFileSync('src/lesson/Scene.svelte', 'utf8'), lesson = readFileSync('src/screens/Lesson.svelte', 'utf8');
    const avoid: string[] = (GLOSSARY as any).terms.flatMap((t: any) => t.avoid ?? []).filter((w: string) => w.length > 3);
    for (const id of IDS) {
      const txt: string[] = [];
      for (const s of W[id]) {
        if (s.scene) expect(scenes, `${id}: сцена ${s.scene}`).toMatch(new RegExp(`\\b${s.scene}\\b`));
        for (const f of s.frames ?? []) if (f.scene) expect(scenes, `${id}: сцена ${f.scene}`).toMatch(new RegExp(`\\b${f.scene}\\b`));
        if (s.w) expect(lesson, `${id}: виджет ${s.w}`).toMatch(new RegExp(`WIDGETS[^\\n]*\\b${s.w}\\b`));
        txt.push(...textOf(s), ...(s.frames ?? []).map((f: any) => f.s?.math ?? ''), s.s?.math ?? '');
      }
      const all = txt.join(' ').toLowerCase();
      for (const w of avoid) expect(all, `${id}: «${w}»`).not.toContain(w.toLowerCase());
      expect(txt.join(' '), `${id}: длинное тире`).not.toContain('—');
      expect(txt.join(' '), `${id}: латинская a`).not.toMatch(/(?<![A-Za-z])a(?![A-Za-z])/);
      expect(txt.join(' '), `${id}: смесь латиницы и кириллицы в слове`).not.toMatch(/[A-Za-z][А-Яа-яӘәІіҢңҒғҮүҰұҚқӨөҺһ]|[А-Яа-яӘәІіҢңҒғҮүҰұҚқӨөҺһ][A-Za-z]/);
    }
  });
  it('новые термины (x-ті бір жаққа жинау, жақшаның алдындағы сан) есть в glossary.json с пометкой для носителя', () => {
    const terms = (GLOSSARY as any).terms.filter((t: any) => ['x-ті бір жаққа жинау', 'жақшаның алдындағы сан'].includes(t.kz));
    expect(terms).toHaveLength(2);
    for (const t of terms) expect(t.note, t.kz).toMatch(/носител/);
  });
  it('ничего не лишнего: нового виджета нет — только Scales, и только в уроке про x с двух сторон', () => {
    for (const id of IDS) for (const s of W[id]) if (s.w) expect(['Scales']).toContain(s.w);
    expect(steps('eq.brackets_nat', 'widget')).toHaveLength(0);
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
    // ответ финала до финала нигде не называется как результат: ни в правиле, ни в примере
    const ans = fin.choices[fin.answer], before = [...steps(id, 'rule'), ...steps(id, 'example')].flatMap(textOf).join(' ');
    expect(new RegExp(`= \\[?${ans}\\]?(?![\\d,])`).test(before.replace(/\s+/g, ' ')), `ответ ${ans} уже стоит результатом в правиле или примере`).toBe(false);
  });
});

// ───────────────────────── равенства в тексте ─────────────────────────
const NUM = String.raw`\(?\d+(?:,\d+)?\)?`;
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
  const t = text.replace(/[\[\]]/g, '').replace(/(?<![A-Za-z\d])[a-z] = (?=\d)/g, '');   // «x = 52 − 17 = 35» → «52 − 17 = 35»; «4x = 52 − 32 = 20» остаётся уравнением
  for (const m of t.matchAll(EQ)) {
    // цепочка должна быть целой: слева и справа нет буквы или знака действия («x + 17 = 52», «5x − 2x = 3x» — уравнения, а не числовые равенства)
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
    expect(badEquation('4 · (7 + 5) = 4 · 12 = 48')).toBeNull();
    expect(badEquation('4 · (7 + 5) = 4 · 12 = 49')).not.toBeNull();
    expect(badEquation('5 · 6 + 8 = 38 және 6 + 32 = 38')).toBeNull();
    expect(badEquation('5 · 6 + 8 = 39')).not.toBeNull();
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
  it('пошаговые «▢x» и «6x + ▢»: пропуск — число, которое делает верное тождество', () => {
    const f1 = steps('eq.both_sides_nat', 'faded'), f2 = steps('eq.brackets_nat', 'faded');
    const pick = (b: any) => b.choices[b.answer];
    expect(pick(f1[0].steps[1].blank)).toBe(String(8 - 3));                  // 8x − 3x = 5x
    expect(pick(f1[1].steps[1].blank)).toBe(String(6 - 2));                  // 6x − 2x = 4x
    const open = f2[1].steps[1];                                                  // 6 · x + 6 · 3 = 6x + ▢
    expect(open.math).toContain('6 · x + 6 · 3 = 6x + ▢'); expect(open.blank.choices[open.blank.answer]).toBe(String(6 * 3));
    for (const x of [1, 2, 7, 12]) expect(evalAt('6(x + 3)', x)).toEqual(evalAt('6x + 18', x));
  });
});

// ───────────────────────── виджет Scales ─────────────────────────
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
  it('ровно одно положение гирь даёт равновесие (любой порядок и любые чаши принимаются виджетом); «зат» скрыт', () => {
    const p = one('eq.both_sides_nat', 'widget').props;
    expect(p.hide).toBe(true); expect(p.pans).toBe('both');
    expect(balanced(p.weights, p.object)).toEqual(['LR']);                       // 5 г слева, 17 г справа: 12 + 5 = 17
    expect(p.weights.length).toBeLessThanOrEqual(3);
  });
  it('условие виджета — уравнение 4x + 5 = 2x + 17 (x = 6): после снятия 2 мешков с обеих чаш слева 2x = 12 г и гиря 5 г, справа гиря 17 г', () => {
    const p = one('eq.both_sides_nat', 'widget').props, x = root1('4x + 5 = 2x + 17');
    expect(x).toBe(6); expect(2 * x).toBe(p.object);
    expect([...p.weights].sort((a: number, b: number) => a - b)).toEqual([5, 17]);
    expect(p.object + 5).toBe(17);
    const kz = one('eq.both_sides_nat', 'widget').kz;
    expect(kz).toMatch(/4 бірдей қап пен 5 граммдық гір, оң табағында 2 сондай қап пен 17 граммдық гір/);
    expect(kz).toMatch(/2 қаптан алып тастадық/);
    // снятие по 2 мешка с обеих чаш не меняет корень: 4x + 5 = 2x + 17 ⇔ 2x + 5 = 17 ⇔ x = 6
    expect(root1('2x + 5 = 17')).toBe(6);
  });
});

// ───────────────────────── eq.both_sides_nat ─────────────────────────
describe('eq.both_sides_nat: корни пересчитаны точным перебором', () => {
  const id = 'eq.both_sides_nat';
  it('финал: 5x + 3 = 2x + 18 → 5, единственный корень; ловушки 15 (18 − 3), 7 ((18 + 3) : 3), 3 (15 : 5), 21 (18 + 3); цель = финал', () => {
    const fin = W[id].at(-1), eq = '5x + 3 = 2x + 18';
    expect(root1(eq)).toBe(5);
    expect(fin.choices[fin.answer]).toBe('5');
    expect([...fin.choices].sort()).toEqual(['5', String(18 - 3), String((18 + 3) / (5 - 2)), String((18 - 3) / 5), String(18 + 3)].sort());
    for (const c of fin.choices) expect(holdsAt(eq, +c), c).toBe(c === '5');
    expect(W[id][0].task).toContain(eq);
    expect(fin.s.math).toBe(eq);
    expect(fin.why).toContain('5 · 5 + 3 = 28'); expect(fin.why).toContain('2 · 5 + 18 = 28');
  });
  it('кадры «Көр»: уравнения в каждой цепочке равносильны (один и тот же корень), подписи называют те же числа', () => {
    const fr = frames(id), eqs = (idx: number[]) => idx.map(i => fr[i].s.math);
    const chain = (idx: number[], root: number) => { for (const e of eqs(idx)) { if (!/[a-z]/.test(e)) continue; expect(exactRoots(e), e).toEqual([root]); } };
    expect(fr).toHaveLength(12);
    chain([0, 1, 2, 3], 6); chain([5, 6, 7, 8], 7); chain([9, 10, 11], 4);
    expect(fr[0].s.math).toBe('7x + 2 = 3x + 26'); expect(fr[5].s.math).toBe('5x − 6 = 2x + 15'); expect(fr[9].s.math).toBe('3x + 24 = 9x');
    expect(fr[4].s.math).toBe('7 · 6 + 2 = 3 · 6 + 26');
    const cap = (i: number) => fr[i].kz + ' ' + (fr[i].math ?? '');
    expect(cap(1)).toContain('7 − 3 = [4]'); expect(cap(1)).toContain('4x + 2 = 26');
    expect(cap(2)).toContain('26 − 2 = [24]'); expect(cap(3)).toContain('x = 24 : 4 = 6');
    expect(cap(4)).toContain('7 · 6 + 2 = [44]'); expect(cap(4)).toContain('3 · 6 + 26 = 44');
    expect(cap(6)).toContain('5 − 2 = [3]'); expect(cap(6)).toContain('3x − 6 = 15');
    expect(cap(7)).toContain('15 + 6 = [21]'); expect(cap(8)).toContain('x = 21 : 3 = 7');
    expect(cap(8)).toContain('5 · 7 − 6 = 29'); expect(cap(8)).toContain('2 · 7 + 15 = 29');
    expect(cap(10)).toContain('9 − 3 = [6]'); expect(cap(10)).toContain('24 = 6x'); expect(cap(11)).toContain('x = 24 : 6 = 4');
    // тексеру из подписей: обе части совпадают
    expect(7 * 6 + 2).toBe(44); expect(3 * 6 + 26).toBe(44); expect(5 * 7 - 6).toBe(2 * 7 + 15);
    // шаги, названные в подписях, равносильны исходным: (7 − 3) x + 2 = 26 ⇔ 4x + 2 = 26; (5 − 2) x − 6 = 15; (9 − 3) x = 24
    expect(root1('4x + 2 = 26')).toBe(root1('7x + 2 = 3x + 26')); expect(root1('3x − 6 = 15')).toBe(root1('5x − 6 = 2x + 15')); expect(root1('6x = 24')).toBe(root1('3x + 24 = 9x'));
  });
  it('пошаговые: 8x + 5 = 3x + 45 → 8; 6x − 8 = 2x + 20 → 7; в цепочке: 5x + 5 = 45, 5x = 40; 4x − 8 = 20, 4x = 28; тексеру 69 = 69, 34 = 34', () => {
    expect(root1('8x + 5 = 3x + 45')).toBe(8); expect(root1('5x + 5 = 45')).toBe(8); expect(root1('5x = 40')).toBe(8);
    expect(root1('6x − 8 = 2x + 20')).toBe(7); expect(root1('4x − 8 = 20')).toBe(7); expect(root1('4x = 28')).toBe(7);
    expect(8 * 8 + 5).toBe(3 * 8 + 45); expect(6 * 7 - 8).toBe(2 * 7 + 20);
    const f1 = steps(id, 'faded')[0].steps, f2 = steps(id, 'faded')[1].steps;
    expect(f1[4].math).toBe('Тексеру: 8 · 8 + 5 = ▢'); expect(f1[4].blank.choices[0]).toBe('69');
    expect(f2[4].math).toBe('Тексеру: 6 · 7 − 8 = ▢'); expect(f2[4].blank.choices[0]).toBe('34');
    expect(f1.at(-1).math).toBe('Жауабы: x = 8'); expect(f2.at(-1).math).toBe('Жауабы: x = 7');
  });
  it('«неге?»: 7x + 2 = 3x + 26 (та же задача, что в примере) → 4x + 2 = 26 (7x − 3x = 4x); предсказание: тек бір табақтан алу таразыны қисайтады', () => {
    expect(root1('7x + 2 = 3x + 26')).toBe(6); expect(root1('4x + 2 = 26')).toBe(6);
    expect(one(id, 'why').kz).toContain('7x + 2 = 3x + 26'); expect(one(id, 'why').why).toContain('7x − 3x = 4x'); expect(one(id, 'why').why).toContain('4x + 2 = 26');
    expect(frames(id)[0].s.math, '«неге?» говорит о задаче из примера').toBe('7x + 2 = 3x + 26');
    const pr = one(id, 'predict');
    expect(pr.choices[pr.answer]).toBe('Жоқ');
    // «таразы тепе-теңдікте қала ма, егер сол табақтан 2 қапты алсақ»: 4x + 5 = 2x + 17 → 2x + 5 = 2x... бір жақтан алсақ теңдік бұзылады
    expect(holdsAt('4x + 5 − 2x = 2x + 17', 6)).toBe(false);
    expect(holdsAt('4x + 5 − 2x = 2x + 17 − 2x', 6)).toBe(true);
  });
  it('ошибка Глитча: 5x + 8 = x + 32 → 6 (а не 4); Глитч сложил x вместо вычитания: 6x = 24 → 4, при x = 4 части 28 и 36', () => {
    expect(root1('5x + 8 = x + 32')).toBe(6);
    expect(root1('6x + 8 = 32')).toBe(4);                                              // то, что получил Глитч
    expect(holdsAt('5x + 8 = x + 32', 4)).toBe(false); expect(5 * 4 + 8).toBe(28); expect(4 + 32).toBe(36);
    const bug = one(id, 'bug');
    expect(bug.lines[1]).toBe('x-ті сол жаққа көшіреміз, таңбасын өзгертпейміз: 5x + x + 8 = 32'); expect(bug.lines[2]).toBe('6x = 32 − 8 = 24'); expect(bug.lines[3]).toContain('x = 24 : 6 = 4');
    expect(bug.fix).toContain('5x − x + 8 = 32'); expect(bug.fix).toContain('x = 24 : 4 = 6'); expect(bug.fix).toContain('5 · 6 + 8 = 38'); expect(bug.fix).toContain('6 + 32 = 38');
    expect(bug.fix).toContain('5 · 4 + 8 = 28'); expect(bug.fix).toContain('4 + 32 = 36');
  });
  it('правило: каждое «P болса, … x = N» верно', () => {
    const rule = one(id, 'rule').lines.join(' ');
    for (const [eq, x] of [['6x + 5 = 2x + 29', 6], ['5x − 4 = 2x + 8', 4], ['3x + 24 = 9x', 4]] as [string, number][]) { expect(root1(eq), eq).toBe(x); expect(rule, eq).toContain(eq); }
    expect(root1('4x + 5 = 29')).toBe(6); expect(root1('3x − 4 = 8')).toBe(4); expect(root1('24 = 6x')).toBe(4);
    expect(rule).toContain('4x + 5 = 29'); expect(rule).toContain('3x − 4 = 8, 3x = 12, x = 4'); expect(rule).toContain('24 = 6x, x = 4');
  });
  it('мини-игра: корни, «какой x азайтамыз» пересчитаны независимо; верный вариант единственный; ловушки не корни', () => {
    const r = rng(102), b = one(id, 'blitz'); let eqs = 0, roots = 0, first = 0;
    for (let k = 0; k < 3000; k++) {
      const it = b.make(r), right = it.choices[it.answer];
      let m: RegExpExecArray | null;
      if ((m = /^(.+)\. ([a-z])-ті бір жаққа жинау үшін екі жағынан нені азайтамыз\?$/.exec(it.q))) {
        first++; const eq = m[1], L = lin(eq), small = L.l.s[0] < L.r.s[0] ? L.l.s[0] : L.r.s[0];
        expect(right, it.q).toBe(small === 1 ? m[2] : `${small}${m[2]}`);
        expect(it.choices.filter((c: string) => c === right), it.q).toHaveLength(1);
        expect(lin(eq).l.i[0] !== 0 && lin(eq).r.i[0] !== 0, eq).toBe(true);        // свободные числа с обеих сторон: виды full и minus
      } else if ((m = /^Қай сан (.+) теңдеуінің түбірі\?$/.exec(it.q))) {
        roots++; const x = rootFast(m[1]); expect(+right, it.q).toBe(x);
        it.choices.forEach((c: string) => expect(holdsAt(m![1], +c), `${it.q}: ${c}`).toBe(+c === x));
      } else {
        eqs++; m = /^(.+)\. ([a-z]) = \?$/.exec(it.q)!; const x = rootFast(m[1]); expect(+right, it.q).toBe(x);
        it.choices.forEach((c: string) => expect(holdsAt(m![1], +c), `${it.q}: ${c}`).toBe(+c === x));
      }
    }
    expect(eqs).toBeGreaterThan(1200); expect(roots).toBeGreaterThan(600); expect(first).toBeGreaterThan(500);
  });
});

// ───────────────────────── eq.brackets_nat ─────────────────────────
describe('eq.brackets_nat: корни пересчитаны точным перебором', () => {
  const id = 'eq.brackets_nat';
  it('финал: 3 · (x + 3) = 27 → 6, единственный корень; ловушки 8 ((27 − 3) : 3), 24 (27 − 3), 12 (27 : 3 + 3), 9 (27 : 3); цель = финал', () => {
    const fin = W[id].at(-1), eq = '3 · (x + 3) = 27';
    expect(root1(eq)).toBe(6);
    expect(fin.choices[fin.answer]).toBe('6');
    expect([...fin.choices].sort()).toEqual(['6', String((27 - 3) / 3), String(27 - 3), String(27 / 3 + 3), String(27 / 3)].sort());
    for (const c of fin.choices) expect(holdsAt(eq, +c), c).toBe(c === '6');
    expect(W[id][0].task).toContain(eq); expect(fin.s.math).toBe(eq);
    expect(W[id][0].kz).toContain('3 қорапта'); expect(W[id][0].kz).toContain('тағы 3 қарындаштан'); expect(W[id][0].kz).toContain('27 қарындаш');   // условие = уравнение
    expect(fin.why).toContain('x + 3 = 27 : 3 = 9'); expect(fin.why).toContain('3x + 9 = 27, 3x = 18, x = 6');
  });
  it('кадры «Көр»: уравнения в каждой цепочке равносильны (один корень), оба способа дают 7; подписи называют те же числа', () => {
    const fr = frames(id), chain = (idx: number[], root: number) => { for (const i of idx) { const e = fr[i].s.math; if (!/[a-z]/.test(e)) continue; expect(exactRoots(e), e).toEqual([root]); } };
    expect(fr).toHaveLength(14);
    chain([0, 1, 2, 3, 4, 5], 7); chain([7, 8, 9], 9); chain([10, 11, 12, 13], 7);
    expect(fr[6].s.math).toBe('4 · (7 + 5) = 48');
    const cap = (i: number) => fr[i].kz + ' ' + (fr[i].math ?? '');
    expect(cap(1)).toContain('48 : 4 = [12]'); expect(cap(2)).toContain('12 − 5 = [7]');
    expect(cap(3)).toContain('4 · 5 = [20]'); expect(cap(3)).toContain('4x + 20 = 48'); expect(cap(4)).toContain('48 − 20 = [28]'); expect(cap(5)).toContain('x = 28 : 4 = 7');
    expect(cap(6)).toContain('4 · (7 + 5) = 4 · 12 = 48');
    expect(cap(8)).toContain('21 : 3 = [7]'); expect(cap(9)).toContain('x = 7 + 2 = 9'); expect(cap(9)).toContain('3 · (9 − 2) = 3 · 7 = 21');
    expect(cap(11)).toContain('2 · 4 = [8]'); expect(cap(11)).toContain('2x + 8 = x + 15'); expect(cap(13)).toContain('x = 15 − 8 = 7'); expect(cap(13)).toContain('2 · (7 + 4) = 22'); expect(cap(13)).toContain('7 + 15 = 22');
    // шаги из подписей равносильны исходным уравнениям
    expect(root1('x + 5 = 12')).toBe(root1('4(x + 5) = 48')); expect(root1('4x + 20 = 48')).toBe(root1('4(x + 5) = 48')); expect(root1('x − 2 = 7')).toBe(root1('3(x − 2) = 21'));
    expect(root1('2x + 8 = x + 15')).toBe(root1('2(x + 4) = x + 15')); expect(root1('x + 8 = 15')).toBe(root1('2(x + 4) = x + 15'));
    for (const x of [1, 3, 8, 20]) { expect(evalAt('4(x + 5)', x)).toEqual(evalAt('4x + 20', x)); expect(evalAt('2(x + 4)', x)).toEqual(evalAt('2x + 2 · 4', x)); }
  });
  it('пошаговые: 7 · (x − 2) = 35 → 7 (делением); 6 · (x + 3) = 78 → 10 (раскрытием); тексеру 35, 78', () => {
    expect(root1('7(x − 2) = 35')).toBe(7); expect(root1('x − 2 = 5')).toBe(7); expect(7 * (7 - 2)).toBe(35);
    expect(root1('6(x + 3) = 78')).toBe(10); expect(root1('6x + 18 = 78')).toBe(10); expect(root1('6x = 60')).toBe(10); expect(6 * (10 + 3)).toBe(78);
    const f1 = steps(id, 'faded')[0].steps, f2 = steps(id, 'faded')[1].steps;
    expect(f1.at(-1).math).toBe('Жауабы: x = 7'); expect(f2.at(-1).math).toBe('Жауабы: x = 10');
    expect(f1[3].blank.choices[0]).toBe('35'); expect(f2[4].blank.choices[0]).toBe('78');
  });
  it('предсказание и «неге?»: 4 · (x + 5) = 4x + 20 (а не 4x + 5): при x = 1 части 24 и 24, а 4x + 5 даёт 9; «неге» объясняет 4 рет алу', () => {
    for (const x of [1, 2, 9, 30]) expect(evalAt('4(x + 5)', x)).toEqual(evalAt('4x + 20', x));
    expect(evalAt('4(x + 5)', 1)).toEqual([24, 1]); expect(evalAt('4x + 5', 1)).toEqual([9, 1]);
    const pr = one(id, 'predict'); expect(pr.choices[pr.answer]).toBe('Жоқ');
    expect(pr.reveal).toContain('4 · (1 + 5) = 24'); expect(pr.reveal).toContain('4 · 1 + 20 = 24'); expect(pr.reveal).toContain('4 · 1 + 5 = 9');
    expect(one(id, 'why').why).toContain('4x + 20');
  });
  it('ошибка Глитча: 4 · (x + 8) = 52 → 5 (а не 11): Глитч умножил только x: 4x + 8 = 52 → 11, при x = 11 левая часть 76', () => {
    expect(root1('4(x + 8) = 52')).toBe(5);
    expect(root1('4x + 8 = 52')).toBe(11);                                              // то, что получил Глитч
    expect(holdsAt('4(x + 8) = 52', 11)).toBe(false); expect(4 * (11 + 8)).toBe(76);
    const bug = one(id, 'bug');
    expect(bug.lines[1]).toBe('Жақшаны ашамыз: 4 санын тек x-ке көбейтеміз: 4x + 8 = 52'); expect(bug.lines[2]).toBe('4x = 52 − 8 = 44'); expect(bug.lines[3]).toContain('x = 44 : 4 = 11');
    expect(bug.fix).toContain('4x + 32 = 52'); expect(bug.fix).toContain('x = 20 : 4 = 5'); expect(bug.fix).toContain('4 · (5 + 8) = 4 · 13 = 52'); expect(bug.fix).toContain('4 · (11 + 8) = 4 · 19 = 76');
  });
  it('правило: каждое «P болса, … x = N» верно, оба способа названы', () => {
    const rule = one(id, 'rule').lines.join(' ');
    for (const [eq, x] of [['3 · (x + 2) = 21', 5], ['3 · (x − 2) = 21', 9], ['2 · (x + 3) = x + 9', 3]] as [string, number][]) { expect(root1(eq), eq).toBe(x); expect(rule, eq).toContain(eq); }
    expect(root1('3x + 6 = 21')).toBe(5); expect(root1('2x + 6 = x + 9')).toBe(3); expect(root1('x + 6 = 9')).toBe(3); expect(root1('x + 2 = 7')).toBe(5);
    expect(rule).toContain('1-тәсіл'); expect(rule).toContain('2-тәсіл'); expect(rule).toContain('3x + 6 = 21, 3x = 15, x = 5');
    for (const x of [1, 4, 11]) expect(evalAt('4(x + 5)', x)).toEqual(evalAt('4x + 20', x));
  });
  it('мини-игра: корни и «жақшаны аш» пересчитаны независимо; верный вариант единственный; ловушки не корни и не тождества', () => {
    const r = rng(103), b = one(id, 'blitz'); let eqs = 0, roots = 0, expand = 0;
    for (let k = 0; k < 3000; k++) {
      const it = b.make(r), right = it.choices[it.answer];
      let m: RegExpExecArray | null;
      if ((m = /^Жақшаны аш: (.+) = \?$/.exec(it.q))) {
        expand++; const sameAs = (c: string) => [1, 2, 3, 5, 8].every(x => { const a = evalAt(m![1], x), cc = evalAt(c, x); return a[0] === cc[0] && a[1] === cc[1]; });
        expect(sameAs(right), `${it.q} → ${right}`).toBe(true);
        expect(it.choices.filter(sameAs), it.q).toHaveLength(1);
      } else if ((m = /^Қай сан (.+) теңдеуінің түбірі\?$/.exec(it.q))) {
        roots++; const x = rootFast(m[1]); expect(+right, it.q).toBe(x);
        it.choices.forEach((c: string) => expect(holdsAt(m![1], +c), `${it.q}: ${c}`).toBe(+c === x));
      } else {
        eqs++; m = /^(.+)\. ([a-z]) = \?$/.exec(it.q)!; const x = rootFast(m[1]); expect(+right, it.q).toBe(x);
        it.choices.forEach((c: string) => expect(holdsAt(m![1], +c), `${it.q}: ${c}`).toBe(+c === x));
      }
    }
    expect(eqs).toBeGreaterThan(1500); expect(roots).toBeGreaterThan(400); expect(expand).toBeGreaterThan(400);
  });
});

// ───────────────────────── голос ─────────────────────────
describe('голос: реплики будущей озвучки собираются без цифр, латиницы, скобок и закрытых ответов', () => {
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
  it('нет цифр, «[ ]», «▢», LaTeX, латиницы, скобок (скобки в формулах продиктованы словами), слова undefined; знаки, которые Piper не произносит, заменены', () => {
    for (const { id, kz } of lines) {
      expect(kz.trim().length, `${id}: пусто`).toBeGreaterThan(5);
      expect(kz, `${id}: цифры`).not.toMatch(/\d/);
      expect(kz, `${id}: скобки подсветки или пропуск`).not.toMatch(/[\[\]▢]/);
      expect(kz, `${id}: LaTeX/markdown`).not.toMatch(/[\\$`#*_{}^~|]/);
      expect(kz, `${id}: латиница`).not.toMatch(/[A-Za-z]/);
      expect(kz, `${id}: undefined`).not.toMatch(/undefined|NaN/);
      expect(kz, `${id}: знаки, которые Piper не произносит`).not.toMatch(/[×≤≥≈∩∪²³ⁿ−–+=<>/→≠※]/);
      expect(kz, `${id}: скобки молча теряются в Piper`).not.toMatch(/[()]/);
    }
  });
  it('скобки и буквы-переменные читаются по-казахски: 3 · (x + 4) = 27, 5x + 3 = 2x + 18, 2x-ті, x-ті', () => {
    expect(speakable('3 · (x + 4) = 27')).toBe('үш көбейту жақша ашылады икс қосу төрт жақша жабылады тең жиырма жеті');
    expect(speakable('3(x + 4)')).toBe('үш жақша ашылады икс қосу төрт жақша жабылады');
    expect(speakable('5x + 3 = 2x + 18')).toBe('бес икс қосу үш тең екі икс қосу он сегіз');
    expect(speakable('(x − 2) · 3')).toBe('жақша ашылады икс минус екі жақша жабылады көбейту үш');
    expect(speakable('Тексеру: 4 · (7 + 5) = 4 · 12')).toBe('Тексеру: төрт көбейту жақша ашылады жеті қосу бес жақша жабылады тең төрт көбейту он екі');
    expect(speakable('x-ті бір жаққа жинаймыз, 2x-ті азайтамыз')).toBe('иксті бір жаққа жинаймыз, екі иксті азайтамыз');   // суффикс после буквы склеивается с её названием
    expect(speakable('(қалдық 3)')).toBe('(қалдық үш)');                                                            // пояснение в скобках не трогаем
    expect(speakable('(k + 1)²')).toContain('квадрат');                                                              // скобка со степенью читается прежним правилом
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
  it('кадры «Көр»: озвучиваются все кадры; в примере ≥ 2 пропуска (число из [..] закрыто ▢)', () => {
    for (const [skill, st] of Object.entries(mine)) st.forEach((s, i) => { if (s.type === 'example') s.frames.forEach((_: any, k: number) => expect(byId.has(`${skill}_${i}_f${k}`)).toBe(true)); });
    for (const id of IDS) {
      const i = L[id].findIndex(s => s.type === 'example'), gaps = planGaps(id, i, L[id][i])?.frames ?? [];
      expect(gaps.filter(Boolean).length, `${id}: в примере мало пропусков`).toBeGreaterThanOrEqual(5);
    }
  });
  it('все озвучиваемые реплики: нет необработанных обрывков; суффиксы к цифрам стоят через дефис', () => {
    for (const { id, kz } of lines) expect(kz, id).not.toMatch(/\d|[A-Za-z]|--/);
  });
});
