<script lang="ts">
  import { untrack } from 'svelte';
  // Шаг «Көр» как мультфильм: сцена и выкладка кадр за кадром под голос Бита, в темпе речи, без пролистывания (ход времени: video.svelte.ts).
  // Указка: когда голос называет подсвеченное [..], оно вспыхивает, вокруг него (и рядом в сцене, если там то же число) появляется обводка, к ней плывёт рука.
  // Внизу: полоска кадров, «пауза», «ещё раз», «басынан»; кнопка шага появляется под видео только после последнего кадра.
  import Scene from './Scene.svelte';
  import MathLine from './MathLine.svelte';
  import Gap from './Gap.svelte';
  import Karaoke from './Karaoke.svelte';
  import { cuesFor, highlights } from './video';
  import type { VideoPlayer } from './video.svelte';
  import type { LessonGap } from './gap';
  import { centerOf, sparksAt } from '../ui/fx.svelte';
  import Icon from '../ui/Icon.svelte';

  let { vid, step, gap, solved, land = false, reduced = false, label, onsolved, onnext }: {
    vid: VideoPlayer; step: any; gap: LessonGap | null; solved: boolean; land?: boolean; reduced?: boolean;
    label: string; onsolved: () => void; onnext: () => void;
  } = $props();

  const fr = $derived(step.frames[vid.frame]);
  const sceneName = $derived(fr.scene ?? step.scene);
  const open = $derived(!!gap && !solved);
  const end = $derived(vid.phase === 'end');
  const cues = $derived(cuesFor(fr.kz, fr.math));
  const hls = $derived(highlights(fr.math));
  const ghost = $derived((step.frames as { kz: string }[]).reduce((a, f) => (f.kz.length > a.length ? f.kz : a), ''));
  const norm = (t: string) => t.replace(/[\s  ]/g, '');

  let stage = $state<HTMLElement>();
  let endBtn = $state<HTMLElement>();
  type Box = { x: number; y: number; w: number; h: number };
  let rings = $state<Box[]>([]);
  let hand = $state<{ x: number; y: number; fx: number; fy: number } | null>(null);

  // номер последней подсвеченной части, которую голос уже назвал (-1 — ещё ничего)
  const cur = $derived(cues.reduce((a, c, k) => (vid.named(c) ? k : a), -1));

  // вспыхнуло то, что назвал голос: класс на частях выкладки (MathLine не перерисовываем)
  $effect(() => {
    const st = stage; if (!st) return;
    void vid.run;
    const els = st.querySelectorAll<HTMLElement>('.mline .hl, .mline .blank');
    els.forEach((e, k) => e.classList.toggle('named', cues.length > 0 && k < cues.length && vid.named(cues[k])));
  });

  // число из подсвеченного, нарисованное в сцене: на него тоже показываем
  function inScene(st: HTMLElement, raw: string): HTMLElement | null {
    const sc = st.querySelector('.scene'); if (!sc) return null;
    const want = norm(raw);
    const w = document.createTreeWalker(sc, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode() as Text | null; n; n = w.nextNode() as Text | null) {
      if (norm(n.nodeValue ?? '') !== want || !want) continue;
      const el = n.parentElement; const r = el?.getBoundingClientRect();
      if (el && r && r.width > 0 && r.height > 0) return el;
    }
    return null;
  }
  function measure(st: HTMLElement, t0: number) {
    const sr = st.getBoundingClientRect();
    const box = (el: HTMLElement): Box => { const r = el.getBoundingClientRect(); return { x: r.left - sr.left, y: r.top - sr.top, w: r.width, h: r.height }; };
    const els = st.querySelectorAll<HTMLElement>('.mline .hl, .mline .blank');
    const m = els[Math.max(0, cur)];
    const s = hls[Math.max(0, cur)] !== undefined ? inScene(st, hls[Math.max(0, cur)]) : null;
    const out: Box[] = [];
    const sb = s ? box(s) : null, mb = m ? box(m) : null;
    if (sb) out.push(sb);
    if (mb) out.push(mb);
    const same = out.length === rings.length && out.every((b, k) => Math.abs(b.x - rings[k].x) < 0.6 && Math.abs(b.y - rings[k].y) < 0.6 && Math.abs(b.w - rings[k].w) < 0.6);
    if (!same) rings = out;
    // рука сперва у сцены (если там есть что показать), через 1,4 с переходит к выкладке
    const aim = sb && (!mb || performance.now() - t0 < 1400) ? sb : mb;
    if (aim && !reduced) {
      const x = aim.x + aim.w * 0.6, y = aim.y + aim.h * 0.65;
      if (!hand || Math.abs(hand.x - x) > 0.6 || Math.abs(hand.y - y) > 0.6) hand = { x, y, fx: hand?.fx ?? sr.width - 30, fy: hand?.fy ?? sr.height + 30 };
    } else if (hand) hand = null;
  }
  $effect(() => {
    const st = stage; const on = cur >= 0 && vid.phase !== 'gap'; void vid.run;
    if (!st || !on) { rings = []; hand = null; return; }
    const t0 = performance.now(); let raf = 0;
    const loop = () => { untrack(() => measure(st, t0)); raf = requestAnimationFrame(loop); };
    loop();
    return () => { cancelAnimationFrame(raf); };
  });
  // повторный показ кадра: указка убирается сразу (рука вылетает заново)
  $effect(() => { void vid.run; hand = null; rings = []; });

  // кнопка шага появляется с искрами
  $effect(() => { if (vid.phase === 'end' && endBtn) { const c = centerOf(endBtn); sparksAt(c.x, c.y, ['#5ce39c', '#ffc94a', '#3ff0ff'], 22); } });
