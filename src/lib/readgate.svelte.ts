// «Кнопка заряжается» (GAME_LOOP.md 10): после ошибки и на объяснениях кнопка «дальше» открывается
// через время чтения текста И после конца голосовой реплики Бита — как перезарядка умения в играх.
// Жмёт раньше — кнопка качается, Бит просит дослушать.
import { audio } from './audio';

/** Время чтения: ~0.35 с на слово (беглое чтение 5-го класса), от 2 до 9 с. */
export const readMs = (...texts: (string | undefined | null)[]) => {
  const words = texts.join(' ').split(/\s+/).filter(w => /[\p{L}\p{N}]/u.test(w)).length;
  return Math.round(Math.min(9000, Math.max(2000, words * 350)));
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
  nope() { const b = document.querySelector<HTMLElement>('.btn.charging'); b?.classList.remove('nope'); void b?.offsetWidth; b?.classList.add('nope'); }
}
