// Персонажи и детали в мультяшном стиле: скруглённые блоки, ступенчатое (toon) освещение, тёмный контур.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

// 3 ступени света — «мультяшный» вид как в Brawl Stars / Roblox
const gradient = (() => {
  const d = new Uint8Array([90, 170, 255]);
  const t = new THREE.DataTexture(d, 3, 1, THREE.RedFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true;
  return t;
})();
const toonCache = new Map<string, THREE.Material>();
export function toon(color: number, emissive = 0, ei = 1): THREE.Material {
  const k = `${color}_${emissive}_${ei}`;
  if (!toonCache.has(k)) toonCache.set(k, new THREE.MeshToonMaterial({ color, gradientMap: gradient, emissive, emissiveIntensity: ei }));
  return toonCache.get(k)!;
}
const outlineMat = new THREE.MeshBasicMaterial({ color: 0x0a0b1e, side: THREE.BackSide });
const geoCache = new Map<string, THREE.BufferGeometry>();
function rgeo(w: number, h: number, d: number, r: number) {
  const k = `${w}_${h}_${d}_${r}`;
  if (!geoCache.has(k)) geoCache.set(k, new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2, h / 2, d / 2)));
  return geoCache.get(k)!;
}

export interface PartOpts { r?: number; emissive?: number; ei?: number; outline?: boolean; shadow?: boolean }
/** Скруглённый блок с контуром. */
export function part(p: THREE.Object3D, w: number, h: number, d: number, x: number, y: number, z: number, color: number, o: PartOpts = {}) {
  const g = rgeo(w, h, d, o.r ?? Math.min(w, h, d) * 0.22);
  const m = new THREE.Mesh(g, toon(color, o.emissive ?? 0, o.ei ?? 1));
  m.position.set(x, y, z); m.castShadow = o.shadow ?? true;
  if (o.outline !== false) {
    const ol = new THREE.Mesh(g, outlineMat);
    ol.scale.set(1 + 0.07 / w, 1 + 0.07 / h, 1 + 0.07 / d);
    m.add(ol);
  }
  p.add(m); return m;
}

