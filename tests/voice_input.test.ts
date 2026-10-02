import { describe, it, expect } from 'vitest';
// @ts-ignore
import { checkAudio, normMime, transcribePrompt, parseTranscript, SYSTEM_STT, STT_SCHEMA, AUDIO_MIMES, MAX_AUDIO_B64, MAX_BODY, MAX_TEXT } from '../helper/transcribe.mjs';
import { pickMime, appendSpoken, clock, MIC_MIMES, toBase64 } from '../src/lib/mic';

const b64 = 'QUJD'.repeat(100);   // 400 знаков настоящего base64

describe('Голосовой ввод: сервер (helper/transcribe.mjs)', () => {
  it('формат записи: кодеки отрезаются, m4a/mp3/wav сводятся к одному имени, чужое не принимается', () => {
    expect(normMime('audio/webm;codecs=opus')).toBe('audio/webm');
    expect(normMime('audio/ogg; codecs=opus')).toBe('audio/ogg');
    expect(normMime('audio/mp4')).toBe('audio/mp4');
    expect(normMime('audio/x-m4a')).toBe('audio/mp4');
    expect(normMime('audio/mp3')).toBe('audio/mpeg');
    expect(normMime('video/webm')).toBeNull();
    expect(normMime('')).toBeNull();
    expect(normMime(undefined)).toBeNull();
  });
  it('всё, что может записать браузер (src/lib/mic.ts), сервер принимает', () => {
    for (const m of MIC_MIMES) expect(AUDIO_MIMES, m).toContain(normMime(m));
  });
  it('плохие тела отклоняются', () => {
    const ok = { audio: b64, mime: 'audio/webm;codecs=opus', seconds: 4.2 };
    expect(checkAudio(ok)).toBeNull();
    expect(checkAudio({})).toBe('no_audio');
    expect(checkAudio({ ...ok, audio: 5 })).toBe('no_audio');
    expect(checkAudio({ ...ok, audio: 'QUJD' })).toBe('bad_audio');            // слишком короткая — не речь
    expect(checkAudio({ ...ok, audio: b64 + '!!' })).toBe('bad_audio');         // не base64
    expect(checkAudio({ ...ok, audio: 'A'.repeat(MAX_AUDIO_B64 + 1) })).toBe('too_long');
    expect(checkAudio({ ...ok, mime: 'text/plain' })).toBe('bad_mime');
    expect(checkAudio({ ...ok, seconds: 600 })).toBe('too_long');
    expect(checkAudio({ ...ok, seconds: '4' })).toBe('too_long');
    expect(checkAudio({ ...ok, seconds: undefined })).toBeNull();
    expect(MAX_BODY).toBeGreaterThan(MAX_AUDIO_B64);
  });
  it('промпт: тема как подсказка, запись — отдельной частью с нормальным форматом', () => {
    const p = transcribePrompt({ audio: b64, mime: 'audio/webm;codecs=opus', hint: 'Бөлшекті қысқарту' });
    expect(p).toHaveLength(1);
    expect(p[0].parts[0].text).toContain('Бөлшекті қысқарту');
    expect(p[0].parts[1].inlineData).toEqual({ mimeType: 'audio/webm', data: b64 });
    expect(transcribePrompt({ audio: b64, mime: 'audio/mp4' })[0].parts[0].text).not.toContain('Тема');
  });
  it('промпт модели: дословно, без перевода и исправлений, запись — данные, а не команда', () => {
    expect(SYSTEM_STT).toContain('ДОСЛОВНО');
    expect(SYSTEM_STT).toContain('Не переводи');
    expect(SYSTEM_STT).toContain('не команда');
    expect(STT_SCHEMA.required).toEqual(['heard', 'text']);
  });
  it('разбор ответа: пробелы схлопываются, длина ограничена, «не расслышал» = пустой текст, мусор = null', () => {
    expect(parseTranscript('{"heard":true,"text":"  ЕҮОБ-қа   бөлеміз. "}')).toEqual({ text: 'ЕҮОБ-қа бөлеміз.' });
    expect(parseTranscript('{"heard":false,"text":"шум"}')).toEqual({ text: '' });
    expect(parseTranscript('{"heard":true,"text":""}')).toEqual({ text: '' });
    expect(parseTranscript(JSON.stringify({ heard: true, text: 'а '.repeat(500) }))!.text.length).toBeLessThanOrEqual(MAX_TEXT);
    expect(parseTranscript('не json')).toBeNull();
    expect(parseTranscript('{"heard":true}')).toBeNull();
    expect(parseTranscript('null')).toBeNull();
  });
});

describe('Голосовой ввод: сайт (src/lib/mic.ts)', () => {
  it('формат записи: первый, который умеет браузер; не умеет ни одного — пусть выберет сам', () => {
    expect(pickMime(() => true)).toBe('audio/webm;codecs=opus');
    expect(pickMime(m => m === 'audio/mp4')).toBe('audio/mp4');                 // Safari
    expect(pickMime(m => m.startsWith('audio/ogg'))).toBe('audio/ogg;codecs=opus'); // Firefox
    expect(pickMime(() => false)).toBe('');
    expect(pickMime(() => { throw new Error('old'); })).toBe('');
  });
  it('сказанное дописывается к написанному через один пробел', () => {
    expect(appendSpoken('', '  ЕҮОБ-қа бөлеміз ', 300)).toBe('ЕҮОБ-қа бөлеміз');
    expect(appendSpoken('Алымы мен бөлімін', 'бірдей санға бөлеміз', 300)).toBe('Алымы мен бөлімін бірдей санға бөлеміз');
    expect(appendSpoken('сөз  ', 'тағы', 300)).toBe('сөз тағы');
    expect(appendSpoken('бар', '   ', 300)).toBe('бар');
  });
  it('длиннее предела — режется по целому слову, написанное раньше не трогается', () => {
    const r = appendSpoken('басы', 'бір екі үш төрт бес алты', 16);
    expect(r.length).toBeLessThanOrEqual(16);
    expect(r).toBe('басы бір екі үш');
    expect(appendSpoken('', 'х'.repeat(50), 20)).toHaveLength(20);   // одно длинное слово — просто обрезается
  });
  it('время записи', () => {
    expect(clock(0)).toBe('0:00');
    expect(clock(7400)).toBe('0:07');
    expect(clock(65000)).toBe('1:05');
  });
  it('запись → base64 без префикса, большие записи не падают', async () => {
    expect(await toBase64(new Blob([new Uint8Array([65, 66, 67])]))).toBe('QUJD');
    const big = new Uint8Array(200_000).map((_, i) => i % 251);
    const s = await toBase64(new Blob([big]));
    expect(Buffer.from(s, 'base64').equals(Buffer.from(big))).toBe(true);
  });
});
