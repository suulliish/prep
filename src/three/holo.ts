// Голограмма Бита («Тірі түсіндіру», docs/GAME_LOOP.md 17): во время объяснений Бит зависает над островом рядом с героем и лучом
// проецирует между героем и врагом то, о чём сейчас говорит кадр: выражение плитками («60 = [2] · 30», «4 030 [005]») или дробь
// настоящей геометрией (пицца режется на доли, полоска делится и закрашивается — holo_frac.ts). Содержимое выводится из данных
// урока (holo_spec.ts), поэтому новые уроки оживают сами. Панель — билборд перед камерой: на телефоне окно 3D низкое,
// и панель всегда остаётся в кадре между бойцами, а не уезжает за верхний край.
// Бюджет: один объект голограммы (панель + InstancedMesh на строку дроби + луч); Бит создаётся при первом показе.
// Слабое устройство (quality low): без светящихся спрайтов; reduceMotion (km < 1): без мерцания и «раскладывания».
import * as THREE from 'three';
import { createBit, type Bit, type BitMood } from './bit3d';
import { drawHoloText } from './holo_text';
import { createFrac, type FracHolo } from './holo_frac';
import { holoShape, type HoloSpec } from './holo_spec';
import type { Sfx } from '../lib/audio';

export interface HoloDeps { scene: THREE.Scene; camera: THREE.PerspectiveCamera; quality: 'high' | 'low'; km: number; sfx: (n: Sfx, rate?: number) => void }
export interface HoloEnv { screenH: number; hero?: THREE.Vector3 | null }

// Те же координаты, что в arena.ts (HERO_X, ENEMY_X, Z0): голограмма висит между героем и врагом
const HERO_X = -2.6, Z0 = 0.4;
// Где висит панель. «Полоса» (текст, полоски) — над головами бойцов: широкая и невысокая. «Колонна» (пицца) — в промежутке между
// героем и врагом от земли до верха кадра: узкая и высокая. maxW/maxH — сколько мировых единиц можно занять, не закрыв лица.
// Полоса прижата верхней кромкой к низу шапки экрана (мировая высота ≈ 3.95); если она уже 4.4 ед., до бойцов по бокам далеко и можно выше.
const BAND = { x: 0.0, top: 3.95, maxW: 5.6, maxH: 1.4, narrowW: 4.4, narrowH: 2.3 }, COLUMN = { x: -0.3, y: 2.15, maxW: 3.5, maxH: 3.3 };
const TEXT_CV = { w: 1024, h: 384 }, PX = 0.0037;   // мировых единиц на пиксель канваса текста

const VERT = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
const backdropMat = () => new THREE.ShaderMaterial({
  transparent: true, depthTest: false, depthWrite: false,
  uniforms: { size: { value: new THREE.Vector2(3, 1.4) }, time: { value: 0 }, alpha: { value: 1 }, tint: { value: new THREE.Color(0, 0, 0) }, tintK: { value: 0 } },
  vertexShader: VERT,
  fragmentShader: `uniform vec2 size; uniform float time, alpha, tintK; uniform vec3 tint; varying vec2 vUv;
    float sdBox(vec2 p, vec2 b, float r){ vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
    void main(){
      vec2 p = (vUv - 0.5) * size; float d = sdBox(p, size * 0.5, 0.2);
      if (d > 0.01) discard;
      float scan = 0.5 + 0.5 * sin(vUv.y * size.y * 52.0 - time * 2.5);
      float edge = smoothstep(0.1, 0.0, -d), rim = smoothstep(0.035, 0.0, -d);
      vec3 c = vec3(0.03, 0.07, 0.17) + vec3(0.02, 0.07, 0.10) * scan * 0.6 + vec3(0.05, 0.42, 0.55) * edge * (0.65 + 0.35 * scan) + vec3(0.5, 0.95, 1.0) * rim * 0.9;
      c = mix(c, tint, tintK * (0.25 + edge * 0.75));
      c = pow(c, vec3(2.2));   // цвета выше заданы как sRGB; выход — линейный
      gl_FragColor = vec4(c, (0.7 + edge * 0.25) * alpha);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
});
const textMat = (tex: THREE.Texture) => new THREE.ShaderMaterial({
  transparent: true, depthTest: false, depthWrite: false,
  uniforms: { map: { value: tex }, crop: { value: new THREE.Vector4(0, 0, 1, 1) }, time: { value: 0 }, alpha: { value: 1 }, glitch: { value: 0 } },
  vertexShader: VERT,
  fragmentShader: `uniform sampler2D map; uniform vec4 crop; uniform float time, alpha, glitch; varying vec2 vUv;
    void main(){
      vec2 uv = crop.xy + vUv * crop.zw;
      float band = step(0.72, fract(vUv.y * 6.0 + time * 2.1)) * glitch;
      uv.x += band * 0.02 * sin(time * 47.0);
      vec4 c = texture2D(map, uv);
      float scan = 0.9 + 0.1 * sin(vUv.y * 190.0 - time * 5.0);
      float fl = 1.0 - 0.07 * step(0.985, fract(sin(floor(time * 14.0) * 12.9898) * 43758.5453));
      gl_FragColor = vec4(c.rgb * scan * fl * (1.0 + glitch * 0.6), c.a * alpha);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
});
const beamMat = () => new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthTest: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });   // depthTest: герой перекрывает луч, если стоит перед ним
const easeOut = (u: number) => 1 - Math.pow(1 - u, 3);
const easeBack = (u: number) => 1 + 2.2 * Math.pow(u - 1, 3) + 1.2 * Math.pow(u - 1, 2);

