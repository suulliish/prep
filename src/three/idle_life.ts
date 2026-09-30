// Живое ожидание боя: пока ребёнок читает задачу и думает, герой и монстр не стоят истуканами. Раз в 3–6 с (при «уменьшить движение» раз в 8–12 с)
// один из них, по очереди и никогда оба сразу, делает одно СПОКОЙНОЕ действие и возвращается в стойку: вдох, перенос веса, взгляд в камеру, поправил щит,
// покрутил мечом; у монстра покачался, оглянулся, зевнул, кивнул, подпрыгнул на месте, а летающий описал петлю (docs/GAME_LOOP.md 15: игра против спешки).
// Ничего похожего на замах, атаку или таймер: нет звуков, нет рывков к герою, монстр не сдвигается с места, все движения плавные.
// Модуль молчит, пока идёт любое действие боя (удар, атака врага, появление, смерть, катсцена, эмоция урока, щит) и ещё 1.5 с после него.
// Ничего не трогает, кроме смещений самой модели (Actor.model: поза, поворот, масштаб) и поворота оружия в руке: группа актёра (g) и тайминги боя не задеты.
import * as THREE from 'three';
import type { Actor, MonsterClass } from './actor';

export type Who = 'hero' | 'mob';
export interface IdleMob { a: Actor; cls: MonsterClass }
export interface IdleDeps {
  hero: () => Actor | null;
  /** Оружие в правой руке героя (для прокрута кистью). */
  weapon: () => THREE.Object3D | null;
  /** Живой враг (не в появлении и не в смерти) или null. */
  mob: () => IdleMob | null;
  /** true — идёт что-то из боя (удар, атака, появление, смерть, катсцена, эмоция урока, щит): живое ожидание молчит. */
  quiet: () => boolean;
  /** Коэффициент движения арены: меньше 1 — «уменьшить движение». */
  km: () => number;
  rnd?: () => number;
}

/** Смещения модели относительно её обычной позы (дельты; все нули = стойка). Длины в метрах мира. x — вбок, y — вверх, z — вперёд. */
interface Off { x: number; y: number; z: number; rx: number; ry: number; rz: number; sx: number; sy: number; sz: number; wx: number; wy: number; wz: number }
const zero = (o: Off) => { o.x = o.y = o.z = o.rx = o.ry = o.rz = o.sx = o.sy = o.sz = o.wx = o.wy = o.wz = 0; };
const newOff = (): Off => { const o = {} as Off; zero(o); return o; };

interface Env { u: number; amp: number; sgn: number; o: Off }
interface Act { name: string; who: Who; dur: number; fx?: (e: Env) => void; clip?: [string, number]; bold?: boolean; cls?: MonsterClass[]; weapon?: boolean }

const PI = Math.PI, TAU = Math.PI * 2;
const sm = (x: number) => { x = x < 0 ? 0 : x > 1 ? 1 : x; return x * x * (3 - 2 * x); };
/** Плавный подъём в начале и спад в конце, между ними полка (a, b — доли действия). */
const hold = (u: number, a = 0.3, b = a) => sm(u / a) * sm((1 - u) / b);
const bump = (u: number) => Math.sin(PI * u);

