<script lang="ts">
  // Урок-миссия (docs/ARCHITECTURE.md 4.6): Мақсат → Қолмен → Болжа → Көр → Өзің → Неге? →
  // Глитчтің қатесі → Мини-ойын → Есте сақта → возврат к цели. Шаги описаны в content/lessons*.mjs.
  import { onMount } from 'svelte';
  import Bit from '../ui/Bit.svelte';
  import { game, go, persist } from '../lib/store.svelte';
  import { W } from '../lib/world.svelte';
  import { skillTitle } from '../engine/items';
  import { blankSkill } from '../engine/progress';
  import { audio } from '../lib/audio';
  import { sparksAt, centerOf, floatText } from '../ui/fx.svelte';
  // @ts-ignore
  import { LESSONS } from '../../content/lessons.mjs';
  import VOICED from '../../content/voice_lessons.json';
  import MathLine from '../lesson/MathLine.svelte';
  import Faded from '../lesson/Faded.svelte';
  import BugHunt from '../lesson/BugHunt.svelte';
  import Blitz from '../lesson/Blitz.svelte';
  import DivideGame from '../widgets/DivideGame.svelte';
  import FactorTree from '../widgets/FactorTree.svelte';
  import OrderOps from '../widgets/OrderOps.svelte';
  import PlaceValue from '../widgets/PlaceValue.svelte';
  import PowerBlocks from '../widgets/PowerBlocks.svelte';
  import CommonFactors from '../widgets/CommonFactors.svelte';
  import BusTimeline from '../widgets/BusTimeline.svelte';

  let { skill }: { skill: string } = $props();
  const WIDGETS: Record<string, any> = { DivideGame, FactorTree, OrderOps, PlaceValue, PowerBlocks, CommonFactors, BusTimeline };
  const steps: any[] = (LESSONS as Record<string, any[]>)[skill] ?? [{ type: 'say', kz: 'Бұл тақырыптың сабағы әзірленуде. Бірден жаттығуға көшейік!' }];
  const goal = steps.find(s => s.type === 'goal');
  const CHIP: Record<string, string> = {
    goal: 'Мақсат', widget: 'Қолмен', predict: 'Болжа', example: 'Көр', faded: 'Өзің', why: 'Неге?',
    bug: 'Глитчтің қатесі', blitz: 'Мини-ойын', rule: 'Есте сақта', final: 'Мақсатқа оралу', quiz: 'Қалай ойлайсың?', say: 'Бит',
  };
  const voiced = new Set<string>(VOICED as string[]);
  const voiceUrl = (k: number) => (voiced.has(`${skill}_${k}`) ? `${import.meta.env.BASE_URL}voice/lessons/${skill}_${k}.mp3` : '');

  let i = $state(0);
  let ready = $state(false);
  let frame = $state(0);
  let pick = $state<number | null>(null);
  let showSkip = $state(false);
  let earned = $state(0);
  let skipTimer: number | undefined;
  let nextBtn: HTMLElement;
  const step = $derived(steps[i]);

  function enter() {
    const s = steps[i];
    ready = ['say', 'goal', 'rule'].includes(s.type) || (s.type === 'example' && s.frames.length <= 1);
    frame = 0; pick = null; showSkip = false;
    clearTimeout(skipTimer);
    if (['widget', 'blitz'].includes(s.type)) skipTimer = window.setTimeout(() => (showSkip = true), s.type === 'blitz' ? 5000 : 25000);
  }
  onMount(() => { W.dim = true; audio.setMood('focus'); enter(); return () => clearTimeout(skipTimer); });

  function reward(xp: number, big = false) {
    ready = true;
    const c = centerOf(nextBtn);
    sparksAt(c.x, c.y - 40, ['#3ff0ff', '#5ce39c', '#ffc94a'], big ? 60 : 26);
    if (xp) { earned += xp; game.save.xp += xp; floatText(`+${xp} XP`, c.x, c.y - 60, '#ffc94a', big); persist(); }
  }
  function widgetDone() { audio.play('correct'); reward(0); }
  function nextFrame() { if (frame < step.frames.length - 1) { frame++; audio.play('click'); if (frame === step.frames.length - 1) ready = true; } }
  function choose(k: number) {
    if (pick !== null && step.type !== 'final') return;
    if (step.type === 'final' && pick === step.answer) return;
    pick = k;
    const ok = k === step.answer;
    if (step.type === 'predict') { audio.play(ok ? 'correct' : 'hint'); reward(ok ? 3 : 0); return; }
    if (step.type === 'final') {
      if (!ok) { audio.play('wrong'); return; }
      audio.play('levelup'); W.world?.celebrate(0xffc94a); reward(20, true); return;
    }
    audio.play(ok ? 'correct' : 'wrong'); reward(ok ? 5 : 0);
  }

  function next() {
    if (i < steps.length - 1) { i++; enter(); audio.play('click'); return; }
    (game.save.skills[skill] ??= blankSkill()).lessonDone = true;
    persist(); audio.play('mission');
    go({ name: 'session', block: 'new' });
  }
  const bitLine = $derived.by(() => {
    if (step.type === 'predict') return pick === null ? 'Алдымен болжап көр — қателесуден қорықпа!' : (pick === step.answer ? 'Дәл таптың! ' : 'Қызық болжам! ') + step.reveal;
    if (step.type === 'why' || step.type === 'quiz') return pick === null ? 'Қалай ойлайсың?' : pick === step.answer ? 'Дұрыс! ' + step.why : 'Жақын, бірақ: ' + step.why;
    if (step.type === 'final') return pick === null ? 'Енді бәрін білесің. Миссияны аяқта!' : pick === step.answer ? 'Миссия орындалды! ' + step.why : 'Тағы бір рет тексер: сабақта не үйрендік?';
    return '';
  });
