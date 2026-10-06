// Исключения командира: болезнь и праздники диапазоном дат (K4, docs/systems/specs/commander.md).
// Решение семьи 02.10: учёба все будни круглый год; отдых - выходные; болезнь и праздники - исключения командира.
// Хранятся массивом save.exceptions[] {id, from, to, kind}; между устройствами сливаются по id, удалённое остаётся
// записью-«могилой» (deleted) и не воскресает (src/engine/sync.ts: mergeExceptions).
// Старая отметка одного дня (DayRecord.exception: sick | holiday | vacation) продолжает работать: vacation считается праздником.
// Чистые функции без обращения к часам и хранилищу: дата и время приходят параметрами.
import { iso, isWeekday, parse } from './dates';
import type { Save } from './types';

export type ExceptionKind = 'sick' | 'holiday';
export interface ScheduleException {
  id: string;
  from: string;          // 'YYYY-MM-DD', включительно
  to: string;            // включительно
  kind: ExceptionKind;
  note?: string;
  at: number;            // когда создано или удалено (ms)
  deleted?: boolean;     // могила: запись остаётся, чтобы удаление дошло до другого устройства
}

export const EXC_BACK_DAYS = 14;      // начать можно не раньше, чем 14 дней назад
export const EXC_AHEAD_DAYS = 180;    // и закончить не позже, чем через 180 дней
/** Самый длинный диапазон в календарных днях (с обоими концами). */
export const EXC_MAX_DAYS: Record<ExceptionKind, number> = { sick: 21, holiday: 7 };
export const EXC_KIND_RU: Record<ExceptionKind, string> = { sick: 'Болезнь', holiday: 'Праздник' };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
/** Настоящая дата 'YYYY-MM-DD' (31 февраля и мусор не проходят). */
export const isIsoDate = (s: unknown): s is string => typeof s === 'string' && DATE_RE.test(s) && iso(parse(s)) === s;
export const shiftDay = (s: string, n: number) => { const d = parse(s); d.setDate(d.getDate() + n); return iso(d); };
/** Сколько календарных дней в диапазоне, оба конца включительно. */
export const spanDays = (from: string, to: string) => Math.round((parse(to).getTime() - parse(from).getTime()) / 864e5) + 1;

/** Привести запись из сохранения к безопасному виду или вернуть null. Испорченное не роняет экран:
 *  не объект, нет id, неизвестный вид, неправильные даты - запись игнорируется; диапазон вверх ногами - концы меняются местами;
 *  слишком длинный диапазон обрезается до предела вида (испорченная запись не должна «простить» полгода). */
export function normalizeException(e: unknown): ScheduleException | null {
  if (!e || typeof e !== 'object') return null;
  const x = e as Partial<ScheduleException>;
  if (typeof x.id !== 'string' || !x.id) return null;
  if (x.kind !== 'sick' && x.kind !== 'holiday') return null;
  if (!isIsoDate(x.from) || !isIsoDate(x.to)) return null;
  let from = x.from, to = x.to;
  if (from > to) [from, to] = [to, from];
  const max = EXC_MAX_DAYS[x.kind];
  if (spanDays(from, to) > max) to = shiftDay(from, max - 1);
  const out: ScheduleException = { id: x.id, from, to, kind: x.kind, at: typeof x.at === 'number' && isFinite(x.at) ? x.at : 0 };
  if (typeof x.note === 'string') out.note = x.note;
  if (x.deleted === true) out.deleted = true;
  return out;
}

/** Все безопасные записи, включая могилы (нужны слиянию). */
export function allExceptions(save: Pick<Save, 'exceptions'>): ScheduleException[] {
  const raw = save.exceptions;
  if (!Array.isArray(raw)) return [];
  return raw.map(normalizeException).filter((e): e is ScheduleException => !!e);
}
/** Действующие исключения (без удалённых), по дате начала. */
export function activeExceptions(save: Pick<Save, 'exceptions'>): ScheduleException[] {
  return allExceptions(save).filter(e => !e.deleted).sort((a, b) => (a.from < b.from ? -1 : a.from > b.from ? 1 : a.id < b.id ? -1 : 1));
}

/** Старые отметки одного дня (DayRecord.exception): день и вид; vacation считается праздником. */
export function legacyExceptions(save: Pick<Save, 'days'>): { day: string; kind: ExceptionKind }[] {
  const days = save.days;
  if (!days || typeof days !== 'object') return [];
  const out: { day: string; kind: ExceptionKind }[] = [];
  for (const [day, r] of Object.entries(days)) {
    const k = (r as { exception?: unknown } | null)?.exception;
    if (!isIsoDate(day)) continue;
    if (k === 'sick') out.push({ day, kind: 'sick' });
    else if (k === 'holiday' || k === 'vacation') out.push({ day, kind: 'holiday' });
  }
  return out.sort((a, b) => (a.day < b.day ? -1 : 1));
}

