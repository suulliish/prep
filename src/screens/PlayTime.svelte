<script lang="ts">
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
  onMount(() => { W.dim = false; W.world?.setMode('portal'); audio.setMood('hub'); left = available * 60; return () => stop(); });

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

<div class="wrap">
  <div class="top panel"><button class="btn ghost small" onclick={() => go({ name: 'hub' })}>←</button><b>Ойын уақыты</b></div>
  <div class="spacer passthrough"></div>
  <section class="panel card glow">
    <Bit text={available ? (running ? 'Ойнай бер! Уақыт біткенде хабарлаймын.' : 'Жинаған уақытың дайын. Бастаймыз ба?') : weekday ? 'Әзірге уақыт жоқ — бүгінгі жоспарды орындасаң, жиналады.' : 'Бұл аптаның копилкасы бос.'} mood={available ? 'happy' : 'idle'} compact />
    <div class="clock px" class:run={running}>{running ? `${mm}:${ss}` : `${available}`}<small>{running ? '' : 'мин'}</small></div>
    <div class="grid2">
      <div class="kpi"><span class="label">{weekday ? 'Бүгін жиналды' : 'Демалыс копилкасы'}</span><b>{weekday ? rec.minutesToday : weekBank} мин</b></div>
      <div class="kpi"><span class="label">{weekday ? 'Демалысқа жиналып жатыр' : 'Қалды'}</span><b>{weekday ? weekBank : weekendLeft} мин</b></div>
    </div>
    {#if !running}<button class="btn gold big block" disabled={!available} onclick={start}>Ойынды бастау</button>
    {:else}<button class="btn big block" onclick={stop}>Тоқтату</button>{/if}
  </section>
</div>

<style>
  .wrap { min-height: 100dvh; width: min(560px, 100%); margin: 0 auto; display: flex; flex-direction: column; gap: 10px; padding: calc(env(safe-area-inset-top, 0px) + 12px) 16px calc(env(safe-area-inset-bottom, 0px) + 16px); }
  .top { display: flex; gap: 12px; align-items: center; padding: 8px 12px; font-size: 18px; }
  .btn.small { min-height: 40px; padding: 6px 12px; }
  .spacer { flex: 1; min-height: 18vh; }
  .card { display: grid; gap: 14px; }
  .clock { font-size: 80px; text-align: center; color: var(--gold); text-shadow: 0 0 24px #ffc94a66; line-height: 1; }
  .clock small { font-size: 20px; color: var(--dim); margin-left: 8px; }
  .clock.run { color: var(--code); text-shadow: 0 0 24px #3ff0ff66; }
  .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .kpi { display: grid; gap: 4px; background: var(--deep); border: 1px solid var(--line); padding: 10px; }
  .kpi b { font-size: 22px; }
</style>
