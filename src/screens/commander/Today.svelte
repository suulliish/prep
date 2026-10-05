<script lang="ts">
  // «Сегодня»: минуты, серия, план дня, честность ответов, исключение дня.
  import { game, persist, skillDefs, downloadSave, daysSinceBackup } from '../../lib/store.svelte';
  import { ensurePlan, dayRec } from '../../lib/session.svelte';
  import { extraCap } from '../../engine/planner';
  import { streak } from '../../engine/streak';
  import { parse, iso } from '../../engine/dates';
  import { exceptionOn, EXC_KIND_RU } from '../../engine/exceptions';
  import Exceptions from './Exceptions.svelte';
  let { cloudOk }: { cloudOk: boolean } = $props();

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
  const excToday = $derived(exceptionOn(game.save, game.day));
  const since = daysSinceBackup();
</script>

{#if !cloudOk && (since === null || since >= 7)}
  <section class="panel card warn">
    <p>⚠ Прогресс хранится только в этом браузере. {since === null ? 'Копии в файл ещё не было.' : `Последняя копия — ${since} дн. назад.`} Лучше включить облако (вкладка «Данные»).</p>
    <button class="btn primary" onclick={downloadSave}>Скачать копию сейчас</button>
  </section>
{/if}
<section class="panel card">
  {#if excToday}<p class="note">Сегодня исключение: <b>{EXC_KIND_RU[excToday].toLowerCase()}</b>. План не обязателен, серия и тревоги этот день не считают пропуском.</p>{/if}
  <div class="grid3">
    <div class="kpi"><span class="label">Игра сегодня</span><b>{rec.minutesToday} мин</b><small>заработано, выдаёте вне игры</small></div>
    <div class="kpi"><span class="label">За неделю</span><b>{weekMin} мин</b><small>копилка выходных: {weekBank} мин</small></div>
    <div class="kpi"><span class="label">Серия дней</span><b>{st.days}</b><small>заморозок в этом месяце: {st.freezesLeft} из 2</small></div>
  </div>
  <ul class="blocks">
    {#each plan.blocks as b}<li class:done={rec.blocksDone[b.id]}>{rec.blocksDone[b.id] ? '✓' : '○'} {BLOCK[b.id]}</li>{/each}
    <li>Доп. миссий: {rec.extraMissions} из {extraCap(game.save.settings.extraMissionCap)}</li>
    {#if rec.hard}<li>Трудно сегодня: <b>{rec.hard === 'none' ? 'всё понятно' : skillDefs.find(d => d.id === rec.hard)?.title.ru}</b></li>{/if}
  </ul>
  <p class="note">Задач сегодня: {todays.length}, верно: {todays.filter(a => a.correct).length}. Нечестных ответов (наспех — быстрее его личного порога — или свернул приложение): <b class:warn={guesses > 2}>{guesses}</b>. «Был уверен, но ошибся»: <b>{sureWrong}</b> — это лучшие темы для разговора.</p>
  <div class="card-sub">
    <span class="label">Сценарий «3 вопроса» — когда помогаете</span>
    <ol><li>Не берілген? — Что дано?</li><li>Не табу керек? — Что найти?</li><li>Бірінші қадам қандай? — Какой первый шаг?</li></ol>
    <small>Закрепляйте, а не объясняйте новое: новое даёт урок.</small>
  </div>
  <Exceptions />
</section>
