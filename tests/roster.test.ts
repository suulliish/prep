import { describe, it, expect } from 'vitest';
import { ROSTER, nextMob, pickEnemy } from '../src/three/roster';

describe('каждый раз новый монстр', () => {
  it('подряд один и тот же моб не выходит, за цикл выходят все монстры мира', () => {
    for (const [w, r] of ROSTER.entries()) {
      const seq = Array.from({ length: r.mobs.length * 6 }, () => nextMob(100 + w, r.mobs));
      for (let i = 1; i < seq.length; i++) expect(seq[i], `мир ${w}, шаг ${i}`).not.toBe(seq[i - 1]);
      for (let c = 0; c < 6; c++) expect(new Set(seq.slice(c * r.mobs.length, (c + 1) * r.mobs.length)).size).toBe(r.mobs.length);
    }
  });
  it('в каждом мире не меньше 5 видов обычных монстров', () => {
    for (const [w, r] of ROSTER.entries()) expect(new Set(r.mobs).size, `мир ${w}`).toBeGreaterThanOrEqual(5);
  });
  it('боссы не меняются', () => {
    expect(pickEnemy(0, 0, false, true).id).toBe(ROSTER[0].boss);
    expect(pickEnemy(0, 0, true, false).id).toBe(ROSTER[0].mini);
  });
});
