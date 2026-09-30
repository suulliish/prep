import { describe, it, expect } from 'vitest';
// @ts-ignore
import { LESSONS } from '../content/lessons.mjs';
import { parseRich, glueNumbers, hasHighlight } from '../src/lesson/rich';
import { frameGap, ruleGap, planGaps, holds, seeded } from '../src/lesson/gap';
import { splitFractions } from '../src/widgets/fracdraw';

const kinds = (s: string) => parseRich(s).map(p => (p.t === 'frac' ? `f${p.whole ?? ''}:${p.n}/${p.d}` : p.t === 'hl' ? `hl(${p.parts.map(x => (x.t === 'frac' ? `f${x.n}/${x.d}` : x.t === 'text' ? x.s : x.t)).join('|')})` : p.t === 'blank' ? '▢' : p.s));

describe('parseRich — строка урока', () => {
  it('дроби и смешанные числа становятся этажными', () => {
    expect(kinds('3/4 = 6/8')).toEqual(['f:3/4', ' = ', 'f:6/8']);
    expect(kinds('2 3/4 + 1/2')).toEqual(['f2:3/4', ' + ', 'f:1/2']);
  });
  it('подсветка [..] и пропуск ▢ сохраняются, дробь внутри подсветки тоже этажная', () => {
    expect(kinds('3/4 = [6/8]')).toEqual(['f:3/4', ' = ', 'hl(f6/8)']);
    expect(kinds('8 − 3 = [5]')).toEqual(['8 − 3 = ', 'hl(5)'].map((x, k) => (k === 0 ? '8 − 3 = ' : x)));
    expect(kinds('12 : ▢ = 3')).toEqual(['12 : ', '▢', ' = 3']);
  });
  it('«:» (деление, время, отношение), даты и не-дроби не трогает', () => {
    for (const t of ['10:30', '1:2', '12 : 4 = 3', '12/05/2024', '1/2/3', 'км/сағ', '0.5/2']) {
      expect(parseRich(t).every(p => p.t === 'text'), t).toBe(true);
      expect(parseRich(t).map(p => (p as any).s).join('').replace(/ /g, ' ')).toBe(t);
    }
  });
  it('числа с разрядами не рвутся, смешанное число не склеивается', () => {
    expect(glueNumbers('4 030 005')).toBe('4 030 005');
    expect(glueNumbers('2 3/4')).toBe('2 3/4');
    expect(glueNumbers('5 %')).toBe('5 %');
    expect(kinds('4 030 [005]')).toEqual(['4 030 ', 'hl(005)']);
  });
  it('«1 000 1/2»: разряды остаются числом, а не «целой частью» дроби', () => {
    const segs = splitFractions('1 000 1/2');
    expect(segs).toEqual([{ t: 'text', s: '1 000 ' }, { t: 'frac', whole: null, n: 1, d: 2 }]);
    expect(splitFractions('12 400 3/4').filter(s => s.t === 'frac')).toEqual([{ t: 'frac', whole: null, n: 3, d: 4 }]);
    expect(splitFractions('2 3/4')).toEqual([{ t: 'frac', whole: 2, n: 3, d: 4 }]);
    expect(splitFractions('ұзындық 5 2/3 м')[1]).toEqual({ t: 'frac', whole: 5, n: 2, d: 3 });
  });
  it('hasHighlight', () => { expect(hasHighlight('a [b]')).toBe(true); expect(hasHighlight('a b')).toBe(false); });
});

describe('holds — равенство верно / неверно / не арифметика', () => {
  it('арифметика', () => {
    expect(holds('8 − 3 = 5')).toBe(true);
    expect(holds('8 − 3 = 6')).toBe(false);
    expect(holds('5 · 2 = 10 > 9')).toBe(true);
    expect(holds('30 : 2 = 15')).toBe(true);
    expect(holds('2 · (3 + 4) = 14')).toBe(true);
  });
  it('нельзя судить — null', () => {
    expect(holds('ЕКОЕ(6; 8) = 24')).toBeNull();
    expect(holds('17 : 5 = 3')).toBeNull();   // деление с остатком не равенство
    expect(holds('4 030 005')).toBeNull();
    expect(holds('3/4 = 6/8')).toBeNull();
  });
});

