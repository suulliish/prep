// Минуты по новому правилу «точность стоит, труд возвращает» (D2, 02.10): движок src/engine/minutes.ts и «тень» src/engine/minutesShadow.ts.
// Эталонные числа взяты из прототипа docs/systems/proto/minutes_proto.mjs (его вывод: `node docs/systems/proto/minutes_proto.mjs`).
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import {
  MIN, classify, newMinDay, addSlot, addHonest, honestCapMs, honestTotalMs, honestRight, debtOf, repairQueue, onRepair, onExplained,
  barOf, bar, debtLeft, wrongRun, stuck, shouldCredit, credit, applyCredit, extraBar, extraCredit, extraAllowed, weekendBank, weekendShare,
  mergeMinDay, mergeDebts, cleanMinDay, cleanDebts, dunnoMany, needsExplain, slotKinds,
} from '../src/engine/minutes';
import { shadowAnswer, shadowSummary } from '../src/engine/minutesShadow';
import { stable, mergeSave } from '../src/engine/sync';
import { recordAttempt } from '../src/engine/progress';
import { settleDay, examShare, restoreFix, blankDay, type Plan } from '../src/engine/planner';
import { RULES_V } from '../src/engine/rules';
import type { Attempt, MinDay, MinDebt, MinKind, MinSlot, Save } from '../src/engine/types';

const DAY = '2026-10-07';
const DEV = 'dev-a';

// ---------- прототип: тот же день, но через функции движка ----------
interface DayOpts { N?: number; errs?: number; dunno?: number; rushWrong?: number; repairOk?: number; repairWrong?: number; tS?: number; twinS?: number; lessonMin?: number; dunnoS?: number }
/** День по сценарию прототипа: errs неверных (честных), dunno «Білмеймін», rushWrong неверных наспех, остальные верные; потом ремонт близнецами до 60 или до предела 50 мин. */
function simDay(o: DayOpts) {
  const { N = 24, errs = 0, dunno = 0, rushWrong = 0, repairOk = Infinity, repairWrong = 0, tS = 50, twinS = 45, lessonMin = 10, dunnoS = tS } = o;
  const m = newMinDay(N), debts: Record<string, MinDebt> = {};
  addHonest(m, DEV, 'lesson', lessonMin * 60000, false);
  for (let i = 0; i < N; i++) {
    const k: MinKind = i < errs ? 'wrong' : i < errs + dunno ? 'dunno' : i < errs + dunno + rushWrong ? 'wrong' : 'right';
    const rushed = i >= errs + dunno && i < errs + dunno + rushWrong;
    const id = `s${String(i).padStart(2, '0')}`, slot: MinSlot = { k, at: 1000 + i, src: 't', skill: 'a' };
    addSlot(m, id, slot);
    const d = debtOf(id, slot, DAY); if (d) debts[id] = d;
    if (!rushed) addHonest(m, DEV, id, (k === 'dunno' ? dunnoS : tS) * 1000, k === 'right');
  }
  const bar0 = bar(m, debts, DAY);
  let tw = 0, wr = 0, capHit = false;
  const many = dunnoMany(m);
  outer: for (let round = 0; round < 200; round++) {
    const q = repairQueue(debts, DAY, many);
    if (!q.length) break;
    const d = q[0];
    for (let guard = 0; guard < 6 && debts[d.id].got < (d.k === 'dunno' && many ? 2 : d.need); guard++) {
      if (shouldCredit(m, debts, DAY) === 'cap') { capHit = true; break outer; }
      const aid = `r${tw}-${wr}-${guard}-${d.id}`;
      if (wr < repairWrong) { wr++; addHonest(m, DEV, aid, twinS * 1000, false); continue; }
      if (tw >= repairOk) break outer;
      onRepair(debts, d.id, aid, DAY, true, many); tw++;
      addHonest(m, DEV, aid, twinS * 1000, true);
    }
  }
  const left = debtLeft(m, debts, DAY).today;
  const via = capHit ? 'cap' : shouldCredit(m, debts, DAY) === 'full' ? 'full' : 'stop';
  const res = credit(m, debts, DAY, via);
  return { m, debts, bar0: +bar0.toFixed(1), bar: +bar(m, debts, DAY).toFixed(1), credited: res.min, twins: tw, left, honestMin: +(honestTotalMs(m) / 60000).toFixed(1), capHit, res };
}

describe('прототип: рабочие примеры (planN 24, ответ 50 с, близнец 45 с, урок 10 мин)', () => {
  const rows: [string, DayOpts, { bar0: number; bar: number; credited: number; twins: number; left: number; honestMin: number; capHit: boolean }][] = [
    ['1 ошибка', { errs: 1 }, { bar0: 56.9, bar: 60, credited: 60, twins: 2, left: 0, honestMin: 31.5, capHit: false }],
    ['8 ошибок', { errs: 8 }, { bar0: 35, bar: 60, credited: 60, twins: 16, left: 0, honestMin: 42, capHit: false }],
    ['8 ошибок, 3 неверных близнеца', { errs: 8, repairWrong: 3 }, { bar0: 35, bar: 60, credited: 60, twins: 16, left: 0, honestMin: 44.3, capHit: false }],
    ['15 нарочных наспех', { rushWrong: 15 }, { bar0: 13.1, bar: 60, credited: 60, twins: 30, left: 0, honestMin: 40, capHit: false }],
    ['15 нарочных медленно (предел 50 мин)', { errs: 15 }, { bar0: 13.1, bar: 55.3, credited: 60, twins: 27, left: 3, honestMin: 50.3, capHit: true }],
    ['15 нарочных наспех и бросил ремонт', { rushWrong: 15, repairOk: 0 }, { bar0: 13.1, bar: 13.1, credited: 13, twins: 0, left: 30, honestMin: 17.5, capHit: false }],
    ['0 ошибок', {}, { bar0: 60, bar: 60, credited: 60, twins: 0, left: 0, honestMin: 30, capHit: false }],
    ['3 «Білмеймін»', { dunno: 3 }, { bar0: 52.5, bar: 60, credited: 60, twins: 3, left: 0, honestMin: 32.3, capHit: false }],
  ];
  for (const [name, o, want] of rows) {
    it(name, () => {
      const r = simDay(o);
      expect({ bar0: r.bar0, bar: r.bar, credited: r.credited, twins: r.twins, left: r.left, honestMin: r.honestMin, capHit: r.capHit }).toEqual(want);
    });
  }
  it('прямой порт barOf совпадает с формулой прототипа на случайных днях', () => {
    const V = { right: 1, dunno: 0, rush: 0, wrong: -0.25, away: -0.25 } as Record<string, number>, NEED = { wrong: 2, away: 2, dunno: 1, rush: 1 } as Record<string, number>;
    const r = rng(7);
    for (let t = 0; t < 300; t++) {
      const kinds = Array.from({ length: 1 + Math.floor(r() * 30) }, () => pick(r, ['right', 'right', 'wrong', 'dunno', 'rush', 'away']) as MinKind);
      const debts = kinds.filter(k => NEED[k]).map(k => ({ k: k as MinDebt['k'], need: NEED[k], got: Math.floor(r() * (NEED[k] + 1)) }));
      let s = 0; for (const k of kinds) s += V[k]; for (const d of debts) s += (1 - V[d.k]) * Math.min(d.got, d.need) / d.need;
      const N = 24, want = 60 * Math.max(0, Math.min(1, s / Math.max(N, kinds.length)));
      expect(barOf(kinds, debts, N)).toBeCloseTo(want, 9);
    }
  });
});

