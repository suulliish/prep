<script lang="ts">
  import { onMount, tick } from 'svelte';
  import Bit from '../ui/Bit.svelte';
  import { game, go, persist, skillDefs } from '../lib/store.svelte';
  import { W } from '../lib/world.svelte';
  import { ensurePlan, completeBlock, dayRec } from '../lib/session.svelte';
  import { makeItem, mistakeText, skillTitle, type Item } from '../engine/items';
  import { recordAttempt, isDone } from '../engine/progress';
  import { isHonest } from '../engine/planner';
  import { audio } from '../lib/audio';
  import { sparksAt, floatText, centerOf, flash } from '../ui/fx.svelte';

  type Block = 'warmup' | 'new' | 'mixed' | 'extra' | 'boss';
  let { block }: { block: Block } = $props();

  const plan = ensurePlan();
  const pb = plan.blocks.find(b => b.id === block);
  const battle = block !== 'new';

  function extraSkills(): string[] {
    const st = game.save.skills;
    const learning = skillDefs.filter(d => st[d.id]?.status === 'learning' && d.templates.length).map(d => d.id);
    const weak = skillDefs.filter(d => isDone(st[d.id]) && d.templates.length)
      .sort((a, b) => Object.values(st[b.id].misconceptions).reduce((s, n) => s + n, 0) - Object.values(st[a.id].misconceptions).reduce((s, n) => s + n, 0))
      .map(d => d.id);
    return [...new Set([...learning, ...weak])].slice(0, 5);
  }
  const skills = block === 'extra' ? extraSkills() : pb?.skills ?? [];
  const total = block === 'extra' ? 8 : pb?.items ?? 8;
  const TITLE: Record<Block, string> = { warmup: 'Глитч-мобтар шабуылы', new: 'Жаңа миссия', mixed: 'Аралас шайқас', extra: 'Қосымша тапсырма', boss: 'Босс' };

  let idx = $state(0);
  let item = $state<Item | null>(null);
  let picked = $state<number | null>(null);
  let phase = $state<'answer' | 'confidence' | 'feedback'>('answer');
  let hintLevel = $state(0);
  let lastCorrect = $state(false);
  let combo = $state(0);
  let honestAll = $state(true);
  let twin = $state(false);
  let showSol = $state(false);
  let bitText = $state('');
  let bitMood = $state<'idle' | 'happy' | 'wow' | 'think' | 'sad'>('idle');
  let mobHp = $state(total);
  let startAt = 0;
  let cardEl: HTMLElement;
  let choiceEls: HTMLElement[] = $state([]);

  function nextItem() {
    const sk = block === 'new' ? skills[0] : skills[idx % Math.max(1, skills.length)];
    item = makeItem(sk);
    picked = null; phase = 'answer'; hintLevel = 0; showSol = false;
    bitText = twin ? 'Реванш! Дәл осындай есеп — енді өзің шығарып көр.' : ''; bitMood = twin ? 'think' : 'idle';
    startAt = performance.now();
  }

  onMount(() => {
    if (!skills.length) { go({ name: 'hub' }); return; }
    W.dim = !battle;
    if (battle) { W.world?.setMode('battle'); W.world?.spawnMob(total, idx % 3); audio.setMood('battle'); }
    else audio.setMood('focus');
    nextItem();
    const onKey = (e: KeyboardEvent) => {
      if (phase === 'answer' && /^[1-5]$/.test(e.key)) pick(+e.key - 1);
      else if (phase === 'confidence' && ['1', '2', '3'].includes(e.key)) confirm((['sure', 'maybe', 'unsure'] as const)[+e.key - 1]);
      else if (phase === 'feedback' && e.key === 'Enter') next();
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  });

  function pick(i: number) { if (phase === 'feedback') return; picked = i; phase = 'confidence'; audio.play('click'); }

  function hint() {
    if (phase === 'feedback' || !item) return;
    hintLevel = Math.min(4, hintLevel + 1);
    audio.play('hint');
    if (hintLevel === 4) { showSol = true; bitText = 'Толық шешуі төменде. Бұл есеп есептелмейді — келесіде реванш аласың.'; bitMood = 'think'; }
    else { bitText = item.hints[hintLevel - 1]?.kz ?? ''; bitMood = 'think'; }
  }

  async function confirm(confidence: 'sure' | 'maybe' | 'unsure') {
    if (!item || picked === null) return;
    const timeMs = performance.now() - startAt;
    const correct = picked === item.answer;
    const honest = isHonest(timeMs, hintLevel);
    if (!honest && hintLevel < 4) honestAll = false;
    const events = recordAttempt(game.save, {
      at: Date.now(), day: game.day, skill: item.skill, source: item.source, correct, confidence,
      hintLevel, honest, timeMs: Math.round(timeMs), tag: item.choices[picked].tag, mode: block === 'new' ? 'practice' : block === 'extra' ? 'extra' : block === 'boss' ? 'boss' : block === 'warmup' ? 'warmup' : 'mixed',
    });
    lastCorrect = correct; phase = 'feedback';
    await tick();
    const at = centerOf(choiceEls[picked]);
    if (correct) {
      combo++;
      const xp = hintLevel >= 4 ? 0 : hintLevel > 0 ? 4 : 10 + Math.min(combo - 1, 5) * 2;
      game.save.xp += xp;
      audio.play(combo >= 3 ? 'crit' : 'correct'); if (combo > 1) audio.play('combo', { combo });
      sparksAt(at.x, at.y, ['#5ce39c', '#3ff0ff', '#ffc94a'], combo >= 3 ? 50 : 26);
      if (xp) floatText(`+${xp} XP`, at.x, at.y - 20, '#ffc94a', combo >= 3);
      if (combo >= 3) floatText(`КОМБО ×${combo}`, innerWidth / 2, innerHeight * 0.25, '#3ff0ff', true);
      bitText = hintLevel ? 'Дұрыс! Кеңеспен болса да — жақсы.' : combo >= 3 ? 'Керемет серия!' : 'Дұрыс!';
      bitMood = combo >= 3 ? 'wow' : 'happy';
      if (battle) { mobHp--; W.world?.heroAttack(combo >= 3); }
      if (confidence === 'unsure') bitText += ' Білмеймін дедің, бірақ таптың — демек, түсінік бар.';
    } else {
      combo = 0;
      game.save.xp += 2;
      audio.play('wrong'); flash('#ff9a6b');
      cardEl?.classList.remove('shake'); void cardEl?.offsetWidth; cardEl?.classList.add('shake');
      const m = mistakeText(item.choices[picked].tag);
      bitText = m.kz; bitMood = 'think';
      if (confidence === 'sure') bitText = 'Сенімді едің, бірақ қателік бар — дәл осы жерді түсінейік. ' + m.kz;
      game.save.repairShop.push({ source: item.source, skill: item.skill, tag: item.choices[picked].tag, addedDay: game.day });
    }
    for (const ev of events) {
      if (ev === 'learned') { audio.play('levelup'); floatText('ҮЙРЕНДІ!', innerWidth / 2, innerHeight * 0.3, '#3ff0ff', true); sparksAt(innerWidth / 2, innerHeight * 0.3, ['#3ff0ff', '#b58cff'], 70, 10); W.world?.celebrate(); bitText = `«${skillTitle(item.skill).kz}» — үйрендің! Ертең тексереміз: өтсең, кристалға айналады.`; bitMood = 'wow'; }
      if (ev === 'crystal') { audio.play('crystal'); floatText('КРИСТАЛЛ!', innerWidth / 2, innerHeight * 0.3, '#b58cff', true); sparksAt(innerWidth / 2, innerHeight * 0.3, ['#b58cff', '#ffffff', '#3ff0ff'], 90, 11); bitText = `«${skillTitle(item.skill).kz}» кристалға айналды — енді бұл тақырып сенікі!`; bitMood = 'wow'; }
      if (ev === 'review_failed') { bitText = 'Бұл тақырып сәл ұмытылған екен — қайта жаттығамыз, қорқынышты емес.'; bitMood = 'think'; }
    }
    twin = hintLevel >= 4;
    persist();
  }

  async function next() {
    if (!twin) idx++;
    const learnedNow = block === 'new' && game.save.skills[skills[0]]?.status === 'learned' && idx >= 6;
    if (idx >= total || learnedNow) return finish();
    nextItem();
  }

  async function finish() {
    const b = block === 'boss' ? 'mixed' : block;
    if (block === 'extra' && !honestAll) {
      bitText = 'Кейбір жауаптар тым жылдам (кездейсоқ) болды — бұл тапсырма есептелмеді. Келесіде асықпа!'; bitMood = 'sad';
      phase = 'feedback'; item = null; setTimeout(() => go({ name: 'hub' }), 3500); return;
    }
    completeBlock(b as any);
    if (battle && W.world) {
      if (mobHp <= 0 || block !== 'warmup') { await W.world.killMob(); audio.play('chest'); await W.world.openChest(); }
      else { await W.world.killMob(); }
    }
    const rec = dayRec();
    audio.play(block === 'extra' ? 'energy' : 'mission');
    floatText(block === 'extra' ? '+15 мин' : `${rec.minutesToday} мин`, innerWidth / 2, innerHeight * 0.4, '#ffc94a', true);
    go({ name: 'hub' });
  }

  const letters = 'ABCDE';
</script>

<div class="wrap" class:battle>
  <div class="top panel pe">
    <button class="btn ghost small" onclick={() => go({ name: 'hub' })} aria-label="Артқа">←</button>
    <div class="title">
      <b>{TITLE[block]}</b>
      {#if item}<small>{skillTitle(item.skill).kz}</small>{/if}
    </div>
    <div class="segs" aria-label="Прогресс">
      {#each Array(total) as _, i}<i class:on={i < idx} class:cur={i === idx}></i>{/each}
    </div>
  </div>

  {#if battle}
    <div class="mobhp pe" aria-label="Мобтың күші">
      <span class="label">ГЛИТЧ</span>
      <div class="hpbar"><i style="width:{Math.max(0, mobHp / total) * 100}%"></i></div>
      {#if combo >= 2}<span class="combo num">×{combo}</span>{/if}
    </div>
  {/if}

  <div class="spacer passthrough"></div>

  {#if item}
    <section class="card panel" bind:this={cardEl}>
      <p class="q">{#each item.kz.split('\n') as line, i}{#if i}<br />{/if}<span class:formula={i > 0}>{line}</span>{/each}</p>
      {#if item.figure?.svg}<div class="fig">{@html item.figure.svg}</div>{/if}

      <div class="choices">
        {#each item.choices as c, i}
          <button bind:this={choiceEls[i]} class="choice"
            class:picked={picked === i}
            class:right={phase === 'feedback' && i === item.answer}
            class:wrong={phase === 'feedback' && picked === i && i !== item.answer}
            disabled={phase === 'feedback'} onclick={() => pick(i)}>
            <span class="lt num">{letters[i]}</span><span class="ct">{c.text}</span>
          </button>
        {/each}
      </div>

      {#if phase === 'confidence'}
        <div class="conf appear">
          <span class="label">ҚАНШАЛЫҚТЫ СЕНІМДІСІҢ?</span>
          <div class="cbtns">
            <button class="btn ok" onclick={() => confirm('sure')}>Сенімдімін</button>
            <button class="btn" onclick={() => confirm('maybe')}>Шамамен</button>
            <button class="btn ghost" onclick={() => confirm('unsure')}>Білмеймін</button>
          </div>
        </div>
      {/if}

      {#if bitText}<div class="bitline appear"><Bit text={bitText} mood={bitMood} compact /></div>{/if}

      {#if showSol || (phase === 'feedback' && !lastCorrect)}
        <details class="sol" open={showSol}>
          <summary>Шешуі</summary>
          <p>{item.sol.kz}</p>
        </details>
      {/if}

      <div class="actions">
        {#if phase !== 'feedback'}
          <button class="btn ghost" onclick={hint} disabled={hintLevel >= 4}>Бит сканері {hintLevel ? `${hintLevel}/4` : ''}</button>
        {:else}
          <button class="btn primary big" onclick={next}>{idx + (twin ? 0 : 1) >= total ? 'Аяқтау' : twin ? 'Реванш →' : 'Келесі →'}</button>
        {/if}
      </div>
    </section>
  {:else if bitText}
    <section class="card panel"><Bit text={bitText} mood={bitMood} /></section>
  {/if}
</div>

<style>
  .wrap { min-height: 100dvh; display: flex; flex-direction: column; gap: 10px; padding: calc(env(safe-area-inset-top, 0px) + 12px) 16px calc(env(safe-area-inset-bottom, 0px) + 16px); width: min(760px, 100%); margin: 0 auto; }
  .wrap:not(.battle) .spacer { flex: 0 0 8px; }
  .spacer { flex: 1; min-height: 12vh; }
  .top { display: flex; align-items: center; gap: 12px; padding: 8px 12px; }
  .btn.small { min-height: 40px; padding: 6px 12px; }
  .title { flex: 1; display: grid; min-width: 0; }
  .title b { font-size: 18px; font-weight: 800; }
  .title small { color: var(--dim); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .segs { display: flex; gap: 3px; }
  .segs i { width: 10px; height: 14px; background: #070a1a; border: 1px solid var(--line); }
  .segs i.on { background: var(--code); border-color: var(--code); }
  .segs i.cur { border-color: var(--gold); }
  .mobhp { display: flex; align-items: center; gap: 10px; align-self: center; width: min(420px, 100%); }
  .hpbar { flex: 1; height: 14px; background: #1b0b1f; border: 2px solid #5c1d45; }
  .hpbar i { display: block; height: 100%; background: linear-gradient(90deg, var(--glitch), #ff9ad6); transition: width .4s var(--ease-out); }
  .combo { font-family: var(--px); font-weight: 400; font-size: 20px; color: var(--gold); text-shadow: 0 0 10px #ffc94a88; }
  .card { display: grid; gap: 14px; padding: 18px; }
  .q { font-size: 20px; line-height: 1.5; font-weight: 700; }
  .formula { display: inline-block; margin-top: 6px; font-size: 22px; letter-spacing: .02em; color: #e6f7ff; }
  .fig { color: var(--ink); display: grid; place-items: center; }
  .choices { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 130px), 1fr)); gap: 8px; }
  .choice { display: flex; align-items: center; gap: 10px; text-align: left; font: 800 18px/1.25 var(--txt); color: var(--ink); background: var(--deep); border: 2px solid var(--line); border-bottom-width: 5px; border-radius: var(--r); padding: 12px; cursor: pointer; min-height: 56px; transition: transform .08s, border-color .15s, background .2s; }
  .choice:hover:not(:disabled) { border-color: var(--line-hi); }
  .choice:active:not(:disabled) { transform: translateY(2px); }
  .choice:focus-visible { outline: 3px solid var(--gold); outline-offset: 2px; }
  .choice.picked { border-color: var(--code); background: #0f3a4a; }
  .choice.right { border-color: var(--ok); background: var(--ok-deep); animation: pop-in .3s var(--ease-out); }
  .choice.wrong { border-color: var(--miss); background: var(--miss-deep); }
  .choice:disabled { cursor: default; }
  .lt { flex: none; width: 26px; height: 26px; display: grid; place-items: center; font-size: 14px; background: var(--panel-hi); border: 1px solid var(--line-hi); color: var(--dim); }
  .ct { overflow-wrap: anywhere; }
  .conf { display: grid; gap: 8px; }
  .cbtns { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
  .cbtns .btn { padding: 10px 8px; font-size: var(--fs-s); }
  .sol { background: var(--deep); border: 1px dashed var(--line-hi); padding: 10px 12px; border-radius: 6px; }
  .sol summary { cursor: pointer; font-weight: 800; color: var(--code); }
  .sol p { margin-top: 8px; line-height: 1.6; }
  .actions { display: flex; justify-content: flex-end; gap: 8px; }
  @media (max-width: 480px) { .q { font-size: 18px; } .formula { font-size: 19px; } .segs i { width: 7px; } }
</style>
