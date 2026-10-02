<script lang="ts">
  // Иконки дизайн-системы (docs/DESIGN_SYSTEM.md 8): SVG 24×24, заливка + тёмный контур, как у кнопок.
  type Name = 'back' | 'sound' | 'mute' | 'gear' | 'map' | 'hero' | 'cards' | 'clock' | 'crystal' | 'fire' | 'bolt' | 'lock'
    | 'check' | 'cross' | 'star' | 'play' | 'sword' | 'book' | 'flag' | 'bulb' | 'mob' | 'chevron' | 'close' | 'coin' | 'hammer' | 'mic' | 'stop' | 'camera';
  let { name, size = 24, fill = 'currentColor', stroke = 'var(--outline)' }: { name: Name; size?: number; fill?: string; stroke?: string } = $props();
</script>

<svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" fill={fill} stroke={stroke} stroke-width="2" stroke-linejoin="round" stroke-linecap="round">
  {#if name === 'back'}<path d="M14.5 4.5 7 12l7.5 7.5" fill="none" stroke={fill} stroke-width="3.6" />
  {:else if name === 'chevron'}<path d="M9.5 4.5 17 12l-7.5 7.5" fill="none" stroke={fill} stroke-width="3.6" />
  {:else if name === 'close'}<path d="M6 6l12 12M18 6 6 18" fill="none" stroke={fill} stroke-width="3.4" />
  {:else if name === 'sound'}<path d="M3 9h4l5-4v14l-5-4H3z" /><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke={fill} stroke-width="2.4" />
  {:else if name === 'mute'}<path d="M3 9h4l5-4v14l-5-4H3z" /><path d="M16 9l6 6M22 9l-6 6" fill="none" stroke={fill} stroke-width="2.4" />
  {:else if name === 'gear'}<path d="M10 2h4l.6 2.6 2.3 1 2.3-1.4 2.8 2.8-1.4 2.3 1 2.3L24 12v0l-2.4.6-1 2.3 1.4 2.3-2.8 2.8-2.3-1.4-2.3 1L14 22h-4l-.6-2.4-2.3-1-2.3 1.4L2 17.2l1.4-2.3-1-2.3L0 12l2.4-.6 1-2.3L2 6.8 4.8 4l2.3 1.4 2.3-1z" transform="scale(.92) translate(1 1)" /><circle cx="12" cy="12" r="3.4" fill="var(--outline)" stroke="none" />
  {:else if name === 'map'}<path d="M2 5l6-2 8 2 6-2v16l-6 2-8-2-6 2z" /><path d="M8 3v16M16 5v16" fill="none" />
  {:else if name === 'hero'}<rect x="6" y="2.5" width="12" height="10" rx="3" /><rect x="7.5" y="6" width="9" height="3" rx="1" fill="#35e6ff" /><path d="M5 22v-4.5A4.5 4.5 0 0 1 9.5 13h5a4.5 4.5 0 0 1 4.5 4.5V22z" />
  {:else if name === 'cards'}<rect x="3" y="5" width="12" height="16" rx="2" transform="rotate(-10 9 13)" /><rect x="9" y="3" width="12" height="16" rx="2" /><path d="M15 8l2 3-2 3-2-3z" fill="var(--outline)" stroke="none" />
  {:else if name === 'clock'}<circle cx="12" cy="12" r="9.5" /><path d="M12 6.5V12l3.5 2.5" fill="none" stroke="var(--outline)" stroke-width="2.6" />
  {:else if name === 'crystal'}<path d="M6 3h12l4 6-10 12L2 9z" /><path d="M2 9h20M9 3l3 18 3-18" fill="none" stroke-width="1.4" />
  {:else if name === 'fire'}<path d="M12 22c-4.5 0-7.5-3-7.5-7 0-4 3-6 4-9.5 2.5 1.5 3 3.5 3 5 1-1 1.5-2.5 1.5-4 3 2 5.5 5 5.5 8.5 0 4-2.5 7-6.5 7z" /><path d="M12 22c-1.8 0-3-1.3-3-3 0-2 1.5-3 2-4.5 1.5 1 3.5 2.5 3.5 4.5 0 1.7-1 3-2.5 3z" fill="#ffe38a" stroke-width="1.2" />
  {:else if name === 'bolt'}<path d="M13.5 1.5 4 13.5h6.5L9 22.5l11-13h-7z" />
  {:else if name === 'lock'}<rect x="4.5" y="10" width="15" height="12" rx="2.5" /><path d="M7.5 10V7a4.5 4.5 0 0 1 9 0v3" fill="none" stroke-width="2.8" /><circle cx="12" cy="15.5" r="1.8" fill="var(--outline)" stroke="none" />
  {:else if name === 'check'}<path d="M4 12.5l5 5L20 6.5" fill="none" stroke={fill} stroke-width="3.8" />
  {:else if name === 'cross'}<path d="M6 6l12 12M18 6 6 18" fill="none" stroke={fill} stroke-width="3.8" />
  {:else if name === 'star'}<path d="M12 2l3 6.5 7 .8-5.2 4.8 1.5 7L12 17.6 5.7 21.1l1.5-7L2 9.3l7-.8z" />
  {:else if name === 'play'}<path d="M7 4l13 8-13 8z" />
  {:else if name === 'sword'}<path d="M20.5 2.5 21.5 6 10 17.5 6.5 14z" /><path d="M5 12.5l6.5 6.5M4 20l3-3" fill="none" stroke-width="2.8" /><circle cx="3.5" cy="20.5" r="1.8" />
  {:else if name === 'book'}<path d="M3 4.5c3-1 6-1 9 1 3-2 6-2 9-1v15c-3-1-6-1-9 1-3-2-6-2-9-1z" /><path d="M12 5.5v15" fill="none" />
  {:else if name === 'flag'}<path d="M5 22V3" fill="none" stroke-width="2.6" /><path d="M5 4h13l-3 4.5L18 13H5z" />
  {:else if name === 'bulb'}<path d="M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z" /><rect x="8.5" y="18" width="7" height="3.5" rx="1.2" />
  {:else if name === 'mob'}<rect x="3" y="4" width="18" height="16" rx="4" /><circle cx="12" cy="11" r="4" fill="#fff" /><circle cx="12" cy="11" r="1.8" fill="var(--outline)" stroke="none" /><path d="M7 20v2M12 20v2M17 20v2" fill="none" />
  {:else if name === 'coin'}<circle cx="12" cy="12" r="9.5" /><circle cx="12" cy="12" r="5.8" fill="none" stroke="var(--outline)" stroke-width="1.8" /><path d="M9.6 10.2a3.3 3.3 0 0 1 2-1.4" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" />
  {:else if name === 'hammer'}<path d="M3.5 8.5 9 3l5.5 1.2 2.8 2.8L15 9.3l-1.7-1.7L8 12.9z" /><path d="M11.5 10.5 20.5 19.5a2 2 0 0 1-2.9 2.9L8.6 13.4z" />
  {:else if name === 'mic'}<rect x="8" y="2" width="8" height="13" rx="4" /><path d="M5 11a7 7 0 0 0 14 0M12 18v4M8.5 22h7" fill="none" stroke-width="2.6" />
  {:else if name === 'stop'}<rect x="5" y="5" width="14" height="14" rx="3" />
  {:else if name === 'camera'}<path d="M3 8a2 2 0 0 1 2-2h2.5l1.5-2.5h6L16.5 6H19a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><circle cx="12" cy="13" r="4" fill="var(--outline)" stroke="none" /><circle cx="12" cy="13" r="2.2" fill="#fff" stroke="none" />
  {/if}
</svg>

<style>
  svg { display: block; flex: none; overflow: visible; }
</style>
