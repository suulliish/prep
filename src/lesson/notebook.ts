// «Дәптер»: карточка темы после урока (чистая логика без экрана). «Менің мысалым» игра проверяет вычислением там, где это возможно:
// свой пример с числами или дробями (равенство, неравенство), «сан + бөлінгіштік», «жай сан», «жіктеу». Где нельзя, пример просто сохраняется.
// @ts-ignore
import { LESSONS } from '../../content/lessons.mjs';
import { coreRule, words, ruleLines } from './recallrule';
import { dat } from '../../content/templates/lib.mjs';

// ---------- рациональный вычислитель (дроби, смешанные числа, скобки) ----------
interface Q { n: number; d: number }
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : Math.abs(a));
const q = (n: number, d: number): Q => { if (!d) throw new Error('div0'); const g = gcd(n, d) || 1; const s = d < 0 ? -1 : 1; return { n: (s * n) / g, d: (s * d) / g }; };
const add = (a: Q, b: Q) => q(a.n * b.d + b.n * a.d, a.d * b.d);
const sub = (a: Q, b: Q) => q(a.n * b.d - b.n * a.d, a.d * b.d);
const mul = (a: Q, b: Q) => q(a.n * b.n, a.d * b.d);
const div = (a: Q, b: Q) => q(a.n * b.d, a.d * b.n);
const cmp = (a: Q, b: Q) => Math.sign(a.n * b.d - b.n * a.d);
export const fmtQ = (x: Q): string => {
  if (x.d === 1) return String(x.n);
  const w = Math.trunc(x.n / x.d), r = Math.abs(x.n) - Math.abs(w) * x.d;
  return w !== 0 && x.n / x.d >= 1 ? `${w} ${r}/${x.d}` : `${x.n}/${x.d}`;
};

type Tok = { t: 'num'; v: Q } | { t: 'op'; v: string };
function lex(src: string): Tok[] | null {
  const s = src.replace(/ /g, ' ').replace(/[−–—]/g, '-').replace(/[·×∙*]/g, '*').replace(/[÷:]/g, ' : ').replace(/,/g, '.').replace(/\s+/g, ' ').trim();
  const out: Tok[] = [];
  let i = 0;
  while (i < s.length) {
    const rest = s.slice(i);
    let m: RegExpExecArray | null;
    if (s[i] === ' ') { i++; continue; }
    // смешанное число «2 3/4», потом дробь «3/4», потом целое/десятичное
    if ((m = /^(\d{1,6}) (\d{1,6})\/(\d{1,6})(?!\d)/.exec(rest)) && Number(m[3])) { out.push({ t: 'num', v: add(q(Number(m[1]), 1), q(Number(m[2]), Number(m[3]))) }); i += m[0].length; continue; }
    if ((m = /^(\d{1,6})\/(\d{1,6})(?!\d)/.exec(rest)) && Number(m[2])) { out.push({ t: 'num', v: q(Number(m[1]), Number(m[2])) }); i += m[0].length; continue; }
    if ((m = /^(\d{1,9})(?:\.(\d{1,4}))?/.exec(rest))) { const f = m[2] ?? ''; out.push({ t: 'num', v: q(Number(m[1] + f), 10 ** f.length) }); i += m[0].length; continue; }
    if (/^(≤|≥|≠|<=|>=|!=)/.test(rest)) { const o = /^(≤|≥|≠|<=|>=|!=)/.exec(rest)![0]; out.push({ t: 'op', v: o === '<=' ? '≤' : o === '>=' ? '≥' : o === '!=' ? '≠' : o }); i += o.length; continue; }
    if ('+-*:()=<>'.includes(s[i])) { out.push({ t: 'op', v: s[i] }); i++; continue; }
    return null;
  }
  return out;
}

function evalTokens(toks: Tok[]): Q {
  let p = 0;
  const peek = () => toks[p];
  const isOp = (v: string) => peek()?.t === 'op' && (peek() as any).v === v;
  const atom = (): Q => {
    const t = toks[p++];
    if (!t) throw new Error('eof');
    if (t.t === 'num') return t.v;
    if (t.v === '(') { const v = sum(); if (!isOp(')')) throw new Error('paren'); p++; return v; }
    if (t.v === '-') { const v = atom(); return q(-v.n, v.d); }
    throw new Error('tok');
  };
  const prod = (): Q => { let v = atom(); while (isOp('*') || isOp(':')) { const o = (toks[p++] as any).v; const r = atom(); v = o === '*' ? mul(v, r) : div(v, r); } return v; };
  const sum = (): Q => { let v = prod(); while (isOp('+') || isOp('-')) { const o = (toks[p++] as any).v; const r = prod(); v = o === '+' ? add(v, r) : sub(v, r); } return v; };
  const v = sum();
  if (p !== toks.length) throw new Error('tail');
  return v;
}

