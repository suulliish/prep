// Награда временем игры: каждый заработок показывается большой плашкой, пока ребёнок не нажмёт «Қабылдау» (принять).
// Очередь: несколько наград подряд показываются по одной. Плашка перекрывает экран — пропустить её нельзя, не заметив.
import { audio } from './audio';

export interface Reward {
  minutes: number;          // сколько минут игры заработано
  title: string;            // короткий заголовок: «Сыйлық!», «Қосымша миссия»
  why?: string;             // за что (на казахском)
  today?: number;           // сколько минут набралось за день с этой наградой
  weekend?: number;         // сколько в копилке выходных (если есть)
}
export const rewardUI = $state({ cur: null as Reward | null });
const queue: { r: Reward; done: () => void }[] = [];
let curDone: (() => void) | null = null;

function next() {
  const n = queue.shift();
  if (!n) { rewardUI.cur = null; curDone = null; return; }
  rewardUI.cur = n.r; curDone = n.done; audio.play('chest');
}
/** Показать награду; промис завершается, когда нажали «Қабылдау». Награды с нулём минут не показываем. */
export function showReward(r: Reward): Promise<void> {
  if (!(r.minutes > 0)) return Promise.resolve();
  return new Promise(res => { queue.push({ r, done: res }); if (!rewardUI.cur) next(); });
}
export function acceptReward() {
  audio.play('levelup');
  const d = curDone; rewardUI.cur = null; curDone = null;
  d?.(); next();
}
