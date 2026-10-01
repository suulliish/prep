// Герой на тренировке (урок): что он делает на каждом шаге, кроме ударов по манекену (их ведёт arena.ts).
//   goal: разминка (прыжки, отжимания, круг по песку) · example: садится и слушает Бита · why: блок и контратака · bug: уворачивается от сгустков ошибки ·
//   blitz: лук, бросок, магия по очереди (промах — мимо мишени) · rule: «приём освоен» (руки вверх, кольцо света) · final: разбег, прыжок, удар, радость, ложится отдохнуть.
// Главное правило: герой никого не заставляет ждать. Всё, что идёт «фоном» (разминка, сидение, отдых), обрывается любым следующим действием мгновенно (токен tok),
// а оборванное действие само возвращает героя на место, в стойку, с мечом и щитом (recover). Уход с экрана (reset) убирает всё: лук, сгустки, стрелы, позу.
// Как и attacks.ts, модуль не крутит своего кадрового цикла: арена даёт «ручки» (TrainEnv). km < 1 («уменьшить движение»): без пробежки, прыжков и сгустков; сидение, стойка, мягкие удары остаются.
import * as THREE from 'three';
import type { Actor } from './actor';
import type { Training } from './training3d';
import type { Vfx } from './vfx';
import type { Sfx } from '../lib/audio';
import { ENEMY_X, HERO_X, Z0 } from './attacks';
import { SHOT_CLIPS, type ShotKind, type Shots } from './shots';

interface Tok { dead: boolean; waiters: Set<() => void> }
const mkTok = (): Tok => ({ dead: false, waiters: new Set() });

export interface TrainEnv {
  scene: THREE.Scene; vfx: Vfx; km: number; sfx(n: Sfx): void;
  /** Выстрелы (лук, бросок, магия): общий код с боем, shots.ts. */
  shots: Shots;
  hero(): Actor | null;
  training(): Training | null;
  /** Покадровый обработчик (dt с замедлением); false — убрать. */
  fx(u: (dt: number) => boolean): void;
  /** Твин; stop() = true — оборвать без завершающего шага (промис завершается). */
  tween(dur: number, step: (u: number) => void, stop?: () => boolean): Promise<void>;
  burst(pos: THREE.Vector3, colors: number[], n?: number, speed?: number, size?: number): void;
  ring(pos: THREE.Vector3, color: number, max?: number): void;
  shake(v: number): void;
  faceAngle(x: number, z: number): number;
  /** Бегом в точку (лицом по ходу), потом стойка. */
  run(x: number, z: number, dur: number, stop?: () => boolean): Promise<void>;
  /** Домой: на своё место лицом к манекену, стойка (быстро, если далеко). */
  home(): Promise<void>;
  /** Действие в очереди арены (busy, «живое ожидание» молчит, предел 12 с). */
  queue<T>(fn: () => Promise<T>): Promise<T>;
  busy(): number;
  targetPoint(): THREE.Vector3 | null;
  knock(tr: Training): void;
  block(o?: { text?: boolean }): Promise<void>;
  /** Удар по манекену клипом героя (arena.trainSwing). */
  strike(clip: string, speed: number, onHit: () => void, stay: boolean): Promise<void>;
  guard(on: boolean): void;
  stance(): void;
}

/** Где садится слушать: спереди слева от манекена, лицом к доске (доска справа-сзади, Бит пишет на ней). */
const SEAT = { x: ENEMY_X - 1.3, z: Z0 + 1.45 };
const BOARD = { x: ENEMY_X + 2.0, z: Z0 - 2.2 };
const DODGES = ['Dodge_Left', 'Dodge_Right', 'Dodge_Backward'] as const;
const PINK = 0xff4fb8;
type Pose = '' | 'warm' | 'sit' | 'lie' | 'stand';
export type { ShotKind };

