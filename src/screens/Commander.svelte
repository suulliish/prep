<script lang="ts">
  // Экран брата («Командир корабля»), на русском, под PIN. Вкладки — src/screens/commander/*.svelte (K0, 02.10);
  // общие стили вкладок — здесь (:global внутри .wrap).
  import { onMount } from 'svelte';
  import { game, go, persist, hashPin } from '../lib/store.svelte';
  import { W } from '../lib/world.svelte';
  import { audio } from '../lib/audio';
  import type { CloudMod } from './commander/util';
  import Today from './commander/Today.svelte';
  import Stats from './commander/Stats.svelte';
  import Answers from './commander/Answers.svelte';
  import RecallTab from './commander/RecallTab.svelte';
  import Settings from './commander/Settings.svelte';
  import Skills from './commander/Skills.svelte';
  import Kz from './commander/Kz.svelte';
  import Ai from './commander/Ai.svelte';
  import Data from './commander/Data.svelte';

  let unlocked = $state(false);
  let pin = $state('');
  let pinErr = $state('');
  let tab = $state<'today' | 'stats' | 'answers' | 'recall' | 'settings' | 'skills' | 'kz' | 'ai' | 'data'>('today');
  const hasPin = !!game.save.settings.pin;
  // облако грузится лениво (Firebase — отдельный кусок сайта)
  let C = $state<CloudMod | null>(null);
  onMount(() => { import('../lib/cloud.svelte').then(m => (C = m)).catch(() => {}); });
  const cloudOk = $derived(!!C?.cloud.user && C.cloud.status !== 'error');

  onMount(() => { W.dim = true; audio.setMood('focus'); });

  async function enter() {
    if (!/^\d{4}$/.test(pin)) { pinErr = 'PIN — 4 цифры'; return; }
    const h = await hashPin(pin);
    if (!hasPin) { game.save.settings.pin = h; persist(); unlocked = true; return; }
    if (h === game.save.settings.pin) unlocked = true; else { pinErr = 'Неверный PIN'; pin = ''; }
  }
  // командир открывает вкладку на своём устройстве: если вошёл в облако, подтягиваем свежие ответы (один раз за вход в раздел)
  let ansSynced = false;
  $effect(() => { if ((tab === 'stats' || tab === 'answers') && !ansSynced && C?.cloud.user) { ansSynced = true; void C.syncNow(); } });
</script>

