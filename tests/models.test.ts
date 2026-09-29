// Готовые модели: всё, на что ссылается код (костюмы, враги, клипы, палитры миров), реально есть в public/models.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { LOOKS } from '../src/three/looks';
import { ROSTER } from '../src/three/roster';
import { paletteOf, VILLAGE } from '../src/three/worlds3d';
import { WORLDS, OUTFITS } from '../content/worlds.mjs';

const M = path.resolve('public/models');
/** JSON-часть GLB (у наборов и моделей это единственный способ заглянуть внутрь без браузера). */
function glbJson(file: string) {
  const b = fs.readFileSync(path.join(M, file)); const len = b.readUInt32LE(12);
  return JSON.parse(b.subarray(20, 20 + len).toString('utf8'));
}
const kitNodes = (id: string) => new Set<string>(glbJson(`kits/${id}.glb`).nodes.map((n: { name: string }) => n.name).filter((n: string) => n?.startsWith('K_')).map((n: string) => n.slice(2)));
const clipsOf = (file: string) => new Set<string>((glbJson(file).animations ?? []).map((a: { name: string }) => a.name));

describe('готовые модели', () => {
  it('у каждого костюма есть герой, оружие и части, которые прячутся', () => {
    const items = kitNodes('items');
    for (const o of OUTFITS) {
      const l = LOOKS[o.id]; expect(l, o.id).toBeTruthy();
      expect(fs.existsSync(path.join(M, `heroes/${l.kind}.glb`)), `${o.id}: герой`).toBe(true);
      expect(items.has(l.weapon), `${o.id}: ${l.weapon}`).toBe(true);
      if (l.offhand) expect(items.has(l.offhand), `${o.id}: ${l.offhand}`).toBe(true);
      const meshes = new Set<string>(glbJson(`heroes/${l.kind}.glb`).nodes.map((n: { name: string }) => n.name));
      for (const p of l.hide ?? []) expect(meshes.has(p), `${o.id}: часть ${p}`).toBe(true);
    }
  });
  it('враги каждого мира существуют и умеют драться', () => {
    expect(ROSTER.length).toBeGreaterThanOrEqual(WORLDS.length);
    for (const r of ROSTER) for (const id of [...r.mobs, r.mini, r.boss]) {
      const f = `monsters/${id}.glb`; expect(fs.existsSync(path.join(M, f)), id).toBe(true);
      const c = clipsOf(f);
      expect(c.has('Death'), `${id}: Death`).toBe(true);
      expect(c.has('HitReact') || c.has('HitRecieve'), `${id}: удар по нему`).toBe(true);
      expect(['Idle', 'Flying_Idle'].some(n => c.has(n)), `${id}: стойка`).toBe(true);
      expect(['Bite_Front', 'Punch', 'Headbutt', 'Weapon'].some(n => c.has(n)), `${id}: атака`).toBe(true);
    }
  });
  it('клипы героя, которые вызывает код, есть в наборах анимаций', () => {
    const all = new Set<string>(); for (const s of ['General', 'MovementBasic', 'MovementAdvanced', 'CombatMelee', 'CombatRanged', 'Simulation']) clipsOf(`anims/${s}.glb`).forEach(n => all.add(n));
    for (const n of ['Idle_A', 'Walking_A', 'Running_A', 'Cheering', 'Interact', 'Spawn_Air', 'Use_Item', 'Jump_Full_Short', 'Melee_Blocking', 'Melee_Block_Hit', 'Melee_1H_Attack_Slice_Diagonal', 'Melee_2H_Attack_Spinning', 'Melee_1H_Attack_Jump_Chop']) expect(all.has(n), n).toBe(true);
  });
  it('палитры миров ссылаются на настоящие модели', () => {
    for (let k = 0; k < WORLDS.length; k++) {
      const p = paletteOf(k), kits = new Map<string, Set<string>>();
      for (const id of new Set(['hexcore', ...p.kits])) kits.set(id, kitNodes(id));
      expect(kits.get('hexcore')!.has(p.ground?.tile ?? 'hex_grass'), `мир ${k}: плитка земли`).toBe(true);
      for (const [role, list] of Object.entries(p.roles)) for (const [kit, name] of list ?? []) {
        expect(kits.has(kit), `мир ${k} ${role}: набор ${kit} не подключён`).toBe(true);
        expect(kits.get(kit)!.has(name), `мир ${k} ${role}: нет «${name}» в наборе ${kit}`).toBe(true);
      }
    }
    expect(VILLAGE.roles.tree?.length).toBeGreaterThan(0);
  });
});
