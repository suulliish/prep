// «Тренировочная площадка» для уроков: вместо монстра стоит соломенный манекен, вокруг мишени, оружейная стойка, флажки и доска тактики.
// Всё здесь про анимацию: манекен вырастает из земли с пружинкой, качается на затухающих пружинах при ударе (лёгкий, сильный, связка 1..3), разлетается солома,
// при неверном прогнозе он замахивается рукой-палкой на героя (бонк), с розовыми трещинами становится «Глитчем» и рассыпается на доски, мишени выскакивают и крутятся,
// Бит «пишет» мелом на доске, в финале конфетти. В покое всё дышит и покачивается (манекен, шарф, флажки, мишени).
// Как подключать: g ставится на место врага (по умолчанию ENEMY_X, Z0 из attacks.ts); сцена — арена; vfx (искры, всплески) и sfx — по желанию.
// Ничего не рисует сама: update(dt, t) зовёт арена в своём кадре. km < 1 («уменьшить движение»): без частиц, без тряски и рывков, только мягкие покачивания.
// Бюджет: не больше +40 вызовов отрисовки на самой полной сцене (drawCalls()), частиц ≤ 80 (один пул-InstancedMesh), всё освобождается в dispose().
import * as THREE from 'three';
import { Kit } from './assets';
import { ENEMY_X, HERO_X, Z0 } from './attacks';
import type { Vfx } from './vfx';
import type { Sfx } from '../lib/audio';
import { buildBoardFrame, buildDecor, buildDummy, buildFlag, buildFloor, buildTarget, canvas, COL, FLAG, outlineOf, glue, rng, PIVOT, TARGET_Y, TAU, BOARD } from './training_models';

export type HitKind = 'light' | 'strong' | 'combo';
export interface TrainingOpts {
  quality: 'high' | 'low'; km: number;
  /** Эффекты боя (искры, пыль, салют): с ними удар «сочнее»; без них работают собственные звёздочки, солома и конфетти. */
  vfx?: Vfx;
  /** Звук момента (имена из lib/audio). */
  sfx?: (n: Sfx) => void;
  /** Где сейчас герой (мир): куда бросается манекен в bonk. По умолчанию (HERO_X, 0, Z0). */
  hero?: () => THREE.Vector3 | null;
  /** Шлепок долетел до героя (мировая точка у его головы): арена может качнуть героя. */
  onSlap?: (at: THREE.Vector3) => void;
}

// ---------- мелочи ----------
const clamp = THREE.MathUtils.clamp, lerp = THREE.MathUtils.lerp;
const c01 = (u: number) => clamp(u, 0, 1);
const easeOut = (u: number) => 1 - Math.pow(1 - c01(u), 3);
const easeIn = (u: number) => c01(u) * c01(u);
const easeIO = (u: number) => { u = c01(u); return u * u * (3 - 2 * u); };
const easeBack = (u: number) => { u = c01(u); return 1 + 2.4 * Math.pow(u - 1, 3) + 1.4 * Math.pow(u - 1, 2); };
/** Пружинка: 0 → 1 с перелётом и затухающими качаниями (появление). */
const elastic = (u: number) => { u = c01(u); return u >= 1 ? 1 : 1 - Math.exp(-5.8 * u) * Math.cos(11 * u); };
const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const V = new THREE.Vector3();

/** Пружина x'' = −k·x − c·v (шаги по 8 мс: устойчива при любом кадре). kick — толчок скорости. */
class Spring {
  x = 0; v = 0;
  constructor(readonly k: number, readonly c: number) {}
  kick(v: number) { this.v += v; }
  step(dt: number) { const n = Math.max(1, Math.ceil(dt / 0.008)), h = dt / n; for (let i = 0; i < n; i++) { this.v += (-this.k * this.x - this.c * this.v) * h; this.x += this.v * h; } }
  reset() { this.x = this.v = 0; }
}

