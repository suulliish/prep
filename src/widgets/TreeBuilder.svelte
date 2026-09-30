<script lang="ts">
  // «Ағаш»: таңдаулар ағашы. Түйінді бас: сол түйіннен кейінгі мүмкін таңдаулар (қалған элементтер) ашылады.
  //  mode 'perm'  — k орынға n элементті қою: ағаш толғанда жолдар саны = n · (n − 1) · … (көбейту ережесі).
  //  mode 'pairs' — k = 2, «бәрі бәрімен бір рет»: ағаш толғанда әр ойын екі рет тұр (А—Б және Б—А). Жолды бас: ол қалады, қосарлысы сызылады.
  import { audio } from '../lib/audio';
  import { room, watchRoom } from '../lesson/fit';
  import { buildTree, visibleIds, canOpen, treeComplete, openAll, visibleLeaves, levelCounts, twinId, tapLeaf, leafLabel, permCount, pairCount } from './permtree';

  let { items = ['Қ', 'К', 'Ж'], k, mode = 'perm', heads, ondone }:
    { items?: string[]; k?: number; mode?: 'perm' | 'pairs'; heads?: string[]; ondone?: () => void } = $props();

  const n = items.length;
  const K = mode === 'pairs' ? 2 : Math.min(k ?? n, n);
  const tree = buildTree(n, K);
  const COLORS = ['var(--code)', 'var(--gold)', 'var(--glitch)', '#9d8cff', '#5ce39c'];
  const HEADS = heads ?? (mode === 'pairs' ? ['1-ойыншы', '2-ойыншы'] : Array.from({ length: K }, (_, i) => `${i + 1}-орын`));

  let open = $state(new Set<string>());
  let manual = $state(0);
  let kept = $state(new Set<string>());
  let struck = $state(new Set<string>());
  let finished = $state(false);
  let auto = $state(false);
  let note = $state('');
  let shake = $state('');
  const timers: ReturnType<typeof setTimeout>[] = [];
  const later = (f: () => void, ms: number) => { timers.push(setTimeout(f, ms)); };
  $effect(() => () => timers.forEach(clearTimeout));

  const vis = $derived(visibleIds(tree, open));
  const complete = $derived(treeComplete(tree, open));
  const leavesNow = $derived(visibleLeaves(tree, vis));
  const strikePhase = $derived(mode === 'pairs' && complete);
  const total = permCount(n, K), games = pairCount(n);
  const counts = levelCounts(n, K);
  const shownLevels = $derived(counts.filter((_, d) => tree.nodes.some(x => x.depth === d + 1 && vis.has(x.id))).length);

  // раскладка. Обычная: листья по строкам. Если листьев больше 6 (k = 2, 4 элемента): строка на каждого игрока, листья-«таблетки» вдоль строки
  const rowsMode = K === 2 && tree.leaves > 6;
  const VW = 340, LBL = 62, X0 = 28, TOP = rowsMode ? 24 : 30;
  const dx = (VW - X0 - LBL - 22) / K;
  const lvl1 = tree.nodes.filter(x => x.depth === 1);
  const rowH = rowsMode ? Math.min(44, 200 / lvl1.length) : Math.min(40, 300 / tree.leaves);
  const R = rowsMode ? 12 : Math.min(13, rowH / 2 - 3);
  const PW = 70, PG = 6, PX = 92, ROOT_X = 16, L1_X = 58;
  const VH = TOP + (rowsMode ? lvl1.length : tree.leaves) * rowH + 6;
  const pos = new Map<string, { x: number; y: number }>();
  for (const x of tree.nodes) {
    if (!rowsMode) { pos.set(x.id, { x: X0 + x.depth * dx, y: TOP + (x.row + 0.5) * rowH }); continue; }
    if (x.depth === 0) pos.set(x.id, { x: ROOT_X, y: TOP + (lvl1.length / 2) * rowH });
    else if (x.depth === 1) pos.set(x.id, { x: L1_X, y: TOP + (lvl1.indexOf(x) + 0.5) * rowH });
    else { const par = tree.byId.get(x.parent!)!; pos.set(x.id, { x: PX + par.kids.indexOf(x.id) * (PW + PG) + PW / 2, y: TOP + (lvl1.indexOf(par) + 0.5) * rowH }); }
  }
  const headX = (d: number) => (rowsMode && d === 2 ? PX + ((K === 2 ? n - 1 : 1) * (PW + PG) - PG) / 2 : pos.get(tree.nodes.find(x => x.depth === d)!.id)!.x);

  function openNode(id: string) {
    if (finished || open.has(id) || !canOpen(tree, id) || !vis.has(id)) return;
    open = new Set([...open, id]); manual++; audio.play('click'); note = '';
    check();
  }
  function revealAll() {
    if (finished || auto) return;
    open = openAll(tree, open); audio.play('xp'); check();
  }
  function check() {
    if (!treeComplete(tree, open)) return;
    if (mode === 'perm') finish(`Дайын! ${counts.join(' · ')} = ${total} тәсіл.`);
    else note = `Жолдар: ${total}. Бірақ ${items[0]}—${items[1]} мен ${items[1]}—${items[0]} бір ойын. Қайталанғандарды сыз: жолды бас.`;
  }
  function finish(text: string) {
    finished = true; note = text; audio.play('correct'); later(() => ondone?.(), 900);
  }
  function tapLeafNode(id: string) {
    if (!strikePhase || finished) return;
    const r = tapLeaf(tree, kept, struck, id);
    kept = new Set(kept); struck = new Set(struck);
    if (r === 'keep') {
      audio.play('click');
      if (kept.size === games) finish(`Дайын! ${total} : 2 = ${games} ойын.`);
      else note = `${leafLabel(tree, id, items).split('').join('—')} қалды, қосарлысы сызылды. Ойындар: ${kept.size}.`;
    } else if (r === 'struck') { shake = id; audio.play('wrong'); note = 'Бұл жол қайталанған, ол сызылған. Қалдырғанын бас.'; later(() => (shake = ''), 450); }
  }
  function restAuto() {
    if (auto || finished) return;
    auto = true;
    const todo = tree.nodes.filter(x => x.depth === 2 && !kept.has(x.id) && !struck.has(x.id)).map(x => x.id);
    const step = () => {
      const id = todo.shift();
      if (id === undefined || finished) { auto = false; return; }
      if (!kept.has(id) && !struck.has(id)) tapLeafNode(id);
      later(step, 130);
    };
    step();
  }

  const colorOf = (i: number) => COLORS[i % COLORS.length];
  const labelOf = (id: string) => (mode === 'pairs' ? leafLabel(tree, id, items).split('').join('—') : leafLabel(tree, id, items));

  // подгонка под высоту, оставшуюся в панели урока
  let el = $state<HTMLElement>(), svg = $state<SVGSVGElement>();
  let maxH = $state(0);
  $effect(() => {
    if (!el || !svg) return;
    return watchRoom(el, () => {
      if (!el || !svg) return;
      const chrome = el.getBoundingClientRect().height - svg.getBoundingClientRect().height;
      const r = room(el);
      const next = Number.isFinite(r) ? Math.max(150, Math.round(r - chrome)) : 0;
      if (Math.abs(next - maxH) > 2) maxH = next;
    });
  });
