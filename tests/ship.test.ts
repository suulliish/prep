import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Save } from '../src/engine/types';
import { game, replaceSave } from '../src/lib/store.svelte';
import { splitCoins } from '../src/ui/coinfly';
import {
  ITEMS, SLOTS, COINS, answerCoins, enemyCoins, starsCoins, addCoins, coinsOf, buyItem, setActivePet,
  ownedIds, decorIds, activePet, isOwned, canAffordSomething,
} from '../src/lib/ship.svelte';

const blank = (extra: Partial<Save> = {}): Save => ({
  version: 1, heroName: 'Т', xp: 0, skills: {}, attempts: [], days: {}, settings: { extraMissionCap: 4, extraTo: 'today', planMinutes: 40 },
  diagnosticDone: true, repairShop: [], ...extra,
});
const DAY = '2026-09-30';
// тестовые предметы: каталог растёт, поэтому правила проверяем на своих, не на цифрах чужого каталога
const T = [
  { id: 't_deck', kz: 'Т1', ru: 't1', price: 30, slot: 'deck', model: { kit: 'ship', name: 'x', h: 1 }, icon: 'ui/ship/t_deck.png' },
  { id: 't_pet_a', kz: 'Т2', ru: 't2', price: 100, slot: 'pet', model: { kit: 'pets', name: 'a', h: 1 }, icon: 'ui/ship/t_pet_a.png' },
  { id: 't_pet_b', kz: 'Т3', ru: 't3', price: 120, slot: 'pet', model: { kit: 'pets', name: 'b', h: 1 }, icon: 'ui/ship/t_pet_b.png' },
] as any[];
beforeAll(() => { ITEMS.push(...T); });
afterAll(() => { for (const t of T) ITEMS.splice(ITEMS.findIndex(i => i.id === t.id), 1); });

describe('монеты: заработок', () => {
  const ok = { correct: true, tries: 1, hintLevel: 0, fast: false };
  it('верный ответ с первой попытки даёт COINS.correct', () => expect(answerCoins(ok)).toBe(COINS.correct));
  it('ошибка и вторая попытка монет не дают', () => {
    expect(answerCoins({ ...ok, correct: false })).toBe(0);
    expect(answerCoins({ ...ok, tries: 2 })).toBe(0);
  });
  it('подсказки 1-3 монет не отнимают, полное решение (4) — да', () => {
    expect(answerCoins({ ...ok, hintLevel: 3 })).toBe(COINS.correct);
    expect(answerCoins({ ...ok, hintLevel: 4 })).toBe(0);
  });
  it('«слишком быстрый» ответ (лесенка против спешки) монет не даёт', () => expect(answerCoins({ ...ok, fast: true })).toBe(0));
  it('враг, босс мира и 3 звезды', () => {
    expect(enemyCoins(false)).toBe(COINS.enemy);
    expect(enemyCoins(true)).toBe(COINS.boss);
    expect(starsCoins(3)).toBe(COINS.stars3);
    expect(starsCoins(2)).toBe(0);
    expect(starsCoins(0)).toBe(0);
  });
  it('addCoins: баланс и запись дня; мусор игнорируется', () => {
    const s = blank();
    expect(addCoins(s, 7, DAY)).toBe(7);
    expect(addCoins(s, 5, DAY)).toBe(12);
    expect(s.days[DAY].coins).toBe(12);
    addCoins(s, -3, DAY); addCoins(s, NaN, DAY); addCoins(s, 0, DAY);
    expect(coinsOf(s)).toBe(12);
    expect(addCoins(s, 2.9, DAY)).toBe(14);   // дробное округляется вниз
  });
  it('старое сохранение без поля coins считается нулём', () => expect(coinsOf(blank())).toBe(0));
  it('битые монеты в сохранении (строка, NaN, минус, Infinity) читаются как 0, дробные округляются вниз', () => {
    for (const bad of ['abc', NaN, Infinity, -Infinity, -5, null, undefined, {}, []]) expect(coinsOf(blank({ coins: bad as any })), String(bad)).toBe(0);
    expect(coinsOf(blank({ coins: 12.9 }))).toBe(12);
    expect(coinsOf(blank({ coins: '40' as any }))).toBe(40);
  });
  it('с битыми монетами баланс не превращается в NaN: начисление считает с нуля, покупка отказывает «не хватает»', () => {
    const s = blank({ coins: 'abc' as any, days: { [DAY]: { day: DAY, coins: 'xyz' as any } as any } });
    expect(buyItem(s, 't_deck')).toEqual({ ok: false, reason: 'poor', need: 30 });
    expect(addCoins(s, 5, DAY)).toBe(5);
    expect(s.coins).toBe(5);
    expect(s.days[DAY].coins).toBe(5);
    expect(Number.isFinite(coinsOf(s))).toBe(true);
  });
  it('splitCoins делит монеты на доли без потерь', () => {
    for (const [n, k] of [[2, 2], [5, 5], [25, 6], [7, 3], [1, 1]]) {
      const p = splitCoins(n, k);
      expect(p).toHaveLength(k);
      expect(p.reduce((a, b) => a + b, 0)).toBe(n);
    }
  });
});

