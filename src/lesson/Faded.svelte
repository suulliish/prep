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
  const cur = $derived(shown - 1);
  const waiting = $derived(!!steps[cur]?.blank && filled[cur] === undefined);
  function advance() {
    if (shown < steps.length) { shown++; audio.play('click'); }
    if (shown === steps.length && !steps[shown - 1].blank) ondone(misses === 0);
  }
  function pick(k: number) {
    const b = steps[cur].blank!;
    if (k !== b.answer) { wrong = { at: cur, pick: k }; misses++; audio.play('wrong'); return; }
    filled[cur] = b.choices[k]; wrong = null; audio.play('correct');
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
        <button class="choice" class:wrong={wrong?.at === cur && wrong.pick === k} onclick={() => pick(k)}>{c}</button>
      {/each}
    </div>
    {#if wrong?.at === cur}<p class="hint">Тағы ойлан. {steps[cur].blank!.why ?? ''}</p>{/if}
  {:else if shown < steps.length}
    <button class="btn primary" onclick={advance}>Келесі қадам ↓</button>
  {/if}
</div>

<style>
  .fd { display: grid; gap: 12px; }
  .task { font-size: 20px; font-weight: 800; color: var(--code); }
  ol { margin: 0; padding-left: 24px; display: grid; gap: 10px; }
  li { opacity: .6; display: grid; gap: 2px; }
  li.cur { opacity: 1; }
  li small { color: var(--dim); font-weight: 700; font-size: 15px; }
  .pick { display: flex; gap: 8px; flex-wrap: wrap; }
  .choice { font: 800 20px var(--txt); color: var(--ink); background: var(--deep); border: 2px solid var(--code); border-bottom-width: 5px; border-radius: 8px; padding: 10px 16px; cursor: pointer; min-width: 64px; }
  .choice.wrong { border-color: var(--miss); background: var(--miss-deep); animation: shake .35s; }
  .hint { color: var(--gold); font-weight: 700; }
</style>
