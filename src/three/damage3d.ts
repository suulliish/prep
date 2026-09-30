// Поломки корабля: каждая неисправленная ошибка ребёнка (save.repairShop, где fixed != true) видна на палубе как мультяшная поломка:
// пробоина с дымком, искрящий провод, треснувший кристалл-фонарь, сбитая доска, трещина. Решил задачу-близнеца в ремонте — поломка чинится.
// Это мягкое напоминание, а не наказание: цвета игры (розовый «глитч», бирюзовый), никакой копоти и огня. Не больше 6 на корабле (хаб показывает 6 самых старых).
// Места — 6 фиксированных, выбранных по самой палубе (decor3d.sampleSurface/flatCells): раскладка зависит только от корабля и списка avoid, не от порядка вызовов.
// Поломки плоские или стоят за краем ходьбы (у борта, где герой не пройдёт), поэтому deck.reserve им не нужен и путь героя не меняется.
// Вся графика — код: свои формы с контуром, дым и искры одной точечной сеткой (≤ 100 частиц на всё). low: только модель и лёгкий блик. km = 0: без мигания, качания и частиц.
import * as THREE from 'three';
import { flatCells, sampleSurface, ITEMS, type Avoid, type Decor, type Nav, type Surface } from './decor3d';
import type { Deck } from './deck3d';

export const MAX_DAMAGE = 6;
export type DamageKind = 'hole' | 'wire' | 'crystal' | 'plank' | 'crack';
export interface DamageSpot { x: number; y: number; z: number; rot: number; kind: DamageKind }

// ---------- места ----------
// Якоря: пожелание, где стоять (система корабля, нос в +x). Место = ближайшая к якорю плоская клетка главной палубы, которая подходит по условиям planDamage.
// r — основание; solid — объёмная (стоит только там, куда герой не ходит: за краем сетки ходьбы у борта).
const SLOTS: { kind: DamageKind; x: number; z: number; rot: number; r: number; solid: boolean; k?: number }[] = [
  { kind: 'hole', x: 0.7, z: 0.0, rot: 0.5, r: 0.55, solid: false },
  { kind: 'crystal', x: -0.5, z: -1.2, rot: -0.2, r: 0.3, solid: true },
  { kind: 'crack', x: -1.2, z: 0.9, rot: -0.4, r: 0.55, solid: false },
  { kind: 'wire', x: 0.9, z: -1.2, rot: 0.3, r: 0.35, solid: true },
  { kind: 'plank', x: -1.4, z: -0.3, rot: 0.2, r: 0.5, solid: false },
  { kind: 'hole', x: 0.1, z: 1.2, rot: -0.9, r: 0.45, solid: false, k: 0.8 },
];
/** Взгляд из главного меню (камера с кормы и правого борта): поломки стоят лицом к ней, как украшения (decor3d.FACE). */
const FACE = Math.atan2(-0.85, 0.52);
// за поручни (|z| больше) не ставим
const HALF_BEAM = 2.6;
// поломки разнесены: не ближе 1 м друг от друга (видимая из меню часть палубы невелика)
const SPREAD = 1.0;
/** Шесть мест: раскладка зависит только от палубы и avoid (не от порядка вызовов). Основание не ближе 0.1 м к кругу avoid; nav — сетка ходьбы: объёмные ставим за её краем (не передан — как плоские).
 *  Если места по всем условиям нет, условия ослабляются по одному: сначала «за краем ходьбы», потом расстояние между поломками; совсем нет места — x = NaN, такая поломка не показывается. */
export function planDamage(s: Surface, avoid: Avoid, nav?: Nav): DamageSpot[] {
  const cache = new Map<number, [number, number][]>(), taken: [number, number][] = [], out: DamageSpot[] = [];
  const cells = (r: number) => { if (!cache.has(r)) cache.set(r, flatCells(s, 0, r).filter(c => Math.abs(c[1]) < HALF_BEAM - r * 0.3)); return cache.get(r)!; };
  for (const sl of SLOTS) {
    let best: [number, number] | null = null;
    // условия по убыванию строгости: (объёмная за краем ходьбы, разнос 1 м) → (любое место, 1 м) → (любое место, 0.8 м) → (малое основание, 0.7 м)
    for (const [strict, spread, r] of [[sl.solid && !!nav, SPREAD, sl.r], [false, SPREAD, sl.r], [false, 0.8, sl.r], [false, 0.7, 0.3]] as const) {
      let bd = Infinity;
      for (const c of cells(r)) {
        if (avoid.some(a => Math.hypot(c[0] - a[0], c[1] - a[1]) < a[2] + sl.r * 0.5 + 0.1) || taken.some(t => Math.hypot(c[0] - t[0], c[1] - t[1]) < spread)) continue;
        if (strict && nav!.walkable(c[0], c[1])) continue;
        const d = Math.hypot(c[0] - sl.x, c[1] - sl.z);
        if (d < bd - 1e-9 || (Math.abs(d - bd) <= 1e-9 && best && (c[0] < best[0] || (c[0] === best[0] && c[1] < best[1])))) { bd = d; best = c; }
      }
      if (best) break;
    }
    if (!best) { out.push({ x: NaN, y: NaN, z: NaN, rot: sl.rot, kind: sl.kind }); continue; }
    taken.push(best); out.push({ x: best[0], y: s.at(best[0], best[1]), z: best[1], rot: sl.rot, kind: sl.kind });
  }
  return out;
}

