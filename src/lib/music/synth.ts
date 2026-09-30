// Голоса музыки на WebAudio. Ничего не грузится из сети: домбра — струна Карплюса-Стронга, посчитанная один раз
// на каждую высоту и кэшированная; дрон, сыбызгы и колокольчики — генераторы; барабаны — синус и шум.
// Экономия: дрон, флейта и шины живут весь трек (переиспользуются), на ноту создаются только 2–3 узла.
import { midiHz } from './notes';
import type { Ev } from './tracks';

const hasFn = (o: any, name: string) => typeof o?.[name] === 'function';

// ---------- общий тракт: компрессор + мягкий ограничитель + реверб (один на выход) ----------
export interface Rig { input: GainNode; verb: GainNode }
const rigs = new WeakMap<object, Rig>();

/** Мягкий ограничитель: ниже 0.6 не трогает сигнал, выше плавно прижимает к 0.95, поэтому клиппинга не бывает. */
export function limiterCurve(): Float32Array {
  const n = 2048, c = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1, a = Math.abs(x);
    c[i] = Math.sign(x) * (a < 0.6 ? a : 0.6 + 0.35 * Math.tanh((a - 0.6) / 0.35));
  }
  return c;
}
/** Импульс комнаты ~1.2 с: моно-шум с экспоненциальным затуханием и потемнением хвоста (моно вдвое дешевле стерео; ширину даёт панорама голосов). */
function makeImpulse(c: BaseAudioContext): AudioBuffer {
  const sr = c.sampleRate, len = Math.floor(sr * 1.2), buf = c.createBuffer(1, len, sr);
  let seed = 1234567;
  const rnd = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296 * 2 - 1; };
  for (let ch = 0; ch < 1; ch++) {
    const d = buf.getChannelData(ch); let lp = 0;
    for (let i = 0; i < len; i++) {
      const t = i / len, k = 0.55 - 0.4 * t;         // фильтр закрывается к хвосту
      lp += k * (rnd() - lp);
      d[i] = lp * Math.pow(1 - t, 2.6) * (i < 400 ? i / 400 : 1);
    }
  }
  return buf;
}
export function getRig(c: AudioContext, out: AudioNode): Rig {
  let r = rigs.get(out);
  if (r) return r;
  const input = c.createGain();
  const comp = c.createDynamicsCompressor();
  comp.threshold.value = -16; comp.knee.value = 12; comp.ratio.value = 5; comp.attack.value = 0.006; comp.release.value = 0.22;
  const clip = c.createWaveShaper(); clip.curve = limiterCurve() as any;
  const verb = c.createGain(), conv = c.createConvolver(), wet = c.createGain();
  conv.buffer = makeImpulse(c); wet.gain.value = 0.55;
  verb.connect(conv); conv.connect(wet); wet.connect(input);
  input.connect(comp); comp.connect(clip); clip.connect(out);
  r = { input, verb }; rigs.set(out, r);
  return r;
}

// ---------- домбра: струна Карплюса-Стронга ----------
const pluckCache = new WeakMap<object, Map<number, AudioBuffer>>();
/** Период петли ≈ N−0.5 сэмпла (усреднение соседних отсчётов); точную высоту дотягивает playbackRate. */
export function pluckSample(c: BaseAudioContext, midi: number): { buf: AudioBuffer; rate: number } {
  const f = midiHz(midi), sr = c.sampleRate, N = Math.max(4, Math.round(sr / f));
  let m = pluckCache.get(c); if (!m) { m = new Map(); pluckCache.set(c, m); }
  let buf = m.get(N);
  if (!buf) {
    const t60 = f < 200 ? 1.3 : f < 450 ? 1.0 : f < 900 ? 0.75 : 0.5;    // сухой, деревянный звук: короткий сустейн
    const len = Math.floor(sr * t60 * 1.15);
    buf = c.createBuffer(1, len, sr);
    const d = buf.getChannelData(0);
    let seed = (N * 2654435761) >>> 0, lp = 0;
    const rnd = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296 * 2 - 1; };
    for (let i = 0; i < N; i++) { lp += 0.5 * (rnd() - lp); d[i] = lp; }      // мягкий щипок: тёмный шум
    const loss = Math.pow(10, -3 * (N / sr) / t60);                            // потери за период под заданное время затухания
    for (let i = N; i < len; i++) d[i] = loss * 0.5 * (d[i - N] + d[i - N + 1]);
    let pk = 0; for (let i = 0; i < len; i++) pk = Math.max(pk, Math.abs(d[i]));
    const fade = Math.floor(sr * 0.05), g = 0.9 / (pk || 1);
    for (let i = 0; i < len; i++) d[i] *= g * (i > len - fade ? (len - i) / fade : 1);
    m.set(N, buf);
  }
  return { buf, rate: f * (N - 0.5) / sr };
}

