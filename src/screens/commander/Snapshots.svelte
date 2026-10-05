<script lang="ts">
  // «Снимки облака» во вкладке «Данные» (S4): раз в сутки облако хранит копию сохранения (14 дней). Восстановление: список →
  // сравнение «сейчас → в снимке» → предупреждение и вторая кнопка → копия «до» → замена. Ответы при этом не пропадают.
  // Вкладка «Данные» уже за PIN-экраном командира. Логика — src/engine/snapshots.ts и src/lib/cloud.svelte.ts.
  import { onDestroy } from 'svelte';
  import { listSnaps, type CompareRow } from '../../engine/snapshots';
  import { fmtTime, type CloudMod } from './util';
  let { C }: { C: CloudMod } = $props();

  const ERR: Record<string, string> = {
    'no-login': 'Сначала войдите в облако.',
    busy: 'Восстановление уже идёт.',
    offline: 'Нет связи с облаком. Ничего не изменено, попробуйте ещё раз.',
    outdated: 'В облаке данные новее этой версии приложения. Закройте и откройте приложение, чтобы оно обновилось.',
    newer: 'Этот снимок записан более новой версией приложения. Обновите приложение. Ничего не изменено.',
    broken: 'Снимок повреждён и не читается. Ничего не изменено.',
    empty: 'В снимке нет прогресса (он пустой). Ничего не изменено.',
    missing: 'Такого снимка в облаке уже нет.',
    cancelled: 'Остановлено. Ничего не изменено.',
    task: 'Сейчас идёт задание. Дождитесь, пока Муртаза вернётся на корабль.',
    'before-failed': 'Не удалось сохранить копию «до». Ничего не изменено.',
  };

  let alive = true;
  onDestroy(() => { alive = false; });
  let loaded = $state(false);
  let busy = $state(false);            // идёт любая операция со снимками: вторую не начинаем
  let sel = $state<string | null>(null);
  let rows = $state<CompareRow[]>([]);
  let rollback = $state(false);
  let confirm = $state(false);
  let msg = $state('');
  let ok = $state(false);

  const list = $derived(listSnaps(C.cloud.snaps));
  const title = (id: string, kind: string) => (kind === 'before-restore' ? 'Копия до восстановления' : `Снимок за ${id.slice(8, 10)}.${id.slice(5, 7)}.${id.slice(0, 4)}`);

  async function show() {
    if (busy) return;
    busy = true; msg = '';
    const done = await C.loadSnaps();
    if (!alive) return;
    loaded = true; busy = false;
    if (!done) { ok = false; msg = ERR.offline; }
  }
  async function pick(id: string) {
    if (busy) return;
    busy = true; msg = ''; sel = id; rows = []; confirm = false;
    const r = await C.inspectSnapshot(id);
    if (!alive) return;
    busy = false;
    if (r.ok) { rows = r.rows; rollback = r.rollback; }
    else { sel = null; ok = false; msg = ERR[r.error] ?? 'Ошибка.'; }
  }
  async function restore() {
    if (busy || !sel) return;
    busy = true; msg = '';
    const r = await C.restoreSnapshot(sel, () => alive);
    if (!alive) return;
    busy = false; confirm = false;
    if (r.ok) {
      ok = true; sel = null; rows = [];
      msg = r.synced ? 'Готово: прогресс восстановлен и записан в облако. Прежний прогресс сохранён как «Копия до восстановления» — ей можно откатить.'
        : 'Прогресс восстановлен на этом устройстве. Облако обновится при следующей синхронизации (нужен интернет). Прежний прогресс сохранён как «Копия до восстановления».';
    } else { ok = false; msg = ERR[r.error] ?? 'Ошибка.'; }
  }
</script>

<div class="cloud snaps">
  <b>Снимки облака</b>
  <p class="note">Раз в сутки облако запоминает прогресс (14 дней). Если что-то пропало или сломалось, можно вернуть прогресс на день из списка. Ответы Муртазы при этом не пропадают: они сохраняются в любом случае.</p>
  {#if !loaded}
    <button class="btn" disabled={busy} onclick={show}>Показать снимки</button>
  {:else if !list.length}
    <p class="note">Снимков пока нет. Первый появится после ближайшей синхронизации в новые сутки.</p>
    <button class="btn ghost small" disabled={busy} onclick={show}>Обновить список</button>
  {:else}
    <ul class="snaplist">
      {#each list as [id, m]}
        <li class:on={sel === id}>
          <span><b>{title(id, m.kind)}</b> · {fmtTime(m.at)}<br /><span class="note">ответов {m.sum.answers} · тем {m.sum.topics} · монет {m.sum.coins}</span></span>
          <button class="btn ghost small" disabled={busy} onclick={() => pick(id)}>Сравнить</button>
        </li>
      {/each}
    </ul>
  {/if}
  {#if sel && rows.length}
    <table class="cmp">
      <thead><tr><th></th><th>Сейчас</th><th>В снимке</th></tr></thead>
      <tbody>
        {#each rows as r}<tr class:down={r.delta < 0}><td>{r.label}</td><td>{r.now}</td><td>{r.snap}{r.delta === 0 ? '' : r.delta < 0 ? ` (${r.delta})` : ` (+${r.delta})`}</td></tr>{/each}
      </tbody>
    </table>
    {#if rollback}<p class="err">В снимке меньше, чем сейчас: восстановление вернёт прогресс назад. Ответы Муртазы всё равно останутся.</p>{/if}
    {#if !confirm}
      <div class="row"><button class="btn" disabled={busy} onclick={() => (confirm = true)}>Восстановить…</button><button class="btn ghost" disabled={busy} onclick={() => { sel = null; rows = []; }}>Закрыть</button></div>
    {:else}
      <p class="err">Прогресс на этом устройстве и в облаке станет таким, как в снимке. Перед этим автоматически сохранится копия «до», и восстановление можно будет откатить. Важно: если на другом устройстве прогресс новее снимка, при синхронизации оно вернёт опыт, пройденные темы и дни, а вот монеты и план дня останутся из снимка (монеты, заработанные после снимка, пропадут). Откатить можно копией «до». Восстанавливайте, когда другое устройство не ушло вперёд. Подтверждаете?</p>
      <div class="row"><button class="btn primary" disabled={busy} onclick={restore}>{busy ? 'Восстанавливаю…' : 'Да, восстановить'}</button><button class="btn ghost" disabled={busy} onclick={() => (confirm = false)}>Отмена</button></div>
    {/if}
  {/if}
  {#if msg}<p class={ok ? 'note' : 'err'}>{msg}</p>{/if}
</div>

<style>
  .snaplist { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
  .snaplist li { display: flex; justify-content: space-between; align-items: center; gap: 8px; padding: 6px 8px; border: 1px solid var(--line-hi); border-radius: 8px; }
  .snaplist li.on { border-color: var(--ink); }
  .cmp { width: 100%; border-collapse: collapse; font-size: 14px; }
  .cmp th, .cmp td { text-align: left; padding: 4px 6px; border-bottom: 1px solid var(--line-hi); }
  .cmp tr.down td { color: #ffb36b; }
</style>
