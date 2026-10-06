import { describe, it, expect } from 'vitest';
import { isSchoolDay, exceptionOn, validateRange, addException, deleteException, mergeExceptions, activeExceptions, normalizeException, EXC_MAX_DAYS } from '../src/engine/exceptions';
import { mergeSave, stable } from '../src/engine/sync';
import { streak } from '../src/engine/streak';
import { blankDay } from '../src/engine/planner';

const save = (x: any = {}): any => ({ version: 1, heroName: 'М', xp: 0, skills: {}, attempts: [], days: {}, settings: { extraMissionCap: 1, extraTo: 'today', planMinutes: 40 }, diagnosticDone: true, repairShop: [], coins: 0, shipOwned: [], ...x });
const ex = (id: string, from: string, to: string, kind: 'sick' | 'holiday' = 'sick', x: any = {}) => ({ id, from, to, kind, at: 1, ...x });
// 2026-10-05 - понедельник
const TODAY = '2026-10-05';

describe('исключения: учебный день (K4)', () => {
  it('будни учебные, выходные нет; диапазон болезни выключает свои будни и только их', () => {
    const s = save({ exceptions: [ex('a', '2026-10-06', '2026-10-08')] });
    expect(['2026-10-05', '2026-10-06', '2026-10-08', '2026-10-09', '2026-10-10'].map(d => isSchoolDay(s, d))).toEqual([true, false, false, true, false]);
    expect(exceptionOn(s, '2026-10-07')).toBe('sick');
    expect(exceptionOn(s, '2026-10-09')).toBeUndefined();
  });
  it('удалённое исключение (могила) не действует', () => {
    const s = save({ exceptions: [ex('a', '2026-10-06', '2026-10-08', 'sick', { deleted: true })] });
    expect(isSchoolDay(s, '2026-10-07')).toBe(true);
  });
  it('старая отметка одного дня работает; vacation считается праздником', () => {
    const s = save({ days: { '2026-10-06': { ...blankDay('2026-10-06'), exception: 'sick' }, '2026-10-07': { ...blankDay('2026-10-07'), exception: 'vacation' } } });
    expect(isSchoolDay(s, '2026-10-06')).toBe(false);
    expect(exceptionOn(s, '2026-10-07')).toBe('holiday');
    expect(isSchoolDay(s, '2026-10-08')).toBe(true);
  });
  it('испорченные данные не роняют: не массив, мусор в массиве, диапазон вверх ногами, нереальная дата, слишком длинный диапазон', () => {
    expect(() => isSchoolDay(save({ exceptions: 42 }), TODAY)).not.toThrow();
    expect(isSchoolDay(save({ exceptions: 42 }), TODAY)).toBe(true);
    expect(isSchoolDay(save({ exceptions: null, days: null }), TODAY)).toBe(true);
    const s = save({ exceptions: [null, 'x', 7, {}, { id: 'n' }, ex('bad-date', '2026-13-45', '2026-10-06'), ex('bad-kind', '2026-10-06', '2026-10-06', 'vacation' as any),
      ex('flip', '2026-10-08', '2026-10-06'),                       // вверх ногами: концы меняются местами
      ex('huge', '2026-01-05', '2030-01-01', 'holiday')] });        // нереальная длина: обрезается до предела вида (7 дней)
    expect(activeExceptions(s).map(e => e.id).sort()).toEqual(['flip', 'huge']);
    expect(isSchoolDay(s, '2026-10-07')).toBe(false);               // «flip» действует
    expect(isSchoolDay(s, '2026-01-09')).toBe(false);               // начало «huge»: 5..11 января, будни 5-9
    expect(isSchoolDay(s, '2026-01-12')).toBe(true);                // после предела 7 дней - обычный день
    expect(isSchoolDay(s, '2027-03-01')).toBe(true);
    expect(normalizeException({ id: 'x', from: '2026-02-31', to: '2026-03-01', kind: 'sick' })).toBeNull();
  });
});

describe('исключения: проверка диапазона (-14...+180 дней, болезнь до 21, праздник до 7)', () => {
  const r = (from: string, to: string, kind: any = 'sick') => validateRange(from, to, kind, TODAY);
  it('границы начала и конца', () => {
    expect(r('2026-09-21', '2026-09-21')).toBeNull();               // ровно 14 дней назад
    expect(r('2026-09-20', '2026-09-20')).not.toBeNull();           // 15 дней назад
    expect(r('2027-04-03', '2027-04-03', 'holiday')).toBeNull();    // ровно +180
    expect(r('2027-04-04', '2027-04-04', 'holiday')).not.toBeNull();// +181
  });
  it('длина: болезнь 21, праздник 7, оба конца включительно', () => {
    expect(r('2026-10-05', '2026-10-25')).toBeNull();               // 21 день
    expect(r('2026-10-05', '2026-10-26')).not.toBeNull();           // 22 дня
    expect(r('2026-10-05', '2026-10-11', 'holiday')).toBeNull();    // 7 дней
    expect(r('2026-10-05', '2026-10-12', 'holiday')).not.toBeNull();
    expect(EXC_MAX_DAYS).toEqual({ sick: 21, holiday: 7 });
  });
  it('конец раньше начала, мусор вместо даты и неизвестный вид отклоняются', () => {
    expect(r('2026-10-06', '2026-10-05')).toMatch(/раньше/);
    expect(r('', '2026-10-05')).not.toBeNull();
    expect(r('2026-02-30', '2026-03-01')).not.toBeNull();
    expect(r('2026-10-05', '2026-10-05', 'vacation')).not.toBeNull();
  });
  it('тексты командира без длинного тире', () => {
    for (const msg of [r('2026-10-06', '2026-10-05'), r('2026-09-01', '2026-09-02'), r('2026-10-05', '2026-10-30'), r('2026-10-05', '2027-12-01'), r('x', 'y'), r('2026-10-05', '2026-10-15', 'holiday')]) expect(msg).not.toContain('—');
  });
});

