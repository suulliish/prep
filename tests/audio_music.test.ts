// Музыка: когда звук выключен или вкладка в фоне, секвенсор не считает и не планирует ноты; при включении идёт дальше с того же трека.
// Голоса (Web Audio) подменены заглушкой: считаем только вызовы play, то есть реально запланированные ноты.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const played = { n: 0, disposed: 0 };
vi.mock('../src/lib/music/synth', () => ({
  getRig: () => ({}),
  Voices: class { play() { played.n++; } setLevel() {} dispose() { played.disposed++; } },
}));

import { Sequencer } from '../src/lib/music/sequencer';

const ctx = (t = { now: 0 }) => ({ get currentTime() { return t.now; }, t }) as any;
const tick = (c: any, sec: number) => { for (let i = 0; i < sec * 10; i++) { c.t.now += 0.1; vi.advanceTimersByTime(100); } };

describe('Sequencer: пауза и продолжение', () => {
  beforeEach(() => { vi.useFakeTimers(); played.n = 0; });
  afterEach(() => vi.useRealTimers());

  it('на паузе ноты не планируются, после resume музыка идёт дальше', () => {
    const c = ctx(), s = new Sequencer(c, {} as any, {} as any, 'hub', 7);
    s.start();
    tick(c, 6);
    const running = played.n;
    expect(running).toBeGreaterThan(5);
    s.pause();
    expect(s.paused).toBe(true);
    const before = played.n;
    tick(c, 30);
    expect(played.n).toBe(before);                    // ни одной ноты за 30 секунд паузы
    s.resume();
    expect(s.paused).toBe(false);
    tick(c, 6);
    expect(played.n).toBeGreaterThan(before + 5);     // снова играет
    s.stop();
  });

  it('pause и resume безопасны при повторных вызовах и после stop; ручной режим не заводит таймер', () => {
    const c = ctx(), s = new Sequencer(c, {} as any, {} as any, 'map', 3);
    s.start();
    s.pause(); s.pause(); s.resume(); s.resume();
    tick(c, 3);
    expect(played.n).toBeGreaterThan(0);
    s.stop(); s.pause(); s.resume();
    expect(s.paused).toBe(false);
    const m = new Sequencer(ctx(), {} as any, {} as any, 'hub', 1);
    m.start(false); m.resume();
    expect(vi.getTimerCount()).toBeLessThanOrEqual(1);   // только таймер dispose от stop(); своего таймера у ручного нет
  });
});

// ---- движок: выключили музыку/звук или ушли из вкладки ----
function fakeParam() { return { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime() {} }; }
function fakeNode(): any { return { gain: fakeParam(), frequency: fakeParam(), connect: (x: any) => x, disconnect() {}, start() {}, stop() {} }; }
class FakeCtx {
  state = 'running'; static now = 0; sampleRate = 44100; destination = fakeNode();
  get currentTime() { return FakeCtx.now; }
  createGain() { return fakeNode(); }
  createBuffer(_c: number, len: number) { return { getChannelData: () => new Float32Array(len) }; }
  resume() { return Promise.resolve(); }
}

describe('движок: музыка при выключенном звуке и в фоновой вкладке', () => {
  let visible: () => void; let doc: any;
  async function engine() {
    vi.resetModules(); FakeCtx.now = 0; played.n = 0;
    const listeners: (() => void)[] = [];
    doc = { visibilityState: 'visible', addEventListener: (_: string, f: () => void) => listeners.push(f) };
    visible = () => listeners.forEach(f => f());
    vi.stubGlobal('window', { AudioContext: FakeCtx });
    vi.stubGlobal('document', doc);
    vi.stubGlobal('localStorage', { getItem: () => null, setItem() {} });
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('offline'); }));
    const { audio } = await import('../src/lib/audio');
    return audio as any;
  }
  const run = (sec: number) => { for (let i = 0; i < sec * 10; i++) { FakeCtx.now += 0.1; vi.advanceTimersByTime(100); } };
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

  it('звук выключен (master 0): планирование стоит; включили: тот же трек идёт дальше', async () => {
    const audio = await engine();
    audio.unlock(); audio.setMood('battle');
    const seq = audio.seq;
    expect(seq.track).toBe('battle');
    run(5); expect(played.n).toBeGreaterThan(3);
    audio.save({ master: 0 });
    const n = played.n; run(30);
    expect(played.n).toBe(n);
    audio.save({ master: 0.8 });
    run(5);
    expect(played.n).toBeGreaterThan(n + 3);
    expect(audio.seq).toBe(seq);                       // не пересоздан, трек тот же
  });

  it('ползунок музыки на нуле тоже останавливает планирование', async () => {
    const audio = await engine();
    audio.unlock(); audio.setMood('hub');
    audio.save({ music: 0 });
    const n = played.n; run(20);
    expect(played.n).toBe(n);
    audio.save({ music: 0.35 }); run(4);
    expect(played.n).toBeGreaterThan(n);
  });

  it('вкладка ушла в фон: музыка стоит; вернулись: играет; при выключенном звуке не оживает', async () => {
    const audio = await engine();
    audio.unlock(); audio.setMood('map');
    run(3);
    doc.visibilityState = 'hidden'; visible();
    const n = played.n; run(20);
    expect(played.n).toBe(n);
    doc.visibilityState = 'visible'; visible(); run(4);
    expect(played.n).toBeGreaterThan(n + 2);
    audio.save({ master: 0 });
    doc.visibilityState = 'hidden'; visible(); doc.visibilityState = 'visible'; visible();
    const m = played.n; run(20);
    expect(played.n).toBe(m);                          // звук выключен: возвращение во вкладку музыку не будит
  });
});
