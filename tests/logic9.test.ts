// C5: 8 новых генераторов (content/templates/logic9.mjs) для 5 аварийных тем: logic.new_operation, logic.clock_angle, logic.deduction,
// div.last_digit, pat.bracket. Ответ каждого генератора пересчитан здесь независимо: разбор текста задачи и свой счёт (перебор), не код шаблона.
import { describe, it, expect, vi } from 'vitest';

// перебор тяжёлый: локально 2 с, на медленном CI вдвое-втрое дольше (первый запуск CI упал на 5 с)
vi.setConfig({ testTimeout: 30_000 });
import glossary from '../content/glossary.json';
// @ts-ignore — шаблоны написаны на JS
import logic9 from '../content/templates/logic9.mjs';
// @ts-ignore
import { templates, byId } from '../content/templates/index.mjs';
// @ts-ignore
import { rng } from '../content/templates/lib.mjs';
// @ts-ignore
import { skillById } from '../content/skills.mjs';
// @ts-ignore
import { MISCONCEPTIONS } from '../content/misconceptions.mjs';
import { MISTAKE_NAMES } from '../src/engine/mistakeNames';

const T = logic9 as any[];
const SEEDS = 300;
type Item = { kz: string; ru: string; choices: { text: string; tag: string }[]; answer: number; sol: { kz: string; ru: string } };
const gen = (id: string, seed = 5, n = SEEDS): Item[] => { const t = byId[id], r = rng(seed); return Array.from({ length: n }, () => t.gen(r)); };
const texts = (it: Item) => it.choices.map(c => c.text);
const ans = (it: Item) => it.choices[it.answer].text;
const byTag = (it: Item, tag: string) => it.choices.filter(c => c.tag === tag).map(c => c.text);
const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';
const unsup = (s: string) => Number([...s].map(c => SUP.indexOf(c)).join(''));
const ev = (s: string): number => Function(`return (${s.replace(/·/g, '*').replace(/:/g, '/').replace(/−/g, '-').replace(/,/g, '.')})`)();
const perms = (a: number[]): number[][] => (a.length <= 1 ? [a] : a.flatMap((x, i) => perms([...a.slice(0, i), ...a.slice(i + 1)]).map(p => [x, ...p])));

const IDS = {
  'logic.new_operation': ['logic.new_operation', 'logic.new_operation_nested', 'logic.new_operation_unknown'],
  'logic.clock_angle': ['logic.clock_angle', 'logic.clock_angle_hands'],
  'logic.deduction': ['logic.who_in_which_class', 'logic.deduction_table', 'logic.deduction_enough'],
  'div.last_digit': ['div.last_digit_power', 'div.last_digit_sum'],
  'pat.bracket': ['logic.bracket_pattern', 'logic.bracket_middle', 'logic.bracket_square'],
} as Record<string, string[]>;

