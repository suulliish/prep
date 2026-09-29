// Варианты боевой локации (каждая тема мира = свой уголок мира). Общий остров + ориентир мира сохраняют узнаваемость,
// меняется композиция декора. Боевая полоса (x -4..4, z -0.5..2) всегда плоская и свободная.
import * as THREE from 'three';
import { builder, landmark } from './map';

export const VARIANTS = 6;
/** Название уголка для баннера входа. */
export const SPOT_KZ = ['Алаң', 'Үстірт', 'Көл', 'Орман', 'Қирандылар', 'Кристалдар'];
/** Стабильный вариант 0..VARIANTS-1 по строке (id темы/блока): FNV-1a. */
export function spotIndex(seed: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h % VARIANTS;
}
/** Настроение света: 0 день, 1 закат, 2 ночь. */
export const spotTime = (v: number): 0 | 1 | 2 => ((((v % 3) + 3) % 3) as 0 | 1 | 2);
export interface SpotLight { hemiSky: number; hemiGround: number; hemi: number; sun: number; sunColor: number; sunPos: [number, number, number]; lanterns: boolean }
export function spotLight(v: number): SpotLight {
  const t = spotTime(v);
  if (t === 1) return { hemiSky: 0xffc9a0, hemiGround: 0x4a2440, hemi: 0.9, sun: 1.5, sunColor: 0xffa15a, sunPos: [-14, 6, 8], lanterns: false };
  if (t === 2) return { hemiSky: 0x6a78c8, hemiGround: 0x1a1030, hemi: 0.7, sun: 0.6, sunColor: 0x9fb4ff, sunPos: [6, 14, 6], lanterns: true };
  return { hemiSky: 0xb4c4ff, hemiGround: 0x40214a, hemi: 1.05, sun: 1.7, sunColor: 0xffe6c8, sunPos: [-8, 16, 10], lanterns: false };
}

const box = new THREE.BoxGeometry(1, 1, 1);
/** Кубик декора: размер, позиция, цвет, необязательный поворот. */
type Cube = { s: [number, number, number]; p: [number, number, number]; c: number; r?: [number, number, number] };
const cu = (sx: number, sy: number, sz: number, x: number, y: number, z: number, c: number, r?: [number, number, number]): Cube => ({ s: [sx, sy, sz], p: [x, y, z], c, r });
/** Один InstancedMesh на список кубиков (цвет на экземпляр); em — свечение (цвет = цвет экземпляра не поддерживается, поэтому общий). */
function inst(g: THREE.Group, list: Cube[], em?: [number, number]) {
  if (!list.length) return;
  const im = new THREE.InstancedMesh(box, new THREE.MeshStandardMaterial({ roughness: 0.9, flatShading: true, ...(em ? { emissive: em[0], emissiveIntensity: em[1] } : {}) }), list.length);
  const o = new THREE.Object3D(), col = new THREE.Color();
  list.forEach((q, i) => { o.position.set(...q.p); o.scale.set(...q.s); o.rotation.set(...(q.r ?? [0, 0, 0])); o.updateMatrix(); im.setMatrixAt(i, o.matrix); im.setColorAt(i, col.setHex(q.c)); });
  g.add(im);
}
const dark = (hex: number, k: number) => new THREE.Color(hex).multiplyScalar(k).getHex();
const glow = (hex: number) => { const c = new THREE.Color(hex), h = { h: 0, s: 0, l: 0 }; c.getHSL(h); return c.setHSL(h.h, Math.max(0.6, h.s), 0.62).getHex(); };

