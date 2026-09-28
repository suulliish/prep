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
  const broken = game.save.repairShop.filter(r => !r.fixed).length;
  const learnedTotal = Object.values(game.save.skills).filter(s => ['learned', 'mastered', 'automatic'].includes(s.status)).length;

  const BLOCK = {
    warmup: { kz: 'Глитч-мобтар шабуылы', ru: 'Разминка: повторение вперемешку', icon: 'mob' },
    new: { kz: 'Жаңа миссия', ru: 'Новая тема', icon: 'star' },
    mixed: { kz: 'Аралас шайқас', ru: 'Смешанные задачи', icon: 'swords' },
    summary: { kz: 'Кеме күнделігі', ru: 'Итог дня', icon: 'book' },
  } as const;

  const nextBlock = $derived(plan.blocks.find(b => !rec.blocksDone[b.id]));
  const done = $derived(planComplete(rec, plan));
  const extraOk = $derived(canStartExtra(rec, plan, game.save.settings.extraMissionCap));

  const name = $derived(game.save.heroName);
  const bossReady = $derived(weekday && done && !game.save.worldsCleared?.includes(game.save.world ?? 'village') && Object.values(game.save.skills).filter(x => ['learned', 'mastered', 'automatic'].includes(x.status)).length >= 3);
  const greeting = $derived(
    !game.save.diagnosticDone ? `Сәлем, ${name}! Мен — Бит. Алдымен сенің Код-күшіңді сканерлейік: бірнеше есеп, қателесуден қорықпа — бұл тек карта ашу үшін.`
    : !weekday ? `Бүгін демалыс, ${name}! Жинаған уақытыңды ойнап алуға болады. Дүйсенбіде жалғастырамыз.`
    : done ? `Керемет, ${name}! Бүгінгі жоспар орындалды: +${rec.minutesToday} мин. Қосымша тапсырма — тағы +15 мин.${bossReady ? ' Картада босс күтіп тұр!' : ''}`
    : !plan.blocks.some(b => b.id === 'new') ? `${name}, жаңа тақырыптың сабағы әлі дайындалуда. Бүгін — қайталау мен шайқас күні: бұл да білімді бекітеді!`
    : `${name}, бүгін ${plan.blocks.length} тапсырма. Бастайық па?`
  );

  onMount(() => {
    W.dim = false; W.world?.clearMob(); W.world?.setMode('hub'); W.world?.bitMood(done ? 'happy' : 'idle');
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
    <nav class="menu">
      <button class="mi" onclick={() => { audio.unlock(); audio.play('click'); go({ name: 'map' }); }}><i class="ic map"></i><span>Карта</span>{#if bossReady}<b class="badge gold">!</b>{/if}</button>
      <button class="mi" onclick={() => { audio.unlock(); audio.play('click'); go({ name: 'hero' }); }}><i class="ic hero"></i><span>Кейіпкер</span></button>
      <button class="mi" onclick={() => { audio.unlock(); audio.play('click'); go({ name: 'album' }); }}><i class="ic cards"></i><span>Альбом</span>{#if broken}<b class="badge">{broken}</b>{/if}</button>
      <button class="mi" onclick={() => { audio.unlock(); audio.play('click'); go({ name: 'playtime' }); }}><i class="ic clock"></i><span>Ойын</span></button>
    </nav>
    <p class="info">Тақырыптар: {learnedTotal} / {skillDefs.length} · Кристалдар: {crystals}</p>
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
  .menu { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; }
  .mi { position: relative; display: grid; justify-items: center; gap: 4px; padding: 10px 4px 8px; font: 800 var(--fs-xs) var(--txt); color: var(--dim); background: var(--panel); border: 2px solid var(--line); border-bottom-width: 4px; border-radius: 8px; cursor: pointer; }
  .mi:hover { color: var(--ink); border-color: var(--line-hi); }
  .ic { width: 22px; height: 22px; display: block; }
  .ic.clock { border: 4px solid var(--gold); border-radius: 50%; }
  .ic.cards { background: var(--crystal); clip-path: polygon(50% 0, 100% 40%, 50% 100%, 0 40%); }
  .ic.map { background: linear-gradient(90deg, var(--ok) 0 33%, var(--code) 33% 66%, var(--gold) 66%); clip-path: polygon(0 10%, 33% 0, 66% 10%, 100% 0, 100% 90%, 66% 100%, 33% 90%, 0 100%); }
  .ic.hero { background: var(--code); clip-path: polygon(30% 0, 70% 0, 70% 40%, 100% 45%, 100% 70%, 70% 65%, 70% 100%, 30% 100%, 30% 65%, 0 70%, 0 45%, 30% 40%); }
  .ic.lock { background: var(--dim); clip-path: polygon(20% 45%, 20% 25%, 35% 8%, 65% 8%, 80% 25%, 80% 45%, 100% 45%, 100% 100%, 0 100%, 0 45%, 30% 45%, 30% 28%, 40% 18%, 60% 18%, 70% 28%, 70% 45%); }
  .badge.gold { background: var(--gold); }
  .badge { position: absolute; top: 4px; right: 8px; min-width: 18px; height: 18px; padding: 0 4px; display: grid; place-items: center; font-size: 11px; color: var(--void); background: var(--glitch); border-radius: 9px; }
  .info { color: var(--dim); font-size: var(--fs-s); text-align: center; }
  .cap { font-weight: 700; opacity: .8; }
  .pulse { animation: pulse-glow 2s infinite; }
  /* широкий экран: корабль слева, панель квестов справа (как в app.css .stage) */
  @media (min-width: 1000px) and (min-aspect-ratio: 23/20) {
    .spacer { display: none; }
    .dock { width: calc(var(--side-w) + 24px); margin: auto 0 auto auto; padding: 0 24px 24px 0; }
  }
  @media (min-width: 700px) and (max-aspect-ratio: 23/20) { .dock { width: min(620px, 100%); } }
</style>
