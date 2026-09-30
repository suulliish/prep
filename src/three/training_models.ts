// Модели тренировочной площадки, собранные кодом (training3d.ts их оживляет): соломенный манекен, мишени, доска тактики, флажки, песок и тюки.
// Всё склеено в геометрии с цветом вершин: один материал и один вызов отрисовки на деталь, ни одной текстуры-картинки. Контур (как у остальных моделей игры) —
// вывернутый раздутый двойник на сглаженных нормалях (у склеенных коробок острые рёбра иначе рвут контур). Оружейная стойка берётся из готового набора arena (Kenney Mini Arena, CC0) в training3d.ts.
import * as THREE from 'three';
import { mergeGeometries, toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export const TAU = Math.PI * 2;
/** Краски площадки: солома, дерево, цвета игры (бирюза, розовый «глитч», золото, сиреневый). */
export const COL = {
  straw: 0xe9c45e, strawD: 0xcf9f3a, strawL: 0xf6de88, sack: 0xdcbc82, wood: 0xb07a45, woodD: 0x86562f, woodL: 0xd29c5e,
  cyan: 0x35e6ff, pink: 0xff4fb8, gold: 0xffcb2e, violet: 0xa77bff, red: 0xe23d4a, cream: 0xf6ecd8, ink: 0x2a1a3a, sand: 0xe6cf98, sandD: 0xcdaa68,
};

type V3 = [number, number, number];
/** Кусочек будущей склейки: форма, цвет, положение, поворот (Эйлер XYZ), масштаб. */
export interface Piece { g: THREE.BufferGeometry; c: number; p?: V3; r?: V3; s?: V3 }
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color();
/** Склейка кусочков в одну геометрию (position, normal, color). Исходные формы — временные, освобождаются здесь. */
export function glue(pieces: Piece[]): THREE.BufferGeometry {
  const list = pieces.map(({ g, c, p = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1] }) => {
    const n = g.index ? g.toNonIndexed() : g.clone();
    for (const k of Object.keys(n.attributes)) if (k !== 'position' && k !== 'normal') n.deleteAttribute(k);
    n.applyMatrix4(_m.compose(_p.set(...p), _q.setFromEuler(_e.set(...r)), _s.set(...s)));
    _c.set(c);
    const a = new Float32Array(n.attributes.position.count * 3);
    for (let i = 0; i < a.length; i += 3) { a[i] = _c.r; a[i + 1] = _c.g; a[i + 2] = _c.b; }
    n.setAttribute('color', new THREE.BufferAttribute(a, 3));
    g.dispose();
    return n;
  });
  const out = mergeGeometries(list, false)!;
  list.forEach(l => l.dispose());
  return out;
}
/** Геометрия для контура: те же вершины, нормали усреднены по всем граням (без цвета). */
export function outlineOf(g: THREE.BufferGeometry): THREE.BufferGeometry {
  const o = toCreasedNormals(g.clone(), Math.PI);
  o.deleteAttribute('color');
  return o;
}

const cyl = (rt: number, rb: number, h: number, seg = 10) => new THREE.CylinderGeometry(rt, rb, h, seg);
const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
const ball = (r: number, ws = 12, hs = 9) => new THREE.SphereGeometry(r, ws, hs);
const cone = (r: number, h: number, seg = 5) => new THREE.ConeGeometry(r, h, seg);
const ring = (R: number, t: number, ts = 6, rs = 20) => new THREE.TorusGeometry(R, t, ts, rs);
/** Эйлер, поворачивающий «вверх» (+y) к направлению (dx, dy, dz): чтобы конус-соломинка смотрела куда надо. */
const aim = (dx: number, dy: number, dz: number): V3 => { const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(dx, dy, dz).normalize()); const e = new THREE.Euler().setFromQuaternion(q); return [e.x, e.y, e.z]; };
const HP = Math.PI / 2;

/** Детерминированный генератор: манекен выглядит одинаково при любом запуске. */
export function rng(seed: number) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

/** Пучок соломинок-конусов: n штук по кругу радиуса R на высоте y, торчат наружу и вниз (down > 0) или вверх. */
function tufts(n: number, R: number, y: number, len: number, down: number, rnd: () => number, cols = [COL.straw, COL.strawD, COL.strawL]): Piece[] {
  const out: Piece[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + rnd() * 0.3, dx = Math.cos(a), dz = Math.sin(a);
    out.push({ g: cone(0.045, len, 4), c: cols[i % cols.length], p: [dx * R, y - down * len * 0.35, dz * R], r: aim(dx * 0.55, -down, dz * 0.55), s: [1, 1, 1] });
  }
  return out;
}

