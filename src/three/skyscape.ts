// Небесный пейзаж вокруг корабля-базы: пухлые облака (слои над и под кораблём) и летающие острова —
// скала-сосулька снизу, травяная шапка, деревья и камни из готового набора (KayKit Forest, набор isles), кристаллы кодом.
// Всё в мультяшном виде с контуром, как готовые модели.
import * as THREE from 'three';
import { Kit, toonify } from './assets';

export interface Skyscape {
  g: THREE.Group;
  /** tint — цвет низа неба мира: облака подкрашиваются под него (в ледяном мире белые, в вулкане тёплые). */
  update(dt: number, t: number, km: number, tint?: THREE.Color): void;
}

const rng = (seed: number) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

/** Облако: сплющенные шарики, у основания плоское. */
function cloud(r: () => number, size: number, mat: THREE.Material, geo: THREE.BufferGeometry) {
  const g = new THREE.Group(); const n = 4 + Math.floor(r() * 4);
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(geo, mat), k = size * (0.55 + r() * 0.6) * (i === 0 ? 1.3 : 1);
    const a = (i / n) * Math.PI * 2, d = i === 0 ? 0 : size * (0.6 + r() * 0.5);
    m.scale.set(k * 1.25, k * 0.8, k); m.position.set(Math.cos(a) * d * 1.4, k * 0.3 + r() * size * 0.3, Math.sin(a) * d * 0.7); m.rotation.y = r() * 6;
    g.add(m);
  }
  return g;
}

