// Выдача задач: генераторы по навыкам, подсказки, разбор ошибок.
// @ts-ignore
import { templates } from '../../content/templates/index.mjs';
// @ts-ignore
import { rng } from '../../content/templates/lib.mjs';
// @ts-ignore
import { MISCONCEPTIONS, GENERIC } from '../../content/misconceptions.mjs';
// @ts-ignore
import { HINT_KEYS } from '../../content/hint_keys.mjs';
// @ts-ignore
import { skillById } from '../../content/skills.mjs';

export interface Text { kz: string; ru: string }
export interface Item {
  source: string; skill: string;
  kz: string; ru: string;
  choices: { text: string; tag: string }[]; answer: number;
  hints: Text[]; sol: Text; figure?: { kind: string; svg?: string; src?: string };
  real?: boolean; // настоящая задача экзамена из банка
}

const byId: Record<string, any> = Object.fromEntries((templates as any[]).map(t => [t.id, t]));
const R = rng((Date.now() ^ 0x5bd1e995) >>> 0);

// Лестница подсказок для шаблонов без собственных hints: вопрос → ключевая идея → первый шаг (content/hint_keys.mjs).
// Первый шаг берётся из разбора, только если в нём нет готового ответа.
const norm = (x: string) => x.replace(/\s+/g, '').toLowerCase();
export function derivedHints(sol: Text, templateId: string, answer: string): Text[] {
  const key = (HINT_KEYS as Record<string, { q: Text; idea: Text }>)[templateId];
  const first = (t: string) => t.split(/(?<=[.!?])\s+/).filter(Boolean)[0] ?? '';
  const step = { kz: first(sol.kz), ru: first(sol.ru) };
  const leaks = !step.kz || norm(step.kz).includes(norm(answer)) || norm(step.ru).includes(norm(answer));
  return [
    key?.q ?? { kz: 'Сұрақты қайта оқы: не берілген, не табу керек?', ru: 'Перечитай: что дано и что найти?' },
    key?.idea ?? { kz: 'Осы тақырыптың ережесін еске түсір: сабақтағы «Есте сақта» карточкасы.', ru: 'Вспомни правило темы: карточка «Есте сақта» из урока.' },
    leaks ? { kz: 'Кеңесті қолданып, бірінші қадамды өзің жазып көр — сосын тексер.', ru: 'Используя подсказку, запиши первый шаг сам и проверь.' } : step,
  ];
}

/** Шаблоны навыка (id). Пустой список — навык без генератора. */
export const templatesOf = (skillId: string): string[] => skillById[skillId]?.templates ?? [];
/** id шаблона, а не задачи банка. */
export const isTemplateId = (id: string) => !!byId[id];

/** Новая задача навыка. `tpl` — взять именно этот шаблон (для «егіз»/реванша: тот же шаблон, новые числа);
 *  `avoidKz` — не выдавать дословно этот текст (до 6 попыток: у шаблонов с малым перебором числа могут совпасть);
 *  `maxDiff` — только шаблоны не сложнее қиындық; если таких у навыка нет — null (вызывающий берёт запасной вариант). */
export function makeItem(skillId: string, opts: { tpl?: string; avoidKz?: string; maxDiff?: number } = {}): Item | null {
  let ids = templatesOf(skillId);
  if (!ids.length) return null;
  if (opts.maxDiff) { ids = ids.filter(id => (byId[id]?.difficulty ?? 1) <= opts.maxDiff!); if (!ids.length) return null; }
  const tid = opts.tpl && ids.includes(opts.tpl) ? opts.tpl : null;
  let t = byId[tid ?? R.pick(ids)], it = t.gen(R);
  for (let k = 0; k < 6 && opts.avoidKz && it.kz === opts.avoidKz; k++) { if (!tid) t = byId[R.pick(ids)]; it = t.gen(R); }
  return {
    source: t.id, skill: skillId, kz: it.kz, ru: it.ru, choices: it.choices, answer: it.answer,
    sol: it.sol, hints: it.hints ?? derivedHints(it.sol, t.id, it.choices[it.answer].text), figure: it.figure,
  };
}

export function mistakeText(tag: string): Text { return (MISCONCEPTIONS as Record<string, Text>)[tag] ?? GENERIC; }
export const skillTitle = (id: string): Text => skillById[id]?.title ?? { kz: id, ru: id };
