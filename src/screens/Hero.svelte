<script lang="ts">
  // Кейіпкер: уровень и характеристики из реального прогресса (GAME_DESIGN 4 — кликами не вкачать),
  // путь наград: костюмы открываются кристаллами (освоенными темами). Выбор костюма — автономия.
  import { onMount } from 'svelte';
  import { game, go, levelOf, skillDefs } from '../lib/store.svelte';
  import { W } from '../lib/world.svelte';
  import { audio } from '../lib/audio';
  import { streak } from '../engine/streak';
  import { OUTFITS, crystals, wearOutfit } from '../lib/look';
  import { sparksAt, centerOf } from '../ui/fx.svelte';

  onMount(() => { W.dim = false; W.world?.setMode('hub'); audio.setMood('hub'); });

  const lv = $derived(levelOf(game.save.xp));
  const cr = $derived(crystals());
  const cat = (id: string) => skillDefs.find(d => d.id === id)?.cat ?? '';
  const LOGIC = ['H', 'I', 'J'];
  const power = $derived(Object.entries(game.save.skills).filter(([id, s]) => ['mastered', 'automatic'].includes(s.status) && !LOGIC.includes(cat(id))).length);
  const mind = $derived(Object.entries(game.save.skills).filter(([id, s]) => ['learned', 'mastered', 'automatic'].includes(s.status) && LOGIC.includes(cat(id))).length);
  const acc = $derived.by(() => {
    const from = Date.parse(game.day) - 14 * 864e5;
    const a = game.save.attempts.filter(x => x.honest && x.hintLevel === 0 && Date.parse(x.day) >= from);
    return a.length >= 10 ? Math.round((a.filter(x => x.correct).length / a.length) * 100) : null;
  });
  const st = $derived(streak(game.save, game.day));
  const rank = (v: number, steps: number[]) => { const n = steps.find(s => s > v) ?? steps.at(-1)!; return { next: n, pct: Math.min(100, (v / n) * 100) }; };

  const STATS = $derived([
    { id: 'power', kz: 'Күш', what: 'меңгерілген математика тақырыптары', v: power, ...rank(power, [3, 10, 25, 50, 90]) },
    { id: 'mind', kz: 'Ақыл', what: 'логика тақырыптары', v: mind, ...rank(mind, [2, 5, 10, 20, 30]) },
    { id: 'aim', kz: 'Дәлдік', what: 'кеңессіз дұрыс жауап, 2 апта', v: acc === null ? '—' : acc + '%', pct: acc ?? 0, next: acc === null ? 'кемінде 10 есеп' : '' },
    { id: 'guard', kz: 'Табандылық', what: 'оқу күндерінің сериясы', v: st.days, ...rank(st.days, [5, 10, 20, 40, 80]) },
    { id: 'speed', kz: 'Жылдамдық', what: 'емтихан режимінде ашылады (2028)', v: '🔒', pct: 0, next: '' },
  ]);
  function wear(id: string, ev: MouseEvent) { wearOutfit(id); audio.play('levelup'); W.world?.celebrate(OUTFITS.find(o => o.id === id)!.jacket); const c = centerOf(ev.currentTarget as HTMLElement); sparksAt(c.x, c.y, ['#ffc94a', '#3ff0ff'], 30); }
  const hex = (n: number) => '#' + n.toString(16).padStart(6, '0');
</script>

