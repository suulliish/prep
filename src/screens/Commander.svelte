<script lang="ts">
  // Экран брата («Командир корабля»), на русском, под PIN.
  import { onMount } from 'svelte';
  import { game, go, persist, skillDefs, hashPin, downloadSave, importSave, daysSinceBackup } from '../lib/store.svelte';
  import { W } from '../lib/world.svelte';
  import { ensurePlan, dayRec, replan } from '../lib/session.svelte';
  import { settleDay } from '../engine/planner';
  import { streak } from '../engine/streak';
  import { audio } from '../lib/audio';
  // @ts-ignore
  import { LESSONS } from '../../content/lessons.mjs';

  let unlocked = $state(false);
  let pin = $state('');
  let pinErr = $state('');
  let tab = $state<'today' | 'settings' | 'skills' | 'kz' | 'data'>('today');
  let confirmReset = $state(false);
  let importMsg = $state('');
  const hasPin = !!game.save.settings.pin;
  // облако грузится лениво (Firebase — отдельный кусок сайта)
  let email = $state('');
  let C = $state<typeof import('../lib/cloud.svelte') | null>(null);
  onMount(() => { import('../lib/cloud.svelte').then(m => (C = m)).catch(() => {}); });
  const cloudOk = $derived(!!C?.cloud.user && C.cloud.status !== 'error');
  const fmtTime = (t: number) => (t ? new Date(t).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');

  onMount(() => { W.dim = true; audio.setMood('focus'); });

  async function enter() {
    if (!/^\d{4}$/.test(pin)) { pinErr = 'PIN — 4 цифры'; return; }
    const h = await hashPin(pin);
    if (!hasPin) { game.save.settings.pin = h; persist(); unlocked = true; return; }
    if (h === game.save.settings.pin) unlocked = true; else { pinErr = 'Неверный PIN'; pin = ''; }
  }

  const plan = ensurePlan();
  const rec = $derived(dayRec());
  const st = $derived(streak(game.save, game.day));
  const todays = $derived(game.save.attempts.filter(a => a.day === game.day));
  const guesses = $derived(todays.filter(a => !a.honest && a.hintLevel < 4).length);
  const sureWrong = $derived(todays.filter(a => a.confidence === 'sure' && !a.correct).length);
  const BLOCK: Record<string, string> = { warmup: 'Разминка (повторение)', new: 'Новая тема', mixed: 'Смешанные задачи', summary: 'Итог дня' };
  const STATUS: Record<string, string> = { locked: 'закрыта', available: 'доступна', learning: 'изучается', learned: 'изучена', mastered: 'освоена 💎', automatic: 'автоматизм' };
  const CAT: Record<string, string> = { A: 'Уравнения, выражения', B: 'Текстовые задачи', C: 'Вычисления', D: 'Делимость', E: 'Геометрия', F: 'Пропорции', G: 'Проценты', H: 'Закономерности', I: 'Логика', J: 'Визуальная логика', K: 'Координаты' };

  function setException(e: 'sick' | 'holiday' | 'vacation' | undefined) {
    const r = dayRec(); r.exception = e; settleDay(r, plan, game.save.settings.extraTo); persist();
  }
  function gift(min: number) {
    const r = dayRec(); r.bonuses.push({ reason: 'Подарок командира', minutes: min });
    settleDay(r, plan, game.save.settings.extraTo); persist(); audio.play('chest');
  }
  function onImport(e: Event) {
    const f = (e.currentTarget as HTMLInputElement).files?.[0]; if (!f) return;
    f.text().then(t => { try { importSave(t); replan(); importMsg = 'Прогресс загружен.'; } catch (err) { importMsg = 'Не получилось: ' + (err as Error).message; } });
  }
  function reset() { localStorage.removeItem('razlom.save.v1'); location.reload(); }
  const lessonIds = Object.keys(LESSONS);
  function mark(id: string, v: 'ok' | 'fix') { (game.save.kzReview ??= {})[id] = v; persist(); }
</script>

<div class="wrap">
  <div class="top panel">
    <button class="btn ghost small" onclick={() => go({ name: 'hub' })}>←</button>
    <b class="t">Командир корабля</b>
  </div>

  {#if !unlocked}
    <section class="panel card">
      <p>{hasPin ? 'Введите PIN командира.' : 'Придумайте PIN из 4 цифр. Он защищает настройки и подарки от младшего брата.'}</p>
      <input id="pin" class="pin" type="password" inputmode="numeric" maxlength="4" bind:value={pin} onkeydown={(e) => e.key === 'Enter' && enter()} aria-label="PIN" />
      {#if pinErr}<p class="err">{pinErr}</p>{/if}
      <button class="btn primary" onclick={enter}>{hasPin ? 'Войти' : 'Сохранить PIN'}</button>
    </section>
  {:else}
    <nav class="tabs panel">
      {#each [['today', 'Сегодня'], ['settings', 'Настройки'], ['skills', 'Темы'], ['kz', 'Казахский текст'], ['data', 'Данные']] as [id, name]}
        <button class="tab" class:on={tab === id} onclick={() => (tab = id as any)}>{name}</button>
      {/each}
    </nav>

    {#if tab === 'today'}
      {@const since = daysSinceBackup()}
      {#if !cloudOk && (since === null || since >= 7)}
        <section class="panel card warn">
          <p>⚠ Прогресс хранится только в этом браузере. {since === null ? 'Копии в файл ещё не было.' : `Последняя копия — ${since} дн. назад.`} Лучше включить облако (вкладка «Данные»).</p>
          <button class="btn primary" onclick={downloadSave}>Скачать копию сейчас</button>
        </section>
      {/if}
      <section class="panel card">
        <div class="grid3">
          <div class="kpi"><span class="label">Игра сегодня</span><b>{rec.minutesToday} мин</b><small>потрачено {rec.spent ?? 0}</small></div>
          <div class="kpi"><span class="label">В копилку выходных</span><b>+{rec.minutesWeekend} мин</b></div>
          <div class="kpi"><span class="label">Серия дней</span><b>{st.days}</b><small>заморозок: {st.freezesLeft}</small></div>
        </div>
        <ul class="blocks">
          {#each plan.blocks as b}<li class:done={rec.blocksDone[b.id]}>{rec.blocksDone[b.id] ? '✓' : '○'} {BLOCK[b.id]}</li>{/each}
          <li>Доп. миссий: {rec.extraMissions} из {game.save.settings.extraMissionCap}</li>
          {#if rec.hard}<li>Трудно сегодня: <b>{rec.hard === 'none' ? 'всё понятно' : skillDefs.find(d => d.id === rec.hard)?.title.ru}</b></li>{/if}
          {#each rec.bonuses as b}<li class="bonus">★ +{b.minutes} мин — {b.reason}</li>{/each}
        </ul>
        <p class="note">Задач сегодня: {todays.length}, верно: {todays.filter(a => a.correct).length}. Угадываний (быстрее 5 сек): <b class:warn={guesses > 2}>{guesses}</b>. «Был уверен, но ошибся»: <b>{sureWrong}</b> — это лучшие темы для разговора.</p>
        <div class="card-sub">
          <span class="label">Сценарий «3 вопроса» — когда помогаете</span>
          <ol><li>Не берілген? — Что дано?</li><li>Не табу керек? — Что найти?</li><li>Бірінші қадам қандай? — Какой первый шаг?</li></ol>
          <small>Закрепляйте, а не объясняйте новое: новое даёт урок.</small>
        </div>
        <div class="row">
          <span class="label">Подарок командира</span>
          <button class="btn gold" onclick={() => gift(10)}>+10 мин</button>
          <button class="btn gold" onclick={() => gift(15)}>+15 мин</button>
        </div>
        <div class="row">
          <span class="label">Исключение на сегодня</span>
          {#each [['sick', 'Болел'], ['holiday', 'Праздник'], ['vacation', 'Каникулы']] as [e, n]}
            <button class="btn" class:on={rec.exception === e} onclick={() => setException(rec.exception === e ? undefined : (e as any))}>{n}</button>
          {/each}
        </div>
      </section>
    {:else if tab === 'settings'}
      <section class="panel card">
        <label for="hero">Имя героя (Бит обращается по нему)
          <input id="hero" type="text" maxlength="20" bind:value={game.save.heroName} onchange={persist} />
        </label>
        <label for="cap">Доп. миссий в день (по +15 мин)
          <input id="cap" type="number" min="0" max="8" bind:value={game.save.settings.extraMissionCap} onchange={persist} />
        </label>
        <fieldset>
          <legend>Куда идут минуты доп. миссий</legend>
          <label><input type="radio" name="to" value="today" bind:group={game.save.settings.extraTo} onchange={persist} /> на сегодня</label>
          <label><input type="radio" name="to" value="weekend" bind:group={game.save.settings.extraTo} onchange={persist} /> в копилку выходных</label>
        </fieldset>
        <p class="note">Правило: в будни за план — до 60 мин сегодня и до 48 мин в копилку выходных (4 часа за неделю), пропорционально выполненному. Засчитываются только честные задачи.</p>
        <button class="btn ghost" onclick={() => go({ name: 'sound' })}>Звук и музыка: громкость, режим фокуса…</button>
        <button class="btn ghost" onclick={() => { game.save.settings.pin = undefined; persist(); unlocked = false; }}>Сменить PIN</button>
      </section>
    {:else if tab === 'skills'}
      <section class="panel card list">
        {#each Object.keys(CAT) as c}
          {@const list = skillDefs.filter(d => d.cat === c)}
          <details>
            <summary>{CAT[c]} · {list.filter(d => ['learned', 'mastered', 'automatic'].includes(game.save.skills[d.id]?.status)).length}/{list.length}</summary>
            <ul>{#each list as d}{@const s = game.save.skills[d.id]}<li><span>{d.title.ru}</span><em class={s?.status}>{STATUS[s?.status ?? 'locked']}</em></li>{/each}</ul>
          </details>
        {/each}
      </section>
    {:else if tab === 'kz'}
      <section class="panel card list">
        <p class="note">Уроки написаны на казахском как черновик. Попросите носителя языка прочитать и отметить: «дұрыс» или «исправить». Ученику показываются все уроки, но отмеченные «исправить» я перепишу.</p>
        <ul>{#each lessonIds as id}{@const v = game.save.kzReview?.[id]}
          <li><span>{skillDefs.find(d => d.id === id)?.title.kz}</span>
            <span class="rv"><button class="btn small" class:on={v === 'ok'} onclick={() => mark(id, 'ok')}>дұрыс</button><button class="btn small" class:on={v === 'fix'} onclick={() => mark(id, 'fix')}>исправить</button></span></li>{/each}</ul>
      </section>
    {:else}
      <section class="panel card">
        <div class="cloud">
          <b>Облако (Firebase)</b>
          {#if !C}<p class="note">Загрузка…</p>
          {:else if !C.cloud.user}
            <p class="note">Войдите один раз на этом устройстве — прогресс будет сам сохраняться в облако и подтянется на другом устройстве после входа.</p>
            {#if C.cloud.linkSent}
              <p class="note">✉ Ссылка отправлена на <b>{C.cloud.linkSent}</b>. Откройте письмо <b>на этом устройстве</b> и нажмите ссылку — лучше скопировать её в этот же браузер (если почта откроет её во встроенном браузере, вход останется там). Письма нет — проверьте «Спам».</p>
            {/if}
            <form class="row" onsubmit={e => { e.preventDefault(); if (email.includes('@')) C!.sendLink(email.trim()); }}>
              <input type="email" placeholder="почта (можно iCloud)" bind:value={email} autocomplete="email" required />
              <button class="btn primary" type="submit">Прислать ссылку для входа</button>
            </form>
            <button class="btn ghost" onclick={() => C!.signIn()}>или войти через Google</button>
          {:else}
            <p class="note">Вход: <b>{C.cloud.user.email}</b>. Статус: {C.cloud.status === 'ok' ? '✓ синхронизировано' : C.cloud.status === 'syncing' ? 'синхронизация…' : C.cloud.status === 'error' ? 'ошибка' : '—'} · последняя: {fmtTime(C.cloud.lastSync)}</p>
            <div class="row"><button class="btn" onclick={() => C!.syncNow()}>Синхронизировать сейчас</button><button class="btn ghost" onclick={() => C!.signOutCloud()}>Выйти</button></div>
          {/if}
          {#if C?.cloud.error}<p class="err">Ошибка: {C.cloud.error}{C.cloud.error.includes('unauthorized-domain') ? ' — добавьте адрес сайта в Firebase → Authentication → Settings → Authorized domains.' : C.cloud.error.includes('permission-denied') ? ' — проверьте правила Firestore (docs/CLOUD.md).' : ''}</p>{/if}
        </div>
        <p class="note">Прогресс хранится в этом браузере. Раз в неделю скачивайте копию — её можно загрузить на другом устройстве. Последняя копия: {game.save.lastBackup ?? 'не было'}.</p>
        <button class="btn primary" onclick={downloadSave}>Скачать копию прогресса</button>
        <label class="btn" for="imp">Загрузить копию<input id="imp" type="file" accept="application/json" hidden onchange={onImport} /></label>
        {#if importMsg}<p class="note">{importMsg}</p>{/if}
        {#if !confirmReset}<button class="btn ghost" onclick={() => (confirmReset = true)}>Сбросить весь прогресс…</button>
        {:else}<div class="row"><span class="err">Точно удалить весь прогресс? Это нельзя отменить.</span><button class="btn" onclick={reset}>Да, удалить</button><button class="btn ghost" onclick={() => (confirmReset = false)}>Отмена</button></div>{/if}
      </section>
    {/if}
  {/if}
</div>

<style>
  .wrap { min-height: 100dvh; width: min(720px, 100%); margin: 0 auto; display: grid; align-content: start; gap: 10px; padding: calc(env(safe-area-inset-top, 0px) + 12px) 16px 24px; }
  .top { display: flex; gap: 12px; align-items: center; padding: 8px 12px; }
  .t { font-size: 20px; }
  .btn.small { min-height: 36px; padding: 4px 10px; font-size: var(--fs-s); }
  .card { display: grid; gap: 12px; }
  .pin { font: 800 28px var(--txt); letter-spacing: .5em; text-align: center; width: 180px; padding: 10px; background: var(--deep); color: var(--ink); border: 2px solid var(--line-hi); border-radius: 8px; }
  .err { color: var(--miss); font-weight: 700; }
  .tabs { display: flex; gap: 4px; padding: 6px; overflow-x: auto; scrollbar-width: none; }
  @media (max-width: 600px) { .tabs { mask-image: linear-gradient(90deg, #000 85%, transparent); } }
  .tab { font: 800 var(--fs-s) var(--txt); color: var(--dim); background: none; border: 0; padding: 8px 12px; border-radius: 6px; cursor: pointer; white-space: nowrap; }
  .tab.on { color: var(--ink); background: var(--panel-hi); }
  .grid3 { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 8px; }
  .kpi { display: grid; gap: 2px; background: var(--deep); border: 1px solid var(--line); padding: 10px; }
  .kpi b { font-size: 24px; }
  .kpi small { color: var(--dim); }
  .blocks { margin: 0; padding-left: 4px; list-style: none; display: grid; gap: 4px; }
  .blocks li.done { color: var(--ok); }
  .note { color: var(--dim); line-height: 1.5; }
  .warn { color: var(--miss); }
  .card-sub { background: var(--deep); border: 1px dashed var(--line-hi); padding: 10px 12px; }
  .card-sub ol { margin: 6px 0; padding-left: 20px; line-height: 1.6; font-weight: 700; }
  .card-sub small { color: var(--dim); }
  .row { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
  .on { border-color: var(--code); background: #0f5a66; }
  label { display: grid; gap: 6px; font-weight: 700; }
  input[type=number] { width: 100px; font: 800 20px var(--txt); padding: 8px; background: var(--deep); color: var(--ink); border: 2px solid var(--line-hi); border-radius: 6px; }
  fieldset { border: 1px solid var(--line); border-radius: 6px; display: grid; gap: 6px; }
  fieldset label { display: flex; gap: 8px; align-items: center; font-weight: 600; }
  .list ul { margin: 6px 0; padding: 0; list-style: none; display: grid; gap: 4px; }
  .list li { display: flex; justify-content: space-between; gap: 10px; align-items: center; padding: 6px 8px; background: var(--deep); }
  .list em { font-style: normal; font-size: var(--fs-s); color: var(--dim); white-space: nowrap; }
  .list em.learning { color: var(--gold); } .list em.learned { color: var(--code); } .list em.mastered, .list em.automatic { color: var(--crystal); }
  details summary { cursor: pointer; font-weight: 800; padding: 6px 0; }
  .rv { display: flex; gap: 6px; }
  .bonus { color: var(--gold); }
  .warn { border-color: var(--gold); display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
  .warn p { flex: 1; min-width: 200px; font-weight: 700; }
  .cloud { display: grid; gap: 8px; padding: 12px; border: 1px solid var(--line-hi); border-radius: 8px; background: var(--deep); }
</style>
