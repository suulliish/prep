<script lang="ts">
  // Всплывающая строка сверху: почему закрыто, что сохранено (docs/DESIGN_SYSTEM.md 7, 12.6).
  import { toastState } from './notify.svelte';
</script>

{#if toastState.text}
  {#key toastState.id}
    <div class="toast" role="status">{toastState.text}</div>
  {/key}
{/if}

<style>
  .toast { position: fixed; z-index: var(--z-toast); left: 50%; top: calc(env(safe-area-inset-top, 0px) + 14px); transform: translateX(-50%);
    width: min(420px, calc(100% - 28px)); padding: 12px 16px; text-align: center; font: 800 var(--fs-s) var(--txt);
    color: var(--outline); background: var(--gold); border: 3px solid var(--outline); border-radius: 14px; box-shadow: 0 5px 0 var(--outline);
    animation: drop .28s var(--ease-out) both; pointer-events: none; }
  @keyframes drop { from { opacity: 0; transform: translate(-50%, -16px); } to { opacity: 1; transform: translate(-50%, 0); } }
</style>
