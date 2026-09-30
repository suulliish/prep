// «Глитчтің қатесі» (D8, night/research-learning.md): раз в ~5 вопросов боя вместо вопроса Глитч «решает» задачу на экране,
// а ребёнок нажимает на первую неверную строку (разбор чужой ошибки: Booth 2013, Adams 2014).
// Чистый модуль без Svelte: строки берутся из готового разбора шаблона (sol), в одной из них портится РЕЗУЛЬТАТ вычисления
// ответом-ловушкой (distractor) с настоящей меткой ошибки из content/misconceptions.mjs. Слева от «=» и в условии ничего не трогается,
// а ход собирается только там, где неверность строки видна глазами: «a · b = c» с числами на экране. Экран: src/ui/GlitchTurn.svelte, ход боя: Session.svelte.
// @ts-ignore
import { MISCONCEPTIONS } from '../../content/misconceptions.mjs';
import { mistakeText } from './items';

interface Choice { text: string; tag: string }
export interface GlitchSrc { sol: { kz: string }; choices: Choice[]; answer: number }

export interface GlitchTurn {
  lines: string[];      // что видит ребёнок: 3–5 строк, одна испорчена
  good: string[];       // те же строки без порчи
  bad: number;          // первая неверная строка
  at: number;           // с какого знака в строке bad начинается испорченный результат (всё левее не тронуто)
  follows: number[];    // строки после неё, которые несут неверный результат дальше (тоже неверные, но это следствие)
  tag: string;          // метка ошибки (ключ в MISCONCEPTIONS)
  right: string;        // верный результат в строке
  wrong: string;        // то, что вместо него написал Глитч
}

export const GLITCH = { minIdx: 2, gapMin: 4, gapMax: 6, minAttempts: 2, minLines: 3, maxLines: 5 } as const;

// ---------- строки из разбора ----------
/** Режет по концам предложений «. ! ? ;» только вне скобок: «ЕКОЕ(14; 20) = 140.» остаётся целым. */
function sentences(text: string): string[] {
  const out: string[] = []; let depth = 0, from = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '(' || c === '{' || c === '[') depth++; else if (c === ')' || c === '}' || c === ']') depth = Math.max(0, depth - 1);
    else if (depth === 0 && '.!?;'.includes(c) && /\s/.test(text[i + 1] ?? '')) { out.push(text.slice(from, i + 1)); from = i + 1; }
  }
  out.push(text.slice(from));
  return out;
}

/** Делит по « = » на глубине 0 (скобки не трогает), кроме первого знака: «C = 2πr = 2 · 3 · 60 = 360» → «C = 2πr», «= 2 · 3 · 60», «= 360». */
function chainSplit(p: string): string[] {
  const out: string[] = []; let depth = 0, from = 0, seen = 0;
  for (let i = 0; i < p.length; i++) {
    const c = p[i];
    if (c === '(' || c === '{' || c === '[') depth++; else if (c === ')' || c === '}' || c === ']') depth--;
    else if (depth === 0 && c === '=' && p[i - 1] === ' ' && p[i + 1] === ' ' && ++seen > 1) { out.push(p.slice(from, i - 1)); from = i; }
  }
  out.push(p.slice(from));
  return out.map(x => x.trim()).filter(Boolean);
}

/** Режет по «, » только вне скобок: «(7 : 1 = 7 — бір бөлік, 7 · 8 = 56.)» остаётся целым. */
function commaSplit(p: string): string[] {
  const out: string[] = []; let depth = 0, from = 0;
  for (let i = 0; i < p.length; i++) {
    const c = p[i];
    if (c === '(' || c === '{' || c === '[') depth++; else if (c === ')' || c === '}' || c === ']') depth = Math.max(0, depth - 1);
    else if (depth === 0 && c === ',' && /\s/.test(p[i + 1] ?? '')) { out.push(p.slice(from, i)); from = i + 1; while (/\s/.test(p[from] ?? '')) from++; i = from - 1; }
  }
  out.push(p.slice(from));
  return out;
}

