// Мастерская корабля: каталог украшений (content/ship_items.mjs) и всё, на что он ссылается (модели, клипы питомцев, иконки).
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { SHIP_ITEMS, COINS } from '../content/ship_items.mjs';
import { CAPACITY, ITEMS as DECOR_ITEMS, planSpots, planCircles, type Surface } from '../src/three/decor3d';
import { CODE_MODELS, MAST_MODELS } from '../src/three/decor_models';

const M = path.resolve('public/models'), PUB = path.resolve('public');
type Item = { id: string; kz: string; ru: string; price: number; slot: string; model: { kit: string; name: string; h: number }; icon: string; r?: number; glow?: number; flat?: boolean };
const items = SHIP_ITEMS as Item[];
function glbJson(file: string) { const b = fs.readFileSync(path.join(M, file)); const len = b.readUInt32LE(12); return JSON.parse(b.subarray(20, 20 + len).toString('utf8')); }
const kitNodes = (id: string) => new Set<string>(glbJson(`kits/${id}.glb`).nodes.map((n: { name: string }) => n.name).filter((n: string) => n?.startsWith('K_')).map((n: string) => n.slice(2)));
const SLOTS = ['deck', 'bow', 'stern', 'mast', 'pet'];

describe('каталог мастерской корабля', () => {
  it('идентификаторы уникальны, поля на месте, места из списка', () => {
    expect(items.length).toBeGreaterThanOrEqual(18); expect(items.length).toBeLessThanOrEqual(24);
    expect(new Set(items.map(i => i.id)).size).toBe(items.length);
    for (const i of items) {
      expect(i.id, 'id').toMatch(/^[a-z][a-z0-9_]*$/);
      expect(i.kz.trim().length, `${i.id}: kz`).toBeGreaterThan(1); expect(i.ru.trim().length, `${i.id}: ru`).toBeGreaterThan(1);
      expect(SLOTS, `${i.id}: slot`).toContain(i.slot);
      expect(i.model.h, `${i.id}: h`).toBeGreaterThan(0.1); expect(i.model.h, `${i.id}: h`).toBeLessThan(3);
    }
    for (const s of SLOTS) expect(items.some(i => i.slot === s), `в слоте ${s} есть предметы`).toBe(true);
  });
  it('цены разумные: 20–250, питомцы 120–250, красота недорогая по сравнению с монетами за бой', () => {
    for (const i of items) { expect(Number.isInteger(i.price), i.id).toBe(true); expect(i.price, i.id).toBeGreaterThanOrEqual(20); expect(i.price, i.id).toBeLessThanOrEqual(250); if (i.slot === 'pet') expect(i.price, i.id).toBeGreaterThanOrEqual(120); }
    expect(Math.min(...items.map(i => i.price))).toBe(20); expect(Math.max(...items.map(i => i.price))).toBeLessThanOrEqual(250);
    // самый дешёвый предмет — несколько правильных ответов, самый дорогой — не больше нескольких боссов
    expect(20 / COINS.correct).toBeLessThanOrEqual(10); expect(250 / COINS.boss).toBeLessThanOrEqual(10);
  });
  it('на палубе хватает мест: предметов слота не больше, чем мест (порядок в каталоге = номер места)', () => {
    for (const s of ['deck', 'bow', 'stern'] as const) expect(items.filter(i => i.slot === s).length, s).toBeLessThanOrEqual(CAPACITY[s]);
    for (const i of items.filter(x => x.slot !== 'pet' && x.slot !== 'mast')) expect(i.r, `${i.id}: радиус основания (r)`).toBeGreaterThan(0.2);
  });
  it('модели предметов есть в собранных наборах (или собраны кодом, или это питомец с клипами)', () => {
    for (const i of items) {
      const { kit, name } = i.model;
      if (kit === 'code') { expect(CODE_MODELS[name], `${i.id}: сборка «${name}»`).toBeTruthy(); expect(MAST_MODELS.has(name) || i.slot !== 'mast', i.id).toBe(true); }
      else if (kit === 'pets') {
        expect(i.slot, i.id).toBe('pet'); const f = `pets/${name}.glb`; expect(fs.existsSync(path.join(M, f)), `${i.id}: ${f}`).toBe(true);
        const clips = new Set<string>((glbJson(f).animations ?? []).map((a: { name: string }) => a.name));
        for (const c of ['idle', 'walk', 'run', 'dance', 'gesture-positive']) expect(clips.has(c), `${i.id}: клип ${c}`).toBe(true);
      } else { expect(fs.existsSync(path.join(M, `kits/${kit}.glb`)), `набор ${kit}`).toBe(true); expect(kitNodes(kit).has(name), `${i.id}: «${name}» в наборе ${kit}`).toBe(true); expect(i.slot, i.id).not.toBe('pet'); }
    }
  });
  it('наборы и питомцы лёгкие: набор до 500 КБ, питомец до 150 КБ', () => {
    for (const kit of new Set(items.map(i => i.model.kit).filter(k => k !== 'code' && k !== 'pets'))) expect(fs.statSync(path.join(M, `kits/${kit}.glb`)).size, kit).toBeLessThanOrEqual(500 * 1024);
    for (const i of items.filter(x => x.model.kit === 'pets')) expect(fs.statSync(path.join(M, `pets/${i.model.name}.glb`)).size, i.id).toBeLessThanOrEqual(150 * 1024);
  });
  it('иконки: свои для каждого предмета, PNG 256×256 с прозрачностью, до 30 КБ', () => {
    for (const i of items) {
      expect(i.icon, i.id).toBe(`ui/ship/${i.id}.png`);
      const f = path.join(PUB, i.icon); expect(fs.existsSync(f), `${i.id}: ${i.icon}`).toBe(true);
      const b = fs.readFileSync(f); expect(b.length, `${i.id}: вес`).toBeLessThanOrEqual(30 * 1024);
      expect(b.subarray(1, 4).toString(), i.id).toBe('PNG');
      expect([b.readUInt32BE(16), b.readUInt32BE(20)], `${i.id}: размер`).toEqual([256, 256]);
      expect(b[25] === 3 ? b.includes('tRNS') : [4, 6].includes(b[25]), `${i.id}: прозрачный фон (палитра с tRNS или альфа)`).toBe(true);   // тип цвета PNG: 3 палитра, 4/6 с альфой
    }
  });
});