describe('classify: чем ответ стал для минут', () => {
  const base = { correct: true, hintLevel: 0, rushed: false, closed: false, dunno: false, timeMs: 20000 };
  const rows: [string, Partial<typeof base>, string][] = [
    ['верный честный', {}, 'right'],
    ['верный с наводкой (1)', { hintLevel: 1 }, 'right'],
    ['верный после правила (2) — как «Білмеймін»', { hintLevel: 2 }, 'dunno'],
    ['верный после первого шага (3)', { hintLevel: 3 }, 'dunno'],
    ['полный разбор, верный', { hintLevel: 4 }, 'dunno'],
    ['полный разбор, неверный', { hintLevel: 4, correct: false }, 'dunno'],
    ['верный наспех', { rushed: true }, 'rush'],
    ['неверный', { correct: false }, 'wrong'],
    ['неверный наспех остаётся неверным', { correct: false, rushed: true }, 'wrong'],
    ['«Білмеймін»', { correct: false, dunno: true }, 'dunno'],
    ['«Білмеймін» мгновенно — не прочитал', { correct: false, dunno: true, timeMs: 900 }, 'rush'],
    ['свернул, верный', { closed: true }, 'away'],
    ['свернул, неверный', { closed: true, correct: false }, 'away'],
  ];
  for (const [name, p, want] of rows) it(name, () => expect(classify({ ...base, ...p })).toBe(want));
  it('веса и близнецы как в решении: +1, 0, 0, −¼, −¼ и 2/2/1/1', () => {
    expect(MIN.v).toEqual({ right: 1, dunno: 0, rush: 0, wrong: -0.25, away: -0.25 });
    expect(MIN.twins).toEqual({ wrong: 2, away: 2, dunno: 1, rush: 1 });
    expect([MIN.day, MIN.honestCapMin, MIN.honestCapRight, MIN.carryMax, MIN.wkMax, MIN.stuckRow, MIN.extra, MIN.extraCapMin]).toEqual([60, 50, 12, 8, 90, 5, 15, 13]);
  });
});

describe('предел 60, предел честного времени, перенос ≤ 8, копилка ≤ 90', () => {
  it('полоса никогда не выше 60 и не ниже 0 — и на испорченных данных', () => {
    const r = rng(11);
    for (let t = 0; t < 400; t++) {
      const m = rndDay(r);
      const debts: Record<string, MinDebt> = {};
      for (const [id, s] of Object.entries(m.slots)) { const d = debtOf(id, s, DAY); if (d) { d.got = Math.floor(r() * 9) - 2; debts[id] = d; } }
      // долги без слота, с чужого дня и с мусором внутри
      (debts as any).ghost = { id: 'ghost', skill: 'a', src: 'b', k: 'dunno', need: 99, got: 1e9, day: DAY, at: 1 };
      (debts as any).nan = { id: 'nan', skill: 'a', src: 'b', k: 'wrong', need: 2, got: NaN, day: DAY, at: 1 };
      (m as any).slots.bad = { k: 'правый', at: 'x' };
      (m as any).planN = pick(r, [NaN, -5, 0, 1e9, 'a', 24]);
      const b = bar(m, debts, DAY);
      expect(Number.isFinite(b)).toBe(true);
      expect(b).toBeGreaterThanOrEqual(0); expect(b).toBeLessThanOrEqual(60 + 1e-9);
      expect(credit(m, debts, DAY, pick(r, ['full', 'cap', 'stop', 'sick'])).min).toBeLessThanOrEqual(60);
    }
  });
  it('долг без слота ответа очков не даёт', () => {
    const m = newMinDay(24);
    const debts: Record<string, MinDebt> = { x: { id: 'x', skill: 'a', src: 't', k: 'wrong', need: 2, got: 2, day: DAY, at: 1 } };
    expect(bar(m, debts, DAY)).toBe(0);
  });
  it('«full» и «cap» не дают 60 просто по слову: нужно заработать', () => {
    const m = newMinDay(24);
    addSlot(m, 'a', { k: 'wrong', at: 1, src: 't', skill: 'a' });
    const debts = { a: debtOf('a', m.slots.a, DAY)! };
    expect(credit(m, debts, DAY, 'full').min).toBe(Math.round(bar(m, debts, DAY)));
    expect(credit(m, debts, DAY, 'cap').min).toBeLessThan(60);
  });
  it('предел 50 мин даёт 60 только при ≥ 12 честных верных; 49,9 мин не дают', () => {
    const m = newMinDay(24), debts: Record<string, MinDebt> = {};
    for (let i = 0; i < 24; i++) addSlot(m, `s${i}`, { k: 'wrong', at: i + 1, src: 't', skill: 'a' });
    for (let i = 0; i < 24; i++) debts[`s${i}`] = debtOf(`s${i}`, m.slots[`s${i}`], DAY)!;
    for (let i = 0; i < 11; i++) addHonest(m, DEV, `r${i}`, 5 * 60000, true);
    addHonest(m, DEV, 'w', 5 * 60000, false);
    expect(honestTotalMs(m)).toBe(60 * 60000); expect(honestRight(m)).toBe(11);
    expect(shouldCredit(m, debts, DAY)).toBeNull();            // 60 мин, но верных 11
    addHonest(m, DEV, 'r11', 1, true);
    expect(shouldCredit(m, debts, DAY)).toBe('cap');
    const m2 = newMinDay(24);
    for (let i = 0; i < 12; i++) addHonest(m2, DEV, `r${i}`, 4 * 60000 + 9 * 1000, true);
    expect(honestTotalMs(m2)).toBeLessThan(50 * 60000);
    expect(shouldCredit(m2, {}, DAY)).toBeNull();
  });
  it('перенос: незакрытые долги ≤ 8 близнецов, остальное — в обычный ремонт без минут', () => {
    const r = simDay({ rushWrong: 15, repairOk: 0 });          // 30 близнецов долга, ремонт брошен
    const rest = (ids: string[]) => ids.reduce((s, id) => s + (r.debts[id].need - r.debts[id].got), 0);
    expect(r.res.carry.length).toBeGreaterThan(0);
    expect(rest(r.res.carry)).toBeLessThanOrEqual(8);
    expect(rest(r.res.carry) + rest(r.res.drop)).toBe(30);
    expect(r.res.via).toBe('stop');
    // завтра в очереди тоже не больше 8 близнецов с прошлого дня
    const q = repairQueue(r.debts, '2026-10-08');
    expect(q.reduce((s, d) => s + d.need - d.got, 0)).toBeLessThanOrEqual(8);
    expect(q.every(d => d.carried)).toBe(true);
  });
  it('долг, не закрытый за 2 учебных дня, из очереди уходит', () => {
    const m = newMinDay(24), debts: Record<string, MinDebt> = {};
    addSlot(m, 'a', { k: 'wrong', at: 1, src: 't', skill: 'a' });
    debts.a = debtOf('a', m.slots.a, '2026-10-05')!;           // понедельник
    expect(repairQueue(debts, '2026-10-06')).toHaveLength(1);   // вт: 1 учебный день
    expect(repairQueue(debts, '2026-10-07')).toHaveLength(1);   // ср: 2
    expect(repairQueue(debts, '2026-10-08')).toHaveLength(0);   // чт: 3
  });
  it('перенесённый долг: не больше 2 попыток в день, неверная тоже попытка', () => {
    const debts: Record<string, MinDebt> = { a: debtOf('a', { k: 'wrong', at: 1, src: 't', skill: 'a' }, '2026-10-05')! };
    expect(onRepair(debts, 'a', 'x1', '2026-10-06', false)).toBe(true);
    expect(onRepair(debts, 'a', 'x2', '2026-10-06', false)).toBe(true);
    expect(onRepair(debts, 'a', 'x3', '2026-10-06', true)).toBe(false);   // третья попытка за день
    expect(debts.a.got).toBe(0);
    expect(onRepair(debts, 'a', 'x4', '2026-10-07', true)).toBe(true);    // новый день — новые попытки
    expect(debts.a.got).toBe(1);
  });
  it('копилка выходных ≤ 90', () => {
    expect(weekendShare(60)).toBe(18);
    expect(weekendBank([18, 18, 18, 18, 18])).toBe(90);
    expect(weekendBank([18, 18, 18, 18, 18], 15)).toBe(90);
    expect(weekendBank([18, 18, 18], 15)).toBe(69);
    expect(weekendBank([NaN, -4, 1e9])).toBe(90);
  });
  it('начисление одно и неизменно', () => {
    const m = newMinDay(24);
    const c1 = applyCredit(m, { via: 'full', min: 60, wk: 18, carry: [], drop: [] }, 100);
    const c2 = applyCredit(m, { via: 'stop', min: 5, wk: 1, carry: [], drop: [] }, 200);
    expect(c2).toEqual(c1); expect(m.credit).toEqual({ at: 100, min: 60, via: 'full', wk: 18 });
    expect(shouldCredit(m, {}, DAY)).toBeNull();               // уже начислено
  });
  it('доп. миссия: 15 максимум, предел 13 мин, только после начисления дня', () => {
    const e = newMinDay(MIN.extraN);
    for (let i = 0; i < 10; i++) addSlot(e, `e${i}`, { k: i < 2 ? 'wrong' : 'right', at: i + 1, src: 't', skill: 'a' });
    expect(extraBar(e)).toBeCloseTo(15 * 7.5 / 10, 9);
    expect(extraCredit(e)).toBe(Math.round(11.25));
    addHonest(e, DEV, 'h', 13 * 60000, false);
    expect(extraCredit(e)).toBe(15);
    expect(extraAllowed(newMinDay())).toBe(false);
    const day = newMinDay(); day.credit = { at: 1, min: 60, via: 'full', wk: 18 };
    expect(extraAllowed(day)).toBe(true);
  });
});

