// Звуковой движок: эффекты генерируются кодом (Web Audio), музыка — процедурный чиптюн без слов.
// Исследования: фоновая музыка слегка мешает чтению и памяти, но улучшает настроение
// (Kämpfe, Sedlmeier, Renkewitz 2011). Поэтому музыка играет на карте, в бою и в меню,
// а во время решения задачи и урока по умолчанию стихает («режим фокуса»).

export type Sfx =
  | 'click' | 'correct' | 'wrong' | 'hit' | 'crit' | 'combo' | 'xp' | 'chest'
  | 'crystal' | 'levelup' | 'portal' | 'hint' | 'energy' | 'mission';

export type Mood = 'hub' | 'battle' | 'map' | 'victory' | 'focus' | 'silent';

export interface AudioSettings {
  master: number;        // 0..1
  music: number;
  sfx: number;
  voice: number;
  musicInFocus: 'off' | 'quiet';
}

const DEFAULTS: AudioSettings = { master: 0.8, music: 0.35, sfx: 0.7, voice: 1, musicInFocus: 'off' };
const KEY = 'razlom.audio';

function loadSettings(): AudioSettings {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return { ...DEFAULTS }; }
}

class AudioEngine {
  settings = loadSettings();
  private ctx: AudioContext | null = null;
  private masterGain!: GainNode;
  private musicGain!: GainNode;
  private sfxGain!: GainNode;
  private noiseBuf!: AudioBuffer;
  private mood: Mood = 'silent';
  private seq: Sequencer | null = null;
  private voiceEl: HTMLAudioElement | null = null;

