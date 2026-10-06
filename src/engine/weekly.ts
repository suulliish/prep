// Вкладка «Неделя» командира: карточка недели и 5 тревог с готовой фразой для разговора (K5, docs/systems/MASTERPLAN.md §6,
// docs/systems/specs/commander.md). Чистые функции: даты, время и внешние данные (очередь тем, облако) приходят параметрами,
// без обращения к часам, хранилищу и Svelte. Где данных нет, поле null и в тексте «данных пока нет»: числа не выдумываются.
// Исключения командира (болезнь, праздник; src/engine/exceptions.ts) - не пропуск плана: такие дни не считаются ни в тревогах,
// ни в знаменателе плана недели.
import { iso, parse } from './dates';
import { exceptionChecker, shiftDay } from './exceptions';
import { planDone } from './streak';
import type { Save } from './types';

/** Пороги тревог (docs/systems/specs/commander.md, «Константы»). */
export const ALERT = {
  NO_PLAN_DAYS: 2,          // учебных дней подряд без выполненного плана
  HONEST_MIN: 0.7,          // доля честных ответов ниже этого за HONEST_DAYS учебных дней
  HONEST_DAYS: 3,
  HONEST_MIN_N: 20,         // и ответов за эти дни не меньше
  CRACK_OLD_DAYS: 7,        // трещина старше (в учебных днях)
  RUNWAY_MIN_WEEKS: 3,      // запас готовых уроков меньше (в неделях)
  SYNC_MAX_DAYS: 3,         // облако не писало дольше (в днях)
  ACTIVE_DAYS: 14,          // «занимается», если за столько дней были ответы
} as const;
export const LESSONS_PER_WEEK = 3;               // новых тем в неделю (content/queue.mjs: NEW_TOPIC_WEEKDAYS)
export const DEFAULT_NEW_TOPICS_END = '2027-11-15';   // как content/queue.mjs: NEW_TOPICS_END; экран передаёт настоящее значение
export const NO_DATA = 'данных пока нет';

export interface CloudInfo {
  loggedIn: boolean;
  status?: 'off' | 'syncing' | 'ok' | 'error';
  lastSyncMs?: number;                                   // последняя удачная синхронизация этого устройства, ms (0 или нет - ещё не было)
  devices?: { label?: string; app?: string; at: number }[];   // устройства аккаунта: когда писали в облако
  error?: string;
  readOnly?: boolean;
}
export interface WeeklyCtx {
  nowMs: number;                                         // текущее время, ms
  queue?: readonly string[];                             // очередь тем (content/queue.mjs: QUEUE)
  lessonReady?: (id: string) => boolean;                 // у темы есть готовый урок и генераторы
  newTopicsEnd?: string;                                 // после этой даты новых тем нет
  topicsPerWeek?: number;
  /** Облако: undefined/null - состояние неизвестно (ещё грузится), тревога про синхронизацию молчит. */
  cloud?: CloudInfo | null;
  /** Трещины в знаниях (появятся с проверками v2): с какого дня и по какой теме. Пока системы нет - undefined, тревога молчит. */
  cracks?: { since: string; skill?: string }[];
  /** Прочие сбои, замеченные экраном (например, кончилось место в браузере). */
  problems?: string[];
}

export type AlertId = 'no-plan' | 'honesty' | 'old-crack' | 'runway' | 'sync';
export interface Alert {
  id: AlertId;
  title: string;
  /** Что случилось: для командира, с числами. */
  text: string;
  /** Что сказать ребёнку: без цифр, наблюдение, вопрос, выбор из двух. Для тревоги без вины ребёнка - что сделать командиру. */
  phrase: string;
  since?: string;
}

const dm = (d: string) => `${d.slice(8, 10)}.${d.slice(5, 7)}`;
const DAY_MS = 864e5;
const isWeekdayStr = (d: string) => { const w = parse(d).getDay(); return w >= 1 && w <= 5; };

/** Понедельник недели, в которую попадает день (неделя Пн-Вс). */
export const mondayOf = (day: string) => { const d = parse(day); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return iso(d); };

