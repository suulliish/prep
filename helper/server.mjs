// ИИ-помощник Бита: объясняет разобранную задачу другими словами и отвечает на уточняющие вопросы.
// Работает на Cloud Run в проекте Google Cloud бота (Vertex AI, счёт — кредиты Google Cloud).
// Кнопка на сайте появляется только ПОСЛЕ ответа ученика (docs/ARCHITECTURE.md: ИИ только после
// заготовленного объяснения) — правильный ответ к этому моменту уже показан, решать за ребёнка нечего.
// Режим «урок» (mode:'lesson', helper/lesson.mjs): объясняет шаг урока иначе; закрытые числа приходят как ▢ и не раскрываются.
// Режим «Биткә түсіндір» (mode:'teachback', helper/teachback.mjs): ребёнок объясняет тему, Бит оценивает понимание (JSON с вердиктом).
// Голосовой ввод (POST /transcribe, helper/transcribe.mjs): запись голоса ребёнка → текст в поле ответа; аудио не сохраняется.
// Проверка «Дәптер» (POST /notebook, helper/notebook.mjs): фото бумажной карточки темы → отметки по четырём полям; фото не сохраняется.
// Спрашивать могут только вошедшие в облако сайта (Firebase ID token проекта prep-b72a9).
import http from 'node:http';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { GoogleGenAI } from '@google/genai';
import { SYSTEM_LESSON, checkLesson, lessonPrompt } from './lesson.mjs';
import { SYSTEM_TEACH, TEACH_SCHEMA, TEACH_THINKING, checkTeach, teachPrompt, parseTeach, roundOf } from './teachback.mjs';
import { SYSTEM_STT, STT_SCHEMA, STT_THINKING, MAX_BODY as MAX_AUDIO_BODY, checkAudio, transcribePrompt, parseTranscript } from './transcribe.mjs';
import { isAllowed } from './allow.mjs';
import { SYSTEM_NOTEBOOK, NOTEBOOK_SCHEMA, MAX_BODY as MAX_PHOTO_BODY, checkNotebook, notebookPrompt, parseNotebook } from './notebook.mjs';

const FIREBASE_PROJECT = process.env.FIREBASE_PROJECT || 'prep-b72a9';
const MODELS = (process.env.MODELS || 'gemini-3.7-flash,gemini-3.5-flash').split(',');
const PER_USER_DAY = +(process.env.PER_USER_DAY || 30);
const ALL_DAY = +(process.env.ALL_DAY || 200);
// голосовой ввод считается отдельно: одна запись — это не вопрос к Биту, а замена клавиатуры (ответ потом всё равно идёт в /explain)
const VOICE_PER_USER_DAY = +(process.env.VOICE_PER_USER_DAY || 60);
const VOICE_ALL_DAY = +(process.env.VOICE_ALL_DAY || 300);
// проверка тетради: одна-две карточки в день, пересъёмки — до 3 на карточку
const NOTEBOOK_PER_USER_DAY = +(process.env.NOTEBOOK_PER_USER_DAY || 15);
const NOTEBOOK_ALL_DAY = +(process.env.NOTEBOOK_ALL_DAY || 60);
const TIMEOUT_MS = +(process.env.TIMEOUT_MS || 25000);
const ORIGINS = (process.env.ORIGINS || 'https://suulliish.github.io,http://localhost:5173,http://localhost:4173').split(',');
const SKIP_AUTH = process.env.SKIP_AUTH === '1'; // только для локальной проверки
// Кто может спрашивать (02.10): вход по почте сам создаёт аккаунт, и без списка любой мог зарегистрироваться и выбрать общий дневной лимит.
// ALLOW — почты и/или uid через запятую (без учёта регистра). Пусто — пускаем всех вошедших, как раньше (с предупреждением в журнале).
const ALLOW = (process.env.ALLOW || '').split(',').map(x => x.trim().toLowerCase()).filter(Boolean);
if (!ALLOW.length && !SKIP_AUTH) console.warn('ALLOW не задан: помощником может пользоваться любой вошедший аккаунт');
const allowed = who => isAllowed(who, ALLOW);

