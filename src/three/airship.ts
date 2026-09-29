// Летучий корабль: готовый парусник Kenney + «лётная» оснастка кодом, чтобы было видно, почему он держится в небе.
// По бортам — двигатели-гондолы на пилонах с крыльями и винтами, под килем — кристалл подъёма с кольцами рун и лучом,
// на корме — большой толкающий винт, на носу и корме — фонари. Паруса перекрашены в цвета «Жарық».
// Ось корабля — x (нос в +x), y вверх. Всё ставится по габаритам корпуса (hull), поэтому годится и для большого, и для малого корабля.
import * as THREE from 'three';
import { toonify } from './assets';
import { glowTexture } from './portal';

export interface Airship {
  g: THREE.Group;
  update(dt: number, t: number, km: number): void;
}

const SPARK_VS = `attribute float life; varying float vL; uniform float scale;
  void main(){ vL = life; vec4 mv = modelViewMatrix * vec4(position, 1.); gl_PointSize = (1. - life * .6) * scale / -mv.z; gl_Position = projectionMatrix * mv; }`;
const SPARK_FS = `uniform vec3 color; varying float vL;
  void main(){ float d = length(gl_PointCoord - .5); if (d > .5) discard; gl_FragColor = vec4(color, smoothstep(.5, 0., d) * (1. - vL) * .8); }`;

