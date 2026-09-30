// Композиция: четыре трека в казахском фэнтези-стиле. Всё здесь чистые данные и функции без WebAudio:
// каждый такт превращается в список событий (нота, барабан, колокольчик), а звук делает synth.ts.
//
// Инструменты (см. synth.ts): dombra — щипковая струна (пара струн, тремоло «шертпе» на долгих нотах),
// flute — дыхание сыбызгы, pad — дрон кобыза на тонике, bass — мягкий низ, bell — колокольчики,
// kick/tom/tak/shake — ручные барабаны (даулпаз, дойра, бубенцы).
// Лады: минорная пентатоника и дорийский лад. Ритм: 6/8 у «Корабля», «конский галоп» (доля из ноты и двух коротких) у карты.
import { noteMidi, parseMel, mulberry32, type MelNote } from './notes';

export type Track = 'hub' | 'battle' | 'map' | 'victory';
export type EvKind = 'pluck' | 'bass' | 'flute' | 'bell' | 'kick' | 'tom' | 'tak' | 'shake' | 'pad';
/** t — секунды от начала такта; n — нота MIDI; v — сила 0..1; d — длина/затухание, с (у pad — время плавного перехода); s — струна/сторона 0|1. */
export interface Ev { t: number; k: EvKind; n: number; v: number; d: number; s: 0 | 1 }

export interface TrackDef {
  tickSec: number;            // длина «тика» (шестнадцатой), с
  ticks: number;              // тиков в такте: 12 (6/8) или 16 (4/4)
  bars: number;               // длина петли в тактах
  level: number;              // громкость дорожки
  drone: { root: number; cut: number };  // дрон: основной тон MIDI и срез фильтра, Гц
  echoTicks: number;          // задержка эха в тиках
  plan(b: Bar, bar: number, loop: number, soft: boolean): void;
  after?: Track;              // после intro тактов трек продолжается другим (победа → тихий «Корабль»)
  intro?: number;
}

/** Такт под сборкой: методы кладут события по номеру тика (можно дробный). */
export class Bar {
  evs: Ev[] = [];
  constructor(readonly sec: number, readonly ticks: number, readonly rng: () => number) {}
  private add(k: EvKind, tk: number, n: number, v: number, d = 0, s: 0 | 1 = 0) { this.evs.push({ t: tk * this.sec, k, n, v, d, s }); }
  /** ringTicks: как долго звенит струна (0 = по умолчанию ~1 с); у частых ударов тремоло короче — так меньше голосов одновременно. */
  pluck(tk: number, n: number, v: number, s: 0 | 1 = 0, ringTicks = 0) { this.add('pluck', tk, n, v, ringTicks * this.sec, s); }
  bass(tk: number, n: number, v: number, dTicks: number) { this.add('bass', tk, n, v, dTicks * this.sec); }
  bell(tk: number, n: number, v: number, s: 0 | 1 = 0) { this.add('bell', tk, n, v, 0, s); }
  kick(tk: number, v: number) { this.add('kick', tk, 0, v); }
  tom(tk: number, n: number, v: number) { this.add('tom', tk, n, v); }
  tak(tk: number, v: number) { this.add('tak', tk, 0, v); }
  shake(tk: number, v: number) { this.add('shake', tk, 0, v); }
  pad(v: number, ramp: number) { this.add('pad', 0, 0, v, ramp); }
  /** Сыбызгы: длина в тиках, но не дальше конца такта (ноты не налезают друг на друга: голос одноголосный). */
  flute(tk: number, n: number, v: number, dTicks: number) {
    const d = Math.min(dTicks, this.ticks - tk) * this.sec * 0.94;
    if (d > 0.05) this.add('flute', tk, n, v, d);
  }
  /** Мелодия домброй. Долгая нота (>= trem тиков) «рассыпается» тремоло-шертпе: частые удары с затуханием. */
  dombraMel(mel: MelNote[], o: { v: number; trem?: number; step?: number; twin?: number }) {
    const step = o.step ?? 1;
    for (const nt of mel) {
      this.pluck(nt.tk, nt.n, o.v, 0);
      if (o.twin !== undefined && (nt.tk === 0 || nt.tk === this.ticks / 2)) this.pluck(nt.tk + 0.15, o.twin, o.v * 0.6, 1); // вторая струна (открытая) подпевает
      if (o.trem && nt.d >= o.trem) {
        for (let k = nt.tk + step, j = 1; k < nt.tk + nt.d - 0.5; k += step, j++) this.pluck(k, nt.n, o.v * (j % 2 ? 0.6 : 0.78) * Math.max(0.5, 1 - 0.05 * j), j % 2 ? 1 : 0, Math.max(2, Math.round(0.3 / this.sec)));
      }
    }
  }
  fluteMel(mel: MelNote[], v: number, transpose = 0) { for (const nt of mel) this.flute(nt.tk, nt.n + transpose, v, nt.d); }
  /** Переливы колокольчиков: ноты списком, шаг в тиках; ноты за концом такта отбрасываются. */
  bellRun(tk: number, notes: number[], stepTicks: number, v: number) { notes.forEach((n, i) => { if (tk + i * stepTicks < this.ticks) this.bell(tk + i * stepTicks, n, v * (1 - 0.12 * i), (i % 2) as 0 | 1); }); }
  /** Удар по двум струнам вразбежку (даун-штрих дербуса). */
  strum(tk: number, notes: number[], v: number, spread = 0.16) { notes.forEach((n, i) => this.pluck(tk + i * spread, n, v * (1 - 0.06 * i), (i % 2) as 0 | 1)); }
}

