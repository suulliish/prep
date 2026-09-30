// Уроки-миссии октября (казахский — черновик, нужна проверка носителем).
// Недели 1–8 — полные уроки по сценарию ARCHITECTURE 4.6 (content/lessons_week1–8.mjs).
// Остальные пока короткие: say — реплика Бита; widget — манипулятив; example — разбор по кадрам;
// quiz — вопрос с объяснением. Их перепишем по тому же сценарию во 2-ю неделю.
import { WEEK1 } from './lessons_week1.mjs';
import { WEEK2 } from './lessons_week2.mjs';
import { WEEK3 } from './lessons_week3.mjs';
import { WEEK4 } from './lessons_week4.mjs';
import { WEEK5 } from './lessons_week5.mjs';
import { WEEK6 } from './lessons_week6.mjs';
import { WEEK7 } from './lessons_week7.mjs';
import { WEEK8 } from './lessons_week8.mjs';

export const LESSONS = {
  ...WEEK1,
  ...WEEK2,
  ...WEEK3,
  ...WEEK4,
  ...WEEK5,
  ...WEEK6,
  ...WEEK7,
  ...WEEK8,
};
