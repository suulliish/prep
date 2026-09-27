import { describe, it, expect } from 'vitest';
import { bktUpdate, MASTERY_P } from '../src/engine/bkt';
import { addSchoolDays, schoolDaysBetween } from '../src/engine/dates';
import { recordAttempt, refreshAvailability, blankSkill, dueSkills } from '../src/engine/progress';
import { buildPlan, settleDay, blankDay, isHonest, canStartExtra } from '../src/engine/planner';
import type { Save, Attempt } from '../src/engine/types';

const newSave = (): Save => ({ version: 1, heroName: 'Кодер', xp: 0, skills: {}, attempts: [], days: {}, settings: { extraMissionCap: 4, extraTo: 'today', planMinutes: 40 }, diagnosticDone: false, repairShop: [] });
const defs = [
  { id: 'a', prereqs: [], weight: 3, cat: 'C', grade: 5, templates: ['t'] },
  { id: 'b', prereqs: ['a'], weight: 3, cat: 'C', grade: 5, templates: ['t'] },
];
const att = (p: Partial<Attempt>): Attempt => ({ at: 0, day: '2026-10-19', skill: 'a', source: 't', correct: true, hintLevel: 0, honest: true, timeMs: 20000, mode: 'practice', ...p });

describe('BKT', () => {
  it('верные ответы повышают вероятность, неверные — понижают', () => {
    expect(bktUpdate(0.3, true)).toBeGreaterThan(0.3);
    expect(bktUpdate(0.8, false)).toBeLessThan(0.8);
  });
  it('с подсказкой рост меньше, после полного разбора — нет', () => {
    expect(bktUpdate(0.3, true, { hintLevel: 2 })).toBeLessThan(bktUpdate(0.3, true));
    expect(bktUpdate(0.3, true, { hintLevel: 4 })).toBe(0.3);
  });
  it('серия верных ответов доводит до освоения', () => {
    let p = 0.1, n = 0; while (p < MASTERY_P && n < 50) { p = bktUpdate(p, true); n++; }
    expect(n).toBeGreaterThanOrEqual(4); expect(n).toBeLessThan(15);
  });
});

describe('даты', () => {
  it('учебные дни пропускают выходные', () => {
    expect(addSchoolDays('2026-10-23', 1)).toBe('2026-10-26'); // пятница → понедельник
    expect(schoolDaysBetween('2026-10-23', '2026-10-26')).toBe(1);
  });
});

describe('прогресс', () => {
  it('навык открывается, когда предпосылка освоена', () => {
    const s = newSave(); refreshAvailability(s, defs);
    expect(s.skills.a.status).toBe('available'); expect(s.skills.b.status).toBe('locked');
    for (let i = 0; i < 20 && s.skills.a.status !== 'learned'; i++) recordAttempt(s, att({}), { guess: 0.2 });
    expect(s.skills.a.status).toBe('learned');
    refreshAvailability(s, defs); expect(s.skills.b.status).toBe('available');
  });
  it('кристаллизация — только на следующий учебный день и без подсказок', () => {
    const s = newSave(); refreshAvailability(s, defs);
    for (let i = 0; i < 20 && s.skills.a.status !== 'learned'; i++) recordAttempt(s, att({}), { guess: 0.2 });
    expect(s.skills.a.due).toBe('2026-10-20');
    expect(dueSkills(s, '2026-10-19')).toEqual([]);
    const ev = recordAttempt(s, att({ day: '2026-10-20' }), { guess: 0.2 });
    expect(ev).toContain('crystal'); expect(s.skills.a.status).toBe('mastered');
  });
  it('нужно минимум 6 честных попыток и 3 последних чистых', () => {
    const s = newSave(); refreshAvailability(s, defs);
    for (let i = 0; i < 5; i++) recordAttempt(s, att({}));
    expect(s.skills.a.status).toBe('learning');
    recordAttempt(s, att({}));
    expect(s.skills.a.status).toBe('learned');
  });
  it('нечестная попытка не меняет модель', () => {
    const s = newSave(); refreshAvailability(s, defs);
    recordAttempt(s, att({ honest: false }), { guess: 0.2 });
    expect(s.skills.a.p).toBe(0.1);
  });
});

describe('заработок', () => {
  it('полный план = 60 + 48, половина — пропорционально', () => {
    const s = newSave(); refreshAvailability(s, defs);
    const plan = buildPlan(s, defs as any, '2026-10-19');
    const rec = blankDay('2026-10-19');
    for (const b of plan.blocks) rec.blocksDone[b.id] = true;
    settleDay(rec, plan, 'today');
    expect(rec.minutesToday).toBe(60); expect(rec.minutesWeekend).toBe(48);
    expect(canStartExtra(rec, plan, 4)).toBe(true);
    rec.extraMissions = 2; settleDay(rec, plan, 'today');
    expect(rec.minutesToday).toBe(90);
    expect(canStartExtra({ ...rec, extraMissions: 4 }, plan, 4)).toBe(false);
  });
  it('угадывание быстрее 5 секунд — нечестно', () => {
    expect(isHonest(3000, 0)).toBe(false); expect(isHonest(12000, 4)).toBe(false); expect(isHonest(12000, 2)).toBe(true);
  });
});
