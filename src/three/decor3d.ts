// Украшения корабля (мастерская, GAME_LOOP 5): каталог (content/ship_items.mjs) → места на палубе → модели в сцене. Только красота, на учёбу не влияет.
// Места считаются по самой палубе (лучи по корпусу), а не по чертежу: предмет стоит на плоском куске нужной высоты, вдали от площадки у портала.
// Предмет каталога всегда занимает своё место: номер по порядку среди предметов своего слота (порядок в каталоге не менять, только дописывать в конец).
import * as THREE from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { Kit, loadModel, scaleToHeight, sitOnGround, toonify } from './assets';
import { Actor } from './actor';
import { CODE_MODELS, MAST_MODELS, glowSprite, type Masts, type CodeModel } from './decor_models';
import type { Deck } from './deck3d';
// @ts-ignore — модуль .mjs без типов
import { SHIP_ITEMS } from '../../content/ship_items.mjs';

export type DecorSlot = 'deck' | 'bow' | 'stern' | 'mast' | 'pet';
export interface DecorItem { id: string; kz: string; ru: string; price: number; slot: DecorSlot; model: { kit: string; name: string; h: number }; icon: string; flat?: boolean; glow?: number; r?: number }
export const ITEMS = SHIP_ITEMS as unknown as DecorItem[];

// ---------- поверхность корпуса ----------
export interface Surface { H: Float32Array; nx: number; nz: number; x0: number; z0: number; step: number; at(x: number, z: number): number }
/** Высоты корпуса (система корабля, главная палуба = 0), шаг 0.3 м. Лучи идут сверху вниз с высоты 3.4: паруса, реи и такелаж выше не учитываем. */
export function sampleSurface(ship: THREE.Object3D, deck: Deck, from = 3.4, step = 0.3): Surface {
  const meshes: THREE.Mesh[] = [];
  deck.model.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh && !m.userData.outline && !/sail|flag/.test(m.name)) meshes.push(m); });
  ship.updateMatrixWorld(true);
  const b = deck.hull, x0 = b.min.x, z0 = b.min.z, nx = Math.ceil((b.max.x - x0) / step) + 1, nz = Math.ceil((b.max.z - z0) / step) + 1;
  const H = new Float32Array(nx * nz).fill(NaN), ray = new THREE.Raycaster(), down = new THREE.Vector3(0, -1, 0), o = new THREE.Vector3();
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
    o.set(x0 + i * step, from, z0 + j * step); ship.localToWorld(o); ray.set(o, down);
    const h = ray.intersectObjects(meshes, false)[0]; if (h) H[i * nz + j] = ship.worldToLocal(h.point.clone()).y;
  }
  return { H, nx, nz, x0, z0, step, at: (x, z) => { const i = Math.round((x - x0) / step), j = Math.round((z - z0) / step); return i >= 0 && j >= 0 && i < nx && j < nz ? H[i * nz + j] : NaN; } };
}
/** Мачты: кластеры клеток выше 5.5 м (сверху вниз по всему корпусу), по x от кормы к носу. */
export function findMasts(ship: THREE.Object3D, deck: Deck): Masts {
  const s = sampleSurface(ship, deck, 40), cells: [number, number, number][] = [];
  for (let i = 0; i < s.nx; i++) for (let j = 0; j < s.nz; j++) { const h = s.H[i * s.nz + j]; if (h > 5.5) cells.push([s.x0 + i * s.step, s.z0 + j * s.step, h]); }
  cells.sort((a, b) => a[0] - b[0]);
  const groups: [number, number, number][][] = [];
  for (const c of cells) { const g = groups[groups.length - 1]; if (g && c[0] - g[g.length - 1][0] < 1.2) g.push(c); else groups.push([c]); }
  const ms = groups.filter(g => g.length >= 2).map(g => ({ x: g.reduce((a, c) => a + c[0], 0) / g.length, z: g.reduce((a, c) => a + c[1], 0) / g.length, top: Math.max(...g.map(c => c[2])) }));
  return { list: ms };
}

// ---------- места ----------
export interface Spot { x: number; y: number; z: number; rot: number }
/** Где нельзя ставить: круг (x, z, радиус). Хаб передаёт площадку у портала и места героя. */
export type Avoid = [number, number, number][];
type Plan = Record<'deck' | 'bow' | 'stern', (Spot | null)[]>;

