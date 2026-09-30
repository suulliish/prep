// Плеер видео-объяснения «Көр»: кадры идут сами под голос Бита. Кадр показан → (пропуск: стоп, ждём верный выбор) → играет голос →
// конец голоса + TAIL_MS → следующий кадр. Без звука, без файла голоса или при ошибке загрузки кадр длится время чтения подписи (readMs).
// Перемотки вперёд нет: вперёд только когда кадр досмотрен. Время и звук подаются снаружи, поэтому ход проверяется тестами (tests/video.test.ts).
import { readMs } from '../lib/readgate.svelte';

/** Кадр появился, сцена успела ожить — и только потом голос. */
export const LEAD_MS = 450;
/** Пауза после конца голоса перед следующим кадром. */
export const TAIL_MS = 600;
/** Голос не начал играть за это время — идём по таймеру чтения. */
export const VOICE_START_MS = 4000;
/** Голос застыл посреди кадра (перебит другой репликой, оборвалась сеть) и не двигается — дочитываем по таймеру. */
export const STALL_MS = 2500;

export type Phase = 'lead' | 'gap' | 'talk' | 'tail' | 'end';
export interface VFrame { kz: string; math?: string; url: string }
/** Что плееру нужно от звукового элемента (HTMLAudioElement подходит). */
export interface Voice {
  duration: number; currentTime: number; paused: boolean; ended: boolean;
  pause(): void; play(): Promise<void> | void;
  addEventListener(t: 'ended' | 'error', f: () => void): void; removeEventListener(t: 'ended' | 'error', f: () => void): void;
}
export interface VDeps { say(url: string): Voice; stop(): void; voiceOn(): boolean }
export interface VOpts {
  frames: VFrame[]; deps: VDeps;
  /** кадр k закрыт пропуском и ещё не решён */
  gapOpen(k: number): boolean;
  onframe?(k: number): void;
  onend?(): void;
  /** кадр пересматривают заново («ещё раз», «басынан»): сцене нужно сыграть анимацию с нуля */
  onreplay?(): void;
}

export class VideoPlayer {
  frame = $state(0);
  phase = $state<Phase>('lead');
  /** доля реплики кадра, 0..1 (голос или таймер чтения) */
  p = $state(0);
  /** счётчик показов кадра: меняется при каждом входе в кадр (в том числе при повторе), по нему пересоздаётся картинка */
  run = $state(0);
  mode = $state<'voice' | 'read'>('read');
  userPaused = $state(false);
  /** системная пауза: диалог выхода, вкладка в фоне */
  held = $state(false);

  #o: VOpts;
  #el: Voice | null = null;
  #lead = 0; #tail = 0; #elapsed = 0; #readDur = 0; #seen = 0; #stall = 0;
  #timer = 0; #last = 0; #dead = false;
  #onEnded = () => this.#voiceEnded();
  #onError = () => this.#voiceFail();