export interface ExprCheck { ok: boolean | null; say: string }
const REL = new Set(['=', '<', '>', '≤', '≥', '≠']);
/** «3 + 4 · 2 = 11», «1/2 + 1/3 = 5/6», «6/9 = 2/3», «5/6 > 7/9»: верно ли соотношение. null — не удалось прочитать или нет знака сравнения. */
export function checkExpr(input: string): ExprCheck {
  const toks = lex(input);
  if (!toks || !toks.length) return { ok: null, say: 'Өрнекті оқи алмадым. Сан, бөлшек (3/4) және + − · : белгілерін қолдан.' };
  const parts: Tok[][] = [[]], rels: string[] = [];
  for (const t of toks) { if (t.t === 'op' && REL.has(t.v)) { rels.push(t.v); parts.push([]); } else parts[parts.length - 1].push(t); }
  if (!rels.length) return { ok: null, say: 'Тең белгісін қой: өрнек = жауап (мысалы, 3 + 4 · 2 = 11).' };
  let vals: Q[];
  try { vals = parts.map(evalTokens); } catch { return { ok: null, say: 'Өрнекті оқи алмадым. Жақшаны, белгілерді тексер.' }; }
  for (let k = 0; k < rels.length; k++) {
    const c = cmp(vals[k], vals[k + 1]), r = rels[k];
    const good = r === '=' ? c === 0 : r === '≠' ? c !== 0 : r === '<' ? c < 0 : r === '>' ? c > 0 : r === '≤' ? c <= 0 : c >= 0;
    if (!good) return { ok: false, say: `Есептеп көр: сол жағы ${fmtQ(vals[k])}, оң жағы ${fmtQ(vals[k + 1])}.` };
  }
  const same = rels.every(r => r === '=');
  return { ok: true, say: same ? `Дұрыс! Екі жағы да ${fmtQ(vals[0])}.` : `Дұрыс! Сол жағы ${fmtQ(vals[0])}, оң жағы ${fmtQ(vals[vals.length - 1])}.` };
}

// ---------- бөлінгіштік, жай сан, жіктеу ----------
const num = (s: string) => { const t = s.replace(/[\s ]/g, ''); return /^\d{1,9}$/.test(t) ? Number(t) : null; };
const smallestDivisor = (n: number) => { for (let k = 2; k * k <= n; k++) if (n % k === 0) return k; return n; };
const isPrime = (n: number) => n > 1 && smallestDivisor(n) === n;

/** Санды жаз, ол k-ға бөлінсін. */
export function checkDivisible(input: string, k: number): ExprCheck {
  const n = num(input);
  if (n === null || n < 1) return { ok: null, say: 'Тек санды жаз, мысалы 252.' };
  const ds = [...String(n)].map(Number), sum = ds.reduce((a, b) => a + b, 0);
  const good = n % k === 0;
  const tail = k === 9 || k === 3 ? ` Цифрлар қосындысы: ${ds.join(' + ')} = ${sum}.` : '';
  return good ? { ok: true, say: `Дұрыс! ${n} саны ${k}-ға бөлінеді.${tail}` } : { ok: false, say: `${n} саны ${k}-ға бөлінбейді.${tail} Басқа сан ойла.` };
}
/** Өзің жай сан жаз, `above`-тан үлкен (по заданию карточки — 30-дан үлкен). */
export const PRIME_ABOVE = 30;
export function checkPrime(input: string, above = PRIME_ABOVE): ExprCheck {
  const n = num(input);
  if (n === null) return { ok: null, say: 'Тек санды жаз, мысалы 31.' };
  if (n < 2) return { ok: false, say: `${n} жай сан емес: жай санның дәл 2 бөлгіші бар.` };
  const d = smallestDivisor(n);
  if (d !== n) return { ok: false, say: `${n} = ${d} · ${n / d}, бұл құрама сан. Басқасын ойла.` };
  if (n <= above) return { ok: false, say: `${n} жай сан, бірақ ${above}-дан үлкен емес. ${above}-дан үлкен жай сан ойла.` };
  return { ok: true, say: `Дұрыс! ${n} жай сан: 1 мен өзінен басқа бөлгіші жоқ.` };
}
/** «60 = 2 · 2 · 3 · 5»: көбейтінді санға тең және көбейткіштердің бәрі жай. */
export function checkFactor(input: string): ExprCheck {
  const s = input.replace(/[·×*∙]/g, '*').replace(/ /g, ' ');
  if (/[\^²³]/.test(s)) return { ok: null, say: 'Дәрежесіз жаз: 100 = 2 · 2 · 5 · 5. Мысал сақталды.' };
  const [l, r] = s.split('=');
  const n = num(l ?? '');
  const fs = (r ?? '').split('*').map(x => num(x));
  if (n === null || !r || fs.some(x => x === null)) return { ok: null, say: 'Былай жаз: 60 = 2 · 2 · 3 · 5.' };
  const f = fs as number[];
  if (f.length < 2) return { ok: null, say: 'Кемінде екі көбейткіш жаз: 60 = 2 · 2 · 3 · 5.' };
  if (f.reduce((a, b) => a * b, 1) !== n) return { ok: false, say: `Көбейтінді ${f.reduce((a, b) => a * b, 1)} болды, ал ${n} керек. Қайта көбейтіп көр.` };
  const bad = f.find(x => !isPrime(x));
  if (bad !== undefined && bad < 2) return { ok: false, say: `${bad} жай сан емес: жай санның дәл 2 бөлгіші бар. Оны жазба.` };
  if (bad !== undefined) return { ok: false, say: `${bad} жай сан емес: ${bad} = ${smallestDivisor(bad)} · ${bad / smallestDivisor(bad)}. Жіктеуді жалғастыр.` };
  return { ok: true, say: `Дұрыс! Көбейтінді ${dat(n)} тең, көбейткіштердің бәрі жай.` };
}