describe('идемпотентность записей', () => {
  it('слот: тот же ответ — без изменений; конфликт по id — остаётся более ранний', () => {
    const m = newMinDay(24);
    const first: MinSlot = { k: 'wrong', at: 100, src: 't', skill: 'a' };
    expect(addSlot(m, 'x', first)).toBe(true);
    expect(addSlot(m, 'x', { ...first })).toBe(false);
    expect(addSlot(m, 'x', { k: 'right', at: 200, src: 't', skill: 'a' })).toBe(false);   // позднее не затирает
    expect(m.slots.x.k).toBe('wrong');
    expect(addSlot(m, 'x', { k: 'right', at: 50, src: 't', skill: 'a' })).toBe(true);     // раннее заменяет
    expect(m.slots.x.k).toBe('right');
  });
  it('закрытие долга: тот же ответ-близнец второй раз got не увеличивает', () => {
    const debts: Record<string, MinDebt> = { a: debtOf('a', { k: 'wrong', at: 1, src: 't', skill: 'a' }, DAY)! };
    expect(onRepair(debts, 'a', 'x', DAY, true)).toBe(true);
    expect(onRepair(debts, 'a', 'x', DAY, true)).toBe(false);
    expect(debts.a.got).toBe(1);
    expect(onRepair(debts, 'a', 'y', DAY, true)).toBe(true);
    expect(debts.a.got).toBe(2);
    expect(onRepair(debts, 'a', 'z', DAY, true)).toBe(false);   // закрыт — дальше ничего
    expect(debts.a.got).toBe(2);
  });
  it('долг другого дня, даже с чужим слотом, в полосу этого дня не идёт', () => {
    const m = newMinDay(24); addSlot(m, 'a', { k: 'wrong', at: 1, src: 't', skill: 'a' });
    const d = debtOf('a', m.slots.a, '2026-10-06')!; d.got = 2;
    expect(bar(m, { a: d }, DAY)).toBe(barOf(['wrong'], [], 24));
  });
});

describe('честное время', () => {
  it('задача ≤ min(180 с, max(45 с, 3 × медиана)); шаг урока ≤ 120 с; мусор — 0', () => {
    expect(honestCapMs(500000)).toBe(180000);
    expect(honestCapMs(500000, { medianMs: 10000 })).toBe(45000);
    expect(honestCapMs(500000, { medianMs: 30000 })).toBe(90000);
    expect(honestCapMs(500000, { medianMs: 100000 })).toBe(180000);
    expect(honestCapMs(20000, { medianMs: 30000 })).toBe(20000);
    expect(honestCapMs(500000, { step: true })).toBe(120000);
    expect(honestCapMs(NaN)).toBe(0); expect(honestCapMs(-5)).toBe(0);
  });
  it('повторный вызов с тем же ответом время не удваивает', () => {
    const m = newMinDay(24);
    expect(addHonest(m, DEV, 'a', 30000, true)).toBe(true);
    expect(addHonest(m, DEV, 'a', 30000, true)).toBe(false);
    expect(honestTotalMs(m)).toBe(30000); expect(honestRight(m)).toBe(1);
  });
});

