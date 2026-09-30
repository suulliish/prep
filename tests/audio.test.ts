// Звук: семплы на месте и в бюджете; движок играет семпл, когда он загружен, и синтез, когда нет.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const DIR = join(__dirname, '..', 'public', 'sfx');

function fakeParam() { return { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime() {} }; }
function fakeNode(): any {
  const n: any = { gain: fakeParam(), frequency: fakeParam(), playbackRate: fakeParam(), connect: (x: any) => x, disconnect() {}, start() {}, stop() {} };
  return n;
}
class FakeCtx {
  state = 'running'; currentTime = 0; sampleRate = 44100; destination = fakeNode();
  sources: any[] = [];
  createGain() { return fakeNode(); }
  createOscillator() { return fakeNode(); }
  createBiquadFilter() { return fakeNode(); }
  createBuffer(_c: number, len: number) { return { getChannelData: () => new Float32Array(len) }; }
  createBufferSource() { const n = fakeNode(); this.sources.push(n); return n; }
  resume() { return Promise.resolve(); }
  decodeAudioData(data: ArrayBuffer) { return Promise.resolve({ duration: 0.5, bytes: data.byteLength } as unknown as AudioBuffer); }
}

async function fresh(fetchImpl: any) {
  vi.resetModules();
  vi.stubGlobal('window', { AudioContext: FakeCtx });
  vi.stubGlobal('localStorage', { getItem: () => null, setItem() {} });
  vi.stubGlobal('fetch', fetchImpl);
  return await import('../src/lib/audio');
}
const flush = () => new Promise(r => setTimeout(r, 10));
const okFetch = () => vi.fn(async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) }));

describe('файлы семплов', () => {
  const files = readdirSync(DIR).filter(f => f.endsWith('.mp3'));
  it('есть файл на каждый звук из таблицы', async () => {
    const { SAMPLES } = await fresh(okFetch());
    for (const name of Object.keys(SAMPLES)) expect(files, name).toContain(`${name}.mp3`);
  });
  it('весь набор укладывается в 600 КБ, файлы непустые и с mp3-заголовком', () => {
    let total = 0;
    for (const f of files) {
      const b = readFileSync(join(DIR, f)); total += statSync(join(DIR, f)).size;
      expect(b.length, f).toBeGreaterThan(500);
      const id3 = b.subarray(0, 3).toString() === 'ID3', sync = b[0] === 0xff && (b[1] & 0xe0) === 0xe0;
      expect(id3 || sync, f).toBe(true);
    }
    expect(total).toBeLessThanOrEqual(600 * 1024);
  });
});