</script>

<div class="vid" class:land class:reduced data-phase={vid.phase} data-mode={vid.mode} data-frame={vid.frame}>
  <div class="hrow"><span class="tag c-example">Көр</span><h2 class="h"><MathLine text={step.kz.replace(/^Көр:\s*/, '')} inherit /></h2></div>

  <div class="vstage" bind:this={stage}>
    {#key vid.run}
      {#if sceneName}<Scene name={sceneName} s={fr.s} live hide={open ? gap!.answer : null} />{/if}
      <div class="paper mline appear" class:empty={!fr.math}>
        {#if fr.math}<MathLine text={gap ? gap.text : fr.math} fill={gap && solved ? gap.answer : null} big />{/if}
      </div>
    {/key}
    {#each rings as b}<i class="ring" style="left:{b.x - 6}px;top:{b.y - 4}px;width:{b.w + 12}px;height:{b.h + 8}px"></i>{/each}
    {#if hand}
      <svg class="hand" viewBox="0 0 40 46" width="38" height="44" aria-hidden="true" style="transform:translate({hand.x - 12}px,{hand.y - 4}px);--fx:{hand.fx}px;--fy:{hand.fy}px">
        <path d="M14 3c2.2 0 3.8 1.6 3.8 3.8V18l1.2-.3c2.2-.6 3.9.7 4.2 2.4l.9-.2c2.2-.5 3.9.8 4.1 2.6 2.2-.4 4 .9 4.1 3 .2 4.600 0 8.200-1.600 11.800C28.500 42.500 24.300 45 19.200 45c-5.200 0-8.500-2.200-11-6.200L2.300 29.400c-.9-1.600.6-3.300 2.400-2.800l5.500 1.500V6.800C10.200 4.600 11.900 3 14 3z" fill="#fff" stroke="#0b1030" stroke-width="2.6" stroke-linejoin="round" />
      </svg>
    {/if}
  </div>

  {#if vid.phase === 'gap' && gap && !solved}<Gap options={gap.options} answer={gap.answer} onsolved={onsolved} />{/if}
  {#if !land}<Karaoke {vid} text={fr.kz} {ghost} {reduced} />{/if}

  <div class="tl" role="progressbar" aria-label="Кадр {vid.frame + 1} / {step.frames.length}" aria-valuemin="1" aria-valuemax={step.frames.length} aria-valuenow={vid.frame + 1}>
    {#each step.frames as _, k}<i class:seen={k < vid.frame || vid.phase === 'end'} class:on={k === vid.frame && vid.phase !== 'end'}><b style="width:{k < vid.frame || vid.phase === 'end' ? 100 : k === vid.frame ? Math.round(vid.progress * 100) : 0}%"></b></i>{/each}
  </div>
  <div class="ctl">
    {#if vid.phase !== 'end'}
      <button class="vb" onclick={() => vid.toggle()} disabled={vid.phase === 'gap'} aria-label={vid.userPaused ? 'Жалғастыру' : 'Кідірту'}>
        {#if vid.userPaused}<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M7 4.500v15l13-7.500z" /></svg>{:else}<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M6 4.500h4v15H6zM14 4.500h4v15h-4z" /></svg>{/if}
      </button>
    {/if}
    <button class="vb" onclick={() => vid.again()} aria-label="Осы кадрды қайта көру">
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M12 5a7 7 0 1 1-6.600 4.700" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" /><path d="M3 4.500 7.500 10.500 11 6z" /></svg>{#if !end}<span>Қайта</span>{/if}
    </button>
    <button class="vb" onclick={() => vid.restart()} aria-label="Басынан бастау">
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M5 4.500h3v15H5zM20 4.500v15L9.500 12z" /></svg>{#if !end}<span>Басынан</span>{/if}
    </button>
    {#if end}
      <button bind:this={endBtn} class="btn go end" onclick={onnext}>{label}<Icon name="chevron" fill="var(--outline)" size={20} /></button>
    {:else}<span class="cnt num">{vid.frame + 1}/{step.frames.length}</span>{/if}
  </div>
</div>

<style>
  .vid { display: grid; gap: 10px; }
  .hrow { display: flex; align-items: center; gap: 10px; }
  .h { font-size: 19px; line-height: 1.2; text-shadow: 0 2px 0 var(--outline); min-width: 0; }
  .vstage { position: relative; display: grid; gap: 10px; }
  .mline { display: flex; justify-content: center; min-height: 52px; align-items: center; }
  .mline.empty { visibility: hidden; }
  /* подсвеченное золотом становится золотым, только когда голос его назвал */
  .vid :global(.paper .hl:not(.named)) { color: inherit; background: transparent; border-bottom-color: transparent; }
  .vid :global(.paper .hl.named), .vid :global(.paper .blank.named) { animation: hlflash .8s var(--ease-out); }
  .vid.reduced :global(.paper .hl.named), .vid.reduced :global(.paper .blank.named) { animation: none; }
  @keyframes hlflash { 0% { transform: scale(1); box-shadow: 0 0 0 #ffc94a00; } 35% { transform: scale(1.22); box-shadow: 0 0 0 7px #ffc94a88; } 100% { transform: scale(1); box-shadow: 0 0 0 #ffc94a00; } }
  /* указка */
  .ring { position: absolute; z-index: 3; box-sizing: border-box; border: 3px solid var(--gold); border-radius: 14px; box-shadow: 0 0 0 2px var(--outline), 0 0 14px #ffc94aaa; pointer-events: none; animation: ringin .3s var(--ease-out) both; }
  .vid:not(.reduced) .ring { animation: ringin .3s var(--ease-out) both, ringpulse 1.2s .3s ease-in-out infinite; }
  @keyframes ringin { from { opacity: 0; transform: scale(1.5); } to { opacity: 1; transform: none; } }
  @keyframes ringpulse { 50% { transform: scale(1.08); } }
  .hand { position: absolute; left: 0; top: 0; z-index: 4; pointer-events: none; filter: drop-shadow(0 3px 0 #0b1030aa); transition: transform .6s cubic-bezier(.3, .8, .3, 1); animation: handfly .7s cubic-bezier(.3, .8, .3, 1) both; }
  @keyframes handfly { from { transform: translate(var(--fx), var(--fy)); opacity: 0; } 30% { opacity: 1; } }
  /* подпись и управление */
  .tl { display: flex; gap: 4px; }
  .tl i { flex: 1; height: 9px; border-radius: 6px; background: #0b1030; border: 2px solid var(--outline); overflow: hidden; }
  .tl i b { display: block; height: 100%; background: var(--code); }
  .tl i.seen b { background: var(--code-deep); }
  .ctl { display: flex; align-items: center; gap: 8px; }
  .vb { display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-width: 46px; min-height: 44px; padding: 4px 12px; font: 800 var(--fs-s) var(--disp); color: var(--ink); background: #ffffff14; border: 3px solid var(--outline); border-radius: 14px; box-shadow: inset 0 -3px 0 #00000030, 0 3px 0 var(--outline); cursor: pointer; -webkit-tap-highlight-color: transparent; }
  .vb svg { fill: currentColor; flex: none; }
  .vb:active:not(:disabled) { transform: translateY(2px); box-shadow: inset 0 -1px 0 #00000030, 0 1px 0 var(--outline); }
  .vb:disabled { opacity: .45; cursor: default; }
  .vb:focus-visible { outline: 3px solid var(--code); outline-offset: 3px; }
  .cnt { margin-left: auto; font-size: 13px; color: var(--dim); white-space: nowrap; }
  /* в конце видео в этом же ряду вырастает кнопка шага: высота ряда прежняя, сцена не прыгает */
  .ctl { min-height: 52px; }
  .end { flex: 1; min-width: 0; min-height: 52px; padding: 8px 14px 12px; font-size: var(--fs-l); animation: endin .5s var(--ease-out) both; }
  @keyframes endin { from { opacity: 0; transform: translateY(18px) scale(.9); } 60% { transform: translateY(-3px) scale(1.04); } to { opacity: 1; transform: none; } }
  @media (max-height: 720px) { .vid { gap: 8px; } .h { font-size: 17px; } .mline { min-height: 46px; } }
  /* телефон в горизонтали: колонка справа низкая */
  .vid.land { gap: 6px; }
  .vid.land .h { font-size: 15px; }
  .vid.land .mline { min-height: 40px; padding: 4px 10px; }
  .vid.land .vb { min-height: 40px; padding: 2px 10px; }
  .vid.land .vb span { display: none; }
  .vid.land .ctl, .vid.land .end { min-height: 42px; }
  .vid.land .end { font-size: 17px; padding: 4px 10px 8px; }
  @media (prefers-reduced-motion: reduce) { .end, .ring, .hand { animation: none !important; } .hand { transition: none; } }
</style>
