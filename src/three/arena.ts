// Боевая локация (docs/GAME_LOOP.md 3): остров текущего мира, герой слева, враг справа. Бой пошаговый:
// верный ответ — герой бежит и бьёт (цифра урона, вспышка, отлёт, тряска), серия 3 — суперудар с замедлением;
// неверный — враг стреляет, герой ставит щит (урона нет). Враг повержен — распад на кубики и монеты.
// Герой и враги — готовые модели с настоящими анимациями (src/three/actor.ts), остров — плитки KayKit (island3d.ts).
// Все действия — промисы, чтобы экран задачи ждал конца анимации и только потом показывал следующий вопрос.
// Катсцены (вход, появление врага, победа с сундуком) ведёт «режиссёр»: план камеры shot() + постановка движений героя.
import * as THREE from 'three';
import { Actor, createHero, createMonster, dress, type Monster, HERO_HEIGHT } from './actor';
import { Kit } from './assets';
import { buildIsland, loadIslandKits } from './island3d';
import { DEFAULT_LOOK, type HeroLook } from './looks';
import { pickEnemy } from './roster';
import { spotLight, spotIndex } from './spots';
import type { Sfx } from '../lib/audio';

interface Deps { skyMat: THREE.Material; starGeo: THREE.BufferGeometry; starMat: THREE.Material; km: number; shadows: boolean; sfx?: (n: Sfx) => void }