// ---------- общие куски ----------
interface Chord { root: number; minor: boolean }
const chord = (s: string): Chord => ({ root: noteMidi(s.slice(0, s.length - 1)), minor: s.endsWith('m') });
const chords = (s: string) => s.trim().split(/\s+/).map(chord);
const tonesOf = (c: Chord) => [0, 7, 12, 12 + (c.minor ? 3 : 4), 19].map(x => c.root + x);
const mels = (rows: string[]) => rows.map(parseMel);
const pick = <T,>(rng: () => number, a: T[]) => a[Math.floor(rng() * a.length)];

// =====================================================================
// HUB «Кеме» — спокойно, уютно. D дорийский, 6/8, ~67 «шагов» в минуту (по три восьмых). 28 тактов ≈ 50 с.
// A (флейта поёт, домбра арпеджио) · B (домбра ведёт, пробуждается дойра) · A' (флейта и домбра вдвоём) · T (хвост: колокольчики и длинные ноты)
// =====================================================================
const HUB_CH = chords('D3m D3m C3M C3M G3M G3M D3m D3m  F3M F3M C3M C3M G3M G3M D3m D3m  D3m D3m C3M C3M G3M G3M D3m D3m  G3M G3M D3m D3m');
const HUB_A = mels([
  '0:A4/5 6:C5/2 8:A4/2 10:G4/2', '0:F4/5 6:G4/2 8:A4/4',
  '0:G4/4 4:A4/2 6:C5/6',         '0:D5/4 4:C5/2 6:A4/4 10:G4/2',
  '0:A4/6 6:D5/2 8:C5/2 10:A4/2', '0:G4/4 4:A4/2 6:C5/4 10:A4/2',
  '0:F4/2 2:G4/2 4:A4/4 8:G4/2 10:F4/2', '0:D4/8',
]);
const HUB_B = mels([
  '0:C5/4 4:D5/2 6:F5/6',         '0:D5/2 2:C5/2 4:A4/4 8:C5/4',
  '0:G5/6 6:F5/2 8:D5/2 10:C5/2', '0:D5/4 4:C5/2 6:A4/6',
  '0:A4/2 2:C5/2 4:D5/4 8:F5/2 10:D5/2', '0:C5/6 6:A4/2 8:G4/4',
  '0:F4/2 2:A4/2 4:D5/8',         '0:C5/2 2:A4/2 4:F4/2 6:D4/6',
]);
const HUB_T = mels(['0:D5/10', '0:C5/6 6:A4/6', '0:A4/10', '0:D4/8']);
const HUB_BELLS = [86, 89, 91, 93, 96]; // D6 F6 G6 A6 C7

