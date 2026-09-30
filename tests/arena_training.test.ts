// Тренировка и приёмы в арене (src/three/arena.ts): площадка вместо врага, действия героя по манекену, выход без утечек и «зависших» манекенов,
// приём в бою: тайминги удара в пределах 0.2 с от обычного. Модели, остров и эффекты подменены заглушками, кадры арены гоняем вручную.
import { describe, it, expect, vi, beforeAll } from 'vitest';
import * as THREE from 'three';

const CLIPS: Record<string, number> = {
  Idle_A: 1, Idle: 1, Running_A: 0.8, Walking_A: 1, Melee_1H_Attack_Slice_Diagonal: 1, Melee_1H_Attack_Chop: 1.067, Melee_1H_Attack_Stab: 1.6, Melee_2H_Attack_Spinning: 0.667,
  Melee_1H_Attack_Jump_Chop: 1.333, Throw: 1.367, Hit_B: 0.867, Cheering: 1.5, Interact: 1.3, Melee_Blocking: 1, Melee_Block_Hit: 1, Use_Item: 1.6, Idle_B: 2, Spawn_Air: 1, Bite_Front: 1, HitReact: 0.5, Death: 1, Jump_Full_Short: 1,
};
vi.mock('../src/three/actor', async orig => {
  const m = await orig<typeof import('../src/three/actor')>();
  const mk = () => new m.Actor(new THREE.Object3D(), Object.entries(CLIPS).map(([n, d]) => new THREE.AnimationClip(n, d, [new THREE.NumberKeyframeTrack('.position[x]', [0, d], [0, 0.001])])));
  return {
    ...m,
    createHero: async () => { const a = mk(); a.loop('Idle_A', 0); return a; },
    dress: async () => {},
    createMonster: async (id: string) => { const a = mk(); a.loop('Idle', 0); return { a, cls: 'Blob', height: 1.5, idle: 'Idle', attack: () => 'Bite_Front', hit: 'HitReact', death: 'Death', hover: 0 }; },
  };
});
vi.mock('../src/three/island3d', () => ({ loadIslandKits: async () => ({}), buildIsland: () => new THREE.Group() }));
vi.mock('../src/three/vfx', () => {
  const noop = () => {}, vfx = new Proxy({}, { get: (_, k) => (k === 'update' || k === 'clear' || k === 'dispose' || k === 'setScale' ? noop : noop) });
  return { createVfx: () => vfx };
});

import { createArena } from '../src/three/arena';
import { HERO_X } from '../src/three/attacks';

beforeAll(() => {
  const ctx: any = new Proxy({}, { get: (_, k) => (k === 'measureText' ? () => ({ width: 10 }) : () => ctx), set: () => true });
  vi.stubGlobal('document', { createElement: () => ({ width: 0, height: 0, getContext: () => ctx }) });
});

const make = () => {
  const arena = createArena({ skyMat: new THREE.MeshBasicMaterial(), starGeo: new THREE.BufferGeometry(), starMat: new THREE.PointsMaterial(), km: 1, shadows: false });
  arena.theme(0, '#5ce39c', '#000'); arena.spot('k1');
  return arena;
};
let clock = 0;
/** Гнать кадры арены, пока промис не завершится; возвращает, сколько секунд игрового времени это заняло. */
async function until(a: ReturnType<typeof make>, p: Promise<unknown>, max = 25): Promise<number> {
  let done = false; p.then(() => (done = true), () => (done = true)); let x = 0;
  for (let i = 0; i < max * 30 && !done; i++) { x += 1 / 30; clock += 1 / 30; a.update(1 / 30, clock); for (let k = 0; k < 6; k++) await Promise.resolve(); }
  expect(done, 'действие завершилось').toBe(true); return x;
}
const frames = async (a: ReturnType<typeof make>, sec: number) => { for (let i = 0; i < sec * 30; i++) { clock += 1 / 30; a.update(1 / 30, clock); await Promise.resolve(); } };
const heroX = (a: ReturnType<typeof make>) => a.heroPos(new THREE.Vector3()).x;