/** Круги мест украшений мастерской (planSpots считает их как при покупке всех предметов, поэтому круги постоянны): хаб добавляет их к avoid, чтобы поломка не легла под бочку или пушку. */
export function decorCircles(plan: Decor['spots']): Avoid {
  const out: Avoid = [];
  for (const slot of ['deck', 'bow', 'stern'] as const) plan[slot].forEach((sp, k) => { const it = ITEMS.filter(x => x.slot === slot)[k]; if (sp) out.push([sp.x, sp.z, Math.max(0.5, it?.r ?? 0.6)]); });
  return out;
}

// ---------- точечная сетка: дым, искры, блики ----------
// Один THREE.Points на пул; размер — метры в мире (масштаб в пиксели ставит onBeforeRender по камере). Цвет/прозрачность/форма — на каждую точку.
const PT_VS = `attribute float aSize; attribute vec4 aCol; attribute float aShape; uniform float uScale; varying vec4 vCol; varying float vShape;
  void main(){ vCol = aCol; vShape = aShape; vec4 mv = modelViewMatrix * vec4(position, 1.); gl_PointSize = min(aSize * uScale / max(0.1, -mv.z), 160.); gl_Position = projectionMatrix * mv; }`;
// форма 0 — мягкое пятно (блик), 1 — четырёхлучевая искра, 2 — мультяшный клубок дыма (плотный диск с мягким краем)
const PT_FS = `varying vec4 vCol; varying float vShape;
  void main(){ vec2 p = (gl_PointCoord - .5) * 2.; float d = length(p), a;
    if (vShape < .5) a = pow(max(0., 1. - d), 2.);
    else if (vShape < 1.5) a = smoothstep(0., .4, 1. - (sqrt(abs(p.x)) + sqrt(abs(p.y)))) + smoothstep(.5, 0., d) * .5;
    else a = smoothstep(1., .72, d);
    a *= vCol.a; if (a < .003) discard; gl_FragColor = vec4(vCol.rgb, a); }`;

class PointPool {
  readonly pts: THREE.Points; readonly cap: number;
  private pos: Float32Array; private size: Float32Array; private col: Float32Array; private shape: Float32Array;
  private geo = new THREE.BufferGeometry(); private mat: THREE.ShaderMaterial; private uScale = { value: 400 };
  constructor(cap: number, additive: boolean, order: number) {
    this.cap = cap; this.pos = new Float32Array(cap * 3); this.size = new Float32Array(cap); this.col = new Float32Array(cap * 4); this.shape = new Float32Array(cap);
    const at = (a: Float32Array, n: number) => { const b = new THREE.BufferAttribute(a, n); b.setUsage(THREE.DynamicDrawUsage); return b; };
    this.geo.setAttribute('position', at(this.pos, 3)); this.geo.setAttribute('aSize', at(this.size, 1)); this.geo.setAttribute('aCol', at(this.col, 4)); this.geo.setAttribute('aShape', at(this.shape, 1));
    this.mat = new THREE.ShaderMaterial({ vertexShader: PT_VS, fragmentShader: PT_FS, uniforms: { uScale: this.uScale }, transparent: true, depthWrite: false, fog: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending });
    this.pts = new THREE.Points(this.geo, this.mat); this.pts.frustumCulled = false; this.pts.renderOrder = order;
    const v = new THREE.Vector2();
    this.pts.onBeforeRender = (r, _s, cam) => { r.getDrawingBufferSize(v); this.uScale.value = v.y / (2 * Math.tan(THREE.MathUtils.degToRad((cam as THREE.PerspectiveCamera).fov ?? 48) / 2)); };
  }
  set(i: number, x: number, y: number, z: number, size: number, r: number, g: number, b: number, a: number, shape: number) {
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z; this.size[i] = size; this.col.set([r, g, b, a], i * 4); this.shape[i] = shape;
  }
  hide(i: number) { this.size[i] = 0; this.col[i * 4 + 3] = 0; }
  flush() { for (const k of ['position', 'aSize', 'aCol', 'aShape']) (this.geo.getAttribute(k) as THREE.BufferAttribute).needsUpdate = true; }
  dispose() { this.geo.dispose(); this.mat.dispose(); }
}

/** Одна летящая частица (дым или искра). */
interface Particle { alive: boolean; x: number; y: number; z: number; vx: number; vy: number; vz: number; age: number; life: number; s0: number; s1: number; c0: THREE.Color; c1: THREE.Color; a: number; g: number; drag: number; shape: number }
const mkParticles = (n: number): Particle[] => Array.from({ length: n }, () => ({ alive: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, age: 0, life: 1, s0: 0, s1: 0, c0: new THREE.Color(), c1: new THREE.Color(), a: 1, g: 0, drag: 0, shape: 0 }));

// ---------- формы поломок ----------
interface Glow { p: THREE.Vector3; color: THREE.Color; size: number; a: number }
interface Built {
  g: THREE.Group; glow: Glow;
  /** Где рождается дым (rate — клубков в секунду) и искры (пачками раз в every секунд; n штук). */
  smoke?: { at: THREE.Vector3; rate: number };
  sparks?: { at: THREE.Vector3; every: [number, number]; n: number; color: number };
  /** Покой: качание, мерцание, пульс блика (t — время, km — доля движения; a — своя прозрачность блика). */
  tick(t: number, km: number): void;
  /** Починка: u 0..1 — ремонт идёт (искры гаснут, доска встаёт…). pose(0) — вид до починки. */
  pose(u: number): void;
  /** Радиус для касания. */
  pick: number;
}
interface Ctx { grad: THREE.Texture; toon(c: number, emissive?: number, ei?: number): THREE.MeshToonMaterial; basic(c: number): THREE.MeshBasicMaterial; solid(geo: THREE.BufferGeometry, mat: THREE.Material, outline?: boolean): THREE.Mesh; keep<T extends { dispose(): void }>(x: T): T }
const TAU = Math.PI * 2, clamp01 = (u: number) => Math.min(1, Math.max(0, u)), ease = (u: number) => u * u * (3 - 2 * u), lerp = THREE.MathUtils.lerp;
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
/** Детерминированный генератор (mulberry32): раскладка форм и искр одинакова при любом запуске. */
export function rng(seed: number) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
/** Неровный «клякса»-многоугольник на полу (лицом вверх). */
function blob(c: Ctx, R: number, n: number, jit: number, rnd: () => number): THREE.BufferGeometry {
  const pts: THREE.Vector2[] = []; for (let i = 0; i < n; i++) { const a = (i / n) * TAU, r = R * (1 - jit * rnd()); pts.push(new THREE.Vector2(Math.cos(a) * r, Math.sin(a) * r)); }
  return c.keep(new THREE.ShapeGeometry(new THREE.Shape(pts)).rotateX(-Math.PI / 2));
}
// рисунок на полу не мерцает вместе с палубой
const NO_FIGHT = { polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 };

