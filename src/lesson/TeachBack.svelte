<script lang="ts">
  // «Биткә түсіндір»: после «Есте сақта» ребёнок объясняет тему Биту своими словами (эффект «protégé», Chase 2009:
  // объясняя другому, понимаешь глубже). Бит здесь ученик, а не учитель.
  // Без входа в облако или без сети — меню из трёх объяснений: верное, с типичной ошибкой, «так написано» (Vest 2022).
  // Со входом — свободный ответ (поле + слова-кирпичики), ИИ оценивает по правилу: понял / частично / ошибка.
  // Максимум 2 ответа ребёнка, потом итог. ИИ падает посреди шага — сразу переходим на меню, шаг не ломается.
  import { onMount, tick } from 'svelte';
  import Bit from '../ui/Bit.svelte';
  import MathLine from './MathLine.svelte';
  import { audio } from '../lib/audio';
  import { askBitTeach, type Turn, type TeachContext, type TeachReply, type HelperError } from '../lib/helper';
  import { MAX_TEACH_ROUNDS } from '../engine/helperPayload';
  import { menuCards, teachQuestion, teachOpening, bricksFor, addBrick, menuResult, aiResult, aiFinished, TEACH_FALLBACK, type TeachResult } from './teachback';

  // ask и signedIn — подмена для проверок без сервера и без входа; в игре не нужны
  let { skill, title, rule, examples, ondone, ask = askBitTeach, signedIn }: {
    skill: string; title: string; rule: { kz: string; lines: string[] }; examples?: string[];
    ondone: (result: TeachResult) => void; ask?: typeof askBitTeach; signedIn?: boolean;
  } = $props();

  // облако грузится лениво (Firebase — отдельный кусок сайта), как в LessonHelper.svelte
  let C = $state<typeof import('../lib/cloud.svelte') | null>(null);
  let cloudFailed = $state(false);
  // «Өткізіп жіберу» прячем: она появляется после сбоя ИИ/сети или через SKIP_AFTER_MS после открытия (ребёнок не должен проскакивать шаг)
  const SKIP_AFTER_MS = 45000;
  let failed = $state(false), late = $state(false);
  onMount(() => {
    if (signedIn === undefined) import('../lib/cloud.svelte').then(m => (C = m)).catch(() => (cloudFailed = true));
    const t = window.setTimeout(() => (late = true), SKIP_AFTER_MS);
    return () => clearTimeout(t);
  });

  const question = $derived(teachQuestion(skill));
  const cards = $derived(menuCards(skill));
  const bricks = $derived(bricksFor(skill));
  const ctx = $derived<TeachContext>({ skill, title, rule, question, examples });

  // режим фиксируется, как только ребёнок начал: вход в облако не должен переключить экран на середине ответа
  let locked = $state<'menu' | 'ai' | null>(null);
  const live = $derived(signedIn !== undefined ? (signedIn ? 'ai' : 'menu') : C ? (C.cloud.user ? 'ai' : 'menu') : cloudFailed ? 'menu' : 'wait');
  const mode = $derived(locked ?? (live === 'wait' ? 'wait' : live === 'ai' ? 'ai' : 'menu'));
  let note = $state('');            // почему вместо ИИ меню (нет сети, лимит…)
  let finished = false;

  // ---- меню ----
  let out = $state<number[]>([]);   // отвергнутые карточки
  let right = $state<number | null>(null);
  let why = $state('');             // разбор последней неверной карточки
  const misses = $derived(out.length);
  function choose(k: number) {
    if (right !== null || out.includes(k)) return;
    locked = 'menu';
    const c = cards![k];
    if (c.kind === 'good') { right = k; why = ''; audio.play('correct'); return; }
    out = [...out, k]; why = c.why; audio.play('wrong');
  }

  // ---- ИИ ----
  let turns = $state<Turn[]>([]);   // kid / bit по очереди; первый вопрос Бита в turns не хранится
  let text = $state('');
  let busy = $state(false);
  let reply = $state<TeachReply | null>(null);
  const answers = $derived(turns.filter(t => t.role === 'kid').length);
  const over = $derived(reply !== null && aiFinished(reply.verdict, answers));
  async function send(answer: string) {
    const a = answer.trim();
    if (busy || !a) return;
    locked = 'ai'; busy = true;
    const history = $state.snapshot(turns) as Turn[];
    try {
      const r = await ask(ctx, history, a);
      turns.push({ role: 'kid', text: a });
      turns.push({ role: 'bit', text: [r.reply, r.followup].filter(Boolean).join(' ') });
      reply = r; text = '';
      audio.play(r.verdict === 'got' ? 'correct' : 'hint');
    } catch (e) {
      // ИИ не ответил: прежние ответы остаются ни к чему, ребёнка переводим на меню без штрафа
      note = TEACH_FALLBACK[e as HelperError] ?? TEACH_FALLBACK.ai_unavailable;
      locked = 'menu'; failed = true;
    }
    busy = false;
  }

  // ---- общее ----
  const menuDone = $derived(right !== null);
  const done = $derived(mode === 'ai' ? over : menuDone);
  const noBank = $derived(mode === 'menu' && !cards);
  function finish(r: TeachResult) { if (finished) return; finished = true; ondone(r); }
  const result = $derived<TeachResult>(mode === 'ai' && reply ? aiResult(reply.verdict) : menuResult(misses));

  const bitText = $derived.by(() => {
    if (mode === 'wait') return teachOpening(question);
    if (mode === 'menu') {
      if (noBank) return note || 'Бұл тақырыпқа түсіндіру әзірге жоқ. Жалғастыра бер!';
      const head = note ? `${note} ` : '';
      if (right !== null) return misses ? 'Дұрыс таптың! Мұнда себебі айтылған, сондықтан бұл жақсы түсіндіру.' : 'Дәл солай! Мұнда неге екені айтылған: бұл — нағыз түсіндіру.';
      if (out.length) return `${why} Басқасын таңда.`;
      return `${head}${teachOpening(question)} Мен үш түсіндірме естідім. Қайсысы ең жақсы?`;
    }
    const last = turns.length ? turns[turns.length - 1] : null;
    if (busy) return 'Бит ойланып жатыр…';
    return last?.role === 'bit' ? last.text : teachOpening(question);
  });
  const mood = $derived<'idle' | 'happy' | 'think' | 'sad'>(
    busy ? 'think' : mode === 'ai' && reply ? (reply.verdict === 'got' ? 'happy' : 'think') : right !== null ? 'happy' : 'think');

  // новая реплика или кнопка появились ниже: показать их
  let root = $state<HTMLElement>();
  $effect(() => {
    void turns.length; void right; void out.length; void done; void mode;
    tick().then(() => (root?.querySelector('.tb-next') ?? root?.querySelector('textarea'))?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }));
  });
