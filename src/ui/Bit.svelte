<script lang="ts">
  // Дрон Бит: пиксельное лицо с эмоцией + реплика с эффектом печатной машинки.
  import { audio } from '../lib/audio';
  let { text = '', mood = 'idle', voice = '', compact = false }:
    { text?: string; mood?: 'idle' | 'happy' | 'wow' | 'think' | 'sad'; voice?: string; compact?: boolean } = $props();
  let shown = $state('');
  let timer: number | undefined;
  $effect(() => {
    const full = text; shown = '';
    clearInterval(timer);
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { shown = full; return; }
    let i = 0;
    timer = window.setInterval(() => { i += 2; shown = full.slice(0, i); if (i >= full.length) clearInterval(timer); }, 18);
    if (voice) audio.say(voice);
    return () => clearInterval(timer);
  });
</script>

<div class="bit" class:compact>
  <div class="face {mood}" aria-hidden="true">
    <i class="ant"></i>
    <div class="screen"><b></b><b></b></div>
  </div>
  {#if text}
    <p class="bubble" aria-live="polite"><span class="ghost">{text}</span><span class="typed">{shown}</span></p>
  {/if}
</div>

<style>
  .bit { display: flex; gap: 12px; align-items: flex-start; }
  .face { flex: none; position: relative; width: 52px; height: 46px; background: #cfd6ee; border: 3px solid #7d86b8; border-radius: 6px; display: grid; place-items: center; animation: bob 2.4s ease-in-out infinite; }
  .compact .face { width: 40px; height: 36px; }
  .ant { position: absolute; top: -12px; left: 50%; width: 3px; height: 10px; background: #7d86b8; transform: translateX(-50%); }
  .ant::after { content: ''; position: absolute; top: -6px; left: -3px; width: 9px; height: 9px; background: var(--glitch); box-shadow: 0 0 8px var(--glitch); animation: blinkant 1.2s infinite; }
  .screen { width: 36px; height: 24px; background: #0c1036; border-radius: 3px; display: flex; justify-content: space-around; align-items: center; padding: 0 4px; }
  .compact .screen { width: 28px; height: 18px; }
  .screen b { width: 6px; height: 11px; background: var(--code); box-shadow: 0 0 6px var(--code); animation: blink 3.4s infinite; }
  .happy .screen b { height: 4px; border-radius: 4px 4px 0 0; transform: translateY(-2px); }
  .wow .screen b { width: 9px; height: 12px; }
  .think .screen b { height: 5px; transform: translateY(2px); }
  .sad .screen b { background: #9fb0ff; height: 7px; transform: translateY(3px); }
  .bubble { position: relative; flex: 1; background: var(--panel-hi); border: 2px solid var(--line-hi); border-radius: 10px; padding: 10px 14px; font-size: var(--fs-m); line-height: 1.5; font-weight: 700; }
  .compact .bubble { font-size: var(--fs-s); padding: 8px 12px; }
  .bubble::before { content: ''; position: absolute; left: -9px; top: 14px; border: 8px solid transparent; border-right-color: var(--line-hi); border-left: 0; }
  .ghost { visibility: hidden; }
  .typed { position: absolute; inset: 10px 14px; }
  .compact .typed { inset: 8px 12px; }
  @keyframes bob { 50% { transform: translateY(-4px); } }
  @keyframes blink { 0%, 94%, 100% { transform: scaleY(1); } 96% { transform: scaleY(.1); } }
  @keyframes blinkant { 50% { opacity: .4; } }
</style>
