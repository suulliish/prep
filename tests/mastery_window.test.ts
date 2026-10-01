// Порог «тема выучена»: ≥ 85% верных с первой попытки в последних 20 честных ответах, окно не меньше 15 (решение отца 01.10).
import { describe, it, expect } from 'vitest';
import { recordAttempt, refreshAvailability, windowStat, windowPasses, windowWeak } from '../src/engine/progress';
import { WINDOW_MAX, WINDOW_MIN, WINDOW_ACC } from '../src/engine/bkt';
import type { Save, Attempt } from '../src/engine/types';

const newSave = (): Save => ({ version: 1, heroName: 'Т', xp: 0, skills: {}, attempts: [], days: {}, settings: { extraMissionCap: 1, extraTo: 'today', planMinutes: 60 }, diagnosticDone: false, repairShop: [] });
const defs = [{ id: 'a', prereqs: [], weight: 3, cat: 'C', grade: 5, templates: ['t'] }];
const att = (p: Partial<Attempt> = {}): Attempt => ({ at: 0, day: '2026-10-19', skill: 'a', source: 't', correct: true, hintLevel: 0, honest: true, timeMs: 20000, mode: 'practice', ...p });
// последовательность: 1 — верно с первой попытки, 0 — ошибка
const feed = (s: Save, seq: (0 | 1)[], extra: Partial<Attempt> = {}) => seq.flatMap(x => recordAttempt(s, att({ correct: x === 1, ...extra }), { guess: 0.2 }));
const fresh = () => { const s = newSave(); refreshAvailability(s, defs); return s; };

describe('окно точности', () => {
  it('константы: окно 20, минимум 15, порог 85%', () => { expect([WINDOW_MAX, WINDOW_MIN, WINDOW_ACC]).toEqual([20, 15, 0.85]); });
  it('считает только честные ответы и только верные без подсказки', () => {
    const s = fresh();
    s.attempts.push(att(), att({ hintLevel: 1 }), att({ honest: false, correct: false }), att({ correct: false }), att({ skill: 'b' }));
    expect(windowStat(s.attempts, 'a')).toEqual({ n: 3, clean: 1, rate: 1 / 3 });
  });
  it('окно — последние 20: старые ошибки выпадают', () => {
    const s = fresh();
    for (let i = 0; i < 10; i++) s.attempts.push(att({ correct: false }));
    for (let i = 0; i < 20; i++) s.attempts.push(att());
    expect(windowStat(s.attempts, 'a')).toEqual({ n: 20, clean: 20, rate: 1 });
  });
});

