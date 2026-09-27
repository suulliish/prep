<script lang="ts">
  // Альбом карточек тем по категориям + мастерская ремонта ошибок.
  import { onMount } from 'svelte';
  import { game, go, skillDefs } from '../lib/store.svelte';
  import { W } from '../lib/world.svelte';
  import { audio } from '../lib/audio';
  // @ts-ignore
  import { LESSONS } from '../../content/lessons.mjs';

  const CAT: Record<string, string> = { A: 'Теңдеулер', B: 'Мәтінді есептер', C: 'Есептеу', D: 'Бөлінгіштік', E: 'Геометрия', F: 'Пропорция', G: 'Пайыз', H: 'Заңдылық', I: 'Логика', J: 'Көрнекі логика', K: 'Координаталар' };
  const CC: Record<string, string> = { A: '#3ff0ff', B: '#ffc94a', C: '#5ce39c', D: '#b58cff', E: '#ff9a6b', F: '#6ab8ff', G: '#ff4fb8', H: '#e6ff5c', I: '#c0c8ff', J: '#ff7de0', K: '#7dffd4' };
  let tab = $state<'cards' | 'repair'>('cards');
  // Шпаргалка «Есте сақта» открывается после пройденного урока
  const ruleOf = (id: string) => (game.save.skills[id]?.lessonDone ? (LESSONS as Record<string, any[]>)[id]?.find(s => s.type === 'rule') : undefined);
  let openRule = $state<string | null>(null);
  const broken = $derived(game.save.repairShop.filter(r => !r.fixed));
  const fixed = $derived(game.save.repairShop.filter(r => r.fixed).length);
  onMount(() => { W.dim = true; audio.setMood('hub'); });
  const W8: Record<string, number> = { automatic: 4, mastered: 3, learned: 2, learning: 1 };
  const cats = Object.keys(CAT).sort((a, b) => score(b) - score(a));
  function score(c: string) { return skillDefs.filter(d => d.cat === c).reduce((s, d) => s + (W8[game.save.skills[d.id]?.status] ?? 0) * 10 + (d.templates.length ? 1 : 0), 0); }
  const tier = (st?: string) => st === 'automatic' ? 'gold' : st === 'mastered' ? 'crystal' : st === 'learned' ? 'charged' : st === 'learning' ? 'charging' : st === 'available' ? 'empty' : 'locked';
</script>

