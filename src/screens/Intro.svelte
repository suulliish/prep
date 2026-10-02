<script lang="ts">
  import Screen from '../ui/Screen.svelte';
  import Icon from '../ui/Icon.svelte';
  // Первый запуск: история «Жарық» и правила (как учёба двигает игру) — 5 экранов с голосом Бита и действием в 3D.
  import { onMount } from 'svelte';
  import Bit from '../ui/Bit.svelte';
  import { game, go, persist } from '../lib/store.svelte';
  import { W } from '../lib/world.svelte';
  import { audio } from '../lib/audio';
  import { ReadGate, readMs } from '../lib/readgate.svelte';
    import { sparksAt, sceneCenter } from '../ui/fx.svelte';
  // @ts-ignore
  import { INTRO } from '../../content/intro.mjs';

  const slides = INTRO as { act: string; title: string; kz: string }[];
  let i = $state(0);
  let started = $state(false);
  const gate = new ReadGate();
  // Заставка тоже не пролистывается вслепую (решение семьи 02.10): «дальше» заряжается на время чтения слайда и ждёт конца реплики Бита.
  const hold = (k: number) => gate.start(readMs(slides[k].title, slides[k].kz));
  const s = $derived(slides[i]);
  const voice = (k: number) => `${import.meta.env.BASE_URL}voice/intro/intro_${k}.mp3`;

  function act(a: string) {
    const w = W.world; if (!w) return;
    if (a === 'hello') { w.setMode('hub'); w.clearMob(); w.bitMood('happy'); }
    if (a === 'glitch') { w.setMode('battle'); w.spawnMob(3, 0); w.bitMood('think'); audio.play('hit'); }
    if (a === 'power') { w.heroAttack(true); setTimeout(() => { w.killMob(); w.celebrate(0xb58cff); audio.play('crystal'); }, 400); }
    if (a === 'time') { w.setMode('hub'); w.clearMob(); audio.play('chest'); w.openChest(); }
    if (a === 'scan') { w.setMode('portal'); w.openPortal(); audio.play('portal'); const c = sceneCenter(0.3); sparksAt(c.x, c.y, ['#3ff0ff', '#b58cff'], 60, 8); }
  }
  onMount(() => { W.dim = false; audio.setMood('map'); act(slides[0].act); });

  function start() { audio.unlock(); started = true; audio.play('mission'); act(slides[0].act); hold(0); }
  function next() {
    if (gate.on) { gate.nope(); audio.play('click'); return; }
    audio.play('click');
    if (i < slides.length - 1) { i++; act(slides[i].act); hold(i); return; }
    game.save.introSeen = true; persist();
    go({ name: 'diagnostic' });
  }
</script>

<Screen scene="tall">
  {#if !started}
    <div class="brand">
      <b class="logo">ЖАРЫҚ</b>
      <p class="sub">Математика · логика · БИЛ-ге дайындық</p>
      <p class="hint"><Icon name="sound" fill="#fff" size={18} />Дыбысты қос — Бит сөйлейді</p>
    </div>
  {:else}
    {#key i}
      <div class="slide">
        <div class="dots" aria-label="{i + 1} / {slides.length}">{#each slides as _, k}<i class:on={k <= i}></i>{/each}</div>
        <h2>{s.title}</h2>
        <Bit text={s.kz.replace('{name}', game.save.heroName)} mood={s.act === 'glitch' ? 'think' : 'wow'} voice={voice(i)} />
      </div>
    {/key}
  {/if}

  {#snippet footer()}
    {#if !started}
      <button class="btn primary big grow intro-next" onclick={start}><Icon name="play" fill="var(--outline)" stroke="none" size={20} />Ойынды бастау</button>
    {:else}
      <button class="btn primary big grow intro-next" class:charging={gate.on} class:charged={gate.done} style="--gate:{gate.ms}ms" onclick={next}>{i < slides.length - 1 ? 'Әрі қарай' : 'Сканерлеуге!'}<Icon name="chevron" fill="var(--outline)" size={20} /></button>
    {/if}
  {/snippet}
</Screen>

<style>
  .brand { display: grid; gap: 8px; justify-items: center; text-align: center; padding: 6px 0; }
  .logo { font: 900 52px var(--disp); letter-spacing: .04em; color: var(--gold); -webkit-text-stroke: 3px var(--outline); paint-order: stroke fill; text-shadow: 0 5px 0 var(--outline); }
  .sub { color: var(--ink); font-weight: 800; }
  .hint { display: inline-flex; align-items: center; gap: 6px; color: var(--dim); font-size: var(--fs-s); }
  .slide { display: grid; gap: 12px; animation: pop-in .3s var(--ease-out) both; }
  h2 { font-size: 24px; color: var(--gold); -webkit-text-stroke: 2px var(--outline); paint-order: stroke fill; text-shadow: 0 3px 0 var(--outline); }
  .dots { display: flex; gap: 6px; }
  .dots i { flex: 1; height: 8px; border-radius: 999px; background: var(--deep); border: 2px solid var(--outline); }
  .dots i.on { background: var(--code); }
  .grow { flex: 1; }
</style>
