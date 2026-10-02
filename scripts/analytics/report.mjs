// Отчёт аналитики из сохранения (файл «Данные → копия» из командира или выгрузка scripts/analytics/pull.mjs):
//   node scripts/analytics/report.mjs save.json [--days 30] [--today 2026-10-02] [--tz 300] [--json]
// Тот же разбор, что во вкладке «Аналитика» (src/engine/analytics.ts); Node сам убирает типы TypeScript (22.18+).
import { readFileSync } from 'node:fs';
import { analyze, reportMarkdown } from '../../src/engine/analytics.ts';
import { mistakeName } from '../../src/engine/mistakeNames.ts';
import { skills } from '../../content/skills.mjs';

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : d; };
const file = args.find(a => !a.startsWith('--') && !args[args.indexOf(a) - 1]?.startsWith('--'));
if (!file) { console.error('Укажите файл: node scripts/analytics/report.mjs save.json'); process.exit(1); }
const save = JSON.parse(readFileSync(file, 'utf8'));
const last = [...(save.attempts ?? [])].map(a => a.day).concat((save.usage ?? []).map(u => u.day)).sort().pop();
const a = analyze(save, {
  today: opt('today', last ?? new Date().toISOString().slice(0, 10)),
  days: Number(opt('days', 14)),
  tzMin: Number(opt('tz', 300)),   // Казахстан, UTC+5
  title: id => skills.find(s => s.id === id)?.title.ru ?? id,
  mistake: mistakeName,
});
console.log(args.includes('--json') ? JSON.stringify(a, null, 2) : reportMarkdown(a, save.heroName));
