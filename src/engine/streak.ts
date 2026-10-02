// Серия учебных дней: будни с выполненным планом или исключением (болел, праздник). Выходные серию не рвут.
// Две «заморозки» В КАЖДОМ МЕСЯЦЕ прощают пропущенный будний день (K1, 02.10: раньше было 2 на всю историю, а серия
// обрывалась на ~286-м учебном дне из-за предела цикла в 400 календарных дней — до экзамена учебных дней ≈ 410).
import { isWeekday, parse, iso } from './dates';
import type { Save } from './types';

export const STREAK_FREEZES_PER_MONTH = 2;

export function streak(save: Save, today: string): { days: number; freezesLeft: number } {
  // день в серии — план пройден целиком (все шаги), даже если доля честных ответов меньше 1: один ответ наугад не рвёт серию
  const ok = (d: string) => { const r = save.days[d]; return !!r && (!!r.exception || (r.planShare ?? 0) >= 0.999 || (!!r.plan?.blocks?.length && r.plan.blocks.every(b => r.blocksDone[b.id]))); };
  // начало истории — самый ранний день, когда было что-то сделано (записи дней и ответы; ответы на устройстве могут быть обрезаны)
  const first = [...Object.keys(save.days), save.attempts[0]?.day].filter((x): x is string => !!x).sort()[0];
  const used: Record<string, number> = {};
  const month = (s: string) => s.slice(0, 7);
  let d = parse(today); let days = 0;
  // сегодняшний день засчитывается, если план уже выполнен; иначе начинаем со вчера
  if (!ok(today)) d.setDate(d.getDate() - 1);
  while (first && iso(d) >= first) {
    const s = iso(d);
    if (isWeekday(s)) {
      if (ok(s)) days++;
      else if ((used[month(s)] ?? 0) < STREAK_FREEZES_PER_MONTH) used[month(s)] = (used[month(s)] ?? 0) + 1;
      else break;
    }
    d.setDate(d.getDate() - 1);
  }
  return { days, freezesLeft: Math.max(0, STREAK_FREEZES_PER_MONTH - (used[month(today)] ?? 0)) };
}
