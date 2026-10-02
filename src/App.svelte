<script lang="ts">
  import { onMount } from 'svelte';
  import { createWorld } from './three/world';
  import { W } from './lib/world.svelte';
  import { game, go, protectStorage, storage, persist } from './lib/store.svelte';
  import { trackEvent } from './lib/track.svelte';
  import { audio } from './lib/audio';
  import { applyLook } from './lib/look';
  import { syncDecor } from './lib/ship.svelte';
  import { APP_VERSION } from './lib/version';
  import MapScreen from './screens/Map.svelte';
  import Hero from './screens/Hero.svelte';
  import Intro from './screens/Intro.svelte';
  import FxLayer from './ui/FxLayer.svelte';
  import Toast from './ui/Toast.svelte';
  import RewardCard from './ui/RewardCard.svelte';
  import Hub from './screens/Hub.svelte';
  import Session from './screens/Session.svelte';
  import Lesson from './screens/Lesson.svelte';
  import Summary from './screens/Summary.svelte';
  import Diagnostic from './screens/Diagnostic.svelte';
  import SoundLab from './screens/SoundLab.svelte';
  import Commander from './screens/Commander.svelte';
  import Album from './screens/Album.svelte';
  import Workshop from './screens/Workshop.svelte';
  import Recall from './screens/Recall.svelte';

  let canvas: HTMLCanvasElement;
  // сбой где угодно — в журнал поведения (вкладка «Аналитика» командира), ребёнок не застревает (02.10)
  const logError = (where: string, e: unknown) => {
    const m = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
    try { trackEvent('error', { v: `${where} · ${game.screen.name} · ${APP_VERSION} · ${m}`.slice(0, 300) }); } catch { /* журнал не важнее экрана */ }
  };
  onMount(() => {
    protectStorage();
    addEventListener('error', e => logError('window', e.error ?? e.message));
    addEventListener('unhandledrejection', e => logError('promise', e.reason));
    try {
      W.world = createWorld(canvas, { reduceMotion: matchMedia('(prefers-reduced-motion: reduce)').matches });
      applyLook();
      syncDecor();   // украшения и питомец из мастерской: экран (Hub) монтируется раньше мира, поэтому при холодном старте ставим их здесь
      // касание поломки на палубе (неисправленная ошибка) — сразу в ремонт; касания работают только в главном меню
      W.world.onShipDamageTap(() => { if (game.screen.name === 'hub') { audio.play('click'); go({ name: 'album', tab: 'repair' }); } });
    } catch (e) { logError('3d', e); }   // нет WebGL или 3D упал: учёба и облако работают и без мира
    // облачная синхронизация — отдельным куском, чтобы не тормозить первую загрузку
    import('./lib/cloud.svelte').then(m => m.startCloud()).catch(() => {});
    return () => W.world?.dispose();
  });
</script>

<canvas bind:this={canvas} class="world" class:dim={W.dim} aria-label="«Жарық» кемесі"></canvas>
<div class="screen-host">
  {#key game.screen.name}
    <svelte:boundary onerror={e => logError('screen', e)}>
    <div class="screen screen-in">
      {#if game.screen.name === 'hub'}<Hub />
      {:else if game.screen.name === 'session'}<Session block={game.screen.block} />
      {:else if game.screen.name === 'lesson'}<Lesson skill={game.screen.skill} replay={game.screen.replay} />
      {:else if game.screen.name === 'summary'}<Summary />
      {:else if game.screen.name === 'diagnostic'}<Diagnostic />
      {:else if game.screen.name === 'sound'}<SoundLab back={() => (game.screen = { name: 'commander' })} />
      {:else if game.screen.name === 'commander'}<Commander />
      {:else if game.screen.name === 'album'}<Album />
      {:else if game.screen.name === 'map'}<MapScreen />
      {:else if game.screen.name === 'hero'}<Hero />
      {:else if game.screen.name === 'workshop'}<Workshop />
      {:else if game.screen.name === 'recall'}<Recall />
      {:else if game.screen.name === 'intro'}<Intro />
      {/if}
    </div>
    {#snippet failed(_e, reset)}
      <div class="crash panel" role="alert">
        <b>Бірдеңе бұзылды</b>
        <p>Қате тіркелді, ағаң көреді. Прогресс сақталды.</p>
        <button class="btn primary big" onclick={() => { persist(); reset(); go({ name: 'hub' }); }}>Кемеге қайту</button>
      </div>
    {/snippet}
    </svelte:boundary>
  {/key}
{#if storage.full}<p class="storage-full" role="status">Құрылғыда орын таусылды: прогресс тек облакта сақталады. Ағаңа айт.</p>{/if}
</div>
<FxLayer />
<Toast />
<RewardCard />

<style>
  .world { position: fixed; inset: 0; width: 100%; height: 100%; display: block; transition: filter .5s, opacity .5s; touch-action: none; }
  .world.dim { filter: blur(6px) brightness(.45) saturate(.7); }
  .screen-host { position: relative; min-height: 100vh; min-height: 100dvh; pointer-events: none; }
  .screen { min-height: 100vh; min-height: 100dvh; }
  .crash { position: relative; margin: 20vh auto 0; width: min(420px, calc(100% - 32px)); display: grid; gap: 10px; padding: 18px; text-align: center; pointer-events: auto; }
  .crash p { margin: 0; color: var(--dim); }
  .storage-full { position: fixed; left: 8px; right: 8px; top: calc(env(safe-area-inset-top, 0px) + 6px); z-index: var(--z-toast); margin: 0; padding: 8px 12px;
    font: 800 13px var(--txt); color: var(--outline); background: var(--gold); border: 3px solid var(--outline); border-radius: 12px; text-align: center; pointer-events: none; }
  /* экран пропускает касания к 3D-миру, кроме панелей и кнопок */
  .screen :global(:is(.panel, button, input, label, a, .pe)) { pointer-events: auto; }
</style>
