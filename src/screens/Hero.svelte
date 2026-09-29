<script lang="ts">
  // Кейіпкер: портрет героя в 3D, характеристики из реального прогресса (GAME_DESIGN 4 — кликами не вкачать)
  // и гардероб: костюмы открываются кристаллами (освоенными темами). Выбор костюма — автономия ребёнка.
  import { onMount } from 'svelte';
  import { game, go, levelOf, skillDefs } from '../lib/store.svelte';
  import { W } from '../lib/world.svelte';
  import { audio } from '../lib/audio';
  import { streak } from '../engine/streak';
  import { OUTFITS, crystals, wearOutfit, STAR_REWARDS, totalStars, wearStyle } from '../lib/look';
  import { sparksAt, centerOf } from '../ui/fx.svelte';
  import Screen from '../ui/Screen.svelte';
  import Icon from '../ui/Icon.svelte';

  onMount(() => { W.dim = false; W.world?.setMode('hero'); audio.setMood('hub'); return () => W.world?.setMode('hub'); });

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
  function wear(id: string, ev: MouseEvent) {
    wearOutfit(id); audio.play('levelup'); W.world?.celebrate(OUTFITS.find(o => o.id === id)!.jacket);
    const c = centerOf(ev.currentTarget as HTMLElement); sparksAt(c.x, c.y, ['#ffc94a', '#3ff0ff'], 30);
  }
  const hex = (n: number) => '#' + n.toString(16).padStart(6, '0');
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
        <button class="suit" class:got class:on disabled={!got || on} onclick={ev => wear(o.id, ev)} style="--j:{hex(o.jacket)}; --d:{hex(o.dark)}; --v:{hex(o.visor)}" aria-label="{o.kz}{on ? ', киіліп тұр' : got ? ', кию' : `, ${o.need} кристалл керек`}">
          <span class="fig" aria-hidden="true"><i class="hd"><i class="hair"></i><i class="vs"></i></i><i class="bd"><i class="belt"></i></i><i class="al"></i><i class="ar"></i><i class="lg"></i></span>
          <b>{o.kz}</b>
          {#if o.gear}<small class="gear">{o.gear}</small>{/if}
          <small>{on ? 'Киіліп тұр' : got ? 'Кию' : ''}{#if !got}<i class="gem sm"></i><span class="num">{o.need}</span>{/if}</small>
        </button>
      {/each}
    </div>
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
          <span class="sw {r.kind}" class:rainbow={r.rainbow} style="--c:{hex(r.color)}"></span>
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

  .stats { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .st { --c: var(--code); display: grid; gap: 6px; padding: 10px; border-radius: 10px; background: var(--deep); border: 1px solid var(--line); }
  .st.speed { grid-column: 1 / -1; }
  .row1 { display: flex; align-items: center; gap: 8px; }
  .nmv { flex: 1; display: grid; line-height: 1.15; min-width: 0; }
  .nmv b { font-size: 15px; }
  .rank { font: 800 11px var(--txt); letter-spacing: .06em; color: var(--c); text-transform: uppercase; }
  .val { font-size: 24px; color: var(--ink); display: flex; align-items: baseline; gap: 2px; }
  .val small { font: 800 11px var(--txt); color: var(--dim); }
  .segs { display: grid; grid-template-columns: repeat(5, 1fr); gap: 3px; }
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

  .wardrobe { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
  @media (max-width: 420px) { .wardrobe { grid-template-columns: repeat(3, 1fr); } .stats { grid-template-columns: 1fr; } }
  .suit { display: grid; justify-items: center; gap: 4px; padding: 10px 4px 8px; font: inherit; color: var(--ink); background: var(--deep); border: 2px solid var(--line); border-radius: 12px; cursor: pointer; transition: transform .15s var(--ease-out), border-color .15s; }
  .suit.got:not(.on):hover { transform: translateY(-2px); border-color: var(--line-hi); }
  .suit.on { border-color: var(--gold); box-shadow: 0 0 18px #ffc94a44, inset 0 0 0 1px #ffc94a55; }
  .suit:disabled { cursor: default; }
  .suit b { font-size: 13px; }
  .rewards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; }
  .rw { display: grid; justify-items: center; gap: 4px; padding: 8px 2px; font: inherit; color: var(--ink); background: var(--deep); border: 2px solid var(--line); border-radius: 12px; cursor: pointer; }
  .rw.on { border-color: var(--gold); box-shadow: 0 0 14px #ffc94a44; }
  .rw:not(.got) { opacity: .5; }
  .rw b { font-size: 11px; text-align: center; line-height: 1.15; }
  .rw small { font: 800 11px var(--txt); color: var(--code); }
  .rw.on small { color: var(--gold); }
  .rw:not(.got) small { color: var(--faint); }
  .sw { width: 34px; height: 34px; border-radius: 8px; border: 3px solid var(--outline); background: var(--c); }
  .sw.trail { border-radius: 50%; background: radial-gradient(circle, #fff 0 18%, var(--c) 40%, transparent 72%); }
  .sw.cape { clip-path: polygon(20% 0, 80% 0, 100% 100%, 0 100%); }
  .sw.rainbow { background: conic-gradient(#ff4fb8, #ffcb2e, #3ddc6e, #35e6ff, #a77bff, #ff4fb8); }
  .suit .gear { display: block; font: 700 10px/1.25 var(--txt); color: var(--dim); text-align: center; padding: 0 2px; }
  .suit small { display: inline-flex; align-items: center; font: 800 11px var(--txt); color: var(--code); }
  .suit.on small { color: var(--gold); }
  .suit:not(.got) small { color: var(--faint); }
  .suit:not(.got) .fig { filter: grayscale(1) brightness(.35); }
  /* воксельная фигурка героя в цветах костюма */
  .fig { position: relative; width: 44px; height: 62px; }
  .fig i { position: absolute; display: block; border-radius: 3px; }
  .hd { left: 10px; top: 0; width: 24px; height: 22px; background: #e2b48a; box-shadow: inset 0 -3px 0 #c9966c; }
  .hair { left: -1px; top: -2px; width: 26px; height: 8px; background: #2a1d17; border-radius: 4px 4px 2px 2px; }
  .vs { left: 2px; top: 9px; width: 20px; height: 5px; background: var(--v); box-shadow: 0 0 6px var(--v); }
  .bd { left: 9px; top: 23px; width: 26px; height: 20px; background: var(--j); box-shadow: inset 0 -4px 0 var(--d); }
  .belt { left: 0; bottom: 3px; width: 26px; height: 3px; background: var(--d); }
  .al { left: 2px; top: 24px; width: 7px; height: 17px; background: var(--d); }
  .ar { right: 2px; top: 24px; width: 7px; height: 17px; background: var(--d); }
  .lg { left: 12px; top: 44px; width: 20px; height: 16px; background: #1d2346; box-shadow: inset -10px 0 0 #262d58; }
</style>