describe('движок', () => {
  beforeEach(() => vi.unstubAllGlobals());

  it('до загрузки играет синтез, после загрузки — семпл', async () => {
    const { audio } = await fresh(okFetch());
    audio.unlock();
    audio.play('correct');
    expect(audio.sfxStatus().synth).toBe(1);
    await flush();
    const st = audio.sfxStatus();
    expect(st.failed).toEqual([]);
    expect(st.loaded).toContain('levelup');
    audio.play('correct');
    expect(audio.sfxStatus().sample).toBe(1);
  });

  it('офлайн (fetch падает): все звуки играют синтезом без ошибок', async () => {
    const { audio } = await fresh(vi.fn(async () => { throw new TypeError('offline'); }));
    audio.unlock(); await flush();
    expect(audio.sfxStatus().loaded).toEqual([]);
    expect(audio.sfxStatus().failed.length).toBeGreaterThan(15);
    for (const n of ['click', 'correct', 'wrong', 'hit', 'crit', 'combo', 'xp', 'chest', 'crystal', 'levelup', 'portal', 'hint', 'energy', 'mission', 'slash', 'impact', 'block', 'growl', 'boom', 'land', 'coins'] as const)
      expect(() => audio.play(n, { combo: 3 })).not.toThrow();
    expect(audio.sfxStatus().sample).toBe(0);
  });

  it('файл не декодируется: этот звук на синтезе, остальные на семплах', async () => {
    const { audio } = await fresh(vi.fn(async (u: string) => u.endsWith('wrong.mp3') ? { ok: false } : { ok: true, arrayBuffer: async () => new ArrayBuffer(8) }));
    audio.unlock(); await flush();
    expect(audio.sfxStatus().failed).toEqual(['wrong']);
  });

  it('комбо поднимает высоту по гамме, rate умножает, высота повторяющихся звуков гуляет в ±4%', async () => {
    const { audio } = await fresh(okFetch());
    audio.unlock(); await flush();
    const ctx: FakeCtx = (audio as any).ctx;
    audio.play('combo', { combo: 1 }); audio.play('combo', { combo: 8 }); audio.play('combo', { combo: 2, rate: 0.5 });
    const r = ctx.sources.map(s => s.playbackRate.value);
    expect(r[0]).toBeCloseTo(1, 5);
    expect(r[1]).toBeCloseTo(2, 5);        // 8-е комбо = октава
    expect(r[2]).toBeCloseTo(0.5 * Math.pow(2, 2 / 12), 5);
    ctx.sources.length = 0;
    for (let i = 0; i < 40; i++) audio.play('click');
    const cr = ctx.sources.map(s => s.playbackRate.value);
    expect(Math.min(...cr)).toBeGreaterThanOrEqual(0.96); expect(Math.max(...cr)).toBeLessThanOrEqual(1.04);
    expect(new Set(cr.map(x => x.toFixed(3))).size).toBeGreaterThan(5);
  });

  it('зависший fetch: через 8 с семпл считается упавшим, а позже перезапрашивается', async () => {
    vi.useFakeTimers();
    try {
      const hang = vi.fn(() => new Promise(() => {}));   // игнорирует signal и не отвечает никогда
      const { audio, FETCH_TIMEOUT_MS } = await fresh(hang);
      audio.unlock();
      expect(audio.sfxStatus().pending.length).toBeGreaterThan(15);
      await vi.advanceTimersByTimeAsync(FETCH_TIMEOUT_MS - 100);
      expect(audio.sfxStatus().failed).toEqual([]);      // ещё ждём
      await vi.advanceTimersByTimeAsync(200);
      const st = audio.sfxStatus();
      expect(st.pending).toEqual([]);
      expect(st.failed.length).toBeGreaterThan(15);
      expect(() => audio.play('click')).not.toThrow();   // пока на синтезе
      expect(audio.sfxStatus().synth).toBe(1);
      // сеть вернулась: следующий unlock() после паузы перезапрашивает
      vi.stubGlobal('fetch', okFetch());
      await vi.advanceTimersByTimeAsync(21000);
      audio.unlock();
      await vi.advanceTimersByTimeAsync(50);
      expect(audio.sfxStatus().failed).toEqual([]);
      expect(audio.sfxStatus().loaded).toContain('click');
    } finally { vi.useRealTimers(); }
  });

  it('fetch передаёт signal и отменяется по таймауту', async () => {
    vi.useFakeTimers();
    try {
      const signals: AbortSignal[] = [];
      const { audio, FETCH_TIMEOUT_MS } = await fresh(vi.fn((_u: string, o?: { signal?: AbortSignal }) => {
        signals.push(o!.signal!);
        return new Promise((_, rej) => o!.signal!.addEventListener('abort', () => rej(new DOMException('aborted', 'AbortError'))));
      }));
      audio.unlock();
      expect(signals.length).toBeGreaterThan(15);
      expect(signals.every(s => !s.aborted)).toBe(true);
      await vi.advanceTimersByTimeAsync(FETCH_TIMEOUT_MS + 10);
      expect(signals.every(s => s.aborted)).toBe(true);
      expect(audio.sfxStatus().pending).toEqual([]);
    } finally { vi.useRealTimers(); }
  });

  it('без unlock() play ничего не делает', async () => {
    const { audio } = await fresh(okFetch());
    expect(() => audio.play('click')).not.toThrow();
    expect(audio.sfxStatus().state).toBe('none');
  });
});

// ---------- Музыка (src/lib/music): композиция как данные + движок с записывающим фейком ----------
import { Cursor, TRACKS, type Track, type Ev } from '../src/lib/music/tracks';
import { noteMidi, parseMel } from '../src/lib/music/notes';
import { pluckSample, limiterCurve } from '../src/lib/music/synth';
import { Sequencer } from '../src/lib/music/sequencer';

