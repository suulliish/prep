// Точные вычисления для tests/equations6.test.ts и tests/lessons_week11.test.ts (не тест: vitest берёт только *.test.ts).
// Выражения и уравнения с одной буквой считаются рациональными числами (пара целых, без плавающей точки). Код шаблонов и уроков здесь не вызывается.
export type Q = readonly [number, number];
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : Math.abs(a));
const mk = (n: number, d: number): Q => { if (d < 0) { n = -n; d = -d; } const g = gcd(n, d) || 1; return [n / g, d / g]; };
const add = (a: Q, b: Q) => mk(a[0] * b[1] + b[0] * a[1], a[1] * b[1]);
const sub = (a: Q, b: Q) => mk(a[0] * b[1] - b[0] * a[1], a[1] * b[1]);
const mul = (a: Q, b: Q) => mk(a[0] * b[0], a[1] * b[1]);
const div = (a: Q, b: Q) => { if (!b[0]) throw new Error('деление на ноль'); return mk(a[0] * b[1], a[1] * b[0]); };
export const eqQ = (a: Q, b: Q) => a[0] === b[0] && a[1] === b[1];

type Node = (x: Q) => Q;
/** Разбор выражения: числа, одна буква, + − · : скобки, неявное умножение («5x», «3(x + 4)», «(x + 4)3» не поддерживается). */
export function parse(src: string): { f: Node; v: string | null } {
  const toks = [...src.replace(/\s+/g, '')].reduce<string[]>((acc, ch) => {
    if (/\d/.test(ch) && /^\d+$/.test(acc[acc.length - 1] ?? '')) acc[acc.length - 1] += ch; else acc.push(ch);
    return acc;
  }, []);
  let i = 0, letter: string | null = null;
  const startsFactor = () => i < toks.length && (/^\d+$/.test(toks[i]) || /^[a-z]$/.test(toks[i]) || toks[i] === '(');
  const factor = (): Node => {
    const t = toks[i++];
    if (t === '(') { const e = expr(); if (toks[i++] !== ')') throw new Error('нет ) в ' + src); return e; }
    if (/^\d+$/.test(t)) return () => mk(+t, 1);
    if (/^[a-z]$/.test(t)) { if (letter && letter !== t) throw new Error('две буквы в ' + src); letter = t; return x => x; }
    throw new Error(`неожиданный «${t}» в ${src}`);
  };
  const term = (): Node => {
    let f = factor();
    for (;;) {
      const t = toks[i];
      if (t === '·' || t === ':') { i++; const g = factor(), p = f; f = t === '·' ? x => mul(p(x), g(x)) : x => div(p(x), g(x)); }
      else if (startsFactor()) { const g = factor(), p = f; f = x => mul(p(x), g(x)); }
      else return f;
    }
  };
  const expr = (): Node => {
    let f = term();
    for (;;) {
      const t = toks[i];
      if (t === '+' || t === '−') { i++; const g = term(), p = f; f = t === '+' ? x => add(p(x), g(x)) : x => sub(p(x), g(x)); } else return f;
    }
  };
  const f = expr();
  if (i !== toks.length) throw new Error('лишнее в конце: ' + src);
  return { f, v: letter };
}
export const evalAt = (src: string, x: number): Q => parse(src).f(mk(x, 1));

/** Уравнение «L = R» с одной буквой: обе части линейны, возвращает наклоны и свободные члены (проверено на трёх точках). */
const linCache = new Map<string, ReturnType<typeof linRaw>>();
export function lin(eq: string) { let v = linCache.get(eq); if (!v) { v = linRaw(eq); linCache.set(eq, v); } return v; }
function linRaw(eq: string) {
  const [l, r] = eq.split('=').map(s => s.trim());
  const L = parse(l), R = parse(r);
  const side = (n: Node) => { const f0 = n(mk(0, 1)), f1 = n(mk(1, 1)), f2 = n(mk(2, 1)), s = sub(f1, f0); if (!eqQ(sub(f2, f1), s)) throw new Error('не линейно: ' + eq); return { s, i: f0 }; };
  const a = side(L.f), b = side(R.f);
  return { l: a, r: b, v: L.v ?? R.v, Lf: L.f, Rf: R.f };
}
/** Корни среди 0..hi (перебор точными числами). */
export function exactRoots(eq: string, hi = 3000): number[] {
  const { Lf, Rf } = lin(eq), out: number[] = [];
  for (let x = 0; x <= hi; x++) { const q = mk(x, 1); if (eqQ(Lf(q), Rf(q))) out.push(x); }
  return out;
}
/** Верно ли равенство при x = t (точно). */
export function holdsAt(eq: string, t: number): boolean { const { Lf, Rf } = lin(eq); return eqQ(Lf(mk(t, 1)), Rf(mk(t, 1))); }
/** Единственное решение линейного уравнения (точно): [числитель, знаменатель] или null, если корня нет или их много. */
export function solveLinear(eq: string): Q | null {
  const { l, r } = lin(eq), k = sub(l.s, r.s);
  return k[0] === 0 ? null : div(sub(r.i, l.i), k);
}