const HUB: TrackDef = {
  tickSec: 0.15, ticks: 12, bars: 28, level: 0.85, echoTicks: 3,
  drone: { root: noteMidi('D3'), cut: 420 },
  plan(b, bar, loop, soft) {
    const sec = bar < 8 ? 0 : bar < 16 ? 1 : bar < 24 ? 2 : 3, i = sec === 3 ? bar - 24 : bar % 8;
    const ch = HUB_CH[bar], tn = tonesOf(ch), r = b.rng, vs = soft ? 0.72 : 1;
    if (i === 0) b.pad([0.7, 0.95, 0.8, 0.55][sec], 3);
    b.bass(0, ch.root - 12, 0.5 * vs, 6);
    if (sec === 1 || (sec === 2 && i % 2 === 1)) b.bass(6, ch.root - 5, 0.3 * vs, 4);
    // арпеджио домбры: восьмыми вверх-вниз по аккорду, струны чередуются; часть нот случайно выпадает — дышит
    const arp = (dens: number, sc: number) => {
      const idx = [0, 1, 2, 3, 2, 1], vel = [0.5, 0.32, 0.36, 0.34, 0.36, 0.3];
      for (let k = 0; k < 6; k++) { if (k !== 0 && k !== 3 && r() > dens) continue; b.pluck(k * 2, tn[idx[k]], vel[k] * sc * vs, (k % 2) as 0 | 1); }
    };
    const tonic = noteMidi('D3');
    if (sec === 0) {
      if (loop % 2 === 0) b.fluteMel(HUB_A[i], 0.5 * vs); else b.dombraMel(HUB_A[i], { v: 0.55 * vs, trem: 6, step: 1, twin: tonic });
      arp(0.85, 1);
    } else if (sec === 1) {
      b.dombraMel(HUB_B[i], { v: 0.6 * vs, trem: 6, step: 1, twin: i % 2 === 0 ? tonic : undefined });
      b.pluck(0, tn[0], 0.36 * vs, 1); b.pluck(6, tn[1], 0.26 * vs, 0);
    } else if (sec === 2) {
      b.fluteMel(HUB_A[i], 0.48 * vs);
      b.dombraMel(HUB_A[i].map(n => ({ ...n, n: n.n + 12 })), { v: 0.24 * vs });
      arp(0.7, 0.9);
    } else {
      b.fluteMel(HUB_T[i], 0.42 * vs);
      b.pluck(0, tn[0], 0.34 * vs, 0); b.pluck(6, tn[1], 0.26 * vs, 1);
    }
    // колокольчики: короткий каскад вниз на слабой доле нечётных тактов; в хвосте каждый такт
    if (sec === 3 || (i % 2 === 1 && r() < (sec === 1 ? 0.7 : 0.5))) {
      const s = Math.floor(r() * 3) + 2; b.bellRun(8, [HUB_BELLS[s], HUB_BELLS[s - 1], HUB_BELLS[s - 2]].slice(0, 2 + (r() < 0.4 ? 1 : 0)), 2, 0.15 * vs);
    }
    // дойра проснулась только в B и A': пульс, не ритм
    if (!soft) {
      if (sec === 1) { b.tom(0, 45, 0.3); b.tom(6, 45, 0.16); b.shake(4, 0.06); b.shake(10, 0.05); }
      if (sec === 2) { if (i % 2 === 0) b.tom(0, 45, 0.2); if (r() < 0.6) b.shake(4, 0.05); b.shake(10, 0.045); }
    }
  },
};

// =====================================================================
// MAP «Карта» — приключение, движение вперёд. A аэолийский/дорийский, 4/4, 108 уд/мин, «конский галоп» домбры.
// A (флейта) · B (светлее, флейта + домбра) · A' (домбра с тремоло). 24 такта ≈ 53 с.
// =====================================================================
const MAP_CH = chords('A3m A3m G3M G3M A3m A3m F3M G3M  C3M C3M G3M G3M F3M F3M G3M G3M  A3m A3m G3M G3M A3m A3m F3M G3M');
const MAP_A = mels([
  '0:E5/6 6:D5/2 8:C5/4 12:D5/4', '0:E5/8 8:A4/8',
  '0:D5/4 4:E5/4 8:G5/6 14:E5/2', '0:D5/6 6:C5/2 8:D5/8',
  '0:E5/6 6:A5/2 8:G5/4 12:E5/4', '0:D5/4 4:C5/4 8:A4/8',
  '0:C5/4 4:D5/4 8:E5/4 12:D5/4', '0:C5/4 4:D5/2 6:E5/2 8:D5/8',
]);
const MAP_B = mels([
  '0:G5/6 6:E5/2 8:G5/4 12:A5/4', '0:G5/8 8:E5/4 12:D5/4',
  '0:D5/6 6:E5/2 8:G5/4 12:E5/4', '0:D5/12 12:C5/4',
  '0:C5/6 6:D5/2 8:E5/6 14:D5/2', '0:C5/4 4:A4/4 8:C5/8',
  '0:D5/4 4:E5/4 8:G5/4 12:A5/4', '0:G5/8 8:E5/2 10:D5/2 12:C5/4',
]);
const MAP_SPARK = [91, 93, 96, 98, 100]; // G6 A6 C7 D7 E7