/** Фейк с записью: считает созданные узлы и значения setTargetAtTime (громкость шины музыки). */
function recParam() {
  const p: any = { value: 0, targets: [] as number[] };
  p.setValueAtTime = () => p; p.linearRampToValueAtTime = () => p; p.exponentialRampToValueAtTime = () => p;
  p.setTargetAtTime = (v: number) => { p.targets.push(v); return p; };
  return p;
}
function recNode(ctx: MusicCtx, kind: string): any {
  const n: any = { kind, connect: (x: any) => x, disconnect() { ctx.disconnects++; }, start() { ctx.starts++; }, stop() {}, setPeriodicWave() {}, buffer: null, curve: null };
  for (const k of ['gain', 'frequency', 'detune', 'playbackRate', 'delayTime', 'Q', 'pan', 'threshold', 'knee', 'ratio', 'attack', 'release']) n[k] = recParam();
  return n;
}
class MusicCtx {
  state = 'running'; currentTime = 0; sampleRate = 44100;
  created: Record<string, number> = {}; starts = 0; disconnects = 0;
  destination: any; nodes: any[] = [];
  constructor() { this.destination = recNode(this, 'dest'); }
  private mk(kind: string) { this.created[kind] = (this.created[kind] || 0) + 1; const n = recNode(this, kind); this.nodes.push(n); return n; }
  createGain() { return this.mk('gain'); } createOscillator() { return this.mk('osc'); } createBiquadFilter() { return this.mk('biquad'); }
  createBufferSource() { return this.mk('src'); } createDynamicsCompressor() { return this.mk('comp'); } createWaveShaper() { return this.mk('shaper'); }
  createConvolver() { return this.mk('conv'); } createDelay() { return this.mk('delay'); } createStereoPanner() { return this.mk('panner'); }
  createPeriodicWave() { return {}; }
  createBuffer(ch: number, len: number, sr: number) { const d = Array.from({ length: ch }, () => new Float32Array(len)); return { numberOfChannels: ch, length: len, sampleRate: sr, duration: len / sr, getChannelData: (i: number) => d[i] }; }
  resume() { return Promise.resolve(); }
  decodeAudioData() { return Promise.reject(new Error('no decode')); }
  get total() { return Object.values(this.created).reduce((a, b) => a + b, 0); }
}
async function freshMusic() {
  vi.resetModules();
  vi.stubGlobal('window', { AudioContext: MusicCtx });
  vi.stubGlobal('localStorage', { getItem: () => null, setItem() {} });
  vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('offline'); }));
  return await import('../src/lib/audio');
}

const PC: Record<Track, number[]> = {   // допустимые классы нот (0 = до): лад трека
  hub: [2, 4, 5, 7, 9, 11, 0],          // D дорийский
  map: [9, 11, 0, 2, 4, 5, 7],          // A минор (аэолийский)
  battle: [2, 4, 5, 7, 9, 10, 0],       // D минор
  victory: [2, 4, 6, 7, 9, 11, 1],      // D мажор
  training: [7, 9, 10, 0, 2, 4, 5],     // G дорийский
};
const PITCHED = new Set(['pluck', 'bass', 'flute', 'bell']);
const KINDS = new Set(['pluck', 'bass', 'flute', 'bell', 'kick', 'tom', 'tak', 'shake', 'pad']);

/** Проходит трек целиком (2 петли для hub/map/battle, 2 такта фанфара + 8 тактов «Корабля» для победы). */
function walk(track: Track, seed: number) {
  const c = new Cursor(track, seed), def = TRACKS[track];
  const n = track === 'victory' ? 10 : def.bars * 2;
  return Array.from({ length: n }, () => c.next());
}

