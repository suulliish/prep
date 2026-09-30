// Проверка поломок корабля без входа и экранов (только для разработки): damage.html?damage=0..6&q=high|low&km=1&view=hub|top|side|close:номер:расстояние:phi:сдвиг-theta
// Корабль, портал, украшения и свет — как в главном меню (hub3d), поверх них модуль damage3d. Параметры: &fix=i|last — после паузы починить (i — номер),
// &decor=0 — без украшений, &freeze=1 — кадры только по __step(n, dt) (для снимков), &cam=x,y,z,радиус,phi,theta — своя камера.
// В консоли: __d (модуль: set, fix, pick…), __step(n, dt), __view('close:2'), __w = { scene, camera }.
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { createDeck } from '../three/deck3d';
import { dressAirship } from '../three/airship';
import { createPortal } from '../three/portal';
import { createDecor, planSpots, sampleSurface, findMasts, ITEMS } from '../three/decor3d';
import { createDamage, decorCircles } from '../three/damage3d';

const q = new URLSearchParams(location.search);
const quality = (q.get('q') as 'high' | 'low') || 'high', km = +(q.get('km') ?? 1), freeze = q.get('freeze') === '1';
const canvas = document.getElementById('c') as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: quality === 'high', preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.shadowMap.enabled = quality === 'high'; renderer.toneMapping = THREE.NeutralToneMapping; renderer.toneMappingExposure = 1.05;
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x6a3a8f); scene.fog = new THREE.Fog(0x17104a, 34, 95);
const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 300);
scene.add(new THREE.HemisphereLight(0x9fb4ff, 0x40214a, 0.9));
const sun = new THREE.DirectionalLight(0xffe0c0, 1.6); sun.position.set(-14, 26, 12); sun.castShadow = quality === 'high'; sun.shadow.mapSize.set(1024, 1024);
Object.assign(sun.shadow.camera, { left: -15, right: 15, top: 15, bottom: -15, near: 1, far: 70 }); scene.add(sun);
let composer: EffectComposer | null = null;
if (quality === 'high') { composer = new EffectComposer(renderer); composer.addPass(new RenderPass(scene, camera)); composer.addPass(new UnrealBloomPass(new THREE.Vector2(512, 512), 0.6, 0.4, 0.95)); composer.addPass(new OutputPass()); }

const HUB_THETA = Math.PI - 0.55, PORTAL_FACE = Math.PI / 2 - HUB_THETA;
const cam = { target: new THREE.Vector3(), radius: 24, phi: 1.2, theta: HUB_THETA };
let shift = 0.08;
function resize() {
  const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); composer?.setSize(w, h); camera.aspect = w / h;
  shift = w / h < 0.8 ? 0.2 : 0.08; if (cam.target && !q.get('cam') && !viewMode.startsWith('close')) camera.setViewOffset(w, h, 0, h * shift, w, h); else camera.clearViewOffset();
  camera.updateProjectionMatrix();
}
let viewMode = q.get('view') || 'hub', portalTarget = new THREE.Vector3(), t = 0;
const ship = new THREE.Group(); scene.add(ship);

function place() {
  camera.position.set(cam.target.x + cam.radius * Math.sin(cam.phi) * Math.cos(cam.theta), cam.target.y + cam.radius * Math.cos(cam.phi), cam.target.z + cam.radius * Math.sin(cam.phi) * Math.sin(cam.theta));
  camera.lookAt(cam.target);
}
function setView(v: string) {
  viewMode = v;
  if (v === 'top') Object.assign(cam, { radius: 22, phi: 0.25, theta: HUB_THETA }), cam.target.set(-1, 0, 0);
  else if (v === 'side') Object.assign(cam, { radius: 20, phi: 1.35, theta: 1.4 }), cam.target.set(-1, 1, 0);
  else if (v.startsWith('close')) { const i = +v.split(':')[1] || 0; const p = (window as any).__d.at(i); Object.assign(cam, { radius: +(v.split(':')[2] || 4.2), phi: +(v.split(':')[3] || 1.05), theta: HUB_THETA + +(v.split(':')[4] || 0) }); cam.target.copy(p); }
  // радиус как у world.resize
  else { const w = innerWidth, h = innerHeight, side = w >= 1000 && w / h >= 1.15; Object.assign(cam, { radius: w / h < 0.8 ? 26 : side ? 21 : w / h < 1.5 ? 18 : 22, phi: 1.2, theta: HUB_THETA }); cam.target.copy(portalTarget); }
  const c = q.get('cam'); if (c && v === 'hub') { const a = c.split(',').map(Number); cam.target.set(a[0], a[1], a[2]); Object.assign(cam, { radius: a[3], phi: a[4], theta: a[5] }); }
  resize(); place();
}
(window as any).__view = setView;

