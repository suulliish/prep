// Дробь в голограмме настоящей геометрией: пицца из d клиньев или полоска из d долей (один InstancedMesh на строку = один вызов отрисовки).
// Стадии как в 2D-сцене FracBars: 0 целое → 1 порезано (доли раскатываются с «щелчком») → 2 закрашено n (доли приподнимаются и светятся,
// «съеденные» гаснут) → 3 подпись-дробь. Смена кадра не пересобирает форму: доли режутся и красятся на месте.
import * as THREE from 'three';
import { drawHoloText } from './holo_text';
import type { HoloRow, HoloSpec } from './holo_spec';

type FracSpec = Extract<HoloSpec, { kind: 'frac' }>;
/** Цвета строк: как в FracBars.svelte (голубой, золотой, глитч-розовый). */
const COL = [0x3ff0ff, 0xffc94a, 0xff4fb8];
const PALE = new THREE.Color(1, 0.84, 0.5).multiplyScalar(0.5), EAT = new THREE.Color(1, 0.35, 0.5).multiplyScalar(0.16);
const easeBack = (u: number) => 1 + 2.2 * Math.pow(u - 1, 3) + 1.2 * Math.pow(u - 1, 2);

interface Label { mesh: THREE.Mesh; tex: THREE.CanvasTexture; cv: HTMLCanvasElement; key: string; born: number }
interface Row {
  d: number; round: boolean; color: THREE.Color; n: number; eat: number; stage: number; broken: boolean;
  mesh: THREE.InstancedMesh; geo: THREE.BufferGeometry;
  kick: Float32Array; delay: Float32Array; on: Float32Array; eatK: Float32Array;
  x: number; y: number; r: number; tx: number; ty: number; tr: number;
  born: number; dying: number;      // born 0→1 всплытие, dying 1→0 угасание (0 = живая)
  label: Label | null;
}

let wedgeGeos = 0;   // только для тестов утечек: сколько геометрий сейчас живо
export const liveFracGeos = () => wedgeGeos;

/** Клин круга радиуса 1 (в плоскости XY, толщина по Z), центр клина смотрит вниз; яркость растёт к ободу. */
function wedgeGeo(d: number): THREE.BufferGeometry {
  const len = (Math.PI * 2) / d;
  const g = new THREE.CylinderGeometry(1, 1, 0.16, Math.max(2, Math.ceil(24 / d)), 1, false, -len / 2, len);
  g.rotateX(Math.PI / 2);
  shadeVerts(g, (x, y) => 0.6 + 0.4 * Math.min(1, Math.hypot(x, y)));
  wedgeGeos++; return g;
}
function barGeo(): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(1, 1, 0.16);
  shadeVerts(g, (_x, y) => 0.7 + 0.3 * (y + 0.5));
  wedgeGeos++; return g;
}
function shadeVerts(g: THREE.BufferGeometry, f: (x: number, y: number) => number) {
  const p = g.attributes.position, c = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) { const v = f(p.getX(i), p.getY(i)); c[i * 3] = c[i * 3 + 1] = c[i * 3 + 2] = v; }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
}