/** Пробоина: тёмная яма с розовым «глитч»-светом внутри и зубцами досок по краю; дымок из ямы. */
function buildHole(c: Ctx, k: number, seed: number): Built {
  const rnd = rng(seed), g = new THREE.Group(), R = 0.55 * k;
  const pitMat = c.keep(new THREE.MeshBasicMaterial({ color: 0x140b2a, ...NO_FIGHT })), glowMat = c.keep(new THREE.MeshBasicMaterial({ color: 0xff4fb8, ...NO_FIGHT }));
  const pit = new THREE.Mesh(blob(c, R, 11, 0.3, rnd), pitMat); pit.position.y = 0.04; g.add(pit);
  const core = new THREE.Mesh(blob(c, R * 0.55, 9, 0.25, rnd), glowMat); core.position.y = 0.045; g.add(core);
  const teeth: { p: THREE.Group; tilt: number }[] = [], toothGeo = c.keep(new THREE.CylinderGeometry(0, 0.075, 1, 3));
  const woods = [c.toon(0xc08a50), c.toon(0xe0ad68), c.toon(0x9a6a3a)];
  const N = 8;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * TAU + (rnd() - 0.5) * 0.3, h = 0.28 + rnd() * 0.2, tilt = 0.3 + rnd() * 0.35;
    const p = new THREE.Group(); p.position.set(Math.cos(a) * R * 0.95, 0.03, Math.sin(a) * R * 0.95); p.rotation.y = -a;
    const m = c.solid(toothGeo, woods[i % 3], false); m.scale.set(1, h, 0.55); m.position.y = h / 2; p.add(m); p.rotation.z = -tilt; g.add(p); teeth.push({ p, tilt });
  }
  const bits = c.keep(new THREE.BoxGeometry(1, 1, 1));
  for (let i = 0; i < 3; i++) { const a = rnd() * TAU, m = c.solid(bits, woods[i % 3], false), s = 0.09 + rnd() * 0.07; m.scale.set(s * 1.6, s * 0.6, s); m.position.set(Math.cos(a) * R * 1.35, 0.03 + s * 0.3, Math.sin(a) * R * 1.35); m.rotation.y = rnd() * TAU; g.add(m); }
  const glow: Glow = { p: V(0, 0.25, 0), color: new THREE.Color(0xff4fb8), size: 1.5 * k, a: 0.5 }, lo = new THREE.Color(0xff4fb8), hi = new THREE.Color(0xb98bff);
  return { g, glow, smoke: { at: V(0, 0.25, 0), rate: 4.5 }, sparks: { at: V(0, 0.2, 0), every: [1.6, 3.2], n: 2, color: 0xff9be0 }, pick: 0.85 * k,
    tick(t, km) { const w = 0.5 + 0.5 * Math.sin(t * 1.6 + seed) * km; glow.a = 0.42 + 0.14 * (km ? w : 0.5); glowMat.color.copy(lo).lerp(hi, km ? w * 0.6 : 0.2); },
    pose(u) { const e = ease(u), sc = Math.max(0.001, 1 - e); pit.scale.set(sc, 1, sc); core.scale.set(sc, 1, sc); teeth.forEach(t => { t.p.rotation.z = lerp(-t.tilt, 1.4, e); }); glow.a *= 1 - e; } };
}

/** Оборванный провод: коробка на палубе, из неё дугой свисает кабель с медным кончиком; на кончике искры. */
function buildWire(c: Ctx): Built {
  const g = new THREE.Group();
  const boxMat = c.toon(0x6f7fa3), boxTop = c.toon(0xffc23a), boxDyn = c.toon(0x6f7fa3);
  const box = c.solid(c.keep(new THREE.BoxGeometry(0.34, 0.24, 0.3)), boxDyn); box.position.y = 0.12; g.add(box);
  const band = c.solid(c.keep(new THREE.BoxGeometry(0.36, 0.05, 0.32)), boxTop); band.position.y = 0.2; g.add(band);
  const stub = c.solid(c.keep(new THREE.CylinderGeometry(0.06, 0.07, 0.36, 8)), boxMat); stub.position.y = 0.42; g.add(stub);
  const cable = new THREE.Group(); cable.position.set(0, 0.6, 0); g.add(cable);
  const curve = new THREE.CatmullRomCurve3([V(0, 0, 0), V(0.05, 0.2, 0), V(0.22, 0.33, 0), V(0.42, 0.22, 0.02), V(0.52, -0.05, 0.04), V(0.55, -0.3, 0.05)]);
  cable.add(c.solid(c.keep(new THREE.TubeGeometry(curve, 24, 0.038, 6)), c.toon(0x2d2f4d)));
  const tipMat = c.keep(new THREE.MeshToonMaterial({ color: 0xffd47a, emissive: 0xffa53a, emissiveIntensity: 0.9 }));
  const tip = new THREE.Mesh(c.keep(new THREE.SphereGeometry(0.06, 8, 6)), tipMat); tip.position.copy(curve.getPoint(1)); cable.add(tip);
  const tipPos = V(0, 0.6, 0).add(curve.getPoint(1));
  const glow: Glow = { p: tipPos.clone(), color: new THREE.Color(0xfff0a0), size: 0.7, a: 0.3 };
  return { g, glow, sparks: { at: tipPos.clone(), every: [0.9, 2.0], n: 5, color: 0xffe27a }, pick: 0.6,
    tick(t, km) { cable.rotation.z = Math.sin(t * 1.4) * 0.07 * km; cable.rotation.x = Math.sin(t * 1.1 + 1) * 0.05 * km; glow.a = 0.22 + 0.16 * (km ? Math.max(0, Math.sin(t * 9) * Math.sin(t * 2.3)) : 0.3); tipMat.emissiveIntensity = 0.9; },
    pose(u) { const e = ease(u); cable.scale.setScalar(Math.max(0.001, 1 - e * 0.85)); cable.rotation.z = -0.25 * e; tipMat.emissiveIntensity = 0.9 * (1 - e); glow.a *= 1 - e; boxDyn.color.setHex(0x6f7fa3).lerp(new THREE.Color(0x5ce39c), Math.sin(e * Math.PI)); } };
}

