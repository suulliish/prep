// Уроки-миссии октября (казахский — черновик, нужна проверка носителем).
// Недели 1–4 — полные уроки по сценарию ARCHITECTURE 4.6 (content/lessons_week1–4.mjs).
// Остальные пока короткие: say — реплика Бита; widget — манипулятив; example — разбор по кадрам;
// quiz — вопрос с объяснением. Их перепишем по тому же сценарию во 2-ю неделю.
import { WEEK1 } from './lessons_week1.mjs';
import { WEEK2 } from './lessons_week2.mjs';
import { WEEK3 } from './lessons_week3.mjs';
import { WEEK4 } from './lessons_week4.mjs';

export const LESSONS = {
  ...WEEK1,
  ...WEEK2,
  ...WEEK3,
  ...WEEK4,
};
