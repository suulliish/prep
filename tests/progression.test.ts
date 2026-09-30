// Симуляция ~60 учебных дней с настоящим планировщиком: когда каждая тема с уроком доходит до ребёнка
// и совпадает ли порядок с docs/PLAN.md (окт: натуральные/делимость; ноя: дроби + весы/нули; дек: умножение и деление дробей,
// часть от числа, комбинаторика, подсчёт фигур). Таблица «день → новые темы» пишется в scratchpad/progression.txt.
import { describe, it, expect } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { buildPlan, sequenceSlots, taught } from '../src/engine/planner';
import { refreshAvailability, recordAttempt, isDone, type SkillDef } from '../src/engine/progress';
import { addSchoolDays, isWeekday, iso, parse } from '../src/engine/dates';
import type { Save } from '../src/engine/types';
import { rng } from '../content/templates/lib.mjs';
// @ts-ignore
import { skills as SKILLS } from '../content/skills.mjs';
// @ts-ignore
import { LESSONS } from '../content/lessons.mjs';

// та же сборка определений, что в src/lib/store.svelte.ts (там нельзя импортировать: $state и localStorage)
const defs = (SKILLS as SkillDef[]).map(d => ({ ...d, lesson: !!(LESSONS as Record<string, any[]>)[d.id]?.some(s => s.type === 'goal') }));
const byId = Object.fromEntries(defs.map(d => [d.id, d]));
const lessoned = defs.filter(d => d.lesson).map(d => d.id);
const tplOf = (id: string) => byId[id]?.templates ?? [];

const START = '2026-09-28';      // понедельник, старт занятий
const DAYS = 60, ACCURACY = 0.85;

function fresh(): Save {
  return {
    version: 1, heroName: 'Муртаза', xp: 0, skills: {}, attempts: [], days: {},
    settings: { extraMissionCap: 4, extraTo: 'today', planMinutes: 40 },
    diagnosticDone: true, repairShop: [], coins: 0, shipOwned: [], shipPet: null,
  };
}

interface Result { intro: Record<string, number>; learned: Record<string, number>; rows: { n: number; date: string; blocks: string; newSkills: string[]; redo?: string }[]; save: Save }

/** Один учебный день как в приложении: план → урок (lessonDone) → блоки warmup/new/mixed через recordAttempt. */
function simulate(seed: number, accuracy: number, days = DAYS): Result {
  const R = rng(seed);
  const save = fresh();
  const intro: Record<string, number> = {}, learned: Record<string, number> = {};
  const rows: Result['rows'] = [];
  let date = START, n = 0;
  while (n < days) {
    if (!isWeekday(date)) { date = iso(new Date(parse(date).getTime() + 864e5)); continue; }
    n++;
    refreshAvailability(save, defs);                                   // session.svelte.ts: ensurePlan
    const plan = buildPlan(save, defs, date);
    const newSkills: string[] = [];
    for (const b of plan.blocks) {
      if (b.id === 'summary') continue;
      if (b.id === 'new' && b.lesson) {                                // Lesson.svelte: последний шаг урока → lessonDone
        const sk = b.skills[0];
        save.skills[sk].lessonDone = true;
        newSkills.push(sk); intro[sk] ??= n;
      }
      const seq = sequenceSlots(b.skills, b.items, tplOf, R.next);
      let idx = 0;
      for (const slot of seq) {
        const correct = R.next() < accuracy;
        const ev = recordAttempt(save, {
          at: 0, day: date, skill: slot.skill, source: slot.tpl ?? '', correct, hintLevel: 0, honest: true, timeMs: 9000,
          mode: b.id === 'new' ? 'practice' : b.id,
        });
        if (ev.includes('learned')) learned[slot.skill] ??= n;
        idx++;
        // Session.svelte next(): новый блок кончается, как только тема «үйренді» и заданы ≥ 6 вопросов
        if (b.id === 'new' && save.skills[b.skills[0]]?.status === 'learned' && idx >= 6) break;
      }
      // completeBlock → refreshAvailability
      refreshAvailability(save, defs);
    }
    // день без нового урока: «новый» блок отдан теме, которая вернулась в learning после проваленной отложенной проверки (или тем нет вовсе)
    const nb = plan.blocks.find(b => b.id === 'new');
    rows.push({ n, date, blocks: plan.blocks.map(b => `${b.id}:${b.skills.length}`).join(' '), newSkills, redo: newSkills.length ? undefined : nb ? `${nb.skills[0]} (перезачёт после срыва проверки)` : 'нечего давать' });
    date = addSchoolDays(date, 1);
  }
  return { intro, learned, rows, save };
}

const out = resolve(__dirname, '../../progression.txt');
function report(r: Result, label: string) {
  const L: string[] = [`# ${label}: ${DAYS} учебных дней, точность ${ACCURACY * 100}%, старт ${START}`, '', 'день | дата       | новые темы (урок показан)', '-----|------------|--------------------------'];
  for (const row of r.rows) L.push(`${String(row.n).padStart(4)} | ${row.date} | ${row.newSkills.join(', ') || `(нового урока нет: ${row.redo})`}`);
  const missing = lessoned.filter(id => r.intro[id] === undefined);
  L.push('', `введено тем: ${lessoned.length - missing.length} из ${lessoned.length}`, missing.length ? `НЕ введены: ${missing.join(', ')}` : 'не введены: нет');
  L.push('', 'тема | введена (день) | «үйренді» (день)');
  for (const id of [...lessoned].sort((a, b) => (r.intro[a] ?? 999) - (r.intro[b] ?? 999))) L.push(`${id} | ${r.intro[id] ?? '—'} | ${r.learned[id] ?? '—'}`);
  return L.join('\n');
}

