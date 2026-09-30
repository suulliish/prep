// Мир 8 «Затонувший храм»: дно с бирюзовым песком, мраморные руины и колонны, водоросли, обломки корабля.
// Модели: Kenney Nature Kit, Graveyard Kit, Survival Kit, Pirate Kit (CC0), KayKit Medieval Hexagon (CC0). Лучи света, пузыри и рыбы — кодом (extra).
import * as THREE from 'three';
import type { Palette } from '../worlds3d';
import { drift, gameGradient, paintNormal, recolorGround, tintMul } from './_fx789';
import { caustics } from '../ambient_fx';

const T = 'temple', H = 'hexcore';

/** Луч света с поверхности: вытянутая полупрозрачная полоса, светлее сверху; слегка дышит. */
function ray(g: THREE.Group, x: number, z: number, w: number, tilt: number, phase: number, tex: THREE.Texture) {
  const mat = new THREE.MeshBasicMaterial({ map: tex, color: 0xb8fff0, transparent: true, opacity: 0.3, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, 22), mat); m.position.set(x, 9, z); m.rotation.z = tilt; m.renderOrder = 2; m.frustumCulled = false;
  m.onBeforeRender = () => { mat.opacity = 0.26 + 0.1 * Math.sin(performance.now() / 1300 + phase); };
  g.add(m);
}
function rayTexture() {
  const cv = document.createElement('canvas'); cv.width = 32; cv.height = 128;
  const c = cv.getContext('2d')!, gv = c.createLinearGradient(0, 0, 0, 128);   // верх картинки = верх луча
  gv.addColorStop(0, 'rgba(255,255,255,1)'); gv.addColorStop(0.55, 'rgba(255,255,255,0.35)'); gv.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = gv; c.fillRect(0, 0, 32, 128);
  const gh = c.createLinearGradient(0, 0, 32, 0); gh.addColorStop(0, 'rgba(0,0,0,1)'); gh.addColorStop(0.5, 'rgba(0,0,0,0)'); gh.addColorStop(1, 'rgba(0,0,0,1)');
  c.globalCompositeOperation = 'destination-out'; c.fillStyle = gh; c.fillRect(0, 0, 32, 128);   // края луча растворяются
  return new THREE.CanvasTexture(cv);
}

/** Коралл: пучок расходящихся веток с круглыми кончиками (простые меши, мультяшный свет игры). */
function coral(g: THREE.Group, x: number, z: number, s: number, color: number, seed: number, grad: THREE.Texture | null) {
  const mat = new THREE.MeshToonMaterial({ color, emissive: color, emissiveIntensity: 0.25, gradientMap: grad });
  const branch = new THREE.CylinderGeometry(0.05, 0.13, 1, 6), tip = new THREE.SphereGeometry(0.11, 8, 6);
  const c = new THREE.Group(); c.position.set(x, 0, z); c.scale.setScalar(s); c.rotation.y = seed;
  const n = 6; for (let i = 0; i < n; i++) {
    const a = i / n * 6.28 + seed, tilt = 0.25 + 0.3 * ((i * 7 + seed * 3) % 3) / 2, h = 0.9 + 0.7 * (((i * 5) % 4) / 3);
    const b = new THREE.Group(); b.rotation.set(0, a, tilt);
    const st = new THREE.Mesh(branch, mat); st.scale.set(1, h, 1); st.position.y = h / 2; st.castShadow = true;
    const tp = new THREE.Mesh(tip, mat); tp.position.y = h; b.add(st, tp); c.add(b);
  }
  g.add(c);
}