</script>

<div class="tb" bind:this={el} data-mode={mode}>
  <svg bind:this={svg} viewBox="0 0 {VW} {VH}" class="tree" style={maxH ? `max-height:${maxH}px` : ''} role="group" aria-label="Таңдаулар ағашы">
    {#each HEADS as h, d}
      {#if tree.nodes.some(x => x.depth === d + 1 && vis.has(x.id))}<text x={headX(d + 1)} y="14" class="head" text-anchor="middle">{h}</text>{/if}
    {/each}
    {#each tree.nodes as x (x.id)}
      {#if x.parent && vis.has(x.id)}
        {@const p = tree.byId.get(x.parent)!}
        <line x1={pos.get(p.id)!.x} y1={pos.get(p.id)!.y} x2={pos.get(x.id)!.x - (rowsMode && x.depth === 2 ? PW / 2 : 0)} y2={pos.get(x.id)!.y} class="edge" class:dim={struck.has(x.id)} />
      {/if}
    {/each}
    {#each tree.nodes as x (x.id)}
      {#if vis.has(x.id)}
        {@const leaf = x.depth === K}
        {@const closed = !leaf && !open.has(x.id)}
        {@const pill = leaf && rowsMode}
        <g transform="translate({pos.get(x.id)!.x} {pos.get(x.id)!.y})"><g class="nd" class:leaf class:dim={struck.has(x.id)} class:shake={shake === x.id}>
          {#if closed}<circle r={R + 5} class="pulse" />{/if}
          {#if pill}
            <rect x={-PW / 2} y="-13" width={PW} height="26" rx="13" class="pillbg" class:kept={kept.has(x.id)} style={`stroke:${colorOf(x.item)}`} />
            <text class="path pl" class:kept={kept.has(x.id)} class:gone={struck.has(x.id)} y="5" text-anchor="middle">{labelOf(x.id)}</text>
          {:else}
            <circle r={R} class="disc" class:root={x.depth === 0} style={x.depth ? `fill:${colorOf(x.item)}` : ''} />
            <text class="lt" y="5" text-anchor="middle">{x.depth === 0 ? '★' : items[x.item]}</text>
            {#if leaf}
              <text class="path" class:kept={kept.has(x.id)} class:gone={struck.has(x.id)} x={R + 8} y="5">{labelOf(x.id)}</text>
            {/if}
          {/if}
          {#if pill}
            <rect x={-PW / 2 - 2} y="-17" width={PW + 4} height="34" class="hit" role="button" tabindex="0" aria-label={labelOf(x.id)}
              onpointerdown={(e) => { e.preventDefault(); tapLeafNode(x.id); }}
              onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tapLeafNode(x.id); } }} />
          {:else}
            <circle r={Math.max(R + 6, 18)} class="hit" role="button" tabindex="0" aria-label={leaf ? labelOf(x.id) : 'Ашу'}
              onpointerdown={(e) => { e.preventDefault(); leaf ? tapLeafNode(x.id) : openNode(x.id); }}
              onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); leaf ? tapLeafNode(x.id) : openNode(x.id); } }} />
          {/if}
        </g></g>
      {/if}
    {/each}
  </svg>

  <div class="tally num" aria-live="polite">
    {#if mode === 'perm'}
      {#each counts.slice(0, shownLevels) as c, d}{#if d}<span class="op">·</span>{/if}<b class="c{d}">{c}</b>{/each}
      {#if complete}<span class="op">=</span><b class="tot">{total}</b>{:else}<span class="lv">жол: {leavesNow}</span>{/if}
    {:else}
      <span class="lv">жол: {leavesNow}</span>
      {#if strikePhase}<span class="op">→</span><span class="lv">ойын: <b class="tot">{kept.size}</b> / {games}</span>{/if}
    {/if}
  </div>
  <p class="msg" class:ok={finished}>{note || (mode === 'perm' ? 'Түйінді бас: келесі орынға таңдаулар ашылады. Ағашты толтыр.' : 'Түйінді бас: ойыншы таңдалады, оның қарсыластары ашылады.')}</p>
  {#if !complete && manual >= 3 && !finished}<button class="btn small ghost" onclick={revealAll}>Барлығын аш</button>{/if}
  {#if strikePhase && kept.size >= 2 && !finished}<button class="btn small ghost" onclick={restAuto} disabled={auto}>Қалғанын өзі сызсын</button>{/if}
</div>

<style>
  .tb { display: grid; gap: 6px; justify-items: center; }
  .tree { width: 100%; max-width: 360px; height: auto; touch-action: manipulation; }
  .head { font: 800 11px var(--disp); fill: var(--dim); }
  .edge { stroke: var(--line-hi); stroke-width: 2; animation: fade-in .3s ease-out both; }
  .edge.dim { opacity: .25; }
  .nd { animation: fade-in .3s ease-out both; }
  .nd.dim { opacity: .35; }
  .disc { stroke: var(--outline); stroke-width: 2.5; }
  .disc.root { fill: var(--panel-hi); stroke: var(--gold); }
  .lt { font: 800 14px var(--disp); fill: var(--outline); pointer-events: none; }
  .disc.root + .lt { fill: var(--gold); }
  .path { font: 800 13px var(--disp); fill: var(--ink); pointer-events: none; }
  .path.kept { fill: var(--ok); }
  .pillbg { fill: var(--deep); stroke-width: 2.5; }
  .pillbg.kept { fill: #12391f; stroke: var(--ok) !important; }
  .path.gone { text-decoration: line-through; fill: var(--faint); }
  .pulse { fill: none; stroke: var(--gold); stroke-width: 2; stroke-dasharray: 4 3; animation: tbpulse 1.2s ease-in-out infinite; pointer-events: none; }
  .hit { fill: transparent; cursor: pointer; outline: none; }
  .hit:focus-visible { stroke: var(--code); stroke-width: 2; }
  .nd.shake { animation: shake .35s; }
  .nd { transform-box: fill-box; }
  .tally { display: flex; gap: 8px; align-items: baseline; flex-wrap: wrap; justify-content: center; font-size: 24px; font-weight: 800; min-height: 30px; }
  .tally .op { color: var(--dim); }
  .tally .lv { font-size: 15px; color: var(--dim); }
  .tally b.c0 { color: var(--code); } .tally b.c1 { color: var(--gold); } .tally b.c2 { color: var(--glitch); } .tally b.c3 { color: #9d8cff; }
  .tally b.tot { color: var(--ok); }
  .msg { text-align: center; font-weight: 700; max-width: 340px; min-height: 2.6em; font-size: 15px; line-height: 1.25; }
  .msg.ok { color: var(--ok); }
  @keyframes tbpulse { 50% { opacity: .35; } }
  @media (prefers-reduced-motion: reduce) { .pulse { animation: none; } }
</style>
