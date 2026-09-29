import { describe, it, expect } from 'vitest';
import { solGap } from '../src/engine/solgap';

const r0 = () => 0;
describe('solGap — пропуск в решении', () => {
  it('закрывает промежуточный результат, а не выражение', () => {
    const g = solGap('63 : 7 = 9; 5 · 2 = 10; 9 + 10 = 19.', '19', r0)!;
    expect(g.answer).toBe('9');
    expect(g.before + '▢' + g.after).toBe('63 : 7 = ▢; 5 · 2 = 10; 9 + 10 = 19.');
    expect(new Set(g.options).size).toBe(3);
    expect(g.options).toContain('9');
  });
  it('не берёт «= 6 · 141» (это выражение)', () => {
    const g = solGap('849 = 6 · 141 + 3. Бөлінді 141, қалдық 3.', '141 (қалдық 3)', r0);
    expect(g).toBeNull();
  });
  it('десятичные с запятой и отрицательные — в том же формате', () => {
    const g = solGap('m + 70,5 = −25,8. Онда m = −25,8 − 70,5 = −96,3.', '−96,3', r0)!;
    expect(g.answer).toBe('−25,8');
    for (const o of g.options) expect(o).toMatch(/^−?\d+,\d$/);
  });
  it('коэффициент при букве не закрывается', () => {
    expect(solGap('C = 2πx = 6x. 48 < 6x < 60.', '8 < x < 10', r0)).toBeNull();
  });
  it('разбор по классам: закрыт средний класс, варианты — перестановки цифр', () => {
    const g = solGap('4 | 303 | 042 → 4 303 042.', '4 303 042', r0)!;
    expect(g.answer).toBe('303');
    expect(g.before + '▢' + g.after).toBe('4 | ▢ | 042 → 4 303 042.');
    for (const o of g.options) expect(o).toMatch(/^\d{3}$/);
    expect(new Set(g.options).size).toBe(3);
  });
  it('разряды с пробелами сохраняются', () => {
    const g = solGap('16 см × 40 000 000 = 640 000 000 см = 6400 км.', '6400', r0)!;
    expect(g.answer).toBe('640 000 000');
  });
  it('решение без вычислений — null (тогда работает зарядка кнопки)', () => {
    expect(solGap('Кесте сызып, әр шарт бойынша мүмкін емес ұяшықтарды сызамыз.', '2', r0)).toBeNull();
  });
});
