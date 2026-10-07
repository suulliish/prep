<script lang="ts">
  // «Сегодня» у командира: минуты по новому правилу «точность стоит, труд возвращает» в тени (D2). Ребёнок этого не видит и минут от этого не получает.
  import { game } from '../../lib/store.svelte';
  import { dayRec } from '../../lib/session.svelte';
  import { shadowSummary } from '../../engine/minutesShadow';
  import { MIN } from '../../engine/minutes';

  const rec = $derived(dayRec());
  const s = $derived(shadowSummary(game.save, game.day));
  const num = (x: number) => String(x).replace('.', ',');
</script>

<p class="note shadow">
  {#if s.has}
    <b>По новому правилу (тень): {s.bar}/60</b>, долг {s.debtToday}{#if s.debtCarried} (ещё {s.debtCarried} с прошлых дней){/if},
    честного времени {num(s.honestMin)} мин (только задачи); по старому: {rec.minutesToday}.
    {#if !s.planDone}<span> День ещё идёт: полоса растёт с ответами.</span>{/if}
    {#if s.via === 'full'}<span> Долг закрыт, было бы начислено 60.</span>{:else if s.via === 'cap'}<span> Честного времени набралось на 60.</span>{/if}
    {#if s.many}<span class="warn"> «Білмеймін» больше {MIN.dunnoMany} раз за день: за каждое по 2 близнеца.</span>{/if}
    {#if s.stuck}<span class="warn"> Застрял: {MIN.stuckRow} неверных подряд.</span>{/if}
    {#if s.extra}<span> Доп. миссия: {s.extra.bar}/{MIN.extra}.</span>{/if}
    <small>Ребёнок этого не видит.</small>
  {:else}
    <b>По новому правилу (тень):</b> данных нет; по старому: {rec.minutesToday}.
  {/if}
</p>

<style>
  .shadow { margin-top: 8px; }
  .warn { color: var(--warn, #b45309); }
  small { display: block; opacity: .65; }
</style>