describe('музыка: композиция', () => {
  for (const track of ['hub', 'map', 'battle', 'victory', 'training'] as Track[]) {
    it(`${track}: события в границах такта, ноты в ладу, флейта одноголосна`, () => {
      for (const seed of [1, 2, 3]) for (const bar of walk(track, seed)) {
        expect(bar.evs.length).toBeGreaterThan(0);
        let prevFluteEnd = -1;
        for (const e of bar.evs) {
          expect(KINDS.has(e.k), e.k).toBe(true);
          expect(Number.isFinite(e.t) && e.t >= 0 && e.t < bar.len, `t=${e.t}`).toBe(true);
          expect(e.v).toBeGreaterThan(0); expect(e.v).toBeLessThanOrEqual(1.2);
          if (PITCHED.has(e.k)) {
            expect(e.n).toBeGreaterThanOrEqual(30); expect(e.n).toBeLessThanOrEqual(104);
            expect(PC[bar.track].includes(e.n % 12), `${bar.track} нота ${e.n} (класс ${e.n % 12}) не в ладу`).toBe(true);
          }
          if (e.k === 'flute') {
            expect(e.t).toBeGreaterThanOrEqual(prevFluteEnd - 1e-9);         // не налезает на предыдущую ноту
            expect(e.t + e.d).toBeLessThanOrEqual(bar.len + 1e-9);            // и не выходит за такт
            prevFluteEnd = e.t + e.d;
          }
        }
      }
    });
  }

  it('темпы и длины: hub 40–60 с, map 40–65 с, battle 110–120 уд/мин, победа-фанфар 3–4 с и затем «Корабль»', () => {
    const loop = (t: Track) => TRACKS[t].bars * TRACKS[t].ticks * TRACKS[t].tickSec;
    expect(loop('hub')).toBeGreaterThan(40); expect(loop('hub')).toBeLessThan(60);
    expect(loop('map')).toBeGreaterThan(40); expect(loop('map')).toBeLessThan(65);
    const bpm = 60 / (TRACKS.battle.tickSec * 4);
    expect(bpm).toBeGreaterThanOrEqual(110); expect(bpm).toBeLessThanOrEqual(120);
    const v = walk('victory', 5);
    const fan = v.filter(b => b.track === 'victory').reduce((s, b) => s + b.len, 0);
    expect(fan).toBeGreaterThanOrEqual(3); expect(fan).toBeLessThanOrEqual(4.5);
    expect(v.slice(0, 2).every(b => b.track === 'victory')).toBe(true);
    expect(v.slice(2).every(b => b.track === 'hub')).toBe(true);
    // тренировка (урок): 40–60 с и заметно медленнее и тише боя
    expect(loop('training')).toBeGreaterThan(40); expect(loop('training')).toBeLessThan(60);
    const tb = 60 / (TRACKS.training.tickSec * 4);
    expect(tb).toBeGreaterThanOrEqual(70); expect(tb).toBeLessThan(bpm - 20);
  });

  it('вариации: тот же seed — та же музыка, другой seed — другие заполнения; петля не буквальный повтор', () => {
    const sig = (track: Track, seed: number) => JSON.stringify(walk(track, seed).map(b => b.evs));
    for (const t of ['hub', 'map', 'battle', 'training'] as Track[]) {
      expect(sig(t, 11)).toBe(sig(t, 11));
      expect(sig(t, 11)).not.toBe(sig(t, 12));
      const w = walk(t, 11), n = TRACKS[t].bars;
      expect(JSON.stringify(w.slice(0, n).map(b => b.evs))).not.toBe(JSON.stringify(w.slice(n).map(b => b.evs)));
    }
  });

  it('плотность: событий в секунду умеренно (низкая нагрузка на слабых телефонах)', () => {
    for (const t of ['hub', 'map', 'battle', 'training'] as Track[]) {
      const w = walk(t, 3), n = w.reduce((s, b) => s + b.evs.length, 0), sec = w.reduce((s, b) => s + b.len, 0);
      expect(n / sec, t).toBeLessThan(25);   // сейчас: hub ~7, map ~16, battle ~18 событий/с
    }
  });

  it('мелодии в нотной записи разбираются', () => {
    expect(noteMidi('A4')).toBe(69); expect(noteMidi('F#5')).toBe(78); expect(noteMidi('Bb3')).toBe(58);
    expect(parseMel('0:A4/5 6:C5/2')).toEqual([{ tk: 0, n: 69, d: 5 }, { tk: 6, n: 72, d: 2 }]);
    expect(() => parseMel('0:H4/2')).toThrow();
  });
});

