// Выстрелы героя: лук со стрелой, бросок, магический шар. Один код на тренировку (train_hero.ts: стрельбище) и на бой (arena.ts: удар на расстоянии).
// Модуль не крутит своего кадрового цикла и не знает про уроки и бой: арена и тренировка дают «ручки» (ShotEnv) и свои ожидания (ShotCtl),
// а попадание сообщается колбэком onLand в тот момент, когда снаряд долетел. Если ожидания оборваны (alive() = false: уход с экрана, смена урока),
// снаряд сразу убирается, колбэк попадания не вызывается (вместо него onCancel), лук из рук убирается.
import * as THREE from 'three';
import type { Actor } from './actor';
import type { Vfx } from './vfx';
import type { Sfx } from '../lib/audio';
import { bowLoadout, holdBow, type Bow } from './hero_props';

export type ShotKind = 'bow' | 'throw' | 'magic';
/** Клипы выстрелов: их стоит прогреть (привязать кости) заранее. */
export const SHOT_CLIPS = ['Ranged_Bow_Draw', 'Ranged_Bow_Release', 'Ranged_Magic_Shoot', 'Throw'];

export interface ShotEnv {
  scene: THREE.Scene; vfx: Vfx; sfx(n: Sfx): void;
  /** Покадровый обработчик (dt с замедлением); false — убрать. */
  fx(u: (dt: number) => boolean): void;
}
/** Ожидания вызывающего: у тренировки и боя разные токены отмены. */
export interface ShotCtl {
  /** false — выстрел оборван (уход с экрана): всё, что в полёте, убирается. */
  alive(): boolean;
  /** Ждать конец анимации или отмену. */
  wait(p: Promise<unknown>): Promise<unknown>;
  /** Ждать не дольше s секунд игрового времени или отмену. */
  within(p: Promise<unknown>, s: number): Promise<unknown>;
  /** Пауза s секунд игрового времени (отмена обрывает). */
  pause(s: number): Promise<unknown>;
}
export interface ShotOpts {
  kind: ShotKind;
  /** Лук (из prepare); у остальных видов не нужен. */
  bow?: Bow | null;
  /** Куда летит снаряд (мировая точка). */
  to: THREE.Vector3;
  /** Снаряд пролетает мимо: стрела не втыкается. Колбэк попадания вызывается и при промахе (вызывающий сам отличает). */
  miss?: boolean;
  /** Цвет шара (магия, бросок). */
  color?: number;
  /** Темп: 1 — как на тренировке, больше — быстрее (бой). */
  k?: number;
  /** Как долго воткнувшаяся стрела остаётся, с. */
  stick?: number;
  /** Снаряд долетел. */
  onLand(): void;
  /** Снаряд убран, не долетев (выстрел оборван). */
  onCancel?(): void;
}

