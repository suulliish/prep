<script lang="ts">
  // «Настройки»: имя героя, доп. миссии, голос, фото «Дәптер», PIN.
  import { game, go, persist } from '../../lib/store.svelte';
  let { onlock, onchangepin }: { onlock: () => void; onchangepin: () => void } = $props();
</script>

<section class="panel card">
  <label for="hero">Имя героя (Бит обращается по нему)
    <input id="hero" type="text" maxlength="20" bind:value={game.save.heroName} onchange={persist} />
  </label>
  <label for="cap">Доп. миссий в день (по +15 мин)
    <input id="cap" type="number" min="0" max="1" bind:value={game.save.settings.extraMissionCap} onchange={persist} />
  </label>
  <fieldset>
    <legend>Куда идут минуты доп. миссий</legend>
    <label><input type="radio" name="to" value="today" bind:group={game.save.settings.extraTo} onchange={persist} /> на сегодня</label>
    <label><input type="radio" name="to" value="weekend" bind:group={game.save.settings.extraTo} onchange={persist} /> в копилку выходных</label>
  </fieldset>
  <p class="note">Правило: в будни за план — до 60 мин сегодня и до 48 мин в копилку выходных (4 часа за неделю), пропорционально выполненному. Засчитываются только честные задачи.</p>
  <label class="check"><input type="checkbox" checked={game.save.settings.voiceInput !== false} onchange={(e) => { game.save.settings.voiceInput = e.currentTarget.checked; persist(); }} /> Голосовой ввод: кнопка «Айтып бер» (микрофон)</label>
  <p class="note">Вместо того чтобы печатать, ребёнок может сказать ответ Биту вслух. Запись уходит на сервер Бита и в Gemini (Vertex) только для расшифровки и нигде не хранится; в поле появляется текст, ребёнок его видит и сам отправляет. Работает при входе в облако; браузер один раз спросит разрешение на микрофон.</p>
  <label class="check"><input type="checkbox" checked={game.save.settings.notebookPhoto !== false} onchange={(e) => { game.save.settings.notebookPhoto = e.currentTarget.checked; persist(); }} /> Проверка «Дәптер» по фото</label>
  <p class="note">После урока ребёнок пишет карточку темы в бумажной тетради. Если включено, он фотографирует её, и Бит отмечает четыре поля (правило своими словами, свой пример, ловушка Глитча, схема): ✓ верно, ½ частично, ✗ ошибка, — нет — и говорит, что исправить красной ручкой. Фото не хранится; отметки видны во вкладке «Вопросы к ИИ» (📷). Работает при входе в облако.</p>
  <button class="btn ghost" onclick={() => go({ name: 'sound' })}>Звук и музыка: громкость, режим фокуса…</button>
  <button class="btn ghost" onclick={onchangepin}>Сменить PIN (нужен пароль облака)</button>
  <button class="btn ghost" onclick={onlock}>Закрыть командира</button>
</section>
