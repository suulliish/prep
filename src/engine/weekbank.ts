// «Копилка выходных» для экрана корабля: сколько минут игры на выходные накопилось за текущую неделю (с понедельника).
// Новых вычислений минут нет: берутся готовые DayRecord.minutesWeekend, которые уже посчитал planner.settleDay.
// Потолок 90 — решение IMPLEMENTATION §1.2 («копилка выходных ≤ 90»). Пока минуты считаются по старой формуле (до 48 в день),
// потолок на экране наступит раньше, чем у командира («Сегодня»: за неделю): настоящее ограничение сделает новый движок минут (D2/D7).
import { parse, iso } from './dates';
import type { DayRecord } from './types';

export const WEEKEND_BANK_MAX = 90;

/** Понедельник недели, в которую входит день (YYYY-MM-DD). */
export function mondayOf(day: string): string {
  const d = parse(day);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return iso(d);
}

/** Копилка выходных на день `day`: сумма minutesWeekend с понедельника по `day`, не больше 90. */
export function weekendBank(days: Record<string, DayRecord>, day: string): number {
  const from = mondayOf(day);
  const sum = Object.values(days).filter(r => r.date >= from && r.date <= day).reduce((s, r) => s + (r.minutesWeekend || 0), 0);
  return Math.max(0, Math.min(WEEKEND_BANK_MAX, Math.round(sum)));
}
