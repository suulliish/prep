<script lang="ts">
  import { onMount } from 'svelte';
  import Hud from '../ui/Hud.svelte';
  import Bit from '../ui/Bit.svelte';
  import { game, go, skillDefs } from '../lib/store.svelte';
  import { W } from '../lib/world.svelte';
  import { ensurePlan, dayRec } from '../lib/session.svelte';
  import { canStartExtra, planComplete } from '../engine/planner';
  import { isWeekday } from '../engine/dates';
  import { skillTitle } from '../engine/items';
  import { audio } from '../lib/audio';

  const plan = ensurePlan();
  const rec = $derived(dayRec());
  const weekday = isWeekday(game.day);
  const crystals = Object.values(game.save.skills).filter(s => s.status === 'mastered' || s.status === 'automatic').length;
  const learnedTotal = Object.values(game.save.skills).filter(s => ['learned', 'mastered', 'automatic'].includes(s.status)).length;

  const BLOCK = {
    warmup: { kz: 'Глитч-мобтар шабуылы', ru: 'Разминка: повторение вперемешку', icon: 'mob' },
    new: { kz: 'Жаңа миссия', ru: 'Новая тема', icon: 'star' },
    mixed: { kz: 'Аралас шайқас', ru: 'Смешанные задачи', icon: 'swords' },
    summary: { kz: 'Бортжурнал', ru: 'Итог дня', icon: 'book' },
  } as const;

  const nextBlock = $derived(plan.blocks.find(b => !rec.blocksDone[b.id]));
  const done = $derived(planComplete(rec, plan));
  const extraOk = $derived(canStartExtra(rec, plan, game.save.settings.extraMissionCap));

  const greeting = $derived(
    !game.save.diagnosticDone ? 'Сәлем, Кодер! Мен — Бит. Алдымен сенің Код-күшіңді сканерлейік: бірнеше есеп, қателесуден қорықпа — бұл тек карта ашу үшін.'
    : !weekday ? 'Бүгін демалыс! Жинаған уақытыңды ойнап алуға болады. Дүйсенбіде жалғастырамыз.'
    : done ? `Керемет! Бүгінгі жоспар орындалды: +${rec.minutesToday} мин. Қосымша тапсырма алсаң, тағы +15 мин.`
    : `Бүгін ${plan.blocks.length} тапсырма. Бастайық па?`
  );

  onMount(() => {
    W.dim = false; W.world?.setMode('hub'); W.world?.bitMood(done ? 'happy' : 'idle');
    W.world?.setEnergy(learnedTotal % 10, 10);
    audio.setMood('hub');
  });

  function start(id: string) {
    audio.unlock(); audio.play('mission');
    if (id === 'summary') return go({ name: 'summary' });
    const b = plan.blocks.find(x => x.id === id)!;
    if (id === 'new' && b.lesson) return go({ name: 'lesson', skill: b.skills[0] });
    go({ name: 'session', block: id as any });
  }
</script>

<div class="hub">
  <Hud />
  <div class="spacer passthrough"></div>
  <section class="dock">
    <div class="panel talk appear"><Bit text={greeting} mood={done ? 'happy' : 'idle'} /></div>

    {#if !game.save.diagnosticDone}
      <button class="btn primary big block pulse" onclick={() => { audio.unlock(); go({ name: 'diagnostic' }); }}>Сканерлеуді бастау</button>
    {:else if weekday}
      <div class="quests">
        {#each plan.blocks as b, i (b.id)}
          {@const q = BLOCK[b.id]}
          {@const isDone = !!rec.blocksDone[b.id]}
          {@const isNext = nextBlock?.id === b.id}
          <button class="quest panel appear" class:done={isDone} class:next={isNext} style="animation-delay:{i * 70}ms"
            disabled={!isNext} onclick={() => start(b.id)}>
            <span class="qi {q.icon}" aria-hidden="true"></span>
            <span class="qt">
              <b>{q.kz}</b>
              <small>{b.id === 'new' && b.skills[0] ? skillTitle(b.skills[0]).kz : q.ru}{b.minutes > 2 ? ` · ~${b.minutes} мин` : ''}</small>
            </span>
            <span class="qs">{isDone ? '✓' : isNext ? '▶' : ''}</span>
          </button>
        {/each}
      </div>
      {#if done}
        <button class="btn gold big block" disabled={!extraOk} onclick={() => { audio.unlock(); audio.play('energy'); go({ name: 'session', block: 'extra' }); }}>
          Қосымша тапсырма · +15 мин <small class="cap">({rec.extraMissions}/{game.save.settings.extraMissionCap})</small>
        </button>
      {/if}
    {/if}
    <div class="row">
      <button class="btn ghost" onclick={() => { audio.unlock(); go({ name: 'sound' }); }}>Дыбыс</button>
      <span class="info">Тақырыптар: {learnedTotal} / {skillDefs.length} · Кристалдар: {crystals}</span>
    </div>
  </section>
</div>

<style>
  .hub { min-height: 100dvh; display: flex; flex-direction: column; }
  .spacer { flex: 1; min-height: 30vh; }
  .dock { width: min(560px, 100%); margin: 0 auto; padding: 0 16px calc(env(safe-area-inset-bottom, 0px) + 16px); display: grid; gap: 10px; }
  .talk { padding: 12px; }
  .quests { display: grid; gap: 8px; }
  .quest { display: flex; align-items: center; gap: 12px; text-align: left; font: inherit; color: var(--ink); cursor: pointer; padding: 12px 14px; }
  .quest:disabled { cursor: default; }
  .quest.done { opacity: .6; }
  .quest.next { border-color: var(--code); box-shadow: inset 0 0 24px #3ff0ff22; animation: pop-in .35s var(--ease-out) both, pulse-glow 2s 1s infinite; }
  .qt { flex: 1; display: grid; gap: 2px; }
  .qt b { font-size: var(--fs-m); }
  .qt small { color: var(--dim); font-size: var(--fs-s); }
  .qs { font-size: 20px; font-weight: 800; color: var(--code); }
  .quest.done .qs { color: var(--ok); }
  .qi { flex: none; width: 34px; height: 34px; background: var(--panel); border: 2px solid var(--line-hi); display: grid; place-items: center; }
  .qi.mob { background: linear-gradient(135deg, var(--glitch), #8a3cff); }
  .qi.star { background: radial-gradient(circle, var(--code) 30%, transparent 32%), var(--panel); }
  .qi.swords { background: repeating-linear-gradient(45deg, var(--gold) 0 3px, transparent 3px 8px), var(--panel); }
  .qi.book { background: linear-gradient(var(--crystal), var(--crystal)) center/60% 70% no-repeat, var(--panel); }
  .row { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; }
  .info { color: var(--dim); font-size: var(--fs-s); }
  .cap { font-weight: 700; opacity: .8; }
  .pulse { animation: pulse-glow 2s infinite; }
</style>
