// Актёры: герой и монстры с настоящими анимациями (готовые клипы KayKit / Quaternius).
import * as THREE from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { loadModel, Kit, toonify, scaleToHeight, sitOnGround } from './assets';

export interface Mark { at: number; fn: () => void }   // at — доля клипа 0..1, когда сработает fn (момент удара и т.п.)
interface PlayOpts { speed?: number; fade?: number; marks?: Mark[]; hold?: boolean; loop?: boolean }

/** Модель + микшер. Базовая анимация зациклена (стойка, ходьба), разовые (удар, блок) играются поверх и возвращаются к ней. */
export class Actor {
  readonly g = new THREE.Group();
  readonly mixer: THREE.AnimationMixer;
  private clips = new Map<string, THREE.AnimationClip>();
  private base: THREE.AnimationAction | null = null;
  private shot: { a: THREE.AnimationAction; marks: Mark[]; done: (() => void) | null; hold: boolean } | null = null;
  private mats: THREE.MeshToonMaterial[] = [];

  constructor(readonly model: THREE.Object3D, clips: THREE.AnimationClip[]) {
    this.g.add(model); this.mixer = new THREE.AnimationMixer(model);
    for (const c of clips) if (!this.clips.has(c.name)) this.clips.set(c.name, c);
    this.mixer.addEventListener('finished', e => {
      const s = this.shot; if (!s || e.action !== s.a) return;
      if (!s.hold && this.base) this.base.reset().fadeIn(0.15).play(), s.a.fadeOut(0.15);
      this.shot = null; s.done?.();
    });
  }
  has(name: string) { return this.clips.has(name); }
  addClips(cs: THREE.AnimationClip[]) { for (const c of cs) if (!this.clips.has(c.name)) this.clips.set(c.name, c); }
  duration(name: string) { return this.clips.get(name)?.duration ?? 0; }
  private act(name: string) {
    const c = this.clips.get(name); if (!c) { console.warn('нет клипа', name); return null; }
    return this.mixer.clipAction(c);
  }
  /** Базовая зацикленная анимация (плавный переход). */
  loop(name: string, fade = 0.2, speed = 1) {
    const a = this.act(name); if (!a || a === this.base) { if (a) a.timeScale = speed; return; }
    a.reset().setLoop(THREE.LoopRepeat, Infinity); a.timeScale = speed; a.enabled = true;
    if (this.base) this.base.crossFadeTo(a, fade, false); a.play(); this.base = a;
  }
  baseName() { return this.base?.getClip().name ?? ''; }
  /** Разовая анимация; промис — когда доиграла. marks — колбэки в нужные моменты клипа. */
  play(name: string, o: PlayOpts = {}): Promise<void> {
    const a = this.act(name); if (!a) return Promise.resolve();
    if (this.shot) { this.shot.a.fadeOut(0.05); const d = this.shot.done; this.shot = null; d?.(); }
    a.reset(); a.setLoop(o.loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity); a.clampWhenFinished = !!o.hold; a.timeScale = o.speed ?? 1; a.enabled = true;
    if (this.base) this.base.fadeOut(o.fade ?? 0.1); a.fadeIn(o.fade ?? 0.1).play();
    if (o.loop) { this.base = a; this.shot = null; return Promise.resolve(); }
    return new Promise(res => { this.shot = { a, marks: (o.marks ?? []).slice().sort((x, y) => x.at - y.at), done: res, hold: !!o.hold }; });
  }
  /** Длительность разовой анимации с учётом скорости, секунды. */
  length(name: string, speed = 1) { return this.duration(name) / speed; }
  update(dt: number) {
    this.mixer.update(dt);
    const s = this.shot;
    if (s && s.marks.length) {
      const u = s.a.time / Math.max(0.001, s.a.getClip().duration);
      while (s.marks.length && u >= s.marks[0].at) s.marks.shift()!.fn();
    }
  }
  /** Собственные материалы (чтобы вспышка/покраска не задевали других). */
  ownMaterials() {
    if (this.mats.length) return this.mats;
    const seen = new Map<THREE.Material, THREE.MeshToonMaterial>();
    this.model.traverse(n => { const m = n as THREE.Mesh; if (!m.isMesh || m.userData.outline) return;
      const src = m.material as THREE.MeshToonMaterial;
      if (!seen.has(src)) { const c = src.clone(); seen.set(src, c); this.mats.push(c); }
      m.material = seen.get(src)!; });
    return this.mats;
  }
  /** Белая вспышка при попадании (0..1). */
  flash(v: number) { for (const m of this.ownMaterials()) { m.emissive.setRGB(v, v, v); } }
  /** Оттенок брони и одежды: множитель цвета (значения выше 1 — ярче), лицо, волосы и плащ не трогаем. glow — лёгкое свечение. */
  tint(mul: [number, number, number], glow = 0) {
    const seen = new Map<THREE.Material, THREE.MeshToonMaterial>();
    this.model.traverse(n => { const m = n as THREE.Mesh; if (!m.isMesh || m.userData.outline || /Head$|Cape$|Hat$/.test(m.name)) return;
      const src = m.material as THREE.MeshToonMaterial;
      if (!seen.has(src)) { const c = src.clone(); c.color.setRGB(src.color.r * mul[0], src.color.g * mul[1], src.color.b * mul[2]); if (glow) { c.emissive.setHex(glow); c.emissiveIntensity = 0.28; } seen.set(src, c); }
      m.material = seen.get(src)!; });
  }
  /** Плащ (награда за звёзды): свой плоский цвет только на плаще; null — как в модели. У героев без плаща (Варвар) ничего не делает. */
  setCape(c: { color: number; glow: boolean } | null) {
    this.model.traverse(n => { const m = n as THREE.Mesh; if (!m.isMesh || m.userData.outline || !/Cape$/.test(m.name)) return;
      if (!m.userData.capeOrig) m.userData.capeOrig = m.material;
      if (!c) { m.material = m.userData.capeOrig; return; }
      const mat = (m.userData.capeOrig as THREE.MeshToonMaterial).clone(); mat.map = null; mat.color.setHex(c.color);
      mat.emissive.setHex(c.glow ? c.color : 0x000000); mat.emissiveIntensity = c.glow ? 0.9 : 1; m.material = mat; });
  }
  bone(name: string): THREE.Object3D | null {
    const want = name.replace(/\./g, ''); let found: THREE.Object3D | null = null;
    this.model.traverse(o => { if (!found && o.name.replace(/\./g, '') === want) found = o; });
    return found;
  }
  show(part: string, on: boolean) { this.model.traverse(o => { if (o.name === part || o.name === part + '_outline') o.visible = on; }); }
  dispose() { this.mixer.stopAllAction(); this.mixer.uncacheRoot(this.model); }
}

