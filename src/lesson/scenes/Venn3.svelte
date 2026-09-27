<script lang="ts">
  // Три множества: stage 1 — центр (все три), 2 — «только пары», 3 — «только одно», 4 — вне кругов.
  let { m = 12, a = 10, s = 14, ma = 4, ms = 5, as: aS = 3, all = 2, total = 30, stage = 0, broken = false, names = ['М', 'Ө', 'С'] }:
    { m?: number; a?: number; s?: number; ma?: number; ms?: number; as?: number; all?: number; total?: number; stage?: number; broken?: boolean; names?: string[] } = $props();
  const r = $derived({
    all, ma: ma - all, ms: ms - all, as: aS - all,
    m: m - (ma - all) - (ms - all) - all, a: a - (ma - all) - (aS - all) - all, s: s - (ms - all) - (aS - all) - all,
  });
  const out = $derived(total - (r.all + r.ma + r.ms + r.as + r.m + r.a + r.s));
  const v = (x: number, st: number) => (broken || stage < st ? '?' : x);
</script>

<svg viewBox="0 0 300 250" class="v3" class:broken role="img" aria-label="Эйлер-Венн диаграммасы">
  <rect x="2" y="2" width="296" height="246" rx="12" class="box" />
  <circle cx="115" cy="95" r="70" class="c1" /><circle cx="185" cy="95" r="70" class="c2" /><circle cx="150" cy="155" r="70" class="c3" />
  <text x="70" y="40" class="nm n1">{names[0]} {broken ? '' : m}</text><text x="230" y="40" class="nm n2">{names[1]} {broken ? '' : a}</text><text x="150" y="243" class="nm n3">{names[2]} {broken ? '' : s}</text>
  <text x="150" y="118" class="val" class:on={stage === 1}>{v(r.all, 1)}</text>
  <text x="150" y="72" class="val" class:on={stage === 2}>{v(r.ma, 2)}</text>
  <text x="110" y="140" class="val" class:on={stage === 2}>{v(r.ms, 2)}</text>
  <text x="190" y="140" class="val" class:on={stage === 2}>{v(r.as, 2)}</text>
  <text x="88" y="85" class="val" class:on={stage === 3}>{v(r.m, 3)}</text>
  <text x="212" y="85" class="val" class:on={stage === 3}>{v(r.a, 3)}</text>
  <text x="150" y="195" class="val" class:on={stage === 3}>{v(r.s, 3)}</text>
  <text x="22" y="232" class="val out" class:on={stage === 4}>{v(out, 4)}</text>
</svg>

<style>
  .v3 { display: block; width: min(100%, 340px); margin: 0 auto; }
  .box { fill: #0b0f28; stroke: var(--line-hi); stroke-width: 2; }
  circle { fill-opacity: .12; stroke-width: 3; }
  .c1 { fill: #3ff0ff; stroke: #3ff0ff; } .c2 { fill: #ff4fb8; stroke: #ff4fb8; } .c3 { fill: #ffc94a; stroke: #ffc94a; }
  .nm { font: 800 15px Nunito, sans-serif; text-anchor: middle; }
  .n1 { fill: #3ff0ff; } .n2 { fill: #ff4fb8; } .n3 { fill: #ffc94a; }
  .val { font: 800 20px Nunito, sans-serif; fill: #f1f3ff; text-anchor: middle; dominant-baseline: middle; transition: all .3s; }
  .val.out { text-anchor: start; fill: #5ce39c; }
  .val.on { fill: #ffc94a; font-size: 26px; }
  .broken .val { fill: #ff4fb8; }
</style>
