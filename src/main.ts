import { mount } from 'svelte';
import './app.css';
import App from './App.svelte';
import { startTracking } from './lib/track.svelte';

mount(App, { target: document.getElementById('app')! });
startTracking();   // поведение для аналитики командира (src/lib/track.svelte.ts)

// Офлайн-кэш и установка на экран «Домой» — только на настоящем сайте (GitHub Pages / Firebase Hosting)
if ('serviceWorker' in navigator && import.meta.env.PROD && /github\.io$|web\.app$|firebaseapp\.com$/.test(location.hostname)) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