describe('стойка, «Білмеймін на всё», «застрял»', () => {
  it('«стойка»: все ответы верные, но наспех — 0 минут, ни секунды честного времени, ремонт 24 близнеца', () => {
    const r = simDay({ rushWrong: 0 });
    const m = newMinDay(24), debts: Record<string, MinDebt> = {};
    for (let i = 0; i < 24; i++) { const id = `s${i}`, s: MinSlot = { k: 'rush', at: i + 1, src: 't', skill: 'a' }; addSlot(m, id, s); debts[id] = debtOf(id, s, DAY)!; }
    expect(bar(m, debts, DAY)).toBe(0);
    expect(honestTotalMs(m)).toBe(0);
    expect(credit(m, debts, DAY, 'stop').min).toBe(0);
    expect(debtLeft(m, debts, DAY).today).toBe(24);
    expect(shouldCredit(m, debts, DAY)).toBeNull();
    expect(r.bar0).toBe(60);                                   // для сравнения: честный день сразу 60
  });
  it('«Білмеймін на всё» не выгоднее честной работы: честных минут до 60 больше, чем при 0 или 8 ошибках', () => {
    const honest0 = simDay({}), honest8 = simDay({ errs: 8 }), all = simDay({ dunno: 24, dunnoS: 5 });
    expect(all.bar0).toBe(0);
    expect(all.credited).toBe(60);
    expect(all.honestMin).toBeGreaterThan(honest0.honestMin);
    expect(all.honestMin).toBeGreaterThan(honest8.honestMin);
    expect(all.twins).toBe(48);                                // после 6 «Білмеймін» за каждое по 2 близнеца
  });
  it('«Білмеймін» до 6 в день — по 1 близнецу, с 7-го по 2', () => {
    const mk = (n: number) => { const m = newMinDay(24); for (let i = 0; i < n; i++) addSlot(m, `s${i}`, { k: 'dunno', at: i + 1, src: 't', skill: 'a' }); return m; };
    expect(dunnoMany(mk(6))).toBe(false); expect(dunnoMany(mk(7))).toBe(true);
    const m = mk(7), debts: Record<string, MinDebt> = {};
    for (const [id, s] of Object.entries(m.slots)) debts[id] = debtOf(id, s, DAY)!;
    expect(debtLeft(m, debts, DAY).today).toBe(14);
    expect(debtLeft(mk(6), Object.fromEntries(Object.entries(mk(6).slots).map(([id, s]) => [id, debtOf(id, s, DAY)!])), DAY).today).toBe(6);
  });
  it('у «Білмеймін» сначала объяснение; такие долги в очереди последние', () => {
    const debts: Record<string, MinDebt> = {
      d: debtOf('d', { k: 'dunno', at: 1, src: 't', skill: 'a' }, DAY)!,
      w: debtOf('w', { k: 'wrong', at: 2, src: 't', skill: 'b' }, DAY)!,
    };
    expect(repairQueue(debts, DAY).map(x => x.id)).toEqual(['w', 'd']);
    expect(needsExplain(debts.d)).toBe(true); expect(needsExplain(debts.w)).toBe(false);
    expect(onExplained(debts, 'd')).toBe(true); expect(onExplained(debts, 'd')).toBe(false);
    expect(needsExplain(debts.d)).toBe(false);
  });
  it('застрял: 5 неверных (или свёрнутых) подряд; верный в середине обрывает; «вне счёта» не мешает', () => {
    expect(stuck(['right', 'wrong', 'wrong', 'away', 'wrong', 'wrong'])).toBe(true);
    expect(stuck(['wrong', 'wrong', 'wrong', 'wrong', 'right', 'wrong'])).toBe(false);
    expect(stuck(['wrong', 'wrong', 'wrong', 'void', 'wrong', 'wrong'])).toBe(true);
    expect(wrongRun(['wrong', 'dunno'])).toBe(0);
    expect(stuck(['wrong', 'wrong', 'wrong', 'wrong'])).toBe(false);
  });
  it('порядок кинд-слотов — по времени, а не по id', () => {
    const m = newMinDay(); addSlot(m, 'z', { k: 'right', at: 1, src: 't', skill: 'a' }); addSlot(m, 'a', { k: 'wrong', at: 2, src: 't', skill: 'a' });
    expect(slotKinds(m)).toEqual(['right', 'wrong']);
  });
});

