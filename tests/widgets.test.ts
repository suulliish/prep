import { describe, it, expect } from 'vitest';
// Опечатка в имени виджета или сцены не даёт ошибки: в уроке просто пустое место. Эти тесты читают текст Lesson.svelte и Scene.svelte.
import lessonSrc from '../src/screens/Lesson.svelte?raw';
import sceneSrc from '../src/lesson/Scene.svelte?raw';
import {
  gcd, reduce, eq, cmp, add, sum, val, toMixed, splitFractions, parseFrac, sectorPath, boundary, stars, snap, tween, denColor,
} from '../src/widgets/fracdraw';

const WIDGET_FILES = Object.keys(import.meta.glob('../src/widgets/*.svelte')).map(f => f.split('/').pop()!.replace('.svelte', ''));
const mods = import.meta.glob('../content/lessons*.mjs', { eager: true }) as Record<string, Record<string, unknown>>;

/** Все шаги всех уроков из content/lessons*.mjs (LESSONS и WEEK*: дубли не страшны). */
const steps: { id: string; s: any }[] = [];
for (const m of Object.values(mods)) for (const v of Object.values(m)) {
  if (v && typeof v === 'object') for (const [id, list] of Object.entries(v as Record<string, unknown>)) {
    if (Array.isArray(list)) for (const s of list) steps.push({ id, s });
  }
}

const mapNames = (src: string, re: RegExp) => {
  const m = re.exec(src); expect(m, 'блок найден в исходнике').toBeTruthy();
  return m![1].split(',').map(x => x.trim().split(':')[0].trim()).filter(Boolean);
};
const WIDGETS = mapNames(lessonSrc, /const WIDGETS[^=]*=\s*\{([^}]*)\}/);
const SCENES = mapNames(sceneSrc, /const MAP[^=]*=\s*\{([^}]*)\}/);

describe('регистрация виджетов и сцен', () => {
  it('уроки найдены', () => expect(steps.length).toBeGreaterThan(50));

  it('каждый widget-шаг ссылается на виджет из WIDGETS в Lesson.svelte', () => {
    const used = new Set(steps.filter(x => x.s.type === 'widget').map(x => x.s.w as string));
    expect(used.size).toBeGreaterThan(0);
    for (const w of used) expect(WIDGETS, `виджет ${w}`).toContain(w);
  });

  it('каждый файл из src/widgets зарегистрирован и импортирован в Lesson.svelte', () => {
    for (const w of WIDGET_FILES) {
      expect(WIDGETS, `${w} нет в WIDGETS`).toContain(w);
      expect(lessonSrc, `${w}: нет import`).toContain(`from '../widgets/${w}.svelte'`);
    }
    for (const w of WIDGETS) expect(WIDGET_FILES, `${w}: нет файла`).toContain(w);
  });

  it('каждая сцена из уроков есть в MAP в Scene.svelte', () => {
    const used = new Set<string>();
    for (const { s } of steps) {
      if (s.scene) used.add(s.scene);
      for (const f of s.frames ?? []) if (f.scene) used.add(f.scene);
    }
    expect(used.size).toBeGreaterThan(0);
    for (const sc of used) expect(SCENES, `сцена ${sc}`).toContain(sc);
  });

  it('каждая сцена из MAP импортирована', () => {
    for (const sc of SCENES) expect(sceneSrc, `${sc}: нет import`).toContain(`from './scenes/${sc}.svelte'`);
  });
});

