// Против спешки в бою (research-learning.md, D2 + D3): «жмёт, не читая» и «не заметил, что вопрос сменился».
// Чистый модуль без Svelte: пороги, лесенка быстрых ответов, подсветка изменений, мини-проверка «что спрашивается».
// Наказаний нет — ни XP, ни минут: это про внимание. Экран: src/screens/Session.svelte.

// ---------- D2: что считать «слишком быстро» ----------
/** Порог = 2,0 с + 0,04 с на каждый знак условия, не меньше 2,5 с и не больше 8 с. */
export const RUSH = { baseMs: 2000, perCharMs: 40, minMs: 2500, maxMs: 8000, pauseMs: 3000, twinGap: 3 } as const;

/** Длина условия для порога: знаки без учёта пробелов по краям и переносов строк. */
export const stemChars = (kz: string) => kz.replace(/\s+/g, ' ').trim().length;

export const tooFastMs = (chars: number) =>
  Math.round(Math.min(RUSH.maxMs, Math.max(RUSH.minMs, RUSH.baseMs + RUSH.perCharMs * Math.max(0, chars))));

/** Ответ слишком быстрый: быстрее порога для этого условия и без подсказок (с подсказкой ребёнок явно думал). */
export const isTooFast = (timeMs: number, chars: number, hintLevel = 0) => hintLevel === 0 && timeMs < tooFastMs(chars);

/** Лесенка: 1-й быстрый — мягкое «асықпа»; 2-й подряд — «егіз» вернётся через 3 вопроса; 3-й и далее — пауза и мини-проверка. */
export type RushAction = 'none' | 'nudge' | 'twin' | 'check';
export const rushAction = (streak: number): RushAction => (streak <= 0 ? 'none' : streak === 1 ? 'nudge' : streak === 2 ? 'twin' : 'check');

/** Серия быстрых ответов подряд: быстрый — растёт, обычный — обнуляется. */
export const nextStreak = (streak: number, fast: boolean) => (fast ? streak + 1 : 0);

/** В каком по счёту вопросе вернётся «егіз»: через RUSH.twinGap вопросов; в конце боя — на последнем; после последнего не возвращается. */
export function twinSlot(idx: number, total: number): number | null {
  if (idx >= total - 1) return null;
  return Math.min(idx + RUSH.twinGap, total - 1);
}

// ---------- Реплики Бита (казахский, добрые) ----------
export const RUSH_SAY = {
  nudgeRight: 'Дұрыс! Бірақ асықпа — сұрақты соңына дейін оқып көр.',
  twinLater: 'Тағы асықтың. Бұл есеп 3 сұрақтан кейін «егіз» болып қайта келеді — сандары басқа. Асықпай оқы!',
  twinNoSlot: 'Тағы асықтың. Асықпа — сұрақты соңына дейін оқы, есептің кілті сонда.',
  twinArrive: 'Міне, «егіз» есеп! Сандары басқа. Бұл жолы асықпа.',
  checkNext: 'Үш есеп қатарынан тез болды. Келесі есепте бірге дем аламыз.',
  checkPause: 'Дем ал… Сұрақты баяу оқып шық.',
  checkAsk: 'Енді айт: сұрақ не туралы?',
  checkRead: 'Сұрақты соңына дейін оқып шықтың ба?',
  checkWrong: 'Жоқ, тағы қара: сұрақтың соңында не сұралған?',
  checkOk: 'Дәл солай! Енді жауап беруге болады.',
} as const;

// ---------- D3: что изменилось в новом вопросе ----------
export interface Seg { t: string; hl: boolean }
interface Tok { start: number; end: number; norm: string; kind: 'num' | 'word' | 'sym' }

const NUM = String.raw`\d+(?:[   ]\d{3})*(?:,\d+)?(?:/\d+)?`;
const TOKEN = new RegExp(`(${NUM})|([\\p{L}]+(?:-[\\p{L}]+)?)|([%°])`, 'gu');

function tokens(s: string): Tok[] {
  const out: Tok[] = [];
  for (const m of s.matchAll(TOKEN)) {
    const text = m[0], start = m.index!;
    if (m[1]) out.push({ start, end: start + text.length, norm: text.replace(/[   ]/g, ''), kind: 'num' });
    else if (m[2]) out.push({ start, end: start + text.length, norm: text.toLowerCase(), kind: 'word' });
    else out.push({ start, end: start + text.length, norm: text, kind: 'sym' });
  }
  return out;
}

