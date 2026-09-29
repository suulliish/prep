// «Пропуск в решении» (docs/GAME_LOOP.md 10): после разбора одно число из решения закрыто, ребёнок выбирает его из трёх.
// Без чтения решения не ответить — это и есть проверка, что разбор прочитан (приём «задача с пропуском» / completion problem).

export interface SolGap { before: string; after: string; answer: string; options: string[] }

// число: минус, целая часть с пробелами-разрядами, дробная часть через запятую
const NUM = /−?\d{1,3}(?: \d{3})+(?:,\d+)?|−?\d+(?:,\d+)?/g;
const OPS = /^[\s]*[·×+−\-:/*^=<>≤≥%²³⁴⁵⁶⁷⁸⁹⁰¹]/;

const toNum = (s: string) => Number(s.replace(/ /g, '').replace('−', '-').replace(',', '.'));
function fmt(n: number, like: string): string {
  const dec = like.includes(',') ? like.split(',')[1].length : 0;
  let s = Math.abs(n).toFixed(dec).replace('.', ',');
  if (/\d \d{3}/.test(like)) s = s.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return (n < 0 ? '−' : '') + s;
}

/** Выбрать число-результат шага (после «=», не часть выражения) и собрать 3 варианта. null — в решении нечего закрыть. */
export function solGap(sol: string, finalAnswer = '', rnd: () => number = Math.random): SolGap | null {
  const cands: { i: number; s: string }[] = [];
  for (const m of sol.matchAll(NUM)) {
    const i = m.index!, s = m[0];
    const left = sol.slice(0, i).trimEnd();
    if (!left.endsWith('=')) continue;                      // только результат шага
    if (OPS.test(sol.slice(i + s.length))) continue;         // «= 6 · 141» — это ещё выражение
    if (/^[\p{L}π(|]/u.test(sol.slice(i + s.length))) continue; // «= 2πx», «= 6(m + 3n)» — коэффициент, не результат
    if (/[\d,]$/.test(sol.slice(0, i))) continue;
    cands.push({ i, s });
  }
  if (!cands.length) return classGap(sol, rnd);
  const norm = (x: string) => x.replace(/\s/g, '');
  const mid = cands.filter(c => norm(c.s) !== norm(finalAnswer));
  const pick = (mid.length ? mid : cands)[0];
  const n = toNum(pick.s);
  if (!Number.isFinite(n)) return null;

  // отвлекающие: соседние значения и другие числа из решения — правдоподобные, но неверные
  const step = pick.s.includes(',') ? Math.pow(10, -pick.s.split(',')[1].length) : 1;
  const pool = new Set<string>();
  for (const c of cands) if (norm(c.s) !== norm(pick.s)) pool.add(c.s);
  for (const d of [1, -1, 2, -2, 10, -10]) { const v = n + d * step; if (n >= 0 && v < 0) continue; pool.add(fmt(v, pick.s)); }
  pool.delete(pick.s);
  const others = [...pool].filter(x => norm(x) !== norm(pick.s));
  const distract: string[] = [];
  while (distract.length < 2 && others.length) distract.push(others.splice(Math.floor(rnd() * Math.min(others.length, 4)), 1)[0]);
  if (distract.length < 2) return null;
  const options = [pick.s, ...distract];
  for (let k = options.length - 1; k > 0; k--) { const j = Math.floor(rnd() * (k + 1)); [options[k], options[j]] = [options[j], options[k]]; }
  return { before: sol.slice(0, pick.i), after: sol.slice(pick.i + pick.s.length), answer: pick.s, options };
}

// Разбор по классам «4 | 303 | 042 → 4 303 042»: закрываем средний класс, варианты — перестановки его цифр
function classGap(sol: string, rnd: () => number): SolGap | null {
  const m = /\d+(?:\s*\|\s*\d+)+/.exec(sol);
  if (!m) return null;
  const parts = [...m[0].matchAll(/\d+/g)];
  const p = parts[parts.length > 2 ? 1 : parts.length - 1];
  const ans = p[0], at = m.index + p.index!;
  const pool = new Set<string>([ans.split('').reverse().join(''), ans.slice(1) + ans[0], ans[ans.length - 1] + ans.slice(0, -1)]);
  const n = Number(ans), pad = (v: number) => String(v).padStart(ans.length, '0');
  if (n > 0) pool.add(pad(n - 1)); pool.add(pad(n + 1)); pool.add(pad(n + 10));
  pool.delete(ans);
  const others = [...pool].filter(x => x.length === ans.length);
  const distract: string[] = [];
  while (distract.length < 2 && others.length) distract.push(others.splice(Math.floor(rnd() * Math.min(others.length, 3)), 1)[0]);
  if (distract.length < 2) return null;
  const options = [ans, ...distract];
  for (let k = options.length - 1; k > 0; k--) { const j = Math.floor(rnd() * (k + 1)); [options[k], options[j]] = [options[j], options[k]]; }
  return { before: sol.slice(0, at), after: sol.slice(at + ans.length), answer: ans, options };
}
