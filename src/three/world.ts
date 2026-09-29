// 3D-мир «Жарық»: летающий корабль-хаб, Кодер, дрон Бит, портал, глитч-мобы.
// Всё собрано из блоков кодом (Three.js). Режимы камеры: hub (общий вид), battle (бой на палубе), portal.
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { makeHero, makeBit, makeMob as buildMob, addShipDetails, waveFlag } from './characters';
import { createMap, type MapIsle, type MapLabel } from './map';
import { createArena } from './arena';
import { equip, animateGear, GEAR, type Equipped } from './gear';

export type CamMode = 'hub' | 'battle' | 'portal' | 'map' | 'hero';
export type BitMood = 'idle' | 'happy' | 'wow' | 'think' | 'sad';

export interface World {
  setEnergy(v: number, max: number): void;
  setMode(m: CamMode): void;
  heroWalk(x: number, z: number): Promise<void>;
  /** Удар героя в бою; sup — суперудар. Возвращает, повержен ли враг. */
  heroAttack(crit?: boolean, sup?: boolean): Promise<boolean>;
  spawnMob(hp: number, kind?: number, boss?: boolean): Promise<void>;
  /** Ход врага при ошибке: снаряд и щит героя (урона нет). */
  enemyAttack(): Promise<void>;
  /** Герой выходит из портала в локацию. */
  arrive(): Promise<void>;
  /** Тема боевой локации: номер мира, цвета острова. */
  setArena(k: number, a: string, b: string): void;
  /** Уголок мира для темы боя (src/three/spots.ts), возвращает номер варианта. */
  setSpot(seed: string): number;
  /** Катсцена на корабле: герой идёт в портал. */
  portalWalk(): Promise<void>;
  hitMob(crit?: boolean): void;
  killMob(): Promise<void>;
  clearMob(): void;
  openChest(): Promise<void>;
  bitMood(m: BitMood): void;
  celebrate(color?: number): void;
  openPortal(): void;
  /** Мир: цвета неба [верх, середина, низ, сияние] (RGB 0..1) и тумана — плавный переход. */
  setTheme(sky: number[][], fog: number): void;
  /** Костюм героя (путь наград). */
  setOutfit(jacket: number, dark: number, visor: number, id?: string): void;
  /** Награды за звёзды: цвет плаща поверх костюма и цвета следа от оружия. null — нет. */
  setStyle(cape: { color: number; glow: boolean } | null, trail: number[] | null): void;
  /** 3D-карта миров (режим 'map'): острова, текущий мир, выбор касанием, перелёт корабля с героем. */
  mapSetup(isles: MapIsle[], current: number): void;
  mapFocus(i: number): void;
  mapTravel(i: number): Promise<void>;
  onMapPick(cb: (i: number) => void): void;
  mapLabels(): MapLabel[];
  /** Мир, к которому сейчас пролистана карта. */
  mapFocused(): number;
  /** Окно сцены в каркасе экрана (доли высоты): камера центрирует цель в этом окне. */
  setFrame(top: number, height: number): void;
  resize(): void;
  dispose(): void;
}

const Q = () => {
  const cores = navigator.hardwareConcurrency || 4;
  const mobile = /Android|iPhone|iPad/i.test(navigator.userAgent);
  return cores >= 6 && !mobile ? 'high' : 'low';
};

