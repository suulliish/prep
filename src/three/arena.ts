// Боевая локация (docs/GAME_LOOP.md 3): остров текущего мира, герой слева, враг справа. Бой пошаговый:
// верный ответ — герой бежит и бьёт (цифра урона, вспышка, отлёт, тряска), серия 3 — суперудар с замедлением;
// неверный — враг стреляет, герой ставит щит (урона нет). Враг повержен — распад на кубики и монеты.
// Герой и враги — готовые модели с настоящими анимациями (src/three/actor.ts), остров — плитки KayKit (island3d.ts).
// Все действия — промисы, чтобы экран задачи ждал конца анимации и только потом показывал следующий вопрос.
// Катсцены (вход, появление врага, победа с сундуком) ведёт «режиссёр»: план камеры shot() + постановка движений героя.
import * as THREE from 'three';
import { Actor, createHero, createMonster, dress, type Monster, HERO_HEIGHT } from './actor';
import { Kit } from './assets';
import { createPortal, type Portal } from './portal';
import { buildIsland, loadIslandKits } from './island3d';
import { DEFAULT_LOOK, type HeroLook } from './looks';
import { pickEnemy } from './roster';
import { spotLight, spotIndex } from './spots';
import { createVfx } from './vfx';
import type { Sfx } from '../lib/audio';

interface Deps { skyMat: THREE.Material; starGeo: THREE.BufferGeometry; starMat: THREE.Material; km: number; shadows: boolean; sfx?: (n: Sfx) => void }

