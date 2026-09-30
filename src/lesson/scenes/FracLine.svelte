<script lang="ts">
  // Полоска ложится на числовую прямую (одна и та же дробь на полоске и на прямой). Ориентиры 0, 1/2, 1.
  // stage: 0 прямая, 1 полоска n/d над ней, 2 полоска легла на прямую, 3 точка n/d с подписью. points — ещё точки (видны с stage 3).
  // zones — цветные зоны «ближе к 0 / к 1/2 / к 1». broken — Глитч: подписи «?».
  import Frac from '../../ui/Frac.svelte';
  import { val, type Fr } from '../../widgets/fracdraw';
  let { n, d, points = [], stage = 3, zones = false, broken = false }: { n?: number; d?: number; points?: Fr[]; stage?: number; zones?: boolean; broken?: boolean } = $props();
  const W = 340, H = 140, X0 = 20, X1 = 320, AX = 84;
  const has = $derived(n !== undefined && d !== undefined);
  const xOf = (v: number) => X0 + v * (X1 - X0);
  const pct = (x: number, y: number) => `left:${(x / W) * 100}%;top:${(y / H) * 100}%`;
  const all = $derived<(Fr & { hi?: boolean })[]>([...(has ? [{ n: n!, d: d!, hi: true }] : []), ...points]);
  const ZN = [
    { a: 0, b: 0.25, c: 'var(--code)', t: '0-ге жақын' },
    { a: 0.25, b: 0.75, c: 'var(--gold)', t: 'жартыға жақын' },
    { a: 0.75, b: 1, c: 'var(--ok)', t: '1-ге жақын' },
  ];
</script>

<div class="box" class:broken>
  <svg viewBox="0 0 {W} {H}" role="img" aria-label="Сан сызығы">
    {#if zones}
      {#each ZN as z}<rect x={xOf(z.a)} y={AX + 32} width={xOf(z.b) - xOf(z.a)} height="20" fill={z.c} opacity=".22" /><text x={(xOf(z.a) + xOf(z.b)) / 2} y={AX + 46} class="zt" fill={z.c}>{z.t}</text>{/each}
    {/if}
    <line x1={X0 - 8} x2={X1 + 8} y1={AX} y2={AX} class="axis" />
    {#each [0, 0.5, 1] as v}<line x1={xOf(v)} x2={xOf(v)} y1={AX - 9} y2={AX + 9} class="tk" />{/each}

    {#if has && stage >= 1}
      {@const dd = d!}
      <g class="strip" style="transform:translateY({stage >= 2 ? 49 : 0}px)">
        {#each Array(dd) as _, i}
          <rect x={xOf(i / dd)} y="6" width={(X1 - X0) / dd} height="26" class="cell" class:on={i < n!} class:off={stage >= 2 && i >= n!} />
        {/each}
        <rect x={X0} y="6" width={X1 - X0} height="26" class="frame" />
      </g>
    {/if}

    {#if stage >= 3}
      {#each all as p, k}<line x1={xOf(val(p))} x2={xOf(val(p))} y1={k % 2 ? 24 : 52} y2={AX} class="stem" /><circle cx={xOf(val(p))} cy={AX} r={p.hi ? 7 : 6} class="dot" class:hi={p.hi} />{/each}
    {/if}
  </svg>
  <div class="lb" aria-hidden="true">
    <span style={pct(xOf(0), AX + 14)}>0</span>
    <span style={pct(xOf(0.5), AX + 14)}><Frac n={1} d={2} size={15} /></span>
    <span style={pct(xOf(1), AX + 14)}>1</span>
    {#if stage >= 3}
      {#each all as p, k}
        <span class="p" class:hi={p.hi} style={pct(xOf(val(p)), k % 2 ? 24 : 52)}>{#if broken}<b class="q num">?</b>{:else}<Frac n={p.n} d={p.d} size={16} />{/if}</span>
      {/each}
    {/if}
  </div>
</div>

<style>
  .box { position: relative; width: 100%; max-width: 420px; margin: 0 auto; aspect-ratio: 340 / 140; color: var(--ink); }
  svg { position: absolute; inset: 0; width: 100%; height: 100%; }
  .axis { stroke: var(--ink); stroke-width: 4; stroke-linecap: round; }
  .tk { stroke: var(--ink); stroke-width: 3; }
  .cell { fill: #ffeec2; stroke: var(--outline); stroke-width: 2; transition: opacity .5s; }
  .cell.on { fill: var(--code); }
  .cell.off { opacity: 0; }
  .frame { fill: none; stroke: var(--outline); stroke-width: 3; }
  .strip { transition: transform .8s var(--ease-out); }
  .stem { stroke: var(--dim); stroke-width: 1.5; stroke-dasharray: 3 3; }
  .dot { fill: var(--dim); stroke: var(--outline); stroke-width: 2.5; }
  .dot.hi { fill: var(--gold); }
  .zt { font: 800 9px var(--txt); text-anchor: middle; }
  .lb span { position: absolute; transform: translate(-50%, -50%); font: 800 15px var(--txt); white-space: nowrap; }
  .lb .p { transform: translate(-50%, -100%); color: var(--dim); background: #0b1030cc; border-radius: 6px; padding: 0 3px; }
  .lb .p.hi { color: var(--gold); }
  .q { color: var(--glitch); font-size: 18px; }
  .broken .dot { fill: var(--glitch); }
  .broken .cell.on { fill: var(--glitch); }
</style>
