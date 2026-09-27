<script lang="ts">
  // Диагностика-«сканер»: идём по графу снизу вверх; 2 верных ответа подряд — тема считается известной
  // (с проверкой на следующий учебный день), ошибка — тема откроется для изучения, ветка выше не сканируется.
  import { onMount } from 'svelte';
  import Bit from '../ui/Bit.svelte';
  import { game, go, persist, skillDefs } from '../lib/store.svelte';
  import { W } from '../lib/world.svelte';
  import { makeItem, skillTitle, type Item } from '../engine/items';
  import { blankSkill, refreshAvailability } from '../engine/progress';
  import { addSchoolDays } from '../engine/dates';
  import { replan } from '../lib/session.svelte';
  import { audio } from '../lib/audio';
  import { sparksAt, centerOf } from '../ui/fx.svelte';

  // сканируем навыки 5 класса, у которых есть задачи, в порядке графа
  const order = skillDefs.filter(d => d.grade === 5 && d.templates.length).map(d => d.id);
  const known = new Set<string>(), failed = new Set<string>();
  let queue = order.slice();
  let cur = $state<string | null>(null);
  let item = $state<Item | null>(null);
  let streak = 0;
  let picked = $state<number | null>(null);
  let scanned = $state(0);
  let done = $state(false);
  let t0 = 0;
  let el: HTMLElement;

  function blocked(id: string) { return skillDefs.find(d => d.id === id)!.prereqs.some(p => failed.has(p) || (!known.has(p) && order.includes(p))); }
  function nextSkill() {
    while (queue.length) { const id = queue.shift()!; if (!blocked(id)) { cur = id; streak = 0; return true; } }
    return false;
  }
  function nextItem() {
    if (!cur && !nextSkill()) return finish();
    item = makeItem(cur!); picked = null; t0 = performance.now();
  }
  onMount(() => { W.dim = false; W.world?.setMode('portal'); W.world?.bitMood('think'); audio.setMood('map'); nextSkill(); nextItem(); });

  function pick(i: number) {
    if (!item || picked !== null) return;
    picked = i;
    const ok = i === item.answer && performance.now() - t0 > 3000;
    const c = centerOf(el);
    if (ok) { audio.play('xp'); sparksAt(c.x, c.y, ['#3ff0ff'], 16, 4); streak++; }
    else audio.play('click');
    setTimeout(() => {
      if (!ok) { failed.add(cur!); scanned++; cur = null; }
      else if (streak >= 2) {
        known.add(cur!); scanned++;
        const st = (game.save.skills[cur!] ??= blankSkill());
        st.status = 'learned'; st.p = 0.95; st.lessonDone = true; st.learnedAt = game.day; st.due = addSchoolDays(game.day, 1);
        cur = null;
      }
      nextItem();
    }, 450);
  }

  function finish() {
    done = true; item = null;
    game.save.diagnosticDone = true;
    refreshAvailability(game.save, skillDefs); replan(); persist();
    audio.play('portal'); W.world?.openPortal(); W.world?.bitMood('happy');
  }
</script>

<div class="wrap side-dock">
  <div class="top panel"><b class="t">Код-сканер</b><span class="num prog">{scanned} тақырып</span></div>
  <div class="spacer passthrough"></div>
  <section class="card panel glow" bind:this={el}>
    {#if !done && item}
      <Bit text="Сканерлеп жатырмын… Білмесең — ойлап таңда, қателік бұл жерде қалыпты." mood="think" compact />
      <div class="scan"><i></i></div>
      <p class="q">{#each item.kz.split('\n') as line, i}{#if i}<br />{/if}{line}{/each}</p>
      <div class="choices">
        {#each item.choices as c, i}<button class="choice" class:picked={picked === i} onclick={() => pick(i)} disabled={picked !== null}>{c.text}</button>{/each}
      </div>
      <button class="btn ghost" onclick={() => { failed.add(cur!); scanned++; cur = null; nextItem(); }}>Бұл тақырыпты әлі білмеймін</button>
    {:else}
      <Bit text={`Сканер аяқталды! ${known.size} тақырып саған таныс (ертең тексереміз), қалғанын бірге үйренеміз. Карта ашылды!`} mood="happy" />
      <ul class="res">{#each [...known] as k}<li class="ok">✓ {skillTitle(k).kz}</li>{/each}{#each [...failed] as k}<li>○ {skillTitle(k).kz}</li>{/each}</ul>
      <button class="btn primary big block" onclick={() => go({ name: 'hub' })}>Кемеге</button>
    {/if}
  </section>
</div>

<style>
  .wrap { min-height: 100dvh; width: min(640px, 100%); margin: 0 auto; display: flex; flex-direction: column; gap: 10px; padding: calc(env(safe-area-inset-top, 0px) + 12px) 16px calc(env(safe-area-inset-bottom, 0px) + 16px); }
  .top { display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; }
  .t { font-weight: 800; font-size: 20px; color: var(--code); }
  .prog { font-size: 20px; }
  .spacer { flex: 1; min-height: 18vh; }
  .card { display: grid; gap: 14px; padding: 18px; }
  .scan { height: 4px; background: #070a1a; overflow: hidden; }
  .scan i { display: block; width: 30%; height: 100%; background: var(--code); box-shadow: 0 0 12px var(--code); animation: sweep 1.2s linear infinite; }
  @keyframes sweep { from { transform: translateX(-100%); } to { transform: translateX(340%); } }
  .q { font-size: 19px; font-weight: 800; line-height: 1.5; }
  .choices { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 120px), 1fr)); gap: 8px; }
  .choice { font: 800 17px var(--txt); color: var(--ink); background: var(--deep); border: 2px solid var(--line); border-bottom-width: 5px; border-radius: 8px; padding: 12px; cursor: pointer; }
  .choice.picked { border-color: var(--code); }
  .res { margin: 0; padding-left: 4px; list-style: none; display: grid; gap: 4px; max-height: 30vh; overflow: auto; }
  .res li { color: var(--dim); }
  .res li.ok { color: var(--ok); font-weight: 700; }
</style>
