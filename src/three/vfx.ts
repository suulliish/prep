// «Сочность» боя: пул billboard-частиц из одного атласа (public/fx/fx-atlas.png, Kenney Particle Pack + Smoke Particles, CC0).
// Два вызова отрисовки на всю сцену (аддитивный — искры/вспышки, обычный — дым/пыль), инстансинг, ни одной аллокации в кадре.
// Спрайты белые, красятся цветом частицы. Режимы: 0 — лицом к камере с поворотом, 1 — лёжа на земле, 2 — вытянут по скорости (искра-«комета»),
// 3 — вертикальный (столб света). Помощники (hitSpark, slash, critBurst, poof…) — готовые рецепты, арена только зовёт их в нужный момент.
import * as THREE from 'three';

// ---------- атлас: 8 колонок x 6 рядов, ячейка 128 px; ряды 3–5 — покадровые ленты по 8 кадров ----------
const COLS = 8, ROWS = 6;
export const CELL = {
  STAR4: 0, GLARE: 1, STAR_SOFT: 2, DOT: 3, RING: 4, RING_THICK: 5, SLASH_A: 6, SLASH_B: 7,
  TWIRL_A: 8, TWIRL_B: 9, ZAP_A: 10, ZAP_B: 11, MAGIC: 12, DIAMOND: 13, STAR_S: 14, STAR_T: 15,
  SMOKE_A: 16, SMOKE_B: 17, DIRT: 18, SCRATCH: 19, LIGHT: 20, STREAK: 21, PILLAR: 22, COIN: 23,
  PUFF: 24, EXPLOSION: 32, FLASH: 40,   // ленты: кадры подряд, по 8
} as const;
const FRAMES = 8;
const EPS_U = 0.5 / (128 * COLS), EPS_V = 0.5 / (128 * ROWS);   // полпикселя внутрь ячейки, чтобы соседний спрайт не подмешивался

// ---------- шейдер ----------
const VERT = /* glsl */ `
attribute vec3 aPos; attribute vec4 aSR; attribute vec3 aVel; attribute vec4 aUV; attribute vec4 aCol;
uniform float uBias;
varying vec2 vUv; varying vec4 vCol;
void main() {
  float mode = aSR.w;
  vec2 s = position.xy * aSR.xy;
  vec3 camR = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  vec3 camU = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  float c = cos(aSR.z), n = sin(aSR.z);
  vec3 r, u;
  if (mode < 0.5) { r = camR * c + camU * n; u = -camR * n + camU * c; }
  else if (mode < 1.5) { r = vec3(c, 0.0, -n); u = vec3(-n, 0.0, -c); }
  else if (mode < 2.5) { vec3 vv = (viewMatrix * vec4(aVel, 0.0)).xyz; vec2 d = normalize(vv.xy + vec2(1e-5)); r = camR * d.x + camU * d.y; u = -camR * d.y + camU * d.x; }
  else { vec3 h = vec3(camR.x, 0.0, camR.z); r = normalize(h + vec3(1e-5, 0.0, 0.0)); u = vec3(0.0, 1.0, 0.0); }
  vec4 mv = viewMatrix * vec4(aPos + r * s.x + u * s.y, 1.0);
  if (mode < 1.5 || (mode > 1.5 && mode < 2.5)) mv.z += uBias * max(aSR.x, aSR.y);   // вперёд к камере: искры не режутся телом врага
  gl_Position = projectionMatrix * mv;
  vUv = aUV.xy + (position.xy + 0.5) * aUV.zw;
  vCol = aCol;
}`;
const FRAG = /* glsl */ `
uniform sampler2D uMap;
varying vec2 vUv; varying vec4 vCol;
void main() {
  float a = texture2D(uMap, vUv).r * vCol.a;
  if (a < 0.003) discard;
  gl_FragColor = vec4(vCol.rgb, a);
  #include <colorspace_fragment>
}`;

// ---------- пул ----------
// поля состояния одной частицы (плоский массив, шаг NS)
const F = { px: 0, py: 1, pz: 2, vx: 3, vy: 4, vz: 5, age: 6, life: 7, s0: 8, s1: 9, ar: 10, h0: 11, h1: 12, rot: 13, spin: 14, a0: 15, atk: 16, fp: 17, k: 18, drag: 19, grav: 20,
  r0: 21, g0: 22, b0: 23, r1: 24, g1: 25, b1: 26, cell: 27, frames: 28, mode: 29, delay: 30, stretchV: 31 };
const NS = 32;

