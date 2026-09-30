<script module lang="ts">
  import { stars, type Fr } from './fracdraw';

  /** Пауза после смены состояния (выстрел, «Келесі»): двойной тап не проскакивает результат и не стреляет вслепую. */
  export const TAP_LOCK_MS = 450;

  /** Цель лежит на делении 1/den? */
  export function onGridOf(f: Fr, den?: number): boolean { return !!den && (f.n * den) % f.d === 0; }

  /** Допуск при постановке. Всегда строго меньше полуделения: соседнее деление не может засчитаться за цель.
   *  Цель на делении: ровно она. Цель между делениями (1/3 при den=4): свободная постановка с допуском 0.2 деления. */
  export function placeTol(o: { den?: number; onGrid: boolean; archer: boolean; tolerance?: number; target?: number }): number {
    const { den, onGrid, archer, tolerance, target } = o;
    let tol = tolerance ?? (archer ? 0.04 : den ? (onGrid ? 1e-6 : 0.2 / den) : 0.04);
    if (den && !archer) {
      tol = Math.min(tol, 0.5 / den - 1e-6);
      // цель между делениями, но близко к одному из них: допуск меньше расстояния до ближайшего деления
      if (!onGrid && target !== undefined) tol = Math.min(tol, 0.7 * Math.abs(target - Math.round(target * den) / den));
    }
    return tol;
  }

  /** Верно ли поставлено: сравниваем с ИСТИННЫМ значением цели, а не с ближайшим делением. */
  export function placedOK(mv: number, target: number, tol: number): boolean { return Math.abs(mv - target) <= tol + 1e-9; }

  /** Итог выстрела; null, если выстрел не разрешён: маркер не сдвигали («Ату!» с нуля ничего не даёт). */
  export function shotStars(aimed: boolean, mv: number, target: number, tol: number): 0 | 1 | 2 | 3 | null {
    return aimed ? stars(Math.abs(mv - target), tol) : null;
  }
</script>