// Якоря мест: уровень пола (главная палуба 0, носовая площадка 1.1, кормовая надстройка 2.2), точка x (нос +x), z и поворот.
// Место = ближайшая к якорю плоская клетка нужного уровня, свободная от площадки у портала, дороги героя и уже занятых мест.
// Якоря выбраны по карте высот этого корабля (dev: decor.html и debug в docs/ASSETS.md); если корабль сменится, места сами сдвинутся к ближайшим плоским клеткам.
const ANCHORS: Record<'deck' | 'bow' | 'stern', { level: number; x: number; z: number; rot: number }[]> = {
  deck: [
    { level: 0, x: -3.0, z: 2.0, rot: 0.3 }, { level: 0, x: -1.6, z: 2.0, rot: -0.3 }, { level: 0, x: -0.2, z: 2.0, rot: 0.4 },
    { level: 0, x: 1.0, z: 1.6, rot: -0.2 }, { level: 0, x: -4.2, z: 1.2, rot: 0.2 }, { level: 0, x: -1.6, z: -2.0, rot: 0.3 },
    { level: 0, x: 0.2, z: -2.0, rot: -0.3 }, { level: 0, x: -3.0, z: -2.0, rot: 0.2 }, { level: 0, x: -4.2, z: -1.0, rot: 0 },
  ],
  bow: [{ level: 1.1, x: 3.2, z: -2.1, rot: 0 }],   // носовая площадка — место героя; свободен только её левый (дальний от камеры) край
  stern: [{ level: 2.2, x: -7.7, z: -1.7, rot: 0.3 }, { level: 2.2, x: -7.7, z: 1.7, rot: -0.3 }, { level: 2.2, x: -6.4, z: 0, rot: 0 }],
};
/** Сколько предметов вмещает каждый слот (мачты и питомцы места на палубе не занимают). */
export const CAPACITY = { deck: ANCHORS.deck.length, bow: ANCHORS.bow.length, stern: ANCHORS.stern.length };
const HALF_BEAM = 2.6;                                   // за поручни (|z| больше) не ставим

/** Плоские клетки уровня level: вокруг в радиусе r высоты не отличаются от уровня больше, чем на tol (без ям, поручней, мачт). */
export function flatCells(s: Surface, level: number, r: number, tol = 0.1): [number, number][] {
  const n = Math.ceil(r / s.step), out: [number, number][] = [];
  for (let i = 0; i < s.nx; i++) for (let j = 0; j < s.nz; j++) {
    let ok = true;
    for (let di = -n; di <= n && ok; di++) for (let dj = -n; dj <= n; dj++) {
      if (Math.hypot(di, dj) * s.step > r) continue;
      const a = i + di, b = j + dj, h = a >= 0 && b >= 0 && a < s.nx && b < s.nz ? s.H[a * s.nz + b] : NaN;
      if (!(Math.abs(h - level) <= tol)) { ok = false; break; }
    }
    if (ok) out.push([s.x0 + i * s.step, s.z0 + j * s.step]);
  }
  return out;
}

export function planSpots(s: Surface, avoid: Avoid): Plan {
  const plan: Plan = { deck: [], bow: [], stern: [] }, taken: [number, number, number][] = [], cache = new Map<string, [number, number][]>();
  for (const slot of ['deck', 'bow', 'stern'] as const) ANCHORS[slot].forEach((a, k) => {
    const r = ITEMS.filter(x => x.slot === slot)[k]?.r ?? 0.6, key = a.level + '_' + r;       // радиус основания предмета, которому достанется это место
    if (!cache.has(key)) cache.set(key, flatCells(s, a.level, r).filter(c => Math.abs(c[1]) < HALF_BEAM - r * 0.3));
    let best: [number, number] | null = null, bd = Infinity;
    for (const c of cache.get(key)!) {
      const d = Math.hypot(c[0] - a.x, c[1] - a.z); if (d >= bd) continue;
      if (avoid.some(v => Math.hypot(c[0] - v[0], c[1] - v[1]) < v[2] + r * 0.5) || taken.some(t => Math.hypot(t[0] - c[0], t[1] - c[1]) < t[2] + r + 0.1)) continue;
      bd = d; best = c;
    }
    if (!best || bd > 2.5) { plan[slot].push(null); return; }                              // якорь далеко от любой плоской клетки — места нет
    taken.push([best[0], best[1], r]); plan[slot].push({ x: best[0], z: best[1], y: s.at(best[0], best[1]), rot: a.rot });
  });
  return plan;
}

