// Живое ожидание боя: раз в 3–6 с одно спокойное действие героя или монстра, никогда оба сразу; молчит во время боя и 1.5 с после; возвращается ровно в стойку.
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { Actor, type MonsterClass } from '../src/three/actor';
import { ACTS, createIdleLife, idleTrace, type IdleDeps, type Who } from '../src/three/idle_life';

// клипы двигают кость внутри модели (как в игре), а не саму модель: её позой правит только живое ожидание
const clip = (name: string, d = 1) => new THREE.AnimationClip(name, d, [new THREE.NumberKeyframeTrack('Bone.position[x]', [0, d], [0, 0.01])]);
const rng = (seed: number) => () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

/** Актёр как в игре: группа с масштабом, модель сдвинута на землю (sitOnGround), у героя оружие в руке. */
function actor(names: string[], scale = 1.4) {
  const model = new THREE.Object3D(); model.position.y = 0.37; model.scale.setScalar(1.05);
  const bone = new THREE.Object3D(); bone.name = 'Bone'; model.add(bone);
  const a = new Actor(model, names.map(n => clip(n, n === 'Idle_A' || n === 'Idle' || n === 'Flying_Idle' ? 1 : 1.2)));
  a.g.scale.setScalar(scale);
  return a;
}
const HERO_CLIPS = ['Idle_A', 'Melee_Blocking'];
const MOB_CLIPS: Record<MonsterClass, string[]> = { Blob: ['Idle', 'Yes', 'No', 'Dance'], Big: ['Idle', 'Yes', 'No', 'Wave'], Flying: ['Flying_Idle', 'Yes', 'No'] };

function setup(o: { cls?: MonsterClass; km?: number; seed?: number; noMob?: boolean } = {}) {
  const hero = actor(HERO_CLIPS); hero.loop('Idle_A', 0);
  const weapon = new THREE.Object3D(); weapon.quaternion.setFromEuler(new THREE.Euler(0.2, 0.1, 0)); hero.model.add(weapon);
  const cls = o.cls ?? 'Blob';
  const mob = actor(MOB_CLIPS[cls]); mob.loop(cls === 'Flying' ? 'Flying_Idle' : 'Idle', 0);
  const st = { quiet: false, km: o.km ?? 1, mob: o.noMob ? null : mob };
  const deps: IdleDeps = { hero: () => hero, weapon: () => weapon, mob: () => (st.mob ? { a: st.mob, cls } : null), quiet: () => st.quiet, km: () => st.km, rnd: rng(o.seed ?? 1) };
  const idle = createIdleLife(deps);
  const evs: { t: number; who: Who; act: string }[] = []; let t = 0;
  idleTrace.fn = (who, act) => evs.push({ t, who, act });
  const step = (s: number, per?: () => void) => { for (let i = 0; i < Math.round(s * 60); i++) { t += 1 / 60; hero.update(1 / 60); mob.update(1 / 60); idle.update(1 / 60); per?.(); } };
  return { hero, mob, weapon, idle, st, evs, step, now: () => t };
}
/** Насколько модель ушла от исходной позы (0 — ровно в стойке). */
const qd = (a: THREE.Quaternion, b: THREE.Quaternion) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y) + Math.abs(a.z - b.z) + Math.abs(a.w - b.w);
const drift = (a: Actor, p0: THREE.Vector3, q0: THREE.Quaternion, s0: THREE.Vector3) => a.model.position.distanceTo(p0) + qd(a.model.quaternion, q0) + a.model.scale.distanceTo(s0);
const snap = (a: Actor) => ({ p: a.model.position.clone(), q: a.model.quaternion.clone(), s: a.model.scale.clone() });

