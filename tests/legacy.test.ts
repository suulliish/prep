// Снимок открытого (src/engine/legacy.ts, 02.10): открытое в старой системе только растёт и не закрывается.
import { describe, it, expect } from 'vitest';
import { unlockedNow, grownLegacy, ensureLegacy, legacyHas } from '../src/engine/legacy';
import type { Save } from '../src/engine/types';

const base = (): Save => ({ version: 1, heroName: 'М', xp: 0, skills: {}, attempts: [], days: {}, settings: { extraMissionCap: 1, extraTo: 'today', planMinutes: 40 }, diagnosticDone: true, repairShop: [] } as Save);
const mastered = (n: number) => Object.fromEntries(Array.from({ length: n }, (_, i) => [`t${i}`, { status: 'mastered' } as any]));

describe('снимок открытого', () => {
  it('пустое сохранение: стартовый костюм и первый мир', () => {
    const u = unlockedNow(base());
    expect(u.outfits).toEqual(['cyan']);
    expect(u.worlds).toEqual(['village']);
    expect(u.styles).toEqual([]);
  });
  it('костюмы по кристаллам, награды по звёздам, надетое и купленное', () => {
    const s = base(); s.skills = mastered(6); s.days = { '2026-10-01': { stars: { a: 3, b: 3 } } as any }; s.outfit = 'cyan'; s.style = { cape: 'cape_red' }; s.shipOwned = ['pet_cat'];
    const u = unlockedNow(s);
    expect(u.outfits).toEqual(expect.arrayContaining(['cyan', 'gold', 'pink']));
    expect(u.outfits).not.toContain('forest');
    expect(u.styles).toEqual(expect.arrayContaining(['trail_cyan', 'cape_red']));
    expect(u.owned).toEqual(['pet_cat']);
  });
  it('проваленная проверка сняла кристаллы — открытое остаётся', () => {
    const s = base(); s.skills = mastered(6);
    ensureLegacy(s, '2026-10-02');
    expect(legacyHas(s, 'outfits', 'pink')).toBe(true);
    s.skills = mastered(2);                       // кристаллы сняты
    expect(ensureLegacy(s, '2026-10-03')).toBe(false);
    expect(legacyHas(s, 'outfits', 'pink')).toBe(true);
    expect(s.prog!.legacy!.day).toBe('2026-10-02');
  });
  it('новое добавляется, старое не теряется, день — первого снимка', () => {
    const s = base(); s.skills = mastered(3); ensureLegacy(s, '2026-10-02');
    s.skills = mastered(10); s.worldsCleared = ['village'];
    expect(ensureLegacy(s, '2026-10-05')).toBe(true);
    const l = grownLegacy(s, '2026-10-06');
    expect(l.day).toBe('2026-10-02');
    expect(l.outfits).toEqual(expect.arrayContaining(['cyan', 'gold', 'pink', 'forest']));
    expect(l.cleared).toEqual(['village']);
  });
  it('мир, открытый энергией и боссом, попадает в снимок; арена — никогда', () => {
    const s = base(); s.skills = mastered(3); s.worldsCleared = ['village'];
    const u = unlockedNow(s);
    expect(u.worlds).toEqual(expect.arrayContaining(['village', 'jungle']));
    expect(u.worlds).not.toContain('arena');
  });
});
