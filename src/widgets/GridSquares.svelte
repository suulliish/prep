<script lang="ts">
  // «Шаршылар»: w × h торда барлық шаршыны сана — кішісін де, үлкенін де. Өлшемді таңда (1×1, 2×2, …),
  // сосын шаршының сол жақ жоғарғы бұрышын бас: шаршы пайда болады. Сыймайтын жерге бассаң — тек түсінік, айып жоқ.
  // Барлық өлшем толғанда: 9 + 4 + 1 = 14 сияқты қосынды көрінеді, дайын.
  import { audio } from '../lib/audio';
  import { room, watchRoom } from '../lesson/fit';
  import { sideList, countOfSide, totalSquares, fits, key, corners, nextSide } from './gridsquares';

  let { w = 3, h, ondone }: { w?: number; h?: number; ondone?: () => void } = $props();
  const H = h ?? w;
  const sides = sideList(w, H);
  const COLORS = ['var(--code)', 'var(--gold)', 'var(--glitch)', '#9d8cff', '#5ce39c', '#ff9d4f'];
  const colorOf = (s: number) => COLORS[(s - 1) % COLORS.length];

  let sel = $state(1);
  let found = $state<Record<number, Set<string>>>(Object.fromEntries(sides.map(s => [s, new Set<string>()])));
  let note = $state('');
  let bad = $state(false);
  let finished = $state(false);
  let auto = $state(false);
  const timers: ReturnType<typeof setTimeout>[] = [];
  const later = (f: () => void, ms: number) => { timers.push(setTimeout(f, ms)); };
  $effect(() => () => timers.forEach(clearTimeout));

  const done = (s: number) => found[s].size >= countOfSide(w, H, s);
  const total = totalSquares(w, H);

  function place(s: number, r: number, c: number, quiet = false) {
    if (finished) return;
    const k = key(r, c);
    if (found[s].has(k)) return;
    found[s] = new Set([...found[s], k]);
    if (!quiet) audio.play('click');
    if (done(s)) {
      const nx = nextSide(w, H, s, done);
      if (nx === null) { finished = true; note = `Дайын! ${sides.map(x => countOfSide(w, H, x)).join(' + ')} = ${total} шаршы.`; audio.play('correct'); later(() => ondone?.(), 900); }
      else { note = `${s}×${s} шаршылар: ${countOfSide(w, H, s)} дана. Келесі: ${nx}×${nx}.`; sel = nx; }
    } else note = '';
  }
  function tap(r: number, c: number) {
    if (finished || auto) return;
    if (done(sel)) { const nx = nextSide(w, H, sel, done); if (nx !== null) sel = nx; return; }
    if (!fits(w, H, sel, r, c)) {
      bad = true; audio.play('wrong'); note = `${sel}×${sel} шаршы бұл жерге сыймайды. Нүктелі ұяшықты таңда.`;
      later(() => (bad = false), 400); return;
    }
    place(sel, r, c);
  }
  function rest() {
    if (finished || auto) return;
    auto = true;
    const s = sel, todo = corners(w, H, s).filter(p => !found[s].has(key(p.r, p.c)));
    const step = () => {
      const p = todo.shift();
      if (!p || finished) { auto = false; return; }
      place(s, p.r, p.c, true); audio.play('click');
      later(step, 110);
    };
    step();
  }
  const choose = (s: number) => { if (finished || auto) return; sel = s; audio.play('click'); note = ''; };

  // размеры тора
  const CELL = 40, PAD = 8;
  const VW = w * CELL + 2 * PAD, VH = H * CELL + 2 * PAD;
  const ins = (s: number) => 3 + (s - 1) * 1.6;

  let el = $state<HTMLElement>(), svg = $state<SVGSVGElement>(), main = $state<HTMLElement>();
  let maxH = $state(0);
  $effect(() => {
    if (!el || !svg || !main) return;
    return watchRoom(el, () => {
      if (!el || !svg || !main) return;
      const chrome = el.getBoundingClientRect().height - main.getBoundingClientRect().height;
      const r = room(el);
      const next = Number.isFinite(r) ? Math.max(100, Math.round(r - chrome)) : 0;
      if (Math.abs(next - maxH) > 2) maxH = next;
    });
  });
</script>