/** Соломенный манекен. Система: пол y = 0, лицо к +z, руки вдоль ±x (yaw ставит сам модуль). Кости-детали хранят точку вращения в начале своей геометрии. */
export interface DummyGeos { base: THREE.BufferGeometry; torso: THREE.BufferGeometry; armL: THREE.BufferGeometry; armR: THREE.BufferGeometry; head: THREE.BufferGeometry; tail: THREE.BufferGeometry; cracks: THREE.BufferGeometry; plank: THREE.BufferGeometry }
/** Где точки вращения деталей (в системе манекена): плечи, шея, узел шарфа. */
export const PIVOT = { base: 0.16, shoulderY: 1.42, shoulderX: 0.34, neckY: 1.7, tail: [0.2, 1.62, 0.3] as V3, chest: [0, 1.16, 0] as V3 };
export function buildDummy(): DummyGeos {
  const rnd = rng(7);
  // подставка: круглая плаха и второй ярус
  const base = glue([{ g: cyl(0.52, 0.62, 0.16, 16), c: COL.woodD, p: [0, 0.08, 0] }, { g: cyl(0.4, 0.44, 0.06, 16), c: COL.woodL, p: [0, 0.19, 0] }]);

  // туловище: мешок с соломой на столбе; пояс-верёвка, заплатка, мишень на груди, шарф на шее
  const prof = [[0.001, 0.52], [0.3, 0.5], [0.43, 0.62], [0.47, 0.86], [0.43, 1.15], [0.34, 1.42], [0.2, 1.6], [0.001, 1.66]].map(([x, y]) => new THREE.Vector2(x, y));
  const torso: Piece[] = [
    { g: cyl(0.085, 0.095, 1.5, 8), c: COL.wood, p: [0, 0.93, 0] },
    { g: new THREE.LatheGeometry(prof, 14), c: COL.straw, s: [1, 1, 0.88] },
    ...tufts(14, 0.4, 0.5, 0.34, 1, rnd),
    { g: ring(0.47, 0.045), c: COL.woodD, p: [0, 0.86, 0], r: [HP, 0, 0], s: [1, 0.88, 1] },
    { g: ring(0.32, 0.04), c: COL.woodD, p: [0, 1.46, 0], r: [HP, 0, 0], s: [1, 0.88, 1] },
    // шарф вокруг шеи
    { g: ring(0.25, 0.075, 6, 16), c: COL.cyan, p: [0, 1.58, 0], r: [HP, 0, 0], s: [1, 0.9, 1] },
    // заплатка со стежками (слева от груди, выше мишени)
    { g: box(0.2, 0.2, 0.03), c: COL.violet, p: [-0.24, 0.72, 0.4], r: [0, 0, 0.2] },
    { g: box(0.2, 0.02, 0.035), c: COL.cream, p: [-0.24, 0.72, 0.41], r: [0, 0, 0.2] }, { g: box(0.02, 0.2, 0.035), c: COL.cream, p: [-0.24, 0.72, 0.41], r: [0, 0, 0.2] },
  ];
  // мишень на груди: кольца (центр — золото)
  const rings: [number, number, number][] = [[0.27, 0.03, COL.cream], [0.22, 0.05, COL.red], [0.165, 0.07, COL.cream], [0.11, 0.09, COL.red], [0.055, 0.11, COL.gold]];
  for (const [r, h, c] of rings) torso.push({ g: cyl(r, r, h, 20), c, p: [0, 1.16, 0.385 + h / 2], r: [HP, 0, 0] });

  // рука: перекладина, соломенный рукав, узелки, кисть-веник. Начало — плечо.
  const arm = (side: 1 | -1): THREE.BufferGeometry => {
    const pcs: Piece[] = [
      { g: cyl(0.05, 0.05, 1.0, 8), c: COL.wood, p: [side * 0.5, 0, 0], r: [0, 0, HP] },
      { g: cyl(0.13, 0.15, 0.55, 8), c: COL.straw, p: [side * 0.3, 0, 0], r: [0, 0, HP] },
      { g: ring(0.14, 0.028, 5, 12), c: COL.woodD, p: [side * 0.08, 0, 0], r: [0, HP, 0] }, { g: ring(0.15, 0.028, 5, 12), c: COL.woodD, p: [side * 0.56, 0, 0], r: [0, HP, 0] },
      { g: ball(0.15), c: COL.strawL, p: [side * 0.98, 0, 0], s: [1.3, 1, 1] },
    ];
    for (let i = 0; i < 7; i++) { const a = (i / 7) * TAU, dy = Math.cos(a), dz = Math.sin(a); pcs.push({ g: cone(0.04, 0.28, 4), c: i % 2 ? COL.straw : COL.strawD, p: [side * 1.12, dy * 0.08, dz * 0.08], r: aim(side * 1, dy * 0.5, dz * 0.5) }); }
    return glue(pcs);
  };

  // голова (начало — шея): мешковина, глаза-пуговицы, стежки-улыбка, румянец, нос-морковка, соломенная шляпа с бирюзовой лентой
  const hd: Piece[] = [
    { g: ball(0.3, 14, 10), c: COL.sack, p: [0, 0.26, 0], s: [1, 0.95, 0.95] },
    { g: ball(0.052, 8, 6), c: COL.ink, p: [-0.11, 0.3, 0.26] }, { g: ball(0.052, 8, 6), c: COL.ink, p: [0.11, 0.3, 0.26] },
    { g: ball(0.018, 6, 4), c: COL.cream, p: [-0.095, 0.317, 0.305] }, { g: ball(0.018, 6, 4), c: COL.cream, p: [0.125, 0.317, 0.305] },
    { g: cone(0.04, 0.11, 6), c: 0xff9d3a, p: [0, 0.23, 0.32], r: [HP, 0, 0] },
    { g: ball(0.055, 8, 6), c: 0xff8fb8, p: [-0.2, 0.2, 0.2], s: [1, 1, 0.3], r: [0, -0.7, 0] }, { g: ball(0.055, 8, 6), c: 0xff8fb8, p: [0.2, 0.2, 0.2], s: [1, 1, 0.3], r: [0, 0.7, 0] },
    { g: cyl(0.43, 0.45, 0.04, 20), c: COL.strawL, p: [0, 0.52, 0] }, { g: cyl(0.2, 0.27, 0.2, 14), c: COL.straw, p: [0, 0.63, 0] }, { g: cyl(0.278, 0.285, 0.06, 14), c: COL.cyan, p: [0, 0.55, 0] },
    { g: ring(0.42, 0.02, 4, 24), c: COL.strawD, p: [0, 0.51, 0], r: [HP, 0, 0] },
  ];
  for (let i = 0; i < 5; i++) { const t = i / 4 * 2 - 1; hd.push({ g: box(0.05, 0.016, 0.016), c: COL.ink, p: [t * 0.13, 0.16 + 0.05 * t * t, 0.275], r: [0, 0, -t * 0.55] }); }
  hd.push(...tufts(7, 0.29, 0.34, 0.22, 0, rnd).map(p => ({ ...p, p: [p.p![0], p.p![1], p.p![2] * 0.7] as V3 })));

  // конец шарфа: полоска с золотой каймой (начало — узел)
  const tail = glue([{ g: box(0.15, 0.5, 0.035), c: COL.cyan, p: [0, -0.25, 0] }, { g: box(0.15, 0.06, 0.04), c: COL.gold, p: [0, -0.34, 0] }, { g: box(0.15, 0.06, 0.04), c: COL.gold, p: [0, -0.46, 0] }]);

  // «глитч»: розовые трещины и пиксельные кубики по туловищу
  const cr: Piece[] = [], zig = (x0: number, y0: number, x1: number, y1: number, n: number, w: number, z: number, c: number) => {
    let px = x0, py = y0;
    for (let i = 1; i <= n; i++) {
      const t = i / n, nx = x0 + (x1 - x0) * t + (i < n ? (i % 2 ? 0.05 : -0.05) : 0), ny = y0 + (y1 - y0) * t, dx = nx - px, dy = ny - py, L = Math.hypot(dx, dy);
      cr.push({ g: box(L + w, w, 0.02), c, p: [(px + nx) / 2, (py + ny) / 2, z], r: [0, 0, Math.atan2(dy, dx)] }); px = nx; py = ny;
    }
  };
  zig(-0.05, 1.62, 0.16, 1.2, 4, 0.03, 0.47, COL.pink); zig(0.05, 1.3, -0.2, 0.82, 5, 0.028, 0.47, COL.pink); zig(-0.3, 1.2, -0.42, 0.9, 3, 0.024, 0.4, COL.pink);
  const pr = rng(5);
  for (let i = 0; i < 10; i++) cr.push({ g: box(0.06, 0.06, 0.03), c: [COL.pink, COL.cyan, COL.violet][i % 3], p: [(pr() - 0.5) * 1.1, 0.7 + pr() * 0.95, 0.52 + pr() * 0.12] });
  const cracks = glue(cr);

  // доска, что осталась от манекена: 0.95 × 0.14 × 0.05, два гвоздя
  const plank = glue([{ g: box(0.95, 0.14, 0.05), c: COL.woodL }, { g: box(0.95, 0.03, 0.055), c: COL.wood, p: [0, -0.055, 0] }, { g: box(0.05, 0.05, 0.06), c: COL.ink, p: [-0.4, 0, 0] }, { g: box(0.05, 0.05, 0.06), c: COL.ink, p: [0.4, 0, 0] }]);

  return { base, torso: glue(torso), armL: arm(-1), armR: arm(1), head: glue(hd), tail, cracks, plank };
}