let damage: ReturnType<typeof createDamage>, decor: ReturnType<typeof createDecor> | null = null, portalFx: ReturnType<typeof createPortal>, air: ReturnType<typeof dressAirship>, deckRef: Awaited<ReturnType<typeof createDeck>>;
function frame(dt: number) {
  t += dt; ship.position.y = Math.sin(t * 0.8) * 0.25 * km; ship.rotation.z = Math.sin(t * 0.6) * 0.02 * km; ship.rotation.x = Math.sin(t * 0.5) * 0.015 * km;
  deckRef.update(t, km); air.update(dt, t, km); decor?.update(t, km); portalFx.setPower(0.6); portalFx.update(dt, t); damage.update(dt, t);
  if (viewMode.startsWith('close')) setView(viewMode); else place();
  if (composer) composer.render(); else renderer.render(scene, camera);
}
(window as any).__step = (n = 1, dt = 1 / 60) => { for (let i = 0; i < n; i++) frame(dt); };
(window as any).__w = { scene, camera, ship, THREE, renderer };

(async () => {
  const d = await createDeck(quality); deckRef = d; ship.add(d.g);
  air = dressAirship(d.hull, d.model, { quality, furled: true }); ship.add(air.g);
  portalFx = createPortal({ radius: 1.35 }); const portal = portalFx.g; portal.rotation.y = PORTAL_FACE; portal.scale.setScalar(0.85); ship.add(portal);
  // портал и место героя — как в hub3d (loadDeck): кольцо на носу, герой встаёт напротив центра кольца
  const [px, pz] = d.nearest(d.bounds.maxX - 0.9, 0); portal.position.set(px, d.height(px, pz) ?? 0, pz);
  const nx = Math.sin(PORTAL_FACE), nz = Math.cos(PORTAL_FACE), RING = [-1.3, -0.65, 0, 0.65, 1.3];
  for (const k of RING) d.reserve(px + Math.cos(PORTAL_FACE) * k, pz - Math.sin(PORTAL_FACE) * k, 0.75);
  const cand: [number, number, number][] = [];
  for (let dx = -3.6; dx <= 3.6; dx += 0.3) for (let dz = -3.6; dz <= 3.6; dz += 0.3) {
    const along = dx * nx + dz * nz, lat = dx * nz - dz * nx;
    if (Math.abs(along) < 1 || Math.abs(along) > 2.6 || Math.abs(lat) > 0.6 || !d.walkable(px + dx, pz + dz)) continue;
    cand.push([Math.abs(along) + Math.abs(lat) * 2 + (along < 0 ? 0.3 : 0), px + dx, pz + dz]);
  }
  cand.sort((a, b) => a[0] - b[0]);
  const ok = cand.find(c => d.path(d.stations.mid, [c[1], c[2]]).length > 0), stand: [number, number] = ok ? [ok[1], ok[2]] : [3.5, 0];
  portalTarget.set(px + nx * 2.6, 1.6, pz + nz * 2.6);
  const avoid: [number, number, number][] = [[px, pz, 1.9], [stand[0], stand[1], 1.3]];
  const surf = sampleSurface(ship, d);
  // украшения мастерской (все): их места считаются как в хабе и тоже идут в avoid поломок
  const plan = planSpots(surf, avoid, d, [stand, ...Object.values(d.stations)]);
  if (q.get('decor') !== '0') { decor = createDecor(ship, d, plan, findMasts(ship, d)); decor.set(ITEMS.filter(i => i.slot !== 'pet').map(i => i.id)); }
  const decorAvoid = decorCircles(plan);
  damage = createDamage(ship, d, { quality, km, avoid: q.get('avoiddecor') === '0' ? avoid : [...avoid, ...decorAvoid], surf });
  (window as any).__d = damage; (window as any).__deck = d; (window as any).__avoid = avoid; (window as any).__avoidAll = q.get('avoiddecor') === '0' ? avoid : [...avoid, ...decorAvoid];
  damage.set(+(q.get('damage') || 0));
  addEventListener('resize', resize);
  setView(viewMode); (window as any).__step(3);
  const fx = q.get('fix'); if (fx) setTimeout(() => { damage.fix(fx === 'last' ? undefined : +fx); }, +(q.get('wait') || 1500));
  if (!freeze) { let last = performance.now(); const loop = () => { const n = performance.now(); frame(Math.min(0.1, (n - last) / 1000)); last = n; requestAnimationFrame(loop); }; loop(); }
  document.getElementById('t')!.textContent = `поломки: ${q.get('damage') || 0} · ${quality} · km ${km}`;
  (window as any).__ready = true;
})().catch(e => { document.body.append('Ошибка: ' + e); console.error(e); });
