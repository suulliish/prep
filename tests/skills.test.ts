import { describe, it, expect } from 'vitest';
// @ts-ignore
import { skills, skillById } from '../content/skills.mjs';
// @ts-ignore
import { templates } from '../content/templates/index.mjs';

const S = skills as any[];

describe('граф навыков', () => {
  it('id уникальны', () => expect(new Set(S.map(s => s.id)).size).toBe(S.length));
  it('все предпосылки существуют', () => {
    for (const s of S) for (const p of s.prereqs) expect(skillById[p], `${s.id} → ${p}`).toBeTruthy();
  });
  it('нет циклов', () => {
    const state: Record<string, number> = {};
    const visit = (id: string, path: string[]): void => {
      if (state[id] === 2) return;
      if (state[id] === 1) throw new Error('цикл: ' + [...path, id].join(' → '));
      state[id] = 1;
      for (const p of skillById[id].prereqs) visit(p, [...path, id]);
      state[id] = 2;
    };
    for (const s of S) visit(s.id, []);
  });
  it('генераторы из навыков существуют, и каждый генератор привязан к навыку', () => {
    const ids = new Set((templates as any[]).map(t => t.id));
    const used = new Set(S.flatMap(s => s.templates));
    for (const t of used) expect(ids.has(t), t).toBe(true);
    for (const t of ids) expect(used.has(t), `генератор ${t} не привязан к навыку`).toBe(true);
  });
  it('у каждой категории A–K есть навыки', () => {
    for (const c of 'ABCDEFGHIJK') expect(S.some(s => s.cat === c), c).toBe(true);
  });
});
