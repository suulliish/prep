// Портреты костюмов и иконки наград за звёзды (только для разработки), генерация: scripts/assets/hero-icons.mjs.
//   heroicon.html?hero=<id костюма>   — герой в 3/4, стойка Idle, 256×320, прозрачный фон;
//   heroicon.html?reward=<id награды> — плащ (герой со спины) или след меча (дуга света), 256×256, прозрачный фон;
//   heroicon.html?sheet=heroes|rewards — всё сразу сеткой (проверка глазами: одинаковый масштаб, ничего не обрезано).
// Один масштаб у всех: камера на фиксированном расстоянии, смотрит в центр габаритов (видимых частей: скрытая шляпа не считается).
import * as THREE from 'three';
import { createHero, dress, items } from '../three/actor';
import { LOOKS, DEFAULT_LOOK, type HeroLook } from '../three/looks';
// @ts-ignore
import { STAR_REWARDS } from '../../content/worlds.mjs';

const q = new URLSearchParams(location.search);
const one = q.get('hero') ?? q.get('reward'), sheet = q.get('sheet');
const CELL = one ? (q.get('hero') ? [256, 320] : [256, 256]) : sheet === 'heroes' ? [256, 320] : [256, 256];
const ids = one ? [one] : sheet === 'heroes' ? Object.keys(LOOKS) : (STAR_REWARDS as { id: string }[]).map(r => r.id);
const cols = one ? 1 : 4, rows = Math.ceil(ids.length / cols);
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(one ? devicePixelRatio : 1); renderer.setSize(CELL[0] * cols, CELL[1] * rows); renderer.setClearColor(0x000000, 0);
document.documentElement.style.background = document.body.style.background = one ? 'transparent' : '#2a2360';
renderer.domElement.style.cssText = `position:fixed;left:0;top:0;width:${CELL[0] * cols}px;height:${CELL[1] * rows}px`; document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x7a6a8a, 2.0));
const sun = new THREE.DirectionalLight(0xfff6ea, 2.4); sun.position.set(-4, 7, 8); scene.add(sun);
const rim = new THREE.DirectionalLight(0xbfd4ff, 1.0); rim.position.set(5, 3, -4); scene.add(rim);

/** Габариты по мешам без контуров, с учётом позы (скиннинг). */
function box(o: THREE.Object3D) {
  const b = new THREE.Box3(); o.updateMatrixWorld(true);
  o.traverse(n => { const m = n as THREE.Mesh; if (m.isMesh && !m.userData.outline && m.visible) b.union(new THREE.Box3().setFromObject(m, true)); });
  return b;
}
async function hero(look: HeroLook, capeOn: { color: number; glow: boolean } | null, back: boolean) {
  const a = await createHero(look.kind); await dress(a, { weapon: look.weapon, offhand: look.offhand, hide: look.hide });
  if (look.tint) a.tint(look.tint, look.glow); a.setCape(capeOn);
  a.loop('Idle_A', 0); a.update(+(q.get('t') ?? 0.6));
  a.g.rotation.y = back ? Math.PI + 0.9 : +(q.get('rot') ?? -0.6);
  return a.g;
}

/** След меча: дуга кубиков, как в бою (arena.trailStep), меч на её конце, вокруг мягкое сияние. */
async function slash(colors: number[]) {
  const g = new THREE.Group(), kit = await items();
  const sword = kit.get('sword_1handed', { outline: 0.01 }); const R = 1.9, a1 = 0.7, span = 2.2;   // угол клинка и начало дуги, радианы
  sword.scale.setScalar(R / 1.41);   // кончик клинка (y=1.41 в модели, рукоять в нуле) достаёт до дуги
  sword.rotation.z = a1 - Math.PI / 2; sword.position.set(0, 0, 0); g.add(sword);
  const N = 15, cube = new THREE.BoxGeometry(1, 1, 1);
  for (let i = 0; i < N; i++) {
    const u = i / (N - 1), ang = a1 + 0.16 + span * u, c = new THREE.Color(colors[i % colors.length]);
    const s = 0.34 * (1 - 0.7 * u);
    const m = new THREE.Mesh(cube, new THREE.MeshBasicMaterial({ color: c, toneMapped: false })); m.scale.setScalar(s);
    m.position.set(Math.cos(ang) * R * 0.98, Math.sin(ang) * R * 0.98, 0); m.rotation.set(u * 2, u * 3, u); g.add(m);
    const h = new THREE.Mesh(cube, new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.22 * (1 - 0.6 * u), depthWrite: false, toneMapped: false })); h.scale.setScalar(s * 1.9); h.position.copy(m.position); h.rotation.copy(m.rotation); g.add(h);
  }
  return g;
}

const FIT = +(q.get('fit') ?? 1.0);   // общий запас кадра
async function make(id: string): Promise<{ o: THREE.Object3D; dist: number; cy?: number }> {
  const r = (STAR_REWARDS as { id: string; kind: string; color: number; glow?: boolean; rainbow?: boolean }[]).find(x => x.id === id);
  if (r?.kind === 'cape') return { o: await hero({ ...DEFAULT_LOOK, offhand: undefined }, { color: r.color, glow: !!r.glow }, true), dist: 6, cy: 1.0 };
  if (r?.kind === 'trail') return { o: await slash(r.rainbow ? [0xff4fb8, 0xffcb2e, 0x3ddc6e, 0x35e6ff, 0xa77bff] : [r.color]), dist: 0 };
  return { o: await hero(LOOKS[id], null, false), dist: 7.0 };
}

(async () => {
  renderer.setScissorTest(true);
  for (let i = 0; i < ids.length; i++) {
    let { o, dist, cy } = await make(ids[i]); scene.add(o);
    const b = box(o), c = b.getCenter(new THREE.Vector3());
    if (cy) c.y = cy;   // плащ: кадр ниже, на спине и плаще, а не на голове
    if (!dist) dist = b.getSize(new THREE.Vector3()).length() / 2 / Math.sin(THREE.MathUtils.degToRad(13)) * 1.08;   // след: вписать дугу и меч по габаритам
    const cam = new THREE.PerspectiveCamera(26, CELL[0] / CELL[1], 0.1, 100);
    const dir = new THREE.Vector3(0.0, 0.16, 1).normalize(), d = dist * FIT;
    cam.position.copy(c).addScaledVector(dir, d); cam.lookAt(c);
    const x = (i % cols) * CELL[0], y = (rows - 1 - Math.floor(i / cols)) * CELL[1];
    renderer.setViewport(x, y, CELL[0], CELL[1]); renderer.setScissor(x, y, CELL[0], CELL[1]); renderer.render(scene, cam); scene.remove(o);
    if (!one) { const t = document.createElement('div'); t.textContent = ids[i]; t.style.cssText = `position:fixed;left:${x + 4}px;top:${Math.floor(i / cols) * CELL[1] + 2}px;font:600 11px system-ui;color:#fff;text-shadow:0 1px 2px #000`; document.body.appendChild(t); }
  }
  (window as any).__ready = true;
})().catch(e => { document.body.append('Ошибка: ' + e); console.error(e); });
