<script lang="ts">
  // Урок-миссия (docs/ARCHITECTURE.md 4.6, GAME_LOOP.md 19) как тренировка: вместо врага на площадке манекен, мишени и доска, полоска показывает
  // освоение приёма темы. Верный ответ — удар по манекену, неверный — манекен шлёпает героя (бонк), связка на «Өзің», ошибка Глитча — манекен рассыпается на доски,
  // мишени в мини-игре, в конце «Есте сақта» — карточка приёма. Бой проверяет, тренировка учит: в уроке нет врага, здоровья и атак врага.
  // Мақсат → Қолмен → Болжа → Көр (видео-объяснение под голос Бита, src/lesson/ExampleVideo.svelte) → Өзің → Неге? → Глитчтің қатесі → Шағын ойын → Есте сақта → возврат к цели (приём освоен).
  import { onMount, tick } from 'svelte';
  import Bit from '../ui/Bit.svelte';
  import Screen from '../ui/Screen.svelte';
  import Icon from '../ui/Icon.svelte';
  import Confirm from '../ui/Confirm.svelte';
  import TechCard from '../lesson/TechCard.svelte';
  import NotebookCard from '../lesson/NotebookCard.svelte';
  import TeachBack from '../lesson/TeachBack.svelte';
  import LessonHelper from '../lesson/LessonHelper.svelte';
  import { toast } from '../ui/notify.svelte';
  import { ReadGate, readMs } from '../lib/readgate.svelte';
  import { game, go, persist } from '../lib/store.svelte';
  import { W } from '../lib/world.svelte';
  import { skillTitle } from '../engine/items';
  import { blankSkill } from '../engine/progress';
  import { audio } from '../lib/audio';
  import { currentWorld } from '../lib/look';
  import { SPOT_KZ } from '../three/spots';
  import { holoSpecFor } from '../three/holo_spec';
  import { react } from '../lib/voice';
  import { sparksAt, centerOf, floatText, flash, sceneCenter } from '../ui/fx.svelte';
  // @ts-ignore
  import { LESSONS } from '../../content/lessons.mjs';
  import VOICED from '../../content/voice_lessons.json';
  import MathLine from '../lesson/MathLine.svelte';
  import Gap from '../lesson/Gap.svelte';
  import { planGaps } from '../lesson/gap';
  import ExampleVideo from '../lesson/ExampleVideo.svelte';
  import Karaoke from '../lesson/Karaoke.svelte';
  import { VideoPlayer } from '../lesson/video.svelte';
  // @ts-ignore
  import { techniqueOf } from '../../content/techniques.mjs';
  import { fitZoom } from '../lesson/fit';
  import Faded from '../lesson/Faded.svelte';
  import BugHunt from '../lesson/BugHunt.svelte';
  import Blitz from '../lesson/Blitz.svelte';
  import Scene, { resetScene } from '../lesson/Scene.svelte';
  import GlitchSays from '../lesson/GlitchSays.svelte';
  import DivideGame from '../widgets/DivideGame.svelte';
  import FactorTree from '../widgets/FactorTree.svelte';
  import OrderOps from '../widgets/OrderOps.svelte';
  import PlaceValue from '../widgets/PlaceValue.svelte';
  import PowerBlocks from '../widgets/PowerBlocks.svelte';
  import CommonFactors from '../widgets/CommonFactors.svelte';
  import BusTimeline from '../widgets/BusTimeline.svelte';
  import MultipleHunt from '../widgets/MultipleHunt.svelte';
  import StarPicker from '../widgets/StarPicker.svelte';
  import SetSort from '../widgets/SetSort.svelte';
  import FractionCircle from '../widgets/FractionCircle.svelte';
  import FractionBar from '../widgets/FractionBar.svelte';
  import NumberLine from '../widgets/NumberLine.svelte';
  import FillOne from '../widgets/FillOne.svelte';
  import Scales from '../widgets/Scales.svelte';
  import ZeroCounter from '../widgets/ZeroCounter.svelte';
  import FracArea from '../widgets/FracArea.svelte';
  import TreeBuilder from '../widgets/TreeBuilder.svelte';
  import GridSquares from '../widgets/GridSquares.svelte';
  import LetterDigit from '../widgets/LetterDigit.svelte';

  // replay — пересмотр из альбома: без XP и без перехода к практике
  let { skill, replay = false }: { skill: string; replay?: boolean } = $props();
  // FractionCircle и FillOne подгоняют себя сами (пицца и мост по высоте); остальные виджеты сжимаются целиком не сильнее 0.8
  const SELF_FIT = ['FractionCircle', 'FillOne'];
  const WIDGETS: Record<string, any> = { DivideGame, FactorTree, OrderOps, PlaceValue, PowerBlocks, CommonFactors, BusTimeline, MultipleHunt, StarPicker, SetSort, FractionCircle, FractionBar, NumberLine, FillOne, Scales, ZeroCounter, FracArea, TreeBuilder, GridSquares, LetterDigit };
  const steps: any[] = (LESSONS as Record<string, any[]>)[skill] ?? [{ type: 'say', kz: 'Бұл тақырыптың сабағы әзірленуде. Бірден жаттығуға көшейік!' }];
  const goal = steps.find(s => s.type === 'goal');
  const target = goal?.title ?? skillTitle(skill).kz;
  const CHIP: Record<string, string> = {
    goal: 'Мақсат', widget: 'Қолмен', predict: 'Болжа', example: 'Көр', faded: 'Өзің', why: 'Неге?',
    bug: 'Глитчтің қатесі', blitz: 'Шағын ойын', rule: 'Есте сақта', final: 'Соңғы сынақ', quiz: 'Қалай ойлайсың?', say: 'Бит',
  };
  // Шаги, где ребёнок что-то делает сам (после них «Келесі», а не просто чтение)
  const HIT = (t: string) => !['goal', 'rule', 'say'].includes(t);
  // приём темы: доска, полоска освоения, карточка (content/techniques.mjs)
  const tech = techniqueOf(skill) as { kz: string; color: number; fx: 'arc' | 'pierce' | 'split' | 'multi' | 'spin' } | null;
  const techHex = '#' + (tech?.color ?? 0x35e6ff).toString(16).padStart(6, '0');
  const ruleIdx = steps.findIndex(s => s.type === 'rule');
  const voiced = new Set<string>(VOICED as string[]);
  const voiceUrl = (k: number | string) => (voiced.has(`${skill}_${k}`) ? `${import.meta.env.BASE_URL}voice/lessons/${skill}_${k}.mp3` : '');

  // продолжить с того шага, где вышел
  let i = $state(!replay && game.save.lessonPos?.skill === skill ? Math.min(game.save.lessonPos.step, steps.length - 1) : 0);
  let askExit = $state(false);
  let ready = $state(false);
  let frame = $state(0);
  // видео-объяснение «Көр»: плеер живёт, пока открыт шаг (создаётся в enter, гасится при смене шага и выходе)
  let vid = $state.raw<VideoPlayer | null>(null);
  let reduced = $state(false);
  let hidden = $state(false);
  let pick = $state<number | null>(null);
  let showSkip = $state(false);
  let earned = $state(0);
  let card = $state(false);       // карточка приёма открыта
  // «Биткә түсіндір» после правила (docs/GAME_LOOP.md): ребёнок объясняет тему своими словами, ИИ или меню проверяет понимание
  let teach = $state(false);
  let notebook = $state(false);
  let cardSeen = false, teachSeen = false;
  let stepDone = $state(false);   // faded/blitz: шаг завершён (для ИИ-помощника)
  let bugFound = $state(false);
  let won = $state(false);
  let skipTimer: number | undefined;
  let nextBtn = $state<HTMLElement>();
  let cardEl = $state<HTMLElement>();
  const step = $derived(steps[i]);
  // объяснения нельзя пролистать вслепую: «дальше» заряжается на время чтения (GAME_LOOP.md 10)
  const gate = new ReadGate();
  let cine = $state(true);   // катсцена входа и победы — панель урока скрыта
  let blitzPhase = $state<'ready' | 'play' | 'over'>('ready');
  // Горизонталь и широкий экран (как в Screen.svelte): сцена слева, реплика Бита поверх неё, панель узкая и низкая
  const LAND = '(min-width: 1000px) and (min-aspect-ratio: 23/20), (max-width: 999.98px) and (max-height: 560px) and (min-aspect-ratio: 23/20)';
  let land = $state(false);
  // D11: пропуски в «Көр» и «Есте сақта» (автоматически, отключается флагом noGap на кадре или шаге)
  const gaps = $derived(planGaps(skill, i, step));
  // освоение приёма: растёт по шагам урока, 100% после победы в финале
  const pct = $derived(won ? 100 : Math.round((Math.min(i, steps.length - 1) / steps.length) * 100));
  let solved = $state<Record<string, boolean>>({});
  const curGap = $derived(step.type === 'example' ? gaps?.frames?.[frame] ?? null : step.type === 'rule' ? gaps?.rule?.gap ?? null : null);
  const gapKey = $derived(`${i}:${frame}`);
  const gapOpen = $derived(!!curGap && !solved[gapKey]);
  const fr = $derived(step.type === 'example' ? step.frames[frame] : null);

  function makeVideo(s: any) {
    const at = i;
    const v = new VideoPlayer({
      frames: s.frames.map((f: any, k: number) => ({ kz: f.kz ?? '', math: f.math, url: voiceUrl(`${at}_f${k}`) })),
      deps: { say: u => audio.say(u), stop: () => audio.stopVoice(), voiceOn: () => audio.voiceOn() },
      gapOpen: k => !!gaps?.frames?.[k] && !solved[`${at}:${k}`],
      onframe: k => (frame = k),
      onreplay: resetScene,
    });
    v.start();
    return v;
  }
  function enter() {
    const s = steps[i];
    ready = ['say', 'goal', 'rule'].includes(s.type) || (s.type === 'example' && s.frames.length <= 1);
    frame = 0; pick = null; showSkip = false; bugFound = false; stepDone = false; fadedHits = 0;
    clearTimeout(skipTimer); gate.stop();
    vid?.destroy(); vid = s.type === 'example' ? makeVideo(s) : null;
    // тренировочная площадка: глитч и мишени по шагу, доска пишет название приёма
    W.world?.trainGlitch(s.type === 'bug');
    W.world?.trainTargets(s.type === 'blitz' ? Math.max(1, s.count) : 2);
    // герой по шагу: разминка на «Мақсат», сидит и слушает на «Көр», встаёт на остальных; на «Есте сақта» — «приём освоен»
    W.world?.trainStep(s.type);
    if (s.type === 'rule' && tech) { W.world?.trainBoard(tech.kz); if (!cine) W.world?.trainMastered(tech.color); }
    if (s.type === 'say') gate.start(readMs(s.kz));
    if (s.type === 'rule') gate.start(readMs(s.kz, ...s.lines));
    if (s.type === 'faded') setTimeout(() => react('self'), 400);
    if (s.type === 'bug') setTimeout(() => react('bug'), 400);
    if (s.type === 'why') setTimeout(() => react('think'), 400);
    if (['widget', 'blitz'].includes(s.type)) skipTimer = window.setTimeout(() => (showSkip = true), s.type === 'blitz' ? 5000 : 25000);
    requestAnimationFrame(() => cardEl?.closest('.body')?.scrollTo({ top: 0 }));
  }
  onMount(() => {
    const mq = matchMedia(LAND); land = mq.matches;
    const onLand = (e: MediaQueryListEvent) => (land = e.matches); mq.addEventListener('change', onLand);
    const rm = matchMedia('(prefers-reduced-motion: reduce)'); reduced = rm.matches;
    const onRm = (e: MediaQueryListEvent) => (reduced = e.matches); rm.addEventListener('change', onRm);
    const onVis = () => (hidden = document.hidden); document.addEventListener('visibilitychange', onVis);
    W.dim = false; W.world?.setMode('battle'); W.world?.bitMood('idle');
    const v = W.world?.setSpot(skill);   // урок и практика темы — в одном уголке мира
    if (v !== undefined) setTimeout(() => { const c = sceneCenter(0.3); floatText(`${currentWorld().kz} · ${SPOT_KZ[v]}`, c.x, c.y, '#ffc94a', true); }, 400);
    if (tech) W.world?.trainBoard(`Бүгінгі тәсіл: ${tech.kz}`);
    (W.world?.arrive() ?? Promise.resolve()).then(() => W.world?.setTraining(true)).then(() => (cine = false));
    audio.setMood('training'); enter();
    return () => { clearTimeout(skipTimer); vid?.destroy(); W.world?.holoClear(true); W.world?.clearMob(); mq.removeEventListener('change', onLand); rm.removeEventListener('change', onRm); document.removeEventListener('visibilitychange', onVis); };
  });
  // видео стоит, пока открыт вопрос о выходе, карточка приёма или вкладка в фоне
  $effect(() => { vid?.hold(askExit || card || hidden); });
  // «Тірі түсіндіру» (docs/GAME_LOOP.md 17): Бит проецирует голограмму того, о чём кадр; герой на каждый новый кадр кивает или показывает.
  // Пропуск D11 не выдаётся: голограмма берёт тот же текст с ▢, что и карточка, и заполняет его вместе с ней.
  let liveKey = '';
  $effect(() => {
    if (cine) return;
    const st = step, g = st.type === 'example' || st.type === 'rule' ? curGap : null;
    W.world?.holoShow(holoSpecFor(st, { frame, gapText: g?.text ?? null, gapFill: g && solved[gapKey] ? g.answer : null, gapLine: st.type === 'rule' ? gaps?.rule?.line ?? null : null }));
    const k = `${i}:${st.type === 'example' ? frame : 0}`;
    if (k !== liveKey) { liveKey = k; if (['example', 'goal', 'rule'].includes(st.type)) W.world?.heroEmote(st.type === 'rule' ? 'nod' : 'point'); }
  });

  function reward(xp: number, big = false) {
    ready = true;
    if (!nextBtn) return;
    const c = centerOf(nextBtn);
    sparksAt(c.x, c.y - 40, ['#3ff0ff', '#5ce39c', '#ffc94a'], big ? 60 : 26);
    if (xp && !replay) { earned += xp; game.save.xp += xp; floatText(`+${xp} XP`, c.x, c.y - 60, '#ffc94a', big); persist(); }
  }
  // неверный ответ: манекен шлёпает героя, потом герой чешет голову
  // сколько пропусков «Өзің» уже вписано: каждый верный — следующий удар связки (onstep)
  let fadedHits = 0, strikeN = 0;
  // после победы в финале почёсывание от прежнего бонка не играем: оно оборвало бы победный удар
  const bonk = () => { W.world?.trainBonk().then(() => { if (!won) W.world?.heroEmote('scratch'); }); };
  // связка на «Өзің»: три удара подряд без клинка в ножнах (без ошибок — с вспышкой на третьем), с ошибками — два
  function combo(clean: boolean) {
    const n = clean ? 3 : 2; let last: Promise<void> | undefined;
    for (let k = 1; k <= n; k++) last = W.world?.trainStrike('combo', k, k < n);
    if (clean) last?.then(() => W.world?.heroEmote('cheer'));
  }
  function widgetDone() { audio.play('correct'); W.world?.heroEmote('cheer'); reward(0); }
  async function choose(k: number) {
    if (pick !== null && step.type !== 'final') return;
    if (step.type === 'final' && won) return;
    pick = k;
    const ok = k === step.answer;
    if (step.type === 'predict') {
      audio.play(ok ? 'correct' : 'hint'); if (ok) react('correct');
      // верно — сильный удар, потом радость; неверно — бонк (манекен шлёпает героя), потом герой чешет голову
      if (ok) W.world?.trainStrike('strong', 1, false, strikeN++).then(() => W.world?.heroEmote('cheer')); else bonk();
      reward(ok ? 3 : 0); gate.start(readMs(step.reveal)); showChoices(); return;
    }
    if (step.type === 'final') {
      if (!ok) { audio.play('wrong'); flash('#ff9a6b'); bonk(); cardEl?.classList.remove('shake'); void cardEl?.offsetWidth; cardEl?.classList.add('shake'); return; }
      won = true; audio.play('crit'); react('win');
      // разбег, прыжок и удар с разворотом; промис — в момент касания, радость и отдых лёжа герой доигрывает сам
      await Promise.race([W.world?.trainVictory(), new Promise(r => setTimeout(r, 4000))]);   // кнопка не ждёт анимацию дольше 4 с
      W.world?.bitMood('happy');
      audio.play('levelup'); floatText('МЕҢГЕРІЛДІ!', sceneCenter(0.28).x, sceneCenter(0.28).y, techHex, true);
      sparksAt(sceneCenter(0.3).x, sceneCenter(0.3).y, ['#ffc94a', '#3ff0ff', '#b58cff'], 90, 10);
      reward(20, true); return;
    }
    audio.play(ok ? 'correct' : 'wrong'); react(ok ? 'correct' : 'wrong'); reward(ok ? 5 : 0);
    // «Неге?»: верно — блок и контратака, неверно — шлепок (бонк) и почесать голову; остальные шаги — обычный удар
    if (ok) (step.type === 'why' ? W.world?.trainBlock() : W.world?.trainStrike('light'))?.then(() => W.world?.heroEmote('cheer')); else bonk();
    if (step.why) gate.start(readMs(step.why));
    showChoices();
  }
  // после ответа появляется разбор: варианты и кнопка должны остаться в поле зрения
  const showChoices = () => tick().then(() => setTimeout(() => cardEl?.querySelector('.choices')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 80));

  // после «Есте сақта» ребёнок получает карточку приёма; закрыл — идём дальше
  function next() {
    if (step.type === 'rule' && tech && !replay && !cardSeen) { cardSeen = true; card = true; return; }
    if (step.type === 'rule' && !replay && !teachSeen) { teachSeen = true; teach = true; return; }
    advance();
  }
  function advance() {
    if (i < steps.length - 1) { i++; if (!replay) { game.save.lessonPos = { skill, step: i }; persist(); } enter(); audio.play('click'); return; }
    if (replay) { W.world?.trainStep(''); audio.play('mission'); go({ name: 'album' }); return; }
    W.world?.trainStep('');   // герой встаёт, если лежал
    game.save.skills[skill] ??= blankSkill();
    game.save.skills[skill].lessonDone = true;
    delete game.save.lessonPos;
    persist(); audio.play('mission');
    notebook = true;   // «Дәптер»: сначала пишет на бумаге, потом тренировка
  }
  const primaryLabel = $derived(
    step.type === 'goal' ? 'Жаттығуды бастау' : i < steps.length - 1 ? 'Келесі'
    : replay ? 'Альбомға қайту' : 'Жаттығуға');
  // D11: верный вариант в пропуске открывает число; в видео-объяснении после него идёт голос кадра, в «Есте сақта» — «дальше»
  function gapSolved() {
    solved[gapKey] = true; W.world?.holoPulse('correct'); gate.stop(); gate.done = true; vid?.gapSolved();
    if (nextBtn) { const c = centerOf(nextBtn); sparksAt(c.x, c.y - 40, ['#5ce39c', '#ffc94a'], 18); }
  }
  function primary() {
    if (gapOpen) { audio.play('click'); toast('Алдымен жасырылған санды тап'); return; }
    if (gate.on) { gate.nope(); audio.play('click'); toast('Алдымен оқы — батырма зарядталып жатыр'); return; }
    if (!ready) { toast(step.type === 'widget' ? 'Алдымен тапсырманы орында' : 'Алдымен жауап таңда'); audio.play('click'); return; }
    next();
  }
  function leave() { askExit = false; if (!replay) { game.save.lessonPos = { skill, step: i }; persist(); } go({ name: replay ? 'album' : 'hub' }); }
  const bit = $derived.by((): { text: string; mood: 'idle' | 'happy' | 'wow' | 'think' | 'sad'; compact: boolean; voice?: string } | null => {
    const t = step.type;
    if (t === 'say' || t === 'goal') return { text: step.kz, mood: 'wow', compact: t === 'goal', voice: voiceUrl(i) };
    if (t === 'widget') return { text: step.kz, mood: 'think', compact: true, voice: voiceUrl(i) };
    if (t === 'faded') return { text: 'Енді өзің! Бұзылған модульдерді жөнде.', mood: 'think', compact: true, voice: voiceUrl(i) };
    if (t === 'blitz') return blitzPhase === 'play' ? null : { text: step.kz, mood: 'wow', compact: true };
    if (['predict', 'why', 'quiz', 'final'].includes(t)) return { text: bitLine, mood: pick === null || pick !== step.answer ? 'think' : 'happy', compact: true, voice: answerVoice };
    return null;
  });
  // окно 3D-сцены: на «читательских» шагах повыше, на шагах с заданием — низкое (задаче нужно место, DESIGN_SYSTEM 6)
  const sceneSize = $derived(step.type === 'say' ? 'short' : 'strip');
  // пять коротких вариантов (дроби, числа) — в три колонки: две строки вместо трёх, условие задачи не уходит под варианты на низком экране
  const tinyChoices = $derived(['predict', 'why', 'quiz', 'final'].includes(step.type) && (step.choices?.length ?? 0) >= 5 && Math.max(...step.choices.map((c: string) => c.length)) <= 9);
  const longChoices = $derived(['predict', 'why', 'quiz', 'final'].includes(step.type) && Math.max(...(step.choices ?? ['']).map((c: string) => c.length)) > 22);
  // голос Бита на шагах с выбором: до ответа читает вопрос, после — разбор (_reveal у прогноза, _why у «Неге?» и у выигранного финала)
  const answerVoice = $derived(pick === null ? voiceUrl(i)
    : step.type === 'predict' ? voiceUrl(`${i}_reveal`)
    : step.type === 'final' ? (won ? voiceUrl(`${i}_why`) : '') : voiceUrl(`${i}_why`));
  // «Есте сақта» и «Глитчтің қатесі» идут без пузыря Бита: голос шага играет сам; у правила с пропуском после решения — полная версия (_full)
  let spokeKey = '';
  $effect(() => {
    if (cine) return;
    const t = step.type; if (t !== 'rule' && t !== 'bug') return;
    const full = t === 'rule' && !!curGap && !!solved[gapKey];
    const k = `${i}:${full}`; if (k === spokeKey) return; spokeKey = k;
    const u = full ? voiceUrl(`${i}_full`) : voiceUrl(i);
    if (u) audio.say(u);
  });
  const bitLine = $derived.by(() => {
    if (step.type === 'predict') return pick === null ? `${game.save.heroName}, алдымен болжап көр — қателесуден қорықпа!` : (pick === step.answer ? 'Дәл таптың! ' : 'Қызық болжам! ') + step.reveal;
    if (step.type === 'why' || step.type === 'quiz') return pick === null ? 'Қалай ойлайсың?' : pick === step.answer ? 'Дұрыс! ' + step.why : 'Жақын, бірақ: ' + step.why;
    if (step.type === 'final') return !won ? (pick === null ? 'Соңғы сынақ! Үйренгеніңді көрсет: дұрыс жауапты таңда.' : 'Жаттығу әлі аяқталған жоқ! Сабақта не үйрендік? Тағы тексер.') : `Тәсіл меңгерілді, ${game.save.heroName}! ` + step.why;
    return '';
  });
  // что видит ИИ-помощник (src/lesson/LessonHelper.svelte): шаг как в контенте, пропуск этого кадра, ответил ли ребёнок
  const answered = $derived(
    step.type === 'final' ? won : ['predict', 'why', 'quiz'].includes(step.type) ? pick !== null : ['faded', 'blitz'].includes(step.type) ? stepDone : false);
  const lessonCtx = $derived({
    skill, title: skillTitle(skill).kz, step, frame: step.type === 'example' ? frame : undefined, gaps, solved: !!solved[gapKey],
    answered, picked: pick, rule: ruleIdx >= 0 && i > ruleIdx ? (steps[ruleIdx].lines as string[]).join(' ') : undefined,
  });
