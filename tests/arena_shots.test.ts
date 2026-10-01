// Удары героя на расстоянии в бою (src/three/shots.ts, arena.attack): выбор по приёму темы, урон ровно 1, попадание вызывает тот же onHit, вес клипа 1,
// лук и снаряды убраны после удара и при уходе посреди выстрела. Модели, остров и эффекты подменены заглушками, кадры арены гоняем вручную.
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import * as THREE from 'three';
import { pickShot, type ShotKind, type TechFx } from '../src/three/shots';

const CLIPS: Record<string, number> = {
  Idle_A: 1, Idle: 1, Running_A: 0.8, Walking_A: 1, Melee_1H_Attack_Slice_Diagonal: 1, Melee_1H_Attack_Chop: 1.067, Melee_1H_Attack_Stab: 1.6, Melee_2H_Attack_Spinning: 0.667,
  Melee_1H_Attack_Jump_Chop: 1.333, Throw: 1.367, Hit_B: 0.867, Melee_Blocking: 1, Melee_Block_Hit: 1.067, Use_Item: 1.6, Spawn_Air: 1, Bite_Front: 1, HitReact: 0.5, Death: 1, Interact: 1.3,
  Ranged_Bow_Draw: 1.333, Ranged_Bow_Release: 1.333, Ranged_Magic_Shoot: 0.933,
};
vi.mock('../src/three/actor', async orig => {
  const m = await orig<typeof import('../src/three/actor')>();
  const mk = () => new m.Actor(new THREE.Object3D(), Object.entries(CLIPS).map(([n, d]) => new THREE.AnimationClip(n, d, [new THREE.NumberKeyframeTrack('.position[x]', [0, d], [0, 0.001])])));
  return {
    ...m,
    createHero: async () => { const a = mk(); a.loop('Idle_A', 0); return a; },
    dress: async () => {},
    createMonster: async () => { const a = mk(); a.loop('Idle', 0); return { a, cls: 'Blob', height: 1.5, idle: 'Idle', attack: () => 'Bite_Front', hit: 'HitReact', death: 'Death', hover: 0 }; },
  };
});
vi.mock('../src/three/hero_props', async orig => {
  const m = await orig<typeof import('../src/three/hero_props')>();
  return { ...m, bowLoadout: async () => ({ bow: new THREE.Object3D(), arrow: new THREE.Object3D(), flying: () => { const g = new THREE.Group(); g.add(new THREE.Object3D()); g.children[0].name = 'arrow'; return g; } }) };
});
vi.mock('../src/three/island3d', () => ({ loadIslandKits: async () => ({}), buildIsland: () => new THREE.Group() }));
vi.mock('../src/three/vfx', () => {
  const noop = () => {}, vfx = new Proxy({}, { get: () => noop });
  return { createVfx: () => vfx };
});

import { createArena } from '../src/three/arena';
import { Actor } from '../src/three/actor';
import { DEFAULT_LOOK } from '../src/three/looks';

beforeAll(() => {
  const ctx: any = new Proxy({}, { get: (_, k) => (k === 'measureText' ? () => ({ width: 10 }) : () => ctx), set: () => true });
  vi.stubGlobal('document', { createElement: () => ({ width: 0, height: 0, getContext: () => ctx }) });
});
afterEach(() => vi.restoreAllMocks());

const make = (rnd: () => number, km = 1) => {
  const arena = createArena({ skyMat: new THREE.MeshBasicMaterial(), starGeo: new THREE.BufferGeometry(), starMat: new THREE.PointsMaterial(), km, shadows: false, rnd });
  arena.theme(0, '#5ce39c', '#000'); arena.spot('k1');
  return arena;
};
type A = ReturnType<typeof make>;
let clock = 0;
async function until(a: A, p: Promise<unknown>, max = 20): Promise<number> {
  let done = false; p.then(() => (done = true), () => (done = true)); let x = 0;
  for (let i = 0; i < max * 30 && !done; i++) { x += 1 / 30; clock += 1 / 30; a.update(1 / 30, clock); for (let k = 0; k < 6; k++) await Promise.resolve(); }
  expect(done, 'действие завершилось').toBe(true); return x;
}
const frames = async (a: A, sec: number) => { for (let i = 0; i < sec * 30; i++) { clock += 1 / 30; a.update(1 / 30, clock); await Promise.resolve(); } };
const tech = (fx: TechFx) => ({ color: 0xff9a3d, fx, kz: 'Тест' });
/** Какие разовые клипы играл герой: перехват Actor.play; вес клипа сразу после запуска (должен быть 1, а не 0 — поза «Т»). */
function spyPlay() {
  const names: string[] = [], weights: number[] = [], orig = Actor.prototype.play;
  vi.spyOn(Actor.prototype, 'play').mockImplementation(function (this: Actor, name: string, o?: Parameters<Actor['play']>[1]) {
    const r = orig.call(this, name, o); names.push(name);
    if (/^(Ranged_|Throw)/.test(name)) weights.push((this.mixer as unknown as { _actions: THREE.AnimationAction[] })._actions.find(x => x.getClip().name === name)!.getEffectiveWeight());
    return r;
  });
  return { names, weights };
}
const projectiles = (a: A) => { let n = 0; a.scene.traverse(o => { const g = (o as THREE.Mesh).geometry as THREE.SphereGeometry | undefined; if ((g?.parameters?.radius === 0.28 && o.parent === a.scene) || o.name === 'arrow') n++; }); return n; };

