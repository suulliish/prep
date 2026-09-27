<script lang="ts">
  // Лестница квадратов/кубов до n: stage 1 — последний подходящий (золото), 2 — следующий уже больше n (зачёркнут).
  let { n = 100, p = 2, stage = 0, broken = false }: { n?: number; p?: number; stage?: number; broken?: boolean } = $props();
  const list = $derived.by(() => { const out: number[] = []; for (let k = 1; k ** p <= n; k++) out.push(k); return out; });
  const sup = (x: number) => (x === 2 ? '²' : '³');
</script>

<div class="ld" class:broken>
  {#each list as k, i}
    <span class="s num" class:last={stage >= 1 && i === list.length - 1} style="animation-delay:{i * 50}ms">{k}{sup(p)}<small>{broken ? '?' : k ** p}</small></span>
  {/each}
  {#if stage >= 2}<span class="s num over">{list.length + 1}{sup(p)}<small>{(list.length + 1) ** p} &gt; {n}</small></span>{/if}
</div>
<p class="lim num">шек: {n}</p>

<style>
  .ld { display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; padding: 10px 0 4px; }
  .s { display: grid; justify-items: center; min-width: 48px; padding: 6px 8px; font-size: 18px; background: var(--deep); border: 2px solid var(--code-deep); border-radius: 8px; color: var(--code); animation: pop-in .3s var(--ease-out) both; }
  .s small { font-size: 14px; color: var(--ink); }
  .s.last { border-color: var(--gold); color: var(--gold); box-shadow: 0 0 14px #ffc94a77; }
  .s.over { border-color: var(--miss); color: var(--miss); text-decoration: line-through; opacity: .85; }
  .lim { text-align: center; color: var(--dim); font-weight: 800; }
  .broken .s small { color: var(--glitch); }
</style>
