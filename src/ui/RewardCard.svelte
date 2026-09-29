<script lang="ts">
  // Сцена награды (src/lib/reward.svelte.ts): одна на момент. Пункты появляются по очереди, цифры считаются вверх и
  // монеткой «влетают» в счётчик минут наверху; конфетти на CSS. Кнопка «Қабылдау» доступна сразу — читать тут нечего.
  import { rewardUI, acceptReward } from '../lib/reward.svelte';
  import { audio } from '../lib/audio';
  import Icon from './Icon.svelte';

  let btn = $state<HTMLButtonElement>();
  let walletEl = $state<HTMLElement>();
  let rowEls = $state<HTMLElement[]>([]);
  let veil = $state<HTMLElement>();
  let vis = $state(0);            // сколько пунктов уже показано
  let nums = $state<number[]>([]); // текущее (считаемое вверх) число каждого пункта
  let wallet = $state(0);         // число в счётчике минут
  let bump = $state(0);           // каждый «влёт» подпрыгивает счётчик
  let full = $state(false);       // все пункты долетели

  // 26 кусочков конфетти: положение, задержка, поворот, цвет — заранее, без случайности при перерисовке
  const COLORS = ['#ffcb2e', '#35e6ff', '#ff4fb8', '#3ddc6e', '#a77bff'];
  const confetti = Array.from({ length: 26 }, (_, k) => ({
    x: (k * 37 + 11) % 100, d: (k * 53) % 700, t: 2300 + ((k * 97) % 1500), r: (k * 71) % 360, c: COLORS[k % COLORS.length], w: 7 + (k % 4) * 2,
  }));

  // счёт вверх: у каждого своя нить (иначе новая обрывала бы недосчитанную старую и число застревало на 54 вместо 55)
  const rafs = new Set<number>();
  function tween(from: number, to: number, ms: number, set: (v: number) => void) {
    const t0 = performance.now(); let id = 0;
    const step = (t: number) => { rafs.delete(id); const k = Math.min(1, (t - t0) / ms); set(Math.round(from + (to - from) * (1 - Math.pow(1 - k, 3)))); if (k < 1) { id = requestAnimationFrame(step); rafs.add(id); } };
    id = requestAnimationFrame(step); rafs.add(id);
  }
  const tweenWallet = (to: number) => tween(wallet, to, 320, v => (wallet = v));

  // монетка летит от числа пункта к счётчику
  function fly(i: number, gain: number, upTo: number, done: () => void) {
    const from = rowEls[i]?.querySelector('.n')?.getBoundingClientRect(), to = walletEl?.getBoundingClientRect();
    if (!from || !to || !veil) { done(); return; }
    const chip = document.createElement('div');
    chip.className = 'coin-chip'; chip.textContent = `+${gain}`;
    veil.appendChild(chip);
    const x0 = from.left + from.width / 2, y0 = from.top + from.height / 2, x1 = to.left + to.width / 2, y1 = to.top + to.height / 2;
    const a = chip.animate([
      { transform: `translate(${x0}px, ${y0}px) translate(-50%, -50%) scale(1.2)`, opacity: 1 },
      { transform: `translate(${(x0 + x1) / 2 + 30}px, ${Math.min(y0, y1) - 36}px) translate(-50%, -50%) scale(1)`, opacity: 1, offset: .45 },
      { transform: `translate(${x1}px, ${y1}px) translate(-50%, -50%) scale(.6)`, opacity: .9 },
    ], { duration: 560, easing: 'cubic-bezier(.4,.1,.6,1)', fill: 'forwards' });
    a.onfinish = () => { chip.remove(); bump++; audio.play('coins'); tweenWallet(upTo); done(); };
    a.oncancel = () => chip.remove();
  }

  $effect(() => {
    const r = rewardUI.cur; if (!r) return;
    let dead = false; const timers: number[] = [];
    const at = (ms: number, f: () => void) => { timers.push(window.setTimeout(() => { if (!dead) f(); }, ms)); };
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    vis = 0; full = false; wallet = r.start; nums = r.items.map(() => 0);
    if (reduce) { vis = r.items.length; nums = r.items.map(i => i.minutes); wallet = r.start + r.total; full = true; }
    else {
      let acc = r.start;
      r.items.forEach((it, i) => {
        const t0 = 450 + i * 750; acc += it.minutes; const upTo = acc;
        at(t0, () => { vis = i + 1; audio.play('xp'); tween(0, it.minutes, 420, v => (nums[i] = v)); });
        at(t0 + 520, () => fly(i, it.minutes, upTo, () => { if (i === r.items.length - 1) full = true; }));
      });
    }
    requestAnimationFrame(() => btn?.focus());
    return () => { dead = true; timers.forEach(clearTimeout); rafs.forEach(cancelAnimationFrame); rafs.clear(); veil?.querySelectorAll('.coin-chip').forEach(c => c.remove()); };
  });
  const onKey = (e: KeyboardEvent) => { if (rewardUI.cur && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); e.stopPropagation(); acceptReward(); } };
</script>