describe('дроби: арифметика', () => {
  it('gcd / reduce', () => {
    expect(gcd(12, 18)).toBe(6); expect(gcd(7, 1)).toBe(1); expect(gcd(0, 5)).toBe(5);
    expect(reduce({ n: 6, d: 12 })).toEqual({ n: 1, d: 2 });
    expect(reduce({ n: 0, d: 5 })).toEqual({ n: 0, d: 1 });
  });
  it('eq: эквивалентные дроби', () => {
    expect(eq({ n: 1, d: 2 }, { n: 2, d: 4 })).toBe(true);
    expect(eq({ n: 3, d: 4 }, { n: 9, d: 12 })).toBe(true);
    expect(eq({ n: 2, d: 3 }, { n: 3, d: 4 })).toBe(false);
    expect(eq({ n: 5, d: 4 }, { n: 10, d: 8 })).toBe(true);
  });
  it('cmp: 2/3 < 3/4, 1/2 = 2/4, 5/4 > 1', () => {
    expect(cmp({ n: 2, d: 3 }, { n: 3, d: 4 })).toBe(-1);
    expect(cmp({ n: 1, d: 2 }, { n: 2, d: 4 })).toBe(0);
    expect(cmp({ n: 5, d: 4 }, { n: 1, d: 1 })).toBe(1);
  });
  it('add / sum: 1/2 + 1/3 = 5/6; 1/2 + 1/3 + 1/6 = 1; пустая сумма = 0', () => {
    expect(add({ n: 1, d: 2 }, { n: 1, d: 3 })).toEqual({ n: 5, d: 6 });
    expect(sum([{ n: 1, d: 2 }, { n: 1, d: 3 }, { n: 1, d: 6 }])).toEqual({ n: 1, d: 1 });
    expect(sum([{ n: 1, d: 4 }, { n: 1, d: 4 }])).toEqual({ n: 1, d: 2 });
    expect(sum([])).toEqual({ n: 0, d: 1 });
    expect(eq(sum([{ n: 3, d: 4 }, { n: 1, d: 4 }]), { n: 1, d: 1 })).toBe(true);
  });
  it('перебор моста: 1/2 + 1/3 + 1/4 > 1', () => {
    expect(cmp(sum([{ n: 1, d: 2 }, { n: 1, d: 3 }, { n: 1, d: 4 }]), { n: 1, d: 1 })).toBe(1);
  });
  it('val / toMixed', () => {
    expect(val({ n: 3, d: 4 })).toBe(0.75);
    expect(toMixed({ n: 11, d: 4 })).toEqual({ whole: 2, n: 3, d: 4 });
    expect(toMixed({ n: 8, d: 4 })).toEqual({ whole: 2, n: 0, d: 1 });
    expect(toMixed({ n: 3, d: 4 })).toEqual({ whole: 0, n: 3, d: 4 });
  });
});

describe('дроби в строках (MathLine, Tiles)', () => {
  const fr = (whole: number | null, n: number, d: number) => ({ t: 'frac', whole, n, d });
  it('простая и смешанная', () => {
    expect(splitFractions('3/4')).toEqual([fr(null, 3, 4)]);
    expect(splitFractions('2 3/4')).toEqual([fr(2, 3, 4)]);
    expect(splitFractions('1/2 + 1/3 = 5/6')).toEqual([
      fr(null, 1, 2), { t: 'text', s: ' + ' }, fr(null, 1, 3), { t: 'text', s: ' = ' }, fr(null, 5, 6),
    ]);
  });
  it('смешанное число не склеивается с чужим знаком', () => {
    expect(splitFractions('5 + 2 3/4')).toEqual([{ t: 'text', s: '5 + ' }, fr(2, 3, 4)]);
    expect(splitFractions('3/4 − 1/4 = 1/2')).toHaveLength(5);
  });
  it('суффикс после дроби остаётся текстом', () => {
    expect(splitFractions('3/4-ті')).toEqual([fr(null, 3, 4), { t: 'text', s: '-ті' }]);
  });
  it('не дроби: 1/2/3, десятичные, деление на ноль, обычный текст без косой', () => {
    expect(splitFractions('1/2/3')).toEqual([{ t: 'text', s: '1/2/3' }]);
    expect(splitFractions('0.5/2')).toEqual([{ t: 'text', s: '0.5/2' }]);
    expect(splitFractions('3/0')).toEqual([{ t: 'text', s: '3/0' }]);
    expect(splitFractions('40 : 4 = ▢')).toEqual([{ t: 'text', s: '40 : 4 = ▢' }]);
    expect(splitFractions('')).toEqual([]);
  });
  it('parseFrac', () => {
    expect(parseFrac('3/4')).toEqual({ whole: null, n: 3, d: 4 });
    expect(parseFrac('2 3/4')).toEqual({ whole: 2, n: 3, d: 4 });
    expect(parseFrac('34')).toBeNull(); expect(parseFrac('3/0')).toBeNull(); expect(parseFrac('a/b')).toBeNull();
  });
});

