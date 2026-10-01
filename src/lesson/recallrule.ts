// «Еске түсір»: правило темы из слов-кирпичиков (чистая логика без экрана, её проверяют тесты).
// Правило берётся из шага rule урока (content/lessons.mjs). Вспоминается его главная строка: всё правило из 40–80 слов ребёнок не соберёт.
// Лестница подсказок (Karpicke 2016: если вспомнить не выходит, пользы нет): 0 пусто; 1 первое слово на месте; 2 скелет (каждое второе слово стоит); 3 правило показано.
// @ts-ignore
import { LESSONS } from '../../content/lessons.mjs';
import { seeded } from './gap';

export type Level = 0 | 1 | 2;
export const MIN_WORDS = 4, MAX_WORDS = 20, SHORT_WORDS = 8;
/** Слова-ловушки, когда в других строках правила нечем отвлекать. */
export const GENERIC_TRAPS = ['емес', 'әрқашан', 'тек', 'ешқашан'];

export const words = (s: string): string[] => s.trim().split(/\s+/).filter(Boolean);
/** Слово без знаков препинания и регистра: по нему сравниваем ловушки с правилом. */
export const plain = (w: string) => w.toLowerCase().replace(/[.,;:!?…"«»()]+/g, '');

/** Строки правила темы (шаг rule урока) или null, если у темы нет урока. */
export function ruleLines(skill: string): string[] | null {
  const step = ((LESSONS as Record<string, any[]>)[skill] ?? []).find(s => s.type === 'rule');
  return step?.lines?.length ? (step.lines as string[]) : null;
}
export const hasRule = (skill: string) => !!ruleLines(skill);

/** Что вспоминаем: первая строка; если она совсем короткая («1) Жақша ішіндегі амалдар.»), добавляем следующие, пока не наберётся 8 слов (не больше 18).
 *  Первая строка длиннее 20 слов: берём самую короткую строку из тех, где хотя бы 4 слова. */
export function coreRule(lines: string[]): string {
  const len = (s: string) => words(s).length;
  let core = lines[0];
  if (len(core) > MAX_WORDS) {
    const ok = lines.filter(l => len(l) >= MIN_WORDS).sort((a, b) => len(a) - len(b));
    return ok[0] ?? core;
  }
  for (let k = 1; k < lines.length && len(core) < SHORT_WORDS && len(core) + len(lines[k]) <= 18; k++) core += ' ' + lines[k];
  return core;
}

export interface Board {
  /** слова правила по порядку */
  target: string[];
  /** слова, уже стоящие на месте (null — пусто); длина = target.length */
  preset: (string | null)[];
  /** кирпичики в куче: недостающие слова правила и слова-ловушки вперемешку */
  pile: string[];
  /** true: лоток свободный (ребёнок выкладывает слова подряд); false: скелет, слова встают в пустые места по порядку */
  open: boolean;
}

function shuffle<T>(a: T[], rand: () => number): T[] {
  const r = a.slice();
  for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; }
  return r;
}

/** 2–3 слова-ловушки: слова из других строк этого же правила (правдоподобны, но в главной строке их нет), потом общие («емес», «тек»…). */
export function traps(lines: string[], target: string[], rand: () => number, want = 3): string[] {
  const inTarget = new Set(target.map(plain));
  const seen = new Set<string>(inTarget);
  const fromRule = shuffle(lines.flatMap(words).filter(w => /^[\p{L}]{3,}[.,;:!?]?$/u.test(w) && !/\d/.test(w)), rand);
  const out: string[] = [];
  for (const w of fromRule) { if (out.length >= Math.max(1, want - 1)) break; if (!seen.has(plain(w))) { seen.add(plain(w)); out.push(w.replace(/[.,;:!?]+$/, '')); } }
  for (const w of shuffle(GENERIC_TRAPS, rand)) { if (out.length >= want) break; if (!seen.has(plain(w))) { seen.add(plain(w)); out.push(w); } }
  return out;
}

/** Доска для попытки: level 0 — пусто, 1 — первое слово на месте, 2 — скелет. Кучу перемешиваем по seedKey (тема, день, уровень), чтобы не прыгала при перерисовке. */
export function makeBoard(lines: string[], level: Level, seedKey: string): Board {
  const target = words(coreRule(lines));
  const rand = seeded(seedKey);
  const preset: (string | null)[] = target.map((w, i) => (level === 1 ? (i === 0 ? w : null) : level === 2 ? (i % 2 === 0 ? w : null) : null));
  const missing = target.filter((_, i) => preset[i] === null);
  let pile = shuffle([...missing, ...traps(lines, target, rand)], rand);
  // куча не должна случайно повторять порядок правила
  for (let k = 0; k < 4 && pile.length > 1 && missing.every((w, i) => pile[i] === w); k++) pile = shuffle(pile, rand);
  return { target, preset, pile, open: level !== 2 };
}

/** Сколько слов ребёнку нужно выложить. Скелет: по числу пустых мест; иначе сколько угодно (минимум одно слово). */
export const blanks = (b: Board) => b.preset.filter(x => x === null).length;

/** Что получилось: слова, уже стоящие на месте, плюс выложенные. Скелет: выложенные встают в пустые места по порядку, незаполненные остаются null. */
export function assemble(b: Board, picks: string[]): (string | null)[] {
  if (b.open) return [...b.preset.filter((x): x is string => x !== null), ...picks];
  let k = 0;
  return b.preset.map(x => (x !== null ? x : k < picks.length ? picks[k++] : null));
}

export function isRight(target: string[], answer: (string | null)[]): boolean {
  return answer.length === target.length && answer.every((w, i) => w === target[i]);
}

export interface Diff { target: boolean[]; answer: boolean[] }
/** Сверка: true — слово на месте (общая подпоследовательность), false — лишнее или пропущенное. Слова равны с точностью до регистра. */
export function diff(target: string[], answer: (string | null)[]): Diff {
  const a = target.map(plainKeep), b = answer.map(x => (x === null ? null : plainKeep(x)));
  const n = a.length, m = b.length;
  const L: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = a[i] === b[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const t = new Array(n).fill(false), s = new Array(m).fill(false);
  for (let i = 0, j = 0; i < n && j < m;) {
    if (a[i] === b[j]) { t[i] = true; s[j] = true; i++; j++; } else if (L[i + 1][j] >= L[i][j + 1]) i++; else j++;
  }
  return { target: t, answer: s };
}
const plainKeep = (w: string) => w.toLowerCase();
