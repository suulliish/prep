<script lang="ts">
  // Разрядные ячейки: классы миллионов, тысяч, единиц по 3 цифры. Пустой разряд = 0.
  import { audio } from '../lib/audio';
  let { mln = 4, th = 30, un = 5, ondone }: { mln?: number; th?: number; un?: number; ondone?: () => void } = $props();
  const target = [String(mln).padStart(3, '0'), String(th).padStart(3, '0'), String(un).padStart(3, '0')].join('').split('').map(Number);
  let cells = $state<(number | null)[]>(Array(9).fill(null));
  let cur = $state(9 - String(mln * 1e6 + th * 1e3 + un).length);
  const done = $derived(cells.every((c, i) => i < 9 - String(mln * 1e6 + th * 1e3 + un).length || c === target[i]));
  function put(d: number) {
    if (cur >= 9) return;
    if (d !== target[cur]) { audio.play('wrong'); return; }
    cells[cur] = d; cur++; audio.play('click');
    if (cur >= 9) { audio.play('correct'); setTimeout(() => ondone?.(), 800); }
  }
  const names = ['МИЛЛИОН', 'МЫҢ', 'БІРЛІК'];
</script>

<div class="pv">
  <p class="said">{mln} миллион {th ? th + ' мың ' : ''}{un}</p>
  <div class="classes">
    {#each [0, 1, 2] as c}
      <div class="cls"><span class="label">{names[c]}</span>
        <div class="cells">{#each [0, 1, 2] as k}{@const i = c * 3 + k}<span class="cell num" class:cur={i === cur} class:zero={cells[i] === 0}>{cells[i] ?? ''}</span>{/each}</div>
      </div>
    {/each}
  </div>
  <div class="pad">{#each [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] as d}<button class="btn" onclick={() => put(d)}>{d}</button>{/each}</div>
  <p class="msg">{done ? 'Дұрыс! Бос разрядтарға нөл жазылды.' : 'Сарғыш ұяшыққа цифр қой. Бос разряд — 0.'}</p>
</div>

<style>
  .pv { display: grid; gap: 12px; justify-items: center; }
  .said { font-weight: 800; font-size: 20px; }
  .classes { display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; }
  .cls { display: grid; gap: 4px; justify-items: center; }
  .cells { display: flex; gap: 3px; padding: 6px; border: 2px solid var(--line-hi); background: var(--deep); }
  .cell { width: 34px; height: 44px; display: grid; place-items: center; font-size: 26px; background: #070a1a; border: 1px solid var(--line); }
  .cell.cur { border-color: var(--gold); box-shadow: 0 0 10px #ffc94a66; }
  .cell.zero { color: var(--gold); }
  .pad { display: grid; grid-template-columns: repeat(5, 52px); gap: 6px; }
  .pad .btn { min-height: 44px; padding: 4px; font-size: 20px; }
  .msg { font-weight: 700; text-align: center; }
</style>
