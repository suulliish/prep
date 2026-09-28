<script lang="ts">
  // Каркас экрана (docs/DESIGN_SYSTEM.md 6). Телефон: шапка → окно 3D-сцены → панель (прокрутка внутри) → главная кнопка
  // внизу под пальцем. Широкий экран: сцена слева, колонка справа. Страница целиком не прокручивается.
  import { onMount, type Snippet } from 'svelte';
  import { W } from '../lib/world.svelte';
  import Icon from './Icon.svelte';

  let {
    title = '', sub = '', back, scene = 'short', right, head, children, footer, overlay,
  }: {
    title?: string; sub?: string; back?: () => void;
    scene?: 'tall' | 'short' | 'none';
    right?: Snippet; head?: Snippet; children?: Snippet; footer?: Snippet; overlay?: Snippet;
  } = $props();

  let win = $state<HTMLElement>();
  function frame() {
    if (!win || scene === 'none') return;
    const r = win.getBoundingClientRect(), h = innerHeight || 1;
    W.world?.setFrame?.(r.top / h, r.height / h);
  }
  onMount(() => {
    frame();
    const ro = new ResizeObserver(frame); if (win) ro.observe(win);
    addEventListener('resize', frame);
    return () => { ro.disconnect(); removeEventListener('resize', frame); W.world?.setFrame?.(0, 1); };
  });
</script>

<div class="frame {scene}">
  {#if title || back || right || head}
    <header class="top panel">
      {#if back}<button class="ibtn" onclick={back} aria-label="Артқа"><Icon name="back" fill="#fff" /></button>{/if}
      {#if head}{@render head()}{:else}
        <div class="ttl"><h1>{title}</h1>{#if sub}<small>{sub}</small>{/if}</div>
      {/if}
      {#if right}<div class="right">{@render right()}</div>{/if}
    </header>
  {/if}

  {#if scene !== 'none'}<div class="window" bind:this={win}>{#if overlay}<div class="ov">{@render overlay()}</div>{/if}</div>{/if}

  <section class="sheet panel">
    <div class="body">{@render children?.()}</div>
    {#if footer}<div class="foot">{@render footer()}</div>{/if}
  </section>
</div>

<style>
  .frame { position: fixed; inset: 0; z-index: var(--z-frame); display: flex; flex-direction: column; gap: 8px;
    padding: calc(env(safe-area-inset-top, 0px) + 8px) 10px calc(env(safe-area-inset-bottom, 0px) + 8px); pointer-events: none; }
  .frame > :not(.window) { pointer-events: auto; }
  .top { flex: none; display: flex; align-items: center; gap: 10px; padding: 8px 10px; width: min(640px, 100%); margin: 0 auto; }
  .ttl { flex: 1; min-width: 0; display: grid; line-height: 1.15; }
  .ttl h1 { font-size: 20px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .ttl small { color: var(--dim); font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .right { display: flex; gap: 6px; align-items: center; }

  /* окно сцены: касания проходят к 3D */
  .window { flex: none; position: relative; }
  .ov { position: absolute; inset: 0; display: flex; flex-direction: column; justify-content: space-between; align-items: stretch; gap: 6px; pointer-events: none; width: min(640px, 100%); margin: 0 auto; }
  .tall .window { height: clamp(190px, 33dvh, 400px); }
  .short .window { height: clamp(150px, 27dvh, 300px); }

  .sheet { flex: 1; min-height: 0; display: flex; flex-direction: column; padding: 0; width: min(640px, 100%); margin: 0 auto; overflow: hidden; }
  .body { flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain; padding: 14px 14px 16px; display: flex; flex-direction: column; gap: 12px; }
  .foot { flex: none; padding: 10px 14px 12px; border-top: 3px solid var(--outline); background: linear-gradient(180deg, #1a2f96, var(--panel-2)); display: flex; gap: 8px; align-items: stretch; }
  .foot :global(.btn) { margin-bottom: 4px; }

  /* широкий экран: колонка справа, сцена слева на весь экран */
  @media (min-width: 1000px) and (min-aspect-ratio: 23/20) {
    .frame { left: auto; width: calc(var(--side-w) + 34px); padding-right: 24px; padding-left: 10px; }
    .window { flex: 0 0 auto; height: auto; }
    .ov { position: static; }
    .top, .sheet { width: 100%; }
  }
</style>