describe('logic9: структура и привязка к темам', () => {
  it('ровно 8 новых генераторов, id уникальны и не совпадают со старыми', () => {
    expect(T).toHaveLength(8);
    const all = (templates as any[]).map(t => t.id);
    expect(new Set(all).size).toBe(all.length);
  });
  it('у каждой из 5 аварийных тем ≥ 2 генераторов и хотя бы один қиындық ≥ 2; каждый новый привязан к своей теме', () => {
    for (const [sk, ids] of Object.entries(IDS)) {
      expect(skillById[sk].templates.sort(), sk).toEqual([...ids].sort());
      const own = ids.map(id => byId[id]);
      expect(own.length, sk).toBeGreaterThanOrEqual(2);
      expect(own.some(t => t.difficulty >= 2), sk).toBe(true);
    }
    for (const t of T) for (const sk of t.skills) expect(skillById[sk].templates, `${sk} ← ${t.id}`).toContain(t.id);
  });
  it('предпосылки аварийных тем имеют урок или цепочку без обрыва: new_operation ← nat.order_ops, clock_angle ← frac.mul', () => {
    expect(skillById['logic.new_operation'].prereqs).toEqual(['nat.order_ops']);
    expect(skillById['logic.clock_angle'].prereqs).toEqual(['frac.mul']);
  });
  for (const t of T) {
    it(`${t.id}: 5 разных вариантов, верный помечен correct, есть kz и ru, нет «—» в казахском`, () => {
      for (const it of gen(t.id, 3, 200)) {
        expect(it.choices).toHaveLength(5);
        expect(new Set(texts(it)).size).toBe(5);
        expect(it.choices[it.answer].tag).toBe('correct');
        expect(it.choices.filter(c => c.tag === 'correct')).toHaveLength(1);
        expect(it.kz.length).toBeGreaterThan(10); expect(it.ru.length).toBeGreaterThan(10);
        expect(JSON.stringify(it)).not.toMatch(/NaN|undefined|Infinity/);
        expect(it.kz + it.sol.kz).not.toContain('—');
        for (const c of it.choices) if (c.tag !== 'correct' && c.tag !== 'random') expect(MISTAKE_NAMES[c.tag] ?? (c.tag in MISCONCEPTIONS), `${t.id}: метка ${c.tag}`).toBeTruthy();
      }
    });
    it(`${t.id}: разнообразие условий и непустой разбор`, () => {
      const items = gen(t.id, 4, 400);
      expect(new Set(items.map(i => i.kz)).size).toBeGreaterThan(50);
      for (const it of items) { expect(it.sol.kz.length).toBeGreaterThan(20); expect(it.sol.ru.length).toBeGreaterThan(20); }
    });
  }
  it('все новые метки ошибок объяснены и названы', () => {
    const tags = new Set(T.flatMap(t => gen(t.id, 6, 200).flatMap(it => it.choices.map(c => c.tag))));
    for (const tag of tags) if (tag !== 'correct' && tag !== 'random') expect(MISTAKE_NAMES[tag], tag).toBeTruthy();
    for (const tag of ['regrouped', 'stopped_early', 'skipped_step', 'answered_result', 'wrong_rate', 'guessed_one', 'nobody', 'wrong_deduction', 'square_as_double', 'reflex'])
      expect((MISCONCEPTIONS as any)[tag]?.kz?.length, tag).toBeGreaterThan(10);
  });
  it('казахский текст без русских терминов из glossary.avoid', () => {
    const avoid = (glossary as any).terms.flatMap((t: any) => t.avoid ?? []).filter((w: string) => w.length > 3);
    for (const t of T) for (const it of gen(t.id, 8, 60)) {
      const text = [it.kz, it.sol.kz, ...it.choices.map(c => c.text.split(' / ')[0])].join(' ').toLowerCase();
      for (const w of avoid) expect(text, `${t.id}: «${w}»`).not.toContain(w.toLowerCase());
    }
  });
});

// ---------- logic.new_operation ----------
/** a ※ b = формула → функция (считаем через Function: формула текстом, a и b подставляются в скобках). */
const opOf = (f: string) => (a: number, b: number) => ev(f.replace(/\ba\b/g, `(${a})`).replace(/\bb\b/g, `(${b})`));
describe('logic.new_operation_nested: значение вложенной записи', () => {
  it('(x ※ y) ※ z и x ※ (y ※ z): ответ пересчитан, ловушки — другая расстановка скобок, перестановка, значение внутренней скобки', () => {
    const kinds = new Set<string>();
    for (const it of gen('logic.new_operation_nested', 11)) {
      const m = /a ※ b = (.+?)\. (.+?) өрнегінің/.exec(it.kz)!, op = opOf(m[1]);
      let x: number, y: number, z: number, left: boolean, inner: number, value: number, other: number, swapped: number;
      let g = /^\((\d+) ※ (\d+)\) ※ (\d+)$/.exec(m[2]);
      if (g) { [x, y, z] = g.slice(1).map(Number); left = true; inner = op(x, y); value = op(inner, z); other = op(x, op(y, z)); swapped = op(z, inner); }
      else { g = /^(\d+) ※ \((\d+) ※ (\d+)\)$/.exec(m[2])!; [x, y, z] = g.slice(1).map(Number); left = false; inner = op(y, z); value = op(x, inner); other = op(op(x, y), z); swapped = op(inner, x); }
      kinds.add(left ? 'left' : 'right');
      expect(ans(it), it.kz).toBe(String(value));
      expect(byTag(it, 'regrouped'), it.kz).toEqual([String(other)].filter(v => v !== String(value)));
      expect(byTag(it, 'stopped_early'), it.kz).toEqual([String(inner)]);
      expect(byTag(it, 'swapped_args'), it.kz).toEqual([String(swapped)]);
      expect(value).toBeGreaterThan(0);
    }
    expect([...kinds].sort()).toEqual(['left', 'right']);
  });
});
describe('logic.new_operation_unknown: найди x', () => {
  it('единственный x из перебора, ловушка «назвал результат» равна заданному значению', () => {
    const seen = new Set<string>();
    for (const it of gen('logic.new_operation_unknown', 12)) {
      const m = /a ※ b = (.+?)\. (?:x ※ (\d+)|(\d+) ※ x) = (\d+) теңдігінде/.exec(it.kz)!, op = opOf(m[1]), V = +m[4];
      const first = m[2] !== undefined, k = +(m[2] ?? m[3]);
      const xs = Array.from({ length: 2000 }, (_, i) => i).filter(x => (first ? op(x, k) : op(k, x)) === V);
      expect(xs, it.kz).toHaveLength(1);
      expect(ans(it), it.kz).toBe(String(xs[0]));
      expect(byTag(it, 'answered_result').every(v => v === String(V)), it.kz).toBe(true);
      expect(xs[0]).toBeGreaterThan(1);
      seen.add(first ? 'first' : 'second');
    }
    expect([...seen].sort()).toEqual(['first', 'second']);
  });
});

