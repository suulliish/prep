// Украшения, собранные кодом (kit: 'code' в каталоге): гирлянды, знамя, стол с картой. Цвета «Жарық»: бирюзовый, розовый, золотой, фиолетовый.
// Каждая сборка отдаёт группу в системе корабля и (если что-то колышется) update(t). Мачты берутся из корпуса (decor3d.findMasts).
import * as THREE from 'three';
import { Kit } from './assets';
import { glowTexture } from './portal';

export interface Masts { list: { x: number; z: number; top: number }[] }
/** Что нужно сборке: мачты корабля, палубные точки и «иконный» режим (компактно, без корабля вокруг). */
export interface CodeCtx { masts: Masts; icon: boolean }
export interface CodeModel { g: THREE.Object3D; update?(t: number, km: number): void }

const COLORS = [0x3ff0ff, 0xff5fc8, 0xffc23a, 0x9a6bff];
const toon = (c: number, side: THREE.Side = THREE.DoubleSide) => new THREE.MeshToonMaterial({ color: c, side });
const wood = () => toon(0x8a5534), dark = () => toon(0x5d3620);

let glowMatCache = new Map<number, THREE.SpriteMaterial>();
/** Мягкое свечение (аддитивный спрайт) — фонарям и огонькам; общий материал на цвет. */
export function glowSprite(color: number, size: number, opacity = 0.85): THREE.Sprite {
  let m = glowMatCache.get(color * 1000 + opacity * 100);
  if (!m) { m = new THREE.SpriteMaterial({ map: glowTexture(), color, blending: THREE.AdditiveBlending, depthWrite: false, opacity }); glowMatCache.set(color * 1000 + opacity * 100, m); }
  const s = new THREE.Sprite(m); s.scale.setScalar(size); s.userData.noToon = true; return s;
}

/** Провисающая нить между двумя точками: n+1 точек, провис sag вниз. */
function strand(a: THREE.Vector3, b: THREE.Vector3, sag: number, n: number): THREE.Vector3[] {
  return Array.from({ length: n + 1 }, (_, i) => { const u = i / n, p = a.clone().lerp(b, u); p.y -= sag * 4 * u * (1 - u); return p; });
}
const rope = (pts: THREE.Vector3[], r = 0.025) => new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), pts.length * 3, r, 5), toon(0x3a2a20, THREE.FrontSide));

/** Гирлянда флажков: нить между двумя мачтами, на ней треугольники по кругу цветов игры. */
function bunting(c: CodeCtx): CodeModel {
  const g = new THREE.Group(), [m0, m1] = c.icon ? [{ x: 0, z: 0, top: 6 }, { x: 3.4, z: 0, top: 6 }] : [c.masts.list[1], c.masts.list[2]];
  const a = new THREE.Vector3(m0.x + 0.5, 5.6, m0.z - 0.1), b = new THREE.Vector3(m1.x - 0.4, 5.3, m1.z - 0.1);
  const pts = strand(a, b, 0.9, 16); g.add(rope(pts));
  const tri = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-0.2, 0, 0), new THREE.Vector3(0.2, 0, 0), new THREE.Vector3(0, -0.5, 0)]); tri.computeVertexNormals();
  const flags: THREE.Mesh[] = [];
  for (let i = 1; i < pts.length - 1; i++) { const f = new THREE.Mesh(tri, toon(COLORS[i % COLORS.length])); f.position.copy(pts[i]); f.position.y -= 0.02; g.add(f); flags.push(f); }
  return { g, update: (t, km) => flags.forEach((f, i) => { f.rotation.z = Math.sin(t * 2.2 + i * 0.9) * 0.16 * km; f.rotation.y = Math.sin(t * 1.7 + i) * 0.25 * km; }) };
}

/** Гирлянда огоньков: от главной мачты веером к бортам, лампочки цветов игры мерцают. */
function stringLights(c: CodeCtx): CodeModel {
  const g = new THREE.Group(), m = c.icon ? { x: 0, z: 0, top: 6 } : c.masts.list[1], V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  const top = V(m.x, 3.6, m.z);
  const links: [THREE.Vector3, THREE.Vector3][] = c.icon
    ? [[V(-2.2, 3.2, 0), V(2.2, 3.2, 0)], [V(-2.2, 2.3, 0), V(2.2, 2.3, 0)]]                     // иконка: две гирлянды рядом, лицом к зрителю
    : [[top, V(m.x - 3.2, 2.3, 2.6)], [top, V(m.x + 2.4, 2.1, 2.6)], [top, V(m.x - 3.2, 2.3, -2.6)], [top, V(m.x + 2.4, 2.1, -2.6)]];
  const bulbG = new THREE.SphereGeometry(c.icon ? 0.16 : 0.1, 8, 6), mats = COLORS.map(col => new THREE.MeshBasicMaterial({ color: col }));
  const bulbs: THREE.Mesh[] = [];
  links.forEach(([a, e], k) => {
    const pts = strand(a, e, c.icon ? 0.8 : 0.7, 14); g.add(rope(pts, 0.02));
    for (let i = 1; i < pts.length; i++) if (i % 2) { const b = new THREE.Mesh(bulbG, mats[(i + k) % 4]); b.position.copy(pts[i]); b.position.y -= 0.1; b.userData.noToon = true; g.add(b); bulbs.push(b);
      if (i % 4 === 1) { const gl = glowSprite(COLORS[(i + k) % 4], 0.9, 0.55); gl.position.copy(b.position); g.add(gl); } }
  });
  return { g, update: (t, km) => bulbs.forEach((b, i) => b.scale.setScalar(1 + Math.sin(t * 3 + i * 1.7) * 0.22 * km)) };
}

