<script lang="ts">
  // Экран брата («Командир корабля»), на русском, под PIN.
  import { onMount } from 'svelte';
  import { game, go, persist, skillDefs, hashPin, downloadSave, importSave, daysSinceBackup } from '../lib/store.svelte';
  import { W } from '../lib/world.svelte';
  import { ensurePlan, dayRec, replan } from '../lib/session.svelte';
  import { settleDay, extraCap } from '../engine/planner';
  import { streak } from '../engine/streak';
  import { parse, iso } from '../engine/dates';
  import { creditedCount, skillStat, dayStats, isCredited, CREDIT_STEPS } from '../engine/recall';
  import { attemptDays, daySummary, recentByDay, repairCauses, confLabel, hintLabel, FAST_MS } from '../engine/answers';
  import { mistakeName } from '../engine/mistakeNames';
  import { shipIntegrity, openBreaks } from '../engine/repair';
  import { audio } from '../lib/audio';
  // @ts-ignore
  import { LESSONS } from '../../content/lessons.mjs';

  let unlocked = $state(false);
  let pin = $state('');
  let pinErr = $state('');
  let tab = $state<'today' | 'answers' | 'recall' | 'settings' | 'skills' | 'kz' | 'ai' | 'data'>('today');
  let confirmReset = $state(false);
  let importMsg = $state('');
  const hasPin = !!game.save.settings.pin;
  // облако грузится лениво (Firebase — отдельный кусок сайта)
  let email = $state('');
  let pass = $state('');
  const ERR: Record<string, string> = {
    'auth/wrong-password': 'Неверный пароль для этой почты. Нажмите «Забыли пароль?».',
    'auth/weak-password': 'Пароль слишком короткий — нужно не меньше 6 символов.',
    'auth/invalid-email': 'Почта написана с ошибкой.',
    'auth/missing-email': 'Сначала впишите почту.',
    'auth/too-many-requests': 'Слишком много попыток. Подождите пару минут.',
    'auth/network-request-failed': 'Нет интернета — попробуйте ещё раз.',
    'auth/quota-exceeded': 'Лимит писем на сегодня исчерпан. Войдите по паролю.',
  };
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
  // неделя (с понедельника): сколько заработано всего и в копилку выходных — время выдаёте вне игры
  const monday = (() => { const d = parse(game.day); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return iso(d); })();
  const week = $derived(Object.values(game.save.days).filter(r => r.date >= monday && r.date <= game.day));
  const weekMin = $derived(week.reduce((s, r) => s + r.minutesToday, 0));
  const weekBank = $derived(week.reduce((s, r) => s + r.minutesWeekend, 0));
  const st = $derived(streak(game.save, game.day));
  const todays = $derived(game.save.attempts.filter(a => a.day === game.day));
  const guesses = $derived(todays.filter(a => !a.honest && a.hintLevel < 4).length);
  const sureWrong = $derived(todays.filter(a => a.confidence === 'sure' && !a.correct).length);
  const BLOCK: Record<string, string> = { warmup: 'Разминка (повторение)', new: 'Новая тема', mixed: 'Смешанные задачи', summary: 'Итог дня' };
  const STATUS: Record<string, string> = { locked: 'закрыта', available: 'доступна', learning: 'изучается', learned: 'изучена', mastered: 'освоена 💎', automatic: 'автоматизм' };
  const CAT: Record<string, string> = { A: 'Уравнения, выражения', B: 'Текстовые задачи', C: 'Вычисления', D: 'Делимость', E: 'Геометрия', F: 'Пропорции', G: 'Проценты', H: 'Закономерности', I: 'Логика', J: 'Визуальная логика', K: 'Координаты' };

  // «Ответы»: каждый ответ ребёнка по дням, сводка дня (небрежность, скорость, типы ошибок), что ломает корабль
  let dayPick = $state<string | null>(null);
  const ansDays = $derived(attemptDays(game.save.attempts));
  const selDay = $derived(dayPick && ansDays.includes(dayPick) ? dayPick : ansDays[0] ?? game.day);
  const sum = $derived(daySummary(game.save, selDay));
  const ansGroups = $derived(recentByDay(game.save.attempts, 100));
  const causes = $derived(repairCauses(game.save));
  const skillRu = (id: string) => skillDefs.find(d => d.id === id)?.title.ru ?? id;
  const secs = (ms: number) => (ms / 1000).toFixed(ms < 10000 ? 1 : 0);
  const dayName = (d: string) => (d === game.day ? 'сегодня' : dm(d));
  const brokenNow = $derived(openBreaks(game.save));
  // отец открывает вкладку на своём устройстве: если вошёл в облако, подтягиваем свежие ответы (один раз за вход в раздел)
  let ansSynced = false;
  $effect(() => { if (tab === 'answers' && !ansSynced && C?.cloud.user) { ansSynced = true; void C.syncNow(); } });

  // «Повторы»: вспоминает ли ребёнок правила по расписанию (src/engine/recall.ts)
  const rc = $derived(creditedCount(game.save));
  const rcRows = $derived(Object.entries(game.save.recall ?? {})
    .map(([id, r]) => ({ id, r, st: skillStat(r), title: skillDefs.find(d => d.id === id)?.title.ru ?? id }))
    .sort((a, b) => Number(isCredited(a.r)) - Number(isCredited(b.r)) || (a.r.due < b.r.due ? -1 : 1)));
  const rcDays = $derived(dayStats(game.save).slice(0, 14));
  const rcSkipped = $derived(Object.entries(game.save.recallOffer ?? {}).filter(([d, o]) => d < game.day && o.skills.length && !(game.save.recall && Object.values(game.save.recall).some(r => r.history.some(h => h.day === d)))).map(([d]) => d));
  const rcAsked = $derived(Object.values(game.save.recallOffer ?? {}).filter(o => o.skipped).length);
  const dm = (d: string) => `${d.slice(8, 10)}.${d.slice(5, 7)}`;
  const confWord = (c: number | null) => (c === null ? '—' : c >= 2.5 ? 'уверен' : c >= 1.75 ? 'шамамен' : 'не знает');
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
  function mark(id: string, v: 'ok' | 'fix') { game.save.kzReview ??= {}; game.save.kzReview[id] = v; persist(); }
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
      {#each [['today', 'Сегодня'], ['answers', 'Ответы'], ['recall', 'Повторы'], ['settings', 'Настройки'], ['skills', 'Темы'], ['kz', 'Казахский текст'], ['ai', 'Вопросы к ИИ'], ['data', 'Данные']] as [id, name]}
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
          <div class="kpi"><span class="label">Игра сегодня</span><b>{rec.minutesToday} мин</b><small>заработано, выдаёте вне игры</small></div>
          <div class="kpi"><span class="label">За неделю</span><b>{weekMin} мин</b><small>копилка выходных: {weekBank} мин</small></div>
          <div class="kpi"><span class="label">Серия дней</span><b>{st.days}</b><small>заморозок: {st.freezesLeft}</small></div>
        </div>
        <ul class="blocks">
          {#each plan.blocks as b}<li class:done={rec.blocksDone[b.id]}>{rec.blocksDone[b.id] ? '✓' : '○'} {BLOCK[b.id]}</li>{/each}
          <li>Доп. миссий: {rec.extraMissions} из {extraCap(game.save.settings.extraMissionCap)}</li>
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
    {:else if tab === 'answers'}
      <section class="panel card">
        {#if !game.save.attempts.length}
          <p class="note">Ответов пока нет: они появятся после первого боя.</p>
        {:else}
          <label class="daypick">Сводка за день
            <select value={selDay} onchange={e => (dayPick = e.currentTarget.value)} aria-label="День для сводки">
              {#each ansDays.slice(0, 30) as d}<option value={d}>{d === game.day ? `сегодня (${dm(d)})` : dm(d)}</option>{/each}
            </select>
          </label>
          <div class="grid3">
            <div class="kpi"><span class="label">Верно с первой попытки</span><b class:warn={sum.cleanPct !== null && sum.cleanPct < 85}>{sum.cleanPct === null ? '—' : `${sum.cleanPct}%`}</b><small>{sum.clean} из {sum.n} ответов, без подсказки. Цель: 85% и выше</small></div>
            <div class="kpi"><span class="label">Быстрее {FAST_MS / 1000} секунд</span><b class:warn={sum.fastPct !== null && sum.fastPct > 30}>{sum.fastPct === null ? '—' : `${sum.fastPct}%`}</b><small>{sum.fast} из {sum.n}: слишком быстрое чтение условия</small></div>
            <div class="kpi"><span class="label">Корабль</span><b>{shipIntegrity(brokenNow)}%</b><small>поломок сейчас: {brokenNow} (каждая неисправленная ошибка)</small></div>
          </div>
          <div class="card-sub">
            <span class="label">Чаще всего ошибался так (топ-3 за день)</span>
            {#if sum.topErrors.length}<ol>{#each sum.topErrors as e}<li>{e.name} <b>×{e.n}</b></li>{/each}</ol>{:else}<p class="note">Ошибок в этот день не было.</p>{/if}
          </div>
          <div class="card-sub">
            <span class="label">Небрежность: ошибки в счёте на уже выученных темах</span>
            {#if sum.careless.length}<ol>{#each sum.careless as c}<li>{skillRu(c.skill)} <b>×{c.n}</b></li>{/each}</ol>
              <small>Тема выучена, правило он знает: здесь ошибка от спешки. Помогает вопрос «где ты проверил ответ?», а не «почему не старался».</small>
            {:else}<p class="note">Таких ошибок в этот день нет.</p>{/if}
          </div>

          <span class="label">Что ломает корабль чаще всего</span>
          {#if causes.length}
            <div class="tblwrap"><table class="tbl">
              <thead><tr><th>Тема</th><th>Поломок всего</th><th>Не починено</th><th>Ошибок в истории</th></tr></thead>
              <tbody>{#each causes as c}<tr><td>{skillRu(c.skill)}</td><td>{c.total}</td><td class:warn={c.open > 0}>{c.open}</td><td>{c.wrong}</td></tr>{/each}</tbody>
            </table></div>
          {:else}<p class="note">Поломок ещё не было.</p>{/if}

          <span class="label">Последние ответы ({ansGroups.reduce((n, g) => n + g.list.length, 0)}), по дням</span>
          {#each ansGroups as g}
            {@const ds = daySummary(game.save, g.day)}
            <div class="dayhead"><b>{dayName(g.day)}</b><small>{g.list.length} в списке · всего за день {ds.n}, верно с первой попытки {ds.cleanPct ?? '—'}%</small></div>
            <div class="tblwrap"><table class="tbl anslog">
              <thead><tr><th>Время</th><th>Тема</th><th></th><th>Тип ошибки</th><th>Подсказка</th><th>Уверенность</th></tr></thead>
              <tbody>
                {#each g.list as a}
                  <tr class:bad={!a.correct}>
                    <td class="t" class:fastc={a.timeMs < FAST_MS}>{secs(a.timeMs)} с</td>
                    <td>{skillRu(a.skill)}</td>
                    <td class={a.correct ? 'h-ok' : 'h-no'}>{a.correct ? '✔' : '✘'}</td>
                    <td>{a.correct ? '' : mistakeName(a.tag)}{#if !a.honest && a.hintLevel < 4} <b class="zt zl">наугад, слишком быстро</b>{/if}</td>
                    <td>{hintLabel(a.hintLevel) || '—'}</td>
                    <td>{confLabel(a.confidence)}</td>
                  </tr>
                {/each}
              </tbody>
            </table></div>
          {/each}
        {/if}
      </section>
    {:else if tab === 'recall'}
      <section class="panel card">
        <div class="grid3">
          <div class="kpi"><span class="label">Темы: вспомнены {CREDIT_STEPS} раза</span><b>{rc.credited} из {rc.total}</b><small>зачтены: {CREDIT_STEPS} верных возврата без подсказки в разные дни</small></div>
          <div class="kpi"><span class="label">«Өткізу» нажато</span><b>{rcAsked}</b><small>раз(а) пропущено вспоминание утром</small></div>
          <div class="kpi"><span class="label">Дней без вспоминания</span><b>{rcSkipped.length}</b><small>утром предложили, но ни одна тема не пройдена</small></div>
        </div>
        <p class="note">Каждый день вспоминается до 3 тем: сначала правило из слов-кирпичиков без подсказки, потом сверка и одна задача. Возвраты идут на 1, 3, 7, 14 и 30 день, дальше редко. Ошибка откатывает тему на шаг назад. «Зачтено» считается только без подсказки. Данных о том, что это даёт баллы на экзамене, нет: это цифры самого ребёнка.</p>
        {#if !rcRows.length}<p class="note">Тем на возвратах пока нет: они появятся после первого урока.</p>{:else}
          <div class="tblwrap"><table class="tbl">
            <thead><tr><th>Тема</th><th>Последние возвраты</th><th>Без подсказки</th><th>Уверенность</th><th>Дальше</th></tr></thead>
            <tbody>
              {#each rcRows as x}
                <tr class:ok={isCredited(x.r)}>
                  <td>{x.title}{#if isCredited(x.r)}<b class="zt zl">зачтено</b>{/if}</td>
                  <td class="cells">{#each x.r.history.slice(-5) as h}<span class:h-ok={h.ok && h.hint === 0} class:h-help={h.ok && h.hint > 0} class:h-no={!h.ok} title="{h.day}, подсказка {h.hint}">{h.ok ? '✔' : '✘'}<i>{dm(h.day)}</i></span>{:else}<em>ещё не было</em>{/each}</td>
                  <td>{x.st.cleanRate === null ? '—' : `${Math.round(x.st.cleanRate * 100)}% (${x.st.clean} из ${x.st.returns})`}</td>
                  <td>{confWord(x.st.avgConf)}{#if x.st.sureWrong}<b class="zt zl">был уверен, но ошибся ×{x.st.sureWrong}</b>{/if}</td>
                  <td>{dm(x.r.due)}</td>
                </tr>
              {/each}
            </tbody>
          </table></div>
          <span class="label">Успех вспоминаний по дням</span>
          <div class="tblwrap"><table class="tbl">
            <thead><tr><th>День</th><th>Возвратов</th><th>Без подсказки</th><th>С подсказкой</th><th>Не вышло</th></tr></thead>
            <tbody>{#each rcDays as d}<tr><td>{d.day}</td><td>{d.n}</td><td>{d.clean}</td><td>{d.hinted}</td><td>{d.failed}</td></tr>{:else}<tr><td colspan="5"><em>Возвратов ещё не было</em></td></tr>{/each}</tbody>
          </table></div>
        {/if}
      </section>
    {:else if tab === 'settings'}
      <section class="panel card">
        <label for="hero">Имя героя (Бит обращается по нему)
          <input id="hero" type="text" maxlength="20" bind:value={game.save.heroName} onchange={persist} />
        </label>
        <label for="cap">Доп. миссий в день (по +15 мин)
          <input id="cap" type="number" min="0" max="1" bind:value={game.save.settings.extraMissionCap} onchange={persist} />
        </label>
        <fieldset>
          <legend>Куда идут минуты доп. миссий</legend>
          <label><input type="radio" name="to" value="today" bind:group={game.save.settings.extraTo} onchange={persist} /> на сегодня</label>
          <label><input type="radio" name="to" value="weekend" bind:group={game.save.settings.extraTo} onchange={persist} /> в копилку выходных</label>
        </fieldset>
        <p class="note">Правило: в будни за план — до 60 мин сегодня и до 48 мин в копилку выходных (4 часа за неделю), пропорционально выполненному. Засчитываются только честные задачи.</p>
        <label class="check"><input type="checkbox" checked={game.save.settings.voiceInput !== false} onchange={(e) => { game.save.settings.voiceInput = e.currentTarget.checked; persist(); }} /> Голосовой ввод: кнопка «Айтып бер» (микрофон)</label>
        <p class="note">Вместо того чтобы печатать, ребёнок может сказать ответ Биту вслух. Запись уходит на сервер Бита и в Gemini (Vertex) только для расшифровки и нигде не хранится; в поле появляется текст, ребёнок его видит и сам отправляет. Работает при входе в облако; браузер один раз спросит разрешение на микрофон.</p>
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
    {:else if tab === 'ai'}
      <section class="panel card list">
        <p class="note">Кнопка «Түсінбедім» появляется только после ответа, когда решение уже показано: ИИ объясняет иначе и отвечает на уточняющие вопросы (до {3} на задачу, до 30 в день). Работает, только если на устройстве выполнен вход в облако (вкладка «Данные»). Модель — Gemini через Vertex, как у бота. 🎤 — ребёнок сказал вопрос голосом (текст — как его расслышал Бит).</p>
        {#if !(game.save.aiLog ?? []).length}<p class="note">Вопросов пока не было.</p>{/if}
        {#each [...(game.save.aiLog ?? [])].reverse().slice(0, 30) as t}
          <details class="ailog">
            <summary><b>{t.day}</b> · {skillDefs.find(d => d.id === t.skill)?.title.ru ?? t.skill} · {t.q === 'түсінбедім' ? '«не понял»' : `${t.voice ? '🎤 ' : ''}«${t.q}»`}</summary>
            <p class="note">{t.task}</p>
            <p>{t.a}</p>
          </details>
        {/each}
      </section>
    {:else}
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
          {/if}
          {#if C?.cloud.error}<p class="err">{ERR[C.cloud.error] ?? `Ошибка: ${C.cloud.error}`}{#if !ERR[C.cloud.error]}{C.cloud.error.includes('unauthorized-domain') ? ' — добавьте адрес сайта в Firebase → Authentication → Settings → Authorized domains.' : C.cloud.error.includes('permission-denied') ? ' — проверьте правила Firestore (docs/CLOUD.md).' : ''}{/if}</p>{/if}
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
  .col { display: grid; gap: 8px; }
  .col input { font: 600 16px var(--txt); padding: 12px 14px; min-height: 48px; border-radius: 12px; border: 3px solid var(--outline); background: var(--paper); color: var(--paper-ink); }
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
  label.check { display: flex; gap: 8px; align-items: center; }
  .list ul { margin: 6px 0; padding: 0; list-style: none; display: grid; gap: 4px; }
  .list li { display: flex; justify-content: space-between; gap: 10px; align-items: center; padding: 6px 8px; background: var(--deep); }
  .list em { font-style: normal; font-size: var(--fs-s); color: var(--dim); white-space: nowrap; }
  .list em.learning { color: var(--gold); } .list em.learned { color: var(--code); } .list em.mastered, .list em.automatic { color: var(--crystal); }
  details summary { cursor: pointer; font-weight: 800; padding: 6px 0; }
  .rv { display: flex; gap: 6px; }
  .bonus { color: var(--gold); }
  .warn { border-color: var(--gold); display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
  .warn p { flex: 1; min-width: 200px; font-weight: 700; }
  .tblwrap { overflow-x: auto; }
  .tbl { width: 100%; border-collapse: collapse; font-size: var(--fs-s); }
  .tbl th { text-align: left; font-size: 12px; color: var(--dim); padding: 4px 8px; white-space: nowrap; }
  .tbl td { padding: 6px 8px; background: var(--deep); border-top: 2px solid var(--line); vertical-align: top; }
  .tbl tr.ok td { box-shadow: inset 3px 0 0 var(--ok); }
  .tbl .cells { white-space: nowrap; }
  .tbl .cells span { display: inline-grid; justify-items: center; margin-right: 6px; font-weight: 800; }
  .tbl .cells i { font: 700 10px var(--txt); font-style: normal; color: var(--dim); }
  .h-ok { color: var(--ok); } .h-help { color: var(--gold); } .h-no { color: var(--miss); }
  .daypick { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  .daypick select { font: 700 16px var(--txt); padding: 8px 10px; min-height: 40px; background: var(--deep); color: var(--ink); border: 2px solid var(--line-hi); border-radius: 6px; }
  .dayhead { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 10px; margin-top: 6px; }
  .dayhead small { color: var(--dim); }
  .tbl.anslog td { vertical-align: middle; }
  .tbl.anslog tr.bad td { box-shadow: inset 0 0 0 9999px #ff5a6e10; }
  .tbl.anslog .t { white-space: nowrap; font-weight: 800; }
  .tbl.anslog .t.fastc { color: var(--gold); }
  .zt { color: var(--gold); font-size: 12px; }
  .zl { margin-left: 6px; }
  .cloud { display: grid; gap: 8px; padding: 12px; border: 1px solid var(--line-hi); border-radius: 8px; background: var(--deep); }
</style>
