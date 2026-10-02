// «Кнопка заряжается» (GAME_LOOP.md 10): после ошибки и на объяснениях кнопка «дальше» открывается
// через время чтения текста И после конца голосовой реплики Бита — как перезарядка умения в играх.
// Жмёт раньше — кнопка качается, Бит просит дослушать.
import { audio } from './audio';
import { trackNope } from './track.svelte';

/** Время чтения: ~0.5 с на слово, от 2,5 до 18 с (02.10: было 0,35 с и до 9 с — ~170 слов в минуту, быстро для казахского текста
 *  в 10 лет; длинное правило упиралось в 9 с). Подстраивать по столбцу «Читал / нужно» во вкладке «Аналитика». */
export const READ = { perWordMs: 500, minMs: 2500, maxMs: 18000 } as const;
export const readMs = (...texts: (string | undefined | null)[]) => {
  const words = texts.join(' ').split(/\s+/).filter(w => /[\p{L}\p{N}]/u.test(w)).length;
  return Math.round(Math.min(READ.maxMs, Math.max(READ.minMs, words * READ.perWordMs)));
};

export class ReadGate {
  on = $state(false);
  done = $state(false);   // только что зарядилась — кнопка «вспыхивает»
  ms = $state(0);
  key = $state(0);
  #t = 0;
  #cap = 0; #id = 0;
  /** waitVoice=false — не ждать конца реплики Бита (заставка: историю можно листать через 1 с, а не дослушивать). */
  start(ms: number, waitVoice = true) {
    clearTimeout(this.#t); clearTimeout(this.#cap); const id = ++this.#id;
    this.ms = ms; this.key++; this.on = true; this.done = false;
    const open = () => { if (id !== this.#id) return; clearTimeout(this.#cap); this.on = false; this.done = true; };
    // время чтения прошло; если Бит ещё говорит — ждём конца реплики (но не дольше 25 с: сеть могла подвиснуть)
    this.#t = window.setTimeout(() => { if (waitVoice && audio.voiceBusy()) { audio.whenVoiceDone(open); this.#cap = window.setTimeout(open, 25000); } else open(); }, ms);
  }
  stop() { clearTimeout(this.#t); clearTimeout(this.#cap); this.#id++; this.on = false; this.done = false; }
  /** Нажал раньше времени: кнопка качается. */
  nope() { trackNope(); const b = document.querySelector<HTMLElement>('.btn.charging'); b?.classList.remove('nope'); void b?.offsetWidth; b?.classList.add('nope'); }
}