describe('живое ожидание: расписание', () => {
  it('молчит, пока идёт бой (quiet), и не двигает модели', () => {
    const w = setup(); const h0 = snap(w.hero), m0 = snap(w.mob), wq = w.weapon.quaternion.clone();
    w.st.quiet = true; w.step(60);
    expect(w.evs).toHaveLength(0);
    expect(drift(w.hero, h0.p, h0.q, h0.s) + drift(w.mob, m0.p, m0.q, m0.s)).toBe(0);
    expect(qd(w.weapon.quaternion, wq)).toBe(0);
  });

  it('первое действие не раньше чем через 1.5 с покоя', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const w = setup({ seed }); w.step(1.45); expect(w.evs, `seed ${seed}`).toHaveLength(0);
      w.step(10); expect(w.evs.length, `seed ${seed}`).toBeGreaterThan(0);
    }
  });

  it('после действия боя снова ждёт 1.5 с', () => {
    const w = setup(); w.step(8); const n = w.evs.length; expect(n).toBeGreaterThan(0);
    w.st.quiet = true; w.step(3); w.idle.stop(); w.st.quiet = false;
    const t0 = w.now(); w.step(1.4); expect(w.evs.length).toBe(n);
    w.step(12); expect(w.evs.length).toBeGreaterThan(n); expect(w.evs[n].t - t0).toBeGreaterThanOrEqual(1.5);
  });

  it('старт от старта: 3–6 с, «уменьшить движение» — 8–12 с', () => {
    for (const [km, lo, hi] of [[1, 3, 6.01], [0.3, 8, 12.01]] as const) {
      const w = setup({ km, seed: 7 }); w.step(400);
      const gaps = w.evs.slice(1).map((e, i) => e.t - w.evs[i].t);
      expect(gaps.length).toBeGreaterThan(20);
      expect(Math.min(...gaps), `km ${km}`).toBeGreaterThanOrEqual(lo - 0.02);
      expect(Math.max(...gaps), `km ${km}`).toBeLessThanOrEqual(hi);
    }
  });

  it('в очереди и герой, и монстр (не один и тот же всё время)', () => {
    const w = setup({ seed: 3 }); w.step(300);
    const c = { hero: 0, mob: 0 }; for (const e of w.evs) c[e.who]++;
    expect(c.hero).toBeGreaterThan(10); expect(c.mob).toBeGreaterThan(10);
    for (let i = 1; i < w.evs.length; i++) if (w.evs[i].who === w.evs[i - 1].who) expect(w.evs[i].act).not.toBe(w.evs[i - 1].act);
  });

  it('нет монстра: действует только герой', () => {
    const w = setup({ noMob: true }); w.step(120);
    expect(w.evs.length).toBeGreaterThan(5); expect(new Set(w.evs.map(e => e.who))).toEqual(new Set(['hero']));
  });
});

describe('живое ожидание: движение', () => {
  it('никогда не двигаются оба сразу, а после каждого действия модель ровно в стойке', () => {
    const w = setup({ seed: 5 }); const h0 = snap(w.hero), m0 = snap(w.mob), wq = w.weapon.quaternion.clone();
    let both = 0, moved = 0, prev: string | null = null;
    w.step(200, () => {
      const dh = drift(w.hero, h0.p, h0.q, h0.s) + qd(w.weapon.quaternion, wq), dm = drift(w.mob, m0.p, m0.q, m0.s);
      if (dh > 1e-9 && dm > 1e-9) both++; if (dh > 1e-9 || dm > 1e-9) moved++;
      const a = w.idle.active();
      if (prev && !a) { expect(dh).toBe(0); expect(dm).toBe(0); }   // действие кончилось: смещений нет
      prev = a;
    });
    expect(both).toBe(0); expect(moved).toBeGreaterThan(200);
    // всё время моделью правит только этот модуль: позиция и масштаб группы актёра не тронуты
    expect(w.hero.g.position.length() + w.mob.g.position.length()).toBe(0);
    expect(w.hero.g.scale.x).toBe(1.4); expect(w.mob.g.rotation.y).toBe(0);
  });

  it('смещения мелкие: не выше 0.35 м (петля летающего), повороты не больше 1 рад, масштаб в пределах 8%', () => {
    for (const cls of ['Blob', 'Big', 'Flying'] as const) {
      const w = setup({ cls, seed: 11 }); const h0 = snap(w.hero), m0 = snap(w.mob);
      let dy = 0, dxz = 0, ang = 0, sc = 0, toHero = 0;
      w.step(240, () => {
        for (const [a, s0] of [[w.hero, h0], [w.mob, m0]] as const) {
          const k = a.g.scale.y; dy = Math.max(dy, Math.abs(a.model.position.y - s0.p.y) * k);
          dxz = Math.max(dxz, Math.hypot(a.model.position.x - s0.p.x, a.model.position.z - s0.p.z) * k);
          toHero = Math.max(toHero, (a.model.position.z - s0.p.z) * k); ang = Math.max(ang, a.model.quaternion.angleTo(s0.q)); sc = Math.max(sc, Math.abs(a.model.scale.y / s0.s.y - 1));
        }
      });
      expect(dy, cls).toBeLessThan(0.35); expect(dxz, cls).toBeLessThan(0.55); expect(ang, cls).toBeLessThan(1); expect(sc, cls).toBeLessThan(0.08);
      // z — вперёд, к сопернику: ни герой, ни монстр не подаются к нему больше чем на ладонь
      expect(toHero, cls).toBeLessThan(0.1);
    }
  });

  it('«уменьшить движение»: без прыжков, петель, подёргиваний, взмахов; амплитуда вдвое меньше', () => {
    const bold = new Set(ACTS.filter(a => a.bold).map(a => a.name)); expect(bold.size).toBeGreaterThan(5);
    const peak = (km: number) => {
      const w = setup({ km, cls: 'Flying', seed: 2 }); const m0 = snap(w.mob), h0 = snap(w.hero); let a = 0;
      w.step(600, () => { a = Math.max(a, w.mob.model.quaternion.angleTo(m0.q), w.hero.model.quaternion.angleTo(h0.q)); });
      return { a, acts: new Set(w.evs.map(e => e.act)) };
    };
    const r = peak(0.3), n = peak(1);
    for (const x of r.acts) expect(bold.has(x), x).toBe(false);
    expect(r.a).toBeLessThan(n.a * 0.65);
  });

  it('классы: у каждого только то, что ему по клипам и роду можно', () => {
    const seen = (cls: MonsterClass) => { const w = setup({ cls, seed: 4 }); w.step(1500); return new Set(w.evs.filter(e => e.who === 'mob').map(e => e.act)); };
    const blob = seen('Blob'), big = seen('Big'), fly = seen('Flying');
    expect(blob.has('dance') && blob.has('hop')).toBe(true); expect(blob.has('wave') || blob.has('loop')).toBe(false);
    expect(big.has('wave') && big.has('hop')).toBe(true); expect(big.has('dance') || big.has('loop')).toBe(false);
    expect(fly.has('loop') && fly.has('bob')).toBe(true); expect(fly.has('hop') || fly.has('dance') || fly.has('wave')).toBe(false);
    // у героя есть и клип щита, и прокрут кистью, и код (вдох, вес, взгляд, вздох)
    const w = setup({ seed: 4 }); w.step(1500); const h = new Set(w.evs.filter(e => e.who === 'hero').map(e => e.act));
    for (const x of ['breath', 'shift', 'glance', 'sigh', 'shield', 'flourish']) expect(h.has(x), x).toBe(true);
  });

  it('клипы монстра берутся только те, что у него есть', () => {
    const w = setup({ cls: 'Flying', seed: 9 }); w.step(600);
    expect(w.evs.filter(e => e.who === 'mob').map(e => e.act).every(a => ACTS.find(x => x.name === a && (!x.clip || MOB_CLIPS.Flying.includes(x.clip[0]))))).toBe(true);
  });
});

