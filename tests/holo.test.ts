// «Тірі түсіндіру»: что проецирует голограмма Бита и как раскладывается её текст (без three.js и DOM).
import { describe, it, expect } from 'vitest';
// @ts-ignore
import { LESSONS as L } from '../content/lessons.mjs';
import { holoSpecFor, keyMath, sceneText, factorChain, fracSpec, holoShape } from '../src/three/holo_spec';
import { toAtoms, layoutAtoms, type Measure } from '../src/three/holo_text';

const LESSONS = L as Record<string, any[]>;
const ex = (skill: string) => (LESSONS[skill] as any[]).find(s => s.type === 'example');
const mono: Measure = (s, px) => s.length * px * 0.6;

describe('holoSpecFor: пицца и полоски', () => {
  it('кадры frac.concept — геометрия пиццы со стадиями 0..3', () => {
    const st = ex('frac.concept');
    const sp = st.frames.map((_: unknown, k: number) => holoSpecFor(st, { frame: k }));
    expect(sp.slice(0, 5).map((x: any) => [x.kind, x.round, x.stage])).toEqual([['frac', true, 0], ['frac', true, 1], ['frac', true, 2], ['frac', true, 2], ['frac', true, 3]]);
    expect(sp[4].rows).toEqual([{ n: 5, d: 8, eat: 3 }]);
    expect(sp[5].kind).toBe('text');                       // последний кадр — плитки «5/3 ✘ 5/8 ✔»
    expect(sp[5].text).toContain('5/8');
  });
  it('frac.basic_property: строки растут, guide включён', () => {
    const st = ex('frac.basic_property');
    const s1 = holoSpecFor(st, { frame: 1 }) as any, s2 = holoSpecFor(st, { frame: 2 }) as any;
    expect(s1.rows.length).toBe(2); expect(s2.rows.length).toBe(3); expect(s2.guide).toBe(true);
  });
  it('цель с «Глитч-сломанной» пиццей: геометрия, broken, гаснет сама', () => {
    const g = holoSpecFor((LESSONS['frac.concept'] as any[])[0]) as any;
    expect(g.kind).toBe('frac'); expect(g.broken).toBe(true); expect(g.hold).toBeGreaterThan(0);
  });
  it('форма: та же форма — правка на месте, другая — пересборка', () => {
    expect(holoShape({ kind: 'frac', rows: [], stage: 0, round: true, broken: false, guide: false })).toBe('frac:r');
    expect(holoShape({ kind: 'frac', rows: [], stage: 0, round: false, broken: false, guide: false })).toBe('frac:b');
    expect(holoShape({ kind: 'text', text: '1' })).toBe('text');
  });
  it('FracLine — полоска не меньше стадии 1', () => {
    expect((fracSpec('FracLine', { n: 3, d: 4, stage: 0 }) as any).stage).toBe(1);
    expect(fracSpec('FracLine', {})).toBeNull();
  });
});

describe('holoSpecFor: текст', () => {
  it('разряды: у кадра без math — цифры поезда с подсветкой вагона', () => {
    const st = ex('nat.place_value');
    expect((holoSpecFor(st, { frame: 0 }) as any).text).toBe('4 030 005');
    expect((holoSpecFor(st, { frame: 1 }) as any).text).toBe('4 030 [005]');   // math кадра
    expect(sceneText('Train', { digits: '4030005', hl: 't' })).toBe('4 [030] 005');
  });
  it('дерево множителей растёт вместе с кадром и подсвечивает новый лист', () => {
    const st = ex('div.factorization');
    expect((holoSpecFor(st, { frame: 0 }) as any).text).toBe('60');
    expect(sceneText('Tree', { n: 60, depth: 2 })).toBe('60 = 2 · [2] · 15');
    expect(sceneText('Tree', { n: 60, depth: 3 })).toBe('60 = 2 · 2 · [3] · 5');
    expect(factorChain(60).map(c => c.p)).toEqual([2, 2, 3]);
  });
  it('пропуск D11 не выдаётся: пока не решён, берётся текст с ▢, после — с fill', () => {
    const st = ex('logic.permutations');
    const shown = st.frames[4].math as string;            // '4 · 3 · 2 · 1 = [24]'
    const closed = holoSpecFor(st, { frame: 4, gapText: '4 · 3 · 2 · 1 = ▢', gapFill: null }) as any;
    expect(closed.text).toContain('▢'); expect(closed.text).not.toContain('24'); expect(closed.fill).toBeNull();
    const open = holoSpecFor(st, { frame: 4, gapText: '4 · 3 · 2 · 1 = ▢', gapFill: '24' }) as any;
    expect(open.fill).toBe('24'); expect(shown).toContain('24');
  });
  it('шаги без объяснения-картинки (widget, predict, faded, why) голограмму не показывают', () => {
    for (const t of ['widget', 'predict', 'faded', 'why', 'bug', 'blitz', 'final']) expect(holoSpecFor({ type: t })).toBeNull();
  });
  it('каждый пример каждого урока даёт голограмму или честно null, без исключений', () => {
    let n = 0, some = 0;
    for (const steps of Object.values(LESSONS) as any[][]) for (const st of steps) if (st.type === 'example') for (let k = 0; k < st.frames.length; k++) { const sp = holoSpecFor(st, { frame: k }); n++; if (sp) some++; }
    expect(n).toBeGreaterThan(100); expect(some / n).toBeGreaterThan(0.85);   // почти все кадры оживают автоматически
  });
});

