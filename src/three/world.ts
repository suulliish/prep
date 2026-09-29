// 3D-мир «Жарық»: летающий корабль-хаб, Кодер, дрон Бит, портал, глитч-мобы.
// Всё собрано из блоков кодом (Three.js). Режимы камеры: hub (общий вид), battle (бой на палубе), portal.
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { makeBit } from './characters';
import { createDeck, type Deck } from './deck3d';
import { createMap, type MapIsle, type MapLabel } from './map';
import { createArena } from './arena';
import { LOOKS, DEFAULT_LOOK } from './looks';
import { HeroFigure } from './figure';
import { Kit } from './assets';
import { createPortal } from './portal';
import { dressAirship, type Airship } from './airship';
import { createSkyscape } from './skyscape';
import { audio } from '../lib/audio';

export type CamMode = 'hub' | 'battle' | 'portal' | 'map' | 'hero';
export type BitMood = 'idle' | 'happy' | 'wow' | 'think' | 'sad';

export interface World {
  setEnergy(v: number, max: number): void;
  setMode(m: CamMode): void;
  heroWalk(x: number, z: number): Promise<void>;
  /** Удар героя в бою; sup — суперудар. Возвращает, повержен ли враг. */
  heroAttack(crit?: boolean, sup?: boolean): Promise<boolean>;
  spawnMob(hp: number, kind?: number, boss?: boolean, worldBoss?: boolean): Promise<void>;
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
  /** Катсцена на карте: мир i только что открылся (серый остров расцветает). */
  mapUnveil(i: number): Promise<void>;
  onMapPick(cb: (i: number) => void): void;
  mapLabels(): MapLabel[];
  /** Мир, к которому сейчас пролистана карта. */
  mapFocused(): number;
  /** Окно сцены в каркасе экрана (доли высоты): камера центрирует цель в этом окне. */
  setFrame(top: number, height: number): void;
  resize(): void;
  /** Только для проверки (hub.html?cam=…): камера режима hub вручную. */
  devCam?(x: number, y: number, z: number, r: number, phi: number, theta: number): void;
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
  renderer.toneMapping = THREE.NeutralToneMapping;   // готовые модели красятся палитрой: нейтральное отображение не сереет и не темнит
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
  // готовый корабль Kenney (src/three/deck3d.ts): по его палубе ходит герой; лётная оснастка (двигатели, кристалл под килем) — airship.ts
  const ship = new THREE.Group(); scene.add(ship);
  let deck: Deck | null = null, air: Airship | null = null;

  // ---------- Портал ---------- (src/three/portal.ts) на носу; лицом к корме и правому борту — к обычному ракурсу камеры,
  // чтобы с главного экрана был виден вихрь, а не ребро кольца. Герой подходит к нему спереди.
  // Главное меню строится вокруг портала: камера смотрит с носа и правого борта (HUB_THETA), портал повёрнут к ней лицом,
  // герой гуляет по площадке перед порталом и в покое стоит лицом к зрителю.
  const HUB_THETA = Math.PI - 0.55;                           // с кормы, чуть с правого борта: вся палуба вдоль, портал в глубине кадра
  const PORTAL_FACE = Math.PI / 2 - HUB_THETA;                 // нормаль портала (sin F, cos F) смотрит ровно на камеру
  const portalFx = createPortal({ radius: 1.35 }), portal = portalFx.g;
  portal.rotation.y = PORTAL_FACE; portal.scale.setScalar(0.85); portal.position.set(4.6, 0, 0); ship.add(portal);
  let home: [number, number][] = [];
  let energy = 0.3, portalOpen = false, pulling = false, cutscene = false, focusPortal = false, cutToken = 0, portalP: Promise<void> | null = null, portalStand: [number, number] = [3.5, 0];
  const portalCenter = () => portal.localToWorld(new THREE.Vector3(0, portalFx.center, 0));
  /** Покадровая анимация по времени (для катсцен на палубе). Если катсцену отменили (смена режима — cutToken), шаги прекращаются. */
  const anim = (dur: number, step: (u: number) => void, tok = cutToken) => new Promise<void>(res => { const t0 = performance.now(); const f = () => { if (tok !== cutToken) return res(); const u = Math.min(1, (performance.now() - t0) / (dur * 1000)); step(u); if (u < 1) requestAnimationFrame(f); else res(); }; f(); });


