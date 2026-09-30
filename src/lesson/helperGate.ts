// Когда в уроке показывать кнопку ИИ-помощника «Түсінбедім»: чистые функции, чтобы проверять тестами.
import type { LessonContext } from '../engine/helperPayload';

// объясняют смысл: кнопка нужна всегда
const ALWAYS = ['example', 'why', 'rule'];
// проверяют ответ: пока ребёнок не ответил, помощник выдал бы решение (сервер на такой запрос вернёт 400)
const AFTER_ANSWER = ['predict', 'faded', 'blitz', 'final'];

/** Кнопка видна на шагах пояснения всегда, на шагах проверки только после ответа; goal, widget, bug, say и прочие: никогда. */
export function helperVisible(type: string | undefined, answered: boolean | undefined): boolean {
  if (!type) return false;
  if (ALWAYS.includes(type)) return true;
  return AFTER_ANSWER.includes(type) && answered === true;
}

/** Ключ разговора: сменился шаг или кадр, значит прежние вопросы и ответы Бита к нему уже не относятся. */
export function helperKey(c: Pick<LessonContext, 'step' | 'frame'>): string {
  return `${c.step?.type}:${c.step?.kz ?? ''}:${c.frame ?? 0}`;
}
