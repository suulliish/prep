// Хранение поведения по дням (save.usage): запись дня и чистка старого. Чистые функции — их гоняют тесты; пишет src/lib/track.svelte.ts.
import type { UsageDay } from './types';

export const KEEP_DAYS = 400;          // сводка по дням хранится столько
export const DETAIL_DAYS = 120;        // шаги, разборы и события — столько (потом остаётся только сводка дня)

export function blankDay(day: string): UsageDay {
  return { day, activeMs: 0, awayMs: 0, sessions: 0, firstAt: 0, lastAt: 0, screens: {}, nope: {}, exits: {}, steps: [], reviews: [], events: [] };
}

/** Запись дня (создаёт), старые дни чистит: дальше KEEP_DAYS — удаляются, дальше DETAIL_DAYS — без подробностей. */
export function usageDay(list: UsageDay[], day: string): UsageDay {
  let d = list.find(x => x.day === day);
  if (d) return d;
  d = blankDay(day);
  list.push(d);
  list.sort((a, b) => (a.day < b.day ? -1 : 1));
  const cut = (n: number) => new Date(Date.parse(day) - n * 864e5).toISOString().slice(0, 10);
  const keep = cut(KEEP_DAYS), detail = cut(DETAIL_DAYS);
  while (list.length && list[0].day < keep) list.shift();
  for (const x of list) if (x.day < detail && (x.steps.length || x.reviews.length || x.events.length)) { x.steps = []; x.reviews = []; x.events = []; }
  return list.find(x => x.day === day)!;
}

/** Поведение с двух сторон: по каждому дню берём запись, где больше активного времени (другое устройство или минуты до входа). */
export function mergeUsage(a: UsageDay[], b: UsageDay[]): UsageDay[] {
  const m = new Map<string, UsageDay>();
  for (const d of [...a, ...b]) { const o = m.get(d.day); if (!o || d.activeMs > o.activeMs) m.set(d.day, d); }
  return [...m.values()].sort((x, y) => (x.day < y.day ? -1 : 1));
}
