// Банк настоящих задач (content/bank.json: «Дарын» 2023–2025, Bolashak) на сайте.
// Пулы: practice (Дарын 2023) — бои и боссы; mock (Дарын 2024, Bolashak) — пробники позже;
// holdout (Дарын 2025) — не трогаем до контрольного пробника.
// Задача готова, если: usable, есть казахское условие, рисунок есть (PNG из PDF / SVG) или не нужен.
// @ts-ignore
import BANK from '../../content/bank.json';
// @ts-ignore
import { FIGURES_SVG, TEXT_ONLY } from '../../content/figures_svg.mjs';
// @ts-ignore
import PNG from '../../content/figures_png.json';
// @ts-ignore
import { SOLUTIONS_KZ, STEMS_KZ, CHOICES_FIX } from '../../content/bank_kz.mjs';
// @ts-ignore
import { templates } from '../../content/templates/index.mjs';
// @ts-ignore
import { skills } from '../../content/skills.mjs';
import type { Item } from './items';

export interface BankItem {
  id: string; source: string; pool: 'practice' | 'mock' | 'holdout'; n: number;
  stem: { kz: string | null; ru: string | null }; choices: (string | null)[]; answer: number;
  figure: { kind: string; note?: string } | null; type: string; solution: { ru: string | null; kz: string | null }; usable: boolean;
}
const ITEMS: BankItem[] = ((BANK as any).items ?? BANK) as BankItem[];
const pngs = new Set<string>(PNG as string[]);
const svgs = FIGURES_SVG as Record<string, string>;
const textOnly = TEXT_ONLY as Set<string>;

/** Рисунок задачи: PNG (вырезан из PDF), SVG (нарисован) или null (не нужен). undefined — рисунка пока нет. */
export function bankFigure(it: BankItem): Item['figure'] | null | undefined {
  if (!it.figure) return null;
  if (pngs.has(it.id)) return { kind: 'png', src: `figures/${it.id}.png` };
  if (svgs[it.id]) return { kind: 'svg', svg: svgs[it.id] };
  if (textOnly.has(it.id)) return null;
  return undefined;
}
const cleanKz = (s: string) => s.split('\n').filter(l => !/^\s*\d+\.\s*\S{0,3}\s*$/.test(l)).join('\n').trim(); // обрывки соседних строк PDF

export const isReady = (it: BankItem) => it.usable && !!it.stem.kz && it.answer >= 0 && it.choices.length >= 2 && it.choices.every(c => c) && bankFigure(it) !== undefined;
export const bankItems = ITEMS;
export const readyItems = ITEMS.filter(isReady);

// Привязка к навыкам: генераторы сделаны по задачам банка (поле from) → навыки графа (skills.mjs → t)
const t2s: Record<string, string[]> = {};
for (const s of skills as any[]) for (const t of s.templates ?? []) (t2s[t] ??= []).push(s.id);
export const BANK_SKILLS: Record<string, string[]> = {};
for (const t of templates as any[]) for (const f of t.from ?? []) BANK_SKILLS[f] = [...new Set([...(BANK_SKILLS[f] ?? []), ...(t2s[t.id] ?? [])])];

/** Задачи пула, все темы которых уже пройдены; сначала те, что ещё не встречались. */
export function bankFor(done: (skill: string) => boolean, seen: Set<string>, pool: BankItem['pool'] = 'practice') {
  const ok = readyItems.filter(it => it.pool === pool && BANK_SKILLS[it.id]?.length && BANK_SKILLS[it.id].every(done));
  return [...ok.filter(it => !seen.has(it.id)), ...ok.filter(it => seen.has(it.id))];
}

/** Задача банка в формате экрана задачи. Навык — первый привязанный (для отложенной проверки/BKT). */
export function bankToItem(it: BankItem): Item {
  const kzSol = it.solution?.kz ?? (SOLUTIONS_KZ as Record<string, string>)[it.id] ?? it.solution?.ru ?? '';
  return {
    source: it.id, skill: BANK_SKILLS[it.id]?.[0] ?? 'bank', real: true,
    kz: (STEMS_KZ as Record<string, string>)[it.id] ?? cleanKz(it.stem.kz!), ru: it.stem.ru ?? '',
    choices: ((CHOICES_FIX as Record<string, string[]>)[it.id] ?? it.choices).map(t => ({ text: String(t), tag: 'bank' })), answer: it.answer,
    hints: [
      { kz: 'Бұл — нағыз емтихан есебі! Алдымен оқы: не берілген, не табу керек?', ru: 'Это настоящая задача экзамена. Что дано, что найти?' },
      { kz: 'Осындай тақырыпты қай сабақта өттік? Сол сабақтың «Есте сақта» карточкасын еске түсір.', ru: 'Вспомни правило из урока по этой теме.' },
      { kz: 'Бірінші қадамды жазып көр, сосын нұсқалармен салыстыр.', ru: 'Запиши первый шаг и сравни с вариантами.' },
    ],
    sol: { kz: kzSol, ru: it.solution?.ru ?? '' },
    figure: bankFigure(it) ?? undefined,
  };
}
