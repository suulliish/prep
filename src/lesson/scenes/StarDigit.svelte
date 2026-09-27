<script lang="ts">
  // Цифра вместо звёздочки: stage 1 — сумма известных цифр, 2 — подходящие цифры 0–9 подсвечены (признак d = 3 или 9).
  let { num = '3*6', d = 9, stage = 0 }: { num?: string; d?: number; stage?: number } = $props();
  const ds = $derived(num.split(''));
  const known = $derived(ds.filter(c => c !== '*').reduce((s, c) => s + +c, 0));
  const ok = (x: number) => (known + x) % d === 0;
</script>

<div class="sd">
  <div class="row">{#each ds as c}<span class="dg num" class:star={c === '*'}>{c}</span>{/each}<b class="div num">÷{d}</b></div>
  {#if stage >= 1}<p class="sum num appear">{ds.filter(c => c !== '*').join(' + ')} + * = <b>{known}</b> + *</p>{/if}
  {#if stage >= 2}
    <div class="cands appear">{#each Array(10) as _, x}<span class="cd num" class:ok={ok(x)}>{x}<small>{known + x}</small></span>{/each}</div>
  {/if}
</div>

<style>
  .sd { display: grid; gap: 12px; justify-items: center; padding: 10px 0; }
  .row { display: flex; gap: 6px; align-items: center; }
  .dg { width: 50px; height: 62px; display: grid; place-items: center; font-size: 34px; background: var(--deep); border: 2px solid var(--line-hi); border-bottom-width: 5px; border-radius: 8px; }
  .dg.star { color: var(--gold); border-color: var(--gold); box-shadow: 0 0 16px #ffc94a88; animation: pulse-glow 1.4s infinite; }
  .div { margin-left: 8px; font-size: 22px; color: var(--code); }
  .sum { font-size: 20px; font-weight: 800; } .sum b { color: var(--gold); }
  .cands { display: grid; grid-template-columns: repeat(10, 1fr); gap: 4px; width: min(100%, 420px); }
  .cd { display: grid; justify-items: center; padding: 4px 0; font-size: 18px; background: var(--deep); border: 2px solid var(--line); border-radius: 6px; opacity: .45; }
  .cd small { font-size: 10px; color: var(--dim); }
  .cd.ok { opacity: 1; border-color: var(--ok); color: var(--ok); background: #0e3322; box-shadow: 0 0 10px #5ce39c66; }
</style>
