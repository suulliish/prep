import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { mediaMap, makeSw } from './scripts/swbuild.mjs';

// Версия сборки (docs/systems/IMPLEMENTATION.md, S6): «версия пакета + коммит.дата», видна командиру и пишется в облако и в сбои.
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));
const sha = (process.env.GITHUB_SHA ?? (() => { try { return execSync('git rev-parse HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString(); } catch { return 'local'; } })()).trim().slice(0, 7);
const APP_VERSION = `${pkg.version}+${sha}.${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`;

// base: сайт публикуется на GitHub Pages по адресу /prep/
export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? '/prep/' : './',
  define: { __APP_VERSION__: JSON.stringify(APP_VERSION) },
  plugins: [svelte(), {
    // dist/version.json — по нему открытое приложение узнаёт, что вышла новая версия (S7)
    name: 'app-version',
    generateBundle() { this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ app: APP_VERSION }) }); },
  }, {
    // dist/sw.js — офлайн-кэш с версией сборки и хэшами голоса/моделей (S7, scripts/sw.template.js); в public/ его больше нет
    name: 'app-sw',
    generateBundle(_o, bundle) {
      const tpl = readFileSync(new URL('./scripts/sw.template.js', import.meta.url), 'utf8');
      const assets = Object.keys(bundle).filter(k => k.startsWith('assets/'));   // файлы этой сборки: по ним service worker решает, что из старого кэша ещё нужно
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: makeSw(tpl, APP_VERSION, mediaMap(fileURLToPath(new URL('./public', import.meta.url))), assets) });
    },
  }],
  test: { include: ['src/**/*.test.ts', 'tests/**/*.test.ts'] },
});