export function createSkyscape(o: { quality?: 'high' | 'low' } = {}): Skyscape {
  const g = new THREE.Group(), r = rng(11);
  const cloudGeo = new THREE.IcosahedronGeometry(1, 1);
  const cloudMat = new THREE.MeshStandardMaterial({ color: 0xf4efff, emissive: 0x6b5aa8, emissiveIntensity: 0.18, flatShading: true });
  const lowMat = new THREE.MeshStandardMaterial({ color: 0xd9cff5, emissive: 0x4b3a8a, emissiveIntensity: 0.25, flatShading: true });
  const clouds: { g: THREE.Object3D; v: number }[] = [];
  // облака на уровне корабля и выше
  for (let i = 0; i < 9; i++) {
    const c = cloud(r, 1.6 + r() * 1.8, cloudMat, cloudGeo); const a = r() * Math.PI * 2, d = 24 + r() * 26;
    c.position.set(Math.cos(a) * d, -6 + r() * 16, Math.sin(a) * d); g.add(c); clouds.push({ g: c, v: 0.4 + r() * 0.5 });
  }
  // море облаков внизу: крупные, редкие, чтобы было видно глубину
  for (let i = 0; i < (o.quality === 'low' ? 10 : 16); i++) {
    const c = cloud(r, 4 + r() * 4, lowMat, cloudGeo); const a = r() * Math.PI * 2, d = 16 + r() * 55;
    c.position.set(Math.cos(a) * d, -26 - r() * 10, Math.sin(a) * d); g.add(c); clouds.push({ g: c, v: 0.2 + r() * 0.3 });
  }
  clouds.forEach(c => toonify(c.g, { shadows: false }));
  // мультяшные копии материалов облаков (toonify заменил исходные): их и подкрашиваем
  const toonOfCloud = (c: { g: THREE.Object3D }) => { let m: THREE.MeshToonMaterial | null = null; c.g.traverse(o => { if (!m && (o as THREE.Mesh).isMesh) m = (o as THREE.Mesh).material as THREE.MeshToonMaterial; }); return m!; };
  const upMat = toonOfCloud(clouds[0]), downMat = toonOfCloud(clouds[clouds.length - 1]);
  const upBase = new THREE.Color(0xffffff), downBase = new THREE.Color(0xe6e0f5);

  // ---------- летающие острова ----------
  const isles: { g: THREE.Group; y: number; ph: number }[] = [];
  const rock = new THREE.MeshStandardMaterial({ color: 0x8a7a9e, flatShading: true }), rockDark = new THREE.MeshStandardMaterial({ color: 0x5f5378, flatShading: true });
  const dirt = new THREE.MeshStandardMaterial({ color: 0x9a6a45, flatShading: true }), grass = new THREE.MeshStandardMaterial({ color: 0x5fc466, flatShading: true });
  const crystal = new THREE.MeshStandardMaterial({ color: 0xc59bff, emissive: 0x9a5cff, emissiveIntensity: 1.3, flatShading: true });
  function isle(x: number, y: number, z: number, R: number, seed: number) {
    const ir = rng(seed * 97 + 5), gI = new THREE.Group(); gI.position.set(x, y, z); g.add(gI);
    const body = new THREE.Group(); gI.add(body);
    // скала снизу: конус с неровными вершинами
    const cone = new THREE.ConeGeometry(R, R * 2.2, 9, 3); cone.rotateX(Math.PI); cone.translate(0, -R * 1.1 - 0.35, 0);
    const p = cone.attributes.position; for (let i = 0; i < p.count; i++) { const k = 1 + (ir() - 0.5) * 0.35; p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k); } cone.computeVertexNormals();
    body.add(new THREE.Mesh(cone, rockDark));
    const band = new THREE.Mesh(new THREE.CylinderGeometry(R * 1.02, R * 0.95, 0.5, 9), dirt); band.position.y = -0.3; body.add(band);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(R * 1.08, R * 1.04, 0.3, 9), grass); top.position.y = 0.05; body.add(top);
    for (let i = 0; i < 3; i++) { const b = new THREE.Mesh(new THREE.DodecahedronGeometry(R * (0.18 + ir() * 0.15), 0), rock); const a = ir() * 6.28; b.position.set(Math.cos(a) * R * 0.9, -0.6 - ir() * R * 0.8, Math.sin(a) * R * 0.9); body.add(b); }
    if (seed % 2) for (let i = 0; i < 3; i++) { const c = new THREE.Mesh(new THREE.OctahedronGeometry(0.35 + ir() * 0.3, 0), crystal); c.scale.y = 2; const a = ir() * 6.28; c.position.set(Math.cos(a) * R * 0.5, 0.5, Math.sin(a) * R * 0.5); c.rotation.set(ir() - 0.5, 0, ir() - 0.5); c.userData.noToon = true; body.add(c); }
    toonify(body, { outline: 0.06, shadows: false });
    isles.push({ g: gI, y, ph: seed });
    return gI;
  }
  const spots: [number, number, number, number][] = [[-19, -4, -16, 4], [21, -7, -12, 3], [-23, 1, 14, 3.2], [15, 3, 21, 2.2], [31, -2, 5, 4], [-8, -11, 25, 3], [-34, 6, -2, 2.5]];
  const made = spots.map(([x, y, z, R], i) => isle(x, y, z, R, i + 1));
  // деревья и камни из готового набора — когда он загрузится
  Kit.load('isles').then(k => {
    const trees = ['tree_default', 'tree_oak', 'tree_fat', 'tree_detailed', 'tree_tall', 'tree_cone'].filter(n => k.has(n));
    const smalls = ['plant_bushLarge', 'rock_largeA', 'stone_tallA', 'plant_bush', 'flower_purpleA', 'flower_yellowA'].filter(n => k.has(n));
    made.forEach((gI, i) => {
      const R = spots[i][3], ir = rng(i * 31 + 7), n = Math.max(1, Math.round(R * 0.8));
      for (let j = 0; j < n; j++) { const t = k.get(trees[Math.floor(ir() * trees.length)], { height: 2.4 + ir() * 1.6, ground: true, outline: 0.02 }); const a = ir() * 6.28, d = ir() * R * 0.55; t.position.set(Math.cos(a) * d, 0.2, Math.sin(a) * d); t.rotation.y = ir() * 6; gI.add(t); }
      for (let j = 0; j < n + 1; j++) { const t = k.get(smalls[Math.floor(ir() * smalls.length)], { height: 0.5 + ir() * 0.6, ground: true }); const a = ir() * 6.28, d = R * (0.5 + ir() * 0.4); t.position.set(Math.cos(a) * d, 0.2, Math.sin(a) * d); t.rotation.y = ir() * 6; gI.add(t); }
    });
  }).catch(() => {});

  return {
    g,
    update(dt, t, km, tint) {
      // светятся своим же цветом, чтобы теневая сторона не уходила в серое
      if (tint) { upMat.color.copy(upBase).lerp(tint, 0.2); upMat.emissive.copy(upMat.color).multiplyScalar(0.38); downMat.color.copy(downBase).lerp(tint, 0.35); downMat.emissive.copy(downMat.color).multiplyScalar(0.3); }
      clouds.forEach(c => { c.g.position.x += dt * c.v * km; if (c.g.position.x > 70) c.g.position.x = -70; });
      isles.forEach(o => { o.g.position.y = o.y + Math.sin(t * 0.5 + o.ph) * 0.6 * km; o.g.rotation.y = Math.sin(t * 0.1 + o.ph) * 0.1; });
    },
  };
}