/** Ламинария: цепочка сегментов с листьями, покачивается (каждый сегмент повёрнут относительно предыдущего). */
function kelp(g: THREE.Group, x: number, z: number, h: number, seed: number, grad: THREE.Texture | null) {
  const mat = new THREE.MeshToonMaterial({ color: 0x33b56a, emissive: 0x0d5a3a, emissiveIntensity: 0.5, gradientMap: grad, side: THREE.DoubleSide });
  const N = 7, sh = h / N, seg = new THREE.CylinderGeometry(0.07, 0.11, sh, 6), leaf = new THREE.SphereGeometry(1, 8, 5);
  const root = new THREE.Group(); root.position.set(x, 0, z); root.rotation.y = seed;
  const joints: THREE.Group[] = []; let parent: THREE.Object3D = root, lead: THREE.Mesh | null = null;
  for (let i = 0; i < N; i++) {
    const j = new THREE.Group(); j.position.y = i ? sh : 0; parent.add(j); joints.push(j); parent = j;
    const m = new THREE.Mesh(seg, mat); m.position.y = sh / 2; j.add(m); lead ??= m;
    const l = new THREE.Mesh(leaf, mat); l.scale.set(0.5 - i * 0.03, 0.05, 0.17); l.position.set(i % 2 ? 0.34 : -0.34, sh * 0.6, 0); l.rotation.z = i % 2 ? 0.5 : -0.5; j.add(l);
  }
  lead!.onBeforeRender = () => { const t = performance.now() / 1000; joints.forEach((j, i) => { j.rotation.z = 0.13 * Math.sin(t * 1.1 + seed + i * 0.55); j.rotation.x = 0.09 * Math.sin(t * 0.9 + seed * 2 + i * 0.4); }); };
  g.add(root);
}

/** Стая: рыбы плывут по кругу над островом (вне боевой полосы: центр смещён к заднику). */
function school(g: THREE.Group, kits: Map<string, import('../assets').Kit>, cx: number, cy: number, cz: number, rx: number, rz: number, n: number, speed: number, seed: number) {
  const kit = kits.get(T); if (!kit) return;
  for (let i = 0; i < n; i++) {
    const big = i % 4 === 0, f = kit.get(big ? 'fish-large' : 'fish', { height: big ? 0.5 : 0.42 });
    const holder = new THREE.Group(); holder.add(f); g.add(holder);
    const ph = (i / n) * 6.28 + seed, sy = cy + Math.sin(i * 2.3 + seed) * 0.9, k = 0.8 + (i % 3) * 0.15;
    // движение считает первый меш рыбы в onBeforeRender (отдельный цикл не нужен)
    let lead: THREE.Mesh | null = null; f.traverse(o => { if (!lead && (o as THREE.Mesh).isMesh) lead = o as THREE.Mesh; });
    if (lead) (lead as THREE.Mesh).onBeforeRender = () => {
      const t = performance.now() / 1000 * speed * k + ph, x = cx + Math.cos(t) * rx * k, z = cz + Math.sin(t) * rz * k;
      holder.position.set(x, sy + Math.sin(t * 3) * 0.15, z); holder.rotation.y = -t + Math.PI;
    };
  }
}

