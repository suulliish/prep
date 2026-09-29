import { describe, it, expect } from 'vitest';
import { spotIndex, spotTime, spotLight, VARIANTS } from '../src/three/spots';
import { LAYOUT_ROLES } from '../src/three/island3d';
import { VILLAGE } from '../src/three/worlds3d';

describe('spots', () => {
  it('spotIndex стабилен и в диапазоне', () => {
    for (const s of ['', 'a', 'add-10', 'topic-42', 'Ұзындық']) { const i = spotIndex(s); expect(i).toBe(spotIndex(s)); expect(i).toBeGreaterThanOrEqual(0); expect(i).toBeLessThan(VARIANTS); }
  });
  it('свет и время', () => {
    for (let v = 0; v < VARIANTS; v++) { expect(spotTime(v)).toBe(v % 3); expect(spotLight(v).lanterns).toBe(v % 3 === 2); }
  });
  it('раскладок ровно столько же, сколько уголков, и запасная палитра закрывает все их роли', () => {
    expect(LAYOUT_ROLES.length).toBe(VARIANTS);
    for (const roles of LAYOUT_ROLES) for (const r of roles) expect(VILLAGE.roles[r]?.length, r).toBeGreaterThan(0);
  });
});
