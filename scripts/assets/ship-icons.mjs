// Иконки мастерской корабля: decor.html?icon=<id> (модель на прозрачном фоне 256×256) → скриншот без фона → палитра → public/ui/ship/<id>.png (до 30 КБ).
// Запуск при работающем `npm run dev`:
//   PLAYWRIGHT=/путь/к/playwright-core/index.mjs CHROME="/путь/к/Google Chrome for Testing" node scripts/assets/ship-icons.mjs [id ...]
// Нужны playwright-core и sharp (в зависимости проекта не входят, ставятся отдельно). Порт dev-сервера: PORT (по умолчанию 5173).
import fs from 'node:fs';
import { SHIP_ITEMS } from '../../content/ship_items.mjs';

const { chromium } = await import(process.env.PLAYWRIGHT ?? 'playwright-core');
const sharp = (await import('sharp')).default;
const port = process.env.PORT ?? 5173, ids = process.argv.length > 2 ? process.argv.slice(2) : SHIP_ITEMS.map(i => i.id);
fs.mkdirSync('public/ui/ship', { recursive: true });
const b = await chromium.launch({ executablePath: process.env.CHROME, headless: true, args: ['--use-angle=metal', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 256, height: 256 }, deviceScaleFactor: 1 });
p.on('pageerror', e => console.log('ошибка страницы:', e.message));
for (const id of ids) {
  await p.goto(`http://localhost:${port}/decor.html?icon=${id}`); await p.waitForFunction(() => window.__ready === true, null, { timeout: 30000 }); await p.waitForTimeout(300);
  const raw = await p.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: 256, height: 256 } });
  const out = await sharp(raw).png({ palette: true, colors: 128, quality: 90, effort: 10, compressionLevel: 9 }).toBuffer();
  fs.writeFileSync(`public/ui/ship/${id}.png`, out); console.log(id, (out.length / 1024).toFixed(1) + ' КБ');
}
await b.close();
