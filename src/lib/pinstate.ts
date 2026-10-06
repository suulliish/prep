// Состояние PIN на устройстве (K2): счётчик промахов и окно «командир открыт». В сохранение и облако не попадает:
// у каждого телефона свой счётчик, а окно живёт только в памяти страницы.
import { GUARD_EMPTY, UNLOCK_MS, parseGuard, worseGuard, type PinGuard } from '../engine/pin';

const KEY = 'razlom.pin.guard';
let mem: PinGuard = GUARD_EMPTY;   // копия в памяти: без хранилища (приватный режим, переполнено) или после его очистки пауза всё равно действует
export function loadGuard(now = Date.now()): PinGuard {
  let stored = GUARD_EMPTY;
  try { stored = parseGuard(localStorage.getItem(KEY), now); } catch { /* хранилище недоступно: работает память */ }
  return worseGuard(stored, parseGuard(JSON.stringify(mem), now));
}
export function saveGuard(g: PinGuard) {
  mem = g;
  try { if (g.fails === 0 && g.until === 0) localStorage.removeItem(KEY); else localStorage.setItem(KEY, JSON.stringify(g)); } catch { /* только память */ }
}

let openUntil = 0;
/** Командир открыт: верный PIN был не позже 10 минут назад, и с тех пор экран не простаивал дольше (каждое касание продлевает окно). */
export const commanderOpen = (now = Date.now()) => now < openUntil;
export const openCommander = (now = Date.now()) => { openUntil = now + UNLOCK_MS; };
export const closeCommander = () => { openUntil = 0; };
