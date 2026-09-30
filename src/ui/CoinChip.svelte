<script lang="ts">
  // Пилюля с монетами («тиын»). Цель для летящих монет (src/ui/coinfly.ts ищет [data-coin-target]).
  // Число выросло — пилюля подпрыгивает. compact — низкая версия для шапки боя.
  import Icon from './Icon.svelte';
  let { value, compact = false, label = false }: { value: number; compact?: boolean; label?: boolean } = $props();
  let bump = $state(0);
  let prev: number | undefined;
  $effect(() => { const v = value; if (prev !== undefined && v > prev) bump++; prev = v; });
</script>

{#key bump}
  <span class="pill coin" class:compact class:bump={bump > 0} data-coin-target aria-label="Тиын: {value}">
    <Icon name="coin" fill="var(--gold)" size={compact ? 18 : 22} /><span class="num">{value}</span>{#if label}<small>тиын</small>{/if}
  </span>
{/key}

<style>
  .coin.compact { height: 30px; padding: 0 9px 0 4px; gap: 4px; font-size: 15px; border-width: 2px; flex: none; }
  .coin.bump { animation: coin-bump .6s var(--ease-out); }
  @keyframes coin-bump { 0% { transform: scale(1); } 30% { transform: scale(1.22); box-shadow: 0 0 18px var(--gold); } 100% { transform: scale(1); } }
</style>