/** Разбор → строки: по переносам, концам предложений и «;»; если их меньше трёх — цепочки «a = b, c = d» по запятой,
 *  потом цепочки «a = b = c» по «=», потом «пояснение: выкладка» по двоеточию. */
export function solLines(sol: string): string[] {
  const enough = (l: string[]) => l.length >= GLITCH.minLines;
  let parts = sol.split(/\n+/).flatMap(sentences).map(x => x.trim().replace(/;$/, '')).filter(Boolean);
  if (!enough(parts)) parts = parts.flatMap(p => { const c = commaSplit(p); return c.length > 1 && c.every(x => /[=≈↔]/.test(x)) ? c : [p]; });
  if (!enough(parts)) parts = parts.flatMap(chainSplit);
  if (!enough(parts)) parts = parts.flatMap(p => { const m = p.match(/^(.{12,}?\S):\s+(.*\d.*)$/); return m ? [m[1], m[2]] : [p]; });
  return parts;
}

/** Склеивает соседние строки (самую короткую пару), пока их больше `max`. */
function mergeTo(lines: string[], max: number): string[] {
  const out = lines.slice();
  while (out.length > max) {
    let at = 0, best = Infinity;
    for (let i = 0; i + 1 < out.length; i++) { const n = out[i].length + out[i + 1].length; if (n < best) { best = n; at = i; } }
    out.splice(at, 2, out[at] + ' ' + out[at + 1]);
  }
  return out;
}

// ---------- арифметика, которую ребёнок проверит глазами ----------
// Считает «3 · 12 − 4», «7/8 + 1/8», «2 3/5 + 1/5», «ЕКОЕ(12; 6)», «|−5|», «4³», проценты и единицы измерения. Не поняла — null (строка «непроверяемая»).
export type PctMode = 'strip' | 'frac';
const UNIT_RE = /(?<=[\d)%°²³])\s*(?:км\/сағ|м\/с|км|мм|см|дм|м|кг|г|т|мл|л|сағат|сағ|минут|мин|сек|күн|тг|теңге|жыл|ай|апта|бет|адам)(?:[²³])?(?![\p{L}])/gu;

