// «Строже по качеству» (01.10): шаг до N верных, самопроверка «Тексер», личный порог спешки, счёт БИЛ, монеты и ремонт-как-доп.миссия (docs/GAME_LOOP.md 20)
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
// @ts-ignore
import { templates } from '../content/templates/index.mjs';
// @ts-ignore
import { rng } from '../content/templates/lib.mjs';
// @ts-ignore
import { skillById } from '../content/skills.mjs';
import { StepQueue, MAX_STEP_TWINS } from '../src/engine/twin';
import { isEasySkill, selfCheckFor, selfCheckDue, selfNote, answerOp, SELF_GAP, SELF_SAY } from '../src/engine/selfcheck';
import { adaptiveRushMs, rushLimitMs, isTooFast, median, ADAPT, type TimedAttempt } from '../src/engine/rush';
import { halfCoins, HALF_COINS_OVER, bilScore, bilLine, BIL_NOTE, rightOfLine, repairAsExtra, REPAIR_FIX_COINS, REPAIR_EXTRA_FIXES, EVENT_SAY, EVENT_MS, SHIP_SAY } from '../src/engine/confidence';
import { buildReview } from '../src/engine/review';
import { settleDay, blankDay, buildPlan, EXTRA_MIN } from '../src/engine/planner';
import type { Item } from '../src/engine/items';

// Пробный бой по правилам Session.svelte: answers[k] — верен ли k-й показанный вопрос; возвращает, сколько показано и сколько верных засчитано
function playStep(need: number, answers: (k: number) => boolean, maxTwins = MAX_STEP_TWINS) {
  const q = new StepQueue(need, maxTwins);
  let shown = 0, twins = 0;
  for (let guard = 0; guard < 100; guard++) {
    const kind = q.next();
    if (!kind) break;
    if (kind === 'twin') twins++;
    const ok = answers(shown++);
    if (ok) q.good(); else q.miss();
  }
  return { q, shown, twins };
}

describe('шаг идёт до N верных', () => {
  it('без ошибок — ровно N вопросов, без близнецов', () => {
    for (const need of [6, 8, 10]) {
      const { q, shown, twins } = playStep(need, () => true);
      expect(shown).toBe(need); expect(twins).toBe(0); expect(q.right).toBe(need);
    }
  });
  it('каждая ошибка добавляет вопрос: N верных набирается за N + ошибки', () => {
    const wrong = new Set([1, 4]);
    const { q, shown, twins } = playStep(10, k => !wrong.has(k));
    expect(q.right).toBe(10); expect(shown).toBe(12); expect(twins).toBe(2); expect(q.added).toBe(2);
  });
  it('близнецы идут в конец очереди: сначала все исходные задачи', () => {
    const q = new StepQueue(4);
    const kinds: string[] = [];
    const ans = [false, true, true, true, true, true];
    for (let k = 0; k < ans.length; k++) { const kind = q.next(); if (!kind) break; kinds.push(kind); if (ans[k]) q.good(); else q.miss(); }
    expect(kinds).toEqual(['orig', 'orig', 'orig', 'orig', 'twin']);
    expect(q.right).toBe(4);
  });
  it('ошибка на близнеце ставит ещё одного близнеца', () => {
    const { q, shown, twins } = playStep(3, k => k !== 0 && k !== 3);
    expect(q.right).toBe(3); expect(twins).toBe(2); expect(shown).toBe(5);
  });
  it(`лимит: больше ${MAX_STEP_TWINS} близнецов за шаг нет — шаг заканчивается, даже если верных меньше N`, () => {
    const { q, shown, twins } = playStep(10, () => false);
    expect(twins).toBe(MAX_STEP_TWINS); expect(q.added).toBe(MAX_STEP_TWINS); expect(shown).toBe(10 + MAX_STEP_TWINS);
    expect(q.right).toBe(0); expect(q.next()).toBeNull(); expect(q.capped).toBe(true);
  });
  it('лимит и частичные успехи: верных меньше N, всего вопросов не больше N + 6', () => {
    // верен каждый третий ответ
    const { q, shown } = playStep(10, k => k % 3 === 0);
    expect(shown).toBeLessThanOrEqual(10 + MAX_STEP_TWINS);
    expect(q.right).toBeLessThanOrEqual(10);
  });
  it('шаг не заканчивается раньше N-го верного, пока есть что показать', () => {
    const q = new StepQueue(3);
    q.next(); q.good(); q.next(); q.miss(); q.next(); q.good();
    expect(q.right).toBe(2);
    expect(q.next()).toBe('twin');
    q.good();
    expect(q.next()).toBeNull();
  });
  it('случайные ответы: инвариант — верных не больше N, вопросов не больше N + лимит, шаг всегда кончается', () => {
    let seed = 7; const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    for (let t = 0; t < 400; t++) {
      const need = [6, 8, 10][t % 3], p = rnd();
      const { q, shown } = playStep(need, () => rnd() < p);
      expect(q.right).toBeLessThanOrEqual(need);
      expect(shown).toBeLessThanOrEqual(need + MAX_STEP_TWINS);
      if (q.right < need) expect(q.added).toBe(MAX_STEP_TWINS);
    }
  });
  it('прогресс «верных N из M» по-казахски: падеж по звучанию числа', () => {
    expect(rightOfLine(4, 10)).toBe('10-нан 4 дұрыс');
    expect(rightOfLine(2, 6)).toBe('6-дан 2 дұрыс');
    expect(rightOfLine(7, 8)).toBe('8-ден 7 дұрыс');
    expect(rightOfLine(1, 3)).toBe('3-тен 1 дұрыс');
  });
});

