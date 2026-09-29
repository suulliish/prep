<script lang="ts">
  // «Көпір»: қордағы бөліктерді басып, көпірді дәл target ұзындығына толтыр. Артық болса — көпір шайқалады, бөлік кері секіреді.
  import { audio } from '../lib/audio';
  import Frac from '../ui/Frac.svelte';
  import MathLine from '../lesson/MathLine.svelte';
  import { sum, cmp, val, toMixed, denColor, type Fr } from './fracdraw';

  let { pieces, target = { n: 1, d: 1 }, ondone }: { pieces: Fr[]; target?: Fr; ondone?: () => void } = $props();

  let placed = $state<number[]>([]);
  let over = $state<number | null>(null);
  let wobble = $state(false);
  let finished = $state(false);
  let msg = $state('');

  const total = $derived(sum(placed.map(i => pieces[i])));
  const tval = val(target);
  const str = (f: Fr) => { const r = toMixed(f); return r.n === 0 ? String(r.whole) : r.whole ? `${r.whole} ${r.n}/${r.d}` : `${r.n}/${r.d}`; };
  const expr = $derived(placed.length ? `${placed.map(i => `${pieces[i].n}/${pieces[i].d}`).join(' + ')} = ${str(total)}` : '0');
  // положение уже уложенных кусков (в долях длины моста)
  const offs = $derived.by(() => { let x = 0; return placed.map(i => { const a = x; x += val(pieces[i]) / tval; return a; }); });
  const overAt = $derived(placed.length ? offs.at(-1)! + val(pieces[placed.at(-1)!]) / tval : 0);

  function put(i: number) {
    if (finished || over !== null || placed.includes(i)) return;
    const s = sum([...placed.map(k => pieces[k]), pieces[i]]);
    const c = cmp(s, target);
    if (c > 0) {
      over = i; wobble = true; msg = 'Көпір бұзылады! Бұл бөлік артық.'; audio.play('wrong');
      setTimeout(() => { wobble = false; over = null; audio.play('click'); }, 650);
      return;
    }
    placed = [...placed, i]; msg = ''; audio.play('click');
    if (c === 0) { finished = true; msg = 'Көпір дайын! Дәл сыйды.'; audio.play('correct'); setTimeout(() => ondone?.(), 600); }
  }
  function take(k: number) { if (finished || over !== null) return; placed = placed.filter((_, j) => j !== k); msg = ''; audio.play('click'); }
  function reset() { if (finished || over !== null) return; placed = []; msg = ''; audio.play('click'); }
  const w = (f: Fr) => (val(f) / tval) * 100;
</script>

