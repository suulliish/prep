// ИИ-помощник «Түсінбедім»: запрос к серверу helper/ (Cloud Run, Gemini через Vertex).
// Только после ответа ученика и только для вошедших в облако — см. helper/README.md.
import { game, persist } from './store.svelte';
import { toBase64 } from './mic';
import { payload, lessonPayload, teachPayload, notebookPayload, readNotebookCheck, type Turn, type TaskContext, type LessonContext, type TeachContext, type TeachReply, type NotebookContext, type NotebookCheck } from '../engine/helperPayload';
export type { Turn, LessonContext, TeachContext, TeachReply, Verdict, NotebookContext, NotebookCheck, NbField, NbMark } from '../engine/helperPayload';

const HELPER_BASE = 'https://bit-helper-264603430786.europe-west1.run.app';
export const HELPER_URL = `${HELPER_BASE}/explain`;
export const TRANSCRIBE_URL = `${HELPER_BASE}/transcribe`;
export const NOTEBOOK_URL = `${HELPER_BASE}/notebook`;
export const MAX_QUESTIONS = 3; // уточняющих вопросов на одну задачу

export type HelperError = 'sign_in' | 'quota' | 'offline' | 'ai_unavailable';

async function postJson(body: object, url = HELPER_URL): Promise<any> {
  let token: string | null = null;
  try { token = await (await import('./cloud.svelte')).idToken(); } catch { /* облако не загрузилось */ }
  if (!token) throw 'sign_in' as HelperError;
  let r: Response;
  try {
    r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
  } catch { throw 'offline' as HelperError; }
  if (r.status === 401 || r.status === 403) throw 'sign_in' as HelperError;   // 403 — аккаунт не в списке разрешённых (helper ALLOW)
  if (r.status === 429) throw 'quota' as HelperError;
  if (!r.ok) throw 'ai_unavailable' as HelperError;
  try { return await r.json(); } catch { throw 'ai_unavailable' as HelperError; }
}
const post = async (body: object): Promise<string> => (await postJson(body)).text;

/** Тексты, которые ребёнок надиктовал (а не напечатал): в журнале командира у них значок микрофона. */
const spokenTexts = new Set<string>();
/** Голосовой ввод отметил текст как сказанный. Поле потом могли поправить — тогда это уже напечатанный текст. */
export function markSpoken(text: string) { const t = text.trim(); if (t) spokenTexts.add(t); if (spokenTexts.size > 20) spokenTexts.delete(spokenTexts.values().next().value!); }

function logAsk(skill: string, task: string, q: string, a: string) {
  game.save.aiLog ??= [];   // отдельной строкой: «(x ??= [])» вернул бы копию, а не массив в сохранении
  const log = game.save.aiLog;
  const voice = spokenTexts.delete(q.trim()) || undefined;
  log.push({ at: Date.now(), day: game.day, skill, task: task.slice(0, 200), q, a, ...(voice ? { voice } : {}) });
  if (log.length > 100) log.splice(0, log.length - 100);
  persist();
}

export async function askBit(c: TaskContext, history: Turn[], question?: string): Promise<string> {
  const text = await post(payload(c, history, question));
  logAsk(c.item.skill, c.item.kz, question?.trim() || 'түсінбедім', text);
  return text;
}

/** Режим «урок»: объяснить шаг урока иначе. Закрытое число уходит на сервер как «▢»; для predict/faded/blitz/final — только после ответа (answered). */
export async function askBitLesson(c: LessonContext, history: Turn[], question?: string): Promise<string> {
  const body = lessonPayload(c, history, question);
  const text = await post(body);
  logAsk(c.skill, `Сабақ · ${c.title}: ${body.step.text}`, question?.trim() || 'түсінбедім', text);
  return text;
}

/** Режим «Биткә түсіндір»: ребёнок объясняет тему, Бит оценивает (verdict) и отвечает коротко, при неполном ответе задаёт один вопрос (followup). Раунд считается по history. */
export async function askBitTeach(c: TeachContext, history: Turn[], answer: string): Promise<TeachReply> {
  const r = await postJson(teachPayload(c, history, answer));
  const ok = r && ['got', 'partial', 'mis'].includes(r.verdict) && typeof r.reply === 'string' && r.reply.trim();
  if (!ok) throw 'ai_unavailable' as HelperError;
  const out: TeachReply = { verdict: r.verdict, reply: r.reply.trim(), followup: typeof r.followup === 'string' && r.followup.trim() ? r.followup.trim() : null };
  logAsk(c.skill, `Үйрет · ${c.title}: ${c.question}`, answer.trim().slice(0, 400), [out.reply, out.followup].filter(Boolean).join(' '));
  return out;
}

/** Голосовой ввод: запись → текст на языке, на котором ребёнок говорил. '' — речи не расслышали. Аудио на сервере не хранится. */
export async function transcribe(rec: { blob: Blob; mime: string; ms: number }, hint?: string): Promise<string> {
  const audio = await toBase64(rec.blob);
  const r = await postJson({ audio, mime: rec.mime, seconds: Math.round(rec.ms / 100) / 10, ...(hint ? { hint: hint.slice(0, 200) } : {}) }, TRANSCRIBE_URL);
  if (!r || typeof r.text !== 'string') throw 'ai_unavailable' as HelperError;
  return r.text.trim();
}

const MARK_RU: Record<string, string> = { ok: '✓', partial: '½', wrong: '✗', missing: '—' };
/** «Дәптер»: Бит проверяет фото бумажной карточки по четырём полям. Фото на сервере не хранится; в журнал командира — отметки и заметки. */
export async function checkNotebookPhoto(c: NotebookContext, image: string, mime: string): Promise<NotebookCheck> {
  const out = readNotebookCheck(await postJson(notebookPayload(c, image, mime), NOTEBOOK_URL));
  if (!out) throw 'ai_unavailable' as HelperError;
  const f = out.fields;
  const a = out.readable
    ? `Ереже ${MARK_RU[f.rule.mark]} ${f.rule.note} · Мысал ${MARK_RU[f.example.mark]} ${f.example.note} · Қақпан ${MARK_RU[f.trap.mark]} ${f.trap.note} · Сызба ${MARK_RU[f.scheme.mark]} ${f.scheme.note}${out.fix ? ` · Түзет: ${out.fix}` : ''}`
    : `Фото не прочитано: ${out.fix}`;
  logAsk(c.skill, `Дәптер · ${c.title}`, '📷 фото тетради', a);
  return out;
}

export const HELPER_ERR: Record<HelperError, string> = {
  sign_in: 'Бит-көмекші облакқа кіргеннен кейін ғана жұмыс істейді. Ағаңнан командир экранында кіруді сұра.',
  quota: 'Бүгінге сұрақтар таусылды. Шешуін тағы бір рет оқы да, ертең сұра — немесе ағаңнан сұра.',
  offline: 'Интернет жоқ сияқты. Шешуін оқып көр немесе ағаңнан сұра.',
  ai_unavailable: 'Бит қазір жауап бере алмады. Сәлден соң қайта көр немесе ағаңнан сұра.',
};
