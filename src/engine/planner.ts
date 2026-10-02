// Дневной план и заработок игрового времени (docs/ARCHITECTURE.md разделы 7 и 9).
import { dueSkills, isDone, type SkillDef } from './progress';
import type { DayRecord, Save } from './types';

export type BlockId = 'warmup' | 'new' | 'mixed' | 'summary';
export interface Block { id: BlockId; minutes: number; skills: string[]; items: number; lesson?: boolean }
export interface Plan { day: string; blocks: Block[] }

const CAT_ORDER = 'CDABFGEIHJK';

/** Следующий навык для изучения: сначала начатый, иначе доступный с наибольшим весом и меньшим классом.
 *  Новая тема — только с готовым полным уроком (lesson !== false): без объяснения новичку не «доходит»
 *  (Kirschner, Sweller & Clark 2006). Нет урока — день идёт на повторение и смешанный бой. */
/** Тема «пройдена с уроком»: урок показан (или урока для темы нет вовсе). Решение семьи 28.09.2026: каждую тему
 *  сначала объясняем уроком хотя бы один раз — даже если диагностика показала, что ребёнок её знает. Пока урока
 *  не было, тема не попадает в разминку, смешанные бои и боссов. */
export function taught(save: Save, defs: SkillDef[], id: string): boolean {
  return !!save.skills[id]?.lessonDone || defs.find(d => d.id === id)?.lesson === false;
}

// решение командира 01.10 (порог мастерства 85%, вариант A): тема, которая не выучена за STUCK_DAYS дней занятий, не держит путь —
// открывается следующая, а застрявшая идёт в разминку каждый день, пока не наберёт 85%
export const STUCK_DAYS = 4;
const daysOn = (save: Save, id: string) => new Set((save.attempts ?? []).filter(a => a.skill === id).map(a => a.day)).size;
export const stuckSkills = (save: Save, defs: SkillDef[]) => defs.filter(d => save.skills[d.id]?.status === 'learning' && daysOn(save, d.id) >= STUCK_DAYS).map(d => d.id);

export function nextSkill(save: Save, defs: SkillDef[]): string | null {
  const learning = defs.filter(d => save.skills[d.id]?.status === 'learning');
  const fresh = learning.find(d => daysOn(save, d.id) < STUCK_DAYS);
  if (fresh) return fresh.id;
  const avail = defs.filter(d => {
    const st = save.skills[d.id];
    const open = st?.status === 'available' || (isDone(st) && !st.lessonDone); // «знает» по диагностике, но урока не было
    return open && d.templates.length && d.lesson !== false;
  });
  const g = (x: number | string) => (typeof x === 'number' ? x : 7);
  avail.sort((a, b) => g(a.grade) - g(b.grade) || b.weight - a.weight || CAT_ORDER.indexOf(a.cat) - CAT_ORDER.indexOf(b.cat));
  // новых тем нет — остаётся застрявшая
  return avail[0]?.id ?? learning[0]?.id ?? null;
}

export function buildPlan(save: Save, defs: SkillDef[], day: string): Plan {
  const due = dueSkills(save, day).filter(id => taught(save, defs, id));
  const recent = defs.filter(d => isDone(save.skills[d.id]) && d.templates.length && taught(save, defs, d.id)).map(d => d.id).slice(-6);
  const next = nextSkill(save, defs);
  // застрявшие и вернувшиеся в «изучается» темы (кроме сегодняшней новой) идут в разминку первыми, иначе выпадают из плана
  const back = defs.filter(d => save.skills[d.id]?.status === 'learning' && d.id !== next && taught(save, defs, d.id)).map(d => d.id);
  const warm = [...new Set([...back, ...due, ...recent])].slice(0, 6);
  const blocks: Block[] = [];
  if (warm.length) blocks.push({ id: 'warmup', minutes: 6, skills: warm, items: 6 });
  if (next) blocks.push({ id: 'new', minutes: 18, skills: [next], items: 10, lesson: !save.skills[next]?.lessonDone });
  const mix = [...new Set([...warm, ...(next ? [next] : [])])];
  if (mix.length >= 2) blocks.push({ id: 'mixed', minutes: 10, skills: mix, items: 8 });
  blocks.push({ id: 'summary', minutes: 2, skills: [], items: 0 });
  return { day, blocks };
}

