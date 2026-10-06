// Собирает реплики Бита из уроков для озвучки: числа и знаки → слова.
// Шаги и id (плеер: `${skill}_${i}` + суффикс):
//   say / goal / widget / faded / bug             `_i`            текст шага (faded: задача, bug: вводная)
//   example                                       `_i_f<k>`       кадр k (играет после решения пропуска в подписи)
//   rule                                          `_i`            «Есте сақта»; у правила с пропуском — версия БЕЗ ответа («белгісіз сан»)
//                                                 `_i_full`       полная версия, когда пропуск решён (есть только у правил с пропуском)
//   why / final                                   `_i`            вопрос;  `_i_why` — разбор после ответа (final: после победы)
//   predict                                       `_i`            вопрос;  `_i_reveal` — разбор после ответа
// node scripts/voice/lesson-lines.mjs > lines.json && python3 scripts/voice/make_voice.py lines.json public/voice/lessons
// node scripts/voice/lesson-lines.mjs --ids > content/voice_lessons.json   (плеер урока озвучивает только эти id)
import { pathToFileURL } from 'node:url';
import { kzWords, abl, datKz } from '../../content/templates/lib.mjs';

function ordinal(n) {
  const w = kzWords(n), back = /[аоұы][^аәеиоөұүыіуэ]*$/.test(w.replace(/[иу]/g, ''));
  return /[аәеиоөұүыіуэ]$/.test(w) ? w + (back ? 'ншы' : 'нші') : w + (back ? 'ыншы' : 'інші');
}
// Дробь a/b по-казахски: «b-ден a» (шығыс септік на знаменателе, гармония гласных и глухих: төрттен үш,
// бестен төрт, алтыдан бір, жетіден екі, сегізден бес, он екіден бір). 1/2 отдельно стоит как «жарты».
export function fractionKz(a, b, { half = true } = {}) {
  if (half && +a === 1 && +b === 2) return 'жарты';
  const suf = abl(+b).split('-')[1];                       // -ден / -дан / -тен / -тан / -нен / -нан
  return `${kzWords(+b)}${suf} ${kzWords(+a)}`;
}
// «2 3/4» → «екі бүтін төрттен үш»; «3/4» → «төрттен үш»; «3/4-ті» → «төрттен үшті» (суффикс к числителю).
const SUF = 'ге|ке|ға|қа|нің|тің|дің|ның|дың|тың|ден|тен|нан|тан|дан|нен|де|те|да|та|ді|ті|ны|ні|ды|ты|мен|бен|пен';
export function speakFractions(t) {
  return t
    .replace(new RegExp(`(\\d+) (\\d+)/(\\d+)(?:-(${SUF}))?(?![а-яәіңғүұқөһ\\d])`, 'g'), (_, w, a, b, suf) => `${kzWords(+w)} бүтін ${fractionKz(a, b, { half: false })}${suf || ''}`)
    .replace(new RegExp(`(\\d+)/(\\d+)(?:-(${SUF}))?(?![а-яәіңғүұқөһ\\d])`, 'g'), (_, a, b, suf) => `${fractionKz(a, b, { half: !suf })}${suf || ''}`);
}
// Целое словами; kzWords знает миллионы, а 1 000 000 015 (миллиард) — нет.
const words = n => (n >= 1e9 ? `${words(Math.floor(n / 1e9))} миллиард${n % 1e9 ? ' ' + words(n % 1e9) : ''}` : kzWords(n));
// Piper молча пропускает латиницу и знаки (×, ≤, −, ², {}): без замены смысл пропадает. Латинские буквы-переменные читаем по-казахски.
const LETTER = { a: 'а', b: 'бэ', c: 'цэ', d: 'дэ', e: 'е', f: 'эф', k: 'ка', m: 'эм', n: 'эн', p: 'пэ', q: 'ку', r: 'эр', s: 'эс', t: 'тэ', u: 'у', x: 'икс', y: 'игрек', i: 'и' };
const CYR = 'а-яәіңғүұқөһё', GRAM = '(?:лер|лар|дер|дар|тер|тар)?(?:нің|ның|тің|тың|дің|дың|ге|ке|қа|ға|ден|дан|тен|тан|нен|нан|де|да|те|та|ді|ті|ды|ты|ні|ны|мен|бен|пен|інен|ынан|ін|ын|сі|сы|і|ы)?';
const suffixOf = (f, n) => f(n).split('-')[1];           // abl(6) → «6-дан» → «дан»
/** Десятичная дробь словами (C3): 0,45 → «нөл бүтін жүзден қырық бес», 2,005 → «екі бүтін мыңнан бес»; окончание — к последнему слову (0,3-тен → «…оннан үштен»). */
export function decimalKz(w, f) { return `${words(+w)} бүтін ${fractionKz(+f, 10 ** f.length, { half: false })}`; }
export function speakable(t) {
  return speakFractions(t)
    .replace(/(\d+)([a-z])(?![A-Za-z])/g, '$1 $2')              // 5n → 5 n → «бес эн», 3x → «үш икс» (число при букве, без знака)
    .replace(new RegExp(`(\\d+),(\\d+)(?:-(${GRAM}))?(?![${CYR}\\d])`, 'g'), (_, w, f, sf) => decimalKz(w, f) + (sf || ''))
    .replace(/\?\/(\d+)(?:-(ге|ке|ға|қа|нің|тің|дің|ның|дың|тың))?(?![а-яәіңғүұқөһ\d])/g, (_, b, sf) => `${kzWords(+b)}${suffixOf(abl, +b)} белгісіз сан${sf || ''}`)   // ?/24 → жиырма төрттен белгісіз сан
    .replace(new RegExp(`(\\d+)\\s?[–…]\\s?(\\d+|[a-zA-Z])(?:-(${GRAM}))?(?![A-Za-z${CYR}\\d])`, 'g'), (_, a, b, sf) => {   // 1–9 → бірден тоғызға дейін; 1…20-дан → бірден жиырмадан; 1…n → бірден эн-ге дейін
      const from = `${kzWords(+a)}${suffixOf(abl, +a)}`, to = /\d/.test(b) ? kzWords(+b) : LETTER[b.toLowerCase()];
      return sf ? `${from} ${to}${sf}` : `${from} ${datKz(to)} дейін`;
    })
    .replace(/бір…([a-z])(?![a-z])/g, (_, l) => `бірден ${datKz(LETTER[l])} дейін`)
    .replace(/ЕҮОБ/g, 'ең үлкен ортақ бөлгіш').replace(/ЕКОЕ/g, 'ең кіші ортақ еселік')
    .replace(/(\d+) с(?![а-яәіңғүұқөһ])/g, '$1 секунд').replace(/(\d+) мин(?![а-яәіңғүұқөһ])/g, '$1 минут')
    .replace(/(\d{1,2}):(\d\d)(?:-(де|те|да|та|ден|тен))?/g, (_, h, m, sf) => `сағат ${kzWords(+h)}${m === '00' ? '' : ' ' + kzWords(+m)}${sf || ''}`)
    .replace(/\(?[∩]\)?/g, ' қиылысу ').replace(/\(?[∪]\)?/g, ' бірігу ').replace(/\|/g, ' ')
    .replace(/([МӨС])\+([МӨС])/g, '$1 мен $2').replace(/\s>\s/g, ' үлкен ').replace(/\s<\s/g, ' кіші ')
    .replace(/(\d)[ ](?=\d{3}\b)/g, '$1')                   // 7 245 → 7245
    .replace(/(\d+)([²³])/g, (_, a, p) => `${a} ${p === '²' ? 'квадрат' : 'куб'}`)
    .replace(/(\d+)([⁰¹⁴⁵⁶⁷⁸⁹ⁿ]+)/g, (_, a, p) => `${a} дәреже ${p === 'ⁿ' ? 'эн' : [...p].map(c => '⁰¹²³⁴⁵⁶⁷⁸⁹'.indexOf(c)).join('')}`)
    .replace(/([a-zA-Z)])([²³])/g, (_, a, p) => `${a} ${p === '²' ? 'квадрат' : 'куб'}`).replace(/([a-zA-Z])ⁿ/g, '$1 дәреже эн')
    .replace(/→/g, ', ').replace(/≠/g, ' тең емес ').replace(/≤/g, ' кіші немесе тең ').replace(/≥/g, ' үлкен немесе тең ').replace(/≈/g, ' шамамен ')
    .replace(/✔|✘|★/g, '').replace(/÷/g, 'бөлу ').replace(/\*/g, ' жұлдызша ').replace(/×/g, ' көбейту ')
    .replace(/\b0\d+\b/g, d => [...d].map(c => kzWords(+c)).join(' '))   // 005 → нөл нөл бес
    .replace(new RegExp(`(\\d+)-(${GRAM})(?![${CYR}\\d])`, 'g'), (m, d, suf) => (suf ? words(+d) + suf : m))   // 1-ге → бірге, 5-терді → бестерді
    .replace(new RegExp(`(\\d+)-(?:інші|ыншы|нші|ншы|ші|шы)(?![${CYR}\\d])`, 'g'), (_, d) => ordinal(+d))   // 35-ші → отыз бесінші (суффикс уже в порядковом, не удваиваем)
    .replace(/(\d+)-(?=[а-яәіңғүұқөһ])/g, (_, d) => ordinal(+d) + ' ')   // 1-қадам → бірінші қадам
    .replace(/\d+/g, d => words(+d))
    .replace(/[{}]/g, '').replace(/\)\s\/\s\(/g, ') бөлу (').replace(/\s\/\s/g, ' немесе ').replace(/([а-яәіңғүұқөһ])\/([а-яәіңғүұқөһ])/g, '$1 немесе $2')
    .replace(/\s·\s/g, ' көбейту ').replace(/\s:\s/g, ' бөлу ').replace(/\s−\s/g, ' минус ')
    .replace(/\s\+\s/g, ' қосу ').replace(/\s=\s/g, ' тең ').replace(/\s*=\s*\?/g, ' неше болады?')
    .replace(/\+/g, ' қосу ').replace(/−/g, ' минус ')
    .replace(new RegExp(`(?<![A-Za-z${CYR}])([A-Za-z])(?:-(${GRAM}))?(?![A-Za-z${CYR}])`, 'g'), (m, l, suf) => (LETTER[l.toLowerCase()] ?? l) + (suf || ''))
    .replace(/°/g, ' градус').replace(/\s\?\s/g, ' белгісіз ')   // 30° → отыз градус; «a ? b» (неизвестное внутри фразы) → «белгісіз»
    .replace(/[«»]/g, '').replace(/\s+/g, ' ').trim();
}