describe('живое ожидание: обрыв', () => {
  it('стоп посреди действия возвращает модель в стойку (мягко за 0.2 с; hard — сразу) и запускает базовый клип', () => {
    for (const hard of [false, true]) {
      const w = setup({ seed: 6 }); const h0 = snap(w.hero), m0 = snap(w.mob), wq = w.weapon.quaternion.clone();
      let cut = false;
      w.step(100, () => {
        if (!cut && w.idle.active() && w.now() > 10) {
          cut = true; w.st.quiet = true; w.idle.stop(hard);
          if (hard) expect(drift(w.hero, h0.p, h0.q, h0.s) + drift(w.mob, m0.p, m0.q, m0.s) + qd(w.weapon.quaternion, wq)).toBe(0);
        }
      });
      expect(cut).toBe(true);
      expect(drift(w.hero, h0.p, h0.q, h0.s) + drift(w.mob, m0.p, m0.q, m0.s) + qd(w.weapon.quaternion, wq)).toBe(0);
      expect(w.hero.baseName()).toBe('Idle_A'); expect(w.mob.baseName()).toBe('Idle');
    }
  });

  it('щит героя (клип) при обрыве уступает базовой стойке, а не оставляет героя в блоке', () => {
    const w = setup({ seed: 1 });
    // ждём именно щит
    let got = false; w.step(400, () => { if (!got && w.idle.active() === 'shield') { got = true; w.st.quiet = true; w.idle.stop(true); } });
    expect(got).toBe(true);
    for (let i = 0; i < 90; i++) w.hero.update(1 / 60);
    expect(w.hero.baseName()).toBe('Idle_A'); expect(w.hero.marksPending()).toBe(false);
  });

  it('заменили монстра посреди действия: старый возвращён в стойку, новый не тронут, ошибок нет', () => {
    const w = setup({ seed: 8 }); const m0 = snap(w.mob); let swapped = 0; const fresh = actor(MOB_CLIPS.Blob); const f0 = snap(fresh);
    w.step(200, () => {
      if (swapped === 1) { swapped = 2; expect(drift(w.mob, m0.p, m0.q, m0.s)).toBe(0); expect(drift(fresh, f0.p, f0.q, f0.s)).toBe(0); }
      if (!swapped && w.idle.active() && w.evs[w.evs.length - 1].who === 'mob') { swapped = 1; w.st.mob = fresh; }
    });
    expect(swapped).toBe(2);
  });

  it('огромный dt (вкладка была скрыта) не даёт скачка', () => {
    const w = setup(); w.step(3); w.idle.update(30); w.idle.update(30);
    expect(Number.isFinite(w.hero.model.position.y) && Number.isFinite(w.mob.model.quaternion.w)).toBe(true);
  });

  it('dispose возвращает модели и оружие ровно на место', () => {
    const w = setup({ seed: 6 }); const h0 = snap(w.hero), m0 = snap(w.mob), wq = w.weapon.quaternion.clone();
    w.step(100, () => {}); w.idle.dispose();
    expect(drift(w.hero, h0.p, h0.q, h0.s) + drift(w.mob, m0.p, m0.q, m0.s) + qd(w.weapon.quaternion, wq)).toBe(0);
  });
});

