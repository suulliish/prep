import { describe, it, expect } from 'vitest';
import { readMs } from '../src/lib/readgate.svelte';

describe('readMs — время чтения разбора', () => {
  it('короткий текст — не меньше 2,5 с', () => expect(readMs('Дұрыс!')).toBe(2500));
  it('растёт со словами, знаки операций не считаются (6 чисел + 5 слов)', () => expect(readMs('7 · 8 = 56; 36 + 56 = 92. Алдымен көбейту, сосын қосу керек.')).toBe(11 * 500));
  it('длинный текст — не больше 18 с', () => expect(readMs('сөз '.repeat(100))).toBe(18000));
  it('пустые части пропускаются', () => expect(readMs(undefined, '', 'бір екі')).toBe(2500));
});
