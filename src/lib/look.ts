// Мир и облик героя: текущий мир (небо в 3D, вид мобов), костюм, энергия Кода, открытые порталы.
import { game, persist } from './store.svelte';
import { W } from './world.svelte';
// @ts-ignore
import { WORLDS as WS, OUTFITS as OS, codeEnergy } from '../../content/worlds.mjs';

export interface WorldDef { id: string; kz: string; ru: string; need: number; sky: number[][]; fog: number; mob: number; isle: string[]; arena?: boolean }
export interface Outfit { id: string; kz: string; need: number; jacket: number; dark: number; visor: number }
export const WORLDS = WS as WorldDef[];
export const OUTFITS = OS as Outfit[];

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
  const o = OUTFITS.find(x => x.id === game.save.outfit) ?? OUTFITS[0];
  W.world?.setOutfit(o.jacket, o.dark, o.visor);
}

export function travel(id: string) { game.save.world = id; persist(); applyLook(); }
export function wearOutfit(id: string) { game.save.outfit = id; persist(); applyLook(); }