/** Мишень на стойке (лицом к +z): стойка с упором, деревянный обод, кольца. Начало — земля под центром. */
export const TARGET_Y = 1.3;
export function buildTarget(): THREE.BufferGeometry {
  const pcs: Piece[] = [
    { g: cyl(0.045, 0.055, 1.05, 6), c: COL.wood, p: [0, 0.52, 0] },
    { g: cyl(0.03, 0.03, 0.95, 5), c: COL.woodD, p: [-0.16, 0.42, -0.22], r: [-0.4, 0, 0.3] }, { g: cyl(0.03, 0.03, 0.95, 5), c: COL.woodD, p: [0.16, 0.42, -0.22], r: [-0.4, 0, -0.3] },
    { g: ring(0.5, 0.05, 6, 24), c: COL.woodD, p: [0, TARGET_Y, 0.02] },
  ];
  const rings: [number, number, number][] = [[0.49, 0.06, COL.cream], [0.4, 0.085, COL.red], [0.3, 0.11, COL.cream], [0.2, 0.135, COL.red], [0.1, 0.16, COL.gold]];
  for (const [r, h, c] of rings) pcs.push({ g: cyl(r, r, h, 24), c, p: [0, TARGET_Y, h / 2], r: [HP, 0, 0] });
  return glue(pcs);
}