/** Что можно каждому. Клипы — только из тех, что реально есть у моделей (Quaternius: Yes/No/Wave/Dance; KayKit: Melee_Blocking); остальное — код (наклон, покачивание, поворот). */
export const ACTS: Act[] = [
  // ---- герой (меч и щит остаются в руках: клипы боевые, не UNARMED в actor.ts) ----
  { name: 'breath', who: 'hero', dur: 2.6, fx: ({ u, amp, o }) => { const e = bump(u) * amp; o.sy = 0.045 * e; o.sx = o.sz = -0.018 * e; o.rx = -0.04 * e; } },
  { name: 'shift', who: 'hero', dur: 3.0, fx: ({ u, amp, sgn, o }) => { const e = hold(u) * amp; o.rz = 0.085 * sgn * e; o.x = 0.08 * sgn * e; o.y = -0.04 * e; } },
  { name: 'glance', who: 'hero', dur: 3.2, fx: ({ u, amp, o }) => { const e = hold(u) * amp; o.ry = -0.85 * e; o.rx = 0.04 * e; } },
  { name: 'sigh', who: 'hero', dur: 2.8, fx: ({ u, amp, o }) => { const e = bump(u) * amp; o.y = -0.05 * e; o.rx = 0.11 * e; o.sy = -0.015 * e; } },
  { name: 'shield', who: 'hero', dur: 0, clip: ['Melee_Blocking', 0.75], bold: true },
  { name: 'flourish', who: 'hero', dur: 1.7, bold: true, weapon: true, fx: ({ u, amp, o }) => { const e = hold(u, 0.25) * amp; o.wz = 0.45 * Math.sin(u * TAU * 1.5) * e; o.wy = TAU * sm(u) * amp; o.wx = 0.15 * e; } },
  // ---- монстр ----
  { name: 'nod', who: 'mob', dur: 0, clip: ['Yes', 0.75] },
  { name: 'shake', who: 'mob', dur: 0, clip: ['No', 0.7] },
  { name: 'wave', who: 'mob', dur: 0, clip: ['Wave', 0.75], bold: true, cls: ['Big'] },
  { name: 'dance', who: 'mob', dur: 0, clip: ['Dance', 0.55], bold: true, cls: ['Blob'] },
  { name: 'look', who: 'mob', dur: 3.4, fx: ({ u, amp, sgn, o }) => { o.ry = 0.5 * sgn * amp * Math.sin(u * TAU) * bump(u); } },
  { name: 'peek', who: 'mob', dur: 3.0, fx: ({ u, amp, o }) => { const e = hold(u) * amp; o.ry = 0.5 * e; o.rz = 0.04 * e; } },
  { name: 'sway', who: 'mob', dur: 2.8, fx: ({ u, amp, o }) => { o.rz = 0.085 * amp * Math.sin(u * 2 * TAU) * bump(u); } },
  { name: 'yawn', who: 'mob', dur: 3.0, fx: ({ u, amp, o }) => { const e = hold(u, 0.35) * amp; o.rx = -0.2 * e; o.sy = 0.05 * e; o.y = 0.03 * e; } },
  { name: 'sniff', who: 'mob', dur: 2.4, fx: ({ u, amp, o }) => { const e = amp * bump(u); o.rx = 0.13 * e * Math.sin(u * 2 * TAU) ** 2; o.z = 0.05 * e; } },
  { name: 'scratch', who: 'mob', dur: 1.1, bold: true, fx: ({ u, amp, o }) => { o.rz = 0.07 * amp * Math.sin(u * 7 * TAU) * bump(u) ** 0.7; o.ry = 0.05 * amp * Math.sin(u * 5 * TAU) * bump(u); } },
  { name: 'hop', who: 'mob', dur: 1.05, bold: true, cls: ['Blob', 'Big'], fx: ({ u, amp, o }) => { const v = Math.abs(Math.sin(u * TAU)); o.y = 0.13 * v * amp; o.sy = -0.05 * (1 - v) * bump(u) * amp; o.sx = o.sz = -o.sy * 0.6; } },
  // петля в плоскости кадра, уходящая от героя (вверх, назад, вниз, на место): к герою не приближается
  { name: 'loop', who: 'mob', dur: 3.0, bold: true, cls: ['Flying'], fx: ({ u, amp, o }) => { const e = hold(u, 0.2) * amp, a = u * TAU; o.y = 0.3 * e * Math.sin(a); o.z = -0.25 * e * (1 - Math.cos(a)); o.rx = -0.4 * e * Math.sin(a); } },
  { name: 'bob', who: 'mob', dur: 2.6, cls: ['Flying'], fx: ({ u, amp, o }) => { o.y = 0.14 * amp * Math.sin(u * 2 * TAU) * bump(u); o.rz = 0.05 * amp * Math.sin(u * TAU) * bump(u); } },
];

// столько секунд после любого действия боя ничего не происходит
const CALM = 1.5;
// обрыв действия: поза плавно возвращается в стойку за столько секунд
const FADE = 0.18;
// раз в 3–6 с
const BASE = 3, SPAN = 3;
// «уменьшить движение»: раз в 8–12 с
const RBASE = 8, RSPAN = 4;

interface Rig { a: Actor; w: THREE.Object3D | null; p: THREE.Vector3; q: THREE.Quaternion; s: THREE.Vector3; wq: THREE.Quaternion; o: Off; fade: number }
interface Run { act: Act; rig: Rig; t: number; dur: number; sgn: number; clip: boolean }

const E = new THREE.Euler(0, 0, 0, 'YXZ'), EW = new THREE.Euler(0, 0, 0, 'XYZ'), Q = new THREE.Quaternion();

/** Пробник для проверок: кто и что делает (dev-страница, тесты). В игре не задан. */
export const idleTrace: { fn: ((who: Who, act: string, dur: number) => void) | null } = { fn: null };

