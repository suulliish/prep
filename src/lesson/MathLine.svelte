<script lang="ts">
  // Крупная строка выкладки: [..] — подсвеченная часть, ▢ — пропуск (заполняется значением fill).
  let { text, fill = null, big = false }: { text: string; fill?: string | null; big?: boolean } = $props();
  const parts = $derived(text.split(/(\[[^\]]+\]|▢)/).filter(Boolean));
</script>

<span class="ml num" class:big>
  {#each parts as p}
    {#if p === '▢'}<b class="blank" class:filled={fill !== null}>{fill ?? '?'}</b>
    {:else if p.startsWith('[')}<b class="hl">{p.slice(1, -1)}</b>
    {:else}{p}{/if}
  {/each}
</span>

<style>
  .ml { font-size: 22px; font-weight: 800; letter-spacing: .02em; white-space: pre-wrap; }
  .ml.big { font-size: 28px; }
  .hl { color: var(--gold); background: #ffc94a1f; border-bottom: 3px solid var(--gold); padding: 0 4px; border-radius: 4px; animation: pop-in .35s var(--ease-out); }
  .blank { display: inline-block; min-width: 1.6em; text-align: center; color: var(--code); border: 2px dashed var(--code); border-radius: 6px; padding: 0 6px; }
  .blank.filled { border-style: solid; background: #3ff0ff1f; animation: pop-in .35s var(--ease-out); }
</style>