// ---------- сборка реплик ----------
export const UNKNOWN = 'белгісіз сан';                    // вместо закрытого числа в голосе правила до решения
const stop = t => (/[.!?…»)]$/.test(t.trim()) ? t.trim() : t.trim() + '.');

// Число-ответ (целое) названо в тексте цифрами или казахским числительным (с окончанием: «бірге», «үшінші», «он екі»)? Возвращает найденное или null.
const SUFW = '(?:ге|ке|қа|ға|ден|тен|нен|дан|тан|де|те|да|та|ді|ті|ны|ні|ды|ның|нің|дің|тің|дың|тың|мен|пен|бен|і|ы|еу|ау|уі|еуі|інші|ыншы|нші|ншы)?';
const ONES_W = ['бір', 'екі', 'үш', 'төрт', 'бес', 'алты', 'жеті', 'сегіз', 'тоғыз'], TENS_W = ['он', 'жиырма', 'отыз', 'қырық', 'елу', 'алпыс', 'жетпіс', 'сексен', 'тоқсан'];
const ALT = { екі: ['екі', 'еке'], алты: ['алты', 'алт'], жеті: ['жеті', 'жет'] };
export function numeralLeak(text, answer) {
  const ans = String(answer).replace(/\s/g, '');
  if (/^\d+,\d+$/.test(ans)) {                                // десятичный ответ (C3): цифрами или словами «нөл бүтін жүзден жеті»
    if (new RegExp(`(^|[^\\d,])${ans}(?!\\d|,\\d)`).test(text)) return ans;
    const [w, f] = ans.split(','), sp = decimalKz(w, f);
    return text.toLowerCase().includes(sp) ? sp : null;
  }
  if (!/^\d+$/.test(ans)) return null;
  text = text.replace(/(\d) (?=\d{3}\b)/g, '$1');            // 7 245 → 7245
  if (new RegExp(`(^|[^\\d/,])${ans}(?![\\d/]|,\\d)`).test(text)) return ans;
  const n = +ans;
  if (n === 0) return null;                                 // «нөл» в текстах — предмет вопроса, а не ответ
  const ws = text.toLowerCase().match(/[a-zа-яәіңғүұқөһё]+/g) ?? [];
  if (/^0\d+$/.test(ans)) { const seq = [...ans].map(c => kzWords(+c)).join(' '); if (` ${ws.join(' ')} `.includes(` ${seq} `)) return seq; }   // «030» → «нөл үш нөл»
  const stems = kzWords(n).split(' ');
  const one = (w, st, last) => (st === 'он' ? (last ? /^(?:он|оныншы|онға|оннан|онның)$/ : /^он$/) : new RegExp(`^(?:${(ALT[st] ?? [st]).join('|')})${last ? SUFW : ''}$`)).test(w);
  const isOnes = w => ONES_W.some(x => new RegExp(`^${x}${SUFW}$`).test(w));
  for (let k = 0; k + stems.length <= ws.length; k++) {
    if (!stems.every((st, j) => one(ws[k + j], st, j === stems.length - 1))) continue;
    // «он екі» — это 12, а не 2; «екі жүз» — 200: число входит в более крупное
    const prev = ws[k - 1], next = ws[k + stems.length], cls = /^0\d/.test(ans);   // «030» — цифры класса: «отыз мың» как раз его называет
    if (!cls && prev && ((n < 10 && TENS_W.includes(prev)) || (n < 100 && prev === 'жүз') || (n < 1000 && (prev === 'мың' || prev === 'миллион')))) continue;
    if (!cls && next && ((n < 100 && n % 10 === 0 && isOnes(next)) || (n < 1000 && /^(?:жүз|мың|миллион)/.test(next)))) continue;
    return ws.slice(k, k + stems.length).join(' ');
  }
  return null;
}

