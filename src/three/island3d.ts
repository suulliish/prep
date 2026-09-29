// Боевой остров из готовых шестигранных плиток (KayKit Hexagon) с декором. Земля — верх плитки, y = 0.
// Композиция задаётся «уголком» темы (spots.ts: 6 раскладок, LAYOUTS), а чем заполнены места — палитрой мира (worlds3d.ts).
// Боевая полоса (x −4.2…4.4, z −0.5…2.2) свободна: там стоят герой и враг.
import * as THREE from 'three';
import { Kit } from './assets';
import { paletteOf, type Palette, type Role } from './worlds3d';

const TS = 3;                       // плитка KayKit (шестиугольник с вершиной к камере, ширина 2, R = 1.1547) ×3 → ширина 6
const R = 1.1547 * TS;              // радиус описанной окружности

/** Место под предмет: роль, x, z, поворот, множитель размера. */
type Slot = [Role, number, number, number, number?];
const LAYOUTS: Slot[][] = [
  // 0 Алаң: луг, два ориентира
  [['lm1', -3.2, -7.2, 0.5], ['lm2', 3.4, -7.6, -0.4], ['bd1', -9.2, -4.8, 0.3], ['bd2', 9.6, -5.2, -0.4], ['tree', -8.6, 1.2, 0], ['tree', 8.8, 0.8, 1], ['tree', 0.2, -8.8, 2], ['tree', -6.2, -5.6, 1, 0.85],
    ['rock', -6.6, 4.2, 0.5], ['rock', 7.2, 4.4, 0], ['bush', -4.6, 5.6, 0], ['bush', 4.4, 6.0, 1], ['grass', -2.2, 4.8, 0], ['grass', 2.4, 5.2, 0], ['grass', 6.2, 1.8, 0], ['grass', -6.8, 1.6, 1]],
  // 1 Үстірт: лагерь на плато
  [['bd1', -7.5, -8, 0.4, 1.1], ['bd2', 8.5, -8.5, 2.2], ['lm1', -5.5, -5.8, 0.6], ['c1', -3.2, -6.5, 0], ['c2', 3.4, -6.2, 0.2], ['c3', 6.4, -4.6, -0.7], ['c4', -8.2, -1.6, 0.4], ['c5', -8.8, -0.4, 0], ['c6', 8.2, 3.6, -0.5],
    ['rockBig', 9.4, 0.6, 0], ['rock', -9.4, 3.2, 1], ['tree', -10.4, -5, 0], ['grass', -3.4, 5.0, 0], ['grass', 3.6, 5.4, 1]],
  // 2 Көл: пруд у леса (две плитки воды сзади слева)
  [['w1', -3.4, -4.4, 0], ['w2', -5.0, -3.2, 1], ['w3', -6.6, -5.4, 0], ['w3', -2.0, -6.0, 0.5], ['bd2', 8.6, -6.4, 0], ['bd1', -9.4, -7.4, 0.5], ['tree', 6.4, -8.6, 1], ['tree', -8.6, 2.4, 0],
    ['rock', 7.6, 3.8, 0], ['bush', -6.2, 5.0, 0], ['bush', 5.2, 5.6, 1], ['grass', 2.6, 5.0, 0], ['grass', -3.0, 5.4, 0]],
  // 3 Орман: густой лес по кругу
  [['tree', -8.0, -3.4, 0], ['tall', -5.2, -7.2, 1], ['tree', -1.6, -8.6, 2], ['tall', 2.4, -8.2, 0], ['tree', 6.0, -6.8, 1], ['tall', 9.0, -2.6, 0.4], ['tree', 9.4, 2.4, 1], ['tall', -9.2, 2.0, 0],
    ['bush', -6.0, 4.6, 0], ['bush', 6.4, 4.4, 1], ['rock', -3.6, -5.4, 0], ['grass', 3.0, 5.0, 0], ['grass', -2.4, 5.2, 1], ['lm3', 4.6, -5.0, 0]],
  // 4 Қирандылар: развалины
  [['lm4', 0.0, -7.6, 0], ['lm5', -5.4, -7.0, 0.3], ['lm5', 5.4, -7.0, -0.3], ['lm6', -9.0, -4.4, 0], ['rockBig', 7.8, -2.6, 0], ['rock', -7.6, 0.2, 1], ['dead', 9.2, 1.6, 0], ['dead', -9.6, 3.0, 1],
    ['rock', 3.8, -4.4, 0, 0.8], ['bush', -4.6, 5.4, 0], ['grass', 4.0, 5.2, 0], ['rock', -3.0, -4.6, 0.6]],
  // 5 Кристалдар: скалы и кристаллы
  [['bd3', -8.4, -8.0, 0.4], ['bd4', 8.6, -8.2, 2.0], ['rockBig', -6.0, -4.4, 0], ['rockBig', 6.0, -4.8, 1], ['rock', 0.4, -7.0, 0, 1.4], ['rock', -9.0, 1.8, 0], ['rock', 9.0, 2.4, 1], ['dead', 4.0, -8.6, 0], ['rock', -3.8, 5.2, 0, 0.7], ['rock', 3.6, 5.6, 1, 0.7]],
];
/** Клетки-пруды (q, r) для «Көл» — вместо травы вода. */
const PONDS: [number, number][][] = [[], [], [[-1, -1], [0, -1]], [], [], []];

