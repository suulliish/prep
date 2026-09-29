<script lang="ts">
  // Вычёркивание кратных: stage 1 — кратные a, 2 — кратные b, 3 — общие (золото), 4 — оставшиеся (зелёные).
  let { n = 30, a = 2, b = 5, stage = 0, broken = false }: { n?: number; a?: number; b?: number; stage?: number; broken?: boolean } = $props();
  const cls = (k: number) => {
    const A = stage >= 1 && k % a === 0, B = stage >= 2 && k % b === 0;
    if (stage >= 3 && k % a === 0 && k % b === 0) return 'both';
    if (A) return 'a'; if (B) return 'b';
    return stage >= 4 ? 'left' : '';
  };
</script>

<div class="st" class:broken>
  {#each Array(n) as _, i}
    <span class="c num {broken ? '' : cls(i + 1)}">{broken && (i + 1) % 4 === 0 ? '?' : i + 1}</span>
  {/each}
</div>
<div class="leg">
  {#if stage >= 1}<span class="a">÷{a}</span>{/if}{#if stage >= 2}<span class="b">÷{b}</span>{/if}{#if stage >= 3}<span class="both">екеуі де</span>{/if}{#if stage >= 4}<span class="left">қалды</span>{/if}
</div>

<style>
  .st { display: grid; grid-template-columns: repeat(10, minmax(0, 1fr)); gap: 4px; max-width: 420px; margin: 0 auto; padding: 6px 0; }
  .c { position: relative; aspect-ratio: 1; display: grid; place-items: center; font-size: clamp(13px, 3.6vw, 17px); background: var(--deep); border: 2px solid var(--line); border-radius: 6px; transition: all .35s; }
  .c.a, .c.b, .c.both { opacity: .75; }
  .c.a::after, .c.b::after, .c.both::after { content: ''; position: absolute; left: 12%; right: 12%; top: 50%; height: 2px; transform: rotate(-35deg); background: currentColor; }
  .c.a { color: var(--code); border-color: var(--code); }
  .c.b { color: var(--glitch); border-color: var(--glitch); }
  .c.both { color: var(--gold); border-color: var(--gold); background: #3a2a07; box-shadow: 0 0 10px #ffc94a77; opacity: 1; }
  .c.left { color: var(--ok); border-color: var(--ok); background: #0e3322; box-shadow: 0 0 8px #5ce39c55; }
  .leg { display: flex; gap: 8px; justify-content: center; flex-wrap: wrap; margin-top: 6px; font-weight: 800; font-size: 13px; }
  .leg span { padding: 2px 8px; border-radius: 4px; border: 2px solid currentColor; }
  .leg .a { color: var(--code); } .leg .b { color: var(--glitch); } .leg .both { color: var(--gold); } .leg .left { color: var(--ok); }
  .broken .c { color: var(--glitch); }
</style>
