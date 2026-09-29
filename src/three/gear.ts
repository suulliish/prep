// Экипировка героя: шапки, оружие, плащ, щит, аура. Всё из вокселей part(), в группах 'gear' (снимаются целиком).
import * as THREE from 'three';
import { part } from './characters';

export type Hat = 'visor' | 'crown' | 'phones' | 'hood' | 'horns' | 'icecrown' | 'voidhood' | 'crystal';
export type Weapon = 'key' | 'great' | 'katana' | 'axe' | 'flame' | 'spear' | 'scythe' | 'crystal';
export interface Gear { hat: Hat; weapon: Weapon; cape?: number; capeGlow?: boolean; shield?: number; aura?: number }
export interface Equipped { blade: THREE.Mesh; cape: THREE.Group | null; aura: THREE.Group | null; shield: THREE.Group | null }
type Hero = { head: THREE.Object3D; body: THREE.Object3D; armR: THREE.Object3D; armL: THREE.Object3D; g: THREE.Object3D };
type Cols = { jacket: number; dark: number; visor: number };

const GOLD = 0xffc94a, GOLD_E = 0x6b4a0a, WOOD = 0x5a3519;
const O = { outline: false } as const;
const glowO = (c: number, ei = 1.5) => ({ emissive: c, ei, outline: false });
const grp = (parent: THREE.Object3D, x = 0, y = 0, z = 0) => { const g = new THREE.Group(); g.name = 'gear'; g.position.set(x, y, z); parent.add(g); return g; };
/** Свой материал, чтобы пульсация свечения не задевала общий кэш. */
const own = (m: THREE.Mesh) => { m.material = (m.material as THREE.Material).clone(); return m; };
const rot = (m: THREE.Mesh, x = 0, y = 0, z = 0) => { m.rotation.set(x, y, z); return m; };

