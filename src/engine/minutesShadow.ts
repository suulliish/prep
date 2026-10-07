// «Тень» минут (D2): каждый ответ в бою и практике дополнительно пишется как слот по новому правилу (src/engine/minutes.ts)
// в DayRecord.mins и save.debts. Старые минуты, XP, монеты, звёзды, ремонт и поведение ребёнка НЕ меняются: тень только пишет
// в свои два поля, а читает её один экран — «Сегодня» у командира (MinutesShadow.svelte). Любая ошибка внутри тени глотается:
// ребёнок не должен заметить даже сбой. Время в движок не заходит: день и момент берутся из самого ответа, часы устройства не спрашиваются.
import type { Attempt, MinDay, Save } from './types';
import { blankDay, planComplete } from './planner';
import { median } from './rush';
import {
  MIN, answerId, classify, cleanDebts, cleanMinDay, newMinDay, addSlot, addHonest, honestCapMs, honestTotalMs, honestRight,
  dropOldMinsIn, debtOf, repairQueue, onRepair, pruneDebts, bar, debtLeft, shouldCredit, dunnoMany, extraBar, wrongRun, slotKinds,
} from './minutes';

export interface ShadowCtx {
  /** Где ответ: разминка, новая тема, смешанные, доп. миссия, ремонт, босс (босс в минуты не входит). */
  block: 'warmup' | 'new' | 'mixed' | 'extra' | 'boss' | 'repair';
  /** Это «егіз» (близнец): ответ-ремонт, а не задача плана. */
  twin: boolean;
  /** Постоянный id этого устройства (src/lib/version.ts: deviceId). */
  device: string;
}

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Медиана времени верных ответов этой темы без подсказок (последние 30, не меньше 3) — для предела времени одной задачи. */
function skillMedianMs(save: Save, a: Attempt): number | null {
  const xs: number[] = [];
  for (let i = save.attempts.length - 1, lo = Math.max(0, save.attempts.length - 400); i >= lo && xs.length < 30; i--) {   // не больше 400 последних: на новой теме обход всей истории давал до 16 мс на ответ
    const x = save.attempts[i];
    if (x.skill === a.skill && x.at !== a.at && x.correct && !x.hintLevel && x.mode !== 'lesson' && x.timeMs > 0) xs.push(x.timeMs);
  }
  return xs.length >= 3 ? median(xs) : null;
}

/** Записать ответ в тень. Идемпотентно: тот же ответ второй раз ничего не меняет. Никогда не бросает. */
export function shadowAnswer(save: Save, a: Attempt, ctx: ShadowCtx): void {
  try { record(save, a, ctx); } catch { /* тень не должна мешать игре */ }
}

