// Сборка service worker (S7): шаблон scripts/sw.template.js + версия сборки + хэши файлов голоса/моделей → dist/sw.js.
// Вызывается из vite.config.ts; тест — tests/sw_cache.test.ts.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, relative, sep } from 'node:path';

/** Папки public/, чьи файлы кэшируются с хэшем содержимого (всё, что не лежит в assets/ с хэшем в имени). */
export const MEDIA_DIRS = ['voice', 'models', 'sfx', 'fx', 'ui', 'figures'];

/** { 'voice/a.mp3': 'a1b2c3d4', ... } — по содержимому файлов; скрытые файлы (.DS_Store) пропускаются. */
export function mediaMap(publicDir, dirs = MEDIA_DIRS) {
  const out = {};
  const walk = d => {
    for (const name of readdirSync(d).sort()) {
      if (name.startsWith('.')) continue;
      const p = join(d, name), st = statSync(p);
      if (st.isDirectory()) walk(p);
      else out[relative(publicDir, p).split(sep).join('/')] = createHash('sha1').update(readFileSync(p)).digest('hex').slice(0, 8);
    }
  };
  for (const d of dirs) { try { walk(join(publicDir, d)); } catch { /* папки нет */ } }
  return out;
}

/** Подставить в шаблон версию и список хэшей. Нет места подстановки — ошибка сборки (иначе кэш молча остался бы без версии). */
export function makeSw(template, build, map, assets = []) {
  if (!template.includes("'__BUILD__'") || !/\/\*@media-map\*\/[\s\S]*?\/\*@end\*\//.test(template) || !/\/\*@assets\*\/[\s\S]*?\/\*@end\*\//.test(template)) throw new Error('sw.template.js: нет мест подстановки __BUILD__ / @media-map / @assets');
  return template
    .replace("'__BUILD__'", () => JSON.stringify(build))
    .replace(/\/\*@media-map\*\/[\s\S]*?\/\*@end\*\//, () => JSON.stringify(map))
    .replace(/\/\*@assets\*\/[\s\S]*?\/\*@end\*\//, () => JSON.stringify(assets));
}
