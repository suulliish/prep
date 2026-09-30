<script lang="ts">
  // Этажная дробь: алым над чертой, бөлім под ней. whole — целая часть смешанного числа («2 3/4»).
  // size: число (px) или sm/md/lg/xl; без size берёт размер шрифта родителя.
  let { n, d, whole = null, size, color }: { n: number | string; d: number | string; whole?: number | string | null; size?: number | 'sm' | 'md' | 'lg' | 'xl'; color?: string } = $props();
  const PX = { sm: 15, md: 20, lg: 28, xl: 40 };
  const fs = $derived(size === undefined ? undefined : typeof size === 'number' ? size : PX[size]);
</script>

<span class="frac num" style:font-size={fs !== undefined ? `${fs}px` : undefined} style:color role="math" aria-label="{whole !== null ? whole + ' ' : ''}{n}/{d}">
  {#if whole !== null}<span class="w">{whole}</span>{/if}
  <span class="st"><span class="t">{n}</span><span class="b">{d}</span></span>
</span>

<style>
  .frac { display: inline-flex; align-items: center; vertical-align: middle; gap: .14em; line-height: 1; letter-spacing: 0; white-space: nowrap; }
  .w { font-size: 1em; }
  .st { display: inline-flex; flex-direction: column; align-items: stretch; text-align: center; font-size: .82em; line-height: 1.05; }
  .t { padding: 0 .16em .06em; border-bottom: .09em solid currentColor; }
  .b { padding: .06em .16em 0; }
</style>
