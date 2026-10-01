// Тренировочная площадка (src/three/training3d.ts): появление, удары и отдача, бонк, глитч и разбор на доски, мишени, доска, конфетти, бюджет и освобождение памяти. Без GPU и DOM.
import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { createTraining, type Training } from '../src/three/training3d';
import { ENEMY_X, HERO_X, Z0 } from '../src/three/attacks';

const make = (o: Partial<{ quality: 'high' | 'low'; km: number; onSlap: (p: THREE.Vector3) => void; vfx: unknown }> = {}) => {
  const scene = new THREE.Scene();
  const t = createTraining(scene, { quality: 'high', km: 1, ...o } as never);
  return { scene, t };
};
/** Гнать время: n секунд кадрами по 1/30; возвращает последнее t. */
function run(t: Training, sec: number, t0 = 0, each?: () => void) { let x = t0; for (let i = 0; i < Math.round(sec * 30); i++) { x += 1 / 30; t.update(1 / 30, x); each?.(); } return x; }
/** Дождаться промиса, гоняя кадры (не больше 12 с). */
async function until<T>(t: Training, p: Promise<T>, each?: () => void): Promise<number> {
  let done = false; p.then(() => (done = true)); let x = 0;
  for (let i = 0; i < 360 && !done; i++) { x += 1 / 30; t.update(1 / 30, x); each?.(); await Promise.resolve(); await Promise.resolve(); }
  expect(done, 'действие завершилось').toBe(true); return x;
}
const node = (t: Training, name: string) => t.g.getObjectByName(name)!;
const shown = async (o: Parameters<typeof make>[0] = {}) => { const m = make(o); const p = m.t.show(true); await until(m.t, p); return m; };

describe('training3d: появление', () => {
  it('до show ничего не рисуется; show выращивает манекен и выкатывает две мишени; повторный show — сразу', async () => {
    const { t } = make();
    expect(t.g.visible).toBe(false); expect(t.drawCalls()).toBe(0);
    await until(t, t.show(true)); run(t, 1.5);
    expect(t.g.visible).toBe(true); expect(t.stats().targetsUp).toBe(2);
    expect(node(t, 'dummy').scale.y).toBeGreaterThan(0.95); expect(node(t, 'dummy').scale.y).toBeLessThan(1.06);
    expect(t.g.position.x).toBe(ENEMY_X); expect(t.g.position.z).toBe(Z0);
    const a = t.anchor(); expect(a.x).toBeCloseTo(ENEMY_X, 3); expect(a.y).toBeGreaterThan(1); expect(a.y).toBeLessThan(1.6);
    await until(t, t.show(true));
  });
  it('манекен вырастает с перелётом (пружинка): в какой-то момент выше нормы, потом садится', async () => {
    const { t } = make(); let max = 0; const p = t.show(true);
    await until(t, p, () => { max = Math.max(max, node(t, 'dummy').scale.y); });
    expect(max).toBeGreaterThan(1.02); run(t, 1); expect(node(t, 'dummy').scale.y).toBeLessThan(1.05);
  });
  it('show(false) убирает всё: группа скрыта, мишеней нет', async () => {
    const { t } = await shown(); await until(t, t.show(false));
    expect(t.g.visible).toBe(false); expect(t.stats().targetsUp).toBe(0); expect(t.drawCalls()).toBe(0);
  });
  it('удары до появления безвредны и сразу завершаются', async () => {
    const { t } = make(); await until(t, t.hit('strong')); await until(t, t.bonk()); await until(t, t.breakGlitch()); await until(t, t.targetHit());
    t.targetMiss(); t.board('x'); t.cheer(); t.glitch(true); run(t, 0.5);
  });
});

