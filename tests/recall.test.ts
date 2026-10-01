import { describe, it, expect } from 'vitest';
import { enroll, backfill, due, record, noteTask, addDays, daysBetween, gapFor, isCredited, skillStat, dayStats, creditedCount, DAILY_MAX, GAPS, CREDIT_STEPS } from '../src/engine/recall';
import type { Save } from '../src/engine/types';

const save = (extra: Partial<Save> = {}): Save => ({ version: 1, heroName: 'т', xp: 0, skills: {}, attempts: [], days: {}, settings: { extraMissionCap: 4, extraTo: 'today', planMinutes: 40 }, diagnosticDone: true, repairShop: [], ...extra });
const okClean = { ok: true, hint: 0 as const, conf: 3 as const };

describe('Еске түсір: расписание', () => {
  it('после урока первый возврат через день; повторная постановка ничего не меняет', () => {
    const s = save();
    enroll(s, 'a', '2026-10-05');
    expect(s.recall!.a).toEqual({ learnedDay: '2026-10-05', step: 0, due: '2026-10-06', history: [] });
    record(s, 'a', '2026-10-06', okClean);
    enroll(s, 'a', '2026-10-20');
    expect(s.recall!.a.step).toBe(1);
  });
  it('верно без подсказки: шаг растёт, промежутки 1, 3, 7, 14, 30 дней от урока при возвратах в срок', () => {
    const s = save();
    enroll(s, 'a', '2026-10-05');
    let day = '2026-10-06';
    const dates: number[] = [];
    for (let k = 0; k < 5; k++) { record(s, 'a', day, okClean); dates.push(daysBetween('2026-10-05', day)); day = s.recall!.a.due; }
    expect(dates).toEqual([1, 3, 7, 14, 30]);
    expect(s.recall!.a.step).toBe(5);
    expect(daysBetween('2026-10-05', s.recall!.a.due)).toBe(60);
  });
  it('зачтена после 3 верных возвратов без подсказки в разные дни', () => {
    const s = save();
    enroll(s, 'a', '2026-10-05');
    record(s, 'a', '2026-10-06', okClean); record(s, 'a', '2026-10-08', okClean);
    expect(isCredited(s.recall!.a)).toBe(false);
    record(s, 'a', '2026-10-12', okClean);
    expect(isCredited(s.recall!.a)).toBe(true);
    expect(CREDIT_STEPS).toBe(3);
  });
  it('с подсказкой шаг не растёт и не падает: вернёмся через 2 дня', () => {
    const s = save();
    enroll(s, 'a', '2026-10-05');
    record(s, 'a', '2026-10-06', okClean);
    record(s, 'a', '2026-10-08', { ok: true, hint: 2, conf: 2 });
    expect(s.recall!.a.step).toBe(1);
    expect(s.recall!.a.due).toBe('2026-10-10');
    expect(s.recall!.a.history.at(-1)).toEqual({ day: '2026-10-08', ok: true, hint: 2, conf: 2 });
  });
  it('ошибка: откат на один шаг, не в ноль; завтра снова', () => {
    const s = save();
    enroll(s, 'a', '2026-10-05');
    for (const d of ['2026-10-06', '2026-10-08', '2026-10-12']) record(s, 'a', d, okClean);
    expect(s.recall!.a.step).toBe(3);
    record(s, 'a', '2026-10-19', { ok: false, hint: 1, conf: 3 });
    expect(s.recall!.a.step).toBe(2);
    expect(s.recall!.a.due).toBe('2026-10-20');
    record(s, 'a', '2026-10-20', { ok: false, hint: 3, conf: 1 });
    record(s, 'a', '2026-10-21', { ok: false, hint: 3, conf: 1 });
    record(s, 'a', '2026-10-22', { ok: false, hint: 3, conf: 1 });
    expect(s.recall!.a.step).toBe(0);
  });
  it('правило показали (hint 3) не засчитывается, даже если ok передали истиной', () => {
    const s = save();
    enroll(s, 'a', '2026-10-05');
    record(s, 'a', '2026-10-06', okClean);
    record(s, 'a', '2026-10-08', { ok: true, hint: 3, conf: 1 });
    expect(s.recall!.a.history.at(-1)!.ok).toBe(false);
    expect(s.recall!.a.step).toBe(0);
  });
  it('в один день шаг растёт не больше раза', () => {
    const s = save();
    enroll(s, 'a', '2026-10-05');
    record(s, 'a', '2026-10-06', okClean);
    record(s, 'a', '2026-10-06', okClean);
    expect(s.recall!.a.step).toBe(1);
  });
  it('gapFor: после последнего значения остаётся редкое поддержание', () => {
    expect(gapFor(0)).toBe(GAPS[0]);
    expect(gapFor(99)).toBe(GAPS[GAPS.length - 1]);
    expect(gapFor(-1)).toBe(GAPS[0]);
  });
});

