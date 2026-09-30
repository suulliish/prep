import { describe, it, expect } from 'vitest';
import { GLITCH, solLines, buildGlitch, glitchAllowed, firstGlitchAt, nextGlitchAt, shortMistake, GLITCH_SAY, evalArith, checkLine, type GlitchCtx, type GlitchTurn } from '../src/engine/glitchturn';
// @ts-ignore
import { templates } from '../content/templates/index.mjs';
// @ts-ignore
import { rng } from '../content/templates/lib.mjs';
// @ts-ignore
import { MISCONCEPTIONS } from '../content/misconceptions.mjs';

const SEEDS = 60;

/** Независимая от модуля проверка «a = b»: обе части только из цифр и действий, считаем через Function. null — не разобрать. */
function indepEq(line: string): boolean | null {
  const m = line.replace(/^.*?\S:\s+/, '').replace(/^(?:\p{L}+,?\s+)+(?=\d)/u, '').match(/^([\d\s,+\-−·:()]+?)\s=\s(−?\d+(?:,\d+)?)\s*[.;]?$/u);
  if (!m) return null;
  const js = (x: string) => x.replace(/(\d),(\d)/g, '$1.$2').replace(/·/g, '*').replace(/:/g, '/').replace(/−/g, '-').replace(/\s+/g, '');
  try { const l = Function(`return (${js(m[1])})`)(), r = Number(js(m[2])); return Math.abs(l - r) < 1e-9 * Math.max(1, Math.abs(r)); } catch { return null; }
}

const OPS = /[·+−*:/×^-]/;
/** Каждое вхождение неверного значения в изменённой строке стоит на месте результата («= W», «Метка: W», «— W») и не участвует в действии. */
function wrongOnlyAsResult(g: GlitchTurn) {
  g.lines.forEach((l, i) => {
    if (l === g.good[i] || g.good[i].includes(g.wrong)) return;
    for (let at = l.indexOf(g.wrong); at >= 0; at = l.indexOf(g.wrong, at + 1)) {
      const before = l.slice(0, at).trimEnd(), after = l.slice(at + g.wrong.length).trimStart();
      expect(before, `перед «${g.wrong}» в «${l}»`).toMatch(/(=|:|—)$/);
      expect(OPS.test(after[0] ?? ''), `после «${g.wrong}» в «${l}»`).toBe(false);
      expect(/^[·+−*/×^]/.test(after) || /^:\s/.test(after), `после «${g.wrong}» в «${l}»`).toBe(false);
    }
  });
}

/** Для каждого шаблона: сколько из SEEDS задач дали ход, и проверка всех инвариантов на каждом ходе. */
function scan(t: any) {
  let ok = 0;
  for (let s = 1; s <= SEEDS; s++) {
    const r = rng(s * 7919 + 13);
    const it = t.gen(r);
    const g = buildGlitch(it, () => r.next());
    if (!g) continue;
    ok++;
    // 3–5 строк, строк столько же, сколько в «чистом» разборе
    expect(g.lines.length).toBeGreaterThanOrEqual(GLITCH.minLines);
    expect(g.lines.length).toBeLessThanOrEqual(GLITCH.maxLines);
    expect(g.good).toHaveLength(g.lines.length);
    // ровно одна первая неверная строка; до неё — всё как в верном разборе
    const diff = g.lines.map((l, i) => (l !== g.good[i] ? i : -1)).filter(i => i >= 0);
    expect(diff[0]).toBe(g.bad);
    expect(diff.slice(1)).toEqual(g.follows);
    expect(g.lines.slice(0, g.bad)).toEqual(g.good.slice(0, g.bad));
    // левая часть испорченной строки (данные, действия, левая часть «=») не тронута: меняется только результат
    expect(g.lines[g.bad].slice(0, g.at)).toBe(g.good[g.bad].slice(0, g.at));
    expect(g.good[g.bad].startsWith(g.right, g.at)).toBe(true);
    expect(g.lines[g.bad].startsWith(g.wrong, g.at)).toBe(true);
    // неверная строка отличается от верной, в ней стоит ответ-ловушка, в верной — верный результат
    expect(g.wrong).not.toBe(g.right);
    expect(g.wrong.length).toBeGreaterThan(0);
    // ловушка стоит только на месте результата: не в данных, не в разложении, не в проверке («24 = 528 · 528 · 3», «8 : 40 = 2»)
    wrongOnlyAsResult(g);
    for (const i of diff) {
      if (g.good[i].includes(g.wrong)) continue;   // число-ловушка уже есть в разборе: обратную подстановку проверить нельзя
      expect(g.lines[i].split(g.wrong).join(g.right)).toBe(g.good[i]);
    }
    // неверность видна глазами: в испорченной строке равенство не сходится, в исходной сходится
    expect(checkLine(g.lines, g.bad)).toBe(false);
    expect(checkLine(g.good, g.bad)).toBe(true);
    const ind = indepEq(g.lines[g.bad]);
    if (ind !== null) { expect(ind).toBe(false); expect(indepEq(g.good[g.bad])).toBe(true); }
    // остальные строки не стали арифметически ложными (следствие несёт неверный результат только там, где он «переносится», а не пересчитывается)
    g.lines.forEach((l, i) => { if (i !== g.bad && checkLine(g.good, i) !== false) expect(checkLine(g.lines, i), `строка ${i + 1}: «${l}»`).not.toBe(false); });
    // настоящая метка ошибки с настоящим объяснением
    expect(g.tag in MISCONCEPTIONS).toBe(true);
    expect(shortMistake(g.tag).length).toBeGreaterThan(10);
    expect(g.lines.join('\n')).not.toMatch(/NaN|undefined|null/);
    expect(g.follows.every(i => i > g.bad)).toBe(true);
  }
  return ok;
}

