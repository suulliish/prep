<script lang="ts">
  // Самопроверка «Тексер» (docs/GAME_LOOP.md 20, src/engine/selfcheck.ts): прямо под выбранным вариантом, до выбора уверенности.
  // Две кнопки одного цвета и размера: «Тексердім, дұрыс» (идём к уверенности) и «Қателесіппін, өзгертемін» (назад к вариантам).
  // Подсказка называет только действие проверки, но не верный ответ. «Уменьшить движение»: без анимаций.
  import { SELF_SAY, type SelfCheck } from '../engine/selfcheck';
  let { check, onok, onchange }: { check: SelfCheck; onok: () => void; onchange: () => void } = $props();
</script>

<div class="sc" role="group" aria-label={SELF_SAY.title}>
  <p><b>{SELF_SAY.title}:</b> {check.text}</p>
  <div class="row">
    <button class="scbtn" data-self="ok" onclick={onok}>{SELF_SAY.ok}</button>
    <button class="scbtn" data-self="change" onclick={onchange}>{SELF_SAY.change}</button>
  </div>
</div>

<style>
  .sc { display: grid; gap: 6px; padding: 8px 8px 8px; border: 3px solid var(--outline); border-radius: 14px; background: #fff7d6; color: var(--paper-ink); animation: scRise .3s cubic-bezier(.2, 1.3, .4, 1) both; }
  .sc p { margin: 0; font: 700 14px/1.3 var(--txt); }
  .sc b { font: 900 15px var(--disp); color: #7a5200; }
  .row { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .scbtn { min-width: 0; min-height: 44px; border: 3px solid var(--outline); border-radius: 12px; background: #eaf0ff; color: var(--paper-ink); padding: 6px 8px; cursor: pointer; box-shadow: 0 3px 0 var(--outline); font: 900 clamp(13px, 3.8vw, 15px)/1.15 var(--disp); text-align: center; }
  .scbtn:active { transform: translateY(2px); box-shadow: 0 1px 0 var(--outline); }
  @keyframes scRise { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
  @media (prefers-reduced-motion: reduce) { .sc { animation: none; } }
  @media (max-height: 460px) { .sc { gap: 4px; padding: 5px 6px; } .sc p { font-size: 12.5px; } .scbtn { min-height: 36px; padding: 3px 6px; font-size: 13px; } }
</style>
