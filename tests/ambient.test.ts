import { describe, it, expect, vi, afterEach } from 'vitest';
import * as THREE from 'three';
import { Ambient, ambientOf, applySway, rng, swayKind, swayVertex, waterShaders, REDUCED_KM } from '../src/three/ambient';
import { birds, leaves, lightning, rain } from '../src/three/ambient_fx';
import type { Kit } from '../src/three/assets';

afterEach(() => vi.unstubAllGlobals());

/** Прогнать n кадров острова по step мс. */
function run(a: Ambient, n: number, step = 16, high = true, scene: THREE.Scene | null = null, t0 = 1000) {
  for (let i = 0; i <= n; i++) a.frame(t0 + i * step, high, scene);
}
const toon = () => new THREE.MeshToonMaterial({ color: 0x44aa44 });
const modelOf = (name: string, mat: THREE.Material = toon()) => { const o = new THREE.Group(); o.name = name; o.add(new THREE.Mesh(new THREE.BoxGeometry(1, 4, 1).translate(0, 2, 0), mat)); return o; };

describe('ambient: общие мелочи', () => {
  it('rng детерминирован и в диапазоне 0..1', () => {
    const a = rng(5), b = rng(5), c = rng(6);
    const xs = Array.from({ length: 50 }, () => a());
    expect(xs).toEqual(Array.from({ length: 50 }, () => b()));
    expect(xs.every(x => x >= 0 && x < 1)).toBe(true);
    expect(xs[0]).not.toBe(c());
  });

  it('качаются деревья, кусты, трава и ткань; камень, статуи и здания стоят', () => {
    for (const n of ['Tree_1_A_Color1', 'tree_oak', 'tree_palmTall', 'Bush_2_B_Color1', 'plant_bushLarge', 'Grass_2_A_Color1', 'flower_redA', 'crops_bambooStageB', 'waterplant_A', 'tree-snow-a', 'unit-tree']) expect(swayKind(n), n).not.toBeNull();
    for (const n of ['flag_red', 'flagCheckers', 'banner']) expect(swayKind(n)?.cloth, n).toBe(true);
    for (const n of ['statue_block', 'stone_tallD', 'rock_smallA', 'building-a', 'column', 'bannerTowerRed', 'cactus_tall', 'lampSquareFloor', 'mountain_A', 'light-curved', 'crate_A_big', 'hex_grass']) expect(swayKind(n), n).toBeNull();
  });
  it('пальма качается сильнее ёлки под снегом', () => {
    expect(swayKind('tree_palm')!.frac).toBeGreaterThan(swayKind('tree-snow-a')!.frac);
    expect(swayKind('grass_large')!.frac).toBeGreaterThan(swayKind('tree_oak')!.frac);
  });
  it('шейдеры ветра и воды вставляются в стандартные места three', () => {
    const vs = '#include <common>\nvoid main(){\n#include <begin_vertex>\n}', fs = '#include <common>\nvoid main(){\n#include <emissivemap_fragment>\n}';
    const s = swayVertex(vs, false), c = swayVertex(vs, true);
    expect(s).toContain('uniform float uSwT'); expect(s).toContain('transformed +='); expect(c).not.toBe(s);
    const [v, f] = waterShaders(vs, fs);
    expect(v).toContain('vWw'); expect(f).toContain('totalEmissiveRadiance'); expect(f).toContain('uWTint');
  });
});