describe('ход «Глитчтің қатесі»: строки из разбора шаблона', () => {
  const rate: Record<string, number> = {};
  for (const t of templates as any[]) {
    it(`${t.id}: инварианты на ${SEEDS} задачах`, () => { rate[t.id] = scan(t) / SEEDS; });
  }

  it('поддержка: только проверяемые вычисления — почти всегда минимум у 30 шаблонов, хоть иногда — минимум у 45 (остальные дают обычный вопрос)', () => {
    const solid = Object.entries(rate).filter(([, v]) => v >= 0.9);
    const some = Object.entries(rate).filter(([, v]) => v > 0);
    expect(Object.keys(rate).length).toBe((templates as any[]).length);
    expect(solid.length).toBeGreaterThanOrEqual(30);
    expect(some.length).toBeGreaterThanOrEqual(45);
    expect(some.length).toBeGreaterThanOrEqual(solid.length);
    if (process.env.GLITCH_REPORT) {
      const skills = new Set<string>();
      for (const t of templates as any[]) if ((rate[t.id] ?? 0) >= 0.5) t.skills.forEach((s: string) => skills.add(s));
      console.log('шаблонов с ходом >=50%:', Object.values(rate).filter(v => v >= 0.5).length, 'из', Object.keys(rate).length,
        '| навыков:', skills.size, '\nбез хода:', Object.entries(rate).filter(([, v]) => v < 0.5).map(([k, v]) => `${k}=${v.toFixed(2)}`).join(', '));
    }
  });
});

describe('solLines: разбор на строки', () => {
  it('делит по предложениям и «;», без хвостового «;»', () => {
    expect(solLines('9 · 3 = 27; 11 + 27 = 38.')).toEqual(['9 · 3 = 27', '11 + 27 = 38.']);
    expect(solLines('Бір. Екі! Үш?')).toEqual(['Бір.', 'Екі!', 'Үш?']);
  });
  it('десятичная запятая и «1) …» не рвут строку', () => {
    expect(solLines('1) 160 · 0,2 = 32 тг. Қалды: 128 тг.')).toEqual(['1) 160 · 0,2 = 32 тг.', 'Қалды: 128 тг.']);
  });
  it('цепочка «a = b, c = d» делится по запятой, только если строк мало', () => {
    expect(solLines('4³ = 64, 7² = 49. Қосындысы: 113.')).toEqual(['4³ = 64', '7² = 49.', 'Қосындысы: 113.']);
    expect(solLines('a = 1. b = 2, c = 3. d = 4. e = 5.')).toHaveLength(4);
  });
});

