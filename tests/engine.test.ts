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
  it('нужно минимум 15 честных ответов в окне, 3 последних чистых', () => {
    const s = newSave(); refreshAvailability(s, defs);
    for (let i = 0; i < 14; i++) recordAttempt(s, att({}));
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
    expect(rec.minutesToday).toBe(75);                     // доп. минут не больше 15 в день
    expect(canStartExtra({ ...rec, extraMissions: 1 }, plan, 4)).toBe(false);
  });
  it('доп. миссия наспех не даёт минут: 15 × доля честных ответов', () => {
    const s = newSave(); refreshAvailability(s, defs);
    const plan = buildPlan(s, defs as any, '2026-10-19');
    const rec = blankDay('2026-10-19');
    for (const b of plan.blocks) rec.blocksDone[b.id] = true;
    rec.extraMissions = 1; rec.extraHonest = 0.1; settleDay(rec, plan, 'today');
    expect(rec.minutesToday).toBe(60);                     // 15 × 0.1 = 1.5 → округление до 5 = 0
    rec.extraMissions = 2; rec.extraHonest = 1.1; settleDay(rec, plan, 'today');
    expect(rec.minutesToday).toBe(75);                     // честная вторая миссия: +15
    delete rec.extraHonest; settleDay(rec, plan, 'today');
    expect(rec.minutesToday).toBe(75);                     // старое сохранение без поля — миссии честные, но доп. минут всё равно не больше 15
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
  it('две заморозки в КАЖДОМ месяце: 2 пропуска в октябре и 2 в ноябре серию не рвут, третий за месяц — рвёт', () => {
    const s = newSave();
    const all: string[] = [];
    for (let d = new Date('2026-10-01T12:00:00Z'); d <= new Date('2026-11-30T12:00:00Z'); d.setUTCDate(d.getUTCDate() + 1)) all.push(d.toISOString().slice(0, 10));
    const skip = ['2026-10-07', '2026-10-21', '2026-11-04', '2026-11-18'];
    for (const d of all) if (!skip.includes(d)) s.days[d] = { ...blankDay(d), planShare: 1 };
    const r = streak(s, '2026-11-30');
    expect(r.freezesLeft).toBe(0);
    expect(r.days).toBeGreaterThan(35);   // серия идёт до начала истории
    delete s.days['2026-11-25'];          // третий пропуск в ноябре
    expect(streak(s, '2026-11-30').days).toBe(16);  // назад от 30.11: пропуски 25 и 18 — заморозки, 4.11 — третий за ноябрь, серия обрывается
  });
  it('длинная серия (больше 286 учебных дней) не обрывается на пределе цикла', () => {
    const s = newSave();
    for (let d = new Date('2026-10-01T12:00:00Z'); d <= new Date('2028-05-12T12:00:00Z'); d.setUTCDate(d.getUTCDate() + 1)) { const k = d.toISOString().slice(0, 10); s.days[k] = { ...blankDay(k), planShare: 1 }; }
    expect(streak(s, '2028-05-12').days).toBeGreaterThan(400);
  });
});

describe('минуты: 60 за план + 15 за одну доп. миссию, без бонусов за освоение', () => {
  const plan = { day: '2026-10-20', blocks: [{ id: 'new', minutes: 18, skills: [], items: 10 }, { id: 'summary', minutes: 2, skills: [], items: 0 }] } as any;
  it('план целиком и 4 доп. миссии — всё равно 75', () => {
    const rec = { ...blankDay('2026-10-20'), blocksDone: { new: true, summary: true }, extraMissions: 4, extraHonest: 4 } as any;
    settleDay(rec, plan, 'today'); expect(rec.minutesToday).toBe(75);
  });
  it('бонусы в записи дня минут не дают: ни старые за освоение, ни подарки командира (подарков нет, 02.10)', () => {
    const rec = { ...blankDay('2026-10-20'), blocksDone: { new: true, summary: true }, bonuses: [{ reason: 'Тема освоена', minutes: 10, mastery: true }, { reason: 'Подарок командира', minutes: 15 }] } as any;
    settleDay(rec, plan, 'today'); expect(rec.minutesToday).toBe(60);
  });
  it('вторую доп. миссию начать нельзя, даже если в настройках 4', () => {
    const rec = { ...blankDay('2026-10-20'), blocksDone: { new: true, summary: true }, extraMissions: 1 } as any;
    expect(canStartExtra(rec, plan, 4)).toBe(false);
    expect(canStartExtra({ ...rec, extraMissions: 0 }, plan, 4)).toBe(true);
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
    const plan = buildPlan(s, defs, '2026-10-21');   // среда: день новой темы (C1)
    expect(plan.blocks.find(b => b.id === 'new')).toMatchObject({ skills: ['a'], lesson: true });
    expect(plan.blocks.find(b => b.id === 'warmup')).toBeUndefined();
    s.skills.a.lessonDone = true;
    refreshAvailability(s, defs);
    const plan2 = buildPlan(s, defs, '2026-10-21');
    expect(plan2.blocks.find(b => b.id === 'warmup')?.skills).toContain('a');
    expect(nextSkill(s, defs)).toBe('b');
  });
});