// ---------- Шапки (голова: верх y≈0.6, лицо +z) ----------
function buildHat(head: THREE.Object3D, hat: Hat, c: Cols) {
  const g = grp(head);
  switch (hat) {
    case 'visor': // антенна сбоку, визор уже есть у героя
      part(g, 0.05, 0.3, 0.05, 0.42, 0.86, -0.1, 0x7d86b8, O);
      part(g, 0.12, 0.12, 0.12, 0.42, 1.06, -0.1, c.visor, glowO(c.visor, 2));
      break;
    case 'crown':
      part(g, 0.92, 0.16, 0.88, 0, 0.66, 0, GOLD, { emissive: GOLD_E, ei: 0.6 });
      [-0.36, -0.18, 0, 0.18, 0.36].forEach((x, i) => {
        part(g, 0.14, i % 2 ? 0.24 : 0.36, 0.14, x, 0.86 + (i % 2 ? 0 : 0.06), 0.3, GOLD, { emissive: GOLD_E, ei: 0.6, outline: i % 2 === 0 });
        part(g, 0.09, 0.09, 0.09, x, 1.06 + (i % 2 ? -0.02 : 0.1), 0.3, i % 2 ? 0x3ff0ff : 0xff3a5a, glowO(i % 2 ? 0x3ff0ff : 0xff3a5a, 2));
      });
      part(g, 0.16, 0.12, 0.06, 0, 0.66, 0.45, 0xff3a5a, glowO(0xff3a5a, 1.8));
      break;
    case 'phones':
      part(g, 1.2, 0.1, 0.2, 0, 0.92, -0.02, 0x1b1d33);
      [-1, 1].forEach(s => {
        part(g, 0.1, 0.6, 0.2, s * 0.56, 0.62, -0.02, 0x1b1d33, O);
        part(g, 0.22, 0.44, 0.4, s * 0.6, 0.08, -0.02, 0x1b1d33);
        part(g, 0.06, 0.32, 0.28, s * 0.72, 0.08, -0.02, c.visor, glowO(c.visor, 2.2));
      });
      break;
    case 'hood':
      part(g, 1.18, 0.36, 1.12, 0, 0.68, -0.03, 0x2f8a3e);
      part(g, 1.18, 0.9, 0.3, 0, 0.18, -0.5, 0x2a7536);
      [-1, 1].forEach(s => part(g, 0.12, 0.7, 0.9, s * 0.56, 0.24, -0.06, 0x2a7536, O));
      part(g, 1.0, 0.12, 0.1, 0, 0.55, 0.5, 0x1f5a2a, O); // кайма над лбом
      rot(part(g, 0.14, 0.5, 0.3, 0, 1.0, -0.05, 0x8ee05a, { emissive: 0x3a8a1a, ei: 0.5 }), 0.4, 0, 0.3); // лист
      break;
    case 'horns':
      part(g, 1.14, 0.34, 1.06, 0, 0.62, -0.02, 0x2b2333);
      part(g, 1.14, 0.7, 0.24, 0, 0.3, -0.5, 0x2b2333, O);
      [-1, 1].forEach(s => {
        rot(part(g, 0.22, 0.3, 0.22, s * 0.56, 0.86, 0, 0xf0e6d0), 0, 0, -s * 0.3);
        rot(part(g, 0.18, 0.3, 0.18, s * 0.7, 1.08, 0, 0xf0e6d0), 0, 0, -s * 0.6);
        rot(part(g, 0.14, 0.26, 0.14, s * 0.86, 1.28, 0, 0xff6a1a, glowO(0xff4a10, 1.4)), 0, 0, -s * 0.9);
      });
      break;
    case 'icecrown':
      part(g, 0.96, 0.14, 0.9, 0, 0.66, 0, 0xbfeaff, glowO(0x7fd0ff, 0.6));
      [[-0.4, 0.3], [-0.2, 0.46], [0, 0.6], [0.2, 0.46], [0.4, 0.3]].forEach(([x, h], i) =>
        rot(part(g, 0.14, h, 0.14, x, 0.72 + h / 2, 0.2 - (i % 2) * 0.05, 0xd9f4ff, glowO(0x9fe3ff, 0.9)), 0, 0.4, x * 0.4));
      break;
    case 'voidhood':
      part(g, 1.18, 0.36, 1.12, 0, 0.68, -0.03, 0x2a1256);
      part(g, 1.18, 0.9, 0.3, 0, 0.18, -0.5, 0x22104a);
      [-1, 1].forEach(s => part(g, 0.12, 0.7, 0.9, s * 0.56, 0.24, -0.06, 0x22104a, O));
      part(g, 1.0, 0.12, 0.1, 0, 0.55, 0.5, 0x120830, O);
      rot(part(g, 0.3, 0.4, 0.3, 0, 1.0, -0.2, 0x2a1256), 0.5, 0, 0);
      [[-0.3, 0.72, 0.4], [0.25, 0.8, 0.3], [0, 0.9, 0.05], [-0.5, 0.4, 0.2], [0.52, 0.5, 0.1], [0, 0.3, -0.66]].forEach(([x, y, z]) =>
        part(g, 0.09, 0.09, 0.09, x, y, z, 0xb58cff, glowO(0xb58cff, 2.4)));
      break;
    case 'crystal': {
      const cr = (s: number, x: number, y: number, z: number, col: number) => rot(part(g, s, s * 1.5, s, x, y, z, col, glowO(col === 0xffffff ? 0xd9c8ff : 0x9a6bff, 1.4)), 0, Math.PI / 4, Math.PI / 4);
      cr(0.3, 0, 1.05, 0, 0xffffff);
      [[0.5, 0], [-0.5, 0], [0, 0.5], [0, -0.5]].forEach(([x, z], i) => cr(0.17, x, 0.95 + (i % 2) * 0.1, z, i % 2 ? 0xffffff : 0xb58cff));
      break;
    }
  }
}

