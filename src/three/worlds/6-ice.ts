// Мир 6 «Ледяная изнанка»: снежные ёлки, домики и льдины из Kenney Hexagon Kit (снежная раскраска) и Holiday Kit (CC0); ледяные кристаллы и снегопад кодом.
import * as THREE from 'three';
import type { Palette } from '../worlds3d';
import type { IslandKits } from '../island3d';
import { rng } from '../ambient';
import { aurora, inBattle, softDot, sparkles } from '../ambient_fx';

/** Снегопад: точки падают по кругу, положение обновляется при отрисовке. */
function snowfall(): THREE.Points {
  const N = 220, geo = new THREE.BufferGeometry(), pos = new Float32Array(N * 3), seed = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) { seed[i * 3] = Math.random(); seed[i * 3 + 1] = Math.random(); seed[i * 3 + 2] = Math.random(); }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const p = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.2, map: softDot(), transparent: true, opacity: 0.95, depthWrite: false }));
  p.frustumCulled = false;
  const t0 = performance.now();
  p.onBeforeRender = () => {
    const t = (performance.now() - t0) / 1000;
    for (let i = 0; i < N; i++) {
      const a = seed[i * 3], b = seed[i * 3 + 1], c = seed[i * 3 + 2], fall = (b - t * (0.05 + 0.06 * c)) % 1;
      pos[i * 3] = -14 + a * 28 + Math.sin(t * 0.6 + a * 20) * 0.6; pos[i * 3 + 1] = (fall < 0 ? fall + 1 : fall) * 12; pos[i * 3 + 2] = -14 + c * 22;
    }
    (geo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
  };
  return p;
}

/** Свет закатного уголка красит снег в оранжевый: добавляем снегу холодное собственное свечение, чтобы он оставался белоголубым. */
function extra(g: THREE.Group, layout: number, _kits: IslandKits) {
  g.add(snowfall());
  aurora(g, { opacity: [0.6, 0.7, 0.85][layout % 3] });
  const R = rng(layout + 31), glints: [number, number, number][] = [];
  while (glints.length < 30) { const x = -13 + R() * 26, z = -12 + R() * 19; if (!inBattle(x, z)) glints.push([x, 0.12, z]); }
  sparkles(g, glints, { colors: [0xffffff, 0xa8f0ff, 0xdff8ff], size: 0.34, seed: layout + 32 });   // блёстки льда
  const tile = g.children.find(o => o.name === 'hex_grass') as THREE.Mesh | undefined;
  let mat: THREE.MeshToonMaterial | undefined; tile?.traverse(o => { const m = o as THREE.Mesh; if (!mat && m.isMesh) mat = m.material as THREE.MeshToonMaterial; });
  if (mat) { mat.emissive.set(0x8fd4f0); mat.emissiveIntensity = [0.12, 0.7, 0.3][layout % 3]; }
}

export const palette: Palette = {
  kits: ['ice'],
  ground: { tile: 'hex_grass', color: 0xe2f5fc },
  water: 0x8fe0ff,
  roles: {
    lm1: [['ice', 'unit-house', 3.2], ['ice', 'snow-bunker', 2.4], ['ice', 'unit-mansion', 3.4]],
    lm2: [['ice', 'unit-mill', 5.2], ['ice', 'unit-tower', 5.5], ['ice', 'unit-mansion', 4.4]],
    lm3: [['ice', 'unit-mansion', 3.4], ['ice', 'unit-house', 3.6]],
    lm4: [['ice', 'unit-wall-tower', 5.2]], lm5: [['ice', 'rocks-large', 2.8], ['ice', 'unit-wall-tower', 3.4]], lm6: [['ice', 'unit-tower', 6.4], ['ice', 'unit-wall-tower', 5.8]],
    bd1: [['ice', 'stone-mountain', 5.0], ['ice', 'stone-hill', 3.6]], bd2: [['ice', 'stone-mountain', 6.0], ['ice', 'grass-forest', 4.0]],
    bd3: [['ice', 'stone-mountain', 6.4]], bd4: [['ice', 'stone-mountain', 6.0]],
    tree: [['ice', 'tree-snow-a', 4.4], ['ice', 'tree-snow-b', 4.8], ['ice', 'tree-snow-c', 4.2], ['ice', 'unit-tree', 3.6]],
    tall: [['ice', 'tree-snow-b', 5.6], ['ice', 'tree-snow-a', 5.2]],
    dead: [['ice', 'lantern', 3.4], ['ice', 'snowman', 2.4]],
    rock: [['ice', 'rocks-small', 0.9], ['ice', 'rocks-medium', 1.1], ['ice', 'snow-pile', 0.7]],
    rockBig: [['ice', 'rocks-large', 2.4]],
    bush: [['ice', 'snow-pile', 0.9], ['ice', 'rocks-small', 0.8]],
    grass: [['ice', 'snow-pile', 0.5], ['ice', 'candy-cane-red', 0.8]],
    c1: [['ice', 'nutcracker', 2.4]], c2: [['ice', 'sled-long', 1.2]], c3: [['ice', 'snowman-hat', 2.2]], c4: [['ice', 'sled', 1.0]], c5: [['ice', 'candy-cane-red', 1.4]], c6: [['ice', 'reindeer', 1.8]],
    w1: [['ice', 'snow-flat-large', 0.2]], w2: [['ice', 'snow-flat', 0.2]], w3: [['ice', 'rocks-small', 0.9]],
  },
  crystals: [0xa8f0ff, 0xdff8ff, 0x7ad8ff], crystalsAlways: true,
  extra,
};