describe('исключения: добавление и удаление идемпотентны', () => {
  it('двойной клик: тот же диапазон и вид второй раз ничего не добавляет', () => {
    const s = save();
    const a = addException(s, { from: '2026-10-06', to: '2026-10-08', kind: 'sick' }, TODAY, 100, 'id1');
    const b = addException(s, { from: '2026-10-06', to: '2026-10-08', kind: 'sick' }, TODAY, 101, 'id2');
    expect(a).toEqual({ ok: true, id: 'id1', created: true });
    expect(b).toEqual({ ok: true, id: 'id1', created: false });
    expect(s.exceptions).toHaveLength(1);
  });
  it('диапазон внутри уже действующего того же вида не плодит записи, другой вид - добавляется', () => {
    const s = save();
    addException(s, { from: '2026-10-06', to: '2026-10-10', kind: 'sick' }, TODAY, 1, 'big');
    expect(addException(s, { from: '2026-10-07', to: '2026-10-08', kind: 'sick' }, TODAY, 2, 'small')).toMatchObject({ ok: true, id: 'big', created: false });
    expect(addException(s, { from: '2026-10-07', to: '2026-10-08', kind: 'holiday' }, TODAY, 3, 'hol')).toMatchObject({ ok: true, id: 'hol', created: true });
    expect(s.exceptions.map((e: any) => e.id)).toEqual(['big', 'hol']);
  });
  it('неправильный диапазон не меняет сохранение', () => {
    const s = save();
    const before = stable(s);
    expect(addException(s, { from: '2026-10-05', to: '2026-12-31', kind: 'sick' }, TODAY, 1, 'x').ok).toBe(false);
    expect(addException(s, { from: '2025-01-01', to: '2025-01-02', kind: 'sick' }, TODAY, 1, 'x').ok).toBe(false);
    expect(stable(s)).toBe(before);
  });
  it('поле было испорчено (не массив): добавление чинит его, не падает', () => {
    const s = save({ exceptions: 'мусор' });
    expect(addException(s, { from: '2026-10-06', to: '2026-10-06', kind: 'holiday' }, TODAY, 1, 'a').ok).toBe(true);
    expect(isSchoolDay(s, '2026-10-06')).toBe(false);
  });
  it('удаление оставляет могилу, повтор и чужой id ничего не меняют', () => {
    const s = save({ exceptions: [ex('a', '2026-10-06', '2026-10-08')] });
    expect(deleteException(s, 'a', 500)).toBe(true);
    expect(s.exceptions).toEqual([{ ...ex('a', '2026-10-06', '2026-10-08'), deleted: true, at: 500 }]);
    expect(isSchoolDay(s, '2026-10-07')).toBe(true);
    expect(deleteException(s, 'a', 900)).toBe(false);               // повтор (двойной клик)
    expect(s.exceptions[0].at).toBe(500);
    expect(deleteException(s, 'нет-такого', 900)).toBe(false);
    expect(deleteException(save({ exceptions: 5 }), 'a', 1)).toBe(false);
  });
  it('после удаления тот же диапазон можно поставить снова: это новая запись, а не воскрешение', () => {
    const s = save();
    addException(s, { from: '2026-10-06', to: '2026-10-08', kind: 'sick' }, TODAY, 1, 'a');
    deleteException(s, 'a', 2);
    expect(addException(s, { from: '2026-10-06', to: '2026-10-08', kind: 'sick' }, TODAY, 3, 'b')).toMatchObject({ id: 'b', created: true });
    expect(activeExceptions(s).map(e => e.id)).toEqual(['b']);
  });
});

