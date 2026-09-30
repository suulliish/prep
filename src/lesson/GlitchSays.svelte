<script lang="ts">
  import MathLine from './MathLine.svelte';
  // Глитч — злодей: одноглазый пиксельный вирус с «рваной» речью.
  let { text, beaten = false }: { text: string; beaten?: boolean } = $props();
</script>

<div class="gs" class:beaten>
  <div class="face" aria-hidden="true"><i class="eye"><b></b></i><i class="shard a"></i><i class="shard b"></i></div>
  <p class="bubble">{#if beaten}Ррр… таптың! Келесіде ұстап аламын!{:else}<MathLine {text} inherit />{/if}</p>
</div>

<style>
  .gs { display: flex; gap: 12px; align-items: center; }
  .face { position: relative; flex: none; width: 52px; height: 48px; background: linear-gradient(135deg, #ff6fc6, #8a3cff); border-radius: 8px; display: grid; place-items: center; animation: glitch-shake 2.2s infinite; box-shadow: 0 0 16px #ff4fb888; }
  .eye { width: 26px; height: 20px; background: #fff; border-radius: 50%; display: grid; place-items: center; }
  .eye b { width: 10px; height: 10px; background: #1a0620; border-radius: 50%; animation: look 3s infinite; }
  .shard { position: absolute; width: 8px; height: 8px; background: var(--glitch); }
  .shard.a { top: -6px; right: -4px; animation: orbit 1.6s infinite; }
  .shard.b { bottom: -5px; left: -5px; background: var(--crystal); animation: orbit 2s infinite reverse; }
  .bubble { flex: 1; font-weight: 800; padding: 10px 14px; background: #2a0d2a; border: 2px solid var(--glitch); border-radius: 10px; color: #ffd6ef; }
  .beaten .face { filter: grayscale(.6) brightness(.8); animation: none; transform: rotate(-12deg); }
  @keyframes glitch-shake { 0%, 90%, 100% { transform: none; } 92% { transform: translate(3px, -2px) skewX(8deg); } 95% { transform: translate(-3px, 1px); } }
  @keyframes look { 0%, 40% { transform: translateX(-4px); } 50%, 90% { transform: translateX(4px); } }
  @keyframes orbit { 50% { transform: translate(-3px, 4px) rotate(45deg); } }
</style>