export function createWorld(canvas: HTMLCanvasElement, opts: { quality?: 'high' | 'low'; reduceMotion?: boolean } = {}): World {
  const quality = opts.quality ?? Q();
  const km = opts.reduceMotion ? 0.3 : 1;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: quality === 'high', powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, quality === 'high' ? 1.75 : 1.25));
  renderer.shadowMap.enabled = quality === 'high';
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x17104a, 34, 95);
  const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 300);

  // ---------- Небо, звёзды, разломы ----------
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false, uniforms: { t: { value: 0 }, cTop: { value: new THREE.Vector3(.03, .04, .13) }, cMid: { value: new THREE.Vector3(.17, .08, .36) }, cLow: { value: new THREE.Vector3(.62, .22, .47) }, cAur: { value: new THREE.Vector3(.05, .35, .4) } },
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: `uniform float t; uniform vec3 cTop, cMid, cLow, cAur; varying vec3 vP; void main(){ vec3 n = normalize(vP); float h = n.y;
      vec3 top = cTop, mid = cMid, low = cLow;
      vec3 c = mix(mid, top, smoothstep(.02,.75,h)); c = mix(low, c, smoothstep(-.35,.06,h));
      float aur = smoothstep(.2,.9, sin(n.x*6. + t*.15) * .5 + .5) * smoothstep(.15,.55,h) * (1.-smoothstep(.55,.9,h));
      c += cAur * aur * .35; gl_FragColor = vec4(c,1.); }`,
  });
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(150, 32, 16), skyMat));

  const starGeo = new THREE.BufferGeometry();
  { const n = 900, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { const th = Math.random() * 6.283, ph = Math.random() * 1.25; const r = 130;
      pos[i * 3] = r * Math.sin(ph) * Math.cos(th); pos[i * 3 + 1] = r * Math.cos(ph) - 8; pos[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th); }
    starGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); }
  const starMat = new THREE.PointsMaterial({ color: 0xd8e0ff, size: 0.55, fog: false, transparent: true });
  scene.add(new THREE.Points(starGeo, starMat));

  // трещины-разломы Глитча в небе
  const rifts: THREE.Mesh[] = [];
  for (let i = 0; i < 4; i++) {
    const g = new THREE.PlaneGeometry(0.6, 9 + i * 2);
    const m = new THREE.MeshBasicMaterial({ color: i % 2 ? 0xff4fb8 : 0x9d5cff, transparent: true, opacity: 0.8, fog: false, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(g, m);
    const a = i * 1.7 + 0.6;
    mesh.position.set(Math.cos(a) * 80, 18 + i * 6, Math.sin(a) * 80);
    mesh.lookAt(0, 20, 0); mesh.rotation.z = 0.3 + i * 0.4;
    scene.add(mesh); rifts.push(mesh);
  }

  // ---------- Свет ----------
  scene.add(new THREE.HemisphereLight(0x9fb4ff, 0x40214a, 0.9));
  const sun = new THREE.DirectionalLight(0xffe0c0, 1.6);
  sun.position.set(-14, 26, 12); sun.castShadow = quality === 'high';
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -15, right: 15, top: 15, bottom: -15, near: 1, far: 70 });
  scene.add(sun);

  // ---------- Блоки ----------
  const box = new THREE.BoxGeometry(1, 1, 1);
  const mats = new Map<string, THREE.MeshStandardMaterial>();
  const mat = (color: number, emissive = 0, ei = 1) => {
    const k = `${color}_${emissive}_${ei}`;
    if (!mats.has(k)) mats.set(k, new THREE.MeshStandardMaterial({ color, emissive, emissiveIntensity: ei, roughness: 0.85, metalness: 0.05, flatShading: true }));
    return mats.get(k)!;
  };
  function block(p: THREE.Object3D, sx: number, sy: number, sz: number, x: number, y: number, z: number, color: number, emissive = 0, ei = 1) {
    const m = new THREE.Mesh(box, mat(color, emissive, ei));
    m.scale.set(sx, sy, sz); m.position.set(x, y, z); m.castShadow = m.receiveShadow = quality === 'high';
    p.add(m); return m;
  }

  // ---------- Корабль ----------
  const ship = new THREE.Group(); scene.add(ship);
  for (let i = -6; i < 6; i++) block(ship, 1, 0.3, 6.4, i + 0.5, 0, 0, i % 2 ? 0xb07645 : 0xa0673a);
  block(ship, 12.4, 0.7, 0.3, 0, 0.45, 3.35, 0x7c4a28); block(ship, 12.4, 0.7, 0.3, 0, 0.45, -3.35, 0x7c4a28);
  block(ship, 0.3, 0.7, 7, -6.2, 0.45, 0, 0x7c4a28);
  [[11.6, 6.0, -0.6], [10.2, 5.0, -1.2], [8.2, 3.8, -1.8], [5.6, 2.4, -2.4]].forEach(([w, d, y], i) => block(ship, w, 0.6, d, -0.3 * i, y, 0, i % 2 ? 0x6b3f22 : 0x74462a));
  block(ship, 1.2, 0.9, 4, 6.4, -0.2, 0, 0x74462a); block(ship, 1, 0.7, 2.4, 7.3, -0.3, 0, 0x6b3f22);
  block(ship, 0.8, 0.5, 1, 8.1, -0.25, 0, 0xffc94a, 0xffa000, 0.6);
  // фонари на бортах
  const lanterns: THREE.PointLight[] = [];
  [[-4.5, 3.35], [0, 3.35], [4, 3.35], [-4.5, -3.35], [0, -3.35], [4, -3.35]].forEach(([x, z]) => {
    block(ship, 0.25, 0.9, 0.25, x, 1.1, z, 0x3a2a1d);
    block(ship, 0.35, 0.35, 0.35, x, 1.7, z, 0xffd27a, 0xffb020, 2.2);
    if (quality === 'high' && z > 0) { const l = new THREE.PointLight(0xffb84a, 1.4, 5); l.position.set(x, 1.8, z); ship.add(l); lanterns.push(l); }
  });
  // мачта и парус
  block(ship, 0.4, 5.5, 0.4, -1.5, 2.9, -2.2, 0x5a3519);
  const sail = new THREE.Group(); sail.position.set(-1.5, 3.6, -2.0); ship.add(sail);
  const sailCells: { b: THREE.Mesh; c: number; r: number }[] = [];
  for (let r = 0; r < 4; r++) for (let c = 0; c < 5; c++) sailCells.push({ b: block(sail, 0.8, 0.8, 0.12, (c - 2) * 0.8, (r - 1.5) * 0.8, 0, (r + c) % 2 ? 0xf0e6d8 : 0xe2d3c0), c, r });
  // голо-консоль на палубе
  const consoleG = new THREE.Group(); consoleG.position.set(-4.3, 0.15, -1.8); ship.add(consoleG);
  block(consoleG, 1.2, 0.9, 0.7, 0, 0.45, 0, 0x2b3266);
  const holo = block(consoleG, 1.1, 0.7, 0.05, 0, 1.45, 0.1, 0x3ff0ff, 0x3ff0ff, 1.6);
  (holo.material as THREE.MeshStandardMaterial) = new THREE.MeshStandardMaterial({ color: 0x3ff0ff, emissive: 0x3ff0ff, emissiveIntensity: 1.4, transparent: true, opacity: 0.55 });
  // двигатели
  const props: THREE.Group[] = [];
  const exhaust: THREE.Mesh[] = [];
  [-2.2, 2.2].forEach(z => {
    block(ship, 1.4, 1.1, 1.1, -6.9, -0.3, z, 0x4a4f6e);
    exhaust.push(block(ship, 0.3, 0.7, 0.7, -7.7, -0.3, z, 0xff8a3d, 0xff5a00, 2.5));
    const p = new THREE.Group(); p.position.set(-7.95, -0.3, z); ship.add(p);
    block(p, 0.15, 2.2, 0.35, 0, 0, 0, 0xd0d5ea); block(p, 0.15, 0.35, 2.2, 0, 0, 0, 0xd0d5ea);
    props.push(p);
  });
  // воздушный шар
  {
    const pts: [number, number, number][] = [], s = 0.5, rx = 5.4, ry = 1.9, rz = 2.2;
    for (let i = -11; i <= 11; i++) for (let j = -4; j <= 4; j++) for (let l = -5; l <= 5; l++) {
      const x = i * s, y = j * s, z = l * s;
      const v = x * x / (rx * rx) + y * y / (ry * ry) + z * z / (rz * rz);
      const vin = x * x / ((rx - s) ** 2) + y * y / ((ry - s) ** 2) + z * z / ((rz - s) ** 2);
      if (v <= 1 && vin > 1) pts.push([x, y, z]);
    }
    const im = new THREE.InstancedMesh(box, new THREE.MeshStandardMaterial({ roughness: 0.7, flatShading: true }), pts.length);
    const m4 = new THREE.Matrix4(), col = new THREE.Color();
    pts.forEach(([x, y, z], i) => { m4.makeScale(s, s, s).setPosition(x, y + 7.2, z); im.setMatrixAt(i, m4); col.set(Math.floor((x + rx) / 1.65) % 2 ? 0x4a5fd0 : 0x5ff4ff); im.setColorAt(i, col); });
    im.castShadow = quality === 'high'; ship.add(im);
    [[-4, -1.8], [-4, 1.8], [3.5, -1.8], [3.5, 1.8]].forEach(([x, z]) => block(ship, 0.08, 4.8, 0.08, x, 2.8, z, 0x3a2a1d));
  }

  // ---------- Портал ----------
  const portal = new THREE.Group(); portal.position.set(4.6, 0.15, 0); ship.add(portal);
  const frameMat = [0x2a1b4d, 0x16082e] as const;
  for (let y = 0; y < 6; y++) { block(portal, 0.6, 0.6, 0.6, 0, 0.3 + y * 0.6, -1.5, frameMat[0], 0x5a2bb0, 0.5); block(portal, 0.6, 0.6, 0.6, 0, 0.3 + y * 0.6, 1.5, frameMat[0], 0x5a2bb0, 0.5); }
  for (let z = -1.5; z <= 1.51; z += 0.6) block(portal, 0.6, 0.6, 0.6, 0, 3.9, z, frameMat[0], 0x5a2bb0, 0.5);
  const portalMat = new THREE.ShaderMaterial({
    transparent: true, side: THREE.DoubleSide, depthWrite: false, uniforms: { t: { value: 0 }, power: { value: 0.3 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: `uniform float t; uniform float power; varying vec2 vUv;
      void main(){ vec2 p = vUv - .5; p.y *= 1.25; float r = length(p); float a = atan(p.y, p.x);
        float sw = sin(a*3. + r*18. - t*3.)*.5+.5; vec3 c = mix(vec3(1.,.31,.72), vec3(.25,.94,1.), sw);
        float core = smoothstep(.5,0.,r); gl_FragColor = vec4(c*(1.+power*1.5) + core*power, (.3+.65*power)*core); }`,
  });
  const portalPlane = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 3.4), portalMat);
  portalPlane.rotation.y = Math.PI / 2; portalPlane.position.set(0, 2.05, 0); portal.add(portalPlane);
  const portalLight = new THREE.PointLight(0x7bf6ff, 2, 10); portalLight.position.set(-0.8, 2, 0); portal.add(portalLight);
  const pCount = 180, pPos = new Float32Array(pCount * 3), pSeed = Array.from({ length: pCount }, () => ({ a: Math.random() * 6.28, r: 0.3 + Math.random() * 1.3, s: 0.5 + Math.random() }));
  const pGeo = new THREE.BufferGeometry(); pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  const pMat = new THREE.PointsMaterial({ color: 0x9ffcff, size: 0.13, transparent: true, opacity: 0.8, depthWrite: false });
  portal.add(new THREE.Points(pGeo, pMat));
  let energy = 0.3, portalOpen = false, flash = 0;

  // ---------- Сундук ----------
  const chest = new THREE.Group(); chest.position.set(-2.8, 0.15, 2.0); chest.visible = false; ship.add(chest);
  block(chest, 1.1, 0.7, 0.8, 0, 0.35, 0, 0x8a5a2b); block(chest, 1.14, 0.1, 0.84, 0, 0.55, 0, 0xffc94a, 0xffa000, 0.4);
  const lid = new THREE.Group(); lid.position.set(0, 0.7, -0.4); chest.add(lid);
  block(lid, 1.1, 0.35, 0.8, 0, 0.17, 0.4, 0x9c6632); block(lid, 0.2, 0.25, 0.1, 0, 0.05, 0.82, 0xffc94a, 0xffa000, 1);
  let chestOpen = false;

  // ---------- Герой ----------
  const hero = makeHero();
  // материалы костюма: по исходным цветам куртки и визора
  const outfitMats = { jacket: [] as THREE.MeshToonMaterial[], dark: [] as THREE.MeshToonMaterial[], visor: [] as THREE.MeshToonMaterial[] };
  // материалы из общего кэша — клонируем, чтобы не перекрасить заодно корабль
  const own = new Map<THREE.Material, THREE.MeshToonMaterial>();
  let outfitNow: [number, number, number] | null = null;
  const dressHero = (root: THREE.Object3D) => root.traverse(o => { const mesh = o as THREE.Mesh, m = mesh.material as THREE.MeshToonMaterial | undefined; if (!m?.color || Array.isArray(m)) return;
    const hx = m.color.getHex(), slot = hx === 0x22b8cc ? 'jacket' : hx === 0x137e8f ? 'dark' : hx === 0x3ff0ff && m.emissive?.getHex() === 0x3ff0ff ? 'visor' : null;
    if (!slot) return;
    if (!own.has(m)) { const c = m.clone(); own.set(m, c); outfitMats[slot].push(c); }
    mesh.material = own.get(m)!; });
  // скины (src/three/gear.ts): у каждого костюма своя экипировка; одеваются все герои — палуба, карта, бой
  type Hero = ReturnType<typeof makeHero>;
  const worn = new Map<Hero, Equipped>();
  let gearNow = GEAR.cyan, colorsNow = { jacket: 0x22b8cc, dark: 0x137e8f, visor: 0x3ff0ff };
  let capeNow: { color: number; glow: boolean } | null = null;
  function wear(h: Hero) { const e = equip(h, capeNow ? { ...gearNow, cape: capeNow.color, capeGlow: capeNow.glow } : gearNow, colorsNow); h.blade = e.blade as typeof h.blade; worn.set(h, e); }
  const dress = (h: Hero) => { dressHero(h.g); if (outfitNow) paintOutfit(...outfitNow); wear(h); };
  dressHero(hero.g); wear(hero);
  function paintOutfit(jacket: number, dark: number, visor: number) {
    outfitMats.jacket.forEach(m => m.color.setHex(jacket)); outfitMats.dark.forEach(m => m.color.setHex(dark));
    outfitMats.visor.forEach(m => { m.color.setHex(visor); m.emissive?.setHex(visor); });
  }
  let themeTo: THREE.Vector3[] | null = null; const fogTo = new THREE.Color(0x17104a);
  hero.g.position.set(-2, 0.15, 0.6); hero.g.rotation.y = Math.PI / 2; ship.add(hero.g);
  const shipAnim = addShipDetails(ship, quality);

  // ---------- Бит: экран-лицо на канвасе ----------
  const faceCanvas = document.createElement('canvas'); faceCanvas.width = 64; faceCanvas.height = 48;
  const faceTex = new THREE.CanvasTexture(faceCanvas); faceTex.magFilter = THREE.NearestFilter;
  let mood: BitMood = 'idle', blinkT = 0;
  function drawFace(blink = false) {
    const c = faceCanvas.getContext('2d')!;
    c.fillStyle = '#0c1036'; c.fillRect(0, 0, 64, 48);
    c.fillStyle = mood === 'sad' ? '#9fb0ff' : '#3ff0ff';
    const eye = (x: number) => {
      if (blink) { c.fillRect(x - 6, 22, 12, 3); return; }
      if (mood === 'happy') { c.fillRect(x - 6, 20, 3, 3); c.fillRect(x - 3, 17, 6, 3); c.fillRect(x + 3, 20, 3, 3); return; }
      if (mood === 'wow') { c.fillRect(x - 6, 12, 12, 16); c.fillStyle = '#0c1036'; c.fillRect(x - 2, 17, 4, 6); c.fillStyle = '#3ff0ff'; return; }
      if (mood === 'think') { c.fillRect(x - 5, 18, 10, 8); c.fillStyle = '#0c1036'; c.fillRect(x - 5, 18, 10, 3); c.fillStyle = '#3ff0ff'; return; }
      if (mood === 'sad') { c.fillRect(x - 5, 20, 10, 8); c.fillRect(x - 6, 17, 4, 3); return; }
      c.fillRect(x - 4, 15, 8, 12);
    };
    eye(20); eye(44);
    if (mood === 'happy' || mood === 'wow') { c.fillStyle = '#ff4fb8'; c.fillRect(8, 30, 6, 3); c.fillRect(50, 30, 6, 3); }
    faceTex.needsUpdate = true;
  }
  drawFace();
  const B = makeBit(faceTex);
  const bit = B.g; scene.add(bit);
  const antenna = B.antenna, bitProp = B.prop;
  bit.position.set(-2, 3, 1.6);

  // ---------- Острова и облака ----------
  const islands: { g: THREE.Group; y: number; ph: number }[] = [];
  function island(cx: number, cy: number, cz: number, R: number, seed: number) {
    const g = new THREE.Group(); g.position.set(cx, cy, cz); scene.add(g);
    const cols: [number, number, number][] = [];
    for (let x = -R; x <= R; x++) for (let z = -R; z <= R; z++) { const d = Math.hypot(x, z); if (d > R + 0.3) continue; cols.push([x, z, Math.max(1, Math.round((R - d) * 1.4 + ((x * 7 + z * 13 + seed) % 3)))]); }
    const total = cols.reduce((s, c) => s + c[2], 0);
    const im = new THREE.InstancedMesh(box, new THREE.MeshStandardMaterial({ roughness: 0.9, flatShading: true }), total);
    const m4 = new THREE.Matrix4(), col = new THREE.Color(); let i = 0;
    cols.forEach(([x, z, dp]) => { for (let k = 0; k < dp; k++) { m4.makeTranslation(x, -k, z); im.setMatrixAt(i, m4); col.set(k === 0 ? ((x + z + seed) % 3 ? 0x4fbf5a : 0x45ad50) : k < 2 ? 0x8a5a36 : 0x6d6a80); im.setColorAt(i++, col); } });
    g.add(im);
    if (R >= 3) { block(g, 0.8, 2.4, 0.8, 0, 1.7, 0, 0x6b4428); block(g, 2.6, 1.1, 2.6, 0, 3.4, 0, 0x2f9e57); block(g, 1.6, 1.1, 1.6, 0, 4.4, 0, 0x37b064); }
    if (seed % 2) { const cr = block(g, 0.6, 1.2, 0.6, 1.5, 1.1, -1, 0xb58cff, 0x8a5cff, 1.6); cr.rotation.y = 0.6; }
    islands.push({ g, y: cy, ph: seed });
  }
  island(-17, -3, -15, 4, 1); island(19, -6, -11, 3, 2); island(-21, 2, 13, 3, 3); island(13, 4, 19, 2, 4); island(29, -1, 6, 4, 5); island(-7, -10, 23, 3, 6);
  const clouds: THREE.Group[] = [];
  for (let i = 0; i < 10; i++) { const c = new THREE.Group(); for (let k = 0; k < 3 + (i % 3); k++) { const b = block(c, 2 + (k % 2), 1, 1.6 + (k % 3) * 0.4, k * 1.3, (k % 2) * 0.4, (k % 3) * 0.5, 0xe8e6ff); b.castShadow = false; } c.position.set(-45 + i * 10, -9 + (i % 4) * 5, -28 + (i * 17) % 56); scene.add(c); clouds.push(c); }

  // ---------- Моб ----------
  let mob: { g: THREE.Group; parts: THREE.Mesh[]; pupil: THREE.Mesh; shards: THREE.Group; hp: number; max: number; hitT: number; dying: number } | null = null;
  function makeMob(kind: number) {
    const m = buildMob(kind);
    m.g.position.set(2.3, 0.15, 0.6); m.g.scale.setScalar(0.01); ship.add(m.g);
    return m;
  }

  // ---------- Частицы ----------
  const bursts: { g: THREE.Group; parts: { m: THREE.Mesh; v: THREE.Vector3 }[]; life: number }[] = [];
  function burst(pos: THREE.Vector3, color: number, n = 40, speed = 4) {
    const g = new THREE.Group(); g.position.copy(pos); scene.add(g);
    const parts = Array.from({ length: n }, () => { const m = new THREE.Mesh(box, mat(color, color, 2)); const s = 0.08 + Math.random() * 0.14; m.scale.setScalar(s); g.add(m); return { m, v: new THREE.Vector3((Math.random() - 0.5) * speed, Math.random() * speed, (Math.random() - 0.5) * speed) }; });
    bursts.push({ g, parts, life: 1.3 });
  }

  // ---------- 3D-карта миров (своя сцена) ----------
  const map = createMap({ skyMat, starGeo, starMat, km, dressHero: dress });
  const arena = createArena({ skyMat, starGeo, starMat, km, dressHero: dress, animHero: (h, t, w) => { const e = worn.get(h); if (e) animateGear(e, t, w); } });

  // ---------- Постобработка ----------
  let composer: EffectComposer | null = null;
  let renderPass: RenderPass | null = null;
  if (quality === 'high') {
    composer = new EffectComposer(renderer);
    renderPass = new RenderPass(scene, camera); composer.addPass(renderPass);
    composer.addPass(new UnrealBloomPass(new THREE.Vector2(512, 512), 0.75, 0.45, 0.55));
    composer.addPass(new OutputPass());
  }

  // ---------- Камера ----------
  const CAM: Record<Exclude<CamMode, 'map'>, { target: THREE.Vector3; radius: number; phi: number; theta: number }> = {
    hub: { target: new THREE.Vector3(0, 2.0, 0), radius: 25, phi: 1.02, theta: 0.9 },
    battle: { target: new THREE.Vector3(0.2, 1.2, 0.6), radius: 11, phi: 1.12, theta: 1.62 },
    portal: { target: new THREE.Vector3(4.6, 2.2, 0), radius: 9, phi: 1.25, theta: 0.15 },
    hero: { target: new THREE.Vector3(-2, 1.9, 0.6), radius: 11, phi: 1.3, theta: 0.55 }, // портрет героя на палубе
  };
  let mode: CamMode = 'hub';
  const cam = { target: CAM.hub.target.clone(), radius: CAM.hub.radius, phi: CAM.hub.phi, theta: CAM.hub.theta };
  let dragging = false, lastX = 0, lastY = 0, idle = 0, userTheta = 0, userPhi = 0, shakeT = 0;
  let downX = 0, downY = 0;
  const onDown = (e: PointerEvent) => { dragging = true; lastX = downX = e.clientX; lastY = downY = e.clientY; };
  const onMove = (e: PointerEvent) => { if (!dragging) return; if (mode === 'battle') return; if (mode === 'map') { map.drag(e.clientX - lastX, e.clientY - lastY); lastX = e.clientX; lastY = e.clientY; return; } userTheta -= (e.clientX - lastX) * 0.006; userPhi = Math.max(-0.5, Math.min(0.35, userPhi - (e.clientY - lastY) * 0.004)); lastX = e.clientX; lastY = e.clientY; idle = 0; };
  const onUp = (e: PointerEvent) => {
    if (dragging && mode === 'map' && Math.hypot(e.clientX - downX, e.clientY - downY) < 8) {
      const r = canvas.getBoundingClientRect(); map.click(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    }
    // касание палубы в главном меню — герой идёт туда (просьба ребёнка 30.09)
    if (dragging && mode === 'hub' && Math.hypot(e.clientX - downX, e.clientY - downY) < 8) tapWalk(e);
    dragging = false;
  };
  const tapRay = new THREE.Raycaster(), tapPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), tapHit = new THREE.Vector3();
  function tapWalk(e: PointerEvent) {
    const r = canvas.getBoundingClientRect();
    tapRay.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
    tapPlane.constant = -(ship.position.y + 0.15);
    if (!tapRay.ray.intersectPlane(tapPlane, tapHit)) return;
    const p = ship.worldToLocal(tapHit.clone());
    if (Math.abs(p.x) > 7 || Math.abs(p.z) > 4) return;                   // мимо корабля
    const x = Math.max(-4.8, Math.min(4.0, p.x)), z = Math.max(-2.4, Math.min(2.4, p.z));
    nextWander = Infinity;                                               // сам не уходит, пока идёт по касанию
    burst(ship.localToWorld(new THREE.Vector3(x, 0.3, z)), 0x3ff0ff, 14, 2);
    walk = { x, z, res: () => { nextWander = clock.elapsedTime + 10; celebrateT = 0.4; } };
  }
  const onWheel = (e: WheelEvent) => { if (mode === 'map') { e.preventDefault(); map.wheel(e.deltaY); } };
  canvas.addEventListener('wheel', onWheel, { passive: false });
  canvas.addEventListener('pointerdown', onDown); window.addEventListener('pointermove', onMove); window.addEventListener('pointerup', onUp);

  // ---------- Анимации героя ----------
  let walk: { x: number; z: number; res: () => void } | null = null;
  const STATIONS: [number, number][] = [[-4.2, 1.2], [-2, 0.6], [0.4, -1.2], [2.4, 1.4], [-0.6, 1.9], [3.2, -0.8]];
  let nextWander = 4;
  let attack: { t: number; crit: boolean; res: () => void } | null = null;
  let celebrateT = 0;

  function resize() {
    const w = canvas.clientWidth || innerWidth, h = canvas.clientHeight || innerHeight;
    renderer.setSize(w, h, false); composer?.setSize(w, h);
    camera.aspect = w / h; camera.updateProjectionMatrix(); map.resize(w, h); arena.resize(w, h);
    const narrow = w / h < 0.8;
    const side = isSide(w, h);
    CAM.hub.radius = narrow ? 30 : side ? 23 : 25; CAM.battle.radius = narrow ? 23 : side ? 14 : 13; CAM.hero.radius = narrow ? 10.5 : 8.5;   // целиком, со шлемом и оружием (скины)
    applyOffset();
  }
  // Раскладка экрана (та же, что в app.css): на широком экране панель справа — сцена сдвигается влево;
  // на узком панель снизу — сцена поднимается вверх.
  const isSide = (w: number, h: number) => w >= 1000 && w / h >= 1.15;
  let viewShift = (canvas.clientWidth || innerWidth) / (canvas.clientHeight || innerHeight) < 0.8 ? 0.2 : 0.08;
  const frameWin = { top: 0, h: 1 };
  function applyOffset() {
    const w = canvas.clientWidth || innerWidth, h = canvas.clientHeight || innerHeight;
    if (isSide(w, h)) camera.setViewOffset(w, h, (Math.min(540, w * 0.42) + 24) / 2, h * (mode === 'hub' ? 0.02 : 0.04), w, h);
    else if (frameWin.h < 0.99) camera.setViewOffset(w, h, 0, h * (0.5 - (frameWin.top + frameWin.h / 2)), w, h); // цель — в центр окна сцены
    else if (viewShift) camera.setViewOffset(w, h, 0, h * viewShift, w, h); else camera.clearViewOffset();
    camera.updateProjectionMatrix();
    arena.frame(isSide(w, h) ? (Math.min(540, w * 0.42) + 24) / 2 : 0, !isSide(w, h) && frameWin.h < 0.99 ? h * (0.5 - (frameWin.top + frameWin.h / 2)) : 0, w, h);
  }
  resize();

  const clock = new THREE.Clock(); let raf = 0;
  const tmp = new THREE.Vector3();
  function frame() {
    const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;
    skyMat.uniforms.t.value = t;
    if (themeTo) { const u = skyMat.uniforms, k = Math.min(1, dt * 1.5); (['cTop', 'cMid', 'cLow', 'cAur'] as const).forEach((n, i) => u[n].value.lerp(themeTo![i], k)); (scene.fog as THREE.Fog).color.lerp(fogTo, k); }
    starMat.opacity = 0.75 + Math.sin(t * 1.3) * 0.15;
    rifts.forEach((r, i) => { (r.material as THREE.MeshBasicMaterial).opacity = 0.35 + Math.abs(Math.sin(t * (2 + i) + i)) * 0.5 * (Math.random() > 0.97 ? 0.2 : 1); r.position.x += Math.random() > 0.98 ? (Math.random() - 0.5) * 0.6 : 0; });

    ship.position.y = Math.sin(t * 0.8) * 0.25 * km; ship.rotation.z = Math.sin(t * 0.6) * 0.02 * km; ship.rotation.x = Math.sin(t * 0.5) * 0.015 * km;
    props.forEach(p => (p.rotation.x += dt * 14 * km));
    exhaust.forEach((e, i) => e.scale.set(0.3 + Math.sin(t * 20 + i) * 0.05, 0.7, 0.7));
    sailCells.forEach(({ b, c, r }) => { b.position.z = Math.sin(t * 2 + c * 0.7 + r * 0.3) * 0.12 * (c / 4) * km + (c / 4) * 0.25; });
    lanterns.forEach((l, i) => (l.intensity = 1.2 + Math.sin(t * 3 + i * 2) * 0.25));
    (holo.material as THREE.MeshStandardMaterial).opacity = 0.45 + Math.sin(t * 4) * 0.1;
    islands.forEach(o => (o.g.position.y = o.y + Math.sin(t * 0.5 + o.ph) * 0.6 * km));
    clouds.forEach(c => { c.position.x += dt * 0.6 * km; if (c.position.x > 55) c.position.x = -55; });

    // портал
    portalMat.uniforms.t.value = t;
    const targetPower = portalOpen ? 1 : 0.15 + energy * 0.7;
    portalMat.uniforms.power.value += (targetPower - portalMat.uniforms.power.value) * 0.05;
    const pw = portalMat.uniforms.power.value;
    portalLight.intensity = 1 + pw * 3 + Math.sin(t * 7) * 0.2 + flash * 8; flash = Math.max(0, flash - dt * 1.5);
    for (let i = 0; i < pCount; i++) { const s = pSeed[i]; s.a += dt * s.s * (1 + pw * 2); s.r -= dt * 0.25 * s.s; if (s.r < 0.1) s.r = 1.4; pPos[i * 3] = -0.1 - (1.4 - s.r) * 0.5; pPos[i * 3 + 1] = 2.05 + Math.sin(s.a) * s.r * 1.2; pPos[i * 3 + 2] = Math.cos(s.a) * s.r; }
    pGeo.attributes.position.needsUpdate = true; pMat.opacity = 0.35 + pw * 0.55;

    // живой корабль: герой сам ходит между станциями палубы (штурвал, портал, мачта, консоль)
    if (mode === 'hub' && !walk && !attack && km === 1 && t > nextWander) {
      const st = STATIONS[Math.floor(Math.random() * STATIONS.length)];
      nextWander = t + 5 + Math.random() * 5;
      walk = { x: st[0], z: st[1], res: () => { if (Math.random() < 0.35) celebrateT = 0.5; } };
    }
    // герой
    let walking = false;
    if (walk) {
      const dx = walk.x - hero.g.position.x, dz = walk.z - hero.g.position.z, L = Math.hypot(dx, dz);
      if (L < 0.05) { const r = walk.res; walk = null; hero.g.rotation.y = Math.PI / 2; r(); }
      else { walking = true; const st = Math.min(L, dt * 3.4); hero.g.position.x += dx / L * st; hero.g.position.z += dz / L * st; hero.g.rotation.y = Math.atan2(dx, dz); }
    }
    const sw = walking ? Math.sin(t * 11) * 0.75 : 0;
    const eq = worn.get(hero); if (eq) animateGear(eq, t, walking);
    hero.legL.rotation.x = sw; hero.legR.rotation.x = -sw; hero.armL.rotation.x = -sw * 0.8;
    if (attack) {
      attack.t += dt * (attack.crit ? 2.2 : 2.6);
      const a = attack.t;
      hero.armR.rotation.x = -Math.sin(Math.min(a, 1) * Math.PI) * 2.5;
      hero.g.position.x += a < 0.5 ? dt * 1.5 : -dt * 1.5;
      if (a >= 1) { const r = attack.res; attack = null; r(); }
    } else hero.armR.rotation.x = walking ? sw * 0.8 : Math.sin(t * 2) * 0.05;
    const jump = celebrateT > 0 ? Math.abs(Math.sin(celebrateT * 9)) * 0.6 : 0; celebrateT = Math.max(0, celebrateT - dt);
    hero.hips.position.y = 0.95 + jump + (walking ? Math.abs(Math.sin(t * 11)) * 0.06 : 0);
    hero.body.scale.y = 1 + (walking ? 0 : Math.sin(t * 2.2) * 0.015);           // «дыхание»
    hero.head.rotation.y = walking ? 0 : Math.sin(t * 0.7) * 0.25 * km;
    hero.head.rotation.x = walking ? 0.05 : Math.sin(t * 0.9) * 0.04;
    const heroBlink = (t % 4.1) < 0.12 ? 0.1 : 1; hero.eyes.forEach(e => (e.scale.y = heroBlink));
    (hero.blade.material as THREE.MeshToonMaterial).emissiveIntensity = 1.5 + Math.sin(t * 6) * 0.4;
    (hero.cell.material as THREE.MeshToonMaterial).emissiveIntensity = 1.8 + Math.sin(t * 3) * 0.6;
    shipAnim.flags.forEach(f => waveFlag(f, t)); shipAnim.wheel.rotation.x = Math.sin(t * 0.4) * 0.6;
    B.thrusters.forEach((th, i) => th.scale.setScalar(0.9 + Math.sin(t * 18 + i) * 0.15));
    B.flame.scale.set(1, 0.8 + Math.sin(t * 25) * 0.2, 1);

    // Бит
    hero.g.getWorldPosition(tmp); tmp.add(new THREE.Vector3(-0.7, 3 + Math.sin(t * 2.2) * 0.22, 1.3));
    bit.position.lerp(tmp, 0.05); bit.lookAt(camera.position.x, bit.position.y, camera.position.z);
    bitProp.rotation.y += dt * 22; (antenna.material as THREE.MeshToonMaterial).emissiveIntensity = 1.5 + Math.sin(t * 5) * 1;
    blinkT += dt; if (blinkT > 3.2) { drawFace(true); if (blinkT > 3.35) { blinkT = 0; drawFace(); } }

    // моб
    if (mob) {
      const g = mob.g;
      if (mob.dying > 0) { mob.dying -= dt; g.scale.multiplyScalar(0.9); g.rotation.y += dt * 12; if (mob.dying <= 0) { ship.remove(g); mob = null; } }
      else {
        const s = Math.min(1, g.scale.x + dt * 2.2); g.scale.setScalar(s);
        g.position.y = 0.15 + Math.abs(Math.sin(t * 4)) * 0.15; g.rotation.y = Math.sin(t * 3) * 0.2;
        mob.shards.rotation.y += dt * 1.6; mob.shards.rotation.x = Math.sin(t) * 0.3;
        if (Math.random() < 0.05) mob.parts[0].position.x = (Math.random() - 0.5) * 0.18; else mob.parts[0].position.x *= 0.8;
        mob.pupil.position.z = Math.sin(t * 1.3) * 0.08; mob.pupil.position.y = Math.cos(t * 0.9) * 0.05;
        if (mob.hitT > 0) { mob.hitT -= dt; g.position.x = 2.3 + Math.sin(mob.hitT * 60) * 0.12 + mob.hitT * 1.2; (mob.parts[0].material as THREE.MeshToonMaterial).emissiveIntensity = 0.35 + mob.hitT * 6; }
        else (mob.parts[0].material as THREE.MeshToonMaterial).emissiveIntensity = 0.35;
      }
    }

    // сундук
    if (chest.visible) { chest.scale.setScalar(Math.min(1, chest.scale.x + dt * 2.5)); lid.rotation.x += ((chestOpen ? -1.9 : 0) - lid.rotation.x) * 0.12; }

    for (let i = bursts.length - 1; i >= 0; i--) {
      const b = bursts[i]; b.life -= dt;
      b.parts.forEach(p => { p.v.y -= dt * 6; p.m.position.addScaledVector(p.v, dt); p.m.rotation.x += dt * 5; p.m.scale.multiplyScalar(0.985); });
      if (b.life <= 0) { scene.remove(b.g); bursts.splice(i, 1); }
    }

    // камера плавно к режиму
    const C = CAM[mode === 'map' ? 'hub' : mode];
    idle += dt;
    if (!dragging && idle > 2.5 && mode === 'hub' && km === 1) userTheta += dt * 0.04;
    cam.target.lerp(C.target, 0.05); cam.radius += (C.radius - cam.radius) * 0.05; cam.phi += (C.phi + userPhi - cam.phi) * 0.08; cam.theta += (C.theta + userTheta - cam.theta) * 0.08;
    const sh = shakeT > 0 ? (Math.random() - 0.5) * shakeT * 0.6 : 0; shakeT = Math.max(0, shakeT - dt);
    camera.position.set(cam.target.x + cam.radius * Math.sin(cam.phi) * Math.cos(cam.theta) + sh, cam.target.y + cam.radius * Math.cos(cam.phi) + sh, cam.target.z + cam.radius * Math.sin(cam.phi) * Math.sin(cam.theta));
    camera.lookAt(cam.target);

    if (mode === 'map') {
      map.setFog((scene.fog as THREE.Fog).color); map.update(dt, t);
      if (composer && renderPass) { renderPass.scene = map.scene; renderPass.camera = map.camera; composer.render(); }
      else renderer.render(map.scene, map.camera);
    } else if (mode === 'battle') {
      arena.setFog((scene.fog as THREE.Fog).color); arena.update(dt, t);
      if (composer && renderPass) { renderPass.scene = arena.scene; renderPass.camera = arena.camera; composer.render(); }
      else renderer.render(arena.scene, arena.camera);
    } else {
      if (renderPass) { renderPass.scene = scene; renderPass.camera = camera; }
      if (composer) composer.render(); else renderer.render(scene, camera);
    }
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);
  addEventListener('resize', resize);

  const worldPos = (o: THREE.Object3D, dy = 1) => o.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, dy, 0));

  return {
    setEnergy(v, max) { energy = Math.max(0, Math.min(1, v / max)); },
    setMode(m) {
      if ((m === 'hub' || m === 'hero') && mode !== m) { walk = null; hero.g.scale.setScalar(1); if (m === 'hero' || hero.g.position.x > 3.5) hero.g.position.set(-2, 0.15, 0.6); hero.g.rotation.y = Math.PI / 2; portalOpen = false; }
      // из боя — герой возвращается через портал на палубу
      if (m === 'hub' && mode === 'battle') {
        hero.g.position.set(3.9, 0.15, 0); hero.g.scale.setScalar(0.01); portalOpen = true; flash = 1;
        const t0 = performance.now();
        const grow = () => { const u = Math.min(1, (performance.now() - t0) / 400); hero.g.scale.setScalar(Math.max(0.01, u)); if (u < 1) requestAnimationFrame(grow); else { burst(worldPos(portal, 2), 0x3ff0ff, 50, 5); walk = { x: 1.2, z: 0.6, res: () => { portalOpen = false; celebrateT = 0.6; } }; } };
        setTimeout(grow, 250);
      }
      mode = m; userTheta = 0; userPhi = 0; const narrow = (canvas.clientWidth || innerWidth) / (canvas.clientHeight || innerHeight) < 0.8; viewShift = m === 'hub' ? (narrow ? 0.2 : 0.08) : narrow ? 0.24 : 0.12; applyOffset(); },
    heroWalk(x, z) { return new Promise(res => (walk = { x, z, res })); },
    heroAttack(crit = false, sup = false) { return arena.attack({ crit, sup, dmg: sup ? 2 : 1 }); },
    spawnMob(hp, kind = 0, boss = false) { return arena.spawn(hp, kind, boss); },
    enemyAttack() { return arena.enemyAttack(); },
    arrive() { return arena.arrive(); },
    setArena(k, a, b) { arena.theme(k, a, b); },
    setSpot(seed) { return arena.spot(seed); },
    setStyle(cape, trail) { capeNow = cape; [...worn.keys()].forEach(wear); arena.setTrail(trail); },
    hitMob() {},
    killMob() { return arena.defeat(); },
    clearMob() { arena.clear(); if (mob) { ship.remove(mob.g); mob = null; } chest.visible = false; },
    openChest() { return arena.victory(); },
    portalWalk() {
      return new Promise<void>(res => {
        walk = { x: 3.9, z: 0, res: () => {
          portalOpen = true; flash = 1; burst(worldPos(portal, 2), 0x3ff0ff, 90, 7);
          const t0 = performance.now();
          const shrink = () => { const u = Math.min(1, (performance.now() - t0) / 350); hero.g.scale.setScalar(Math.max(0.01, 1 - u)); if (u < 1) requestAnimationFrame(shrink); else res(); };
          shrink();
        } };
      });
    },
    bitMood(m) { mood = m; drawFace(); },
    celebrate(color = 0x3ff0ff) { if (mode === 'battle') { arena.celebrate(); return; } celebrateT = 1.2; burst(worldPos(hero.g, 2.5), color, 50, 5); },
    openPortal() { portalOpen = true; flash = 1; burst(worldPos(portal, 2), 0x3ff0ff, 90, 7); },
    setTheme(sky, fog) { themeTo = sky.map(c => new THREE.Vector3(c[0], c[1], c[2])); fogTo.setHex(fog); },
    setFrame(top, height) { frameWin.top = top; frameWin.h = height; applyOffset(); },
    setOutfit(jacket, dark, visor, id = 'cyan') { outfitNow = [jacket, dark, visor]; paintOutfit(jacket, dark, visor); gearNow = GEAR[id] ?? GEAR.cyan; colorsNow = { jacket, dark, visor }; [...worn.keys()].forEach(wear); },
    mapSetup(isles, current) { map.setup(isles, current); },
    mapFocus(i) { map.focus(i); },
    mapTravel(i) { return map.travel(i); },
    onMapPick(cb) { map.onPick(cb); },
    mapLabels() { return map.labels(); },
    mapFocused() { return map.focusIndex; },
    resize,
    dispose() {
      cancelAnimationFrame(raf); removeEventListener('resize', resize);
      canvas.removeEventListener('pointerdown', onDown); window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp);
      renderer.dispose(); composer?.dispose();
    },
  };
}