const box = new THREE.BoxGeometry(1, 1, 1);
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
  type Enemy = { m: Monster; hp: number; max: number; boss: boolean; base: number; top: number; live: boolean };
  let enemy: Enemy | null = null;
  const hpBar = new THREE.Group(); scene.add(hpBar);
  const hpBg = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.26), new THREE.MeshBasicMaterial({ color: 0x101433, depthTest: false }));
  const hpFg = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 0.16), new THREE.MeshBasicMaterial({ color: 0xff4fb8, depthTest: false }));
  hpFg.position.z = 0.01; hpBar.add(hpBg, hpFg); hpBar.renderOrder = 5; hpBar.visible = false;

  // ---------- эффекты ----------
  type Fx = { update: (dt: number) => boolean };
  const fx: Fx[] = [];
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
  /** Всплывающий текст над объектом: цифра урона, «БЛОК!», «КРИТ!». */
  function popText(text: string, pos: THREE.Vector3, color = '#ffffff', big = false) {
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 128;
    const c = cv.getContext('2d')!;
    c.font = `900 ${big ? 78 : 64}px Rubik, system-ui, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.lineWidth = 14; c.strokeStyle = '#101433'; c.strokeText(text, 128, 64); c.fillStyle = color; c.fillText(text, 128, 64);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), depthTest: false, transparent: true }));
    sp.scale.set(big ? 3.2 : 2.4, big ? 1.6 : 1.2, 1); sp.position.copy(pos); sp.renderOrder = 10; scene.add(sp);
    let t = 0;
    fx.push({ update: dt => { t += dt; sp.position.y += dt * (1.6 - t); const s = t < 0.12 ? t / 0.12 * 1.25 : 1.25 - Math.min(0.25, (t - 0.12) * 1.5);
      sp.scale.set((big ? 3.2 : 2.4) * s, (big ? 1.6 : 1.2) * s, 1); sp.material.opacity = t > 0.8 ? 1 - (t - 0.8) / 0.4 : 1;
      if (t > 1.2) { scene.remove(sp); return false; } return true; } });
  }
  /** Снаряд врага (глитч-куб) к герою. */
  function projectile(from: THREE.Vector3, to: THREE.Vector3, color: number, dur = 0.45) {
    return new Promise<void>(res => {
      const m = new THREE.Mesh(box, mat(color, color, 2.4)); m.scale.setScalar(0.45); scene.add(m);
      let t = 0;
      fx.push({ update: dt => { t += dt / dur; const u = Math.min(1, t); m.position.lerpVectors(from, to, u); m.position.y += Math.sin(u * Math.PI) * 1.2; m.rotation.x += dt * 12; m.rotation.y += dt * 9;
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
  let guard = false;
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
    const h = H(), p = h.g.position.clone(); ring(p.clone().setY(0.1), 0xd8d0ff, big ? 3.5 : 2); burst(p.clone().setY(0.3), [0xd8d0ff, 0xffffff], big ? 20 : 10, 3, 0.14);
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
  let aspect = 1, visAspect = 1, winFrac = 1;   // visAspect — форма видимой части сцены (в ландшафте справа колонка), winFrac — доля высоты экрана под окно сцены

  function update(dt: number, t: number) {
    const k = d.km;
    if (slowT > 0) { slowT -= dt; if (slowT <= 0) slow = 1; }
    const sdt = dt * slow;
    for (let i = tweens.length - 1; i >= 0; i--) { const w = tweens[i]; w.t += sdt / w.dur; const u = Math.min(1, w.t); w.step(u); if (u >= 1) { tweens.splice(i, 1); w.res(); } }
    for (let i = fx.length - 1; i >= 0; i--) if (!fx[i].update(sdt)) fx.splice(i, 1);

    hero?.update(sdt); trailStep();
    const sm = shield.material as THREE.MeshBasicMaterial; sm.opacity += ((guard ? 0.3 : 0) - sm.opacity) * 0.25;

    // враг: анимация, парение летающих, вспышка при ударе
    if (enemy) {
      const e = enemy; e.m.a.update(sdt);
      if (e.m.a.g.scale.x < e.base) e.m.a.g.scale.setScalar(Math.min(e.base, e.m.a.g.scale.x + dt * 3.5 * e.base));
      if (e.live && e.m.hover) e.m.a.g.position.y = e.m.hover + Math.sin(t * 2.4) * 0.15 * k;
      e.m.a.flash(flashT > 0 ? Math.min(1, flashT * 7) : 0);
      hpBar.position.set(e.m.a.g.position.x, e.top + 0.5, e.m.a.g.position.z); hpBar.quaternion.copy(camera.quaternion);
      const f = Math.max(0, e.hp / e.max); hpFg.scale.x = Math.max(0.001, f); hpFg.position.x = -(1 - f) * 1.05;
    }
    flashT = Math.max(0, flashT - dt);

    // камера: оба бойца в центре окна сцены, лёгкое «дыхание»; план меняется плавно (режиссёр — shot())
    const a = 1 - Math.exp(-dt * 5.5);
    camFocus.lerp(shotTo.focus, a); camZoom += (shotTo.zoom - camZoom) * a; camLift += (shotTo.lift - camLift) * a;
    // оба бойца целиком в видимом окне: по ширине видимой части и по высоте окна (на планшете в портрете окно низкое)
    const tanH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)), halfW = 5.4, needH = 4.8;
    const dist = Math.max(10, halfW / (tanH * Math.min(aspect, visAspect)), needH / (2 * tanH * winFrac)) * camZoom;
    const sh = shake > 0 ? (Math.random() - 0.5) * shake : 0; shake = Math.max(0, shake - dt * 1.8);
    lookAtV.copy(camFocus);
    camera.position.set(lookAtV.x + Math.sin(t * 0.25) * 0.4 * k + sh, lookAtV.y + dist * camLift + sh, lookAtV.z + dist);
    camera.lookAt(lookAtV);
    sky.position.copy(camera.position);
  }

  /** Всё нужное для сцены загружено: остров и герой. */
  const whenReady = () => { if (groundDirty) buildGround(); return Promise.all([groundP, heroP]).then(() => {}); };

  return {
    scene, camera, update,
    theme(k: number, a: string, b: string) { worldK = k; colA = new THREE.Color(a).getHex(); void b; groundDirty = true; ready = true; },
    /** Уголок мира по теме: одна тема — всегда один и тот же уголок. Возвращает номер варианта. */
    spot(seed: string) { const v = spotIndex(seed); if (v !== spotV) { spotV = v; groundDirty = true; } return v; },
    /** Костюм героя (какой из шести героев, оружие, оттенок). */
    setLook(l: HeroLook) { if (l === look) return; look = l; loadHero(); },
    isReady: () => ready,
    setFog(c: THREE.Color) { (scene.fog as THREE.Fog).color.copy(c); },
    resize(w: number, h: number) { aspect = w / h; camera.aspect = aspect; camera.updateProjectionMatrix(); },
    frame(offsetX: number, offsetY: number, w: number, h: number, win = 1) {
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
      const portal = new THREE.Group(); portal.position.copy(P); portal.scale.setScalar(0.01); scene.add(portal);
      portal.add(new THREE.Mesh(new THREE.TorusGeometry(1.2, 0.15, 8, 32), new THREE.MeshBasicMaterial({ color: 0x7ff3ff })));
      portal.add(new THREE.Mesh(new THREE.CircleGeometry(1.1, 32), new THREE.MeshBasicMaterial({ color: 0xbff9ff, transparent: true, opacity: 0.75 })));
      h.g.position.copy(P); h.g.rotation.y = Math.PI / 2;
      await tween(0.35, u => portal.scale.setScalar(Math.max(0.01, easeBack(u))));
      burst(P, [0x35e6ff, 0xffffff, 0xa77bff], 30, 4); sfx('portal');
      tween(0.2, u => h.g.scale.setScalar(Math.max(0.01, u)));
      h.play('Spawn_Air', { speed: 1.1 });
      await jumpTo(HERO_X, Z0, 1.1, 0.6, P.y);
      sfx('land'); await land(true);
      tween(0.3, u => portal.scale.setScalar(Math.max(0.01, 1 - u))).then(() => scene.remove(portal));
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
      const m = await createMonster(pick.id, pick.scale);
      const base = 1, top = m.height + m.hover;
      enemy = { m, hp, max: hp, boss: big, base, top, live: false };
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
      burst(new THREE.Vector3(ENEMY_X, 0.5, Z0), [0xff4fb8, 0x8a3cff], 30, 4); sfx('boom');
      const y1 = m.hover;
      await tween(0.45, u => { g.position.y = (-m.height - 1) + (y1 + m.height + 1) * easeBack(u); });
      g.position.y = y1; e.live = true; hpBar.visible = true;
      // рык: враг бьёт по воздуху, герой встаёт в стойку
      guard = true; stance(); shake = Math.max(shake, big ? 0.6 : 0.3);
      if (worldBoss) popText('БОСС', new THREE.Vector3(ENEMY_X, top + 1.4, Z0), '#ff4fb8', true);
      else if (mini) popText('МИНИ-БОСС', new THREE.Vector3(ENEMY_X, top + 1.4, Z0), '#ff4fb8', true);
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
        e.hp = Math.max(0, e.hp - dmg); flashT = 0.14; sfx(opts.sup || opts.crit ? 'crit' : 'impact');
        const p = enemyPos();
        burst(p, opts.sup ? [0xffcb2e, 0xffffff, 0x35e6ff] : [0x35e6ff, 0xffffff, 0x3ddc6e], opts.sup ? 60 : opts.crit ? 36 : 20, opts.sup ? 8 : 5);
        popText(opts.sup ? `СУПЕР −${dmg}` : `−${dmg}`, p.clone().add(new THREE.Vector3(0, 1.4 + e.top * 0.3, 0)), opts.sup ? '#ffcb2e' : opts.crit ? '#35e6ff' : '#ffffff', !!(opts.sup || opts.crit));
        shake = opts.sup ? 0.8 : opts.crit ? 0.45 : 0.25;
        if (opts.sup) ring(new THREE.Vector3(ENEMY_X - 0.6, 0.15, Z0), 0xffcb2e, 5);
        if (opts.sup || last) { slow = 0.25; slowT = last ? 0.5 : 0.35; }
        if (!last) e.m.a.play(e.m.hit, { speed: 1.3 });
        const x0 = e.m.a.g.position.x;
        tween(0.25, u => { e.m.a.g.position.x = x0 + Math.sin(u * Math.PI) * (opts.sup ? 1.2 : 0.6); });
        hitDone();
      };
      guard = false;
      if (opts.sup) {
        ring(new THREE.Vector3(HERO_X, 0.2, Z0), 0xffcb2e, 2.5);
        shot(heroAt(1.2), 0.6, 0.2);
        await h.play('Use_Item', { speed: 1.6 });                        // зарядка
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
      await hit; if (!opts.sup) await wait(h.length(clip, 1.35) * (1 - HIT_AT[clip]) * 0.9);
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
      await launched;
      guard = true; stance();
      await projectile(new THREE.Vector3(e.m.a.g.position.x - 0.6, e.top * 0.55, Z0), new THREE.Vector3(HERO_X + 0.7, 1.4, Z0), 0xff4fb8);
      burst(new THREE.Vector3(HERO_X + 0.8, 1.4, Z0), [0x35e6ff, 0xffffff], 18, 3, 0.14);
      popText('БЛОК', new THREE.Vector3(HERO_X, HERO_HEIGHT + 1.2, Z0), '#35e6ff'); sfx('block');
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
      const e = enemy, p = enemyPos();
      shot(new THREE.Vector3(ENEMY_X - 0.4, e.top * 0.5, Z0), 0.6, 0.24);
      flashT = 0.2;
      await e.m.a.play('Death', { speed: 1.2, hold: true });
      await wait(0.15);
      await tween(0.25, u => { e.m.a.g.scale.setScalar(Math.max(0.01, 1 - u)); flashT = 0.2; });
      scene.remove(e.m.a.g); e.m.a.dispose(); hpBar.visible = false; enemy = null;
      burst(p, [0xff4fb8, 0x8a3cff, 0x35e6ff], 70, 7, 0.24); burst(p, [0xffcb2e], 16, 4, 0.2); sfx('boom'); sfx('coins');
      ring(p.clone().setY(0.2), 0xff4fb8, 4); shake = 0.5;
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
      burst(heroAt(3.4), [0xffcb2e, 0x35e6ff, 0xffffff], 40, 5);
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
      chest.position.y = 0; sfx('land'); shake = 0.55; ring(C.clone().setY(0.1), 0xffe9a8, 4); burst(C.clone().setY(0.3), [0xd8d0ff, 0xffffff], 22, 4, 0.16);
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
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.42, 7, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0xffe07a, transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false }));
      beam.position.set(C.x, 4.2, C.z); scene.add(beam);
      let bt = 0; fx.push({ update: dt => { bt += dt * 0.7; (beam.material as THREE.MeshBasicMaterial).opacity = 0.45 * (1 - bt); if (bt >= 1) { scene.remove(beam); return false; } return true; } });
      burst(C.clone().setY(1.2), [0xffcb2e, 0xffcb2e, 0xffe07a], 50, 6, 0.22); burst(C.clone().setY(1.2), [0xa77bff, 0x35e6ff, 0xffffff], 30, 5, 0.18);
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
    celebrate() { hero?.play('Cheering'); burst(new THREE.Vector3(HERO_X, 3, Z0), [0xffcb2e, 0x35e6ff], 30, 5); },
    clear() { if (enemy) { scene.remove(enemy.m.a.g); enemy.m.a.dispose(); enemy = null; } hpBar.visible = false; guard = false; if (hero) { neutral(); hero.g.position.set(HERO_X, 0, Z0); hero.g.rotation.y = Math.PI / 2; } shot(null); },
    hasEnemy: () => !!enemy,
  };
}
export type Arena = ReturnType<typeof createArena>;