describe('keyMath: ключевая строка правила', () => {
  it('берёт формулу, а не слова', () => {
    expect(keyMath(['Қосуға болмайды: 1/2 ≠ 2/3.'])).toBe('1/2 ≠ 2/3');
    expect(keyMath(['Қалғанын сұраса: 8 − 3 = 5, жауабы 5/8.'])).toBe('8 − 3 = 5');
    expect(keyMath(['a', '4 затты қатарға қою: 4 · 3 · 2 · 1 = 24.', 'Тек 3 орын: 7 · 6 · 5 = 210.'])).toBe('4 · 3 · 2 · 1 = 24');
  });
  it('без формулы — null; со скрытым пропуском ▢ строка проходит', () => {
    expect(keyMath(['Бөлім — бүтін неше ТЕҢ бөлікке бөлінген.'])).toBeNull();
    expect(keyMath(['8 − 3 = ▢'])).toBe('8 − 3 = ▢');
  });
  it('правило урока со скрытым числом использует строку с пропуском', () => {
    const rule = { type: 'rule', lines: ['слово', '8 − 3 = 5, жауабы 5/8.'] };
    const sp = holoSpecFor(rule, { gapText: '8 − 3 = ▢', gapLine: 1, gapFill: null }) as any;
    expect(sp.text).toBe('8 − 3 = ▢');
  });
});

describe('раскладка текста голограммы', () => {
  const box = { w: 980, h: 340 };
  it('короткое выражение — крупный кегль, одна строка', () => {
    const lay = layoutAtoms(toAtoms('5/8'), mono, box.w, box.h);
    expect(lay.F).toBeGreaterThanOrEqual(154); expect(lay.lines.length).toBe(1);
  });
  it('длинное переносится (не больше 3 строк) и влезает в рамку', () => {
    const lay = layoutAtoms(toAtoms('60 = 2 · 2 · 3 · 5 = 2² · 3 · 5'), mono, box.w, box.h);
    expect(lay.lines.length).toBeLessThanOrEqual(3); expect(lay.w).toBeLessThanOrEqual(box.w); expect(lay.h).toBeLessThanOrEqual(box.h);
  });
  it('знак действия не остаётся в конце строки', () => {
    const lay = layoutAtoms(toAtoms('60 = 2 · 2 · 3 · 5 = 2² · 3 · 5'), mono, box.w, box.h);
    for (const l of lay.lines.slice(0, -1)) { const last = l.items[l.items.length - 1].atom; expect(last.k === 'word' && /^[·×:+−*=]$/.test(last.s)).toBe(false); }
  });
  it('разбор: подсветка, пропуск, дробь, склеенные числа', () => {
    const a = toAtoms('4 030 [005] ▢ 3/4');
    expect(a.map(x => x.k)).toEqual(['word', 'hl', 'blank', 'frac']);
    expect(toAtoms('▢', '24')[0]).toMatchObject({ k: 'blank' });
  });
});
