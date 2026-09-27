// Даты по местному времени как 'YYYY-MM-DD'. Учебные дни — только будни.
export const iso = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
export const today = () => iso(new Date());
export const parse = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
export const isWeekday = (s: string) => { const w = parse(s).getDay(); return w >= 1 && w <= 5; };
export function addSchoolDays(s: string, n: number): string {
  const d = parse(s);
  let left = n;
  while (left > 0) { d.setDate(d.getDate() + 1); const w = d.getDay(); if (w >= 1 && w <= 5) left--; }
  return iso(d);
}
export function schoolDaysBetween(a: string, b: string): number {
  if (a >= b) return 0;
  const d = parse(a); let n = 0;
  while (iso(d) < b) { d.setDate(d.getDate() + 1); const w = d.getDay(); if (w >= 1 && w <= 5) n++; }
  return n;
}
