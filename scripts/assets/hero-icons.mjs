// Портреты костюмов героя и иконки наград за звёзды: heroicon.html?hero=<id> (256×320) и ?reward=<id> (256×256), модель на прозрачном фоне.
// Снимок с omitBackground в двойном размере, уменьшение (гладкие края), палитра → public/ui/hero/<id>.png и reward-<id>.png (до 40 КБ).
// Запуск при работающем `npm run dev`:
//   PLAYWRIGHT=/путь/к/playwright-core/index.mjs CHROME="/путь/к/Google Chrome for Testing" node scripts/assets/hero-icons.mjs [id ...]
// id костюма (cyan, gold...) или награды (trail_cyan, cape_red...); без аргументов — все. Нужны playwright-core и sharp (в зависимости проекта не входят, ставятся отдельно).
// Порт dev-сервера: PORT (по умолчанию 5173).
import fs from 'node:fs';
import { OUTFITS, STAR_REWARDS } from '../../content/worlds.mjs';

const { chromium } = await import(process.env.PLAYWRIGHT ?? 'playwright-core');
const sharp = (await import('sharp')).default;
const port = process.env.PORT ?? 5173;
const all = [...OUTFITS.map(o => ({ id: o.id, q: `hero=${o.id}`, file: o.id, w: 256, h: 320 })), ...STAR_REWARDS.map(r => ({ id: r.id, q: `reward=${r.id}`, file: `reward-${r.id}`, w: 256, h: 256 }))];
const todo = process.argv.length > 2 ? all.filter(x => process.argv.slice(2).includes(x.id)) : all;
fs.mkdirSync('public/ui/hero', { recursive: true });
const b = await chromium.launch({ executablePath: process.env.CHROME, headless: true, args: ['--use-angle=metal', '--ignore-gpu-blocklist'] });
for (const it of todo) {
  const p = await b.newPage({ viewport: { width: it.w, height: it.h }, deviceScaleFactor: 2 });
  p.on('pageerror', e => console.log('ошибка страницы:', e.message));
  await p.goto(`http://localhost:${port}/heroicon.html?${it.q}`); await p.waitForFunction(() => window.__ready === true, null, { timeout: 40000 }); await p.waitForTimeout(300);
  const raw = await p.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: it.w, height: it.h } });
  const out = await sharp(raw).resize(it.w, it.h, { kernel: 'lanczos3' }).png({ palette: true, colors: 192, quality: 90, effort: 10, compressionLevel: 9 }).toBuffer();
  fs.writeFileSync(`public/ui/hero/${it.file}.png`, out); console.log(it.file, (out.length / 1024).toFixed(1) + ' КБ');
  await p.close();
}
await b.close();
