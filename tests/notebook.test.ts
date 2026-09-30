import { describe, it, expect } from 'vitest';
import { checkExpr, checkExample, exampleSpec, checkDivisible, checkPrime, checkFactor, fieldsFor, fmtQ } from '../src/lesson/notebook';
// @ts-ignore
import { LESSONS } from '../content/lessons.mjs';

describe('Дәптер: «Менің мысалым» проверяется вычислением', () => {
  it('целые числа и порядок действий', () => {
    expect(checkExpr('3 + 4 · 2 = 11').ok).toBe(true);
    expect(checkExpr('3 + 4 * 2 = 14').ok).toBe(false);
    expect(checkExpr('(3 + 4) · 2 = 14').ok).toBe(true);
    expect(checkExpr('6 + 18 : 3 − 1 = 11').ok).toBe(true);
    expect(checkExpr('58 = 9 · 6 + 4').ok).toBe(true);
    expect(checkExpr('58 = 9 · 6 + 5').ok).toBe(false);
  });
  it('дроби и смешанные числа', () => {
    expect(checkExpr('1/2 + 1/3 = 5/6').ok).toBe(true);
    expect(checkExpr('1/2 + 1/3 = 2/5').ok).toBe(false);
    expect(checkExpr('6/9 = 2/3').ok).toBe(true);
    expect(checkExpr('1/2 : 1/4 = 2').ok).toBe(true);
    expect(checkExpr('2/3 · 12 = 8').ok).toBe(true);
    expect(checkExpr('8 : 2/3 = 12').ok).toBe(true);
    expect(checkExpr('1 1/2 + 2 1/3 = 3 5/6').ok).toBe(true);
    expect(checkExpr('1 1/2 + 2 1/3 = 3 1/6').ok).toBe(false);
    expect(checkExpr('5/6 > 7/9').ok).toBe(true);
    expect(checkExpr('5/6 < 7/9').ok).toBe(false);
    expect(checkExpr('1/2 = 3/6 = 4/8').ok).toBe(true);
  });
  it('неверное показывает, что на самом деле получилось слева и справа', () => {
    const r = checkExpr('3 + 4 * 2 = 14');
    expect(r.say).toContain('11');
    expect(r.say).toContain('14');
    expect(fmtQ({ n: 19, d: 12 })).toBe('1 7/12');
  });
  it('нечитаемое или без знака сравнения: проверить нельзя (null), без падения', () => {
    expect(checkExpr('').ok).toBeNull();
    expect(checkExpr('3 + 4').ok).toBeNull();
    expect(checkExpr('abc = 3').ok).toBeNull();
    expect(checkExpr('3 + = 3').ok).toBeNull();
    expect(checkExpr('1/0 = 3').ok).toBeNull();
    expect(checkExpr('((3 + 4 = 7').ok).toBeNull();
    expect(checkExpr('2 +* 3 = 5').ok).toBeNull();
  });
  it('бөлінгіштік, жай сан, жіктеу', () => {
    expect(checkDivisible('252', 9).ok).toBe(true);
    expect(checkDivisible('1 236', 9).ok).toBe(false);
    expect(checkDivisible('1236', 9).ok).toBe(false);
    expect(checkDivisible('abc', 9).ok).toBeNull();
    expect(checkPrime('31').ok).toBe(true);
    expect(checkPrime('57').ok).toBe(false);
    expect(checkPrime('57').say).toContain('3 · 19');
    expect(checkPrime('1').ok).toBe(false);
    // задание «30-дан үлкен»: жай, бірақ 30 және одан кіші — қабылданбайды
    expect(checkPrime('2').ok).toBe(false);
    expect(checkPrime('2').say).toContain('30-дан үлкен');
    expect(checkPrime('29').ok).toBe(false);
    expect(checkPrime('30').ok).toBe(false);
    expect(checkPrime('31').ok).toBe(true);
    expect(checkPrime('97').ok).toBe(true);
    expect(checkPrime('91').say).toContain('7 · 13');
    expect(exampleSpec('div.primes')?.ask).toContain('30-дан үлкен');
    expect(checkFactor('60 = 2 · 2 · 3 · 5').ok).toBe(true);
    expect(checkFactor('100 = 2 · 2 · 25').ok).toBe(false);
    expect(checkFactor('100 = 2 · 2 · 5').ok).toBe(false);
    expect(checkFactor('100 = 2² · 5²').ok).toBeNull();
    expect(checkFactor('60').ok).toBeNull();
  });
  it('какие темы проверяются; у остальных пример просто сохраняется', () => {
    expect(exampleSpec('frac.add_sub')?.kind).toBe('expr');
    expect(exampleSpec('div.rules')?.kind).toBe('div9');
    expect(exampleSpec('div.primes')?.kind).toBe('prime');
    expect(exampleSpec('div.factorization')?.kind).toBe('factor');
    expect(exampleSpec('logic.weighing')).toBeNull();
    expect(checkExample('logic.weighing', '3 гиря').ok).toBeNull();
    expect(checkExample('frac.add_sub', '1/4 + 1/4 = 1/2').ok).toBe(true);
  });
  it('образец в поле у каждой проверяемой темы сам проходит проверку', () => {
    for (const id of Object.keys(LESSONS)) {
      const sp = exampleSpec(id);
      if (sp) expect(checkExample(id, sp.ph).ok, id).toBe(true);
    }
  });
  it('поля карточки у каждой темы: скелет, правило, ловушка Глитча с разбором', () => {
    for (const id of Object.keys(LESSONS)) {
      const f = fieldsFor(id)!;
      expect(f, id).not.toBeNull();
      expect(f.skeleton.endsWith('…')).toBe(true);
      expect(f.ruleLines.length).toBeGreaterThan(0);
      expect(f.trap?.bad, id).toBeTruthy();
      expect(f.trap?.fix, id).toBeTruthy();
    }
  });
});