/** Знамя со звездой: полотнище на перекладине у главной мачты, колышется. */
function bannerStar(c: CodeCtx): CodeModel {
  const g = new THREE.Group(), m = c.icon ? { x: 0, z: 0, top: 6 } : c.masts.list[1];
  const W = 1.3, Hh = 2.1, top = 4.9, seg = 8;
  const geo = new THREE.PlaneGeometry(W, Hh, 6, seg); geo.rotateY(-Math.PI / 2);          // полотно в плоскости YZ, лицом к корме
  const cloth = new THREE.Mesh(geo, toon(0x7a4dff)); cloth.position.set(m.x - 0.85, top - Hh / 2 - 0.1, m.z); g.add(cloth);
  const base = geo.attributes.position.array.slice() as unknown as Float32Array;
  // ласточкин хвост внизу: нижние вершины середины подтягиваем вверх
  const p = geo.attributes.position; for (let i = 0; i < p.count; i++) { const y = base[i * 3 + 1], z = base[i * 3 + 2]; if (y < -Hh / 2 + 0.01) p.setY(i, y + (0.5 - Math.abs(z) / (W / 2) * 0.5) * 0.5); }
  base.set(p.array as Float32Array); geo.computeVertexNormals();
  // звезда и кайма
  const star = new THREE.Shape(); for (let i = 0; i < 10; i++) { const r = i % 2 ? 0.16 : 0.38, a = Math.PI / 2 + i * Math.PI / 5; (i ? star.lineTo : star.moveTo).call(star, Math.cos(a) * r, Math.sin(a) * r); }
  const sm = new THREE.Mesh(new THREE.ShapeGeometry(star), toon(0xffc23a)); sm.rotation.y = -Math.PI / 2; sm.position.set(m.x - 0.88, top - 1.15, m.z); g.add(sm);
  const edge = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.1, W + 0.1), toon(0x3ff0ff)); edge.position.set(m.x - 0.86, top - 0.16, m.z); g.add(edge);
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, W + 0.5, 8), wood()); bar.rotation.x = Math.PI / 2; bar.position.set(m.x - 0.86, top - 0.06, m.z); g.add(bar);
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.9, 8), wood()); arm.rotation.z = Math.PI / 2; arm.position.set(m.x - 0.42, top - 0.06, m.z); g.add(arm);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), toon(0xffc23a, THREE.FrontSide)); knob.position.set(m.x - 0.86, top - 0.06, m.z + (W + 0.5) / 2); const k2 = knob.clone(); k2.position.z = m.z - (W + 0.5) / 2; g.add(knob, k2);
  return { g, update: (t, km) => { for (let i = 0; i < p.count; i++) { const y = base[i * 3 + 1], z = base[i * 3 + 2], k = (Hh / 2 - y) / Hh; p.setX(i, base[i * 3] - Math.sin(t * 2.4 + y * 2.2 + z * 1.5) * 0.09 * k * km); } p.needsUpdate = true; } };
}

/** Стол с картой: столик KayKit и свиток-карта сверху. */
async function mapTable(): Promise<CodeModel> {
  const kit = await Kit.load('shipdecor'), g = new THREE.Group();
  const table = kit.get('table_small', { height: 1.0, ground: true }), map = kit.get('map');
  g.add(table); g.updateMatrixWorld(true);
  const tb = new THREE.Box3().setFromObject(table), s = 0.85 / Math.max(0.01, new THREE.Box3().setFromObject(map).getSize(new THREE.Vector3()).x);
  map.scale.multiplyScalar(s); map.updateMatrixWorld(true);
  const mb = new THREE.Box3().setFromObject(map); map.position.y += tb.max.y - mb.min.y; map.position.x += (tb.min.x + tb.max.x) / 2 - (mb.min.x + mb.max.x) / 2; map.position.z += (tb.min.z + tb.max.z) / 2 - (mb.min.z + mb.max.z) / 2; map.rotation.y = 0.3;
  g.add(map); return { g };
}

/** Сборки по имени (model.name предмета с kit: 'code'). Синхронные и асинхронные. */
export const CODE_MODELS: Record<string, (c: CodeCtx) => CodeModel | Promise<CodeModel>> = { bunting, string_lights: stringLights, banner_star: bannerStar, map_table: () => mapTable() };
/** Предметы, привязанные к мачтам и ставящиеся сразу в системе корабля, без своего места на палубе. */
export const MAST_MODELS = new Set(['bunting', 'string_lights', 'banner_star']);
