// L2 (docs/systems/IMPLEMENTATION.md, решение семьи 02.10): финал урока — новая задача из генератора, ответы шагов урока идут в историю (mode 'lesson'),
// но ничего в практике не меняют: ни темп, ни точность, ни «дни на теме», ни список ответов командира.
import { describe, it, expect } from 'vitest';
import { newFinalTask, finalFor, lessonAttempt, FINAL_MAX_DIFF } from '../src/lesson/finalTask';
import { makeItem, templatesOf } from '../src/engine/items';
import { forModel, isPracticeAttempt, AWAY_CLOSE_MS } from '../src/engine/rules';
import { adaptiveRushMs } from '../src/engine/rush';
import { daySummary, recentByDay, attemptDays, repairCauses } from '../src/engine/answers';
import { stuckSkills, practiceTopic } from '../src/engine/planner';
import { backfill } from '../src/engine/recall';
import { windowStat } from '../src/engine/progress';
import type { Attempt, Save } from '../src/engine/types';
// @ts-ignore
import { LESSONS } from '../content/lessons.mjs';
// @ts-ignore
import { templates } from '../content/templates/index.mjs';

const L = LESSONS as Record<string, any[]>;
const DIFF: Record<string, number> = Object.fromEntries((templates as any[]).map(t => [t.id, t.difficulty]));
const att = (p: Partial<Attempt>): Attempt => ({ at: 1, day: '2026-10-05', skill: 'a', source: 't', correct: true, hintLevel: 0, honest: true, timeMs: 12000, mode: 'practice', ...p });
const lesson = (p: Partial<Attempt> = {}) => ({ ...lessonAttempt({ skill: 'a', step: 3, day: '2026-10-05', correct: true, timeMs: 8000, awayMs: 0 }), ...p });
const save = (attempts: Attempt[], extra: Partial<Save> = {}): Save => ({ version: 1, heroName: 'Т', xp: 0, skills: {}, attempts, days: {}, settings: { extraMissionCap: 1, extraTo: 'today', planMinutes: 60 }, diagnosticDone: true, repairShop: [], ...extra });

describe('запись ответа урока', () => {
  it('mode lesson, r:2, источник lesson:навык:шаг, без подсказки', () => {
    const a = lessonAttempt({ skill: 'div.gcd', step: 9, day: '2026-10-05', correct: false, timeMs: 8123.6, awayMs: 0, tag: 'x' });
    expect(a).toMatchObject({ mode: 'lesson', r: 2, source: 'lesson:div.gcd:9', skill: 'div.gcd', correct: false, hintLevel: 0, honest: true, timeMs: 8124, tag: 'x' });
    expect(a.closed).toBeUndefined();
  });
  it('свернул дольше 5 с: closed и нечестный; ровно 5 с ещё можно', () => {
    expect(lessonAttempt({ skill: 'a', step: 1, day: 'd', correct: true, timeMs: 1, awayMs: AWAY_CLOSE_MS + 1 })).toMatchObject({ closed: true, honest: false, away: AWAY_CLOSE_MS + 1 });
    expect(lessonAttempt({ skill: 'a', step: 1, day: 'd', correct: true, timeMs: 1, awayMs: AWAY_CLOSE_MS }).closed).toBeUndefined();
  });
  it('модель знаний ответ урока не видит (ни верный, ни неверный, ни свёрнутый)', () => {
    for (const correct of [true, false]) for (const awayMs of [0, 9000]) expect(forModel(lessonAttempt({ skill: 'a', step: 1, day: 'd', correct, timeMs: 5000, awayMs }))).toBeNull();
  });
  it('isPracticeAttempt: урок — нет, всё остальное — да', () => {
    expect(isPracticeAttempt(lesson())).toBe(false);
    // ответ со старым mode 'lesson' без источника lesson: (до 02.10) — обычный ответ практики
    expect(isPracticeAttempt(att({ mode: 'lesson', source: 'x' }))).toBe(true);
    for (const mode of ['practice', 'warmup', 'mixed', 'boss', 'diagnostic', 'extra', 'mock', 'recall'] as const) expect(isPracticeAttempt(att({ mode })), mode).toBe(true);
  });
});

