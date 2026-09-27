// Состояние навыков: статусы, отложенная проверка, интервальные повторения, доступность по графу.
import { bktUpdate, MASTERY_P, MIN_ATTEMPTS, LAST_CLEAN } from './bkt';
import { addSchoolDays } from './dates';
import type { Attempt, Save, SkillState, Status } from './types';

export const INTERVALS = [1, 3, 7, 16, 35]; // учебных дней

export interface SkillDef { id: string; prereqs: string[]; weight: number; cat: string; grade: number | string; templates: string[] }

export function blankSkill(): SkillState {
  return { p: 0.1, status: 'locked', lessonDone: false, stage: 0, attempts: 0, correct: 0, misconceptions: {} };
}

const DONE: Status[] = ['learned', 'mastered', 'automatic'];
export const isDone = (s?: SkillState) => !!s && DONE.includes(s.status);

/** Навык доступен, если все предпосылки хотя бы «үйренді». */
export function refreshAvailability(save: Save, defs: SkillDef[]) {
  for (const d of defs) {
    const st = (save.skills[d.id] ??= blankSkill());
    if (st.status === 'locked' && d.prereqs.every(p => isDone(save.skills[p]))) st.status = 'available';
  }
}

/** Записать попытку и обновить модель. Возвращает события для игры (кристалл, «үйренді» и т.п.). */
export function recordAttempt(save: Save, a: Attempt, opts: { guess?: number } = {}): string[] {
  const events: string[] = [];
  save.attempts.push(a);
  const st = (save.skills[a.skill] ??= blankSkill());
  if (a.tag && !a.correct) st.misconceptions[a.tag] = (st.misconceptions[a.tag] ?? 0) + 1;
  if (!a.honest) return events;
  st.attempts++; if (a.correct) st.correct++;

  const isCheck = a.hintLevel === 0 && st.due && a.day >= st.due && (st.status === 'learned' || st.status === 'mastered' || st.status === 'automatic');
  if (isCheck) {
    if (a.correct) {
      st.stage = Math.min(st.stage + 1, INTERVALS.length - 1);
      st.due = addSchoolDays(a.day, INTERVALS[st.stage]);
      if (st.status === 'learned') { st.status = 'mastered'; events.push('crystal'); }
      else if (st.status === 'mastered' && st.stage >= 3) { st.status = 'automatic'; events.push('automatic'); }
      else events.push('review_ok');
    } else {
      st.status = 'learning'; st.p = 0.6; st.stage = 0; st.due = undefined;
      events.push('review_failed');
    }
    return events;
  }

  st.p = bktUpdate(st.p, a.correct, { hintLevel: a.hintLevel, guess: opts.guess });
  if (st.status === 'available' || st.status === 'locked') st.status = 'learning';
  const recent = save.attempts.filter(x => x.skill === a.skill && x.honest).slice(-LAST_CLEAN);
  const clean = recent.length === LAST_CLEAN && recent.every(x => x.correct && x.hintLevel === 0);
  if (st.status === 'learning' && st.p >= MASTERY_P && st.attempts >= MIN_ATTEMPTS && clean) {
    st.status = 'learned'; st.learnedAt = a.day; st.stage = 0; st.due = addSchoolDays(a.day, INTERVALS[0]);
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