/** Треснувший кристалл-фонарь: кристалл на подставке расколот пополам (верхушка съехала набок), в щели тёмная трещина и искры, свет мигает. */
function buildCrystal(c: Ctx): Built {
  const g = new THREE.Group();
  const post = c.solid(c.keep(new THREE.CylinderGeometry(0.06, 0.09, 0.34, 8)), c.toon(0x8a5534)); post.position.y = 0.17; g.add(post);
  const foot = c.solid(c.keep(new THREE.CylinderGeometry(0.19, 0.22, 0.09, 10)), c.toon(0x5b4a7a)); foot.position.y = 0.045; g.add(foot);
  const cup = c.solid(c.keep(new THREE.ConeGeometry(0.17, 0.16, 6)), c.toon(0xe0a53c)); cup.rotation.x = Math.PI; cup.position.y = 0.4; g.add(cup);
  const gemMat = c.keep(new THREE.MeshToonMaterial({ color: 0x8ff3ff, emissive: 0x35e6ff, emissiveIntensity: 0.9, gradientMap: c.grad }));
  const pyr = c.keep(new THREE.ConeGeometry(0.16, 0.3, 4).rotateY(Math.PI / 4));
  const low = c.solid(pyr, gemMat); low.rotation.x = Math.PI; low.position.y = 0.64; g.add(low);
  const gap = new THREE.Mesh(c.keep(new THREE.CylinderGeometry(0.115, 0.115, 0.03, 4).rotateY(Math.PI / 4)), c.basic(0x14102e)); gap.position.y = 0.795; g.add(gap);
  const top = new THREE.Group(); top.position.set(0, 0.81, 0); g.add(top);
  const up = c.solid(pyr, gemMat); up.position.y = 0.15; top.add(up);
  const shard = c.solid(c.keep(new THREE.OctahedronGeometry(0.075)), gemMat); shard.scale.set(0.7, 1.2, 0.7); shard.position.set(0.28, 0.09, 0.2); shard.rotation.set(0.5, 0.4, 0.9); g.add(shard);
  const tilt = { rz: -0.3, x: 0.05, y: 0.03 };
  const glow: Glow = { p: V(0, 0.85, 0), color: new THREE.Color(0x35e6ff), size: 1.4, a: 0.5 };
  const place = (e: number) => { top.rotation.z = lerp(tilt.rz, 0, e); top.position.set(lerp(tilt.x, 0, e), 0.81 + lerp(tilt.y, 0, e), 0); gap.scale.setScalar(Math.max(0.001, 1 - e)); };
  place(0);
  return { g, glow, sparks: { at: V(0.03, 0.82, 0.05), every: [1.0, 2.2], n: 3, color: 0x9ff6ff }, pick: 0.75,
    tick(t, km) { const on = Math.sin(t * 2.1) + Math.sin(t * 13.7) * 0.6 > -0.4, f = km ? (on ? 1 : 0.2) : 0.75; gemMat.emissiveIntensity = 0.25 + 1.15 * f; glow.a = 0.15 + 0.45 * f; top.rotation.z = tilt.rz + Math.sin(t * 1.6) * 0.02 * km; },
    pose(u) { const e = ease(u), pulse = Math.sin(clamp01(u * 1.6) * Math.PI); place(e); gemMat.emissiveIntensity = 1.4 + 1.6 * pulse; glow.a = 0.6 + 0.4 * pulse; shard.scale.setScalar(Math.max(0.001, 1 - e)); } };
}

