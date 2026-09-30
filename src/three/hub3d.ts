// Корабль-хаб «Жарық» (главное меню, «Кейіпкер», катсцена входа в портал): палуба, оснастка, портал на носу,
// герой с жизнью на палубе, частицы. world.ts — только оркестратор (рендер, камера, режимы) и вызывает хаб через createHub().
// Главное меню строится вокруг портала: камера смотрит с носа и правого борта (HUB_THETA), портал повёрнут к ней лицом,
// герой гуляет по площадке перед порталом и в покое стоит лицом к зрителю.
import * as THREE from 'three';
import { createDeck, type Deck } from './deck3d';
import { dressAirship, type Airship } from './airship';
import { createPortal } from './portal';
import { HeroFigure } from './figure';
import { Kit } from './assets';
import { DEFAULT_LOOK, type HeroLook } from './looks';
import type { CamMode } from './world';
import type { BitMood } from './bit3d';
import { createDecor, planSpots, planCircles, connGuard, sampleSurface, findMasts, ITEMS, type Decor, type Guard, type Circle } from './decor3d';
import { createPet, type Pet } from './pet3d';
import { createDamage, MAX_DAMAGE, type Damage } from './damage3d';

/** Поза орбитальной камеры: цель, расстояние, углы (см. кадр в world.ts). */
export interface CamView { target: THREE.Vector3; radius: number; phi: number; theta: number }

export interface HubDeps {
  quality: 'high' | 'low';
  /** Множитель движения (0.3 при «меньше движения»). */
  km: number;
  /** Ребёнок коснулся героя — Бит радуется. */
  bitMood(m: BitMood): void;
  /** Началась катсцена входа в портал: камера сбрасывает ручной облёт. */
  onCutscene(): void;
  /** Ребёнок коснулся поломки на палубе (неисправленная ошибка) — экран открывает ремонт. */
  onDamageTap?(): void;
}

export interface Hub {
  /** Позы камеры, принадлежащие сцене корабля: hub (меню), portal (катсцена входа), hero (витрина). Хаб сам уточняет цели, когда палуба загрузилась. */
  readonly views: { hub: CamView; portal: CamView; hero: CamView };
  /** Поза для режима камеры: карта смотрит как hub; в hub — на портал во время катсцены; в hero цель следует за героем. Боевой режим — не здесь. */
  viewFor(mode: Exclude<CamMode, 'battle'>): CamView;
  /** Кадр: качка корабля, портал, жизнь героя, частицы. Вызывать до Бита и до расчёта камеры. */
  update(dt: number, t: number): void;
  /** Смена режима камеры: возвращает героя на место, а из боя — вылетает из портала (world вызывает до своей смены режима). */
  enterMode(m: CamMode): void;
  /** Катсцена: герой бежит к порталу и уходит в вихрь. Повторный вызов — та же катсцена. */
  portalWalk(): Promise<void>;
  heroWalk(x: number, z: number): Promise<void>;
  /** Касание в главном меню: по герою — он машет, по палубе — идёт туда. ndc — координаты касания -1..1. */
  tap(ndc: THREE.Vector2, camera: THREE.Camera): void;
  /** Радость героя со вспышкой частиц (вне боя). */
  celebrate(color: number): void;
  openPortal(): void;
  /** Энергия дня: руны портала горят по ней. */
  setEnergy(v: number, max: number): void;
  setLook(look: HeroLook): void;
  setCape(c: { color: number; glow: boolean } | null): void;
  /** Мастерская корабля: поставить купленные украшения на палубу и выбрать питомца (null — без питомца). Можно вызывать до загрузки палубы. */
  setShipDecor(owned: string[], pet: string | null): void;
  /** Поломки на палубе = неисправленные ошибки (не больше 6); меньше, чем было, — последние чинятся с анимацией (src/three/damage3d.ts). */
  setDamage(n: number): void;
  /** Праздник нового предмета: камера летит к нему, он вырастает со вспышкой, потом камера возвращается. Питомец — камера на нём. */
  showDecor(id: string): Promise<void>;
  /** Где герой сейчас (мир) — за ним летает Бит. */
  heroWorldPos(v: THREE.Vector3): THREE.Vector3;
  /** Идёт катсцена входа/выхода через портал (Бит отлетает, чтобы не заслонять вихрь). */
  readonly inCutscene: boolean;
  dispose(): void;
}

const HUB_THETA = Math.PI - 0.55;                           // с кормы, чуть с правого борта: вся палуба вдоль, портал в глубине кадра
const PORTAL_FACE = Math.PI / 2 - HUB_THETA;                 // нормаль портала (sin F, cos F) смотрит ровно на камеру

