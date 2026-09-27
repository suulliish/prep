import { mount } from 'svelte';
import './app.css';
import App from './App.svelte';

mount(App, { target: document.getElementById('app')! });

// Офлайн-кэш и установка на экран «Домой» — только на настоящем сайте (GitHub Pages / Firebase Hosting)
if ('serviceWorker' in navigator && import.meta.env.PROD && /github\.io$|web\.app$|firebaseapp\.com$/.test(location.hostname)) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