describe('frameGap — пропуск в кадре «Көр»', () => {
  const r = seeded('t');
  it('закрывает подсвеченное число, варианты не равны ответу и не верны сами', () => {
    const g = frameGap('17 − 15 = [2]', r)!;
    expect(g.text).toBe('17 − 15 = ▢');
    expect(g.answer).toBe('2');
    expect(new Set(g.options).size).toBe(3);
    expect(g.options).toContain('2');
  });
  it('не закрывает рядом со знаком сравнения: «10 > [8]» — годятся и 9, и 7', () => {
    expect(frameGap('5 · 2 = 10 > [8]', r)).toBeNull();
    expect(frameGap('3 · 2 = 6 < [7]', r)).toBeNull();
    expect(frameGap('10² = [100] ≤ 100', r)).toBeNull();
  });
  it('нет подсвеченного числа — нет пропуска', () => {
    expect(frameGap('5/8', r)).toBeNull();
    expect(frameGap('', r)).toBeNull();
    expect(frameGap('Тек М: 12 − 2 = 10', r)).toBeNull();
  });
  it('класс с нулями: варианты — перестановки цифр той же длины', () => {
    const g = frameGap('4 030 [005]', r)!;
    expect(g.answer).toBe('005');
    for (const o of g.options) expect(o).toMatch(/^\d{3}$/);
    expect(new Set(g.options).size).toBe(3);
  });
  it('подсвеченная дробь: варианты — другие по величине дроби', () => {
    const g = frameGap('3/4 = [6/8]', r)!;
    expect(g.answer).toBe('6/8');
    expect(g.text).toBe('3/4 = ▢');
    for (const o of g.options.filter(x => x !== '6/8')) { const [n, d] = o.split('/').map(Number); expect(n * 4).not.toBe(3 * d); }
  });
  it('остальные подсвеченные части остаются в строке', () => {
    const g = frameGap('9 : 3 = [3], 12 : 3 = [4]', r)!;
    expect(g.text).toBe('9 : 3 = ▢, 12 : 3 = [4]');
  });
  it('одинаковый ключ — одинаковые варианты', () => {
    expect(frameGap('60 = [2] · 30', seeded('k'))).toEqual(frameGap('60 = [2] · 30', seeded('k')));
  });
});

describe('ruleGap — пропуск в правиле', () => {
  it('результат после «=»', () => {
    const g = ruleGap('Қалғанын сұраса: 8 − 3 = 5 бөлік.', seeded('a'))!;
    expect(g.answer).toBe('5');
    expect(g.text).toContain('8 − 3 = ▢');
  });
  it('ответ виден в той же строке («жауабы 5/8») — null', () => {
    expect(ruleGap('Қалғанын сұраса: 8 − 3 = 5, жауабы 5/8.', seeded('a'))).toBeNull();
  });
  it('строка без чисел — null', () => { expect(ruleGap('Бөліктер тең болмаса — бөлшек жоқ.', seeded('a'))).toBeNull(); });
});

