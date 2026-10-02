<script lang="ts">
  // Разбор (docs/GAME_LOOP.md 20, фаза 4) после ошибки, «Білмеймін» и слишком быстрого ответа: экран без прокрутки, ребёнок не читает, а нажимает.
  // Задание выбирает src/engine/review.ts: найти первую неверную строку / выбрать верное объяснение / закрыть число в решении / ответить «Сұрақ не туралы?».
  // Кнопка «Жаңа есеп →» открывается ПОСЛЕ действия и стоит прямо под объяснением (а не внизу экрана, не на одном месте).
  // Против тыканья наугад (docs/GAME_LOOP.md 10): неверное касание = тряска, варианты закрыты на 1,5 с, под вариантами подсказка;
  // со второго неверного касания показываем решение, а кнопка «дальше» заряжается на время чтения (как в «прочитай решение»);
  // после верного касания кнопка тоже заряжается (не меньше 2 с), чтобы успеть прочитать пояснение.
  import { onDestroy, tick, type Snippet } from 'svelte';
  import Bit from './Bit.svelte';
  import MathLine from '../lesson/MathLine.svelte';
  import { audio } from '../lib/audio';
  import { ReadGate, readMs } from '../lib/readgate.svelte';
  import { REVIEW_SAY, RUSH_STEP, rushLine, rushSec } from '../engine/confidence';
  import { GLITCH_SAY } from '../engine/glitchturn';
  import { mistakeText } from '../engine/items';
  import type { Review, ReviewMode } from '../engine/review';
  import { reviewStart, reviewEnd } from '../lib/track.svelte';

  let { review, mode, sure = false, fastMs = 0, easy = false, skill = '', onnext, children }: { review: Review; mode: ReviewMode; sure?: boolean; fastMs?: number; easy?: boolean; skill?: string; onnext: () => void; children?: Snippet } = $props();
  // аналитика командира: сколько разбор был открыт и сколько раз нажато раньше времени (src/lib/track.svelte.ts)
  // svelte-ignore state_referenced_locally
  reviewStart(skill);
  onDestroy(reviewEnd);

  // kind разбора не меняется, пока панель жива (Session пересоздаёт её на каждый разбор), поэтому начальные значения читаем один раз
  // svelte-ignore state_referenced_locally
  let done = $state(review.kind === 'glitch');
  let picked = $state<number | null>(null);
  // ход Глитча уже сыгран: нажатая строка — мягкая отметка (следствие) или промах, верная помечается «ҚАТЕ»
  // svelte-ignore state_referenced_locally
  let soft = $state<number[]>(review.kind === 'glitch' && review.turn.follows.includes(review.picked) ? [review.picked] : []);
  // svelte-ignore state_referenced_locally
  let wrong = $state<number[]>(review.kind === 'glitch' && review.picked !== review.turn.bad && !review.turn.follows.includes(review.picked) ? [review.picked] : []);
  let note = $state('');
  const gate = new ReadGate();
  // svelte-ignore state_referenced_locally
  if (review.kind === 'read') gate.start(readMs(review.sol));

  const pre = $derived((fastMs ? `${rushSec(fastMs)} секундта жауап бердің. ` : '') + (sure ? REVIEW_SAY.sureWrong + ' ' : ''));
  const bit = $derived.by(() => {
    const r = review;
    if (r.kind === 'find') return pre + (easy ? REVIEW_SAY.easyFind : REVIEW_SAY.find);
    if (r.kind === 'why') return pre + (easy ? REVIEW_SAY.easyWhy : REVIEW_SAY.why);
    if (r.kind === 'glitch') return r.turn.follows.includes(r.picked) ? GLITCH_SAY.followLine : r.picked === r.turn.bad ? GLITCH_SAY.right : GLITCH_SAY.wrongLine;
    if (mode === 'fast') return rushLine(fastMs);
    if (r.kind === 'gap') return mode === 'dunno' ? REVIEW_SAY.gap : pre + REVIEW_SAY.gapErr;
    if (r.kind === 'check') return rushLine(fastMs);
    return mode === 'dunno' ? REVIEW_SAY.read : pre + REVIEW_SAY.readErr;
  });

  const LOCK_MS = 1500, MAX_MISS = 2;
  const HINT = {
    down: 'Бұл жол дұрыс еді. Қате төменірек. Әр жолды өзің есепте.',
    up: 'Бұл жол дұрыс еді. Қате жоғарырақ. Бірінші қате жолды тап.',
    why: 'Бұл түсіндірме саған сай емес. Өз жауабыңды қара: нені қате істедің?',
    gap: 'Бұл сан емес. Шешудегі алдыңғы сөздерді оқы: жауап сол жерде.',
  } as const;
  // locked: неверное касание, варианты закрыты на 1,5 с; noteKey: новая подсказка, подсветка вспыхивает заново
  let locked = $state(false);
  let noteKey = $state(0);
  let misses = 0, lockT = 0;
  onDestroy(() => clearTimeout(lockT));
  let rv = $state<HTMLElement>();
  // новая подсказка или кнопка «дальше» появились ниже: на низком экране (телефон лёжа) показать их
  const show = (sel: string) => tick().then(() => rv?.querySelector(sel)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }));
  function say(text: string) { note = text; noteKey++; show('.note'); }
  // тексты, которые ребёнок должен успеть прочитать после верного касания или показа решения
  const readTime = () => readMs(whyText, fixedLine, review.kind === 'why' ? review.cards.find(c => c.ok)?.text : '');
  function good() { clearTimeout(lockT); locked = false; note = ''; done = true; audio.play('correct'); gate.start(readTime(), false); show('.nxt'); }
  // второй неверный: показываем решение, кнопка «дальше» заряжается на время чтения
  function reveal() {
    clearTimeout(lockT); locked = false; note = ''; done = true;
    if (review.kind === 'find') picked = review.turn.bad;
    else if (review.kind === 'why') picked = review.cards.findIndex(c => c.ok);
    gate.start(readTime()); show('.nxt');
  }
  function miss(k: number, text: string) {
    wrong = [...wrong, k]; say(text); audio.play('wrong');
    if (++misses >= MAX_MISS) return reveal();
    locked = true; clearTimeout(lockT); lockT = window.setTimeout(() => (locked = false), LOCK_MS);
  }
  // найди строку: верная — готово; строка-следствие — мягкая отметка и ещё попытка; мимо — тряска, пауза, подсказка, со второго промаха показываем сами
  function tapLine(k: number) {
    if (review.kind !== 'find' || done || locked || wrong.includes(k) || soft.includes(k)) return;
    const t = review.turn;
    if (k === t.bad) { picked = k; return good(); }
    if (t.follows.includes(k)) { soft = [...soft, k]; say(GLITCH_SAY.followTry); audio.play('click'); return; }
    miss(k, k < t.bad ? HINT.down : HINT.up);
  }
  function tapCard(i: number) {
    if (review.kind !== 'why' || done || locked || wrong.includes(i)) return;
    if (review.cards[i].ok) { picked = i; return good(); }
    miss(i, HINT.why);
  }
  function tapOpt(ok: boolean, i: number, text: string) {
    if (done || locked || wrong.includes(i)) return;
    if (ok) { picked = i; return good(); }
    miss(i, text);
  }
  const fixedLine = $derived(review.kind === 'find' || review.kind === 'glitch' ? review.turn.good[review.turn.bad].replace(/^Жауабы:\s*/, '') : '');
  const whyText = $derived.by(() => {
    const r = review;
    if (r.kind === 'find') return r.why;
    if (r.kind === 'why') return REVIEW_SAY.whyDone;
    if (r.kind === 'glitch') return `${GLITCH_SAY.mistake} ${mistakeText(r.turn.tag).kz}`;
    if (r.kind === 'gap') return r.sol;
    if (r.kind === 'check') return RUSH_STEP.done;
    return '';
  });
  const nope = () => { gate.nope(); audio.play('click'); };
  // ход Глитча уже сыгран: это показ решения, кнопка тоже заряжается на время чтения
  // svelte-ignore state_referenced_locally
  if (review.kind === 'glitch') gate.start(readTime());
