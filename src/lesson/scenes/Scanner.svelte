<script lang="ts">
  // Сканер делимости: last — луч на последней цифре, last2 — на двух последних, sum — цифры складываются.
  let { num = '7245', mode = 'none', sum = 0, ok = null, label = '', broken = false }:
    { num?: string; mode?: 'none' | 'last' | 'last2' | 'sum'; sum?: number; ok?: boolean | null; label?: string; broken?: boolean } = $props();
  const ds = $derived(num.replace(/\s/g, '').split(''));
  const lit = (i: number) => mode === 'sum' || (mode === 'last' && i === ds.length - 1) || (mode === 'last2' && i >= ds.length - 2);
</script>

<div class="sc" class:broken>
  {#if label}<span class="weapon num">{label}</span>{/if}
  <div class="row">
    {#each ds as d, i}
      {#if mode === 'sum' && i}<b class="plus">+</b>{/if}
      <span class="dg num" class:lit={lit(i)} class:off={mode !== 'none' && !lit(i)} style="animation-delay:{i * 60}ms">{broken ? '?' : d}</span>
    {/each}
    {#if mode === 'sum'}<b class="plus">=</b><span class="dg num res">{sum}</span>{/if}
    {#if mode === 'last' || mode === 'last2'}<i class="beam" class:two={mode === 'last2'}></i>{/if}
  </div>
  {#if ok !== null}<span class="verdict" class:yes={ok}>{ok ? '✔ бөлінеді' : '✘ бөлінбейді'}</span>{/if}
</div>

<style>
  .sc { display: grid; justify-items: center; gap: 12px; padding: 12px 0; }
  .weapon { font-size: 22px; font-weight: 800; color: var(--void); background: var(--code); padding: 2px 12px; border-radius: 6px; box-shadow: 0 0 14px #3ff0ff88; }
  .row { position: relative; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; justify-content: center; }
  .dg { width: clamp(40px, 10vw, 54px); height: clamp(52px, 13vw, 66px); display: grid; place-items: center; font-size: clamp(26px, 7vw, 36px); background: var(--deep); border: 2px solid var(--line-hi); border-bottom-width: 5px; border-radius: 8px; animation: pop-in .35s var(--ease-out) both; transition: opacity .3s, border-color .3s; }
  .dg.lit { border-color: var(--code); color: var(--code); box-shadow: 0 0 16px #3ff0ff55; }
  .dg.off { opacity: .35; }
  .dg.res { border-color: var(--gold); color: var(--gold); box-shadow: 0 0 16px #ffc94a55; }
  .plus { font-size: 24px; color: var(--dim); }
  .beam { position: absolute; right: -6px; top: -10px; bottom: -10px; width: 64px; border: 2px solid var(--code); border-radius: 10px; background: linear-gradient(transparent, #3ff0ff33, transparent); background-size: 100% 200%; animation: scan 1.2s linear infinite; pointer-events: none; }
  .beam.two { width: calc(2 * clamp(40px, 10vw, 54px) + 20px); }
  .verdict { font-weight: 800; font-size: 18px; color: var(--miss); padding: 4px 12px; border: 2px solid currentColor; border-radius: 6px; animation: pop-in .35s var(--ease-out); }
  .verdict.yes { color: var(--ok); }
  .broken .dg { color: var(--glitch); border-color: var(--glitch); }
  @keyframes scan { from { background-position: 0 100%; } to { background-position: 0 -100%; } }
</style>
