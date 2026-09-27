<script lang="ts">
  // ЕҮОБ: множители двух чисел как фишки; отметь общие — их произведение и есть ЕҮОБ.
  import { audio } from '../lib/audio';
  let { a = 36, b = 60, ondone }: { a?: number; b?: number; ondone?: (g: number) => void } = $props();
  const fac = (n: number) => { const f: number[] = []; for (let p = 2; p * p <= n; p++) while (n % p === 0) { f.push(p); n /= p; } if (n > 1) f.push(n); return f; };
  const fa = fac(a), fb = fac(b);
  let usedA = $state<boolean[]>(fa.map(() => false)), usedB = $state<boolean[]>(fb.map(() => false));
  let common = $state<number[]>([]);
  let selA = $state(-1);
  const expected = (() => { const c: number[] = []; const bb = fb.slice(); for (const p of fa) { const k = bb.indexOf(p); if (k >= 0) { c.push(p); bb.splice(k, 1); } } return c; })();
  function tapA(i: number) { if (!usedA[i]) { selA = i; audio.play('click'); } }
  function tapB(j: number) {
    if (selA < 0 || usedB[j]) return;
    if (fa[selA] !== fb[j]) { audio.play('wrong'); selA = -1; return; }
    usedA[selA] = true; usedB[j] = true; common = [...common, fb[j]]; selA = -1; audio.play('correct');
    if (common.length === expected.length) setTimeout(() => ondone?.(common.reduce((x, y) => x * y, 1)), 700);
  }
  const g = $derived(common.reduce((x, y) => x * y, 1));
</script>

<div class="cf">
  <div class="rowf"><span class="num lbl">{a} =</span>{#each fa as p, i}<button class="chip num" class:sel={selA === i} class:used={usedA[i]} onclick={() => tapA(i)}>{p}</button>{/each}</div>
  <div class="rowf"><span class="num lbl">{b} =</span>{#each fb as p, j}<button class="chip num" class:used={usedB[j]} onclick={() => tapB(j)}>{p}</button>{/each}</div>
  <div class="mid panel"><span class="label">ОРТАҚ</span> <span class="num big">{common.length ? common.join(' · ') + ' = ' + g : '—'}</span></div>
  <p class="msg">{common.length === expected.length ? `ЕҮОБ(${a}; ${b}) = ${g}` : 'Жоғарғы қатардан көбейткішті таңда, сосын төменгі қатардан дәл сондайын — жұп табылса, ол ортақ.'}</p>
</div>

<style>
  .cf { display: grid; gap: 10px; justify-items: center; }
  .rowf { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; justify-content: center; }
  .lbl { font-size: 22px; min-width: 60px; text-align: right; }
  .chip { width: 44px; height: 44px; font-size: 20px; color: var(--ink); background: var(--panel-hi); border: 2px solid var(--line-hi); border-bottom-width: 5px; border-radius: 50%; cursor: pointer; }
  .chip.sel { border-color: var(--gold); box-shadow: 0 0 12px #ffc94a88; }
  .chip.used { background: var(--ok-deep); border-color: var(--ok); opacity: .6; cursor: default; }
  .mid { display: flex; gap: 10px; align-items: center; }
  .big { font-size: 24px; color: var(--code); }
  .msg { font-weight: 700; text-align: center; max-width: 520px; }
</style>
