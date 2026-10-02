import { describe, it, expect } from 'vitest';
import { mergeAttempts, isBlank, chooseSide, mergeSave, MERGE_RULES, stable } from '../src/engine/sync';
import { readFileSync } from 'node:fs';
import type { Attempt } from '../src/engine/types';

const att = (at: number, skill = 'a', source = 't'): Attempt => ({ at, day: '2026-10-01', skill, source, correct: true, hintLevel: 0, honest: true, timeMs: 1, mode: 'practice' });

describe('Слияние устройства и облака (src/engine/sync.ts)', () => {
  it('ответы объединяются без повторов и по времени', () => {
    expect(mergeAttempts([att(3), att(1)], [att(1), att(2), att(1, 'b')]).map(a => `${a.at}${a.skill}`)).toEqual(['1a', '1b', '2a', '3a']);
  });
  it('пустое сохранение — ни ответов, ни диагностики, ни опыта', () => {
    expect(isBlank({ attempts: [], diagnosticDone: false, xp: 0 })).toBe(true);
    expect(isBlank({ attempts: [att(1)], diagnosticDone: false, xp: 0 })).toBe(false);
    expect(isBlank({ attempts: [], diagnosticDone: true, xp: 0 })).toBe(false);
    expect(isBlank({ attempts: [], diagnosticDone: false, xp: 10 })).toBe(false);
  });
  it('пустая сторона не побеждает, даже если «новее»; иначе — у кого updatedAt больше', () => {
    expect(chooseSide({ at: 999, blank: true }, { at: 1, blank: false })).toBe('remote');
    expect(chooseSide({ at: 1, blank: false }, { at: 999, blank: true })).toBe('local');
    expect(chooseSide({ at: 5, blank: false }, { at: 9, blank: false })).toBe('remote');
    expect(chooseSide({ at: 9, blank: false }, { at: 5, blank: false })).toBe('local');
    expect(chooseSide({ at: 5, blank: true }, { at: 5, blank: true })).toBe('same');
  });
});

describe('Темы скана без срока проверки (баг диагностики до 02.10)', () => {
  it('выученным без due ставится проверка на ближайший учебный день, остальные не трогаются', async () => {
    const { fixMissingDue } = await import('../src/engine/progress');
    const sk = (status: string, due?: string) => ({ p: 0.95, status, lessonDone: false, stage: 0, attempts: 0, correct: 0, misconceptions: {}, ...(due ? { due } : {}) }) as any;
    const save = { skills: { a: sk('learned'), b: sk('learned', '2026-10-05'), c: sk('learning') } } as any;
    expect(fixMissingDue(save, '2026-10-02')).toBe(1);   // пятница
    expect(save.skills.a.due).toBe('2026-10-05');        // ближайший учебный день — понедельник
    expect(save.skills.a.learnedAt).toBe('2026-10-02');
    expect(save.skills.b.due).toBe('2026-10-05');
    expect(save.skills.c.due).toBeUndefined();
  });
});

const save = (x: any = {}): any => ({ version: 1, heroName: 'М', xp: 0, skills: {}, attempts: [], days: {}, settings: { extraMissionCap: 1, extraTo: 'today', planMinutes: 40 }, diagnosticDone: true, repairShop: [], coins: 0, shipOwned: [], ...x });
const day = (date: string, x: any = {}) => ({ date, blocksDone: {}, planShare: 0, minutesToday: 0, minutesWeekend: 0, extraMissions: 0, bonuses: [], ...x });
const sk = (attempts: number, status = 'learning') => ({ p: 0.5, status, lessonDone: true, stage: 0, attempts, correct: attempts, misconceptions: {} });

