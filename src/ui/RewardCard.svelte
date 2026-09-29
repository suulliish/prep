<script lang="ts">
  // Большая плашка награды (src/lib/reward.svelte.ts): сколько минут заработано, за что, и одна кнопка «Қабылдау».
  import { rewardUI, acceptReward } from '../lib/reward.svelte';
  import Icon from './Icon.svelte';
  import { sparksAt } from './fx.svelte';
  let btn = $state<HTMLButtonElement>();
  $effect(() => { if (rewardUI.cur) { requestAnimationFrame(() => { btn?.focus(); sparksAt(innerWidth / 2, innerHeight * 0.38, ['#ffc94a', '#3ff0ff', '#ff4fb8'], 70, 10); }); } });
  const onKey = (e: KeyboardEvent) => { if (rewardUI.cur && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); e.stopPropagation(); acceptReward(); } };
</script>

<svelte:window onkeydown={onKey} />
{#if rewardUI.cur}
  {@const r = rewardUI.cur}
  <div class="veil" role="dialog" aria-modal="true" aria-label={r.title}>
    <div class="card">
      <h2>{r.title}</h2>
      <div class="amount"><Icon name="clock" fill="var(--gold)" size={54} /><b class="num">+{r.minutes}</b><span>мин ойын</span></div>
      {#if r.why}<p class="why">{r.why}</p>{/if}
      {#if r.today !== undefined}<p class="tot">Бүгін жиналды: <b class="num">{r.today}</b> мин{#if r.weekend}{' '}· демалысқа: <b class="num">{r.weekend}</b> мин{/if}</p>{/if}
      <button bind:this={btn} class="btn primary big" onclick={acceptReward}><Icon name="check" fill="var(--outline)" size={22} />Қабылдау</button>
    </div>
  </div>
{/if}

<style>
  .veil { position: fixed; inset: 0; z-index: calc(var(--z-modal) + 10); display: grid; place-items: center; padding: 18px;
    background: #05061acc; backdrop-filter: blur(3px); animation: fade .25s ease-out both; }
  .card { width: min(420px, 100%); display: grid; gap: 14px; justify-items: center; text-align: center; padding: 22px 18px 20px;
    background: linear-gradient(180deg, #2d49d8, #1a2f96); border: 4px solid var(--outline); border-radius: 26px; box-shadow: 0 8px 0 var(--outline), 0 0 60px #ffc94a55;
    animation: pop-in .42s var(--ease-out) both; }
  h2 { font: 900 30px var(--disp); color: var(--gold); -webkit-text-stroke: 2px var(--outline); paint-order: stroke fill; text-shadow: 0 4px 0 var(--outline); }
  .amount { display: grid; justify-items: center; gap: 2px; padding: 12px 26px; border-radius: 22px; background: var(--deep); border: 3px solid var(--outline); }
  .amount b { font: 900 76px/1 var(--disp); color: var(--gold); text-shadow: 0 4px 0 var(--outline); }
  .amount span { font: 800 20px var(--disp); color: var(--ink); }
  .why { font: 700 17px/1.35 var(--txt); color: var(--ink); max-width: 30ch; }
  .tot { font: 700 15px var(--txt); color: var(--dim); }
  .tot b { color: var(--ink); }
  .btn { width: 100%; }
  @keyframes fade { from { opacity: 0; } }
</style>
