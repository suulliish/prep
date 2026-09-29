<script lang="ts">
  // D11: закрытое число («▢») в кадре «Көр» или в правиле. Три варианта; неверный гаснет (без штрафа), верный открывает число (onsolved).
  import MathLine from './MathLine.svelte';
  import { audio } from '../lib/audio';
  let { options, answer, onsolved }: { options: string[]; answer: string; onsolved: () => void } = $props();
  let out = $state<number[]>([]);
  let hit = $state<number | null>(null);
  function pick(k: number) {
    if (hit !== null || out.includes(k)) return;
    if (options[k] === answer) { hit = k; audio.play('correct'); onsolved(); return; }
    out = [...out, k]; audio.play('wrong');
  }
</script>

<div class="gap" role="group" aria-label="Жасырылған санды таңда">
  <span class="cap">Жасырылған сан қайсы?</span>
  <div class="row">
    {#each options as o, k}
      <button class="ans" class:out={out.includes(k)} class:right={hit === k} class:shake={out.at(-1) === k} disabled={out.includes(k) || hit !== null} onclick={() => pick(k)}>
        <MathLine text={o} inherit />
      </button>
    {/each}
  </div>
</div>

<style>
  /* закреплён внизу панели: вариант всегда виден над главной кнопкой */
  .gap { display: grid; gap: 6px; position: sticky; bottom: 0; z-index: 2; margin: 0 -14px; padding: 10px 14px 4px; background: linear-gradient(180deg, transparent, var(--panel-2) 10px); animation: pop-in .25s var(--ease-out) both; }
  .cap { font: 800 var(--fs-xs) var(--txt); color: var(--dim); letter-spacing: .04em; }
  .row { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
  .row .ans { justify-content: center; min-height: 48px; padding: 4px 6px; font-size: clamp(17px, 5vw, 22px); }
  .row .ans.shake { animation: shake .35s; }
  @media (max-height: 830px) { .cap { display: none; } }   /* на низком экране каждый пиксель нужен; «?» в строке выше и так понятен */
  @media (max-height: 720px) { .row .ans { min-height: 44px; } }
</style>
