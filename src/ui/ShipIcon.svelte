<script lang="ts">
  // Картинка предмета мастерской (public/ui/ship/<id>.png). Нет файла (ещё не нарисован) — нейтральная заглушка.
  import Icon from './Icon.svelte';
  let { src, size = 72, paper = false }: { src: string; size?: number; paper?: boolean } = $props();
  let bad = $state(false);
  $effect(() => { void src; bad = false; });
</script>

<span class="ico" style="width:{size}px;height:{size}px">
  {#if bad || !src}<Icon name="star" fill={paper ? '#14226e22' : '#ffffff33'} stroke={paper ? '#14226e33' : '#ffffff44'} size={Math.round(size * 0.5)} />
  {:else}<img src={import.meta.env.BASE_URL + src} alt="" onerror={() => (bad = true)} draggable="false" />{/if}
</span>

<style>
  .ico { flex: none; display: grid; place-items: center; }
  img { width: 100%; height: 100%; object-fit: contain; display: block; }
</style>
