// Портал «Жарық»: каменное кольцо с рунами, кристалл-замок сверху, вихрь внутри, искры, втягивающиеся в центр.
// Один и тот же портал стоит на носу корабля (хаб) и открывается в воздухе в бою (прибытие героя).
// Руны загораются по мере энергии дня (setPower), при открытии — вспышка и ударная волна (pulse).
// Лицо портала смотрит в +z локальной системы; центр кольца на высоте center.
import * as THREE from 'three';
import { toonify } from './assets';

export interface Portal {
  g: THREE.Group;
  /** Высота центра кольца над основанием. */
  center: number;
  radius: number;
  /** 0 — спит, 1 — открыт; руны горят на долю power. Меняется плавно. */
  setPower(p: number): void;
  /** Вспышка и волна (открытие, вход, выход героя). */
  pulse(): void;
  update(dt: number, t: number): void;
  dispose(): void;
}

const VORTEX_VS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }';
// вихрь: спиральные рукава + «туннель» колец, бегущих в глубину, яркая кромка и светлое ядро
const VORTEX_FS = `uniform float t, power; uniform vec3 cA, cB, cC; varying vec2 vUv;
  float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.-2.*f);
    return mix(mix(h(i), h(i+vec2(1,0)), f.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), f.x), f.y); }
  void main(){ vec2 p = (vUv - .5) * 2.; float r = length(p); if (r > 1.) discard;
    float a = atan(p.y, p.x), sp = .6 + power * 1.4;
    float depth = log(max(r, .02));
    float tw = a + depth * 2.2 - t * sp;                              // закрученный угол
    float arms = sin(tw * 3.) * .5 + .5;
    float cloud = n(vec2(tw * 1.6, depth * 3. - t * sp * .8)) * .6 + n(vec2(tw * 4., depth * 7. - t * sp * 1.7)) * .4;
    float rings = smoothstep(.55, 1., sin(depth * 9. + t * sp * 4.) * .5 + .5) * .35;
    vec3 c = mix(cB, cA, arms * .7 + cloud * .5);
    c = mix(c, cC, smoothstep(.55, .95, cloud) * .6);
    c += rings * cA;
    float core = smoothstep(.45, 0., r);
    c = mix(c, vec3(1.), core * (.3 + power * .3));
    float rim = smoothstep(.78, .98, r);
    c += cA * rim * (.5 + power * .6);
    c *= .55 + power * .5;
    gl_FragColor = vec4(c, .92); }`;

// мягкие круглые искры с аддитивным смешением
const SPARK_VS = `attribute float size; attribute float alpha; varying float vA; uniform float scale;
  void main(){ vA = alpha; vec4 mv = modelViewMatrix * vec4(position, 1.); gl_PointSize = size * scale / -mv.z; gl_Position = projectionMatrix * mv; }`;
const SPARK_FS = `uniform vec3 color; varying float vA;
  void main(){ float d = length(gl_PointCoord - .5); if (d > .5) discard; float k = smoothstep(.5, 0., d); gl_FragColor = vec4(color * (1. + k), k * vA); }`;

