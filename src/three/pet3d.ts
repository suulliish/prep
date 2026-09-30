// Питомец (мастерская корабля): ходит за героем по палубе с настоящими клипами Cube Pets (idle/walk/run/dance/gesture-positive),
// подпрыгивает, когда герой радуется, и не мешает катсцене портала (на это время прячется).
import * as THREE from 'three';
import type { Deck } from './deck3d';
import type { Actor } from './actor';
import { ITEMS, loadDecorModel } from './decor3d';

export interface PetDeps {
  /** Герой на корабле (позиция и поворот — в системе корабля). */
  hero: THREE.Object3D;
  /** Питомец нужен на палубе сейчас (режимы hub/hero, вне катсцены). */
  active(): boolean;
  km: number;
}
export interface Pet {
  /** Сменить питомца (null — убрать). Возвращает, когда модель загружена. */
  set(id: string | null): Promise<void>;
  readonly id: string | null;
  /** Дождаться, пока модель нынешнего питомца встанет на палубу (до ms мс, по умолчанию 8 с): true — питомец есть и стоит рядом с героем, false — не дождались или его сменили. */
  ready(ms?: number): Promise<boolean>;
  /** Место питомца в системе корабля (для камеры) или null, пока модель не загружена. */
  pos(): THREE.Vector3 | null;
  /** Прыжок радости с танцем (герой машет или радуется). */
  hop(): void;
  /** Появление рядом с героем: упругий рост. */
  pop(): Promise<void>;
  /** Поставить рядом с героем сразу (после смены режима или входа в сцену). */
  snap(): void;
  update(dt: number, t: number): void;
  dispose(): void;
}

/** Куда смотрит камера главного меню из корабля (с кормы и правого борта): в покое питомец поворачивается мордой к ней. */
const VIEWER = Math.atan2(-0.85, 0.52);

