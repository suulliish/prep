<script lang="ts">
  // «Пицца-монстр»: пиццаны тең бөліктерге кес, керекті бөліктерін боя. Мақсат бөлшекті құрастыр.
  // mode: 'cut' — тек кесу (d бөлік), 'shade' — den қатып тұр, тек бояу, 'mixed' — кесу + бояу.
  // Эквивалентті бөлшек (1/2 = 2/4) тек equiv=true болса (немесе den ≠ target.d болғанда) қабылданады.
  import { audio } from '../lib/audio';
  import Frac from '../ui/Frac.svelte';
  import { eq, boundary, sectorPath, polar, tween, type Fr } from './fracdraw';
  import { room, watchRoom } from '../lesson/fit';

  let { den, shade = 0, target, mode, wholes = 1, equiv, ondone }:
    { den?: number; shade?: number; target: Fr; mode?: 'cut' | 'shade' | 'mixed'; wholes?: number; equiv?: boolean; ondone?: () => void } = $props();

  const m: 'cut' | 'shade' | 'mixed' = mode ?? (den !== undefined ? 'shade' : 'mixed');
  const allowEquiv = equiv ?? (den !== undefined && den !== target.d);
  const canCut = m !== 'shade', canShade = m !== 'cut';

  let d = $state(den ?? (m === 'shade' ? target.d : target.d === 2 ? 3 : 2));
  let prevD = $state(d);
  let t = $state(1);
  let on = $state<boolean[]>(Array.from({ length: wholes * d }, (_, i) => i < shade));
  let bad = $state(false);
  let finished = $state(false);
  let msg = $state('');
  let stop = () => {};
  // размер пиццы подгоняем под высоту, которая осталась в панели урока (иначе между пиццей и «Тексеру» приходится прокручивать)
  let fcEl = $state<HTMLElement>(), pzEl = $state<HTMLElement>();
  let pw = $state(240);
  $effect(() => {
    if (!fcEl || !pzEl) return;
    const cap = wholes > 1 ? 150 : 240;
    return watchRoom(fcEl, () => {
      if (!fcEl || !pzEl) return;
      const ph = pzEl.getBoundingClientRect().height, other = fcEl.getBoundingClientRect().height - ph;
      const rows = Math.max(1, ph / Math.max(1, pw));
      const next = Math.round(Math.max(96, Math.min(cap, (room(fcEl) - other) / rows)));
      if (Math.abs(next - pw) > 2) pw = next;
    });
  });

  const count = $derived(on.filter(Boolean).length);
  const R = 84, C = 100;
  const slices = $derived(Array.from({ length: Math.max(prevD, d) }, (_, i) => i));
  const mixed = $derived(count >= d && count % d ? { whole: Math.floor(count / d), n: count % d, d } : null);

  function setDen(nd: number) {
    if (finished || nd === d || nd < 2 || nd > 12) return;
    stop(); prevD = d; d = nd; t = 0; msg = '';
    on = Array(wholes * nd).fill(false);
    audio.play('click');
    stop = tween(420, x => (t = x), () => (prevD = d));
  }
  function toggle(p: number, i: number) {
    if (finished || !canShade || i >= d) return;
    const k = p * d + i; on[k] = !on[k]; msg = ''; audio.play('click');
  }
  function check() {
    if (finished) return;
    const sameVal = eq({ n: count, d }, target);
    const ok = m === 'cut' ? d === target.d : sameVal && (allowEquiv || d === target.d);
    if (ok) {
      finished = true; msg = 'Дұрыс! Тамаша!'; audio.play('correct'); setTimeout(() => ondone?.(), 600);
    } else {
      bad = true; audio.play('wrong'); setTimeout(() => (bad = false), 400);
      msg = m === 'cut' ? 'Бөлік саны басқа болу керек.'
        : sameVal ? 'Бөлшек тең, бірақ бөлік саны басқа болу керек.'
        : count * target.d > target.n * d ? 'Тым көп боядың. Қайта санап көр.' : 'Әлі бояу керек, тағы бір қара.';
    }
  }
  function key(e: KeyboardEvent, p: number, i: number) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(p, i); } }
</script>

