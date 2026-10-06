// Снимки облака (S4): чистая логика src/engine/snapshots.ts.
import { describe, it, expect } from 'vitest';
import {
  snapDay, sumOf, parseIndex, expiredIds, planDaily, planBefore, checkSaveJson, checkSnapshotDoc, compareSaves, restoredSave, listSnaps,
  isSnapId, beforeId, SNAP_MAX_BYTES, type SnapIndex, type SnapMeta,
} from '../src/engine/snapshots';
import type { Attempt } from '../src/engine/types';

const DAY = 86_400_000;
const SERVER = Date.UTC(2026, 9, 5, 10, 0, 0);   // 5 октября 2026, 15:00 в Казахстане
const att = (at: number, skill = 'a'): Attempt => ({ at, day: '2026-10-01', skill, source: 't', correct: true, hintLevel: 0, honest: true, timeMs: 1, mode: 'practice' } as Attempt);
const sk = (attempts: number) => ({ p: 0.5, status: 'learning', lessonDone: false, stage: 0, attempts, correct: 0, misconceptions: {} });
const rest = (x: any = {}): any => ({ version: 1, heroName: 'М', xp: 100, skills: { a: sk(10), b: sk(4) }, days: { '2026-10-01': {}, '2026-10-02': {} }, settings: { extraMissionCap: 1, extraTo: 'today', planMinutes: 40 }, diagnosticDone: true, repairShop: [], coins: 30, ...x });
const meta = (at: number, kind: SnapMeta['kind'] = 'day'): SnapMeta => ({ at, app: 'x', v: 1, kind, sum: { answers: 1, topics: 1, coins: 1, xp: 1, days: 1 } });
const idxOf = (days: Record<string, number>): SnapIndex => Object.fromEntries(Object.entries(days).map(([id, ago]) => [id, meta(SERVER - ago * DAY)]));
const base = { pulled: true, readOnly: false, serverMs: SERVER, index: {} as SnapIndex, clientSchema: 1 };

describe('день снимка — по серверному времени, сутки Казахстана (UTC+5)', () => {
  it('граница суток: 18:59 UTC ещё 5-е, 19:00 UTC уже 6-е', () => {
    expect(snapDay(Date.UTC(2026, 9, 5, 18, 59, 59))).toBe('2026-10-05');
    expect(snapDay(Date.UTC(2026, 9, 5, 19, 0, 0))).toBe('2026-10-06');
  });
  it('id снимков: день и «до восстановления»; чужие id не принимаются', () => {
    expect(isSnapId('2026-10-05')).toBe(true);
    expect(isSnapId(beforeId(1_790_000_000_000))).toBe(true);
    for (const bad of ['', 'x', '2026-10-5', '../users', '2026-10-05/x', 'before-restore-', 'before-restore-abc', '__proto__']) expect(isSnapId(bad)).toBe(false);
  });
});

describe('сводка снимка: ответов, тем, монет', () => {
  it('считает по счётчикам тем', () => {
    expect(sumOf(rest())).toEqual({ answers: 14, topics: 2, coins: 30, xp: 100, days: 2 });
  });
  it('испорченное из облака не роняет: число вместо строки, null, пустой объект, массив вместо объекта', () => {
    expect(sumOf(null)).toEqual({ answers: 0, topics: 0, coins: 0, xp: 0, days: 0 });
    expect(sumOf({} as any)).toEqual({ answers: 0, topics: 0, coins: 0, xp: 0, days: 0 });
    expect(sumOf({ skills: 5, days: [1, 2], xp: '9', coins: NaN } as any)).toEqual({ answers: 0, topics: 0, coins: 0, xp: 0, days: 0 });
    expect(sumOf({ skills: { a: null, b: 'x', c: { attempts: 'много' }, d: sk(3), e: { attempts: -5 } } } as any)).toMatchObject({ answers: 3, topics: 1 });
  });
});

