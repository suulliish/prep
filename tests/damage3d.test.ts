// Поломки корабля (src/three/damage3d.ts): места, число видимых, починка, касание, частицы и освобождение памяти. Без GPU: корабль-заменитель из коробок.
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createDamage, planDamage, rng, MAX_DAMAGE, type Damage } from '../src/three/damage3d';
import { sampleSurface } from '../src/three/decor3d';
import type { Deck } from '../src/three/deck3d';

/** Корабль-заменитель: плоский корпус (верх на y = 0), высокие борта, «мачтовое основание» посередине; ходить можно по полосе |z| < 2 вокруг основания. */
function fakeShip() {
  const ship = new THREE.Group(), model = new THREE.Group(), mat = new THREE.MeshBasicMaterial();
  const box = (w: number, h: number, d: number, x: number, y: number, z: number) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); model.add(m); return m; };
  box(20, 0.2, 7, 0, -0.1, 0); box(20, 1.2, 0.3, 0, 0.6, 3.15); box(20, 1.2, 0.3, 0, 0.6, -3.15); box(1.0, 1.6, 1.4, -0.5, 0.8, 0);
  ship.add(model); ship.updateMatrixWorld(true);
  const walkable = (x: number, z: number) => Math.abs(z) < 2.0 && x > -6 && x < 5 && !(Math.abs(x + 0.5) < 1.0 && Math.abs(z) < 1.0);
  const deck = { model, hull: new THREE.Box3().setFromObject(model), walkable } as unknown as Deck;
  return { ship, deck };
}
const AVOID: [number, number, number][] = [[4.5, 0, 1.9], [3.4, 0, 1.3]];
const make = (o: Partial<{ quality: 'high' | 'low'; km: number; avoid: [number, number, number][] }> = {}) => {
  const s = fakeShip(); const d = createDamage(s.ship, s.deck, { quality: 'high', km: 1, avoid: AVOID, ...o });
  return { ...s, d };
};
/** Гнать время вперёд: n секунд кадрами по step. */
function run(d: Damage, sec: number, step = 1 / 30, t0 = 0) { let t = t0; for (let i = 0; i < Math.round(sec / step); i++) { t += step; d.update(step, t); } return t; }

describe('damage3d: места', () => {
  it('шесть мест, все нашлись, на плоском полу палубы (высота корпуса под точкой)', () => {
    const { ship, deck, d } = make();
    expect(d.spots).toHaveLength(MAX_DAMAGE);
    const s = sampleSurface(ship, deck);
    for (const sp of d.spots) { expect(Number.isFinite(sp.x) && Number.isFinite(sp.z), sp.kind).toBe(true); expect(sp.y).toBeCloseTo(s.at(sp.x, sp.z), 5); expect(Math.abs(sp.y)).toBeLessThan(0.06); expect(Math.abs(sp.z)).toBeLessThan(2.6); }
    // разные виды: пробоина, провод, кристалл, доска, трещина
    expect(new Set(d.spots.map(x => x.kind)).size).toBeGreaterThanOrEqual(5);
  });
  it('раскладка детерминирована и не зависит от порядка показа', () => {
    const a = make(), b = make();
    expect(a.d.spots).toEqual(b.d.spots);
    b.d.set(2); run(b.d, 2); b.d.set(6); run(b.d, 2); b.d.set(1); run(b.d, 3); b.d.set(6); run(b.d, 2);
    expect(b.d.spots).toEqual(a.d.spots);
    a.d.set(6); run(a.d, 1);
    for (let i = 0; i < 6; i++) { const p = a.d.at(i), q = b.d.at(i); expect(p.distanceTo(q)).toBeLessThan(1e-6); }
    expect(planDamage(sampleSurface(a.ship, a.deck), AVOID, a.deck)).toEqual(a.d.spots);
  });
  it('не ближе 1.9 м к порталу и 1.3 м к месту входа героя (и к любому другому кругу avoid)', () => {
    const extra: [number, number, number][] = [...AVOID, [0.7, 0.0, 1.2]];
    const { d } = make({ avoid: extra });
    for (const sp of d.spots) for (const [x, z, r] of extra) expect(Math.hypot(sp.x - x, sp.z - z), `${sp.kind} у круга ${x},${z}`).toBeGreaterThanOrEqual(r);
    // и без лишнего круга места другие: круг действительно влияет
    expect(make().d.spots).not.toEqual(d.spots);
  });
  it('поломки разнесены друг от друга', () => {
    const { d } = make();
    for (let i = 0; i < 6; i++) for (let j = i + 1; j < 6; j++) expect(Math.hypot(d.spots[i].x - d.spots[j].x, d.spots[i].z - d.spots[j].z), `${i}-${j}`).toBeGreaterThanOrEqual(0.95);
  });
  it('объёмные (провод, кристалл) стоят там, куда герой не ходит: путь не меняется', () => {
    const { deck, d } = make();
    for (const sp of d.spots) if (sp.kind === 'wire' || sp.kind === 'crystal') expect(deck.walkable(sp.x, sp.z), sp.kind).toBe(false);
  });
  it('места нет совсем (весь корабль в avoid) — поломка не показывается, ошибок нет', () => {
    const { d } = make({ avoid: [[0, 0, 50]] });
    expect(d.spots.every(s => Number.isNaN(s.x))).toBe(true);
    d.set(6); run(d, 1); expect(d.visible()).toEqual([]);
  });
  it('rng детерминирован', () => { const a = rng(3), b = rng(3); expect(Array.from({ length: 20 }, () => a())).toEqual(Array.from({ length: 20 }, () => b())); });
});

