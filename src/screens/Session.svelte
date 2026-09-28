<script lang="ts">
  import { onMount, tick } from 'svelte';
  import Bit from '../ui/Bit.svelte';
  import Screen from '../ui/Screen.svelte';
  import Icon from '../ui/Icon.svelte';
  import { toast } from '../ui/notify.svelte';
  import { game, go, persist, skillDefs } from '../lib/store.svelte';
  import { W } from '../lib/world.svelte';
  import { ensurePlan, completeBlock, dayRec } from '../lib/session.svelte';
  import { makeItem, mistakeText, skillTitle, type Item } from '../engine/items';
  import { bankFor, bankToItem } from '../engine/bank';
  import { recordAttempt, isDone } from '../engine/progress';
  import { isHonest, addMasteryBonus, settleDay, taught } from '../engine/planner';
  import { audio } from '../lib/audio';
  import { currentWorld } from '../lib/look';
  import { react } from '../lib/voice';
  import { askBit, HELPER_ERR, MAX_QUESTIONS, type Turn, type HelperError } from '../lib/helper';
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
    const weak = skillDefs.filter(d => isDone(st[d.id]) && d.templates.length && taught(game.save, skillDefs, d.id))
      .sort((a, b) => Object.values(st[b.id].misconceptions).reduce((s, n) => s + n, 0) - Object.values(st[a.id].misconceptions).reduce((s, n) => s + n, 0))
      .map(d => d.id);
    return [...new Set([...learning, ...weak])].slice(0, 5);
  }
  const broken = game.save.repairShop.filter(r => !r.fixed);
  // Босс мира: вперемешку по всему пройденному (чередование), нужно 7 верных из 10
  const bossSkills = () => [...skillDefs.filter(d => isDone(game.save.skills[d.id]) && d.templates.length && taught(game.save, skillDefs, d.id)).map(d => d.id)].sort(() => Math.random() - 0.5).slice(0, 8);
  const BOSS_HP = 7;
  const skills = block === 'boss' ? bossSkills() : block === 'extra' ? extraSkills() : block === 'repair' ? [...new Set(broken.map(r => r.skill))].slice(0, 5) : pb?.skills ?? [];
  const total = block === 'boss' ? 10 : block === 'extra' ? 8 : block === 'repair' ? Math.min(8, broken.length + 1) : pb?.items ?? 8;
  const TITLE: Record<Block, string> = { warmup: 'Жылыну', new: 'Жаңа миссия · жаттығу', mixed: 'Аралас шайқас', extra: 'Қосымша тапсырма', boss: `Босс: ${currentWorld().kz}`, repair: 'Шеберхана: жөндеу' };

  let idx = $state(0);
  let item = $state<Item | null>(null);
  let picked = $state<number | null>(null);
  // answer — выбор; retry — первая ошибка, можно ещё раз; feedback — итог задачи
  let phase = $state<'answer' | 'retry' | 'feedback'>('answer');
  let tries = $state(0);
  let struck = $state<number[]>([]);
  let hintLevel = $state(0);
  let lastCorrect = $state(false);
  let combo = $state(0);
  let honestAll = $state(true);
  let answered = 0, guessed = 0; // ответы быстрее 5 с без подсказок = угадывание
  let twin = $state(false);
  let showSol = $state(false);
  let bitText = $state('');
  let bitMood = $state<'idle' | 'happy' | 'wow' | 'think' | 'sad'>('idle');
  // ИИ-помощник «Түсінбедім»: только после ответа (правильный ответ уже показан)
  let aiTurns = $state<Turn[]>([]);
  let aiBusy = $state(false);
  let aiErr = $state('');
  let aiQ = $state('');
  const aiAsked = $derived(aiTurns.filter(t => t.role === 'kid').length);
  async function helpMe(question?: string) {
    if (!item || aiBusy) return;
    aiBusy = true; aiErr = '';
    const rule = ruleOf(item.skill)?.lines.join(' ');
    const mistake = picked != null && picked !== item.answer ? mistakeText(item.choices[picked].tag).kz : undefined;
    const history = $state.snapshot(aiTurns) as Turn[];
    try {
      const text = await askBit({ item, picked, mistake, rule }, history, question);
      if (question) aiTurns.push({ role: 'kid', text: question });
      aiTurns.push({ role: 'bit', text });
      aiQ = '';
      audio.play('hint');
    } catch (e) { aiErr = HELPER_ERR[(e as HelperError)] ?? HELPER_ERR.ai_unavailable; }
    aiBusy = false;
  }
  let mobHp = $state(block === 'boss' ? BOSS_HP : total);
  const hpMax = block === 'boss' ? BOSS_HP : total;
  let startAt = 0;
  let cardEl: HTMLElement;
  let bitEl = $state<HTMLElement>();
  // после ответа — показать реплику Бита (она ниже вариантов)
  const showBit = () => setTimeout(() => bitEl?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 60);
  let choiceEls: HTMLElement[] = $state([]);

  // Настоящие задачи экзамена (банк «Дарын»): только по пройденным темам, сначала невиданные.
  // Босс — 3 из 10, смешанный бой и доп. миссия — 2; урок новой темы и разминка — только генераторы.
  const BANK_SLOTS: Partial<Record<Block, number[]>> = { boss: [2, 5, 8], mixed: [2, 5], extra: [3, 6] };
  const seen = new Set(game.save.attempts.map(a => a.source));
  const bankQueue = BANK_SLOTS[block] ? bankFor(id => isDone(game.save.skills[id]) && taught(game.save, skillDefs, id), seen) : [];
  function nextItem() {
    const sk = block === 'new' ? skills[0] : skills[idx % Math.max(1, skills.length)];
    const fromBank = !twin && BANK_SLOTS[block]?.includes(idx) && bankQueue.length ? bankQueue.shift() : null;
    item = fromBank ? bankToItem(fromBank) : makeItem(sk);
    picked = null; phase = 'answer'; hintLevel = 0; showSol = false; tries = 0; struck = [];
    aiTurns = []; aiErr = ''; aiQ = ''; aiBusy = false;
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
      else if (phase === 'answer' && e.key === 'Enter' && picked !== null) confirm('sure');
      else if (phase === 'retry' && e.key === 'Enter') retry();
      else if (phase === 'feedback' && e.key === 'Enter') next();
    };
    addEventListener('keydown', onKey);
    return () => { removeEventListener('keydown', onKey); W.world?.clearMob(); };
  });

  function pick(i: number) { if (phase !== 'answer' || struck.includes(i)) return; picked = i; audio.play('click'); }
  function needPick() { toast('Алдымен жауапты таңда'); audio.play('click'); }
  function retry() { picked = null; phase = 'answer'; bitMood = 'think'; startAt = performance.now(); }

  function hint() {
    if (phase !== 'answer' || !item) return;
    hintLevel = Math.min(4, hintLevel + 1);
    audio.play('hint');
    if (hintLevel === 4) { showSol = true; bitText = 'Толық шешуі төменде. Бұл есеп есептелмейді — келесіде реванш аласың.'; bitMood = 'think'; }
    else { bitText = item.hints[hintLevel - 1]?.kz ?? ''; bitMood = 'think'; }
    showBit();
  }

  async function confirm(confidence: 'sure' | 'maybe' | 'unsure') {
    if (!item || picked === null) return;
    const timeMs = performance.now() - startAt;
    const correct = picked === item.answer;
    tries++;
    if (tries === 2) return secondTry(correct);
    const honest = isHonest(timeMs, hintLevel);
    answered++;
    if (!honest && hintLevel < 4) { honestAll = false; guessed++; }
    const events = recordAttempt(game.save, {
      at: Date.now(), day: game.day, skill: item.skill, source: item.source, correct, confidence,
      hintLevel, honest, timeMs: Math.round(timeMs), tag: item.choices[picked].tag, mode: block === 'new' ? 'practice' : block === 'extra' ? 'extra' : block === 'boss' ? 'boss' : block === 'warmup' ? 'warmup' : block === 'repair' ? 'practice' : 'mixed',
    });
    lastCorrect = correct; phase = correct || hintLevel >= 4 ? 'feedback' : 'retry';
    if (!correct) struck = [...struck, picked];
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
      if (!honest && hintLevel < 4) bitText = 'Дұрыс, бірақ тым жылдам! Асықпа — алдымен оқы.';
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
      bitText = (confidence === 'sure' ? 'Сенімді едің, бірақ қателік бар. ' : 'Әзірге қате. ') + m.kz + (phase === 'retry' ? ' Тағы бір рет көр!' : '');
      if (!honest && hintLevel < 4) bitText = 'Тым жылдам! Асықпа — алдымен шартты оқы. ' + bitText;
      bitMood = 'think';
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
    persist(); showBit();
  }

  // Вторая попытка: в модель знаний не идёт (там — первая), но ребёнок доводит задачу до конца
  async function secondTry(correct: boolean) {
    phase = 'feedback'; lastCorrect = correct;
    await tick();
    const at = centerOf(choiceEls[picked!]);
    if (correct) {
      game.save.xp += 3; audio.play('correct'); react('correct', 0.4);
      sparksAt(at.x, at.y, ['#5ce39c', '#3ff0ff'], 20); floatText('+3 XP', at.x, at.y - 20, '#ffc94a');
      bitText = 'Екінші әрекеттен дұрыс! Қатені өзің таптың — бұл нағыз оқу.'; bitMood = 'happy';
      if (battle) { mobHp--; W.world?.heroAttack(false); }
    } else {
      struck = [...struck, picked!]; audio.play('wrong'); flash('#ff9a6b');
      bitText = 'Дұрыс жауабы жасылмен белгіленді. Шешуін оқы — сосын дәл осындай есепте реванш аласың.'; bitMood = 'think';
      twin = true;
    }
    persist(); showBit();
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

<Screen scene="short" back={() => go({ name: 'hub' })}>
  {#snippet head()}
    <div class="hd">
      <div class="t1"><b>{TITLE[block]}</b>{#if combo >= 2}<span class="combo num">×{combo}</span>{/if}</div>
      <div class="t2"><span class="bar glitch hp" aria-label="Глитч күші"><i style="width:{Math.max(0, mobHp / hpMax) * 100}%"></i></span><span class="cnt num">{Math.min(idx + 1, total)}/{total}</span></div>
    </div>
  {/snippet}

  {#if item}
    <div class="paper q" bind:this={cardEl}>
      {#if item.real}<span class="real">★ Нағыз емтихан есебі · {item.source.startsWith('daryn') ? `«Дарын» ${item.source.slice(5, 9)}` : 'Bolashak'}</span>{/if}
      <p>{#each item.kz.split('\n') as line, i}{#if i}<br />{/if}<span class:formula={i > 0}>{line}</span>{/each}</p>
      {#if item.figure?.svg}<div class="fig">{@html item.figure.svg}</div>
      {:else if item.figure?.src}<div class="fig"><img src={import.meta.env.BASE_URL + item.figure.src} alt="Есептің суреті" /></div>{/if}
      <small class="skill">{skillTitle(item.skill).kz}</small>
    </div>

    {@const maxLen = Math.max(...item.choices.map(c => c.text.length))}
    <div class="choices" class:long={maxLen > 5} class:xlong={maxLen > 10}>
      {#each item.choices as c, i}
        <button bind:this={choiceEls[i]} class="ans"
          class:sel={picked === i && phase === 'answer'}
          class:right={phase === 'feedback' && i === item.answer}
          class:wrong={(phase !== 'answer' && picked === i && i !== item.answer) || (struck.includes(i) && phase === 'feedback')}
          class:out={struck.includes(i) && phase === 'answer'}
          disabled={phase !== 'answer' || struck.includes(i)} onclick={() => pick(i)}
          aria-label="{letters[i]}: {c.text}{phase === 'feedback' && i === item.answer ? ' — дұрыс' : ''}">
          <span class="l">{#if phase === 'feedback' && i === item.answer}<Icon name="check" fill="#fff" size={16} />{:else if struck.includes(i) || (phase === 'retry' && picked === i)}<Icon name="cross" fill="#fff" size={16} />{:else}{letters[i]}{/if}</span>
          <span class="ct">{c.text}</span>
        </button>
      {/each}
    </div>

    {#if bitText}<div class="appear" bind:this={bitEl}><Bit text={bitText} mood={bitMood} compact /></div>{/if}

    {#if showSol || (phase === 'feedback' && !lastCorrect)}
      <details class="paper sol" open>
        <summary>Шешуі</summary>
        <p>{item.sol.kz}</p>
      </details>
      {@const rule = ruleOf(item.skill)}
      {#if rule}
        <details class="paper sol rule">
          <summary>Ережені еске түсір</summary>
          {#each rule.lines as l}<p>★ {l}</p>{/each}
        </details>
      {/if}
    {/if}

    {#if phase === 'feedback'}
      <div class="ai">
        {#each aiTurns as t}
          {#if t.role === 'bit'}<Bit text={t.text} mood="think" compact />{:else}<p class="kidq">— {t.text}</p>{/if}
        {/each}
        {#if aiErr}<p class="aierr">{aiErr}</p>{/if}
        {#if !aiTurns.length}
          <button class="btn ghost block" onclick={() => helpMe()} disabled={aiBusy}><Icon name="bulb" fill="var(--gold)" size={20} />{aiBusy ? 'Бит ойланып жатыр…' : 'Түсінбедім — Биттен сұра'}</button>
        {:else if aiAsked < MAX_QUESTIONS}
          <form class="askrow" onsubmit={(e) => { e.preventDefault(); if (aiQ.trim()) helpMe(aiQ); }}>
            <input bind:value={aiQ} maxlength="200" placeholder="Тағы сұрағың бар ма? Жаз…" disabled={aiBusy} onkeydown={(e) => e.stopPropagation()} />
            <button class="btn" disabled={aiBusy || !aiQ.trim()}>{aiBusy ? '…' : 'Сұрау'}</button>
          </form>
        {/if}
      </div>
    {/if}
  {:else if bitText}
    <Bit text={bitText} mood={bitMood} />
  {/if}

  {#snippet footer()}
    {#if item && phase === 'answer'}
      <button class="ibtn lamp" onclick={hint} disabled={hintLevel >= 4} aria-label="Бит сканері — кеңес {hintLevel}/4">
        <Icon name="bulb" fill="var(--gold)" /><b class="hl num">{hintLevel}/4</b>
      </button>
      {#if picked === null}
        <button class="btn big grow" style="opacity:.75" onclick={needPick}>Жауапты таңда</button>
      {:else}
        <button class="btn go row2 sure" onclick={() => confirm('sure')}><Icon name="check" fill="var(--outline)" size={18} />Сенімдімін</button>
        <button class="btn row2" onclick={() => confirm('maybe')}>Шамамен</button>
      {/if}
    {:else if item && phase === 'retry'}
      <button class="btn primary big grow" onclick={retry}>Тағы көр</button>
    {:else if item && phase === 'feedback'}
      <button class="btn big grow {lastCorrect ? 'go' : 'primary'}" onclick={next}>{idx + (twin ? 0 : 1) >= total ? 'Аяқтау' : twin ? 'Реванш' : 'Келесі'}<Icon name="chevron" fill="var(--outline)" size={20} /></button>
    {/if}
  {/snippet}
</Screen>

<style>
  .hd { flex: 1; min-width: 0; display: grid; gap: 6px; }
  .t1 { display: flex; align-items: center; gap: 8px; }
  .t1 b { flex: 1; min-width: 0; font: 900 18px var(--disp); text-shadow: 0 2px 0 var(--outline); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .t2 { display: flex; align-items: center; gap: 8px; }
  .hp { flex: 1; height: 14px; }
  .cnt { font-size: 14px; color: var(--dim); }
  .combo { font: 900 18px var(--disp); color: var(--gold); text-shadow: 0 2px 0 var(--outline); }

  .q { display: grid; gap: 10px; font-size: var(--fs-l); }
  .q p { line-height: 1.45; }
  .formula { display: inline-block; margin-top: 6px; font: 800 22px var(--disp); letter-spacing: .01em; }
  .skill { font-size: 12px; }
  .real { justify-self: start; font: 900 11px var(--disp); letter-spacing: .06em; text-transform: uppercase; color: var(--outline); background: var(--gold); padding: 4px 10px; border-radius: 999px; border: 2px solid var(--outline); }
  .fig { display: grid; place-items: center; }
  .fig :global(svg) { width: min(100%, 420px); height: auto; max-height: 260px; }
  .fig img { max-width: 100%; max-height: 260px; display: block; }

  .choices { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 100px), 1fr)); gap: 8px; }
  .choices.long { grid-template-columns: repeat(auto-fit, minmax(min(100%, 150px), 1fr)); }
  .choices.xlong { grid-template-columns: 1fr; }
  .ct { overflow-wrap: anywhere; line-height: 1.2; }
  .choices.long .ans { font-size: 16px; gap: 8px; padding: 8px 10px; }
  .choices.long:not(.xlong) .ct { white-space: nowrap; }

  .sol summary { cursor: pointer; font: 900 15px var(--disp); color: var(--code-deep); }
  .sol p { margin-top: 8px; }
  .sol.rule summary { color: var(--gold-deep); }

  .ai { display: grid; gap: 8px; }
  .kidq { color: var(--dim); font-style: italic; }
  .aierr { color: var(--gold); }
  .askrow { display: flex; gap: 8px; }
  .askrow input { flex: 1; min-width: 0; font: 700 16px var(--txt); color: var(--paper-ink); background: var(--paper); border: 3px solid var(--outline); border-radius: 12px; padding: 8px 10px; }

  .grow { flex: 1; min-width: 0; }
  .row2 { min-height: 58px; padding: 10px 8px 13px; font-size: 16px; gap: 4px; flex: 1; min-width: 0; }
  .row2.sure { flex: 1.35; }
  .lamp { width: 58px; height: 58px; position: relative; --c: #243a9e; --e: #152678; }
  .lamp:disabled { opacity: .5; }
  .hl { position: absolute; bottom: -8px; left: 50%; transform: translateX(-50%); font-size: 11px; padding: 0 5px; border-radius: 999px; background: var(--outline); color: var(--gold); }
</style>