describe('геометрия и вспомогательное', () => {
  it('sectorPath: пустой сектор, полный круг, обычный', () => {
    expect(sectorPath(100, 100, 80, 0, 0)).toBe('');
    expect(sectorPath(100, 100, 80, 0, Math.PI * 2)).toMatch(/a80 80 0 1 0/);
    expect(sectorPath(100, 100, 80, 0, Math.PI / 2)).toMatch(/^M100 100L100\.00 20\.00A80 80 0 0 1 180\.00 100\.00Z$/);
    expect(sectorPath(100, 100, 80, 0, Math.PI * 1.5)).toMatch(/ 0 1 1 /);
  });
  it('boundary: старые и новые границы; лишние схлопываются в конец', () => {
    expect(boundary(1, 2, 4, 0)).toBeCloseTo(Math.PI);
    expect(boundary(1, 2, 4, 1)).toBeCloseTo(Math.PI / 2);
    expect(boundary(3, 2, 4, 0)).toBeCloseTo(Math.PI * 2);
    expect(boundary(4, 4, 2, 1)).toBeCloseTo(Math.PI * 2);
  });
  it('stars: чем ближе, тем больше звёзд', () => {
    expect(stars(0.0, 0.04)).toBe(3); expect(stars(0.04, 0.04)).toBe(3); expect(stars(0.08, 0.04)).toBe(2);
    expect(stars(0.15, 0.04)).toBe(1); expect(stars(0.5, 0.04)).toBe(0);
  });
  it('snap: к делениям 1/den и в пределах окна', () => {
    expect(snap(0.62, 4, 0, 1)).toBe(0.5);
    expect(snap(0.66, 4, 0, 1)).toBe(0.75);
    expect(snap(0.62, 8, 0, 1)).toBe(0.625);
    expect(snap(-0.3, 4, 0, 1)).toBe(0);
    expect(snap(9, 4, 0, 3)).toBe(3);
    expect(snap(0.62, 0, 0, 1)).toBe(0.62);
    expect(snap(2.1, 4, 2, 3)).toBe(2.0);
  });
  it('tween с нулевой длительностью сразу отдаёт 1 и вызывает done', () => {
    let t = -1, ok = false; tween(0, x => (t = x), () => (ok = true));
    expect(t).toBe(1); expect(ok).toBe(true);
  });
  it('denColor различает соседние знаменатели', () => {
    expect(denColor(2)).not.toBe(denColor(3));
    expect(denColor(1)).toBe(denColor(13));
  });
});