describe('planGaps — «в каждом втором кадре», флаг noGap', () => {
  const ex = (frames: any[]) => ({ type: 'example', kz: 'x', frames });
  it('каждый второй среди кадров, где есть что закрыть', () => {
    const p = planGaps('s', 3, ex([{ kz: 'a' }, { math: '17 − 15 = [2]', kz: 'b' }, { math: '5 · 3 = [15]', kz: 'c' }, { math: '20 − 5 = [15]', kz: 'd' }]))!;
    expect(p.frames!.map(Boolean)).toEqual([false, true, false, true]);
  });
  it('кадр с noGap пропускается и не считается', () => {
    const p = planGaps('s', 3, ex([{ math: '17 − 15 = [2]', kz: 'a', noGap: true }, { math: '5 · 3 = [15]', kz: 'b' }]))!;
    expect(p.frames!.map(Boolean)).toEqual([false, true]);
  });
  it('noGap на шаге — без пропусков', () => {
    expect(planGaps('s', 3, { ...ex([{ math: '17 − 15 = [2]', kz: 'a' }]), noGap: true })).toBeNull();
    expect(planGaps('s', 9, { type: 'rule', kz: 'r', lines: ['8 − 3 = 5'], noGap: true })).toBeNull();
  });
  it('правило: одна строка', () => {
    const p = planGaps('s', 9, { type: 'rule', kz: 'r', lines: ['Бөлім — төменгі сан.', '8 − 3 = 5 бөлік қалды.'] })!;
    expect(p.rule!.line).toBe(1);
  });
  it('другие типы шагов — null', () => { expect(planGaps('s', 0, { type: 'goal' })).toBeNull(); });
});

describe('на всех уроках: пропуски корректны', () => {
  for (const [skill, steps] of Object.entries(LESSONS as Record<string, any[]>)) {
    steps.forEach((st, i) => {
      const p = planGaps(skill, i, st);
      if (!p) return;
      const gaps = [...(p.frames ?? []), p.rule?.gap].filter(Boolean) as any[];
      it(`${skill} шаг ${i}`, () => {
        for (const g of gaps) {
          expect(g.text.split('▢').length - 1).toBe(1);
          expect(g.options.length).toBe(3);
          expect(new Set(g.options).size).toBe(3);
          expect(g.options).toContain(g.answer);
          // подстановка верного ответа не должна давать заведомо неверное равенство
          expect(holds(g.text.replace(/[[\]]/g, '').replace('▢', g.answer))).not.toBe(false);
        }
      });
    });
  }
});

// подпись кадра не должна подсказывать закрытое число (найдено при проверке: «Пиццаны 8 тең бөлікке кестік» под пропуском «▢ тең бөлік»)
import { frameGap as _fg, mentions as _mentions } from '../src/lesson/gap';
describe('пропуск не подсказан подписью', () => {
  it('mentions: отдельное число, не часть другого', () => {
    expect(_mentions('Пиццаны 8 тең бөлікке кестік', '8')).toBe(true);
    expect(_mentions('18 бөлік', '8')).toBe(false);
    expect(_mentions('8/9 бөлігі', '8')).toBe(false);
    expect(_mentions('жартысы 3/4', '3/4')).toBe(true);
  });
  it('frameGap не закрывает число из подписи', () => {
    expect(_fg('[8] тең бөлік', () => 0.3, 'Пиццаны 8 тең бөлікке кестік.')).toBeNull();
    expect(_fg('[8] тең бөлік', () => 0.3, 'Пиццаны кестік.')).not.toBeNull();
  });
});

// red-team 30.09: ответ пропуска читался на экране (сцена, соседняя строка правила, разложенная дробь)
import { revealed as _rev, ruleGap as _rg } from '../src/lesson/gap';
describe('ответ пропуска не виден на экране', () => {
  it('revealed: числитель чужой дроби, разложенная дробь', () => {
    expect(_rev('2 · 4 + 3 = ▢, жауабы 11/4', '11')).toBe(true);
    expect(_rev('3 · 3 = 9, 4 · 3 = 12', '9/12')).toBe(true);
    expect(_rev('{"rows":[{"n":9,"d":12}]}', '9/12')).toBe(true);
    expect(_rev('8 бөлік', '5')).toBe(false);
  });
  it('ruleGap не закрывает число, которое стоит в соседней строке', () => {
    expect(_rg('2 · 4 + 3 = 11', () => 0.3, 'жауабы 11/4')).toBeNull();
  });
});
