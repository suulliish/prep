// Правила знания — одна функция на понятие (02.10, docs/systems/IMPLEMENTATION.md §1.1, specs/learning.md, PR L1).
// Экраны и модель знаний спрашивают здесь, а не считают сами: «наспех», «свернул», «честно», «идёт ли ответ в модель».
// Чистый модуль — таблицу сочетаний гоняет tests/rules.test.ts.
import { rushLimitMs } from './rush';
import type { Attempt } from './types';
import { isLessonAnswer } from './lessonlog';

/** Версия правил в Attempt.r. Ответы без r записаны до 02.10 — их судит прежний фильтр (honest). */
export const RULES_V = 2 as const;

/** Свернул приложение посреди задачи дольше этого (калькулятор, поиск) — ответ считается ошибкой (решение Султана 02.10). */
export const AWAY_CLOSE_MS = 5000;
export const isClosed = (awayMs?: number) => (awayMs ?? 0) > AWAY_CLOSE_MS;

/** «Білмеймін» быстрее этого — не прочитал условие. */
export const DUNNO_MIN_MS = 1500;

/** Наспех: быстрее порога для длины условия или личного порога ребёнка (adaptiveMs, только для неверных ответов).
 *  Порог НЕ зависит от подсказки: раньше лампа выключала его, и «подсказка → тык» проходил как честный ответ. */
export const isRushed = (timeMs: number, chars: number, adaptiveMs: number | null = null) => timeMs < rushLimitMs(chars, adaptiveMs);

/** Честный ответ — для минут шага и звёзд: не свернул, без полного разбора, «Білмеймін» не мгновенный, иначе не наспех. */
export function isHonest(f: { timeMs: number; hintLevel: number; rushed: boolean; closed: boolean; dunno?: boolean }): boolean {
  if (f.closed || f.hintLevel >= 4) return false;
  return f.dunno ? f.timeMs >= DUNNO_MIN_MS : !f.rushed;
}

/** Ответ практики/боя/проверки. Ответы шагов урока (mode 'lesson') лежат в той же истории, но ни темп, ни точность, ни «дни на теме» не меняют. */
export const isPracticeAttempt = (a: { mode?: string; source?: string }) => !isLessonAnswer(a);

export type Verdict = 'correct' | 'wrong' | null;
type ModelAttempt = Pick<Attempt, 'correct' | 'honest' | 'hintLevel' | 'mode'> & Partial<Pick<Attempt, 'r' | 'fast' | 'closed' | 'confidence'>> & { selfCheck?: string };

/** Что ответ говорит модели знаний: верно, неверно или ничего (null — не учитывать).
 *  Ошибка остаётся ошибкой, даже если торопился; верный ответ засчитывается, только если он свидетельство знания. */
export function forModel(a: ModelAttempt): Verdict {
  if (a.r !== RULES_V) return a.honest ? (a.correct ? 'correct' : 'wrong') : null;   // старые ответы — прежний фильтр
  if (a.mode === 'lesson' || a.mode === 'recall') return null;   // правило только что показали — не независимое свидетельство
  if (a.hintLevel >= 4) return null;                              // полный разбор
  if (a.closed) return 'wrong';                                   // свернул > 5 с
  if (a.confidence === 'unsure' && !a.correct) return 'wrong';    // «Білмеймін»
  if (a.selfCheck === 'caught') return 'wrong';                   // «сам поймал» — с первой попытки было неверно
  if (a.fast) return a.correct ? null : 'wrong';                  // наспех: верный — не знание, неверный — ошибка
  if (a.correct && a.hintLevel >= 2) return null;                 // верно после правила или первого шага
  return a.correct ? 'correct' : 'wrong';
}

/** Ответ «чистый» для окна 85% и «последних трёх»: верный для модели, без подсказки, не «сам поймал». */
export const isCleanForModel = (a: ModelAttempt) => forModel(a) === 'correct' && a.hintLevel === 0 && a.selfCheck !== 'caught';

/** Чем ответ стал для минут (D2, IMPLEMENTATION §1.1): верный +1; «Білмеймін», верный с подсказкой ≥ 2 и полный разбор — 0 (1 близнец);
 *  верный наспех — 0 (1 близнец); неверный и свёрнутый −¼ (2 близнеца). Неверный остаётся неверным, даже если торопился: «наспех» только не даёт честного времени.
 *  «Білмеймін» быстрее DUNNO_MIN_MS — не прочитал условие: как наспех (0, без честного времени). */
export type MinuteKind = 'right' | 'wrong' | 'dunno' | 'rush' | 'away';
export function classify(f: { correct: boolean; hintLevel: number; rushed: boolean; closed: boolean; dunno?: boolean; timeMs: number }): MinuteKind {
  if (f.closed) return 'away';
  if (f.hintLevel >= 4) return 'dunno';
  if (f.dunno) return f.timeMs >= DUNNO_MIN_MS ? 'dunno' : 'rush';
  if (!f.correct) return 'wrong';
  if (f.hintLevel >= 2) return 'dunno';
  return f.rushed ? 'rush' : 'right';
}
