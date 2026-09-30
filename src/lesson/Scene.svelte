<script module lang="ts">
  // Предыдущая «живая» сцена: кадры «Көр» пересоздают Scene, и сцене нужно знать, что изменилось (порезали, закрасили, добавили ветку),
  // чтобы оживить только новое, а не всё заново («Тірі түсіндіру», docs/GAME_LOOP.md 17).
  let last: { name: string; s: Record<string, any> } | null = null;
  /** Кадр пересматривают («ещё раз», «басынан»): сцена снова рисуется с нуля, со всеми анимациями. */
  export function resetScene() { last = null; }
</script>

<script lang="ts">
  // Выбор визуальной сцены урока по имени (content/lessons_week1.mjs: scene + s).
  // live — сцена в кадре «Көр»: включает пошаговую анимацию со звуком; prev — параметры прошлого кадра той же сцены (или null).
  import { untrack } from 'svelte';
  import Train from './scenes/Train.svelte';
  import Crystals from './scenes/Crystals.svelte';
  import Tiles from './scenes/Tiles.svelte';
  import Cubes from './scenes/Cubes.svelte';
  import Scanner from './scenes/Scanner.svelte';
  import Sieve from './scenes/Sieve.svelte';
  import Tree from './scenes/Tree.svelte';
  import Common from './scenes/Common.svelte';
  import Multiples from './scenes/Multiples.svelte';
  import Strike from './scenes/Strike.svelte';
  import StarDigit from './scenes/StarDigit.svelte';
  import Ladder from './scenes/Ladder.svelte';
  import Venn2 from './scenes/Venn2.svelte';
  import Venn3 from './scenes/Venn3.svelte';
  import FracBars from './scenes/FracBars.svelte';
  import FracLine from './scenes/FracLine.svelte';
  import { fitZoom } from './fit';
  const MAP: Record<string, any> = { Train, Crystals, Tiles, Cubes, Scanner, Sieve, Tree, Common, Multiples, Strike, StarDigit, Ladder, Venn2, Venn3, FracBars, FracLine };
  // hide — закрытое пропуском число (кадр «Көр» с ▢, пока ребёнок его не вписал): картинка не должна его показывать.
  // Сцены сами вычисляют числа (дерево множителей, вагоны поезда), поэтому прячем и в данных (Train), и в готовом рисунке: текст, равный hide, становится «?»
  let { name, s = {}, live = false, hide = null }: { name: string; s?: Record<string, any>; live?: boolean; hide?: string | null } = $props();
  const norm = (t: string) => t.replace(/[\s\u00a0\u202f]/g, '');
  function veil(el: HTMLElement, h: string | null) {
    let want = h ? norm(h) : '';
    // что стояло в спрятанных местах: когда ребёнок вписал число (hide → null), картинка показывает его снова
    const orig = new Map<Text, string>();
    const sweep = () => {
      if (!want) return;
      const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      for (let n = w.nextNode() as Text | null; n; n = w.nextNode() as Text | null) if (norm(n.nodeValue ?? '') === want) { orig.set(n, n.nodeValue ?? ''); n.nodeValue = '?'; }
    };
    const restore = () => { for (const [n, v] of orig) if (n.isConnected && n.nodeValue === '?') n.nodeValue = v; orig.clear(); };
    const mo = new MutationObserver(sweep); mo.observe(el, { subtree: true, childList: true, characterData: true }); sweep();
    return { update(h2: string | null) { const next = h2 ? norm(h2) : ''; if (next !== want) { mo.disconnect(); restore(); want = next; sweep(); mo.observe(el, { subtree: true, childList: true, characterData: true }); } }, destroy() { mo.disconnect(); } };
  }
  const Comp = $derived(MAP[name]);
  const prev = untrack(() => { const p = live && last && last.name === name ? last.s : null; last = live ? { name, s } : null; return p; });
</script>

<div class="scene pe" use:fitZoom use:veil={hide}>{#if Comp}<Comp {...s} {live} {prev} {hide} />{/if}</div>

<style>
  .scene { position: relative; overflow: hidden; background: radial-gradient(ellipse at 50% 0%, #1c2556 0%, #0b0f28 70%); border: 1px solid var(--line); border-radius: 10px; padding: 8px; }
  .scene::before { content: ''; position: absolute; inset: 0; background: repeating-linear-gradient(0deg, #ffffff05 0 1px, transparent 1px 3px); pointer-events: none; }
</style>
