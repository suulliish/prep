<script lang="ts">
  // Кнопка «Айтып бер»: ребёнок говорит вместо того, чтобы печатать (src/lib/mic.ts, сервер helper/transcribe.mjs).
  // Нажал — запись (красная кнопка, время, кольцо громкости), нажал ещё раз — Бит «слушает» и вписывает сказанное в поле.
  // Текст не уходит сам: ребёнок видит, что услышал Бит, может поправить и жмёт «Жіберу».
  // Кнопки нет, если браузер не умеет писать звук или командир выключил голосовой ввод; остаётся клавиатура.
  import { onDestroy } from 'svelte';
  import Icon from './Icon.svelte';
  import { audio } from '../lib/audio';
  import { game } from '../lib/store.svelte';
  import { Mic, micSupported, appendSpoken, clock, type MicError } from '../lib/mic';
  import { transcribe, markSpoken, HELPER_ERR, type HelperError } from '../lib/helper';

  // value — поле, куда дописывается сказанное; active — идёт запись или расшифровка (родитель на это время прячет «Жіберу»);
  // hint — тема (помогает узнать термины); compact — только значок (рядом с коротким полем вопроса); listen — подмена запроса для проверок без сервера
  let { value = $bindable(''), active = $bindable(false), max, hint, disabled = false, maxSec = 45, label = 'Айтып бер', compact = false, listen = transcribe }: {
    value?: string; active?: boolean; max: number; hint?: string; disabled?: boolean; maxSec?: number; label?: string; compact?: boolean; listen?: typeof transcribe;
  } = $props();

  const MIC_ERR: Record<MicError, string> = {
    denied: 'Микрофонға рұқсат жоқ. Ағаңнан рұқсат беруді сұра немесе жазып жібер.',
    no_mic: 'Микрофон табылмады. Жазып жібер.',
    short: 'Батырманы бас, сөйле, сосын тағы бас.',
    silent: 'Дауысың естілмеді. Жақынырақ айтып көр.',
    failed: 'Жазу шықпады. Қайта көр немесе жазып жібер.',
  };
  const NET_ERR: Record<HelperError, string> = {
    ...HELPER_ERR,
    quota: 'Бүгін дауыспен жазу таусылды. Жазып жібер.',
    ai_unavailable: 'Бит естімей қалды. Қайта айтып көр немесе жазып жібер.',
  };

  const shown = micSupported() && game.save.settings.voiceInput !== false;
  let phase = $state<'idle' | 'rec' | 'busy'>('idle');
  let msg = $state('');
  let ms = $state(0), lv = $state(0);
  let mic: Mic | null = null;
  let raf = 0, alive = true, starting = false;   // starting: ждём разрешения на микрофон — второе касание не открывает вторую запись
  $effect(() => { active = phase !== 'idle'; });

  async function start() {
    if (disabled || phase !== 'idle' || starting) return;
    msg = '';
    audio.unlock();
    const m = new Mic();
    audio.listen(true);
    starting = true;
    const err = await m.start();
    starting = false;
    if (!alive) { m.cancel(); return; }
    if (err) { audio.listen(false); msg = MIC_ERR[err]; return; }
    mic = m;
    phase = 'rec'; ms = 0;
    const loop = () => {
      if (!mic || phase !== 'rec') return;
      ms = mic.elapsed(); lv = mic.level();
      if (ms >= maxSec * 1000) { stop(); return; }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
  }

  async function stop() {
    if (phase !== 'rec' || !mic) return;
    cancelAnimationFrame(raf);
    phase = 'busy'; lv = 0;
    const r = await mic.stop();
    mic = null;
    audio.listen(false);
    if (!alive) return;
    if (typeof r === 'string') { msg = MIC_ERR[r]; phase = 'idle'; return; }
    try {
      const said = await listen(r, hint);
      if (!alive) return;
      if (!said) msg = MIC_ERR.silent;
      else { value = appendSpoken(value, said, max); markSpoken(value); audio.play('click'); }
    } catch (e) { if (alive) msg = NET_ERR[e as HelperError] ?? NET_ERR.ai_unavailable; }
    if (alive) phase = 'idle';
  }

  onDestroy(() => {
    alive = false;
    cancelAnimationFrame(raf);
    if (mic) { mic.cancel(); mic = null; audio.listen(false); }
  });
</script>

{#if shown}
  <span class="mic-wrap">
    {#if phase === 'rec'}
      <button type="button" class="btn miss mic rec" class:compact style="--lv: {lv}" onclick={stop} aria-label="Тоқтату">
        <Icon name="stop" size={16} fill="#fff" /><span class="t">{clock(ms)}</span>
      </button>
    {:else}
      <button type="button" class="btn ghost mic" class:compact disabled={disabled || phase === 'busy'} onclick={start} aria-label={label}>
        <Icon name="mic" size={18} fill="var(--code)" />{#if !compact}<span class="t">{phase === 'busy' ? 'Тыңдап жатыр…' : label}</span>{:else if phase === 'busy'}<span class="t">…</span>{/if}
      </button>
    {/if}
  </span>
  {#if phase === 'rec'}<p class="mic-note" class:end={compact} aria-live="polite">Сөйле… Біткенде тағы бас.{maxSec * 1000 - ms < 10000 ? ` ${Math.ceil((maxSec * 1000 - ms) / 1000)} сек қалды.` : ''}</p>
  {:else if msg}<p class="mic-note err" class:end={compact} aria-live="polite">{msg}</p>{/if}
{/if}

<style>
  .mic-wrap { display: contents; }
  .mic { display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-height: 48px; padding: 8px 12px 11px; font-size: 15px; white-space: nowrap; }
  .mic.rec { position: relative; box-shadow: inset 0 -3px 0 var(--e), 0 3px 0 var(--outline), 0 0 0 calc(3px + var(--lv) * 10px) #ff7a5966; transition: box-shadow .08s linear; }
  .mic.compact { min-width: 48px; padding: 6px 10px 9px; }
  .t { font-variant-numeric: tabular-nums; }
  .mic-note { grid-column: 1 / -1; flex-basis: 100%; margin: 0; font: 700 13px var(--txt); color: var(--dim); }
  .mic-note.err { color: var(--gold); }
  .mic-note.end { order: 99; }   /* в ряду «поле · микрофон · Сұрау» подсказка уходит строкой ниже, ряд не рвётся */
  @media (prefers-reduced-motion: reduce) { .mic.rec { transition: none; box-shadow: inset 0 -3px 0 var(--e), 0 3px 0 var(--outline), 0 0 0 4px #ff7a5966; } }
</style>