describe('solLines: скобки и двоеточие-деление', () => {
  it('«;» внутри скобок не рвёт строку: ЕКОЕ(14; 20) = 140', () => {
    expect(solLines('ЕКОЕ(14; 20) = 140 минут. Бір. Екі.')).toEqual(['ЕКОЕ(14; 20) = 140 минут.', 'Бір.', 'Екі.']);
  });
  it('пояснение делится по «:», а деление « : » внутри выкладки — нет', () => {
    expect(solLines('Су үлесі: 5,4 : 6 · 100% = 90%.')).toEqual(['Су үлесі: 5,4 : 6 · 100% = 90%.']);
    expect(solLines('Бөлімдері бірдей, сондықтан алымдарын қосамыз: 5/6 + 2/6 = 7/6.')).toHaveLength(2);
  });
});

describe('solLines: короткий разбор', () => {
  it('цепочка «=» делится на шаги, скобки с «=» не режутся', () => {
    expect(solLines('C = 2πr = 2 · 3 · 60 = 360 см = 3,6 м (1 м = 100 см).')).toEqual(['C = 2πr', '= 2 · 3 · 60', '= 360 см', '= 3,6 м (1 м = 100 см).']);
  });
  it('«пояснение: выкладка» делится по двоеточию, если строк всё ещё мало', () => {
    expect(solLines('Бөлімдері бірдей, сондықтан алымдарын қосамыз: 5/6 + 2/6 = 7/6.')).toEqual(['Бөлімдері бірдей, сондықтан алымдарын қосамыз', '5/6 + 2/6 = 7/6.']);
  });
  it('если строк хватает, цепочки не режем', () => {
    expect(solLines('a = b = c. Екінші. Үшінші.')).toEqual(['a = b = c.', 'Екінші.', 'Үшінші.']);
  });
});

