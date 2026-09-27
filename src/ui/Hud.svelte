<script lang="ts">
  import { game, levelOf } from '../lib/store.svelte';
  import { blankDay } from '../engine/planner';
  const lv = $derived(levelOf(game.save.xp));
  const day = $derived(game.save.days[game.day] ?? blankDay(game.day));
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
    <div class="stat panel" title="Кристалдар — меңгерілген тақырыптар"><span class="ico crystal"></span><span class="num">{crystals}</span></div>
    <div class="stat panel gold" title="Бүгін ойын уақыты"><span class="ico clock"></span><span class="num">{day.minutesToday}</span><small>мин</small></div>
  </div>
</header>

<style>
  .hud { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; padding: calc(env(safe-area-inset-top, 0px) + 12px) 16px 0; pointer-events: none; }
  .hud > * { pointer-events: auto; }
  .hero { display: flex; gap: 10px; align-items: center; padding: 8px 14px 8px 8px; min-width: 0; width: min(280px, 55vw); }
  .lvl { flex: none; width: 40px; height: 40px; display: grid; place-items: center; font-family: var(--px); font-weight: 400; font-size: 20px; background: var(--code); color: var(--void); clip-path: polygon(20% 0, 80% 0, 100% 50%, 80% 100%, 20% 100%, 0 50%); }
  .meta { flex: 1; min-width: 0; display: grid; gap: 6px; }
  .name { font-weight: 800; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .bar { height: 10px; background: #070a1a; border: 2px solid var(--line); }
  .bar i { display: block; height: 100%; background: linear-gradient(90deg, var(--code), #b9fdff); transition: width .6s var(--ease-out); }
  .stats { display: flex; gap: 8px; }
  .stat { display: flex; align-items: center; gap: 6px; padding: 8px 12px; font-size: 20px; }
  .stat small { font-size: var(--fs-xs); color: var(--dim); }
  .stat.gold .num { color: var(--gold); }
  .ico { width: 14px; height: 14px; display: inline-block; }
  .crystal { background: var(--crystal); clip-path: polygon(50% 0, 100% 40%, 50% 100%, 0 40%); box-shadow: 0 0 10px var(--crystal); }
  .clock { border: 3px solid var(--gold); border-radius: 50%; }
</style>
