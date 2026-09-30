// Проверка музыки без входа в игру (только для разработки): music.html
// Кнопки настроений, громкость и «записать в WAV» (офлайн-рендер тем же секвенсором, без задержек реального времени).
// В консоли: __music.renderMood('battle', 30) → { wav: Blob, stats }
import { audio, type Mood } from '../lib/audio';
import { Sequencer, type Track } from '../lib/music/sequencer';
import { debugMute } from '../lib/music/synth';

const moods: [Mood, string, string][] = [
  ['hub', 'Кеме (hub)', 'спокойно, D дорийский, 6/8, ~50 с'],
  ['map', 'Карта (map)', 'приключение, галоп домбры, 108 уд/мин'],
  ['battle', 'Шайқас (battle)', 'энергично, остинато 3+3+2, 116 уд/мин'],
  ['victory', 'Жеңіс (victory)', 'фанфар 4 с, затем тихо в «Кеме»'],
  ['focus', 'Фокус (задача)', 'тишина или 25% громкости, по настройке'],
  ['silent', 'Тишина', ''],
];

const stat = (arr: Float32Array[], sr: number) => {
  let peak = 0, sum = 0, nan = 0, n = 0;
  const win = sr, rms: number[] = [];
  const L = arr[0], R = arr[1] ?? arr[0];
  for (let w = 0; w * win < L.length; w++) {
    let s = 0, c = 0;
    for (let i = w * win; i < Math.min(L.length, (w + 1) * win); i++) {
      const a = L[i], b = R[i];
      if (!Number.isFinite(a) || !Number.isFinite(b)) { nan++; continue; }
      peak = Math.max(peak, Math.abs(a), Math.abs(b)); s += (a * a + b * b) / 2; c++;
    }
    sum += s; n += c; rms.push(Math.sqrt(s / Math.max(c, 1)));
  }
  // провалы тишины: окна по 100 мс тише −60 дБ (кроме первых 0.3 с — разгон)
  const w100 = Math.floor(sr / 10); let quiet = 0, minW = Infinity;
  for (let w = 3; (w + 1) * w100 <= L.length; w++) {
    let s = 0; for (let i = w * w100; i < (w + 1) * w100; i++) s += (L[i] * L[i] + R[i] * R[i]) / 2;
    const r = Math.sqrt(s / w100); minW = Math.min(minW, r); if (r < 0.001) quiet++;
  }
  return { peak, rms: Math.sqrt(sum / Math.max(n, 1)), nan, quietWindows100ms: quiet, minRms100msDb: 20 * Math.log10(Math.max(minW, 1e-9)), rmsPerSecond: rms };
};

function wavBlob(arr: Float32Array[], sr: number): Blob {
  const n = arr[0].length, ch = arr.length, out = new DataView(new ArrayBuffer(44 + n * ch * 2));
  const str = (o: number, s: string) => [...s].forEach((c, i) => out.setUint8(o + i, c.charCodeAt(0)));
  str(0, 'RIFF'); out.setUint32(4, 36 + n * ch * 2, true); str(8, 'WAVEfmt '); out.setUint32(16, 16, true);
  out.setUint16(20, 1, true); out.setUint16(22, ch, true); out.setUint32(24, sr, true); out.setUint32(28, sr * ch * 2, true);
  out.setUint16(32, ch * 2, true); out.setUint16(34, 16, true); str(36, 'data'); out.setUint32(40, n * ch * 2, true);
  let o = 44;
  for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++) { out.setInt16(o, Math.max(-1, Math.min(1, arr[c][i])) * 32767, true); o += 2; }
  return new Blob([out], { type: 'audio/wav' });
}

/** Рендерит трек офлайн. Громкость как на выходе музыкальной шины при music = 1 (без master). */
export async function renderMood(track: Track, seconds = 30, sr = 44100, seed = 7) {
  const ctx = new OfflineAudioContext(2, Math.floor(sr * seconds), sr);
  const noise = ctx.createBuffer(1, sr, sr), d = noise.getChannelData(0);
  for (let i = 0; i < sr; i++) d[i] = Math.random() * 2 - 1;
  const out = ctx.createGain(); out.connect(ctx.destination);
  const seq = new Sequencer(ctx as unknown as AudioContext, out, noise, track, seed);
  // как в игре: планирование с запасом 1.2 с каждые 100 мс (а не все ноты сразу: иначе замер нагрузки завышен, в графе висят тысячи ещё не начатых узлов)
  seq.start(false);
  let planMs = 0;
  const step = 0.1;
  for (let t = step; t < seconds; t += step) {
    ctx.suspend(t).then(() => { const a = performance.now(); seq.pump(ctx.currentTime + 1.2); planMs += performance.now() - a; ctx.resume(); });
  }
  const t1 = performance.now();
  const buf = await ctx.startRendering();
  const renderMs = performance.now() - t1;
  const ch = [buf.getChannelData(0), buf.getChannelData(1)];
  return { wav: wavBlob(ch, sr), stats: { ...stat(ch, sr), seconds, planMs, renderMs, cpuPerAudioSecond: renderMs / seconds } };
}
(window as any).__music = { renderMood, audio, debugMute };

const app = document.getElementById('app')!;
let cur: Mood = 'silent';
const btns = new Map<Mood, HTMLButtonElement>();
for (const [id, name, hint] of moods) {
  const b = document.createElement('button');
  b.innerHTML = `<b>${name}</b><small>${hint}</small>`;
  b.onclick = () => { audio.unlock(); cur = id; audio.setMood(id); btns.forEach((x, k) => x.classList.toggle('on', k === cur)); };
  btns.set(id, b); app.appendChild(b);
}
const vol = document.getElementById('vol') as HTMLInputElement, out = document.getElementById('volv')!;
vol.value = String(audio.settings.music); out.textContent = Math.round(+vol.value * 100) + '%';
vol.oninput = () => { audio.save({ music: +vol.value }); out.textContent = Math.round(+vol.value * 100) + '%'; };
const foc = document.getElementById('focus') as HTMLSelectElement;
foc.value = audio.settings.musicInFocus; foc.onchange = () => audio.save({ musicInFocus: foc.value as 'off' | 'quiet' });
const rec = document.getElementById('rec') as HTMLButtonElement, msg = document.getElementById('msg')!;
rec.onclick = async () => {
  const track = (['hub', 'map', 'battle', 'victory'] as const).find(t => t === cur) ?? 'hub';
  msg.textContent = `Считаю ${track}…`; rec.disabled = true;
  const r = await renderMood(track, 30);
  const a = document.createElement('a'); a.href = URL.createObjectURL(r.wav); a.download = `${track}.wav`; a.click();
  msg.textContent = `${track}.wav: пик ${r.stats.peak.toFixed(2)}, средняя громкость ${r.stats.rms.toFixed(3)}, ${r.stats.cpuPerAudioSecond.toFixed(1)} мс на секунду звука`; rec.disabled = false;
};