describe('Еске түсір: что на сегодня', () => {
  it('не раньше срока; сегодня уже возвращённую тему не предлагаем', () => {
    const s = save();
    enroll(s, 'a', '2026-10-05');
    expect(due(s, '2026-10-05')).toEqual([]);
    expect(due(s, '2026-10-06')).toEqual(['a']);
    record(s, 'a', '2026-10-06', okClean);
    expect(due(s, '2026-10-06')).toEqual([]);
  });
  it('не больше 3 в день, самые просроченные первыми', () => {
    const s = save();
    enroll(s, 'a', '2026-10-01'); enroll(s, 'b', '2026-09-20'); enroll(s, 'c', '2026-09-25'); enroll(s, 'd', '2026-09-28'); enroll(s, 'e', '2026-10-02');
    expect(due(s, '2026-10-05')).toEqual(['b', 'c', 'd']);
    expect(DAILY_MAX).toBe(3);
  });
  it('сделанные сегодня считаются в лимит: после двух остаётся одна', () => {
    const s = save();
    for (const id of ['a', 'b', 'c', 'd', 'e']) enroll(s, id, '2026-09-20');
    const first = due(s, '2026-10-05');
    expect(first).toHaveLength(3);
    record(s, first[0], '2026-10-05', okClean); record(s, first[1], '2026-10-05', okClean);
    expect(due(s, '2026-10-05')).toHaveLength(1);
    record(s, due(s, '2026-10-05')[0], '2026-10-05', okClean);
    expect(due(s, '2026-10-05')).toEqual([]);
  });
  it('при равной просрочке первой идёт тема с меньшим шагом', () => {
    const s = save();
    enroll(s, 'a', '2026-10-01'); enroll(s, 'b', '2026-10-01');
    s.recall!.a.step = 2;
    expect(due(s, '2026-10-05', () => true, 1)).toEqual(['b']);
  });
  it('тема без правила (нет урока) не предлагается', () => {
    const s = save();
    enroll(s, 'a', '2026-09-20'); enroll(s, 'b', '2026-09-20');
    expect(due(s, '2026-10-05', id => id === 'b')).toEqual(['b']);
  });
  it('в пятницу после урока первый возврат в субботу — в понедельник тема просрочена на 2 дня и идёт первой', () => {
    const s = save();
    enroll(s, 'fri', '2026-10-02');
    enroll(s, 'old', '2026-10-01');
    expect(due(s, '2026-10-03')).toEqual(['old', 'fri']);
    expect(due(s, '2026-10-05')[0]).toBe('old');
  });
});

describe('Еске түсір: старые сохранения и цифры', () => {
  it('темы с уроком, сделанным до появления возвратов, ставятся на возвраты от дня «үйренді» или первой попытки', () => {
    const base = { p: 1, status: 'learned' as const, stage: 0, attempts: 1, correct: 1, misconceptions: {} };
    const s = save({ skills: { a: { ...base, lessonDone: true, learnedAt: '2026-09-20' }, b: { ...base, lessonDone: true }, c: { ...base, lessonDone: false } } });
    s.attempts.push({ at: 1, day: '2026-09-25', skill: 'b', source: 'x', correct: true, hintLevel: 0, honest: true, timeMs: 6000, mode: 'lesson' });
    expect(backfill(s, '2026-10-05')).toBe(true);
    expect(s.recall!.a.learnedDay).toBe('2026-09-20');
    expect(s.recall!.b.learnedDay).toBe('2026-09-25');
    expect(s.recall!.c).toBeUndefined();
    expect(backfill(s, '2026-10-05')).toBe(false);
  });
  it('цифры: по теме, по дням, зачтено', () => {
    const s = save();
    enroll(s, 'a', '2026-10-01'); enroll(s, 'b', '2026-10-01');
    record(s, 'a', '2026-10-02', okClean);
    record(s, 'a', '2026-10-04', { ok: false, hint: 1, conf: 3 });
    record(s, 'b', '2026-10-02', { ok: true, hint: 2, conf: 2 });
    noteTask(s, 'b', true);
    expect(s.recall!.b.history[0].task).toBe(true);
    const st = skillStat(s.recall!.a);
    expect(st).toMatchObject({ returns: 2, clean: 1, cleanRate: 0.5, sureWrong: 1 });
    expect(st.avgConf).toBe(3);
    expect(dayStats(s)).toEqual([
      { day: '2026-10-04', n: 1, clean: 0, hinted: 0, failed: 1 },
      { day: '2026-10-02', n: 2, clean: 1, hinted: 1, failed: 0 },
    ]);
    expect(creditedCount(s)).toEqual({ credited: 0, total: 2 });
  });
  it('даты: addDays через границу месяца и перевод часов', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-03-28', 2)).toBe('2026-03-30');
    expect(daysBetween('2026-10-24', '2026-10-26')).toBe(2);
    expect(daysBetween('2026-10-25', '2026-11-02')).toBe(8);
  });
  it('новые поля сохранения попадают в облако: облако кладёт всё сохранение, кроме истории ответов', () => {
    const s = save();
    enroll(s, 'a', '2026-10-01'); record(s, 'a', '2026-10-02', okClean);
    s.notebook = { a: { day: '2026-10-01', wrote: true, example: '3 + 4 = 7', exampleOk: true } };
    s.recallOffer = { '2026-10-02': { skills: ['a'], skipped: false } };
    const { attempts, ...rest } = s;
    const back = JSON.parse(JSON.stringify(rest));
    expect(back.recall.a.history).toHaveLength(1);
    expect(back.notebook.a.example).toBe('3 + 4 = 7');
    expect(back.recallOffer['2026-10-02'].skills).toEqual(['a']);
  });
});