  // ---------- Герой ----------
  const fig = new HeroFigure(DEFAULT_LOOK, 1.15), hero = { g: fig.g };   // настоящий герой (модель с анимациями)
  let themeTo: THREE.Vector3[] | null = null; const fogTo = new THREE.Color(0x17104a), worldFog = new THREE.Color(0x17104a), tmpC = new THREE.Color();
  hero.g.position.set(0, 0, 0); hero.g.rotation.y = Math.PI / 2; ship.add(hero.g);
  createDeck(quality).then(async d => {
    deck = d; ship.add(d.g);
    air = dressAirship(d.hull, d.model, { quality, furled: true }); ship.add(air.g);
    const [mx, mz] = d.stations.mid; hero.g.position.set(mx, 0, mz);
    // портал — на открытой носовой палубе (перед фок-мачтой, чтобы парус не закрывал), герой встаёт перед ним
    const [px, pz] = d.nearest(d.bounds.maxX - 0.9, 0);             // у самого носа: перегораживает только кончик палубы portal.position.set(px, d.height(px, pz) ?? 0, pz);
    for (const k of [-1.3, -0.65, 0, 0.65, 1.3]) d.reserve(px + Math.cos(PORTAL_FACE) * k, pz - Math.sin(PORTAL_FACE) * k, 0.75);   // кольцо поперёк: сквозь камни не ходим
    // место героя перед входом: прямо напротив центра кольца (с любой стороны — вихрь двусторонний), куда можно дойти с середины палубы
    { const nx = Math.sin(PORTAL_FACE), nz = Math.cos(PORTAL_FACE), cand: [number, number, number][] = [];
      for (let dx = -3.6; dx <= 3.6; dx += 0.3) for (let dz = -3.6; dz <= 3.6; dz += 0.3) {
        const along = dx * nx + dz * nz, lat = dx * nz - dz * nx;       // вдоль нормали и вдоль кольца
        if (Math.abs(along) < 1 || Math.abs(along) > 2.6 || Math.abs(lat) > 0.6 || !d.walkable(px + dx, pz + dz)) continue;
        cand.push([Math.abs(along) + Math.abs(lat) * 2 + (along < 0 ? 0.3 : 0), px + dx, pz + dz]);
      }
      cand.sort((a, b) => a[0] - b[0]);
      const ok = cand.find(c => d.path(d.stations.mid, [c[1], c[2]]).length > 0);
      if (ok) portalStand = [ok[1], ok[2]];
      // камера катсцены входа: со стороны, откуда подходит герой, чуть сбоку — видно и героя, и вихрь
      CAM.portal.target.set(px, 1.9, pz); CAM.portal.theta = Math.atan2(portalStand[1] - pz, portalStand[0] - px) + 0.45; CAM.portal.phi = 1.18;
      // места прогулки в кадре: площадка перед порталом со стороны камеры (достижимые с места входа)
      home = cand.filter(c => Math.hypot(c[1] - portalStand[0], c[2] - portalStand[1]) > 0.8).map(c => [c[1], c[2]] as [number, number]);
      for (let dx = -3; dx <= 3; dx += 0.6) for (let dz = -3; dz <= 3; dz += 0.6) {
        const q: [number, number] = [portalStand[0] + dx, portalStand[1] + dz], along = (q[0] - px) * nx + (q[1] - pz) * nz;
        if (along > 1 && d.walkable(q[0], q[1]) && Math.hypot(dx, dz) > 0.9 && d.path(portalStand, q).length) home.push(q);
      }
      home.push(portalStand);
      if (mode === 'hub') { const h0 = home[Math.floor(home.length / 2)]; hero.g.position.set(h0[0], d.height(h0[0], h0[1]) ?? 0, h0[1]); hero.g.rotation.y = PORTAL_FACE - 0.25; }
      // камера главного меню: между порталом и площадкой перед ним
      CAM.hub.target.set(px + nx * 2.6, 1.6, pz + nz * 2.6); }
    // реквизит палубы: готовые бочки, ящики, пушка (Kenney Pirate Kit) у бортов; вокруг них не ходим
    const k = await Kit.load('ship'), e = d.edges().sort((a, b) => a[0] - b[0]);
    const far = ([x, z]: [number, number]) => Object.values(d.stations).every(s => Math.hypot(s[0] - x, s[1] - z) > 2.2) && Math.hypot(portal.position.x - x, portal.position.z - z) > 3.2;   // площадка у портала свободна
    let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (const [name, f, h] of [['barrel', 0.1, 1.2], ['crate', 0.22, 1.1], ['cannon', 0.34, 1.3], ['barrel', 0.5, 1.2], ['crate-bottles', 0.62, 1.0], ['cannon', 0.74, 1.3], ['barrel', 0.9, 1.2]] as const) {
      const c = e.slice(Math.floor(e.length * f)).find(far); if (!c) continue;
      const o = k.get(name, { height: h, ground: true }); o.position.set(c[0], d.height(c[0], c[1]) ?? 0, c[1]); o.rotation.y = rnd() * 6.28; ship.add(o); d.reserve(c[0], c[1], 0.9);
    }
  }).catch(e => console.warn('палуба не загрузилась', e));

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

