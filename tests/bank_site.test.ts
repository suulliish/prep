import { describe, it, expect } from 'vitest';
// @ts-ignore — node-типы в проект не подключены
import { existsSync } from 'node:fs';
import { readyItems, bankItems, bankFigure, bankFor, bankToItem, BANK_SKILLS } from '../src/engine/bank';
// @ts-ignore
import { FIGURES_SVG } from '../content/figures_svg.mjs';

describe('банк на сайте', () => {
  it('готовые задачи: ответ в пределах вариантов, казахское условие, рисунок есть или не нужен', () => {
    expect(readyItems.length).toBeGreaterThan(100);
    for (const it of readyItems) {
      expect(it.answer).toBeGreaterThanOrEqual(0); expect(it.answer).toBeLessThan(it.choices.length);
      expect(it.stem.kz).toBeTruthy();
      const f = bankFigure(it);
      expect(f, it.id).not.toBe(undefined);
      if (f?.kind === 'png') expect(existsSync('public/' + f.src), f.src).toBe(true);
    }
  });
  it('все рисунки из PDF и SVG принадлежат задачам с рисунком', () => {
    for (const id of Object.keys(FIGURES_SVG)) expect(bankItems.find(i => i.id === id)?.figure, id).toBeTruthy();
  });
  it('в бои идут только задачи практики (Дарын 2023) по пройденным темам; 2025 не трогаем', () => {
    const all = bankFor(() => true, new Set());
    expect(all.length).toBeGreaterThan(40);
    expect(all.every(i => i.pool === 'practice')).toBe(true);
    const some = bankFor(id => id.startsWith('div.') || id.startsWith('nat.'), new Set());
    expect(some.every(i => BANK_SKILLS[i.id].every(s => s.startsWith('div.') || s.startsWith('nat.')))).toBe(true);
    expect(bankFor(() => false, new Set())).toEqual([]);
  });
  it('у задач практики есть казахское решение', () => {
    for (const it of bankFor(() => true, new Set())) expect(bankToItem(it).sol.kz, it.id).toMatch(/[әіңғүұқөһ]|[=→]/);
  });
  it('невиданные задачи идут первыми', () => {
    const all = bankFor(() => true, new Set()); const seen = new Set([all[0].id]);
    expect(bankFor(() => true, seen)[0].id).not.toBe(all[0].id);
  });
});
