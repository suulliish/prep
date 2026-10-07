// Движок минут по решению семьи 02.10 «точность стоит, труд возвращает» (docs/systems/specs/day.md, PR D2).
// Во время плана: верный +1, «Білмеймін» и верный наспех 0, неверный и свёрнутый −¼. Потерянное возвращает ремонт:
// за ошибку 2 верных близнеца, за «Білмеймін» объяснение и 1. Полный ремонт даёт ровно 60; 50 минут честной работы (при ≥ 12 честных верных) тоже 60.
// Чистый модуль: ни времени устройства, ни Svelte. Все записи идемпотентны (у каждого ответа свой id), а слияние двух устройств
// коммутативно и идемпотентно (tests/minutes.test.ts гоняет его на 1000 случайных пар). Числа — content/balance.mjs (MIN).
// Пока работает «в тени»: считается параллельно со старыми минутами (planner.ts) и виден только командиру, см. minutesShadow.ts.
import type { MinCredit, MinDay, MinDebt, MinKind, MinSlot } from './types';
import { classify, type MinuteKind } from './rules';
import { schoolDaysBetween } from './dates';
// @ts-ignore — числа игры на JS
import { MIN as MIN_JS } from '../../content/balance.mjs';

export { classify };
export type { MinuteKind };

export const MIN = MIN_JS as {
  day: number; extra: number; extraPerDay: number; planN: number; extraN: number;
  v: Record<'right' | 'dunno' | 'rush' | 'wrong' | 'away', number>;
  twins: Record<'wrong' | 'away' | 'dunno' | 'rush', 1 | 2>;
  dunnoMany: number; stuckRow: number; stuckEasy: number; honestCapMin: number; honestCapRight: number; extraCapMin: number;
  taskCapS: number; taskFloorS: number; taskMedianK: number; stepCapS: number; carryMax: number; carryDays: number; repairTries: number; wkPerDay: number; wkMax: number;
};

type DebtKind = MinDebt['k'];
const KINDS: readonly MinKind[] = ['right', 'wrong', 'dunno', 'rush', 'away', 'void'];
const DEBT_KINDS: readonly DebtKind[] = ['wrong', 'away', 'dunno', 'rush'];
const VIAS: readonly MinCredit['via'][] = ['full', 'cap', 'stop', 'sick'];
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_STR = 200, MAX_HONEST_MS = 12 * 3600 * 1000, EPS = 1e-9;

const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
const fin = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
const str = (x: unknown) => (typeof x === 'string' ? x.slice(0, MAX_STR) : '');
const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

// ---------- слоты ----------
/** Вес слота в полосе: +1 / 0 / −¼; «вне счёта» (void) не считается вовсе. */
export const slotValue = (k: MinKind): number => (k === 'void' ? 0 : MIN.v[k]);
/** Один ответ — один id: повторный вызов с тем же ответом пишет в то же место. */
export const answerId = (a: { day: string; at: number; skill: string; source: string }) => `${a.day}|${a.at}|${a.skill}|${a.source}`;

export function newMinDay(planN: number = MIN.planN): MinDay { return { planN: fin(planN) && planN >= 1 ? Math.min(200, Math.round(planN)) : MIN.planN, slots: {}, honestMs: {} }; }

export function cleanSlot(x: unknown): MinSlot | null {
  if (!isObj(x) || !KINDS.includes(x.k as MinKind) || !fin(x.at)) return null;
  return { k: x.k as MinKind, at: x.at, src: str(x.src), skill: str(x.skill) };
}
const slotKey = (s: MinSlot) => `${s.k}|${s.src}|${s.skill}`;
/** Из двух слотов с одним id остаётся тот, что раньше (при равенстве времени — по тексту): результат не зависит от порядка. */
const earlierSlot = (a: MinSlot, b: MinSlot) => (a.at !== b.at ? (a.at < b.at ? a : b) : cmp(slotKey(a), slotKey(b)) <= 0 ? a : b);

