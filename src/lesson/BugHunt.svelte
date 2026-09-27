<script lang="ts">
  // «Глитчтің қатесі»: найти строку, где началась ошибка (разбор ошибочных примеров, Adams 2014).
  import MathLine from './MathLine.svelte';
  import { audio } from '../lib/audio';
  let { lines, bad, follows = [], fix, ondone }: { lines: string[]; bad: number; follows?: number[]; fix: string; ondone: (clean: boolean) => void } = $props();
  let found = $state(false);
  let note = $state<{ at: number; text: string } | null>(null);
  let misses = 0;
  function tap(k: number) {
    if (found) return;
    if (k === bad) { found = true; note = null; audio.play('hit'); ondone(misses === 0); return; }
    misses++; audio.play('wrong');
    note = { at: k, text: follows.includes(k) ? 'Бұл жол да қате, бірақ ол — салдар. Қате одан ертерек басталды.' : 'Бұл жол дұрыс. Ары қарай ізде.' };
  }
</script>

<div class="bh">
  {#each lines as l, k}
    <button class="line" class:bad={found && k === bad} class:ok={note?.at === k && !follows.includes(k)} class:after={note?.at === k && follows.includes(k)} onclick={() => tap(k)}>
      <span class="n">{k + 1}</span><MathLine text={l} />
      {#if found && k === bad}<i class="stamp">ҚАТЕ</i>{/if}
    </button>
  {/each}
  {#if note}<p class="note">{note.text}</p>{/if}
  {#if found}<p class="fix appear">🔧 {fix}</p>{/if}
</div>

<style>
  .bh { display: grid; gap: 8px; }
  .line { position: relative; display: flex; gap: 12px; align-items: center; text-align: left; color: var(--ink); background: var(--deep); border: 2px solid var(--line); border-radius: 8px; padding: 10px 12px; cursor: pointer; font: inherit; }
  .line:hover { border-color: var(--line-hi); }
  .n { color: var(--dim); font-weight: 800; }
  .line.ok { border-color: var(--ok); }
  .line.after { border-color: var(--gold); }
  .line.bad { border-color: var(--glitch); background: #ff4fb81a; animation: shake .35s; }
  .stamp { position: absolute; right: 10px; top: 50%; transform: translateY(-50%) rotate(-8deg); font: 800 14px var(--txt); font-style: normal; color: var(--glitch); border: 2px solid var(--glitch); padding: 2px 6px; }
  .note { color: var(--dim); font-weight: 700; }
  .fix { font-weight: 800; color: var(--ok); font-size: 18px; }
</style>
