<script lang="ts">
  // Ход боя «Глитчтің қатесі»: Глитч «решил» задачу, ребёнок нажимает на строку, с которой началась ошибка.
  // Вид как у шага «bug» в уроках (GlitchSays + строки BugHunt): верно — контрудар, неверно — атака врага.
  // Строка-следствие (после ошибки) не наказывается: она получает мягкую отметку `soft`, есть ещё одна попытка.
  // Логика и правила выпадения: src/engine/glitchturn.ts, бой и попытка в модель знаний: Session.svelte.
  import GlitchSays from '../lesson/GlitchSays.svelte';
  import MathLine from '../lesson/MathLine.svelte';
  import { GLITCH_SAY, type GlitchTurn } from '../engine/glitchturn';
  let { turn, locked = false, picked = null, soft = [], onpick }: { turn: GlitchTurn; locked?: boolean; picked?: number | null; soft?: number[]; onpick: (k: number, ev?: MouseEvent) => void } = $props();
  const done = $derived(picked !== null);
  const found = $derived(picked === turn.bad);
  const late = $derived(picked !== null && turn.follows.includes(picked));   // нажал на строку-следствие: ошибка началась раньше
</script>

<div class="gt" class:locked>
  <span class="tag gtag">{GLITCH_SAY.title}</span>
  <GlitchSays text={GLITCH_SAY.glitchSays} beaten={found} />
  <div class="lines" role="group" aria-label={GLITCH_SAY.ask}>
    {#each turn.lines as l, k}
      <button class="line" style="animation-delay:{k * 110}ms"
        class:bad={done && k === turn.bad}
        class:ok={done && !found && picked === k && !late}
        class:after={(done && late && picked === k) || soft.includes(k)}
        disabled={locked || done || soft.includes(k)} onclick={ev => onpick(k, ev)} aria-label="{k + 1}: {l}{done && k === turn.bad ? ' — қате' : soft.includes(k) ? ' — салдар' : ''}">
        <span class="n">{k + 1}</span><span class="tx"><MathLine text={l} inherit /></span>
        {#if done && k === turn.bad}<i class="stamp">ҚАТЕ</i>{:else if soft.includes(k) || (done && late && picked === k)}<i class="stamp soft">САЛДАР</i>{/if}
      </button>
    {/each}
  </div>
  {#if done}
    <div class="res appear">
      {#if !found}<p class="note">{late ? GLITCH_SAY.followLine : GLITCH_SAY.wrongLine}</p>{/if}
      <p class="fix"><b>{GLITCH_SAY.fix}</b> <MathLine text={turn.good[turn.bad].replace(/^Жауабы:\s*/, '')} inherit /></p>
    </div>
  {/if}
</div>

<style>
  .gt { display: grid; gap: 8px; }
  .gtag { justify-self: start; background: var(--glitch); }
  .gt :global(.gs) { gap: 10px; }
  .gt :global(.face) { width: 44px; height: 40px; }
  .gt :global(.bubble) { font-size: 15px; padding: 7px 12px; line-height: 1.3; }
  .lines { display: grid; gap: 8px; }
  .line { position: relative; display: flex; gap: 12px; align-items: center; text-align: left; min-height: 46px; color: var(--paper-ink); background: #fff; border: 3px solid var(--outline); border-radius: 12px; padding: 8px 12px;
    cursor: pointer; font: 800 17px var(--disp); box-shadow: 0 3px 0 var(--outline); animation: lineIn .3s var(--ease-out) both; }
  .line:disabled { cursor: default; }
  .line:not(:disabled):active { transform: translateY(2px); box-shadow: 0 1px 0 var(--outline); }
  .locked .line { opacity: .92; }
  .n { flex: none; color: var(--paper-dim); font-weight: 800; }
  .tx { min-width: 0; overflow-wrap: anywhere; line-height: 1.25; padding-right: 0; }
  .line.ok { background: #c9f7d8; }
  .line.after { background: #fff3c2; }
  .line.bad { background: #ffe0f1; animation: shake .35s; }
  .line.bad .tx { padding-right: 58px; }
  .line.after .tx { padding-right: 74px; }
  .stamp { position: absolute; right: 10px; top: 50%; transform: translateY(-50%) rotate(-8deg); font: 800 14px var(--txt); font-style: normal; color: var(--glitch); border: 2px solid var(--glitch); padding: 2px 6px; background: #fff; }
  .res { display: grid; gap: 4px; }
  .note { color: var(--ink); font-weight: 700; }
  .fix { color: #b8ffd4; font-weight: 800; font-size: 16px; }
  .fix b { color: #5ce39c; }
  .stamp.soft { color: #8a6100; border-color: #c99a1a; background: #fff8dc; }
  @keyframes lineIn { from { opacity: 0; transform: translateX(-14px); } to { opacity: 1; transform: none; } }
  @media (max-height: 830px) { .gt { gap: 6px; } .lines { gap: 6px; } .line { min-height: 42px; padding: 5px 10px; gap: 10px; font-size: 16px; } }
  /* низкий экран (телефон 375×667, горизонталь): строки и Глитч компактнее, условие остаётся целиком; не влезло — прокручивается панель */
  @media (max-height: 720px) {
    .gt { gap: 5px; } .lines { gap: 5px; }
    .gt :global(.face) { width: 36px; height: 32px; } .gt :global(.bubble) { font-size: 14px; padding: 5px 10px; }
    .line { min-height: 36px; padding: 3px 10px; gap: 8px; font-size: 15px; border-width: 2px; box-shadow: 0 2px 0 var(--outline); border-radius: 10px; }
    .stamp { font-size: 12px; padding: 1px 5px; }
    .fix { font-size: 14px; }
  }
  @media (max-height: 460px) { .gtag { display: none; } .gt :global(.gs) { gap: 8px; } .line { min-height: 32px; font-size: 14px; } }   /* горизонталь: заголовок уже был баннером, место отдаём строкам */
  @media (prefers-reduced-motion: reduce) { .line { animation: none; } }
</style>
