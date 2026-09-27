<script lang="ts">
  // Выбор визуальной сцены урока по имени (content/lessons_week1.mjs: scene + s).
  import Train from './scenes/Train.svelte';
  import Crystals from './scenes/Crystals.svelte';
  import Tiles from './scenes/Tiles.svelte';
  import Cubes from './scenes/Cubes.svelte';
  import Scanner from './scenes/Scanner.svelte';
  import Sieve from './scenes/Sieve.svelte';
  import Tree from './scenes/Tree.svelte';
  import Common from './scenes/Common.svelte';
  import Multiples from './scenes/Multiples.svelte';
  import Strike from './scenes/Strike.svelte';
  import StarDigit from './scenes/StarDigit.svelte';
  import Ladder from './scenes/Ladder.svelte';
  import Venn2 from './scenes/Venn2.svelte';
  import Venn3 from './scenes/Venn3.svelte';
  const MAP: Record<string, any> = { Train, Crystals, Tiles, Cubes, Scanner, Sieve, Tree, Common, Multiples, Strike, StarDigit, Ladder, Venn2, Venn3 };
  let { name, s = {} }: { name: string; s?: Record<string, any> } = $props();
  const Comp = $derived(MAP[name]);
</script>

<div class="scene pe">{#if Comp}<Comp {...s} />{/if}</div>

<style>
  .scene { position: relative; overflow: hidden; background: radial-gradient(ellipse at 50% 0%, #1c2556 0%, #0b0f28 70%); border: 1px solid var(--line); border-radius: 10px; padding: 8px; }
  .scene::before { content: ''; position: absolute; inset: 0; background: repeating-linear-gradient(0deg, #ffffff05 0 1px, transparent 1px 3px); pointer-events: none; }
</style>
