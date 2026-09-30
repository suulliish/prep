// Готовые «живые» эффекты острова: листопад и конфетти, светлячки и пыльца, искры-блики, птицы, дождь, молния, северное сияние,
// блики света на дне, пикселы Глитча, извержение, пульс свечения. Всё крутится от тикера острова (ambient.ts), отдельных циклов нет.
// Материалы, геометрии и текстуры освобождает Ambient.dispose() при пересборке острова (обход группы), поэтому эффекты только кладут меши в g.
import * as THREE from 'three';
import { ambientOf, rng } from './ambient';

let dotTex: THREE.CanvasTexture | null = null;
/** Мягкое круглое пятно (общая текстура на всё приложение; освобождается только вместе со страницей). */
export function softDot(): THREE.CanvasTexture {
  if (dotTex) return dotTex;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d')!, gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.8)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
  dotTex = new THREE.CanvasTexture(c); dotTex.userData.keep = true; return dotTex;
}

/** Боевая полоса: сюда листья и пыль не роняем, чтобы не мешать бойцам. */
export const inBattle = (x: number, z: number) => Math.abs(x) < 5.6 && z > -1.6 && z < 3.6;
const smooth = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// ---------- листопад, лепестки, конфетти ----------
export interface LeafOpts { n: number; colors: number[]; seed?: number; size?: number; fall?: [number, number]; height?: number; wind?: number;
  tumble?: number; shape?: 'leaf' | 'confetti'; area?: [x0: number, x1: number, z0: number, z1: number]; dim?: number }
