<script lang="ts">
  // Степень из кубиков: a² — квадрат a×a, a³ — куб из слоёв. Ползунок показателя.
  import { audio } from '../lib/audio';
  let { a = 3, ondone }: { a?: number; ondone?: () => void } = $props();
  let n = $state(1);
  let seen = $state(new Set<number>([1]));
  function set(k: number) { n = k; seen.add(k); seen = new Set(seen); audio.play('xp'); if (seen.size >= 3) ondone?.(); }
  const layers = $derived(n >= 3 ? a : 1), rows = $derived(n >= 2 ? a : 1), cols = a;
</script>

<div class="pb">
  <div class="stage" style="--a:{a}">
    {#each Array(layers) as _, l}
      <div class="layer" style="transform: translate({l * 10}px, {-l * 10}px); z-index:{10 - l}">
        {#each Array(rows) as _}<div class="r">{#each Array(cols) as _}<i></i>{/each}</div>{/each}
      </div>
    {/each}
  </div>
  <p class="expr num">{a}{n === 1 ? '¹' : n === 2 ? '²' : '³'} = {Array(n).fill(a).join(' · ')} = {a ** n}</p>
  <div class="row">{#each [1, 2, 3] as k}<button class="btn" class:on={n === k} onclick={() => set(k)}>{a}{k === 1 ? '¹' : k === 2 ? '²' : '³'}</button>{/each}</div>
  <p class="msg">Дәреже көрсеткіші — санды неше рет өзіне көбейтеміз. {a}² — шаршы, {a}³ — куб.</p>
</div>

<style>
  .pb { display: grid; gap: 12px; justify-items: center; }
  .stage { position: relative; height: calc(var(--a) * 20px + 40px); width: calc(var(--a) * 20px + 40px); }
  .layer { position: absolute; left: 0; bottom: 0; display: grid; gap: 2px; transition: transform .3s; animation: pop-in .35s var(--ease-out); }
  .r { display: flex; gap: 2px; }
  .r i { width: 18px; height: 18px; background: var(--code); box-shadow: inset -3px -3px 0 #0d5f6c; }
  .layer:nth-child(2) .r i { background: #8ff7ff; }
  .layer:nth-child(3) .r i { background: #c9fbff; }
  .expr { font-size: 26px; }
  .row { display: flex; gap: 8px; }
  .on { border-color: var(--code); background: #0f5a66; }
  .msg { font-weight: 700; text-align: center; }
</style>
