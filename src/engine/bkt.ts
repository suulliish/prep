// Байесовское отслеживание знаний (BKT, Corbett & Anderson 1995): 4 числа на навык.
// Простая модель — сознательно: «умная» адаптивность (ALEKS) в РКИ не дала эффекта.
export interface BktParams { pInit: number; pLearn: number; pSlip: number; pGuess: number }
// pGuess выше буквальной вероятности угадать: учитывает «частичное знание» и случайные удачи.
export const DEFAULT_BKT: BktParams = { pInit: 0.1, pLearn: 0.08, pSlip: 0.12, pGuess: 0.3 };
/** Дополнительно к p ≥ 0,95: минимум честных попыток и последние ответы верные без подсказок. */
export const MIN_ATTEMPTS = 6, LAST_CLEAN = 3;
export const MASTERY_P = 0.95;
/** Строгость (решение Султана 01.10, исследование «небрежность и строгость»): тема «выучена», только если в последних
 *  WINDOW_MAX честных ответах по ней ≥ WINDOW_ACC верных с первой попытки (без подсказок). Меньше WINDOW_MIN ответов — окно не судит. */
export const WINDOW_MAX = 20, WINDOW_MIN = 15, WINDOW_ACC = 0.85;

/** hintLevel: 0 — сам; 1–2 — наводка/правило; 3 — первый шаг; 4 — полный разбор (не учитывается). */
export function bktUpdate(p: number, correct: boolean, opts: { hintLevel?: number; guess?: number; params?: BktParams } = {}): number {
  const P = opts.params ?? DEFAULT_BKT;
  const g = opts.guess ?? P.pGuess;
  const h = opts.hintLevel ?? 0;
  if (h >= 4) return p;
  let post: number;
  if (correct) post = (p * (1 - P.pSlip)) / (p * (1 - P.pSlip) + (1 - p) * g);
  else post = (p * P.pSlip) / (p * P.pSlip + (1 - p) * (1 - g));
  // с подсказкой верный ответ — слабое свидетельство: смешиваем с прежним значением
  if (correct && h > 0) post = p + (post - p) * (h === 3 ? 0.25 : 0.5);
  const learn = P.pLearn * (h === 0 ? 1 : 0.5);
  return Math.min(0.999, post + (1 - post) * learn);
}
