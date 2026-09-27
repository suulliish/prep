<script lang="ts">
  // Общие простые множители двух чисел: stage 0 — разложения, 1 — общие подсвечены, 2 — их произведение (НОД).
  let { a = 36, b = 60, stage = 0, broken = false }: { a?: number; b?: number; stage?: number; broken?: boolean } = $props();
  const fac = (n: number) => { const f: number[] = []; for (let p = 2; p * p <= n; p++) while (n % p === 0) { f.push(p); n /= p; } if (n > 1) f.push(n); return f; };
  const pair = $derived.by(() => {
    const fa = fac(a), fb = fac(b), used = new Set<number>(), ca = fa.map(() => false), cb = fb.map(() => false);
    fa.forEach((p, i) => { const j = fb.findIndex((q, k) => q === p && !used.has(k)); if (j >= 0) { used.add(j); ca[i] = true; cb[j] = true; } });
    return { fa, fb, ca, cb, g: fa.filter((_, i) => ca[i]) };
  });
</script>

<div class="cm" class:broken>
  {#each [{ n: a, f: pair.fa, c: pair.ca }, { n: b, f: pair.fb, c: pair.cb }] as { n, f, c }, r}
    <div class="row" style="animation-delay:{r * 120}ms">
      <b class="num lbl">{broken ? '??' : n} =</b>
      {#each f as p, i}<span class="t num" class:on={stage >= 1 && c[i]}>{broken ? '?' : p}</span>{#if i < f.length - 1}<i>·</i>{/if}{/each}
    </div>
  {/each}
  {#if stage >= 2}<p class="res num">ЕҮОБ = {pair.g.join(' · ') || '1'} = {pair.g.reduce((s, x) => s * x, 1)}</p>{/if}
</div>

<style>
  .cm { display: grid; gap: 10px; justify-items: center; padding: 10px 0; }
  .row { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; justify-content: center; animation: pop-in .4s var(--ease-out) both; }
  .lbl { font-size: 22px; min-width: 56px; text-align: right; }
  .t { width: 40px; height: 44px; display: grid; place-items: center; font-size: 22px; background: var(--deep); border: 2px solid var(--line-hi); border-radius: 8px; transition: all .35s; }
  .t.on { border-color: var(--gold); color: var(--gold); background: #3a2a07; box-shadow: 0 0 14px #ffc94a77; transform: translateY(-3px); }
  i { font-style: normal; color: var(--dim); }
  .res { font-size: 24px; font-weight: 800; color: var(--gold); animation: pop-in .4s var(--ease-out); }
  .broken .t, .broken .lbl { color: var(--glitch); border-color: #7a2a63; }
</style>
