<script lang="ts">
  // Карточка приёма (docs/GAME_LOOP.md 19): после «Есте сақта» ребёнок получает свой приём темы. Цвет приёма, значок вида удара
  // (дуга, выпад, разрез, двойной, вихрь), название, «Жаңа тәсіл!». Появляется с пружинкой, лучи за карточкой вращаются, искры разлетаются, название блестит.
  // Звук levelup; закрывается касанием, Enter, пробелом или Esc (первые 0.5 с не закрывается: чтобы не смахнуть случайным касанием).
  import { onMount } from 'svelte';
  import { audio } from '../lib/audio';
  let { name, color, fx, onclose }: { name: string; color: number; fx: 'arc' | 'pierce' | 'split' | 'multi' | 'spin'; onclose: () => void } = $props();
  const hex = $derived('#' + color.toString(16).padStart(6, '0'));
  let armed = $state(false);
  // 14 искр: угол, дальность и задержка заранее, без случайности при перерисовке
  const sparks = Array.from({ length: 14 }, (_, k) => ({ a: (k / 14) * 360 + (k % 2) * 12, r: 120 + ((k * 37) % 70), d: (k * 41) % 260, s: 10 + (k % 3) * 5 }));
  function close() { if (!armed) return; audio.play('click'); onclose(); }
  onMount(() => {
    audio.play('levelup');
    const t = window.setTimeout(() => (armed = true), 500);
    return () => clearTimeout(t);
  });
  const onKey = (e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); } };
</script>

