// Атаки врагов (ход монстра при ошибке ребёнка): у каждого монстра свой стиль, а не один розовый шар для всех.
// Десять стилей: огонь, призрак, прыжок с ударом о землю, рывок, лёд, иглы/перья, удар дубиной с разбега, споры, вода, луч.
// Порядок один у всех: рычание, настоящий клип монстра (Punch/Weapon/Headbutt/Bite_Front/Jump/Run/Fast_Flying), в момент касания в клипе
// вылетает эффект, долетает до щита героя (arena.block: искры, «ҚАЛҚАН», клип блока), монстр возвращается. Урона нет: щит всегда держит.
// Арена отдаёт сюда только «ручки» (Env): частицы, твины, тряску, блок. Здесь нет ни одного своего кадрового цикла, кроме env.fx.
import * as THREE from 'three';
import type { Actor, Monster } from './actor';
import { CELL, type Vfx } from './vfx';
import type { Sfx } from '../lib/audio';

export const HERO_X = -2.6, ENEMY_X = 2.8, Z0 = 0.4;

// ---------- какой монстр как бьёт ----------
export type Style = 'fire' | 'wisp' | 'slam' | 'dash' | 'ice' | 'needles' | 'smash' | 'spore' | 'water' | 'beam';
export const STYLES: Style[] = ['fire', 'wisp', 'slam', 'dash', 'ice', 'needles', 'smash', 'spore', 'water', 'beam'];
export interface Atk { style: Style; v: string }
const A = (style: Style, v = ''): Atk => ({ style, v });
/** Все 48 монстров из public/models/monsters (тест следит, чтобы у каждого героя roster.ts стиль был назначен явно). */
export const ATTACKS: Record<string, Atk> = {
  // прыжок + удар о землю: круглые и неуклюжие
  Blob_GreenBlob: A('slam'), Blob_PinkBlob: A('slam'), Big_Bunny: A('slam'), Big_Frog: A('slam'),
  // споры
  Blob_Mushnub: A('spore'), Blob_Mushnub_Evolved: A('spore'), Big_MushroomKing: A('spore'),
  // иглы и перья
  Blob_GreenSpikyBlob: A('needles', 'spike'), Blob_Cactoro: A('needles', 'spike'), Big_Cactoro: A('needles', 'spike'),
  Blob_Chicken: A('needles', 'feather'), Blob_Birb: A('needles', 'feather'), Blob_Pigeon: A('needles', 'feather'), Big_Birb: A('needles', 'feather'), Flying_Pigeon: A('needles', 'feather'),
  // лучи: пришельцы, маг, молнии
  Blob_Alien: A('beam', 'laser'), Big_Alien: A('beam', 'laser'), Blob_Wizard: A('beam', 'magic'), Flying_Hywirl: A('beam', 'zap'),
  // рывок с послеобразами (пёс и кот бросаются с разбега)
  Blob_Dog: A('dash', 'ram'), Blob_Cat: A('dash', 'ninja'),
  Blob_Ninja: A('dash', 'ninja'), Big_Ninja: A('dash', 'ninja'), Flying_Armabee: A('dash', 'bee'), Flying_Armabee_Evolved: A('dash', 'bee'),
  Flying_Alpaking: A('dash', 'ram'), Flying_Alpaking_Evolved: A('dash', 'ram'), Flying_Goleling: A('dash', 'ram'), Flying_Goleling_Evolved: A('dash', 'ram'), Flying_Tribal: A('dash', 'bee'),
  // дубина с разбега
  Blob_Orc: A('smash'), Big_Orc: A('smash'), Big_Orc_Skull: A('smash'), Big_Tribal: A('smash'), Big_Monkroose: A('smash'), Big_Dino: A('smash'),
  // лёд
  Blob_Yeti: A('ice'), Big_Yeti: A('ice'),
  // вода
  Blob_Fish: A('water', 'splash'), Big_Fish: A('water', 'splash'), Flying_Glub: A('water', 'bubbles'), Flying_Glub_Evolved: A('water', 'bubbles'), Flying_Squidle: A('water', 'bubbles'),
  // огонь
  Flying_Dragon: A('fire'), Flying_Dragon_Evolved: A('fire'), Big_Demon: A('fire'), Big_BlueDemon: A('fire', 'blue'),
  // призраки
  Flying_Ghost: A('wisp', 'ghost'), Flying_Ghost_Skull: A('wisp', 'skull'),
};
const FALLBACK: Record<string, Atk> = { Blob: A('slam'), Big: A('smash'), Flying: A('dash', 'bee') };
/** Стиль монстра по имени файла (без .glb); новый монстр без записи бьёт по своему классу, а не молча стреляет розовым шаром. */
export const attackOf = (id: string): Atk => ATTACKS[id] ?? FALLBACK[id.split('_')[0]] ?? A('slam');
/** Материалы призрака делаем «прозрачными» заранее (при появлении): переключение прозрачности посреди боя пересобирало бы шейдер. */
export function prepareEnemy(id: string, a: Actor) { if (attackOf(id).style === 'wisp') for (const m of a.ownMaterials()) m.transparent = true; }

// ---------- договор с ареной ----------
export interface Body { id: string; m: Monster; boss: boolean; wb: boolean; top: number; s0: number; dy: number }
export interface BlockOpts { at?: THREE.Vector3; c2?: number; power?: number; text?: boolean }
export interface Env {
  scene: THREE.Scene; vfx: Vfx; km: number; high: boolean;
  sfx(n: Sfx): void;
  /** Покадровый обработчик (dt уже с учётом замедления); вернуть false — убрать. */
  fx(u: (dt: number) => boolean): void;
  tween(dur: number, step: (u: number) => void): Promise<void>;
  wait(s: number): Promise<void>;
  shake(v: number): void;
  hitStop(scale: number, sec: number): void;
  burst(pos: THREE.Vector3, colors: number[], n?: number, speed?: number, size?: number): void;
  ring(pos: THREE.Vector3, color: number, max?: number): void;
  guard(on: boolean): void;
  /** Полный блок: искры на щите, пульс, «ҚАЛҚАН» (text), звук, клип блока героя с отдачей. Промис — конец клипа блока. */
  block(o?: BlockOpts): Promise<void>;
  /** Лёгкий удар по щиту (искры и пульс) для второстепенных попаданий залпа. */
  tap(at: THREE.Vector3, color: number): void;
}

