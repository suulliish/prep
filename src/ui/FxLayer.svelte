<script lang="ts">
  import { onMount } from 'svelte';
  import { fx, attachCanvas, type Float } from './fx.svelte';
  let canvas: HTMLCanvasElement;
  onMount(() => attachCanvas(canvas));

  // Всплывающие надписи («+3 XP») не должны лежать на кнопках и плитках ответов: если точка попала на нажимаемый элемент,
  // надпись переезжает в окно 3D-сцены (там же герой и враг, куда «летит» урон); нет окна — над самим элементом.
  const TAP = 'button, .btn, .ans, input, [role="button"], a';
  function place(f: Float) {
    const el = document.elementFromPoint(f.x, f.y);
    const hit = el?.closest(TAP);
    if (!hit) return { x: Math.round(f.x), y: Math.round(f.y) };
    const canvasBox = document.querySelector('canvas.world')?.getBoundingClientRect();
    const win = document.querySelector('.frame .window')?.getBoundingClientRect();
    const box = win && win.height > 60 ? win : null;
    if (box) {
      const cx = document.documentElement.classList.contains('lsplit') && canvasBox ? canvasBox.left + canvasBox.width / 2 : box.left + box.width / 2;
      return { x: Math.round(cx), y: Math.round(box.top + box.height * 0.35) };
    }
    return { x: Math.round(f.x), y: Math.round(hit.getBoundingClientRect().top - 30) };
  }
</script>

<canvas bind:this={canvas} class="sparks" aria-hidden="true"></canvas>
{#each fx.floats as f (f.id)}
  {@const p = place(f)}
  <div class="float px" class:big={f.big} style="left:{p.x - 120}px;top:{p.y}px;color:{f.color}"><span>{f.text}</span></div>
{/each}
{#if fx.flash}<div class="flash" style="background:{fx.flash}"></div>{/if}

<style>
  .sparks { position: fixed; inset: 0; width: 100%; height: 100%; pointer-events: none; z-index: 50; }
  /* Чёткий пиксельный шрифт: без масштаба и без дробных сдвигов (это и размывало текст). Ширина блока целая (240),
     сдвиг только по вертикали шагами по пикселю, прозрачность — отдельной анимацией. */
  .float { position: fixed; z-index: 51; width: 240px; display: grid; justify-items: center; pointer-events: none; font-size: 20px; line-height: 1; white-space: nowrap;
    -webkit-font-smoothing: none; text-rendering: optimizeSpeed; animation: float-move 1.1s steps(14, end) forwards, float-fade 1.1s linear forwards; }
  .float span { text-shadow: 2px 2px 0 var(--outline), -2px 2px 0 var(--outline), 2px -2px 0 var(--outline), -2px -2px 0 var(--outline), 0 4px 0 var(--outline); }
  .float.big { font-size: 40px; }
  .flash { position: fixed; inset: 0; z-index: 49; pointer-events: none; opacity: .18; animation: fade .25s forwards; }
  @keyframes float-move { from { transform: translateY(0); } to { transform: translateY(-56px); } }
  @keyframes float-fade { 0%, 55% { opacity: 1; } 100% { opacity: 0; } }
  @keyframes fade { to { opacity: 0; } }
</style>
