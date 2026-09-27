<script lang="ts">
  // ЕКОЕ: два автобуса прыгают по шкале времени шагами a и b. Где впервые встретятся — ЕКОЕ.
  import { audio } from '../lib/audio';
  let { a = 6, b = 8, ondone }: { a?: number; b?: number; ondone?: (l: number) => void } = $props();
  const gcd = (x: number, y: number): number => (y ? gcd(y, x % y) : x);
  const L = (a * b) / gcd(a, b);
  const max = L + Math.max(a, b);
  let ta = $state(0), tb = $state(0), met = $state(false);
  function stepA() { if (met) return; ta += a; audio.play('xp'); check(); }
  function stepB() { if (met) return; tb += b; audio.play('xp'); check(); }
  function check() { if (ta === tb && ta > 0) { met = true; audio.play('chest'); setTimeout(() => ondone?.(ta), 900); } }
  const ticks = $derived(Array.from({ length: Math.floor(max / Math.min(a, b)) + 1 }, (_, i) => i * gcd(a, b)).filter(x => x <= max));
</script>

<div class="bt">
  <div class="track">
    {#each ticks as t}<span class="tk" style="left:{(t / max) * 100}%"><i></i><small class="num">{t}</small></span>{/each}
    <span class="bus a" style="left:{(ta / max) * 100}%">A</span>
    <span class="bus b" style="left:{(tb / max) * 100}%">B</span>
  </div>
  <div class="row">
    <button class="btn primary" onclick={stepA} disabled={met || ta > tb}>A автобус +{a} мин</button>
    <button class="btn gold" onclick={stepB} disabled={met || tb > ta}>B автобус +{b} мин</button>
  </div>
  <p class="msg">{met ? `Кездесті! ${ta} минутта. ЕКОЕ(${a}; ${b}) = ${ta}` : 'Артта қалған автобусты алға жүргіз. Екеуі бір нүктеге келгенде — ол ЕКОЕ.'}</p>
</div>

<style>
  .bt { display: grid; gap: 14px; }
  .track { position: relative; height: 80px; margin: 0 20px; border-bottom: 3px solid var(--line-hi); }
  .tk { position: absolute; bottom: -24px; transform: translateX(-50%); display: grid; justify-items: center; }
  .tk i { width: 2px; height: 10px; background: var(--line-hi); }
  .tk small { color: var(--dim); font-size: 12px; }
  .bus { position: absolute; transform: translateX(-50%); width: 34px; height: 26px; display: grid; place-items: center; font-weight: 800; color: var(--void); transition: left .45s var(--ease-out); }
  .bus.a { bottom: 34px; background: var(--code); }
  .bus.b { bottom: 4px; background: var(--gold); }
  .row { display: flex; gap: 8px; justify-content: center; flex-wrap: wrap; margin-top: 18px; }
  .msg { font-weight: 700; text-align: center; }
</style>
