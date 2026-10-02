// Голосовой ввод: запись с микрофона (MediaRecorder) → helper/ POST /transcribe → текст в поле ответа.
// Ребёнок видит, что услышал Бит, может поправить и сам жмёт «Жіберу»: распознанный текст не уходит Биту без его ведома.
// Здесь чистые функции (их гоняют тесты) и запись; кнопка — src/ui/MicButton.svelte, запрос — transcribe в src/lib/helper.ts.

/** Форматы по порядку предпочтения: Chrome/Android — webm/opus, Firefox — ogg/opus, Safari/iOS — mp4 (aac). */
export const MIC_MIMES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4', 'audio/aac'];
/** Запись короче — случайное касание: на сервер не идёт. */
export const MIN_MS = 700;
/** Речь тише этого уровня (RMS 0..1) всю запись — микрофон молчал: на сервер не идёт. */
export const SILENCE_RMS = 0.012;

/** Первый формат, который браузер умеет писать; '' — пусть браузер выберет сам (MediaRecorder без mimeType). */
export function pickMime(supported: (m: string) => boolean): string {
  return MIC_MIMES.find(m => { try { return supported(m); } catch { return false; } }) ?? '';
}

/** Добавить сказанное к уже написанному: через пробел, без двойных пробелов; не длиннее max — режем по последнему целому слову. */
export function appendSpoken(text: string, spoken: string, max: number): string {
  const said = spoken.replace(/\s+/g, ' ').trim();
  if (!said) return text;
  const head = text.replace(/\s+$/, '');
  const all = head ? `${head} ${said}` : said;
  if (all.length <= max) return all;
  const cut = all.slice(0, max);
  const sp = cut.lastIndexOf(' ');
  return (sp > head.length ? cut.slice(0, sp) : cut).trim();
}

/** 0:07 */
export const clock = (ms: number) => { const s = Math.floor(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

/** Есть ли в браузере всё для записи. Нет (старый браузер, сайт не по https) — кнопки микрофона нет, остаётся клавиатура. */
export function micSupported(): boolean {
  return typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && typeof window !== 'undefined' && typeof window.MediaRecorder === 'function';
}

export type MicError = 'denied' | 'no_mic' | 'short' | 'silent' | 'failed';

export interface Recording { blob: Blob; mime: string; ms: number }

/**
 * Одна запись. start() спрашивает микрофон (первый раз браузер показывает запрос разрешения), stop() отдаёт запись,
 * cancel() — выбросить (уход с шага). Уровень громкости для «живого» кольца — level() 0..1.
 * После stop/cancel микрофон отпускается сразу: значок записи в браузере гаснет.
 */
export class Mic {
  private rec: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private chunks: Blob[] = [];
  private t0 = 0;
  private actx: AudioContext | null = null;
  private an: AnalyserNode | null = null;
  private buf: Float32Array<ArrayBuffer> | null = null;
  private peak = 0;
  private samples = 0;
  private tick: ReturnType<typeof setInterval> | undefined;
  private done: ((r: Recording | MicError) => void) | null = null;

  async start(): Promise<MicError | null> {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 } });
    } catch (e: any) {
      return e?.name === 'NotAllowedError' || e?.name === 'SecurityError' ? 'denied' : e?.name === 'NotFoundError' ? 'no_mic' : 'failed';
    }
    const mime = pickMime(m => MediaRecorder.isTypeSupported(m));
    try {
      // речь: 24 кбит/с хватает с запасом, минута ≈ 180 КБ (Safari может проигнорировать и писать aac 64–128 кбит/с — сервер примет до 60 с)
      this.rec = new MediaRecorder(this.stream, { ...(mime ? { mimeType: mime } : {}), audioBitsPerSecond: 24000 });
    } catch { this.release(); return 'failed'; }
    this.chunks = []; this.peak = 0; this.samples = 0;
    this.rec.ondataavailable = e => { if (e.data.size) this.chunks.push(e.data); };
    this.rec.onstop = () => this.finish();
    this.rec.start(1000);
    this.t0 = performance.now();
    this.meter();
    return null;
  }

  /** Сколько идёт запись, мс. */
  elapsed() { return this.rec ? performance.now() - this.t0 : 0; }

  /** Громкость сейчас 0..1 (для кольца вокруг кнопки); заодно запоминает пик — по нему видно, был ли голос. */
  level(): number {
    if (!this.an || !this.buf || this.actx?.state !== 'running') return 0;
    this.an.getFloatTimeDomainData(this.buf);
    this.samples++;
    let sum = 0;
    for (const v of this.buf) sum += v * v;
    const rms = Math.sqrt(sum / this.buf.length);
    if (rms > this.peak) this.peak = rms;
    return Math.min(1, rms * 6);
  }

  stop(): Promise<Recording | MicError> {
    const rec = this.rec;
    if (!rec || rec.state === 'inactive') return Promise.resolve('failed');
    this.level();
    return new Promise(res => {
      // браузер не прислал конец записи за 3 с — не висим в «Тыңдап жатыр…»: микрофон отпускаем, запись считаем неудачной
      const t = setTimeout(() => { if (this.done) { this.done = null; this.cancel(); res('failed'); } }, 3000);
      this.done = r => { clearTimeout(t); res(r); };
      rec.stop();
    });
  }

  cancel() {
    this.done = null;
    if (this.rec && this.rec.state !== 'inactive') { this.rec.onstop = null; try { this.rec.stop(); } catch { /* уже остановлен */ } }
    this.release();
  }

  private finish() {
    // тишину проверяем, только если уровень и правда снимался (на iOS AudioContext может не запуститься — тогда отправляем как есть)
    const rec = this.rec!, ms = performance.now() - this.t0, peak = this.peak, metered = this.samples >= 5;
    const mime = rec.mimeType || this.chunks[0]?.type || 'audio/webm';
    const blob = new Blob(this.chunks, { type: mime });
    this.release();
    const done = this.done; this.done = null;
    if (!done) return;
    if (ms < MIN_MS || !blob.size) done('short');
    else if (metered && peak < SILENCE_RMS) done('silent');
    else done({ blob, mime, ms });
  }

  /** Уровень громкости — через свой маленький AudioContext (у звукового движка свой; на iOS не мешают друг другу). Не вышло — запись идёт и без кольца. */
  private meter() {
    try {
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      this.actx = new Ctx();
      this.an = this.actx.createAnalyser();
      this.an.fftSize = 1024;
      this.buf = new Float32Array(this.an.fftSize);
      this.actx.createMediaStreamSource(this.stream!).connect(this.an);
      if (this.actx.state === 'suspended') this.actx.resume().catch(() => {});
      this.tick = setInterval(() => this.level(), 100);   // пик голоса копится, даже если кнопка не рисует кольцо
    } catch { this.an = null; this.buf = null; }
  }

  private release() {
    clearInterval(this.tick); this.tick = undefined;
    this.stream?.getTracks().forEach(t => t.stop());
    this.stream = null; this.rec = null;
    this.actx?.close().catch(() => {});
    this.actx = null; this.an = null; this.buf = null;
  }
}

/** Blob → base64 без префикса data: (для JSON-тела запроса). */
export async function toBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