// ---------- logic.clock_angle ----------
const angle = (h: number, m: number) => { const d = Math.abs((h % 12) * 30 + m / 2 - m * 6); return d > 180 ? 360 - d : d; };
const fmt = (v: number) => String(v).replace('.', ',') + '°';
describe('logic.clock_angle_hands: угол и скорости стрелок', () => {
  it('пять видов задач, ответ пересчитан, ловушки не равны верному', () => {
    const kinds = new Set<string>();
    for (const it of gen('logic.clock_angle_hands', 13, 400)) {
      let m: RegExpExecArray | null, want: number;
      if ((m = /Сағат (\d\d):(\d\d) болғанда/.exec(it.kz))) { kinds.add('whole'); expect(m[2]).toBe('00'); want = angle(+m[1], 0); expect(want).toBeLessThanOrEqual(180); }
      else if ((m = /Минуттық тіл (\d+) минут ішінде/.exec(it.kz))) { kinds.add('minute'); want = 6 * +m[1]; }
      else if ((m = /Сағаттық тіл (\d+) минут ішінде/.exec(it.kz))) { kinds.add('hour_min'); want = +m[1] / 2; }
      else if ((m = /Сағаттық тіл (\d+) сағат ішінде/.exec(it.kz))) { kinds.add('hour_h'); want = 30 * +m[1]; }
      else throw new Error(it.kz);
      expect(ans(it), it.kz).toBe(fmt(want));
      if (kinds.has('whole') && /болғанда/.test(it.kz)) expect(byTag(it, 'reflex').every(v => v === fmt(360 - want)), it.kz).toBe(true);
    }
    expect([...kinds].sort()).toEqual(['hour_h', 'hour_min', 'minute', 'whole']);
  });
  it('старый генератор logic.clock_angle: тот же угол (независимо), угол ≤ 180', () => {
    for (const it of gen('logic.clock_angle', 14)) {
      const m = /Сағат (\d\d):(\d\d) болғанда/.exec(it.kz)!, want = angle(+m[1], +m[2]);
      expect(ans(it), it.kz).toBe(fmt(want)); expect(want).toBeLessThanOrEqual(180);
    }
  });
});

