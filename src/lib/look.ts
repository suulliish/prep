// Мир и облик героя: текущий мир (небо в 3D, вид мобов), костюм, энергия Кода, открытые порталы.
import { game, persist } from './store.svelte';
import { W } from './world.svelte';
// @ts-ignore
import { WORLDS as WS, OUTFITS as OS, STAR_REWARDS as SR, codeEnergy } from '../../content/worlds.mjs';

export interface WorldDef { id: string; kz: string; ru: string; need: number; sky: number[][]; fog: number; mob: number; isle: string[]; arena?: boolean }
export interface Outfit { id: string; kz: string; need: number; jacket: number; dark: number; visor: number; gear?: string }  // gear — экипировка скина (src/three/gear.ts)
export const WORLDS = WS as WorldDef[];
export const OUTFITS = OS as Outfit[];
export interface StarReward { id: string; kind: 'trail' | 'cape'; need: number; kz: string; color: number; glow?: boolean; rainbow?: boolean }
export const STAR_REWARDS = SR as StarReward[];
/** Все звёзды уровней за всё время (сумма лучших звёзд каждого шага каждого дня). */
export const totalStars = () => Object.values(game.save.days).reduce((s, r) => s + Object.values(r.stars ?? {}).reduce((a, b) => a + b, 0), 0);
export function wearStyle(kind: 'trail' | 'cape', id: string | undefined) { game.save.style ??= {}; game.save.style[kind] = id; persist(); applyLook(); }

export const energy = () => codeEnergy(game.save.skills) as number;
export const crystals = () => Object.values(game.save.skills).filter(s => s.status === 'mastered' || s.status === 'automatic').length;
export const cleared = (id: string) => !!game.save.worldsCleared?.includes(id);
export function currentWorld(): WorldDef { return WORLDS.find(w => w.id === game.save.world) ?? WORLDS[0]; }

/** Мир открыт: хватает энергии Кода и побеждён босс предыдущего мира (арена — только с пробниками). */
export function worldOpen(i: number): boolean {
  const w = WORLDS[i];
  if (w.arena) return false;
  return i === 0 || (energy() >= w.need && cleared(WORLDS[i - 1].id));
}

export function applyLook() {
  const w = currentWorld();
  W.world?.setTheme(w.sky, w.fog);
  W.world?.setArena(Math.max(0, WORLDS.indexOf(w)), w.isle[0], w.isle[1]); // бой идёт на острове текущего мира
  const o = OUTFITS.find(x => x.id === game.save.outfit) ?? OUTFITS[0];
  W.world?.setOutfit(o.jacket, o.dark, o.visor, o.id);
  const st = game.save.style ?? {}, cape = STAR_REWARDS.find(r => r.id === st.cape), trail = STAR_REWARDS.find(r => r.id === st.trail);
  W.world?.setStyle(cape ? { color: cape.color, glow: !!cape.glow } : null, trail ? (trail.rainbow ? [0xff4fb8, 0xffcb2e, 0x3ddc6e, 0x35e6ff, 0xa77bff] : [trail.color]) : null);
}

export function travel(id: string) { game.save.world = id; persist(); applyLook(); }
export function wearOutfit(id: string) { game.save.outfit = id; persist(); applyLook(); }