const eg = (g: GainNode, t: number, peak: number, dur: number, att = 0.004) => {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + att);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
};

/** Отладка микса: виды событий, которые не играть (dev-страница music.html, тесты). */
export const debugMute = new Set<string>();

export interface DroneCfg { root: number; cut: number }

export class Voices {
  readonly out: GainNode;                  // выход дорожки: им плавно гасим/включаем трек
  private c: AudioContext;
  private nodes: AudioNode[] = [];
  private srcs: (OscillatorNode | AudioBufferSourceNode)[] = [];
  private busPluck: [GainNode, GainNode]; private busBell: [GainNode, GainNode];
  private busBass: GainNode; private busDrum: GainNode; private busSlap: GainNode; private busShake: GainNode; private busFlute: GainNode;
  private padGain: GainNode;
  private fGain: GainNode; private fBreath: GainNode; private fOsc: OscillatorNode;
  private stopped = false;

  constructor(c: AudioContext, rig: Rig, private noiseBuf: AudioBuffer, private rng: () => number, drone: DroneCfg, echoSec: number) {
    this.c = c;
    const mk = <T extends AudioNode>(n: T) => { this.nodes.push(n); return n; };
    const gain = (v = 1) => { const g = mk(c.createGain()); g.gain.value = v; return g; };
    const filt = (type: BiquadFilterType, f: number, q = 0.7, gdb = 0) => { const b = mk(c.createBiquadFilter()); b.type = type; b.frequency.value = f; b.Q.value = q; b.gain.value = gdb; return b; };
    const pan = (p: number): AudioNode | null => { if (!hasFn(c, 'createStereoPanner')) return null; const n = mk(c.createStereoPanner()); n.pan.value = p; return n; };
    const src = <T extends OscillatorNode | AudioBufferSourceNode>(s: T) => { this.srcs.push(s); this.nodes.push(s); return s; };
    const osc = (type: OscillatorType, f: number) => { const o = src(c.createOscillator()); o.type = type; o.frequency.value = f; return o; };

    this.out = gain(0);
    // эхо (пунктирная восьмая) с потемнением повторов
    const echoIn = gain(1), delay = mk(c.createDelay(2)), fb = gain(0.36), elp = filt('lowpass', 2400, 0.5), ewet = gain(0.3);
    delay.delayTime.value = echoSec; echoIn.connect(delay); delay.connect(elp); elp.connect(fb); fb.connect(delay); elp.connect(ewet); ewet.connect(this.out);
    // отвод голоса: сухо + реверб + эхо
    const wire = (from: AudioNode, verb: number, echo: number, p: AudioNode | null = null) => {
      let a = from; if (p) { from.connect(p); a = p; }
      a.connect(this.out);
      if (verb) { const s = gain(verb); a.connect(s); s.connect(rig.verb); }
      if (echo) { const s = gain(echo); a.connect(s); s.connect(echoIn); }
    };
    this.out.connect(rig.input);

    // домбра: две струны слева/справа, «деревянный» корпус
    const pl = (p: number): GainNode => { const g = gain(0.8), body = filt('peaking', 750, 1.1, 4), lp = filt('lowpass', 6000); g.connect(body); body.connect(lp); wire(lp, 0.22, 0.2, pan(p)); return g; };
    this.busPluck = [pl(-0.3), pl(0.3)];
    // колокольчики
    const bl = (p: number): GainNode => { const g = gain(0.9); wire(g, 0.7, 0.3, pan(p)); return g; };
    this.busBell = [bl(-0.4), bl(0.4)];
    // бас
    this.busBass = gain(1); const blp = filt('lowpass', 700); this.busBass.connect(blp); wire(blp, 0, 0);
    // барабаны
    this.busDrum = gain(0.6); wire(this.busDrum, 0.1, 0);
    this.busSlap = gain(1); const bp = filt('bandpass', 2100, 0.9); this.busSlap.connect(bp); bp.connect(this.busDrum);
    this.busShake = gain(1); const hp = filt('highpass', 6500); this.busShake.connect(hp); hp.connect(this.busDrum);

    // дрон кобыза: две расстроенные пилы + квинта, срез фильтра медленно «дышит»
    const dp = midiHz(drone.root), padLp = filt('lowpass', drone.cut, 0.8);
    this.padGain = gain(0);
    for (const [ty, f, v] of [['sawtooth', dp, 0.5], ['sawtooth', dp * 1.0045, 0.5], ['sawtooth', dp * 1.5, 0.22], ['sine', dp / 2, 0.55]] as const) { const o = osc(ty, f), g = gain(v); o.connect(g); g.connect(padLp); }
    const lfo = osc('sine', 0.07), lg = gain(drone.cut * 0.3); lfo.connect(lg); lg.connect(padLp.frequency);
    padLp.connect(this.padGain); wire(this.padGain, 0.35, 0);
    this.padGain.gain.value = 0;

    // сыбызгы: одна вечная нота-осциллятор с огибающей (одноголосная), вибрато и дыхание
    this.fOsc = osc('sine', 440);
    if (hasFn(c, 'createPeriodicWave')) { try { this.fOsc.setPeriodicWave(c.createPeriodicWave(new Float32Array([0, 0, 0, 0, 0]), new Float32Array([0, 1, 0.35, 0.12, 0.05]))); } catch { /* останется синус */ } }
    this.fGain = gain(0); this.busFlute = gain(0.9);
    const vib = osc('sine', 5.2), vg = gain(7); vib.connect(vg); if (this.fOsc.detune) vg.connect(this.fOsc.detune);   // старый Safari без detune: без вибрато
    const flp = filt('lowpass', 3600);
    this.fOsc.connect(this.fGain); this.fGain.connect(flp); flp.connect(this.busFlute);
    const nz = src(c.createBufferSource()); nz.buffer = noiseBuf; nz.loop = true;
    const nbp = filt('bandpass', 2800, 1.1); this.fBreath = gain(0);
    nz.connect(nbp); nbp.connect(this.fBreath); this.fBreath.connect(this.busFlute);
    wire(this.busFlute, 0.5, 0.18);

    const t0 = c.currentTime;
    for (const s of this.srcs) s.start(t0);
  }

