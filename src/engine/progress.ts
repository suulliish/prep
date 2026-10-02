// Состояние навыков: статусы, отложенная проверка, интервальные повторения, доступность по графу.
import { bktUpdate, MASTERY_P, MIN_ATTEMPTS, LAST_CLEAN, WINDOW_MAX, WINDOW_MIN, WINDOW_ACC } from './bkt';
import { addSchoolDays } from './dates';
import type { Attempt, Save, SkillState, Status } from './types';

export const INTERVALS = [1, 3, 7, 16, 35]; // учебных дней

export interface SkillDef { id: string; prereqs: string[]; weight: number; cat: string; grade: number | string; templates: string[]; lesson?: boolean }

export function blankSkill(): SkillState {
  return { p: 0.1, status: 'locked', lessonDone: false, stage: 0, attempts: 0, correct: 0, misconceptions: {} };
}

const DONE: Status[] = ['learned', 'mastered', 'automatic'];
export const isDone = (s?: SkillState) => !!s && DONE.includes(s.status);

/** Навык доступен, если все предпосылки хотя бы «үйренді». */
/** Темы «үйренді» без срока проверки (диагностика до 02.10 его не ставила): ставим проверку на ближайший учебный день. */
export function fixMissingDue(save: Save, day: string): number {
  let n = 0;
  for (const st of Object.values(save.skills ?? {})) {
    if (st.status === 'learned' && !st.due) { st.due = addSchoolDays(day, 1); st.learnedAt ??= day; n++; }
  }
  return n;
}

export function refreshAvailability(save: Save, defs: SkillDef[]) {
  for (const d of defs) {
    const st = (save.skills[d.id] ??= blankSkill());
    if (st.status === 'locked' && d.prereqs.every(p => isDone(save.skills[p]))) st.status = 'available';
  }
}

/** Скользящее окно по теме: последние WINDOW_MAX честных ответов, верных с первой попытки (без подсказки) — доля.
 *  `skip` — сколько самых свежих честных ответов пропустить (чтобы посмотреть окно «до» текущего ответа). */
export function windowStat(attempts: Attempt[], skill: string, skip = 0): { n: number; clean: number; rate: number } {
  let n = 0, clean = 0, seen = 0;
  for (let i = attempts.length - 1; i >= 0 && n < WINDOW_MAX; i--) {
    const x = attempts[i];
    if (x.skill !== skill || !x.honest) continue;
    if (seen++ < skip) continue;
    // «сам поймал» после самопроверки — верный, но не с первой попытки: в окно 85% как чистый не идёт
    n++; if (x.correct && x.hintLevel === 0 && (x as { selfCheck?: string }).selfCheck !== 'caught') clean++;
  }
  return { n, clean, rate: n ? clean / n : 0 };
}
/** Окно набрано (≥ WINDOW_MIN ответов) и точность не ниже WINDOW_ACC. */
export const windowPasses = (w: { n: number; rate: number }) => w.n >= WINDOW_MIN && w.rate >= WINDOW_ACC;
/** Окно набрано, но точность ниже порога: тема «выучена слабо». Мало ответов (старые сохранения, диагностика) — не судим. */
export const windowWeak = (w: { n: number; rate: number }) => w.n >= WINDOW_MIN && w.rate < WINDOW_ACC;

/** Записать попытку и обновить модель. Возвращает события для игры (кристалл, «үйренді» и т.п.). */
export function recordAttempt(save: Save, a: Attempt, opts: { guess?: number } = {}): string[] {
  const events: string[] = [];
  save.attempts.push(a);
  const st = (save.skills[a.skill] ??= blankSkill());
  if (a.tag && !a.correct) st.misconceptions[a.tag] = (st.misconceptions[a.tag] ?? 0) + 1;
  if (!a.honest) return events;
  st.attempts++; if (a.correct) st.correct++;

  const doneNow = st.status === 'learned' || st.status === 'mastered' || st.status === 'automatic';
  // старая тема (выучена до порога 85%, флага strict нет): если окно ДО этого ответа < 85%, следующая же ошибка возвращает её в «изучается».
  // Темам, выученным по новому порогу, это не нужно: их судит обычная отложенная проверка (иначе ученик с честными 90% скакал бы вверх-вниз)
  const weakBefore = doneNow && !st.strict && windowWeak(windowStat(save.attempts, a.skill, 1));
  const isCheck = a.hintLevel === 0 && st.due && a.day >= st.due && (st.status === 'learned' || st.status === 'mastered' || st.status === 'automatic');
  if (isCheck) {
    if (a.correct) {
      st.stage = Math.min(st.stage + 1, INTERVALS.length - 1);
      st.due = addSchoolDays(a.day, INTERVALS[st.stage]);
      // кристалл не даём теме, выученной «на троечку»: пока окно < 85%, проверка проходит, а статус остаётся «выучена»
      if (st.status === 'learned' && weakBefore) events.push('review_ok');
      else if (st.status === 'learned') { st.status = 'mastered'; events.push('crystal'); }
      else if (st.status === 'mastered' && st.stage >= 3) { st.status = 'automatic'; events.push('automatic'); }
      else events.push('review_ok');
    } else {
      st.status = 'learning'; st.p = 0.6; st.stage = 0; st.due = undefined;
      events.push('review_failed');
    }
    return events;
  }
  if (weakBefore && !a.correct) {
    st.status = 'learning'; st.p = 0.6; st.stage = 0; st.due = undefined; st.strict = false;
    events.push('review_failed');
    return events;
  }

  st.p = bktUpdate(st.p, a.correct, { hintLevel: a.hintLevel, guess: opts.guess });
  if (st.status === 'available' || st.status === 'locked') st.status = 'learning';
  const recent = save.attempts.filter(x => x.skill === a.skill && x.honest).slice(-LAST_CLEAN);
  const clean = recent.length === LAST_CLEAN && recent.every(x => x.correct && x.hintLevel === 0);
  if (st.status === 'learning' && st.p >= MASTERY_P && st.attempts >= MIN_ATTEMPTS && clean && windowPasses(windowStat(save.attempts, a.skill))) {
    st.status = 'learned'; st.strict = true; st.learnedAt = a.day; st.stage = 0; st.due = addSchoolDays(a.day, INTERVALS[0]);
    events.push('learned');
  }
  return events;
}

/** Навыки, которым пора на отложенную проверку или повторение. */
export function dueSkills(save: Save, day: string): string[] {
  return Object.entries(save.skills)
    .filter(([, s]) => isDone(s) && s.due && s.due <= day)
    .sort((a, b) => (a[1].due! < b[1].due! ? -1 : 1))
    .map(([id]) => id);
}