</script>

{#snippet bitView()}
  {#if bit}<Bit text={bit.text} mood={bit.mood} compact={bit.compact} voice={bit.voice} />{/if}
{/snippet}

<Screen scene={sceneSize} cinema={cine} back={() => (askExit = true)}>
  {#snippet head()}
    <div class="hd">
      <div class="t1"><b>{target}</b>{#if earned}<span class="xp num">+{earned} XP</span>{/if}</div>
      <div class="t2"><span class="cap">Тәсіл</span><span class="bar hp" role="progressbar" aria-label="Тәсіл" aria-valuemin="0" aria-valuemax="100" aria-valuenow={pct} style="--tc:{techHex}"><i style="width:{pct}%"></i></span><span class="cnt">Қадам <b class="num">{i + 1}</b>/{steps.length}</span></div>
    </div>
  {/snippet}

  {#snippet overlay()}
    {#if land && vid && fr}<div class="say"><Karaoke {vid} text={fr.kz} {reduced} /></div>
    {:else if land && bit}<div class="say">{#key i}{@render bitView()}{/key}</div>{/if}
  {/snippet}

  {#key i}
    <div class="card" data-lesson class:final={step.type === 'final'} bind:this={cardEl}>
      {#if step.type !== 'example'}<span class="tag c-{step.type}">{CHIP[step.type] ?? ''}</span>{/if}

      {#if step.type === 'say'}
        {#if !land}{@render bitView()}{/if}
      {:else if step.type === 'goal'}
        {#if tech}<div class="intro"><Bit text={`${game.save.heroName}, бүгін жаттығу алаңындамыз! Соңында «${tech.kz}» тәсілін меңгересің.`} mood="happy" compact /></div>{/if}
        {#if step.scene}<Scene name={step.scene} s={step.s} />{/if}
        {#if !land}{@render bitView()}{/if}
        <div class="paper lock" class:long={step.task.length > 28}><Icon name="lock" fill="var(--gold)" size={28} /><MathLine text={step.task} big={step.task.length <= 28} inherit={step.task.length > 28} /></div>
      {:else if step.type === 'widget'}
        {@const Comp = WIDGETS[step.w]}
        {#if !land}{@render bitView()}{/if}
        <div class="widget pe" use:fitZoom={{ min: SELF_FIT.includes(step.w) ? 1 : 0.8 }}><Comp {...step.props} ondone={widgetDone} /></div>
      {:else if step.type === 'example'}
        {#if vid}<ExampleVideo {vid} {step} gap={curGap} solved={!!solved[gapKey]} {land} {reduced} label={primaryLabel} onsolved={gapSolved} onnext={next} />{/if}
      {:else if step.type === 'faded'}
        {#if !land}{@render bitView()}{/if}
        <div class="paper"><Faded task={step.kz} steps={step.steps} onstep={k => { fadedHits = k; W.world?.trainStrike('combo', Math.min(3, k)); }} onmiss={bonk} ondone={clean => { stepDone = true; if (fadedHits) { if (clean) W.world?.heroEmote('cheer'); } else combo(clean); reward(clean ? 8 : 3); }} /></div>
      {:else if step.type === 'bug'}
        <GlitchSays text={step.kz} beaten={bugFound} />
        <div class="paper"><BugHunt lines={step.lines} bad={step.bad} follows={step.follows} fix={step.fix} ondone={clean => { bugFound = true; W.world?.trainBreakGlitch(); reward(clean ? 8 : 3); }} /></div>
      {:else if step.type === 'blitz'}
        {#if !land}{@render bitView()}{/if}
        <div class="paper"><Blitz title={step.title} count={step.count} make={step.make} onphase={p => (blitzPhase = p)} onhit={() => W.world?.trainTargetHit()} onmiss={() => W.world?.trainTargetMiss()} ondone={stars => { stepDone = true; reward(stars * 5, stars === 3); }} /></div>
      {:else if step.type === 'rule'}
        <div class="paper rule">
          <b><Icon name="star" fill="var(--gold)" size={22} />{step.kz}</b>
          {#each step.lines as l, k}<p class="appear" style="animation-delay:{k * 120}ms"><MathLine text={gaps?.rule?.line === k ? gaps.rule.gap.text : l} fill={gaps?.rule?.line === k && solved[gapKey] ? gaps.rule.gap.answer : null} inherit /></p>{/each}
          <small>Бұл ереже Альбомдағы тақырып картасына сақталды.</small>
        </div>
        {#if gapOpen && curGap}<Gap options={curGap.options} answer={curGap.answer} onsolved={gapSolved} />{/if}
      {:else}
        {#if step.type === 'final' && step.scene}<Scene name={step.scene} s={won ? step.s : goal?.s ?? step.s} />{/if}
        {#if !land}{@render bitView()}{/if}
        <div class="paper qbox">
          {#if step.type === 'final'}<Icon name={won ? 'check' : 'lock'} fill={won ? 'var(--ok)' : 'var(--gold)'} size={24} />{/if}
          <p class="q"><MathLine text={step.kz} inherit /></p>
        </div>
        <div class="choices" class:one={longChoices} class:tiny={tinyChoices}>
          {#each step.choices as c, k}
            <button class="ans" class:right={pick !== null && k === step.answer && (step.type !== 'final' || won)} class:wrong={pick === k && k !== step.answer}
              disabled={step.type === 'final' ? won : pick !== null} onclick={() => choose(k)}>
              <span class="l">{#if pick !== null && k === step.answer && (step.type !== 'final' || won)}<Icon name="check" fill="#fff" size={16} />{:else if pick === k && k !== step.answer}<Icon name="cross" fill="#fff" size={16} />{:else}{'ABCDE'[k]}{/if}</span><span class="ct"><MathLine text={c} inherit /></span>
            </button>
          {/each}
        </div>
      {/if}
    </div>
  {/key}
  <LessonHelper ctx={lessonCtx} />

  {#snippet footer()}
    {#if step.type !== 'example'}
    {#if showSkip && !ready}<button class="btn ghost" onclick={() => (ready = true)}>Өткізу</button>{/if}
    <button bind:this={nextBtn} class="btn big grow {ready && !gapOpen ? (won || step.type === 'goal' ? 'primary' : 'go') : 'wait'}" class:charging={gate.on && !gapOpen} class:charged={gate.done} style="--gate:{gate.ms}ms" onclick={primary}>
      {primaryLabel}<Icon name="chevron" fill={ready && !gapOpen ? 'var(--outline)' : '#d7dcf5'} size={20} />
    </button>
    {/if}
  {/snippet}
</Screen>

{#if card && tech}<TechCard name={tech.kz} color={tech.color} fx={tech.fx} onclose={() => { card = false; if (!replay && !teachSeen) { teachSeen = true; teach = true; } else advance(); }} />{/if}
{#if notebook}<NotebookCard {skill} onclose={() => { notebook = false; go({ name: 'session', block: 'new' }); }} />{/if}
{#if teach && step.type === 'rule'}
  <div class="teach-veil" role="dialog" aria-modal="true" aria-label="Биткә түсіндір">
    <div class="teach-box">
      <TeachBack {skill} title={skillTitle(skill).kz} rule={{ kz: step.kz, lines: step.lines }}
        ondone={() => { teach = false; advance(); }} />
    </div>
  </div>
{/if}

<Confirm open={askExit} title="Миссиядан шығасың ба?" text="Қай қадамда тұрғаның сақталады — кейін осы жерден жалғастырасың."
  yes="Шығу" no="Жалғастыру" onyes={leave} onno={() => (askExit = false)} />

<style>
  .hd { flex: 1; min-width: 0; display: grid; gap: 6px; }
  .t1 { display: flex; align-items: center; gap: 8px; }
  .t1 b { flex: 1; min-width: 0; font: 900 18px var(--disp); text-shadow: 0 2px 0 var(--outline); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .xp { color: var(--gold); font-size: 15px; text-shadow: 0 2px 0 var(--outline); }
  .t2 { display: flex; align-items: center; gap: 8px; }
  .cap { font: 800 13px var(--txt); color: var(--dim); white-space: nowrap; }
  .hp { flex: 1; height: 14px; }
  .hp > i { background: linear-gradient(180deg, color-mix(in srgb, var(--tc) 55%, #fff), var(--tc)); }
  .intro { animation: pop-in .3s var(--ease-out) both; }
  .cnt { font-size: 13px; color: var(--dim); white-space: nowrap; }
  .cnt b { color: var(--ink); font-size: 15px; }

  .card { display: grid; gap: 12px; animation: pop-in .3s var(--ease-out) both; }
  .tag { justify-self: start; }
  .tag.c-goal, .tag.c-final { background: var(--gold); }
  .tag.c-bug { background: var(--glitch); }
  .tag.c-blitz { background: var(--ok); }
  .tag.c-why, .tag.c-predict { background: var(--crystal); }
  .widget { background: var(--deep); border: 3px solid var(--outline); padding: 10px 8px; border-radius: 16px; }
  .lock, .qbox { display: flex; align-items: center; gap: 12px; }
  .lock.long { font: 800 19px/1.35 var(--disp); }
  .lock :global(.icon), .lock > :global(svg) { flex: none; }
  .rule { display: grid; gap: 8px; box-shadow: inset 0 -4px 0 #ffe38a, 0 0 0 3px var(--gold); }
  .rule b { display: flex; align-items: center; gap: 8px; font: 900 19px var(--disp); }
  .rule p { font-size: 17px; font-weight: 800; }
  .q { font-size: 19px; font-weight: 800; }
  .choices { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 140px), 1fr)); gap: 8px; }
  .choices.one { grid-template-columns: minmax(0, 1fr); }
  .choices.tiny { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  /* варианты закреплены внизу панели: даже если условие длинное и панель прокручивается, ответы не уезжают под кнопку */
  .choices { position: sticky; bottom: 0; z-index: 2; margin: 0 -14px; padding: 12px 14px 4px; background: linear-gradient(180deg, transparent, var(--panel-2) 12px); }
  .choices .ans { min-width: 0; min-height: 48px; padding: 6px 10px; gap: 8px; font-size: clamp(15px, 4.4vw, 19px); }
  .choices .ans .l { width: 26px; height: 26px; font-size: 14px; }
  .ct { min-width: 0; overflow-wrap: break-word; line-height: 1.2; }
  /* реплика Бита в горизонтали — поверх окна сцены (как в Session.svelte): панель справа остаётся под задачу */
  .say { margin-top: auto; padding: 0 4px 4px; width: min(480px, 100%); animation: pop-in .25s var(--ease-out) both; }
  .say :global(.bubble:not(.kbub)) { font-size: 14px !important; line-height: 1.35; padding: 7px 10px !important; }
  .say :global(.typed) { inset: 7px 10px !important; }   /* тот же отступ, что у невидимого «призрака» текста, иначе строка переносится иначе и вылезает из пузыря */
  .grow { flex: 1; min-width: 0; }
  /* выкладка на бумаге: подсветка и пропуски — тёмные цвета */
  .card :global(.paper .hl) { color: #7a4d00; background: #ffe38a; border-bottom-color: var(--gold-deep); }
  .card :global(.paper .blank) { color: #b0276f; background: #ffe0f1; }
  .card :global(.paper .blank.filled) { color: var(--code-deep); background: #d9f8ff; border-color: var(--code-deep); }
  .card :global(.paper li small), .card :global(.paper .note) { color: var(--paper-dim); }
  /* финальный вопрос важнее иллюстрации: на невысоком экране картинку убираем (бой виден в окне сцены сверху) */
  @media (max-height: 830px) { .card.final :global(.scene) { display: none; } }
  @media (max-height: 830px) { .card :global(.bit .bubble) { font-size: 14px; line-height: 1.35; } .lock.long { font-size: 17px; } }
  /* невысокий телефон (667): плотнее */
  @media (max-height: 720px) {
    .card { gap: 8px; }
    .card :global(.paper) { padding: 10px 12px; }
    .q { font-size: 17px; }
    .rule { gap: 6px; } .rule p { font-size: 16px; } .rule b { font-size: 17px; }
    .choices { gap: 6px; } .choices .ans { min-height: 42px; padding: 4px 8px; } .choices .ans .l { width: 24px; height: 24px; }
    .widget { padding: 6px; }
  }
  /* телефон в горизонтали: колонка справа низкая (~230 px под содержимое) */
  @media (max-width: 999.98px) and (max-height: 560px) and (min-aspect-ratio: 23/20) {
    .card { gap: 6px; }
    .card :global(.tag) { font-size: 11px; padding: 2px 8px; }
    .card :global(.paper) { padding: 6px 10px; }
    .card :global(.bit .bubble) { font-size: 14px; }
    .q { font-size: 16px; }
    .rule { gap: 4px; } .rule p { font-size: 15px; } .rule b { font-size: 16px; } .rule small { display: none; }
    .lock { gap: 8px; }
    .choices { gap: 5px; } .choices .ans { min-height: 38px; padding: 3px 8px; font-size: clamp(14px, 2.2vw, 16px); } .choices .ans .l { width: 22px; height: 22px; font-size: 12px; }
    .widget { padding: 4px; }
  }
  .card :global(.paper .task) { color: var(--paper-ink); }
  /* шаг «Көр»: кнопка шага живёт под видео, подвал пуст и места не занимает */
  :global(.foot:empty) { display: none; }
  /* стрелка «листай ниже» уходит вправо: по центру она закрывала кнопку «Түсінбедім — Биттен сұра» (LessonHelper), которая стоит слева */
  :global(.frame:has([data-lesson]) .more) { place-items: end end; padding-right: 12px; }
  /* окно «Биткә түсіндір» принимает касания само (экран по умолчанию пропускает их к 3D): поле ответа ставит курсор, пустое место не жмёт «Келесі» урока под окном */
  .teach-veil { position: fixed; inset: 0; z-index: var(--z-modal, 50); pointer-events: auto; background: #05081ecc; display: grid; align-items: end; justify-items: center; padding: 12px; }
  .teach-box { width: min(520px, 100%); max-height: 92dvh; overflow: auto; border-radius: 22px; background: linear-gradient(180deg, var(--panel-hi), var(--panel)); border: 3px solid var(--outline); padding: 14px; box-shadow: 0 10px 0 #0007; }
</style>
