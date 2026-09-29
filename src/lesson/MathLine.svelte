<script lang="ts">
  // Крупная строка выкладки: [..] — подсвеченная часть, ▢ — пропуск (заполняется значением fill),
  // 3/4 и 2 3/4 — этажные дроби (Frac).
  import Frac from '../ui/Frac.svelte';
  import { splitFractions } from '../widgets/fracdraw';
  let { text, fill = null, big = false }: { text: string; fill?: string | null; big?: boolean } = $props();
  const parts = $derived(text.split(/(\[[^\]]+\]|▢)/).filter(Boolean));
</script>

{#snippet seg(s: string)}
  {#each splitFractions(s) as x}
    {#if x.t === 'frac'}<Frac whole={x.whole} n={x.n} d={x.d} />{:else}{x.s}{/if}
  {/each}
{/snippet}

<span class="ml num" class:big>
  {#each parts as p}
    {#if p === '▢'}<b class="blank" class:filled={fill !== null}>{fill ?? '?'}</b>
    {:else if p.startsWith('[')}<b class="hl">{@render seg(p.slice(1, -1))}</b>
    {:else}{@render seg(p)}{/if}
  {/each}
</span>

<style>
  .ml { font-size: 22px; font-weight: 800; letter-spacing: .02em; white-space: pre-wrap; }
  .ml.big { font-size: 28px; }
  .hl { color: var(--gold); background: #ffc94a1f; border-bottom: 3px solid var(--gold); padding: 0 4px; border-radius: 4px; animation: pop-in .35s var(--ease-out); }
  .blank { display: inline-block; min-width: 1.6em; text-align: center; color: var(--glitch); background: #ff4fb81a; border: 2px dashed var(--glitch); border-radius: 6px; padding: 0 6px; animation: broken 1.4s infinite; }
  .blank.filled { color: var(--code); border-color: var(--code); }
  @keyframes broken { 0%, 100% { box-shadow: 0 0 0 #ff4fb800; } 50% { box-shadow: 0 0 12px #ff4fb888; } }
  .blank.filled { border-style: solid; background: #3ff0ff1f; animation: pop-in .35s var(--ease-out); }
</style>