/** Доска тактики: мольберт с рамой, полочка для мела, кусочек мела и стёрка. Лицом к +z, начало — земля. Сама «грифельная» плоскость — отдельный меш (текстура). */
export const BOARD = { w: 1.56, h: 1.0, y: 1.78, z: 0.07 };
export function buildBoardFrame(): THREE.BufferGeometry {
  const t = 0.1, { w, h, y } = BOARD;
  return glue([
    { g: box(w + t, t, t), c: COL.wood, p: [0, y + h / 2, 0] }, { g: box(w + t, t, t), c: COL.wood, p: [0, y - h / 2, 0] },
    { g: box(t, h + t, t), c: COL.wood, p: [-w / 2, y, 0] }, { g: box(t, h + t, t), c: COL.wood, p: [w / 2, y, 0] },
    { g: box(0.08, y + h / 2 + 0.05, 0.08), c: COL.woodD, p: [-w / 2, (y + h / 2 + 0.05) / 2, -0.02] }, { g: box(0.08, y + h / 2 + 0.05, 0.08), c: COL.woodD, p: [w / 2, (y + h / 2 + 0.05) / 2, -0.02] },
    { g: box(0.07, 2.5, 0.07), c: COL.woodD, p: [0, 1.15, -0.52], r: [0.36, 0, 0] },
    { g: box(w + 0.18, 0.06, 0.16), c: COL.woodL, p: [0, y - h / 2 - 0.09, 0.09] },
    { g: box(0.16, 0.035, 0.035), c: COL.cream, p: [-0.4, y - h / 2 - 0.045, 0.13], r: [0, 0.3, 0] },
    { g: box(0.2, 0.06, 0.09), c: COL.violet, p: [0.35, y - h / 2 - 0.03, 0.1] },
    // флажок-вымпел на верху рамы
    { g: ball(0.06, 8, 6), c: COL.gold, p: [0, y + h / 2 + 0.12, 0] },
  ]);
}

