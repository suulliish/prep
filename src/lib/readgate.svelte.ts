// «Кнопка заряжается» (GAME_LOOP.md 10): после ошибки и на объяснениях кнопка «дальше» открывается
// через время чтения текста — как перезарядка умения в играх. Жмёт раньше — кнопка качается, Бит просит прочитать.

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
  start(ms: number) { clearTimeout(this.#t); this.ms = ms; this.key++; this.on = true; this.done = false; this.#t = window.setTimeout(() => { this.on = false; this.done = true; }, ms); }
  stop() { clearTimeout(this.#t); this.on = false; this.done = false; }
  /** Нажал раньше времени: кнопка качается. */
  nope() { const b = document.querySelector<HTMLElement>('.btn.charging'); b?.classList.remove('nope'); void b?.offsetWidth; b?.classList.add('nope'); }
}
