<script lang="ts">
  // «Ребус»: әріптерге цифр қой. Әріпті бас (немесе ол өзі таңдалады), сосын цифрды бас. Бірдей әріп — бірдей цифр, әртүрлі әріп — әртүрлі цифр,
  // санның бірінші цифры нөл емес. Бағандар өздігінен тексеріледі (✔ / ✘), ойда қалған цифр алтын түспен көрінеді.
  // Теңдік дұрыс болғанда дайын. Қате басу айып емес: тек түсінік.
  import { audio } from '../lib/audio';
  import { lettersOf, columns, evalColumns, tryAssign, isSolved, nextFree, holderOf, COLUMN_NAMES, type Asg } from './letterdigit';

  let { words = ['АБ', 'БА'], sum = 'ВГВ', tip, after, ondone }:
    { words?: string[]; sum?: string; tip?: string; after?: string; ondone?: () => void } = $props();

  // ребус в уроке не меняется, пока виджет открыт: буквы и число столбиков считаем один раз
  // svelte-ignore state_referenced_locally
  const letters = lettersOf(words, sum);
  // svelte-ignore state_referenced_locally
  const C = columns(words, sum).length;
  const COLORS = ['var(--code)', 'var(--gold)', 'var(--glitch)', '#9d8cff', '#5ce39c', '#ff9d4f'];
  const colorOf = (l: string) => COLORS[letters.indexOf(l) % COLORS.length];
  const TIP = 'Бірліктер бағанынан баста: қосындының соңғы цифры қандай болу керек?';

  let asg = $state<Asg>({});
  let sel = $state<string | null>(letters[0]);
  let note = $state('');
  let bad = $state(false);
  let finished = $state(false);
  let showTip = $state(false);
  const timers: ReturnType<typeof setTimeout>[] = [];
  const later = (f: () => void, ms: number) => { timers.push(setTimeout(f, ms)); };
  $effect(() => () => timers.forEach(clearTimeout));

  const cols = $derived(evalColumns(words, sum, asg));
  const shake = (msg: string) => { note = msg; bad = true; audio.play('wrong'); later(() => (bad = false), 400); };

  function pick(l: string) { if (finished) return; sel = l; audio.play('click'); note = ''; }
  function put(d: number) {
    if (finished) return;
    const l = sel ?? nextFree(letters, asg);
    if (!l) return;
    sel = l;
    if (asg[l] === d) { const { [l]: _, ...rest } = asg; asg = rest; audio.play('click'); note = ''; return; }
    const r = tryAssign(words, sum, asg, l, d);
    if (!r.ok) {
      shake(r.reason === 'used' ? `${d} цифры ${r.by} әріпіне берілген. Әртүрлі әріптерге әртүрлі цифрлар!` : `${l} — санның бірінші әрпі, ол нөл бола алмайды.`);
      return;
    }
    asg = r.asg; audio.play('click');
    const cs = evalColumns(words, sum, asg);
    if (isSolved(words, sum, asg)) {
      finished = true; sel = null; showTip = false;
      note = after ?? 'Дайын! Теңдік дұрыс.'; audio.play('correct');
      later(() => ondone?.(), 900);
      return;
    }
    const badAt = cs.findIndex(c => c.status === 'bad');
    if (badAt >= 0) note = `${COLUMN_NAMES[badAt]} бағаны сәйкес келмейді. Ойда қалған цифрды тексер.`;
    else if (letters.every(x => asg[x] !== undefined)) note = 'Соңғы баған сәйкес емес: ең алдыңғы цифрды тексер.';
    else { note = ''; sel = nextFree(letters, asg, l) ?? l; }
  }
  function reset() { if (finished) return; asg = {}; sel = letters[0]; note = ''; audio.play('click'); }

  // ұяшықтар: жол — сөз, позиция солдан оңға
  const cell = (w: string, p: number) => w[p - (C - w.length)];
</script>

