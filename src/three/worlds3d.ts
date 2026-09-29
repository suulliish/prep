// Как выглядит боевой остров каждого мира: наборы моделей, чем заполнены места декора, цвет земли и воды.
// Раскладки мест (LAYOUTS) общие для всех миров (island3d.ts), палитра мира говорит, ЧТО стоит на месте с данной ролью.
// Палитра мира — отдельный файл src/three/worlds/<номер>-<имя>.ts с экспортом `palette` (номер = индекс в content/worlds.mjs).
// Нет файла — берётся палитра деревни, земля красится цветом мира.
import type * as THREE from 'three';
import type { IslandKits } from './island3d';

/** lm — ориентиры (дом, мельница), bd — задний план (холмы, горы), tree/tall/dead — деревья, rock/rockBig, bush, grass,
 *  c1…c6 — лагерные мелочи (ящик, бочка, флаг), w1…w3 — водные растения. */
export type Role = 'lm1' | 'lm2' | 'lm3' | 'lm4' | 'lm5' | 'lm6' | 'bd1' | 'bd2' | 'bd3' | 'bd4' | 'tree' | 'tall' | 'dead' | 'rock' | 'rockBig' | 'bush' | 'grass'
  | 'c1' | 'c2' | 'c3' | 'c4' | 'c5' | 'c6' | 'w1' | 'w2' | 'w3';
/** [набор, имя модели, высота в метрах игры]. */
export type Item = [kit: string, name: string, height: number];
export interface Palette {
  kits: string[];                                                    // наборы кроме 'hexcore' (он всегда)
  ground?: { tile?: string; color?: number };                        // плитка земли (по умолчанию hex_grass); color — цвет (по умолчанию isle[0] мира)
  water?: number;                                                    // цвет воды в «Көл»
  roles: Partial<Record<Role, Item[]>>;
  crystals?: number[]; crystalsAlways?: boolean;                     // светящиеся кристаллы (кодом)
  clouds?: boolean;                                                  // облака над островом (по умолчанию да)
  extra?: (g: THREE.Group, layout: number, kits: IslandKits) => void; // любая доп. постановка кодом (лава, неон, снег...)
}

const F = (n: string) => `${n}_Color1`;
/** Деревня (мир 0) и запасная палитра. */
export const VILLAGE: Palette = {
  kits: ['forest', 'village', 'ship'],
  roles: {
    lm1: [['village', 'building_home_A_blue', 3.2], ['hexcore', 'tent', 2.6], ['village', 'building_home_B_blue', 3.2], ['village', 'building_well_blue', 2.4]],
    lm2: [['village', 'building_windmill_blue', 5.2], ['village', 'building_tower_A_blue', 5.5], ['village', 'building_market_blue', 3.6]],
    lm3: [['village', 'building_tavern_blue', 3.6], ['village', 'building_blacksmith_blue', 3.4]],
    lm4: [['ship', 'castle-gate', 5.2]], lm5: [['ship', 'castle-wall', 3.2]], lm6: [['ship', 'tower-complete-small', 6.0]],
    bd1: [['hexcore', 'hills_A_trees', 3.4], ['hexcore', 'mountain_B_grass_trees', 6.0], ['hexcore', 'hills_B_trees', 4.0]],
    bd2: [['hexcore', 'mountain_A_grass_trees', 5.5], ['hexcore', 'mountain_A_grass', 5.5], ['hexcore', 'trees_A_large', 4.6]],
    bd3: [['hexcore', 'mountain_C', 6.4]], bd4: [['hexcore', 'mountain_B', 6.0]],
    tree: [['forest', F('Tree_1_A'), 4.4], ['forest', F('Tree_2_C'), 4.8], ['forest', F('Tree_4_A'), 4.2], ['forest', F('Tree_3_A'), 3.6], ['forest', F('Tree_1_B'), 4.6]],
    tall: [['forest', F('Tree_2_D'), 5.0], ['forest', F('Tree_4_B'), 4.8], ['forest', F('Tree_1_C'), 5.0]],
    dead: [['forest', F('Tree_Bare_1_A'), 4.4], ['forest', F('Tree_Bare_2_B'), 4.0]],
    rock: [['forest', F('Rock_1_A'), 0.9], ['forest', F('Rock_2_B'), 1.1], ['forest', F('Rock_3_C'), 0.9]],
    rockBig: [['forest', F('Rock_3_A'), 2.4], ['forest', F('Rock_3_B'), 2.6]],
    bush: [['forest', F('Bush_1_A'), 1.0], ['forest', F('Bush_2_B'), 1.1], ['forest', F('Bush_4_B'), 1.1]],
    grass: [['forest', F('Grass_2_A'), 0.7], ['forest', F('Grass_1_C'), 0.6], ['forest', F('Grass_2_B'), 0.7]],
    c1: [['hexcore', 'flag_red', 3.0]], c2: [['hexcore', 'weaponrack', 2.0]], c3: [['hexcore', 'target', 2.2]], c4: [['hexcore', 'crate_A_big', 1.5]], c5: [['hexcore', 'barrel', 1.4]], c6: [['hexcore', 'wheelbarrow', 1.5]],
    w1: [['hexcore', 'waterlily_A', 1.2]], w2: [['hexcore', 'waterlily_B', 1.1]], w3: [['hexcore', 'waterplant_A', 1.6], ['hexcore', 'waterplant_B', 1.6]],
  },
  water: 0x2f9bd8, crystals: [0x35e6ff, 0xb58cff, 0xff4fb8],
};

// палитры миров подхватываются из src/three/worlds/*.ts (по номеру в начале имени файла)
const found = import.meta.glob('./worlds/*.ts', { eager: true }) as Record<string, { palette: Palette }>;
const BY_WORLD = new Map<number, Palette>();
for (const [path, mod] of Object.entries(found)) { const n = /\/(\d+)-/.exec(path); if (n && mod.palette) BY_WORLD.set(+n[1], mod.palette); }
export const paletteOf = (world: number): Palette => BY_WORLD.get(world) ?? VILLAGE;
