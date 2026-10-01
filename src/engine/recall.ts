// «Еске түсір»: расписание возвратов к правилу темы (docs/GAME_LOOP.md 21). Чистые функции без Svelte.
// Опора: Cepeda 2008 (промежутки растут), Rawson и Dunlosky 2011 (3 верных вспоминания в разные дни), Karpicke 2016 (успех должен удаваться).
// Конкретные дни мои, на детях не проверены.
import { parse, iso } from './dates';
import type { RecallEntry, RecallState, Save } from './types';

/** Сколько тем в день: больше ребёнок не осилит, остальные ждут завтра (самые просроченные идут первыми). */
export const DAILY_MAX = 3;
/** Тема зачтена, когда столько верных возвратов без подсказки в разные дни. */
export const CREDIT_STEPS = 3;
/** Через сколько календарных дней возврат после step верных подряд: день 1, 3, 7, 14, 30, затем редкое поддержание. */
export const GAPS = [1, 2, 4, 7, 16, 30, 45, 60];
/** Вспомнил с подсказкой: шаг не растёт, вернёмся через 2 дня. */
export const HINT_GAP = 2;
/** Подписи пяти клеток возвратов в Дәптер (дни после урока). */
export const WINDOWS = ['1', '3–4', '7–10', '14–21', '30–45'];

export function addDays(day: string, n: number): string {
  const d = parse(day);
  d.setDate(d.getDate() + n);
  return iso(d);
}
export const daysBetween = (a: string, b: string) => Math.round((parse(b).getTime() - parse(a).getTime()) / 864e5);
export const gapFor = (step: number) => GAPS[Math.max(0, Math.min(step, GAPS.length - 1))];
export const isCredited = (s?: RecallState) => !!s && s.step >= CREDIT_STEPS;

/** Поставить тему на возвраты (после урока). Уже стоящую не трогает. Первый возврат через день после learnedDay. */
export function enroll(save: Save, skill: string, day: string, learnedDay: string = day): RecallState {
  save.recall ??= {};
  if (!save.recall[skill]) save.recall[skill] = { learnedDay, step: 0, due: addDays(learnedDay, GAPS[0]), history: [] };
  return save.recall[skill];
}

/** Темы, у которых урок уже был до появления «Еске түсір»: ставим на возвраты, дата — день «үйренді», иначе первая попытка, иначе сегодня. */
export function backfill(save: Save, day: string): boolean {
  let changed = false;
  for (const [id, s] of Object.entries(save.skills)) {
    if (!s.lessonDone || save.recall?.[id]) continue;
    const first = save.attempts.find(a => a.skill === id)?.day;
    const learned = [s.learnedAt, first].filter((x): x is string => !!x && x <= day).sort()[0] ?? day;
    enroll(save, id, day, learned);
    changed = true;
  }
  return changed;
}

const doneOn = (s: RecallState, day: string) => s.history.some(h => h.day === day);

/** Темы на сегодня: срок наступил, сегодня ещё не возвращались; самые просроченные первыми; всего не больше DAILY_MAX за день (уже сделанные сегодня считаются).
 *  has — есть ли у темы правило для вспоминания (у темы без урока возврата нет). */
export function due(save: Save, day: string, has: (skill: string) => boolean = () => true, max: number = DAILY_MAX): string[] {
  const all = Object.entries(save.recall ?? {}).filter(([id]) => has(id));
  const left = Math.max(0, max - all.filter(([, s]) => doneOn(s, day)).length);
  return all
    .filter(([, s]) => s.due <= day && !doneOn(s, day))
    .map(([id, s]) => ({ id, over: daysBetween(s.due, day), step: s.step }))
    .sort((a, b) => b.over - a.over || a.step - b.step || a.id.localeCompare(b.id))
    .slice(0, left)
    .map(x => x.id);
}

export interface Outcome { ok: boolean; hint: RecallEntry['hint']; conf: RecallEntry['conf'] }

/** Записать возврат. Верно без подсказки: step + 1, следующий срок по GAPS. Верно с подсказкой: шаг на месте, срок +2.
 *  Неверно или правило показали (hint 3): откат на один шаг (не в ноль), вернуться завтра. В один день шаг растёт не больше раза. */
export function record(save: Save, skill: string, day: string, r: Outcome): RecallState {
  const st = enroll(save, skill, day);
  const ok = r.ok && r.hint < 3;
  const counted = st.history.some(h => h.day === day && h.ok && h.hint === 0);
  st.history.push({ day, ok, hint: r.hint, conf: r.conf });
  if (ok && r.hint === 0) {
    if (!counted) st.step += 1;
    st.due = addDays(day, gapFor(st.step));
  } else if (ok) {
    st.due = addDays(day, HINT_GAP);
  } else {
    st.step = Math.max(0, st.step - 1);
    st.due = addDays(day, 1);
  }
  return st;
}

/** Пометить, решил ли ребёнок задачу темы после сверки (последняя запись возврата). */
export function noteTask(save: Save, skill: string, ok: boolean) {
  const h = save.recall?.[skill]?.history;
  if (h?.length) h[h.length - 1].task = ok;
}

/** Через сколько дней следующий возврат (для подписи ребёнку). */
export const daysToNext = (s: RecallState, day: string) => Math.max(1, daysBetween(day, s.due));

// ---------- цифры для командира и Альбома ----------

export interface SkillStat { returns: number; clean: number; cleanRate: number | null; sureWrong: number; avgConf: number | null }
export function skillStat(s: RecallState): SkillStat {
  const n = s.history.length;
  const clean = s.history.filter(h => h.ok && h.hint === 0).length;
  const sureWrong = s.history.filter(h => h.conf === 3 && !h.ok).length;
  return { returns: n, clean, cleanRate: n ? clean / n : null, sureWrong, avgConf: n ? s.history.reduce((t, h) => t + h.conf, 0) / n : null };
}

export interface DayStat { day: string; n: number; clean: number; hinted: number; failed: number }
/** Успех вспоминаний по дням: сколько возвратов, из них без подсказки / с подсказкой / не вышло. Новые дни сверху. */
export function dayStats(save: Save): DayStat[] {
  const m = new Map<string, DayStat>();
  for (const s of Object.values(save.recall ?? {})) for (const h of s.history) {
    const d = m.get(h.day) ?? { day: h.day, n: 0, clean: 0, hinted: 0, failed: 0 };
    d.n++;
    if (!h.ok) d.failed++; else if (h.hint === 0) d.clean++; else d.hinted++;
    m.set(h.day, d);
  }
  return [...m.values()].sort((a, b) => (a.day < b.day ? 1 : -1));
}

/** Сколько тем зачтено на 3 возврата и сколько всего на возвратах. */
export function creditedCount(save: Save): { credited: number; total: number } {
  const all = Object.values(save.recall ?? {});
  return { credited: all.filter(isCredited).length, total: all.length };
}