// ---------- места на палубе: настоящая карта корабля, все предметы куплены сразу ----------
// Карта настоящего корабля-хаба (снята с sampleSurface и deck.walkable в браузере: шаг 0.3 м, по строке на z, по символу на x; высоты с шагом 0.05 м).
const SHIP_MAP = {
  x0: -9.825, z0: -3.600, nx: 67, nz: 25, step: 0.3,
  legend: '-0.7 0.05 0.35 0.5 0.6 0.65 0.8 0.85 1 1.1 1.2 1.25 1.45 1.55 1.6 1.65 1.75 1.8 1.85 1.9 1.95 2 2.05 2.1 2.15 2.3 2.45 2.6 2.8 2.9 2.95 3.1 3.2 3.3 3.35',   // высота символа 0-9a-z по порядку
  H: [
    '...................................................................',
    '...wtttttttttttsqld9661111566666666668acfiiiii.....................',
    '.wwwtttttttttttsqld9661111566666666668acfiiiiii....................',
    '.wooooooooooee9944111111111111111111134999999iiii..................',
    'wwooooooooooee994411111111111111111113499999999iiii................',
    'ttooooooooooee9944111111111111111111134999999999iiii...............',
    'ttooooooooooee994411111111111111111113499999999999iiii.............',
    'ttooooooooooee9944111111111111111111134999999999999iiii............',
    'ttoooooooosttttt1111111111111111111111111f99999999999iiii..........',
    'ttooooooooooooott112222222211111111111111i9999999999999iii.........',
    'ttooooooooooooott112000000211111111111111i99999999999999iiii.......',
    'ttooovyuoooooowtt11200000021117b811111111i9999999999999999iihhhggg.',
    'ttoooyyyooooooxtt1120000002111bbk11111111i9999999999999rjlmnowtrpl.',
    'ttooovyuoooooowtt11200000021117b811111111i9999999999999999iihhhggg.',
    'ttooooooooooooott112000000211111111111111i99999999999999iiii.......',
    'ttooooooooooooott112222222211111111111111i9999999999999iii.........',
    'ttoooooooosttttt1111111111111111111111111f99999999999iiii..........',
    'ttooooooooooee9944111111111111111111134999999999999iiii............',
    'ttooooooooooee994411111111111111111113499999999999iiii.............',
    'ttooooooooooee9944111111111111111111134999999999iiii...............',
    'wwooooooooooee994411111111111111111113499999999iii.................',
    '.wwwtttttttttttsqld9661111566666666668acfiiiiiiii..................',
    '.wwwtttttttttttsqld9661111566666666668acfiiiiii....................',
    '.....................111111........................................',
    '...................................................................',
  ],
  W: [   // 1 — герой может встать (после кольца портала, до реквизита)
    '0000000000000000000000000000000000000000000000000000000000000000000',
    '0000000000000000000000000000000000000000000000000000000000000000000',
    '0000000000000000000000000000000000000000000000000000000000000000000',
    '0000000000000000000000001100000000000000000000000000000000000000000',
    '0000000000000000000000011100000000000000000000000000000000000000000',
    '0000111111111111111111111111111111111111111100000000000000000000000',
    '0000111110000000011111111111111111111100001111000000000000000000000',
    '0000111100000000001111111111111111111100000111000000000000000000000',
    '0000111100000000000000000001100000111100000011000000000000000000000',
    '0000000000000000000000000000000000011100000011000000000000000000000',
    '0000000000000000000000000000000000001110000011100000000000000000000',
    '0000000000000000000000000000000000001110000011100000000000000000000',
    '0000000000000000000000000000000000001110000011110000000000000000000',
    '0000000000000000000000000000000000001110000011110000000000000000000',
    '0000000000000000000000000000000000001110000011111000000000000000000',
    '0000000000000000000000000000000000011100000011111000000000000000000',
    '0000000000000000000000000001100000111100000011111000000000000000000',
    '0000000000000000001111111111111111111100000111100000000000000000000',
    '0000000000000000011111111111111111111100001111000000000000000000000',
    '0000000000000000000000011100000000000000000000000000000000000000000',
    '0000000000000000000000001100000000000000000000000000000000000000000',
    '0000000000000000000000001100000000000000000000000000000000000000000',
    '0000000000000000000000000000000000000000000000000000000000000000000',
    '0000000000000000000000000000000000000000000000000000000000000000000',
    '0000000000000000000000000000000000000000000000000000000000000000000',
  ],
  portal: [5.175, 0.000], stand: [4.275, 0.600],
  stations: {"bow": [1.275, -0.3], "stern": [-4.125, -1.5], "mid": [-1.425, -1.2], "port": [-2.625, -1.8], "star": [-0.225, 1.5]},
  home: [[3.4, 1.2], [3.4, 0.9], [3.7, 1.2], [3.4, 0.6], [3.1, 1.5], [3.4, 1.5], [3.7, 1.5], [3.4, 1.8], [1.3, -1.8], [1.3, -1.2], [1.3, -0.6], [1.3, 0], [1.3, 0.6], [1.3, 1.2], [1.3, 1.8], [3.1, 1.8], [3.7, 1.8], [4.3, 0.6]],
};
function shipSurface(): Surface {
  const { x0, z0, nx, nz, step } = SHIP_MAP, vals = SHIP_MAP.legend.split(' ').map(Number), H = new Float32Array(nx * nz).fill(NaN);
  SHIP_MAP.H.forEach((row, j) => [...row].forEach((c, i) => { if (c !== '.') H[i * nz + j] = vals['0123456789abcdefghijklmnopqrstuvwxyz'.indexOf(c)]; }));
  return { H, nx, nz, x0, z0, step, at: (x, z) => { const i = Math.round((x - x0) / step), j = Math.round((z - z0) / step); return i >= 0 && j >= 0 && i < nx && j < nz ? H[i * nz + j] : NaN; } };
}
const walkAt = (x: number, z: number) => { const { x0, z0, step } = SHIP_MAP; return SHIP_MAP.W[Math.round((z - z0) / step)]?.[Math.round((x - x0) / step)] === '1'; };
const AVOID: [number, number, number][] = [[SHIP_MAP.portal[0], SHIP_MAP.portal[1], 1.9], [SHIP_MAP.stand[0], SHIP_MAP.stand[1], 1.3]];
const KEEP: [number, number][] = [SHIP_MAP.stand as [number, number], ...(Object.values(SHIP_MAP.stations) as [number, number][])];
const SOFT = SHIP_MAP.home.map(h => [h[0], h[1], 0.75] as [number, number, number]);
const plan = () => planSpots(shipSurface(), AVOID, { walkable: walkAt }, KEEP, SOFT);
const placed = () => { const p = plan(), out: { id: string; r: number; x: number; y: number; z: number }[] = []; for (const slot of ['deck', 'bow', 'stern'] as const) p[slot].forEach((sp, k) => { const it = DECOR_ITEMS.filter(i => i.slot === slot)[k]; if (sp && it) out.push({ id: it.id, r: it.r ?? 0.6, x: sp.x, y: sp.y, z: sp.z }); }); return out; };

