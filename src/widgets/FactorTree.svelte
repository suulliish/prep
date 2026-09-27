<script lang="ts">
  // Дерево множителей: нажимай на составное число — оно раскалывается на два множителя; простые светятся.
  import { audio } from '../lib/audio';
  let { n = 60, ondone }: { n?: number; ondone?: (primes: number[]) => void } = $props();
  type Node = { v: number; kids?: [Node, Node] };
  let root = $state<Node>({ v: n });
  const isPrime = (x: number) => { if (x < 2) return false; for (let p = 2; p * p <= x; p++) if (x % p === 0) return false; return true; };
  const smallest = (x: number) => { for (let p = 2; p * p <= x; p++) if (x % p === 0) return p; return x; };
  function leaves(t: Node): number[] { return t.kids ? [...leaves(t.kids[0]), ...leaves(t.kids[1])] : [t.v]; }
  function split(t: Node) {
    if (t.kids || isPrime(t.v)) return;
    const p = smallest(t.v); t.kids = [{ v: p }, { v: t.v / p }];
    audio.play(isPrime(t.v / p) ? 'correct' : 'hit');
    root = { ...root };
    const ls = leaves(root);
    if (ls.every(isPrime)) setTimeout(() => ondone?.(ls.sort((a, b) => a - b)), 700);
  }
  const done = $derived(leaves(root).every(isPrime));
</script>

{#snippet tree(t: Node)}
  <div class="node">
    <button class="val num" class:prime={isPrime(t.v)} class:open={!!t.kids} onclick={() => split(t)} disabled={isPrime(t.v) || !!t.kids}>{t.v}</button>
    {#if t.kids}<div class="kids">{@render tree(t.kids[0])}{@render tree(t.kids[1])}</div>{/if}
  </div>
{/snippet}

<div class="ft">
  {@render tree(root)}
  <p class="msg">{done ? `${n} = ${leaves(root).sort((a, b) => a - b).join(' · ')}` : 'Құрама санды бас — ол екі көбейткішке бөлінеді. Жай сандар жарқырайды.'}</p>
</div>

<style>
  .ft { display: grid; gap: 12px; justify-items: center; overflow-x: auto; }
  .node { display: flex; flex-direction: column; align-items: center; gap: 10px; }
  .kids { display: flex; gap: 14px; position: relative; padding-top: 6px; border-top: 2px solid var(--line-hi); }
  .val { min-width: 54px; height: 44px; font-size: 22px; color: var(--ink); background: var(--panel-hi); border: 2px solid var(--line-hi); border-bottom-width: 5px; border-radius: 6px; cursor: pointer; animation: pop-in .35s var(--ease-out); }
  .val:not(:disabled):hover { border-color: var(--code); }
  .val.prime { background: var(--ok-deep); border-color: var(--ok); color: #d9ffe9; box-shadow: 0 0 12px #5ce39c55; cursor: default; }
  .val.open { opacity: .6; cursor: default; }
  .msg { font-weight: 700; text-align: center; }
</style>
