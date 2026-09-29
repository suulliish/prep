// Просмотр готовых моделей и анимаций (только для разработки): viewer.html?hero=Knight&clip=Idle_A&t=0.4&mon=Blob_PinkBlob&cam=side
// ?grid=clips — каждый клип героя отдельным кадром (проверка, что всё играет и не «летает»).
import * as THREE from 'three';
import { createHero, createMonster, dress, type HeroKind } from '../three/actor';
import { Kit, bottomY } from '../three/assets';

const q = new URLSearchParams(location.search);
const renderer = new THREE.WebGLRenderer({ antialias: true }); renderer.setSize(innerWidth, innerHeight); renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true; document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x8fb8ff);
scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x5a6a4a, 1.6));
const sun = new THREE.DirectionalLight(0xfff6ea, 2.2); sun.position.set(-6, 12, 8); sun.castShadow = true; sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.03; sun.shadow.mapSize.set(2048, 2048); scene.add(sun);
const floor = new THREE.Mesh(new THREE.CircleGeometry(30, 48), new THREE.MeshToonMaterial({ color: 0x7ec850 })); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
const cam = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, 0.1, 200); scene.add(cam);
const info = document.getElementById('t')!;

(async () => {
  const actors: { a: import('../three/actor').Actor; label: string }[] = [];
  if (q.get('kit')) {
    // предметы набора по именам: ?kit=ship&names=chest,barrel&clip=open&t=0.5
    const kit = await Kit.load(q.get('kit')!); const names = (q.get('names') || '').split(',').filter(Boolean);
    const { Actor } = await import('../three/actor');
    names.forEach(async (n, i) => {
      const o = kit.get(n, { height: +(q.get('h') || 1.5), ground: true }); const g = new THREE.Group(); g.position.x = (i - names.length / 2) * 2.4; scene.add(g);
      if (q.get('clip')) { const a = new Actor(o, kit.clips); g.add(a.g); a.play(q.get('clip')!, { hold: true }); a.mixer.update(a.duration(q.get('clip')!) * +(q.get('t') || 0.5)); } else g.add(o);
      renderer.render(scene, cam);
    });
    cam.position.set(0, 3, 8); cam.lookAt(0, 0.8, 0);
  } else if (q.get('frames')) {
    // кадры одного клипа по времени: t = 0, 1/8 ... 7/8 — чтобы найти момент удара
    const clip = q.get('frames')!;
    for (let i = 0; i < 8; i++) {
      const h = await createHero((q.get('hero') as HeroKind) || 'Knight'); await dress(h, { weapon: q.get('weapon') || 'sword_1handed', offhand: q.get('shield') ?? 'shield_round_color' });
      h.g.position.set((i % 4 - 1.5) * 3.2, 0, Math.floor(i / 4) * 3.4); h.g.rotation.y = 0.9; scene.add(h.g);
      h.play(clip, { hold: true, loop: false }); h.mixer.update(h.duration(clip) * (i / 8) + 0.001); actors.push({ a: h, label: clip });
    }
    info.textContent = clip + ' ' + actors[0].a.duration(clip).toFixed(2) + 'с; кадры 0/8..7/8, ряд 1: 0-3/8, ряд 2: 4-7/8';
    cam.position.set(0, 9, 13); cam.lookAt(0, 0.8, 1.5);
  } else if (q.get('grid') === 'clips') {
    const clipsOf = (await (await import('../three/actor')).heroAnimations()).map(c => c.name).filter((n, i, arr) => arr.indexOf(n) === i && n !== 'T-Pose');
    const cols = 8;
    for (let i = 0; i < clipsOf.length; i++) {
      const h = await createHero((q.get('hero') as HeroKind) || 'Knight'); await dress(h, { weapon: 'sword_1handed', offhand: 'shield_round_color' });
      h.g.position.set((i % cols - cols / 2) * 2.6, 0, Math.floor(i / cols) * 3); scene.add(h.g);
      h.mixer.setTime(0); h.play(clipsOf[i], { hold: true, loop: false }); h.mixer.update(Math.min(h.duration(clipsOf[i]) * 0.45, 2)); actors.push({ a: h, label: clipsOf[i] });
    }
    cam.position.set(0, 16, 20); cam.lookAt(0, 0, 4);
  } else {
    const h = await createHero((q.get('hero') as HeroKind) || 'Knight');
    await dress(h, { weapon: q.get('weapon') || 'sword_1handed', offhand: q.get('shield') ?? 'shield_round_color' }); scene.add(h.g); h.g.position.x = -1.5; h.g.rotation.y = 0.5;
    const clip = q.get('clip') || 'Idle_A'; const tt = +(q.get('t') || 0.4);
    if (q.get('clip')) { h.play(clip, { hold: true, loop: false }); h.mixer.update(h.duration(clip) * tt); }
    actors.push({ a: h, label: `${clip} ${tt} (${h.duration(clip).toFixed(2)}с) низ=${bottomY(h.g).toFixed(3)}` });
    if (q.get('mon')) { const m = await createMonster(q.get('mon')!, +(q.get('ms') || 1)); m.a.g.position.x = 1.8; m.a.g.rotation.y = -0.6; scene.add(m.a.g);
      const mc = q.get('mclip'); if (mc) { m.a.play(mc, { hold: true }); m.a.mixer.update(m.a.duration(mc) * +(q.get('mt') || 0.4)); }
      actors.push({ a: m.a, label: `${q.get('mon')} клипов? низ=${bottomY(m.a.g).toFixed(3)}` }); }
    if (q.get('cam') === 'side') { cam.position.set(0, 1.2, 9); cam.lookAt(0, 1.2, 0); } else { cam.position.set(0, 2.6, 7); cam.lookAt(0, 1.2, 0); }
  }
  if (!q.get('frames')) info.textContent = actors.map(a => a.label).slice(0, 3).join('\n') + (actors.length > 3 ? `\n… всего ${actors.length}` : '');
  renderer.render(scene, cam); (window as any).__ready = true;
})().catch(e => { info.textContent = 'Ошибка: ' + e; console.error(e); });