/** Испорченное значение не роняет и не даёт лишнего: неверные слоты, числа и учёт выбрасываются, остальное приводится к норме. undefined — дня минут нет. */
export function cleanMinDay(x: unknown, depth = 0): MinDay | undefined {
  if (!isObj(x)) return undefined;
  const out: MinDay = { planN: fin(x.planN) && x.planN >= 1 ? Math.min(200, Math.round(x.planN)) : MIN.planN, slots: {}, honestMs: {} };
  if (isObj(x.slots)) for (const [id, raw] of Object.entries(x.slots)) { const s = id.length <= MAX_STR ? cleanSlot(raw) : null; if (s) out.slots[id] = s; }
  if (isObj(x.honestMs)) for (const [d, v] of Object.entries(x.honestMs)) if (d.length <= MAX_STR && fin(v) && v > 0) out.honestMs[d] = Math.min(MAX_HONEST_MS, Math.round(v));
  if (isObj(x.hid)) {
    const hid: Record<string, 0 | 1> = {};
    for (const [id, v] of Object.entries(x.hid)) if (id.length <= MAX_STR && (v === 0 || v === 1)) hid[id] = v;
    if (Object.keys(hid).length) out.hid = hid;
  }
  const c = x.credit;
  if (isObj(c) && fin(c.at) && fin(c.min) && VIAS.includes(c.via as MinCredit['via'])) out.credit = { at: c.at, min: Math.max(0, Math.min(MIN.day, Math.round(c.min))), via: c.via as MinCredit['via'], wk: fin(c.wk) ? Math.max(0, Math.min(MIN.wkPerDay, Math.round(c.wk))) : 0 };
  if (depth === 0) { const e = cleanMinDay(x.extra, 1); if (e) out.extra = e; }
  return out;
}

/** Записать слот ответа. true — что-то изменилось. Повтор того же ответа ничего не делает. */
export function addSlot(m: MinDay, id: string, slot: MinSlot): boolean {
  const old = m.slots[id];
  if (!old) { m.slots[id] = slot; return true; }
  const keep = earlierSlot(old, slot);
  if (keep === old) return false;
  m.slots[id] = keep; return true;
}

// ---------- честное время ----------
/** Сколько мс ответа идёт в честное время: задача ≤ min(180 с, max(45 с, 3 × медиана верных по теме)); шаг урока, разбор, вспоминание ≤ 120 с. */
export function honestCapMs(timeMs: number, opts: { medianMs?: number | null; step?: boolean } = {}): number {
  if (!fin(timeMs) || timeMs <= 0) return 0;
  const cap = opts.step ? MIN.stepCapS * 1000
    : fin(opts.medianMs) && opts.medianMs > 0 ? Math.min(MIN.taskCapS * 1000, Math.max(MIN.taskFloorS * 1000, MIN.taskMedianK * opts.medianMs))
    : MIN.taskCapS * 1000;
  return Math.round(Math.min(timeMs, cap));
}
/** Внести честное время ответа (только честного: наспех и свёрнутое — 0, их не вызывают). Повтор того же id ничего не удваивает. right — верный честный (для «≥ 12 честных верных»). */
export function addHonest(m: MinDay, device: string, id: string, ms: number, right: boolean): boolean {
  if (m.hid && id in m.hid) return false;
  (m.hid ??= {})[id] = right ? 1 : 0;
  const add = fin(ms) && ms > 0 ? Math.round(ms) : 0;
  if (add) m.honestMs[device] = Math.min(MAX_HONEST_MS, (m.honestMs[device] ?? 0) + add);
  return true;
}
/** Честное время дня, мс: по устройствам при слиянии берётся максимум, между устройствами — сумма. */
export const honestTotalMs = (m: MinDay) => Object.values(m.honestMs).reduce((s, v) => s + (fin(v) && v > 0 ? v : 0), 0);
/** Честных верных за день (задачи плана и близнецы). */
export const honestRight = (m: MinDay) => Object.values(m.hid ?? {}).reduce<number>((s, v) => s + (v === 1 ? 1 : 0), 0);

// ---------- долги ----------
const baseNeed = (k: DebtKind): 1 | 2 => MIN.twins[k];
/** Долг за слот: неверный и свёрнутый — 2 близнеца, «Білмеймін» и верный наспех — 1; верный и «вне счёта» долга не дают. */
export function debtOf(id: string, slot: MinSlot, day: string): MinDebt | null {
  if (!DEBT_KINDS.includes(slot.k as DebtKind)) return null;
  const k = slot.k as DebtKind;
  return { id, skill: slot.skill, src: slot.src, k, need: baseNeed(k), got: 0, day, at: slot.at };
}
export const needsExplain = (d: Pick<MinDebt, 'k' | 'explained'>) => d.k === 'dunno' && !d.explained;
/** «Білмеймін» на всё: больше MIN.dunnoMany за день — за каждое по 2 близнеца (не зависит от порядка ответов, поэтому одинаково на обоих устройствах). */
export const dunnoMany = (m: MinDay) => Object.values(m.slots).filter(s => s.k === 'dunno').length > MIN.dunnoMany;
const needOf = (d: Pick<MinDebt, 'k' | 'day'>, day: string, many: boolean): 1 | 2 => (d.k === 'dunno' && many && d.day === day ? 2 : baseNeed(d.k));

