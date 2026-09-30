<script lang="ts">
  // «Аудан»: бөлшекті аудан ретінде көр. Төрт режим:
  //  'mul'   — бірлік квадрат: алдымен тік жолақтарға кесіп a.n бөлігін боя, сосын көлденең b.d бөлікке кесіп b.n бөлігін боя.
  //            Қиылысқан аудан — көбейтінді a · b. Керекті кесу мен бояу болғанда дайын.
  //  'fit'   — «неше рет сияды?»: whole бүтін, ұзындығы piece бөлшегіндей бөліктерді бір-бірден қой; жолақтар толғанда дайын (whole : piece).
  //  'part'  — санның бөлігі: total санын жолақ ретінде target.d тең бөлікке кес, target.n бөлігін боя; әр бөліктің массасы көрінеді.
  //  'whole' — бөлігі бойынша сан: frac.n бөлік = known. Бір бөлік қанша екенін тап, сосын бос бөліктерді толтырып, бүтінді көр.
  import { audio } from '../lib/audio';
  import Frac from '../ui/Frac.svelte';
  import { room, watchRoom } from '../lesson/fit';
  import { overlap, sliceOk, areaProduct, fitInfo, fitCanPlace, fitDone, fitCells, partUnit, unitChoices, type Fr } from './fracarea';

  let { mode = 'mul', a = { n: 1, d: 2 }, b = { n: 3, d: 4 }, whole = 3, piece = { n: 1, d: 4 }, total = 40, target = { n: 3, d: 5 }, known = 35, frac = { n: 5, d: 12 }, unit = 'г', ondone }:
    { mode?: 'mul' | 'fit' | 'part' | 'whole'; a?: Fr; b?: Fr; whole?: number; piece?: Fr; total?: number; target?: Fr; known?: number; frac?: Fr; unit?: string; ondone?: () => void } = $props();

  const COL = 'var(--code)', ROW = 'var(--gold)', BOTH = 'var(--glitch)';
  const startD = (t: Fr) => (t.d === 2 ? 3 : 2);
  const range = (k: number) => Array.from({ length: k }, (_, i) => i);

  let finished = $state(false);
  let bad = $state(false);
  let msg = $state('');
  function flash(text: string) { msg = text; bad = true; audio.play('wrong'); setTimeout(() => (bad = false), 400); }
  function finish(text: string) { finished = true; msg = text; audio.play('correct'); setTimeout(() => ondone?.(), 600); }

  // ---------- mul ----------
  let phase = $state<1 | 2>(1);
  let d1 = $state(startD(a)), d2 = $state(startD(b));
  let cols = $state<boolean[]>(Array(startD(a)).fill(false));
  let rows = $state<boolean[]>(Array(startD(b)).fill(false));
  const nCols = $derived(cols.filter(Boolean).length), nRows = $derived(rows.filter(Boolean).length);
  const R = $derived(phase === 1 ? 1 : d2);                       // на первом шаге квадрат режем только вертикально
  const ov = $derived(overlap(cols, phase === 2 ? rows : []));
  const prod = $derived(areaProduct(a, b));
  const cur = $derived(phase === 1 ? d1 : d2);
  function setD(nd: number) {
    if (finished || nd < 2 || nd > 8) return;
    msg = ''; audio.play('click');
    if (phase === 1) { d1 = nd; cols = Array(nd).fill(false); } else { d2 = nd; rows = Array(nd).fill(false); }
  }
  function tapCell(i: number, j: number) {
    if (finished) return;
    msg = ''; audio.play('click');
    if (phase === 1) cols[i] = !cols[i]; else rows[j] = !rows[j];
  }
  function checkMul() {
    if (finished) return;
    const [d, n, t] = phase === 1 ? [d1, nCols, a] as const : [d2, nRows, b] as const;
    if (!sliceOk(d, n, t)) return flash(d !== t.d ? 'Бөлік саны басқа болу керек.' : n > t.n ? 'Тым көп боядың.' : 'Әлі бояу керек.');
    if (phase === 1) { phase = 2; msg = ''; audio.play('click'); }
    else finish('Дұрыс! Қиылысқан аудан — көбейтінді.');
  }
  const cellFill = (i: number, j: number) => (phase === 2 && cols[i] && rows[j] ? BOTH : cols[i] ? COL : phase === 2 && rows[j] ? ROW : 'var(--paper)');

  // размер квадрата подгоняем под высоту, оставшуюся в панели урока (справа от квадрата — кнопки, поэтому он может быть крупным)
  let el = $state<HTMLElement>(), row = $state<HTMLElement>();
  let sz = $state(150);
  $effect(() => {
    if (mode !== 'mul' || !el || !row) return;
    return watchRoom(el, () => {
      if (!el || !row) return;
      const chrome = el.getBoundingClientRect().height - row.getBoundingClientRect().height;
      const next = Math.round(Math.max(100, Math.min(200, room(el) - chrome, el.clientWidth - 172)));
      if (Math.abs(next - sz) > 2) sz = next;
    });
  });

  // ---------- fit ----------
  let placed = $state(0);
  const info = $derived(fitInfo(whole, piece));
  const FW = 300, FL = 20, FH = 30, FG = 7;
  const fcw = $derived((FW - FL - 4) / piece.d);
  const segsOf = (k: number) => {
    const out: { row: number; c0: number; c1: number }[] = [];
    for (const c of fitCells(k, piece)) { const l = out.at(-1); if (l && l.row === c.row) l.c1 = c.col + 1; else out.push({ row: c.row, c0: c.col, c1: c.col + 1 }); }
    return out;
  };
  const rowY = (r: number) => 4 + r * (FH + FG);
  function place() {
    if (finished) return;
    if (!fitCanPlace(placed, whole, piece)) return flash('Сыймайды.');
    placed++; msg = ''; audio.play('click');
    if (fitDone(placed, whole, piece)) finish(info.rest === 0 && piece.n === 1 ? `Дұрыс! Әр бүтінге ${piece.d} бөлік сыяды. Барлығы ${placed}.` : `Дұрыс! Барлығы ${placed} бөлік сыйды.`);
  }
  function undo() { if (finished || !placed) return; placed--; msg = ''; audio.play('click'); }

  // ---------- part ----------
  let pd = $state(startD(target));
  let cells = $state<boolean[]>(Array(startD(target)).fill(false));
  const nCells = $derived(cells.filter(Boolean).length);
  const per = $derived(partUnit(total, pd));
  function setPd(nd: number) {
    if (finished || nd < 2 || nd > 10 || nd === pd) return;
    pd = nd; cells = Array(nd).fill(false); msg = ''; audio.play('click');
  }
  function tapPart(i: number) { if (finished) return; cells[i] = !cells[i]; msg = ''; audio.play('click'); }
  function checkPart() {
    if (finished) return;
    if (!sliceOk(pd, nCells, target)) return flash(pd !== target.d ? 'Бөлік саны басқа болу керек.' : nCells > target.n ? 'Тым көп боядың.' : 'Әлі бояу керек.');
    finish(`Дұрыс! ${nCells} · ${per} = ${nCells * (per ?? 0)} ${unit}.`);
  }

  // ---------- whole ----------
  const unitVal = known / frac.n;
  let asked = $state(false);
  let extra = $state(0);                                          // қанша бос бөлік толтырылды
  const missing = frac.d - frac.n;
  function chooseUnit(v: number) {
    if (finished || asked) return;
    if (v !== unitVal) return flash(`Боялған ${frac.n} бөліктің массасы ${known} ${unit}. Бір бөлік қанша?`);
    asked = true; msg = ''; audio.play('click');
  }
  function fillNext() {
    if (finished || !asked || extra >= missing) return;
    extra++; msg = ''; audio.play('click');
    if (extra === missing) finish(`Дұрыс! ${frac.d} · ${unitVal} = ${frac.d * unitVal} ${unit}.`);
  }
  const wholeCell = (i: number) => (i < frac.n ? 'known' : i - frac.n < extra ? 'fill' : 'empty');
  const sw = 300, sh = 56;
