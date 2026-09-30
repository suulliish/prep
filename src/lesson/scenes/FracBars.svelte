<script lang="ts">
  // Дробные полоски (или пиццы, round) как сцена «Көр». rows: [{n, d, eat?}] — n закрашенных частей из d; eat — сколько частей следом «съедено».
  // stage: 0 целое, 1 порезано на d равных частей, 2 закрашено n, 3 + подпись-дробь. guide — линии конца закраски через все строки (равны или нет).
  // broken — Глитч: части разные по величине, подписи «?».
  import Frac from '../../ui/Frac.svelte';
  import { sectorPath, polar } from '../../widgets/fracdraw';
  type Row = { n: number; d: number; eat?: number };
  let { rows = [{ n: 3, d: 4 }], stage = 3, broken = false, round = false, guide = false }: { rows?: Row[]; stage?: number; broken?: boolean; round?: boolean; guide?: boolean } = $props();
  const COL = ['var(--code)', 'var(--gold)', 'var(--glitch)'];
  const W = 300, H = 44;
  // границы частей: ровные i/d или (broken) неровные, но по порядку
  const cut = (i: number, d: number) => (i <= 0 ? 0 : i >= d ? 1 : Math.min(1, Math.max(0, i / d + (broken ? 1 : 0) * (((i * 5) % 7) - 3) * 0.3 / d)));
  const ends = $derived(guide && stage >= 2 ? rows.map((r, k) => ({ v: cut(r.n, r.d), c: COL[Math.min(k, 2)] })).filter((e, k, a) => a.findIndex(x => Math.abs(x.v - e.v) < 1e-9) === k) : []);
  const kind = (r: Row, i: number) => (stage >= 2 && i < r.n ? 'on' : stage >= 2 && i < r.n + (r.eat ?? 0) ? 'eat' : '');
</script>

{#if round}
  <div class="pz" class:broken>
    {#each rows as r, k}
      <figure>
        <svg viewBox="0 0 120 120" role="img" aria-label="{r.n}/{r.d}">
          <circle cx="60" cy="60" r="56" class="crust" />
          {#each Array(stage >= 1 ? r.d : 1) as _, i}
            {@const a0 = cut(i, stage >= 1 ? r.d : 1) * Math.PI * 2}
            {@const a1 = cut(i + 1, stage >= 1 ? r.d : 1) * Math.PI * 2}
            {@const [mx, my] = polar(60, 60, 34, (a0 + a1) / 2)}
            <path d={sectorPath(60, 60, 50, a0, a1)} class="sl {kind(r, i)}" style="--c:{COL[Math.min(k, 2)]}" />
            {#if kind(r, i) === 'eat'}<path d="M{mx - 6} {my - 6}l12 12m0 -12l-12 12" class="x" />{/if}
          {/each}
        </svg>
        {#if stage >= 3}<figcaption>{#if broken}<b class="q num">?</b>{:else}<Frac n={r.n} d={r.d} size={22} color={COL[Math.min(k, 2)]} />{/if}</figcaption>{/if}
      </figure>
    {/each}
  </div>
{:else}
  <div class="bars" class:broken>
    {#each rows as r, k}
      <div class="lab">{#if stage >= 3}{#if broken}<b class="q num">?</b>{:else}<Frac n={r.n} d={r.d} size={r.d > 30 ? 20 : 24} color={COL[Math.min(k, 2)]} />{/if}{/if}</div>
      <svg viewBox="0 0 {W} {H}" class="strip" role="img" aria-label="{r.n}/{r.d}">
        <rect x="2" y="4" width={W - 4} height={H - 8} rx="7" class="bg" />
        {#each Array(stage >= 1 ? r.d : 1) as _, i}
          {@const d = stage >= 1 ? r.d : 1}
          {@const x0 = 2 + (W - 4) * cut(i, d)}
          {@const x1 = 2 + (W - 4) * cut(i + 1, d)}
          <rect x={x0} y="4" width={x1 - x0} height={H - 8} class="cell {kind(r, i)}" style="--c:{COL[Math.min(k, 2)]}" />
          {#if kind(r, i) === 'eat' && x1 - x0 > 8}<path d="M{(x0 + x1) / 2 - 4} {H / 2 - 4}l8 8m0 -8l-8 8" class="x" />{/if}
          {#if i > 0}<line x1={x0} x2={x0} y1="4" y2={H - 4} class="ln" style:opacity={r.d > 30 ? 0.35 : 1} />{/if}
        {/each}
        <rect x="2" y="4" width={W - 4} height={H - 8} rx="7" class="frame" />
      </svg>
    {/each}
    {#if ends.length}
      <div class="gd" aria-hidden="true">{#each ends as e}<i style="left:{((2 + (W - 4) * e.v) / W) * 100}%;border-color:{e.c}"></i>{/each}</div>
    {/if}
  </div>
{/if}

<style>
  .bars { position: relative; display: grid; grid-template-columns: 62px 1fr; align-items: center; gap: 8px 8px; max-width: 420px; margin: 0 auto; padding: 8px 0; }
  .lab { text-align: center; color: var(--ink); min-height: 44px; display: grid; place-items: center; }
  .strip { width: 100%; height: auto; display: block; }
  .bg { fill: #0b1030; }
  .cell { fill: #ffeec2; transition: fill .4s; }
  .cell.on { fill: var(--c); }
  .cell.eat { fill: #ffeec21f; }
  .ln { stroke: var(--outline); stroke-width: 2; }
  .frame { fill: none; stroke: var(--outline); stroke-width: 3; }
  .x { fill: none; stroke: var(--miss); stroke-width: 3; stroke-linecap: round; }
  .gd { position: absolute; top: 4px; bottom: 4px; left: 70px; right: 0; pointer-events: none; }
  .gd i { position: absolute; top: 0; bottom: 0; border-left: 3px dashed; }
  .q { font-size: 24px; color: var(--glitch); }
  .broken .cell.on { fill: var(--glitch); }
  .broken .strip, .pz.broken svg { animation: jit .6s steps(2) infinite; }

  .pz { display: flex; flex-wrap: wrap; justify-content: center; gap: 14px; padding: 6px 0; }
  .pz figure { margin: 0; display: grid; justify-items: center; gap: 4px; }
  .pz svg { width: min(150px, 42vw); height: auto; }
  .pz .crust { fill: #d9902a; stroke: var(--outline); stroke-width: 3; }
  .pz .sl { fill: #ffeec2; stroke: var(--outline); stroke-width: 2.5; stroke-linejoin: round; transition: fill .4s; }
  .pz .sl.on { fill: var(--c); }
  .pz .sl.eat { fill: #ffeec22a; }
  .pz figcaption { color: var(--ink); min-height: 44px; display: grid; place-items: center; }
  @keyframes jit { 50% { transform: translate(2px, -1px); } }
</style>
