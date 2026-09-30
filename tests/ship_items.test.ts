// Мастерская корабля: каталог украшений (content/ship_items.mjs) и всё, на что он ссылается (модели, клипы питомцев, иконки).
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { SHIP_ITEMS, COINS } from '../content/ship_items.mjs';
import { CAPACITY } from '../src/three/decor3d';
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
