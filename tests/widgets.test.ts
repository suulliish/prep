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

describe('FracArea: чистые функции и уроки недели 6', () => {
  it('пересечение закрашенных столбцов и строк = произведение числителей; площадь произведения', async () => {
    const { overlap, areaProduct, sliceOk } = await import('../src/widgets/fracarea');
    expect(overlap([true, false], [true, true, true, false])).toBe(3);        // 1/2 · 3/4: 3 клетки из 8
    expect(overlap([false, false], [true, true])).toBe(0);
    expect(areaProduct({ n: 1, d: 2 }, { n: 3, d: 4 })).toEqual({ cells: { n: 3, d: 8 }, reduced: { n: 3, d: 8 } });
    expect(areaProduct({ n: 2, d: 3 }, { n: 3, d: 4 })).toEqual({ cells: { n: 6, d: 12 }, reduced: { n: 1, d: 2 } });
    expect(sliceOk(4, 3, { n: 3, d: 4 })).toBe(true);
    expect(sliceOk(8, 6, { n: 3, d: 4 })).toBe(false);                        // эквивалентная нарезка не подходит
  });
  it('«сколько поместится»: 3 : 1/4 = 12, 3 : 3/4 = 4; кусок переходит через строку', async () => {
    const { fitInfo, fitCanPlace, fitDone, fitCells } = await import('../src/widgets/fracarea');
    expect(fitInfo(3, { n: 1, d: 4 })).toEqual({ total: 12, max: 12, rest: 0 });
    expect(fitInfo(3, { n: 3, d: 4 })).toEqual({ total: 12, max: 4, rest: 0 });
    expect(fitCanPlace(11, 3, { n: 1, d: 4 })).toBe(true);
    expect(fitCanPlace(12, 3, { n: 1, d: 4 })).toBe(false);
    expect(fitDone(4, 3, { n: 3, d: 4 })).toBe(true);
    expect(fitDone(3, 3, { n: 3, d: 4 })).toBe(false);
    expect(fitCells(1, { n: 3, d: 4 })).toEqual([{ row: 0, col: 3 }, { row: 1, col: 0 }, { row: 1, col: 1 }]);
    expect(fitInfo(2, { n: 3, d: 4 })).toEqual({ total: 8, max: 2, rest: 2 }); // неровно: остаток клеток
  });
  it('часть числа и число по части', async () => {
    const { partUnit, unitChoices } = await import('../src/widgets/fracarea');
    expect(partUnit(40, 5)).toBe(8);
    expect(partUnit(40, 3)).toBeNull();
    expect(unitChoices(35, 5)).toEqual([5, 7, 35]);
    expect(unitChoices(25, 5)).toEqual([5, 25]);                               // без дублей
  });
  it('все виджеты уроков недели 6 получают допустимые props: куски делят бүтін нацело, части делят число', async () => {
    const { WEEK6 } = (await import('../content/lessons_week6.mjs')) as any;
    let seen = 0;
    for (const [id, list] of Object.entries(WEEK6) as [string, any[]][]) {
      for (const s of list.filter(x => x.type === 'widget' && x.w === 'FracArea')) {
        const p = s.props; seen++;
        if (p.mode === 'fit') expect((p.whole * p.piece.d) % p.piece.n, id).toBe(0);
        if (p.mode === 'part') { expect(p.total % p.target.d, id).toBe(0); expect(p.target.d).toBeLessThanOrEqual(10); }
        if (p.mode === 'whole') { expect(p.known % p.frac.n, id).toBe(0); expect(p.frac.d).toBeLessThanOrEqual(12); }
        if (p.mode === 'mul') { expect(p.a.d).toBeLessThanOrEqual(8); expect(p.b.d).toBeLessThanOrEqual(8); }
      }
    }
    expect(seen).toBeGreaterThanOrEqual(6);
  });
});

