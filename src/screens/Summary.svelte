<script lang="ts">
  import { onMount } from 'svelte';
  import Bit from '../ui/Bit.svelte';
  import { game, go, persist } from '../lib/store.svelte';
  import { W } from '../lib/world.svelte';
  import { completeBlock, dayRec } from '../lib/session.svelte';
  import { skillTitle } from '../engine/items';
  import { audio } from '../lib/audio';
  import { sparksAt } from '../ui/fx.svelte';
  import { react } from '../lib/voice';

  const todays = game.save.attempts.filter(a => a.day === game.day);
  const solved = todays.filter(a => a.correct && a.honest).length;
  const skillsToday = [...new Set(todays.map(a => a.skill))];
  const honest = todays.filter(a => a.honest);
  const acc = honest.length ? Math.round((honest.filter(a => a.correct).length / honest.length) * 100) : 0;
  const clean = honest.filter(a => a.correct && a.hintLevel === 0).length;
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
    dayRec().hard = note ?? undefined;
    completeBlock('summary');
    const rec = dayRec();
    finished = true; audio.play('chest'); react('day');
    count(rec.minutesToday, v => (shownToday = v)); count(rec.minutesWeekend, v => (shownWeekend = v));
    sparksAt(innerWidth / 2, innerHeight / 2, ['#ffc94a', '#3ff0ff', '#ff4fb8'], 90, 11);
    W.world?.celebrate(0xffc94a);
    persist();
  }
</script>

<div class="wrap side-dock">
  <div class="spacer passthrough"></div>
  <section class="card panel glow appear">
    <h1>Бортжурнал</h1>
    <Bit text={finished ? 'Бүгін керемет жұмыс! Ойын уақыты жиналды. Қаласаң — қосымша тапсырма бар.' : `${game.save.heroName}, бүгінгі жұмысың — бортжурналда. Жарайсың!`} mood="happy" compact />
    <div class="stats3">
      <div><b class="num">{solved}</b><small>есеп шешілді</small></div>
      <div><b class="num">{acc}%</b><small>дәлдік</small></div>
      <div><b class="num">{clean}</b><small>кеңессіз</small></div>
    </div>
    {#if skillsToday.length}
      <div class="topics">
        {#each skillsToday as s}{@const st = game.save.skills[s]}
          <div class="tp"><span>{skillTitle(s).kz}</span><span class="bar"><i style="width:{Math.round((st?.p ?? 0) * 100)}%"></i></span><em>{st?.status === 'learned' ? 'үйренді ✓' : st?.status === 'mastered' ? 'кристалл ◆' : 'зарядталуда'}</em></div>
        {/each}
      </div>
    {/if}
    {#if !finished}
      <p class="ask">Бір сұрақ: бүгін не қиын болды?</p>
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
  .stats3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
  .stats3 div { display: grid; justify-items: center; gap: 2px; padding: 10px 4px; background: var(--deep); border: 1px solid var(--line); border-radius: 8px; }
  .stats3 b { font-size: 26px; color: var(--code); }
  .stats3 small { color: var(--dim); font-size: 12px; font-weight: 700; }
  .topics { display: grid; gap: 6px; }
  .tp { display: grid; grid-template-columns: 1fr 70px auto; gap: 8px; align-items: center; font-weight: 700; font-size: 14px; }
  .tp .bar { height: 8px; background: #070a1a; border: 1px solid var(--line); } .tp .bar i { display: block; height: 100%; background: var(--gold); }
  .tp em { font-style: normal; color: var(--dim); font-size: 12px; }
  .ask { font-weight: 800; }
  .card { display: grid; gap: 14px; padding: 18px; }
  h1 { font-size: 26px; color: var(--code); }
  .chips { display: flex; flex-wrap: wrap; gap: 8px; }
  .chip { font: 700 var(--fs-s) var(--txt); color: var(--ink); background: var(--deep); border: 2px solid var(--line-hi); border-radius: 999px; padding: 8px 14px; cursor: pointer; }
  .chip.on { border-color: var(--code); background: #0f3a4a; }
  .rewards { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .rw { display: grid; gap: 4px; background: var(--deep); border: 1px solid var(--line); padding: 12px; }
  .num.big { font-family: var(--px); font-weight: 400; font-size: 40px; }
  .big small { font-size: 16px; color: var(--dim); margin-left: 4px; }
  .gold { color: var(--gold); text-shadow: 0 0 18px #ffc94a66; }
</style>
