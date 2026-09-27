<script lang="ts">
  import { onMount } from 'svelte';
  import { createWorld } from './three/world';
  import { W } from './lib/world.svelte';
  import { game, protectStorage } from './lib/store.svelte';
  import { applyLook } from './lib/look';
  import MapScreen from './screens/Map.svelte';
  import Hero from './screens/Hero.svelte';
  import FxLayer from './ui/FxLayer.svelte';
  import Hub from './screens/Hub.svelte';
  import Session from './screens/Session.svelte';
  import Lesson from './screens/Lesson.svelte';
  import Summary from './screens/Summary.svelte';
  import Diagnostic from './screens/Diagnostic.svelte';
  import SoundLab from './screens/SoundLab.svelte';
  import Commander from './screens/Commander.svelte';
  import PlayTime from './screens/PlayTime.svelte';
  import Album from './screens/Album.svelte';

  let canvas: HTMLCanvasElement;
  onMount(() => {
    protectStorage();
    W.world = createWorld(canvas, { reduceMotion: matchMedia('(prefers-reduced-motion: reduce)').matches });
    applyLook();
    return () => W.world?.dispose();
  });
</script>

<canvas bind:this={canvas} class="world" class:dim={W.dim} aria-label="Корабль Разлом"></canvas>
<div class="screen-host">
  {#key game.screen.name}
    <div class="screen glitch-in">
      {#if game.screen.name === 'hub'}<Hub />
      {:else if game.screen.name === 'session'}<Session block={game.screen.block} />
      {:else if game.screen.name === 'lesson'}<Lesson skill={game.screen.skill} />
      {:else if game.screen.name === 'summary'}<Summary />
      {:else if game.screen.name === 'diagnostic'}<Diagnostic />
      {:else if game.screen.name === 'sound'}<SoundLab back={() => (game.screen = { name: 'commander' })} />
      {:else if game.screen.name === 'commander'}<Commander />
      {:else if game.screen.name === 'playtime'}<PlayTime />
      {:else if game.screen.name === 'album'}<Album />
      {:else if game.screen.name === 'map'}<MapScreen />
      {:else if game.screen.name === 'hero'}<Hero />
      {/if}
    </div>
  {/key}
</div>
<FxLayer />

<style>
  .world { position: fixed; inset: 0; width: 100%; height: 100%; display: block; transition: filter .5s, opacity .5s; touch-action: none; }
  .world.dim { filter: blur(6px) brightness(.45) saturate(.7); }
  .screen-host { position: relative; min-height: 100vh; min-height: 100dvh; pointer-events: none; }
  .screen { min-height: 100vh; min-height: 100dvh; }
  /* экран пропускает касания к 3D-миру, кроме панелей и кнопок */
  .screen :global(:is(.panel, button, input, label, a, .pe)) { pointer-events: auto; }
</style>