export function cleanDebt(id: string, x: unknown): MinDebt | null {
  if (!isObj(x) || id.length > MAX_STR || !DEBT_KINDS.includes(x.k as DebtKind) || typeof x.day !== 'string' || !DAY_RE.test(x.day) || !fin(x.at)) return null;
  const k = x.k as DebtKind, need = baseNeed(k);
  const ids = (v: unknown, cap: number) => (Array.isArray(v) ? [...new Set(v.filter((s): s is string => typeof s === 'string' && s.length <= MAX_STR))].sort().slice(0, cap) : []);
  // потолок 2, а не need: у «Білмеймін» при «Білмеймін на всё» нужно 2 близнеца (needOf), чистка не должна их отрезать
  const by = ids(x.by, 2), tr = ids(x.tr, 40);
  const out: MinDebt = { id, skill: str(x.skill), src: str(x.src), k, need, got: Math.max(by.length, fin(x.got) ? Math.max(0, Math.min(2, Math.floor(x.got))) : 0), day: x.day, at: x.at };
  if (x.explained === true) out.explained = true;
  if (x.carried === true) out.carried = true;
  if (by.length) out.by = by;
  if (tr.length) out.tr = tr;
  return out;
}
export function cleanDebts(x: unknown): Record<string, MinDebt> {
  const out: Record<string, MinDebt> = {};
  if (isObj(x)) for (const [id, raw] of Object.entries(x)) { const d = cleanDebt(id, raw); if (d) out[id] = d; }
  return out;
}
const baseKey = (d: MinDebt) => `${d.day}|${d.k}|${d.skill}|${d.src}`;

/** Слияние долгов двух устройств по id: got — максимум, закрывшие ответы и попытки объединяются, carried и explained — ИЛИ. */
export function mergeDebts(a: unknown, b: unknown): Record<string, MinDebt> | undefined {
  if (!isObj(a) && !isObj(b)) return undefined;
  const x = cleanDebts(a), y = cleanDebts(b), out: Record<string, MinDebt> = {};
  for (const id of new Set([...Object.keys(x), ...Object.keys(y)])) {
    const p = x[id], q = y[id];
    if (!p || !q) { out[id] = (p ?? q)!; continue; }
    const base = p.at !== q.at ? (p.at < q.at ? p : q) : cmp(baseKey(p), baseKey(q)) <= 0 ? p : q;
    // потолки те же, что в cleanDebt (по 2 закрывших ответа, 40 попыток, got ≤ 2): тогда слияние остаётся ассоциативным и его итог — уже «чистый»
    const ids = (u: string[] | undefined, v: string[] | undefined, cap: number) => [...new Set([...(u ?? []), ...(v ?? [])])].sort().slice(0, cap);
    const by = ids(p.by, q.by, 2), tr = ids(p.tr, q.tr, 40);
    const d: MinDebt = { ...base, got: Math.min(2, Math.max(p.got, q.got, by.length)) };
    delete d.explained; delete d.carried; delete d.by; delete d.tr;
    if (p.explained || q.explained) d.explained = true;
    if (p.carried || q.carried) d.carried = true;
    if (by.length) d.by = by;
    if (tr.length) d.tr = tr;
    out[id] = d;
  }
  return out;
}

/** Открытые долги дня day в порядке ремонта. Сначала перенесённые с прошлых учебных дней (не старше carryDays, не больше carryMax близнецов), потом сегодняшние;
 *  «Білмеймін»-долги сегодняшнего дня — в конце (с объяснением первым). Закрытые и чужие дни не попадают. */
