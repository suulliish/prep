import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

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
  }],
  test: { include: ['src/**/*.test.ts', 'tests/**/*.test.ts'] },
});