const attemptsOf = (save: Save) => (Array.isArray(save.attempts) ? save.attempts : []).filter(a => a && a.mode !== 'diagnostic');   // как в analytics.ts: диагностика не в счёт
const honestOn = (list: Save['attempts']) => ({ n: list.length, honest: list.filter(a => a.honest).length });

/** Последние `count` завершённых (до сегодня) учебных дней: будни без исключений, от свежих к старым. */
function lastSchoolDays(save: Save, today: string, count: number, limit = 400): string[] {
  const exc = exceptionChecker(save), out: string[] = [];
  for (let i = 1; i <= limit && out.length < count; i++) { const d = shiftDay(today, -i); if (isWeekdayStr(d) && !exc(d)) out.push(d); }
  return out;
}

// ---------- Запас уроков ----------
/** Темы очереди, у которых урок готов и которые ещё не проходили: их хватит на `weeks` недель при `perWeek` новых темах в неделю.
 *  Тема, начатая прямо сейчас (статус «изучается» или урок уже пройден), - текущая, в запас не входит. */
export function runway(save: Save, ctx: Pick<WeeklyCtx, 'queue' | 'lessonReady' | 'topicsPerWeek'>): { ready: number; weeks: number | null; known: boolean } {
  const q = ctx.queue, ok = ctx.lessonReady;
  if (!Array.isArray(q) || !ok) return { ready: 0, weeks: null, known: false };
  const sk = save.skills ?? {};
  const ready = q.filter(id => !sk[id]?.lessonDone && sk[id]?.status !== 'learning' && ok(id)).length;
  const per = ctx.topicsPerWeek && ctx.topicsPerWeek > 0 ? ctx.topicsPerWeek : LESSONS_PER_WEEK;
  return { ready, weeks: Math.floor((ready / per) * 10) / 10, known: true };
}

// ---------- Карточка недели ----------
export interface WeekCard {
  monday: string; sunday: string; today: string;
  plan: { done: number; of: number; excepted: { day: string; kind: 'sick' | 'holiday' }[] };
  minutes: { today: number; bank: number };
  honest: { pct: number | null; n: number; prevPct: number | null; prevN: number };
  runway: { ready: number; weeks: number | null; known: boolean; ended: boolean };
  tech: { errors: number; sync: 'unknown' | 'off' | 'syncing' | 'ok' | 'error'; lastWriteMs: number | null; lastWriteDaysAgo: number | null; problems: string[]; devices: number };
  /** Поля, которых в игре ещё нет: честно «данных пока нет». */
  noData: string[];
}

const pct = (honest: number, n: number) => (n ? Math.round((honest / n) * 100) : null);

export function lastWriteMs(ctx: WeeklyCtx): number | null {
  const c = ctx.cloud;
  if (!c) return null;
  const all = [c.lastSyncMs ?? 0, ...(Array.isArray(c.devices) ? c.devices.map(d => (typeof d?.at === 'number' ? d.at : 0)) : [])];
  const m = Math.max(...all);
  return m > 0 ? m : null;
}

/** Дробное число по-русски: 13,6 а не 13.6. */
export const ruNum = (n: number) => String(n).replace('.', ',');

/** Когда в последний раз молчало устройство, которое недавно работало (для тревоги «нет синхронизации»). Если устройств несколько: молчит то,
 *  что писало за последние 14 дней, но не за последние 3 (телефон брата, только что синхронизировавшийся, молчание телефона ребёнка не скрывает).
 *  Одно устройство или нет данных об устройствах: по последней записи, как раньше. null: молчащих нет. */
export function silentWriteMs(ctx: WeeklyCtx): number | null {
  const c = ctx.cloud;
  if (!c) return null;
  const devs = (Array.isArray(c.devices) ? c.devices : []).map(d => (typeof d?.at === 'number' ? d.at : 0)).filter(a => a > 0);
  if (devs.length >= 2) {
    const silent = devs.filter(a => ctx.nowMs - a > ALERT.SYNC_MAX_DAYS * DAY_MS && ctx.nowMs - a <= ALERT.ACTIVE_DAYS * DAY_MS);
    return silent.length ? Math.max(...silent) : null;
  }
  return lastWriteMs(ctx);
}

