<script lang="ts">
  // Каркас экрана (docs/DESIGN_SYSTEM.md 6). Телефон: шапка → окно 3D-сцены → панель (прокрутка внутри) → главная кнопка
  // внизу под пальцем. Широкий экран и телефон в горизонтали: сцена слева, колонка справа. Страница целиком не прокручивается.
  // cinema — идёт катсцена (docs/GAME_LOOP.md 3): шапка и панель уходят, сцена на весь экран, чёрные полосы как в кино.
  // event — событие боя на весь экран (docs/GAME_LOOP.md 20): панель уезжает вниз, окно сцены разворачивается (камера плавно следует за окном), шапка остаётся.
  // thin — разбор ошибки: сцена сжимается в тонкую полосу, остальное отдано разбору.
  import { onMount, onDestroy, type Snippet } from 'svelte';
  import { W } from '../lib/world.svelte';
  import Icon from './Icon.svelte';

  let {
    title = '', sub = '', back, scene = 'short', right, head, children, footer, overlay, cinema = false, event = false, thin = false, bare = false,
  }: {
    cinema?: boolean; event?: boolean; thin?: boolean;
    /** без прокручиваемого тела: панель = только подвал с кнопками (главный экран без задания) */
    bare?: boolean;
    title?: string; sub?: string; back?: () => void;
    /** tall/short/strip — фиксированная высота окна сцены; fill — окно забирает всё, что не занял компактный низ (главный экран) */
    scene?: 'tall' | 'short' | 'strip' | 'fill' | 'none';
    right?: Snippet; head?: Snippet; children?: Snippet; footer?: Snippet; overlay?: Snippet;
  } = $props();

  let win = $state<HTMLElement>();
  let bodyEl = $state<HTMLElement>();
  let frameEl = $state<HTMLElement>(), topEl = $state<HTMLElement>(), sheetEl = $state<HTMLElement>();
  let more = $state(false);   // в теле панели есть что прокрутить вниз — показываем стрелку и тень

  function frame() {
    if (!win || scene === 'none') return;
    const r = win.getBoundingClientRect(), h = innerHeight || 1;
    W.world?.setFrame?.(r.top / h, r.height / h);
  }
  function checkMore() {
    const b = bodyEl; if (!b) return;
    more = b.scrollHeight - b.scrollTop - b.clientHeight > 8;
  }

  // Телефон в горизонтали (812×375): 3D-сцена ужимается до левой части экрана (canvas.world, см. app.css),
  // справа колонка с панелью. Мир сам считает кадр по размеру canvas, так что герой остаётся в центре видимой сцены.
  const LS = '(max-width: 999.98px) and (max-height: 560px) and (min-aspect-ratio: 23/20)';
  const split = $derived(scene !== 'none' && !cinema && !event);
  function syncSplit() {
    const on = matchMedia(LS).matches && !!document.querySelector('.frame[data-split="1"]');
    const root = document.documentElement;
    if (root.classList.contains('lsplit') === on) return;
    root.classList.toggle('lsplit', on);
    W.world?.resize?.(); requestAnimationFrame(frame);
  }
  $effect(() => { void split; requestAnimationFrame(syncSplit); });
  $effect(() => { void cinema; requestAnimationFrame(frame); });
  // событие: до смены раскладки запоминаем высоту панели (она уезжает целиком, а не сплющивается) и считаем высоту окна сцены «во весь экран» в пикселях, чтобы она плавно менялась
  $effect.pre(() => {
    if (!event || !frameEl) return;
    const cs = getComputedStyle(frameEl), used = topEl ? topEl.offsetHeight + 8 : 0;
    frameEl.style.setProperty('--sh', (sheetEl?.offsetHeight ?? 0) + 'px');
    frameEl.style.setProperty('--evh', Math.max(120, frameEl.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom) - used) + 'px');
  });

  onMount(() => {
    frame();
    const ro = new ResizeObserver(() => { frame(); checkMore(); }); if (win) ro.observe(win); if (bodyEl) ro.observe(bodyEl);
    // содержимое тела меняется (ответили, пришёл разбор) — пересчитать «есть ещё ниже»
    const mo = new MutationObserver(() => requestAnimationFrame(checkMore));
    if (bodyEl) mo.observe(bodyEl, { childList: true, subtree: true, characterData: true });
    const mq = matchMedia(LS); mq.addEventListener('change', syncSplit);
    const onResize = () => { frame(); checkMore(); };
    addEventListener('resize', onResize);
    requestAnimationFrame(() => { checkMore(); syncSplit(); });
    return () => { ro.disconnect(); mo.disconnect(); mq.removeEventListener('change', syncSplit); removeEventListener('resize', onResize); W.world?.setFrame?.(0, 1); };
  });
  onDestroy(() => { requestAnimationFrame(syncSplit); });