describe('музыка: звук', () => {
  it('домбра звучит в строй: период струны Карплюса-Стронга × playbackRate = нужная частота (±3 цента)', () => {
    const c: any = new MusicCtx();
    for (const m of [40, 50, 57, 69, 76, 86]) {
      const { buf, rate } = pluckSample(c, m), d: Float32Array = buf.getChannelData(0), want = 440 * Math.pow(2, (m - 69) / 12);
      const lo = Math.floor(44100 / (want * 1.08)), hi = Math.ceil(44100 / (want * 0.92));
      let best = lo, bv = -Infinity;
      for (let k = lo; k <= hi; k++) { let s = 0; for (let i = 2000; i < 6000; i++) s += d[i] * d[i + k]; if (s > bv) { bv = s; best = k; } }
      // параболическая доводка пика
      const ac = (k: number) => { let s = 0; for (let i = 2000; i < 6000; i++) s += d[i] * d[i + k]; return s; };
      const a = ac(best - 1), b = ac(best), cc = ac(best + 1), k = best + 0.5 * (a - cc) / (a - 2 * b + cc);
      const got = (44100 / k) * rate;
      expect(Math.abs(1200 * Math.log2(got / want)), `нота ${m}`).toBeLessThan(3);
      expect(buf.duration).toBeLessThanOrEqual(1.5);   // короткий сухой звук: и память, и процессор
      let pk = 0, finite = true; for (const x of d) { if (!Number.isFinite(x)) finite = false; pk = Math.max(pk, Math.abs(x)); }
      expect(finite).toBe(true); expect(pk).toBeLessThanOrEqual(0.91);
    }
  });

  it('ограничитель прозрачен до 0.6 и не выпускает выше 0.95', () => {
    const c = limiterCurve(), at = (x: number) => c[Math.round((x + 1) / 2 * (c.length - 1))];
    expect(at(0.3)).toBeCloseTo(0.3, 2); expect(at(-0.5)).toBeCloseTo(-0.5, 2);
    expect(Math.max(...c)).toBeLessThanOrEqual(0.95); expect(Math.min(...c)).toBeGreaterThanOrEqual(-0.95);
    expect(at(1)).toBeGreaterThan(0.85);
  });

  it('тракт: компрессор и ограничитель один раз на выход, реверб общий', () => {
    const c: any = new MusicCtx(), out = c.createGain();
    for (const t of ['hub', 'battle'] as Track[]) new Sequencer(c, out, c.createBuffer(1, 44100, 44100), t, 1);
    expect(c.created.comp).toBe(1); expect(c.created.shaper).toBe(1); expect(c.created.conv).toBe(1);
  });

  it('бюджет узлов: создаётся мало узлов на секунду музыки (переиспользование голосов)', () => {
    for (const t of ['hub', 'map', 'battle', 'training'] as Track[]) {
      const c: any = new MusicCtx(), out = c.createGain();
      const s = new Sequencer(c, out, c.createBuffer(1, 44100, 44100), t, 9);
      const base = c.total; s.start(false); s.pump(60);
      const perSec = (c.total - base) / 60;
      expect(perSec, t).toBeLessThan(60);          // сейчас: hub ~14, map ~30, battle ~37 узлов/с
      expect(base, 'постоянные узлы дорожки').toBeLessThan(100);
    }
  });
});