export function createHolo(d: HoloDeps) {
  const high = d.quality === 'high', km = d.km;
  const root = new THREE.Group(); root.visible = false; root.renderOrder = 6; d.scene.add(root);
  const panelGeo = new THREE.PlaneGeometry(1, 1);
  const back = new THREE.Mesh(panelGeo, backdropMat()); back.renderOrder = 6; back.frustumCulled = false; root.add(back);
  const cv = document.createElement('canvas'); cv.width = TEXT_CV.w; cv.height = TEXT_CV.h;
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const text = new THREE.Mesh(panelGeo, textMat(tex)); text.renderOrder = 8; text.frustumCulled = false; text.position.z = 0.05; root.add(text);
  const backU = (back.material as THREE.ShaderMaterial).uniforms, textU = (text.material as THREE.ShaderMaterial).uniforms;
  // материал долей — общий на все InstancedMesh; подписи-дроби — аддитивные, поверх
  const fillMat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.92, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false, toneMapped: false });
  const labelMat = (t: THREE.Texture) => new THREE.MeshBasicMaterial({ map: t, transparent: true, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false, toneMapped: false });

  let frac: FracHolo | null = null;
  let bit: Bit | null = null, bitMood: BitMood = 'wow';
  // луч проектора: конус от Бита к нижней кромке панели; яркость по вершинам (у Бита ярче) — аддитивное смешение даёт «свет»
  const beamGeo = new THREE.ConeGeometry(1, 1, 18, 1, true);
  { const p = beamGeo.attributes.position, c = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) { const k = p.getY(i) + 0.5; c[i * 3] = 0.05 + 0.10 * k; c[i * 3 + 1] = 0.22 + 0.42 * k; c[i * 3 + 2] = 0.28 + 0.5 * k; }
    beamGeo.setAttribute('color', new THREE.BufferAttribute(c, 3)); }
  const beam = new THREE.Mesh(beamGeo, beamMat()); beam.visible = false; beam.renderOrder = 5; beam.frustumCulled = false; d.scene.add(beam);
  // свечение линзы Бита (только high: спрайт с градиентом)
  let lens: THREE.Sprite | null = null;
  if (high) {
    const c2 = document.createElement('canvas'); c2.width = c2.height = 64; const x = c2.getContext('2d')!;
    const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(180,255,255,1)'); g.addColorStop(0.35, 'rgba(63,240,255,0.5)'); g.addColorStop(1, 'rgba(63,240,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    lens = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c2), transparent: true, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false, toneMapped: false }));
    lens.visible = false; lens.renderOrder = 12; d.scene.add(lens);
  }

  // ---- состояние ----
  let key = '', shape = '', vis = false, a = 0, holdLeft = 0, glitch = 0, tintK = 0, sinceSfx = 9;
  const size = new THREE.Vector2(3, 1.4), sizeT = new THREE.Vector2(3, 1.4);
  const timers: { t: number; fn: () => void }[] = [];
  const later = (s: number, fn: () => void) => timers.push({ t: s, fn });
  const sfx = (n: Sfx, rate = 1, force = false) => { if (!force && sinceSfx < 0.22) return; sinceSfx = 0; d.sfx(n, rate); };
  const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3(), tmp3 = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), heroDef = new THREE.Vector3(HERO_X, 0, Z0);
  let S = 1; const anchor = new THREE.Vector3(0, 3.1, Z0 + 0.6);

  function drawText(spec: Extract<HoloSpec, { kind: 'text' }>) {
    const r = drawHoloText(cv, spec.text, spec.fill ?? null, spec.icon);
    tex.needsUpdate = true;
    const w = Math.min(TEXT_CV.w, r.w + 60), h = Math.min(TEXT_CV.h, Math.max(r.h + 40, 150));
    (textU.crop.value as THREE.Vector4).set((1 - w / TEXT_CV.w) / 2, (1 - h / TEXT_CV.h) / 2, w / TEXT_CV.w, h / TEXT_CV.h);
    text.scale.set(w * PX, h * PX, 1);
    sizeT.set(w * PX + 0.4, h * PX + 0.3);
  }

  function show(spec: HoloSpec | null) {
    if (!spec) { hide(); return; }
    const k = JSON.stringify(spec);
    if (vis && k === key) return;
    const sh = holoShape(spec), fresh = !vis || a < 0.08;
    key = k; holdLeft = spec.hold ?? 0; timers.length = 0;
    if (!bit) { bit = createBit(d.scene); bit.g.scale.setScalar(0.95); bit.g.position.set(HERO_X - 2.5, 6, Z0 + 1); }
    if (fresh) { sfx('energy', 1.1, true); if (bit) { bit.g.position.set(HERO_X - 2.2, 5.2, Z0 + 1); bit.setMood('wow'); bitMood = 'wow'; } }
    root.visible = true; beam.visible = true; if (lens) lens.visible = true; if (bit) bit.g.visible = true;
    if (spec.kind === 'text') {
      text.visible = true; if (frac) frac.group.visible = false;
      drawText(spec);
      if (!fresh) { glitch = 1; sfx('crystal', 1.25); }
    } else {
      text.visible = false;
      if (shape !== sh && frac) { root.remove(frac.group); frac.dispose(); frac = null; }
      if (!frac) { frac = createFrac(fillMat, labelMat, high, km); frac.group.position.z = 0.1; frac.group.renderOrder = 6; root.add(frac.group); }   // renderOrder группы = порядок её потомков: без него доли рисуются раньше подложки
      frac.group.visible = true;
      const ev = frac.set(spec, km === 1);
      sizeT.set(frac.size.w + 0.3, frac.size.h + 0.3);
      if (ev.cut) { sfx('slash', 1.15, true); later(0.16, () => sfx('slash', 1.5, true)); }
      if (ev.shade) later(ev.cut ? 0.7 : 0.25, () => sfx('crystal', 1.05, true));
      else if (ev.label && !ev.cut) sfx('crystal', 1.4);
      if (!fresh && ev.rebuilt) glitch = 0.6;
    }
    shape = sh; vis = true;
    if (fresh) { size.copy(sizeT); a = km === 1 ? 0 : 1; }
  }
  function hide() {
    if (!vis) return;
    vis = false; key = ''; timers.length = 0;
    if (bit) bit.setMood('idle');
  }
  /** Ответ ребёнка: верно — голограмма вспыхивает зелёным, ошибка — красный «сбой». */
  function pulse(kind: 'correct' | 'wrong') {
    if (!vis) return;
    (backU.tint.value as THREE.Color).setHex(kind === 'correct' ? 0x5ce39c : 0xff4fb8); tintK = 1;
    if (kind === 'wrong') glitch = 1;
    if (bit) { bitMood = kind === 'correct' ? 'happy' : 'sad'; bit.setMood(bitMood); }
  }
  /** Мгновенно убрать всё (выход из урока, смена режима камеры): без угасания, освободив геометрию. */
  function reset() { vis = false; key = ''; a = 0; timers.length = 0; glitch = tintK = 0; finish(); }
  function mood(m: BitMood) { if (bit && vis) { bitMood = m; bit.setMood(m); } }

  function finish() {
    root.visible = false; beam.visible = false; if (lens) lens.visible = false; if (bit) bit.g.visible = false;
    if (frac) { root.remove(frac.group); frac.dispose(); frac = null; shape = ''; }
  }

  function update(dt: number, t: number, env: HoloEnv) {
    if (!root.visible) return;
    sinceSfx += dt;
    for (let i = timers.length - 1; i >= 0; i--) { timers[i].t -= dt; if (timers[i].t <= 0) { const f = timers.splice(i, 1)[0]; f.fn(); } }
    if (vis && holdLeft > 0) { holdLeft -= dt; if (holdLeft <= 0) hide(); }
    a = vis ? Math.min(1, a + dt / (km === 1 ? 0.55 : 0.12)) : Math.max(0, a - dt / (km === 1 ? 0.28 : 0.1));
    if (!vis && a <= 0) { finish(); return; }
    glitch = Math.max(0, glitch - dt * 2.6); tintK = Math.max(0, tintK - dt * 1.7);

    // масштаб: на телефоне пикселей на единицу мира мало — панель крупнее (но не так, чтобы закрыть бойцов)
    const cam = d.camera, column = shape === 'frac:r';
    size.lerp(sizeT, 1 - Math.exp(-dt * 9));
    const dist = cam.position.distanceTo(root.position);
    const ppu = env.screenH / (2 * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)) * dist);
    const want = Math.min(1.75, Math.max(1, 44 / ppu));
    S = column ? Math.min(want, COLUMN.maxW / size.x, COLUMN.maxH / size.y)
      : Math.min(want, Math.max(Math.min(BAND.maxW / size.x, BAND.maxH / size.y), Math.min(BAND.narrowW / size.x, BAND.narrowH / size.y)));
    const ty = column ? COLUMN.y : BAND.top - (size.y * S) / 2, tx = column ? COLUMN.x : BAND.x;
    if (a < 0.02) anchor.set(tx, ty, Z0 + 0.6); else anchor.lerp(tmp.set(tx, ty, Z0 + 0.6), 1 - Math.exp(-dt * 8));
    root.position.copy(anchor);
    root.quaternion.copy(cam.quaternion);
    const au = easeOut(Math.min(1, a / 0.45)), av = a < 0.3 ? 0.06 : easeBack(Math.min(1, (a - 0.3) / 0.7));
    const idle = km === 1 ? Math.sin(t * 1.7) * 0.03 : 0;
    root.scale.set(S * Math.max(0.01, au), S * Math.max(0.01, av), S);
    root.position.y += idle;
    back.scale.set(size.x, size.y, 1); (backU.size.value as THREE.Vector2).copy(size);
    const alpha = Math.min(1, a * 2.5) * (vis ? 1 : a);
    backU.time.value = textU.time.value = t; backU.alpha.value = textU.alpha.value = alpha; textU.glitch.value = glitch; backU.tintK.value = tintK;
    fillMat.opacity = 0.92 * alpha;
    frac?.update(dt, t);

    // Бит парит над плечом героя и светит лучом на нижнюю кромку панели
    const hero = env.hero ?? heroDef;
    if (bit) {
      bit.update(dt, t, tmp.set(hero.x - 0.1, hero.y + 0.35, hero.z + 0.2), Math.PI / 2, cam.position);   // Бит слева-сверху от героя: не закрывает ни панель, ни лица
      const bp = bit.g.position;
      tmp2.set(0, -size.y / 2 * S * av * 0.98, 0).applyQuaternion(root.quaternion).add(root.position);   // нижняя кромка панели
      tmp3.copy(bp).y -= 0.22;
      const len = tmp3.distanceTo(tmp2); tmp.copy(tmp3).sub(tmp2).normalize();
      beam.position.copy(tmp2).addScaledVector(tmp, len / 2); beam.quaternion.setFromUnitVectors(up, tmp);
      const br = Math.max(0.05, size.x * S * 0.13 * au); beam.scale.set(br, len, br);
      (beam.material as THREE.MeshBasicMaterial).opacity = alpha * (0.4 + (km === 1 ? Math.sin(t * 9) * 0.1 : 0));
      if (lens) { lens.position.copy(tmp3); lens.scale.setScalar(0.9 + (km === 1 ? Math.sin(t * 6) * 0.15 : 0)); (lens.material as THREE.SpriteMaterial).opacity = alpha; }
    }
  }

  function dispose() {
    finish(); d.scene.remove(root); d.scene.remove(beam); if (lens) { d.scene.remove(lens); (lens.material as THREE.SpriteMaterial).map?.dispose(); (lens.material as THREE.Material).dispose(); }
    if (bit) d.scene.remove(bit.g);
    panelGeo.dispose(); beamGeo.dispose(); tex.dispose();
    (back.material as THREE.Material).dispose(); (text.material as THREE.Material).dispose(); (beam.material as THREE.Material).dispose(); fillMat.dispose();
  }
  return { show, hide, reset, pulse, mood, update, dispose, get active() { return vis; }, get level() { return a; } };   // level 0..1 — насколько видна панель
}
export type Holo = ReturnType<typeof createHolo>;