/** Сбитая доска: щель в палубе, доска рядом косо лежит одним концом на обломке, торчат гвозди. */
function buildPlank(c: Ctx): Built {
  const g = new THREE.Group();
  const gap = new THREE.Mesh(c.keep(new THREE.BoxGeometry(1.0, 0.02, 0.26)), c.keep(new THREE.MeshBasicMaterial({ color: 0x140b2a, ...NO_FIGHT }))); gap.position.y = 0.035; g.add(gap);
  const boardGeo = c.keep(new THREE.BoxGeometry(0.95, 0.07, 0.24).translate(0.475, 0.035, 0));
  const plank = new THREE.Group(); const board = c.solid(boardGeo, c.toon(0xc9924f)); plank.add(board);
  for (const x of [0.15, 0.7]) { const n = new THREE.Mesh(c.keep(new THREE.CylinderGeometry(0.014, 0.014, 0.1, 5)), c.toon(0xa9b3cf)); n.position.set(x, 0.1, 0.05); plank.add(n); }
  const blockMat = c.toon(0x8a5534), block = c.solid(c.keep(new THREE.BoxGeometry(0.14, 0.13, 0.14)), blockMat); block.position.set(0.55, 0.065, 0); block.rotation.y = 0.3;
  const piece = c.solid(c.keep(new THREE.BoxGeometry(0.4, 0.06, 0.2)), c.toon(0xe0ad68)); piece.position.set(-0.3, 0.03, 0.42); piece.rotation.y = -0.6;
  const home = { x: -0.475, y: 0.05, z: 0 }, off = { x: -0.3, y: 0.03, z: 0.34, ry: 0.3, rz: 0.27 };
  plank.position.set(off.x, off.y, off.z); plank.rotation.set(0, off.ry, off.rz);
  g.add(plank); g.add(block); g.add(piece);
  const glow: Glow = { p: V(0.15, 0.2, 0.3), color: new THREE.Color(0xffc23a), size: 0.5, a: 0.2 };
  return { g, glow, smoke: { at: V(0, 0.1, 0), rate: 0.5 }, pick: 0.75,
    tick(t, km) { plank.rotation.z = off.rz + Math.sin(t * 1.7) * 0.025 * km; glow.a = 0.15 + 0.12 * (km ? Math.max(0, Math.sin(t * 3.1)) : 0.5); },
    pose(u) { const e = ease(u), q = ease(clamp01(u * 1.15)); plank.position.set(lerp(off.x, home.x, q), lerp(off.y, home.y, q) + Math.sin(q * Math.PI) * 0.18, lerp(off.z, home.z, q)); plank.rotation.set(0, lerp(off.ry, 0, q), lerp(off.rz, 0, q)); piece.position.y = 0.03 + 0.25 * Math.sin(e * Math.PI); piece.rotation.y = -0.6 + e * 0.8; glow.a *= 1 - e; block.scale.setScalar(Math.max(0.001, 1 - e)); } };
}

/** Трещина в палубе: зигзаг с розовым светом внутри, приподнятые края, паровые клубки. */
function buildCrack(c: Ctx, seed: number): Built {
  const rnd = rng(seed), g = new THREE.Group();
  const pts: [number, number][] = [[-0.62, 0.02], [-0.36, 0.1], [-0.15, -0.06], [0.08, 0.09], [0.3, -0.05], [0.62, 0.04]];
  const boxGeo = c.keep(new THREE.BoxGeometry(1, 1, 1)), dark = c.keep(new THREE.MeshBasicMaterial({ color: 0x140b2a, ...NO_FIGHT })), lit = c.keep(new THREE.MeshBasicMaterial({ color: 0xff4fb8, ...NO_FIGHT }));
  const segs: THREE.Group[] = [], lips: { m: THREE.Group; tilt: number }[] = [], woods = [c.toon(0xc08a50), c.toon(0xe0ad68)];
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1], len = Math.hypot(bx - ax, bz - az), ang = Math.atan2(bz - az, bx - ax);
    const s = new THREE.Group(); s.position.set((ax + bx) / 2, 0.04, (az + bz) / 2); s.rotation.y = -ang;
    const d = new THREE.Mesh(boxGeo, dark); d.scale.set(len * 1.06, 0.02, 0.13); s.add(d);
    const l = new THREE.Mesh(boxGeo, lit); l.scale.set(len * 0.9, 0.022, 0.05); l.position.y = 0.006; s.add(l);
    g.add(s); segs.push(s);
    for (const side of [1]) { const p = new THREE.Group(); p.position.set((ax + bx) / 2 + Math.sin(ang) * side * 0.085, 0.04, (az + bz) / 2 + Math.cos(ang) * -side * 0.085); p.rotation.y = -ang;
      const tilt = 0.35 + rnd() * 0.25, m = c.solid(boxGeo, woods[i % 2], false); m.scale.set(len * 0.7, 0.05, 0.05); m.position.y = 0.02; p.add(m); p.rotation.x = side * tilt; g.add(p); lips.push({ m: p, tilt: side * tilt }); }
  }
  const glow: Glow = { p: V(0, 0.2, 0), color: new THREE.Color(0xff4fb8), size: 1.1, a: 0.3 };
  return { g, glow, smoke: { at: V(0, 0.15, 0), rate: 2 }, sparks: { at: V(0, 0.12, 0), every: [2, 4], n: 2, color: 0xff9be0 }, pick: 0.8,
    tick(t, km) { glow.a = 0.26 + 0.1 * (km ? Math.sin(t * 1.9 + seed) : 0); },
    pose(u) { const e = ease(u); segs.forEach((s, i) => { s.scale.x = Math.max(0.001, 1 - clamp01(e * 1.6 - (i / segs.length) * 0.6)); }); lips.forEach(l => { l.m.rotation.x = lerp(l.tilt, 0, e); }); glow.a *= 1 - e; } };
}