<svelte:window onkeydown={onKey} />
{#if rewardUI.cur}
  {@const r = rewardUI.cur}
  <div class="veil" bind:this={veil} role="dialog" aria-modal="true" aria-label={r.items.length > 1 ? 'Сыйлықтар' : r.items[0].title}>
    <div class="confetti" aria-hidden="true">{#each confetti as c}<i style="left:{c.x}%; --d:{c.d}ms; --t:{c.t}ms; --r:{c.r}deg; --c:{c.c}; --w:{c.w}px"></i>{/each}</div>
    <div class="card" class:full>
      <h2>{r.items.length > 1 ? 'Сыйлықтар!' : r.items[0].title}</h2>
      <div class="wallet" class:full bind:this={walletEl}>
        {#key bump}<span class="ic"><Icon name="clock" fill="var(--gold)" size={34} /></span>{/key}
        <b class="num">{wallet}</b><span class="u">мин ойын</span>
      </div>
      <ul class="rows">
        {#each r.items as it, i}
          <li bind:this={rowEls[i]} class:on={i < vis}>
            <span class="w">{it.why ?? it.title}</span>
            <b class="n num">+{nums[i] ?? 0}</b>
          </li>
        {/each}
      </ul>
      {#if r.weekend !== undefined && r.weekend > 0}<p class="tot">Демалысқа қор: <b class="num">{r.weekend}</b> мин</p>{/if}
      <button bind:this={btn} class="btn primary big" onclick={acceptReward}><Icon name="check" fill="var(--outline)" size={22} />Қабылдау</button>
    </div>
  </div>
{/if}

<style>
  .veil { position: fixed; inset: 0; z-index: calc(var(--z-modal) + 10); display: grid; place-items: center; padding: 14px; overflow: hidden;
    background: radial-gradient(circle at 50% 35%, #2a3fb0aa, #05061ae6 70%); backdrop-filter: blur(3px); animation: fade .25s ease-out both; }
  .confetti { position: absolute; inset: 0; pointer-events: none; overflow: hidden; }
  .confetti i { position: absolute; top: -20px; width: var(--w); height: calc(var(--w) * 1.6); background: var(--c); border: 2px solid var(--outline); border-radius: 2px;
    transform: rotate(var(--r)); animation: fall var(--t) var(--d) cubic-bezier(.3, .6, .5, 1) both; }
  @keyframes fall { 0% { transform: translateY(0) rotate(var(--r)); opacity: 1; } 80% { opacity: 1; } 100% { transform: translateY(105vh) rotate(calc(var(--r) + 540deg)); opacity: 0; } }

  .card { position: relative; width: min(400px, 100%); max-height: 100%; overflow-y: auto; display: grid; gap: 12px; justify-items: center; text-align: center; padding: 20px 16px 18px;
    background: linear-gradient(180deg, #2d49d8, #1a2f96); border: 4px solid var(--outline); border-radius: 26px; box-shadow: 0 8px 0 var(--outline), 0 0 60px #ffc94a55;
    animation: pop-in .42s var(--ease-out) both; }
  .card.full { box-shadow: 0 8px 0 var(--outline), 0 0 90px #ffc94aaa; }
  h2 { font: 900 28px var(--disp); color: var(--gold); -webkit-text-stroke: 2px var(--outline); paint-order: stroke fill; text-shadow: 0 4px 0 var(--outline); }

  /* счётчик минут — «шапка» сцены: сюда влетают монетки */
  .wallet { display: inline-flex; align-items: center; gap: 8px; padding: 6px 18px 6px 10px; border-radius: 999px; background: var(--deep); border: 3px solid var(--outline); box-shadow: inset 0 3px 0 #0006; }
  .wallet .ic { display: grid; animation: bump .35s var(--ease-out); }
  .wallet b { font: 900 44px/1 var(--disp); color: var(--gold); text-shadow: 0 3px 0 var(--outline); min-width: 1.4ch; }
  .wallet .u { font: 800 15px var(--disp); color: var(--dim); text-align: left; line-height: 1.1; max-width: 5em; }
  .wallet.full { animation: glow 1.2s ease-in-out infinite; }
  @keyframes bump { 0% { transform: scale(1); } 40% { transform: scale(1.35) rotate(-10deg); } 100% { transform: scale(1); } }
  @keyframes glow { 50% { box-shadow: inset 0 3px 0 #0006, 0 0 22px #ffcb2e; } }

  .rows { list-style: none; margin: 0; padding: 0; width: 100%; display: grid; gap: 8px; }
  .rows li { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 8px 12px; border-radius: 14px; background: #0b1030aa; border: 3px solid var(--outline);
    opacity: 0; transform: translateY(14px) scale(.96); transition: opacity .3s, transform .35s var(--ease-out); }
  .rows li.on { opacity: 1; transform: none; }
  .rows .w { font: 800 15px/1.25 var(--txt); color: var(--ink); text-align: left; min-width: 0; }
  .rows .n { flex: none; font: 900 30px/1 var(--disp); color: var(--gold); text-shadow: 0 3px 0 var(--outline); min-width: 3ch; text-align: right; }
  .tot { font: 700 14px var(--txt); color: var(--dim); }
  .tot b { color: var(--ink); }
  .btn { width: 100%; }
  :global(.coin-chip) { position: fixed; left: 0; top: 0; z-index: 2; pointer-events: none; padding: 2px 10px; border-radius: 999px; background: var(--gold); border: 3px solid var(--outline);
    font: 900 22px var(--disp); color: var(--outline); box-shadow: 0 0 18px #ffcb2e; }
  @keyframes fade { from { opacity: 0; } }
  @media (max-height: 560px) {
    .veil { padding: 6px; } .card { gap: 6px; padding: 10px 14px 12px; } h2 { font-size: 22px; }
    .wallet b { font-size: 32px; } .rows { gap: 5px; } .rows li { padding: 4px 10px; } .rows .n { font-size: 24px; }
    .card .btn { min-height: 48px; padding: 6px 12px 10px; }
  }
  @media (prefers-reduced-motion: reduce) { .confetti { display: none; } }
</style>
