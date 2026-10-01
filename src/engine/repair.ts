// Поломки корабля как цена ошибок (docs/GAME_LOOP.md 18): прочность корабля, половинные монеты, сундук за целый корабль.
// Каждая неисправленная ошибка (save.repairShop, fixed != true) — поломка. Чистые правила: экраны только показывают.
import type { Save } from './types';

export const openBreaks = (s: Save) => s.repairShop.filter(r => !r.fixed).length;

/** Прочность корабля, %: 100 при целом корабле, −10 за каждую поломку, не меньше 0. */
export const shipIntegrity = (breaks: number) => Math.max(0, 100 - 10 * Math.max(0, breaks));
/** Больше 6 поломок: монеты за ответы вдвое меньше, пока не починишь (само половинение делает бой, Session.svelte). */
export const COINS_HALF_FROM = 7;
export const coinsHalved = (breaks: number) => breaks >= COINS_HALF_FROM;
/** Цвет полосы прочности: от красного (0%) к зелёному (100%). */
export const integrityColor = (pct: number) => `hsl(${Math.round(Math.max(0, Math.min(100, pct)) * 1.2)} 78% 52%)`;

/** Сундук за целый корабль: +20 монет и (если есть) случайное ещё не купленное дешёвое украшение в подарок. */
export const CHEST_COINS = 20, CHEST_MAX_PRICE = 60;
export interface ChestPrize { coins: number; item: string | null }
export interface ChestItem { id: string; price: number; slot: string }

/** Выдать сундук, если корабль целый (0 поломок) и после прошлого сундука что-то починено.
 *  Память — save.shipChestFixed: число починенных записей на момент прошлой выдачи. Новые поломки и их починка увеличивают число
 *  починенных, значит сундук выдаётся один раз за «опустошение», а не при каждом заходе на корабль.
 *  Первый вызов только запоминает точку отсчёта: что было починено раньше, сундука не даёт. Подарок-украшение дописывается в shipOwned;
 *  монеты начисляет вызывающий (addCoins: они идут ещё и в запись дня). */
export const CHEST_MIN_FIXES = 5;
export function claimShipChest(s: Save, items: ChestItem[], rand: () => number = Math.random): ChestPrize | null {
  const fixedN = s.repairShop.filter(r => r.fixed).length;
  const base = s.shipChestFixed;
  if (base === undefined) { s.shipChestFixed = fixedN; return null; }
  if (fixedN < base) { s.shipChestFixed = fixedN; return null; }   // список починенных почистили — отсчёт заново
  // сундук не за «одну ошибку и её починку»: от прошлого сундука нужно починить не меньше CHEST_MIN_FIXES поломок
  if (openBreaks(s) > 0 || fixedN - base < CHEST_MIN_FIXES) return null;
  s.shipChestFixed = fixedN;
  const owned = new Set(s.shipOwned ?? []);
  const pool = items.filter(i => i.slot !== 'pet' && i.price <= CHEST_MAX_PRICE && !owned.has(i.id));
  const item = pool.length ? pool[Math.min(pool.length - 1, Math.floor(rand() * pool.length))].id : null;
  if (item) { s.shipOwned ??= []; s.shipOwned.push(item); }
  return { coins: CHEST_COINS, item };
}
