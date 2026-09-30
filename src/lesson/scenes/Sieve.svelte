<script lang="ts">
  // Решето Эратосфена: step 0 — вычеркнута 1; step k — просеяны первые k простых (2, 3, 5, 7).
  // live/prev (Scene.svelte): в кадре «Көр» только что вычеркнутые числа перечёркиваются по очереди (звук), простые загораются.
  import { onMount } from 'svelte';
  import { audio } from '../../lib/audio';
  let { n = 30, step = 0, broken = false, live = false, prev = null }: { n?: number; step?: number; broken?: boolean; live?: boolean; prev?: { n?: number; step?: number } | null } = $props();
  const PR = [2, 3, 5, 7];
  const sieved = $derived(PR.slice(0, step));
  const cur = $derived(step > 0 && step <= PR.length ? PR[step - 1] : 0);
  const stateAt = (k: number, st: number) => {
    const sv = PR.slice(0, st), c = st > 0 && st <= PR.length ? PR[st - 1] : 0;
    if (k === 1) return 'out';
    if (sv.includes(k)) return 'prime';
    if (sv.some(p => k % p === 0)) return k % c === 0 && c ? 'hit' : 'out';
    return st >= PR.length ? 'prime' : 'wait';
  };
  const state = (k: number) => stateAt(k, step);
  const pStep = $derived(live && prev && prev.n === n && (prev.step ?? 0) <= step ? prev.step ?? 0 : -1);
  const struck = (s: string) => s === 'hit' || s === 'out';
  // новое в этом кадре: клетка стала вычеркнутой (fresh, порядковый номер ord — для задержки) или простой
  const fresh = $derived.by(() => {
    const m = new Map<number, number>(); if (pStep < 0 || pStep === step) return m;
    let o = 0;
    for (let k = 1; k <= n; k++) { const a = stateAt(k, pStep), b = stateAt(k, step); if (a !== b && (struck(b) || b === 'prime')) m.set(k, o++); }
    return m;
  });
  onMount(() => {
    if (!live || !fresh.size) return;
    const t: number[] = [];
    const hits = [...fresh.keys()].filter(k => struck(state(k))).length;
    for (let i = 0; i < Math.min(3, hits); i++) t.push(window.setTimeout(() => audio.play('slash', { rate: 1.5 + i * 0.15 }), 120 + i * 260));
    return () => t.forEach(clearTimeout);
  });
</script>

<div class="sv" class:broken>
  {#each Array(n) as _, i}
    {@const k = i + 1}
    <span class="c num {broken ? 'wait' : state(k)}" class:cur={k === cur} class:fresh={fresh.has(k)} style="--o:{fresh.get(k) ?? 0}">{broken ? (k % 3 ? '?' : k) : k}</span>
  {/each}
</div>

<style>
  .sv { display: grid; grid-template-columns: repeat(10, minmax(0, 1fr)); gap: 4px; max-width: 420px; margin: 0 auto; padding: 6px 0; }
  .c { position: relative; aspect-ratio: 1; display: grid; place-items: center; font-size: clamp(13px, 3.6vw, 17px); background: var(--deep); border: 2px solid var(--line); border-radius: 6px; transition: all .35s; }
  .c.out { opacity: .3; }
  .c.out::after, .c.hit::after { content: ''; position: absolute; left: 12%; right: 12%; top: 50%; height: 2px; background: var(--glitch); transform: rotate(-35deg); }
  .c.hit { border-color: var(--glitch); background: #3a0f2c; animation: pop-in .35s var(--ease-out); }
  .c.prime { border-color: var(--code); color: var(--code); background: #0b2a3a; box-shadow: 0 0 10px #3ff0ff44; }
  .c.fresh { animation: fade-out .4s ease-out both; animation-delay: calc(var(--o) * 140ms); }
  .c.fresh::after { transform-origin: 0 50%; animation: strike .35s ease-out both; animation-delay: calc(var(--o) * 140ms + .1s); }
  .c.fresh.prime { animation: pop-in .45s var(--ease-out) both; animation-delay: calc(var(--o) * 60ms); }
  @keyframes strike { from { transform: rotate(-35deg) scaleX(0); } to { transform: rotate(-35deg) scaleX(1); } }
  @keyframes fade-out { from { opacity: 1; } }
  .c.cur { border-color: var(--gold); color: var(--gold); box-shadow: 0 0 14px var(--gold); transform: scale(1.12); z-index: 2; }
  .broken .c { color: var(--glitch); border-color: #7a2a63; }
</style>
