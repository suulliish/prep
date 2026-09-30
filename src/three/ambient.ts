// Живой фон боевого острова: общий «тикер» кадра, качание деревьев и травы, рябь воды, уборка ресурсов при пересборке острова.
// Арена (arena.ts) ничего не знает об этих эффектах: остров сам несёт невидимую точку, у которой onBeforeRender раз в кадр вызывает
// зарегистрированные обновления (тот же приём, что у drift() в worlds/_fx789.ts). Эффекты-частицы лежат в ambient_fx.ts.
import * as THREE from 'three';
import type { Kit } from './assets';

/** Состояние кадра для эффектов. km — доля движения (0.3 при «уменьшить движение»), density — плотность частиц (1 на high, 0.5 на low). */
export interface AmbientCtx { t: number; dt: number; km: number; density: number; high: boolean; camera: THREE.Camera | null; scene: THREE.Scene | null }
export type Updater = (c: AmbientCtx) => void;
type Disposable = { dispose(): void };

/** Системная настройка «уменьшить движение» (та же, что читает App.svelte при создании мира). */
export const reducedMotion = (): boolean => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
export const REDUCED_KM = 0.3;

/** Детерминированный генератор 0..1 (LCG): один и тот же остров каждый раз одинаково расставляет эффекты. */
export function rng(seed: number): () => number {
  let s = (Math.floor(seed) * 9301 + 49297) >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

const TEX_KEYS = ['map', 'alphaMap', 'emissiveMap', 'aoMap', 'normalMap'] as const;
const asList = <T>(x: T | T[] | undefined): T[] => (Array.isArray(x) ? x : x ? [x] : []);

export class Ambient {
  readonly ctx: AmbientCtx = { t: 0, dt: 0, km: reducedMotion() ? REDUCED_KM : 1, density: 1, high: true, camera: null, scene: null };
  /** Общее время ветра для всех качающихся материалов острова. */
  readonly wind = { value: 0 };
  private ups: Updater[] = [];
  private dens: ((d: number) => void)[] = [];
  private cleanups: (() => void)[] = [];
  private densityKnown = -1;
  private dead = false;
  private last = 0;
  private readonly shared = { geo: new Set<THREE.BufferGeometry>(), mat: new Set<THREE.Material>(), tex: new Set<THREE.Texture>() };

  constructor(readonly g: THREE.Group) {
    // невидимая точка: рисуется первой (renderOrder −1000), поэтому обновления успевают до отрисовки остального
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0], 3));
    const p = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.001, colorWrite: false, depthWrite: false, depthTest: false }));
    p.frustumCulled = false; p.renderOrder = -1000; p.name = 'ambient_tick';
    p.onBeforeRender = (r, scene, cam) => this.frame(performance.now(), r.shadowMap.enabled, scene, cam);
    g.add(p);
    // арена убирает остров через remove(): в этот момент освобождаем всё своё
    g.addEventListener('removed', () => this.dispose());
  }

  /** Шаг кадра (в onBeforeRender). now — миллисекунды; high — включены тени (признак качества high). */
  frame(now: number, high: boolean, scene: THREE.Scene | null = null, camera: THREE.Camera | null = null) {
    if (this.dead) return;
    const c = this.ctx;
    const dt = this.last ? Math.min(0.1, Math.max(0, (now - this.last) / 1000)) : 0;
    this.last = now; c.dt = dt; c.t += dt; c.scene = scene; c.camera = camera; c.high = high;
    c.density = high ? 1 : 0.5;
    if (c.density !== this.densityKnown) { this.densityKnown = c.density; for (const f of this.dens) f(c.density); }
    this.wind.value = c.t;
    // обновление, которое упало, выключаем: сбой красоты не должен ронять отрисовку боя
    for (let i = this.ups.length - 1; i >= 0; i--) {
      try { this.ups[i](c); } catch (e) { console.warn('ambient: эффект выключен', e); this.ups.splice(i, 1); }
    }
  }

  /** Вызывать каждый кадр. */
  add(u: Updater) { this.ups.push(u); }
  /** Настроить число видимых частиц под качество (вызывается в первом кадре и при смене качества). */
  onDensity(f: (d: number) => void) { this.dens.push(f); if (this.densityKnown >= 0) f(this.densityKnown); }
  /** Выполнить при уборке острова (вернуть свет, который эффект менял). */
  onDispose(f: () => void) { this.cleanups.push(f); }

  /** Наборы моделей с учётом общего: всё, что отдали Kit.get, — общее (кэш игры) и при уборке не освобождается. */
  trackKits<M extends Map<string, Kit>>(kits: M): M {
    const out = new Map<string, Kit>();
    for (const [id, k] of kits) {
      const w = Object.create(k) as Kit;
      w.get = (name, o) => { const obj = k.get(name, o); this.share(obj); return obj; };
      out.set(id, w);
    }
    return out as M;
  }
  private share(obj: THREE.Object3D) {
    obj.traverse(n => {
      const m = n as THREE.Mesh;
      if (m.geometry) this.shared.geo.add(m.geometry);
      for (const mat of asList(m.material)) { this.shared.mat.add(mat); for (const k of TEX_KEYS) { const t = (mat as unknown as Record<string, THREE.Texture | null>)[k]; if (t) this.shared.tex.add(t); } }
    });
  }

  /** Убрать остров из видеопамяти: геометрии, материалы и текстуры, созданные кодом острова (общие из кэша игры не трогаем). */
  dispose() {
    if (this.dead) return; this.dead = true;
    for (const f of this.cleanups) { try { f(); } catch { /* уборка не должна мешать друг другу */ } }
    this.cleanups.length = this.ups.length = this.dens.length = 0;
    const geos = new Set<Disposable>(), mats = new Set<Disposable>(), texs = new Set<Disposable>();
    this.g.traverse(o => {
      const m = o as THREE.Mesh;
      if ((o as THREE.InstancedMesh).isInstancedMesh) (o as THREE.InstancedMesh).dispose();
      if (m.geometry && !(o as THREE.Sprite).isSprite && !this.shared.geo.has(m.geometry)) geos.add(m.geometry);
      for (const mat of asList(m.material)) {
        if (this.shared.mat.has(mat)) continue;
        mats.add(mat);
        for (const k of TEX_KEYS) { const t = (mat as unknown as Record<string, THREE.Texture | null>)[k]; if (t && !this.shared.tex.has(t) && !t.userData.keep) texs.add(t); }
      }
    });
    for (const s of [geos, mats, texs]) for (const x of s) x.dispose();
    this.shared.geo.clear(); this.shared.mat.clear(); this.shared.tex.clear();
  }
}

