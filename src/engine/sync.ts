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