export function createHub(scene: THREE.Scene, deps: HubDeps): Hub {
  const { quality, km } = deps;
  const views = {
    hub: { target: new THREE.Vector3(0, 1.6, 0), radius: 24, phi: 1.2, theta: HUB_THETA },
    portal: { target: new THREE.Vector3(4.6, 2.2, 0), radius: 9, phi: 1.25, theta: 0.15 },
    hero: { target: new THREE.Vector3(-2, 1.5, 0.6), radius: 11, phi: 1.32, theta: HUB_THETA + 0.25 }, // витрина: герой на площадке у портала, сияние портала за спиной; цель следует за героем
  };
  let mode: CamMode = 'hub', now = 0;                         // now — время последнего кадра (то же, что clock.elapsedTime в world)

  // ---------- Корабль ----------
  // готовый корабль Kenney (src/three/deck3d.ts): по его палубе ходит герой; лётная оснастка (двигатели, кристалл под килем) — airship.ts
  const ship = new THREE.Group(); scene.add(ship);
  let deck: Deck | null = null, air: Airship | null = null, guard: Guard | null = null, taken: Circle[] = [];

  // ---------- Портал ---------- (src/three/portal.ts) на носу; лицом к корме и правому борту — к обычному ракурсу камеры,
  // чтобы с главного экрана был виден вихрь, а не ребро кольца. Герой подходит к нему спереди.
  const portalFx = createPortal({ radius: 1.35 }), portal = portalFx.g;
  portal.rotation.y = PORTAL_FACE; portal.scale.setScalar(0.85); portal.position.set(4.6, 0, 0); ship.add(portal);
  let home: [number, number][] = [];
  let dmg: Damage | null = null, dmgN = 0;
  let energy = 0.3, portalOpen = false, pulling = false, cutscene = false, focusPortal = false, cutToken = 0, portalP: Promise<void> | null = null, portalStand: [number, number] = [3.5, 0];
  const portalCenter = () => portal.localToWorld(new THREE.Vector3(0, portalFx.center, 0));
  /** Покадровая анимация по времени (для катсцен на палубе). Если катсцену отменили (смена режима — cutToken), шаги прекращаются. */
  const anim = (dur: number, step: (u: number) => void, tok = cutToken) => new Promise<void>(res => { const t0 = performance.now(); const f = () => { if (tok !== cutToken) return res(); const u = Math.min(1, (performance.now() - t0) / (dur * 1000)); step(u); if (u < 1) requestAnimationFrame(f); else res(); }; f(); });

  // ---------- Герой ----------
  const fig = new HeroFigure(DEFAULT_LOOK, 1.15), hero = fig.g;   // настоящий герой (модель с анимациями)
  hero.position.set(0, 0, 0); hero.rotation.y = Math.PI / 2; ship.add(hero);

  // ---------- Мастерская: украшения и питомец (decor3d.ts, pet3d.ts) ----------
  let decor: Decor | null = null, ownedDecor: string[] = [], petId: string | null = null, focusView: CamView | null = null, focusFollow: (() => THREE.Vector3 | null) | null = null, focusTok = 0;
  const pet: Pet = createPet(ship, () => deck, { hero, km, active: () => (mode === 'hub' || mode === 'hero') && !cutscene && !pulling });

  // ---------- Частицы ----------
  const box = new THREE.BoxGeometry(1, 1, 1);
  const mats = new Map<string, THREE.MeshStandardMaterial>();
  const mat = (color: number, emissive = 0, ei = 1) => {
    const k = `${color}_${emissive}_${ei}`;
    if (!mats.has(k)) mats.set(k, new THREE.MeshStandardMaterial({ color, emissive, emissiveIntensity: ei, roughness: 0.85, metalness: 0.05, flatShading: true }));
    return mats.get(k)!;
  };
  const bursts: { g: THREE.Group; parts: { m: THREE.Mesh; v: THREE.Vector3 }[]; life: number }[] = [];
  function burst(pos: THREE.Vector3, color: number, n = 40, speed = 4) {
    const g = new THREE.Group(); g.position.copy(pos); scene.add(g);
    const parts = Array.from({ length: n }, () => { const m = new THREE.Mesh(box, mat(color, color, 2)); const s = 0.08 + Math.random() * 0.14; m.scale.setScalar(s); g.add(m); return { m, v: new THREE.Vector3((Math.random() - 0.5) * speed, Math.random() * speed, (Math.random() - 0.5) * speed) }; });
    bursts.push({ g, parts, life: 1.3 });
  }

  // ---------- Палуба: загрузка, площадка у портала, реквизит ----------
  async function loadDeck() {
    const d = await createDeck(quality);
    deck = d; ship.add(d.g);
    air = dressAirship(d.hull, d.model, { quality, furled: true }); ship.add(air.g);
    const [mx, mz] = d.stations.mid; hero.position.set(mx, 0, mz);
    // портал — на открытой носовой палубе (перед фок-мачтой, чтобы парус не закрывал), герой встаёт перед ним
    // Кольцо стоит поперёк узкого носа, а на нос ведёт один проход вдоль борта: место портала выбираем так, чтобы камни кольца
    // его не перекрыли и площадка перед порталом осталась достижимой с середины палубы (иначе герой заперт на носу).
    const RING = [-1.3, -0.65, 0, 0.65, 1.3], RR = 0.75, nx = Math.sin(PORTAL_FACE), nz = Math.cos(PORTAL_FACE);
    // с запасом: reserve() занимает клетки с округлением, поэтому при выборе места считаем кольцо чуть шире
    const ringHit = (cx: number, cz: number, x: number, z: number) => RING.some(k => Math.hypot(x - (cx + Math.cos(PORTAL_FACE) * k), z - (cz - Math.sin(PORTAL_FACE) * k)) < RR + 0.25);
    const reach = (cx: number, cz: number) => {                          // клетки, куда можно дойти с середины палубы, если кольцо стоит в (cx, cz)
      const S = 0.3, [sx, sz] = d.stations.mid, seen = new Set<string>(['0,0']), q: [number, number][] = [[0, 0]];
      while (q.length) { const [i, j] = q.pop()!;
        for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const a = i + di, b2 = j + dj, k = a + ',' + b2, x = sx + a * S, z = sz + b2 * S;
          if (seen.has(k) || !d.walkable(x, z) || ringHit(cx, cz, x, z)) continue; seen.add(k); q.push([a, b2]); } }
      return (x: number, z: number) => seen.has(Math.round((x - sx) / S) + ',' + Math.round((z - sz) / S));
    };
    let px = 0, pz = 0;
    pick: for (const fx of [0.9, 0.6, 1.2, 0.3, 1.5]) for (const fz of [0, 0.3, -0.3, 0.6, -0.6]) {
      const [cx, cz] = d.nearest(d.bounds.maxX - fx, fz), r = reach(cx, cz);
      // площадка перед кольцом (со стороны камеры): те же места, где ниже ищем место героя, должны быть достижимы
      for (let dx = -3.6; dx <= 3.6; dx += 0.3) for (let dz = -3.6; dz <= 3.6; dz += 0.3) {
        const along = dx * nx + dz * nz, lat = dx * nz - dz * nx;
        if (along >= 1 && along <= 2.6 && Math.abs(lat) <= 0.6 && d.walkable(cx + dx, cz + dz) && r(cx + dx, cz + dz)) { px = cx; pz = cz; break pick; }
      }
    }
    if (!px) [px, pz] = d.nearest(d.bounds.maxX - 0.9, 0);
    portal.position.set(px, d.height(px, pz) ?? 0, pz);             // нос приподнят над главной палубой — ставим на его высоту
    for (const k of RING) d.reserve(px + Math.cos(PORTAL_FACE) * k, pz - Math.sin(PORTAL_FACE) * k, RR);   // кольцо поперёк: сквозь камни не ходим
    // место героя перед входом: прямо напротив центра кольца (с любой стороны — вихрь двусторонний), куда можно дойти с середины палубы
    { const cand: [number, number, number][] = [];
      for (let dx = -3.6; dx <= 3.6; dx += 0.3) for (let dz = -3.6; dz <= 3.6; dz += 0.3) {
        const along = dx * nx + dz * nz, lat = dx * nz - dz * nx;       // вдоль нормали и вдоль кольца
        if (Math.abs(along) < 1 || Math.abs(along) > 2.6 || Math.abs(lat) > 0.6 || !d.walkable(px + dx, pz + dz)) continue;
        cand.push([Math.abs(along) + Math.abs(lat) * 2 + (along < 0 ? 0.3 : 0), px + dx, pz + dz]);
      }
      cand.sort((a, b) => a[0] - b[0]);
      const ok = cand.find(c => d.path(d.stations.mid, [c[1], c[2]]).length > 0);
      if (ok) portalStand = [ok[1], ok[2]];
      // камера катсцены входа: со стороны, откуда подходит герой, чуть сбоку — видно и героя, и вихрь
      views.portal.target.set(px, portal.position.y + portalFx.center * 0.85 - 0.2, pz); views.portal.theta = Math.atan2(portalStand[1] - pz, portalStand[0] - px) + 0.45; views.portal.phi = 1.18;
      // места прогулки в кадре: площадка перед порталом со стороны камеры (достижимые с места входа)
      home = cand.filter(c => Math.hypot(c[1] - portalStand[0], c[2] - portalStand[1]) > 0.8).map(c => [c[1], c[2]] as [number, number]);
      for (let dx = -3; dx <= 3; dx += 0.6) for (let dz = -3; dz <= 3; dz += 0.6) {
        const q: [number, number] = [portalStand[0] + dx, portalStand[1] + dz], along = (q[0] - px) * nx + (q[1] - pz) * nz;
        if (along > 1 && d.walkable(q[0], q[1]) && Math.hypot(dx, dz) > 0.9 && d.path(portalStand, q).length) home.push(q);
      }
      home.push(portalStand);
      if (mode === 'hub' || mode === 'hero') { const h0 = home[Math.floor(home.length / 2)]; hero.position.set(h0[0], d.height(h0[0], h0[1]) ?? 0, h0[1]); hero.rotation.y = mode === 'hero' ? PORTAL_FACE + 0.2 : PORTAL_FACE - 0.25; if (mode === 'hero') frameHero(); }   // «Кейіпкер» мог открыться до загрузки палубы
      // камера главного меню: между порталом и площадкой перед ним
      views.hub.target.set(px + nx * 2.6, 1.6, pz + nz * 2.6); }
    // украшения мастерской: места считаются по палубе. Площадка у портала и места героя свободны, палуба остаётся связной (connGuard): корма, середина и площадка достижимы друг от друга
    { const avoid: [number, number, number][] = [[px, pz, 1.9], [portalStand[0], portalStand[1], 1.3]], soft = home.map(h => [h[0], h[1], 0.75] as [number, number, number]);
      const surf = sampleSurface(ship, d), must: [number, number][] = [portalStand, ...Object.values(d.stations)], plan = planSpots(surf, avoid, d, must, soft);
      guard = connGuard(surf, d, must); taken = planCircles(plan);            // сторож остаётся: реквизит палубы ниже тоже не должен отрезать корму и середину
      // поломки (неисправленные ошибки): не у портала, не у входа героя и не под украшениями
      dmg?.dispose(); dmg = createDamage(ship, d, { quality, km, avoid: [...avoid, ...taken], surf }); dmg.set(dmgN);
      home = home.filter(h => !taken.some(c => Math.hypot(h[0] - c[0], h[1] - c[1]) < c[2] + 0.1));   // место героя под предметом убираем из прогулок
      // предмет мог отрезать от палубы тупик (борт за пушкой): гасим такие клетки, чтобы касание и прогулка вели только туда, куда герой дойдёт
      const sweep = () => {
        const at = (i: number, j: number): [number, number] => [surf.x0 + i * surf.step, surf.z0 + j * surf.step], seen = new Set<string>(), q: [number, number][] = [[Math.round((portalStand[0] - surf.x0) / surf.step), Math.round((portalStand[1] - surf.z0) / surf.step)]];
        if (!d.walkable(...at(...q[0]))) return;
        seen.add(q[0] + '');
        while (q.length) { const [i, j] = q.pop()!; for (const [a, b] of [[i + 1, j], [i - 1, j], [i, j + 1], [i, j - 1]]) { const k = a + ',' + b; if (!seen.has(k) && d.walkable(...at(a, b))) { seen.add(k); q.push([a, b]); } } }
        for (let i = 0; i < surf.nx; i++) for (let j = 0; j < surf.nz; j++) { const p = at(i, j); if (d.walkable(...p) && !seen.has(i + ',' + j)) d.reserve(p[0], p[1], 0); }
      };
      decor = createDecor(ship, d, plan, findMasts(ship, d), sweep); decor.set(ownedDecor); }
    // реквизит палубы: готовые бочки, ящики, пушка (Kenney Pirate Kit) у бортов; вокруг них не ходим
    const k = await Kit.load('ship'), e = d.edges().sort((a, b) => a[0] - b[0]);
    const far = ([x, z]: [number, number]) => Object.values(d.stations).every(s => Math.hypot(s[0] - x, s[1] - z) > 2.2) && Math.hypot(portal.position.x - x, portal.position.z - z) > 3.2 && !Object.values(decor?.spots ?? {}).flat().some(s => s && Math.hypot(s.x - x, s.z - z) < 1.5);   // площадка у портала свободна
    let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (const [name, f, h] of [['barrel', 0.1, 1.2], ['crate', 0.22, 1.1], ['cannon', 0.34, 1.3], ['barrel', 0.5, 1.2], ['crate-bottles', 0.62, 1.0], ['cannon', 0.74, 1.3], ['barrel', 0.9, 1.2]] as const) {
      const c = e.slice(Math.floor(e.length * f)).find(q => far(q) && (!guard || guard.test([...taken, [q[0], q[1], 0.9]]) !== null)); if (!c) continue;   // не отрезает ни корму, ни середину, ни площадку
      const o = k.get(name, { height: h, ground: true }); o.position.set(c[0], d.height(c[0], c[1]) ?? 0, c[1]); o.rotation.y = rnd() * 6.28; ship.add(o); d.reserve(c[0], c[1], 0.9); taken.push([c[0], c[1], 0.9]);
    }
  }
  loadDeck().catch(e => console.warn('палуба не загрузилась', e));

  // ---------- Жизнь героя на палубе ----------
  // герой ходит по палубе по найденному пути (deck3d.ts: путь огибает мачты, поручни и реквизит)
  type Walk = { path: [number, number][]; i: number; res: () => void; run: boolean };
  let walk: Walk | null = null;
  /** Идти (run — бегом) по найденному пути. Нет пути (точка за порталом, отрезанный угол) — не идём напрямик сквозь препятствия, а стоим. */
  const goTo = (x: number, z: number, res: () => void = () => {}, run = false) => {
    if (!deck) { res(); return; }
    endActivity(true);
    const p = deck.path([hero.position.x, hero.position.z], [x, z]);
    if (!p.length) { walk = null; res(); return; }
    walk = { path: p, i: 0, res, run };
  };
  /** Перенос героя со вспышкой (короткие искры там, где был, и там, где встал): вместо полёта сквозь палубу, когда пути нет. */
  const poofTo = (x: number, z: number) => {
    walk = null; endActivity(true);
    burst(worldPos(hero, 0.9), 0x3ff0ff, 16, 2.2);
    hero.position.set(x, deck?.height(x, z) ?? 0, z);
    burst(worldPos(hero, 0.9), 0x3ff0ff, 16, 2.2);
  };
  const spot = (k: 'bow' | 'stern' | 'mid' | 'port' | 'star'): [number, number] => deck?.stations[k] ?? [0, 0];

  // «Кейіпкер»: герой встаёт туда и камера берёт тот угол, где между ней и героем ничего нет (борт, мачта, бочки, украшения):
  // перебор мест прогулки и углов, лучи от камеры к ногам, груди и голове героя. Попадания у самого героя (он сам, питомец) не считаются.
  const rc = new THREE.Raycaster(), eyeV = new THREE.Vector3(), aimV = new THREE.Vector3(), dirV = new THREE.Vector3(), baseV = new THREE.Vector3();
  function frameHero() {
    if (!deck) return;
    const d = deck, v = views.hero, r = v.radius, mid = home.length ? home[Math.floor(home.length / 2)] : spot('mid');
    const spots = [mid, ...home.filter((_, i) => i % 3 === 0), portalStand, spot('mid')].filter(q => d.walkable(q[0], q[1])).slice(0, 10);
    const T0 = HUB_THETA + 0.25, ks = [0, 0.3, -0.3, 0.6, -0.6, 0.9, -0.9, 1.3, -1.3];
    ship.updateMatrixWorld(true);
    // только обычные меши: спрайтам лучу нужна камера, а скиннинг (герой, питомец) не заслоняет — это они сами
    const solid: THREE.Object3D[] = []; ship.traverse(o => { if ((o as THREE.Mesh).isMesh && !(o as THREE.SkinnedMesh).isSkinnedMesh && o.visible) solid.push(o); });
    // строгий проход: ещё и перед камерой пусто (лучи к палубе на трети и середине пути до героя не упираются раньше — нет досок кормы у самого объектива); не нашлось — без этого условия
    for (const strict of [true, false]) for (const phi of [1.3, 1.16, 1.02]) for (const q of spots) for (const k of ks) {
      const th = T0 + k;
      baseV.set(q[0], d.height(q[0], q[1]) ?? 0, q[1]); ship.localToWorld(baseV);
      eyeV.set(baseV.x + r * Math.sin(phi) * Math.cos(th), baseV.y + 1.15 + r * Math.cos(phi), baseV.z + r * Math.sin(phi) * Math.sin(th));
      // лучи к герою по всей его ширине (ось ± плечи), не только по оси: иначе мачта в полуметре закрывает полфигуры
      const sx = -Math.sin(th) * 0.55, sz = Math.cos(th) * 0.55;
      const clear = [0.3, 1.1, 1.9].every(h => [-1, 0, 1].every(w => {
        aimV.set(baseV.x + sx * w, baseV.y + h, baseV.z + sz * w); dirV.copy(aimV).sub(eyeV); const L = dirV.length(); dirV.normalize();
        rc.set(eyeV, dirV); rc.far = L;
        return !rc.intersectObjects(solid, false).some(x => Math.hypot(x.point.x - baseV.x, x.point.z - baseV.z) > 0.9);
      }));
      if (!clear) continue;
      // нижняя часть кадра (там, где на экране низ окна сцены): лучи из камеры под углом вниз и в стороны от взгляда на героя
      // не должны упираться во что-то у самого объектива (доски кормы, двигатель) — иначе пол-кадра занимает одна доска
      if (strict) {
        const fwd = aimV.set(baseV.x, baseV.y + 1.15, baseV.z).sub(eyeV).normalize().clone(), right = dirV.crossVectors(fwd, THREE.Object3D.DEFAULT_UP).normalize().clone(), upv = new THREE.Vector3().crossVectors(right, fwd);
        const near = [[0, 0.2], [0, 0.34], [-0.3, 0.3], [0.3, 0.3], [-0.45, 0.1], [0.45, 0.1], [0, 0.5], [-0.4, 0.5], [0.4, 0.5], [0, 0.75]].some(([yaw, pitch]) => {
          dirV.copy(fwd).addScaledVector(right, Math.tan(yaw)).addScaledVector(upv, -Math.tan(pitch)).normalize();
          // где луч лёг бы на палубу на уровне ног героя; упёрся заметно раньше — у объектива что-то высокое (доски кормы, борт, двигатель)
          const flat = dirV.y < -0.02 ? (eyeV.y - baseV.y) / -dirV.y : r * 1.5;
          rc.set(eyeV, dirV); rc.far = flat * 0.72;
          return rc.intersectObjects(solid, false).length > 0;
        });
        if (near) continue;
        // по сторонам от героя (мачта, ванты) — ничего ближе, чем в 1.5 м перед героем: кадр чистый не только на самом герое
        const L0 = eyeV.distanceTo(aimV.set(baseV.x, baseV.y + 1.15, baseV.z));
        const side = [-0.4, -0.25, 0.25, 0.4].some(yaw => [0.12, -0.12].some(pitch => {
          dirV.copy(fwd).addScaledVector(right, Math.tan(yaw)).addScaledVector(upv, pitch).normalize();
          rc.set(eyeV, dirV); rc.far = L0 - 1.5; return rc.intersectObjects(solid, false).length > 0;
        }));
        if (side) continue;
        // камера не висит над самой доской или бортом: ничего ближе 1.6 м вокруг объектива (снизу и по бокам)
        const tight = [[0, -1, 0], [1, -0.6, 0], [-1, -0.6, 0], [0, -0.6, 1], [0, -0.6, -1], [1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1]].some(([x, y, z]) => {
          rc.set(eyeV, dirV.set(x, y, z).normalize()); rc.far = 1.6; return rc.intersectObjects(solid, false).length > 0;
        });
        if (tight) continue;
      }
      hero.position.set(q[0], d.height(q[0], q[1]) ?? 0, q[1]);
      v.phi = phi; v.theta = th;
      // герой вполоборота к камере (3/4): видно и лицо, и оружие
      const le = ship.worldToLocal(eyeV.clone()); hero.rotation.y = Math.atan2(le.x - q[0], le.z - q[1]) + 0.35;
      return;
    }
  }
  // Катсцена портала: угол камеры, с которого вихрь и герой у кольца не закрыты мачтой, знаменем, гирляндой и прочим.
  // База — прежний угол (со стороны, откуда подходит герой); перебор поворотов и высот, лучи к кольцу и к герою на площадке.
  let portalTheta0: number | null = null;
  function framePortal() {
    if (!deck) return;
    const v = views.portal, r = v.radius, tg = v.target, c = portalCenter();
    portalTheta0 ??= v.theta;
    ship.updateMatrixWorld(true);
    // герой со своим мечом и щитом — не помеха (он сам в кадре)
    const solid: THREE.Object3D[] = []; ship.traverse(o => { if ((o as THREE.Mesh).isMesh && !(o as THREE.SkinnedMesh).isSkinnedMesh && o.visible) solid.push(o); });
    const mine = new Set<THREE.Object3D>(); hero.traverse(o => mine.add(o)); for (let i = solid.length - 1; i >= 0; i--) if (mine.has(solid[i])) solid.splice(i, 1);
    const stand = ship.localToWorld(new THREE.Vector3(portalStand[0], deck.height(portalStand[0], portalStand[1]) ?? 0, portalStand[1]));
    const R = portalFx.radius * portal.scale.x;
    // путь героя к порталу (он бежит в кадре): точки на уровне груди примерно через метр — сначала ищем угол, где виден и весь забег
    const way = deck.path([hero.position.x, hero.position.z], portalStand).filter((_, i, a) => i % 3 === 0 || i === a.length - 1)
      .map(q => ship.localToWorld(new THREE.Vector3(q[0], (deck!.height(q[0], q[1]) ?? 0) + 1.1, q[1])));
    for (const withWay of [true, false]) for (const phi of [1.18, 1.08, 0.98, 1.28]) for (const k of [0, 0.25, -0.25, 0.5, -0.5, 0.8, -0.8, 1.1, -1.1]) {
      const th = portalTheta0 + k;
      eyeV.set(tg.x + r * Math.sin(phi) * Math.cos(th), tg.y + r * Math.cos(phi), tg.z + r * Math.sin(phi) * Math.sin(th));
      // точки: центр вихря и край кольца слева/справа/сверху, герой на площадке (ноги, грудь, голова); само кольцо и камни у него — не помеха
      const pts = [c.clone(), c.clone().add(new THREE.Vector3(0, R * 0.8, 0)), c.clone().add(new THREE.Vector3(0, -R * 0.6, 0)),
        stand.clone().setY(stand.y + 0.3), stand.clone().setY(stand.y + 1.1), stand.clone().setY(stand.y + 1.9)];
      const sideV = new THREE.Vector3(-Math.sin(th), 0, Math.cos(th)).multiplyScalar(R * 1.15);
      pts.push(c.clone().add(sideV), c.clone().sub(sideV));
      if (withWay) pts.push(...way);
      const clear = pts.every(pt => {
        dirV.copy(pt).sub(eyeV); const L = dirV.length(); dirV.normalize(); rc.set(eyeV, dirV); rc.far = L;
        return !rc.intersectObjects(solid, false).some(x => x.point.distanceTo(c) > R + 0.6 && x.point.distanceTo(pt) > 0.5);
      });
      if (clear) { v.phi = phi; v.theta = th; return; }
    }
    v.phi = 1.18; v.theta = portalTheta0;
  }
  const WANDER = ['bow', 'stern', 'mid', 'port', 'star'] as const;
  /** Место прогулки героя: только то, куда ещё можно встать (предмет мог занять клетку). */
  const anyHome = () => { const ok = home.filter(h => deck?.walkable(h[0], h[1])); return ok.length ? ok[Math.floor(Math.random() * ok.length)] : spot('mid'); };
  let nextWander = 4;
  let celebrateT = 0;
  // Жизнь на палубе в главном меню: дойдя до места, герой чем-то занят — стоит лицом к зрителю, сидит, тренируется, машет.
  let activity: { until: number; exit: string | null } | null = null;
  function startActivity(t: number) {
    const r = Math.random();
    if (r < 0.35) { nextWander = t + 5 + Math.random() * 4; return; }
    if (r < 0.55) { fig.play('Sit_Floor_Down').then(() => { if (activity) fig.hold('Sit_Floor_Idle'); }); activity = { until: t + 9 + Math.random() * 5, exit: 'Sit_Floor_StandUp' }; }
    else if (r < 0.7) { fig.hold('Push_Ups'); activity = { until: t + 5, exit: null }; }
    else if (r < 0.8) { fig.hold('Sit_Ups'); activity = { until: t + 5, exit: null }; }
    else { fig.play('Waving'); pet.hop(); nextWander = t + 5; return; }
    nextWander = Infinity;
  }
  function endActivity(quick = false) {
    if (!activity) return; const ex = activity.exit; activity = null; fig.hold(null);
    if (ex && !quick) fig.play(ex);
  }

  // ---------- Касания в главном меню ----------
  // касание палубы — герой идёт туда (просьба ребёнка 30.09); касание самого героя — машет в ответ
  const tapRay = new THREE.Raycaster(), tapPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), tapHit = new THREE.Vector3();
  function tap(ndc: THREE.Vector2, camera: THREE.Camera) {
    if (mode !== 'hub') return;
    tapRay.setFromCamera(ndc, camera);
    if (!deck || cutscene || pulling) return;                             // во время катсцены касания не двигают героя
    // касание самого героя (луч попал в его модель) — он машет в ответ, Бит радуется
    const wave = () => { if (!walk) { endActivity(true); fig.play('Waving', 1.1); pet.hop(); deps.bitMood('happy'); nextWander = now + 6; } };
    if (tapRay.intersectObject(hero, true).length) { wave(); return; }
    // касание поломки — к ремонту (экран решает, куда вести). Зона — по экрану, с запасом под палец: поломки с меню мелкие
    if (dmg && (dmg.pick(tapRay) >= 0 || dmg.positions().some(pos => {
      const q = pos.clone().project(camera), asp = (camera as THREE.PerspectiveCamera).aspect ?? 1;
      return q.z < 1 && Math.hypot((q.x - ndc.x) * asp, q.y - ndc.y) < 0.09;
    }))) { deps.onDamageTap?.(); return; }
    // точка на палубе: луч в корпус (нос приподнят над главной палубой), иначе — плоскость главной палубы
    const dh = tapRay.intersectObject(deck.g, true).find(h => !/sail|flag/.test(h.object.name) && !h.object.userData.outline);
    if (dh) tapHit.copy(dh.point); else { tapPlane.constant = -ship.position.y; if (!tapRay.ray.intersectPlane(tapPlane, tapHit)) return; }
    const p = ship.worldToLocal(tapHit.clone());
    if (Math.hypot(hero.position.x - p.x, hero.position.z - p.z) < 0.7) { wave(); return; }   // под ногами героя — тоже касание героя
    const q = deck.nearest(p.x, p.z); if (Math.hypot(q[0] - p.x, q[1] - p.z) > 3) return;   // мимо палубы
    const x = q[0], z = q[1];
    nextWander = Infinity;                                               // сам не уходит, пока идёт по касанию
    burst(ship.localToWorld(new THREE.Vector3(x, (deck.height(x, z) ?? 0) + 0.3, z)), 0x3ff0ff, 14, 2);
    goTo(x, z, () => { nextWander = now + 10; celebrateT = 0.4; });
  }

  // ---------- Кадр ----------
  function update(dt: number, t: number) {
    now = t;
    ship.position.y = Math.sin(t * 0.8) * 0.25 * km; ship.rotation.z = Math.sin(t * 0.6) * 0.02 * km; ship.rotation.x = Math.sin(t * 0.5) * 0.015 * km;
    deck?.update(t, km); air?.update(dt, t, km); decor?.update(t, km); dmg?.update(dt, t);
    if (focusView && focusFollow) { const f = focusFollow(); if (f) focusView.target.copy(ship.localToWorld(f)); }

    // портал: руны горят по энергии дня, открытый — в полную силу
    portalFx.setPower(portalOpen ? 1.1 : 0.12 + energy * 0.75); portalFx.update(dt, t);

    // живой корабль: герой сам ходит между станциями палубы (нос у портала, корма, середина, борта)
    if (activity && t > activity.until) { endActivity(); nextWander = t + 2.5; }
    if (mode === 'hub' && !walk && !cutscene && km === 1 && deck && t > nextWander) {
      const st = home.length ? anyHome() : spot(WANDER[Math.floor(Math.random() * WANDER.length)]);   // в главном меню гуляет в кадре, у портала
      nextWander = t + 5 + Math.random() * 5;
      goTo(st[0], st[1], () => startActivity(t));
    }
    // герой
    let walking = false;
    if (walk) {
      const tg = walk.path[walk.i], dx = tg[0] - hero.position.x, dz = tg[1] - hero.position.z, L = Math.hypot(dx, dz);
      // дошёл до клетки пути, а путь продолжается — он всё ещё идёт: иначе на каждой клетке кадр «стоит» и шаг начинается заново
      if (L < 0.1) { if (++walk.i >= walk.path.length) { const r = walk.res; walk = null; hero.rotation.y = mode === 'hub' ? PORTAL_FACE - 0.25 : Math.PI / 2; r(); } else walking = true; }
      else { walking = true; const st = Math.min(L, dt * (walk.run ? 7 : 3.4)); hero.position.x += dx / L * st; hero.position.z += dz / L * st;
        hero.rotation.y += Math.atan2(Math.sin(Math.atan2(dx, dz) - hero.rotation.y), Math.cos(Math.atan2(dx, dz) - hero.rotation.y)) * Math.min(1, dt * 12); }
    }
    if (deck && !pulling) { const hh = deck.height(hero.position.x, hero.position.z); if (hh != null) hero.position.y += (hh - hero.position.y) * Math.min(1, dt * 14); }
    // анимации героя настоящие: ходьба/стойка меняются сами, радость — разовая
    fig.walking(walking, walking && !!walk?.run); fig.update(dt);
    if (celebrateT > 0) { celebrateT = 0; fig.play('Cheering', 1.1); pet.hop(); }
    pet.update(dt, t);

    for (let i = bursts.length - 1; i >= 0; i--) {
      const b = bursts[i]; b.life -= dt;
      b.parts.forEach(p => { p.v.y -= dt * 6; p.m.position.addScaledVector(p.v, dt); p.m.rotation.x += dt * 5; p.m.scale.multiplyScalar(0.985); });
      if (b.life <= 0) { scene.remove(b.g); bursts.splice(i, 1); }
    }
  }

  // ---------- Праздник нового предмета ----------
  const wait = (sec: number) => new Promise<void>(r => setTimeout(r, sec * 1000));
  const hider = new Map<string, number>();                          // кто спрятал предмет до появления (номер показа): если показ оборвали, предмет возвращается
  async function showDecorImpl(id: string) {
    const it = ITEMS.find(x => x.id === id); if (!it || (mode !== 'hub' && mode !== 'hero') || cutscene || pulling) return;
    const tok = ++focusTok, isPet = it.slot === 'pet';
    try {
      let at: THREE.Vector3 | null = null;
      if (isPet) {
        if (pet.id !== id) void pet.set(id);
        const ok = await pet.ready();                                    // модель могла ещё грузиться (первая покупка): ждём её, а не фокусируемся на пустоте
        if (tok !== focusTok || !ok) return;
        pet.snap(); at = pet.pos(); focusFollow = () => pet.pos();
      }
      else {
        hider.set(id, tok); decor?.hide(id);
        const o = await (decor?.ready(id) ?? Promise.resolve(null)); if (tok !== focusTok || !o) return;
        decor!.hide(id); at = decor!.focusOf(id); focusFollow = null;
      }
      if (!at) return;
      const high = it.slot === 'mast', w = ship.localToWorld(at.clone());
      focusView = { target: w, radius: Math.min(views.hub.radius * (high ? 0.62 : 0.4), high ? 15 : 10), phi: high ? 1.3 : 0.95, theta: high || it.slot === 'bow' || isPet ? HUB_THETA : 2.0 };   // палубные и кормовые — с борта повыше, чтобы поручни не закрывали
      await wait(1.1); if (tok !== focusTok) return;
      const p = ship.localToWorld(at.clone()); p.y += 0.6;
      burst(p, 0xffd45a, 44, 4.5); burst(p, 0x3ff0ff, 26, 3.5);
      if (isPet) { await pet.pop(); pet.hop(); } else { hider.delete(id); fig.play('Cheering', 1.1); await decor!.pop(id); }
      await wait(1.2);
    } finally {
      if (hider.get(id) === tok) { hider.delete(id); decor?.restore(id); }   // показ оборвали (катсцена, другой показ) — предмет не остаётся невидимым
      if (tok === focusTok) { focusView = null; focusFollow = null; }
    }
  }
  /** Отмена показа предмета: камера возвращается (катсцена портала, бой). */
  const cancelShow = () => { focusTok++; focusView = null; focusFollow = null; };

  const worldPos = (o: THREE.Object3D, dy = 1) => o.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, dy, 0));

  return {
    views,
    viewFor(m) {
      if (m === 'hero') { hero.getWorldPosition(views.hero.target); views.hero.target.y += 1.15; }
      if (focusView && (m === 'hub' || m === 'hero')) return focusView;
      return focusPortal && m === 'hub' ? views.portal : views[m === 'map' ? 'hub' : m];
    },
    update,
    enterMode(m) {
      const tiny = hero.scale.x < 0.99 || pulling;                  // после входа в портал герой уменьшен и висит в центре кольца
      if ((m === 'hub' || m === 'hero') && (mode !== m || tiny)) {
        walk = null; endActivity(true); hero.scale.setScalar(1); cutscene = pulling = focusPortal = false; portalP = null; cutToken++; portalOpen = false;
        if (m === 'hero') { const s0 = home.length ? home[Math.floor(home.length / 2)] : spot('mid'); hero.position.set(s0[0], deck?.height(s0[0], s0[1]) ?? 0, s0[1]); hero.rotation.y = PORTAL_FACE + 0.2; frameHero(); }
        else if (tiny) { hero.position.set(portalStand[0], 0, portalStand[1]); hero.rotation.y = PORTAL_FACE - 0.25; }
      }
      // из боя — герой возвращается через портал на палубу
      if (m === 'hub' && mode === 'battle') {
        // портал вспыхивает, герой вылетает из центра кольца и приземляется перед ним
        const b0 = portalStand, gx = b0[0], gy = deck?.height(b0[0], b0[1]) ?? 0, c = ship.worldToLocal(portalCenter()), tok = cutToken;
        hero.scale.setScalar(0.01); hero.position.copy(c); hero.rotation.y = PORTAL_FACE; portalOpen = true; pulling = cutscene = true;
        setTimeout(() => { if (tok !== cutToken) return; portalFx.pulse(); burst(portalCenter(), 0x3ff0ff, 50, 5);
          anim(0.55, u => { const e = 1 - (1 - u) ** 3; hero.scale.setScalar(Math.max(0.01, e)); hero.position.set(c.x + (gx - c.x) * e, c.y + (gy - c.y) * u * u + Math.sin(u * Math.PI) * 0.6, c.z + (b0[1] - c.z) * e); }, tok)
            .then(() => { if (tok !== cutToken) return; hero.scale.setScalar(1); pulling = cutscene = false; nextWander = now + 8; const s1 = anyHome(); goTo(s1[0], s1[1], () => { portalOpen = false; celebrateT = 0.6; }); });
        }, 350);
      }
      if (m !== 'hub' && m !== 'hero') cancelShow();
      mode = m; if (m === 'hub' || m === 'hero') pet.snap();
    },
    portalWalk() {
      if (portalP) return portalP;                                       // повторный вызов — та же катсцена
      cancelShow(); framePortal(); const tok = cutToken; cutscene = focusPortal = true; portalOpen = true; deps.onCutscene();          // портал разгорается, пока герой бежит
      portalP = new Promise<void>(res => {
        // герой бежит к порталу, тот вспыхивает, героя затягивает в центр вихря с поворотом — вспышка
        // Пути к площадке нет (украшение отрезало героя, он на корме за ним): не летим сквозь корабль, а переносимся со вспышкой
        if (deck && !deck.path([hero.position.x, hero.position.z], portalStand).length) poofTo(portalStand[0], portalStand[1]);
        goTo(portalStand[0], portalStand[1], async () => {
          if (tok !== cutToken) return res();
          if (deck && Math.hypot(hero.position.x - portalStand[0], hero.position.z - portalStand[1]) > 1.2) poofTo(portalStand[0], portalStand[1]);   // не дошёл (путь оборвали) — тоже вспышкой, а не рывком через палубу
          hero.rotation.y = Math.atan2(portal.position.x - hero.position.x, portal.position.z - hero.position.z);   // лицом к порталу
          portalFx.pulse(); fig.play('Cheering', 1.6);
          await anim(0.6, () => {}, tok);                                 // камера успевает подлететь, ребёнок видит героя у портала
          pulling = true; const p0 = hero.position.clone(), c = ship.worldToLocal(portalCenter()), r0 = hero.rotation.y;
          await anim(0.75, u => { const e = u * u; hero.position.lerpVectors(p0, c, e); hero.rotation.y = r0 + e * Math.PI * 3; hero.scale.setScalar(Math.max(0.01, 1 - e)); }, tok);
          if (tok === cutToken) { portalFx.pulse(); burst(portalCenter(), 0x3ff0ff, 90, 7); }
          res();
        }, true);
      });
      return portalP;
    },
    heroWalk(x, z) { return new Promise<void>(res => goTo(x, z, res)); },
    tap,
    celebrate(color) { celebrateT = 1.2; burst(worldPos(hero, 2.5), color, 50, 5); },
    setDamage(n) { dmgN = Math.max(0, Math.min(MAX_DAMAGE, Math.floor(n))); dmg?.set(dmgN); },
    setShipDecor(owned, pid) { ownedDecor = owned.slice(); petId = pid; decor?.set(ownedDecor); pet.set(pid && ITEMS.some(i => i.id === pid && i.slot === 'pet') ? pid : null); },
    async showDecor(id) { await showDecorImpl(id); },
    openPortal() { portalOpen = true; portalFx.pulse(); burst(portalCenter(), 0x3ff0ff, 90, 7); },
    setEnergy(v, max) { energy = Math.max(0, Math.min(1, v / max)); },
    setLook(look) { fig.setLook(look); },
    setCape(c) { fig.setCape(c); },
    heroWorldPos(v) { return hero.getWorldPosition(v); },
    get inCutscene() { return cutscene; },
    dispose() { cutToken++; focusView = null; decor?.dispose(); dmg?.dispose(); pet.dispose(); portalFx.dispose(); },
  };
}
