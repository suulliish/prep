// Монеты («тиын») и мастерская корабля (docs/GAME_LOOP.md 5, L5). Монеты — только на красоту, на учёбу не влияют.
// Чистые правила (earn/buy/pet) работают с любым Save — их проверяют тесты (tests/ship.test.ts);
// внизу тонкие обёртки над game.save для экранов. Каталог и цены — content/ship_items.mjs.
import type { Save } from '../engine/types';
import { blankDay } from '../engine/planner';
import { game, persist } from './store.svelte';
import { W } from './world.svelte';
// @ts-ignore — каталог на JS (его заполняет 3D-сторона)
import { SHIP_ITEMS, COINS as COIN_RULES } from '../../content/ship_items.mjs';

export type Slot = 'deck' | 'bow' | 'stern' | 'mast' | 'pet';
export interface ShipItem {
  id: string; kz: string; ru: string; price: number; slot: Slot;
  model: { kit: string; name: string; h: number }; icon: string;
}
export const ITEMS = SHIP_ITEMS as ShipItem[];
export const COINS = COIN_RULES as { correct: number; enemy: number; boss: number; stars3: number };

export const SLOTS: { id: Slot; kz: string }[] = [
  { id: 'deck', kz: 'Палуба' }, { id: 'bow', kz: 'Мұрын' }, { id: 'stern', kz: 'Құйрық' }, { id: 'mast', kz: 'Діңгек' }, { id: 'pet', kz: 'Жануар' },
];
export const itemById = (id: string) => ITEMS.find(i => i.id === id);

// ---------- заработок ----------
/** Монеты за ответ: только верный с первой попытки, без полного решения (подсказка 4) и не «слишком быстрый» (лесенка src/engine/rush.ts).
 *  Реванш и «егіз» считаются как обычные вопросы: их первая попытка тоже честная работа. Вторая попытка монет не даёт. */
export function answerCoins(a: { correct: boolean; tries: number; hintLevel: number; fast: boolean }): number {
  return a.correct && a.tries <= 1 && a.hintLevel < 4 && !a.fast ? COINS.correct : 0;
}
/** Монеты за побеждённого врага волны. Босс мира даёт свою награду, обычный враг последней волны босс-боя не считается. */
export const enemyCoins = (isWorldBoss: boolean) => (isWorldBoss ? COINS.boss : COINS.enemy);
/** Монеты за 3 звезды уровня (босса не считаем: у него своя награда). */
export const starsCoins = (stars: number) => (stars >= 3 ? COINS.stars3 : 0);

/** Монеты игрока: целое не меньше нуля. Битое сохранение (строка, NaN, Infinity, минус) даёт 0 или ближайшее допустимое, а не NaN на экране. */
export const coinsOf = (s: Save) => { const n = Number(s.coins); return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0; };
/** Начислить монеты в сохранение и в запись дня (для итога дня). Возвращает новый баланс. */
export function addCoins(s: Save, n: number, day: string): number {
  const add = Math.max(0, Math.floor(n));
  if (!add) return coinsOf(s);
  s.coins = coinsOf(s) + add;
  const d = (s.days[day] ??= blankDay(day));
  d.coins = coinsOf({ coins: d.coins } as Save) + add;
  return s.coins;
}

// ---------- покупки ----------
export const ownedIds = (s: Save): string[] => (s.shipOwned ?? []).filter(id => !!itemById(id));
export const isOwned = (s: Save, id: string) => (s.shipOwned ?? []).includes(id);
/** Украшения на корабле: купленные не-питомцы. */
export const decorIds = (s: Save) => ownedIds(s).filter(id => itemById(id)!.slot !== 'pet');
/** Активный питомец (только если он куплен и есть в каталоге). */
export const activePet = (s: Save): string | null => (s.shipPet && isOwned(s, s.shipPet) && itemById(s.shipPet)?.slot === 'pet' ? s.shipPet : null);

export type BuyResult = { ok: true; price: number } | { ok: false; reason: 'unknown' | 'owned' | 'poor'; need?: number };
/** Купить предмет. Повторная покупка — 'owned' без списания; не хватает — 'poor' и сколько ещё нужно. Купленный питомец сразу становится активным. */
export function buyItem(s: Save, id: string): BuyResult {
  const it = itemById(id);
  if (!it) return { ok: false, reason: 'unknown' };
  if (isOwned(s, id)) return { ok: false, reason: 'owned' };
  const have = coinsOf(s);
  if (have < it.price) return { ok: false, reason: 'poor', need: it.price - have };
  s.coins = have - it.price;
  (s.shipOwned ??= []).push(id);
  if (it.slot === 'pet') s.shipPet = id;
  return { ok: true, price: it.price };
}
/** Выбрать активного питомца (один за раз) или null — без питомца. Не купленного выбрать нельзя. */
export function setActivePet(s: Save, id: string | null): boolean {
  if (id === null) { s.shipPet = null; return true; }
  const it = itemById(id);
  if (!it || it.slot !== 'pet' || !isOwned(s, id)) return false;
  s.shipPet = id; return true;
}
/** Хватает ли монет хоть на что-то ещё не купленное (значок «!» в меню). */
export const canAffordSomething = (s: Save) => ITEMS.some(i => !isOwned(s, i.id) && i.price <= coinsOf(s));

// ---------- обёртки над game.save (экраны) ----------
/** Начислить монеты игроку сейчас (сохраняется сразу). */
export function earnCoins(n: number) {
  if (!(n > 0)) return;
  addCoins(game.save, n, game.day); persist();
}
export function purchase(id: string): BuyResult {
  const r = buyItem(game.save, id);
  if (r.ok) { persist(); syncDecor(); }
  return r;
}
export function choosePet(id: string | null): boolean {
  const ok = setActivePet(game.save, id);
  if (ok) { persist(); syncDecor(); }
  return ok;
}

// ---------- 3D-корабль: методы появятся у World (другой агент); до тех пор вызовы молча пропускаются ----------
type DecorWorld = { setShipDecor?: (owned: string[], pet: string | null) => void; showDecor?: (id: string) => Promise<void> };
/** Отдать миру, что стоит на палубе и кто ходит рядом с героем. */
export function syncDecor() {
  const w = W.world as unknown as DecorWorld | null;
  if (typeof w?.setShipDecor === 'function') w.setShipDecor(decorIds(game.save), activePet(game.save));
}
/** Праздник: камера показывает новый предмет на месте (Promise завершается, когда показ кончился). */
export async function showDecor(id: string): Promise<void> {
  const w = W.world as unknown as DecorWorld | null;
  if (typeof w?.showDecor === 'function') { try { await w.showDecor(id); } catch { /* показ не удался — предмет всё равно куплен */ } }
}