const ai = new GoogleGenAI({
  vertexai: true,
  project: process.env.GOOGLE_CLOUD_PROJECT || 'gen-lang-client-0929343050',
  location: process.env.GOOGLE_CLOUD_LOCATION || 'global', // модели 3.x есть только в global
});
const JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'));

const SYSTEM = `Ты — Бит, дружелюбный робот-помощник в учебной игре. Твой ученик — мальчик 10–12 лет, готовится к экзамену в лицей (математика и логика 5–6 класса).
Язык ответа — казахский, простыми словами, как для 5-классника. Математические термины — казахские (бөлшек, бөлгіш, қалдық, теңдеу, пайыз…).

Что происходит: ученик уже ответил на задачу, увидел правильный ответ и готовое решение, но нажал «түсінбедім» (не понял) или задал вопрос.
Правила:
1. Правильный ответ и решение, которые тебе даны, — верные и проверены кодом. Опирайся на них и не придумывай другой ответ. Все числа пересчитывай аккуратно.
2. Объясни ИНАЧЕ, чем готовое решение: через наглядный пример, картинку словами, маленькие шаги. Если ученик выбрал неверный вариант — мягко покажи, где именно ошибка в его рассуждении.
3. Коротко: до 6 коротких предложений. Без длинных вступлений и похвалы личности («ты умный»). Ошибка — нормальная часть учёбы.
4. В конце задай ОДИН простой проверочный вопрос по сути шага (не повторяй ответ задачи).
5. Говори только о математике и логике этой задачи. На личные, опасные или посторонние темы ответь одной фразой, что с этим лучше к брату или взрослым, и верни разговор к задаче. Никаких ссылок, никакой «дружбы».
6. Не используй LaTeX и markdown-разметку: обычный текст, дроби пиши как 3/4, умножение как ·.`;

const today = () => new Date().toISOString().slice(0, 10);

/** Дневной лимит: perUser на ученика и all на всех. Возвращает проверку, которая сразу засчитывает запрос. */
function quota(perUser, all) {
  const used = new Map(); // uid -> {day, n}
  let allDay = { day: '', n: 0 };
  return uid => {
    const d = today();
    if (allDay.day !== d) allDay = { day: d, n: 0 };
    const u = used.get(uid);
    const cur = u && u.day === d ? u : { day: d, n: 0 };
    if (cur.n >= perUser || allDay.n >= all) return false;
    cur.n++; allDay.n++; used.set(uid, cur);
    return true;
  };
}
const quotaOk = quota(PER_USER_DAY, ALL_DAY);
const voiceQuotaOk = quota(VOICE_PER_USER_DAY, VOICE_ALL_DAY);
const notebookQuotaOk = quota(NOTEBOOK_PER_USER_DAY, NOTEBOOK_ALL_DAY);

async function whoIs(req) {
  if (SKIP_AUTH) return { uid: 'local', email: 'local' };
  const h = req.headers.authorization || '';
  if (!h.startsWith('Bearer ')) return null;
  try {
    const { payload } = await jwtVerify(h.slice(7), JWKS, {
      issuer: `https://securetoken.google.com/${FIREBASE_PROJECT}`,
      audience: FIREBASE_PROJECT,
    });
    return payload.sub ? { uid: payload.sub, email: payload.email ?? '' } : null;
  } catch { return null; }
}

const clip = (s, n) => String(s ?? '').slice(0, n);

