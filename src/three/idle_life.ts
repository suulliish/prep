// Живое ожидание боя: пока ребёнок читает задачу и думает, герой и монстр не стоят истуканами. Каждые 2.6–4.8 с (при «уменьшить движение» раз в 8–12 с)
// один из них, по очереди и никогда оба сразу, делает одно СПОКОЙНОЕ действие и возвращается в стойку, разные подряд (повтор прошлого запрещён).
// Герой: боевая стойка со щитом перед собой (клип Melee_2H_Idle), низкая стойка (Crouching), переминание, лёгкие подскоки на носках, оглядывание, потягивание,
// вдох, перенос веса, поправил щит, покрутил и постучал мечом. Монстр: переминание, боевое покачивание, рык вверх (в сторону от героя, без звука), оглядывание,
// принюхивание, зевок, кивок, наклон головы, подпрыгнул на месте, а летающий описывает петлю, дрейфует, трепещет (docs/GAME_LOOP.md 15: игра против спешки).
// Ничего похожего на замах, атаку или таймер: нет звуков, нет рывков к сопернику, монстр не сдвигается с места, все движения плавные, оружие герой не поднимает на врага.
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
  /** Идёт тренировка (урок): паузы 5–8 с, среди действий героя добавляется бой с тенью без оружия. */
  training?: () => boolean;
  rnd?: () => number;
}

/** Смещения модели относительно её обычной позы (дельты; все нули = стойка). Длины в метрах мира. x — вбок, y — вверх, z — вперёд. */
interface Off { x: number; y: number; z: number; rx: number; ry: number; rz: number; sx: number; sy: number; sz: number; wx: number; wy: number; wz: number }
const zero = (o: Off) => { o.x = o.y = o.z = o.rx = o.ry = o.rz = o.sx = o.sy = o.sz = o.wx = o.wy = o.wz = 0; };
const newOff = (): Off => { const o = {} as Off; zero(o); return o; };

interface Env { u: number; amp: number; sgn: number; o: Off }
// seq — бой с тенью: стойка Melee_Unarmed_Idle, затем клипы по очереди (без меча и щита), потом обычная стойка; train — только на тренировке
// stance — клип-цикл на время действия ([имя, скорость]), потом возвращается прежняя стойка; w — вес при выборе (по умолчанию 1)
interface Act { name: string; who: Who; dur: number; fx?: (e: Env) => void; clip?: [string, number]; stance?: [string, number]; bold?: boolean; cls?: MonsterClass[]; weapon?: boolean; seq?: string[]; train?: boolean; w?: number }

const PI = Math.PI, TAU = Math.PI * 2;
const sm = (x: number) => { x = x < 0 ? 0 : x > 1 ? 1 : x; return x * x * (3 - 2 * x); };
/** Плавный подъём в начале и спад в конце, между ними полка (a, b — доли действия). */
const hold = (u: number, a = 0.3, b = a) => sm(u / a) * sm((1 - u) / b);
const bump = (u: number) => Math.sin(PI * u);