describe('музыка: движок', () => {
  beforeEach(() => { vi.unstubAllGlobals(); vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });
  const musicGainTargets = (audio: any): number[] => audio.musicGain.gain.targets;
  const last = (a: number[]) => a[a.length - 1];

  it('каждое настроение запускается без ошибок и планирует ноты вперёд по таймеру', async () => {
    const { audio } = await freshMusic();
    audio.unlock(); audio.save({ musicInFocus: 'quiet' });   // урок-тренировка подчиняется «фокусу»: при «выкл» трек не крутится
    const ctx: MusicCtx = (audio as any).ctx;
    for (const m of ['hub', 'map', 'battle', 'victory', 'training'] as const) {
      const before = ctx.starts;
      expect(() => audio.setMood(m)).not.toThrow();
      expect(ctx.starts, m).toBeGreaterThan(before);
      const s0 = ctx.starts; ctx.currentTime += 8; vi.advanceTimersByTime(300);
      expect(ctx.starts, `${m}: таймер планирует дальше`).toBeGreaterThan(s0);
    }
  });

  it('смена настроения гасит старый секвенсор, то же настроение не перезапускает', async () => {
    const { audio } = await freshMusic();
    audio.unlock();
    const ctx: MusicCtx = (audio as any).ctx;
    audio.setMood('hub'); const hub = (audio as any).seq;
    audio.setMood('hub'); expect((audio as any).seq).toBe(hub);
    audio.setMood('battle'); const battle = (audio as any).seq;
    expect(battle).not.toBe(hub); expect(battle.track).toBe('battle');
    ctx.currentTime += 4; const s0 = ctx.starts; vi.advanceTimersByTime(3500);
    // после смены таймер старого стоит; узлы старого отсоединены после затухания
    expect(ctx.disconnects).toBeGreaterThan(0);
    expect(ctx.starts).toBeGreaterThan(s0);   // играет новый
  });

  it('silent останавливает всё: новые ноты не планируются', async () => {
    const { audio } = await freshMusic();
    audio.unlock(); audio.setMood('map');
    const ctx: MusicCtx = (audio as any).ctx;
    audio.setMood('silent'); expect((audio as any).seq).toBeNull();
    const s = ctx.starts; ctx.currentTime += 30; vi.advanceTimersByTime(5000);
    expect(ctx.starts).toBe(s);
    expect(last(musicGainTargets(audio))).toBe(0);
  });

  it('режим фокуса: «выкл» останавливает секвенсор (не тратит батарею), «тихо» играет на 25%', async () => {
    const { audio } = await freshMusic();
    audio.unlock(); audio.save({ music: 0.4, musicInFocus: 'off' });
    audio.setMood('hub'); expect((audio as any).seq).not.toBeNull();
    audio.setMood('focus'); expect((audio as any).seq).toBeNull();
    expect(last(musicGainTargets(audio))).toBe(0);
    audio.save({ musicInFocus: 'quiet' });                       // переключили в настройках прямо в задаче
    expect((audio as any).seq).not.toBeNull();
    expect(last(musicGainTargets(audio))).toBeCloseTo(0.4 * 0.25, 5);
    audio.setMood('hub'); expect(last(musicGainTargets(audio))).toBeCloseTo(0.4, 5);
  });

  it('тренировка (урок) подчиняется «фокусу»: «выкл» — тишина, «тихо» — свой трек на 25%', async () => {
    const { audio } = await freshMusic();
    audio.unlock(); audio.save({ music: 0.4, musicInFocus: 'off' });
    audio.setMood('training');
    expect((audio as any).seq).toBeNull();
    expect(last(musicGainTargets(audio))).toBeCloseTo(0, 5);
    audio.save({ musicInFocus: 'quiet' });
    expect((audio as any).seq?.track).toBe('training');
    expect(last(musicGainTargets(audio))).toBeCloseTo(0.4 * 0.25, 5);
    audio.setMood('battle'); expect((audio as any).seq.track).toBe('battle'); expect(last(musicGainTargets(audio))).toBeCloseTo(0.4, 5);
  });

  it('голос Бита приглушает музыку до 35%, потом громкость возвращается', async () => {
    const audios: any[] = [];
    vi.stubGlobal('Audio', class { paused = false; ended = false; volume = 1; onpause: any; onended: any; onerror: any; constructor() { audios.push(this); } pause() { this.paused = true; this.onpause?.(); } play() { return Promise.resolve(); } });
    const { audio } = await freshMusic();
    audio.unlock(); audio.save({ music: 0.5 }); audio.setMood('battle');
    audio.say('voice.mp3'); await Promise.resolve(); await Promise.resolve();
    expect(last(musicGainTargets(audio))).toBeCloseTo(0.5 * 0.35, 5);
    audios[0].paused = true; audios[0].ended = true; audios[0].onended();
    expect(last(musicGainTargets(audio))).toBeCloseTo(0.5, 5);
  });

  it('если музыка не смогла запуститься (нет узлов у старого браузера), игра не падает', async () => {
    const { audio } = await freshMusic();
    audio.unlock();
    const ctx: any = (audio as any).ctx; ctx.createConvolver = () => { throw new Error('нет'); };
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(() => audio.setMood('hub')).not.toThrow();
    expect((audio as any).seq).toBeNull(); expect(warn).toHaveBeenCalled();
    expect(() => audio.play('correct')).not.toThrow();
    warn.mockRestore();
  });
});