<div class="wrap side-dock">
  <div class="top panel">
    <button class="btn ghost small" onclick={() => go({ name: 'hub' })} aria-label="Артқа">←</button>
    <div class="lvl num">{lv.lvl}</div>
    <div class="nm"><b>{game.save.heroName}</b><span class="bar"><i style="width:{(lv.into / lv.need) * 100}%"></i></span><small class="num">{lv.into} / {lv.need} XP</small></div>
  </div>
  <div class="spacer passthrough"></div>

  <section class="panel card">
    <h2>Қасиеттер</h2>
    <p class="note">Тек оқу арқылы өседі — басқа жолы жоқ.</p>
    <ul class="stats">
      {#each STATS as s}
        <li class="st {s.id}">
          <i class="ic"></i>
          <div class="sb"><b>{s.kz}</b><small>{s.what}</small><span class="bar"><i style="width:{s.pct}%"></i></span></div>
          <span class="v num">{s.v}{#if s.next && typeof s.next === 'number'}<small>/{s.next}</small>{/if}</span>
        </li>
      {/each}
    </ul>
  </section>

  <section class="panel card">
    <h2>Марапат жолы <small class="num">◆ {cr}</small></h2>
    <p class="note">Әр кристалл (тексеруден өткен тақырып) жаңа костюмге жақындатады.</p>
    <div class="road">
      {#each OUTFITS as o}
        {@const got = cr >= o.need}
        {@const on = (game.save.outfit ?? 'cyan') === o.id}
        <button class="ms" class:got class:on disabled={!got || on} onclick={ev => wear(o.id, ev)} style="--j:{hex(o.jacket)}; --v:{hex(o.visor)}">
          <span class="suit"><i></i></span>
          <b>{o.kz}</b>
          <small>{on ? 'Киіліп тұр' : got ? 'Кию' : `◆ ${o.need}`}</small>
        </button>
      {/each}
    </div>
  </section>
</div>

<style>
  .wrap { min-height: 100dvh; width: min(640px, 100%); margin: 0 auto; display: flex; flex-direction: column; gap: 10px; padding: calc(env(safe-area-inset-top, 0px) + 12px) 16px calc(env(safe-area-inset-bottom, 0px) + 16px); }
  .spacer { flex: 0 0 clamp(120px, 26vh, 260px); }
  .top { display: flex; align-items: center; gap: 12px; padding: 8px 12px; }
  .btn.small { min-height: 40px; padding: 6px 12px; }
  .lvl { flex: none; width: 44px; height: 44px; display: grid; place-items: center; font-family: var(--px); font-size: 20px; background: var(--code); color: var(--void); clip-path: polygon(20% 0, 80% 0, 100% 50%, 80% 100%, 20% 100%, 0 50%); }
  .nm { flex: 1; display: grid; gap: 4px; }
  .nm b { font-size: 18px; }
  .nm small { color: var(--dim); font-size: 12px; }
  .bar { display: block; height: 8px; background: #070a1a; border: 1px solid var(--line); }
  .bar i { display: block; height: 100%; background: linear-gradient(90deg, var(--code), #b9fdff); transition: width .6s var(--ease-out); }
  .card { display: grid; gap: 10px; padding: 16px; }
  h2 { font-size: 18px; } h2 small { color: var(--crystal); }
  .note { color: var(--dim); font-size: var(--fs-s); font-weight: 700; }
  .stats { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; }
  .st { display: flex; align-items: center; gap: 12px; }
  .sb { flex: 1; display: grid; gap: 3px; }
  .sb small { color: var(--dim); font-size: 12px; }
  .v { font-size: 22px; min-width: 56px; text-align: right; }
  .v small { font-size: 12px; color: var(--dim); }
  .ic { flex: none; width: 34px; height: 34px; border-radius: 8px; background: var(--c); box-shadow: 0 0 12px var(--c); }
  .power { --c: #ff6a3d; } .mind { --c: var(--crystal); } .aim { --c: var(--ok); } .guard { --c: var(--gold); } .speed { --c: #4353a8; }
  .st .bar i { background: var(--c); }
  .power .ic { clip-path: polygon(45% 0, 55% 0, 55% 60%, 75% 60%, 75% 70%, 55% 70%, 55% 100%, 45% 100%, 45% 70%, 25% 70%, 25% 60%, 45% 60%); }
  .mind .ic { border-radius: 50% 50% 40% 40%; }
  .aim .ic { border-radius: 50%; background: radial-gradient(circle, var(--c) 20%, transparent 22% 42%, var(--c) 44% 60%, transparent 62%); }
  .guard .ic { clip-path: polygon(50% 0, 100% 15%, 90% 65%, 50% 100%, 10% 65%, 0 15%); }
  .speed .ic { clip-path: polygon(40% 0, 100% 0, 60% 45%, 90% 45%, 20% 100%, 40% 55%, 10% 55%); }
  .road { display: grid; grid-template-columns: repeat(auto-fill, minmax(96px, 1fr)); gap: 8px; }
  .ms { display: grid; justify-items: center; gap: 4px; padding: 10px 6px; font: inherit; color: var(--ink); background: var(--deep); border: 2px solid var(--line); border-radius: 10px; cursor: pointer; opacity: .55; }
  .ms.got { opacity: 1; border-color: var(--line-hi); }
  .ms.on { border-color: var(--gold); box-shadow: 0 0 16px #ffc94a55; }
  .ms:disabled { cursor: default; }
  .ms small { color: var(--dim); font-size: 12px; font-weight: 700; }
  .ms.on small { color: var(--gold); }
  .suit { width: 40px; height: 44px; background: var(--j); border-radius: 8px 8px 4px 4px; display: grid; place-items: start center; padding-top: 6px; }
  .suit i { width: 28px; height: 6px; background: var(--v); box-shadow: 0 0 8px var(--v); }
  .ms:not(.got) .suit { filter: grayscale(1) brightness(.5); }
</style>
