<script lang="ts">
  // Карточка правила: показывается один раз, в момент, когда правило сработало (например, «свернул > 5 с»). Одна кнопка, закрыть мимо нельзя.
  // Тексты — src/engine/screentext.ts. Повторное нажатие игнорируется: onok вызывается один раз.
  let { title, rule, lines = [], btn, onok }: { title: string; rule: string; lines?: string[]; btn: string; onok: () => void } = $props();
  let done = false;
  const ok = () => { if (done) return; done = true; onok(); };
</script>

<div class="scrim" role="presentation"></div>
<div class="card panel" role="alertdialog" aria-modal="true" aria-label={title}>
  <h2>{title}</h2>
  <p class="rule">{rule}</p>
  {#each lines as l}<p class="note">{l}</p>{/each}
  <button class="btn primary big" onclick={ok}>{btn}</button>
</div>

<style>
  .scrim { position: fixed; inset: 0; z-index: var(--z-modal); background: #050713b3; animation: f .2s both; }
  .card { position: fixed; z-index: calc(var(--z-modal) + 1); left: 50%; top: 50%; transform: translate(-50%, -50%); width: min(440px, calc(100% - 24px));
    max-height: calc(100dvh - 24px); overflow-y: auto; display: grid; gap: 10px; text-align: center; animation: pop .25s var(--ease-out) both; }
  h2 { font-size: 21px; }
  .rule { margin: 0; font: 900 17px/1.3 var(--disp); color: var(--gold); }
  .note { margin: 0; }
  @keyframes f { from { opacity: 0; } }
  @keyframes pop { from { transform: translate(-50%, -46%) scale(.94); opacity: 0; } to { transform: translate(-50%, -50%); opacity: 1; } }
  @media (prefers-reduced-motion: reduce) { .scrim, .card { animation: none; } }
</style>
