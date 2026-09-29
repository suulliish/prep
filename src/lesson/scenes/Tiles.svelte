<script lang="ts">
  // Выражение из плиток: числа — голубые блоки, знаки — золотые шестерёнки, [..] — «процессор» (выполняется сейчас).
  // 3/4 и 2 3/4 — одна плитка с этажной дробью.
  import Frac from '../../ui/Frac.svelte';
  import { parseFrac } from '../../widgets/fracdraw';
  let { math, broken = false }: { math: string; broken?: boolean } = $props();
  type Tok = { t: string; kind: 'num' | 'frac' | 'op' | 'par' | 'sup' | 'txt' | 'sep'; hl: boolean };
  const toks = $derived.by(() => {
    const out: Tok[] = []; let hl = false;
    for (const m of math.matchAll(/ {2,}|\[|\]|(?<![\d/.,])(?:\d+ )?\d+\/\d+(?![\d/])|\d{1,3}(?: \d{3})+(?!\d)|\d+|[⁰¹²³⁴⁵⁶⁷⁸⁹ⁿ]+|[+−·:=≠<>]|[()]|✔|[^\s\[\]\d+−·:=()⁰-⁹ⁿ✔]+/g)) {
      const t = m[0];
      if (t === '[') { hl = true; continue; } if (t === ']') { hl = false; continue; }
      if (/^ {2,}$/.test(t)) { out.push({ t: '', kind: 'sep', hl: false }); continue; } // две формулы — две строки
      const kind = parseFrac(t) ? 'frac' : /^\d/.test(t) ? 'num' : /^[⁰¹²³⁴⁵⁶⁷⁸⁹ⁿ]/.test(t) ? 'sup' : /^[+−·:=≠<>]$/.test(t) ? 'op' : /^[()]$/.test(t) ? 'par' : 'txt';
      out.push({ t, kind, hl });
    }
    // группируем подряд идущие подсвеченные токены
    const groups: { hl: boolean; items: Tok[] }[] = [];
    for (const tk of out) { const last = groups.at(-1); if (last && last.hl === tk.hl && tk.hl) last.items.push(tk); else groups.push({ hl: tk.hl, items: [tk] }); }
    return groups;
  });
</script>

{#snippet tile(tk: Tok, lead: boolean, gi = 0)}
  {@const f = tk.kind === 'frac' ? parseFrac(tk.t) : null}
  <span class="tk {tk.kind}" style={lead ? `animation-delay:${gi * 40}ms` : undefined}>
    {#if f}<Frac whole={f.whole !== null && broken ? '▒' : f.whole} n={broken ? '▒' : f.n} d={broken ? '▒' : f.d} />{:else}{lead && broken && tk.kind === 'num' ? '▒' : tk.t}{/if}
  </span>
{/snippet}

<div class="tiles" class:broken>
  {#each toks as g, gi}
    {#if g.hl}
      <span class="proc" style="animation-delay:{gi * 40}ms"><small>⚙ ОРЫНДАЛАДЫ</small>{#each g.items as tk}{@render tile(tk, false)}{/each}</span>
    {:else}
      {#each g.items as tk}{@render tile(tk, true, gi)}{/each}
    {/if}
  {/each}
</div>

<style>
  .tiles { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 6px; padding: 14px 4px; min-height: 90px; }
  .tk { display: inline-grid; place-items: center; font: 800 clamp(20px, 5.4vw, 30px) var(--txt); animation: pop-in .35s var(--ease-out) both; }
  .tk.num { min-width: 44px; height: 50px; padding: 0 10px; background: linear-gradient(#1d6d82, #0d3f4d); border: 2px solid var(--code); border-bottom-width: 5px; border-radius: 8px; color: #e9feff; box-shadow: 0 0 12px #3ff0ff33; }
  .tk.frac { min-width: 44px; padding: 2px 10px; background: linear-gradient(#1d6d82, #0d3f4d); border: 2px solid var(--code); border-bottom-width: 5px; border-radius: 8px; color: #e9feff; box-shadow: 0 0 12px #3ff0ff33; }
  .tk.op { width: 38px; height: 38px; border-radius: 50%; background: radial-gradient(circle, #3a2a07 45%, var(--gold-deep)); border: 2px dashed var(--gold); color: var(--gold); }
  .tk.par { color: var(--crystal); font-size: clamp(28px, 7vw, 40px); }
  .tk.sup { align-self: flex-start; font-size: 22px; color: var(--gold); margin-left: -4px; }
  .tk.sep { flex-basis: 100%; height: 0; }
  .tk.txt { font-size: clamp(15px, 4vw, 19px); color: var(--dim); padding: 0 2px; }
  .proc { position: relative; display: inline-flex; align-items: center; gap: 6px; padding: 16px 10px 8px; border: 2px solid var(--gold); border-radius: 10px; background: #ffc94a14; box-shadow: 0 0 20px #ffc94a44; animation: pop-in .4s var(--ease-out) both, pulse-glow 1.6s infinite; }
  .proc small { position: absolute; top: -9px; left: 8px; white-space: nowrap; font: 800 10px var(--txt); letter-spacing: .08em; color: var(--void); background: var(--gold); padding: 1px 6px; border-radius: 3px; }
  .proc .tk.frac { border-color: var(--gold); background: linear-gradient(#6b4a0a, #3a2a07); }
  .proc .tk.num { border-color: var(--gold); background: linear-gradient(#6b4a0a, #3a2a07); }
  .broken .tk.frac { border-color: var(--glitch); color: var(--glitch); background: #3a0f2c; animation: pop-in .35s both, jit .5s steps(2) infinite; }
  .broken .tk.num { border-color: var(--glitch); color: var(--glitch); background: #3a0f2c; animation: pop-in .35s both, jit .5s steps(2) infinite; }
  @keyframes jit { 50% { transform: translate(2px, -1px); } }
</style>
