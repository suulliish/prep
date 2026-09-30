<script lang="ts">
  // Кейіпкер: портрет героя в 3D, характеристики из реального прогресса (GAME_DESIGN 4 — кликами не вкачать)
  // и гардероб: костюмы открываются кристаллами (освоенными темами). Выбор костюма — автономия ребёнка.
  import { onMount } from 'svelte';
  import { game, go, levelOf, skillDefs } from '../lib/store.svelte';
  import { W } from '../lib/world.svelte';
  import { audio } from '../lib/audio';
  import { streak } from '../engine/streak';
  import { OUTFITS, crystals, wearOutfit, STAR_REWARDS, totalStars, wearStyle, applyLook } from '../lib/look';
  import { sparksAt, centerOf } from '../ui/fx.svelte';
  import Screen from '../ui/Screen.svelte';
  import Icon from '../ui/Icon.svelte';

  // примерка: костюм на герое в 3D, пока не надет насовсем; уходим с экрана — возвращаем надетый
  let trying = $state<string | null>(null);
  onMount(() => { W.dim = false; W.world?.setMode('hero'); audio.setMood('hub'); return () => { W.world?.setMode('hub'); if (trying) applyLook(); }; });

  const lv = $derived(levelOf(game.save.xp));
  const cr = $derived(crystals());
  const cat = (id: string) => skillDefs.find(d => d.id === id)?.cat ?? '';
  const LOGIC = ['H', 'I', 'J'];
  const power = $derived(Object.entries(game.save.skills).filter(([id, s]) => ['mastered', 'automatic'].includes(s.status) && !LOGIC.includes(cat(id))).length);
  const mind = $derived(Object.entries(game.save.skills).filter(([id, s]) => ['learned', 'mastered', 'automatic'].includes(s.status) && LOGIC.includes(cat(id))).length);
  const acc = $derived.by(() => {
    const from = Date.parse(game.day) - 14 * 864e5;
    const a = game.save.attempts.filter(x => x.honest && x.hintLevel === 0 && Date.parse(x.day) >= from);
    return a.length >= 10 ? Math.round((a.filter(x => x.correct).length / a.length) * 100) : null;
  });
  const st = $derived(streak(game.save, game.day));

  // Ранг — ступень из 5: у каждой характеристики свои пороги
  const RANKS = ['Жаңадан', 'Шәкірт', 'Шебер', 'Батыр', 'Аңыз'];
  function tier(v: number, steps: number[]) {
    const r = steps.filter(s => v >= s).length;               // сколько ступеней пройдено
    const lo = r ? steps[r - 1] : 0, hi = steps[Math.min(r, steps.length - 1)];
    return { rank: RANKS[Math.min(r, 4)], seg: r, pct: r >= steps.length ? 100 : Math.min(100, ((v - lo) / (hi - lo)) * 100), left: r >= steps.length ? 0 : hi - v };
  }

  type Stat = { id: string; kz: string; how: string; v: string; unit: string; rank: string; seg: number; pct: number; tip: string; locked?: boolean };
  const STATS = $derived.by((): Stat[] => {
    const p = tier(power, [1, 3, 10, 25, 50]), m = tier(mind, [1, 2, 5, 10, 20]), g = tier(st.days, [2, 5, 10, 20, 40]);
    const a = acc === null ? null : tier(acc, [50, 65, 75, 85, 95]);
    return [
      { id: 'power', kz: 'Күш', how: 'Меңгерілген математика тақырыптары', v: String(power), unit: 'тақырып', ...p, tip: p.left ? `Келесі рангқа тағы ${p.left} тақырып меңгер` : 'Ең жоғарғы ранг!' },
      { id: 'mind', kz: 'Ақыл', how: 'Үйренген логика тақырыптары', v: String(mind), unit: 'тақырып', ...m, tip: m.left ? `Келесі рангқа тағы ${m.left} логика тақырыбы` : 'Ең жоғарғы ранг!' },
      a ? { id: 'aim', kz: 'Дәлдік', how: 'Кеңессіз дұрыс жауаптар, соңғы 2 апта', v: String(acc), unit: '%', ...a, tip: 'Асықпа: шешуін тексеріп барып жауап бер' }
        : { id: 'aim', kz: 'Дәлдік', how: 'Кеңессіз дұрыс жауаптар, соңғы 2 апта', v: '—', unit: '', rank: 'Есептелуде', seg: 0, pct: 0, tip: '10 есеп шығарсаң, дәлдік есептеледі' },
      { id: 'guard', kz: 'Табандылық', how: 'Қатарынан оқыған күндер', v: String(st.days), unit: 'күн', ...g, tip: g.left ? `Келесі рангқа тағы ${g.left} күн` : 'Ең жоғарғы ранг!' },
      { id: 'speed', kz: 'Жылдамдық', how: 'Емтихан режимінде ашылады', v: '', unit: '', rank: '2028', seg: 0, pct: 0, tip: 'Алдымен дұрыс шешуді үйренеміз, жылдамдық кейін', locked: true },
    ];
  });

  const worn = $derived(game.save.outfit ?? 'cyan');
  const nextOutfit = $derived(OUTFITS.find(o => o.need > cr));
  // награды за звёзды уровней: след оружия и цвет плаща (GAME_LOOP.md 5)
  const stars = $derived(totalStars());
  const nextReward = $derived(STAR_REWARDS.find(r => r.need > stars));
  const style = $derived(game.save.style ?? {});
  function toggleStyle(r: (typeof STAR_REWARDS)[number], ev: MouseEvent) {
    if (stars < r.need) { audio.play('click'); return; }
    const on = style[r.kind] === r.id;
    wearStyle(r.kind, on ? undefined : r.id);
    audio.play(on ? 'click' : 'levelup');
    if (!on) { const b = (ev.currentTarget as HTMLElement).getBoundingClientRect(); sparksAt(b.left + b.width / 2, b.top + b.height / 2, [hex(r.color), '#ffc94a'], 24); W.world?.celebrate(r.color); }
  }
  const tryO = $derived(OUTFITS.find(o => o.id === trying));
  function tryOn(o: (typeof OUTFITS)[number]) {
    audio.play('click');
    if (o.id === worn) { trying = null; applyLook(); return; }
    trying = o.id; W.world?.setOutfit(o.jacket, o.dark, o.visor, o.id);
  }
  function wear(id: string, ev: MouseEvent) {
    trying = null; wearOutfit(id); audio.play('levelup'); W.world?.celebrate(OUTFITS.find(o => o.id === id)!.jacket);
    const c = centerOf(ev.currentTarget as HTMLElement); sparksAt(c.x, c.y, ['#ffc94a', '#3ff0ff'], 30);
  }
  const hex = (n: number) => '#' + n.toString(16).padStart(6, '0');
  const img = (f: string) => `${import.meta.env.BASE_URL}ui/hero/${f}.png`;
  // у награды нет картинки — остаётся цветной значок из CSS
  let noImg = $state<Record<string, boolean>>({});
