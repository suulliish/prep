// Боевой остров из готовых шестигранных плиток (KayKit Hexagon) с декором. Земля — верх плитки, y = 0.
// Композиция зависит от «уголка» темы (spots.ts: 6 вариантов), цвет земли — от мира (worlds.mjs → isle).
// Боевая полоса (x −4.2…4.4, z −0.5…2.2) свободна: там стоят герой и враг.
import * as THREE from 'three';
import { Kit } from './assets';

export interface IslandKits { hex: Kit; forest: Kit; village: Kit; ship: Kit }
export async function loadIslandKits(): Promise<IslandKits> {
  const [hex, forest, village, ship] = await Promise.all(['hexcore', 'forest', 'village', 'ship'].map(Kit.load));
  return { hex, forest, village, ship };
}

const TS = 3;                       // плитка KayKit (шестиугольник с вершиной к камере, ширина 2, R = 1.1547) ×3 → ширина 6
const R = 1.1547 * TS;              // радиус описанной окружности
const PALETTE_GRASS = new THREE.Color(170 / 255, 175 / 255, 39 / 255); // цвет ячейки палитры у hex_grass — нужен, чтобы покрасить землю в любой цвет

/** Декор: [набор, имя, x, z, поворот, высота]. Набор: h — hexcore, f — forest, v — village, s — ship. */
type Deco = ['h' | 'f' | 'v' | 's', string, number, number, number, number];
const fo = (n: string) => `${n}_Color1`;