/** Падающие листья: наклонные плоские лепестки кувыркаются и сносятся ветром. Плотность подстраивается под качество. */
export function leaves(g: THREE.Group, o: LeafOpts): THREE.InstancedMesh {
  const amb = ambientOf(g), R = rng(o.seed ?? 3), H = o.height ?? 9, size = o.size ?? 0.28, area = o.area ?? [-13, 13, -12, 5], wind = o.wind ?? 0.35, fall = o.fall ?? [0.5, 0.95];
  const geo = new THREE.BufferGeometry();
  const P = o.shape === 'confetti' ? [-0.3, -0.5, 0, 0.3, -0.5, 0, 0.3, 0.5, 0, -0.3, -0.5, 0, 0.3, 0.5, 0, -0.3, 0.5, 0] : [0, 0.6, 0, 0.32, 0, 0, 0, -0.6, 0, 0, 0.6, 0, 0, -0.6, 0, -0.32, 0, 0];
  geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  const mesh = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }), o.n);
  mesh.frustumCulled = false; mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); mesh.renderOrder = 2;
  const c = new THREE.Color(), x = new Float32Array(o.n), y = new Float32Array(o.n), z = new Float32Array(o.n), vy = new Float32Array(o.n), ph = new Float32Array(o.n), sp = new Float32Array(o.n * 3), sc = new Float32Array(o.n);
  const spawn = (i: number, top: boolean) => {
    for (let k = 0; k < 4; k++) { x[i] = area[0] + R() * (area[1] - area[0]); z[i] = area[2] + R() * (area[3] - area[2]); if (!inBattle(x[i], z[i])) break; }
    y[i] = top ? H * (0.9 + R() * 0.1) : R() * H;
  };
  for (let i = 0; i < o.n; i++) {
    spawn(i, false); vy[i] = fall[0] + R() * (fall[1] - fall[0]); ph[i] = R() * 6.28; sc[i] = size * (0.7 + R() * 0.6);
    sp[i * 3] = (R() - 0.5) * 3; sp[i * 3 + 1] = (R() - 0.5) * 2.4; sp[i * 3 + 2] = (R() - 0.5) * 3;
    c.set(o.colors[i % o.colors.length]).multiplyScalar(o.dim ?? 1); mesh.setColorAt(i, c);
  }
  const d = new THREE.Object3D(), tumble = o.tumble ?? 1;
  amb.onDensity(k => { mesh.count = Math.max(1, Math.ceil(o.n * k)); });
  amb.add(cx => {
    const t = cx.t, dt = cx.dt * cx.km;
    for (let i = 0; i < mesh.count; i++) {
      y[i] -= vy[i] * dt;
      x[i] += (wind + Math.sin(t * 0.7 + ph[i]) * 0.5) * dt; z[i] += Math.cos(t * 0.5 + ph[i]) * 0.15 * dt;
      if (y[i] < 0 || x[i] > area[1] + 2) { spawn(i, true); if (x[i] > area[1]) x[i] = area[0]; }
      const s = sc[i] * smooth(0, 0.7, y[i]) * smooth(0, 1.2, H - y[i]);
      d.position.set(x[i], y[i], z[i]); d.rotation.set(t * sp[i * 3] * tumble + ph[i], t * sp[i * 3 + 1] * tumble, t * sp[i * 3 + 2] * tumble); d.scale.setScalar(s); d.updateMatrix();
      mesh.setMatrixAt(i, d.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });
  g.add(mesh); return mesh;
}

// ---------- точки света: светлячки, пыльца, блики ----------
function glowPoints(n: number, size: number, blend: THREE.Blending, opacity = 1) {
  const geo = new THREE.BufferGeometry(), pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ size, map: softDot(), vertexColors: true, transparent: true, opacity, depthWrite: false, blending: blend, fog: false }));
  pts.frustumCulled = false; pts.renderOrder = 3; return { pts, geo, pos, col };
}
export interface FlyOpts { n: number; area: [x0: number, x1: number, y0: number, y1: number, z0: number, z1: number]; colors: number[]; size?: number; seed?: number; wander?: number; pulse?: number; speed?: number; opacity?: number }
/** Светлячки/пыльца: каждая точка блуждает вокруг своего места и мягко мигает (pulse 0 — светит ровно). */
export function fireflies(g: THREE.Group, o: FlyOpts): THREE.Points {
  const amb = ambientOf(g), R = rng(o.seed ?? 5), { pts, geo, pos, col } = glowPoints(o.n, o.size ?? 0.22, THREE.AdditiveBlending, o.opacity ?? 1);
  const hx = new Float32Array(o.n), hy = new Float32Array(o.n), hz = new Float32Array(o.n), ph = new Float32Array(o.n * 3), base = new Float32Array(o.n * 3), c = new THREE.Color();
  const wander = o.wander ?? 0.7, pulse = o.pulse ?? 1, speed = o.speed ?? 1;
  for (let i = 0; i < o.n; i++) {
    for (let k = 0; k < 4; k++) { hx[i] = o.area[0] + R() * (o.area[1] - o.area[0]); hz[i] = o.area[4] + R() * (o.area[5] - o.area[4]); if (!inBattle(hx[i], hz[i]) || hz[i] < -2) break; }
    hy[i] = o.area[2] + R() * (o.area[3] - o.area[2]); ph[i * 3] = R() * 6.28; ph[i * 3 + 1] = R() * 6.28; ph[i * 3 + 2] = R() * 6.28;
    c.set(o.colors[i % o.colors.length]); base.set([c.r, c.g, c.b], i * 3);
  }
  amb.onDensity(k => geo.setDrawRange(0, Math.max(1, Math.ceil(o.n * k))));
  amb.add(cx => {
    const t = cx.t * speed * cx.km + 20;
    for (let i = 0; i < o.n; i++) {
      pos[i * 3] = hx[i] + Math.sin(t * 0.55 + ph[i * 3]) * wander; pos[i * 3 + 1] = hy[i] + Math.sin(t * 0.8 + ph[i * 3 + 1]) * wander * 0.5; pos[i * 3 + 2] = hz[i] + Math.cos(t * 0.45 + ph[i * 3 + 2]) * wander;
      const b = pulse ? Math.pow(0.5 + 0.5 * Math.sin(cx.t * (1.2 + (ph[i * 3] % 1.3)) + ph[i * 3 + 1]), 2) * pulse + (1 - pulse) : 1;
      col[i * 3] = base[i * 3] * b; col[i * 3 + 1] = base[i * 3 + 1] * b; col[i * 3 + 2] = base[i * 3 + 2] * b;
    }
    geo.attributes.position.needsUpdate = true; geo.attributes.color.needsUpdate = true;
  });
  g.add(pts); return pts;
}
/** Неподвижные искорки в заданных местах: вспыхивают по очереди (блики на воде, льду, арене). */
export function sparkles(g: THREE.Group, spots: [number, number, number][], o: { colors: number[]; size?: number; rate?: number; seed?: number; opacity?: number }): THREE.Points {
  const amb = ambientOf(g), R = rng(o.seed ?? 9), n = spots.length, { pts, geo, pos, col } = glowPoints(n, o.size ?? 0.3, THREE.AdditiveBlending, o.opacity ?? 1);
  const ph = new Float32Array(n), fr = new Float32Array(n), base = new Float32Array(n * 3), c = new THREE.Color(), rate = o.rate ?? 1;
  spots.forEach(([x, y, z], i) => { pos.set([x, y, z], i * 3); ph[i] = R() * 6.28; fr[i] = 0.6 + R() * 1.2; c.set(o.colors[i % o.colors.length]); base.set([c.r, c.g, c.b], i * 3); });
  amb.onDensity(k => geo.setDrawRange(0, Math.max(1, Math.ceil(n * k))));
  amb.add(cx => {
    for (let i = 0; i < n; i++) { const b = Math.pow(Math.max(0, Math.sin(cx.t * fr[i] * rate + ph[i])), 6) * (cx.km < 1 ? 0.5 : 1); col[i * 3] = base[i * 3] * b; col[i * 3 + 1] = base[i * 3 + 1] * b; col[i * 3 + 2] = base[i * 3 + 2] * b; }
    geo.attributes.color.needsUpdate = true;
  });
  g.add(pts); return pts;
}