export function createTrainHero(env: TrainEnv) {
  const calm = env.km < 1;
  // tok — фоновое действие (обрывается любым следующим), genTok — всё, что ждёт снаряд или выстрел (обрывается уходом с урока сразу)
  let tok = mkTok(), genTok = mkTok(), gen = 0;
  let pose: Pose = '', stepKind = '', arrived = false, warmed = false;
  let dodgeN = 0, volleyOn = false, volleyGen = 0;

  /** Оборвать фоновое действие: его ожидания завершаются сразу. */
  function cancelBg() { const t = tok; tok = mkTok(); t.dead = true; t.waiters.forEach(f => f()); t.waiters.clear(); }
  const until = <T>(t: Tok, p: Promise<T>) => new Promise<T | undefined>(res => { if (t.dead) return res(undefined); t.waiters.add(() => res(undefined)); p.then(res, () => res(undefined)); });
  const pl = (t: Tok, h: Actor, name: string, o: Parameters<Actor['play']>[1] = {}) => until(t, h.play(name, o));
  const tw = (t: Tok, dur: number, step: (u: number) => void) => env.tween(dur, step, () => t.dead);
  const wt = (t: Tok, s: number) => tw(t, s, () => {});
  const ok = (t: Tok, h: Actor) => !t.dead && env.hero() === h;

  /** Вернуть героя: поза снята, предметы в руках убраны, стойка с мечом и щитом, на своём месте. */
  async function recover(h: Actor) {
    pose = ''; h.carry([]); h.g.position.y = 0; h.g.scale.setScalar(1);
    h.play('Idle_A', { loop: true, fade: 0.12 });
    if (env.hero() === h) await env.home();
  }
  /** Фоновое действие в очереди арены: прежнее оборвано, само оно обрывается любым следующим (interrupt / другой bg). */
  function bg(fn: (t: Tok, h: Actor) => Promise<void>) {
    cancelBg(); const t = tok;
    return env.queue(async () => {
      const h = env.hero(); if (!h || t.dead) return;
      try { await fn(t, h); } finally { if (t.dead || env.hero() !== h) await recover(h); }
    });
  }
  /** Любое обычное действие арены (удар, бонк, бросок) обрывает фон; сидящий или лежащий герой вскакивает сразу. */
  function interrupt() {
    cancelBg();
    if (pose) { pose = ''; const h = env.hero(); if (h) { h.carry([]); h.play('Idle_A', { loop: true, fade: 0.12 }); h.g.position.y = 0; } }
  }

  // ---------- разминка: прыжки, отжимания, круг по песку ----------
  function warmup() {
    warmed = true;
    return bg(async (t, h) => {
      pose = 'warm';
      if (calm) { h.play('Push_Ups', { loop: true, speed: 0.9, fade: 0.15 }); await wt(t, 1.3); if (!ok(t, h)) return; env.stance(); pose = ''; return; }
      const hop = async () => {
        await Promise.all([pl(t, h, 'Jump_Full_Short', { speed: 1.7, fade: 0.06 }), tw(t, 0.69, u => { h.g.position.y = Math.sin(u * Math.PI) * 0.85; })]);
        h.g.position.y = 0; env.sfx('land');
      };
      await hop(); if (!ok(t, h)) return; await hop(); if (!ok(t, h)) return;
      h.play('Push_Ups', { loop: true, speed: 1.5, fade: 0.1 }); await wt(t, 1.4); if (!ok(t, h)) return;
      // круг по песку вокруг манекена: подбег, полный круг лицом по ходу, возвращение
      const cx = ENEMY_X, cz = Z0, r = 1.75, x0 = h.g.position.x, z0 = h.g.position.z, sx = cx - r;
      h.play('Running_A', { loop: true, speed: 1.25, fade: 0.1 });
      h.g.rotation.y = Math.atan2(sx - x0, cz - z0);
      await tw(t, 0.6, u => { h.g.position.x = x0 + (sx - x0) * u; h.g.position.z = z0 + (cz - z0) * u; }); if (!ok(t, h)) return;
      await tw(t, 1.6, u => { const th = Math.PI - Math.PI * 2 * u; h.g.position.set(cx + Math.cos(th) * r, 0, cz + Math.sin(th) * r); h.g.rotation.y = Math.atan2(Math.sin(th), -Math.cos(th)); }); if (!ok(t, h)) return;
      h.g.rotation.y = Math.atan2(HERO_X - sx, Z0 - cz);
      await tw(t, 0.6, u => { h.g.position.x = sx + (HERO_X - sx) * u; h.g.position.z = cz + (Z0 - cz) * u; }); if (!ok(t, h)) return;
      h.g.rotation.y = Math.PI / 2; pose = ''; env.stance();
    });
  }

  // ---------- сидит и слушает / лежит отдыхает ----------
  function sit() {
    return bg(async (t, h) => {
      pose = 'sit';
      await env.run(SEAT.x, SEAT.z, 0.6, () => t.dead); if (!ok(t, h)) return;
      const y0 = h.g.rotation.y, y1 = Math.atan2(BOARD.x - SEAT.x, BOARD.z - SEAT.z) - 0.25;
      await tw(t, 0.25, u => { h.g.rotation.y = y0 + Math.atan2(Math.sin(y1 - y0), Math.cos(y1 - y0)) * u; });
      await pl(t, h, 'Sit_Floor_Down', { speed: 1.3, then: 'Sit_Floor_Idle' });
    });
  }
  /** Встать (из сидения или лёжа) и вернуться на место. */
  function stand() {
    const lying = pose === 'lie';
    return bg(async (t, h) => {
      pose = 'stand';
      await pl(t, h, lying ? 'Lie_StandUp' : 'Sit_Floor_StandUp', { speed: lying ? 1.5 : 1.3, then: 'Idle_A' }); if (!ok(t, h)) return;
      await env.run(HERO_X, Z0, 0.6, () => t.dead); if (!ok(t, h)) return;
      h.g.rotation.y = Math.PI / 2; pose = ''; env.stance();
    });
  }
  /** Ушёл с шага (или пришёл на новый): смена позы по типу шага. Пока площадка не встала, только запоминаем. */
  function setStep(kind: string) {
    stepKind = kind;
    if (!arrived) return;
    if (pose === 'sit' && kind !== 'example') void stand();
    else if (pose === 'lie' && kind !== 'final') void stand();
    else if (kind === 'example' && (!pose || pose === 'warm' || pose === 'stand')) void sit();
    else if (kind === 'goal' && !warmed && !pose) void warmup();
    else if (kind !== 'example' && kind !== 'goal') cancelBg();
  }
  function onArrived() { arrived = true; setStep(stepKind); warm(); }
  /** Прогрев: лук, стрела, светящийся шар и клипы выстрелов создаются заранее, первый выстрел не подтормаживает. */
  function warm() {
    const my = gen, h = env.hero();
    env.shots.warm(new THREE.Vector3(HERO_X, 1.2, Z0 + 0.5), () => gen === my);
    h?.prime(SHOT_CLIPS);
  }

  // ---------- «приём освоен» ----------
  function mastered(color: number) {
    return bg(async (t, h) => {
      pose = 'stand';
      const at = () => new THREE.Vector3(h.g.position.x, 0.15, h.g.position.z);
      let up = false;
      env.fx(dt => { if (up || t.dead || env.hero() !== h) return false; env.vfx.charge(new THREE.Vector3(h.g.position.x, 1.3, h.g.position.z + 0.3), color, dt, 1.8); return true; });
      env.sfx('crystal');
      await pl(t, h, 'Ranged_Magic_Raise', { speed: 1.25, marks: [{ at: 0.4, fn: () => {
        up = true; env.sfx('levelup');
        const p = at(); env.ring(p, color, 2.4); env.ring(p, 0xffffff, 3.4);
        env.vfx.glow(new THREE.Vector3(p.x, 1.3, p.z), color, 3.6, 0.5); env.vfx.levelUpPillar(p, color, 4.2);
        env.vfx.sparkleShower(new THREE.Vector3(p.x, 2.8, p.z + 0.3), [color, 0xffffff, 0xffcb2e], calm ? 10 : 30);
        env.burst(new THREE.Vector3(p.x, 1.2, p.z), [color, 0xffffff], calm ? 6 : 16, 4);
        wt(t, 0.28).then(() => { if (ok(t, h)) env.ring(at(), color, 4.6); });
      } }] });
      up = true; if (!ok(t, h)) return;
      pose = ''; env.stance();
    });
  }

  // ---------- победа: разбег, прыжок, удар с разворотом, радость, отдых лёжа ----------
  /** Промис — в момент касания удара (экран показывает «МЕҢГЕРІЛДІ!»); дальше герой сам радуется и ложится на песок. */
  function victory(hitFx: () => void): Promise<void> {
    let touch: () => void = () => {}; const impact = new Promise<void>(r => (touch = r));
    // фон могут отменить до старта (почёсывание после бонка): тогда промис всё равно разрешается, иначе кнопка урока ждёт вечно
    void bg(async (t, h) => {
      pose = 'stand';
      const onHit = () => { hitFx(); touch(); };
      try {
        if (!calm) {
          const x1 = ENEMY_X - 1.9, x0 = -1.6;
          await env.run(x0, Z0, 0.22, () => t.dead); if (!ok(t, h)) return;
          h.g.rotation.y = Math.PI / 2;
          await Promise.all([pl(t, h, 'Jump_Full_Long', { speed: 2.2, fade: 0.06 }), tw(t, 1.06, u => {
            const k = Math.min(1, Math.max(0, (u - 0.2) / 0.55)), e = k * k * (3 - 2 * k);
            h.g.position.x = x0 + (x1 - x0) * e; h.g.position.y = Math.sin(k * Math.PI) * 1.5;
          })]);
          h.g.position.y = 0; env.sfx('land'); env.shake(0.2); env.vfx.dust(new THREE.Vector3(h.g.position.x, 0, h.g.position.z), 1.1);
          if (!ok(t, h)) return;
        }
        await env.strike('Melee_2H_Attack_Spinning', 1.0, onHit, true); if (!ok(t, h)) return;
      } finally { touch(); }
      env.training()?.cheer();
      h.g.rotation.y = 0.5;
      await pl(t, h, 'Cheering', { speed: 1.1 }); if (!ok(t, h)) return;
      h.g.rotation.y = Math.PI / 2;
      // ложится на песок чуть глубже в площадку, а не на её край
      { const x0 = h.g.position.x, z0 = h.g.position.z; await tw(t, 0.3, u => { h.g.position.x = x0 + 0.5 * u; h.g.position.z = z0 + (Z0 + 0.5 - z0) * u; }); if (!ok(t, h)) return; }
      pose = 'lie';
      await pl(t, h, 'Lie_Down', { speed: 1.5, then: 'Lie_Idle' });
    }).finally(() => touch());
    return impact;
  }

  // ---------- сгустки ошибки на шаге «Глитчтің қатесі» ----------
  const rnd = (a: number, b: number) => a + Math.random() * (b - a);
  const chest = (x = HERO_X) => new THREE.Vector3(x, 1.25, Z0);
  /** Один залп: манекен плюётся, сгусток летит в героя, герой уворачивается (по кругу: влево, вправо, назад), сгусток пролетает мимо или шлёпается там, где он стоял. */
  async function volley() {
    const tr = env.training(), h = env.hero(); if (!tr || !h) return;
    const t = tok, my = gen, kind = DODGES[dodgeN++ % 3];
    await tr.spit(); if (!ok(t, h) || my !== gen) return;
    const from = tr.anchor(), hx = h.g.position.x, target = chest(hx), back = kind === 'Dodge_Backward';
    const to = back ? target.clone().setY(0.3) : from.clone().lerp(target, 1.6);
    const dur = back ? 0.75 : 0.85;
    env.sfx('slash'); env.vfx.glow(from, PINK, 2, 0.3);
    env.shots.orb(PINK, 1, from, to, dur, back ? 1.4 : 0, () => gen === my, () => { if (back) { env.vfx.poof(new THREE.Vector3(to.x, 0.4, to.z), PINK, 0.8); env.burst(to.clone().setY(0.3), [PINK, 0xffffff], 10, 4); env.sfx('impact'); } else env.vfx.poof(to.clone(), PINK, 0.5); });
    await wt(t, 0.32); if (!ok(t, h) || my !== gen) return;
    const dz = kind === 'Dodge_Left' ? -1.1 : kind === 'Dodge_Right' ? 1.1 : 0, dx = back ? -0.9 : 0, x0 = h.g.position.x, z0 = h.g.position.z;
    env.sfx('slash');
    const d = h.play(kind, { speed: 1.2 });
    await tw(t, 0.42, u => { const s = Math.sin(u * Math.PI * 0.5); h.g.position.x = x0 + dx * s; h.g.position.z = z0 + dz * s; });
    await wt(t, 0.35); await until(t, d); if (!ok(t, h) || my !== gen) return;
    await tw(t, 0.3, u => { h.g.position.x = x0 + dx * (1 - u); h.g.position.z = z0 + dz * (1 - u); });
    h.g.position.set(x0, 0, z0); env.stance();
  }
  /** Пока шаг «Глитч» открыт: раз в 2–3 с залп (не при км < 1; не мешает другому действию арены). */
  function volleys(on: boolean) {
    volleyOn = on && !calm; const my = ++volleyGen;
    if (!volleyOn) return;
    void (async () => {
      const g0 = gen; const pause = (s: number) => env.tween(s, () => {});
      await pause(rnd(1.6, 2.4));
      while (volleyOn && my === volleyGen && g0 === gen) {
        if (arrived && env.busy() === 0 && !pose) await env.queue(() => volley()).catch(() => {});
        await pause(rnd(1.4, 2.2));
      }
    })();
  }

  // ---------- стрельбище: лук, бросок, магия ----------
  const ORDER: ShotKind[] = ['bow', 'throw', 'magic'];
  let shotN = 0, missN = 0;
  /** Выстрел по очереди разными способами. Попадание — onLand в момент, когда снаряд долетел; промах — снаряд уходит мимо мишени. Промис — когда герой закончил. */
  async function shoot(miss: boolean, onLand: () => void): Promise<void> {
    const h = env.hero(); if (!h) return;
    const want = ORDER[(miss ? missN++ : shotN++) % 3];
    const my = gen, gt = genTok;
    const { kind, bow } = await env.shots.prepare(want); if (my !== gen) return;
    const tp0 = env.targetPoint() ?? new THREE.Vector3(ENEMY_X - 1.8, 1.1, Z0 - 1.6);
    const tp = miss ? tp0.clone().add(new THREE.Vector3(1.3, 0.7, -1.4)) : tp0;
    h.g.rotation.y = env.faceAngle(tp.x, tp.z);
    const hit = () => { if (miss) { env.vfx.dust(new THREE.Vector3(tp.x, 0, tp.z), 0.8, 0xe6cf98); env.sfx('land'); } else { env.vfx.hitSpark(tp, 0xffcb2e, 0.8); onLand(); } };
    // ожидания по игровому времени (замедление и пауза кадров их не обгоняют); уход с урока (reset) обрывает их сразу
    await env.shots.fire(h, { kind, bow, to: tp, miss, onLand: hit }, {
      alive: () => gen === my,
      wait: p => until(gt, p),
      within: (p, s) => until(gt, Promise.race([p, env.tween(s, () => {}, () => gt.dead)])),
      pause: s => until(gt, env.tween(s, () => {}, () => gt.dead)),
    });
    if (my !== gen) return;
    h.g.rotation.y = Math.PI / 2; env.stance();
  }

  /** Стойка после боя с тенью и любого прочего: предметы в руках убраны. */
  function reset() {
    cancelBg(); gen++; volleyOn = false; volleyGen++; env.shots.clear();
    { const t = genTok; genTok = mkTok(); t.dead = true; t.waiters.forEach(f => f()); t.waiters.clear(); }
    const h = env.hero(); pose = ''; stepKind = ''; arrived = false; warmed = false; dodgeN = 0; shotN = 0; missN = 0;
    // сначала обрыв клипа (несработавшие метки выстрела уже видят новое поколение и молчат), потом предметы из рук
    if (h) { h.play('Idle_A', { loop: true, fade: 0.1 }); h.carry([]); h.g.scale.setScalar(1); }
  }
  /** Модель героя заменили (смена костюма): позы и предметы прежней модели больше нет. */
  function heroReplaced() { cancelBg(); pose = ''; }

  return {
    setStep, onArrived, interrupt, mastered, victory, volleys, shoot, reset, heroReplaced,
    posed: () => pose !== '',
    /** Проверки: поза героя и тип шага. */
    state: () => ({ pose, stepKind, arrived }),
    dispose() { reset(); },
  };
}
export type TrainHero = ReturnType<typeof createTrainHero>;