describe('ambient: тикер кадра', () => {
  it('один тикер на остров: невидимая точка, которая рисуется первой и не отсекается', () => {
    const g = new THREE.Group(), a = ambientOf(g);
    expect(ambientOf(g)).toBe(a);
    const pts = g.children.filter(o => o.name === 'ambient_tick');
    expect(pts).toHaveLength(1);
    expect(pts[0].frustumCulled).toBe(false); expect(pts[0].renderOrder).toBeLessThan(0);
    expect(((pts[0] as THREE.Points).material as THREE.PointsMaterial).colorWrite).toBe(false);
  });

  it('время идёт по dt, скачок кадра ограничен 0.1 с (вкладка была в фоне)', () => {
    const a = new Ambient(new THREE.Group()), dts: number[] = [];
    a.add(c => dts.push(c.dt));
    a.frame(1000, true); a.frame(1016, true); a.frame(9000, true);
    expect(dts[0]).toBe(0); expect(dts[1]).toBeCloseTo(0.016, 5); expect(dts[2]).toBe(0.1);
    expect(a.ctx.t).toBeCloseTo(0.116, 5); expect(a.wind.value).toBeCloseTo(0.116, 5);
  });

  it('плотность частиц: high — 1, low — 0.5; подписчик слышит смену', () => {
    const a = new Ambient(new THREE.Group()), seen: number[] = [];
    a.onDensity(d => seen.push(d));
    run(a, 2, 16, true); run(a, 2, 16, false, null, 2000);
    expect(seen).toEqual([1, 0.5]);
  });

  it('сломавшийся эффект выключается, остальные и бой живут', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const a = new Ambient(new THREE.Group()); let ok = 0, bad = 0;
    a.add(() => { bad++; throw new Error('x'); }); a.add(() => { ok++; });
    expect(() => run(a, 5)).not.toThrow();
    expect(bad).toBe(1); expect(ok).toBe(6);
  });

  it('«уменьшить движение»: доля движения 0.3, птицы и молния не создаются', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    const g = new THREE.Group();
    expect(ambientOf(g).ctx.km).toBe(REDUCED_KM);
    expect(birds(g, { n: 3, color: 0 })).toBeNull();
    const before = g.children.length; lightning(g); expect(g.children.length).toBe(before);
  });
});

describe('ambient: качание', () => {
  it('деревья получают свой материал-копию, жёсткое не трогаем', () => {
    const g = new THREE.Group(), src = toon(), tree = modelOf('Tree_1_A', src), stone = modelOf('statue_block', src);
    g.add(tree, stone);
    const treeMesh = tree.children[0] as THREE.Mesh, stoneMesh = stone.children[0] as THREE.Mesh;
    applySway(g);
    expect(treeMesh.material).not.toBe(src); expect((treeMesh.material as THREE.Material).onBeforeCompile).toBeTypeOf('function');
    expect(stoneMesh.material).toBe(src);
    expect(src.onBeforeCompile.toString()).not.toContain('uSw');   // общий материал игры остался как был
  });

  it('одинаковые по высоте деревья делят материал, разные по высоте — нет', () => {
    const g = new THREE.Group(), src = toon(), a = modelOf('Tree_1_A', src), b = modelOf('Tree_2_A', src), c = modelOf('Tree_3_A', src);
    c.scale.setScalar(2); g.add(a, b, c);
    applySway(g);
    const m = (o: THREE.Object3D) => (o.children[0] as THREE.Mesh).material;
    expect(m(a)).toBe(m(b)); expect(m(c)).not.toBe(m(a));
  });

  it('шейдер копии подтягивает общее время ветра', () => {
    const g = new THREE.Group(), tree = modelOf('tree_oak'); g.add(tree); const amb = ambientOf(g);
    applySway(g, amb);
    const sh = { uniforms: {} as Record<string, { value: unknown }>, vertexShader: '#include <common>\n#include <begin_vertex>' };
    (((tree.children[0] as THREE.Mesh).material) as THREE.Material).onBeforeCompile(sh as never, null as never);
    expect(sh.uniforms.uSwT).toBe(amb.wind); expect(sh.vertexShader).toContain('uSwInv');
  });
});