// ---------- Оружие (в руке, вдоль +z) ----------
function buildWeapon(armR: THREE.Object3D, w: Weapon): THREE.Mesh {
  const g = grp(armR, 0, -0.64, 0.12);
  const grip = (len = 0.34, z = 0.02) => part(g, 0.1, 0.1, len, 0, 0, z, WOOD, O);
  const guard = (wd: number, col = GOLD) => part(g, wd, 0.1, 0.1, 0, 0, 0.2, col, { emissive: GOLD_E, ei: 0.8 });
  let b: THREE.Mesh;
  switch (w) {
    case 'key':
      grip(); guard(0.42);
      b = part(g, 0.14, 0.08, 1.15, 0, 0, 0.8, 0x9ffcff, { emissive: 0x3ff0ff, ei: 1.8 }); break;
    case 'great':
      grip(); guard(0.6);
      part(g, 0.04, 0.09, 1.5, -0.14, 0, 0.98, GOLD, { emissive: GOLD_E, ei: 0.6, outline: false });
      part(g, 0.04, 0.09, 1.5, 0.14, 0, 0.98, GOLD, { emissive: GOLD_E, ei: 0.6, outline: false });
      b = part(g, 0.26, 0.08, 1.5, 0, 0, 0.98, 0xe8ecf5, { emissive: 0xffd27a, ei: 0.5 }); break;
    case 'katana':
      grip(0.4); part(g, 0.22, 0.22, 0.05, 0, 0, 0.24, 0x2b2333, O);
      b = part(g, 0.06, 0.1, 1.5, 0, 0, 1.0, 0xffb0e8, { emissive: 0xff4fb8, ei: 1.2 }); break;
    case 'axe':
      part(g, 0.1, 0.1, 1.2, 0, 0, 0.55, WOOD);
      part(g, 0.14, 0.52, 0.34, 0, 0, 1.05, 0x8b93a8);
      b = part(g, 0.1, 0.8, 0.18, 0, 0, 1.2, 0xd9def0, { emissive: 0x88aaff, ei: 0.35 }); break;
    case 'flame':
      grip(); guard(0.42, 0x8a2b1a);
      b = part(g, 0.16, 0.08, 1.15, 0, 0, 0.8, 0xff9a3c, { emissive: 0xff4a10, ei: 1.8 });
      [0.5, 0.95, 1.35].forEach((z, i) => rot(part(g, 0.13 - i * 0.02, 0.13 - i * 0.02, 0.13 - i * 0.02, 0, 0.12 + i * 0.03, z, i % 2 ? 0xffe066 : 0xff7a1a, glowO(i % 2 ? 0xffc94a : 0xff4a10, 2.2)), 0.6, 0.6, 0));
      break;
    case 'spear':
      part(g, 0.08, 0.08, 1.8, 0, 0, 0.7, 0x3d4a66);
      part(g, 0.16, 0.16, 0.1, 0, 0, 1.55, 0xd9f4ff, O);
      b = rot(part(g, 0.18, 0.1, 0.5, 0, 0, 1.85, 0xbfeaff, { emissive: 0x7fd0ff, ei: 1.5 }), 0, 0, Math.PI / 4); break;
    case 'scythe': {
      part(g, 0.09, 0.09, 1.8, 0, 0, 0.7, 0x2b2333);
      let y = 0, z = 1.65; b = null as unknown as THREE.Mesh;
      ([[-0.25, 0.5], [-0.9, 0.45], [-1.6, 0.4]] as const).forEach(([a, len], i) => {
        const dy = -Math.sin(a), dz = Math.cos(a);
        const m = rot(part(g, 0.06, 0.16 - i * 0.03, len, 0, y + dy * len / 2, z + dz * len / 2, 0xb58cff, { emissive: 0x8a3cff, ei: 1.6 }), a, 0, 0);
        if (i === 1) b = m; y += dy * len; z += dz * len;
      });
      break;
    }
    case 'crystal':
      grip(); part(g, 0.4, 0.14, 0.14, 0, 0, 0.2, 0x9a6bff, glowO(0x8a3cff, 1.2));
      b = rot(part(g, 0.24, 0.24, 1.3, 0, 0, 0.95, 0xf2eaff, { emissive: 0xb58cff, ei: 1.6 }), 0, 0, Math.PI / 4);
      rot(part(g, 0.16, 0.16, 0.3, 0, 0, 1.7, 0xffffff, glowO(0xd9c8ff, 2)), 0, 0, Math.PI / 4);
      break;
  }
  return own(b);
}