const box = new THREE.BoxGeometry(1, 1, 1);
const SWING = new THREE.Vector3();   // направление взмаха для vfx.slash (переиспользуется)
const HERO_X = -2.6, ENEMY_X = 2.8, Z0 = 0.4;
/** Момент касания в клипе (доля 0..1) — по нему считается удар. */
const HIT_AT: Record<string, number> = { Melee_1H_Attack_Slice_Diagonal: 0.42, Melee_1H_Attack_Chop: 0.45, Melee_2H_Attack_Spinning: 0.5, Melee_1H_Attack_Jump_Chop: 0.55 };

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
  const mat = (c: number, e = 0, ei = 1) => new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(0.5 + Math.min(ei, 2.4) * 0.4) });

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
      if (hero) { scene.remove(hero.g); hero.dispose(); }
      hero = h; scene.add(h.g); h.g.add(shield);
      h.g.position.set(HERO_X, 0, Z0); h.g.rotation.y = Math.PI / 2;
      weapon = h.bone('handslot.r')?.children.find(c => c.userData.gear) ?? null;
    })();
  }
  loadHero();
  const H = () => hero!;

  // ---------- враг ----------
  type Enemy = { m: Monster; hp: number; max: number; boss: boolean; wb: boolean; base: number; top: number; live: boolean; s0: number };
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
    c.fillStyle = '#ffffff'; c.fillText(String(hp), x + r, y + h / 2 + 3);
    hpTex.needsUpdate = true;
  }

  // ---------- эффекты ----------
  type Fx = { update: (dt: number) => boolean };
  const fx: Fx[] = [];
  /** Частицы-спрайты из атласа (искры, взмахи, дым): src/three/vfx.ts. Кубики ниже — крупные «осколки» и монеты. */
  const vfx = createVfx(scene, camera, { km: d.km, high: d.shadows });
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
  function ring(pos: THREE.Vector3, color: number, max = 5) {
    const m = new THREE.Mesh(new THREE.TorusGeometry(1, 0.08, 6, 40), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 }));
    m.rotation.x = Math.PI / 2; m.position.copy(pos); scene.add(m);
    let t = 0;
    fx.push({ update: dt => { t += dt * 2.2; m.scale.setScalar(0.3 + t * max); (m.material as THREE.MeshBasicMaterial).opacity = 0.9 * (1 - t); if (t >= 1) { scene.remove(m); return false; } return true; } });
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
  /** Снаряд врага (глитч-куб) к герою. */
  function projectile(from: THREE.Vector3, to: THREE.Vector3, color: number, dur = 0.45) {
    return new Promise<void>(res => {
      const m = new THREE.Mesh(box, mat(color, color, 2.4)); m.scale.setScalar(0.45); scene.add(m);
      let t = 0;
      fx.push({ update: dt => { t += dt / dur; const u = Math.min(1, t); m.position.lerpVectors(from, to, u); m.position.y += Math.sin(u * Math.PI) * 1.2; m.rotation.x += dt * 12; m.rotation.y += dt * 9;
        vfx.magicTrail(m.position, color, dt);
        if (u >= 1) { scene.remove(m); res(); return false; } return true; } });
    });
  }

  // ---------- анимации (твины) ----------
  type Tw = { t: number; dur: number; step: (u: number) => void; res: () => void };
  const tweens: Tw[] = [];
  const ease = (u: number) => 1 - Math.pow(1 - u, 3);
  function tween(dur: number, step: (u: number) => void) { return new Promise<void>(res => tweens.push({ t: 0, dur, step, res })); }
  const wait = (s: number) => tween(s, () => {});
  const easeBack = (u: number) => 1 + 2.2 * Math.pow(u - 1, 3) + 1.2 * Math.pow(u - 1, 2);
  let shake = 0, slow = 1, slowT = 0, flashT = 0;
  let guard = false, shieldPulse = 0;
  // след от оружия (награда за звёзды): светящиеся кубики с кончика клинка, пока идёт удар
  let trail: number[] | null = null, trailOn = false, trailK = 0;
  const tip = new THREE.Vector3();
  function trailStep() {
    if (!trail || !trailOn || !weapon) return;
    weapon.localToWorld(tip.set(0, 0.9, 0));
    const m = new THREE.Mesh(box, mat(trail[trailK++ % trail.length], trail[trailK % trail.length], 2.2)); m.scale.setScalar(0.22); m.position.copy(tip); scene.add(m);
    let life = 0.35;
    fx.push({ update: dt => { life -= dt; m.scale.multiplyScalar(0.9); if (life <= 0) { scene.remove(m); return false; } return true; } });
  }

  // ---------- режиссёр: план камеры ----------
  type Shot = { focus: THREE.Vector3; zoom: number; lift: number };
  const WIDE: Shot = { focus: new THREE.Vector3(0.1, 1.4, 0), zoom: 1, lift: 0.28 };
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
  async function walkTo(x: number, z: number, dur: number, run = false) {
    const h = H(), x0 = h.g.position.x, z0 = h.g.position.z;
    h.g.rotation.y = faceAngle(x, z); h.loop(run ? 'Running_A' : 'Walking_A', 0.12, run ? 1.25 : 1);
    await tween(dur, u => { const k = ease(u); h.g.position.x = x0 + (x - x0) * k; h.g.position.z = z0 + (z - z0) * k; });
    h.loop('Idle_A', 0.12);
  }
  async function runTo(x: number, dur: number) { await walkTo(x, H().g.position.z, dur, true); H().g.rotation.y = Math.PI / 2; }
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

  let ready = false;
  const lookAtV = new THREE.Vector3(0.1, 1.4, 0);
  let aspect = 1, visAspect = 1, winFrac = 1, screenH = 600, uiK = 1;   // uiK — во сколько раз крупнее подписи и эффекты, когда пикселей на единицу мира мало (телефон); visAspect — форма видимой части сцены (в ландшафте справа колонка), winFrac — доля высоты экрана под окно сцены

  function update(dt: number, t: number) {
    const k = d.km;
    if (slowT > 0) { slowT -= dt; if (slowT <= 0) slow = 1; }
    const sdt = dt * slow;
    for (let i = tweens.length - 1; i >= 0; i--) { const w = tweens[i]; w.t += sdt / w.dur; const u = Math.min(1, w.t); w.step(u); if (u >= 1) { tweens.splice(i, 1); w.res(); } }
    for (let i = fx.length - 1; i >= 0; i--) if (!fx[i].update(sdt)) fx.splice(i, 1);
    vfx.update(sdt);

    hero?.update(sdt); trailStep();
    const sm = shield.material as THREE.MeshBasicMaterial; sm.opacity += ((guard ? 0.3 : 0) - sm.opacity) * 0.25;
    if (shieldPulse > 0) { shieldPulse = Math.max(0, shieldPulse - dt * 4); sm.opacity += shieldPulse * 0.2; shield.scale.setScalar(1 + shieldPulse * 0.08); } else shield.scale.setScalar(1);

    // враг: анимация, парение летающих, вспышка при ударе
    if (enemy) {
      const e = enemy; e.m.a.update(sdt);
      if (e.m.a.g.scale.x < e.base) e.m.a.g.scale.setScalar(Math.min(e.base, e.m.a.g.scale.x + dt * 3.5 * e.base));
      if (e.live && e.m.hover) e.m.a.g.position.y = e.m.hover + Math.sin(t * 2.4) * 0.15 * k;
      e.m.a.flash(flashT > 0 ? Math.min(1, flashT * 12) : 0);
      hpBar.position.set(e.m.a.g.position.x, e.top + 0.3 + 0.25 * uiK, e.m.a.g.position.z + 0.3); hpBar.quaternion.copy(camera.quaternion); drawHp(e.hp, e.max);
    }
    flashT = Math.max(0, flashT - dt);

    // камера: оба бойца в центре окна сцены, лёгкое «дыхание»; план меняется плавно (режиссёр — shot())
    const a = 1 - Math.exp(-dt * 5.5);
    camFocus.lerp(shotTo.focus, a); camZoom += (shotTo.zoom - camZoom) * a; camLift += (shotTo.lift - camLift) * a;
    // оба бойца целиком в видимом окне: по ширине видимой части и по высоте окна (на планшете в портрете окно низкое)
    const tanH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)), halfW = 5.4, needH = 4.8;
    const dist = Math.max(10, halfW / (tanH * Math.min(aspect, visAspect)), needH / (2 * tanH * winFrac)) * camZoom;
    uiK = Math.min(1.9, Math.max(1, 60 / (screenH / (2 * tanH * dist)))); vfx.setScale(Math.min(1.5, uiK)); hpBar.scale.setScalar(uiK);
    const sh = shake > 0 ? (Math.random() - 0.5) * shake : 0; shake = Math.max(0, shake - dt * 1.8);
    lookAtV.copy(camFocus);
    camera.position.set(lookAtV.x + Math.sin(t * 0.25) * 0.4 * k + sh, lookAtV.y + dist * camLift + sh, lookAtV.z + dist);
    camera.lookAt(lookAtV);
    sky.position.copy(camera.position);
  }

  // действия боя идут строго по очереди: два одновременных удара не перебивают анимации друг друга и не зависают
  let chain: Promise<unknown> = Promise.resolve();
  let arrivePortal: Portal | null = null;
  const seq = <T>(fn: () => Promise<T>): Promise<T> => { const p = chain.then(fn, fn); chain = p.catch(() => {}); return p; };
  /** Ждать не дольше s секунд (защита от вечного ожидания момента удара, если анимацию прервали). */
  const within = (p: Promise<unknown>, s: number) => Promise.race([p, new Promise(r => setTimeout(r, s * 1000))]);

  /** Всё нужное для сцены загружено: остров и герой. */
  const whenReady = () => { if (groundDirty) buildGround(); return Promise.all([groundP, heroP]).then(() => {}); };

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
      await whenReady();
      if (enemy) { scene.remove(enemy.m.a.g); enemy.m.a.dispose(); enemy = null; }
      const pick = pickEnemy(worldK, kind, mini, worldBoss);
      const big = mini || worldBoss;
      const m = await createMonster(pick.id, pick.scale); rimLight(m.a);
      const base = 1, top = m.height + m.hover;
      enemy = { m, hp, max: hp, boss: big, wb: worldBoss, base, top, live: false, s0: m.a.g.scale.x };
      const e = enemy, g = m.a.g;
      g.position.set(ENEMY_X, -m.height - 1, Z0); g.rotation.y = -Math.PI / 2; scene.add(g);
      shot(new THREE.Vector3(ENEMY_X - 0.4, m.height * 0.55, Z0), big ? 0.75 : 0.58, 0.24);
      // разлом в земле
      const crack = new THREE.Mesh(new THREE.CircleGeometry(1.4 * pick.scale, 24), new THREE.MeshBasicMaterial({ color: 0x2a0838, transparent: true, opacity: 0.9 }));
      crack.rotation.x = -Math.PI / 2; crack.position.set(ENEMY_X, 0.03, Z0); crack.scale.setScalar(0.01); scene.add(crack);
      if (big) { shake = 0.9; ring(new THREE.Vector3(ENEMY_X, 0.1, Z0), 0xff2a6a, 6); }
      await tween(big ? 0.6 : 0.3, u => crack.scale.setScalar(Math.max(0.01, ease(u))));
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.9 * pick.scale, 0.9 * pick.scale, 12, 12, 1, true), new THREE.MeshBasicMaterial({ color: 0xff4fb8, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false }));
      beam.position.set(ENEMY_X, 6, Z0); scene.add(beam);
      let bt = 0; fx.push({ update: dt => { bt += dt * 1.6; (beam.material as THREE.MeshBasicMaterial).opacity = 0.55 * (1 - bt); beam.scale.x = beam.scale.z = 1 - bt * 0.7; if (bt >= 1) { scene.remove(beam); return false; } return true; } });
      burst(new THREE.Vector3(ENEMY_X, 0.5, Z0), [0xff4fb8, 0x8a3cff], 12, 4); vfx.riftBurst(V.set(ENEMY_X, 0, Z0 + 0.2), 0xff4fb8, pick.scale); sfx('boom');
      const y1 = m.hover;
      await tween(0.45, u => { g.position.y = (-m.height - 1) + (y1 + m.height + 1) * easeBack(u); });
      g.position.y = y1; e.live = true; hpBar.visible = true;
      // рык: враг бьёт по воздуху, герой встаёт в стойку
      guard = true; stance(); shake = Math.max(shake, big ? 0.6 : 0.3);
      if (worldBoss) popText('БАС ЖАУ', new THREE.Vector3(ENEMY_X, top + 1.4, Z0), '#ff4fb8', true);   // экраны называют их так же: «бас жау», «күшті жау»
      else if (mini) popText('КҮШТІ ЖАУ', new THREE.Vector3(ENEMY_X, top + 1.4, Z0), '#ff4fb8', true);
      sfx('growl'); await m.a.play(m.attack(), { speed: 1.2 });
      tween(0.4, u => { (crack.material as THREE.MeshBasicMaterial).opacity = 0.9 * (1 - u); }).then(() => scene.remove(crack));
      guard = false; stance(); shot(null);
      await wait(0.2);
    },
    /** Удар героя. crit — удар с разворота, sup — прыжок с ударом по земле. Возвращает, повержен ли враг. */
    async attack(opts: { crit?: boolean; sup?: boolean; dmg?: number } = {}) {
      await whenReady();
      if (!enemy) return false;
      const e = enemy, h = H(), dmg = opts.dmg ?? 1, last = e.hp - dmg <= 0;
      const clip = opts.sup ? 'Melee_1H_Attack_Jump_Chop' : opts.crit ? 'Melee_2H_Attack_Spinning' : 'Melee_1H_Attack_Slice_Diagonal';
      let hitDone: () => void = () => {};
      const hit = new Promise<void>(r => (hitDone = r));
      const impact = () => {
        e.hp = Math.max(0, e.hp - dmg); flashT = 0.09; sfx(opts.sup || opts.crit ? 'crit' : 'impact');
        const p = enemyPos();
        burst(p, opts.sup ? [0xffcb2e, 0xffffff, 0x35e6ff] : [0x35e6ff, 0xffffff, 0x3ddc6e], opts.sup ? 24 : opts.crit ? 14 : 8, opts.sup ? 8 : 5);
        // точка удара — на передней (к герою и камере) стороне врага, чтобы искры не тонули в его теле
        const hp = new THREE.Vector3(p.x - 0.3, p.y + 0.15, p.z + 0.6);
        vfx.slash(hp, SWING.set(1, -0.55, 0), opts.sup ? 0xffcb2e : 0x35e6ff, opts.sup ? 4.4 : opts.crit ? 3.8 : 3);
        if (opts.sup) { vfx.critBurst(hp, 0xffcb2e, 0x35e6ff, 1.5); vfx.dust(V.set(ENEMY_X - 0.9, 0, Z0), 1.7, 0xffe9a8); }
        else if (opts.crit) { vfx.critBurst(hp, 0x35e6ff, 0xffcb2e, 1); vfx.hitSpark(hp, 0xffffff, 0.8); }
        else vfx.hitSpark(hp, 0x7ff0ff, 1);
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
        hitDone();
      };
      guard = false;
      if (opts.sup) {
        ring(new THREE.Vector3(HERO_X, 0.2, Z0), 0xffcb2e, 2.5);
        shot(heroAt(1.2), 0.6, 0.2);
        let charging = true, cp = new THREE.Vector3(HERO_X + 0.2, 1.3, Z0 + 0.5);
        fx.push({ update: dt => { if (charging) vfx.charge(cp, 0xffcb2e, dt, 2.1); return charging; } });
        await h.play('Use_Item', { speed: 1.6 });                        // зарядка
        charging = false; vfx.glow(cp, 0xffcb2e, 3.2, 0.3);
        shot(new THREE.Vector3(ENEMY_X - 1.2, 1.8, Z0), 0.75, 0.3);
        trailOn = true;
        h.play(clip, { speed: 1.05, marks: [{ at: 0.12, fn: () => sfx('slash') }, { at: HIT_AT[clip], fn: impact }] });
        await jumpTo(ENEMY_X - 1.6, Z0, 2.4, h.length(clip, 1.05) * 0.62);
        trailOn = false; land(true);
      } else {
        if (last) shot(new THREE.Vector3(ENEMY_X - 0.8, 1.4, Z0), 0.6, 0.22);
        await runTo(ENEMY_X - 1.9, 0.32);
        trailOn = true;
        h.play(clip, { speed: 1.35, marks: [{ at: 0.12, fn: () => sfx('slash') }, { at: HIT_AT[clip], fn: impact }] });
      }
      await within(hit, 3); if (!opts.sup) await wait(h.length(clip, 1.35) * (1 - HIT_AT[clip]) * 0.9);
      trailOn = false;
      if (opts.sup) { await jumpTo(HERO_X, Z0, 1.2, 0.4); h.g.rotation.y = Math.PI / 2; shot(null); }
      else await runTo(HERO_X, 0.34);
      neutral();
      return e.hp <= 0;
    },
    /** Ход врага при ошибке: снаряд → щит героя. Урона нет. */
    async enemyAttack() {
      await whenReady();
      if (!enemy) return;
      const e = enemy, h = H();
      let launch: () => void = () => {}; const launched = new Promise<void>(r => (launch = r));
      sfx('growl');
      const atk = e.m.a.play(e.m.attack(), { speed: 1.25, marks: [{ at: 0.45, fn: launch }] });
      await within(launched, 2.5);
      guard = true; stance();
      const mouth = new THREE.Vector3(e.m.a.g.position.x - 0.6, e.top * 0.55, Z0);
      vfx.glow(mouth.clone().setZ(Z0 + 0.5), 0xff4fb8, 2.4, 0.25);
      await projectile(mouth, new THREE.Vector3(HERO_X + 0.7, 1.4, Z0), 0xff4fb8);
      burst(new THREE.Vector3(HERO_X + 0.8, 1.4, Z0), [0x35e6ff, 0xffffff], 8, 3, 0.14);
      vfx.shieldHit(V.set(HERO_X + 1.0, 1.4, Z0 + 0.8), 0x35e6ff, 0xff4fb8); shieldPulse = 1;
      popText('ҚАЛҚАН', new THREE.Vector3(HERO_X, HERO_HEIGHT + 1.2, Z0), '#35e6ff'); sfx('block');
      shake = 0.2;
      const back = h.play('Melee_Block_Hit', { speed: 1.1 });
      const x0 = h.g.position.x; tween(0.35, u => { h.g.position.x = x0 - Math.sin(u * Math.PI) * 0.35; });
      await Promise.all([back, atk]);
      h.g.position.x = HERO_X; guard = false; stance();
    },
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
      let bt = 0; fx.push({ update: dt => { bt += dt * 0.7; (beam.material as THREE.MeshBasicMaterial).opacity = 0.3 * (1 - bt); if (bt >= 1) { scene.remove(beam); return false; } return true; } });
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
    setTrail(c: number[] | null) { trail = c; },
    setCape(c: { color: number; glow: boolean } | null) { cape = c; hero?.setCape(c); },
    celebrate() { hero?.play('Cheering'); burst(new THREE.Vector3(HERO_X, 3, Z0), [0xffcb2e, 0x35e6ff], 12, 5); vfx.sparkleShower(new THREE.Vector3(HERO_X, 2.6, Z0 + 0.5)); },
    /** Освободить ресурсы частиц (сцену выкидывают целиком). */
    dispose() { vfx.dispose(); },
    clear() { vfx.clear(); if (enemy) { scene.remove(enemy.m.a.g); enemy.m.a.dispose(); enemy = null; } hpBar.visible = false; guard = false; if (hero) { neutral(); hero.g.position.set(HERO_X, 0, Z0); hero.g.rotation.y = Math.PI / 2; } shot(null); },
    hasEnemy: () => !!enemy,
  };
  for (const k of ['arrive', 'spawn', 'attack', 'enemyAttack', 'defeat', 'victory'] as const) {
    const f = api[k] as (...a: unknown[]) => Promise<unknown>;
    (api as Record<string, unknown>)[k] = (...a: unknown[]) => seq(() => f(...a));
  }
  return api;
}
export type Arena = ReturnType<typeof createArena>;
