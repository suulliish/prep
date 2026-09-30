<script lang="ts">
  // Урок-миссия (docs/ARCHITECTURE.md 4.6) как бой: вирус Глитча сломал систему корабля, каждый пройденный шаг —
  // удар по нему в 3D. Мақсат → Қолмен → Болжа → Көр (анимированная сцена) → Өзің → Неге? → Глитчтің қатесі →
  // Шағын ойын → Есте сақта → возврат к цели (вирус уничтожен, сундук).
  import { onMount, tick } from 'svelte';
  import Bit from '../ui/Bit.svelte';
  import Screen from '../ui/Screen.svelte';
  import Icon from '../ui/Icon.svelte';
  import Confirm from '../ui/Confirm.svelte';
  import { toast } from '../ui/notify.svelte';
  import { ReadGate, readMs } from '../lib/readgate.svelte';
  import { game, go, persist } from '../lib/store.svelte';
  import { W } from '../lib/world.svelte';
  import { skillTitle } from '../engine/items';
  import { blankSkill } from '../engine/progress';
  import { audio } from '../lib/audio';
  import { currentWorld } from '../lib/look';
  import { SPOT_KZ } from '../three/spots';
  import { react } from '../lib/voice';
  import { sparksAt, centerOf, floatText, flash, sceneCenter } from '../ui/fx.svelte';
  // @ts-ignore
  import { LESSONS } from '../../content/lessons.mjs';
  import VOICED from '../../content/voice_lessons.json';
  import MathLine from '../lesson/MathLine.svelte';
  import Gap from '../lesson/Gap.svelte';
  import { planGaps, maskText } from '../lesson/gap';
  import { hasHighlight } from '../lesson/rich';
  import { fitZoom } from '../lesson/fit';
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
  import FractionCircle from '../widgets/FractionCircle.svelte';
  import FractionBar from '../widgets/FractionBar.svelte';
  import NumberLine from '../widgets/NumberLine.svelte';
  import FillOne from '../widgets/FillOne.svelte';
  import Scales from '../widgets/Scales.svelte';
  import ZeroCounter from '../widgets/ZeroCounter.svelte';
  import FracArea from '../widgets/FracArea.svelte';

  // replay — пересмотр из альбома: без XP и без перехода к практике
  let { skill, replay = false }: { skill: string; replay?: boolean } = $props();
  // FractionCircle и FillOne подгоняют себя сами (пицца и мост по высоте); остальные виджеты сжимаются целиком не сильнее 0.8
  const SELF_FIT = ['FractionCircle', 'FillOne'];
  const WIDGETS: Record<string, any> = { DivideGame, FactorTree, OrderOps, PlaceValue, PowerBlocks, CommonFactors, BusTimeline, MultipleHunt, StarPicker, SetSort, FractionCircle, FractionBar, NumberLine, FillOne, Scales, ZeroCounter, FracArea };
  const steps: any[] = (LESSONS as Record<string, any[]>)[skill] ?? [{ type: 'say', kz: 'Бұл тақырыптың сабағы әзірленуде. Бірден жаттығуға көшейік!' }];
  const goal = steps.find(s => s.type === 'goal');
  const target = goal?.title ?? skillTitle(skill).kz;
  const CHIP: Record<string, string> = {
    goal: 'Мақсат', widget: 'Қолмен', predict: 'Болжа', example: 'Көр', faded: 'Өзің', why: 'Неге?',
    bug: 'Глитчтің қатесі', blitz: 'Шағын ойын', rule: 'Есте сақта', final: 'Соңғы соққы', quiz: 'Қалай ойлайсың?', say: 'Бит',
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
  // объяснения нельзя пролистать вслепую: «дальше» заряжается на время чтения (GAME_LOOP.md 10)
  const gate = new ReadGate();
  let cine = $state(true);   // катсцена входа и победы — панель урока скрыта
  let blitzPhase = $state<'ready' | 'play' | 'over'>('ready');
  // Горизонталь и широкий экран (как в Screen.svelte): сцена слева, реплика Бита поверх неё, панель узкая и низкая
  const LAND = '(min-width: 1000px) and (min-aspect-ratio: 23/20), (max-width: 999.98px) and (max-height: 560px) and (min-aspect-ratio: 23/20)';
  let land = $state(false);
  // D11: пропуски в «Көр» и «Есте сақта» (автоматически, отключается флагом noGap на кадре или шаге)
  const gaps = $derived(planGaps(skill, i, step));
  let solved = $state<Record<string, boolean>>({});
  const curGap = $derived(step.type === 'example' ? gaps?.frames?.[frame] ?? null : step.type === 'rule' ? gaps?.rule?.gap ?? null : null);
  const gapKey = $derived(`${i}:${frame}`);
  const gapOpen = $derived(!!curGap && !solved[gapKey]);
  const frameText = (s: any, k: number) => [s.frames[k]?.math, s.frames[k]?.kz].join(' ');
  const fr = $derived(step.type === 'example' ? step.frames[frame] : null);

  function enter() {
    const s = steps[i];
    ready = ['say', 'goal', 'rule'].includes(s.type) || (s.type === 'example' && s.frames.length <= 1);
    frame = 0; pick = null; showSkip = false; bugFound = false;
    clearTimeout(skipTimer); gate.stop();
    if (s.type === 'say') gate.start(readMs(s.kz));
    if (s.type === 'rule') gate.start(readMs(s.kz, ...s.lines));
    if (s.type === 'example') gate.start(readMs(s.kz, frameText(s, 0)));
    if (s.type === 'faded') setTimeout(() => react('self'), 400);
    if (s.type === 'bug') setTimeout(() => react('bug'), 400);
    if (s.type === 'why') setTimeout(() => react('think'), 400);
    if (['widget', 'blitz'].includes(s.type)) skipTimer = window.setTimeout(() => (showSkip = true), s.type === 'blitz' ? 5000 : 25000);
    requestAnimationFrame(() => cardEl?.closest('.body')?.scrollTo({ top: 0 }));
  }
  onMount(() => {
    const mq = matchMedia(LAND); land = mq.matches;
    const onLand = (e: MediaQueryListEvent) => (land = e.matches); mq.addEventListener('change', onLand);
    W.dim = false; W.world?.setMode('battle'); W.world?.bitMood('idle');
    const v = W.world?.setSpot(skill);   // урок и практика темы — в одном уголке мира
    if (v !== undefined) setTimeout(() => { const c = sceneCenter(0.3); floatText(`${currentWorld().kz} · ${SPOT_KZ[v]}`, c.x, c.y, '#ffc94a', true); }, 400);
    (W.world?.arrive() ?? Promise.resolve()).then(() => W.world?.spawnMob(maxHp, currentWorld().mob)).then(() => (cine = false));
    audio.setMood('focus'); enter();
    return () => { clearTimeout(skipTimer); W.world?.clearMob(); mq.removeEventListener('change', onLand); };
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
  function go2(k: number) { if (k < 0 || k >= step.frames.length) return; const fresh = k > frame; frame = k; audio.play('click'); if (fresh) gate.start(readMs(frameText(step, k))); if (frame === step.frames.length - 1) ready = true; }
  async function choose(k: number) {
    if (pick !== null && step.type !== 'final') return;
    if (step.type === 'final' && won) return;
    pick = k;
    const ok = k === step.answer;
    if (step.type === 'predict') { audio.play(ok ? 'correct' : 'hint'); if (ok) react('correct'); reward(ok ? 3 : 0); gate.start(readMs(step.reveal)); showChoices(); return; }
    if (step.type === 'final') {
      if (!ok) { audio.play('wrong'); flash('#ff9a6b'); W.world?.enemyAttack(); cardEl?.classList.remove('shake'); void cardEl?.offsetWidth; cardEl?.classList.add('shake'); return; }
      won = true; hp = 0; audio.play('crit'); react('win');
      await W.world?.heroAttack(true);
      cine = true;
      await W.world?.killMob();
      audio.play('chest'); await W.world?.openChest(); W.world?.bitMood('happy');
      cine = false;
      audio.play('levelup'); floatText('ЖЕҢІС!', sceneCenter(0.28).x, sceneCenter(0.28).y, '#ffc94a', true);
      sparksAt(sceneCenter(0.3).x, sceneCenter(0.3).y, ['#ffc94a', '#3ff0ff', '#b58cff'], 90, 10);
      reward(20, true); return;
    }
    audio.play(ok ? 'correct' : 'wrong'); react(ok ? 'correct' : 'wrong'); reward(ok ? 5 : 0);
    if (step.why) gate.start(readMs(step.why));
    if (!ok) W.world?.enemyAttack();
    showChoices();
  }
  // после ответа появляется разбор: варианты и кнопка должны остаться в поле зрения
  const showChoices = () => tick().then(() => setTimeout(() => cardEl?.querySelector('.choices')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 80));

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
  // D12: «прочитал» — касание подсвеченной части открывает «дальше» раньше таймера (таймер остаётся запасным)
  function readTap(e: Event) {
    if (!gate.on) return;
    gate.stop(); gate.done = true; audio.play('correct');
    const c = centerOf(e.currentTarget as HTMLElement); sparksAt(c.x, c.y, ['#ffc94a', '#3ff0ff'], 16);
  }
  // D11: верный вариант в пропуске тоже считается «прочитал»
  function gapSolved() { solved[gapKey] = true; gate.stop(); gate.done = true; if (nextBtn) { const c = centerOf(nextBtn); sparksAt(c.x, c.y - 40, ['#5ce39c', '#ffc94a'], 18); } }
  const canTap = $derived(gate.on && !gapOpen);
  function primary() {
    if (gapOpen) { audio.play('click'); toast('Алдымен жасырылған санды тап'); return; }
    if (gate.on) { gate.nope(); audio.play('click'); toast('Алдымен оқы — батырма зарядталып жатыр'); return; }
    if (moreFrames) return go2(frame + 1);
    if (!ready) { toast(step.type === 'widget' ? 'Алдымен тапсырманы орында' : 'Алдымен жауап таңда'); audio.play('click'); return; }
    next();
  }
  function leave() { askExit = false; if (!replay) { game.save.lessonPos = { skill, step: i }; persist(); } go({ name: replay ? 'album' : 'hub' }); }
  const bit = $derived.by((): { text: string; mood: 'idle' | 'happy' | 'wow' | 'think' | 'sad'; compact: boolean; voice?: string } | null => {
    const t = step.type;
    if (t === 'say' || t === 'goal') return { text: step.kz, mood: 'wow', compact: t === 'goal', voice: voiceUrl(i) };
    if (t === 'widget') return { text: step.kz, mood: 'think', compact: true, voice: voiceUrl(i) };
    if (t === 'example') {
      if (!fr?.kz) return null;
      const hide = !!curGap?.mask && !solved[gapKey];                // подпись называет спрятанное число: до решения прячем его и не озвучиваем
      return { text: hide ? maskText(fr.kz, curGap!.answer) : fr.kz, mood: 'think', compact: true, voice: hide ? undefined : voiceUrl(`${i}_f${frame}`) };
    }
    if (t === 'faded') return { text: 'Енді өзің! Бұзылған модульдерді жөнде.', mood: 'think', compact: true };
    if (t === 'blitz') return blitzPhase === 'play' ? null : { text: step.kz, mood: 'wow', compact: true };
    if (['predict', 'why', 'quiz', 'final'].includes(t)) return { text: bitLine, mood: pick === null || pick !== step.answer ? 'think' : 'happy', compact: true };
    return null;
  });
  // окно 3D-сцены: на «читательских» шагах повыше, на шагах с заданием — низкое (задаче нужно место, DESIGN_SYSTEM 6)
  const sceneSize = $derived(step.type === 'say' ? 'short' : 'strip');
  const longChoices = $derived(['predict', 'why', 'quiz', 'final'].includes(step.type) && Math.max(...(step.choices ?? ['']).map((c: string) => c.length)) > 22);
  const bitLine = $derived.by(() => {
    if (step.type === 'predict') return pick === null ? `${game.save.heroName}, алдымен болжап көр — қателесуден қорықпа!` : (pick === step.answer ? 'Дәл таптың! ' : 'Қызық болжам! ') + step.reveal;
    if (step.type === 'why' || step.type === 'quiz') return pick === null ? 'Қалай ойлайсың?' : pick === step.answer ? 'Дұрыс! ' + step.why : 'Жақын, бірақ: ' + step.why;
    if (step.type === 'final') return !won ? (pick === null ? 'Вирус әлсіреді! Соңғы соққы — дұрыс жауап.' : 'Вирус қарсыласып жатыр! Сабақта не үйрендік? Тағы тексер.') : `Жеңіс, ${game.save.heroName}! ` + step.why;
    return '';
  });
</script>

{#snippet bitView()}
  {#if bit}<Bit text={bit.text} mood={bit.mood} compact={bit.compact} voice={bit.voice} />{/if}
{/snippet}

<Screen scene={sceneSize} cinema={cine} back={() => (askExit = true)}>
  {#snippet head()}
    <div class="hd">
      <div class="t1"><b>{target}</b>{#if earned}<span class="xp num">+{earned} XP</span>{/if}</div>
      <div class="t2"><span class="bar glitch hp" aria-label="Вирус күші"><i style="width:{(hp / maxHp) * 100}%"></i></span><span class="cnt">Қадам <b class="num">{i + 1}</b>/{steps.length}</span></div>
    </div>
  {/snippet}

  {#snippet overlay()}
    {#if land && bit}<div class="say">{#key i}{@render bitView()}{/key}</div>{/if}
  {/snippet}

  {#key i}
    <div class="card" class:final={step.type === 'final'} bind:this={cardEl}>
      {#if step.type !== 'example'}<span class="tag c-{step.type}">{CHIP[step.type] ?? ''}</span>{/if}

      {#if step.type === 'say'}
        {#if !land}{@render bitView()}{/if}
      {:else if step.type === 'goal'}
        {#if step.scene}<Scene name={step.scene} s={step.s} />{/if}
        {#if !land}{@render bitView()}{/if}
        <div class="paper lock" class:long={step.task.length > 28}><Icon name="lock" fill="var(--gold)" size={28} /><MathLine text={step.task} big={step.task.length <= 28} inherit={step.task.length > 28} /></div>
      {:else if step.type === 'widget'}
        {@const Comp = WIDGETS[step.w]}
        {#if !land}{@render bitView()}{/if}
        <div class="widget pe" use:fitZoom={{ min: SELF_FIT.includes(step.w) ? 1 : 0.8 }}><Comp {...step.props} ondone={widgetDone} /></div>
      {:else if step.type === 'example'}
        <div class="hrow"><span class="tag c-example">{CHIP.example}</span><h2 class="h"><MathLine text={step.kz.replace(/^Көр:\s*/, '')} inherit /></h2></div>
        {#if step.scene || fr.scene}
          {#key frame}
            <Scene name={fr.scene ?? step.scene} s={fr.s} />
            {#if fr.math}<div class="paper mline appear"><MathLine text={curGap ? curGap.text : fr.math} fill={curGap && solved[gapKey] ? curGap.answer : null} big ontap={canTap && hasHighlight(curGap ? curGap.text : fr.math) ? readTap : undefined} /></div>{/if}
            {#if gapOpen && curGap}<Gap options={curGap.options} answer={curGap.answer} onsolved={gapSolved} />
            {:else if fr.math && hasHighlight(fr.math) && (gate.on || gate.done)}<p class="tip" class:off={!canTap} aria-hidden={!canTap}>Сары бөлікті түртсең, батырма ашылады</p>{/if}
            {#if !land}<div class="appear">{@render bitView()}</div>{/if}
          {/key}
          <div class="fdots" aria-label="Кадр {frame + 1} / {step.frames.length}">{#each step.frames as _, k}<button class:on={k === frame} class:seen={k < frame} onclick={() => k <= frame && go2(k)} aria-label="Кадр {k + 1}"></button>{/each}</div>
        {:else}
          <ol class="paper frames">
            {#each step.frames.slice(0, frame + 1) as f, k}
              <li class="appear" class:cur={k === frame}>{#if f.math}<MathLine text={k === frame && curGap ? curGap.text : f.math} fill={k === frame && curGap && solved[gapKey] ? curGap.answer : null} big={k === frame} ontap={k === frame && canTap && hasHighlight(f.math) ? readTap : undefined} />{/if}<span><MathLine text={k === frame && curGap?.mask && !solved[gapKey] ? maskText(f.kz, curGap.answer) : f.kz} inherit /></span></li>
            {/each}
          </ol>
          {#if gapOpen && curGap}<Gap options={curGap.options} answer={curGap.answer} onsolved={gapSolved} />{/if}
        {/if}
      {:else if step.type === 'faded'}
        {#if !land}{@render bitView()}{/if}
        <div class="paper"><Faded task={step.kz} steps={step.steps} ondone={clean => reward(clean ? 8 : 3)} /></div>
      {:else if step.type === 'bug'}
        <GlitchSays text={step.kz} beaten={bugFound} />
        <div class="paper"><BugHunt lines={step.lines} bad={step.bad} follows={step.follows} fix={step.fix} ondone={clean => { bugFound = true; W.world?.heroAttack(clean); reward(clean ? 8 : 3); }} /></div>
      {:else if step.type === 'blitz'}
        {#if !land}{@render bitView()}{/if}
        <div class="paper"><Blitz title={step.title} count={step.count} make={step.make} onphase={p => (blitzPhase = p)} onhit={crit => W.world?.heroAttack(crit)} ondone={stars => reward(stars * 5, stars === 3)} /></div>
      {:else if step.type === 'rule'}
        <div class="paper rule">
          <b><Icon name="star" fill="var(--gold)" size={22} />{step.kz}</b>
          {#each step.lines as l, k}<p class="appear" style="animation-delay:{k * 120}ms"><MathLine text={gaps?.rule?.line === k ? gaps.rule.gap.text : l} fill={gaps?.rule?.line === k && solved[gapKey] ? gaps.rule.gap.answer : null} inherit /></p>{/each}
          <small>Бұл ереже Альбомдағы тақырып картасына сақталды.</small>
        </div>
        {#if gapOpen && curGap}<Gap options={curGap.options} answer={curGap.answer} onsolved={gapSolved} />{/if}
      {:else}
        {#if step.type === 'final' && step.scene}<Scene name={step.scene} s={won ? step.s : goal?.s ?? step.s} />{/if}
        {#if !land}{@render bitView()}{/if}
        <div class="paper qbox">
          {#if step.type === 'final'}<Icon name={won ? 'check' : 'lock'} fill={won ? 'var(--ok)' : 'var(--gold)'} size={24} />{/if}
          <p class="q"><MathLine text={step.kz} inherit /></p>
        </div>
        <div class="choices" class:one={longChoices}>
          {#each step.choices as c, k}
            <button class="ans" class:right={pick !== null && k === step.answer && (step.type !== 'final' || won)} class:wrong={pick === k && k !== step.answer}
              disabled={step.type === 'final' ? won : pick !== null} onclick={() => choose(k)}>
              <span class="l">{#if pick !== null && k === step.answer && (step.type !== 'final' || won)}<Icon name="check" fill="#fff" size={16} />{:else if pick === k && k !== step.answer}<Icon name="cross" fill="#fff" size={16} />{:else}{'ABCDE'[k]}{/if}</span><span class="ct"><MathLine text={c} inherit /></span>
            </button>
          {/each}
        </div>
      {/if}
    </div>
  {/key}

  {#snippet footer()}
    {#if showSkip && !ready}<button class="btn ghost" onclick={() => (ready = true)}>Өткізу</button>{/if}
    <button bind:this={nextBtn} class="btn big grow {(ready || moreFrames) && !gapOpen ? (won || step.type === 'goal' ? 'primary' : 'go') : 'wait'}" class:charging={gate.on && !gapOpen} class:charged={gate.done} style="--gate:{gate.ms}ms" onclick={primary}>
      {primaryLabel}<Icon name="chevron" fill={(ready || moreFrames) && !gapOpen ? 'var(--outline)' : '#d7dcf5'} size={20} />
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
  .widget { background: var(--deep); border: 3px solid var(--outline); padding: 10px 8px; border-radius: 16px; }
  .hrow { display: flex; align-items: center; gap: 10px; }
  .h { font-size: 19px; line-height: 1.2; text-shadow: 0 2px 0 var(--outline); min-width: 0; }
  .mline { display: flex; justify-content: center; }
  .fdots { display: flex; justify-content: center; gap: 8px; }
  .fdots button { width: 14px; height: 14px; padding: 0; border-radius: 50%; border: 2px solid var(--outline); background: #0b1030; cursor: pointer; }
  .fdots button.seen { background: var(--code-deep); }
  .fdots button.on { background: var(--code); transform: scale(1.3); }
  .frames { margin: 0; padding: 14px 16px 14px 36px; display: grid; gap: 12px; font-size: 18px; }
  .frames li { opacity: .5; display: grid; gap: 4px; }
  .frames li.cur { opacity: 1; }
  .lock, .qbox { display: flex; align-items: center; gap: 12px; }
  .lock.long { font: 800 19px/1.35 var(--disp); }
  .lock :global(.icon), .lock > :global(svg) { flex: none; }
  .rule { display: grid; gap: 8px; box-shadow: inset 0 -4px 0 #ffe38a, 0 0 0 3px var(--gold); }
  .rule b { display: flex; align-items: center; gap: 8px; font: 900 19px var(--disp); }
  .rule p { font-size: 17px; font-weight: 800; }
  .q { font-size: 19px; font-weight: 800; }
  .choices { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 140px), 1fr)); gap: 8px; }
  .choices.one { grid-template-columns: minmax(0, 1fr); }
  /* варианты закреплены внизу панели: даже если условие длинное и панель прокручивается, ответы не уезжают под кнопку */
  .choices { position: sticky; bottom: 0; z-index: 2; margin: 0 -14px; padding: 12px 14px 4px; background: linear-gradient(180deg, transparent, var(--panel-2) 12px); }
  .choices .ans { min-width: 0; min-height: 48px; padding: 6px 10px; gap: 8px; font-size: clamp(15px, 4.4vw, 19px); }
  .choices .ans .l { width: 26px; height: 26px; font-size: 14px; }
  .ct { min-width: 0; overflow-wrap: break-word; line-height: 1.2; }
  .tip { text-align: center; color: var(--dim); font: 800 var(--fs-xs) var(--txt); }
  .tip.off { visibility: hidden; }   /* место не отдаём: иначе сцена и реплика прыгают после касания */
  /* реплика Бита в горизонтали — поверх окна сцены (как в Session.svelte): панель справа остаётся под задачу */
  .say { margin-top: auto; padding: 0 4px 4px; width: min(480px, 100%); animation: pop-in .25s var(--ease-out) both; }
  .say :global(.bubble) { font-size: 14px !important; line-height: 1.35; padding: 7px 10px !important; }
  .say :global(.typed) { inset: 7px 10px !important; }   /* тот же отступ, что у невидимого «призрака» текста, иначе строка переносится иначе и вылезает из пузыря */
  .grow { flex: 1; min-width: 0; }
  /* выкладка на бумаге: подсветка и пропуски — тёмные цвета */
  .card :global(.paper .hl) { color: #7a4d00; background: #ffe38a; border-bottom-color: var(--gold-deep); }
  .card :global(.paper .blank) { color: #b0276f; background: #ffe0f1; }
  .card :global(.paper .blank.filled) { color: var(--code-deep); background: #d9f8ff; border-color: var(--code-deep); }
  .card :global(.paper li small), .card :global(.paper .note) { color: var(--paper-dim); }
  /* финальный вопрос важнее иллюстрации: на невысоком экране картинку убираем (бой виден в окне сцены сверху) */
  @media (max-height: 830px) { .card.final :global(.scene) { display: none; } }
  @media (max-height: 830px) { .card :global(.bit .bubble) { font-size: 14px; line-height: 1.35; } .lock.long { font-size: 17px; } }
  /* невысокий телефон (667): плотнее */
  @media (max-height: 720px) {
    .card { gap: 8px; }
    .card :global(.paper) { padding: 10px 12px; }
    .h { font-size: 17px; }
    .q { font-size: 17px; }
    .frames { font-size: 16px; gap: 8px; padding: 10px 12px 10px 30px; }
    .rule { gap: 6px; } .rule p { font-size: 16px; } .rule b { font-size: 17px; }
    .choices { gap: 6px; } .choices .ans { min-height: 42px; padding: 4px 8px; } .choices .ans .l { width: 24px; height: 24px; }
    .widget { padding: 6px; }
  }
  /* телефон в горизонтали: колонка справа низкая (~230 px под содержимое) */
  @media (max-width: 999.98px) and (max-height: 560px) and (min-aspect-ratio: 23/20) {
    .card { gap: 6px; }
    .card :global(.tag) { font-size: 11px; padding: 2px 8px; }
    .card :global(.paper) { padding: 6px 10px; }
    .card :global(.bit .bubble) { font-size: 14px; }
    .h { font-size: 15px; }
    .q { font-size: 16px; }
    .mline :global(.ml.big) { font-size: 22px; }
    .frames { font-size: 15px; gap: 6px; padding: 8px 10px 8px 26px; }
    .rule { gap: 4px; } .rule p { font-size: 15px; } .rule b { font-size: 16px; } .rule small { display: none; }
    .lock { gap: 8px; }
    .choices { gap: 5px; } .choices .ans { min-height: 38px; padding: 3px 8px; font-size: clamp(14px, 2.2vw, 16px); } .choices .ans .l { width: 22px; height: 22px; font-size: 12px; }
    .widget { padding: 4px; }
    .tip { font-size: 12px; }
  }
  .card :global(.paper .task) { color: var(--paper-ink); }
</style>