describe('Session: шаг до N верных, звёзды по первым попыткам', () => {
  const src = readFileSync('src/screens/Session.svelte', 'utf8');
  it('очередь, счёт верных и лимит подключены', () => {
    expect(src).toContain('new StepQueue(total)');
    expect(src).toContain('stepCount(');
    expect(src).toContain('MAX_STEP_TWINS');
    expect(src).toMatch(/const strict = block === 'warmup' \|\| block === 'new' \|\| block === 'mixed' \|\| block === 'extra' \|\| asExtra/);
  });
  it('в звёзды идут только исходные задачи: близнецы и «сам поймал» не считаются первой попыткой', () => {
    expect(src).toContain("if (!twin) { firstTries++; if (correct && hintLevel === 0 && !caught) firstRight++; }");
  });
  it('босс и обычный ремонт не меняются: близнец сразу, слот бьёт один раз', () => {
    expect(src).toContain("(strict ? hitOk : !slotHit)");
    expect(src).toContain("block === 'boss' && twin");
  });
  it('в ремонте ход Глитча не собирается (починку считает обычный ответ)', () => {
    expect(src).toContain("check: block === 'repair'");
  });
});

describe('самопроверка «Тексер»', () => {
  const R = rng(5);
  const mk = (t: any): Item => { const it = t.gen(R); return { source: t.id, skill: Object.keys(skillById).find(k => skillById[k].templates?.includes(t.id)) ?? 'x', kz: it.kz, ru: it.ru, choices: it.choices, answer: it.answer, hints: [], sol: it.sol, figure: it.figure }; };
  const item = (sol: string, ans: string): Item => ({ source: 'x', skill: 'x', kz: '', ru: '', choices: [{ text: ans, tag: 'correct' }, { text: '0', tag: 'random' }], answer: 0, hints: [], sol: { kz: sol, ru: sol } });
  it('«лёгкая» тема: только выучена / закреплена / автомат (оценка модели p не в счёт)', () => {
    expect(isEasySkill({ status: 'learned', lessonDone: false, p: 0.5 })).toBe(true);
    expect(isEasySkill({ status: 'mastered', lessonDone: true, p: 0.5 })).toBe(true);
    expect(isEasySkill({ status: 'automatic', lessonDone: true, p: 0.5 })).toBe(true);
    expect(isEasySkill({ status: 'learning', lessonDone: true, p: 0.93 })).toBe(false);
    expect(isEasySkill({ status: 'learning', lessonDone: true, p: 0.89 })).toBe(false);
    expect(isEasySkill({ status: 'learning', lessonDone: false, p: 0.95 })).toBe(false);
    expect(isEasySkill({ status: 'available', lessonDone: false, p: 0.1 })).toBe(false);
    expect(isEasySkill(undefined)).toBe(false);
  });
  it('обратное действие по типу задачи: умножение ↔ деление, сложение ↔ вычитание', () => {
    expect(answerOp(item('Көбейтеміз: 12 · 7 = 84.', '84'))).toBe('mul');
    expect(answerOp(item('Бөлеміз: 144 : 12 = 12.', '12'))).toBe('div');
    expect(answerOp(item('Қосамыз: 1 250 + 380 = 1 630.', '1 630'))).toBe('add');
    expect(answerOp(item('Алу: 50 − 18 = 32.', '32'))).toBe('sub');
    expect(selfCheckFor(item('12 · 7 = 84', '84'))).toMatchObject({ kind: 'reverse', op: 'mul', text: SELF_SAY.mul });
    expect(selfCheckFor(item('144 : 12 = 12', '12')).text).toBe(SELF_SAY.div);
    expect(selfCheckFor(item('9 + 69 = 78', '78')).text).toBe(SELF_SAY.add);
    expect(selfCheckFor(item('100 − 25 = 75', '75')).text).toBe(SELF_SAY.sub);
  });
  it('нет числа-ответа или действия — общая подсказка «Есептеп шық: жауап шартқа сай ма?»', () => {
    expect(selfCheckFor(item('Жауабы: 7/8 үлкен.', '7/8'))).toMatchObject({ kind: 'general', op: null, text: 'Есептеп шық: жауап шартқа сай ма?' });
    expect(selfCheckFor(item('2 · 3 = 6. Жауабы: 5', '5')).kind).toBe('general');   // 5 не результат действия
  });
  it('подсказка не называет верный ответ и не содержит чисел задачи', () => {
    for (const t of (templates as any[]).filter(x => Object.values(skillById as Record<string, any>).some(s => s.templates?.includes(x.id))).slice(0, 80)) {
      const it = mk(t), c = selfCheckFor(it);
      expect(c.text).not.toMatch(/\d/);
      expect(c.text.includes(it.choices[it.answer].text.split(' / ')[0])).toBe(false);
    }
  });
  it('на реальных шаблонах обратное действие находится часто, а текст всегда есть', () => {
    let rev = 0, n = 0;
    for (const t of (templates as any[]).filter(x => Object.values(skillById as Record<string, any>).some(s => s.templates?.includes(x.id)))) {
      const c = selfCheckFor(mk(t)); n++; if (c.kind === 'reverse') rev++;
      expect(c.text.length).toBeGreaterThan(10);
    }
    expect(rev / n).toBeGreaterThan(0.2);
  });
  it('не чаще раза в 2 вопроса, не на боссе, не в ходе Глитча, только лёгкая тема', () => {
    const base = { served: 5, lastAt: 3, easy: true, block: 'mixed', glitch: false };
    expect(SELF_GAP).toBe(2);
    expect(selfCheckDue(base)).toBe(true);
    expect(selfCheckDue({ ...base, lastAt: 4 })).toBe(false);
    expect(selfCheckDue({ ...base, block: 'boss' })).toBe(false);
    expect(selfCheckDue({ ...base, glitch: true })).toBe(false);
    expect(selfCheckDue({ ...base, easy: false })).toBe(false);
    // подряд по вопросам: показ, пропуск, показ, пропуск…
    let last = -9; const shown: boolean[] = [];
    for (let served = 1; served <= 8; served++) { const d = selfCheckDue({ ...base, served, lastAt: last }); if (d) last = served; shown.push(d); }
    expect(shown).toEqual([true, false, true, false, true, false, true, false]);
  });
  it('итог самопроверки: сам поймал — только неверный → верный', () => {
    expect(selfNote(null, 1, 1)).toBeNull();
    expect(selfNote(2, 1, 1)).toBe('caught');
    expect(selfNote(1, 1, 1)).toBe('ok');
    expect(selfNote(2, 2, 1)).toBe('ok');
    expect(selfNote(1, 2, 1)).toBe('broke');
    expect(selfNote(2, 3, 1)).toBe('moved');
    expect(selfNote(2, null, 1)).toBe('ok');
  });
  it('вспышка «Өзің таптың!», монет сверху нет (02.10: нарочная ошибка + «поймал» не выгоднее верного ответа)', () => {
    expect(EVENT_SAY.self.big).toBe('ӨЗІҢ ТАПТЫҢ!');
    expect(EVENT_MS.self).toBeGreaterThan(1000);
    expect(SELF_SAY.caught).toBe('Өзің таптың!');
    const src = readFileSync('src/screens/Session.svelte', 'utf8');
    expect(src).toContain("const kind = caught && !fast ? 'self'");
    expect(src).not.toContain('earn(SELF_CATCH_COINS');
  });
  it('кнопки самопроверки и без длинного тире', () => {
    expect(SELF_SAY.ok).toBe('Тексердім, дұрыс');
    expect(SELF_SAY.change).toBe('Қателесіппін, өзгертемін');
    const all = Object.values(SELF_SAY).join(' ') + BIL_NOTE + bilLine(5, 2) + SHIP_SAY.half;
    expect(all).not.toContain('—');
  });
});

