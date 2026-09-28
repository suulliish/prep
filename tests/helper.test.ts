import { describe, it, expect } from 'vitest';
import { payload } from '../src/engine/helperPayload';
import { makeItem } from '../src/engine/items';

describe('ИИ-помощник: тело запроса', () => {
  const item = makeItem('nat.ops')!;
  it('передаёт правильный ответ, посчитанный кодом, и выбор ученика', () => {
    const wrong = (item.answer + 1) % item.choices.length;
    const b = payload({ item, picked: wrong }, []);
    expect(b.task.correct).toBe(item.choices[item.answer].text);
    expect(b.task.picked).toBe(item.choices[wrong].text);
    expect(b.task.pickedCorrect).toBe(false);
    expect(b.task.solution).toBe(item.sol.kz);
    expect(b.question).toBeUndefined();
  });
  it('пустой вопрос не отправляется, история сохраняет роли', () => {
    const b = payload({ item, picked: item.answer }, [{ role: 'bit', text: 'x' }, { role: 'kid', text: 'y' }], '   ');
    expect(b.question).toBeUndefined();
    expect(b.history.map(t => t.role)).toEqual(['bit', 'kid']);
    expect(b.task.pickedCorrect).toBe(true);
  });
});
