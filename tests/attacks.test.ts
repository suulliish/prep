// Атаки врагов: у каждого монстра из roster.ts есть свой стиль, стили различаются, а каждый стиль на «сухом» окружении
// доигрывает до конца, блокирует щитом хотя бы раз и возвращает монстра на место (без NaN и висящих смещений).
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import { Actor, type Monster, type MonsterClass } from '../src/three/actor';
import { ROSTER } from '../src/three/roster';
import { ATTACKS, STYLES, attackOf, createAttacks, ENEMY_X, Z0, type Body, type Env } from '../src/three/attacks';

const files = fs.readdirSync(path.resolve('public/models/monsters')).filter(f => f.endsWith('.glb')).map(f => f.slice(0, -4));

describe('стили атак', () => {
  it('каждому монстру каждого мира назначен стиль явно (не запасной по классу)', () => {
    for (const r of ROSTER) for (const id of [...r.mobs, r.mini, r.boss]) {
      expect(ATTACKS[id], id).toBeTruthy();
      expect(STYLES, id).toContain(ATTACKS[id].style);
    }
  });
  it('стиль есть у всех монстров из public/models/monsters', () => {
    for (const id of files) expect(ATTACKS[id], id).toBeTruthy();
    for (const id of Object.keys(ATTACKS)) expect(files, `лишняя запись ${id}`).toContain(id);
  });
  it('стилей 8–10 и в играх мирах их используется не меньше 8', () => {
    expect(STYLES.length).toBeGreaterThanOrEqual(8); expect(STYLES.length).toBeLessThanOrEqual(10);
    const used = new Set<string>();
    for (const r of ROSTER) for (const id of [...r.mobs, r.mini, r.boss]) used.add(ATTACKS[id].style);
    expect(used.size).toBeGreaterThanOrEqual(8);
  });
  it('в каждом мире обычные монстры бьют не одним и тем же', () => {
    for (const [i, r] of ROSTER.entries()) expect(new Set(r.mobs.map(id => ATTACKS[id].style)).size, `мир ${i}`).toBeGreaterThan(1);
  });
  it('новый монстр без записи получает стиль по классу', () => {
    expect(attackOf('Blob_Новый').style).toBe('slam'); expect(attackOf('Big_Новый').style).toBe('smash'); expect(attackOf('Flying_Новый').style).toBe('dash');
  });
});

// ---------- сухой прогон: часы, твины, частицы и щит — заглушки ----------
const CLIPS = ['Idle', 'Flying_Idle', 'Punch', 'Weapon', 'Headbutt', 'Bite_Front', 'Jump', 'Run', 'Fast_Flying', 'HitReact', 'Death'];
function monster(cls: MonsterClass): Monster {
  const clip = (n: string) => new THREE.AnimationClip(n, 0.8, [new THREE.NumberKeyframeTrack('.position[x]', [0, 0.8], [0, 0])]);
  const a = new Actor(new THREE.Object3D(), CLIPS.map(clip));
  a.loop(cls === 'Flying' ? 'Flying_Idle' : 'Idle', 0);
  a.g.position.set(ENEMY_X, cls === 'Flying' ? 0.9 : 0, Z0); a.g.rotation.y = -Math.PI / 2; a.g.scale.setScalar(1.2);
  return { a, cls, height: cls === 'Big' ? 2.7 : cls === 'Blob' ? 1.5 : 2.1, idle: cls === 'Flying' ? 'Flying_Idle' : 'Idle', attack: () => (cls === 'Blob' ? 'Bite_Front' : cls === 'Big' ? 'Punch' : 'Headbutt'), hit: 'HitReact', death: 'Death', hover: cls === 'Flying' ? 0.9 : 0 };
}
async function dry(id: string, boss: boolean, km = 1, high = true) {
  const cls = id.split('_')[0] as MonsterClass, m = monster(cls);
  const b: Body = { id, m, boss, wb: false, top: m.height + m.hover, s0: 1.2, dy: 0 };
  const fxs: ((dt: number) => boolean)[] = [], tws: { t: number; dur: number; step: (u: number) => void; res: () => void }[] = [];
  const noop = new Proxy({}, { get: () => () => {} }) as never;
  let blocks = 0, guardOn = false, bad = 0;
  const env: Env = {
    scene: new THREE.Scene(), vfx: noop, km, high, sfx: () => {},
    fx: u => { fxs.push(u); },
    tween: (dur, step) => new Promise<void>(res => tws.push({ t: 0, dur, step, res })),
    wait: s => new Promise<void>(res => tws.push({ t: 0, dur: s, step: () => {}, res })),
    shake: v => { if (!isFinite(v)) bad++; }, hitStop: () => {}, burst: () => {}, ring: () => {},
    guard: on => { guardOn = on; }, block: () => { blocks++; return Promise.resolve(); }, tap: () => {},
  };
  const atk = createAttacks(env);
  let done = false; const p = atk.run(b).then(() => { done = true; });
  let steps = 0;
  while (!done && steps++ < 400) {
    const dt = 0.03; m.a.update(dt);
    for (let i = fxs.length - 1; i >= 0; i--) if (!fxs[i](dt)) fxs.splice(i, 1);
    for (let i = tws.length - 1; i >= 0; i--) { const w = tws[i]; w.t += dt / w.dur; const u = Math.min(1, w.t); w.step(u); if (u >= 1) { tws.splice(i, 1); w.res(); } }
    await new Promise(r => setImmediate(r));
  }
  await p;
  const g = m.a.g;
  const finite = [g.position.x, g.position.y, g.position.z, g.scale.x, g.scale.y, g.scale.z, b.dy].every(Number.isFinite);
  atk.dispose();
  return { done, steps, blocks, guardOn, bad, finite, x: g.position.x, z: g.position.z, yaw: g.rotation.y, sc: g.scale.x, dy: b.dy, sec: steps * 0.03 };
}

describe('сухой прогон атак', () => {
  it('каждый монстр (обычный и в роли босса, обычные и «меньше движения»/низкое качество) доигрывает ≤ 2 с, блокируется щитом и возвращается на место', async () => {
    for (const id of Object.keys(ATTACKS)) for (const boss of [false, true]) for (const [km, high] of [[1, true], [0.3, false]] as const) {
      const r = await dry(id, boss, km, high);
      const tag = `${id}${boss ? ' (босс)' : ''} km=${km}${high ? '' : ' low'}`;
      expect(r.done, tag).toBe(true);
      expect(r.blocks, tag).toBeGreaterThanOrEqual(1);
      expect(r.guardOn, tag).toBe(true);
      expect(r.finite && r.bad === 0, tag).toBe(true);
      expect(r.x, tag).toBeCloseTo(ENEMY_X, 5); expect(r.z, tag).toBeCloseTo(Z0, 5);
      expect(r.yaw, tag).toBeCloseTo(-Math.PI / 2, 5); expect(r.sc, tag).toBeCloseTo(1.2, 5); expect(r.dy, tag).toBe(0);
      expect(r.sec, tag).toBeLessThan(2);
    }
  }, 60000);
});