  setLevel(v: number, t: number, tc: number) { this.out.gain.setTargetAtTime(v, t, tc); }

  /** Разовая нота/удар в момент t (секунды часов AudioContext). */
  play(e: Ev, t: number) {
    if (this.stopped || debugMute.has(e.k)) return;
    switch (e.k) {
      case 'pluck': return this.pluck(t, e.n, e.v, e.s, e.d);
      case 'bass': return this.bass(t, e.n, e.v, e.d);
      case 'bell': return this.bell(t, e.n, e.v, e.s);
      case 'flute': return this.flute(t, e.n, e.v, e.d);
      case 'kick': return this.kick(t, e.v);
      case 'tom': return this.tom(t, midiHz(e.n), e.v);
      case 'tak': return this.tak(t, e.v);
      case 'shake': return this.shake(t, e.v);
      case 'pad': this.padGain.gain.setTargetAtTime(e.v * 0.065, t, Math.max(0.1, e.d / 3)); return;
    }
  }

  private done(a: AudioNode, b?: AudioNode, c2?: AudioNode) {
    (a as any).onended = () => { a.disconnect(); b?.disconnect(); c2?.disconnect(); };
  }
  private pluck(t: number, midi: number, v: number, s: number, ring: number) {
    const { buf, rate } = pluckSample(this.c, midi);
    const src = this.c.createBufferSource(), g = this.c.createGain();
    src.buffer = buf; src.playbackRate.value = rate; g.gain.value = v;
    src.connect(g); g.connect(this.busPluck[s]); src.start(t); this.done(src, g);
    if (ring > 0 && ring < buf.duration - 0.1) { g.gain.setValueAtTime(v, t + ring); g.gain.linearRampToValueAtTime(0, t + ring + 0.08); src.stop(t + ring + 0.1); }   // короткий удар не тащит длинный хвост
  }
  private bass(t: number, midi: number, v: number, dur: number) {
    const o = this.c.createOscillator(), g = this.c.createGain();
    o.type = 'triangle'; o.frequency.value = midiHz(midi); eg(g, t, v * 0.5, Math.max(dur, 0.2), 0.012);
    o.connect(g); g.connect(this.busBass); o.start(t); o.stop(t + Math.max(dur, 0.2) + 0.05); this.done(o, g);
  }
  private bell(t: number, midi: number, v: number, s: number) {
    const f = midiHz(midi), c = this.c, o1 = c.createOscillator(), o2 = c.createOscillator(), g = c.createGain(), g2 = c.createGain();
    o1.frequency.value = f; o2.frequency.value = f * 2.76; g2.gain.value = 0.28;
    eg(g, t, v * 0.6, 1.6, 0.003);
    o1.connect(g); o2.connect(g2); g2.connect(g); g.connect(this.busBell[s]);
    o1.start(t); o2.start(t); o1.stop(t + 1.65); o2.stop(t + 1.65);
    o1.onended = () => { o1.disconnect(); o2.disconnect(); g.disconnect(); g2.disconnect(); };
  }
  private flute(t: number, midi: number, v: number, dur: number) {
    const f = midiHz(midi);
    this.fOsc.frequency.setTargetAtTime(f, t, 0.03);
    for (const [g, k] of [[this.fGain, 0.17], [this.fBreath, 0.035]] as const) {
      g.gain.setTargetAtTime(v * k, t, 0.07);
      g.gain.setTargetAtTime(0, t + dur, 0.1);
    }
  }
  private noiseHit(t: number, dur: number, peak: number, to: AudioNode) {
    const c = this.c, s = c.createBufferSource(), g = c.createGain();
    s.buffer = this.noiseBuf; eg(g, t, peak, dur, 0.001);
    s.connect(g); g.connect(to); s.start(t, this.rng() * 0.7); s.stop(t + dur + 0.02); this.done(s, g);
  }
  private kick(t: number, v: number) {
    const o = this.c.createOscillator(), g = this.c.createGain();
    o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(52, t + 0.1);
    eg(g, t, v * 0.9, 0.34, 0.003); o.connect(g); g.connect(this.busDrum); o.start(t); o.stop(t + 0.38); this.done(o, g);
  }
  private tom(t: number, f: number, v: number) {
    const o = this.c.createOscillator(), g = this.c.createGain();
    o.frequency.setValueAtTime(f * 1.6, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.07);
    eg(g, t, v * 0.7, 0.26, 0.003); o.connect(g); g.connect(this.busDrum); o.start(t); o.stop(t + 0.3); this.done(o, g);
  }
  private tak(t: number, v: number) {
    this.noiseHit(t, 0.1, v * 0.55, this.busSlap);
    const o = this.c.createOscillator(), g = this.c.createGain();
    o.frequency.value = 210; eg(g, t, v * 0.25, 0.07, 0.002); o.connect(g); g.connect(this.busDrum); o.start(t); o.stop(t + 0.1); this.done(o, g);
  }
  private shake(t: number, v: number) { this.noiseHit(t, 0.05, v * 0.5, this.busShake); }

  /** Остановка: генераторы гасятся, узлы отсоединяются (после затухания хвостов). */
  dispose() {
    if (this.stopped) return; this.stopped = true;
    const now = this.c.currentTime;
    for (const s of this.srcs) { try { s.stop(now + 0.01); } catch { /* уже остановлен */ } }
    for (const n of this.nodes) { try { n.disconnect(); } catch { /* ok */ } }
  }
}
