<script lang="ts">
  // «Пицца-монстр»: пиццаны тең бөліктерге кес, керекті бөліктерін боя. Мақсат бөлшекті құрастыр.
  // mode: 'cut' — тек кесу (d бөлік), 'shade' — den қатып тұр, тек бояу, 'mixed' — кесу + бояу.
  // Эквивалентті бөлшек (1/2 = 2/4) тек equiv=true болса (немесе den ≠ target.d болғанда) қабылданады.
  import { audio } from '../lib/audio';
  import Frac from '../ui/Frac.svelte';
  import { eq, boundary, sectorPath, polar, tween, type Fr } from './fracdraw';

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

<div class="fc">
  <div class="goal panel flat"><span class="label">Мақсат</span><Frac n={target.n} d={target.d} size="lg" />
    {#if m === 'cut'}<small>бөлік</small>{/if}</div>

  <div class="pizzas" class:bad class:done={finished}>
    {#each Array(wholes) as _, p}
      <svg viewBox="0 0 200 200" class="pz" style="--pw:{wholes > 1 ? 150 : 240}px" role="group" aria-label="Пицца {p + 1}">
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

  {#if canCut}
    <div class="stepper" aria-label="Бөлік саны">
      <button class="btn" onclick={() => setDen(d - 1)} disabled={d <= 2 || finished} aria-label="Азайту">−</button>
      <span class="num cnt"><b>{d}</b> тең бөлік</span>
      <button class="btn" onclick={() => setDen(d + 1)} disabled={d >= 12 || finished} aria-label="Көбейту">+</button>
    </div>
  {/if}

  <p class="msg" class:ok={finished}>{msg || (m === 'cut' ? `Пиццаны ${target.d} тең бөлікке кес.` : m === 'shade' ? 'Бөліктерді басып боя.' : 'Пиццаны тең бөліктерге кес, сосын керек бөліктерін боя.')}</p>
  <button class="btn primary big" onclick={check} disabled={finished}>Тексеру</button>
</div>

<style>
  .fc { display: grid; gap: 10px; justify-items: center; }
  .goal { display: flex; align-items: center; gap: 12px; padding: 8px 16px; color: var(--ink); }
  .goal small { color: var(--dim); font-size: var(--fs-s); }
  .pizzas { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; width: 100%; }
  .pizzas.bad { animation: shake .35s; }
  .pz { width: min(100%, var(--pw)); height: auto; touch-action: manipulation; overflow: visible; }
  .crust { fill: #d9902a; stroke: var(--outline); stroke-width: 4; }
  .sl { fill: #ffeec2; stroke: var(--outline); stroke-width: 3; stroke-linejoin: round; transition: fill .2s; outline: none; }
  .sl.tap { cursor: pointer; }
  .sl.tap:hover:not(.on) { fill: #fff8de; }
  .sl.on { fill: var(--glitch); }
  .sl:focus-visible { stroke: var(--code); stroke-width: 5; }
  .pep { fill: #ffb0dd; stroke: var(--outline); stroke-width: 2; pointer-events: none; animation: pop-in .3s var(--ease-out); }
  .done .sl.on { animation: pulse 0.6s 2; }
  @keyframes pulse { 50% { fill: var(--gold); } }
  .cur { display: flex; align-items: center; gap: 10px; min-height: 64px; color: var(--ink); }
  .eqs { font-size: 26px; color: var(--dim); }
  .stepper { display: flex; align-items: center; gap: 12px; }
  .stepper .btn { width: 56px; min-height: 52px; padding: 4px; font-size: 28px; }
  .cnt { min-width: 130px; text-align: center; font-size: var(--fs-m); color: var(--dim); }
  .cnt b { font-size: 30px; color: var(--ink); }
  .msg { text-align: center; font-weight: 800; min-height: 2.6em; max-width: 340px; }
  .msg.ok { color: var(--ok); }
</style>
