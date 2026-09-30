import { describe, it, expect } from 'vitest';
import glossary from '../content/glossary.json';
// @ts-ignore — шаблоны написаны на JS
import logic7 from '../content/templates/logic7.mjs';
// @ts-ignore
import { templates, byId } from '../content/templates/index.mjs';
// @ts-ignore
import { rng } from '../content/templates/lib.mjs';
// @ts-ignore
import { skillById } from '../content/skills.mjs';
// @ts-ignore
import { MISCONCEPTIONS } from '../content/misconceptions.mjs';

const T = logic7 as any[];
const SEEDS = 300;
type Item = { kz: string; ru: string; choices: { text: string; tag: string }[]; answer: number; sol: { kz: string; ru: string }; hints: { kz: string; ru: string }[]; figure?: { kind: string; svg: string } };
const texts = (it: Item) => it.choices.map(c => c.text);
const ans = (it: Item) => it.choices[it.answer].text;
const nums = (s: string) => (s.match(/\d+/g) || []).map(Number);

// ---------- независимые расчёты (перебором, без формул шаблона) ----------
function* arrangements(items: string[], k: number, used: string[] = []): Generator<string[]> {
  if (used.length === k) { yield used; return; }
  for (const x of items) if (!used.includes(x)) yield* arrangements(items, k, [...used, x]);
}
const countAll = (n: number, f: (a: number, b: number) => boolean) => { let c = 0; for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (f(i, j)) c++; return c; };
const pairsUnordered = (n: number) => countAll(n, () => true);
const pairsOrdered = (n: number) => { let c = 0; for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (i !== j) c++; return c; };
const shownTerms = (kz: string) => /алғашқы мүшелері: (.*?); \.\.\./.exec(kz)![1].split('; ').map(Number);
// все ли элементы принадлежат арифметической прогрессии с данными первым членом и шагом
const isArith = (xs: number[]) => xs.every((x, i) => i < 2 || x - xs[i - 1] === xs[1] - xs[0]);

const WD_KZ = ['жексенбі', 'дүйсенбі', 'сейсенбі', 'сәрсенбі', 'бейсенбі', 'жұма', 'сенбі'];   // индекс = Date.getUTCDay()
const WD_RU = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];
const MON_ABL = ['қаңтардан', 'ақпаннан', 'наурыздан', 'сәуірден', 'мамырдан', 'маусымнан', 'шілдеден', 'тамыздан', 'қыркүйектен', 'қазаннан', 'қарашадан', 'желтоқсаннан'];
const MON_DAT = ['қаңтарға', 'ақпанға', 'наурызға', 'сәуірге', 'мамырға', 'маусымға', 'шілдеге', 'тамызға', 'қыркүйекке', 'қазанға', 'қарашаға', 'желтоқсанға'];
const MON_NOM = ['қаңтар', 'ақпан', 'наурыз', 'сәуір', 'мамыр', 'маусым', 'шілде', 'тамыз', 'қыркүйек', 'қазан', 'қараша', 'желтоқсан'];
const utc = (y: number, m: number, d: number) => Date.UTC(y, m - 1, d);
const labelOf = (dow: number) => WD_KZ[dow] + ' / ' + WD_RU[dow];

/** Клетки из SVG-рисунка: каждая клетка — <rect width=26>. */
function cellsOf(svg: string): Set<string> {
  const out = new Set<string>();
  for (const m of svg.matchAll(/<rect x="(\d+)" y="(\d+)" width="26" height="26"\/>/g)) out.add(`${(+m[2] - 2) / 26},${(+m[1] - 2) / 26}`);
  return out;
}
function squaresOf(cells: Set<string>, size?: number): number {
  const pts = [...cells].map(s => s.split(',').map(Number));
  const R = Math.max(...pts.map(p => p[0])) + 1, C = Math.max(...pts.map(p => p[1])) + 1;
  let cnt = 0;
  for (let k = 1; k <= Math.min(R, C); k++) {
    if (size && k !== size) continue;
    for (let r = 0; r + k <= R; r++) for (let c = 0; c + k <= C; c++) {
      let ok = true;
      for (let i = 0; i < k; i++) for (let j = 0; j < k; j++) if (!cells.has(`${r + i},${c + j}`)) ok = false;
      if (ok) cnt++;
    }
  }
  return cnt;
}