<div class="wrap">
  <div class="top panel">
    <button class="btn ghost small" onclick={() => go({ name: 'hub' })}>←</button>
    <button class="tab" class:on={tab === 'cards'} onclick={() => (tab = 'cards')}>Карточкалар</button>
    <button class="tab" class:on={tab === 'repair'} onclick={() => (tab = 'repair')}>Шеберхана {broken.length ? `(${broken.length})` : ''}</button>
  </div>

  {#if tab === 'cards'}
    {#each cats as c}
      {@const all = skillDefs.filter(d => d.cat === c)}
      {@const open = all.filter(d => (game.save.skills[d.id]?.status ?? 'locked') !== 'locked')}
      {@const list = open.length ? open : all.slice(0, 2)}
      {@const hidden = all.length - list.length}
      <section class="panel cat" style="--cc:{CC[c]}">
        <h2>{CAT[c]} <small>{all.filter(d => ['mastered', 'automatic'].includes(game.save.skills[d.id]?.status)).length}/{all.length}</small></h2>
        <div class="cards">
          {#each list as d}
            {@const s = game.save.skills[d.id]}
            <button class="card {tier(s?.status)}" class:has-rule={!!ruleOf(d.id)} title={d.title.ru} onclick={() => { if (ruleOf(d.id)) { openRule = openRule === d.id ? null : d.id; audio.play('click'); } }}>
              <i class="gem"></i>
              <span>{s?.status === 'locked' || !s ? '🔒 Құпия карта' : d.title.kz}</span>
              {#if s && s.status !== 'locked' && !d.templates.length}<small class="soon">жақында</small>{/if}
              {#if s?.status === 'learning'}<b class="bar"><i style="width:{Math.round((s.p ?? 0) * 100)}%"></i></b>{/if}
              {#if ruleOf(d.id)}<small class="rule-mark">★</small>{/if}
            </button>
          {/each}
          {#if hidden}<div class="card more"><span>+{hidden} жабық</span></div>{/if}
        </div>
        {#if openRule && all.some(d => d.id === openRule)}
          <div class="rule appear">
            <b>★ {skillDefs.find(d => d.id === openRule)?.title.kz}</b>
            {#each ruleOf(openRule)?.lines ?? [] as l}<p>{l}</p>{/each}
          </div>
        {/if}
      </section>
    {/each}
  {:else}
    <section class="panel repair">
      <p>Әр қателік — глитч-бөлшек. Оны жөндеу үшін дәл сондай есепті өзің шығар. Жөнделгені: <b>{fixed}</b>.</p>
      {#if broken.length}
        <ul>{#each broken.slice(-12) as r}<li><i class="bolt"></i>{skillDefs.find(d => d.id === r.skill)?.title.kz}</li>{/each}</ul>
        <button class="btn gold big block" onclick={() => { audio.unlock(); audio.play('mission'); go({ name: 'session', block: 'repair' }); }}>Жөндеуді бастау</button>
      {:else}<p class="ok">Шеберхана бос — сынған бөлшек жоқ!</p>{/if}
    </section>
  {/if}
</div>

<style>
  .wrap { min-height: 100dvh; width: min(1200px, 100%); margin: 0 auto; display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 380px), 1fr)); align-content: start; align-items: start; gap: 12px; padding: calc(env(safe-area-inset-top, 0px) + 12px) 16px 24px; }
  .top, .repair { grid-column: 1 / -1; }
  .cat { position: relative; overflow: hidden; }
  .cat::before { content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 4px; background: var(--cc, var(--code)); box-shadow: 0 0 12px var(--cc, var(--code)); }
  .top { display: flex; gap: 8px; align-items: center; padding: 8px 12px; }
  .btn.small { min-height: 40px; padding: 6px 12px; }
  .tab { font: 800 var(--fs-m) var(--txt); color: var(--dim); background: none; border: 0; padding: 8px 12px; border-radius: 6px; cursor: pointer; }
  .tab.on { color: var(--ink); background: var(--panel-hi); }
  .cat h2 { font-size: 18px; margin-bottom: 10px; } .cat h2 small { color: var(--dim); font-weight: 700; }
  .cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 8px; }
  .card { position: relative; display: grid; gap: 6px; align-content: start; min-height: 86px; padding: 10px; font-weight: 800; font-size: var(--fs-s); line-height: 1.3; background: var(--deep); border: 2px solid var(--line); border-radius: 8px; }
  .gem { width: 18px; height: 18px; clip-path: polygon(50% 0, 100% 40%, 50% 100%, 0 40%); background: #2a3160; }
  .locked { opacity: .6; border-style: dashed; background: repeating-linear-gradient(45deg, #0f1430 0 8px, #121838 8px 16px); } .locked span { color: var(--faint); }
  .charging .gem { background: var(--gold); } .charging { border-color: var(--gold-deep); }
  .charged .gem { background: var(--code); box-shadow: 0 0 10px var(--code); } .charged { border-color: var(--code-deep); }
  .crystal { border-color: var(--crystal); background: linear-gradient(160deg, #2b1f55, var(--deep)); box-shadow: inset 0 0 18px #b58cff33; }
  .crystal .gem { background: var(--crystal); box-shadow: 0 0 12px var(--crystal); animation: pulse-glow 2.4s infinite; }
  .gold { border-color: var(--gold); } .gold .gem { background: var(--gold); box-shadow: 0 0 12px var(--gold); }
  .soon { color: var(--faint); font-weight: 700; }
  .more { place-content: center; color: var(--faint); border-style: dashed; }
  .bar { display: block; height: 6px; background: #070a1a; } .bar i { display: block; height: 100%; background: var(--gold); }
  .repair { display: grid; gap: 12px; }
  .repair ul { margin: 0; padding: 0; list-style: none; display: grid; gap: 6px; }
  .repair li { display: flex; gap: 10px; align-items: center; background: var(--deep); padding: 8px 10px; font-weight: 700; }
  .bolt { width: 14px; height: 14px; background: var(--glitch); clip-path: polygon(40% 0, 100% 0, 60% 45%, 90% 45%, 20% 100%, 40% 55%, 10% 55%); }
  .ok { color: var(--ok); font-weight: 800; }
  button.card { font-family: inherit; color: inherit; text-align: left; cursor: default; }
  button.card.has-rule { cursor: pointer; }
  .rule-mark { position: absolute; right: 6px; bottom: 4px; color: var(--gold); }
  .rule { display: grid; gap: 6px; margin-top: 10px; background: linear-gradient(135deg, #1a1f4a, #0d1030); border: 2px solid var(--gold); border-radius: 10px; padding: 12px 14px; }
  .rule b { color: var(--gold); }
  .rule p { font-weight: 800; }
</style>
