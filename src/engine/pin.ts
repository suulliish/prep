// PIN командира (K2, docs/systems/specs/commander.md, IMPLEMENTATION.md): PBKDF2 с солью вместо SHA-256 без соли, лимит попыток
// на устройстве, PIN задаётся только с паролем облака. Чистый модуль: экран — src/screens/commander/PinGate.svelte,
// состояние устройства — src/lib/pinstate.ts. Защита от младшего брата, а не от взломщика: хэш лежит в сохранении на его телефоне.
import type { PinRec } from './types';

export const PIN_ITER = 100_000;
export const PIN_FREE_TRIES = 5;          // столько неверных вводов подряд без паузы
export const PIN_LOCK_MS = 60_000;        // потом пауза 60 с, каждый следующий промах удваивает её
export const PIN_LOCK_MAX_MS = 15 * 60_000;
export const UNLOCK_MS = 10 * 60_000;     // после верного PIN командир открыт 10 минут (возврат из «Звука» и т.п.)

export const validPin = (p: string) => /^\d{4}$/.test(p);
const MAX_ITER = 1_000_000;   // испорченная запись с iter = 1e12 повесила бы вкладку
/** Похоже на сохранённый PIN: старый хэш (64 hex) или запись с разумными полями. Всё остальное считаем «PIN не задан» (испорченное облако не запирает и не открывает). */
export function isStoredPin(p: unknown): p is string | PinRec {
  if (typeof p === 'string') return /^[0-9a-f]{64}$/.test(p);
  if (!p || typeof p !== 'object') return false;
  const r = p as PinRec;
  return typeof r.hash === 'string' && /^[0-9a-f]+$/.test(r.hash) && typeof r.salt === 'string' && /^([0-9a-f]{2})+$/.test(r.salt)
    && Number.isInteger(r.iter) && r.iter > 0 && r.iter <= MAX_ITER && typeof r.setAt === 'number' && Number.isFinite(r.setAt);
}
const hex = (b: ArrayBuffer | Uint8Array) => [...new Uint8Array(b as ArrayBuffer)].map(x => x.toString(16).padStart(2, '0')).join('');
const unhex = (h: string) => new Uint8Array((h.match(/../g) ?? []).map(x => parseInt(x, 16)));

async function derive(pin: string, salt: Uint8Array, iter: number): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
  return hex(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations: iter }, key, 256));
}
/** Старый формат (до 02.10): SHA-256 от «razlom:PIN» без соли. Узнаётся по тому, что в сохранении лежит строка. */
const legacyHash = async (pin: string) => hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode('razlom:' + pin)));

export async function makePin(pin: string, now = Date.now(), iter = PIN_ITER, weak = false): Promise<PinRec> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return { hash: await derive(pin, salt, iter), salt: hex(salt), iter, setAt: now, ...(weak ? { weak: true as const } : {}) };
}
export async function checkPin(stored: string | PinRec | undefined, pin: string): Promise<boolean> {
  if (!isStoredPin(stored) || !validPin(pin)) return false;
  if (typeof stored === 'string') return (await legacyHash(pin)) === stored;
  return (await derive(pin, unhex(stored.salt), stored.iter)) === stored.hash;
}
/** Старый хэш или меньше итераций, чем сейчас: после верного ввода перезаписываем новым. */
export const needsUpgrade = (stored: string | PinRec | undefined) => typeof stored === 'string' || (!!stored && stored.iter < PIN_ITER);

/** Два PIN с разных устройств: испорченное не в счёт; PIN, заданный с паролем облака, побеждает заданный без него (иначе PIN, поставленный
 *  ребёнком на устройстве без входа, перетянул бы облако брата); дальше больший setAt, запись побеждает старую строку (setAt = 0);
 *  при полном равенстве побеждает больший хэш (одинаково с обеих сторон, без перетягивания туда-сюда). */
export function newerPin(a: unknown, b: unknown): string | PinRec | undefined {
  const x = isStoredPin(a) ? a : undefined, y = isStoredPin(b) ? b : undefined;
  if (!x) return y; if (!y) return x;
  const weak = (p: string | PinRec) => (typeof p !== 'string' && p.weak ? 1 : 0), at = (p: string | PinRec) => (typeof p === 'string' ? 0 : p.setAt);
  const h = (p: string | PinRec) => (typeof p === 'string' ? p : p.hash);
  if (weak(x) !== weak(y)) return weak(x) ? y : x;
  if (at(x) !== at(y)) return at(y) > at(x) ? y : x;
  return h(y) > h(x) ? y : x;
}

