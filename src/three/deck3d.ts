// Палуба корабля-базы: готовый корабль (Kenney Pirate Kit), по которому ходит герой. По модели один раз строится карта высот
// (лучи сверху вниз), из неё — что проходимо (без мачт, поручней и надстроек), высота пола под ногами (лестницы тоже) и путь (A*).
// Ось корабля — x (нос в +x), главная палуба на y = 0.
import * as THREE from 'three';
import { Kit } from './assets';

const STEP = 0.3;                                    // шаг сетки, м
export interface Deck {
  g: THREE.Group;
  /** Высота пола под ногами в точке (главная палуба = 0), null — там не пройти. */
  height(x: number, z: number): number | null;
  walkable(x: number, z: number): boolean;
  /** Ближайшая проходимая точка. */
  nearest(x: number, z: number): [number, number];
  /** Путь по палубе ломаной; пусто — нет пути. */
  path(from: [number, number], to: [number, number]): [number, number][];
  /** Занять место под предмет (бочка, ящик): вокруг него не ходим. */
  reserve(x: number, z: number, r: number): void;
  /** Места, куда герой любит ходить. */
  stations: Record<'bow' | 'stern' | 'mid' | 'port' | 'star', [number, number]>;
  /** Проходимые клетки у бортов: сюда можно ставить реквизит. */
  edges(): [number, number][];
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  update(t: number, km: number): void;
}

