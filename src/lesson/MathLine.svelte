<script lang="ts">
  // Строка выкладки: [..] — подсвеченная часть, ▢ — пропуск (заполняется значением fill),
  // 3/4 и 2 3/4 — этажные дроби (Frac), числа с разрядами не рвутся при переносе (rich.ts).
  // big — крупная строка выкладки; inherit — не задавать свой размер, взять шрифт родителя (варианты ответа, вопросы, подписи).
  // ontap — подсвеченная часть становится кнопкой: касание = «прочитал» (открывает «дальше», D12 в Lesson.svelte).
  import Frac from '../ui/Frac.svelte';
  import { parseRich, type RichPart } from './rich';
  let { text, fill = null, big = false, inherit = false, ontap }: { text: string; fill?: string | null; big?: boolean; inherit?: boolean; ontap?: (e: Event) => void } = $props();
  const parts = $derived(parseRich(text));
  const fillParts = $derived(fill === null ? [] : parseRich(fill));
  const press = (e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ontap?.(e); } };
</script>

{#snippet seg(ps: RichPart[])}
  {#each ps as x}
    {#if x.t === 'frac'}<Frac whole={x.whole} n={x.n} d={x.d} />{:else if x.t === 'text'}{x.s}{/if}
  {/each}
{/snippet}

<span class="ml num" class:big class:inh={inherit}>
  {#each parts as p}
    {#if p.t === 'blank'}<b class="blank" class:filled={fill !== null}>{#if fill !== null}{@render seg(fillParts)}{:else}?{/if}</b>
    {:else if p.t === 'hl'}
      {#if ontap}<b class="hl tap" role="button" tabindex="0" onclick={ontap} onkeydown={press}>{@render seg(p.parts)}</b>
      {:else}<b class="hl">{@render seg(p.parts)}</b>{/if}
    {:else}{@render seg([p])}{/if}
  {/each}
</span>

<style>
  .ml { font-size: 22px; font-weight: 800; letter-spacing: .02em; white-space: pre-wrap; }
  .ml.big { font-size: 28px; }
  .ml.inh { font: inherit; letter-spacing: 0; white-space: normal; }
  /* inline-flex: подсветка охватывает всю высоту этажной дроби, а нижняя полоска идёт под знаменателем, а не через него */
  .hl { display: inline-flex; align-items: center; vertical-align: middle; line-height: 1.15; color: var(--gold); background: #ffc94a1f; border-bottom: 3px solid var(--gold); padding: .06em .3em .1em; border-radius: 4px; animation: pop-in .35s var(--ease-out); }
  .hl.tap { cursor: pointer; justify-content: center; min-width: 44px; min-height: 40px; -webkit-tap-highlight-color: transparent; animation: pop-in .35s var(--ease-out), tapglow 1.4s .5s ease-in-out infinite; }
  .hl.tap:focus-visible { outline: 3px solid var(--code-deep, #1aa9c4); outline-offset: 2px; }
  @keyframes tapglow { 50% { box-shadow: 0 0 0 5px #ffc94a66; } }
  .blank { display: inline-flex; align-items: center; justify-content: center; vertical-align: middle; min-width: 1.6em; color: var(--glitch); background: #ff4fb81a; border: 2px dashed var(--glitch); border-radius: 6px; padding: 0 6px; animation: broken 1.4s infinite; }
  .blank.filled { color: var(--code); border-color: var(--code); }
  @keyframes broken { 0%, 100% { box-shadow: 0 0 0 #ff4fb800; } 50% { box-shadow: 0 0 12px #ff4fb888; } }
  .blank.filled { border-style: solid; background: #3ff0ff1f; animation: pop-in .35s var(--ease-out); }
  @media (prefers-reduced-motion: reduce) { .hl.tap { animation: none; } }
</style>