// ---------- какие темы проверяем и что предлагаем ввести ----------
export type ExampleKind = 'expr' | 'div9' | 'prime' | 'factor';
export interface ExampleSpec {
  kind: ExampleKind;
  /** подсказка-вопрос */
  ask: string;
  /** пример формата в поле */
  ph: string;
}

const EXPR: Record<string, string> = {
  'nat.ops': '58 = 9 · 6 + 4',
  'nat.order_ops': '3 + 4 · 2 = 11',
  'frac.basic_property': '1/2 = 3/6',
  'frac.reduce': '6/9 = 2/3',
  'frac.common_denominator': '1/2 = 3/6',
  'frac.compare': '5/6 > 7/9',
  'frac.add_sub': '1/2 + 1/3 = 5/6',
  'frac.mixed': '1 1/2 + 2 1/3 = 3 5/6',
  'frac.mul': '2/3 · 3/4 = 1/2',
  'frac.div': '1/2 : 1/4 = 2',
  'frac.part_of_number': '2/3 · 12 = 8',
  'frac.find_whole': '8 : 2/3 = 12',
};
/** Тема с проверкой вычислением или null: тогда «мой пример» просто сохраняется. */
export function exampleSpec(skill: string): ExampleSpec | null {
  if (EXPR[skill]) return { kind: 'expr', ask: 'Өз мысалыңды ойлап тап: өрнек = жауап. Жауабын өзің есепте.', ph: EXPR[skill] };
  if (skill === 'div.rules') return { kind: 'div9', ask: '9-ға бөлінетін өз санынды жаз. Қағазда цифрлар қосындысын көрсет.', ph: '252' };
  if (skill === 'div.primes') return { kind: 'prime', ask: `Өзің жай сан жаз (${PRIME_ABOVE}-дан үлкен болсын).`, ph: '31' };
  if (skill === 'div.factorization') return { kind: 'factor', ask: 'Өз санынды жай көбейткіштерге жікте.', ph: '60 = 2 · 2 · 3 · 5' };
  return null;
}
export function checkExample(skill: string, input: string): ExprCheck {
  const sp = exampleSpec(skill);
  if (!input.trim()) return { ok: null, say: 'Алдымен мысалыңды жаз.' };
  if (!sp) return { ok: null, say: 'Жазылды. Қағазға шешімін де жаз.' };
  return sp.kind === 'expr' ? checkExpr(input) : sp.kind === 'div9' ? checkDivisible(input, 9) : sp.kind === 'prime' ? checkPrime(input) : checkFactor(input);
}

// ---------- поля карточки ----------
export interface NotebookFields {
  title: string;
  /** скелет правила: первое слово и точки */
  skeleton: string;
  /** главная строка правила целиком: показывается только после «Жаздым» для сверки */
  rule: string;
  /** все строки правила «Есте сақта» для сверки */
  ruleLines: string[];
  /** ловушка Глитча из шага bug: строка с ошибкой и разбор */
  trap: { ask: string; bad: string; fix: string } | null;
}
export function fieldsFor(skill: string): NotebookFields | null {
  const lines = ruleLines(skill);
  if (!lines) return null;
  const core = coreRule(lines), w = words(core);
  const steps = (LESSONS as Record<string, any[]>)[skill] ?? [];
  const bug = steps.find(s => s.type === 'bug');
  const trap = bug && typeof bug.bad === 'number' ? { ask: bug.kz as string, bad: (bug.lines?.[bug.bad] ?? '') as string, fix: (bug.fix ?? '') as string } : null;
  return { title: '', skeleton: `${w[0]} …`, rule: core, ruleLines: lines, trap };
}