// ---------- птицы ----------
export interface BirdOpts { n: number; color: number; seed?: number; center?: [x: number, y: number, z: number]; rx?: number; rz?: number; span?: number; speed?: number }
/** Несколько низкополигонных птиц кружат далеко за островом и машут крыльями. При «уменьшить движение» их нет. */
export function birds(g: THREE.Group, o: BirdOpts): THREE.Group | null {
  const amb = ambientOf(g); if (amb.ctx.km < 1) return null;
  const R = rng(o.seed ?? 4), [cx, cy, cz] = o.center ?? [0, 7.5, -32], rx = o.rx ?? 22, rz = o.rz ?? 7, span = o.span ?? 1.9;
  const mat = new THREE.MeshBasicMaterial({ color: o.color, side: THREE.DoubleSide, fog: false });
  // крыло: вытянутый треугольник от корпуса наружу и чуть назад; тело — веретено вдоль +Z
  const wing = new THREE.BufferGeometry(); wing.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0.32, 0, 0, -0.3, 1, 0, -0.18, 0, 0, 0.32, 1, 0, -0.18, 0.72, 0, 0.12], 3));
  const body = new THREE.ConeGeometry(0.13, 0.85, 5); body.rotateX(Math.PI / 2); body.translate(0, 0, 0.05);
  const flock = new THREE.Group(); flock.name = 'birds';
  const list = Array.from({ length: o.n }, (_, i) => {
    const b = new THREE.Group(), inner = new THREE.Group(), wl = new THREE.Mesh(wing, mat), wr = new THREE.Mesh(wing, mat);
    wr.scale.x = -1; inner.add(new THREE.Mesh(body, mat), wl, wr); b.add(inner); b.scale.setScalar(span); flock.add(b);
    return { b, inner, wl, wr, ph: R() * 6.28 + i * 2.1, rk: 0.8 + R() * 0.4, dy: (R() - 0.5) * 2.4, dir: i % 3 === 2 ? -1 : 1, fl: 5.5 + R() * 2 };
  });
  amb.onDensity(k => list.forEach((l, i) => { l.b.visible = i < Math.max(1, Math.ceil(o.n * k)); }));
  const speed = o.speed ?? 0.09;
  amb.add(c => {
    for (const l of list) {
      const a = l.ph + c.t * speed * l.dir, x = cx + Math.cos(a) * rx * l.rk, z = cz + Math.sin(a) * rz * l.rk;
      const vx = -Math.sin(a) * rx * l.rk * l.dir, vz = Math.cos(a) * rz * l.rk * l.dir;
      l.b.position.set(x, cy + l.dy + Math.sin(c.t * 0.5 + l.ph) * 0.6, z);
      l.b.rotation.y = Math.atan2(vx, vz);
      const glide = smooth(-0.3, 0.3, Math.sin(c.t * 0.27 + l.ph * 3)), f = Math.sin(c.t * l.fl + l.ph) * (0.25 + 0.55 * glide);
      l.wl.rotation.z = f; l.wr.rotation.z = -f; l.inner.rotation.z = -0.18 * l.dir;   // крен на вираже
    }
  });
  g.add(flock); return flock;
}