export function repairQueue(debts: Record<string, MinDebt> | undefined, day: string, many = false): MinDebt[] {
  const all = Object.values(cleanDebts(debts));
  const order = (a: MinDebt, b: MinDebt) => cmp(a.day, b.day) || a.at - b.at || cmp(a.id, b.id);
  const open = (d: MinDebt) => d.got < needOf(d, day, many);
  const carried: MinDebt[] = [];
  let left = MIN.carryMax;
  for (const d of all.filter(d => d.day < day && open(d) && schoolDaysBetween(d.day, day) <= MIN.carryDays).sort(order)) {
    const rest = needOf(d, day, many) - d.got;
    if (rest > left) break;
    left -= rest; carried.push({ ...d, carried: true });
  }
  const now = all.filter(d => d.day === day && open(d)).sort((a, b) => (a.k === 'dunno' ? 1 : 0) - (b.k === 'dunno' ? 1 : 0) || order(a, b));
  return [...carried, ...now];
}
/** Ответ-близнец (или ремонт): honestRight — честный верный (classify === 'right'). Только такой считается (got++); неверный близнец ничего не отнимает.
 *  Повтор того же ответа (answerId) ничего не меняет; перенесённый долг — не больше repairTries попыток в день. true — долг изменился. */
export function onRepair(debts: Record<string, MinDebt>, debtId: string, ansId: string, day: string, honestRightAnswer: boolean, many = false): boolean {
  const d = debts[debtId];
  if (!d || !DEBT_KINDS.includes(d.k)) return false;
  const need = needOf(d, day, many), tk = `${day}|${ansId}`;
  if (d.by?.includes(ansId) || d.tr?.includes(tk) || d.got >= need) return false;
  if (d.day < day && (d.tr ?? []).filter(t => t.startsWith(day + '|')).length >= MIN.repairTries) return false;
  d.tr = [...(d.tr ?? []), tk].sort().slice(-40);
  if (honestRightAnswer) { d.by = [...(d.by ?? []), ansId].sort().slice(0, need); d.got = Math.min(need, Math.max(d.got, d.by.length)); }
  return true;
}
/** Объяснение у «Білмеймін» прочитано. */
export function onExplained(debts: Record<string, MinDebt>, debtId: string): boolean {
  const d = debts[debtId];
  if (!d || d.explained) return false;
  d.explained = true; return true;
}
/** Долги старше days календарных дней уходят из хранилища (в обычный ремонт без минут они попадают раньше, см. repairQueue). */
export function pruneDebts(debts: Record<string, MinDebt>, day: string, days = 14): void {
  const cut = new Date(Date.parse(day) - days * 864e5).toISOString().slice(0, 10);
  for (const [id, d] of Object.entries(debts)) if (d.day < cut) delete debts[id];
}

// ---------- полоса ----------
/** Прямой порт расчёта из прототипа (docs/systems/proto/minutes_proto.mjs): счёт = Σ весов + Σ (1 − вес)·закрыто/нужно; полоса = 60 × счёт / max(план, ответов). */
export function barOf(kinds: MinKind[], debts: { k: DebtKind; need: number; got: number }[], planN: number): number {
  const counted = kinds.filter(k => k !== 'void');
  let s = 0;
  for (const k of counted) s += slotValue(k);
  for (const d of debts) s += (1 - slotValue(d.k)) * Math.min(Math.max(0, d.got), d.need) / d.need;
  const n = Math.max(planN, counted.length);
  if (!fin(s) || n <= 0) return 0;
  return MIN.day * Math.max(0, Math.min(1, s / n));
}
/** Долги, которые считаются в полосе дня day: только его собственные и только те, у которых есть слот (иначе записанный долг без ответа давал бы лишнее). Вид берётся из слота, а не из долга. */
function dayDebts(m: MinDay, debts: Record<string, MinDebt> | undefined, day: string) {
  const many = dunnoMany(m), out: { k: DebtKind; need: number; got: number }[] = [];
  for (const d of Object.values(cleanDebts(debts))) {
    const s = m.slots[d.id];
    if (d.day !== day || !s || !DEBT_KINDS.includes(s.k as DebtKind)) continue;
    const k = s.k as DebtKind, need = needOf({ k, day: d.day }, day, many);
    out.push({ k, need, got: Math.min(d.got, need) });
  }
  return out;
}
/** Полоса дня 0..60 (минуты до начисления). */
export function bar(m: MinDay, debts: Record<string, MinDebt> | undefined, day: string): number {
  const mm = cleanMinDay(m);
  return mm ? barOf(Object.values(mm.slots).map(s => s.k), dayDebts(mm, debts, day), mm.planN) : 0;
}
/** Сколько близнецов ещё нужно вернуть по долгам дня (и сколько с прошлых дней стоит в очереди). */
export function debtLeft(m: MinDay, debts: Record<string, MinDebt> | undefined, day: string): { today: number; carried: number } {
  const mm = cleanMinDay(m), many = !!mm && dunnoMany(mm);
  const q = repairQueue(debts, day, many);
  let today = 0, carried = 0;
  for (const d of q) { const r = Math.max(0, needOf(d, day, many) - d.got); if (d.day === day) today += r; else carried += r; }
  return { today, carried };
}

