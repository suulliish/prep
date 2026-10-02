<script lang="ts">
  // Кнопка «Түсінбедім — Биттен сұра» в уроке (образец: блок ИИ в Session.svelte).
  // По умолчанию виден только компактный ряд-кнопка; ответ Бита и поле уточняющего вопроса разворачиваются под ним.
  // Не вошёл в облако: вместо кнопки одна тихая строка. Сброс разговора при смене шага или кадра.
  import { onMount, untrack } from 'svelte';
  import Bit from '../ui/Bit.svelte';
  import Icon from '../ui/Icon.svelte';
  import MicButton from '../ui/MicButton.svelte';
  import { audio } from '../lib/audio';
  import { askBitLesson, HELPER_ERR, MAX_QUESTIONS, type Turn, type LessonContext, type HelperError } from '../lib/helper';
  import { helperVisible, helperKey } from './helperGate';

  // ask: подмена запроса для проверок без сервера; в игре не нужна
  let { ctx, ask = askBitLesson }: { ctx: LessonContext; ask?: typeof askBitLesson } = $props();

  // облако грузится лениво (Firebase — отдельный кусок сайта), как в Commander.svelte
  let C = $state<typeof import('../lib/cloud.svelte') | null>(null);
  onMount(() => { import('../lib/cloud.svelte').then(m => (C = m)).catch(() => {}); });

  let turns = $state<Turn[]>([]);
  let busy = $state(false);
  let err = $state('');
  let q = $state('');
  let talking = $state(false);   // идёт запись голоса или расшифровка
  let open = $state(false);
  let gen = 0;   // номер разговора: ответ, пришедший после смены шага, выбрасывается
  const asked = $derived(turns.filter(t => t.role === 'kid').length);
  const key = $derived(helperKey(ctx));
  const visible = $derived(helperVisible(ctx.step?.type, ctx.answered));

  $effect(() => {
    key;
    untrack(() => { gen++; turns = []; busy = false; err = ''; q = ''; open = false; });
  });

  async function helpMe(question?: string) {
    if (busy) return;
    busy = true; err = ''; open = true;
    const mine = gen;
    const history = $state.snapshot(turns) as Turn[];
    try {
      const text = await ask(ctx, history, question);
      if (mine !== gen) return;
      if (question) turns.push({ role: 'kid', text: question });
      turns.push({ role: 'bit', text });
      q = '';
      audio.play('hint');
    } catch (e) { if (mine === gen) err = HELPER_ERR[(e as HelperError)] ?? HELPER_ERR.ai_unavailable; }
    if (mine === gen) busy = false;
  }
</script>

{#if visible && C}
  {#if !C.cloud.user}
    <p class="lh-hint">ИИ-көмекші облакқа кіргенде ашылады</p>
  {:else}
    <div class="lh">
      {#if !turns.length || !open}
        <button class="btn ghost lh-btn" onclick={() => (turns.length ? (open = true) : helpMe())} disabled={busy}>
          <Icon name="bulb" fill="var(--gold)" size={18} />{busy ? 'Бит ойланып жатыр…' : turns.length ? 'Биттің жауабы' : 'Түсінбедім — Биттен сұра'}
        </button>
      {/if}
      {#if open}
        {#each turns as t}
          {#if t.role === 'bit'}<Bit text={t.text} mood="think" compact />{:else}<p class="lh-kid">— {t.text}</p>{/if}
        {/each}
        {#if err}<p class="lh-err">{err}</p>{/if}
        {#if turns.length}
          {#if asked < MAX_QUESTIONS}
            <form class="lh-ask" onsubmit={(e) => { e.preventDefault(); if (q.trim() && !talking) helpMe(q); }}>
              <input bind:value={q} maxlength="200" placeholder="Тағы сұрағың бар ма? Жаз не айт…" disabled={busy || talking} onkeydown={(e) => e.stopPropagation()} />
              <MicButton bind:value={q} bind:active={talking} max={200} hint={ctx.title} disabled={busy} maxSec={25} compact label="Сұрағыңды айт" />
              <button class="btn" disabled={busy || talking || !q.trim()}>{busy ? '…' : 'Сұрау'}</button>
            </form>
          {/if}
          <button class="btn ghost lh-close" onclick={() => (open = false)}>Жабу</button>
        {/if}
      {/if}
    </div>
  {/if}
{/if}

<style>
  .lh { display: grid; gap: 14px; margin-top: 8px; }
  .lh-btn { min-height: 44px; padding: 6px 12px 9px; font-size: 15px; justify-self: start; gap: 6px; max-width: 100%; }
  .lh-hint { margin: 8px 0 0; font: 700 12px var(--txt); color: var(--dim); opacity: .8; }
  .lh-kid { margin: 0; color: var(--dim); font-style: italic; }
  .lh-err { margin: 0; color: var(--gold); }
  .lh-ask { display: flex; flex-wrap: wrap; gap: 8px; }
  .lh-ask input { flex: 1; min-width: 0; font: 700 16px var(--txt); color: var(--paper-ink); background: var(--paper); border: 3px solid var(--outline); border-radius: 12px; padding: 8px 10px; }
  .lh-close { justify-self: end; min-height: 36px; padding: 4px 12px 7px; font-size: 13px; }
</style>
