// Боевая локация (docs/GAME_LOOP.md 3): остров текущего мира, герой слева, враг справа. Бой пошаговый:
// верный ответ — герой бежит и бьёт (цифра урона, вспышка, отлёт, тряска), серия 3 — суперудар с замедлением;
// неверный — враг стреляет, герой ставит щит (урона нет). Враг повержен — распад на кубики и монеты.
// Герой и враги — готовые модели с настоящими анимациями (src/three/actor.ts), остров — плитки KayKit (island3d.ts).
// Все действия — промисы, чтобы экран задачи ждал конца анимации и только потом показывал следующий вопрос.
// Катсцены (вход, появление врага, победа с сундуком) ведёт «режиссёр»: план камеры shot() + постановка движений героя.
import * as THREE from 'three';
import { Actor, createHero, createMonster, dress, HERO_HEIGHT } from './actor';
import { Kit } from './assets';
import { createPortal, type Portal } from './portal';
import { buildIsland, loadIslandKits } from './island3d';
import { DEFAULT_LOOK, type HeroLook } from './looks';
import { pickEnemy } from './roster';
import { spotLight, spotIndex } from './spots';
import { createVfx } from './vfx';
import { createAttacks, prepareEnemy, HERO_X, ENEMY_X, Z0, type Body } from './attacks';
import { createIdleLife } from './idle_life';
import { createTrainHero } from './train_hero';
import { createShots, pickShot, SHOT_CLIPS, type ShotKind } from './shots';
import { createTraining, type Training, type HitKind } from './training3d';
import type { Sfx } from '../lib/audio';

interface Deps { skyMat: THREE.Material; starGeo: THREE.BufferGeometry; starMat: THREE.Material; km: number; shadows: boolean; sfx?: (n: Sfx) => void; /** Случайность выбора удара на расстоянии (в тестах подменяется). */ rnd?: () => number }

const box = new THREE.BoxGeometry(1, 1, 1);
const SWING = new THREE.Vector3();   // направление взмаха для vfx.slash (переиспользуется)
/** Момент касания в клипе (доля 0..1) — по нему считается удар. */
const HIT_AT: Record<string, number> = { Melee_1H_Attack_Slice_Diagonal: 0.42, Melee_1H_Attack_Chop: 0.45, Melee_2H_Attack_Spinning: 0.5, Melee_1H_Attack_Jump_Chop: 0.55, Melee_1H_Attack_Stab: 0.4, Melee_1H_Attack_Slice_Horizontal: 0.42 };
/** Приём темы (content/techniques.mjs) для удара в бою: цвет, вид удара, название над героем. Только красота, урон и тайминги те же. */
export interface Technique { color: number; fx: 'arc' | 'pierce' | 'split' | 'multi' | 'spin'; kz: string }

