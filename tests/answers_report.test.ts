// Командир, вкладка «Ответы»: сводка дня, список по дням, что ломает корабль, названия ошибок.
import { describe, it, expect } from 'vitest';
import { daySummary, recentByDay, attemptDays, repairCauses, confLabel, hintLabel } from '../src/engine/answers';
import { mistakeName, MISTAKE_NAMES } from '../src/engine/mistakeNames';
import type { Attempt, Save } from '../src/engine/types';
// @ts-ignore
import { MISCONCEPTIONS } from '../content/misconceptions.mjs';

const att = (p: Partial<Attempt>): Attempt => ({ at: 1, day: '2026-10-01', skill: 'a', source: 't', correct: true, hintLevel: 0, honest: true, timeMs: 12000, mode: 'practice', ...p });
const save = (attempts: Attempt[], extra: Partial<Save> = {}): Save => ({ version: 1, heroName: 'Т', xp: 0, skills: {}, attempts, days: {}, settings: { extraMissionCap: 1, extraTo: 'today', planMinutes: 60 }, diagnosticDone: true, repairShop: [], ...extra });

describe('названия ошибок', () => {
  it('особые метки', () => {
    expect(mistakeName('arith')).toBe('ошибка в счёте');
    expect(mistakeName('random')).toContain('случайный');
    expect(mistakeName('off_by_one')).toBe('ошибка на единицу');
    expect(mistakeName(undefined)).toContain('Білмеймін');
    expect(mistakeName('нет_такой')).toContain('нет_такой');
  });
  it('у каждой метки из content/misconceptions.mjs есть русское название', () => {
    for (const k of Object.keys(MISCONCEPTIONS)) expect(MISTAKE_NAMES[k], k).toBeTruthy();
  });
  it('в названиях нет длинного тире', () => {
    for (const v of Object.values(MISTAKE_NAMES)) expect(v).not.toContain('—');
  });
});

describe('сводка дня', () => {
  const list = [
    att({ at: 1 }), att({ at: 2, timeMs: 3000 }), att({ at: 3, correct: false, tag: 'arith', timeMs: 4000 }),
    att({ at: 4, correct: false, tag: 'arith', skill: 'b' }), att({ at: 5, correct: false, tag: 'sign' }), att({ at: 6, hintLevel: 1 }),
    att({ at: 7, correct: false, confidence: 'unsure' }), att({ at: 8, day: '2026-09-30', correct: false, tag: 'arith' }),
  ];
  const mk = () => save(list, { skills: {
    a: { p: 1, status: 'learned', lessonDone: true, stage: 0, attempts: 9, correct: 9, misconceptions: {}, learnedAt: '2026-09-20' },
    b: { p: 0.5, status: 'learning', lessonDone: true, stage: 0, attempts: 3, correct: 1, misconceptions: {} },
  } });
  it('точность с первой попытки, доля быстрых, топ ошибок', () => {
    const s = daySummary(mk(), '2026-10-01');
    expect(s.n).toBe(7); expect(s.clean).toBe(2); expect(s.cleanPct).toBe(29);
    expect(s.fast).toBe(2); expect(s.fastPct).toBe(29);
    expect(s.topErrors.map(e => [e.name, e.n])).toEqual([['ошибка в счёте', 2], ['ошибка в знаке', 1], ['не ответил («Білмеймін»)', 1]]);
  });
  it('небрежность: ошибки в счёте только на уже выученных темах', () => {
    expect(daySummary(mk(), '2026-10-01').careless).toEqual([{ skill: 'a', n: 1 }]);   // b ещё изучается
  });
  it('небрежность: не в день, когда тему только выучили, и не по теме, которая снова изучается', () => {
    const s = mk();
    s.skills.a.learnedAt = '2026-10-01';
    expect(daySummary(s, '2026-10-01').careless).toEqual([]);
    Object.assign(s.skills.a, { learnedAt: '2026-09-20', status: 'learning' });
    expect(daySummary(s, '2026-10-01').careless).toEqual([]);
  });
  it('день без ответов', () => {
    const s = daySummary(mk(), '2026-01-01'); expect(s.n).toBe(0); expect(s.cleanPct).toBeNull(); expect(s.topErrors).toEqual([]);
  });
});

describe('список и подписи', () => {
  it('последние 100 ответов по дням, новые сверху', () => {
    const all = Array.from({ length: 150 }, (_, i) => att({ at: i, day: i < 60 ? '2026-09-29' : i < 110 ? '2026-09-30' : '2026-10-01' }));
    const g = recentByDay(all, 100);
    expect(g.map(x => [x.day, x.list.length])).toEqual([['2026-10-01', 40], ['2026-09-30', 50], ['2026-09-29', 10]]);   // 50 самых старых из 150 отброшены
    expect(g.reduce((n, x) => n + x.list.length, 0)).toBe(100);
    expect(g[0].list[0].at).toBe(149);
    expect(attemptDays(all)).toEqual(['2026-10-01', '2026-09-30', '2026-09-29']);
  });
  it('уверенность и подсказки', () => {
    expect([confLabel('sure'), confLabel('maybe'), confLabel('unsure'), confLabel(undefined)]).toEqual(['Сенімдімін', 'Шамамен', 'Білмеймін', '—']);
    expect([hintLabel(0), hintLabel(2), hintLabel(4)]).toEqual(['', 'подсказка 2', 'полный разбор']);
  });
});

describe('что ломает корабль', () => {
  it('темы по числу поломок, с открытыми и ошибками истории', () => {
    const r = (skill: string, fixed = false) => ({ source: 's', skill, addedDay: 'd', fixed });
    const s = save([att({ correct: false, skill: 'x' }), att({ correct: false, skill: 'x' }), att({ correct: false, skill: 'y' }), att({ correct: false, skill: 'z' })],
      { repairShop: [r('x'), r('x', true), r('y'), r('x')] });
    expect(repairCauses(s)).toEqual([{ skill: 'x', total: 3, open: 2, wrong: 2 }, { skill: 'y', total: 1, open: 1, wrong: 1 }]);
  });
});
