// Слияние сохранения устройства и облака (src/lib/cloud.svelte.ts). Чистые функции — их гоняют тесты.
// Правила (02.10, после случая «новое устройство затёрло облако»):
// 1. Ответы не теряются никогда: история ответов — объединение обеих сторон (ответ узнаётся по времени, теме и задаче).
// 2. Пустое устройство (новый телефон брата, сброшенный браузер) никогда не побеждает облако, даже если «новее» по часам.
// 3. Иначе остальное сохранение берётся с той стороны, где updatedAt больше.
import type { Attempt, Save } from './types';

export const attemptKey = (a: Attempt) => `${a.at}|${a.skill}|${a.source}`;

/** Объединение историй ответов без повторов, по времени. */
export function mergeAttempts(a: Attempt[], b: Attempt[]): Attempt[] {
  const m = new Map<string, Attempt>();
  for (const x of [...a, ...b]) if (!m.has(attemptKey(x))) m.set(attemptKey(x), x);
  return [...m.values()].sort((x, y) => x.at - y.at);
}

/** Сохранение, в котором ничего не сделано: ни ответа, ни диагностики, ни опыта. */
export const isBlank = (s: Pick<Save, 'attempts' | 'diagnosticDone' | 'xp'>) => !(s.attempts?.length) && !s.diagnosticDone && !(s.xp > 0);

/** Чья копия главная: remote — взять облачную, local — отправить свою, same — ничего не менять. */
export function chooseSide(local: { at: number; blank: boolean }, remote: { at: number; blank: boolean }): 'remote' | 'local' | 'same' {
  if (local.blank && !remote.blank) return 'remote';
  if (remote.blank && !local.blank) return 'local';
  return remote.at > local.at ? 'remote' : remote.at < local.at ? 'local' : 'same';
}

/** Локальная копия (localStorage, ~5 млн знаков на сайт) не должна переполниться: если JSON длиннее max, в неё идут ответы
 *  только за последние `months` целых месяцев (старые остаются в памяти, в облаке и в файле-копии). Месяц режется только целиком:
 *  облако пишет ответы по месяцам, и неполный месяц затёр бы облачный. */
export const LOCAL_MAX_CHARS = 3_000_000;
export function localJson(save: Save, max = LOCAL_MAX_CHARS, months = 12): string {
  const full = JSON.stringify(save);
  if (full.length <= max || !save.attempts?.length) return full;
  const last = save.attempts[save.attempts.length - 1].day.slice(0, 7);
  const [y, m] = last.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 - (months - 1), 1));
  const cut = d.toISOString().slice(0, 7);
  return JSON.stringify({ ...save, attempts: save.attempts.filter(a => a.day.slice(0, 7) >= cut) });
}