/** Что можно каждому. Клипы — только из тех, что реально есть у моделей (Quaternius: Yes/No/Wave/Dance; KayKit: Melee_Blocking); остальное — код (наклон, покачивание, поворот). */
export const ACTS: Act[] = [
  // ---- герой (меч и щит остаются в руках: клипы боевые, не UNARMED в actor.ts) ----
  // Камера смотрит на бойцов сбоку: видны только наклон вперёд-назад (rx), подъём (y), движение вперёд-назад (z), поворот (ry) и вытягивание (sy, sz).
  // Крен (rz) и сдвиг вбок (x) идут на камеру и глазом не видны, их здесь нет. Герой в кадре ~70 px: смещение меньше 0.1 м (3 px) не заметно, тут 0.1–0.25 м и наклоны 0.15–0.3 рад
  { name: 'breath', who: 'hero', dur: 2.2, w: 0.5, fx: ({ u, amp, o }) => { const e = bump(u) * amp; o.sy = 0.06 * e; o.sz = 0.03 * e; o.rx = -0.1 * e; } },
  // переносит вес вперёд-назад: корпус качнулся и вернулся
  { name: 'shift', who: 'hero', dur: 2.6, fx: ({ u, amp, sgn, o }) => { const e = bump(u) * amp; o.rx = 0.2 * sgn * Math.sin(u * TAU) * e; o.y = -0.05 * e; } },
  { name: 'glance', who: 'hero', dur: 2.8, fx: ({ u, amp, o }) => { const e = hold(u) * amp; o.ry = -0.85 * e; o.rx = 0.06 * e; } },
  { name: 'sigh', who: 'hero', dur: 2.4, w: 0.5, fx: ({ u, amp, o }) => { const e = bump(u) * amp; o.y = -0.1 * e; o.rx = 0.22 * e; o.sy = -0.03 * e; } },
  { name: 'shield', who: 'hero', dur: 0, clip: ['Melee_Blocking', 0.75], bold: true },
  { name: 'flourish', who: 'hero', dur: 1.7, bold: true, weapon: true, fx: ({ u, amp, o }) => { const e = hold(u, 0.25) * amp; o.wz = 0.45 * Math.sin(u * TAU * 1.5) * e; o.wy = TAU * sm(u) * amp; o.wx = 0.15 * e; } },
  // боевая стойка: щит перед собой, руки у груди (клип Melee_2H_Idle), покачивание корпуса; меч и щит остаются в руках
  { name: 'ready', who: 'hero', dur: 3.4, w: 1.6, stance: ['Melee_2H_Idle', 1], fx: ({ u, amp, o }) => { const e = hold(u, 0.2) * amp; o.rx = 0.07 * e + 0.08 * Math.sin(u * 2 * TAU) * e; o.y = -0.05 * e; } },
  // низкая стойка: колени согнуты, меч низко (клип Crouching), чуть медленнее, с мягким покачиванием вперёд-назад
  { name: 'crouch', who: 'hero', dur: 2.6, bold: true, stance: ['Crouching', 0.8], fx: ({ u, amp, o }) => { const e = hold(u, 0.25) * amp; o.rx = 0.07 * Math.sin(u * 2 * TAU) * e; o.y = -0.04 * e; } },
  // переминание: два лёгких шага назад-вперёд на месте, корпус качается в такт
  { name: 'shuffle', who: 'hero', dur: 2.6, fx: ({ u, amp, o }) => { const e = amp * bump(u), s = Math.sin(u * 2 * TAU); o.z = -0.16 * e * (0.5 - 0.5 * Math.cos(u * 4 * PI)); o.rx = 0.12 * s * e; o.y = -0.05 * Math.abs(s) * e; } },
  // три подскока на носках (боксёрская разминка), на месте
  { name: 'bounce', who: 'hero', dur: 2.0, bold: true, fx: ({ u, amp, o }) => { const e = bump(u) * amp, v = Math.abs(Math.sin(u * 3 * PI)); o.y = 0.24 * v * e; o.sy = -0.06 * (1 - v) * e; o.sz = -o.sy * 0.5; } },
  // осматривается: взгляд в одну сторону, в другую, обратно
  { name: 'scan', who: 'hero', dur: 3.0, fx: ({ u, amp, sgn, o }) => { const e = bump(u) * amp; o.ry = 0.9 * sgn * Math.sin(u * TAU) * e; o.rx = -0.08 * e; } },
  // потягивается: корпус вытягивается вверх и чуть назад
  { name: 'stretch', who: 'hero', dur: 2.6, fx: ({ u, amp, o }) => { const e = hold(u, 0.35) * amp; o.y = 0.1 * e; o.rx = -0.22 * e; o.sy = 0.06 * e; } },
  // постукивает мечом: кисть качает клинок вперёд-назад дважды, меч не поднимается
  { name: 'tap', who: 'hero', dur: 1.8, weapon: true, fx: ({ u, amp, o }) => { const e = hold(u, 0.2) * amp; o.wx = 0.5 * Math.sin(u * 2 * TAU) * e; o.wz = 0.15 * e; } },
  { name: 'shadow', who: 'hero', dur: 3, train: true, seq: ['Melee_Unarmed_Attack_Punch_A', 'Melee_Unarmed_Attack_Kick'] },
  // ---- монстр ----
  { name: 'nod', who: 'mob', dur: 0, clip: ['Yes', 0.75] },
  { name: 'shake', who: 'mob', dur: 0, clip: ['No', 0.7] },
  { name: 'wave', who: 'mob', dur: 0, clip: ['Wave', 0.75], bold: true, cls: ['Big'] },
  { name: 'dance', who: 'mob', dur: 0, clip: ['Dance', 0.55], bold: true, cls: ['Blob'] },
  { name: 'look', who: 'mob', dur: 3.0, fx: ({ u, amp, sgn, o }) => { o.ry = 0.9 * sgn * amp * Math.sin(u * TAU) * bump(u); } },
  { name: 'peek', who: 'mob', dur: 2.6, fx: ({ u, amp, o }) => { const e = hold(u) * amp; o.ry = 0.8 * e; o.rx = -0.12 * e; } },
  { name: 'sway', who: 'mob', dur: 2.6, fx: ({ u, amp, o }) => { const e = bump(u) * amp; o.rx = 0.22 * Math.sin(u * 2 * TAU) * e; o.y = 0.04 * Math.abs(Math.sin(u * 2 * TAU)) * e; } },
  { name: 'yawn', who: 'mob', dur: 2.6, w: 0.7, fx: ({ u, amp, o }) => { const e = hold(u, 0.35) * amp; o.rx = -0.35 * e; o.sy = 0.06 * e; o.y = 0.05 * e; } },
  { name: 'sniff', who: 'mob', dur: 2.2, fx: ({ u, amp, o }) => { const e = amp * bump(u); o.rx = 0.3 * e * Math.sin(u * 2 * TAU) ** 2; o.z = 0.05 * e; } },
  { name: 'scratch', who: 'mob', dur: 1.1, bold: true, fx: ({ u, amp, o }) => { o.rx = 0.14 * amp * Math.sin(u * 7 * TAU) * bump(u) ** 0.7; o.ry = 0.1 * amp * Math.sin(u * 5 * TAU) * bump(u); } },
  { name: 'hop', who: 'mob', dur: 1.05, bold: true, cls: ['Blob', 'Big'], fx: ({ u, amp, o }) => { const v = Math.abs(Math.sin(u * TAU)); o.y = 0.3 * v * amp; o.sy = -0.07 * (1 - v) * bump(u) * amp; o.sz = -o.sy * 0.6; } },
  // переминание: два шага назад-вперёд на месте (от героя, не к нему), корпус покачивается в такт
  { name: 'shuffle', who: 'mob', dur: 2.6, cls: ['Blob', 'Big'], fx: ({ u, amp, o }) => { const e = amp * bump(u), s = Math.sin(u * 2 * TAU); o.z = -0.25 * e * (0.5 - 0.5 * Math.cos(u * 4 * PI)); o.rx = 0.14 * s * e; o.y = 0.05 * Math.abs(s) * e; } },
  // боевое покачивание: мягкие подпрыгивания в такт, сплющивание на приземлении (на месте, к герою не подаётся)
  { name: 'bounce', who: 'mob', dur: 2.2, bold: true, cls: ['Blob', 'Big'], fx: ({ u, amp, o }) => { const e = bump(u) * amp, v = Math.abs(Math.sin(u * 3 * PI)); o.y = 0.22 * v * e; o.sy = -0.07 * (1 - v) * e; o.sz = -o.sy * 0.6; o.rx = 0.07 * Math.sin(u * 3 * TAU) * e; } },
  // рык вверх: голова запрокидывается, грудь раздувается, дрожь; от героя, без звука (запрокинутая голова не нацелена на героя)
  { name: 'roar', who: 'mob', dur: 1.8, bold: true, cls: ['Blob', 'Big'], fx: ({ u, amp, o }) => { const e = hold(u, 0.25) * amp; o.rx = -0.45 * e + 0.04 * Math.sin(u * 9 * TAU) * e; o.sy = 0.07 * e; o.sz = 0.03 * e; o.y = 0.06 * e; } },
  // склонил голову набок и запрокинул: любопытство
  { name: 'tilt', who: 'mob', dur: 2.4, fx: ({ u, amp, sgn, o }) => { const e = hold(u, 0.3) * amp; o.ry = 0.55 * sgn * e; o.rx = -0.18 * e; } },
  // петля в плоскости кадра, уходящая от героя (вверх, назад, вниз, на место): к герою не приближается
  { name: 'loop', who: 'mob', dur: 3.0, bold: true, cls: ['Flying'], fx: ({ u, amp, o }) => { const e = hold(u, 0.2) * amp, a = u * TAU; o.y = 0.3 * e * Math.sin(a); o.z = -0.25 * e * (1 - Math.cos(a)); o.rx = -0.4 * e * Math.sin(a); } },
  { name: 'bob', who: 'mob', dur: 2.4, cls: ['Flying'], fx: ({ u, amp, o }) => { o.y = 0.25 * amp * Math.sin(u * 2 * TAU) * bump(u); o.rx = 0.1 * amp * Math.sin(u * TAU) * bump(u); } },
  // плавно отплывает назад (от героя) с поднятием и возвращается; к герою не приближается
  { name: 'drift', who: 'mob', dur: 3.0, cls: ['Flying'], fx: ({ u, amp, o }) => { const e = bump(u) * amp; o.z = -0.45 * e; o.y = 0.12 * e; o.rx = -0.15 * e; } },
  // трепещет: частое мелкое покачивание вверх-вниз и сжатие-растяжение
  { name: 'flutter', who: 'mob', dur: 1.6, bold: true, cls: ['Flying'], fx: ({ u, amp, o }) => { const e = bump(u) * amp, s = Math.sin(u * 8 * TAU); o.y = 0.1 * s * e; o.sy = 0.04 * s * e; o.sz = -0.02 * s * e; } },
];

