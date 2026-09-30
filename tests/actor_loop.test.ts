// Цикл ходьбы не начинается заново, если на кадр переключились на стойку и сразу обратно (герой и питомец идут по клеткам палубы).
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { Actor } from '../src/three/actor';

const clip = (name: string) => new THREE.AnimationClip(name, 1, [new THREE.VectorKeyframeTrack('.position', [0, 1], [0, 0, 0, 1, 0, 0])]);

describe('Actor.loop', () => {
  it('быстрый возврат к тому же циклу продолжает его с того же места', () => {
    const W = clip('Walk'), a = new Actor(new THREE.Object3D(), [W, clip('Idle')]);
    a.loop('Walk'); a.mixer.update(0.4);
    const walk = a.mixer.clipAction(W);
    const before = walk.time;
    a.loop('Idle'); a.mixer.update(1 / 60); a.loop('Walk');
    expect(before).toBeGreaterThan(0.3);
    expect(walk.time).toBeGreaterThanOrEqual(before);          // не сброшен в 0
  });
  it('давно погасший цикл начинается сначала', () => {
    const W = clip('Walk'), a = new Actor(new THREE.Object3D(), [W, clip('Idle')]);
    a.loop('Walk'); a.mixer.update(0.4); a.loop('Idle'); a.mixer.update(1); a.loop('Walk');
    expect(a.mixer.clipAction(W).time).toBe(0);
  });
});
