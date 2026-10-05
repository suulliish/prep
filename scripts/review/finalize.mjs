// Служебный шаг apply.mjs --patch, запускается в НОВОМ процессе (модули уроков в процессе apply загружены со старым текстом):
// сверяет, что правка действительно попала в текст урока, и пишет статус с новым хэшем. Вручную обычно не нужен.
//   node scripts/review/finalize.mjs план.json
import { readFileSync } from 'node:fs';
import { current } from './current.mjs';
import { syncStatus } from './lib.mjs';
import { readStatus, writeStatus } from './status.mjs';

const plan = JSON.parse(readFileSync(process.argv[2], 'utf8')), cur = current();
const st = syncStatus(readStatus(), cur.hashes);
for (const [id, p] of Object.entries(plan)) {
  if (!Object.hasOwn(cur.lessons, id)) continue;
  // правка засчитана только если текст урока теперь равен новому тексту (защита от «внесено», а текст не изменился)
  const open = p.fixes.filter(f => !(f.applied && cur.lessons[id].text[f.id] === f.now));
  const next = open.length ? 'fix' : p.complete ? 'ok' : 'draft';
  st[id] = { st: next, h: cur.hashes[id], ...(open.length ? { d: open.map(({ id: k, was, now, note }) => ({ id: k, was, now, note })) } : {}) };
  console.log(`${id}: ${next}${open.length ? ` (не внесено правок: ${open.length})` : ''}${next === 'draft' ? ' (внесены поправки, но проверены не все куски урока)' : ''}`);
}
writeStatus(st);
