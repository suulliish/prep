// Мир 2 «Парящие острова»: светлая земля в цвет неба, розовые и мятные деревья, белый мрамор, облачное море и парящие островки
// (Kenney Nature Kit, CC0, перекрашен; облака из KayKit Hexagon).
import * as THREE from 'three';
import type { Palette } from '../worlds3d';
import type { IslandKits } from '../island3d';
import { ambientOf } from '../ambient';
import { birds, leaves } from '../ambient_fx';

/** Далёкие парящие островки: диск травы, каменный конус вниз, деревце сверху (x, y, z, размер). */
const ISLETS: [number, number, number, number, string][] = [
  [-19, 3.5, -22, 3.4, 'tree_oak_fall'], [17, 6, -28, 4.2, 'tree_fat'], [-4, 9, -40, 5, 'tree_tall_fall'], [24, 1, -14, 2.4, 'statue_column'], [-26, 8, -34, 3.6, 'tree_default'],
];

/** Свет закатных и ночных уголков общий для всех миров, но у светлого мира земля от него грязнеет. Подсвечиваем всё изнутри (emissive = цвет × k). */
function lift(g: THREE.Group, k: number) {
  const made = new Map<THREE.Material, THREE.Material>();
  g.traverse(n => {
    const m = n as THREE.Mesh; if (!m.isMesh || (m.material as THREE.MeshToonMaterial).emissiveIntensity !== 1 || !(m.material as THREE.MeshToonMaterial).isMeshToonMaterial) return;
    const src = m.material as THREE.MeshToonMaterial;
    if (!made.has(src)) { const c = src.clone(); c.emissive.copy(src.map ? new THREE.Color(1, 1, 1) : src.color).multiplyScalar(k); if (src.map) c.emissiveMap = src.map; made.set(src, c); }
    m.material = made.get(src)!;
  });
}

function extra(g: THREE.Group, layout: number, kits: IslandKits) {
  const k = kits.get('isles')!, hex = kits.get('hexcore')!;
  const dusk = layout % 3;                                  // 0 день, 1 закат, 2 ночь (spots.ts)
  const top = new THREE.MeshToonMaterial({ color: 0xa6e89e, emissive: 0x5a9a55 }), rock = new THREE.MeshToonMaterial({ color: 0xc9b48e, emissive: 0x8a7a5e });
  const isles: [THREE.Group, number][] = [];
  for (const [x, y, z, s, tree] of ISLETS) {
    const isle = new THREE.Group(); isle.position.set(x, y, z); isles.push([isle, y]);
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(s, s * 0.92, 0.5, 9), top); disc.position.y = -0.25; disc.castShadow = disc.receiveShadow = true; isle.add(disc);
    const cone = new THREE.Mesh(new THREE.ConeGeometry(s * 0.92, s * 1.6, 9), rock); cone.rotation.x = Math.PI; cone.position.y = -0.5 - s * 0.8; isle.add(cone);
    const t = k.get(tree, { height: s * 1.5, ground: true }); isle.add(t); isle.rotation.y = x;
    g.add(isle);
  }
  // облака: над островом и облачное море под ним и за ним; материал клонируем и подсвечиваем, чтобы были белыми, а не серыми
  const glow = (o: THREE.Object3D) => o.traverse(n => { const m = n as THREE.Mesh; if (m.isMesh) { const c = (m.material as THREE.MeshToonMaterial).clone(); c.emissive.set(0xc8d8ff); c.emissiveIntensity = 0.55; m.material = c; } });
  for (const [x, y, z, s] of [[-16, 5, -14, 2.4], [17, 7, -6, 2.0], [6, 11, -30, 2.6], [-10, 13, -34, 2.8],
    [-14, -3.5, -12, 4.2], [15, -4, -16, 4.6], [0, -5, -26, 5.4], [-24, -3, -30, 4.4], [26, -4.5, -34, 5], [-8, -5.5, 16, 4.4], [12, -5, 18, 4.6], [30, -4, -2, 4]] as const) {
    const c = hex.get(s > 2.5 ? 'cloud_big' : 'cloud_small', { shadows: false }); c.scale.setScalar(s); c.position.set(x, y, z); glow(c); g.add(c);
  }
  if (dusk) lift(g, dusk === 1 ? 0.45 : 0.42);
  // живой воздух: острова тихо покачиваются, птицы кружат, ветер несёт лепестки
  ambientOf(g).add(c => isles.forEach(([o, y0], i) => { o.position.y = y0 + Math.sin(c.t * 0.5 + i * 1.3) * 0.28 * c.km; o.rotation.z = Math.sin(c.t * 0.3 + i) * 0.012 * c.km; }));
  if (dusk !== 2) birds(g, { n: 4, color: dusk === 1 ? 0x3a1830 : 0x2c3660, seed: layout + 7 });
  leaves(g, { n: 26, colors: [0xffb3d9, 0xffffff, 0xffd6ec, 0xfff2a0], seed: layout + 8, size: 0.22, fall: [0.25, 0.55], wind: 0.7, dim: dusk === 2 ? 0.55 : 1 });
}

