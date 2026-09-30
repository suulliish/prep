// Фигура героя для корабля и карты: настоящая модель с анимациями, меняется вместе с костюмом.
// g — группа сразу (её двигают и поворачивают снаружи), модель появляется в ней, когда загрузится.
import * as THREE from 'three';
import { Actor, createHero, dress } from './actor';
import { DEFAULT_LOOK, type HeroLook } from './looks';

// Позы и жесты «для себя» (сидит, качается, машет, радуется) — без меча и щита в руках: с оружием отжимания и взмах выглядят нелепо.
// Ходьба, стойка и всё боевое — с оружием.
const UNARMED = /^(Sit_|Push_Ups|Sit_Ups|Waving|Cheering|Lie_|Dance)/;

export class HeroFigure {
  readonly g = new THREE.Group();
  actor: Actor | null = null;
  private token = 0;
  private moving = false;
  private run = false;
  private holdClip: string | null = null;
  private busy = false;
  private shotClip: string | null = null;
  private cape: { color: number; glow: boolean } | null = null;
  /** Оружие в правой руке (для следа удара и т.п.). */
  weapon: THREE.Object3D | null = null;
  constructor(look: HeroLook = DEFAULT_LOOK, private height = 1) { this.setLook(look); }

  async setLook(look: HeroLook) {
    const my = ++this.token;
    const a = await createHero(look.kind);
    await dress(a, { weapon: look.weapon, offhand: look.offhand, hide: look.hide });
    if (my !== this.token) { a.dispose(); return; }
    if (look.tint) a.tint(look.tint, look.glow);
    a.setCape(this.cape);
    if (this.actor) { this.g.remove(this.actor.g); this.actor.dispose(); }
    this.actor = a; a.g.scale.setScalar(this.height); this.g.add(a.g);
    this.weapon = a.bone('handslot.r')?.children.find(c => c.userData.gear) ?? null;
    a.loop(this.clip(), 0); this.syncGear();
  }
  /** Меч и щит видны, только когда герой не сидит, не качается и не машет. */
  private syncGear() {
    const bare = !this.moving && UNARMED.test(this.shotClip ?? this.holdClip ?? '');
    for (const slot of ['handslot.r', 'handslot.l']) this.actor?.bone(slot)?.children.forEach(c => { if (c.userData.gear) c.visible = !bare; });
  }
  setCape(c: { color: number; glow: boolean } | null) { this.cape = c; this.actor?.setCape(c); }
  private clip() { return this.moving ? (this.run ? 'Running_A' : 'Walking_A') : this.holdClip ?? 'Idle_A'; }
  /** Долгая поза вместо стойки (сидит, отжимается); null — обычная стойка. На ходьбу не влияет. */
  hold(name: string | null) { if (name === this.holdClip) return; this.holdClip = name; if (this.actor && !this.busy && !this.moving) this.actor.loop(this.clip(), 0.25); this.syncGear(); }
  get holding() { return this.holdClip; }
  /** Идёт (ходьба; run — бегом) или стоит (дыхание). */
  walking(v: boolean, run = false) {
    if (v === this.moving && run === this.run) return; this.moving = v; this.run = run;
    if (this.actor && !this.busy) this.actor.loop(this.clip(), 0.2);
    this.syncGear();
  }
  /** Разовая анимация (радость, взмах, удар); после неё возвращается к ходьбе/стойке. */
  async play(clip: string, speed = 1) {
    const a = this.actor; if (!a) return;
    this.busy = true; this.shotClip = clip; this.syncGear(); await a.play(clip, { speed }); this.busy = false;
    if (this.shotClip === clip) this.shotClip = null;
    a.loop(this.clip(), 0.15); this.syncGear();
  }
  update(dt: number) { this.actor?.update(dt); }
}