  /** Вызывать из обработчика нажатия: браузер разрешает звук только после действия пользователя. */
  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    this.ctx = new Ctx();
    this.masterGain = this.ctx.createGain();
    this.musicGain = this.ctx.createGain();
    this.sfxGain = this.ctx.createGain();
    this.musicGain.connect(this.masterGain);
    this.sfxGain.connect(this.masterGain);
    this.masterGain.connect(this.ctx.destination);
    const len = this.ctx.sampleRate;
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.applyVolumes();
    if (this.mood !== 'silent') this.setMood(this.mood, true);
  }

  save(patch: Partial<AudioSettings>) {
    this.settings = { ...this.settings, ...patch };
    try { localStorage.setItem(KEY, JSON.stringify(this.settings)); } catch { /* приватный режим */ }
    this.applyVolumes();
  }

  private musicTarget() {
    const s = this.settings;
    if (this.mood === 'silent') return 0;
    if (this.mood === 'focus') return s.musicInFocus === 'quiet' ? s.music * 0.25 : 0;
    return s.music;
  }

  private applyVolumes() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.masterGain.gain.setTargetAtTime(this.settings.master, t, 0.05);
    this.sfxGain.gain.setTargetAtTime(this.settings.sfx, t, 0.05);
    this.musicGain.gain.setTargetAtTime(this.musicTarget() * (this.voiceEl && !this.voiceEl.paused ? 0.35 : 1), t, 0.4);
  }

  /** Настроение музыки: hub — спокойно, map — приключение, battle — энергично, focus — задача/урок. */
  setMood(mood: Mood, force = false) {
    this.mood = mood;
    if (!this.ctx) return;
    this.applyVolumes();
    if (mood === 'silent') { this.seq?.stop(); this.seq = null; return; }
    if (mood === 'focus') { if (!this.seq) this.startTrack('hub'); return; } // фокус: та же мелодия, только тише/без звука
    if (this.seq && this.seq.track === mood && !force) return;
    this.startTrack(mood);
  }

  private startTrack(track: Track) {
    this.seq?.stop();
    this.seq = new Sequencer(this.ctx!, this.musicGain, this.noiseBuf, track);
    this.seq.start();
  }

  /** Реплика Бита (mp3 из scripts/voice). Музыка приглушается на время речи. */
  say(url: string) {
    if (this.voiceEl) this.voiceEl.pause();
    const el = new Audio(url);
    el.volume = this.settings.voice * this.settings.master;
    this.voiceEl = el;
    el.onended = el.onpause = () => this.applyVolumes();
    el.play().then(() => this.applyVolumes()).catch(() => {});
  }

  play(name: Sfx, opts: { combo?: number } = {}) {
    const c = this.ctx; if (!c) return;
    const t = c.currentTime + 0.005;
    const out = this.sfxGain;
    switch (name) {
      case 'click': return tone(c, out, t, 1200, 0.03, 'square', 0.08);
      case 'correct': return [660, 880, 1320].forEach((f, i) => tone(c, out, t + i * 0.07, f, 0.12, 'triangle', 0.25));
      case 'wrong': // мягко, без «наказания»
        tone(c, out, t, 330, 0.12, 'sine', 0.18); return tone(c, out, t + 0.1, 262, 0.18, 'sine', 0.15);
      case 'hit':
        noise(c, out, this.noiseBuf, t, 0.12, 900, 0.5); return sweep(c, out, t, 220, 60, 0.15, 'square', 0.25);
      case 'crit':
        noise(c, out, this.noiseBuf, t, 0.2, 1400, 0.6); sweep(c, out, t, 400, 50, 0.25, 'sawtooth', 0.25);
        return [1320, 1760, 2640].forEach((f, i) => tone(c, out, t + 0.12 + i * 0.05, f, 0.1, 'triangle', 0.15));
      case 'combo': { const k = Math.min(opts.combo ?? 1, 12); return tone(c, out, t, 440 * Math.pow(2, k / 12), 0.09, 'square', 0.12); }
      case 'xp': return [1568, 2093].forEach((f, i) => tone(c, out, t + i * 0.05, f, 0.06, 'square', 0.08));
      case 'chest':
        sweep(c, out, t, 200, 800, 0.35, 'triangle', 0.2);
        return [1047, 1319, 1568, 2093].forEach((f, i) => tone(c, out, t + 0.35 + i * 0.06, f, 0.25, 'triangle', 0.15));
      case 'crystal': // колокольный аккорд с мерцанием — самый «дорогой» звук
        [523, 659, 784, 1047, 1568].forEach((f, i) => bell(c, out, t + i * 0.09, f, 1.6, 0.14));
        return noise(c, out, this.noiseBuf, t + 0.4, 1.0, 6000, 0.05);
      case 'levelup': return [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(c, out, t + i * 0.09, f, 0.16, 'square', 0.12));
      case 'portal':
        noise(c, out, this.noiseBuf, t, 1.2, 500, 0.3, 3000); return sweep(c, out, t, 110, 440, 1.2, 'sine', 0.2);
      case 'hint': return [988, 1319].forEach((f, i) => bell(c, out, t + i * 0.12, f, 0.6, 0.1));
      case 'energy': return sweep(c, out, t, 300, 1200, 0.4, 'triangle', 0.18);
      case 'mission': return [392, 523, 659, 784].forEach((f, i) => tone(c, out, t + i * 0.1, f, 0.18, 'triangle', 0.18));
    }
  }
}

// ---------- Кирпичики синтеза ----------
function env(g: GainNode, t: number, peak: number, dur: number, attack = 0.005) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
}
function tone(c: AudioContext, out: AudioNode, t: number, f: number, dur: number, type: OscillatorType, vol: number) {
  const o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.value = f; env(g, t, vol, dur);
  o.connect(g).connect(out); o.start(t); o.stop(t + dur + 0.05);
}
function sweep(c: AudioContext, out: AudioNode, t: number, f1: number, f2: number, dur: number, type: OscillatorType, vol: number) {
  const o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(f1, t); o.frequency.exponentialRampToValueAtTime(f2, t + dur);
  env(g, t, vol, dur); o.connect(g).connect(out); o.start(t); o.stop(t + dur + 0.05);
}
function bell(c: AudioContext, out: AudioNode, t: number, f: number, dur: number, vol: number) {
  const car = c.createOscillator(), mod = c.createOscillator(), mg = c.createGain(), g = c.createGain();
  car.frequency.value = f; mod.frequency.value = f * 3.5; mg.gain.value = f * 1.2;
  mod.connect(mg).connect(car.frequency); env(g, t, vol, dur, 0.002);
  car.connect(g).connect(out); car.start(t); mod.start(t); car.stop(t + dur); mod.stop(t + dur);
}
function noise(c: AudioContext, out: AudioNode, buf: AudioBuffer, t: number, dur: number, freq: number, vol: number, freqTo?: number) {
  const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
  s.buffer = buf; s.loop = true; f.type = 'bandpass'; f.frequency.setValueAtTime(freq, t);
  if (freqTo) f.frequency.exponentialRampToValueAtTime(freqTo, t + dur);
  env(g, t, vol, dur); s.connect(f).connect(g).connect(out); s.start(t); s.stop(t + dur + 0.05);
}

