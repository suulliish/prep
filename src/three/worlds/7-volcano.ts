// Мир 7 «Вулкан»: тёмно-красная земля, чёрные скалы и обугленные деревья, лава и искры.
// Модели: Kenney Nature Kit и Graveyard Kit (CC0), KayKit Forest и Medieval Hexagon (CC0); окраска и лава — кодом (extra).
import * as THREE from 'three';
import type { Palette } from '../worlds3d';
import { dotTexture, drift, paintNormal, recolorGround } from './_fx789';
import { ambientOf } from '../ambient';
import { eruption } from '../ambient_fx';

const V = 'volcano', H = 'hexcore', F = (n: string) => `${n}_Color1`;
const LAVA = 0xff6a1a, LAVA_HOT = 0xffc94a, LAVA_RIM = 0x8a1e08;

/** Лужа лавы: тёмный ободок, оранжевая заливка и светлое «ядро»; светится ровно (MeshBasic), слегка пульсирует. */
function pool(g: THREE.Group, x: number, z: number, r: number, sx = 1, sz = 1, seed = 0) {
  const geo = new THREE.CircleGeometry(1, 16);
  const layer = (rad: number, color: number, y: number, k: number) => {
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color }));
    m.rotation.x = -Math.PI / 2; m.rotation.z = seed; m.scale.set(r * rad * sx, r * rad * sz, 1); m.position.set(x, y, z); m.renderOrder = 1;
    const base = new THREE.Color(color);
    m.onBeforeRender = () => { const p = 0.86 + 0.14 * Math.sin(performance.now() / 700 * k + seed * 5); (m.material as THREE.MeshBasicMaterial).color.copy(base).multiplyScalar(p); };
    g.add(m); return m;
  };
  layer(1.12, LAVA_RIM, 0.025, 0); layer(1, LAVA, 0.035, 1); layer(0.55, LAVA_HOT, 0.045, 1.7);
}

/** Вулкан на заднем плане: конус с кратером, свечением и потёками лавы вдоль граней. */
function volcano(g: THREE.Group, x: number, z: number, h: number, rBase: number): THREE.Sprite {
  const SIDES = 9, rTop = rBase * 0.16, y0 = -0.4, apo = Math.cos(Math.PI / SIDES);
  const coneGeo = new THREE.CylinderGeometry(rTop, rBase, h, SIDES, 1, true).toNonIndexed(); coneGeo.computeVertexNormals();   // грани плоские
  const cone = new THREE.Mesh(coneGeo, new THREE.MeshToonMaterial({ color: 0x3b2528 }));
  cone.position.set(x, y0 + h / 2, z); cone.castShadow = true; g.add(cone);
  const crater = new THREE.Mesh(new THREE.CircleGeometry(rTop * 0.95, SIDES), new THREE.MeshBasicMaterial({ color: LAVA_HOT }));
  crater.rotation.x = -Math.PI / 2; crater.position.set(x, y0 + h + 0.02, z); g.add(crater);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTexture(), color: LAVA, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  glow.scale.set(rBase * 1.5, rBase * 1.1, 1); glow.position.set(x, y0 + h + 0.8, z + 0.5); g.add(glow);
  // потёки: узкие светящиеся полосы, лежащие на гранях (ширина растёт книзу, каждая на своей грани)
  const flows: [THREE.MeshBasicMaterial, THREE.Color][] = [];
  [[0, 0.62, 0.2], [2, 0.9, 0.26], [4, 0.5, 0.18], [5, 0.8, 0.22], [7, 0.7, 0.2]].forEach(([k, len, w], i) => {
    const a = (k + 0.5) * 2 * Math.PI / SIDES, pts: number[] = [];
    const at = (t: number, side: number) => { // t: 0 у кратера, 1 у подножия; side: ±1 — левый/правый край полосы
      const r = (rTop + (rBase - rTop) * t) * apo + 0.03, wd = (w * 0.7 + t * 0.28) * side;
      return [x + Math.sin(a) * r + Math.cos(a) * wd, y0 + h * (1 - t), z + Math.cos(a) * r - Math.sin(a) * wd];
    };
    const N = 6; for (let j = 0; j <= N; j++) { const t = 0.04 + len * j / N; pts.push(...at(t, -1), ...at(t, 1)); }
    const idx: number[] = []; for (let j = 0; j < N; j++) { const o = j * 2; idx.push(o, o + 1, o + 2, o + 1, o + 3, o + 2); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)); geo.setIndex(idx);
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: i % 2 ? LAVA : LAVA_HOT, side: THREE.DoubleSide })); m.renderOrder = 1; g.add(m);
    flows.push([m.material as THREE.MeshBasicMaterial, new THREE.Color(i % 2 ? LAVA : LAVA_HOT)]);
  });
  ambientOf(g).add(c => flows.forEach(([m, base], i) => m.color.copy(base).multiplyScalar(0.82 + 0.18 * Math.sin(c.t * 1.6 * c.km + i * 1.3))));   // потёки лавы пульсируют
  return glow;
}