<div class="ld" class:bad>
  <div class="top">
  <div class="board" class:done={finished} style="--n:{C + 1}" role="group" aria-label="Ребус">
    <!-- ойда қалған цифр: c-баған үшін c-1 бағаннан келген -->
    <span class="op"></span>
    {#each Array.from({ length: C }, (_, p) => p) as p}
      {@const st = cols[C - 1 - p]}
      <span class="carry">{#if st.carryIn === 1}<b class="num">1</b>{/if}</span>
    {/each}
    {#each words as w, wi}
      <span class="op">{wi === words.length - 1 ? '+' : ''}</span>
      {#each Array.from({ length: C }, (_, p) => p) as p}
        {@const l = cell(w, p)}
        {#if l === undefined}<span class="cell empty"></span>
        {:else}
          <button class="cell" class:sel={sel === l} class:set={asg[l] !== undefined} style="--c:{colorOf(l)}" onclick={() => pick(l)} aria-label={`${l} әрпі`}>
            {#if asg[l] !== undefined}<b class="d num">{asg[l]}</b><i class="l">{l}</i>{:else}<b class="lt">{l}</b>{/if}
          </button>
        {/if}
      {/each}
    {/each}
    <span class="rule"></span>
    <span class="op">=</span>
    {#each Array.from({ length: C }, (_, p) => p) as p}
      {@const l = cell(sum, p)}
      {@const st = cols[C - 1 - p]}
      {#if l === undefined}<span class="cell empty"></span>
      {:else}
        <button class="cell sm" class:sel={sel === l} class:set={asg[l] !== undefined} class:ok={st.status === 'ok'} class:no={st.status === 'bad'} style="--c:{colorOf(l)}" onclick={() => pick(l)} aria-label={`${l} әрпі`}>
          {#if asg[l] !== undefined}<b class="d num">{asg[l]}</b><i class="l">{l}</i>{:else}<b class="lt">{l}</b>{/if}
          {#if st.status === 'ok'}<em class="mk">✔</em>{:else if st.status === 'bad'}<em class="mk x">✘</em>{/if}
        </button>
      {/if}
    {/each}
  </div>
  <div class="side">
    <button class="btn small ghost ic" onclick={reset} disabled={finished || !Object.keys(asg).length} aria-label="Қайта бастау" title="Қайта бастау">↺</button>
    <button class="btn small ghost ic" class:on={showTip} onclick={() => { showTip = !showTip; note = ''; audio.play('click'); }} disabled={finished} aria-label="Кеңес" title="Кеңес">?</button>
  </div>
  </div>

  <div class="pad" role="group" aria-label="Цифрлар">
    {#each Array.from({ length: 10 }, (_, d) => d) as d}
      {@const by = holderOf(asg, d)}
      <button class="btn dbtn" class:on={sel !== null && asg[sel] === d} class:used={by !== null && by !== sel} onclick={() => put(d)} disabled={finished} aria-label={`Цифр ${d}`}>
        <span class="num">{d}</span>{#if by}<small style="color:{colorOf(by)}">{by}</small>{/if}
      </button>
    {/each}
  </div>

  <p class="msg" class:ok={finished} aria-live="polite">{note || (showTip ? (tip ?? TIP) : sel ? `${sel} әрпіне цифр таңда.` : 'Әріпті таңда.')}</p>
</div>

<style>
  .ld { display: grid; gap: 6px; justify-items: center; }
  .top { display: flex; gap: 8px; align-items: center; justify-content: center; }
  .side { display: grid; gap: 8px; }
  .ic { width: 34px; height: 34px; min-height: 0; padding: 0; font-size: 18px; }
  .ic.on { border-color: var(--gold); color: var(--gold); }
  .board { display: grid; grid-template-columns: 18px repeat(calc(var(--n) - 1), 40px); gap: 3px; align-items: center; justify-items: center; padding: 4px 8px 6px; background: #0b1030; border: 3px solid var(--line-hi); border-radius: 12px; transition: border-color .3s, box-shadow .3s; }
  .board.done { border-color: var(--ok); box-shadow: 0 0 20px #5ce39c66; }
  .op { font: 800 22px var(--disp); color: var(--gold); }
  .carry { height: 16px; display: grid; place-items: center; }
  .carry b { display: grid; place-items: center; min-width: 16px; height: 16px; font-size: 12px; color: var(--void); background: var(--gold); border-radius: 50%; animation: pop-in .3s var(--ease-out) both; }
  .cell { position: relative; display: grid; place-items: center; width: 40px; height: 38px; padding: 0; color: var(--c); background: var(--deep); border: 2px solid var(--line); border-bottom-width: 4px; border-radius: 8px; cursor: pointer; font: inherit; }
  .cell.empty { visibility: hidden; }
  .cell .lt { font: 800 24px var(--txt); }
  .cell .d { font-size: 26px; line-height: 1; }
  .cell .l { position: absolute; left: 3px; top: 0; font: 800 10px var(--txt); opacity: .8; font-style: normal; }
  .cell.set { background: color-mix(in srgb, var(--c) 14%, var(--deep)); border-color: color-mix(in srgb, var(--c) 55%, var(--line)); }
  .cell.sel { border-color: var(--c); box-shadow: 0 0 12px color-mix(in srgb, var(--c) 55%, transparent); animation: ldp 1.3s ease-in-out infinite; }
  .cell.ok { border-color: var(--ok); }
  .cell.no { border-color: var(--glitch); background: #3a0f2c; }
  .mk { position: absolute; right: 2px; bottom: -1px; font-size: 11px; font-style: normal; color: var(--ok); }
  .mk.x { color: var(--glitch); }
  .rule { grid-column: 1 / -1; width: 100%; height: 3px; background: var(--line-hi); border-radius: 2px; }
  .pad { display: grid; grid-template-columns: repeat(5, 48px); gap: 5px; }
  .dbtn { position: relative; min-height: 38px; height: 38px; padding: 0; font-size: 19px; display: grid; place-items: center; }
  .dbtn small { position: absolute; right: 4px; top: 0; font: 800 10px var(--txt); }
  .dbtn.on { border-color: var(--gold); box-shadow: 0 0 10px #ffc94a66; }
  .dbtn.used { opacity: .45; }
  .bad .board { animation: shake .35s; }
  .msg { text-align: center; font-weight: 700; max-width: 320px; min-height: 2.4em; font-size: 14px; line-height: 1.2; }
  .msg.ok { color: var(--ok); }
  @keyframes ldp { 50% { box-shadow: 0 0 4px transparent; } }
  @media (prefers-reduced-motion: reduce) { .cell.sel { animation: none; } }
</style>
