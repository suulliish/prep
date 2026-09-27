import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

// base: сайт публикуется на GitHub Pages по адресу /prep/
export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? '/prep/' : './',
  plugins: [svelte()],
  test: { include: ['src/**/*.test.ts', 'tests/**/*.test.ts'] },
});
