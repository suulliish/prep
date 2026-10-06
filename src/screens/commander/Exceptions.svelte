<script lang="ts">
  // «Исключения»: болезнь и праздники диапазоном дат (K4). В исключение день не считается пропуском: серия, тревоги и план недели его пропускают.
  // Учёба идёт все будни круглый год (решение семьи 02.10), поэтому отдых командир назначает только здесь.
  import { game, persist } from '../../lib/store.svelte';
  import { activeExceptions, legacyExceptions, addException, deleteException, validateRange, shiftDay, spanDays, EXC_KIND_RU, EXC_BACK_DAYS, EXC_AHEAD_DAYS, EXC_MAX_DAYS, type ExceptionKind } from '../../engine/exceptions';
  import { dm } from './util';

  let from = $state(game.day);
  let to = $state(game.day);
  let kind = $state<ExceptionKind>('sick');
  let msg = $state('');
  const err = $derived(validateRange(from, to, kind, game.day));
  const recent = (d: string) => d >= shiftDay(game.day, -30);
  const list = $derived(activeExceptions(game.save).filter(e => recent(e.to)));
  const old = $derived(activeExceptions(game.save).length - list.length);   // давно прошедшие: в списке не показываем
  const legacy = $derived(legacyExceptions(game.save).filter(l => recent(l.day)));

  function add(f: string, t: string, k: ExceptionKind) {
    // повторное нажатие с тем же диапазоном ничего не добавляет (addException узнаёт уже существующее)
    const r = addException(game.save, { from: f, to: t, kind: k }, game.day, Date.now());
    if (!r.ok) { msg = r.reason; return; }
    if (r.created) persist();
    msg = r.created ? `Добавлено: ${EXC_KIND_RU[k].toLowerCase()}, ${f === t ? dm(f) : `${dm(f)} - ${dm(t)}`}.` : 'Такое исключение уже есть.';
  }
  function remove(id: string) { if (deleteException(game.save, id, Date.now())) { persist(); msg = 'Исключение удалено.'; } }
  function removeLegacy(day: string) { const r = game.save.days[day]; if (r?.exception) { delete r.exception; persist(); msg = 'Отметка дня снята.'; } }
  const span = (a: string, b: string) => { const n = spanDays(a, b); return `${n} дн.`; };
</script>

<div class="exc">
  <span class="label">Исключения: болезнь и праздники</span>
  <p class="note">В эти дни пропуск не считается пропуском: серия не рвётся, тревоги молчат, знаменатель плана недели уменьшается. Играть ребёнок может и в исключение. Можно задать на будущее (до {EXC_AHEAD_DAYS} дней вперёд) и на прошлое (до {EXC_BACK_DAYS} дней назад). Болезнь не дольше {EXC_MAX_DAYS.sick} дн. подряд, праздник не дольше {EXC_MAX_DAYS.holiday} дн.</p>
  <div class="row">
    <button class="btn small" onclick={() => add(game.day, game.day, 'sick')}>Сегодня болел</button>
    <button class="btn small" onclick={() => add(game.day, game.day, 'holiday')}>Сегодня праздник</button>
  </div>
  <form class="col form" onsubmit={e => { e.preventDefault(); if (!err) add(from, to, kind); }}>
    <div class="row">
      <label>С <input type="date" bind:value={from} min={shiftDay(game.day, -EXC_BACK_DAYS)} max={shiftDay(game.day, EXC_AHEAD_DAYS)} onchange={() => { if (to < from) to = from; }} required /></label>
      <label>По <input type="date" bind:value={to} min={from || shiftDay(game.day, -EXC_BACK_DAYS)} max={shiftDay(game.day, EXC_AHEAD_DAYS)} required /></label>
      <label>Вид
        <select bind:value={kind} aria-label="Вид исключения">
          <option value="sick">Болезнь</option>
          <option value="holiday">Праздник</option>
        </select>
      </label>
    </div>
    <div class="row">
      <button class="btn primary" type="submit" disabled={!!err}>Добавить исключение</button>
      {#if err}<span class="note">{err}</span>{/if}
    </div>
  </form>
  {#if msg}<p class="note" role="status">{msg}</p>{/if}
  {#if list.length || legacy.length}
    <ul class="elist">
      {#each list as e (e.id)}
        <li>
          <span><b>{EXC_KIND_RU[e.kind]}</b>: {e.from === e.to ? dm(e.from) : `${dm(e.from)} - ${dm(e.to)}`} <em>({span(e.from, e.to)}{e.from <= game.day && game.day <= e.to ? ', идёт сейчас' : e.from > game.day ? ', впереди' : ''})</em></span>
          <button class="btn ghost small" onclick={() => remove(e.id)} aria-label="Удалить исключение {dm(e.from)}">Удалить</button>
        </li>
      {/each}
      {#each legacy as l (l.day)}
        <li>
          <span><b>{EXC_KIND_RU[l.kind]}</b>: {dm(l.day)} <em>(отметка дня, старый способ)</em></span>
          <button class="btn ghost small" onclick={() => removeLegacy(l.day)} aria-label="Снять отметку {dm(l.day)}">Снять</button>
        </li>
      {/each}
    </ul>
  {:else}
    <p class="note">Действующих исключений нет{old ? `; прошедших больше месяца назад: ${old}` : ''}.</p>
  {/if}
</div>

<style>
  .exc { display: grid; gap: 8px; }
  .form { background: var(--deep); border: 1px dashed var(--line-hi); padding: 10px 12px; }
  .form select { font: 700 16px var(--txt); padding: 8px 10px; min-height: 40px; background: var(--deep); color: var(--ink); border: 2px solid var(--line-hi); border-radius: 6px; }
  .form input[type=date] { font: 700 16px var(--txt); padding: 8px 10px; min-height: 40px; background: var(--deep); color: var(--ink); border: 2px solid var(--line-hi); border-radius: 6px; }
  .elist { margin: 0; padding: 0; list-style: none; display: grid; gap: 4px; }
  .elist li { display: flex; justify-content: space-between; align-items: center; gap: 10px; padding: 6px 8px; background: var(--deep); }
  .elist em { font-style: normal; color: var(--dim); font-size: var(--fs-s); }
</style>
