import { describe, it, expect } from 'vitest';
import bank from '../content/bank.json';
// @ts-ignore
import { templates } from '../content/templates/index.mjs';

const items = (bank as any).items as any[];

describe('банк задач', () => {
  it('годные задачи: 5 вариантов, ответ среди них, проверенный ответ', () => {
    for (const i of items.filter(i => i.usable)) {
      expect(i.choices, i.id).toHaveLength(5);
      expect(i.answer, i.id).toBeGreaterThanOrEqual(0);
      expect(['code', 'manual', 'key']).toContain(i.verification);
    }
  });
  it('спорные и нечитаемые задачи не допускаются к ученику', () => {
    for (const i of items.filter(i => ['disputed', 'unreadable', 'unverified'].includes(i.verification))) expect(i.usable, i.id).toBe(false);
  });
  it('«Дарын» 2025 — только holdout (честный пробник)', () => {
    for (const i of items.filter(i => i.source === 'daryn2025')) expect(i.pool).toBe('holdout');
  });
  it('генераторы не копируют задачи holdout', () => {
    for (const t of templates as any[]) for (const f of t.from) expect(f.startsWith('daryn2025'), t.id).toBe(false);
  });
});
