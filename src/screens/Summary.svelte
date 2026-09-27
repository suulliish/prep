<script lang="ts">
  import { onMount } from 'svelte';
  import Bit from '../ui/Bit.svelte';
  import { game, go, persist } from '../lib/store.svelte';
  import { W } from '../lib/world.svelte';
  import { completeBlock, dayRec } from '../lib/session.svelte';
  import { skillTitle } from '../engine/items';
  import { audio } from '../lib/audio';
  import { sparksAt } from '../ui/fx.svelte';

  const todays = game.save.attempts.filter(a => a.day === game.day);
  const solved = todays.filter(a => a.correct && a.honest).length;
  const skillsToday = [...new Set(todays.map(a => a.skill))];
  let note = $state<string | null>(null);
  let shownToday = $state(0), shownWeekend = $state(0);
  let finished = $state(false);

  function count(to: number, set: (v: number) => void) {
    const t0 = performance.now();
    const tick = (t: number) => { const k = Math.min(1, (t - t0) / 1100); set(Math.round(to * (1 - Math.pow(1 - k, 3)))); if (k < 1) requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  }

  onMount(() => { W.dim = false; W.world?.setMode('hub'); W.world?.bitMood('happy'); audio.setMood('victory'); });

  function finish() {
    completeBlock('summary');
    const rec = dayRec();
    finished = true; audio.play('chest');
    count(rec.minutesToday, v => (shownToday = v)); count(rec.minutesWeekend, v => (shownWeekend = v));
    sparksAt(innerWidth / 2, innerHeight / 2, ['#ffc94a', '#3ff0ff', '#ff4fb8'], 90, 11);
    W.world?.celebrate(0xffc94a);
    persist();
  }
</script>

<div class="wrap">
  <div class="spacer passthrough"></div>
  <section class="card panel glow appear">
    <h1>Бортжурнал</h1>
    <Bit text={finished ? 'Бүгін керемет жұмыс! Ойын уақыты жиналды. Қаласаң — қосымша тапсырма бар.' : `Бүгін ${solved} есепті өзің шығардың. Бір сұрақ: бүгін не қиын болды?`} mood="happy" compact />
    {#if !finished}
      <div class="chips">
        {#each skillsToday as s}<button class="chip" class:on={note === s} onclick={() => (note = s)}>{skillTitle(s).kz}</button>{/each}
        <button class="chip" class:on={note === 'none'} onclick={() => (note = 'none')}>Бәрі түсінікті</button>
      </div>
      <button class="btn gold big block" disabled={!note} onclick={finish}>Күнді аяқтау</button>
    {:else}
      <div class="rewards">
        <div class="rw"><span class="label">БҮГІН ОЙЫН</span><span class="num big gold">{shownToday}<small>мин</small></span></div>
        <div class="rw"><span class="label">ДЕМАЛЫСҚА</span><span class="num big">{shownWeekend}<small>мин</small></span></div>
      </div>
      <button class="btn primary big block" onclick={() => go({ name: 'hub' })}>Кемеге қайту</button>
    {/if}
  </section>
</div>

<style>
  .wrap { min-height: 100dvh; width: min(560px, 100%); margin: 0 auto; display: flex; flex-direction: column; padding: 16px 16px calc(env(safe-area-inset-bottom, 0px) + 16px); }
  .spacer { flex: 1; min-height: 25vh; }
  .card { display: grid; gap: 14px; padding: 18px; }
  h1 { font-size: 26px; color: var(--code); }
  .chips { display: flex; flex-wrap: wrap; gap: 8px; }
  .chip { font: 700 var(--fs-s) var(--txt); color: var(--ink); background: var(--deep); border: 2px solid var(--line-hi); border-radius: 999px; padding: 8px 14px; cursor: pointer; }
  .chip.on { border-color: var(--code); background: #0f3a4a; }
  .rewards { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .rw { display: grid; gap: 4px; background: var(--deep); border: 1px solid var(--line); padding: 12px; }
  .big { font-family: var(--px); font-weight: 400; font-size: 40px; }
  .big small { font-size: 16px; color: var(--dim); margin-left: 4px; }
  .gold { color: var(--gold); text-shadow: 0 0 18px #ffc94a66; }
</style>
