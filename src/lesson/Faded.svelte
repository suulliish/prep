<script lang="ts">
  // «Өзің»: решение, где часть шагов пропущена. Готовые шаги открываются кнопкой, пропуски — выбором.
  // Ошибка не штрафуется: подсказка why, можно выбрать снова (Renkl 2002 — постепенное убирание шагов).
  import MathLine from './MathLine.svelte';
  import { tick } from 'svelte';
  import { audio } from '../lib/audio';
  type Step = { math: string; kz?: string; blank?: { choices: string[]; answer: number; why?: string } };
  // onstep — верно вписан очередной пропуск (k-й по счёту), onmiss — ошибка: урок-тренировка отвечает ударом связки и шлепком манекена
  let { task, steps, ondone, onstep, onmiss }: { task: string; steps: Step[]; ondone: (clean: boolean) => void; onstep?: (k: number) => void; onmiss?: () => void } = $props();
  let hits = 0;
  let shown = $state(1);
  let filled = $state<Record<number, string>>({});
  let wrong = $state<{ at: number; pick: number } | null>(null);
  let misses = 0;
  let missHere = $state(0); // ошибки на текущем пропуске: 1-я — подсказка, 2-я — ответ
  const cur = $derived(shown - 1);
  const waiting = $derived(!!steps[cur]?.blank && filled[cur] === undefined);
  function advance() {
    if (shown < steps.length) { shown++; audio.play('click'); }
    if (shown === steps.length && !steps[shown - 1].blank) ondone(misses === 0);
  }
  function pick(k: number) {
    const b = steps[cur].blank!;
    if (k !== b.answer) { wrong = { at: cur, pick: k }; misses++; missHere++; audio.play('wrong'); onmiss?.(); return; }
    filled[cur] = b.choices[k]; wrong = null; missHere = 0; audio.play('correct'); onstep?.(++hits);
    if (shown === steps.length) ondone(misses === 0);
  }
  $effect(() => { if (steps.length === 1 && !steps[0].blank) ondone(true); });
  // новая строка или подсказка появились ниже — показать их (панель прокручивается, но ребёнок не должен искать)
  let root = $state<HTMLElement>();
  let first = true;
  $effect(() => {
    void shown; void wrong; void missHere;
    if (first) { first = false; return; }
    tick().then(() => (root?.querySelector('.hint') ?? root?.querySelector('.pick') ?? root?.querySelector('.btn.primary'))?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }));
  });
</script>

<div class="fd" bind:this={root}>
  <p class="task"><MathLine text={task} inherit /></p>
  <ol>
    {#each steps.slice(0, shown) as s, k}
      <li class="appear" class:cur={k === cur}>
        <MathLine text={s.math} fill={s.blank ? filled[k] ?? null : null} />
        {#if s.kz}<small><MathLine text={s.kz} inherit /></small>{/if}
      </li>
    {/each}
  </ol>
  {#if waiting}
    <div class="pick">
      {#each steps[cur].blank!.choices as c, k}
        <button class="ans" class:wrong={wrong?.at === cur && wrong.pick === k} class:sel={missHere >= 2 && k === steps[cur].blank!.answer} onclick={() => pick(k)}><MathLine text={c} inherit /></button>
      {/each}
    </div>
    {#if wrong?.at === cur}<p class="hint">{#if missHere >= 2}<MathLine text={steps[cur].blank!.why ?? ''} inherit />{:else}Әзірге қате. Жоғарыдағы қадамдарды қайта қарап, тағы ойлан.{/if}</p>{/if}
  {:else if shown < steps.length}
    <button class="btn primary" onclick={advance}>Келесі қадам ↓</button>
  {/if}
</div>

<style>
  .fd { display: grid; gap: 12px; }
  .task { font-size: 19px; font-weight: 800; }
  ol { margin: 0; padding-left: 24px; display: grid; gap: 10px; }
  li { opacity: .6; display: grid; gap: 2px; }
  li.cur { opacity: 1; }
  li small { color: var(--paper-dim); font-weight: 700; font-size: 15px; }
  .pick { display: flex; gap: 8px; flex-wrap: wrap; }
  .pick .ans { width: auto; min-width: 72px; justify-content: center; }
  @media (max-height: 720px) { .fd { gap: 8px; } .task { font-size: 17px; } .pick .ans { min-height: 44px; } ol { gap: 6px; } }
  .pick .ans.wrong { animation: shake .35s; }
  .hint { color: var(--miss-deep); font-weight: 800; }
</style>
