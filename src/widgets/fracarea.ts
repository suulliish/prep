// Чистые функции виджета FracArea («Аудан»): произведение дробей по площади, «сколько поместится», часть числа и число по части.
export type Fr = { n: number; d: number };

const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : Math.abs(a));

/** Клеток на пересечении закрашенных столбцов и закрашенных строк (это и есть площадь произведения). */
export const overlap = (cols: boolean[], rows: boolean[]) => cols.filter(Boolean).length * rows.filter(Boolean).length;

/** Нарезка и закраска совпадают с целью: ровно d частей и ровно n закрашенных. Эквивалентная дробь (2/4 вместо 1/2) не подходит. */
export const sliceOk = (d: number, shaded: number, t: Fr) => d === t.d && shaded === t.n;

/** Произведение a · b как площадь: n1·n2 клеток из d1·d2, и то же в несократимом виде. */
export function areaProduct(a: Fr, b: Fr): { cells: Fr; reduced: Fr } {
  const cells = { n: a.n * b.n, d: a.d * b.d }, g = gcd(cells.n, cells.d) || 1;
  return { cells, reduced: { n: cells.n / g, d: cells.d / g } };
}

// ---------- «сколько поместится»: whole бүтін, кусок piece = n/d занимает n клеток по 1/d ----------
/** Всего клеток и сколько кусков влезет целиком (max), остаток клеток (rest). */
export function fitInfo(whole: number, piece: Fr) {
  const total = whole * piece.d;
  return { total, max: Math.floor(total / piece.n), rest: total % piece.n };
}
/** Можно ли положить ещё один кусок, если уже лежит placed штук. */
export const fitCanPlace = (placed: number, whole: number, piece: Fr) => (placed + 1) * piece.n <= whole * piece.d;
/** Больше класть нечего: свободных клеток меньше, чем занимает один кусок. */
export const fitDone = (placed: number, whole: number, piece: Fr) => whole * piece.d - placed * piece.n < piece.n;
/** Клетки куска с номером k (с нуля): строка и столбец каждой; кусок может переходить на следующую строку. */
export function fitCells(k: number, piece: Fr): { row: number; col: number }[] {
  return Array.from({ length: piece.n }, (_, i) => { const c = k * piece.n + i; return { row: Math.floor(c / piece.d), col: c % piece.d }; });
}

// ---------- часть числа и число по части ----------
/** Сколько весит одна из d равных частей числа total; null, если total на d нацело не делится. */
export const partUnit = (total: number, d: number): number | null => (d > 0 && total % d === 0 ? total / d : null);
/** Варианты ответа «сколько весит одна часть»: алым, масса одной части, масса известных n частей (по возрастанию, без дублей). */
export function unitChoices(known: number, n: number): number[] {
  return [...new Set([n, known / n, known])].sort((a, b) => a - b);
}
