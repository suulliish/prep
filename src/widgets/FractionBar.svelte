<script lang="ts">
  // «Жолақтар»: бөлшекті жолақ ретінде көр.
  //  'cut'     — жолақты тең бөліктерге кес (−/+), керек бөліктерін боя; мақсат target.
  //  'equal'   — екі жолақ қатар: төменгісін ×2 ×3 / :2 :3 арқылы қайта кес, боялған ұзындық өзгермейді; төменгіде target.d бөлік шықса — дайын.
  //  'compare' — қайсысы үлкен: жоғарғысы, төменгісі немесе тең.
  import { audio } from '../lib/audio';
  import Frac from '../ui/Frac.svelte';
  import { cmp, eq, tween, type Fr } from './fracdraw';

  let { rows, mode = 'equal', target, ondone }: { rows: Fr[]; mode?: 'cut' | 'equal' | 'compare'; target?: Fr; ondone?: () => void } = $props();

  type Row = { n: number; d: number; prevD: number; t: number; cells: boolean[] };
  const mk = (r: Fr): Row => ({ n: r.n, d: r.d, prevD: r.d, t: 1, cells: Array.from({ length: r.d }, (_, i) => i < r.n) });
  let R = $state<Row[]>(rows.map(mk));
  const last = rows.length - 1;
  const W = 300, H = 48;
  const COL = ['var(--code)', 'var(--gold)', 'var(--glitch)'];

  let msg = $state('');
  let bad = $state(-1);
  let finished = $state(false);
  let ops = $state(0);
  let out = $state<string[]>([]);
  let revealed = $state(false);
  let stops: (() => void)[] = [];

  const cutCount = $derived(R[0].cells.filter(Boolean).length);
  const nShaded = (r: Row, k: number) => (mode === 'cut' && k === 0 ? cutCount : r.n);
  const same = $derived(R.every(r => eq(r, R[0])));

  function lines(r: Row) {
    const out: { x: number; o: number }[] = [];
    const settled = r.prevD === r.d || r.t >= 1;
    for (let i = 1; i < r.d; i++) out.push({ x: i / r.d, o: settled || (i * r.prevD) % r.d === 0 ? 1 : r.t });
    if (!settled) for (let j = 1; j < r.prevD; j++) if ((j * r.d) % r.prevD !== 0) out.push({ x: j / r.prevD, o: 1 - r.t });
    return out;
  }
  function recut(k: number, nd: number, nn: number) {
    stops[k]?.();
    const r = R[k]; r.prevD = r.d; r.d = nd; r.n = nn; r.t = 0;
    stops[k] = tween(450, x => (r.t = x), () => (r.prevD = r.d));
  }
  function flash(k: number, text: string) {
    bad = k; msg = text; audio.play('wrong'); setTimeout(() => (bad = -1), 400);
  }
  function finish(text: string) {
    finished = true; msg = text; audio.play('correct'); setTimeout(() => ondone?.(), 600);
  }

  // ---- equal ----
  function op(kind: '×' | ':', k: number) {
    if (finished) return;
    const r = R[last];
    if (kind === ':' && (r.n % k || r.d % k)) return flash(last, `${k}-ға бөлінбейді: алым да, бөлім де ${k}-ға бөлінуі керек.`);
    if (kind === '×' && r.d * k > 60) return flash(last, 'Бөлік тым майда болып кетеді.');
    const nd = kind === '×' ? r.d * k : r.d / k, nn = kind === '×' ? r.n * k : r.n / k;
    ops++; audio.play('click'); msg = '';
    recut(last, nd, nn);
    if (target ? nd === target.d : ops >= 2) finish('Дұрыс! Ұзындық сол қалпы, бөлшек тең.');
  }

  // ---- cut ----
  function setD(nd: number) {
    if (finished || nd < 2 || nd > 10 || nd === R[0].d) return;
    R[0].cells = Array(nd).fill(false); msg = ''; audio.play('click');
    recut(0, nd, 0);
  }
  function tapCell(i: number) {
    if (finished || mode !== 'cut' || i >= R[0].d) return;
    R[0].cells[i] = !R[0].cells[i]; msg = ''; audio.play('click');
  }
  function checkCut() {
    if (finished || !target) return;
    if (R[0].d === target.d && cutCount === target.n) return finish('Дұрыс! Тамаша!');
    flash(0, R[0].d !== target.d ? 'Бөлік саны басқа болу керек.' : cutCount > target.n ? 'Тым көп боядың.' : 'Әлі бояу керек.');
  }

  // ---- compare ----
  const truth = $derived(rows.length > 1 ? (['=', '0', '1'] as const)[cmp(R[0], R[1]) === 0 ? 0 : cmp(R[0], R[1]) > 0 ? 1 : 2] : '=');
  function answer(a: '0' | '=' | '1') {
    if (finished || out.includes(a)) return;
    if (a === truth) { revealed = true; finish('Дұрыс! Ұзындықтарын қара.'); }
    else { out = [...out, a]; revealed = true; flash(-1, 'Жолақтардың ұзындығын салыстыр, сосын қайта таңда.'); }
  }
