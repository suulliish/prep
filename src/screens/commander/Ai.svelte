<script lang="ts">
  // «Вопросы к ИИ»: журнал «Түсінбедім» и вопросов к Биту.
  import { game, skillDefs } from '../../lib/store.svelte';
</script>

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
