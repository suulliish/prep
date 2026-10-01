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

// ---------- Шаг идёт до N верных (docs/GAME_LOOP.md 20, «строже по качеству, а не по минутам») ----------
/** Больше столько близнецов за ошибки в одном шаге не добавляем: потом шаг заканчивается, чтобы не было бесконечности. */
export const MAX_STEP_TWINS = 6;

/** Очередь вопросов шага: сначала исходные N задач, потом близнецы за ошибки (в конец очереди). Шаг заканчивается на N-м верном ответе
 *  или когда очередь пуста (близнецов больше нет, лимит MAX_STEP_TWINS исчерпан). Чистый класс без Svelte: вопрос за вопросом его ведёт Session.svelte. */
export class StepQueue {
  /** Верных, засчитанных в шаг. */
  right = 0;
  /** Близнецов добавлено за ошибки. */
  added = 0;
  /** Из них ещё не показано. */
  pending = 0;
  origLeft: number;
  constructor(public need: number, public maxTwins = MAX_STEP_TWINS) { this.origLeft = Math.max(0, need); }
  /** Следующий вопрос: 'orig' — исходная задача, 'twin' — близнец из очереди, null — шаг окончен. */
  next(): 'orig' | 'twin' | null {
    if (this.right >= this.need) return null;
    if (this.origLeft > 0) { this.origLeft--; return 'orig'; }
    if (this.pending > 0) { this.pending--; return 'twin'; }
    return null;
  }
  /** Верный ответ, который идёт в счёт. */
  good() { this.right++; }
  /** Ошибка: ставит близнеца в конец очереди. false — лимит исчерпан, близнец не добавлен. */
  miss(): boolean {
    if (this.added >= this.maxTwins) return false;
    this.added++; this.pending++; return true;
  }
  get capped() { return this.added >= this.maxTwins; }
}
