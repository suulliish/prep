<script lang="ts">
  // «Еске түсір»: утреннее вспоминание правила темы по расписанию (docs/GAME_LOOP.md 21, research learn-research 1.1–1.3, 3.2).
  // На каждую тему (до 3 в день): правило собирается из слов-кирпичиков без подсказки → уверенность до показа → сверка с подсветкой разницы → одна задача темы.
  // Лестница подсказок, если не вышло: первое слово → скелет → правило показано и возврат завтра (не засчитывается).
  import { onMount, tick } from 'svelte';
  import Screen from '../ui/Screen.svelte';
  import Bit from '../ui/Bit.svelte';
  import Icon from '../ui/Icon.svelte';
  import { game, go, persist } from '../lib/store.svelte';
  import { W } from '../lib/world.svelte';
  import { audio } from '../lib/audio';
  import { ReadGate, readMs } from '../lib/readgate.svelte';
  import { trackExit } from '../lib/track.svelte';
  import { due, record, noteTask, daysToNext } from '../engine/recall';
  import { ruleLines, hasRule, makeBoard, assemble, isRight, diff, blanks, type Level } from '../lesson/recallrule';
  import { makeItem, mistakeText, skillTitle, type Item } from '../engine/items';
  import { recordAttempt } from '../engine/progress';
  import { RULES_V } from '../engine/rules';
  import { nb } from '../ui/text';
  import type { Attempt } from '../engine/types';

  const queue = due(game.save, game.day, hasRule);
  const letters = ['A', 'B', 'C', 'D', 'E'];

  let qi = $state(0);
  let phase = $state<'brick' | 'conf' | 'cmp' | 'task' | 'res' | 'end'>(queue.length ? 'brick' : 'end');
  // 0 пусто, 1 первое слово, 2 скелет, 3 правило показано
  let level = $state<0 | 1 | 2 | 3>(0);
  // пропуск без чтения закрыт (решение семьи 02.10): после сравнения с правилом и после неверного ответа на задачу
  // кнопка «дальше» заряжается на время чтения; «Есімде жоқ» после подсказки открывается через DUNNO_MS — подсказку надо увидеть
  const gate = new ReadGate();
  const DUNNO_MS = 2500;
  let dunnoWait = $state(false), dunnoT = 0;
  onMount(() => () => { gate.stop(); clearTimeout(dunnoT); });
  let picks = $state<number[]>([]);
  let conf = $state<1 | 2 | 3 | null>(null);
  let pending = $state<(string | null)[]>([]);
  let shown = $state<(string | null)[]>([]);
  let outcome = $state<{ ok: boolean; hint: 0 | 1 | 2 | 3 } | null>(null);
  let note = $state('');
  let item = $state<Item | null>(null);
  let picked = $state<number | null>(null);
  let taskAt = 0;
  const results = $state<{ skill: string; ok: boolean; hint: number; task: boolean | null }[]>([]);

  const skill = $derived(queue[qi] ?? '');
  const title = $derived(skill ? skillTitle(skill).kz : '');
  const lines = $derived(skill ? ruleLines(skill) ?? [] : []);
  const board = $derived(level < 3 && lines.length ? makeBoard(lines, level as Level, `${skill}:${game.day}:${level}`) : null);
  const target = $derived(board?.target ?? makeBoard(lines.length ? lines : ['-'], 0, 'x').target);
  const slots = $derived.by(() => {
    if (!board) return [] as { t: string; fixed: boolean; pick: number }[];
    if (board.open) return [
      ...board.preset.filter((x): x is string => x !== null).map(t => ({ t, fixed: true, pick: -1 })),
      ...picks.map(i => ({ t: board.pile[i], fixed: false, pick: i })),
    ];
    let k = 0;
    return board.preset.map(x => (x !== null ? { t: x, fixed: true, pick: -1 } : k < picks.length ? { t: board.pile[picks[k]], fixed: false, pick: picks[k++] } : { t: '', fixed: false, pick: -1 }));
  });
  const full = $derived(!!board && !board.open && picks.length >= blanks(board));
  const answerWords = $derived(board ? assemble(board, picks.map(i => board.pile[i])) : []);
  const cmp = $derived(diff(target, shown));

  onMount(() => { W.dim = true; audio.setMood('focus'); });

  const SAY = {
    ask: (t: string) => `«${t}» ережесін өз сөзіңмен еске түсір. Сөздерді ретімен қой. Артық сөздер де бар, абай бол!`,
    wrong1: 'Әлі емес. Міне, бірінші сөзі тұр. Жалғастыр!',
    wrong2: 'Әлі емес. Мына жерлерде сөздер тұр, бос орындарды толтыр.',
    dunno1: 'Жарайды! Бірінші сөзін қойдым. Қалғанын өзің тап.',
    dunno2: 'Ештеңе етпейді! Ережеден жарты сөз қалдырдым, бос орындарды толтыр.',
    conf: 'Жауапты көрсетпес бұрын айт: өз жауабыңа қаншалықты сенімдісің?',
    okClean: 'Дәл солай! Ереже есіңде.',
    okHint: 'Көмекпен шықты. Ертең тағы қарап шығамыз.',
    shown: 'Ереже міне. Ертең қайтадан көреміз, бұл қалыпты.',
    wrongEnd: 'Ереже міне. Айырмашылығын қара: қай сөз бөлек тұр. Ертең қайта көреміз.',
    task: 'Енді осы тақырыптан бір есеп шығар.',
    right: 'Дұрыс!',
    solve: 'Шешуін оқы да, жалғастыр.',
  };
  const bitText = $derived(
    phase === 'brick' ? (level === 0 ? (note || SAY.ask(title)) : note)
    : phase === 'conf' ? SAY.conf
    : phase === 'cmp' ? (outcome?.ok ? (outcome.hint === 0 ? SAY.okClean : SAY.okHint) : outcome?.hint === 3 && !shown.length ? SAY.shown : SAY.wrongEnd)
    : phase === 'task' ? SAY.task
    : phase === 'res' ? (picked === item?.answer ? SAY.right : (picked !== null && item ? mistakeText(item.choices[picked].tag).kz : SAY.solve))
    : '',
  );
  const bitMood = $derived<'idle' | 'happy' | 'think' | 'sad'>(
    phase === 'cmp' ? (outcome?.ok ? 'happy' : 'think') : phase === 'res' ? (picked === item?.answer ? 'happy' : 'think') : 'idle',
  );

  let root = $state<HTMLElement>();
  $effect(() => { void phase; void level; void qi; tick().then(() => root?.parentElement?.scrollTo({ top: 0 })); });

  function place(i: number) {
    if (phase !== 'brick' || picks.includes(i) || full) return;
    audio.play('click'); picks.push(i);
  }
  function unplace(i: number) {
    if (phase !== 'brick') return;
    audio.play('click'); picks = picks.filter(p => p !== i);
  }
  function climb(text: string) {
    level = (level + 1) as 1 | 2 | 3;
    picks = [];
    note = text;
    dunnoWait = true; clearTimeout(dunnoT); dunnoT = window.setTimeout(() => (dunnoWait = false), DUNNO_MS);
  }
  function submit() {
    if (!board || !picks.length) return;
    pending = answerWords;
    if (conf === null) { phase = 'conf'; return; }
    judge(pending);
  }
  function pickConf(c: 1 | 2 | 3) {
    audio.play('click'); conf = c; phase = 'brick'; judge(pending);
  }
  function judge(ans: (string | null)[]) {
    if (isRight(target, ans)) return finish(true, level as 0 | 1 | 2, ans);
    audio.play('wrong');
    if (level === 0) return climb(SAY.wrong1);
    if (level === 1) return climb(SAY.wrong2);
    finish(false, 3, ans);
  }
  function dunno() {
    if (phase !== 'brick' || dunnoWait) return;
    audio.play('hint');
    if (conf === null) conf = 1;
    if (level === 0) return climb(SAY.dunno1);
    if (level === 1) return climb(SAY.dunno2);
    finish(false, 3, []);
  }
  function finish(ok: boolean, hint: 0 | 1 | 2 | 3, ans: (string | null)[]) {
    const c = conf ?? 1;
    record(game.save, skill, game.day, { ok, hint, conf: c });
    if (ok && hint === 0) { game.save.xp += 3; audio.play('correct'); } else if (ok) audio.play('correct');
    persist();
    outcome = { ok: ok && hint < 3, hint };
    shown = ans;
    phase = 'cmp';
    gate.start(readMs(target.join(' ')), false);
  }
  function toTask() {
    if (gate.on) { gate.nope(); audio.play('click'); return; }
    audio.play('click');
    item = makeItem(skill);
    picked = null;
    if (!item) return next(null);
    taskAt = Date.now();
    phase = 'task';
  }
  function answer(i: number) {
    if (phase !== 'task' || !item) return;
    picked = i;
    const ok = i === item.answer, ms = Date.now() - taskAt;
    const a: Attempt = { at: Date.now(), day: game.day, skill, source: item.source, correct: ok, hintLevel: 0, honest: ms >= 5000, timeMs: ms, mode: 'recall', r: RULES_V, ...(ok ? {} : { tag: item.choices[i].tag }) };
    recordAttempt(game.save, a);
    noteTask(game.save, skill, ok);
    persist();
    audio.play(ok ? 'correct' : 'wrong');
    phase = 'res';
    if (!ok) gate.start(readMs(item.sol.kz, mistakeText(item.choices[i].tag).kz), false);
  }
  function next(taskOk: boolean | null = picked === null || !item ? null : picked === item.answer) {
    if (phase === 'res' && gate.on) { gate.nope(); audio.play('click'); return; }
    gate.stop();
    audio.play('click');
    results.push({ skill, ok: !!outcome?.ok, hint: outcome?.hint ?? 3, task: taskOk });
    if (qi + 1 >= queue.length) { phase = 'end'; return; }
    qi++; level = 0; picks = []; conf = null; pending = []; shown = []; outcome = null; note = ''; item = null; picked = null; phase = 'brick';
  }
  const nextText = () => {
    const st = game.save.recall?.[skill];
    if (!st) return '';
    const n = daysToNext(st, game.day);
    return n === 1 ? 'Келесі қайталау: ертең' : `Келесі қайталау: ${n} күннен кейін`;
  };
  const chunk = (c: string) => nb(c);
