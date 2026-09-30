<script lang="ts">
  // Дерево множителей: на каждом уровне отщепляем наименьший простой делитель (золотой лист).
  // live/prev (Scene.svelte): в кадре «Көр» растёт только новая ветка: линия тянется, золотой лист падает (со звуком).
  import { onMount } from 'svelte';
  import { audio } from '../../lib/audio';
  let { n = 60, depth = 0, broken = false, live = false, prev = null }: { n?: number; depth?: number; broken?: boolean; live?: boolean; prev?: { n?: number; depth?: number } | null } = $props();
  const from = $derived(!live ? 0 : prev && prev.n === n && (prev.depth ?? 0) <= depth ? prev.depth ?? 0 : 0);   // уровни с номера from — новые
  onMount(() => {
    if (!live || depth <= from) return;
    const t = window.setTimeout(() => audio.play('crystal', { rate: 1.25 }), 320);
    return () => clearTimeout(t);
  });
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
    <div class="lv" class:grow={k >= from} style="margin-left:{k * 30}px;--dl:{(k - from) * 260}ms">
      <span class="br"></span>
      <span class="leaf num">{lv.p}</span>
      <span class="node num" class:pr={isPrime(lv.rest)}>{lv.rest}</span>
    </div>
  {/each}
</div>

<style>
  .tr { display: grid; justify-items: start; gap: 6px; width: fit-content; margin: 0 auto; padding: 8px 0; }
  .lv { display: flex; align-items: center; gap: 8px; }
  .lv.grow { animation: pop-in .4s var(--ease-out) both; animation-delay: var(--dl); }
  .lv.grow .br { transform-origin: 0 0; animation: br-grow .35s var(--ease-out) both; animation-delay: var(--dl); }
  .lv.grow .leaf { animation: leaf-drop .55s var(--ease-out) both; animation-delay: calc(var(--dl) + .25s); }
  .lv.grow .node { animation: pop-in .4s var(--ease-out) both; animation-delay: calc(var(--dl) + .4s); }
  @keyframes br-grow { from { transform: scale(0.1, 0); } }
  @keyframes leaf-drop { 0% { transform: translateY(-22px) scale(.3); opacity: 0; } 65% { transform: translateY(2px) scale(1.12); opacity: 1; } 100% { transform: none; } }
  .br { width: 18px; height: 22px; border-left: 2px solid var(--line-hi); border-bottom: 2px solid var(--line-hi); margin-top: -18px; }
  .node, .leaf { min-width: 46px; height: 42px; padding: 0 8px; display: grid; place-items: center; font-size: 22px; border-radius: 10px; }
  .node { background: linear-gradient(#1d6d82, #0d3f4d); border: 2px solid var(--code); }
  .node.root { font-size: 26px; }
  .node.pr, .leaf { background: radial-gradient(circle at 35% 30%, #fff2c4, var(--gold) 55%, #b8860b); color: #3a2a07; border: 2px solid #fff2c4; border-radius: 50%; min-width: 42px; box-shadow: 0 0 12px #ffc94a88; }
  .broken .root { border-color: var(--glitch); color: var(--glitch); background: #3a0f2c; animation: pulse-glow 1.2s infinite; }
</style>
