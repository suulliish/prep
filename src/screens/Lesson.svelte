<script lang="ts">
  import { onMount } from 'svelte';
  import Bit from '../ui/Bit.svelte';
  import { game, go, persist } from '../lib/store.svelte';
  import { W } from '../lib/world.svelte';
  import { skillTitle } from '../engine/items';
  import { blankSkill } from '../engine/progress';
  import { audio } from '../lib/audio';
  import { sparksAt, centerOf } from '../ui/fx.svelte';
  // @ts-ignore
  import { LESSONS } from '../../content/lessons.mjs';
  import DivideGame from '../widgets/DivideGame.svelte';
  import FactorTree from '../widgets/FactorTree.svelte';
  import OrderOps from '../widgets/OrderOps.svelte';
  import PlaceValue from '../widgets/PlaceValue.svelte';
  import PowerBlocks from '../widgets/PowerBlocks.svelte';
  import CommonFactors from '../widgets/CommonFactors.svelte';
  import BusTimeline from '../widgets/BusTimeline.svelte';

  let { skill }: { skill: string } = $props();
  const WIDGETS: Record<string, any> = { DivideGame, FactorTree, OrderOps, PlaceValue, PowerBlocks, CommonFactors, BusTimeline };
  const steps: any[] = LESSONS[skill] ?? [{ type: 'say', kz: 'Бұл тақырыптың сабағы әзірленуде. Бірден жаттығуға көшейік!' }];

  let i = $state(0);
  let ready = $state(false);
  let frame = $state(0);
  let quizPick = $state<number | null>(null);
  let skipTimer: number | undefined;
  let showSkip = $state(false);
  let nextBtn: HTMLElement;
  const step = $derived(steps[i]);

  function enter() {
    ready = step.type === 'say'; frame = 0; quizPick = null; showSkip = false;
    clearTimeout(skipTimer);
    if (step.type === 'widget') skipTimer = window.setTimeout(() => (showSkip = true), 25000);
    if (step.type === 'example') ready = step.frames.length <= 1;
  }
  onMount(() => { W.dim = true; audio.setMood('focus'); enter(); return () => clearTimeout(skipTimer); });

  function widgetDone() { ready = true; audio.play('correct'); const c = centerOf(nextBtn); sparksAt(c.x, c.y - 40, ['#3ff0ff', '#5ce39c'], 30); }
  function nextFrame() { if (frame < step.frames.length - 1) { frame++; audio.play('click'); if (frame === step.frames.length - 1) ready = true; } }
  function pickQuiz(k: number) { if (quizPick !== null) return; quizPick = k; ready = true; audio.play(k === step.answer ? 'correct' : 'wrong'); }

  function next() {
    if (i < steps.length - 1) { i++; enter(); audio.play('click'); return; }
    (game.save.skills[skill] ??= blankSkill()).lessonDone = true;
    persist(); audio.play('mission');
    go({ name: 'session', block: 'new' });
  }
</script>

<div class="wrap">
  <div class="top panel">
    <button class="btn ghost small" onclick={() => go({ name: 'hub' })} aria-label="Артқа">←</button>
    <div class="title"><b>Жаңа миссия</b><small>{skillTitle(skill).kz}</small></div>
    <div class="dots">{#each steps as _, k}<i class:on={k <= i}></i>{/each}</div>
  </div>

  {#key i}
    <section class="card panel glitch-in">
      {#if step.type === 'say'}
        <Bit text={step.kz} mood="wow" />
      {:else if step.type === 'widget'}
        {@const Comp = WIDGETS[step.w]}
        <Bit text={step.kz} mood="think" compact />
        <div class="widget pe"><Comp {...step.props} ondone={widgetDone} /></div>
      {:else if step.type === 'example'}
        <h2 class="h">{step.kz}</h2>
        <ol class="frames">
          {#each step.frames.slice(0, frame + 1) as f, k}<li class="appear" class:cur={k === frame}>{f.kz}</li>{/each}
        </ol>
        {#if frame < step.frames.length - 1}<button class="btn primary" onclick={nextFrame}>Келесі қадам ↓</button>{/if}
      {:else if step.type === 'quiz'}
        <Bit text={quizPick === null ? 'Қалай ойлайсың?' : quizPick === step.answer ? 'Дұрыс! ' + step.why : 'Жақын, бірақ: ' + step.why} mood={quizPick === null ? 'think' : quizPick === step.answer ? 'happy' : 'think'} compact />
        <p class="q">{step.kz}</p>
        <div class="choices">
          {#each step.choices as c, k}
            <button class="choice" class:right={quizPick !== null && k === step.answer} class:wrong={quizPick === k && k !== step.answer} disabled={quizPick !== null} onclick={() => pickQuiz(k)}>{c}</button>
          {/each}
        </div>
      {/if}
      <div class="actions">
        {#if showSkip && !ready}<button class="btn ghost" onclick={() => (ready = true)}>Өткізіп жіберу</button>{/if}
        <button bind:this={nextBtn} class="btn primary big" disabled={!ready} onclick={next}>{i < steps.length - 1 ? 'Келесі →' : 'Жаттығуға!'}</button>
      </div>
    </section>
  {/key}
</div>

<style>
  .wrap { min-height: 100dvh; width: min(760px, 100%); margin: 0 auto; display: flex; flex-direction: column; gap: 12px; padding: calc(env(safe-area-inset-top, 0px) + 12px) 16px calc(env(safe-area-inset-bottom, 0px) + 16px); }
  .top { display: flex; align-items: center; gap: 12px; padding: 8px 12px; }
  .btn.small { min-height: 40px; padding: 6px 12px; }
  .title { flex: 1; display: grid; }
  .title b { font-size: 18px; font-weight: 800; }
  .title small { color: var(--dim); }
  .dots { display: flex; gap: 4px; }
  .dots i { width: 12px; height: 12px; background: #070a1a; border: 1px solid var(--line-hi); }
  .dots i.on { background: var(--code); }
  .card { display: grid; gap: 16px; padding: 18px; }
  .widget { background: var(--deep); border: 1px solid var(--line); padding: 16px 8px; border-radius: 8px; }
  .h { font-size: 22px; color: var(--code); }
  .frames { margin: 0; padding-left: 22px; display: grid; gap: 10px; font-size: 18px; font-weight: 700; line-height: 1.5; }
  .frames li { opacity: .65; }
  .frames li.cur { opacity: 1; }
  .frames li.cur::marker { color: var(--gold); }
  .q { font-size: 20px; font-weight: 800; }
  .choices { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 140px), 1fr)); gap: 8px; }
  .choice { font: 800 18px var(--txt); color: var(--ink); background: var(--deep); border: 2px solid var(--line); border-bottom-width: 5px; border-radius: 8px; padding: 12px; cursor: pointer; }
  .choice.right { border-color: var(--ok); background: var(--ok-deep); }
  .choice.wrong { border-color: var(--miss); background: var(--miss-deep); }
  .actions { display: flex; justify-content: flex-end; gap: 8px; flex-wrap: wrap; }
</style>
