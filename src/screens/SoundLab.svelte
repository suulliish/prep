<script lang="ts">
  import { audio, type Sfx, type Mood } from '../lib/audio';
  let { back }: { back: () => void } = $props();
  const sfx: [Sfx, string][] = [
    ['correct', 'Дұрыс'], ['wrong', 'Қате'], ['hit', 'Соққы'], ['crit', 'Супер соққы'], ['combo', 'Комбо'],
    ['xp', 'XP'], ['chest', 'Сандық'], ['crystal', 'Кристалл'], ['levelup', 'Жаңа деңгей'], ['portal', 'Портал'],
    ['hint', 'Кеңес'], ['energy', '+15 минут'], ['mission', 'Миссия'], ['click', 'Басу'],
  ];
  const moods: [Mood, string][] = [['hub', 'Кеме'], ['map', 'Карта'], ['battle', 'Шайқас'], ['victory', 'Жеңіс'], ['focus', 'Есеп (фокус)'], ['silent', 'Тыныштық']];
  let combo = 1;
  let s = $state({ ...audio.settings });
  let mood = $state<Mood>('silent');
  function set(k: 'master' | 'music' | 'sfx' | 'voice', v: number) { s[k] = v; audio.save({ [k]: v }); }
</script>

<main class="wrap">
  <button class="back" onclick={back}>← Артқа</button>
  <section class="card">
    <div class="label">ДЫБЫС ЭФФЕКТІЛЕРІ</div>
    <div class="grid">
      {#each sfx as [id, name]}
        <button onclick={() => { audio.unlock(); if (id === 'combo') combo = combo % 12 + 1; audio.play(id, { combo }); }}>{name}</button>
      {/each}
    </div>
  </section>
  <section class="card">
    <div class="label">МУЗЫКА</div>
    <div class="grid">
      {#each moods as [id, name]}
        <button class:on={mood === id} onclick={() => { audio.unlock(); mood = id; audio.setMood(id); }}>{name}</button>
      {/each}
    </div>
    <p class="note">«Есеп (фокус)» — есеп шығарғанда музыка өшеді: зерттеулер бойынша фондық музыка оқуға және есте сақтауға аздап кедергі келтіреді.</p>
  </section>
  <section class="card sliders">
    <div class="label">ДЫБЫС ДЕҢГЕЙІ</div>
    {#each [['master', 'Жалпы'], ['music', 'Музыка'], ['sfx', 'Эффектілер'], ['voice', 'Бит дауысы']] as [k, name]}
      <label for={'vol-' + k}>{name}
        <input id={'vol-' + k} type="range" min="0" max="1" step="0.05" value={s[k as 'master']}
          oninput={(e) => set(k as 'master', +(e.currentTarget as HTMLInputElement).value)} />
      </label>
    {/each}
    <button onclick={() => { audio.unlock(); audio.say(import.meta.env.BASE_URL + 'voice/test_hello.mp3'); }}>Бит сөйлесін</button>
  </section>
</main>

<style>
  .wrap { max-width: 720px; margin: 0 auto; padding: 20px 16px; display: grid; gap: 14px; }
  .back { justify-self: start; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 8px; margin-top: 10px; }
  .on { border-color: var(--cyan); background: #0f5a66; }
  .note { color: var(--ink-dim); font-size: 14px; line-height: 1.5; margin: 10px 0 0; }
  .sliders { display: grid; gap: 10px; }
  label { display: grid; grid-template-columns: 120px 1fr; align-items: center; gap: 10px; }
</style>
