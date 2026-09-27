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

import { HINT_KEYS } from '../content/hint_keys.mjs';
import { derivedHints } from '../src/engine/items';
describe('подсказки без утечки ответа', () => {
  it('у каждого шаблона без hints есть вопрос и ключевая идея', () => {
    const r = rng(9);
    const missing = (templates as any[]).filter(t => !t.gen(r).hints && !(HINT_KEYS as any)[t.id]).map(t => t.id);
    expect(missing).toEqual([]);
  });
  it('ступень 3 (первый шаг из разбора) не содержит верного ответа', () => {
    const r = rng(21), n = (x: string) => x.replace(/\s+/g, '').toLowerCase();
    for (const t of templates as any[]) for (let k = 0; k < 20; k++) {
      const it = t.gen(r); if (it.hints) continue;
      const ans = it.choices[it.answer].text;
      const h = derivedHints(it.sol, t.id, ans)[2]; expect(n(h.kz).includes(n(ans)) && n(ans).length > 1, `${t.id}: ${h.kz} / ${ans}`).toBe(false);
    }
  });
});