export function createFrac(fillMat: THREE.Material, labelMat: (tex: THREE.Texture) => THREE.Material, high: boolean, km: number) {
  const group = new THREE.Group();
  const rows: Row[] = [], dying: Row[] = [];
  const guides: THREE.Mesh[] = [];
  const guideGeo = new THREE.PlaneGeometry(1, 1);
  const labelGeo = new THREE.PlaneGeometry(1, 1);
  const size = { w: 3.4, h: 1.8 };
  let round = true, stage = 0, guideOn = false, broken = false;
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), pos = new THREE.Vector3(), scl = new THREE.Vector3(), eul = new THREE.Euler(), col = new THREE.Color();
  const BAR_W = 2.9, BAR_H = 0.48, BAR_GAP = 0.85;

  function makeRow(r: HoloRow, k: number, spec: FracSpec): Row {
    const geo = spec.round ? wedgeGeo(r.d) : barGeo();
    const count = spec.round ? r.d : r.d;
    const mesh = new THREE.InstancedMesh(geo, fillMat, count);
    mesh.frustumCulled = false; mesh.renderOrder = 9;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.setColorAt(0, PALE); (mesh.instanceColor as THREE.InstancedBufferAttribute).setUsage(THREE.DynamicDrawUsage);
    group.add(mesh);
    return {
      d: r.d, round: spec.round, color: new THREE.Color(spec.broken ? COL[2] : COL[Math.min(k, 2)]), n: r.n, eat: r.eat ?? 0, stage: 0, broken: spec.broken, mesh, geo,
      kick: new Float32Array(count), delay: new Float32Array(count), on: new Float32Array(count), eatK: new Float32Array(count),
      x: 0, y: 0, r: 0.5, tx: 0, ty: 0, tr: 0.5, born: 0, dying: 0, label: null,
    };
  }
  function killRow(row: Row) {
    group.remove(row.mesh); row.mesh.dispose(); row.geo.dispose(); wedgeGeos--;
    if (row.label) { group.remove(row.label.mesh); row.label.tex.dispose(); (row.label.mesh.material as THREE.Material).dispose(); row.label = null; }
  }

  function layout(m: number) {
    if (round) {
      const R = Math.max(0.36, Math.min(0.9, 3.1 / (m * 2.35)));
      // одна пицца: подпись справа от неё (панель шире, а не выше — в полосе над бойцами она тогда крупнее); несколько — подписи снизу
      const side = m === 1 && stage >= 3;
      rows.forEach((row, k) => { row.tr = R; row.tx = side ? -0.8 : (k - (m - 1) / 2) * R * 2.36; row.ty = stage >= 3 && !side ? 0.55 : 0; });
      size.w = Math.max(2.1, m * R * 2.36 + 0.3) + (side ? 1.6 : 0); size.h = stage >= 3 && !side ? R * 2 + 1.15 : R * 2 + 0.3;
    } else {
      rows.forEach((row, k) => { row.tr = BAR_W / 2; row.tx = stage >= 3 ? 0.62 : 0; row.ty = ((m - 1) / 2 - k) * BAR_GAP; });
      size.w = BAR_W + (stage >= 3 ? 1.55 : 0.3); size.h = m * BAR_GAP - 0.1;
    }
  }

  function ensureLabel(row: Row, k: number) {
    const want = stage >= 3;
    const key = row.broken ? '?' : `${row.n}/${row.d}`;
    if (!want) { if (row.label) row.label.mesh.visible = false; return false; }
    if (!row.label) {
      const cv = document.createElement('canvas'); cv.width = 320; cv.height = 200;
      const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
      const mesh = new THREE.Mesh(labelGeo, labelMat(tex)); mesh.renderOrder = 10; mesh.frustumCulled = false;
      group.add(mesh); row.label = { mesh, tex, cv, key: '', born: 0 };
    }
    const L = row.label; L.mesh.visible = true;
    if (L.key !== key) {
      drawHoloText(L.cv, key, null, undefined, { color: '#' + row.color.clone().lerp(new THREE.Color(1, 1, 1), 0.35).getHexString(), maxF: 154 });
      L.tex.needsUpdate = true; L.key = key; L.born = 0;
      return true;
    }
    return false;
  }

  /** Обновить содержимое из спека. animate — с анимацией (нарезка, закраска); возвращает, что произошло (для звука). */
  function set(spec: FracSpec, animate = true) {
    const ev = { cut: false, shade: false, label: false, rebuilt: false };
    const prevStage = stage, prevRound = round;
    round = spec.round; broken = spec.broken; guideOn = spec.guide;
    const rs = spec.rows.slice(0, 3);
    if (prevRound !== round) { rows.splice(0).forEach(r => killRow(r)); }
    // строки, которых больше нет, угасают; изменившийся знаменатель — пересборка строки (её режут заново)
    while (rows.length > rs.length) { const r = rows.pop()!; r.dying = 1; dying.push(r); }
    stage = spec.stage;
    rs.forEach((r, k) => {
      let row = rows[k];
      if (row && row.d !== r.d) { row.dying = 1; dying.push(row); row = undefined as unknown as Row; ev.rebuilt = true; }
      const fresh = !row;
      if (!row) { row = makeRow(r, k, spec); rows[k] = row; if (!animate) row.born = 1; }
      const oldN = row.n, oldEat = row.eat;
      row.n = r.n; row.eat = r.eat ?? 0; row.broken = spec.broken;
      row.color.setHex(spec.broken ? COL[2] : COL[Math.min(k, 2)]);
      const cutNow = stage >= 1 && (fresh || prevStage < 1);
      if (cutNow) { for (let i = 0; i < row.d; i++) row.kick[i] = animate ? -(i * 0.05 + k * 0.12) : 0; ev.cut = true; }
      const shadeNow = stage >= 2 && (fresh || prevStage < 2 || oldN !== row.n || oldEat !== row.eat);
      if (shadeNow) {
        ev.shade = true;
        for (let i = 0; i < row.d; i++) { row.delay[i] = animate ? 0.28 + (cutNow ? 0.35 : 0) + i * 0.06 : 0; if (!animate) { row.on[i] = i < row.n ? 1 : 0; row.eatK[i] = i >= row.n && i < row.n + row.eat ? 1 : 0; } }
      }
      row.stage = stage;
      if (ensureLabel(row, k)) ev.label = true;
      if (stage < 2) for (let i = 0; i < row.d; i++) { row.on[i] = 0; row.eatK[i] = 0; }
    });
    layout(rs.length);
    rows.forEach(r => { if (r.born === 0 && !animate) { r.x = r.tx; r.y = r.ty; r.r = r.tr; } });
    // линии-ориентиры: где кончается закраска в каждой строке — одна вертикаль через все строки (равны ли доли)
    guides.splice(0).forEach(g => { group.remove(g); (g.material as THREE.Material).dispose(); });
    if (!round && guideOn && stage >= 2 && rs.length > 1) {
      const seen: number[] = [];
      rs.forEach((r, k) => {
        const v = Math.min(1, r.n / r.d); if (seen.some(s => Math.abs(s - v) < 1e-9)) return; seen.push(v);
        const mat = new THREE.MeshBasicMaterial({ color: COL[Math.min(k, 2)], transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false, toneMapped: false });
        const g = new THREE.Mesh(guideGeo, mat); g.userData.v = v; g.renderOrder = 11; g.frustumCulled = false; group.add(g); guides.push(g);
      });
    }
    return ev;
  }

  function update(dt: number, t: number) {
    const sm = 1 - Math.exp(-dt * 9);
    const drawRow = (row: Row, k: number, life: number) => {
      row.x += (row.tx - row.x) * sm; row.y += (row.ty - row.y) * sm; row.r += (row.tr - row.r) * sm;
      row.born = Math.min(1, row.born + dt * 2.6);
      const pop = row.dying > 0 ? life : easeBack(row.born);
      const R = row.r, cut = row.stage >= 1;
      for (let i = 0; i < row.d; i++) {
        // щелчок нарезки: доля отскакивает и оседает; kick < 0 — ещё ждёт своей очереди
        let kk = row.kick[i];
        if (kk < 0) { kk += dt; if (kk >= 0) kk = 1; } else kk *= Math.exp(-dt * 5.5);
        row.kick[i] = kk;
        if (row.delay[i] > 0) row.delay[i] -= dt;
        else {
          const tOn = row.stage >= 2 && i < row.n ? 1 : 0, tEat = row.stage >= 2 && i >= row.n && i < row.n + row.eat ? 1 : 0;
          row.on[i] += (tOn - row.on[i]) * Math.min(1, dt * 6); row.eatK[i] += (tEat - row.eatK[i]) * Math.min(1, dt * 6);
        }
        const kick = Math.max(0, kk), lift = row.on[i], jit = row.broken && km === 1 ? Math.sin(t * 31 + i * 7.3) * 0.02 : 0;
        const shrink = 1 - row.eatK[i] * 0.14;
        if (row.round) {
          const phi = ((i + 0.5) / row.d) * Math.PI * 2, dx = Math.sin(phi), dy = Math.cos(phi);
          const off = R * ((cut ? 0.05 : 0) + 0.26 * kick + 0.09 * lift) + jit;
          pos.set(row.x + dx * off, row.y + dy * off, 0.12 * lift + 0.2 * kick);
          eul.set(0, 0, Math.PI - phi); q.setFromEuler(eul);
          scl.setScalar(R * pop * shrink * (1 + 0.05 * lift + 0.06 * kick));
        } else {
          const cw = BAR_W / row.d;
          pos.set(row.x - BAR_W / 2 + (i + 0.5) * cw + jit, row.y + 0.5 * BAR_H * 0 + BAR_H * (0.22 * kick + 0.12 * lift) * pop, 0.1 * lift);
          eul.set(0, 0, (0.06 * kick) * (i % 2 ? 1 : -1)); q.setFromEuler(eul);
          scl.set(Math.max(0.01, cw * (cut ? 0.93 : 1.0) * pop), BAR_H * pop * shrink * (1 + 0.1 * lift), 1);
        }
        row.mesh.setMatrixAt(i, m4.compose(pos, q, scl));
        col.copy(PALE).lerp(row.color, row.on[i]).lerp(EAT, row.eatK[i]);
        row.mesh.setColorAt(i, col);
      }
      row.mesh.instanceMatrix.needsUpdate = true; if (row.mesh.instanceColor) row.mesh.instanceColor.needsUpdate = true;
      const L = row.label;
      if (L && L.mesh.visible) {
        L.born = Math.min(1, L.born + dt * 3);
        // подпись полоски — ровно в высоту строки (выше — налезает на соседнюю); подпись одной пиццы — справа, крупно
        const side = round && rows.length === 1;
        const lw = side ? 2.6 : round ? Math.min(1.5, R * 1.7) : BAR_GAP * 0.98 * 1.6, lh = lw * 0.625, s = easeBack(L.born);
        L.mesh.scale.set(lw * s, lh * s, 1);
        if (side) L.mesh.position.set(row.x + R + 0.75, row.y, 0.3);
        else if (round) L.mesh.position.set(row.x, row.y - R - 0.1 - lh / 2, 0.3);
        else L.mesh.position.set(row.x - BAR_W / 2 - 0.72, row.y, 0.3);
      }
    };
    rows.forEach((row, k) => drawRow(row, k, 1));
    for (let i = dying.length - 1; i >= 0; i--) {
      const r = dying[i]; r.dying = Math.max(0, r.dying - dt * 4);
      if (r.dying <= 0) { killRow(r); dying.splice(i, 1); } else drawRow(r, i, r.dying);
    }
    guides.forEach(g => {
      const h = rows.length * BAR_GAP + 0.1, r0 = rows[0];
      g.scale.set(0.035, h, 1); g.position.set((r0 ? r0.x : 0) - BAR_W / 2 + g.userData.v * BAR_W, 0, 0.35);
      (g.material as THREE.MeshBasicMaterial).opacity = 0.55 + Math.sin(t * 5) * 0.25 * km;
    });
  }

  function dispose() {
    rows.splice(0).forEach(killRow); dying.splice(0).forEach(killRow);
    guides.splice(0).forEach(g => (g.material as THREE.Material).dispose());
    guideGeo.dispose(); labelGeo.dispose();
  }
  void high;
  return { group, size, set, update, dispose };
}
export type FracHolo = ReturnType<typeof createFrac>;