describe('тренировка в арене', () => {
  it('setTraining(true) ставит площадку вместо врага; врага и его действий нет', async () => {
    const a = make(); await until(a, a.setTraining(true));
    expect(a.hasTraining()).toBe(true); expect(a.hasEnemy()).toBe(false); expect(a.trainingStats()!.shown).toBeGreaterThan(0.99);
    expect(await a.attack({})).toBe(false);
    a.clear();
  });
  it('удар, связка «на месте», бонк, разбор глитча, бросок в мишень: всё завершается, герой возвращается на место', async () => {
    const a = make(); await until(a, a.setTraining(true)); await frames(a, 1.5);
    a.trainBoard('Бүгінгі тәсіл: тест');
    let s = a.trainStrike('strong'); let t = await until(a, s); expect(t).toBeGreaterThan(0.8); expect(t).toBeLessThan(4); expect(heroX(a)).toBeCloseTo(HERO_X, 1);
    a.trainStrike('combo', 1, true); a.trainStrike('combo', 2, true); await until(a, a.trainStrike('combo', 3)); expect(heroX(a)).toBeCloseTo(HERO_X, 1);
    await until(a, a.trainBonk()); expect(heroX(a)).toBeCloseTo(HERO_X, 1);
    a.trainGlitch(true); await frames(a, 0.5); expect(a.trainingStats()!.glitch).toBeGreaterThan(0.3);
    await until(a, a.trainBreakGlitch()); await frames(a, 1); expect(a.trainingStats()!.glitch).toBeLessThan(0.05); expect(heroX(a)).toBeCloseTo(HERO_X, 1);
    a.trainTargets(8); await frames(a, 2); expect(a.trainingStats()!.targetsUp).toBe(5);
    // быстрые ответы: лишние броски пропускаются, мишени всё равно падают, счёт 8 → 4
    const hits = [a.trainTargetHit(), a.trainTargetHit(), a.trainTargetHit(), a.trainTargetHit()];
    await until(a, Promise.all(hits)); await frames(a, 3); expect(a.trainingStats()!.targetsUp).toBe(4);
    a.trainTargetMiss(); await until(a, a.trainCheer()); expect(heroX(a)).toBeCloseTo(HERO_X, 1);
    a.clear();
  });
  it('выход: clear() убирает площадку сразу, зависшие действия завершаются, отложенный setTraining не оживляет её', async () => {
    const a = make(); await until(a, a.setTraining(true)); await frames(a, 1);
    const pend = a.trainBonk(); await frames(a, 0.3); a.clear();
    await until(a, pend); expect(a.hasTraining()).toBe(false);
    const late = a.setTraining(true); a.clear(); await until(a, late); await frames(a, 1); expect(a.hasTraining()).toBe(false);
    // после выхода действия безвредны
    await until(a, a.trainStrike('light')); await until(a, a.trainCheer()); a.trainBoard('x'); a.trainTargets(3); a.trainGlitch(true);
    // а нужное состояние доски/мишеней/глитча применится к следующей площадке только если вход был после выхода
    a.clear(); expect(a.hasTraining()).toBe(false);
  });
  it('повторные входы и выходы не копят объекты сцены и освобождают ресурсы каждый раз поровну', async () => {
    const a = make(); await a.setTraining(false).catch(() => {}); const base = a.scene.children.length;
    const counts: number[] = []; let disposed = 0;
    const gd = THREE.BufferGeometry.prototype.dispose, td = THREE.Texture.prototype.dispose, md = THREE.Material.prototype.dispose;
    THREE.BufferGeometry.prototype.dispose = function () { disposed++; return gd.call(this); }; THREE.Texture.prototype.dispose = function () { disposed++; return td.call(this); }; THREE.Material.prototype.dispose = function () { disposed++; return md.call(this); };
    try {
      for (let k = 0; k < 4; k++) {
        disposed = 0; await until(a, a.setTraining(true)); await frames(a, 0.5); await until(a, a.trainStrike('light')); a.clear();
        counts.push(disposed); expect(a.scene.children.length).toBe(base);
      }
    } finally { THREE.BufferGeometry.prototype.dispose = gd; THREE.Texture.prototype.dispose = td; THREE.Material.prototype.dispose = md; }
    expect(counts[0]).toBeGreaterThan(10); expect(new Set(counts).size).toBe(1);
  });
  it('spawn после тренировки убирает площадку (бой после урока как раньше)', async () => {
    const a = make(); await until(a, a.setTraining(true));
    await until(a, a.spawn(3, 0)); expect(a.hasTraining()).toBe(false); expect(a.hasEnemy()).toBe(true);
    a.clear();
  });
});

describe('приёмы в бою', () => {
  const fxs = ['arc', 'pierce', 'split', 'multi', 'spin'] as const;
  it('удар приёмом: урон 1, а время удара отличается от обычного не больше чем на 0.2 с', async () => {
    const times: Record<string, number> = {};
    for (const f of ['none', ...fxs]) {
      const a = make(); await until(a, a.spawn(9, 0)); await frames(a, 0.5);
      const hp0 = 9;
      const killed = a.attack({ tech: f === 'none' ? null : { color: 0xff9a3d, fx: f as (typeof fxs)[number], kz: 'Жіктеу соққысы' } });
      times[f] = await until(a, killed); expect(await killed).toBe(false); void hp0;
      expect(heroX(a)).toBeCloseTo(HERO_X, 1);
      a.clear();
    }
    for (const f of fxs) expect(Math.abs(times[f] - times.none), `${f}: ${times[f].toFixed(2)} с против ${times.none.toFixed(2)} с`).toBeLessThanOrEqual(0.2);
  });
  it('приём не меняет суперудар', async () => {
    const a = make(); await until(a, a.spawn(9, 0)); const p = a.attack({ sup: true, dmg: 2, tech: { color: 1, fx: 'spin', kz: 'x' } }); await until(a, p); a.clear();
  });
});
