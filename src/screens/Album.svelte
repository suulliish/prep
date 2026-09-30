<script lang="ts">
  // Альбом: мои карты тем, ближайшие карты (с названием темы — что открыть дальше), разделы с прогрессом,
  // шеберхана (ремонт ошибок), приёмы («Тәсілдер»: у каждой темы свой приём удара, открывается уроком темы). docs/DESIGN_SYSTEM.md 12.6: пустое — это приглашение к действию, а не стена замков.
  import { onMount } from 'svelte';
  import Screen from '../ui/Screen.svelte';
  import Icon from '../ui/Icon.svelte';
  import { game, go, skillDefs } from '../lib/store.svelte';
  import { W } from '../lib/world.svelte';
  import { audio } from '../lib/audio';
  import { toast } from '../ui/notify.svelte';
  import { isCredited, CREDIT_STEPS, WINDOWS } from '../engine/recall';
  // @ts-ignore
  import { LESSONS } from '../../content/lessons.mjs';
  // @ts-ignore
  import { TECHNIQUES } from '../../content/techniques.mjs';

  const CAT: Record<string, string> = { A: 'Теңдеулер', B: 'Мәтінді есептер', C: 'Есептеу', D: 'Бөлінгіштік', E: 'Геометрия', F: 'Пропорция', G: 'Пайыз', H: 'Заңдылық', I: 'Логика', J: 'Көрнекі логика', K: 'Координаталар' };
  const CC: Record<string, string> = { A: '#35e6ff', B: '#ffcb2e', C: '#3ddc6e', D: '#a77bff', E: '#ff9a3d', F: '#5ea0ff', G: '#ff4fb8', H: '#d6f24a', I: '#c0c8ff', J: '#ff7de0', K: '#7dffd4' };
  const TIER: Record<string, { kz: string; c: string }> = {
    automatic: { kz: 'Алтын', c: 'var(--gold)' }, mastered: { kz: 'Кристалл', c: 'var(--crystal)' },
    learned: { kz: 'Үйренді', c: 'var(--code)' }, learning: { kz: 'Зарядталуда', c: '#8c9be0' },
  };
  let tab = $state<'cards' | 'notebook' | 'repair'>(game.screen.name === 'album' && game.screen.tab ? game.screen.tab : 'cards');
  const st = (id: string) => game.save.skills[id]?.status ?? 'locked';
  const mine = $derived(skillDefs.filter(d => TIER[st(d.id)]).sort((a, b) => ['automatic', 'mastered', 'learned', 'learning'].indexOf(st(a.id)) - ['automatic', 'mastered', 'learned', 'learning'].indexOf(st(b.id))));
  const nextCards = $derived(skillDefs.filter(d => st(d.id) === 'available' && d.templates.length && (LESSONS as Record<string, any[]>)[d.id]).slice(0, 4));
  const cats = Object.keys(CAT);
  const catStat = (c: string) => { const all = skillDefs.filter(d => d.cat === c); return { all: all.length, got: all.filter(d => ['learned', 'mastered', 'automatic'].includes(st(d.id))).length }; };
  const lessonPassed = (id: string) => !!game.save.skills[id]?.lessonDone || ['learned', 'mastered', 'automatic'].includes(st(id));
  const ruleOf = (id: string) => (lessonPassed(id) ? (LESSONS as Record<string, any[]>)[id]?.find(s => s.type === 'rule') : undefined);
  let openCard = $state<string | null>(null);
  let openTech = $state<string | null>(null);
  type Tech = { skill: string; kz: string; color: number; fx: 'arc' | 'pierce' | 'split' | 'multi' | 'spin' };
  const hex = (n: number) => '#' + n.toString(16).padStart(6, '0');
  const techs = $derived((TECHNIQUES as Tech[]).map(t => ({ ...t, theme: skillDefs.find(d => d.id === t.skill)?.title.kz ?? '', open: lessonPassed(t.skill) })));
  const techsOpen = $derived(techs.filter(t => t.open).length);
  // «Дәптер»: карточка на каждую тему, которая стоит на возвратах «Еске түсір»: 5 клеток ✔/✘ с датой и статус «зачтено»
  const dmy = (d: string) => `${d.slice(8, 10)}.${d.slice(5, 7)}`;
  // срок сегодня или уже прошёл: даты в прошлом не показываем, тема ждёт возврата сегодня
  const dueText = (d: string) => (d <= game.day ? 'бүгін' : dmy(d));
  const nbCards = $derived(Object.entries(game.save.recall ?? {})
    .map(([id, r]) => ({ id, r, title: skillDefs.find(d => d.id === id)?.title.kz ?? id, cat: skillDefs.find(d => d.id === id)?.cat ?? 'A', wrote: !!game.save.notebook?.[id]?.wrote }))
    .sort((a, b) => Number(isCredited(a.r)) - Number(isCredited(b.r)) || (a.r.due < b.r.due ? -1 : 1)));
  const nbCredited = $derived(nbCards.filter(c => isCredited(c.r)).length);
  // клетки: последние 5 возвратов; пустые подписаны окном дней, когда ждём следующий
  const cells = (r: (typeof nbCards)[number]['r']) => {
    const done = r.history.slice(-5);
    const at = r.history.length > 5 ? 5 : r.history.length;
    return [...done.map(h => ({ h, w: '' })), ...Array.from({ length: 5 - done.length }, (_, k) => ({ h: null, w: WINDOWS[at + k] ?? '' }))];
  };
  const broken = $derived(game.save.repairShop.filter(r => !r.fixed));
  const fixed = $derived(game.save.repairShop.filter(r => r.fixed).length);
  onMount(() => { W.dim = true; audio.setMood('hub'); });
  function tap(id: string) {
    audio.play('click');
    if (ruleOf(id)) openCard = id; else toast('Бұл картаның ережесі сабақтан кейін ашылады');
  }
  function tapTech(id: string) { audio.play('click'); openTech = id; }
