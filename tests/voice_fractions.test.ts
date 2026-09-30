import { describe, it, expect } from 'vitest';
// @ts-ignore — скрипт на JS
import { fractionKz, speakFractions, speakable } from '../scripts/voice/lesson-lines.mjs';

describe('озвучка дробей: a/b → «b-ден a»', () => {
  const cases: [number, number, string][] = [
    [3, 4, 'төрттен үш'], [5, 8, 'сегізден бес'], [2, 3, 'үштен екі'], [4, 5, 'бестен төрт'], [1, 6, 'алтыдан бір'],
    [2, 7, 'жетіден екі'], [4, 9, 'тоғыздан төрт'], [1, 10, 'оннан бір'], [7, 12, 'он екіден жеті'],
    [9, 20, 'жиырмадан тоғыз'], [3, 30, 'отыздан үш'], [7, 40, 'қырықтан жеті'], [1, 100, 'жүзден бір'], [1, 1000, 'мыңнан бір'],
    [10, 11, 'он бірден он'],
  ];
  for (const [a, b, want] of cases) it(`${a}/${b}`, () => expect(fractionKz(a, b, { half: false })).toBe(want));

  it('1/2 отдельно — «жарты», с половиной=false — «екіден бір»', () => {
    expect(fractionKz(1, 2)).toBe('жарты');
    expect(fractionKz(1, 2, { half: false })).toBe('екіден бір');
    expect(fractionKz(3, 2)).toBe('екіден үш');
  });
  it('в тексте', () => {
    expect(speakFractions('Жауабы: 3/4.')).toBe('Жауабы: төрттен үш.');
    expect(speakFractions('1/2 санынан үлкен')).toBe('жарты санынан үлкен');
    expect(speakFractions('1/3 + 1/6')).toBe('үштен бір + алтыдан бір');
  });
  it('смешанные числа: «2 3/4» → «екі бүтін төрттен үш»', () => {
    expect(speakFractions('2 3/4')).toBe('екі бүтін төрттен үш');
    expect(speakFractions('1 1/2')).toBe('бір бүтін екіден бір');
    expect(speakFractions('12 5/8')).toBe('он екі бүтін сегізден бес');
  });
  it('суффикс после дроби переходит на числитель', () => {
    expect(speakFractions('3/4-ті')).toBe('төрттен үшті');
    expect(speakFractions('1/2-ден')).toBe('екіден бірден');
  });
  it('обычные числа и даты не задеты; speakable заменяет все цифры дробей', () => {
    expect(speakFractions('7 245 + 5')).toBe('7 245 + 5');
    const t = speakable('3/4 + 2 1/2 = 3 1/4');
    expect(t).not.toMatch(/\d|\//);
    expect(t).toBe('төрттен үш қосу екі бүтін екіден бір тең үш бүтін төрттен бір');
  });
});