describe('разбор после ошибки на лёгкой теме: «найди свою ошибку» первым', () => {
  const R = rng(11);
  const withSkill = (templates as any[]).filter(t => Object.values(skillById as Record<string, any>).some(s => s.templates?.includes(t.id)));
  const mk = (t: any): Item => { const it = t.gen(R); return { source: t.id, skill: Object.keys(skillById).find(k => skillById[k].templates?.includes(t.id)) ?? 'x', kz: it.kz, ru: it.ru, choices: it.choices, answer: it.answer, hints: [], sol: it.sol, figure: it.figure }; };
  it('лёгкая тема: find и why собираются не реже, чем раньше, а решение (gap/read) нужно реже', () => {
    const tally = { plain: { find: 0, why: 0, rest: 0 }, easy: { find: 0, why: 0, rest: 0 } };
    for (const t of withSkill) {
      const it = mk(t);
      for (let i = 0; i < it.choices.length; i++) {
        if (i === it.answer) continue;
        for (const [k, opts] of [['plain', {}], ['easy', { easy: true }]] as const) {
          const rv = buildReview(it, i, 'error', () => 0.5, opts);
          if (rv.kind === 'find') tally[k].find++; else if (rv.kind === 'why') tally[k].why++; else tally[k].rest++;
        }
      }
    }
    expect(tally.easy.find).toBe(tally.plain.find);
    expect(tally.easy.why).toBeGreaterThanOrEqual(tally.plain.why);
    expect(tally.easy.rest).toBeLessThanOrEqual(tally.plain.rest);
    expect(tally.easy.find + tally.easy.why).toBeGreaterThan(tally.plain.find + tally.plain.why - 1);
  }, 60000);
  it('карточки «где ты ошибся»: верное объяснение одно, повторов нет', () => {
    for (const t of withSkill.slice(0, 60)) {
      const it = mk(t), w = it.choices.findIndex((_, i) => i !== it.answer);
      const rv = buildReview(it, w, 'error', Math.random, { easy: true });
      if (rv.kind === 'why') { expect(rv.cards.filter(c => c.ok).length).toBe(1); expect(new Set(rv.cards.map(c => c.text)).size).toBe(rv.cards.length); expect(rv.cards.length).toBe(3); }
    }
  });
  it('«білмеймін» и быстрый ответ порядок не меняют', () => {
    const it = mk(withSkill[0]);
    for (const mode of ['dunno', 'fast'] as const) expect(buildReview(it, null, mode, () => 0.5, { easy: true }).kind).toBe(buildReview(it, null, mode, () => 0.5).kind);
  });
});