<div class="gs" class:bad bind:this={el}>
  <div class="main" bind:this={main}>
    <div class="chips" role="group" aria-label="Шаршы өлшемі">
      {#each sides as s}
        <button class="chip" class:on={sel === s} class:ok={done(s)} style="--c:{colorOf(s)}" onclick={() => choose(s)} disabled={finished} aria-label={`${s}×${s}`}>
          <span class="sz num">{s}×{s}</span><span class="ct num">{done(s) ? '✔ ' : ''}{found[s].size}/{countOfSide(w, H, s)}</span>
        </button>
      {/each}
      {#if !finished && found[sel].size >= 2 && !done(sel)}<button class="btn small ghost rest" onclick={rest} disabled={auto}>Қалғанын көрсет</button>{/if}
    </div>

    <svg bind:this={svg} viewBox="0 0 {VW} {VH}" class="grid" style={`max-width:${Math.min(250, w * 80)}px;${maxH ? `max-height:${maxH}px` : ''}`} role="group" aria-label="Тор">
      <rect x={PAD} y={PAD} width={w * CELL} height={H * CELL} rx="6" fill="var(--paper)" />
      {#each Array.from({ length: w + 1 }, (_, i) => i) as i}<line x1={PAD + i * CELL} x2={PAD + i * CELL} y1={PAD} y2={PAD + H * CELL} class="ln" />{/each}
      {#each Array.from({ length: H + 1 }, (_, j) => j) as j}<line y1={PAD + j * CELL} y2={PAD + j * CELL} x1={PAD} x2={PAD + w * CELL} class="ln" />{/each}
      {#each sides as s}
        {#each [...found[s]] as k (s + ':' + k)}
          {@const [r, c] = k.split(',').map(Number)}
          <rect x={PAD + c * CELL + ins(s)} y={PAD + r * CELL + ins(s)} width={s * CELL - 2 * ins(s)} height={s * CELL - 2 * ins(s)} rx="4"
            class="sq" class:cur={s === sel} style="--c:{colorOf(s)}" />
        {/each}
      {/each}
      {#if !finished && !done(sel)}
        {#each corners(w, H, sel).filter(p => !found[sel].has(key(p.r, p.c))) as p (key(p.r, p.c))}
          <circle cx={PAD + p.c * CELL + 9} cy={PAD + p.r * CELL + 9} r="3.5" class="dot" />
        {/each}
      {/if}
      {#each Array.from({ length: H }, (_, r) => r) as r}{#each Array.from({ length: w }, (_, c) => c) as c}
        <rect x={PAD + c * CELL} y={PAD + r * CELL} width={CELL} height={CELL} class="hit" role="button" tabindex="0" aria-label={`Бұрыш ${r + 1}, ${c + 1}`}
          onpointerdown={(e) => { e.preventDefault(); tap(r, c); }} onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tap(r, c); } }} />
      {/each}{/each}
      <rect x={PAD} y={PAD} width={w * CELL} height={H * CELL} rx="6" class="frame" />
    </svg>
  </div>
  <p class="msg" class:ok={finished} aria-live="polite">{note || `Сол жақ жоғарғы бұрышты бас (нүктелер орнын көрсетеді).`}</p>
</div>

<style>
  .gs { display: grid; gap: 6px; justify-items: center; }
  .main { display: flex; gap: 10px; align-items: center; justify-content: center; width: 100%; }
  .chips { display: flex; flex-direction: column; gap: 5px; align-items: stretch; flex: none; }
  .rest { font-size: 12px; padding: 4px 6px; }
  .chip { display: grid; gap: 1px; justify-items: center; min-width: 58px; min-height: 40px; padding: 3px 8px; color: var(--ink); background: var(--panel-hi); border: 2px solid var(--line-hi); border-bottom-width: 4px; border-radius: 10px; cursor: pointer; }
  .chip .sz { font-size: 16px; color: var(--c); }
  .chip .ct { font-size: 12px; color: var(--dim); }
  .chip.on { border-color: var(--c); background: var(--deep); box-shadow: 0 0 10px color-mix(in srgb, var(--c) 45%, transparent); }
  .chip.ok .ct { color: var(--ok); }
  .grid { flex: 0 1 auto; min-width: 0; width: 100%; height: auto; touch-action: manipulation; }
  .bad .grid { animation: shake .35s; }
  .ln { stroke: #b9c2ee; stroke-width: 1.5; }
  .frame { fill: none; stroke: var(--outline); stroke-width: 3; }
  .sq { fill: color-mix(in srgb, var(--c) 22%, transparent); stroke: var(--c); stroke-width: 3; opacity: .35; animation: fade-in .25s ease-out both; }
  .sq.cur { opacity: 1; fill: color-mix(in srgb, var(--c) 32%, transparent); }
  .dot { fill: var(--glitch); animation: gsdot 1.1s ease-in-out infinite; pointer-events: none; }
  .hit { fill: transparent; cursor: pointer; outline: none; }
  .hit:focus-visible { stroke: var(--code); stroke-width: 2; }
  .msg { text-align: center; font-weight: 700; max-width: 340px; min-height: 2.5em; font-size: 15px; line-height: 1.25; }
  .msg.ok { color: var(--ok); }
  @keyframes gsdot { 50% { opacity: .3; } }
  @media (prefers-reduced-motion: reduce) { .dot { animation: none; } }
</style>
