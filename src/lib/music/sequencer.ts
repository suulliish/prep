// Секвенсор музыки: планирует события с запасом вперёд (таймер раз в 100 мс, запас 1.2 с — держится и при
// «замедлении» таймеров в фоновой вкладке), играет их голосами из synth.ts. Одна дорожка = один Sequencer.
import { Cursor, type Track, type Ev } from './tracks';
import { Voices, getRig } from './synth';
import { mulberry32 } from './notes';

export type { Track } from './tracks';
const LOOKAHEAD = 1.2;
const TICK_MS = 100;

interface Queued { at: number; ev: Ev }

export class Sequencer {
  private voices: Voices;
  private cursor: Cursor;
  private q: Queued[] = [];
  private nextBar = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private level = -1;
  private jitter: () => number;
  private off = false;
  /** таймер положен (start(true)); нужен, чтобы resume() не заводил его у секвенсора с ручным pump() */
  private auto = false;

  constructor(private c: AudioContext, out: AudioNode, noiseBuf: AudioBuffer, public track: Track, seed = Math.floor(Math.random() * 1e9)) {
    const def = (this.cursor = new Cursor(track, seed)).peekDef();
    this.jitter = mulberry32(seed ^ 0x9e3779b9);
    this.voices = new Voices(c, getRig(c, out), noiseBuf, mulberry32(seed ^ 0x51ed270b), def.drone, def.echoTicks * def.tickSec);
  }

  /** timer=false: без таймера, планирование вручную через pump() (офлайн-рендер и тесты). */
  start(timer = true) {
    this.nextBar = this.c.currentTime + 0.12;
    this.pump(this.c.currentTime + LOOKAHEAD);
    this.auto = timer;
    if (timer) this.arm();
  }

  private arm() { this.timer = setInterval(() => { if (!this.off) { const now = this.c.currentTime; this.pump(now + LOOKAHEAD, now - 0.15); } }, TICK_MS); }

  /** Пауза: таймер снят, новые такты не планируются (звук выключен или вкладка в фоне). Уже отправленные в граф ноты доигрывают (≤ 1.2 с). */
  pause() {
    if (!this.timer) return;
    clearInterval(this.timer); this.timer = null;
    this.q.length = 0;
  }

  /** Продолжить с текущего момента: композиция идёт дальше с того же места (курсор не сбрасывается), пропущенное время не догоняется. */
  resume() {
    if (this.off || this.timer || !this.auto) return;
    this.nextBar = this.c.currentTime + 0.12;
    this.pump(this.c.currentTime + LOOKAHEAD);
    this.arm();
  }

  get paused() { return !this.off && this.auto && !this.timer; }

  /** Спланировать такты и сыграть события, начинающиеся раньше момента horizon (секунды часов контекста).
   *  late: события раньше этого момента пропускаются (браузер «заморозил» вкладку): вместо залпа нот музыка просто идёт дальше. */
  pump(horizon: number, late = -Infinity) {
    while (this.nextBar < horizon) {
      const bar = this.cursor.next(), t0 = this.nextBar;
      if (bar.def.level !== this.level) { this.voices.setLevel(bar.def.level, t0, this.level < 0 ? 0.25 : 1.2); this.level = bar.def.level; }
      if (t0 + bar.len < late) { this.nextBar += bar.len; continue; }
      for (const ev of bar.evs) {
        // микро-«живость»: ±6 мс у щипков и ударов, флейта и pad точно по сетке
        const j = ev.k === 'flute' || ev.k === 'pad' ? 0 : (this.jitter() - 0.3) * 0.012;
        this.q.push({ at: t0 + ev.t + Math.max(j, 0), ev });
      }
      this.nextBar += bar.len;
    }
    this.q.sort((a, b) => a.at - b.at);
    let i = 0;
    while (i < this.q.length && this.q[i].at < horizon) { const { at, ev } = this.q[i++]; if (at >= late) this.voices.play(ev, at); }
    if (i) this.q.splice(0, i);
  }

  /** Плавно гасит трек за fade секунд и освобождает узлы. Хвост реверба доигрывает общий тракт. */
  stop(fade = 0.6) {
    if (this.off) return; this.off = true;
    if (this.timer) clearInterval(this.timer); this.timer = null;
    this.q.length = 0;
    const t = this.c.currentTime;
    this.voices.setLevel(0, t, fade / 3);
    setTimeout(() => this.voices.dispose(), (fade + 2.8) * 1000);   // после самых длинных нот (щипок до 2 с, колокольчик 1.6 с)
  }
}