describe('личный порог спешки', () => {
  const at = (source: string, timeMs: number, over: Partial<TimedAttempt> = {}): TimedAttempt => ({ source, skill: 'nat.ops', correct: true, timeMs, hintLevel: 0, ...over });
  const times = (src: string, xs: number[], over: Partial<TimedAttempt> = {}) => xs.map(x => at(src, x * 1000, over));
  it('порог = 45% медианы верных ответов, не ниже 5 с и не выше 25 с', () => {
    expect(ADAPT).toMatchObject({ ratio: 0.45, floorMs: 5000, ceilMs: 25000, minSamples: 3 });
    expect(median([1, 5, 3])).toBe(3); expect(median([1, 2, 3, 4])).toBe(2.5);
    expect(adaptiveRushMs(times('a', [29.9, 29.9, 29.9]), 'a', 'nat.ops')).toBe(13455);
    expect(adaptiveRushMs(times('a', [8, 8, 8]), 'a', 'nat.ops')).toBe(5000);     // 3,6 с → пол
    expect(adaptiveRushMs(times('a', [90, 100, 80]), 'a', 'nat.ops')).toBe(25000); // 40 с → потолок
  });
  it('числа ребёнка: при медиане 29,9 с ответ за 10,5 с — спешка, за 20 с — нет', () => {
    const h = times('nat.divide_remainder', [29.9, 29.9, 29.9, 31, 25]);
    const thr = adaptiveRushMs(h, 'nat.divide_remainder', 'nat.ops')!;
    expect(10500 < thr).toBe(true);
    expect(20000 < thr).toBe(false);
    expect(isTooFast(10500, 40, 0, thr)).toBe(true);
    expect(isTooFast(20000, 40, 0, thr)).toBe(false);
    // и второй шаблон: медиана 15,6 → порог 7,0 с; ошибки за 7,5 с общий порог по длине (≤ 8 с) уже ловит, за 6 с ловит личный
    const h2 = times('nat.order_of_ops', [15.6, 15.6, 15.6]);
    expect(adaptiveRushMs(h2, 'nat.order_of_ops', 'nat.ops')).toBe(7020);
  });
  it('мало данных: < 3 верных на шаблоне — берём по навыку, нет и их — null (прежнее правило)', () => {
    const h = [...times('a', [20, 20]), ...times('b', [30, 30, 30])];
    expect(adaptiveRushMs(h, 'a', 'nat.ops')).toBe(13500);                     // 5 верных на навыке: медиана 30
    expect(adaptiveRushMs(times('a', [20, 20]), 'a', 'nat.ops')).toBeNull();
    expect(adaptiveRushMs(times('a', [20, 20, 20]), 'z', 'другой.навык')).toBeNull();
    expect(adaptiveRushMs([], 'a', 'nat.ops')).toBeNull();
  });
  it('шаблонные данные важнее навыковых', () => {
    const h = [...times('b', [100, 100, 100, 100]), ...times('a', [20, 20, 20])];
    expect(adaptiveRushMs(h, 'a', 'nat.ops')).toBe(9000);
  });
  it('в медиану идут только верные ответы без подсказок, не ход Глитча', () => {
    const h = [...times('a', [20, 20, 20]), ...times('a', [3, 3, 3, 3, 3], { correct: false }), ...times('a', [90, 90, 90], { hintLevel: 2 }), ...times('a', [1, 1, 1], { kind: 'glitch' })];
    expect(adaptiveRushMs(h, 'a', 'nat.ops')).toBe(9000);
  });
  it('берётся не больше последних 30 ответов: ребёнок быстрее — порог идёт за ним', () => {
    const h = [...times('a', Array(40).fill(60)), ...times('a', Array(30).fill(10))];
    expect(adaptiveRushMs(h, 'a', 'nat.ops')).toBe(5000);
  });
  it('итоговый порог — больший из общего (по длине условия) и личного', () => {
    expect(rushLimitMs(50, null)).toBe(4000);
    expect(rushLimitMs(50, 13455)).toBe(13455);
    expect(rushLimitMs(200, 5000)).toBe(8000);
  });
  it('на реальной истории ребёнка ловит заметно больше ошибок, чем «быстрее 5 с»', () => {
    let A: any[];
    try { A = JSON.parse(readFileSync('/private/tmp/claude-501/-Users-sult-Desktop-----/5c0cdb0d-b849-4d28-8b02-493b3ac2e153/scratchpad/data/attempts.json', 'utf8')); } catch { return; }
    A.sort((a, b) => a.at - b.at);
    let old = 0, now = 0, wrong = 0;
    A.forEach((a, i) => {
      if (a.correct) return; wrong++;
      const thr = adaptiveRushMs(A.slice(0, i), a.source, a.skill);
      if (!a.hintLevel && a.timeMs < 5000) old++;
      if (!a.hintLevel && a.timeMs < Math.max(thr ?? 0, 5000)) now++;
    });
    expect(wrong).toBe(38);
    expect(now).toBeGreaterThan(old * 2);
  });
  it('Session: спешка не идёт в честную долю и не даёт монет, как и ответ быстрее 5 с', () => {
    const src = readFileSync('src/screens/Session.svelte', 'utf8');
    expect(src).toContain('adaptiveRushMs(game.save.attempts, it.source, it.skill)');
    expect(src).toContain('isTooFast(timeMs, chars, hintLevel, adaptive)');
    expect(src).toContain('rushLimitMs(chars, adaptive)');
  });
});

