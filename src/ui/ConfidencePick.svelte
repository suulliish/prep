<script lang="ts">
  // Уверенность прямо под выбранным вариантом (docs/GAME_LOOP.md 20): две кнопки ОДИНАКОВОГО цвета и размера, порядок меняется от вопроса к вопросу,
  // под каждой её цена мелко; ниже честный выход «Білмеймін». Цвет и размер не подталкивают: «всегда зелёной» нет.
  import { CONF_SAY, type Conf } from '../engine/confidence';
  let { sureFirst, onpick }: { sureFirst: boolean; onpick: (c: Conf) => void } = $props();
  const order = $derived<('sure' | 'maybe')[]>(sureFirst ? ['sure', 'maybe'] : ['maybe', 'sure']);
</script>

<div class="conf" role="group" aria-label={CONF_SAY.ask}>
  <div class="row">
    {#each order as c (c)}
      <button class="cbtn" data-conf={c} onclick={() => onpick(c)}><b>{CONF_SAY[c].title}</b><small>{CONF_SAY[c].price}</small></button>
    {/each}
  </div>
  <button class="dunno" data-conf="unsure" onclick={() => onpick('unsure')}>{CONF_SAY.dunno}</button>
</div>

<style>
  .conf { display: grid; gap: 4px; justify-items: center; animation: rise .35s cubic-bezier(.2, 1.3, .4, 1) both; }
  .row { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; width: 100%; }
  .cbtn { min-width: 0; border: 3px solid var(--outline); border-radius: 14px; background: #eaf0ff; color: var(--paper-ink); padding: 10px 8px 9px; cursor: pointer; box-shadow: 0 4px 0 var(--outline); text-align: center; }
  .cbtn:active { transform: translateY(3px); box-shadow: 0 1px 0 var(--outline); }
  .cbtn b { display: block; font: 900 clamp(15px, 4.4vw, 17px) var(--disp); }
  .cbtn small { display: block; font: 700 11.5px/1.25 var(--txt); color: var(--paper-dim); margin-top: 3px; }
  .dunno { background: none; border: 0; color: #fff; font: 800 14px var(--txt); text-decoration: underline; text-underline-offset: 4px; cursor: pointer; padding: 6px 8px; }
  @keyframes rise { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }
  @media (prefers-reduced-motion: reduce) { .conf { animation: none; } }
  @media (max-height: 460px) { .cbtn { padding: 6px 6px 6px; } .cbtn small { font-size: 10.5px; } .dunno { padding: 2px 6px; font-size: 13px; } }
</style>
