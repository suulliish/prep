<script lang="ts">
  // Нижняя шторка с вопросом (docs/DESIGN_SYSTEM.md 7): «Миссиядан шығасың ба?»
  let { open = false, title, text = '', yes, no, onyes, onno }:
    { open?: boolean; title: string; text?: string; yes: string; no: string; onyes: () => void; onno: () => void } = $props();
</script>

{#if open}
  <div class="scrim" role="presentation" onclick={onno}></div>
  <div class="sheet panel" role="dialog" aria-modal="true" aria-label={title}>
    <h2>{title}</h2>
    {#if text}<p class="note">{text}</p>{/if}
    <div class="row">
      <button class="btn ghost big" onclick={onyes}>{yes}</button>
      <button class="btn primary big" onclick={onno}>{no}</button>
    </div>
  </div>
{/if}

<style>
  .scrim { position: fixed; inset: 0; z-index: var(--z-modal); background: #05071399; animation: f .2s both; }
  .sheet { position: fixed; z-index: calc(var(--z-modal) + 1); left: 50%; bottom: calc(env(safe-area-inset-bottom, 0px) + 12px); transform: translateX(-50%);
    width: min(460px, calc(100% - 20px)); display: grid; gap: 12px; text-align: center; animation: up .25s var(--ease-out) both; }
  h2 { font-size: 22px; }
  .row { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 10px; }
  @keyframes f { from { opacity: 0; } }
  @keyframes up { from { transform: translate(-50%, 30px); opacity: 0; } to { transform: translate(-50%, 0); opacity: 1; } }
</style>