  // ---------- Острова и облака ---------- (src/three/skyscape.ts)
  const sky = createSkyscape({ quality }); scene.add(sky.g);

  // ---------- Частицы ----------
  const bursts: { g: THREE.Group; parts: { m: THREE.Mesh; v: THREE.Vector3 }[]; life: number }[] = [];
  function burst(pos: THREE.Vector3, color: number, n = 40, speed = 4) {
    const g = new THREE.Group(); g.position.copy(pos); scene.add(g);
    const parts = Array.from({ length: n }, () => { const m = new THREE.Mesh(box, mat(color, color, 2)); const s = 0.08 + Math.random() * 0.14; m.scale.setScalar(s); g.add(m); return { m, v: new THREE.Vector3((Math.random() - 0.5) * speed, Math.random() * speed, (Math.random() - 0.5) * speed) }; });
    bursts.push({ g, parts, life: 1.3 });
  }

  // ---------- 3D-карта миров (своя сцена) ----------
  const map = createMap({ skyMat, starGeo, starMat, km });
  const arena = createArena({ skyMat, starGeo, starMat, km, shadows: quality === 'high', sfx: n => audio.play(n) });

  // ---------- Постобработка ----------
  let composer: EffectComposer | null = null;
  let renderPass: RenderPass | null = null;
  if (quality === 'high') {
    composer = new EffectComposer(renderer);
    renderPass = new RenderPass(scene, camera); composer.addPass(renderPass);
    composer.addPass(new UnrealBloomPass(new THREE.Vector2(512, 512), 0.6, 0.4, 0.95));
    composer.addPass(new OutputPass());
  }