const VERIFY: Record<string, (it: Item) => void> = {
  'logic.perm_digits'(it) {
    const digs = /Тек ([\d, ]+) цифрларын/.exec(it.kz)![1].split(', ');
    const k = it.kz.includes('үш таңбалы') ? 3 : 2;
    expect(it.kz).toMatch(k === 3 ? /үш таңбалы/ : /екі таңбалы/);
    expect(it.ru).toContain(digs.join(', '));
    let cnt = 0;
    for (const a of arrangements(digs, k)) if (a[0] !== '0') cnt++;
    expect(ans(it)).toBe(String(cnt));
  },
  'logic.perm_menu'(it) {
    const cs = nums(it.kz);
    expect(nums(it.ru)).toEqual(cs);
    let combos: number[][] = [[]];
    for (const c of cs) combos = combos.flatMap(p => Array.from({ length: c }, (_, i) => [...p, i]));
    expect(ans(it)).toBe(String(combos.length));
  },
  'logic.perm_fixed'(it) {
    const names = /\(([^)]*)\)/.exec(it.kz)![1].split(', ');
    const tail = it.kz.slice(it.kz.indexOf(')') + 1).split(/[\s.,]+/);
    const cond = names.filter(n => tail.includes(n));
    let cnt = 0;
    if (it.kz.includes('ең басында')) {
      expect(cond).toHaveLength(1); expect(it.ru).toContain('первым');
      for (const a of arrangements(names, names.length)) if (a[0] === cond[0]) cnt++;
    } else {
      expect(cond).toHaveLength(2); expect(it.ru).toContain('рядом');
      for (const a of arrangements(names, names.length)) if (Math.abs(a.indexOf(cond[0]) - a.indexOf(cond[1])) === 1) cnt++;
    }
    expect(ans(it)).toBe(String(cnt));
  },
  'logic.tour_pairs'(it) {
    const n = nums(it.kz)[0];
    expect(nums(it.ru)[0]).toBe(n);
    expect(ans(it)).toBe(String(pairsUnordered(n)));
  },
  'logic.tour_double'(it) {
    const n = nums(it.kz)[0];
    expect(nums(it.ru)[0]).toBe(n);
    expect(ans(it)).toBe(String(pairsOrdered(n)));
  },
  'logic.tour_one_more'(it) {
    const n = nums(it.kz)[0];
    const m = /тағы бір команда/.test(it.kz) ? 1 : +/тағы (\d) команда/.exec(it.kz)![1];
    expect(nums(it.ru)[0]).toBe(n);
    expect(ans(it)).toBe(String(pairsUnordered(n + m) - pairsUnordered(n)));
  },
  'logic.tour_find_n'(it) {
    const G = +/Барлығы (\d+) матч/.exec(it.kz)![1];
    expect(nums(it.ru)).toContain(G);
    let n = 2; while (pairsUnordered(n) < G) n++;
    expect(pairsUnordered(n)).toBe(G);
    expect(ans(it)).toBe(String(n));
  },
  'pat.seq_nth'(it) {
    const t = shownTerms(it.kz), N = +/нөмірі (\d+)/.exec(it.kz)![1];
    expect(isArith(t)).toBe(true);
    expect(nums(it.ru)).toContain(N);
    let x = t[0]; for (let i = 1; i < N; i++) x += t[1] - t[0];
    expect(ans(it)).toBe(String(x));
  },
  'pat.seq_position'(it) {
    const t = shownTerms(it.kz), X = +/\.\.\. (\d+) саны/.exec(it.kz)![1];
    expect(isArith(t)).toBe(true);
    let x = t[0], pos = 1; while (x < X) { x += t[1] - t[0]; pos++; }
    expect(x).toBe(X);
    expect(ans(it)).toBe(String(pos));
  },
  'pat.seq_growing_diff'(it) {
    const t = shownTerms(it.kz), diffs = t.slice(1).map((x, i) => x - t[i]);
    expect(isArith(diffs)).toBe(true);
    const step = diffs[1] - diffs[0], want = it.kz.includes('жетінші') ? 7 : 6;
    expect(step).toBeGreaterThan(0);
    const s = [...t]; let d = diffs[diffs.length - 1];
    while (s.length < want) { d += step; s.push(s[s.length - 1] + d); }
    expect(ans(it)).toBe(String(s[want - 1]));
  },
  'pat.seq_interleaved'(it) {
    const t = shownTerms(it.kz);
    expect(t).toHaveLength(6);
    const odd = [t[0], t[2], t[4]], even = [t[1], t[3], t[5]];
    expect(isArith(odd) && isArith(even)).toBe(true);
    const want = ({ жетінші: 7, сегізінші: 8, тоғызыншы: 9 } as any)[/тізбектің (\S+) мүшесін/.exec(it.kz)![1]];
    const so = odd[1] - odd[0], se = even[1] - even[0];
    const term = (n: number) => (n % 2 ? odd[0] + so * ((n - 1) / 2) : even[0] + se * (n / 2 - 1));
    expect(ans(it)).toBe(String(term(want)));
  },
  'logic.cal_weekday_shift'(it) {
    const start = WD_KZ.indexOf(/Бүгін (\S+)\./.exec(it.kz)![1]), N = +/(\d+) күн/.exec(it.kz)![1];
    const fwd = it.kz.includes('кейін');
    expect(it.kz.includes('бұрын')).toBe(!fwd);
    // подходящая дата и пошаговый счёт по Date (UTC)
    const d = new Date(Date.UTC(2024, 0, 1)); while (d.getUTCDay() !== start) d.setUTCDate(d.getUTCDate() + 1);
    for (let i = 0; i < N; i++) d.setUTCDate(d.getUTCDate() + (fwd ? 1 : -1));
    expect(ans(it)).toBe(labelOf(d.getUTCDay()));
  },
  'logic.cal_days_between'(it) {
    const m = /(\d{4}) жылы (\d+) (\S+) (\d+) (\S+) дейін/.exec(it.kz)!;
    const y = +m[1], d1 = +m[2], m1 = MON_ABL.indexOf(m[3]) + 1, d2 = +m[4], m2 = MON_DAT.indexOf(m[5]) + 1;
    expect(m1).toBeGreaterThan(0); expect(m2).toBeGreaterThan(m1);
    expect(nums(it.ru)).toEqual([d1, d2, y]);
    const incl = it.kz.includes('қоса') ? 1 : 0;
    expect(it.ru.includes('считая оба дня')).toBe(!!incl);
    expect(ans(it)).toBe(String(Math.round((utc(y, m2, d2) - utc(y, m1, d1)) / 86400000) + incl));
  },
  'logic.cal_years_days'(it) {
    const [y1, y2] = nums(it.kz).filter(x => x > 1000);
    expect(nums(it.ru).filter(x => x > 1000)).toEqual([y1, y2]);
    expect(ans(it)).toBe(String(Math.round((utc(y2, 1, 1) - utc(y1, 1, 1)) / 86400000)));
  },
  'logic.cal_weekend_count'(it) {
    const [L] = nums(it.kz), f = WD_KZ.indexOf(/күні — (\S+)\./.exec(it.kz)![1]);
    expect(nums(it.ru)[0]).toBe(L);
    // пошагово: день недели по Date, начиная с реального дня с нужным днём недели
    const d = new Date(Date.UTC(2024, 0, 1)); while (d.getUTCDay() !== f) d.setUTCDate(d.getUTCDate() + 1);
    let c = 0; for (let i = 0; i < L; i++) { if (d.getUTCDay() === 0 || d.getUTCDay() === 6) c++; d.setUTCDate(d.getUTCDate() + 1); }
    expect(ans(it)).toBe(String(c));
  },
  'logic.cal_date_weekday'(it) {
    const m = /(\d{4}) жылы (\d+) (\S+) — (\S+)\. Сол жылғы (\d+) (\S+) аптаның/.exec(it.kz)!;
    const y = +m[1], d1 = +m[2], m1 = MON_NOM.indexOf(m[3]) + 1, d2 = +m[5], m2 = MON_NOM.indexOf(m[6]) + 1;
    expect(m1).toBeGreaterThan(0); expect(m2).toBeGreaterThan(0);
    // условие правдиво: день недели исходной даты по календарю
    expect(WD_KZ[new Date(utc(y, m1, d1)).getUTCDay()], it.kz).toBe(m[4]);
    expect(utc(y, m2, d2)).toBeGreaterThan(utc(y, m1, d1));
    expect(ans(it)).toBe(labelOf(new Date(utc(y, m2, d2)).getUTCDay()));
  },
  'vis.sq_grid'(it) {
    const [rows, cols] = nums(it.kz);
    const cells = cellsOf(it.figure!.svg);
    expect(cells.size).toBe(rows * cols);
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) expect(cells.has(`${r},${c}`)).toBe(true);
    expect(ans(it)).toBe(String(squaresOf(cells)));
    expect(nums(it.ru).slice(0, 2)).toEqual([rows, cols]);
  },
  'vis.sq_square_grid'(it) {
    const [n, n2, k] = nums(it.kz);
    expect(n2).toBe(n);
    const cells = cellsOf(it.figure!.svg);
    expect(cells.size).toBe(n * n);
    const sized = it.kz.includes('тең квадраттар');
    expect(ans(it)).toBe(String(squaresOf(cells, sized ? k : undefined)));
    expect(it.ru.includes('со стороной')).toBe(sized);
  },
  'vis.sq_shape'(it) {
    const cells = cellsOf(it.figure!.svg);
    expect(ans(it)).toBe(String(squaresOf(cells)));
    const n = nums(it.kz);
    if (it.kz.includes('баспалдақ')) {
      const N = n[n.length - 1];
      expect(cells.size).toBe(N * (N + 1) / 2);
      for (let c = 0; c < N; c++) expect([...cells].filter(s => +s.split(',')[1] === c)).toHaveLength(c + 1);
    } else if (it.kz.includes('қиып алынған')) {
      expect(cells.size).toBe(n[0] * n[0] - n[2] * n[2]);
    } else {
      expect(cells.size).toBe(n[0] * n[0] - 1);
      // условие явно говорит: считаем только квадраты из закрашенных клеток (квадрат над дыркой не считается)
      expect(it.kz).toContain('Тек боялған ұяшықтардан толық құралған');
      expect(it.ru).toContain('целиком составленные из закрашенных клеток');
      expect(it.ru).toContain('закрывающий пустое место, не считается');
    }
  },
};

