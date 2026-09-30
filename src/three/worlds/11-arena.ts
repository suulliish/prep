// Мир 11 «Арена Жарық»: золотой закат, каменная арена с колоннами, статуями и знамёнами (Kenney Mini Arena, CC0;
// осадные машины и валуны из Kenney Castle Kit, CC0) + золотое кольцо арены и тёплый свет кодом.
import * as THREE from 'three';
import type { Palette } from '../worlds3d';
import type { IslandKits } from '../island3d';
import { ambientOf } from '../ambient';
import { birds, leaves, sparkles } from '../ambient_fx';
import { spotTime } from '../spots';

const A = 'arena';

/** Золотое кольцо арены на земле, солнечный диск за горизонтом и тёплые источники света. */
function glow(g: THREE.Group, layout: number) {
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xffd45a, transparent: true, opacity: 0.55, depthWrite: false });
  const ring = new THREE.Mesh(new THREE.RingGeometry(6.4, 6.65, 64), ringMat); ring.rotation.x = -Math.PI / 2; ring.position.set(0, 0.03, 1); ring.renderOrder = 1; g.add(ring);
  const inner = new THREE.Mesh(new THREE.RingGeometry(6.9, 7.0, 64), ringMat); inner.rotation.x = -Math.PI / 2; inner.position.set(0, 0.03, 1); inner.renderOrder = 1; g.add(inner);
  const warm = new THREE.PointLight(0xffa640, 30, 32); warm.position.set(0, 8, -14); g.add(warm);
  // кольцо мерцает, по нему бегут золотые блёстки; сверху сыплется конфетти
  ambientOf(g).add(c => { ringMat.opacity = 0.55 + 0.12 * Math.sin(c.t * 1.8) * c.km; });
  sparkles(g, Array.from({ length: 26 }, (_, i) => [Math.cos(i / 26 * 6.283) * (i % 2 ? 6.5 : 7.0), 0.18, 1 + Math.sin(i / 26 * 6.283) * (i % 2 ? 6.5 : 7.0)] as [number, number, number]).filter(([x, , z]) => z < 0.4 || Math.abs(x) > 5.6), { colors: [0xffd45a, 0xffffff, 0xff8a3a], size: 0.36, rate: 1.3, seed: layout });
  leaves(g, { n: 36, colors: [0xffd45a, 0xff5a4a, 0xffffff, 0x3ff0ff, 0xff8fd0], seed: layout + 3, shape: 'confetti', size: 0.16, fall: [0.9, 1.6], tumble: 2.4, wind: 0.15, height: 10 });
  if (spotTime(layout) !== 2) birds(g, { n: 2, color: 0xf3e0b0, seed: layout + 4 });
  // закатное солнце: диск с ореолом низко над дальним краем арены (свет и туман на него не действуют)
  const disc = (r: number, o: number) => { const m = new THREE.Mesh(new THREE.CircleGeometry(r, 48), new THREE.MeshBasicMaterial({ color: 0xffd45a, transparent: true, opacity: o, fog: false, depthWrite: false }));
    m.position.set(9, 6, -44); m.renderOrder = -1; g.add(m); };
  disc(6, 0.2); disc(3.4, 0.95);
}
/** Трибуны: дуга ступеней за задним планом (вне боевой полосы), лицом к центру арены. */
function stands(g: THREE.Group, kits: IslandKits) {
  const k = kits.get(A); if (!k?.has('stairs')) return;
  for (let i = 0; i < 7; i++) {
    const th = Math.PI * (1.18 + i * 0.106), x = 14.5 * Math.cos(th), z = 1 + 14.5 * Math.sin(th);
    const o = k.get('stairs', { height: 2.6, ground: true }); o.position.set(x, 0, z); o.rotation.y = -th - Math.PI / 2; g.add(o);
  }
}

export const palette: Palette = {
  kits: [A],
  ground: { tile: 'hex_grass', color: 0xdcae5a },
  water: 0x3fb8e8,
  crystals: [0xffc94a, 0xff8a3a, 0xfff2a0],
  roles: {
    lm1: [[A, 'statue', 3.4], [A, 'trophy', 2.6]],
    lm2: [[A, 'column', 5.6], [A, 'statue', 4.6]],
    lm3: [[A, 'trophy', 3.0], [A, 'weapon-rack', 2.4]],
    lm4: [[A, 'wall-gate', 5.6]], lm5: [[A, 'wall', 3.4], [A, 'wall-corner', 3.2]], lm6: [[A, 'column', 6.0]],
    bd1: [[A, 'wall', 5.5], [A, 'wall-gate', 6.0], [A, 'stairs', 3.6]],
    bd2: [[A, 'wall-gate', 6.0], [A, 'wall', 5.0], [A, 'wall-corner', 5.0]],
    bd3: [[A, 'column', 7.5], [A, 'wall', 6.0]], bd4: [[A, 'column', 7.0], [A, 'wall-corner', 5.5]],
    tree: [[A, 'column', 4.4], [A, 'banner', 4.2], [A, 'column-damaged', 3.4], [A, 'banner', 3.8]],
    tall: [[A, 'column', 5.4], [A, 'banner', 5.0]],
    dead: [[A, 'column-damaged', 3.0], [A, 'statue', 3.2]],
    rock: [[A, 'bricks', 0.9], [A, 'rocks-small', 1.0]],
    rockBig: [[A, 'rocks-large', 2.4], [A, 'block', 1.6], [A, 'bricks', 1.6]],
    bush: [[A, 'bricks', 1.0], [A, 'weapon-sword', 1.1]],
    grass: [[A, 'weapon-spear', 1.2], [A, 'weapon-sword', 0.9], [A, 'bricks', 0.6]],
    c1: [[A, 'banner', 3.0]], c2: [[A, 'weapon-rack', 2.0]], c3: [[A, 'character-soldier', 2.0]],
    c4: [[A, 'block', 1.5]], c5: [[A, 'trophy', 1.4]], c6: [[A, 'siege-catapult', 1.6]],
    w1: [[A, 'bricks', 1.0]], w2: [[A, 'column-damaged', 1.6]], w3: [[A, 'weapon-spear', 1.5]],
  },
  extra: (g, layout, kits) => { glow(g, layout); stands(g, kits); },
};
