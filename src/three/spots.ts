// Варианты боевой локации (каждая тема мира = свой уголок мира). Общий остров + ориентир мира сохраняют узнаваемость,
// меняется композиция декора. Боевая полоса (x -4..4, z -0.5..2) всегда плоская и свободная.

export const VARIANTS = 6;
/** Название уголка для баннера входа. */
export const SPOT_KZ = ['Алаң', 'Үстірт', 'Көл', 'Орман', 'Қирандылар', 'Кристалдар'];
/** Стабильный вариант 0..VARIANTS-1 по строке (id темы/блока): FNV-1a. */
export function spotIndex(seed: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h % VARIANTS;
}
/** Настроение света: 0 день, 1 закат, 2 ночь. */
export const spotTime = (v: number): 0 | 1 | 2 => ((((v % 3) + 3) % 3) as 0 | 1 | 2);
export interface SpotLight { hemiSky: number; hemiGround: number; hemi: number; sun: number; sunColor: number; sunPos: [number, number, number]; lanterns: boolean }
export function spotLight(v: number): SpotLight {
  const t = spotTime(v);
  if (t === 1) return { hemiSky: 0xffc9a0, hemiGround: 0x4a2440, hemi: 0.9, sun: 1.5, sunColor: 0xffa15a, sunPos: [-14, 6, 8], lanterns: false };
  if (t === 2) return { hemiSky: 0x6a78c8, hemiGround: 0x1a1030, hemi: 0.7, sun: 0.6, sunColor: 0x9fb4ff, sunPos: [6, 14, 6], lanterns: true };
  return { hemiSky: 0xb4c4ff, hemiGround: 0x40214a, hemi: 1.05, sun: 1.7, sunColor: 0xffe6c8, sunPos: [-8, 16, 10], lanterns: false };
}
