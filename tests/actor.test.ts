// Актёр: оборванная разовая анимация не должна терять свои метки (момент удара срабатывает ровно один раз).
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { Actor } from '../src/three/actor';

function make() {
  const model = new THREE.Object3D();
  const clip = (name: string, d: number) => new THREE.AnimationClip(name, d, [new THREE.NumberKeyframeTrack('.position[x]', [0, d], [0, 1])]);
  return new Actor(model, [clip('Idle', 1), clip('Attack', 1), clip('Cheer', 1)]);
}

describe('Actor.play: метки', () => {
  it('без помех метка срабатывает один раз в свой момент', () => {
    const a = make(); a.loop('Idle', 0);
    let hit = 0, done = false;
    a.play('Attack', { marks: [{ at: 0.5, fn: () => hit++ }] }).then(() => (done = true));
    for (let i = 0; i < 4; i++) a.update(0.1);
    expect(hit).toBe(0);
    for (let i = 0; i < 3; i++) a.update(0.1);
    expect(hit).toBe(1);
    for (let i = 0; i < 20; i++) a.update(0.1);
    expect(hit).toBe(1); void done;
  });

  it('другая анимация посреди удара: несработавшие метки срабатывают сразу и один раз, промис завершается', async () => {
    const a = make(); a.loop('Idle', 0);
    const order: string[] = []; let done = false;
    a.play('Attack', { marks: [{ at: 0.1, fn: () => order.push('slash') }, { at: 0.6, fn: () => order.push('impact') }] }).then(() => (done = true));
    a.update(0.2);                       // метка 0.1 сработала, 0.6 ещё нет
    expect(order).toEqual(['slash']);
    expect(a.marksPending()).toBe(true);
    a.play('Cheer');                     // обрыв
    expect(order).toEqual(['slash', 'impact']);
    expect(a.marksPending()).toBe(false);
    await Promise.resolve(); expect(done).toBe(true);
    for (let i = 0; i < 30; i++) a.update(0.1);
    expect(order).toEqual(['slash', 'impact']);   // повторов нет
  });

  it('зацикленная анимация тоже не глотает метки', () => {
    const a = make(); let hit = 0;
    a.play('Attack', { marks: [{ at: 0.9, fn: () => hit++ }] });
    a.loop('Idle', 0); a.play('Cheer', { loop: true });
    expect(hit).toBe(1);
  });
});

describe('Actor: предметы в руках и переходы поз', () => {
  const bones = () => {
    const model = new THREE.Object3D();
    const r = new THREE.Object3D(); r.name = 'handslot.r'; const l = new THREE.Object3D(); l.name = 'handslot.l';
    const sword = new THREE.Object3D(); sword.userData.gear = true; r.add(sword);
    model.add(r, l);
    const clip = (name: string, d: number) => new THREE.AnimationClip(name, d, [new THREE.NumberKeyframeTrack('.position[x]', [0, d], [0, 1])]);
    return { a: new Actor(model, [clip('Idle_A', 1), clip('Sit_Floor_Down', 1), clip('Sit_Floor_Idle', 1), clip('Melee_Unarmed_Idle', 1), clip('Ranged_Magic_Shoot', 1), clip('Running_A', 1), clip('Cheering', 1)]), sword, r, l };
  };
  it('carry: меч и щит прячутся, пока в руках лук или молоток, и возвращаются, когда предмет убран', () => {
    const { a, sword, l } = bones(); a.loop('Idle_A', 0); expect(sword.visible).toBe(true);
    const bow = new THREE.Object3D(); a.carry([{ slot: 'handslot.l', obj: bow }]);
    expect(bow.parent).toBe(l); expect(sword.visible).toBe(false); expect(a.carrying).toBe(true);
    a.play('Running_A', { loop: true }); expect(sword.visible).toBe(false);
    a.carry([]); expect(bow.parent).toBeNull(); expect(sword.visible).toBe(true); expect(a.carrying).toBe(false);
  });
  it('бой с тенью и магия идут без меча и щита, обычная стойка и бег — с ними', () => {
    const { a, sword } = bones();
    for (const c of ['Melee_Unarmed_Idle', 'Ranged_Magic_Shoot']) { a.play(c, { loop: true }); expect(sword.visible, c).toBe(false); }
    a.loop('Idle_A', 0); a.play('Idle_A', { loop: true }); expect(sword.visible).toBe(true);
  });
  it('settle: жест обрывается, меч и щит появляются сразу, а не после конца жеста', () => {
    const { a, sword } = bones(); a.loop('Idle_A', 0); void a.play('Cheering'); expect(sword.visible).toBe(false);
    a.settle(); expect(sword.visible).toBe(true); expect(a.marksPending()).toBe(false);
  });
  it('then: после конца разовой анимации сразу зацикленная база (сел → сидит), без возврата в прежнюю стойку', async () => {
    const { a } = bones(); a.loop('Idle_A', 0);
    const done = a.play('Sit_Floor_Down', { then: 'Sit_Floor_Idle' });
    for (let i = 0; i < 15; i++) a.update(0.1);
    await done; expect(a.baseName()).toBe('Sit_Floor_Idle');
  });
});
