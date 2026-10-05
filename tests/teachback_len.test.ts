import { describe, it, expect } from 'vitest';
import { TEACHBACK_BANK } from '../src/lesson/teachback_bank';
import { menuCards } from '../src/lesson/teachback';

// Длины трёх карточек меню «Биткә түсіндір» не должны выдавать верный ответ (ребёнок не угадывает по длине).
const skills = Object.keys(TEACHBACK_BANK);
const len = (s: string) => {
  const e = TEACHBACK_BANK[s];
  return { good: e.good.length, typical: e.typical.length, surface: (e.surface ?? '').length };
};

describe('«Биткә түсіндір»: длина карточек не выдаёт верную', () => {
  it('у каждой из 46 тем есть свой surface', () => {
    expect(skills).toHaveLength(46);
    for (const s of skills) expect(TEACHBACK_BANK[s].surface, s).toBeTruthy();
  });

  it('good, typical и surface в пределах ±20% от среднего трёх', () => {
    for (const s of skills) {
      const l = len(s), mean = (l.good + l.typical + l.surface) / 3;
      for (const [k, v] of Object.entries(l)) {
        expect(Math.abs(v - mean) / mean, `${s}: ${k}=${v}, среднее ${mean.toFixed(1)}`).toBeLessThanOrEqual(0.2);
      }
    }
  });

  it('good не самый длинный и не самый короткий больше чем в половине тем', () => {
    let longest = 0, shortest = 0;
    for (const s of skills) {
      const { good, typical, surface } = len(s);
      if (good > typical && good > surface) longest++;
      if (good < typical && good < surface) shortest++;
    }
    expect(longest / skills.length, `самый длинный: ${longest}`).toBeLessThanOrEqual(0.5);
    expect(shortest / skills.length, `самый короткий: ${shortest}`).toBeLessThanOrEqual(0.5);
  });

  it('surface по теме: есть «Ережеде» и конкретика (цифра или символ), не общая фраза', () => {
    for (const s of skills) {
      const t = TEACHBACK_BANK[s].surface!;
      expect(t, s).toMatch(/^Ережеде /);
      expect(t, s).toMatch(/\d|[∩∪]/);
    }
  });

  it('в новых строках нет длинного тире', () => {
    for (const s of skills) {
      const e = TEACHBACK_BANK[s];
      expect(e.typical + e.surface, s).not.toContain('—');
    }
  });

  it('позиция верной карточки разная: все три места встречаются, ни одно не занимает больше половины тем', () => {
    const count = [0, 0, 0];
    for (const s of skills) count[menuCards(s)!.findIndex(c => c.kind === 'good')]++;
    expect(count.every(n => n > 0), `позиции: ${count}`).toBe(true);
    expect(Math.max(...count) / skills.length, `позиции: ${count}`).toBeLessThanOrEqual(0.5);
  });
});
