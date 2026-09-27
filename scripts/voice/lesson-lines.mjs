// Собирает реплики Бита из уроков (шаги say и goal) для озвучки: числа и знаки → слова.
// node scripts/voice/lesson-lines.mjs > lines.json && python3 scripts/voice/make_voice.py lines.json public/voice/lessons
// Затем список id записывается в content/voice_lessons.json (плеер урока озвучивает только их).
import { LESSONS } from '../../content/lessons.mjs';
import { kzWords } from '../../content/templates/lib.mjs';

export function speakable(t) {
  return t
    .replace(/(\d)[ ](?=\d{3}\b)/g, '$1')                   // 7 245 → 7245
    .replace(/(\d+)([²³])/g, (_, a, p) => `${a} ${p === '²' ? 'квадрат' : 'куб'}`)
    .replace(/(\d+)-(?=[а-яәіңғүұқөһ])/g, d => kzWords(parseInt(d)))   // 1-ге → бірге
    .replace(/\d+/g, d => kzWords(+d))
    .replace(/\s·\s/g, ' көбейту ').replace(/\s:\s/g, ' бөлу ').replace(/\s−\s/g, ' минус ')
    .replace(/\s\+\s/g, ' қосу ').replace(/\s=\s/g, ' тең ').replace(/\s*=\s*\?/g, ' неше болады?')
    .replace(/[«»]/g, '').replace(/\s+/g, ' ').trim();
}

const only = process.argv[2];
const lines = [];
for (const [skill, steps] of Object.entries(LESSONS)) {
  if (only && !skill.startsWith(only)) continue;
  steps.forEach((s, i) => { if (s.type === 'say' || s.type === 'goal') lines.push({ id: `${skill}_${i}`, kz: speakable(s.kz) }); });
}
console.log(JSON.stringify(lines, null, 1));