</script>

<Screen scene="none" title="Еске түсір" sub={phase === 'end' ? '' : `${Math.min(qi + 1, queue.length)} / ${queue.length} · ${title}`} back={() => { if (phase !== 'end') trackExit('recall'); go({ name: 'hub' }); }}>
  <div class="rc" bind:this={root}>
    {#if phase === 'end'}
      <Bit text={queue.length ? `Жарайсың! ${results.filter(r => r.ok && r.hint === 0).length} тақырып қатесіз еске түсті.` : 'Бүгін еске түсіретін тақырып жоқ. Жолың ашық!'} mood="happy" compact />
      {#if results.length}
        <ul class="sum">
          {#each results as r}
            <li class:good={r.ok && r.hint === 0} class:mid={r.ok && r.hint > 0}>
              <span class="mk"><Icon name={r.ok ? 'check' : 'cross'} fill="#fff" size={18} /></span>
              <b>{skillTitle(r.skill).kz}</b>
              <small>{r.ok && r.hint === 0 ? 'Қатесіз' : r.ok ? 'Көмекпен' : 'Ертең тағы'}</small>
            </li>
          {/each}
        </ul>
      {/if}
    {:else}
      <Bit text={bitText} mood={bitMood} compact />

      {#if phase === 'brick' || phase === 'conf'}
        <div class="work">
        <div class="paper tray" class:skel={board && !board.open} aria-label="Ереже">
          {#if slots.length === 0}<span class="ph">Сөздерді осында қой</span>{/if}
          {#each slots as s}
            {#if s.fixed}<span class="w fixed">{s.t}</span>
            {:else if s.t}<button class="w placed" disabled={phase === 'conf'} onclick={() => unplace(s.pick)}>{s.t}</button>
            {:else}<span class="w blank">…</span>{/if}
          {/each}
        </div>
        {#if board}
          <div class="pile" role="group" aria-label="Сөздер">
            {#each board.pile as w, i}<button class="brick" class:used={picks.includes(i)} disabled={phase === 'conf' || picks.includes(i) || full} onclick={() => place(i)}>{w}</button>{/each}
          </div>
        {/if}
        {#if level > 0}<p class="lad">Көмек {level}/2</p>{/if}
        </div>
      {:else if phase === 'cmp'}
        <div class="cmpgrid">
        {#if shown.length}
          <div class="paper cmpbox">
            <small>Сенің жауабың</small>
            <p>{#each shown as w, i}<span class="cw" class:bad={!cmp.answer[i]}>{w ?? '…'}</span>{/each}</p>
          </div>
        {/if}
        <div class="paper cmpbox ruleb">
          <small>Дұрыс ереже</small>
          <p>{#each target as w, i}<span class="cw" class:miss={shown.length > 0 && !cmp.target[i]}>{w}</span>{/each}</p>
        </div>
        <div class="verdict" class:good={outcome?.ok && outcome.hint === 0} class:mid={outcome?.ok && (outcome?.hint ?? 0) > 0}>
          <span class="mk"><Icon name={outcome?.ok ? 'check' : 'cross'} fill="#fff" size={20} /></span>
          <b>{outcome?.ok ? (outcome.hint === 0 ? 'Қатесіз' : 'Көмекпен') : 'Әзірге емес'}</b>
          <small>{nextText()}</small>
        </div>
        </div>
      {:else if item}
        <div class="paper q">
          <p>{#each nb(item.kz).split('\n') as ln, k}{#if k}<br />{/if}{ln}{/each}</p>
          {#if item.figure?.svg}<div class="fig">{@html item.figure.svg}</div>{/if}
        </div>
        <div class="choices">
          {#each item.choices as c, i}
            <button class="ans" class:right={phase === 'res' && i === item.answer} class:wrong={phase === 'res' && picked === i && i !== item.answer} disabled={phase === 'res'} onclick={() => answer(i)}>
              <span class="l">{#if phase === 'res' && i === item.answer}<Icon name="check" fill="#fff" size={16} />{:else if phase === 'res' && picked === i}<Icon name="cross" fill="#fff" size={16} />{:else}{letters[i]}{/if}</span>
              <span class="ct">{chunk(c.text)}</span>
            </button>
          {/each}
        </div>
        {#if phase === 'res'}<details class="paper sol" open><summary>Шешуі</summary><p>{item.sol.kz}</p></details>{/if}
      {/if}
    {/if}
  </div>

  {#snippet footer()}
    {#if phase === 'end'}
      <button class="btn primary big grow" onclick={() => go({ name: 'hub' })}>Кемеге<Icon name="chevron" fill="var(--outline)" size={20} /></button>
    {:else if phase === 'brick'}
      <button class="btn ghost grow" disabled={dunnoWait} onclick={dunno}>Есімде жоқ</button>
      <button class="btn primary grow" class:wait={!picks.length || (!!board && !board.open && !full)} disabled={!picks.length || (!!board && !board.open && !full)} onclick={submit}>Дайын</button>
    {:else if phase === 'conf'}
      <button class="btn c3" onclick={() => pickConf(3)}>Сенімдімін</button>
      <button class="btn c3" onclick={() => pickConf(2)}>Шамамен</button>
      <button class="btn c3" onclick={() => pickConf(1)}>Білмеймін</button>
    {:else if phase === 'cmp'}
      <button class="btn primary big grow" class:charging={gate.on} class:charged={gate.done} style="--gate:{gate.ms}ms" onclick={toTask}>Есепке өту<Icon name="chevron" fill="var(--outline)" size={20} /></button>
    {:else if phase === 'res'}
      <button class="btn big grow {picked === item?.answer ? 'go' : 'primary'}" class:charging={gate.on} class:charged={gate.done} style="--gate:{gate.ms}ms" onclick={() => next()}>{qi + 1 >= queue.length ? 'Аяқтау' : 'Келесі тақырып'}<Icon name="chevron" fill="var(--outline)" size={20} /></button>
    {/if}
  {/snippet}
</Screen>

<style>
  .rc { display: grid; gap: 12px; align-content: start; animation: pop-in .3s var(--ease-out) both; }
  .grow { flex: 1; min-width: 0; }
  .c3 { flex: 1; min-width: 0; padding-inline: 6px; font-size: 15px; }

  /* лоток: лист в клетку, куда кладутся кирпичики */
  .tray { display: flex; flex-wrap: wrap; gap: 6px; align-content: flex-start; min-height: 84px; padding: 12px;
    background-image: linear-gradient(#c9d3f588 1px, transparent 1px), linear-gradient(90deg, #c9d3f588 1px, transparent 1px); background-size: 18px 18px; background-color: var(--paper); }
  .ph { color: var(--paper-dim); font: 700 14px var(--txt); align-self: center; }
  .w { display: inline-flex; align-items: center; min-height: 40px; padding: 4px 10px; border-radius: 10px; font: 800 16px var(--txt); border: 3px solid var(--outline); color: var(--paper-ink); }
  .w.fixed { background: #dfe7ff; border-style: solid; }
  .w.placed { background: #fff; box-shadow: inset 0 -3px 0 var(--paper-2), 0 2px 0 var(--outline); cursor: pointer; }
  .w.placed:active { transform: translateY(2px); }
  .w.blank { min-width: 44px; justify-content: center; color: var(--paper-dim); border-style: dashed; background: transparent; }

  .pile { display: flex; flex-wrap: wrap; gap: 8px; }
  .brick { min-height: 44px; padding: 4px 12px; font: 800 16px var(--txt); color: var(--paper-ink); background: var(--paper); border: 3px solid var(--outline); border-radius: 12px;
    box-shadow: inset 0 -3px 0 var(--paper-2), 0 3px 0 var(--outline); cursor: pointer; }
  .brick:active { transform: translateY(2px); }
  .brick.used { opacity: .25; box-shadow: none; }
  .brick:disabled { cursor: default; }
  .lad { margin: 0; justify-self: end; color: var(--dim); font: 800 12px var(--txt); }

  .work, .cmpgrid { display: grid; gap: 12px; }
  .cmpbox { display: grid; gap: 6px; }
  .cmpbox small { font: 800 12px var(--txt); text-transform: uppercase; letter-spacing: .04em; }
  .cmpbox p { margin: 0; display: flex; flex-wrap: wrap; gap: 4px 6px; font: 800 17px/1.3 var(--txt); }
  .cw { padding: 1px 4px; border-radius: 6px; }
  .cw.bad { background: #ffe0d6; color: #b33a1c; text-decoration: line-through; text-decoration-thickness: 2px; }
  .cw.miss { background: #fff1bf; box-shadow: inset 0 -3px 0 var(--gold); }
  .ruleb { border-left: 6px solid var(--ok); }

  .verdict, .sum li { display: flex; align-items: center; gap: 10px; padding: 8px 12px; border-radius: 14px; background: var(--deep); border: 3px solid var(--outline); }
  .verdict b, .sum b { font: 800 16px var(--disp); }
  .verdict small, .sum small { margin-left: auto; color: var(--dim); font: 700 13px var(--txt); text-align: right; }
  .mk { flex: none; width: 30px; height: 30px; display: grid; place-items: center; border-radius: 50%; background: var(--miss); border: 2px solid var(--outline); }
  .good .mk { background: var(--ok); }
  .mid .mk { background: var(--gold); }
  .sum { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }

  .q p { margin: 0; font: 800 clamp(17px, 4.8vw, 21px)/1.35 var(--disp); }
  .fig { margin-top: 8px; max-height: 160px; display: grid; place-items: center; }
  .fig :global(svg) { max-width: 100%; max-height: 160px; }
  .choices { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
  .choices .ans { min-width: 0; min-height: 48px; padding: 6px 10px; gap: 8px; font-size: clamp(15px, 4.4vw, 19px); }
  .choices .ans:last-child:nth-child(odd) { grid-column: 1 / -1; }
  .ct { min-width: 0; overflow-wrap: anywhere; }
  .sol { margin: 0; }
  .sol summary { font-weight: 800; }
  .sol p { margin: 6px 0 0; }
  /* телефон в горизонтали: лоток слева, кучка справа; сверка в два столбца */
  @media (max-height: 460px) and (min-width: 640px) {
    .work { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); align-items: start; gap: 10px; }
    .work .lad { grid-column: 1 / -1; }
    .cmpgrid { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 8px; align-items: start; }
    .cmpgrid .verdict { grid-column: 1 / -1; }
    .cmpgrid .verdict { padding: 4px 10px; }
  }
  @media (max-height: 460px) { .w, .brick { min-height: 36px; font-size: 15px; } .tray { min-height: 64px; padding: 8px; } .rc { gap: 8px; } }
</style>
