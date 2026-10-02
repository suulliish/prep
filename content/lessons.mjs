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
import { DECIMALS } from './lessons_decimals.mjs';

const RAW = {
  ...WEEK1,
  ...WEEK2,
  ...WEEK3,
  ...WEEK4,
  ...WEEK5,
  ...WEEK6,
  ...WEEK7,
  ...WEEK8,
  ...DECIMALS,
};

// Варианты ответов в контенте написаны «верный первым» (аудит 01.10: «Неге?» и финал — 36 из 36 на A, пропуски «Өзің» — 158 из 161).
// Ребёнок быстро выучивает «жми первый» и проходит урок, не понимая. Поэтому при сборке варианты перемешиваются:
// перестановка своя для каждого вопроса, но постоянная (зерно — тема + номер шага + номер пропуска), чтобы голос, тесты и повторы совпадали.
function seeded(key) {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) { h ^= key.charCodeAt(i); h = Math.imul(h, 16777619); }
  return () => { h = (h + 0x6d2b79f5) >>> 0; let t = h; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function shuffled(q, key) {
  if (!Array.isArray(q.choices) || typeof q.answer !== 'number' || q.choices.length < 2) return q;
  const rnd = seeded(key), idx = q.choices.map((_, k) => k);
  for (let k = idx.length - 1; k > 0; k--) { const j = Math.floor(rnd() * (k + 1)); [idx[k], idx[j]] = [idx[j], idx[k]]; }
  return { ...q, choices: idx.map(k => q.choices[k]), answer: idx.indexOf(q.answer) };
}
export const LESSONS = Object.fromEntries(Object.entries(RAW).map(([skill, steps]) => [skill, steps.map((st, i) => {
  if (['why', 'final', 'predict', 'quiz'].includes(st.type)) return shuffled(st, `${skill}:${i}`);
  if (st.type === 'faded' && Array.isArray(st.steps)) return { ...st, steps: st.steps.map((x, k) => (x.blank ? { ...x, blank: shuffled(x.blank, `${skill}:${i}:${k}`) } : x)) };
  return st;
})]));
