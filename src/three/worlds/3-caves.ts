// Мир 3 «Кристальные пещеры»: фиолетовые скалы и сталагмиты, светящиеся грибы и кристаллы, свисающие сталактиты
// (Kenney Nature Kit + Modular Cave Kit, CC0, перекрашены в фиолетовый).
import * as THREE from 'three';
import type { Palette } from '../worlds3d';
import type { IslandKits } from '../island3d';

/** Сталактиты «потолка»: конусы остриём вниз высоко за островом (x, y низа, z, радиус, длина). */
const DRIPS: [number, number, number, number, number][] = [
  [-12, 9, -20, 1.6, 6], [-6, 11, -26, 1.2, 5], [1, 8.5, -22, 1.8, 7], [8, 10.5, -24, 1.4, 5.5], [14, 9, -18, 1.5, 6.5], [-17, 10, -16, 1.3, 5], [20, 11, -28, 1.7, 6], [-1, 12, -34, 2.2, 8],
];

/** Подсветка изнутри (emissive = цвет × k) у материалов объекта; клоны одни на исходный материал. */
function glow(root: THREE.Object3D, k: number, made = new Map<THREE.Material, THREE.Material>()) {
  root.traverse(n => {
    const m = n as THREE.Mesh; if (!m.isMesh || !(m.material as THREE.MeshToonMaterial).isMeshToonMaterial || (m.material as THREE.MeshToonMaterial).emissiveIntensity !== 1) return;
    const src = m.material as THREE.MeshToonMaterial;
    if (!made.has(src)) { const c = src.clone(); c.emissive.copy(src.map ? new THREE.Color(1, 1, 1) : src.color).multiplyScalar(k); if (src.map) c.emissiveMap = src.map; made.set(src, c); }
    m.material = made.get(src)!;
  });
}

function extra(g: THREE.Group, layout: number, _kits: IslandKits) {
  // грибы светятся сами; на закате оранжевый свет красит фиолетовое в бордо, поэтому весь остров подсвечиваем изнутри
  if (layout % 3) glow(g, layout % 3 === 1 ? 0.4 : 0.25);
  g.children.forEach(o => { if (o.name.startsWith('mushroom')) glow(o, 0.42); });
  const mat = new THREE.MeshToonMaterial({ color: 0x6a4fb8, emissive: 0x2a1a5a });
  for (const [x, y, z, r, len] of DRIPS) {
    const m = new THREE.Mesh(new THREE.ConeGeometry(r, len, 6), mat); m.rotation.x = Math.PI; m.position.set(x, y + len / 2, z); m.rotation.y = x; g.add(m);
  }
}

export const palette: Palette = {
  kits: ['caves'],
  ground: { color: 0x9468e0 },
  water: 0x35b8f0,
  clouds: false,
  roles: {
    lm1: [['caves', 'mushroom_tanTall', 3.0], ['caves', 'mushroom_redTall', 3.0], ['caves', 'statue_head', 3.0]],
    lm2: [['caves', 'rock_tallB', 5.6], ['caves', 'mushroom_tanTall', 5.0], ['caves', 'stone_tallB', 5.4]],
    lm3: [['caves', 'mushroom_redGroup', 2.8], ['caves', 'mushroom_tanGroup', 2.8]],
    lm4: [['caves', 'gate-rock', 5.0], ['caves', 'cliff_cave_rock', 4.6]],
    lm5: [['caves', 'template-wall-half', 3.2], ['caves', 'template-wall', 3.4], ['caves', 'cliff_large_rock', 3.4]],
    lm6: [['caves', 'rock_tallC', 6.4], ['caves', 'stone_tallC', 6.2]],
    bd1: [['caves', 'rock_largeA', 3.6], ['caves', 'rock_tallB', 6.0], ['caves', 'cliff_large_rock', 4.6]],
    bd2: [['caves', 'rock_tallA', 6.6], ['caves', 'stone_tallB', 6.6], ['caves', 'cliff_large_rock', 5.2]],
    bd3: [['caves', 'rock_tallB', 7.0]], bd4: [['caves', 'rock_tallH', 7.2], ['caves', 'stone_tallB', 6.8]],
    tree: [['caves', 'stone_tallD', 4.4], ['caves', 'mushroom_tanTall', 3.6], ['caves', 'rock_tallG', 4.6], ['caves', 'mushroom_redTall', 3.4]],
    tall: [['caves', 'stone_tallF', 5.6], ['caves', 'rock_tallI', 5.8], ['caves', 'stone_tallB', 5.4]],
    dead: [['caves', 'rock_tallJ', 4.0], ['caves', 'stone_tallG', 4.2]],
    rock: [['caves', 'rock_smallA', 1.0], ['caves', 'stone_smallA', 1.0], ['caves', 'rock_smallB', 1.0]],
    rockBig: [['caves', 'rock_largeA', 2.4], ['caves', 'stone_largeA', 2.4]],
    bush: [['caves', 'mushroom_redGroup', 1.0], ['caves', 'mushroom_tanGroup', 1.0], ['caves', 'plant_flatShort', 1.0]],
    grass: [['caves', 'grass_leafs', 0.7], ['caves', 'plant_flatShort', 0.7], ['caves', 'mushroom_tan', 0.7]],
    c1: [['caves', 'mushroom_tanTall', 3.0]], c2: [['caves', 'stone_tallA', 2.0]], c3: [['caves', 'statue_head', 2.2]], c4: [['caves', 'stone_smallB', 1.5]], c5: [['caves', 'mushroom_redGroup', 1.4]], c6: [['caves', 'stump_old', 1.5]],
    w1: [['hexcore', 'waterlily_A', 0.13]], w2: [['hexcore', 'waterlily_B', 0.09]], w3: [['hexcore', 'waterplant_A', 1.0], ['hexcore', 'waterplant_B', 1.0]],
  },
  crystals: [0xb58cff, 0x35e6ff, 0xff4fb8], crystalsAlways: true,
  extra,
};
