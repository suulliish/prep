// Проверка корабля-базы без входа и экранов (только для разработки): hub.html?mode=hub|portal|hero|map&world=0&outfit=cyan&energy=0.5
// В консоли: __w.portalWalk(), __w.openPortal(), __w.setMode('portal'), __w.celebrate()
import { createWorld, type CamMode } from '../three/world';
// @ts-ignore — модуль .mjs без типов
import { WORLDS, OUTFITS } from '../../content/worlds.mjs';

const q = new URLSearchParams(location.search);
const canvas = document.getElementById('c') as HTMLCanvasElement;
const w = createWorld(canvas, { quality: (q.get('q') as 'high' | 'low') || 'high' });
(window as any).__w = w;
const W = WORLDS[+(q.get('world') || 0)];
w.setTheme(W.sky, W.fog);
const o = OUTFITS.find((x: any) => x.id === (q.get('outfit') || 'cyan')) ?? OUTFITS[0];
w.setOutfit(o.jacket, o.dark, o.visor, o.id);
w.setEnergy(+(q.get('energy') ?? 0.5), 1);
w.setMode((q.get('mode') as CamMode) || 'hub');
addEventListener('resize', () => w.resize());
const cam = q.get('cam'); if (cam) (w as any).devCam(...cam.split(',').map(Number));
if (q.get('act')) setTimeout(() => (w as any)[q.get('act')!](), +(q.get('wait') || 2500));
document.getElementById('t')!.textContent = `${W.ru} · ${q.get('mode') || 'hub'}`;
