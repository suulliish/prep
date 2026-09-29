// Мир 4 «Неоновый город»: ночной квартал из Kenney City Kit (CC0) с неоном кодом: светящиеся окна, полосы по крышам, сетка на асфальте, вывески.
import * as THREE from 'three';
import type { Palette } from '../worlds3d';
import type { IslandKits } from '../island3d';
import { toonMat } from '../assets';
import { glowBox, halo, localBox, signPlane } from './_fx46';

const PINK = 0xff4fb8, CYAN = 0x3ff0ff, VIOLET = 0xb58cff, YELLOW = 0xffe14a;
const NEONS = [PINK, CYAN, VIOLET, YELLOW];

/** Маска окон: из палитры Kenney оставляем только голубые/сиреневые ячейки (стёкла), остальное чёрное. Одна на исходную текстуру. */
const masks = new WeakMap<THREE.Texture, THREE.CanvasTexture>();
function windowMask(map: THREE.Texture): THREE.CanvasTexture {
  let t = masks.get(map);
  if (t) return t;
  const img = map.image as CanvasImageSource & { width: number; height: number };
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
  const x = c.getContext('2d')!; x.drawImage(img, 0, 0);
  const d = x.getImageData(0, 0, c.width, c.height), p = d.data;
  for (let i = 0; i < p.length; i += 4) {
    const on = p[i + 2] - p[i] > 40;                       // синева стёкол
    p[i] = p[i + 1] = p[i + 2] = on ? 255 : 0; p[i + 3] = 255;
  }
  x.putImageData(d, 0, 0);
  t = new THREE.CanvasTexture(c); t.flipY = map.flipY; t.colorSpace = THREE.SRGBColorSpace; t.wrapS = map.wrapS; t.wrapT = map.wrapT;
  masks.set(map, t); return t;
}
const neonMats = new Map<string, THREE.MeshToonMaterial>();
/** Здание: тёмный корпус, окна светятся цветом неона. */
function neonBuilding(src: THREE.MeshToonMaterial, neon: number, body: number): THREE.MeshToonMaterial {
  const k = `${src.uuid}|${neon}|${body}`;
  let m = neonMats.get(k);
  if (!m) {
    m = src.clone(); m.color.set(body); if (src.map) { m.emissiveMap = windowMask(src.map); m.emissive.set(neon); m.emissiveIntensity = 1.25; }
    neonMats.set(k, m);
  }
  return m;
}

const tints = new Map<string, THREE.MeshToonMaterial>();
/** Столбы и знаки: тот же материал, но холодный фиолетовый оттенок ночи. */
function nightTint(o: THREE.Object3D, color: number) {
  o.traverse(m => {
    const me = m as THREE.Mesh; if (!me.isMesh || me.userData.outline) return;
    const src = toonMat(me.material as THREE.Material) as THREE.MeshToonMaterial, k = `${src.uuid}|${color}`;
    let t = tints.get(k); if (!t) { t = src.clone(); t.color.multiply(new THREE.Color(color)); tints.set(k, t); }
    me.material = t;
  });
}

/** Светящаяся сетка на асфальте: линии двух цветов, затухают к краям. */
function gridFloor(): THREE.Mesh {
  const S = 512, c = document.createElement('canvas'); c.width = c.height = S;
  const x = c.getContext('2d')!; x.clearRect(0, 0, S, S);
  const cells = 8, step = S / cells;
  for (let i = 0; i <= cells; i++) {
    x.lineWidth = 3; x.strokeStyle = i % 2 ? '#3ff0ff' : '#ff4fb8'; x.shadowBlur = 10; x.shadowColor = x.strokeStyle;
    x.beginPath(); x.moveTo(i * step, 0); x.lineTo(i * step, S); x.stroke(); x.beginPath(); x.moveTo(0, i * step); x.lineTo(S, i * step); x.stroke();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 2.5);
  // затухание к краям через карту прозрачности
  const a = document.createElement('canvas'); a.width = a.height = 128; const ax = a.getContext('2d')!;
  const gr = ax.createRadialGradient(64, 64, 10, 64, 64, 64); gr.addColorStop(0, '#fff'); gr.addColorStop(0.6, '#bbb'); gr.addColorStop(1, '#000'); ax.fillStyle = gr; ax.fillRect(0, 0, 128, 128);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(30, 24), new THREE.MeshBasicMaterial({ map: t, alphaMap: new THREE.CanvasTexture(a), transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }));
  m.rotation.x = -Math.PI / 2; m.position.y = 0.03; return m;
}

