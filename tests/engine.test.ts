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

import { streak } from '../src/engine/streak';
describe('серия дней', () => {
  it('выходные не рвут серию, исключение засчитывается, пропуск съедает заморозку', () => {
    const s = newSave();
    s.attempts.push(att({ day: '2026-10-12' }));
    for (const d of ['2026-10-12', '2026-10-13', '2026-10-15', '2026-10-16', '2026-10-19']) s.days[d] = { ...blankDay(d), planShare: 1 };
    s.days['2026-10-20'] = { ...blankDay('2026-10-20'), exception: 'sick' };
    const r = streak(s, '2026-10-20');
    expect(r.days).toBe(6); expect(r.freezesLeft).toBe(1); // 14-е пропущено → заморозка
  });
});

import { addMasteryBonus, MASTERY_BONUS_DAY_CAP } from '../src/engine/planner';
describe('бонус за освоение', () => {
  it('+10 за событие, не больше лимита в день, подарок командира не считается', () => {
    const rec = { date: '2026-10-20', blocksDone: {}, planShare: 0, minutesToday: 0, minutesWeekend: 0, extraMissions: 0, bonuses: [{ reason: 'Подарок командира', minutes: 15 }] } as any;
    expect(addMasteryBonus(rec, 'a')).toBe(10);
    expect(addMasteryBonus(rec, 'b')).toBe(10);
    expect(addMasteryBonus(rec, 'c')).toBe(0);
    expect(rec.bonuses.filter((b: any) => b.mastery).reduce((s: number, b: any) => s + b.minutes, 0)).toBe(MASTERY_BONUS_DAY_CAP);
  });
});

import { nextSkill } from '../src/engine/planner';
describe('новая тема только с уроком', () => {
  it('тему без полного урока не даёт как новую', () => {
    const defs: any[] = [
      { id: 'a', prereqs: [], weight: 3, cat: 'C', grade: 5, templates: ['t'], lesson: false },
      { id: 'b', prereqs: [], weight: 2, cat: 'D', grade: 5, templates: ['t'], lesson: true },
    ];
    const save: any = { skills: {} }; refreshAvailability(save, defs);
    expect(nextSkill(save, defs)).toBe('b');
    save.skills.b.status = 'learned'; save.skills.b.lessonDone = true;
    expect(nextSkill(save, defs)).toBe(null);
  });
});

import { taught } from '../src/engine/planner';
describe('урок сначала (решение семьи 28.09.2026)', () => {
  it('тема, которую диагностика признала знакомой, всё равно идёт через урок и не попадает в разминку до урока', () => {
    const s = newSave(); refreshAvailability(s, defs);
    Object.assign(s.skills.a, { status: 'learned', p: 0.95, lessonDone: false, learnedAt: '2026-10-19', due: '2026-10-20' });
    expect(taught(s, defs, 'a')).toBe(false);
    expect(nextSkill(s, defs)).toBe('a');
    const plan = buildPlan(s, defs, '2026-10-20');
    expect(plan.blocks.find(b => b.id === 'new')).toMatchObject({ skills: ['a'], lesson: true });
    expect(plan.blocks.find(b => b.id === 'warmup')).toBeUndefined();
    s.skills.a.lessonDone = true;
    refreshAvailability(s, defs);
    const plan2 = buildPlan(s, defs, '2026-10-20');
    expect(plan2.blocks.find(b => b.id === 'warmup')?.skills).toContain('a');
    expect(nextSkill(s, defs)).toBe('b');
  });
});
