<script lang="ts">
  // Корабль — дом (docs/DESIGN_SYSTEM.md 11, 12.1–12.2). Главная кнопка всегда ведёт к следующему шагу дня.
  // Задания дня идут строго по порядку; у каждого видна награда. Закрытое при нажатии объясняет причину.
  import { onMount } from 'svelte';
  import Screen from '../ui/Screen.svelte';
  import Icon from '../ui/Icon.svelte';
  import Bit from '../ui/Bit.svelte';
  import { game, go, levelOf } from '../lib/store.svelte';
  import { W } from '../lib/world.svelte';
  import { ensurePlan, dayRec } from '../lib/session.svelte';
  import { canStartExtra, planComplete, TODAY_MAX, round5 } from '../engine/planner';
  import { isWeekday } from '../engine/dates';
  import { streak } from '../engine/streak';
  import { skillTitle } from '../engine/items';
  import { audio } from '../lib/audio';
  import { toast } from '../ui/notify.svelte';
  // @ts-ignore
  import { LESSONS } from '../../content/lessons.mjs';

  const plan = ensurePlan();
  const rec = $derived(dayRec());
  const weekday = isWeekday(game.day);
  const lv = $derived(levelOf(game.save.xp));
  const st = $derived(streak(game.save, game.day));
  const crystals = $derived(Object.values(game.save.skills).filter(s => s.status === 'mastered' || s.status === 'automatic').length);
  const broken = game.save.repairShop.filter(r => !r.fixed).length;
  const learnedTotal = Object.values(game.save.skills).filter(s => ['learned', 'mastered', 'automatic'].includes(s.status)).length;

  const BLOCK = {
    warmup: { kz: 'Жылыну', what: 'Ескі тақырыптар аралас', icon: 'mob', c: 'var(--glitch)' },
    new: { kz: 'Жаңа миссия', what: '', icon: 'star', c: 'var(--gold)' },
    mixed: { kz: 'Аралас шайқас', what: 'Нағыз емтихан есептері', icon: 'sword', c: 'var(--code)' },
    summary: { kz: 'Күн қорытындысы', what: 'Жинаған уақытың', icon: 'book', c: 'var(--crystal)' },
  } as const;
  const planMin = plan.blocks.reduce((s, b) => s + b.minutes, 0) || 1;
  const reward = (m: number) => Math.max(5, round5((TODAY_MAX * m) / planMin));

  const nextBlock = $derived(plan.blocks.find(b => !rec.blocksDone[b.id]));
  // недоконченный урок: «Жалғастыру · 5/11»
  const resume = $derived.by(() => {
    const p = game.save.lessonPos, b = plan.blocks.find(x => x.id === 'new');
    if (!p || !b?.lesson || b.skills[0] !== p.skill || p.step < 1) return null;
    return `${p.step + 1}/${((LESSONS as Record<string, any[]>)[p.skill] ?? []).length}`;
  });
  const doneN = $derived(plan.blocks.filter(b => rec.blocksDone[b.id]).length);
  const done = $derived(planComplete(rec, plan));
  const extraOk = $derived(canStartExtra(rec, plan, game.save.settings.extraMissionCap));
  const name = $derived(game.save.heroName);
  const bossReady = $derived(weekday && done && !game.save.worldsCleared?.includes(game.save.world ?? 'village') && learnedTotal >= 3);

  const greeting = $derived(
    !game.save.diagnosticDone ? `Сәлем, ${name}! Алдымен Код-күшіңді сканерлейік — бұл сынақ емес, карта ашу.`
    : !weekday ? `Бүгін демалыс! Жинаған уақытыңды ойнап ал. Дүйсенбіде жалғастырамыз.`
    : done ? `Керемет! Бүгінгі жол бітті: +${rec.minutesToday} мин.${bossReady ? ' Картада босс күтіп тұр!' : ''}`
    : doneN === 0 ? `${name}, бүгін ${plan.blocks.length} қадам. Бастайық!`
    : `Жарайсың! Тағы ${plan.blocks.length - doneN} қадам қалды.`
  );

  onMount(() => {
    W.dim = false; W.world?.clearMob(); W.world?.setMode('hub'); W.world?.bitMood(done ? 'happy' : 'idle');
    W.world?.setEnergy(learnedTotal % 10, 10);
    audio.setMood('hub');
  });

  // Катсцена (GAME_LOOP.md 2): герой идёт в портал на палубе → вспышка → локация уровня
  let entering = $state(false);
  async function portal(to: () => void) {
    if (entering) return;
    entering = true; audio.play('portal');
    await Promise.race([W.world?.portalWalk() ?? Promise.resolve(), new Promise(r => setTimeout(r, 3500))]);
    setTimeout(to, 250);
  }
  function start(id: string) {
    audio.unlock(); audio.play('mission');
    if (id === 'summary') return go({ name: 'summary' });
    const b = plan.blocks.find(x => x.id === id)!;
    if (id === 'new' && b.lesson) return portal(() => go({ name: 'lesson', skill: b.skills[0] }));
    portal(() => go({ name: 'session', block: id as any }));
  }
  function tapQuest(id: string) {
    if (rec.blocksDone[id]) { toast('Бұл қадам орындалды ✓'); return; }
    if (nextBlock?.id !== id) { toast(`Алдымен: ${BLOCK[nextBlock!.id].kz}`); audio.play('click'); return; }
    start(id);
  }
  function nav(to: 'map' | 'hero' | 'album') { audio.unlock(); audio.play('click'); go({ name: to }); }
  let muted = $state(audio.settings.master === 0);
  function toggleSound() { audio.unlock(); muted = !muted; audio.save({ master: muted ? 0 : 0.8 }); if (!muted) audio.play('click'); }

  const primary = $derived(
    !game.save.diagnosticDone ? { label: 'Сканерлеуді бастау', go: () => { audio.unlock(); go({ name: 'diagnostic' }); } }
    : !weekday ? { label: 'Демалыс! Картаны ашу', go: () => nav('map') }
    : nextBlock ? { label: nextBlock.id === 'new' && nextBlock.lesson ? (resume ? `Жалғастыру · ${resume}` : `Миссия: ${skillTitle(nextBlock.skills[0]).kz}`) : BLOCK[nextBlock.id].kz, go: () => start(nextBlock!.id) }
    : extraOk ? { label: 'Қосымша миссия · +15 мин', go: () => { audio.unlock(); audio.play('energy'); portal(() => go({ name: 'session', block: 'extra' })); } }
    : { label: 'Бүгін бітті! Картаны ашу', go: () => nav('map') }
  );
