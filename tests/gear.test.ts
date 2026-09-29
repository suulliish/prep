import { describe, it, expect } from 'vitest';
import { makeHero } from '../src/three/characters';
import { equip, GEAR } from '../src/three/gear';
import { OUTFITS } from '../content/worlds.mjs';

const count = (h: ReturnType<typeof makeHero>) => { let n = 0; h.g.traverse(() => n++); return n; };
const colors = { jacket: 0x22b8cc, dark: 0x137e8f, visor: 0x3ff0ff };

describe('скины (gear)', () => {
  it('у каждого костюма есть экипировка', () => { for (const o of OUTFITS) expect(GEAR[o.id], o.id).toBeTruthy(); });
  it('смена костюма не накапливает предметы на герое', () => {
    const h = makeHero();
    equip(h, GEAR.crystal, colors); const once = count(h);
    for (const o of OUTFITS) equip(h, GEAR[o.id], colors);
    equip(h, GEAR.crystal, colors);
    expect(count(h)).toBe(once);
  });
  it('оружие светится своим материалом, штатный меч спрятан', () => {
    const h = makeHero(), a = equip(h, GEAR.gold, colors), b = equip(h, GEAR.lava, colors);
    expect(a.blade.material).not.toBe(b.blade.material);
    expect(h.armR.children.filter(c => c.type === 'Group' && c.name !== 'gear').every(c => !c.visible)).toBe(true);
  });
});