// ---------- Кодер ----------
export function makeHero() {
  const g = new THREE.Group();
  const C = { skin: 0xf2c48d, jacket: 0x22b8cc, jacketDark: 0x137e8f, pants: 0x2b3470, boots: 0x1b1d33, hair: 0x2e1b10, glove: 0xffc94a };
  const hips = new THREE.Group(); hips.position.y = 0.95; g.add(hips);
  const body = part(hips, 0.86, 0.8, 0.5, 0, 0.42, 0, C.jacket);
  part(body, 0.9, 0.16, 0.54, 0, -0.34, 0, 0x1b1f3d, { outline: false });              // пояс
  part(body, 0.2, 0.14, 0.06, 0, -0.34, 0.27, 0xffc94a, { emissive: 0x6b4a0a, ei: 0.6, outline: false }); // пряжка
  part(body, 0.06, 0.6, 0.04, 0, 0.02, 0.26, C.jacketDark, { outline: false });           // молния
  part(body, 0.9, 0.18, 0.54, 0, 0.36, 0, C.jacketDark, { outline: false });              // воротник
  const pack = part(body, 0.6, 0.62, 0.26, 0, 0.02, -0.38, 0x39407a);
  const cell = part(pack, 0.22, 0.34, 0.06, 0, 0.02, -0.15, 0x3ff0ff, { emissive: 0x3ff0ff, ei: 2.2, outline: false });
  part(pack, 0.05, 0.4, 0.05, 0.2, 0.46, 0, 0x7d86b8, { outline: false });
  part(pack, 0.1, 0.1, 0.1, 0.2, 0.7, 0, 0xff4fb8, { emissive: 0xff4fb8, ei: 2, outline: false });

  // голова: крупная, «чиби»-пропорции
  const head = new THREE.Group(); head.position.set(0, 1.45, 0); hips.add(head);
  part(head, 1.05, 0.98, 0.96, 0, 0.1, 0, C.skin, { r: 0.18 });
  const hair = new THREE.Group(); head.add(hair);
  part(hair, 1.12, 0.32, 1.02, 0, 0.52, -0.02, C.hair, { r: 0.12 });
  part(hair, 1.1, 0.5, 0.26, 0, 0.3, -0.42, C.hair, { r: 0.1 });
  [[-0.3, 0.1], [0.05, 0.2], [0.35, 0.05]].forEach(([x, z], i) => { const s = part(hair, 0.28, 0.34, 0.28, x, 0.74, z, C.hair, { r: 0.08 }); s.rotation.z = (i - 1) * 0.35; });
  part(hair, 0.36, 0.18, 0.2, -0.28, 0.4, 0.46, C.hair, { r: 0.06 });                     // чёлка
  // глаза с бликом, брови, рот
  const eyes: THREE.Object3D[] = [];
  [-0.23, 0.23].forEach(x => {
    const e = new THREE.Group(); e.position.set(x, 0.08, 0.49); head.add(e);
    part(e, 0.22, 0.26, 0.04, 0, 0, 0, 0xffffff, { outline: false, shadow: false });
    part(e, 0.13, 0.17, 0.04, 0.02, -0.02, 0.02, 0x1a1a2e, { outline: false, shadow: false });
    part(e, 0.05, 0.05, 0.02, 0.05, 0.04, 0.045, 0xffffff, { emissive: 0xffffff, ei: 1, outline: false, shadow: false });
    eyes.push(e);
    const brow = part(head, 0.24, 0.06, 0.04, x, 0.28, 0.5, C.hair, { outline: false, shadow: false }); brow.rotation.z = x < 0 ? 0.12 : -0.12;
  });
  part(head, 0.2, 0.05, 0.03, 0.02, -0.2, 0.49, 0x8a3b2a, { outline: false, shadow: false });
  // очки-визор на лбу
  const visor = part(head, 0.98, 0.16, 0.12, 0, 0.42, 0.44, 0x3ff0ff, { emissive: 0x3ff0ff, ei: 1.8 });

  const limb = (parent: THREE.Object3D, x: number, y: number, w: number, h: number, c: number, tip: number) => {
    const p = new THREE.Group(); p.position.set(x, y, 0); parent.add(p);
    part(p, w, h, w, 0, -h / 2, 0, c);
    part(p, w * 1.12, w * 0.9, w * 1.12, 0, -h + 0.04, 0.02, tip);
    return p;
  };
  const armL = limb(body, -0.56, 0.3, 0.26, 0.62, C.jacket, C.glove);
  const armR = limb(body, 0.56, 0.3, 0.26, 0.62, C.jacket, C.glove);
  const legL = limb(hips, -0.2, 0.05, 0.3, 0.72, C.pants, C.boots);
  const legR = limb(hips, 0.2, 0.05, 0.3, 0.72, C.pants, C.boots);
  // меч-клавиша
  const sword = new THREE.Group(); sword.position.set(0, -0.64, 0.12); armR.add(sword);
  part(sword, 0.1, 0.1, 0.34, 0, 0, 0.02, 0x5a3519, { outline: false });
  part(sword, 0.42, 0.1, 0.1, 0, 0, 0.2, 0xffc94a, { emissive: 0x6b4a0a, ei: 0.8 });
  const blade = part(sword, 0.14, 0.08, 1.15, 0, 0, 0.8, 0x9ffcff, { emissive: 0x3ff0ff, ei: 1.8 });
  return { g, hips, body, head, eyes, armL, armR, legL, legR, pack, cell, blade, visor };
}

