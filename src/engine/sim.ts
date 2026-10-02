// Симулятор ученика: «проживает» дни до экзамена по НАСТОЯЩИМ числам игры (цены, награды, пороги берутся из кода, а не копируются)
// и показывает, что у ребёнка есть на 30-й, 100-й, 300-й день: монеты, звёзды, кристаллы, миры, костюмы, уровень, поломки, минуты.
// Это модель, а не ребёнок: темп и точность — параметры (по умолчанию «хороший ученик», 85% верных). Живое поведение — вкладка «Аналитика».
// Используется картой систем (content/systems.mjs, tests/systems.test.ts) и отчётом `npm run systems`.
// @ts-ignore — контент на JS
import { SHIP_ITEMS, COINS } from '../../content/ship_items.mjs';
// @ts-ignore
import { WORLDS, OUTFITS, STAR_REWARDS } from '../../content/worlds.mjs';
// @ts-ignore
import { LESSONS } from '../../content/lessons.mjs';
import { examShare, round5, TODAY_MAX, EXTRA_MIN } from './planner';
import { CRIT_COINS, REPAIR_FIX_COINS, halfCoins } from './confidence';
import { COINS_HALF_FROM, shipIntegrity } from './repair';
import { levelOf } from './level';
import { isWeekday } from './dates';

export interface SimParams {
  start: string;            // первый день занятий
  exam: string;             // день экзамена
  accuracy: number;         // доля верных с первой попытки (0..1)
  sure: number;             // доля верных ответов «уверен» (крит-монета)
  knownAtStart: number;     // тем засчитано диагностикой
  newPerWeek: number;       // новых тем в неделю, пока есть уроки
  extraRate: number;        // доля будних дней с доп. миссией
  lessons?: number;         // уроков в контенте (по умолчанию — сколько есть в content/lessons.mjs)
}
export const DEFAULT_SIM: SimParams = { start: '2026-09-28', exam: '2028-05-15', accuracy: 0.85, sure: 0.5, knownAtStart: 6, newPerWeek: 4, extraRate: 0.5 };

/** Блоки плана дня (src/engine/planner.ts buildPlan): сколько верных нужно и вес в минутах. */
export const SIM_BLOCKS = [{ id: 'warmup', minutes: 6, items: 6 }, { id: 'new', minutes: 18, items: 10 }, { id: 'mixed', minutes: 10, items: 8 }] as const;
export const SIM_SUMMARY_MIN = 2;

export interface SimDay {
  day: string; n: number;                     // n — номер учебного дня
  coins: number; spent: number; owned: number; // монеты на руках, потрачено всего, предметов куплено
  xp: number; level: number; stars: number; starRewards: number;
  learned: number; crystals: number; energy: number; worlds: number; outfits: number;
  broken: number; integrity: number; minutes: number;
}
export interface SimResult {
  params: SimParams; days: SimDay[];
  shop: { items: number; total: number };
  lessonsInContent: number;
  /** день, когда случилось событие (null — не случилось до экзамена) */
  milestones: { shopDone: string | null; starRewardsDone: string | null; outfitsDone: string | null; worldsDone: string | null; lessonsDone: string | null };
}

const nextDay = (d: string) => { const t = new Date(d + 'T12:00:00Z'); t.setUTCDate(t.getUTCDate() + 1); return t.toISOString().slice(0, 10); };

/** Ожидаемая прибавка XP за серию: 10 за верный + 2 за каждый верный подряд перед ним (до 5), как в Session.svelte. */
const comboBonus = (p: number) => { let s = 0; for (let j = 1; j <= 5; j++) s += Math.pow(p, j); return 2 * s; };
/** Звёзды шага (Session starsOf): по доле верных с первой попытки и доле честных; честных считаем = точности. */
const starsFor = (p: number) => (p >= 0.9 ? 3 : p >= 0.7 ? 2 : 1);

