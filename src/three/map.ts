// 3D-карта миров «Жарық»: 12 летающих островов на извилистом маршруте, у каждого свой ориентир.
// Корабль с героем стоит у текущего мира; при перелёте герой садится на корабль, летит по маршруту и сходит на остров.
// Палец/мышь двигают камеру вдоль маршрута (а не вращают фон), касание острова — выбор мира.
import * as THREE from 'three';
import { HeroFigure } from './figure';
import { DEFAULT_LOOK, type HeroLook } from './looks';
import { buildMapIsle, loadIslandKits } from './island3d';
import { Kit } from './assets';
import { dressAirship, type Airship } from './airship';

export type IsleState = 'cleared' | 'current' | 'open' | 'next' | 'locked' | 'fog';
export interface MapIsle { id: string; a: string; b: string; state: IsleState }
export interface MapLabel { i: number; x: number; y: number; on: boolean }

interface Deps {
  skyMat: THREE.Material; starGeo: THREE.BufferGeometry; starMat: THREE.Material;
  km: number;
}

// ---------- общие строители (карта и боевая локация) ----------
// материалы с кэшем; «серые» острова — отдельные цвета, поэтому ключ по итоговому цвету
const mats = new Map<string, THREE.MeshStandardMaterial>();
export const mat = (c: number, e = 0, ei = 1) => {
  const k = `${c}_${e}_${ei}`;
  if (!mats.has(k)) mats.set(k, new THREE.MeshStandardMaterial({ color: c, emissive: e, emissiveIntensity: ei, roughness: 0.85, flatShading: true }));
  return mats.get(k)!;
};

// ---------- острова ----------
export function tone(hex: number, st: IsleState) {
  if (st !== 'locked' && st !== 'fog') return hex;
  const c = new THREE.Color(hex); const g = c.r * 0.3 + c.g * 0.59 + c.b * 0.11;
  const k = st === 'fog' ? 0.28 : 0.55;
  return new THREE.Color(g * k + 0.05, g * k + 0.05, g * k + 0.09).getHex();
}
export function builder(g: THREE.Group, st: IsleState) {
  const lit = st !== 'locked' && st !== 'fog';
  return (sx: number, sy: number, sz: number, x: number, y: number, z: number, c: number, e = 0, ei = 1.2) => {
    const m = new THREE.Mesh(box, mat(tone(c, st), lit ? e : 0, ei)); m.scale.set(sx, sy, sz); m.position.set(x, y, z); g.add(m); return m;
  };
}

const P = (i: number) => new THREE.Vector3(Math.sin(i * 1.25) * 8, i * 1.6, -i * 12);
const box = new THREE.BoxGeometry(1, 1, 1);

