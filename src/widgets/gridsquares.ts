// Чистая логика виджета GridSquares («Шаршылар»): сколько шаршылар в торе w × h.
// Шаршы со стороной s задаётся левым верхним углом (r, c); он влезает, если r + s ≤ h и c + s ≤ w.

/** Стороны шаршылар, которые вообще есть в торе: 1 … min(w, h). */
export const sideList = (w: number, h: number): number[] => Array.from({ length: Math.max(0, Math.min(w, h)) }, (_, i) => i + 1);
/** Сколько шаршылар со стороной s: (w − s + 1) · (h − s + 1). */
export const countOfSide = (w: number, h: number, s: number): number => (s < 1 || s > Math.min(w, h) ? 0 : (w - s + 1) * (h - s + 1));
/** Всего шаршылар: сумма по всем сторонам. */
export const totalSquares = (w: number, h: number): number => sideList(w, h).reduce((a, s) => a + countOfSide(w, h, s), 0);
/** Влезает ли шаршы со стороной s с углом (r, c). */
export const fits = (w: number, h: number, s: number, r: number, c: number): boolean => s >= 1 && r >= 0 && c >= 0 && r + s <= h && c + s <= w;
export const key = (r: number, c: number): string => `${r},${c}`;
/** Все допустимые углы для стороны s, по строкам. */
export function corners(w: number, h: number, s: number): { r: number; c: number }[] {
  const out: { r: number; c: number }[] = [];
  for (let r = 0; r + s <= h; r++) for (let c = 0; c + s <= w; c++) out.push({ r, c });
  return out;
}
/** Все ли шаршылар стороны s найдены. */
export const sideDone = (w: number, h: number, s: number, found: Set<string>): boolean => found.size >= countOfSide(w, h, s);
/** Следующая незаконченная сторона после cur (по кругу); null — все готовы. */
export function nextSide(w: number, h: number, cur: number, done: (s: number) => boolean): number | null {
  const L = sideList(w, h);
  for (let i = 1; i <= L.length; i++) { const s = L[(L.indexOf(cur) + i) % L.length]; if (!done(s)) return s; }
  return null;
}