{#snippet tg()}{#if target.d === 1}<b class="num tn">{target.n}</b>{:else}<Frac n={target.n} d={target.d} size="md" color="var(--gold)" />{/if}{/snippet}

<div class="fo">
  <p class="task">Көпір ұзындығы: <span class="tgt">{@render tg()}</span>. Бөліктерді басып, көпірді дәл толтыр.</p>

  <div class="cliffs">
    <i class="cliff l"></i>
    <div class="bridge" class:wobble class:done={finished}>
      <div class="deck"></div>
      {#each placed as i, k (i)}
        <button class="pc" style="left:{offs[k] * 100}%;width:{w(pieces[i])}%;--c:{denColor(pieces[i].d)}" onclick={() => take(k)} disabled={finished} aria-label="Алып тастау: {pieces[i].n}/{pieces[i].d}">
          <Frac n={pieces[i].n} d={pieces[i].d} size={w(pieces[i]) < 10 ? 11 : 16} color="var(--outline)" />
        </button>
      {/each}
      {#if over !== null}
        <span class="pc over" style="left:{overAt * 100}%;width:{w(pieces[over])}%;--c:{denColor(pieces[over].d)}"><Frac n={pieces[over].n} d={pieces[over].d} size={w(pieces[over]) < 10 ? 11 : 16} color="var(--outline)" /></span>
      {/if}
    </div>
    <i class="cliff r"></i>
  </div>

  <div class="sum panel flat"><MathLine text={expr} /><span class="of num">/</span>{@render tg()}</div>

  <div class="supply">
    {#each pieces as p, i}
      <button class="sp" class:used={placed.includes(i)} style="--c:{denColor(p.d)};width:max(56px, {Math.min(100, w(p))}%)" onclick={() => put(i)} disabled={finished || placed.includes(i)} aria-label="{p.n}/{p.d}">
        <Frac n={p.n} d={p.d} size={20} color="var(--outline)" />
      </button>
    {/each}
  </div>

  <p class="msg" class:ok={finished}>{msg || 'Бөлікті бас — ол көпірге түседі. Артық болса, бөлік кері секіреді.'}</p>
  <button class="btn small ghost" onclick={reset} disabled={finished || !placed.length}>Қайта бастау</button>
</div>

<style>
  .fo { display: grid; gap: 12px; justify-items: center; }
  .task { text-align: center; font-weight: 800; }
  .tgt { display: inline-block; vertical-align: middle; }
  .cliffs { display: grid; grid-template-columns: 14px 1fr 14px; align-items: end; width: 100%; padding-top: 12px; }
  .cliff { display: block; height: 92px; background: linear-gradient(#5b6699, #3d4670); border: 3px solid var(--outline); }
  .cliff.l { border-radius: 10px 0 0 0; border-right: 0; }
  .cliff.r { border-radius: 0 10px 0 0; border-left: 0; }
  .bridge { position: relative; height: 62px; margin-bottom: 0; }
  .deck { position: absolute; inset: 0; border: 3px dashed var(--line-hi); border-radius: 6px; background: #0b103055; }
  .done .deck { border-color: var(--ok); border-style: solid; box-shadow: 0 0 18px #3ddc6e88; }
  .bridge.wobble { animation: wob .6s; transform-origin: 50% 100%; }
  @keyframes wob { 0%, 100% { transform: none; } 15% { transform: rotate(-3deg) translateY(4px); } 35% { transform: rotate(3deg) translateY(2px); } 55% { transform: rotate(-2deg); } 75% { transform: rotate(1.5deg); } }
  .pc { position: absolute; top: 0; height: 100%; display: grid; place-items: center; padding: 0; min-width: 0; overflow: hidden; cursor: pointer;
    background: var(--c); border: 3px solid var(--outline); border-radius: 6px; box-shadow: inset 0 -5px 0 #00000030; animation: land .38s var(--ease-out) both; }
  .pc:disabled { cursor: default; }
  .pc.over { animation: over .65s forwards; z-index: 2; cursor: default; overflow: visible; background: var(--miss); }
  @keyframes land { from { opacity: 0; transform: translateY(-40px); } to { opacity: 1; transform: none; } }
  @keyframes over { 0% { opacity: 1; transform: translateY(-6px); } 40% { opacity: 1; transform: translateY(6px) rotate(6deg); } 100% { opacity: 0; transform: translateY(70px) rotate(20deg); } }
  .sum { display: flex; align-items: center; justify-content: center; gap: 8px; flex-wrap: wrap; padding: 8px 14px; width: 100%; color: var(--ink); text-align: center; }
  .tn { color: var(--gold); font-size: 22px; }
  .of { color: var(--dim); font-size: 22px; }
  .supply { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; width: 100%; }
  .sp { min-height: 56px; display: grid; place-items: center; padding: 4px 6px; cursor: pointer;
    background: var(--c); border: 3px solid var(--outline); border-radius: 10px; box-shadow: inset 0 -5px 0 #00000030, 0 3px 0 var(--outline); transition: transform .08s, opacity .2s; }
  .sp:active:not(:disabled) { transform: translateY(2px); }
  .sp.used { opacity: .18; box-shadow: none; cursor: default; }
  .msg { text-align: center; font-weight: 800; min-height: 2.6em; max-width: 340px; }
  .msg.ok { color: var(--ok); }
</style>