describe('мастерская: покупки', () => {
  it('хватает монет: списывается цена, предмет куплен', () => {
    const s = blank({ coins: 50 });
    expect(buyItem(s, 't_deck')).toEqual({ ok: true, price: 30 });
    expect(s.coins).toBe(20);
    expect(isOwned(s, 't_deck')).toBe(true);
  });
  it('не хватает: ничего не списано, сказано сколько ещё нужно', () => {
    const s = blank({ coins: 10 });
    expect(buyItem(s, 't_deck')).toEqual({ ok: false, reason: 'poor', need: 20 });
    expect(s.coins).toBe(10);
    expect(s.shipOwned ?? []).toEqual([]);
  });
  it('повторная покупка идемпотентна: второй раз не списывает и не дублирует', () => {
    const s = blank({ coins: 100 });
    buyItem(s, 't_deck');
    const again = buyItem(s, 't_deck');
    expect(again).toEqual({ ok: false, reason: 'owned' });
    expect(s.coins).toBe(70);
    expect(s.shipOwned).toEqual(['t_deck']);
  });
  it('неизвестный id — отказ без изменений', () => {
    const s = blank({ coins: 999 });
    expect(buyItem(s, 'nope')).toEqual({ ok: false, reason: 'unknown' });
    expect(s.coins).toBe(999);
  });
  it('купленный питомец сразу активен; второй питомец заменяет первого (один за раз)', () => {
    const s = blank({ coins: 500 });
    buyItem(s, 't_pet_a');
    expect(activePet(s)).toBe('t_pet_a');
    buyItem(s, 't_pet_b');
    expect(activePet(s)).toBe('t_pet_b');
    expect(setActivePet(s, 't_pet_a')).toBe(true);
    expect(activePet(s)).toBe('t_pet_a');
    expect(s.shipOwned).toEqual(['t_pet_a', 't_pet_b']);   // первый не потерян, просто отдыхает
  });
  it('питомца можно отпустить (null); чужого, не купленного или не питомца выбрать нельзя', () => {
    const s = blank({ coins: 500, shipOwned: ['t_pet_a', 't_deck'], shipPet: 't_pet_a' });
    expect(setActivePet(s, null)).toBe(true);
    expect(activePet(s)).toBeNull();
    expect(setActivePet(s, 't_pet_b')).toBe(false);   // не куплен
    expect(setActivePet(s, 't_deck')).toBe(false);    // не питомец
    expect(s.shipPet).toBeNull();
  });
  it('украшения на корабле — без питомцев; неизвестные id из сохранения отбрасываются', () => {
    const s = blank({ shipOwned: ['t_deck', 't_pet_a', 'deleted_item'] });
    expect(decorIds(s)).toEqual(['t_deck']);
    expect(ownedIds(s)).toEqual(['t_deck', 't_pet_a']);
  });
  it('значок «можно что-то купить»', () => {
    expect(canAffordSomething(blank({ coins: 0 }))).toBe(false);
    expect(canAffordSomething(blank({ coins: 9999 }))).toBe(true);
    expect(canAffordSomething(blank({ coins: 9999, shipOwned: ITEMS.map(i => i.id) }))).toBe(false);
  });
});

describe('сохранение: миграция', () => {
  it('старое сохранение без монет и мастерской грузится с нулями', () => {
    const old = { version: 1, heroName: 'Муртаза', introSeen: true, diagnosticDone: true, xp: 40, skills: {}, attempts: [], days: {}, repairShop: [], settings: { extraMissionCap: 4, extraTo: 'today', planMinutes: 40 } };
    replaceSave(old as unknown as Save);
    expect(game.save.coins).toBe(0);
    expect(game.save.shipOwned).toEqual([]);
    expect(game.save.shipPet).toBeNull();
    expect(game.save.xp).toBe(40);
  });
  it('сохранение с монетами (из облака) переживает замену целиком', () => {
    replaceSave({ ...blank(), coins: 77, shipOwned: ['t_deck'], shipPet: null } as Save);
    expect(game.save.coins).toBe(77);
    expect(game.save.shipOwned).toEqual(['t_deck']);
  });
});

describe('каталог content/ship_items.mjs', () => {
  const real = ITEMS.filter(i => !i.id.startsWith('t_'));
  it('id уникальны, слот из списка мастерской, цена положительная, есть казахское имя и иконка', () => {
    expect(new Set(real.map(i => i.id)).size).toBe(real.length);
    for (const i of real) {
      expect(SLOTS.map(s => s.id), i.id).toContain(i.slot);
      expect(i.price, i.id).toBeGreaterThan(0);
      expect(i.kz, i.id).toBeTruthy();
      expect(i.icon, i.id).toBeTruthy();
    }
  });
});
