<script lang="ts">
  // «Ойын уақыты»: только сколько минут заработано. Игра время не отсчитывает и не тратит —
  // родители выдают его сами через экранное время телефона (решение 30.09.2026).
  import { onMount } from 'svelte';
  import Screen from '../ui/Screen.svelte';
  import Icon from '../ui/Icon.svelte';
  import Bit from '../ui/Bit.svelte';
  import { game, go } from '../lib/store.svelte';
  import { W } from '../lib/world.svelte';
  import { dayRec } from '../lib/session.svelte';
  import { isWeekday, parse, iso } from '../engine/dates';
  import { audio } from '../lib/audio';

  const weekday = isWeekday(game.day);
  function weekKey(day: string) { const d = parse(day); const w = (d.getDay() + 6) % 7; d.setDate(d.getDate() - w); return iso(d); }
  const wk = weekKey(game.day);
  const weekDays = $derived(Object.values(game.save.days).filter(r => weekKey(r.date) === wk).sort((a, b) => a.date.localeCompare(b.date)));
  const weekTotal = $derived(weekDays.reduce((s, r) => s + r.minutesToday, 0));
  const weekendBank = $derived(weekDays.filter(r => isWeekday(r.date)).reduce((s, r) => s + r.minutesWeekend, 0));
  const rec = $derived(dayRec());
  const DAY = ['Дс', 'Сс', 'Ср', 'Бс', 'Жм', 'Сб', 'Жс'];
  const dow = (d: string) => DAY[(parse(d).getDay() + 6) % 7];
  onMount(() => { W.dim = false; W.world?.setMode('hero'); audio.setMood('hub'); });
</script>

<Screen scene="tall" title="Ойын уақыты" sub="Жинаған минуттарың" back={() => go({ name: 'hub' })}>
  {#snippet overlay()}
    <div></div>
    <div class="say"><Bit text={rec.minutesToday ? `Бүгін ${rec.minutesToday} минут жинадың! Командирге көрсет — ол ойын уақытын береді.` : weekday ? 'Әзірге минут жоқ. Бүгінгі жолды өтсең, жиналады.' : 'Демалыс! Аптада жинағаныңды командирге көрсет.'} mood={rec.minutesToday ? 'happy' : 'idle'} compact /></div>
  {/snippet}

  <div class="clock">
    <Icon name="clock" fill="var(--gold)" size={44} />
    <b class="num">{rec.minutesToday}</b><small>мин бүгін</small>
  </div>
  <div class="grid2">
    <div class="kpi"><small>Осы аптада</small><b class="num">{weekTotal}<i>мин</i></b></div>
    <div class="kpi"><small>Демалысқа жиналды</small><b class="num">{weekendBank}<i>мин</i></b></div>
  </div>
  {#if weekDays.length}
    <ol class="week" aria-label="Апта бойынша">
      {#each weekDays as d}<li class:today={d.date === game.day}><small>{dow(d.date)}</small><b class="num">{d.minutesToday}</b></li>{/each}
    </ol>
  {/if}

  {#snippet footer()}
    <button class="btn primary big grow" onclick={() => go({ name: 'hub' })}>Кемеге</button>
  {/snippet}
</Screen>

<style>
  .say { padding: 0 4px 6px; width: min(460px, 100%); }
  .clock { display: flex; align-items: center; justify-content: center; gap: 10px; padding: 8px 0; }
  .clock b { font-size: 64px; line-height: 1; color: var(--gold); text-shadow: 0 4px 0 var(--outline); }
  .clock small { font: 800 18px var(--disp); color: var(--dim); align-self: flex-end; margin-bottom: 8px; }
  .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .kpi { display: grid; gap: 2px; padding: 10px 12px; border-radius: 14px; background: var(--deep); border: 3px solid var(--outline); }
  .kpi small { color: var(--dim); font-size: 13px; }
  .kpi b { font-size: 26px; text-shadow: 0 2px 0 var(--outline); }
  .kpi i { font: 800 13px var(--txt); font-style: normal; color: var(--dim); margin-left: 4px; }
  .week { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; }
  .week li { display: grid; justify-items: center; padding: 6px 0; border-radius: 10px; background: var(--deep); border: 2px solid var(--outline); }
  .week li.today { border-color: var(--gold); }
  .week small { color: var(--dim); font-size: 12px; }
  .week b { font-size: 18px; color: var(--gold); }
  .grow { flex: 1; }
</style>
