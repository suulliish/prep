<script lang="ts">
  // «Казахский текст»: носитель языка отмечает уроки «дұрыс» / «исправить».
  import { game, persist, skillDefs } from '../../lib/store.svelte';
  // @ts-ignore
  import { LESSONS } from '../../../content/lessons.mjs';
  const lessonIds = Object.keys(LESSONS);
  function mark(id: string, v: 'ok' | 'fix') { game.save.kzReview ??= {}; game.save.kzReview[id] = v; persist(); }
</script>

<section class="panel card list">
  <p class="note">Уроки написаны на казахском как черновик. Попросите носителя языка прочитать и отметить: «дұрыс» или «исправить». Ученику показываются все уроки, но отмеченные «исправить» я перепишу.</p>
  <ul>{#each lessonIds as id}{@const v = game.save.kzReview?.[id]}
    <li><span>{skillDefs.find(d => d.id === id)?.title.kz}</span>
      <span class="rv"><button class="btn small" class:on={v === 'ok'} onclick={() => mark(id, 'ok')}>дұрыс</button><button class="btn small" class:on={v === 'fix'} onclick={() => mark(id, 'fix')}>исправить</button></span></li>{/each}</ul>
</section>
