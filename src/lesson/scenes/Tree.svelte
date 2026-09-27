<script lang="ts">
  // Дерево множителей: на каждом уровне отщепляем наименьший простой делитель (золотой лист).
  let { n = 60, depth = 0, broken = false }: { n?: number; depth?: number; broken?: boolean } = $props();
  const chain = $derived.by(() => {
    const out: { p: number; rest: number }[] = []; let m = n;
    while (m > 1) { let p = 2; while (m % p) p++; if (p === m) break; out.push({ p, rest: m / p }); m /= p; }
    return out;
  });
  const isPrime = (x: number) => { if (x < 2) return false; for (let d = 2; d * d <= x; d++) if (x % d === 0) return false; return true; };
</script>

<div class="tr" class:broken>
  <span class="node root num">{broken ? '?' : n}</span>
  {#each chain.slice(0, depth) as lv, k (k)}
    <div class="lv" style="margin-left:{k * 30}px">
      <span class="br"></span>
      <span class="leaf num">{lv.p}</span>
      <span class="node num" class:pr={isPrime(lv.rest)}>{lv.rest}</span>
    </div>
  {/each}
</div>

<style>
  .tr { display: grid; justify-items: start; gap: 6px; width: fit-content; margin: 0 auto; padding: 8px 0; }
  .lv { display: flex; align-items: center; gap: 8px; animation: pop-in .4s var(--ease-out) both; }
  .br { width: 18px; height: 22px; border-left: 2px solid var(--line-hi); border-bottom: 2px solid var(--line-hi); margin-top: -18px; }
  .node, .leaf { min-width: 46px; height: 42px; padding: 0 8px; display: grid; place-items: center; font-size: 22px; border-radius: 10px; }
  .node { background: linear-gradient(#1d6d82, #0d3f4d); border: 2px solid var(--code); }
  .node.root { font-size: 26px; }
  .node.pr, .leaf { background: radial-gradient(circle at 35% 30%, #fff2c4, var(--gold) 55%, #b8860b); color: #3a2a07; border: 2px solid #fff2c4; border-radius: 50%; min-width: 42px; box-shadow: 0 0 12px #ffc94a88; }
  .broken .root { border-color: var(--glitch); color: var(--glitch); background: #3a0f2c; animation: pulse-glow 1.2s infinite; }
</style>
