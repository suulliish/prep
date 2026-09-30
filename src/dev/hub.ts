// Проверка корабля-базы без входа и экранов (только для разработки): hub.html?mode=hub|portal|hero|map&world=0&outfit=cyan&energy=0.5
// В консоли: __w.portalWalk(), __w.openPortal(), __w.setMode('portal'), __w.celebrate()
// Мастерская: &decor=all|id1,id2&pet=pet_fox (в консоли: __w.showDecor('cannon'), __w.setShipDecor([...], 'pet_cat'))
// Карта: hub.html?mode=map&cur=0&act=unveil — открытие мира cur+1
// Поломки корабля: &damage=0..6 (в консоли __w.setShipDamage(n); отдельная страница поломок — damage.html)
import { createWorld, type CamMode } from '../three/world';
// @ts-ignore — модуль .mjs без типов
import { WORLDS, OUTFITS } from '../../content/worlds.mjs';
// @ts-ignore — модуль .mjs без типов
import { SHIP_ITEMS } from '../../content/ship_items.mjs';

const q = new URLSearchParams(location.search);
const canvas = document.getElementById('c') as HTMLCanvasElement;
const w = createWorld(canvas, { quality: (q.get('q') as 'high' | 'low') || 'high' });
(window as any).__w = w;
const dmg = q.get('damage');
if (dmg !== null) w.setShipDamage(+dmg);
const W = WORLDS[+(q.get('world') || 0)];
w.setTheme(W.sky, W.fog);
const o = OUTFITS.find((x: any) => x.id === (q.get('outfit') || 'cyan')) ?? OUTFITS[0];
w.setOutfit(o.jacket, o.dark, o.visor, o.id);
w.setEnergy(+(q.get('energy') ?? 0.5), 1);
const cur = +(q.get('cur') || 0);
if (q.get('mode') === 'map') w.mapSetup(WORLDS.map((x: any, i: number) => ({ id: x.id, a: x.isle[0], b: x.isle[1], state: i < cur ? 'cleared' : i === cur ? 'current' : i === cur + 1 ? 'locked' : 'fog' })), cur);
const dq = q.get('decor'), pq = q.get('pet');
if (dq || pq) w.setShipDecor(dq === 'all' ? SHIP_ITEMS.filter((i: any) => i.slot !== 'pet').map((i: any) => i.id) : (dq || '').split(',').filter(Boolean), pq || null);
w.setMode((q.get('mode') as CamMode) || 'hub');
addEventListener('resize', () => w.resize());
const cam = q.get('cam'); if (cam) (w as any).devCam(...cam.split(',').map(Number));
if (q.get('act') === 'unveil') setTimeout(() => w.mapUnveil(cur + 1), +(q.get('wait') || 2500));
else if (q.get('act')) setTimeout(() => (w as any)[q.get('act')!](), +(q.get('wait') || 2500));
document.getElementById('t')!.textContent = `${W.ru} · ${q.get('mode') || 'hub'}`;
