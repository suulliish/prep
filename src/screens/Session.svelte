<script lang="ts">
  import { onMount, tick } from 'svelte';
  import Bit from '../ui/Bit.svelte';
  import { game, go, persist, skillDefs } from '../lib/store.svelte';
  import { W } from '../lib/world.svelte';
  import { ensurePlan, completeBlock, dayRec } from '../lib/session.svelte';
  import { makeItem, mistakeText, skillTitle, type Item } from '../engine/items';
  import { bankFor, bankToItem } from '../engine/bank';
  import { recordAttempt, isDone } from '../engine/progress';
  import { isHonest, addMasteryBonus, settleDay } from '../engine/planner';
  import { audio } from '../lib/audio';
  import { currentWorld } from '../lib/look';
  import { react } from '../lib/voice';
  // @ts-ignore
  import { LESSONS } from '../../content/lessons.mjs';
  // шпаргалка «Есте сақта» из урока темы — вернуться к правилу после ошибки
  const ruleOf = (id: string) => ((LESSONS as Record<string, any[]>)[id] ?? []).find(s => s.type === 'rule') as { lines: string[] } | undefined;
  import { sparksAt, floatText, centerOf, flash, sceneCenter } from '../ui/fx.svelte';

  type Block = 'warmup' | 'new' | 'mixed' | 'extra' | 'boss' | 'repair';
  let { block }: { block: Block } = $props();

  const plan = ensurePlan();
  const pb = plan.blocks.find(b => b.id === block);
  const battle = true; // каждая практика — бой; у новой темы музыка «фокус»

  function extraSkills(): string[] {
    const st = game.save.skills;
    const learning = skillDefs.filter(d => st[d.id]?.status === 'learning' && d.templates.length).map(d => d.id);
    const weak = skillDefs.filter(d => isDone(st[d.id]) && d.templates.length)
      .sort((a, b) => Object.values(st[b.id].misconceptions).reduce((s, n) => s + n, 0) - Object.values(st[a.id].misconceptions).reduce((s, n) => s + n, 0))
      .map(d => d.id);
    return [...new Set([...learning, ...weak])].slice(0, 5);
  }
  const broken = game.save.repairShop.filter(r => !r.fixed);
  // Босс мира: вперемешку по всему пройденному (чередование), нужно 7 верных из 10
  const bossSkills = () => [...skillDefs.filter(d => isDone(game.save.skills[d.id]) && d.templates.length).map(d => d.id)].sort(() => Math.random() - 0.5).slice(0, 8);
  const BOSS_HP = 7;
  const skills = block === 'boss' ? bossSkills() : block === 'extra' ? extraSkills() : block === 'repair' ? [...new Set(broken.map(r => r.skill))].slice(0, 5) : pb?.skills ?? [];
  const total = block === 'boss' ? 10 : block === 'extra' ? 8 : block === 'repair' ? Math.min(8, broken.length + 1) : pb?.items ?? 8;
  const TITLE: Record<Block, string> = { warmup: 'Глитч-мобтар шабуылы', new: 'Жаңа миссия', mixed: 'Аралас шайқас', extra: 'Қосымша тапсырма', boss: `Босс: ${currentWorld().kz}`, repair: 'Шеберхана: жөндеу' };

  let idx = $state(0);
  let item = $state<Item | null>(null);
  let picked = $state<number | null>(null);
  let phase = $state<'answer' | 'confidence' | 'feedback'>('answer');
  let hintLevel = $state(0);
  let lastCorrect = $state(false);
  let combo = $state(0);
  let honestAll = $state(true);
  let answered = 0, guessed = 0; // ответы быстрее 5 с без подсказок = угадывание
  let twin = $state(false);
  let showSol = $state(false);
  let bitText = $state('');
  let bitMood = $state<'idle' | 'happy' | 'wow' | 'think' | 'sad'>('idle');
  let mobHp = $state(block === 'boss' ? BOSS_HP : total);
  const hpMax = block === 'boss' ? BOSS_HP : total;
  let startAt = 0;
  let cardEl: HTMLElement;
  let choiceEls: HTMLElement[] = $state([]);

  // Настоящие задачи экзамена (банк «Дарын»): только по пройденным темам, сначала невиданные.
  // Босс — 3 из 10, смешанный бой и доп. миссия — 2; урок новой темы и разминка — только генераторы.
  const BANK_SLOTS: Partial<Record<Block, number[]>> = { boss: [2, 5, 8], mixed: [2, 5], extra: [3, 6] };
  const seen = new Set(game.save.attempts.map(a => a.source));
  const bankQueue = BANK_SLOTS[block] ? bankFor(id => isDone(game.save.skills[id]), seen) : [];
  function nextItem() {
    const sk = block === 'new' ? skills[0] : skills[idx % Math.max(1, skills.length)];
    const fromBank = !twin && BANK_SLOTS[block]?.includes(idx) && bankQueue.length ? bankQueue.shift() : null;
    item = fromBank ? bankToItem(fromBank) : makeItem(sk);
    picked = null; phase = 'answer'; hintLevel = 0; showSol = false;
    bitText = twin ? 'Реванш! Дәл осындай есеп — енді өзің шығарып көр.' : ''; bitMood = twin ? 'think' : 'idle';
    startAt = performance.now();
  }

  onMount(() => {
    if (!skills.length) { go({ name: 'hub' }); return; }
    W.dim = false;
    W.world?.setMode('battle'); W.world?.spawnMob(mobHp, currentWorld().mob);
    if (block === 'boss') setTimeout(() => react('boss'), 600);
    audio.setMood(block === 'new' ? 'focus' : 'battle');
    nextItem();
    const onKey = (e: KeyboardEvent) => {
      if (phase === 'answer' && /^[1-5]$/.test(e.key)) pick(+e.key - 1);
      else if (phase === 'confidence' && ['1', '2', '3'].includes(e.key)) confirm((['sure', 'maybe', 'unsure'] as const)[+e.key - 1]);
      else if (phase === 'feedback' && e.key === 'Enter') next();
    };
    addEventListener('keydown', onKey);
    return () => { removeEventListener('keydown', onKey); W.world?.clearMob(); };
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
    answered++;
    if (!honest && hintLevel < 4) { honestAll = false; guessed++; }
    const events = recordAttempt(game.save, {
      at: Date.now(), day: game.day, skill: item.skill, source: item.source, correct, confidence,
      hintLevel, honest, timeMs: Math.round(timeMs), tag: item.choices[picked].tag, mode: block === 'new' ? 'practice' : block === 'extra' ? 'extra' : block === 'boss' ? 'boss' : block === 'warmup' ? 'warmup' : block === 'repair' ? 'practice' : 'mixed',
    });
    lastCorrect = correct; phase = 'feedback';
    await tick();
    const at = centerOf(choiceEls[picked]);
    if (correct) {
      combo++;
      const xp = hintLevel >= 4 ? 0 : hintLevel > 0 ? 4 : 10 + Math.min(combo - 1, 5) * 2;
      game.save.xp += xp;
      audio.play(combo >= 3 ? 'crit' : 'correct'); if (combo > 1) audio.play('combo', { combo });
      if (combo === 3 || combo === 6) react('combo'); else react('correct', 0.4);
      sparksAt(at.x, at.y, ['#5ce39c', '#3ff0ff', '#ffc94a'], combo >= 3 ? 50 : 26);
      if (xp) floatText(`+${xp} XP`, at.x, at.y - 20, '#ffc94a', combo >= 3);
      if (combo >= 3) floatText(`КОМБО ×${combo}`, sceneCenter(0.25).x, sceneCenter(0.25).y, '#3ff0ff', true);
      bitText = hintLevel ? 'Дұрыс! Кеңеспен болса да — жақсы.' : combo >= 3 ? 'Керемет серия!' : 'Дұрыс!';
      bitMood = combo >= 3 ? 'wow' : 'happy';
      if (battle) { mobHp--; W.world?.heroAttack(combo >= 3); }
      if (block === 'repair' && hintLevel === 0) { const r = game.save.repairShop.find(x => !x.fixed && x.skill === item!.skill); if (r) { r.fixed = true; floatText('ЖӨНДЕЛДІ', at.x, at.y - 50, '#5ce39c'); } }
      if (confidence === 'unsure') bitText += ' Білмеймін дедің, бірақ таптың — демек, түсінік бар.';
    } else {
      combo = 0;
      game.save.xp += 2;
      audio.play('wrong'); flash('#ff9a6b'); react('wrong', 0.6);
      cardEl?.classList.remove('shake'); void cardEl?.offsetWidth; cardEl?.classList.add('shake');
      const m = mistakeText(item.choices[picked].tag);
      bitText = m.kz; bitMood = 'think';
      if (confidence === 'sure') bitText = 'Сенімді едің, бірақ қателік бар — дәл осы жерді түсінейік. ' + m.kz;
      if (block !== 'repair') game.save.repairShop.push({ source: item.source, skill: item.skill, tag: item.choices[picked].tag, addedDay: game.day });
    }
    for (const ev of events) {
      if (ev === 'learned') { react('learned'); audio.play('levelup'); floatText('ҮЙРЕНДІ!', sceneCenter(0.3).x, sceneCenter(0.3).y, '#3ff0ff', true); sparksAt(sceneCenter(0.3).x, sceneCenter(0.3).y, ['#3ff0ff', '#b58cff'], 70, 10); W.world?.celebrate(); bitText = `«${skillTitle(item.skill).kz}» — үйрендің! Ертең тексереміз: өтсең, кристалға айналады.`; bitMood = 'wow'; }
      if (ev === 'crystal') { react('crystal'); audio.play('crystal'); floatText('КРИСТАЛЛ!', sceneCenter(0.3).x, sceneCenter(0.3).y, '#b58cff', true); sparksAt(sceneCenter(0.3).x, sceneCenter(0.3).y, ['#b58cff', '#ffffff', '#3ff0ff'], 90, 11); bitText = `«${skillTitle(item.skill).kz}» кристалға айналды — енді бұл тақырып сенікі!`; bitMood = 'wow'; }
      if (ev === 'learned' || ev === 'crystal') {
        const rec = dayRec(), add = addMasteryBonus(rec, `${ev === 'crystal' ? 'Проверка через день пройдена' : 'Тема освоена'}: ${skillTitle(item.skill).ru}`);
        if (add) {
          settleDay(rec, plan, game.save.settings.extraTo);
          setTimeout(() => { audio.play('chest'); floatText(`СЫЙЛЫҚ +${add} мин`, sceneCenter(0.42).x, sceneCenter(0.42).y, '#ffc94a', true); }, 1200);
          bitText += ` Сыйлық: +${add} минут ойын!`;
        }
      }
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

  // Босс не даёт минут (они — за план), зато открывает путь в следующий мир
  async function finishBoss() {
    const won = mobHp <= 0, w = currentWorld();
    if (won && W.world) {
      await W.world.killMob(); audio.play('chest'); await W.world.openChest(); W.world.celebrate(0xffc94a); audio.play('levelup');
      if (!game.save.worldsCleared?.includes(w.id)) (game.save.worldsCleared ??= []).push(w.id);
      game.save.xp += 50; persist();
      floatText('БОСС ЖЕҢІЛДІ!', sceneCenter(0.3).x, sceneCenter(0.3).y, '#ffc94a', true);
      bitText = `«${w.kz}» босы жеңілді! +50 XP. Келесі әлемге портал ашылуға дайын — картаны қара.`; bitMood = 'wow';
    } else {
      await W.world?.killMob();
      bitText = 'Босс шегінді, бірақ жеңілген жоқ. Қателерді шеберханада жөнде де, ертең қайта кел!'; bitMood = 'think';
    }
    phase = 'feedback'; item = null; persist();
    setTimeout(() => go({ name: 'map' }), 3200);
  }

  async function finish() {
    if (block === 'boss') return finishBoss();
    const b = block;
    // план дня засчитывается только за честную работу: если больше 30% ответов — наугад, блок не засчитан
    if (['warmup', 'new', 'mixed'].includes(block) && answered >= 3 && guessed / answered > 0.3) {
      bitText = 'Көп жауап тым жылдам берілді (5 секундтан аз) — бұл кездейсоқ таңдауға ұқсайды. Блок есептелмеді: асықпай қайта өт, ойлануға уақыт жеткілікті!'; bitMood = 'sad';
      phase = 'feedback'; item = null; persist(); setTimeout(() => go({ name: 'hub' }), 4500); return;
    }
    if (block === 'extra' && !honestAll) {
      bitText = 'Кейбір жауаптар тым жылдам (кездейсоқ) болды — бұл тапсырма есептелмеді. Келесіде асықпа!'; bitMood = 'sad';
      phase = 'feedback'; item = null; setTimeout(() => go({ name: 'hub' }), 3500); return;
    }
    if (block !== 'repair') completeBlock(b as any); else persist();
    if (battle && W.world) {
      if (mobHp <= 0 || block !== 'warmup') { await W.world.killMob(); audio.play('chest'); await W.world.openChest(); }
      else { await W.world.killMob(); }
    }
    const rec = dayRec();
    audio.play(block === 'extra' ? 'energy' : 'mission');
    if (block !== 'repair') floatText(block === 'extra' ? '+15 мин' : `${rec.minutesToday} мин`, sceneCenter(0.4).x, sceneCenter(0.4).y, '#ffc94a', true);
    go({ name: 'hub' });
  }

  const letters = 'ABCDE';
</script>

<div class="stage">
  <div class="top panel pe">
    <div class="row1">
      <button class="btn ghost small" onclick={() => go({ name: 'hub' })} aria-label="Артқа">←</button>
      <div class="title">
        <b>{TITLE[block]}</b>
        {#if item}<small>{skillTitle(item.skill).kz}</small>{/if}
      </div>
      {#if combo >= 2}<span class="combo num">×{combo}</span>{/if}
    </div>
    <div class="row2">
      <span class="tag">ГЛИТЧ</span>
      <div class="hpbar" aria-label="Мобтың күші"><i style="width:{Math.max(0, mobHp / hpMax) * 100}%"></i></div>
      <span class="cnt num">{Math.min(idx + 1, total)}/{total}</span>
    </div>
  </div>

  <div class="stage-gap grow passthrough"></div>

  {#if item}
    <section class="card panel" bind:this={cardEl}>
      <p class="q">{#each item.kz.split('\n') as line, i}{#if i}<br />{/if}<span class:formula={i > 0}>{line}</span>{/each}</p>
      {#if item.real}<span class="real">★ НАҒЫЗ ЕМТИХАН ЕСЕБІ · {item.source.startsWith('daryn') ? `«Дарын» ${item.source.slice(5, 9)}` : 'Bolashak'}</span>{/if}
      {#if item.figure?.svg}<div class="fig">{@html item.figure.svg}</div>
      {:else if item.figure?.src}<div class="fig paper"><img src={import.meta.env.BASE_URL + item.figure.src} alt="Есептің суреті" /></div>{/if}

      <div class="choices" class:long={item.choices.some(c => c.text.length > 6)} class:xlong={item.choices.some(c => c.text.length > 18)} class:numeric={item.choices.every(c => /^[\d\s,.:−\-+/()·²³]+(\s?[а-яa-z°%²³]{1,4})?$/i.test(c.text))}>
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
        {@const rule = ruleOf(item.skill)}
        {#if rule}
          <details class="sol rule">
            <summary>Ережені еске түсір (сабақтан)</summary>
            {#each rule.lines as l}<p>★ {l}</p>{/each}
          </details>
        {/if}
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
  .top { display: grid; gap: 8px; padding: 8px 12px 10px; }
  .row1, .row2 { display: flex; align-items: center; gap: 10px; }
  .tag { font: 800 11px var(--txt); letter-spacing: .1em; color: var(--void); background: var(--glitch); padding: 2px 6px; border-radius: 3px; }
  .cnt { font-size: 14px; color: var(--dim); }
  .btn.small { min-height: 40px; padding: 6px 12px; }
  .title { flex: 1; display: grid; min-width: 0; }
  .title b { font-size: 18px; font-weight: 800; }
  .title small { color: var(--dim); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .hpbar { flex: 1; height: 14px; box-shadow: 0 0 10px #ff4fb844; background: #1b0b1f; border: 2px solid #5c1d45; }
  .hpbar i { display: block; height: 100%; background: linear-gradient(90deg, var(--glitch), #ff9ad6); transition: width .4s var(--ease-out); }
  .combo { font-family: var(--px); font-weight: 400; font-size: 20px; color: var(--gold); text-shadow: 0 0 10px #ffc94a88; }
  .card { display: grid; gap: 14px; padding: 18px; }
  .q { font-size: 20px; line-height: 1.5; font-weight: 700; }
  .formula { display: inline-block; margin-top: 6px; font-size: 22px; letter-spacing: .02em; color: #e6f7ff; }
  .fig { color: var(--ink); display: grid; place-items: center; }
  .fig :global(svg) { width: min(100%, 420px); height: auto; max-height: 300px; }
  .fig.paper { background: #f6f3ea; border-radius: 10px; padding: 10px; }
  .fig.paper img { max-width: 100%; max-height: 300px; display: block; }
  .real { justify-self: start; font: 800 12px var(--txt); letter-spacing: .06em; color: var(--void); background: var(--gold); padding: 3px 10px; border-radius: 4px; box-shadow: 0 0 12px #ffc94a66; }
  .choices { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 96px), 1fr)); gap: 8px; }
  .choices.long { grid-template-columns: repeat(auto-fit, minmax(min(100%, 150px), 1fr)); }
  .choices.long .choice { font-size: 17px; }
  .choices.numeric .ct { white-space: nowrap; }
  .choices.xlong { grid-template-columns: 1fr !important; }
  .choices.xlong .ct { overflow-wrap: anywhere; }
  @media (min-width: 1000px) and (min-aspect-ratio: 23/20) { .choices.long { grid-template-columns: 1fr 1fr; } }
  .choice { display: flex; align-items: center; gap: 10px; text-align: left; font: 800 18px/1.25 var(--txt); color: var(--ink); background: var(--deep); border: 2px solid var(--line); border-bottom-width: 5px; border-radius: var(--r); padding: 12px; cursor: pointer; min-height: 56px; transition: transform .08s, border-color .15s, background .2s; }
  .choice:hover:not(:disabled) { border-color: var(--line-hi); }
  .choice:active:not(:disabled) { transform: translateY(2px); }
  .choice:focus-visible { outline: 3px solid var(--gold); outline-offset: 2px; }
  .choice.picked { border-color: var(--code); background: #0f3a4a; }
  .choice.right { border-color: var(--ok); background: var(--ok-deep); animation: pop-in .3s var(--ease-out); }
  .choice.wrong { border-color: var(--miss); background: var(--miss-deep); }
  .choice:disabled { cursor: default; }
  .lt { flex: none; width: 26px; height: 26px; display: grid; place-items: center; font-size: 14px; background: var(--panel-hi); border: 1px solid var(--line-hi); color: var(--dim); }
  .ct { overflow-wrap: break-word; hyphens: manual; }
  .conf { display: grid; gap: 8px; }
  .cbtns { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
  .cbtns .btn { padding: 10px 8px; font-size: var(--fs-s); }
  .sol { background: var(--deep); border: 1px dashed var(--line-hi); padding: 10px 12px; border-radius: 6px; }
  .sol summary { cursor: pointer; font-weight: 800; color: var(--code); }
  .sol p { margin-top: 8px; line-height: 1.6; }
  .sol.rule { border-color: var(--gold-deep); } .sol.rule summary { color: var(--gold); }
  .actions { display: flex; justify-content: flex-end; gap: 8px; }
  @media (max-width: 480px) { .q { font-size: 18px; } .formula { font-size: 19px; } }
</style>