export function card(save: Save, today: string, ctx: WeeklyCtx): WeekCard {
  const monday = mondayOf(today), sunday = shiftDay(monday, 6), exc = exceptionChecker(save);
  const through = today < sunday ? today : sunday;       // дальше сегодняшнего дня неделя ещё не наступила
  let of = 0, done = 0;
  const excepted: WeekCard['plan']['excepted'] = [];
  for (let i = 0; i < 5; i++) {
    const d = shiftDay(monday, i), k = exc(d);
    if (k) { excepted.push({ day: d, kind: k }); continue; }   // исключение вычитается из знаменателя
    of++;
    if (d <= through && planDone(save.days?.[d])) done++;
  }
  const days = Object.values(save.days ?? {}).filter(r => r && typeof r.date === 'string' && r.date >= monday && r.date <= through);
  const num = (v: unknown) => (typeof v === 'number' && isFinite(v) ? v : 0);
  const prevMonday = shiftDay(monday, -7), prevSunday = shiftDay(monday, -1);
  const att = attemptsOf(save);
  const cur = honestOn(att.filter(a => a.day >= monday && a.day <= through)), prev = honestOn(att.filter(a => a.day >= prevMonday && a.day <= prevSunday));
  const end = ctx.newTopicsEnd ?? DEFAULT_NEW_TOPICS_END;
  const rw = runway(save, ctx);
  const errors = (Array.isArray(save.usage) ? save.usage : []).filter(u => u && u.day >= monday && u.day <= through)
    .reduce((s, u) => s + (Array.isArray(u.events) ? u.events.filter(e => e?.k === 'error').length : 0), 0);
  const lw = lastWriteMs(ctx);
  const c = ctx.cloud;
  const sync: WeekCard['tech']['sync'] = !c ? 'unknown' : !c.loggedIn ? 'off' : c.status === 'error' ? 'error' : c.status === 'syncing' ? 'syncing' : c.status === 'ok' || lw ? 'ok' : 'unknown';
  const problems = [...(ctx.problems ?? [])];
  if (c?.readOnly) problems.push('в облаке схема новее: игра только читает облако, обновите страницу');
  if (c?.status === 'error' && c.error) problems.push(`облако: ${String(c.error).split(':')[0].slice(0, 40)}`);   // только код ошибки: английский текст Firebase в сообщение не берём
  return {
    monday, sunday, today,
    plan: { done, of, excepted },
    minutes: { today: days.reduce((s, r) => s + num(r.minutesToday), 0), bank: days.reduce((s, r) => s + num(r.minutesWeekend), 0) },
    honest: { pct: pct(cur.honest, cur.n), n: cur.n, prevPct: pct(prev.honest, prev.n), prevN: prev.n },
    runway: { ...rw, ended: today >= end },
    tech: { errors, sync, lastWriteMs: lw, lastWriteDaysAgo: lw ? Math.max(0, Math.floor((ctx.nowMs - lw) / DAY_MS)) : null, problems, devices: Array.isArray(c?.devices) ? c!.devices!.length : 0 },
    noData: ['деңгей', 'трещины', 'питомец'],   // этих систем в игре ещё нет (L2-L5, P6)
  };
}

