<script lang="ts">
  // «Повторы»: вспоминает ли ребёнок правила по расписанию (src/engine/recall.ts)
  import { game } from '../../lib/store.svelte';
  import { creditedCount, skillStat, dayStats, isCredited, CREDIT_STEPS } from '../../engine/recall';
  import { dm, skillRu } from './util';
  const rc = $derived(creditedCount(game.save));
  const rcRows = $derived(Object.entries(game.save.recall ?? {})
    .map(([id, r]) => ({ id, r, st: skillStat(r), title: skillRu(id) }))
    .sort((a, b) => Number(isCredited(a.r)) - Number(isCredited(b.r)) || (a.r.due < b.r.due ? -1 : 1)));
  const rcDays = $derived(dayStats(game.save).slice(0, 14));
  const rcSkipped = $derived(Object.entries(game.save.recallOffer ?? {}).filter(([d, o]) => d < game.day && o.skills.length && !(game.save.recall && Object.values(game.save.recall).some(r => r.history.some(h => h.day === d)))).map(([d]) => d));
  const confWord = (c: number | null) => (c === null ? '—' : c >= 2.5 ? 'уверен' : c >= 1.75 ? 'шамамен' : 'не знает');
</script>

<section class="panel card">
  <div class="grid3">
    <div class="kpi"><span class="label">Темы: вспомнены {CREDIT_STEPS} раза</span><b>{rc.credited} из {rc.total}</b><small>зачтены: {CREDIT_STEPS} верных возврата без подсказки в разные дни</small></div>
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
