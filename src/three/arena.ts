// Боевая локация (docs/GAME_LOOP.md 3): остров текущего мира, герой слева, враг справа. Бой пошаговый:
// верный ответ — герой бежит и бьёт (цифра урона, вспышка, отлёт, тряска), серия 3 — суперудар с замедлением;
// неверный — враг стреляет, герой ставит щит (урона нет). Враг повержен — распад на кубики и монеты.
// Все действия — промисы, чтобы экран задачи ждал конца анимации и только потом показывал следующий вопрос.
// Катсцены (вход, появление врага, победа с сундуком) ведёт «режиссёр»: план камеры shot() + постановка движений героя.
import * as THREE from 'three';
import { makeHero, makeMob } from './characters';
import { builder, mat } from './map';
import { buildSpot, spotLight, spotIndex } from './spots';

type Hero = ReturnType<typeof makeHero>;
interface Deps { skyMat: THREE.Material; starGeo: THREE.BufferGeometry; starMat: THREE.Material; km: number;
  dressHero: (h: Hero) => void; animHero: (h: Hero, t: number, walking: boolean) => void }

const box = new THREE.BoxGeometry(1, 1, 1);
const HERO_X = -2.6, ENEMY_X = 2.8;

export function createArena(d: Deps) {
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x17104a, 30, 90);
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 400);
  const sky = new THREE.Mesh(new THREE.SphereGeometry(150, 32, 16), d.skyMat); scene.add(sky);
  scene.add(new THREE.Points(d.starGeo, d.starMat));
  const hemi = new THREE.HemisphereLight(0xb4c4ff, 0x40214a, 1.05); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffe6c8, 1.7); sun.position.set(-8, 16, 10); scene.add(sun);

  // ---------- остров ----------
  const ground = new THREE.Group(); scene.add(ground);
  // уголок мира для темы (src/three/spots.ts): композиция острова + свет (день / закат / ночь с фонарями)
  let worldK = 0, colA = 0x5ce39c, colB = 0x2f8f5b, spotV = 0;
  const lanterns = [new THREE.PointLight(0xffb84a, 0, 9), new THREE.PointLight(0xffb84a, 0, 9)];
  lanterns[0].position.set(-5, 2, 1.5); lanterns[1].position.set(5, 2, 1.5); lanterns.forEach(l => scene.add(l));
  function buildGround() {
    while (ground.children.length) ground.remove(ground.children[0]);
    buildSpot(ground, worldK, colA, colB, spotV);
    const L = spotLight(spotV);
    hemi.color.setHex(L.hemiSky); hemi.groundColor.setHex(L.hemiGround); hemi.intensity = L.hemi;
    sun.color.setHex(L.sunColor); sun.intensity = L.sun; sun.position.set(...L.sunPos);
    lanterns.forEach(l => (l.intensity = L.lanterns ? 6 : 0));
  }

  // ---------- герой ----------
  const hero = makeHero(); d.dressHero(hero); scene.add(hero.g);
  hero.g.position.set(HERO_X, 0, 0.4); hero.g.rotation.y = Math.PI / 2;
  const shield = new THREE.Mesh(new THREE.SphereGeometry(1.6, 20, 14), new THREE.MeshBasicMaterial({ color: 0x35e6ff, transparent: true, opacity: 0, depthWrite: false }));
  shield.position.set(0.3, 1.5, 0); hero.g.add(shield);

  // ---------- враг ----------
  type Enemy = ReturnType<typeof makeMob> & { hp: number; max: number; boss: boolean; base: number };
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
      fx.push({ update: dt => { t += dt / dur; const u = Math.min(1, t); m.position.lerpVectors(from, to, u); m.position.y += Math.sin(u * Math.PI) * 1.4; m.rotation.x += dt * 12; m.rotation.y += dt * 9;
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
  // acting — идёт постановка: покой (дыхание, руки, ноги) не перебивает позы из твинов
  let walking = false, guard = false, cheer = 0, acting = false;
  // след от оружия (награда за звёзды): светящиеся кубики с кончика клинка, пока идёт удар
  let trail: number[] | null = null, trailOn = false, trailK = 0;
  const tip = new THREE.Vector3();
  function trailStep() {
    if (!trail || !trailOn) return;
    hero.blade.getWorldPosition(tip);
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
  const heroAt = (dy = 1.3) => hero.g.position.clone().add(new THREE.Vector3(0, dy, 0));

  function neutral() {
    acting = false;
    for (const l of [hero.armL, hero.armR, hero.legL, hero.legR]) l.rotation.set(0, 0, 0);
    hero.body.rotation.set(0, 0, 0); hero.head.rotation.set(0, 0, 0); hero.hips.position.y = 0.95; hero.g.position.y = 0; hero.g.scale.setScalar(1);
  }
  const faceAngle = (x: number, z: number) => Math.atan2(x - hero.g.position.x, z - hero.g.position.z);
  async function walkTo(x: number, z: number, dur: number) {
    const x0 = hero.g.position.x, z0 = hero.g.position.z; walking = true;
    hero.g.rotation.y = faceAngle(x, z);
    await tween(dur, u => { const k = ease(u); hero.g.position.x = x0 + (x - x0) * k; hero.g.position.z = z0 + (z - z0) * k; });
    walking = false;
  }
  async function runTo(x: number, dur: number) { await walkTo(x, hero.g.position.z, dur); hero.g.rotation.y = Math.PI / 2; }
  /** Приземление: сплющивание + пыль. */
  async function land(big = false) {
    const p = hero.g.position.clone(); ring(p.clone().setY(0.1), 0xd8d0ff, big ? 3.5 : 2); burst(p.clone().setY(0.3), [0xd8d0ff, 0xffffff], big ? 20 : 10, 3, 0.14);
    await tween(0.16, u => { const s = Math.sin(u * Math.PI); hero.g.scale.set(1 + s * 0.2, 1 - s * 0.25, 1 + s * 0.2); });
    hero.g.scale.setScalar(1);
  }
  /** Прыжок по дуге в точку (x, z) с высотой h. */
  async function jumpTo(x: number, z: number, h: number, dur: number, y0 = hero.g.position.y) {
    const x0 = hero.g.position.x, z0 = hero.g.position.z;
    if (Math.abs(x - x0) + Math.abs(z - z0) > 0.1) hero.g.rotation.y = faceAngle(x, z);
    await tween(dur, u => { hero.g.position.set(x0 + (x - x0) * u, y0 * (1 - u) + Math.sin(u * Math.PI) * h, z0 + (z - z0) * u); hero.legL.rotation.x = -0.9 * Math.sin(u * Math.PI); hero.legR.rotation.x = 0.5 * Math.sin(u * Math.PI); });
    hero.g.position.y = 0; hero.legL.rotation.x = hero.legR.rotation.x = 0;
  }
  async function lookAround() {
    acting = true;
    await tween(1, u => { hero.head.rotation.y = Math.sin(u * Math.PI * 2) * 0.75; hero.armL.rotation.z = Math.sin(u * Math.PI) * 0.3; });
    neutral();
  }
  async function swing(power: number, spin = false) {
    acting = true; trailOn = true; const r0 = hero.g.rotation.y;
    await tween(0.12, u => { hero.armR.rotation.x = -u * 2.6; hero.body.rotation.y = -u * 0.3; });
    await tween(spin ? 0.3 : 0.1, u => { hero.armR.rotation.x = -2.6 + u * 3.4; hero.body.rotation.y = -0.3 + u * 0.6; if (spin) hero.g.rotation.y = r0 + u * Math.PI * 2; });
    await tween(0.18 * power, u => { hero.armR.rotation.x = 0.8 * (1 - u); hero.body.rotation.y = 0.3 * (1 - u); });
    hero.g.rotation.y = r0; trailOn = false; neutral();
  }
  const enemyPos = () => new THREE.Vector3(ENEMY_X, 1.3, 0.4);
  const glow = (v: number) => ((hero.blade.material as THREE.MeshToonMaterial).emissiveIntensity = v);

  let ready = false;
  const look = new THREE.Vector3(0.1, 1.4, 0);
  let aspect = 1;

  function update(dt: number, t: number) {
    const k = d.km;
    if (slowT > 0) { slowT -= dt; if (slowT <= 0) slow = 1; }
    const sdt = dt * slow;
    for (let i = tweens.length - 1; i >= 0; i--) { const w = tweens[i]; w.t += sdt / w.dur; const u = Math.min(1, w.t); w.step(u); if (u >= 1) { tweens.splice(i, 1); w.res(); } }
    for (let i = fx.length - 1; i >= 0; i--) if (!fx[i].update(sdt)) fx.splice(i, 1);

    // герой: дыхание, ходьба, моргание, стойка
    const sw = walking ? Math.sin(t * 16) * 0.9 : 0;
    if (!acting) {
      hero.legL.rotation.x = sw; hero.legR.rotation.x = -sw; hero.armL.rotation.x = guard ? -1.4 : walking ? -sw * 0.8 : Math.sin(t * 2) * 0.06;
      const hop = cheer > 0 ? Math.abs(Math.sin(cheer * 10)) * 0.8 : 0; cheer = Math.max(0, cheer - dt);
      hero.hips.position.y = 0.95 + hop + (walking ? Math.abs(Math.sin(t * 16)) * 0.08 : Math.sin(t * 2.4) * 0.025);
      hero.head.rotation.y = walking ? 0 : Math.sin(t * 0.8) * 0.2 * k;
      glow(1.6 + Math.sin(t * 6) * 0.5);
    }
    hero.eyes.forEach(e => (e.scale.y = (t % 3.7) < 0.12 ? 0.1 : 1));
    d.animHero(hero, t, walking);
    trailStep();
    const sm = shield.material as THREE.MeshBasicMaterial; sm.opacity += ((guard ? 0.35 : 0) - sm.opacity) * 0.25;

    // враг: покачивание, взгляд, осколки, вспышка при ударе
    if (enemy) {
      const e = enemy;
      if (e.g.scale.x < e.base) e.g.scale.setScalar(Math.min(e.base, e.g.scale.x + dt * 3.5 * e.base));
      e.core.position.y = 0.8 + Math.abs(Math.sin(t * 3.2)) * 0.18;
      e.shards.rotation.y += dt * 1.8; e.pupil.position.z = Math.sin(t * 1.4) * 0.07;
      (e.core.material as THREE.MeshToonMaterial).emissiveIntensity = 0.35 + (flashT > 0 ? flashT * 8 : 0);
      hpBar.position.set(e.g.position.x, e.g.position.y + 2.5 * e.base + 0.2, e.g.position.z); hpBar.quaternion.copy(camera.quaternion);
      const f = Math.max(0, e.hp / e.max); hpFg.scale.x = Math.max(0.001, f); hpFg.position.x = -(1 - f) * 1.05;
    }
    flashT = Math.max(0, flashT - dt);

    // камера: оба бойца в центре окна сцены, лёгкое «дыхание»
    // дистанция по ширине кадра: оба бойца (x от −4.2 до 4.4) всегда влезают
    // план камеры меняется плавно (режиссёр — shot())
    const a = 1 - Math.exp(-dt * 5.5);
    camFocus.lerp(shotTo.focus, a); camZoom += (shotTo.zoom - camZoom) * a; camLift += (shotTo.lift - camLift) * a;
    const halfW = 5.4, dist = Math.max(10, halfW / (Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * aspect)) * camZoom;
    const sh = shake > 0 ? (Math.random() - 0.5) * shake : 0; shake = Math.max(0, shake - dt * 1.8);
    look.copy(camFocus);
    camera.position.set(look.x + Math.sin(t * 0.25) * 0.4 * k + sh, look.y + dist * camLift + sh, look.z + dist);
    camera.lookAt(look);
    sky.position.copy(camera.position);
  }

  return {
    scene, camera, update,
    theme(k: number, a: string, b: string) { worldK = k; colA = new THREE.Color(a).getHex(); colB = new THREE.Color(b).getHex(); buildGround(); ready = true; },
    /** Уголок мира по теме: одна тема — всегда один и тот же уголок. Возвращает номер варианта. */
    spot(seed: string) { const v = spotIndex(seed); if (v !== spotV || !ground.children.length) { spotV = v; buildGround(); } return v; },
    isReady: () => ready,
    setFog(c: THREE.Color) { (scene.fog as THREE.Fog).color.copy(c); },
    resize(w: number, h: number) { aspect = w / h; camera.aspect = aspect; camera.updateProjectionMatrix(); },
    frame(offsetX: number, offsetY: number, w: number, h: number) { if (offsetX || offsetY) camera.setViewOffset(w, h, offsetX, offsetY, w, h); else camera.clearViewOffset(); camera.updateProjectionMatrix(); },

    /** Катсцена входа: портал в воздухе → герой вылетает, приземляется, осматривается. */
    async arrive() {
      neutral(); guard = false;
      const P = new THREE.Vector3(HERO_X - 2.2, 2.3, 0.4);
      // облёт: общий план уголка сверху, камера опускается к порталу
      hero.g.scale.setScalar(0.01);
      camFocus.set(0.4, 0.8, -1.5); camZoom = 1.5; camLift = 0.75; shot(new THREE.Vector3(0.2, 1, -1), 1.2, 0.5);
      await wait(0.9);
      shot(new THREE.Vector3(HERO_X - 0.8, 1.8, 0.4), 0.62, 0.3);
      const portal = new THREE.Group(); portal.position.copy(P); portal.scale.setScalar(0.01); scene.add(portal);
      portal.add(new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.14, 8, 32), mat(0x35e6ff, 0x35e6ff, 2.2)));
      portal.add(new THREE.Mesh(new THREE.CircleGeometry(1.0, 32), new THREE.MeshBasicMaterial({ color: 0xbff9ff, transparent: true, opacity: 0.75 })));
      hero.g.position.copy(P); hero.g.scale.setScalar(0.01); hero.g.rotation.y = Math.PI / 2;
      await tween(0.35, u => portal.scale.setScalar(Math.max(0.01, easeBack(u))));
      burst(P, [0x35e6ff, 0xffffff, 0xa77bff], 30, 4);
      tween(0.2, u => hero.g.scale.setScalar(Math.max(0.01, u)));
      await jumpTo(HERO_X, 0.4, 1.1, 0.55, P.y);
      await land(true);
      tween(0.3, u => portal.scale.setScalar(Math.max(0.01, 1 - u))).then(() => scene.remove(portal));
      shot(heroAt(1.4), 0.5, 0.22);
      await lookAround();
    },
    /** Враг выпрыгивает из разлома и рычит; босс — с тряской земли и именем. Катсцена, промис. */
    async spawn(hp: number, kind = 0, boss = false) {
      if (enemy) scene.remove(enemy.g);
      const m = makeMob(kind), base = boss ? 1.5 : 1;
      enemy = Object.assign(m, { hp, max: hp, boss, base });
      const e = enemy;
      m.g.position.set(ENEMY_X, -2, 0.4); m.g.scale.setScalar(base); scene.add(m.g);
      shot(new THREE.Vector3(ENEMY_X - 0.4, 1.4 * base, 0.4), boss ? 0.75 : 0.58, 0.24);
      // разлом в земле
      const crack = new THREE.Mesh(new THREE.CircleGeometry(1.3 * base, 24), new THREE.MeshBasicMaterial({ color: 0x2a0838, transparent: true, opacity: 0.9 }));
      crack.rotation.x = -Math.PI / 2; crack.position.set(ENEMY_X, 0.02, 0.4); crack.scale.setScalar(0.01); scene.add(crack);
      if (boss) { shake = 0.9; ring(new THREE.Vector3(ENEMY_X, 0.1, 0.4), 0xff2a6a, 6); }
      await tween(boss ? 0.6 : 0.3, u => crack.scale.setScalar(Math.max(0.01, ease(u))));
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.9 * base, 0.9 * base, 12, 12, 1, true), new THREE.MeshBasicMaterial({ color: 0xff4fb8, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false }));
      beam.position.set(ENEMY_X, 6, 0.4); scene.add(beam);
      let bt = 0; fx.push({ update: dt => { bt += dt * 1.6; (beam.material as THREE.MeshBasicMaterial).opacity = 0.55 * (1 - bt); beam.scale.x = beam.scale.z = 1 - bt * 0.7; if (bt >= 1) { scene.remove(beam); return false; } return true; } });
      burst(new THREE.Vector3(ENEMY_X, 0.5, 0.4), [0xff4fb8, 0x8a3cff], 30, 4);
      await tween(0.45, u => { e.g.position.y = -2 + 2 * easeBack(u); });
      e.g.position.y = 0; hpBar.visible = true;
      // рык: раздувается, осколки крутятся быстрее, герой встаёт в стойку
      guard = true; shake = Math.max(shake, boss ? 0.6 : 0.3);
      if (boss) popText('МИНИ-БОСС', new THREE.Vector3(ENEMY_X, 3.8 * base, 0.4), '#ff4fb8', true);
      await tween(0.55, u => { e.core.scale.setScalar(1 + Math.sin(u * Math.PI) * 0.28); e.shards.rotation.y += 0.25; });
      tween(0.4, u => { (crack.material as THREE.MeshBasicMaterial).opacity = 0.9 * (1 - u); }).then(() => scene.remove(crack));
      guard = false; shot(null);
      await wait(0.25);
    },
    /** Удар героя. crit — удар с разворота, sup — прыжок с ударом по земле. Возвращает, повержен ли враг. */
    async attack(opts: { crit?: boolean; sup?: boolean; dmg?: number } = {}) {
      if (!enemy) return false;
      const e = enemy, dmg = opts.dmg ?? 1, last = e.hp - dmg <= 0;
      if (opts.sup) {
        guard = false; ring(new THREE.Vector3(HERO_X, 0.2, 0.4), 0xffcb2e, 2.5);
        shot(heroAt(1.2), 0.6, 0.2);
        acting = true;
        await tween(0.3, u => { hero.armR.rotation.x = -u * 3; glow(2 + u * 6); hero.hips.position.y = 0.95 - Math.sin(u * Math.PI / 2) * 0.2; });
        acting = false; hero.hips.position.y = 0.95;
        shot(new THREE.Vector3(ENEMY_X - 1.2, 1.8, 0.4), 0.75, 0.3);
        acting = true; trailOn = true; await jumpTo(ENEMY_X - 1.4, 0.4, 2.6, 0.45); hero.armR.rotation.x = 0.8; trailOn = false;
        acting = false;
      } else {
        if (last) shot(new THREE.Vector3(ENEMY_X - 0.8, 1.4, 0.4), 0.6, 0.22);
        await runTo(ENEMY_X - 1.6, 0.3);
        await swing(1, !!opts.crit);
      }
      e.hp = Math.max(0, e.hp - dmg); flashT = 0.12;
      const p = enemyPos();
      burst(p, opts.sup ? [0xffcb2e, 0xffffff, 0x35e6ff] : [0x35e6ff, 0xffffff, 0x3ddc6e], opts.sup ? 60 : opts.crit ? 36 : 20, opts.sup ? 8 : 5);
      popText(opts.sup ? `СУПЕР −${dmg}` : `−${dmg}`, p.clone().add(new THREE.Vector3(0, 1.4, 0)), opts.sup ? '#ffcb2e' : opts.crit ? '#35e6ff' : '#ffffff', !!(opts.sup || opts.crit));
      shake = opts.sup ? 0.8 : opts.crit ? 0.45 : 0.25;
      if (opts.sup) { ring(new THREE.Vector3(ENEMY_X - 0.6, 0.15, 0.4), 0xffcb2e, 5); land(true); }
      if (opts.sup || last) { slow = 0.25; slowT = last ? 0.5 : 0.35; }
      // отлёт врага
      const x0 = e.g.position.x;
      tween(0.25, u => { e.g.position.x = x0 + Math.sin(u * Math.PI) * (opts.sup ? 1.2 : 0.6); e.g.rotation.z = -Math.sin(u * Math.PI) * 0.3; });
      if (opts.sup) { await jumpTo(HERO_X, 0.4, 1.2, 0.4); hero.g.rotation.y = Math.PI / 2; shot(null); }
      else await runTo(HERO_X, 0.32);
      neutral();
      return e.hp <= 0;
    },
    /** Ход врага при ошибке: снаряд → щит героя, герой отшатывается. Урона нет. */
    async enemyAttack() {
      if (!enemy) return;
      const e = enemy;
      await tween(0.18, u => { e.g.position.x = ENEMY_X + Math.sin(u * Math.PI) * 0.4; e.core.scale.setScalar(1 + Math.sin(u * Math.PI) * 0.15); });
      guard = true;
      await projectile(enemyPos(), new THREE.Vector3(HERO_X + 0.6, 1.5, 0.4), 0xff4fb8);
      burst(new THREE.Vector3(HERO_X + 0.8, 1.5, 0.4), [0x35e6ff, 0xffffff], 18, 3, 0.14);
      popText('БЛОК', new THREE.Vector3(HERO_X, 3.2, 0.4), '#35e6ff');
      shake = 0.2;
      await tween(0.35, u => { const s = Math.sin(u * Math.PI); hero.g.position.x = HERO_X - s * 0.35; hero.body.rotation.x = -s * 0.25; });
      hero.body.rotation.x = 0; hero.g.position.x = HERO_X;
      guard = false;
    },
    /** Враг повержен: крупный план, распад на кубики и монеты. */
    async defeat() {
      if (!enemy) return;
      const e = enemy, p = enemyPos();
      shot(new THREE.Vector3(ENEMY_X - 0.4, 1.3, 0.4), 0.6, 0.24);
      await tween(0.3, u => { e.g.rotation.y += 0.4; e.g.scale.setScalar(e.base * (1 + u * 0.3)); flashT = 0.2; });
      scene.remove(e.g); hpBar.visible = false; enemy = null;
      burst(p, [0xff4fb8, 0x8a3cff, 0x35e6ff], 70, 7, 0.24); burst(p, [0xffcb2e], 16, 4, 0.2);
      ring(p, 0xff4fb8, 4); shake = 0.5;
      await wait(0.45);
      shot(null);
    },
    /** Катсцена победы: поза героя → сундук падает с неба → герой подходит, открывает → фонтан наград → радость в камеру. */
    async victory() {
      neutral(); guard = false;
      // 1. победная поза: прыжок с разворотом, меч вверх
      shot(heroAt(1.5), 0.48, 0.2);
      acting = true;
      const r0 = hero.g.rotation.y;
      trailOn = true;
      await tween(0.6, u => { hero.g.position.y = Math.sin(u * Math.PI) * 1.4; hero.g.rotation.y = r0 + u * (Math.PI * 1.5); hero.armR.rotation.x = -u * 3.1; glow(2 + u * 5); });
      trailOn = false;
      hero.g.position.y = 0; hero.g.rotation.y = 0;
      await land();
      burst(heroAt(3.4), [0xffcb2e, 0x35e6ff, 0xffffff], 40, 5);
      await wait(0.45);
      neutral();
      // 2. сундук падает с неба
      const C = new THREE.Vector3(0.9, 0, 1.3);
      const chest = new THREE.Group(); chest.position.set(C.x, 9, C.z); scene.add(chest);
      const cb = builder(chest, 'open'); cb(1.4, 0.9, 1, 0, 0.45, 0, 0x8a5a2b); cb(1.44, 0.14, 1.04, 0, 0.7, 0, 0xffcb2e, 0xffa000, 0.6);
      cb(0.26, 0.3, 0.1, 0, 0.55, 0.52, 0xffcb2e, 0xffa000, 0.8);
      const lid = new THREE.Group(); lid.position.set(0, 0.9, -0.5); chest.add(lid); builder(lid, 'open')(1.4, 0.4, 1, 0, 0.2, 0.5, 0x9c6632);
      shot(new THREE.Vector3((HERO_X + C.x) / 2, 1.3, C.z), 0.62, 0.3);
      hero.g.rotation.y = faceAngle(C.x, C.z); acting = true;
      tween(0.3, u => (hero.head.rotation.x = -u * 0.5));                      // герой смотрит вверх
      await tween(0.45, u => (chest.position.y = 9 * (1 - u * u)));
      chest.position.y = 0; shake = 0.55; ring(C.clone().setY(0.1), 0xffe9a8, 4); burst(C.clone().setY(0.3), [0xd8d0ff, 0xffffff], 22, 4, 0.16);
      await tween(0.2, u => { const s = Math.sin(u * Math.PI); chest.scale.set(1 + s * 0.15, 1 - s * 0.2, 1 + s * 0.15); });
      chest.scale.setScalar(1);
      // удивление: подпрыгнул на месте
      await tween(0.3, u => { hero.g.position.y = Math.sin(u * Math.PI) * 0.5; hero.head.rotation.x = -0.5 * (1 - u); hero.armL.rotation.z = Math.sin(u * Math.PI) * 0.8; hero.armR.rotation.z = -Math.sin(u * Math.PI) * 0.8; });
      neutral();
      // 3. подходит к сундуку
      await walkTo(C.x - 1.7, C.z, 0.6);
      hero.g.rotation.y = Math.PI / 2;
      shot(new THREE.Vector3(C.x - 0.5, 1.1, C.z), 0.42, 0.26);
      // 4. присел, тянет руки — крышка дрожит — открывается
      acting = true;
      await tween(0.3, u => { hero.hips.position.y = 0.95 - u * 0.28; hero.legL.rotation.x = -u * 0.9; hero.legR.rotation.x = -u * 0.5; hero.armL.rotation.x = hero.armR.rotation.x = -u * 1.3; });
      await tween(0.45, u => { lid.rotation.x = Math.sin(u * Math.PI * 6) * 0.12; chest.rotation.z = Math.sin(u * Math.PI * 8) * 0.04; });
      chest.rotation.z = 0;
      await tween(0.18, u => (lid.rotation.x = -u * 1.9));
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.75, 7, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0xffe07a, transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthWrite: false }));
      beam.position.set(C.x, 4.2, C.z); scene.add(beam);
      let bt = 0; fx.push({ update: dt => { bt += dt * 0.7; (beam.material as THREE.MeshBasicMaterial).opacity = 0.7 * (1 - bt); if (bt >= 1) { scene.remove(beam); return false; } return true; } });
      burst(C.clone().setY(1.2), [0xffcb2e, 0xffcb2e, 0xffe07a], 50, 6, 0.22); burst(C.clone().setY(1.2), [0xa77bff, 0x35e6ff, 0xffffff], 30, 5, 0.18);
      shake = 0.3;
      // 5. отпрыгнул и радуется в камеру
      await tween(0.25, u => { hero.hips.position.y = 0.67 + u * 0.28; hero.legL.rotation.x = -0.9 * (1 - u); hero.legR.rotation.x = -0.5 * (1 - u); hero.armL.rotation.x = hero.armR.rotation.x = -1.3 - u * 1.6; });
      shot(new THREE.Vector3(C.x - 0.8, 1.4, C.z), 0.55, 0.22);
      hero.g.rotation.y = 0;
      await tween(1.1, u => { hero.g.position.y = Math.abs(Math.sin(u * Math.PI * 3)) * 0.6; hero.armL.rotation.z = 0.4 + Math.sin(u * Math.PI * 6) * 0.3; hero.armR.rotation.z = -0.4 - Math.sin(u * Math.PI * 6) * 0.3; glow(3 + Math.sin(u * 20) * 2); });
      neutral(); hero.armL.rotation.x = hero.armR.rotation.x = 0;
      setTimeout(() => scene.remove(chest), 6000);
    },
    setTrail(c: number[] | null) { trail = c; },
    celebrate() { cheer = 1.2; burst(new THREE.Vector3(HERO_X, 3, 0.4), [0xffcb2e, 0x35e6ff], 30, 5); },
    clear() { if (enemy) { scene.remove(enemy.g); enemy = null; } hpBar.visible = false; guard = false; neutral(); hero.g.position.set(HERO_X, 0, 0.4); hero.g.rotation.y = Math.PI / 2; shot(null); },
    hasEnemy: () => !!enemy,
  };
}
export type Arena = ReturnType<typeof createArena>;
