<script lang="ts">
  // «Дәптер» после урока (docs/GAME_LOOP.md 21): бумажная тетрадь, а не конспект с экрана. Ребёнок закрывает урок и пишет на бумаге
  // карточку из четырёх полей (правило своими словами · мой пример · ловушка Глитча · схема), потом сверяет с правилом и правит красной ручкой.
  // «Менің мысалым» вводится в игру: где можно, игра проверяет вычислением (src/lesson/notebook.ts).
  // Подключение: <NotebookCard skill={id} onclose={() => …} />. Сам ставит тему на возвраты «Еске түсір» и пишет save.notebook[skill].
  import { onMount } from 'svelte';
  import Bit from '../ui/Bit.svelte';
  import Icon from '../ui/Icon.svelte';
  import { game, persist, skillDefs } from '../lib/store.svelte';
  import { audio } from '../lib/audio';
  import { ReadGate } from '../lib/readgate.svelte';
  import { enroll } from '../engine/recall';
  import { fieldsFor, exampleSpec, checkExample } from './notebook';

  let { skill, onclose }: { skill: string; onclose: () => void } = $props();

  const f = $derived(fieldsFor(skill));
  const spec = $derived(exampleSpec(skill));
  const title = $derived(skillDefs.find(d => d.id === skill)?.title.kz ?? '');

  let phase = $state<'write' | 'check'>('write');
  let example = $state('');
  let exMsg = $state('');
  let exOk = $state<boolean | null>(null);
  let checked = $state(false);
  // кнопка внизу («Жаздым», потом «Дайын» на том же месте) заряжается: на письме WRITE_MS (время переписать правило в тетрадь), на сверке CHECK_MS.
  // Касание раньше — кнопка качается, на письме ещё и мягкая подсказка (своя, а не общий тост: тот лежит под этим окном).
  const WRITE_MS = 25000, CHECK_MS = 3000;
  const gate = new ReadGate();
  let tip = $state(''), tipT = 0, btn = $state<HTMLElement>();
  function nope(say = '') {
    btn?.classList.remove('nope'); void btn?.offsetWidth; btn?.classList.add('nope');
    audio.play('click');
    if (say) { tip = say; clearTimeout(tipT); tipT = window.setTimeout(() => (tip = ''), 2600); }
  }

  onMount(() => {
    gate.start(WRITE_MS, false);
    enroll(game.save, skill, game.day);
    game.save.notebook ??= {};
    const cur = game.save.notebook[skill];
    if (!cur) game.save.notebook[skill] = { day: game.day };
    else if (cur.example) { example = cur.example; exOk = cur.exampleOk ?? null; }
    persist();
    return () => { gate.stop(); clearTimeout(tipT); };
  });

  function saveExample() {
    const r = checkExample(skill, example);
    exMsg = r.say; exOk = r.ok; checked = true;
    const e = game.save.notebook?.[skill];
    if (e) { e.example = example.trim(); e.exampleOk = spec ? r.ok : null; persist(); }
    return r;
  }
  function test() {
    const r = saveExample();
    audio.play(r.ok === true ? 'correct' : r.ok === false ? 'wrong' : 'click');
  }
  function wrote() {
    if (gate.on) return nope('Алдымен дәптеріңе жаз');
    audio.play('click');
    if (example.trim() && !checked) saveExample();
    const e = game.save.notebook?.[skill];
    if (e) { e.wrote = true; persist(); }
    phase = 'check'; tip = '';
    gate.start(CHECK_MS, false);
  }
  function close() { if (gate.on) return nope(); audio.play('click'); onclose(); }
</script>