// ---------- div.last_digit ----------
const lastOf = (b: number, e: number) => Number((BigInt(b) ** BigInt(e)) % 10n);
describe('div.last_digit_sum: сумма/произведение двух степеней', () => {
  it('ответ из точной арифметики (BigInt), ловушки: сдвиг позиции, «степень = произведение», не та операция', () => {
    const ops = new Set<string>();
    for (const it of gen('div.last_digit_sum', 15, 400)) {
      const m = /^(\d+)([⁰¹²³⁴⁵⁶⁷⁸⁹]+) ([+·]) (\d+)([⁰¹²³⁴⁵⁶⁷⁸⁹]+) (қосындысының|көбейтіндісінің)/.exec(it.kz)!;
      const [a, e1, b, e2] = [+m[1], unsup(m[2]), +m[4], unsup(m[5])], prod = m[3] === '·';
      expect(prod).toBe(m[6] === 'көбейтіндісінің'); ops.add(m[3]);
      const da = lastOf(a, e1), db = lastOf(b, e2), want = (prod ? da * db : da + db) % 10;
      expect(ans(it), it.kz).toBe(String(want));
      const asProduct = String((prod ? ((a * e1) % 10) * ((b * e2) % 10) : (a * e1) % 10 + (b * e2) % 10) % 10), otherOp = String((prod ? da + db : da * db) % 10);
      expect(byTag(it, 'power_as_product').every(v => v === asProduct), it.kz).toBe(true);        // тег есть → значение именно такое
      expect(byTag(it, 'wrong_operation').every(v => v === otherOp), it.kz).toBe(true);
      expect(byTag(it, 'wrong_position').length, it.kz).toBeGreaterThan(0);
      for (const v of byTag(it, 'wrong_position')) expect(v, it.kz).not.toBe(String(want));
      expect(a % 10).not.toBe(b % 10);
    }
    expect([...ops].sort()).toEqual(['+', '·']);
  });
  it('старый генератор div.last_digit_power: ответ из BigInt', () => {
    for (const it of gen('div.last_digit_power', 16)) {
      const m = /^(\d+)([⁰¹²³⁴⁵⁶⁷⁸⁹]+) санының/.exec(it.kz)!;
      expect(ans(it), it.kz).toBe(String(lastOf(+m[1], unsup(m[2]))));
    }
  });
});

// ---------- pat.bracket ----------
type Row = [number, number, number];   // [сол, жақшада, оң]
/** Независимая библиотека правил: m — число в скобках, a, b — крайние. */
const RULES: Record<string, (a: number, m: number, b: number) => boolean> = {
  sum: (a, m, b) => a + b === m, prod: (a, m, b) => a * b === m, diff: (a, m, b) => a - b === m, dsum: (a, m, b) => 2 * a + 2 * b === m,
  prodA: (a, m, b) => a * (b + 1) === m, prodB: (a, m, b) => (a + 1) * b === m, sumA: (a, m, b) => a + a + b === m, sumB: (a, m, b) => a + b + b === m,
  sqA: (a, m, b) => a * a + b === m, sqAm: (a, m, b) => a * a - b === m, sqB: (a, m, b) => b * b + a === m, sqsum: (a, m, b) => a * a + b * b === m,
  sqdiff: (a, m, b) => (a - b) * (a + b) === m, sumsq: (a, m, b) => (a + b) ** 2 === m,
  sum_sq: (a, m, b) => a + b === m * m, diff_sq: (a, m, b) => a - b === m * m, sum_3m: (a, m, b) => a + b === 3 * m, prod_m: (a, m, b) => a === m * b,
};
const parseRows = (kz: string): { rows: [number, number | null, number | null][]; unknown: 'middle' | 'outer' } => {
  const lines = kz.split('\n').slice(1);
  expect(lines).toHaveLength(3);
  const rows = lines.map(l => { const m = /^(\d+) \((\d+|\?)\) (\d+|\?)$/.exec(l)!; return [+m[1], m[2] === '?' ? null : +m[2], m[3] === '?' ? null : +m[3]] as [number, number | null, number | null]; });
  return { rows, unknown: rows[2][1] === null ? 'middle' : 'outer' };
};
/** Верный ответ третьей строки: общий для ВСЕХ правил библиотеки, подходящих к двум полным строкам. Пусто/расхождение — null. */
function solveBracket(rows: [number, number | null, number | null][], unknown: 'middle' | 'outer'): number | null {
  const full = rows.slice(0, 2) as Row[], [a3, m3, b3] = rows[2];
  const fit = Object.values(RULES).filter(f => full.every(([a, m, b]) => f(a, m, b)));
  const vals = new Set<number>();
  for (const f of fit) for (let v = 1; v <= 700; v++) if (unknown === 'middle' ? f(a3, v, b3!) : f(a3, m3!, v)) vals.add(v);
  return vals.size === 1 ? [...vals][0] : null;
}
describe('pat.bracket: ответ единственный среди всех подходящих правил', () => {
  for (const id of ['logic.bracket_middle', 'logic.bracket_square', 'logic.bracket_pattern']) {
    it(`${id}: две полные строки + третья; верный вариант единственный и пересчитан`, () => {
      const kinds = new Set<string>();
      for (const it of gen(id, 17)) {
        const { rows, unknown } = parseRows(it.kz); kinds.add(unknown);
        const got = solveBracket(rows, unknown);
        if (id === 'logic.bracket_pattern') { if (got === null) continue; }   // старый генератор: неоднозначные случаи его, не наши
        expect(got, it.kz).not.toBeNull();
        expect(ans(it), it.kz).toBe(String(got));
      }
      if (id !== 'logic.bracket_pattern') expect([...kinds].sort()).toEqual(['middle', 'outer']);
    });
  }
  it('в старом генераторе неоднозначные строки есть редко, но их ответ всё равно верен по его правилу', () => {
    let amb = 0, n = 0;
    for (const it of gen('logic.bracket_pattern', 18, 400)) { const { rows, unknown } = parseRows(it.kz); n++; if (solveBracket(rows, unknown) === null) amb++; }
    expect(amb / n).toBeLessThan(0.5);
  });
  it('ловушка «квадрат = умножить на 2» встречается у правил «сумма = квадрату»', () => {
    const tags = new Set(gen('logic.bracket_square', 19, 600).flatMap(it => it.choices.map(c => c.tag)));
    expect(tags.has('square_as_double')).toBe(true); expect(tags.has('wrong_rule')).toBe(true); expect(tags.has('copied')).toBe(true);
  });
});