// ---------- Красный отряд: чистая логика NumberLine и FractionBar (модульный <script module> в самих виджетах) ----------
describe('NumberLine: проверка постановки и выстрела', () => {
  it('den=4, цель 1/3: деление 1/4 не засчитывается, сама цель засчитывается', async () => {
    const { placeTol, placedOK, onGridOf } = (await import('../src/widgets/NumberLine.svelte')) as any;
    const f = { n: 1, d: 3 }, tv = 1 / 3, tol = placeTol({ den: 4, onGrid: onGridOf(f, 4), archer: false, target: tv });
    expect(onGridOf(f, 4)).toBe(false);
    expect(tol).toBeLessThan(0.5 / 4);
    expect(placedOK(0.25, tv, tol)).toBe(false);
    expect(placedOK(0.5, tv, tol)).toBe(false);
    expect(placedOK(1 / 3, tv, tol)).toBe(true);
    expect(placedOK(0.34, tv, tol)).toBe(true);
  });
  it('ни одно деление 1/den не засчитывается за цель между делениями (den 2..16, цели n/d до 3)', async () => {
    const { placeTol, placedOK, onGridOf } = (await import('../src/widgets/NumberLine.svelte')) as any;
    let checked = 0;
    for (let den = 2; den <= 16; den++) for (let d = 2; d <= 16; d++) for (let n = 1; n < 3 * d; n++) {
      const f = { n, d }, tv = n / d, og = onGridOf(f, den), tol = placeTol({ den, onGrid: og, archer: false, target: tv });
      expect(tol, `den=${den} ${n}/${d}`).toBeLessThan(0.5 / den);
      const hits: number[] = [];
      for (let k = 0; k <= 3 * den; k++) if (placedOK(k / den, tv, tol)) hits.push(k);
      // на делении: засчитывается только оно само; между делениями: ни одно
      expect(hits, `den=${den} цель ${n}/${d}`).toEqual(og ? [(n * den) / d] : []);
      expect(placedOK(tv, tv, tol)).toBe(true); checked++;
    }
    expect(checked).toBeGreaterThan(3000);
  });
  it('явный tolerance не превышает полуделения при заданном den; без den остаётся как задан', async () => {
    const { placeTol } = (await import('../src/widgets/NumberLine.svelte')) as any;
    expect(placeTol({ den: 4, onGrid: false, archer: false, tolerance: 0.5 })).toBeLessThan(0.125);
    expect(placeTol({ den: 4, onGrid: true, archer: false, tolerance: 0.2 })).toBeLessThan(0.125);
    expect(placeTol({ onGrid: false, archer: false, tolerance: 0.2 })).toBe(0.2);
    expect(placeTol({ onGrid: false, archer: true })).toBe(0.04);
  });
  it('выстрел с несдвинутого маркера не даёт звёзд (null), сдвинутый оценивается по расстоянию', async () => {
    const { shotStars, TAP_LOCK_MS } = (await import('../src/widgets/NumberLine.svelte')) as any;
    expect(shotStars(false, 0, 0.75, 0.04)).toBeNull();
    expect(shotStars(false, 0.75, 0.75, 0.04)).toBeNull();   // даже если маркер случайно на цели: без прицеливания выстрела нет
    expect(shotStars(true, 0.75, 0.75, 0.04)).toBe(3);
    expect(shotStars(true, 0, 0.75, 0.04)).toBe(0);
    expect(TAP_LOCK_MS).toBeGreaterThanOrEqual(400);
  });
});

describe('FractionBar: режим equal без target', () => {
  it('«×2, потом :2» возвращает исходный знаменатель и не засчитывается; другая равная дробь засчитывается', async () => {
    const { equalDone } = (await import('../src/widgets/FractionBar.svelte')) as any;
    expect(equalDone({ startD: 3, nd: 6, ops: 1 })).toBe(false);          // одной операции мало
    expect(equalDone({ startD: 3, nd: 3, ops: 2 })).toBe(false);          // ×2 затем :2
    expect(equalDone({ startD: 4, nd: 4, ops: 4 })).toBe(false);
    expect(equalDone({ startD: 3, nd: 12, ops: 2 })).toBe(true);          // ×2 ×2
    expect(equalDone({ startD: 4, nd: 2, ops: 2 })).toBe(true);           // :2 — другой знаменатель
  });
  it('с target решает только знаменатель target.d', async () => {
    const { equalDone } = (await import('../src/widgets/FractionBar.svelte')) as any;
    expect(equalDone({ target: { d: 12 }, startD: 3, nd: 12, ops: 1 })).toBe(true);
    expect(equalDone({ target: { d: 12 }, startD: 3, nd: 6, ops: 5 })).toBe(false);
  });
});
