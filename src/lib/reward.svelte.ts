// Награда временем игры: одна сцена награды на момент, а не окно на каждую сумму (аудит 30.09: «+10, +55, +5 мин» подряд).
// Что происходит:
//   • queueReward(r) — награда пришла посреди занятия (бонус за освоенную тему): окно не показываем, кладём в копилку;
//   • showReward(r) — конец шага: показываем ОДНУ сцену со всеми накопленными пунктами — цифры считаются вверх и
//     «влетают» в счётчик минут (src/ui/RewardCard.svelte). Кнопка «Қабылдау» доступна сразу: читать тут нечего;
//   • flushRewards() — на корабле: если что-то осталось непоказанным (вышли из занятия посреди), показать сейчас.
// Ещё здесь: «что ребёнок уже видел» — счётчик минут корабля и уровень героя. По ним корабль понимает, что число выросло
// (пилюля минут считает вверх) и что уровень повысился (праздник «Деңгей N!»).
import { audio } from './audio';
import { game, levelOf } from './store.svelte';

export interface Reward {
  minutes: number;          // сколько минут игры заработано
  title: string;            // короткий заголовок: «Сыйлық!», «Қосымша миссия»
  why?: string;             // за что (на казахском)
  today?: number;           // сколько минут набралось за день с этой наградой
  weekend?: number;         // сколько в копилке выходных (если есть)
}
/** Одна показываемая сцена: пункты + итог. start — сколько минут было в счётчике до неё. */
export interface RewardScene {
  items: { minutes: number; title: string; why?: string }[];
  total: number;
  minutes: number;          // = total (то же число, старое имя поля)
  start: number;
  today?: number;
  weekend?: number;
}
export const rewardUI = $state({ cur: null as RewardScene | null });

const pending: Reward[] = [];
const later: { list: Reward[]; done: () => void }[] = [];   // сцены, ждущие своей очереди
let curDone: (() => void) | null = null;

function scene(list: Reward[]): RewardScene {
  const total = list.reduce((s, r) => s + r.minutes, 0);
  const last = [...list].reverse().find(r => r.today !== undefined);
  return {
    items: list.map(r => ({ minutes: r.minutes, title: r.title, why: r.why })),
    total, minutes: total,
    start: last?.today !== undefined ? Math.max(0, last.today - total) : 0,
    today: last?.today, weekend: [...list].reverse().find(r => r.weekend !== undefined)?.weekend,
  };
}
function next() {
  const n = later.shift();
  if (!n) { rewardUI.cur = null; curDone = null; return; }
  rewardUI.cur = scene(n.list); curDone = n.done;
  audio.play('chest');
}

/** Награда пришла посреди занятия: окно не показываем, она войдёт в ближайшую сцену награды. */
export function queueReward(r: Reward) { if (r.minutes > 0) pending.push(r); }

/** Показать сцену награды (вместе со всем, что копилось через queueReward); промис завершается, когда нажали «Қабылдау».
 *  Награды с нулём минут не показываем. Если сцена уже открыта, эта пойдёт следующей (по одной, как раньше). */
export function showReward(r: Reward): Promise<void> {
  if (!(r.minutes > 0) && !pending.length) return Promise.resolve();
  const list = [...pending.splice(0), ...(r.minutes > 0 ? [r] : [])];
  return new Promise(res => { later.push({ list, done: res }); if (!rewardUI.cur) next(); });
}

/** Корабль: если награда осталась непоказанной (вышли посреди занятия) — показать сейчас. */
export function flushRewards(): Promise<void> {
  if (!pending.length) return Promise.resolve();
  const list = pending.splice(0);
  return new Promise(res => { later.push({ list, done: res }); if (!rewardUI.cur) next(); });
}

export function acceptReward() {
  audio.play('levelup');
  const d = curDone; rewardUI.cur = null; curDone = null;
  d?.(); next();
}

// ---- что ребёнок уже видел на корабле ----
/** Минуты дня, XP и уровень, которые видел ребёнок на корабле (minutes = null — корабль ещё не открывали в этой сессии). */
export const seen = { minutes: null as number | null, level: levelOf(game.save.xp).lvl, xp: game.save.xp };
/** Уровень вырос с прошлого показа? Возвращает новый уровень один раз, потом null. */
export function takeLevelUp(): number | null {
  const now = levelOf(game.save.xp).lvl;
  if (now > seen.level) { seen.level = now; return now; }
  seen.level = now;
  return null;
}