export function createIdleLife(d: IdleDeps) {
  const rnd = d.rnd ?? Math.random;
  let cur: Run | null = null, calm = 0, wait = 1, last: Who | null = null;
  const lastAct: Record<Who, string> = { hero: '', mob: '' };
  const rigs = new WeakMap<Actor, Rig>();
  const fading = new Set<Rig>();
  const reduced = () => d.km() < 0.99;

  function rigOf(a: Actor, w: THREE.Object3D | null): Rig {
    let r = rigs.get(a);
    if (!r) { r = { a, w: null, p: a.model.position.clone(), q: a.model.quaternion.clone(), s: a.model.scale.clone(), wq: new THREE.Quaternion(), o: newOff(), fade: 0 }; rigs.set(a, r); }
    if (w && r.w !== w) { r.w = w; r.wq.copy(w.quaternion); }
    return r;
  }
  /** Поза = обычная + смещения (в долях k). Смещения в метрах мира переводятся в единицы модели (у группы актёра свой масштаб). */
  function apply(r: Rig, k: number) {
    const m = r.a.model, o = r.o, sc = k / (r.a.g.scale.y || 1);
    m.position.set(r.p.x + o.x * sc, r.p.y + o.y * sc, r.p.z + o.z * sc);
    m.quaternion.copy(r.q).multiply(Q.setFromEuler(E.set(o.rx * k, o.ry * k, o.rz * k)));
    m.scale.set(r.s.x * (1 + o.sx * k), r.s.y * (1 + o.sy * k), r.s.z * (1 + o.sz * k));
    if (r.w) r.w.quaternion.copy(r.wq).multiply(Q.setFromEuler(EW.set(o.wx * k, o.wy * k, o.wz * k)));
  }
  /** Вернуть модель ровно в исходную позу. */
  function settle(r: Rig) {
    zero(r.o); r.fade = 0; fading.delete(r);
    r.a.model.position.copy(r.p); r.a.model.quaternion.copy(r.q); r.a.model.scale.copy(r.s);
    if (r.w) r.w.quaternion.copy(r.wq);
  }
  const actorOf = (w: Who) => (w === 'hero' ? d.hero() : d.mob()?.a) ?? null;

  /** Оборвать действие. hard — сразу в стойку, иначе поза плавно возвращается (FADE). Клип, если играл, уступает базовой анимации. */
  function stop(hard = false) {
    calm = 0; wait = Math.min(wait, (reduced() ? RBASE * 0.4 : BASE * 0.4) + rnd());
    const c = cur; cur = null;
    if (c) {
      const same = actorOf(c.act.who) === c.rig.a;
      if (c.clip && same && c.t < c.dur) { const b = c.rig.a.baseName(); if (b) void c.rig.a.play(b, { loop: true, fade: 0.1 }); }
      if (hard || !same) settle(c.rig); else { c.rig.fade = FADE; fading.add(c.rig); }
    }
    if (hard) for (const r of [...fading]) settle(r);
  }

  function pick(): { act: Act; a: Actor } | null {
    const h = d.hero(), m = d.mob(), red = reduced();
    const ws: Who[] = []; if (h) ws.push('hero'); if (m) ws.push('mob');
    if (!ws.length) return null;
    const who: Who = ws.length === 1 ? ws[0] : last && rnd() < 0.7 ? (last === 'hero' ? 'mob' : 'hero') : rnd() < 0.5 ? 'hero' : 'mob';
    const a = who === 'hero' ? h! : m!.a;
    const ok = ACTS.filter(x => x.who === who && !(red && x.bold) && (!x.cls || (m && x.cls.includes(m.cls))) && (!x.clip || a.has(x.clip[0])) && (!x.weapon || d.weapon()) && x.name !== lastAct[who]);
    if (!ok.length) return null;
    return { act: ok[Math.min(ok.length - 1, Math.floor(rnd() * ok.length))], a };
  }

  function start(p: { act: Act; a: Actor }) {
    const { act, a } = p, red = reduced();
    const rig = rigOf(a, act.weapon ? d.weapon() : null);
    if (rig.fade > 0) settle(rig);
    let dur = act.dur;
    if (act.clip) { const sp = act.clip[1] * (red ? 0.85 : 1); dur = a.length(act.clip[0], sp) + 0.15; void a.play(act.clip[0], { speed: sp, fade: 0.2 }); }
    cur = { act, rig, t: 0, dur, sgn: rnd() < 0.5 ? -1 : 1, clip: !!act.clip };
    last = act.who; lastAct[act.who] = act.name;
    wait = Math.max(0.8, (red ? RBASE + rnd() * RSPAN : BASE + rnd() * SPAN) - dur);
    idleTrace.fn?.(act.who, act.name, dur);
  }

  function update(dt: number) {
    dt = Math.min(dt, 0.1);
    for (const r of fading) { r.fade -= dt; if (r.fade <= 0) settle(r); else apply(r, r.fade / FADE); }
    if (d.quiet()) { if (cur || calm > 0) stop(); calm = 0; return; }
    calm += dt;
    const c = cur;
    if (c) {
      const same = actorOf(c.act.who) === c.rig.a;
      if (!same) { cur = null; settle(c.rig); return; }
      c.t += dt;
      if (c.t >= c.dur) { cur = null; settle(c.rig); return; }
      const o = c.rig.o; zero(o);
      c.act.fx?.({ u: c.t / c.dur, amp: reduced() ? 0.5 : 1, sgn: c.sgn, o });
      apply(c.rig, 1);
      return;
    }
    if (calm < CALM) return;
    wait -= dt;
    if (wait > 0) return;
    const p = pick(); if (p) start(p); else wait = 1;
  }

  return {
    update,
    stop,
    /** Название идущего действия (для проверок). */
    active: () => (cur ? cur.act.name : null),
    dispose() { stop(true); },
  };
}
export type IdleLife = ReturnType<typeof createIdleLife>;