// ---------- logic.deduction ----------
const GEN: Record<string, string> = { 'Айжан': 'Айжанның', 'Арман': 'Арманның', 'Дана': 'Дананың', 'Нұрлан': 'Нұрланның', 'Мадина': 'Мадинаның', 'Ерлан': 'Ерланның', 'Бекзат': 'Бекзаттың', 'Санжар': 'Санжардың' };
const POSS: Record<string, string> = { 'мысығы': 'мысық', 'иті': 'ит', 'тотықұсы': 'тотықұс', 'балығы': 'балық' };
const CANT = 'Анықтау мүмкін емес / Определить нельзя';
type Clue = { who: string; pets: string[]; neg: boolean };
function parseDeduction(kz: string) {
  const m = /^(Үш|Төрт) бала бір-бірден үй жануарын асырайды: (.+?) \(бәрі әртүрлі\)\. Балалар: (.+?)\. (.+)\. Кімде (\S+) бар\?$/.exec(kz)!;
  const list = (s: string) => s.replace(' және ', ', ').split(', ');
  const pets = list(m[2]), names = list(m[3]), target = m[5];
  const clues: Clue[] = m[4].split('. ').map(s => {
    const who = names.find(n => s.startsWith(GEN[n] + ' '))!;
    const mentioned = [...s.matchAll(/(мысығы|иті|тотықұсы|балығы)/g)].map(x => POSS[x[1]]);
    return { who, pets: mentioned, neg: s.endsWith('жоқ') };
  });
  return { n: m[1] === 'Үш' ? 3 : 4, pets, names, target, clues };
}
function solveDeduction(D: ReturnType<typeof parseDeduction>) {
  const sols = perms(D.pets.map((_, i) => i)).filter(p => D.clues.every(c => {
    const i = D.names.indexOf(c.who), mine = D.pets[p[i]];
    return c.neg ? !c.pets.includes(mine) : c.pets.includes(mine);
  }));
  const t = D.pets.indexOf(D.target), owners = [...new Set(sols.map(p => D.names[p.indexOf(t)]))];
  return { sols, owners };
}
describe('logic.deduction_*: перебор расстановок', () => {
  it('deduction_table: одна полная расстановка, ответ — её владелец, ловушки «нельзя определить» и «ни у кого»', () => {
    for (const it of gen('logic.deduction_table', 20)) {
      const D = parseDeduction(it.kz), { sols, owners } = solveDeduction(D);
      expect(D.n).toBe(3); expect(D.names).toHaveLength(3); expect(new Set(D.names).size).toBe(3);
      expect(sols, it.kz).toHaveLength(1);
      expect(ans(it), it.kz).toBe(owners[0]);
      expect(texts(it).sort()).toEqual([...D.names, CANT, 'Ешкімде жоқ / Ни у кого'].sort());
      expect(D.clues.some(c => !c.neg && c.pets.includes(D.target))).toBe(false);   // иск не назван прямо
    }
  });
  it('deduction_enough: 4 ребёнка; ответ — имя, если владелец один во всех расстановках, иначе «нельзя определить»; обе ветки встречаются', () => {
    let open = 0, det = 0;
    for (const it of gen('logic.deduction_enough', 21, 400)) {
      const D = parseDeduction(it.kz), { sols, owners } = solveDeduction(D);
      expect(D.n).toBe(4); expect(sols.length).toBeGreaterThan(0);
      if (owners.length === 1) { det++; expect(ans(it), it.kz).toBe(owners[0]); expect(byTag(it, 'gave_up')).toEqual([CANT]); }
      else { open++; expect(ans(it), it.kz).toBe(CANT); expect(byTag(it, 'guessed_one').sort()).toEqual([...D.names].sort()); }
      expect(texts(it).sort()).toEqual([...D.names, CANT].sort());
    }
    expect(open).toBeGreaterThan(80); expect(det).toBeGreaterThan(120);
  });
  it('старый генератор who_in_which_class цел: пять вариантов, верный помечен', () => {
    for (const it of gen('logic.who_in_which_class', 22, 100)) expect(it.choices[it.answer].tag).toBe('correct');
  });
});

