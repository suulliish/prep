// Готовые модели (public/models, сборка: scripts/assets/build.mjs). Загрузка с кэшем, единый мультяшный вид, привязка к земле.
import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';

const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const url = (path: string) => new URL(`models/${path}`, document.baseURI).href;
const cache = new Map<string, Promise<GLTF>>();
export function loadModel(path: string): Promise<GLTF> {
  if (!cache.has(path)) cache.set(path, loader.loadAsync(url(path)));
  return cache.get(path)!;
}

// ---------- единый вид: ступенчатый свет + контур ----------
const gradient = (() => {
  const t = new THREE.DataTexture(new Uint8Array([90, 170, 255]), 3, 1, THREE.RedFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t;
})();
const toonOf = new WeakMap<THREE.Material, THREE.MeshToonMaterial>();
/** Материал модели → мультяшный (та же текстура-палитра). Один на исходный материал, поэтому клоны делят его. */
export function toonMat(src: THREE.Material): THREE.MeshToonMaterial {
  let m = toonOf.get(src);
  if (!m) {
    const s = src as THREE.MeshStandardMaterial;
    m = new THREE.MeshToonMaterial({ map: s.map ?? null, color: s.color ? s.color.clone() : 0xffffff, gradientMap: gradient, side: s.side,
      transparent: s.transparent, alphaTest: s.alphaTest, vertexColors: s.vertexColors, emissive: s.emissive ? s.emissive.clone() : 0x000000, emissiveMap: s.emissiveMap ?? null });
    if (m.map) m.map.anisotropy = 4;
    toonOf.set(src, m);
  }
  return m;
}
/** Контур: тот же меш, вывернутый и раздутый по нормалям на thick (в единицах модели). */
const outlineMats = new Map<number, THREE.MeshBasicMaterial>();
function outlineMat(thick: number, color = 0x0a0b1e) {
  const k = thick * 1000 + color;
  if (!outlineMats.has(k)) {
    const m = new THREE.MeshBasicMaterial({ color, side: THREE.BackSide });
    m.onBeforeCompile = sh => { sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>\n transformed += normalize(normal) * ${thick.toFixed(5)};`); };
    outlineMats.set(k, m);
  }
  return outlineMats.get(k)!;
}

export interface ToonOpts { outline?: number; shadows?: boolean }
/** Привести модель к общему виду. outline — толщина контура (0/не задано — без контура). */
export function toonify<T extends THREE.Object3D>(root: T, o: ToonOpts = {}): T {
  const meshes: THREE.Mesh[] = [];
  root.traverse(n => { if ((n as THREE.Mesh).isMesh) meshes.push(n as THREE.Mesh); });
  for (const m of meshes) {
    m.material = Array.isArray(m.material) ? m.material.map(toonMat) : toonMat(m.material);
    m.castShadow = o.shadows ?? true; m.receiveShadow = o.shadows ?? true;
    if (o.outline) {
      const skinned = (m as THREE.SkinnedMesh).isSkinnedMesh;
      let ol: THREE.Mesh;
      if (skinned) { const s = m as THREE.SkinnedMesh, sk = new THREE.SkinnedMesh(m.geometry, outlineMat(o.outline)); sk.bind(s.skeleton, s.bindMatrix); ol = sk; }
      else ol = new THREE.Mesh(m.geometry, outlineMat(o.outline));
      ol.name = m.name + '_outline'; ol.frustumCulled = false; ol.userData.outline = true;
      m.parent!.add(ol); ol.position.copy(m.position); ol.quaternion.copy(m.quaternion); ol.scale.copy(m.scale);
    }
  }
  return root;
}

// ---------- наборы ----------
/** Набор моделей в одном файле: у каждой корневой узел с именем исходного файла. */
export class Kit {
  private constructor(private gltf: GLTF) {}
  static async load(id: string) { return new Kit(await loadModel(`kits/${id}.glb`)); }
  get clips(): THREE.AnimationClip[] { return this.gltf.animations; }
  private top(name: string) { return this.gltf.scene.children.find(c => c.name === 'K_' + name); }
  has(name: string) { return !!this.top(name); }
  names(): string[] { return this.gltf.scene.children.map(c => c.name).filter(n => n.startsWith('K_')).map(n => n.slice(2)); }
  /** Копия модели (геометрия и материалы общие). Подошва на y=0 — если ground; иначе как в исходнике. */
  get(name: string, o: { ground?: boolean; height?: number } & ToonOpts = {}): THREE.Object3D {
    const src = this.top(name);
    if (!src) throw new Error(`Нет модели «${name}» в наборе`);
    const g = new THREE.Group(); g.name = name;
    const inst = SkeletonUtils.clone(src);   // собственное преобразование узла не трогаем: в нём сжатие (квантование) вершин
    g.add(inst); toonify(g, o);
    if (o.height) scaleToHeight(g, o.height);
    if (o.ground) sitOnGround(g);
    return g;
  }
}

const box = new THREE.Box3(), vec = new THREE.Vector3();
/** Масштаб группы так, чтобы её высота стала h. */
export function scaleToHeight(g: THREE.Object3D, h: number) {
  g.updateMatrixWorld(true); box.setFromObject(g); box.getSize(vec);
  if (vec.y > 0) g.scale.multiplyScalar(h / vec.y);
  g.updateMatrixWorld(true);
}
/** Опустить/поднять так, чтобы нижняя точка (по габаритам) оказалась на y=0 локальной системы родителя. */
export function sitOnGround(g: THREE.Object3D, groundY = 0) {
  g.updateMatrixWorld(true); box.setFromObject(g);
  const inner = g.children[0]; // сдвигаем внутренний узел, чтобы не трогать положение группы
  const dy = groundY - box.min.y; (inner ?? g).position.y += dy / (g.scale.y || 1);
  g.updateMatrixWorld(true);
}
/** Нижняя точка модели в мировых координатах (для автопроверки «ничего не висит»). */
export function bottomY(g: THREE.Object3D): number { g.updateMatrixWorld(true); return new THREE.Box3().setFromObject(g).min.y; }