// ---------- Плащ и щит ----------
function buildCape(body: THREE.Object3D, col: number, glow: boolean, dots: boolean) {
  const p = grp(body, 0, 0.36, -0.53);
  const ge = glow ? { emissive: col, ei: 0.4 } : {};
  part(p, 0.84, 1.1, 0.06, 0, -0.55, -0.05, col, { r: 0.03, ...ge });
  part(p, 0.86, 0.1, 0.08, 0, -1.08, -0.05, col, { ...ge, ei: glow ? 0.9 : 1, outline: false });
  part(p, 0.9, 0.1, 0.1, 0, -0.02, 0, GOLD, { emissive: GOLD_E, ei: 0.6, outline: false }); // застёжка-воротник
  if (dots) [[-0.25, -0.3], [0.2, -0.5], [-0.05, -0.8], [0.28, -0.85], [-0.3, -0.75]].forEach(([x, y]) => part(p, 0.07, 0.07, 0.03, x, y, -0.1, 0xb58cff, glowO(0xb58cff, 2.4)));
  return p;
}
function buildShield(armL: THREE.Object3D, col: number) {
  const s = grp(armL, -0.2, -0.6, 0.06);
  part(s, 0.08, 0.7, 0.7, 0.03, 0, 0, GOLD, { emissive: GOLD_E, ei: 0.6, r: 0.2 });   // золотой обод
  part(s, 0.1, 0.56, 0.56, -0.02, 0, 0, col, { r: 0.18 });
  part(s, 0.06, 0.24, 0.24, -0.09, 0, 0, GOLD, { emissive: GOLD_E, ei: 0.9, r: 0.06, outline: false }); // эмблема
  return s;
}

/** Аура: 6 светящихся кубиков вокруг героя. */
function buildAura(root: THREE.Object3D, col: number) {
  const a = grp(root);
  for (let i = 0; i < 6; i++) {
    const an = (i / 6) * Math.PI * 2, y = 0.8 + (i / 5) * 1.8;
    const m = part(a, 0.16, 0.16, 0.16, Math.cos(an) * 1.1, y, Math.sin(an) * 1.1, col, glowO(col, 2.2)); m.userData.y0 = y;
  }
  return a;
}

/** Снимает старую экипировку и надевает новую. colors = jacket/dark/visor выбранного наряда. */
export function equip(h: Hero, gear: Gear, colors: Cols): Equipped {
  for (const o of [h.head, h.body, h.armR, h.armL, h.g])
    for (const c of [...o.children]) if (c.name === 'gear') o.remove(c);
  // родной меч героя: безымянная группа в armR (не меши руки)
  h.armR.children.forEach(c => { if ((c as THREE.Group).isGroup && c.name !== 'gear') c.visible = false; });
  buildHat(h.head, gear.hat, colors);
  const blade = buildWeapon(h.armR, gear.weapon);
  const cape = gear.cape !== undefined ? buildCape(h.body, gear.cape, !!gear.capeGlow, gear.weapon === 'scythe') : null;
  const shield = gear.shield !== undefined ? buildShield(h.armL, gear.shield) : null;
  const aura = gear.aura !== undefined ? buildAura(h.g, gear.aura) : null;
  return { blade, cape, aura, shield };
}

/** Каждый кадр: плащ качается (сильнее при ходьбе), аура вращается и покачивается. */
export function animateGear(e: Equipped, t: number, walking: boolean) {
  if (e.cape) e.cape.rotation.x = 0.12 + Math.sin(t * 3) * 0.05 + (walking ? 0.45 + Math.sin(t * 16) * 0.12 : 0); // +x = назад (−z)
  if (e.aura) {
    e.aura.rotation.y = t * 1.2;
    e.aura.children.forEach((c, i) => { c.position.y = c.userData.y0 + Math.sin(t * 2 + i * 1.3) * 0.15; c.rotation.y = t + i; });
  }
}

export const GEAR: Record<string, Gear> = {
  cyan: { hat: 'visor', weapon: 'key' },
  gold: { hat: 'crown', weapon: 'great', cape: 0xc2303a, shield: 0xf2b632 },
  pink: { hat: 'phones', weapon: 'katana', cape: 0x7a2bd9, capeGlow: true },
  forest: { hat: 'hood', weapon: 'axe', cape: 0x2f7a3e, shield: 0x8a5a2b },
  lava: { hat: 'horns', weapon: 'flame', cape: 0xff6a1a, capeGlow: true },
  frost: { hat: 'icecrown', weapon: 'spear', cape: 0xeaf6ff, shield: 0x9fe3ff },
  void: { hat: 'voidhood', weapon: 'scythe', cape: 0x1a0f3a, capeGlow: true, aura: 0xb58cff },
  crystal: { hat: 'crystal', weapon: 'crystal', cape: 0x8a5bff, capeGlow: true, shield: 0xd9c8ff, aura: 0xffffff },
};
