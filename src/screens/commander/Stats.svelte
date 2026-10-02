<script lang="ts">
  // «Аналитика»: поведение (src/lib/track.svelte.ts) + ответы, вспоминания, «Дәптер», Бит — src/engine/analytics.ts
  import { game } from '../../lib/store.svelte';
  import { mistakeName } from '../../engine/mistakeNames';
  import { analyze, reportMarkdown } from '../../engine/analytics';
  import { skillRu } from './util';
  let stPeriod = $state(14);
  let stCopied = $state('');
  const an = $derived(analyze(game.save, { today: game.day, days: stPeriod, title: skillRu, mistake: mistakeName }));
  const stMd = () => reportMarkdown(an, game.save.heroName);
  async function copyReport() {
    try { await navigator.clipboard.writeText(stMd()); stCopied = 'Отчёт скопирован: вставьте его в чат.'; }
    catch { stCopied = 'Не удалось скопировать — скачайте файл.'; }
  }
  function downloadReport() {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([stMd()], { type: 'text/markdown' }));
    a.download = `razlom-analytics-${game.day}.md`; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
</script>

<section class="panel card list">
  <label class="daypick">Период
    <select bind:value={stPeriod} aria-label="Период аналитики">
      {#each [7, 14, 30, 90] as n}<option value={n}>{n} дней</option>{/each}
    </select>
  </label>
  <div class="grid3">
    <div class="kpi"><span class="label">Активно</span><b>{an.totals.activeMin} мин</b><small>за {an.totals.daysActive} дн.; время, когда он реально касался экрана</small></div>
    <div class="kpi"><span class="label">Верно / честно</span><b class:warn={an.totals.answers > 0 && an.totals.acc < 75}>{an.totals.answers ? `${an.totals.acc}% / ${an.totals.honest}%` : '—'}</b><small>{an.totals.answers} ответов</small></div>
    <div class="kpi"><span class="label">Спешка</span><b class:warn={an.totals.fast >= 25}>{an.totals.answers ? `${an.totals.fast}%` : '—'}</b><small>быстрее, чем можно прочитать; наугад (быстро и неверно): {an.totals.guesses}</small></div>
    <div class="kpi"><span class="label">Ранние нажатия «дальше»</span><b>{an.totals.nope}</b><small>жал до того, как кнопка зарядилась</small></div>
    <div class="kpi"><span class="label">Свёрнуто посреди задания</span><b class:warn={an.totals.awayMin >= 10}>{an.totals.awayMin} мин</b><small>урок, задачи или вспоминание открыты, а приложение свёрнуто</small></div>
    <div class="kpi"><span class="label">Выходы на середине</span><b class:warn={an.totals.exits >= 3}>{an.totals.exits}</b><small>ушёл из урока, боя или вспоминания</small></div>
  </div>
  {#if an.flags.length}
    <span class="label">Главное</span>
    <ul class="flags">{#each an.flags as f}<li>{f}</li>{/each}</ul>
  {/if}
  <div class="row">
    <button class="btn" onclick={copyReport}>Скопировать отчёт</button>
    <button class="btn ghost" onclick={downloadReport}>Скачать отчёт (.md)</button>
  </div>
  {#if stCopied}<p class="note">{stCopied}</p>{/if}
  <p class="note">Поведение (время, ранние нажатия, шаги урока) записывается с 02.10.2026; ответы — с первого дня. Всё хранится в вашем облаке Firebase, сторонней аналитики нет.</p>

  <span class="label">По дням</span>
  <div class="tblwrap"><table class="tbl">
    <thead><tr><th>День</th><th>Акт. мин</th><th>Заходы</th><th>Время</th><th>Ответов</th><th>Верно</th><th>Быстро</th><th>Наугад</th><th>Ранние</th><th>Свёрнуто</th><th>Выходы</th><th>Мин. игры</th></tr></thead>
    <tbody>{#each an.days as d}<tr><td>{d.day}</td><td>{d.activeMin}</td><td>{d.sessions}</td><td class="cells">{d.from && d.to ? `${d.from}–${d.to}` : ''}</td><td>{d.answers}</td><td>{d.answers ? `${d.correct}%` : ''}</td><td>{d.answers ? `${d.fast}%` : ''}</td><td>{d.guesses}</td><td>{d.nope}</td><td>{d.awayMin}</td><td>{d.exits}</td><td>{d.minutes}</td></tr>{:else}<tr><td colspan="12"><em>Данных за период нет</em></td></tr>{/each}</tbody>
  </table></div>

  {#if an.steps.length}
    <span class="label">Шаги урока: читает ли</span>
    <div class="tblwrap"><table class="tbl">
      <thead><tr><th>Шаг</th><th>Раз</th><th>С ранним нажатием</th><th>Был на шаге (медиана)</th><th>Нужно на чтение</th><th>Читал / нужно</th><th>Сворачивал</th></tr></thead>
      <tbody>{#each an.steps as s}<tr><td>{s.label}</td><td>{s.n}</td><td>{s.withNope}</td><td>{s.medianSec} с</td><td>{s.needSec ? `${s.needSec} с` : ''}</td><td>{s.readRatio || ''}</td><td>{s.awayN}</td></tr>{/each}</tbody>
    </table></div>
    <p class="note">«Читал / нужно» около 1 — уходит дальше сразу, как кнопка открылась; 1,5–3 — читает. Разборов ошибок: {an.reviews.n}, медиана {an.reviews.medianSec} с, с попыткой пролистать — {an.reviews.withNope}.</p>
  {/if}
  {#if an.nopeBy.length}
    <span class="label">Где жмёт раньше времени</span>
    <ul>{#each an.nopeBy as n}<li><span>{n.label}</span><b>{n.n}</b></li>{/each}</ul>
  {/if}

  {#if an.skills.length}
    <span class="label">Темы (слабые сверху)</span>
    <div class="tblwrap"><table class="tbl">
      <thead><tr><th>Тема</th><th>Ответов</th><th>Верно</th><th>Прошлый период</th><th>Быстро</th><th>Наугад</th><th>Подсказки</th></tr></thead>
      <tbody>{#each an.skills as s}<tr><td>{s.title}</td><td>{s.n}</td><td class:warnc={s.acc < 70}>{s.acc}%</td><td>{s.prevAcc === null ? '' : `${s.prevAcc}%`}</td><td>{s.fast}%</td><td>{s.guesses}</td><td>{s.hints}</td></tr>{/each}</tbody>
    </table></div>
  {/if}
  {#if an.mistakes.length}
    <span class="label">Повторяющиеся ошибки</span>
    <ul>{#each an.mistakes as m}<li><span>{m.name}<small class="note"> · {m.skills.join(', ')}</small></span><b>{m.n}</b></li>{/each}</ul>
  {/if}
  <div class="grid3">
    {#if an.hours.length}<div class="kpi"><span class="label">Время суток</span>{#each an.hours as h}<small>{h.label}: {h.n} отв., верно {h.acc}%, быстро {h.fast}%</small>{/each}</div>{/if}
    {#if an.fatigue.length}<div class="kpi"><span class="label">От начала занятия</span>{#each an.fatigue as h}<small>{h.label}: {h.n} отв., верно {h.acc}%</small>{/each}</div>{/if}
    {#if an.confidence.length}<div class="kpi"><span class="label">Уверенность</span>{#each an.confidence as c}<small>{c.label}: {c.n} отв., верно {c.acc}%</small>{/each}</div>{/if}
    <div class="kpi"><span class="label">Память и понимание</span>
      <small>Еске түсір: {an.recall.n} — без подсказки {an.recall.clean}, с подсказкой {an.recall.hinted}, не вспомнил {an.recall.failed}</small>
      {#if Object.keys(an.teach).length}<small>Биткә түсіндір: понял {an.teach.got ?? 0}, частично {an.teach.partial ?? 0}</small>{/if}
      {#if an.notebook.n}<small>Дәптер по фото: {an.notebook.n}, нечитаемых {an.notebook.unreadable}</small>{/if}
      <small>Вопросов к Биту: {an.ai.n} (голосом {an.ai.voice})</small>
    </div>
  </div>
</section>
