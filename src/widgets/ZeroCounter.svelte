<script lang="ts">
  // «Нөлдер»: 1 · 2 · … · n көбейтіндісінің соңындағы нөлдер. Санды бас — ол 2 мен 5 көбейткіштеріне жіктеледі.
  // Әр 5 бір 2-мен жұптасып «10» болады — бір нөл. 2-лер көп, 5-тер аз: нөл саны — жұп табылғандар. 25 = 5 · 5 екі 5 береді.
  // 2 де, 5 те жоқ сандар (1, 3, 7, …) күңгірт: оларды жіктеудің керегі жоқ. Барлық керек сан жіктелгенде — дайын.
  import { audio } from '../lib/audio';
  import { vp } from './scalesmath';

  let { n = 25, ondone }: { n?: number; ondone?: () => void } = $props();

  const nums = Array.from({ length: n }, (_, i) => i + 1);
  const twos = (k: number) => vp(k, 2), fives = (k: number) => vp(k, 5);
  const relevant = nums.filter(k => twos(k) + fives(k) > 0);
  let split = $state<Set<number>>(new Set());
  let note = $state('');
  let finished = $state(false);
  let auto = $state(false);
  let timer: ReturnType<typeof setTimeout> | undefined;

  const T = $derived([...split].reduce((s, k) => s + twos(k), 0));
  const F = $derived([...split].reduce((s, k) => s + fives(k), 0));
  const pairs = $derived(Math.min(T, F));
  const freeT = $derived(T - pairs), freeF = $derived(F - pairs);
  const factors = (k: number) => [...Array(twos(k)).fill(2), ...Array(fives(k)).fill(5)] as number[];
  const cols = n > 25 ? 6 : 5;

  function doSplit(k: number) {
    if (split.has(k) || finished) return;
    const T0 = T, F0 = F, before = Math.min(T0, F0), after = Math.min(T0 + twos(k), F0 + fives(k)), gain = after - before;
    split = new Set([...split, k]);
    note = gain > 1 ? `${k} = ${factors(k).join(' · ')}: екі 5 — екі жұп, екі нөл!` : gain === 1 ? `${k} = ${factors(k).join(' · ')}: 2 мен 5 жұптасты — тағы бір нөл!`
      : fives(k) ? '5-ке 2 жетпей тұр, кейінірек жұп табылады.' : `${k} = ${factors(k).join(' · ')}: тек 2-лер. Олар жұпсыз қалады.`;
    audio.play(gain > 0 ? 'correct' : 'click');
    if (relevant.every(x => x === k || split.has(x))) {
      finished = true; note = `Әр 5-ке жұп 2 табылды, артық 2-лер қалды. Нөл саны: ${after}.`;
      audio.play('correct'); timer = setTimeout(() => ondone?.(), 900);
    }
  }
  function tap(k: number) {
    if (twos(k) + fives(k) === 0) { note = `${k} санында 2 де, 5 те жоқ — нөл бермейді.`; audio.play('click'); return; }
    doSplit(k);
  }
  function rest() {
    if (auto || finished) return;
    auto = true;
    const todo = relevant.filter(k => !split.has(k));
    const step = () => { const k = todo.shift(); if (k === undefined || finished) { auto = false; return; } doSplit(k); timer = setTimeout(step, 140); };
    step();
  }
  $effect(() => () => clearTimeout(timer));
</script>

<div class="zc">
  <p class="cnt"><span>Нөл:</span> <b class="num" class:ok={finished}>{pairs}</b></p>
  <div class="g" style="--cols:{cols}">
    {#each nums as k}
      {@const rel = twos(k) + fives(k) > 0}
      <button class="c num" class:dim={!rel} class:on={split.has(k)} class:pick={rel && !split.has(k)} onclick={() => tap(k)} aria-label={`${k}`}>
        <span class="v">{k}</span>
        {#if split.has(k)}<span class="f">{#each factors(k) as x}<i class="p{x}">{x}</i>{/each}</span>{/if}
      </button>
    {/each}
  </div>

  <div class="pools">
    <div class="lane"><b class="lbl two">2</b><span class="tokens">{#each Array(freeT) as _}<i class="tk two">2</i>{/each}{#if !freeT}<em>—</em>{/if}</span></div>
    <div class="lane"><b class="lbl five">5</b><span class="tokens">{#each Array(freeF) as _}<i class="tk five">5</i>{/each}{#if !freeF}<em>—</em>{/if}</span></div>
    <div class="lane"><b class="lbl ten">10</b><span class="tokens">{#each Array(pairs) as _}<i class="tk ten">10</i>{/each}{#if !pairs}<em>—</em>{/if}</span></div>
  </div>

  <p class="msg" class:ok={finished}>{note || 'Санды бас: ол 2 мен 5 көбейткіштеріне жіктеледі. 2 мен 5 жұптасса — «10», яғни бір нөл.'}</p>
  {#if split.size >= 5 && !finished}<button class="btn small ghost" onclick={rest} disabled={auto}>Қалғанын өзі жіктесін</button>{/if}
</div>

<style>
  .zc { display: grid; gap: 10px; justify-items: center; }
  .cnt { font-size: var(--fs-l); font-weight: 800; color: var(--dim); }
  .cnt b { font-size: 34px; color: var(--gold); padding: 0 6px; }
  .cnt b.ok { color: var(--ok); }
  .g { display: grid; grid-template-columns: repeat(var(--cols), minmax(0, 1fr)); gap: 5px; width: min(100%, 360px); }
  .c { display: grid; place-items: center; align-content: center; gap: 2px; min-height: 50px; padding: 2px; color: var(--ink); background: var(--panel-hi); border: 2px solid var(--line-hi); border-bottom-width: 4px; border-radius: 8px; cursor: pointer; }
  .c .v { font-size: 18px; line-height: 1; }
  .c.dim { opacity: .35; background: var(--deep); border-color: var(--line); cursor: default; }
  .c.pick { border-color: var(--code); }
  .c.on { background: var(--deep); border-color: var(--gold); animation: pop-in .3s var(--ease-out); }
  .f { display: flex; gap: 2px; font: 800 11px var(--disp); line-height: 1; }
  .f i, .tk { font-style: normal; }
  .p2 { color: var(--code); } .p5 { color: var(--glitch); }
  .pools { display: grid; gap: 6px; width: min(100%, 360px); }
  .lane { display: grid; grid-template-columns: 34px 1fr; gap: 8px; align-items: center; padding: 4px 8px; background: #0b103055; border-radius: 10px; min-height: 40px; }
  .lbl { display: grid; place-items: center; height: 28px; font: 800 15px var(--disp); border-radius: 8px; color: var(--outline); }
  .lbl.two { background: var(--code); } .lbl.five { background: var(--glitch); } .lbl.ten { background: var(--gold); }
  .tokens { display: flex; flex-wrap: wrap; gap: 4px; align-items: center; }
  .tokens em { color: var(--faint); font-style: normal; }
  .tk { display: grid; place-items: center; min-width: 24px; height: 24px; padding: 0 4px; font: 800 13px var(--disp); color: var(--outline); border: 2px solid var(--outline); border-radius: 12px; animation: pop-in .3s var(--ease-out) both; }
  .tk.two { background: var(--code); } .tk.five { background: var(--glitch); } .tk.ten { background: var(--gold); box-shadow: 0 0 8px #ffcb2e88; }
  .msg { text-align: center; font-weight: 800; min-height: 2.6em; max-width: 340px; }
  .msg.ok { color: var(--ok); }
</style>