describe('список снимков из облака (не доверяем)', () => {
  it('хорошие записи читаются, плохие отбрасываются', () => {
    const idx = parseIndex({
      '2026-10-05': { at: SERVER, app: 'a', v: 1, sum: { answers: 5, topics: 2, coins: 7, xp: 9, days: 3 } },
      '2026-10-04': 'строка', '2026-10-03': { at: 'вчера' }, '2026-10-02': { at: -4 }, 'плохой-id': { at: SERVER }, '2026-10-01': { at: SERVER, sum: 7, v: 'x', app: 5 },
    });
    expect(Object.keys(idx).sort()).toEqual(['2026-10-01', '2026-10-05']);
    expect(idx['2026-10-05'].sum.answers).toBe(5);
    expect(idx['2026-10-01']).toMatchObject({ app: '?', v: 1, sum: { answers: 0, topics: 0, coins: 0, xp: 0, days: 0 } });
    for (const junk of [null, undefined, 5, 'x', [], [1, 2]]) expect(parseIndex(junk)).toEqual({});
  });
  it('свежие сверху', () => {
    expect(listSnaps(idxOf({ '2026-10-03': 2, '2026-10-05': 0, '2026-10-04': 1 })).map(([id]) => id)).toEqual(['2026-10-05', '2026-10-04', '2026-10-03']);
  });
});

describe('какие снимки удалять', () => {
  it('снимку дня 14 дней — живёт, 15 — удаляется', () => {
    const idx = idxOf({ '2026-10-05': 0, '2026-10-04': 1, '2026-10-03': 2, '2026-09-21': 14, '2026-09-20': 15, '2026-09-10': 25 });
    expect(expiredIds(idx, SERVER).sort()).toEqual(['2026-09-10', '2026-09-20']);
  });
  it('свежие 3 снимка остаются даже старые (приложение не открывали три недели)', () => {
    const idx = idxOf({ '2026-09-10': 25, '2026-09-09': 26, '2026-09-08': 27, '2026-09-07': 28, '2026-09-06': 29 });
    expect(expiredIds(idx, SERVER).sort()).toEqual(['2026-09-06', '2026-09-07']);
  });
  it('копия «до восстановления» живёт 60 дней, на снимки дня не влияет', () => {
    const idx: SnapIndex = { '2026-10-05': meta(SERVER), [beforeId(SERVER - 59 * DAY)]: meta(SERVER - 59 * DAY, 'before-restore'), [beforeId(SERVER - 61 * DAY)]: meta(SERVER - 61 * DAY, 'before-restore') };
    expect(expiredIds(idx, SERVER)).toEqual([beforeId(SERVER - 61 * DAY)]);
  });
  it('сбитые часы устройства ни на что не влияют: считается только переданное серверное время', () => {
    const idx = idxOf({ '2026-10-05': 0, '2026-10-04': 1, '2026-10-03': 2, '2026-10-02': 3 });
    expect(expiredIds(idx, SERVER)).toEqual([]);
  });
});

describe('нужен ли снимок дня (planDaily)', () => {
  const before = { save: JSON.stringify(rest()), v: 1, app: '0.1.0+abc' };
  it('да: нет снимка за серверный день — снимается состояние облака ДО записи со сводкой', () => {
    const p = planDaily({ ...base, before })!;
    expect(p.id).toBe('2026-10-05');
    expect(p.doc).toMatchObject({ save: before.save, at: SERVER, app: '0.1.0+abc', v: 1, kind: 'day', sum: { answers: 14, topics: 2, coins: 30, xp: 100, days: 2 } });
    expect(Object.keys(p.index)).toEqual(['2026-10-05']);
  });
  it('нет: устройство ещё не читало облако', () => { expect(planDaily({ ...base, pulled: false, before })).toBeNull(); });
  it('нет: облако новее приложения (только чтение)', () => { expect(planDaily({ ...base, readOnly: true, before })).toBeNull(); });
  it('нет: за этот серверный день снимок уже есть', () => { expect(planDaily({ ...base, index: idxOf({ '2026-10-05': 0 }), before })).toBeNull(); });
  it('да: вчерашний снимок есть, сегодняшнего нет', () => { expect(planDaily({ ...base, index: idxOf({ '2026-10-04': 1 }), before })?.id).toBe('2026-10-05'); });
  it('нет: серверное время неизвестно или не число', () => {
    for (const bad of [null, 0, -5, NaN]) expect(planDaily({ ...base, serverMs: bad as any, before })).toBeNull();
  });
  it('нет: до этой записи в облаке ничего не было / документ новее схемы / не читается / пустой / слишком большой', () => {
    expect(planDaily({ ...base, before: null })).toBeNull();
    expect(planDaily({ ...base, before: { ...before, v: 2 } })).toBeNull();
    expect(planDaily({ ...base, before: { save: JSON.stringify(rest({ version: 2 })), v: 1 } })).toBeNull();
    expect(planDaily({ ...base, before: { save: '{не json', v: 1 } })).toBeNull();
    expect(planDaily({ ...base, before: { save: 12345 as any, v: 1 } })).toBeNull();
    expect(planDaily({ ...base, before: { save: JSON.stringify(rest({ xp: 0, diagnosticDone: false })), v: 1 } })).toBeNull();
    expect(planDaily({ ...base, before: { save: JSON.stringify(rest({ pad: 'x'.repeat(SNAP_MAX_BYTES) })), v: 1 } })).toBeNull();
  });
  it('при записи нового снимка просроченные уходят из списка и попадают в удаление', () => {
    const p = planDaily({ ...base, index: idxOf({ '2026-10-04': 1, '2026-10-03': 2, '2026-10-02': 3, '2026-09-10': 25 }), before })!;
    expect(p.expire).toEqual(['2026-09-10']);
    expect(Object.keys(p.index).sort()).toEqual(['2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05']);
  });
  it('старый v у записи без поля v считается первой схемой', () => {
    expect(planDaily({ ...base, before: { save: before.save } })?.doc.v).toBe(1);
  });
});