<div class="fc" class:multi={wholes > 1} bind:this={fcEl}>
  <div class="goal panel flat"><span class="label">Мақсат</span><Frac n={target.n} d={target.d} size="lg" />
    {#if m === 'cut'}<small>бөлік</small>{/if}</div>

  <div class="pizzas" class:bad class:done={finished} bind:this={pzEl}>
    {#each Array(wholes) as _, p}
      <svg viewBox="0 0 200 200" class="pz" style="--pw:{pw}px" role="group" aria-label="Пицца {p + 1}">
        <circle cx={C} cy={C} r={R + 8} class="crust" />
        {#each slices as i}
          {@const a0 = boundary(i, prevD, d, t)}
          {@const a1 = boundary(i + 1, prevD, d, t)}
          {@const on1 = i < d && on[p * d + i]}
          {@const [mx, my] = polar(C, C, R * 0.6, (a0 + a1) / 2)}
          {#if a1 - a0 > 1e-4}
            <path d={sectorPath(C, C, R, a0, a1)} class="sl" class:on={on1} class:tap={canShade && i < d}
              role="button" tabindex={canShade && i < d ? 0 : -1} aria-pressed={on1} aria-label="Бөлік {i + 1}"
              onpointerdown={(e) => { e.preventDefault(); toggle(p, i); }} onkeydown={(e) => key(e, p, i)} />
            {#if on1 && a1 - a0 > 0.2}<circle cx={mx} cy={my} r={Math.min(9, 4 + (a1 - a0) * 6)} class="pep" />{/if}
          {/if}
        {/each}
      </svg>
    {/each}
  </div>

  <div class="cur">
    <Frac n={count} d={d} size="xl" color={finished ? 'var(--ok)' : 'var(--gold)'} />
    {#if mixed}<span class="eqs num">=</span><Frac whole={mixed.whole} n={mixed.n} d={mixed.d} size="lg" />{/if}
  </div>

  <div class="ctl">
    {#if canCut}
      <div class="stepper" aria-label="Бөлік саны">
        <button class="btn" onclick={() => setDen(d - 1)} disabled={d <= 2 || finished} aria-label="Азайту">−</button>
        <span class="num cnt"><b>{d}</b><small>тең бөлік</small></span>
        <button class="btn" onclick={() => setDen(d + 1)} disabled={d >= 12 || finished} aria-label="Көбейту">+</button>
      </div>
    {/if}
    <button class="btn primary chk" onclick={check} disabled={finished}>Тексеру</button>
  </div>

  <p class="msg" class:ok={finished} class:hint={!msg}>{msg || (m === 'cut' ? `Пиццаны ${target.d} тең бөлікке кес.` : m === 'shade' ? 'Бөліктерді басып боя.' : 'Кес, сосын керек бөліктерін боя.')}</p>
</div>

<style>
  /* портрет: слева «Мақсат», в центре пицца, справа текущая дробь; ниже кнопки и подсказка. Пицца сжимается под высоту панели (pw). */
  .fc { display: grid; grid-template-columns: minmax(64px, 1fr) auto minmax(64px, 1fr); grid-template-areas: "goal pz cur" "ctl ctl ctl" "msg msg msg"; align-items: center; justify-items: center; gap: 6px 8px; }
  .fc.multi { grid-template-columns: 1fr 1fr; grid-template-areas: "goal cur" "pz pz" "ctl ctl" "msg msg"; }
  .goal { grid-area: goal; display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 6px 8px; color: var(--ink); }
  .goal small { color: var(--dim); font-size: var(--fs-xs); }
  .pizzas { grid-area: pz; display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; }
  .pizzas.bad { animation: shake .35s; }
  .pz { width: var(--pw); max-width: 100%; height: auto; touch-action: manipulation; overflow: visible; }
  .crust { fill: #d9902a; stroke: var(--outline); stroke-width: 4; }
  .sl { fill: #ffeec2; stroke: var(--outline); stroke-width: 3; stroke-linejoin: round; transition: fill .2s; outline: none; }
  .sl.tap { cursor: pointer; }
  .sl.tap:hover:not(.on) { fill: #fff8de; }
  .sl.on { fill: var(--glitch); }
  .sl:focus-visible { stroke: var(--code); stroke-width: 5; }
  .pep { fill: #ffb0dd; stroke: var(--outline); stroke-width: 2; pointer-events: none; animation: pop-in .3s var(--ease-out); }
  .done .sl.on { animation: pulse 0.6s 2; }
  @keyframes pulse { 50% { fill: var(--gold); } }
  .cur { grid-area: cur; display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 4px 8px; min-height: 48px; color: var(--ink); }
  .eqs { font-size: 22px; color: var(--dim); }
  .ctl { grid-area: ctl; display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 6px 10px; }
  .stepper { display: flex; align-items: center; gap: 6px; }
  .stepper .btn { width: 44px; min-height: 44px; padding: 2px; font-size: 24px; margin-bottom: 4px; }
  .cnt { min-width: 56px; display: grid; justify-items: center; line-height: 1; color: var(--dim); }
  .cnt b { font-size: 28px; color: var(--ink); }
  .cnt small { font: 800 11px var(--txt); }
  .chk { min-height: 44px; padding: 6px 14px 9px; }
  .msg { grid-area: msg; text-align: center; font-weight: 800; font-size: var(--fs-s); line-height: 1.3; min-height: 2.6em; max-width: 340px; }
  .msg.ok { color: var(--ok); }
  @media (max-height: 720px) { .fc { gap: 4px 8px; } .msg { min-height: 1.3em; } }
  /* телефон в горизонтали: пицца слева на всю высоту, справа цель и дробь в ряд, ниже кнопки и подсказка */
  @media (max-width: 999.98px) and (max-height: 560px) and (min-aspect-ratio: 23/20) {
    .fc, .fc.multi { grid-template-columns: auto minmax(0, 1fr) minmax(0, 1fr); grid-template-areas: "pz goal cur" "pz ctl ctl" "pz msg msg"; column-gap: 10px; row-gap: 4px; }
    .goal { flex-direction: row; gap: 8px; padding: 2px 10px; }
    .stepper .btn { width: 40px; min-height: 40px; font-size: 22px; }
    .chk { min-height: 40px; padding: 4px 14px 7px; }
    .cur { min-height: 0; }
    .cur :global(.frac) { font-size: 30px !important; }
    .cur .eqs { font-size: 16px; }
    .cur :global(.frac + .eqs + .frac) { font-size: 20px !important; }
    .msg { min-height: 0; font-size: 13px; }
    .msg.hint { display: none; }   /* обычная подсказка дублирует реплику Бита; ошибка и «Дұрыс!» показываются */
  }
</style>
