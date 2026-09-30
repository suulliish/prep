<script lang="ts">
  // «Охота на кратные»: отметь все числа до n, которые делятся на k. Промах — не штраф, число мигает.
  import { audio } from '../lib/audio';
  let { n = 24, k = 3, ondone }: { n?: number; k?: number; ondone?: () => void } = $props();
  let found = $state(new Set<number>());
  let miss = $state(-1);
  const need = Math.floor(n / k);
  function tap(x: number) {
    if (found.has(x)) return;
    if (x % k) { miss = x; audio.play('wrong'); setTimeout(() => (miss = -1), 450); return; }
    found.add(x); found = new Set(found); audio.play(found.size === need ? 'correct' : 'click');
    if (found.size === need) setTimeout(() => ondone?.(), 600);
  }
</script>

<div class="mh">
  <p class="t">{k}-ге бөлінетін сандардың бәрін тап! <b class="num">{found.size} / ?</b></p>
  <div class="g">{#each Array(n) as _, i}<button class="c num" class:on={found.has(i + 1)} class:bad={miss === i + 1} onclick={() => tap(i + 1)}>{i + 1}</button>{/each}</div>
  {#if found.size === need}<p class="done">Барлығы {need}: {n} : {k} = {need} — санамай-ақ табуға болады!</p>{/if}
</div>

<style>
  .mh { display: grid; gap: 10px; justify-items: center; }
  .t { font-weight: 800; } .t b { color: var(--code); }
  .g { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 5px; width: min(100%, 360px); }
  .c { aspect-ratio: 1; font-size: 18px; color: var(--ink); background: var(--panel-hi); border: 2px solid var(--line-hi); border-bottom-width: 4px; border-radius: 8px; cursor: pointer; }
  .c.on { background: var(--code); color: var(--void); border-color: #b9fdff; animation: pop-in .3s var(--ease-out); }
  .c.bad { border-color: var(--miss); animation: shake .35s; }
  .done { font-weight: 800; color: var(--ok); text-align: center; }
</style>
