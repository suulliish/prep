// Поломки корабля как цена ошибок (docs/GAME_LOOP.md 18): ремонтная доп. миссия, прочность, половинные монеты, сундук за целый корабль.
import { describe, it, expect } from 'vitest';
import { extraNeedsRepair, REPAIR_FOR_EXTRA, canStartExtra, blankDay, extraCap } from '../src/engine/planner';
import { shipIntegrity, coinsHalved, integrityColor, claimShipChest, openBreaks, CHEST_COINS, CHEST_MAX_PRICE } from '../src/engine/repair';
import type { Save } from '../src/engine/types';
// @ts-ignore
import { SHIP_ITEMS } from '../content/ship_items.mjs';

const save = (): Save => ({ version: 1, heroName: 'Т', xp: 0, skills: {}, attempts: [], days: {}, settings: { extraMissionCap: 1, extraTo: 'today', planMinutes: 60 }, diagnosticDone: true, repairShop: [] });
const brk = (n: number, skill = 'a') => Array.from({ length: n }, () => ({ source: 's', skill, addedDay: '2026-10-01' }));

describe('ремонтная доп. миссия', () => {
  it('extraNeedsRepair: от 3 поломок', () => {
    expect([0, 1, 2].map(extraNeedsRepair)).toEqual([false, false, false]);
    expect([3, 4, 9].map(extraNeedsRepair)).toEqual([true, true, true]);
    expect(REPAIR_FOR_EXTRA).toBe(3);
  });
  it('лимит доп. миссий (1 в день) не сломан', () => {
    const plan = { day: '2026-10-01', blocks: [{ id: 'summary' as const, minutes: 2, skills: [], items: 0 }] };
    const rec = blankDay('2026-10-01'); rec.blocksDone.summary = true;
    expect(extraCap(4)).toBe(1);
    expect(canStartExtra(rec, plan, 4)).toBe(true);
    rec.extraMissions = 1;
    expect(canStartExtra(rec, plan, 4)).toBe(false);
  });
});

describe('прочность корабля', () => {
  it('100% при целом, −10% за поломку, не меньше 0', () => {
    expect([0, 1, 2, 4, 8, 10, 15].map(shipIntegrity)).toEqual([100, 90, 80, 60, 20, 0, 0]);
  });
  it('половинные монеты — при > 6 поломок', () => {
    expect([0, 3, 6].map(coinsHalved)).toEqual([false, false, false]);
    expect([7, 8, 20].map(coinsHalved)).toEqual([true, true, true]);
  });
  it('цвет от красного к зелёному', () => {
    expect(integrityColor(0)).toContain('hsl(0 '); expect(integrityColor(100)).toContain('hsl(120 ');
  });
  it('openBreaks считает только неисправленные', () => {
    const s = save(); s.repairShop = [...brk(3), { ...brk(1)[0], fixed: true }];
    expect(openBreaks(s)).toBe(3);
  });
});

describe('сундук за целый корабль', () => {
  const items = SHIP_ITEMS as { id: string; price: number; slot: string }[];
  const fix = (s: Save, n: number) => { let k = 0; for (const r of s.repairShop) if (!r.fixed && k < n) { r.fixed = true; k++; } };

  it('одна ошибка и её починка сундук не дают: нужно не меньше CHEST_MIN_FIXES починок', () => {
    const s = save(); claimShipChest(s, items);
    s.repairShop = brk(1); fix(s, 1); expect(claimShipChest(s, items)).toBeNull();
    s.repairShop.push(...brk(4)); fix(s, 4); expect(claimShipChest(s, items)).not.toBeNull();
  });
  it('первый заход только запоминает точку отсчёта: старые починки сундука не дают', () => {
    const s = save(); s.repairShop = brk(2).map(r => ({ ...r, fixed: true }));
    expect(claimShipChest(s, items)).toBeNull();
    expect(s.shipChestFixed).toBe(2);
    expect(claimShipChest(s, items)).toBeNull();
  });
  it('поломки починены до нуля: +20 монет и дешёвое украшение, и только один раз', () => {
    const s = save(); claimShipChest(s, items);          // точка отсчёта 0
    s.repairShop = brk(5);
    expect(claimShipChest(s, items)).toBeNull();          // ещё не починено
    fix(s, 4); expect(claimShipChest(s, items)).toBeNull();   // осталась одна
    fix(s, 1);
    const prize = claimShipChest(s, items, () => 0);
    expect(prize).not.toBeNull(); expect(prize!.coins).toBe(CHEST_COINS);
    const it = items.find(i => i.id === prize!.item)!;
    expect(it.slot).not.toBe('pet'); expect(it.price).toBeLessThanOrEqual(CHEST_MAX_PRICE);
    expect(s.shipOwned).toEqual([prize!.item]);
    // повторные заходы без новых поломок — ничего
    expect(claimShipChest(s, items)).toBeNull(); expect(claimShipChest(s, items)).toBeNull();
    expect(s.shipOwned).toHaveLength(1);
  });
  it('новые поломки и их починка — новый сундук; уже купленное украшение не дарим', () => {
    const s = save(); claimShipChest(s, items);
    s.repairShop = brk(5); fix(s, 5);
    const first = claimShipChest(s, items, () => 0)!;
    s.repairShop.push(...brk(2)); fix(s, 2); expect(claimShipChest(s, items)).toBeNull();   // 2 починки — мало, корабль целый, но сундука нет
    s.repairShop.push(...brk(3)); fix(s, 3);
    const second = claimShipChest(s, items, () => 0)!;
    expect(second).not.toBeNull(); expect(second.item).not.toBe(first.item);
    expect(new Set(s.shipOwned).size).toBe(2);
  });
  it('все дешёвые украшения куплены: монеты есть, украшения нет', () => {
    const s = save(); claimShipChest(s, items);
    s.shipOwned = items.filter(i => i.slot !== 'pet' && i.price <= CHEST_MAX_PRICE).map(i => i.id);
    s.repairShop = brk(5); fix(s, 5);
    expect(claimShipChest(s, items)).toEqual({ coins: CHEST_COINS, item: null });
  });
  it('питомцы и дорогие вещи не дарим, случайный выбор покрывает весь дешёвый пул', () => {
    const cheap = items.filter(i => i.slot !== 'pet' && i.price <= CHEST_MAX_PRICE).map(i => i.id).sort();
    const seen = new Set<string>();
    for (let k = 0; k < cheap.length; k++) {
      const s = save(); claimShipChest(s, items); s.repairShop = brk(5); fix(s, 5);
      seen.add(claimShipChest(s, items, () => k / cheap.length)!.item!);
    }
    expect([...seen].sort()).toEqual(cheap);
  });
  it('сундук не выдаётся, пока хоть одна поломка не починена, даже если починенных прибавилось', () => {
    const s = save(); claimShipChest(s, items); s.repairShop = brk(3); fix(s, 2);
    expect(claimShipChest(s, items)).toBeNull(); expect(s.shipOwned).toBeUndefined();
  });
});
