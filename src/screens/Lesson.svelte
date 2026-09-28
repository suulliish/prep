<script lang="ts">
  // Урок-миссия (docs/ARCHITECTURE.md 4.6) как бой: вирус Глитча сломал систему корабля, каждый пройденный шаг —
  // удар по нему в 3D. Мақсат → Қолмен → Болжа → Көр (анимированная сцена) → Өзің → Неге? → Глитчтің қатесі →
  // Мини-ойын → Есте сақта → возврат к цели (вирус уничтожен, сундук).
  import { onMount } from 'svelte';
  import Bit from '../ui/Bit.svelte';
  import Screen from '../ui/Screen.svelte';
  import Icon from '../ui/Icon.svelte';
  import Confirm from '../ui/Confirm.svelte';
  import { toast } from '../ui/notify.svelte';
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
  import DivideGame from '../widgets/DivideGame.svelte';
  import FactorTree from '../widgets/FactorTree.svelte';
  import OrderOps from '../widgets/OrderOps.svelte';
  import PlaceValue from '../widgets/PlaceValue.svelte';
  import PowerBlocks from '../widgets/PowerBlocks.svelte';
  import CommonFactors from '../widgets/CommonFactors.svelte';
  import BusTimeline from '../widgets/BusTimeline.svelte';
  import MultipleHunt from '../widgets/MultipleHunt.svelte';
  import StarPicker from '../widgets/StarPicker.svelte';
  import SetSort from '../widgets/SetSort.svelte';

  // replay — пересмотр из альбома: без XP и без перехода к практике
  let { skill, replay = false }: { skill: string; replay?: boolean } = $props();
  const WIDGETS: Record<string, any> = { DivideGame, FactorTree, OrderOps, PlaceValue, PowerBlocks, CommonFactors, BusTimeline, MultipleHunt, StarPicker, SetSort };
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
  const voiceUrl = (k: number | string) => (voiced.has(`${skill}_${k}`) ? `${import.meta.env.BASE_URL}voice/lessons/${skill}_${k}.mp3` : '');

  // продолжить с того шага, где вышел
  let i = $state(!replay && game.save.lessonPos?.skill === skill ? Math.min(game.save.lessonPos.step, steps.length - 1) : 0);
  let askExit = $state(false);
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
    requestAnimationFrame(() => cardEl?.closest('.body')?.scrollTo({ top: 0 }));
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
    if (xp && !replay) { earned += xp; game.save.xp += xp; floatText(`+${xp} XP`, c.x, c.y - 60, '#ffc94a', big); persist(); }
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
    if (i < steps.length - 1) { i++; if (!replay) { game.save.lessonPos = { skill, step: i }; persist(); } enter(); audio.play('click'); return; }
    if (replay) { audio.play('mission'); go({ name: 'album' }); return; }
    (game.save.skills[skill] ??= blankSkill()).lessonDone = true;
    delete game.save.lessonPos;
    persist(); audio.play('mission');
    go({ name: 'session', block: 'new' });
  }
  const isExample = $derived(step.type === 'example' && step.frames.length > 1);
  const moreFrames = $derived(isExample && frame < step.frames.length - 1);
  const primaryLabel = $derived(
    moreFrames ? 'Келесі кадр' : step.type === 'goal' ? 'Миссияны бастау' : i < steps.length - 1 ? (HIT(step.type) ? 'Соққы беру' : 'Келесі')
    : replay ? 'Альбомға қайту' : 'Жаттығуға');
  function primary() {
    if (moreFrames) return go2(frame + 1);
    if (!ready) { toast(step.type === 'widget' ? 'Алдымен тапсырманы орында' : 'Алдымен жауап таңда'); audio.play('click'); return; }
    next();
  }
  function leave() { askExit = false; if (!replay) { game.save.lessonPos = { skill, step: i }; persist(); } go({ name: replay ? 'album' : 'hub' }); }
  const bitLine = $derived.by(() => {
    if (step.type === 'predict') return pick === null ? `${game.save.heroName}, алдымен болжап көр — қателесуден қорықпа!` : (pick === step.answer ? 'Дәл таптың! ' : 'Қызық болжам! ') + step.reveal;
    if (step.type === 'why' || step.type === 'quiz') return pick === null ? 'Қалай ойлайсың?' : pick === step.answer ? 'Дұрыс! ' + step.why : 'Жақын, бірақ: ' + step.why;
    if (step.type === 'final') return !won ? (pick === null ? 'Вирус әлсіреді! Соңғы соққы — дұрыс жауап.' : 'Вирус қарсыласып жатыр! Сабақта не үйрендік? Тағы тексер.') : `Жеңіс, ${game.save.heroName}! ` + step.why;
    return '';
  });