describe('слияние двух устройств: коммутативно, идемпотентно, ассоциативно', () => {
  it('день минут: 1000 случайных пар', () => {
    const r = rng(42);
    for (let t = 0; t < 1000; t++) {
      const a = rndDay(r), b = rndDay(r);
      const ab = mergeMinDay(a, b), ba = mergeMinDay(b, a);
      expect(stable(ab)).toBe(stable(ba));
      expect(stable(mergeMinDay(a, a))).toBe(stable(cleanMinDay(a)));
      expect(stable(mergeMinDay(ab, a))).toBe(stable(ab));
      expect(stable(mergeMinDay(ab, b))).toBe(stable(ab));
    }
  });
  it('день минут: ассоциативно на тройках (результат не зависит от порядка синхронизаций)', () => {
    const r = rng(5);
    for (let t = 0; t < 400; t++) {
      const a = rndDay(r), b = rndDay(r), c = rndDay(r);
      expect(stable(mergeMinDay(mergeMinDay(a, b), c))).toBe(stable(mergeMinDay(a, mergeMinDay(b, c))));
    }
  });
  it('долги: 1000 случайных пар', () => {
    const r = rng(43);
    for (let t = 0; t < 1000; t++) {
      const a = rndDebts(r), b = rndDebts(r);
      expect(stable(mergeDebts(a, b))).toBe(stable(mergeDebts(b, a)));
      expect(stable(mergeDebts(a, a))).toBe(stable(cleanDebts(a)));
      const ab = mergeDebts(a, b);
      expect(stable(mergeDebts(ab, a))).toBe(stable(ab));
    }
    for (let t = 0; t < 300; t++) {
      const a = rndDebts(r), b = rndDebts(r), c = rndDebts(r);
      expect(stable(mergeDebts(mergeDebts(a, b), c))).toBe(stable(mergeDebts(a, mergeDebts(b, c))));
    }
  });
  it('слияние сохранения целиком (mergeSave): дни и долги не зависят от того, какая сторона «своя»', () => {
    const r = rng(9);
    for (let t = 0; t < 200; t++) {
      const sv = (m: MinDay, d: Record<string, MinDebt>): Save => ({ ...blankSave(), diagnosticDone: true, days: { [DAY]: { ...blankDay(DAY), mins: m } }, debts: d });
      const A = sv(rndDay(r), rndDebts(r)), B = sv(rndDay(r), rndDebts(r));
      const ab = mergeSave(null, A, B), ba = mergeSave(null, B, A);
      expect(stable(ab.days[DAY].mins)).toBe(stable(ba.days[DAY].mins));
      expect(stable(ab.debts)).toBe(stable(ba.debts));
    }
  });
  it('mergeSave не теряет слоты и долги ни одной стороны', () => {
    const sv = (id: string, k: 'wrong' | 'right'): Save => {
      const m = newMinDay(24); addSlot(m, id, { k, at: 5, src: 't', skill: 'a' }); addHonest(m, id === 'p' ? 'tel' : 'ipad', id, 20000, k === 'right');
      const d = debtOf(id, m.slots[id], DAY);
      return { ...blankSave(), diagnosticDone: true, days: { [DAY]: { ...blankDay(DAY), mins: m } }, ...(d ? { debts: { [id]: d } } : {}) };
    };
    const m = mergeSave(null, sv('p', 'wrong'), sv('q', 'wrong'));
    expect(Object.keys(m.days[DAY].mins!.slots).sort()).toEqual(['p', 'q']);
    expect(Object.keys(m.debts!).sort()).toEqual(['p', 'q']);
    expect(honestTotalMs(m.days[DAY].mins!)).toBe(40000);
    // у одной стороны минут нет вовсе — день другой сохраняется целиком
    const solo = mergeSave(null, { ...blankSave(), diagnosticDone: true, days: { [DAY]: blankDay(DAY) } }, sv('q', 'right'));
    expect(Object.keys(solo.days[DAY].mins!.slots)).toEqual(['q']);
    expect(solo.debts).toBeUndefined();
  });
  it('два устройства в один день: слоты складываются, честное время суммируется, а копия того же устройства не удваивается', () => {
    const A = newMinDay(24), B = newMinDay(24);
    for (let i = 0; i < 10; i++) { addSlot(A, `a${i}`, { k: 'right', at: 100 + i, src: 't', skill: 'a' }); addHonest(A, 'tel', `a${i}`, 40000, true); }
    for (let i = 0; i < 6; i++) { addSlot(B, `b${i}`, { k: i < 2 ? 'wrong' : 'right', at: 200 + i, src: 't', skill: 'b' }); addHonest(B, 'ipad', `b${i}`, 50000, i >= 2); }
    const M = mergeMinDay(A, B)!;
    expect(Object.keys(M.slots)).toHaveLength(16);
    expect(honestTotalMs(M)).toBe(10 * 40000 + 6 * 50000);
    expect(honestRight(M)).toBe(14);
    // телефон отстал: у него старая копия своего же счёта — берётся большая, а не сумма
    const Aold = newMinDay(24); addHonest(Aold, 'tel', 'a0', 40000, true);
    expect(honestTotalMs(mergeMinDay(M, Aold)!)).toBe(honestTotalMs(M));
    expect(bar(M, {}, DAY)).toBeLessThanOrEqual(60);
  });
  it('начисление при слиянии: раньше по времени, минуты — максимум', () => {
    const A = newMinDay(), B = newMinDay();
    A.credit = { at: 500, min: 55, via: 'cap', wk: 17 }; B.credit = { at: 300, min: 60, via: 'full', wk: 18 };
    expect(mergeMinDay(A, B)!.credit).toEqual({ at: 300, min: 60, via: 'full', wk: 18 });
    B.credit = { at: 900, min: 40, via: 'stop', wk: 12 };
    expect(mergeMinDay(A, B)!.credit).toEqual({ at: 500, min: 55, via: 'cap', wk: 17 });
  });
  it('испорченное с одной стороны не роняет слияние', () => {
    const good = newMinDay(24); addSlot(good, 'a', { k: 'right', at: 1, src: 't', skill: 'a' });
    for (const junk of [null, 5, 'x', [], { slots: 7 }, { slots: { a: null }, honestMs: { d: 'много' }, planN: 'z' }]) {
      const m = mergeMinDay(good, junk)!;
      expect(m.slots.a.k).toBe('right');
      expect(mergeMinDay(junk, junk)).toSatisfy((v: unknown) => v === undefined || typeof v === 'object');
    }
    expect(mergeDebts(5, undefined)).toBeUndefined();
    expect(mergeDebts({ a: 3, b: { k: 'x' } }, undefined)).toEqual({});
  });
});

// ---------- «тень»: запись ответов ----------
const blankSave = (): Save => ({ version: 1, heroName: 'М', xp: 0, skills: {}, attempts: [], days: {}, settings: { extraMissionCap: 1, extraTo: 'today', planMinutes: 40 }, diagnosticDone: false, repairShop: [], coins: 0, shipOwned: [] });
let tick = 1_000_000;
const att = (p: Partial<Attempt> = {}): Attempt => ({ at: tick += 60000, day: DAY, skill: 'a', source: 'tpl', correct: true, hintLevel: 0, honest: true, timeMs: 30000, mode: 'practice', r: RULES_V, confidence: 'sure', ...p });
const ctx = (p: Partial<{ block: any; twin: boolean; device: string }> = {}) => ({ block: 'mixed' as const, twin: false, device: DEV, ...p });
const feed = (save: Save, a: Attempt, c = ctx()) => { recordAttempt(save, a); shadowAnswer(save, a, c); };
const mins = (save: Save) => save.days[DAY]?.mins as MinDay;

