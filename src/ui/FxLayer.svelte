<script lang="ts">
  import { onMount } from 'svelte';
  import { fx, attachCanvas } from './fx.svelte';
  let canvas: HTMLCanvasElement;
  onMount(() => attachCanvas(canvas));
</script>

<canvas bind:this={canvas} class="sparks" aria-hidden="true"></canvas>
{#each fx.floats as f (f.id)}
  <div class="float px" class:big={f.big} style="left:{f.x}px;top:{f.y}px;color:{f.color}">{f.text}</div>
{/each}
{#if fx.flash}<div class="flash" style="background:{fx.flash}"></div>{/if}

<style>
  .sparks { position: fixed; inset: 0; width: 100%; height: 100%; pointer-events: none; z-index: 50; }
  .float { position: fixed; z-index: 51; pointer-events: none; font-size: 20px; text-shadow: 0 3px 0 #0009; animation: float-up 1.1s ease-out forwards; white-space: nowrap; }
  .float.big { font-size: 40px; }
  .flash { position: fixed; inset: 0; z-index: 49; pointer-events: none; opacity: .18; animation: fade .25s forwards; }
  @keyframes fade { to { opacity: 0; } }
</style>
