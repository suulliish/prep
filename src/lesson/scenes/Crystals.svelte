<script lang="ts">
  // Деление с остатком на кристаллах: 0 — куча, 1 — полные группы по d, 2 — светится остаток.
  let { n = 17, d = 5, stage = 0 }: { n?: number; d?: number; stage?: number } = $props();
  const q = $derived(Math.floor(n / d)), r = $derived(n % d);
  const jitter = (i: number) => ((i * 37) % 11) - 5;
</script>

<div class="cr">
  {#if stage === 0}
    <div class="pile">
      {#each Array(n) as _, i}<i class="gem" style="transform: rotate({jitter(i) * 3}deg) translateY({jitter(i + 3)}px); animation-delay:{i * 15}ms"></i>{/each}
    </div>
    <p class="cap num">{n} кристал</p>
  {:else}
    <div class="groups">
      {#each Array(q) as _, g}
        <div class="grp" style="animation-delay:{g * 70}ms">
          <div class="gems">{#each Array(d) as _}<i class="gem"></i>{/each}</div>
          <span class="num">{g + 1}</span>
        </div>
      {/each}
      {#if r}
        <div class="grp rest" class:on={stage >= 2}>
          <div class="gems">{#each Array(r) as _}<i class="gem"></i>{/each}</div>
          <span>{stage >= 2 ? 'қалдық' : '?'}</span>
        </div>
      {/if}
    </div>
    <p class="cap num">{q} топ × {d}{stage >= 2 ? ` + ${r} қалдық` : ''}</p>
  {/if}
</div>

<style>
  .cr { display: grid; gap: 10px; justify-items: center; padding: 8px 0; }
  .pile { display: flex; flex-wrap: wrap; justify-content: center; gap: 4px; max-width: 360px; }
  .gem { display: block; width: 14px; height: 18px; background: linear-gradient(135deg, #e6ccff, var(--crystal) 50%, #6b3fd1); clip-path: polygon(50% 0, 100% 35%, 50% 100%, 0 35%); filter: drop-shadow(0 0 4px #b58cff); animation: pop-in .35s var(--ease-out) both; }
  .groups { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; }
  .grp { display: grid; justify-items: center; gap: 4px; padding: 6px 8px; border: 2px solid var(--code-deep); background: #0b2a3a; border-radius: 6px; animation: pop-in .35s var(--ease-out) both; }
  .grp span { font: 800 11px var(--txt); color: var(--code); }
  .gems { display: grid; grid-template-columns: repeat(3, 14px); gap: 3px; }
  .grp.rest { border-style: dashed; border-color: var(--line-hi); background: none; }
  .grp.rest.on { border-color: var(--gold); background: #ffc94a14; box-shadow: 0 0 16px #ffc94a55; }
  .grp.rest.on span { color: var(--gold); }
  .grp.rest.on .gem { background: linear-gradient(135deg, #fff2c4, var(--gold)); filter: drop-shadow(0 0 5px var(--gold)); animation: bounce 1s infinite; }
  .cap { font-weight: 800; color: var(--dim); }
  @keyframes bounce { 50% { transform: translateY(-3px); } }
</style>
