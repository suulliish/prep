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
  {#if found}<p class="fix appear">{fix}</p>{/if}
</div>

<style>
  .bh { display: grid; gap: 8px; }
  .line { position: relative; display: flex; gap: 12px; align-items: center; text-align: left; color: var(--paper-ink); background: #fff; border: 3px solid var(--outline); border-radius: 12px; padding: 10px 12px; cursor: pointer; font: inherit; box-shadow: 0 3px 0 var(--outline); }
  .line:active { transform: translateY(2px); }
  .n { color: var(--paper-dim); font-weight: 800; }
  .line.ok { background: #c9f7d8; }
  .line.after { background: #fff3c2; }
  .line.bad { background: #ffe0f1; animation: shake .35s; }
  .stamp { position: absolute; right: 10px; top: 50%; transform: translateY(-50%) rotate(-8deg); font: 800 14px var(--txt); font-style: normal; color: var(--glitch); border: 2px solid var(--glitch); padding: 2px 6px; }
  .note { color: var(--paper-dim); font-weight: 700; }
  .fix { font-weight: 800; color: var(--ok-deep); font-size: 18px; }
</style>