<div class="wrap">
  <div class="top panel">
    <button class="btn ghost small" onclick={() => go({ name: 'hub' })}>←</button>
    <b class="t">Командир корабля</b>
  </div>

  {#if !unlocked}
    <section class="panel card">
      <p>{hasPin ? 'Введите PIN командира.' : 'Придумайте PIN из 4 цифр. Он защищает настройки от младшего брата.'}</p>
      <input id="pin" class="pin" type="password" inputmode="numeric" maxlength="4" bind:value={pin} onkeydown={(e) => e.key === 'Enter' && enter()} aria-label="PIN" />
      {#if pinErr}<p class="err">{pinErr}</p>{/if}
      <button class="btn primary" onclick={enter}>{hasPin ? 'Войти' : 'Сохранить PIN'}</button>
    </section>
  {:else}
    <nav class="tabs panel">
      {#each [['today', 'Сегодня'], ['stats', 'Аналитика'], ['answers', 'Ответы'], ['recall', 'Повторы'], ['settings', 'Настройки'], ['skills', 'Темы'], ['kz', 'Казахский текст'], ['ai', 'Вопросы к ИИ'], ['data', 'Данные']] as [id, name]}
        <button class="tab" class:on={tab === id} onclick={() => (tab = id as any)}>{name}</button>
      {/each}
    </nav>

    {#if tab === 'today'}<Today {cloudOk} />
    {:else if tab === 'stats'}<Stats />
    {:else if tab === 'answers'}<Answers />
    {:else if tab === 'recall'}<RecallTab />
    {:else if tab === 'settings'}<Settings onlock={() => (unlocked = false)} />
    {:else if tab === 'skills'}<Skills />
    {:else if tab === 'kz'}<Kz />
    {:else if tab === 'ai'}<Ai />
    {:else}<Data {C} />
    {/if}
  {/if}
</div>

<style>
  .wrap { min-height: 100dvh; width: min(720px, 100%); margin: 0 auto; display: grid; align-content: start; gap: 10px; padding: calc(env(safe-area-inset-top, 0px) + 12px) 16px 24px; }
  .wrap :global(.col) { display: grid; gap: 8px; }
  .wrap :global(.col input) { font: 600 16px var(--txt); padding: 12px 14px; min-height: 48px; border-radius: 12px; border: 3px solid var(--outline); background: var(--paper); color: var(--paper-ink); }
  .top { display: flex; gap: 12px; align-items: center; padding: 8px 12px; }
  .t { font-size: 20px; }
  .wrap :global(.btn.small) { min-height: 36px; padding: 4px 10px; font-size: var(--fs-s); }
  .wrap :global(.card) { display: grid; gap: 12px; }
  .pin { font: 800 28px var(--txt); letter-spacing: .5em; text-align: center; width: 180px; padding: 10px; background: var(--deep); color: var(--ink); border: 2px solid var(--line-hi); border-radius: 8px; }
  .wrap :global(.err) { color: var(--miss); font-weight: 700; }
  .tabs { display: flex; gap: 4px; padding: 6px; overflow-x: auto; scrollbar-width: none; }
  @media (max-width: 600px) { .tabs { mask-image: linear-gradient(90deg, #000 85%, transparent); } }
  .tab { font: 800 var(--fs-s) var(--txt); color: var(--dim); background: none; border: 0; padding: 8px 12px; border-radius: 6px; cursor: pointer; white-space: nowrap; }
  .tabs .tab.on { color: var(--ink); background: var(--panel-hi); }
  .wrap :global(.grid3) { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 8px; }
  .wrap :global(.kpi) { display: grid; gap: 2px; background: var(--deep); border: 1px solid var(--line); padding: 10px; }
  .wrap :global(.kpi b) { font-size: 24px; }
  .wrap :global(.kpi small) { color: var(--dim); }
  .wrap :global(.flags) { margin: 0; padding-left: 18px; display: grid; gap: 6px; }
  .wrap :global(.flags li) { display: list-item; padding: 0; background: none; color: var(--gold); font-weight: 700; }
  .wrap :global(.warnc) { color: var(--gold); font-weight: 800; }
  .wrap :global(.blocks) { margin: 0; padding-left: 4px; list-style: none; display: grid; gap: 4px; }
  .wrap :global(.blocks li.done) { color: var(--ok); }
  .wrap :global(.note) { color: var(--dim); line-height: 1.5; }
  .wrap :global(.warn) { color: var(--miss); }
  .wrap :global(.card-sub) { background: var(--deep); border: 1px dashed var(--line-hi); padding: 10px 12px; }
  .wrap :global(.card-sub ol) { margin: 6px 0; padding-left: 20px; line-height: 1.6; font-weight: 700; }
  .wrap :global(.card-sub small) { color: var(--dim); }
  .wrap :global(.row) { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
  .wrap :global(.on) { border-color: var(--code); background: #0f5a66; }
  .wrap :global(label) { display: grid; gap: 6px; font-weight: 700; }
  .wrap :global(input[type=number]) { width: 100px; font: 800 20px var(--txt); padding: 8px; background: var(--deep); color: var(--ink); border: 2px solid var(--line-hi); border-radius: 6px; }
  .wrap :global(fieldset) { border: 1px solid var(--line); border-radius: 6px; display: grid; gap: 6px; }
  .wrap :global(fieldset label) { display: flex; gap: 8px; align-items: center; font-weight: 600; }
  .wrap :global(label.check) { display: flex; gap: 8px; align-items: center; }
  .wrap :global(.list ul) { margin: 6px 0; padding: 0; list-style: none; display: grid; gap: 4px; }
  .wrap :global(.list li) { display: flex; justify-content: space-between; gap: 10px; align-items: center; padding: 6px 8px; background: var(--deep); }
  .wrap :global(.list em) { font-style: normal; font-size: var(--fs-s); color: var(--dim); white-space: nowrap; }
  .wrap :global(.list em.learning) { color: var(--gold); } .wrap :global(.list em.learned) { color: var(--code); } .wrap :global(.list em.mastered), .wrap :global(.list em.automatic) { color: var(--crystal); }
  .wrap :global(details summary) { cursor: pointer; font-weight: 800; padding: 6px 0; }
  .wrap :global(.rv) { display: flex; gap: 6px; }
  .wrap :global(.bonus) { color: var(--gold); }
  .wrap :global(.warn) { border-color: var(--gold); display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
  .wrap :global(.warn p) { flex: 1; min-width: 200px; font-weight: 700; }
  .wrap :global(.tblwrap) { overflow-x: auto; }
  .wrap :global(.tbl) { width: 100%; border-collapse: collapse; font-size: var(--fs-s); }
  .wrap :global(.tbl th) { text-align: left; font-size: 12px; color: var(--dim); padding: 4px 8px; white-space: nowrap; }
  .wrap :global(.tbl td) { padding: 6px 8px; background: var(--deep); border-top: 2px solid var(--line); vertical-align: top; }
  .wrap :global(.tbl tr.ok td) { box-shadow: inset 3px 0 0 var(--ok); }
  .wrap :global(.tbl .cells) { white-space: nowrap; }
  .wrap :global(.tbl .cells span) { display: inline-grid; justify-items: center; margin-right: 6px; font-weight: 800; }
  .wrap :global(.tbl .cells i) { font: 700 10px var(--txt); font-style: normal; color: var(--dim); }
  .wrap :global(.h-ok) { color: var(--ok); } .wrap :global(.h-help) { color: var(--gold); } .wrap :global(.h-no) { color: var(--miss); }
  .wrap :global(.daypick) { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  .wrap :global(.daypick select) { font: 700 16px var(--txt); padding: 8px 10px; min-height: 40px; background: var(--deep); color: var(--ink); border: 2px solid var(--line-hi); border-radius: 6px; }
  .wrap :global(.dayhead) { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 10px; margin-top: 6px; }
  .wrap :global(.dayhead small) { color: var(--dim); }
  .wrap :global(.tbl.anslog td) { vertical-align: middle; }
  .wrap :global(.tbl.anslog tr.bad td) { box-shadow: inset 0 0 0 9999px #ff5a6e10; }
  .wrap :global(.tbl.anslog .t) { white-space: nowrap; font-weight: 800; }
  .wrap :global(.tbl.anslog .t.fastc) { color: var(--gold); }
  .wrap :global(.zt) { color: var(--gold); font-size: 12px; }
  .wrap :global(.zl) { margin-left: 6px; }
  .wrap :global(.cloud) { display: grid; gap: 8px; padding: 12px; border: 1px solid var(--line-hi); border-radius: 8px; background: var(--deep); }
  .wrap :global(.devs) { margin: 0; padding-left: 18px; font-size: 13px; }
  .wrap :global(.devs li.old) { color: #ffb36b; }
  .wrap :global(.devs li.me) { font-weight: 700; }
</style>