/** Правило «Есте сақта» одной репликой: заголовок и строки (полная версия, после решения пропуска). */
export function ruleLines(step) { return [step.kz, ...step.lines]; }
const spoken = arr => speakable(arr.map(stop).join(' '));
const leaks = (line, answer) => !!(numeralLeak(line, answer) || numeralLeak(speakable(line), answer));

/** Версия правила ДО решения пропуска: в строке с пропуском число заменено на «белгісіз сан», и голос нигде не называет ответ
 *  (цифрой или казахским числительным). Строку, которая всё же называет его (например «→ төрт миллион отыз мың бес» под пропуском 030),
 *  укорачиваем: отрезаем хвост после «→», затем выбрасываем фразы с числительным; если не вышло, строка не озвучивается. */
export function ruleLinesMasked(step, gap) {
  const ans = gap.gap.answer, out = [step.kz];
  step.lines.forEach((l, k) => {
    if (k !== gap.line) { if (!leaks(l, ans)) out.push(l); return; }
    const masked = gap.gap.text.replace('▢', ` ${UNKNOWN} `);
    const tries = [masked, masked.split('→')[0], masked.split(/(?<=\S): /).filter(c => c.includes(UNKNOWN) || !leaks(c, ans)).join(': ')];
    const ok = tries.find(t => t.includes(UNKNOWN) && !leaks(t, ans));
    if (ok) out.push(ok);
  });
  return out;
}

