// Мир 1 «Джунгли с руинами»: пальмы, бамбук, папоротники, каменные статуи и заросшие руины (Kenney Nature Kit, CC0, перекрашен).
import * as THREE from 'three';
import type { Palette } from '../worlds3d';
import type { IslandKits } from '../island3d';
import { spotTime } from '../spots';
import { birds, fireflies, leaves } from '../ambient_fx';

/** Пальмы вокруг боевой площадки: живая стена джунглей по краю острова (x, z, высота). */
const CANOPY: [string, number, number, number][] = [
  ['tree_palmTall', -12.5, -2.5, 6.4], ['tree_palmDetailedTall', 12.8, -3.5, 6.8], ['tree_palmTall', -11.5, -9.5, 7.0], ['tree_palmDetailedTall', 11.4, -10.2, 7.2],
  ['tree_palmTall', -4.6, -12.5, 6.6], ['tree_palmDetailedTall', 4.8, -13.0, 7.0], ['tree_palmBend', -15.5, 3.4, 5.4], ['tree_palmBend', 15.6, 2.6, 5.6],
];

function extra(g: THREE.Group, layout: number, kits: IslandKits) {
  const k = kits.get('jungle')!;
  CANOPY.forEach(([name, x, z, h], i) => { const o = k.get(name, { height: h, ground: true }); o.position.set(x, 0, z); o.rotation.y = i * 1.3; g.add(o); });
  let s = 7 + layout * 13; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  // подлесок по краям: папоротники, бамбук, кусты (боевая полоса и пруд свободны)
  const under: [string, number][] = [['plant_flatTall', 1.0], ['plant_bushLarge', 1.5], ['crops_bambooStageB', 2.0], ['plant_bush', 1.1], ['plant_flatShort', 0.8], ['plant_bushDetailed', 1.3], ['mushroom_redGroup', 0.7]];
  for (let i = 0; i < 26; i++) {
    const x = (rnd() - 0.5) * 24, z = -10 + rnd() * 16, [name, h] = under[i % under.length];
    if (!(z < -1.8 || (Math.abs(x) > 8.5 && z < 5))) continue;   // только позади бойцов и по бокам: перед камерой ничего не закрываем
    if (layout === 2 && x < -1 && x > -8.5 && z < -1.5 && z > -8) continue;
    const o = k.get(name, { height: h * (0.8 + rnd() * 0.5), ground: true }); o.position.set(x, 0, z); o.rotation.y = rnd() * 6.28; g.add(o);
  }
  // светлячки над зарослями (мигают и блуждают), листопад с крон, стайка попугаев вдали
  const t = spotTime(layout);
  fireflies(g, { n: 30, area: [-13, 13, 0.6, 3.4, -11, -1], colors: [0xd8ff6a, 0xfff09a, 0xb6ff8a], size: 0.3, seed: layout + 4, wander: 0.8, speed: 0.8 });
  leaves(g, { n: 26, colors: [0x9adf5c, 0xc9e04a, 0x6cc04a, 0xf2b632], seed: layout + 5, size: 0.3, dim: t === 2 ? 0.5 : 1, wind: 0.25 });
  if (t !== 2) birds(g, { n: 3, color: t === 1 ? 0x3a1830 : 0xffb03a, seed: layout + 6 });
}

export const palette: Palette = {
  kits: ['jungle'],
  water: 0x2a9d8f,
  clouds: false,
  roles: {
    lm1: [['jungle', 'statue_head', 3.0], ['jungle', 'statue_ring', 3.2], ['jungle', 'statue_block', 2.6], ['jungle', 'cliff_half_stone', 2.4]],
    lm2: [['jungle', 'statue_obelisk', 5.6], ['jungle', 'tree_palmDetailedTall', 6.2], ['jungle', 'statue_column', 5.0]],
    lm3: [['jungle', 'statue_columnDamaged', 3.4], ['jungle', 'statue_head', 3.6]],
    lm4: [['jungle', 'cliff_cave_stone', 4.6], ['jungle', 'statue_ring', 5.0]],
    lm5: [['jungle', 'cliff_half_stone', 2.6], ['jungle', 'cliff_stone', 3.0], ['jungle', 'statue_block', 2.8]],
    lm6: [['jungle', 'statue_obelisk', 6.4], ['jungle', 'statue_column', 6.0]],
    bd1: [['hexcore', 'mountain_B_grass', 6.0], ['hexcore', 'hills_A', 3.6], ['jungle', 'cliff_large_stone', 4.6]],
    bd2: [['hexcore', 'mountain_A_grass', 5.6], ['jungle', 'cliff_large_stone', 5.0], ['hexcore', 'mountain_C_grass', 6.0]],
    bd3: [['jungle', 'cliff_large_stone', 6.2]], bd4: [['hexcore', 'mountain_B_grass', 6.0]],
    tree: [['jungle', 'tree_palm', 4.6], ['jungle', 'tree_oak', 4.4], ['jungle', 'tree_palmBend', 4.4], ['jungle', 'tree_fat', 4.0], ['jungle', 'tree_palmShort', 3.8], ['jungle', 'tree_detailed', 4.6]],
    tall: [['jungle', 'tree_palmTall', 6.0], ['jungle', 'tree_palmDetailedTall', 6.4], ['jungle', 'tree_tall', 6.0]],
    dead: [['jungle', 'statue_columnDamaged', 3.2], ['jungle', 'crops_bambooStageB', 2.6], ['jungle', 'tree_thin', 4.4]],
    rock: [['jungle', 'stone_smallA', 1.0], ['jungle', 'stone_smallC', 1.0], ['jungle', 'stone_smallB', 1.1]],
    rockBig: [['jungle', 'stone_largeA', 2.4], ['jungle', 'stone_tallB', 2.6], ['jungle', 'stone_largeB', 2.4]],
    bush: [['jungle', 'plant_bush', 1.0], ['jungle', 'plant_bushLarge', 1.4], ['jungle', 'plant_bushDetailed', 1.2]],
    grass: [['jungle', 'plant_flatTall', 0.9], ['jungle', 'plant_flatShort', 0.7], ['jungle', 'grass_leafs', 0.7], ['jungle', 'grass_large', 0.7]],
    c1: [['jungle', 'statue_obelisk', 3.0]], c2: [['jungle', 'statue_column', 2.2]], c3: [['jungle', 'stump_old', 1.6]], c4: [['jungle', 'log_large', 1.0]], c5: [['jungle', 'stump_round', 1.0]], c6: [['jungle', 'campfire_stones', 0.8]],
    w1: [['jungle', 'lily_large', 0.3]], w2: [['jungle', 'lily_small', 0.16]], w3: [['hexcore', 'waterplant_A', 1.0], ['hexcore', 'waterplant_B', 1.0]],
  },
  crystals: [0x7dffb0, 0xffd54a, 0x35e6ff],
  extra,
};
