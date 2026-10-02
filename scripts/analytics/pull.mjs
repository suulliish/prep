// Выгрузка данных ученика прямо из Firestore (проект prep-b72a9) — для разбора вне сайта.
// Читает users/{uid} (сохранение), users/{uid}/attempts/* (ответы по месяцам), users/{uid}/usage/* (поведение по дням)
// и собирает одно сохранение, как его скачивает «Данные → копия» в командире.
//
// Доступ: OAuth-токен аккаунта с правом чтения Firestore в проекте prep-b72a9 (правила Firestore на него не действуют, работает IAM):
//   ACCESS_TOKEN=$(gcloud auth print-access-token) node scripts/analytics/pull.mjs [uid] > save.json
//   или GOOGLE_APPLICATION_CREDENTIALS=<путь к ключу сервис-аккаунта с ролью «Cloud Datastore Viewer»>,
//   или FIREBASE_SA_JSON=<содержимое того же ключа> (так ключ кладётся в переменные облачной среды Claude) — токен берётся через gcloud.
// Без uid — список пользователей. Потом: node scripts/analytics/report.mjs save.json
import { execSync } from 'node:child_process';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PROJECT = process.env.FIREBASE_PROJECT || 'prep-b72a9';
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;

function token() {
  if (process.env.ACCESS_TOKEN) return process.env.ACCESS_TOKEN.trim();
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS && !process.env.FIREBASE_SA_JSON) throw new Error('Нет доступа: задайте FIREBASE_SA_JSON, GOOGLE_APPLICATION_CREDENTIALS или ACCESS_TOKEN (см. начало файла).');
  try {
    let sa = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    if (!sa && process.env.FIREBASE_SA_JSON) { sa = join(mkdtempSync(join(tmpdir(), 'sa-')), 'key.json'); writeFileSync(sa, process.env.FIREBASE_SA_JSON, { mode: 0o600 }); }
    if (sa) execSync(`gcloud auth activate-service-account --key-file="${sa}" --quiet`, { stdio: 'ignore' });
    return execSync('gcloud auth print-access-token', { encoding: 'utf8' }).trim();
  } catch { throw new Error('Нет доступа: задайте ACCESS_TOKEN или GOOGLE_APPLICATION_CREDENTIALS (см. начало файла).'); }
}

const T = token();
async function get(path) {
  const r = await fetch(`${BASE}/${path}`, { headers: { Authorization: `Bearer ${T}` } });
  if (!r.ok) throw new Error(`${r.status} ${path}: ${(await r.text()).slice(0, 300)}`);
  return r.json();
}
async function list(path) {
  const out = [];
  let page = '';
  do {
    const j = await get(`${path}?pageSize=300${page ? `&pageToken=${page}` : ''}`);
    out.push(...(j.documents ?? []));
    page = j.nextPageToken ?? '';
  } while (page);
  return out;
}
const str = (doc, f) => doc.fields?.[f]?.stringValue;
const id = doc => doc.name.split('/').pop();

const uid = process.argv[2];
if (!uid) {
  for (const d of await list('users')) {
    const s = JSON.parse(str(d, 'save') ?? '{}');
    console.log(`${id(d)}\t${s.heroName ?? ''}\tобновлено ${new Date(Number(d.fields?.updatedAt?.integerValue ?? 0)).toISOString()}`);
  }
  process.exit(0);
}
const main = await get(`users/${uid}`);
const save = JSON.parse(str(main, 'save'));
save.attempts = (await list(`users/${uid}/attempts`)).flatMap(d => JSON.parse(str(d, 'list'))).sort((a, b) => a.at - b.at);
save.usage = (await list(`users/${uid}/usage`).catch(() => [])).flatMap(d => JSON.parse(str(d, 'list'))).sort((a, b) => (a.day < b.day ? -1 : 1));
process.stdout.write(JSON.stringify(save));
