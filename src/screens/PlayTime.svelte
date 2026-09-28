<script lang="ts">
  import Screen from '../ui/Screen.svelte';
  import Icon from '../ui/Icon.svelte';
  import { toast } from '../ui/notify.svelte';
  // «Ойын уақыты»: сколько заработано, таймер игры. Сайт не выключает приставку — он честно считает.
  import { onMount } from 'svelte';
  import Bit from '../ui/Bit.svelte';
  import { game, go, persist } from '../lib/store.svelte';
  import { W } from '../lib/world.svelte';
  import { dayRec } from '../lib/session.svelte';
  import { isWeekday, parse, iso } from '../engine/dates';
  import { audio } from '../lib/audio';

  const weekday = isWeekday(game.day);
  // копилка выходных: сумма за будни этой недели минус потраченное в выходные
  function weekKey(day: string) { const d = parse(day); const w = (d.getDay() + 6) % 7; d.setDate(d.getDate() - w); return iso(d); }
  const wk = weekKey(game.day);
  const weekBank = $derived(Object.values(game.save.days).filter(r => weekKey(r.date) === wk && isWeekday(r.date)).reduce((s, r) => s + r.minutesWeekend, 0));
  const weekendLeft = $derived(Math.max(0, weekBank - (game.save.weekendSpent?.[wk] ?? 0)));
  const rec = $derived(dayRec());
  const available = $derived(weekday ? Math.max(0, rec.minutesToday - (rec.spent ?? 0)) : weekendLeft);

  let running = $state(false);
  let left = $state(0); // секунды
  let timer: number | undefined;
  onMount(() => { W.dim = false; W.world?.setMode('hero'); audio.setMood('hub'); left = available * 60; return () => stop(); });

  function start() { if (!available) return; running = true; audio.play('portal'); left = available * 60; tickStart = Date.now(); timer = window.setInterval(tick, 1000); }
  let tickStart = 0, counted = 0;
  function tick() {
    left--; const mins = Math.floor((Date.now() - tickStart) / 60000);
    if (mins > counted) { spend(mins - counted); counted = mins; }
    if (left <= 0) { stop(); audio.play('levelup'); }
  }
  function spend(m: number) {
    if (weekday) { const r = dayRec(); r.spent = (r.spent ?? 0) + m; }
    else { (game.save.weekendSpent ??= {})[wk] = (game.save.weekendSpent[wk] ?? 0) + m; }
    persist();
  }
  function stop() { running = false; clearInterval(timer); counted = 0; }
  const mm = $derived(String(Math.floor(left / 60)).padStart(2, '0')), ss = $derived(String(left % 60).padStart(2, '0'));
</script>

<Screen scene="tall" title="Ойын уақыты" sub={weekday ? 'Бүгін жинаған минуттарың' : 'Демалыс копилкасы'} back={() => go({ name: 'hub' })}>
  {#snippet overlay()}
    <div></div>
    <div class="say"><Bit text={available ? (running ? 'Ойнай бер! Уақыт біткенде хабарлаймын.' : 'Жинаған уақытың дайын. Бастаймыз ба?') : weekday ? 'Әзірге уақыт жоқ — бүгінгі жолды өтсең, жиналады.' : 'Бұл аптаның копилкасы бос.'} mood={available ? 'happy' : 'idle'} compact /></div>
  {/snippet}

  <div class="clock" class:run={running}>
    <Icon name="clock" fill={running ? 'var(--code)' : 'var(--gold)'} size={44} />
    <b class="num">{running ? `${mm}:${ss}` : available}</b>{#if !running}<small>мин</small>{/if}
  </div>
  <div class="grid2">
    <div class="kpi"><small>{weekday ? 'Бүгін жиналды' : 'Копилкада'}</small><b class="num">{weekday ? rec.minutesToday : weekBank}<i>мин</i></b></div>
    <div class="kpi"><small>{weekday ? 'Демалысқа жиналды' : 'Қалды'}</small><b class="num">{weekday ? weekBank : weekendLeft}<i>мин</i></b></div>
  </div>

  {#snippet footer()}
    {#if !running}
      <button class="btn primary big grow" class:wait={!available} onclick={() => (available ? start() : toast(weekday ? 'Алдымен бүгінгі жолды өт' : 'Копилка бос'))}><Icon name="play" fill="var(--outline)" stroke="none" size={20} />Ойынды бастау</button>
    {:else}
      <button class="btn big grow" onclick={stop}>Тоқтату</button>
    {/if}
  {/snippet}
</Screen>

<style>
  .say { padding: 0 4px 6px; width: min(460px, 100%); }
  .clock { display: flex; align-items: center; justify-content: center; gap: 10px; padding: 8px 0; }
  .clock b { font-size: 64px; line-height: 1; color: var(--gold); text-shadow: 0 4px 0 var(--outline); }
  .clock.run b { color: var(--code); }
  .clock small { font: 800 18px var(--disp); color: var(--dim); align-self: flex-end; margin-bottom: 8px; }
  .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .kpi { display: grid; gap: 2px; padding: 10px 12px; border-radius: 14px; background: var(--deep); border: 3px solid var(--outline); }
  .kpi small { color: var(--dim); font-size: 13px; }
  .kpi b { font-size: 26px; text-shadow: 0 2px 0 var(--outline); }
  .kpi i { font: 800 13px var(--txt); font-style: normal; color: var(--dim); margin-left: 4px; }
  .grow { flex: 1; }
  .btn.wait { --c: #5b6699; --e: #3d4670; --t: #d7dcf5; text-shadow: none; }
</style>