export function createMap(d: Deps) {
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x17104a, 26, 95);
  const camera = new THREE.PerspectiveCamera(46, 1, 0.1, 400);
  const sky = new THREE.Mesh(new THREE.SphereGeometry(150, 32, 16), d.skyMat); scene.add(sky);
  const stars = new THREE.Points(d.starGeo, d.starMat); scene.add(stars);
  scene.add(new THREE.HemisphereLight(0xa9bcff, 0x3a1f46, 1.0));
  const sun = new THREE.DirectionalLight(0xffe6c8, 1.7); sun.position.set(-10, 20, 12); scene.add(sun);

  const root = new THREE.Group(); scene.add(root);
  let isles: MapIsle[] = [];
  let cur = 0;
  const hits: THREE.Mesh[] = [];
  const bob: { g: THREE.Group; y: number; ph: number }[] = [];
  const rings: THREE.Mesh[] = [];
  const beacons: THREE.Mesh[] = [];
  let curve: THREE.CatmullRomCurve3 | null = null;

  function makeIsle(i: number, it: MapIsle) {
    const g = new THREE.Group(); const p = P(i); g.position.copy(p); root.add(g);
    const b = builder(g, it.state);
    const A = new THREE.Color(it.a).getHex();
    // остров из готовых плиток и моделей мира (палитра мира — src/three/worlds3d.ts); закрытые миры серые
    const gray = it.state === 'fog' ? 1 : it.state === 'locked' ? 0.6 : 0;
    loadIslandKits(Math.min(i, 11)).then(kits => { if (g.parent) g.add(buildMapIsle(kits, Math.min(i, 11), A, gray)); }).catch(() => {});
    if (it.state === 'cleared') { b(0.12, 2, 0.12, 2.3, 1.5, 1.6, 0xdddddd); b(0.9, 0.55, 0.08, 2.75, 2.2, 1.6, 0x5ce39c, 0x5ce39c, 1.2); }
    if (it.state === 'current') {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(4.1, 0.09, 6, 48), new THREE.MeshBasicMaterial({ color: 0x3ff0ff, transparent: true, opacity: 0.9, fog: false }));
      ring.rotation.x = Math.PI / 2; ring.position.y = 0.2; g.add(ring); rings.push(ring);
    }
    if (it.state === 'next') {
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 14, 12, 1, true), new THREE.MeshBasicMaterial({ color: 0xffc94a, transparent: true, opacity: 0.25, depthWrite: false, side: THREE.DoubleSide, fog: false }));
      beam.position.y = 7; g.add(beam); beacons.push(beam);
    }
    const hit = new THREE.Mesh(new THREE.SphereGeometry(4.3, 8, 6), new THREE.MeshBasicMaterial({ visible: false }));
    hit.position.y = 1.2; hit.userData.i = i; g.add(hit); hits.push(hit);
    bob.push({ g, y: p.y, ph: i * 1.7 });
  }

  // ---------- маршрут ----------
  let dotsOn: THREE.InstancedMesh | null = null, dotsOff: THREE.InstancedMesh | null = null;
  function makeRoute() {
    curve = new THREE.CatmullRomCurve3(isles.map((_, i) => P(i).add(new THREE.Vector3(0, 1.4, 0))));
    const len = curve.getLength(), n = Math.floor(len / 1.1);
    const on: THREE.Vector3[] = [], off: THREE.Vector3[] = [];
    for (let k = 1; k < n; k++) { const u = k / n; (u * (isles.length - 1) <= cur ? on : off).push(curve.getPointAt(u)); }
    const mk = (pts: THREE.Vector3[], c: number, e: number) => {
      const im = new THREE.InstancedMesh(box, new THREE.MeshStandardMaterial({ color: c, emissive: e, emissiveIntensity: 1.6 }), Math.max(1, pts.length));
      const m4 = new THREE.Matrix4(); pts.forEach((p, i) => { m4.makeScale(0.22, 0.22, 0.22).setPosition(p); im.setMatrixAt(i, m4); }); im.count = pts.length; root.add(im); return im;
    };
    dotsOn = mk(on, 0x3ff0ff, 0x3ff0ff); dotsOff = mk(off, 0x4353a8, 0x000000);
  }

  // ---------- корабль и герой ----------
  const ship = new THREE.Group(); scene.add(ship);
  // корабль на карте — готовая модель Kenney (как на палубе в хабе); герой стоит на её палубе
  const DECK = new THREE.Vector3(0, 0.6, 0);
  // та же лётная оснастка, что у корабля-базы (airship.ts): двигатели, кристалл под килем, фонари
  let air: Airship | null = null;
  Kit.load('ship').then(k => {
    const m = k.get('ship-small', { height: 4.6 }); const h = new THREE.Group(); h.add(m); h.rotation.y = Math.PI / 2;
    h.updateMatrixWorld(true); const hull = new THREE.Box3().setFromObject(h);
    ship.add(h); ship.updateMatrixWorld(true);
    // палуба: верх корпуса в центре (паруса не считаем)
    const rc = new THREE.Raycaster(new THREE.Vector3(0, 20, 0).applyMatrix4(ship.matrixWorld), new THREE.Vector3(0, -1, 0));
    const hit = rc.intersectObject(ship, true).find(x => !/sail|flag|outline/.test(x.object.name) && x.point.y < 2.6 + ship.position.y);
    if (hit) DECK.y = ship.worldToLocal(hit.point.clone()).y;
    air = dressAirship(hull, m, { quality: 'low', deckY: DECK.y }); ship.add(air.g);
  }).catch(() => {});

  const fig = new HeroFigure(DEFAULT_LOOK, 0.62), hero = { g: fig.g }; scene.add(fig.g);   // настоящий герой с анимациями
  const DOCK = new THREE.Vector3(-3.9, 0.9, 3.4);   // где корабль стоит у острова
  const STAND = new THREE.Vector3(1.2, 0.5, 2.0);  // где герой стоит на острове
  let heroOnShip = false;
  type Phase = { k: 'idle' } | { k: 'walk'; from: THREE.Vector3; to: THREE.Vector3; t: number; dur: number; next: () => void } | { k: 'fly'; a: number; b: number; t: number; dur: number; next: () => void };
  let phase: Phase = { k: 'idle' };

  const isleTop = (i: number) => P(i);
  const dockAt = (i: number) => isleTop(i).add(DOCK);
  const standAt = (i: number) => isleTop(i).add(STAND);
  function placeAt(i: number) {
    ship.position.copy(dockAt(i)); ship.rotation.set(0, 0, 0);
    hero.g.position.copy(standAt(i)); hero.g.rotation.y = 0.6; heroOnShip = false;
  }

  // ---------- камера ----------
  let s = 0, sTo = 0, follow: THREE.Vector3 | null = null;
  const lookP = (x: number) => { const i = Math.floor(x), f = x - i; const a = P(Math.max(0, Math.min(isles.length - 1, i))), b = P(Math.max(0, Math.min(isles.length - 1, i + 1))); return a.lerp(b, f); };
  const look = new THREE.Vector3(), camTo = new THREE.Vector3();
  let aspect = 1;
  function placeCamera(k: number) {
    const narrow = aspect < 0.8;
    camTo.set(look.x + 4, look.y + (narrow ? 13 : 9), look.z + (narrow ? 24 : 18));
    camera.position.lerp(camTo, k);
    camera.lookAt(look.x, look.y + 1.2, look.z - 2);
  }

  let pickCb: (i: number) => void = () => {};
  const ray = new THREE.Raycaster();

  function setup(list: MapIsle[], current: number) {
    while (root.children.length) root.remove(root.children[0]);
    hits.length = 0; bob.length = 0; rings.length = 0; beacons.length = 0;
    isles = list; cur = current;
    list.forEach((it, i) => makeIsle(i, it));
    makeRoute();
    if (phase.k === 'idle') placeAt(cur);
    s = sTo = cur; look.copy(lookP(s)); placeCamera(1); // сразу на месте, без «влёта» из центра острова
  }

  function travel(to: number): Promise<void> {
    return new Promise(res => {
      if (to === cur || !curve) { res(); return; }
      const from = cur;
      const board = () => { phase = { k: 'walk', from: hero.g.position.clone(), to: dockAt(from).add(DECK), t: 0, dur: 0.7, next: fly }; };
      const fly = () => { heroOnShip = true; phase = { k: 'fly', a: from, b: to, t: 0, dur: Math.min(4.5, 1.2 + Math.abs(to - from) * 0.9), next: land }; };
      const land = () => { heroOnShip = false; cur = to; phase = { k: 'walk', from: hero.g.position.clone(), to: standAt(to), t: 0, dur: 0.8, next: () => { phase = { k: 'idle' }; follow = null; res(); } }; };
      board();
    });
  }

  function update(dt: number, t: number) {
    const km = d.km;
    bob.forEach(o => (o.g.position.y = o.y + Math.sin(t * 0.6 + o.ph) * 0.35 * km));
    rings.forEach(r => { const k = 1 + Math.sin(t * 2.4) * 0.04; r.scale.set(k, k, k); (r.material as THREE.MeshBasicMaterial).opacity = 0.6 + Math.sin(t * 2.4) * 0.3; r.rotation.z += dt * 0.4; });
    beacons.forEach(b => ((b.material as THREE.MeshBasicMaterial).opacity = 0.16 + Math.abs(Math.sin(t * 1.6)) * 0.18));
    air?.update(dt, t, km);

    // герой / корабль
    let walking = false;
    if (phase.k === 'walk') {
      phase.t += dt / phase.dur; const u = Math.min(1, phase.t);
      hero.g.position.lerpVectors(phase.from, phase.to, u); hero.g.position.y += Math.sin(u * Math.PI) * 0.4;
      hero.g.rotation.y = Math.atan2(phase.to.x - phase.from.x, phase.to.z - phase.from.z); walking = true;
      if (u >= 1) phase.next();
    } else if (phase.k === 'fly' && curve) {
      phase.t += dt / phase.dur; const u = Math.min(1, phase.t), e = u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2;
      const n = isles.length - 1, x = (phase.a + (phase.b - phase.a) * e) / n;
      const p = curve.getPointAt(Math.max(0, Math.min(1, x))).add(new THREE.Vector3(0, 2.2 + Math.sin(u * Math.PI) * 2.5, 0));
      const ahead = curve.getPointAt(Math.max(0, Math.min(1, x + (phase.b > phase.a ? 0.01 : -0.01)))).add(new THREE.Vector3(0, 2.2, 0));
      const end = dockAt(phase.b);
      if (u > 0.85) p.lerp(end, (u - 0.85) / 0.15);
      ship.position.copy(p);
      ship.rotation.y = Math.atan2(-(ahead.z - p.z), ahead.x - p.x); ship.rotation.z = Math.sin(t * 3) * 0.05;
      follow = p; sTo = phase.a + (phase.b - phase.a) * e;
      if (u >= 1) { ship.rotation.set(0, 0, 0); phase.next(); }
    } else {
      ship.position.y += (dockAt(cur).y + Math.sin(t * 1.1) * 0.15 - ship.position.y) * 0.1;
    }
    if (heroOnShip) { hero.g.position.copy(ship.position).add(DECK); hero.g.rotation.y = ship.rotation.y + Math.PI / 2; }
    fig.walking(walking); fig.update(dt);

    // камера: плавно к точке маршрута (или за кораблём в полёте)
    const k = 1 - Math.exp(-dt * 7); // сглаживание, не зависящее от частоты кадров
    s += (sTo - s) * k;
    look.lerp(follow ?? lookP(s), k);
    placeCamera(k);
    sky.position.copy(camera.position); stars.position.copy(camera.position);
  }

  return {
    scene, camera,
    setup,
    setLook(l: HeroLook) { fig.setLook(l); },
    setCape(c: { color: number; glow: boolean } | null) { fig.setCape(c); },
    travel,
    update,
    focus(i: number) { sTo = Math.max(0, Math.min(isles.length - 1, i)); },
    drag(dx: number, dy: number) { sTo = Math.max(0, Math.min(isles.length - 1, sTo - dy * 0.012 - dx * 0.003)); },
    wheel(dy: number) { sTo = Math.max(0, Math.min(isles.length - 1, sTo + dy * 0.004)); },
    click(nx: number, ny: number) {
      ray.setFromCamera(new THREE.Vector2(nx, ny), camera);
      const h = ray.intersectObjects(hits, false)[0];
      if (h) { const i = h.object.userData.i as number; sTo = i; pickCb(i); }
    },
    onPick(cb: (i: number) => void) { pickCb = cb; },
    /** Экранные координаты островов (0..1) — для подписей поверх канваса. */
    labels(): MapLabel[] {
      return isles.map((_, i) => {
        const v = P(i).add(new THREE.Vector3(0, 4.6, 0)).project(camera);
        return { i, x: (v.x + 1) / 2, y: (1 - v.y) / 2, on: v.z < 1 && Math.abs(v.x) < 1.2 && Math.abs(v.y) < 1.2 };
      });
    },
    get focusIndex() { return Math.round(sTo); },
    resize(w: number, h: number) {
      aspect = w / h; camera.aspect = aspect;
      // снизу карточка мира: поднимаем картинку, чтобы остров был в верхней половине экрана
      camera.setViewOffset(w, h, 0, h * (aspect < 0.8 ? 0.16 : 0.1), w, h); camera.updateProjectionMatrix();
    },
    setFog(c: THREE.Color) { (scene.fog as THREE.Fog).color.copy(c); },
  };
}
export type MapWorld = ReturnType<typeof createMap>;