describe('buildGlitch: конкретные случаи', () => {
  const mk = (sol: string, ans: string, wrongs: [string, string][]) => ({
    sol: { kz: sol }, answer: 0,
    choices: [{ text: ans, tag: 'correct' }, ...wrongs.map(([text, tag]) => ({ text, tag }))],
  });
  it('результат в середине: порча в вычислении, следствие в «Демек», проверка с исходными числами не трогается', () => {
    const g = buildGlitch(mk('ЕКОЕ(9, 15) = 45. Демек, ортақ бөлім — 45. Тексеру: 45 : 9 = 5, 45 : 15 = 3.', '45', [['135', 'product_not_lcm'], ['3', 'confused_gcd']]), () => 0.5)!;
    expect(g.bad).toBe(0);
    expect(g.follows).toEqual([1]);
    expect(g.lines[0]).toMatch(/^ЕКОЕ\(9, 15\) = (135|3)\.$/);
    expect(g.lines[1]).toMatch(/^Демек, ортақ бөлім — (135|3)\.$/);
    expect(g.lines[2]).toBe('Тексеру: 45 : 9 = 5, 45 : 15 = 3.');
    expect(g.good[0]).toBe('ЕКОЕ(9, 15) = 45.');
  });
  it('«5» не находится внутри «15», «1/5» и «5-ке»', () => {
    const g = buildGlitch(mk('15 : 3 = 5. 3-ке бөлінеді, 1/5 бөлігі. Жауабы: 5.', '5', [['3', 'product_not_lcm']]), () => 0)!;
    expect(g.good[g.bad]).toBe('15 : 3 = 5.');
    expect(g.lines).toEqual(['15 : 3 = 3.', '3-ке бөлінеді, 1/5 бөлігі.', 'Жауабы: 3.']);
    expect(g.follows).toEqual([2]);
  });
  it('ответ входит в данные и разложение: портится только результат («24 = 528 · 528 · 3», «8 : 40 = 2», «16 : 1 = 1»)', () => {
    const g = buildGlitch(mk('24 = 2 · 2 · 2 · 3. 4 · 6 = 24. Тексеру: 24 : 4 = 6, 24 : 6 = 4. Жауабы: 24.', '24', [['528', 'product_not_lcm']]), () => 0)!;
    expect(g.lines).toEqual(['24 = 2 · 2 · 2 · 3.', '4 · 6 = 528.', 'Тексеру: 24 : 4 = 6, 24 : 6 = 4.', 'Жауабы: 528.']);
    expect(g.bad).toBe(1);
    expect(g.follows).toEqual([3]);
    const h = buildGlitch(mk('40 : 5 = 8. 8 : 1 = 8. Тексеру: 5 · 8 = 40, 40 : 8 = 5. Жауабы: 8.', '8', [['16', 'product_not_lcm']]), () => 0)!;
    expect(h.lines).toEqual(['40 : 5 = 16.', '8 : 1 = 8.', 'Тексеру: 5 · 8 = 40, 40 : 8 = 5.', 'Жауабы: 16.']);
    expect(h.follows).toEqual([3]);
  });
  it('ответ есть только среди перечисленных чисел или в «Жауабы:» без вычисления — хода нет, а не порча списка', () => {
    expect(buildGlitch(mk('4/14, 4/17, 4/9, 4/6, 4/7. Алымдары бірдей: бөлімі ең үлкен бөлшек ең кіші. Жауабы: 4/17.', '4/17', [['4/6', 'whole_number_bias']]), () => 0)).toBeNull();
    expect(buildGlitch(mk('181 ешбір кіші жай санға бөлінбейді. Қалғандары: 57 = 3 · 19. 87 = 3 · 29. 49 = 7 · 7.', '181', [['57', 'looks_prime']]), () => 0)).toBeNull();
    expect(buildGlitch(mk('Әр бөлшектің қашықтығы: 7/47 (0,149), 3/40 (0,075). Ең кіші қашықтық — 3/40. Жауабы: 3/40.', '3/40', [['7/47', 'bigger_denominator_bigger']]), () => 0)).toBeNull();
  });
  it('результата в разборе нет — строка «Жауабы» не выдумывается, хода нет', () => {
    expect(buildGlitch(mk('Бір қадам. Екінші қадам. Үшінші қадам.', '7/8', [['8/7', 'flipped_fraction']]), () => 0)).toBeNull();
  });
  it('единица измерения: «720 кг» ищется целиком, запасной вариант — число без единицы', () => {
    const g = buildGlitch(mk('Тұз: 8,4 кг. Масса: 840 кг. Су: 840 − 120 = 720. Барлығы 3 қадам.', '720 кг', [['840 кг', 'answered_total']]), () => 0)!;
    expect(g.lines[g.bad]).toBe('Су: 840 − 120 = 840.');
    expect(g.wrong).toBe('840');
  });
  it('цепочка «= …»: левая часть — в предыдущей строке, портится только последний результат', () => {
    const g = buildGlitch(mk('C = 2πr = 2 · 3 · 75 = 450 см.', '450 см', [['45 см', 'unit_slip']]), () => 0);
    // «C = 2πr»: слева от последнего «=» есть «2 · 3 · 75» — проверяемо
    expect(g === null || (g.lines.at(-1)!.startsWith('= 45') && g.lines.slice(0, -1).every((l, i) => l === g.good[i]))).toBe(true);
    const k = buildGlitch(mk('Онда k = 6,1 − 55,7 = −49,6. Қорытынды. Тағы бір жол.', '−49,6', [['−61,8', 'sign']]), () => 0)!;
    expect(k.lines[0]).toBe('Онда k = 6,1 − 55,7 = −61,8.');
  });
  it('нет ловушки с настоящей меткой ошибки — хода нет', () => {
    expect(buildGlitch(mk('а. б. в. 5.', '5', [['4', 'random'], ['3', 'arith']]))).toBeNull();
  });
  it('ловушка, при которой равенство остаётся верным (то же число иначе записанное), не берётся', () => {
    expect(buildGlitch(mk('6 : 2 = 3. а. б.', '3', [['3,0', 'product_not_lcm']]), () => 0)).toBeNull();
  });
  it('меньше трёх строк — хода нет', () => {
    expect(buildGlitch(mk('Жауабы: 5.', '5', [['4', 'product_not_lcm']]))).toBeNull();
  });
  it('длинный разбор сводится к пяти строкам', () => {
    const g = buildGlitch(mk('а: 1 + 1 = 2. б: 2 + 2 = 4. в: 4 + 4 = 8. г: 8 + 8 = 16. д: 16 + 16 = 32. е: 32 + 10 = 42. Жауабы: 42.', '42', [['24', 'flipped_fraction']]), () => 0)!;
    expect(g.lines.length).toBeLessThanOrEqual(GLITCH.maxLines);
    expect(g.lines.at(-1)).toBe('Жауабы: 24.');
    expect(g.lines.join(' ')).toContain('32 + 10 = 24');
    expect(g.lines.join(' ')).toContain('16 + 16 = 32');
  });
});