describe('финал: новая задача из генератора', () => {
  const skills = Object.keys(L);
  const withGen = skills.filter(s => templatesOf(s).length > 0);
  it('у большинства тем с уроком есть генератор; темы без него возвращают null (авторский финал остаётся)', () => {
    expect(withGen.length).toBeGreaterThanOrEqual(30);
    for (const s of skills.filter(x => !withGen.includes(x))) expect(newFinalTask(s, ''), s).toBeNull();
  });
  it('задача годна для экрана финала: 2–5 разных вариантов, ответ в диапазоне, есть разбор, нет рисунка', () => {
    for (const s of withGen) for (let k = 0; k < 25; k++) {
      const t = newFinalTask(s, L[s].at(-1).kz);
      if (!t) continue;   // темы, где все шаблоны с рисунком, — авторский финал
      expect(t.kz.length, s).toBeGreaterThan(0);
      expect(t.choices.length, s).toBeGreaterThanOrEqual(2); expect(t.choices.length, s).toBeLessThanOrEqual(5);
      expect(new Set(t.choices).size, `${s}: повторы вариантов ${t.choices}`).toBe(t.choices.length);
      expect(Number.isInteger(t.answer) && t.answer >= 0 && t.answer < t.choices.length, `${s}: answer`).toBe(true);
      expect(t.why.length, `${s}: разбор`).toBeGreaterThan(0);
      expect(t.tags.length).toBe(t.choices.length);
    }
  });
  it('почти для каждой темы с генератором финал реально новый (null — только если все шаблоны с рисунком)', () => {
    const nulls = withGen.filter(s => { for (let k = 0; k < 30; k++) if (newFinalTask(s, L[s].at(-1).kz)) return false; return true; });
    // рисунок (vis.count_squares) или только сложные шаблоны (sets.venn, div.trailing_zeros, logic.page_digits): остаётся авторский финал
    expect(nulls.length, `без нового финала: ${nulls}`).toBeLessThanOrEqual(6);
  });
  it('это не цель урока: текст задачи не совпадает с авторским финалом', () => {
    for (const s of withGen.slice(0, 20)) { const t = newFinalTask(s, L[s].at(-1).kz); if (t) expect(t.kz, s).not.toBe(L[s].at(-1).kz); }
  });
  it('числа новой задачи не совпадают с целью урока и авторским финалом (иначе «новая» — старая с тем же ответом)', () => {
    const nums = (t: string) => (t.replace(/(\d) (?=\d{3}(?!\d))/g, '$1').match(/\d+(?:[.,]\d+)?/g) ?? []).sort().join('|');
    let checked = 0;
    for (const s of withGen) {
      const goal = L[s].find(x => x.type === 'goal'), fin = L[s].at(-1), avoid = [fin.kz, goal.task ?? '', goal.kz ?? ''];
      const bad = new Set(avoid.map(nums).filter(Boolean));
      for (let k = 0; k < 40; k++) { const t = newFinalTask(s, avoid); if (t) { expect(bad.has(nums(t.kz)), `${s}: ${t.kz}`).toBe(false); checked++; } }
    }
    expect(checked).toBeGreaterThan(1000);
  });
  it('передаёт maxDiff и берёт только простые шаблоны', () => {
    const seen: any[] = [];
    newFinalTask('div.gcd', 'x', (sk, o) => { seen.push(o); return makeItem(sk, o); });
    expect(seen[0]).toMatchObject({ avoidKz: 'x', maxDiff: FINAL_MAX_DIFF });
  });
  it('пропускает задачи с рисунком и сдаётся после 8 попыток', () => {
    let n = 0;
    const fig = (() => { n++; return { source: 't', skill: 's', kz: 'q', ru: 'q', choices: [{ text: '1', tag: 'a' }, { text: '2', tag: 'b' }], answer: 0, hints: [], sol: { kz: 's', ru: 's' }, figure: { kind: 'svg' } }; }) as any;
    expect(newFinalTask('s', '', fig)).toBeNull(); expect(n).toBe(8);
  });
});

describe('makeItem maxDiff', () => {
  it('выдаёт шаблоны не сложнее заданной қиындық, если такие у навыка есть', () => {
    let checked = 0;
    for (const s of Object.keys(L)) {
      const ids = templatesOf(s); if (!ids.some(id => (DIFF[id] ?? 1) <= 2)) continue;
      for (let k = 0; k < 15; k++) { const it = makeItem(s, { maxDiff: 2 })!; expect(DIFF[it.source] ?? 1, `${s}: ${it.source}`).toBeLessThanOrEqual(2); checked++; }
    }
    expect(checked).toBeGreaterThan(100);
  });
  it('если у навыка только сложные шаблоны — null (остаётся авторский финал), а не олимпиадная задача', () => {
    const hard = Object.keys(L).filter(s => templatesOf(s).length && templatesOf(s).every(id => (DIFF[id] ?? 1) > FINAL_MAX_DIFF));
    expect(hard.length).toBeGreaterThan(0);
    for (const s of hard) { expect(makeItem(s, { maxDiff: FINAL_MAX_DIFF }), s).toBeNull(); expect(newFinalTask(s, ''), s).toBeNull(); }
  });
});