// ---------- дождь ----------
/** Тонкие косые полоски дождя: падают быстро, слегка прозрачные. */
export function rain(g: THREE.Group, o: { n?: number; color?: number; opacity?: number; seed?: number; height?: number } = {}): THREE.InstancedMesh {
  const amb = ambientOf(g), n = o.n ?? 220, H = o.height ?? 11, R = rng(o.seed ?? 8);
  const mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.03, 0.85), new THREE.MeshBasicMaterial({ color: o.color ?? 0xbcd2ff, transparent: true, opacity: o.opacity ?? 0.32, depthWrite: false, fog: false }), n);
  mesh.frustumCulled = false; mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); mesh.renderOrder = 4;
  const x = new Float32Array(n), y = new Float32Array(n), z = new Float32Array(n), v = new Float32Array(n), a = mesh.instanceMatrix.array as Float32Array;
  const sl = 0.16, cs = Math.cos(sl), sn = Math.sin(sl);
  for (let i = 0; i < n; i++) { x[i] = -17 + R() * 34; z[i] = -13 + R() * 21; y[i] = R() * H; v[i] = 13 + R() * 6; }
  amb.onDensity(k => { mesh.count = Math.max(1, Math.ceil(n * k)); });
  amb.add(c => {
    const dt = c.dt * Math.max(c.km, 0.5);
    for (let i = 0; i < mesh.count; i++) {
      y[i] -= v[i] * dt; x[i] += sn * v[i] * dt * 0.7;
      if (y[i] < 0) { y[i] = H; x[i] = -17 + R() * 34; z[i] = -13 + R() * 21; }
      if (x[i] > 17) x[i] -= 34;
      const k = i * 16; a[k] = cs; a[k + 1] = sn; a[k + 2] = 0; a[k + 3] = 0; a[k + 4] = -sn; a[k + 5] = cs; a[k + 6] = 0; a[k + 7] = 0; a[k + 8] = 0; a[k + 9] = 0; a[k + 10] = 1; a[k + 11] = 0; a[k + 12] = x[i]; a[k + 13] = y[i]; a[k + 14] = z[i]; a[k + 15] = 1;
    }
    mesh.instanceMatrix.needsUpdate = true;
  });
  g.add(mesh); return mesh;
}

