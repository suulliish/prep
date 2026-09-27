// План дня и завершение блоков (минуты, XP).
import { game, persist, skillDefs } from './store.svelte';
import { buildPlan, blankDay, settleDay, type Plan, type BlockId } from '../engine/planner';
import { refreshAvailability } from '../engine/progress';

export const today = $state({ plan: null as Plan | null });

export function ensurePlan(): Plan {
  if (!today.plan || today.plan.day !== game.day) {
    refreshAvailability(game.save, skillDefs);
    today.plan = buildPlan(game.save, skillDefs, game.day);
  }
  game.save.days[game.day] ??= blankDay(game.day);
  return today.plan;
}

export function dayRec() { return (game.save.days[game.day] ??= blankDay(game.day)); }

export function completeBlock(id: BlockId | 'extra') {
  const plan = ensurePlan(), rec = dayRec();
  if (id === 'extra') rec.extraMissions++;
  else rec.blocksDone[id] = true;
  if (id === 'new' || id === 'warmup' || id === 'mixed') rec.blocksDone.summary = rec.blocksDone.summary ?? false;
  settleDay(rec, plan, game.save.settings.extraTo);
  refreshAvailability(game.save, skillDefs);
  persist();
}

export function replan() { today.plan = null; ensurePlan(); }
