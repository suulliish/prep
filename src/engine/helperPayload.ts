// Тело запроса к ИИ-помощнику (helper/): чистая функция, чтобы проверять тестами.
import type { Item } from './items';

export interface Turn { role: 'kid' | 'bit'; text: string }
export interface TaskContext { item: Item; picked: number | null; mistake?: string; rule?: string }

/** Тело запроса: всё, что Бит должен знать о задаче (правильный ответ посчитан кодом). */
export function payload(c: TaskContext, history: Turn[], question?: string) {
  const { item, picked } = c;
  return {
    task: {
      text: item.kz,
      choices: item.choices.map(x => x.text),
      correct: item.choices[item.answer].text,
      picked: picked == null ? null : item.choices[picked].text,
      pickedCorrect: picked === item.answer,
      mistake: c.mistake,
      solution: item.sol.kz,
      rule: c.rule,
    },
    history: history.map(t => ({ role: t.role, text: t.text })),
    question: question?.trim() || undefined,
  };
}

