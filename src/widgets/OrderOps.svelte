<script lang="ts">
  // Машина порядка действий: нажимай на знак действия, которое выполняется первым. Правильно — пара схлопывается в число.
  import { audio } from '../lib/audio';
  let { expr = ['12', '+', '3', '·', '4'], ondone }: { expr?: string[]; ondone?: () => void } = $props();
  let toks = $state<string[]>(expr.slice());
  let wrongAt = $state(-1);
  const prec = (op: string) => (op === '·' || op === ':' ? 2 : 1);
  function correctIndex(t: string[]): number {
    const lp = t.indexOf('(');
    if (lp >= 0) { const rp = t.indexOf(')', lp); return correctIndex(t.slice(lp + 1, rp)) + lp + 1; }
    let best = -1;
    for (let i = 1; i < t.length; i += 2) if (best < 0 || prec(t[i]) > prec(t[best])) best = i;
    return best;
  }
  function calc(a: number, op: string, b: number) { return op === '+' ? a + b : op === '−' ? a - b : op === '·' ? a * b : a / b; }
  function tap(i: number) {
    if (!['+', '−', '·', ':'].includes(toks[i])) return;
    const want = correctIndex(toks);
    // два независимых действия высшего приоритета («3 · 6 + 2 · 4»: оба умножения): подходит любое; общий операнд («8 : 2 · 2») или скобки: только первое слева
    const indep = !toks.includes('(') && i !== want && prec(toks[i]) === prec(toks[want]) && Math.abs(i - want) >= 4;
    if (i !== want && !indep) { wrongAt = i; audio.play('wrong'); setTimeout(() => (wrongAt = -1), 500); return; }
    const v = calc(+toks[i - 1], toks[i], +toks[i + 1]);
    const next = [...toks.slice(0, i - 1), String(v), ...toks.slice(i + 2)];
    const k = next.findIndex((x, j) => x === '(' && next[j + 2] === ')');
    if (k >= 0) next.splice(k, 3, next[k + 1]);
    toks = next; audio.play('correct');
    if (toks.length === 1) setTimeout(() => ondone?.(), 800);
  }
</script>

<div class="oo">
  <div class="line">
    {#each toks as t, i (i + t + toks.length)}
      {#if ['+', '−', '·', ':'].includes(t)}
        <button class="op num" class:bad={wrongAt === i} onclick={() => tap(i)}>{t}</button>
      {:else}
        <span class="tok num" class:big={toks.length === 1}>{t}</span>
      {/if}
    {/each}
  </div>
  <p class="msg">{toks.length === 1 ? 'Дайын! Жауабы: ' + toks[0] : 'Бірінші орындалатын амалдың белгісін бас.'}</p>
</div>

<style>
  .oo { display: grid; gap: 12px; justify-items: center; }
  .line { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; justify-content: center; font-size: 30px; min-height: 64px; }
  .tok { padding: 4px 6px; animation: pop-in .3s var(--ease-out); }
  .tok.big { font-size: 48px; color: var(--code); text-shadow: 0 0 16px #3ff0ff88; }
  .op { width: 48px; height: 48px; font-size: 28px; color: var(--gold); background: var(--panel-hi); border: 2px solid var(--gold-deep); border-bottom-width: 5px; border-radius: 8px; cursor: pointer; }
  .op:hover { border-color: var(--gold); }
  .op.bad { animation: shake .35s; border-color: var(--miss); }
  .msg { font-weight: 700; text-align: center; }
</style>