describe('TreeBuilder / GridSquares: чистые функции и уроки недели 7', () => {
  it('permtree: число листьев и размер дерева', async () => {
    const t = await import('../src/widgets/permtree');
    expect(t.permCount(3, 3)).toBe(6); expect(t.permCount(4, 2)).toBe(12); expect(t.permCount(7, 3)).toBe(210);
    expect(t.pairCount(4)).toBe(6); expect(t.pairCount(7)).toBe(21);
    expect(t.levelCounts(5, 3)).toEqual([5, 4, 3]);
    const a = t.buildTree(3, 3);
    expect(a.leaves).toBe(6); expect(a.nodes.length).toBe(1 + 3 + 6 + 6);
    const b = t.buildTree(4, 2);
    expect(b.leaves).toBe(12); expect(b.nodes.length).toBe(1 + 4 + 12);
    // ни в одном пути нет повторов
    for (const x of a.nodes) expect(new Set(x.path).size).toBe(x.path.length);
    // у родителя строка посередине детей
    const root = a.byId.get('r')!; expect(root.row).toBe(2.5);
  });
  it('permtree: видимость, раскрытие и «полное дерево»', async () => {
    const t = await import('../src/widgets/permtree');
    const tr = t.buildTree(3, 3);
    expect([...t.visibleIds(tr, new Set())]).toEqual(['r']);
    expect(t.visibleIds(tr, new Set(['r'])).size).toBe(4);
    // закрытый родитель прячет открытого потомка
    expect(t.visibleIds(tr, new Set(['0'])).size).toBe(1);
    expect(t.canOpen(tr, 'r')).toBe(true); expect(t.canOpen(tr, '0-1-2')).toBe(false);
    expect(t.treeComplete(tr, new Set(['r']))).toBe(false);
    const all = t.openAll(tr, new Set());
    expect(t.treeComplete(tr, all)).toBe(true);
    expect(t.visibleLeaves(tr, t.visibleIds(tr, all))).toBe(6);
  });
  it('permtree: близнецы и касание листа в режиме пар', async () => {
    const t = await import('../src/widgets/permtree');
    const tr = t.buildTree(4, 2);
    expect(t.twinId(tr, '0-2')).toBe('2-0'); expect(t.twinId(tr, 'r')).toBeNull(); expect(t.twinId(t.buildTree(3, 3), '0-1-2')).toBeNull();
    const kept = new Set<string>(), struck = new Set<string>();
    expect(t.tapLeaf(tr, kept, struck, '0-2')).toBe('keep');
    expect([...kept]).toEqual(['0-2']); expect([...struck]).toEqual(['2-0']);
    expect(t.tapLeaf(tr, kept, struck, '0-2')).toBe('already');
    expect(t.tapLeaf(tr, kept, struck, '2-0')).toBe('struck');
    // если пройти все листья, оставленных ровно n(n−1)/2
    for (const x of tr.nodes.filter(n => n.depth === 2)) t.tapLeaf(tr, kept, struck, x.id);
    expect(kept.size).toBe(6); expect(struck.size).toBe(6);
    expect(t.leafLabel(tr, '1-3', ['А', 'Б', 'В', 'Г'])).toBe('БГ');
  });
  it('gridsquares: число шаршылар в торе', async () => {
    const g = await import('../src/widgets/gridsquares');
    expect(g.totalSquares(3, 3)).toBe(14); expect(g.totalSquares(4, 4)).toBe(30); expect(g.totalSquares(5, 5)).toBe(55);
    expect(g.totalSquares(4, 2)).toBe(11); expect(g.totalSquares(5, 3)).toBe(26);
    expect(g.sideList(5, 3)).toEqual([1, 2, 3]);
    expect(g.countOfSide(4, 4, 2)).toBe(9); expect(g.countOfSide(4, 4, 5)).toBe(0);
    // угол влезает только внутрь
    expect(g.fits(3, 3, 2, 1, 1)).toBe(true); expect(g.fits(3, 3, 2, 2, 0)).toBe(false); expect(g.fits(3, 3, 3, 0, 0)).toBe(true); expect(g.fits(3, 3, 1, -1, 0)).toBe(false);
    expect(g.corners(4, 4, 2).length).toBe(9); expect(g.corners(5, 3, 3).length).toBe(3);
    for (const c of g.corners(5, 3, 2)) expect(g.fits(5, 3, 2, c.r, c.c)).toBe(true);
    // следующая сторона по кругу, null когда всё готово
    expect(g.nextSide(3, 3, 1, s => s === 1)).toBe(2);
    expect(g.nextSide(3, 3, 3, s => s === 1)).toBe(2);
    expect(g.nextSide(3, 3, 2, () => true)).toBeNull();
  });
  it('уроки недели 7: параметры виджетов допустимы и ведут к нужному ответу', async () => {
    const { WEEK7 } = (await import('../content/lessons_week7.mjs')) as any;
    const { permCount, pairCount } = await import('../src/widgets/permtree');
    const { totalSquares } = await import('../src/widgets/gridsquares');
    let seen = 0;
    for (const [id, list] of Object.entries(WEEK7) as [string, any[]][]) {
      for (const s of list.filter(x => x.type === 'widget')) {
        const p = s.props; seen++;
        if (s.w === 'TreeBuilder') {
          const k = p.mode === 'pairs' ? 2 : (p.k ?? p.items.length);
          expect(p.items.length, id).toBeLessThanOrEqual(4);
          expect(permCount(p.items.length, k), id).toBeLessThanOrEqual(12);         // дерево помещается по высоте
          expect(new Set(p.items).size, id).toBe(p.items.length);
          if (p.mode === 'pairs') expect(pairCount(p.items.length), id).toBeGreaterThan(0);
        }
        if (s.w === 'GridSquares') expect(totalSquares(p.w, p.h ?? p.w), id).toBeGreaterThan(3);
        if (s.w === 'OrderOps') expect(p.expr.length % 2, id).toBe(1);
        if (s.w === 'DivideGame') expect(p.n % p.divisors[0], id).not.toBe(0);       // остаток нужен: он и есть сдвиг дня
      }
    }
    expect(seen).toBe(9);
  });
});