describe('training3d: удары', () => {
  const lean = (t: Training) => Math.abs(node(t, 'swing').rotation.z);
  /** Наибольшее отклонение за первые 0.6 с после удара. */
  async function peak(kind: 'light' | 'strong' | 'combo', n = 1, km = 1) {
    const { t } = await shown({ km }); run(t, 1.5, 5); let m = 0; const p = t.hit(kind, n);
    await until(t, p, () => { m = Math.max(m, lean(t)); }); run(t, 0.4, 20, () => { m = Math.max(m, lean(t)); });
    return { t, m };
  }
  it('сильнее удар — сильнее отклонение; связка нарастает 1 < 2 < 3', async () => {
    const [l, s, c1, c2, c3] = [await peak('light'), await peak('strong'), await peak('combo', 1), await peak('combo', 2), await peak('combo', 3)].map(x => x.m);
    expect(s).toBeGreaterThan(l); expect(c1).toBeLessThan(c2); expect(c2).toBeLessThan(c3);
    expect(l).toBeGreaterThan(0.08); expect(c3).toBeLessThan(0.7);
  });
  it('манекен отклоняется от героя (вправо) и затухает: через 3 с почти покой', async () => {
    const { t } = await peak('strong').then(r => r); const z = () => node(t, 'swing').rotation.z;
    run(t, 3, 30); expect(Math.abs(z())).toBeLessThan(0.04);
  });
  it('солома летит, частиц не больше 80 даже при серии ударов, конфетти и разбора', async () => {
    const { t } = await shown(); let mx = 0;
    const each = () => { mx = Math.max(mx, t.stats().particles); };
    for (const [k, n] of [['strong', 1], ['combo', 3], ['light', 1], ['combo', 3]] as const) { t.hit(k, n); run(t, 0.1, 40, each); }
    t.cheer(); t.breakGlitch(); run(t, 3, 50, each);
    expect(mx).toBeGreaterThan(10); expect(mx).toBeLessThanOrEqual(80);
  });
  it('солома и звёзды исчезают сами', async () => {
    const { t } = await shown(); t.hit('strong'); t.cheer(); run(t, 6, 10);
    expect(t.stats().particles).toBe(0); expect(t.stats().stars).toBe(0);
  });
  it('вспышка связки (n = 3) зовёт критический всплеск vfx, обычный удар — искры', async () => {
    const vfx = { hitSpark: vi.fn(), critBurst: vi.fn(), dust: vi.fn(), sparkleShower: vi.fn() };
    const { t } = await shown({ vfx }); vfx.dust.mockClear();
    await until(t, t.hit('light')); expect(vfx.hitSpark).toHaveBeenCalled(); expect(vfx.critBurst).not.toHaveBeenCalled();
    await until(t, t.hit('combo', 3)); expect(vfx.critBurst).toHaveBeenCalledTimes(1);
    t.cheer(); expect(vfx.sparkleShower).toHaveBeenCalled();
  });
  it('n вне 1..3 и дробное не ломают связку', async () => {
    const { t } = await shown(); await until(t, t.hit('combo', 0)); await until(t, t.hit('combo', 9)); await until(t, t.hit('combo', 2.4));
  });
});

describe('training3d: бонк', () => {
  it('манекен бросается к герою, шлёпает (onSlap ровно один раз у головы героя) и возвращается', async () => {
    const onSlap = vi.fn(); const { t } = await shown({ onSlap }); run(t, 1.5, 5);
    let minX = 0; await until(t, t.bonk(), () => { minX = Math.min(minX, node(t, 'dummy').position.x); });
    expect(onSlap).toHaveBeenCalledTimes(1);
    const at = onSlap.mock.calls[0][0] as THREE.Vector3; expect(Math.abs(at.x - HERO_X)).toBeLessThan(1); expect(at.y).toBeGreaterThan(1.8);
    expect(minX).toBeLessThan(-3); run(t, 1, 20);
    expect(Math.abs(node(t, 'dummy').position.x)).toBeLessThan(0.01); expect(node(t, 'dummy').position.y).toBeLessThan(0.02);
  });
  it('бросок целится в переданную позицию героя', async () => {
    const scene = new THREE.Scene(), t = createTraining(scene, { quality: 'high', km: 1, hero: () => new THREE.Vector3(-0.5, 0, 0.4) });
    await until(t, t.show(true)); let minX = 0; await until(t, t.bonk(), () => { minX = Math.min(minX, node(t, 'dummy').position.x); });
    expect(minX).toBeGreaterThan(-3.6); expect(minX).toBeLessThan(-0.8);
  });
  it('km < 1: без прыжков и рывков (остаётся на месте), но шлепок засчитан', async () => {
    const onSlap = vi.fn(); const { t } = await shown({ km: 0.3, onSlap });
    let minX = 0, maxY = 0; await until(t, t.bonk(), () => { minX = Math.min(minX, node(t, 'dummy').position.x); maxY = Math.max(maxY, node(t, 'dummy').position.y); });
    expect(minX).toBe(0); expect(maxY).toBeLessThan(0.02); expect(onSlap).toHaveBeenCalledTimes(1); expect(t.stats().particles).toBe(0);
  });
});