// ---------- «застрял» ----------
/** Длина хвоста подряд идущих неверных (неверный или свёрнутый). kinds — в порядке времени. */
export function wrongRun(kinds: readonly string[]): number {
  let n = 0;
  for (let i = kinds.length - 1; i >= 0; i--) { if (kinds[i] === 'wrong' || kinds[i] === 'away') n++; else if (kinds[i] === 'void') continue; else break; }
  return n;
}
/** 5 неверных подряд: объяснение и stuckEasy задач қиындық 1 (задачи делает обучение: makeItem(skill, { level: 1 })). */
export const stuck = (kinds: readonly string[]) => wrongRun(kinds) >= MIN.stuckRow;
/** Виды слотов дня в порядке времени. */
export const slotKinds = (m: MinDay): MinKind[] => Object.entries(m.slots).sort((a, b) => a[1].at - b[1].at || cmp(a[0], b[0])).map(([, s]) => s.k);

// ---------- начисление ----------
/** Чем можно закрыть день: 'full' — полоса 60 (ремонт доделан); 'cap' — честного времени ≥ honestCapMin при ≥ honestCapRight честных верных. null — рано. */
export function shouldCredit(m: MinDay, debts: Record<string, MinDebt> | undefined, day: string): 'full' | 'cap' | null {
  const mm = cleanMinDay(m);
  if (!mm || mm.credit) return null;
  if (Object.keys(mm.slots).length && bar(mm, debts, day) >= MIN.day - EPS) return 'full';
  if (honestTotalMs(mm) >= MIN.honestCapMin * 60000 && honestRight(mm) >= MIN.honestCapRight) return 'cap';
  return null;
}
export const weekendShare = (min: number) => Math.round(MIN.wkPerDay * Math.max(0, Math.min(MIN.day, min)) / MIN.day);
export interface CreditResult { via: MinCredit['via']; min: number; wk: number; carry: string[]; drop: string[] }
/** Итог дня. min = 60 при 'full'/'cap' (если они действительно заработаны — иначе обычная полоса), иначе round(полоса); wk — в копилку выходных;
 *  незакрытые долги (≤ carryMax близнецов) идут первыми завтра (carry), остальные — в обычный ремонт без минут (drop). Ничего не пишет. */
export function credit(m: MinDay, debts: Record<string, MinDebt> | undefined, day: string, via: MinCredit['via']): CreditResult {
  const mm = cleanMinDay(m) ?? newMinDay();
  const earned = shouldCredit({ ...mm, credit: undefined }, debts, day);
  const full = (via === 'full' && earned === 'full') || (via === 'cap' && earned !== null);
  const min = full ? MIN.day : Math.max(0, Math.min(MIN.day, Math.round(bar(mm, debts, day))));
  const many = dunnoMany(mm), carry: string[] = [], drop: string[] = [];
  let left = MIN.carryMax;
  const open = Object.values(cleanDebts(debts)).filter(d => d.day === day && d.got < needOf(d, day, many) && mm.slots[d.id])
    .sort((a, b) => (a.k === 'dunno' ? 1 : 0) - (b.k === 'dunno' ? 1 : 0) || a.at - b.at || cmp(a.id, b.id));
  if (!(via === 'full' && full)) {
    for (const d of open) { const rest = needOf(d, day, many) - d.got; if (rest <= left) { left -= rest; carry.push(d.id); } else drop.push(d.id); }
  }
  return { via, min, wk: weekendShare(min), carry, drop };
}
/** Записать начисление ОДИН РАЗ: следующий вызов возвращает прежнее и ничего не меняет. */
export function applyCredit(m: MinDay, res: CreditResult, at: number): MinCredit {
  if (m.credit) return m.credit;
  m.credit = { at, min: res.min, via: res.via, wk: res.wk };
  return m.credit;
}

