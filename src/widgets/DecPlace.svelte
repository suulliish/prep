<script module lang="ts">
  /** Раунд «Үтірді жылжыт»: цифры в ряд (с запасными нулями по краям), запятая стоит после from-й цифры, верное место — после to-й. */
  export interface CommaRound { said: string; digits: string; from: number; to: number }
  /** Число, которое получилось: цифры с запятой после k-й, без лишних нулей по краям («034500», 3 → «34,5»). */
  export function commaValue(digits: string, k: number): string {
    const w = digits.slice(0, k).replace(/^0+(?=\d)/, '') || '0', f = digits.slice(k).replace(/0+$/, '');
    return f ? `${w},${f}` : w;
  }
</script>

<script lang="ts">
  // Ондық бөлшектің разрядтары (C3, 02.10).
  //  mode 'fill'  — said («2 бүтін жүзден 5») бойынша ұяшықтарға цифр қой: үтірге дейін бүтін бөлігі, кейін ондық, жүздік, мыңдық үлестер. Бос разряд — 0.
  //  mode 'comma' — «Үтірді жылжыт»: 10, 100, 1000-ға көбейткенде/бөлгенде үтір қайда тұрады? Цифрлардың арасын бас.
  import { audio } from '../lib/audio';
  let { mode = 'fill', whole = '2', frac = '05', said = '2 бүтін жүзден 5', rounds = [], ondone }:
    { mode?: 'fill' | 'comma'; whole?: string; frac?: string; said?: string; rounds?: CommaRound[]; ondone?: () => void } = $props();

  // ---------- fill ----------
  const target = (whole + frac).split('').map(Number);
  const W = whole.length;
  let cells = $state<(number | null)[]>(Array(target.length).fill(null));
  let cur = $state(0);
  const PL = ['ОНДЫҚ', 'ЖҮЗДІК', 'МЫҢДЫҚ'];
  function put(d: number) {
    if (mode !== 'fill' || cur >= target.length) return;
    if (d !== target[cur]) { audio.play('wrong'); return; }
    cells[cur] = d; cur++; audio.play('click');
    if (cur >= target.length) { audio.play('correct'); setTimeout(() => ondone?.(), 800); }
  }

  // ---------- comma ----------
  let ri = $state(0), at = $state<number | null>(null), bad = $state(false), solved = $state(false);
  const R = $derived(rounds[Math.min(ri, rounds.length - 1)]);
  const comma = $derived(at ?? R?.from ?? 0);
  function tap(k: number) {
    if (mode !== 'comma' || solved || !R) return;
    at = k;
    if (k !== R.to) { bad = true; audio.play('wrong'); setTimeout(() => (bad = false), 450); return; }
    solved = true; audio.play(ri + 1 >= rounds.length ? 'correct' : 'xp');
    setTimeout(() => {
      if (ri + 1 >= rounds.length) { ondone?.(); return; }
      ri++; at = null; solved = false;
    }, 1100);
  }
</script>

{#if mode === 'fill'}
  <div class="dp">
    <p class="said">{said}</p>
    <div class="row">
      <div class="grp"><span class="label">БҮТІН</span>
        <div class="cells">{#each target.slice(0, W) as _, i}<span class="cell num" class:cur={i === cur} class:zero={cells[i] === 0}>{cells[i] ?? ''}</span>{/each}</div>
      </div>
      <span class="comma">,</span>
      {#each target.slice(W) as _, j}{@const i = W + j}
        <div class="grp"><span class="label">{PL[j] ?? ''}</span>
          <div class="cells"><span class="cell num" class:cur={i === cur} class:zero={cells[i] === 0}>{cells[i] ?? ''}</span></div>
        </div>
      {/each}
    </div>
    <div class="pad">{#each [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] as d}<button class="btn" onclick={() => put(d)}>{d}</button>{/each}</div>
    <p class="msg">{cur >= target.length ? 'Дұрыс! Бос разрядқа нөл жазылды.' : 'Сарғыш ұяшыққа цифр қой. Бос разряд — 0.'}</p>
  </div>
{:else if R}
  <div class="dp">
    <p class="said">{R.said}</p>
    <div class="row line" class:bad>
      {#each R.digits.split('') as d, k}
        <button class="gap" class:on={comma === k} aria-label="үтір {k}" onclick={() => tap(k)}>{comma === k ? ',' : ''}</button>
        <span class="cell num">{d}</span>
      {/each}
      <button class="gap" class:on={comma === R.digits.length} aria-label="үтір {R.digits.length}" onclick={() => tap(R.digits.length)}>{comma === R.digits.length ? ',' : ''}</button>
    </div>
    <p class="msg">{solved ? `Дұрыс! ${commaValue(R.digits, R.to)}` : 'Үтір қайда тұрады? Цифрлардың арасын бас.'}</p>
  </div>
{/if}

<style>
  .dp { display: grid; gap: 12px; justify-items: center; }
  .said { font-weight: 800; font-size: 20px; text-align: center; }
  .row { display: flex; gap: 6px; align-items: flex-end; flex-wrap: wrap; justify-content: center; }
  .grp { display: grid; gap: 4px; justify-items: center; }
  .label { font-size: 11px; }
  .cells { display: flex; gap: 3px; padding: 6px; border: 2px solid var(--line-hi); background: var(--deep); }
  .cell { width: 34px; height: 44px; display: grid; place-items: center; font-size: 26px; background: #070a1a; border: 1px solid var(--line); }
  .cell.cur { border-color: var(--gold); box-shadow: 0 0 10px #ffc94a66; }
  .cell.zero { color: var(--gold); }
  .comma { font: 800 34px var(--disp); color: var(--gold); padding-bottom: 6px; }
  .line { gap: 0; align-items: center; }
  .line.bad { animation: shake .3s; }
  .gap { width: 22px; min-width: 22px; height: 52px; padding: 0; border: 0; background: transparent; color: var(--gold); font: 800 34px var(--disp); cursor: pointer; }
  .gap:not(.on)::after { content: ''; display: block; width: 4px; height: 4px; margin: 24px auto 0; border-radius: 50%; background: var(--line-hi); }
  .pad { display: grid; grid-template-columns: repeat(5, 52px); gap: 6px; }
  .pad .btn { min-height: 44px; padding: 4px; font-size: 20px; }
  .msg { font-weight: 700; text-align: center; }
  @keyframes shake { 25% { transform: translateX(-5px); } 75% { transform: translateX(5px); } }
</style>