const REG = new WeakMap<THREE.Group, Ambient>();
/** Тикер острова (создаётся при первом обращении; один на группу острова). */
export function ambientOf(g: THREE.Group): Ambient { let a = REG.get(g); if (!a) REG.set(g, (a = new Ambient(g))); return a; }

// ---------- ветер ----------
/** Как качается предмет по имени модели: доля высоты, на которую отклоняется верхушка; cloth — ткань (флаг, знамя). null — жёсткий предмет. */
export function swayKind(name: string): { frac: number; cloth?: boolean } | null {
  if (/(^|_)(flag|banner)/i.test(name) && !/tower/i.test(name)) return { frac: 0.1, cloth: true };
  if (/palm/i.test(name)) return { frac: 0.05 };
  if (/^tree-snow/i.test(name)) return { frac: 0.02 };
  if (/bare|crooked/i.test(name)) return { frac: 0.025 };
  if (/^(tree|unit-tree)/i.test(name)) return { frac: 0.04 };
  if (/^(grass|flower|crops_bamboo|waterplant|plant_flat)/i.test(name)) return { frac: 0.11 };
  if (/^(bush|plant)/i.test(name)) return { frac: 0.06 };
  return null;
}

const SWAY_HEAD = 'uniform float uSwT; uniform float uSwInv; uniform float uSwA; uniform vec3 uSwO;';
/** Вставка в вершинный шейдер: отклонение по мировой высоте (квадрат: низ стоит, верхушка ходит) с бегущей по острову волной ветра. */
export function swayVertex(src: string, cloth: boolean): string {
  const body = cloth
    ? `vec4 swW = modelMatrix * vec4(transformed, 1.0);
       float swD = length(swW.xz - uSwO.xz);
       float swK = smoothstep(0.05, 1.0, swD * uSwInv);
       float swP = uSwT * 3.2 + swW.x * 0.9 - swD * 3.0;
       vec3 swV = vec3(0.35 * sin(swP * 0.7), 0.5 * sin(swP), 0.9 * sin(swP + 0.8)) * (uSwA * swK);`
    : `vec4 swW = modelMatrix * vec4(transformed, 1.0);
       float swK = clamp(swW.y * uSwInv, 0.0, 1.3); swK *= swK;
       float swP = uSwT * 1.3 + swW.x * 0.45 + swW.z * 0.3;
       float swG = 0.65 + 0.35 * sin(uSwT * 0.37 + swW.x * 0.12);
       vec3 swV = vec3(sin(swP) + 0.45 * sin(swP * 2.3 + swW.z), 0.0, 0.6 * cos(swP * 0.8 + 1.7)) * (uSwA * swK * swG);`;
  return src.replace('#include <common>', `#include <common>\n${SWAY_HEAD}`)
    .replace('#include <begin_vertex>', `#include <begin_vertex>\n{ ${body}\n transformed += inverse(mat3(modelMatrix)) * swV; }`);
}

