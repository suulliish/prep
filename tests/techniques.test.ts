// Приёмы (content/techniques.mjs): у каждой темы с уроком есть свой приём, названия и цвета на месте, без повторов.
import { describe, it, expect } from 'vitest';
// @ts-ignore — модуль .mjs без типов
import { TECHNIQUES, techniqueOf } from '../content/techniques.mjs';
// @ts-ignore
import { LESSONS } from '../content/lessons.mjs';

describe('приёмы', () => {
  it('у каждой темы с уроком — приём, и лишних нет', () => {
    const withLesson = Object.keys(LESSONS).sort(), have = TECHNIQUES.map((t: any) => t.skill).sort();
    expect(have).toEqual(withLesson);
  });
  it('названия непустые и не повторяются, цвет и вид удара заданы', () => {
    const names = TECHNIQUES.map((t: any) => t.kz);
    expect(new Set(names).size).toBe(names.length);
    for (const t of TECHNIQUES as any[]) {
      expect(t.kz.length).toBeGreaterThan(3); expect(t.ru.length).toBeGreaterThan(3);
      expect(['arc', 'pierce', 'split', 'multi', 'spin']).toContain(t.fx);
      expect(t.color).toBeGreaterThan(0);
      expect(t.kz).not.toMatch(/—/);
    }
    expect(techniqueOf('frac.reduce')?.kz).toBe('Қысқарту соққысы'); expect(techniqueOf('нет')).toBeNull();
  });
});
