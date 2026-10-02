// Запись поведения для аналитики командира (src/engine/analytics.ts, вкладка «Аналитика»): активное время, заходы, ранние нажатия
// «дальше», время на каждом шаге урока и разборе ошибки, уходы из приложения посреди задания.
// Лежит в сохранении (save.usage, по дню) и уходит в облако отдельной коллекцией users/{uid}/usage/{ГГГГ-ММ} (src/lib/cloud.svelte.ts).
// Своё, а не Google/Firebase Analytics: данные ребёнка не уходят третьим лицам, и видно учёбу (шаги, темы), а не просто клики.
// Каждые 5 с меняет сохранение в памяти без persist(): на диск и в облако попадает со следующим сохранением и при сворачивании.
import { game, persist } from './store.svelte';
import type { UsageDay, StepLog, ReviewLog, UsageEvent } from '../engine/types';
import { usageDay } from '../engine/usage';

export const TICK_MS = 5000;
export const IDLE_MS = 60000;          // без касаний дольше — не считаем активным временем
export const NEW_SESSION_MS = 30 * 60000;
const MAX_EVENTS = 300;

const day = (): UsageDay => usageDay((game.save.usage ??= []), game.day);
const now = () => Date.now();

let lastInput = 0, hiddenAt = 0, started = false;
let step: (StepLog & { t0: number; hidAt: number }) | null = null;
let review: (ReviewLog & { t0: number }) | null = null;

/** Экраны, где ребёнок занят заданием: уход из приложения здесь считается «ушёл посреди» (awayMs). */
const busy = () => ['lesson', 'session', 'recall', 'diagnostic'].includes(game.screen.name);

/** Где сейчас нажато раньше времени: шаг урока, разбор, иначе экран. */
function place(): string {
  if (review) return 'review';
  if (step) return `lesson:${step.type}`;
  return game.screen.name;
}

function input() {
  const t = now(), d = day();
  if (!d.firstAt) d.firstAt = t;
  if (!lastInput || t - lastInput > NEW_SESSION_MS || !d.sessions) d.sessions++;
  lastInput = t; d.lastAt = t;
}

export function startTracking() {
  if (started || typeof window === 'undefined') return;
  started = true;
  addEventListener('pointerdown', input, { capture: true, passive: true });
  addEventListener('keydown', input, { capture: true, passive: true });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      hiddenAt = now();
      if (step) step.hidAt = hiddenAt;
      persist();   // свернул — сохраняем (и в облако): дальше браузер может страницу выгрузить
    } else if (hiddenAt) {
      const gone = now() - hiddenAt;
      if (busy()) day().awayMs += gone;
      if (step && step.hidAt) { step.away += gone; step.hidAt = 0; }
      hiddenAt = 0;
    }
  });
  window.setInterval(() => {
    if (document.visibilityState !== 'visible' || !lastInput || now() - lastInput > IDLE_MS) return;
    const d = day();
    d.activeMs += TICK_MS;
    const s = game.screen.name;
    d.screens[s] = (d.screens[s] ?? 0) + TICK_MS;
  }, TICK_MS);
}

/** Нажал «дальше» раньше, чем кнопка зарядилась (ReadGate.nope и свои проверки экранов). */
export function trackNope(where?: string) {
  const d = day(), p = where ?? place();
  d.nope[p] = (d.nope[p] ?? 0) + 1;
  if (step) step.nope++;
  if (review) review.nope++;
}

/** Шаг урока открыт. need — время чтения, на которое заряжается «дальше» (0 — шаг с заданием). */
export function stepStart(skill: string, i: number, type: string, need = 0) {
  stepEnd(false);
  step = { at: now(), skill, i, type, ms: 0, need, nope: 0, away: 0, done: false, t0: now(), hidAt: 0 };
}
/** Кнопка «дальше» шага зарядилась на need мс (после ответа на шагах с выбором — тоже). */
export function stepNeed(ms: number) { if (step) step.need = Math.max(step.need, Math.round(ms)); }
/** Шаг закрыт: done — пошёл дальше, false — вышел из урока на этом шаге. */
export function stepEnd(done: boolean) {
  if (!step) return;
  const s = step; step = null;
  const { t0: _t, hidAt: _h, ...log } = s;
  log.ms = now() - s.t0 - s.away;
  log.done = done;
  day().steps.push(log);
  if (!done) trackExit('lesson');
}

export function reviewStart(skill: string) { reviewEnd(); review = { at: now(), skill, ms: 0, nope: 0, t0: now() }; }
export function reviewEnd() {
  if (!review) return;
  const { t0, ...log } = review; review = null;
  log.ms = now() - t0;
  day().reviews.push(log);
}

export function trackExit(where: string) { const d = day(); d.exits[where] = (d.exits[where] ?? 0) + 1; }

export function trackEvent(k: string, e: Omit<UsageEvent, 'at' | 'k'> = {}) {
  const list = day().events;
  list.push({ at: now(), k, ...e });
  if (list.length > MAX_EVENTS) list.splice(0, list.length - MAX_EVENTS);
}
