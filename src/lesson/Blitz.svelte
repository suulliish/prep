<script lang="ts">
  // Мини-ойын: раунд на время. Комбо, звёзды, можно переиграть ради лучшего результата.
  // Быстрое вспоминание (retrieval) в игровой обёртке; ошибка стоит только комбо.
  import { onDestroy } from 'svelte';
  import { audio } from '../lib/audio';
  import { sparksAt, floatText, centerOf } from '../ui/fx.svelte';
  // @ts-ignore
  import { rng } from '../../content/templates/lib.mjs';
  type Item = { q: string; choices: string[]; answer: number };
  let { title, seconds, count, make, ondone }: { title: string; seconds: number; count: number; make: (r: any) => Item; ondone: (stars: number) => void } = $props();
  let phase = $state<'ready' | 'play' | 'over'>('ready');
  let items: Item[] = [];
  let idx = $state(0), right = $state(0), combo = $state(0), best = $state(0);
  let left = $state(0), flashK = $state<number | null>(null);
  let timer: number | undefined;
  let qBox = $state<HTMLElement>();
  const item = $derived(phase === 'play' ? items[idx] : null);
  const stars = $derived(right >= count ? 3 : right >= Math.ceil(count * 0.7) ? 2 : right >= Math.ceil(count * 0.4) ? 1 : 0);

  function start() {
    const r = rng(Date.now());
    const seen = new Set<string>(); items = [];
    for (let t = 0; items.length < count && t < count * 20; t++) { const it = make(r); if (!seen.has(it.q)) { seen.add(it.q); items.push(it); } }
    idx = 0; right = 0; combo = 0; left = seconds; phase = 'play'; audio.play('mission');
    clearInterval(timer);
    timer = window.setInterval(() => { left = Math.max(0, left - 0.1); if (left <= 0) finish(); }, 100);
  }
  function answer(k: number) {
    if (!item || flashK !== null) return;
    const ok = k === item.answer;
    flashK = k;
    if (ok) {
      right++; combo++; best = Math.max(best, combo);
      audio.play(combo >= 3 ? 'crit' : 'correct'); if (combo > 1) audio.play('combo', { combo });
      if (qBox) { const c = centerOf(qBox); sparksAt(c.x, c.y, ['#5ce39c', '#3ff0ff'], combo >= 3 ? 36 : 16); if (combo >= 3) floatText(`×${combo}`, c.x, c.y - 30, '#3ff0ff', true); }
    } else { combo = 0; audio.play('wrong'); }
    setTimeout(() => { flashK = null; if (idx < items.length - 1) idx++; else finish(); }, ok ? 280 : 700);
  }
  function finish() {
    if (phase !== 'play') return;
    clearInterval(timer); phase = 'over';
    audio.play(stars >= 2 ? 'levelup' : 'chest');
    ondone(stars);
  }
  onDestroy(() => clearInterval(timer));
</script>

<div class="bz">
  {#if phase === 'ready'}
    <div class="intro">
      <b class="px">{title}</b>
      <p>{count} сұрақ · {seconds} секунд · ★ әр дұрыс серия үшін</p>
      <button class="btn gold big" onclick={start}>Бастау!</button>
    </div>
  {:else if phase === 'play' && item}
    <div class="hud"><span class="num">{idx + 1}/{items.length}</span><div class="bar"><i style="width:{(left / seconds) * 100}%" class:low={left < 10}></i></div><span class="num combo" class:on={combo >= 2}>×{combo}</span></div>
    {#key idx}
      <p class="q appear" bind:this={qBox}>{item.q}</p>
      <div class="ch" class:two={item.choices.length === 2}>
        {#each item.choices as c, k}
          <button class="choice" class:right={flashK !== null && k === item.answer} class:wrong={flashK === k && k !== item.answer} onclick={() => answer(k)}>{c}</button>
        {/each}
      </div>
    {/key}
  {:else}
    <div class="intro">
      <div class="stars">{#each [1, 2, 3] as s}<i class:on={stars >= s}>★</i>{/each}</div>
      <p><b>{right}</b> / {count} дұрыс · ең ұзақ серия ×{best}</p>
      <button class="btn ghost" onclick={start}>Тағы ойнау ↻</button>
    </div>
  {/if}
</div>

<style>
  .bz { display: grid; gap: 14px; min-height: 220px; align-content: center; }
  .intro { display: grid; gap: 10px; justify-items: center; text-align: center; }
  .intro b.px { font-size: 30px; color: var(--gold); }
  .hud { display: flex; align-items: center; gap: 10px; }
  .bar { flex: 1; height: 12px; background: #070a1a; border: 1px solid var(--line-hi); }
  .bar i { display: block; height: 100%; background: var(--code); transition: width .1s linear; }
  .bar i.low { background: var(--miss); }
  .combo { color: var(--dim); } .combo.on { color: var(--code); text-shadow: 0 0 10px #3ff0ff; }
  .q { font-size: 26px; font-weight: 800; text-align: center; }
  .ch { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .choice { font: 800 20px var(--txt); color: var(--ink); background: var(--deep); border: 2px solid var(--line); border-bottom-width: 5px; border-radius: 8px; padding: 14px 8px; cursor: pointer; }
  .choice.right { border-color: var(--ok); background: var(--ok-deep); }
  .choice.wrong { border-color: var(--miss); background: var(--miss-deep); animation: shake .35s; }
  .stars { display: flex; gap: 8px; font-size: 48px; }
  .stars i { font-style: normal; color: #2a3160; } .stars i.on { color: var(--gold); text-shadow: 0 0 16px #ffc94a; animation: pop-in .4s var(--ease-out); }
</style>