export const round5 = (m: number) => Math.round(m / 5) * 5;
// решение командира 01.10: в день максимум 60 минут за план и ещё 15 за одну доп. миссию; минут «просто так» (бонус за освоение) нет
export const TODAY_MAX = 60, WEEKEND_PER_DAY = 48, EXTRA_MIN = 15, EXTRA_MISSIONS_MAX = 1;

export function blankDay(date: string): DayRecord {
  return { date, blocksDone: {}, planShare: 0, minutesToday: 0, minutesWeekend: 0, extraMissions: 0, bonuses: [] };
}

/** Пересчитать заработок дня по выполненным блокам (минуты — пропорционально плану, с округлением до 5). */
export function settleDay(rec: DayRecord, plan: Plan, extraTo: 'today' | 'weekend') {
  const total = plan.blocks.reduce((s, b) => s + b.minutes, 0);
  // минуты — за честную работу: вклад пройденного шага умножается на долю его честных ответов (research D1)
  const done = plan.blocks.filter(b => rec.blocksDone[b.id]).reduce((s, b) => s + b.minutes * Math.max(0, Math.min(1, rec.honest?.[b.id] ?? 1)), 0);
  rec.planShare = total ? done / total : 0;
  // доп. миссии: 15 мин × доля честных ответов в каждой (extraHonest — сумма долей; в старых сохранениях её нет — считаем честными)
  const extra = Math.min(EXTRA_MIN * EXTRA_MISSIONS_MAX, round5((rec.extraHonest ?? rec.extraMissions) * EXTRA_MIN));
  // подарков командира нет (решение Султана 02.10): старые бонусы остаются в записи для истории, но минут не дают
  rec.minutesToday = round5(TODAY_MAX * rec.planShare) + (extraTo === 'today' ? extra : 0);
  rec.minutesWeekend = Math.round(WEEKEND_PER_DAY * rec.planShare) + (extraTo === 'weekend' ? extra : 0);
}

export const planComplete = (rec: DayRecord, plan: Plan) => plan.blocks.every(b => rec.blocksDone[b.id]);
export const extraCap = (cap: number) => Math.max(0, Math.min(EXTRA_MISSIONS_MAX, cap));
export const canStartExtra = (rec: DayRecord, plan: Plan, cap: number) => planComplete(rec, plan) && rec.extraMissions < extraCap(cap);
/** Ошибки имеют цену (01.10): от REPAIR_FOR_EXTRA неисправленных поломок доп. миссия на +15 минут не обычная, а «ремонтная»
 *  (починил 3 поломки — получил её минуты). Лимит 1 в день (extraCap) тот же. */
export const REPAIR_FOR_EXTRA = 3;
export const extraNeedsRepair = (repairCount: number) => repairCount >= REPAIR_FOR_EXTRA;
// сколько чинить за ремонтную доп. миссию: все поломки, но не больше 6 — по труду как обычная доп. миссия (иначе выгодно держать корабль сломанным)
export const REPAIR_EXTRA_MAX = 6;
export const repairNeed = (repairCount: number) => Math.min(REPAIR_EXTRA_MAX, repairCount);

/** Честная попытка: не наугад (слишком быстро) и без полного разбора. */
/** Доля минут шага по правилам экзамена (решение 02.10): верный честный ответ +1, неверный −¼, «Білмеймін» 0, делённое на число ответов.
 *  Угадывание из пяти вариантов в среднем даёт 0 — столько же, сколько честное «не знаю» (раньше угадать было выгоднее). */
