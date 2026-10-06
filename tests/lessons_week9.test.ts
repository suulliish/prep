// C5: 5 аварийных уроков (content/lessons_week9.mjs): logic.new_operation, logic.clock_angle, logic.deduction, div.last_digit, pat.bracket.
// Сценарий, зарегистрированные сцены и виджеты, запрещённые слова, голос (как у тестов озвучки), перенос (цель = финал, пример другой),
// все ответы и равенства в тексте пересчитаны независимо, как и 300 раундов мини-игр.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
// @ts-ignore
import { LESSONS } from '../content/lessons.mjs';
// @ts-ignore
import { WEEK9 } from '../content/lessons_week9.mjs';
// @ts-ignore
import { rng } from '../content/templates/lib.mjs';
// @ts-ignore
import GLOSSARY from '../content/glossary.json';
// @ts-ignore
import { TECHNIQUES } from '../content/techniques.mjs';
// @ts-ignore
import { skillById } from '../content/skills.mjs';
// @ts-ignore
import { buildLines, numeralLeak, UNKNOWN } from '../scripts/voice/lesson-lines.mjs';
import { planGaps } from '../src/lesson/gap';
import { menuCards } from '../src/lesson/teachback';

const IDS = ['logic.new_operation', 'logic.clock_angle', 'logic.deduction', 'div.last_digit', 'pat.bracket'];
const W = WEEK9 as Record<string, any[]>, L = LESSONS as Record<string, any[]>;
const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';
const unsup = (s: string) => Number([...s].map(c => SUP.indexOf(c)).join(''));
const ev = (s: string): number => Function(`return (${s.replace(/·/g, '*').replace(/:/g, '/').replace(/−/g, '-').replace(/,/g, '.')})`)();
const perms = (a: number[]): number[][] => (a.length <= 1 ? [a] : a.flatMap((x, i) => perms([...a.slice(0, i), ...a.slice(i + 1)]).map(p => [x, ...p])));
const opOf = (f: string) => (a: number, b: number) => ev(f.replace(/\ba\b/g, `(${a})`).replace(/\bb\b/g, `(${b})`));
const angle = (h: number, m: number) => { const d = Math.abs((h % 12) * 30 + m / 2 - m * 6); return d > 180 ? 360 - d : d; };
const lastOf = (b: number, e: number) => Number((BigInt(b) ** BigInt(e)) % 10n);
const steps = (id: string, type: string) => W[id].filter(s => s.type === type);
const one = (id: string, type: string) => steps(id, type)[0];
const ansOf = (s: any) => s.choices[s.answer];
const textOf = (s: any): string[] => [s.kz ?? '', s.task ?? '', s.reveal ?? '', s.why ?? '', s.fix ?? '', ...(s.lines ?? []), ...(s.choices ?? []), ...(s.frames ?? []).flatMap((f: any) => [f.kz ?? '', f.math ?? '']),
  ...(s.steps ?? []).flatMap((x: any) => [x.math ?? '', x.blank?.why ?? '', ...(x.blank?.choices ?? [])])];