/** Все реплики шагов. planGaps — из src/lesson/gap.ts (чтобы голос прятал то же число, что и экран). */
export function buildLines(LESSONS, planGaps, only) {
  const lines = [], add = (id, kz) => lines.push({ id, kz: typeof kz === 'string' ? speakable(kz) : kz });
  for (const [skill, steps] of Object.entries(LESSONS)) {
    if (only && !skill.startsWith(only)) continue;
    steps.forEach((s, i) => {
      const id = `${skill}_${i}`;
      if (['say', 'goal', 'widget'].includes(s.type)) add(id, s.kz);
      // разбор «Көр»: каждый кадр — анимация + голос (принцип модальности Майера)
      if (s.type === 'example' && s.frames.some(f => f.s)) s.frames.forEach((f, k) => add(`${id}_f${k}`, f.kz));
      if (s.type === 'rule') {
        const gap = planGaps(skill, i, s)?.rule ?? null;
        if (gap) { lines.push({ id, kz: spoken(ruleLinesMasked(s, gap)) }); lines.push({ id: `${id}_full`, kz: spoken(ruleLines(s)) }); }
        else lines.push({ id, kz: spoken(ruleLines(s)) });
      }
      if (s.type === 'why') { add(id, s.kz); add(`${id}_why`, s.why); }
      if (s.type === 'predict') { add(id, s.kz); add(`${id}_reveal`, s.reveal); }
      if (s.type === 'final') { add(id, s.kz); if (s.why) add(`${id}_why`, s.why); }
      if (['faded', 'bug'].includes(s.type)) add(id, s.kz);
    });
  }
  return lines;
}

// CLI: запуск как скрипт печатает реплики уроков; при импорте (тесты) ничего не выполняется.
// planGaps — TypeScript-модуль приложения, поэтому грузим его через vite (тот же код, что у экрана урока).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { createServer } = await import('vite');
  const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error', configFile: false });
  const { planGaps } = await server.ssrLoadModule('/src/lesson/gap.ts');
  const { LESSONS } = await import('../../content/lessons.mjs');
  const lines = buildLines(LESSONS, planGaps, process.argv[2] === '--ids' ? undefined : process.argv[2]);
  if (process.argv[2] === '--ids') console.log('[' + lines.map(l => JSON.stringify(l.id)).sort().join(', ') + ']');   // содержимое content/voice_lessons.json
  else console.log(JSON.stringify(lines, null, 1));
  await server.close();
}