// ---------- Тревоги ----------
/** Ровно пять тревог, по завершённым дням (сегодняшний ещё идёт). Учебные дни: будни без исключений; выходные и болезнь не «пропуск». */
export function alerts(save: Save, today: string, ctx: WeeklyCtx): Alert[] {
  const out: Alert[] = [];
  const exc = exceptionChecker(save);
  const days = save.days ?? {};
  const firstPlan = Object.keys(days).filter(d => planDone(days[d])).sort()[0];

  // 1. Два учебных дня подряд без выполненного плана. Молчит до первого выполненного плана и если сегодня план уже закрыт.
  if (firstPlan && !(isWeekdayStr(today) && !exc(today) && planDone(days[today]))) {
    const recent = lastSchoolDays(save, today, 400);
    let run = 0, since = '';
    for (const d of recent) { if (d <= firstPlan || planDone(days[d])) break; run++; since = d; }
    if (run >= ALERT.NO_PLAN_DAYS) out.push({
      id: 'no-plan', since, title: 'План не закрыт несколько дней',
      text: `Учебных дней подряд без выполненного плана: ${run}, с ${dm(since)}. Выходные, болезнь и праздники не считаются.`,
      phrase: 'Я заметил, что последние дни план не закрыт. Это не упрёк, так бывает. Давай завтра сделаем только первую часть, до перерыва. Тебе удобнее сесть сразу после школы или после ужина?',
    });
  }

  // 2. Честность ниже 70% за 3 учебных дня при не менее 20 ответах.
  {
    const win = lastSchoolDays(save, today, ALERT.HONEST_DAYS);
    if (win.length === ALERT.HONEST_DAYS) {
      const set = new Set(win), h = honestOn(attemptsOf(save).filter(a => set.has(a.day)));
      if (h.n >= ALERT.HONEST_MIN_N && h.honest < ALERT.HONEST_MIN * h.n) out.push({
        id: 'honesty', since: win[win.length - 1], title: 'Много нечестных ответов',
        text: `Честных ответов ${Math.round((h.honest / h.n) * 100)}% из ${h.n} за последние ${ALERT.HONEST_DAYS} учебных дня (порог ${Math.round(ALERT.HONEST_MIN * 100)}%). Нечестный: наспех, свернул приложение или полная подсказка.`,
        phrase: 'Мне кажется, в последние дни ты отвечаешь слишком быстро, и Бит это видит. Давай на завтра договоримся: читаем условие два раза и только потом отвечаем. Тебе легче начать с лёгких задач или сразу с трудных?',
      });
    }
  }

  // 3. Трещина старше 7 учебных дней. Трещин в игре пока нет (появятся с проверками v2): без ctx.cracks тревога молчит.
  if (Array.isArray(ctx.cracks)) {
    let oldest: { since: string; age: number } | null = null;
    for (const c of ctx.cracks) {
      if (!c || typeof c.since !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(c.since) || c.since >= today) continue;
      let age = 0;
      for (let d = shiftDay(c.since, 1); d <= today && age < 4000; d = shiftDay(d, 1)) if (isWeekdayStr(d) && !exc(d)) age++;
      if (age > ALERT.CRACK_OLD_DAYS && (!oldest || age > oldest.age)) oldest = { since: c.since, age };
    }
    if (oldest) out.push({
      id: 'old-crack', since: oldest.since, title: 'Трещина не чинится',
      text: `Старейшей трещине ${oldest.age} учебных дней (с ${dm(oldest.since)}); порог ${ALERT.CRACK_OLD_DAYS}.`,
      phrase: 'Одна тема давно дала трещину и ждёт починки. Давай завтра потратим на неё первые десять минут. Ты починишь её утром или вечером?',
    });
  }

  // 4. Запас готовых уроков меньше 3 недель (пока новые темы вообще идут).
  {
    const rw = runway(save, ctx), end = ctx.newTopicsEnd ?? DEFAULT_NEW_TOPICS_END;
    if (rw.known && rw.weeks !== null && today < end && rw.weeks < ALERT.RUNWAY_MIN_WEEKS) out.push({
      id: 'runway', since: today, title: 'Заканчиваются готовые уроки',
      text: `Готовых уроков про запас: ${rw.ready} ${plural(rw.ready, 'тема', 'темы', 'тем')}, это ${ruNum(rw.weeks)} нед. при ${ctx.topicsPerWeek ?? LESSONS_PER_WEEK} новых темах в неделю (порог ${ALERT.RUNWAY_MIN_WEEKS} нед.). Нужно заказать уроки в еженедельную сессию.`,
      phrase: 'Это не про ребёнка, ему говорить нечего. Если вдруг в какой-то день нового урока не будет, скажите: «Сегодня повторяем старое, это не наказание». Задача командиру: заказать уроки на ближайшие недели.',
    });
  }

  // 5. Нет синхронизации больше 3 дней (или занимается, а облако не подключено). Состояние облака неизвестно - молчим.
  {
    const c = ctx.cloud;
    if (c) {
      const since14 = shiftDay(today, -ALERT.ACTIVE_DAYS);
      const active = attemptsOf(save).some(a => a.day >= since14 && a.day <= today) || Object.values(days).some(r => r && r.date >= since14 && r.date <= today && (r.minutesToday ?? 0) > 0);
      const lw = silentWriteMs(ctx);
      if (!c.loggedIn) {
        if (active) out.push({
          id: 'sync', title: 'Облако не подключено',
          text: 'Ребёнок занимается, но вход в облако не выполнен: ответы и прогресс хранятся только в браузере этого устройства. Вкладка «Данные».',
          phrase: 'Давай проверим, что игра сохраняет твой прогресс. Открой игру на своём телефоне и подожди минуту, чтобы я увидел твои занятия. Сделаешь это сейчас или после обеда?',
        });
      } else if (lw !== null && ctx.nowMs - lw > ALERT.SYNC_MAX_DAYS * DAY_MS) {
        const ago = Math.floor((ctx.nowMs - lw) / DAY_MS);
        out.push({
          id: 'sync', since: iso(new Date(lw)), title: 'Давно не было синхронизации',
          text: `Облако последний раз получало данные ${ago} дн. назад (порог ${ALERT.SYNC_MAX_DAYS}). Прогресс с другого устройства мог не дойти.`,
          phrase: 'Давай проверим, что игра на твоём телефоне сохраняет прогресс. Открой её и подожди минуту, чтобы всё отправилось. Сделаешь это сейчас или после обеда?',
        });
      }
    }
  }
  return out;
}