// ---------- Бит ----------
export function makeBit(faceTex: THREE.Texture) {
  const g = new THREE.Group();
  const shell = part(g, 0.72, 0.62, 0.6, 0, 0, 0, 0xdfe5f7, { r: 0.16 });
  part(shell, 0.74, 0.12, 0.62, 0, -0.18, 0, 0x7d86b8, { outline: false });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.54, 0.4), new THREE.MeshBasicMaterial({ map: faceTex }));
  screen.position.set(0, 0.04, 0.305); g.add(screen);
  const thrusters: THREE.Mesh[] = [];
  [-0.42, 0.42].forEach(x => {
    const pod = part(g, 0.16, 0.34, 0.34, x, -0.02, 0, 0x7d86b8, { r: 0.06 });
    thrusters.push(part(pod, 0.1, 0.1, 0.1, 0, -0.22, 0, 0x3ff0ff, { emissive: 0x3ff0ff, ei: 3, outline: false }));
  });
  part(g, 0.05, 0.28, 0.05, 0, 0.44, 0, 0x7d86b8, { outline: false });
  const antenna = part(g, 0.14, 0.14, 0.14, 0, 0.62, 0, 0xff4fb8, { emissive: 0xff4fb8, ei: 2.5, outline: false });
  const prop = new THREE.Group(); prop.position.y = 0.72; g.add(prop);
  part(prop, 0.8, 0.03, 0.1, 0, 0, 0, 0xff4fb8, { outline: false }); part(prop, 0.1, 0.03, 0.8, 0, 0, 0, 0xff4fb8, { outline: false });
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.35, 8), new THREE.MeshBasicMaterial({ color: 0x7bf6ff, transparent: true, opacity: 0.7 }));
  flame.rotation.x = Math.PI; flame.position.y = -0.5; g.add(flame);
  return { g, screen, antenna, prop, thrusters, flame };
}

// ---------- Глитч-моб ----------
export function makeMob(kind: number) {
  const g = new THREE.Group();
  const P = [[0xff4fb8, 0x8a3cff, 0x3ff0ff], [0x8a3cff, 0xff4fb8, 0xffc94a], [0xff6a3d, 0xff4fb8, 0x8a3cff]][kind % 3];
  const core = part(g, 1.2, 1.1, 1.1, 0, 0.8, 0, P[0], { emissive: P[0], ei: 0.35, r: 0.2 });
  // шипы
  const spikes: THREE.Mesh[] = [];
  [[0, 0.62, 0], [0.4, 0.5, 0.3], [-0.35, 0.55, -0.3], [0.3, 0.45, -0.4]].forEach(([x, y, z]) => {
    const s = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.42, 4), toon(P[1], P[1], 0.6)); s.position.set(x, y, z); core.add(s); spikes.push(s);
  });
  // один большой глаз, смотрит на героя (−x)
  const eye = new THREE.Group(); eye.position.set(-0.58, 0.08, 0); core.add(eye);
  part(eye, 0.06, 0.52, 0.52, 0, 0, 0, 0xffffff, { emissive: 0xffffff, ei: 0.4, outline: false });
  const pupil = part(eye, 0.06, 0.24, 0.24, -0.03, 0, 0, 0x14061f, { outline: false });
  // зубы
  for (let i = 0; i < 4; i++) { const t = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.16, 3), toon(0xffffff)); t.rotation.z = Math.PI; t.position.set(-0.6, -0.34, -0.24 + i * 0.16); core.add(t); }
  // осколки на орбите
  const shards = new THREE.Group(); shards.position.y = 0.8; g.add(shards);
  const shardList: THREE.Mesh[] = [];
  for (let i = 0; i < 6; i++) { const s = part(shards, 0.22, 0.22, 0.22, Math.cos(i) * 1.1, Math.sin(i * 2) * 0.35, Math.sin(i) * 1.1, i % 2 ? P[2] : P[1], { emissive: i % 2 ? P[2] : P[1], ei: 1.4, outline: false }); shardList.push(s); }
  return { g, core, parts: [core, ...shardList], pupil, shards, spikes };
}