describe('«ход только там, где ошибка видна»: реальные шаблоны из красной команды', () => {
  const tpl = (id: string) => (templates as any[]).find(t => t.id === id);
  const turns = (id: string) => Array.from({ length: SEEDS }, (_, i) => { const r = rng((i + 1) * 7919 + 13); const it = tpl(id).gen(r); return buildGlitch(it, () => r.next()); });
  it('ответ выбирается из списка, разбор его не вычисляет: обычный вопрос вместо порчи списка данных', () => {
    for (const id of ['frac.compare_extreme', 'frac.magnitude_near', 'div.which_prime']) expect(turns(id).every(g => g === null), id).toBe(true);
  });
  it('ЕКОЕ = … без чисел в вычислении и цепочки единиц не портятся вслепую', () => {
    for (const g of [...turns('div.lcm_pair'), ...turns('geo.circumference_units')]) expect(g).toBeNull();
  });
  it('разложения и проверки: gcd_pair, eq.digit_move, logic.count_after_removal — ни одной порченой левой части и ни одной «дикой» строки', () => {
    for (const id of ['div.gcd_pair', 'eq.digit_move', 'logic.count_after_removal', 'div.trailing_zeros_product', 'pct.successive_parts', 'frac.lcd_factor', 'sets.venn3_none']) {
      for (const g of turns(id)) {
        if (!g) continue;
        wrongOnlyAsResult(g);
        expect(checkLine(g.lines, g.bad)).toBe(false);
      }
    }
  });
});

describe('evalArith и checkLine: арифметика, которую видит ребёнок', () => {
  it('действия, скобки, дроби, смешанные числа, степени, модуль, единицы', () => {
    expect(evalArith('(36 + 28) : 2')).toBe(32);
    expect(evalArith('9 · 10/3')).toBeCloseTo(30);
    expect(evalArith('8 : 1/8')).toBeCloseTo(64);
    expect(evalArith('2 3/5 + 1/5')).toBeCloseTo(2.8);
    expect(evalArith('4³ + 7²')).toBe(113);
    expect(evalArith('|−1,5| · 2')).toBe(3);
    expect(evalArith('ЕКОЕ(9; 15)')).toBe(45);
    expect(evalArith('ЕҮОБ(84, 60)')).toBe(12);
    expect(evalArith('3 · 2 500 000 см')).toBe(7500000);
    expect(evalArith('Қалды: 42 − 22')).toBe(20);
    expect(evalArith('Онда 4 / 40')).toBeCloseTo(0.1);
  });
  it('процент: как число (100% − 40%) и как доля (200 · 12%)', () => {
    expect(evalArith('100% − 40% − 20%')).toBe(40);
    expect(evalArith('200 · 12%', 'frac')).toBeCloseTo(24);
  });
  it('буквы, неизвестные слова, пустое — null', () => {
    expect(evalArith('3x + 2')).toBeNull();
    expect(evalArith('ЕКОЕ')).toBeNull();
    expect(evalArith('ad : b')).toBeNull();
    expect(evalArith('')).toBeNull();
    expect(evalArith('1 / 0')).toBeNull();
  });
  it('checkLine: верно, неверно, нечего проверять; продолжение цепочки берёт левую часть из предыдущей строки', () => {
    expect(checkLine(['7/11 + 2/11 = 9/11.'], 0)).toBe(true);
    expect(checkLine(['7/11 + 2/11 = 9/22.'], 0)).toBe(false);
    expect(checkLine(['Жауабы: 5.'], 0)).toBeNull();
    expect(checkLine(['ЕКОЕ = 198.'], 0)).toBeNull();
    expect(checkLine(['3/5 : 3 = 3/5 · 1/3', '= 3/15', '= 1/5.'], 2)).toBe(true);
    expect(checkLine(['3/5 : 3 = 3/5 · 1/3', '= 3/15', '= 1/4.'], 2)).toBe(false);
    expect(checkLine(['Қалды: 40 − 22 = 18 (1 м = 100 см).'], 0)).toBe(true);
    expect(checkLine(['ЕКОЕ(14; 20) = 140 минут.'], 0)).toBe(true);
    expect(checkLine(['ЕКОЕ(14; 20) = 150 минут.'], 0)).toBe(false);
  });
});