</script>

<div class="wrap">
  <div class="top panel">
    <button class="btn ghost small" onclick={() => go({ name: 'hub' })} aria-label="Артқа">←</button>
    <div class="title"><b>{goal?.title ?? 'Жаңа миссия'}</b><small>{skillTitle(skill).kz}</small></div>
    <div class="dots">{#each steps as _, k}<i class:on={k <= i} class:gold={steps[k].type === 'final'}></i>{/each}</div>
  </div>

  {#key i}
    <section class="card panel glitch-in">
      <span class="chip c-{step.type}">{CHIP[step.type] ?? ''}</span>

      {#if step.type === 'say'}
        <Bit text={step.kz} mood="wow" voice={voiceUrl(i)} />
      {:else if step.type === 'goal'}
        <Bit text={step.kz} mood="wow" voice={voiceUrl(i)} />
        <div class="lock"><span class="pad">🔒</span><MathLine text={step.task} big /></div>
        <p class="dim">Сабақтың соңында осы есепке ораламыз.</p>
      {:else if step.type === 'widget'}
        {@const Comp = WIDGETS[step.w]}
        <Bit text={step.kz} mood="think" compact />
        <div class="widget pe"><Comp {...step.props} ondone={widgetDone} /></div>
      {:else if step.type === 'example'}
        <h2 class="h">{step.kz}</h2>
        <ol class="frames">
          {#each step.frames.slice(0, frame + 1) as f, k}
            <li class="appear" class:cur={k === frame}>
              {#if f.math}<MathLine text={f.math} big={k === frame} />{/if}
              <span>{f.kz}</span>
            </li>
          {/each}
        </ol>
        {#if frame < step.frames.length - 1}<button class="btn primary" onclick={nextFrame}>Келесі қадам ↓</button>{/if}
      {:else if step.type === 'faded'}
        <Bit text="Енді өзің! Бос орындарды толтыр." mood="think" compact />
        <Faded task={step.kz} steps={step.steps} ondone={clean => reward(clean ? 8 : 3)} />
      {:else if step.type === 'bug'}
        <Bit text={step.kz} mood="think" compact />
        <BugHunt lines={step.lines} bad={step.bad} follows={step.follows} fix={step.fix} ondone={clean => reward(clean ? 8 : 3)} />
      {:else if step.type === 'blitz'}
        <Bit text={step.kz} mood="wow" compact />
        <Blitz title={step.title} seconds={step.seconds} count={step.count} make={step.make} ondone={stars => reward(stars * 5, stars === 3)} />
      {:else if step.type === 'rule'}
        <div class="rule">
          <b>★ {step.kz}</b>
          {#each step.lines as l}<p class="appear">{l}</p>{/each}
        </div>
        <p class="dim">Бұл шпаргалка тақырып карточкасына сақталады.</p>
      {:else}
        <Bit text={bitLine} mood={pick === null ? 'think' : pick === step.answer ? 'happy' : 'think'} compact />
        {#if step.type === 'final'}<div class="lock open"><span class="pad">{pick === step.answer ? '🔓' : '🔒'}</span><span class="q">{step.kz}</span></div>
        {:else}<p class="q">{step.kz}</p>{/if}
        <div class="choices">
          {#each step.choices as c, k}
            <button class="choice" class:right={pick !== null && k === step.answer && (step.type !== 'final' || pick === k)} class:wrong={pick === k && k !== step.answer}
              disabled={step.type === 'final' ? pick === step.answer : pick !== null} onclick={() => choose(k)}>{c}</button>
          {/each}
        </div>
      {/if}

      <div class="actions">
        {#if showSkip && !ready}<button class="btn ghost" onclick={() => (ready = true)}>Өткізіп жіберу</button>{/if}
        <button bind:this={nextBtn} class="btn primary big" class:gold={step.type === 'goal'} disabled={!ready} onclick={next}>
          {step.type === 'goal' ? 'Миссияны қабылдау →' : i < steps.length - 1 ? 'Келесі →' : `Жаттығуға!${earned ? ` (+${earned} XP)` : ''}`}
        </button>
      </div>
    </section>
  {/key}
</div>

<style>
  .wrap { min-height: 100dvh; width: min(760px, 100%); margin: 0 auto; display: flex; flex-direction: column; gap: 12px; padding: calc(env(safe-area-inset-top, 0px) + 12px) 16px calc(env(safe-area-inset-bottom, 0px) + 16px); }
  .top { display: flex; align-items: center; gap: 12px; padding: 8px 12px; }
  .btn.small { min-height: 40px; padding: 6px 12px; }
  .title { flex: 1; display: grid; min-width: 0; }
  .title b { font-size: 18px; font-weight: 800; }
  .title small { color: var(--dim); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .dots { display: flex; gap: 3px; flex-wrap: wrap; max-width: 40%; justify-content: flex-end; }
  .dots i { width: 10px; height: 10px; background: #070a1a; border: 1px solid var(--line-hi); }
  .dots i.on { background: var(--code); }
  .dots i.gold { border-color: var(--gold); }
  .dots i.gold.on { background: var(--gold); }
  .card { display: grid; gap: 16px; padding: 18px; }
  .chip { justify-self: start; font: 800 13px var(--txt); letter-spacing: .08em; text-transform: uppercase; color: var(--void); background: var(--code); padding: 3px 10px; border-radius: 4px; }
  .chip.c-goal, .chip.c-final { background: var(--gold); }
  .chip.c-bug { background: var(--glitch); }
  .chip.c-blitz { background: var(--ok); }
  .chip.c-why, .chip.c-predict { background: var(--crystal); }
  .widget { background: var(--deep); border: 1px solid var(--line); padding: 16px 8px; border-radius: 8px; }
  .h { font-size: 22px; color: var(--code); }
  .frames { margin: 0; padding-left: 22px; display: grid; gap: 12px; font-size: 18px; font-weight: 700; line-height: 1.5; }
  .frames li { opacity: .55; display: grid; gap: 4px; }
  .frames li.cur { opacity: 1; }
  .frames li.cur::marker { color: var(--gold); }
  .lock { display: flex; align-items: center; gap: 12px; background: var(--deep); border: 2px dashed var(--gold-deep); border-radius: 10px; padding: 14px; }
  .lock.open { border-style: solid; border-color: var(--gold); }
  .lock .pad { font-size: 28px; }
  .dim { color: var(--dim); font-weight: 700; }
  .rule { display: grid; gap: 8px; background: linear-gradient(135deg, #1a1f4a, #0d1030); border: 2px solid var(--gold); border-radius: 10px; padding: 16px; box-shadow: 0 0 24px #ffc94a33; }
  .rule b { color: var(--gold); font-size: 20px; }
  .rule p { font-size: 18px; font-weight: 800; }
  .q { font-size: 20px; font-weight: 800; }
  .choices { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 140px), 1fr)); gap: 8px; }
  .choice { font: 800 18px var(--txt); color: var(--ink); background: var(--deep); border: 2px solid var(--line); border-bottom-width: 5px; border-radius: 8px; padding: 12px; cursor: pointer; }
  .choice.right { border-color: var(--ok); background: var(--ok-deep); }
  .choice.wrong { border-color: var(--miss); background: var(--miss-deep); }
  .actions { display: flex; justify-content: flex-end; gap: 8px; flex-wrap: wrap; }
</style>
