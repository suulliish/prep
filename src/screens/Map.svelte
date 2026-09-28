<script lang="ts">
  // Карта мира «Жарық»: 12 миров снизу вверх. Портал в следующий мир открывают энергия Кода (изученные и освоенные
  // темы — любые) и побеждённый босс текущего мира. Босс — смешанный бой по всему пройденному.
  import { onMount } from 'svelte';
  import { game, go } from '../lib/store.svelte';
  import { W } from '../lib/world.svelte';
  import { audio } from '../lib/audio';
  import { ensurePlan, dayRec } from '../lib/session.svelte';
  import { planComplete } from '../engine/planner';
  import { isWeekday } from '../engine/dates';
  import { WORLDS, energy, cleared, currentWorld, worldOpen, travel } from '../lib/look';
  import { sparksAt, centerOf } from '../ui/fx.svelte';
  import Bit from '../ui/Bit.svelte';

  const plan = ensurePlan();
  const e = $derived(energy());
  const cur = $derived(currentWorld());
  const curIdx = $derived(WORLDS.findIndex(w => w.id === cur.id));
  const nextLocked = $derived(WORLDS.findIndex((_, i) => !worldOpen(i)));
  const doneCount = $derived(Object.values(game.save.skills).filter(s => ['learned', 'mastered', 'automatic'].includes(s.status)).length);
  const bossReady = $derived(isWeekday(game.day) && planComplete(dayRec(), plan) && doneCount >= 3);
  let listEl: HTMLElement;

  onMount(() => {
    W.dim = true; audio.setMood('map');
    requestAnimationFrame(() => listEl?.querySelector('.cur')?.scrollIntoView({ block: 'center' }));
  });

  function go2(i: number, ev: MouseEvent) {
    if (!worldOpen(i) || WORLDS[i].id === cur.id) return;
    travel(WORLDS[i].id); audio.play('portal'); W.world?.openPortal();
    const c = centerOf(ev.currentTarget as HTMLElement); sparksAt(c.x, c.y, WORLDS[i].isle, 40);
  }
  const bossWhy = $derived(!isWeekday(game.day) ? 'Демалыста шайқас жоқ' : doneCount < 3 ? 'Кемінде 3 тақырып үйрен' : !planComplete(dayRec(), plan) ? 'Алдымен бүгінгі жоспарды орында' : '');
  const hint = $derived(cleared(cur.id)
    ? nextLocked > 0 && nextLocked < WORLDS.length && !WORLDS[nextLocked].arena ? `Келесі порталға Код энергиясы керек: ${e} / ${WORLDS[nextLocked].need}. Әр үйренген тақырып — +1, кристалл — +2.` : 'Бұл әлем тазартылды!'
    : `«${cur.kz}» әлемін Глитч басып алған. Бос жеңілсе — келесі порталға жол ашылады.`);
</script>