/** Число из текста «−7,7 − 72,8», «2 17/39», «(36 + 28) : 2», «ЕҮОБ(84; 60)». Пояснительные слова слева («Қалды:», «Онда») отбрасываются. */
export function evalArith(text: string, pct: PctMode = 'strip'): number | null {
  let s = text.replace(/[\u00a0\u202f]/g, ' ').trim().replace(/[.;,!?]+$/, '');
  s = s.replace(/^\d+\)\s*/, '').replace(/^.*?\S:\s+(?=\S)/, '');
  s = s.replace(/^(?:[\p{L}]+,?\s+)+(?=[\d(|−–-])/u, '');
  s = s.replace(/\s+\([^()]*\)\s*$/, '');                                               // «(1 м = 100 см)» в конце — пояснение
  s = s.replace(/(?<=\d)[ ](?=\d{3}(?![\d/]))/g, '');                                   // «1 500 000»
  s = s.replace(UNIT_RE, '');
  s = s.replace(/(\d+) (\d+)\/(\d+)/g, '($1+$2/$3)').replace(/(\d),(\d)/g, '$1.$2').replace(/°/g, '');
  s = pct === 'frac' ? s.replace(/(\d+(?:\.\d+)?)%/g, '($1/100)') : s.replace(/%/g, '');
  s = s.replace(/ЕҮОБ/g, 'gcd').replace(/ЕКОЕ/g, 'lcm').replace(/;\s*|,\s+/g, ',');
  s = s.replace(/\|([^|]*)\|/g, 'abs($1)').replace(/([\d)])²/g, '$1^2').replace(/([\d)])³/g, '$1^3');
  s = s.replace(/[·×]/g, '*').replace(/[−–]/g, '-').replace(/:/g, '÷').replace(/\s\/\s/g, '÷').replace(/\//g, '⁄').replace(/\s+/g, '');
  if (!/^[\d.+\-*÷⁄^(),a-z]+$/.test(s) || /[a-z]/.test(s.replace(/gcd|lcm|abs/g, ''))) return null;
  const tok = s.match(/\d+(?:\.\d+)?|gcd|lcm|abs|[-+*÷⁄^(),]/g) ?? [];
  if (tok.join('') !== s) return null;
  let i = 0;
  const peek = () => tok[i], eat = (t?: string) => { if (t && tok[i] !== t) throw 0; return tok[i++]; };
  const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : Math.abs(a));
  const expr = (): number => { let v = term(); while (peek() === '+' || peek() === '-') v = eat() === '+' ? v + term() : v - term(); return v; };
  const term = (): number => { let v = unary(); while (peek() === '*' || peek() === '÷') v = eat() === '*' ? v * unary() : v / unary(); return v; };
  const unary = (): number => (peek() === '-' ? (eat(), -unary()) : peek() === '+' ? (eat(), unary()) : pow());
  const pow = (): number => { const v = frac(); return peek() === '^' ? (eat(), Math.pow(v, unary())) : v; };
  const frac = (): number => { let v = atom(); while (peek() === '⁄') { eat(); v /= atom(); } return v; };
  const atom = (): number => {
    const t = eat();
    if (t === '(') { const v = expr(); eat(')'); return v; }
    if (t === 'gcd' || t === 'lcm' || t === 'abs') {
      eat('('); const a = [expr()]; while (peek() === ',') { eat(); a.push(expr()); } eat(')');
      if (t === 'abs') return Math.abs(a[0]);
      if (a.some(x => !Number.isInteger(x) || x <= 0)) throw 0;
      return t === 'gcd' ? a.reduce(gcd) : a.reduce((x, y) => (x / gcd(x, y)) * y);
    }
    const n = parseFloat(t ?? ''); if (!Number.isFinite(n)) throw 0; return n;
  };
  try { const v = expr(); return i === tok.length && Number.isFinite(v) ? v : null; } catch { return null; }
}

const close = (a: number, b: number) => Math.abs(a - b) <= 1e-6 * Math.max(1, Math.abs(a), Math.abs(b));
const MODES: PctMode[] = ['strip', 'frac'];
/** Верно ли «lhs = rhs»: в каком режиме процентов да, либо null (не сходится или не посчитать). */
function holdsAs(lhs: string, rhs: string): PctMode | null {
  for (const m of MODES) { const a = evalArith(lhs, m), b = evalArith(rhs, m); if (a !== null && b !== null && close(a, b)) return m; }
  return null;
}

/** Текст после последней границы глубины 0: «. » «; » «, » « = ». Так находится левая часть последнего «=» в строке. */
function lastSegment(text: string): string {
  const t = text.replace(/[.;,!?\s]+$/, '');
  let depth = 0, from = 0;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (c === '(' || c === '{' || c === '[') depth++; else if (c === ')' || c === '}' || c === ']') depth = Math.max(0, depth - 1);
    else if (depth === 0 && '.;!?,'.includes(c) && t[i + 1] === ' ') from = i + 2;
    else if (depth === 0 && c === '=' && t[i - 1] === ' ' && t[i + 1] === ' ') from = i + 2;
  }
  return t.slice(from).replace(/^=\s*/, '').trim();
}
const depthAt = (text: string) => { let d = 0; for (const c of text) { if ('({['.includes(c)) d++; else if (')}]'.includes(c)) d = Math.max(0, d - 1); } return d; };

/** Проверка строки глазами: false — в ней есть неверное равенство «a = b» (оба конца считаются), true — все проверяемые верны, null — проверять нечего.
 *  Строка-продолжение цепочки («= 360 см») берёт левую часть из предыдущей строки. */