/** Дальний ряд небоскрёбов на заднем крае острова: горизонт города за боем. */
const SKYLINE: [string, number, number, number][] = [
  ['building-skyscraper-d', -10.4, -13.2, 9.6], ['building-skyscraper-a', -7.8, -14.6, 7], ['building-skyscraper-b', -5.0, -13.0, 9], ['building-skyscraper-e', -2.2, -15.0, 8],
  ['building-skyscraper-c', 0.6, -13.6, 10.4], ['building-skyscraper-d', 3.4, -14.8, 8.4], ['building-skyscraper-a', 6.0, -13.2, 7.4], ['building-skyscraper-b', 8.8, -14.4, 10], ['building-skyscraper-e', 11, -13, 7],
];

function extra(g: THREE.Group, layout: number, kits: IslandKits) {
  g.add(gridFloor());
  const nk = kits.get('neon');
  if (nk) SKYLINE.forEach(([name, x, z, h], i) => { const o = nk.get(name, { height: h, ground: true }); o.position.set(x, 0, z); o.rotation.y = (i % 3 - 1) * 0.12; g.add(o); });
  let n = 0;
  for (const o of [...g.children]) {
    const nm = o.name;
    if (/^sign-highway/.test(nm)) {
      // рамка вдоль экрана, а не ребром; вместо зелёной дорожной таблички — светящаяся вывеска
      const b = localBox(o), sc = o.scale.x, W = (b.max.z - b.min.z), H = b.max.y - b.min.y, D = b.max.x - b.min.x;
      const sp = signPlane(n++ % 2 ? 'ЖАРЫҚ' : 'NEON', n % 2 ? '#3ff0ff' : '#ff4fb8', W * 0.8 / sc, H * 0.36 / sc);
      sp.position.set((b.min.x - o.position.x) / sc - 0.02 / sc - D * 0.0, (b.min.y + H * 0.78) / sc, ((b.max.z + b.min.z) / 2 - o.position.z) / sc); sp.rotation.y = -Math.PI / 2;
      o.add(sp); o.rotation.y += Math.PI / 2;
    }
    if (/^(traffic-light|road-sign|bridge-pillar|electricity)/.test(nm)) nightTint(o, 0x8f86c8);
    if (/^(building|low-detail)/.test(nm)) {
      const neon = NEONS[n++ % 3];
      o.traverse(m => { const me = m as THREE.Mesh; if (me.isMesh && !me.userData.outline) me.material = neonBuilding(toonMat(me.material as THREE.Material) as THREE.MeshToonMaterial, neon, 0x8a78c8); });
      // неоновая корона по краю крыши + вертикальная полоса на углу
      const b = localBox(o), w = b.max.x - b.min.x, d = b.max.z - b.min.z, h = b.max.y - b.min.y, t = 0.09;
      if (h > 2.4) {
        const rot = o.rotation.y, cx = (b.max.x + b.min.x) / 2 - o.position.x, cz = (b.max.z + b.min.z) / 2 - o.position.z, y = b.max.y + 0.03;
        const pieces: [number, number, number, number][] = [[0, d / 2, w + t, t], [0, -d / 2, w + t, t], [w / 2, 0, t, d + t], [-w / 2, 0, t, d + t]];
        const grp = new THREE.Group(); grp.position.copy(o.position); grp.rotation.y = rot;
        for (const [px, pz, sx, sz] of pieces) { const s = glowBox(neon, sx, t, sz); s.position.set(cx + px, y, cz + pz); grp.add(s); }
        const v = glowBox(neon, t, h * 0.8, t); v.position.set(cx + w / 2, b.min.y + h * 0.45, cz + d / 2); grp.add(v);
        const hl = halo(neon, Math.max(w, d) * 2.6, 0.5); hl.position.set(cx, b.max.y, cz); grp.add(hl);
        g.add(grp);
      }
    } else if (/^light-/.test(nm)) {
      nightTint(o, 0x8f86c8);
      const b = localBox(o), grp = new THREE.Group(); grp.position.copy(o.position); grp.rotation.y = o.rotation.y;
      const col = n++ % 2 ? PINK : CYAN, lamp = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), new THREE.MeshBasicMaterial({ color: col }));
      lamp.position.set((b.max.x + b.min.x) / 2 - o.position.x, b.max.y - 0.25, (b.max.z + b.min.z) / 2 - o.position.z); grp.add(lamp);
      const hl = halo(col, 2.6, 0.7); hl.position.copy(lamp.position); grp.add(hl);
      const pool = halo(col, 4.2, 0.35); pool.material.depthTest = true; pool.position.set(lamp.position.x, 0.06, lamp.position.z); grp.add(pool);
      g.add(grp);
    }
  }
  // вывески: две надписи на фоне, по уголку (не в боевой полосе)
  const signs: [string, string, number, number, number, number][] = [['NEON', '#ff4fb8', -8.6, 4.4, -9.4, 0.25], ['КОД', '#3ff0ff', 8.4, 5.4, -9.6, -0.25]];
  if (layout !== 5) for (const [txt, col, x, y, z, ry] of signs) { const s = signPlane(txt, col, 3.4, 1.5); s.position.set(x, y, z); s.rotation.y = ry; g.add(s); const hl = halo(parseInt(col.slice(1), 16), 6, 0.45); hl.position.set(x, y, z - 0.2); g.add(hl); }
}

