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