// ---------- Детали корабля ----------
export function addShipDetails(ship: THREE.Group, quality: string) {
  const anim: { flags: THREE.Mesh[]; wheel: THREE.Group; windows: THREE.Mesh[] } = { flags: [], wheel: new THREE.Group(), windows: [] };
  // золотая полоса по борту
  part(ship, 12.6, 0.12, 0.34, 0, 0.84, 3.35, 0xffc94a, { emissive: 0x6b4a0a, ei: 0.5, outline: false });
  part(ship, 12.6, 0.12, 0.34, 0, 0.84, -3.35, 0xffc94a, { emissive: 0x6b4a0a, ei: 0.5, outline: false });
  // иллюминаторы в корпусе
  for (let i = -4; i <= 4; i += 2) for (const z of [3.02, -3.02]) {
    const w = part(ship, 0.46, 0.46, 0.1, i, -0.6, z, 0xffd27a, { emissive: 0xffb020, ei: 2, outline: false });
    anim.windows.push(w);
  }
  // штурвал у кормы
  const helm = new THREE.Group(); helm.position.set(-5.2, 0.15, 0); ship.add(helm);
  part(helm, 0.3, 1.1, 0.3, 0, 0.55, 0, 0x5a3519);
  anim.wheel.position.set(0.2, 1.25, 0); helm.add(anim.wheel);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.07, 6, 12), toon(0x8a5a2b)); ring.rotation.y = Math.PI / 2; anim.wheel.add(ring);
  for (let k = 0; k < 4; k++) { const sp = part(anim.wheel, 0.06, 1.2, 0.06, 0, 0, 0, 0x8a5a2b, { outline: false }); sp.rotation.x = (k * Math.PI) / 4; }
  // пушки по бортам
  for (const [x, z] of [[-2.5, 3.4], [2, 3.4], [-2.5, -3.4], [2, -3.4]]) {
    const c = new THREE.Group(); c.position.set(x, 0.55, z); ship.add(c);
    part(c, 0.5, 0.35, 0.5, 0, 0, 0, 0x3a3f5e);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.17, 0.9, 10), toon(0x2b2f47)); barrel.rotation.x = Math.PI / 2; barrel.position.set(0, 0.1, z > 0 ? 0.45 : -0.45); c.add(barrel);
  }
  // флаги на мачте и корме
  const flagGeo = new THREE.PlaneGeometry(1.2, 0.7, 8, 2);
  for (const [x, y, z, col] of [[-1.5, 6.1, -2.2, 0x3ff0ff], [-6.3, 2.4, 0, 0xff4fb8]] as const) {
    part(ship, 0.08, 1.2, 0.08, x, y - 0.4, z, 0x3a2a1d, { outline: false });
    const f = new THREE.Mesh(flagGeo.clone(), new THREE.MeshToonMaterial({ color: col, gradientMap: gradient, side: THREE.DoubleSide, emissive: col, emissiveIntensity: 0.3 }));
    f.position.set(x + 0.62, y, z); ship.add(f); anim.flags.push(f);
  }
  // бочки и ящики на палубе
  for (const [x, z] of [[-3.6, -2.4], [-3.1, -2.6], [3, 2.5]]) {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.6, 10), toon(0x8a5a2b)); b.position.set(x, 0.45, z); b.castShadow = quality === 'high'; ship.add(b);
    part(b, 0.6, 0.06, 0.6, 0, 0.15, 0, 0x3a2a1d, { outline: false });
  }
  part(ship, 0.7, 0.6, 0.7, 2.4, 0.45, -2.5, 0xa0673a); part(ship, 0.5, 0.45, 0.5, 2.4, 0.97, -2.5, 0xb07645);
  return anim;
}

// колыхание флага
export function waveFlag(f: THREE.Mesh, t: number) {
  const pos = (f.geometry as THREE.BufferGeometry).attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) { const x = pos.getX(i); pos.setZ(i, Math.sin(t * 4 + x * 3) * 0.12 * (x + 0.6)); }
  pos.needsUpdate = true;
}
