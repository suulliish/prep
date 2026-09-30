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
