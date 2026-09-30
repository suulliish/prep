// Мир 5 «Трасса молний»: гоночная трасса под грозой из Kenney Racing Kit (CC0); молнии, тёмные тучи и свечение кодом.
import * as THREE from 'three';
import type { Palette } from '../worlds3d';
import type { IslandKits } from '../island3d';
import { toonMat } from '../assets';
import { halo } from './_fx46';

const BOLT = 0xfff07a;

/** Молния зигзагом из тонких светящихся отрезков; мерцает (материал общий, прозрачность меняется по времени). */
function bolt(x: number, z: number, top: number, bottom: number, seed: number, mat: THREE.MeshBasicMaterial, glow = true): THREE.Group {
  const g = new THREE.Group(); let s = seed;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const seg = (a: THREE.Vector3, b: THREE.Vector3, w: number) => {
    const len = a.distanceTo(b), m = new THREE.Mesh(new THREE.BoxGeometry(w, len, w), mat);
    m.position.copy(a).add(b).multiplyScalar(0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize()); g.add(m);
  };
  let p = new THREE.Vector3(x, top, z);
  const steps = 7, dy = (top - bottom) / steps;
  for (let i = 0; i < steps; i++) {
    const q = new THREE.Vector3(x + (i === steps - 1 ? 0 : (rnd() - 0.5) * 2.6), top - dy * (i + 1), z);
    seg(p, q, 0.22); if (i === 2 || i === 4) { const f = new THREE.Vector3(q.x + (rnd() - 0.5) * 3.4, q.y - dy * 0.9, z); seg(q, f, 0.13); }
    p = q;
  }
  if (glow) { const h = halo(BOLT, 5, 0.5); h.position.set(x, bottom + 0.8, z); g.add(h); }
  return g;
}

/** Лента асфальта вдоль боя: белые кромки, жёлтая пунктирная осевая, красно-белые бордюры. */
function road(): THREE.Mesh {
  const W = 2048, H = 306, c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d')!;
  x.fillStyle = '#2f3142'; x.fillRect(0, 0, W, H);
  for (let i = 0; i < 900; i++) { x.fillStyle = `rgba(${i % 2 ? 255 : 0},${i % 2 ? 255 : 0},${i % 2 ? 255 : 0},0.035)`; x.fillRect(Math.random() * W, 24 + Math.random() * (H - 48), 3 + Math.random() * 14, 2); }
  for (let i = 0; i < W; i += 64) { x.fillStyle = (i / 64) % 2 ? '#e9e9f2' : '#e5322d'; x.fillRect(i, 0, 64, 20); x.fillRect(i, H - 20, 64, 20); }
  x.fillStyle = '#f2f2fa'; x.fillRect(0, 34, W, 7); x.fillRect(0, H - 41, W, 7);
  x.fillStyle = '#ffd21f'; for (let i = 0; i < W; i += 128) x.fillRect(i + 16, H / 2 - 4, 64, 8);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(36, 5.4), new THREE.MeshToonMaterial({ map: t }));
  m.rotation.x = -Math.PI / 2; m.position.set(0, 0.03, 0.85); m.receiveShadow = true; return m;
}

function extra(g: THREE.Group, _layout: number, _kits: IslandKits) {
  // тучи темнее
  const cloudMat = new Map<THREE.Material, THREE.Material>();
  for (const o of g.children) if (/^cloud/.test(o.name)) o.traverse(m => {
    const me = m as THREE.Mesh; if (!me.isMesh) return;
    const src = toonMat(me.material as THREE.Material) as THREE.MeshToonMaterial; let t = cloudMat.get(src);
    if (!t) { const c = src.clone(); c.color.multiply(new THREE.Color(0x565a78)); cloudMat.set(src, t = c); } me.material = t;
  });
  // молнии: одна материал на все, мерцает
  const mat = new THREE.MeshBasicMaterial({ color: BOLT, transparent: true, fog: false });
  const t0 = performance.now();
  const flick = () => { const t = (performance.now() - t0) / 1000; const w = Math.sin(t * 9) * Math.sin(t * 2.3 + 1); mat.opacity = w > 0.55 ? 0.35 : 0.95; };
  const first = bolt(-6.5, -15, 15, 0.4, 7, mat), second = bolt(9.5, -14, 14, 0.4, 19, mat), third = bolt(1.5, -17, 17, 8, 41, mat, false);
  (first.children[0] as THREE.Mesh).onBeforeRender = flick;
  g.add(first, second, third);
  g.add(road());
}

export const palette: Palette = {
  kits: ['storm'],
  ground: { tile: 'hex_grass', color: 0xa88a38 },
  water: 0x2a2c45,
  roles: {
    lm1: [['storm', 'pitsGarage', 2.8], ['storm', 'tent', 2.6], ['storm', 'pitsOfficeRoof', 3.2], ['storm', 'pitsGarageClosed', 2.8]],
    lm2: [['storm', 'grandStandCovered', 4.4], ['storm', 'bannerTowerRed', 5.4], ['storm', 'grandStandAwning', 4.6]],
    lm3: [['storm', 'pitsOffice', 2.6], ['storm', 'grandStand', 3.0], ['storm', 'radarEquipment', 3.2]],
    lm4: [['storm', 'overhead', 4.4]], lm5: [['storm', 'grandStand', 2.6], ['storm', 'fenceStraight', 1.6]],
    lm6: [['storm', 'lightPostLarge', 6.0], ['storm', 'bannerTowerGreen', 6.0]],
    bd1: [['storm', 'grandStandCoveredRound', 5.0], ['storm', 'grandStandRound', 4.5]],
    bd2: [['storm', 'grandStandAwning', 5.5], ['storm', 'grandStandCovered', 5.0]],
    bd3: [['hexcore', 'mountain_C', 6.4]], bd4: [['hexcore', 'mountain_B', 6.0]],
    tree: [['storm', 'treeLarge', 4.4], ['storm', 'lightPostModern', 4.4], ['storm', 'flagRed', 4.2], ['storm', 'treeSmall', 3.6], ['storm', 'flagTankco', 4.4]],
    tall: [['storm', 'lightPostLarge', 5.4], ['storm', 'bannerTowerGreen', 5.0], ['storm', 'flagCheckers', 5.4]],
    dead: [['storm', 'flagCheckers', 4.0], ['storm', 'lightRedDouble', 3.6]],
    rock: [['storm', 'barrierRed', 0.8], ['storm', 'barrierWhite', 0.8], ['storm', 'pylon', 0.9]],
    rockBig: [['storm', 'raceCarOrange', 1.5], ['storm', 'raceCarRed', 1.5], ['storm', 'tentClosed', 2.0]],
    bush: [['storm', 'pylon', 1.0], ['storm', 'barrierRed', 0.7]],
    grass: [['storm', 'pylon', 0.7], ['storm', 'barrierWhite', 0.5]],
    c1: [['storm', 'flagRed', 3.0]], c2: [['storm', 'radarEquipment', 2.0]], c3: [['storm', 'billboardLow', 2.4]], c4: [['storm', 'tentClosed', 1.6]], c5: [['storm', 'pylon', 1.2]], c6: [['storm', 'raceCarRed', 1.0]],
  },
  crystals: [0xfff07a, 0xffc94a, 0xffffff],
  extra,
};
