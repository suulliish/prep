<script lang="ts">
  // «Өзің»: решение, где часть шагов пропущена. Готовые шаги открываются кнопкой, пропуски — выбором.
  // Ошибка не штрафуется: подсказка why, можно выбрать снова (Renkl 2002 — постепенное убирание шагов).
  import MathLine from './MathLine.svelte';
  import { audio } from '../lib/audio';
  type Step = { math: string; kz?: string; blank?: { choices: string[]; answer: number; why?: string } };
  let { task, steps, ondone }: { task: string; steps: Step[]; ondone: (clean: boolean) => void } = $props();
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
    if (k !== b.answer) { wrong = { at: cur, pick: k }; misses++; missHere++; audio.play('wrong'); return; }
    filled[cur] = b.choices[k]; wrong = null; missHere = 0; audio.play('correct');
    if (shown === steps.length) ondone(misses === 0);
  }
  $effect(() => { if (steps.length === 1 && !steps[0].blank) ondone(true); });
</script>

<div class="fd">
  <p class="task">{task}</p>
  <ol>
    {#each steps.slice(0, shown) as s, k}
      <li class="appear" class:cur={k === cur}>
        <MathLine text={s.math} fill={s.blank ? filled[k] ?? null : null} />
        {#if s.kz}<small>{s.kz}</small>{/if}
      </li>
    {/each}
  </ol>
  {#if waiting}
    <div class="pick">
      {#each steps[cur].blank!.choices as c, k}
        <button class="ans" class:wrong={wrong?.at === cur && wrong.pick === k} class:sel={missHere >= 2 && k === steps[cur].blank!.answer} onclick={() => pick(k)}>{c}</button>
      {/each}
    </div>
    {#if wrong?.at === cur}<p class="hint">{missHere >= 2 ? steps[cur].blank!.why ?? '' : 'Әзірге қате. Жоғарыдағы қадамдарды қайта қарап, тағы ойлан.'}</p>{/if}
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
  .pick .ans.wrong { animation: shake .35s; }
  .hint { color: var(--miss-deep); font-weight: 800; }
</style>
