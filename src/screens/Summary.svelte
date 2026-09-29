<script lang="ts">
  import { onMount } from 'svelte';
  import Bit from '../ui/Bit.svelte';
  import Screen from '../ui/Screen.svelte';
  import Icon from '../ui/Icon.svelte';
  import { toast } from '../ui/notify.svelte';
  import { game, go, persist } from '../lib/store.svelte';
  import { W } from '../lib/world.svelte';
  import { completeBlock, dayRec } from '../lib/session.svelte';
  import { skillTitle } from '../engine/items';
  import { audio } from '../lib/audio';
  import { sparksAt } from '../ui/fx.svelte';
  import { react } from '../lib/voice';

  const todays = game.save.attempts.filter(a => a.day === game.day);
  // Счётчики считают одно и то же: todays — все первые попытки за день (вторая попытка и реванш в модель не пишутся).
  // «Есеп» — сколько задач решал, «дұрыс» — сколько из них верно с первого раза; раньше стояло «шешілді» = верно И не торопясь,
  // из-за чего при 7 решённых показывалось 5 (аудит 30.09).
  const total = todays.length;
  const right = todays.filter(a => a.correct).length;
  const skillsToday = [...new Set(todays.map(a => a.skill))];
  const acc = total ? Math.round((right / total) * 100) : 0;   // из тех же чисел, что «есеп» и «дұрыс»: 5 из 7 = 71%
  let note = $state<string | null>(null);
  let shownToday = $state(0), shownWeekend = $state(0);
  let finished = $state(false);
  let gain = $state(0);   // сколько минут добавил этот итог: «+5» вылетает над плиткой и влетает в неё

  function count(to: number, set: (v: number) => void) {
    const t0 = performance.now();
    const tick = (t: number) => { const k = Math.min(1, (t - t0) / 1100); set(Math.round(to * (1 - Math.pow(1 - k, 3)))); if (k < 1) requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  }

  onMount(() => { W.dim = false; W.world?.setMode('hub'); W.world?.bitMood('happy'); audio.setMood('victory'); });

  function finish() {
    dayRec().hard = note ?? undefined;
    const before = dayRec().minutesToday;
    completeBlock('summary');
    const rec = dayRec();
    gain = rec.minutesToday - before;   // отдельного окна нет: награда — сама эта сцена (цифры считаются вверх, число влетает в плитку)
    finished = true; audio.play('chest'); if (gain > 0) setTimeout(() => audio.play('coins'), 700); react('day');
    count(rec.minutesToday, v => (shownToday = v)); count(rec.minutesWeekend, v => (shownWeekend = v));
    sparksAt(innerWidth / 2, innerHeight / 2, ['#ffc94a', '#3ff0ff', '#ff4fb8'], 90, 11);
    W.world?.celebrate(0xffc94a);
    persist();
  }
</script>

<Screen scene="tall" title="Күн қорытындысы" sub={finished ? 'Сыйлық есептелді' : 'Бүгінгі жұмысың'} back={() => go({ name: 'hub' })}>
  {#snippet overlay()}
    <div></div>
    <div class="say"><Bit text={finished ? 'Керемет жұмыс! Ойын уақыты жиналды.' : `${game.save.heroName}, бүгін жарайсың! Бір сұрақ — сосын сыйлық.`} mood="happy" compact /></div>
  {/snippet}

  {#if finished}
    <div class="rewards">
      {#if gain > 0}<div class="gain px" aria-hidden="true">+{gain}</div>{/if}
      <div class="rw gold"><Icon name="clock" fill="var(--gold)" size={30} /><b class="num">{shownToday}</b><small>мин ойын бүгін</small></div>
      <div class="rw"><Icon name="star" fill="var(--code)" size={30} /><b class="num">{shownWeekend}</b><small>мин демалысқа</small></div>
    </div>
  {/if}

  <div class="stats3">
    <div><b class="num">{total}</b><small>есеп</small></div>
    <div><b class="num">{right}</b><small>дұрыс</small></div>
    <div><b class="num">{acc}%</b><small>дәлдік</small></div>
  </div>

  {#if skillsToday.length}
    <div class="paper topics">
      {#each skillsToday as s}{@const st = game.save.skills[s]}
        <div class="tp"><span>{skillTitle(s).kz}</span><span class="bar"><i style="width:{Math.round((st?.p ?? 0) * 100)}%"></i></span><em>{st?.status === 'learned' ? 'үйренді ✓' : st?.status === 'mastered' ? 'кристалл' : 'зарядталуда'}</em></div>
      {/each}
    </div>
  {/if}

  {#if !finished}
    <p class="ask">Бүгін не қиын болды?</p>
    <div class="chips">
      {#each skillsToday as s}<button class="chip" class:on={note === s} onclick={() => (note = s)}>{skillTitle(s).kz}</button>{/each}
      <button class="chip" class:on={note === 'none'} onclick={() => (note = 'none')}>Бәрі түсінікті</button>
    </div>
  {/if}

  {#snippet footer()}
    {#if !finished}
      <button class="btn primary big grow" onclick={() => (note ? finish() : toast('Алдымен бір жауапты таңда'))} class:wait={!note}>Сыйлықты алу</button>
    {:else}
      <button class="btn go big grow" onclick={() => go({ name: 'hub' })}>Кемеге<Icon name="chevron" fill="var(--outline)" size={20} /></button>
    {/if}
  {/snippet}
</Screen>

<style>
  .say { padding: 0 4px 6px; width: min(460px, 100%); }
  .rewards { position: relative; display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 8px; }
  .rw { display: grid; justify-items: center; gap: 2px; padding: 12px 6px; border-radius: 16px; background: var(--deep); border: 3px solid var(--outline); animation: pop-in .4s var(--ease-out) both; }
  .gain { position: absolute; left: 50%; top: 50%; z-index: 3; pointer-events: none; font-size: 56px; color: var(--gold); text-shadow: 0 4px 0 var(--outline), 0 0 20px #ffcb2e;
    animation: gain-fly 1.5s .15s cubic-bezier(.3, .8, .4, 1) both; }
  @keyframes gain-fly { 0% { opacity: 0; transform: translate(-50%, 10px) scale(.3); } 25% { opacity: 1; transform: translate(-50%, -30px) scale(1.25); }
    55% { opacity: 1; transform: translate(-50%, -34px) scale(1); } 100% { opacity: 0; transform: translate(-90%, -6px) scale(.5); } }
  .rw b { font-size: 40px; line-height: 1; text-shadow: 0 3px 0 var(--outline); }
  .rw.gold b { color: var(--gold); }
  .rw small { color: var(--dim); font-size: 13px; }
  .stats3 { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
  .stats3 div { display: grid; justify-items: center; gap: 2px; padding: 10px 4px; background: var(--deep); border: 3px solid var(--outline); border-radius: 14px; }
  .stats3 b { font-size: 26px; color: var(--code); text-shadow: 0 2px 0 var(--outline); }
  .stats3 small { color: var(--dim); font-size: 12px; }
  .topics { display: grid; gap: 8px; }
  .tp { display: grid; grid-template-columns: 1fr 70px auto; gap: 8px; align-items: center; font-size: 14px; }
  .tp .bar { height: 12px; border-width: 2px; } .tp .bar i { background: linear-gradient(180deg, #ffe38a, var(--gold)); }
  .tp em { font-style: normal; color: var(--paper-dim); font-size: 12px; }
  .ask { font: 900 18px var(--disp); text-shadow: 0 2px 0 var(--outline); }
  .chips { display: flex; flex-wrap: wrap; gap: 8px; }
  .chip { font: 800 var(--fs-s) var(--txt); color: var(--paper-ink); background: var(--paper); border: 3px solid var(--outline); border-radius: 999px; padding: 9px 14px; cursor: pointer; box-shadow: 0 3px 0 var(--outline); min-height: 44px; }
  .chip.on { background: #d9f8ff; box-shadow: 0 0 0 3px var(--code), 0 3px 0 var(--outline); }
  .grow { flex: 1; }
  @media (max-width: 999.98px) and (max-height: 560px) and (min-aspect-ratio: 23/20) {   /* телефон в горизонтали: колонка низкая */
    .rw { padding: 6px 4px; } .rw b { font-size: 28px; } .stats3 div { padding: 5px 2px; } .stats3 b { font-size: 20px; } .gain { font-size: 40px; }
  }
  .btn.wait { --c: #5b6699; --e: #3d4670; --t: #d7dcf5; text-shadow: none; }
</style>
