// Актёры: герой и монстры с настоящими анимациями (готовые клипы KayKit / Quaternius).
import * as THREE from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { loadModel, Kit, toonify, scaleToHeight, sitOnGround } from './assets';

export interface Mark { at: number; fn: () => void }   // at — доля клипа 0..1, когда сработает fn (момент удара и т.п.)
// then — после естественного конца разовой анимации сразу зацикленная база с этим именем (сел, лёг, встал): без мигания прежней позы между ними
interface PlayOpts { speed?: number; fade?: number; marks?: Mark[]; hold?: boolean; loop?: boolean; then?: string; thenSpeed?: number }

/** Модель + микшер. Базовая анимация зациклена (стойка, ходьба), разовые (удар, блок) играются поверх и возвращаются к ней. */
// Жесты «не для боя» (радость, взмах, почесать голову, осмотреться, сесть, покачаться) — без меча и щита в руках: с оружием они выглядят нелепо.
// Удар, блок, стойка, ходьба — с оружием. Правило общее для корабля, карты, урока и боя.
// Бой с тенью и магия — тоже без оружия: кулаки и пустые руки; лук и молоток — отдельно, через carry() (в руках вместо меча и щита).
const UNARMED = /^(Sit_|Push_Ups|Sit_Ups|Waving|Cheering|Idle_B|Interact|Use_Item|Lie_|Dance|Melee_Unarmed|Ranged_Magic)/;

export class Actor {
  readonly g = new THREE.Group();
  readonly mixer: THREE.AnimationMixer;
  private clips = new Map<string, THREE.AnimationClip>();
  private base: THREE.AnimationAction | null = null;
  private shot: { a: THREE.AnimationAction; marks: Mark[]; done: (() => void) | null; hold: boolean; then?: string; thenSpeed?: number } | null = null;
  private mats: THREE.MeshToonMaterial[] = [];
  private held: THREE.Object3D[] = [];