describe('damage3d: число видимых и починка', () => {
  it('set(n) показывает n (0..6, с зажимом), по возрастанию номера; 0 — корень скрыт', () => {
    const { ship, d } = make(); const g = ship.getObjectByName('damage')!;
    d.set(3); run(d, 1); expect(d.visible()).toEqual([0, 1, 2]); expect(d.stats().visible).toBe(3); expect(d.positions()).toHaveLength(3);
    d.set(9); run(d, 1); expect(d.visible()).toEqual([0, 1, 2, 3, 4, 5]);
    d.set(-2); run(d, 3); expect(d.visible()).toEqual([]); expect(g.visible).toBe(false);
  });
  it('меньше n — чинятся последние, по анимации (не сразу)', () => {
    const { d } = make(); d.set(6); run(d, 1);
    // счёт уже 3, но чинящиеся ещё на экране
    d.set(3); d.update(0.05, 1); expect(d.stats().visible).toBe(3);
    const fixing = [3, 4, 5].map(i => d.at(i)); expect(fixing.every(p => Number.isFinite(p.x))).toBe(true);
    run(d, 3); expect(d.visible()).toEqual([0, 1, 2]);
  });
  it('fix(i): промис ждёт конца анимации (~1.1 с), потом поломки нет; невидимую чинить — сразу', async () => {
    const { ship, d } = make(); d.set(6); run(d, 1);
    let done = false; const p = d.fix(2).then(() => { done = true; });
    // корни поломок идут первыми, по номеру
    const root = (i: number) => ship.getObjectByName('damage')!.children[i];
    // чинится: на экране, но уже не считается
    run(d, 0.5); await Promise.resolve(); expect(done).toBe(false); expect(root(2).visible).toBe(true);
    run(d, 1.2); await p; expect(done).toBe(true); expect(root(2).visible).toBe(false); expect(d.visible()).toEqual([0, 1, 3, 4, 5]); expect(d.positions()).toHaveLength(5);
    // уже починена
    await d.fix(2);
    // без номера — последняя видимая
    const last = d.fix(); run(d, 1.5); await last; expect(d.visible()).toEqual([0, 1, 3, 4]);
    // счёт уже 4: ничего не двигается
    d.set(4); run(d, 1); expect(d.visible()).toEqual([0, 1, 3, 4]);
    // новая поломка появляется на ближайшем свободном месте
    d.set(5); run(d, 1); expect(d.visible()).toEqual([0, 1, 2, 3, 4]);
  });
  it('появление — упругий рост от нуля до единичного масштаба; при km = 0 — сразу', () => {
    const { ship, d } = make(), root = (i: number) => ship.getObjectByName('damage')!.children[i] as THREE.Group;
    // самый первый показ (загрузка экрана) — без анимации
    d.set(1); expect(root(0).scale.x).toBe(1);
    d.set(2); d.update(1 / 60, 1); expect(root(1).visible).toBe(true); expect(root(1).scale.x).toBeLessThan(0.5);
    run(d, 1); expect(root(1).scale.x).toBe(1); expect(d.visible()).toEqual([0, 1]);
    const z = make({ km: 0 }); z.d.set(1); run(z.d, 0.1); z.d.set(3); z.d.update(1 / 60, 1);
    expect(z.d.visible()).toEqual([0, 1, 2]); expect(Array.from({ length: 3 }, (_, i) => (z.ship.getObjectByName('damage')!.children[i] as THREE.Group).scale.x)).toEqual([1, 1, 1]);
  });
});