</script>

<div class="tb" bind:this={root}>
  <span class="tag tb-tag">Биткә түсіндір</span>
  {#if mode === 'ai' && turns.length >= 2}<p class="tb-kid">— {turns[turns.length - 2].text}</p>{/if}
  <Bit text={bitText} {mood} compact />

  {#if mode === 'menu' && cards}
    <div class="tb-cards">
      {#each cards as c, k}
        <button class="ans tb-card" class:right={right === k} class:wrong={out.includes(k)} class:out={right !== null && right !== k && !out.includes(k)}
          disabled={right !== null || out.includes(k)} onclick={() => choose(k)}>
          <span class="l">{right === k ? '✓' : out.includes(k) ? '✗' : 'ABC'[k]}</span><span class="ct"><MathLine text={c.text} inherit /></span>
        </button>
      {/each}
    </div>
  {:else if mode === 'ai' && !over}
    <div class="tb-bricks" role="group" aria-label="Сөздер">
      {#each bricks as b}<button class="brick" disabled={busy} onclick={() => (text = addBrick(text, b))}>{b}</button>{/each}
    </div>
    <form class="tb-ask" onsubmit={(e) => { e.preventDefault(); send(text); }}>
      <textarea bind:value={text} rows="3" maxlength="300" placeholder="Өз сөзіңмен жаз…" aria-label="Түсіндірмең" disabled={busy} onkeydown={(e) => e.stopPropagation()}></textarea>
      <div class="tb-row">
        <button class="btn primary" disabled={busy || !text.trim()}>{busy ? '…' : 'Жіберу'}</button>
        <button type="button" class="btn ghost" disabled={busy} onclick={() => send('Білмеймін')}>Білмеймін</button>
      </div>
    </form>
    {#if answers}<p class="tb-hint">Түсіндіру: {answers}/{MAX_TEACH_ROUNDS}</p>{/if}
  {/if}

  {#if done || noBank}
    <button class="btn big go tb-next" onclick={() => finish(noBank ? 'skipped' : result)}>Жалғастыру</button>
  <!-- пропустить можно после сбоя ИИ/сети, а разговор с ИИ ещё и через 45 с; меню из трёх карточек без сбоя проходится всегда: цель шага — не пролистать объяснение -->
  {:else if failed || (mode === 'ai' && late)}
    <button class="btn ghost tb-skip" disabled={busy} onclick={() => finish('skipped')}>Өткізіп жіберу</button>
  {/if}
</div>

<style>
  .tb { display: grid; gap: 12px; animation: pop-in .3s var(--ease-out) both; }
  .tb-tag { justify-self: start; background: var(--crystal); }
  .tb-kid { margin: 0; padding-left: 52px; color: var(--dim); font-style: italic; overflow-wrap: anywhere; }
  .tb-cards { display: grid; gap: 10px; }
  .tb-card { min-height: 56px; align-items: flex-start; padding: 10px 12px; font: 800 clamp(15px, 4.3vw, 18px)/1.3 var(--disp); }
  .tb-card .l { margin-top: 1px; }
  .ct { min-width: 0; overflow-wrap: break-word; }
  .tb-card.wrong { animation: shake .35s; }
  .tb-bricks { display: flex; flex-wrap: wrap; gap: 8px; }
  .brick { min-height: 40px; padding: 4px 12px; font: 800 15px var(--txt); color: var(--paper-ink); background: var(--paper); border: 3px solid var(--outline); border-radius: 999px; box-shadow: inset 0 -3px 0 var(--paper-2), 0 2px 0 var(--outline); cursor: pointer; }
  .brick:active { transform: translateY(2px); }
  .brick:disabled { opacity: .5; cursor: default; }
  .tb-ask { display: grid; gap: 10px; }
  .tb-ask textarea { width: 100%; resize: none; font: 700 16px/1.4 var(--txt); color: var(--paper-ink); background: var(--paper); border: 3px solid var(--outline); border-radius: 12px; padding: 10px 12px; }
  .tb-ask textarea:focus-visible { outline: 3px solid var(--code); outline-offset: 2px; }
  .tb-row { display: flex; gap: 10px; }
  .tb-row .btn { flex: 1; min-height: 48px; padding: 8px 12px 11px; font-size: 16px; }
  .tb-hint { margin: 0; color: var(--dim); font: 700 12px var(--txt); text-align: right; }
  .tb-skip { justify-self: end; min-height: 36px; padding: 4px 12px 7px; font-size: 13px; }
  .tb-next { justify-self: stretch; }
</style>
