<script lang="ts">
  // «Темы»: статус каждой темы по разделам.
  import { game, skillDefs } from '../../lib/store.svelte';
  const STATUS: Record<string, string> = { locked: 'закрыта', available: 'доступна', learning: 'изучается', learned: 'изучена', mastered: 'освоена 💎', automatic: 'автоматизм' };
  const CAT: Record<string, string> = { A: 'Уравнения, выражения', B: 'Текстовые задачи', C: 'Вычисления', D: 'Делимость', E: 'Геометрия', F: 'Пропорции', G: 'Проценты', H: 'Закономерности', I: 'Логика', J: 'Визуальная логика', K: 'Координаты' };
</script>

<section class="panel card list">
  {#each Object.keys(CAT) as c}
    {@const list = skillDefs.filter(d => d.cat === c)}
    <details>
      <summary>{CAT[c]} · {list.filter(d => ['learned', 'mastered', 'automatic'].includes(game.save.skills[d.id]?.status)).length}/{list.length}</summary>
      <ul>{#each list as d}{@const s = game.save.skills[d.id]}<li><span>{d.title.ru}</span><em class={s?.status}>{STATUS[s?.status ?? 'locked']}</em></li>{/each}</ul>
    </details>
  {/each}
</section>