describe('damage3d: касание и камера', () => {
  const rayTo = (p: THREE.Vector3, from: THREE.Vector3) => new THREE.Raycaster(from, p.clone().sub(from).normalize());
  it('pick: луч в поломку — её номер; мимо — -1; скрытая и чинящаяся не ловятся', () => {
    const { d } = make(); d.set(3); run(d, 1);
    for (const i of [0, 1, 2]) { const c = d.at(i); expect(d.pick(rayTo(c, c.clone().add(new THREE.Vector3(4, 5, 6))))).toBe(i); }
    const far = d.at(0).clone().add(new THREE.Vector3(0, 4, 0)); expect(d.pick(new THREE.Raycaster(far, new THREE.Vector3(0, 1, 0)))).toBe(-1);
    // скрытая: та из 3..5, что дальше всех от показанных (палец у соседней не должен ловить чужую)
    const hidden = [3, 4, 5].sort((a, b) => Math.min(...[0, 1, 2].map(i => d.at(b).distanceTo(d.at(i)))) - Math.min(...[0, 1, 2].map(i => d.at(a).distanceTo(d.at(i)))))[0];
    const ch = d.at(hidden); expect(d.pick(new THREE.Raycaster(ch.clone().add(new THREE.Vector3(0, 6, 0)), new THREE.Vector3(0, -1, 0)))).not.toBe(hidden);
    // чинящаяся не ловится
    d.fix(1); d.update(0.1, 2); const c1 = d.at(1); expect(d.pick(rayTo(c1, c1.clone().add(new THREE.Vector3(0, 5, 0))))).not.toBe(1);
  });
  it('positions() — мировые центры видимых; at(i) следует за качкой корабля', () => {
    const { ship, d } = make(); d.set(2); run(d, 1);
    const before = d.at(0).clone(); ship.position.y = 0.4; expect(d.at(0).y - before.y).toBeCloseTo(0.4, 5);
    expect(d.positions().map(p => p.y)).toEqual([d.at(0).y, d.at(1).y]);
    expect(d.at(99).length()).toBe(0);
  });
});

describe('damage3d: частицы и «уменьшить движение»', () => {
  it('high: дым и искры есть, но всего ≤ 100 точек на всё', () => {
    const { d } = make(); d.set(6); run(d, 8);
    const n = d.stats().particles; expect(n).toBeGreaterThan(5); expect(n).toBeLessThanOrEqual(100 - MAX_DAMAGE);
  });
  it('low: ни дыма, ни искр — только модель и блик', () => {
    const { ship, d } = make({ quality: 'low' }); d.set(6); run(d, 8); d.fix(0); run(d, 1.5);
    expect(d.stats().particles).toBe(0);
    const pts = ship.getObjectByName('damage')!.children.filter(c => (c as THREE.Points).isPoints) as THREE.Points[];
    expect(pts).toHaveLength(1); expect(pts[0].geometry.getAttribute('position').count).toBe(MAX_DAMAGE);
  });
  it('km = 0: без частиц, без мигания и качания (кадр за кадром одно и то же)', () => {
    const { ship, d } = make({ km: 0 }); d.set(6); run(d, 3);
    const snap = () => { const g = ship.getObjectByName('damage')!; const o: number[] = []; g.traverse(n => { if ((n as THREE.Mesh).isMesh) { const m = (n as THREE.Mesh).material as THREE.MeshToonMaterial; o.push(m.emissiveIntensity ?? 0, n.rotation.x, n.rotation.z, n.position.y); } }); return o; };
    const a = snap(); run(d, 1.7, 1 / 30, 3); expect(snap()).toEqual(a);
    expect(d.stats().particles).toBe(0);
    d.fix(2); run(d, 1); expect(d.stats().particles).toBe(0); expect(d.visible()).not.toContain(2);
  });
  it('с km = 0.3 (уменьшить движение) частиц заметно меньше, чем с 1', () => {
    const count = (km: number) => { const { d } = make({ km }); d.set(6); let sum = 0, t = 0; for (let i = 0; i < 300; i++) { t += 1 / 30; d.update(1 / 30, t); sum += d.stats().particles; } return sum; };
    expect(count(0.3)).toBeLessThan(count(1) * 0.6);
  });
});

