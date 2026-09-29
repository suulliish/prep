// Общие чистые функции дробных виджетов: арифметика дробей, разбор «3/4» и «2 3/4» в строках, геометрия долей, анимация чисел.
export type Fr = { n: number; d: number };

export const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : Math.abs(a));
export const reduce = (f: Fr): Fr => { const g = gcd(f.n, f.d) || 1; return { n: f.n / g, d: f.d / g }; };
/** Равны ли дроби по величине (перекрёстное умножение, без деления). */
export const eq = (a: Fr, b: Fr) => a.n * b.d === b.n * a.d;
export const cmp = (a: Fr, b: Fr) => Math.sign(a.n * b.d - b.n * a.d);
export const add = (a: Fr, b: Fr): Fr => reduce({ n: a.n * b.d + b.n * a.d, d: a.d * b.d });
export const sum = (list: Fr[]): Fr => list.reduce(add, { n: 0, d: 1 });
export const val = (f: Fr) => f.n / f.d;

/** Один чистый вид дроби для подписей: 5/4 -> целая часть 1 и остаток 1/4. */
export function toMixed(f: Fr): { whole: number; n: number; d: number } {
  const r = reduce(f); const whole = Math.floor(r.n / r.d);
  return { whole, n: r.n - whole * r.d, d: r.d };
}

// ---------- разбор дробей в строках ----------
export type Seg = { t: 'text'; s: string } | { t: 'frac'; whole: number | null; n: number; d: number };
// «2 3/4» или «3/4»; не трогаем 1/2/3, 0.5/2 и числа, приклеенные к цифрам
const FRAC_RE = /(?<![\d/.,])(?:(\d+) )?(\d+)\/(\d+)(?![\d/])/g;
export const FRAC_SRC = String.raw`(?:\d+ )?\d+\/\d+`;

export function splitFractions(text: string): Seg[] {
  const out: Seg[] = []; let last = 0;
  for (const m of text.matchAll(FRAC_RE)) {
    if (+m[3] === 0) continue;
    if (m.index! > last) out.push({ t: 'text', s: text.slice(last, m.index) });
    out.push({ t: 'frac', whole: m[1] !== undefined ? +m[1] : null, n: +m[2], d: +m[3] });
    last = m.index! + m[0].length;
  }
  if (last < text.length) out.push({ t: 'text', s: text.slice(last) });
  return out;
}

/** Разбирает один токен вида «3/4» или «2 3/4»; иначе null. */
export function parseFrac(tok: string): { whole: number | null; n: number; d: number } | null {
  const m = /^(?:(\d+) )?(\d+)\/(\d+)$/.exec(tok);
  return m && +m[3] ? { whole: m[1] !== undefined ? +m[1] : null, n: +m[2], d: +m[3] } : null;
}

// ---------- геометрия ----------
/** Точка на окружности; угол 0 = наверх, по часовой стрелке. */
export const polar = (cx: number, cy: number, r: number, a: number) => [cx + r * Math.sin(a), cy - r * Math.cos(a)] as const;

/** Сектор от угла a0 до a1 (радианы). Полный круг рисуем двумя дугами (одна дуга с совпадающими концами не рисуется). */
export function sectorPath(cx: number, cy: number, r: number, a0: number, a1: number): string {
  const span = a1 - a0;
  if (span <= 1e-4) return '';
  if (span >= Math.PI * 2 - 1e-4) return `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`;
  const [x0, y0] = polar(cx, cy, r, a0), [x1, y1] = polar(cx, cy, r, a1);
  return `M${cx} ${cy}L${x0.toFixed(2)} ${y0.toFixed(2)}A${r} ${r} 0 ${span > Math.PI ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}Z`;
}

/** Границы долей при разрезании на d частей во время перехода со старого числа d0 (t: 0..1); лишние границы схлопываются в конец. */
export function boundary(i: number, d0: number, d1: number, t: number): number {
  const a0 = Math.min(1, i / d0), a1 = Math.min(1, i / d1);
  return (a0 + (a1 - a0) * t) * Math.PI * 2;
}

export const DEN_COLORS = ['#35e6ff', '#ffcb2e', '#ff4fb8', '#3ddc6e', '#a77bff', '#ff9a3d', '#5673ff', '#ff7a59', '#7ff2ff', '#ffe38a', '#93e8b0', '#d2bcff'];
export const denColor = (d: number) => DEN_COLORS[(d - 1) % DEN_COLORS.length];

// ---------- анимация ----------
export const easeOut = (x: number) => 1 - Math.pow(1 - x, 3);
const reduced = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Плавно ведёт число 0..1 за ms; step(t). Возвращает функцию отмены. При reduced-motion сразу в конец. */
export function tween(ms: number, step: (t: number) => void, done?: () => void): () => void {
  if (reduced() || ms <= 0) { step(1); done?.(); return () => {}; }
  let raf = 0; const t0 = performance.now();
  const f = (now: number) => {
    const x = Math.min(1, (now - t0) / ms);
    step(easeOut(x));
    if (x < 1) raf = requestAnimationFrame(f); else done?.();
  };
  raf = requestAnimationFrame(f);
  return () => cancelAnimationFrame(raf);
}

/** Звёзды за точность выстрела: err — расстояние в единицах прямой, tol — порог трёх звёзд. */
export function stars(err: number, tol = 0.03): 0 | 1 | 2 | 3 {
  return err <= tol ? 3 : err <= tol * 2.5 ? 2 : err <= tol * 5 ? 1 : 0;
}

/** Ближайшее деление 1/den, зажатое в [lo, hi]. */
export function snap(v: number, den: number, lo: number, hi: number): number {
  const s = den > 0 ? Math.round(v * den) / den : v;
  return Math.min(hi, Math.max(lo, s));
}