  constructor(readonly model: THREE.Object3D, clips: THREE.AnimationClip[]) {
    this.g.add(model); this.mixer = new THREE.AnimationMixer(model);
    for (const c of clips) if (!this.clips.has(c.name)) this.clips.set(c.name, c);
    this.mixer.addEventListener('finished', e => {
      const s = this.shot; if (!s || e.action !== s.a) return;
      if (!s.hold && this.base) this.base.reset().fadeIn(0.15).play(), s.a.fadeOut(0.15);
      this.shot = null; if (!s.hold) this.gear(this.baseName());
      // переход в новую базу: удержанная последняя поза плавно уступает ей (без мигания прежней стойки)
      if (s.then) { s.a.fadeOut(0.2); this.play(s.then, { loop: true, fade: 0.2, speed: s.thenSpeed }); }
      s.done?.();
    });
  }
  has(name: string) { return this.clips.has(name); }
  /** Заранее создать и привязать действия клипов (первый настоящий запуск не тратит время на привязку костей). */
  prime(names: string[]) { for (const n of names) { const a = this.has(n) ? this.act(n) : null; if (a) { a.setEffectiveWeight(0); a.play(); a.stop(); a.setEffectiveWeight(1); } } }
  addClips(cs: THREE.AnimationClip[]) { for (const c of cs) if (!this.clips.has(c.name)) this.clips.set(c.name, c); }
  duration(name: string) { return this.clips.get(name)?.duration ?? 0; }
  private act(name: string) {
    const c = this.clips.get(name); if (!c) { console.warn('нет клипа', name); return null; }
    return this.mixer.clipAction(c);
  }
  /** Базовая зацикленная анимация (плавный переход). */
  loop(name: string, fade = 0.2, speed = 1) {
    const a = this.act(name); if (!a || a === this.base) { if (a) a.timeScale = speed; return; }
    // цикл, который ещё гаснет (только что сменили), подхватывается с того же места, а не с начала — иначе шаг «заикается»
    if (!a.isRunning()) { a.reset(); a.setEffectiveWeight(1); }
    a.setLoop(THREE.LoopRepeat, Infinity); a.timeScale = speed; a.enabled = true;
    if (this.base) this.base.crossFadeTo(a, fade, false); a.play(); this.base = a;
    if (!this.shot) this.gear(name);
  }
  /** Меч и щит (предметы в слотах рук, userData.gear) видны, только если клип боевой или обычный (UNARMED — нет) и в руках нет лука или молотка (carry). */
  gear(clip: string) {
    const bare = this.held.length > 0 || UNARMED.test(clip);
    this.model.traverse(o => { if (o.userData.gear) o.visible = !bare; });
  }
  /** В руки вместо меча и щита: предметы встают в слоты рук (handslot.r / handslot.l), меч и щит прячутся, пока предметы в руках. Пустой список — предметы убраны, меч и щит вернулись (по текущему клипу). */
  carry(items: { slot: 'handslot.r' | 'handslot.l'; obj: THREE.Object3D }[]) {
    for (const o of this.held) o.parent?.remove(o);
    this.held = [];
    for (const it of items) { const b = this.bone(it.slot); if (!b) continue; b.add(it.obj); this.held.push(it.obj); }
    this.gear(this.shot ? this.shot.a.getClip().name : this.baseName());
  }
  get carrying() { return this.held.length > 0; }
  /** Оборвать разовую анимацию и сразу вернуть базовую стойку (меч и щит появляются сразу, а не после конца жеста). */
  settle(fade = 0.1) {
    if (this.shot) { this.cut(); if (this.base) this.base.reset().fadeIn(fade).play(); }
    this.gear(this.baseName());
  }
  baseName() { return this.base?.getClip().name ?? ''; }
  /** Разовая анимация; промис — когда доиграла. marks — колбэки в нужные моменты клипа. */
  play(name: string, o: PlayOpts = {}): Promise<void> {
    const a = this.act(name); if (!a) return Promise.resolve();
    this.cut(); this.gear(name);
    a.reset(); a.setEffectiveWeight(1); a.setLoop(o.loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity); a.clampWhenFinished = !!o.hold || !!o.then; a.timeScale = o.speed ?? 1; a.enabled = true;
    if (this.base) this.base.fadeOut(o.fade ?? 0.1); a.fadeIn(o.fade ?? 0.1).play();
    if (o.loop) { this.base = a; return Promise.resolve(); }
    return new Promise(res => { this.shot = { a, marks: (o.marks ?? []).slice().sort((x, y) => x.at - y.at), done: res, hold: !!o.hold || !!o.then, then: o.then, thenSpeed: o.thenSpeed }; });
  }
  /** Идёт разовая анимация с ещё не сработавшими метками (например, удар до момента касания). */
  marksPending() { return !!this.shot && this.shot.marks.length > 0; }
  /** Оборвать текущую разовую анимацию. Несработавшие метки (момент удара) срабатывают сразу, по одному разу, и промис завершается: иначе удар терял бы касание и ждал таймаут. */
  private cut() {
    const s = this.shot; if (!s) return;
    this.shot = null; s.a.fadeOut(0.05);
    const ms = s.marks; s.marks = [];
    for (const m of ms) m.fn();
    s.done?.();
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
  dispose() {
    // оборванная разовая анимация (модель меняют посреди радости — смена костюма) завершает свой промис: иначе ждущий навсегда «занят».
    // Метки (момент удара) при этом не срабатывают: модели уже нет
    { const s = this.shot; this.shot = null; s?.done?.(); }
    this.mixer.stopAllAction(); this.mixer.uncacheRoot(this.model);
    // клон скелета создаёт свою текстуру костей (Skeleton.computeBoneTexture) — без dispose она копилась с каждым врагом; материалы — копии этого актёра
    const sk = new Set<THREE.Skeleton>();
    this.model.traverse(o => { const s = (o as THREE.SkinnedMesh).skeleton; if (s && !sk.has(s)) { sk.add(s); s.dispose(); } });
    for (const m of this.mats) m.dispose();
  }
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
// наборы клипов, которые нужны редко и тяжёлые (Tools: молоток на корабле) — грузятся только по требованию и один раз
const extraSets = new Map<string, Promise<THREE.AnimationClip[]>>();
/** Догрузить набор клипов (public/models/anims/<набор>.glb) актёру: после этого его клипы доступны в play/loop. */
export async function addAnimSet(a: Actor, set: 'Tools') {
  let p = extraSets.get(set); if (!p) extraSets.set(set, p = loadModel(`anims/${set}.glb`).then(g => g.animations));
  a.addClips(await p);
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
