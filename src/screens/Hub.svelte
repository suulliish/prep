<script lang="ts">
  // Корабль — дом (docs/DESIGN_SYSTEM.md 11, 12.1–12.2). Главная кнопка всегда ведёт к следующему шагу дня.
  // Задания дня идут строго по порядку; у каждого видна награда. Закрытое при нажатии объясняет причину.
  import { onMount } from 'svelte';
  import Screen from '../ui/Screen.svelte';
  import Icon from '../ui/Icon.svelte';
  import Bit from '../ui/Bit.svelte';
  import CoinChip from '../ui/CoinChip.svelte';
  import { game, go, levelOf, persist } from '../lib/store.svelte';
  import { W } from '../lib/world.svelte';
  import { ensurePlan, dayRec } from '../lib/session.svelte';
  import { canStartExtra, planComplete, TODAY_MAX, round5, extraCap, extraNeedsRepair, REPAIR_FOR_EXTRA, EXTRA_MIN, repairNeed, restorableFix } from '../engine/planner';
  import { openBreaks, shipIntegrity, integrityColor, coinsHalved, claimShipChest } from '../engine/repair';
  import { isWeekday } from '../engine/dates';
  import { weekendBank, WEEKEND_BANK_MAX } from '../engine/weekbank';
  import { skillTitle } from '../engine/items';
  import { audio } from '../lib/audio';
  import { toast } from '../ui/notify.svelte';
  import { flushRewards, seen, takeLevelUp } from '../lib/reward.svelte';
  import { sparksAt } from '../ui/fx.svelte';
  import { coinsOf, canAffordSomething, syncDecor, addCoins, ITEMS, itemById, showDecor } from '../lib/ship.svelte';
  import ShipIcon from '../ui/ShipIcon.svelte';
  import { due as recallDue, backfill as recallBackfill } from '../engine/recall';
  import { hasRule } from '../lesson/recallrule';
  // @ts-ignore
  import { LESSONS } from '../../content/lessons.mjs';

  // темы с уроком, пройденным до появления «Еске түсір», встают на возвраты (один раз, дальше по 3 в день)
  if (recallBackfill(game.save, game.day)) persist();
  const plan = ensurePlan();
  const rec = $derived(dayRec());
  const weekday = isWeekday(game.day);
  // «Еске түсір» стоит первым: темы на сегодня, не больше 3. Пропустить нельзя (решение семьи 02.10): план дня открывается после вспоминания
  const recallList = $derived(recallDue(game.save, game.day, hasRule));
  const recallOn = $derived(game.save.diagnosticDone && weekday && recallList.length > 0);
  let recallGate = $state<string | null>(null);
  const lv = $derived(levelOf(game.save.xp));
  // копилка выходных: готовые minutesWeekend недели, не больше 90 (src/engine/weekbank.ts); кристаллы и серия с главного экрана убраны: три счётчика — минуты, копилка, монеты (specs/day.md)
  const bank = $derived(weekendBank(game.save.days, game.day));
  // поломки корабля = неисправленные ошибки (docs/GAME_LOOP.md 18): прочность, ремонтная доп. миссия, подпись Бита
  const broken = $derived(openBreaks(game.save));
  const integrity = $derived(shipIntegrity(broken));
  const needsRepair = $derived(extraNeedsRepair(broken));
  const repairPhrase = $derived(
    broken <= 0 ? '' : coinsHalved(broken) ? ` Кемеде ${broken} ақау қалды. Алдымен жөнде!`
    : needsRepair ? ` Кемеде ${broken} ақау қалды. Жөндейік!` : ` Кемеде ${broken} ақау қалды.`
  );
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
  // доп. миссия при ≥ 3 поломках — ремонтная: починил 3, получил её +15 минут (засчитывает бой)
  const extraRepair = $derived(extraOk && needsRepair);
  // «исправился — дозаработал»: сегодняшние ошибки плана, починка которых вернёт минуты (план уже пройден)
  const fixable = $derived(game.save.repairShop.filter(r => restorableFix(r, game.day)).length);
  const name = $derived(game.save.heroName);
  const bossReady = $derived(weekday && done && !game.save.worldsCleared?.includes(game.save.world ?? 'village') && learnedTotal >= 3 && !rec.bossTried);

  const greeting = $derived(
    !game.save.diagnosticDone ? `Сәлем, ${name}! Алдымен Код-күшіңді сканерлейік — бұл сынақ емес, карта ашу.`
    : !weekday ? `Бүгін демалыс! Жинаған уақытыңды ойнап ал. Дүйсенбіде жалғастырамыз.`
    : done ? `Керемет! Бүгінгі жол бітті: +${rec.minutesToday} мин.${bossReady ? ' Картада бас жау күтіп тұр!' : ''}`
    : doneN === 0 ? `${name}, бүгін ${plan.blocks.length} қадам. Бастайық!`
    : `Жарайсың! Тағы ${plan.blocks.length - doneN} қадам қалды.`
  );
  const sayText = $derived(game.save.diagnosticDone ? greeting + repairPhrase : greeting);

  // Что выросло с прошлого захода на корабль: минуты считаются вверх (пилюля подпрыгивает), XP-полоска доезжает,
  // при новом уровне — праздник «Деңгей N!» (ничего не должно проходить молча).
  let shownMin = $state(seen.minutes ?? dayRec().minutesToday);
  const coins = $derived(coinsOf(game.save));
  const afford = $derived(canAffordSomething(game.save));
  let minBump = $state(0);
  let xpFrac = $state(levelOf(seen.xp).into / levelOf(seen.xp).need);
  let xpJump = $state(false);        // мгновенный сброс полоски на 0 после заполнения (новый уровень)
  let levelUp = $state<number | null>(null);
  let chest = $state<{ coins: number; item: string | null } | null>(null);
  let lvlPulse = $state(0);
  function count(from: number, to: number, ms: number, set: (v: number) => void) {
    const t0 = performance.now();
    const step = (t: number) => { const k = Math.min(1, (t - t0) / ms); set(Math.round(from + (to - from) * (1 - Math.pow(1 - k, 3)))); if (k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }
  const timers: number[] = [];
  const later = (ms: number, f: () => void) => { timers.push(window.setTimeout(f, ms)); };
  function celebrateLevel(n: number) {
    levelUp = n; lvlPulse++; audio.play('levelup'); audio.play('crystal');
    sparksAt(innerWidth / 2, innerHeight * 0.4, ['#ffcb2e', '#35e6ff', '#ff4fb8', '#ffffff'], 90, 11);
    W.world?.celebrate?.(0xffc94a);
  }
  onMount(() => {
    W.dim = false; W.world?.clearMob(); W.world?.setMode('hub'); W.world?.bitMood(done ? 'happy' : 'idle');
    W.world?.setEnergy(learnedTotal % 10, 10);
    syncDecor();   // украшения и питомец из мастерской (и поломки = неисправленные ошибки)
    audio.setMood('hub');
    // 1. недоигранная награда (вышли посреди занятия) — показать сейчас
    void flushRewards();
    // 1б. корабль стал целым после ремонта — сундук: монеты и украшение (один раз за «опустошение», src/engine/repair.ts)
    const chestBase = game.save.shipChestFixed;
    const prize = claimShipChest(game.save, ITEMS);
    if (prize) { addCoins(game.save, prize.coins, game.day); persist(); syncDecor(); later(700, () => { chest = prize; audio.play('chest'); sparksAt(innerWidth / 2, innerHeight * 0.4, ['#ffcb2e', '#35e6ff', '#ff4fb8', '#ffffff'], 70, 10); }); }
    else if (game.save.shipChestFixed !== chestBase) persist();   // первый заход: запомнили точку отсчёта
    // 2. минуты
    const nowMin = dayRec().minutesToday;
    if (seen.minutes !== null && nowMin > seen.minutes) { const from = seen.minutes; later(500, () => { minBump++; audio.play('coins'); count(from, nowMin, 900, v => (shownMin = v)); }); }
    else shownMin = nowMin;
    seen.minutes = nowMin;
    // 3. XP и уровень
    const lvNow = levelOf(game.save.xp), lvOld = levelOf(seen.xp), up = takeLevelUp();
    const frac = lvNow.into / lvNow.need;
    if (up) {
      xpFrac = lvOld.into / lvOld.need;
      later(350, () => (xpFrac = 1));                                   // полоска доезжает до конца
      later(1100, () => { xpJump = true; xpFrac = 0; });                // сброс на 0 без анимации
      later(1200, () => { xpJump = false; xpFrac = frac; celebrateLevel(up); });   // и растёт до нового значения — вместе с праздником
    } else later(350, () => (xpFrac = frac));
    seen.xp = game.save.xp;
    // что предложили утром: по этому командир видит, вспоминал ли ребёнок или пропускал
    if (recallOn && !game.save.recallOffer?.[game.day]) {
      game.save.recallOffer ??= {};
      game.save.recallOffer[game.day] = { skills: [...recallList] };
      persist();
    }
    return () => timers.forEach(clearTimeout);
  });

  // Катсцена (GAME_LOOP.md 2): герой идёт в портал на палубе → вспышка → локация уровня
  // Вспышка перехода — только после того, как героя затянуло в портал (раньше белый экран закрывал саму катсцену).
  let entering = $state(false), warp = $state(false);
  async function portal(to: () => void) {
    if (entering) return;
    entering = true; audio.play('portal');
    await Promise.race([W.world?.portalWalk() ?? Promise.resolve(), new Promise(r => setTimeout(r, 5000))]);
    warp = true; setTimeout(to, 380);
  }
  function openRecall() { audio.unlock(); audio.play('mission'); recallGate = null; go({ name: 'recall' }); }
  function start(id: string) {
    // пока не вспоминали, план закрыт: вспоминание стоит первым
    if (recallOn) { audio.play('click'); recallGate = id; return; }
    audio.unlock(); audio.play('mission');
    if (id === 'summary') return go({ name: 'summary' });
    const b = plan.blocks.find(x => x.id === id)!;
    // план дня хранит «lesson: true» с утра; урок уже пройден (вышли из практики, перезагрузка на «Дәптер») — сразу практика, а не урок заново с первого шага
    if (id === 'new' && b.lesson && !game.save.skills[b.skills[0]]?.lessonDone) return portal(() => go({ name: 'lesson', skill: b.skills[0] }));
    portal(() => go({ name: 'session', block: id as any }));
  }
  function tapQuest(id: string) {
    if (rec.blocksDone[id]) { toast('Бұл қадам орындалды ✓'); return; }
    if (nextBlock?.id !== id) { toast(`Алдымен: ${BLOCK[nextBlock!.id].kz}`); audio.play('click'); return; }
    start(id);
  }
  function nav(to: 'map' | 'hero' | 'album' | 'workshop') { audio.unlock(); audio.play('click'); go({ name: to }); }
  let muted = $state(audio.settings.master === 0);
  function toggleSound() { audio.unlock(); muted = !muted; audio.save({ master: muted ? 0 : 0.8 }); if (!muted) audio.play('click'); }

  let openList = $state(false);   // «Бүгінгі жол» раскрыт: весь список заданий вместо одной карточки
  const nextSub = (b: (typeof plan.blocks)[number]) => (b.id === 'new' && resume ? `Жалғастыру · қадам ${resume}` : b.id === 'new' && b.skills[0] ? skillTitle(b.skills[0]).kz : BLOCK[b.id].what) + (b.minutes > 2 && !(b.id === 'new' && resume) ? ` · ~${b.minutes} мин` : '');
  const primary = $derived(
    !game.save.diagnosticDone ? { label: 'Сканерлеуді бастау', go: () => { audio.unlock(); go({ name: 'diagnostic' }); } }
    : !weekday ? { label: 'Картаны ашу', go: () => nav('map') }
    : nextBlock ? { label: resume && nextBlock.id === 'new' ? 'Жалғастыру' : 'Бастау', go: () => start(nextBlock!.id) }
    : extraRepair ? { label: 'Жөндеуді бастау', go: () => { audio.unlock(); audio.play('energy'); portal(() => go({ name: 'session', block: 'repair', asExtra: true })); } }
    : fixable > 0 && rec.planShare < 1 ? { label: `Қатені түзет · минутты қайтар (${fixable})`, go: () => { audio.unlock(); audio.play('energy'); portal(() => go({ name: 'session', block: 'repair' })); } }
    : extraOk ? { label: 'Бастау', go: () => { audio.unlock(); audio.play('energy'); portal(() => go({ name: 'session', block: 'extra' })); } }
    : { label: 'Картаны ашу', go: () => nav('map') }
  );
</script>

<Screen scene="fill" bare={!(game.save.diagnosticDone && weekday)}>
  {#snippet head()}
    <div class="me">
      {#key lvlPulse}<span class="lvl num" class:pulse={lvlPulse > 0} aria-label="Деңгей {lv.lvl}">{lv.lvl}</span>{/key}
      <div class="who"><b>{name}</b><span class="bar"><i class:jump={xpJump} style="width:{xpFrac * 100}%"></i></span></div>
    </div>
  {/snippet}
  {#snippet right()}
    <button class="ibtn ghost" onclick={toggleSound} aria-label={muted ? 'Дыбысты қосу' : 'Дыбысты өшіру'}><Icon name={muted ? 'mute' : 'sound'} fill="#fff" /></button>
    <button class="ibtn ghost" onclick={() => go({ name: 'commander' })} aria-label="Командир (ата-ана)"><Icon name="gear" fill="#c4cfff" /></button>
  {/snippet}

  {#snippet overlay()}
  <div class="res" role="group" aria-label="Ресурстар">
    {#key minBump}<span class="pill" class:bump={minBump > 0} aria-label="Бүгін ойын минуты: {shownMin} / {TODAY_MAX}"><Icon name="clock" fill="var(--gold)" size={22} /><span class="num">{shownMin}</span><small>/{TODAY_MAX} мин</small></span>{/key}
    <span class="pill" aria-label="Демалысқа жиналған минут: {bank} / {WEEKEND_BANK_MAX}"><Icon name="flag" fill="var(--code)" size={22} /><span class="num">{bank}</span><small>/{WEEKEND_BANK_MAX} демалыс</small></span>
    <CoinChip value={coins} />
  </div>
  {#if game.save.diagnosticDone}
    <div class="hull" class:low={broken > 0} role="img" aria-label="Кеме беріктігі: {integrity}%{broken ? `, ${broken} ақау` : ''}">
      <Icon name="hammer" fill={integrityColor(integrity)} size={18} />
      <span class="hb"><i style="width:{integrity}%; background:{integrityColor(integrity)}"></i></span>
      <b class="num">{integrity}%</b>
      {#if coinsHalved(broken)}<span class="hw">Тиындар жартылай: алдымен жөнде!</span>{/if}
    </div>
  {/if}
  <div class="say"><Bit text={sayText} mood={done ? 'happy' : 'idle'} compact /></div>
  {/snippet}

  {#if recallOn}
    <div class="recall">
      <button class="quest next" onclick={openRecall} aria-label="Еске түсір: {recallList.length} тақырып">
        <span class="qi" style="--c:var(--crystal)"><Icon name="book" fill="#fff" size={22} /></span>
        <span class="qt"><b>Еске түсір: {recallList.length} тақырып</b><small>Ережені өз сөзіңмен · ~3 мин</small></span>
      </button>
    </div>
  {/if}

  {#if game.save.diagnosticDone && weekday}
    <!-- сегодня, компактно: кольцо, одна строка, точки-шаги (нажать: причина, если закрыто) и ОДНА карточка «дальше» -->
    <div class="today">
      <div class="ring" style="--p:{(doneN / plan.blocks.length) * 100}" aria-label="Бүгін {doneN} / {plan.blocks.length}">
        <span class="num">{doneN}<small>/{plan.blocks.length}</small></span>
      </div>
      <button class="tt" onclick={() => (openList = !openList)} aria-expanded={openList} aria-label="Бүгінгі жол: барлық қадамдар">
        <b>Бүгінгі жол <i class="chev" class:up={openList}></i></b>
        <small>{plan.blocks.length} қадам · ~{planMin} мин</small>
      </button>
      <div class="pips" role="group" aria-label="Қадамдар">
        {#each plan.blocks as b (b.id)}
          {@const isDone = !!rec.blocksDone[b.id]}
          {@const isNext = nextBlock?.id === b.id}
          <button class="pip" class:done={isDone} class:next={isNext} onclick={() => tapQuest(b.id)} aria-label="{BLOCK[b.id].kz}{isDone ? ' — орындалды' : isNext ? ' — келесі' : ' — жабық'}">
            <span class="dot"><Icon name={isDone ? 'check' : !isNext ? 'lock' : BLOCK[b.id].icon} fill="#fff" size={16} /></span>
          </button>
        {/each}
      </div>
    </div>

    {#if openList}
      <ol class="quests">
        {#each plan.blocks as b (b.id)}
          {@const q = BLOCK[b.id]}
          {@const isDone = !!rec.blocksDone[b.id]}
          {@const isNext = nextBlock?.id === b.id}
          <li>
            <button class="quest" class:done={isDone} class:next={isNext} class:locked={!isDone && !isNext} onclick={() => tapQuest(b.id)}>
              <span class="qi" style="--c:{isDone ? 'var(--ok)' : q.c}"><Icon name={isDone ? 'check' : !isNext ? 'lock' : q.icon} fill="#fff" size={22} /></span>
              <span class="qt"><b>{q.kz}</b><small>{nextSub(b)}</small></span>
              {#if isDone && rec.stars?.[b.id]}
                <span class="st" aria-label="{rec.stars[b.id]} жұлдыз">{#each [1, 2, 3] as k}<Icon name="star" fill={rec.stars[b.id] >= k ? 'var(--gold)' : '#2b3a8f'} size={18} />{/each}</span>
              {:else if b.id !== 'summary'}<span class="rw" class:got={isDone}><Icon name="clock" fill="var(--gold)" size={16} />+{reward(b.minutes)}</span>{/if}
            </button>
          </li>
        {/each}
      </ol>
    {:else if nextBlock}
      {@const q = BLOCK[nextBlock.id]}
      <button class="quest next" onclick={() => tapQuest(nextBlock.id)}>
        <span class="qi" style="--c:{q.c}"><Icon name={q.icon} fill="#fff" size={22} /></span>
        <span class="qt"><b>{q.kz}</b><small>{nextSub(nextBlock)}</small></span>
        {#if nextBlock.id !== 'summary'}<span class="rw"><Icon name="clock" fill="var(--gold)" size={16} />+{reward(nextBlock.minutes)}</span>{/if}
      </button>
    {:else}
      {#if extraRepair}
        <button class="quest fin next repair" onclick={primary.go} aria-label="Жөндеу миссиясы: {repairNeed(broken)} ақауды жөнде, +{EXTRA_MIN} минут">
          <span class="qi" style="--c:var(--gold)"><Icon name="hammer" fill="#fff" size={22} /></span>
          <span class="qt"><b>Жөндеу миссиясы</b><small>{repairNeed(broken)} ақауды жөнде → +{EXTRA_MIN} мин · {rec.extraMissions} / {extraCap(game.save.settings.extraMissionCap)}</small></span>
          <span class="rw"><Icon name="clock" fill="var(--gold)" size={16} />+{EXTRA_MIN}</span>
        </button>
      {:else}
      <div class="quest fin" class:next={extraOk}>
        <span class="qi" style="--c:var(--ok)"><Icon name="check" fill="#fff" size={22} /></span>
        <span class="qt"><b>{extraOk ? 'Қосымша миссия' : 'Бүгінгі жол бітті'}</b><small>{extraOk ? `+15 мин · ${rec.extraMissions} / ${extraCap(game.save.settings.extraMissionCap)}` : `Қосымша миссиялар: ${rec.extraMissions} / ${extraCap(game.save.settings.extraMissionCap)}`}</small></span>
        {#if extraOk}<span class="rw"><Icon name="clock" fill="var(--gold)" size={16} />+15</span>{/if}
      </div>
      {/if}
    {/if}
  {/if}

  {#if recallGate}
    <div class="gate" role="dialog" aria-modal="true" aria-label="Еске түсір">
      <div class="gbox panel">
        <Bit text="Алдымен еске түсірейік! {recallList.length} тақырып, шамамен 3 минут. Ереже осылай ұзақ есте қалады." mood="think" compact />
        <button class="btn primary big block" onclick={openRecall}><Icon name="book" fill="var(--outline)" size={22} />Еске түсір</button>
        <button class="btn ghost block" onclick={() => (recallGate = null)}>Кейін</button>
      </div>
    </div>
  {/if}

  {#if entering}<div class="tapguard" aria-hidden="true"></div>{/if}{#if warp}<div class="warp" aria-hidden="true"></div>{/if}

  {#if chest}
    <div class="lvlup chest" role="dialog" aria-modal="true" aria-label="Кеме бүтін: сандық">
      <div class="rays" aria-hidden="true"></div>
      <div class="lu">
        <small>КЕМЕ ТОЛЫҚ БҮТІН!</small>
        <span class="msg">Барлық ақауды жөндедің. Міне, сандық!</span>
        <span class="prize"><Icon name="coin" fill="var(--gold)" size={34} /><b class="num">+{chest.coins}</b><small>тиын</small></span>
        {#if chest.item}{@const it = itemById(chest.item)}{#if it}<span class="prize gift"><ShipIcon src={it.icon} size={64} /><span><small>Сыйлық</small><b>{it.kz}</b></span></span>{/if}{/if}
        <button class="btn primary big" onclick={() => { const id = chest?.item; chest = null; if (id) void showDecor(id); }}><Icon name="check" fill="var(--outline)" size={22} />Тамаша!</button>
      </div>
    </div>
  {/if}

  {#if levelUp}
    <div class="lvlup" role="dialog" aria-modal="true" aria-label="Жаңа деңгей {levelUp}">
      <div class="rays" aria-hidden="true"></div>
      <div class="lu">
        <small>ЖАҢА ДЕҢГЕЙ!</small>
        <b class="lu-n num">{levelUp}</b>
        <span class="msg">{name}, сен өстің!</span>
        <button class="btn primary big" onclick={() => (levelUp = null)}><Icon name="check" fill="var(--outline)" size={22} />Тамаша!</button>
      </div>
    </div>
  {/if}

  {#snippet footer()}
    <div class="stack">
      <button class="btn primary big block" class:wait={entering} onclick={primary.go}><Icon name="play" fill="var(--outline)" stroke="none" size={22} />{primary.label}</button>
      <nav class="menu" aria-label="Мәзір">
        <button class="mi" onclick={() => nav('map')}><Icon name="map" fill="#7ee08f" size={26} /><span>Карта</span>{#if bossReady}<b class="badge">!</b>{/if}</button>
        <button class="mi" onclick={() => nav('hero')}><Icon name="hero" fill="#5ea0ff" size={26} /><span>Кейіпкер</span></button>
        <button class="mi" onclick={() => nav('workshop')}><Icon name="hammer" fill="var(--gold)" size={26} /><span>Шеберхана</span>{#if afford}<b class="badge">!</b>{/if}</button>
        <button class="mi" onclick={() => nav('album')}><Icon name="cards" fill="var(--crystal)" size={26} /><span>Альбом</span>{#if broken}<b class="badge">{broken}</b>{/if}</button>
      </nav>
    </div>
  {/snippet}
</Screen>

<style>
  .me { flex: 1; display: flex; align-items: center; gap: 10px; min-width: 0; }
  .lvl { flex: none; width: 44px; height: 44px; display: grid; place-items: center; font-size: 20px; color: var(--outline); background: var(--code);
    border: 3px solid var(--outline); border-radius: 12px; box-shadow: inset 0 -4px 0 var(--code-deep); }
  .lvl.pulse { animation: lvl-pop 1s var(--ease-out) both; }
  @keyframes lvl-pop { 0% { transform: scale(1); } 30% { transform: scale(1.6) rotate(-8deg); box-shadow: inset 0 -4px 0 var(--code-deep), 0 0 26px var(--gold); background: var(--gold); } 100% { transform: scale(1); } }
  .who { flex: 1; min-width: 0; display: grid; gap: 4px; }
  .who b { font: 900 18px var(--disp); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-shadow: 0 2px 0 var(--outline); }
  .who .bar { height: 12px; }
  .who .bar i.jump { transition: none; }

  .res { display: flex; gap: 6px; justify-content: center; width: 100%; padding: 0 4px; }
  .res :global(.pill) { flex: 1; justify-content: center; min-width: 0; }
  @media (max-width: 420px) { .res { gap: 4px; padding: 0; } .res :global(.pill) { padding: 0 8px 0 4px; gap: 4px; } .res :global(.pill small) { font-size: 10px; } }
  .res .pill.bump { animation: pill-bump .6s var(--ease-out); }
  @keyframes pill-bump { 0% { transform: scale(1); } 30% { transform: scale(1.2); box-shadow: 0 0 18px var(--gold); } 100% { transform: scale(1); } }
  .hull { display: flex; align-items: center; gap: 8px; width: min(460px, 100%); align-self: flex-start; flex-wrap: wrap; padding: 0 6px 6px; }
  .hull .hb { flex: 1; min-width: 70px; max-width: 220px; height: 12px; border-radius: 999px; background: #0b1030; border: 2px solid var(--outline); overflow: hidden; }
  .hull .hb i { display: block; height: 100%; border-radius: 999px; transition: width .6s var(--ease-out); }
  .hull .num { font: 900 15px var(--disp); color: var(--ink); text-shadow: 0 2px 0 var(--outline); min-width: 3.4ch; }
  .hull .hw { flex-basis: 100%; font: 800 13px var(--txt); color: #ffd0d0; text-shadow: 0 1px 0 var(--outline); }
  .quest.fin.repair { background: linear-gradient(180deg, #e0952a, #b36a12); box-shadow: inset 0 -4px 0 #7d4506, 0 0 0 3px var(--gold), 0 3px 0 var(--outline); }
  .quest.fin.repair .qt small { color: #fff3dc; }
  .lvlup.chest .lu { gap: 10px; }
  .lvlup.chest .lu small { font-size: 16px; }
  .prize { display: inline-flex; align-items: center; gap: 8px; padding: 6px 14px; border-radius: 999px; background: #0b1030; border: 3px solid var(--outline); animation: pop-in .4s .5s var(--ease-out) both; }
  .prize .num { font: 900 28px var(--disp); color: var(--gold); }
  .prize.gift { border-radius: 18px; animation-delay: .8s; text-align: left; }
  .prize.gift span { display: grid; gap: 0; }
  .prize.gift b { font: 800 17px var(--disp); }
  .say { padding: 0 4px 6px; width: min(460px, 100%); align-self: flex-start; }
  @media (min-width: 1000px) and (min-aspect-ratio: 23/20) { .say { width: 100%; } }

  /* сегодня: кольцо + строка + точки-шаги */
  .today { display: flex; align-items: center; gap: 10px; }
  .ring { --p: 0; flex: none; width: 52px; height: 52px; border-radius: 50%; display: grid; place-items: center;
    background: conic-gradient(var(--ok) calc(var(--p) * 1%), #0b1030 0); border: 3px solid var(--outline); position: relative; }
  .ring::before { content: ''; position: absolute; inset: 6px; border-radius: 50%; background: var(--panel-2); border: 2px solid var(--outline); }
  .ring span { position: relative; font-size: 18px; }
  .ring small { font-size: 11px; color: var(--dim); }
  .tt { flex: 1; min-width: 0; display: grid; gap: 1px; text-align: left; font: inherit; color: var(--ink); background: none; border: 0; padding: 4px 0; min-height: 48px; align-content: center; cursor: pointer; }
  .tt b { font: 900 17px var(--disp); text-shadow: 0 2px 0 var(--outline); white-space: nowrap; }
  .tt small { color: var(--dim); font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .tt:focus-visible { outline: 3px solid var(--code); border-radius: 10px; }
  .chev { display: inline-block; width: 8px; height: 8px; margin: 0 0 3px 4px; border-right: 3px solid var(--gold); border-bottom: 3px solid var(--gold); transform: rotate(45deg); transition: transform .2s; }
  .chev.up { transform: rotate(225deg) translate(-2px, -2px); }
  .pips { flex: none; display: flex; gap: 2px; }
  .pip { width: 40px; height: 48px; display: grid; place-items: center; background: none; border: 0; padding: 0; cursor: pointer; }
  .pip .dot { width: 32px; height: 32px; display: grid; place-items: center; border-radius: 50%; background: #5b6699; border: 3px solid var(--outline); box-shadow: inset 0 -3px 0 #00000033; }
  .pip.done .dot { background: var(--ok); }
  .pip.next .dot { background: var(--gold); box-shadow: inset 0 -3px 0 #00000033, 0 0 0 3px #ffcb2e66; animation: pulse-glow 2s infinite; }
  .pip:active .dot { transform: translateY(2px); }
  .pip:focus-visible { outline: 3px solid var(--code); border-radius: 10px; }

  .recall { display: grid; gap: 0; justify-items: end; margin-bottom: 4px; }
  .recall .quest { justify-self: stretch; }
  .gate { position: fixed; inset: 0; z-index: calc(var(--z-modal) + 4); display: grid; place-items: center; padding: 16px; background: #05071399; animation: fade .2s ease-out both; }
  .gbox { width: min(420px, 100%); display: grid; gap: 10px; padding: 14px; }
  .quests { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; position: relative; }
  /* тропа уровней: пунктир соединяет точки, пройденная часть зелёная */
  .quests li { position: relative; }
  .quests li + li::before { content: ''; position: absolute; left: 33px; top: -12px; height: 16px; border-left: 4px dashed #5b6699; z-index: 0; }
  .quests li:has(.done) + li::before { border-left-style: solid; border-color: var(--ok); }
  .st { flex: none; display: inline-flex; gap: 1px; padding: 3px 6px; border-radius: 999px; background: #0b1030; border: 2px solid var(--outline); }
  .warp { position: fixed; inset: 0; z-index: 50; pointer-events: all; background: radial-gradient(circle at 70% 35%, #bff9ffcc, #3ff0ff66 30%, transparent 60%);
    animation: warp .4s ease-in both; }
  @keyframes warp { 0% { opacity: 0; } 100% { opacity: 1; background-color: #eaffff; } }
  .tapguard { position: fixed; inset: 0; z-index: 49; pointer-events: all; }
  .quest { width: 100%; display: flex; align-items: center; gap: 12px; text-align: left; font: inherit; color: var(--ink); cursor: pointer;
    padding: 8px 12px; background: var(--deep); border: 3px solid var(--outline); border-radius: 16px; box-shadow: inset 0 -4px 0 #0c1a5a, 0 3px 0 var(--outline);
    transition: transform .08s; }
  .quest:active { transform: translateY(2px); }
  .quest.next { background: linear-gradient(180deg, #3a5cf0, #2440c0); box-shadow: inset 0 -4px 0 #1a2f96, 0 0 0 3px var(--gold), 0 3px 0 var(--outline); animation: nudge 2.4s ease-in-out infinite; }
  .quest.fin { cursor: default; background: linear-gradient(180deg, #2fae5f, #1e8a49); box-shadow: inset 0 -4px 0 #146a36, 0 3px 0 var(--outline); }
  .quest.fin:active { transform: none; }
  .quest.fin.next { box-shadow: inset 0 -4px 0 #146a36, 0 0 0 3px var(--gold), 0 3px 0 var(--outline); }
  .quest.done { opacity: .75; }
  .quest.locked { opacity: .6; }
  @keyframes nudge { 0%, 100% { transform: none; } 50% { transform: translateY(-2px); } }
  .qi { flex: none; width: 44px; height: 44px; display: grid; place-items: center; border-radius: 12px; background: var(--c); border: 3px solid var(--outline); box-shadow: inset 0 -4px 0 #00000033; }
  .quest.locked .qi { background: #5b6699; }
  .qt { flex: 1; min-width: 0; display: grid; gap: 2px; }
  .qt b { font: 800 17px var(--disp); }
  .qt small { color: var(--dim); font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .quest.fin .qt small { color: #e6ffe9; white-space: normal; }
  .rw { flex: none; display: inline-flex; align-items: center; gap: 3px; font: 900 15px var(--disp); color: var(--gold); padding: 4px 8px; border-radius: 999px; background: #0b1030; border: 2px solid var(--outline); }
  .rw.got { color: var(--ok); }

  .stack { flex: 1; display: grid; gap: 6px; }
  .stack .btn { gap: 10px; }
  /* нижнее меню: панель-«таб-бар», как в мобильных играх */
  .menu { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 2px; padding: 3px; border-radius: 16px; background: #0b1030aa; border: 3px solid var(--outline); }
  .mi { position: relative; display: grid; justify-items: center; gap: 1px; padding: 4px 2px 3px; min-height: 52px; font: 800 12px var(--disp); color: var(--ink);
    background: transparent; border: 0; border-radius: 12px; cursor: pointer; }
  .mi:active { transform: translateY(2px); background: #ffffff18; }
  .mi:focus-visible { outline: 3px solid var(--code); }
  .badge { position: absolute; top: 0; right: 14%; min-width: 20px; height: 20px; padding: 0 5px; display: grid; place-items: center; font: 900 12px var(--disp); color: var(--outline); background: var(--gold); border: 2px solid var(--outline); border-radius: 10px; }

  /* повышение уровня */
  .lvlup { position: fixed; inset: 0; z-index: calc(var(--z-modal) + 5); display: grid; place-items: center; background: radial-gradient(circle at 50% 42%, #3a4ae0aa, #05061af0 72%); animation: fade .3s ease-out both; overflow: hidden; }
  .rays { position: absolute; left: 50%; top: 42%; width: 160vmax; height: 160vmax; margin: -80vmax 0 0 -80vmax; opacity: .55; pointer-events: none;
    background: repeating-conic-gradient(from 0deg, #ffcb2e55 0 8deg, transparent 8deg 24deg); animation: spin 14s linear infinite, fade .8s ease-out both;
    -webkit-mask-image: radial-gradient(circle, #000 0 8%, transparent 45%); mask-image: radial-gradient(circle, #000 0 8%, transparent 45%); }
  .lu { position: relative; display: grid; justify-items: center; gap: 6px; padding: 16px; text-align: center; }
  .lu small { font: 900 18px var(--disp); letter-spacing: .12em; color: var(--code); text-shadow: 0 3px 0 var(--outline); animation: pop-in .4s .1s var(--ease-out) both; }
  .lu .lu-n { font: 900 min(46vmin, 220px)/1 var(--disp); color: var(--gold); -webkit-text-stroke: 5px var(--outline); paint-order: stroke fill; text-shadow: 0 10px 0 var(--outline), 0 0 60px #ffcb2e;
    animation: lu-pop .9s .2s cubic-bezier(.2, 1.4, .4, 1) both; }
  .lu .msg { font: 800 19px var(--disp); color: var(--ink); animation: pop-in .4s .7s var(--ease-out) both; }
  .lu .btn { margin-top: 10px; min-width: 220px; animation: pop-in .4s 1s var(--ease-out) both; }
  @keyframes lu-pop { 0% { transform: scale(0) rotate(-25deg); opacity: 0; } 55% { transform: scale(1.35) rotate(6deg); opacity: 1; } 100% { transform: none; opacity: 1; } }
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes fade { from { opacity: 0; } }
  @media (max-height: 560px) { .lu .lu-n { font-size: 34vmin; -webkit-text-stroke-width: 4px; } .lu { gap: 2px; padding: 6px; } .lu .btn { margin-top: 4px; } }
</style>