describe('тень: запись ответов в DayRecord.mins и save.debts', () => {
  it('верный честный — слот right и время; долга нет', () => {
    const s = blankSave(); feed(s, att());
    expect(Object.values(mins(s).slots).map(x => x.k)).toEqual(['right']);
    expect(honestTotalMs(mins(s))).toBe(30000); expect(honestRight(mins(s))).toBe(1);
    expect(s.debts).toEqual({});
  });
  it('неверный — слот wrong и долг 2 близнеца; верный наспех — rush и долг 1; свернул — away, 2; «Білмеймін» — dunno, 1', () => {
    const s = blankSave();
    feed(s, att({ correct: false, tag: 'x' }));
    feed(s, att({ fast: true, honest: false, timeMs: 1200 }));
    feed(s, att({ correct: false, closed: true, away: 7000, honest: false }));
    feed(s, att({ correct: false, confidence: 'unsure', timeMs: 4000 }));
    const kinds = Object.values(mins(s).slots).map(x => x.k), debts = Object.values(s.debts!);
    expect(kinds).toEqual(['wrong', 'rush', 'away', 'dunno']);
    expect(debts.map(d => d.need)).toEqual([2, 1, 2, 1]);
    expect(honestTotalMs(mins(s))).toBe(30000 + 4000);   // наспех и свёрнутое времени не дают; неверный честный и «Білмеймін» — дают
  });
  it('верный с подсказкой ≥ 2 и полный разбор — как «Білмеймін» (0, 1 близнец)', () => {
    const s = blankSave(); feed(s, att({ hintLevel: 2 })); feed(s, att({ hintLevel: 4, honest: false }));
    expect(Object.values(mins(s).slots).map(x => x.k)).toEqual(['dunno', 'dunno']);
    expect(Object.values(s.debts!).map(d => d.need)).toEqual([1, 1]);
  });
  it('повторный вызов с тем же ответом ничего не удваивает (слот, долг, время)', () => {
    const s = blankSave(), a = att({ correct: false });
    feed(s, a); const once = stable({ m: s.days[DAY].mins, d: s.debts });
    shadowAnswer(s, a, ctx()); shadowAnswer(s, a, ctx()); shadowAnswer(s, { ...a }, ctx());
    expect(stable({ m: s.days[DAY].mins, d: s.debts })).toBe(once);
  });
  it('близнец (егіз) — не слот плана: честный верный закрывает долг этой темы, неверный ничего не отнимает', () => {
    const s = blankSave();
    feed(s, att({ correct: false, skill: 'frac' }));
    expect(shadowSummary(s, DAY).debtToday).toBe(2);
    feed(s, att({ correct: false, skill: 'frac' }), ctx({ twin: true }));             // неверный близнец
    expect(shadowSummary(s, DAY).debtToday).toBe(2);
    feed(s, att({ skill: 'other' }), ctx({ twin: true }));                            // близнец другой темы чужой долг не закрывает
    expect(shadowSummary(s, DAY).debtToday).toBe(2);
    feed(s, att({ skill: 'frac' }), ctx({ twin: true }));
    expect(shadowSummary(s, DAY).debtToday).toBe(1);
    const a = att({ skill: 'frac' }); feed(s, a, ctx({ twin: true })); shadowAnswer(s, a, ctx({ twin: true }));
    expect(shadowSummary(s, DAY).debtToday).toBe(0);
    expect(Object.keys(mins(s).slots)).toHaveLength(1);                                // близнецы в слоты плана не попали
  });
  it('один ответ-близнец не закрывает два долга, даже если вызвать дважды после закрытия первого', () => {
    const s = blankSave();
    feed(s, att({ fast: true, honest: false, timeMs: 1200, skill: 'k' })); feed(s, att({ fast: true, honest: false, timeMs: 1200, skill: 'k' }));
    expect(shadowSummary(s, DAY).debtToday).toBe(2);
    const t = att({ skill: 'k' }); feed(s, t, ctx({ twin: true })); shadowAnswer(s, t, ctx({ twin: true })); shadowAnswer(s, t, ctx({ twin: true }));
    expect(shadowSummary(s, DAY).debtToday).toBe(1);
  });
  it('ремонт на корабле (block repair) работает как близнец; босс в минуты не входит', () => {
    const s = blankSave(); feed(s, att({ correct: false, skill: 'k' }));
    feed(s, att({ skill: 'k' }), ctx({ block: 'repair' }));
    expect(shadowSummary(s, DAY).debtToday).toBe(1);
    const before = stable(s); shadowAnswer(s, att({ mode: 'boss', correct: false }), ctx({ block: 'boss' }));
    expect(stable(s)).toBe(before);
  });
  it('доп. миссия — отдельный день минут внутри mins.extra, долгов не заводит', () => {
    const s = blankSave(); feed(s, att({ correct: false, mode: 'extra' }), ctx({ block: 'extra' })); feed(s, att({ mode: 'extra' }), ctx({ block: 'extra' }));
    expect(mins(s)?.extra && Object.keys(mins(s).extra!.slots)).toHaveLength(2);
    expect(Object.keys(mins(s).slots)).toHaveLength(0);
    expect(s.debts).toEqual({});
    expect(shadowSummary(s, DAY).has).toBe(false);          // плановых слотов нет — строка «данных нет»
    expect(shadowSummary(s, DAY).extra?.answers).toBe(2);
  });
  it('время задачи ограничено медианой темы (3 × медиана, но не меньше 45 с)', () => {
    const s = blankSave();
    for (let i = 0; i < 4; i++) feed(s, att({ skill: 'q', timeMs: 10000 }));      // медиана 10 с → предел 45 с
    const before = honestTotalMs(mins(s));
    feed(s, att({ skill: 'q', timeMs: 170000 }));
    expect(honestTotalMs(mins(s)) - before).toBe(45000);
  });
  it('сводка: полоса, долг, честное время, предел «full»; «данных нет», когда слотов нет', () => {
    const s = blankSave();
    expect(shadowSummary(s, DAY).has).toBe(false);
    for (let i = 0; i < 23; i++) feed(s, att({ skill: 's' + i }));
    feed(s, att({ correct: false, skill: 'z' }));
    const x = shadowSummary(s, DAY);
    expect(x).toMatchObject({ has: true, bar: Math.round(60 * (23 - 0.25) / 24), debtToday: 2, answers: 24, honestRight: 23, via: null });
    expect(x.honestMin).toBeCloseTo(12, 1);
    feed(s, att({ skill: 'z' }), ctx({ twin: true })); feed(s, att({ skill: 'z' }), ctx({ twin: true }));
    expect(shadowSummary(s, DAY)).toMatchObject({ bar: 60, debtToday: 0, via: 'full' });
  });
  it('день из плана: planN берётся из плана дня, иначе 24', () => {
    const s = blankSave(); s.days[DAY] = { ...blankDay(DAY), plan: { day: DAY, blocks: [{ id: 'new', minutes: 18, skills: ['a'], items: 10 }, { id: 'summary', minutes: 2, skills: [], items: 0 }] } as Plan };
    feed(s, att());
    expect(mins(s).planN).toBe(10);
    const s2 = blankSave(); feed(s2, att()); expect(mins(s2).planN).toBe(24);
  });
  it('испорченные mins и debts в сохранении не роняют ни запись, ни сводку', () => {
    for (const junk of [null, 7, 'x', [], { slots: 'нет' }, { slots: { a: { k: 'zzz' } }, honestMs: { d: NaN }, planN: -1 }]) {
      const s = blankSave(); s.days[DAY] = { ...blankDay(DAY), mins: junk as any }; s.debts = junk as any;
      expect(() => feed(s, att())).not.toThrow();
      expect(() => shadowSummary(s, DAY)).not.toThrow();
      expect(shadowSummary(s, DAY).bar).toBeLessThanOrEqual(60);
    }
  });
  it('мусорный день ответа не пишется и не роняет игру', () => {
    const s = blankSave();
    expect(() => shadowAnswer(s, att({ day: 'вчера' }), ctx())).not.toThrow();
    expect(Object.keys(s.days)).toHaveLength(0);
  });
  it('день берётся из самого ответа (UTC+5 уже посчитан игрой), поздний ответ другого дня пишется в свой день', () => {
    const s = blankSave(); feed(s, att({ day: '2026-10-08' }));
    expect(s.days['2026-10-08'].mins.slots).toBeTruthy(); expect(s.days[DAY]).toBeUndefined();
  });
  it('перенесённый с вчера долг виден в сводке, закрывается близнецом и не входит в полосу сегодня', () => {
    const s = blankSave(); feed(s, att({ correct: false, skill: 'k', day: '2026-10-06' }));
    const t = '2026-10-07';
    expect(shadowSummary(s, t)).toMatchObject({ has: false, debtCarried: 0 });   // нет слотов сегодня — «данных нет» (но очередь ниже есть)
    feed(s, att({ skill: 'p', day: t }));
    expect(shadowSummary(s, t)).toMatchObject({ has: true, debtToday: 0, debtCarried: 2, bar: 3 });
    feed(s, att({ skill: 'k', day: t }), ctx({ twin: true }));
    expect(shadowSummary(s, t).debtCarried).toBe(1);
  });
});