</script>

<Screen scene="tall" back={() => go({ name: 'hub' })}>
  {#snippet head()}
    <div class="me">
      <div class="lvl num" aria-label="Деңгей {lv.lvl}">{lv.lvl}</div>
      <div class="nm">
        <b>{game.save.heroName}</b>
        <span class="bar"><i style="width:{(lv.into / lv.need) * 100}%"></i></span>
        <small>Келесі деңгейге <span class="num">{lv.need - lv.into}</span> XP</small>
      </div>
    </div>
  {/snippet}

  <section class="block">
    <div class="h"><h2>Қасиеттер</h2><small>Тек оқу арқылы өседі</small></div>
    <ul class="stats">
      {#each STATS as s}
        <li class="st {s.id}" class:locked={s.locked}>
          <div class="row1">
            <i class="ic" aria-hidden="true"></i>
            <div class="nmv"><b>{s.kz}</b><span class="rank">{s.rank}</span></div>
            <span class="val num">{#if s.locked}<i class="lock" aria-label="жабық"></i>{:else}{s.v}<small>{s.unit}</small>{/if}</span>
          </div>
          <div class="segs" aria-hidden="true">
            {#each [0, 1, 2, 3, 4] as k}<span class:full={k < s.seg} class:part={k === s.seg}><i style="width:{k === s.seg ? s.pct : 0}%"></i></span>{/each}
          </div>
          <small class="how">{s.how}</small>
          <small class="tip">{s.tip}</small>
        </li>
      {/each}
    </ul>
  </section>

  <section class="block">
    <div class="h"><h2>Гардероб</h2><small class="cr"><i class="gem"></i><span class="num">{cr}</span> кристалл</small></div>
    {#if nextOutfit}
      <div class="goal">
        <span>Келесі костюм — <b>{nextOutfit.kz}</b>: тағы <b class="num">{nextOutfit.need - cr}</b> кристалл</span>
        <span class="gbar"><i style="width:{Math.min(100, (cr / nextOutfit.need) * 100)}%"></i></span>
        <small>Кристалл = тексеруден өткен тақырып (бірнеше күннен кейін кеңессіз шешілген).</small>
      </div>
    {/if}
    <div class="wardrobe">
      {#each OUTFITS as o}
        {@const got = cr >= o.need}
        {@const on = worn === o.id}
        <button class="suit" class:got class:on class:try={trying === o.id} onclick={ev => { tryOn(o); ev.currentTarget.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }} aria-pressed={trying === o.id} aria-label="{o.kz}{on ? ', киіліп тұр' : got ? '' : `, ${o.need} кристалл керек`}">
          <span class="pic"><img src={img(o.id)} alt="" width="256" height="320" draggable="false" />{#if !got}<i class="lock" aria-hidden="true"></i>{/if}</span>
          <b>{o.kz}</b>
          {#if o.gear}<small class="gear">{o.gear}</small>{/if}
          <small class="fl">{#if on}Киіліп тұр{:else if !got}<i class="gem sm"></i><span class="num">{o.need}</span>{/if}</small>
        </button>
      {/each}
    </div>
    {#if tryO && tryO.id !== worn}
      <div class="tryrow">
        {#if cr >= tryO.need}<button class="wearbtn" onclick={ev => wear(tryO.id, ev)}>Кию</button>
        {:else}<p class="need">Тағы <b class="num">{tryO.need - cr}</b> кристалл керек</p>{/if}
      </div>
    {/if}
  </section>

  <section class="block">
    <div class="h"><h2>Жұлдыз сыйлықтары</h2><small class="cr"><Icon name="star" fill="var(--gold)" size={16} /><span class="num">{stars}</span> жұлдыз</small></div>
    {#if nextReward}
      <div class="goal">
        <span>Келесі сыйлық — <b>{nextReward.kz}</b>: тағы <b class="num">{nextReward.need - stars}</b> жұлдыз</span>
        <span class="gbar"><i style="width:{Math.min(100, (stars / nextReward.need) * 100)}%"></i></span>
        <small>Жұлдыз = деңгейдегі дәлдік: 1-ден 3-ке дейін әр жеңіс сайын.</small>
      </div>
    {/if}
    <div class="rewards">
      {#each STAR_REWARDS as r}
        {@const got = stars >= r.need}
        {@const on = style[r.kind] === r.id}
        <button class="rw" class:got class:on onclick={ev => toggleStyle(r, ev)} aria-label="{r.kz}{on ? ', киіліп тұр' : got ? ', кию' : `, ${r.need} жұлдыз керек`}">
          <span class="pic">{#if noImg[r.id]}<span class="sw {r.kind}" class:rainbow={r.rainbow} style="--c:{hex(r.color)}"></span>{:else}<img src={img('reward-' + r.id)} alt="" width="256" height="256" draggable="false" onerror={() => (noImg[r.id] = true)} />{/if}</span>
          <b>{r.kz}</b>
          <small>{on ? 'Киіліп тұр' : got ? 'Кию' : `★ ${r.need}`}</small>
        </button>
      {/each}
    </div>
  </section>
</Screen>

<style>
  .me { flex: 1; min-width: 0; display: flex; align-items: center; gap: 10px; }
  .lvl { flex: none; width: 44px; height: 44px; display: grid; place-items: center; font-size: 20px; color: var(--outline); background: var(--code); border: 3px solid var(--outline); border-radius: 12px; box-shadow: inset 0 -4px 0 var(--code-deep); }
  .nm { flex: 1; display: grid; gap: 4px; min-width: 0; }
  .nm b { font: 900 18px var(--disp); line-height: 1.1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-shadow: 0 2px 0 var(--outline); }
  .nm small { color: var(--dim); font-size: 12px; font-weight: 700; }
  .xp { display: block; height: 8px; background: #070a1a; border-radius: 999px; overflow: hidden; border: 1px solid var(--line); }
  .xp i { display: block; height: 100%; background: linear-gradient(90deg, var(--code), #b9fdff); transition: width .6s var(--ease-out); }

  .block { display: grid; gap: 10px; }
  .h { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }
  h2 { font-size: 18px; text-shadow: 0 2px 0 var(--outline); }
  .h small { color: var(--dim); font-size: 12px; font-weight: 700; }

  .stats { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 8px; }
  .st { --c: var(--code); display: grid; gap: 6px; padding: 10px; border-radius: 10px; background: var(--deep); border: 1px solid var(--line); }
  .st.speed { grid-column: 1 / -1; }
  .row1 { display: flex; align-items: center; gap: 8px; }
  .nmv { flex: 1; display: grid; line-height: 1.15; min-width: 0; }
  .nmv b { font-size: 15px; }
  .rank { font: 800 11px var(--txt); letter-spacing: .06em; color: var(--c); text-transform: uppercase; }
  .val { font-size: 24px; color: var(--ink); display: flex; align-items: baseline; gap: 2px; }
  .val small { font: 800 11px var(--txt); color: var(--dim); }
  .segs { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 3px; }
  .segs span { height: 7px; border-radius: 2px; background: #070a1a; border: 1px solid var(--line); overflow: hidden; }
  .segs span.full { background: var(--c); border-color: var(--c); box-shadow: 0 0 6px var(--c); }
  .segs span.part i { display: block; height: 100%; background: var(--c); opacity: .7; }
  .how { color: var(--dim); font-size: 11.5px; font-weight: 700; line-height: 1.3; }
  .tip { color: var(--ink); font-size: 12px; font-weight: 700; line-height: 1.3; opacity: .85; }
  .st.locked { opacity: .6; }
  .lock { width: 14px; height: 13px; border-radius: 3px; background: var(--faint); position: relative; display: inline-block; }
  .lock::before { content: ''; position: absolute; left: 2.5px; top: -7px; width: 9px; height: 8px; border: 2px solid var(--faint); border-bottom: 0; border-radius: 6px 6px 0 0; box-sizing: border-box; }
  .ic { flex: none; width: 30px; height: 30px; background: var(--c); box-shadow: 0 0 10px var(--c); }
  .power { --c: #ff7a4d; } .mind { --c: var(--crystal); } .aim { --c: var(--ok); } .guard { --c: var(--gold); } .speed { --c: #6d77b3; }
  .power .ic { clip-path: polygon(40% 0, 60% 0, 60% 55%, 80% 55%, 80% 68%, 60% 68%, 60% 100%, 40% 100%, 40% 68%, 20% 68%, 20% 55%, 40% 55%); }
  .mind .ic { border-radius: 50% 50% 42% 42%; }
  .aim .ic { border-radius: 50%; background: radial-gradient(circle, var(--c) 20%, transparent 22% 42%, var(--c) 44% 60%, transparent 62%); box-shadow: none; }
  .guard .ic { clip-path: polygon(50% 0, 100% 15%, 90% 65%, 50% 100%, 10% 65%, 0 15%); }
  .speed .ic { clip-path: polygon(40% 0, 100% 0, 60% 45%, 90% 45%, 20% 100%, 40% 55%, 10% 55%); box-shadow: none; }

  .cr { display: inline-flex; align-items: center; gap: 5px; color: var(--crystal) !important; font-size: 14px !important; }
  .gem { display: inline-block; width: 12px; height: 14px; background: var(--crystal); clip-path: polygon(50% 0, 100% 35%, 50% 100%, 0 35%); box-shadow: 0 0 8px var(--crystal); }
  .gem.sm { width: 9px; height: 11px; margin: 0 3px 0 0; }
  .goal { display: grid; gap: 6px; padding: 10px 12px; border-radius: 10px; background: #1b1440; border: 1px solid #5a3bb0; }
  .goal span:first-child { font-size: 14px; font-weight: 700; }
  .goal b { color: var(--crystal); }
  .goal small { color: var(--dim); font-size: 11.5px; font-weight: 700; }
  .gbar { display: block; height: 8px; border-radius: 999px; background: #070a1a; overflow: hidden; }
  .gbar i { display: block; height: 100%; background: linear-gradient(90deg, #8a5cff, var(--crystal)); }

  .wardrobe { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
  @media (max-width: 420px) { .wardrobe { grid-template-columns: repeat(3, minmax(0, 1fr)); } .stats { grid-template-columns: minmax(0, 1fr); } }
  /* телефон лёжа: панель узкая, характеристики в один столбец (иначе значения обрезаются), три костюма в ряд */
  :global(html.lsplit) .stats { grid-template-columns: minmax(0, 1fr); }
  :global(html.lsplit) .wardrobe { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  :global(html.lsplit) .suit .pic { max-width: 60px; }
  .suit { display: grid; justify-items: center; align-content: start; gap: 4px; padding: 8px 4px 8px; font: inherit; color: var(--ink); background: var(--deep); border: 2px solid var(--line); border-radius: 12px; cursor: pointer; transition: transform .15s var(--ease-out), border-color .15s; }
  @media (hover: hover) { .suit:hover { transform: translateY(-2px); border-color: var(--line-hi); } }
  .suit { scroll-margin: 6px 0 64px; }   /* при касании карточка не прячется под кнопкой «Кию» */
  .suit.try { border-color: var(--code); box-shadow: 0 0 14px #3ff0ff44; }
  .suit.on { border-color: var(--gold); box-shadow: 0 0 18px #ffc94a44, inset 0 0 0 1px #ffc94a55; }
  .suit b { font-size: 13px; }
  /* портрет: мягкое светлое пятно под фигурой, чтобы тёмные костюмы и плащи не тонули в синем */
  .pic { position: relative; display: grid; place-items: center; width: 100%; max-width: 84px; aspect-ratio: 4 / 5; border-radius: 10px; background: radial-gradient(closest-side at 50% 58%, #4a5fd0aa, #2a3a9a33 60%, transparent); }
  .pic img { width: 100%; height: 100%; object-fit: contain; display: block; pointer-events: none; }
  .suit:not(.got) .pic img { filter: brightness(0) opacity(.8) drop-shadow(0 0 4px #8fa0ff88); }
  .suit .pic .lock { position: absolute; left: 50%; top: 52%; margin: 0 0 0 -7px; }
  .suit .lock { background: #dfe6ff; box-shadow: 0 0 0 2px #0a0b1e88; }
  .suit .lock::before { border-color: #dfe6ff; }
  .suit .gear { display: block; font: 700 10px/1.25 var(--txt); color: var(--dim); text-align: center; padding: 0 2px; overflow-wrap: anywhere; }
  .suit .fl { display: inline-flex; align-items: center; min-height: 14px; font: 800 11px var(--txt); color: var(--faint); }
  .suit.on .fl { color: var(--gold); }
  .tryrow { position: sticky; bottom: 4px; z-index: 2; display: grid; }
  .wearbtn { padding: 12px; font: 900 16px var(--disp); color: var(--outline); background: linear-gradient(180deg, #b9fdff, var(--code)); border: 3px solid var(--outline); border-radius: 12px; box-shadow: 0 3px 0 var(--code-deep), 0 6px 14px #0008; cursor: pointer; }
  .wearbtn:active { transform: translateY(2px); box-shadow: 0 1px 0 var(--code-deep); }
  .need { margin: 0; padding: 10px 12px; text-align: center; font-size: 14px; font-weight: 700; border-radius: 12px; background: #1b1440; border: 1px solid #5a3bb0; box-shadow: 0 6px 14px #0008; }
  .need b { color: var(--crystal); }

  .rewards { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 6px; }
  .rw { display: grid; justify-items: center; align-content: start; gap: 4px; padding: 6px 2px 8px; font: inherit; color: var(--ink); background: var(--deep); border: 2px solid var(--line); border-radius: 12px; cursor: pointer; }
  .rw.on { border-color: var(--gold); box-shadow: 0 0 14px #ffc94a44; }
  .rw:not(.got) .pic { opacity: .5; }
  .rw .pic { max-width: 72px; aspect-ratio: 1; }
  .rw b { font-size: 11px; text-align: center; line-height: 1.15; }
  .rw small { font: 800 11px var(--txt); color: var(--code); }
  .rw.on small { color: var(--gold); }
  .rw:not(.got) small { color: var(--faint); }
  /* запасной значок, если у награды нет картинки */
  .sw { width: 34px; height: 34px; border-radius: 8px; border: 3px solid var(--outline); background: var(--c); }
  .sw.trail { border-radius: 50%; background: radial-gradient(circle, #fff 0 18%, var(--c) 40%, transparent 72%); }
  .sw.cape { clip-path: polygon(20% 0, 80% 0, 100% 100%, 0 100%); }
  .sw.rainbow { background: conic-gradient(#ff4fb8, #ffcb2e, #3ddc6e, #35e6ff, #a77bff, #ff4fb8); }
</style>