describe('когда выпадает ход', () => {
  const base: GlitchCtx = { idx: 4, total: 8, at: 3, attempts: 5, block: 'mixed', lastWave: false, mobHp: 3, revenge: false, rushTwin: false, check: false, real: false };
  it('не в первых двух вопросах и не раньше «созревания»', () => {
    expect(glitchAllowed({ ...base, idx: 0, at: 0 })).toBe(false);
    expect(glitchAllowed({ ...base, idx: 1, at: 0 })).toBe(false);
    expect(glitchAllowed({ ...base, idx: 2, at: 3 })).toBe(false);
    expect(glitchAllowed({ ...base, idx: 2, at: 2 })).toBe(true);
    expect(glitchAllowed(base)).toBe(true);
  });
  it('только по навыку, который ребёнок уже решал', () => {
    expect(glitchAllowed({ ...base, attempts: 0 })).toBe(false);
    expect(glitchAllowed({ ...base, attempts: GLITCH.minAttempts })).toBe(true);
  });
  it('реванш, «егіз», мини-проверка и настоящая задача экзамена — своё место вопроса', () => {
    for (const k of ['revenge', 'rushTwin', 'check', 'real'] as const) expect(glitchAllowed({ ...base, [k]: true })).toBe(false);
  });
  it('босс: последний удар и последний вопрос не отдаём ходу', () => {
    const boss = { ...base, block: 'boss', total: 10 };
    expect(glitchAllowed({ ...boss, lastWave: true, mobHp: 1 })).toBe(false);
    expect(glitchAllowed({ ...boss, lastWave: true, mobHp: 2 })).toBe(false);
    expect(glitchAllowed({ ...boss, lastWave: true, mobHp: 3 })).toBe(true);
    expect(glitchAllowed({ ...boss, idx: 9, at: 3 })).toBe(false);
    expect(glitchAllowed({ ...boss, lastWave: false, mobHp: 1 })).toBe(true);
  });
  it('следующий ход через 4–6 вопросов, первый — 3-й–5-й; два подряд не бывает', () => {
    for (let k = 0; k <= 10; k++) {
      const r = () => k / 10.01;
      const f = firstGlitchAt(r), n = nextGlitchAt(5, r);
      expect(f).toBeGreaterThanOrEqual(2); expect(f).toBeLessThanOrEqual(4);
      expect(n - 5).toBeGreaterThanOrEqual(GLITCH.gapMin); expect(n - 5).toBeLessThanOrEqual(GLITCH.gapMax);
    }
    // за 200 боёв по 10 вопросов ходов ≈ 1,5–2 на бой, и никогда подряд
    let total = 0;
    for (let b = 0; b < 200; b++) {
      let at = firstGlitchAt(), last = -9;
      for (let idx = 0; idx < 10; idx++) {
        if (glitchAllowed({ ...base, idx, total: 10, at, attempts: 9 })) { expect(idx - last).toBeGreaterThan(1); last = idx; at = nextGlitchAt(idx); total++; }
      }
    }
    expect(total / 200).toBeGreaterThan(1.3); expect(total / 200).toBeLessThan(2.2);
  });
});

describe('реплики', () => {
  it('короткое объяснение — одно предложение из misconceptions.mjs', () => {
    expect(shortMistake('added_denominators')).toBe('Бөлшектерді қосқанда бөлімдер қосылмайды: бөлім бөліктің өлшемін көрсетеді, ол өзгермейді.');
    expect(shortMistake('sign')).toContain('Таңбаға қара');
  });
  it('заголовок и вопрос — как в задании', () => {
    expect(GLITCH_SAY.title).toBe('Глитчтің қатесі!');
    expect(GLITCH_SAY.ask).toBe('Қате қай жолдан басталды?');
  });
});
