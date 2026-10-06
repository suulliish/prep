<script lang="ts">
  // «Неделя» (K5): карточка недели, кнопка «Скопировать для Telegram» и 5 тревог с готовой фразой для разговора с ребёнком.
  // Расчёты - src/engine/weekly.ts; тут только показ. Где данных нет, пишем «данных пока нет», числа не выдумываем.
  import { game } from '../../lib/store.svelte';
  import { card, alerts, weeklyText, NO_DATA, plural, ruNum } from '../../engine/weekly';
  import { EXC_KIND_RU } from '../../engine/exceptions';
  import { dm, type CloudMod } from './util';
  import { weekCtx } from './weekCtx';
  let { C }: { C: CloudMod | null } = $props();

  const ctx = $derived(weekCtx(C));
  const c = $derived(card(game.save, game.day, ctx));
  const al = $derived(alerts(game.save, game.day, ctx));
  const text = $derived(weeklyText(c, al, game.save.heroName));
  const DOW = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
  const dow = (d: string) => DOW[new Date(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)).getDay()];
  const SYNC: Record<string, string> = { unknown: NO_DATA, off: 'облако не подключено', syncing: 'идёт синхронизация', ok: 'работает', error: 'ошибка' };
  let copied = $state('');
  let showText = $state(false);
  async function copy() {
    try { await navigator.clipboard.writeText(text); copied = 'Скопировано: вставьте в Telegram.'; showText = false; }
    catch { copied = 'Не удалось скопировать автоматически: выделите текст ниже и скопируйте вручную.'; showText = true; }
  }
</script>

<section class="panel card">
  <b class="wk">Неделя {dm(c.monday)} - {dm(c.sunday)}</b>
  <div class="grid3">
    <div class="kpi">
      <span class="label">План</span>
      <b>{c.plan.of ? `${c.plan.done} из ${c.plan.of}` : '—'}</b>
      <small>{c.plan.of ? 'дней с выполненным планом' : 'исключения на все будни недели'}{c.plan.excepted.length ? `; исключения вычтены (${c.plan.excepted.map(e => `${dow(e.day)} ${EXC_KIND_RU[e.kind].toLowerCase()}`).join(', ')})` : ''}</small>
    </div>
    <div class="kpi"><span class="label">Заработано</span><b>{c.minutes.today} мин</b><small>копилка выходных: {c.minutes.bank} мин</small></div>
    <div class="kpi">
      <span class="label">Честная работа</span>
      <b class:warn={c.honest.pct !== null && c.honest.pct < 70}>{c.honest.pct === null ? '—' : `${c.honest.pct}%`}</b>
      <small>{c.honest.pct === null ? `${NO_DATA}: ответов на этой неделе нет` : `${c.honest.n} ответов; ${c.honest.prevPct === null ? 'на прошлой неделе ответов нет' : `неделей раньше ${c.honest.prevPct}% (${c.honest.prevN})`}`}</small>
    </div>
    <div class="kpi">
      <span class="label">Запас уроков</span>
      <b class:warn={c.runway.known && !c.runway.ended && c.runway.weeks !== null && c.runway.weeks < 3}>{!c.runway.known ? '—' : c.runway.ended ? 'новых тем нет' : `${ruNum(c.runway.weeks ?? 0)} нед.`}</b>
      <small>{!c.runway.known ? NO_DATA : c.runway.ended ? 'новые темы закончились, идёт практика' : `${c.runway.ready} ${plural(c.runway.ready, 'тема', 'темы', 'тем')} очереди с готовым уроком, по 3 новых в неделю`}</small>
    </div>
    <div class="kpi"><span class="label">Сбои</span><b class:warn={c.tech.errors > 0}>{c.tech.errors}</b><small>ошибок в приложении за неделю</small></div>
    <div class="kpi">
      <span class="label">Облако</span>
      <b>{SYNC[c.tech.sync]}</b>
      <small>{c.tech.lastWriteDaysAgo === null ? `последняя запись: ${NO_DATA}` : `последняя запись ${c.tech.lastWriteDaysAgo === 0 ? 'сегодня' : `${c.tech.lastWriteDaysAgo} дн. назад`}`}{c.tech.devices ? `; устройств: ${c.tech.devices}` : ''}</small>
    </div>
  </div>
  {#if c.tech.problems.length}<ul class="flags">{#each c.tech.problems as p}<li>{p}</li>{/each}</ul>{/if}
  <p class="note">Деңгей, трещины в знаниях, питомец: {NO_DATA} (этих систем в игре ещё нет).</p>
  <div class="row">
    <button class="btn primary" onclick={copy}>Скопировать для Telegram</button>
    {#if copied}<span class="note" role="status">{copied}</span>{/if}
  </div>
  {#if showText}<textarea class="tg" readonly rows="9" onfocus={e => e.currentTarget.select()}>{text}</textarea>{/if}
</section>

<section class="panel card">
  <b>Тревоги</b>
  {#if al.length === 0}
    <p class="note">Тревог нет. Проверяются пять: два дня без плана, честность ниже 70%, трещина старше 7 дней, запас уроков меньше 3 недель, облако молчит больше 3 дней. Выходные, болезнь и праздники пропуском не считаются.</p>
    <p class="note">Трещин в игре пока нет, поэтому третья тревога пока не срабатывает.</p>
  {:else}
    {#each al as a (a.id)}
      <article class="alert">
        <b>{a.title}</b>
        <p>{a.text}</p>
        <blockquote><span class="label">Что сказать ребёнку</span>{a.phrase}</blockquote>
      </article>
    {/each}
    <p class="note">Цифры ребёнку не зачитываются, только фраза. Начните с одной честной похвалы за стратегию; фраза даёт действие и выбор из двух.</p>
  {/if}
</section>

<style>
  .wk { font-size: 18px; }
  .alert { display: grid; gap: 6px; padding: 10px 12px; background: var(--deep); border: 1px solid var(--gold); }
  .alert b { color: var(--gold); }
  .alert p { margin: 0; line-height: 1.5; }
  blockquote { margin: 0; padding: 8px 10px; border-left: 3px solid var(--code); background: #0f5a6633; line-height: 1.5; display: grid; gap: 2px; }
  .tg { width: 100%; font: 14px/1.4 var(--txt); padding: 8px; background: var(--deep); color: var(--ink); border: 2px solid var(--line-hi); border-radius: 6px; resize: vertical; }
</style>