// Ключевые слова: то, что решает, о чём вопрос («ең кіші»/«ең үлкен», «артық»/«кем», «неше», единицы).
const KEY_EXACT = new Set(['ең', 'қай', 'аз', 'көп', 'кем', 'жоқ', 'емес', 'тек', 'км', 'см', 'мм', 'дм', 'кг', 'мл', 'сағ', 'мин', 'сек']);
const KEY_PREFIX = ['кіші', 'үлкен', 'артық', 'кеміт', 'неше', 'қанша', 'қайсы', 'қандай', 'нешін', 'барлығ', 'қалд', 'қосынд', 'айырма', 'көбейтінд', 'бөлінді',
  'қатынас', 'пайыз', 'бөлік', 'бөлім', 'алым', 'жылдамд', 'арақашық', 'қашықт', 'ұзындығ', 'аудан', 'периметр', 'масса', 'салмақ', 'сағат', 'минут', 'секунд',
  'метр', 'километр', 'килограмм', 'грамм', 'литр', 'теңге', 'градус', 'жартыс', 'бүтін',
  'наименьш', 'наибольш', 'больш', 'меньш', 'сколько', 'какой', 'какая', 'какое', 'какие', 'остал'];
const isKeyWord = (w: string) => KEY_EXACT.has(w) || KEY_PREFIX.some(p => w.startsWith(p));
const isSalient = (t: Tok) => t.kind !== 'word' || isKeyWord(t.norm);

/** Разметка условия: какие числа и ключевые слова отличаются от прошлого вопроса. По строкам `lines` (уже с неразрывными пробелами).
 *  Похожий вопрос (тот же шаблон, новые числа) — подсвечиваются числа и слова-ключи, которых не было.
 *  Совсем другой вопрос (общих слов < 30%) — только слова-ключи: числа там и так все новые, вспышка на всём была бы шумом. */
export function changedMarkup(lines: string[], prev: string | null): Seg[][] {
  if (!prev) return lines.map(l => [{ t: l, hl: false }]);
  const prevToks = tokens(prev);
  const have = new Map<string, number>();
  for (const t of prevToks) if (isSalient(t)) have.set(t.norm, (have.get(t.norm) ?? 0) + 1);
  const prevWords = new Set(prevToks.filter(t => t.kind === 'word' && !isKeyWord(t.norm)).map(t => t.norm));
  const curWords = tokens(lines.join(' ')).filter(t => t.kind === 'word' && !isKeyWord(t.norm)).map(t => t.norm);
  const overlap = curWords.length ? curWords.filter(w => prevWords.has(w)).length / curWords.length : 1;
  const fresh = curWords.length >= 3 && overlap < 0.3;

  return lines.map(line => {
    const toks = tokens(line);
    const hl = toks.map(t => {
      if (!isSalient(t) || (fresh && t.kind !== 'word')) return false;
      const n = have.get(t.norm) ?? 0;
      if (n > 0) { have.set(t.norm, n - 1); return false; }
      return true;
    });
    const segs: Seg[] = [];
    let pos = 0;
    for (let i = 0; i < toks.length; i++) {
      if (!hl[i]) continue;
      let j = i;   // соседние подсвеченные («ең кіші») — одним куском
      while (j + 1 < toks.length && hl[j + 1] && /^[\s ]*$/.test(line.slice(toks[j].end, toks[j + 1].start))) j++;
      if (toks[i].start > pos) segs.push({ t: line.slice(pos, toks[i].start), hl: false });
      segs.push({ t: line.slice(toks[i].start, toks[j].end), hl: true });
      pos = toks[j].end; i = j;
    }
    if (pos < line.length || !segs.length) segs.push({ t: line.slice(pos), hl: false });
    return segs;
  });
}

// ---------- D3: верный ответ не на том же месте дважды подряд ----------
interface Choice { text: string; tag: string }
// варианты, смысл которых зависит от порядка: «барлығы дұрыс», «A және B», числа по возрастанию
const ORDER_DEPENDENT = /(^|[^\p{L}\d])[A-EА-Е]([^\p{L}\d]|$)/u;
const ORDER_WORDS = /барлығ|бәрі|ешқайсы|бірде-бір|екеуі|үшеуі|жоғарыдағы|дұрыс емес|все |ни один|оба/iu;
const asNum = (s: string) => { const n = parseFloat(s.replace(/[ \s]/g, '').replace(',', '.').replace('−', '-')); return Number.isFinite(n) && /^[−-]?[\d\s ,.]+$/.test(s.trim()) ? n : NaN; };
function sortedNums(cs: Choice[]) {
  const v = cs.map(c => asNum(c.text));
  if (v.some(Number.isNaN)) return false;
  return v.every((x, i) => i === 0 || x >= v[i - 1]) || v.every((x, i) => i === 0 || x <= v[i - 1]);
}
export const canReorder = (choices: Choice[]) => choices.length >= 2 && !sortedNums(choices) && !choices.some(c => ORDER_DEPENDENT.test(c.text) || ORDER_WORDS.test(c.text));

/** Если верный ответ на том же месте, что и в прошлом вопросе, — меняет его местами с другим вариантом.
 *  Метки ошибок (tag) едут вместе с вариантами, `answer` пересчитывается. Не трогает варианты, зависящие от порядка. */
