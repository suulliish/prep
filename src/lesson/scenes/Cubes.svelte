<script lang="ts">
  // Степени из кубиков: count — n кубиков рядами; square — a×a; cube — a слоёв a×a; sqcube — квадрат и куб рядом.
  let { mode = 'cube', a = 3, n = 8, label = '', broken = false }: { mode?: 'count' | 'square' | 'cube' | 'sqcube'; a?: number; n?: number; label?: string; broken?: boolean } = $props();
</script>

{#snippet layer(rows: number, cols: number, l: number, delay: number)}
  <div class="layer" style="transform: translate({l * 9}px, {-l * 9}px); z-index:{20 - l}; animation-delay:{delay}ms">
    {#each Array(rows) as _}<div class="r">{#each Array(cols) as _}<i class="c"></i>{/each}</div>{/each}
  </div>
{/snippet}

<div class="cubes" class:broken>
  {#if mode === 'count'}
    <div class="grid" style="--cols:{Math.min(8, n)}">{#each Array(n) as _, i}<i class="c" style="animation-delay:{i * 20}ms"></i>{/each}</div>
  {:else if mode === 'square'}
    <div class="stack">{@render layer(a, a, 0, 0)}</div>
  {:else if mode === 'cube'}
    <div class="stack" style="--a:{a}">{#each Array(a) as _, l}{@render layer(a, a, l, l * 150)}{/each}</div>
  {:else}
    <div class="pair">
      <figure><div class="stack">{@render layer(a, a, 0, 0)}</div><figcaption class="num">{a}² = {a * a}</figcaption></figure>
      <figure><div class="stack" style="--a:{a}">{#each Array(a) as _, l}{@render layer(a, a, l, l * 150)}{/each}</div><figcaption class="num">{a}³ = {a ** 3}</figcaption></figure>
    </div>
  {/if}
  {#if label}<p class="label num">{label}</p>{/if}
  {#if broken}<b class="q">?</b>{/if}
</div>

<style>
  .cubes { position: relative; display: grid; justify-items: center; gap: 12px; padding: 16px 0 8px; }
  .grid { display: grid; grid-template-columns: repeat(var(--cols), 20px); gap: 4px; }
  .c { display: block; width: 20px; height: 20px; background: linear-gradient(135deg, #b9fdff, var(--code) 45%, #1592a6); border: 1px solid #0d5f6c; box-shadow: 3px -3px 0 #0d5f6c; animation: pop-in .3s var(--ease-out) both; }
  .stack { position: relative; padding: calc(var(--a, 1) * 9px) calc(var(--a, 1) * 9px) 0 0; display: grid; }
  .layer { grid-area: 1 / 1; display: grid; gap: 2px; animation: drop .45s var(--ease-out) both; }
  .r { display: flex; gap: 2px; }
  .pair { display: flex; gap: 28px; align-items: flex-end; }
  figure { margin: 0; display: grid; justify-items: center; gap: 8px; }
  figcaption, .label { font-weight: 800; font-size: 20px; color: var(--gold); }
  .broken .c { background: linear-gradient(135deg, #ffb3df, var(--glitch) 45%, #7a1a58); border-color: #7a1a58; box-shadow: 3px -3px 0 #7a1a58; }
  .q { position: absolute; top: 40%; font: 400 56px var(--px); color: var(--ink); text-shadow: 0 0 16px var(--glitch); animation: pulse-glow 1.2s infinite; }
  @keyframes drop { from { transform: translateY(-40px); opacity: 0; } }
</style>