<div class="map-wrap">
  <div class="top panel">
    <button class="btn ghost small" onclick={() => go({ name: 'hub' })} aria-label="Артқа">←</button>
    <b class="t">Жарық картасы</b>
    <span class="en num" title="Код энергиясы"><i class="bolt"></i>{e}</span>
  </div>

  <div class="panel talk"><Bit text={hint} mood="idle" compact /></div>

  <ol class="worlds" bind:this={listEl}>
    {#each WORLDS as w, i}
      {@const open = worldOpen(i)}
      {@const isCur = w.id === cur.id}
      {@const fog = !open && i > nextLocked}
      <li class="w" class:cur={isCur} class:open class:fog class:right={i % 2 === 1} style="--a:{w.isle[0]}; --b:{w.isle[1]}">
        <button class="isle" disabled={!open || isCur} onclick={ev => go2(i, ev)} aria-label={fog ? 'Жабық әлем' : w.kz}>
          <span class="rock"><span class="grass"></span></span>
          {#if isCur}<span class="ship" aria-hidden="true"></span>{/if}{#if cleared(w.id)}<span class="flag" aria-hidden="true"></span>{/if}
        </button>
        <div class="info">
          <b>{fog ? '???' : w.kz}</b>
          {#if isCur}<small class="here">Сен осындасың</small>
          {:else if cleared(w.id)}<small class="ok">✓ Босс жеңілді</small>
          {:else if w.arena}<small>Пробниктер — 2027 жылы</small>
          {:else if !open && i === nextLocked}
            <small>{cleared(WORLDS[i - 1].id) ? `Энергия ${e} / ${w.need}` : 'Алдыңғы әлемнің босын жең'}</small>
            <span class="bar"><i style="width:{Math.min(100, (e / w.need) * 100)}%"></i></span>
          {:else if open}<small>Ашық — ұшу үшін бас</small>{/if}
        </div>
        {#if isCur && !cleared(w.id)}
          <button class="btn gold boss" disabled={!bossReady} onclick={() => { audio.unlock(); audio.play('mission'); go({ name: 'session', block: 'boss' }); }}>
            ⚔ Босспен шайқас{#if bossWhy}<small>{bossWhy}</small>{/if}
          </button>
        {/if}
      </li>
    {/each}
  </ol>
</div>

<style>
  .map-wrap { min-height: 100dvh; width: min(760px, 100%); margin: 0 auto; display: flex; flex-direction: column; gap: 10px; padding: calc(env(safe-area-inset-top, 0px) + 12px) 16px 24px; }
  .top { display: flex; align-items: center; gap: 12px; padding: 8px 12px; }
  .btn.small { min-height: 40px; padding: 6px 12px; }
  .t { flex: 1; font-size: 18px; }
  .en { display: flex; align-items: center; gap: 6px; font-size: 20px; color: var(--code); }
  .bolt { width: 14px; height: 18px; background: var(--code); clip-path: polygon(40% 0, 100% 0, 60% 45%, 90% 45%, 20% 100%, 40% 55%, 10% 55%); box-shadow: 0 0 8px var(--code); }
  .talk { padding: 10px 12px; }
  .worlds { list-style: none; margin: 0; padding: 20px 0 40px; display: flex; flex-direction: column-reverse; gap: 6px; position: relative; }
  .worlds::before { content: ''; position: absolute; left: 50%; top: 40px; bottom: 60px; border-left: 4px dotted #4353a888; }
  .w { position: relative; display: grid; grid-template-columns: 1fr 1fr; align-items: center; gap: 12px; min-height: 120px; }
  .w .isle { grid-column: 1; justify-self: end; }
  .w .info { grid-column: 2; }
  .w.right .isle { grid-column: 2; justify-self: start; grid-row: 1; }
  .w.right .info { grid-column: 1; grid-row: 1; text-align: right; }
  .isle { background: none; border: 0; padding: 14px 0 0; cursor: pointer; position: relative; z-index: 1; }
  .isle:disabled { cursor: default; }
  .rock { position: relative; display: block; width: clamp(116px, 14vw, 170px); height: clamp(70px, 8.5vw, 100px); background: linear-gradient(#6d5a4a, #3a2c24); clip-path: polygon(0 22%, 100% 22%, 88% 60%, 64% 100%, 38% 92%, 12% 58%); filter: drop-shadow(0 6px 10px #0008); animation: float 5s ease-in-out infinite; }
  .w:nth-child(2n) .rock { animation-delay: -2.5s; }
  .grass { position: absolute; left: 0; right: 0; top: 0; height: 30%; background: linear-gradient(var(--a), var(--b)); }
  .ship { position: absolute; left: 34px; top: -4px; animation: float 3s ease-in-out infinite; width: 48px; height: 16px; background: linear-gradient(#b07645, #6b3f22); border-radius: 2px 2px 10px 10px; }
  .ship::before { content: ''; position: absolute; left: 20px; top: -22px; width: 4px; height: 22px; background: #3a2a1d; }
  .ship::after { content: ''; position: absolute; left: 24px; top: -20px; width: 16px; height: 14px; background: #f0e6d8; }
  .flag { position: absolute; right: 22px; top: -6px; width: 16px; height: 12px; background: var(--ok); box-shadow: 0 0 10px var(--ok); }
  .flag::before { content: ''; position: absolute; left: -3px; top: 0; width: 3px; height: 26px; background: #ddd; }
  .w.cur .rock { filter: drop-shadow(0 0 18px var(--a)) drop-shadow(0 6px 10px #0008); }
  .w:not(.open) .rock { filter: grayscale(.7) brightness(.75) drop-shadow(0 6px 10px #0008); }
  .w.fog .rock { filter: blur(2px) grayscale(1) brightness(.5); }
  .info { display: grid; gap: 4px; }
  .info b { font-size: 17px; font-weight: 800; }
  .info small { color: var(--dim); font-weight: 700; }
  .w.fog .info b { color: var(--faint); }
  .here { color: var(--gold) !important; }
  .ok { color: var(--ok) !important; }
  .bar { display: block; height: 8px; background: #070a1a; border: 1px solid var(--line-hi); width: min(160px, 100%); }
  .w.right .bar { justify-self: end; }
  .bar i { display: block; height: 100%; background: var(--code); box-shadow: 0 0 8px var(--code); }
  .boss { grid-column: 1 / -1; justify-self: center; display: grid; gap: 2px; margin-top: 4px; }
  .boss small { font-size: 12px; font-weight: 700; opacity: .85; }
  @keyframes float { 50% { transform: translateY(-6px); } }
</style>