</script>

{#snippet fxIcon(fx: string, c: string)}
  <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke={c} stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    {#if fx === 'arc'}<path d="M4 19Q12 -1 20 19" />
    {:else if fx === 'pierce'}<path d="M3 12h16M14 6l6 6-6 6" />
    {:else if fx === 'split'}<path d="M4 4h10L4 14zM20 10v10H10z" fill={c} stroke-width="1.5" />
    {:else if fx === 'multi'}<path d="M4 19L8 5M10 19l4-14M16 19l4-14" />
    {:else}<path d="M12 4a8 8 0 1 0 8 8" /><path d="M20 3v7h-7" />{/if}
  </svg>
{/snippet}

<Screen scene="none" title="Альбом" sub={`${mine.length} карта жиналды`} back={() => go({ name: 'hub' })}>
  <div class="seg" role="tablist">
    <button role="tab" class:on={tab === 'cards'} aria-selected={tab === 'cards'} onclick={() => (tab = 'cards')}><Icon name="cards" fill="var(--crystal)" size={20} />Карталар</button>
    <button role="tab" class:on={tab === 'notebook'} aria-selected={tab === 'notebook'} onclick={() => (tab = 'notebook')}><Icon name="book" fill="#7ee08f" size={20} />Дәптер</button>
    <button role="tab" class:on={tab === 'repair'} aria-selected={tab === 'repair'} onclick={() => (tab = 'repair')}><Icon name="bolt" fill="var(--gold)" size={20} />Жөндеу{#if broken.length}<b class="cnt">{broken.length}</b>{/if}</button>
  </div>

  {#if tab === 'cards'}
    <h2 class="h">Менің карталарым</h2>
    {#if mine.length}
      <div class="grid">
        {#each mine as d (d.id)}
          {@const t = TIER[st(d.id)]}
          <button class="card" style="--cc:{CC[d.cat]}; --tc:{t.c}" onclick={() => tap(d.id)}>
            <span class="band"></span>
            <b>{d.title.kz}</b>
            <span class="chip">{t.kz}</span>
            {#if st(d.id) === 'learning'}<span class="bar"><i style="width:{Math.round((game.save.skills[d.id].p ?? 0) * 100)}%"></i></span>{/if}
            {#if ruleOf(d.id)}<span class="rl"><Icon name="book" fill="#fff" size={16} /></span>{/if}
          </button>
        {/each}
      </div>
    {:else}
      <div class="paper empty">Бірінші карта бірінші сабақтан кейін пайда болады.</div>
    {/if}

    {#if nextCards.length}
      <h2 class="h">Келесі карталар</h2>
      <div class="grid">
        {#each nextCards as d (d.id)}
          <div class="card next" style="--cc:{CC[d.cat]}">
            <span class="band"></span>
            <b>{d.title.kz}</b>
            <span class="chip"><Icon name="lock" fill="#c4cfff" size={14} />Сабақтан кейін</span>
          </div>
        {/each}
      </div>
    {/if}

    <h2 class="h">Барлық бөлімдер</h2>
    <ul class="cats">
      {#each cats as c}{@const k = catStat(c)}
        <li style="--cc:{CC[c]}"><i class="dot"></i><span>{CAT[c]}</span><span class="bar"><i style="width:{(k.got / Math.max(1, k.all)) * 100}%"></i></span><b class="num">{k.got}/{k.all}</b></li>
      {/each}
    </ul>

    <h2 class="h">Тәсілдер <b class="tcount">{techsOpen}/{techs.length}</b></h2>
    <div class="tgrid">
      {#each techs as t (t.skill)}
        {#if t.open}
          <button class="tech" style="--tc:{hex(t.color)}" onclick={() => tapTech(t.skill)}>
            <span class="fx">{@render fxIcon(t.fx, hex(t.color))}</span>
            <span class="tt"><b>{t.kz}</b><small>{t.theme}</small></span>
          </button>
        {:else}
          <div class="tech locked">
            <span class="fx"><Icon name="lock" fill="#c4cfff" size={20} /></span>
            <span class="tt"><b>{t.kz}</b><small>Сабақтан кейін</small></span>
          </div>
        {/if}
      {/each}
    </div>
  {:else if tab === 'notebook'}
    <p class="nbnote"><b>{CREDIT_STEPS} рет</b> қатесіз еске түссе, тақырып меңгерілген болып саналады. Меңгерілді: <b>{nbCredited}/{nbCards.length}</b></p>
    {#if nbCards.length}
      <div class="nbgrid">
        {#each nbCards as c (c.id)}
          {@const done = isCredited(c.r)}
          <article class="nbcard" class:done style="--cc:{CC[c.cat]}">
            <span class="band"></span>
            <header><b>{c.title}</b><span class="chip" class:ok={done}>{done ? 'Меңгерілді' : `${Math.min(c.r.step, CREDIT_STEPS)}/${CREDIT_STEPS}`}</span></header>
            <div class="cells" role="list" aria-label="Қайталаулар">
              {#each cells(c.r) as k}
                <span class="cell" role="listitem" class:ok={k.h?.ok && k.h.hint === 0} class:help={k.h?.ok && k.h.hint > 0} class:no={k.h && !k.h.ok}>
                  {#if k.h}<b>{k.h.ok ? '✔' : '✘'}</b><small>{dmy(k.h.day)}</small>{:else}<small class="win">{k.w ? `${k.w} күн` : ''}</small>{/if}
                </span>
              {/each}
            </div>
            <small class="nx">{c.wrote ? 'Дәптерге жазылды · ' : ''}{done ? 'сирек қайталау: ' : 'келесі: '}{dueText(c.r.due)}</small>
          </article>
        {/each}
      </div>
    {:else}
      <div class="paper empty">Дәптер әзірге бос. Бірінші сабақтан кейін әр тақырыпқа бет ашылады.</div>
    {/if}
  {:else}
    <div class="paper">Әр қате — сынған бөлшек. Жөндеу үшін дәл сондай есепті өзің шығар. Жөнделгені: <b>{fixed}</b>.</div>
    {#if broken.length}
      <ul class="cats">{#each broken.slice(-12) as r}<li style="--cc:var(--miss)"><i class="dot"></i><span>{skillDefs.find(d => d.id === r.skill)?.title.kz}</span></li>{/each}</ul>
    {:else}<div class="paper empty">Кеме бүтін: сынған бөлшек жоқ!</div>{/if}
  {/if}

  {#snippet footer()}
    {#if tab === 'repair' && broken.length}
      <button class="btn primary big grow" onclick={() => { audio.unlock(); audio.play('mission'); go({ name: 'session', block: 'repair' }); }}>Жөндеуді бастау</button>
    {:else}
      <button class="btn big grow" onclick={() => go({ name: 'hub' })}>Кемеге</button>
    {/if}
  {/snippet}
</Screen>

{#if openTech}
  {@const t = techs.find(x => x.skill === openTech)}
  {#if t}
    <div class="scrim" role="presentation" onclick={() => (openTech = null)}></div>
    <div class="sheet paper" role="dialog" aria-modal="true" aria-label={t.kz} style="--tc:{hex(t.color)}">
      <b class="rt"><span class="fx big">{@render fxIcon(t.fx, hex(t.color))}</span>{t.kz}</b>
      <p class="theme">{t.theme}</p>
      {#each ruleOf(t.skill)?.lines ?? [] as l}<p>{l}</p>{/each}
      <p class="how">Шайқаста осы тақырыптың есебінде батыр осы тәсілмен соғады.</p>
      <div class="row"><button class="btn ghost dark" onclick={() => (openTech = null)}>Жабу</button></div>
    </div>
  {/if}
{/if}

{#if openCard}
  {@const d = skillDefs.find(x => x.id === openCard)}
  <div class="scrim" role="presentation" onclick={() => (openCard = null)}></div>
  <div class="sheet paper" role="dialog" aria-modal="true" aria-label={d?.title.kz}>
    <b class="rt"><Icon name="star" fill="var(--gold)" size={22} />{d?.title.kz}</b>
    {#each ruleOf(openCard)?.lines ?? [] as l}<p>{l}</p>{/each}
    <div class="row">
      <button class="btn ghost dark" onclick={() => (openCard = null)}>Жабу</button>
      {#if (LESSONS as Record<string, any[]>)[openCard]?.some(s => s.type === 'goal')}
        <button class="btn primary" onclick={() => go({ name: 'lesson', skill: openCard!, replay: true })}>Сабақты қайта көру</button>
      {/if}
    </div>
  </div>
{/if}

<style>
  .seg { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; padding: 5px; border-radius: 16px; background: var(--deep); border: 3px solid var(--outline); }
  .seg button { display: flex; align-items: center; justify-content: center; gap: 4px; min-height: 44px; font: 800 14px var(--disp); color: var(--dim); background: none; border: 0; border-radius: 11px; cursor: pointer; }
  .seg button.on { color: var(--ink); background: var(--panel); box-shadow: inset 0 -3px 0 var(--panel-2), 0 0 0 2px var(--outline); }
  .cnt { min-width: 20px; height: 20px; padding: 0 5px; display: grid; place-items: center; font: 900 12px var(--disp); color: var(--outline); background: var(--gold); border-radius: 10px; border: 2px solid var(--outline); }
  .h { font-size: 18px; text-shadow: 0 2px 0 var(--outline); margin-top: 4px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 8px; }
  .card { position: relative; display: grid; align-content: start; gap: 6px; min-height: 104px; padding: 18px 10px 10px; text-align: left; font: inherit; color: var(--ink); cursor: pointer;
    background: linear-gradient(180deg, #2d4fe0, #1d35a6); border: 3px solid var(--outline); border-radius: 14px; box-shadow: 0 0 0 2px var(--tc, transparent) inset, 0 3px 0 var(--outline); overflow: hidden; }
  .card:active { transform: translateY(2px); }
  .band { position: absolute; left: 0; right: 0; top: 0; height: 8px; background: var(--cc); }
  .card b { font: 800 15px/1.2 var(--disp); }
  .chip { justify-self: start; display: inline-flex; align-items: center; gap: 4px; font: 800 11px var(--txt); padding: 2px 8px; border-radius: 999px; color: var(--outline); background: var(--tc, #8c9be0); border: 2px solid var(--outline); }
  .card.next { cursor: default; background: #1a2a7a; opacity: .85; }
  .card.next .chip { background: #2b3a8f; color: var(--dim); }
  .card .bar { height: 10px; border-width: 2px; }
  .rl { position: absolute; right: 8px; bottom: 8px; }
  .empty { text-align: center; color: var(--paper-dim); }
  .cats { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
  .cats li { display: grid; grid-template-columns: 14px 1fr 80px auto; align-items: center; gap: 8px; padding: 8px 10px; border-radius: 12px; background: var(--deep); border: 3px solid var(--outline); font-size: 14px; }
  .cats li .bar { height: 10px; border-width: 2px; } .cats li .bar i { background: var(--cc); }
  .dot { width: 12px; height: 12px; border-radius: 50%; background: var(--cc); border: 2px solid var(--outline); }
  .cats b { font-size: 13px; color: var(--dim); }
  .grow { flex: 1; }
  .nbnote { margin: 0; font: 700 14px/1.35 var(--txt); color: var(--dim); }
  .nbgrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 8px; }
  .nbcard { position: relative; display: grid; gap: 8px; padding: 18px 10px 10px; color: var(--paper-ink); overflow: hidden;
    background-image: linear-gradient(#c9d3f577 1px, transparent 1px), linear-gradient(90deg, #c9d3f577 1px, transparent 1px); background-size: 16px 16px; background-color: var(--paper);
    border: 3px solid var(--outline); border-radius: 14px; box-shadow: 0 3px 0 var(--outline); }
  .nbcard.done { box-shadow: 0 0 0 3px var(--ok) inset, 0 3px 0 var(--outline); }
  .nbcard header { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .nbcard header b { font: 800 15px/1.2 var(--disp); }
  .nbcard .chip { flex: none; background: #d6ddf7; }
  .nbcard .chip.ok { background: var(--ok); }
  .cells { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 5px; }
  .cell { display: grid; place-items: center; align-content: center; gap: 1px; min-height: 52px; padding: 2px; border: 2px dashed #8c9be0; border-radius: 8px; background: #ffffffaa; text-align: center; }
  .cell b { font: 900 18px/1 var(--disp); }
  .cell small { font: 800 10px/1.1 var(--txt); color: var(--paper-dim); }
  .cell.ok { border: 2px solid var(--outline); background: #c9f7d8; }
  .cell.help { border: 2px solid var(--outline); background: #fff1bf; }
  .cell.no { border: 2px solid var(--outline); background: #ffe0d6; }
  .cell .win { font-weight: 700; }
  .nx { font: 700 12px var(--txt); color: var(--paper-dim); }
  .scrim { position: fixed; inset: 0; z-index: var(--z-modal); background: #05071399; }
  .sheet { position: fixed; z-index: calc(var(--z-modal) + 1); left: 0; right: 0; margin-inline: auto; bottom: calc(env(safe-area-inset-bottom, 0px) + 12px); width: min(460px, calc(100% - 20px));   /* без transform: анимация pop-in его затирала и карточка уезжала вправо */ display: grid; gap: 8px; animation: pop-in .25s var(--ease-out) both; }
  .rt { display: flex; align-items: center; gap: 8px; font: 900 19px var(--disp); }
  .row { display: flex; gap: 8px; justify-content: flex-end; margin-top: 6px; }
  .tcount { font: 900 14px var(--disp); color: var(--dim); margin-left: 6px; }
  .tgrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 8px; }
  .tech { position: relative; display: flex; align-items: center; gap: 8px; min-height: 60px; padding: 8px 8px 8px 14px; text-align: left; font: inherit; color: var(--ink); cursor: pointer;
    background: linear-gradient(180deg, #2d4fe0, #1d35a6); border: 3px solid var(--outline); border-radius: 14px; box-shadow: 0 3px 0 var(--outline); overflow: hidden; }
  .tech::before { content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 7px; background: var(--tc, #5b6699); }
  .tech:active { transform: translateY(2px); }
  .tech.locked { cursor: default; background: #1a2a7a; opacity: .8; --tc: #5b6699; }
  .tech.locked:active { transform: none; }
  .fx { flex: none; width: 34px; height: 34px; display: grid; place-items: center; border-radius: 50%; background: var(--outline); border: 2px solid var(--tc, #5b6699); }
  .tech.locked .fx { background: #2b3a8f; border-color: #5b6699; }
  .fx.big { width: 40px; height: 40px; }
  .tt { min-width: 0; display: grid; gap: 2px; }
  .tt b { font: 800 14px/1.15 var(--disp); overflow-wrap: anywhere; }
  .tt small { font: 700 11px/1.15 var(--txt); color: var(--dim); }
  .tech.locked .tt b { color: var(--dim); }
  .theme { font-weight: 800; color: var(--paper-dim); }
  .how { color: var(--paper-dim); font-style: italic; }
  .btn.dark { --t: var(--paper-ink); --c: var(--paper-2); --e: var(--paper-line); text-shadow: none; }
</style>