describe('training3d: глитч', () => {
  it('glitch(true) включает розовое свечение и экран, glitch(false) гасит', async () => {
    const { t } = await shown(); t.glitch(true); run(t, 1, 5);
    expect(t.stats().glitch).toBeGreaterThan(0.9);
    const em = () => ((node(t, 'dummy').getObjectByName('torso') as THREE.Mesh).material as THREE.MeshToonMaterial).emissive;
    expect(em().r).toBeGreaterThan(0.2);
    t.glitch(false); run(t, 2, 10); expect(t.stats().glitch).toBeLessThan(0.02); expect(em().r).toBeLessThan(0.05);
  });
  it('breakGlitch: части разлетаются (высоко и в стороны), доски видны, потом всё собирается на прежние места, глитч выключен', async () => {
    const { t } = await shown(); t.glitch(true); run(t, 0.6, 5);
    const parts = ['torso', 'head', 'armL', 'armR', 'tail'].map(n => node(t, n)), rest = parts.map(p => p.position.clone());
    let spread = 0, planksSeen = false; const planks = t.g.children.find(c => (c as THREE.InstancedMesh).isInstancedMesh && (c as THREE.InstancedMesh).count === 8 && c.name === 'planks')!;
    const p = t.breakGlitch();
    await until(t, p, () => { parts.forEach((m, i) => { spread = Math.max(spread, m.position.distanceTo(rest[i])); }); planksSeen ||= planks.visible; });
    expect(spread).toBeGreaterThan(0.8); expect(planksSeen).toBe(true);
    run(t, 1, 20);
    parts.forEach((m, i) => expect(m.position.distanceTo(rest[i]), ['torso', 'head', 'armL', 'armR', 'tail'][i]).toBeLessThan(1e-3));
    expect(planks.visible).toBe(false); expect(t.stats().glitch).toBeLessThan(0.05);
  });
  it('без DOM экран не рисуется, но модуль не падает; при km < 1 части не летят', async () => {
    const { t } = await shown({ km: 0.3 }); t.glitch(true); run(t, 0.5, 5);
    const torso = node(t, 'torso'), rest = torso.position.clone(); let d = 0;
    await until(t, t.breakGlitch(), () => { d = Math.max(d, torso.position.distanceTo(rest)); });
    expect(d).toBeLessThan(1e-6); expect(t.stats().particles).toBe(0);
  });
  it('удар во время разбора игнорируется', async () => {
    const { t } = await shown(); const p = t.breakGlitch(); run(t, 0.5, 5); await until(t, t.hit('strong')); await until(t, p);
  });
});

