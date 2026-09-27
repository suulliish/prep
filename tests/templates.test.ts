import { describe, it, expect } from 'vitest';
// @ts-ignore — шаблоны написаны на JS
import { templates } from '../content/templates/index.mjs';
// @ts-ignore
import { rng } from '../content/templates/lib.mjs';

describe('шаблоны задач', () => {
  for (const t of templates as any[]) {
    it(t.id, () => {
      const r = rng(7);
      for (let i = 0; i < 200; i++) {
        const it = t.gen(r);
        expect(it.choices).toHaveLength(5);
        expect(new Set(it.choices.map((c: any) => c.text)).size).toBe(5);
        expect(it.choices[it.answer].tag).toBe('correct');
        expect(it.kz.length).toBeGreaterThan(5);
        expect(JSON.stringify(it)).not.toMatch(/NaN|undefined/);
      }
    });
  }
});