describe('исключения: слияние между устройствами (по id, удалённое не воскресает)', () => {
  const A = ex('a', '2026-10-06', '2026-10-08'), B = ex('b', '2026-10-12', '2026-10-13', 'holiday');
  it('объединение по id: что поставили на разных устройствах, то остаётся на обоих', () => {
    expect(mergeExceptions([A], [B]).map(e => e.id)).toEqual(['a', 'b']);
  });
  it('могила побеждает живую копию с любой стороны и с любым временем', () => {
    const dead = { ...A, deleted: true, at: 5 }, live = { ...A, at: 99 };
    expect(mergeExceptions([live], [dead])).toEqual([dead]);
    expect(mergeExceptions([dead], [live])).toEqual([dead]);
  });
  it('слияние не зависит от порядка и повторное слияние ничего не меняет', () => {
    const l = [A, { ...B, deleted: true, at: 7 }], r = [B, A, ex('c', '2026-11-02', '2026-11-02')];
    expect(mergeExceptions(l, r)).toEqual(mergeExceptions(r, l));
    const once = mergeExceptions(l, r);
    expect(mergeExceptions(once, r)).toEqual(once);
    expect(mergeExceptions(once, once)).toEqual(once);
  });
  it('одно и то же исключение, поставленное на двух устройствах под разными id, живёт и не ломает счёт дней', () => {
    const m = mergeExceptions([ex('p', '2026-10-06', '2026-10-07')], [ex('q', '2026-10-06', '2026-10-07')]);
    expect(m).toHaveLength(2);
    expect(isSchoolDay(save({ exceptions: m }), '2026-10-06')).toBe(false);
  });
  it('испорченное с одной стороны не теряет живое с другой', () => {
    expect(mergeExceptions('мусор', [A]).map(e => e.id)).toEqual(['a']);
    expect(mergeExceptions([null, 3, A], undefined).map(e => e.id)).toEqual(['a']);
  });
  it('mergeSave: брат поставил болезнь, ребёнок на другом устройстве удалил старое - оба изменения доходят', () => {
    const base = save({ exceptions: [A], updatedAt: 1 });
    const bro = save({ exceptions: [A, B], updatedAt: 50 });
    const kid = save({ exceptions: [{ ...A, deleted: true, at: 40 }], updatedAt: 60, xp: 10 });
    const m = mergeSave(base, bro, kid);
    expect(activeExceptions(m).map(e => e.id)).toEqual(['b']);
    expect(m.exceptions!.find(e => e.id === 'a')!.deleted).toBe(true);
  });
  it('mergeSave: у пустого устройства (новый телефон) исключения, поставленные до первой загрузки, не пропадают', () => {
    const blank = save({ diagnosticDone: false, exceptions: [B] });
    const cloud = save({ xp: 300, attempts: [{ at: 1, day: '2026-10-01', skill: 'a', source: 't', correct: true, hintLevel: 0, honest: true, timeMs: 1, mode: 'practice' }], exceptions: [A] });
    expect(activeExceptions(mergeSave(null, blank, cloud)).map(e => e.id)).toEqual(['a', 'b']);
    expect(activeExceptions(mergeSave(null, cloud, blank)).map(e => e.id)).toEqual(['a', 'b']);
  });
  it('mergeSave: нет поля ни у кого - поля нет и в результате; испорченное поле не падает', () => {
    expect('exceptions' in mergeSave(null, save({ updatedAt: 1 }), save({ updatedAt: 2 }))).toBe(false);
    expect(() => mergeSave(null, save({ exceptions: 'x', updatedAt: 1 }), save({ exceptions: [A], updatedAt: 2 }))).not.toThrow();
    expect(activeExceptions(mergeSave(null, save({ exceptions: 'x', updatedAt: 1 }), save({ exceptions: [A], updatedAt: 2 }))).map(e => e.id)).toEqual(['a']);
  });
  it('mergeSave: слияние копии с самой собой не меняет исключения', () => {
    const s = save({ exceptions: [A, { ...B, deleted: true }], updatedAt: 9 });
    expect(stable(mergeSave(s, s, s).exceptions)).toBe(stable(s.exceptions));
  });
});

describe('исключения: серия дней', () => {
  const week = () => {
    const s = save({ attempts: [{ at: 1, day: '2026-10-05', skill: 'a', source: 't', correct: true, hintLevel: 0, honest: true, timeMs: 1, mode: 'practice' }] });
    for (const d of ['2026-10-05', '2026-10-09']) s.days[d] = { ...blankDay(d), planShare: 1 };   // Пн и Пт выполнены, Вт-Чт пропущены
    return s;
  };
  it('без исключения три пропущенных будня рвут серию (две заморозки в месяц), с исключением на эти дни серия цела и заморозки целы', () => {
    const bare = week();
    expect(streak(bare, '2026-10-09').days).toBe(1);
    const s = week(); s.exceptions = [ex('a', '2026-10-06', '2026-10-08')];
    const r = streak(s, '2026-10-09');
    expect(r.days).toBe(5);
    expect(r.freezesLeft).toBe(2);
  });
  it('исключение, которое удалили, серию больше не держит', () => {
    const s = week(); s.exceptions = [ex('a', '2026-10-06', '2026-10-08')];
    deleteException(s, 'a', 5);
    expect(streak(s, '2026-10-09').days).toBe(1);
  });
  it('испорченные исключения и записи дней серию не роняют', () => {
    const s = week(); s.exceptions = [null, 'x', ex('flip', '2026-10-08', '2026-10-06')]; s.days['2026-10-07'] = null;
    expect(streak(s, '2026-10-09').days).toBe(5);
  });
});
