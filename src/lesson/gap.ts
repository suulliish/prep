// D11 «вспомнить, а не перечитать»: в кадрах «Көр» и в «Есте сақта» одно ключевое число закрыто ▢, ребёнок выбирает его из трёх.
// Работает без разметки в данных: берёт число из подсветки [..] (кадр) или результат после «=» (правило, через solGap из боя).
// Отключается флагом noGap на кадре или на шаге. Штрафа нет: неверный вариант гаснет, можно выбрать снова.
import { solGap } from '../engine/solgap';
import { parseFrac, cmp } from '../widgets/fracdraw';

export interface LessonGap { text: string; answer: string; options: string[] }
export interface StepGaps { frames?: (LessonGap | null)[]; rule?: { line: number; gap: LessonGap } | null }

/** Детерминированный генератор по строке-ключу: варианты не «прыгают» при перерисовке. */
export function seeded(key: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) { h ^= key.charCodeAt(i); h = Math.imul(h, 16777619); }
  return () => { h |= 0; h = (h + 0x6d2b79f5) | 0; let t = Math.imul(h ^ (h >>> 15), 1 | h); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// ---------- мини-вычислитель: проверяем, что вариант-отвлекатель НЕ делает равенство верным ----------
function calc(src: string): number {
  let i = 0;
  const ws = () => { while (src[i] === ' ') i++; };
  const num = (): number => {
    ws();
    if (src[i] === '(') { i++; const v = add(); ws(); if (src[i++] !== ')') return NaN; return v; }
    if (src[i] === '-') { i++; return -num(); }
    const m = /^\d+(?:\.\d+)?/.exec(src.slice(i)); if (!m) return NaN;
    i += m[0].length; return Number(m[0]);
  };
  const mul = (): number => { let v = num(); for (;;) { ws(); const c = src[i]; if (c !== '*' && c !== '/') return v; i++; const r = num(); if (c === '*') v *= r; else { if (!r || v % r) return NaN; v /= r; } } };
  const add = (): number => { let v = mul(); for (;;) { ws(); const c = src[i]; if (c !== '+' && c !== '-') return v; i++; const r = mul(); v = c === '+' ? v + r : v - r; } };
  const v = add(); ws();
  return i === src.length ? v : NaN;
}
/** true/false — равенство или неравенство верно/неверно; null — строка не чисто арифметическая, судить нельзя. */
export function holds(expr: string): boolean | null {
  const s = expr.replace(/ /g, ' ').replace(/−/g, '-').replace(/[·×]/g, '*').replace(/:/g, '/').replace(/,/g, '.').trim();
  if (!/^[\d\s+\-*/().=<>≤≥≠]+$/.test(s) || !/[=<>≤≥≠]/.test(s) || /\d \d/.test(s)) return null;
  const bits = s.split(/(≤|≥|≠|=|<|>)/);
  const vals = bits.filter((_, k) => k % 2 === 0).map(calc);
  if (vals.some(Number.isNaN)) return null;
  for (let k = 0; k < vals.length - 1; k++) {
    const op = bits[2 * k + 1], a = vals[k], b = vals[k + 1];
    const ok = op === '=' ? a === b : op === '<' ? a < b : op === '>' ? a > b : op === '≤' ? a <= b : op === '≥' ? a >= b : a !== b;
    if (!ok) return false;
  }
  return true;
}

// ---------- варианты ----------
const NUM = /^\d+(?: \d{3})*(?:,\d+)?$/;
const toNum = (s: string) => Number(s.replace(/ /g, '').replace(',', '.'));
function fmtLike(n: number, like: string): string {
  const dec = like.includes(',') ? like.split(',')[1].length : 0;
  let s = Math.abs(n).toFixed(dec).replace('.', ',');
  if (/\d \d{3}/.test(like)) s = s.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return s;
}
const perms = (d: string): string[] => d.length <= 1 ? [d] : [...new Set([...d].flatMap((c, k) => perms(d.slice(0, k) + d.slice(k + 1)).map(r => c + r)))];

/** Кандидаты-отвлекатели по убыванию правдоподобия (числа): соседние, числа из этой же строки, кратные. */
function numPool(ans: string, others: string[]): string[] {
  if (/^0\d+$/.test(ans)) {   // «005», «030»: длина класса та же, цифры переставлены
    const pad = (v: number) => String(v).padStart(ans.length, '0');
    const n = Number(ans);
    return [...perms(ans), ...(n > 0 ? [pad(n - 1)] : []), pad(n + 1), pad(n + 10)].filter(x => x.length === ans.length);
  }
  const n = toNum(ans);
  const c = [n + 1, n - 1, ...others.map(toNum), n + 2, n - 2, n * 2, n + 10, n - 10, Math.round(n / 2)];
  return c.filter(v => Number.isFinite(v) && v >= 0).map(v => fmtLike(v, ans));
}
const fracPool = (a: { n: number; d: number }) => [{ n: a.d, d: a.n }, { n: a.n + 1, d: a.d }, { n: a.n, d: a.d + 1 }, { n: a.n + a.d, d: a.d }, { n: Math.max(1, a.n - 1), d: a.d }, { n: a.n * 2, d: a.d + 1 }]
  .filter(f => f.n > 0 && f.d > 0 && cmp(f, a) !== 0).map(f => `${f.n}/${f.d}`);

function pickThree(ans: string, pool: string[], rnd: () => number, ok: (v: string) => boolean): string[] | null {
  const seen = new Set([ans]); const good: string[] = [];
  for (const v of pool) if (!seen.has(v) && ok(v)) { seen.add(v); good.push(v); }
  if (good.length < 2) return null;
  const top = good.slice(0, 4), two: string[] = [];
  while (two.length < 2) two.push(top.splice(Math.floor(rnd() * top.length), 1)[0]);
  const opts = [ans, ...two];
  for (let k = opts.length - 1; k > 0; k--) { const j = Math.floor(rnd() * (k + 1)); [opts[k], opts[j]] = [opts[j], opts[k]]; }
  return opts;
}

const CMP_OPS = /[<>≤≥≠≈]/;
/** Число или дробь стоит в тексте отдельным токеном (не часть другого числа): «8» есть в «8 тең бөлікке», но не в «18» и не в «8/9». */
export function mentions(text: string, v: string): boolean {
  const esc = v.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
  return new RegExp(`(^|[^\\d/,])${esc}(?![\\d/]|,\\d)`).test(text);
}
/** Ответ v «виден» в тексте: как отдельное число, как числитель или знаменатель чужой дроби («11» в «11/4»),
 *  а для дроби a/b — если в тексте есть и a, и b по отдельности («3 · 3 = 9, 4 · 3 = 12» раскрывает 9/12). */
export function revealed(text: string, v: string): boolean {
  if (!text) return false;
  if (mentions(text, v)) return true;
  const fr = v.match(/^(\d+)\/(\d+)$/);
  if (fr) return mentions(text, fr[1]) && mentions(text, fr[2]);
  if (/^\d+$/.test(v)) return new RegExp(`(^|[^\\d])${v}/\\d|\\d/${v}(?!\\d)`).test(text);
  return false;
}
/** Кадр «Көр»: закрыть первое [подсвеченное] число или дробь, если это безопасно (рядом нет знака сравнения, верный вариант единственный,
 *  и подпись кадра caption сама не называет это число — иначе ответ читается прямо под пропуском). */
export function frameGap(math: string, rnd: () => number = Math.random, caption = ''): LessonGap | null {
  const flat = math.replace(/[[\]]/g, '');
  const seen = [...flat.matchAll(/\d+(?: \d{3})*(?:,\d+)?/g)].map(x => x[0]);
  for (const m of math.matchAll(/\[([^\]]+)\]/g)) {
    const inner = m[1], at = m.index!;
    const before = math.slice(0, at), after = math.slice(at + m[0].length);
    if (CMP_OPS.test(before.trimEnd().slice(-1)) || CMP_OPS.test(after.trimStart().slice(0, 1))) continue;   // «10 > [8]»: подойдут и 7, и 9
    if (caption && revealed(caption, inner)) continue;
    const fr = parseFrac(inner), isNum = NUM.test(inner);
    if (!isNum && !(fr && fr.whole === null)) continue;
    const plain = (before + '▢' + after).replace(/[[\]]/g, '');
    if (holds(plain.replace('▢', inner)) === false) continue;   // кадр сам себе противоречит — не трогаем
    const pool = isNum ? numPool(inner, seen.filter(x => x !== inner)) : fracPool(fr!);
    const options = pickThree(inner, pool, rnd, v => holds(plain.replace('▢', v)) !== true);
    if (options) return { text: before + '▢' + after, answer: inner, options };
  }
  return null;
}