export function checkLine(lines: string[], i: number): boolean | null {
  let text = lines[i].trim().replace(/([.;!?])\)/g, '$1 ');   // «… = 84.) Жауабы: 84» — скобка пояснения закрылась
  if (text.startsWith('=') && i > 0) text = lastSegment(lines[i - 1]) + ' ' + text;
  let ok: boolean | null = null;
  const clauses: string[] = []; let depth = 0, from = 0;
  for (let k = 0; k < text.length; k++) {
    const c = text[k];
    if (c === '(' || c === '{' || c === '[') depth++; else if (c === ')' || c === '}' || c === ']') depth = Math.max(0, depth - 1);
    else if (depth === 0 && '.;!?,'.includes(c) && text[k + 1] === ' ') { clauses.push(text.slice(from, k)); from = k + 2; }
  }
  clauses.push(text.slice(from));
  for (const cl of clauses) {
    const terms: string[] = []; let d = 0, f = 0;
    for (let k = 0; k < cl.length; k++) {
      const c = cl[k];
      if (c === '(' || c === '{' || c === '[') d++; else if (c === ')' || c === '}' || c === ']') d = Math.max(0, d - 1);
      else if (d === 0 && c === '=' && cl[k - 1] === ' ' && cl[k + 1] === ' ') { terms.push(cl.slice(f, k - 1)); f = k + 2; }
    }
    terms.push(cl.slice(f));
    for (let k = 0; k + 1 < terms.length; k++) {
      const r = holdsAs(terms[k], terms[k + 1]);
      if (r) { ok = ok ?? true; continue; }
      const strip = [evalArith(terms[k]), evalArith(terms[k + 1])], frac = [evalArith(terms[k], 'frac'), evalArith(terms[k + 1], 'frac')];
      if (strip.every(x => x !== null) || frac.every(x => x !== null)) return false;
    }
  }
  return ok;
}

// ---------- поиск результата в строке и замена ----------
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** Результат целиком, а не кусок другого числа: не «5» внутри «15», «1,5», «1/5», «−5» или «5-ке». */
const reCache = new Map<string, RegExp>();
function findRe(ans: string): RegExp {
  let re = reCache.get(ans);
  if (!re) { re = makeFindRe(ans); reCache.set(ans, re); if (reCache.size > 500) reCache.clear(); }
  return re;
}
function makeFindRe(ans: string): RegExp {
  const frac = /^\d+\/\d+$/.test(ans) ? String.raw`(?<!\d[  ])` : '';
  return new RegExp(String.raw`${frac}(?<![\p{L}\d,.^/⁰¹²³⁴⁵⁶⁷⁸⁹−-])${esc(ans)}(?![\d\p{L}²³]|[,.]\d|/\d|-\p{L})`, 'u');
}
const kzPart = (s: string) => s.split(' / ')[0].trim();
/** «720 кг» → «720», «91%» → «91»: запасной вариант, если строка с единицей не найдена. Слитная буква («−17y», «3x») — не единица: такой ответ не обрезаем. */
const bare = (s: string) => s.replace(/(?<=\d)[%°]$|\s+[\p{L}²³]+\.?$/u, '');   // «91%», «720 кг»; «−17y» — алгебраический ответ, не число с единицей

const gCache = new Map<string, RegExp>();
const globalRe = (ans: string) => { let re = gCache.get(ans); if (!re) { re = new RegExp(findRe(ans).source, 'gu'); gCache.set(ans, re); if (gCache.size > 500) gCache.clear(); } return re; };