function buildPrompt(b) {
  const t = b.task || {};
  const lines = [
    `ЗАДАЧА: ${clip(t.text, 1500)}`,
    `ВАРИАНТЫ: ${(t.choices || []).slice(0, 5).map((c, i) => `${'ABCDE'[i]}) ${clip(c, 120)}`).join('  ')}`,
    `ПРАВИЛЬНЫЙ ОТВЕТ: ${clip(t.correct, 200)}`,
    `ВЫБОР УЧЕНИКА: ${t.picked == null ? 'не отвечал' : clip(t.picked, 200)}${t.pickedCorrect ? ' (верно)' : ' (неверно)'}`,
    t.mistake ? `ТИПИЧНАЯ ОШИБКА ЭТОГО ВАРИАНТА: ${clip(t.mistake, 400)}` : '',
    `ГОТОВОЕ РЕШЕНИЕ (ученик его уже видел): ${clip(t.solution, 1500)}`,
    t.rule ? `ПРАВИЛО ТЕМЫ: ${clip(t.rule, 600)}` : '',
  ].filter(Boolean);
  const contents = [{ role: 'user', parts: [{ text: lines.join('\n') + '\n\nУченик нажал «түсінбедім». Объясни.' }] }];
  for (const turn of (b.history || []).slice(-6)) {
    contents.push({ role: turn.role === 'bit' ? 'model' : 'user', parts: [{ text: clip(turn.text, 600) }] });
  }
  if (b.question) contents.push({ role: 'user', parts: [{ text: `Вопрос ученика: ${clip(b.question, 400)}` }] });
  return contents;
}

// config — добавки к настройкам модели (для teachback: JSON-ответ по схеме); accept — разбор ответа, null = ответ не годится, пробуем следующую модель
async function ask(contents, system, config = {}, accept = text => text) {
  let last;
  for (const model of MODELS) {
    for (let attempt = 0; attempt < 2; attempt++) {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
      try {
        const r = await Promise.race([
          ai.models.generateContent({
            model, contents,
            config: { systemInstruction: system, temperature: 0.4, maxOutputTokens: 2500, abortSignal: ctrl.signal, ...config },
          }),
          new Promise((_, rej) => ctrl.signal.addEventListener('abort', () => rej(new Error('timeout')))),
        ]);
        const text = (r.text || '').trim();
        const out = text ? accept(text) : null;
        if (out) return { out, model };
        last = new Error(text ? 'bad_format' : 'empty');
      } catch (e) {
        last = e;
        // Vertex ответил «ресурс исчерпан» (429): пауза и одна повторная попытка на той же модели, иначе сразу к запасной
        if (e?.status === 429 && attempt === 0) { await new Promise(r => setTimeout(r, 1200)); continue; }
      }
      finally { clearTimeout(timer); }
      break;
    }
  }
  throw last;
}

function send(res, origin, code, obj) {
  const h = { 'Content-Type': 'application/json; charset=utf-8' };
  if (ORIGINS.includes(origin)) Object.assign(h, {
    'Access-Control-Allow-Origin': origin, 'Vary': 'Origin',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Access-Control-Allow-Methods': 'POST, OPTIONS',
  });
  res.writeHead(code, h); res.end(obj === undefined ? '' : JSON.stringify(obj));
}

