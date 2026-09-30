// Мелкие предметы героя, которых нет в наборе items: молоток для починки корабля (код, мультяшный) и то, что вешается в руки вместо меча и щита.
// Лук и стрела — из набора items (bow_withString, arrow_bow): здесь только правильный поворот в слотах рук (у KayKit лук в левой руке, стрела на тетиве в правой).
// Размеры — в единицах кости руки (как у меча из набора: рукоять в начале координат, клинок вдоль +y).
import * as THREE from 'three';
import { toonify } from './assets';
import { items } from './actor';
import type { Actor } from './actor';

let hammerGeo: { handle: THREE.BufferGeometry; head: THREE.BufferGeometry; cap: THREE.BufferGeometry } | null = null;
const wood = new THREE.MeshStandardMaterial({ color: 0xb8763a }), steel = new THREE.MeshStandardMaterial({ color: 0xb9c2d8 }), band = new THREE.MeshStandardMaterial({ color: 0xffcb2e });

/** Молоток: деревянная рукоять, стальной боёк с золотой полосой. Хват в начале координат, боёк вверху (ось бойка вдоль x — бьёт вбок от кисти). */
export function buildHammer(): THREE.Object3D {
  hammerGeo ??= { handle: new THREE.CylinderGeometry(0.045, 0.055, 0.7, 8), head: new THREE.BoxGeometry(0.42, 0.24, 0.24), cap: new THREE.BoxGeometry(0.06, 0.27, 0.27) };
  const g = new THREE.Group(); g.name = 'hammer';
  const handle = new THREE.Mesh(hammerGeo.handle, wood); handle.position.y = 0.22;
  const head = new THREE.Mesh(hammerGeo.head, steel); head.position.y = 0.6;
  for (const s of [-1, 1]) { const cap = new THREE.Mesh(hammerGeo.cap, band); cap.position.set(s * 0.18, 0.6, 0); g.add(cap); }
  g.add(handle, head);
  return toonify(g, { outline: 0.012 });
}

/** Лук в левую руку (тетива смотрит на стрелка), стрела на тетиве в правую. Предметы отдаём Actor.carry: меч и щит на это время прячутся. */
export interface Bow { bow: THREE.Object3D; arrow: THREE.Object3D; /** Летящая стрела: остриё вдоль +z (setFromUnitVectors от оси z к направлению полёта). */ flying(): THREE.Object3D }
export async function bowLoadout(): Promise<Bow> {
  const kit = await items();
  const bow = kit.get('bow_withString', { outline: 0.01 }), arrow = kit.get('arrow_bow', { outline: 0.01 });
  bow.rotation.y = Math.PI; arrow.rotation.x = -Math.PI / 2;
  return { bow, arrow, flying: () => { const g = new THREE.Group(); g.add(kit.get('arrow_bow', { outline: 0.01 })); g.scale.setScalar(0.9); return g; } };
}
export const holdBow = (a: Actor, l: Bow, withArrow: boolean) =>
  a.carry([{ slot: 'handslot.l', obj: l.bow }, ...(withArrow ? [{ slot: 'handslot.r' as const, obj: l.arrow }] : [])]);