const avoid = (glossary as any).terms.flatMap((t: any) => (t.avoid || []).map((a: string) => ({ a, kz: t.kz })));
const findAvoid = (text: string) =>
  avoid.filter(({ a }: any) => (a === a.toUpperCase() ? new RegExp(`(^|[^А-Яа-я])${a}([^А-Яа-я]|$)`) : new RegExp(`(^|[^а-яё])${a}`, 'i')).test(text));
const ASCII_MINUS = /(^|[^\wа-яәіңғүұқөһ])-\d/i;

describe('шаблоны logic7: перестановки, турнир, последовательности, календарь, квадраты', () => {
  it('19 новых шаблонов, у каждого проверка ответа; они привязаны к навыкам', () => {
    expect(T).toHaveLength(19);
    for (const t of T) {
      expect(VERIFY[t.id], t.id).toBeTypeOf('function');
      for (const sk of t.skills) expect(skillById[sk].templates, `${sk} не содержит ${t.id}`).toContain(t.id);
      expect(byId[t.id]).toBe(t);
    }
    expect(templates.length).toBeGreaterThan(100);
  });

  it('пять навыков: 5 класс, минимум 2 шаблона у каждого, шаблоны существуют', () => {
    for (const id of ['logic.permutations', 'logic.pairs_tournament', 'pat.sequences', 'logic.calendar', 'vis.count_squares']) {
      const s = skillById[id];
      expect(s.grade, id).toBe(5);
      expect(s.templates.length, id).toBeGreaterThanOrEqual(2);
      for (const tid of s.templates) expect(byId[tid], `${id} → ${tid}`).toBeTruthy();
    }
    expect(skillById['vis.count_squares'].figure).toBe(true);
  });

  for (const t of T) {
    describe(t.id, () => {
      it('устройство: 5 разных вариантов, метки, kz/ru, три подсказки, разбор', () => {
        const r = rng(2026);
        for (let i = 0; i < SEEDS; i++) {
          const it: Item = t.gen(r);
          expect(it.choices, it.kz).toHaveLength(5);
          expect(new Set(texts(it)).size, it.kz).toBe(5);
          expect(it.choices.filter(c => c.tag === 'correct'), it.kz).toHaveLength(1);
          expect(it.choices[it.answer].tag).toBe('correct');
          expect(it.kz.length).toBeGreaterThan(5); expect(it.ru.length).toBeGreaterThan(5);
          expect(it.sol.kz.length).toBeGreaterThan(5); expect(it.sol.ru.length).toBeGreaterThan(5);
          expect(JSON.stringify(it)).not.toMatch(/NaN|undefined|Infinity|null/);
          expect(it.hints).toHaveLength(3);
          for (const h of it.hints) { expect(h.kz.length).toBeGreaterThan(5); expect(h.ru.length).toBeGreaterThan(5); }
        }
      });
      it('ответ верен: пересчитан независимо (перебор, симуляция, Date)', () => {
        const r = rng(7);
        for (let i = 0; i < SEEDS; i++) VERIFY[t.id](t.gen(r));
      });
      it('подсказки не выдают ответ; разбор его содержит', () => {
        const r = rng(23);
        for (let i = 0; i < SEEDS; i++) {
          const it: Item = t.gen(r), a = ans(it), weekday = a.includes(' / ');
          const kzPart = weekday ? a.split(' / ')[0] : a, ruPart = weekday ? a.split(' / ')[1] : a;
          for (const h of it.hints) {
            if (weekday) {
              expect(h.kz.toLowerCase(), h.kz).not.toContain(kzPart); expect(h.ru.toLowerCase(), h.ru).not.toContain(ruPart);
            } else {
              expect(nums(h.kz), `${h.kz} | ответ ${a}`).not.toContain(+a); expect(nums(h.ru), `${h.ru} | ответ ${a}`).not.toContain(+a);
            }
          }
          expect(it.sol.kz).toContain(kzPart); expect(it.sol.ru).toContain(ruPart);
        }
      });
      it('нет слов из glossary.avoid, нет ASCII-минуса перед цифрой', () => {
        const r = rng(13);
        for (let i = 0; i < SEEDS; i++) {
          const it: Item = t.gen(r);
          const kz = [it.kz, it.sol.kz, t.title.kz, ...it.hints.map(h => h.kz), ...texts(it).map(x => x.split(' / ')[0])].join('\n');
          expect(findAvoid(kz).map((h: any) => `${h.a} → ${h.kz}`), kz.slice(0, 200)).toEqual([]);
          expect([kz, it.ru, it.sol.ru, ...it.hints.map(h => h.ru)].join('\n')).not.toMatch(ASCII_MINUS);
        }
      });
      it('метки ошибок известны в misconceptions.mjs', () => {
        const r = rng(17), seen = new Set<string>();
        for (let i = 0; i < SEEDS; i++) for (const c of (t.gen(r) as Item).choices) seen.add(c.tag);
        for (const tag of seen) if (tag !== 'correct' && tag !== 'random') expect((MISCONCEPTIONS as any)[tag], `${t.id}: нет разбора для «${tag}»`).toBeTruthy();
        expect([...seen].filter(x => x !== 'correct').length).toBeGreaterThanOrEqual(3);
      });
      it('разнообразие условий', () => {
        const r = rng(19), stems = new Set<string>();
        for (let i = 0; i < 400; i++) { const it: Item = t.gen(r); stems.add(it.kz + '|' + texts(it).join('|')); }
        expect(stems.size).toBeGreaterThanOrEqual(40);
      });
    });
  }

  it('рисунки квадратов: SVG без подписей и без числа ответа, только клетки', () => {
    const r = rng(31);
    for (const id of ['vis.sq_grid', 'vis.sq_square_grid', 'vis.sq_shape']) for (let i = 0; i < 100; i++) {
      const it: Item = byId[id].gen(r);
      expect(it.figure?.kind).toBe('svg');
      expect(it.figure!.svg).toMatch(/^<svg /);
      expect(it.figure!.svg).not.toMatch(/<text|<script/);
      expect(cellsOf(it.figure!.svg).size).toBeGreaterThan(3);
      expect((it.figure!.svg.match(/<rect /g) || []).length).toBe(cellsOf(it.figure!.svg).size);
    }
  });

  it('квадрат с дыркой: у пустой клетки нет ни заливки, ни линий; ответ = квадраты только из закрашенных клеток, и он не равен счёту «над дыркой»', () => {
    const r = rng(53); let holes = 0;
    for (let i = 0; i < 200; i++) {
      const it: Item = byId['vis.sq_shape'].gen(r);
      if (!it.kz.includes('бос орын көрінеді')) continue;
      holes++;
      const svg = it.figure!.svg, cells = cellsOf(svg), N = nums(it.kz)[0];
      // единственная пустая клетка
      const hole = [...Array(N * N).keys()].map(k => [Math.floor(k / N), k % N]).filter(([a, b]) => !cells.has(`${a},${b}`));
      expect(hole).toHaveLength(1);
      const [hr, hc] = hole[0], X = hc * 26 + 2, Y = hr * 26 + 2;
      // пути линий: разбираем отрезки «M x y h/v L» и проверяем, что ни один не лежит на границе дырки
      const segs: number[][] = [];
      for (const m of svg.matchAll(/M(\d+) (\d+)([hv])(\d+)/g)) { const x = +m[1], y = +m[2], L = +m[4]; segs.push(m[3] === 'h' ? [x, y, x + L, y] : [x, y, x, y + L]); }
      expect(segs.length).toBeGreaterThan(0);
      const holeEdges = [[X, Y, X + 26, Y], [X, Y + 26, X + 26, Y + 26], [X, Y, X, Y + 26], [X + 26, Y, X + 26, Y + 26]];
      for (const e of holeEdges) expect(segs.some(s => s.join() === e.join()), 'у дырки нарисован край').toBe(false);
      expect(svg).not.toContain(`x="${X}" y="${Y}"`);
      // независимый полный перебор: квадрат считается, только если все его клетки закрашены
      let only = 0, covering = 0;
      for (let k = 1; k <= N; k++) for (let r0 = 0; r0 + k <= N; r0++) for (let c0 = 0; c0 + k <= N; c0++) {
        covering++;
        let ok = true; for (let a = 0; a < k; a++) for (let b = 0; b < k; b++) if (!cells.has(`${r0 + a},${c0 + b}`)) ok = false;
        if (ok) only++;
      }
      expect(ans(it)).toBe(String(only));
      expect(only).toBeLessThan(covering);
    }
    expect(holes).toBeGreaterThan(20);
  });

  it('лесенка: «1, 2, 3» при n = 3 без многоточия, при n > 3 — «1, 2, ..., n»', () => {
    const r = rng(59); let n3 = 0, big = 0;
    for (let i = 0; i < 300; i++) {
      const it: Item = byId['vis.sq_shape'].gen(r);
      if (!it.kz.includes('баспалдақ')) continue;
      const N = nums(it.kz).at(-1)!;
      if (N === 3) { n3++; expect(it.kz).toContain('1, 2, 3 ұяшық'); expect(it.ru).toContain('1, 2, 3 клеток'); expect(it.kz + it.ru).not.toContain('...'); }
      else { big++; expect(it.kz).toContain(`1, 2, ..., ${N} ұяшық`); expect(it.ru).toContain(`1, 2, ..., ${N} клеток`); }
    }
    expect(n3).toBeGreaterThan(5); expect(big).toBeGreaterThan(5);
  });

  it('квадраты: типичная ошибка «только 1×1» присутствует в вариантах', () => {
    const r = rng(37);
    for (const id of ['vis.sq_grid', 'vis.sq_shape']) {
      let seen = false;
      for (let i = 0; i < 100; i++) if ((byId[id].gen(r) as Item).choices.some(c => c.tag === 'only_unit_squares')) seen = true;
      expect(seen, id).toBe(true);
    }
  });

  it('календарь: ошибки с недельным кругом, високосным годом и длиной месяцев встречаются', () => {
    const r = rng(41), tags = new Set<string>();
    for (const id of ['logic.cal_weekday_shift', 'logic.cal_days_between', 'logic.cal_years_days', 'logic.cal_date_weekday'])
      for (let i = 0; i < 300; i++) for (const c of (byId[id].gen(r) as Item).choices) tags.add(c.tag);
    for (const x of ['off_by_one', 'wrong_direction', 'quotient_not_remainder', 'leap_ignored', 'month_length_30', 'month_length_31']) expect(tags.has(x), x).toBe(true);
  });

  it('тексты для новых меток на двух языках и без слов из avoid', () => {
    const r = rng(43), tags = new Set<string>();
    for (const t of T) for (let i = 0; i < 100; i++) for (const c of (t.gen(r) as Item).choices) tags.add(c.tag);
    for (const tag of tags) {
      if (tag === 'correct' || tag === 'random') continue;
      const m = (MISCONCEPTIONS as any)[tag];
      expect(m.kz.length, tag).toBeGreaterThan(10); expect(m.ru.length, tag).toBeGreaterThan(10);
      expect(findAvoid(m.kz), tag).toEqual([]);
    }
  });
});