// ---------- модели ----------
/** Габариты по мешам (без свечения-спрайтов и контуров). */
export function meshBox(o: THREE.Object3D): THREE.Box3 {
  const b = new THREE.Box3(); o.updateMatrixWorld(true);
  o.traverse(n => { const m = n as THREE.Mesh; if (m.isMesh && !m.userData.outline) { m.geometry.computeBoundingBox(); b.union(m.geometry.boundingBox!.clone().applyMatrix4(m.matrixWorld)); } });
  return b;
}
let petOutline: THREE.MeshBasicMaterial | null = null;
/** Контур питомца: у зверя двигаются сами узлы-части, поэтому контур — дочерний меш каждой части (а не сосед, как у героя), тогда он движется вместе с ней. */
function outlineChildren(root: THREE.Object3D) {
  petOutline ??= Object.assign(new THREE.MeshBasicMaterial({ color: 0x0a0b1e, side: THREE.BackSide }), { onBeforeCompile: (sh: { vertexShader: string }) => { sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n transformed += normalize(normal) * 0.022;'); } });
  const meshes: THREE.Mesh[] = []; root.traverse(n => { if ((n as THREE.Mesh).isMesh) meshes.push(n as THREE.Mesh); });
  for (const m of meshes) { const ol = new THREE.Mesh(m.geometry, petOutline); ol.userData.outline = true; ol.frustumCulled = false; m.add(ol); }
}
export interface Loaded { o: THREE.Object3D; actor?: Actor; code?: CodeModel }
/** Модель предмета каталога: из набора (kit), питомец (pets/<name>.glb с клипами) или сборка кодом (kit: 'code'). ctx нужен только сборкам кодом. */
export async function loadDecorModel(it: DecorItem, ctx: { masts: Masts; icon: boolean } = { masts: { list: [] }, icon: true }): Promise<Loaded> {
  const { kit, name, h } = it.model;
  if (kit === 'pets') {
    const gltf = await loadModel(`pets/${name}.glb`), model = SkeletonUtils.clone(gltf.scene);
    toonify(model); outlineChildren(model);
    const a = new Actor(model, gltf.animations); scaleToHeight(a.g, h); sitOnGround(a.g); a.loop('idle', 0);
    return { o: a.g, actor: a };
  }
  if (kit === 'code') { const b = CODE_MODELS[name]; if (!b) throw new Error(`нет сборки «${name}»`); const code = await b(ctx); return { o: code.g, code }; }
  const o = (await Kit.load(kit)).get(name, { height: h, ground: true });
  if (it.glow) { const gl = glowSprite(it.glow, h * 0.85); gl.position.y = h * 0.42; o.add(gl); }
  return { o };
}

// ---------- предметы в сцене ----------
export interface Decor {
  /** Поставить купленное: новые предметы появляются, пропавшие из списка убираются. Питомцы — в pet3d.ts. */
  set(owned: string[]): void;
  /** Предмет уже стоит на корабле (модель загружена)? Иначе null. */
  object(id: string): THREE.Object3D | null;
  /** Дождаться, пока предмет встанет (до 5 с); null — не встанет (нет места, ошибка загрузки). */
  ready(id: string): Promise<THREE.Object3D | null>;
  /** Место предмета в системе корабля: точка, куда смотреть камере. */
  focusOf(id: string): THREE.Vector3 | null;
  /** Появление: упругий рост от нуля (пока идёт — предмет виден с нуля). */
  pop(id: string): Promise<void>;
  /** Прячет предмет до pop (чтобы камера успела подлететь). */
  hide(id: string): void;
  /** Вернуть предмет на место, если показ оборвали. */
  restore(id: string): void;
  spots: Plan;
  update(t: number, km: number): void;
  dispose(): void;
}
/** Взгляд из главного меню (камера с кормы и правого борта): предметы стоят лицом к ней. */
const FACE = Math.atan2(-0.85, 0.52);

export function createDecor(ship: THREE.Group, deck: Deck, spots: Plan, masts: Masts): Decor {
  type Slot = { it: DecorItem; p: Promise<THREE.Object3D | null>; obj: THREE.Object3D | null; code?: CodeModel; base: number; focus: THREE.Vector3 };
  const placed = new Map<string, Slot>(), want = new Set<string>();
  const indexIn = (it: DecorItem) => ITEMS.filter(x => x.slot === it.slot).indexOf(it);

  async function place(it: DecorItem): Promise<THREE.Object3D | null> {
    const mast = it.model.kit === 'code' && MAST_MODELS.has(it.model.name);
    const sp = mast ? null : (spots[it.slot as 'deck' | 'bow' | 'stern'] ?? [])[indexIn(it)] ?? null;
    if (!mast && !sp) { console.warn('нет места для украшения', it.id); return null; }
    const m = await loadDecorModel(it, { masts, icon: false });
    if (!want.has(it.id)) return null;                                     // пока грузилось, предмет убрали
    const o = m.o, s = placed.get(it.id)!;
    if (sp) {
      o.position.set(sp.x, sp.y, sp.z); o.rotation.y = FACE + sp.rot * 0.5;
      const sz = meshBox(o).getSize(new THREE.Vector3());
      // вокруг стоящего предмета не ходим (плоские — ковёр, бухта — можно наступить)
      if (!it.flat) deck.reserve(sp.x, sp.z, Math.min(1.3, (it.r ?? Math.max(sz.x, sz.z) / 2) + 0.3));
      s.focus = new THREE.Vector3(sp.x, sp.y + it.model.h * 0.5, sp.z);
    } else {
      s.focus = meshBox(o).getCenter(new THREE.Vector3());   // мачтовое: центр сборки
    }
    ship.add(o); s.obj = o; s.code = m.code; s.base = o.scale.x;
    return o;
  }
  return {
    spots,
    set(owned) {
      want.clear(); for (const id of owned) { const it = ITEMS.find(x => x.id === id); if (it && it.slot !== 'pet') want.add(id); }
      for (const [id, s] of placed) if (!want.has(id)) { if (s.obj) ship.remove(s.obj); placed.delete(id); }
      for (const id of want) if (!placed.has(id)) {
        const it = ITEMS.find(x => x.id === id)!, s = { it, obj: null, base: 1, focus: new THREE.Vector3() } as Slot;
        placed.set(id, s); s.p = place(it).catch(e => { console.warn('украшение не загрузилось', id, e); return null; });
      }
    },
    object: id => placed.get(id)?.obj ?? null,
    ready: id => { const s = placed.get(id); return s ? Promise.race([s.p, new Promise<null>(r => setTimeout(() => r(null), 5000))]) : Promise.resolve(null); },
    focusOf: id => placed.get(id)?.focus.clone() ?? null,
    hide(id) { const o = placed.get(id)?.obj; if (o) o.scale.setScalar(0.001); },
    restore(id) { const s = placed.get(id); if (s?.obj) s.obj.scale.setScalar(s.base); },
    pop(id) {
      const s = placed.get(id); if (!s?.obj) return Promise.resolve();
      const o = s.obj, b = s.base;
      return new Promise<void>(res => { const t0 = performance.now(); const f = () => { const u = Math.min(1, (performance.now() - t0) / 700);
        // рост с перелётом: 0 → 1.25 → 0.92 → 1
        const k = u < 0.55 ? (u / 0.55) ** 2 * 1.25 : u < 0.8 ? 1.25 - (u - 0.55) / 0.25 * 0.33 : 0.92 + (u - 0.8) / 0.2 * 0.08;
        o.scale.setScalar(Math.max(0.001, b * k)); if (u < 1) requestAnimationFrame(f); else res(); }; f(); });
    },
    update(t, km) { for (const s of placed.values()) s.code?.update?.(t, km); },
    dispose() { for (const s of placed.values()) if (s.obj) ship.remove(s.obj); placed.clear(); },
  };
}