/** Проверка «день в исключении» одним проходом по сохранению (нормализация один раз; для циклов по многим дням). */
export function exceptionChecker(save: Pick<Save, 'exceptions' | 'days'>): (day: string) => ExceptionKind | undefined {
  const list = activeExceptions(save);
  const legacy = new Map(legacyExceptions(save).map(l => [l.day, l.kind] as const));
  return (day: string) => {
    const l = legacy.get(day);
    if (l) return l;
    for (const e of list) if (day >= e.from && day <= e.to) return e.kind;
    return undefined;
  };
}
/** Какое исключение действует в этот день (новый список или старая отметка дня); undefined - обычный день. */
export const exceptionOn = (save: Pick<Save, 'exceptions' | 'days'>, day: string) => exceptionChecker(save)(day);

/** Учебный день: будний и не в исключении. */
export const isSchoolDay = (save: Pick<Save, 'exceptions' | 'days'>, day: string) => isWeekday(day) && !exceptionOn(save, day);

export type AddResult = { ok: true; id: string; created: boolean } | { ok: false; reason: string };

/** Проверить диапазон нового исключения. today - сегодняшняя дата 'YYYY-MM-DD'. Возвращает текст ошибки для командира или null. */
export function validateRange(from: string, to: string, kind: ExceptionKind, today: string): string | null {
  if (kind !== 'sick' && kind !== 'holiday') return 'Выберите вид: болезнь или праздник.';
  if (!isIsoDate(from) || !isIsoDate(to)) return 'Укажите обе даты.';
  if (from > to) return 'Конец раньше начала: поменяйте даты.';
  if (from < shiftDay(today, -EXC_BACK_DAYS)) return `Начало не раньше, чем ${EXC_BACK_DAYS} дней назад.`;
  if (to > shiftDay(today, EXC_AHEAD_DAYS)) return `Конец не позже, чем через ${EXC_AHEAD_DAYS} дней.`;
  const max = EXC_MAX_DAYS[kind];
  if (spanDays(from, to) > max) return `${EXC_KIND_RU[kind]}: не дольше ${max} дн. подряд.`;
  return null;
}

const newId = (now: number) => `x${now.toString(36)}${Math.random().toString(36).slice(2, 7)}`;

/** Добавить исключение. Повторный вызов с тем же диапазоном и видом (двойной клик, повторная отправка) ничего не добавляет
 *  и возвращает уже существующую запись; диапазон целиком внутри действующего того же вида - тоже. */
export function addException(save: Save, input: { from: string; to: string; kind: ExceptionKind; note?: string }, today: string, now: number, id: string = newId(now)): AddResult {
  const bad = validateRange(input.from, input.to, input.kind, today);
  if (bad) return { ok: false, reason: bad };
  const have = activeExceptions(save).find(e => e.kind === input.kind && e.from <= input.from && e.to >= input.to);
  if (have) return { ok: true, id: have.id, created: false };
  const e: ScheduleException = { id, from: input.from, to: input.to, kind: input.kind, at: now };
  if (input.note?.trim()) e.note = input.note.trim().slice(0, 80);
  const list = Array.isArray(save.exceptions) ? save.exceptions : [];
  if (list.some(x => x && typeof x === 'object' && (x as ScheduleException).id === id)) return { ok: false, reason: 'Такая запись уже есть.' };
  save.exceptions = [...list, e];
  return { ok: true, id, created: true };
}

/** Удалить исключение: запись остаётся могилой (deleted), чтобы другое устройство не вернуло её. Повторное удаление ничего не меняет. */
export function deleteException(save: Save, id: string, now: number): boolean {
  if (!Array.isArray(save.exceptions)) return false;
  const i = save.exceptions.findIndex(x => x && typeof x === 'object' && (x as ScheduleException).id === id);
  if (i < 0 || (save.exceptions[i] as ScheduleException).deleted) return false;
  save.exceptions = save.exceptions.map((x, k) => (k === i ? { ...(x as ScheduleException), deleted: true, at: now } : x));
  return true;
}

/** Слияние двух списков по id (устройство + облако). Могила побеждает: удалённое не воскресает. Из двух живых копий - с большим at.
 *  Результат: порядок по началу и id, одинаковый при любом порядке аргументов (коммутативно) и при повторном слиянии (идемпотентно). */
export function mergeExceptions(l: unknown, r: unknown): ScheduleException[] {
  const m = new Map<string, ScheduleException>();
  for (const e of [...allExceptions({ exceptions: l as any }), ...allExceptions({ exceptions: r as any })]) {
    const o = m.get(e.id);
    if (!o) { m.set(e.id, e); continue; }
    if (o.deleted !== e.deleted) m.set(e.id, o.deleted ? o : e);                 // могила побеждает
    else if (e.at > o.at || (e.at === o.at && JSON.stringify(e) > JSON.stringify(o))) m.set(e.id, e);   // при равных - детерминированно
  }
  return [...m.values()].sort((a, b) => (a.from < b.from ? -1 : a.from > b.from ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}