// ---------- молния ----------
/** Редкая вспышка грозы: небо коротко белеет, свет сцены вспыхивает и затухает (две вспышки подряд). При «уменьшить движение» вспышек нет. */
export function lightning(g: THREE.Group, o: { every?: [number, number]; color?: number; seed?: number } = {}) {
  const amb = ambientOf(g); if (amb.ctx.km < 1) return;
  const R = rng(o.seed ?? 6), every = o.every ?? [5, 10];
  const sky = new THREE.Mesh(new THREE.SphereGeometry(140, 24, 12), new THREE.MeshBasicMaterial({ color: o.color ?? 0xcfd8ff, side: THREE.BackSide, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  sky.frustumCulled = false; sky.renderOrder = -2; g.add(sky);
  let next = 2 + R() * 3, start = -1, hemi: THREE.HemisphereLight | null = null, base = 0;
  const PULSES: [number, number, number][] = [[0, 0.1, 1], [0.17, 0.42, 0.65]];   // начало, конец, сила
  const env = (s: number) => PULSES.reduce((m, [a, b, k]) => (s >= a && s < b ? Math.max(m, k * Math.sin(((s - a) / (b - a)) * Math.PI) ** 0.6) : m), 0);
  const restore = () => { if (hemi && base) hemi.intensity = base; base = 0; };
  amb.onDispose(restore);
  amb.add(c => {
    if (!hemi) hemi = (c.scene?.children.find(x => (x as THREE.HemisphereLight).isHemisphereLight) as THREE.HemisphereLight | undefined) ?? null;
    if (start < 0 && c.t >= next) { start = c.t; if (hemi) base = hemi.intensity; }
    if (start < 0) return;
    const e = env(c.t - start);
    (sky.material as THREE.MeshBasicMaterial).opacity = e * 0.38;
    if (hemi && base) hemi.intensity = base * (1 + e * 0.9);
    if (c.t - start > 0.5) { restore(); (sky.material as THREE.MeshBasicMaterial).opacity = 0; start = -1; next = c.t + every[0] + R() * (every[1] - every[0]); }
  });
}

// ---------- северное сияние ----------
const AURORA_VS = 'varying vec2 vUv; uniform float uT; void main(){ vUv = uv; vec3 p = position; p.y += sin(p.x * 0.09 + uT * 0.35) * 2.2 + sin(p.x * 0.23 - uT * 0.5) * 0.8; gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }';
const AURORA_FS = `varying vec2 vUv; uniform float uT; uniform float uA;
  void main(){
    float w = vUv.x * 13.0 + sin(vUv.x * 4.0 + uT * 0.3) * 2.0;
    float band = 0.55 + 0.45 * sin(w + uT * 0.6);
    float rays = 0.6 + 0.4 * sin(vUv.x * 60.0 + sin(uT * 0.5 + vUv.x * 9.0) * 3.0);
    float fade = smoothstep(0.0, 0.12, vUv.y) * pow(1.0 - vUv.y, 1.4);
    vec3 c = mix(vec3(0.25, 1.0, 0.7), vec3(0.55, 0.45, 1.0), smoothstep(0.15, 0.95, vUv.y + 0.25 * sin(uT * 0.3 + vUv.x * 5.0)));
    float edge = smoothstep(0.0, 0.08, vUv.x) * smoothstep(1.0, 0.92, vUv.x);
    gl_FragColor = vec4(c * (0.6 + 0.4 * rays), band * fade * edge * uA);
  }`;
/** Северное сияние: широкая полупрозрачная волнистая лента высоко над дальним краем; переливается цветом и колышется. */
export function aurora(g: THREE.Group, o: { base?: number; z?: number; opacity?: number } = {}) {
  const amb = ambientOf(g), uT = { value: 0 };
  const geo = new THREE.PlaneGeometry(150, 28, 60, 1);
  const p = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) p.setZ(i, Math.pow(p.getX(i) / 75, 2) * 22);   // края ленты подтянуты к зрителю: дуга вокруг острова
  const mat = new THREE.ShaderMaterial({ vertexShader: AURORA_VS, fragmentShader: AURORA_FS, uniforms: { uT, uA: { value: o.opacity ?? 0.7 } }, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false });
  const m = new THREE.Mesh(geo, mat); m.position.set(0, (o.base ?? 1.5) + 14, o.z ?? -62); m.renderOrder = -1; m.frustumCulled = false; g.add(m);
  amb.add(c => { uT.value = c.t; });
}

// ---------- блики света на дне ----------
let causticCv: HTMLCanvasElement | null = null;
/** Бесшовная картинка бликов (каустика): светлая сеть на тёмном, считается один раз. */
function causticCanvas(): HTMLCanvasElement {
  if (causticCv) return causticCv;
  const S = 128, c = document.createElement('canvas'); c.width = c.height = S;
  const x = c.getContext('2d')!, img = x.createImageData(S, S), TAU = Math.PI * 2, inten = 0.005, time = 3.4;
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
    const px = ((i / S) * TAU) % TAU - 250, py = ((j / S) * TAU) % TAU - 250; let ix = px, iy = py, acc = 1;
    for (let n = 0; n < 5; n++) { const t = time * (1 - 3.5 / (n + 1)); ix = px + (Math.cos(t - ix) + Math.sin(t + iy)); iy = py + (Math.sin(t - iy) + Math.cos(t + ix)); acc += 1 / Math.hypot(px / (Math.sin(ix + t) / inten), py / (Math.cos(iy + t) / inten)); }
    acc /= 5; const v = Math.min(1, Math.pow(Math.abs(1.17 - Math.pow(acc, 1.4)), 8) * 1.2) * 255, k = (j * S + i) * 4;
    img.data[k] = img.data[k + 1] = img.data[k + 2] = v; img.data[k + 3] = 255;
  }
  x.putImageData(img, 0, 0); return (causticCv = c);
}
/** Два слоя бегущих бликов на земле (как свет сквозь рябь на мелководье). */
export function caustics(g: THREE.Group, o: { area?: [x0: number, x1: number, z0: number, z1: number]; color?: number; opacity?: number } = {}) {
  const amb = ambientOf(g), [x0, x1, z0, z1] = o.area ?? [-16, 16, -14, 9], layers = [{ v: [0.014, 0.008], rep: [3.2, 2.5], y: 0.045 }, { v: [-0.01, 0.013], rep: [2.2, 1.7], y: 0.05 }];
  const tex = layers.map(l => { const t = new THREE.CanvasTexture(causticCanvas()); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(l.rep[0], l.rep[1]); t.colorSpace = THREE.SRGBColorSpace; return t; });
  layers.forEach((l, i) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), new THREE.MeshBasicMaterial({ map: tex[i], color: o.color ?? 0xa8fff0, transparent: true, opacity: o.opacity ?? 0.5, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    m.rotation.x = -Math.PI / 2; m.position.set((x0 + x1) / 2, l.y, (z0 + z1) / 2); m.renderOrder = 1; g.add(m);
  });
  amb.add(c => { layers.forEach((l, i) => { tex[i].offset.set(c.t * l.v[0] * c.km, c.t * l.v[1] * c.km); }); });
}

// ---------- пикселы Глитча ----------
/** Мелкие квадратики-пикселы поднимаются и мигают (цифровой «дождь наоборот»). */
export function pixels(g: THREE.Group, o: { n: number; colors: number[]; seed?: number; height?: number; size?: number }) {
  const amb = ambientOf(g), R = rng(o.seed ?? 12), n = o.n, H = o.height ?? 9, size = o.size ?? 0.16;
  const mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.85, depthWrite: false, fog: false }), n);
  mesh.frustumCulled = false; mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); mesh.renderOrder = 2;
  const x = new Float32Array(n), y = new Float32Array(n), z = new Float32Array(n), v = new Float32Array(n), ph = new Float32Array(n), c = new THREE.Color();
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < 4; k++) { x[i] = -14 + R() * 28; z[i] = -13 + R() * 17; if (!inBattle(x[i], z[i])) break; }
    y[i] = R() * H; v[i] = 0.5 + R() * 1.3; ph[i] = R() * 100; c.set(o.colors[i % o.colors.length]); mesh.setColorAt(i, c);
  }
  const d = new THREE.Object3D();
  amb.onDensity(k => { mesh.count = Math.max(1, Math.ceil(n * k)); });
  amb.add(cx => {
    for (let i = 0; i < mesh.count; i++) {
      y[i] += v[i] * cx.dt * cx.km; if (y[i] > H) y[i] -= H;
      const k = Math.floor(cx.t * 7 + ph[i]), h = Math.sin(k * 12.9898 + ph[i]) * 43758.5453, r = h - Math.floor(h);
      d.position.set(x[i] + (r > 0.9 ? 0.25 : 0), y[i], z[i]); d.scale.setScalar(cx.km < 1 || r < 0.75 ? size * smooth(0, 1, y[i]) * smooth(0, 1.5, H - y[i]) : 0.0001); d.updateMatrix(); mesh.setMatrixAt(i, d.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });
  g.add(mesh);
}

// ---------- извержение ----------
/** Время от времени из одного из мест src вылетает россыпь искр дугой (кратер, лужи лавы); ореол кратера пульсирует и вспыхивает при выбросе. */
export function eruption(g: THREE.Group, o: { src: [number, number, number][]; every?: [number, number]; n?: number; colors: number[]; power?: number; seed?: number; glow?: THREE.Sprite; life?: [number, number]; spread?: number }) {
  const amb = ambientOf(g), R = rng(o.seed ?? 21), n = o.n ?? 36, { pts, geo, pos, col } = glowPoints(n, 0.34, THREE.AdditiveBlending), every = o.every ?? [6, 12], lf = o.life ?? [1.4, 2.8];
  const vel = new Float32Array(n * 3), life = new Float32Array(n), base = new Float32Array(n * 3), c = new THREE.Color(), power = o.power ?? 1;
  for (let i = 0; i < n; i++) { c.set(o.colors[i % o.colors.length]); base.set([c.r, c.g, c.b], i * 3); }
  const glowBase = o.glow ? o.glow.scale.clone() : null, glowOp = o.glow ? (o.glow.material as THREE.SpriteMaterial).opacity : 0;
  amb.onDensity(k => geo.setDrawRange(0, Math.max(1, Math.ceil(n * k))));
  let next = 3 + R() * 3, flare = 0;
  amb.add(cx => {
    if (cx.t >= next && cx.km >= 1) {
      next = cx.t + every[0] + R() * (every[1] - every[0]); flare = 1;
      const from = o.src[Math.floor(R() * o.src.length)];
      for (let i = 0; i < n; i++) {
        const a = R() * 6.28, s = (0.5 + R() * 0.9) * power;
        pos[i * 3] = from[0]; pos[i * 3 + 1] = from[1]; pos[i * 3 + 2] = from[2];
        vel[i * 3] = Math.cos(a) * s * (o.spread ?? 1.8); vel[i * 3 + 1] = (5 + R() * 4) * power; vel[i * 3 + 2] = Math.sin(a) * s * (o.spread ?? 1.8); life[i] = lf[0] + R() * (lf[1] - lf[0]);
      }
    }
    for (let i = 0; i < n; i++) {
      const l = life[i]; let b = 0;
      if (l > 0) { life[i] = l - cx.dt; vel[i * 3 + 1] -= 7 * cx.dt; for (let k = 0; k < 3; k++) pos[i * 3 + k] += vel[i * 3 + k] * cx.dt; b = Math.min(1, l / 0.8); }
      col[i * 3] = base[i * 3] * b; col[i * 3 + 1] = base[i * 3 + 1] * b; col[i * 3 + 2] = base[i * 3 + 2] * b;
    }
    geo.attributes.position.needsUpdate = true; geo.attributes.color.needsUpdate = true;
    if (o.glow && glowBase) {
      flare = Math.max(0, flare - cx.dt * 0.7); const k = 1 + 0.06 * Math.sin(cx.t * 2.1) * cx.km + flare * 0.35;
      o.glow.scale.set(glowBase.x * k, glowBase.y * k, 1); (o.glow.material as THREE.SpriteMaterial).opacity = Math.min(1, glowOp * (0.9 + 0.1 * Math.sin(cx.t * 3.3)) + flare * 0.15);
    }
  });
  g.add(pts);
}

// ---------- пульс свечения ----------
/** Материалы с emissive мягко пульсируют (кристаллы, грибы, шпили). amp гасится при «уменьшить движение». */
export function pulseEmissive(g: THREE.Group, mats: THREE.MeshToonMaterial[], o: { base: number; amp: number; speed?: number; seed?: number }) {
  if (!mats.length) return;
  const amb = ambientOf(g), sp = o.speed ?? 1.4;
  amb.add(c => { mats.forEach((m, i) => { m.emissiveIntensity = o.base + o.amp * c.km * Math.sin(c.t * sp + i * 1.7 + (o.seed ?? 0)); }); });
}
