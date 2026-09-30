// Ноты и случайные числа для процедурной музыки. Чистые функции: без WebAudio, тестируются в node.

const PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** 'D4' → 62, 'F#5' → 78, 'Bb3' → 58 (A4 = 69). */
export function noteMidi(name: string): number {
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(name);
  if (!m) throw new Error(`bad note name: ${name}`);
  return 12 * (+m[3] + 1) + PC[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
}
export const midiHz = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

/** Быстрый детерминированный генератор (mulberry32): один seed — одна и та же музыка, удобно для тестов. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface MelNote { tk: number; n: number; d: number }
/** Мелодия одного такта строкой «тик:нота/длина …», тик = шестнадцатая. "0:A4/6 6:C5/2" */
export function parseMel(s: string): MelNote[] {
  return s.trim().split(/\s+/).filter(Boolean).map(tok => {
    const m = /^(\d+):([A-G][#b]?-?\d)\/(\d+)$/.exec(tok);
    if (!m) throw new Error(`bad melody token: ${tok}`);
    return { tk: +m[1], n: noteMidi(m[2]), d: +m[3] };
  });
}