describe('ambient: уборка при пересборке острова', () => {
  it('remove() острова освобождает своё и не трогает общее из кэша игры', () => {
    const parent = new THREE.Group(), g = new THREE.Group(); parent.add(g);
    const amb = ambientOf(g);
    const sharedMat = toon(), sharedModel = modelOf('rock_a', sharedMat);
    const kit = { get: () => sharedModel } as unknown as Kit;
    const kits = amb.trackKits(new Map([['k', kit]]));
    g.add(kits.get('k')!.get('rock_a'));
    const own = new THREE.Mesh(new THREE.BoxGeometry(), toon()); g.add(own);
    const spy = { og: vi.spyOn(own.geometry, 'dispose'), om: vi.spyOn(own.material as THREE.Material, 'dispose'), sm: vi.spyOn(sharedMat, 'dispose') };
    const cleaned = vi.fn(); amb.onDispose(cleaned);
    const sharedGeoDispose = vi.spyOn((sharedModel.children[0] as THREE.Mesh).geometry, 'dispose');
    parent.remove(g);
    expect(cleaned).toHaveBeenCalledOnce();
    expect(spy.og).toHaveBeenCalled(); expect(spy.om).toHaveBeenCalled();
    expect(sharedGeoDispose).not.toHaveBeenCalled(); expect(spy.sm).not.toHaveBeenCalled();
  });

  it('после уборки эффекты не крутятся, повторная уборка безопасна', () => {
    const parent = new THREE.Group(), g = new THREE.Group(); parent.add(g);
    const amb = ambientOf(g); let n = 0; amb.add(() => n++);
    run(amb, 3); const seen = n;
    parent.remove(g); run(amb, 3, 16, true, null, 5000); amb.dispose();
    expect(n).toBe(seen);
  });

  it('текстура с userData.keep (общая мягкая точка) остаётся в видеопамяти', () => {
    const parent = new THREE.Group(), g = new THREE.Group(); parent.add(g); ambientOf(g);
    const tex = new THREE.Texture(); tex.userData.keep = true; const drop = new THREE.Texture();
    g.add(new THREE.Sprite(new THREE.SpriteMaterial({ map: tex })), new THREE.Sprite(new THREE.SpriteMaterial({ map: drop })));
    const k = vi.spyOn(tex, 'dispose'), d = vi.spyOn(drop, 'dispose');
    parent.remove(g);
    expect(k).not.toHaveBeenCalled(); expect(d).toHaveBeenCalled();
  });
});

describe('ambient_fx: частицы без канваса', () => {
  it('листопад: число видимых частиц следует за качеством, сами листья не лезут в боевую полосу при появлении', () => {
    const g = new THREE.Group(), amb = ambientOf(g), m = leaves(g, { n: 40, colors: [0xffffff], seed: 1 });
    run(amb, 2, 16, true); expect(m.count).toBe(40);
    run(amb, 2, 16, false, null, 3000); expect(m.count).toBe(20);
  });

  it('птицы: на low показана половина, крылья машут', () => {
    const g = new THREE.Group(), amb = ambientOf(g), flock = birds(g, { n: 4, color: 0, seed: 2 })!;
    run(amb, 2, 16, false);
    expect(flock.children.filter(b => b.visible)).toHaveLength(2);
    const wing = (flock.children[0].children[0].children[1]) as THREE.Object3D;
    const a0 = wing.rotation.z; run(amb, 30, 16, true, null, 4000);
    expect(wing.rotation.z).not.toBe(a0);
  });

  it('дождь: полоски падают и возвращаются наверх', () => {
    const g = new THREE.Group(), amb = ambientOf(g), r = rain(g, { n: 20, seed: 1 });
    const y0 = (r.instanceMatrix.array as Float32Array)[13];
    run(amb, 60, 16);
    const y1 = (r.instanceMatrix.array as Float32Array)[13];
    expect(y1).not.toBe(y0); expect(y1).toBeGreaterThanOrEqual(0);
  });

  it('молния: свет сцены вспыхивает и точно возвращается к исходному, в том числе при уборке посреди вспышки', () => {
    const scene = new THREE.Scene(), hemi = new THREE.HemisphereLight(0xffffff, 0x000000, 1.5); scene.add(hemi);
    const parent = new THREE.Group(), g = new THREE.Group(); parent.add(g); scene.add(parent);
    const amb = ambientOf(g); lightning(g, { every: [3, 3] });
    let peak = 0;
    for (let t = 0; t < 12000; t += 20) { amb.frame(1000 + t, true, scene); peak = Math.max(peak, hemi.intensity); }
    expect(peak).toBeGreaterThan(1.5 * 1.3);
    // ждём начала следующей вспышки и убираем остров прямо в ней
    let t = 13000; while (hemi.intensity === 1.5 && t < 40000) { amb.frame(1000 + t, true, scene); t += 20; }
    expect(hemi.intensity).not.toBe(1.5);
    parent.remove(g);
    expect(hemi.intensity).toBe(1.5);
  });
});
