<script module lang="ts">
  /** Столбик: числа выровнены по запятой, недостающие нули дописаны (pad — где они). Ответ — цифры результата справа налево. */
  export function column(a: string, b: string, op: '+' | '−') {
    const [aw, af = ''] = a.split(','), [bw, bf = ''] = b.split(',');
    const F = Math.max(af.length, bf.length);
    const A = Number(aw + af.padEnd(F, '0')), B = Number(bw + bf.padEnd(F, '0'));
    const R = op === '+' ? A + B : A - B;
    const W = Math.max(aw.length, bw.length, String(R).length - F, 1);
    const row = (w: string, f: string) => ({ w: w.padStart(W, ' '), f: f.padEnd(F, '0'), pad: F - f.length });
    const rs = String(R).padStart(W + F, '0');
    return { F, W, a: row(aw, af), b: row(bw, bf), res: { w: rs.slice(0, W).replace(/^0+(?=\d)/, (z) => ' '.repeat(z.length)), f: rs.slice(W) } };
  }
</script>

<script lang="ts">
  // «Үтір астына үтір» (C3, 02.10): екі ондық бөлшекті бағанмен қосу/азайту. Үтірлер бір бағанда, жетпейтін нөлдер сарғыш.
  // Жауаптың цифрларын оң жақтан бастап қой (бүтін сандардағыдай).
  import { audio } from '../lib/audio';
  let { a = '3,7', b = '1,25', op = '+', ondone }: { a?: string; b?: string; op?: '+' | '−'; ondone?: () => void } = $props();
  const C = column(a, b, op);
  // цифры ответа справа налево (без ведущих пробелов)
  const want = (C.res.w + C.res.f).split('').map((c, i) => ({ c, i })).filter(x => x.c !== ' ').reverse();
  let got = $state<Record<number, string>>({});
  let k = $state(0);
  const done = $derived(k >= want.length);
  const curIdx = $derived(done ? -1 : want[k].i);
  function put(d: number) {
    if (done) return;
    if (String(d) !== want[k].c) { audio.play('wrong'); return; }
    got[want[k].i] = String(d); k++; audio.play('click');
    if (k >= want.length) { audio.play('correct'); setTimeout(() => ondone?.(), 900); }
  }
  const cellsOf = (w: string, f: string) => [...w.split(''), ',', ...f.split('')];
</script>

<div class="dc">
  <div class="grid" style="--n:{C.W + C.F + 1}">
    <span class="op"></span>{#each cellsOf(C.a.w, C.a.f) as c, i}<span class="c" class:cm={c === ','} class:pad={i > C.W && i > C.W + C.F - C.a.pad}>{c === ' ' ? '' : c}</span>{/each}
    <span class="op">{op}</span>{#each cellsOf(C.b.w, C.b.f) as c, i}<span class="c" class:cm={c === ','} class:pad={i > C.W && i > C.W + C.F - C.b.pad}>{c === ' ' ? '' : c}</span>{/each}
    <span class="bar"></span>
    <span class="op"></span>{#each cellsOf(C.res.w, C.res.f) as c, i}{@const j = i > C.W ? i - 1 : i}
      {#if c === ','}<span class="c cm">,</span>{:else}<span class="c dcell" class:cur={j === curIdx} class:blank={c === ' '}>{got[j] ?? ''}</span>{/if}
    {/each}
  </div>
  <div class="pad">{#each [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] as d}<button class="btn" onclick={() => put(d)}>{d}</button>{/each}</div>
  <p class="msg">{done ? 'Дұрыс! Үтір — үтірдің астында.' : 'Сарғыш нөлдер — қосылған нөлдер. Жауапты оң жақтан бастап жаз.'}</p>
</div>

<style>
  .dc { display: grid; gap: 12px; justify-items: center; }
  .grid { display: grid; grid-template-columns: 26px repeat(var(--n), 30px); gap: 3px; align-items: center; font: 800 26px var(--disp); }
  .c { height: 40px; display: grid; place-items: center; background: #070a1a; border: 1px solid var(--line); }
  .c.cm { background: transparent; border: 0; color: var(--gold); }
  .c.pad { color: var(--gold); }
  .c.dcell.cur { border-color: var(--gold); box-shadow: 0 0 10px #ffc94a66; }
  .c.blank { visibility: hidden; }
  .op { text-align: center; color: var(--gold); }
  .bar { grid-column: 1 / -1; height: 3px; background: var(--line-hi); }
  .pad { display: grid; grid-template-columns: repeat(5, 52px); gap: 6px; }
  .pad .btn { min-height: 44px; padding: 4px; font-size: 20px; }
  .msg { font-weight: 700; text-align: center; }
</style>