export const palette: Palette = {
  kits: [T],
  ground: { tile: 'hex_grass', color: 0x2fb5cf },
  water: 0x1b8fc4,
  clouds: false,
  crystals: [0x3ff0ff, 0x8affd8, 0xffffff], crystalsAlways: true,
  roles: {
    lm1: [[T, 'statue_ring', 3.4], [T, 'altar-stone', 2.4], [T, 'statue_block', 3.0]],
    lm2: [[T, 'pillar-obelisk', 5.6], [T, 'statue_obelisk', 5.4], [T, 'column-large', 5.4]],
    lm3: [[T, 'statue_head', 3.4], [T, 'altar-stone', 2.6]],
    lm4: [[T, 'crypt-large', 5.2]], lm5: [[T, 'stone-wall-damaged', 3.0], [T, 'stone-wall-column', 3.2]], lm6: [[T, 'column-large', 6.4], [T, 'statue_column', 6.0]],
    bd1: [[H, 'mountain_B', 6.0], [T, 'ship-wreck', 5.4], [H, 'mountain_C', 6.4]],
    bd2: [[T, 'ship-wreck', 5.0], [H, 'mountain_A', 5.6], [H, 'mountain_C', 6.6]],
    bd3: [[H, 'mountain_C', 6.8], [T, 'cliff_large_stone', 6.0]], bd4: [[H, 'mountain_B', 6.4], [T, 'cliff_large_stone', 6.0]],
    tree: [[T, 'statue_columnDamaged', 3.8], [T, 'pillar-square', 4.4], [T, 'statue_column', 4.0], [T, 'column-large', 4.6]],
    tall: [[T, 'column-large', 5.6], [T, 'pillar-obelisk', 5.2], [T, 'pillar-square', 5.0]],
    dead: [[T, 'statue_columnDamaged', 3.8], [T, 'rock_tallE', 3.0]],
    rock: [[T, 'rock_smallA', 0.9], [T, 'stone_smallA', 0.9], [T, 'rock_smallC', 0.8], [T, 'stone_smallC', 0.8]],
    rockBig: [[T, 'stone_largeA', 2.0], [T, 'rock_largeA', 1.8], [T, 'rocks-a', 2.4]],
    bush: [[T, 'plant_bushTriangle', 1.3], [T, 'plant_flatTall', 1.2], [T, 'plant_bushTriangle', 1.0]],
    grass: [[T, 'plant_flatTall', 0.8], [T, 'plant_bushTriangle', 0.7], [T, 'rock_smallFlatA', 0.15]],
    c1: [[T, 'statue_obelisk', 3.0]], c2: [[T, 'chest', 1.6]], c3: [[T, 'urn-round', 1.6]], c4: [[T, 'crate', 1.4]], c5: [[T, 'barrel', 1.4]], c6: [[T, 'cannon', 1.4]],
    w1: [[T, 'lily_large', 0.3]], w2: [[T, 'plant_bushTriangle', 1.1]], w3: [[T, 'plant_bushLargeTriangle', 1.8], [T, 'plant_flatTall', 1.6]],
  },
  extra(g, layout, kits) {
    // руины — морской мрамор: бок тёмно-бирюзовый, верх светлый (обросший)
    const stone = (n: string) => /^(statue_|pillar|column|altar|urn|stone-wall|brick-wall|crypt|rock_|stone_|rocks-|cliff_|border|cross|mountain_)/.test(n);
    const sunset = layout % 3 === 1;   // в закатных уголках (1, 4) оранжевый свет сдвигает бирюзу в зелень: красим синее
    paintNormal(g, stone, sunset ? 0x2f88ff : 0x4f9fbc, sunset ? 0x9ff0ff : 0xa0e8e6);
    if (sunset) recolorGround(g, 0x1f9ce8);
    tintMul(g, n => n === 'ship-wreck', 0xb4dccc);
    // лучи света с поверхности
    const tex = rayTexture();
    ([[-9, -9, 2.6, 0.22], [-2, -12, 3.4, 0.16], [6, -10, 2.8, 0.24], [12, -4, 2.4, 0.2], [-13, 2, 2.2, 0.18], [1, -15, 4.2, 0.12]] as const).forEach(([x, z, w, tilt], i) => ray(g, x, z, w, tilt, i * 1.7, tex));
    caustics(g, { area: [-15, 15, -13, 10], color: sunset ? 0x9ff0ff : 0xa8fff0, opacity: 0.3 });   // блики света на дне
    // пузыри и плавающая муть
    drift(g, { n: 46, area: [-13, 13, -13, 8], height: 9, speed: [0.4, 1.0], sway: 0.5, size: 0.24, colors: [0xdfffff, 0xa8fff0], seed: layout + 3, blending: THREE.NormalBlending, opacity: 0.55 });
    drift(g, { n: 40, area: [-14, 14, -14, 8], height: 8, speed: [0.05, 0.2], sway: 0.3, size: 0.1, colors: [0xffffff], seed: layout + 11, opacity: 0.5 });
    const grad = gameGradient(g);
    ([[-8.6, 4.6, 1.1, 0xff7ab0], [8.8, 5.4, 1.0, 0xff9a6a], [-10.8, -2.4, 1.3, 0xb58cff], [10.6, -2.6, 1.2, 0xff7ab0], [1.6, 7.4, 0.8, 0xff9a6a], [-4.6, 7.2, 0.9, 0xb58cff]] as const)
      .forEach(([x, z, sc, col], i) => coral(g, x, z, sc, col, i * 1.3, grad));
    ([[-11.6, 0.4, 5.0], [11.8, 0.6, 4.4], [-5.8, 7.0, 3.4], [6.0, 7.4, 3.8], [-12.2, -6.0, 5.6], [12.4, -6.4, 5.0], [-2.4, -11.4, 6.0]] as const)
      .forEach(([x, z, h], i) => kelp(g, x, z, h, i * 1.9, grad));
    school(g, kits, 0, 5.4, -6, 8, 4, 6, 0.32, layout);
  },
};
