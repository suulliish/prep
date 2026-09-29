// Боевая локация (docs/GAME_LOOP.md 3): остров текущего мира, герой слева, враг справа. Бой пошаговый:
// верный ответ — герой бежит и бьёт (цифра урона, вспышка, отлёт, тряска), серия 3 — суперудар с замедлением;
// неверный — враг стреляет, герой ставит щит (урона нет). Враг повержен — распад на кубики и монеты.
// Все действия — промисы, чтобы экран задачи ждал конца анимации и только потом показывал следующий вопрос.
import * as THREE from 'three';
import { makeHero, makeMob } from './characters';
import { builder, landmark, mat } from './map';

interface Deps { skyMat: THREE.Material; starGeo: THREE.BufferGeometry; starMat: THREE.Material; km: number; dressHero: (g: THREE.Object3D) => void }

const box = new THREE.BoxGeometry(1, 1, 1);
const HERO_X = -2.6, ENEMY_X = 2.8;

export function createArena(d: Deps) {
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x17104a, 30, 90);
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 400);
  const sky = new THREE.Mesh(new THREE.SphereGeometry(150, 32, 16), d.skyMat); scene.add(sky);
  scene.add(new THREE.Points(d.starGeo, d.starMat));
  scene.add(new THREE.HemisphereLight(0xb4c4ff, 0x40214a, 1.05));
  const sun = new THREE.DirectionalLight(0xffe6c8, 1.7); sun.position.set(-8, 16, 10); scene.add(sun);

  // ---------- остров ----------
  const ground = new THREE.Group(); scene.add(ground);
  function buildGround(k: number, A: number, B: number) {
    while (ground.children.length) ground.remove(ground.children[0]);
    const top: [number, number][] = [];
    for (let x = -8; x <= 8; x++) for (let z = -5; z <= 5; z++) if ((x * x) / 72 + (z * z) / 30 <= 1) top.push([x, z]);
    const under: [number, number, number][] = [];
    for (let k2 = 1; k2 <= 4; k2++) for (const [x, z] of top) if ((x * x) / (72 - k2 * 14) + (z * z) / (30 - k2 * 6) <= 1) under.push([x, -k2, z]);
    const im = new THREE.InstancedMesh(box, new THREE.MeshStandardMaterial({ roughness: 0.9, flatShading: true }), top.length + under.length);
    const m4 = new THREE.Matrix4(), col = new THREE.Color(); let n = 0;
    top.forEach(([x, z]) => { m4.makeTranslation(x, -0.5, z); im.setMatrixAt(n, m4); col.setHex((x + z) % 2 ? A : B); im.setColorAt(n++, col); });
    under.forEach(([x, y, z]) => { m4.makeTranslation(x, y - 0.5, z); im.setMatrixAt(n, m4); col.setHex(y === -1 ? 0x7a5236 : 0x5d5a70); im.setColorAt(n++, col); });
    ground.add(im);
    // ориентир мира на заднем плане
    const lm = new THREE.Group(); lm.position.set(0.4, 0, -3.4); lm.scale.setScalar(0.9); ground.add(lm);
    landmark(builder(lm, 'open'), k, A, B);
    // камни и кусты по краям
    const b = builder(ground, 'open');
    [[-6.5, -2], [6.4, -1.6], [-5.6, 2.8], [5.8, 3]].forEach(([x, z], i) => { b(0.9, 0.7, 0.9, x, 0.35, z, i % 2 ? 0x8a8aa0 : 0x3faa5a); b(0.6, 0.5, 0.6, x + 0.5, 0.25, z + 0.4, 0x2f8f4a); });
  }

  // ---------- герой ----------
  const hero = makeHero(); d.dressHero(hero.g); scene.add(hero.g);
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
  let shake = 0, slow = 1, slowT = 0, flashT = 0;
  let walking = false, guard = false, cheer = 0;

  async function runTo(x: number, dur: number) {
    const x0 = hero.g.position.x; walking = true;
    hero.g.rotation.y = x > x0 ? Math.PI / 2 : -Math.PI / 2;
    await tween(dur, u => { hero.g.position.x = x0 + (x - x0) * ease(u); });
    walking = false; hero.g.rotation.y = Math.PI / 2;
  }
  async function swing(power: number) {
    await tween(0.12, u => { hero.armR.rotation.x = -u * 2.6; hero.body.rotation.y = -u * 0.3; });
    await tween(0.1, u => { hero.armR.rotation.x = -2.6 + u * 3.4; hero.body.rotation.y = -0.3 + u * 0.6; });
    await tween(0.18 * power, u => { hero.armR.rotation.x = 0.8 * (1 - u); hero.body.rotation.y = 0.3 * (1 - u); });
  }
  const enemyPos = () => new THREE.Vector3(ENEMY_X, 1.3, 0.4);

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
    hero.legL.rotation.x = sw; hero.legR.rotation.x = -sw; hero.armL.rotation.x = guard ? -1.4 : walking ? -sw * 0.8 : Math.sin(t * 2) * 0.06;
    const hop = cheer > 0 ? Math.abs(Math.sin(cheer * 10)) * 0.8 : 0; cheer = Math.max(0, cheer - dt);
    hero.hips.position.y = 0.95 + hop + (walking ? Math.abs(Math.sin(t * 16)) * 0.08 : Math.sin(t * 2.4) * 0.025);
    hero.head.rotation.y = walking ? 0 : Math.sin(t * 0.8) * 0.2 * k;
    hero.eyes.forEach(e => (e.scale.y = (t % 3.7) < 0.12 ? 0.1 : 1));
    (hero.blade.material as THREE.MeshToonMaterial).emissiveIntensity = 1.6 + Math.sin(t * 6) * 0.5;
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
    const halfW = 5.4, dist = Math.max(10, halfW / (Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * aspect));
    const sh = shake > 0 ? (Math.random() - 0.5) * shake : 0; shake = Math.max(0, shake - dt * 1.8);
    camera.position.set(look.x + Math.sin(t * 0.25) * 0.4 * k + sh, look.y + dist * 0.28 + sh, look.z + dist);
    camera.lookAt(look);
    sky.position.copy(camera.position);
  }

  return {
    scene, camera, update,
    theme(k: number, a: string, b: string) { buildGround(k, new THREE.Color(a).getHex(), new THREE.Color(b).getHex()); ready = true; },
    isReady: () => ready,
    setFog(c: THREE.Color) { (scene.fog as THREE.Fog).color.copy(c); },
    resize(w: number, h: number) { aspect = w / h; camera.aspect = aspect; camera.updateProjectionMatrix(); },
    frame(offsetX: number, offsetY: number, w: number, h: number) { if (offsetX || offsetY) camera.setViewOffset(w, h, offsetX, offsetY, w, h); else camera.clearViewOffset(); camera.updateProjectionMatrix(); },

    /** Герой выходит из портала (вспышка) — начало уровня. */
    async arrive() {
      hero.g.position.set(HERO_X - 1.5, 0, 0.4); hero.g.scale.setScalar(0.01);
      ring(new THREE.Vector3(HERO_X - 1.5, 0.2, 0.4), 0x35e6ff, 3); burst(new THREE.Vector3(HERO_X - 1.5, 1.2, 0.4), [0x35e6ff, 0xffffff, 0xa77bff], 26, 4);
      await tween(0.35, u => hero.g.scale.setScalar(Math.max(0.01, ease(u))));
      await runTo(HERO_X, 0.35);
    },
    /** Новый враг: вылезает из разлома. boss — крупнее. */
    spawn(hp: number, kind = 0, boss = false) {
      if (enemy) scene.remove(enemy.g);
      const m = makeMob(kind), base = boss ? 1.5 : 1;
      enemy = Object.assign(m, { hp, max: hp, boss, base });
      m.g.position.set(ENEMY_X, 0, 0.4); m.g.scale.setScalar(0.01); scene.add(m.g);
      hpBar.visible = true;
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 12, 12, 1, true), new THREE.MeshBasicMaterial({ color: 0xff4fb8, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false }));
      beam.position.set(ENEMY_X, 6, 0.4); scene.add(beam);
      let t = 0; fx.push({ update: dt => { t += dt * 2; (beam.material as THREE.MeshBasicMaterial).opacity = 0.55 * (1 - t); beam.scale.x = beam.scale.z = 1 - t * 0.7; if (t >= 1) { scene.remove(beam); return false; } return true; } });
      burst(new THREE.Vector3(ENEMY_X, 1, 0.4), [0xff4fb8, 0x8a3cff], 24, 3);
    },
    /** Удар героя. crit — серия, sup — суперудар. Возвращает, повержен ли враг. */
    async attack(opts: { crit?: boolean; sup?: boolean; dmg?: number } = {}) {
      if (!enemy) return false;
      const e = enemy, dmg = opts.dmg ?? 1;
      if (opts.sup) {
        guard = false; ring(new THREE.Vector3(HERO_X, 0.2, 0.4), 0xffcb2e, 2.5);
        await tween(0.25, u => { hero.hips.position.y = 0.95 + Math.sin(u * Math.PI) * 0.4; (hero.blade.material as THREE.MeshToonMaterial).emissiveIntensity = 2 + u * 6; });
      }
      await runTo(ENEMY_X - 1.6, opts.sup ? 0.22 : 0.3);
      await swing(1);
      e.hp = Math.max(0, e.hp - dmg); flashT = 0.12;
      const p = enemyPos();
      burst(p, opts.sup ? [0xffcb2e, 0xffffff, 0x35e6ff] : [0x35e6ff, 0xffffff, 0x3ddc6e], opts.sup ? 60 : opts.crit ? 36 : 20, opts.sup ? 8 : 5);
      popText(opts.sup ? `СУПЕР −${dmg}` : `−${dmg}`, p.clone().add(new THREE.Vector3(0, 1.4, 0)), opts.sup ? '#ffcb2e' : opts.crit ? '#35e6ff' : '#ffffff', !!(opts.sup || opts.crit));
      shake = opts.sup ? 0.7 : opts.crit ? 0.45 : 0.25;
      if (opts.sup) { slow = 0.25; slowT = 0.35; ring(p, 0xffcb2e, 4); }
      // отлёт врага
      const x0 = e.g.position.x;
      tween(0.25, u => { e.g.position.x = x0 + Math.sin(u * Math.PI) * (opts.sup ? 1.2 : 0.6); e.g.rotation.z = -Math.sin(u * Math.PI) * 0.3; });
      await runTo(HERO_X, 0.32);
      return e.hp <= 0;
    },
    /** Ход врага при ошибке: снаряд → щит героя. Урона нет. */
    async enemyAttack() {
      if (!enemy) return;
      const e = enemy;
      await tween(0.18, u => { e.g.position.x = ENEMY_X + Math.sin(u * Math.PI) * 0.4; e.core.scale.setScalar(1 + Math.sin(u * Math.PI) * 0.15); });
      guard = true;
      await projectile(enemyPos(), new THREE.Vector3(HERO_X + 0.6, 1.5, 0.4), 0xff4fb8);
      burst(new THREE.Vector3(HERO_X + 0.8, 1.5, 0.4), [0x35e6ff, 0xffffff], 18, 3, 0.14);
      popText('БЛОК', new THREE.Vector3(HERO_X, 3.2, 0.4), '#35e6ff');
      shake = 0.2;
      await tween(0.35, () => {});
      guard = false;
    },
    /** Враг повержен: распад на кубики и монеты. */
    async defeat() {
      if (!enemy) return;
      const e = enemy, p = enemyPos();
      await tween(0.25, u => { e.g.rotation.y += 0.4; e.g.scale.setScalar(e.base * (1 + u * 0.25)); flashT = 0.2; });
      scene.remove(e.g); hpBar.visible = false; enemy = null;
      burst(p, [0xff4fb8, 0x8a3cff, 0x35e6ff], 70, 7, 0.24); burst(p, [0xffcb2e], 16, 4, 0.2);
      ring(p, 0xff4fb8, 4); shake = 0.5;
      await tween(0.4, () => {});
    },
    /** Победа уровня: герой празднует, сундук. */
    async victory() {
      cheer = 1.4; burst(new THREE.Vector3(HERO_X, 3, 0.4), [0xffcb2e, 0x35e6ff, 0xa77bff], 50, 6);
      const chest = new THREE.Group(); chest.position.set(0.3, 0, 1.2); chest.scale.setScalar(0.01); scene.add(chest);
      const cb = builder(chest, 'open'); cb(1.4, 0.9, 1, 0, 0.45, 0, 0x8a5a2b); cb(1.44, 0.14, 1.04, 0, 0.7, 0, 0xffcb2e, 0xffa000, 0.6);
      const lid = new THREE.Group(); lid.position.set(0, 0.9, -0.5); chest.add(lid); builder(lid, 'open')(1.4, 0.4, 1, 0, 0.2, 0.5, 0x9c6632);
      await tween(0.35, u => chest.scale.setScalar(Math.max(0.01, ease(u))));
      await tween(0.35, u => (lid.rotation.x = -u * 1.9));
      burst(new THREE.Vector3(0.3, 1.2, 1.2), [0xffcb2e, 0xffffff, 0xa77bff], 60, 7, 0.2);
      await tween(0.6, () => {});
      setTimeout(() => scene.remove(chest), 2500);
    },
    celebrate() { cheer = 1.2; burst(new THREE.Vector3(HERO_X, 3, 0.4), [0xffcb2e, 0x35e6ff], 30, 5); },
    clear() { if (enemy) { scene.remove(enemy.g); enemy = null; } hpBar.visible = false; guard = false; hero.g.position.set(HERO_X, 0, 0.4); hero.g.scale.setScalar(1); },
    hasEnemy: () => !!enemy,
  };
}
export type Arena = ReturnType<typeof createArena>;