export function createArena(d: Deps) {
  const sfx = (n: Sfx) => d.sfx?.(n);
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x17104a, 30, 90);
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 400);
  const sky = new THREE.Mesh(new THREE.SphereGeometry(150, 32, 16), d.skyMat); scene.add(sky);
  scene.add(new THREE.Points(d.starGeo, d.starMat));
  const hemi = new THREE.HemisphereLight(0xb4c4ff, 0x40214a, 1.05); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffe6c8, 1.7); sun.position.set(-8, 16, 10); scene.add(sun);
  if (d.shadows) {
    sun.castShadow = true; sun.shadow.mapSize.set(1536, 1536); sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.03;
    Object.assign(sun.shadow.camera, { left: -13, right: 13, top: 13, bottom: -13, near: 1, far: 60 });
  }
  // материалы кубиков-осколков общие по цвету и яркости: не плодим по одному на частицу
  const matCache = new Map<string, THREE.MeshBasicMaterial>();
  const mat = (c: number, e = 0, ei = 1) => {
    const k = c + ':' + Math.min(ei, 2.4); let m = matCache.get(k);
    if (!m) { m = new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(0.5 + Math.min(ei, 2.4) * 0.4) }); matCache.set(k, m); }
    return m;
  };
  /** Убрать разовый объект эффекта вместе с его геометрией и материалом (иначе буферы видеопамяти копятся с каждым эффектом). */
  const drop = (m: THREE.Mesh) => { scene.remove(m); m.geometry.dispose(); (m.material as THREE.Material).dispose(); };

  // ---------- остров ----------
  const ground = new THREE.Group(); scene.add(ground);
  let worldK = 0, colA = 0x5ce39c, spotV = 0;
  const lanterns = [new THREE.PointLight(0xffb84a, 0, 9), new THREE.PointLight(0xffb84a, 0, 9)];
  lanterns[0].position.set(-5, 2, 1.5); lanterns[1].position.set(5, 2, 1.5); lanterns.forEach(l => scene.add(l));
  let groundP: Promise<void> = Promise.resolve(), groundToken = 0, groundDirty = true;
  /** Остров собираем только когда он нужен (бой), а не при запуске: наборы миров загружаются по требованию. */
  function buildGround() {
    groundDirty = false;
    const my = ++groundToken;
    const wk = worldK, a = colA, v = spotV;
    groundP = loadIslandKits(wk).then(k => {
      if (my !== groundToken) return;
      while (ground.children.length) ground.remove(ground.children[0]);
      ground.add(buildIsland(k, wk, a, v));
      const L = spotLight(spotV);
      hemi.color.setHex(L.hemiSky); hemi.groundColor.setHex(L.hemiGround); hemi.intensity = L.hemi * 1.5;
      sun.color.setHex(L.sunColor); sun.intensity = L.sun * 1.35; sun.position.set(...L.sunPos);
      lanterns.forEach(l => (l.intensity = L.lanterns ? 6 : 0));
    });
  }

  // ---------- герой ----------
  let cape: { color: number; glow: boolean } | null = null;
  let hero: Actor | null = null, look: HeroLook = DEFAULT_LOOK, heroP: Promise<void> = Promise.resolve(), weapon: THREE.Object3D | null = null;
  const shield = new THREE.Mesh(new THREE.SphereGeometry(1.7, 20, 14), new THREE.MeshBasicMaterial({ color: 0x35e6ff, transparent: true, opacity: 0, depthWrite: false }));
  shield.position.set(0.3, 1.4, 0);
  function loadHero() {
    const my = look;
    heroP = (async () => {
      const h = await createHero(my.kind);
      await dress(h, { weapon: my.weapon, offhand: my.offhand, hide: my.hide });
      if (my !== look) return;
      if (my.tint) h.tint(my.tint, my.glow);
      h.setCape(cape);
      if (hero) { scene.remove(hero.g); hero.dispose(); train.heroReplaced(); shotGen++; }
      hero = h; scene.add(h.g); h.g.add(shield);
      // клипы выстрелов, лук и шар прогреваются заранее: первый выстрел в бою не подтормаживает (вес клипа после прогрева остаётся 1)
      h.prime(SHOT_CLIPS); shots.warm(new THREE.Vector3(HERO_X, 1.2, Z0 + 0.5), () => hero === h);
      h.g.position.set(HERO_X, 0, Z0); h.g.rotation.y = Math.PI / 2;
      weapon = h.bone('handslot.r')?.children.find(c => c.userData.gear) ?? null;
    })();
  }
  loadHero();
  const H = () => hero!;

  // ---------- враг ----------
  type Enemy = Body & { hp: number; max: number; base: number; live: boolean };
  let enemy: Enemy | null = null;
  // полоска здоровья: одна плоскость с картинкой (рамка, заливка, деления по числу ударов, число) — перерисовывается только когда здоровье меняется
  const hpCv = document.createElement('canvas'); hpCv.width = 512; hpCv.height = 112;
  const hpCtx = hpCv.getContext('2d')!, hpTex = new THREE.CanvasTexture(hpCv); hpTex.anisotropy = 4;
  const hpBar = new THREE.Mesh(new THREE.PlaneGeometry(2.7, 0.59), new THREE.MeshBasicMaterial({ map: hpTex, transparent: true, depthTest: false, depthWrite: false, toneMapped: false }));
  hpBar.renderOrder = 5; hpBar.visible = false; scene.add(hpBar);
  let hpKey = '';
  function drawHp(hp: number, max: number) {
    const key = hp + '/' + max; if (key === hpKey) return; hpKey = key;
    const c = hpCtx, x = 8, y = 16, w = 496, h = 80, r = h / 2, f = Math.max(0, Math.min(1, hp / max));
    const pill = (px: number, pw: number) => { c.beginPath(); c.roundRect(px, y, pw, h, r); };
    c.clearRect(0, 0, 512, 112);
    c.lineWidth = 12; c.strokeStyle = '#0b0d2a'; pill(x, w); c.stroke();
    c.fillStyle = '#1c2159'; pill(x, w); c.fill();
    if (f > 0) {
      c.save(); pill(x, w); c.clip();
      const g = c.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, '#ff9ee0'); g.addColorStop(0.5, '#ff4fb8'); g.addColorStop(1, '#d81f8f');
      c.fillStyle = g; c.fillRect(x, y, w * f, h);
      c.fillStyle = 'rgba(255,255,255,0.35)'; c.fillRect(x, y + 6, w * f, 10);   // блик сверху
      c.restore();
    }
    if (max > 1 && max <= 12) { c.fillStyle = '#0b0d2a'; for (let i = 1; i < max; i++) c.fillRect(x + (w * i) / max - 2.5, y, 5, h); }
    c.lineWidth = 6; c.strokeStyle = 'rgba(255,255,255,0.55)'; pill(x, w); c.stroke();
    c.font = '900 58px Rubik, system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineJoin = 'round';
    // число — в тёмном кружке у левого края: на розовой заливке белая цифра не читалась
    c.beginPath(); c.arc(x + r, y + h / 2, r + 4, 0, Math.PI * 2); c.fillStyle = '#0b0d2a'; c.fill();
    c.lineWidth = 5; c.strokeStyle = '#ff9ee0'; c.stroke();
    // число вписываем в кружок: трёхзначное при шрифте 58 px вылезало за рамку
    const txt = String(hp); let fs = 58; c.font = `900 ${fs}px Rubik, system-ui, sans-serif`;
    const tw = c.measureText(txt).width; if (tw > 66) { fs = Math.max(20, Math.floor((fs * 66) / tw)); c.font = `900 ${fs}px Rubik, system-ui, sans-serif`; }
    c.fillStyle = '#ffffff'; c.fillText(txt, x + r, y + h / 2 + 3);
    hpTex.needsUpdate = true;
  }

  // ---------- эффекты ----------
  type Fx = { update: (dt: number) => boolean };
  const fx: Fx[] = [];
  /** Частицы-спрайты из атласа (искры, взмахи, дым): src/three/vfx.ts. Кубики ниже — крупные «осколки» и монеты. */
  const vfx = createVfx(scene, camera, { km: d.km, high: d.shadows });
  // выстрелы героя (лук, бросок, магия): общий код боя и тренировки, shots.ts; shotGen меняется при уходе с экрана и обрывает всё, что в полёте
  let shotGen = 0;
  const shots = createShots({ scene, vfx, sfx, fx: u => { fx.push({ update: u }); } });
  const V = new THREE.Vector3();
  function burst(pos: THREE.Vector3, colors: number[], n = 30, speed = 5, size = 0.18) {
    const parts = Array.from({ length: n }, (_, i) => {
      const m = new THREE.Mesh(box, mat(colors[i % colors.length], colors[i % colors.length], 1.6));
      m.scale.setScalar(size * (0.5 + Math.random())); m.position.copy(pos); scene.add(m);
      return { m, v: new THREE.Vector3((Math.random() - 0.5) * speed, Math.random() * speed * 0.9 + 1, (Math.random() - 0.5) * speed) };
    });
    let life = 1.1;
    fx.push({ update: dt => { life -= dt; parts.forEach(p => { p.v.y -= dt * 9; p.m.position.addScaledVector(p.v, dt); p.m.rotation.x += dt * 6; p.m.scale.multiplyScalar(0.975); });
      if (life <= 0) { parts.forEach(p => scene.remove(p.m)); return false; } return true; } });
  }
  let ringGeo: THREE.TorusGeometry | null = null;   // одна на все кольца (масштабируется), не пересоздаётся
  function ring(pos: THREE.Vector3, color: number, max = 5) {
    const m = new THREE.Mesh(ringGeo ??= new THREE.TorusGeometry(1, 0.08, 6, 40), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 }));
    m.rotation.x = Math.PI / 2; m.position.copy(pos); scene.add(m);
    let t = 0;
    fx.push({ update: dt => { t += dt * 2.2; m.scale.setScalar(0.3 + t * max); (m.material as THREE.MeshBasicMaterial).opacity = 0.9 * (1 - t); if (t >= 1) { scene.remove(m); (m.material as THREE.Material).dispose(); return false; } return true; } });
  }
  /** Всплывающий текст над объектом: цифра урона, «БЛОК!», «КРИТ!». Выскакивает с пружиной, контур двойной, лёгкий наклон и дрейф. */
  function popText(text: string, pos: THREE.Vector3, color = '#ffffff', big = false) {
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 256;
    const c = cv.getContext('2d')!;
    let fs = big ? 140 : 118;
    c.font = `900 ${fs}px Rubik, system-ui, sans-serif`;
    const tw = c.measureText(text).width; if (tw > 430) { fs *= 430 / tw; c.font = `900 ${fs}px Rubik, system-ui, sans-serif`; }
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineJoin = 'round';   // длинная надпись уже влезла по ширине
    c.lineWidth = 34; c.strokeStyle = '#0b0d2a'; c.strokeText(text, 256, 134);   // тёмная «тень-обводка» снизу
    c.lineWidth = 26; c.strokeStyle = '#0b0d2a'; c.strokeText(text, 256, 128);
    const g = c.createLinearGradient(0, 128 - fs * 0.5, 0, 128 + fs * 0.5); g.addColorStop(0, '#f4f7ff'); g.addColorStop(0.4, color); g.addColorStop(1, color);
    c.fillStyle = g; c.fillText(text, 256, 128);
    const map = new THREE.CanvasTexture(cv); map.anisotropy = 4;
    const pm = new THREE.SpriteMaterial({ map, depthTest: false, transparent: true, color: 0xd6d6d6, toneMapped: false });   // чуть темнее: иначе бликует пост-обработка
    const sp = new THREE.Sprite(pm), W = (big ? 4.2 : 3.2) * uiK, Hh = W / 2;
    sp.scale.set(0.01, 0.01, 1); sp.position.copy(pos); sp.renderOrder = 10; scene.add(sp);
    const tilt = (Math.random() - 0.5) * (big ? 0.3 : 0.2), dx = (Math.random() - 0.5) * 0.8;
    let t = 0;
    fx.push({ update: dt => {
      t += dt; sp.position.y += dt * Math.max(0.2, 2.2 - t * 2.6); sp.position.x += dx * dt; pm.rotation = tilt * Math.max(0, 1 - t * 2.5);
      // пружина: 0 → 1.45 за 0.1 с, откат к 1 (перерегулирование), потом плавное уменьшение
      const s = t < 0.1 ? (t / 0.1) * 1.45 : t < 0.32 ? 1.45 - 0.45 * easeBack((t - 0.1) / 0.22) : 1 - Math.max(0, t - 0.8) * 0.5;
      sp.scale.set(W * s, Hh * s, 1); pm.opacity = t > 0.85 ? Math.max(0, 1 - (t - 0.85) / 0.35) : 1;
      if (t > 1.2) { scene.remove(sp); map.dispose(); pm.dispose(); return false; } return true; } });
  }
  // ---------- анимации (твины) ----------
  type Tw = { t: number; dur: number; step: (u: number) => void; res: () => void; stop?: () => boolean };
  const tweens: Tw[] = [];
  const ease = (u: number) => 1 - Math.pow(1 - u, 3);
  function tween(dur: number, step: (u: number) => void, stop?: () => boolean) { return new Promise<void>(res => tweens.push({ t: 0, dur, step, res, stop })); }
  const wait = (s: number) => tween(s, () => {});
  const easeBack = (u: number) => 1 + 2.2 * Math.pow(u - 1, 3) + 1.2 * Math.pow(u - 1, 2);
  let shake = 0, slow = 1, slowT = 0, flashT = 0;
  let guard = false, shieldPulse = 0;
  // след от оружия (награда за звёзды): светящиеся кубики с кончика клинка, пока идёт удар
  // trailOne — цвет приёма на один удар: выбранный ребёнком след (trail) не трогаем
  let trail: number[] | null = null, trailOn = false, trailK = 0, trailOne: number[] | null = null;
  const tip = new THREE.Vector3();
  function trailStep() {
    const tc = trailOne ?? trail;
    if (!tc || !trailOn || !weapon) return;
    weapon.localToWorld(tip.set(0, 0.9, 0));
    const m = new THREE.Mesh(box, mat(tc[trailK++ % tc.length], tc[trailK % tc.length], 2.2)); m.scale.setScalar(0.22); m.position.copy(tip); scene.add(m);
    let life = 0.35;
    fx.push({ update: dt => { life -= dt; m.scale.multiplyScalar(0.9); if (life <= 0) { scene.remove(m); return false; } return true; } });
  }

  // ---------- режиссёр: план камеры ----------
  type Shot = { focus: THREE.Vector3; zoom: number; lift: number };
  const WIDE: Shot = { focus: new THREE.Vector3(0.1, 1.4, 0), zoom: 1, lift: 0.28 };
  const EVENT_FOCUS = new THREE.Vector3(0.1, 1.5, 0);
  let shotTo = WIDE;
  const camFocus = WIDE.focus.clone(); let camZoom = 1, camLift = 0.28;
  /** Сменить план: точка интереса, приближение (<1 — ближе), высота камеры. null — общий план боя. */
  function shot(focus: THREE.Vector3 | null, zoom = 1, lift = 0.28) { shotTo = focus ? { focus: focus.clone(), zoom, lift } : WIDE; }
  const heroAt = (dy = 1.3) => H().g.position.clone().add(new THREE.Vector3(0, dy, 0));

  /** Обод и подсветка врага: у краёв мягкий розовый свет, в целом чуть светлее, чтобы тёмный монстр не сливался с травой (мультяшность сохраняется). */
  function rimLight(a: Actor) {
    for (const m of a.ownMaterials()) {
      m.onBeforeCompile = sh => { sh.fragmentShader = sh.fragmentShader.replace('#include <opaque_fragment>',
        `float rim = pow(1.0 - clamp(dot(normalize(vNormal), normalize(vViewPosition)), 0.0, 1.0), 3.2);
         outgoingLight = outgoingLight * 1.35 + diffuseColor.rgb * 0.22 + vec3(1.0, 0.35, 0.78) * rim * 0.95;
         #include <opaque_fragment>`); };
      m.customProgramCacheKey = () => 'enemyRim'; m.needsUpdate = true;
    }
  }
  /** Стойка героя: без боя — дыхание, при ожидании атаки врага — щит. */
  function stance() { if (!hero) return; hero.loop(guard ? 'Melee_Blocking' : 'Idle_A', 0.2); }
  function neutral() { if (!hero) return; hero.g.position.y = 0; hero.g.scale.setScalar(1); stance(); }
  const faceAngle = (x: number, z: number) => Math.atan2(x - H().g.position.x, z - H().g.position.z);
  async function walkTo(x: number, z: number, dur: number, run = false, stop?: () => boolean) {
    const h = H(), x0 = h.g.position.x, z0 = h.g.position.z;
    // «уменьшить движение» на тренировке: к манекену, к доске и домой шагом (Walking_A), а не бегом
    if (run && d.km < 1 && training) { run = false; dur = Math.max(dur, Math.hypot(x - x0, z - z0) / 3.4); }
    // жест или поза (радость, сидение) обрываются сразу: меч и щит появляются с первым шагом, а не через долю секунды
    h.settle();
    h.g.rotation.y = faceAngle(x, z); h.loop(run ? 'Running_A' : 'Walking_A', 0.12, run ? 1.25 : 1);
    await tween(dur, u => { const k = ease(u); h.g.position.x = x0 + (x - x0) * k; h.g.position.z = z0 + (z - z0) * k; }, stop);
    h.loop('Idle_A', 0.12);
  }
  async function runTo(x: number, dur: number) { await walkTo(x, Z0, dur, true); H().g.rotation.y = Math.PI / 2; }
  /** Приземление: сплющивание + пыль. */
  async function land(big = false) {
    const h = H(), p = h.g.position.clone(); vfx.dust(p.setY(0), big ? 1.4 : 0.9); burst(p.clone().setY(0.3), [0xd8d0ff, 0xffffff], big ? 8 : 4, 3, 0.12);
    await tween(0.16, u => { const s = Math.sin(u * Math.PI); h.g.scale.set(1 + s * 0.15, 1 - s * 0.2, 1 + s * 0.15); });
    h.g.scale.setScalar(1);
  }
  /** Прыжок по дуге в точку (x, z) с высотой h. */
  async function jumpTo(x: number, z: number, hgt: number, dur: number, y0 = H().g.position.y) {
    const h = H(), x0 = h.g.position.x, z0 = h.g.position.z;
    if (Math.abs(x - x0) + Math.abs(z - z0) > 0.1) h.g.rotation.y = faceAngle(x, z);
    await tween(dur, u => { h.g.position.set(x0 + (x - x0) * u, y0 * (1 - u) + Math.sin(u * Math.PI) * hgt, z0 + (z - z0) * u); });
    h.g.position.y = 0;
  }
  const enemyPos = () => new THREE.Vector3(enemy ? enemy.m.a.g.position.x : ENEMY_X, (enemy?.top ?? 2.6) * 0.5, Z0);

  // Удар по щиту: 0 — держит, 1 — следующий удар пробьёт (ошибка при уверенности), 2 — уже пробит (остальные попадания залпа — только искры)
  let brk: 0 | 1 | 2 = 0, blockText = true, onContact: (() => void) | null = null;
  const shardMat = [0x7ff0ff, 0xffffff, 0x35e6ff].map(c => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.92, depthWrite: false }));
  /** Осколки щита: плоские стёклышки разлетаются от руки героя, крутятся, падают и тают. */
  function shatter(at: THREE.Vector3, n = 24) {
    const parts = Array.from({ length: n }, (_, i) => {
      const m = new THREE.Mesh(box, shardMat[i % 3]), s = 0.2 + Math.random() * 0.32;
      m.scale.set(s, s * (0.6 + Math.random() * 0.9), 0.05); m.position.copy(at); m.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6); scene.add(m);
      const a = Math.random() * Math.PI * 2, sp = 2.5 + Math.random() * 4;
      return { m, v: new THREE.Vector3(Math.cos(a) * sp * 0.7 - 1.2, 2 + Math.random() * 4.5, Math.abs(Math.sin(a)) * sp + 0.8), w: new THREE.Vector3(Math.random() * 12 - 6, Math.random() * 12 - 6, Math.random() * 12 - 6) };
    });
    let life = 1.3;
    fx.push({ update: dt => {
      life -= dt;
      for (const p of parts) { p.v.y -= dt * 10; p.m.position.addScaledVector(p.v, dt); p.m.rotation.x += p.w.x * dt; p.m.rotation.y += p.w.y * dt; p.m.rotation.z += p.w.z * dt; if (life < 0.45) p.m.scale.multiplyScalar(0.9); }
      if (life <= 0) { parts.forEach(p => scene.remove(p.m)); return false; } return true;
    } });
  }
  /** Щит разбит: осколки, вспышка, тряска, герой вскрикивает (Hit_B) и отлетает назад, потом возвращается на место. Урона по модели знаний нет, это только картинка. */
  function shieldBreak(o: { at?: THREE.Vector3 }) {
    const h = H();
    const hand = h.bone('handslot.l')?.getWorldPosition(new THREE.Vector3()) ?? new THREE.Vector3(HERO_X + 0.6, 1.3, Z0 + 0.3);
    shatter(hand.clone().add(new THREE.Vector3(0.3, 0.1, 0.6)));
    burst(hand, [0x35e6ff, 0xffffff, 0x7ff0ff], 18, 6, 0.14);
    ring(new THREE.Vector3(HERO_X + 0.3, 0.15, Z0), 0x35e6ff, 4.5);
    vfx.shieldHit(o.at ?? V.set(HERO_X + 1.0, 1.4, Z0 + 0.8), 0xffffff, 0x35e6ff); shieldPulse = 1.1;
    flashT = 0.14; sfx('boom'); sfx('block'); shake = Math.max(shake, 0.8); slow = Math.min(slow, 0.3); slowT = Math.max(slowT, 0.09);
    const hit = h.play('Hit_B', { speed: 1.0 });
    const x0 = h.g.position.x;
    tween(0.55, u => { const k = ease(u); h.g.position.x = x0 - 1.1 * k; h.g.position.y = Math.sin(u * Math.PI) * 0.75; });
    return (async () => { await within(hit, 1.6); await wait(0.1); h.g.position.y = 0; await walkTo(HERO_X, Z0, 0.45); h.g.rotation.y = Math.PI / 2; })();
  }
  /** Щит принял удар: искры, пульс, «ҚАЛҚАН» (text), звук, клип блока героя с отдачей. Урона нет. Промис — конец клипа блока.
   *  Перед экраном «событие на весь экран» щит можно сделать пробиваемым (arena.enemyAttack({ brk: true })): тогда первый же удар разбивает его. */
  function block(o: { at?: THREE.Vector3; c2?: number; power?: number; text?: boolean } = {}): Promise<void> {
    const cb = onContact; onContact = null; cb?.();
    if (brk === 1) { brk = 2; return shieldBreak(o); }
    const h = H(), pw = o.power ?? 1;
    if (brk === 2) { burst(new THREE.Vector3(HERO_X + 0.8, 1.4, Z0), [0x35e6ff, 0xffffff], 5, 3, 0.12); sfx('block'); shake = Math.max(shake, 0.2); return Promise.resolve(); }
    burst(new THREE.Vector3(HERO_X + 0.8, 1.4, Z0), [0x35e6ff, 0xffffff], Math.round(8 * pw), 3, 0.14);
    vfx.shieldHit(o.at ?? V.set(HERO_X + 1.0, 1.4, Z0 + 0.8), 0x35e6ff, o.c2 ?? 0xff4fb8); shieldPulse = 1;
    if (o.text && blockText) popText('ҚАЛҚАН', new THREE.Vector3(HERO_X, HERO_HEIGHT + 1.2, Z0), '#35e6ff');
    sfx('block'); shake = Math.max(shake, 0.2 * pw);
    const back = h.play('Melee_Block_Hit', { speed: 1.9 });
    tween(0.35, u => { h.g.position.x = HERO_X - Math.sin(u * Math.PI) * 0.35 * Math.min(1.5, pw); });
    return back;
  }
  /** Ход врага: стили атак и их эффекты — src/three/attacks.ts, арена даёт им щит, твины, тряску и частицы. */
  const attacks = createAttacks({
    scene, vfx, km: d.km, high: d.shadows, sfx,
    fx: u => { fx.push({ update: u }); }, tween, wait,
    shake: v => { shake = Math.max(shake, v); },
    hitStop: (s, t) => { slow = Math.min(slow, s); slowT = Math.max(slowT, t); },
    burst, ring, guard: on => { guard = on; stance(); }, block,
    tap: (at, c) => { vfx.hitSpark(at, c, 0.4); shieldPulse = Math.max(shieldPulse, 0.5); },
  });

  /** Чем приём отличается от обычного удара (цвет и клип задаёт attack): разрез — две светящиеся половинки расходятся; двойной — второй взмах следом; вихрь — кольцо у героя и у врага. Урон и время боя не трогает. */
  function techniqueFx(t: Technique, at: THREE.Vector3) {
    const c = t.color;
    if (t.fx === 'split') {
      const px = 0.55, py = 1;
      for (const sgn of [-1, 1]) {
        const m = new THREE.Mesh(box, mat(c, c, 2.4)); m.scale.set(1.2, 0.11, 0.11); m.rotation.z = -0.5; m.position.copy(at); scene.add(m);
        let u = 0;
        fx.push({ update: dt => { u += dt / 0.42; m.position.set(at.x + sgn * px * 0.6 * u, at.y + sgn * py * 0.6 * u, at.z); m.scale.set(1.2 * (1 - u * 0.6), 0.11 * (1 - u), 0.11 * (1 - u)); if (u >= 1) { scene.remove(m); return false; } return true; } });
      }
    } else if (t.fx === 'multi') {
      wait(0.12).then(() => { const p2 = at.clone().add(new THREE.Vector3(0.15, -0.25, 0.05)); vfx.slash(p2, SWING.set(1, 0.6, 0), c, 3); vfx.hitSpark(p2, c, 0.7); sfx('slash'); });
    } else if (t.fx === 'spin') {
      ring(new THREE.Vector3(H().g.position.x, 0.15, Z0), c, 3.2); ring(new THREE.Vector3(ENEMY_X - 0.6, 0.15, Z0), c, 2.6);
    }
  }

  let ready = false;
  const lookAtV = new THREE.Vector3(0.1, 1.4, 0);
  let aspect = 1, visAspect = 1, winFrac = 1, screenH = 600, uiK = 1;   // uiK — во сколько раз крупнее подписи и эффекты, когда пикселей на единицу мира мало (телефон); visAspect — форма видимой части сцены (в ландшафте справа колонка), winFrac — доля высоты экрана под окно сцены

  function update(dt: number, t: number) {
    const k = d.km;
    if (slowT > 0) { slowT -= dt; if (slowT <= 0) slow = 1; }
    const sdt = dt * slow;
    for (let i = tweens.length - 1; i >= 0; i--) { const w = tweens[i]; if (w.stop?.()) { tweens.splice(i, 1); w.res(); continue; } w.t += sdt / w.dur; const u = Math.min(1, w.t); w.step(u); if (u >= 1) { tweens.splice(i, 1); w.res(); } }
    for (let i = fx.length - 1; i >= 0; i--) if (!fx[i].update(sdt)) fx.splice(i, 1);
    vfx.update(sdt);

    hero?.update(sdt); trailStep();
    const sm = shield.material as THREE.MeshBasicMaterial;
    sm.opacity += ((guard ? 0.3 : 0) - sm.opacity) * 0.25;
    if (shieldPulse > 0) { shieldPulse = Math.max(0, shieldPulse - dt * 4); sm.opacity += shieldPulse * 0.2; shield.scale.setScalar(1 + shieldPulse * 0.08); } else shield.scale.setScalar(1);

    // враг: анимация, парение летающих, вспышка при ударе
    if (enemy) {
      const e = enemy; e.m.a.update(sdt);
      if (e.m.a.g.scale.x < e.base) e.m.a.g.scale.setScalar(Math.min(e.base, e.m.a.g.scale.x + dt * 3.5 * e.base));
      if (e.live) e.m.a.g.position.y = e.dy + (e.m.hover ? e.m.hover + Math.sin(t * 2.4) * 0.15 * k : 0);   // dy — подъём/прыжок из атаки (attacks.ts)
      e.m.a.flash(flashT > 0 ? Math.min(1, flashT * 12) : 0);
      hpBar.position.set(e.m.a.g.position.x, e.top + 0.3 + 0.25 * uiK, e.m.a.g.position.z + 0.3); hpBar.quaternion.copy(camera.quaternion); drawHp(e.hp, e.max);
    }
    flashT = Math.max(0, flashT - dt);
    idle.update(dt);
    training?.update(sdt, t);

    // камера: оба бойца в центре окна сцены, лёгкое «дыхание»; план меняется плавно (режиссёр — shot())
    const a = 1 - Math.exp(-dt * 5.5);
    camFocus.lerp(shotTo.focus, a); camZoom += (shotTo.zoom - camZoom) * a; camLift += (shotTo.lift - camLift) * a;
    // оба бойца целиком в видимом окне: по ширине видимой части и по высоте окна (на планшете в портрете окно низкое)
    const tanH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)), halfW = 5.4, needH = 4.8;
    const dist = Math.max(10, halfW / (tanH * Math.min(aspect, visAspect)), needH / (2 * tanH * winFrac)) * camZoom;
    uiK = Math.min(1.9, Math.max(1, 60 / (screenH / (2 * tanH * dist)))); vfx.setScale(Math.min(1.5, uiK)); hpBar.scale.setScalar(uiK);
    const sh = shake > 0 && k >= 1 ? (Math.random() - 0.5) * shake : 0; shake = Math.max(0, shake - dt * 1.8);   // «уменьшить движение»: камера не трясётся
    lookAtV.copy(camFocus);
    camera.position.set(lookAtV.x + Math.sin(t * 0.25) * 0.4 * k + sh, lookAtV.y + dist * camLift + sh, lookAtV.z + dist);
    camera.lookAt(lookAtV);
    sky.position.copy(camera.position);
  }

  // действия боя идут строго по очереди: два одновременных удара не перебивают анимации друг друга и не зависают
  let chain: Promise<unknown> = Promise.resolve();
  let arrivePortal: Portal | null = null;
  let busy = 0, emoting = 0;
  // живое ожидание (idle_life.ts): молчит, пока идёт любое действие боя, эмоция урока или щит, и ещё 1.5 с после
  const idle = createIdleLife({
    hero: () => hero, weapon: () => weapon, km: () => d.km,
    mob: () => (enemy?.live ? { a: enemy.m.a, cls: enemy.m.cls } : null),
    quiet: () => busy > 0 || emoting > 0 || guard || !hero || hero.marksPending() || train.posed(),
    training: () => !!training,
  });
  const seq = <T>(fn: () => Promise<T>): Promise<T> => { const p = chain.then(fn, fn); chain = p.catch(() => {}); return p; };
  /** Ждать не дольше s секунд (защита от вечного ожидания момента удара, если анимацию прервали). */
  const within = (p: Promise<unknown>, s: number) => Promise.race([p, new Promise(r => setTimeout(r, s * 1000))]);

  /** Всё нужное для сцены загружено: остров и герой. */
  const whenReady = () => { if (groundDirty) buildGround(); return Promise.all([groundP, heroP]).then(() => {}); };

  // ---------- тренировка (урок): вместо врага площадка с манекеном, мишенями и доской (training3d.ts) ----------
  let training: Training | null = null, trainGen = 0;
  // clear() (уход с экрана) меняет поколение: недоигранное появление врага видит это после каждого ожидания и тихо выходит
  let clearGen = 0;
  let bonkQueued: Promise<void> | null = null, missQueued: Promise<void> | null = null;
  // желаемое состояние площадки: применяется, когда она уже стоит (шаг урока мог войти раньше)
  const tWant = { glitch: false, left: 0, board: '' };
  function dropTraining() { const t = training; training = null; t?.dispose(); }
  const nearDummy = () => !!hero && hero.g.position.x > ENEMY_X - 2.6;
  /** Вернуться на своё место (после ударов «на месте»). */
  async function goHome() {
    const h = hero; if (!h) return;
    const d = Math.hypot(h.g.position.x - HERO_X, h.g.position.z - Z0);
    if (d > 0.3) await walkTo(HERO_X, Z0, Math.max(0.2, Math.min(0.6, d / 9)), true);
    h.g.rotation.y = Math.PI / 2; neutral();
  }
  /** Герой вздрагивает: манекен шлёпнул его по макушке. */
  let flinchN = 0;
  function flinch() {
    const h = hero; if (!h) return;
    shake = Math.max(shake, 0.2); void h.play(flinchN++ % 2 ? 'Hit_A' : 'Hit_B', { speed: 1.2 });
    const x0 = h.g.position.x; tween(0.35, u => { h.g.position.x = x0 - Math.sin(u * Math.PI) * 0.3; });
  }
  /** Удар по манекену: добежать (если ещё не рядом), ударить клипом героя, в момент касания вызвать onHit. stay — остаться у манекена (следующий удар связки). */
  async function trainSwing(clip: string, speed: number, onHit: () => void, stay = false) {
    const h = H(); guard = false;
    if (!nearDummy()) await runTo(ENEMY_X - 1.9, 0.32);
    let done: () => void = () => {};
    const hit = new Promise<void>(r => (done = r));
    const at = HIT_AT[clip] ?? 0.45;
    trailOn = true;
    h.play(clip, { speed, marks: [{ at: 0.12, fn: () => sfx('slash') }, { at, fn: () => { onHit(); done(); } }] });
    // у каждого удара свой ход: выпад вперёд с колющим, прыжок с рубящим сверху
    if (clip === 'Melee_1H_Attack_Stab') { const x0 = h.g.position.x; tween(0.2, u => { h.g.position.x = x0 + 0.8 * ease(u); }); }
    else if (clip === 'Melee_1H_Attack_Jump_Chop') { const dur = h.length(clip, speed) * 0.6; tween(dur, u => { h.g.position.y = Math.sin(u * Math.PI) * 1.1; }).then(() => { h.g.position.y = 0; }); }
    await within(hit, 3); await wait(h.length(clip, speed) * (1 - at) * 0.9);
    trailOn = false; h.g.position.y = 0;
    if (!stay) { await runTo(HERO_X, 0.34); neutral(); }
  }
  /** Первая стоящая мишень (мировая точка): читаем матрицы её InstancedMesh; нет — null. */
  function targetPoint(): THREE.Vector3 | null {
    const tr = training; if (!tr) return null;
    const im = tr.g.children.find(c => (c as THREE.InstancedMesh).isInstancedMesh && (c as THREE.InstancedMesh).count === 5 && !c.userData.outline) as THREE.InstancedMesh | undefined;
    if (!im) return null;
    const m = new THREE.Matrix4(), p = new THREE.Vector3(), q = new THREE.Quaternion(), sc = new THREE.Vector3();
    for (let i = 0; i < 5; i++) { im.getMatrixAt(i, m); m.decompose(p, q, sc); if (sc.x > 0.5 && p.y > -0.87) return p.clone().add(tr.g.position).add(new THREE.Vector3(0.05, 1.05, 0.3)); }
    return null;
  }
  /** Площадка встаёт вместо врага: вырастает из земли, доска и мишени уже такие, как просил шаг урока. */
  async function trainOn(gen: number) {
    await whenReady(); if (gen !== trainGen) return;
    if (enemy) { scene.remove(enemy.m.a.g); enemy.m.a.dispose(); enemy = null; hpBar.visible = false; }
    if (!training) {
      training = createTraining(scene, { quality: d.shadows ? 'high' : 'low', km: d.km, vfx, sfx, hero: () => (hero ? hero.g.position : null), onSlap: flinch });
      training.glitch(tWant.glitch); if (tWant.left > 0) training.targets(Math.min(5, tWant.left)); if (tWant.board) training.board(tWant.board);
    }
    guard = false; stance(); shot(null);
    await training.show(true);
    if (gen === trainGen) train.onArrived();
  }
  async function trainOff(gen: number) {
    const t = training; if (!t || gen !== trainGen) return;
    train.reset();
    await t.show(false);
    if (training === t && gen === trainGen) dropTraining();
  }

  const train = createTrainHero({
    scene, vfx, km: d.km, sfx, shots,
    hero: () => hero, training: () => training,
    fx: u => { fx.push({ update: u }); }, tween,
    burst: (p, c, n, sp, sz) => burst(p, c, n, sp, sz), ring: (p, c, m) => ring(p, c, m),
    shake: v => { shake = Math.max(shake, v); },
    faceAngle, run: (x, z, dur, stop) => walkTo(x, z, dur, true, stop), home: () => goHome(),
    queue: fn => queue(fn), busy: () => busy, targetPoint: () => targetPoint(), knock: t => knock(t),
    block: o => block(o), strike: (clip, speed, onHit, stay) => trainSwing(clip, speed, onHit, stay),
    guard: on => { guard = on; stance(); }, stance: () => neutral(),
  });
  let throwQ = 0;
  /** Действие боя в очереди: пока оно идёт, «живое ожидание» молчит. */
  const queue = <T>(fn: () => Promise<T>): Promise<T> => { busy++; idle.stop(); return seq(() => within(fn(), 12) as Promise<T>).finally(() => busy--); };
  // обычное действие обрывает фон героя (разминку, сидение, отдых): герой сразу на ногах, ребёнка ничто не задерживает
  const act = <T>(fn: () => Promise<T>): Promise<T> => { train.interrupt(); return queue(fn); };
  /** Мишень сбита: когда она упала и ушла в землю, счёт уменьшается и на её место встаёт следующая. */
  function knock(tr: Training) { void tr.targetHit().then(() => { if (training === tr && tWant.left > 0) { tWant.left--; tr.targets(Math.min(5, tWant.left)); } }); }
  // каждый удар на «Болжа» другой, по кругу; связка на «Өзің»: горизонтальный, косой, с разворотом
  const VARIANTS = ['Melee_1H_Attack_Chop', 'Melee_1H_Attack_Slice_Horizontal', 'Melee_1H_Attack_Stab', 'Melee_1H_Attack_Jump_Chop', 'Melee_1H_Attack_Slice_Diagonal'];
  const SPEEDS: Record<string, number> = { Melee_1H_Attack_Stab: 2.15, Melee_1H_Attack_Jump_Chop: 1.3, Melee_1H_Attack_Slice_Horizontal: 1.3 };
  async function runStrike(kind: HitKind, n: number, stay: boolean, variant?: number) {
    await whenReady(); const tr = training; if (!tr) return;
    let clip = variant !== undefined ? VARIANTS[variant % VARIANTS.length] : kind === 'light' ? 'Melee_1H_Attack_Slice_Diagonal' : kind === 'strong' ? 'Melee_1H_Attack_Chop' : n >= 3 ? 'Melee_2H_Attack_Spinning' : n === 2 ? 'Melee_1H_Attack_Slice_Diagonal' : 'Melee_1H_Attack_Slice_Horizontal';
    if (d.km < 1 && clip === 'Melee_1H_Attack_Jump_Chop') clip = 'Melee_1H_Attack_Chop';
    await trainSwing(clip, SPEEDS[clip] ?? 1.35, () => { shake = Math.max(shake, kind === 'light' ? 0.12 : 0.28); slow = Math.min(slow, 0.3); slowT = Math.max(slowT, 0.04); void tr.hit(kind, n); }, stay);
  }
  async function runBonk() { await whenReady(); const tr = training; if (!tr) return; await goHome(); await tr.bonk(); }
  async function runBreak() {
    train.volleys(false);
    await whenReady(); const tr = training; if (!tr) return;
    let bg: Promise<void> = Promise.resolve();
    await trainSwing('Melee_1H_Attack_Stab', 2.15, () => { shake = Math.max(shake, 0.25); bg = tr.breakGlitch(); });
    await bg;
  }
  /** Мишень: выстрел по очереди — лук, бросок, магия (train_hero.ts); промах — снаряд мимо. */
  async function runShot(miss: boolean) {
    await whenReady(); const tr = training; if (!tr) return;
    await goHome();
    await train.shoot(miss, () => knock(tr));
    neutral();
  }
  /** Блок на «Неге?»: манекен бежит и замахивается на героя, герой ставит блок и отвечает ударом щитом. */
  async function runBlock() {
    await whenReady(); const tr = training; if (!tr) return;
    await goHome(); const h = H();
    let counter: Promise<void> = Promise.resolve();
    await tr.bonk({
      block: true,
      onRush: () => { guard = true; stance(); },
      onStrike: () => {
        counter = (async () => {
          await within(block({ text: true }), 1.5); guard = false;
          const x0 = h.g.position.x; tween(0.25, u => { h.g.position.x = x0 + 0.9 * ease(u); });
          await within(h.play('Melee_Block_Attack', { speed: 1.4, marks: [{ at: 0.3, fn: () => { sfx('slash'); shake = Math.max(shake, 0.2); void tr.hit('light'); } }] }), 2);
        })();
      },
    });
    await counter; guard = false; await goHome();
  }
  async function runCheer() {
    await whenReady(); const tr = training; if (!tr) return;
    await goHome(); tr.cheer(); idle.stop(true);
    if (hero && !hero.marksPending()) await hero.play('Cheering');
    neutral();
  }

  /** Удар на расстоянии (док. GAME_LOOP, «атаки героя»): герой остаётся на месте и стреляет по врагу из лука, бросает шар или колдует; меч и щит на время лука прячутся.
   *  Попадание — тот же impact(), что у удара мечом (урон, вспышка, цифра, hitDone/onHit). Выстрел оборван (уход с экрана): снаряд убран, impact не вызывается. */
  async function shootEnemy(want: ShotKind, color: number, impact: () => void, abort: () => void) {
    const h = H(), my = shotGen;
    const { kind, bow } = await shots.prepare(want); if (my !== shotGen) { abort(); return; }
    const ep = enemyPos(), to = new THREE.Vector3(ep.x - 0.35, ep.y, ep.z + 0.15);
    h.g.rotation.y = faceAngle(to.x, to.z);
    await shots.fire(h, { kind, bow, to, color, k: 1.25, stick: 0.12, onLand: () => { if (my === shotGen) impact(); else abort(); }, onCancel: abort },
      { alive: () => my === shotGen, wait: p => p, within: (p, s) => within(p, s), pause: s => wait(s) });
    if (my !== shotGen) { abort(); return; }
    h.carry([]); h.g.rotation.y = Math.PI / 2;
  }
  const shotHist: (ShotKind | null)[] = []; let shotCyc = 0;
  const rnd = d.rnd ?? (() => Math.random());

  const api = {
    scene, camera, update,
    theme(k: number, a: string, b: string) { worldK = k; colA = new THREE.Color(a).getHex(); void b; groundDirty = true; ready = true; },
    /** Уголок мира по теме: одна тема — всегда один и тот же уголок. Возвращает номер варианта. */
    spot(seed: string) { const v = spotIndex(seed); if (v !== spotV) { spotV = v; groundDirty = true; } return v; },
    /** Костюм героя (какой из шести героев, оружие, оттенок). */
    setLook(l: HeroLook) { if (l === look) return; look = l; loadHero(); },
    isReady: () => ready,
    setFog(c: THREE.Color) { (scene.fog as THREE.Fog).color.copy(c); },
    resize(w: number, h: number) { aspect = w / h; screenH = h; camera.aspect = aspect; camera.updateProjectionMatrix(); },
    frame(offsetX: number, offsetY: number, w: number, h: number, win = 1) {
      screenH = h;
      visAspect = offsetX ? Math.max(0.3, (w - 2 * offsetX) / h) : aspect; winFrac = Math.max(0.15, win);
      if (offsetX || offsetY) camera.setViewOffset(w, h, offsetX, offsetY, w, h); else camera.clearViewOffset(); camera.updateProjectionMatrix(); },

    /** Катсцена входа: портал в воздухе → герой вылетает, приземляется, осматривается. */
    async arrive() {
      await whenReady(); const h = H();
      neutral(); guard = false;
      const P = new THREE.Vector3(HERO_X - 2.2, 2.6, Z0);
      // облёт: общий план уголка сверху, камера опускается к порталу
      h.g.scale.setScalar(0.01);
      camFocus.set(0.4, 0.8, -1.5); camZoom = 1.5; camLift = 0.75; shot(new THREE.Vector3(0.2, 1, -1), 1.2, 0.5);
      await wait(0.9);
      shot(new THREE.Vector3(HERO_X - 0.8, 1.8, Z0), 0.62, 0.3);
      // тот же портал, что на корабле (src/three/portal.ts), без основания — открывается в воздухе
      // один на всю игру: создаётся при первом прибытии и дальше переиспользуется (иначе шейдеры собираются заново — рывок кадра)
      const pf = (arrivePortal ??= createPortal({ radius: 1.05, base: false, light: 0.4 })), portal = pf.g; let open = true, pt = 0;
      portal.position.copy(P); portal.rotation.y = 0.35; portal.scale.setScalar(0.01); scene.add(portal); pf.setPower(0.8);
      fx.push({ update: (dt: number) => { pt += dt; pf.update(dt, pt); return open; } });
      h.g.position.copy(P); h.g.rotation.y = Math.PI / 2;
      await tween(0.35, u => portal.scale.setScalar(Math.max(0.01, easeBack(u))));
      burst(P, [0x35e6ff, 0xffffff, 0xa77bff], 12, 4); vfx.portalPop(P); sfx('portal'); pf.pulse();
      tween(0.2, u => h.g.scale.setScalar(Math.max(0.01, u)));
      h.play('Spawn_Air', { speed: 1.1 });
      await jumpTo(HERO_X, Z0, 1.1, 0.6, P.y);
      sfx('land'); await land(true);
      tween(0.3, u => portal.scale.setScalar(Math.max(0.01, 1 - u))).then(() => { scene.remove(portal); open = false; });
      shot(heroAt(1.4), 0.5, 0.22);
      await h.play('Interact', { speed: 1.3 });     // осматривается
      stance();
    },
    /** Враг выпрыгивает из разлома и рычит; мини-босс/босс — с тряской земли и именем. Катсцена, промис. */
    async spawn(hp: number, kind = 0, mini = false, worldBoss = false) {
      const cg = clearGen;
      await whenReady();
      if (cg !== clearGen) return;
      trainGen++; dropTraining();
      if (enemy) { scene.remove(enemy.m.a.g); enemy.m.a.dispose(); enemy = null; }
      const pick = pickEnemy(worldK, kind, mini, worldBoss);
      const big = mini || worldBoss;
      const m = await createMonster(pick.id, pick.scale); rimLight(m.a); prepareEnemy(pick.id, m.a);
      if (cg !== clearGen) { m.a.dispose(); return; }
      const base = 1, top = m.height + m.hover;
      enemy = { id: pick.id, m, hp, max: hp, boss: big, wb: worldBoss, base, top, live: false, s0: m.a.g.scale.x, dy: 0 };
      const e = enemy, g = m.a.g;
      g.position.set(ENEMY_X, -m.height - 1, Z0); g.rotation.y = -Math.PI / 2; scene.add(g);
      shot(new THREE.Vector3(ENEMY_X - 0.4, m.height * 0.55, Z0), big ? 0.75 : 0.58, 0.24);
      // разлом в земле
      const crack = new THREE.Mesh(new THREE.CircleGeometry(1.4 * pick.scale, 24), new THREE.MeshBasicMaterial({ color: 0x2a0838, transparent: true, opacity: 0.9 }));
      crack.rotation.x = -Math.PI / 2; crack.position.set(ENEMY_X, 0.03, Z0); crack.scale.setScalar(0.01); scene.add(crack);
      if (big) { shake = 0.9; ring(new THREE.Vector3(ENEMY_X, 0.1, Z0), 0xff2a6a, 6); }
      await tween(big ? 0.6 : 0.3, u => crack.scale.setScalar(Math.max(0.01, ease(u))));
      // ушли с экрана посреди появления: врага уже убрал clear(), разлом убираем сами, полоску здоровья не показываем
      if (cg !== clearGen) { drop(crack); return; }
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.9 * pick.scale, 0.9 * pick.scale, 12, 12, 1, true), new THREE.MeshBasicMaterial({ color: 0xff4fb8, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false }));
      beam.position.set(ENEMY_X, 6, Z0); scene.add(beam);
      let bt = 0; fx.push({ update: dt => { bt += dt * 1.6; (beam.material as THREE.MeshBasicMaterial).opacity = 0.55 * (1 - bt); beam.scale.x = beam.scale.z = 1 - bt * 0.7; if (bt >= 1) { drop(beam); return false; } return true; } });
      burst(new THREE.Vector3(ENEMY_X, 0.5, Z0), [0xff4fb8, 0x8a3cff], 12, 4); vfx.riftBurst(V.set(ENEMY_X, 0, Z0 + 0.2), 0xff4fb8, pick.scale); sfx('boom');
      const y1 = m.hover;
      await tween(0.45, u => { g.position.y = (-m.height - 1) + (y1 + m.height + 1) * easeBack(u); });
      if (cg !== clearGen) { drop(crack); return; }
      g.position.y = y1; e.live = true; hpBar.visible = true;
      // рык: враг бьёт по воздуху, герой встаёт в стойку
      guard = true; stance(); shake = Math.max(shake, big ? 0.6 : 0.3);
      if (worldBoss) popText('БАС ЖАУ', new THREE.Vector3(ENEMY_X, top + 1.4, Z0), '#ff4fb8', true);   // экраны называют их так же: «бас жау», «күшті жау»
      else if (mini) popText('КҮШТІ ЖАУ', new THREE.Vector3(ENEMY_X, top + 1.4, Z0), '#ff4fb8', true);
      // рык ждём не дольше 3 с: модель могли убрать посреди клипа, тогда его конец не наступит никогда
      sfx('growl'); await within(m.a.play(m.attack(), { speed: 1.2 }), 3);
      if (cg !== clearGen) { drop(crack); guard = false; return; }
      tween(0.4, u => { (crack.material as THREE.MeshBasicMaterial).opacity = 0.9 * (1 - u); }).then(() => drop(crack));
      guard = false; stance(); shot(null);
      await wait(0.2);
    },
    /** Удар героя. crit — удар с разворота, sup — прыжок с ударом по земле. Возвращает, повержен ли враг. */
    async attack(opts: { crit?: boolean; sup?: boolean; dmg?: number; tech?: Technique | null; onHit?: () => void } = {}) {
      await whenReady();
      if (!enemy) return false;
      const e = enemy, h = H(), dmg = opts.dmg ?? 1, last = e.hp - dmg <= 0;
      // приём темы: другой клип и цвет, тайминги в пределах 0.2 с от обычного удара (Slice 0.74 с при 1.35×)
      const tech = opts.sup ? null : opts.tech ?? null, tfx = tech?.fx ?? 'arc', tc = tech?.color ?? 0x35e6ff;
      const clip = opts.sup ? 'Melee_1H_Attack_Jump_Chop' : tfx === 'spin' ? 'Melee_2H_Attack_Spinning' : tfx === 'pierce' ? 'Melee_1H_Attack_Stab' : tfx === 'split' ? 'Melee_1H_Attack_Chop' : opts.crit ? 'Melee_2H_Attack_Spinning' : 'Melee_1H_Attack_Slice_Diagonal';
      const spd = tfx === 'spin' ? 1.0 : tfx === 'pierce' ? 2.15 : 1.35;
      // часть ударов (по приёму темы) герой наносит издалека: лук, бросок, магия; меч остаётся основным. Суперудар всегда мечом
      const ranged = opts.sup ? null : pickShot(tfx, rnd, shotHist, !!opts.crit, shotCyc);
      if (!opts.sup) { shotHist.push(ranged); if (shotHist.length > 4) shotHist.shift(); if (ranged && !tech) shotCyc++; }
      let hitDone: () => void = () => {};
      const hit = new Promise<void>(r => (hitDone = r));
      const impact = () => {
        e.hp = Math.max(0, e.hp - dmg); flashT = 0.09; sfx('impact'); if (opts.sup) sfx('boom');   // 'crit' здесь не играем: на серию ≥3 его уже сыграл экран задачи при верном ответе (иначе звучало дважды)
        const p = enemyPos();
        burst(p, opts.sup ? [0xffcb2e, 0xffffff, 0x35e6ff] : tech ? [tc, 0xffffff, tc] : [0x35e6ff, 0xffffff, 0x3ddc6e], opts.sup ? 24 : opts.crit ? 14 : 8, opts.sup ? 8 : 5);
        // точка удара — на передней (к герою и камере) стороне врага, чтобы искры не тонули в его теле
        const hp = new THREE.Vector3(p.x - 0.3, p.y + 0.15, p.z + 0.6);
        vfx.slash(hp, tfx === 'pierce' ? SWING.set(1, 0, 0) : SWING.set(1, -0.55, 0), opts.sup ? 0xffcb2e : tc, opts.sup ? 4.4 : tfx === 'pierce' ? 4.2 : opts.crit ? 3.8 : 3);
        if (opts.sup) { vfx.critBurst(hp, 0xffcb2e, 0x35e6ff, 1.5); vfx.dust(V.set(ENEMY_X - 0.9, 0, Z0), 1.7, 0xffe9a8); }
        else if (opts.crit) { vfx.critBurst(hp, tc, 0xffcb2e, 1); vfx.hitSpark(hp, 0xffffff, 0.8); }
        else vfx.hitSpark(hp, tech ? tc : 0x7ff0ff, 1);
        if (tech) techniqueFx(tech, hp);
        popText(opts.sup ? `СУПЕР −${dmg}` : `−${dmg}`, p.clone().add(new THREE.Vector3(0, 1.4 + e.top * 0.3, 0)), opts.sup ? '#ffcb2e' : opts.crit ? '#35e6ff' : '#dfe6ff', !!(opts.sup || opts.crit));
        shake = opts.sup ? 0.8 : opts.crit ? 0.45 : 0.25;
        if (opts.sup) ring(new THREE.Vector3(ENEMY_X - 0.6, 0.15, Z0), 0xffcb2e, 5);
        if (opts.sup || last) { slow = 0.25; slowT = last ? 0.5 : 0.35; } else if (opts.crit) { slow = 0.06; slowT = 0.07; } else { slow = 0.3; slowT = 0.04; }   // «стоп-кадр» на касании
        if (!last) e.m.a.play(e.m.hit, { speed: 1.3 });
        const x0 = e.m.a.g.position.x;
        tween(0.25, u => { e.m.a.g.position.x = x0 + Math.sin(u * Math.PI) * (opts.sup ? 1.2 : 0.6); });
        // сплющивание при ударе: враг «проседает» и пружинит обратно
        const sq = opts.sup || opts.crit ? 1.3 : 1, gs = e.m.a.g.scale, b0 = e.s0;
        tween(0.22, u => { const k = Math.sin(u * Math.PI) * (1 - u * 0.4); gs.set(b0 * (1 + 0.14 * sq * k), b0 * (1 - 0.2 * sq * k), b0 * (1 + 0.14 * sq * k)); });
        hitDone(); opts.onHit?.();
      };
      guard = false;
      if (opts.sup) {
        ring(new THREE.Vector3(HERO_X, 0.2, Z0), 0xffcb2e, 2.5);
        shot(heroAt(1.2), 0.6, 0.2);
        let charging = true, cp = new THREE.Vector3(HERO_X + 0.2, 1.3, Z0 + 0.5);
        fx.push({ update: dt => { if (charging) vfx.charge(cp, 0xffcb2e, dt, 2.1); return charging; } });
        await h.play('Use_Item', { speed: 1.9 });                        // зарядка
        charging = false; vfx.glow(cp, 0xffcb2e, 3.2, 0.3);
        shot(new THREE.Vector3(ENEMY_X - 1.2, 1.8, Z0), 0.75, 0.3);
        trailOn = true;
        h.play(clip, { speed: 1.05, marks: [{ at: 0.12, fn: () => sfx('slash') }, { at: HIT_AT[clip], fn: impact }] });
        await jumpTo(ENEMY_X - 1.6, Z0, 2.4, h.length(clip, 1.05) * 0.62);
        trailOn = false; land(true);
      } else if (ranged) {
        if (last) shot(new THREE.Vector3(ENEMY_X - 0.8, 1.4, Z0), 0.6, 0.22);
        if (tech) popText(tech.kz.toUpperCase(), new THREE.Vector3(HERO_X + 0.4, HERO_HEIGHT + 1.2, Z0), '#' + tc.toString(16).padStart(6, '0'));
        await shootEnemy(ranged, tech ? tc : ranged === 'throw' ? 0xffcb2e : 0x35e6ff, impact, hitDone);
        hitDone();
      } else {
        if (last) shot(new THREE.Vector3(ENEMY_X - 0.8, 1.4, Z0), 0.6, 0.22);
        if (tech) popText(tech.kz.toUpperCase(), new THREE.Vector3(HERO_X + 0.4, HERO_HEIGHT + 1.2, Z0), '#' + tc.toString(16).padStart(6, '0'));
        await runTo(ENEMY_X - 1.9, 0.32);
        trailOne = tech ? [tc] : null; trailOn = true;
        h.play(clip, { speed: spd, marks: [{ at: 0.12, fn: () => sfx('slash') }, { at: HIT_AT[clip], fn: impact }] });
        // выпад: герой подаётся вперёд вместе с клинком
        if (tfx === 'pierce') { const x0 = h.g.position.x; tween(0.2, u => { h.g.position.x = x0 + 0.8 * ease(u); }); }
      }
      await within(hit, 3); if (!opts.sup && !ranged) await wait(h.length(clip, spd) * (1 - HIT_AT[clip]) * 0.9);
      trailOn = false; trailOne = null;
      if (opts.sup) { await jumpTo(HERO_X, Z0, 1.2, 0.4); h.g.rotation.y = Math.PI / 2; shot(null); }
      else if (!ranged) await runTo(HERO_X, 0.34);
      neutral();
      return e.hp <= 0;
    },
    /** Ход врага при ошибке: у каждого монстра свой стиль (attacks.ts) → щит героя. Урона нет.
     *  brk — щит пробивается (ошибка при уверенности: осколки, герой отлетает); quiet — без надписи «ҚАЛҚАН» над героем (её рисует экран);
     *  onContact — вызывается в момент касания снаряда щита. */
    async enemyAttack(o: { brk?: boolean; quiet?: boolean; onContact?: () => void } = {}) {
      await whenReady();
      if (!enemy) return;
      const h = H();
      brk = o.brk ? 1 : 0; blockText = !o.quiet; onContact = o.onContact ?? null;
      try { await within(attacks.run(enemy), o.brk ? 4.6 : 3.4); }
      finally { brk = 0; blockText = true; onContact?.(); onContact = null; }
      h.g.position.x = HERO_X; h.g.position.y = 0; h.g.rotation.y = Math.PI / 2; guard = false; stance();
    },
    /** Событие на весь экран: камера подлетает к бойцам (при «уменьшить движение» не летит); выкл — общий план. */
    eventShot(on: boolean) { if (on && d.km >= 1) shot(EVENT_FOCUS, 0.84, 0.2); else if (!on) shot(null); },
    /** Враг повержен: смерть, крупный план, распад на кубики и монеты. */
    async defeat() {
      await whenReady();
      if (!enemy) return;
      const e = enemy, p = enemyPos(); hpBar.visible = false;   // пустая полоска во время смерти не нужна
      shot(new THREE.Vector3(ENEMY_X - 0.4, e.top * 0.5, Z0), e.wb ? 0.8 : 0.6, 0.24);
      flashT = 0.2;
      if (e.wb) { slow = 0.4; slowT = 1.4; shake = 0.7; }                  // бас жау падает в замедлении
      await e.m.a.play('Death', { speed: 1.2, hold: true });
      await wait(0.15);
      await tween(0.25, u => { e.m.a.g.scale.setScalar(Math.max(0.01, 1 - u)); flashT = 0.2; });
      scene.remove(e.m.a.g); e.m.a.dispose(); hpBar.visible = false; enemy = null;
      burst(p, [0xff4fb8, 0x8a3cff, 0x35e6ff], 26, 7, 0.22); burst(p, [0xffcb2e], 16, 4, 0.2); sfx('boom'); sfx('coins');
      vfx.poof(V.set(p.x, p.y, p.z + 0.4), 0xff4fb8, Math.min(1.8, Math.max(0.8, e.top / 2.4))); shake = 0.5;
      if (e.wb) {
        // победа над бас жау мира: три волны, большой распад на кристаллы, «ЖЕҢІС!»
        for (let k = 0; k < 3; k++) setTimeout(() => ring(new THREE.Vector3(ENEMY_X, 0.15, Z0), [0xffcb2e, 0x35e6ff, 0xff4fb8][k], 7 + k * 2), k * 220);
        vfx.critBurst(V.set(p.x, p.y + 0.4, p.z + 0.6), 0xffcb2e, 0x35e6ff, 2.2);
        burst(p, [0x35e6ff, 0xa77bff, 0xffffff], 40, 9, 0.26); vfx.levelUpPillar(V.set(ENEMY_X, 0, Z0), 0xffcb2e);
        popText('ЖЕҢІС!', new THREE.Vector3(ENEMY_X - 1.2, e.top + 1.6, Z0), '#ffcb2e', true);
        shake = 1; flashT = 0.35; sfx('crit');
        await wait(1.1);
      }
      await wait(0.45);
      shot(null);
    },
    /** Катсцена победы: поза героя → сундук падает с неба → герой подходит, открывает → фонтан наград → радость в камеру. */
    async victory() {
      await whenReady(); const h = H();
      neutral(); guard = false;
      // 1. победная поза: прыжок с разворотом
      shot(heroAt(1.5), 0.48, 0.2);
      const r0 = h.g.rotation.y;
      trailOn = true;
      h.play('Jump_Full_Short', { speed: 1.1 });
      await tween(0.6, u => { h.g.position.y = Math.sin(u * Math.PI) * 1.4; h.g.rotation.y = r0 + u * (Math.PI * 1.5); });
      trailOn = false;
      h.g.position.y = 0; h.g.rotation.y = 0;
      await land();
      burst(heroAt(3.4), [0xffcb2e, 0x35e6ff, 0xffffff], 14, 5); vfx.sparkleShower(heroAt(2.6));
      h.play('Cheering');
      await wait(0.6);
      neutral();
      // 2. сундук падает с неба
      const C = new THREE.Vector3(0.9, 0, 1.3);
      const shipKit = await Kit.load('ship');
      const chest = new THREE.Group(); chest.position.set(C.x, 9, C.z); scene.add(chest);
      const cm = shipKit.get('chest', { height: 1.2, ground: true }); cm.rotation.y = -0.5;
      const chestA = new Actor(cm, shipKit.clips); chest.add(chestA.g);
      shot(new THREE.Vector3((HERO_X + C.x) / 2, 1.3, C.z), 0.62, 0.3);
      h.g.rotation.y = faceAngle(C.x, C.z);
      await tween(0.45, u => (chest.position.y = 9 * (1 - u * u)));
      chest.position.y = 0; sfx('land'); shake = 0.55; ring(C.clone().setY(0.1), 0xffe9a8, 4); vfx.dust(C.clone().setY(0), 1.5);
      await tween(0.2, u => { const s = Math.sin(u * Math.PI); chest.scale.set(1 + s * 0.15, 1 - s * 0.2, 1 + s * 0.15); });
      chest.scale.setScalar(1);
      // 3. подходит к сундуку
      await walkTo(C.x - 1.7, C.z, 0.7);
      h.g.rotation.y = Math.PI / 2;
      shot(new THREE.Vector3(C.x - 0.8, 1.0, C.z), 0.5, 0.3);
      // 4. тянется к сундуку — крышка открывается
      const interact = h.play('Interact', { speed: 1.1 });
      await wait(0.35);
      chestA.play('open', { hold: true });
      let chestAlive = true; fx.push({ update: dt => { chestA.update(dt); return chestAlive; } });
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.42, 7, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0xffe07a, transparent: true, opacity: 0.3, side: THREE.DoubleSide, depthWrite: false }));
      beam.position.set(C.x, 4.2, C.z); scene.add(beam);
      let bt = 0; fx.push({ update: dt => { bt += dt * 0.7; (beam.material as THREE.MeshBasicMaterial).opacity = 0.3 * (1 - bt); if (bt >= 1) { drop(beam); return false; } return true; } });
      burst(C.clone().setY(1.2), [0xffcb2e, 0xffcb2e, 0xffe07a], 30, 6, 0.22);   // золотые кубики = монеты
      vfx.levelUpPillar(C, 0xffe07a); vfx.chestSparkle(C.clone().setY(1.2));
      let sp = 0; fx.push({ update: dt => { sp += dt; if (sp > 0.28) { sp = 0; vfx.sparkleShower(V.set(C.x, 1.4, C.z), [0xffcb2e, 0xffffff, 0xa77bff], 6); } return chestAlive; } });
      shake = 0.3;
      await interact;
      // 5. радуется в камеру
      shot(new THREE.Vector3(C.x - 0.8, 1.4, C.z), 0.55, 0.22);
      h.g.rotation.y = 0.4;
      await h.play('Cheering', { speed: 1.1 });
      neutral();
      setTimeout(() => { chestAlive = false; scene.remove(chest); chestA.dispose(); }, 6000);
    },
    /** Разовая «эмоция» героя (клип вроде 'Interact', 'Cheering', 'Idle_B', 'Use_Item'): только когда герой свободен (нет боя, катсцены, ожидающих ударов) — иначе сразу выполнено. Потом возвращается в стойку. */
    async emote(clip: string, speed = 1) {
      if (!hero || busy > 0 || hero.marksPending() || !hero.has(clip) || train.posed()) return;
      idle.stop(true); emoting++;
      try { await hero.play(clip, { speed }); } finally { emoting--; }
      if (busy === 0 && hero) stance();
    },
    /** Мировая позиция героя (у ног) — кладёт в v и возвращает его. */
    /** Приглушить полоску здоровья врага (0 — видна, 1 — скрыта): её перекрывает голограмма урока (holo.ts). */
    hpVeil(k: number) { (hpBar.material as THREE.MeshBasicMaterial).opacity = 1 - Math.min(1, Math.max(0, k)); },
    heroPos(v: THREE.Vector3) { return hero ? v.copy(hero.g.position) : v.set(HERO_X, 0, Z0); },
    /** Мировая позиция врага (центр тела); нет врага — точка, где он стоит. */
    enemyPos2(v: THREE.Vector3) { return v.copy(enemyPos()); },
    setTrail(c: number[] | null) { trail = c; },
    setCape(c: { color: number; glow: boolean } | null) { cape = c; hero?.setCape(c); },
    celebrate() { idle.stop(true); if (hero && !hero.marksPending()) hero.play('Cheering');   // не обрывать удар: иначе его момент касания сработает раньше срока
      burst(new THREE.Vector3(HERO_X, 3, Z0), [0xffcb2e, 0x35e6ff], 12, 5); vfx.sparkleShower(new THREE.Vector3(HERO_X, 2.6, Z0 + 0.5)); },
    /** Освободить ресурсы частиц (сцену выкидывают целиком). */
    dispose() { shotGen++; idle.dispose(); train.dispose(); shots.dispose(); dropTraining(); attacks.dispose(); vfx.dispose(); },
    clear() { clearGen++; trainGen++; shotGen++; shots.clear(); hero?.settle(); hero?.carry([]); train.reset(); dropTraining(); tWant.glitch = false; tWant.left = 0; tWant.board = ''; trailOn = false; trailOne = null; idle.stop(true); vfx.clear(); if (enemy) { scene.remove(enemy.m.a.g); enemy.m.a.dispose(); enemy = null; } hpBar.visible = false; guard = false; if (hero) { neutral(); hero.g.position.set(HERO_X, 0, Z0); hero.g.rotation.y = Math.PI / 2; } shot(null); },
    hasEnemy: () => !!enemy,
    hasTraining: () => !!training,
    /** Проверка: поза героя на тренировке ('' — стоит; 'warm', 'sit', 'lie', 'stand') и тип шага. */
    trainPose: () => train.state(),
    /** Проверка: состояние площадки (частицы, мишени, глитч) или null, если её нет. */
    trainingStats: () => training?.stats() ?? null,
    /** Тренировка: площадка вместо врага (on) или её уход (off, с анимацией). Последовательное действие боя, промис — когда площадка встала/ушла. */
    setTraining(on: boolean) { const gen = trainGen; return act(() => (on ? trainOn(gen) : trainOff(gen))); },
    /** Удар героя по манекену настоящим клипом атаки: light — обычный, strong — сильный, combo — n-й удар связки (1..3; 3-й с разворота). stay — остаться у манекена для следующего удара. */
    trainStrike(kind: HitKind, n = 1, stay = false, variant?: number) { return act(() => runStrike(kind, n, stay, variant)); },
    /** Неверный ответ: манекен бросается к герою и шлёпает его по макушке (герой вздрагивает). */
    // шлепок не копится: пока один ждёт в очереди или идёт, новые ошибки его не добавляют (быстрые ошибки иначе давали десятки секунд шлепков подряд)
    trainBonk() { if (bonkQueued) return bonkQueued; bonkQueued = act(runBonk).finally(() => { bonkQueued = null; }); return bonkQueued; },
    /** Нашёл ошибку: герой колет «заражённого» манекена, тот разваливается на доски и собирается обратно. */
    trainBreakGlitch() { return act(runBreak); },
    /** Попал в мишень: герой бросает снаряд, мишень падает. Если бросков уже накопилось два (ребёнок отвечает быстрее анимации), мишень падает сразу, без броска. */
    trainTargetHit() {
      if (throwQ >= 2) { if (training) knock(training); return Promise.resolve(); }
      throwQ++; return act(() => runShot(false)).finally(() => throwQ--);
    },
    /** Промах: мишени вздрагивают, из-под ближней облачко пыли, а герой стреляет мимо (не копится: одна промашка в очереди). */
    trainTargetMiss() {
      training?.targetMiss();
      if (!missQueued && training) missQueued = act(() => runShot(true)).finally(() => { missQueued = null; });
    },
    /** Стрельбище: n мишеней (сразу стоят не больше пяти, сбитые заменяются, пока не кончится счёт). */
    trainTargets(n: number) { tWant.left = Math.max(0, Math.round(n)); training?.targets(Math.min(5, tWant.left)); },
    /** Доска: «пишет» название приёма (пусто — стереть). */
    trainBoard(text: string) { tWant.board = text; training?.board(text); },
    /** «Заражённый» манекен: розовые трещины и экран с ошибкой (on) / снять. */
    trainGlitch(on: boolean) { tWant.glitch = on; training?.glitch(on); train.volleys(on); },
    /** Тип шага урока: герой занимает нужную позу (разминка на «Мақсат», сидит на «Көр», встаёт на других). '' — урок кончился. */
    trainStep(kind: string) { train.setStep(kind); },
    /** Блок на «Неге?» (верный ответ): манекен замахивается на героя, тот ставит щит и отвечает. */
    trainBlock() { return act(runBlock); },
    /** «Приём освоен» на «Есте сақта»: руки вверх, кольцо света цветом приёма. */
    trainMastered(color: number) { return train.mastered(color); },
    /** Победа в финале: разбег, прыжок, удар с разворотом, радость, отдых лёжа. Промис — в момент касания удара. */
    trainVictory() {
      const tr = training;
      return train.victory(() => { shake = Math.max(shake, 0.28); slow = Math.min(slow, 0.3); slowT = Math.max(slowT, 0.06); void tr?.hit('combo', 3); });
    },
    /** Победа: конфетти, салют, манекен подпрыгивает, герой радуется. */
    trainCheer() { return act(runCheer); },
  };
  for (const k of ['arrive', 'spawn', 'attack', 'enemyAttack', 'defeat', 'victory'] as const) {
    const f = api[k] as (...a: unknown[]) => Promise<unknown>;
    // busy — пока есть действие в очереди или в работе. Страховка: одно действие держит очередь не дольше 12 с — зависшая анимация не замораживает бой и урок навсегда
    (api as Record<string, unknown>)[k] = (...a: unknown[]) => { busy++; idle.stop(); return seq(() => within(f(...a), 12) as Promise<unknown>).finally(() => busy--); };
  }
  return api;
}
export type Arena = ReturnType<typeof createArena>;