/** Место, где в строке результат: после «=», «Метка:» или «—», в конце фразы (может быть с единицей), не в скобках (inParens — и в скобках). Операнд («24 = 2 · 3 · 4», «45 : 9») сюда не попадает. */
interface Hit { start: number; end: number; eq: boolean }
function resultHits(line: string, ans: string, inParens = false): Hit[] {
  const out: Hit[] = [];
  for (const m of line.matchAll(globalRe(ans))) {
    const start = m.index!, end = start + m[0].length, before = line.slice(0, start), after = line.slice(end);
    const mark = before.match(/(=|(?<=\S):|—|–)\s*$/);
    if (!mark || (!inParens && depthAt(before) > 0)) continue;
    if (!/^(?:\s*(?:%|°|км\/сағ|[\p{L}²³]{1,8}\.?))?\s*(?:$|[.;,!?)]|\(|—|–)/u.test(after)) continue;
    out.push({ start, end, eq: mark[1] === '=' });
  }
  return out;
}

/** Левая часть равенства, в конце которого стоит результат из `hit`; `prev` — она в предыдущей строке (продолжение цепочки «= …»), null — слева пусто. */
function lhsOf(lines: string[], i: number, hit: Hit): { t: string; prev: boolean } | null {
  const before = lines[i].slice(0, hit.start).replace(/=\s*$/, '');
  const seg = lastSegment(before);
  if (seg) return { t: seg, prev: false };
  const p = before.trim() === '' && i > 0 ? lastSegment(lines[i - 1]) : '';
  return p ? { t: p, prev: true } : null;
}

/** Ловушки с настоящей меткой ошибки; сначала те, чьего числа нет в разборе (иначе ребёнок увидит его в двух местах и запутается). */
function pickWrong(src: GlitchSrc, good: string[], rand: () => number): Choice[] {
  const right = kzPart(src.choices[src.answer].text);
  const seen = new Set<string>();
  const used = (c: Choice) => { const re = findRe(kzPart(c.text)); return good.some(l => re.test(l)) ? 1 : 0; };
  return src.choices.filter((c, i) => {
    const t = kzPart(c.text);
    if (i === src.answer || !t || t === right || !(c.tag in MISCONCEPTIONS) || seen.has(t)) return false;
    seen.add(t); return true;
  }).map(c => ({ c, k: used(c) + rand() * 0.5 })).sort((a, b) => a.k - b.k).map(x => x.c);
}

/** Собирает ход или null: нет строк, нет подходящей ловушки, результат нигде не стоит в проверяемом вычислении «a · b = c» — тогда в бою обычный вопрос.
 *  only — текст варианта: испортить именно им (разбор ошибки ребёнка: «вот решение, которое даёт твой ответ», src/engine/review.ts). */
export function buildGlitch(src: GlitchSrc, rand: () => number = Math.random, only?: string): GlitchTurn | null {
  const right = kzPart(src.choices[src.answer].text);
  if (!right || !src.sol?.kz) return null;
  const good = mergeTo(solLines(src.sol.kz), GLITCH.maxLines);
  if (good.length < GLITCH.minLines) return null;
  const wrongs = pickWrong(src, good, rand).filter(c => only === undefined || kzPart(c.text) === kzPart(only));
  if (!wrongs.length) return null;
  for (const ans of new Set([right, bare(right)])) {
    // первая строка, где ответ получается, обязана быть вычислением, которое можно проверить глазами
    const first = good.findIndex(l => resultHits(l, ans).length > 0);
    if (first < 0) continue;
    const h = resultHits(good[first], ans)[0], lhs = h.eq ? lhsOf(good, first, h)?.t ?? null : null;
    const mode = lhs === null ? null : holdsAs(lhs, ans);
    if (!mode) continue;
    const lv = evalArith(lhs!, mode);
    for (const w of wrongs) {
      const wrong = ans === right ? kzPart(w.text) : bare(kzPart(w.text));
      const wv = evalArith(wrong, mode);
      if (wv === null || lv === null || close(lv, wv)) continue;   // ловушка не делает равенство неверным
      const lines = good.slice(), follows: number[] = [];
      // тот же неверный результат несут дальше только строки, где он стоит как результат («Жауабы: …», «Демек … — …»); операнды не трогаем,
      // а самостоятельное верное вычисление («5 · 9 = 45» в проверке) остаётся как есть
      const independent = (i: number, x: Hit) => { if (!x.eq) return false; const l = lhsOf(good, i, x); return l !== null && !l.prev && holdsAs(l.t, ans) !== null; };
      for (let i = first; i < good.length; i++) {
        const targets = resultHits(good[i], ans).filter(x => (i === first && x.start === h.start) || (!independent(i, x) && (i > first || x.start > h.start)));
        // строка-следствие несёт неверное значение целиком: и «Жауабы: W», и пояснение в скобках «(… · 8 = W.)» — иначе в одной строке верный результат рядом с неверным
        if (i > first && targets.length) for (const x of resultHits(good[i], ans, true)) if (depthAt(good[i].slice(0, x.start)) > 0 && !targets.some(t => t.start === x.start)) targets.push(x);
        targets.sort((p, q) => p.start - q.start);
        let line = good[i];
        for (const x of targets.reverse()) line = line.slice(0, x.start) + wrong + line.slice(x.end);
        lines[i] = line;
        if (i > first && line !== good[i]) follows.push(i);
      }
      if (lines.some(l => /NaN|undefined/.test(l)) || checkLine(lines, first) !== false || checkLine(good, first) === false) continue;
      return { lines, good, bad: first, at: h.start, follows, tag: w.tag, right: ans, wrong };
    }
  }
  return null;
}

