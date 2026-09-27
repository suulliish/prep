<script lang="ts">
  // Карта миссии: узлы шагов с иконками + здоровье вируса Глитча (каждый пройденный шаг — удар).
  let { types, at, hp, max, target }: { types: string[]; at: number; hp: number; max: number; target: string } = $props();
  const ICON: Record<string, string> = { goal: '!', widget: '✋', predict: '?', example: '◉', faded: '✎', why: '¿', bug: '✖', blitz: '⚡', rule: '★', final: '⚑', quiz: '?', say: '…' };
</script>

<div class="mb">
  <div class="virus">
    <span class="tag">ВИРУС</span>
    <div class="hp"><i style="width:{(hp / max) * 100}%"></i>{#each Array(max - 1) as _, k}<b style="left:{((k + 1) / max) * 100}%"></b>{/each}</div>
    <span class="pct num">{Math.round((hp / max) * 100)}%</span>
  </div>
  <small class="tgt">{hp > 0 ? `«${target}» жүйесі бұзылған` : `«${target}» жөнделді!`}</small>
  <ol class="path">
    {#each types as t, k}
      <li class="n {t}" class:done={k < at} class:cur={k === at}><span>{k < at ? '✓' : ICON[t] ?? '•'}</span></li>
    {/each}
  </ol>
</div>

<style>
  .mb { display: grid; gap: 6px; }
  .virus { display: flex; align-items: center; gap: 8px; }
  .tag { font: 800 11px var(--txt); letter-spacing: .1em; color: var(--void); background: var(--glitch); padding: 2px 6px; border-radius: 3px; }
  .hp { position: relative; flex: 1; height: 14px; background: #1b0b1f; border: 2px solid #5c1d45; overflow: hidden; }
  .hp i { display: block; height: 100%; background: linear-gradient(90deg, var(--glitch), #ff9ad6); transition: width .5s var(--ease-out); box-shadow: 0 0 10px var(--glitch); }
  .hp b { position: absolute; top: 0; bottom: 0; width: 2px; background: #1b0b1f; }
  .pct { font-size: 14px; color: var(--glitch); min-width: 38px; text-align: right; }
  .tgt { color: var(--dim); font-weight: 700; font-size: 12px; }
  @media (max-width: 600px) { .tgt { display: none; } }
  .path { list-style: none; margin: 0; padding: 0; display: flex; align-items: center; gap: 0; }
  .n { flex: 1; display: flex; align-items: center; min-width: 0; }
  .n::before { content: ''; flex: 1; height: 2px; background: var(--line); }
  .n:first-child::before { display: none; }
  .n.done::before, .n.cur::before { background: var(--code); }
  .n span { flex: none; width: 24px; height: 24px; display: grid; place-items: center; font: 800 12px var(--txt); color: var(--faint); background: #070a1a; border: 2px solid var(--line); border-radius: 50%; transition: all .3s; }
  .n.done span { background: var(--code-deep); border-color: var(--code); color: var(--code); }
  .n.cur span { width: 30px; height: 30px; font-size: 14px; background: var(--code); border-color: #b9fdff; color: var(--void); box-shadow: 0 0 14px var(--code); animation: pop-in .35s var(--ease-out); }
  .n.goal span, .n.final span { border-color: var(--gold-deep); }
  .n.final.cur span, .n.goal.cur span { background: var(--gold); border-color: #fff2c4; box-shadow: 0 0 14px var(--gold); }
  .n.bug.cur span { background: var(--glitch); border-color: #ffd6ef; box-shadow: 0 0 14px var(--glitch); }
  @media (max-width: 420px) { .n span { width: 20px; height: 20px; font-size: 10px; } .n.cur span { width: 26px; height: 26px; } }
</style>