describe('старое поведение не изменилось', () => {
  const plan: Plan = { day: DAY, blocks: [{ id: 'warmup', minutes: 6, skills: ['a'], items: 6 }, { id: 'new', minutes: 18, skills: ['a'], items: 10 }, { id: 'mixed', minutes: 10, skills: ['a'], items: 8 }, { id: 'summary', minutes: 2, skills: [], items: 0 }] };
  it('старые формулы минут дают те же числа (золотые значения сняты до правок)', () => {
    const rec = blankDay(DAY); rec.blocksDone = { warmup: true, new: true }; rec.honest = { warmup: 0.8, new: 1 };
    settleDay(rec, plan, 'today');
    expect([rec.minutesToday, rec.minutesWeekend]).toEqual([40, 30]);
    rec.extraMissions = 1; settleDay(rec, plan, 'today'); expect([rec.minutesToday, rec.minutesWeekend]).toEqual([55, 30]);
    settleDay(rec, plan, 'weekend'); expect([rec.minutesToday, rec.minutesWeekend]).toEqual([40, 45]);
    expect(examShare(9, 1, 10)).toBeCloseTo(0.875, 9);
    expect(examShare(0, 5, 5)).toBe(0); expect(examShare(0, 0, 0)).toBe(1);
    const r2 = blankDay(DAY); r2.tally = { warmup: { n: 6, paid: 4, wrong: 2 } };
    expect(restoreFix(r2, 'warmup', false)).toBe(true);
    expect(r2.tally.warmup).toEqual({ n: 6, paid: 5, wrong: 1 }); expect(r2.honest!.warmup).toBeCloseTo(4.75 / 6, 9);
  });
  it('тень пишет только в days[*].mins и debts: всё остальное сохранение побитово то же, что без неё', () => {
    const script: Partial<Attempt>[] = [{}, { correct: false, tag: 't' }, { fast: true, honest: false, timeMs: 1000 }, { correct: false, confidence: 'unsure', timeMs: 3000 }, { hintLevel: 3 }, { correct: false, closed: true, away: 9000, honest: false }, { skill: 'b' }, { skill: 'b', correct: false }, { skill: 'b' }, { mode: 'extra' }];
    const plain = blankSave(), shadowed = blankSave();
    plain.days[DAY] = { ...blankDay(DAY), plan }; shadowed.days[DAY] = { ...blankDay(DAY), plan };
    script.forEach((p, i) => {
      const a = att({ ...p, at: 5_000_000 + i * 1000 });
      const ev1 = recordAttempt(plain, { ...a });
      const b = { ...a }, ev2 = recordAttempt(shadowed, b);
      shadowAnswer(shadowed, b, ctx({ twin: i % 4 === 3, block: p.mode === 'extra' ? 'extra' : 'mixed' }));
      expect(ev2).toEqual(ev1);
    });
    const strip = (s: Save) => { const c = JSON.parse(JSON.stringify(s)); delete c.debts; for (const d of Object.values<any>(c.days)) delete d.mins; return c; };
    expect(stable(strip(shadowed))).toBe(stable(strip(plain)));
    expect(mins(shadowed)).toBeTruthy();
    expect(plain.days[DAY].mins).toBeUndefined();
  });
});