describe('training3d: мишени', () => {
  it('targets(n) выкатывает по одной, лишние уезжают; targetHit убирает попавшую', async () => {
    const { t } = await shown(); run(t, 1, 5);
    t.targets(5); run(t, 0.5, 10); expect(t.stats().targetsUp).toBeGreaterThan(0); expect(t.stats().targetsUp).toBeLessThan(5);   // по одной
    run(t, 2, 15); expect(t.stats().targetsUp).toBe(5);
    await until(t, t.targetHit(2)); expect(t.stats().targetsUp).toBe(4);
    await until(t, t.targetHit()); expect(t.stats().targetsUp).toBe(3);
    t.targets(1); run(t, 1.5, 30); expect(t.stats().targetsUp).toBe(1);
    t.targets(0); run(t, 1.5, 40); expect(t.stats().targetsUp).toBe(0);
    await until(t, t.targetHit());   // нечего сбивать — не виснет
  });
  it('попавшая мишень крутится и падает, щепки летят (km = 1); при km < 1 щепок нет', async () => {
    for (const km of [1, 0.3]) {
      const { t } = await shown({ km }); run(t, 2, 5); let spin = 0, mx = 0;
      const inst = t.g.children.find(c => (c as THREE.InstancedMesh).isInstancedMesh && (c as THREE.InstancedMesh).count === 5 && !c.userData.outline)! as THREE.InstancedMesh, m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
      const p = t.targetHit(0);
      await until(t, p, () => { inst.getMatrixAt(0, m); q.setFromRotationMatrix(m); e.setFromQuaternion(q, 'YXZ'); spin = Math.max(spin, Math.abs(e.x)); mx = Math.max(mx, t.stats().particles); });
      expect(spin, 'падает').toBeGreaterThan(0.8); if (km === 1) expect(mx).toBeGreaterThan(3); else expect(mx).toBe(0);
    }
  });
  it('targets вне 0..5 зажимается, промах не падает', async () => {
    const { t } = await shown(); t.targets(99); run(t, 3, 5); expect(t.stats().targetsUp).toBe(5); t.targets(-4); run(t, 2, 10); expect(t.stats().targetsUp).toBe(0);
    t.targetMiss(); t.targets(2); run(t, 1, 20); t.targetMiss(); run(t, 1, 30);
  });
});

describe('training3d: доска и финал', () => {
  it('board(текст) зажигает свечение, оно остаётся приглушённым; board("") гасит; без текста — только всплеск', async () => {
    const { t } = await shown(); const glow = () => (t.g.getObjectByName('boardGlow') as THREE.Mesh);
    expect(glow().visible).toBe(false);
    t.board('Ортақ көбейткіш'); run(t, 0.5, 5); expect(glow().visible).toBe(true); const hi = ((glow().material) as THREE.MeshBasicMaterial).opacity; expect(hi).toBeGreaterThan(0.3);
    run(t, 4, 10); const lo = ((glow().material) as THREE.MeshBasicMaterial).opacity; expect(lo).toBeGreaterThan(0.05); expect(lo).toBeLessThan(hi);
    t.board(''); run(t, 3, 20); expect(glow().visible).toBe(false);
    t.board(); run(t, 0.5, 30); expect(glow().visible).toBe(true); run(t, 4, 40); expect(glow().visible).toBe(false);
  });
  it('cheer: конфетти (km = 1) не больше 80 и оседает; при km < 1 частиц нет', async () => {
    const a = await shown(); a.t.cheer(); run(a.t, 0.5, 5); expect(a.t.stats().particles).toBeGreaterThan(30); expect(a.t.stats().particles).toBeLessThanOrEqual(80);
    const b = await shown({ km: 0.3 }); b.t.cheer(); run(b.t, 0.5, 5); expect(b.t.stats().particles).toBe(0);
  });
});

