// Видео-объяснение «Көр»: караоке, метки указки и ход плеера (кадр → голос → пауза → следующий), проверенные на подменённых часах и звуке.
import { describe, it, expect, vi, afterEach } from 'vitest';
// @ts-ignore
import { LESSONS } from '../content/lessons.mjs';
import { karaoke, wordAt, cueFor, cuesFor, highlights } from '../src/lesson/video';
import { VideoPlayer, LEAD_MS, TAIL_MS, STALL_MS, VOICE_START_MS, type Voice, type VFrame } from '../src/lesson/video.svelte';
import { readMs } from '../src/lib/readgate.svelte';

describe('karaoke — слова по времени речи', () => {
  it('доли идут подряд от 0 до 1, длинное слово дольше короткого, после точки пауза', () => {
    const w = karaoke('Бір екі үшінші. Төртінші');
    expect(w[0].a).toBe(0); expect(w.at(-1)!.b).toBe(1);
    for (let k = 1; k < w.length; k++) expect(w[k].a).toBeCloseTo(w[k - 1].b, 9);
    const len = (x: { a: number; b: number }) => x.b - x.a;
    expect(len(w[2])).toBeGreaterThan(len(w[0]));
    expect(len(w[2])).toBeGreaterThan(len(w[1]));
  });
  it('wordAt: начало — первое слово, конец — последнее', () => {
    const w = karaoke('а бб ввв гггг');
    expect(wordAt(w, 0)).toBe(0); expect(wordAt(w, 1)).toBe(3); expect(wordAt(w, 0.5)).toBeGreaterThan(0);
    expect(wordAt([], 0.5)).toBe(-1);
  });
});

describe('cueFor — когда голос называет подсвеченное', () => {
  it('число в слове с окончанием («2-ге») находится, не путается с «12» и «2/3»', () => {
    const kz = '60 жұп → 2-ге бөлінеді. 2 — жай';
    const c = cueFor(kz, '2');
    expect(c).toBeGreaterThan(0.2); expect(c).toBeLessThan(0.9);
    expect(cueFor('12 және 2/3 бар', '2')).toBe(0.5);
  });
  it('нет в подписи — середина; дробь и разряды ищутся целиком', () => {
    expect(cueFor('Бүтін пицца.', '7')).toBe(0.5);
    expect(cueFor('Қалған бөлік — 5/8. Бөлімде барлық бөлік', '5/8')).toBeGreaterThan(0.1);
    expect(cueFor('Бірліктер: 5 → 005.', '005')).toBeGreaterThan(0.3);
  });
  it('highlights: [..] по порядку', () => { expect(highlights('15 = [3] · [5]')).toEqual(['3', '5']); expect(highlights(undefined)).toEqual([]); });
  it('во всех кадрах «Көр» метки лежат в (0, 0.9], а число в подписи находится в большинстве', () => {
    let n = 0, found = 0;
    for (const steps of Object.values(LESSONS) as any[][]) for (const s of steps) if (s.type === 'example') for (const f of s.frames) {
      const cues = cuesFor(f.kz ?? '', f.math);
      for (const c of cues) { n++; expect(c).toBeGreaterThanOrEqual(0); expect(c).toBeLessThanOrEqual(0.9); if (c !== 0.5) found++; }
    }
    expect(n).toBeGreaterThan(100); expect(found / n).toBeGreaterThan(0.6);
  });
});

// ---------- плеер ----------
class FakeVoice extends EventTarget implements Voice {
  duration: number; currentTime = 0; paused = false; ended = false; plays = 1;
  constructor(d: number) { super(); this.duration = d; }
  pause() { this.paused = true; }
  play() { this.paused = false; this.plays++; }
  finish() { this.currentTime = this.duration; this.ended = true; this.paused = true; this.dispatchEvent(new Event('ended')); }
  addEventListener(t: any, f: any) { super.addEventListener(t, f); } removeEventListener(t: any, f: any) { super.removeEventListener(t, f); }
}
function rig(opts: { voice?: boolean; urls?: boolean; gap?: number[]; frames?: VFrame[] } = {}) {
  vi.useFakeTimers();
  const voices: FakeVoice[] = []; const log: string[] = []; const gaps = new Set(opts.gap ?? []);
  const frames = opts.frames ?? [0, 1, 2].map(k => ({ kz: `Кадр ${k} сөйлем`, math: `[${k + 1}] + 1`, url: opts.urls === false ? '' : `v${k}.mp3` }));
  let ended = 0, replays = 0; const seen: number[] = [];
  const v = new VideoPlayer({
    frames,
    deps: { say: () => { const x = new FakeVoice(4); voices.push(x); return x; }, stop: () => log.push('stop'), voiceOn: () => opts.voice !== false },
    gapOpen: k => gaps.has(k), onframe: k => seen.push(k), onend: () => ended++, onreplay: () => replays++,
  });
  v.start();
  return { v, voices, log, gaps, seen, ended: () => ended, replays: () => replays, frames };
}
afterEach(() => vi.useRealTimers());