<script lang="ts">
  // «Сан сызығы»: белгіні сүйреп, бөлшек тұратын орынға қой.
  //  mode 'line'   — den берілсе, бөлінулерге жабысады; ориентирлер 0, 1/2, 1; «Үлкейту» (zoom) батырмасы.
  //  mode 'archer' — «Дәл ату»: бөлінулер жоқ, «Ату!» батырмасынан кейін дәлдігіне қарай 0–3 жұлдыз.
  //  showBar — бөлшектің жолағы сызыққа жатады (жолақ пен сызықты байланыстыру).
  import { onDestroy } from 'svelte';
  import { audio } from '../lib/audio';
  import Frac from '../ui/Frac.svelte';
  import Icon from '../ui/Icon.svelte';
  import { val, snap, tween } from './fracdraw';
  const BAR = 'var(--code)';

  let { max = 1, den, place, landmarks, tolerance, mode = 'line', showBar = false, ondone }:
    { max?: 1 | 2 | 3; den?: number; place: Fr[]; landmarks?: boolean; tolerance?: number; mode?: 'line' | 'archer'; showBar?: boolean; ondone?: (stars?: number) => void } = $props();

  const archer = mode === 'archer';
  const useLandmarks = landmarks ?? !archer;
  const W = 340, H = 150, X0 = 20, X1 = 320, AXIS = 72, KY = AXIS + 54;

  let idx = $state(0);
  let mv = $state(0);
  let vlo = $state(0), vhi = $state(max);
  let zoomed = $state(false);
  let drag = $state(false), moved = false;
  let aimed = $state(false);        // archer: маркер сдвинут в этом раунде
  let busy = $state(false);         // пауза после выстрела / «Келесі»
  let lockTimer: ReturnType<typeof setTimeout> | undefined;
  function lockTaps() { busy = true; clearTimeout(lockTimer); lockTimer = setTimeout(() => (busy = false), TAP_LOCK_MS); }
  onDestroy(() => clearTimeout(lockTimer));
  let bad = $state(false);
  let msg = $state('');
  let finished = $state(false);
  let done = $state<{ v: number; f: Fr }[]>([]);
  let shot = $state<{ n: 0 | 1 | 2 | 3; err: number } | null>(null);
  let total = $state(0);
  let barKey = $state(0);
  let svg: SVGSVGElement;
  let stop = () => {};

  const cur = $derived(place[Math.min(idx, place.length - 1)]);
  const tv = $derived(val(cur));
  const onGrid = $derived(onGridOf(cur, den));
  const tol = $derived(placeTol({ den, onGrid, archer, tolerance, target: tv }));
  const snapDen = $derived(archer || !onGrid ? 0 : (den ?? 0));   // цель между делениями: маркер свободный, иначе цель недостижима
  const xOf = (v: number) => X0 + ((v - vlo) / (vhi - vlo)) * (X1 - X0);
  const pct = (x: number) => `${(x / W) * 100}%`;
  const inWin = (v: number) => v >= vlo - 1e-9 && v <= vhi + 1e-9;

  const ticks = $derived.by(() => {
    if (archer || !den) return [] as { v: number; k: 'int' | 'half' | 'tick' }[];
    const out: { v: number; k: 'int' | 'half' | 'tick' }[] = [];
    for (let i = 0; i <= max * den; i++) { const v = i / den; if (inWin(v)) out.push({ v, k: i % den === 0 ? 'int' : (2 * i) % den === 0 ? 'half' : 'tick' }); }
    return out;
  });
  const marks = $derived.by(() => {
    const out: { v: number; f: (Fr & { whole?: number }) | null }[] = [];
    for (let i = 0; i <= max; i++) {
      if (inWin(i)) out.push({ v: i, f: null });
      if (useLandmarks && i < max && inWin(i + 0.5)) out.push({ v: i + 0.5, f: { n: 1, d: 2, whole: i || undefined } });
    }
    return out;
  });
  const barPieces = $derived(showBar ? Array.from({ length: cur.n }, (_, i) => ({ a: i / cur.d, b: (i + 1) / cur.d, i })) : []);

  function toValue(clientX: number) {
    const r = svg.getBoundingClientRect();
    const x = ((clientX - r.left) / r.width) * W;
    const raw = vlo + ((x - X0) / (X1 - X0)) * (vhi - vlo);
    return snapDen ? snap(raw, snapDen, vlo, vhi) : Math.min(vhi, Math.max(vlo, raw));
  }
  function down(e: PointerEvent) {
    if (finished || shot) return;
    drag = true; moved = false; svg.setPointerCapture(e.pointerId); mv = toValue(e.clientX); msg = ''; moved = true; aimed = true;
  }
  function move(e: PointerEvent) { if (!drag) return; const v = toValue(e.clientX); if (v !== mv) { mv = v; moved = true; aimed = true; } }
  function up() {
    if (!drag) return; drag = false;
    if (!archer && moved) check();
  }
  function cancel() { drag = false; }

  function next(f: Fr) {
    done = [...done, { v: mv, f }]; idx++; barKey++; resetZoom();
    if (idx >= place.length) { finished = true; audio.play('correct'); setTimeout(() => ondone?.(), 600); }
    else { audio.play('xp'); mv = 0; }
  }
  function check() {
    if (placedOK(mv, tv, tol)) { msg = ''; next(cur); }
    else {
      bad = true; audio.play('wrong'); setTimeout(() => (bad = false), 450);
      msg = mv < tv ? 'Сәл оңға жылжыт.' : 'Сәл солға жылжыт.';
    }
  }
  function fire() {
    if (finished || shot || busy) return;
    const n = shotStars(aimed, mv, tv, tol);
    if (n === null) return;          // маркер не двигали: выстрела нет
    const err = Math.abs(mv - tv);
    shot = { n, err }; total += n; lockTaps(); audio.play(n >= 2 ? 'crit' : n === 1 ? 'hit' : 'click');
    msg = ['Алыс кетті. Келесіде дәлірек ата!', 'Жаман емес!', 'Жақсы атылды!', 'Дәл тидің!'][n];
  }
  function nextShot() {
    if (!shot || busy) return;
    lockTaps(); aimed = false;
    done = [...done, { v: mv, f: cur }]; shot = null; msg = '';
    if (idx + 1 >= place.length) { idx++; finished = true; audio.play('correct'); setTimeout(() => ondone?.(total), 900); }
    else { idx++; mv = 0; barKey++; resetZoom(); }
  }
  function toggleZoom() {
    if (finished) return;
    zoomed = !zoomed; audio.play('click');
    const k = Math.min(Math.floor(tv + 1e-9), max - 1);
    const to: [number, number] = zoomed ? [k, k + 1] : [0, max];
    const from: [number, number] = [vlo, vhi];
    stop(); stop = tween(450, t => { vlo = from[0] + (to[0] - from[0]) * t; vhi = from[1] + (to[1] - from[1]) * t; });
    mv = Math.min(to[1], Math.max(to[0], mv));
  }
  // к следующему числу возвращаем полный вид
  function resetZoom() {
    if (!zoomed) return;
    zoomed = false; stop();
    const f: [number, number] = [vlo, vhi];
    stop = tween(300, t => { vlo = f[0] * (1 - t); vhi = f[1] + (max - f[1]) * t; });
  }