export function createPortal(o: { radius?: number; base?: boolean; colors?: [number, number, number]; light?: number } = {}): Portal {
  const R = o.radius ?? 1.35, base = o.base ?? true, lightK = o.light ?? 1;
  const [colA, colB, colC] = o.colors ?? [0x46f2ff, 0x6a3cff, 0xff5fc8];
  const g = new THREE.Group();
  const center = base ? R + 0.62 : 0;
  const ringG = new THREE.Group(); ringG.position.y = center; g.add(ringG);
  const geos: THREE.BufferGeometry[] = [], mats: THREE.Material[] = [];
  const keep = <T extends THREE.BufferGeometry | THREE.Material>(x: T) => { (x instanceof THREE.Material ? mats : geos).push(x as never); return x; };

  // ---------- каменное кольцо: клинья-«вуссуары» с зазорами ----------
  const stoneG = new THREE.Group(); g.add(stoneG);
  const N = 14, W = 0.42, D = 0.42, gap = 0.035;
  const stoneA = keep(new THREE.MeshStandardMaterial({ color: 0x75789c, flatShading: true }));
  const stoneB = keep(new THREE.MeshStandardMaterial({ color: 0x5f6288, flatShading: true }));
  const wedgeGeo = (() => {
    const s = new THREE.Shape(), a0 = -Math.PI / N + gap, a1 = Math.PI / N - gap, r0 = R, r1 = R + W;
    s.moveTo(Math.cos(a0) * r0, Math.sin(a0) * r0); s.lineTo(Math.cos(a0) * r1, Math.sin(a0) * r1);
    s.absarc(0, 0, r1, a0, a1, false); s.lineTo(Math.cos(a1) * r0, Math.sin(a1) * r0); s.absarc(0, 0, r0, a1, a0, true);
    const e = new THREE.ExtrudeGeometry(s, { depth: D, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.04, bevelSegments: 1, curveSegments: 3 });
    e.translate(0, 0, -D / 2); return keep(e);
  })();
  const runes: THREE.Mesh[] = [];
  const runeGeo = keep(new THREE.PlaneGeometry(0.16, 0.2));
  const runeTex = runeTexture(); const runeMats: THREE.MeshBasicMaterial[] = [];
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2 + Math.PI / 2;           // первый клин — замковый, сверху
    const m = new THREE.Mesh(wedgeGeo, i % 2 ? stoneB : stoneA); m.rotation.z = a; m.position.y = center; stoneG.add(m);
    // руна на лицевой и тыльной стороне каждого клина, кроме нижних (они уходят в основание)
    if (base && (i === N / 2 || i === N / 2 - 1 || i === N / 2 + 1)) continue;
    const tex = runeTex.clone(); tex.repeat.set(0.25, 1); tex.offset.x = (runeMats.length % 4) * 0.25; tex.needsUpdate = true;   // у каждой руны свой знак из атласа
    const rm = keep(new THREE.MeshBasicMaterial({ map: tex, transparent: true, color: 0x2b2d52, depthWrite: false })); runeMats.push(rm);
    for (const side of [1, -1]) {
      const r = new THREE.Mesh(runeGeo, rm); const rr = R + W / 2;
      r.position.set(Math.cos(a) * rr, center + Math.sin(a) * rr, side * (D / 2 + 0.056)); r.rotation.z = a - Math.PI / 2; if (side < 0) r.rotation.y = Math.PI;
      g.add(r); runes.push(r);
    }
  }

  // ---------- основание: ступени и два столбика с кристаллами ----------
  const pillars: THREE.Object3D[] = [];
  if (base) {
    const step = (w: number, h: number, d: number, y: number, m: THREE.Material) => { const b = new THREE.Mesh(keep(new THREE.BoxGeometry(w, h, d)), m); b.position.y = y; stoneG.add(b); };
    step(2 * R + 1.5, 0.22, 1.5, 0.11, stoneB);
    step(2 * R + 0.9, 0.22, 1.05, 0.33, stoneA);
    step(1.3, 0.3, 0.7, 0.55, stoneB);                       // подпора под нижним клином
    for (const s of [-1, 1]) {
      const p = new THREE.Group(); p.position.set(s * (R + 0.95), 0.44, 0.1); stoneG.add(p);
      const col = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.16, 0.22, 0.9, 6)), stoneA); col.position.y = 0.45; p.add(col);
      const cap = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.26, 0.2, 0.14, 6)), stoneB); cap.position.y = 0.95; p.add(cap);
      pillars.push(p);
    }
  }
  toonify(stoneG, { outline: 0.025 });

  // ---------- кристалл-замок над кольцом и кристаллы на столбиках ----------
  const crystalMat = keep(new THREE.MeshStandardMaterial({ color: colA, emissive: colA, emissiveIntensity: 0.6, flatShading: true, roughness: 0.3 }));
  const crystalGeo = keep(new THREE.OctahedronGeometry(0.28, 0)); crystalGeo.scale(1, 1.7, 1);
  const key = new THREE.Mesh(crystalGeo, crystalMat); key.position.y = center + R + W + 0.45; g.add(key);
  const small = pillars.map(p => { const c = new THREE.Mesh(crystalGeo, crystalMat); c.scale.setScalar(0.55); c.position.set(p.position.x, p.position.y + 1.25, p.position.z); g.add(c); return c; });

  // ---------- вихрь и сияние ----------
  const vortexMat = keep(new THREE.ShaderMaterial({
    transparent: true, side: THREE.DoubleSide, depthWrite: false,
    uniforms: { t: { value: 0 }, power: { value: 0.2 }, cA: { value: new THREE.Color(colA) }, cB: { value: new THREE.Color(colB) }, cC: { value: new THREE.Color(colC) } },
    vertexShader: VORTEX_VS, fragmentShader: VORTEX_FS,
  }));
  const vortex = new THREE.Mesh(keep(new THREE.CircleGeometry(R + 0.02, 64)), vortexMat); ringG.add(vortex);
  const haloMat = keep(new THREE.MeshBasicMaterial({ map: glowTexture(), color: colA, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.5 }));
  const halo = new THREE.Mesh(keep(new THREE.PlaneGeometry((R + W) * 3.4, (R + W) * 3.4)), haloMat); halo.position.z = -0.25; halo.renderOrder = -1; ringG.add(halo);
  const shockMat = keep(new THREE.MeshBasicMaterial({ color: colA, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0, side: THREE.DoubleSide }));
  const shock = new THREE.Mesh(keep(new THREE.RingGeometry(0.9, 1, 64)), shockMat); ringG.add(shock);

  // ---------- искры: спираль внутрь кольца ----------
  const SN = 90, sPos = new Float32Array(SN * 3), sSize = new Float32Array(SN), sAlpha = new Float32Array(SN);
  const seeds = Array.from({ length: SN }, () => ({ a: Math.random() * 6.28, r: Math.random(), s: 0.6 + Math.random() * 0.8, z: (Math.random() - 0.5) * 0.3 }));
  const sGeo = keep(new THREE.BufferGeometry());
  sGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3)); sGeo.setAttribute('size', new THREE.BufferAttribute(sSize, 1)); sGeo.setAttribute('alpha', new THREE.BufferAttribute(sAlpha, 1));
  const sMat = keep(new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { color: { value: new THREE.Color(colA).lerp(new THREE.Color(0xffffff), 0.35) }, scale: { value: 60 } }, vertexShader: SPARK_VS, fragmentShader: SPARK_FS }));
  const sparks = new THREE.Points(sGeo, sMat); sparks.frustumCulled = false; ringG.add(sparks);

  // ---------- осколки на орбите ----------
  const shardGeo = keep(new THREE.OctahedronGeometry(0.09, 0));
  const shards = Array.from({ length: 6 }, (_, i) => { const m = new THREE.Mesh(shardGeo, crystalMat); ringG.add(m); return { m, a: (i / 6) * Math.PI * 2 }; });

  const light = new THREE.PointLight(colA, 1.5, 9); light.position.set(0, center, 1); g.add(light);

  let power = 0.2, target = 0.2, pulseT = 0;
  const runeLit = new THREE.Color(colA), runeOff = new THREE.Color(0x2b2d52);
  return {
    g, center, radius: R,
    setPower(p) { target = Math.max(0, Math.min(1.2, p)); },
    pulse() { pulseT = 1; },
    update(dt, t) {
      power += (target - power) * Math.min(1, dt * 2.5);
      const pw = power + pulseT * 0.8;
      vortexMat.uniforms.t.value = t; vortexMat.uniforms.power.value = Math.min(1.4, pw);
      haloMat.opacity = 0.25 + pw * 0.45 + Math.sin(t * 2.3) * 0.05;
      light.intensity = (0.6 + pw * 1.6 + Math.sin(t * 5) * 0.15) * lightK;
      // руны загораются по кругу от замка: доля горящих = power
      const lit = runeMats.length * Math.min(1, power + pulseT);
      runeMats.forEach((m, i) => { const k = Math.max(0, Math.min(1, lit - i)); m.color.copy(runeOff).lerp(runeLit, k * (0.85 + 0.15 * Math.sin(t * 4 + i))); });
      key.rotation.y += dt * (0.8 + pw * 2); key.position.y = center + R + W + 0.45 + Math.sin(t * 1.8) * 0.08;
      crystalMat.emissiveIntensity = 0.5 + pw * 1.2;
      small.forEach((c, i) => { c.rotation.y -= dt * 1.2; c.position.y = (pillars[i].position.y + 1.25) + Math.sin(t * 2 + i * 2) * 0.06; });
      shards.forEach((s, i) => { s.a += dt * (0.5 + pw * 1.6); const r = R + W + 0.25 + Math.sin(t * 1.3 + i) * 0.06; s.m.position.set(Math.cos(s.a) * r, Math.sin(s.a) * r, 0.1 + Math.sin(t * 2 + i) * 0.1); s.m.rotation.set(t * 2 + i, t * 3, 0); });
      // искры: по спирали от кромки к центру, быстрее при большей силе
      for (let i = 0; i < SN; i++) {
        const s = seeds[i]; s.r -= dt * s.s * (0.25 + pw * 0.7); s.a += dt * s.s * (1.4 + pw * 2.5) / Math.max(0.25, s.r);
        if (s.r < 0.05) { s.r = 1 + Math.random() * 0.35; s.a = Math.random() * 6.28; }
        const rr = s.r * R; sPos[i * 3] = Math.cos(s.a) * rr; sPos[i * 3 + 1] = Math.sin(s.a) * rr; sPos[i * 3 + 2] = 0.08 + s.z * s.r;
        sSize[i] = (0.6 + s.s) * (0.7 + pw * 0.6); sAlpha[i] = Math.min(1, s.r * 2) * (0.35 + pw * 0.65);
      }
      sGeo.attributes.position.needsUpdate = sGeo.attributes.size.needsUpdate = sGeo.attributes.alpha.needsUpdate = true;
      // волна: кольцо расходится от кромки
      if (pulseT > 0) { pulseT = Math.max(0, pulseT - dt * 1.4); const u = 1 - pulseT; shock.scale.setScalar(R * (1 + u * 1.8)); shockMat.opacity = pulseT * 0.9; }
      else shockMat.opacity = 0;
    },
    dispose() { geos.forEach(x => x.dispose()); mats.forEach(x => x.dispose()); runeMats.forEach(m => m.map?.dispose()); },
  };
}