/** Шест флажка с золотым шариком (склеивается в общий «декор»); полотнище-вымпел анимируется по вершинам (buildFlag, см. training3d). */
export function pole(h: number): Piece[] { return [{ g: cyl(0.04, 0.05, h, 6), c: COL.wood, p: [0, h / 2, 0] }, { g: ball(0.075, 8, 6), c: COL.gold, p: [0, h + 0.03, 0] }]; }
export const FLAG = { w: 0.95, h: 0.55, nx: 9, ny: 3 };
/** Полотнище: сетка 9×3, сужается к краю (вымпел). База — исходные позиции для волны, цвет вершин: полоса от цвета к светлее. */
export function buildFlag(c0: number, c1: number): { geo: THREE.BufferGeometry; base: Float32Array } {
  const { w, h, nx, ny } = FLAG, geo = new THREE.PlaneGeometry(w, h, nx - 1, ny - 1), p = geo.attributes.position, col = new Float32Array(p.count * 3), a = new THREE.Color(c0), b = new THREE.Color(c1), m = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i) + w / 2, u = x / w;                         // 0 у шеста … 1 на краю
    p.setX(i, x); p.setY(i, p.getY(i) * (1 - u * 0.82));           // вымпел: сужение к острию
    m.copy(a).lerp(b, u); col[i * 3] = m.r; col[i * 3 + 1] = m.g; col[i * 3 + 2] = m.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); geo.deleteAttribute('uv'); geo.computeVertexNormals();
  return { geo, base: (p.array as Float32Array).slice() };
}

/** Площадка: песчаный круг с кольцом-разметкой (без контура, лежит на земле). */
export function buildFloor(): THREE.BufferGeometry {
  return glue([
    { g: new THREE.CircleGeometry(2.6, 40), c: COL.sand, p: [0, 0.02, 0], r: [-HP, 0, 0] },
    { g: new THREE.RingGeometry(1.42, 1.5, 40), c: COL.sandD, p: [0, 0.025, 0], r: [-HP, 0, 0] },
    { g: new THREE.RingGeometry(0.62, 0.68, 32), c: COL.sandD, p: [0, 0.025, 0], r: [-HP, 0, 0] },
  ]);
}
/** Декор: тюки соломы и камни (один меш с контуром). Места — в системе площадки. */
export function buildDecor(rnd: () => number, poles: { x: number; z: number; h: number }[] = []): THREE.BufferGeometry {
  const pcs: Piece[] = [];
  for (const f of poles) for (const q of pole(f.h)) pcs.push({ ...q, p: [f.x + q.p![0], q.p![1], f.z + q.p![2]] });
  const bale = (x: number, z: number, ry: number, s = 1) => {
    pcs.push({ g: cyl(0.34 * s, 0.34 * s, 0.6 * s, 12), c: COL.straw, p: [x, 0.34 * s, z], r: [0, ry, HP] }, { g: ring(0.34 * s, 0.03, 4, 12), c: COL.woodD, p: [x, 0.34 * s, z], r: [0, ry + HP, 0], s: [1, 1, 1] });
    for (let i = 0; i < 5; i++) { const a = rnd() * TAU; pcs.push({ g: cone(0.04, 0.2, 4), c: COL.strawL, p: [x + Math.cos(a) * 0.3, 0.55 * s, z + Math.sin(a) * 0.3], r: aim(Math.cos(a), 0.7, Math.sin(a)) }); }
  };
  bale(-2.2, -0.9, 0.5); bale(-2.0, -1.5, -0.2, 0.85); bale(2.4, 0.8, 1.2, 0.8);
  pcs.push({ g: ball(0.22, 6, 5), c: 0xa9a1c8, p: [-1.6, 0.1, 1.6], s: [1.2, 0.7, 1] }, { g: ball(0.16, 6, 5), c: 0x8f88b3, p: [-1.3, 0.07, 1.8], s: [1.1, 0.7, 1] });
  return glue(pcs);
}

/** Радиальное пятно света (для свечения доски): рисуется на 2D-холсте; без DOM (тесты в node) — нет картинки, возвращается null. */
export function canvas(w: number, h: number): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas'); c.width = w; c.height = h; return c;
}