describe('ответы урока не меняют практику', () => {
  const lessonBurst = [1, 2, 3, 4, 5].map(i => lesson({ at: 100 + i, step: i, source: `lesson:a:${i}`, correct: i % 2 === 0 }));
  it('личный порог спешки: быстрые ответы урока не снижают порог', () => {
    const practice = [1, 2, 3].map(i => att({ at: i, timeMs: 20000 }));
    const fastLesson = [1, 2, 3, 4].map(i => lesson({ at: 10 + i, timeMs: 800 }));
    expect(adaptiveRushMs([...practice, ...fastLesson], 'tpl', 'a')).toBe(adaptiveRushMs(practice, 'tpl', 'a'));
    expect(adaptiveRushMs(fastLesson, 'lesson:a:3', 'a')).toBeNull();   // одни ответы урока порога не дают
  });
  it('сводка дня и «Ответы» командира: урока нет', () => {
    const practice = [att({ at: 1 }), att({ at: 2, correct: false, tag: 'arith' })];
    const s = save([...practice, ...lessonBurst]);
    expect(daySummary(s, '2026-10-05').n).toBe(2);
    expect(daySummary(save(practice), '2026-10-05')).toEqual(daySummary(s, '2026-10-05'));
    expect(recentByDay(s.attempts).flatMap(g => g.list).length).toBe(2);
    expect(attemptDays([...lessonBurst])).toEqual([]);
  });
  it('поломки корабля: ошибки в уроке не считаются причиной', () => {
    const s = save([att({ correct: false }), lesson({ correct: false })], { repairShop: [{ source: 't', skill: 'a', addedDay: '2026-10-05' }] });
    expect(repairCauses(s)[0].wrong).toBe(1);
  });
  it('дни на теме и «последняя тема практики»: день урока не считается занятием', () => {
    const defs: any[] = [{ id: 'a', templates: ['t1'] }];
    const sk = { p: 0.3, status: 'learning', lessonDone: true, stage: 0, attempts: 0, correct: 0, misconceptions: {} } as any;
    // 3 дня практики + день урока = всего 3 занятия, застрявшей тема (4 дня) не считается
    const days = ['2026-10-01', '2026-10-02', '2026-10-05'].map((d, i) => att({ day: d, at: i + 1 }));
    expect(stuckSkills(save([...days, lesson({ day: '2026-09-30', at: 0 })], { skills: { a: sk } }), defs)).toEqual([]);
    expect(stuckSkills(save([...days, att({ day: '2026-10-06', at: 9 })], { skills: { a: sk } }), defs)).toEqual(['a']);
  });
  it('практика темы после урока без практики: нечего выбирать', () => {
    const defs: any[] = [{ id: 'a', templates: ['t1'], title: { kz: 'a', ru: 'a' } }];
    const sk = { p: 0.3, status: 'learning', lessonDone: true, stage: 0, attempts: 0, correct: 0, misconceptions: {} } as any;
    expect(practiceTopic(save([lesson()], { skills: { a: sk } }), defs)).toBeNull();
  });
  it('в «Еске түсір» дата освоения не сдвигается на день урока', () => {
    const sk = { p: 1, status: 'learned', lessonDone: true, stage: 0, attempts: 9, correct: 9, misconceptions: {} } as any;
    const s = save([lesson({ day: '2026-09-28' }), att({ day: '2026-10-02' })], { skills: { a: sk } });
    backfill(s, '2026-10-05');
    expect(s.recall?.a?.learnedDay).toBe('2026-10-02');
  });
  it('окно 85%: ответы урока не входят', () => {
    const practice = Array.from({ length: 16 }, (_, i) => att({ at: i, r: 2 }));
    expect(windowStat([...practice, ...lessonBurst], 'a')).toEqual(windowStat(practice, 'a'));
  });
});

describe('финал после выхода и входа: та же задача, тот же ответ', () => {
  const avoid = ['x'];
  it('первый вход даёт задачу, повторный вход на том же шаге возвращает то же состояние', () => {
    const first = finalFor(undefined, 'div.gcd', 10, avoid);
    expect(first.task).not.toBeNull(); expect(first.res).toBeUndefined();
    const lp = { skill: 'div.gcd', step: 10, final: { ...first, res: 'missed' as const, pick: 2 } };
    const again = finalFor(lp, 'div.gcd', 10, avoid);
    expect(again).toBe(lp.final);   // ни новой задачи, ни стёртого ответа
  });
  it('другой шаг или другая тема — новая задача', () => {
    const lp = { skill: 'div.gcd', step: 10, final: { task: null, res: 'won' as const, pick: 0 } };
    expect(finalFor(lp, 'div.gcd', 9, avoid).res).toBeUndefined();
    expect(finalFor(lp, 'div.lcm', 10, avoid).res).toBeUndefined();
    expect(finalFor({ skill: 'div.gcd', step: 10 }, 'div.gcd', 10, avoid).res).toBeUndefined();   // позиция без финала (вышел раньше)
  });
  it('у навыка без генератора состояние тоже хранится: перезаход не даёт второй попытки', () => {
    const s = finalFor(undefined, 'vis.count_squares', 11, avoid); expect(s.task).toBeNull();
    const lp = { skill: 'vis.count_squares', step: 11, final: { ...s, res: 'won' as const, pick: 1 } };
    expect(finalFor(lp, 'vis.count_squares', 11, avoid).res).toBe('won');
  });
});