export interface P {
  /** ускорение вниз (по умолчанию 0) */ g?: number; /** сопротивление, 1/с */ drag?: number; rot?: number; spin?: number;
  /** пик прозрачности (1) */ a?: number; /** доля жизни на нарастание (0.05) */ atk?: number; /** степень затухания (1.2) */ fp?: number;
  /** степень роста размера, 1 линейно, 3 — резкий старт (2) */ k?: number; /** высота/ширина */ ar?: number; h0?: number; h1?: number;
  mode?: 0 | 1 | 2 | 3; /** число кадров ленты: проигрывается за жизнь */ frames?: number; delay?: number;
  /** цвет, hex */ c?: number; /** сколько белого подмешать 0..1 */ w?: number; /** яркость-множитель */ gain?: number; /** цвет к концу жизни */ c1?: number; gain1?: number;
}

const _c = new THREE.Color();
class Pool {
  readonly mesh: THREE.Mesh;
  readonly geo = new THREE.InstancedBufferGeometry();
  readonly mat: THREE.ShaderMaterial;
  private st: Float32Array;
  private free: Int32Array; private nfree: number;
  private aPos: THREE.InstancedBufferAttribute; private aSR: THREE.InstancedBufferAttribute; private aVel: THREE.InstancedBufferAttribute;
  private aUV: THREE.InstancedBufferAttribute; private aCol: THREE.InstancedBufferAttribute;
  live = 0;
  constructor(readonly cap: number, additive: boolean, tex: THREE.Texture, order: number) {
    const q = new THREE.PlaneGeometry(1, 1);
    this.geo.index = q.index; this.geo.setAttribute('position', q.getAttribute('position')); this.geo.setAttribute('uv', q.getAttribute('uv'));
    const mk = (n: number) => { const a = new THREE.InstancedBufferAttribute(new Float32Array(cap * n), n); a.setUsage(THREE.DynamicDrawUsage); return a; };
    this.aPos = mk(3); this.aSR = mk(4); this.aVel = mk(3); this.aUV = mk(4); this.aCol = mk(4);
    this.geo.setAttribute('aPos', this.aPos); this.geo.setAttribute('aSR', this.aSR); this.geo.setAttribute('aVel', this.aVel); this.geo.setAttribute('aUV', this.aUV); this.geo.setAttribute('aCol', this.aCol);
    this.geo.instanceCount = 0;
    this.mat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms: { uMap: { value: tex }, uBias: { value: 0.45 } },
      transparent: true, depthWrite: false, depthTest: true, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, fog: false });
    this.mesh = new THREE.Mesh(this.geo, this.mat); this.mesh.frustumCulled = false; this.mesh.renderOrder = order;   // всегда «виден»: с нулём частиц ничего не рисуется, зато шейдер собирается сразу, а не на первом ударе
    this.st = new Float32Array(cap * NS); this.free = new Int32Array(cap); this.nfree = 0; this.reset();
  }
  reset() { this.st.fill(0); for (let i = 0; i < this.cap; i++) this.free[i] = this.cap - 1 - i; this.nfree = this.cap; this.live = 0; this.geo.instanceCount = 0; }
  emit(cell: number, x: number, y: number, z: number, vx: number, vy: number, vz: number, s0: number, s1: number, life: number, o: P = EMPTY) {
    if (this.nfree === 0) return;
    const i = this.free[--this.nfree], s = this.st, b = i * NS; this.live++;
    s[b + F.px] = x; s[b + F.py] = y; s[b + F.pz] = z; s[b + F.vx] = vx; s[b + F.vy] = vy; s[b + F.vz] = vz;
    s[b + F.age] = 0; s[b + F.life] = life; s[b + F.s0] = s0 * SK; s[b + F.s1] = s1 * SK; s[b + F.ar] = o.ar ?? 1; s[b + F.h0] = (o.h0 ?? 0) * SK; s[b + F.h1] = (o.h1 ?? 0) * SK;
    s[b + F.rot] = o.rot ?? 0; s[b + F.spin] = o.spin ?? 0; s[b + F.a0] = o.a ?? 1; s[b + F.atk] = o.atk ?? 0.05; s[b + F.fp] = o.fp ?? 1.2; s[b + F.k] = o.k ?? 2;
    s[b + F.drag] = o.drag ?? 0; s[b + F.grav] = o.g ?? 0;
    const w = o.w ?? 0, g = o.gain ?? 1;
    _c.setHex(o.c ?? 0xffffff); s[b + F.r0] = (_c.r + (1 - _c.r) * w) * g; s[b + F.g0] = (_c.g + (1 - _c.g) * w) * g; s[b + F.b0] = (_c.b + (1 - _c.b) * w) * g;
    if (o.c1 !== undefined) { const g1 = o.gain1 ?? g; _c.setHex(o.c1); s[b + F.r1] = _c.r * g1; s[b + F.g1] = _c.g * g1; s[b + F.b1] = _c.b * g1; }
    else { s[b + F.r1] = s[b + F.r0]; s[b + F.g1] = s[b + F.g0]; s[b + F.b1] = s[b + F.b0]; }
    s[b + F.cell] = cell; s[b + F.frames] = o.frames ?? 1; s[b + F.mode] = o.mode ?? 0; s[b + F.delay] = o.delay ?? 0;
  }
  update(dt: number) {
    const s = this.st, cap = this.cap;
    if (this.live === 0 && this.geo.instanceCount === 0) return;
    const pos = this.aPos.array as Float32Array, sr = this.aSR.array as Float32Array, vel = this.aVel.array as Float32Array, uv = this.aUV.array as Float32Array, col = this.aCol.array as Float32Array;
    let n = 0, alive = 0;
    const du = 1 / COLS, dv = 1 / ROWS;
    for (let i = 0; i < cap; i++) {
      const b = i * NS, life = s[b + F.life];
      if (life <= 0) continue;
      alive++;
      if (s[b + F.delay] > 0) { s[b + F.delay] -= dt; continue; }
      const age = (s[b + F.age] += dt);
      if (age >= life) { s[b + F.life] = 0; this.free[this.nfree++] = i; alive--; continue; }
      const u = age / life;
      // движение
      const drag = s[b + F.drag]; if (drag > 0) { const f = 1 / (1 + drag * dt); s[b + F.vx] *= f; s[b + F.vy] *= f; s[b + F.vz] *= f; }
      s[b + F.vy] -= s[b + F.grav] * dt;
      s[b + F.px] += s[b + F.vx] * dt; s[b + F.py] += s[b + F.vy] * dt; s[b + F.pz] += s[b + F.vz] * dt;
      s[b + F.rot] += s[b + F.spin] * dt;
      // размер и прозрачность
      const e = 1 - Math.pow(1 - u, s[b + F.k]);
      const sx = s[b + F.s0] + (s[b + F.s1] - s[b + F.s0]) * e;
      const ar = s[b + F.ar], h0 = s[b + F.h0];
      const sy = h0 > 0 ? h0 + (s[b + F.h1] - h0) * e : sx * ar;
      const atk = s[b + F.atk], a = s[b + F.a0] * (u < atk ? u / atk : 1) * Math.pow(1 - u, s[b + F.fp]);
      // кадр ленты
      const fr = s[b + F.frames], cell = s[b + F.cell], f = fr > 1 ? Math.min(fr - 1, Math.floor(u * fr)) : 0;
      const cc = (cell + f) % COLS, cr = Math.floor((cell + f) / COLS);
      const o3 = n * 3, o4 = n * 4;
      pos[o3] = s[b + F.px]; pos[o3 + 1] = s[b + F.py]; pos[o3 + 2] = s[b + F.pz];
      sr[o4] = sx; sr[o4 + 1] = sy; sr[o4 + 2] = s[b + F.rot]; sr[o4 + 3] = s[b + F.mode];
      vel[o3] = s[b + F.vx]; vel[o3 + 1] = s[b + F.vy]; vel[o3 + 2] = s[b + F.vz];
      uv[o4] = cc * du + EPS_U; uv[o4 + 1] = 1 - (cr + 1) * dv + EPS_V; uv[o4 + 2] = du - 2 * EPS_U; uv[o4 + 3] = dv - 2 * EPS_V;
      col[o4] = s[b + F.r0] + (s[b + F.r1] - s[b + F.r0]) * u; col[o4 + 1] = s[b + F.g0] + (s[b + F.g1] - s[b + F.g0]) * u; col[o4 + 2] = s[b + F.b0] + (s[b + F.b1] - s[b + F.b0]) * u; col[o4 + 3] = a;
      n++;
    }
    this.live = alive;
    this.geo.instanceCount = n;
    if (n > 0) { this.aPos.needsUpdate = this.aSR.needsUpdate = this.aVel.needsUpdate = this.aUV.needsUpdate = this.aCol.needsUpdate = true; }
  }
  dispose() { this.geo.dispose(); this.mat.dispose(); }
}
const EMPTY: P = {};
/** Общий множитель размера спрайтов: на телефоне (мало пикселей на единицу мира) эффекты крупнее. */
let SK = 1;

