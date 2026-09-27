<script lang="ts">
  import Home from './screens/Home.svelte';
  import SoundLab from './screens/SoundLab.svelte';
  let screen = $state<'home' | 'sound'>('home');
</script>

<svelte:head>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Press+Start+2P&family=Rubik:wght@400;500;700&display=swap" />
</svelte:head>

{#if screen === 'home'}
  <Home go={(s) => (screen = s)} />
{:else}
  <SoundLab back={() => (screen = 'home')} />
{/if}
