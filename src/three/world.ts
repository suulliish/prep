// 3D-мир «Жарық»: оркестратор — рендер и постобработка, небо, свет, камера с режимами, карта и арена боя.
// Сцены живут в своих модулях: корабль-хаб с героем и порталом — hub3d.ts, Бит — bit3d.ts, карта — map.ts, бой — arena.ts.
// Режимы камеры: hub (общий вид), battle (бой на палубе), portal, map, hero.
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { createMap, type MapIsle, type MapLabel } from './map';
import { createArena } from './arena';
import { LOOKS, DEFAULT_LOOK } from './looks';
import { createHub, type CamView } from './hub3d';
import { createBit, type BitMood } from './bit3d';
import { createSkyscape } from './skyscape';
import { createHolo, type Holo } from './holo';
import type { HoloSpec } from './holo_spec';
import { audio } from '../lib/audio';

export type CamMode = 'hub' | 'battle' | 'portal' | 'map' | 'hero';
export type { BitMood, HoloSpec };
/** Реакция героя на объяснение: показать (point), кивнуть (nod), порадоваться верному ответу (cheer), почесать голову при ошибке (scratch). */
export type Emote = 'point' | 'nod' | 'cheer' | 'scratch';

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
  /** «Тірі түсіндіру»: голограмма Бита над островом в режиме battle (src/three/holo.ts). spec из holoSpecFor(); null — погасить. Повтор того же spec ничего не делает. */
  holoShow(spec: HoloSpec | null): void;
  /** Погасить голограмму; instant — сразу и без следа (выход из урока). */
  holoClear(instant?: boolean): void;
  /** Ответ ребёнка на голограмму: верно — вспышка зелёным, ошибка — красный сбой. */
  holoPulse(kind: 'correct' | 'wrong'): void;
  /** Герой реагирует на ход объяснения. Не чаще раза в 2 с (итоги ответов cheer/scratch — чаще 0.8 с); работает только в бою, разовый клип играет только когда герой свободен (arena.emote). */
  heroEmote(kind: Emote): void;
  celebrate(color?: number): void;
  openPortal(): void;
  /** Мастерская: купленные украшения встают на палубу, питомец (id 'pet_…' или null) ходит за героем. Можно звать до загрузки палубы. Каталог: content/ship_items.mjs. */
  setShipDecor(owned: string[], pet: string | null): void;
  /** Праздник нового предмета (украшение или питомец): камера летит к нему, он появляется со вспышкой, камера возвращается. Работает в режимах hub и hero. */
  showDecor(id: string): Promise<void>;
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
  /** Ушли с карты посреди перелёта/катсцены: вернуть корабль к текущему миру, завершить ожидающие промисы. */
  mapAbort(): void;
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

  // ---------- Корабль-хаб ---------- (src/three/hub3d.ts): палуба, портал, герой, частицы; Бит — bit3d.ts
  const hub = createHub(scene, { quality, km, bitMood: m => bit.setMood(m), onCutscene: () => { userTheta = userPhi = 0; } });
  const bit = createBit(scene);

  // ---------- Острова и облака ---------- (src/three/skyscape.ts)
  const sky = createSkyscape({ quality }); scene.add(sky.g);
  let themeTo: THREE.Vector3[] | null = null; const fogTo = new THREE.Color(0x17104a), worldFog = new THREE.Color(0x17104a), tmpC = new THREE.Color();

  // ---------- 3D-карта миров (своя сцена) ----------
  const map = createMap({ skyMat, starGeo, starMat, km });
  const arena = createArena({ skyMat, starGeo, starMat, km, shadows: quality === 'high', sfx: n => audio.play(n) });
  // голограмма Бита и реакции героя на объяснения: создаются при первом показе (в хабе и на карте не стоят ни памяти, ни кадра)
  let holo: Holo | null = null;
  const holoOn = () => (holo ??= createHolo({ scene: arena.scene, camera: arena.camera, quality, km, sfx: (n, rate = 1) => audio.play(n, { rate }) }));
  const heroV = new THREE.Vector3();
  const EMOTE_CLIPS: Record<Emote, [string, number][]> = { point: [['Interact', 1.5], ['Use_Item', 1.7]], nod: [['Interact', 2]], cheer: [['Cheering', 1.15]], scratch: [['Idle_B', 1]] };
  let emoteAt = -1e9, resultAt = -1e9, emoteN = 0;

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
  // позы hub / portal / hero принадлежат кораблю (hub.views, хаб сам уточняет цели после загрузки палубы); бой — арена
  const CAM: Record<Exclude<CamMode, 'map'>, CamView> = {
    ...hub.views,
    battle: { target: new THREE.Vector3(0.2, 1.2, 0.6), radius: 11, phi: 1.12, theta: 1.62 },
  };
  let mode: CamMode = 'hub', devLock = false;
  const cam = { target: CAM.hub.target.clone(), radius: CAM.hub.radius, phi: CAM.hub.phi, theta: CAM.hub.theta };
  let dragging = false, lastX = 0, lastY = 0, idle = 0, userTheta = 0, userPhi = 0, shakeT = 0;
  let downX = 0, downY = 0;
  const onDown = (e: PointerEvent) => { dragging = true; lastX = downX = e.clientX; lastY = downY = e.clientY; };
  const onMove = (e: PointerEvent) => { if (!dragging) return; if (mode === 'battle') return; if (mode === 'map') { map.drag(e.clientX - lastX, e.clientY - lastY); lastX = e.clientX; lastY = e.clientY; return; } userTheta -= (e.clientX - lastX) * 0.006; userPhi = Math.max(-0.5, Math.min(0.35, userPhi - (e.clientY - lastY) * 0.004)); lastX = e.clientX; lastY = e.clientY; idle = 0; };
  const onUp = (e: PointerEvent) => {
    // короткое касание без движения: на карте — выбор острова, в главном меню — герой идёт на палубу или машет (просьба ребёнка 30.09)
    if (dragging && Math.hypot(e.clientX - downX, e.clientY - downY) < 8) {
      const r = canvas.getBoundingClientRect(), x = ((e.clientX - r.left) / r.width) * 2 - 1, y = -((e.clientY - r.top) / r.height) * 2 + 1;
      if (mode === 'map') map.click(x, y);
      else hub.tap(new THREE.Vector2(x, y), camera);                       // хаб сам проверит, что режим hub и нет катсцены
    }
    dragging = false;
  };
  const onWheel = (e: WheelEvent) => { if (mode === 'map') { e.preventDefault(); map.wheel(e.deltaY); } };
  canvas.addEventListener('wheel', onWheel, { passive: false });
  canvas.addEventListener('pointerdown', onDown); window.addEventListener('pointermove', onMove); window.addEventListener('pointerup', onUp);

  function resize() {
    const w = canvas.clientWidth || innerWidth, h = canvas.clientHeight || innerHeight;
    renderer.setSize(w, h, false); composer?.setSize(w, h);
    camera.aspect = w / h; camera.updateProjectionMatrix(); map.resize(w, h); arena.resize(w, h);
    const narrow = w / h < 0.8;
    const side = isSide(w, h);
    if (!devLock) CAM.hub.radius = narrow ? 26 : side ? 21 : w / h < 1.5 ? 18 : 22;   // почти квадратное окно (телефон лёжа, панель справа) — ближе
    CAM.portal.radius = narrow ? 13 : 10; CAM.battle.radius = narrow ? 23 : side ? 14 : 13;
    CAM.hero.radius = narrow ? 10.5 : 7.5;                               // витрина: герой целиком, со шлемом и оружием (скины)
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
  const tmp = new THREE.Vector3();
  function frame() {
    const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;
    skyMat.uniforms.t.value = t;
    if (themeTo) { const u = skyMat.uniforms, k = Math.min(1, dt * 1.5); (['cTop', 'cMid', 'cLow', 'cAur'] as const).forEach((n, i) => u[n].value.lerp(themeTo![i], k)); worldFog.lerp(fogTo, k); }
    // у корабля туман — цвет низа неба: дальние облака и острова тают в небе, а не темнеют пятнами (туман мира — для боя и карты)
    { const u = skyMat.uniforms; (scene.fog as THREE.Fog).color.setRGB(u.cLow.value.x, u.cLow.value.y, u.cLow.value.z).lerp(tmpC.setRGB(u.cMid.value.x, u.cMid.value.y, u.cMid.value.z), 0.3);
      if (!composer) (scene.fog as THREE.Fog).color.convertSRGBToLinear(); }   // без постобработки небо выводится как есть (sRGB), туман — через перевод цвета
    starMat.opacity = 0.75 + Math.sin(t * 1.3) * 0.15;
    rifts.forEach((r, i) => { (r.material as THREE.MeshBasicMaterial).opacity = 0.35 + Math.abs(Math.sin(t * (2 + i) + i)) * 0.5 * (Math.random() > 0.97 ? 0.2 : 1); r.position.x += Math.random() > 0.98 ? (Math.random() - 0.5) * 0.6 : 0; });

    sky.update(dt, t, km, (scene.fog as THREE.Fog).color);
    hub.update(dt, t);                                                      // корабль, портал, герой, частицы
    hub.heroWorldPos(tmp); if (hub.inCutscene) tmp.y += 2.2;                      // в катсцене портала Бит поднимается над кадром и не заслоняет вихрь
    bit.update(dt, t, tmp, cam.theta, camera.position);   // Бит летит за героем и смотрит на камеру прошлого кадра

    // камера плавно к режиму
    const C = mode === 'battle' ? CAM.battle : hub.viewFor(mode);
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
      holo?.update(dt, t, { screenH: canvas.clientHeight || innerHeight, hero: arena.heroPos(heroV) });
      arena.hpVeil(holo?.level ?? 0);                                        // полоска здоровья врага под голограммой гаснет
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


  return {
    setEnergy(v, max) { hub.setEnergy(v, max); },
    setMode(m) {
      if (mode === 'map' && m !== 'map') map.abort();                   // ушли с карты: перелёт и катсцены не зависают
      if (m !== 'battle') holo?.reset();                                // голограмма живёт только в бою
      hub.enterMode(m);                                                 // герой возвращается на место / вылетает из портала после боя
      mode = m; userTheta = 0; userPhi = 0; const narrow = (canvas.clientWidth || innerWidth) / (canvas.clientHeight || innerHeight) < 0.8; viewShift = m === 'hub' ? (narrow ? 0.2 : 0.08) : narrow ? 0.24 : 0.12; applyOffset(); },
    heroWalk(x, z) { return hub.heroWalk(x, z); },
    heroAttack(crit = false, sup = false) { return arena.attack({ crit, sup, dmg: sup ? 2 : 1 }); },
    spawnMob(hp, kind = 0, boss = false, worldBoss = false) { return arena.spawn(hp, kind, boss && !worldBoss, worldBoss); },
    enemyAttack() { return arena.enemyAttack(); },
    arrive() { return arena.arrive(); },
    setArena(k, a, b) { arena.theme(k, a, b); },
    setSpot(seed) { return arena.spot(seed); },
    setStyle(c, trail) { arena.setCape(c); hub.setCape(c); map.setCape(c); arena.setTrail(trail); },
    hitMob() {},
    killMob() { return arena.defeat(); },
    clearMob() { arena.clear(); },
    openChest() { return arena.victory(); },
    portalWalk() { return hub.portalWalk(); },
    bitMood(m) { bit.setMood(m); holo?.mood(m); },
    holoShow(spec) { if (mode !== 'battle') return; if (spec) holoOn().show(spec); else holo?.hide(); },
    holoClear(instant = false) { if (instant) holo?.reset(); else holo?.hide(); },
    holoPulse(kind) { holo?.pulse(kind); },
    heroEmote(kind) {
      if (mode !== 'battle') return;
      const now = performance.now(), result = kind === 'cheer' || kind === 'scratch';
      if (result ? now - resultAt < 800 : now - emoteAt < 2000) return;
      const [clip, speed] = EMOTE_CLIPS[kind][emoteN++ % EMOTE_CLIPS[kind].length];
      void arena.emote(clip, speed);
      emoteAt = now; if (result) resultAt = now;
    },
    setShipDecor(owned, pet) { hub.setShipDecor(owned, pet); },
    showDecor(id) { return hub.showDecor(id); },
    celebrate(color = 0x3ff0ff) { if (mode === 'battle') { arena.celebrate(); return; } hub.celebrate(color); },
    openPortal() { hub.openPortal(); },
    setTheme(sky, fog) { themeTo = sky.map(c => new THREE.Vector3(c[0], c[1], c[2])); fogTo.setHex(fog); },
    setFrame(top, height) { frameWin.top = top; frameWin.h = height; applyOffset(); },
    setOutfit(_jacket, _dark, _visor, id = 'cyan') { const look = LOOKS[id] ?? DEFAULT_LOOK; arena.setLook(look); hub.setLook(look); map.setLook(look); },
    mapSetup(isles, current) { map.setup(isles, current); },
    mapFocus(i) { map.focus(i); },
    mapTravel(i) { return map.travel(i); },
    mapAbort() { map.abort(); },
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
      holo?.dispose(); hub.dispose(); arena.dispose(); renderer.dispose(); composer?.dispose();
    },
  };
}