/** Кристаллы: пучки светящихся граней. */
function crystals(g: THREE.Group, colors: number[], list: [number, number, number][]) {
  const geo = new THREE.OctahedronGeometry(1, 0);
  list.forEach(([x, z, s], i) => {
    const c = colors[i % colors.length];
    const m = new THREE.Mesh(geo, new THREE.MeshToonMaterial({ color: c, emissive: c, emissiveIntensity: 1.1 }));
    m.scale.set(0.42 * s, 1.0 * s, 0.42 * s); m.position.set(x, 1.0 * s, z); m.rotation.y = i; m.rotation.z = 0.12 * (i % 3 - 1); m.castShadow = true; g.add(m);
    const b = new THREE.Mesh(geo, m.material); b.scale.set(0.3 * s, 0.7 * s, 0.3 * s); b.position.set(x + 0.4 * s, 0.7 * s, z + 0.2 * s); b.rotation.set(0.3, i * 2, 0.4); g.add(b);
  });
}
const CRYSTAL_SPOTS: [number, number, number][] = [[-6.6, -3.6, 1.3], [-7.4, -2.6, 0.8], [6.8, -3.2, 1.5], [7.6, -2.0, 0.9], [-1.2, -6.6, 1.1], [2.2, -6.4, 0.8], [-9.4, 0.4, 1.0], [9.6, 0.6, 1.1]];

export type IslandKits = Map<string, Kit>;
/** Наборы, нужные миру: его собственные + общие (плитки). */
export async function loadIslandKits(worldK: number): Promise<IslandKits> {
  const ids = [...new Set(['hexcore', ...paletteOf(worldK).kits])];
  const kits = await Promise.all(ids.map(Kit.load));
  return new Map(ids.map((id, i) => [id, kits[i]]));
}

/** Собрать остров. colA — цвет земли мира (из worlds.mjs), v — вариант уголка. */
export function buildIsland(kits: IslandKits, worldK: number, colA: number, v: number): THREE.Group {
  const g = new THREE.Group(), pal: Palette = paletteOf(worldK), hex = kits.get('hexcore')!, layout = v % LAYOUTS.length;
  // плитка — одна ячейка палитры: вместо текстуры ставим ровный цвет, получается точно заданный оттенок
  const flat = (tile: string, color: number) => {
    let src: THREE.Material | null = null; hex.get(tile).traverse(o => { if (!src && (o as THREE.Mesh).isMesh) src = (o as THREE.Mesh).material as THREE.Material; });
    const m = (src as unknown as THREE.MeshToonMaterial).clone(); m.map = null; m.color.set(color); return m;
  };
  const groundTile = pal.ground?.tile ?? 'hex_grass';
  const groundMat = flat(groundTile, pal.ground?.color ?? colA);
  const waterMat = pal.water ? flat('hex_water', pal.water) : null;
  const at = (q: number, r: number) => new THREE.Vector3(Math.sqrt(3) * R * (q + r / 2), 0, 1.5 * R * r);
  const ponds = new Set(PONDS[layout].map(([q, r]) => `${q},${r}`));
  const N = 3;
  for (let q = -N; q <= N; q++) for (let r = -N; r <= N; r++) {
    if (Math.abs(q + r) > N) continue;
    const pond = !!waterMat && ponds.has(`${q},${r}`);
    const t = hex.get(pond ? 'hex_water' : groundTile, { shadows: true }); t.scale.setScalar(TS); t.position.copy(at(q, r));
    t.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh) { m.material = pond ? waterMat! : groundMat; m.castShadow = false; m.receiveShadow = true; } });
    g.add(t);
  }
  // декор: место → роль → предмет из палитры мира (выбор по номеру места, стабильный)
  LAYOUTS[layout].forEach(([role, x, z, rot, s = 1], i) => {
    const list = pal.roles[role]; if (!list?.length) return;
    const [kit, name, h] = list[(i + layout) % list.length];
    const k = kits.get(kit); if (!k || !k.has(name)) return;
    const o = k.get(name, { height: h * s, ground: true }); o.position.set(x, 0, z); o.rotation.y = rot; g.add(o);
  });
  // облака над островом
  if (pal.clouds !== false) for (const [x, y, z, s] of [[-16, 5, -14, 2.4], [17, 7, -6, 2.0], [6, 11, -30, 2.6], [-10, 13, -34, 2.8]] as const) {
    const c = hex.get(s > 2.5 ? 'cloud_big' : 'cloud_small', { shadows: false }); c.scale.setScalar(s); c.position.set(x, y, z); g.add(c);
  }
  if (pal.crystals && (layout === 5 || pal.crystalsAlways)) crystals(g, pal.crystals, CRYSTAL_SPOTS);
  pal.extra?.(g, layout, kits);
  return g;
}