</script>

<Screen scene="tall">
  {#snippet head()}
    <div class="me">
      <span class="lvl num" aria-label="Деңгей {lv.lvl}">{lv.lvl}</span>
      <div class="who"><b>{name}</b><span class="bar"><i style="width:{(lv.into / lv.need) * 100}%"></i></span></div>
    </div>
  {/snippet}
  {#snippet right()}
    <button class="ibtn ghost" onclick={toggleSound} aria-label={muted ? 'Дыбысты қосу' : 'Дыбысты өшіру'}><Icon name={muted ? 'mute' : 'sound'} fill="#fff" /></button>
    <button class="ibtn ghost" onclick={() => go({ name: 'commander' })} aria-label="Командир (ата-ана)"><Icon name="gear" fill="#c4cfff" /></button>
  {/snippet}

  {#snippet overlay()}
  <div class="res" role="group" aria-label="Ресурстар">
    <span class="pill"><Icon name="clock" fill="var(--gold)" size={22} /><span class="num">{rec.minutesToday}</span><small>мин</small></span>
    <span class="pill"><Icon name="crystal" fill="var(--crystal)" size={22} /><span class="num">{crystals}</span><small>кристалл</small></span>
    <span class="pill"><Icon name="fire" fill="var(--fire)" size={22} /><span class="num">{st.days}</span><small>күн</small></span>
  </div>
  <div class="say"><Bit text={greeting} mood={done ? 'happy' : 'idle'} compact /></div>
  {/snippet}

  {#if game.save.diagnosticDone && weekday}
    <div class="today">
      <div class="ring" style="--p:{(doneN / plan.blocks.length) * 100}" aria-label="Бүгін {doneN} / {plan.blocks.length}">
        <span class="num">{doneN}<small>/{plan.blocks.length}</small></span>
      </div>
      <div class="tt"><b>Бүгінгі жол</b><small>Барлығы ~{planMin} мин · сыйлық {TODAY_MAX} мин ойынға дейін</small></div>
    </div>
    <ol class="quests">
      {#each plan.blocks as b (b.id)}
        {@const q = BLOCK[b.id]}
        {@const isDone = !!rec.blocksDone[b.id]}
        {@const isNext = nextBlock?.id === b.id}
        <li>
          <button class="quest" class:done={isDone} class:next={isNext} class:locked={!isDone && !isNext} onclick={() => tapQuest(b.id)}>
            <span class="qi" style="--c:{isDone ? 'var(--ok)' : q.c}"><Icon name={isDone ? 'check' : !isNext ? 'lock' : q.icon} fill={isDone ? '#fff' : '#fff'} size={22} /></span>
            <span class="qt">
              <b>{q.kz}</b>
              <small>{b.id === 'new' && resume ? `Жалғастыру · қадам ${resume}` : b.id === 'new' && b.skills[0] ? skillTitle(b.skills[0]).kz : q.what}{b.minutes > 2 && !(b.id === 'new' && resume) ? ` · ~${b.minutes} мин` : ''}</small>
            </span>
            {#if isDone && rec.stars?.[b.id]}
              <span class="st" aria-label="{rec.stars[b.id]} жұлдыз">{#each [1, 2, 3] as k}<Icon name="star" fill={rec.stars[b.id] >= k ? 'var(--gold)' : '#2b3a8f'} size={18} />{/each}</span>
            {:else if b.id !== 'summary'}<span class="rw" class:got={isDone}><Icon name="clock" fill="var(--gold)" size={16} />+{reward(b.minutes)}</span>{/if}
          </button>
        </li>
      {/each}
    </ol>
    {#if done}<p class="note center">Қосымша миссиялар: {rec.extraMissions} / {game.save.settings.extraMissionCap} · әрқайсысы +15 мин</p>{/if}
  {/if}

  {#if entering}<div class="warp" aria-hidden="true"></div>{/if}

  {#snippet footer()}
    <div class="stack">
      <button class="btn primary big block" class:wait={entering} onclick={primary.go}><Icon name="play" fill="var(--outline)" stroke="none" size={20} />{primary.label}</button>
      <nav class="menu" aria-label="Мәзір">
        <button class="mi" onclick={() => nav('map')}><Icon name="map" fill="#7ee08f" size={26} /><span>Карта</span>{#if bossReady}<b class="badge">!</b>{/if}</button>
        <button class="mi" onclick={() => nav('hero')}><Icon name="hero" fill="#5ea0ff" size={26} /><span>Кейіпкер</span></button>
        <button class="mi" onclick={() => nav('album')}><Icon name="cards" fill="var(--crystal)" size={26} /><span>Альбом</span>{#if broken}<b class="badge">{broken}</b>{/if}</button>
      </nav>
    </div>
  {/snippet}
</Screen>

<style>
  .me { flex: 1; display: flex; align-items: center; gap: 10px; min-width: 0; }
  .lvl { flex: none; width: 44px; height: 44px; display: grid; place-items: center; font-size: 20px; color: var(--outline); background: var(--code);
    border: 3px solid var(--outline); border-radius: 12px; box-shadow: inset 0 -4px 0 var(--code-deep); }
  .who { flex: 1; min-width: 0; display: grid; gap: 4px; }
  .who b { font: 900 18px var(--disp); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-shadow: 0 2px 0 var(--outline); }
  .who .bar { height: 12px; }

  .res { display: flex; gap: 6px; justify-content: center; width: 100%; padding: 0 4px; }
  .res .pill { flex: 1; justify-content: center; min-width: 0; }
  .say { padding: 0 4px 6px; width: min(460px, 100%); align-self: flex-start; }
  @media (min-width: 1000px) and (min-aspect-ratio: 23/20) { .say { width: 100%; } }

  .today { display: flex; align-items: center; gap: 12px; }
  .ring { --p: 0; flex: none; width: 58px; height: 58px; border-radius: 50%; display: grid; place-items: center;
    background: conic-gradient(var(--ok) calc(var(--p) * 1%), #0b1030 0); border: 3px solid var(--outline); position: relative; }
  .ring::before { content: ''; position: absolute; inset: 7px; border-radius: 50%; background: var(--panel-2); border: 2px solid var(--outline); }
  .ring span { position: relative; font-size: 20px; }
  .ring small { font-size: 12px; color: var(--dim); }
  .tt { display: grid; }
  .tt b { font: 900 18px var(--disp); text-shadow: 0 2px 0 var(--outline); }
  .tt small { color: var(--dim); font-size: 13px; }

  .quests { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; position: relative; }
  /* тропа уровней: пунктир соединяет точки, пройденная часть зелёная */
  .quests li { position: relative; }
  .quests li + li::before { content: ''; position: absolute; left: 33px; top: -12px; height: 16px; border-left: 4px dashed #5b6699; z-index: 0; }
  .quests li:has(.done) + li::before { border-left-style: solid; border-color: var(--ok); }
  .st { flex: none; display: inline-flex; gap: 1px; padding: 3px 6px; border-radius: 999px; background: #0b1030; border: 2px solid var(--outline); }
  .warp { position: fixed; inset: 0; z-index: 50; pointer-events: all; background: radial-gradient(circle at 70% 35%, #bff9ffcc, #3ff0ff66 30%, transparent 60%);
    animation: warp 1.6s ease-in both; }
  @keyframes warp { 0% { opacity: 0; } 55% { opacity: .2; } 100% { opacity: 1; background-color: #eaffff; } }
  .quest { width: 100%; display: flex; align-items: center; gap: 12px; text-align: left; font: inherit; color: var(--ink); cursor: pointer;
    padding: 10px 12px; background: var(--deep); border: 3px solid var(--outline); border-radius: 16px; box-shadow: inset 0 -4px 0 #0c1a5a, 0 3px 0 var(--outline);
    transition: transform .08s; }
  .quest:active { transform: translateY(2px); }
  .quest.next { background: linear-gradient(180deg, #3a5cf0, #2440c0); box-shadow: inset 0 -4px 0 #1a2f96, 0 0 0 3px var(--gold), 0 3px 0 var(--outline); animation: nudge 2.4s ease-in-out infinite; }
  .quest.done { opacity: .75; }
  .quest.locked { opacity: .6; }
  @keyframes nudge { 0%, 100% { transform: none; } 50% { transform: translateY(-2px); } }
  .qi { flex: none; width: 44px; height: 44px; display: grid; place-items: center; border-radius: 12px; background: var(--c); border: 3px solid var(--outline); box-shadow: inset 0 -4px 0 #00000033; }
  .quest.locked .qi { background: #5b6699; }
  .qt { flex: 1; min-width: 0; display: grid; gap: 2px; }
  .qt b { font: 800 17px var(--disp); }
  .qt small { color: var(--dim); font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .rw { flex: none; display: inline-flex; align-items: center; gap: 3px; font: 900 15px var(--disp); color: var(--gold); padding: 4px 8px; border-radius: 999px; background: #0b1030; border: 2px solid var(--outline); }
  .rw.got { color: var(--ok); }
  .center { text-align: center; }

  .stack { flex: 1; display: grid; gap: 8px; }
  .stack .btn { gap: 10px; }
  .menu { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
  .mi { position: relative; display: grid; justify-items: center; gap: 2px; padding: 6px 2px 5px; min-height: 56px; font: 800 12px var(--disp); color: var(--ink);
    background: transparent; border: 0; border-radius: 12px; cursor: pointer; }
  .mi:active { transform: translateY(2px); }
  .mi:focus-visible { outline: 3px solid var(--code); }
  .badge { position: absolute; top: 0; right: 14%; min-width: 20px; height: 20px; padding: 0 5px; display: grid; place-items: center; font: 900 12px var(--disp); color: var(--outline); background: var(--gold); border: 2px solid var(--outline); border-radius: 10px; }
</style>
