<script lang="ts">
  // «Бөл»: монстр-число делится на равные группы, если выбранный делитель подходит (встроенная математика).
  import { audio } from '../lib/audio';
  import { sparksAt, centerOf } from '../ui/fx.svelte';
  let { n = 12, divisors = [2, 3, 4, 5, 6, 7, 8, 9], need = 1, remainder = false, ondone }:
    { n?: number; divisors?: number[]; need?: number; remainder?: boolean; ondone?: () => void } = $props();
  let groups = $state<number | null>(null);
  let failed = $state<number | null>(null);
  let hits = $state(0);
  let tried = $state<Record<number, boolean>>({});
  let box: HTMLElement;
  function shoot(d: number) {
    tried[d] = true;
    const ok = n % d === 0;
    if (ok || remainder) {
      groups = d; failed = null; audio.play(ok ? 'hit' : 'click');
      if (ok) { hits++; sparksAt(centerOf(box).x, centerOf(box).y, ['#ff4fb8', '#3ff0ff'], 30); }
      if (hits >= need || remainder) setTimeout(() => ondone?.(), 900);
    } else { failed = d; groups = null; audio.play('wrong'); }
    if (Object.keys(tried).length === divisors.length) setTimeout(() => ondone?.(), 900);
  }
  const rows = $derived(groups ? Array.from({ length: groups }, (_, g) => Array.from({ length: Math.floor(n / groups!) }, (_, k) => g * Math.floor(n / groups!) + k)) : []);
  const rest = $derived(groups ? n % groups : 0);
</script>

<div class="dg">
  <div class="monster" bind:this={box} class:split={groups && !rest} class:fail={failed}>
    {#if !groups}
      <div class="blob num">{n}</div>
    {:else}
      <div class="groups">
        {#each rows as row, g}
          <div class="grp" style="animation-delay:{g * 60}ms">{#each row as _}<i></i>{/each}</div>
        {/each}
        {#if rest}<div class="grp rest">{#each Array(rest) as _}<i></i>{/each}</div>{/if}
      </div>
    {/if}
  </div>
  <p class="msg">
    {#if failed}{n} саны {failed} тең топқа бөлінбейді — артық қалады!{:else if groups && !rest}{n} = {groups} · {n / groups} ✔ {groups} тең топ, әрқайсысында {n / groups}.{:else if groups}{n} = {groups} · {Math.floor(n / groups)} + {rest}: қалдық {rest}.{:else}Қару-бөлгішті таңда: монстр тең бөліктерге бөлінсін!{/if}
  </p>
  <div class="weapons">
    {#each divisors as d}
      <button class="btn" class:used={tried[d]} onclick={() => shoot(d)}>÷{d}</button>
    {/each}
  </div>
</div>

<style>
  .dg { display: grid; gap: 12px; justify-items: center; }
  .monster { min-height: 150px; width: 100%; display: grid; place-items: center; }
  .blob { width: 120px; height: 120px; display: grid; place-items: center; font-size: 44px; background: linear-gradient(135deg, var(--glitch), #8a3cff); color: #fff; box-shadow: 0 0 30px #ff4fb866; animation: wobble 1.6s infinite; }
  .fail .blob { animation: shake .35s, wobble 1.6s infinite .35s; }
  .groups { display: flex; flex-wrap: wrap; gap: 10px; justify-content: center; }
  .grp { display: grid; grid-template-columns: repeat(auto-fill, 16px); width: 92px; gap: 4px; padding: 8px; border: 2px solid var(--code); background: #0d3140; animation: pop-in .4s var(--ease-out) both; }
  .grp.rest { border-color: var(--miss); background: var(--miss-deep); }
  .grp i { width: 16px; height: 16px; background: var(--glitch); box-shadow: 0 0 6px var(--glitch); }
  .msg { text-align: center; font-weight: 700; min-height: 3em; }
  .weapons { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; }
  .weapons .btn { min-width: 64px; font-family: var(--px); font-size: 20px; font-weight: 400; }
  .weapons .used { opacity: .7; }
  @keyframes wobble { 50% { transform: scale(1.05) rotate(2deg); } }
</style>
