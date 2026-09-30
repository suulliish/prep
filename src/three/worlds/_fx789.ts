// Общие приёмы миров 7–9 (Вулкан, Затонувший храм, Мир великанов): окраска моделей набора и «парящие» частицы.
// Файл без номера в имени: палитрой мира он не считается (worlds3d.ts берёт только файлы вида <номер>-<имя>.ts).
import * as THREE from 'three';
import { ambientOf } from '../ambient';
import { softDot } from '../ambient_fx';

/** Окрасить модели верхнего уровня острова (по имени) умножением цвета: все материалы модели становятся темнее/цветнее. */
export function tintMul(g: THREE.Group, match: (name: string) => boolean, color: number) {
  const cache = new Map<THREE.Material, THREE.Material>();
  for (const o of g.children) {
    if (!match(o.name)) continue;
    o.traverse(n => {
      const m = n as THREE.Mesh; if (!m.isMesh || m.userData.outline) return;
      const src = m.material as THREE.MeshToonMaterial;
      if (!cache.has(src)) { const c = src.clone(); c.color.multiply(new THREE.Color(color)); cache.set(src, c); }
      m.material = cache.get(src)!;
    });
  }
}

/** Двухцветная окраска без текстуры: грани, смотрящие вверх, — цветом top, боковые — цветом side (цвет вершин по нормали).
 *  Так исходная цветная палитра пака (зелёный мох, лавандовый камень) заменяется одним материалом мира. */
export function paintNormal(g: THREE.Group, match: (name: string) => boolean, side: number, top: number, emissive = 0x000000) {
  const cs = new THREE.Color(side), ct = new THREE.Color(top), c = new THREE.Color();
  const mats = new Map<THREE.Material, THREE.Material>();
  for (const o of g.children) {
    if (!match(o.name)) continue;
    o.traverse(n => {
      const m = n as THREE.Mesh; if (!m.isMesh || m.userData.outline) return;
      const geo = m.geometry, nrm = geo.getAttribute('normal');
      if (nrm && !geo.userData.paintKey) {
        const col = new Float32Array(nrm.count * 3);
        for (let i = 0; i < nrm.count; i++) {
          const t = THREE.MathUtils.smoothstep(nrm.getY(i), 0.3, 0.85);
          c.copy(cs).lerp(ct, t); col.set([c.r, c.g, c.b], i * 3);
        }
        geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); geo.userData.paintKey = 1;
      }
      const src = m.material as THREE.MeshToonMaterial;
      if (!mats.has(src)) {
        const p = src.clone(); p.map = null; p.color.set(0xffffff); p.vertexColors = true; p.emissive.set(emissive); p.needsUpdate = true; mats.set(src, p);
      }
      m.material = mats.get(src)!;
    });
  }
}

/** Мягкая круглая текстура-пятно для частиц (общая на всё приложение). */
export const dotTexture = (): THREE.Texture => softDot();

export interface Drift { n: number; area: [x0: number, x1: number, z0: number, z1: number]; height: number; speed: [min: number, max: number]; sway?: number;
  size: number; colors: number[]; rise?: 1 | -1; seed?: number; blending?: THREE.Blending; opacity?: number }
/** Медленно летящие частицы (искры, пузыри, пыль): двигаются от тикера острова (ambient.ts), отдельный цикл не нужен. На low видна половина. */
export function drift(g: THREE.Group, d: Drift) {
  let s = (d.seed ?? 7) * 9301 + 49297; const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  const pos = new Float32Array(d.n * 3), col = new Float32Array(d.n * 3), spd = new Float32Array(d.n), ph = new Float32Array(d.n), c = new THREE.Color();
  const dir = d.rise ?? 1;
  for (let i = 0; i < d.n; i++) {
    pos[i * 3] = d.area[0] + rnd() * (d.area[1] - d.area[0]); pos[i * 3 + 1] = rnd() * d.height; pos[i * 3 + 2] = d.area[2] + rnd() * (d.area[3] - d.area[2]);
    spd[i] = d.speed[0] + rnd() * (d.speed[1] - d.speed[0]); ph[i] = rnd() * 6.28;
    c.set(d.colors[i % d.colors.length]); col.set([c.r, c.g, c.b], i * 3);
  }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mat = new THREE.PointsMaterial({ size: d.size, map: softDot(), vertexColors: true, transparent: true, opacity: d.opacity ?? 1, depthWrite: false, blending: d.blending ?? THREE.AdditiveBlending, fog: false });
  const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; pts.renderOrder = 3;
  const sway = d.sway ?? 0.5, amb = ambientOf(g);
  amb.onDensity(k => geo.setDrawRange(0, Math.max(1, Math.ceil(d.n * k))));
  amb.add(c => {
    const dt = c.dt * c.km, t = c.t;
    for (let i = 0; i < d.n; i++) {
      let y = pos[i * 3 + 1] + spd[i] * dt * dir;
      if (y > d.height) y -= d.height; else if (y < 0) y += d.height;
      pos[i * 3 + 1] = y; pos[i * 3] += Math.sin(t * 0.8 + ph[i]) * sway * dt;
    }
    geo.attributes.position.needsUpdate = true;
  });
  g.add(pts); return pts;
}

/** Ступенчатый свет игры (gradientMap) с любой готовой модели острова: свой код-меш выглядит так же, как модели. */
export function gameGradient(g: THREE.Group): THREE.Texture | null {
  let gm: THREE.Texture | null = null;
  g.traverse(o => { const m = (o as THREE.Mesh).material as THREE.MeshToonMaterial | undefined; if (!gm && m?.gradientMap) gm = m.gradientMap; });
  return gm;
}

/** Перекрасить плитки земли (общий материал всех плиток острова). Нужно, чтобы закатный тёплый свет не «зеленил» бирюзу и т.п. */
export function recolorGround(g: THREE.Group, color: number) {
  const done = new Set<THREE.Material>();
  for (const o of g.children) if (o.name === 'hex_grass') o.traverse(n => { const m = (n as THREE.Mesh).material as THREE.MeshToonMaterial | undefined;
    if ((n as THREE.Mesh).isMesh && m && !done.has(m)) { m.color.set(color); done.add(m); } });
}