const MAP: TrackDef = {
  tickSec: 60 / 108 / 4, ticks: 16, bars: 24, level: 0.85, echoTicks: 3,
  drone: { root: noteMidi('A2'), cut: 480 },
  plan(b, bar, loop, soft) {
    const sec = Math.floor(bar / 8), i = bar % 8, ch = MAP_CH[bar], tn = tonesOf(ch), r = b.rng, vs = soft ? 0.7 : 1;
    if (i === 0) b.pad([0.6, 0.85, 0.7][sec], 2.5);
    // галоп: сильная доля на басовой струне, две короткие на верхней (5-я, октава, 5-я, терция)
    const up = [tn[1], tn[2], tn[1], tn[3]];
    for (let bt = 0; bt < 4; bt++) {
      const o = bt * 4, last = i % 2 === 1 && bt === 3 && r() < 0.35;
      b.pluck(o, ch.root, (bt % 2 === 0 ? 0.62 : 0.48) * vs, 0);
      b.pluck(o + 2, up[bt], 0.34 * vs, 1);
      b.pluck(o + 3, last ? tn[4] : up[bt], 0.28 * vs, 1);
    }
    b.bass(0, ch.root - 12, 0.5 * vs, 6); b.bass(8, ch.root - 12, 0.4 * vs, 5);
    if (r() < 0.5) b.bass(10, ch.root - 5, 0.3 * vs, 3);
    // мелодия
    if (sec === 0) b.fluteMel(MAP_A[i], 0.52 * vs);
    else if (sec === 1) { b.fluteMel(MAP_B[i], 0.5 * vs); b.dombraMel(MAP_B[i], { v: 0.22 * vs }); }
    else if (i < 4) b.dombraMel(MAP_A[i], { v: 0.5 * vs, trem: 4, step: 1, twin: noteMidi('A3') });
    else { b.dombraMel(MAP_A[i], { v: 0.36 * vs, trem: 4, step: 1 }); b.fluteMel(MAP_A[i], 0.46 * vs, 12); }
    // колокольчики
    if (sec === 1 && i % 2 === 0) b.bell(0, pick(r, MAP_SPARK), 0.16 * vs);
    if (sec !== 1 && i % 4 === 3 && r() < 0.6) b.bellRun(12, [MAP_SPARK[2], MAP_SPARK[1]], 2, 0.13 * vs);
    // ручные барабаны
    if (!soft) {
      b.kick(0, 0.75); b.kick(8, 0.6); if (i % 2 === 1) b.kick(10, 0.35);
      b.tak(4, 0.5); b.tak(12, 0.5);
      for (const t of [2, 6, 10, 14]) b.shake(t, 0.12);
      if (sec === 1) { b.tom(6, 52, 0.28); b.tak(15, 0.2); }
      if (i === 7) { [12, 13, 14, 15].forEach((t, k) => b.tak(t, 0.25 + 0.1 * k)); b.tom(14, 47, 0.4); }
    }
  },
};

