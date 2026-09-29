// Проверка боя без входа и экранов (только для разработки): battle.html?world=0&spot=0&outfit=cyan&mob=0&boss=0
// В консоли: __w.heroAttack(), __w.heroAttack(true), __w.heroAttack(false,true), __w.enemyAttack(), __w.killMob(), __w.openChest()
import { createWorld } from '../three/world';
// @ts-ignore — модуль .mjs без типов
import { WORLDS, OUTFITS } from '../../content/worlds.mjs';

const q = new URLSearchParams(location.search);
const canvas = document.getElementById('c') as HTMLCanvasElement;
const w = createWorld(canvas, { quality: (q.get('q') as 'high' | 'low') || 'high' });
(window as any).__w = w;
const k = +(q.get('world') || 0), W = WORLDS[k];
w.setMode('battle'); w.setTheme(W.sky, W.fog); w.setArena(k, W.isle[0], W.isle[1]);
const o = OUTFITS.find((x: any) => x.id === (q.get('outfit') || 'cyan')) ?? OUTFITS[0];
w.setOutfit(o.jacket, o.dark, o.visor, o.id);
w.setSpot(q.get('spotSeed') || 'seed' + (q.get('spot') || 0));
addEventListener('resize', () => w.resize());
(async () => {
  document.getElementById('t')!.textContent = `${W.ru} · ${o.id}`;
  if (q.get('arrive') !== '0') await w.arrive();
  if (q.get('mob') !== 'none') await w.spawnMob(+(q.get('hp') || 3), +(q.get('mob') || 0), q.get('boss') === '1', q.get('boss') === '2');
  (window as any).__ready = true;
  const act = q.get('act'); if (act) { await new Promise(r => setTimeout(r, +(q.get('wait') || 600))); (w as any)[act.split(':')[0]]?.(...(act.split(':')[1] ? JSON.parse(act.split(':')[1]) : [])); }
})();