describe('копия «до восстановления» (planBefore)', () => {
  it('сохраняет текущее без истории ответов, id по серверному времени', () => {
    const p = planBefore({ rest: rest({ xp: 300 }), serverMs: SERVER, index: {}, app: 'v1', clientSchema: 1 })!;
    expect(p.id).toBe(beforeId(SERVER));
    expect(JSON.parse(p.doc.save).xp).toBe(300);
    expect(p.doc.kind).toBe('before-restore');
    expect(p.index[p.id].sum.xp).toBe(300);
  });
  it('слишком большое — null (восстановление тогда не начнётся)', () => {
    expect(planBefore({ rest: rest({ pad: 'x'.repeat(SNAP_MAX_BYTES) }), serverMs: SERVER, index: {}, app: 'v', clientSchema: 1 })).toBeNull();
  });
});

describe('проверка снимка перед восстановлением', () => {
  const ok = JSON.stringify(rest());
  it('нормальный проходит', () => { expect(checkSaveJson(ok, 1)).toMatchObject({ ok: true }); });
  it('схема новее приложения — не восстанавливается (и в документе, и в самом сохранении)', () => {
    expect(checkSaveJson(JSON.stringify(rest({ version: 2 })), 1)).toEqual({ ok: false, why: 'newer' });
    expect(checkSnapshotDoc({ save: ok, v: 2 }, 1)).toEqual({ ok: false, why: 'newer' });
    expect(checkSnapshotDoc({ save: ok, v: 2 }, 2)).toMatchObject({ ok: true });
  });
  it('испорченное: не строка, не JSON, не объект, странные типы — отказ «broken», приложение не падает', () => {
    for (const bad of [undefined, null, 5, {}, [], '', 'abc', '[]', '5', 'null', JSON.stringify({ version: 'один' }), JSON.stringify(rest({ skills: 5 })), JSON.stringify(rest({ days: [] })),
      JSON.stringify(rest({ xp: '100' })), JSON.stringify(rest({ coins: null })), JSON.stringify(rest({ settings: 'x' })), JSON.stringify(rest({ heroName: 7 })), JSON.stringify(rest({ repairShop: {} })), JSON.stringify(rest({ version: 0 })), JSON.stringify(rest({ version: 1.5 }))])
      expect(checkSaveJson(bad as any, 1)).toEqual({ ok: false, why: 'broken' });
    for (const bad of [null, 5, 'x', [], { v: 'x', save: ok }, { save: 7 }, {}]) expect(checkSnapshotDoc(bad, 1)).toEqual({ ok: false, why: 'broken' });
  });
  it('пустое сохранение не восстанавливается (стёрло бы прогресс)', () => {
    expect(checkSaveJson(JSON.stringify(rest({ xp: 0, diagnosticDone: false })), 1)).toEqual({ ok: false, why: 'empty' });
    expect(checkSaveJson(JSON.stringify({}), 1)).toEqual({ ok: false, why: 'empty' });
  });
});

describe('сравнение «сейчас → в снимке»', () => {
  it('пять показателей и флаг «вернёт назад»', () => {
    const r = compareSaves(rest({ xp: 300, coins: 50 }), rest({ xp: 100, coins: 80 }));
    expect(r.rows.map(x => [x.key, x.now, x.snap, x.delta])).toEqual([['answers', 14, 14, 0], ['topics', 2, 2, 0], ['coins', 50, 80, 30], ['xp', 300, 100, -200], ['days', 2, 2, 0]]);
    expect(r.rollback).toBe(true);
  });
  it('в снимке не меньше — отката нет', () => { expect(compareSaves(rest({ xp: 100 }), rest({ xp: 300 })).rollback).toBe(false); });
});

