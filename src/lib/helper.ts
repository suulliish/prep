// ИИ-помощник «Түсінбедім»: запрос к серверу helper/ (Cloud Run, Gemini через Vertex).
// Только после ответа ученика и только для вошедших в облако — см. helper/README.md.
import { game, persist } from './store.svelte';
import { payload, type Turn, type TaskContext } from '../engine/helperPayload';
export type { Turn } from '../engine/helperPayload';

export const HELPER_URL = 'https://bit-helper-264603430786.europe-west1.run.app/explain';
export const MAX_QUESTIONS = 3; // уточняющих вопросов на одну задачу

export type HelperError = 'sign_in' | 'quota' | 'offline' | 'ai_unavailable';

export async function askBit(c: TaskContext, history: Turn[], question?: string): Promise<string> {
  let token: string | null = null;
  try { token = await (await import('./cloud.svelte')).idToken(); } catch { /* облако не загрузилось */ }
  if (!token) throw 'sign_in' as HelperError;
  let r: Response;
  try {
    r = await fetch(HELPER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload(c, history, question)),
    });
  } catch { throw 'offline' as HelperError; }
  if (r.status === 401) throw 'sign_in' as HelperError;
  if (r.status === 429) throw 'quota' as HelperError;
  if (!r.ok) throw 'ai_unavailable' as HelperError;
  const { text } = await r.json();
  const log = (game.save.aiLog ??= []);
  log.push({ at: Date.now(), day: game.day, skill: c.item.skill, task: c.item.kz.slice(0, 200), q: question?.trim() || 'түсінбедім', a: text });
  if (log.length > 100) log.splice(0, log.length - 100);
  persist();
  return text;
}

export const HELPER_ERR: Record<HelperError, string> = {
  sign_in: 'Бит-көмекші облакқа кіргеннен кейін ғана жұмыс істейді. Ағаңнан командир экранында кіруді сұра.',
  quota: 'Бүгінге сұрақтар таусылды. Шешуін тағы бір рет оқы да, ертең сұра — немесе ағаңнан сұра.',
  offline: 'Интернет жоқ сияқты. Шешуін оқып көр немесе ағаңнан сұра.',
  ai_unavailable: 'Бит қазір жауап бере алмады. Сәлден соң қайта көр немесе ағаңнан сұра.',
};
