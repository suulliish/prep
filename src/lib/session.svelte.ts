// План дня и завершение блоков (минуты, XP).
import { game, persist, skillDefs } from './store.svelte';
import { buildPlan, blankDay, settleDay, type Plan, type BlockId } from '../engine/planner';
import { refreshAvailability } from '../engine/progress';

export const today = $state({ plan: null as Plan | null });

export function ensurePlan(): Plan {
  if (!today.plan || today.plan.day !== game.day) {
    refreshAvailability(game.save, skillDefs);
    const rec = dayRec();
    // план дня собирается один раз и хранится в записи дня: перезагрузка страницы не меняет уже начатый день
    if (!rec.plan || rec.plan.day !== game.day) rec.plan = buildPlan(game.save, skillDefs, game.day);
    today.plan = JSON.parse(JSON.stringify(rec.plan));
  }
  return today.plan!;
}

// сначала создать запись, потом читать: «(x ??= {})» при первом вызове вернул бы копию, а не состояние Svelte
export function dayRec() { if (!game.save.days[game.day]) game.save.days[game.day] = blankDay(game.day); return game.save.days[game.day]; }

export function completeBlock(id: BlockId | 'extra') {
  const plan = ensurePlan(), rec = dayRec();
  if (id === 'extra') rec.extraMissions++;
  else rec.blocksDone[id] = true;
  if (id === 'new' || id === 'warmup' || id === 'mixed') rec.blocksDone.summary = rec.blocksDone.summary ?? false;
  settleDay(rec, plan, game.save.settings.extraTo);
  refreshAvailability(game.save, skillDefs);
  persist();
}

/** Пересчитать минуты дня (после «исправился — дозаработал») и сохранить. */
export function resettle() { settleDay(dayRec(), ensurePlan(), game.save.settings.extraTo); persist(); }

export function replan() { today.plan = null; if (game.save.days[game.day]) delete game.save.days[game.day].plan; ensurePlan(); }