/** Куда летит всё: поверхность щита с лицевой стороны, и точка искр, видимая камере. */
const HIT = new THREE.Vector3(HERO_X + 1.5, 1.4, Z0);
const SPARK = new THREE.Vector3(HERO_X + 1.05, 1.4, Z0 + 0.7);
const V3 = THREE.Vector3;
const TAU = Math.PI * 2;
const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const X_AXIS = new THREE.Vector3(1, 0, 0);
/** Момент касания в клипах монстров (доля клипа), по нему вылетает эффект. */
const HIT_AT: Record<string, number> = { Bite_Front: 0.5, Punch: 0.45, Weapon: 0.5, Headbutt: 0.5, Jump: 0.5 };
const within = (p: Promise<unknown>, s: number) => Promise.race([p, new Promise(r => setTimeout(r, s * 1000))]);

interface Ctx {
  b: Body; a: Actor; g: THREE.Group; big: boolean; wb: boolean; v: string;
  blk(o?: BlockOpts): void;
  /** Дождаться всех блоков и (необязательно) конца клипа монстра. */
  end(...more: Promise<unknown>[]): Promise<void>;
}

export function createAttacks(env: Env) {
  const { vfx, scene } = env;
  const K = env.km, Q = env.high ? 1 : 0.55, QK = Q * (0.4 + 0.6 * K);
  const cnt = (n: number) => Math.max(1, Math.round(n * QK));
  const shake = (v: number) => env.shake(v * (0.4 + 0.6 * K));
  const dir = new V3(), tmp = new V3(), tmp2 = new V3();

  // общие геометрии и материалы: создаются один раз и живут до dispose (ни одного нового буфера на атаку)
  let gBox: THREE.BoxGeometry | null = null, gOct: THREE.OctahedronGeometry | null = null, gSph: THREE.SphereGeometry | null = null;
  const boxG = () => (gBox ??= new THREE.BoxGeometry(1, 1, 1));
  const octG = () => (gOct ??= new THREE.OctahedronGeometry(1, 0));
  const sphG = () => (gSph ??= new THREE.SphereGeometry(1, 14, 10));
  const mats = new Map<string, THREE.Material>();
  const matOf = (key: string, make: () => THREE.Material) => { let m = mats.get(key); if (!m) { m = make(); mats.set(key, m); } return m; };
  const solid = (c: number, e: number) => matOf('s' + c, () => new THREE.MeshLambertMaterial({ color: c, emissive: e, flatShading: true }));
  const glowMat = (c: number, a: number) => matOf('g' + c + ':' + a, () => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: a, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  const bubbleMat = () => matOf('bubble', () => new THREE.MeshBasicMaterial({ color: 0x9fe4ff, transparent: true, opacity: 0.5, depthWrite: false }));

  const mouthOf = (b: Body, out = new V3()) => out.set(b.m.a.g.position.x - 0.55 - b.top * 0.12, b.m.a.g.position.y + b.m.height * 0.6, Z0);
  const pick = (b: Body, names: string[]) => names.find(n => b.m.a.has(n)) ?? b.m.idle;
  /** Обычный размер монстра на время хода (арена сама подрастает малышей до 1, поэтому берём текущий, а не s0). Сплющивать можно только вверх по x: иначе арена «доращивает» масштаб. */
  let SC = 1;
  const sq = (b: Body, sx: number, sy: number) => b.m.a.g.scale.set(SC * sx, SC * sy, SC * sx);

  /** Клип монстра; промис released — момент касания (at), done — конец клипа. Длина клипа приводится к ~len секунд. */
  function strike(b: Body, clip: string, at?: number, len = 0.7, speed?: number) {
    const a = b.m.a; let rel: () => void = () => {}; const released = new Promise<void>(r => (rel = r));
    if (!a.has(clip)) { rel(); return { released, done: Promise.resolve(), speed: 1, clip }; }
    const sp = speed ?? Math.max(1.2, Math.min(1.8, a.duration(clip) / len));
    const done = a.play(clip, { speed: sp, marks: [{ at: at ?? HIT_AT[clip] ?? 0.5, fn: rel }] });
    return { released, done, speed: sp, clip };
  }
  /** Полёт из точки в точку за dur секунд (после delay): path правит позицию по u, tick рисует (позиция, u, dt). Промис — прилёт. */
  function fly(from: THREE.Vector3, to: THREE.Vector3, dur: number, tick: (p: THREE.Vector3, u: number, dt: number) => void, path?: (u: number, p: THREE.Vector3) => void, delay = 0) {
    return new Promise<void>(res => {
      let t = -delay; const p = new V3();
      env.fx(dt => {
        t += dt; if (t < 0) return true;
        const u = Math.min(1, t / dur); p.lerpVectors(from, to, u); path?.(u, p); tick(p, u, dt);
        if (u >= 1) { res(); return false; } return true;
      });
    });
  }
  /** Излучение с заданной частотой в секунду (без дрожания кадров). */
  function rate(perSec: number) { let acc = 0; return (dt: number) => { acc += dt * perSec * QK; const k = Math.floor(acc); acc -= k; return k; }; }
  function puffCell() { return CELL.PUFF + ((Math.random() * 8) | 0); }
  function phase(b: Body, on: boolean) {
    for (const m of b.m.a.ownMaterials()) { m.opacity = on ? 0.36 : 1; m.depthWrite = !on; }
    b.m.a.model.traverse(o => { if (o.userData.outline) o.visible = !on; });
  }
  /** Тянущиеся за телом послеобразы и линии скорости: цвет c, позиция p, движение назад (+x). */
  function afterimage(p: THREE.Vector3, c: number, c2: number, size: number) {
    vfx.emit(CELL.GLARE, p.x, p.y, p.z, 0, 0, 0, size, size * 0.75, 0.26, { c, w: 0.15, gain: 1.05, c1: c2, gain1: 0.9, a: 0.6, k: 1.4, fp: 1, atk: 0.05 });
    vfx.emit(CELL.STREAK, p.x + rnd(0, 0.5), p.y + rnd(-0.6, 0.6) * size, p.z + rnd(-0.2, 0.3), rnd(4, 8), 0, 0, rnd(1.2, 2.2), 0.2, rnd(0.16, 0.26), { mode: 2, ar: 0.12, c, w: 0.5, gain: 1.2, drag: 3, k: 1.4, fp: 1 });
  }

  /** Небольшая вспышка на щите (для повторяющихся касаний луча/струи): звезда и пара искр, без слепящего пятна. */
  function sparkle(p: THREE.Vector3, c: number) {
    vfx.emit(CELL.STAR4, p.x, p.y, p.z, 0, 0, 0, 0.3, 1.3, 0.18, { c, w: 0.4, gain: 1.15, rot: rnd(0, 1), spin: rnd(-3, 3), k: 3 });
    for (let i = 0; i < cnt(3); i++) { const a = rnd(0, TAU); vfx.emit(CELL.STREAK, p.x, p.y, p.z, Math.cos(a) * 5, Math.sin(a) * 5 + 1, rnd(0, 2), 0.7, 0.1, rnd(0.2, 0.32), { mode: 2, ar: 0.14, c, w: 0.4, gain: 1.15, drag: 3, g: 5, k: 1.5 }); }
  }

  // ---------- 1. огонь ----------
  async function fire(c: Ctx) {
    const { b, big } = c, blue = c.v === 'blue', bk = c.wb ? 1.4 : big ? 1.2 : 1;
    const c1 = blue ? 0x8fe4ff : 0xffe07a, c2 = blue ? 0x2f5cff : 0xff3a1a, gl = blue ? 0x5ac8ff : 0xffa03a, smoke = blue ? 0x34507a : 0x5a2a26;
    env.sfx('growl');
    const s = strike(b, b.m.attack());
    await within(s.released, 2.5);
    env.guard(true); env.sfx('boom');
    const from = mouthOf(b), T = 0.3, dur = big ? 0.6 : 0.42;
    vfx.glow(from, gl, 2.8 * bk, 0.3);
    const d = tmp.subVectors(HIT, from), len = d.length(), sp = len / T; d.divideScalar(len);
    const vx = d.x * sp, vy = d.y * sp, vz = d.z * sp, r = rate(150 * bk); let t = 0, ts = 0;
    env.fx(dt => {
      t += dt;
      for (let i = r(dt); i > 0; i--) {
        const j = rnd(0.85, 1.12), k = i % 6;
        if (k === 0) vfx.emit(puffCell(), from.x, from.y, from.z, vx * 0.85, vy * 0.85 + 0.3, vz * 0.85, 0.4 * bk, 1.5 * bk, T * 1.2, { c: smoke, w: 0, c1: 0x1a1018, a: 0.5, k: 1.4, fp: 1.2, atk: 0.2, rot: rnd(0, TAU), spin: rnd(-2, 2) }, true);
        else if (k === 3) vfx.emit(CELL.DOT, from.x, from.y, from.z, vx * j + rnd(-1, 1), vy * j + rnd(0, 2), vz * j + rnd(-1, 1), 0.24, 0.05, rnd(0.3, 0.5), { c: c1, w: 0.2, gain: 1.2, g: 6, k: 1 });
        else vfx.emit(CELL.GLARE, from.x, from.y, from.z, vx * j + rnd(-0.6, 0.6), vy * j + rnd(-1.4, 1.4), vz * j + rnd(-1, 1), 0.35 * bk, rnd(1.1, 1.7) * bk, T * rnd(0.95, 1.2), { c: c1, w: 0.1, gain: 1.15, c1: c2, gain1: 0.95, a: 0.75, k: 1.4, fp: 0.9, atk: 0.1 });
      }
      if (t > T) { ts -= dt; if (ts <= 0) { ts = 0.1; sparkle(SPARK, c1); shake(0.12); } }
      return t < dur;
    });
    await env.wait(T * 0.92); c.blk({ c2, power: big ? 1.4 : 1, at: SPARK });
    await env.wait(Math.max(0, dur - T * 0.92));
    await c.end(s.done);
  }

  // ---------- 2. призрак: тает, проплывает вперёд, тёмный «огонёк» ползёт к щиту ----------
  async function wisp(c: Ctx) {
    const { b, big, g } = c, skull = c.v === 'skull', x0 = g.position.x;
    const col = skull ? 0x9dff7a : 0x9fe8ff, sm0 = skull ? 0x4a2470 : 0x6a4aa0, sm1 = skull ? 0x100420 : 0x241650;
    env.sfx('growl');
    const s = strike(b, b.m.attack());
    await within(s.released, 2.5);
    env.guard(true); phase(b, true); env.sfx('slash');
    const drift = env.tween(0.42, u => { g.position.x = x0 - Math.sin(u * Math.PI * 0.5) * (big ? 1.7 : 1.2); b.dy = Math.sin(u * Math.PI) * 0.35 * K; });
    const n = big ? 3 : 1, T = 0.5;
    const flights: Promise<void>[] = [];
    for (let i = 0; i < n; i++) {
      const from = mouthOf(b), ph = i * 2.1, to = tmp2.copy(HIT).add(new V3(0, (i - (n - 1) / 2) * 0.45, rnd(-0.15, 0.2))).clone(), r = rate(120);
      flights.push(fly(from.clone(), to, T, (p, u, dt) => {
        for (let k = r(dt); k > 0; k--) {
          vfx.emit(puffCell(), p.x, p.y, p.z, rnd(0.2, 1.2), rnd(-0.3, 0.6), rnd(-0.3, 0.3), 0.5, rnd(1.0, 1.5), 0.42, { c: sm0, w: 0, c1: sm1, a: 0.7, k: 1.3, fp: 1.1, atk: 0.15, rot: rnd(0, TAU), spin: rnd(-2, 2), drag: 1 }, true);
          if (k % 2 === 0) vfx.emit(CELL.DOT, p.x + rnd(-0.2, 0.2), p.y + rnd(-0.2, 0.2), p.z, rnd(0.5, 1.5), rnd(-0.2, 0.8), 0, 0.28, 0.03, rnd(0.3, 0.5), { c: col, w: 0.3, gain: 1.2, k: 1.2 });
        }
        vfx.emit(CELL.GLARE, p.x, p.y, p.z, 0, 0, 0, 1.2, 1.2, Math.max(0.05, dt * 1.6), { c: col, w: 0.2, gain: 1.05, a: 0.85, atk: 0.01, fp: 0.5 });
      }, (u, p) => { p.y += Math.sin(u * TAU * 1.5 + ph) * 0.4 * K * Math.sin(u * Math.PI); p.z += Math.cos(u * TAU + ph) * 0.3 * K; }, i * 0.1));
    }
    await flights[0]; c.blk({ c2: col, power: big ? 1.3 : 1, at: SPARK });
    for (let i = 0; i < cnt(10); i++) { const a = (i / cnt(10)) * TAU; vfx.emit(puffCell(), SPARK.x, SPARK.y, SPARK.z, Math.cos(a) * 3, Math.sin(a) * 3 + 0.3, 0.5, 0.5, 1.4, 0.45, { c: sm0, w: 0, c1: sm1, a: 0.7, k: 1.6, fp: 1.2, rot: rnd(0, TAU), drag: 3 }, true); }
    await Promise.all([...flights, drift]);
    if (n > 1) env.tap(SPARK, col);
    const x1 = g.position.x;
    await env.tween(0.28, u => { g.position.x = x1 + (x0 - x1) * u; b.dy = 0; });
    phase(b, false);
    await c.end(s.done);
  }

  // ---------- 3. прыжок и удар о землю: волна пыли катится к щиту ----------
  async function slam(c: Ctx) {
    const { b, big, g } = c, x0 = g.position.x, hops = big ? 2 : 1, dust = 0xe6dcc4;
    env.sfx('growl'); env.guard(true);
    for (let i = 0; i < hops; i++) {
      const last = i === hops - 1, xa = g.position.x, xb = last ? HERO_X + 2.75 : x0 - 1.5, hh = (last ? 1.6 : 1.0) * (0.5 + 0.5 * K) * (big ? 1.0 : 1), T = last ? 0.38 : 0.3;
      await env.tween(0.06, u => sq(b, 1 + 0.12 * u, 1 - 0.22 * u));           // присел
      if (b.m.a.has('Jump')) void b.m.a.play('Jump', { speed: Math.min(1.6, b.m.a.duration('Jump') / T) });
      env.sfx('slash');
      await env.tween(T, u => { g.position.x = xa + (xb - xa) * u; b.dy = Math.sin(u * Math.PI) * hh; sq(b, 1, 1 + 0.12 * Math.sin(u * Math.PI)); });
      b.dy = 0; env.sfx('land'); shake(last ? (big ? 0.7 : 0.45) : 0.3);
      const foot = tmp.set(g.position.x, 0, Z0).clone();
      vfx.dust(foot, last ? 1.3 : 0.9, dust); env.burst(foot.clone().setY(0.3), [0xd8cbb0, 0xffffff], cnt(last ? 8 : 4), 3, 0.13);
      void env.tween(0.18, u => { const k = Math.sin(u * Math.PI); sq(b, 1 + 0.2 * k, 1 - 0.25 * k); });
      if (last) {
        env.hitStop(0.3, 0.05); env.ring(foot.clone().setY(0.12), 0xe6dcc4, 3.4 * (big ? 1.3 : 1));
        // ударная волна: кольца и клубы бегут по земле к герою
        for (let k = 0; k < 3; k++) vfx.emit(CELL.RING_THICK, foot.x - 0.5, 0.16, Z0, -5 - k * 0.8, 0, 0, 0.7, 2.6 + k * 0.5, 0.36, { mode: 1, c: dust, w: 0.3, gain: 1, a: 0.8, k: 1.5, fp: 1, drag: 5, delay: k * 0.04 });
        for (let k = 0, m = cnt(big ? 12 : 8); k < m; k++) vfx.emit(puffCell(), foot.x - 0.6, 0.35, Z0 + rnd(-0.5, 0.5), -rnd(5, 8), rnd(0.2, 1.2), 0, rnd(0.4, 0.6), rnd(1.1, 1.7), rnd(0.32, 0.42), { c: dust, w: 0.3, c1: 0x9a90c8, a: 0.65, rot: rnd(0, TAU), spin: rnd(-1, 1), drag: 6, k: 1.6, fp: 1.3 }, true);
        await env.wait(0.06);
        c.blk({ c2: 0xe6c88a, power: big ? 1.6 : 1.2, at: SPARK });
        if (big) { await env.wait(0.12); env.tap(SPARK, 0xffe9a8); }
      } else await env.wait(0.03);
    }
    // назад тем же прыжком, пока герой отходит от щитового удара
    const xr = g.position.x;
    const back = env.tween(0.4, u => { g.position.x = xr + (x0 - xr) * u; b.dy = Math.sin(u * Math.PI) * 0.9 * K; sq(b, 1, 1); });
    await c.end(back);
    b.dy = 0;
  }

  // ---------- 4. рывок: послеобразы и линии скорости; ниндзя рубит крестом, пчела жалит, «таран» бьёт лбом ----------
  async function dash(c: Ctx) {
    const { b, big, g, v } = c, a = b.m.a, x0 = g.position.x, flying = b.m.cls === 'Flying';
    const col = v === 'ninja' ? 0xc9a2ff : v === 'bee' ? 0xffd23a : 0xffe9a8, col2 = v === 'ninja' ? 0x2a1450 : v === 'bee' ? 0xff8a1a : 0xff9a3a;
    const runClip = flying ? 'Fast_Flying' : 'Run', melee = pick(b, b.m.cls === 'Blob' ? ['Bite_Front'] : ['Punch', 'Weapon', 'Headbutt']);
    const strikes = big ? 2 : 1, xs = HERO_X + 2.85;
    env.guard(true);
    for (let i = 0; i < strikes; i++) {
      // замах: отпрянул назад
      const xa = g.position.x, xs0 = Math.min(ENEMY_X + 0.4, xa + 0.6);
      env.sfx('slash');
      await env.tween(0.13, u => { g.position.x = xa + (xs0 - xa) * u; sq(b, 1 + 0.12 * u, 1); b.dy = -0.1 * u; });
      // рывок
      const D = big ? 0.15 : 0.18;
      if (a.has(runClip)) a.loop(runClip, 0.05, 1.6);
      const len = a.duration(melee), at = HIT_AT[melee] ?? 0.5;
      let hit: () => void = () => {}; const hitP = new Promise<void>(r => (hit = r));
      const zig = v === 'bee' ? 0.45 * K : 0, r = rate(140), p = new V3(); let dashing = true;
      env.fx(dt => { for (let k = r(dt); k > 0; k--) afterimage(p.set(g.position.x + 0.5, g.position.y + b.m.height * 0.5, Z0), col, col2, b.m.height * 0.5); return dashing; });
      const dashP = env.tween(D, u => { g.position.x = xs0 + (xs - xs0) * u * (2 - u); b.dy = Math.sin(u * Math.PI * 3) * zig; sq(b, 1, 1); });
      if (len > 0) void a.play(melee, { speed: Math.min(2.6, (at * len) / (D + 0.03)), marks: [{ at, fn: hit }] }); else hit();
      await dashP; dashing = false; await within(hitP, 0.4); hit();
      // касание
      env.sfx('impact'); shake(big ? 0.45 : 0.3); env.hitStop(0.3, 0.04);
      const dSw = i % 2 === 0 ? new V3(1, -0.55, 0) : new V3(1, 0.55, 0);
      if (v === 'ninja') { vfx.slash(SPARK, dSw, col, 3.6); vfx.slash(SPARK, tmp.set(1, i % 2 === 0 ? 0.55 : -0.55, 0), 0xffffff, 3.2); }
      else if (v === 'bee') { vfx.hitSpark(SPARK, col, 1.1); vfx.emit(CELL.STAR4, SPARK.x, SPARK.y, SPARK.z, 0, 0, 0, 0.5, 2.6, 0.24, { c: col, w: 0.3, gain: 1.2, rot: rnd(0, 1), k: 3 }); }
      else { vfx.hitSpark(SPARK, col, 1.2); vfx.dust(tmp.set(g.position.x - 0.8, 0, Z0), 1.1, 0xf3e6c8); vfx.emit(CELL.RING, SPARK.x, SPARK.y, SPARK.z, 0, 0, 0, 0.4, 2.4, 0.3, { c: col, w: 0.3, k: 3 }); }
      c.blk({ c2: col, power: big ? 1.3 : 1, at: SPARK });
      // отскок от щита
      const xh = g.position.x, xr = i === strikes - 1 ? x0 : x0 - 0.8;
      if (a.baseName() !== b.m.idle) a.loop(b.m.idle, 0.1);
      await env.tween(i === strikes - 1 ? 0.24 : 0.14, u => { g.position.x = xh + (xr - xh) * u; b.dy = Math.sin(u * Math.PI) * 0.5 * K; sq(b, 1, 1 + 0.1 * Math.sin(u * Math.PI)); });
      b.dy = 0;
    }
    await c.end();
  }

  // ---------- 5. лёд: осколки летят дугой ----------
  async function ice(c: Ctx) {
    const { b, big } = c, n = big ? 6 : 3, bk = c.wb ? 1.35 : big ? 1.2 : 1, ice = 0xbff2ff;
    env.sfx('growl');
    const s = strike(b, b.m.attack());
    await within(s.released, 2.5);
    env.guard(true); env.sfx('slash');
    const from = mouthOf(b); vfx.hitSpark(from, ice, 0.7); vfx.glow(from, 0x8fe4ff, 2.2, 0.25);
    const shards: Promise<void>[] = [];
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(octG(), solid(0x36b4ff, 0x1c7ee0)); m.scale.set(0.34 * bk, 0.85 * bk, 0.34 * bk); m.visible = false; scene.add(m);
      const to = new V3(HERO_X + 1.5, 1.4 + rnd(-0.55, 0.5), Z0 + rnd(-0.25, 0.35)), st = from.clone().add(new V3(rnd(-0.2, 0.2), rnd(-0.3, 0.3), rnd(-0.2, 0.2)));
      const apex = rnd(1.3, 1.9), spin = new V3(rnd(6, 12), rnd(4, 9), rnd(-6, 6)), r = rate(90);
      shards.push(fly(st, to, 0.44, (p, u, dt) => {
        m.visible = true; m.position.copy(p); m.rotation.x += spin.x * dt; m.rotation.y += spin.y * dt; m.rotation.z += spin.z * dt;
        for (let k = r(dt); k > 0; k--) vfx.emit(k % 2 ? CELL.STAR_S : CELL.DOT, p.x, p.y, p.z, rnd(-0.5, 0.5), rnd(-0.3, 0.6), rnd(-0.3, 0.3), 0.4, 0.03, rnd(0.25, 0.4), { c: k % 2 ? 0xffffff : 0x3aa8ff, w: k % 2 ? 0 : 0.1, gain: 1.15, k: 1.2, spin: rnd(-4, 4) }, k % 2 === 0);
      }, (u, p) => { p.y += Math.sin(u * Math.PI) * apex; }, 0.1 + i * (big ? 0.06 : 0.09)).then(() => {
        scene.remove(m); const at = m.position.clone(); at.x -= 0.4; at.z += 0.55;
        vfx.hitSpark(at, ice, 0.65); env.burst(m.position, [0x9fe8ff, 0xffffff], cnt(4), 3, 0.12);
        if (i === 0) c.blk({ c2: 0x8fe4ff, power: big ? 1.3 : 1, at: SPARK }); else env.tap(at, 0x8fe4ff);
        shake(0.1);
      }));
    }
    await Promise.all(shards);
    vfx.emit(CELL.RING, SPARK.x, SPARK.y, SPARK.z, 0, 0, 0, 0.6, 3.2, 0.4, { c: 0xdff8ff, w: 0.3, a: 0.8, k: 3 });
    await c.end(s.done);
  }

  // ---------- 6. иглы (кактус) и перья (птицы): залп веером ----------
  async function needles(c: Ctx) {
    const { b, big, v } = c, feather = v === 'feather', n = big ? 9 : 5;
    const col = feather ? 0xe6f2ff : 0xc8ff7a, tip = feather ? 0x8fc8ff : 0x5ac84a;
    env.sfx('growl');
    const s = strike(b, b.m.attack());
    await within(s.released, 2.5);
    env.guard(true); env.sfx('slash');
    const from = mouthOf(b); vfx.glow(from, col, 1.8, 0.2);
    const flights: Promise<void>[] = [];
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(boxG(), solid(col, tip)); feather ? m.scale.set(0.9, 0.3, 0.03) : m.scale.set(1.2, 0.09, 0.09); m.visible = false; scene.add(m);
      const f = (i / Math.max(1, n - 1)) - 0.5, st = from.clone().add(new V3(0, f * 0.7 + rnd(-0.1, 0.1), rnd(-0.15, 0.25)));
      const to = new V3(HERO_X + 1.5, 1.4 + f * 1.0, Z0 + rnd(-0.2, 0.35)), q = new THREE.Quaternion(), r = rate(80);
      q.setFromUnitVectors(X_AXIS, dir.subVectors(to, st).normalize());
      flights.push(fly(st, to, 0.26, (p, u, dt) => {
        m.visible = true; m.position.copy(p); m.quaternion.copy(q); if (feather) m.rotateX(u * 9);
        vfx.emit(CELL.GLARE, p.x, p.y, p.z, 0, 0, 0, 0.7, 0.7, Math.max(0.05, dt * 1.6), { c: col, w: 0.2, gain: 1, a: 0.7, atk: 0.01, fp: 0.5 });
        for (let k = r(dt); k > 0; k--) vfx.emit(feather ? CELL.STAR_S : CELL.DOT, p.x, p.y, p.z, rnd(0.3, 1), rnd(-0.4, 0.4), rnd(-0.3, 0.3), 0.25, 0.02, rnd(0.2, 0.32), { c: feather ? 0xffffff : col, w: 0.3, gain: 1.15, k: 1.2, spin: rnd(-3, 3) });
      }, undefined, i * 0.05).then(() => {
        scene.remove(m); tmp.set(HERO_X + 1.1, m.position.y, Z0 + 0.6);
        if (i === 0) c.blk({ c2: col, power: big ? 1.2 : 0.9, at: SPARK }); else env.tap(tmp.clone(), col);
        shake(0.06);
      }));
    }
    await Promise.all(flights);
    await c.end(s.done);
  }

  // ---------- 7. удар с разбега: бежит к щиту и бьёт дубиной, земля дрожит ----------
  async function smash(c: Ctx) {
    const { b, big, g, a } = c, x0 = g.position.x, xs = HERO_X + 2.75, hits = big ? 2 : 1, tan = 0xffb04a;
    env.sfx('growl'); env.guard(true);
    const melee = pick(b, b.m.cls === 'Blob' ? ['Bite_Front'] : ['Weapon', 'Punch']);
    if (a.has('Run')) a.loop('Run', 0.08, 1.5);
    const foot = new V3(); let running = true;
    const r = rate(45);
    env.fx(dt => { for (let k = r(dt); k > 0; k--) vfx.dust(foot.set(g.position.x + 0.7, 0, Z0), 0.45, 0xe6dcc4); return running; });
    await env.tween(c.wb ? 0.28 : 0.25, u => { g.position.x = x0 + (xs - x0) * u * (2 - u); });
    running = false;
    g.position.x = xs; shake(0.15);
    for (let i = 0; i < hits; i++) {
      const s = strike(b, melee, undefined, 0.52, i ? 2.2 : undefined);
      await within(s.released, 2);
      env.sfx('boom'); shake(big ? 0.9 : 0.6); env.hitStop(0.25, big ? 0.09 : 0.06);
      foot.set(g.position.x - 0.9, 0, Z0);
      vfx.dust(foot, big ? 1.8 : 1.3, 0xe6dcc4); env.ring(foot.clone().setY(0.12), tan, big ? 6 : 4.5);
      env.burst(foot.clone().setY(0.4), [0xb59a6a, 0x8a7a5a, 0xffffff], cnt(big ? 14 : 8), 5, 0.18);
      vfx.hitSpark(SPARK, tan, big ? 1.5 : 1.2); vfx.emit(CELL.STAR4, SPARK.x, SPARK.y, SPARK.z, 0, 0, 0, 0.6, 3.2, 0.26, { c: 0xffffff, w: 0.3, gain: 1.15, rot: rnd(0, 1), spin: 3, k: 3 });
      c.blk({ c2: tan, power: big ? 1.8 : 1.5, at: SPARK });
      if (i < hits - 1) await env.wait(0.06);
      else { if (a.baseName() !== 'Run' && a.has('Run')) a.loop('Run', 0.05, 1.5); }
    }
    // назад бегом (лицом от героя), пока герой отходит
    const xr = g.position.x; g.rotation.y = Math.PI / 2;
    const back = env.tween(0.3, u => { g.position.x = xr + (x0 - xr) * u; });
    await c.end(back);
    g.rotation.y = -Math.PI / 2; a.loop(b.m.idle, 0.12);
  }

  // ---------- 8. споры: облако плывёт к щиту и распускается ----------
  async function spore(c: Ctx) {
    const { b, big } = c, T = big ? 0.6 : 0.5, bk = c.wb ? 1.5 : big ? 1.3 : 1, c0 = 0xd2ff8a, c1 = 0x5fa85a;
    env.sfx('growl');
    const s = strike(b, b.m.attack());
    await within(s.released, 2.5);
    env.guard(true); env.sfx('land');
    const from = mouthOf(b);
    for (let k = 0, m = cnt(6); k < m; k++) vfx.emit(puffCell(), from.x, from.y, from.z, rnd(-2.5, -0.5), rnd(0, 1.5), rnd(-0.6, 0.6), 0.4, 1.1, 0.4, { c: c0, w: 0, c1, a: 0.6, drag: 3, rot: rnd(0, TAU), k: 1.5 }, true);
    const n = big ? 3 : 1, flights: Promise<void>[] = [];
    for (let i = 0; i < n; i++) {
      const to = HIT.clone().add(new V3(0, (i - (n - 1) / 2) * 0.6, rnd(-0.1, 0.25))), r = rate(150), ph = i * 1.7;
      flights.push(fly(from.clone(), to, T, (p, u, dt) => {
        for (let k = r(dt); k > 0; k--) {
          vfx.emit(puffCell(), p.x + rnd(-0.3, 0.3), p.y + rnd(-0.25, 0.25), p.z + rnd(-0.2, 0.2), rnd(-0.3, 0.6), rnd(0, 0.6), rnd(-0.2, 0.2), 0.8 * bk, 1.9 * bk, 0.5, { c: c0, w: 0, c1, a: 0.75, drag: 1.4, g: -0.3, rot: rnd(0, TAU), spin: rnd(-1.5, 1.5), k: 1.5, fp: 1.2, atk: 0.15 }, true);
          vfx.emit(CELL.DOT, p.x + rnd(-0.5, 0.5), p.y + rnd(-0.4, 0.5), p.z + rnd(-0.3, 0.3), rnd(-0.2, 0.5), rnd(0.2, 1.2), 0, 0.22, 0.04, rnd(0.4, 0.7), { c: 0xf3ffb0, w: 0.2, gain: 1.2, k: 1.1, fp: 1 });
        }
      }, (u, p) => { p.y += Math.sin(u * TAU * 1.2 + ph) * 0.25 * K + Math.sin(u * Math.PI) * 0.4; }, i * 0.12));
    }
    await flights[0];
    c.blk({ c2: c0, power: big ? 1.2 : 0.9, at: SPARK });
    for (let k = 0, m = cnt(big ? 18 : 12); k < m; k++) { const ang = (k / m) * TAU, sp = rnd(2, 4); vfx.emit(puffCell(), SPARK.x, SPARK.y, SPARK.z, Math.cos(ang) * sp, Math.sin(ang) * sp + 0.4, rnd(0, 1.2), 0.5, 1.5 * bk, 0.5, { c: c0, w: 0, c1, a: 0.6, drag: 3, rot: rnd(0, TAU), k: 1.6 }, true); }
    for (let k = 0, m = cnt(12); k < m; k++) vfx.emit(CELL.DOT, SPARK.x, SPARK.y, SPARK.z, rnd(-3, 3), rnd(0.5, 3), rnd(0, 1.5), 0.25, 0.04, rnd(0.5, 0.9), { c: 0xf3ffb0, w: 0.2, gain: 1.2, g: -0.5, drag: 1.5 });
    await Promise.all(flights);
    await c.end(s.done);
  }

  // ---------- 9. вода: струя дугой (рыбы) или пузыри (ГлАб, кальмар) ----------
  async function water(c: Ctx) {
    const { b, big, v } = c, bk = c.wb ? 1.35 : big ? 1.2 : 1, wat = 0x2a86ff, foam = 0xdff6ff;
    env.sfx('growl');
    const s = strike(b, b.m.attack());
    await within(s.released, 2.5);
    env.guard(true); env.sfx('slash');
    const from = mouthOf(b); vfx.glow(from, 0x8fe4ff, 1.8, 0.2);
    const splash = () => {
      vfx.emit(CELL.RING, SPARK.x, SPARK.y, SPARK.z, 0, 0, 0, 0.5, 3, 0.3, { c: foam, w: 0.3, a: 0.85, k: 3 });
      for (let k = 0, m = cnt(big ? 16 : 10); k < m; k++) { const ang = rnd(0, TAU), sp = rnd(2, 5); vfx.emit(CELL.DOT, SPARK.x, SPARK.y, SPARK.z, Math.cos(ang) * sp, Math.sin(ang) * sp + 1.5, rnd(0, 2), rnd(0.2, 0.34), 0.04, rnd(0.4, 0.7), { c: wat, w: 0.2, gain: 1.1, g: 8, k: 1.2 }, true); }
    };
    if (v === 'splash') {
      const T = 0.4, dur = big ? 0.55 : 0.4, G = 9, ts = { v: 0 }, dv = tmp.subVectors(HIT, from), vx = dv.x / T, vy = dv.y / T + 0.5 * G * T, vz = dv.z / T, r = rate(230 * bk); let t = 0;
      env.fx(dt => {
        t += dt;
        for (let k = r(dt); k > 0; k--) {
          const j = rnd(0.97, 1.03), w = rnd(-0.35, 0.35);
          vfx.emit(CELL.DOT, from.x, from.y, from.z, vx * j, vy + w, vz + rnd(-0.3, 0.3), rnd(0.46, 0.66) * bk, 0.14, T + 0.03, { c: 0x2a86ff, w: 0, gain: 1, g: G, k: 1, fp: 0.4, atk: 0.02 }, true);
          if (k % 2) vfx.emit(CELL.STREAK, from.x, from.y, from.z, vx * j, vy + w, vz, 0.8, 0.3, T + 0.03, { mode: 2, ar: 0.16, c: foam, w: 0.4, gain: 1.1, g: G, k: 1, fp: 0.5, atk: 0.02 });
        }
        if (t > T) { ts.v -= dt; if (ts.v <= 0) { ts.v = 0.09; splash(); } }
        return t < dur;
      });
      await env.wait(T); c.blk({ c2: wat, power: big ? 1.3 : 1, at: SPARK });
      shake(0.15); await env.wait(Math.max(0, dur - T) + 0.05);
    } else {
      const n = big ? 7 : 4, flights: Promise<void>[] = [];
      for (let i = 0; i < n; i++) {
        const m = new THREE.Mesh(sphG(), bubbleMat()); m.visible = false; scene.add(m);
        const to = HIT.clone().add(new V3(0, rnd(-0.5, 0.5), rnd(-0.1, 0.3))), st = from.clone().add(new V3(0, rnd(-0.3, 0.3), rnd(-0.1, 0.2))), sz = rnd(0.32, 0.5) * bk, ph = rnd(0, TAU);
        flights.push(fly(st, to, 0.5, (p, u, dt) => {
          m.visible = true; m.position.copy(p); m.scale.setScalar(sz * Math.min(1, 0.3 + u * 4));
          vfx.emit(CELL.DOT, p.x + sz * 0.3, p.y + sz * 0.35, p.z + sz * 0.6, 0, 0, 0, 0.18, 0.18, Math.max(0.05, dt * 1.6), { c: 0xffffff, gain: 1.1, atk: 0.01, fp: 0.4 });
        }, (u, p) => { p.y += Math.sin(u * TAU + ph) * 0.3 * K + Math.sin(u * Math.PI) * 0.5; }, i * 0.08).then(() => {
          scene.remove(m); tmp.set(HERO_X + 1.1, m.position.y, Z0 + 0.6); const at = tmp.clone();
          vfx.hitSpark(at, foam, 0.55); vfx.emit(CELL.RING, at.x, at.y, at.z, 0, 0, 0, 0.3, 1.6, 0.25, { c: foam, w: 0.3, a: 0.9, k: 3 });
          if (i === 0) c.blk({ c2: wat, power: big ? 1.2 : 0.9, at: SPARK }); else env.tap(at, wat);
          shake(0.06);
        }));
      }
      await Promise.all(flights); splash();
    }
    await c.end(s.done);
  }

  // ---------- 10. луч: зарядка в глазу, потом луч на щит (лазер, молния, магия) ----------
  const seg: THREE.Mesh[] = [];   // пул звеньев луча: создаётся один раз, между атаками спрятан
  function segment(i: number, m: THREE.Material) {
    let s = seg[i]; if (!s) { s = seg[i] = new THREE.Mesh(boxG(), m); s.frustumCulled = false; s.renderOrder = 6; scene.add(s); }
    s.material = m; s.visible = true; return s;
  }
  const hideSegs = () => { for (const s of seg) if (s) s.visible = false; };
  function lay(s: THREE.Mesh, a: THREE.Vector3, b: THREE.Vector3, w: number) {
    dir.subVectors(b, a); const len = dir.length() || 0.001; s.position.copy(a).addScaledVector(dir, 0.5);
    s.quaternion.setFromUnitVectors(X_AXIS, dir.divideScalar(len)); s.scale.set(len, w, w);
  }
  async function beam(c: Ctx) {
    const { b, big, v } = c, bk = c.wb ? 1.4 : big ? 1.25 : 1;
    const col = v === 'laser' ? 0x7dffb0 : v === 'zap' ? 0xffe45a : 0xd58bff, core = 0xffffff;
    const outer = glowMat(col, 0.7), inner = glowMat(core, 0.95);
    env.sfx('growl');
    const s = strike(b, b.m.attack());
    // зарядка: искры стекаются в рот/глаз, пока идёт замах
    const from = mouthOf(b); let charging = true;
    let ct = 0;
    env.fx(dt => { if (charging) { ct += dt; from.copy(mouthOf(b)); vfx.charge(from, col, dt, 1.3 * bk); const z = 0.5 + Math.min(1, ct / 0.25); vfx.emit(CELL.GLARE, from.x, from.y, from.z, 0, 0, 0, z, z, Math.max(0.05, dt * 1.6), { c: col, w: 0.3, gain: 1.1, a: 0.8, atk: 0.01, fp: 0.5 }); } return charging; });
    await within(s.released, 2.5); charging = false;
    env.guard(true); env.sfx(v === 'zap' ? 'crit' : v === 'laser' ? 'energy' : 'hint');
    vfx.glow(from, col, 3 * bk, 0.3);
    const D = big ? 0.5 : 0.34, pts = v === 'zap' ? 8 : v === 'magic' ? 10 : 2, P: THREE.Vector3[] = Array.from({ length: pts }, () => new V3());
    let t = 0, ts = 0, tj = 0; const to = new V3();
    const off = P.map(() => new V3());
    env.fx(dt => {
      t += dt; ts -= dt; tj -= dt; const u = t / D;
      mouthOf(b, from); to.copy(HIT); if (big) to.y += Math.sin(u * Math.PI * 2) * 0.55 * K;
      if (tj <= 0) { tj = v === 'zap' ? 0.04 : 1; for (const o of off) o.set(0, rnd(-1, 1), rnd(-0.5, 0.5)); }
      for (let i = 0; i < pts; i++) {
        const f = i / (pts - 1); P[i].lerpVectors(from, to, f);
        if (v === 'zap') { const e = Math.sin(f * Math.PI) * 0.45; P[i].y += off[i].y * e; P[i].z += off[i].z * e; }
        else if (v === 'magic') { const e = Math.sin(f * Math.PI); P[i].y += Math.sin(f * 14 - t * 30) * 0.22 * e; P[i].z += Math.cos(f * 14 - t * 30) * 0.15 * e; }
      }
      const pulse = 0.8 + 0.2 * Math.sin(t * 60), fade = u < 0.15 ? u / 0.15 : u > 0.8 ? Math.max(0, (1 - u) / 0.2) : 1;
      const wOut = (v === 'zap' ? 0.2 : v === 'magic' ? 0.36 : 0.55) * bk * pulse * fade, wIn = wOut * (v === 'zap' ? 0.35 : 0.4);
      (outer as THREE.MeshBasicMaterial).opacity = 0.75 * fade; (inner as THREE.MeshBasicMaterial).opacity = 0.9 * fade;
      for (let i = 0; i < pts - 1; i++) { lay(segment(i, outer), P[i], P[i + 1], wOut); lay(segment(pts + i, inner), P[i], P[i + 1], wIn); }
      if (ts <= 0) { ts = 0.06; sparkle(SPARK, col); vfx.glow(from, col, 1.4, 0.12); shake(0.1); }
      if (v === 'magic') for (let k = 0; k < 2; k++) { const q = P[(Math.random() * pts) | 0]; vfx.emit(k ? CELL.STAR4 : CELL.STAR_S, q.x, q.y, q.z, rnd(-0.5, 0.5), rnd(-0.5, 0.8), 0, 0.4, 0.05, rnd(0.25, 0.4), { c: k ? 0xffffff : col, w: 0.3, gain: 1.2, spin: rnd(-4, 4), k: 1.2 }); }
      if (t >= D) { hideSegs(); return false; }
      return true;
    });
    await env.wait(0.05); c.blk({ c2: col, power: big ? 1.4 : 1, at: SPARK });
    await env.wait(D - 0.05);
    hideSegs();
    await c.end(s.done);
  }

  const STYLE_FN: Record<Style, (c: Ctx) => Promise<void>> = { fire, wisp, slam, dash, ice, needles, smash, spore, water, beam };

  return {
    /** Один ход врага. Промис — когда всё доиграло (блоки героя и клип монстра); тело монстра возвращается на место в любом случае. */
    async run(b: Body) {
      const atk = attackOf(b.id), blocks: Promise<void>[] = []; let first = true;
      const g = b.m.a.g, x0 = g.position.x, z0 = g.position.z; SC = g.scale.x;
      const c: Ctx = { b, a: b.m.a, g, big: b.boss, wb: b.wb, v: atk.v,
        blk: o => { blocks.push(env.block({ ...o, text: first })); first = false; },
        end: (...more) => Promise.all([...blocks, ...more]).then(() => {}) };
      try { await STYLE_FN[atk.style](c); }
      finally {
        hideSegs(); g.position.x = x0; g.position.z = z0; g.rotation.y = -Math.PI / 2; b.dy = 0; g.scale.setScalar(SC); phase(b, false);
        if (b.m.a.baseName() !== b.m.idle) b.m.a.loop(b.m.idle, 0.12);
      }
    },
    dispose() {
      for (const s of seg) if (s) scene.remove(s);
      seg.length = 0; gBox?.dispose(); gOct?.dispose(); gSph?.dispose(); gBox = gOct = gSph = null;
      for (const m of mats.values()) m.dispose(); mats.clear();
    },
  };
}
export type Attacks = ReturnType<typeof createAttacks>;