/** Атлас из 4 рун (белые штрихи на прозрачном): красим цветом материала. */
function runeTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = 256; c.height = 80; const x = c.getContext('2d')!;
  x.strokeStyle = '#fff'; x.lineWidth = 7; x.lineCap = 'round'; x.lineJoin = 'round';
  const glyphs: number[][][] = [
    [[32, 12, 32, 68], [16, 28, 32, 12, 48, 28], [18, 52, 46, 52]],
    [[20, 12, 44, 40, 20, 68], [44, 12, 44, 68]],
    [[32, 10, 52, 40, 32, 70, 12, 40, 32, 10], [32, 30, 32, 50]],
    [[14, 16, 50, 16], [32, 16, 32, 68], [14, 68, 50, 68], [18, 42, 46, 42]],
  ];
  glyphs.forEach((gl, k) => gl.forEach(line => { x.beginPath(); for (let i = 0; i < line.length; i += 2) (i ? x.lineTo : x.moveTo).call(x, k * 64 + line[i], line[i + 1]); x.stroke(); }));
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

let glowTex: THREE.Texture | null = null;
/** Мягкое круглое пятно света (для сияния). */
export function glowTexture(): THREE.Texture {
  if (glowTex) return glowTex;
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d')!;
  const gr = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,.55)'); gr.addColorStop(0.6, 'rgba(255,255,255,.12)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = gr; x.fillRect(0, 0, 128, 128);
  glowTex = new THREE.CanvasTexture(c); return glowTex;
}