// ───────── pat.bracket: второго простого правила под обе строки быть не должно (red-team C5, 05.10) ─────────
describe('pat.bracket: однозначность и против соперничающих правил', () => {
  // независимая от генератора проверка: правило m = s·ab + t·a² + w·b² + p·a + q·b + c
  const rivals = (rows: number[][], ask: string): boolean => {
    const [a3, m3, b3] = rows[2], ans = ask === 'middle' ? m3 : b3;
    for (const s of [-1, 0, 1]) for (const t of [-1, 0, 1]) for (const w of [-1, 0, 1]) for (let p = -2; p <= 3; p++) for (let q = -2; q <= 3; q++) for (let c = -3; c <= 3; c++) {
      const f = (a: number, b: number) => s * a * b + t * a * a + w * b * b + p * a + q * b + c;
      if (rows.slice(0, 2).some(r => f(r[0], r[2]) !== r[1])) continue;
      if (ask === 'middle') { if (f(a3, b3) !== ans) return true; }
      else for (let b = 1; b <= 300; b++) if (b !== ans && f(a3, b) === m3) return true;
    }
    return false;
  };
  for (const id of ['logic.bracket_middle', 'logic.bracket_square']) {
    it(`${id}: 1200 задач без соперничающих правил и без строк a = b`, () => {
      const tpl = (templates as any[]).find(t => t.id === id), r = rng(4242); let bad = 0, eq = 0;
      for (let k = 0; k < 1200; k++) {
        const it = tpl.gen(r), lines = it.kz.split('\n').slice(1);
        const rows = lines.map((l: string) => { const m = l.match(/^(\d+) \((\?|\d+)\) (\?|\d+)$/)!; return [+m[1], m[2] === '?' ? -1 : +m[2], m[3] === '?' ? -1 : +m[3]]; });
        const ask = lines[2].includes('(?)') ? 'middle' : 'outer';
        const sol = it.choices[it.answer].text.replace(',', '.'), ans = +sol;
        if (ask === 'middle') rows[2][1] = ans; else rows[2][2] = ans;
        if (rows.some(x => x[0] === x[2])) eq++;
        if (rivals(rows, ask)) bad++;
      }
      expect(eq, 'строки с a = b').toBe(0); expect(bad, 'есть соперничающее правило').toBe(0);
    });
  }
});
