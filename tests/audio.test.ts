// Звук: семплы на месте и в бюджете; движок играет семпл, когда он загружен, и синтез, когда нет.
import { describe, it, expect, vi, beforeEach } from 'vitest';
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

  it('без unlock() play ничего не делает', async () => {
    const { audio } = await fresh(okFetch());
    expect(() => audio.play('click')).not.toThrow();
    expect(audio.sfxStatus().state).toBe('none');
  });
});