describe('damage3d: без утечек', () => {
  it('dispose освобождает все геометрии, материалы и текстуры и снимает корень с корабля; ждущие промисы завершаются', async () => {
    const { ship, d } = make(); d.set(6); run(d, 2);
    const g = ship.getObjectByName('damage')!, geos = new Set<THREE.BufferGeometry>(), mats = new Set<THREE.Material>(), texs = new Set<THREE.Texture>();
    g.traverse(o => { const m = o as THREE.Mesh; if (m.geometry) geos.add(m.geometry); for (const x of ([] as THREE.Material[]).concat(m.material ?? [])) { mats.add(x); const t = (x as THREE.MeshToonMaterial).gradientMap; if (t) texs.add(t); } });
    expect(geos.size).toBeGreaterThan(20); expect(mats.size).toBeGreaterThan(10); expect(texs.size).toBe(1);
    const freed: unknown[] = [], on = (x: THREE.EventDispatcher<{ dispose: object }>) => x.addEventListener('dispose', () => freed.push(x));
    geos.forEach(on); mats.forEach(m => on(m as never)); texs.forEach(t => on(t as never));
    const pending = d.fix(1); d.dispose();
    // не зависает
    await pending;
    expect(freed.length).toBe(geos.size + mats.size + texs.size);
    expect(ship.getObjectByName('damage')).toBeUndefined();
    // повторный dispose и вызовы после него безвредны
    expect(() => { d.dispose(); d.set(3); d.update(0.1, 1); d.pick(new THREE.Raycaster()); }).not.toThrow();
  });
  it('создание и dispose много раз не оставляют детей на корабле', () => {
    const s = fakeShip(); const before = s.ship.children.length;
    for (let i = 0; i < 5; i++) { const d = createDamage(s.ship, s.deck, { quality: i % 2 ? 'low' : 'high', km: 1, avoid: AVOID }); d.set(6); run(d, 0.5); d.dispose(); }
    expect(s.ship.children.length).toBe(before);
  });
});

describe('damage3d: починка с задержкой (молоток героя)', () => {
  it('set(n, delay): починяемая поломка стоит на месте, пока идёт задержка, потом чинится и исчезает', () => {
    const { ship, d } = make(); d.set(2); const t = run(d, 2);
    const onScreen = () => ship.getObjectByName('damage')!.children.filter(c => c.name.startsWith('damage_') && c.visible).length;
    expect(onScreen()).toBe(2);
    d.set(1, 1.0); const t1 = run(d, 0.6, 1 / 30, t); expect(onScreen()).toBe(2);
    const t2 = run(d, 3, 1 / 30, t1); expect(onScreen()).toBe(1); expect(d.stats().visible).toBe(1);
    run(d, 0.1, 1 / 30, t2);
  });
  it('fix(i, delay): промис завершается после задержки и починки', async () => {
    const { d } = make(); d.set(1); const t = run(d, 2);
    let done = false; d.fix(undefined, 0.8).then(() => (done = true));
    run(d, 0.5, 1 / 30, t); await Promise.resolve(); expect(done).toBe(false);
    run(d, 3, 1 / 30, t + 0.5); await Promise.resolve(); expect(done).toBe(true);
  });
});