describe('выбор удара на расстоянии (pickShot)', () => {
  const run = (fx: TechFx, n = 4000, crit = false) => {
    let s = 7; const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
    const c: Record<string, number> = { sword: 0 }; const hist: (ShotKind | null)[] = []; let cyc = 0; let streak = 0, maxStreak = 0;
    for (let i = 0; i < n; i++) { const k = pickShot(fx, rnd, hist, crit, cyc); hist.push(k); if (hist.length > 4) hist.shift(); if (k && fx === 'arc') cyc++; c[k ?? 'sword'] = (c[k ?? 'sword'] ?? 0) + 1; streak = k ? streak + 1 : 0; maxStreak = Math.max(maxStreak, streak); }
    return { c, maxStreak };
  };
  it('выпад (pierce): чаще лук, иногда бросок, но и меч; вихрь (spin): магия или меч; двойной (multi): магия, бросок, меч; разрез (split): только меч', () => {
    const p = run('pierce'), sp = run('spin'), mu = run('multi'), sl = run('split');
    expect(p.c.bow).toBeGreaterThan(p.c.throw ?? 0); expect(p.c.bow).toBeGreaterThan(1000); expect(p.c.sword).toBeGreaterThan(500); expect(p.c.magic ?? 0).toBe(0);
    expect(sp.c.magic).toBeGreaterThan(1000); expect(sp.c.sword).toBeGreaterThan(500); expect(sp.c.bow ?? 0).toBe(0);
    expect(mu.c.magic).toBeGreaterThan(500); expect(mu.c.throw).toBeGreaterThan(100); expect(mu.c.sword).toBeGreaterThan(500);
    expect(sl.c.sword).toBe(4000);
  });
  it('обычный удар: иногда по кругу бросок, лук, магия; с серией (crit) без приёма всегда мечом; больше двух выстрелов подряд не бывает', () => {
    const a = run('arc'); expect(a.c.throw).toBeGreaterThan(100); expect(a.c.bow).toBeGreaterThan(100); expect(a.c.magic).toBeGreaterThan(100); expect(a.c.sword).toBeGreaterThan(2000);
    expect(run('arc', 500, true).c.sword).toBe(500);
    for (const fx of ['arc', 'pierce', 'spin', 'multi'] as const) expect(run(fx).maxStreak, fx).toBeLessThanOrEqual(2);
  });
});