export const EXAM_PENALTY = 0.25;
export function examShare(paid: number, wrong: number, answered: number): number {
  return answered ? Math.max(0, Math.min(1, (paid - EXAM_PENALTY * wrong) / answered)) : 1;
}
/** «Исправился — дозаработал» (02.10): честно починил сегодняшнюю ошибку шага плана — тот ответ засчитывается как верный:
 *  ошибка снимается (−¼ больше нет) и добавляется +1, доля минут шага пересчитывается. «Білмеймін» тоже чинится (+1).
 *  Больше 100% шаг не даёт; нарочно ошибиться и починить не выгоднее, чем ответить верно сразу. */
export function restoreFix(rec: DayRecord, block: string, dunno: boolean): boolean {
  const t = rec.tally?.[block];
  if (!t || t.paid >= t.n) return false;
  if (!dunno && t.wrong > 0) t.wrong--;
  t.paid++;
  rec.honest ??= {};
  rec.honest[block] = examShare(t.paid, t.wrong, t.n);
  return true;
}
/** Поломка, починка которой вернёт минуты сегодняшнего плана. */
export const restorableFix = (r: { fixed?: boolean; addedDay: string; block?: string }, day: string) => !r.fixed && r.addedDay === day && !!r.block;

/** Уход из приложения дольше этого во время задачи — ответ не честный (калькулятор, поиск, подсказка со стороны). */
export const AWAY_MS = 3000;

export function isHonest(timeMs: number, hintLevel: number, minMs = 5000) {
  return timeMs >= minMs && hintLevel < 4;
}

// ---------- Очередь вопросов боя: чередование (D5, docs/GAME_LOOP.md 15) ----------
export interface Slot { skill: string; tpl: string | null }

const sameTpl = (a: Slot, b: Slot) => !!a.tpl && a.tpl === b.tpl;
export const tplClashes = (seq: Slot[]) => seq.reduce((n, s, i) => n + (i > 0 && sameTpl(seq[i - 1], s) ? 1 : 0), 0);

/** Очередь из `total` вопросов: темы идут по кругу (чередование), внутри темы шаблоны выбираются так, чтобы два вопроса
 *  одного шаблона не шли подряд и шаблоны использовались поровну. Если у единственной темы единственный шаблон — подряд неизбежно.
 *  Тему без шаблонов пропускаем. Чистая функция: `rand` подставляется в тестах. */
export function sequenceSlots(skills: string[], total: number, tplOf: (skill: string) => string[], rand: () => number = Math.random): Slot[] {
  const ring = [...new Set(skills)].filter(s => tplOf(s).length);
  if (!ring.length) return [];
  const used = new Map<string, number>();
  const seq: Slot[] = [];
  for (let i = 0; i < total; i++) {
    const skill = ring[i % ring.length], prev = seq[i - 1]?.tpl ?? null;
    const all = tplOf(skill), ok = all.filter(t => t !== prev), pool = ok.length ? ok : all;
    const least = Math.min(...pool.map(t => used.get(t) ?? 0));
    const best = pool.filter(t => (used.get(t) ?? 0) === least);
    const tpl = best[Math.floor(rand() * best.length)];
    used.set(tpl, (used.get(tpl) ?? 0) + 1);
    seq.push({ skill, tpl });
  }
  // общий шаблон у соседних тем (или единственный шаблон у темы) мог дать стык — меняем вопросы местами, пока стыков не станет меньше
  for (let guard = 0; guard < total * total && tplClashes(seq) > 0; guard++) {
    const i = seq.findIndex((s, k) => k > 0 && sameTpl(seq[k - 1], s));
    let fixed = false;
    for (let j = 0; j < seq.length && !fixed; j++) {
      if (j === i) continue;
      const before = tplClashes(seq);
      [seq[i], seq[j]] = [seq[j], seq[i]];
      if (tplClashes(seq) < before) fixed = true; else [seq[i], seq[j]] = [seq[j], seq[i]];
    }
    if (!fixed) break;
  }
  return seq;
}
