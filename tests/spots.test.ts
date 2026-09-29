import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { buildSpot, spotIndex, spotTime, spotLight, VARIANTS } from '../src/three/spots';

describe('spots', () => {
  it('spotIndex стабилен и в диапазоне', () => {
    for (const s of ['', 'a', 'add-10', 'topic-42', 'Ұзындық']) { const i = spotIndex(s); expect(i).toBe(spotIndex(s)); expect(i).toBeGreaterThanOrEqual(0); expect(i).toBeLessThan(VARIANTS); }
  });
  it('свет и время', () => {
    for (let v = 0; v < VARIANTS; v++) { expect(spotTime(v)).toBe(v % 3); expect(spotLight(v).lanterns).toBe(v % 3 === 2); }
  });
  it('buildSpot строит все варианты для всех миров', () => {
    for (let k = 0; k <= 11; k++) for (let v = 0; v < VARIANTS; v++) { const g = new THREE.Group(); buildSpot(g, k, 0x55aaff, 0xffaa55, v); expect(g.children.length).toBeGreaterThan(1); }
  });
});
