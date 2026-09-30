<script lang="ts">
  // «Таразы»: сол табақта зат (object г), төменгі қордан гірлерді сүйреп табаққа қой. Коромысло гірлердің айырмасына қарай жұмсақ қисаяды.
  // Тепе-теңдік (сол = оң) болғанда — дайын. Қате жоқ: таразы тек қисаяды. Гірді бассаң — оң табаққа түседі, қайта бассаң — қорға оралады.
  //  pans 'both' — гірді екі табаққа да қоюға болады (бос қалса да), 'right' — тек оң табаққа.  hide — зат массасы «?», тепе-теңдікте ашылады.
  import { onDestroy } from 'svelte';
  import { audio } from '../lib/audio';
  import { denColor } from './fracdraw';
  import { totals, tiltTarget, springStep, type Side } from './scalesmath';

  let { weights, object, pans = 'both', hide = false, unit = 'г', ondone }:
    { weights: number[]; object: number; pans?: 'both' | 'right'; hide?: boolean; unit?: string; ondone?: () => void } = $props();

  const PX = 170, PY = 44, ARM = 118, HANG = 108, TRAY_TOP = 196, TRAY_Y = 236, CH = 28, CW = 30, OBJ_H = 32;
  const reduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  let side = $state<Side[]>(weights.map(() => null));
  let drag = $state<{ i: number; x: number; y: number; cx: number; cy: number; moved: boolean } | null>(null);
  let angle = $state(0);
  let finished = $state(false);
  let flash = $state('');
  let svg: SVGSVGElement;
  let vel = 0, raf = 0, last = 0;

  const cur = $derived(totals(weights, side, object, drag ? drag.i : -1));
  const target = $derived(tiltTarget(cur.L, cur.R));
  const rad = $derived((angle * Math.PI) / 180);
  const aL = $derived({ x: PX - ARM * Math.cos(rad), y: PY - ARM * Math.sin(rad) });
  const aR = $derived({ x: PX + ARM * Math.cos(rad), y: PY + ARM * Math.sin(rad) });
  const overSide = $derived<Side>(drag && drag.y < TRAY_TOP ? (drag.x < PX ? 'L' : 'R') : null);
  const slot = weights.length > 0 ? Math.min(60, 320 / weights.length) : 60;
  const slotX = (i: number) => PX + (i - (weights.length - 1) / 2) * slot;

  // ---- анимация коромысла: затухающая пружина ----
  function tick(now: number) {
    raf = 0;
    const s = springStep(angle, vel, target, Math.min(0.05, (now - last) / 1000));
    angle = s.a; vel = s.v; last = now;
    if (Math.abs(target - angle) > 0.02 || Math.abs(vel) > 0.05) raf = requestAnimationFrame(tick);
    else { angle = target; vel = 0; }
  }
  $effect(() => {
    const t = target;
    if (reduced) { angle = t; return; }
    if (!raf) { last = performance.now(); raf = requestAnimationFrame(tick); }
  });
  onDestroy(() => { if (raf) cancelAnimationFrame(raf); });

  // ---- гірлер ----
  function check() {
    const t = totals(weights, side, object);
    if (t.L === t.R && side.some(Boolean) && !finished) {
      finished = true; audio.play('correct'); setTimeout(() => ondone?.(), 600);
    }
  }
  function place(i: number, s: Side) {
    if (finished) return;
    if (s === 'L' && pans === 'right') { flash = 'Бұл жолы гірлерді тек оң табаққа қой.'; audio.play('wrong'); setTimeout(() => (flash = ''), 1800); return; }
    side[i] = s; flash = ''; audio.play('click'); check();
  }
  function tap(i: number) { place(i, side[i] === null ? 'R' : null); }
  function reset() { if (finished) return; side = weights.map(() => null); flash = ''; audio.play('click'); }

  function pt(e: PointerEvent) {
    const m = svg.getScreenCTM();
    if (!m) return { x: 0, y: 0 };
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    return { x: p.x, y: p.y };
  }
  function down(e: PointerEvent, i: number) {
    if (finished) return;
    e.preventDefault(); svg.setPointerCapture(e.pointerId);
    const p = pt(e); drag = { i, x: p.x, y: p.y, cx: e.clientX, cy: e.clientY, moved: false };
  }
  function move(e: PointerEvent) {
    if (!drag) return;
    const p = pt(e);
    drag = { ...drag, x: p.x, y: p.y, moved: drag.moved || Math.hypot(e.clientX - drag.cx, e.clientY - drag.cy) > 6 };
  }
  function up() {
    if (!drag) return;
    const d = drag; drag = null;
    if (!d.moved) return tap(d.i);
    place(d.i, d.y >= TRAY_TOP ? null : d.x < PX ? 'L' : 'R');
  }
  function key(e: KeyboardEvent, i: number) {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tap(i); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); place(i, 'L'); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); place(i, 'R'); }
  }

  // ---- табақтағы зат пен гірлердің орны (табақтың жергілікті координаты: 0 — бет, жоғары теріс) ----
  const onPan = (s: 'L' | 'R') => weights.map((w, i) => ({ w, i })).filter(x => side[x.i] === s && drag?.i !== x.i);
  function chipPos(list: { w: number; i: number }[], j: number, base: number) {
    const row = Math.floor(j / 3), cnt = Math.min(3, list.length - row * 3), col = j % 3;
    return { x: (col - (cnt - 1) / 2) * (CW + 3), y: -base - (row + 1) * CH - row * 3 - 2 };
  }
  const msg = $derived(
    finished ? `Тепе-теңдік! ${hide ? `Зат ${object} ${unit}.` : `Екі жақ та ${cur.L} ${unit}.`}`
      : flash || (!side.some(Boolean) ? 'Гірді сүйреп апар: оң немесе сол табаққа. Таразы тепе-теңдікке келсін.'
        : cur.L > cur.R ? 'Сол жақ ауыр.' : cur.R > cur.L ? 'Оң жақ ауыр.' : ''));