// ---------- когда ход выпадает ----------
/** Номер вопроса, начиная с которого выпадет первый ход: 3-й–5-й вопрос боя. */
export const firstGlitchAt = (rand: () => number = Math.random) => GLITCH.minIdx + Math.floor(rand() * 3);
/** После хода следующий — через 4–6 вопросов (в среднем раз в 5, два подряд не бывает). */
export const nextGlitchAt = (idx: number, rand: () => number = Math.random) => idx + GLITCH.gapMin + Math.floor(rand() * (GLITCH.gapMax - GLITCH.gapMin + 1));

export interface GlitchCtx {
  idx: number; total: number; at: number;          // номер вопроса (с 0), длина боя, с какого номера ход «созрел»
  attempts: number;                                // сколько раз ребёнок уже решал этот навык
  block: string; lastWave: boolean; mobHp: number; // босс: последний удар не отдаём ходу
  revenge: boolean; rushTwin: boolean; check: boolean; real: boolean;   // «своё» место вопроса: реванш, «егіз», мини-проверка, настоящая задача экзамена
}
export function glitchAllowed(c: GlitchCtx): boolean {
  if (c.idx < GLITCH.minIdx || c.idx < c.at) return false;
  if (c.attempts < GLITCH.minAttempts) return false;                  // навык уже встречался
  if (c.revenge || c.rushTwin || c.check || c.real) return false;
  if (c.block === 'boss' && (c.idx >= c.total - 1 || (c.lastWave && c.mobHp <= 2))) return false;   // финальный удар по боссу — только за обычный ответ
  return true;
}

// ---------- реплики Бита ----------
export const GLITCH_SAY = {
  title: 'Глитчтің қатесі!',
  ask: 'Қате қай жолдан басталды?',
  glitchSays: 'Мен шештім! Қате қай жолдан басталды?',
  wait: 'Қате жолды таңда',
  right: 'Таптың!',
  wrongLine: 'Бұл жол дұрыс еді. Қате қызыл белгімен көрсетілді.',
  followLine: 'Бұл жол да қате, бірақ ол — салдар: қате ертерек басталған.',
  followTry: 'Бұл жол да қате, бірақ ол — салдар: қате ертерек басталған. Тағы көр!',
  mistake: 'Глитч былай қателесті:',
  fix: 'Дұрысы:',
} as const;

/** Первое предложение объяснения ошибки — короткая реплика Бита после верного удара. */
export function shortMistake(tag: string): string {
  const kz = mistakeText(tag).kz;
  const m = kz.match(/^.+?[.!?](?=\s|$)/);
  return (m ? m[0] : kz).trim();
}
