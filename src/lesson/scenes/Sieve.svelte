<script lang="ts">
  // Решето Эратосфена: step 0 — вычеркнута 1; step k — просеяны первые k простых (2, 3, 5, 7).
  let { n = 30, step = 0, broken = false }: { n?: number; step?: number; broken?: boolean } = $props();
  const PR = [2, 3, 5, 7];
  const sieved = $derived(PR.slice(0, step));
  const cur = $derived(step > 0 && step <= PR.length ? PR[step - 1] : 0);
  const state = (k: number) => {
    if (k === 1) return 'out';
    if (sieved.includes(k)) return 'prime';
    if (sieved.some(p => k % p === 0)) return k % cur === 0 && cur ? 'hit' : 'out';
    return step >= PR.length ? 'prime' : 'wait';
  };
</script>

<div class="sv" class:broken>
  {#each Array(n) as _, i}
    {@const k = i + 1}
    <span class="c num {broken ? 'wait' : state(k)}" class:cur={k === cur}>{broken ? (k % 3 ? '?' : k) : k}</span>
  {/each}
</div>

<style>
  .sv { display: grid; grid-template-columns: repeat(10, minmax(0, 1fr)); gap: 4px; max-width: 420px; margin: 0 auto; padding: 6px 0; }
  .c { position: relative; aspect-ratio: 1; display: grid; place-items: center; font-size: clamp(13px, 3.6vw, 17px); background: var(--deep); border: 2px solid var(--line); border-radius: 6px; transition: all .35s; }
  .c.out { opacity: .3; }
  .c.out::after, .c.hit::after { content: ''; position: absolute; left: 12%; right: 12%; top: 50%; height: 2px; background: var(--glitch); transform: rotate(-35deg); }
  .c.hit { border-color: var(--glitch); background: #3a0f2c; animation: pop-in .35s var(--ease-out); }
  .c.prime { border-color: var(--code); color: var(--code); background: #0b2a3a; box-shadow: 0 0 10px #3ff0ff44; }
  .c.cur { border-color: var(--gold); color: var(--gold); box-shadow: 0 0 14px var(--gold); transform: scale(1.12); z-index: 2; }
  .broken .c { color: var(--glitch); border-color: #7a2a63; }
</style>
