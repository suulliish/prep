// Мир 10 «Башня Глитча»: тёмно-розовое логово злодея. Фиолетовые башни и розовые кристаллы (Kenney Tower Defense Kit, CC0),
// тёмные скалы (KayKit Hexagon, CC0) и глитч кодом: мерцающие цветные прямоугольники и «сбойные» полосы.
import * as THREE from 'three';
import type { Palette } from '../worlds3d';
import { ambientOf } from '../ambient';
import { pixels, pulseEmissive } from '../ambient_fx';

const G = 'glitch', H = 'hexcore';
const TW = (n: string) => `tower-square-build-${n}`;

/** Окрасить модели по имени (умножение на цвет): скалы из зелёных становятся тёмно-фиолетовыми. */
function tint(g: THREE.Group, match: (name: string) => boolean, color: number) {
  const cache = new Map<THREE.Material, THREE.Material>();
  for (const o of g.children) {
    if (!match(o.name)) continue;
    o.traverse(n => {
      const m = n as THREE.Mesh; if (!m.isMesh || m.userData.outline) return;
      const src = m.material as THREE.MeshToonMaterial;
      if (!cache.has(src)) { const c = src.clone(); c.color.multiply(new THREE.Color(color)); cache.set(src, c); }
      m.material = cache.get(src)!;
    });
  }
}

const NEON = [0xff4fb8, 0x3ff0ff, 0xb58cff, 0xff9be0];
/** Глитч: прямоугольники-«экраны» мерцают и прыгают. Анимация — в onBeforeRender, отдельный цикл не нужен. */
function glitch(g: THREE.Group, layout: number) {
  const rnd = (() => { let s = 1234 + layout * 77; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); })();
  const geo = new THREE.PlaneGeometry(1, 1);
  const add = (x: number, y: number, z: number, w: number, h: number, ci: number, rotX = 0, phase = 0, base = 0.5) => {
    const mat = new THREE.MeshBasicMaterial({ color: NEON[ci % NEON.length], transparent: true, opacity: base, depthWrite: false, side: THREE.DoubleSide });
    const m = new THREE.Mesh(geo, mat); m.scale.set(w, h, 1); m.position.set(x, y, z); m.rotation.x = rotX; m.renderOrder = 2; m.frustumCulled = false;
    const x0 = x;
    m.onBeforeRender = () => {
      const t = performance.now() / 1000 + phase, k = Math.floor(t * 9), hsh = Math.sin(k * 12.9898 + phase * 78.233) * 43758.5453, r = hsh - Math.floor(hsh);
      mat.opacity = r > 0.72 ? 0 : base * (0.45 + r);         // часть кадров — погашен
      m.position.x = x0 + (r > 0.85 ? (r - 0.9) * 8 : 0);       // редкие «срывы» вбок
    };
    g.add(m);
  };
  // вертикальные экраны за задником и по бокам (вне боевой полосы)
  for (let i = 0; i < 9; i++) add(-13 + i * 3.2 + rnd(), 2 + rnd() * 6, -12.5 - rnd() * 2, 1 + rnd() * 2.6, 0.5 + rnd() * 2.2, i, 0, rnd() * 9, 0.42);
  for (let i = 0; i < 4; i++) add(-12.5 + rnd() * 1.5, 1 + rnd() * 3.5, -3 + rnd() * 6, 0.6 + rnd() * 1.4, 0.4 + rnd() * 1.4, i + 1, 0, rnd() * 9, 0.35);
  for (let i = 0; i < 4; i++) add(12 + rnd() * 1.5, 1 + rnd() * 3.5, -3 + rnd() * 6, 0.6 + rnd() * 1.4, 0.4 + rnd() * 1.4, i, 0, rnd() * 9, 0.35);
  // сбойные полосы, лежащие на земле вдоль краёв острова (боевая полоса чистая)
  for (let i = 0; i < 6; i++) add(-10 + i * 4 + rnd() * 2, 0.04, -5.5 - rnd() * 2, 1.4 + rnd() * 2.4, 0.16 + rnd() * 0.2, i, -Math.PI / 2, rnd() * 9, 0.7);
  for (let i = 0; i < 5; i++) add(-9 + i * 4.5 + rnd() * 2, 0.04, 5.6 + rnd() * 1.6, 1.4 + rnd() * 2.4, 0.16 + rnd() * 0.2, i + 2, -Math.PI / 2, rnd() * 9, 0.7);
}

