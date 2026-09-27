<script lang="ts">
  // Два множества кругами Эйлера: show — none | inter (пересечение) | union (объединение).
  let { A = [1, 2, 3], B = [2, 3, 4], show = 'none', broken = false, an = 'A', bn = 'B' }:
    { A?: (number | string)[]; B?: (number | string)[]; show?: string; broken?: boolean; an?: string; bn?: string } = $props();
  const onlyA = $derived(A.filter(x => !B.includes(x))), both = $derived(A.filter(x => B.includes(x))), onlyB = $derived(B.filter(x => !A.includes(x)));
</script>

<div class="vn" class:broken class:inter={show === 'inter'} class:union={show === 'union'}>
  <div class="circ a"><b>{an}</b></div><div class="circ b"><b>{bn}</b></div>
  <div class="zone za">{#each onlyA as x}<span class="num">{broken ? '?' : x}</span>{/each}</div>
  <div class="zone zb both">{#each both as x}<span class="num">{broken ? '?' : x}</span>{/each}</div>
  <div class="zone zc">{#each onlyB as x}<span class="num">{broken ? '?' : x}</span>{/each}</div>
</div>

<style>
  .vn { position: relative; width: min(100%, 360px); height: 190px; margin: 0 auto; }
  .circ { position: absolute; top: 8px; width: 60%; height: 170px; border-radius: 50%; border: 3px solid; }
  .circ b { position: absolute; top: -4px; font-size: 18px; }
  .a { left: 2%; border-color: var(--code); background: #3ff0ff12; } .a b { left: 18%; color: var(--code); }
  .b { right: 2%; border-color: var(--glitch); background: #ff4fb812; } .b b { right: 18%; color: var(--glitch); }
  .zone { position: absolute; top: 50px; display: flex; flex-wrap: wrap; gap: 4px; justify-content: center; align-content: center; height: 100px; }
  .za { left: 6%; width: 30%; } .zb { left: 38%; width: 24%; } .zc { right: 6%; width: 30%; }
  .zone span { font-size: 18px; font-weight: 800; padding: 2px 6px; border-radius: 6px; transition: all .35s; }
  .inter .zb span, .union .zone span { background: var(--gold); color: var(--void); box-shadow: 0 0 10px #ffc94a88; }
  .inter .za span, .inter .zc span { opacity: .35; }
  .broken .zone span { color: var(--glitch); }
</style>