export function buildSpot(ground: THREE.Group, k: number, A: number, B: number, v: number): void {
  v = ((Math.floor(v) % VARIANTS) + VARIANTS) % VARIANTS;
  // ---- клетки острова: эллипс, слои снизу ----
  const water = (x: number, z: number) => v === 2 && x >= -5 && x <= -3 && z >= -4 && z <= -2;
  const top: [number, number][] = [];
  for (let x = -8; x <= 8; x++) for (let z = -5; z <= 5; z++) if ((x * x) / 72 + (z * z) / 30 <= 1) top.push([x, z]);
  const under: [number, number, number][] = [];
  for (let k2 = 1; k2 <= 4; k2++) for (const [x, z] of top) if ((x * x) / (72 - k2 * 14) + (z * z) / (30 - k2 * 6) <= 1) under.push([x, -k2, z]);
  // плато: ступени вверх у задней части (уровень 1 при z<=-2, уровень 2 при z<=-3)
  const raise: [number, number, number][] = [];
  if (v === 1) for (const [x, z] of top) { if (z <= -2 && Math.abs(x) <= 7) raise.push([x, 0.5, z]); if (z <= -3 && Math.abs(x) <= 6) raise.push([x, 1.5, z]); }
  const cells = top.filter(([x, z]) => !water(x, z));
  const im = new THREE.InstancedMesh(box, new THREE.MeshStandardMaterial({ roughness: 0.9, flatShading: true }), cells.length + under.length + raise.length);
  const m4 = new THREE.Matrix4(), col = new THREE.Color(); let n = 0;
  cells.forEach(([x, z]) => { m4.makeTranslation(x, -0.5, z); im.setMatrixAt(n, m4); im.setColorAt(n++, col.setHex((x + z) % 2 ? A : B)); });
  under.forEach(([x, y, z]) => { m4.makeTranslation(x, y - 0.5, z); im.setMatrixAt(n, m4); im.setColorAt(n++, col.setHex(y === -1 ? 0x7a5236 : 0x5d5a70)); });
  raise.forEach(([x, y, z]) => { m4.makeTranslation(x, y, z); im.setMatrixAt(n, m4); im.setColorAt(n++, col.setHex((x + z) % 2 ? A : B)); });
  ground.add(im);

  // ---- ориентир мира ----
  const lmPos: [number, number, number, number] = v === 1 ? [0.4, 2, -4, 0.9] : v === 2 ? [2.6, 0, -3.4, 0.9] : v === 5 ? [0.4, 0, -3.6, 0.6] : [0.4, 0, -3.4, 0.9];
  const lm = new THREE.Group(); lm.position.set(lmPos[0], lmPos[1], lmPos[2]); lm.scale.setScalar(lmPos[3]); ground.add(lm);
  landmark(builder(lm, 'open'), k, A, B);

  const b = builder(ground, 'open');
  const stone = 0x8a8aa0, stone2 = 0x6f6f86, moss = 0x4f7f50;
  const dec: Cube[] = [];
  if (v === 0) { // алаң: камни и кусты по краям как раньше
    [[-6.5, -2], [6.4, -1.6], [-5.6, 2.8], [5.8, 3]].forEach(([x, z], i) => { b(0.9, 0.7, 0.9, x, 0.35, z, i % 2 ? stone : 0x3faa5a); b(0.6, 0.5, 0.6, x + 0.5, 0.25, z + 0.4, 0x2f8f4a); });
  } else if (v === 1) { // үстірт: камни на краях плато, лесенка-ориентир по бокам
    [[-6, -3.2, 2.5], [6, -3.2, 2.5], [-6.6, -1.5, 1], [6.5, -1.5, 1]].forEach(([x, z, y], i) => dec.push(cu(0.9, 0.6, 0.9, x, y + 0.3 - (y === 1 ? 0.5 : 0) , z, i % 2 ? stone : stone2)));
    dec.push(cu(1.2, 0.5, 0.5, -3.2, 2.25, -5, moss), cu(1.2, 0.5, 0.5, 3.6, 2.25, -5, moss));
  } else if (v === 2) { // көл: вода, мостик, камыш
    const w: Cube[] = [];
    for (let x = -5; x <= -3; x++) for (let z = -4; z <= -2; z++) w.push(cu(1, 0.7, 1, x, -0.65, z, 0x3aa0ff));
    inst(ground, w, [0x1a5aa0, 0.4]);
    for (let x = -6; x <= -2; x++) dec.push(cu(1, 0.15, 1.2, x, 0.05, -3, 0x9a6a3a));
    dec.push(cu(0.15, 0.6, 0.15, -6, 0.3, -3.6, 0x6b4428), cu(0.15, 0.6, 0.15, -2, 0.3, -3.6, 0x6b4428), cu(0.15, 0.6, 0.15, -6, 0.3, -2.4, 0x6b4428), cu(0.15, 0.6, 0.15, -2, 0.3, -2.4, 0x6b4428));
    [[-5.5, -4.6], [-2.6, -4.7], [-2.5, -1.6]].forEach(([x, z]) => dec.push(cu(0.12, 0.9, 0.12, x, 0.45, z, 0x3faa5a), cu(0.12, 0.7, 0.12, x + 0.25, 0.35, z + 0.1, 0x2f8f4a)));
    dec.push(cu(1, 0.7, 1, 5.6, 0.35, -2, stone), cu(0.7, 0.5, 0.7, 6.4, 0.25, -1.4, stone2), cu(0.9, 0.6, 0.9, 6, 0.3, 3, stone));
  } else if (v === 3) { // орман: кольцо деревьев (ствол + 3 куба кроны A/B)
    const tr: Cube[] = [], lf: Cube[] = [];
    [[-6.2, -2.6], [-3.4, -4.2], [0, -5], [3.6, -4.3], [6.2, -2.4], [-7, 1], [7, 1.2], [-6.4, 3.4]].forEach(([x, z], i) => {
      const h = 1.4 + (i % 3) * 0.3, c = dark(i % 2 ? A : B, 0.6);
      tr.push(cu(0.5, h, 0.5, x, h / 2, z, 0x6b4428));
      lf.push(cu(1.7, 0.9, 1.7, x, h + 0.3, z, c), cu(1.2, 0.8, 1.2, x, h + 1.05, z, dark(c, 1.15)), cu(0.7, 0.6, 0.7, x, h + 1.7, z, dark(c, 1.3)));
    });
    inst(ground, [...tr, ...lf]);
    dec.push(cu(0.7, 0.5, 0.7, 5.8, 0.25, 3.2, stone), cu(0.35, 0.3, 0.35, 5.5, 0.15, 3.6, 0xff6a8a));
  } else if (v === 4) { // қирандылар: сломанные колонны, арка, упавшие блоки
    [[-6.5, -2.4, 2.6], [-5, -4.2, 1.6], [-7.2, 0.5, 1.2], [5, -4, 2.2], [6.6, -1.8, 3], [7.3, 1.6, 1.4]].forEach(([x, z, h], i) => {
      dec.push(cu(0.9, h, 0.9, x, h / 2, z, i % 2 ? stone : stone2), cu(1.05, 0.25, 1.05, x, 0.12, z, stone2));
      if (i % 2) dec.push(cu(0.8, 0.5, 0.8, x + 0.5, h + 0.2, z, stone, [0.3, 0.5, 0.2]));
    });
    dec.push(cu(0.9, 2.6, 0.9, -1.7, 1.3, -2.2, stone), cu(0.9, 2.6, 0.9, 1.9, 1.3, -2.2, stone), cu(4.4, 0.6, 1, 0.1, 2.9, -2.2, stone2), cu(1.2, 0.5, 1, 0.1, 3.4, -2.2, stone));
    dec.push(cu(1, 0.6, 1, -3, 0.3, -1.8, stone2, [0, 0.4, 0]), cu(0.8, 0.5, 0.8, 3.6, 0.25, -1.7, stone, [0, 0.9, 0.1]), cu(0.9, 0.5, 0.9, -5.8, 0.25, 3, moss), cu(0.6, 0.4, 0.6, 5.7, 0.2, 3.1, stone2, [0, 0.5, 0]));
  } else { // кристалдар: кластеры светящихся кристаллов
    const ca: Cube[] = [], cb: Cube[] = [];
    [[-6.4, -2.2], [-3.6, -4.2], [3.2, -4.4], [6.3, -2], [-7, 1.2], [7, 1.6], [-5.8, 3.2], [5.8, 3.3]].forEach(([x, z], i) => {
      const t = i % 2 ? cb : ca, c = glow(i % 2 ? B : A);
      t.push(cu(0.4, 2 + (i % 3) * 0.5, 0.4, x, 1, z, c, [0.1, i, 0.12]), cu(0.28, 1.4, 0.28, x + 0.55, 0.7, z + 0.2, c, [-0.15, i + 1, -0.2]), cu(0.24, 1, 0.24, x - 0.45, 0.5, z + 0.35, c, [0.2, i + 2, 0.25]));
    });
    inst(ground, ca, [glow(A), 0.9]); inst(ground, cb, [glow(B), 0.9]);
    dec.push(cu(0.9, 0.6, 0.9, -5, 0.3, -1.6, stone2), cu(0.8, 0.5, 0.8, 4.6, 0.25, -1.6, stone2));
  }
  // фонари на ночных вариантах: столб + светящийся кубик (точки-источники добавляет вызывающий)
  if (spotLight(v).lanterns) [[-2.2, -1.8], [3.6, -1.8], [6.4, 2.2]].forEach(([x, z]) => { b(0.12, 1.6, 0.12, x, 0.8, z, 0x4a3a2a); b(0.36, 0.36, 0.36, x, 1.75, z, 0xffd27a, 0xffb84a, 1.6); });
  inst(ground, dec);
}
