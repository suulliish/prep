// Собирает реплики Бита из уроков (шаги say и goal) для озвучки: числа и знаки → слова.
// node scripts/voice/lesson-lines.mjs > lines.json && python3 scripts/voice/make_voice.py lines.json public/voice/lessons
// Затем список id записывается в content/voice_lessons.json (плеер урока озвучивает только их).
import { LESSONS } from '../../content/lessons.mjs';
import { kzWords } from '../../content/templates/lib.mjs';

function ordinal(n) {
  const w = kzWords(n), back = /[аоұы][^аәеиоөұүыіуэ]*$/.test(w.replace(/[иу]/g, ''));
  return /[аәеиоөұүыіуэ]$/.test(w) ? w + (back ? 'ншы' : 'нші') : w + (back ? 'ыншы' : 'інші');
}
export function speakable(t) {
  return t
    .replace(/ЕҮОБ/g, 'ең үлкен ортақ бөлгіш').replace(/ЕКОЕ/g, 'ең кіші ортақ еселік')
    .replace(/(\d+) с(?![а-яәіңғүұқөһ])/g, '$1 секунд').replace(/\(?[∩]\)?/g, ' қиылысу ').replace(/\(?[∪]\)?/g, ' бірігу ').replace(/\|/g, ' ')
    .replace(/([МӨС])\+([МӨС])/g, '$1 мен $2').replace(/\s>\s/g, ' үлкен ').replace(/\s<\s/g, ' кіші ')
    .replace(/(\d)[ ](?=\d{3}\b)/g, '$1')                   // 7 245 → 7245
    .replace(/(\d+)([²³])/g, (_, a, p) => `${a} ${p === '²' ? 'квадрат' : 'куб'}`)
    .replace(/(\d+)([⁰¹⁴⁵⁶⁷⁸⁹ⁿ]+)/g, (_, a, p) => `${a} дәреже ${p === 'ⁿ' ? 'эн' : [...p].map(c => '⁰¹²³⁴⁵⁶⁷⁸⁹'.indexOf(c)).join('')}`)
    .replace(/→/g, ', ').replace(/≠/g, ' тең емес ').replace(/✔|✘|★/g, '').replace(/÷/g, 'бөлу ').replace(/\*/g, ' жұлдызша ')
    .replace(/\b0\d+\b/g, d => [...d].map(c => kzWords(+c)).join(' '))   // 005 → нөл нөл бес
    .replace(/(\d+)-(ге|ке|ға|қа|нің|тің|дің|ның|дың|тың|ден|тен|нан|тан|дан|нен|де|те|да|та|ді|ті|ны|ні|ды|ты|ге|ке)(?![а-яәіңғүұқөһ])/g, (_, d, suf) => kzWords(+d) + suf) // 1-ге → бірге
    .replace(/(\d+)-(?=[а-яәіңғүұқөһ])/g, (_, d) => ordinal(+d) + ' ')   // 1-қадам → бірінші қадам
    .replace(/\d+/g, d => kzWords(+d))
    .replace(/\s·\s/g, ' көбейту ').replace(/\s:\s/g, ' бөлу ').replace(/\s−\s/g, ' минус ')
    .replace(/\s\+\s/g, ' қосу ').replace(/\s=\s/g, ' тең ').replace(/\s*=\s*\?/g, ' неше болады?')
    .replace(/[«»]/g, '').replace(/\s+/g, ' ').trim();
}

const only = process.argv[2];
const lines = [];
for (const [skill, steps] of Object.entries(LESSONS)) {
  if (only && !skill.startsWith(only)) continue;
  steps.forEach((s, i) => {
    if (['say', 'goal', 'widget'].includes(s.type)) lines.push({ id: `${skill}_${i}`, kz: speakable(s.kz) });
    // разбор «Көр»: каждый кадр — анимация + голос (принцип модальности Майера)
    if (s.type === 'example' && s.frames.some(f => f.s)) s.frames.forEach((f, k) => lines.push({ id: `${skill}_${i}_f${k}`, kz: speakable(f.kz) }));
  });
}
console.log(JSON.stringify(lines, null, 1));
