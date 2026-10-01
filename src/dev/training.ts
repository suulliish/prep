// Проверка тренировочной площадки без входа и экранов (только для разработки): training.html?q=high|low&km=1|0.3&world=0&layout=0&hero=cyan&show=1&btn=1
// Кнопки внизу — по одной на каждое действие модуля; в консоли: __t (модуль), await __t.hit('light'), __t.board('Название'), __step(n, dt) — кадры вручную (&freeze=1).
import * as THREE from 'three';
import { createTraining } from '../three/training3d';
import { createVfx } from '../three/vfx';
import { loadIslandKits, buildIsland } from '../three/island3d';
import { createHero, dress } from '../three/actor';
import { LOOKS } from '../three/looks';
import { spotIndex } from '../three/spots';
import { HERO_X, Z0 } from '../three/attacks';
// @ts-ignore — модуль .mjs без типов
import { WORLDS } from '../../content/worlds.mjs';

const q = new URLSearchParams(location.search);
const quality = (q.get('q') as 'high' | 'low') || 'high', km = +(q.get('km') ?? 1), high = quality === 'high';
const canvas = document.getElementById('c') as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: high });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.shadowMap.enabled = high; renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.NeutralToneMapping; renderer.toneMappingExposure = 1.05;
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x352f86); scene.fog = new THREE.Fog(0x352f86, 34, 95);
const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 400);
scene.add(new THREE.HemisphereLight(0xb4c4ff, 0x40214a, 1.5));
const sun = new THREE.DirectionalLight(0xffe6c8, 2.3); sun.position.set(-8, 16, 10); scene.add(sun);
if (high) { sun.castShadow = true; sun.shadow.mapSize.set(1536, 1536); sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.03; Object.assign(sun.shadow.camera, { left: -13, right: 13, top: 13, bottom: -13, near: 1, far: 60 }); }
const vfx = createVfx(scene, camera, { km, high });
const worldK = +(q.get('world') || 0), W = WORLDS[worldK];
const want = q.get('layout') ?? '0'; let seed = 'seed'; for (let i = 0; i < 500; i++) { const c = 'k' + i; if (spotIndex(c) === +want) { seed = c; break; } }
const info = document.getElementById('t')!;

let hero: Awaited<ReturnType<typeof createHero>> | null = null;
const tr = createTraining(scene, { quality, km, vfx, hero: () => new THREE.Vector3(HERO_X, 0, Z0), onSlap: () => { hero?.play('Hit_A'); } });
(window as any).__t = tr; (window as any).__vfx = vfx; (window as any).__scene = scene; (window as any).__renderer = renderer; (window as any).__camera = camera; (window as any).__THREE = THREE;

const freeze = q.get('freeze') === '1';
let w = 1, h = 1, tt = 0;
function resize() {
  w = innerWidth; h = innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); frame();
}
// камера боя (как в arena.ts): по ширине и высоте окна, цель — центр между бойцами
function frame() {
  const tanH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)), dist = Math.max(10, 5.4 / (tanH * camera.aspect), 4.8 / (2 * tanH));
  camera.position.set(0.1, 1.4 + dist * 0.28, dist); camera.lookAt(0.1, 1.4, 0);
  vfx.setScale(Math.min(1.5, Math.max(1, 60 / (h / (2 * tanH * dist)))));
}
addEventListener('resize', resize); resize();
function step(dt: number) { tt += dt; tr.update(dt, tt); vfx.update(dt); hero?.update(dt); }
function draw() { renderer.render(scene, camera); }
(window as any).__step = (n = 1, dt = 1 / 30) => { for (let i = 0; i < n; i++) step(dt); draw(); };
(window as any).__draw = draw;
(window as any).__stats = () => ({ calls: renderer.info.render.calls, tris: renderer.info.render.triangles, geos: renderer.info.memory.geometries, texs: renderer.info.memory.textures, mine: tr.drawCalls(), ...tr.stats() });

(async () => {
  const kits = await loadIslandKits(worldK);
  scene.add(buildIsland(kits, worldK, new THREE.Color(W.isle[0]).getHex(), spotIndex(seed)));
  const look = LOOKS[q.get('hero') || 'cyan'] ?? LOOKS.cyan;
  hero = await createHero(look.kind); await dress(hero, { weapon: look.weapon, offhand: look.offhand, hide: look.hide });
  if (look.tint) hero.tint(look.tint, look.glow);
  hero.g.position.set(HERO_X, 0, Z0); hero.g.rotation.y = Math.PI / 2; scene.add(hero.g);
  info.textContent = `${W.ru} · ${quality} · km ${km}`;
  if (q.get('show') !== '0') { if (freeze) { tr.show(true); } else tr.show(true); }
  (window as any).__ready = true;
})();

// кнопки: по одной на действие
const acts: [string, () => unknown][] = [
  ['показать', () => tr.show(true)], ['убрать', () => tr.show(false)],
  ['лёгкий', () => tr.hit('light')], ['сильный', () => tr.hit('strong')], ['связка 1', () => tr.hit('combo', 1)], ['связка 2', () => tr.hit('combo', 2)], ['связка 3', () => tr.hit('combo', 3)],
  ['бонк', () => tr.bonk()], ['глитч вкл', () => tr.glitch(true)], ['нашёл ошибку', () => tr.breakGlitch()], ['глитч выкл', () => tr.glitch(false)],
  ['мишени 3', () => tr.targets(3)], ['мишени 5', () => tr.targets(5)], ['попал', () => tr.targetHit()], ['промах', () => tr.targetMiss()],
  ['доска', () => tr.board('Тең бөліну: ортақ көбейткіш')], ['доска: стереть', () => tr.board('')], ['ура', () => tr.cheer()],
];
const bar = document.getElementById('b')!;
for (const [n, f] of acts) { const b = document.createElement('button'); b.textContent = n; b.onclick = () => f(); bar.appendChild(b); }
if (q.get('btn') === '0') document.body.classList.add('nobtn');
if (!freeze) {
  let last = performance.now();
  const loop = (now: number) => { requestAnimationFrame(loop); const dt = (now - last) / 1000; last = now; step(dt); draw(); };
  requestAnimationFrame(loop);
}
