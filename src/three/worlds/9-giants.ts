// Мир 9 «Мир великанов»: песчаная пустыня, где стоят гигантские вещи (лампа, холодильник, стул, торт, тыква) и кактусы.
// Модели: Kenney Food Kit, Furniture Kit, Survival Kit, Nature Kit (CC0), KayKit Medieval Hexagon (CC0). Пыль, следы великана и солнце — кодом (extra).
import * as THREE from 'three';
import type { Palette } from '../worlds3d';
import { drift, dotTexture, paintNormal, recolorGround, tintMul } from './_fx789';
import { birds, fireflies } from '../ambient_fx';
import { spotTime } from '../spots';

const K = 'giants', H = 'hexcore';

/** След великана: овальная вмятина и пять пальцев (плоские фигуры на земле, вне боевой полосы). */
function footprint(g: THREE.Group, x: number, z: number, rot: number, s: number) {
  const mat = new THREE.MeshBasicMaterial({ color: 0xb9823f }), rim = new THREE.MeshBasicMaterial({ color: 0xf0c88a });
  const grp = new THREE.Group(); grp.position.set(x, 0.02, z); grp.rotation.y = rot; grp.scale.setScalar(s);
  const oval = new THREE.CircleGeometry(1, 20), flat = (m: THREE.Material, sx: number, sz: number, px: number, pz: number, y: number) => {
    const o = new THREE.Mesh(oval, m); o.rotation.x = -Math.PI / 2; o.scale.set(sx, sz, 1); o.position.set(px, y, pz); o.renderOrder = 1; grp.add(o);
  };
  flat(rim, 1.25, 2.45, 0, 0, 0); flat(mat, 1.1, 2.3, 0, 0, 0.01);                          // пятка и подошва с валиком по краю
  [[-0.85, -2.7, 0.42], [-0.35, -3.05, 0.36], [0.15, -3.1, 0.34], [0.6, -2.95, 0.32], [1.0, -2.6, 0.28]].forEach(([px, pz, r]) => { flat(rim, r * 1.2, r * 1.2, px, pz, 0); flat(mat, r, r, px, pz, 0.01); });
  g.add(grp);
}

export const palette: Palette = {
  kits: [K],
  ground: { tile: 'hex_grass', color: 0xe3ad66 },
  water: 0xdce8ff,
  clouds: true,
  crystals: [0xffd35a, 0xff8fb0, 0xfff2c0],
  roles: {
    lm1: [[K, 'chair', 4.6], [K, 'cup', 3.6], [K, 'pot-stew', 3.0], [K, 'toaster', 3.4]],
    lm2: [[K, 'lampSquareFloor', 7.0], [K, 'coatRackStanding', 6.6], [K, 'pepper-mill', 5.4], [K, 'ice-cream-cne', 5.4]],
    lm3: [[K, 'kitchenStove', 3.8], [K, 'cake-birthday', 3.0], [K, 'sideTable', 3.2], [K, 'tajine', 3.0]],
    lm4: [[K, 'bookcaseClosedWide', 5.4], [K, 'kitchenFridgeLarge', 5.6]], lm5: [[K, 'bookcaseOpen', 3.6], [K, 'washer', 3.2], [K, 'stoolBar', 3.4]],
    lm6: [[K, 'lampRoundFloor', 7.0], [K, 'coatRackStanding', 7.0], [K, 'kitchenFridgeLarge', 6.6]],
    bd1: [[K, 'loungeSofaLong', 5.6], [H, 'mountain_B', 6.0], [K, 'cake-birthday', 5.0]],
    bd2: [[K, 'bookcaseClosedWide', 7.0], [H, 'mountain_A', 5.6], [K, 'televisionVintage', 6.0]],
    bd3: [[K, 'kitchenFridgeLarge', 8.0], [H, 'mountain_C', 6.8], [K, 'cliff_large_rock', 6.0]],
    bd4: [[H, 'mountain_B', 6.4], [K, 'washer', 6.4], [K, 'burger-double', 5.0]],
    tree: [[K, 'cactus_tall', 4.6], [K, 'cactus_short', 3.8], [K, 'cactus_tall', 5.2]],
    tall: [[K, 'cactus_tall', 6.0], [K, 'lollypop', 5.4], [K, 'pepper-mill', 5.0]],
    dead: [[K, 'soda-can', 3.4], [K, 'ice-cream-cne', 4.2], [K, 'lollypop', 4.0]],
    rock: [[K, 'rock_smallA', 0.9], [K, 'rock_smallB', 1.0], [K, 'rock_smallC', 0.8], [K, 'rock_smallD', 0.9]],
    rockBig: [[K, 'pumpkin', 2.6], [K, 'watermelon', 2.8], [K, 'rock_tallB', 2.4], [K, 'cheese', 2.0], [K, 'apple', 2.4]],
    bush: [[K, 'cactus_short', 1.4], [K, 'apple', 1.2], [K, 'loaf-round', 1.0], [K, 'egg', 1.2]],
    grass: [[K, 'grass', 0.7], [K, 'grass_large', 0.8], [K, 'grass', 0.6]],
    c1: [[K, 'lollypop', 3.0]], c2: [[K, 'chest', 1.6]], c3: [[K, 'soda-can', 2.0]], c4: [[K, 'box-large', 1.6]], c5: [[K, 'barrel', 1.5]], c6: [[K, 'cup', 1.8]],
    w1: [[K, 'donut-sprinkles', 0.5]], w2: [[K, 'cookie-chocolate', 0.3]], w3: [[K, 'ice-cream-cne', 1.4], [K, 'lollypop', 1.6]],
  },
  extra(g, layout) {
    // камень — каньонный: бок красно-бурый, верх светлый песчаник (вместо мшисто-бирюзового из пака)
    paintNormal(g, n => /^(rock_|cliff_|mountain_)/.test(n), 0xb9713a, 0xe8bd7c);
    paintNormal(g, n => n.startsWith('cactus_'), 0x4f9a3c, 0x78bd54);
    paintNormal(g, n => n.startsWith('grass'), 0xb8983f, 0xe6c46a);
    tintMul(g, n => n.startsWith('cloud'), 0xffe2b0);
    // закат красит песок в оранжевый, ночью земля почти чёрная: подбираем светлее
    if (layout % 3 === 1) recolorGround(g, 0xf6e2b8); else if (layout % 3 === 2) recolorGround(g, 0xffbb66);
    // следы великана по краям (боевая полоса z −0.5…2.2 свободна)
    footprint(g, -9.6, 4.8, 0.5, 1.0); footprint(g, 9.2, 6.4, -0.3, 1.1);
    // пыль в воздухе и тёплое солнечное пятно на заднем плане
    drift(g, { n: 50, area: [-14, 14, -13, 8], height: 7, speed: [0.05, 0.25], sway: 0.6, size: 0.5, colors: [0xf3d9a4, 0xe8c58a], seed: layout + 5, blending: THREE.NormalBlending, opacity: 0.28 });
    // пыльца: тёплые золотые пылинки блуждают над песком; вдали кружат птицы
    fireflies(g, { n: 38, area: [-13, 13, 0.5, 5, -12, 6], colors: [0xfff2a0, 0xffe08a, 0xffffff], size: 0.17, wander: 0.9, pulse: 0.25, speed: 0.7, opacity: 0.9, seed: layout + 6 });
    if (spotTime(layout) !== 2) birds(g, { n: 3, color: 0x4a2a1a, seed: layout + 7 });
    const sun = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTexture(), color: 0xffd58a, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    sun.scale.set(26, 20, 1); sun.position.set(5, 12, -28); g.add(sun);
  },
};
