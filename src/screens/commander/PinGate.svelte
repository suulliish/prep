<script lang="ts">
  // Вход командира и задание PIN (K2, 05.10): PIN из 4 цифр, лимит попыток на устройстве (5 свободных, дальше пауза 60 с, 120 с … до 15 минут),
  // задать и сменить PIN можно только с паролем облака (ребёнок его не знает). Логика — src/engine/pin.ts.
  import { onDestroy, tick } from 'svelte';
  import { game, persist } from '../../lib/store.svelte';
  import { loadGuard, saveGuard, openCommander } from '../../lib/pinstate';
  import { GUARD_EMPTY, checkPin, isStoredPin, makePin, needsUpgrade, onPinFail, guardWait, planPinChange, reauthMessage, validPin } from '../../engine/pin';
  import type { CloudMod } from './util';
  // enter — ввод PIN; set — задать/сменить (у нового PIN его нет, у «Сменить PIN» из настроек есть)
  let { mode, C, onok, oncancel }: { mode: 'enter' | 'set'; C: CloudMod | null; onok: () => void; oncancel?: () => void } = $props();

  let view = $state<'enter' | 'set'>(mode);
  let pin = $state(''), pin2 = $state(''), password = $state('');
  let err = $state(''), busy = $state(false);
  let now = $state(Date.now());
  let pinEl = $state<HTMLInputElement>();
  let alive = true;   // экран закрыт, пока ждали облако: ничего не записываем и командира не открываем
  const timer = setInterval(() => (now = Date.now()), 500);
  onDestroy(() => { alive = false; clearInterval(timer); });

  const hasPin = $derived(isStoredPin(game.save.settings.pin));
  const signedIn = $derived(!!C?.cloud.user);
  const plan = $derived(planPinChange({ signedIn, hasPin }));
  const wait = $derived(guardWait(loadGuard(now), now));

  const done = () => { openCommander(); onok(); };
  const refocus = () => tick().then(() => pinEl?.focus());
  async function enter() {
    if (busy) return;   // второй ввод до конца первой проверки не принимаем: иначе пачка параллельных вводов считалась бы одной попыткой
    err = '';
    if (!validPin(pin)) { err = 'PIN: 4 цифры'; return; }
    const g = loadGuard();
    if (guardWait(g, Date.now()) > 0) { err = 'Слишком много попыток. Подождите.'; return; }
    busy = true;
    try {
      const stored = game.save.settings.pin;
      // попытка считается сразу, до проверки; верный ввод её обнулит
      saveGuard(onPinFail(g, Date.now()));
      if (await checkPin(stored, pin)) {
        saveGuard(GUARD_EMPTY);
        if (needsUpgrade(stored)) { game.save.settings.pin = await makePin(pin); persist(); }   // старый хэш без соли → PBKDF2
        if (alive) done();
      } else {
        const next = loadGuard();
        err = guardWait(next, Date.now()) > 0 ? 'Неверный PIN. Подождите перед следующей попыткой.' : `Неверный PIN. Осталось попыток без паузы: ${Math.max(0, 5 - next.fails)}`;
        pin = '';
      }
    } catch { err = 'Не удалось проверить PIN. Попробуйте ещё раз.'; }
    finally { busy = false; refocus(); }
  }
  async function save() {
    if (busy) return;
    err = '';
    if (!plan.ok) { err = plan.why; return; }
    if (!validPin(pin)) { err = 'PIN: 4 цифры'; return; }
    if (pin !== pin2) { err = 'PIN не совпал, введите оба раза одинаково'; return; }
    busy = true;
    try {
      if (plan.needPassword) {
        if (!password) { err = 'Введите пароль облака'; return; }
        const r = await C!.reauth(password);
        if (!r.ok) { err = reauthMessage(r.error); password = ''; return; }
      }
      const rec = await makePin(pin, Date.now(), undefined, !plan.needPassword);   // без пароля облака — «слабый»: при слиянии уступает PIN с паролем
      if (!alive) return;   // пока ждали пароль, ушли с экрана: PIN не меняем и окно не открываем
      game.save.settings.pin = rec; persist();
      saveGuard(GUARD_EMPTY); password = ''; pin = ''; pin2 = '';
      done();
    } finally { busy = false; }
  }
</script>

<section class="panel card gate">
  {#if view === 'enter'}
    <p>Введите PIN командира.</p>
    <input class="pin" type="password" inputmode="numeric" maxlength="4" autocomplete="off" bind:this={pinEl} bind:value={pin} disabled={busy || wait > 0}
      onkeydown={(e) => e.key === 'Enter' && enter()} aria-label="PIN" />
    {#if wait > 0}<p class="err" role="alert">Слишком много попыток. Подождите {Math.ceil(wait / 1000)} с.</p>{:else if err}<p class="err" role="alert">{err}</p>{/if}
    <button class="btn primary" onclick={enter} disabled={busy || wait > 0}>Войти</button>
    <button class="btn ghost small" onclick={() => { view = 'set'; err = ''; pin = ''; }}>Забыли PIN или сменить?</button>
  {:else}
    <p><b>{!plan.ok ? 'Сменить PIN сейчас нельзя' : hasPin ? 'Новый PIN командира' : 'Задайте PIN командира'}</b></p>
    {#if plan.ok && plan.needPassword}
      <p class="note">Пароль облака подтверждает, что это вы, а не младший брат.</p>
      <label>Пароль облака <input type="password" autocomplete="off" bind:value={password} disabled={busy} onkeydown={(e) => e.key === 'Enter' && save()} aria-label="Пароль облака" /></label>
    {:else if plan.ok && plan.note}
      <p class="note">{plan.note}</p>
    {:else if !plan.ok}
      <p class="err">{plan.why}</p>
    {/if}
    {#if plan.ok}
      <label>PIN, 4 цифры <input class="pin" type="password" inputmode="numeric" maxlength="4" autocomplete="off" bind:value={pin} disabled={busy} aria-label="Новый PIN" /></label>
      <label>Ещё раз <input class="pin" type="password" inputmode="numeric" maxlength="4" autocomplete="off" bind:value={pin2} disabled={busy}
        onkeydown={(e) => e.key === 'Enter' && save()} aria-label="Повторите PIN" /></label>
      {#if err}<p class="err" role="alert">{err}</p>{/if}
      <button class="btn primary" onclick={save} disabled={busy}>Сохранить PIN</button>
    {/if}
    {#if mode === 'enter' && hasPin}<button class="btn ghost small" onclick={() => { view = 'enter'; err = ''; }}>Назад к вводу</button>{/if}
    {#if oncancel}<button class="btn ghost small" onclick={oncancel}>Отмена</button>{/if}
  {/if}
</section>

<style>
  .gate { display: grid; gap: 10px; justify-items: center; text-align: center; }
  .gate label { display: grid; gap: 4px; justify-items: center; font-size: 14px; }
  .gate input:not(.pin) { width: 240px; padding: 8px; background: var(--deep); color: var(--ink); border: 2px solid var(--line-hi); border-radius: 8px; font: inherit; }
  .pin { font: 800 28px var(--txt); letter-spacing: .5em; text-align: center; width: 180px; padding: 10px; background: var(--deep); color: var(--ink); border: 2px solid var(--line-hi); border-radius: 8px; }
  .note { font-size: 13px; opacity: .85; max-width: 420px; }
  .err { color: #ff8f8f; max-width: 420px; }
</style>