describe('Слияние по полям (mergeSave, S1)', () => {
  it('слияние копии с самой собой ничего не меняет', () => {
    const s = save({ xp: 50, days: { '2026-10-01': day('2026-10-01', { minutesToday: 30 }) }, skills: { a: sk(5) }, attempts: [att(1)], updatedAt: 9 });
    expect(stable(mergeSave(s, s, s))).toBe(stable(s));
  });
  it('старая копия брата (база — неделя назад) + новая копия ребёнка: прогресс ребёнка цел, настройка брата доходит', () => {
    const base = save({ xp: 100, coins: 50, days: { d1: day('d1', { minutesToday: 10 }) }, skills: { a: sk(5) }, settings: { extraMissionCap: 1, extraTo: 'today', planMinutes: 40, voiceInput: true }, updatedAt: 1 });
    const bro = { ...base, settings: { ...base.settings, voiceInput: false }, updatedAt: 99 };
    const kid = { ...base, xp: 900, coins: 320, days: { ...base.days, d2: day('d2', { minutesToday: 60, blocksDone: { new: true } }) }, skills: { a: sk(40, 'mastered'), b: sk(3) }, outfit: 'gold', updatedAt: 50 };
    const m = mergeSave(base, bro, kid);
    expect(m.xp).toBe(900); expect(m.coins).toBe(320); expect(m.outfit).toBe('gold');
    expect(Object.keys(m.days).sort()).toEqual(['d1', 'd2']);
    expect(m.skills.a.status).toBe('mastered'); expect(m.skills.b.attempts).toBe(3);
    expect(m.settings.voiceInput).toBe(false);
  });
  it('монеты: изменения обеих сторон складываются от базы (заработал там, потратил тут)', () => {
    const base = save({ coins: 100 }), l = save({ coins: 40 }), r = save({ coins: 130 });
    expect(mergeSave(base, l, r).coins).toBe(70);
    expect(mergeSave(null, l, r).coins).toBe(130);     // без базы — максимум
  });
  it('один и тот же день на двух устройствах: шаги ИЛИ, счёт того, кто прошёл дальше, минуты — максимум', () => {
    const l = save({ days: { d: day('d', { blocksDone: { warmup: true }, tally: { warmup: { n: 6, paid: 5, wrong: 1 } }, honest: { warmup: 0.8 }, minutesToday: 12 }) } });
    const r = save({ days: { d: day('d', { blocksDone: { new: true }, tally: { warmup: { n: 3, paid: 3, wrong: 0 }, new: { n: 10, paid: 9, wrong: 1 } }, honest: { warmup: 1, new: 0.9 }, minutesToday: 30, bonuses: [{ reason: 'x', minutes: 5 }] }) } });
    const d = mergeSave(null, l, r).days.d;
    expect(d.blocksDone).toEqual({ warmup: true, new: true });
    expect(d.tally).toEqual({ warmup: { n: 6, paid: 5, wrong: 1 }, new: { n: 10, paid: 9, wrong: 1 } });
    expect(d.honest).toEqual({ warmup: 0.8, new: 0.9 });
    expect(d.minutesToday).toBe(30); expect(d.bonuses.length).toBe(1);
  });
  it('купленное, пройденные миры, ремонт, снимок открытого — только растут', () => {
    const l = save({ shipOwned: ['a'], worldsCleared: ['village'], repairShop: [{ source: 's', skill: 'k', addedDay: 'd', fixed: true }], prog: { legacy: { day: '2026-10-03', outfits: ['cyan'], styles: [], worlds: ['village'], cleared: [], owned: ['a'] } } });
    const r = save({ shipOwned: ['b'], worldsCleared: [], repairShop: [{ source: 's', skill: 'k', addedDay: 'd' }, { source: 't', skill: 'k', addedDay: 'd' }], prog: { legacy: { day: '2026-10-02', outfits: ['gold'], styles: ['cape_red'], worlds: ['village', 'jungle'], cleared: ['village'], owned: [] } } });
    const m = mergeSave(null, l, r);
    expect(m.shipOwned!.sort()).toEqual(['a', 'b']);
    expect(m.worldsCleared).toEqual(['village']);
    expect(m.repairShop).toEqual([{ source: 's', skill: 'k', addedDay: 'd', fixed: true }, { source: 't', skill: 'k', addedDay: 'd' }]);
    expect(m.prog!.legacy!.day).toBe('2026-10-02');
    expect(m.prog!.legacy!.outfits.sort()).toEqual(['cyan', 'gold']);
    expect(m.prog!.legacy!.worlds.sort()).toEqual(['jungle', 'village']);
  });
  it('обе стороны поменяли одно поле — побеждает более новая копия', () => {
    const base = save({ outfit: 'cyan' });
    expect(mergeSave(base, save({ outfit: 'gold', updatedAt: 5 }), save({ outfit: 'pink', updatedAt: 9 })).outfit).toBe('pink');
    expect(mergeSave(base, save({ outfit: 'gold', updatedAt: 9 }), save({ outfit: 'pink', updatedAt: 5 })).outfit).toBe('gold');
  });
  it('у каждого поля сохранения есть правило слияния (особое или «изменил — побеждает»)', () => {
    const src = readFileSync('src/engine/types.ts', 'utf8');
    const body = src.slice(src.indexOf('export interface Save {'));
    const fields = [...body.slice(0, body.indexOf('\n}')).matchAll(/^\s{2}([a-zA-Z]+)\??:/gm)].map(m => m[1]);
    const special = Object.keys(MERGE_RULES);
    // поля без особого правила — сознательно «меняемые» (pick3)
    const picked = fields.filter(f => !special.includes(f));
    expect(picked.sort()).toEqual(['heroName', 'lessonPos', 'outfit', 'settings', 'shipPet', 'style', 'weekendSpent', 'world'].sort());
  });
});