/** Высокие светящиеся шпили на дальнем краю острова и два цветных источника света (ночью без них логово тонет во тьме). */
function spires(g: THREE.Group) {
  const geo = new THREE.OctahedronGeometry(1, 0), mats: THREE.MeshToonMaterial[] = [];
  ([[-12, -11, 3.6], [-7.5, -12.4, 2.8], [-2.5, -12.6, 4.0], [3.5, -12.8, 3.0], [8.8, -11.6, 3.8], [13, -9, 2.8]] as const).forEach(([x, z, h], i) => {
    const c = NEON[i % 3], m = new THREE.Mesh(geo, new THREE.MeshToonMaterial({ color: c, emissive: c, emissiveIntensity: 1.1 }));
    m.scale.set(0.55, h, 0.55); m.position.set(x, h * 0.85, z); m.rotation.set(0, i, 0.08 * (i % 3 - 1)); g.add(m); mats.push(m.material as THREE.MeshToonMaterial);
  });
  const pink = new THREE.PointLight(0xff4fb8, 15, 16), cyan = new THREE.PointLight(0x3ff0ff, 11, 16);
  pink.position.set(-7, 3, -3); cyan.position.set(7, 3, -3); g.add(pink, cyan);
  pulseEmissive(g, mats, { base: 1.1, amp: 0.4, speed: 2.2 });
  ambientOf(g).add(c => { pink.intensity = 15 * (1 + 0.14 * Math.sin(c.t * 2.3) * c.km); cyan.intensity = 11 * (1 + 0.14 * Math.sin(c.t * 1.7 + 2) * c.km); });   // цветной свет дышит
}

export const palette: Palette = {
  kits: [G],
  ground: { tile: 'hex_grass', color: 0x5e1660 },
  water: 0xff3fb0,
  clouds: false,
  crystals: [0xff4fb8, 0x3ff0ff, 0xb58cff], crystalsAlways: true,
  roles: {
    lm1: [[G, TW('e'), 4.6], [G, TW('d'), 4.2], [G, TW('b'), 3.4]],
    lm2: [[G, TW('f'), 5.8], [G, TW('e'), 5.4]],
    lm3: [[G, 'tower-round-crystals', 2.8], [G, TW('c'), 3.4]],
    lm4: [[G, TW('f'), 6.4]], lm5: [[G, TW('b'), 3.4], [G, TW('a'), 3.2]], lm6: [[G, TW('e'), 6.2]],
    bd1: [[H, 'mountain_B', 6.0], [H, 'mountain_C', 6.4]],
    bd2: [[H, 'mountain_C', 6.4], [H, 'mountain_A', 5.5]],
    bd3: [[H, 'mountain_C', 6.6], [G, 'detail-crystal', 8.0]], bd4: [[G, 'detail-crystal', 7.0], [H, 'mountain_B', 6.0]],
    tree: [[G, 'detail-crystal', 3.6], [G, TW('c'), 3.4], [G, 'detail-crystal', 2.8]],
    tall: [[G, TW('d'), 5.0], [G, 'detail-crystal', 5.0]],
    dead: [[G, TW('a'), 2.8], [G, TW('c'), 3.0]],
    rock: [[G, 'detail-rocks', 1.0], [G, 'detail-rocks', 1.3], [G, 'detail-crystal', 0.9]],
    rockBig: [[G, 'detail-rocks', 2.4], [G, 'detail-crystal', 2.2]],
    bush: [[G, 'detail-crystal', 1.0], [G, 'detail-crystal', 1.4]],
    grass: [[G, 'detail-crystal', 0.6], [G, 'detail-rocks', 0.5]],
    c1: [[H, 'flag_blue', 3.0]], c2: [[G, 'weapon-ballista', 2.0]], c3: [[G, 'tower-round-crystals', 1.6]],
    c4: [[G, 'tower-square-bottom-b', 1.0]], c5: [[G, 'weapon-turret', 1.4]], c6: [[G, 'weapon-catapult', 1.5]],
    w1: [[G, 'detail-crystal', 1.0]], w2: [[G, 'detail-crystal', 1.2]], w3: [[G, 'detail-crystal', 1.6]],
  },
  extra: (g, layout) => {
    tint(g, n => n.startsWith('mountain'), 0xb070ff);
    tint(g, n => n.startsWith('flag_'), 0xff60ff);
    tint(g, n => n.startsWith('weapon-') || n.startsWith('tower-round'), 0xc9a0ff);
    spires(g); glitch(g, layout);
    pixels(g, { n: 46, colors: NEON, seed: layout + 5 });
  },
};
