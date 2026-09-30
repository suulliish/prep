<script lang="ts">
  // Событие боя на весь экран (docs/GAME_LOOP.md 20): крупная надпись в момент касания и тонкая полоска времени внизу. Кнопок и текста Бита нет:
  // событие кончается само. Саму анимацию ведёт 3D-сцена (src/three/arena.ts), экран только подписывает её.
  import { EVENT_SAY, type EventKind } from '../engine/confidence';
  let { kind, ms, show, small = '' }: { kind: EventKind; ms: number; show: boolean; small?: string } = $props();
  const say = $derived(EVENT_SAY[kind]);
</script>

<div class="ev" aria-live="polite">
  {#if show}<div class="cap"><b class="big {say.tone}">{say.big}</b><span class="small">{small || say.small}</span></div>{/if}
  <div class="timer" aria-hidden="true"><i style="animation-duration:{ms}ms"></i></div>
</div>

<style>
  .ev { position: absolute; inset: 0; pointer-events: none; }
  .cap { position: absolute; left: 0; right: 0; top: 12%; display: grid; justify-items: center; gap: 8px; padding: 0 12px; }
  .big { display: block; text-align: center; font: 900 clamp(30px, 9.5vw, 52px)/1.05 var(--disp); color: #fff; -webkit-text-stroke: 3px var(--outline); paint-order: stroke fill; text-shadow: 0 6px 0 var(--outline); animation: slam .45s cubic-bezier(.2, 1.6, .4, 1) both; }
  .big.gold { color: var(--gold); } .big.cyan { color: var(--code); } .big.red { color: #ff5a6e; } .big.white { color: #fff; }
  .small { font: 800 15px var(--txt); color: #fff; background: #0b1030cc; padding: 5px 12px; border-radius: 12px; border: 2px solid var(--outline); animation: rise .4s .15s both; text-align: center; }
  .timer { position: absolute; left: 28px; right: 28px; bottom: 16px; height: 6px; border-radius: 99px; background: #ffffff33; overflow: hidden; }
  .timer i { display: block; height: 100%; width: 0; background: #fff; animation: fill linear forwards; }
  @keyframes fill { to { width: 100%; } }
  @keyframes slam { from { transform: scale(2.2); opacity: 0; } to { transform: none; opacity: 1; } }
  @keyframes rise { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
  @media (prefers-reduced-motion: reduce) { .big, .small { animation: none; } }
  @media (max-height: 460px) { .cap { top: 6%; } .small { font-size: 13px; } .timer { bottom: 8px; } }
</style>
