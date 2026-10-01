import { describe, it, expect } from 'vitest';
import { ruleLines, coreRule, words, makeBoard, assemble, isRight, diff, blanks, traps, plain, MIN_WORDS, MAX_WORDS } from '../src/lesson/recallrule';
import { seeded } from '../src/lesson/gap';
// @ts-ignore
import { LESSONS } from '../content/lessons.mjs';

const IDS = Object.keys(LESSONS as Record<string, any[]>);

describe('Еске түсір: правило из кирпичиков', () => {
  it('у каждой из тем с уроком есть правило, главная строка 4–20 слов', () => {
    expect(IDS.length).toBeGreaterThanOrEqual(36);
    for (const id of IDS) {
      const lines = ruleLines(id);
      expect(lines, id).not.toBeNull();
      const n = words(coreRule(lines!)).length;
      expect(n, id).toBeGreaterThanOrEqual(MIN_WORDS);
      expect(n, id).toBeLessThanOrEqual(MAX_WORDS);
    }
  });
  it('короткая первая строка дополняется следующей («Амалдар реті»)', () => {
    expect(coreRule(['1) Жақша ішіндегі амалдар.', '2) Көбейту мен бөлу — солдан оңға.', '3) Қосу мен азайту — солдан оңға.'])).toBe('1) Жақша ішіндегі амалдар. 2) Көбейту мен бөлу — солдан оңға.');
    expect(coreRule(['Жай сан — дәл 2 бөлгіші бар: 1 және өзі.', 'Басқа жол.'])).toBe('Жай сан — дәл 2 бөлгіші бар: 1 және өзі.');
  });
  it('доска на любом уровне: слова правила целы, ловушек 2–3, ловушка не совпадает со словом правила', () => {
    for (const id of IDS) for (const level of [0, 1, 2] as const) {
      const b = makeBoard(ruleLines(id)!, level, `${id}:d:${level}`);
      const inPile = [...b.pile];
      const need = b.target.filter((_, i) => b.preset[i] === null);
      for (const w of need) { const k = inPile.indexOf(w); expect(k, `${id} ${level} ${w}`).toBeGreaterThanOrEqual(0); inPile.splice(k, 1); }
      expect(inPile.length, `${id} ловушки`).toBeGreaterThanOrEqual(2);
      expect(inPile.length, `${id} ловушки`).toBeLessThanOrEqual(3);
      const tp = new Set(b.target.map(plain));
      for (const t of inPile) expect(tp.has(plain(t)), `${id}: ловушка «${t}» есть в правиле`).toBe(false);
      expect(b.pile.length, id).toBeLessThanOrEqual(MAX_WORDS + 3);
    }
  });
  it('лестница: 0 пусто, 1 первое слово стоит, 2 каждое второе слово стоит', () => {
    const lines = ruleLines('div.primes')!;
    const b0 = makeBoard(lines, 0, 'k'), b1 = makeBoard(lines, 1, 'k'), b2 = makeBoard(lines, 2, 'k');
    expect(b0.preset.every(x => x === null)).toBe(true);
    expect(b1.preset[0]).toBe(b1.target[0]);
    expect(b1.preset.slice(1).every(x => x === null)).toBe(true);
    expect(b2.preset.every((x, i) => (i % 2 === 0 ? x === b2.target[i] : x === null))).toBe(true);
    expect(b0.open && b1.open && !b2.open).toBe(true);
    expect(blanks(b2)).toBe(Math.floor(b2.target.length / 2));
  });
  it('куча перемешана и не повторяет порядок правила; одинаковый ключ даёт одинаковую кучу', () => {
    for (const id of IDS) {
      const lines = ruleLines(id)!;
      const a = makeBoard(lines, 0, `${id}:x`), b = makeBoard(lines, 0, `${id}:x`);
      expect(a.pile).toEqual(b.pile);
      expect(a.target.every((w, i) => a.pile[i] === w), id).toBe(false);
    }
  });
  it('сборка: свободный лоток и скелет; верный порядок принимается, перестановка и ловушка нет', () => {
    const lines = ruleLines('div.gcd')!;
    const b0 = makeBoard(lines, 0, 's');
    expect(isRight(b0.target, assemble(b0, [...b0.target]))).toBe(true);
    const swapped = [...b0.target]; [swapped[0], swapped[1]] = [swapped[1], swapped[0]];
    expect(isRight(b0.target, assemble(b0, swapped))).toBe(false);
    expect(isRight(b0.target, assemble(b0, [...b0.target.slice(0, -1), 'емес']))).toBe(false);
    const b1 = makeBoard(lines, 1, 's');
    expect(isRight(b1.target, assemble(b1, b1.target.slice(1)))).toBe(true);
    const b2 = makeBoard(lines, 2, 's');
    const fill = b2.target.filter((_, i) => b2.preset[i] === null);
    expect(isRight(b2.target, assemble(b2, fill))).toBe(true);
    expect(isRight(b2.target, assemble(b2, fill.slice(0, -1)))).toBe(false);
    expect(assemble(b2, fill.slice(0, 1)).includes(null)).toBe(true);
  });
  it('одинаковые слова в правиле взаимозаменяемы', () => {
    const t = ['а', 'б', 'а'];
    expect(isRight(t, ['а', 'б', 'а'])).toBe(true);
  });
  it('сверка подсвечивает лишнее и пропущенное', () => {
    const d = diff(['a', 'b', 'c', 'd'], ['a', 'x', 'c']);
    expect(d.target).toEqual([true, false, true, false]);
    expect(d.answer).toEqual([true, false, true]);
    const same = diff(['a', 'b'], ['A', 'b']);
    expect(same.target).toEqual([true, true]);
    expect(diff(['a'], [null]).target).toEqual([false]);
  });
  it('ловушки берутся из других строк правила, потом общие', () => {
    const t = traps(['Ереже бірінші жолы.', 'Басқа бөлек жолдағы сөздер.'], ['Ереже', 'бірінші', 'жолы.'], seeded('t'));
    expect(t.length).toBe(3);
    expect(t.includes('Ереже')).toBe(false);
  });
});
