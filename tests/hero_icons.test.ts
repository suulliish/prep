// Экран «Кейіпкер»: портреты костюмов и иконки наград за звёзды (scripts/assets/hero-icons.mjs), подписи снаряжения совпадают с моделями.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { OUTFITS, STAR_REWARDS } from '../content/worlds.mjs';
import { LOOKS } from '../src/three/looks';

const PUB = path.resolve('public/ui/hero');
type Outfit = { id: string; gear?: string };
type Reward = { id: string; kind: string };

function checkPng(file: string, w: number, h: number) {
  expect(fs.existsSync(file), `нет ${path.basename(file)}`).toBe(true);
  const b = fs.readFileSync(file), name = path.basename(file);
  expect(b.length, `${name}: вес`).toBeLessThanOrEqual(40 * 1024);
  expect(b.subarray(1, 4).toString(), name).toBe('PNG');
  expect([b.readUInt32BE(16), b.readUInt32BE(20)], `${name}: размер`).toEqual([w, h]);
  expect(b[25] === 3 ? b.includes('tRNS') : [4, 6].includes(b[25]), `${name}: прозрачный фон`).toBe(true);
}

describe('портреты героя и иконки наград', () => {
  it('у каждого костюма свой портрет 256×320 с прозрачностью до 40 КБ', () => {
    for (const o of OUTFITS as Outfit[]) checkPng(path.join(PUB, `${o.id}.png`), 256, 320);
  });
  it('у каждой награды за звёзды своя иконка 256×256 с прозрачностью до 40 КБ', () => {
    for (const r of STAR_REWARDS as Reward[]) checkPng(path.join(PUB, `reward-${r.id}.png`), 256, 256);
  });
});

// подпись на карточке должна называть то, что реально в руках и на голове у героя (looks.ts)
const WEAPON: Record<string, string> = { sword_1handed: 'қылыш', dagger: 'қанжар', axe_1handed: 'балта', wand: 'сиқыр таяқшасы' };
describe('подписи снаряжения костюмов', () => {
  it('оружие, щит или книга, свечение названы, и нет лишнего', () => {
    for (const o of OUTFITS as Outfit[]) {
      const l = LOOKS[o.id], g = o.gear ?? '', words = g.split('·').map(x => x.trim());
      expect(WEAPON[l.weapon], `${o.id}: слово для оружия ${l.weapon}`).toBeTruthy();
      expect(words, `${o.id}: оружие`).toContain(WEAPON[l.weapon]);
      const off = l.offhand ?? '';
      if (off.startsWith('spellbook')) expect(words, `${o.id}: книга`).toContain('сиқыр кітабы');
      else if (off.startsWith('shield_spikes')) expect(words, `${o.id}: шипастый щит`).toContain('тікенді қалқан');
      else if (off.startsWith('shield')) expect(words, `${o.id}: щит`).toContain('қалқан');
      expect(words.includes('жарқыл'), `${o.id}: свечение`).toBe(!!l.glow);
      expect(g, `${o.id}: без длинного тире`).not.toMatch(/—/);
    }
  });
});