// research D1 (30.09): минуты шага — по доле честных ответов, шаг засчитывается всегда
import { buildPlan as _bp, settleDay as _sd, blankDay as _bd } from '../src/engine/planner';
describe('минуты за честные ответы', () => {
  it('половина ответов наугад — половина минут шага; без записи — полные минуты', () => {
    const plan = { day: '2026-10-05', blocks: [{ id: 'warmup', minutes: 10, skills: [], items: 5 }, { id: 'new', minutes: 10, skills: [], items: 5 }] } as any;
    const a = _bd('2026-10-05'); a.blocksDone = { warmup: true, new: true }; _sd(a, plan, 'today');
    const b = _bd('2026-10-05'); b.blocksDone = { warmup: true, new: true }; b.honest = { warmup: 0.5 }; _sd(b, plan, 'today');
    expect(b.planShare).toBeCloseTo(0.75);
    expect(b.minutesToday).toBeLessThan(a.minutesToday);
  });
});

import { stuckSkills, STUCK_DAYS } from '../src/engine/planner';
describe('застрявшая тема не держит путь (порог 85%, вариант A)', () => {
  it(`после ${STUCK_DAYS} дней занятий без «выучено» открывается следующая тема, застрявшая идёт в разминку`, () => {
    const defs: any[] = [{ id: 'a', prereqs: [], weight: 3, cat: 'C', grade: 5, templates: ['t'] }, { id: 'c', prereqs: [], weight: 2, cat: 'C', grade: 5, templates: ['t'] }];
    const s = newSave(); refreshAvailability(s, defs);
    const first = nextSkill(s, defs as any)!;
    s.skills[first] = { ...(s.skills[first] ?? {}), status: 'learning', lessonDone: true, p: 0.6, attempts: 0, correct: 0, misconceptions: {}, stage: 0 } as any;
    const days = ['2026-10-01', '2026-10-02', '2026-10-03'];
    s.attempts = days.map(day => ({ at: 0, day, skill: first, source: 'x', correct: false, hintLevel: 0, honest: true, timeMs: 9000 })) as any;
    expect(nextSkill(s, defs as any)).toBe(first);
    expect(buildPlan(s, defs as any, '2026-10-04').blocks.find(b => b.id === 'new')?.skills).toEqual([first]);
    s.attempts.push({ at: 0, day: '2026-10-04', skill: first, source: 'x', correct: false, hintLevel: 0, honest: true, timeMs: 9000 } as any);
    expect(stuckSkills(s, defs as any)).toEqual([first]);
    const next = nextSkill(s, defs as any);
    expect(next).not.toBe(first); expect(next).toBeTruthy();
    const plan = buildPlan(s, defs as any, '2026-10-05');
    expect(plan.blocks.find(b => b.id === 'warmup')?.skills).toContain(first);
    expect(plan.blocks.find(b => b.id === 'new')?.skills).toEqual([next]);
  });
});

import { newTopicDay, practiceTopic } from '../src/engine/planner';
describe('очередь и потолок новых тем (C1, 02.10)', () => {
  const defs3: any[] = [
    { id: 'x', prereqs: [], weight: 3, cat: 'C', grade: 5, templates: ['t'], lesson: true },
    { id: 'y', prereqs: [], weight: 3, cat: 'C', grade: 5, templates: ['t'], lesson: true },
  ];
  it('новая тема — только Пн, Ср, Чт и до 15.11.2027', () => {
    expect(['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17'].map(newTopicDay)).toEqual([true, false, true, true, false, false]);
    expect(newTopicDay('2027-11-15')).toBe(false);
    expect(newTopicDay('2027-11-11')).toBe(true);
  });
  it('во вторник нового урока нет: практика последней изученной темы без урока', () => {
    const s = newSave(); refreshAvailability(s, defs3 as any);
    Object.assign(s.skills.x, { status: 'learned', lessonDone: true });
    s.attempts.push({ at: 5, day: '2026-10-12', skill: 'x', source: 't', correct: true, hintLevel: 0, honest: true, timeMs: 9000, mode: 'practice' } as any);
    expect(practiceTopic(s, defs3 as any)).toBe('x');
    const tue = buildPlan(s, defs3 as any, '2026-10-13').blocks.find(b => b.id === 'new');
    expect(tue).toMatchObject({ skills: ['x'], lesson: false });
    const wed = buildPlan(s, defs3 as any, '2026-10-14').blocks.find(b => b.id === 'new');
    expect(wed).toMatchObject({ skills: ['y'], lesson: true });
  });
  it('порядок новых тем — по очереди content/queue.mjs, а не по разделам', async () => {
    const { QUEUE } = await import('../content/queue.mjs');
    const q = QUEUE as string[];
    expect(q.indexOf('div.primes')).toBeLessThan(q.indexOf('frac.concept'));
    expect(new Set(q).size).toBe(q.length);
    // каждая тема графа есть в очереди; лишние — только 6 тем, которые добавятся в граф вместе с уроками (уравнения, схемы)
    const { skills } = await import('../content/skills.mjs');
    const ids = new Set((skills as { id: string }[]).map(x => x.id));
    expect([...ids].filter(id => !q.includes(id))).toEqual([]);
    expect(q.filter(id => !ids.has(id)).sort()).toEqual(['eq.both_sides_nat', 'eq.brackets_nat', 'eq.two_step', 'word.compare', 'word.part_whole', 'word.sum_diff']);
  });
});
