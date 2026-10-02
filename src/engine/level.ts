// Уровень героя из XP: каждый следующий уровень на 15% дороже (первый — 100 XP). Чистая функция: её зовут экраны (через store) и симулятор (src/engine/sim.ts).
export const LEVEL = { first: 100, growth: 1.15 } as const;
export function levelOf(xp: number) {
  let lvl = 1, need: number = LEVEL.first, left = xp;
  while (left >= need) { left -= need; lvl++; need = Math.round(need * LEVEL.growth); }
  return { lvl, into: left, need };
}
