<script lang="ts">
  import { audio } from '../lib/audio';
  let { go }: { go: (s: 'home' | 'sound') => void } = $props();
</script>

<main class="wrap">
  <h1>Разлом</h1>
  <div class="card bit">
    <div class="face" aria-hidden="true"><span></span></div>
    <p>Сәлем! Мен <b>Битпін</b>. Сайт жасалып жатыр — жақында бірге Глитчті жеңеміз.</p>
  </div>
  <div class="row">
    <button onclick={() => { audio.unlock(); audio.play('click'); go('sound'); }}>Дыбыс тексеру</button>
  </div>
</main>

<style>
  .wrap { max-width: 640px; margin: 0 auto; padding: 24px 16px; display: grid; gap: 16px; }
  h1 { font-family: var(--px); font-size: 22px; color: var(--cyan); margin: 0; }
  .bit { display: flex; gap: 12px; align-items: center; }
  .bit p { margin: 0; line-height: 1.5; }
  .bit b { color: var(--cyan); font-weight: 500; }
  .face { flex: none; width: 42px; height: 42px; background: #cfd6ee; border: 2px solid #7d86b8; border-radius: 4px; display: grid; place-items: center; }
  .face span { width: 28px; height: 18px; background: #10143a; border-radius: 2px; display: flex; justify-content: space-around; align-items: center; }
  .face span::before, .face span::after { content: ""; width: 5px; height: 8px; background: var(--cyan); }
  .row { display: flex; gap: 8px; flex-wrap: wrap; }
</style>