function record(save: Save, a: Attempt, ctx: ShadowCtx): void {
  if (ctx.block === 'boss' || a.mode === 'boss' || a.mode === 'lesson' || a.mode === 'recall' || a.mode === 'diagnostic' || typeof a.day !== 'string' || !DAY_RE.test(a.day)) return;
  if (!save.days[a.day]) save.days[a.day] = blankDay(a.day);
  const rec = save.days[a.day];
  const planItems = (rec.plan?.blocks ?? []).reduce((s, b) => s + (b.items || 0), 0);
  const root: MinDay = cleanMinDay(rec.mins) ?? newMinDay(planItems > 0 ? planItems : MIN.planN);
  const debts = cleanDebts(save.debts);
  const id = answerId(a);
  const kind = classify({ correct: a.correct, hintLevel: a.hintLevel, rushed: !!a.fast, closed: !!a.closed, dunno: a.confidence === 'unsure', timeMs: a.timeMs });
  const right = kind === 'right';
  const addTime = (m: MinDay) => { if (a.honest) addHonest(m, ctx.device, id, honestCapMs(a.timeMs, { medianMs: skillMedianMs(save, a) }), right); };

  if (ctx.block === 'extra') {
    // доп. миссия: свои слоты (10 задач), долгов не заводим; близнец в ней только добавляет честное время
    const ex = root.extra ?? newMinDay(MIN.extraN);
    if (!ctx.twin) addSlot(ex, id, { k: kind, at: a.at, src: a.source, skill: a.skill });
    addTime(ex);
    root.extra = ex;
  } else if (ctx.twin || ctx.block === 'repair') {
    // ремонт: честный верный близнец закрывает первый открытый долг этой темы; неверный ничего не отнимает
    // тот же ответ второй раз (повторный вызов) долг не закрывает: id ответа уже записан в каком-то долге
    const used = Object.values(debts).some(d => d.by?.includes(id) || d.tr?.includes(`${a.day}|${id}`));
    if (right && !used) {
      const target = repairQueue(debts, a.day, dunnoMany(root)).find(d => d.skill === a.skill);
      if (target) onRepair(debts, target.id, id, a.day, true, dunnoMany(root));
    }
    addTime(root);
  } else {
    addSlot(root, id, { k: kind, at: a.at, src: a.source, skill: a.skill });
    if (!right) { const d = debtOf(id, root.slots[id], a.day); if (d && !debts[id]) debts[id] = d; }
    addTime(root);
  }
  pruneDebts(debts, a.day);
  rec.mins = root;
  save.debts = debts;
  dropOldMins(save, a.day);
}

export { SHADOW_KEEP_DAYS } from './minutes';
export function dropOldMins(save: Save, today: string): void { dropOldMinsIn(save.days, today); }

export interface ShadowSummary {
  has: boolean;              // у дня есть хотя бы один слот плана
  bar: number;               // полоса 0..60 (округлена)
  planN: number;
  answers: number;           // слотов в плане
  debtToday: number;         // сколько близнецов ещё нужно вернуть по сегодняшним долгам
  debtCarried: number;       // и по перенесённым с прошлых дней
  honestMin: number;         // честное время, минут (только задачи: урок, разбор и «Еске түсір» в тень пока не входят)
  honestRight: number;       // честных верных за день
  via: 'full' | 'cap' | null;
  dunno: number;
  many: boolean;             // «Білмеймін» больше MIN.dunnoMany за день
  stuck: boolean;            // 5 неверных подряд в плане
  planDone: boolean;
  extra?: { answers: number; bar: number };
}

/** Что показать командиру. Чистая функция от сохранения. */
export function shadowSummary(save: Save, day: string): ShadowSummary {
  const rec = save.days?.[day];
  const m = cleanMinDay(rec?.mins);
  const answers = m ? Object.keys(m.slots).length : 0;
  const blank: ShadowSummary = { has: false, bar: 0, planN: m?.planN ?? MIN.planN, answers: 0, debtToday: 0, debtCarried: 0, honestMin: 0, honestRight: 0, via: null, dunno: 0, many: false, stuck: false, planDone: false };
  const extra = m?.extra && Object.keys(m.extra.slots).length ? { answers: Object.keys(m.extra.slots).length, bar: Math.round(extraBar(m.extra)) } : undefined;
  if (!m || !answers) return extra ? { ...blank, extra } : blank;
  const left = debtLeft(m, save.debts, day);
  const out: ShadowSummary = {
    has: true, bar: Math.round(bar(m, save.debts, day)), planN: m.planN, answers,
    debtToday: left.today, debtCarried: left.carried,
    honestMin: Math.round(honestTotalMs(m) / 6000) / 10, honestRight: honestRight(m),
    via: shouldCredit(m, save.debts, day), dunno: Object.values(m.slots).filter(s => s.k === 'dunno').length, many: dunnoMany(m),
    stuck: wrongRun(slotKinds(m)) >= MIN.stuckRow,
    planDone: !!rec?.plan && planComplete(rec, rec.plan),
  };
  if (extra) out.extra = extra;
  return out;
}