{#if f}
  <div class="nb-scrim" role="dialog" aria-modal="true" aria-label="Дәптер">
    <div class="nb panel">
      <div class="head">
        <Bit compact mood={phase === 'write' ? 'idle' : 'happy'}
          text={phase === 'write' ? 'Дәптеріңді аш! Экранға қарамай жаз:' : 'Енді жазғаныңды тексер. Қызыл қаламмен түзет, өшірме!'} />
      </div>
      <div class="body">
        <span class="tag topic">{title}</span>
        {#if phase === 'write'}
          <section class="paper fld">
            <b><i class="n">1</i>Ереже өз сөзіңмен</b>
            <p class="skel">{f.skeleton}</p>
            <small>1–2 сөйлем. Қарамай, есіңде қалғанын жаз.</small>
          </section>
          <section class="paper fld">
            <b><i class="n">2</i>Менің мысалым</b>
            <p>{spec ? spec.ask : 'Өз мысалыңды ойлап тап. Шешімін қағазға жаз, мұнда қысқаша енгіз.'}</p>
            <div class="exrow">
              <input bind:value={example} maxlength="60" placeholder={spec ? spec.ph : 'Менің мысалым…'} aria-label="Менің мысалым"
                oninput={() => { checked = false; exMsg = ''; exOk = null; }} onkeydown={(e) => { e.stopPropagation(); if (e.key === 'Enter') test(); }} />
              {#if spec}<button class="btn small" disabled={!example.trim()} onclick={test}>Тексер</button>{/if}
            </div>
            {#if exMsg}<p class="exmsg" class:good={exOk === true} class:bad={exOk === false}>{exMsg}</p>{/if}
          </section>
          <section class="paper fld">
            <b><i class="n">3</i>Глитчтің қақпаны</b>
            {#if f.trap}<p>Глитч былай жазды: <em>«{f.trap.bad}»</em></p>{/if}
            <p class="skel">Қате осында, себебі …</p>
            <small>Қағазға жаз: қай жерде, неге жұмыс істемейді.</small>
          </section>
          <section class="paper fld">
            <b><i class="n">4</i>Сызба</b>
            <p>Шамалардың байланысын сыз: жолақ, сан түзуі немесе қадамдар. Заттардың суретін салма.</p>
          </section>
        {:else}
          <section class="paper fld">
            <b><i class="n">1</i>Ереже</b>
            {#each f.ruleLines as l}<p>★ {l}</p>{/each}
          </section>
          {#if example.trim()}
            <section class="paper fld">
              <b><i class="n">2</i>Менің мысалым</b>
              <p><em>{example}</em></p>
              {#if exMsg}<p class="exmsg" class:good={exOk === true} class:bad={exOk === false}>{exMsg}</p>{/if}
            </section>
          {/if}
          {#if f.trap}
            <section class="paper fld">
              <b><i class="n">3</i>Глитчтің қақпаны</b>
              <p>{f.trap.fix}</p>
            </section>
          {/if}
          <p class="red"><Icon name="check" fill="var(--miss)" size={18} />Түзетуді қызыл қаламмен жаз. Ескі жазуды өшірме: қатеңнен үйренесің.</p>
        {/if}
      </div>
      <div class="foot">
        {#if tip}<div class="tip" role="status">{tip}</div>{/if}
        {#if phase === 'write'}
          <button bind:this={btn} class="btn primary big block" class:charging={gate.on} class:charged={gate.done} style="--gate:{gate.ms}ms" onclick={wrote}><Icon name="book" fill={gate.on ? '#d7dcf5' : 'var(--outline)'} size={22} />Жаздым</button>
        {:else}
          <button bind:this={btn} class="btn go big block" class:charging={gate.on} class:charged={gate.done} style="--gate:{gate.ms}ms" onclick={close}>Дайын<Icon name="chevron" fill={gate.on ? '#d7dcf5' : 'var(--outline)'} size={20} /></button>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .nb-scrim { position: fixed; inset: 0; z-index: calc(var(--z-modal) + 3); display: grid; place-items: center; padding: calc(env(safe-area-inset-top, 0px) + 8px) 10px calc(env(safe-area-inset-bottom, 0px) + 8px);
    background: #050713cc; animation: nb-fade .25s ease-out both; }
  .nb { width: min(560px, 100%); max-height: 100%; display: flex; flex-direction: column; padding: 0; overflow: hidden; }
  .head { flex: none; padding: 10px 12px 4px; }
  .body { flex: 1 1 auto; min-height: 0; overflow-y: auto; overscroll-behavior: contain; padding: 6px 12px 12px; display: grid; grid-template-columns: minmax(0, 1fr); gap: 10px; align-content: start; }
  .foot { position: relative; flex: none; padding: 10px 12px 12px; border-top: 3px solid var(--outline); background: linear-gradient(180deg, #1a2f96, var(--panel-2)); }
  .tip { position: absolute; left: 12px; right: 12px; bottom: 100%; margin-bottom: 8px; padding: 10px 14px; text-align: center; font: 800 var(--fs-s) var(--txt); color: var(--outline);
    background: var(--gold); border: 3px solid var(--outline); border-radius: 14px; box-shadow: 0 4px 0 var(--outline); pointer-events: none; animation: nb-tip .25s var(--ease-out) both; }
  @keyframes nb-tip { from { opacity: 0; transform: translateY(8px); } }
  .topic { justify-self: start; background: var(--crystal); }

  /* лист в клетку */
  .fld { display: grid; grid-template-columns: minmax(0, 1fr); gap: 6px; padding: 12px; min-width: 0; overflow-wrap: anywhere;
    background-image: linear-gradient(#c9d3f577 1px, transparent 1px), linear-gradient(90deg, #c9d3f577 1px, transparent 1px); background-size: 18px 18px; background-color: var(--paper); }
  .fld b { display: flex; align-items: center; gap: 8px; font: 900 17px var(--disp); color: var(--paper-ink); }
  .fld p { margin: 0; font: 700 15px/1.45 var(--txt); color: var(--paper-ink); }
  .fld small { color: var(--paper-dim); font: 700 13px var(--txt); }
  .n { flex: none; width: 26px; height: 26px; display: grid; place-items: center; font: 900 14px var(--disp); font-style: normal; color: var(--outline); background: var(--gold); border: 2px solid var(--outline); border-radius: 50%; }
  .skel { border-bottom: 2px dashed var(--paper-dim); padding-bottom: 4px; color: var(--paper-dim); font-weight: 800; }
  .fld em { font-style: normal; font-weight: 800; background: #ffe0d6; padding: 0 4px; border-radius: 4px; }
  .exrow { display: flex; gap: 8px; }
  .exrow input { flex: 1; min-width: 0; font: 800 17px var(--txt); padding: 8px 12px; min-height: 48px; border: 3px solid var(--outline); border-radius: 12px; background: #fff; color: var(--paper-ink); }
  .exrow input:focus-visible { outline: 3px solid var(--code); outline-offset: 2px; }
  .exrow .btn { flex: none; }
  .fld .exmsg { padding: 6px 10px; border-radius: 10px; background: var(--paper-2); }
  .fld .exmsg.good { background: #c9f7d8; }
  .fld .exmsg.bad { background: #ffe0d6; }
  .red { margin: 0; display: flex; gap: 8px; align-items: center; color: var(--ink); font: 800 14px/1.35 var(--txt); }
  @keyframes nb-fade { from { opacity: 0; } }
  @media (max-height: 460px) and (min-width: 640px) {
    .nb { width: min(780px, 100%); }
    .body { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .body .topic, .body .red { grid-column: 1 / -1; }
  }
  @media (max-height: 460px) { .head { padding: 6px 10px 2px; } .body { padding: 4px 10px 8px; gap: 6px; } .fld { padding: 8px 10px; gap: 4px; } .foot { padding: 6px 10px 8px; } }
</style>