describe('прогрессия: дойдут ли новые уроки до ребёнка и в каком порядке', () => {
  const main = simulate(1, ACCURACY);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, report(main, 'основной прогон') + '\n');

  it('всего 35 тем с полным уроком, у каждой есть генераторы', () => {
    expect(lessoned).toHaveLength(35);
    for (const id of lessoned) expect(tplOf(id).length, id).toBeGreaterThan(0);
  });

  it('предпосылки каждой темы с уроком сами имеют урок (иначе цепочка обрывается)', () => {
    for (const id of lessoned) for (const p of byId[id].prereqs) expect(byId[p].lesson, `${id} ← ${p} без урока`).toBe(true);
  });

  it('(1) все 35 тем вводятся за 60 учебных дней', () => {
    const missing = lessoned.filter(id => main.intro[id] === undefined);
    expect(missing, `не дошли до ребёнка: ${missing.join(', ')}`).toEqual([]);
  });

  it('(2) ни одна тема не вводится раньше своих предпосылок (предпосылка «үйренді» раньше дня введения)', () => {
    for (const id of lessoned) for (const p of byId[id].prereqs) {
      expect(main.learned[p], `${p} не выучена, а ${id} введена в день ${main.intro[id]}`).toBeDefined();
      expect(main.learned[p], `${id} (день ${main.intro[id]}) введена раньше, чем выучена ${p} (день ${main.learned[p]})`).toBeLessThanOrEqual(main.intro[id]);
    }
  });

  it('(3) порядок по PLAN: делимость → дроби (база) → дроби (× ÷, часть, число по части); весы и нули не позже × ÷', () => {
    const d = main.intro;
    const last = (ids: string[]) => Math.max(...ids.map(i => d[i]));
    const first = (ids: string[]) => Math.min(...ids.map(i => d[i]));
    const oct = ['nat.place_value', 'nat.ops', 'nat.order_ops', 'nat.powers', 'div.rules', 'div.primes', 'div.factorization', 'div.gcd', 'div.lcm'];
    const fracBasics = ['frac.concept', 'frac.magnitude', 'frac.basic_property', 'frac.reduce', 'frac.common_denominator', 'frac.compare', 'frac.add_sub', 'frac.mixed'];
    const fracMulDiv = ['frac.mul', 'frac.div', 'frac.part_of_number', 'frac.find_whole'];
    const nov = ['logic.weighing', 'div.trailing_zeros'];
    const dec = ['logic.permutations', 'logic.pairs_tournament', 'vis.count_squares'];
    // делимость и НОД/НОК идут до сокращения и общего знаменателя (они от них зависят), база дробей — до × ÷
    expect(last(oct), 'октябрь до базы дробей: НОД/НОК раньше сокращения').toBeLessThan(d['frac.reduce']);
    expect(last(fracBasics), 'база дробей раньше × ÷ и части от числа').toBeLessThan(first(fracMulDiv));
    expect(last(nov), 'весы и нули не позже × ÷ (ноябрь, не декабрь)').toBeLessThanOrEqual(first(fracMulDiv));
    // фракции начинаются после блока делимости (октябрь), а не вперемешку с ним
    expect(first(fracBasics), 'дроби после всего блока делимости (ЕҮОБ, ЕКОЕ, задачи)').toBeGreaterThan(d['div.gcd_lcm_word']);
    // декабрь: комбинаторика идёт после цепочки × ÷ (part_of_number, find_whole), подсчёт фигур — не раньше конца базы дробей
    expect(d['logic.permutations'], 'комбинаторика после × ÷').toBeGreaterThan(last(fracMulDiv));
    expect(d['logic.pairs_tournament'], 'турнир после перестановок').toBeGreaterThan(d['logic.permutations']);
    expect(first(dec), 'комбинаторика и фигуры не раньше конца базы дробей').toBeGreaterThan(last(fracBasics));
  });

  it('устойчивость: другие зёрна при 85% и точность 95% — все темы доходят за 90 дней, предпосылки соблюдены', () => {
    for (const [seed, acc] of [[2, 0.85], [3, 0.85], [4, 0.95]] as const) {
      const r = simulate(seed, acc, 90);
      const missing = lessoned.filter(id => r.intro[id] === undefined);
      expect(missing, `точность ${acc}, зерно ${seed}: не введены ${missing.join(', ')}`).toEqual([]);
      for (const id of lessoned) for (const p of byId[id].prereqs) expect(r.learned[p], `${p} → ${id} при ${acc}`).toBeLessThanOrEqual(r.intro[id]);
    }
  });

  it('слабый ученик (70%): порядок и предпосылки те же, просто медленнее (итог пишется в файл)', () => {
    const r = simulate(5, 0.7, 90);
    for (const id of lessoned) if (r.intro[id] !== undefined) for (const p of byId[id].prereqs) expect(r.learned[p], `${p} → ${id}`).toBeLessThanOrEqual(r.intro[id]);
    const done = lessoned.filter(id => r.intro[id] !== undefined);
    writeFileSync(out, report(main, 'основной прогон') + `\n# для сравнения: точность 70%, 90 дней — введено ${done.length} из ${lessoned.length}; не введены: ${lessoned.filter(id => r.intro[id] === undefined).join(', ') || 'нет'}\n`);
    expect(done.length).toBeGreaterThanOrEqual(15);
  });

  it('темы введённого урока — «taught», а планировщик не даёт темы без урока', () => {
    for (const id of lessoned) expect(taught(main.save, defs, id)).toBe(main.intro[id] !== undefined);
    for (const id of Object.keys(main.intro)) expect(isDone(main.save.skills[id]) || main.save.skills[id].status === 'learning').toBe(true);
  });
});