</script>

<Screen scene="short" back={() => (askExit = true)}>
  {#snippet head()}
    <div class="hd">
      <div class="t1"><b>{target}</b>{#if earned}<span class="xp num">+{earned} XP</span>{/if}</div>
      <div class="t2"><span class="bar glitch hp" aria-label="Вирус күші"><i style="width:{(hp / maxHp) * 100}%"></i></span><span class="cnt">Қадам <b class="num">{i + 1}</b>/{steps.length}</span></div>
    </div>
  {/snippet}

  {#key i}
    <div class="card" class:final={step.type === 'final'} bind:this={cardEl}>
      <span class="tag c-{step.type}">{CHIP[step.type] ?? ''}</span>

      {#if step.type === 'say'}
        <Bit text={step.kz} mood="wow" voice={voiceUrl(i)} />
      {:else if step.type === 'goal'}
        {#if step.scene}<Scene name={step.scene} s={step.s} />{/if}
        <Bit text={step.kz} mood="wow" voice={voiceUrl(i)} />
        <div class="paper lock"><Icon name="lock" fill="var(--gold)" size={28} /><MathLine text={step.task} big /></div>
      {:else if step.type === 'widget'}
        {@const Comp = WIDGETS[step.w]}
        <Bit text={step.kz} mood="think" compact voice={voiceUrl(i)} />
        <div class="widget pe"><Comp {...step.props} ondone={widgetDone} /></div>
      {:else if step.type === 'example'}
        <h2 class="h">{step.kz}</h2>
        {#if step.scene || fr.scene}
          {#key frame}
            <Scene name={fr.scene ?? step.scene} s={fr.s} />
            {#if fr.math}<div class="paper mline appear"><MathLine text={fr.math} big /></div>{/if}
            <div class="appear"><Bit text={fr.kz} mood="think" compact voice={voiceUrl(`${i}_f${frame}`)} /></div>
          {/key}
          <div class="fdots" aria-label="Кадр {frame + 1} / {step.frames.length}">{#each step.frames as _, k}<button class:on={k === frame} class:seen={k < frame} onclick={() => k <= frame && go2(k)} aria-label="Кадр {k + 1}"></button>{/each}</div>
        {:else}
          <ol class="paper frames">
            {#each step.frames.slice(0, frame + 1) as f, k}
              <li class="appear" class:cur={k === frame}>{#if f.math}<MathLine text={f.math} big={k === frame} />{/if}<span>{f.kz}</span></li>
            {/each}
          </ol>
        {/if}
      {:else if step.type === 'faded'}
        <Bit text="Енді өзің! Бұзылған модульдерді жөнде." mood="think" compact />
        <div class="paper"><Faded task={step.kz} steps={step.steps} ondone={clean => reward(clean ? 8 : 3)} /></div>
      {:else if step.type === 'bug'}
        <GlitchSays text={step.kz} beaten={bugFound} />
        <div class="paper"><BugHunt lines={step.lines} bad={step.bad} follows={step.follows} fix={step.fix} ondone={clean => { bugFound = true; W.world?.heroAttack(clean); reward(clean ? 8 : 3); }} /></div>
      {:else if step.type === 'blitz'}
        <Bit text={step.kz} mood="wow" compact />
        <div class="paper"><Blitz title={step.title} count={step.count} make={step.make} onhit={crit => W.world?.heroAttack(crit)} ondone={stars => reward(stars * 5, stars === 3)} /></div>
      {:else if step.type === 'rule'}
        <div class="paper rule">
          <b><Icon name="star" fill="var(--gold)" size={22} />{step.kz}</b>
          {#each step.lines as l, k}<p class="appear" style="animation-delay:{k * 120}ms">{l}</p>{/each}
          <small>Бұл ереже Альбомдағы тақырып картасына сақталды.</small>
        </div>
      {:else}
        {#if step.type === 'final' && step.scene}<Scene name={step.scene} s={won ? step.s : goal?.s ?? step.s} />{/if}
        <Bit text={bitLine} mood={pick === null ? 'think' : pick === step.answer ? 'happy' : 'think'} compact />
        <div class="paper qbox">
          {#if step.type === 'final'}<Icon name={won ? 'check' : 'lock'} fill={won ? 'var(--ok)' : 'var(--gold)'} size={24} />{/if}
          <p class="q">{step.kz}</p>
        </div>
        <div class="choices">
          {#each step.choices as c, k}
            <button class="ans" class:right={pick !== null && k === step.answer && (step.type !== 'final' || won)} class:wrong={pick === k && k !== step.answer}
              disabled={step.type === 'final' ? won : pick !== null} onclick={() => choose(k)}>
              <span class="l">{#if pick !== null && k === step.answer && (step.type !== 'final' || won)}<Icon name="check" fill="#fff" size={16} />{:else if pick === k && k !== step.answer}<Icon name="cross" fill="#fff" size={16} />{:else}{'ABCDE'[k]}{/if}</span><span>{c}</span>
            </button>
          {/each}
        </div>
      {/if}
    </div>
  {/key}

  {#snippet footer()}
    {#if showSkip && !ready}<button class="btn ghost" onclick={() => (ready = true)}>Өткізу</button>{/if}
    <button bind:this={nextBtn} class="btn big grow {ready || moreFrames ? (won || step.type === 'goal' ? 'primary' : 'go') : 'wait'}" onclick={primary}>
      {primaryLabel}<Icon name="chevron" fill={ready || moreFrames ? 'var(--outline)' : '#d7dcf5'} size={20} />
    </button>
  {/snippet}
</Screen>

<Confirm open={askExit} title="Миссиядан шығасың ба?" text="Қай қадамда тұрғаның сақталады — кейін осы жерден жалғастырасың."
  yes="Шығу" no="Жалғастыру" onyes={leave} onno={() => (askExit = false)} />

<style>
  .hd { flex: 1; min-width: 0; display: grid; gap: 6px; }
  .t1 { display: flex; align-items: center; gap: 8px; }
  .t1 b { flex: 1; min-width: 0; font: 900 18px var(--disp); text-shadow: 0 2px 0 var(--outline); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .xp { color: var(--gold); font-size: 15px; text-shadow: 0 2px 0 var(--outline); }
  .t2 { display: flex; align-items: center; gap: 8px; }
  .hp { flex: 1; height: 14px; }
  .cnt { font-size: 13px; color: var(--dim); white-space: nowrap; }
  .cnt b { color: var(--ink); font-size: 15px; }

  .card { display: grid; gap: 12px; animation: pop-in .3s var(--ease-out) both; }
  .tag { justify-self: start; }
  .tag.c-goal, .tag.c-final { background: var(--gold); }
  .tag.c-bug { background: var(--glitch); }
  .tag.c-blitz { background: var(--ok); }
  .tag.c-why, .tag.c-predict { background: var(--crystal); }
  .widget { background: var(--deep); border: 3px solid var(--outline); padding: 14px 8px; border-radius: 16px; }
  .h { font-size: 19px; text-shadow: 0 2px 0 var(--outline); }
  .mline { display: flex; justify-content: center; }
  .fdots { display: flex; justify-content: center; gap: 8px; }
  .fdots button { width: 14px; height: 14px; padding: 0; border-radius: 50%; border: 2px solid var(--outline); background: #0b1030; cursor: pointer; }
  .fdots button.seen { background: var(--code-deep); }
  .fdots button.on { background: var(--code); transform: scale(1.3); }
  .frames { margin: 0; padding: 14px 16px 14px 36px; display: grid; gap: 12px; font-size: 18px; }
  .frames li { opacity: .5; display: grid; gap: 4px; }
  .frames li.cur { opacity: 1; }
  .lock, .qbox { display: flex; align-items: center; gap: 12px; }
  .rule { display: grid; gap: 8px; box-shadow: inset 0 -4px 0 #ffe38a, 0 0 0 3px var(--gold); }
  .rule b { display: flex; align-items: center; gap: 8px; font: 900 19px var(--disp); }
  .rule p { font-size: 17px; font-weight: 800; }
  .q { font-size: 19px; font-weight: 800; }
  .choices { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 140px), 1fr)); gap: 8px; }
  .grow { flex: 1; min-width: 0; }
  .btn.wait { --c: #5b6699; --e: #3d4670; --t: #d7dcf5; text-shadow: none; }
  /* выкладка на бумаге: подсветка и пропуски — тёмные цвета */
  .card :global(.paper .hl) { color: #7a4d00; background: #ffe38a; border-bottom-color: var(--gold-deep); }
  .card :global(.paper .blank) { color: #b0276f; background: #ffe0f1; }
  .card :global(.paper .blank.filled) { color: var(--code-deep); background: #d9f8ff; border-color: var(--code-deep); }
  .card :global(.paper li small), .card :global(.paper .note) { color: var(--paper-dim); }
  .card :global(.paper .task) { color: var(--paper-ink); }
</style>
