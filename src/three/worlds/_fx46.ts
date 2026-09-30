// Общие приёмы для миров 4–6 (неон, трасса, лёд): свечение, светящиеся полоски, надписи. Всё простыми мешами и текстурами из canvas.
import * as THREE from 'three';
import { ambientOf } from '../ambient';

let glowTex: THREE.CanvasTexture | null = null;
/** Мягкое круглое пятно света (для ореолов). */
export function glowTexture(): THREE.CanvasTexture {
  if (glowTex) return glowTex;
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d')!, g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,0.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  glowTex = new THREE.CanvasTexture(c); glowTex.userData.keep = true; return glowTex;
}
/** Ореол: спрайт, складывающийся со светом. */
export function halo(color: number, size: number, opacity = 0.8): THREE.Sprite {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending }));
  s.scale.set(size, size, 1); return s;
}
/** Светящаяся коробка (полоска неона, лампа). */
export function glowBox(color: number, w: number, h: number, d: number): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial({ color })); return m;
}
/** Габариты предмета без поворота (в мировых единицах, но с масштабом). Поворот возвращается на место. */
export function localBox(o: THREE.Object3D): THREE.Box3 {
  const r = o.rotation.y; o.rotation.y = 0; o.updateMatrixWorld(true);
  const b = new THREE.Box3().setFromObject(o); o.rotation.y = r; o.updateMatrixWorld(true); return b;
}
/** Плоская надпись со свечением: холст → плоскость. */
export function signPlane(text: string, color: string, w: number, h: number, bg = 'rgba(8,4,24,0.85)', font = 'bold 64px Arial Black, Arial, sans-serif'): THREE.Mesh {
  const c = document.createElement('canvas'); c.width = 512; c.height = Math.round(512 * h / w);
  const x = c.getContext('2d')!;
  x.fillStyle = bg; x.fillRect(0, 0, c.width, c.height);
  x.strokeStyle = color; x.lineWidth = 10; x.shadowColor = color; x.shadowBlur = 18; x.strokeRect(10, 10, c.width - 20, c.height - 20);
  x.font = font; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = color; x.shadowBlur = 24; x.fillText(text, c.width / 2, c.height / 2 + 3, c.width - 60);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: t, side: THREE.DoubleSide }));
}

export interface NeonItem { mat?: THREE.MeshBasicMaterial; halo?: THREE.Sprite; kind: 'sign' | 'strip'; phase: number }
/** Неон живёт: вывески «барахлят» (короткие сбои раз в несколько секунд), полосы на крышах пульсируют волной. При «уменьшить движение» свет ровный. */
export function neonLife(g: THREE.Group, items: NeonItem[]) {
  const amb = ambientOf(g), base = items.map(i => ({ c: i.mat ? i.mat.color.clone() : null, o: i.halo ? i.halo.material.opacity : 0 }));
  amb.add(c => {
    items.forEach((it, i) => {
      let v = 1;
      if (c.km >= 1) {
        if (it.kind === 'strip') v = 0.6 + 0.4 * Math.sin(c.t * 1.9 + it.phase);
        else {
          const w = (c.t * 0.21 + it.phase) % 1, k = Math.floor(c.t * 14 + it.phase * 9), h = Math.sin(k * 12.9898 + it.phase * 78.233) * 43758.5453, r = h - Math.floor(h);
          v = w > 0.9 ? (r > 0.45 ? 1 : 0.18) : 0.93 + 0.07 * Math.sin(c.t * 3 + it.phase);
        }
      }
      if (it.mat && base[i].c) it.mat.color.copy(base[i].c!).multiplyScalar(v);
      if (it.halo) it.halo.material.opacity = base[i].o * (0.4 + 0.6 * v);
    });
  });
}