/** Строка правила: результат после «=» (или средний класс «4 | 030 | 005») через solGap. */
export function ruleGap(line: string, rnd: () => number = Math.random, others = ''): LessonGap | null {
  const g = solGap(line, '', rnd);
  if (!g || revealed(`${g.before} ${g.after} ${others}`, g.answer)) return null;   // ответ не должен читаться в той же или соседней строке
  return { text: g.before + '▢' + g.after, answer: g.answer, options: g.options };
}

/** План пропусков шага: кадры «Көр» — в каждом втором из тех, где есть что закрыть; «Есте сақта» — одна строка. */
export function planGaps(skill: string, i: number, step: any): StepGaps | null {
  if (!step || step.noGap) return null;
  if (step.type === 'example') {
    const cand: (LessonGap | null)[] = step.frames.map((f: any, k: number) => (f.noGap || !f.math ? null : frameGap(f.math, seeded(`${skill}:${i}:${k}`), `${f.kz ?? ''} ${step.kz ?? ''} ${JSON.stringify(f.s ?? step.s ?? {})}`)));
    const idx = cand.flatMap((g, k) => (g ? [k] : []));
    const take = new Set(idx.filter((_, j) => j % 2 === 0));
    return take.size ? { frames: cand.map((g, k) => (take.has(k) ? g : null)) } : null;
  }
  if (step.type === 'rule') {
    for (let k = 0; k < step.lines.length; k++) {
      const g = ruleGap(step.lines[k], seeded(`${skill}:${i}:r${k}`), step.lines.filter((_: string, m: number) => m !== k).join(' '));
      if (g) return { rule: { line: k, gap: g } };
    }
  }
  return null;
}
