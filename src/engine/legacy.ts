// Снимок открытого (02.10, docs/systems/IMPLEMENTATION.md, PR S5): всё, что ребёнок уже получил в старой системе —
// костюмы за кристаллы, награды за звёзды, открытые и пройденные миры, купленное в мастерской. Снимок только растёт:
// 1) до «Жаңа жүйе» (30.11) ничего открытого не закрывается, даже если проваленная проверка сняла кристалл и энергию
//    (решение 02.10 «ничего не отнимается», DESIGN.md §3);
// 2) при переходе на новую прогрессию снимок — стартовый набор скинов и миров (specs/progression.md, перенос).
// Чистые функции — их гоняют тесты (tests/legacy.test.ts).
import type { Save, ProgLegacy } from './types';
// @ts-ignore
import { WORLDS, OUTFITS, STAR_REWARDS, codeEnergy } from '../../content/worlds.mjs';

interface Need { id: string; need: number; arena?: boolean }
const uniq = (a: (string | undefined | null)[]) => [...new Set(a.filter((x): x is string => !!x))];

/** Что открыто прямо сейчас по правилам старой системы (как src/lib/look.ts и src/screens/Hero.svelte). */
export function unlockedNow(s: Save): Omit<ProgLegacy, 'day'> {
  const crystals = Object.values(s.skills ?? {}).filter(x => x.status === 'mastered' || x.status === 'automatic').length;
  const stars = Object.values(s.days ?? {}).reduce((sum, r) => sum + Object.values(r.stars ?? {}).reduce((a, b) => a + b, 0), 0);
  const energy = codeEnergy(s.skills ?? {}) as number;
  const cleared = s.worldsCleared ?? [];
  const W = WORLDS as Need[];
  return {
    outfits: uniq([...(OUTFITS as Need[]).filter(o => o.need <= crystals).map(o => o.id), s.outfit]),
    styles: uniq([...(STAR_REWARDS as Need[]).filter(r => r.need <= stars).map(r => r.id), s.style?.cape, s.style?.trail]),
    worlds: uniq([...W.filter((w, i) => !w.arena && (i === 0 || (energy >= w.need && cleared.includes(W[i - 1].id)))).map(w => w.id), ...cleared, s.world]),
    cleared: uniq(cleared),
    owned: uniq(s.shipOwned ?? []),
  };
}

/** Снимок, дополненный тем, что открыто сейчас: списки только растут, день — первого снимка. */
export function grownLegacy(s: Save, day: string): ProgLegacy {
  const old = s.prog?.legacy, now = unlockedNow(s);
  const add = (k: keyof Omit<ProgLegacy, 'day'>) => uniq([...(old?.[k] ?? []), ...now[k]]);
  return { day: old?.day ?? day, outfits: add('outfits'), styles: add('styles'), worlds: add('worlds'), cleared: add('cleared'), owned: add('owned') };
}

/** Обновить снимок в сохранении. true — что-то добавилось (стоит записать). */
export function ensureLegacy(s: Save, day: string): boolean {
  const next = grownLegacy(s, day), old = s.prog?.legacy;
  if (old && JSON.stringify(old) === JSON.stringify(next)) return false;
  s.prog = { ...s.prog, legacy: next };
  return true;
}

/** Получено ли в старой системе (по снимку): костюм, плащ/след, мир. */
export const legacyHas = (s: Save, kind: 'outfits' | 'styles' | 'worlds', id: string) => !!s.prog?.legacy?.[kind].includes(id);
