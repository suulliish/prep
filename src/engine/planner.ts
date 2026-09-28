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

export function nextSkill(save: Save, defs: SkillDef[]): string | null {
  const learning = defs.find(d => save.skills[d.id]?.status === 'learning');
  if (learning) return learning.id;
  const avail = defs.filter(d => {
    const st = save.skills[d.id];
    const open = st?.status === 'available' || (isDone(st) && !st.lessonDone); // «знает» по диагностике, но урока не было
    return open && d.templates.length && d.lesson !== false;
  });
  const g = (x: number | string) => (typeof x === 'number' ? x : 7);
  avail.sort((a, b) => g(a.grade) - g(b.grade) || b.weight - a.weight || CAT_ORDER.indexOf(a.cat) - CAT_ORDER.indexOf(b.cat));
  return avail[0]?.id ?? null;
}

export function buildPlan(save: Save, defs: SkillDef[], day: string): Plan {
  const due = dueSkills(save, day).filter(id => taught(save, defs, id));
  const recent = defs.filter(d => isDone(save.skills[d.id]) && d.templates.length && taught(save, defs, d.id)).map(d => d.id).slice(-6);
  const warm = [...new Set([...due, ...recent])].slice(0, 6);
  const next = nextSkill(save, defs);
  const blocks: Block[] = [];
  if (warm.length) blocks.push({ id: 'warmup', minutes: 6, skills: warm, items: 6 });
  if (next) blocks.push({ id: 'new', minutes: 18, skills: [next], items: 10, lesson: !save.skills[next]?.lessonDone });
  const mix = [...new Set([...warm, ...(next ? [next] : [])])];
  if (mix.length >= 2) blocks.push({ id: 'mixed', minutes: 10, skills: mix, items: 8 });
  blocks.push({ id: 'summary', minutes: 2, skills: [], items: 0 });
  return { day, blocks };
}

export const round5 = (m: number) => Math.round(m / 5) * 5;
export const TODAY_MAX = 60, WEEKEND_PER_DAY = 48, EXTRA_MIN = 15;

export function blankDay(date: string): DayRecord {
  return { date, blocksDone: {}, planShare: 0, minutesToday: 0, minutesWeekend: 0, extraMissions: 0, bonuses: [] };
}

/** Пересчитать заработок дня по выполненным блокам (минуты — пропорционально плану, с округлением до 5). */
export function settleDay(rec: DayRecord, plan: Plan, extraTo: 'today' | 'weekend') {
  const total = plan.blocks.reduce((s, b) => s + b.minutes, 0);
  const done = plan.blocks.filter(b => rec.blocksDone[b.id]).reduce((s, b) => s + b.minutes, 0);
  rec.planShare = total ? done / total : 0;
  const extra = rec.extraMissions * EXTRA_MIN;
  const bonus = rec.bonuses.reduce((s, b) => s + b.minutes, 0);
  rec.minutesToday = round5(TODAY_MAX * rec.planShare) + (extraTo === 'today' ? extra : 0) + bonus;
  rec.minutesWeekend = Math.round(WEEKEND_PER_DAY * rec.planShare) + (extraTo === 'weekend' ? extra : 0);
}

/** Бонус за освоение, а не за «позанимался» (ARCHITECTURE 9): тема освоена или отложенная проверка пройдена.
 *  Заранее не объявляется — неожиданная награда не подрывает интерес к самой учёбе (Deci, Koestner & Ryan 1999).
 *  Лимит в день, чтобы игра не вытесняла учёбу. Возвращает начисленные минуты. */
export const MASTERY_BONUS = 10, MASTERY_BONUS_DAY_CAP = 20;
export function addMasteryBonus(rec: DayRecord, reason: string): number {
  const got = rec.bonuses.filter(b => b.mastery).reduce((s, b) => s + b.minutes, 0);
  const add = Math.min(MASTERY_BONUS, MASTERY_BONUS_DAY_CAP - got);
  if (add <= 0) return 0;
  rec.bonuses.push({ reason, minutes: add, mastery: true });
  return add;
}

export const planComplete = (rec: DayRecord, plan: Plan) => plan.blocks.every(b => rec.blocksDone[b.id]);
export const canStartExtra = (rec: DayRecord, plan: Plan, cap: number) => planComplete(rec, plan) && rec.extraMissions < cap;

/** Честная попытка: не наугад (слишком быстро) и без полного разбора. */
export function isHonest(timeMs: number, hintLevel: number, minMs = 5000) {
  return timeMs >= minMs && hintLevel < 4;
}