// ---------- сам модуль ----------
export interface DamageOpts {
  quality: 'high' | 'low';
  /** Доля движения (0..1): 0 — без мигания, качания, частиц и анимации появления. */
  km: number;
  /** Круги (x, z, радиус), куда поломки не ставим: площадка у портала (1.9 м), место входа героя (1.3 м); хаб может добавить и места украшений (planCircles). */
  avoid: Avoid;
  /** Карта высот, если хаб её уже снял (sampleSurface); иначе снимается сама. */
  surf?: Surface;
}
export interface Damage {
  /** Показать n поломок (0..6). Места фиксированы: больше n — появляются с наименьшими номерами, меньше — лишние чинятся (анимация с конца). Первое показанное (n > 0 в самом начале) ставится без анимации. */
  set(n: number, delay?: number): void;   // delay — через сколько секунд начнётся починка (молоток героя: вспышка «починено» ложится на последний удар)
  /** Починить поломку i (по умолчанию последнюю из видимых): анимация 1.1 с. Промис — когда всё кончилось. Невидимую — сразу. */
  fix(i?: number, delay?: number): Promise<void>;
  update(dt: number, t: number): void;
  /** Номер поломки под лучом (луч в мировых координатах) или -1: для касания. Чинящиеся и скрытые не считаются. */
  pick(ray: THREE.Raycaster): number;
  /** Мировые позиции видимых поломок (центры), по возрастанию номера: цели для камеры. */
  positions(): THREE.Vector3[];
  /** Мировая позиция поломки i (даже скрытой): камера летит к месту чинящейся. */
  at(i: number): THREE.Vector3;
  /** Номера поломок, которые считаются (показаны или появляются), по возрастанию; чинящаяся ещё на экране, но уже не считается. */
  visible(): number[];
  /** 6 мест и видов поломок (в системе корабля). */
  readonly spots: DamageSpot[];
  /** Для проверок: сколько частиц живо (дым, искры) и сколько поломок видно. */
  stats(): { particles: number; visible: number };
  dispose(): void;
}

type State = 'off' | 'in' | 'on' | 'out';
interface Item {
  i: number; spot: DamageSpot; b: Built; root: THREE.Group; st: State; u: number; wait: number; done: (() => void)[]; rnd: () => number;
  smokeAcc: number; nextSpark: number; flash: number;
  /** Починка: сработала ли вспышка «починено» и как далеко от неё (0..1). */
  flashed: boolean; fu: number;
}
export const FIX_TIME = 1.15, FIX_MOTION = 0.5, POP_TIME = 0.55, FIX_QUICK = 0.4;
// с камеры меню палуба мелкая: поломки чуть крупнее «по-честному», иначе не читаются
const ITEM_SCALE = 1.3;
// с бликами (6) — не больше 100 точек на всё
const SMOKE_CAP = 64, SPARK_CAP = 30;
const MINT = new THREE.Color(0x5ce39c);