const server = http.createServer(async (req, res) => {
  const origin = req.headers.origin || '';
  if (req.method === 'OPTIONS') return send(res, origin, 204);
  if (req.method === 'GET' && req.url === '/health') return send(res, origin, 200, { ok: true });
  const voice = req.url === '/transcribe', photo = req.url === '/notebook';
  if (req.method !== 'POST' || (req.url !== '/explain' && !voice && !photo)) return send(res, origin, 404, { error: 'not_found' });

  const who = await whoIs(req);
  if (!who) return send(res, origin, 401, { error: 'sign_in' });
  if (!allowed(who)) { console.log(JSON.stringify({ denied: who.uid })); return send(res, origin, 403, { error: 'not_allowed' }); }
  let body = '';
  const limit = voice ? MAX_AUDIO_BODY : photo ? MAX_PHOTO_BODY : 20000;
  for await (const chunk of req) { body += chunk; if (body.length > limit) return send(res, origin, 413, { error: 'too_big' }); }
  let b;
  try { b = JSON.parse(body); } catch { return send(res, origin, 400, { error: 'bad_json' }); }
  if (voice) return transcribe(res, origin, who, b);
  if (photo) return notebook(res, origin, who, b);
  // режим «урок» (mode:'lesson') — шаг урока; «Биткә түсіндір» (mode:'teachback') — объяснение ребёнка; без mode — разобранная задача практики
  const lesson = b?.mode === 'lesson', teach = b?.mode === 'teachback';
  if (b?.mode !== undefined && b.mode !== 'practice' && !lesson && !teach) return send(res, origin, 400, { error: 'bad_mode' });
  if (lesson || teach) {
    const bad = lesson ? checkLesson(b) : checkTeach(b);
    if (bad) return send(res, origin, 400, { error: bad });
  } else if (!b?.task?.text || !b?.task?.correct) return send(res, origin, 400, { error: 'no_task' });
  if (!quotaOk(who.uid)) return send(res, origin, 429, { error: 'quota' });

  try {
    const t0 = Date.now();
    const mode = teach ? 'teachback' : lesson ? 'lesson' : 'practice';
    if (teach) {
      const round = roundOf(b);
      const { out, model } = await ask(teachPrompt(b), SYSTEM_TEACH, { responseMimeType: 'application/json', responseSchema: TEACH_SCHEMA, thinkingConfig: TEACH_THINKING }, t => parseTeach(t, round));
      console.log(JSON.stringify({ uid: who.uid, mode, model, ms: Date.now() - t0, skill: clip(b.topic?.skill, 60), round, verdict: out.verdict }));
      return send(res, origin, 200, out);
    }
    const { out: text, model } = await ask(lesson ? lessonPrompt(b) : buildPrompt(b), lesson ? SYSTEM_LESSON : SYSTEM);
    console.log(JSON.stringify({ uid: who.uid, mode, model, ms: Date.now() - t0, q: !!b.question, ...(lesson ? { step: b.step.type, skill: clip(b.topic?.skill, 60) } : {}) }));
    send(res, origin, 200, { text });
  } catch (e) {
    console.error('explain failed', String(e));
    send(res, origin, 502, { error: 'ai_unavailable' });
  }
});

async function transcribe(res, origin, who, b) {
  const bad = checkAudio(b);
  if (bad) return send(res, origin, 400, { error: bad });
  if (!voiceQuotaOk(who.uid)) return send(res, origin, 429, { error: 'quota' });
  try {
    const t0 = Date.now();
    const { out, model } = await ask(transcribePrompt(b), SYSTEM_STT, { temperature: 0, responseMimeType: 'application/json', responseSchema: STT_SCHEMA, thinkingConfig: STT_THINKING }, parseTranscript);
    // в журнал — только размеры: что сказал ребёнок, остаётся у него в журнале на сайте
    console.log(JSON.stringify({ uid: who.uid, mode: 'transcribe', model, ms: Date.now() - t0, kb: Math.round(b.audio.length * 0.75 / 1024), sec: b.seconds, chars: out.text.length }));
    send(res, origin, 200, out);
  } catch (e) {
    console.error('transcribe failed', String(e));
    send(res, origin, 502, { error: 'ai_unavailable' });
  }
}

async function notebook(res, origin, who, b) {
  const bad = checkNotebook(b);
  if (bad) return send(res, origin, 400, { error: bad });
  if (!notebookQuotaOk(who.uid)) return send(res, origin, 429, { error: 'quota' });
  try {
    const t0 = Date.now();
    // «размышление» по умолчанию: модель пересчитывает пример ребёнка, тут нужна точность, а не скорость
    const { out, model } = await ask(notebookPrompt(b), SYSTEM_NOTEBOOK, { temperature: 0.2, maxOutputTokens: 6000, responseMimeType: 'application/json', responseSchema: NOTEBOOK_SCHEMA }, parseNotebook);
    console.log(JSON.stringify({ uid: who.uid, mode: 'notebook', model, ms: Date.now() - t0, kb: Math.round(b.image.length * 0.75 / 1024), skill: clip(b.topic?.skill, 60), readable: out.readable, marks: Object.values(out.fields).map(f => f.mark).join(',') }));
    send(res, origin, 200, out);
  } catch (e) {
    console.error('notebook failed', String(e));
    send(res, origin, 502, { error: 'ai_unavailable' });
  }
}

server.listen(+(process.env.PORT || 8080), () => console.log('bit-helper up'));
