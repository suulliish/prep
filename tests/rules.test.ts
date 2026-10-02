// Правила знания (L1, 02.10): таблица сочетаний forModel, «свернул», «наспех» без исключения для подсказки,
// и что модель знаний (recordAttempt, windowStat) слушает forModel, а старые ответы без r судятся как раньше.
import { describe, it, expect } from 'vitest';
import { forModel, isClosed, isRushed, isHonest, AWAY_CLOSE_MS, RULES_V, type Verdict } from '../src/engine/rules';
import { recordAttempt, windowStat } from '../src/engine/progress';
import { tooFastMs } from '../src/engine/rush';
import type { Save, Attempt } from '../src/engine/types';

const newSave = (): Save => ({ version: 1, heroName: 'Кодер', xp: 0, skills: {}, attempts: [], days: {}, settings: { extraMissionCap: 4, extraTo: 'today', planMinutes: 40 }, diagnosticDone: false, repairShop: [] });
type A = Attempt & { selfCheck?: string };
const v2 = (p: Partial<A>): A => ({ at: 0, day: '2026-10-05', skill: 'a', source: 't', correct: true, hintLevel: 0, honest: true, timeMs: 20000, mode: 'practice', r: RULES_V, ...p });

describe('forModel: таблица сочетаний', () => {
  const rows: [string, Partial<A>, Verdict][] = [
    ['верно сам', {}, 'correct'],
    ['неверно сам', { correct: false }, 'wrong'],
    ['верно с наводкой (1)', { hintLevel: 1 }, 'correct'],
    ['верно после правила (2)', { hintLevel: 2 }, null],
    ['верно после первого шага (3)', { hintLevel: 3 }, null],
    ['неверно после правила', { correct: false, hintLevel: 2 }, 'wrong'],
    ['полный разбор, верно', { hintLevel: 4 }, null],
    ['полный разбор, неверно', { correct: false, hintLevel: 4 }, null],
    ['наспех, верно', { fast: true }, null],
    ['наспех, неверно', { correct: false, fast: true }, 'wrong'],
    ['наспех с подсказкой, верно', { fast: true, hintLevel: 1 }, null],
    ['свернул, верно', { closed: true }, 'wrong'],
    ['свернул, неверно', { correct: false, closed: true }, 'wrong'],
    ['«Білмеймін»', { correct: false, confidence: 'unsure' }, 'wrong'],
    ['сам поймал', { selfCheck: 'caught' }, 'wrong'],
    ['урок', { mode: 'lesson' }, null],
    ['задача после «Еске түсір»', { mode: 'recall' }, null],
    ['старый ответ, честный верный', { r: undefined }, 'correct'],
    ['старый ответ, честный неверный', { r: undefined, correct: false }, 'wrong'],
    ['старый ответ, нечестный', { r: undefined, honest: false, correct: false }, null],
    ['старый ответ с подсказкой 2 — как раньше', { r: undefined, hintLevel: 2 }, 'correct'],
  ];
  for (const [name, p, want] of rows) it(name, () => expect(forModel(v2(p))).toBe(want));
});

describe('свернул и наспех', () => {
  it('свернул — строго больше 5 с', () => {
    expect(isClosed(AWAY_CLOSE_MS)).toBe(false);
    expect(isClosed(AWAY_CLOSE_MS + 1)).toBe(true);
    expect(isClosed(undefined)).toBe(false);
  });
  it('порог наспех не зависит от подсказки и берёт больший из двух порогов', () => {
    expect(isRushed(tooFastMs(50) - 1, 50)).toBe(true);
    expect(isRushed(9000, 50, 12000)).toBe(true);
    expect(isRushed(13000, 50, 12000)).toBe(false);
  });
  it('честно: «Білмеймін» не быстрее 1,5 с, разбор и «свернул» — нет', () => {
    const f = { timeMs: 2000, hintLevel: 0, rushed: true, closed: false, dunno: true };
    expect(isHonest(f)).toBe(true);
    expect(isHonest({ ...f, timeMs: 1000 })).toBe(false);
    expect(isHonest({ ...f, closed: true })).toBe(false);
    expect(isHonest({ ...f, dunno: false })).toBe(false);
  });
});

describe('модель знаний слушает forModel', () => {
  it('наспех-ошибка опускает p и считается попыткой; наспех-верный не поднимает', () => {
    const s = newSave();
    recordAttempt(s, v2({ correct: false, fast: true, honest: false }));
    expect(s.skills.a.attempts).toBe(1); expect(s.skills.a.correct).toBe(0);
    const p = s.skills.a.p;
    recordAttempt(s, v2({ fast: true, honest: false }));
    expect(s.skills.a.p).toBe(p); expect(s.skills.a.attempts).toBe(1);
  });
  it('свернул и ответил верно — для модели ошибка', () => {
    const s = newSave();
    recordAttempt(s, v2({ closed: true, honest: false, away: 9000 }));
    expect(s.skills.a.attempts).toBe(1); expect(s.skills.a.correct).toBe(0);
  });
  it('задача после «Еске түсір» в модель не идёт, ошибка в ней всё равно в счётчике ловушек', () => {
    const s = newSave();
    recordAttempt(s, v2({ mode: 'recall', correct: false, tag: 'swap' }));
    expect(s.skills.a.attempts).toBe(0); expect(s.skills.a.misconceptions.swap).toBe(1);
  });
  it('проверка темы: наспех-ошибка проваливает проверку (раньше не считалась)', () => {
    const s = newSave();
    s.skills.a = { p: 0.96, status: 'learned', lessonDone: true, stage: 0, attempts: 20, correct: 19, misconceptions: {}, due: '2026-10-05', strict: true };
    expect(recordAttempt(s, v2({ correct: false, fast: true, honest: false }))).toContain('review_failed');
  });
  it('окно 85%: верное после правила и наспех-верные не входят, наспех-ошибки входят', () => {
    const at: A[] = [
      ...Array.from({ length: 10 }, () => v2({})),
      ...Array.from({ length: 5 }, () => v2({ hintLevel: 2 })),
      ...Array.from({ length: 5 }, () => v2({ fast: true })),
      ...Array.from({ length: 2 }, () => v2({ correct: false, fast: true })),
    ];
    expect(windowStat(at, 'a')).toMatchObject({ n: 12, clean: 10 });
  });
  it('старые ответы (без r) судятся прежним фильтром: окно то же, что до L1', () => {
    const old: A[] = [
      ...Array.from({ length: 8 }, () => v2({ r: undefined })),
      v2({ r: undefined, hintLevel: 2 }),                 // в окно, но не чистый
      v2({ r: undefined, honest: false, correct: false }), // нечестный — мимо окна
      v2({ r: undefined, selfCheck: 'caught' }),          // в окно, не чистый
    ];
    expect(windowStat(old, 'a')).toMatchObject({ n: 10, clean: 8 });
  });
});
