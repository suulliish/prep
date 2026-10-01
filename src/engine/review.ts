// Разбор после ошибки, «Білмеймін» и слишком быстрого ответа (docs/GAME_LOOP.md 20): ребёнок не читает, а ДЕЙСТВУЕТ.
// Чистый модуль без Svelte. Какое задание дать, выбирается по тому, что есть у задачи (у шаблонов нет метки «шаг ошибки», поэтому лесенка):
//   ошибка:      find (решение с твоим ответом, нажми первую неверную строку) → why (выбери верное объяснение из 3 карточек по метке ошибки)
//                → gap (закрытое число в решении) → read (решение + зарядка кнопки)
//   «білмеймін»: gap → read
//   быстрый:     gap → check («Сұрақ не туралы?», src/engine/rush.ts) → read
// Экран: src/ui/ReviewPanel.svelte.
// @ts-ignore
import { MISCONCEPTIONS } from '../../content/misconceptions.mjs';
import { mistakeText, type Item } from './items';
import { buildGlitch, type GlitchTurn } from './glitchturn';
import { solGap, type SolGap } from './solgap';
import { miniCheck, type MiniCheck } from './rush';

export type ReviewMode = 'error' | 'dunno' | 'fast';
export interface WhyCard { text: string; ok: boolean }
export type Review =
  | { kind: 'find'; turn: GlitchTurn; your: string; why: string }
  | { kind: 'why'; cards: WhyCard[]; your: string }
  | { kind: 'gap'; gap: SolGap; sol: string }
  | { kind: 'check'; mc: MiniCheck }
  | { kind: 'read'; sol: string }
  | { kind: 'glitch'; turn: GlitchTurn; picked: number };   // ход «Глитчтің қатесі» уже сыгран: показываем, где была ошибка (собирает экран боя)

const kzPart = (s: string) => s.split(' / ')[0].trim();
function shuffle<T>(a: T[], rand: () => number): T[] {
  const r = a.slice();
  for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; }
  return r;
}

/** Три карточки-объяснения: верное (по метке выбранного варианта) и два чужих (метки других неверных вариантов этой же задачи, потом любые другие).
 *  null — метки нет в словаре ошибок или нечего противопоставить: выбирать не из чего. */
export function whyCards(item: Item, picked: number, rand: () => number = Math.random): WhyCard[] | null {
  const tag = item.choices[picked]?.tag;
  if (!tag || !(tag in MISCONCEPTIONS) || picked === item.answer) return null;
  const right = mistakeText(tag).kz;
  const seen = new Set([right]);
  const near = shuffle([...new Set(item.choices.filter((c, i) => i !== item.answer && i !== picked && c.tag in MISCONCEPTIONS).map(c => c.tag))], rand)
    .map(t => mistakeText(t).kz).filter(t => !seen.has(t) && seen.add(t));
  if (!near.length) return null;
  const other = shuffle(Object.keys(MISCONCEPTIONS), rand).map(t => mistakeText(t).kz).filter(t => !seen.has(t) && seen.add(t));
  const wrong = [...near, ...other].slice(0, 2);
  return shuffle([{ text: right, ok: true }, ...wrong.map(text => ({ text, ok: false }))], rand);
}

export function buildReview(item: Item, picked: number | null, mode: ReviewMode, rand: () => number = Math.random): Review {
  const sol = item.sol.kz;
  if (mode === 'error' && picked !== null && picked !== item.answer) {
    const your = kzPart(item.choices[picked].text);
    const turn = buildGlitch(item, rand, item.choices[picked].text);
    if (turn) return { kind: 'find', turn, your, why: mistakeText(turn.tag).kz };
    const cards = whyCards(item, picked, rand);
    if (cards) return { kind: 'why', cards, your };
  }
  const gap = solGap(sol, item.choices[item.answer].text, rand);
  if (gap) return { kind: 'gap', gap, sol };
  if (mode === 'fast') { const mc = miniCheck(item.kz, rand); if (mc) return { kind: 'check', mc }; }
  return { kind: 'read', sol };
}