// ---------- доп. миссия и копилка ----------
/** Полоса доп. миссии: 15 × счёт / max(10, ответов). */
export function extraBar(extra: MinDay): number {
  const kinds = Object.values(cleanMinDay(extra)?.slots ?? {}).map(s => s.k);
  return MIN.extra * barOf(kinds, [], MIN.extraN) / MIN.day;
}
/** Доп. миссия: честного времени ≥ extraCapMin — полные 15, иначе round(полоса). Идёт только после начисления дня (extraAllowed). */
export function extraCredit(extra: MinDay): number {
  const e = cleanMinDay(extra);
  if (!e) return 0;
  return honestTotalMs(e) >= MIN.extraCapMin * 60000 ? MIN.extra : Math.min(MIN.extra, Math.round(extraBar(e)));
}
export const extraAllowed = (m: MinDay) => !!cleanMinDay(m)?.credit;
/** Копилка выходных: сумма wk за будни (и доп. миссия, если «в копилку»), не больше wkMax. */
export function weekendBank(wks: number[], extraToBank = 0): number {
  const s = wks.reduce((a, w) => a + (fin(w) ? Math.max(0, w) : 0), 0) + (fin(extraToBank) ? Math.max(0, extraToBank) : 0);
  return Math.min(MIN.wkMax, Math.round(s));
}

// ---------- слияние двух устройств ----------
/** День минут с двух устройств. Слоты — по id (раньше at); честное время — максимум по устройству (дальше складывается); id учтённого времени — объединение;
 *  начисление — раньше at, min и wk — максимум. Коммутативно, идемпотентно, ассоциативно. */
export function mergeMinDay(a: unknown, b: unknown, depth = 0): MinDay | undefined {
  const x = cleanMinDay(a, depth), y = cleanMinDay(b, depth);
  if (!x || !y) return x ?? y;
  const out: MinDay = { planN: Math.max(x.planN, y.planN), slots: { ...x.slots }, honestMs: { ...x.honestMs } };
  for (const [id, s] of Object.entries(y.slots)) out.slots[id] = out.slots[id] ? earlierSlot(out.slots[id], s) : s;
  for (const [d, v] of Object.entries(y.honestMs)) out.honestMs[d] = Math.max(out.honestMs[d] ?? 0, v);
  if (x.hid || y.hid) { const hid: Record<string, 0 | 1> = { ...x.hid }; for (const [id, v] of Object.entries(y.hid ?? {})) hid[id] = ((hid[id] ?? 0) | v) as 0 | 1; out.hid = hid; }
  if (x.credit || y.credit) {
    const p = x.credit, q = y.credit;
    if (!p || !q) out.credit = (p ?? q)!;
    else { const first = p.at !== q.at ? (p.at < q.at ? p : q) : cmp(p.via, q.via) <= 0 ? p : q; out.credit = { at: first.at, via: first.via, min: Math.max(p.min, q.min), wk: Math.max(p.wk, q.wk) }; }
  }
  if (depth === 0) { const e = mergeMinDay(x.extra, y.extra, 1); if (e) out.extra = e; }
  return out;
}

/** Тень нужна командиру, пока идёт сравнение с прежней формулой: слоты старше SHADOW_KEEP_DAYS дней убираем. Иначе по слоту на ответ (~150 байт)
 *  за 19 месяцев набралось бы больше мегабайта, а главный документ сохранения в облаке не может быть больше 1 МБ. Чистим и при записи ответа,
 *  и при слиянии устройств (иначе устройство, которое не отвечает, воскрешало бы старые слоты и возвращало их в облако). */
export const SHADOW_KEEP_DAYS = 14;
export function dropOldMinsIn(days: Record<string, { mins?: unknown }> | undefined, today: string): void {
  const t = Date.parse(today);
  if (!Number.isFinite(t) || !days || typeof days !== 'object') return;
  const cutoff = new Date(t - SHADOW_KEEP_DAYS * 864e5).toISOString().slice(0, 10);
  for (const [d, r] of Object.entries(days)) if (r && typeof r === 'object' && d < cutoff && (r as any).mins !== undefined) delete (r as any).mins;
}
