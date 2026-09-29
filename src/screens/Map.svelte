<script lang="ts">
  // 3D-карта миров «Жарық» (src/three/map.ts). Острова идут по маршруту, корабль с героем стоит у текущего мира.
  // Палец двигает карту вдоль маршрута, касание острова — карточка мира снизу. Портал в следующий мир открывают
  // энергия Кода (изученные и освоенные темы) и побеждённый босс текущего мира.
  import { onMount, onDestroy } from 'svelte';
  import { game, go } from '../lib/store.svelte';
  import { W } from '../lib/world.svelte';
  import { audio } from '../lib/audio';
  import { ensurePlan, dayRec } from '../lib/session.svelte';
  import { planComplete } from '../engine/planner';
  import { isWeekday } from '../engine/dates';
  import { WORLDS, energy, cleared, currentWorld, worldOpen, travel } from '../lib/look';
  import type { IsleState, MapLabel } from '../three/map';
  import Icon from '../ui/Icon.svelte';
  import { toast } from '../ui/notify.svelte';

  const plan = ensurePlan();
  const e = $derived(energy());
  const cur = $derived(currentWorld());
  const curIdx = $derived(WORLDS.findIndex(w => w.id === cur.id));
  const nextLocked = $derived(WORLDS.findIndex((_, i) => !worldOpen(i)));
  const doneCount = $derived(Object.values(game.save.skills).filter(s => ['learned', 'mastered', 'automatic'].includes(s.status)).length);
  const bossReady = $derived(isWeekday(game.day) && planComplete(dayRec(), plan) && doneCount >= 3);
  const bossWhy = $derived(!isWeekday(game.day) ? 'Демалыс күні шайқас жоқ' : doneCount < 3 ? 'Алдымен кемінде 3 тақырып үйрен' : !planComplete(dayRec(), plan) ? 'Алдымен бүгінгі жоспарды орында' : '');

  let sel = $state(0);
  let flying = $state(false);
  let labels = $state<MapLabel[]>([]);
  let raf = 0;

  function stateOf(i: number): IsleState {
    const w = WORLDS[i];
    if (w.id === cur.id) return 'current';
    if (cleared(w.id)) return 'cleared';
    if (worldOpen(i)) return 'open';
    if (i === nextLocked) return 'next';
    return i === nextLocked + 1 ? 'locked' : 'fog';
  }
  const known = (i: number) => stateOf(i) !== 'fog';

  function build() {
    W.world?.mapSetup(WORLDS.map((w, i) => ({ id: w.id, a: w.isle[0], b: w.isle[1], state: stateOf(i) })), curIdx);
  }

  onMount(() => {
    W.dim = false; audio.setMood('map');
    sel = curIdx;
    W.world?.setMode('map'); build();
    W.world?.onMapPick(i => { sel = i; audio.play('click'); });
    let lastFocus = curIdx;
    const tick = () => {
      labels = W.world?.mapLabels() ?? [];
      const f = W.world?.mapFocused() ?? lastFocus;   // пролистали пальцем — карточка следует за картой
      if (f !== lastFocus && !flying) { lastFocus = f; sel = f; }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  });
  onDestroy(() => { cancelAnimationFrame(raf); W.world?.onMapPick(() => {}); W.world?.setMode('hub'); });

  function pick(i: number) { sel = Math.max(0, Math.min(WORLDS.length - 1, i)); W.world?.mapFocus(sel); audio.play('click'); }

  async function flyTo(i: number) {
    if (flying || !worldOpen(i) || i === curIdx) return;
    flying = true; audio.play('portal');
    await W.world?.mapTravel(i);
    travel(WORLDS[i].id); build(); flying = false; audio.play('levelup');
  }

  const w = $derived(WORLDS[sel]);
  const st = $derived(stateOf(sel));
  const need = $derived(WORLDS[sel]?.need ?? 0);
  const STATUS: Record<IsleState, string> = {
    current: 'Сен осындасың', cleared: 'Бас жау жеңілді', open: 'Ашық әлем', next: 'Келесі мақсат', locked: 'Жабық', fog: 'Тұманда',
  };
</script>

<div class="map-screen">
  <header class="top panel">
    <button class="ibtn" onclick={() => go({ name: 'hub' })} aria-label="Кемеге қайту"><Icon name="back" fill="#fff" /></button>
    <div class="ttl"><b>Жарық картасы</b><small>{curIdx + 1}-әлем · {WORLDS.length} әлемнің</small></div>
    <span class="pill" title="Код қуаты — әр үйренген тақырып +1, кристалл +2"><Icon name="bolt" fill="var(--code)" size={22} /><span class="num">{e}</span><small>қуат</small></span>
  </header>

  <!-- подписи над островами (не перехватывают касания, кроме самой подписи) -->
  <div class="tags" aria-hidden="true">
    {#each labels as l}
      {#if l.on && l.y > 0.13 && l.y < 0.7}
        {@const s = stateOf(l.i)}
        <button class="tag {s}" class:sel={l.i === sel} style="left:{Math.min(90, Math.max(10, l.x * 100))}%; top:{l.y * 100}%" tabindex="-1" onclick={() => pick(l.i)}>
          {#if s === 'cleared'}<i class="ok">✓</i>{:else if s === 'locked' || s === 'fog' || s === 'next'}<i class="lock"></i>{/if}
          {known(l.i) ? WORLDS[l.i].kz : '???'}
        </button>
      {/if}
    {/each}
  </div>

  <section class="sheet panel" aria-live="polite">
    <div class="nav">
      <button class="ibtn" onclick={() => pick(sel - 1)} disabled={sel === 0} aria-label="Алдыңғы әлем"><Icon name="back" fill="#fff" size={20} /></button>
      <div class="head" style="--a:{w.isle[0]}">
        <small class="status {st}">{STATUS[st]}</small>
        <h2>{known(sel) ? w.kz : 'Белгісіз әлем'}</h2>
      </div>
      <button class="ibtn" onclick={() => pick(sel + 1)} disabled={sel === WORLDS.length - 1} aria-label="Келесі әлем"><Icon name="chevron" fill="#fff" size={20} /></button>
    </div>

    {#if st === 'current'}
      {#if cleared(w.id)}
        <p class="note">Бұл әлем тазартылды. {nextLocked > 0 && nextLocked < WORLDS.length && !WORLDS[nextLocked].arena ? `Келесі әлемге қуат керек: ${e} / ${WORLDS[nextLocked].need}.` : ''}</p>
      {:else}
        <p class="note">Бұл әлемді Глитч басып алған. Бас жауды жеңсең — келесі әлемге жол ашылады.</p>
        <button class="btn gold big block" class:locked={!bossReady} aria-disabled={!bossReady} onclick={() => { if (!bossReady) { audio.play('click'); toast(bossWhy); return; } audio.unlock(); audio.play('mission'); go({ name: 'session', block: 'boss' }); }}><Icon name={bossReady ? 'sword' : 'lock'} fill={bossReady ? 'var(--outline)' : '#d7dcf5'} size={22} />Бас жаумен шайқас</button>
        {#if bossWhy}<p class="why">{bossWhy}</p>{/if}
      {/if}
    {:else if st === 'cleared' || st === 'open'}
      <p class="note">{st === 'cleared' ? 'Бұл әлемнің бас жауы жеңілген. Қайта барып, көріністі тамашалауға болады.' : 'Әлем ашық — кемемен ұшып бар.'}</p>
      <button class="btn primary big block" disabled={flying} onclick={() => flyTo(sel)}>{flying ? 'Ұшып барамыз…' : 'Осында ұшу'}</button>
    {:else if w.arena}
      <p class="note">Арена — нағыз пробниктер. 2027 жылдың күзінде ашылады.</p>
    {:else if st === 'next'}
      {#if !cleared(WORLDS[sel - 1].id)}
        <p class="note">Алдымен «{WORLDS[sel - 1].kz}» әлемінің бас жауын жең.</p>
      {:else}
        <p class="note">Порталға Код қуаты керек. Әр үйренген тақырып +1, кристалл +2.</p>
      {/if}
      <div class="meter"><span class="bar"><i style="width:{Math.min(100, (e / need) * 100)}%"></i></span><b class="num">{e} / {need}</b></div>
    {:else}
      <p class="note">Бұл әлем әлі тұманда. Алдыңғы әлемдерді аш — жол көрінеді.</p>
    {/if}
  </section>
</div>

<style>
  /* Экран не прокручивается: двигается сама 3D-карта. Касания проходят к канвасу везде, кроме панелей. */
  .map-screen { position: fixed; inset: 0; display: flex; flex-direction: column; justify-content: space-between; padding: calc(env(safe-area-inset-top, 0px) + 10px) 12px calc(env(safe-area-inset-bottom, 0px) + 12px); pointer-events: none; }
  .top { display: flex; align-items: center; gap: 12px; padding: 8px 12px; width: min(760px, 100%); margin: 0 auto; }
  .btn.small { min-height: 44px; min-width: 44px; padding: 6px 12px; font-size: 20px; }
  .ttl { flex: 1; display: grid; line-height: 1.15; }
  .ttl b { font: 900 19px var(--disp); text-shadow: 0 2px 0 var(--outline); }
  .ttl small { color: var(--dim); font-size: 12px; font-weight: 700; }
  .en { display: flex; align-items: center; gap: 6px; font-size: 20px; color: var(--code); }
  .bolt { width: 14px; height: 18px; background: var(--code); clip-path: polygon(40% 0, 100% 0, 60% 45%, 90% 45%, 20% 100%, 40% 55%, 10% 55%); box-shadow: 0 0 8px var(--code); }

  .tags { position: fixed; inset: 0; pointer-events: none; overflow: hidden; }
  .tag { position: absolute; text-transform: none; letter-spacing: 0; transform: translate(-50%, -100%); pointer-events: auto; display: inline-flex; align-items: center; gap: 6px; white-space: nowrap;
    font: 800 13px var(--disp); color: var(--ink); background: #0b1030dd; border: 2.5px solid var(--outline); border-radius: 999px; padding: 5px 11px; cursor: pointer;
    backdrop-filter: blur(4px); transition: transform .2s var(--ease-out), border-color .2s; }
  .tag.current { border-color: var(--code); color: var(--code); box-shadow: 0 0 14px #3ff0ff55; }
  .tag.cleared { border-color: var(--ok); }
  .tag.next { border-color: var(--gold); color: var(--gold); }
  .tag.locked, .tag.fog { color: var(--faint); border-color: var(--line); }
  .tag.sel { transform: translate(-50%, -100%) scale(1.12); }
  .tag .ok { color: var(--ok); font-style: normal; }
  .tag .lock { width: 9px; height: 10px; border-radius: 2px; background: currentColor; position: relative; }
  .tag .lock::before { content: ''; position: absolute; left: 1.5px; top: -5px; width: 6px; height: 6px; border: 1.5px solid currentColor; border-bottom: 0; border-radius: 4px 4px 0 0; box-sizing: border-box; }

  .sheet { width: min(560px, 100%); margin: 0 auto; display: grid; gap: 10px; padding: 12px 14px 14px; position: relative; z-index: 2; }
  .nav { display: flex; align-items: center; gap: 10px; }
  .head { flex: 1; text-align: center; display: grid; gap: 2px; }
  .head h2 { font-size: 22px; }
  .ibtn:disabled { opacity: .4; }
  .status { font: 800 11px var(--txt); letter-spacing: .12em; text-transform: uppercase; color: var(--dim); }
  .status.current { color: var(--code); } .status.cleared { color: var(--ok); } .status.next { color: var(--gold); }
  .note { color: var(--dim); font-size: var(--fs-s); font-weight: 700; text-align: center; }
  .why { color: var(--gold); font-size: 15px; font-weight: 800; text-align: center; margin-top: -4px; }
  .block { width: 100%; }
  .meter { display: flex; align-items: center; gap: 10px; }
  .bar { flex: 1; display: block; height: 10px; background: #070a1a; border: 1px solid var(--line-hi); border-radius: 999px; overflow: hidden; }
  .bar i { display: block; height: 100%; background: linear-gradient(90deg, var(--code), #b9fdff); box-shadow: 0 0 8px var(--code); }
  .meter b { color: var(--code); font-size: 16px; }
</style>