export function createShots(env: ShotEnv) {
  let bowP: Promise<Bow> | null = null;
  const orbGeo = new THREE.SphereGeometry(0.28, 12, 10);
  // снаряды в полёте: clear() убирает их из сцены сразу (арена на другом экране кадры не гоняет, оборванный снаряд иначе висел бы до возвращения)
  const live = new Set<THREE.Object3D>();
  const loadBow = () => (bowP ??= bowLoadout().catch(e => { bowP = null; throw e; }));

  /** Какой снаряд на самом деле: лук не загрузился (нет набора items), вместо него бросок. */
  async function prepare(kind: ShotKind): Promise<{ kind: ShotKind; bow: Bow | null }> {
    if (kind !== 'bow') return { kind, bow: null };
    try { return { kind, bow: await loadBow() }; } catch { return { kind: 'throw', bow: null }; }
  }

  /** Светящаяся сфера с ореолом; летит по прямой или дугой; убирается, если выстрел оборван. */
  function orb(color: number, size: number, from: THREE.Vector3, to: THREE.Vector3, dur: number, arc: number, alive: () => boolean, onEnd: () => void, onCancel?: () => void) {
    const core = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).lerp(new THREE.Color(0xffffff), 0.35), toneMapped: false });
    const halo = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    const m = new THREE.Mesh(orbGeo, core), h2 = new THREE.Mesh(orbGeo, halo); h2.scale.setScalar(1.7); m.add(h2); m.scale.setScalar(size);
    m.position.copy(from); env.scene.add(m); live.add(m);
    let u = 0; const p = new THREE.Vector3();
    const done = () => { env.scene.remove(m); live.delete(m); core.dispose(); halo.dispose(); };
    env.fx(dt => {
      if (!alive()) { done(); onCancel?.(); return false; }
      u = Math.min(1, u + dt / dur); p.lerpVectors(from, to, u); p.y += Math.sin(u * Math.PI) * arc; m.position.copy(p);
      m.scale.setScalar(size * (1 + 0.12 * Math.sin(u * 40)));
      env.vfx.magicTrail(p, color, dt);
      if (u >= 1) { done(); onEnd(); return false; }
      return true;
    });
  }
  /** Стрела воткнулась: постоит миг и исчезнет. */
  function stuck(a: THREE.Object3D, life: number, alive: () => boolean) {
    live.add(a);
    env.fx(dt => { life -= dt; if (!alive() || life <= 0) { env.scene.remove(a); live.delete(a); return false; } return true; });
  }
  /** Невидимая «пустышка» для прогрева: лук, стрела, шар и их материалы создаются заранее (на несколько кадров, микроскопическими), первый выстрел не подтормаживает. */
  function warm(at: THREE.Vector3, alive: () => boolean) {
    loadBow().then(L => {
      if (!alive()) return;
      const g = new THREE.Group(); g.scale.setScalar(0.001); g.position.copy(at); g.add(L.bow, L.arrow, L.flying()); env.scene.add(g);
      orb(0x35e6ff, 0.001, g.position, g.position, 0.05, 0, alive, () => {});
      let n = 0; env.fx(() => { if (++n < 4 && alive()) return true; env.scene.remove(g); return false; });
    }).catch(() => {});
  }

  /** Один выстрел: анимация героя, снаряд, попадание (onLand). Промис — когда герой закончил (в стойку возвращает вызывающий). */
  async function fire(h: Actor, o: ShotOpts, c: ShotCtl): Promise<void> {
    const { kind, to, miss = false } = o, k = o.k ?? 1, tp = to;
    const hand = (slot: string) => { const v = new THREE.Vector3(); (h.bone(slot) ?? h.model).getWorldPosition(v); return v; };
    const land = () => o.onLand();
    let launched: () => void = () => {}; const rel = new Promise<void>(r => (launched = r));
    if (kind === 'bow' && o.bow) {
      const L = o.bow;
      holdBow(h, L, false);
      try {
        await c.wait(h.play('Ranged_Bow_Draw', { speed: 1.7 * k, hold: true, marks: [{ at: 0.3, fn: () => { if (c.alive()) holdBow(h, L, true); } }] })); if (!c.alive()) return;
        let flight: () => void = () => {}; const flew = new Promise<void>(r => (flight = r));
        void h.play('Ranged_Bow_Release', { speed: 2 * k, marks: [{ at: 0.12, fn: () => {
          if (!c.alive()) { o.onCancel?.(); launched(); flight(); return; }
          holdBow(h, L, false); env.sfx('slash');
          const from = hand('handslot.l'), dir = new THREE.Vector3().subVectors(tp, from).normalize(), a = L.flying();
          a.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir); env.scene.add(a); live.add(a);
          const q = new THREE.Vector3(), q2 = new THREE.Vector3(); let u = 0; const dist = from.distanceTo(tp), dur = Math.max(0.25 / k, dist / (16 * k)), p0 = from.clone();
          const at = (v: number, out: THREE.Vector3) => { out.lerpVectors(p0, tp, v); out.y += Math.sin(v * Math.PI) * 0.35; return out; };
          env.fx(dt => {
            if (!c.alive()) { env.scene.remove(a); live.delete(a); o.onCancel?.(); flight(); return false; }
            u = Math.min(1, u + dt / dur); at(u, q); a.position.copy(q);
            at(Math.min(1, u + 0.03), q2); if (q2.distanceToSquared(q) > 1e-6) a.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), q2.sub(q).normalize());
            if (u >= 1) { land(); if (miss) { env.scene.remove(a); live.delete(a); } else stuck(a, o.stick ?? 0.45, c.alive); flight(); return false; }
            return true;
          });
          launched();
        } }] });
        await c.within(rel, 2); await c.within(flew, 2);
        await c.pause(h.length('Ranged_Bow_Release', 2 * k) * 0.4);
      } finally { if (c.alive()) h.carry([]); }
    } else if (kind === 'magic') {
      const col = o.color ?? 0x35e6ff;
      let flight: () => void = () => {}; const flew = new Promise<void>(r => (flight = r));
      void h.play('Ranged_Magic_Shoot', { speed: 1.4 * k, marks: [{ at: 0.3, fn: () => {
        if (!c.alive()) { o.onCancel?.(); launched(); flight(); return; }
        env.sfx('crystal'); const from = hand('handslot.r'); env.vfx.glow(from, 0x7ff0ff, 2, 0.3);
        orb(col, 0.75, from, tp, Math.max(0.3 / k, from.distanceTo(tp) / (14 * k)), 0.25, c.alive, () => { land(); flight(); }, () => { o.onCancel?.(); flight(); }); launched();
      } }] });
      await c.within(rel, 2); await c.within(flew, 2);
      await c.pause(h.length('Ranged_Magic_Shoot', 1.4 * k) * 0.35);
    } else {
      const col = o.color ?? 0xffcb2e;
      let flight: () => void = () => {}; const flew = new Promise<void>(r => (flight = r));
      void h.play('Throw', { speed: 1.6 * k, marks: [{ at: 0.4, fn: () => {
        if (!c.alive()) { o.onCancel?.(); launched(); flight(); return; }
        env.sfx('slash'); const from = hand('handslot.r');
        orb(col, 0.6, from, tp, 0.3 / k, 0.5, c.alive, () => { land(); flight(); }, () => { o.onCancel?.(); flight(); }); launched();
      } }] });
      await c.within(rel, 2); await c.within(flew, 2);
      await c.pause(h.length('Throw', 1.6 * k) * 0.5);
    }
  }

  return { prepare, fire, warm, orb, clear() { for (const o of live) env.scene.remove(o); live.clear(); }, dispose() { orbGeo.dispose(); } };
}
export type Shots = ReturnType<typeof createShots>;