/** hull — габариты корпуса в системе родителя (без парусов); model — сама модель корабля (паруса перекрашиваем). */
export function dressAirship(hull: THREE.Box3, model: THREE.Object3D, o: { quality?: 'high' | 'low'; sailColors?: [number, number]; deckY?: number } = {}): Airship {
  const g = new THREE.Group();
  const L = hull.max.x - hull.min.x, Wd = hull.max.z - hull.min.z, cx = (hull.max.x + hull.min.x) / 2, cz = (hull.max.z + hull.min.z) / 2;
  const s = L / 14;                                            // масштаб оснастки: под большой корабль (~14 м) s = 1
  const deckY = o.deckY ?? 0;                                  // высота главной палубы

  // ---------- паруса: плотные, в цветах игры (полосы из палитры модели сохраняются) ----------
  const [sail1, sail2] = o.sailColors ?? [0xfff2d6, 0x9fe9ff];
  let k = 0;
  model.traverse(n => { const m = n as THREE.Mesh; if (!m.isMesh || m.userData.outline) return;
    if (/sail/.test(m.name)) { const mt = (m.material as THREE.MeshToonMaterial).clone(); mt.transparent = false; mt.opacity = 1; mt.depthWrite = true; mt.side = THREE.DoubleSide; mt.color.setHex(k++ % 2 ? sail2 : sail1); m.material = mt; }
    if (/flag/.test(m.name)) { const mt = (m.material as THREE.MeshToonMaterial).clone(); mt.color.setHex(0xff5fc8); m.material = mt; } });

  const M = (color: number, emissive = 0, ei = 0) => new THREE.MeshStandardMaterial({ color, emissive, emissiveIntensity: ei, flatShading: true });
  const wood = M(0x8a5534), woodDark = M(0x5d3620), brass = M(0xe0a53c), cloth = M(0xfff2d6), clothB = M(0x46d4ff), metal = M(0x4a4f73);
  const dress = new THREE.Group(); g.add(dress);             // всё «твёрдое» — в мультяшный вид с контуром

  // ---------- гондолы-двигатели на пилонах с крыльями ----------
  const props: THREE.Object3D[] = [], wings: THREE.Object3D[] = [], exhausts: THREE.Mesh[] = [];
  const glowMat = new THREE.MeshBasicMaterial({ map: glowTexture(), color: 0x46f2ff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  const engineX = cx - L * 0.06, engineY = deckY - 0.35 * s;
  for (const side of [-1, 1]) {
    const eng = new THREE.Group(); eng.position.set(engineX, engineY, cz + side * (Wd / 2 + 1.1 * s)); eng.scale.setScalar(s); dress.add(eng);
    // пилон от борта
    const pylon = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.22, 1.5), woodDark); pylon.position.set(0, 0.1, -side * 0.75); eng.add(pylon);
    // корпус гондолы: сигара вдоль x
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.34, 2.2, 10), metal); body.rotation.z = Math.PI / 2; eng.add(body);
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.6, 10), brass); nose.rotation.z = -Math.PI / 2; nose.position.x = 1.4; eng.add(nose);
    for (const x of [-0.6, 0.2, 0.9]) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.43, 0.06, 6, 16), brass); r.rotation.y = Math.PI / 2; r.position.x = x; eng.add(r); }
    // винт сзади
    const hub = new THREE.Group(); hub.position.x = -1.25; eng.add(hub);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.35, 8), brass); cap.rotation.z = Math.PI / 2; cap.position.x = -0.12; hub.add(cap);
    for (let b = 0; b < 3; b++) { const bl = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.25, 0.2), wood); bl.position.y = 0.6; bl.rotation.y = 0.35; const arm = new THREE.Group(); arm.rotation.x = (b / 3) * Math.PI * 2; arm.add(bl); hub.add(arm); }
    props.push(hub);
    // сопло: светящийся диск за винтом
    const ex = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.6), glowMat); ex.rotation.y = Math.PI / 2; ex.position.x = -1.15; ex.userData.noToon = true; eng.add(ex); exhausts.push(ex);
    // крыло: каркас из реек и полотно, машет медленно
    const wing = new THREE.Group(); wing.position.set(0.2, 0.25, side * 0.35); eng.add(wing);
    const shape = new THREE.Shape(); shape.moveTo(0.9, 0); shape.quadraticCurveTo(0.6, 1.4, -0.4, 2.6); shape.quadraticCurveTo(-0.7, 1.6, -1.1, 1.2); shape.quadraticCurveTo(-0.9, 0.5, -1.0, 0); shape.lineTo(0.9, 0);
    const mem = new THREE.Mesh(new THREE.ShapeGeometry(shape, 8), side > 0 ? cloth : clothB); (mem.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide;
    const plane = new THREE.Group(); plane.rotation.x = side * Math.PI / 2; wing.add(plane); plane.add(mem);
    // передняя кромка — изогнутая рейка, и две тонкие распорки к концу крыла
    const edge = (pts: [number, number][], r: number) => plane.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(([x, y]) => new THREE.Vector3(x, y, 0))), 12, r, 5), woodDark));
    edge([[0.9, 0], [0.72, 1.1], [0.2, 2.1], [-0.4, 2.6]], 0.07); edge([[-0.2, 0], [-0.3, 1.4], [-0.4, 2.55]], 0.04);
    wing.userData.side = side; wings.push(wing);
  }

  // ---------- корма: большой толкающий винт ----------
  const stern = new THREE.Group(); stern.position.set(hull.min.x - 0.2 * s, deckY - 0.3 * s, cz); stern.scale.setScalar(s * 1.3); dress.add(stern);
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.9, 8), brass); shaft.rotation.z = Math.PI / 2; shaft.position.x = 0.3; stern.add(shaft);
  const sHub = new THREE.Group(); stern.add(sHub);
  for (let b = 0; b < 4; b++) { const bl = new THREE.Mesh(new THREE.BoxGeometry(0.07, 1.1, 0.28), wood); bl.position.y = 0.55; bl.rotation.y = 0.4; const arm = new THREE.Group(); arm.rotation.x = (b / 4) * Math.PI * 2; arm.add(bl); sHub.add(arm); }
  const sCap = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 6), brass); sHub.add(sCap);
  props.push(sHub);

  // ---------- фонари на носу и корме ----------
  const lampMat = new THREE.MeshStandardMaterial({ color: 0xffd27a, emissive: 0xffb347, emissiveIntensity: 2.2 });
  const lamps: THREE.Object3D[] = [];
  for (const [x, z] of [[hull.max.x - L * 0.08, cz], [hull.min.x + L * 0.12, cz - Wd * 0.3], [hull.min.x + L * 0.12, cz + Wd * 0.3]] as const) {
    const lg = new THREE.Group(); lg.position.set(x, deckY + 1.7 * s, z); lg.scale.setScalar(s); dress.add(lg);
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.7, 0.1), woodDark); post.position.y = -0.85; lg.add(post);
    const top = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.18, 6), metal); top.position.y = 0.2; lg.add(top);
    const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.26, 6), lampMat); glass.userData.noToon = true; lg.add(glass);
    lamps.push(lg);
  }
  toonify(dress, { outline: 0.03 * s, shadows: o.quality === 'high' });
  const lampGlowMat = new THREE.SpriteMaterial({ map: glowTexture(), color: 0xffc56b, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.8 });
  lamps.forEach(l => { const sp = new THREE.Sprite(lampGlowMat); sp.scale.setScalar(1.1); l.add(sp); });
  const lampLight = new THREE.PointLight(0xffb347, 1.2, 8 * s); lampLight.position.set(hull.min.x + L * 0.12, deckY + 2 * s, cz); g.add(lampLight);

  // ---------- кристалл подъёма под килем ----------
  const keel = new THREE.Group(); keel.position.set(cx, hull.min.y - 0.55 * s, cz); keel.scale.setScalar(s); g.add(keel);
  const crystalMat = new THREE.MeshStandardMaterial({ color: 0x46f2ff, emissive: 0x19c6ff, emissiveIntensity: 1.1, flatShading: true, roughness: 0.25 });
  const cg = new THREE.OctahedronGeometry(0.6, 0); cg.scale(1, 1.9, 1);
  const main = new THREE.Mesh(cg, crystalMat); keel.add(main);
  for (let i = 0; i < 4; i++) { const c = new THREE.Mesh(cg, crystalMat); c.scale.setScalar(0.45); const a = i / 4 * Math.PI * 2; c.position.set(Math.cos(a) * 0.55, 0.35, Math.sin(a) * 0.55); c.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5); keel.add(c); }
  const ringMat = new THREE.MeshBasicMaterial({ color: 0x7ff6ff, transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false });
  const rings = [1.3, 1.8].map((r, i) => { const m = new THREE.Mesh(new THREE.TorusGeometry(r, 0.045, 6, 64), ringMat); m.rotation.x = Math.PI / 2 + (i ? 0.25 : -0.2); m.position.y = -0.2 - i * 0.35; keel.add(m); return m; });
  const keelGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0x46f2ff, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.7 })); keelGlow.scale.setScalar(4.5); keel.add(keelGlow);
  // луч вниз: мягкий конус, прозрачный к низу
  const beamMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, uniforms: { t: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: 'uniform float t; varying vec2 vUv; void main(){ float a = pow(vUv.y, 2.2) * (.55 + .15 * sin(vUv.y * 20. + t * 4.)); gl_FragColor = vec4(vec3(.28,.95,1.) * a, a); }' });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 2.6, 7, 24, 1, true), beamMat); beam.position.y = -4; keel.add(beam);
  const keelLight = new THREE.PointLight(0x46f2ff, 2.2, 16 * s); keelLight.position.y = -0.6; keel.add(keelLight);

  // ---------- искры из сопел и из-под кристалла ----------
  const SN = o.quality === 'low' ? 40 : 90, pos = new Float32Array(SN * 3), life = new Float32Array(SN);
  const vel = Array.from({ length: SN }, () => new THREE.Vector3());
  const spawn = (i: number) => {
    const src = i % 3;                                         // 0,1 — сопла, 2 — кристалл
    if (src < 2) { const e = exhausts[src].getWorldPosition(new THREE.Vector3()); g.worldToLocal(e); pos.set([e.x, e.y + (Math.random() - 0.5) * 0.3 * s, e.z + (Math.random() - 0.5) * 0.3 * s], i * 3); vel[i].set(-(2 + Math.random() * 2) * s, (Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.3); }
    else { pos.set([keel.position.x + (Math.random() - 0.5) * 1.2 * s, keel.position.y - 0.8 * s, keel.position.z + (Math.random() - 0.5) * 1.2 * s], i * 3); vel[i].set((Math.random() - 0.5) * 0.4, -(1 + Math.random() * 1.5) * s, (Math.random() - 0.5) * 0.4); }
    life[i] = Math.random() * 0.2;
  };
  const pGeo = new THREE.BufferGeometry(); pGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); pGeo.setAttribute('life', new THREE.BufferAttribute(life, 1));
  const pMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { color: { value: new THREE.Color(0x8ff8ff) }, scale: { value: 70 * s } }, vertexShader: SPARK_VS, fragmentShader: SPARK_FS });
  const parts = new THREE.Points(pGeo, pMat); parts.frustumCulled = false; g.add(parts);
  let spawned = false;

  return {
    g,
    update(dt, t, km) {
      if (!spawned) { g.updateMatrixWorld(true); for (let i = 0; i < SN; i++) { spawn(i); life[i] = Math.random(); } spawned = true; }
      props.forEach((p, i) => (p.rotation.x += dt * (i < 2 ? 14 : 6) * (0.4 + 0.6 * km)));
      wings.forEach(w => (w.rotation.x = -w.userData.side * (0.28 + Math.sin(t * 1.6) * 0.1 * km)));
      exhausts.forEach((e, i) => ((e.material as THREE.MeshBasicMaterial).opacity = 0.55 + Math.sin(t * 9 + i) * 0.15));
      main.rotation.y += dt * 0.6; rings[0].rotation.z += dt * 0.9; rings[1].rotation.z -= dt * 0.6;
      crystalMat.emissiveIntensity = 1 + Math.sin(t * 2.4) * 0.25; keelLight.intensity = 2 + Math.sin(t * 2.4) * 0.5;
      beamMat.uniforms.t.value = t;
      lamps.forEach((l, i) => (l.rotation.z = Math.sin(t * 1.4 + i) * 0.05));
      for (let i = 0; i < SN; i++) {
        life[i] += dt * 0.9; if (life[i] >= 1) spawn(i);
        pos[i * 3] += vel[i].x * dt; pos[i * 3 + 1] += vel[i].y * dt; pos[i * 3 + 2] += vel[i].z * dt;
      }
      pGeo.attributes.position.needsUpdate = pGeo.attributes.life.needsUpdate = true;
    },
  };
}
