<script lang="ts">
  // Кеме шеберханасы (docs/GAME_LOOP.md 5, L5): украшения и питомцы за монеты. Только красота, на учёбу не влияет.
  // Купил — предмет сразу встаёт на палубу, а камера показывает его в окне сцены (showDecor); питомец — один активный.
  import { onMount } from 'svelte';
  import Screen from '../ui/Screen.svelte';
  import Icon from '../ui/Icon.svelte';
  import ShipIcon from '../ui/ShipIcon.svelte';
  import CoinChip from '../ui/CoinChip.svelte';
  import { game, go } from '../lib/store.svelte';
  import { W } from '../lib/world.svelte';
  import { audio } from '../lib/audio';
  import { toast } from '../ui/notify.svelte';
  import { sceneCenter, sparksAt } from '../ui/fx.svelte';
  import { ITEMS, SLOTS, COINS, coinsOf, isOwned, activePet, purchase, choosePet, syncDecor, showDecor, type ShipItem, type Slot } from '../lib/ship.svelte';

  let tab = $state<Slot>('deck');
  let ask = $state<ShipItem | null>(null);   // предмет, который хотят купить (шторка подтверждения)
  // Праздник покупки (камера показывает предмет) и защита от «хвоста» двойного касания: пока идёт праздник и 450 мс после закрытия шторки,
  // «Кемеге» и «назад» не срабатывают, а невидимый щит ловит касание, которое пришлось бы на кнопку под шторкой.
  let showing = $state(0), shield = $state(false);
  const locked = $derived(showing > 0 || shield);
  const coins = $derived(coinsOf(game.save));
  const list = $derived(ITEMS.filter(i => i.slot === tab).sort((a, b) => a.price - b.price));
  const pet = $derived(activePet(game.save));
  const ownedN = $derived(ITEMS.filter(i => isOwned(game.save, i.id)).length);
  const canBuyIn = (s: Slot) => ITEMS.some(i => i.slot === s && !isOwned(game.save, i.id) && i.price <= coins);
  const need = $derived(ask ? Math.max(0, ask.price - coins) : 0);

  onMount(() => {
    W.dim = false; W.world?.clearMob(); W.world?.setMode('hub'); W.world?.bitMood('happy');
    audio.setMood('hub'); syncDecor();
  });

  function tap(it: ShipItem) {
    audio.play('click');
    if (!isOwned(game.save, it.id)) { ask = it; return; }
    if (it.slot === 'pet') {
      // тот же питомец ещё раз — отпустить домой; другой — заменит (один за раз)
      if (pet === it.id) { choosePet(null); toast(`${it.kz} үйінде қалды`); }
      else { choosePet(it.id); toast(`${it.kz} енді кемеде жүреді`); void showDecor(it.id); }
    } else void showDecor(it.id);   // уже стоит на палубе: камера снова показывает его
  }

  /** Показ нового предмета: не дольше 12 с (питомец может долго грузиться), кнопки выхода закрыты, пока он идёт. Новая покупка не ждёт конца показа: мир сам переключает камеру на новый предмет. */
  async function celebrate(id: string) {
    showing++;
    try { await Promise.race([showDecor(id), new Promise(r => setTimeout(r, 12000))]); } finally { showing--; }
  }

  function buyNow() {
    const it = ask;
    if (!it) return;                          // шторка уже закрыта: повторное касание «Алу» ничего не делает
    const r = purchase(it.id);
    ask = null;
    if (!r.ok) return;
    shield = true; setTimeout(() => (shield = false), 450);
    audio.play('coins'); audio.play('levelup');
    const c = sceneCenter(0.3); sparksAt(c.x, c.y, ['#ffcb2e', '#35e6ff', '#ff4fb8', '#ffffff'], 60, 9);
    toast(it.slot === 'pet' ? `${it.kz} кемеге келді!` : `${it.kz} палубада!`);
    W.world?.bitMood('happy');
    void celebrate(it.id);
  }
  const leave = () => { if (!locked) go({ name: 'hub' }); };
</script>

