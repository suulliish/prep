// Задача-близнец (docs/GAME_LOOP.md 20): после ошибки, «білмеймін» и слишком быстрого ответа ребёнок получает НОВУЮ задачу того же шаблона с другими числами,
// а не ту же с зачёркнутыми вариантами: так видно, понял он или запомнил ответ. Чистый модуль без Svelte.
import { makeItem, templatesOf, isTemplateId, type Item } from './items';
import { templatesForBank } from './bank';
import { pickRevengeTpl } from './rush';

/** Шаблон задачи: у задачи банка экзамена — первый подходящий шаблон, иначе null (тогда берём любой шаблон темы). */
export const tplOf = (it: Item): string | null => (isTemplateId(it.source) ? it.source : templatesForBank(it.source)[0] ?? null);

/** Близнец: тот же шаблон, новые числа; дословно прежний текст не выдаётся (makeItem пробует до 6 раз).
 *  `shown` — шаблоны уже показанных вопросов (третий одинаковый подряд не ставим), `avoid` — шаблон, который в очереди следующим. */
export function makeTwin(prev: Item, shown: (string | null)[] = [], avoid: string | null = null): Item | null {
  const t0 = tplOf(prev);
  return makeItem(prev.skill, { tpl: t0 ? pickRevengeTpl(shown, t0, templatesOf(prev.skill), avoid) : undefined, avoidKz: prev.kz });
}
