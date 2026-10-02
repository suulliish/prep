import { describe, it, expect } from 'vitest';
import { mergeAttempts, isBlank, chooseSide } from '../src/engine/sync';
import type { Attempt } from '../src/engine/types';

const att = (at: number, skill = 'a', source = 't'): Attempt => ({ at, day: '2026-10-01', skill, source, correct: true, hintLevel: 0, honest: true, timeMs: 1, mode: 'practice' });

describe('Слияние устройства и облака (src/engine/sync.ts)', () => {
  it('ответы объединяются без повторов и по времени', () => {
    expect(mergeAttempts([att(3), att(1)], [att(1), att(2), att(1, 'b')]).map(a => `${a.at}${a.skill}`)).toEqual(['1a', '1b', '2a', '3a']);
  });
  it('пустое сохранение — ни ответов, ни диагностики, ни опыта', () => {
    expect(isBlank({ attempts: [], diagnosticDone: false, xp: 0 })).toBe(true);
    expect(isBlank({ attempts: [att(1)], diagnosticDone: false, xp: 0 })).toBe(false);
    expect(isBlank({ attempts: [], diagnosticDone: true, xp: 0 })).toBe(false);
    expect(isBlank({ attempts: [], diagnosticDone: false, xp: 10 })).toBe(false);
  });
  it('пустая сторона не побеждает, даже если «новее»; иначе — у кого updatedAt больше', () => {
    expect(chooseSide({ at: 999, blank: true }, { at: 1, blank: false })).toBe('remote');
    expect(chooseSide({ at: 1, blank: false }, { at: 999, blank: true })).toBe('local');
    expect(chooseSide({ at: 5, blank: false }, { at: 9, blank: false })).toBe('remote');
    expect(chooseSide({ at: 9, blank: false }, { at: 5, blank: false })).toBe('local');
    expect(chooseSide({ at: 5, blank: true }, { at: 5, blank: true })).toBe('same');
  });
});
