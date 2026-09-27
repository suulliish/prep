// Выдача задач: генераторы по навыкам, подсказки, разбор ошибок.
// @ts-ignore
import { templates } from '../../content/templates/index.mjs';
// @ts-ignore
import { rng } from '../../content/templates/lib.mjs';
// @ts-ignore
import { MISCONCEPTIONS, GENERIC } from '../../content/misconceptions.mjs';
// @ts-ignore
import { skillById } from '../../content/skills.mjs';

export interface Text { kz: string; ru: string }
export interface Item {
  source: string; skill: string;
  kz: string; ru: string;
  choices: { text: string; tag: string }[]; answer: number;
  hints: Text[]; sol: Text; figure?: { kind: string; svg?: string };
}

const byId: Record<string, any> = Object.fromEntries((templates as any[]).map(t => [t.id, t]));
const R = rng((Date.now() ^ 0x5bd1e995) >>> 0);

function derivedHints(sol: Text): Text[] {
  const split = (s: string) => s.split(/(?<=[.!?])\s+/).filter(Boolean);
  const k = split(sol.kz), r = split(sol.ru);
  return [
    { kz: 'Сұрақты қайта оқы: не белгілі, не табу керек?', ru: 'Перечитай: что дано и что найти?' },
    { kz: k[0] ?? sol.kz, ru: r[0] ?? sol.ru },
    { kz: k.slice(0, 2).join(' '), ru: r.slice(0, 2).join(' ') },
  ];
}

export function makeItem(skillId: string): Item | null {
  const def = skillById[skillId];
  const ids: string[] = def?.templates ?? [];
  if (!ids.length) return null;
  const t = byId[R.pick(ids)];
  const it = t.gen(R);
  return {
    source: t.id, skill: skillId, kz: it.kz, ru: it.ru, choices: it.choices, answer: it.answer,
    sol: it.sol, hints: it.hints ?? derivedHints(it.sol), figure: it.figure,
  };
}

export function mistakeText(tag: string): Text { return MISCONCEPTIONS[tag] ?? GENERIC; }
export const skillTitle = (id: string): Text => skillById[id]?.title ?? { kz: id, ru: id };