// ---------- Текст для Telegram ----------
export const plural = (n: number, a: string, b: string, c: string) => { const m = n % 100; return m >= 11 && m <= 14 ? c : n % 10 === 1 ? a : [2, 3, 4].includes(n % 10) ? b : c; };

/** Короткий текст карточки недели для отправки в Telegram (без форматирования, без длинного тире). */
export function weeklyText(c: WeekCard, al: Alert[], name: string): string {
  const L: string[] = [];
  L.push(`Жарық, неделя ${dm(c.monday)} - ${dm(c.sunday)}${name ? `, ${name}` : ''}`);
  L.push(c.plan.of ? `План: ${c.plan.done} из ${c.plan.of} ${plural(c.plan.of, 'дня', 'дней', 'дней')}${c.plan.excepted.length ? ` (исключений: ${c.plan.excepted.length})` : ''}` : 'План: на этой неделе исключения на все будни');
  L.push(`Заработано: ${c.minutes.today} мин, в копилку выходных ${c.minutes.bank} мин`);
  L.push(c.honest.pct === null ? `Честная работа: ${NO_DATA}` : `Честная работа: ${c.honest.pct}% (${c.honest.n} ${plural(c.honest.n, 'ответ', 'ответа', 'ответов')})${c.honest.prevPct === null ? '' : `, неделей раньше ${c.honest.prevPct}%`}`);
  L.push(c.runway.known ? (c.runway.ended ? 'Запас уроков: новые темы закончились' : `Запас уроков: ${c.runway.ready} ${plural(c.runway.ready, 'тема', 'темы', 'тем')}, это ${ruNum(c.runway.weeks!)} нед.`) : `Запас уроков: ${NO_DATA}`);
  L.push(`${c.noData.map((x, i) => (i ? x : x[0].toUpperCase() + x.slice(1))).join(', ')}: ${NO_DATA}`);
  const sync = c.tech.sync === 'off' ? 'облако не подключено' : c.tech.lastWriteDaysAgo === null ? `облако: ${NO_DATA}` : `облако писало ${c.tech.lastWriteDaysAgo} дн. назад`;
  L.push(`Сбои: ${c.tech.errors}${c.tech.problems.length ? ` (${c.tech.problems.join('; ')})` : ''}. ${sync[0].toUpperCase() + sync.slice(1)}`);
  if (al.length) { L.push('Тревоги:'); for (const a of al) L.push(`- ${a.title}: ${a.text}`); } else L.push('Тревог нет');
  return L.join('\n');
}