describe('VideoPlayer', () => {
  it('кадр → пауза-вход → голос → конец голоса + 0,6 с → следующий кадр; на последнем конец', () => {
    const r = rig();
    expect(r.v.phase).toBe('lead'); expect(r.v.frame).toBe(0);
    r.v.tick(LEAD_MS); expect(r.v.phase).toBe('talk'); expect(r.v.mode).toBe('voice'); expect(r.voices.length).toBe(1);
    r.voices[0].currentTime = 2; r.v.tick(50); expect(r.v.p).toBeCloseTo(0.5, 2);
    r.voices[0].finish(); expect(r.v.phase).toBe('tail'); expect(r.v.p).toBe(1);
    r.v.tick(TAIL_MS - 10); expect(r.v.frame).toBe(0);
    r.v.tick(20); expect(r.v.frame).toBe(1); expect(r.v.phase).toBe('lead');
    for (const k of [1, 2]) { r.v.tick(LEAD_MS); r.voices.at(-1)!.finish(); r.v.tick(TAIL_MS); void k; }
    expect(r.v.phase).toBe('end'); expect(r.ended()).toBe(1); expect(r.seen).toEqual([0, 1, 2]);
    r.v.destroy();
  });
  it('без звука и без файла голоса кадр длится время чтения', () => {
    for (const o of [{ voice: false }, { urls: false }]) {
      const r = rig(o); const f = r.frames[0];
      r.v.tick(LEAD_MS); expect(r.v.mode).toBe('read'); expect(r.voices.length).toBe(0);
      const ms = readMs(f.math, f.kz);
      r.v.tick(ms - 100); expect(r.v.phase).toBe('talk'); r.v.tick(200); expect(r.v.phase).toBe('tail');
      r.v.destroy();
    }
  });
  it('пропуск: видео стоит, голос не играет, после верного выбора — короткая пауза и голос кадра', () => {
    const r = rig({ gap: [1] });
    r.v.tick(LEAD_MS); r.voices[0].finish(); r.v.tick(TAIL_MS);
    expect(r.v.frame).toBe(1); r.v.tick(LEAD_MS); expect(r.v.phase).toBe('gap'); expect(r.voices.length).toBe(1);
    r.v.tick(60000); expect(r.v.phase).toBe('gap'); expect(r.voices.length).toBe(1);
    r.v.play(); expect(r.v.phase).toBe('gap');            // «играть» не обходит пропуск
    r.gaps.delete(1); r.v.gapSolved(); expect(r.v.phase).toBe('lead');
    r.v.tick(700); expect(r.v.phase).toBe('talk'); expect(r.voices.length).toBe(2);
    r.v.destroy();
  });
  it('голос не загрузился (error) — остаток кадра по времени чтения, кадр не зависает', () => {
    const r = rig(); r.v.tick(LEAD_MS);
    r.voices[0].dispatchEvent(new Event('error'));
    expect(r.v.mode).toBe('read');
    r.v.tick(readMs(r.frames[0].math, r.frames[0].kz) + 10); expect(r.v.phase).toBe('tail');
    r.v.destroy();
  });
  it('голос не начал играть или застыл — тоже уходит на таймер', () => {
    const a = rig(); a.v.tick(LEAD_MS); a.v.tick(VOICE_START_MS + 100); expect(a.v.mode).toBe('read'); a.v.destroy();
    const b = rig(); b.v.tick(LEAD_MS); b.voices[0].currentTime = 1; b.v.tick(50); b.v.tick(STALL_MS + 100); expect(b.v.mode).toBe('read'); b.v.destroy();
  });
  it('пауза замораживает время и голос; hold (диалог выхода) — тоже', () => {
    const r = rig(); r.v.tick(LEAD_MS); r.voices[0].currentTime = 1; r.v.tick(50);
    r.v.pause(); expect(r.voices[0].paused).toBe(true);
    const p0 = r.v.p; r.v.tick(20000); expect(r.v.p).toBe(p0); expect(r.v.phase).toBe('talk');
    r.v.play(); expect(r.voices[0].paused).toBe(false);
    r.v.hold(true); expect(r.voices[0].paused).toBe(true); r.v.tick(20000); expect(r.v.phase).toBe('talk');
    r.v.hold(false); expect(r.voices[0].paused).toBe(false);
    r.v.destroy();
  });
  it('«ещё раз» и «басынан»: снова с начала кадра, сцена сбрасывается, звук гасится', () => {
    const r = rig(); r.v.tick(LEAD_MS); r.voices[0].finish(); r.v.tick(TAIL_MS); r.v.tick(LEAD_MS);
    expect(r.v.frame).toBe(1); const run = r.v.run;
    r.v.again(); expect(r.v.frame).toBe(1); expect(r.v.phase).toBe('lead'); expect(r.v.run).toBe(run + 1); expect(r.replays()).toBe(1);
    r.v.restart(); expect(r.v.frame).toBe(0); expect(r.replays()).toBe(2);
    expect(r.log.filter(x => x === 'stop').length).toBeGreaterThanOrEqual(2);
    r.v.destroy();
  });
  it('на конце «ещё раз» снова доходит до конца; destroy гасит звук и часы', () => {
    const r = rig({ urls: false, frames: [{ kz: 'бір', math: '[1]', url: '' }] });
    const play = () => { r.v.tick(LEAD_MS); r.v.tick(5000); r.v.tick(TAIL_MS); };
    play(); expect(r.v.phase).toBe('end');
    r.v.again(); play(); expect(r.v.phase).toBe('end'); expect(r.ended()).toBe(2);
    r.v.destroy(); const n = r.log.length; r.v.tick(99999); expect(r.log.length).toBe(n); expect(r.log.at(-1)).toBe('stop');
  });
});