// общий задний план: дом и мельница (алаң), лагерь, руины и т.д. — у каждого уголка свой набор
const SPOTS: Deco[][] = [
  // 0 Алаң: луг, дом и мельница
  [['v', 'building_home_A_blue', -3.2, -7.2, 0.5, 3.2], ['v', 'building_windmill_blue', 3.4, -7.6, -0.4, 5.2], ['h', 'hills_A_trees', -9.2, -4.8, 0.3, 3.4], ['h', 'mountain_A_grass_trees', 9.6, -5.2, -0.4, 5.5],
    ['f', fo('Tree_1_A'), -8.6, 1.2, 0, 4.4], ['f', fo('Tree_2_C'), 8.8, 0.8, 1, 4.8], ['f', fo('Tree_4_A'), 0.2, -8.8, 2, 4.2], ['f', fo('Tree_3_A'), -6.2, -5.6, 1, 3.6],
    ['f', fo('Rock_1_A'), -6.6, 4.2, 0.5, 0.9], ['f', fo('Rock_2_B'), 7.2, 4.4, 0, 1.1], ['f', fo('Bush_1_A'), -4.6, 5.6, 0, 1.0], ['f', fo('Bush_2_B'), 4.4, 6.0, 1, 1.1],
    ['f', fo('Grass_2_A'), -2.2, 4.8, 0, 0.7], ['f', fo('Grass_1_C'), 2.4, 5.2, 0, 0.6], ['f', fo('Grass_2_A'), 6.2, 1.8, 0, 0.7], ['f', fo('Grass_1_C'), -6.8, 1.6, 1, 0.6]],
  // 1 Үстірт: лагерь на плато
  [['h', 'mountain_B_grass_trees', -7.5, -8, 0.4, 6], ['h', 'mountain_A_grass', 8.5, -8.5, 2.2, 5.5], ['h', 'tent', -5.5, -5.8, 0.6, 2.6], ['h', 'flag_red', -3.2, -6.5, 0, 3], ['h', 'weaponrack', 3.4, -6.2, 0.2, 2.0],
    ['h', 'target', 6.4, -4.6, -0.7, 2.2], ['h', 'crate_A_big', -8.2, -1.6, 0.4, 1.5], ['h', 'barrel', -8.8, -0.4, 0, 1.4], ['h', 'wheelbarrow', 8.2, 3.6, -0.5, 1.5],
    ['f', fo('Rock_3_A'), 9.4, 0.6, 0, 2.0], ['f', fo('Rock_1_B'), -9.4, 3.2, 1, 1.6], ['f', fo('Tree_2_A'), -10.4, -5, 0, 4.4], ['f', fo('Grass_2_B'), -3.4, 5.0, 0, 0.7], ['f', fo('Grass_1_B'), 3.6, 5.4, 1, 0.6]],
  // 2 Көл: пруд у леса
  [['h', 'waterlily_A', -3.4, -4.4, 0, 1.2], ['h', 'waterlily_B', -5.0, -3.2, 1, 1.1], ['h', 'waterplant_A', -6.6, -5.4, 0, 1.6], ['h', 'waterplant_B', -2.0, -6.0, 0.5, 1.6], ['h', 'trees_A_large', 8.6, -6.4, 0, 4.6],
    ['h', 'hills_B_trees', -9.4, -7.4, 0.5, 4.0], ['f', fo('Tree_3_B'), 6.4, -8.6, 1, 4.6], ['f', fo('Tree_2_B'), -8.6, 2.4, 0, 4.2], ['f', fo('Rock_2_A'), 7.6, 3.8, 0, 1.2], ['f', fo('Bush_3_A'), -6.2, 5.0, 0, 1.0],
    ['f', fo('Bush_4_B'), 5.2, 5.6, 1, 1.1], ['f', fo('Grass_2_C'), 2.6, 5.0, 0, 0.7], ['f', fo('Grass_1_A'), -3.0, 5.4, 0, 0.6]],
  // 3 Орман: густой лес по кругу
  [['f', fo('Tree_1_B'), -8.0, -3.4, 0, 4.6], ['f', fo('Tree_2_D'), -5.2, -7.2, 1, 5.0], ['f', fo('Tree_3_C'), -1.6, -8.6, 2, 4.4], ['f', fo('Tree_4_B'), 2.4, -8.2, 0, 4.8], ['f', fo('Tree_1_C'), 6.0, -6.8, 1, 5.0],
    ['f', fo('Tree_2_A'), 9.0, -2.6, 0.4, 4.6], ['f', fo('Tree_3_A'), 9.4, 2.4, 1, 4.2], ['f', fo('Tree_4_C'), -9.2, 2.0, 0, 4.4], ['f', fo('Bush_1_C'), -6.0, 4.6, 0, 1.2], ['f', fo('Bush_2_A'), 6.4, 4.4, 1, 1.1],
    ['f', fo('Rock_3_B'), -3.6, -5.4, 0, 1.1], ['f', fo('Grass_2_A'), 3.0, 5.0, 0, 0.7], ['f', fo('Grass_1_C'), -2.4, 5.2, 1, 0.6], ['h', 'tree_single_A', 4.6, -5.0, 0, 3.4]],
  // 4 Қирандылар: развалины
  [['s', 'castle-gate', 0.0, -7.6, 0, 5.2], ['s', 'castle-wall', -5.4, -7.0, 0.3, 3.2], ['s', 'castle-wall', 5.4, -7.0, -0.3, 3.2], ['s', 'tower-complete-small', -9.0, -4.4, 0, 6.0], ['f', fo('Rock_3_C'), 7.8, -2.6, 0, 2.2],
    ['f', fo('Rock_1_C'), -7.6, 0.2, 1, 1.6], ['f', fo('Tree_Bare_1_A'), 9.2, 1.6, 0, 4.4], ['f', fo('Tree_Bare_2_B'), -9.6, 3.0, 1, 4.0], ['f', fo('Rock_2_C'), 3.8, -4.4, 0, 1.0], ['f', fo('Bush_4_A'), -4.6, 5.4, 0, 1.0],
    ['f', fo('Grass_2_B'), 4.0, 5.2, 0, 0.7], ['f', fo('Rock_3_A'), -3.0, -4.6, 0.6, 1.3]],
  // 5 Кристалды: скалы (кристаллы добавляются кодом)
  [['h', 'mountain_C', -8.4, -8.0, 0.4, 6.4], ['h', 'mountain_B', 8.6, -8.2, 2.0, 6.0], ['f', fo('Rock_3_D'), -6.0, -4.4, 0, 2.6], ['f', fo('Rock_3_E'), 6.0, -4.8, 1, 2.8], ['f', fo('Rock_1_D'), 0.4, -7.0, 0, 2.2],
    ['f', fo('Rock_2_D'), -9.0, 1.8, 0, 1.8], ['f', fo('Rock_2_E'), 9.0, 2.4, 1, 2.0], ['f', fo('Tree_Bare_1_B'), 4.0, -8.6, 0, 4.4], ['f', fo('Rock_1_E'), -3.8, 5.2, 0, 0.9], ['f', fo('Rock_2_F'), 3.6, 5.6, 1, 1.0]],
];

