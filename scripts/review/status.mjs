// Статус проверки казахского (content/kz_review.json).
//   node scripts/review/status.mjs            показать сводку (файл не меняет)
//   node scripts/review/status.mjs --init     создать/обновить файл: новые = draft, изменившиеся после ok = draft
//   node scripts/review/status.mjs --accept a,b   отметить уроки/генераторы ok с текущим хэшем (после применения поправок)
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { current } from './current.mjs';
import { syncStatus, isMain } from './lib.mjs';

const path = new URL('../../content/kz_review.json', import.meta.url);
export const readStatus = () => (existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : {});
export const writeStatus = s => writeFileSync(path, JSON.stringify(Object.fromEntries(Object.entries(s).sort(([a], [b]) => a.localeCompare(b))), null, 1) + '\n');

if (isMain(import.meta.url)) {
  const cur = current(), args = process.argv.slice(2);
  let st = syncStatus(readStatus(), cur.hashes);
  const acc = args.indexOf('--accept');
  if (acc >= 0) { const ids = (args[acc + 1] ?? '').split(',').filter(Boolean); if (!ids.length) { console.error('--accept: укажите id через запятую'); process.exit(1); } for (const id of ids) { if (!Object.hasOwn(cur.hashes, id)) { console.error('нет такого id:', id); process.exit(1); } st[id] = { st: 'ok', h: cur.hashes[id] }; } writeStatus(st); console.log('принято:', args[acc + 1]); }
  else if (args.includes('--init')) { writeStatus(st); console.log('content/kz_review.json обновлён'); }
  const n = { draft: 0, ok: 0, fix: 0 }, L = { draft: 0, ok: 0, fix: 0 };
  for (const [id, v] of Object.entries(st)) { n[v.st]++; if (cur.lessons[id]) L[v.st]++; }
  console.log(`всего ${Object.keys(st).length}: ok ${n.ok}, правки ${n.fix}, черновик ${n.draft} · из них уроков ${Object.keys(cur.lessons).length}: ok ${L.ok}, правки ${L.fix}, черновик ${L.draft}`);
}