export function simulate(params: Partial<SimParams> = {}): SimResult {
  const P = { ...DEFAULT_SIM, ...params };
  const lessonsInContent = P.lessons ?? Object.values(LESSONS as Record<string, any[]>).filter(s => s.some(x => x.type === 'goal')).length;
  const items = [...(SHIP_ITEMS as { price: number }[])].sort((a, b) => a.price - b.price);
  const shopTotal = items.reduce((s, i) => s + i.price, 0);
  const worlds = (WORLDS as { need: number; arena?: boolean }[]);
  const outfits = (OUTFITS as { need: number }[]);
  const starRewards = (STAR_REWARDS as { need: number }[]);
  const p = P.accuracy;

  let coins = 0, spent = 0, owned = 0, xp = 0, stars = 0, broken = 0, n = 0;
  let taught = 0, learnedOnly = P.knownAtStart, crystals = 0, newCredit = 0;
  const pending: { day: number; kind: 'learn' | 'check' }[] = [];
  const days: SimDay[] = [];
  const ms: SimResult['milestones'] = { shopDone: null, starRewardsDone: null, outfitsDone: null, worldsDone: null, lessonsDone: null };
  const energyOf = () => learnedOnly + 2 * crystals;
  // мир открыт: энергии хватает и предыдущий босс побеждён (босс — раз в день после плана, побеждаем с вероятностью p)
  let cleared = 0;

  for (let d = P.start; d <= P.exam; d = nextDay(d)) {
    let minutes = 0;
    if (isWeekday(d)) {
      n++;
      // новая тема дня (пока есть уроки): урок → через 2 учебных дня «үйренді» → через 1 — отложенная проверка (кристалл с вероятностью p)
      newCredit += P.newPerWeek / 5;
      if (newCredit >= 1 && taught < lessonsInContent) { newCredit -= 1; taught++; pending.push({ day: n + 2, kind: 'learn' }); xp += 67 * p; }
      if (taught >= lessonsInContent && !ms.lessonsDone) ms.lessonsDone = d;
      for (const e of pending.filter(e => e.day === n)) {
        pending.splice(pending.indexOf(e), 1);
        if (e.kind === 'learn') { learnedOnly++; pending.push({ day: n + 1, kind: 'check' }); }
        else if (Math.random() < p) { learnedOnly--; crystals++; }
        else pending.push({ day: n + 3, kind: 'check' });   // провалил проверку: ещё попытка через 3 дня
      }
      // бои плана: шаг идёт до N верных; ответов N/p, ошибок N/p − N
      let planDone = 0;
      for (const b of SIM_BLOCKS) {
        const answers = b.items / p, wrong = answers - b.items;
        const pay = b.items * COINS.correct + b.items * P.sure * CRIT_COINS;
        coins += broken >= COINS_HALF_FROM ? halfCoins(pay) : pay;
        coins += 3 * COINS.enemy;                                   // 3 волны — 3 врага
        const st = starsFor(p); stars += st; if (st >= 3) coins += COINS.stars3;
        xp += b.items * (10 + comboBonus(p));
        broken += wrong;
        planDone += b.minutes * examShare(b.items, wrong, answers);
      }
      minutes = round5(TODAY_MAX * (planDone + SIM_SUMMARY_MIN) / (SIM_BLOCKS.reduce((s, b) => s + b.minutes, 0) + SIM_SUMMARY_MIN));
      // доп. миссия: при ≥3 поломках — ремонт (до 6 починок по 1 монете), иначе обычная (10 верных)
      if (n % Math.max(1, Math.round(1 / Math.max(P.extraRate, 0.01))) === 0 && P.extraRate > 0) {
        if (broken >= 3) { const f = Math.min(6, Math.floor(broken)); broken -= f; coins += f * REPAIR_FIX_COINS; }
        else { coins += 10 * COINS.correct + 3 * COINS.enemy; xp += 10 * (10 + comboBonus(p)); stars += starsFor(p); }
        minutes += round5(EXTRA_MIN * examShare(10, 10 / p - 10, 10 / p));
      }
      // бас жау: после плана, если хватает энергии на следующий мир
      const next = worlds[cleared + 1];
      if (next && !next.arena && energyOf() >= next.need && Math.random() < p) { cleared++; coins += COINS.boss + 2 * COINS.enemy; xp += 50; }
      // монеты сразу тратятся на самый дешёвый некупленный предмет
      while (owned < items.length && coins >= items[owned].price) { coins -= items[owned].price; spent += items[owned].price; owned++; }
    }
    const starR = starRewards.filter(r => r.need <= stars).length, outf = outfits.filter(o => o.need <= crystals).length;
    if (!ms.shopDone && owned >= items.length) ms.shopDone = d;
    if (!ms.starRewardsDone && starR >= starRewards.length) ms.starRewardsDone = d;
    if (!ms.outfitsDone && outf >= outfits.length) ms.outfitsDone = d;
    if (!ms.worldsDone && cleared + 1 >= worlds.filter(w => !w.arena).length) ms.worldsDone = d;
    days.push({
      day: d, n, coins: Math.round(coins), spent, owned, xp: Math.round(xp), level: levelOf(xp).lvl, stars: Math.round(stars), starRewards: starR,
      learned: learnedOnly + crystals, crystals, energy: energyOf(), worlds: cleared + 1, outfits: outf,
      broken: Math.round(broken), integrity: shipIntegrity(Math.round(broken)), minutes,
    });
  }
  return { params: P, days, shop: { items: items.length, total: shopTotal }, lessonsInContent, milestones: ms };
}

/** Детерминированный прогон (для тестов и отчёта): случайность заменена ожиданием. */
export function simulateDet(params: Partial<SimParams> = {}): SimResult {
  const r = Math.random;
  let seed = 12345;
  Math.random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  try { return simulate(params); } finally { Math.random = r; }
}