/** Вид приёма темы (content/techniques.mjs): от него зависит, чем герой ответит. */
export type TechFx = 'arc' | 'pierce' | 'split' | 'multi' | 'spin';
/** Каким ударом ответить на верный ответ: вид выстрела или null (мечом). Выпад и «колющие» приёмы чаще стреляют из лука, вихрь и двойной удар чаще магией,
 *  разрез всегда мечом, обычный удар иногда бросает или стреляет по кругу. Два выстрела подряд не больше (потом меч), удар с серией без приёма всегда мечом.
 *  hist — вид прошлых ударов (null — меч), rnd — случайность (в тестах подменяется). */
export function pickShot(fx: TechFx, rnd: () => number, hist: (ShotKind | null)[], crit = false, cyc = 0): ShotKind | null {
  if (hist.length >= 2 && hist[hist.length - 1] && hist[hist.length - 2]) return null;
  const r = rnd();
  if (fx === 'pierce') return r < 0.65 ? 'bow' : r < 0.75 ? 'throw' : null;
  if (fx === 'spin') return r < 0.6 ? 'magic' : null;
  if (fx === 'multi') return r < 0.45 ? 'magic' : r < 0.6 ? 'throw' : null;
  if (fx === 'arc' && !crit) return r < 0.35 ? (['throw', 'bow', 'magic'] as const)[cyc % 3] : null;
  return null;
}