export async function createDeck(quality: 'high' | 'low', scale = 1.5): Promise<Deck> {
  const kit = await Kit.load('ship');
  const g = new THREE.Group();
  const model = kit.get('ship-large', { shadows: quality === 'high' });
  const holder = new THREE.Group(); holder.add(model); holder.scale.setScalar(scale); holder.rotation.y = Math.PI / 2; g.add(holder);
  g.updateMatrixWorld(true);

  // корпус — самый большой меш; паруса и флаги отдельные
  let hull: THREE.Mesh | null = null, hullVol = 0; const sails: THREE.Mesh[] = [];
  model.traverse(o => { const m = o as THREE.Mesh; if (!m.isMesh || m.userData.outline) return;
    if (/sail|flag/.test(m.name)) { sails.push(m); return; }
    m.geometry.computeBoundingBox(); const s = m.geometry.boundingBox!.getSize(new THREE.Vector3()); const v = s.x * s.y * s.z;
    if (v > hullVol) { hullVol = v; hull = m; } });
  // паруса полупрозрачные: не закрывают героя, когда камера облетает корабль
  for (const s of sails) if (/sail/.test(s.name)) {
    const m = (s.material as THREE.MeshToonMaterial).clone(); m.transparent = true; m.opacity = 0.5; m.depthWrite = false; m.side = THREE.DoubleSide; s.material = m; s.castShadow = false;
  }
  const ray = new THREE.Raycaster(), down = new THREE.Vector3(0, -1, 0), from = new THREE.Vector3();
  const heightAt = (x: number, z: number): number | null => { from.set(x, 80, z); ray.set(from, down); const h = ray.intersectObject(hull!, false)[0]; return h ? h.point.y : null; };

  const box = new THREE.Box3().setFromObject(hull!);
  const nx = Math.ceil((box.max.x - box.min.x) / STEP) + 1, nz = Math.ceil((box.max.z - box.min.z) / STEP) + 1;
  const H = new Float32Array(nx * nz).fill(NaN);
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) { const h = heightAt(box.min.x + i * STEP, box.min.z + j * STEP); if (h != null) H[i * nz + j] = h; }
  // главная палуба: самая частая высота ниже парусов
  const bins = new Map<number, number>();
  for (const h of H) if (!Number.isNaN(h) && h < 3.2 * scale) { const k = Math.round(h * 10); bins.set(k, (bins.get(k) ?? 0) + 1); }
  let deckLevel = 0, best = 0; for (const [k, n] of bins) if (n > best) { best = n; deckLevel = k / 10; }
  g.position.y = -deckLevel; g.updateMatrixWorld(true);

  // проходимо: пол не выше надстройки и без резких скачков (лестницы можно, поручни и мачты нельзя)
  const idx = (i: number, j: number) => i * nz + j, inGrid = (i: number, j: number) => i >= 0 && j >= 0 && i < nx && j < nz;
  const ok = new Uint8Array(nx * nz), MAXUP = 1.6 * scale, JUMP = 0.42 * scale;
  for (let i = 1; i < nx - 1; i++) for (let j = 1; j < nz - 1; j++) {
    const h = H[idx(i, j)]; if (Number.isNaN(h) || h - deckLevel > MAXUP || h - deckLevel < -0.3) continue;
    let smooth = true; for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const n = H[idx(i + di, j + dj)]; if (Number.isNaN(n) || Math.abs(n - h) > JUMP) smooth = false; }
    if (smooth) ok[idx(i, j)] = 1;
  }
  const R = 1, walk = new Uint8Array(nx * nz);                        // отступ от препятствий: герой шире точки
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
    if (!ok[idx(i, j)]) continue; let clear = true;
    for (let di = -R; di <= R && clear; di++) for (let dj = -R; dj <= R; dj++) { const a = i + di, b = j + dj; if (!inGrid(a, b) || !ok[idx(a, b)]) { clear = false; break; } }
    if (clear) walk[idx(i, j)] = 1;
  }
  const cell = (x: number, z: number): [number, number] => [Math.round((x - box.min.x) / STEP), Math.round((z - box.min.z) / STEP)];
  const pos = (i: number, j: number): [number, number] => [box.min.x + i * STEP, box.min.z + j * STEP];
  // оставляем связную часть вокруг середины палубы (без «островков» на мачтах и обломках)
  {
    let si = -1, sj = -1, bd = Infinity;
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) if (walk[idx(i, j)] && Math.abs(H[idx(i, j)] - deckLevel) < 0.2) { const d = Math.hypot(i - nx / 2, j - nz / 2); if (d < bd) { bd = d; si = i; sj = j; } }
    const seen = new Uint8Array(nx * nz), q: number[] = [idx(si, sj)]; if (si >= 0) seen[idx(si, sj)] = 1;
    while (q.length) { const k = q.pop()!, i = Math.floor(k / nz), j = k % nz;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const a = i + di, b = j + dj; if (inGrid(a, b) && walk[idx(a, b)] && !seen[idx(a, b)]) { seen[idx(a, b)] = 1; q.push(idx(a, b)); } } }
    for (let k = 0; k < walk.length; k++) if (!seen[k]) walk[k] = 0;
  }
  const walkable = (x: number, z: number) => { const [i, j] = cell(x, z); return inGrid(i, j) && !!walk[idx(i, j)]; };
  const height = (x: number, z: number) => { const [i, j] = cell(x, z); return inGrid(i, j) && walk[idx(i, j)] ? H[idx(i, j)] - deckLevel : null; };
  const list = () => { const c: [number, number][] = []; for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) if (walk[idx(i, j)]) c.push([i, j]); return c; };
  const nearestCell = (x: number, z: number): [number, number] => { const [ci, cj] = cell(x, z); let b: [number, number] = [ci, cj], bd = Infinity; for (const c of list()) { const d = (c[0] - ci) ** 2 + (c[1] - cj) ** 2; if (d < bd) { bd = d; b = c; } } return b; };
  const nearest = (x: number, z: number): [number, number] => { const c = nearestCell(x, z); return pos(c[0], c[1]); };

  function path(a: [number, number], b: [number, number]): [number, number][] {
    const s = nearestCell(...a), e = nearestCell(...b);
    const gS = new Map<number, number>([[idx(...s), 0]]), prev = new Map<number, number>(), open: [number, number, number][] = [[0, s[0], s[1]]], done = new Set<number>();
    while (open.length) {
      open.sort((p, r) => p[0] - r[0]); const [, i, j] = open.shift()!; const k = idx(i, j); if (done.has(k)) continue; done.add(k);
      if (i === e[0] && j === e[1]) { const out: [number, number][] = []; let c: number | undefined = k; while (c !== undefined) { out.push(pos(Math.floor(c / nz), c % nz)); c = prev.get(c); } out.reverse();
        // спрямление: убираем промежуточные точки на одной прямой
        return out.filter((p, n) => n === 0 || n === out.length - 1 || n % 2 === 0); }
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        const a2 = i + di, b2 = j + dj; if (!inGrid(a2, b2) || !walk[idx(a2, b2)]) continue;
        if (di && dj && (!walk[idx(i + di, j)] || !walk[idx(i, j + dj)])) continue;
        const k2 = idx(a2, b2), c2 = gS.get(k)! + Math.hypot(di, dj);
        if (c2 < (gS.get(k2) ?? Infinity)) { gS.set(k2, c2); prev.set(k2, k); open.push([c2 + Math.hypot(a2 - e[0], b2 - e[1]), a2, b2]); }
      }
    }
    return [];
  }
  function reserve(x: number, z: number, r: number) {
    const [ci, cj] = cell(x, z), n = Math.ceil(r / STEP);
    for (let di = -n; di <= n; di++) for (let dj = -n; dj <= n; dj++) if (Math.hypot(di, dj) * STEP <= r && inGrid(ci + di, cj + dj)) walk[idx(ci + di, cj + dj)] = 0;
  }

  const c0 = list(); let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const [i, j] of c0) { const [x, z] = pos(i, j); minX = Math.min(minX, x); maxX = Math.max(maxX, x); minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z); }
  // станции считаем на главной палубе (высота ≈ 0), чтобы портал и штурвал не оказались на надстройке
  const mainCells = c0.filter(([i, j]) => Math.abs(H[idx(i, j)] - deckLevel) < 0.2).map(([i, j]) => pos(i, j));
  const mxX0 = Math.min(...mainCells.map(p => p[0])), mxX1 = Math.max(...mainCells.map(p => p[0])), span = mxX1 - mxX0, cz = mainCells.reduce((s, p) => s + p[1], 0) / mainCells.length;
  const near = (x: number, z: number): [number, number] => { let b = mainCells[0], bd = Infinity; for (const p of mainCells) { const d = (p[0] - x) ** 2 + (p[1] - z) ** 2; if (d < bd) { bd = d; b = p; } } return b; };
  const stations = { bow: near(mxX1 - span * 0.06, cz), stern: near(mxX0 + span * 0.06, cz), mid: near(mxX0 + span * 0.5, cz), port: near(mxX0 + span * 0.32, cz - 1.4), star: near(mxX0 + span * 0.68, cz + 1.4) };
  const edges = () => c0.filter(([i, j]) => walk[idx(i, j)] && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([di, dj]) => !walk[idx(i + di, j + dj)])).map(([i, j]) => pos(i, j));

  const sailNodes = sails.filter(s => /sail/.test(s.name));
  return { g, height, walkable, nearest, path, reserve, stations, edges, bounds: { minX, maxX, minZ, maxZ },
    update(t, km) { sailNodes.forEach((s, i) => (s.rotation.y = Math.sin(t * 1.3 + i) * 0.03 * km)); } };
}
