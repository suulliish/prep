// «Соңғы сынақ» урока (L2, docs/systems/IMPLEMENTATION.md, решение семьи 02.10): финал — НОВАЯ задача того же приёма (не цель урока),
// одна попытка; ответы шагов урока пишутся в историю (mode 'lesson') — для командира и будущей свёртки уровней тем.
import { makeItem } from '../engine/items';
import { RULES_V, isClosed } from '../engine/rules';
import type { Attempt, Save } from '../engine/types';

/** Финал не сложнее қиындық 2: приём только что показали, это проверка переноса, а не олимпиада. */
export const FINAL_MAX_DIFF = 2;

export interface FinalTask { kz: string; choices: string[]; answer: number; why: string; tags: string[] }
export type FinalState = NonNullable<NonNullable<Save['lessonPos']>['final']>;

/** Числа из текста без разделителей разрядов («7 008 012» → «7008012»), по возрастанию: «та же задача» узнаётся по набору чисел. */
const nums = (t: string) => (t.replace(/(\d) (?=\d{3}(?!\d))/g, '$1').match(/\d+(?:[.,]\d+)?/g) ?? []).sort().join('|');

/** Новая задача навыка для финала. `avoid` — тексты, чьи числа финал повторять не должен (цель урока, авторский финал): иначе «новая» задача
 *  с теми же числами и тем же ответом на деле старая. null — у навыка нет подходящего генератора (нет шаблонов не сложнее FINAL_MAX_DIFF, все с
 *  рисунком или совпадают с целью): тогда остаётся авторский финал урока. Рисунка финал не показывает, такие задачи пропускаем; до 8 попыток. */
export function newFinalTask(skill: string, avoid: string | string[] = [], make: typeof makeItem = makeItem): FinalTask | null {
  const list = (Array.isArray(avoid) ? avoid : [avoid]).filter(Boolean), seen = new Set(list.map(nums).filter(Boolean));
  for (let k = 0; k < 8; k++) {
    const it = make(skill, { avoidKz: list[0], maxDiff: FINAL_MAX_DIFF });
    if (!it) return null;
    if (it.figure || it.choices.length < 2 || it.choices.length > 5) continue;
    if (seen.has(nums(it.kz))) continue;
    return { kz: it.kz, choices: it.choices.map(c => c.text), answer: it.answer, why: it.sol.kz, tags: it.choices.map(c => c.tag) };
  }
  return null;
}

/** Состояние финала при входе на шаг. Тот же урок и тот же шаг уже открывали — возвращаем то, что было (задачу и ответ, если он был):
 *  выход и вход не дают второй попытки и второго начисления XP. Иначе — новая задача. */
export function finalFor(lp: Save['lessonPos'], skill: string, step: number, avoid: string[], make: typeof makeItem = makeItem): FinalState {
  if (lp && lp.skill === skill && lp.step === step && lp.final) return lp.final;
  return { task: newFinalTask(skill, avoid, make) };
}

/** Ответ на шаг урока для истории. Источник `lesson:<навык>:<шаг>` — не id шаблона, чтобы не путать личные пороги и «виденные» задачи.
 *  Прямо в save.attempts, без recordAttempt: навык не заводится и статус не меняется (rules.ts forModel для mode 'lesson' даёт null). */
export function lessonAttempt(p: { skill: string; step: number; day: string; correct: boolean; timeMs: number; awayMs: number; tag?: string }): Attempt {
  const closed = isClosed(p.awayMs);
  return {
    at: Date.now(), day: p.day, skill: p.skill, source: `lesson:${p.skill}:${p.step}`, correct: p.correct, hintLevel: 0, honest: !closed,
    timeMs: Math.round(p.timeMs), ...(closed ? { away: Math.round(p.awayMs), closed: true } : {}), ...(p.tag ? { tag: p.tag } : {}), mode: 'lesson', r: RULES_V,
  };
}