describe('сборка сохранения при восстановлении', () => {
  const local = rest({ xp: 300, coins: 99, attempts: [att(1), att(2), att(3)], settings: { extraMissionCap: 1, extraTo: 'today', planMinutes: 40, pin: 'нов' }, aiLog: [{ at: 5, day: 'd', skill: 's', task: 't', q: 'свой', a: 'a' }], usage: [{ day: '2026-10-05', activeMs: 5 }] });
  const snap = rest({ xp: 40, coins: 5, skills: { a: sk(1) }, settings: { extraMissionCap: 1, extraTo: 'today', planMinutes: 25, pin: 'стар' }, aiLog: [{ at: 4, day: 'd', skill: 's', task: 't', q: 'старый', a: 'a' }] });
  it('всё из снимка, но ответы не теряются никогда', () => {
    const out = restoredSave(local, snap);
    expect(out.xp).toBe(40); expect(out.coins).toBe(5); expect(Object.keys(out.skills)).toEqual(['a']);
    expect(out.attempts.map(a => a.at)).toEqual([1, 2, 3]);
  });
  it('ответы из самого снимка (если есть) объединяются, без повторов', () => {
    expect(restoredSave(local, snap, [att(3), att(7)]).attempts.map(a => a.at)).toEqual([1, 2, 3, 7]);
  });
  it('PIN остаётся тот, что стоит на устройстве; остальные настройки — из снимка', () => {
    const out = restoredSave(local, snap);
    expect(out.settings.pin).toBe('нов'); expect(out.settings.planMinutes).toBe(25);
  });
  it('нет PIN на устройстве — берётся из снимка; нет нигде — поля нет', () => {
    const noPin = { ...local, settings: { extraMissionCap: 1, extraTo: 'today', planMinutes: 40 } };
    expect(restoredSave(noPin as any, snap).settings.pin).toBe('стар');
    expect('pin' in restoredSave(noPin as any, rest()).settings).toBe(false);
  });
  it('вопросы к ИИ-помощнику и поведение по дням объединяются, не пропадают', () => {
    const out = restoredSave(local, snap);
    expect(out.aiLog!.map(x => x.q)).toEqual(['старый', 'свой']);
    expect(out.usage!.map(u => u.day)).toEqual(['2026-10-05']);
  });
  it('входные объекты не меняются', () => {
    const l = JSON.stringify(local), s = JSON.stringify(snap);
    restoredSave(local, snap);
    expect(JSON.stringify(local)).toBe(l); expect(JSON.stringify(snap)).toBe(s);
  });
  it('на устройстве нет ответов — ответов нет и после (ничего не придумывается)', () => {
    expect(restoredSave(rest({ attempts: [] }), snap).attempts).toEqual([]);
  });
});

describe('red-team S4: размер в байтах и типы полей', () => {
  it('сохранение из кириллицы, меньшее лимита в знаках, но большее в байтах, в снимок не берётся', () => {
    const pad = 'ә'.repeat(SNAP_MAX_BYTES / 2 - 2000);   // ≈ 0,95 МБ знаков не набрать: знаков вдвое меньше, байт столько же
    const big = JSON.stringify({ version: 1, heroName: 'Т', xp: 5, skills: {}, days: {}, settings: {}, pad: pad + 'ә'.repeat(2000) });
    expect(big.length).toBeLessThan(SNAP_MAX_BYTES); expect(new TextEncoder().encode(big).length).toBeGreaterThan(SNAP_MAX_BYTES);
    expect(planDaily({ ...base, before: { save: big, v: 1 } })).toBeNull();
  });
  it('aiLog и usage не массивы: снимок битый (восстановление не начинается)', () => {
    for (const k of ['aiLog', 'usage']) for (const v of [5, 'abc', {}, null]) {
      if (v === null) continue;
      expect(checkSaveJson(JSON.stringify({ version: 1, xp: 5, heroName: 'Т', [k]: v }), 1).ok, `${k}=${JSON.stringify(v)}`).toBe(false);
    }
    expect(checkSaveJson(JSON.stringify({ version: 1, xp: 5, heroName: 'Т', aiLog: [], usage: [] }), 1).ok).toBe(true);
  });
});
