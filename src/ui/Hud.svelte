<script lang="ts">
  import { game, levelOf, go } from '../lib/store.svelte';
  import { audio } from '../lib/audio';
  import { blankDay } from '../engine/planner';
  import { streak } from '../engine/streak';
  const lv = $derived(levelOf(game.save.xp));
  const day = $derived(game.save.days[game.day] ?? blankDay(game.day));
  const st = $derived(streak(game.save, game.day));
  // звук — одна кнопка вместо отдельного экрана; тонкие настройки — у командира
  let muted = $state(audio.settings.master === 0);
  function toggleSound() { audio.unlock(); muted = !muted; audio.save({ master: muted ? 0 : 0.8 }); if (!muted) audio.play('click'); }
  const crystals = $derived(Object.values(game.save.skills).filter(s => s.status === 'mastered' || s.status === 'automatic').length);
</script>

<header class="hud">
  <div class="hero panel">
    <div class="lvl num">{lv.lvl}</div>
    <div class="meta">
      <div class="name">{game.save.heroName}</div>
      <div class="bar" aria-label="Тәжірибе"><i style="width:{(lv.into / lv.need) * 100}%"></i></div>
    </div>
  </div>
  <div class="stats">
    <div class="stat panel" title="Күн сериясы"><span class="ico fire"></span><span class="num">{st.days}</span></div>
    <div class="stat panel" title="Кристалдар — меңгерілген тақырыптар"><span class="ico crystal"></span><span class="num">{crystals}</span></div>
    <div class="stat panel gold" title="Бүгін ойын уақыты"><span class="ico clock"></span><span class="num">{day.minutesToday}</span><small>мин</small></div>
    <div class="tools">
      <button class="tb" onclick={toggleSound} aria-label={muted ? 'Дыбысты қосу' : 'Дыбысты өшіру'} title={muted ? 'Дыбысты қосу' : 'Дыбысты өшіру'}><i class="spk" class:off={muted}></i></button>
      <button class="tb" onclick={() => go({ name: 'commander' })} aria-label="Командир (ата-ана)" title="Командир"><i class="gear"></i></button>
    </div>
  </div>
</header>

<style>
  .hud { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; padding: calc(env(safe-area-inset-top, 0px) + 12px) 16px 0; pointer-events: none; }
  .hud > * { pointer-events: auto; }
  .hero { display: flex; gap: 10px; align-items: center; padding: 8px 14px 8px 8px; min-width: 0; width: min(280px, 44vw); }
  .lvl { flex: none; width: 40px; height: 40px; display: grid; place-items: center; font-family: var(--px); font-weight: 400; font-size: 20px; background: var(--code); color: var(--void); clip-path: polygon(20% 0, 80% 0, 100% 50%, 80% 100%, 20% 100%, 0 50%); }
  .meta { flex: 1; min-width: 0; display: grid; gap: 6px; }
  .name { font-weight: 800; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .bar { height: 10px; background: #070a1a; border: 2px solid var(--line); }
  .bar i { display: block; height: 100%; background: linear-gradient(90deg, var(--code), #b9fdff); transition: width .6s var(--ease-out); }
  .stats { display: flex; gap: 6px; }
  .stat { display: flex; align-items: center; gap: 5px; padding: 8px 9px; font-size: 18px; }
  .stat small { font-size: var(--fs-xs); color: var(--dim); }
  .stat.gold .num { color: var(--gold); }
  .ico { width: 14px; height: 14px; display: inline-block; }
  .crystal { background: var(--crystal); clip-path: polygon(50% 0, 100% 40%, 50% 100%, 0 40%); box-shadow: 0 0 10px var(--crystal); }
  .clock { border: 3px solid var(--gold); border-radius: 50%; }
  .fire { background: linear-gradient(#ffc94a, #ff6a3d); clip-path: polygon(50% 0, 80% 35%, 100% 70%, 50% 100%, 0 70%, 20% 35%, 40% 50%); }
  .tools { display: grid; gap: 4px; }
  .tb { width: 30px; height: 30px; display: grid; place-items: center; background: #141b3fcc; border: 1px solid var(--line); border-radius: 6px; cursor: pointer; padding: 0; }
  .spk { width: 16px; height: 14px; background: var(--dim); clip-path: polygon(0 30%, 35% 30%, 75% 0, 75% 100%, 35% 70%, 0 70%); }
  .spk.off { background: var(--miss); opacity: .7; }
  .gear { width: 16px; height: 16px; border-radius: 50%; border: 4px dotted var(--faint); }
  @media (max-width: 440px) { .hero { width: auto; flex: 1; } .stats { gap: 4px; } .stat { padding: 6px 7px; font-size: 16px; } .stat small { display: none; } }
</style>