// ---------- Процедурная музыка ----------
type Track = 'hub' | 'battle' | 'map' | 'victory';
const TRACKS: Record<Track, { bpm: number; root: number; prog: number[][]; drums: boolean; arpType: OscillatorType; lead: boolean }> = {
  // аккорды — ступени в полутонах от тоники
  hub: { bpm: 84, root: 57, prog: [[0, 4, 7], [-3, 0, 4], [5, 9, 12], [7, 11, 14]], drums: false, arpType: 'triangle', lead: false },
  map: { bpm: 104, root: 55, prog: [[0, 4, 7], [7, 11, 14], [-3, 0, 4], [5, 9, 12]], drums: true, arpType: 'square', lead: true },
  battle: { bpm: 132, root: 52, prog: [[0, 3, 7], [-4, 0, 3], [-2, 2, 5], [0, 3, 7]], drums: true, arpType: 'square', lead: true },
  victory: { bpm: 120, root: 60, prog: [[0, 4, 7], [5, 9, 12], [7, 11, 14], [0, 4, 7]], drums: true, arpType: 'triangle', lead: true },
};
const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

class Sequencer {
  private step = 0;
  private next = 0;
  private timer: number | null = null;
  private seed = Math.floor(Math.random() * 1e9);
  constructor(private c: AudioContext, private out: AudioNode, private noiseBuf: AudioBuffer, public track: Track) {}
  private rnd() { this.seed = (this.seed * 1103515245 + 12345) & 0x7fffffff; return this.seed / 0x7fffffff; }
  start() {
    this.next = this.c.currentTime + 0.1;
    const tick = () => {
      const T = TRACKS[this.track], sixteenth = 60 / T.bpm / 4;
      while (this.next < this.c.currentTime + 0.2) { this.schedule(this.step, this.next, sixteenth); this.step++; this.next += sixteenth; }
    };
    tick();
    this.timer = window.setInterval(tick, 50);
  }
  stop() { if (this.timer) clearInterval(this.timer); this.timer = null; }
  private schedule(step: number, t: number, s16: number) {
    const T = TRACKS[this.track], c = this.c, out = this.out;
    const bar = Math.floor(step / 16) % T.prog.length, pos = step % 16, chord = T.prog[bar];
    // бас на сильные доли
    if (pos % 4 === 0) tone(c, out, t, midi(T.root - 12 + chord[0]), s16 * 3.5, 'triangle', 0.22);
    // арпеджио
    if (pos % 2 === 0) tone(c, out, t, midi(T.root + 12 + chord[(pos / 2) % chord.length]), s16 * 1.6, T.arpType, 0.05);
    // мелодия: простые фразы на каждые 2 такта, ноты из аккорда и пентатоники
    if (T.lead && (pos === 0 || pos === 6 || pos === 10 || (pos === 14 && this.rnd() > 0.5))) {
      const scale = [0, 2, 4, 7, 9, 12];
      const n = T.root + 12 + (this.rnd() > 0.5 ? chord[Math.floor(this.rnd() * 3)] : scale[Math.floor(this.rnd() * scale.length)]);
      tone(c, out, t, midi(n), s16 * 3, 'square', 0.035);
    }
    if (!T.drums) return;
    if (pos % 8 === 0) sweep(c, out, t, 120, 40, 0.12, 'sine', 0.35);                 // бочка
    if (pos % 8 === 4) noise(c, out, this.noiseBuf, t, 0.08, 1800, 0.12);              // малый
    if (pos % 2 === 1) noise(c, out, this.noiseBuf, t, 0.03, 8000, 0.04);              // хэт
  }
}

export const audio = new AudioEngine();
