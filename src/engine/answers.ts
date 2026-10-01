// Отчёт командира по ответам ребёнка (Commander.svelte, вкладка «Ответы»): сводка дня, список по дням, что ломает корабль.
// Чистые функции над save.attempts и save.repairShop.
import type { Attempt, Save } from './types';
import { isDone } from './progress';
import { mistakeName } from './mistakeNames';

/** «Быстрый» ответ в отчёте командира: быстрее 5 секунд (как в карточке «Сегодня»). */
export const FAST_MS = 5000;
export const confLabel = (c?: Attempt['confidence']) => (c === 'sure' ? 'Сенімдімін' : c === 'maybe' ? 'Шамамен' : c === 'unsure' ? 'Білмеймін' : '—');
export const hintLabel = (h: number) => (h <= 0 ? '' : h >= 4 ? 'полный разбор' : `подсказка ${h}`);
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : null);

export interface DaySummary {
  day: string; n: number;
  clean: number; cleanPct: number | null;                 // верно с первой попытки (без подсказки)
  fast: number; fastPct: number | null;                   // ответов быстрее FAST_MS
  topErrors: { tag: string | undefined; name: string; n: number }[];
  careless: { skill: string; n: number }[];               // «небрежность»: ошибки в счёте (arith) на уже выученных темах
}

/** Тема выучена и сейчас, и уже к началу дня ответа (learnedAt раньше дня ответа; у старых сохранений без learnedAt — по статусу).
 *  Ошибки в день, когда тему только учили, и ошибки по теме, которая снова «изучается», — не небрежность: правило он ещё не знает. */
function learnedBy(save: Save, a: Attempt) {
  const sk = save.skills[a.skill];
  return isDone(sk) && (!sk.learnedAt || sk.learnedAt < a.day);
}

export function daySummary(save: Save, day: string): DaySummary {
  const list = save.attempts.filter(a => a.day === day);
  const clean = list.filter(a => a.correct && a.hintLevel === 0).length;
  const fast = list.filter(a => a.timeMs < FAST_MS).length;
  const errs = new Map<string, { tag: string | undefined; n: number }>();
  const care = new Map<string, number>();
  for (const a of list) {
    if (a.correct) continue;
    const k = a.tag ?? '';
    errs.set(k, { tag: a.tag, n: (errs.get(k)?.n ?? 0) + 1 });
    if (a.tag === 'arith' && learnedBy(save, a)) care.set(a.skill, (care.get(a.skill) ?? 0) + 1);
  }
  return {
    day, n: list.length, clean, cleanPct: pct(clean, list.length), fast, fastPct: pct(fast, list.length),
    topErrors: [...errs.values()].sort((x, y) => y.n - x.n).slice(0, 3).map(e => ({ tag: e.tag, name: mistakeName(e.tag), n: e.n })),
    careless: [...care].sort((x, y) => y[1] - x[1]).map(([skill, n]) => ({ skill, n })),
  };
}

/** Дни, в которые были ответы, от новых к старым. */
export function attemptDays(attempts: Attempt[]): string[] {
  return [...new Set(attempts.map(a => a.day))].sort().reverse();
}

/** Последние `limit` ответов, сгруппированные по дням: дни от новых к старым, внутри дня от новых к старым. */
export function recentByDay(attempts: Attempt[], limit = 100): { day: string; list: Attempt[] }[] {
  const last = attempts.slice(-limit).reverse();
  const out: { day: string; list: Attempt[] }[] = [];
  for (const a of last) {
    const g = out.find(x => x.day === a.day);
    if (g) g.list.push(a); else out.push({ day: a.day, list: [a] });
  }
  return out.sort((x, y) => (x.day < y.day ? 1 : x.day > y.day ? -1 : 0)).map(g => ({ day: g.day, list: g.list.sort((p, q) => q.at - p.at) }));
}

export interface BreakCause { skill: string; total: number; open: number; wrong: number }
/** Темы, которые чаще всего ломают корабль: поломок всего (и сколько ещё не починено) и ошибок по теме за всю историю. */
export function repairCauses(save: Save, top = 5): BreakCause[] {
  const m = new Map<string, BreakCause>();
  for (const r of save.repairShop) {
    const c = m.get(r.skill) ?? { skill: r.skill, total: 0, open: 0, wrong: 0 };
    c.total++; if (!r.fixed) c.open++;
    m.set(r.skill, c);
  }
  for (const a of save.attempts) if (!a.correct && m.has(a.skill)) m.get(a.skill)!.wrong++;
  return [...m.values()].sort((x, y) => y.total - x.total || y.open - x.open || y.wrong - x.wrong).slice(0, top);
}