export function varyAnswerPos<T extends { choices: Choice[]; answer: number }>(it: T, prevPos: number, rand: () => number = Math.random): T {
  if (it.answer !== prevPos || !canReorder(it.choices)) return it;
  const others = it.choices.map((_, i) => i).filter(i => i !== it.answer);
  const to = others[Math.floor(rand() * others.length)];
  const choices = it.choices.slice();
  [choices[it.answer], choices[to]] = [choices[to], choices[it.answer]];
  return { ...it, choices, answer: to };
}

// ---------- D2: мини-проверка «Сұрақ не туралы?» ----------
export interface MiniCheck { prompt: string; options: string[]; answer: number }

// Что спрашивается. Ищем в последней «спрашивающей» фразе, только в её хвосте (там сказано, что искать, а не что дано).
// Однозначно — ровно один вид; иначе null, и вместо вопроса остаётся «оқыдым» (повторное чтение). Распознаём не всё: лучше промолчать, чем спросить неверно.
const ASK_MARK = /неше|қанша|қандай|қайсы|нешінші|табыңыз|табыңдар|есептеңіз|жазыңыз|жіктеңіз|келтіріңіз|салыстырыңыз|анықтаңыз|бағалаңыз|(^|\s)қай(\s|$)/i;
export const ASK_KINDS: { id: string; re: RegExp; label: string }[] = [
  { id: 'ratio', re: /қатынас/, label: 'Қатынас' },
  { id: 'percent', re: /пайыз|концентрация/, label: 'Пайыз' },
  { id: 'time', re: /неше\s+(сағат|минут|күн|апта|жыл|секунд)|қанша\s+уақыт|қандай\s+уақыт/, label: 'Уақыт' },
  { id: 'speed', re: /жылдамдығ[ыы]/, label: 'Жылдамдық' },
  { id: 'mass', re: /(неше|қанша)\s+(кг|килограмм|грамм|г)(?![\p{L}])|массас|салмағ/u, label: 'Масса' },
  { id: 'money', re: /(неше|қанша)\s+теңге|теңге\s*жұмса/, label: 'Ақша' },
  { id: 'geom', re: /ұзындығ|ауданын|периметр|бұрыш|радиус|шеңбер/, label: 'Ұзындық, аудан не бұрыш' },
  { id: 'part', re: /қандай\s+бөлігі|бөлігі\s+қалды|қандай\s+бөлік|қандай\s+үлес|бөлшегінің\s+(бөлімі|алымы)/, label: 'Бөлшек, бөлік' },
  { id: 'gcd', re: /еүоб|екое|ортақ\s+бөлім/, label: 'Ортақ бөлгіш не еселік' },
  { id: 'value', re: /мәнін\s+табыңыз|мәнін\s+есептеңіз|мәні\s+қандай/, label: 'Өрнектің мәні' },
  { id: 'which', re: /^қай\s|\sқай\s|қайсы/, label: 'Қайсысы дұрыс/сәйкес' },
];
const COUNT = { id: 'count', re: /неше|қанша/, label: 'Неше дана, қанша' };

/** Хвост условия, где сказано, что искать: последняя фраза со словом-вопросом (скобки вроде «(π = 3,14)» отбрасываем). */
export function askTail(stem: string): string | null {
  const sents = stem.replace(/\([^)]*\)/g, ' ').split(/(?<=[.?!:])\s+|\n+/).map(s => s.trim()).filter(Boolean);
  const s = [...sents].reverse().find(x => ASK_MARK.test(x));
  return s ? s.replace(/[?!.:\s]+$/, '').toLowerCase().slice(-48) : null;
}

/** Вид вопроса или null, если не уверены. */
export function askKind(stem: string): { id: string; label: string } | null {
  const tail = askTail(stem);
  if (!tail) return null;
  const hit = ASK_KINDS.filter(k => k.re.test(tail));
  if (hit.length === 1) return hit[0];
  const ratio = hit.find(k => k.id === 'ratio');   // «жылдамдығының … жылдамдығына қатынасы» — спрашивается отношение, а не скорость
  if (ratio) return ratio;
  if (hit.length === 0 && COUNT.re.test(tail)) return COUNT;
  return null;
}

/** Три варианта: верный вид + два чужих (не «неше/қанша» — он подходит к любому «сколько»). null — вывести вопрос нельзя. */
export function miniCheck(stem: string, rand: () => number = Math.random): MiniCheck | null {
  const k = askKind(stem);
  if (!k) return null;
  const pool = ASK_KINDS.filter(x => x.id !== k.id && !(k.id === 'ratio' && x.id === 'part') && !(k.id === 'part' && x.id === 'ratio'));
  const wrong: string[] = [];
  const bag = pool.slice();
  while (wrong.length < 2 && bag.length) wrong.push(bag.splice(Math.floor(rand() * bag.length), 1)[0].label);
  const options = [k.label, ...wrong];
  for (let i = options.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [options[i], options[j]] = [options[j], options[i]]; }
  return { prompt: 'Сұрақ не туралы?', options, answer: options.indexOf(k.label) };
}