export function createDamage(ship: THREE.Object3D, deck: Deck, opts: DamageOpts): Damage {
  const km = THREE.MathUtils.clamp(opts.km, 0, 1), high = opts.quality === 'high';
  const surf = opts.surf ?? sampleSurface(ship, deck), spots = planDamage(surf, opts.avoid, deck);
  const own: { dispose(): void }[] = [];
  const keep = <T extends { dispose(): void }>(x: T): T => { own.push(x); return x; };
  // общий вид игры: три ступени света и тёмный контур (как assets.toonify, но свои, чтобы всё освободить в dispose)
  const grad = keep(new THREE.DataTexture(new Uint8Array([90, 170, 255]), 3, 1, THREE.RedFormat)); grad.minFilter = grad.magFilter = THREE.NearestFilter; grad.needsUpdate = true;
  const outline = keep(new THREE.MeshBasicMaterial({ color: 0x0a0b1e, side: THREE.BackSide }));
  outline.onBeforeCompile = sh => { sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n transformed += normalize(normal) * 0.02;'); };
  const toons = new Map<string, THREE.MeshToonMaterial>();
  const c: Ctx = {
    grad, keep,
    toon: (col, em = 0, ei = 1) => { const k = col + '_' + em + '_' + ei; let m = toons.get(k); if (!m) { m = keep(new THREE.MeshToonMaterial({ color: col, emissive: em, emissiveIntensity: ei, gradientMap: grad })); toons.set(k, m); } return m; },
    basic: col => keep(new THREE.MeshBasicMaterial({ color: col })),
    // контур — дочерний меш на той же геометрии (тёмный, вывернутый и раздутый шейдером на 2 см вдоль нормали); на low контуров нет: меньше вызовов отрисовки
    solid: (geo, mat, ol = true) => {
      const m = new THREE.Mesh(geo, mat);
      if (ol && high) { const o = new THREE.Mesh(geo, outline); o.userData.outline = true; m.add(o); }
      return m;
    },
  };
  const g = new THREE.Group(); g.name = 'damage'; ship.add(g);
  const items: Item[] = spots.map((sp, i) => {
    const b = sp.kind === 'hole' ? buildHole(c, SLOTS[i].k ?? 1, 11 + i * 7) : sp.kind === 'wire' ? buildWire(c) : sp.kind === 'crystal' ? buildCrystal(c) : sp.kind === 'plank' ? buildPlank(c) : buildCrack(c, 5 + i * 3);
    const root = new THREE.Group(); root.name = 'damage_' + sp.kind; b.g.scale.setScalar(ITEM_SCALE); root.add(b.g); root.visible = false;
    root.position.set(sp.x, sp.y, sp.z); root.rotation.y = FACE + sp.rot * 0.5; g.add(root);
    return { i, spot: sp, b, root, st: 'off' as State, u: 0, wait: 0, done: [], rnd: rng(1000 + i * 31), smokeAcc: 0, nextSpark: 0.5 + i * 0.3, flash: 0, flashed: false, fu: 0 };
  });

  // частицы: дым (обычное смешивание) и «свет» (сложение: блики + искры); low — только блики, без дыма и искр
  const smoke = high ? new PointPool(SMOKE_CAP, false, 6) : null, lit = new PointPool(MAX_DAMAGE + (high ? SPARK_CAP : 0), true, 7);
  const dust = smoke ? mkParticles(SMOKE_CAP) : [], sparks = high ? mkParticles(SPARK_CAP) : [];
  for (const p of [smoke, lit]) if (p) { g.add(p.pts); own.push(p); }
  for (let i = 0; i < MAX_DAMAGE; i++) lit.hide(i);
  const tmp = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0), col = new THREE.Color();
  /** Точка формы (в системе поломки) → система корабля: с поворотом и масштабом корня. */
  const toShip = (it: Item, v: THREE.Vector3, out = new THREE.Vector3()) => out.copy(v).multiplyScalar(it.root.scale.x * ITEM_SCALE).applyAxisAngle(UP, it.root.rotation.y).add(it.root.position);
  const cnt = (n: number) => Math.max(1, Math.round(n * (0.4 + 0.6 * km)));

  const puff = (p: THREE.Vector3, vy: number, s0: number, s1: number, life: number, c0: number, c1: number, a: number, rnd: () => number) => {
    const q = dust.find(d => !d.alive); if (!q) return;
    Object.assign(q, { alive: true, x: p.x + (rnd() - 0.5) * 0.12, y: p.y, z: p.z + (rnd() - 0.5) * 0.12, vx: (rnd() - 0.5) * 0.18, vy, vz: (rnd() - 0.5) * 0.18, age: 0, life, s0, s1, a, g: -0.05, drag: 0.4, shape: 2 }); q.c0.setHex(c0); q.c1.setHex(c1);
  };
  const spark = (p: THREE.Vector3, sp: number, color: number, rnd: () => number, life = 0.5, size = 0.16) => {
    const q = sparks.find(d => !d.alive); if (!q) return; const a = rnd() * TAU, up = 0.4 + rnd() * 0.9;
    Object.assign(q, { alive: true, x: p.x, y: p.y, z: p.z, vx: Math.cos(a) * sp * (0.4 + rnd()), vy: sp * up * 1.3, vz: Math.sin(a) * sp * (0.4 + rnd()), age: 0, life: life * (0.7 + rnd() * 0.6), s0: size * (0.8 + rnd() * 0.5), s1: size * 0.2, a: 1, g: 5, drag: 1.2, shape: 1 }); q.c0.setHex(color); q.c1.setHex(color);
  };
  /** Облачко дыма из точки формы (появление, починка). */
  const poof = (it: Item, c0: number, c1: number, n: number) => { if (!smoke || !km) return; toShip(it, V(0, 0.2, 0), tmp); for (let i = 0; i < cnt(n); i++) puff(tmp, 0.4 + it.rnd() * 0.5, 0.25, 0.9, 0.9, c0, c1, 0.6, it.rnd); };

  const shown = (it: Item) => it.st === 'in' || it.st === 'on';
  const shownCount = () => items.filter(shown).length;
  function begin(it: Item, instant: boolean) {
    it.u = 0; it.wait = 0; it.flashed = false; it.fu = 0; it.root.visible = true; it.b.pose(0); it.b.tick(0, km);
    if (instant || !km) { it.st = 'on'; it.root.scale.setScalar(1); } else { it.st = 'in'; it.root.scale.setScalar(0.001); poof(it, 0xd9d0ff, 0x8f7fbf, 5); }
  }
  function startFix(it: Item, delay = 0) { it.st = 'out'; it.u = 0; it.wait = delay; it.flashed = false; it.fu = 0; }
  function finish(it: Item) { it.st = 'off'; it.root.visible = false; it.root.scale.setScalar(1); it.b.pose(0); lit.hide(it.i); it.done.splice(0).forEach(f => f()); }

  let seen = false, disposed = false, live = 0;
  const api: Damage = {
    spots,
    set(n, delay = 0) {
      if (disposed) return;
      // самый первый показ — без анимации (загрузка экрана)
      const want = Math.max(0, Math.min(MAX_DAMAGE, Math.round(n) || 0)), instant = !seen; let cur = shownCount(); if (want > 0) seen = true;
      for (const it of items) { if (cur >= want) break; if (it.st === 'off' && !Number.isNaN(it.spot.x)) { begin(it, instant); cur++; } }
      let k = 0; for (const it of items.slice().reverse()) { if (cur <= want) break; if (shown(it)) { startFix(it, delay + k++ * 0.22); cur--; } }
    },
    fix(i, delay = 0) {
      if (disposed) return Promise.resolve();
      const it = i === undefined ? items.slice().reverse().find(shown) : items[i];
      if (!it || it.st === 'off') return Promise.resolve();
      if (it.st !== 'out') startFix(it, delay);
      return new Promise<void>(res => { it.done.push(res); });
    },
    update(dt, t) {
      if (disposed) return;
      const step = Math.min(dt, 0.1);
      for (const it of items) {
        if (it.st === 'off') continue;
        const tt = t + it.i * 1.7;
        if (it.st === 'in') {
          it.u = Math.min(1, it.u + step / POP_TIME); const u = it.u;
          it.root.scale.setScalar(Math.max(0.001, u < 0.55 ? (u / 0.55) ** 2 * 1.25 : u < 0.8 ? 1.25 - (u - 0.55) / 0.25 * 0.33 : 0.92 + (u - 0.8) / 0.2 * 0.08));
          if (u >= 1) { it.st = 'on'; it.root.scale.setScalar(1); }
        }
        if (shown(it)) it.b.tick(tt, km);
        else if (it.st === 'out') {
          it.b.tick(tt, km);
          if (it.wait > 0) it.wait -= step;
          else {
            const total = km ? FIX_TIME : FIX_QUICK; it.u = Math.min(1, it.u + step / total); const f = it.u * total;
            if (km) {
              it.b.pose(clamp01(f / FIX_MOTION));
              if (f >= FIX_MOTION && !it.flashed) {
                it.flashed = true; toShip(it, V(0, 0.35, 0), tmp);
                for (let s = 0; s < cnt(12); s++) spark(tmp, 2.6, s % 3 === 0 ? 0xffe07a : s % 3 === 1 ? 0x5ce39c : 0xffffff, it.rnd, 0.8, 0.2);
                poof(it, 0xdafff0, 0x7be8b0, 3);
              }
              it.fu = clamp01((f - FIX_MOTION) / (total - FIX_MOTION));
              // после ремонта вырастает на 20% и тает
              const v = it.fu, k = f < FIX_MOTION ? 1 : v < 0.25 ? 1 + 0.2 * (v / 0.25) : 1.2 * (1 - (v - 0.25) / 0.75) ** 2;
              it.root.scale.setScalar(Math.max(0.001, k));
            } else it.root.scale.setScalar(Math.max(0.001, 1 - it.u));
            if (it.u >= 1) { finish(it); continue; }
          }
        }
        // дым и искры покоя (при km = 0 нет вовсе)
        if (km && shown(it)) {
          if (smoke && it.b.smoke) { it.smokeAcc += it.b.smoke.rate * km * step; while (it.smokeAcc >= 1) { it.smokeAcc -= 1; toShip(it, it.b.smoke.at, tmp); puff(tmp, 0.6 + it.rnd() * 0.4, 0.3, 1.15, 2.2 + it.rnd() * 0.9, 0xd6ccf5, 0x8577b8, 0.6, it.rnd); } }
          if (high && it.b.sparks && t >= it.nextSpark) { const sp = it.b.sparks; it.nextSpark = t + (sp.every[0] + it.rnd() * (sp.every[1] - sp.every[0])) / Math.max(0.3, km); toShip(it, sp.at, tmp); for (let s = 0; s < cnt(sp.n); s++) spark(tmp, 1.6, sp.color, it.rnd); it.flash = 1; }
        }
        it.flash = Math.max(0, it.flash - step * 4);
      }
      // частицы летят (дым — вверх и растёт, искры — дугой вниз)
      live = 0;
      for (const p of dust) if (p.alive) { p.age += step; if (p.age >= p.life) p.alive = false; else { const f = 1 / (1 + p.drag * step); p.vx *= f; p.vy *= f; p.vz *= f; p.vy -= p.g * step; p.x += p.vx * step; p.y += p.vy * step; p.z += p.vz * step; live++; } }
      for (const p of sparks) if (p.alive) { p.age += step; if (p.age >= p.life) p.alive = false; else { const f = 1 / (1 + p.drag * step); p.vx *= f; p.vz *= f; p.vy -= p.g * step; p.x += p.vx * step; p.y += p.vy * step; p.z += p.vz * step; live++; } }
      // нечего показывать — ни одного вызова отрисовки
      g.visible = live > 0 || items.some(it => it.st !== 'off');
      if (!g.visible) return;
      // блики: свой цвет, при вспышке искр — ярче, при вспышке «починено» — мятный и крупнее
      for (const it of items) {
        if (it.st === 'off') { lit.hide(it.i); continue; }
        const gl = it.b.glow, fix = it.flashed; toShip(it, gl.p, tmp);
        if (fix) col.copy(MINT); else col.copy(gl.color);
        const boost = high && it.b.sparks ? it.flash * 0.7 : 0, k = it.root.scale.x, a = fix ? 0.9 * (1 - it.fu) : Math.min(1, gl.a + boost), sz = ITEM_SCALE * (fix ? 1.9 * (0.6 + 0.4 * it.fu) : gl.size * k * (1 + boost * 0.4));
        lit.set(it.i, tmp.x, tmp.y, tmp.z, sz, col.r, col.g, col.b, a, 0);
      }
      dust.forEach((p, i) => { if (!p.alive) { smoke!.hide(i); return; } const u = p.age / p.life, e = 1 - (1 - u) ** 2, a = p.a * Math.min(1, u / 0.12) * (1 - u) ** 1.3; col.copy(p.c0).lerp(p.c1, u); smoke!.set(i, p.x, p.y, p.z, lerp(p.s0, p.s1, e), col.r, col.g, col.b, a, 2); });
      sparks.forEach((p, i) => { const j = MAX_DAMAGE + i; if (!p.alive) { lit.hide(j); return; } const u = p.age / p.life; lit.set(j, p.x, p.y, p.z, lerp(p.s0, p.s1, u), p.c0.r, p.c0.g, p.c0.b, p.a * (1 - u * u), 1); });
      smoke?.flush(); lit.flush();
    },
    pick(ray) {
      let best = -1, bd = Infinity;
      for (const it of items) {
        if (!shown(it)) continue;
        it.root.updateWorldMatrix(true, false); tmp.set(0, 0.3, 0).applyMatrix4(it.root.matrixWorld);
        const r = it.b.pick * ITEM_SCALE * it.root.matrixWorld.getMaxScaleOnAxis(), d = ray.ray.distanceSqToPoint(tmp);
        if (d <= r * r && d < bd) { bd = d; best = it.i; }
      }
      return best;
    },
    positions: () => items.filter(shown).map(it => api.at(it.i)),
    at(i) { const it = items[i]; if (!it) return new THREE.Vector3(); it.root.updateWorldMatrix(true, false); return new THREE.Vector3(0, 0.3, 0).applyMatrix4(it.root.matrixWorld); },
    visible: () => items.filter(shown).map(it => it.i),
    stats: () => ({ particles: live, visible: shownCount() }),
    dispose() {
      if (disposed) return; disposed = true;
      for (const it of items) it.done.splice(0).forEach(f => f());
      ship.remove(g);
      for (const o of own) o.dispose();
    },
  };
  return api;
}
