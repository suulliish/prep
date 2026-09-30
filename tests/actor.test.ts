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