// ---------- пул частиц: солома, щепки, конфетти, блёстки — один InstancedMesh на всё (≤ 80 штук) ----------
const BITS = 80;
class Bits {
  readonly mesh: THREE.InstancedMesh; readonly geo = new THREE.BoxGeometry(1, 1, 1); readonly mat = new THREE.MeshBasicMaterial();
  live = 0;
  private a = new Float32Array(BITS * 22);   // x y z | vx vy vz | rx ry rz | wx wy wz | sx sy sz | age life g flutter bounce | phase
  private free: number[] = []; private m = new THREE.Matrix4(); private q = new THREE.Quaternion(); private e = new THREE.Euler(); private p = new THREE.Vector3(); private s = new THREE.Vector3(); private col = new THREE.Color();
  constructor() {
    this.mesh = new THREE.InstancedMesh(this.geo, this.mat, BITS); this.mesh.frustumCulled = false; this.mesh.renderOrder = 4; this.mesh.visible = false;
    this.mesh.setColorAt(0, this.col.set(0xffffff));
    for (let i = BITS - 1; i >= 0; i--) { this.free.push(i); this.mesh.setMatrixAt(i, this.m.makeScale(0, 0, 0)); }
    this.mesh.count = BITS;
  }
  /** Одна частица: положение, скорость, цвет, размеры (длина/толщина/ширина), жизнь; g — гравитация, flutter — «порхание» (конфетти), bounce — отскок от земли. */
  emit(x: number, y: number, z: number, vx: number, vy: number, vz: number, color: number, sx: number, sy: number, sz: number, life: number, o: { g?: number; flutter?: number; bounce?: number; spin?: number } = {}) {
    const i = this.free.pop(); if (i === undefined) return;
    const a = this.a, b = i * 22, sp = o.spin ?? 9;
    a[b] = x; a[b + 1] = y; a[b + 2] = z; a[b + 3] = vx; a[b + 4] = vy; a[b + 5] = vz;
    a[b + 6] = rnd(0, TAU); a[b + 7] = rnd(0, TAU); a[b + 8] = rnd(0, TAU); a[b + 9] = rnd(-sp, sp); a[b + 10] = rnd(-sp, sp); a[b + 11] = rnd(-sp, sp);
    a[b + 12] = sx; a[b + 13] = sy; a[b + 14] = sz; a[b + 15] = 0; a[b + 16] = life; a[b + 17] = o.g ?? 9; a[b + 18] = o.flutter ?? 0; a[b + 19] = o.bounce ?? 0.3; a[b + 20] = rnd(0, TAU);
    this.mesh.setColorAt(i, this.col.set(color)); this.mesh.instanceColor!.needsUpdate = true;
    this.live++; this.mesh.visible = true;
  }
  update(dt: number) {
    if (!this.live) return;
    const a = this.a;
    for (let i = 0; i < BITS; i++) {
      const b = i * 22; if (a[b + 16] <= 0) continue;
      const age = (a[b + 15] += dt), life = a[b + 16];
      if (age >= life) { a[b + 16] = 0; this.free.push(i); this.live--; this.mesh.setMatrixAt(i, this.m.makeScale(0, 0, 0)); continue; }
      if (a[b + 18] > 0) {   // конфетти: качается из стороны в сторону и падает медленно
        const f = a[b + 18]; a[b + 3] = Math.sin(age * 4 + a[b + 20]) * f; a[b + 5] = Math.cos(age * 3.3 + a[b + 20]) * f * 0.6; a[b + 4] = Math.max(a[b + 4] - a[b + 17] * dt, -1.1);
      } else a[b + 4] -= a[b + 17] * dt;
      a[b] += a[b + 3] * dt; a[b + 1] += a[b + 4] * dt; a[b + 2] += a[b + 5] * dt;
      const floor = 0.05;
      if (a[b + 1] < floor && a[b + 18] === 0) {   // упало: отскок, потом лежит (вращение гаснет)
        a[b + 1] = floor; a[b + 4] = Math.abs(a[b + 4]) > 0.8 ? -a[b + 4] * a[b + 19] : 0; a[b + 3] *= 0.6; a[b + 5] *= 0.6; a[b + 9] *= 0.5; a[b + 10] *= 0.5; a[b + 11] *= 0.5;
      } else if (a[b + 1] < floor) { a[b + 1] = floor; a[b + 3] = a[b + 5] = 0; }
      a[b + 6] += a[b + 9] * dt; a[b + 7] += a[b + 10] * dt; a[b + 8] += a[b + 11] * dt;
      const k = age > life - 0.35 ? (life - age) / 0.35 : 1;   // в конце жизни сжимается
      this.mesh.setMatrixAt(i, this.m.compose(this.p.set(a[b], a[b + 1], a[b + 2]), this.q.setFromEuler(this.e.set(a[b + 6], a[b + 7], a[b + 8])), this.s.set(a[b + 12] * k, a[b + 13] * k, a[b + 14] * k)));
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    if (!this.live) this.mesh.visible = false;
  }
  clear() { const a = this.a; this.free.length = 0; for (let i = BITS - 1; i >= 0; i--) { a[i * 22 + 16] = 0; this.free.push(i); this.mesh.setMatrixAt(i, this.m.makeScale(0, 0, 0)); } this.live = 0; this.mesh.visible = false; this.mesh.instanceMatrix.needsUpdate = true; }
  dispose() { this.geo.dispose(); this.mat.dispose(); this.mesh.dispose(); }
}

// ---------- раскладка площадки (в системе g: начало под манекеном, лицо к камере/герою) ----------
/** Где стоят мишени: слева-сзади от манекена, дальше — выше по ряду. Пять мест. */
const SLOTS: [number, number][] = [[-2.3, -1.15], [-1.25, -2.05], [-3.2, -2.3], [-0.2, -2.9], [-2.2, -3.4]];
const TARGET_YAW = -0.38, TARGET_S = 0.82;
const DUMMY_YAW = -0.52;
/** Стойка, доска, флажки: места в системе g. */
const BOARD_AT = new THREE.Vector3(2.0, 0, -2.2), RACK_AT = new THREE.Vector3(1.7, 0, 1.15);
const FLAGS = [{ x: -3.4, z: -0.6, h: 2.1, c0: COL.cyan, c1: 0xb6f6ff }, { x: 1.4, z: -3.7, h: 3.0, c0: COL.pink, c1: 0xffb2e0 }];
const HIT_AT = new THREE.Vector3(-0.24, 1.2, 0.3);   // где по манекену попадает герой: грудь, сторона к герою

interface Tw { age: number; dur: number; fn: (u: number) => void; done: () => void; tag?: string }
interface Star { m: THREE.Mesh; mat: THREE.MeshBasicMaterial; age: number; life: number; s: number; spin: number; orb: { c: THREE.Vector3; r: number; ph: number; w: number } | null }

export function createTraining(scene: THREE.Scene, o: TrainingOpts) {
  const high = o.quality === 'high', km = clamp(o.km, 0, 1), calm = km < 1, A = calm ? 0.35 : 1, vfx = o.vfx, sfx = (n: Sfx) => o.sfx?.(n);
  const own: { dispose(): void }[] = [];
  const keep = <T extends { dispose(): void }>(x: T): T => { own.push(x); return x; };
  let dead = false;

  // ---------- общий вид: три ступени света и тёмный контур (свои экземпляры, чтобы всё освободить) ----------
  const grad = keep(new THREE.DataTexture(new Uint8Array([90, 170, 255]), 3, 1, THREE.RedFormat)); grad.minFilter = grad.magFilter = THREE.NearestFilter; grad.needsUpdate = true;
  const paint = keep(new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: grad }));
  const dummyMat = keep(new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: grad, emissive: 0x000000 }));
  const flagMat = keep(new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: grad, side: THREE.DoubleSide }));
  const outlineMat = keep(new THREE.MeshBasicMaterial({ color: 0x0a0b1e, side: THREE.BackSide }));
  outlineMat.onBeforeCompile = sh => { sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n transformed += normalize(normal) * 0.024;'); };
  /** Деталь: меш + (high) контур-двойник + тень. */
  function solid(geo: THREE.BufferGeometry, mat: THREE.Material, opt: { outline?: boolean; shadow?: boolean } = {}): THREE.Mesh {
    keep(geo); const m = new THREE.Mesh(geo, mat); m.castShadow = high && (opt.shadow ?? true); m.receiveShadow = high;
    if (high && (opt.outline ?? true)) { const og = keep(outlineOf(geo)), ol = new THREE.Mesh(og, outlineMat); ol.userData.outline = true; m.add(ol); }
    return m;
  }

  // ---------- каркас ----------
  const g = new THREE.Group(); g.name = 'training'; g.position.set(ENEMY_X, 0, Z0); g.visible = false; scene.add(g);
  const floorG = new THREE.Group(); g.add(floorG);
  const floor = solid(buildFloor(), paint, { outline: false, shadow: false }); floorG.add(floor);
  const decor = solid(buildDecor(rng(3), FLAGS), paint, { shadow: false }); floorG.add(decor);

  // манекен: dummy (переезд, прыжки) → swing (качание на подставке) → yaw (разворот лицом к камере/герою) → детали
  const D = buildDummy();
  const dummy = new THREE.Group(); g.add(dummy);
  const base = solid(D.base, paint); dummy.add(base);
  const swing = new THREE.Group(); swing.position.y = PIVOT.base; dummy.add(swing);
  const yaw = new THREE.Group(); yaw.position.y = -PIVOT.base; yaw.rotation.y = DUMMY_YAW; swing.add(yaw);
  const torso = solid(D.torso, dummyMat), head = solid(D.head, dummyMat), armL = solid(D.armL, dummyMat, { shadow: false }), armR = solid(D.armR, dummyMat, { shadow: false }), tail = solid(D.tail, dummyMat, { outline: false, shadow: false });
  head.receiveShadow = false; head.position.y = PIVOT.neckY; armL.position.set(-PIVOT.shoulderX, PIVOT.shoulderY, 0); armR.position.set(PIVOT.shoulderX, PIVOT.shoulderY, 0); tail.position.set(...PIVOT.tail);
  yaw.add(torso, head, armL, armR, tail);
  for (const [n, x] of Object.entries({ dummy, swing, yaw, torso, head, armL, armR, tail })) x.name = n;
  // «глитч»: экран на груди и розовые трещины (видны только пока манекен «заражён»)
  const scrCv = canvas(160, 112), scrCtx = scrCv?.getContext('2d') ?? null;
  const scrTex = keep(scrCv ? new THREE.CanvasTexture(scrCv) : new THREE.DataTexture(new Uint8Array([40, 10, 60, 255]), 1, 1)); scrTex.colorSpace = THREE.SRGBColorSpace; scrTex.needsUpdate = true;
  const screen = new THREE.Mesh(keep(new THREE.PlaneGeometry(0.5, 0.35)), keep(new THREE.MeshBasicMaterial({ map: scrTex, transparent: true, toneMapped: false })));
  screen.position.set(0, 1.16, 0.53); screen.visible = false; screen.renderOrder = 5; yaw.add(screen);
  const cracks = new THREE.Mesh(keep(D.cracks), keep(new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }))); cracks.visible = false; cracks.renderOrder = 5; yaw.add(cracks);
  // доски: то, на что манекен рассыпается (8 штук, один InstancedMesh)
  const PLANKS = 8;
  const planks = new THREE.InstancedMesh(keep(D.plank), paint, PLANKS); planks.frustumCulled = false; planks.visible = false; planks.castShadow = high; planks.name = 'planks'; g.add(planks);
  const planksOl = high ? new THREE.InstancedMesh(keep(outlineOf(D.plank)), outlineMat, PLANKS) : null;
  if (planksOl) { planksOl.instanceMatrix = planks.instanceMatrix; planksOl.frustumCulled = false; planksOl.visible = false; planksOl.userData.outline = true; g.add(planksOl); }

  // мишени: пять мест, один InstancedMesh (с контуром и тенью — три вызова на все)
  const NT = SLOTS.length;
  const tgGeo = keep(buildTarget());
  const targetsM = new THREE.InstancedMesh(tgGeo, paint, NT); targetsM.frustumCulled = false; targetsM.castShadow = high; targetsM.receiveShadow = high; targetsM.visible = false; g.add(targetsM);
  targetsM.setColorAt(0, new THREE.Color(1, 1, 1));
  const targetsOl = high ? new THREE.InstancedMesh(keep(outlineOf(tgGeo)), outlineMat, NT) : null;
  if (targetsOl) { targetsOl.instanceMatrix = targetsM.instanceMatrix; targetsOl.frustumCulled = false; targetsOl.visible = false; targetsOl.userData.outline = true; g.add(targetsOl); }
  interface Tg { h: number; st: 'down' | 'up' | 'hit'; spin: number; fall: number; flash: number; wob: Spring; wobX: Spring }
  const tg: Tg[] = SLOTS.map(() => ({ h: 0, st: 'down', spin: 0, fall: 0, flash: 0, wob: new Spring(42, 1.6), wobX: new Spring(46, 1.8) }));

  // доска тактики: рама + «грифельная» плоскость с мелом (текстура из холста) + мягкое свечение позади
  const boardG = new THREE.Group(); boardG.position.copy(BOARD_AT); boardG.rotation.y = -0.34; g.add(boardG);
  const frame = solid(buildBoardFrame(), paint); boardG.add(frame);
  const bCv = canvas(512, 328), bCtx = bCv?.getContext('2d') ?? null;
  const bTex = keep(bCv ? new THREE.CanvasTexture(bCv) : new THREE.DataTexture(new Uint8Array([30, 40, 90, 255]), 1, 1)); bTex.colorSpace = THREE.SRGBColorSpace; bTex.anisotropy = 4; bTex.needsUpdate = true;
  const slate = new THREE.Mesh(keep(new THREE.PlaneGeometry(BOARD.w - 0.1, BOARD.h - 0.08)), keep(new THREE.MeshBasicMaterial({ map: bTex, toneMapped: false })));
  slate.position.set(0, BOARD.y, BOARD.z); boardG.add(slate);
  const gCv = canvas(64, 64);
  if (gCv) { const x = gCv.getContext('2d')!, gr = x.createRadialGradient(32, 32, 4, 32, 32, 32); gr.addColorStop(0, 'rgba(120,240,255,1)'); gr.addColorStop(0.5, 'rgba(53,230,255,0.45)'); gr.addColorStop(1, 'rgba(53,230,255,0)'); x.fillStyle = gr; x.fillRect(0, 0, 64, 64); }
  const glowTex = keep(gCv ? new THREE.CanvasTexture(gCv) : new THREE.DataTexture(new Uint8Array([53, 230, 255, 255]), 1, 1)); glowTex.colorSpace = THREE.SRGBColorSpace; glowTex.needsUpdate = true;
  const glowMat = keep(new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false }));
  const glow = new THREE.Mesh(keep(new THREE.PlaneGeometry(BOARD.w + 1.5, BOARD.h + 1.2)), glowMat); glow.name = 'boardGlow'; glow.position.set(0, BOARD.y, -0.05); glow.visible = false; glow.renderOrder = 3; boardG.add(glow);

  // флажки: шесты (в общий декор не идут — стоят в разных местах) и полотнища с волной по вершинам
  const flags = FLAGS.map(({ x, z, h, c0, c1 }, i) => {
    const grp = new THREE.Group(); grp.position.set(x, h - 0.32, z); g.add(grp);
    const { geo, base: b0 } = buildFlag(c0, c1); keep(geo);
    const cloth = new THREE.Mesh(geo, flagMat); cloth.position.set(0.04, 0, 0); grp.add(cloth);
    return { grp, cloth, base: b0, ph: i * 1.7 };
  });

  // оружейная стойка из набора arena (Kenney Mini Arena, CC0): грузится сама, без неё площадка полная
  const rackG = new THREE.Group(); rackG.position.copy(RACK_AT); rackG.rotation.y = -0.6; g.add(rackG);
  Kit.load('arena').then(k => {
    if (dead) return;
    const put = (name: string, h: number, x: number, z: number, ry: number, tilt = 0, shadows = true) => { const m = k.get(name, { height: h, ground: true, outline: high ? 0.012 : 0, shadows: high && shadows }); m.position.set(x, 0, z); m.rotation.set(0, ry, tilt); rackG.add(m); return m; };
    put('weapon-rack', 0.95, 0, 0, 0);
    put('weapon-spear', 1.75, -0.18, -0.28, 0.2, 0.16, false);
  }).catch(() => {});

  // ---------- частицы, звёздочки, вспышки ----------
  const bits = keep(new Bits()); g.add(bits.mesh);
  const starGeo = keep(glue([
    { g: new THREE.ShapeGeometry(starShape(1.0, 0.5)), c: 0x0a0b1e, p: [0, 0, -0.01], s: [1.18, 1.18, 1] }, { g: new THREE.ShapeGeometry(starShape(1.0, 0.5)), c: 0xffffff },
  ]));
  const stars: Star[] = Array.from({ length: 4 }, () => {
    const mat = keep(new THREE.MeshBasicMaterial({ vertexColors: true, color: COL.gold, side: THREE.DoubleSide, depthWrite: false, toneMapped: false, fog: false })), m = new THREE.Mesh(starGeo, mat);
    m.visible = false; m.renderOrder = 9; g.add(m); return { m, mat, age: 0, life: 1, s: 1, spin: 0, orb: null };
  });
  const flashMat = keep(new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false, side: THREE.DoubleSide }));
  const flashM = new THREE.Mesh(keep(new THREE.RingGeometry(0.72, 1, 32)), flashMat); flashM.visible = false; flashM.renderOrder = 8; g.add(flashM);
  const flashSt = { age: 1, life: 1, s: 1 };
  /** Звёздочка: вырастает с пружинкой и гаснет. В покое движения (km<1) не вращается. */
  function popStar(p: THREE.Vector3, color: number, size: number, life = 0.42, orb: Star['orb'] = null) {
    let s = stars.find(x => !x.m.visible) ?? stars.reduce((a, b) => (a.age / a.life > b.age / b.life ? a : b));
    s.m.visible = true; s.mat.color.set(color); s.age = 0; s.life = life; s.s = size; s.spin = calm ? 0 : rnd(-2.5, 2.5); s.orb = orb; s.m.position.copy(p); s.m.rotation.z = calm ? 0 : rnd(-0.4, 0.4);
  }
  function popFlash(p: THREE.Vector3, color: number, size: number, life = 0.4) { flashM.visible = true; flashMat.color.set(color); flashSt.age = 0; flashSt.life = life; flashSt.s = size; flashM.position.copy(p); }

  // ---------- состояние ----------
  const lean = new Spring(58, 3.1), leanZ = new Spring(64, 3.4), twist = new Spring(66, 3.4), headS = new Spring(88, 3.4), flail = new Spring(52, 2.5), sq = new Spring(120, 6);
  const pose = { lean: 0, armL: 0, slide: 0, hop: 0, sq: 0, yaw: 0, y: 0 };      // управляемая поза (bonk, cheer): складывается с пружинами
  const show_ = { u: 0, dir: 1 };                                                    // 0..1 общий ход появления
  let glitchOn = 0, glitchWant = 0, flash = 0, breaking = false, okT = 0, screenT = 0, cheerT = 0, bGlow = 0, bGlowWant = 0, bProg = 1, bText = '', clock = 0;
  let shown = false;
  const tws: Tw[] = [];
  function tween(dur: number, fn: (u: number) => void, opt: { tag?: string; delay?: number } = {}): Promise<void> {
    if (opt.tag) for (let i = tws.length - 1; i >= 0; i--) if (tws[i].tag === opt.tag) { tws[i].done(); tws.splice(i, 1); }
    return new Promise<void>(res => tws.push({ age: -(opt.delay ?? 0), dur: Math.max(dur, 1e-4), fn, done: res, tag: opt.tag }));
  }
  const at = (sec: number, fn: () => void) => { tween(sec, u => { if (u >= 1) fn(); }); };
  const wait = (sec: number) => tween(sec, () => {});
  /** Мировая точка → система g (g не вращается и не масштабируется). */
  const local = (w: THREE.Vector3, out = new THREE.Vector3()) => out.copy(w).sub(g.position);
  const heroWorld = () => o.hero?.() ?? new THREE.Vector3(HERO_X, 0, Z0);
  const hitPoint = (out = new THREE.Vector3()) => out.set(HIT_AT.x + dummy.position.x, HIT_AT.y + dummy.position.y, HIT_AT.z + dummy.position.z);

  // ---------- рисование: экран глитча и доска ----------
  function drawScreen(seed: number, ok = false) {
    const c = scrCtx; if (!c) { scrTex.needsUpdate = true; return; }
    const W = 160, H = 112, r = rng(seed);
    c.fillStyle = ok ? '#0c2a2c' : '#1b0a30'; c.fillRect(0, 0, W, H);
    c.strokeStyle = ok ? '#5ce39c' : '#ff4fb8'; c.lineWidth = 6; c.strokeRect(3, 3, W - 6, H - 6);
    c.textAlign = 'center'; c.textBaseline = 'middle';
    if (ok) { c.fillStyle = '#5ce39c'; c.font = '900 64px system-ui, sans-serif'; c.fillText('OK', W / 2, H / 2 + 2); }
    else {
      c.fillStyle = '#ff4fb8'; c.font = '900 34px system-ui, sans-serif'; c.fillText('ERROR', W / 2 + (r() - 0.5) * 4, 44);
      c.fillStyle = '#35e6ff'; c.font = '800 16px system-ui, sans-serif'; c.fillText('0x00 ??', W / 2, 78);
      for (let i = 0; i < 6; i++) { c.fillStyle = [ '#ff4fb8', '#35e6ff', '#a77bff' ][i % 3]; c.globalAlpha = 0.65; c.fillRect(r() * W, r() * H, 14 + r() * 40, 4 + r() * 6); c.globalAlpha = 1; }
    }
    scrTex.needsUpdate = true;
  }
  function fitLines(c: CanvasRenderingContext2D, text: string, w: number): { lines: string[]; fs: number } {
    for (let fs = 66; fs >= 26; fs -= 4) {
      c.font = `800 ${fs}px Nunito, Rubik, system-ui, sans-serif`;
      const words = text.split(/\s+/), lines: string[] = []; let cur = '';
      for (const wd of words) { const t = cur ? cur + ' ' + wd : wd; if (c.measureText(t).width > w && cur) { lines.push(cur); cur = wd; } else cur = t; }
      lines.push(cur);
      if (lines.length <= 3 && lines.every(l => c.measureText(l).width <= w)) return { lines, fs };
    }
    return { lines: [text], fs: 26 };
  }
  /** Доска: грифель, мелованная рамка, заголовок приёма (проявляется слева направо), подчёркивание. prog 0..1 — сколько уже «написано». */
  function drawBoard(text: string, prog: number) {
    const c = bCtx; if (!c) { bTex.needsUpdate = true; return; }
    const W = 512, H = 328, gr = c.createLinearGradient(0, 0, W, H); gr.addColorStop(0, '#20305a'); gr.addColorStop(1, '#171f45');
    c.fillStyle = gr; c.fillRect(0, 0, W, H);
    c.strokeStyle = 'rgba(246,236,216,0.35)'; c.lineWidth = 5; c.setLineDash([26, 14]); c.strokeRect(14, 14, W - 28, H - 28); c.setLineDash([]);
    c.save(); c.beginPath(); c.rect(0, 0, W * prog + 4, H); c.clip();
    c.textAlign = 'center'; c.textBaseline = 'middle';
    if (text) {
      const { lines, fs } = fitLines(c, text, W - 90), lh = fs * 1.12, y0 = H / 2 - (lines.length - 1) * lh / 2 - 8;
      c.font = `800 ${fs}px Nunito, Rubik, system-ui, sans-serif`; c.fillStyle = '#f6ecd8';
      lines.forEach((l, i) => c.fillText(l, W / 2, y0 + i * lh));
      const uy = y0 + (lines.length - 1) * lh + fs * 0.62; c.strokeStyle = '#35e6ff'; c.lineWidth = 7; c.lineCap = 'round'; c.beginPath(); c.moveTo(70, uy); c.bezierCurveTo(160, uy + 10, 340, uy - 10, W - 70, uy + 2); c.stroke();
      c.fillStyle = '#ffcb2e'; c.beginPath(); c.arc(W - 52, 52, 10, 0, TAU); c.fill();
    } else {   // пустая доска: набросок стрелки и кружка — «здесь будет приём»
      c.strokeStyle = 'rgba(246,236,216,0.5)'; c.lineWidth = 6; c.lineCap = 'round'; c.beginPath(); c.arc(150, H / 2, 46, 0, TAU); c.moveTo(210, H / 2); c.lineTo(340, H / 2); c.lineTo(310, H / 2 - 24); c.moveTo(340, H / 2); c.lineTo(310, H / 2 + 24); c.stroke();
    }
    c.restore();
    bTex.needsUpdate = true;
  }
  drawBoard('', 1);

  // ---------- появление / исчезновение ----------
  function updateShow() {
    const u = show_.u, up = show_.dir > 0, sh = (l: number) => (up ? elastic(l) : easeIn(l));
    const win = (a: number, b: number) => c01((u - a) / (b - a));
    const s = Math.max(up ? easeBack(win(0, 0.3)) : easeIn(win(0, 0.3)), 0.0001);
    floorG.scale.set(s, 1, s);
    const gs = sh(win(0.12, 0.72)); growV = gs;
    boardG.position.y = -2.3 * (1 - (up ? easeBack(win(0.28, 0.66)) : easeIn(win(0.05, 0.5)))); boardG.visible = win(0.28, 0.66) > 0 || (!up && u > 0);
    const rk = up ? easeBack(win(0.4, 0.75)) : easeIn(win(0.05, 0.4)); rackG.scale.setScalar(Math.max(rk, 0.0001));
    flagK = up ? easeBack(win(0.32, 0.7)) : easeIn(win(0.08, 0.5));
  }
  let growV = 0, flagK = 0;

  function show(on: boolean): Promise<void> {
    if (dead) return Promise.resolve();
    if (on === shown && ((on && show_.u >= 1) || (!on && show_.u <= 0))) return Promise.resolve();
    shown = on; show_.dir = on ? 1 : -1;
    if (on) { g.visible = true; sfx('land'); }
    const from = show_.u, to = on ? 1 : 0, dur = (on ? 1.15 : 0.55) * Math.max(0.35, Math.abs(to - from)) * (calm ? 0.8 : 1);
    if (on) {
      if (!calm) { at(0.22, () => { dust(V.set(0, 0, 0.1), 0.9); }); at(0.5, () => dust(V.set(0, 0, 0.1), 0.55)); }
      // мишени выезжают по одной вместе с площадкой
      at(0.55, () => { for (let i = 0; i < 2; i++) if (want <= i) want = i + 1; popTargets(); });
    } else { want = 0; retractAll(); }
    return tween(dur, u => { show_.u = lerp(from, to, u); updateShow(); }, { tag: 'show' }).then(() => { if (!dead && !shown) { g.visible = false; } });
  }

  // ---------- мишени ----------
  let want = 0;
  function popTarget(i: number, delay: number) {
    const t = tg[i]; if (t.st === 'up' && t.h > 0.98) return;
    t.st = 'up'; t.fall = 0; t.spin = 0; t.flash = 0; const h0 = t.h;
    tween(0.6, u => { t.h = lerp(h0, 1, elastic(u)); }, { tag: 'tg' + i, delay }).then(() => { if (!dead && t.st === 'up') t.h = 1; });
    if (!calm) at(delay + 0.18, () => { V.set(SLOTS[i][0], 0.1, SLOTS[i][1] + 0.2); dust(V, 0.55); });
    if (!calm) t.wob.kick(rnd(2, 4) * (i % 2 ? 1 : -1));
  }
  function popTargets() { let k = 0; for (let i = 0; i < NT; i++) if (i < want) { if (tg[i].st === 'down') popTarget(i, k++ * 0.26); } }
  function retractTarget(i: number, delay = 0) {
    const t = tg[i]; if (t.st === 'down' && t.h <= 0) return; const h0 = t.h; t.st = 'down';
    tween(0.35, u => { t.h = h0 * (1 - easeIn(u)); }, { tag: 'tg' + i, delay }).then(() => { if (!dead && t.st === 'down') t.h = 0; });
  }
  function retractAll() { for (let i = 0; i < NT; i++) retractTarget(i, i * 0.06); }
  /** Стрельбище: n мишеней (0..5) выскакивают по одной, лишние уезжают в землю. */
  function targets(n: number) {
    if (dead) return; want = clamp(Math.round(n), 0, NT);
    if (!shown) return;
    let k = 0;
    for (let i = 0; i < NT; i++) { if (i < want) { if (tg[i].st === 'down') popTarget(i, k++ * 0.26); } else retractTarget(i, (i - want) * 0.06); }
  }
  /** Попадание: мишень крутится, щепки, звёздочка, падает и уезжает в землю. i — номер (по умолчанию первая стоящая). */
  function targetHit(i?: number): Promise<void> {
    if (dead) return Promise.resolve();
    const k = i ?? tg.findIndex(t => t.st === 'up' && t.h > 0.5); const t = tg[k];
    if (!t || t.st !== 'up') return Promise.resolve();
    t.st = 'hit'; sfx('hit');
    const cx = SLOTS[k][0], cz = SLOTS[k][1], face = new THREE.Vector3(cx + 0.05, TARGET_Y * TARGET_S, cz + 0.3);
    if (!calm) for (let j = 0; j < 8; j++) bits.emit(face.x, face.y, face.z, rnd(-2.6, 2.6), rnd(1.5, 4.2), rnd(0.5, 3), j % 3 ? COL.woodL : COL.cream, rnd(0.12, 0.2), 0.04, 0.05, rnd(0.8, 1.2), { g: 10, bounce: 0.35 });
    popStar(V.copy(face).add(new THREE.Vector3(0, 0, 0.35)), COL.gold, 0.5, 0.4);
    vfx?.hitSpark(V.copy(face).add(g.position), 0xffcb2e, 0.7);
    t.flash = 1;
    return tween(0.95, u => {
      t.spin = TAU * (calm ? 0.25 : 1.5) * easeOut(u / 0.5);
      t.fall = easeIO((u - 0.42) / 0.32);
      if (u > 0.74) t.h = 1 - easeIn((u - 0.74) / 0.26);
      t.flash = Math.max(0, 1 - u * 3);
    }).then(() => { if (!dead) { t.st = 'down'; t.h = 0; t.fall = 0; t.spin = 0; } });
  }
  /** Промах: стоящие мишени вздрагивают, из-под ближней — облачко пыли. */
  function targetMiss() {
    if (dead) return;
    tg.forEach((t, i) => { if (t.st === 'up') { t.wob.kick((calm ? 1.2 : 5.5) * (i % 2 ? 1 : -1)); t.wobX.kick(calm ? 0 : 2.4); } });
    const k = tg.findIndex(t => t.st === 'up'); if (k >= 0 && !calm) { V.set(SLOTS[k][0], 0.05, SLOTS[k][1] + 0.3); dust(V, 0.6); }
  }

  // ---------- пыль, солома ----------
  /** Облачко пыли у земли. В vfx есть свой красивее; без него — песчаные крошки. */
  function dust(p: THREE.Vector3, k = 1) {
    if (calm) return;
    if (vfx) { vfx.dust(V.copy(p).add(g.position).setY(0), k, 0xe6cf98); return; }
    const n = Math.round(6 * k); for (let i = 0; i < n; i++) { const a = (i / n) * TAU; bits.emit(p.x, 0.08, p.z, Math.cos(a) * 1.6 * k, rnd(0.6, 1.4), Math.sin(a) * 1.0 * k, COL.sand, 0.1, 0.07, 0.09, rnd(0.4, 0.7), { g: 6, bounce: 0.1, spin: 4 }); }
  }
  const STRAW = [COL.straw, COL.strawD, COL.strawL];
  function straw(n: number, power: number) {
    if (calm) return;
    hitPoint(V); const p = V.clone();
    for (let i = 0; i < n; i++) bits.emit(p.x + rnd(-0.15, 0.15), p.y + rnd(-0.25, 0.25), p.z + rnd(-0.1, 0.1), rnd(0.8, 3.6) * power + 0.6, rnd(1.3, 4.2) * Math.sqrt(power) + 0.6, rnd(-1.8, 1.8), STRAW[i % 3], rnd(0.2, 0.34), 0.035, 0.035, rnd(1.0, 1.6), { g: 9, bounce: 0.25, spin: 10 });
  }

  // ---------- удары ----------
  const HIT_P = { light: 0.5, strong: 1.05, combo: [0.55, 0.85, 1.3] } as const;
  function hit(kind: HitKind, n = 1): Promise<void> {
    if (dead || show_.u < 0.35 || breaking) return Promise.resolve();
    const k = clamp(Math.round(n), 1, 3), P = kind === 'combo' ? HIT_P.combo[k - 1] : HIT_P[kind], big = kind === 'strong' || (kind === 'combo' && k === 3);
    const sgn = k % 2 ? 1 : -1;
    lean.kick(3.1 * P * A); leanZ.kick(sgn * 1.6 * P * A); twist.kick(sgn * 2.6 * P * A); headS.kick(-5.2 * P * A); flail.kick(5.5 * P * A); sq.kick(2.3 * P * A);
    flash = Math.max(flash, 0.5 + 0.4 * P);
    sfx(kind === 'combo' && k === 3 ? 'crit' : 'impact'); if (big) sfx('boom');
    straw(Math.round(4 + 11 * P), P);
    const sp = hitPoint().add(new THREE.Vector3(-0.18, 0.02, 0.6));
    popStar(sp, k === 3 && kind === 'combo' ? COL.cyan : COL.gold, 0.5 + 0.55 * P, 0.4 + 0.1 * P);
    if (vfx) { hitPoint(V).add(g.position).add(new THREE.Vector3(-0.1, 0, 0.5)); if (!(kind === 'combo' && k === 3)) vfx.hitSpark(V, kind === 'combo' ? 0x7ff0ff : 0xffe07a, 0.4 + 0.35 * P); }
    if (big && !calm) dust(V.set(-0.5 + dummy.position.x, 0, 0.3), 1.1);
    if (kind === 'combo' && k === 3) {
      // вспышка связки: кольцо и большая звезда, золотой всплеск, «вздох» манекена
      popFlash(V.copy(sp), COL.cyan, 1.4, 0.45);
      if (!calm) { sq.kick(4); for (let j = 0; j < 5; j++) { const a = (j / 5) * TAU + 0.3; popStar(V.set(sp.x + Math.cos(a) * 0.9, sp.y + Math.sin(a) * 0.7, sp.z), [COL.gold, COL.cyan, COL.pink][j % 3], 0.24, 0.5); } }
      if (vfx) { hitPoint(V).add(g.position).add(new THREE.Vector3(-0.1, 0, 0.5)); vfx.critBurst(V, 0xffcb2e, 0x35e6ff, 0.75); }
    }
    return wait(0.3 + 0.28 * P);
  }

  // ---------- бонк ----------
  /** Неверный прогноз: манекен замахивается назад, прыжками бросается к герою и шлёпает рукой-палкой по макушке — смешно, не больно — и возвращается. */
  async function bonk(): Promise<void> {
    if (dead || show_.u < 0.35 || breaking) return;
    const hero = heroWorld(), tgtX = clamp(Math.min(0, local(hero).x + 2.0), -6.5, 0);
    // замах: откидывается назад, вскидывает руку, приседает
    sfx('growl');
    await tween(calm ? 0.5 : 0.34, u => { pose.lean = 0.4 * A * easeOut(u); pose.armL = -1.55 * (calm ? 0.3 : 1) * easeOut(u); pose.sq = 0.5 * easeIO(u) * A; });
    if (dead) return;
    if (!calm) {
      // два прыжка к герою
      const T = 0.62;
      at(T / 2, () => { dust(V.set(dummy.position.x, 0, dummy.position.z), 0.9); sfx('land'); }); at(T, () => { dust(V.set(dummy.position.x, 0, dummy.position.z), 1.1); sfx('land'); });
      await tween(T, u => { pose.slide = tgtX * easeIO(u); pose.hop = 0.5 * Math.abs(Math.sin(u * TAU / 2 * 2)); pose.lean = lerp(0.4, -0.22, easeIn(u)); pose.sq = 0.5 * (1 - easeOut(u * 4)); });
      if (dead) return;
      pose.hop = 0;
    }
    // шлепок: рука-палка сверху вниз
    let slapped = false;
    await tween(calm ? 0.35 : 0.16, u => {
      pose.armL = lerp(-1.55 * (calm ? 0.3 : 1), 0.95 * (calm ? 0.4 : 1), easeIn(u)); pose.lean = lerp(calm ? 0.4 * A : -0.22, calm ? -0.12 : -0.3, u);
      if (u > 0.6 && !slapped) { slapped = true; slap(hero); }
    });
    if (dead) return;
    // «бум-м»: манекен трясёт, вокруг головы героя кружат звёздочки
    lean.kick(-2.4 * A); headS.kick(3.5 * A); sq.kick(-2 * A); flail.kick(-3 * A);
    await wait(calm ? 0.5 : 0.62); if (dead) return;
    // возвращается: рука вниз, два прыжка назад
    if (!calm) {
      const T = 0.7;
      at(T / 2, () => dust(V.set(dummy.position.x, 0, dummy.position.z), 0.7)); at(T, () => dust(V.set(dummy.position.x, 0, dummy.position.z), 0.9));
      const s0 = pose.slide;
      tween(0.24, u => { pose.armL = lerp(0.95, 0, easeOut(u)); });
      await tween(T, u => { pose.slide = lerp(s0, 0, easeIO(u)); pose.hop = 0.42 * Math.abs(Math.sin(u * TAU)); pose.lean = lerp(-0.3, 0, easeOut(u)); });
      pose.hop = 0;
    } else await tween(0.5, u => { pose.armL = lerp(0.95 * 0.4, 0, easeOut(u)); pose.lean = lerp(-0.12, 0, easeOut(u)); });
    if (dead) return;
    lean.kick(1.6 * A); headS.kick(-2 * A); sq.kick(2 * A); pose.armL = 0; pose.lean = 0; pose.slide = 0; pose.sq = 0;
    await wait(0.25);
  }
  function slap(hero: THREE.Vector3) {
    const head = local(hero).add(new THREE.Vector3(0.05, 2.35, 0.35));
    sfx('impact'); popStar(head.clone(), COL.gold, 0.6, 0.5); popFlash(head.clone(), 0xffffff, 1.3, 0.3);
    if (!calm) for (let i = 0; i < 3; i++) popStar(head, [COL.gold, COL.cyan, COL.pink][i], 0.3, 0.95, { c: head.clone().add(new THREE.Vector3(0, 0.2, 0)), r: 0.55, ph: (i / 3) * TAU, w: 6.5 });
    if (vfx) vfx.hitSpark(V.copy(head).add(g.position), 0xffe07a, 0.8);
    o.onSlap?.(V.copy(head).add(g.position).clone());
  }

  // ---------- «Глитч»: заражение и разбор на доски ----------
  function glitch(on: boolean) { glitchWant = on ? 1 : 0; if (on) { screenT = 0; okT = 0; drawScreen(1); } }
  const PARTS = [torso, armL, armR, head, tail] as const;
  const rest = PARTS.map(m => ({ p: m.position.clone(), r: m.rotation.clone() }));
  const floors = [0, 0.3, 0.3, 0.42, 0.85];            // ниже этой высоты (система yaw) деталь не падает
  interface Body { v: THREE.Vector3; w: THREE.Vector3; rest: boolean }
  const bodies: Body[] = PARTS.map(() => ({ v: new THREE.Vector3(), w: new THREE.Vector3(), rest: true }));
  interface Pl { p: THREE.Vector3; v: THREE.Vector3; r: THREE.Euler; w: THREE.Vector3; s: number }
  const pl: Pl[] = Array.from({ length: PLANKS }, () => ({ p: new THREE.Vector3(), v: new THREE.Vector3(), r: new THREE.Euler(), w: new THREE.Vector3(), s: 0 }));
  const setPlank = () => {
    const M = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3();
    pl.forEach((p, i) => planks.setMatrixAt(i, M.compose(p.p, q.setFromEuler(p.r), s.setScalar(Math.max(p.s, 1e-4)))));
    planks.instanceMatrix.needsUpdate = true;
  };
  /** Нашёл ошибку: экран гаснет, манекен разваливается на доски и части, полежит и собирается обратно (с «ок» на груди). */
  async function breakGlitch(): Promise<void> {
    if (dead || show_.u < 0.35 || breaking) return;
    breaking = true; glitchWant = 1; if (glitchOn < 0.5) glitchOn = 1;
    sfx('boom');
    // белая вспышка-заминка
    flash = 1; await wait(calm ? 0.2 : 0.14); if (dead) return;
    if (calm) {
      // без разлёта: «сжимается», розовое уходит, восстанавливается мягко
      await tween(0.45, u => { pose.sq = 2.4 * easeIO(u); glitchWant = 1 - u; });
      okT = 1; drawScreen(2, true); screen.visible = true; glitchOn = 0; glitchWant = 0;
      await tween(0.6, u => { pose.sq = 2.4 * (1 - easeIO(u)); });
      pose.sq = 0; await wait(0.5); okT = 0; breaking = false; return;
    }
    // взрыв: части летят в стороны, доски разбросаны
    const chest = new THREE.Vector3(0, 1.2, 0.1);
    PARTS.forEach((m, i) => { const b = bodies[i]; b.rest = false; b.v.set(rnd(-2.6, 2.6), rnd(2.4, 5.2), rnd(-1.4, 1.4)); b.w.set(rnd(-5, 5), rnd(-5, 5), rnd(-6, 6)); if (i === 0) b.v.multiplyScalar(0.35); });
    pl.forEach(p => { p.p.copy(chest).add(dummy.position); p.p.y += rnd(-0.2, 0.5); p.v.set(rnd(-3.2, 3.2), rnd(2.6, 6), rnd(-1.6, 2)); p.r.set(rnd(0, TAU), rnd(0, TAU), rnd(0, TAU)); p.w.set(rnd(-8, 8), rnd(-8, 8), rnd(-8, 8)); p.s = 1; });
    planks.visible = true; if (planksOl) planksOl.visible = true; setPlank();
    for (let i = 0; i < 14; i++) bits.emit(chest.x, chest.y, chest.z, rnd(-3.4, 3.4), rnd(1.5, 5), rnd(-2, 2), [COL.pink, COL.cyan, COL.violet, COL.straw][i % 4], rnd(0.1, 0.22), 0.05, 0.05, rnd(0.8, 1.3), { g: 9, bounce: 0.3 });
    popFlash(V.copy(chest).add(new THREE.Vector3(-0.2, 0, 0.6)), COL.pink, 1.7, 0.4); if (vfx) vfx.hitSpark(V.copy(chest).add(g.position), 0xff4fb8, 1);
    glitchWant = 0;
    // падение: 0.95 с симуляции
    await wait(1.0); if (dead) return;
    // собираются обратно: части стартуют по очереди
    okT = 1; drawScreen(2, true); screen.visible = true;
    const from = PARTS.map(m => ({ p: m.position.clone(), q: m.quaternion.clone() })), pf = pl.map(p => ({ p: p.p.clone(), s: p.s })), q0 = new THREE.Quaternion(), q1 = new THREE.Quaternion();
    bodies.forEach(b => (b.rest = true));   // дальше — только интерполяция
    const T = 0.85;
    await tween(T + 0.3, u => {
      const t = u * (T + 0.3);
      PARTS.forEach((m, i) => {
        const l = easeBack(c01((t - i * 0.07) / T)); m.position.lerpVectors(from[i].p, rest[i].p, l);
        m.quaternion.copy(q0.copy(from[i].q).slerp(q1.setFromEuler(rest[i].r), c01(l)));
      });
      pl.forEach((p, i) => { const l = easeIn(c01((t - 0.1 - i * 0.05) / 0.5)); p.p.lerpVectors(pf[i].p, V.set(dummy.position.x, 1.1, 0.1), l); p.s = pf[i].s * (1 - easeIn(l)); p.r.x += 0.3; });
      setPlank();
    });
    if (dead) return;
    planks.visible = false; if (planksOl) planksOl.visible = false;
    PARTS.forEach((m, i) => { m.position.copy(rest[i].p); m.rotation.copy(rest[i].r); });
    // «готово»: пружинка манекена, звёздочка, голубые искры
    sq.kick(4); lean.kick(1.4); headS.kick(-3); flail.kick(5); flash = 0.8; sfx('crit');
    hitPoint(V).add(new THREE.Vector3(-0.1, 0, 0.6)); popStar(V.clone(), COL.cyan, 0.9, 0.55); popFlash(V.clone(), COL.cyan, 1.7, 0.45);
    if (vfx) vfx.hitSpark(V.clone().add(g.position), 0x7ff0ff, 1);
    glitchOn = 0; glitchWant = 0;
    await wait(0.7); okT = 0; breaking = false;
  }
  /** Физика падающих частей (в системе yaw), пока идёт разбор. */
  function stepBodies(dt: number) {
    PARTS.forEach((m, i) => {
      const b = bodies[i]; if (b.rest) return;
      b.v.y -= 11 * dt; m.position.addScaledVector(b.v, dt); m.rotation.x += b.w.x * dt; m.rotation.y += b.w.y * dt; m.rotation.z += b.w.z * dt;
      const fl = floors[i];
      if (m.position.y < fl) { m.position.y = fl; b.v.y = Math.abs(b.v.y) > 1.2 ? -b.v.y * 0.34 : 0; b.v.x *= 0.7; b.v.z *= 0.7; b.w.multiplyScalar(0.55); }
    });
    for (const p of pl) {
      p.v.y -= 11 * dt; p.p.addScaledVector(p.v, dt); p.r.x += p.w.x * dt; p.r.y += p.w.y * dt; p.r.z += p.w.z * dt;
      if (p.p.y < 0.06) { p.p.y = 0.06; p.v.y = Math.abs(p.v.y) > 1.2 ? -p.v.y * 0.35 : 0; p.v.x *= 0.6; p.v.z *= 0.6; p.w.multiplyScalar(0.5); }
    }
    setPlank();
  }

  // ---------- доска и финал ----------
  /** Доска тактики. board('Название приёма') — Бит «пишет» (свечение, мел проявляется слева направо), board('') — стереть, board() — только мягкий всплеск света. */
  function board(text?: string) {
    if (dead) return;
    bGlowWant = 1;
    if (text !== undefined) { bText = text; bProg = calm ? 1 : 0; drawBoard(bText, bProg); }
    if (text === undefined || calm) bProg = 1;
    at(1.9, () => { bGlowWant = bText ? 0.32 : 0; });
    if (text === '') { bGlowWant = 0; }
  }
  /** Финал: конфетти над площадкой, флажки трепещут, манекен подпрыгивает, из-под него салют. */
  function cheer() {
    if (dead || show_.u < 0.35) return;
    cheerT = 2.6; sfx('levelup');
    popStar(V.set(0, 3.05, 0.5), COL.gold, 0.7, 0.6); if (vfx) vfx.sparkleShower(V.set(g.position.x, 3.1, g.position.z + 0.4), [0xffcb2e, 0x35e6ff, 0xff4fb8, 0xffffff], 22);
    if (calm) { headS.kick(-1.2); return; }
    const C = [COL.cyan, COL.pink, COL.gold, COL.violet, 0x5ce39c, COL.cream];
    for (let i = 0; i < 64; i++) bits.emit(rnd(-4.6, 2.4), rnd(3.4, 5.6), rnd(-1.6, 2.4), rnd(-0.3, 0.3), rnd(-0.6, 0.6), 0, C[i % C.length], rnd(0.11, 0.17), 0.018, rnd(0.07, 0.11), rnd(2.2, 3.4), { g: 3, flutter: rnd(0.6, 1.4), spin: 6 });
    // подпрыгивает от радости
    tween(0.9, u => { pose.hop = 0.3 * Math.abs(Math.sin(u * TAU)) * (1 - u * 0.3); pose.yaw = 0.35 * Math.sin(u * TAU * 2) * (1 - u); }).then(() => { pose.hop = 0; pose.yaw = 0; flail.kick(4); });
    at(0.2, () => { flail.kick(6); headS.kick(-3); });
  }

  // ---------- кадр ----------
  const tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpE = new THREE.Euler(0, 0, 0, 'YXZ'), tmpP = new THREE.Vector3(), tmpS = new THREE.Vector3(), tmpC = new THREE.Color();
  function update(dt: number, t: number) {
    if (dead) return;
    dt = Math.min(dt, 0.05); clock += dt;
    // твины
    for (let i = 0; i < tws.length; i++) {
      const w = tws[i]; w.age += dt; if (w.age < 0) continue;
      const u = w.age >= w.dur ? 1 : w.age / w.dur; w.fn(u);
      if (u >= 1) { tws.splice(i, 1); i--; w.done(); if (dead) return; }
    }
    if (!g.visible) return;
    for (const s of [lean, leanZ, twist, headS, flail, sq]) s.step(dt);
    for (const x of tg) { x.wob.step(dt); x.wobX.step(dt); }
    if (breaking && bodies.some(b => !b.rest)) stepBodies(dt);
    bits.update(dt);
    if (cheerT > 0) cheerT -= dt;
    flash = Math.max(0, flash - dt * 3.2);

    // манекен: дыхание, покачивание, пружины и поза
    const breathe = 1 + 0.014 * Math.sin(t * 1.9) * (calm ? 0.7 : 1), idleZ = 0.018 * Math.sin(t * 0.9) * (calm ? 0.8 : 1), idleX = 0.012 * Math.sin(t * 0.7 + 1);
    const sqz = sq.x + pose.sq;
    dummy.position.set(pose.slide, pose.hop * A + pose.y, 0);
    const gs = Math.max(growV, 0.0001), sxz = gs < 1 ? 0.7 + 0.3 * gs : 1 - (gs - 1) * 0.45;
    dummy.scale.set(sxz * (1 + 0.07 * sqz), gs * breathe * (1 - 0.1 * sqz), sxz * (1 + 0.07 * sqz));
    swing.rotation.z = -(lean.x + pose.lean) + idleZ; swing.rotation.x = leanZ.x + idleX;
    yaw.rotation.y = DUMMY_YAW + twist.x + pose.yaw;
    head.rotation.z = headS.x + lean.x * 0.9 + 0.035 * Math.sin(t * 1.3 + 1) * (calm ? 0.6 : 1); head.rotation.x = -leanZ.x * 0.5;
    const armIdle = 0.05 * Math.sin(t * 1.5 + 0.5) * (calm ? 0.6 : 1);
    armL.rotation.z = rest[1].r.z + 0.14 - flail.x * 0.7 + pose.armL + armIdle; armR.rotation.z = rest[2].r.z - 0.14 + flail.x * 0.7 - armIdle;
    tail.rotation.z = 0.5 + 0.22 * Math.sin(t * 3.1) * A + lean.x * 0.9 - 0.3 * flail.x * 0.3; tail.rotation.x = 0.14 * Math.sin(t * 2.3 + 1) * A - leanZ.x * 0.4;
    // глитч: розовое свечение, экран, трещины
    glitchOn += (glitchWant - glitchOn) * (1 - Math.exp(-dt * 6));
    const gl = glitchOn > 0.02;
    const step = Math.floor(t * 10);
    const flick = calm ? 0.8 : 0.65 + 0.35 * (((step * 7919) % 13) / 13);
    screen.visible = gl || okT > 0; cracks.visible = gl;
    if (gl && !calm && step !== screenT) { screenT = step; drawScreen(step); screen.position.x = ((step * 31) % 7 - 3) * 0.006; cracks.visible = ((step * 17) % 5) !== 0; }
    dummyMat.emissive.setRGB(0.34 * glitchOn * flick + 0.9 * flash, 0.03 * glitchOn + 0.6 * flash, 0.22 * glitchOn * flick + 0.05 * flash);

    // мишени
    for (let i = 0; i < NT; i++) {
      const x = tg[i], vis = x.h > 0.005;
      const wob = x.wob.x + (calm ? 0.018 : 0.03) * Math.sin(t * 1.5 + i * 1.3) * (x.st === 'up' ? 1 : 0);
      tmpE.set(-1.45 * x.fall + x.wobX.x * 0.3, TARGET_YAW + x.spin, wob);
      tmpM.compose(tmpP.set(SLOTS[i][0], (x.h - 1) * 1.75 - 0.03 * x.fall, SLOTS[i][1]), tmpQ.setFromEuler(tmpE), tmpS.setScalar(vis ? TARGET_S : 1e-4));
      targetsM.setMatrixAt(i, tmpM);
      tmpC.setRGB(1 + x.flash * 1.2, 1 + x.flash * 0.9, 1 + x.flash * 0.1); targetsM.setColorAt(i, tmpC);
    }
    targetsM.instanceMatrix.needsUpdate = true; if (targetsM.instanceColor) targetsM.instanceColor.needsUpdate = true;
    const anyT = tg.some(x => x.h > 0.005); targetsM.visible = anyT; if (targetsOl) targetsOl.visible = anyT;

    // флажки: волна по полотнищу, порывы при cheer
    const boost = 1 + (cheerT > 0 ? 1.2 * c01(cheerT) : 0);
    for (const f of flags) {
      const pos = f.cloth.geometry.attributes.position as THREE.BufferAttribute, b = f.base, amp = (calm ? 0.4 : 1) * boost, k = 5.2 + boost * 1.4;
      for (let i = 0; i < pos.count; i++) {
        const x = b[i * 3] / FLAG.w, w = Math.sin(x * 6.5 - t * k + f.ph) * (0.02 + 0.13 * x) * amp;
        pos.setZ(i, w); pos.setY(i, b[i * 3 + 1] + Math.sin(x * 4 - t * k * 0.8 + f.ph) * 0.03 * x * amp);
      }
      pos.needsUpdate = true; f.cloth.geometry.computeVertexNormals();
      f.grp.scale.setScalar(Math.max(flagK, 0.0001)); f.grp.visible = flagK > 0.001; f.grp.rotation.y = 0.15 * Math.sin(t * 0.6 + f.ph) * amp * 0.5 + 0.1;
    }

    // доска: мел проявляется, свечение дышит
    if (bProg < 1) {
      bProg = Math.min(1, bProg + dt / 0.85); drawBoard(bText, easeIO(bProg));
      if (!calm && bText) bits.emit(BOARD_AT.x + (easeIO(bProg) - 0.5) * 1.3 * Math.cos(-0.34), BOARD.y + rnd(-0.25, 0.25), BOARD_AT.z + 0.15 + (easeIO(bProg) - 0.5) * 1.3 * Math.sin(0.34) * -1, rnd(-0.2, 0.2), rnd(0.4, 1.1), 0.3, COL.cyan, 0.05, 0.05, 0.05, rnd(0.5, 0.9), { g: -0.5, bounce: 0, spin: 3 });
    }
    bGlow += (bGlowWant - bGlow) * (1 - Math.exp(-dt * 4));
    const pulse = calm ? 1 : 0.85 + 0.15 * Math.sin(t * 5);
    glowMat.opacity = bGlow * 0.6 * pulse; glow.visible = bGlow > 0.01;

    // звёздочки и вспышка
    for (const s of stars) {
      if (!s.m.visible) continue;
      s.age += dt; const u = s.age / s.life; if (u >= 1) { s.m.visible = false; continue; }
      const k = s.orb ? Math.min(1, s.age / 0.12) * (u > 0.7 ? (1 - u) / 0.3 : 1) : easeBack(u * 3) * (1 - easeIn(u)) ;
      s.m.scale.setScalar(Math.max(k, 0) * s.s * 0.5);
      if (s.orb) { const ph = s.orb.ph + s.age * s.orb.w; s.m.position.set(s.orb.c.x + Math.cos(ph) * s.orb.r, s.orb.c.y + 0.1 * Math.sin(ph * 2), s.orb.c.z + Math.sin(ph) * s.orb.r * 0.35); }
      s.m.rotation.z += s.spin * dt;
    }
    if (flashM.visible) {
      flashSt.age += dt; const u = flashSt.age / flashSt.life;
      if (u >= 1) flashM.visible = false; else { flashM.scale.setScalar(flashSt.s * (0.2 + 0.8 * easeOut(u))); flashMat.opacity = (1 - u) * 0.9; }
    }
  }

  function anchor(): THREE.Vector3 { g.updateWorldMatrix(true, false); return new THREE.Vector3(dummy.position.x, PIVOT.chest[1] * dummy.scale.y, dummy.position.z).applyMatrix4(g.matrixWorld); }
  /** Сколько вызовов отрисовки съедает площадка прямо сейчас (видимые меши + тени у тех, что их отбрасывают): для проверки бюджета. */
  function drawCalls(): number {
    let n = 0;
    g.traverse(x => {
      const m = x as THREE.Mesh; if (!m.isMesh) return;
      let vis = true; for (let p: THREE.Object3D | null = m; p; p = p.parent) if (!p.visible) { vis = false; break; }
      if (vis) { n++; if (m.castShadow) n++; }
    });
    return n;
  }
  function dispose() {
    if (dead) return; dead = true;
    for (const w of tws.splice(0)) w.done();
    scene.remove(g);
    own.forEach(x => x.dispose());
    g.clear();
  }

  return {
    g, show, hit, bonk, glitch, breakGlitch, targets, targetHit, targetMiss, board, cheer, update, dispose, anchor, drawCalls,
    /** Для проверок: живых частиц и звёзд, поднятых мишеней, включён ли глитч. */
    stats: () => ({ particles: bits.live, stars: stars.filter(s => s.m.visible).length, targetsUp: tg.filter(x => x.st === 'up' && x.h > 0.5).length, glitch: glitchOn, shown: show_.u }),
  };
}
export type Training = ReturnType<typeof createTraining>;

/** Контур пятиконечной звезды (внешний радиус R, внутренний r). */
function starShape(R: number, r: number): THREE.Shape {
  const s = new THREE.Shape();
  for (let i = 0; i < 10; i++) { const a = Math.PI / 2 + (i / 10) * TAU, rr = i % 2 ? r : R, x = Math.cos(a) * rr, y = Math.sin(a) * rr; if (i) s.lineTo(x, y); else s.moveTo(x, y); }
  s.closePath(); return s;
}