</script>

{#snippet stepper(n: number, set: (v: number) => void, lo: number, hi: number, label: string)}
  <div class="stepper" aria-label={label}>
    <button class="btn" onclick={() => set(n - 1)} disabled={n <= lo || finished} aria-label="Азайту">−</button>
    <span class="num cnt"><b>{n}</b><small>тең бөлік</small></span>
    <button class="btn" onclick={() => set(n + 1)} disabled={n >= hi || finished} aria-label="Көбейту">+</button>
  </div>
{/snippet}

<div class="fa" class:bad bind:this={el} data-mode={mode}>
  {#if mode === 'mul'}
    <div class="expr num">
      <Frac n={a.n} d={a.d} size={26} color={COL} /><span class="op">·</span><Frac n={b.n} d={b.d} size={26} color={ROW} /><span class="op">=</span>
      {#if finished}
        <Frac n={prod.cells.n} d={prod.cells.d} size={26} color="var(--ok)" />
        {#if prod.reduced.n !== prod.cells.n}<span class="op">=</span><Frac n={prod.reduced.n} d={prod.reduced.d} size={26} color="var(--ok)" />{/if}
      {:else if phase === 2 && ov > 0}<Frac n={ov} d={d1 * d2} size={26} color={BOTH} />
      {:else}<b class="q">?</b>{/if}
    </div>

    <div class="mrow" bind:this={row} style="--sz:{sz}px">
      <svg viewBox="0 0 220 220" class="sq" role="group" aria-label="Квадрат">
        <rect x="10" y="10" width="200" height="200" rx="6" fill="var(--paper)" />
        {#each range(d1) as i}{#each range(R) as j}
          <rect x={10 + (200 * i) / d1} y={10 + (200 * j) / R} width={200 / d1} height={200 / R} fill={cellFill(i, j)} class="cell" class:hot={phase === 2 && cols[i] && rows[j]} />
        {/each}{/each}
        {#each range(d1 - 1) as i}<line x1={10 + (200 * (i + 1)) / d1} x2={10 + (200 * (i + 1)) / d1} y1="10" y2="210" class="ln" />{/each}
        {#each range(R - 1) as j}<line y1={10 + (200 * (j + 1)) / R} y2={10 + (200 * (j + 1)) / R} x1="10" x2="210" class="ln" />{/each}
        <rect x="10" y="10" width="200" height="200" rx="6" class="frame" />
        <rect x="10" y="1" width="200" height="6" rx="3" fill={COL} class="axb" class:dim={phase === 2} />
        <rect x="1" y="10" width="6" height="200" rx="3" fill={ROW} class="axb" class:dim={phase === 1} />
        {#each range(d1) as i}{#each range(R) as j}
          <rect x={10 + (200 * i) / d1} y={10 + (200 * j) / R} width={200 / d1} height={200 / R} class="hit" role="button" tabindex="0"
            aria-label={phase === 1 ? `Тік бөлік ${i + 1}` : `Көлденең бөлік ${j + 1}`}
            onpointerdown={(e) => { e.preventDefault(); tapCell(i, j); }} onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), tapCell(i, j))} />
        {/each}{/each}
      </svg>
      <div class="side">
        {@render stepper(cur, setD, 2, 8, phase === 1 ? 'Тік бөлік саны' : 'Көлденең бөлік саны')}
        <button class="btn primary chk" onclick={checkMul} disabled={finished}>Тексеру</button>
      </div>
    </div>
    <p class="msg" class:ok={finished}>{msg || (phase === 1 ? `Тік ${a.d} бөлікке кес, ${a.n} бөлігін боя.` : `Көлденең ${b.d} бөлікке кес, ${b.n} бөлігін боя.`)}</p>

  {:else if mode === 'fit'}
    <div class="expr num">
      <b class="big">{whole}</b><span class="op">:</span><Frac n={piece.n} d={piece.d} size={26} color={COL} /><span class="op">=</span>
      {#if finished}<b class="big ok">{placed}</b>{:else}<b class="q">?</b>{/if}
    </div>
    <svg viewBox="0 0 {FW} {rowY(whole - 1) + FH + 4}" class="fit" role="group" aria-label="Жолақтар" data-placed={placed}>
      {#each range(whole) as r}
        <text x="8" y={rowY(r) + FH / 2 + 6} class="rn num">{r + 1}</text>
        <rect x={FL} y={rowY(r)} width={FW - FL - 4} height={FH} rx="6" fill="var(--paper)" />
        {#each range(piece.d - 1) as c}<line x1={FL + (c + 1) * fcw} x2={FL + (c + 1) * fcw} y1={rowY(r)} y2={rowY(r) + FH} class="ln thin" />{/each}
        <rect x={FL} y={rowY(r)} width={FW - FL - 4} height={FH} rx="6" class="frame" />
      {/each}
      {#each range(placed) as k (k)}
        {#each segsOf(k) as s, si}
          <rect x={FL + s.c0 * fcw + 1.5} y={rowY(s.row) + 1.5} width={(s.c1 - s.c0) * fcw - 3} height={FH - 3} rx="5" fill={k % 2 ? ROW : COL} class="pc" />
          {#if si === 0}<text x={FL + (s.c0 + s.c1) / 2 * fcw} y={rowY(s.row) + FH / 2 + 6} class="pn num">{k + 1}</text>{/if}
        {/each}
      {/each}
      {#if !finished && fitCanPlace(placed, whole, piece)}
        {#each segsOf(placed) as s}<rect x={FL + s.c0 * fcw + 1.5} y={rowY(s.row) + 1.5} width={(s.c1 - s.c0) * fcw - 3} height={FH - 3} rx="5" class="nxt" />{/each}
      {/if}
      <rect x="0" y="0" width={FW} height={rowY(whole - 1) + FH + 4} fill="transparent" class="tap" role="button" tabindex="-1" aria-label="Бөлік қою" onpointerdown={(e) => { e.preventDefault(); place(); }} />
    </svg>
    <div class="ctl">
      <button class="btn primary chk" onclick={place} disabled={finished} aria-label="Бөлік қою"><span>+</span><Frac n={piece.n} d={piece.d} size="md" /></button>
      <span class="num cnt"><b>{placed}</b><small>бөлік сыйды</small></span>
      <button class="btn small ghost" onclick={undo} disabled={finished || !placed} aria-label="Қайтару">Қайтару</button>
    </div>
    <p class="msg" class:ok={finished}>{msg || 'Бөліктерді қой: жолақ толғанша.'}</p>

  {:else if mode === 'part'}
    <div class="expr num"><Frac n={target.n} d={target.d} size={26} color={COL} /><span class="op">·</span><b class="big">{total}</b><span class="uu">{unit}</span><span class="op">=</span><b class="q">?</b></div>
    <div class="brace" aria-hidden="true"><b class="num">{total} {unit}</b></div>
    <svg viewBox="0 0 {sw} {sh}" class="strip" role="group" aria-label="Жолақ">
      <rect x="2" y="4" width={sw - 4} height={sh - 8} rx="7" fill="var(--paper)" />
      {#each range(pd) as i}
        <rect x={2 + ((sw - 4) * i) / pd} y="4" width={(sw - 4) / pd} height={sh - 8} fill={cells[i] ? COL : 'var(--paper)'} class="cell" />
        {#if per !== null}<text x={2 + ((sw - 4) * (i + 0.5)) / pd} y={sh / 2 + 6} class="cv num">{per}</text>{/if}
      {/each}
      {#each range(pd - 1) as i}<line x1={2 + ((sw - 4) * (i + 1)) / pd} x2={2 + ((sw - 4) * (i + 1)) / pd} y1="4" y2={sh - 4} class="ln" />{/each}
      <rect x="2" y="4" width={sw - 4} height={sh - 8} rx="7" class="frame" />
      {#each range(pd) as i}
        <rect x={2 + ((sw - 4) * i) / pd} y="0" width={(sw - 4) / pd} height={sh} class="hit" role="button" tabindex="0" aria-label="Бөлік {i + 1}"
          onpointerdown={(e) => { e.preventDefault(); tapPart(i); }} onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), tapPart(i))} />
      {/each}
    </svg>
    <div class="calc num">
      <span>{per !== null ? `${total} : ${pd} = ${per} ${unit}` : `${total} ${unit} ${pd} бөлікке тең бөлінбейді`}</span>
      {#if per !== null && nCells > 0}<span class="sum">{nCells} · {per} = {nCells * per} {unit}</span>{/if}
    </div>
    <div class="ctl">
      {@render stepper(pd, setPd, 2, 10, 'Бөлік саны')}
      <button class="btn primary chk" onclick={checkPart} disabled={finished}>Тексеру</button>
    </div>
    <p class="msg" class:ok={finished}>{msg || `${target.d} тең бөлікке кес, ${target.n} бөлігін боя.`}</p>

  {:else}
    <div class="expr num"><Frac n={frac.n} d={frac.d} size={26} color={COL} /><span class="op">=</span><b class="big">{known}</b><span class="uu">{unit}</span><span class="op">→</span><b class="q">?</b></div>
    <div class="wrap">
      <div class="brace known" style="width:{(frac.n / frac.d) * 100}%" aria-hidden="true"><b class="num">{known} {unit}</b></div>
      <svg viewBox="0 0 {sw} {sh}" class="strip" role="group" aria-label="Жолақ">
        <rect x="2" y="4" width={sw - 4} height={sh - 8} rx="7" fill="var(--paper)" />
        {#each range(frac.d) as i}
          {@const k = wholeCell(i)}
          <rect x={2 + ((sw - 4) * i) / frac.d} y="4" width={(sw - 4) / frac.d} height={sh - 8} fill={k === 'known' ? COL : k === 'fill' ? ROW : 'var(--paper)'} class="cell" class:pop={k === 'fill'} />
          {#if k === 'empty'}<text x={2 + ((sw - 4) * (i + 0.5)) / frac.d} y={sh / 2 + 6} class="cv q2">?</text>
          {:else if asked}<text x={2 + ((sw - 4) * (i + 0.5)) / frac.d} y={sh / 2 + 6} class="cv num">{unitVal}</text>{/if}
        {/each}
        {#each range(frac.d - 1) as i}<line x1={2 + ((sw - 4) * (i + 1)) / frac.d} x2={2 + ((sw - 4) * (i + 1)) / frac.d} y1="4" y2={sh - 4} class="ln" />{/each}
        <rect x="2" y="4" width={sw - 4} height={sh - 8} rx="7" class="frame" />
        <rect x="0" y="0" width={sw} height={sh} fill="transparent" class="tap" role="button" tabindex="0" aria-label="Бос бөлікті толтыру"
          onpointerdown={(e) => { e.preventDefault(); fillNext(); }} onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), fillNext())} />
      </svg>
    </div>
    <div class="calc num">
      {#if !asked}<span>{frac.n} бөлік = {known} {unit}</span>
      {:else}<span>{known} : {frac.n} = {unitVal} {unit}</span><span class="sum">{known + extra * unitVal} {unit}</span>{/if}
    </div>
    {#if !asked}
      <div class="ctl ask"><span class="qt">Бір бөлік неше {unit}?</span>
        {#each unitChoices(known, frac.n) as v}<button class="btn small" onclick={() => chooseUnit(v)}>{v}</button>{/each}
      </div>
    {/if}
    <p class="msg" class:ok={finished}>{msg || (asked ? 'Бос бөліктерді бас.' : 'Алдымен бір бөліктің массасын тап.')}</p>
  {/if}
</div>

<style>
  .fa { display: grid; gap: 5px; justify-items: center; color: var(--ink); }
  .fa { gap: 5px; }
  .fa.bad .sq, .fa.bad .fit, .fa.bad .strip { animation: shake .35s; }
  .expr { display: flex; align-items: center; justify-content: center; flex-wrap: wrap; gap: 8px; min-height: 40px; }
  .uu { font-size: 18px; color: var(--dim); margin-left: -4px; }
  .op { font-size: 24px; color: var(--dim); }
  .q { font-size: 26px; color: var(--glitch); }
  .big { font-size: 26px; } .big.ok { color: var(--ok); }
  .mrow { display: flex; align-items: center; justify-content: center; gap: 10px; }
  .side { display: grid; gap: 8px; justify-items: center; }
  .sq { width: var(--sz); height: var(--sz); flex: none; touch-action: manipulation; overflow: visible; }
  .axb { transition: opacity .2s; } .axb.dim { opacity: .35; }
  .cell { stroke: none; transition: fill .2s; }
  .cell.hot { animation: pulse .9s ease-in-out infinite alternate; }
  @keyframes pulse { to { opacity: .72; } }
  .cell.pop { animation: pop-in .3s var(--ease-out); }
  .ln { stroke: var(--outline); stroke-width: 2.5; }
  .ln.thin { stroke-width: 1.5; opacity: .5; }
  .frame { fill: none; stroke: var(--outline); stroke-width: 3.5; }
  .hit { fill: transparent; cursor: pointer; }
  .tap { cursor: pointer; }
  .fit { width: min(100%, 340px); height: auto; touch-action: manipulation; }
  .rn { fill: var(--dim); font-size: 14px; }
  .pc { stroke: var(--outline); stroke-width: 2.5; animation: pop-in .25s var(--ease-out); }
  .pn { fill: var(--outline); font-size: 15px; text-anchor: middle; pointer-events: none; }
  .nxt { fill: none; stroke: var(--code); stroke-width: 2.5; stroke-dasharray: 5 4; animation: blink 1.2s ease-in-out infinite alternate; pointer-events: none; }
  @keyframes blink { to { opacity: .35; } }
  .strip { width: min(100%, 340px); height: auto; touch-action: manipulation; overflow: visible; }
  .cv { fill: var(--outline); font-size: 17px; text-anchor: middle; pointer-events: none; }
  .cv.q2 { fill: var(--glitch); font-size: 22px; font-weight: 900; }
  .wrap { width: min(100%, 340px); }
  .brace { width: min(100%, 340px); border: 3px solid var(--dim); border-bottom: 0; border-radius: 8px 8px 0 0; padding: 0 6px; text-align: center; font-size: 15px; height: 26px; display: grid; place-items: center; }
  .brace.known { width: 100%; max-width: none; height: 24px; font-size: 14px; white-space: nowrap; overflow: visible; }
  .calc { display: flex; flex-wrap: wrap; justify-content: center; gap: 4px 14px; font-size: 17px; min-height: 26px; }
  .calc .sum { color: var(--gold); }
  .ctl { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 6px 10px; }
  .ctl.ask { gap: 8px; }
  .qt { font-weight: 800; }
  .ctl .btn { min-height: 44px; padding: 4px 14px 8px; }
  .stepper { display: flex; align-items: center; gap: 6px; }
  .stepper .btn { width: 44px; padding: 2px; font-size: 24px; }
  .cnt { min-width: 52px; display: grid; justify-items: center; line-height: 1; color: var(--dim); }
  .cnt b { font-size: 28px; color: var(--ink); }
  .cnt small { font: 800 11px var(--txt); }
  .chk :global(.frac) { margin-left: 2px; }
  .msg { text-align: center; font-weight: 800; font-size: var(--fs-s); line-height: 1.3; min-height: 1.4em; max-width: 340px; }
  .msg.ok { color: var(--ok); }
</style>
