<script lang="ts">
  // «Данные»: облако, устройства и версии, копия в файл, сброс.
  import { game, downloadSave, importSave } from '../../lib/store.svelte';
  import { replan } from '../../lib/session.svelte';
  import { APP_VERSION, deviceId } from '../../lib/version';
  import { fmtTime, type CloudMod } from './util';
  import Snapshots from './Snapshots.svelte';
  let { C }: { C: CloudMod | null } = $props();
  let email = $state('');
  let pass = $state('');
  let confirmReset = $state(false);
  let importMsg = $state('');
  const ERR: Record<string, string> = {
    'auth/wrong-password': 'Неверный пароль для этой почты. Нажмите «Забыли пароль?».',
    'auth/weak-password': 'Пароль слишком короткий — нужно не меньше 6 символов.',
    'auth/invalid-email': 'Почта написана с ошибкой.',
    'auth/missing-email': 'Сначала впишите почту.',
    'auth/too-many-requests': 'Слишком много попыток. Подождите пару минут.',
    'auth/network-request-failed': 'Нет интернета — попробуйте ещё раз.',
    'auth/quota-exceeded': 'Лимит писем на сегодня исчерпан. Войдите по паролю.',
    'app/outdated': 'В облаке данные новее этой версии приложения: устройство только читает облако. Закройте и откройте приложение, чтобы оно обновилось.',
  };
  function onImport(e: Event) {
    const f = (e.currentTarget as HTMLInputElement).files?.[0]; if (!f) return;
    f.text().then(t => { try { importSave(t); replan(); importMsg = 'Прогресс загружен.'; } catch (err) { importMsg = 'Не получилось: ' + (err as Error).message; } });
  }
  function reset() { localStorage.removeItem('razlom.save.v1'); location.reload(); }
</script>

<section class="panel card">
  <div class="cloud">
    <b>Облако (Firebase)</b>
    {#if !C}<p class="note">Загрузка…</p>
    {:else if !C.cloud.user}
      <p class="note">Войдите один раз на этом устройстве — прогресс будет сам сохраняться в облако и подтянется на другом устройстве после входа.</p>
      <p class="note">Почта и пароль (не меньше 6 символов). Первый раз — аккаунт создастся сам, дальше на любом устройстве входите с теми же почтой и паролем. Писем ждать не нужно.</p>
      <form class="col" onsubmit={e => { e.preventDefault(); if (email.includes('@') && pass.length >= 6) C!.signInPassword(email.trim(), pass); }}>
        <input type="email" placeholder="почта" bind:value={email} autocomplete="email" required />
        <input type="password" placeholder="пароль, от 6 символов" bind:value={pass} autocomplete="current-password" minlength="6" required />
        <button class="btn primary" type="submit">Войти</button>
      </form>
      <button class="btn ghost small" onclick={() => { if (email.includes('@')) C!.resetPassword(email.trim()); else C!.cloud.error = 'auth/missing-email'; }}>Забыли пароль? Прислать письмо для сброса</button>
      {#if C.cloud.linkSent}<p class="note">✉ Письмо отправлено на <b>{C.cloud.linkSent}</b>. Нет во «Входящих» — проверьте «Спам».</p>{/if}
    {:else}
      <p class="note">Вход: <b>{C.cloud.user.email}</b>. Статус: {C.cloud.status === 'ok' ? '✓ синхронизировано' : C.cloud.status === 'syncing' ? 'синхронизация…' : C.cloud.status === 'error' ? 'ошибка' : '—'} · последняя: {fmtTime(C.cloud.lastSync)}</p>
      <div class="row"><button class="btn" onclick={() => C!.syncNow()}>Синхронизировать сейчас</button><button class="btn ghost" onclick={() => C!.signOutCloud()}>Выйти</button></div>
      {@const devs = Object.entries(C.cloud.devices).sort((a, b) => b[1].at - a[1].at)}
      {#if devs.length}
        <p class="note"><b>Устройства этого аккаунта</b> (версия приложения и последняя запись в облако). Перед обновлениями правил облака все устройства должны быть на текущей версии — если устройство отстаёт или его нет в списке, откройте на нём приложение (со входом в облако), чтобы оно обновилось.</p>
        <ul class="devs">
          {#each devs as [id, d]}
            <li class:me={id === deviceId()} class:old={d.app !== APP_VERSION}>{d.label}{id === deviceId() ? ' (это устройство)' : ''} — <code>{d.app}</code>{d.app !== APP_VERSION ? ' · не текущая' : ''} · {fmtTime(d.at)}</li>
          {/each}
        </ul>
      {/if}
      <Snapshots {C} />
    {/if}
    {#if C?.cloud.error}<p class="err">{ERR[C.cloud.error] ?? `Ошибка: ${C.cloud.error}`}{#if !ERR[C.cloud.error]}{C.cloud.error.includes('unauthorized-domain') ? ' — добавьте адрес сайта в Firebase → Authentication → Settings → Authorized domains.' : C.cloud.error.includes('permission-denied') ? ' — проверьте правила Firestore (docs/CLOUD.md).' : ''}{/if}</p>{/if}
  </div>
  <p class="note">Версия приложения: <code>{APP_VERSION}</code></p>
  <p class="note">Прогресс хранится в этом браузере. Раз в неделю скачивайте копию — её можно загрузить на другом устройстве. Последняя копия: {game.save.lastBackup ?? 'не было'}.</p>
  <button class="btn primary" onclick={downloadSave}>Скачать копию прогресса</button>
  <label class="btn" for="imp">Загрузить копию<input id="imp" type="file" accept="application/json" hidden onchange={onImport} /></label>
  {#if importMsg}<p class="note">{importMsg}</p>{/if}
  {#if !confirmReset}<button class="btn ghost" onclick={() => (confirmReset = true)}>Сбросить весь прогресс…</button>
  {:else}<div class="row"><span class="err">Точно удалить весь прогресс? Это нельзя отменить.</span><button class="btn" onclick={reset}>Да, удалить</button><button class="btn ghost" onclick={() => (confirmReset = false)}>Отмена</button></div>{/if}
</section>
