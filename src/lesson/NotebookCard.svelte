<script lang="ts">
  // «Дәптер» после урока (docs/GAME_LOOP.md 21): бумажная тетрадь, а не конспект с экрана. Ребёнок закрывает урок и пишет на бумаге
  // карточку из четырёх полей (правило своими словами · мой пример · ловушка Глитча · схема), потом сверяет с правилом и правит красной ручкой.
  // «Менің мысалым» вводится в игру: где можно, игра проверяет вычислением (src/lesson/notebook.ts).
  // После «Жаздым» — фото карточки: Бит проверяет все четыре поля по эталону урока (helper/notebook.mjs) и говорит, что исправить
  // красной ручкой; на сверке рядом с эталоном видны его отметки. Без входа в облако, без сети или если командир выключил — сразу сверка, как раньше.
  // Подключение: <NotebookCard skill={id} onclose={() => …} />. Сам ставит тему на возвраты «Еске түсір» и пишет save.notebook[skill].
  import { onMount } from 'svelte';
  import Bit from '../ui/Bit.svelte';
  import Icon from '../ui/Icon.svelte';
  import { game, persist, skillDefs } from '../lib/store.svelte';
  import { audio } from '../lib/audio';
  import { ReadGate } from '../lib/readgate.svelte';
  import { enroll } from '../engine/recall';
  import { fieldsFor, exampleSpec, checkExample } from './notebook';
  import { checkNotebookPhoto, HELPER_ERR, type HelperError, type NotebookCheck, type NbField, type NbMark } from '../lib/helper';
  import { shrinkPhoto } from '../lib/photo';

  // check — подмена запроса для проверок без сервера; signedIn — без облака (в игре не нужны)
  let { skill, onclose, check = checkNotebookPhoto, signedIn }: { skill: string; onclose: () => void; check?: typeof checkNotebookPhoto; signedIn?: boolean } = $props();

  const f = $derived(fieldsFor(skill));
  const spec = $derived(exampleSpec(skill));
  const title = $derived(skillDefs.find(d => d.id === skill)?.title.kz ?? '');

  let phase = $state<'write' | 'photo' | 'check'>('write');
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

  // облако грузится лениво (Firebase — отдельный кусок сайта), как в TeachBack.svelte
  let C = $state<typeof import('../lib/cloud.svelte') | null>(null);
  const photoOn = $derived(game.save.settings.notebookPhoto !== false && (signedIn ?? !!C?.cloud.user));

  // ---- фото карточки ----
  const MAX_TRIES = 3;
  let busy = $state(false);
  let res = $state<NotebookCheck | null>(null);
  let pErr = $state('');
  let tries = $state(0);
  let alive = true;
  // «Суретсіз тексеру» прячем: появляется после сбоя или через SKIP_AFTER_MS (ребёнок не должен проскакивать проверку)
  const SKIP_AFTER_MS = 40000;
  let late = $state(false), lateT = 0;
  const failed = $derived(!!pErr || (res !== null && !res.readable));
  const MARK: Record<NbMark, { t: string; cls: string }> = { ok: { t: '✓', cls: 'ok' }, partial: { t: '½', cls: 'half' }, wrong: { t: '✗', cls: 'bad' }, missing: { t: '—', cls: 'none' } };
  const LABEL: Record<NbField, string> = { rule: 'Ереже өз сөзіңмен', example: 'Менің мысалым', trap: 'Глитчтің қақпаны', scheme: 'Сызба' };

  async function onPhoto(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';                       // та же карточка ещё раз — снова событие change
    if (!file || busy || tries >= MAX_TRIES) return;
    busy = true; pErr = ''; tries++;
    audio.play('click');
    try {
      const { image, mime } = await shrinkPhoto(file);
      const ent = game.save.notebook?.[skill];
      const r = await check({
        skill, title, ruleLines: f!.ruleLines, trap: f!.trap ? { bad: f!.trap.bad, fix: f!.trap.fix } : null,
        example: ent?.example, exampleOk: ent?.exampleOk, sample: spec?.ph,
      }, image, mime);
      if (!alive) return;
      res = r;
      const marks = Object.fromEntries(Object.entries(r.fields).map(([k, v]) => [k, v.mark]));
      if (ent) { ent.check = { at: Date.now(), readable: r.readable, marks, fix: r.fix, tries }; persist(); }
      const good = r.readable && Object.values(r.fields).every(v => v.mark === 'ok');
      audio.play(!r.readable ? 'wrong' : good ? 'correct' : 'hint');
    } catch (err) {
      if (!alive) return;
      pErr = typeof err === 'string' && err in HELPER_ERR ? HELPER_ERR[err as HelperError] : 'Суретті оқи алмадым. Қайта түсіріп көр.';
    }
    busy = false;
  }
  function toCheck() {
    if (busy) return;
    audio.play('click');
    phase = 'check'; tip = '';
    gate.start(CHECK_MS, false);
  }

  onMount(() => {
    if (signedIn === undefined) import('../lib/cloud.svelte').then(m => (C = m)).catch(() => {});
    gate.start(WRITE_MS, false);
    enroll(game.save, skill, game.day);
    game.save.notebook ??= {};
    const cur = game.save.notebook[skill];
    if (!cur) game.save.notebook[skill] = { day: game.day };
    else if (cur.example) { example = cur.example; exOk = cur.exampleOk ?? null; }
    persist();
    return () => { alive = false; gate.stop(); clearTimeout(tipT); clearTimeout(lateT); };
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
    tip = '';
    if (photoOn) { phase = 'photo'; lateT = window.setTimeout(() => (late = true), SKIP_AFTER_MS); return; }
    phase = 'check';
    gate.start(CHECK_MS, false);
  }
  const bitText = $derived.by(() => {
    if (phase === 'write') return 'Дәптеріңді аш! Экранға қарамай жаз:';
    if (phase === 'photo') {
      if (busy) return 'Оқып жатырмын…';
      if (pErr) return pErr;
      if (!res) return 'Жазғаныңды суретке түсір, мен тексеремін! Төрт бөлім де көрінсін, жарық болсын.';
      if (!res.readable) return res.fix || 'Жазуды көре алмадым. Жақынырақ, жарықта түсір.';
      const all = Object.values(res.fields).every(v => v.mark === 'ok');
      return all ? `${res.praise || 'Бәрі дұрыс!'} Енді эталонмен салыстыр.` : `${res.praise ? res.praise + ' ' : ''}Қызыл қаламмен түзет: ${res.fix}`;
    }
    return res?.readable && res.fix ? `Енді эталонмен салыстыр. Қызыл қаламмен: ${res.fix}` : 'Енді жазғаныңды тексер. Қызыл қаламмен түзет, өшірме!';
  });

  function close() { if (gate.on) return nope(); audio.play('click'); onclose(); }
</script>

<!-- заметка Бита под эталоном на сверке: только где есть что исправить -->
{#snippet note(k: NbField)}
  {#if res?.readable && res.fields[k].mark !== 'ok' && res.fields[k].note}<p class="bitnote">Бит: {res.fields[k].note}</p>{/if}
{/snippet}

{#if f}
  <div class="nb-scrim" role="dialog" aria-modal="true" aria-label="Дәптер">
    <div class="nb panel">
      <div class="head">
        <Bit compact mood={phase === 'write' ? 'idle' : phase === 'photo' && (busy || failed || (res && res.fix)) ? 'think' : 'happy'} text={bitText} />
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
        {:else if phase === 'photo'}
          {#if res?.readable}
            {#each Object.entries(LABEL) as [k, label], i}
              {@const v = res.fields[k as NbField]}
              <section class="paper fld mk">
                <b><i class="n">{i + 1}</i>{label}<span class="mark {MARK[v.mark].cls}">{MARK[v.mark].t}</span></b>
                {#if v.note}<p>{v.note}</p>{/if}
              </section>
            {/each}
          {/if}
          {#if tries < MAX_TRIES && !(res?.readable && Object.values(res.fields).every(v => v.mark === 'ok'))}
            <label class="btn {res ? 'ghost' : 'primary'} big block shot" class:wait={busy} aria-disabled={busy}>
              <Icon name="camera" fill={res ? 'var(--code)' : 'var(--outline)'} size={24} />{busy ? 'Бит оқып жатыр…' : res?.readable ? 'Түзеттім — қайта түсір' : res || pErr ? 'Қайта түсір' : 'Суретке түсір'}
              <input type="file" accept="image/*" capture="environment" hidden disabled={busy} onchange={onPhoto} />
            </label>
          {/if}
          {#if res?.readable}<p class="red"><Icon name="check" fill="var(--miss)" size={18} />Түзетуді қызыл қаламмен жаз. Ескі жазуды өшірме.</p>{/if}
        {:else}
          <section class="paper fld">
            <b><i class="n">1</i>Ереже{#if res?.readable}<span class="mark {MARK[res.fields.rule.mark].cls}">{MARK[res.fields.rule.mark].t}</span>{/if}</b>
            {#each f.ruleLines as l}<p>★ {l}</p>{/each}
            {@render note('rule')}
          </section>
          {#if example.trim() || res?.readable}
            <section class="paper fld">
              <b><i class="n">2</i>Менің мысалым{#if res?.readable}<span class="mark {MARK[res.fields.example.mark].cls}">{MARK[res.fields.example.mark].t}</span>{/if}</b>
              {#if example.trim()}<p><em>{example}</em></p>{/if}
              {#if exMsg}<p class="exmsg" class:good={exOk === true} class:bad={exOk === false}>{exMsg}</p>{/if}
              {@render note('example')}
            </section>
          {/if}
          {#if f.trap}
            <section class="paper fld">
              <b><i class="n">3</i>Глитчтің қақпаны{#if res?.readable}<span class="mark {MARK[res.fields.trap.mark].cls}">{MARK[res.fields.trap.mark].t}</span>{/if}</b>
              <p>{f.trap.fix}</p>
              {@render note('trap')}
            </section>
          {/if}
          {#if res?.readable}
            <section class="paper fld">
              <b><i class="n">4</i>Сызба<span class="mark {MARK[res.fields.scheme.mark].cls}">{MARK[res.fields.scheme.mark].t}</span></b>
              {@render note('scheme')}
            </section>
          {/if}
          <p class="red"><Icon name="check" fill="var(--miss)" size={18} />Түзетуді қызыл қаламмен жаз. Ескі жазуды өшірме: қатеңнен үйренесің.</p>
        {/if}
      </div>
      <div class="foot" class:empty={phase === 'photo' && !res && !failed && !late}>
        {#if tip}<div class="tip" role="status">{tip}</div>{/if}
        {#if phase === 'photo'}
          <!-- дальше — когда Бит ответил или проверить не вышло; до фото — тихий пропуск через 40 с (нет камеры, тетрадь не с собой) -->
          {#if res || failed}
            <button class="btn go big block" disabled={busy} onclick={toCheck}>Эталонмен салыстыр<Icon name="chevron" fill={busy ? '#d7dcf5' : 'var(--outline)'} size={20} /></button>
          {:else if late}
            <button class="btn ghost block skip" disabled={busy} onclick={toCheck}>Суретсіз тексеру</button>
          {/if}
        {:else if phase === 'write'}
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
  .foot.empty { display: none; }
  .fld .bitnote { padding: 6px 10px; border-radius: 10px; background: #ffe0d6; font-weight: 800; }
  .mark { margin-left: auto; flex: none; min-width: 30px; height: 30px; display: grid; place-items: center; padding: 0 6px; font: 900 17px var(--disp); border: 2px solid var(--outline); border-radius: 10px; }
  .mark.ok { background: var(--ok); color: var(--outline); }
  .mark.half { background: var(--gold); color: var(--outline); }
  .mark.bad { background: var(--miss); color: #fff; }
  .mark.none { background: var(--paper-2); color: var(--paper-dim); }
  .shot { display: flex; align-items: center; justify-content: center; gap: 10px; cursor: pointer; }
  .shot[aria-disabled='true'] { pointer-events: none; }
  .skip { min-height: 44px; font-size: var(--fs-s); }
  .red { margin: 0; display: flex; gap: 8px; align-items: center; color: var(--ink); font: 800 14px/1.35 var(--txt); }
  @keyframes nb-fade { from { opacity: 0; } }
  @media (max-height: 460px) and (min-width: 640px) {
    .nb { width: min(780px, 100%); }
    .body { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .body .topic, .body .red { grid-column: 1 / -1; }
  }
  @media (max-height: 460px) { .head { padding: 6px 10px 2px; } .body { padding: 4px 10px 8px; gap: 6px; } .fld { padding: 8px 10px; gap: 4px; } .foot { padding: 6px 10px 8px; } }
</style>
