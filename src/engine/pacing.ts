// Размер праздника (docs/systems/MASTERPLAN.md §4, specs/day.md «EVENT»): ответ — доли секунды, шаг — около секунды,
// полные сцены только для вехи, мира и босса. Чистый модуль: Session.svelte спрашивает здесь, сколько длится событие ответа.
import type { EventKind } from './confidence';

/** Сколько длится событие после ответа (мс): верный — не дольше rightMs, неверный (щит держит/разбит) — wrongMs;
 *  при «уменьшить движение» — reducedMs (без полёта камеры и тряски). */
export const EVENT = { rightMs: 800, wrongMs: 1300, reducedMs: 600 } as const;

/** Во сколько раз 3D-сцена проигрывает удар/щит быстрее обычного, пока идёт событие ответа (arena.setPace).
 *  Значения прикидочные: на живом устройстве длительность боевой анимации не замерена (см. отчёт D3). */
export const EVENT_PACE = { right: 2.6, wrong: 2.3, reduced: 3 } as const;

/** Смена волны (враг упал, вышел следующий): ускорение сцены; выход босса — полная скорость. */
export const PACE_WAVE = 1.6;

/** Камера и окно сцены разворачиваются не дольше этого (мс); дальше событие ждёт только анимацию боя. */
export const EVENT_PREROLL_MS = { normal: 120, reduced: 0 } as const;

/** Праздники крупнее ответа (мс): «ҮЙРЕНДІ!» после верного ответа, пауза на герое-радость без удара. */
export const BIG = { learnedMs: 1500, learnedReducedMs: 500, cheerMs: 600 } as const;

/** Неверное событие: щит держит или разбит. Остальные (крит, удар, контрудар, «сам нашёл») — верный ответ. */
export const isWrongEvent = (k: EventKind) => k === 'hold' || k === 'break';

export const eventMs = (k: EventKind, reduce: boolean) => (reduce ? EVENT.reducedMs : isWrongEvent(k) ? EVENT.wrongMs : EVENT.rightMs);
export const eventPace = (k: EventKind, reduce: boolean) => (reduce ? EVENT_PACE.reduced : isWrongEvent(k) ? EVENT_PACE.wrong : EVENT_PACE.right);