describe('украшения: места на настоящей палубе (все предметы куплены)', () => {
  const need = items.filter(i => ['deck', 'bow', 'stern'].includes(i.slot));
  it('каждый предмет палубы, носа и кормы получает место', () => {
    const got = placed().map(p => p.id);
    expect(got.length, `не нашлось места: ${need.filter(i => !got.includes(i.id)).map(i => i.id)}`).toBe(need.length);
  });
  it('места не наезжают друг на друга (круги основания) и не лежат на площадке у портала и у входа героя', () => {
    const ps = placed();
    for (let a = 0; a < ps.length; a++) for (let b = a + 1; b < ps.length; b++) if (Math.abs(ps[a].y - ps[b].y) < 1) expect(Math.hypot(ps[a].x - ps[b].x, ps[a].z - ps[b].z), `${ps[a].id} / ${ps[b].id}`).toBeGreaterThanOrEqual(ps[a].r + ps[b].r);
    for (const p of ps) for (const v of AVOID) expect(Math.hypot(p.x - v[0], p.z - v[1]), `${p.id} на площадке`).toBeGreaterThanOrEqual(v[2]);
  });
  it('стоят на палубе: пол под центром ровный (±5 см) и не яма, высота места = высота пола', () => {
    const s = shipSurface();
    for (const p of placed()) {
      expect(Number.isNaN(s.at(p.x, p.z)), p.id).toBe(false);
      expect(Math.abs(p.y - s.at(p.x, p.z)), p.id).toBeLessThanOrEqual(0.05);
      for (let dx = -p.r * 0.5; dx <= p.r * 0.5; dx += 0.3) for (let dz = -p.r * 0.5; dz <= p.r * 0.5; dz += 0.3) if (Math.hypot(dx, dz) <= p.r * 0.5) expect(Math.abs(s.at(p.x + dx, p.z + dz) - p.y), `${p.id}: пол под основанием`).toBeLessThanOrEqual(0.05);
    }
  });
  it('палуба остаётся связной: со всеми предметами от площадки у портала можно дойти до каждой станции, кормы и носа', () => {
    const { x0, z0, nx, nz, step } = SHIP_MAP, W = new Uint8Array(nx * nz), cell = (x: number, z: number): [number, number] => [Math.round((x - x0) / step), Math.round((z - z0) / step)];
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) W[i * nz + j] = SHIP_MAP.W[j][i] === '1' ? 1 : 0;
    const total = W.reduce((a, b) => a + b, 0);
    for (const c of planCircles(plan())) { const [ci, cj] = cell(c[0], c[1]), n = Math.ceil(c[2] / step); for (let di = -n; di <= n; di++) for (let dj = -n; dj <= n; dj++) if (Math.hypot(di, dj) * step <= c[2] && ci + di >= 0 && cj + dj >= 0 && ci + di < nx && cj + dj < nz) W[(ci + di) * nz + cj + dj] = 0; }
    const alive = W.reduce((a, b) => a + b, 0), [si, sj] = cell(...(SHIP_MAP.stand as [number, number])), seen = new Uint8Array(nx * nz), q = [si * nz + sj]; seen[q[0]] = 1;
    while (q.length) { const k = q.pop()!, i = Math.floor(k / nz), j = k % nz; for (const [a, b] of [[i + 1, j], [i - 1, j], [i, j + 1], [i, j - 1]]) if (a >= 0 && b >= 0 && a < nx && b < nz && W[a * nz + b] && !seen[a * nz + b]) { seen[a * nz + b] = 1; q.push(a * nz + b); } }
    for (const [name, pt] of Object.entries(SHIP_MAP.stations)) { const [i, j] = cell(pt[0], pt[1]); expect(seen[i * nz + j], `станция ${name} достижима`).toBe(1); }
    // кормовая надстройка (пол выше 2 м): самая кормовая проходимая клетка тоже достижима
    let stern = -1; for (let i = 0; i < nx && stern < 0; i++) for (let j = 0; j < nz; j++) if (SHIP_MAP.W[j][i] === '1' && shipSurface().at(x0 + i * step, z0 + j * step) > 2) { stern = i * nz + j; break; }
    expect(stern, 'на корме есть проходимые клетки').toBeGreaterThanOrEqual(0); expect(seen[stern], 'корма достижима').toBe(1);
    expect(alive, 'предметы не съели больше половины прохода').toBeGreaterThan(total * 0.5);
  });
  it('раскладка не зависит от запуска: два раза одно и то же', () => {
    expect(JSON.stringify(plan())).toBe(JSON.stringify(plan()));
  });
});
