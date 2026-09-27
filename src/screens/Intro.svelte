<script lang="ts">
  // Первый запуск: история «Разлома» и правила (как учёба двигает игру) — 5 экранов с голосом Бита и действием в 3D.
  import { onMount } from 'svelte';
  import Bit from '../ui/Bit.svelte';
  import { game, go, persist } from '../lib/store.svelte';
  import { W } from '../lib/world.svelte';
  import { audio } from '../lib/audio';
  import { sparksAt, sceneCenter } from '../ui/fx.svelte';
  // @ts-ignore
  import { INTRO } from '../../content/intro.mjs';

  const slides = INTRO as { act: string; title: string; kz: string }[];
  let i = $state(0);
  let started = $state(false);
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

  function start() { audio.unlock(); started = true; audio.play('mission'); act(slides[0].act); }
  function next() {
    audio.play('click');
    if (i < slides.length - 1) { i++; act(slides[i].act); return; }
    game.save.introSeen = true; persist();
    go({ name: 'diagnostic' });
  }
</script>

<div class="wrap side-dock">
  <div class="spacer passthrough"></div>
  {#if !started}
    <section class="panel card glitch-in">
      <b class="logo px">РАЗЛОМ</b>
      <p class="sub">Математика · логика · БИЛ-ге дайындық</p>
      <button class="btn gold big block pulse intro-next" onclick={start}>Ойынды бастау ▶</button>
      <p class="hint">Дыбысты қос — Бит сөйлейді 🔊</p>
    </section>
  {:else}
    {#key i}
      <section class="panel card glitch-in">
        <div class="dots">{#each slides as _, k}<i class:on={k <= i}></i>{/each}</div>
        <h2>{s.title}</h2>
        <Bit text={s.kz.replace('{name}', game.save.heroName)} mood={s.act === 'glitch' ? 'think' : 'wow'} voice={voice(i)} />
        <button class="btn primary big block intro-next" onclick={next}>{i < slides.length - 1 ? 'Әрі қарай →' : 'Сканерлеуге!'}</button>
      </section>
    {/key}
  {/if}
</div>

<style>
  .wrap { min-height: 100dvh; width: min(560px, 100%); margin: 0 auto; display: flex; flex-direction: column; padding: calc(env(safe-area-inset-top, 0px) + 12px) 16px calc(env(safe-area-inset-bottom, 0px) + 16px); }
  .spacer { flex: 1; min-height: 30vh; }
  .card { display: grid; gap: 14px; padding: 20px; }
  .logo { font-size: 56px; text-align: center; color: var(--code); text-shadow: 0 0 20px #3ff0ff, 3px 0 var(--glitch); letter-spacing: .06em; animation: flick 3s infinite; }
  .sub { text-align: center; color: var(--dim); font-weight: 800; }
  .hint { text-align: center; color: var(--faint); font-size: var(--fs-s); }
  h2 { font-size: 22px; color: var(--gold); }
  .dots { display: flex; gap: 6px; }
  .dots i { flex: 1; height: 4px; background: var(--line); border-radius: 2px; }
  .dots i.on { background: var(--code); box-shadow: 0 0 6px var(--code); }
  .pulse { animation: pulse-glow 2s infinite; }
  @keyframes flick { 0%, 92%, 100% { opacity: 1; } 94% { opacity: .6; transform: translateX(2px); } 96% { opacity: 1; } }
</style>
