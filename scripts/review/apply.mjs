// Применить ответы проверяющего (JSON из кнопки «Нәтижені көшіру») к content/kz_review.json.
//   node scripts/review/apply.mjs результат.json            статусы + отчёт с поправками (тексты уроков не трогает)
//   node scripts/review/apply.mjs результат.json --patch    поправки ещё и вносятся в исходники (только однозначные места)
//   node scripts/review/apply.mjs результат.json --dry      ничего не пишет, только показывает
// Урок получает ok, только если проверены ВСЕ его куски (ok или fix); правки внесены и подтверждены текстом урока.
// После --patch: озвучка изменившихся строк делается заново (docs/KZ_REVIEW.md), затем npm test.
import { readFileSync, writeFileSync, readdirSync, mkdtempSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { current } from './current.mjs';
import { applyResults, patchSources, syncStatus, validateResults, cleanNow } from './lib.mjs';
import { readStatus, writeStatus } from './status.mjs';

const die = m => { console.error('Ошибка: ' + m); process.exit(1); };
const args = process.argv.slice(2), file = args.find(a => !a.startsWith('--'));
if (!file) die('укажите файл с результатом: node scripts/review/apply.mjs результат.json [--patch] [--dry]');
let raw;
try { raw = JSON.parse(readFileSync(file, 'utf8')); } catch (e) { die(`не удалось прочитать JSON из «${file}» (${e.message}). Нужен текст целиком из кнопки «Нәтижені көшіру»`); }
let results;
try { results = validateResults(raw); } catch (e) { die(e.message); }

const cur = current();
const { status, report, fixes } = applyResults(syncStatus(readStatus(), cur.hashes), results, { lessons: cur.lessons, generators: cur.generators });
const dry = args.includes('--dry');

let md = `# Результат проверки казахского: ${results.pack ?? file}\n\nПроверял: ${results.by || 'не указан'} · отправлено: ${results.exported ?? '?'}\n\n`;
md += `- уроки и генераторы ok: ${report.ok.length}\n- с поправками: ${report.fix.length}\n- проверены не до конца: ${report.partial.length}${report.partial.length ? ' (' + report.partial.join(', ') + ')' : ''}\n- текст изменился после сборки пакета, ответ пропущен: ${report.stale.length}${report.stale.length ? ' (' + report.stale.join(', ') + ')' : ''}\n- неизвестные id: ${report.unknown.length}\n\n`;
const termFix = Object.entries(results.terms).filter(([, v]) => v.textbook);
if (termFix.length) md += `## Термины: в учебнике иначе\n\n${termFix.map(([k, v]) => `- «${k}» → «${v.textbook}»`).join('\n')}\n\n`;
if (fixes.length) md += `## Поправки\n\n${fixes.map(f => `- **${f.lesson}** · ${f.id}${f.note ? ' · ' + f.note : ''}\n  - было: ${String(f.was).replace(/\n/g, ' ⏎ ')}\n  - стало: ${String(f.now).replace(/\n/g, ' ⏎ ')}`).join('\n')}\n`;

let plan = null;
if (args.includes('--patch') && fixes.length) {
  const dir = new URL('../../content/', import.meta.url);
  // тексты уроков, название темы (skills.mjs) и приёма (techniques.mjs)
  const names = readdirSync(dir).filter(n => /^lessons.*\.mjs$/.test(n)).concat(['skills.mjs', 'techniques.mjs']);
  const orig = Object.fromEntries(names.map(n => [n, readFileSync(new URL(n, dir), 'utf8')]));
  let files = orig;
  plan = {};
  for (const f of fixes) {
    const p = (plan[f.lesson] ??= { complete: report.complete.includes(f.lesson), fixes: [] });
    const now = f.id === 'generator' ? null : cleanNow(f.now, f.was);
    const entry = { id: f.id, was: f.was, now: now ?? f.now, note: f.note, applied: false };
    p.fixes.push(entry);
    if (now === null || now === f.was) { entry.why = 'правка не текстом или без слов, внесите вручную'; continue; }
    if (/^(?:blitz\.\d+|\d+:blitz\.\d+)$/.test(f.id) || f.id.includes('blitz.')) { entry.why = 'вопрос блица рождается кодом, правьте в content/lessons*.mjs (make)'; continue; }
    const r = patchSources(files, f.was, now);
    if (r.ok) { files = r.files; entry.applied = true; } else entry.why = r.why;
  }
  // все изменённые файлы должны остаться корректными модулями; иначе не пишем ни одного (откат целиком)
  const bad = [], changed = names.filter(n => files[n] !== orig[n]);
  if (changed.length) {
    const tmp = mkdtempSync(join(tmpdir(), 'kzpatch-'));
    for (const n of changed) {
      const t = join(tmp, n); writeFileSync(t, files[n]);
      try { execFileSync(process.execPath, ['--check', t], { stdio: 'pipe' }); } catch { bad.push(n); }
    }
    if (bad.length) { for (const p of Object.values(plan)) for (const x of p.fixes) if (x.applied) { x.applied = false; x.why = `файл ${bad.join(', ')} после правки не проходит проверку синтаксиса, ничего не записано`; } }
    else if (!dry) for (const n of changed) writeFileSync(new URL(n, dir), files[n]);
  }
  const lines = Object.entries(plan).flatMap(([l, p]) => p.fixes.map(x => `  - ${l} · ${x.id}: ${x.applied ? 'внесено' : 'НЕ внесено: ' + x.why}`));
  md += `\n## Внесение в исходники (--patch${dry ? ', пробный прогон' : ''})\n\n${lines.join('\n')}\n${bad.length ? `\nОткат: ${bad.join(', ')} не прошёл проверку синтаксиса\n` : ''}\nДальше: озвучка изменившихся строк (docs/KZ_REVIEW.md), \`npm test\`.\n`;
}
console.log(md);
if (!dry) {
  // уроки с правками: хэш после правки считает новый процесс (finalize.mjs), здесь пишем остальное
  writeStatus(status);
  writeFileSync(file.replace(/\.json$/, '') + '-отчёт.md', md);
  if (plan) {
    const pf = join(mkdtempSync(join(tmpdir(), 'kzplan-')), 'plan.json'); writeFileSync(pf, JSON.stringify(plan));
    execFileSync(process.execPath, [new URL('./finalize.mjs', import.meta.url).pathname, pf], { stdio: 'inherit' });
  }
}