export const palette: Palette = {
  kits: ['isles'],
  water: 0x5ad0ff,
  clouds: false,
  roles: {
    lm1: [['isles', 'tent_detailedClosed', 3.0], ['isles', 'statue_block', 2.8], ['isles', 'statue_ring', 3.2]],
    lm2: [['isles', 'statue_obelisk', 5.5], ['isles', 'statue_column', 5.0], ['isles', 'tree_tall_fall', 6.0]],
    lm3: [['isles', 'tent_smallOpen', 3.0], ['isles', 'statue_columnDamaged', 3.4]],
    lm4: [['isles', 'statue_ring', 5.2], ['isles', 'cliff_cave_rock', 4.4]],
    lm5: [['isles', 'cliff_stone', 3.0], ['isles', 'cliff_large_stone', 3.2]],
    lm6: [['isles', 'statue_column', 6.0], ['isles', 'statue_obelisk', 6.4]],
    bd1: [['hexcore', 'cloud_big', 4.0], ['isles', 'stone_tallB', 5.6], ['hexcore', 'hills_A', 3.4]],
    bd2: [['isles', 'stone_tallA', 6.0], ['hexcore', 'cloud_big', 5.0], ['isles', 'stone_tallB', 6.5]],
    bd3: [['isles', 'stone_tallB', 6.8]], bd4: [['isles', 'stone_tallA', 6.6], ['hexcore', 'cloud_big', 6.0]],
    tree: [['isles', 'tree_oak', 4.4], ['isles', 'tree_oak_fall', 4.4], ['isles', 'tree_fat_fall', 4.0], ['isles', 'tree_default', 4.5], ['isles', 'tree_simple_fall', 4.2], ['isles', 'tree_plateau', 4.0]],
    tall: [['isles', 'tree_tall_fall', 5.4], ['isles', 'tree_tall', 5.2], ['isles', 'tree_cone_fall', 5.4]],
    dead: [['isles', 'statue_columnDamaged', 3.2], ['isles', 'tree_thin_fall', 4.4]],
    rock: [['isles', 'stone_smallA', 1.0], ['isles', 'rock_smallFlatA', 0.8]],
    rockBig: [['isles', 'stone_largeA', 2.4], ['isles', 'stone_largeB', 2.4], ['isles', 'stone_tallA', 2.8]],
    bush: [['isles', 'plant_bush', 1.0], ['isles', 'plant_bushLarge', 1.3], ['isles', 'plant_bushDetailed', 1.1]],
    grass: [['isles', 'flower_purpleA', 0.8], ['isles', 'flower_yellowA', 0.8], ['isles', 'grass_large', 0.7], ['isles', 'flower_redA', 0.8]],
    c1: [['isles', 'sign', 2.4]], c2: [['isles', 'statue_column', 2.2]], c3: [['isles', 'statue_ring', 2.2]], c4: [['isles', 'log_stack', 1.3]], c5: [['isles', 'pot_large', 1.2]], c6: [['isles', 'campfire_logs', 0.8]],
    w1: [['isles', 'lily_large', 0.3]], w2: [['isles', 'lily_small', 0.16]], w3: [['hexcore', 'waterplant_A', 1.0], ['hexcore', 'waterplant_B', 1.0]],
  },
  crystals: [0x8fe3ff, 0xffb3e6, 0xfff2a0],
  extra,
};