const rng = (seed: number) => () => ((seed = Math.imul(seed ^ (seed >>> 15), 0x2c1b3c6d) >>> 0), (seed >>> 8) / 16777216);

/** Кристаллы: пучки светящихся граней (для «Кристалдар» и для миров-пещер). */
function crystals(g: THREE.Group, colors: number[], list: [number, number, number][]) {
  const geo = new THREE.OctahedronGeometry(1, 0);
  list.forEach(([x, z, s], i) => {
    const c = colors[i % colors.length];
    const m = new THREE.Mesh(geo, new THREE.MeshToonMaterial({ color: c, emissive: c, emissiveIntensity: 1.1 }));
    m.scale.set(0.42 * s, 1.0 * s, 0.42 * s); m.position.set(x, 1.0 * s, z); m.rotation.y = i; m.rotation.z = 0.12 * (i % 3 - 1); m.castShadow = true; g.add(m);
    const b = new THREE.Mesh(geo, m.material); b.scale.set(0.3 * s, 0.7 * s, 0.3 * s); b.position.set(x + 0.4 * s, 0.7 * s, z + 0.2 * s); b.rotation.set(0.3, i * 2, 0.4); g.add(b);
  });
}

/** Собрать остров. colA — цвет земли мира, v — вариант уголка. */
export function buildIsland(kits: IslandKits, worldK: number, colA: number, colB: number, v: number): THREE.Group {
  const g = new THREE.Group();
  const kit = { h: kits.hex, f: kits.forest, v: kits.village, s: kits.ship };
  // земля
  const target = new THREE.Color(colA);
  const tileProbe = kits.hex.get('hex_grass');
  let src: THREE.Material | null = null; tileProbe.traverse(o => { if (!src && (o as THREE.Mesh).isMesh) src = (o as THREE.Mesh).material as THREE.Material; });
  const groundMat = (src as unknown as THREE.MeshToonMaterial).clone();
  groundMat.color.setRGB(Math.min(target.r / PALETTE_GRASS.r, 4), Math.min(target.g / PALETTE_GRASS.g, 4), Math.min(target.b / PALETTE_GRASS.b, 5));
  const at = (q: number, r: number) => new THREE.Vector3(Math.sqrt(3) * R * (q + r / 2), 0, 1.5 * R * r);
  const N = 3;
  for (let q = -N; q <= N; q++) for (let r = -N; r <= N; r++) {
    if (Math.abs(q + r) > N) continue;
    const t = kits.hex.get('hex_grass', { shadows: true }); t.scale.setScalar(TS); t.position.copy(at(q, r));
    t.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh) { m.material = groundMat; m.castShadow = false; m.receiveShadow = true; } });
    g.add(t);
  }
  // декор уголка
  for (const [k, name, x, z, rot, h] of SPOTS[v % SPOTS.length]) {
    const o = kit[k].get(name, { height: h, ground: true }); o.position.set(x, 0, z); o.rotation.y = rot; g.add(o);
  }
  // облака над островом
  for (const [x, y, z, s] of [[-16, 5, -14, 2.4], [17, 7, -6, 2.0], [6, 11, -30, 2.6], [-10, 13, -34, 2.8]] as const) {
    const c = kits.hex.get(s > 2.5 ? 'cloud_big' : 'cloud_small', { shadows: false }); c.scale.setScalar(s); c.position.set(x, y, z); g.add(c);
  }
  if (v % SPOTS.length === 5 || worldK === 3) {
    const cols = worldK === 3 ? [0xb58cff, 0x7a5cff, 0xd9b8ff] : [0x35e6ff, 0xb58cff, 0xff4fb8];
    crystals(g, cols, [[-6.6, -3.6, 1.3], [-7.4, -2.6, 0.8], [6.8, -3.2, 1.5], [7.6, -2.0, 0.9], [-1.2, -6.6, 1.1], [2.2, -6.4, 0.8], [-9.4, 0.4, 1.0], [9.6, 0.6, 1.1]]);
  }
  return g;
}
