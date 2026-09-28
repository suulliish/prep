// ИИ-помощник Бита: объясняет разобранную задачу другими словами и отвечает на уточняющие вопросы.
// Работает на Cloud Run в проекте Google Cloud бота (Vertex AI, счёт — кредиты Google Cloud).
// Кнопка на сайте появляется только ПОСЛЕ ответа ученика (docs/ARCHITECTURE.md: ИИ только после
// заготовленного объяснения) — правильный ответ к этому моменту уже показан, решать за ребёнка нечего.
// Спрашивать могут только вошедшие в облако сайта (Firebase ID token проекта prep-b72a9).
import http from 'node:http';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { GoogleGenAI } from '@google/genai';

const FIREBASE_PROJECT = process.env.FIREBASE_PROJECT || 'prep-b72a9';
const MODELS = (process.env.MODELS || 'gemini-3.7-flash,gemini-3.5-flash').split(',');
const PER_USER_DAY = +(process.env.PER_USER_DAY || 30);
const ALL_DAY = +(process.env.ALL_DAY || 200);
const TIMEOUT_MS = +(process.env.TIMEOUT_MS || 25000);
const ORIGINS = (process.env.ORIGINS || 'https://suulliish.github.io,http://localhost:5173,http://localhost:4173').split(',');
const SKIP_AUTH = process.env.SKIP_AUTH === '1'; // только для локальной проверки

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

const used = new Map(); // uid -> {day, n}
let allDay = { day: '', n: 0 };
const today = () => new Date().toISOString().slice(0, 10);

function quotaOk(uid) {
  const d = today();
  if (allDay.day !== d) allDay = { day: d, n: 0 };
  const u = used.get(uid);
  const cur = u && u.day === d ? u : { day: d, n: 0 };
  if (cur.n >= PER_USER_DAY || allDay.n >= ALL_DAY) return false;
  cur.n++; allDay.n++; used.set(uid, cur);
  return true;
}

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

async function ask(contents) {
  let last;
  for (const model of MODELS) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      const r = await Promise.race([
        ai.models.generateContent({
          model, contents,
          config: { systemInstruction: SYSTEM, temperature: 0.4, maxOutputTokens: 2500, abortSignal: ctrl.signal },
        }),
        new Promise((_, rej) => ctrl.signal.addEventListener('abort', () => rej(new Error('timeout')))),
      ]);
      const text = (r.text || '').trim();
      if (text) return { text, model };
      last = new Error('empty');
    } catch (e) { last = e; }
    finally { clearTimeout(timer); }
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
  if (req.method !== 'POST' || req.url !== '/explain') return send(res, origin, 404, { error: 'not_found' });

  const who = await whoIs(req);
  if (!who) return send(res, origin, 401, { error: 'sign_in' });
  let body = '';
  for await (const chunk of req) { body += chunk; if (body.length > 20000) return send(res, origin, 413, { error: 'too_big' }); }
  let b;
  try { b = JSON.parse(body); } catch { return send(res, origin, 400, { error: 'bad_json' }); }
  if (!b?.task?.text || !b?.task?.correct) return send(res, origin, 400, { error: 'no_task' });
  if (!quotaOk(who.uid)) return send(res, origin, 429, { error: 'quota' });

  try {
    const t0 = Date.now();
    const { text, model } = await ask(buildPrompt(b));
    console.log(JSON.stringify({ uid: who.uid, model, ms: Date.now() - t0, q: !!b.question }));
    send(res, origin, 200, { text });
  } catch (e) {
    console.error('explain failed', String(e));
    send(res, origin, 502, { error: 'ai_unavailable' });
  }
});

server.listen(+(process.env.PORT || 8080), () => console.log('bit-helper up'));