// ---------- сам движок эффектов ----------
export interface VfxOpts { km: number; high: boolean; url?: string }

export function createVfx(scene: THREE.Scene, camera: THREE.Camera, o: VfxOpts) {
  const km = o.km, cap = o.high ? 400 : 200;
  const tex = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1); tex.needsUpdate = true;   // пока атлас грузится — пустой (ничего не рисуется)
  const url = o.url ?? new URL('fx/fx-atlas.png', document.baseURI).href;
  let atlas: THREE.Texture | null = null, dead = false;
  new THREE.TextureLoader().load(url, t => {
    if (dead) { t.dispose(); return; }
    t.colorSpace = THREE.NoColorSpace; t.generateMipmaps = false; t.minFilter = t.magFilter = THREE.LinearFilter; t.needsUpdate = true;
    atlas = t; add.mat.uniforms.uMap.value = t; nor.mat.uniforms.uMap.value = t;
  });
  const add = new Pool(cap, true, tex, 8), nor = new Pool(Math.round(cap * 0.4), false, tex, 7);
  scene.add(add.mesh, nor.mesh);

  /** Количество частиц с поправкой на «меньше движения»: не меньше 1. */
  const cnt = (n: number) => Math.max(1, Math.round(n * (0.4 + 0.6 * km)));
  const rnd = (a: number, b: number) => a + Math.random() * (b - a);
  const TAU = Math.PI * 2;
  const el = camera.matrixWorld.elements;   // строки базиса камеры: право (0..2), вверх (4..6), вперёд-к-нам (8..10)

  /** Направление в плоскости экрана под углом a (0 — вправо) + доля к камере zf. Кладёт результат в dir. */
  const dir = { x: 0, y: 0, z: 0 };
  function screenDir(a: number, zf = 0) {
    const c = Math.cos(a), s = Math.sin(a);
    dir.x = el[0] * c + el[4] * s + el[8] * zf; dir.y = el[1] * c + el[5] * s + el[9] * zf; dir.z = el[2] * c + el[6] * s + el[10] * zf;
  }

  const api = {
    /** Низкоуровневый выпуск одной частицы (аддитивный пул или обычный) — для своих рецептов и отладки. */
    emit: (cell: number, x: number, y: number, z: number, vx: number, vy: number, vz: number, s0: number, s1: number, life: number, p: P = EMPTY, normal = false) => (normal ? nor : add).emit(cell, x, y, z, vx, vy, vz, s0, s1, life, p),
    /** Искры удара: вспышка, четырёхлучевая звезда, кольцо, кометы и точки. power — сила (1 обычный, 1.6 крит). */
    hitSpark(p: THREE.Vector3, color: number, power = 1) {
      const { x, y, z } = p;
      add.emit(CELL.GLARE, x, y, z, 0, 0, 0, 0.5 * power, 2.0 * power, 0.18, { c: color, w: 0.3, gain: 1.0, a: 0.55, k: 3, fp: 1.6 });
      add.emit(CELL.STAR4, x, y, z, 0, 0, 0, 0.3 * power, 2.1 * power, 0.28, { c: color, w: 0.3, gain: 1.05, rot: rnd(0, 1), spin: rnd(-3, 3), k: 3 });
      add.emit(CELL.RING, x, y, z, 0, 0, 0, 0.3 * power, 1.9 * power, 0.26, { c: color, w: 0.2, gain: 0.95, a: 0.85, k: 3, fp: 1 });
      const n = cnt(11 * power);
      for (let i = 0; i < n; i++) {
        screenDir(rnd(0, TAU), rnd(0.1, 0.5)); const sp = rnd(4.5, 9) * power * (0.7 + 0.3 * km);
        add.emit(CELL.STREAK, x, y, z, dir.x * sp, dir.y * sp + 1, dir.z * sp, rnd(0.7, 1.15) * power, 0.15, rnd(0.28, 0.5), { mode: 2, ar: 0.16, c: color, w: 0.3, gain: 1.1, drag: 3.2, g: 5, k: 1.5, fp: 1 });
      }
      const m = cnt(6 * power);
      for (let i = 0; i < m; i++) {
        screenDir(rnd(0, TAU), 0.3); const sp = rnd(1.5, 4.5);
        add.emit(CELL.DOT, x, y, z, dir.x * sp, dir.y * sp + 1.5, dir.z * sp, rnd(0.2, 0.38), 0.03, rnd(0.45, 0.8), { c: color, w: 0.3, gain: 1.05, g: 7, drag: 1.5, k: 1.2, fp: 1 });
      }
    },
    /** Взмах: серпы вдоль направления удара (dir — куда движется клинок, мировой вектор). size — размер дуги. */
    slash(p: THREE.Vector3, d: THREE.Vector3, color: number, size = 3) {
      const a = Math.atan2(d.x * el[4] + d.y * el[5] + d.z * el[6], d.x * el[0] + d.y * el[1] + d.z * el[2]);
      const { x, y, z } = p;
      // основной серп выпуклой стороной по ходу удара, разворачивается сверху вниз; ниже — белая тонкая дуга и царапины
      add.emit(CELL.TWIRL_A, x, y, z, 0, 0, 0, size * 0.7, size * 1.25, 0.26, { c: color, w: 0.25, gain: 1.35, rot: a + 0.75, spin: -6, k: 1.8, fp: 1.3, atk: 0.08 });
      add.emit(CELL.SLASH_B, x, y, z, 0, 0, 0, size * 0.65, size * 1.15, 0.22, { c: 0xffffff, gain: 1.1, rot: a - Math.PI / 2 + 0.6, spin: -6, k: 1.8, fp: 1.3, atk: 0.08 });
      add.emit(CELL.SCRATCH, x + d.x * 0.1, y + d.y * 0.1, z + 0.05, 0, 0, 0, size * 0.85, size * 1.15, 0.24, { c: color, w: 0.5, gain: 1.4, rot: a - Math.PI / 4, k: 2.2, fp: 1.4, atk: 0.06 });
    },
    /** Крит/суперудар: большая вспышка, вращающийся знак, звёзды и лучи по кругу. gold — золотой (суперудар). */
    critBurst(p: THREE.Vector3, c1 = 0xffcb2e, c2 = 0x35e6ff, power = 1) {
      const { x, y, z } = p;
      add.emit(CELL.GLARE, x, y, z, 0, 0, 0, 0.8 * power, 3.6 * power, 0.28, { c: c1, w: 0.3, gain: 1.0, a: 0.65, k: 3, fp: 1.5 });
      add.emit(CELL.MAGIC, x, y, z, 0, 0, 0, 0.5 * power, 3.6 * power, 0.5, { c: c1, w: 0.25, gain: 1.05, rot: rnd(0, 1), spin: 2.4, k: 2.5, fp: 1.1 });
      add.emit(CELL.RING_THICK, x, y, z, 0, 0, 0, 0.4 * power, 3.8 * power, 0.42, { c: c2, w: 0.3, gain: 1.0, a: 0.8, k: 3, fp: 1 });
      const n = cnt(8);
      for (let i = 0; i < n; i++) {
        screenDir((i / n) * TAU + rnd(-0.2, 0.2), 0.2); const sp = rnd(3, 6.5) * power * (0.7 + 0.3 * km), big = i % 2 === 0;
        add.emit(big ? CELL.STAR4 : CELL.STAR_S, x, y, z, dir.x * sp, dir.y * sp + 0.6, dir.z * sp, rnd(0.6, 1.0) * power, 0.05, rnd(0.55, 0.85), { c: i % 3 === 0 ? c2 : c1, w: 0.3, gain: 1.1, rot: rnd(0, 1), spin: rnd(-4, 4), drag: 2.4, g: 1.5, k: 1.4, fp: 0.8 });
      }
      const m = cnt(14);
      for (let i = 0; i < m; i++) {
        screenDir((i / m) * TAU + rnd(-0.15, 0.15), 0.15); const sp = rnd(9, 14) * power * (0.7 + 0.3 * km);
        add.emit(CELL.STREAK, x, y, z, dir.x * sp, dir.y * sp, dir.z * sp, rnd(1.2, 1.9) * power, 0.2, rnd(0.25, 0.4), { mode: 2, ar: 0.13, c: i % 2 ? c1 : 0xffffff, w: 0.3, gain: 1.15, drag: 4, k: 1.6, fp: 1 });
      }
    },
    /** Одиночная вспышка-свечение. */
    glow(p: THREE.Vector3, color: number, size = 1.5, life = 0.25) { add.emit(CELL.GLARE, p.x, p.y, p.z, 0, 0, 0, size * 0.4, size, life, { c: color, w: 0.3, gain: 1.05, k: 3, fp: 1.5 }); },
    /** Хвост магического снаряда: зовётся каждый кадр, пока снаряд летит. */
    magicTrail(p: THREE.Vector3, color: number, dt: number) {
      add.emit(CELL.GLARE, p.x, p.y, p.z, 0, 0, 0, 1.15, 1.15, Math.max(0.05, dt * 1.6), { c: color, w: 0.3, gain: 1.1, atk: 0.01, fp: 0.5, a: 0.9 });
      const n = Math.random() < dt * 90 * (0.4 + 0.6 * km) ? 1 : 0;
      for (let i = 0; i < n; i++) {
        add.emit(CELL.DOT, p.x + rnd(-0.15, 0.15), p.y + rnd(-0.15, 0.15), p.z + rnd(-0.1, 0.1), rnd(-0.4, 0.4), rnd(-0.2, 0.7), rnd(-0.3, 0.3), rnd(0.4, 0.65), 0.02, rnd(0.3, 0.5), { c: color, w: 0.3, gain: 1.05, k: 1.5, fp: 1 });
        if (Math.random() < 0.35) add.emit(CELL.STAR_S, p.x, p.y, p.z, rnd(-0.8, 0.8), rnd(-0.4, 0.9), rnd(-0.4, 0.4), rnd(0.3, 0.5), 0.02, rnd(0.35, 0.55), { c: 0xffffff, gain: 1.0, spin: rnd(-4, 4), k: 1.3, fp: 1 });
      }
    },
    /** Попадание снаряда в щит: вспышка, круги света, короткие молнии, кометы наружу. */
    shieldHit(p: THREE.Vector3, color = 0x35e6ff, c2 = 0xff4fb8) {
      api.hitSpark(p, color, 1.15);
      add.emit(CELL.LIGHT, p.x, p.y, p.z, 0, 0, 0, 0.6, 3.2, 0.34, { c: color, w: 0.2, gain: 1.05, a: 0.9, rot: rnd(0, TAU), spin: 2, k: 2.5, fp: 1.2 });
      add.emit(CELL.ZAP_A, p.x, p.y, p.z, 0, 0, 0, 1.2, 2.4, 0.2, { c: c2, w: 0.3, gain: 1.15, rot: rnd(0, TAU), k: 2.5, fp: 1 });
      add.emit(CELL.ZAP_B, p.x, p.y, p.z, 0, 0, 0, 1.0, 2.0, 0.17, { c: 0xffffff, gain: 1.1, rot: rnd(0, TAU), k: 2.5, fp: 1 });
    },
    /** Гибель монстра: вспышка-взрыв (покадрово), клубы дыма, звёзды вверх, кольцо на земле. */
    poof(p: THREE.Vector3, color = 0xff4fb8, scale = 1) {
      const { x, y, z } = p;
      add.emit(CELL.FLASH, x, y, z, 0, 0, 0, 1.2 * scale, 3.6 * scale, 0.4, { c: 0xffa63a, w: 0.1, gain: 1.0, c1: color, gain1: 0.9, a: 0.85, frames: FRAMES, rot: rnd(0, TAU), k: 2.2, fp: 1.3, atk: 0.02 });
      add.emit(CELL.GLARE, x, y, z, 0, 0, 0, 1, 3.4 * scale, 0.26, { c: color, w: 0.3, gain: 1.0, a: 0.5, k: 3, fp: 1.6 });
      add.emit(CELL.RING, x, 0.2, z, 0, 0, 0, 0.6, 5 * scale, 0.45, { mode: 1, c: color, w: 0.3, gain: 1.0, a: 0.85, k: 3 });
      const n = cnt(9);
      for (let i = 0; i < n; i++) {
        const a = rnd(0, TAU), r = rnd(0.1, 0.5) * scale, sp = rnd(1.4, 3) * scale;
        nor.emit(CELL.PUFF + ((Math.random() * FRAMES) | 0), x + Math.cos(a) * r, y + rnd(-0.4, 0.5) * scale, z + Math.sin(a) * r * 0.6 + 0.3,
          Math.cos(a) * sp, rnd(0.6, 2.2), Math.sin(a) * sp * 0.5, rnd(0.6, 1) * scale, rnd(1.6, 2.6) * scale, rnd(0.65, 1.0),
          { c: 0xb9a4ff, w: 0, gain: 1, c1: 0x3f2470, gain1: 0.8, a: 0.9, rot: rnd(0, TAU), spin: rnd(-1.2, 1.2), drag: 2.6, g: -0.5, k: 1.6, fp: 1.4, atk: 0.1, delay: rnd(0, 0.08) });
      }
      const m = cnt(16);
      for (let i = 0; i < m; i++) {
        const a = rnd(0, TAU), sp = rnd(1.5, 4.5) * scale, cc = i % 3 === 0 ? 0xffe07a : i % 3 === 1 ? color : 0x9be8ff;
        add.emit(i % 2 ? CELL.STAR_S : CELL.STAR4, x, y, z, Math.cos(a) * sp, rnd(1.5, 5), Math.sin(a) * sp * 0.4, rnd(0.3, 0.55), 0.04, rnd(0.8, 1.4), { c: cc, w: 0.3, gain: 1.1, spin: rnd(-3, 3), rot: rnd(0, 3), drag: 1.6, g: 3.5, k: 1.3, fp: 0.9, atk: 0.1, delay: rnd(0, 0.15) });
      }
    },
    /** Пыль приземления/удара о землю: кольцо по земле + клубы в стороны. */
    dust(p: THREE.Vector3, scale = 1, color = 0xd8d0ff) {
      const { x, z } = p, y = p.y + 0.12;
      add.emit(CELL.RING_THICK, x, y, z, 0, 0, 0, 0.5 * scale, 3.4 * scale, 0.38, { mode: 1, c: color, w: 0.3, gain: 0.9, a: 0.7, k: 3, fp: 1.1 });
      const n = cnt(8 * scale);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU + rnd(-0.3, 0.3), sp = rnd(1.8, 3.6) * scale;
        nor.emit(CELL.PUFF + ((Math.random() * FRAMES) | 0), x + Math.cos(a) * 0.3, y + 0.2, z + Math.sin(a) * 0.3, Math.cos(a) * sp, rnd(0.3, 0.9), Math.sin(a) * sp, rnd(0.3, 0.5) * scale, rnd(0.9, 1.5) * scale, rnd(0.42, 0.65),
          { c: color, w: 0.3, gain: 1, c1: 0x9a90c8, gain1: 0.9, a: 0.6, rot: rnd(0, TAU), spin: rnd(-1, 1), drag: 3.4, g: -0.4, k: 1.8, fp: 1.3, atk: 0.1 });
      }
    },
    /** Столб света (уровень/сундук/портал): вертикальный луч, кольца по земле, искры вверх. */
    levelUpPillar(p: THREE.Vector3, color = 0xffe07a, h = 6.5) {
      const { x, y, z } = p;
      add.emit(CELL.PILLAR, x, y + h / 2, z, 0, 0, 0, 1.7, 0.7, 1.0, { mode: 3, h0: h, h1: h, c: color, w: 0.3, gain: 1.15, a: 0.95, k: 1.6, fp: 1.1, atk: 0.06 });
      add.emit(CELL.PILLAR, x, y + h / 2, z, 0, 0, 0, 0.7, 0.25, 0.8, { mode: 3, h0: h, h1: h, c: 0xffffff, gain: 1.1, a: 0.55, k: 1.4, fp: 1.3, atk: 0.05 });
      for (let i = 0; i < 2; i++) add.emit(CELL.RING, x, y + 0.14, z, 0, 0, 0, 0.5, 4.2, 0.6, { mode: 1, c: color, w: 0.3, gain: 1.05, a: 0.9, k: 2.5, fp: 1, delay: i * 0.18 });
      add.emit(CELL.GLARE, x, y + 0.3, z, 0, 0, 0, 1.2, 3.2, 0.5, { c: color, w: 0.3, gain: 1.15, k: 2, fp: 1.4 });
      const n = cnt(22);
      for (let i = 0; i < n; i++) {
        const a = rnd(0, TAU), r = rnd(0.2, 1.1);
        add.emit(i % 3 === 0 ? CELL.STAR_S : CELL.DOT, x + Math.cos(a) * r, y + rnd(0, 0.5), z + Math.sin(a) * r * 0.5 + 0.2, 0, rnd(2.5, 5.5), 0, rnd(0.25, 0.5), 0.03, rnd(0.8, 1.5), { c: i % 2 ? color : 0xffffff, w: 0.3, gain: 1.1, spin: rnd(-2, 2), k: 1.2, fp: 0.9, atk: 0.12, delay: rnd(0, 0.5) });
      }
    },
    /** Фонтан искр из открытого сундука/над героем: золотые звёзды вверх и падают. */
    chestSparkle(p: THREE.Vector3, gold = 0xffcb2e, alt = 0xa77bff) {
      const { x, y, z } = p;
      add.emit(CELL.GLARE, x, y, z, 0, 0, 0, 0.8, 3.6, 0.5, { c: gold, w: 0.3, gain: 1.15, k: 2, fp: 1.3 });
      add.emit(CELL.LIGHT, x, y, z, 0, 0, 0, 0.5, 2.6, 0.5, { c: gold, w: 0.3, gain: 1.0, a: 0.8, spin: 1.2, k: 2, fp: 1.2 });
      const n = cnt(26);
      for (let i = 0; i < n; i++) {
        const a = rnd(0, TAU), sp = rnd(0.8, 3.2), cc = i % 4 === 0 ? alt : i % 4 === 1 ? 0xffffff : gold;
        add.emit(i % 3 === 0 ? CELL.STAR4 : i % 3 === 1 ? CELL.STAR_S : CELL.DOT, x, y, z, Math.cos(a) * sp, rnd(4, 8.5), Math.sin(a) * sp * 0.5, rnd(0.3, 0.7), 0.04, rnd(0.9, 1.5),
          { c: cc, w: 0.3, gain: 1.1, spin: rnd(-4, 4), rot: rnd(0, 3), g: 9, drag: 0.6, k: 1.3, fp: 0.9, atk: 0.06, delay: rnd(0, 0.35) });
      }
    },
    /** Сходящиеся к точке искры (зарядка суперудара): зовётся каждый кадр. */
    charge(p: THREE.Vector3, color: number, dt: number, radius = 2) {
      const n = dt * 110 * (0.4 + 0.6 * km); let k = Math.floor(n); if (Math.random() < n - k) k++;
      for (let i = 0; i < k; i++) {
        const th = rnd(0, TAU), ph = Math.acos(rnd(-1, 1)), r = radius * rnd(0.8, 1.2), life = rnd(0.28, 0.42);
        const ox = Math.sin(ph) * Math.cos(th) * r, oy = Math.cos(ph) * r * 0.8, oz = Math.sin(ph) * Math.sin(th) * r;
        add.emit(i % 3 === 0 ? CELL.STAR_S : CELL.DOT, p.x + ox, p.y + oy, p.z + oz, -ox / life, -oy / life, -oz / life, rnd(0.3, 0.55), 0.08, life, { c: i % 2 ? color : 0xffffff, w: 0.3, gain: 1.15, k: 1, fp: 0.4, atk: 0.2 });
      }
    },
    /** Открытие портала (прибытие героя): вспышка, знак, лучи по кругу. */
    portalPop(p: THREE.Vector3, c1 = 0x35e6ff, c2 = 0xa77bff) {
      add.emit(CELL.GLARE, p.x, p.y, p.z, 0, 0, 0, 1, 3.2, 0.3, { c: c1, w: 0.3, gain: 1.0, a: 0.6, k: 2.5, fp: 1.4 });
      add.emit(CELL.MAGIC, p.x, p.y, p.z, 0, 0, 0, 0.8, 3.4, 0.5, { c: c2, w: 0.3, gain: 1.0, a: 0.8, spin: -2.2, k: 2.5, fp: 1.1 });
      add.emit(CELL.RING_THICK, p.x, p.y, p.z, 0, 0, 0, 0.6, 4.6, 0.5, { c: c1, w: 0.3, gain: 1.0, a: 0.8, k: 3 });
      const m = cnt(14);
      for (let i = 0; i < m; i++) {
        screenDir((i / m) * TAU + rnd(-0.15, 0.15), 0.1); const sp = rnd(6, 11);
        add.emit(CELL.STREAK, p.x, p.y, p.z, dir.x * sp, dir.y * sp, dir.z * sp, rnd(1, 1.6), 0.15, rnd(0.3, 0.5), { mode: 2, ar: 0.13, c: i % 2 ? c1 : c2, w: 0.3, gain: 1.15, drag: 3.5, k: 1.6 });
      }
    },
    /** Разлом и выход врага: тёмно-розовые лучи из земли, пыль, кольцо по земле. */
    riftBurst(p: THREE.Vector3, color = 0xff4fb8, scale = 1) {
      add.emit(CELL.RING_THICK, p.x, 0.14, p.z, 0, 0, 0, 0.6, 5.5 * scale, 0.5, { mode: 1, c: color, w: 0.2, gain: 1.05, a: 0.9, k: 3, fp: 1.1 });
      add.emit(CELL.GLARE, p.x, 0.5, p.z, 0, 0, 0, 1, 4 * scale, 0.4, { c: color, w: 0.3, gain: 1.15, k: 2.5, fp: 1.4 });
      const n = cnt(12);
      for (let i = 0; i < n; i++) {
        const a = rnd(-0.5, 0.5) + Math.PI / 2, sp = rnd(6, 11);
        add.emit(CELL.STREAK, p.x + rnd(-0.6, 0.6) * scale, 0.3, p.z + rnd(-0.3, 0.3), Math.cos(a) * sp * 0.5, Math.sin(a) * sp, 0, rnd(1, 1.8), 0.2, rnd(0.35, 0.6), { mode: 2, ar: 0.14, c: i % 2 ? color : 0xc78bff, w: 0.3, gain: 1.15, drag: 2, g: 6, k: 1.5 });
      }
      api.dust(p, 1.1 * scale, 0xc9a4ff);
    },
    /** Салют победы: звёзды вверх во все стороны, падают. */
    sparkleShower(p: THREE.Vector3, colors: number[] = [0xffcb2e, 0x35e6ff, 0xffffff], n0 = 28) {
      add.emit(CELL.GLARE, p.x, p.y, p.z, 0, 0, 0, 0.6, 3, 0.35, { c: colors[0], w: 0.3, gain: 1.15, k: 3, fp: 1.4 });
      const n = cnt(n0);
      for (let i = 0; i < n; i++) {
        const a = rnd(0, TAU), sp = rnd(1.5, 5), c = colors[i % colors.length];
        add.emit(i % 2 ? CELL.STAR4 : CELL.STAR_S, p.x, p.y, p.z, Math.cos(a) * sp, rnd(2, 7), Math.sin(a) * sp * 0.5, rnd(0.35, 0.75), 0.05, rnd(0.9, 1.5), { c, w: 0.3, gain: 1.1, spin: rnd(-4, 4), rot: rnd(0, 3), g: 7, drag: 0.8, k: 1.3, fp: 0.9, atk: 0.05 });
      }
    },
    /** Множитель размера спрайтов (1 — как на десктопе). */
    setScale(k: number) { SK = k; },
    /** Всё убрать (смена сцены). */
    clear() { add.reset(); nor.reset(); },
    update(dt: number) { add.update(dt); nor.update(dt); },
    /** Частиц сейчас живо (для проверок). */
    count: () => add.live + nor.live,
    ready: () => !!atlas,
    dispose() { dead = true; scene.remove(add.mesh, nor.mesh); add.dispose(); nor.dispose(); tex.dispose(); atlas?.dispose(); },
  };
  return api;
}
export type Vfx = ReturnType<typeof createVfx>;