describe('ребёнок ничего не видит', () => {
  const walk = (dir: string): string[] => readdirSync(dir).flatMap(f => { const p = join(dir, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
  it('экраны ребёнка не читают новые минуты; их читает только вкладка «Сегодня» командира', () => {
    const files = walk('src').filter(f => /\.(svelte|ts)$/.test(f));
    const readers = files.filter(f => { const t = readFileSync(f, 'utf8'); return /shadowSummary|\.mins\b|MinutesShadow/.test(t); });
    expect(readers.map(f => f.replace(/\\/g, '/')).sort()).toEqual([
      'src/engine/minutes.ts', 'src/engine/minutesShadow.ts', 'src/engine/sync.ts',
      'src/screens/commander/MinutesShadow.svelte', 'src/screens/commander/Today.svelte',
    ].sort());
  });
  it('в Session.svelte рядом с каждым recordAttempt стоит shadowAnswer, и больше ничего из тени там нет', () => {
    const t = readFileSync('src/screens/Session.svelte', 'utf8');
    expect((t.match(/recordAttempt\(game\.save, rec\);\n\s*shadowAnswer\(game\.save, rec, \{ block, twin, device: deviceId\(\) \}\);/g) ?? []).length).toBe((t.match(/recordAttempt\(game\.save, rec\)/g) ?? []).length);
    expect((t.match(/shadowAnswer\(/g) ?? []).length).toBe(3);
    expect(t).not.toMatch(/shadowSummary|minutes'|MinutesShadow/);
  });
  it('движок минут не спрашивает часы устройства', () => {
    for (const f of ['src/engine/minutes.ts', 'src/engine/minutesShadow.ts']) expect(readFileSync(f, 'utf8')).not.toMatch(/Date\.now|new Date\(\)|performance\.now/);
  });
  it('тексты командира без длинного тире', () => {
    expect(readFileSync('src/screens/commander/MinutesShadow.svelte', 'utf8')).not.toContain('—');
  });
  it('в Today.svelte блок стоит, а у дня без слотов он говорит «данных нет»', () => {
    expect(readFileSync('src/screens/commander/Today.svelte', 'utf8')).toContain('<MinutesShadow />');
    expect(readFileSync('src/screens/commander/MinutesShadow.svelte', 'utf8')).toContain('данных нет');
  });
});

// ---------- генераторы ----------
function rng(seed: number) { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }
const pick = <T,>(r: () => number, xs: readonly T[]): T => xs[Math.floor(r() * xs.length)];
const KINDS_ALL: MinKind[] = ['right', 'wrong', 'dunno', 'rush', 'away', 'void'];
const POOL = Array.from({ length: 14 }, (_, i) => `id${i}`);
function rndSlot(r: () => number): MinSlot { return { k: pick(r, KINDS_ALL), at: pick(r, [10, 20, 30, 40]), src: pick(r, ['s1', 's2']), skill: pick(r, ['a', 'b']) }; }
function rndDay(r: () => number, depth = 0): MinDay {
  const m: MinDay = { planN: pick(r, [18, 24, 24, 30]), slots: {}, honestMs: {} };
  for (const id of POOL) if (r() < 0.45) m.slots[id] = rndSlot(r);
  for (const d of ['tel', 'ipad', 'pc']) if (r() < 0.5) m.honestMs[d] = Math.floor(r() * 40) * 30000 + 1000;
  if (r() < 0.6) { m.hid = {}; for (const id of POOL) if (r() < 0.4) m.hid[id] = pick(r, [0, 1] as const); if (!Object.keys(m.hid).length) delete m.hid; }
  if (r() < 0.3) m.credit = { at: pick(r, [100, 200, 300]), min: Math.floor(r() * 61), via: pick(r, ['full', 'cap', 'stop', 'sick'] as const), wk: Math.floor(r() * 19) };
  if (depth === 0 && r() < 0.3) m.extra = rndDay(r, 1);
  return m;
}
function rndDebts(r: () => number): Record<string, MinDebt> {
  const out: Record<string, MinDebt> = {};
  for (const id of POOL) if (r() < 0.45) {
    const k = (['wrong', 'away', 'dunno', 'rush'] as const)[Number(id.slice(2)) % 4];       // вид долга зависит от id, как в жизни: id порождает слот с одним видом
    const need = k === 'wrong' || k === 'away' ? 2 : 1, by = POOL.filter(() => r() < 0.2).slice(0, 3).map(x => 'ans-' + x);
    out[id] = { id, skill: 'a', src: 't', k, need: need as 1 | 2, got: Math.floor(r() * (need + 1)), day: DAY, at: 1, ...(r() < 0.3 ? { explained: true } : {}), ...(r() < 0.3 ? { carried: true } : {}), ...(by.length ? { by } : {}), ...(r() < 0.5 ? { tr: ['2026-10-07|x' + Math.floor(r() * 3)] } : {}) };
  }
  return out;
}

describe('тень: размер сохранения за долгий срок (проверка 07.10)', () => {
  it('за 300 дней по 40 ответов тень не раздувает сохранение: слоты старше 14 дней убираются, свежие остаются', async () => {
    const { shadowAnswer, SHADOW_KEEP_DAYS } = await import('../src/engine/minutesShadow');
    const save: any = { version: 1, heroName: 'Т', xp: 0, skills: {}, attempts: [], days: {}, settings: { extraMissionCap: 1, extraTo: 'today', planMinutes: 40 }, diagnosticDone: true, repairShop: [] };
    const start = Date.parse('2026-10-05');
    let maxBytes = 0;
    for (let d = 0; d < 300; d++) {
      const day = new Date(start + d * 864e5).toISOString().slice(0, 10);
      for (let i = 0; i < 40; i++) {
        const a: any = { at: start + d * 864e5 + i * 60000, day, skill: 'div.gcd', source: 'div.gcd_t' + (i % 5), correct: i % 7 !== 0, hintLevel: 0, honest: true, timeMs: 20000, mode: 'practice', r: 2 };
        shadowAnswer(save, a, { block: 'mixed', twin: false, device: 'dev1' });
      }
      if (d % 10 === 0) maxBytes = Math.max(maxBytes, Object.values<any>(save.days).reduce((n, r) => n + (r.mins ? JSON.stringify(r.mins).length : 0), 0) + JSON.stringify(save.debts ?? {}).length);   // только то, что добавляет тень
    }
    const days = Object.keys(save.days).sort();
    const withMins = days.filter(k => save.days[k].mins);
    expect(withMins.length).toBeLessThanOrEqual(SHADOW_KEEP_DAYS + 2);
    expect(withMins.at(-1)).toBe(days.at(-1));
    expect(save.days[days[0]].mins).toBeUndefined();
    expect(maxBytes).toBeLessThan(150_000);   // без чистки за 300 дней здесь было бы больше 1,5 МБ
    expect(JSON.stringify(save.debts ?? {}).length).toBeLessThan(60_000);
  });
});

describe('тень: второе устройство не возвращает старые слоты в облако (проверка 07.10)', () => {
  it('телефон командира не отвечает и хранит старую копию: после слияния слотов старше 14 дней нет, долги старше тоже; повтор слияния ничего не меняет', async () => {
    const { shadowAnswer } = await import('../src/engine/minutesShadow');
    const { mergeSave } = await import('../src/engine/sync');
    const mk = (): any => ({ version: 1, heroName: 'Т', xp: 10, skills: {}, attempts: [], days: {}, settings: { extraMissionCap: 1, extraTo: 'today', planMinutes: 40 }, diagnosticDone: true, repairShop: [] });
    const kid = mk(), parent = mk();
    const start = Date.parse('2026-10-05');
    for (let d = 0; d < 60; d++) {
      const day = new Date(start + d * 864e5).toISOString().slice(0, 10);
      for (let i = 0; i < 30; i++) shadowAnswer(kid, { at: start + d * 864e5 + i * 60000, day, skill: 'div.gcd', source: 'div.gcd_t' + (i % 5), correct: i % 4 !== 0, hintLevel: 0, honest: true, timeMs: 20000, mode: 'practice', r: 2 } as any, { block: 'mixed', twin: false, device: 'kid' });
      if (d === 40) { parent.days = JSON.parse(JSON.stringify(kid.days)); parent.debts = JSON.parse(JSON.stringify(kid.debts)); }   // командир в день 40 забрал копию со всеми слотами до этого дня
    }
    let a = mergeSave(null, kid, parent), b = mergeSave(null, parent, kid);
    const latest = Object.keys(a.days).sort().at(-1)!, cut = new Date(Date.parse(latest) - 14 * 864e5).toISOString().slice(0, 10);
    for (const r of [a, b]) {
      expect(Object.entries<any>(r.days).filter(([d, x]) => d < cut && x.mins).length).toBe(0);
      expect(Object.values<any>(r.debts ?? {}).filter(x => x.day < cut).length).toBe(0);
    }
    expect(JSON.stringify(mergeSave(null, a, b).days)).toBe(JSON.stringify(a.days));   // повторное слияние ничего не меняет
  });
});