// ---------- герой ----------
export type HeroKind = 'Knight' | 'Barbarian' | 'Mage' | 'Rogue' | 'Rogue_Hooded' | 'Ranger';
export const HERO_HEIGHT = 2.1;
const ANIM_SETS = ['General', 'MovementBasic', 'MovementAdvanced', 'CombatMelee', 'CombatRanged', 'Simulation'];
let heroClips: Promise<THREE.AnimationClip[]> | null = null;
export function heroAnimations() {
  heroClips ??= Promise.all(ANIM_SETS.map(s => loadModel(`anims/${s}.glb`))).then(gs => gs.flatMap(g => g.animations));
  return heroClips;
}
let itemsKit: Promise<Kit> | null = null;
export const items = () => (itemsKit ??= Kit.load('items'));

export async function createHero(kind: HeroKind): Promise<Actor> {
  const [gltf, clips] = await Promise.all([loadModel(`heroes/${kind}.glb`), heroAnimations()]);
  const model = SkeletonUtils.clone(gltf.scene);
  toonify(model, { outline: 0.012 });
  const a = new Actor(model, clips);
  scaleToHeight(a.g, HERO_HEIGHT); sitOnGround(a.g);
  a.loop('Idle_A', 0);
  return a;
}

export interface Loadout { weapon?: string; offhand?: string; hide?: string[] }
/** Оружие и щит в руки (слоты handslot.r / handslot.l), лишние части (шлем, шляпа) — скрыть. */
export async function dress(a: Actor, l: Loadout) {
  const kit = await items();
  for (const [slot, name] of [['handslot.r', l.weapon], ['handslot.l', l.offhand]] as const) {
    const b = a.bone(slot); if (!b || !name) continue;
    b.children.filter(c => c.userData.gear).forEach(c => b.remove(c));
    const it = kit.get(name, { outline: 0.01 }); it.userData.gear = true; b.add(it);
  }
  for (const p of l.hide ?? []) a.show(p, false);
}

// ---------- монстры ----------
export type MonsterClass = 'Blob' | 'Big' | 'Flying';
const CLASS_H: Record<MonsterClass, number> = { Blob: 1.5, Big: 2.7, Flying: 2.1 };
const ATTACK: Record<MonsterClass, string[]> = { Blob: ['Bite_Front'], Big: ['Punch', 'Weapon'], Flying: ['Punch', 'Headbutt'] };
export interface Monster { a: Actor; cls: MonsterClass; height: number; idle: string; attack: () => string; hit: string; death: string; hover: number }
export async function createMonster(id: string, scale = 1): Promise<Monster> {
  const cls = id.split('_')[0] as MonsterClass;
  const gltf = await loadModel(`monsters/${id}.glb`);
  const model = SkeletonUtils.clone(gltf.scene);
  toonify(model, { outline: 0.02 });
  const a = new Actor(model, gltf.animations);
  const height = CLASS_H[cls] * scale;
  scaleToHeight(a.g, height); sitOnGround(a.g);
  const idle = a.has('Idle') ? 'Idle' : 'Flying_Idle';
  a.loop(idle, 0);
  const atk = ATTACK[cls].filter(n => a.has(n)); let i = 0;
  return { a, cls, height, idle, attack: () => atk[i++ % Math.max(1, atk.length)] ?? idle, hit: a.has('HitReact') ? 'HitReact' : 'HitRecieve', death: 'Death', hover: cls === 'Flying' ? 0.9 : 0 };
}