</script>

<div class="frame {scene}" class:cinema class:event class:thin class:split data-split={split ? '1' : '0'} bind:this={frameEl}>
  {#if title || back || right || head}
    <header class="top panel" bind:this={topEl}>
      {#if back}<button class="ibtn" onclick={back} aria-label="Артқа"><Icon name="back" fill="#fff" /></button>{/if}
      {#if head}{@render head()}{:else}
        <div class="ttl"><h1>{title}</h1>{#if sub}<small>{sub}</small>{/if}</div>
      {/if}
      {#if right}<div class="right">{@render right()}</div>{/if}
    </header>
  {/if}

  {#if scene !== 'none'}<div class="window" bind:this={win}>{#if overlay}<div class="ov">{@render overlay()}</div>{/if}</div>{/if}

  <section class="sheet panel" bind:this={sheetEl}>
    {#if !bare}
      <div class="bodywrap">
        <div class="body" bind:this={bodyEl} onscroll={checkMore}>{@render children?.()}</div>
        {#if more}<div class="more" aria-hidden="true"><i class="arrow"></i></div>{/if}
      </div>
    {:else}{@render children?.()}{/if}   <!-- без тела: в children только «плавающее» (fixed) — праздники, вспышки -->
    {#if footer}<div class="foot" class:solo={bare}>{@render footer()}</div>{/if}
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
  .strip .window { height: clamp(130px, 21dvh, 230px); }
  /* fill: сцена берёт всё свободное место (главный экран: ≥ 50% высоты), панель снизу — по высоте содержимого */
  .fill .window { flex: 1 1 0; min-height: 200px; }
  .fill .sheet { flex: none; max-height: 50dvh; }
  @media (max-height: 700px) { .strip .window { height: clamp(96px, 17dvh, 130px); } }
  @media (min-height: 900px) and (min-width: 700px) and (max-aspect-ratio: 23/20) { .strip .window { height: clamp(260px, 34dvh, 420px); } }   /* планшет в портрете: окно боя побольше */

  /* окно сцены меняет высоту плавно: камера следует за ним (frame() на каждый кадр изменения размера) */
  .window { transition: height .55s cubic-bezier(.2, .9, .25, 1.05); }
  .sheet { transition: transform .5s cubic-bezier(.2, .9, .25, 1.05); }
  /* событие: окно на весь экран, панель уезжает вниз */
  .event .window { height: var(--evh, 60dvh); }
  .event .sheet { flex: none; height: var(--sh, 50dvh); transform: translateY(130%); pointer-events: none; }
  /* разбор: тонкая полоса сцены */
  .thin .window { height: clamp(84px, 14dvh, 118px); }
  @media (prefers-reduced-motion: reduce) { .window, .sheet { transition: none; } }

  /* катсцена */
  .cinema .top, .cinema .sheet { display: none; }
  .cinema .window { flex: 1; height: auto; }
  .cinema::before, .cinema::after { content: ''; position: fixed; left: 0; right: 0; height: 8dvh; background: #05061a; z-index: 1; animation: bars .35s ease-out both; }
  .cinema::before { top: 0; } .cinema::after { bottom: 0; }
  @keyframes bars { from { transform: scaleY(0); } }

  .sheet { flex: 1; min-height: 0; display: flex; flex-direction: column; padding: 0; width: min(640px, 100%); margin: 0 auto; overflow: hidden; }
  .bodywrap { position: relative; flex: 1 1 auto; min-height: 0; display: flex; }
  .body { flex: 1; min-height: 0; overflow-y: auto; overflow-x: hidden; overscroll-behavior: contain; touch-action: pan-y; padding: 14px 14px 16px; display: flex; flex-direction: column; gap: 12px; }
  /* «ниже есть ещё»: тень и прыгающая стрелка над кнопкой, чтобы ребёнок понял, что панель прокручивается */
  .more { position: absolute; left: 0; right: 0; bottom: 0; height: 40px; display: grid; place-items: end center; padding-bottom: 4px; pointer-events: none;
    background: linear-gradient(180deg, transparent, #14226ecc 70%); }
  .arrow { width: 28px; height: 28px; display: grid; place-items: center; border-radius: 50%; background: var(--gold); border: 3px solid var(--outline); box-shadow: 0 2px 0 var(--outline); animation: more-bob 1.1s ease-in-out infinite; }
  .arrow::after { content: ''; width: 8px; height: 8px; border-right: 3px solid var(--outline); border-bottom: 3px solid var(--outline); transform: translateY(-2px) rotate(45deg); }
  @keyframes more-bob { 50% { transform: translateY(3px); } }
  .foot { flex: none; padding: 10px 14px 12px; border-top: 3px solid var(--outline); background: linear-gradient(180deg, #1a2f96, var(--panel-2)); display: flex; gap: 8px; align-items: stretch; }
  .foot.solo { border-top: 0; background: none; padding: 12px 14px 12px; }
  .foot :global(.btn) { margin-bottom: 4px; }

  /* широкий экран: колонка справа, сцена слева на весь экран */
  @media (min-width: 1000px) and (min-aspect-ratio: 23/20) {
    .frame { left: auto; width: calc(var(--side-w) + 34px); padding-right: 24px; padding-left: 10px; }
    .window { flex: 0 0 auto; height: auto; }
    .ov { position: static; }
    .top, .sheet { width: 100%; }
    .fill .window { flex: 0 0 auto; min-height: 0; }
    .fill .sheet { flex: 1 1 auto; max-height: none; }
  }

  /* телефон в горизонтали (812×375): слева сцена (canvas сужен в app.css), справа шапка + панель + кнопка.
     Панель не полоска в 50 px, а колонка на всю высоту. */
  @media (max-width: 999.98px) and (max-height: 560px) and (min-aspect-ratio: 23/20) {
    .frame.split { display: grid; grid-template-columns: minmax(0, 1fr) var(--lp-w); grid-template-rows: auto minmax(0, 1fr); column-gap: 14px; row-gap: 6px;
      padding: 6px 8px 6px 0; }
    .split .window, .split.thin .window { grid-column: 1; grid-row: 1 / span 2; height: auto; min-height: 0; padding-left: 8px; }
    .split .top { grid-column: 2; grid-row: 1; width: 100%; padding: 4px 8px; gap: 8px; }
    .split .sheet { grid-column: 2; grid-row: 2; width: 100%; max-height: none; }
    .split .ttl h1 { font-size: 17px; }
    .split .ttl small { display: none; }
    .split .body { padding: 8px 10px 10px; gap: 8px; }
    .split .foot { padding: 6px 10px 6px; }
    .split .foot.solo { padding: 6px 10px 6px; }
    .split :global(.ibtn) { width: 40px; height: 40px; }
    .split .foot :global(.btn) { min-height: 46px; padding: 6px 12px 10px; font-size: 16px; margin-bottom: 2px; }
    .split .foot :global(.btn.big) { min-height: 50px; font-size: 17px; }
    .split .foot :global(.ibtn) { width: 46px; height: 46px; }
  }
</style>