describe('порог «выучена»', () => {
  it('14 безупречных ответов: тема ещё не выучена (окно < 15)', () => {
    const s = fresh(); feed(s, Array(14).fill(1));
    expect(s.skills.a.status).toBe('learning');
  });
  it('15 безупречных: выучена', () => {
    const s = fresh(); const ev = feed(s, Array(15).fill(1));
    expect(s.skills.a.status).toBe('learned'); expect(ev).toContain('learned');
    expect(s.skills.a.strict).toBe(true);
  });
  it('случай Порядка действий: 14 из 21 (67%) больше не засчитывается', () => {
    const s = fresh();
    // 7 ошибок, раскиданных так, что последние 3 верные: старое правило (p ≥ 0,95, 6 попыток, 3 чистых) уже сказало бы «выучена»
    const seq: (0 | 1)[] = [1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 1];
    feed(s, seq);
    const w = windowStat(s.attempts, 'a');
    expect(w.n).toBe(20); expect(w.rate).toBeLessThan(0.85);
    expect(s.skills.a.status).toBe('learning');
  });
  it('17 из 20 (85%) — проходит, 16 из 20 (80%) — нет', () => {
    const ok = fresh(); feed(ok, [0, 0, 0, ...Array(17).fill(1)]);
    expect(windowStat(ok.attempts, 'a').rate).toBe(0.85); expect(ok.skills.a.status).toBe('learned');
    const no = fresh(); feed(no, [0, 0, 0, 0, ...Array(16).fill(1)]);
    expect(windowStat(no.attempts, 'a').rate).toBe(0.8); expect(no.skills.a.status).toBe('learning');
  });
  it('ответы с подсказкой не считаются «с первой попытки»', () => {
    const s = fresh(); for (let i = 0; i < 20; i++) recordAttempt(s, att({ hintLevel: i % 2 ? 1 : 0 }), { guess: 0.2 });
    expect(s.skills.a.status).toBe('learning');
  });
  it('тема выучивается позже, когда окно очистится от ошибок', () => {
    const s = fresh(); feed(s, [0, 0, 0, 0, 0, ...Array(10).fill(1)]);
    expect(s.skills.a.status).toBe('learning');
    feed(s, Array(5).fill(1));   // окно: 20 ответов, 5 ошибок = 75%
    expect(s.skills.a.status).toBe('learning');
    feed(s, Array(2).fill(1));   // две первые ошибки вышли из окна: 3 ошибки в 20 = 85%
    expect(s.skills.a.status).toBe('learned');
  });
  it('windowPasses / windowWeak: мало ответов не судится', () => {
    expect(windowPasses({ n: 10, rate: 1 })).toBe(false); expect(windowWeak({ n: 10, rate: 0.1 })).toBe(false);
    expect(windowWeak({ n: 15, rate: 0.84 })).toBe(true); expect(windowPasses({ n: 15, rate: 0.85 })).toBe(true);
  });
});

describe('уже выученные слабо (старые сохранения)', () => {
  const weakLearned = () => {
    const s = fresh();
    // старое сохранение: 20 ответов, 67% точности, тема уже «выучена»
    for (let i = 0; i < 20; i++) s.attempts.push(att({ correct: i % 3 !== 0 }));
    Object.assign(s.skills.a, { status: 'learned', p: 0.96, attempts: 20, correct: 13, lessonDone: true, learnedAt: '2026-09-20', due: '2026-10-25', stage: 0 });
    return s;
  };
  it('сразу не разжалуется: верный ответ статус не трогает', () => {
    const s = weakLearned(); recordAttempt(s, att());
    expect(s.skills.a.status).toBe('learned');
  });
  it('следующая ошибка (даже вне проверки) возвращает в «изучается»', () => {
    const s = weakLearned(); const ev = recordAttempt(s, att({ correct: false, day: '2026-10-19' }));
    expect(s.skills.a.status).toBe('learning'); expect(ev).toContain('review_failed');
    expect(s.skills.a.due).toBeUndefined();
  });
  it('кристалл на проверке слабой темы не даётся', () => {
    const s = weakLearned(); const ev = recordAttempt(s, att({ day: '2026-10-25' }));
    expect(s.skills.a.status).toBe('learned'); expect(ev).not.toContain('crystal');
  });
  it('тема, выученная по новому порогу, одной ошибкой не разжалуется (окно до ошибки было ≥ 85%)', () => {
    const s = fresh(); feed(s, Array(15).fill(1));
    expect(s.skills.a.status).toBe('learned');
    recordAttempt(s, att({ correct: false }));
    expect(s.skills.a.status).toBe('learned');
  });
  it('тема с малым числом ответов (диагностика) не разжалуется без проверки', () => {
    const s = fresh(); Object.assign(s.skills.a, { status: 'learned', p: 0.95, attempts: 2, lessonDone: false, stage: 0, due: '2026-10-30' });
    recordAttempt(s, att({ correct: false }));
    expect(s.skills.a.status).toBe('learned');
  });
  it('нечестный ответ окно не двигает', () => {
    const s = weakLearned(); const before = windowStat(s.attempts, 'a');
    recordAttempt(s, att({ correct: false, honest: false }));
    expect(s.skills.a.status).toBe('learned');
    expect(windowStat(s.attempts, 'a')).toEqual(before);
  });
});