describe('training3d: покой и km < 1', () => {
  const snap = (t: Training) => { const o: number[] = []; t.g.traverse(n => { if (n.name === 'swing' || n.name === 'head' || n.name === 'tail') o.push(n.rotation.x, n.rotation.z); }); return o; };
  it('в покое манекен дышит и покачивается, при km < 1 — мягче', async () => {
    const amp = async (km: number) => { const { t } = await shown({ km }); run(t, 2, 10); let mn = 9, mx = -9; run(t, 4, 12, () => { const z = node(t, 'swing').rotation.z; mn = Math.min(mn, z); mx = Math.max(mx, z); }); return mx - mn; };
    const a = await amp(1), b = await amp(0.3); expect(a).toBeGreaterThan(0.01); expect(b).toBeGreaterThan(0.005); expect(b).toBeLessThan(a);
    const { t } = await shown(); const s0 = snap(t); run(t, 0.7, 30); expect(snap(t)).not.toEqual(s0);
  });
  it('km < 1: удар — мягкое покачивание слабее обычного, без тряски (скручивания)', async () => {
    const tw = async (km: number) => { const { t } = await shown({ km }); run(t, 1.5, 5); let m = 0; t.hit('strong'); run(t, 1, 10, () => { m = Math.max(m, Math.abs(node(t, 'yaw').rotation.y + 0.52)); }); return m; };
    expect(await tw(0.3)).toBeLessThan((await tw(1)) * 0.6);
  });
});

describe('training3d: бюджет', () => {
  it('самая полная сцена (мишени 5, глитч, разбор, удары, конфетти) — не больше 40 вызовов отрисовки; low — не больше high', async () => {
    const worst = async (q: 'high' | 'low') => {
      const { t } = await shown({ quality: q }); t.targets(5); t.board('Тактика'); t.glitch(true); run(t, 2.5, 5); let mx = t.drawCalls();
      const each = () => { mx = Math.max(mx, t.drawCalls()); };
      t.hit('combo', 3); t.breakGlitch(); t.cheer(); run(t, 3, 10, each); t.bonk(); run(t, 3, 20, each);
      return mx;
    };
    const hi = await worst('high'), lo = await worst('low');
    expect(hi).toBeLessThanOrEqual(40); expect(lo).toBeLessThanOrEqual(hi); expect(lo).toBeLessThanOrEqual(24);
  });
});

describe('training3d: без утечек', () => {
  it('dispose освобождает все геометрии, материалы и текстуры, снимает группу со сцены; ждущие промисы завершаются; повторные вызовы безвредны', async () => {
    const { scene, t } = await shown(); t.targets(5); t.glitch(true); t.board('a'); run(t, 1, 5);
    const geos = new Set<THREE.BufferGeometry>(), mats = new Set<THREE.Material>(), texs = new Set<THREE.Texture>();
    t.g.traverse(o => {
      const m = o as THREE.Mesh; if (m.geometry) geos.add(m.geometry);
      for (const x of ([] as THREE.Material[]).concat(m.material ?? [])) { mats.add(x); for (const k of ['map', 'gradientMap'] as const) { const tx = (x as THREE.MeshToonMaterial)[k]; if (tx) texs.add(tx); } }
    });
    expect(geos.size).toBeGreaterThan(20); expect(mats.size).toBeGreaterThan(8); expect(texs.size).toBeGreaterThanOrEqual(3);
    const freed: unknown[] = [], on = (x: THREE.EventDispatcher<{ dispose: object }>) => x.addEventListener('dispose', () => freed.push(x));
    geos.forEach(on); mats.forEach(m => on(m as never)); texs.forEach(x => on(x as never));
    const pend = [t.bonk(), t.breakGlitch(), t.targetHit(0)]; run(t, 0.3, 30);
    t.dispose(); await Promise.all(pend);
    expect(freed.length).toBe(geos.size + mats.size + texs.size);
    expect(scene.children).not.toContain(t.g);
    expect(() => { t.dispose(); t.update(0.1, 1); t.hit('light'); t.targets(3); t.board('x'); t.cheer(); t.glitch(true); t.show(true); t.anchor(); }).not.toThrow();
  });
  it('создание и dispose много раз не оставляют детей на сцене', async () => {
    const scene = new THREE.Scene();
    for (let i = 0; i < 5; i++) { const t = createTraining(scene, { quality: i % 2 ? 'low' : 'high', km: i % 3 ? 1 : 0.3 }); await until(t, t.show(true)); t.hit('strong'); run(t, 0.5, 5); t.dispose(); }
    expect(scene.children.length).toBe(0);
  });
});