<svelte:window onkeydown={onKey} />
<div class="veil" style="--tc:{hex}" role="dialog" aria-modal="true" aria-label={'Жаңа тәсіл: ' + name}>
  <button class="tap" onclick={close} aria-label="Жалғастыру"></button>
  <div class="stage">
    <div class="rays" aria-hidden="true"></div>
    <div class="sparks" aria-hidden="true">{#each sparks as s}<i style="--a:{s.a}deg; --r:{s.r}px; --d:{s.d}ms; --s:{s.s}px"></i>{/each}</div>
    <div class="card">
      <span class="ribbon">Жаңа тәсіл!</span>
      <svg class="ic" viewBox="0 0 96 96" aria-hidden="true">
        {#if fx === 'arc'}
          <path class="ol" d="M14 74 Q34 12 82 22" /><path class="fl" d="M14 74 Q34 12 82 22" /><path class="tip" d="M82 22 74 12 M82 22 72 30" />
        {:else if fx === 'pierce'}
          <path class="ol" d="M8 48H76" /><path class="fl" d="M8 48H76" /><path class="hd" d="M70 30 90 48 70 66Z" /><path class="tip" d="M6 34H30M14 62H40" />
        {:else if fx === 'split'}
          <path class="hd" d="M48 12A36 36 0 0 0 20 72L52 40Z" /><path class="hd h2" d="M60 30 76 24A36 36 0 0 1 76 76L28 84Z" /><path class="ol" d="M10 88 88 8" /><path class="fl" d="M10 88 88 8" />
        {:else if fx === 'multi'}
          <path class="ol" d="M14 78 46 18" /><path class="fl" d="M14 78 46 18" /><path class="ol l2" d="M38 84 70 24" /><path class="fl l2" d="M38 84 70 24" /><path class="ol l3" d="M60 88 92 28" /><path class="fl l3" d="M60 88 92 28" />
        {:else}
          <path class="ol" d="M78 30A34 34 0 1 0 82 56" /><path class="fl" d="M78 30A34 34 0 1 0 82 56" /><path class="hd" d="M70 12 90 34 62 40Z" />
        {/if}
      </svg>
      <b class="name">{name}</b>
      <span class="hint" class:on={armed}>Түртіп жалғастыр</span>
    </div>
  </div>
</div>

<style>
  .veil { position: fixed; inset: 0; z-index: calc(var(--z-modal) + 12); display: grid; place-items: center; padding: 14px; overflow: hidden;
    background: radial-gradient(circle at 50% 42%, color-mix(in srgb, var(--tc) 38%, #2a3fb0) 0%, #05061af0 72%); backdrop-filter: blur(3px); animation: tc-fade .25s ease-out both; }
  .tap { position: absolute; inset: 0; width: 100%; height: 100%; background: none; border: 0; cursor: pointer; }
  .stage { position: relative; width: min(340px, 100%); display: grid; place-items: center; pointer-events: none; }
  /* лучи: широкий конус, медленно крутится за карточкой */
  .rays { position: absolute; width: 560px; height: 560px; max-width: 150vw; border-radius: 50%; opacity: .5; animation: tc-spin 14s linear infinite, tc-fade .6s .1s ease-out both;
    background: repeating-conic-gradient(from 0deg, color-mix(in srgb, var(--tc) 70%, transparent) 0 9deg, transparent 9deg 24deg);
    -webkit-mask-image: radial-gradient(circle, #000 12%, transparent 66%); mask-image: radial-gradient(circle, #000 12%, transparent 66%); }
  .sparks { position: absolute; inset: 0; display: grid; place-items: center; }
  .sparks i { position: absolute; width: var(--s); height: var(--s); background: var(--tc); border: 2px solid var(--outline); border-radius: 3px; transform: rotate(45deg) scale(0); opacity: 0;
    animation: tc-spark 1.1s var(--d) cubic-bezier(.2, .8, .3, 1) both, tc-twinkle 1.8s calc(var(--d) + 1.1s) ease-in-out infinite; }
  .card { position: relative; width: 100%; display: grid; gap: 10px; justify-items: center; text-align: center; padding: 34px 16px 18px;
    background: linear-gradient(180deg, #2d49d8, #1a2f96); border: 4px solid var(--outline); border-radius: 26px;
    box-shadow: 0 8px 0 var(--outline), 0 0 0 5px var(--tc), 0 0 70px color-mix(in srgb, var(--tc) 75%, transparent); animation: tc-in .62s cubic-bezier(.2, 1.3, .35, 1) both, tc-glow 2.2s .7s ease-in-out infinite; }
  .ribbon { position: absolute; top: -20px; left: 50%; transform: translateX(-50%); white-space: nowrap; padding: 6px 18px 7px; font: 900 19px var(--disp); color: var(--outline); background: var(--gold);
    border: 3px solid var(--outline); border-radius: 999px; box-shadow: 0 4px 0 var(--outline); animation: tc-ribbon 1.4s .5s ease-in-out infinite; }
  .ic { width: 112px; height: 112px; overflow: visible; filter: drop-shadow(0 0 14px var(--tc)); animation: tc-ic .9s .3s cubic-bezier(.2, 1.4, .4, 1) both; }
  .ic path { fill: none; stroke-linecap: round; stroke-linejoin: round; }
  .ic .ol { stroke: var(--outline); stroke-width: 17; stroke-dasharray: 400; stroke-dashoffset: 400; animation: tc-draw .55s .45s ease-out forwards; }
  .ic .fl { stroke: var(--tc); stroke-width: 9; stroke-dasharray: 400; stroke-dashoffset: 400; animation: tc-draw .55s .45s ease-out forwards; }
  .ic .l2 { animation-delay: .6s; } .ic .l3 { animation-delay: .75s; }
  .ic .hd { fill: var(--tc); stroke: var(--outline); stroke-width: 5; opacity: 0; animation: tc-show .3s .8s ease-out forwards; }
  .ic .h2 { fill: color-mix(in srgb, var(--tc) 75%, #fff); }
  .ic .tip { stroke: var(--tc); stroke-width: 6; opacity: 0; animation: tc-show .3s .9s ease-out forwards; }
  /* название: цвет приёма, тёмная обводка, блик — мягкая пульсация яркости */
  .name { font: 900 30px/1.12 var(--disp); text-wrap: balance; color: #fff; -webkit-text-stroke: 2px var(--outline); paint-order: stroke fill; text-shadow: 0 4px 0 var(--outline), 0 0 18px var(--tc);
    animation: tc-pop .5s .35s var(--ease-out) both, tc-shine 1.8s 1s ease-in-out infinite; }
  .hint { font: 800 14px var(--txt); color: var(--dim); opacity: 0; transition: opacity .4s; }
  .hint.on { opacity: 1; }
  @keyframes tc-fade { from { opacity: 0; } }
  @keyframes tc-spin { to { transform: rotate(360deg); } }
  @keyframes tc-in { 0% { opacity: 0; transform: scale(.35) rotate(-9deg); } 100% { opacity: 1; transform: none; } }
  @keyframes tc-glow { 50% { box-shadow: 0 8px 0 var(--outline), 0 0 0 5px var(--tc), 0 0 110px var(--tc); } }
  @keyframes tc-ribbon { 50% { transform: translateX(-50%) scale(1.07) rotate(-2deg); } }
  @keyframes tc-ic { from { transform: scale(.2) rotate(-40deg); opacity: 0; } }
  @keyframes tc-draw { to { stroke-dashoffset: 0; } }
  @keyframes tc-pop { from { opacity: 0; transform: translateY(14px) scale(.8); } }
  @keyframes tc-shine { 50% { filter: brightness(1.35) saturate(1.1); } }
  @keyframes tc-show { to { opacity: 1; } }
  @keyframes tc-spark { 0% { opacity: 1; transform: rotate(var(--a)) translateX(0) rotate(45deg) scale(1.3); } 100% { opacity: .9; transform: rotate(var(--a)) translateX(var(--r)) rotate(45deg) scale(.7); } }
  @keyframes tc-twinkle { 0%, 100% { opacity: .9; } 50% { opacity: .25; } }
  @media (max-height: 560px) {
    .veil { padding: 6px; } .card { gap: 4px; padding: 26px 12px 10px; } .ic { width: 72px; height: 72px; } .name { font-size: 22px; } .ribbon { top: -16px; font-size: 16px; }
  }
  @media (prefers-reduced-motion: reduce) {
    .rays, .sparks { display: none; }
    .card, .ribbon, .ic, .name { animation: tc-fade .2s both; }
    .ic .ol, .ic .fl { animation: none; stroke-dashoffset: 0; } .ic .hd, .ic .tip { animation: none; opacity: 1; }
  }
</style>