// ---------- лимит попыток (только на устройстве, в сохранение и облако не попадает) ----------
export interface PinGuard { fails: number; until: number; at?: number }   // at — когда был последний промах
export const GUARD_EMPTY: PinGuard = { fails: 0, until: 0 };
export const PIN_FAIL_DECAY_MS = 30 * 60_000;   // полчаса без промахов: счёт начинается заново (иначе чужие промахи неделями копятся против командира)
/** Сколько мс ждать до следующей попытки (0 — можно). */
export const guardWait = (g: PinGuard, now: number) => Math.max(0, g.until - now);
/** После неверного ввода: первые PIN_FREE_TRIES промахов без паузы, дальше 60 с, 120 с, 240 с … не больше 15 минут. */
export function onPinFail(g: PinGuard, now: number): PinGuard {
  const fails = (g.at !== undefined && now - g.at > PIN_FAIL_DECAY_MS && now >= g.until ? 0 : g.fails) + 1;
  if (fails < PIN_FREE_TRIES) return { fails, until: 0, at: now };
  return { fails, until: now + Math.min(PIN_LOCK_MS * 2 ** (fails - PIN_FREE_TRIES), PIN_LOCK_MAX_MS), at: now };
}
/** Строже из двух состояний (хранилища и памяти страницы): чистка localStorage не обнуляет паузу, пока страница открыта. */
export const worseGuard = (a: PinGuard, b: PinGuard): PinGuard => (a.until !== b.until ? (a.until > b.until ? a : b) : a.fails >= b.fails ? a : b);
/** Разбор сохранённого состояния: испорченное или чужое → пустое (в сторону «не пускать» не ошибаемся: пауза не длиннее максимума). */
export function parseGuard(raw: string | null, now: number): PinGuard {
  try {
    const g = JSON.parse(raw ?? 'null');
    if (!g || typeof g.fails !== 'number' || typeof g.until !== 'number' || g.fails < 0) return GUARD_EMPTY;
    return { fails: Math.floor(g.fails), until: Math.min(g.until, now + PIN_LOCK_MAX_MS), ...(typeof g.at === 'number' ? { at: g.at } : {}) };
  } catch { return GUARD_EMPTY; }
}

// ---------- кто и когда может задать PIN ----------
export type PinPlan = { ok: true; needPassword: boolean; note?: string } | { ok: false; why: string };
/** Задать или сменить PIN. С облаком — всегда только с паролем облака (ребёнок пароля не знает). Без облачного входа на этом устройстве
 *  первый PIN можно задать без пароля (временно, пока нет S2: иначе из экрана «Данные», где вход, не попасть), а сменить нельзя. */
export function planPinChange(o: { signedIn: boolean; hasPin: boolean }): PinPlan {
  if (o.signedIn) return { ok: true, needPassword: true };
  if (!o.hasPin) return { ok: true, needPassword: false, note: 'Облако на этом устройстве не подключено, поэтому PIN пока задаётся без пароля. После входа в облако (Данные) смените его: тогда смена потребует пароль.' };
  return { ok: false, why: 'Сменить PIN можно только после входа в облако на этом устройстве: пароль облака подтверждает, что это командир. Если облако не подключено и PIN забыт, помогает только очистка данных браузера (прогресс на устройстве пропадёт, в облаке он остаётся).' };
}
/** Человеческое сообщение об ошибке проверки пароля облака. */
export function reauthMessage(code?: string): string {
  if (!code) return 'Не удалось проверить пароль';
  if (/invalid-credential|wrong-password|invalid-login/.test(code)) return 'Неверный пароль облака';
  if (/too-many-requests/.test(code)) return 'Слишком много попыток, подождите несколько минут';
  if (/network/.test(code)) return 'Нет сети: пароль проверяется онлайн';
  if (code === 'no-user') return 'Облако не подключено на этом устройстве';
  return `Ошибка проверки пароля (${code})`;
}