</script>

{#snippet pan(s: 'L' | 'R', ax: number, ay: number)}
  {@const list = onPan(s)}
  {@const base = s === 'L' ? OBJ_H + 4 : 0}
  <g transform="translate({ax} {ay + HANG})">
    <line x1="0" y1={-HANG} x2="-50" y2="0" class="str" /><line x1="0" y1={-HANG} x2="50" y2="0" class="str" />
    <rect x="-56" y="0" width="112" height="9" rx="4" class="plate" class:over={overSide === s} />
    {#if s === 'L'}
      <g class="bag" class:done={finished}>
        <rect x="-24" y={-OBJ_H} width="48" height={OBJ_H} rx="9" />
        <text x="0" y={-OBJ_H / 2 + 6} text-anchor="middle" class="bt">{hide && !finished ? '?' : `${object} ${unit}`}</text>
      </g>
    {/if}
    {#each list as it, j (it.i)}
      {@const p = chipPos(list, j, base)}
      <g class="chip small" transform="translate({p.x} {p.y})" role="button" tabindex="0" aria-label="{it.w} {unit} — қорға қайтару"
        onpointerdown={(e) => down(e, it.i)} onkeydown={(e) => key(e, it.i)}>
        <rect x={-CW / 2} y="0" width={CW} height={CH} rx="7" fill={denColor(it.w)} />
        <text x="0" y={CH / 2 + 5} text-anchor="middle" class="ct sm">{it.w}</text>
      </g>
    {/each}
  </g>
{/snippet}

<div class="sc">
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <svg bind:this={svg} viewBox="0 0 340 268" class="board" role="group" aria-label="Таразы"
    onpointermove={move} onpointerup={up} onpointercancel={up}>
    <!-- тірек -->
    <rect x={PX - 5} y={PY} width="10" height="156" class="post" />
    <path d="M118 214 L222 214 L204 198 L136 198 Z" class="base" />
    <!-- коромысло -->
    <g transform="rotate({angle} {PX} {PY})">
      <rect x={PX - ARM - 12} y={PY - 5} width={2 * ARM + 24} height="10" rx="5" class="beam" class:done={finished} />
      <circle cx={PX - ARM} cy={PY} r="6" class="knob" /><circle cx={PX + ARM} cy={PY} r="6" class="knob" />
    </g>
    <circle cx={PX} cy={PY} r="9" class="pivot" />
    {@render pan('L', aL.x, aL.y)}
    {@render pan('R', aR.x, aR.y)}

    <!-- қор -->
    <line x1="14" x2="326" y1={TRAY_TOP + 4} y2={TRAY_TOP + 4} class="trayline" />
    {#each weights as w, i}
      <rect x={slotX(i) - 22} y={TRAY_Y - 22} width="44" height="44" rx="9" class="slot" />
      {#if side[i] === null && drag?.i !== i}
        <g class="chip" transform="translate({slotX(i)} {TRAY_Y})" role="button" tabindex="0" aria-label="{w} {unit}: оң табаққа қою"
          onpointerdown={(e) => down(e, i)} onkeydown={(e) => key(e, i)}>
          <rect x="-20" y="-20" width="40" height="40" rx="9" fill={denColor(w)} />
          <text x="0" y="6" text-anchor="middle" class="ct">{w}</text>
        </g>
      {/if}
    {/each}
    {#if drag && drag.moved}
      <g class="chip ghost" transform="translate({drag.x} {drag.y})" pointer-events="none">
        <rect x="-20" y="-20" width="40" height="40" rx="9" fill={denColor(weights[drag.i])} />
        <text x="0" y="6" text-anchor="middle" class="ct">{weights[drag.i]}</text>
      </g>
    {/if}
  </svg>

  <p class="tot num"><span>Сол: <b>{hide && !finished ? '?' : cur.L}</b> {unit}</span><span>Оң: <b>{cur.R}</b> {unit}</span></p>
  <p class="msg" class:ok={finished}>{msg}</p>
  <button class="btn small ghost" onclick={reset} disabled={finished || !side.some(Boolean)}>Қайта бастау</button>
</div>

<style>
  .sc { display: grid; gap: 8px; justify-items: center; }
  .board { width: min(100%, 400px); height: auto; touch-action: none; overflow: visible; user-select: none; -webkit-user-select: none; }
  .post { fill: #5b6699; stroke: var(--outline); stroke-width: 3; }
  .base { fill: #3d4670; stroke: var(--outline); stroke-width: 3; stroke-linejoin: round; }
  .beam { fill: var(--gold); stroke: var(--outline); stroke-width: 3; }
  .beam.done { fill: var(--ok); }
  .knob { fill: var(--outline); }
  .pivot { fill: var(--panel-hi); stroke: var(--outline); stroke-width: 3; }
  .str { stroke: var(--dim); stroke-width: 1.6; opacity: .8; }
  .plate { fill: #7f8bd0; stroke: var(--outline); stroke-width: 3; transition: fill .15s; }
  .plate.over { fill: var(--code); }
  .bag rect { fill: var(--glitch); stroke: var(--outline); stroke-width: 3; }
  .bag.done rect { fill: var(--ok); }
  .bt { font: 800 15px var(--disp); fill: var(--outline); }
  .chip { cursor: grab; outline: none; }
  .chip rect { stroke: var(--outline); stroke-width: 3; }
  .chip:focus-visible rect { stroke: var(--code); stroke-width: 4; }
  .chip.small { cursor: pointer; }
  .chip.ghost { opacity: .92; filter: drop-shadow(0 6px 4px #0006); }
  .ct { font: 800 20px var(--disp); fill: var(--outline); }
  .ct.sm { font-size: 15px; }
  .slot { fill: #0b103055; stroke: var(--line-hi); stroke-width: 2; stroke-dasharray: 4 4; }
  .trayline { stroke: var(--line-hi); stroke-width: 2; opacity: .5; }
  .tot { display: flex; gap: 18px; justify-content: center; color: var(--dim); font-size: var(--fs-m); }
  .tot b { color: var(--ink); font-size: 1.3em; }
  .msg { text-align: center; font-weight: 800; min-height: 1.4em; max-width: 340px; }
  .msg.ok { color: var(--ok); }
</style>