describe('удар на расстоянии в бою', () => {
  it('выстрел из лука: клипы Draw и Release с весом 1, урон ровно 1, onHit один раз, герой на месте, снаряда нет, лук убран (carry пустой)', async () => {
    const sp = spyPlay(); const carry = vi.spyOn(Actor.prototype, 'carry');
    const a = make(() => 0.1); await until(a, a.spawn(2, 0)); await frames(a, 0.5);
    let hits = 0; const p = a.attack({ tech: tech('pierce'), onHit: () => hits++ });
    const t = await until(a, p); expect(await p).toBe(false);
    expect(sp.names).toContain('Ranged_Bow_Draw'); expect(sp.names).toContain('Ranged_Bow_Release'); expect(sp.names.some(n => /^Melee_1H/.test(n))).toBe(false);
    for (const w of sp.weights) expect(w).toBe(1);
    expect(hits).toBe(1); expect(t).toBeLessThan(4); expect(a.heroPos(new THREE.Vector3()).x).toBeCloseTo(-2.6, 1);
    await frames(a, 1); expect(projectiles(a)).toBe(0);
    expect(carry.mock.calls.at(-1)![0]).toEqual([]);
    // второй удар добивает: у врага было 2 здоровья, каждый удар отнимает ровно 1
    await frames(a, 0.5); const killed = a.attack({ tech: tech('spin') }); await until(a, killed); expect(await killed).toBe(true);
    a.clear();
  });
  it('магия (вихрь) и бросок: свои клипы, вес 1, урон 1', async () => {
    for (const [fx, clip, r] of [['spin', 'Ranged_Magic_Shoot', 0.1], ['pierce', 'Throw', 0.7]] as const) {
      const sp = spyPlay(); const a = make(() => r); await until(a, a.spawn(1, 0)); await frames(a, 0.5);
      let hits = 0; const p = a.attack({ tech: tech(fx), onHit: () => hits++ }); await until(a, p);
      expect(await p, clip).toBe(true); expect(hits).toBe(1); expect(sp.names).toContain(clip); for (const w of sp.weights) expect(w).toBe(1);
      await frames(a, 1); expect(projectiles(a)).toBe(0); a.clear(); vi.restoreAllMocks();
    }
  });
  it('меч остаётся: при «невыстреливших» бросках (rnd 0.99), у разреза и суперудара клипы дальнего боя не играют', async () => {
    for (const [rnd, opts] of [[0.99, { tech: tech('pierce') }], [0.1, { tech: tech('split') }], [0.1, { sup: true, dmg: 2 }]] as const) {
      const sp = spyPlay(); const a = make(() => rnd); await until(a, a.spawn(9, 0)); await frames(a, 0.5);
      await until(a, a.attack({ ...opts })); expect(sp.names.some(n => /^(Ranged_|Throw)/.test(n))).toBe(false); expect(sp.names.some(n => /^Melee_/.test(n))).toBe(true);
      a.clear(); vi.restoreAllMocks();
    }
  });
  it('время удара: выстрел не дольше двух секунд и не короче 0.5 с до касания', async () => {
    for (const [fx, r] of [['pierce', 0.1], ['spin', 0.1], ['pierce', 0.7]] as const) {
      const a = make(() => r); await until(a, a.spawn(9, 0)); await frames(a, 0.5); let hitAt = -1, t0 = 0, now = 0;
      const p = a.attack({ tech: tech(fx), onHit: () => (hitAt = now - t0) });
      let done = false; p.then(() => (done = true)); for (let i = 0; i < 20 * 30 && !done; i++) { now += 1 / 30; clock += 1 / 30; a.update(1 / 30, clock); for (let k = 0; k < 6; k++) await Promise.resolve(); }
      expect(hitAt, fx).toBeGreaterThan(0.3); expect(hitAt, fx).toBeLessThan(1.6); a.clear();
    }
  });
  it('уход посреди выстрела (на натяжении, в полёте стрелы, в полёте шара): снаряд убран сразу, лук убран, удар завершается без касания, следующий бой без хвостов', async () => {
    for (const [fx, r, wait] of [['pierce', 0.1, 0.25], ['pierce', 0.1, 0.9], ['spin', 0.1, 0.25], ['pierce', 0.7, 0.4]] as const) {
      const carry = vi.spyOn(Actor.prototype, 'carry');
      const a = make(() => r); await until(a, a.spawn(3, 0)); await frames(a, 0.5); const base = a.scene.children.length;
      let hits = 0; const p = a.attack({ tech: tech(fx), onHit: () => hits++ }); await frames(a, wait); a.clear();
      expect(projectiles(a), `${fx} ${wait}`).toBe(0); expect(carry.mock.calls.at(-1)![0], `${fx} ${wait}`).toEqual([]);
      await until(a, p); await frames(a, 1); expect(hits).toBe(0); expect(projectiles(a)).toBe(0); expect(a.scene.children.length).toBeLessThanOrEqual(base);
      const t = await until(a, a.spawn(3, 0)); expect(t).toBeLessThan(4); a.clear(); vi.restoreAllMocks();
    }
  });
  it('«уменьшить движение» и смена костюма посреди выстрела: ничего не ломается', async () => {
    const a = make(() => 0.1, 0.3); await until(a, a.spawn(3, 0)); await frames(a, 0.5);
    const p = a.attack({ tech: tech('pierce') }); await until(a, p); a.clear();
    const b = make(() => 0.1); await until(b, b.spawn(3, 0)); await frames(b, 0.5);
    const q = b.attack({ tech: tech('pierce') }); await frames(b, 0.3); b.setLook({ ...DEFAULT_LOOK }); await until(b, q); await frames(b, 1.5); expect(projectiles(b)).toBe(0); b.clear();
  });
});