<Screen scene="short" title="Шеберхана" sub={`Кеме шеберханасы · ${ownedN}/${ITEMS.length}`} back={leave}>
  {#snippet right()}<CoinChip value={coins} />{/snippet}

  <div class="seg" role="tablist" aria-label="Орын">
    {#each SLOTS as s (s.id)}
      <button role="tab" class:on={tab === s.id} aria-selected={tab === s.id} onclick={() => { tab = s.id; audio.play('click'); }}>
        {s.kz}{#if canBuyIn(s.id)}<i class="dot" aria-label="Алуға болады"></i>{/if}
      </button>
    {/each}
  </div>

  {#if tab === 'pet'}<p class="note">Кемеде бір жануар жүреді. Қайта бассаң, ол үйінде қалады.</p>{/if}

  {#if list.length}
    <div class="grid">
      {#each list as it (it.id)}
        {@const own = isOwned(game.save, it.id)}
        {@const on = it.slot === 'pet' && pet === it.id}
        {@const can = it.price <= coins}
        <button class="card" class:own class:on class:poor={!own && !can} onclick={() => tap(it)}
          aria-label="{it.kz}. {own ? (it.slot === 'pet' ? (on ? 'Жанында' : 'Таңдау') : 'Палубада') : `${it.price} тиын`}">
          <ShipIcon src={it.icon} size={64} />
          <b>{it.kz}</b>
          <span class="st">
            {#if own && it.slot === 'pet'}
              {#if on}<span class="tag ok"><Icon name="check" fill="var(--outline)" size={14} />Жанында</span>{:else}<span class="tag">Таңдау</span>{/if}
            {:else if own}<span class="tag ok"><Icon name="check" fill="var(--outline)" size={14} />Қойылған</span>
            {:else}<span class="price" class:can><Icon name="coin" fill="var(--gold)" size={18} /><span class="num">{it.price}</span></span>{/if}
          </span>
        </button>
      {/each}
    </div>
  {:else}
    <div class="paper empty">Мұнда жаңа заттар жақында келеді.</div>
  {/if}

  <p class="earn"><Icon name="coin" fill="var(--gold)" size={16} />Дұрыс жауап +{COINS.correct} · жау +{COINS.enemy} · бас жау +{COINS.boss}</p>

  {#snippet footer()}
    <button class="btn big grow" disabled={locked} onclick={leave}>Кемеге<Icon name="chevron" fill="var(--outline)" size={20} /></button>
  {/snippet}
</Screen>

{#if shield}<div class="shield" role="presentation"></div>{/if}
{#if ask}
  {@const it = ask}
  <div class="scrim pe" role="presentation" onclick={() => (ask = null)}></div>
  <div class="sheet paper pe" role="dialog" aria-modal="true" aria-label={it.kz}>
    <div class="head"><ShipIcon src={it.icon} size={72} paper /><div class="hb"><b>{it.kz}</b><span class="price big" class:can={need === 0}><Icon name="coin" fill="var(--gold)" size={22} /><span class="num">{it.price}</span></span></div></div>
    {#if need > 0}
      <p class="poorline">Тиын жетпейді: тағы <b>{need}</b> керек. Дұрыс жауап — +{COINS.correct} тиын, жау жеңсең — +{COINS.enemy}.</p>
      <div class="row"><button class="btn primary" onclick={() => (ask = null)}>Жақсы</button></div>
    {:else}
      <div class="row">
        <button class="btn ghost dark" onclick={() => (ask = null)}>Жоқ</button>
        <button class="btn primary" onclick={buyNow}><Icon name="coin" fill="var(--gold)" size={20} />Алу · {it.price}</button>
      </div>
    {/if}
  </div>
{/if}

<style>
  .seg { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 3px; padding: 4px; border-radius: 16px; background: var(--deep); border: 3px solid var(--outline); flex: none; }
  .seg button { position: relative; min-height: 44px; padding: 0 2px; font: 800 12.5px var(--disp); color: var(--dim); background: none; border: 0; border-radius: 11px; cursor: pointer; }
  .seg button.on { color: var(--ink); background: var(--panel); box-shadow: inset 0 -3px 0 var(--panel-2), 0 0 0 2px var(--outline); }
  .seg button:focus-visible { outline: 3px solid var(--code); }
  .dot { position: absolute; top: 4px; right: 5px; width: 10px; height: 10px; border-radius: 50%; background: var(--gold); border: 2px solid var(--outline); }
  .note { margin: 0; text-align: center; }
  .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
  .card { display: grid; justify-items: center; align-content: start; gap: 4px; min-height: 132px; padding: 10px 6px 8px; text-align: center; font: inherit; color: var(--ink); cursor: pointer;
    background: linear-gradient(180deg, #2d4fe0, #1d35a6); border: 3px solid var(--outline); border-radius: 14px; box-shadow: inset 0 2px 0 #ffffff26, 0 3px 0 var(--outline); }
  .card:active { transform: translateY(2px); }
  .card:focus-visible { outline: 3px solid var(--code); outline-offset: 2px; }
  .card b { font: 800 15px/1.15 var(--disp); overflow-wrap: anywhere; }
  .card.poor { background: #1a2a7a; }
  .card.poor b { opacity: .8; }
  .card.own { background: linear-gradient(180deg, #2fae5f, #1e8a49); box-shadow: inset 0 2px 0 #ffffff33, 0 3px 0 var(--outline); }
  .card.on { box-shadow: inset 0 2px 0 #ffffff33, 0 0 0 3px var(--gold), 0 3px 0 var(--outline); }
  .st { min-height: 26px; display: grid; place-items: center; }
  .price { display: inline-flex; align-items: center; gap: 4px; padding: 2px 10px 2px 6px; border-radius: 999px; background: #0b1030; border: 2px solid var(--outline); font: 900 16px var(--disp); color: var(--dim); }
  .price.can { color: var(--gold); }
  .price.big { font-size: 22px; padding: 3px 12px 3px 8px; }
  .tag { display: inline-flex; align-items: center; gap: 4px; padding: 3px 10px; border-radius: 999px; background: #0b1030; border: 2px solid var(--outline); font: 800 12px var(--disp); color: var(--ink); text-transform: none; white-space: nowrap; }
  .tag.ok { background: var(--ok); color: var(--outline); }
  .empty { text-align: center; color: var(--paper-dim); }
  .earn { margin: 0; display: flex; align-items: center; justify-content: center; gap: 6px; color: var(--dim); font: 800 13px var(--txt); text-align: center; }
  .grow { flex: 1; }

  .shield { position: fixed; inset: 0; z-index: calc(var(--z-modal) + 2); }
  .scrim { position: fixed; inset: 0; z-index: var(--z-modal); background: #05071399; animation: fade .2s both; }
  .sheet { position: fixed; z-index: calc(var(--z-modal) + 1); left: 50%; bottom: calc(env(safe-area-inset-bottom, 0px) + 12px); transform: translateX(-50%); width: min(460px, calc(100% - 20px)); display: grid; gap: 10px; animation: sheet-up .25s var(--ease-out) both; }
  .head { display: flex; align-items: center; gap: 12px; }
  .hb { display: grid; gap: 6px; justify-items: start; min-width: 0; }
  .hb b { font: 900 20px/1.15 var(--disp); }
  .poorline { margin: 0; font-weight: 800; }
  .row { display: flex; gap: 8px; justify-content: flex-end; }
  .row .btn { flex: 1; }
  .btn.dark { --t: var(--paper-ink); --c: var(--paper-2); --e: var(--paper-line); text-shadow: none; }
  @keyframes fade { from { opacity: 0; } }
  @keyframes sheet-up { from { transform: translate(-50%, 30px); opacity: 0; } to { transform: translate(-50%, 0); opacity: 1; } }

  /* телефон в горизонтали: колонка справа низкая — карточки в ряд «картинка слева» */
  @media (max-width: 999.98px) and (max-height: 560px) and (min-aspect-ratio: 23/20) {
    .card { grid-template-columns: 44px minmax(0, 1fr); grid-template-rows: auto auto; justify-items: start; align-items: center; gap: 0 8px; min-height: 0; padding: 6px 8px; text-align: left; }
    .card :global(.ico) { grid-row: 1 / span 2; width: 44px !important; height: 44px !important; }
    .card b { font-size: 14px; align-self: end; }
    .st { min-height: 0; justify-items: start; align-self: start; }
    .earn { font-size: 12px; }
    .seg button { min-height: 36px; }
    .tag { font-size: 11px; padding: 2px 8px; }
    .note { font-size: 12px; line-height: 1.25; }
    .grid { gap: 6px; }
    .head { gap: 8px; }
  }
</style>