// ───────────────────────── сценарий ─────────────────────────
describe('аварийные уроки: полный сценарий', () => {
  it('все 5 тем есть в LESSONS, в графе, с приёмом и карточками «Биткә түсіндір»', () => {
    for (const id of IDS) {
      expect(L[id], id).toBeTruthy(); expect(skillById[id], id).toBeTruthy();
      expect(TECHNIQUES.find((t: any) => t.skill === id), `приём ${id}`).toBeTruthy();
      expect(menuCards(id), `Биткә түсіндір ${id}`).not.toBeNull();
    }
    expect(Object.keys(W).sort()).toEqual([...IDS].sort());
  });
  for (const id of IDS) it(`${id}: цель → … → возврат к цели`, () => {
    const t = W[id].map(s => s.type);
    expect(t[0]).toBe('goal'); expect(t.at(-1)).toBe('final');
    for (const need of ['predict', 'example', 'faded', 'why', 'bug', 'blitz', 'rule']) expect(t, need).toContain(need);
    expect(t.filter(x => x === 'faded').length).toBeGreaterThanOrEqual(2);
    // порядок: цель → (руками) → предсказание → разбор → 2 пошаговых → «неге?» → ошибка Глитча → мини-игра → правило → финал
    const order = ['goal', 'widget', 'predict', 'example', 'faded', 'faded', 'why', 'bug', 'blitz', 'rule', 'final'].filter(x => x !== 'widget' || t.includes('widget'));
    expect(t, id).toEqual(order);
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
    expect(pos.size).toBeGreaterThanOrEqual(2);
  });
  it('все варианты ответов в шагах «неге?»/предсказание/пропуски различны, верный индекс в границах, у мини-игр ≥ 3 варианта', () => {
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
      for (let k = 0; k < 300; k++) {
        const it = b.make(r);
        expect(it.q.length).toBeGreaterThan(5);
        expect(new Set(it.choices).size, it.q + ' ' + it.choices).toBe(it.choices.length);
        expect(it.choices.length, it.q).toBeGreaterThanOrEqual(3);
        expect(it.answer).toBeGreaterThanOrEqual(0); expect(it.answer).toBeLessThan(it.choices.length);
        expect(it.choices.join()).not.toMatch(/NaN|undefined|-\d/);
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
  it('голосовые реплики (цель, руками, кадры «Көр») без латиницы и знаков × ² ³; нет слова-кальки «галочка»', () => {
    for (const id of IDS) for (const s of W[id]) {
      const voiced = ['goal', 'widget', 'say'].includes(s.type) ? [s.kz] : s.type === 'example' ? s.frames.map((f: any) => f.kz) : [];
      for (const t of voiced) expect(t, id).not.toMatch(/[A-Za-z×²³]/);
    }
  });
  it('новые термины (период, кесте, құсбелгі, сағаттық/минуттық тіл) есть в glossary.json с пометкой для носителя', () => {
    const terms = (GLOSSARY as any).terms.filter((t: any) => ['сағаттық тіл / минуттық тіл', 'период', 'кесте', 'құсбелгі', 'шеткі сандар / жақшадағы сан'].includes(t.kz));
    expect(terms).toHaveLength(5);
    for (const t of terms) expect(t.note, t.kz).toMatch(/носител/);
  });
});

// ───────────────────────── перенос: цель = финал, пример другой ─────────────────────────
describe('цель и финал про одну задачу, в примере другая', () => {
  const nums = (t: string) => new Set(t.replace(/(\d) (?=\d{3}(?!\d))/g, '$1').match(/\d+/g) ?? []);
  const exampleText = (ex: any) => JSON.stringify([ex.kz, ex.frames.map((f: any) => [f.kz, f.math ?? '', f.s])]);
  for (const id of IDS) it(`${id}: числа цели не встречаются все вместе в примере; значимые числа цели есть в финале`, () => {
    const goal = W[id][0], fin = W[id].at(-1), ex = one(id, 'example');
    const g = nums(goal.task + ' ' + goal.kz), e = nums(exampleText(ex)), f = nums(fin.kz + JSON.stringify(fin.s) + fin.why);
    if (id === 'logic.deduction') {
      // задача без чисел: условия цели (предложения с именами) целиком повторены в финале и ни одно не стоит в примере
      const clues = goal.task.split('. ').filter((x: string) => /ның |нің |дың |дің |тың |тің /.test(x)).map((x: string) => x.replace(/\.$/, ''));
      expect(clues.length).toBeGreaterThanOrEqual(4);
      for (const c of clues) expect(fin.kz, c).toContain(c);
      expect(clues.filter((c: string) => !exampleText(ex).includes(c)).length, 'условия цели целиком есть в примере').toBeGreaterThanOrEqual(3);
      return;
    }
    expect(g.size).toBeGreaterThan(0);
    expect([...g].filter(x => !e.has(x)).length, `цель ${[...g]} целиком есть в примере`).toBeGreaterThan(0);
    const sig = [...g].filter(x => x.length >= 2), need = sig.length ? sig : [...g];
    expect(need.filter(x => !e.has(x)).length, `значимые ${need} целиком есть в примере`).toBeGreaterThan(0);
    for (const x of need) expect(f.has(x), `«${x}» из цели нет в финале`).toBe(true);
  });
});

// ───────────────────────── равенства в тексте ─────────────────────────
const NUM = String.raw`\(?\d+(?:,\d+)?(?:[⁰¹²³⁴⁵⁶⁷⁸⁹]+)?\)?`;
const EXPR = `${NUM}(?: [·:+−] ${NUM})*`;
const EQ = new RegExp(`${EXPR}(?: = ${EXPR})+`, 'g');
const evalSeg = (raw: string, after: string): number => {
  let s = raw.replace(/(\d)([⁰¹²³⁴⁵⁶⁷⁸⁹]+)/g, (_, a, p) => `${a}**${unsup(p)}`);
  while ((s.match(/\(/g) ?? []).length > (s.match(/\)/g) ?? []).length) s = s.replace('(', '');
  while ((s.match(/\)/g) ?? []).length > (s.match(/\(/g) ?? []).length) s = s.slice(0, s.lastIndexOf(')')) + s.slice(s.lastIndexOf(')') + 1);
  const v = ev(s);
  return /^\s*[,;]?\s*қалдық/.test(after) && /:/.test(raw) ? Math.floor(v) : v;
};
/** Все цепочки «a = b = c» в тексте: значения равны. Возвращает описание первого расхождения или null. */
function badEquation(text: string): string | null {
  const t = text.replace(/[\[\]]/g, '').replace(/\(?\d+\)? ※ \(?\d+\)? = /g, '');   // «4 ※ 5 = 2 · 4 + 3 · 5 = 23»: проверяем цепочку справа от «※-равенства»
  for (const m of t.matchAll(EQ)) {
    const parts = m[0].split(' = '), after = t.slice(m.index! + m[0].length, m.index! + m[0].length + 14);
    const vals = parts.map(p => evalSeg(p, after));
    if (vals.some(v => Math.abs(v - vals[0]) > 1e-9)) return `${m[0]} (${vals.join(' ≠ ')})`;
  }
  return null;
}
describe('арифметика в текстах уроков', () => {
  it('самопроверка валидатора', () => {
    expect(badEquation('2 · 4 + 3 · 5 = 8 + 15 = 23')).toBeNull();
    expect(badEquation('22 : 4 = 5, қалдық 2')).toBeNull();
    expect(badEquation('3 + 5 = 9')).not.toBeNull();
    expect(badEquation('(1 + 9) · 3 − 9 = 21')).toBeNull();
    expect(badEquation('2³⁰ = 4')).not.toBeNull();
    expect(badEquation('8³ = 512')).toBeNull();
    expect(badEquation('30 · 3 + 0,5 · 30 = 105')).toBeNull();
  });
  for (const id of IDS) it(`${id}: все равенства верны (кроме строк ошибки Глитча)`, () => {
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
      if (!m || /[⁰¹²³⁴⁵⁶⁷⁸⁹]/.test(m[1])) continue;
      expect(String(evalSeg(m[1], '')).replace('.', ','), `${id}: ${x.math}`).toBe(x.blank.choices[x.blank.answer]);
    }
  });
});

// ───────────────────────── ответы: новая операция ─────────────────────────
describe('logic.new_operation: ответы пересчитаны', () => {
  const f = opOf('a · b − 2 · a'), g = opOf('2 · a + 3 · b');
  it('финал: 9 ※ 4 = 18; ловушки: орнын ауыстыру 28, тек көбейтінді 36, 2-ні ғана азайту 34, солдан оңға 306', () => {
    const fin = W['logic.new_operation'].at(-1), goal = W['logic.new_operation'][0];
    expect(goal.task).toContain('a ※ b = a · b − 2 · a'); expect(goal.task).toContain('9 ※ 4');
    expect(f(9, 4)).toBe(18); expect(ansOf(fin)).toBe('18');
    expect(f(4, 9)).toBe(28); expect(9 * 4).toBe(36); expect(9 * 4 - 2).toBe(34); expect((9 * 4 - 2) * 9).toBe(306);
    expect([...fin.choices].sort()).toEqual(['18', '28', '34', '306', '36'].sort());
  });
  it('предсказание и «неге?»: 2 · 3 + 3 · 1 = 9, а наоборот 11', () => {
    expect(g(3, 1)).toBe(9); expect(g(1, 3)).toBe(11);
    expect(one('logic.new_operation', 'predict').reveal).toContain('= 9'); expect(one('logic.new_operation', 'predict').reveal).toContain('= 11');
  });
  it('пример: 4 ※ 5 = 23, 5 ※ 4 = 22, (1 ※ 2) ※ 3 = 8 затем 25', () => {
    expect(g(4, 5)).toBe(23); expect(g(5, 4)).toBe(22); expect(g(1, 2)).toBe(8); expect(g(8, 3)).toBe(25);
    const fr = one('logic.new_operation', 'example').frames.map((x: any) => x.math ?? '').join(' ');
    for (const v of ['[23]', '[22]', '[8]', '[25]']) expect(fr).toContain(v);
  });
  it('пошаговые: 5 · 6 − 3 = 27; (2 ※ 1) ※ 3 = 5, затем 13', () => {
    const h = opOf('5 · a − b'), k = opOf('2 · a + b');
    expect(h(6, 3)).toBe(27); expect(k(k(2, 1), 3)).toBe(13); expect(k(2, 1)).toBe(5);
    const fd = steps('logic.new_operation', 'faded');
    expect(fd[0].steps.at(-1).math).toBe('Жауабы: 27'); expect(fd[1].steps.at(-1).math).toBe('Жауабы: 13');
  });
  it('ошибка Глитча: правильный счёт 4 ※ 3 по a · b + 2 · b = 18, Глитч получил 42 (слева направо), исправление называет 18', () => {
    const bug = one('logic.new_operation', 'bug'), b = opOf('a · b + 2 · b');
    expect(b(4, 3)).toBe(18); expect(((4 * 3) + 2) * 3).toBe(42);
    expect(bug.lines[3]).toContain('42'); expect(bug.fix).toContain('18'); expect(bug.bad).toBe(2);
  });
  it('виджет OrderOps: числа и знаки чередуются, выражение верное (3 · 6 + 2 · 4 = 26)', () => {
    const w = one('logic.new_operation', 'widget'), e: string[] = w.props.expr;
    expect(w.w).toBe('OrderOps');
    e.forEach((t, i) => (i % 2 ? expect(['+', '−', '·', ':']).toContain(t) : expect(/^\d+$/.test(t)).toBe(true)));
    expect(ev(e.join(' '))).toBe(26);
  });
  it('мини-игра: ответ пересчитан (формула, перестановка, вложенность), верный вариант единственный', () => {
    const r = rng(101), b = one('logic.new_operation', 'blitz'), kinds = new Set<string>();
    for (let k = 0; k < 300; k++) {
      const it = b.make(r), m = /^a ※ b = (.+?)\. (.+?) = \?$/.exec(it.q)!, op = opOf(m[1]);
      let want: number, g1;
      if ((g1 = /^\((\d+) ※ (\d+)\) ※ (\d+)$/.exec(m[2]))) { want = op(op(+g1[1], +g1[2]), +g1[3]); kinds.add('nested-left'); }
      else if ((g1 = /^(\d+) ※ \((\d+) ※ (\d+)\)$/.exec(m[2]))) { want = op(+g1[1], op(+g1[2], +g1[3])); kinds.add('nested-right'); }
      else { g1 = /^(\d+) ※ (\d+)$/.exec(m[2])!; want = op(+g1[1], +g1[2]); kinds.add('plain'); expect(want).toBeGreaterThan(0); }
      expect(it.choices[it.answer], it.q).toBe(String(want));
    }
    expect([...kinds].sort()).toEqual(['nested-left', 'nested-right', 'plain']);
  });
});

// ───────────────────────── ответы: часы ─────────────────────────
describe('logic.clock_angle: ответы пересчитаны', () => {
  it('финал 4:40 → 100°; ловушки: 120° (сағаттық тіл тұр), 260° (үлкен бұрыш), 140° және 240° (бір тіл)', () => {
    const fin = W['logic.clock_angle'].at(-1);
    expect(W['logic.clock_angle'][0].task).toContain('4:40');
    expect(angle(4, 40)).toBe(100); expect(ansOf(fin)).toBe('100°');
    expect(Math.abs(6 * 40 - 30 * 4)).toBe(120); expect(360 - 100).toBe(260); expect(30 * 4 + 0.5 * 40).toBe(140); expect(6 * 40).toBe(240);
    expect([...fin.choices].sort()).toEqual(['100°', '120°', '140°', '240°', '260°']);
  });
  it('пошаговые: 3:20 → 20°, 1:50 → 115°; предсказание 3:30 → 75°; ошибка 5:20 → 40°', () => {
    expect(angle(3, 20)).toBe(20); expect(angle(1, 50)).toBe(115); expect(angle(3, 30)).toBe(75); expect(angle(5, 20)).toBe(40);
    const fd = steps('logic.clock_angle', 'faded');
    expect(fd[0].steps.at(-1).math).toBe('Жауабы: 20°'); expect(fd[1].steps.at(-1).math).toBe('Жауабы: 115°');
    expect(one('logic.clock_angle', 'predict').reveal).toContain('75'); expect(one('logic.clock_angle', 'bug').fix).toContain('40°');
    expect(one('logic.clock_angle', 'bug').lines[3]).toContain('30°');
  });
  it('пример: 2:20 → 50°, 10:20 → 310 − 120 = 190 → 170°', () => {
    expect(angle(2, 20)).toBe(50); expect(angle(10, 20)).toBe(170); expect(30 * 10 + 0.5 * 20).toBe(310);
    const fr = one('logic.clock_angle', 'example').frames.map((x: any) => x.math ?? '').join(' ');
    for (const v of ['[6]', '[30]', '[0,5]', '[120]', '[70]', '[50]', '[310]', '[190]', '[170]']) expect(fr).toContain(v);
  });
  it('время в условиях совпадает с итогом: kz цели, пошаговых, ошибки и финала → угол', () => {
    const C = 'logic.clock_angle', time = (kz: string) => { const m = /(\d+) сағат (\d+) минут/.exec(kz)!; return [+m[1], +m[2]]; };
    const fd = steps(C, 'faded'), fin = W[C].at(-1), bug = one(C, 'bug');
    expect(time(fin.kz)).toEqual([4, 40]); expect(time(W[C][0].kz)).toEqual([4, 40]);
    for (const s of fd) expect(s.steps.at(-1).math, s.kz).toBe(`Жауабы: ${angle(...(time(s.kz) as [number, number]))}°`);
    expect(angle(...(time(bug.kz) as [number, number]))).toBe(40);
    const pr = time(one(C, 'predict').kz); expect(angle(pr[0], pr[1])).toBe(75);
  });
  it('мини-игра: угол и скорости стрелок пересчитаны', () => {
    const r = rng(102), b = one('logic.clock_angle', 'blitz'), kinds = new Set<string>();
    for (let k = 0; k < 300; k++) {
      const it = b.make(r); let m: RegExpExecArray | null, want: number;
      if ((m = /^Сағат (\d\d):(\d\d)\./.exec(it.q))) { kinds.add('angle'); want = angle(+m[1], +m[2]); expect(+m[1]).toBeLessThanOrEqual(12); expect(want).not.toBe(0); expect(want).toBeLessThanOrEqual(180); }
      else if ((m = /^Минуттық тіл (\d+) минутта/.exec(it.q))) { kinds.add('minute'); want = 6 * +m[1]; }
      else if ((m = /^Сағаттық тіл (\d+) минутта/.exec(it.q))) { kinds.add('hour'); want = +m[1] / 2; }
      else throw new Error(it.q);
      expect(it.choices[it.answer], it.q).toBe(String(want).replace('.', ','));
    }
    expect([...kinds].sort()).toEqual(['angle', 'hour', 'minute']);
  });
});

// ───────────────────────── ответы: кто где ─────────────────────────
const GENF: Record<string, string> = { 'Айжан': 'Айжанның', 'Арман': 'Арманның', 'Дана': 'Дананың', 'Нұрлан': 'Нұрланның', 'Мадина': 'Мадинаның', 'Ерлан': 'Ерланның', 'Бекзат': 'Бекзаттың', 'Санжар': 'Санжардың' };
const POSS: Record<string, string> = { 'мысығы': 'мысық', 'иті': 'ит', 'тотықұсы': 'тотықұс', 'балығы': 'балық' };
/** Условия из текста: предложения, начинающиеся с имени в родительном падеже. */
function cluesIn(text: string, names: string[]) {
  return text.replace(/Шарттар: /, '').split(/\.\s*/).map(s => s.trim()).filter(Boolean).flatMap(s => {
    const who = names.find(n => s.startsWith(GENF[n] + ' '));
    if (!who) return [];
    return [{ who, pets: [...s.matchAll(/(мысығы|иті|тотықұсы|балығы)/g)].map(x => POSS[x[1]]), neg: s.endsWith('жоқ') }];
  });
}
function solve(text: string, names: string[], pets: string[], target: string) {
  const clues = cluesIn(text, names);
  const sols = perms(pets.map((_, i) => i)).filter(p => clues.every(c => { const mine = pets[p[names.indexOf(c.who)]]; return c.neg ? !c.pets.includes(mine) : c.pets.includes(mine); }));
  const owners = [...new Set(sols.map(p => names[p.indexOf(pets.indexOf(target))]))];
  return { clues, sols, owners };
}
describe('logic.deduction: ответы и таблицы пересчитаны перебором', () => {
  const D = 'logic.deduction', fr = (one(D, 'example').frames as any[]), fd = steps(D, 'faded'), bug = one(D, 'bug'), fin = W[D].at(-1), goal = W[D][0];
  const N3 = ['Айжан', 'Арман', 'Дана'], P3 = ['мысық', 'ит', 'тотықұс'], N4 = ['Айжан', 'Арман', 'Дана', 'Нұрлан'], P4 = ['мысық', 'ит', 'тотықұс', 'балық'];
  it('цель = финал: 4 ребёнка, условия те же, балық у Нұрлан (расстановка единственная, условия не называют балық прямо)', () => {
    for (const text of [goal.task, fin.kz]) {
      const s = solve(text, N4, P4, 'балық');
      expect(s.clues).toHaveLength(4); expect(s.sols).toHaveLength(1); expect(s.owners).toEqual(['Нұрлан']);
      expect(s.clues.some(c => !c.neg && c.pets.includes('балық'))).toBe(false);
      expect(s.sols[0].map(j => P4[j])).toEqual(['тотықұс', 'мысық', 'ит', 'балық']);
    }
    expect(ansOf(fin)).toBe('Нұрлан'); expect(fin.choices).toContain('Анықтау мүмкін емес');
    // каждое условие нужно (убрали — расстановка перестала быть единственной)
    const all = cluesIn(fin.kz, N4);
    all.forEach((_, k) => {
      const rest = all.filter((__, i) => i !== k);
      const sols = perms([0, 1, 2, 3]).filter(p => rest.every(c => { const mine = P4[p[N4.indexOf(c.who)]]; return c.neg ? !c.pets.includes(mine) : c.pets.includes(mine); }));
      expect(sols.length, `условие ${k} лишнее`).toBeGreaterThan(1);
    });
  });
  it('пример: 3×3, ит у Ерлан; таблица в кадрах «Көр» согласована с расстановкой (✘ только там, где нельзя; ✔ только где верно)', () => {
    const N = ['Бекзат', 'Мадина', 'Ерлан'], P = ['балық', 'ит', 'тотықұс'], s = solve(fr[0].kz, N, P, 'ит');
    expect(s.sols).toHaveLength(1); expect(s.owners).toEqual(['Ерлан']);
    const truth = s.sols[0];
    for (const f of fr) {
      const rows = f.s.math.replace(/[\[\]]/g, '').split(/ {2,}/);   // «Имя → животное метка …», по строке на ребёнка
      expect(rows).toHaveLength(3);
      rows.forEach((row: string) => {
        const [name, , ...pairs] = row.split(' '), cells = pairs.filter((_: string, i: number) => i % 2 === 1);   // метки после названий животных
        expect(N).toContain(name);
        cells.forEach((c, j) => {
          const owns = truth[N.indexOf(name)] === j;
          if (c === '✘') expect(owns, `${name} ${P[j]}: ✘ у владельца`).toBe(false);
          if (c === '✔') expect(owns, `${name} ${P[j]}: ✔ не у владельца`).toBe(true);
        });
      });
    }
    // последний кадр — полная расстановка: ✔ ровно по одному в строке и в столбце
    const last = fr.at(-1).s.math.replace(/[\[\]]/g, '').split(/ {2,}/).map((r: string) => r.split(' ').slice(2).filter((_: string, i: number) => i % 2 === 1));
    expect(last.map((r: string[]) => r.filter(c => c === '✔').length)).toEqual([1, 1, 1]);
    expect([0, 1, 2].map(j => last.filter((r: string[]) => r[j] === '✔').length)).toEqual([1, 1, 1]);
  });
  it('пошаговые: мысық у Арман (3×3, единственная расстановка); во втором условий не хватает', () => {
    const a = solve(fd[0].kz, N3, P3, 'мысық');
    expect(a.sols).toHaveLength(1); expect(a.owners).toEqual(['Арман']); expect(fd[0].steps.at(-1).math).toBe('Жауабы: Арман');
    const b = solve(fd[1].kz, N3, P3, 'мысық');
    expect(b.sols.length).toBeGreaterThan(1); expect(b.owners.length).toBeGreaterThan(1); expect(fd[1].steps.at(-1).math).toBe('Жауабы: анықтау мүмкін емес');
    expect(new Set(b.owners)).toEqual(new Set(['Арман', 'Дана']));
  });
  it('ошибка Глитча: условия дают единственную расстановку, ит у Дана; Глитч сказал «нельзя определить», исправление называет Дана', () => {
    const N = ['Айжан', 'Дана', 'Нұрлан'], s = solve(bug.lines[0], N, P3, 'ит');
    expect(s.sols).toHaveLength(1); expect(s.owners).toEqual(['Дана']);
    expect(bug.lines.at(-1)).toContain('анықтау мүмкін емес'); expect(bug.fix).toContain('ит Данада'); expect(bug.bad).toBe(2);
  });
  it('предсказание: одно «жоқ» не определяет — у Айжан три нераскрытых варианта в 4×4', () => {
    const s = solve('Айжанның мысығы жоқ.', N4, P4, 'ит');
    expect(new Set(s.sols.map(p => p[0])).size).toBe(3);
  });
  it('мини-игра: перебор расстановок; определён ли владелец, совпадает с «Анықтау мүмкін емес»', () => {
    const r = rng(103), b = one(D, 'blitz'); let open = 0, det = 0;
    for (let k = 0; k < 300; k++) {
      const it = b.make(r), m = /^(.+?): (.+?)\. (.+) Кімде (\S+) бар\?$/.exec(it.q)!;
      const names = m[1].split(', '), pets = m[2].split(', '), s = solve(m[3], names, pets, m[4]);
      expect(names).toHaveLength(3); expect(pets).toHaveLength(3); expect(s.sols.length).toBeGreaterThan(0);
      const want = s.owners.length === 1 ? s.owners[0] : 'Анықтау мүмкін емес';
      if (s.owners.length === 1) det++; else open++;
      expect(it.choices[it.answer], it.q).toBe(want);
      expect([...it.choices].sort()).toEqual([...names, 'Анықтау мүмкін емес'].sort());
    }
    expect(open).toBeGreaterThan(40); expect(det).toBeGreaterThan(100);
  });
});

// ───────────────────────── ответы: последняя цифра ─────────────────────────
describe('div.last_digit: ответы пересчитаны точной арифметикой', () => {
  const D = 'div.last_digit', cyc = (b: number) => { const c: number[] = []; let x = b % 10; while (!c.includes(x)) { c.push(x); x = (x * b) % 10; } return c; };
  it('финал 7^35 → 3; ловушки: 7 (1-я), 9 (2-я), 1 (остаток 0 как позиция), 5 (7 · 35 = 245)', () => {
    const fin = W[D].at(-1);
    expect(W[D][0].task).toContain('7³⁵');
    expect(lastOf(7, 35)).toBe(3); expect(ansOf(fin)).toBe('3'); expect(cyc(7)).toEqual([7, 9, 3, 1]);
    expect(35 % 4).toBe(3); expect((7 * 35) % 10).toBe(5); expect([...fin.choices].sort()).toEqual(['1', '3', '5', '7', '9']);
  });
  it('пошаговые: 3^22 → 9, 8^24 → 6; пример: 2^30 → 4, 2^28 → 6; ошибка Глитча: 4^15 → 4, а не 0', () => {
    expect(lastOf(3, 22)).toBe(9); expect(lastOf(8, 24)).toBe(6); expect(lastOf(2, 30)).toBe(4); expect(lastOf(2, 28)).toBe(6); expect(lastOf(4, 15)).toBe(4);
    expect(cyc(3)).toEqual([3, 9, 7, 1]); expect(cyc(8)).toEqual([8, 4, 2, 6]); expect(cyc(2)).toEqual([2, 4, 8, 6]); expect(cyc(4)).toEqual([4, 6]);
    expect(22 % 4).toBe(2); expect(24 % 4).toBe(0); expect(30 % 4).toBe(2); expect(28 % 4).toBe(0); expect(15 % 2).toBe(1);
    const fd = steps(D, 'faded');
    expect(fd[0].steps.at(-1).math).toBe('Жауабы: 9'); expect(fd[1].steps.at(-1).math).toBe('Жауабы: 6');
    const bug = one(D, 'bug'); expect(bug.lines[3]).toContain('0'); expect(bug.fix).toContain('сондықтан жауабы 4');
    const fr = one(D, 'example').frames.map((x: any) => x.math ?? '').join(' ');
    for (const v of ['[2]', '[4]', '[0]', '[6]']) expect(fr).toContain(v);
  });
  it('условие в тексте совпадает с итогом: основание и показатель из kz → «Жауабы», остаток и период в шагах', () => {
    for (const s of steps(D, 'faded')) {
      const m = /^(\d+) санының (\d+)-ші дәрежесінің/.exec(s.kz)!, [b, e] = [+m[1], +m[2]], len = cyc(b).length;
      expect(s.steps.at(-1).math, s.kz).toBe(`Жауабы: ${lastOf(b, e)}`);
      expect(s.steps.map((x: any) => x.math).join(' | ')).toContain(`${e} : ${len} = ${Math.floor(e / len)}`);
      const rem = s.steps.find((x: any) => /қалдық ▢/.test(x.math) && x.math.startsWith(`${e} :`));
      expect(rem.blank.choices[rem.blank.answer], s.kz).toBe(String(e % len));
    }
    const bug = one(D, 'bug'), m = /^(\d+) санының (\d+)-ші дәрежесінің/.exec(bug.kz.replace('Глитч ', ''))!;
    expect(lastOf(+m[1], +m[2])).toBe(4);
    for (const s of [W[D][0], W[D].at(-1)]) { const g = /(\d+) санының (\d+)-ші дәрежесінің/.exec(s.kz)!; expect(`${g[1]}^${g[2]}`).toBe('7^35'); }
  });
  it('цифры степеней в тексте пошаговых и примера совпадают с точными: 3¹…3⁵, 8¹…8⁴, 2 ряд', () => {
    const t = textOf(steps(D, 'faded')[0]).join(' ') + ' ' + textOf(steps(D, 'faded')[1]).join(' ');
    for (const [b, e] of [[3, 1], [3, 2], [3, 3], [3, 4], [3, 5], [8, 1], [8, 2], [8, 3], [8, 4]]) {
      const m = new RegExp(`${b}${SUP[e]} = (\\d+)`).exec(t);
      if (m) expect(m[1], `${b}^${e}`).toBe(String(BigInt(b) ** BigInt(e)));
    }
    const ex = JSON.stringify(one(D, 'example').frames);
    expect(ex).toContain('2   4   8   16   32   64   128');
  });
  it('мини-игра: цифра (BigInt) и длина периода (моделирование)', () => {
    const r = rng(104), b = one(D, 'blitz'), kinds = new Set<string>();
    for (let k = 0; k < 400; k++) {
      const it = b.make(r); let m: RegExpExecArray | null;
      if ((m = /^(\d+)([⁰¹²³⁴⁵⁶⁷⁸⁹]+) санының соңғы цифры/.exec(it.q))) { kinds.add('digit'); expect(it.choices[it.answer], it.q).toBe(String(lastOf(+m[1], unsup(m[2])))); expect(unsup(m[2])).toBeGreaterThanOrEqual(10); }
      else if ((m = /^(\d+) санының дәрежелері соңғы цифрларының периоды/.exec(it.q))) { kinds.add('cycle'); expect(it.choices[it.answer], it.q).toBe(String(cyc(+m[1]).length)); }
      else throw new Error(it.q);
    }
    expect([...kinds].sort()).toEqual(['cycle', 'digit']);
  });
});

// ───────────────────────── ответы: число в скобках ─────────────────────────
type Row = [number, number | null, number | null];
const RULES: Record<string, (a: number, m: number, b: number) => boolean> = {
  sum: (a, m, b) => a + b === m, prod: (a, m, b) => a * b === m, diff: (a, m, b) => a - b === m, dsum: (a, m, b) => 2 * a + 2 * b === m,
  prodA: (a, m, b) => a * (b + 1) === m, prodB: (a, m, b) => (a + 1) * b === m, sumA: (a, m, b) => a + a + b === m, sumB: (a, m, b) => a + b + b === m,
  sqA: (a, m, b) => a * a + b === m, sqAm: (a, m, b) => a * a - b === m, sqB: (a, m, b) => b * b + a === m, sqsum: (a, m, b) => a * a + b * b === m,
  sqdiff: (a, m, b) => (a - b) * (a + b) === m, sumsq: (a, m, b) => (a + b) ** 2 === m,
  sum_sq: (a, m, b) => a + b === m * m, diff_sq: (a, m, b) => a - b === m * m, sum_3m: (a, m, b) => a + b === 3 * m, prod_m: (a, m, b) => a === m * b,
};
const parseRowsLine = (text: string): Row[] => [...text.matchAll(/(\d+) \((\d+|\?)\) (\d+|\?)/g)].map(m => [+m[1], m[2] === '?' ? null : +m[2], m[3] === '?' ? null : +m[3]] as Row);
/** Неизвестное в третьей строке: общее значение всех правил, подходящих к двум полным; null — правила расходятся или не подходят ни одно. */
function bracketSolve(rows: Row[]): { value: number | null; rules: string[] } {
  const full = rows.slice(0, 2) as [number, number, number][], [a3, m3, b3] = rows[2];
  const fit = Object.entries(RULES).filter(([, f]) => full.every(([a, m, b]) => f(a, m, b)));
  const vals = new Set<number>();
  for (const [, f] of fit) for (let v = 1; v <= 700; v++) if (m3 === null ? f(a3, v, b3!) : f(a3, m3, v)) vals.add(v);
  return { value: vals.size === 1 ? [...vals][0] : null, rules: fit.map(([n]) => n) };
}
describe('pat.bracket: ответы пересчитаны по библиотеке правил', () => {
  const B = 'pat.bracket';
  it('финал: 19 + ? = 7 · 7 → 30; единственное правило «сумма = квадрат»; цель = финал', () => {
    const goal = W[B][0], fin = W[B].at(-1), rows = parseRowsLine(goal.task);
    expect(parseRowsLine(fin.kz)).toEqual(rows);
    const s = bracketSolve(rows);
    expect(s.value).toBe(30); expect(s.rules).toEqual(['sum_sq']); expect(ansOf(fin)).toBe('30');
    expect(19 + 30).toBe(49); expect(7 * 7).toBe(49); expect(26).toBe(19 + 7); expect(12).toBe(19 - 7); expect(3 * 7 - 19).toBe(2);
    expect([...fin.choices].sort()).toEqual(['12', '2', '26', '30', '49']);
  });
  it('пример: 3 (4) 13; 28 (6) 8; 18 (9) ? → 63 (правило «сумма = квадрат» единственное)', () => {
    const rows = parseRowsLine(one(B, 'example').frames[0].s.math), s = bracketSolve(rows);
    expect(s.value).toBe(63); expect(s.rules).toEqual(['sum_sq']);
    const fr = one(B, 'example').frames.map((x: any) => x.math ?? '').join(' ');
    for (const v of ['[16]', '[36]', '[81]', '[63]']) expect(fr).toContain(v);
  });
  it('пошаговые: 8 (4) 8; 20 (6) 16; 13 (5) ? → 12 и 12 (4) 3; 35 (5) 7; 54 (6) ? → 9', () => {
    const fd = steps(B, 'faded'), a = bracketSolve(parseRowsLine(fd[0].kz)), b = bracketSolve(parseRowsLine(fd[1].kz));
    expect(a.value).toBe(12); expect(a.rules).toEqual(['sum_sq']); expect(fd[0].steps.at(-1).math).toBe('Жауабы: 12');
    expect(b.value).toBe(9); expect(b.rules).toEqual(['prod_m']); expect(fd[1].steps.at(-1).math).toBe('Жауабы: 9');
  });
  it('предсказание: 6 (4) 10 подходят два правила, 9 (5) 16 оставляет одно', () => {
    const p = one(B, 'predict').reveal;
    expect(RULES.sum_sq(6, 4, 10)).toBe(true); expect(RULES.diff(10, 4, 6)).toBe(true);
    expect(RULES.sum_sq(9, 5, 16)).toBe(true); expect(RULES.diff(16, 5, 9)).toBe(false);
    expect(p).toContain('6 (4) 10'); expect(p).toContain('9 (5) 16');
  });
  it('ошибка Глитча: 5 (3) 4; 20 (6) 16; 10 (8) ? → 54, а не 6 (8 · 2 вместо 8 · 8)', () => {
    const bug = one(B, 'bug'), s = bracketSolve(parseRowsLine(bug.lines[0]));
    expect(s.value).toBe(54); expect(s.rules).toEqual(['sum_sq']); expect(bug.lines.at(-1)).toContain('6'); expect(bug.fix).toContain('54');
    expect(8 * 8).toBe(64); expect(8 * 2 - 10).toBe(6); expect(bug.bad).toBe(2);
  });
  it('мини-игра: ответ единственный среди всех подходящих правил', () => {
    const r = rng(105), b = one(B, 'blitz'), kinds = new Set<string>();
    for (let k = 0; k < 400; k++) {
      const it = b.make(r), rows = parseRowsLine(it.q);
      expect(rows).toHaveLength(3); kinds.add(rows[2][1] === null ? 'middle' : 'outer');
      const s = bracketSolve(rows);
      expect(s.value, it.q).not.toBeNull();
      expect(it.choices[it.answer], it.q).toBe(String(s.value));
    }
    expect([...kinds].sort()).toEqual(['middle', 'outer']);
  });
});

// ───────────────────────── голос (как в voice_lessons.test.ts, но для не озвученных уроков) ─────────────────────────
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
  it('правило с пропуском есть хотя бы у трёх уроков из пяти (вспомнить, а не перечитать)', () => {
    const n = IDS.filter(id => L[id].some((s, i) => s.type === 'rule' && planGaps(id, i, s)?.rule)).length;
    expect(n).toBeGreaterThanOrEqual(3);
  });
  it('кадры «Көр»: озвучиваются только кадры со сценой', () => {
    for (const [skill, st] of Object.entries(mine)) st.forEach((s, i) => { if (s.type === 'example') s.frames.forEach((_: any, k: number) => expect(byId.has(`${skill}_${i}_f${k}`)).toBe(true)); });
  });
});