// =====================================================================
// BATTLE «Шайқас» — энергично, но не нервно. D минорная пентатоника, 4/4, 116 уд/мин.
// Остинато домбры 3+3+2 + даулпаз и дойра; A (тремоло домбры) · B (светлее, флейта) · A' (с колокольчиками) · пауза (дрон и нарастание). 28 тактов ≈ 58 с.
// =====================================================================
const BAT_CH = chords('D3m D3m C3M C3M D3m D3m Bb2M C3M  F3M F3M C3M C3M Bb2M Bb2M C3M C3M  D3m D3m C3M C3M D3m D3m Bb2M C3M  D3m D3m Bb2M C3M');
const BAT_A = mels([
  '0:D5/4 4:F5/4 8:A5/4 12:G5/2 14:F5/2', '0:D5/8 8:C5/4 12:A4/4',
  '0:C5/4 4:D5/4 8:G5/4 12:F5/2 14:D5/2', '0:C5/8 8:A4/4 12:G4/4',
  '0:D5/4 4:F5/4 8:A5/4 12:C6/4',         '0:A5/6 6:G5/2 8:F5/4 12:D5/4',
  '0:D5/4 4:F5/4 8:D5/4 12:C5/2 14:D5/2', '0:G5/4 4:F5/4 8:D5/4 12:C5/4',
]);
const BAT_B = mels([
  '0:A5/6 6:C6/2 8:A5/4 12:F5/4', '0:G5/8 8:F5/4 12:D5/4',
  '0:G5/6 6:A5/2 8:C6/4 12:A5/4', '0:G5/8 8:D5/8',
  '0:F5/6 6:D5/2 8:F5/4 12:A5/4', '0:G5/4 4:F5/4 8:D5/8',
  '0:C6/6 6:A5/2 8:G5/4 12:F5/4', '0:G5/8 8:A5/4 12:C6/4',
]);
const BAT_BRK = mels(['0:D5/14', '0:C5/8 8:A4/8', '0:F5/14', '0:G5/8 8:A5/8']);

const BATTLE: TrackDef = {
  tickSec: 60 / 116 / 4, ticks: 16, bars: 28, level: 0.85, echoTicks: 3,
  drone: { root: noteMidi('D3'), cut: 520 },
  plan(b, bar, loop, soft) {
    const sec = bar < 8 ? 0 : bar < 16 ? 1 : bar < 24 ? 2 : 3, i = sec === 3 ? bar - 24 : bar % 8;
    const ch = BAT_CH[bar], tn = tonesOf(ch), r = b.rng, vs = soft ? 0.7 : 1;
    if (i === 0) b.pad([0.55, 0.8, 0.6, 0.85][sec], 2);
    if (sec < 3) {
      // остинато 3+3+2: ноты корня, квинты и октавы
      const ticks = [0, 3, 6, 8, 11, 14], idx = [0, 1, 0, 2, 1, 0], vel = [0.7, 0.42, 0.5, 0.55, 0.42, 0.5], str = [0, 1, 0, 1, 1, 0] as const;
      const run = i % 4 === 3;
      ticks.forEach((tk, k) => { if (run && tk >= 11) return; b.pluck(tk, tn[idx[k]], vel[k] * vs, str[k]); });
      if (run) [12, 13, 14, 15].forEach((tk, k) => b.pluck(tk, tn[[1, 2, 3, 4][k]], 0.42 * vs, (k % 2) as 0 | 1));
      b.bass(0, ch.root - 12, 0.6 * vs, 6); b.bass(8, ch.root - 12, 0.5 * vs, 6);
      if (sec === 1) { b.bass(6, ch.root - 5, 0.28 * vs, 2); b.bass(14, ch.root - 12, 0.3 * vs, 2); }
    }
    // мелодия
    if (sec === 0) b.dombraMel(BAT_A[i], { v: 0.5 * vs, trem: 4, step: 1, twin: noteMidi('D3') });
    else if (sec === 1) { b.dombraMel(BAT_B[i], { v: 0.4 * vs, trem: 4, step: 1 }); b.fluteMel(BAT_B[i], 0.46 * vs); }
    else if (sec === 2) {
      b.dombraMel(BAT_A[i], { v: 0.5 * vs, trem: 4, step: 1, twin: noteMidi('D3') });
      if (i % 2 === 0) b.bell(0, BAT_A[i][0].n + 12, 0.13 * vs);
    } else { b.fluteMel(BAT_BRK[i], 0.5 * vs); if (i % 2 === 1) b.bellRun(8, [93, 91, 89], 2, 0.14 * vs); else b.bell(0, 86, 0.14 * vs); }
    if (soft) return;
    // барабаны
    if (sec < 3) {
      b.kick(0, 0.85); b.kick(8, 0.7); if (sec === 1) { b.kick(6, 0.35); b.kick(14, 0.35); }
      b.tak(4, 0.6); b.tak(12, 0.6);
      for (const t of [0, 2, 4, 6, 8, 10, 12, 14]) b.shake(t, t % 4 === 2 ? 0.15 : 0.09);
      if (r() < 0.5) b.tak(3, 0.18); if (r() < 0.5) b.tak(11, 0.18); if (r() < 0.4) b.tak(15, 0.16);
      if (i % 4 === 3) {
        if (i === 7 || r() < 0.5) { [12, 13, 14, 15].forEach((tk, k) => b.tom(tk, [57, 55, 52, 48][k], 0.5 + 0.05 * k)); }
        else { [12, 13, 14, 15].forEach((tk, k) => b.tak(tk, 0.3 + 0.08 * k)); b.tom(14, 50, 0.45); }
      }
    } else {
      b.kick(0, 0.5); b.tom(8, 50, 0.3);
      if (i === 2) b.tak(12, 0.3);
      if (i === 3) for (let tk = 8; tk < 16; tk++) b.tom(tk, 50 + (tk - 8), 0.2 + 0.06 * (tk - 8));
    }
  },
};

