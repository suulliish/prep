import { describe, it, expect } from 'vitest';
import { GLITCH, solLines, buildGlitch, glitchAllowed, firstGlitchAt, nextGlitchAt, shortMistake, GLITCH_SAY, type GlitchCtx } from '../src/engine/glitchturn';
// @ts-ignore
import { templates } from '../content/templates/index.mjs';
// @ts-ignore
import { rng } from '../content/templates/lib.mjs';
// @ts-ignore
import { MISCONCEPTIONS } from '../content/misconceptions.mjs';

const SEEDS = 60;

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
    // неверная строка отличается от верной, в ней стоит ответ-ловушка и нет верного результата, в верной — наоборот
    expect(g.lines[g.bad]).not.toBe(g.good[g.bad]);
    expect(g.lines[g.bad]).toContain(g.wrong);
    expect(g.good[g.bad]).toContain(g.right);
    expect(g.wrong).not.toBe(g.right);
    expect(g.wrong.length).toBeGreaterThan(0);
    // числа согласованы: во всех порченых строках один и тот же неверный результат, остальное не тронуто
    for (const i of diff) {
      if (g.good[i].includes(g.wrong)) continue;   // число-ловушка уже есть в разборе: обратную подстановку проверить нельзя
      expect(g.lines[i].split(g.wrong).join(g.right)).toBe(g.good[i]);
    }
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

  it('поддержка: ход собирается почти всегда минимум у 45 шаблонов, хоть иногда — минимум у 70', () => {
    const solid = Object.entries(rate).filter(([, v]) => v >= 0.9);
    const some = Object.entries(rate).filter(([, v]) => v > 0);
    expect(Object.keys(rate).length).toBe((templates as any[]).length);
    expect(solid.length).toBeGreaterThanOrEqual(45);
    expect(some.length).toBeGreaterThanOrEqual(70);
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
  it('результат в середине: порча и следствие в следующей строке', () => {
    const g = buildGlitch(mk('ЕКОЕ(9, 15) = 45. Демек, ортақ бөлім — 45. Тексеру: 45 : 9 = 5, 45 : 15 = 3.', '45', [['135', 'product_not_lcm'], ['3', 'confused_gcd']]), () => 0.5)!;
    expect(g.bad).toBe(0);
    expect(g.follows).toEqual([1, 2]);
    expect(g.lines[0]).not.toContain('= 45');
    expect(g.lines[0]).toMatch(/= (135|3)\b/);
    expect(g.good[0]).toBe('ЕКОЕ(9, 15) = 45.');
  });
  it('«5» не находится внутри «15», «1/5» и «5-ке»', () => {
    const g = buildGlitch(mk('15 : 3 = 5. 3-ке бөлінеді, 1/5 бөлігі. Жауабы: 5.', '5', [['3', 'product_not_lcm']]), () => 0)!;
    expect(g.good[g.bad]).toBe('15 : 3 = 5.');
    expect(g.lines[0]).toBe('15 : 3 = 3.');
  });
  it('результата в разборе нет: в конец добавляется «Жауабы»', () => {
    const g = buildGlitch(mk('Бір қадам. Екінші қадам. Үшінші қадам.', '7/8', [['8/7', 'flipped_fraction']]), () => 0)!;
    expect(g.appended).toBe(true);
    expect(g.lines).toHaveLength(4);
    expect(g.good[3]).toBe('Жауабы: 7/8');
    expect(g.lines[3]).toBe('Жауабы: 8/7');
    expect(g.bad).toBe(3);
  });
  it('единица измерения: «720 кг» ищется целиком, запасной вариант — число без единицы', () => {
    const g = buildGlitch(mk('Тұз: 8,4 кг. Масса: 840 кг. Су: 840 − 120 = 720. Барлығы 3 қадам.', '720 кг', [['840 кг', 'answered_total']]), () => 0)!;
    expect(g.lines[g.bad]).toBe('Су: 840 − 120 = 840.');
    expect(g.wrong).toBe('840');
  });
  it('нет ловушки с настоящей меткой ошибки — хода нет', () => {
    expect(buildGlitch(mk('а. б. в. 5.', '5', [['4', 'random'], ['3', 'arith']]))).toBeNull();
  });
  it('меньше трёх строк — хода нет', () => {
    expect(buildGlitch(mk('Жауабы: 5.', '5', [['4', 'product_not_lcm']]))).toBeNull();
  });
  it('длинный разбор сводится к пяти строкам', () => {
    const g = buildGlitch(mk('а 1. б 2. в 3. г 4. д 5. е 6. ж 7. Жауабы: 42.', '42', [['24', 'flipped_fraction']]), () => 0)!;
    expect(g.lines.length).toBeLessThanOrEqual(GLITCH.maxLines);
    expect(g.lines.at(-1)).toBe('Жауабы: 24.');
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
    expect(GLITCH_SAY.ask).toBe('Қай жолда қате бар?');
  });
});
