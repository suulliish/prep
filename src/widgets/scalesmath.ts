// Чистые функции виджетов Scales («Таразы») и ZeroCounter («Нөлдер»): массы на чашах, наклон коромысла, пружина, степени простых.
export type Side = 'L' | 'R' | null;

/** Массы на чашах: слева зат (object) и гири со стороной 'L', справа гири со стороной 'R'. Пропущенный индекс (skip) — гиря в руке. */
export function totals(weights: number[], side: Side[], object: number, skip = -1): { L: number; R: number } {
  let L = object, R = 0;
  weights.forEach((w, i) => { if (i === skip) return; if (side[i] === 'L') L += w; else if (side[i] === 'R') R += w; });
  return { L, R };
}

export const MAX_TILT = 15;
/** Угол коромысла, градусы; положительный — по часовой (правая чаша вниз). Момент силы ~ разность масс, насыщается (tanh): разница в 1 г уже видна. */
export function tiltTarget(L: number, R: number, max = MAX_TILT, s = 6): number {
  return max * Math.tanh((R - L) / s);
}

/** Один шаг затухающей пружины: коромысло чуть качается и успокаивается. dt в секундах. */
export function springStep(a: number, v: number, target: number, dt: number, k = 90, c = 9): { a: number; v: number } {
  const n = Math.max(1, Math.ceil(dt / 0.008)), h = dt / n;
  for (let i = 0; i < n; i++) { v += (k * (target - a) - c * v) * h; a += v * h; }
  return { a, v };
}

/** Простая степень p в k (сколько раз p делит k). */
export function vp(k: number, p: number): number { let c = 0; while (k > 0 && k % p === 0) { k /= p; c++; } return c; }

/** Нули в конце произведения: пар (2, 5) столько, сколько меньшего из двух. */
export function zerosOfProduct(nums: number[]): number {
  let a = 0, b = 0;
  for (const k of nums) { a += vp(k, 2); b += vp(k, 5); }
  return Math.min(a, b);
}
