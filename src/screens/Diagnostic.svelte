<script lang="ts">
  // Диагностика-«сканер»: идём по графу снизу вверх; 2 верных ответа подряд — тема считается известной
  // (с проверкой на следующий учебный день), ошибка — тема откроется для изучения, ветка выше не сканируется.
  import { onMount } from 'svelte';
  import Bit from '../ui/Bit.svelte';
  import Screen from '../ui/Screen.svelte';
  import Icon from '../ui/Icon.svelte';
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
        st.status = 'learned'; st.p = 0.95; st.lessonDone = false; // урок не пропадает: провалит проверку — урок покажется
        st.learnedAt = game.day; st.due = addSchoolDays(game.day, 1);   // 02.10: эта строка была внутри комментария — темы скана никогда не проверялись
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

<Screen scene="short" title="Код-сканер" sub={done ? 'Сканер аяқталды' : `Тексерілді: ${scanned} тақырып`}>
  {#snippet right()}<span class="pill"><Icon name="bolt" fill="var(--code)" size={20} /><span class="num">{scanned}</span></span>{/snippet}
  {#if !done && item}
    <Bit text="Білмесең — «Білмеймін» бас. Қателік бұл жерде қалыпты: бұл сынақ емес." mood="think" compact />
    <div class="paper q">{#each item.kz.split('\n') as line, i}{#if i}<br />{/if}{line}{/each}</div>
    <div class="choices" bind:this={el}>
      {#each item.choices as c, i}<button class="ans" class:sel={picked === i} onclick={() => pick(i)} disabled={picked !== null}><span class="l">{'ABCDE'[i]}</span><span>{c.text}</span></button>{/each}
    </div>
  {:else}
    <Bit text={`Сканер аяқталды! ${known.size} тақырып саған таныс, қалғанын бірге үйренеміз. Әр тақырыптың сабағын бір рет өтеміз.`} mood="happy" />
    <ul class="paper res">{#each [...known] as k}<li class="ok"><Icon name="check" fill="var(--ok-deep)" size={16} />{skillTitle(k).kz}</li>{/each}{#each [...failed] as k}<li><Icon name="star" fill="var(--paper-line)" size={16} />{skillTitle(k).kz}</li>{/each}</ul>
  {/if}

  {#snippet footer()}
    {#if !done && item}
      <button class="btn big grow" onclick={() => { failed.add(cur!); scanned++; cur = null; nextItem(); }}>Білмеймін</button>
    {:else}
      <button class="btn primary big grow" onclick={() => go({ name: 'hub' })}>Кемеге<Icon name="chevron" fill="var(--outline)" size={20} /></button>
    {/if}
  {/snippet}
</Screen>

<style>
  .q { font-size: 19px; font-weight: 800; }
  .choices { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 140px), 1fr)); gap: 8px; }
  .choices .ans { font-size: 17px; }
  .res { margin: 0; list-style: none; display: grid; gap: 6px; }
  .res li { display: flex; align-items: center; gap: 8px; color: var(--paper-dim); }
  .res li.ok { color: var(--paper-ink); }
  .grow { flex: 1; }
</style>
