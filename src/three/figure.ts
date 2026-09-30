// Фигура героя для корабля и карты: настоящая модель с анимациями, меняется вместе с костюмом.
// g — группа сразу (её двигают и поворачивают снаружи), модель появляется в ней, когда загрузится.
import * as THREE from 'three';
import { Actor, createHero, dress } from './actor';
import { DEFAULT_LOOK, type HeroLook } from './looks';

export class HeroFigure {
  readonly g = new THREE.Group();
  actor: Actor | null = null;
  private token = 0;
  private moving = false;
  private run = false;
  private holdClip: string | null = null;
  private busy = false;
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
    a.loop(this.clip(), 0);
  }
  setCape(c: { color: number; glow: boolean } | null) { this.cape = c; this.actor?.setCape(c); }
  private clip() { return this.moving ? (this.run ? 'Running_A' : 'Walking_A') : this.holdClip ?? 'Idle_A'; }
  /** Долгая поза вместо стойки (сидит, отжимается); null — обычная стойка. На ходьбу не влияет. */
  hold(name: string | null) { if (name === this.holdClip) return; this.holdClip = name; if (this.actor && !this.busy && !this.moving) this.actor.loop(this.clip(), 0.25); }
  get holding() { return this.holdClip; }
  /** Идёт (ходьба; run — бегом) или стоит (дыхание). */
  walking(v: boolean, run = false) {
    if (v === this.moving && run === this.run) return; this.moving = v; this.run = run;
    if (this.actor && !this.busy) this.actor.loop(this.clip(), 0.2);
  }
  /** Разовая анимация (радость, взмах, удар); после неё возвращается к ходьбе/стойке. */
  async play(clip: string, speed = 1) {
    const a = this.actor; if (!a) return;
    this.busy = true; await a.play(clip, { speed }); this.busy = false;
    a.loop(this.clip(), 0.15);
  }
  update(dt: number) { this.actor?.update(dt); }
}