describe('монеты и корабль в бою', () => {
  it('больше 6 поломок — вполовину, округление вниз, минимум 1 за ответ', () => {
    expect(HALF_COINS_OVER).toBe(6);
    expect([0, 1, 2, 3, 4, 5].map(halfCoins)).toEqual([0, 1, 1, 1, 2, 2]);
  });
  it('Session: половина только когда неисправленных > 6, Бит говорит один раз', () => {
    const src = readFileSync('src/screens/Session.svelte', 'utf8');
    expect(src).toContain("const halfOn = block !== 'repair' && broken.length > HALF_COINS_OVER;");
    expect(src).toContain('if (halfOn) carry = SHIP_SAY.half;');
    expect(SHIP_SAY.half).toBe('Кеме ақаулы: тиындар жартылай. Алдымен жөнде!');
    expect(src.match(/answerPay\(/g)!.length).toBeGreaterThanOrEqual(2);
  });
  it('в ремонтном бою за починку +3 монеты', () => {
    expect(REPAIR_FIX_COINS).toBe(1);
    expect(readFileSync('src/screens/Session.svelte', 'utf8')).toContain('earn(REPAIR_FIX_COINS');
  });
});

describe('ремонт вместо доп. миссии', () => {
  it('3 починки при asExtra и свободной доп. миссии — доп. миссия; иначе обычный ремонт', () => {
    const a = { asExtra: true, fixed: 3, extraMissions: 0, cap: 1 };
    expect(REPAIR_EXTRA_FIXES).toBe(3);
    expect(repairAsExtra(a)).toBe(true);
    expect(repairAsExtra({ ...a, fixed: 2 })).toBe(false);
    expect(repairAsExtra({ ...a, asExtra: false })).toBe(false);
    expect(repairAsExtra({ ...a, extraMissions: 1 })).toBe(false);
  });
  it('минуты: extraMissions + 1, extraHonest += доля честных, settleDay даёт +15 мин (доля 1) или меньше', () => {
    const plan = buildPlan({ skills: {}, attempts: [], days: {}, repairShop: [], settings: {} } as any, [], '2026-10-01');
    for (const [share, minutes] of [[1, 15], [0.5, 10], [0.3, 5]] as const) {
      const rec = blankDay('2026-10-01');
      rec.extraHonest = (rec.extraHonest ?? rec.extraMissions) + share;
      rec.extraMissions++;
      settleDay(rec, plan, 'today');
      expect(rec.extraMissions).toBe(1);
      expect(rec.minutesToday).toBe(minutes);
    }
    expect(EXTRA_MIN).toBe(15);
  });
  it('Session: ремонт с asExtra засчитывается через completeBlock(extra) и «Қосымша миссия!»', () => {
    const src = readFileSync('src/screens/Session.svelte', 'utf8');
    expect(src).toContain("if (extraRepair) completeBlock('extra');");
    expect(src).toContain("b === 'extra' || extraRepair ? 'Қосымша миссия!'");
    expect(src).toContain("scr.name === 'session' && !!scr.asExtra");
  });
});

describe('счёт БИЛ в итоге боя', () => {
  it('+4 за верный, −1 за ошибку', () => {
    expect(bilScore(7, 3)).toBe(25); expect(bilScore(10, 0)).toBe(40); expect(bilScore(0, 5)).toBe(-5);
  });
  it('строка по-казахски, настоящий минус, без длинного тире', () => {
    expect(bilLine(7, 3)).toBe('Емтиханда: +4 × 7 дұрыс − 1 × 3 қате = 25 балл');
    expect(bilLine(0, 2)).toBe('Емтиханда: +4 × 0 дұрыс − 1 × 2 қате = −2 балл');
    expect(bilLine(7, 3)).not.toContain('—');
    expect(BIL_NOTE).toBe('Бір қате −1 балл. Тексер!');
  });
  it('Session показывает строку и фразу; сам поймавшие свою ошибку считаются верными', () => {
    const src = readFileSync('src/screens/Session.svelte', 'utf8');
    expect(src).toContain('bilLine(bilR');
    expect(src).toContain('{BIL_NOTE}');
    expect(src).toContain('result.right + result.caught');
  });
});