/** Материал-копия, качающийся на ветру. h — высота предмета (нормировка), amp — отклонение верхушки в метрах, origin — ножка предмета (для ткани). */
function swayMaterial(src: THREE.Material, amb: Ambient, h: number, amp: number, cloth: boolean, origin: THREE.Vector3): THREE.Material {
  const m = src.clone(), u = { uSwT: amb.wind as { value: number }, uSwInv: { value: 1 / Math.max(0.1, h) }, uSwA: { value: amp }, uSwO: { value: origin } };
  m.onBeforeCompile = sh => { Object.assign(sh.uniforms, u); sh.vertexShader = swayVertex(sh.vertexShader, cloth); };
  m.customProgramCacheKey = () => (cloth ? 'ambSwayCloth1' : 'ambSway1');
  return m;
}

/** Пустить качаться деревья, кусты, траву и ткань среди детей острова (по имени модели). Вызывать после того, как декор расставлен и покрашен. */
export function applySway(g: THREE.Group, amb = ambientOf(g)) {
  const k = amb.ctx.km < 1 ? 0.35 : 1, box = new THREE.Box3(), size = new THREE.Vector3(), cache = new Map<string, THREE.Material>();
  g.updateMatrixWorld(true);
  for (const o of g.children) {
    const kind = swayKind(o.name); if (!kind) continue;
    box.setFromObject(o); box.getSize(size);
    const h = kind.cloth ? Math.max(size.x, size.z, 0.5) : size.y; if (!(h > 0.05)) continue;
    const hb = Math.round(h * 4) / 4;   // одинаковые по высоте предметы делят материал
    o.traverse(n => {
      const m = n as THREE.Mesh; if (!m.isMesh || m.userData.outline || Array.isArray(m.material) || (m.material as THREE.ShaderMaterial).isShaderMaterial) return;
      const src = m.material, key = `${src.uuid}|${kind.cloth ? o.id : hb}|${kind.frac}`;
      let sm = cache.get(key);
      if (!sm) cache.set(key, sm = swayMaterial(src, amb, kind.cloth ? Math.max(0.4, h * 0.6) : hb, kind.frac * (kind.cloth ? Math.max(1, h) : hb) * k, !!kind.cloth, o.position));
      m.material = sm;
    });
  }
}

// ---------- вода ----------
const WATER_HEAD = 'uniform float uWT; varying vec3 vWw;';
/** Вершины верха плитки чуть ходят волной, а по поверхности бегут светлые блики. */
export function waterShaders(vs: string, fs: string): [string, string] {
  const v = vs.replace('#include <common>', `#include <common>\n${WATER_HEAD}`)
    .replace('#include <begin_vertex>', `#include <begin_vertex>
      { vec3 w0 = (modelMatrix * vec4(transformed, 1.0)).xyz;
        float top = step(0.5, normal.y);
        transformed.y += top * 0.03 * sin(uWT * 1.4 + w0.x * 0.9 + w0.z * 0.7) / max(0.001, length(modelMatrix[1].xyz));
        vWw = w0; }`);
  const f = fs.replace('#include <common>', `#include <common>\n${WATER_HEAD}\nuniform vec3 uWTint;`)
    .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      { float s = sin(vWw.x * 1.9 + uWT * 1.1) * sin(vWw.z * 2.3 - uWT * 0.8) + 0.5 * sin((vWw.x + vWw.z) * 1.3 + uWT * 1.7);
        float glint = smoothstep(0.55, 1.05, s);
        totalEmissiveRadiance += uWTint * (0.10 + 0.55 * glint); }`);
  return [v, f];
}
/** Пустить рябь по материалу воды. tint — цвет бликов. Материал должен быть копией (общий не трогаем). */
export function applyWater(m: THREE.MeshToonMaterial, amb: Ambient, tint = 0x9fe6ff) {
  const u = { uWT: amb.wind as { value: number }, uWTint: { value: new THREE.Color(tint).multiplyScalar(0.55) } };
  m.onBeforeCompile = sh => { Object.assign(sh.uniforms, u); [sh.vertexShader, sh.fragmentShader] = waterShaders(sh.vertexShader, sh.fragmentShader); };
  m.customProgramCacheKey = () => 'ambWater1';
  m.needsUpdate = true;
}

/** Кувшинки и листья на воде покачиваются: лёгкий подъём и наклон. */
export function bobLilies(g: THREE.Group, amb = ambientOf(g)) {
  const list = g.children.filter(o => /lily/i.test(o.name)).map((o, i) => ({ o, y: o.position.y, ry: o.rotation.y, ph: i * 1.9 }));
  if (!list.length) return;
  amb.add(c => { for (const l of list) { l.o.position.y = l.y + 0.018 * Math.sin(c.t * 1.5 + l.ph) * c.km; l.o.rotation.y = l.ry + 0.07 * Math.sin(c.t * 0.6 + l.ph) * c.km; l.o.rotation.z = 0.025 * Math.sin(c.t * 1.2 + l.ph * 2) * c.km; } });
}
