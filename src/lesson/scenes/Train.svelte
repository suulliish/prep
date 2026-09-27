<script lang="ts">
  // Разряды как поезд: локомотив + вагоны-классы по 3 места. hl — подсвеченный вагон, zeros — светятся нули,
  // broken — Глитч стёр цифры.
  let { digits = '4030005', hl = null, zeros = false, broken = false }: { digits?: string; hl?: 'm' | 't' | 'u' | null; zeros?: boolean; broken?: boolean } = $props();
  const NAMES = { u: 'БІРЛІК', t: 'МЫҢ', m: 'МИЛЛИОН' } as const;
  const wagons = $derived.by(() => {
    const out: { key: 'm' | 't' | 'u'; seats: string[] }[] = [];
    const keys = ['u', 't', 'm'] as const;
    for (let end = digits.length, k = 0; end > 0; end -= 3, k++) out.unshift({ key: keys[k], seats: digits.slice(Math.max(0, end - 3), end).split('') });
    return out;
  });
</script>

<div class="train" class:broken>
  <div class="loco"><i class="chimney"></i><i class="win"></i><i class="wheel a"></i><i class="wheel b"></i></div>
  {#each wagons as w, k (w.key)}
    <div class="wagon" class:hl={hl === w.key} class:dim={hl && hl !== w.key} style="animation-delay:{k * 90}ms">
      <span class="name">{NAMES[w.key]}</span>
      <div class="seats">
        {#each w.seats as d}<b class="seat num" class:zero={zeros && d === '0'}>{broken ? '?' : d}</b>{/each}
      </div>
      <i class="wheel a"></i><i class="wheel b"></i>
    </div>
  {/each}
</div>

<style>
  .train { display: flex; align-items: flex-end; justify-content: center; gap: 6px; padding: 18px 4px 14px; border-bottom: 3px solid #2c3877; position: relative; }
  .train::after { content: ''; position: absolute; left: 0; right: 0; bottom: -7px; height: 4px; background: repeating-linear-gradient(90deg, #4353a8 0 10px, transparent 10px 18px); }
  .loco { position: relative; width: 46px; height: 50px; background: linear-gradient(#ff6fc6, #c2338b); border-radius: 6px 14px 4px 4px; flex: none; }
  .chimney { position: absolute; left: 8px; top: -12px; width: 10px; height: 12px; background: #7d86b8; }
  .win { position: absolute; right: 7px; top: 8px; width: 14px; height: 14px; background: var(--code); box-shadow: 0 0 8px var(--code); }
  .wagon { position: relative; display: grid; justify-items: center; gap: 4px; padding: 6px 6px 12px; background: linear-gradient(#1f2a63, #141b3f); border: 2px solid var(--line-hi); border-radius: 6px; animation: roll-in .5s var(--ease-out) both; transition: transform .3s var(--ease-out), opacity .3s, border-color .3s, box-shadow .3s; }
  .wagon.hl { border-color: var(--gold); box-shadow: 0 0 18px #ffc94a66; transform: translateY(-8px); }
  .wagon.dim { opacity: .45; }
  .name { font: 800 10px var(--txt); letter-spacing: .08em; color: var(--dim); }
  .wagon.hl .name { color: var(--gold); }
  .seats { display: flex; gap: 3px; }
  .seat { width: clamp(22px, 6vw, 34px); height: clamp(30px, 8vw, 42px); display: grid; place-items: center; font-size: clamp(18px, 5vw, 26px); background: #070a1a; border: 1px solid var(--line); color: var(--ink); }
  .seat.zero { color: var(--gold); border-color: var(--gold); box-shadow: 0 0 10px #ffc94a88; animation: pop-in .4s var(--ease-out); }
  .wheel { position: absolute; bottom: -8px; width: 14px; height: 14px; border-radius: 50%; background: #2c3877; border: 3px solid #7d86b8; animation: spin 1.2s linear infinite; }
  .wheel.a { left: 6px; } .wheel.b { right: 6px; }
  .broken .seat { color: var(--glitch); border-color: var(--glitch); animation: glitch-txt .6s steps(2) infinite; }
  .broken .wagon { border-color: #7a2a63; }
  @keyframes roll-in { from { transform: translateX(-60px); opacity: 0; } }
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes glitch-txt { 50% { transform: translate(1px, -1px); text-shadow: -2px 0 var(--code); } }
</style>