// столько секунд после любого действия боя ничего не происходит
const CALM = 1.5;
// обрыв действия: поза плавно возвращается в стойку за столько секунд
const FADE = 0.18;
// раз в 2.6–4.8 с (от начала одного действия до начала следующего; между действиями пауза не короче MINWAIT)
const BASE = 2.6, SPAN = 2.2, MINWAIT = 0.6;
// «уменьшить движение»: раз в 8–12 с
const RBASE = 8, RSPAN = 4;

interface Rig { a: Actor; w: THREE.Object3D | null; p: THREE.Vector3; q: THREE.Quaternion; s: THREE.Vector3; wq: THREE.Quaternion; o: Off; fade: number }
interface Run { act: Act; rig: Rig; t: number; dur: number; sgn: number; clip: boolean; restore?: string; steps?: { at: number; clip: string; sp: number }[] }

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
      if (c.restore && same) void c.rig.a.play(c.restore, { loop: true, fade: 0.12 });
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
    const tr = !!d.training?.();
    const ok = ACTS.filter(x => x.who === who && !(red && x.bold) && (!x.train || tr) && (!x.seq || a.has('Melee_Unarmed_Idle')) && (!x.cls || (m && x.cls.includes(m.cls))) && (!x.clip || a.has(x.clip[0])) && (!x.stance || a.has(x.stance[0])) && (!x.weapon || d.weapon()) && x.name !== lastAct[who]);
    if (!ok.length) return null;
    // на тренировке бой с тенью — каждое второе действие героя (если прошлое было не оно)
    const sh = tr && who === 'hero' ? ok.find(x => x.train) : undefined;
    if (sh && rnd() < 0.5) return { act: sh, a };
    const rest = sh ? ok.filter(x => !x.train) : ok;
    // выбор с весами: боевая стойка чаще, вздохи и дыхание реже
    let r = rnd() * rest.reduce((t, x) => t + (x.w ?? 1), 0);
    for (const x of rest) { r -= x.w ?? 1; if (r < 0) return { act: x, a }; }
    return { act: rest[rest.length - 1], a };
  }

  function start(p: { act: Act; a: Actor }) {
    const { act, a } = p, red = reduced();
    const rig = rigOf(a, act.weapon ? d.weapon() : null);
    if (rig.fade > 0) settle(rig);
    let dur = act.dur, restore: string | undefined, steps: Run['steps'];
    if (act.seq) {
      const sp = 1.2 * (red ? 0.85 : 1); restore = a.baseName() || 'Idle_A'; steps = []; let at = 0.55;
      a.loop('Melee_Unarmed_Idle', 0.2);
      for (const c of act.seq) if (a.has(c)) { steps.push({ at, clip: c, sp }); at += a.length(c, sp) * 0.95; }
      dur = at + 0.3;
    }
    if (act.clip) { const sp = act.clip[1] * (red ? 0.85 : 1); dur = a.length(act.clip[0], sp) + 0.15; void a.play(act.clip[0], { speed: sp, fade: 0.2 }); }
    if (act.stance) { restore = a.baseName() || 'Idle_A'; a.loop(act.stance[0], 0.25, act.stance[1] * (red ? 0.85 : 1)); }
    cur = { act, rig, t: 0, dur, sgn: rnd() < 0.5 ? -1 : 1, clip: !!act.clip, restore, steps };
    last = act.who; lastAct[act.who] = act.name;
    wait = Math.max(red ? 0.8 : MINWAIT, (red ? RBASE + rnd() * RSPAN : d.training?.() ? 5 + rnd() * 3 : BASE + rnd() * SPAN) - dur);
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
      while (c.steps?.length && c.t >= c.steps[0].at) { const st = c.steps.shift()!; void c.rig.a.play(st.clip, { speed: st.sp, fade: 0.12 }); }
      if (c.t >= c.dur) { cur = null; settle(c.rig); if (c.restore) void c.rig.a.play(c.restore, { loop: true, fade: 0.2 }); return; }
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