// =====================================================================
// VICTORY «Жеңіс» — фанфар на два такта (4 с), D мажорная пентатоника, 120 уд/мин; дальше тихо возвращается «Корабль».
// =====================================================================
const VICTORY: TrackDef = {
  tickSec: 0.125, ticks: 16, bars: 2, level: 0.95, echoTicks: 3,
  drone: { root: noteMidi('D3'), cut: 500 },
  after: 'hub', intro: 2,
  plan(b, bar) {
    const D = noteMidi('D3'), chordD = [D, D + 7, D + 12, D + 16];
    if (bar === 0) {
      b.pad(1, 0.4);
      b.strum(0, chordD, 0.8); b.kick(0, 0.9); b.tom(0, 41, 0.6);
      b.kick(8, 0.7); b.tak(4, 0.5); b.tak(12, 0.5); b.tak(14, 0.4); b.tom(4, 48, 0.4);
      b.dombraMel(parseMel('0:D5/2 2:F#5/2 4:A5/4 8:B5/2 10:A5/2 12:F#5/2 14:A5/2'), { v: 0.72, trem: 4, step: 1 });
      b.fluteMel(parseMel('0:D5/8 8:F#5/8'), 0.6);
      b.bass(0, D - 12, 0.7, 8); b.bass(8, D - 12, 0.5, 6);
      b.bellRun(4, [93, 95, 98], 2, 0.22);
    } else {
      b.strum(0, chordD.map(n => n + 12), 0.85, 0.2); b.strum(0.05, [D - 12, D], 0.7, 0.3);
      b.kick(0, 1); b.tom(0, 38, 0.9); b.tom(8, 45, 0.3);
      b.dombraMel(parseMel('0:D6/12'), { v: 0.6, trem: 4, step: 1 });
      b.fluteMel(parseMel('0:D6/12'), 0.55);
      b.bass(0, D - 12, 0.85, 16);
      b.bellRun(0, [86, 90, 93, 95, 98], 1.6, 0.24);
      b.shake(2, 0.3);
    }
  },
};

export const TRACKS: Record<Track, TrackDef> = { hub: HUB, map: MAP, battle: BATTLE, victory: VICTORY };

/** Идёт по тактам трека и отдаёт события. Сам знает про петли, разделы и переход победы в «Корабль». */
export class Cursor {
  private cur: Track; private k = 0; private soft = false; private rng: () => number;
  constructor(track: Track, seed = Math.floor(Math.random() * 1e9)) { this.cur = track; this.rng = mulberry32(seed); }
  peekDef(): TrackDef { return TRACKS[this.cur]; }
  next(): { evs: Ev[]; len: number; def: TrackDef; track: Track; bar: number; loop: number } {
    let def = TRACKS[this.cur];
    if (def.intro !== undefined && this.k >= def.intro) { this.cur = def.after!; def = TRACKS[this.cur]; this.k = 0; this.soft = true; }
    const bar = this.k % def.bars, loop = Math.floor(this.k / def.bars);
    const b = new Bar(def.tickSec, def.ticks, this.rng);
    def.plan(b, bar, loop, this.soft && this.k < 8);
    this.k++;
    return { evs: b.evs.sort((x, y) => x.t - y.t), len: def.ticks * def.tickSec, def, track: this.cur, bar, loop };
  }
}
