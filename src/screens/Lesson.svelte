<script lang="ts">
  // Урок-миссия (docs/ARCHITECTURE.md 4.6) как бой: вирус Глитча сломал систему корабля, каждый пройденный шаг —
  // удар по нему в 3D. Мақсат → Қолмен → Болжа → Көр (анимированная сцена) → Өзің → Неге? → Глитчтің қатесі →
  // Мини-ойын → Есте сақта → возврат к цели (вирус уничтожен, сундук).
  import { onMount } from 'svelte';
  import Bit from '../ui/Bit.svelte';
  import { game, go, persist } from '../lib/store.svelte';
  import { W } from '../lib/world.svelte';
  import { skillTitle } from '../engine/items';
  import { blankSkill } from '../engine/progress';
  import { audio } from '../lib/audio';
  import { currentWorld } from '../lib/look';
  import { react } from '../lib/voice';
  import { sparksAt, centerOf, floatText, flash, sceneCenter } from '../ui/fx.svelte';
  // @ts-ignore
  import { LESSONS } from '../../content/lessons.mjs';
  import VOICED from '../../content/voice_lessons.json';
  import MathLine from '../lesson/MathLine.svelte';
  import Faded from '../lesson/Faded.svelte';
  import BugHunt from '../lesson/BugHunt.svelte';
  import Blitz from '../lesson/Blitz.svelte';
  import Scene from '../lesson/Scene.svelte';
  import GlitchSays from '../lesson/GlitchSays.svelte';
  import MissionBar from '../lesson/MissionBar.svelte';
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
  const target = goal?.title ?? skillTitle(skill).kz;
  const CHIP: Record<string, string> = {
    goal: 'Мақсат', widget: 'Қолмен', predict: 'Болжа', example: 'Көр', faded: 'Өзің', why: 'Неге?',
    bug: 'Глитчтің қатесі', blitz: 'Мини-ойын', rule: 'Есте сақта', final: 'Соңғы соққы', quiz: 'Қалай ойлайсың?', say: 'Бит',
  };
  // Шаги-«удары»: всё, где ребёнок что-то делает сам
  const EXPLAIN = ['widget', 'example', 'faded', 'why', 'bug', 'predict', 'rule'];
  const HIT = (t: string) => !['goal', 'rule', 'say'].includes(t);
  const maxHp = Math.max(1, steps.filter(s => HIT(s.type)).length);
  const voiced = new Set<string>(VOICED as string[]);
  const voiceUrl = (k: number) => (voiced.has(`${skill}_${k}`) ? `${import.meta.env.BASE_URL}voice/lessons/${skill}_${k}.mp3` : '');

  let i = $state(0);
  let ready = $state(false);
  let frame = $state(0);
  let pick = $state<number | null>(null);
  let showSkip = $state(false);
  let earned = $state(0);
  let hp = $state(maxHp);
  let bugFound = $state(false);
  let won = $state(false);
  let skipTimer: number | undefined;
  let nextBtn = $state<HTMLElement>();
  let cardEl = $state<HTMLElement>();
  const step = $derived(steps[i]);
  const fr = $derived(step.type === 'example' ? step.frames[frame] : null);

  function enter() {
    const s = steps[i];
    ready = ['say', 'goal', 'rule'].includes(s.type) || (s.type === 'example' && s.frames.length <= 1);
    frame = 0; pick = null; showSkip = false; bugFound = false;
    clearTimeout(skipTimer);
    if (s.type === 'faded') setTimeout(() => react('self'), 400);
    if (s.type === 'bug') setTimeout(() => react('bug'), 400);
    if (s.type === 'why') setTimeout(() => react('think'), 400);
    if (['widget', 'blitz'].includes(s.type)) skipTimer = window.setTimeout(() => (showSkip = true), s.type === 'blitz' ? 5000 : 25000);
    // на телефоне карточка ниже сцены — прокручиваем к ней
    requestAnimationFrame(() => { if (i > 0 && cardEl && cardEl.getBoundingClientRect().top > innerHeight * 0.6) cardEl.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
  }
  onMount(() => {
    W.dim = false; W.world?.setMode('battle'); W.world?.spawnMob(maxHp, currentWorld().mob); W.world?.bitMood('idle');
    audio.setMood('focus'); enter();
    return () => { clearTimeout(skipTimer); W.world?.clearMob(); };
  });

  function strike(crit = false) {
    if (hp <= 0) return;
    hp--; W.world?.heroAttack(crit);
    const c = cardEl ? centerOf(cardEl) : { x: innerWidth / 2, y: innerHeight / 3 };
    floatText(crit ? 'КРИТ!' : '−1', c.x, Math.max(80, c.y - 160), crit ? '#ffc94a' : '#ff4fb8', crit);
  }
  function reward(xp: number, big = false) {
    ready = true;
    if (!nextBtn) return;
    const c = centerOf(nextBtn);
    sparksAt(c.x, c.y - 40, ['#3ff0ff', '#5ce39c', '#ffc94a'], big ? 60 : 26);
    if (xp) { earned += xp; game.save.xp += xp; floatText(`+${xp} XP`, c.x, c.y - 60, '#ffc94a', big); persist(); }
  }
  function widgetDone() { audio.play('correct'); reward(0); }
  function go2(k: number) { if (k < 0 || k >= step.frames.length) return; frame = k; audio.play('click'); if (frame === step.frames.length - 1) ready = true; }
  async function choose(k: number) {
    if (pick !== null && step.type !== 'final') return;
    if (step.type === 'final' && won) return;
    pick = k;
    const ok = k === step.answer;
    if (step.type === 'predict') { audio.play(ok ? 'correct' : 'hint'); if (ok) react('correct'); reward(ok ? 3 : 0); return; }
    if (step.type === 'final') {
      if (!ok) { audio.play('wrong'); flash('#ff9a6b'); cardEl?.classList.remove('shake'); void cardEl?.offsetWidth; cardEl?.classList.add('shake'); return; }
      won = true; hp = 0; audio.play('crit'); react('win');
      W.world?.heroAttack(true);
      await W.world?.killMob();
      audio.play('chest'); W.world?.openChest(); W.world?.celebrate(0xffc94a); W.world?.bitMood('happy');
      audio.play('levelup'); floatText('ЖЕҢІС!', sceneCenter(0.28).x, sceneCenter(0.28).y, '#ffc94a', true);
      sparksAt(sceneCenter(0.3).x, sceneCenter(0.3).y, ['#ffc94a', '#3ff0ff', '#b58cff'], 90, 10);
      reward(20, true); return;
    }
    audio.play(ok ? 'correct' : 'wrong'); react(ok ? 'correct' : 'wrong'); reward(ok ? 5 : 0);
  }

  function next() {
    if (HIT(step.type) && step.type !== 'final') strike(step.type === 'blitz');
    if (i < steps.length - 1) { i++; enter(); audio.play('click'); return; }
    (game.save.skills[skill] ??= blankSkill()).lessonDone = true;
    persist(); audio.play('mission');
    go({ name: 'session', block: 'new' });
  }
  const bitLine = $derived.by(() => {
    if (step.type === 'predict') return pick === null ? `${game.save.heroName}, алдымен болжап көр — қателесуден қорықпа!` : (pick === step.answer ? 'Дәл таптың! ' : 'Қызық болжам! ') + step.reveal;
    if (step.type === 'why' || step.type === 'quiz') return pick === null ? 'Қалай ойлайсың?' : pick === step.answer ? 'Дұрыс! ' + step.why : 'Жақын, бірақ: ' + step.why;
    if (step.type === 'final') return !won ? (pick === null ? 'Вирус әлсіреді! Соңғы соққы — дұрыс жауап.' : 'Вирус қарсыласып жатыр! Сабақта не үйрендік? Тағы тексер.') : `Жеңіс, ${game.save.heroName}! ` + step.why;
    return '';
  });
</script>

<div class="stage lesson">
  <div class="top panel">
    <div class="row1">
      <button class="btn ghost small" onclick={() => go({ name: 'hub' })} aria-label="Артқа">←</button>
      <div class="title"><b>{target}</b><small>{skillTitle(skill).kz}</small></div>
      {#if earned}<span class="xp num">+{earned} XP</span>{/if}
    </div>
    <MissionBar types={steps.map(s => s.type)} at={i} {hp} max={maxHp} {target} />
  </div>
  <!-- на шагах-объяснениях сцена боя — узкая полоска: больше места под тему -->
  <div class="stage-gap passthrough" class:slim={EXPLAIN.includes(step.type)}></div>

  {#key i}
    <section class="card panel glitch-in" class:final={step.type === 'final'} class:bugcard={step.type === 'bug'} bind:this={cardEl}>
      <span class="chip c-{step.type}">{CHIP[step.type] ?? ''}</span>

      {#if step.type === 'say'}
        <Bit text={step.kz} mood="wow" voice={voiceUrl(i)} />
      {:else if step.type === 'goal'}
        {#if step.scene}<Scene name={step.scene} s={step.s} />{/if}
        <Bit text={step.kz} mood="wow" voice={voiceUrl(i)} />
        <div class="lock"><span class="pad" aria-hidden="true">🔒</span><MathLine text={step.task} big /></div>
      {:else if step.type === 'widget'}
        {@const Comp = WIDGETS[step.w]}
        <Bit text={step.kz} mood="think" compact />
        <div class="widget pe"><Comp {...step.props} ondone={widgetDone} /></div>
      {:else if step.type === 'example'}
        <h2 class="h">{step.kz}</h2>
        {#if step.scene || fr.scene}
          {#key frame}
            <Scene name={fr.scene ?? step.scene} s={fr.s} />
            {#if fr.math}<div class="mline appear"><MathLine text={fr.math} big /></div>{/if}
            <div class="cap appear"><Bit text={fr.kz} mood="think" compact /></div>
          {/key}
          <div class="fnav">
            <button class="btn ghost small" disabled={frame === 0} onclick={() => go2(frame - 1)} aria-label="Алдыңғы">←</button>
            <div class="fdots">{#each step.frames as _, k}<button class:on={k === frame} class:seen={k < frame} onclick={() => k <= frame && go2(k)} aria-label="Қадам {k + 1}"></button>{/each}</div>
            <button class="btn primary small" disabled={frame >= step.frames.length - 1} onclick={() => go2(frame + 1)}>Келесі қадам →</button>
          </div>
        {:else}
          <ol class="frames">
            {#each step.frames.slice(0, frame + 1) as f, k}
              <li class="appear" class:cur={k === frame}>{#if f.math}<MathLine text={f.math} big={k === frame} />{/if}<span>{f.kz}</span></li>
            {/each}
          </ol>
          {#if frame < step.frames.length - 1}<button class="btn primary" onclick={() => go2(frame + 1)}>Келесі қадам ↓</button>{/if}
        {/if}
      {:else if step.type === 'faded'}
        <Bit text="Енді өзің! Бұзылған модульдерді жөнде." mood="think" compact />
        <Faded task={step.kz} steps={step.steps} ondone={clean => reward(clean ? 8 : 3)} />
      {:else if step.type === 'bug'}
        <GlitchSays text={step.kz} beaten={bugFound} />
        <BugHunt lines={step.lines} bad={step.bad} follows={step.follows} fix={step.fix} ondone={clean => { bugFound = true; W.world?.heroAttack(clean); reward(clean ? 8 : 3); }} />
      {:else if step.type === 'blitz'}
        <Bit text={step.kz} mood="wow" compact />
        <Blitz title={step.title} count={step.count} make={step.make} onhit={crit => W.world?.heroAttack(crit)} ondone={stars => reward(stars * 5, stars === 3)} />
      {:else if step.type === 'rule'}
        <div class="rule">
          <b>★ {step.kz}</b>
          {#each step.lines as l, k}<p class="appear" style="animation-delay:{k * 120}ms">{l}</p>{/each}
        </div>
        <p class="dim">Шпаргалка тақырып карточкасына сақталды — Альбомда ашылады.</p>
      {:else}
        {#if step.type === 'final' && step.scene}<Scene name={step.scene} s={won ? step.s : goal?.s ?? step.s} />{/if}
        <Bit text={bitLine} mood={pick === null ? 'think' : pick === step.answer ? 'happy' : 'think'} compact />
        {#if step.type === 'final'}<div class="lock" class:open={won}><span class="pad" aria-hidden="true">{won ? '🔓' : '🔒'}</span><span class="q">{step.kz}</span></div>
        {:else}<p class="q">{step.kz}</p>{/if}
        <div class="choices">
          {#each step.choices as c, k}
            <button class="choice" class:right={pick !== null && k === step.answer && (step.type !== 'final' || won)} class:wrong={pick === k && k !== step.answer}
              disabled={step.type === 'final' ? won : pick !== null} onclick={() => choose(k)}>{c}</button>
          {/each}
        </div>
      {/if}

      <div class="actions">
        {#if showSkip && !ready}<button class="btn ghost" onclick={() => (ready = true)}>Өткізіп жіберу</button>{/if}
        <button bind:this={nextBtn} class="btn primary big" class:gold={step.type === 'goal' || won} disabled={!ready} onclick={next}>
          {step.type === 'goal' ? 'Миссияны қабылдау →' : i < steps.length - 1 ? (HIT(step.type) ? 'Соққы беру →' : 'Келесі →') : `Жаттығуға!${earned ? ` (+${earned} XP)` : ''}`}
        </button>
      </div>
    </section>
  {/key}
</div>

<style>
  .top { display: grid; gap: 8px; padding: 8px 12px 10px; }
  .row1 { display: flex; align-items: center; gap: 12px; }
  .stage-gap.slim { flex-basis: clamp(40px, 7vh, 80px); }
  .btn.small { min-height: 40px; padding: 6px 12px; font-size: var(--fs-s); }
  .title { flex: 1; display: grid; min-width: 0; }
  .title b { font-size: 18px; font-weight: 800; }
  .title small { color: var(--dim); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .xp { color: var(--gold); font-size: 16px; }
  .card { display: grid; gap: 14px; padding: 16px; scroll-margin-top: 12px; }
  .card.final { border-color: var(--gold); box-shadow: 0 0 30px #ffc94a33, var(--shadow); }
  .card.bugcard { border-color: #7a2a63; background: linear-gradient(#1f0f2e, #141b3f); }
  .chip { justify-self: start; font: 800 12px var(--txt); letter-spacing: .08em; text-transform: uppercase; color: var(--void); background: var(--code); padding: 3px 10px; border-radius: 4px; }
  .chip.c-goal, .chip.c-final { background: var(--gold); }
  .chip.c-bug { background: var(--glitch); }
  .chip.c-blitz { background: var(--ok); }
  .chip.c-why, .chip.c-predict { background: var(--crystal); }
  .widget { background: var(--deep); border: 1px solid var(--line); padding: 16px 8px; border-radius: 10px; }
  .h { font-size: 20px; color: var(--code); }
  .mline { display: flex; justify-content: center; padding: 4px 0; }
  .fnav { display: flex; align-items: center; gap: 8px; }
  .fdots { flex: 1; display: flex; justify-content: center; gap: 6px; }
  .fdots button { width: 12px; height: 12px; padding: 0; border-radius: 50%; border: 2px solid var(--line-hi); background: #070a1a; cursor: pointer; }
  .fdots button.seen { background: var(--code-deep); border-color: var(--code); }
  .fdots button.on { background: var(--code); border-color: #b9fdff; box-shadow: 0 0 8px var(--code); transform: scale(1.25); }
  .frames { margin: 0; padding-left: 22px; display: grid; gap: 12px; font-size: 18px; font-weight: 700; line-height: 1.5; }
  .frames li { opacity: .55; display: grid; gap: 4px; }
  .frames li.cur { opacity: 1; }
  .lock { display: flex; align-items: center; gap: 12px; background: var(--deep); border: 2px dashed var(--gold-deep); border-radius: 10px; padding: 12px 14px; }
  .lock.open { border-style: solid; border-color: var(--gold); box-shadow: 0 0 20px #ffc94a44; }
  .lock .pad { font-size: 26px; }
  .dim { color: var(--dim); font-weight: 700; font-size: var(--fs-s); }
  .rule { display: grid; gap: 8px; background: linear-gradient(135deg, #2a2350, #0d1030); border: 2px solid var(--gold); border-radius: 12px; padding: 16px; box-shadow: 0 0 24px #ffc94a33; animation: card-flip .6s var(--ease-out); }
  .rule b { color: var(--gold); font-size: 20px; }
  .rule p { font-size: 18px; font-weight: 800; }
  .q { font-size: 20px; font-weight: 800; }
  .choices { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 150px), 1fr)); gap: 8px; }
  .choice { font: 800 18px/1.25 var(--txt); color: var(--ink); background: var(--deep); border: 2px solid var(--line); border-bottom-width: 5px; border-radius: 8px; padding: 12px; cursor: pointer; transition: transform .08s, border-color .15s; }
  .choice:hover:not(:disabled) { border-color: var(--line-hi); transform: translateY(-1px); }
  .choice.right { border-color: var(--ok); background: var(--ok-deep); animation: pop-in .3s var(--ease-out); }
  .choice.wrong { border-color: var(--miss); background: var(--miss-deep); animation: shake .35s; }
  .actions { display: flex; justify-content: flex-end; gap: 8px; flex-wrap: wrap; }
  @keyframes card-flip { from { transform: perspective(600px) rotateY(80deg); opacity: 0; } }
  @media (max-width: 480px) { .card { padding: 14px 12px; } .h { font-size: 18px; } .q { font-size: 18px; } .actions .btn.big { width: 100%; } }
</style>