describe('живое ожидание: нельзя пугать и торопить', () => {
  it('клипы только спокойные: ни ударов, ни рывков, ни прыжков, ни клипов, которые прячут оружие', () => {
    const clips = ACTS.filter(a => a.clip).map(a => a.clip![0]);
    expect(clips.sort()).toEqual(['Dance', 'Melee_Blocking', 'No', 'Wave', 'Yes'].sort());
    for (const c of clips) expect(c).not.toMatch(/Attack|Punch|Bite|Weapon|Headbutt|Jump|Run|Fast|Hit|Death|Spawn|Throw|Shoot|Stab/);
    for (const a of ACTS.filter(x => x.who === 'hero' && x.clip)) expect(a.clip![0]).not.toMatch(/^(Sit_|Push_Ups|Sit_Ups|Waving|Cheering|Idle_B|Interact|Use_Item|Lie_|Dance)/);
  });
  it('нигде нет быстрых клипов: скорость клипа не выше 0.8', () => { for (const a of ACTS.filter(x => x.clip)) expect(a.clip![1]).toBeLessThanOrEqual(0.8); });
  it('действия не короче секунды (никаких мельканий) и не длиннее 4 с', () => {
    const h = actor(HERO_CLIPS), m = actor(['Yes', 'No', 'Wave', 'Dance']);
    for (const a of ACTS) { const d = a.clip ? (a.who === 'hero' ? h : m).length(a.clip[0], a.clip[1]) : a.dur; expect(d, a.name).toBeGreaterThanOrEqual(1); expect(d, a.name).toBeLessThanOrEqual(4); }
  });
});


describe('живое ожидание на тренировке: бой с тенью', () => {
  const train = (on: boolean, km = 1) => {
    const hero = actor([...HERO_CLIPS, 'Melee_Unarmed_Idle', 'Melee_Unarmed_Attack_Punch_A', 'Melee_Unarmed_Attack_Kick']); hero.loop('Idle_A', 0);
    const st = { quiet: false, km, on }; const evs: string[] = []; let t = 0;
    const idle = createIdleLife({ hero: () => hero, weapon: () => null, mob: () => null, quiet: () => st.quiet, km: () => st.km, training: () => st.on, rnd: rng(3) });
    idleTrace.fn = (who, act) => evs.push(act);
    const step = (sec: number) => { for (let i = 0; i < Math.round(sec * 60); i++) { t += 1 / 60; hero.update(1 / 60); idle.update(1 / 60); } };
    return { hero, st, evs, step, idle };
  };
  it('только на тренировке: вне её действия shadow не бывает', () => {
    const a = train(false); a.step(200); expect(a.evs).not.toContain('shadow');
  });
  it('на тренировке бой с тенью случается регулярно, пауза 5–8 с, после него герой возвращается в обычную стойку', () => {
    const a = train(true); a.step(120);
    const n = a.evs.filter(e => e === 'shadow').length; expect(n).toBeGreaterThanOrEqual(4); expect(a.evs.length).toBeLessThanOrEqual(120 / 4);
    a.st.quiet = true; a.step(3); expect(a.hero.baseName()).toBe('Idle_A');
  });
  it('при «уменьшить движение» реже; пока ребёнок что-то делает (quiet) — молчит', () => {
    const a = train(true, 0.3); a.step(120); const calm = a.evs.length;
    const b = train(true); b.step(120); expect(calm).toBeLessThan(b.evs.length);
    const c = train(true); c.st.quiet = true; c.step(60); expect(c.evs).toHaveLength(0);
  });
});
