// Проверка украшений корабля и генерация иконок (только для разработки).
//   decor.html?kit=<набор>&names=a,b,c   — модели набора сеткой с подписями (names пусто — все);
//   decor.html?sheet=items               — все предметы каталога (content/ship_items.mjs) сеткой;
//   decor.html?icon=<id>                 — один предмет на прозрачном фоне 256×256: скриншот с omitBackground = иконка (scripts/ship-icons.mjs).
import * as THREE from 'three';
import { Kit } from '../three/assets';
import { loadDecorModel, meshBox, ITEMS, type Loaded } from '../three/decor3d';

const q = new URLSearchParams(location.search);
const icon = q.get('icon');
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(icon ? 1 : Math.min(devicePixelRatio, 2)); renderer.setSize(icon ? 256 : innerWidth, icon ? 256 : innerHeight);
renderer.setClearColor(0x000000, 0); document.body.appendChild(renderer.domElement);
if (icon) { document.documentElement.style.background = document.body.style.background = 'transparent'; renderer.domElement.style.cssText = 'position:fixed;left:0;top:0;width:256px;height:256px'; }

const scene = new THREE.Scene();
scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x7a6a8a, 2.0));
const sun = new THREE.DirectionalLight(0xfff6ea, 2.4); sun.position.set(-5, 9, 7); scene.add(sun);

/** Поставить камеру по габаритам модели: смотрим сверху-сбоку, вписываем в кадр с запасом. */
function frame(cam: THREE.PerspectiveCamera, o: THREE.Object3D, view = new THREE.Vector3(0.55, 0.5, 0.85)) {
  const b = meshBox(o), c = b.getCenter(new THREE.Vector3()), r = b.getSize(new THREE.Vector3()).length() / 2;
  const d = r / Math.sin(THREE.MathUtils.degToRad(cam.fov / 2)) * 1.05, dir = view.clone().normalize();
  cam.position.copy(c).addScaledVector(dir, d); cam.lookAt(c); cam.updateProjectionMatrix();
}

(async () => {
  const items: { label: string; make: () => Promise<Loaded> }[] = [];
  if (q.get('kit')) {
    const kit = await Kit.load(q.get('kit')!), names = (q.get('names') || '').split(',').filter(Boolean);
    for (const n of names.length ? names : kit.names()) items.push({ label: n, make: async () => ({ o: kit.get(n, { height: 1.5, ground: true }) }) });
  } else {
    const list = icon ? ITEMS.filter(i => i.id === icon) : ITEMS;
    for (const it of list) items.push({ label: it.id, make: () => loadDecorModel(it) });
  }
  const cols = icon ? 1 : Math.ceil(Math.sqrt(items.length * innerWidth / innerHeight)), rows = Math.ceil(items.length / cols);
  const W = renderer.domElement.clientWidth / cols, H = renderer.domElement.clientHeight / rows;
  const cam = new THREE.PerspectiveCamera(30, W / H, 0.1, 200);
  renderer.setScissorTest(true);
  for (let i = 0; i < items.length; i++) {
    const g = new THREE.Group(), m = await items[i].make(); g.add(m.o); scene.add(g);
    m.actor?.update(+(q.get('t') || 0.3));                                   // питомец: поза стойки чуть после начала цикла
    frame(cam, g, items[i].label === 'banner_star' ? new THREE.Vector3(-0.6, 0.25, 0.75) : items[i].label === 'string_lights' ? new THREE.Vector3(0, 0.15, 1) : undefined);   // полотнище знамени смотрит на корму
    const x = (i % cols) * W, y = renderer.domElement.clientHeight - (Math.floor(i / cols) + 1) * H;
    renderer.setViewport(x, y, W, H); renderer.setScissor(x, y, W, H); renderer.render(scene, cam); scene.remove(g);
    if (!icon) { const d = document.createElement('div'); d.textContent = items[i].label; d.style.left = x + 4 + 'px'; d.style.top = Math.floor(i / cols) * H + 2 + 'px'; document.getElementById('l')!.appendChild(d); }
  }
  (window as any).__ready = true;
})().catch(e => { document.body.append('Ошибка: ' + e); console.error(e); });