</script>

<div class="rv" bind:this={rv}>
  <div class="bit"><Bit text={bit} mood={done ? 'happy' : 'think'} compact /></div>

  {#if review.kind === 'find' || review.kind === 'glitch'}
    {#if review.kind === 'find'}<p class="your">{REVIEW_SAY.yourAnswer}: <b>{review.your}</b></p>{/if}
    {@const turn = review.turn}
    <div class="lines" class:lock={locked} role="group" aria-label={REVIEW_SAY.find}>
      {#each turn.lines as l, k}
        <button class="line" class:bad={done && k === turn.bad} class:miss={wrong.includes(k)} class:soft={soft.includes(k)} disabled={done || locked} onclick={() => tapLine(k)}
          aria-label="{k + 1}: {l}">
          <span class="n">{k + 1}</span><span class="tx"><MathLine text={l} inherit /></span>
          {#if done && k === turn.bad}<i class="stamp">ҚАТЕ</i>{:else if soft.includes(k)}<i class="stamp soft">САЛДАР</i>{/if}
        </button>
      {/each}
    </div>
    {#if note && !done}{#key noteKey}<p class="note" role="status">{note}</p>{/key}{/if}
    {#if done}<p class="fix"><b>{REVIEW_SAY.fixed}:</b> <MathLine text={fixedLine} inherit /></p>{/if}
  {:else if review.kind === 'why'}
    <p class="your" class:hot={!!note && !done}>{REVIEW_SAY.yourAnswer}: <b>{review.your}</b></p>
    <div class="cards" class:lock={locked}>
      {#each review.cards as c, i}
        <button class="card" class:ok={done && c.ok} class:miss={wrong.includes(i)} disabled={done || locked || wrong.includes(i)} onclick={() => tapCard(i)}>{c.text}</button>
      {/each}
    </div>
    {#if note && !done}{#key noteKey}<p class="note" role="status">{note}</p>{/key}{/if}
  {:else if review.kind === 'gap'}
    {@const g = review.gap}
    <div class="paper sol"><p>{g.before.trimStart()}<b class="gap" class:filled={done}>{done ? g.answer : '?'}</b>{g.after}</p></div>
    {#if !done}
      <div class="opts" class:lock={locked}>
        {#each g.options as o, i}
          <button class="ans" class:wrong={wrong.includes(i)} disabled={locked || wrong.includes(i)} onclick={() => tapOpt(o === g.answer, i, HINT.gap)}>{o}</button>
        {/each}
      </div>
      {#if note}{#key noteKey}<p class="note" role="status">{note}</p>{/key}{/if}
    {/if}
  {:else if review.kind === 'check'}
    {@const mc = review.mc}
    <div class="paper sol"><b class="cq">{mc.prompt}</b></div>
    <div class="cards" class:lock={locked}>
      {#each mc.options as o, i}
        <button class="card" class:ok={done && i === mc.answer} class:miss={wrong.includes(i)} disabled={done || locked || wrong.includes(i)} onclick={() => tapOpt(i === mc.answer, i, RUSH_STEP.checkWrong)}>{o}</button>
      {/each}
    </div>
    {#if note && !done}{#key noteKey}<p class="note" role="status">{note}</p>{/key}{/if}
  {:else}
    <div class="paper sol"><p>{review.sol}</p></div>
  {/if}

  {#if done && whyText}<p class="why">{whyText}</p>{/if}
  {#if done || review.kind === 'read'}
    <button class="btn primary big block nxt" class:charging={gate.on} class:charged={gate.done} style="--gate:{gate.ms}ms" onclick={() => (gate.on ? nope() : onnext())}>{gate.on ? 'Оқы…' : REVIEW_SAY.next}</button>
    {@render children?.()}
  {/if}
</div>

<style>
  .rv { display: grid; gap: 10px; align-content: start; animation: rvIn .35s var(--ease-out) both; }
  .your { color: var(--dim); font: 800 14px var(--txt); }
  .your b { color: #ff9a8a; font: 900 17px var(--disp); }
  .lines { display: grid; gap: 7px; }
  .line { position: relative; display: flex; gap: 10px; align-items: center; text-align: left; min-height: 44px; color: var(--paper-ink); background: #fff; border: 3px solid var(--outline); border-radius: 12px; padding: 7px 11px; cursor: pointer; font: 800 16px var(--disp); box-shadow: 0 3px 0 var(--outline); }
  .line:disabled { cursor: default; }
  .line:not(:disabled):active { transform: translateY(2px); box-shadow: 0 1px 0 var(--outline); }
  .line .n { flex: none; width: 22px; height: 22px; border-radius: 6px; background: var(--paper-line, #d6ddf7); display: grid; place-items: center; font: 900 12px var(--disp); }
  .line .tx { min-width: 0; overflow-wrap: anywhere; line-height: 1.25; }
  .line.miss { background: #fff1ec; border-color: var(--miss); animation: shake .35s; }
  .line.soft { background: #fff3c2; }
  .line.bad { background: #ffe0f1; border-color: var(--glitch); animation: shake .35s; }
  .line.bad .tx { padding-right: 58px; } .line.soft .tx { padding-right: 74px; }
  .stamp { position: absolute; right: 10px; top: 50%; transform: translateY(-50%) rotate(-8deg); font: 800 13px var(--txt); font-style: normal; color: var(--glitch); border: 2px solid var(--glitch); padding: 2px 6px; background: #fff; }
  .stamp.soft { color: #8a6100; border-color: #c99a1a; background: #fff8dc; }
  .note { color: #3a2400; background: linear-gradient(180deg, #ffe07a, #f2b632); border: 3px solid var(--outline); border-radius: 12px; padding: 7px 11px; font: 800 14px/1.3 var(--txt); animation: hintIn .5s var(--ease-out) both; }
  .your.hot { animation: hot 1s ease-in-out 2; }
  .lock .line:not(.miss), .lock .card:not(.miss), .lock .ans:not(.wrong) { opacity: .55; }
  .fix { color: #b8ffd4; font-weight: 800; font-size: 15px; }
  .fix b { color: #5ce39c; }
  .cards { display: grid; gap: 8px; }
  .card { text-align: left; color: var(--paper-ink); background: #fff; border: 3px solid var(--outline); border-radius: 12px; padding: 9px 12px; cursor: pointer; font: 800 14.5px/1.3 var(--txt); box-shadow: 0 3px 0 var(--outline); }
  .card:disabled { cursor: default; }
  .card.miss { background: #ffe0d6; border-color: var(--miss); opacity: .6; animation: shake .35s; }
  .card.ok { background: #c9f7d8; border-color: var(--ok); }
  .paper.sol { padding: 10px 12px; }
  .paper.sol p { white-space: pre-line; font-size: 15px; line-height: 1.4; }
  .cq { font: 900 17px var(--disp); color: var(--code-deep); }
  .gap { display: inline-block; min-width: 2.2em; padding: 0 6px; text-align: center; border-radius: 8px; background: #ffe9a8; border: 2px dashed #b88a1a; color: #6b4a0a; }
  .gap.filled { background: #c8f5d8; border-style: solid; border-color: var(--ok); color: #135c32; }
  .opts { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
  .opts .ans { justify-content: center; font: 900 18px var(--disp); min-height: 48px; }
  .why { font: 800 14.5px/1.4 var(--txt); color: #fff; animation: rvIn .35s both; }
  .nxt { animation: rvIn .35s .1s both; }
  @keyframes hintIn { 0% { transform: scale(.94); box-shadow: 0 0 0 0 #ffd54088; } 40% { transform: scale(1.02); box-shadow: 0 0 18px 6px #ffd540aa; } 100% { transform: none; box-shadow: none; } }
  @keyframes hot { 50% { background: #ffe07a33; box-shadow: 0 0 0 6px #ffe07a33; border-radius: 10px; } }
  @keyframes rvIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
  @media (max-height: 740px) { .rv { gap: 7px; } .line { min-height: 38px; padding: 4px 10px; font-size: 15px; } .card { padding: 6px 10px; font-size: 13.5px; } .nxt { min-height: 50px; padding-top: 10px; padding-bottom: 12px; } }
  @media (max-height: 460px) { .rv { gap: 5px; } .card { padding: 4px 8px; font-size: 12.5px; } .line { min-height: 32px; font-size: 13.5px; } .your { font-size: 12px; } .your b { font-size: 14px; } .why { font-size: 13px; } .nxt { min-height: 42px; font-size: 15px; padding: 6px 12px 9px; } }
  @media (prefers-reduced-motion: reduce) { .rv, .why, .nxt, .note, .your.hot { animation: none; } }
</style>