export const palette: Palette = {
  kits: [V, 'forest'],
  ground: { tile: 'hex_grass', color: 0x8c4227 },
  water: LAVA,
  clouds: true,
  crystals: [0xff7a1a, 0xffc94a, 0xff3a1a],
  roles: {
    lm1: [[V, 'crypt', 3.0], [V, 'fire-basket', 2.4], [V, 'crypt-small', 2.8]],
    lm2: [[V, 'statue_obelisk', 6.0], [V, 'pillar-obelisk', 5.6], [V, 'pillar-large', 5.4]],
    lm3: [[V, 'crypt-large', 3.6], [V, 'altar-stone', 2.2]],
    lm4: [[V, 'crypt-large', 5.4]], lm5: [[V, 'stone-wall-damaged', 3.0], [V, 'stone-wall-column', 3.2]], lm6: [[V, 'column-large', 6.2], [V, 'pillar-large', 6.0]],
    bd1: [[H, 'mountain_B', 6.0], [H, 'mountain_C', 6.4], [H, 'mountain_A', 5.5]],
    bd2: [[H, 'mountain_A', 5.6], [H, 'mountain_C', 6.6]],
    bd3: [[H, 'mountain_C', 6.8], [V, 'rock_tallB', 6.0]], bd4: [[H, 'mountain_B', 6.4], [V, 'rock_tallA', 6.0]],
    tree: [[V, F('Tree_Bare_1_A'), 4.4], [V, F('Tree_Bare_2_B'), 4.0], [V, F('Tree_Bare_1_C'), 4.6], [V, F('Tree_Bare_2_A'), 3.8]],
    tall: [[V, F('Tree_Bare_2_C'), 5.4], [V, F('Tree_Bare_1_B'), 5.0], [V, 'rock_tallC', 4.4]],
    dead: [[V, F('Tree_Bare_1_A'), 4.0], [V, 'pine-crooked', 3.2]],
    rock: [[V, 'rock_smallA', 0.9], [V, 'rock_smallB', 1.0], [V, 'rock_smallC', 0.8], [V, 'rock_smallD', 1.0]],
    rockBig: [[V, 'rock_tallD', 2.8], [V, 'rock_tallB', 2.6], [V, 'rock_tallE', 2.4]],
    bush: [[V, 'rocks', 1.1], [V, 'rocks-tall', 1.2], [V, 'debris', 0.7]],
    grass: [[V, 'rock_smallFlatA', 0.12], [V, 'rock_smallFlatB', 0.12], [V, 'debris', 0.35]],
    c1: [[H, 'flag_red', 3.0]], c2: [[V, 'fire-basket', 1.8]], c3: [[H, 'weaponrack', 2.0]], c4: [[H, 'crate_A_big', 1.5]], c5: [[H, 'barrel', 1.4]], c6: [[V, 'urn-round', 1.3]],
    w1: [[V, 'rock_smallFlatA', 0.5]], w2: [[V, 'rock_smallB', 0.8]], w3: [[V, 'rock_tallE', 1.8], [V, 'rock_tallG', 1.6]],
  },
  extra(g, layout) {
    // окраска: камень и постройки — чёрно-бурые, верх светлее; деревья — уголь
    const stone = (n: string) => /^(rock_|stone_|cliff_|mountain_|rocks|debris|statue_|pillar|column|crypt|stone-wall|altar|urn|iron-fence|cross|trunk|pine-crooked)/.test(n);
    paintNormal(g, stone, 0x2a1b1f, 0x4f3a3d, 0x120400);
    paintNormal(g, n => n.startsWith('Tree_Bare'), 0x1e1618, 0x3a2b2c, 0x0d0300);
    paintNormal(g, n => n === 'fire-basket', 0x2a1b1f, 0xffa22e, 0xc84a0a);
    paintNormal(g, n => n.startsWith('cloud'), 0x4a3a3e, 0x6e5a5c);
    if (layout % 3 === 2) recolorGround(g, 0xc8683a);   // ночью земля иначе почти чёрная
    // лава: лужи по краям, вне боевой полосы
    if (layout === 2) { // «Көл»: вместо воды в двух клетках-прудах — лава
      const hex = new THREE.CircleGeometry(3.3, 6);
      for (const x of [-9.0, -3.0]) {
        const m = new THREE.Mesh(hex, new THREE.MeshBasicMaterial({ color: LAVA })); m.rotation.x = -Math.PI / 2; m.rotation.z = Math.PI / 6; m.position.set(x, 0.05, -5.2); m.renderOrder = 1; g.add(m);
        const c = new THREE.Mesh(new THREE.CircleGeometry(1.6, 12), new THREE.MeshBasicMaterial({ color: LAVA_HOT })); c.rotation.x = -Math.PI / 2; c.position.set(x + 0.4, 0.06, -5.0); c.renderOrder = 1; g.add(c);
      }
    } else {
      pool(g, -9.6, -1.6, 1.5, 1.3, 0.9, 1); pool(g, 9.4, -1.2, 1.3, 1.2, 1, 2); pool(g, 0.4, -10.6, 2.2, 1.9, 0.9, 3);
      pool(g, -11.5, 4.6, 1.8, 1.2, 1, 4); pool(g, 11.6, 5.2, 1.6, 1.2, 1, 5);
    }
    const glow = volcano(g, 0, -15.5, 11, 6.2);
    const hot = [LAVA, LAVA_HOT, 0xff8a2a, 0xffe08a];
    eruption(g, { src: [[0, 10.7, -15.5]], glow, colors: hot, seed: layout, life: [2.4, 3.8], spread: 3 });   // выброс из кратера
    // всплески лавы из луж: искры прыгают невысоко, часто, вне боевой полосы
    const spots: [number, number, number][] = layout === 2 ? [[-9, 0.1, -5.2], [-3, 0.1, -5.2]] : [[-9.6, 0.1, -1.6], [9.4, 0.1, -1.2], [0.4, 0.1, -10.6], [-11.5, 0.1, 4.6], [11.6, 0.1, 5.2]];
    eruption(g, { src: spots, colors: hot, n: 16, power: 0.42, every: [1.4, 3.2], seed: layout + 1 });
    drift(g, { n: 70, area: [-14, 14, -14, 9], height: 9, speed: [0.5, 1.5], sway: 0.6, size: 0.32, colors: [LAVA, LAVA_HOT, 0xff8a2a], seed: layout });
  },
};
