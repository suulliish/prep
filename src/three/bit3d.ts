// Бит — дрон-помощник: летает рядом с героем, на «лице»-экране рисуется настроение (канвас 64×48 → текстура).
// Модель — characters.ts (makeBit); здесь только жизнь: лицо, моргание, полёт следом за героем, лицом к камере.
import * as THREE from 'three';
import { makeBit } from './characters';

export type BitMood = 'idle' | 'happy' | 'wow' | 'think' | 'sad';

export interface Bit {
  g: THREE.Group;
  setMood(m: BitMood): void;
  /** Кадр: anchor — где сейчас герой (мир), camTheta — азимут камеры (Бит парит сбоку от героя, поперёк взгляда), camPos — куда смотреть лицом. */
  update(dt: number, t: number, anchor: THREE.Vector3, camTheta: number, camPos: THREE.Vector3): void;
}

export function createBit(scene: THREE.Scene): Bit {
  const faceCanvas = document.createElement('canvas'); faceCanvas.width = 64; faceCanvas.height = 48;
  const faceTex = new THREE.CanvasTexture(faceCanvas); faceTex.magFilter = THREE.NearestFilter;
  let mood: BitMood = 'idle', blinkT = 0;
  function drawFace(blink = false) {
    const c = faceCanvas.getContext('2d')!;
    c.fillStyle = '#0c1036'; c.fillRect(0, 0, 64, 48);
    c.fillStyle = mood === 'sad' ? '#9fb0ff' : '#3ff0ff';
    const eye = (x: number) => {
      if (blink) { c.fillRect(x - 6, 22, 12, 3); return; }
      if (mood === 'happy') { c.fillRect(x - 6, 20, 3, 3); c.fillRect(x - 3, 17, 6, 3); c.fillRect(x + 3, 20, 3, 3); return; }
      if (mood === 'wow') { c.fillRect(x - 6, 12, 12, 16); c.fillStyle = '#0c1036'; c.fillRect(x - 2, 17, 4, 6); c.fillStyle = '#3ff0ff'; return; }
      if (mood === 'think') { c.fillRect(x - 5, 18, 10, 8); c.fillStyle = '#0c1036'; c.fillRect(x - 5, 18, 10, 3); c.fillStyle = '#3ff0ff'; return; }
      if (mood === 'sad') { c.fillRect(x - 5, 20, 10, 8); c.fillRect(x - 6, 17, 4, 3); return; }
      c.fillRect(x - 4, 15, 8, 12);
    };
    eye(20); eye(44);
    if (mood === 'happy' || mood === 'wow') { c.fillStyle = '#ff4fb8'; c.fillRect(8, 30, 6, 3); c.fillRect(50, 30, 6, 3); }
    faceTex.needsUpdate = true;
  }
  drawFace();
  const B = makeBit(faceTex);
  const bit = B.g; scene.add(bit);
  const antenna = B.antenna, bitProp = B.prop;
  bit.position.set(-2, 3, 1.6);

  const target = new THREE.Vector3(), side = new THREE.Vector3();
  return {
    g: bit,
    setMood(m) { mood = m; drawFace(); },
    update(dt, t, anchor, camTheta, camPos) {
      B.thrusters.forEach((th, i) => th.scale.setScalar(0.9 + Math.sin(t * 18 + i) * 0.15));
      B.flame.scale.set(1, 0.8 + Math.sin(t * 25) * 0.2, 1);
      // Бит летает сбоку от героя (поперёк взгляда камеры), а не между героем и камерой
      target.copy(anchor).add(side.set(-Math.sin(camTheta) * 1.1, 2.7 + Math.sin(t * 2.2) * 0.22, Math.cos(camTheta) * 1.1));
      bit.position.lerp(target, 0.05); bit.lookAt(camPos.x, bit.position.y, camPos.z);
      bitProp.rotation.y += dt * 22; (antenna.material as THREE.MeshToonMaterial).emissiveIntensity = 1.5 + Math.sin(t * 5) * 1;
      blinkT += dt; if (blinkT > 3.2) { drawFace(true); if (blinkT > 3.35) { blinkT = 0; drawFace(); } }
    },
  };
}
