// Серия учебных дней: будни с выполненным планом или исключением (болел, праздник). Выходные серию не рвут.
// Две «заморозки» в месяц прощают пропущенный будний день.
import { isWeekday, parse, iso } from './dates';
import type { Save } from './types';

export function streak(save: Save, today: string): { days: number; freezesLeft: number } {
  const ok = (d: string) => { const r = save.days[d]; return !!r && (!!r.exception || (r.planShare ?? 0) >= 0.999); };
  let d = parse(today); let days = 0, freezes = 2;
  // сегодняшний день засчитывается, если план уже выполнен; иначе начинаем со вчера
  if (!ok(today)) d.setDate(d.getDate() - 1);
  for (let guard = 0; guard < 400; guard++) {
    const s = iso(d);
    if (isWeekday(s)) {
      if (ok(s)) days++;
      else if (freezes > 0 && save.attempts.length && s >= save.attempts[0].day) freezes--;
      else break;
    }
    d.setDate(d.getDate() - 1);
    if (save.attempts.length && iso(d) < save.attempts[0].day) break;
  }
  return { days, freezesLeft: freezes };
}
