<script lang="ts">
  // Субтитры видео-объяснения: подпись Бита крупно, слова подсвечиваются по мере речи («караоке», время приблизительное, см. video.ts).
  // На пропуске вместо подписи Бит останавливает видео: «Тоқта! …». При «уменьшить движение» подсветка не бежит: подпись стоит целиком.
  import Bit from '../ui/Bit.svelte';
  import { karaoke, wordAt } from './video';
  import type { VideoPlayer } from './video.svelte';
  let { vid, text, ghost = '', reduced = false }: { vid: VideoPlayer; text: string; ghost?: string; reduced?: boolean } = $props();
  const STOP = 'Тоқта! Қандай сан тұр? Ойлан';
  const gap = $derived(vid.phase === 'gap');
  const words = $derived(karaoke(text));
  const now = $derived(reduced || vid.phase === 'lead' ? -1 : vid.phase === 'tail' || vid.phase === 'end' ? words.length : wordAt(words, vid.p));
  const mood = $derived(gap ? 'think' : vid.phase === 'end' ? 'happy' : 'wow');
</script>

<div class="kb" class:gap>
  <Bit mood={mood} compact />
  <p class="bubble kbub">
    {#if ghost}<span class="ghost" aria-hidden="true">{ghost}</span>{/if}
    <span class="txt">{#if gap}<b class="stop">{STOP}</b>{:else}{#each words as x, k}<span class="w" class:past={reduced || k < now} class:now={k === now}>{x.w}</span>{' '}{/each}{/if}</span>
  </p>
</div>

<style>
  .kb { display: flex; gap: 10px; align-items: flex-start; }
  .bubble { position: relative; flex: 1; min-width: 0; margin: 0; background: #fff; color: var(--paper-ink); border: 3px solid var(--outline); border-radius: 16px; padding: 8px 12px; font: 800 var(--fs-s)/1.38 var(--txt); box-shadow: 0 3px 0 var(--outline); display: grid; }
  .bubble::before { content: ''; position: absolute; left: -11px; top: 12px; border: 9px solid transparent; border-right-color: var(--outline); border-left: 0; }
  .bubble::after { content: ''; position: absolute; left: -6px; top: 15px; border: 6px solid transparent; border-right-color: #fff; border-left: 0; }
  /* «призрак» самой длинной подписи шага держит высоту: кадры не прыгают */
  .ghost, .txt { grid-area: 1 / 1; }
  .ghost { visibility: hidden; }
  .w { padding: 0 1px; border-radius: 4px; color: var(--paper-dim); transition: color .12s, background .12s; }
  .w.past { color: var(--paper-ink); }
  .w.now { color: var(--paper-ink); background: #ffe38a; box-shadow: 0 2px 0 var(--gold-deep); }
  .stop { color: #b0276f; }
  @media (prefers-reduced-motion: reduce), (update: slow) { .w { transition: none; } }
  :global(.say) .bubble { font-size: 16px; line-height: 1.35; padding: 7px 10px; }
  @media (max-height: 720px) { .bubble { font-size: var(--fs-s); } }
</style>