export function createPet(ship: THREE.Object3D, deck: () => Deck | null, deps: PetDeps): Pet {
  const g = new THREE.Group(); g.visible = false; ship.add(g);
  let id: string | null = null, actor: Actor | null = null, token = 0;
  let path: [number, number][] = [], pi = 0, repathT = 0, goal: [number, number] = [0, 0];
  let vis = 0, hopT = 0, moving = false, running = false, popT = -1, baseScale = 1, loading: Promise<void> = Promise.resolve();
  const near = 1.2, far = 2.0;                                                  // держится на расстоянии от героя: ближе near не подходит, дальше far догоняет

  /** Точка рядом с героем, куда можно встать и дойти от героя: на кольце вокруг него, ближе к камере главного меню (с кормы и правого борта), чтобы питомца было видно, а не за героем. */
  function spotNear(): [number, number] | null {
    const d = deck(); if (!d) return null;
    const hx = deps.hero.position.x, hz = deps.hero.position.z, cand: [number, number, number][] = [];
    for (let dx = -2.6; dx <= 2.6; dx += 0.3) for (let dz = -2.6; dz <= 2.6; dz += 0.3) {
      const r = Math.hypot(dx, dz), x = hx + dx, z = hz + dz; if (r < 1.0 || !d.walkable(x, z)) continue;
      // к камере (dx к корме, dz к правому борту), рядом, но не вплотную; без лишней беготни
      cand.push([x, z, (dx * -0.85 + dz * 0.52) / r * 0.6 - Math.abs(r - 1.3) * 0.5 - Math.hypot(x - g.position.x, z - g.position.z) * 0.08]);
    }
    cand.sort((p, q) => q[2] - p[2]);
    for (const c of cand.slice(0, 10)) if (d.path([hx, hz], [c[0], c[1]]).length) return [c[0], c[1]];   // на палубе есть острова, отрезанные от героя (ступени, реквизит): туда питомец не встаёт
    return d.nearest(hx, hz);
  }
  function place(x: number, z: number) { g.position.set(x, deck()?.height(x, z) ?? deps.hero.position.y, z); }
  async function load(next: string | null) {
    const my = ++token;
    if (next === id && actor) return;
    if (actor) { g.remove(actor.g); actor.dispose(); actor = null; }
    id = next; if (!next) { g.visible = false; return; }
    const it = ITEMS.find(x => x.id === next && x.slot === 'pet'); if (!it) { id = null; return; }
    const m = await loadDecorModel(it).catch(e => { console.warn('питомец не загрузился', next, e); return null; }); if (my !== token || !m) return;
    actor = m.actor!; baseScale = actor.g.scale.x; g.add(actor.g); moving = running = false; actor.loop('idle', 0); path = []; vis = 0;
    const s = spotNear(); if (s) place(s[0], s[1]); else g.position.copy(deps.hero.position);
    g.rotation.y = deps.hero.rotation.y;
  }

  return {
    get id() { return id; },
    set(next) { return (loading = load(next)); },
    async ready(ms = 8000) {
      const want = id, until = new Promise<void>(r => setTimeout(r, ms));
      if (!want) return false;
      await Promise.race([loading, until]);
      return id === want && !!actor;                                           // за это время питомца могли сменить или убрать
    },
    pos() { return actor ? g.position.clone() : null; },
    hop() { if (!actor || vis < 0.5 || hopT > 0) return; hopT = 0.7; actor.play(actor.has('dance') && Math.random() < 0.5 ? 'dance' : 'gesture-positive', { speed: 1.4 }); },
    pop() { popT = 0; return new Promise<void>(r => setTimeout(r, 800)); },
    snap() { const s = spotNear(); if (s) place(s[0], s[1]); path = []; },
    update(dt, t) {
      if (!actor) return;
      const d = deck(), on = deps.active() && !!d;
      vis += ((on ? 1 : 0) - vis) * Math.min(1, dt * 9);                        // катсцена портала, бой: плавно прячется
      g.visible = vis > 0.02;
      if (popT >= 0) { popT += dt / 0.7; const u = Math.min(1, popT), k = u < 0.55 ? (u / 0.55) ** 2 * 1.25 : u < 0.8 ? 1.25 - (u - 0.55) / 0.25 * 0.33 : 0.92 + (u - 0.8) / 0.2 * 0.08; actor.g.scale.setScalar(baseScale * k); if (u >= 1) popT = -1; }
      else actor.g.scale.setScalar(baseScale * (0.2 + 0.8 * vis));
      if (!d || !g.visible) { actor.update(dt); return; }
      // следование: если герой далеко — идти к точке рядом с ним, ближе — стоять и смотреть на героя
      const dx = deps.hero.position.x - g.position.x, dz = deps.hero.position.z - g.position.z, dist = Math.hypot(dx, dz);
      repathT -= dt;
      if ((dist > far || dist < 0.9 || (path.length > 0 && dist > near)) && repathT <= 0) {           // догоняет, а если герой наступает — уступает место
        const s = spotNear(); repathT = 0.25;
        if (s && (!path.length || Math.hypot(s[0] - goal[0], s[1] - goal[1]) > 0.45)) { goal = s; path = d.path([g.position.x, g.position.z], s); pi = 0; if (!path.length && dist > far * 1.5) place(s[0], s[1]); }   // отрезан от героя: переносится к нему
      }
      if ((dist <= near && dist >= 0.9) || pi >= path.length) path = [];
      let walking = false;
      if (path.length && pi < path.length) {
        const tg = path[pi], ex = tg[0] - g.position.x, ez = tg[1] - g.position.z, L = Math.hypot(ex, ez);
        // промежуточная клетка пути — питомец всё ещё идёт (иначе цикл ходьбы начинается заново на каждой клетке)
        if (L < 0.12) { pi++; walking = pi < path.length; }
        else { walking = true; running = dist > 5; const st = Math.min(L, dt * (running ? 6.2 : 3.8));
          g.position.x += ex / L * st; g.position.z += ez / L * st;
          g.rotation.y += Math.atan2(Math.sin(Math.atan2(ex, ez) - g.rotation.y), Math.cos(Math.atan2(ex, ez) - g.rotation.y)) * Math.min(1, dt * 12); }
      } else {                                                                   // стоит: смотрит на зрителя (камера главного меню), а не спиной
        g.rotation.y += Math.atan2(Math.sin(VIEWER - g.rotation.y), Math.cos(VIEWER - g.rotation.y)) * Math.min(1, dt * 4);
      }
      if (walking !== moving || (walking && (running ? 'run' : 'walk') !== actor.baseName())) {
        moving = walking; if (hopT <= 0) actor.loop(walking ? (running ? 'run' : 'walk') : 'idle', 0.2);
      }
      // высота по полу палубы (ступени, нос) + прыжок радости
      const hh = d.height(g.position.x, g.position.z); if (hh != null) g.position.y += (hh - g.position.y) * Math.min(1, dt * 14);
      if (hopT > 0) { hopT -= dt; const u = 1 - Math.max(0, hopT) / 0.7; actor.g.position.y = Math.sin(u * Math.PI) * 0.4; if (hopT <= 0) { actor.g.position.y = 0; actor.loop(moving ? 'walk' : 'idle', 0.2); } }
      actor.update(dt);
    },
    dispose() { token++; if (actor) { g.remove(actor.g); actor.dispose(); } ship.remove(g); },
  };
}