  // ---------- Камера ----------
  const CAM: Record<Exclude<CamMode, 'map'>, { target: THREE.Vector3; radius: number; phi: number; theta: number }> = {
    hub: { target: new THREE.Vector3(0, 1.6, 0), radius: 24, phi: 1.2, theta: HUB_THETA },
    battle: { target: new THREE.Vector3(0.2, 1.2, 0.6), radius: 11, phi: 1.12, theta: 1.62 },
    portal: { target: new THREE.Vector3(4.6, 2.2, 0), radius: 9, phi: 1.25, theta: 0.15 },
    hero: { target: new THREE.Vector3(-2, 1.5, 0.6), radius: 11, phi: 1.32, theta: HUB_THETA + 0.25 }, // витрина: герой на площадке у портала, сияние портала за спиной; цель следует за героем
  };
  let mode: CamMode = 'hub', devLock = false;
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
    tapPlane.constant = -ship.position.y;
    if (!tapRay.ray.intersectPlane(tapPlane, tapHit)) return;
    const p = ship.worldToLocal(tapHit.clone());
    if (!deck) return;
    // касание самого героя — он машет в ответ, Бит радуется
    if (Math.hypot(hero.g.position.x - p.x, hero.g.position.z - p.z) < 0.9 && !walk && !cutscene) { endActivity(true); fig.play('Waving', 1.1); mood = 'happy'; drawFace(); nextWander = clock.elapsedTime + 6; return; }
    const q = deck.nearest(p.x, p.z); if (Math.hypot(q[0] - p.x, q[1] - p.z) > 3) return;   // мимо палубы
    const x = q[0], z = q[1];
    nextWander = Infinity;                                               // сам не уходит, пока идёт по касанию
    burst(ship.localToWorld(new THREE.Vector3(x, (deck.height(x, z) ?? 0) + 0.3, z)), 0x3ff0ff, 14, 2);
    goTo(x, z, () => { nextWander = clock.elapsedTime + 10; celebrateT = 0.4; });
  }
  const onWheel = (e: WheelEvent) => { if (mode === 'map') { e.preventDefault(); map.wheel(e.deltaY); } };
  canvas.addEventListener('wheel', onWheel, { passive: false });
  canvas.addEventListener('pointerdown', onDown); window.addEventListener('pointermove', onMove); window.addEventListener('pointerup', onUp);

  // ---------- Анимации героя ----------
  // герой ходит по палубе по найденному пути (deck3d.ts: путь огибает мачты, поручни и реквизит)
  type Walk = { path: [number, number][]; i: number; res: () => void; run: boolean };
  let walk: Walk | null = null;
  /** Идти (run — бегом) по найденному пути. Нет пути (точка за порталом, отрезанный угол) — не идём напрямик сквозь препятствия, а стоим. */
  const goTo = (x: number, z: number, res: () => void = () => {}, run = false) => {
    if (!deck) { res(); return; }
    endActivity(true);
    const p = deck.path([hero.g.position.x, hero.g.position.z], [x, z]);
    if (!p.length) { walk = null; res(); return; }
    walk = { path: p, i: 0, res, run };
  };
  const spot = (k: 'bow' | 'stern' | 'mid' | 'port' | 'star'): [number, number] => deck?.stations[k] ?? [0, 0];
  const WANDER = ['bow', 'stern', 'mid', 'port', 'star'] as const;
  let nextWander = 4;
  let celebrateT = 0;
  // Жизнь на палубе в главном меню: дойдя до места, герой чем-то занят — стоит лицом к зрителю, сидит, тренируется, машет.
  let activity: { until: number; exit: string | null } | null = null;
  function startActivity(now: number) {
    const r = Math.random();
    if (r < 0.35) { nextWander = now + 5 + Math.random() * 4; return; }
    if (r < 0.55) { fig.play('Sit_Floor_Down').then(() => { if (activity) fig.hold('Sit_Floor_Idle'); }); activity = { until: now + 9 + Math.random() * 5, exit: 'Sit_Floor_StandUp' }; }
    else if (r < 0.7) { fig.hold('Push_Ups'); activity = { until: now + 5, exit: null }; }
    else if (r < 0.8) { fig.hold('Sit_Ups'); activity = { until: now + 5, exit: null }; }
    else { fig.play('Waving'); nextWander = now + 5; return; }
    nextWander = Infinity;
  }
  function endActivity(quick = false) {
    if (!activity) return; const ex = activity.exit; activity = null; fig.hold(null);
    if (ex && !quick) fig.play(ex);
  }

  function resize() {
    const w = canvas.clientWidth || innerWidth, h = canvas.clientHeight || innerHeight;
    renderer.setSize(w, h, false); composer?.setSize(w, h);
    camera.aspect = w / h; camera.updateProjectionMatrix(); map.resize(w, h); arena.resize(w, h);
    const narrow = w / h < 0.8;
    const side = isSide(w, h);
    if (!devLock) CAM.hub.radius = narrow ? 26 : side ? 21 : w / h < 1.5 ? 18 : 22;   // почти квадратное окно (телефон лёжа, панель справа) — ближе CAM.portal.radius = narrow ? 17 : 11; CAM.battle.radius = narrow ? 23 : side ? 14 : 13; CAM.hero.radius = narrow ? 10.5 : 7.5;   // целиком, со шлемом и оружием (скины)
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
    arena.frame(isSide(w, h) ? (Math.min(540, w * 0.42) + 24) / 2 : 0, !isSide(w, h) && frameWin.h < 0.99 ? h * (0.5 - (frameWin.top + frameWin.h / 2)) : 0, w, h, isSide(w, h) ? 1 : frameWin.h);
  }
  resize();

  const clock = new THREE.Clock(); let raf = 0;
  const tmp = new THREE.Vector3(), bitSide = new THREE.Vector3();
  function frame() {
    const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;
    skyMat.uniforms.t.value = t;
    if (themeTo) { const u = skyMat.uniforms, k = Math.min(1, dt * 1.5); (['cTop', 'cMid', 'cLow', 'cAur'] as const).forEach((n, i) => u[n].value.lerp(themeTo![i], k)); worldFog.lerp(fogTo, k); }
    // у корабля туман — цвет низа неба: дальние облака и острова тают в небе, а не темнеют пятнами (туман мира — для боя и карты)
    { const u = skyMat.uniforms; (scene.fog as THREE.Fog).color.setRGB(u.cLow.value.x, u.cLow.value.y, u.cLow.value.z).lerp(tmpC.setRGB(u.cMid.value.x, u.cMid.value.y, u.cMid.value.z), 0.3);
      if (!composer) (scene.fog as THREE.Fog).color.convertSRGBToLinear(); }   // без постобработки небо выводится как есть (sRGB), туман — через перевод цвета
    starMat.opacity = 0.75 + Math.sin(t * 1.3) * 0.15;
    rifts.forEach((r, i) => { (r.material as THREE.MeshBasicMaterial).opacity = 0.35 + Math.abs(Math.sin(t * (2 + i) + i)) * 0.5 * (Math.random() > 0.97 ? 0.2 : 1); r.position.x += Math.random() > 0.98 ? (Math.random() - 0.5) * 0.6 : 0; });

    ship.position.y = Math.sin(t * 0.8) * 0.25 * km; ship.rotation.z = Math.sin(t * 0.6) * 0.02 * km; ship.rotation.x = Math.sin(t * 0.5) * 0.015 * km;
    deck?.update(t, km); air?.update(dt, t, km);
    sky.update(dt, t, km, (scene.fog as THREE.Fog).color);

    // портал: руны горят по энергии дня, открытый — в полную силу
    portalFx.setPower(portalOpen ? 1.1 : 0.12 + energy * 0.75); portalFx.update(dt, t);

    // живой корабль: герой сам ходит между станциями палубы (нос у портала, корма, середина, борта)
    if (activity && t > activity.until) { endActivity(); nextWander = t + 2.5; }
    if (mode === 'hub' && !walk && !cutscene && km === 1 && deck && t > nextWander) {
      const st = home.length ? home[Math.floor(Math.random() * home.length)] : spot(WANDER[Math.floor(Math.random() * WANDER.length)]);   // в главном меню гуляет в кадре, у портала
      nextWander = t + 5 + Math.random() * 5;
      goTo(st[0], st[1], () => startActivity(t));
    }
    // герой
    let walking = false;
    if (walk) {
      const tg = walk.path[walk.i], dx = tg[0] - hero.g.position.x, dz = tg[1] - hero.g.position.z, L = Math.hypot(dx, dz);
      if (L < 0.1) { if (++walk.i >= walk.path.length) { const r = walk.res; walk = null; hero.g.rotation.y = mode === 'hub' ? PORTAL_FACE - 0.25 : Math.PI / 2; r(); } }
      else { walking = true; const st = Math.min(L, dt * (walk.run ? 7 : 3.4)); hero.g.position.x += dx / L * st; hero.g.position.z += dz / L * st;
        hero.g.rotation.y += Math.atan2(Math.sin(Math.atan2(dx, dz) - hero.g.rotation.y), Math.cos(Math.atan2(dx, dz) - hero.g.rotation.y)) * Math.min(1, dt * 12); }
    }
    if (deck && !pulling) { const hh = deck.height(hero.g.position.x, hero.g.position.z); if (hh != null) hero.g.position.y += (hh - hero.g.position.y) * Math.min(1, dt * 14); }
    // анимации героя настоящие: ходьба/стойка меняются сами, радость — разовая
    fig.walking(walking, walking && !!walk?.run); fig.update(dt);
    if (celebrateT > 0) { celebrateT = 0; fig.play('Cheering', 1.1); }
    B.thrusters.forEach((th, i) => th.scale.setScalar(0.9 + Math.sin(t * 18 + i) * 0.15));
    B.flame.scale.set(1, 0.8 + Math.sin(t * 25) * 0.2, 1);

    // Бит
    // Бит летает сбоку от героя (поперёк взгляда камеры), а не между героем и камерой
    hero.g.getWorldPosition(tmp); tmp.add(bitSide.set(-Math.sin(cam.theta) * 1.1, 2.7 + Math.sin(t * 2.2) * 0.22, Math.cos(cam.theta) * 1.1));
    bit.position.lerp(tmp, 0.05); bit.lookAt(camera.position.x, bit.position.y, camera.position.z);
    bitProp.rotation.y += dt * 22; (antenna.material as THREE.MeshToonMaterial).emissiveIntensity = 1.5 + Math.sin(t * 5) * 1;
    blinkT += dt; if (blinkT > 3.2) { drawFace(true); if (blinkT > 3.35) { blinkT = 0; drawFace(); } }

    // сундук

    for (let i = bursts.length - 1; i >= 0; i--) {
      const b = bursts[i]; b.life -= dt;
      b.parts.forEach(p => { p.v.y -= dt * 6; p.m.position.addScaledVector(p.v, dt); p.m.rotation.x += dt * 5; p.m.scale.multiplyScalar(0.985); });
      if (b.life <= 0) { scene.remove(b.g); bursts.splice(i, 1); }
    }

    // камера плавно к режиму
    if (mode === 'hero') { hero.g.getWorldPosition(CAM.hero.target); CAM.hero.target.y += 1.15; }
    const C = focusPortal && mode === 'hub' ? CAM.portal : CAM[mode === 'map' ? 'hub' : mode];
    idle += dt;
    // сам камера не облетает корабль по кругу (сзади паруса закрывают палубу), а покачивается у лучшего ракурса
    if (!dragging && idle > 2.5 && mode === 'hub' && km === 1 && !devLock) userTheta += (Math.sin(t * 0.08) * 0.22 - userTheta) * Math.min(1, dt * 0.3);
    cam.target.lerp(C.target, 0.05); cam.radius += (C.radius - cam.radius) * 0.05; cam.phi += (C.phi + userPhi - cam.phi) * 0.08; cam.theta += (C.theta + userTheta - cam.theta) * 0.08;
    const sh = shakeT > 0 ? (Math.random() - 0.5) * shakeT * 0.6 : 0; shakeT = Math.max(0, shakeT - dt);
    camera.position.set(cam.target.x + cam.radius * Math.sin(cam.phi) * Math.cos(cam.theta) + sh, cam.target.y + cam.radius * Math.cos(cam.phi) + sh, cam.target.z + cam.radius * Math.sin(cam.phi) * Math.sin(cam.theta));
    camera.lookAt(cam.target);

    if (mode === 'map') {
      map.setFog(worldFog); map.update(dt, t);
      if (composer && renderPass) { renderPass.scene = map.scene; renderPass.camera = map.camera; composer.render(); }
      else renderer.render(map.scene, map.camera);
    } else if (mode === 'battle') {
      arena.setFog(worldFog); arena.update(dt, t);
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
      const tiny = hero.g.scale.x < 0.99 || pulling;                  // после входа в портал герой уменьшен и висит в центре кольца
      if ((m === 'hub' || m === 'hero') && (mode !== m || tiny)) {
        walk = null; endActivity(true); hero.g.scale.setScalar(1); cutscene = pulling = focusPortal = false; portalP = null; cutToken++; portalOpen = false;
        if (m === 'hero') { const s0 = home.length ? home[Math.floor(home.length / 2)] : spot('mid'); hero.g.position.set(s0[0], deck?.height(s0[0], s0[1]) ?? 0, s0[1]); hero.g.rotation.y = PORTAL_FACE + 0.2; }
        else if (tiny) { hero.g.position.set(portalStand[0], 0, portalStand[1]); hero.g.rotation.y = PORTAL_FACE - 0.25; }
      }
      // из боя — герой возвращается через портал на палубу
      if (m === 'hub' && mode === 'battle') {
        // портал вспыхивает, герой вылетает из центра кольца и приземляется перед ним
        const b0 = portalStand, gx = b0[0], gy = deck?.height(b0[0], b0[1]) ?? 0, c = ship.worldToLocal(portalCenter()), tok = cutToken;
        hero.g.scale.setScalar(0.01); hero.g.position.copy(c); hero.g.rotation.y = PORTAL_FACE; portalOpen = true; pulling = cutscene = true;
        setTimeout(() => { if (tok !== cutToken) return; portalFx.pulse(); burst(portalCenter(), 0x3ff0ff, 50, 5);
          anim(0.55, u => { const e = 1 - (1 - u) ** 3; hero.g.scale.setScalar(Math.max(0.01, e)); hero.g.position.set(c.x + (gx - c.x) * e, c.y + (gy - c.y) * u * u + Math.sin(u * Math.PI) * 0.6, c.z + (b0[1] - c.z) * e); }, tok)
            .then(() => { if (tok !== cutToken) return; hero.g.scale.setScalar(1); pulling = cutscene = false; nextWander = clock.elapsedTime + 8; const s1 = home.length ? home[Math.floor(Math.random() * home.length)] : spot('mid'); goTo(s1[0], s1[1], () => { portalOpen = false; celebrateT = 0.6; }); });
        }, 350);
      }
      mode = m; userTheta = 0; userPhi = 0; const narrow = (canvas.clientWidth || innerWidth) / (canvas.clientHeight || innerHeight) < 0.8; viewShift = m === 'hub' ? (narrow ? 0.2 : 0.08) : narrow ? 0.24 : 0.12; applyOffset(); },
    heroWalk(x, z) { return new Promise<void>(res => goTo(x, z, res)); },
    heroAttack(crit = false, sup = false) { return arena.attack({ crit, sup, dmg: sup ? 2 : 1 }); },
    spawnMob(hp, kind = 0, boss = false, worldBoss = false) { return arena.spawn(hp, kind, boss && !worldBoss, worldBoss); },
    enemyAttack() { return arena.enemyAttack(); },
    arrive() { return arena.arrive(); },
    setArena(k, a, b) { arena.theme(k, a, b); },
    setSpot(seed) { return arena.spot(seed); },
    setStyle(c, trail) { arena.setCape(c); fig.setCape(c); map.setCape(c); arena.setTrail(trail); },
    hitMob() {},
    killMob() { return arena.defeat(); },
    clearMob() { arena.clear(); },
    openChest() { return arena.victory(); },
    portalWalk() {
      if (portalP) return portalP;                                       // повторный вызов — та же катсцена
      const tok = cutToken; cutscene = focusPortal = true; portalOpen = true; userTheta = userPhi = 0;          // портал разгорается, пока герой бежит
      portalP = new Promise<void>(res => {
        // герой бежит к порталу, тот вспыхивает, героя затягивает в центр вихря с поворотом — вспышка
        goTo(portalStand[0], portalStand[1], async () => {
          if (tok !== cutToken) return res();
          hero.g.rotation.y = Math.atan2(portal.position.x - hero.g.position.x, portal.position.z - hero.g.position.z);   // лицом к порталу
          portalFx.pulse(); fig.play('Cheering', 1.6);
          await anim(0.6, () => {}, tok);                                 // камера успевает подлететь, ребёнок видит героя у портала
          pulling = true; const p0 = hero.g.position.clone(), c = ship.worldToLocal(portalCenter()), r0 = hero.g.rotation.y;
          await anim(0.75, u => { const e = u * u; hero.g.position.lerpVectors(p0, c, e); hero.g.rotation.y = r0 + e * Math.PI * 3; hero.g.scale.setScalar(Math.max(0.01, 1 - e)); }, tok);
          if (tok === cutToken) { portalFx.pulse(); burst(portalCenter(), 0x3ff0ff, 90, 7); }
          res();
        }, true);
      });
      return portalP;
    },
    bitMood(m) { mood = m; drawFace(); },
    celebrate(color = 0x3ff0ff) { if (mode === 'battle') { arena.celebrate(); return; } celebrateT = 1.2; burst(worldPos(hero.g, 2.5), color, 50, 5); },
    openPortal() { portalOpen = true; portalFx.pulse(); burst(portalCenter(), 0x3ff0ff, 90, 7); },
    setTheme(sky, fog) { themeTo = sky.map(c => new THREE.Vector3(c[0], c[1], c[2])); fogTo.setHex(fog); },
    setFrame(top, height) { frameWin.top = top; frameWin.h = height; applyOffset(); },
    setOutfit(_jacket, _dark, _visor, id = 'cyan') { const look = LOOKS[id] ?? DEFAULT_LOOK; arena.setLook(look); fig.setLook(look); map.setLook(look); },
    mapSetup(isles, current) { map.setup(isles, current); },
    mapFocus(i) { map.focus(i); },
    mapTravel(i) { return map.travel(i); },
    mapUnveil(i) { audio.play('portal'); return map.unveil(i); },
    onMapPick(cb) { map.onPick(cb); },
    mapLabels() { return map.labels(); },
    mapFocused() { return map.focusIndex; },
    resize,
    /** Только для проверки (hub.html?cam=x,y,z,радиус,phi,theta): поставить камеру режима hub вручную. */
    devCam(x: number, y: number, z: number, r: number, phi: number, theta: number) { CAM.hub.target.set(x, y, z); CAM.hub.radius = r; CAM.hub.phi = phi; CAM.hub.theta = theta; viewShift = 0; frameWin.h = 1; applyOffset(); devLock = true; cam.target.set(x, y, z); Object.assign(cam, { radius: r, phi, theta }); },
    dispose() {
      cancelAnimationFrame(raf); removeEventListener('resize', resize);
      canvas.removeEventListener('pointerdown', onDown); window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp);
      arena.dispose(); renderer.dispose(); composer?.dispose();
    },
  };
}