</script>

{#snippet strip(k: number)}
  {@const r = R[k]}
  <svg viewBox="0 0 {W} {H}" class="strip" class:bad={bad === k} role="img" aria-label="{nShaded(r, k)}/{r.d}">
    <rect x="2" y="4" width={W - 4} height={H - 8} rx="7" class="bg" />
    {#if mode === 'cut' && k === 0}
      {#each r.cells as c, i}{#if c && i < r.d}<rect x={2 + ((W - 4) * i) / r.d} y="4" width={(W - 4) / r.d} height={H - 8} fill={COL[0]} />{/if}{/each}
    {:else}
      <rect x="2" y="4" width={((W - 4) * r.n) / r.d} height={H - 8} rx="7" fill={COL[Math.min(k, 2)]} />
    {/if}
    {#each lines(r) as l}<line x1={2 + (W - 4) * l.x} x2={2 + (W - 4) * l.x} y1="4" y2={H - 4} class="ln" opacity={l.o} />{/each}
    <rect x="2" y="4" width={W - 4} height={H - 8} rx="7" class="frame" />
    {#if mode === 'cut' && k === 0}
      {#each Array(r.d) as _, i}
        <rect x={2 + ((W - 4) * i) / r.d} y="0" width={(W - 4) / r.d} height={H} class="hit" role="button" tabindex="0" aria-label="Бөлік {i + 1}"
          onpointerdown={(e) => { e.preventDefault(); tapCell(i); }} onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), tapCell(i))} />
      {/each}
    {/if}
  </svg>
{/snippet}

<div class="fb">
  <div class="board">
    {#each R as r, k}
      <div class="lab" style="color:{COL[Math.min(k, 2)]};grid-area:{k + 1}/1"><Frac n={nShaded(r, k)} d={r.d} size="lg" /></div>
      <div class="cell" style="grid-area:{k + 1}/2">{@render strip(k)}</div>
    {/each}
    {#if mode === 'equal' && same || revealed}
      <div class="guides" aria-hidden="true" style="grid-area:1/2/{R.length + 1}/3">
        {#each mode === 'equal' ? [R[0]] : R as r}<i style="left:{((r.n / r.d) * (W - 4) + 2) / W * 100}%"></i>{/each}
      </div>
    {/if}
  </div>

  {#if mode === 'equal'}
    <div class="eqline num">{#each R as r, k}{#if k}<span class="eqs">=</span>{/if}<Frac n={r.n} d={r.d} size="md" color={COL[Math.min(k, 2)]} />{/each}</div>
    <div class="ops">
      {#each [['×', 2], ['×', 3], [':', 2], [':', 3]] as [kind, k]}
        <button class="btn" onclick={() => op(kind as '×' | ':', k as number)} disabled={finished} aria-label="{kind === '×' ? 'Көбейту' : 'Бөлу'} {k}">{kind}{k}</button>
      {/each}
    </div>
    <p class="msg" class:ok={finished}>{msg || (target ? `Төменгі жолақты ${target.d} тең бөлікке айналдыр: боялған ұзындық өзгермейді.` : 'Төменгі жолақты қайта кес: боялған ұзындық өзгермейді.')}</p>
  {:else if mode === 'cut'}
    <div class="stepper">
      <button class="btn" onclick={() => setD(R[0].d - 1)} disabled={R[0].d <= 2 || finished} aria-label="Азайту">−</button>
      <span class="num cnt"><b>{R[0].d}</b> тең бөлік</span>
      <button class="btn" onclick={() => setD(R[0].d + 1)} disabled={R[0].d >= 10 || finished} aria-label="Көбейту">+</button>
    </div>
    <p class="msg" class:ok={finished}>{msg || (target ? `Жолақты ${target.d} тең бөлікке кесіп, ${target.n} бөлігін боя.` : 'Жолақты кесіп, бөліктерін боя.')}</p>
    <button class="btn primary big" onclick={checkCut} disabled={finished}>Тексеру</button>
  {:else}
    <div class="cmp">
      {#each [['0', 0], ['=', -1], ['1', 1]] as [a, idx]}
        <button class="btn choice" class:out={out.includes(a as string)} class:right={finished && a === truth} onclick={() => answer(a as '0' | '=' | '1')} disabled={finished || out.includes(a as string)}
          aria-label={a === '=' ? 'Тең' : `Үлкені: ${R[idx as number].n}/${R[idx as number].d}`}>
          {#if a === '='}<span class="num eqbig">=</span>{:else}<Frac n={R[idx as number].n} d={R[idx as number].d} size="lg" />{/if}
        </button>
      {/each}
    </div>
    <p class="msg" class:ok={finished}>{msg || 'Қайсысы үлкен? Үлкен бөлшекті бас, тең болса «=» бас.'}</p>
  {/if}
</div>

<style>
  .fb { display: grid; gap: 12px; justify-items: center; }
  .board { position: relative; display: grid; grid-template-columns: auto 1fr; align-items: center; gap: 10px 10px; width: 100%; max-width: 420px; }
  .lab { min-width: 44px; text-align: center; }
  .strip { width: 100%; height: auto; touch-action: manipulation; overflow: visible; }
  .strip.bad { animation: shake .35s; }
  .bg { fill: var(--paper); stroke: none; }
  .frame { fill: none; stroke: var(--outline); stroke-width: 3; }
  .ln { stroke: var(--outline); stroke-width: 2.5; }
  .hit { fill: transparent; cursor: pointer; }
  .guides { position: relative; pointer-events: none; align-self: stretch; }
  .guides i { position: absolute; top: -4px; bottom: -4px; border-left: 3px dashed var(--ok); }
  .eqline { display: flex; align-items: center; justify-content: center; gap: 10px; color: var(--ink); min-height: 44px; }
  .eqs { font-size: 22px; color: var(--dim); }
  .ops { display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; }
  .ops .btn { min-width: 68px; min-height: 52px; font-size: 22px; padding: 4px 10px 8px; }
  .stepper { display: flex; align-items: center; gap: 12px; }
  .stepper .btn { width: 56px; min-height: 52px; padding: 4px; font-size: 28px; }
  .cnt { min-width: 130px; text-align: center; font-size: var(--fs-m); color: var(--dim); }
  .cnt b { font-size: 30px; color: var(--ink); }
  .cmp { display: flex; gap: 10px; justify-content: center; }
  .choice { min-width: 84px; min-height: 76px; padding: 6px 12px 10px; }
  .choice.right { --c: var(--ok); --e: var(--ok-deep); --t: var(--outline); }
  .choice.out { opacity: .45; }
  .eqbig { font-size: 34px; }
  .msg { text-align: center; font-weight: 800; min-height: 2.6em; max-width: 340px; }
  .msg.ok { color: var(--ok); }
</style>