</script>

<div class="nl">
  <div class="goal panel flat">
    <span class="label">{archer ? 'Нысана' : 'Орнына қой'}</span>
    <Frac n={cur.n} d={cur.d} size="lg" />
    {#if place.length > 1}<span class="dots" aria-label="{Math.min(idx + 1, place.length)} / {place.length}">{#each place as _, k}<i class:on={k < idx} class:cur={k === idx}></i>{/each}</span>{/if}
    {#if archer}<span class="stars"><Icon name="star" size={22} fill="var(--gold)" /><b class="num">{total}</b></span>{/if}
  </div>

  <div class="box" class:bad>
    <svg bind:this={svg} viewBox="0 0 {W} {H}" class="sv" role="slider" aria-label="Сан сызығы" aria-valuemin={0} aria-valuemax={max} aria-valuenow={mv} tabindex="0"
      onpointerdown={down} onpointermove={move} onpointerup={up} onpointercancel={cancel}
      onkeydown={(e) => { if (finished || shot) return; const st = snapDen ? 1 / snapDen : 0.02; if (e.key === 'ArrowRight') { mv = Math.min(vhi, mv + st); moved = true; aimed = true; } else if (e.key === 'ArrowLeft') { mv = Math.max(vlo, mv - st); moved = true; aimed = true; } else if (e.key === 'Enter') { archer ? fire() : check(); } }}>
      <line x1={X0 - 6} x2={X1 + 6} y1={AXIS} y2={AXIS} class="axis" />
      {#each ticks as t}<line x1={xOf(t.v)} x2={xOf(t.v)} y1={AXIS - (t.k === 'tick' ? 6 : 10)} y2={AXIS + (t.k === 'tick' ? 6 : 10)} class="tk" class:big={t.k !== 'tick'} />{/each}
      {#each marks as t}<line x1={xOf(t.v)} x2={xOf(t.v)} y1={AXIS - 10} y2={AXIS + 10} class="tk big" />{/each}

      {#key barKey}
        {#each barPieces as p}
          {@const xa = Math.max(X0, xOf(p.a))}
          {@const xb = Math.min(X1, xOf(p.b))}
          {#if xb > xa + 0.5}
            <rect x={xa} y={AXIS - 34} width={xb - xa} height="30" rx="4" class="piece" style="fill:{BAR};animation-delay:{p.i * 90}ms" />
          {/if}
        {/each}
      {/key}

      {#each done as p}{#if inWin(p.v)}<circle cx={xOf(p.v)} cy={AXIS} r="7" class="dot" />{/if}{/each}
      {#if shot}<g class="ghost" style="transform:translateX({xOf(tv)}px)"><path d="M0 {AXIS - 20} l7 -12 h-14z" class="gp" /><line x1="0" x2="0" y1={AXIS - 20} y2={AXIS + 8} class="gl" /></g>{/if}

      <g class="mk" class:drag class:bad style="transform:translateX({xOf(mv)}px)">
        <line x1="0" x2="0" y1={AXIS + 14} y2={KY - 4} class="stem" />
        <path d="M0 {AXIS + 2} l9 16 h-18z" class="head" />
        <circle cx="0" cy={KY} r="16" class="knob" />
        <circle cx="0" cy={KY} r="30" fill="transparent" />
      </g>
    </svg>
    <div class="lbls" aria-hidden="true">
      {#each marks as t}<span class="lb" style="left:{pct(xOf(t.v))};top:{(AXIS + 12) / H * 100}%">{#if t.f}<Frac whole={t.f.whole ?? null} n={t.f.n} d={t.f.d} size={15} />{:else}{t.v}{/if}</span>{/each}
      {#each done as p}{#if inWin(p.v)}<span class="lb ok" style="left:{pct(xOf(p.v))};top:{2 / H * 100}%"><Frac n={p.f.n} d={p.f.d} size={15} /></span>{/if}{/each}
    </div>
  </div>

  <p class="msg" class:ok={finished || (shot && shot.n >= 2)}>
    {#if shot}
      {#each [1, 2, 3] as s}<Icon name="star" size={22} fill={s <= shot.n ? 'var(--gold)' : '#0b1030'} />{/each} {msg}
    {:else}{msg || (finished ? 'Тамаша!' : archer ? 'Белгіні сүйреп апар да, «Ату!» бас.' : showBar ? 'Жолақ сызыққа жатты. Белгіні жолақтың соңына қой.' : 'Белгіні сүйреп, бөлшек тұратын жерге қой.')}{/if}
  </p>

  <div class="btns">
    {#if !archer && max > 1}<button class="btn small" onclick={toggleZoom} disabled={finished} aria-pressed={zoomed}>{zoomed ? 'Кішірейту' : 'Үлкейту'}</button>{/if}
    {#if archer}
      {#if shot}<button class="btn go big" onclick={nextShot} disabled={busy}>{idx + 1 >= place.length ? 'Дайын' : 'Келесі'}</button>
      {:else}<button class="btn primary big" onclick={fire} disabled={finished || busy || !aimed}>Ату!</button>{/if}
    {/if}
  </div>
</div>

<style>
  .nl { display: grid; gap: 10px; justify-items: center; }
  .goal { display: flex; align-items: center; gap: 12px; padding: 8px 16px; color: var(--ink); }
  .dots { display: inline-flex; gap: 5px; }
  .dots i { width: 12px; height: 12px; border-radius: 50%; border: 2px solid var(--outline); background: #0b1030; }
  .dots i.on { background: var(--ok); }
  .dots i.cur { background: var(--gold); }
  .stars { display: inline-flex; align-items: center; gap: 4px; font-size: var(--fs-m); }
  .box { position: relative; width: 100%; max-width: 420px; aspect-ratio: 340 / 150; }
  .box.bad { animation: shake .35s; }
  .sv { position: absolute; inset: 0; width: 100%; height: 100%; touch-action: pan-y; user-select: none; -webkit-user-select: none; cursor: pointer; outline: none; }
  .sv:focus-visible { outline: 3px solid var(--code); outline-offset: 2px; border-radius: 8px; }
  .axis { stroke: var(--ink); stroke-width: 4; stroke-linecap: round; }
  .tk { stroke: var(--dim); stroke-width: 2; }
  .tk.big { stroke: var(--ink); stroke-width: 3; }
  .piece { stroke: var(--outline); stroke-width: 2.5; transform-box: fill-box; transform-origin: center; animation: drop .45s var(--ease-out) both; }
  @keyframes drop { from { opacity: 0; transform: translateY(-26px) scale(.9); } to { opacity: 1; transform: none; } }
  .dot { fill: var(--ok); stroke: var(--outline); stroke-width: 3; }
  .mk { transition: transform .09s ease-out; }
  .mk.drag { transition: none; }
  .stem { stroke: var(--gold); stroke-width: 4; }
  .head { fill: var(--gold); stroke: var(--outline); stroke-width: 3; stroke-linejoin: round; }
  .knob { fill: var(--gold); stroke: var(--outline); stroke-width: 4; }
  .mk.drag .knob { fill: #ffe38a; }
  .mk.bad .knob, .mk.bad .head { fill: var(--miss); }
  .ghost { animation: pop-in .4s var(--ease-out); }
  .gp { fill: var(--ok); stroke: var(--outline); stroke-width: 2.5; }
  .gl { stroke: var(--ok); stroke-width: 3; stroke-dasharray: 5 4; }
  .lbls { position: absolute; inset: 0; pointer-events: none; color: var(--ink); }
  .lb { position: absolute; transform: translateX(-50%); font: 800 15px var(--disp); text-shadow: 0 1px 0 var(--outline); white-space: nowrap; }
  .lb.ok { color: var(--ok); }
  .msg { text-align: center; font-weight: 800; min-height: 2.6em; max-width: 340px; display: flex; align-items: center; justify-content: center; gap: 2px; flex-wrap: wrap; }
  .msg.ok { color: var(--ok); }
  .btns { display: flex; gap: 10px; justify-content: center; }
</style>