export const palette: Palette = {
  kits: ['neon'],
  ground: { tile: 'hex_grass', color: 0x1d1838 },
  water: 0x3a1fa8,
  clouds: false,
  roles: {
    lm1: [['neon', 'building-a', 3.6], ['neon', 'building-h', 3.6], ['neon', 'building-c', 2.8]],
    lm2: [['neon', 'building-m', 6.4], ['neon', 'building-skyscraper-a', 6.6]],
    lm3: [['neon', 'building-i', 3.8], ['neon', 'building-e', 2.8]],
    lm4: [['neon', 'sign-highway-wide', 5.0]], lm5: [['neon', 'low-detail-building-wide-a', 3.4], ['neon', 'low-detail-building-wide-b', 3.4]],
    lm6: [['neon', 'building-skyscraper-c', 7.4], ['neon', 'building-skyscraper-e', 7.0]],
    bd1: [['neon', 'building-skyscraper-b', 8.0], ['neon', 'building-skyscraper-d', 9.4]],
    bd2: [['neon', 'building-skyscraper-e', 8.0], ['neon', 'building-skyscraper-a', 7.0]],
    bd3: [['neon', 'building-skyscraper-d', 10.0]], bd4: [['neon', 'building-skyscraper-b', 9.0]],
    tree: [['neon', 'light-curved', 4.4], ['neon', 'light-square', 4.4], ['neon', 'light-curved-double', 4.6], ['neon', 'traffic-light', 3.6], ['neon', 'light-curved-cross', 4.4]],
    tall: [['neon', 'light-curved-cross', 5.6], ['neon', 'light-square-double', 5.4], ['neon', 'road-sign-empty-hanging', 4.8]],
    dead: [['neon', 'road-sign-street', 3.6], ['neon', 'traffic-light', 3.4]],
    rock: [['neon', 'construction-barrier', 1.0], ['neon', 'dumpster', 1.2], ['neon', 'construction-cone', 0.9]],
    rockBig: [['neon', 'dumpster', 1.9], ['neon', 'bridge-pillar-wide', 2.8]],
    bush: [['neon', 'construction-cone', 1.0], ['neon', 'construction-light', 1.1], ['neon', 'construction-barrier', 0.9]],
    grass: [['neon', 'construction-cone', 0.7], ['neon', 'construction-light', 0.8]],
    c1: [['neon', 'construction-light', 2.4]], c2: [['neon', 'traffic-light', 3.0]], c3: [['neon', 'road-sign-street', 2.6]], c4: [['neon', 'dumpster', 1.5]], c5: [['neon', 'construction-barrier', 1.3]], c6: [['neon', 'construction-cone', 1.2]],
  },
  crystals: [PINK, CYAN, VIOLET],
  extra,
};
