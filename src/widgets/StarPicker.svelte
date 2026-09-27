<script lang="ts">
  // Сейф с кодом: подбери цифру вместо *, чтобы число делилось на d. Сумма цифр считается на глазах.
  import { audio } from '../lib/audio';
  let { num = '5*2', d = 9, ondone }: { num?: string; d?: number; ondone?: () => void } = $props();
  let pick = $state<number | null>(null);
  const known = num.split('').filter(c => c !== '*').reduce((s, c) => s + +c, 0);
  const ok = $derived(pick !== null && (known + pick) % d === 0);
  function set(x: number) { pick = x; if ((known + x) % d === 0) { audio.play('correct'); setTimeout(() => ondone?.(), 700); } else audio.play('click'); }
</script>

<div class="sp">
  <div class="safe" class:open={ok}>
    {#each num.split('') as c}<span class="dg num" class:star={c === '*'}>{c === '*' ? (pick ?? '*') : c}</span>{/each}
  </div>
  <p class="sum num">Цифрлар қосындысы: {known}{pick !== null ? ` + ${pick} = ${known + pick}` : ' + *'} {pick !== null ? (ok ? `✔ ${d}-ға бөлінеді` : '✘') : ''}</p>
  <div class="pad">{#each Array(10) as _, x}<button class="btn" class:on={pick === x} onclick={() => set(x)}>{x}</button>{/each}</div>
</div>

<style>
  .sp { display: grid; gap: 10px; justify-items: center; }
  .safe { display: flex; gap: 6px; padding: 12px 16px; background: #1b2040; border: 3px solid var(--line-hi); border-radius: 12px; transition: all .3s; }
  .safe.open { border-color: var(--ok); box-shadow: 0 0 20px #5ce39c66; }
  .dg { width: 46px; height: 58px; display: grid; place-items: center; font-size: 32px; background: #070a1a; border: 2px solid var(--line); border-radius: 6px; }
  .dg.star { color: var(--gold); border-color: var(--gold); }
  .sum { font-weight: 800; }
  .pad { display: grid; grid-template-columns: repeat(5, 52px); gap: 6px; }
  .pad .btn { min-height: 44px; padding: 4px; font-size: 20px; }
  .pad .btn.on { border-color: var(--gold); }
</style>
