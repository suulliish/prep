<script lang="ts">
  // Ряды кратных двух чисел до upto; meet — подсветить первое общее кратное (НОК).
  let { a = 6, b = 8, upto = 24, meet = false, broken = false }: { a?: number; b?: number; upto?: number; meet?: boolean; broken?: boolean } = $props();
  const gcd = (x: number, y: number): number => (y ? gcd(y, x % y) : x);
  const l = $derived((a * b) / gcd(a, b));
  const row = (k: number) => Array.from({ length: Math.max(1, Math.floor(upto / k)) }, (_, i) => (i + 1) * k).filter(x => x <= upto);
</script>

<div class="ml" class:broken>
  {#each [a, b] as k, r}
    <div class="track">
      <b class="num lbl">{k}:</b>
      <div class="cells">
        {#if broken}{#each Array(4) as _}<span class="c num">?</span>{/each}
        {:else}{#each row(k) as x, i}<span class="c num" class:hit={meet && x === l} style="animation-delay:{i * 60 + r * 40}ms">{x}</span>{/each}{/if}
      </div>
    </div>
  {/each}
  {#if meet && !broken && l <= upto}<p class="res num">Бірге: {l}!</p>{/if}
</div>

<style>
  .ml { display: grid; gap: 10px; padding: 10px 4px; }
  .track { display: flex; align-items: center; gap: 8px; }
  .lbl { width: 36px; text-align: right; font-size: 20px; color: var(--dim); }
  .cells { flex: 1; display: flex; flex-wrap: wrap; gap: 5px; }
  .c { min-width: 38px; height: 38px; padding: 0 6px; display: grid; place-items: center; font-size: 18px; background: var(--deep); border: 2px solid var(--line-hi); border-radius: 8px; animation: pop-in .3s var(--ease-out) both; }
  .c.hit { border-color: var(--gold); color: var(--void); background: var(--gold); box-shadow: 0 0 16px var(--gold); transform: scale(1.12); }
  .res { justify-self: center; font-size: 22px; font-weight: 800; color: var(--gold); }
  .broken .c { color: var(--glitch); border-color: #7a2a63; }
</style>
