// Данные для вкладки «Неделя» и тревог: очередь тем, готовые уроки, состояние облака (K5, src/engine/weekly.ts).
import { skillDefs, storage } from '../../lib/store.svelte';
import type { WeeklyCtx } from '../../engine/weekly';
import type { CloudMod } from './util';
// @ts-ignore — очередь тем на JS
import { QUEUE, NEW_TOPICS_END, NEW_TOPIC_WEEKDAYS } from '../../../content/queue.mjs';

/** Тема готова к выдаче: есть полный урок и генераторы задач (так выбирает новую тему планировщик). */
const READY = new Set(skillDefs.filter(d => d.lesson && d.templates.length).map(d => d.id));

/** C - модуль облака (грузится лениво); null - ещё не загрузился: про синхронизацию тогда ничего не утверждаем. */
export function weekCtx(C: CloudMod | null): WeeklyCtx {
  const problems: string[] = [];
  if (storage.full) problems.push('в браузере кончилось место для сохранения');
  const cl = C?.cloud;
  return {
    nowMs: Date.now(),
    queue: QUEUE as string[],
    lessonReady: id => READY.has(id),
    newTopicsEnd: NEW_TOPICS_END as string,
    topicsPerWeek: (NEW_TOPIC_WEEKDAYS as number[]).length,
    cracks: undefined,   // трещин в игре пока нет (появятся с проверками v2): тревога молчит
    problems,
    cloud: cl ? { loggedIn: !!cl.user, status: cl.status, lastSyncMs: cl.lastSync, devices: Object.values(cl.devices ?? {}), error: cl.error, readOnly: cl.readOnly } : null,
  };
}
