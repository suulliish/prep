<script lang="ts">
  // Разложи по кругам: каждый элемент — «только A», «оба» или «только B». Ошибка — подсказка, можно снова.
  import { audio } from '../lib/audio';
  type It = { t: string; g: 'a' | 'both' | 'b' };
  let { items = [] as It[], an = 'A', bn = 'B', ondone }: { items?: It[]; an?: string; bn?: string; ondone?: () => void } = $props();
  let placed = $state<Record<number, string>>({});
  let wrong = $state(-1);
  const left = $derived(items.map((_, i) => i).filter(i => !placed[i]));
  function put(i: number, g: string) {
    if (items[i].g !== g) { wrong = i; audio.play('wrong'); setTimeout(() => (wrong = -1), 500); return; }
    placed[i] = g; audio.play('click');
    if (Object.keys(placed).length === items.length) { audio.play('correct'); setTimeout(() => ondone?.(), 600); }
  }
</script>

<div class="ss">
  <div class="zones">
    <div class="z a"><b>тек {an}</b>{#each items as it, i}{#if placed[i] === 'a'}<span>{it.t}</span>{/if}{/each}</div>
    <div class="z both"><b>екеуі де</b>{#each items as it, i}{#if placed[i] === 'both'}<span>{it.t}</span>{/if}{/each}</div>
    <div class="z b"><b>тек {bn}</b>{#each items as it, i}{#if placed[i] === 'b'}<span>{it.t}</span>{/if}{/each}</div>
  </div>
  {#if left.length}
    {@const i = left[0]}
    <div class="cur" class:bad={wrong === i}>
      <span class="it">{items[i].t}</span>
      <div class="btns"><button class="btn small" onclick={() => put(i, 'a')}>тек {an}</button><button class="btn small" onclick={() => put(i, 'both')}>екеуі де</button><button class="btn small" onclick={() => put(i, 'b')}>тек {bn}</button></div>
    </div>
  {/if}
</div>

<style>
  .ss { display: grid; gap: 12px; }
  .zones { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 6px; }
  .z { display: flex; flex-wrap: wrap; gap: 4px; align-content: flex-start; min-height: 90px; padding: 8px; border: 2px solid; border-radius: 12px; }
  .z b { width: 100%; font-size: 12px; }
  .z span { font-weight: 800; font-size: 14px; padding: 2px 6px; border-radius: 6px; background: var(--panel-hi); animation: pop-in .3s var(--ease-out); }
  .z.a { border-color: var(--code); color: var(--code); } .z.b { border-color: var(--glitch); color: var(--glitch); } .z.both { border-color: var(--gold); color: var(--gold); }
  .z span { color: var(--ink); }
  .cur { display: grid; gap: 8px; justify-items: center; }
  .cur.bad { animation: shake .35s; }
  .it { font-size: 22px; font-weight: 800; padding: 6px 16px; background: var(--deep); border: 2px solid var(--line-hi); border-radius: 10px; }
  .btns { display: flex; gap: 6px; flex-wrap: wrap; justify-content: center; }
  .btn.small { min-height: 40px; padding: 6px 12px; font-size: 14px; }
</style>
