<script lang="ts">
  // «Ответы»: каждый ответ ребёнка по дням, сводка дня (небрежность, скорость, типы ошибок), что ломает корабль
  import { game } from '../../lib/store.svelte';
  import { attemptDays, daySummary, recentByDay, repairCauses, confLabel, hintLabel, FAST_MS } from '../../engine/answers';
  import { mistakeName } from '../../engine/mistakeNames';
  import { shipIntegrity, openBreaks } from '../../engine/repair';
  import { dm, secs, skillRu, dayName } from './util';
  let dayPick = $state<string | null>(null);
  const ansDays = $derived(attemptDays(game.save.attempts));
  const selDay = $derived(dayPick && ansDays.includes(dayPick) ? dayPick : ansDays[0] ?? game.day);
  const sum = $derived(daySummary(game.save, selDay));
  const ansGroups = $derived(recentByDay(game.save.attempts, 100));
  const causes = $derived(repairCauses(game.save));
  const brokenNow = $derived(openBreaks(game.save));
</script>

<section class="panel card">
  {#if !ansDays.length}
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
              <td class="t" class:fastc={a.timeMs < FAST_MS || !!a.away}>{secs(a.timeMs)} с{#if a.away}<small title="Приложение было свёрнуто во время задачи — ответ не засчитан в минуты"> · свёрнуто {secs(a.away)} с</small>{/if}</td>
              <td>{skillRu(a.skill)}</td>
              <td class={a.correct ? 'h-ok' : 'h-no'}>{a.correct ? '✔' : '✘'}</td>
              <td>{a.correct ? '' : mistakeName(a.tag)}{#if !a.honest && a.hintLevel < 4} <b class="zt zl">{a.closed ? 'свернул > 5 с' : 'наугад, слишком быстро'}</b>{/if}</td>
              <td>{hintLabel(a.hintLevel) || '—'}</td>
              <td>{confLabel(a.confidence)}</td>
            </tr>
          {/each}
        </tbody>
      </table></div>
    {/each}
  {/if}
</section>