  constructor(o: VOpts) { this.#o = o; }

  get running() { return !this.userPaused && !this.held && !this.#dead; }
  get last() { return this.#o.frames.length - 1; }
  /** доля кадра для полоски: до голоса 0, пока говорит p, после голоса 1 */
  get progress() { return this.phase === 'talk' ? this.p : this.phase === 'tail' || this.phase === 'end' ? 1 : 0; }
  /** Бит произносит (или только что произнёс) подсвеченное: p дошёл до метки */
  named(cue: number) { return (this.phase === 'talk' || this.phase === 'tail' || this.phase === 'end') && this.p >= cue; }

  /** Запустить ход времени. Тесты вместо этого зовут tick(dt) сами. */
  start() {
    this.#enter(0, false);
    this.#last = performance.now();
    this.#timer = setInterval(() => { const n = performance.now(); const dt = Math.min(250, n - this.#last); this.#last = n; this.tick(dt); }, 50) as unknown as number;
  }
  destroy() { this.#dead = true; clearInterval(this.#timer); this.#release(); this.#o.deps.stop(); }

  pause() { if (this.userPaused) return; this.userPaused = true; this.#el?.pause(); }
  play() {
    if (this.phase === 'gap' || this.phase === 'end') return;
    this.userPaused = false; this.#resumeVoice();
  }
  toggle() { if (this.userPaused) this.play(); else this.pause(); }
  hold(on: boolean) { if (this.held === on) return; this.held = on; if (on) this.#el?.pause(); else this.#resumeVoice(); }
  /** «Ещё раз»: текущий кадр с начала. */
  again() { this.userPaused = false; this.#enter(this.frame, true); }
  /** «Басынан»: с первого кадра. */
  restart() { this.userPaused = false; this.#enter(0, true); }
  /** Верный выбор в пропуске: короткая пауза, чтобы увидеть число, и голос кадра. */
  gapSolved() { if (this.phase === 'gap') { this.phase = 'lead'; this.#lead = 600; } }

  tick(dt: number) {
    if (!this.running) return;
    if (this.phase === 'lead') { this.#lead -= dt; if (this.#lead <= 0) this.#afterLead(); }
    else if (this.phase === 'talk') this.#talk(dt);
    else if (this.phase === 'tail') { this.#tail -= dt; if (this.#tail <= 0) this.#next(); }
  }

  #enter(k: number, replay: boolean) {
    this.#release(); this.#o.deps.stop();
    if (replay) this.#o.onreplay?.();
    this.frame = k; this.p = 0; this.phase = 'lead'; this.#lead = LEAD_MS; this.run++;
    this.#o.onframe?.(k);
  }
  #afterLead() {
    if (this.#o.gapOpen(this.frame)) { this.phase = 'gap'; return; }
    const f = this.#o.frames[this.frame];
    this.phase = 'talk'; this.p = 0; this.#elapsed = 0; this.#seen = 0; this.#stall = 0;
    this.#readDur = readMs(f.math, f.kz);
    if (f.url && this.#o.deps.voiceOn()) {
      this.mode = 'voice';
      const v = this.#o.deps.say(f.url);
      this.#el = v; v.addEventListener('ended', this.#onEnded); v.addEventListener('error', this.#onError);
    } else this.mode = 'read';
  }
  #talk(dt: number) {
    const v = this.#el;
    if (this.mode === 'voice' && v) {
      const t = v.currentTime;
      if (t > this.#seen) { this.#seen = t; this.#stall = 0; } else this.#stall += dt;
      if (!v.paused && v.duration > 0 && Number.isFinite(v.duration)) this.p = Math.min(1, t / v.duration);
      if (this.#stall > (this.#seen > 0 ? STALL_MS : VOICE_START_MS)) this.#voiceFail();
      return;
    }
    this.#elapsed += dt; this.p = Math.min(1, this.#elapsed / this.#readDur);
    if (this.p >= 1) this.#toTail();
  }
  #voiceEnded() { if (this.phase !== 'talk' || !this.#el) return; this.p = 1; this.#toTail(); }
  /** Голос не загрузился или не смог играть: оставшуюся часть кадра идём по времени чтения. */
  #voiceFail() {
    if (this.phase !== 'talk' || this.mode !== 'voice') return;
    this.#release(); this.#o.deps.stop();
    this.mode = 'read'; this.#elapsed = this.p * this.#readDur;
  }
  #toTail() { this.#release(); this.phase = 'tail'; this.#tail = TAIL_MS; }
  #next() {
    if (this.frame < this.last) { this.#enter(this.frame + 1, false); return; }
    this.phase = 'end'; this.p = 1; this.#o.onend?.();
  }
  #resumeVoice() {
    const v = this.#el; if (!v || this.phase !== 'talk' || !this.running || v.ended) return;
    try { Promise.resolve(v.play()).catch(() => this.#voiceFail()); } catch { this.#voiceFail(); }
  }
  #release() {
    const v = this.#el; if (!v) return;
    v.removeEventListener('ended', this.#onEnded); v.removeEventListener('error', this.#onError); this.#el = null;
  }
}
