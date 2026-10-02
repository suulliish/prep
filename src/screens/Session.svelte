<script lang="ts">
  // Экран задачи в бою и практике — по фазам (docs/GAME_LOOP.md 20): один экран = одно, что сейчас нужно смотреть или нажимать.
  //   ask (вопрос и варианты) → conf (уверенность под выбранным) → event (событие на весь экран, само, без кнопок) → review (разбор: нажми) → задача-близнец.
  // Верный ответ: событие → сразу следующий вопрос. Слишком быстрый ответ: мини-шаг вместо тоста. Правила боя (урон 1, бас жау 7 из 10, звёзды, минуты) прежние.
  // «Строже по качеству» (01.10): обычный шаг (разминка, новая тема, смешанный бой, доп. миссия, ремонт вместо доп. миссии) идёт ДО N ВЕРНЫХ: каждая ошибка ставит близнеца в конец очереди
  // (не больше MAX_STEP_TWINS), монстр умирает на N-м верном. На лёгких темах после выбора варианта идёт самопроверка «Тексер» (stage self), после ошибки разбор «найди свою ошибку».
  import { onMount, tick } from 'svelte';
  import Bit from '../ui/Bit.svelte';
  import Screen from '../ui/Screen.svelte';
  import Icon from '../ui/Icon.svelte';
  import MicButton from '../ui/MicButton.svelte';
  import { trackExit, awayClock } from '../lib/track.svelte';
  import { examShare, AWAY_MS, EXAM_PENALTY } from '../engine/planner';
  import GlitchTurn from '../ui/GlitchTurn.svelte';
  import CoinChip from '../ui/CoinChip.svelte';
  import BattleEvent from '../ui/BattleEvent.svelte';
  import ConfidencePick from '../ui/ConfidencePick.svelte';
  import ReviewPanel from '../ui/ReviewPanel.svelte';
  import SelfCheckPanel from '../ui/SelfCheck.svelte';
  import { flyCoins } from '../ui/coinfly';
  import { answerCoins, enemyCoins, starsCoins, earnCoins, coinsOf } from '../lib/ship.svelte';
  import { SPOT_KZ } from '../three/spots';
  import { game, go, persist, skillDefs } from '../lib/store.svelte';
  import { W } from '../lib/world.svelte';
  import type { Technique } from '../three/world';
  import { ensurePlan, completeBlock, dayRec } from '../lib/session.svelte';
  import { makeItem, mistakeText, skillTitle, templatesOf, isTemplateId, type Item } from '../engine/items';
  import { bankFor, bankToItem } from '../engine/bank';
  import { recordAttempt, isDone } from '../engine/progress';
  import { isHonest, settleDay, taught, sequenceSlots, extraCap, repairNeed } from '../engine/planner';
  import { stemChars, isTooFast, rushLimitMs, adaptiveRushMs, tooFastMs, changedMarkup, varyAnswerPos, type Seg } from '../engine/rush';
  import { GLITCH_SAY, buildGlitch, glitchAllowed, firstGlitchAt, nextGlitchAt, shortMistake, type GlitchTurn as GlitchData } from '../engine/glitchturn';
  import { eventOf, breaksCombo, critCoins, eventMs, nextSureFirst, calibOf, calibLine, TWIN_TAG, halfCoins, HALF_COINS_OVER, REPAIR_FIX_COINS, REPAIR_EXTRA_FIXES, repairAsExtra, SHIP_SAY, bilLine, BIL_NOTE, rightOfLine, type Conf, type EventKind } from '../engine/confidence';
  import { buildReview, type Review, type ReviewMode } from '../engine/review';
  import { makeTwin, StepQueue, MAX_STEP_TWINS } from '../engine/twin';
  import { isEasySkill, selfCheckDue, selfCheckFor, selfNote, type SelfNote } from '../engine/selfcheck';
  import type { Attempt } from '../engine/types';
  import { showReward } from '../lib/reward.svelte';
  import { audio } from '../lib/audio';
  import { currentWorld, totalStars, STAR_REWARDS } from '../lib/look';
  import { react } from '../lib/voice';
  import { askBit, HELPER_ERR, MAX_QUESTIONS, type Turn, type HelperError } from '../lib/helper';
  // @ts-ignore
  import { LESSONS } from '../../content/lessons.mjs';
  // шпаргалка «Есте сақта» из урока темы — её видит ИИ-помощник
  const ruleOf = (id: string) => ((LESSONS as Record<string, any[]>)[id] ?? []).find(s => s.type === 'rule') as { lines: string[] } | undefined;
  import { sparksAt, floatText, flash, sceneCenter } from '../ui/fx.svelte';
  import { nb, longestChunk } from '../ui/text';
  // @ts-ignore
  import { techniqueOf } from '../../content/techniques.mjs';

  type Block = 'warmup' | 'new' | 'mixed' | 'extra' | 'boss' | 'repair';
  let { block }: { block: Block } = $props();

  const plan = ensurePlan();
  const pb = plan.blocks.find(b => b.id === block);
  const battle = true; // каждая практика — бой; у новой темы музыка «фокус»
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;   // «уменьшить движение»: без тряски и полёта камеры, событие короче

  function extraSkills(): string[] {
    const st = game.save.skills;
    const learning = skillDefs.filter(d => st[d.id]?.status === 'learning' && d.templates.length).map(d => d.id);
    const weak = skillDefs.filter(d => isDone(st[d.id]) && d.templates.length && taught(game.save, skillDefs, d.id))
      .sort((a, b) => Object.values(st[b.id].misconceptions).reduce((s, n) => s + n, 0) - Object.values(st[a.id].misconceptions).reduce((s, n) => s + n, 0))
      .map(d => d.id);
    return [...new Set([...learning, ...weak])].slice(0, 5);
  }
  const broken = game.save.repairShop.filter(r => !r.fixed);
  // ремонт вместо доп. миссии (Screen.session.asExtra): ровно 3 починки, и бой засчитывается как доп. миссия (+15 мин); поломок меньше трёх — обычный ремонт без минут
  const scr = game.screen;
  const asExtra = block === 'repair' && scr.name === 'session' && !!scr.asExtra;
  // шаг «до N верных»: разминка, новая тема, смешанный бой, доп. миссия, ремонт вместо доп. миссии (не босс и не обычный ремонт)
  const strict = block === 'warmup' || block === 'new' || block === 'mixed' || block === 'extra' || asExtra;
  // на корабле больше 6 неисправленных поломок: монеты за верные ответы вполовину (в ремонтном бою нет: он эти поломки и лечит)
  const halfOn = block !== 'repair' && broken.length > HALF_COINS_OVER;
  // Босс мира: вперемешку по всему пройденному (чередование), нужно 7 верных из 10
  const bossSkills = () => [...skillDefs.filter(d => isDone(game.save.skills[d.id]) && d.templates.length && taught(game.save, skillDefs, d.id)).map(d => d.id)].sort(() => Math.random() - 0.5).slice(0, 8);
  const BOSS_HP = 7;
  const skills = block === 'boss' ? bossSkills() : block === 'extra' ? extraSkills() : block === 'repair' ? [...new Set(broken.map(r => r.skill))].slice(0, 5) : pb?.skills ?? [];
  const total = block === 'boss' ? 10 : block === 'extra' ? 10 : block === 'repair' ? (asExtra ? repairNeed(broken.length) : Math.min(8, broken.length + 1)) : pb?.items ?? 8;
  const TITLE: Record<Block, string> = { warmup: 'Жылыну', new: 'Жаңа миссия · жаттығу', mixed: 'Аралас шайқас', extra: 'Қосымша тапсырма', boss: `Бас жау: ${currentWorld().kz}`, repair: 'Кемені жөндеу' };

  let idx = $state(0);
  let item = $state<Item | null>(null);
  let picked = $state<number | null>(null);
  // ask — вопрос; self — выбран вариант на лёгкой теме, под ним самопроверка «Тексер»; conf — под выбранным «Сенімдімін / Шамамен»;
  // event — событие на весь экран; review — разбор ошибки / быстрого ответа
  let stage = $state<'ask' | 'self' | 'conf' | 'event' | 'review'>('ask');
  let hintLevel = $state(0);
  let combo = $state(0);
  let honestAll = $state(true);
  let answered = 0, guessed = 0, honestShare = 1; // ответы быстрее порога (по длине вопроса) без полного разбора = угадывание
  // минуты — за верные честные ответы (решение Султана 01.10): доля шага = верные без спешки и без полного разбора / все ответы шага
  let paid = 0, minuteShare = 1;
  let twin = $state(false);       // этот вопрос — «егіз»: та же тема, новые числа
  // шаг «до N верных» (strict): очередь, счётчики для шапки, близнецы за ошибки ждут в конце очереди (хранится исходная задача: близнец собирается, когда до него дошла очередь)
  const sq = new StepQueue(total);
  let rightN = $state(0), addedN = $state(0);
  const twinQ: Item[] = [];
  // вид вопроса: orig — исходная задача шага, twin — близнец за ошибку (идёт в счёт и бьёт), bonus — близнец после быстрого ответа (только радует героя, в счёт не идёт)
  let qKind = $state<'orig' | 'twin' | 'bonus'>('orig');
  // сколько вопросов уже показано (мини-шаг и самопроверка — не чаще, чем раз в несколько вопросов)
  let served = 0;
  // этот ответ идёт в счёт и бьёт монстра (strict)
  let hitOk = false;
  // починено поломок в этом бою
  let fixedN = 0;
  // сам поймал свою ошибку после самопроверки (в звёзды не идёт)
  let caughtN = 0;
  // самопроверка «Тексер» на лёгких темах
  // тема вопроса лёгкая (на момент показа, до записи попытки)
  let qEasy = $state(false);
  let scDue = false, scDone = false, selfFirst: number | null = null, lastSelf = -9;
  let scCheck = $state<ReturnType<typeof selfCheckFor> | null>(null);
  let showSol = $state(false);
  let bitText = $state('');
  let bitMood = $state<'idle' | 'happy' | 'wow' | 'think' | 'sad'>('idle');
  let carry = '';                 // что Бит скажет на следующем вопросе (тема освоена, серия…): во время события и разбора его текст не показываем
  // ИИ-помощник «Түсінбедім»: только в разборе (правильный ответ уже показан)
  let aiTurns = $state<Turn[]>([]);
  let aiBusy = $state(false);
  let aiErr = $state('');
  let aiQ = $state('');
  let aiTalking = $state(false);   // идёт запись голоса или расшифровка
  const aiAsked = $derived(aiTurns.filter(t => t.role === 'kid').length);
  async function helpMe(question?: string) {
    if (!item || aiBusy) return;
    aiBusy = true; aiErr = '';
    const rule = ruleOf(item.skill)?.lines.join(' ');
    const mistake = picked != null && picked !== item.answer ? mistakeText(item.choices[picked].tag).kz : undefined;
    const history = $state.snapshot(aiTurns) as Turn[];
    try {
      const text = await askBit({ item, picked, mistake, rule }, history, question);
      if (question) aiTurns.push({ role: 'kid', text: question });
      aiTurns.push({ role: 'bit', text });
      aiQ = '';
      audio.play('hint');
    } catch (e) { aiErr = HELPER_ERR[(e as HelperError)] ?? HELPER_ERR.ai_unavailable; }
    aiBusy = false;
  }
  // Волны врагов (docs/GAME_LOOP.md 3): здоровье волны = число ударов (верных ответов), последняя — мини-босс
  const waves = block === 'boss' ? [2, 2, BOSS_HP - 4] : total <= 5 ? [total] : [Math.floor(total / 3), Math.floor(total / 3), total - 2 * Math.floor(total / 3)];
  let wave = $state(0);
  let mobHp = $state(waves[0]);
  const hpMax = $derived(waves[wave]);
  // Урон = «1 удар за 1 слот вопроса»: слотов столько же, сколько здоровья у всех волн. Верный «егіз» после быстрого ответа или подсказки слот уже ударил, поэтому только радуется:
  // иначе полоска пустела бы раньше конца боя, а последние ответы били бы врага с нулём здоровья («−1»). Здоровье доходит до нуля на последнем верном ответе.
  let slotHit = false;
  let busy = $state(false);      // идёт анимация боя — кнопки ждут
  let locked = $state(false);    // новый вопрос только появился — ввод закрыт 0.7 с
  let banner = $state(''), bannerId = $state(0);
  let firstTries = 0, firstRight = 0;
  let result = $state<{ stars: number; right: number; of: number; xp: number; minutes: number; coins: number; counted: boolean; note: string; sure: number; sureRight: number; all0: number; all1: number; caught: number } | null>(null);
  const xpStart = game.save.xp;
  function say(text: string) { banner = text; bannerId++; }
  let cine = $state(true);   // катсцена: вход в локацию, мини-босс, победа — панель задачи скрыта
  const isLastWave = () => wave >= waves.length - 1;
  // Монеты (src/lib/ship.svelte.ts): пишутся в сохранение сразу, а счётчик в шапке растёт, когда монета долетела
  let shownCoins = $state(coinsOf(game.save)), sessCoins = $state(0);
  function earn(n: number, from: { x: number; y: number }, sound = false) {
    if (!(n > 0)) return;
    earnCoins(n); sessCoins += n;
    if (sound) audio.play('coins');
    flyCoins(from, n, d => (shownCoins += d));
  }
  // приём темы: только если урок пройден (или тема уже выучена); удар красивее (цвет, вид, название над героем), урон всё равно 1
  function techFor(skill: string | undefined): Technique | null {
    const t = (skill ? techniqueOf(skill) : null) as Technique | null, st = skill ? game.save.skills[skill] : undefined;
    return t && (st?.lessonDone || isDone(st)) ? t : null;
  }
  const canHit = () => (strict ? hitOk : !slotHit) && mobHp > 0 && !(block === 'boss' && twin);
  // удар, если слот ещё не бил и у врага есть здоровье; иначе герой радуется (бас жау: «егіз» тоже не бьёт, победа = 7 верных из 10 с первой попытки)
  async function strikeOrCheer(crit: boolean, show: () => void) {
    if (canHit()) return hit(false, crit, show);
    W.world?.heroEmote('cheer'); show(); await sleep(900);
  }
  async function hit(sup: boolean, crit = false, onHit?: () => void) {
    busy = true; slotHit = true;
    const alive = mobHp > 0, last = isLastWave();
    mobHp = Math.max(0, mobHp - 1);   // каждый верный ответ — ровно один удар (суперудар убран 30.09: «пусть всё решает» ответ)
    const killed = await W.world?.heroAttack(crit, sup, techFor(item?.skill), onHit);
    // монеты за побеждённого врага волны (один раз); бас жау мира награждается в finishBoss, когда бой выигран
    if (alive && (killed || (last && mobHp <= 0)) && !(block === 'boss' && last)) earn(enemyCoins(false), sceneCenter(0.2), true);
    if (killed && !isLastWave()) {
      await W.world?.killMob(); audio.play('chest');
      wave++; mobHp = waves[wave];
      const boss = isLastWave(); if (boss) cine = true;
      say(boss ? (block === 'boss' ? 'Бас жау!' : 'Күшті жау!') : `${wave + 1}-толқын`);
      await W.world?.spawnMob(mobHp, currentWorld().mob, boss, block === 'boss' && boss);
      cine = false;
    }
    busy = false;
  }
  // ход врага: щит держит (hold) или разбит (brk — ошибка при уверенности)
  async function enemyTurn(brk = false, onContact?: () => void) { busy = true; await W.world?.enemyAttack({ brk, quiet: true, onContact }); busy = false; }
  let startAt = 0, awayAt = 0;
  // время ответа и «сворачивал ли приложение» — с момента, когда вопрос можно решать
  function markStart() { startAt = performance.now(); awayAt = awayClock(); }
  // ответы шага копятся в записи дня сразу (не в конце боя): выход и новый бой не обнуляют плохой результат
  function tally(paidN: number, wrongN: number) {
    if (block === 'repair' || block === 'extra' || block === 'boss') return;
    const r = dayRec();
    r.tally ??= {};
    r.tally[block] ??= { n: 0, paid: 0, wrong: 0 };
    const t = r.tally[block]; t.n++; t.paid += paidN; t.wrong += wrongN;
  }
  let wrongN = 0;
  let dead = false;
  const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

  // Против спешки (docs/GAME_LOOP.md 15, 20, src/engine/rush.ts): подсветка изменений, «егіз» после быстрого ответа
  const seq = sequenceSlots(skills, total, templatesOf);   // чередование: темы по кругу, два вопроса одного шаблона подряд не ставим
  let prevKz: string | null = null, prevPos = -1;
  let hlLines = $state<Seg[][]>([]);
  let qKey = $state(0);
  let lastMini = -9;                                        // номер вопроса, на котором был мини-шаг быстрого ответа (не чаще раза в 3 вопроса)
  const shownTpl: (string | null)[] = [];                  // шаблоны показанных вопросов по порядку (близнец не ставит третий одинаковый подряд)
  const flips: boolean[] = [];                             // порядок кнопок уверенности по вопросам
  let sureFirst = $state(true);
  let bitEl = $state<HTMLElement>();
  // после подсказки — показать реплику Бита (она ниже вариантов)
  const showBit = () => setTimeout(() => bitEl?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 60);

  // Калибровка: «когда ты был уверен, ты прав в N из 10» (итог боя). Считаем ответы «Сенімдімін» без подсказок.
  let sureN = 0, sureRight = 0;

  // Настоящие задачи экзамена (банк «Дарын»): только по пройденным темам, сначала невиданные.
  // Босс — 3 из 10, смешанный бой и доп. миссия — 2; урок новой темы и разминка — только генераторы.
  const BANK_SLOTS: Partial<Record<Block, number[]>> = { boss: [2, 5, 8], mixed: [2, 5], extra: [3, 6] };
  const seen = new Set(game.save.attempts.map(a => a.source));
  const bankQueue = BANK_SLOTS[block] ? bankFor(id => isDone(game.save.skills[id]) && taught(game.save, skillDefs, id), seen) : [];
  // tw: null — обычный вопрос; 'redo' — «егіз» после ошибки (бьёт, если верно); 'extra' — «егіз» после быстрого ответа
  // from — исходная задача, чей близнец нужен (очередь strict); queued — вопрос идёт из очереди близнецов: это не новый вопрос и в «бірінші әрекет» он не входит
  function nextItem(tw: 'redo' | 'extra' | null, from: Item | null = null, queued = false) {
    const prev = item, base = from ?? prev;
    let fresh: Item | null = null, isTwin = false;
    // ремонт: вопрос по теме, где все поломки уже починены, ничего не чинит (в «ремонте вместо доп. миссии» верный ответ шёл бы как ошибка) — берём тему с открытой поломкой
    const fixable = (sk: string) => block !== 'repair' || game.save.repairShop.some(r => !r.fixed && r.skill === sk);
    const openSkill = skills.find(fixable);
    // близнец: тот же шаблон, новые числа; ту же задачу не показываем (engine/twin.ts)
    if (tw && base && (fixable(base.skill) || !openSkill)) {
      fresh = makeTwin(base, shownTpl, seq[idx + 1]?.tpl ?? null); isTwin = !!fresh;
      if (!fresh && queued) fresh = makeItem(base.skill, { avoidKz: base.kz });
    }
    if (!fresh) {
      const slot0 = seq[idx] ?? { skill: skills[idx % Math.max(1, skills.length)], tpl: null };
      const slot = fixable(slot0.skill) || !openSkill ? slot0 : { skill: openSkill, tpl: null };
      const fromBank = BANK_SLOTS[block]?.includes(idx) && bankQueue.length ? bankQueue.shift() : null;
      fresh = fromBank ? bankToItem(fromBank) : makeItem(slot.skill, { tpl: slot.tpl ?? undefined, avoidKz: prev?.kz });
    }
    if (fresh && !fresh.real) fresh = varyAnswerPos(fresh, prevPos);   // верный ответ не на том же месте, что в прошлом вопросе
    item = fresh; twin = isTwin || queued || qKind !== 'orig';
    if (fresh) shownTpl.push(isTemplateId(fresh.source) ? fresh.source : null);
    // «егіз» сравниваем с исходной задачей (что в ней стало другим); у близнеца из очереди это не прошлый вопрос, а задача, на которой была ошибка
    if (fresh) { hlLines = changedMarkup(fresh.kz.split('\n').map(nb), tw && base ? base.kz : prevKz); prevKz = fresh.kz; prevPos = fresh.answer; }
    qKey++; served++;
    picked = null; stage = 'ask'; hintLevel = 0; showSol = false;
    aiTurns = []; aiErr = ''; aiQ = ''; aiBusy = false;
    sureFirst = nextSureFirst(flips); flips.push(sureFirst);
    glitch = null; glPick = null; glSoft = [];
    // в ремонте ход Глитча не собираем: починку считает только обычный ответ
    if (fresh && (forceGlitch ? !twin && !fresh.real && block !== 'repair' : glitchAllowed({
      idx, total, at: glAt, attempts: game.save.attempts.filter(a => a.skill === fresh.skill).length, block, lastWave: isLastWave(), mobHp,
      revenge: twin, rushTwin: false, check: block === 'repair', real: !!fresh.real,
    }))) {
      glitch = buildGlitch(fresh);
      if (glitch) glAt = nextGlitchAt(idx);
      if (forceGlitch) (window as any).__glitch = glitch;   // dev: скрипту проверки нужно знать, какая строка неверная
    }
    // самопроверка: только лёгкая тема (состояние до записи попытки), не чаще раза в 2 вопроса, не босс, не ход Глитча
    qEasy = !!fresh && isEasySkill(game.save.skills[fresh.skill]);
    scDue = !!fresh && selfCheckDue({ served, lastAt: lastSelf, easy: qEasy, block, glitch: !!glitch });
    if (scDue) lastSelf = served;
    scDone = false; selfFirst = null; scCheck = scDue && fresh ? selfCheckFor(fresh) : null;
    bitText = carry; bitMood = carry ? 'happy' : 'idle'; carry = '';
    markStart();
  }
  // «Глитчтің қатесі» (D8, docs/GAME_LOOP.md 16): вместо вопроса Глитч «решил» задачу, ребёнок нажимает первую неверную строку
  let glitch = $state<GlitchData | null>(null);
  let glPick = $state<number | null>(null);
  let glSoft = $state<number[]>([]);   // строки-следствия, на которые уже нажали: мягкая отметка, не наказание
  let glAt = firstGlitchAt();   // с какого вопроса ход «созрел»
  // только в разработке: ?glitch=1 — ход на каждом вопросе, где его можно собрать (для скриншотов и проверки)
  const forceGlitch = import.meta.env.DEV && new URLSearchParams(location.search).get('glitch') === '1';

  onMount(() => {
    if (!skills.length) { go({ name: 'hub' }); return; }
    // бас жау — одна попытка в день (02.10): проиграл — завтра снова, перезапуском монеты за волны не набрать
    if (block === 'boss') { dayRec().bossTried = true; persist(); }
    W.dim = false;
    W.world?.setMode('battle');
    busy = true;
    // тема = свой уголок мира; разминка и смешанный бой — уголок дня
    const v = W.world?.setSpot(block === 'new' || block === 'repair' ? skills[0] : `${block}:${game.day}`);
    if (v !== undefined) say(`${currentWorld().kz} · ${SPOT_KZ[v]}`);
    (W.world?.arrive() ?? Promise.resolve())
      .then(() => W.world?.spawnMob(mobHp, currentWorld().mob, waves.length === 1))
      .then(() => { cine = false; say(waves.length > 1 ? '1-толқын' : 'Шайқас!'); busy = false; markStart(); });   // время ответа — с момента, когда вопрос можно решать
    if (block === 'boss') setTimeout(() => react('boss'), 600);
    audio.setMood(block === 'new' ? 'focus' : 'battle');
    // Бит говорит про поломки один раз, на первом вопросе
    if (halfOn) carry = SHIP_SAY.half;
    // первый вопрос — первая исходная задача
    if (strict) sq.next();
    nextItem(null);
    const onKey = (e: KeyboardEvent) => {
      if (stage !== 'ask' && stage !== 'conf' && stage !== 'self') return;
      if (glitch) { if (/^[1-5]$/.test(e.key) && +e.key <= glitch.lines.length) glitchTap(+e.key - 1); return; }
      if (/^[1-5]$/.test(e.key)) pick(+e.key - 1);
    };
    addEventListener('keydown', onKey);
    return () => { dead = true; removeEventListener('keydown', onKey); W.world?.eventCam(false); W.world?.clearMob(); };
  });

  // выбрал вариант (можно передумать: касание другого переносит блок самопроверки или уверенности)
  function pick(i: number) {
    if (glitch || (stage !== 'ask' && stage !== 'conf' && stage !== 'self') || locked || busy) return;
    picked = i; audio.play('click');
    // на лёгкой теме сначала самопроверка; до её кнопки последний выбранный вариант считается тем, что ребёнок проверял
    if (scDue && !scDone) { stage = 'self'; selfFirst = i; } else stage = 'conf';
    tick().then(() => document.querySelector('.cbtn, .scbtn')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }));
  }
  // «Тексердім, дұрыс»: к уверенности; «Қателесіппін, өзгертемін»: назад к вариантам (выбор снимается, самопроверка второй раз не показывается)
  function selfOk() { if (stage !== 'self') return; scDone = true; stage = 'conf'; audio.play('click'); tick().then(() => document.querySelector('.cbtn')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })); }
  function selfChange() { if (stage !== 'self') return; scDone = true; picked = null; stage = 'ask'; audio.play('click'); }

  function hint() {
    if (stage !== 'ask' || !item) return;
    hintLevel = Math.min(4, hintLevel + 1);
    audio.play('hint');
    if (hintLevel === 4) { showSol = true; bitText = 'Толық шешуі төменде. Бұл есеп есептелмейді — «егіз» есеп аласың.'; bitMood = 'think'; }
    else { bitText = item.hints[hintLevel - 1]?.kz ?? ''; bitMood = 'think'; }
    showBit();
  }

  // события модели знаний после попытки: «үйренді», кристалл, провал повторения. Слова Бита идут в carry: во время события и разбора они не показываются
  function applyEvents(events: string[], skill: string) {
    for (const ev of events) {
      if (ev === 'learned') { react('learned'); audio.play('levelup'); floatText('ҮЙРЕНДІ!', sceneCenter(0.3).x, sceneCenter(0.3).y, '#3ff0ff', true); sparksAt(sceneCenter(0.3).x, sceneCenter(0.3).y, ['#3ff0ff', '#b58cff'], 70, 10); W.world?.celebrate(); carry = `«${skillTitle(skill).kz}» — үйрендің! Ертең тексереміз: өтсең, кристалға айналады.`; }
      if (ev === 'crystal') { react('crystal'); audio.play('crystal'); floatText('КРИСТАЛЛ!', sceneCenter(0.3).x, sceneCenter(0.3).y, '#b58cff', true); sparksAt(sceneCenter(0.3).x, sceneCenter(0.3).y, ['#b58cff', '#ffffff', '#3ff0ff'], 90, 11); carry = `«${skillTitle(skill).kz}» кристалға айналды — енді бұл тақырып сенікі!`; }
      if (ev === 'review_failed') carry = 'Бұл тақырып сәл ұмытылған екен — қайта жаттығамыз, қорқынышты емес.';
    }
  }

  // ---------- событие на весь экран ----------
  let evKind = $state<EventKind>('hit'), evMs = $state(1900), evShow = $state(false), evSmall = $state('');
  // Панель уезжает, окно сцены разворачивается, камера подлетает; потом run ведёт 3D-анимацию и вызывает show() в момент касания (тогда появляется надпись).
  // Событие не короче eventMs и не обрывается раньше конца анимации; кнопок нет.
  async function playEvent(kind: EventKind, run: (show: () => void) => Promise<unknown>, small = '') {
    evKind = kind; evSmall = small; evMs = eventMs(kind, reduce); evShow = false; busy = true; stage = 'event';
    const t0 = performance.now(), show = () => { evShow = true; };
    const cap = setTimeout(show, 1800);   // страховка: надпись появится, даже если касание не пришло
    W.world?.eventCam(true);
    await sleep(reduce ? 60 : 380);   // окно разворачивается, камера подлетает
    try { await run(show); } finally { clearTimeout(cap); show(); }
    const left = evMs - (performance.now() - t0);
    if (left > 0) await sleep(left);
    W.world?.eventCam(false);
    busy = false;
  }

  const MODE: Attempt['mode'] = block === 'new' ? 'practice' : block === 'extra' ? 'extra' : block === 'boss' ? 'boss' : block === 'warmup' ? 'warmup' : block === 'repair' ? 'practice' : 'mixed';
  const DUNNO_MIN_MS = 1500;   // «Білмеймін» быстрее этого — тоже не чтение условия
  // монеты за ответ: на корабле больше 6 поломок — вполовину
  const answerPay = (n: number) => (halfOn ? halfCoins(n) : n);
  // после ответа шаг «до N верных» ведёт счёт: верный (идёт в счёт) — к N; ошибка — близнец в конец очереди, пока не исчерпан лимит
  function stepCount(counted: boolean, it: Item) {
    if (!strict) return;
    if (counted) { sq.good(); rightN = sq.right; }
    else if (qKind !== 'bonus') { if (sq.miss()) twinQ.push(it); addedN = sq.added; }
  }
  async function confirm(conf: Conf) {
    if (!item || glitch || busy || (stage !== 'ask' && stage !== 'conf')) return;
    const dunno = conf === 'unsure';
    if (!dunno && picked === null) return;
    const it = item, pk = dunno ? null : picked, timeMs = performance.now() - startAt, away = Math.round(awayClock() - awayAt);
    const correct = pk !== null && pk === it.answer, tag = pk === null ? undefined : it.choices[pk].tag;
    // «наугад» — по длине вопроса (rush.ts), а не жёсткие 5 с; честный выход «Білмеймін» не наказываем.
    // Личный порог ребёнка (медиана его верных ответов на этом шаблоне × 0,45, от 5 до 25 с) ловит спешку, которую общий порог пропускает
    // личный порог — только для неверных ответов: быстрый верный ответ (знает) не наказываем, на его истории ~20% верных были бы «спешкой»
    const chars = stemChars(it.kz), adaptive = correct ? null : adaptiveRushMs(game.save.attempts, it.source, it.skill);
    // свернул приложение посреди задачи (калькулятор, поиск) — ответ не честный, в минуты не идёт
    const honest = away < AWAY_MS && (dunno ? hintLevel < 4 && timeMs >= DUNNO_MIN_MS : isHonest(timeMs, hintLevel, hintLevel === 0 ? rushLimitMs(chars, adaptive) : tooFastMs(chars)));
    const fast = !dunno && isTooFast(timeMs, chars, hintLevel, adaptive);
    // сам поймал: после самопроверки сменил неверный ответ на верный (в звёзды не идёт, но ответ верный)
    const note: SelfNote | null = scDue && scDone ? selfNote(selfFirst, pk, it.answer) : null;
    const caught = note === 'caught' && hintLevel < 4 && !dunno;
    answered++;
    if (!twin) { firstTries++; if (correct && hintLevel === 0 && !caught) firstRight++; }   // «егіз» — не новый вопрос, в звёзды не идёт
    if (caught) caughtN++;
    if (!honest && hintLevel < 4) { honestAll = false; guessed++; }
    if (honest && correct && hintLevel < 4) paid++;
    const wrongNow = !correct && !dunno && hintLevel < 4 ? 1 : 0;
    wrongN += wrongNow;
    tally(honest && correct && hintLevel < 4 ? 1 : 0, wrongNow);
    if (conf === 'sure' && hintLevel === 0) { sureN++; if (correct) sureRight++; }
    const rec: Attempt & { selfCheck?: SelfNote } = {
      at: Date.now(), day: game.day, skill: it.skill, source: it.source, correct, confidence: conf,
      hintLevel, honest, timeMs: Math.round(timeMs), ...(fast ? { fast: true } : {}), ...(away >= AWAY_MS ? { away } : {}), ...(tag ? { tag } : {}), mode: MODE, ...(note ? { selfCheck: note } : {}),
    };
    const events = recordAttempt(game.save, rec);
    const at = sceneCenter(0.42), wasTwin = twin;
    // мини-шаг вместо тоста «Асықпа!»
    const mini = correct && fast && !wasTwin && hintLevel === 0 && served - lastMini >= 3;
    if (mini) lastMini = served;
    let fixedNow = false;
    if (correct) {
      combo++;
      const xp = hintLevel >= 4 ? 0 : hintLevel > 0 ? 4 : 10 + Math.min(combo - 1, 5) * 2;
      game.save.xp += xp;
      audio.play(conf === 'sure' ? 'crit' : 'correct'); if (combo > 1) audio.play('combo', { combo });
      if (combo === 3 || combo === 6) react('combo'); else react('correct', 0.4);
      sparksAt(at.x, at.y, ['#5ce39c', '#3ff0ff', '#ffc94a'], conf === 'sure' ? 50 : 26);
      if (xp) floatText(`+${xp} XP`, at.x, at.y - 20, '#ffc94a', conf === 'sure');
      // быстрый ответ монет не даёт; «крит» — одна монета сверху
      earn(answerPay(answerCoins({ correct, tries: 1, hintLevel, fast }) + critCoins(correct, conf, hintLevel, fast)), { x: at.x, y: at.y - 30 });
      // «сам поймал» монет сверху не даёт (02.10): иначе выгодно нарочно выбрать неверное и «поймать» себя
      if (combo >= 3) floatText(`КОМБО ×${combo}`, sceneCenter(0.25).x, sceneCenter(0.25).y, '#3ff0ff', true);
      if (block === 'repair' && hintLevel === 0) {
        const r = game.save.repairShop.find(x => !x.fixed && x.skill === it.skill);
        if (r) { r.fixed = true; fixedNow = true; fixedN++; floatText('ЖӨНДЕЛДІ', at.x, at.y - 50, '#5ce39c'); earn(REPAIR_FIX_COINS, { x: at.x, y: at.y - 60 }); }
      }
    } else {
      if (breaksCombo(false, conf)) combo = 0;   // серию рвёт только ошибка при уверенности
      audio.play(dunno ? 'hint' : 'wrong'); if (!dunno) { flash(conf === 'sure' ? '#ff5a6e' : '#ff9a6b'); react('wrong', 0.6); }
      if (block !== 'repair') game.save.repairShop.push({ source: it.source, skill: it.skill, ...(tag ? { tag } : {}), addedDay: game.day });
    }
    // в счёт шага: верный без полного разбора и не «бонусный» близнец; в ремонте вместо доп. миссии считаются починки
    const counted = asExtra ? fixedNow : correct && hintLevel < 4 && qKind !== 'bonus';
    stepCount(counted, it);
    hitOk = strict ? counted : true;
    applyEvents(events, it.skill);
    persist();
    const kind = caught && !fast ? 'self' : eventOf(correct, conf);
    if (kind === null) return enterReview('dunno', null, false, 0);   // «Білмеймін»: события нет, сразу разбор
    // удар героя (урон 1), если ответ идёт в счёт (strict) или слот ещё не бил; иначе герой только радуется
    await playEvent(kind, show => (correct ? strikeOrCheer(conf === 'sure' || caught, show) : enemyTurn(kind === 'break', show)));
    if (dead) return;
    if (!correct) return enterReview('error', pk, conf === 'sure', fast ? timeMs : 0);
    if (events.some(e => e === 'learned' || e === 'crystal')) await sleep(reduce ? 500 : 1500);   // успеть увидеть «ҮЙРЕНДІ!»
    if (dead) return;
    if (!strict && hintLevel >= 4 && !wasTwin) return advance('extra');   // с полным разбором не считается: близнец (в strict он уже стоит в конце очереди)
    if (mini) return enterReview('fast', null, false, timeMs);
    return advance(null);   // верно: следующий вопрос сам
  }

  // ---------- разбор ----------
  let review = $state<Review | null>(null), rvMode = $state<ReviewMode>('error'), rvSure = $state(false), rvFast = $state(0), rvKey = $state(0);
  function enterReview(mode: ReviewMode, pk: number | null, sure: boolean, fastMs: number, custom?: Review) {
    if (!item) return;
    review = custom ?? buildReview(item, pk, mode, Math.random, { easy: qEasy }); rvMode = mode; rvSure = sure; rvFast = fastMs; rvKey++;
    stage = 'review';
  }
  // «Жаңа есеп →»: после ошибки и «білмеймін» — близнец (бьёт, если верно); после быстрого ответа — близнец без нового удара по слоту; близнец уже был — дальше
  // strict: ошибка и «білмеймін» уже поставили близнеца в конец очереди (stepCount), поэтому дальше идёт очередь; после быстрого ответа близнец-бонус сразу
  const leaveReview = () => stage === 'review' && advance(strict ? (rvMode === 'fast' ? 'extra' : null) : twin ? null : rvMode === 'fast' ? 'extra' : 'redo');

  // Ход «Глитчтің қатесі»: вопрос «где ошибка началась?». Верно — контрудар; строка после ошибки (следствие) — не наказание:
  // Бит говорит, что ошибка раньше, строка получает мягкую отметку, есть ещё одна попытка; верная строка после неё и любая другая (дальше или дважды промахнулся) — неверно.
  // Идёт в модель знаний как обычная попытка навыка (флаг kind: 'glitch'); ответ со второй попытки — с подсказкой (hintLevel 1). В мастерскую не попадает: это разбор чужой ошибки, а не своё решение.
  async function glitchTap(k: number) {
    if (!glitch || !item || glPick !== null || locked || busy || stage !== 'ask' || glSoft.includes(k)) return;
    const g = glitch, sk = item.skill;
    if (g.follows.includes(k) && !glSoft.length) {
      glSoft = [k]; audio.play('click'); bitText = GLITCH_SAY.followTry; bitMood = 'think'; showBit();
      return;
    }
    const tried = glSoft.length > 0, hint = tried ? 1 : 0;
    const timeMs = performance.now() - startAt, away = Math.round(awayClock() - awayAt);
    const correct = k === g.bad;
    const follow = g.follows.includes(k);
    glPick = k;
    const honest = away < AWAY_MS && isHonest(timeMs, hint, tooFastMs(stemChars(item.kz) + g.lines.join('').length));
    // читать нужно и условие, и все строки: порог «слишком быстро» растёт с их длиной
    const fast = isTooFast(timeMs, stemChars(item.kz) + g.lines.join('').length, hint);
    answered++; firstTries++; if (correct) firstRight++;
    if (!honest) { honestAll = false; guessed++; }
    if (honest && correct) paid++;
    if (!correct) wrongN++;
    tally(honest && correct ? 1 : 0, correct ? 0 : 1);
    const rec: Attempt & { kind: 'glitch' } = {
      at: Date.now(), day: game.day, skill: sk, source: item.source, correct, hintLevel: hint, honest, timeMs: Math.round(timeMs),
      ...(fast ? { fast: true } : {}), ...(away >= AWAY_MS ? { away } : {}), tag: correct ? 'correct' : follow ? g.tag : 'glitch_miss', mode: MODE, kind: 'glitch',
    };
    const events = recordAttempt(game.save, rec);
    const at = sceneCenter(0.42);
    if (correct) {
      combo++;
      const xp = tried ? 4 : 10 + Math.min(combo - 1, 5) * 2;
      game.save.xp += xp;
      audio.play('crit'); if (combo > 1) audio.play('combo', { combo });
      if (combo === 3 || combo === 6) react('combo'); else react('correct', 0.4);
      sparksAt(at.x, at.y, ['#ff6fc6', '#3ff0ff', '#ffc94a'], 50);
      floatText(`+${xp} XP`, at.x, at.y - 20, '#ffc94a', true);
      earn(answerPay(answerCoins({ correct, tries: 1, hintLevel: hint, fast })), { x: at.x, y: at.y - 30 });
      if (combo >= 3) floatText(`КОМБО ×${combo}`, sceneCenter(0.25).x, sceneCenter(0.25).y, '#3ff0ff', true);
      carry = (!honest && !fast ? 'Дұрыс, бірақ тым жылдам! Асықпа. ' : '') + `${GLITCH_SAY.right} ${shortMistake(g.tag)}`;
    } else {
      combo = 0;
      audio.play('wrong'); flash('#ff9a6b'); react('wrong', 0.6);
    }
    stepCount(correct, item);
    hitOk = strict ? correct : true;
    applyEvents(events, sk);
    persist();
    // контрудар: событие «крит» (всегда: ребёнок поймал Глитча); ошибка — щит держит
    await playEvent(correct ? 'counter' : 'hold', show => correct ? strikeOrCheer(true, show) : enemyTurn(false, show), correct ? '' : 'Қате жолды таппадың — қалқан ұстады');
    if (dead) return;
    if (correct) return advance(null);
    enterReview('error', null, false, fast && !honest ? timeMs : 0, { kind: 'glitch', turn: g, picked: k });
  }

  // Шаг «до N верных»: следующий вопрос берёт очередь (StepQueue): исходные задачи, потом близнецы за ошибки; bonus — близнец после быстрого ответа сразу (в счёт не идёт)
  async function advanceStrict(bonus: boolean) {
    // тема стала «үйренді» — бой заканчивается раньше, как и прежде (после 6 верных)
    const learnedNow = block === 'new' && game.save.skills[skills[0]]?.status === 'learned' && sq.right >= 6;
    const kind = bonus ? 'bonus' : learnedNow ? null : sq.next();
    if (!kind) return finish();
    if (kind === 'orig') idx++;
    const from = kind === 'twin' ? twinQ.shift() ?? null : null;
    qKind = kind;
    nextItem(kind === 'orig' ? null : kind === 'bonus' ? 'extra' : 'redo', from, kind === 'twin');
    locked = true; say(twin ? 'Егіз есеп!' : glitch ? GLITCH_SAY.title : `Сұрақ ${served}`); audio.play('click');
    document.querySelector('.frame .body')?.scrollTo({ top: 0 });
    setTimeout(() => { markStart(); locked = false; }, 700);
  }
  async function advance(tw: 'redo' | 'extra' | null) {
    if (dead) return;
    if (strict) return advanceStrict(tw === 'extra');
    // «егіз» — тот же слот вопроса
    if (!tw) { idx++; slotHit = false; }
    // бас жау повержен (последняя волна, здоровья нет) — бой окончен, не стоять с пустой полоской до 10-го вопроса
    const bossDown = block === 'boss' && isLastWave() && mobHp <= 0;
    if (idx >= total || bossDown) return finish();
    nextItem(tw);
    // новый вопрос виден сразу: перелистывание, номер, ввод закрыт 0.7 с
    locked = true; say(twin ? 'Егіз есеп!' : glitch ? GLITCH_SAY.title : `Сұрақ ${idx + 1}/${total}`); audio.play('click');
    document.querySelector('.frame .body')?.scrollTo({ top: 0 });
    setTimeout(() => { markStart(); locked = false; }, 700);
  }
  // звёзды по верным с первой попытки, но не больше, чем позволяет доля честных ответов (наспех — не 3★ и не монеты за них)
  const starsOf = () => { const a = firstTries ? firstRight / firstTries : 0, h = honestShare; return Math.min(a >= 0.9 ? 3 : a >= 0.7 ? 2 : 1, h >= 0.9 ? 3 : h >= 0.7 ? 2 : 1); };

  // Босс не даёт минут (они — за план), зато открывает путь в следующий мир
  async function finishBoss() {
    honestShare = answered ? (answered - guessed) / answered : 1;   // для звёзд: наспех — не 3★
    const won = mobHp <= 0, w = currentWorld();
    cine = true; let note = '';
    if (won && W.world) {
      await W.world.killMob(); audio.play('chest'); await W.world.openChest(); W.world.celebrate(0xffc94a); audio.play('levelup');
      game.save.worldsCleared ??= [];   // отдельной строкой: «(x ??= []).push» пишет в копию, а не в сохранение
      if (!game.save.worldsCleared.includes(w.id)) game.save.worldsCleared.push(w.id);
      game.save.xp += 50; persist();
      earn(enemyCoins(true), sceneCenter(0.3), true);
      floatText('БАС ЖАУ ЖЕҢІЛДІ!', sceneCenter(0.3).x, sceneCenter(0.3).y, '#ffc94a', true);
      note = `«${w.kz}» әлемінің бас жауы жеңілді! +50 XP. Келесі әлемге портал ашылуға дайын — картаны қара.`;
    } else {
      await W.world?.killMob();
      note = 'Бас жау шегінді, бірақ жеңілген жоқ. Қателерді шеберханада жөнде де, ертең қайта кел!';
    }
    item = null; stage = 'ask'; persist(); cine = false;
    result = { stars: won ? starsOf() : 0, right: firstRight, of: firstTries, xp: game.save.xp - xpStart, minutes: 0, coins: sessCoins, counted: won, note, sure: sureN, sureRight, all0: 0, all1: 0, caught: caughtN };
  }

  // бой кончается один раз, сколько бы раз ни нажали «Жаңа есеп →»
  let finished = false;
  async function finish() {
    if (finished) return;
    finished = true;
    if (block === 'boss') return finishBoss();
    const b = block;
    // Минуты — за верные честные ответы (решение Султана 01.10; раньше 30.09 — за любые честные): шаг засчитывается всегда,
    // а его минуты умножаются на долю верных ответов без спешки и без полного разбора (запись дня r.honest хранит эту долю).
    // доп. миссия (GAME_LOOP.md 8): 7 верных с первой попытки из 10
    const before = dayRec().minutesToday;
    let counted = true, note = carry; carry = '';
    honestShare = answered ? (answered - guessed) / answered : 1;
    // минуты по правилам экзамена (+1 / −¼ / 0) и по ВСЕМ ответам шага за день, включая брошенные бои
    const tl = block !== 'repair' && block !== 'extra' ? dayRec().tally?.[b] : undefined;
    minuteShare = tl ? examShare(tl.paid, tl.wrong, tl.n) : examShare(paid, wrongN, answered);
    if (block !== 'repair' && block !== 'extra') { const r = dayRec(); r.honest ??= {}; r.honest[b] = tl ? minuteShare : Math.min(r.honest[b] ?? 1, minuteShare); }
    if (minuteShare < 1) note = `Ойын минуты емтихандағыдай: дұрыс +1, қате −¼, «Білмеймін» 0. Минуттың ${Math.round(minuteShare * 100)}% есептелді.` + (guessed > 0 ? ' Асығыс жауап есептелмейді.' : '');
    if (block === 'extra' && firstRight < 7) {
      counted = false; note = `Бірінші әрекеттен ${firstRight} дұрыс, керегі — 7. Миссия есептелмеді, тағы көр!`;
    }
    // шаг «до N верных» закончился раньше, чем набралось N (лимит близнецов): говорим, как есть
    if (strict && sq.right < total && !(block === 'new' && game.save.skills[skills[0]]?.status === 'learned') && counted) {
      note = `${rightOfLine(sq.right, total)} жауаппен аяқталды: егіз есеп ${MAX_STEP_TWINS}-дан артық берілмейді.` + (note ? ' ' + note : '');
    }
    // ремонт вместо доп. миссии: 3 починки = доп. миссия (+15 мин), если на сегодня она ещё не взята; меньше поломок или меньше починок — обычный ремонт без минут
    const extraRepair = repairAsExtra({ asExtra, fixed: fixedN, need: total, extraMissions: dayRec().extraMissions, cap: extraCap(game.save.settings.extraMissionCap) });
    if (asExtra && !extraRepair) note = `Қосымша миссия үшін ${Math.max(REPAIR_EXTRA_FIXES, total)} ақауды жөндеу керек еді, жөнделгені: ${fixedN}. Минут берілмеді, бірақ жөнделгені кемеде қалды.`;
    item = null; stage = 'ask'; busy = true;
    // доп. миссия: её 15 минут тоже умножаются на долю честных ответов (копится сумма долей по всем доп. миссиям дня)
    if ((counted && block === 'extra') || extraRepair) { const r = dayRec(); r.extraHonest = (r.extraHonest ?? r.extraMissions) + minuteShare; }
    if (extraRepair) completeBlock('extra');
    else if (counted && block !== 'repair') completeBlock(b as any); else persist();
    if (battle && W.world) {
      cine = true;
      await W.world.killMob();
      if (counted) { audio.play('chest'); await W.world.openChest(); audio.play('levelup'); }
    }
    busy = false; cine = false;
    const got = dayRec().minutesToday - before, stars = counted ? starsOf() : 0;
    // строка «★ N · келесі сыйлық» считает по общему счёту звёзд (look.totalStars: DayRecord.stars) ДО и ПОСЛЕ записи звёзд этого боя
    const all0 = totalStars();
    if (got > 0) await showReward({ minutes: got, title: b === 'extra' || extraRepair ? 'Қосымша миссия!' : 'Қадам аяқталды!', why: TITLE[b], today: dayRec().minutesToday, weekend: dayRec().minutesWeekend });
    if (stars) {
      const r = dayRec();
      // 3 звезды: бонус монетами один раз за шаг дня (доп. миссии — каждая отдельный уровень)
      if (b === 'extra' || (r.stars?.[b] ?? 0) < 3) earn(starsCoins(stars), sceneCenter(0.35), true);
      // сначала создать объект в сохранении, потом писать в него: «(x ??= {})[k] = …» пишет в копию, а не в состояние Svelte (звёзды терялись)
      r.stars ??= {}; r.stars[b] = Math.max(r.stars[b] ?? 0, stars);
      if (b === 'new' && skills[0]) { game.save.levelStars ??= {}; game.save.levelStars[skills[0]] = Math.max(game.save.levelStars[skills[0]] ?? 0, stars); }
      persist();
    }
    result = { stars, right: firstRight, of: firstTries, xp: game.save.xp - xpStart, minutes: Math.max(0, got), coins: sessCoins, counted, note, sure: sureN, sureRight, all0, all1: totalStars(), caught: caughtN };
    audio.play(counted ? 'energy' : 'hint');
  }

  const letters = 'ABCDE';
  // колонок в сетке вариантов (для места блока уверенности: он встаёт сразу под строкой с выбранным): одна, если варианты длинные или экран узкий
  let qaW = $state(375);
  const colsOf = (xlong: boolean, wide: boolean) => (xlong || (wide && qaW < 300) ? 1 : 2);
  const confAfter = (cols: number, n: number) => (picked === null ? -1 : cols === 1 ? picked : Math.min(n - 1, picked - (picked % 2) + 1));
  // плиток в итоге (бірінші әрекеттен, [Бит қабылдады], XP, [тиын], [мин ойын]) — от числа зависит раскладка
  const tiles = $derived(result ? 2 + (paid < answered ? 1 : 0) + (result.coins ? 1 : 0) + (result.minutes ? 1 : 0) : 4);
  const calib = $derived(result ? calibOf({ sure: result.sure, sureRight: result.sureRight }) : null);
</script>

<!-- кнопок внизу экрана задачи нет: они остаются только на итоге боя -->
{#snippet resultFoot()}
  <button class="btn primary big grow" onclick={() => go({ name: block === 'boss' ? 'map' : 'hub' })}>{block === 'boss' ? 'Картаға' : 'Кемеге'}<Icon name="chevron" fill="var(--outline)" size={20} /></button>
{/snippet}

<Screen scene="strip" cinema={cine} event={stage === 'event' && !result} thin={stage === 'review' && !result} footer={result ? resultFoot : undefined} back={result ? undefined : () => { trackExit('session'); go({ name: 'hub' }); }}>
  {#snippet head()}
    <div class="hd">
      <div class="t1"><b>{TITLE[block]}</b>{#if combo >= 2 && !result}<span class="combo num">×{combo}</span>{/if}<CoinChip value={shownCoins} compact />
        {#if item && !result && !glitch && (stage === 'ask' || stage === 'self' || stage === 'conf')}
          <button class="ibtn lamp" onclick={hint} disabled={hintLevel >= 4 || locked || stage !== 'ask'} aria-label="Бит сканері — кеңес {hintLevel}/4">
            <Icon name="bulb" fill="var(--gold)" size={22} /><b class="hl num">{hintLevel}/4</b>
          </button>
        {/if}
      </div>
      {#if !result}
        <div class="t2">
          <span class="wv">{#each waves as _, k}<i class:done={k < wave} class:on={k === wave}></i>{/each}</span>
          <span class="bar glitch hp" aria-label="Жау күші"><i style="width:{Math.max(0, mobHp / hpMax) * 100}%"></i></span>
          {#if strict}
            <span class="cnt num" aria-label="Дұрыс жауап: {total} ішінен {rightN}">{rightOfLine(rightN, total)}{#if addedN}<i class="plus" title="Қатесі үшін егіз есеп қосылды">+{addedN}</i>{/if}</span>
          {:else}
            <span class="cnt num">{Math.min(idx + 1, total)}/{total}</span>
          {/if}
        </div>
      {/if}
    </div>
  {/snippet}

  {#snippet overlay()}
    <div class="bn" style:visibility={stage === 'event' ? 'hidden' : 'visible'}>{#key bannerId}{#if banner}<span class="banner">{banner}</span>{/if}{/key}</div>
    {#if stage === 'event' && !cine}<BattleEvent kind={evKind} ms={evMs} show={evShow} small={evSmall} />{/if}
    {#if bitText && !result && !busy && (stage === 'ask' || stage === 'self' || stage === 'conf')}<div class="say" aria-live="polite"><Bit text={bitText} mood={bitMood} compact /></div>{/if}
  {/snippet}

  {#if result}
    <div class="win" class:lost={!result.counted}>
      <h2>{result.counted ? (block === 'boss' ? 'Бас жау жеңілді!' : 'Жеңіс!') : 'Бұл жолы есептелмеді'}</h2>
      {#if result.counted}
        <div class="stars" aria-label="{result.stars} жұлдыз">{#each [1, 2, 3] as k}<span class:on={result.stars >= k} style="animation-delay:{k * 180}ms"><Icon name="star" fill={result.stars >= k ? 'var(--gold)' : '#2b3a8f'} size={54} /></span>{/each}</div>
      {/if}
      <div class="loot" class:n5={tiles === 5} style="--n:{tiles}">
        <div><b class="num">{result.right}/{result.of}</b><small>бірінші әрекеттен</small></div>
        <!-- «Бит қабылдады» — только когда были ответы наспех: при честной игре плитка повторяет первую и не влезает на телефоне -->
        {#if paid < answered}<div class="warn"><b class="num">{paid}/{answered}</b><small>минутқа есептелді</small></div>{/if}
        <div><b class="num">+{result.xp}</b><small>XP</small></div>
        {#if result.coins}<div class="gold"><b class="num">+{result.coins}</b><small>тиын</small></div>{/if}
        {#if result.minutes}<div class="gold"><b class="num">+{result.minutes}</b><small>мин ойын</small></div>{/if}
      </div>
      {#if result.of > 0}
        {@const bilR = result.right + result.caught}
        <div class="paper bil">
          <b class="num">{bilLine(bilR, Math.max(0, result.of - bilR))}</b>
          <p>{BIL_NOTE}</p>
        </div>
      {/if}
      {#if calib}
        <div class="paper calib">
          <small>Сенімді болғанда</small>
          <div class="meter" aria-hidden="true"><i style="width:{calib.ratio * 100}%"></i></div>
          <b class="num">{calibLine({ sure: result.sure, sureRight: result.sureRight })}</b>
          <p>«Сенімдімін» — тексеріп болғанда ғана. Күмәнің болса, «Шамамен» де: қалқан сақтайды.</p>
        </div>
      {/if}
      <!-- звёзды бас жауы в общий счёт (награды за ★) не входят, поэтому для него строки нет -->
      {#if result.counted && result.stars && block !== 'boss'}
        {@const all = result.all1}
        {@const all0 = result.all0}
        {@const nx = STAR_REWARDS.find(r => r.need > all)}
        {@const got = STAR_REWARDS.filter(r => r.need > all0 && r.need <= all)}
        {#if got.length}<p class="unlock">Жаңа сыйлық ашылды: <b>{got.map(r => r.kz).join(', ')}</b> · Кейіпкер бетінде ки!</p>
        {:else if nx}<p class="next">★ {all} · келесі сыйлық «{nx.kz}» — тағы {nx.need - all} ★</p>{/if}
      {/if}
      {#if result.note}<p class="paper note">{result.note}</p>{/if}
    </div>
  {:else if stage === 'review' && review && item}
    {#key rvKey}
      <ReviewPanel {review} skill={item.skill} mode={rvMode} sure={rvSure} fastMs={rvFast} easy={qEasy} onnext={leaveReview}>
        <div class="ai">
          {#each aiTurns as t}
            {#if t.role === 'bit'}<Bit text={t.text} mood="think" compact />{:else}<p class="kidq">— {t.text}</p>{/if}
          {/each}
          {#if aiErr}<p class="aierr">{aiErr}</p>{/if}
          {#if !aiTurns.length}
            <button class="askbtn" onclick={() => helpMe()} disabled={aiBusy}><Icon name="bulb" fill="var(--gold)" size={18} />{aiBusy ? 'Бит ойланып жатыр…' : 'Түсінбедім — Биттен сұра'}</button>
          {:else if aiAsked < MAX_QUESTIONS}
            <form class="askrow" onsubmit={(e) => { e.preventDefault(); if (aiQ.trim() && !aiTalking) helpMe(aiQ); }}>
              <input bind:value={aiQ} maxlength="200" placeholder="Тағы сұрағың бар ма? Жаз не айт…" disabled={aiBusy || aiTalking} onkeydown={(e) => e.stopPropagation()} />
              <MicButton bind:value={aiQ} bind:active={aiTalking} max={200} hint={skillDefs.find(d => d.id === item?.skill)?.title.kz} disabled={aiBusy} maxSec={25} compact label="Сұрағыңды айт" />
              <button class="btn" disabled={aiBusy || aiTalking || !aiQ.trim()}>{aiBusy ? '…' : 'Сұрау'}</button>
            </form>
          {/if}
        </div>
      </ReviewPanel>
    {/key}
  {:else if item}
    {@const maxLen = Math.max(...item.choices.map(c => c.text.length))}
    {@const chunk = Math.max(...item.choices.map(c => longestChunk(c.text)))}
    {@const xlong = maxLen > 24 || chunk > 11}
    {@const cols = colsOf(xlong, chunk >= 10)}
    {@const after = confAfter(cols, item.choices.length)}
    <div class="qa" class:fit={!glitch} class:gl={!!glitch} bind:clientWidth={qaW}>
    <div class="q-sticky">
      {#key qKey}
        <div class="paper q" class:locked>
          {#if twin}<span class="tag twin">{TWIN_TAG}</span>{/if}
          {#if item.real}<span class="real">★ Нағыз емтихан есебі · {item.source.startsWith('daryn') ? `«Дарын» ${item.source.slice(5, 9)}` : 'Bolashak'}</span>{/if}
          <p>{#each hlLines as segs, i}{#if i}<br />{/if}<span class:formula={i > 0}>{#each segs as sg}{#if sg.hl}<mark class="chg">{sg.t}</mark>{:else}{sg.t}{/if}{/each}</span>{/each}</p>
          {#if item.figure?.svg}<div class="fig">{@html item.figure.svg}</div>
          {:else if item.figure?.src}<div class="fig"><img src={import.meta.env.BASE_URL + item.figure.src} alt="Есептің суреті" /></div>{/if}
        </div>
      {/key}
    </div>

    {#if glitch}
      <GlitchTurn turn={glitch} {locked} picked={glPick} soft={glSoft} onpick={(k) => glitchTap(k)} />
    {:else}
    <div class="choices" class:long={maxLen > 5} class:xlong={xlong} class:wide={chunk >= 10} class:xxlong={maxLen > 60} class:locked>
      {#each item.choices as c, i}
        <button class="ans" style="animation-delay:{locked ? i * 70 : 0}ms"
          class:sel={picked === i} class:dim={picked !== null && picked !== i} class:span={item.choices.length % 2 === 1 && i === item.choices.length - 1 && cols === 2}
          disabled={locked || stage === 'event'} onclick={() => pick(i)}
          aria-label="{letters[i]}: {c.text}">
          <span class="l">{letters[i]}</span>
          <span class="ct">{nb(c.text)}</span>
        </button>
        {#if stage === 'conf' && i === after}
          <div class="confslot"><ConfidencePick {sureFirst} onpick={confirm} /></div>
        {:else if stage === 'self' && scCheck && i === after}
          <div class="confslot"><SelfCheckPanel check={scCheck} onok={selfOk} onchange={selfChange} /></div>
        {/if}
      {/each}
    </div>
    {#if showSol}
      <details class="paper sol" open>
        <summary>Шешуі</summary>
        <p>{item.sol.kz}</p>
      </details>
    {/if}
    {/if}
      {#if bitText && (stage === 'ask' || stage === 'self' || stage === 'conf')}<div class="say-in" bind:this={bitEl}><Bit text={bitText} mood={bitMood} compact /></div>{/if}
    </div>
  {/if}

</Screen>

<style>
  /* D3: то, что изменилось в новом вопросе: жёлтая вспышка 0,8 с, потом остаётся мягкое подчёркивание */
  .chg { background: transparent; color: inherit; border-radius: 6px; padding: 0 2px; margin: 0 -2px; text-decoration: underline; text-decoration-color: rgba(214, 150, 0, .7);
    text-decoration-thickness: 3px; text-underline-offset: 4px; animation: chgPulse .8s ease-out 1 both; animation-delay: .35s; }
  @keyframes chgPulse { 0% { background: #ffe066; box-shadow: 0 0 0 0 rgba(255, 214, 64, .9); } 35% { background: #ffdb3a; box-shadow: 0 0 16px 8px rgba(255, 210, 40, .85); } 100% { background: transparent; box-shadow: 0 0 0 0 rgba(255, 214, 64, 0); } }
  .unlock { margin: 0; padding: 10px 12px; border-radius: 14px; background: linear-gradient(180deg, #ffe07a, #f2b632); color: #3a2400; border: 3px solid var(--outline); font-weight: 800; text-align: center; animation: flipIn .5s; }
  .next { margin: 0; color: var(--gold); font: 800 15px var(--disp); text-align: center; }
  .wv { display: flex; gap: 3px; }
  .wv i { width: 10px; height: 10px; border-radius: 3px; background: #0b1030; border: 2px solid var(--outline); }
  .wv i.done { background: var(--ok); } .wv i.on { background: var(--glitch); }
  .bn { display: flex; justify-content: center; padding-top: 6px; min-height: 40px; }
  .banner { font: 900 24px var(--disp); color: var(--gold); -webkit-text-stroke: 2px var(--outline); paint-order: stroke fill; text-shadow: 0 3px 0 var(--outline);
    animation: bannerIn 1.2s var(--ease-out) both; }
  @keyframes bannerIn { 0% { opacity: 0; transform: scale(.4) translateY(10px); } 18% { opacity: 1; transform: scale(1.15); } 30% { transform: scale(1); } 80% { opacity: 1; } 100% { opacity: 0; transform: translateY(-8px); } }
  /* реплика Бита: в стопке (телефон вертикально) — в панели под вариантами, полностью и без обрезки, сцену не закрывает;
     сбоку от сцены (горизонталь, широкий экран) — поверх окна сцены, где для неё есть место */
  .say { display: none; padding: 0 4px 4px; width: min(480px, 100%); animation: pop-in .25s var(--ease-out) both; }
  .say :global(.bubble) { font-size: 14px !important; line-height: 1.35; padding: 7px 10px !important; }
  .say-in { flex: none; margin-top: 12px; animation: pop-in .25s var(--ease-out) both; }
  .say-in :global(.bubble) { font-size: 14px !important; line-height: 1.35; padding: 8px 12px !important; }
  @media (min-width: 1000px) and (min-aspect-ratio: 23/20), (max-width: 999.98px) and (max-height: 560px) and (min-aspect-ratio: 23/20) {
    .say { display: block; }
    .say-in { display: none; }
  }
  /* вопрос и ВСЕ варианты видны вместе: вопрос прокручивается внутри своей рамки, варианты закреплены внизу панели */
  .qa { display: flex; flex-direction: column; gap: 10px; container-type: inline-size; }
  .qa.fit { flex: 1 1 auto; min-height: 0; }
  .qa.fit .q-sticky { flex: 0 1 auto; min-height: min(96px, 34%); overflow-y: auto; overflow-x: hidden; overscroll-behavior: contain; }
  .qa .choices { flex: none; }
  .q-sticky { min-width: 0; }
  /* ход «Глитчтің қатесі»: условие читается целиком (без своей прокрутки), строки Глитча идут ниже; не влезло — прокручивается вся панель, подсказка-стрелка та же */
  .qa.gl { gap: 6px; }
  .qa.gl .q { font-size: 15px; padding: 8px 12px; gap: 4px; } .qa.gl .q p { line-height: 1.32; } .qa.gl .formula { font-size: 17px; margin-top: 2px; }
  .q { animation: flipIn .45s var(--ease-out) both; }
  @keyframes flipIn { from { transform: perspective(700px) rotateX(-70deg) translateY(-10px); opacity: 0; } to { transform: none; opacity: 1; } }
  .choices.locked .ans { animation: pop-in .3s var(--ease-out) both; }
  .win { display: grid; gap: 14px; justify-items: center; text-align: center; padding: 6px 0; }
  .win h2 { font-size: 28px; color: var(--gold); -webkit-text-stroke: 2px var(--outline); paint-order: stroke fill; text-shadow: 0 4px 0 var(--outline); animation: pop-in .4s var(--ease-out) both; }
  .win.lost h2 { color: var(--ink); font-size: 22px; }
  .stars { display: flex; gap: 6px; }
  .stars span { animation: starIn .5s var(--ease-out) both; }
  .stars span:nth-child(2) { transform: translateY(-10px); }
  @keyframes starIn { from { transform: scale(0) rotate(-90deg); opacity: 0; } }
  /* плиток 2-5 (--n): до четырёх в одну строку; пять на телефоне стоя — 3 + 2 (в строку подписи «бірінші әрекеттен» не влезают), лёжа — в одну строку */
  .loot { display: grid; grid-template-columns: repeat(var(--n, 4), minmax(0, 1fr)); gap: 6px; width: 100%; }
  .loot.n5 { grid-template-columns: repeat(6, minmax(0, 1fr)); }
  .loot.n5 > div { grid-column: span 2; } .loot.n5 > div:nth-child(n+4) { grid-column: span 3; }
  .loot > div { min-width: 0; display: grid; gap: 2px; padding: 10px 4px; border-radius: 14px; background: var(--deep); border: 3px solid var(--outline); animation: pop-in .4s .5s var(--ease-out) both; }
  .loot b { font-size: clamp(16px, 5.3vw, 26px); text-shadow: 0 2px 0 var(--outline); }
  .loot > div.warn b { color: var(--gold); }
  .loot .gold b { color: var(--gold); }
  .loot small { color: var(--dim); font-size: clamp(10.5px, 3vw, 12px); line-height: 1.15; overflow-wrap: anywhere; }

  .hd { flex: 1; min-width: 0; display: grid; grid-template-columns: minmax(0, 1fr); gap: 6px; }
  .t1 { display: flex; align-items: center; gap: 8px; }
  .t1 b { flex: 1; min-width: 0; font: 900 18px var(--disp); text-shadow: 0 2px 0 var(--outline); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .t2 { display: flex; align-items: center; gap: 8px; }
  .hp { flex: 1; height: 14px; }
  .cnt { font-size: 14px; color: var(--dim); }
  .combo { font: 900 18px var(--disp); color: var(--gold); text-shadow: 0 2px 0 var(--outline); }

  .q { display: grid; gap: 10px; font-size: var(--fs-l); }
  .q p { line-height: 1.45; }
  .formula { display: inline-block; margin-top: 6px; font: 800 22px var(--disp); letter-spacing: .01em; }
  .skill { font-size: 12px; }
  .real { justify-self: start; font: 900 11px var(--disp); letter-spacing: .06em; text-transform: uppercase; color: var(--outline); background: var(--gold); padding: 4px 10px; border-radius: 999px; border: 2px solid var(--outline); }
  .fig { display: grid; place-items: center; }
  .fig :global(svg) { width: min(100%, 420px); height: auto; max-height: 260px; }
  .fig img { max-width: 100%; max-height: 260px; display: block; }

  .choices { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
  /* числа из 10-11 знаков («470 000 850») в две колонки помещаются только с чуть меньшим шрифтом и тесной плиткой; совсем узкий экран (320) — по одной */
  .choices.wide:not(.xlong) .ans { font-size: 14px; padding: 4px 8px; gap: 6px; }
  .choices.wide:not(.xlong) .ans .l { width: 22px; height: 22px; font-size: 12px; }
  @container (max-width: 300px) { .choices.wide { grid-template-columns: minmax(0, 1fr); } }
  .choices .ans { min-width: 0; min-height: 48px; padding: 6px 10px; gap: 8px; font-size: clamp(15px, 4.4vw, 19px); }
  .choices .ans .l { width: 26px; height: 26px; font-size: 14px; }
  .choices .ans.span, .confslot { grid-column: 1 / -1; }
  .ans.dim { opacity: .4; }
  .ans.dim:active { opacity: .7; }
  .confslot { padding: 2px 0 4px; }
  @media (max-height: 720px) { .choices .ans { min-height: 42px; padding: 4px 8px; } .choices .ans .l { width: 24px; height: 24px; } .choices { gap: 6px; } .qa { gap: 8px; } }
  .choices.long .ans { font-size: clamp(14px, 4vw, 17px); }
  .choices.xlong { grid-template-columns: minmax(0, 1fr); }
  .choices.xlong .ans { font-size: clamp(14px, 3.9vw, 16px); }
  .choices.xxlong .ans { font-size: clamp(13px, 3.6vw, 15px); }
  .ct { min-width: 0; overflow-wrap: break-word; line-height: 1.2; }   /* числа склеены неразрывными пробелами (nb), рвём только слишком длинное слово */
  /* планшет: экран большой, значит и текст с вариантами крупнее (портрет 820×1180, ландшафт 1180×820) */
  @media (min-width: 700px) and (min-height: 760px) {
    .q { font-size: 24px; } .q p { line-height: 1.4; } .formula { font-size: 30px; }
    .choices { gap: 12px; }
    .choices .ans { min-height: 68px; padding: 10px 16px; gap: 12px; font-size: 24px; }
    .choices .ans .l { width: 36px; height: 36px; font-size: 18px; }
    .choices.long .ans, .choices.xlong .ans { font-size: 21px; }
  }
  /* телефон в горизонтали: колонка справа низкая (≈ 240 px под задачу) — всё чуть компактнее */
  @media (max-width: 999.98px) and (max-height: 560px) and (min-aspect-ratio: 23/20) {
    .q { font-size: 16px; padding: 8px 12px; gap: 6px; } .formula { font-size: 18px; margin-top: 2px; }
    .qa.gl .q { font-size: 14px; padding: 6px 10px; } .qa.gl .formula { font-size: 16px; }
    .qa { gap: 6px; } .choices { gap: 5px; }
    .choices .ans { min-height: 38px; padding: 3px 8px; font-size: clamp(14px, 2.2vw, 16px); }
    .choices .ans .l { width: 22px; height: 22px; font-size: 12px; }
    .say-in { display: none; }
    .t1 b { font-size: 16px; }
    .win { gap: 8px; } .win h2 { font-size: 22px; } .stars :global(svg) { width: 36px; height: 36px; } .loot b { font-size: 20px; }
    .loot { gap: 4px; } .loot > div { padding: 6px 2px; } .loot small { font-size: 10px; }
    .bil { gap: 2px; padding: 8px 10px; } .bil b { font-size: 14px; } .bil p { font-size: 12px; }

  }
  /* пять плиток в одну строку — только когда колонка справа достаточно широкая (≥ 760 px экрана); на узком телефоне лёжа остаётся 3 + 2 */
  @media (min-width: 760px) and (max-width: 999.98px) and (max-height: 560px) and (min-aspect-ratio: 23/20) {
    .loot.n5 { grid-template-columns: repeat(5, minmax(0, 1fr)); } .loot.n5 > div, .loot.n5 > div:nth-child(n+4) { grid-column: auto; }
  }
  .sol summary { cursor: pointer; font: 900 15px var(--disp); color: var(--code-deep); }
  .sol p { margin-top: 8px; }

  .ai { display: grid; gap: 8px; }
  .askbtn { display: flex; gap: 6px; align-items: center; justify-content: center; background: none; border: 0; color: var(--dim); font: 800 14px var(--txt); text-decoration: underline; text-underline-offset: 4px; cursor: pointer; padding: 4px; }
  .kidq { color: var(--dim); font-style: italic; }
  .aierr { color: var(--gold); }
  .askrow { display: flex; flex-wrap: wrap; gap: 8px; }
  .askrow input { flex: 1; min-width: 0; font: 700 16px var(--txt); color: var(--paper-ink); background: var(--paper); border: 3px solid var(--outline); border-radius: 12px; padding: 8px 10px; }

  .grow { flex: 1; min-width: 0; }
  /* лампа-подсказка: в шапке справа, подальше от ответов */
  .lamp { width: 44px; height: 44px; position: relative; --c: #243a9e; --e: #152678; padding-bottom: 7px; }
  .lamp:disabled { opacity: .5; }
  .hl { position: absolute; bottom: -9px; left: 50%; transform: translateX(-50%); font-size: 10px; line-height: 14px; padding: 0 5px; white-space: nowrap; border-radius: 999px; background: var(--outline); color: var(--gold); }
  .tag.twin { justify-self: start; background: var(--code); color: #06222b; }
  /* итог боя: калибровка уверенности */
  .calib { width: 100%; display: grid; gap: 6px; text-align: center; }
  .calib small { font-weight: 800; }
  .calib b { font: 900 20px var(--disp); }
  .calib p { font: 700 13px/1.35 var(--txt); color: var(--paper-dim); }
  .bil { width: 100%; display: grid; gap: 4px; text-align: center; }
  .bil b { font: 900 clamp(15px, 4.4vw, 19px)/1.25 var(--disp); }
  .bil p { margin: 0; font: 800 14px/1.3 var(--txt); color: var(--paper-dim); }
  .plus { margin-left: 6px; padding: 0 6px; border-radius: 999px; background: var(--gold); color: var(--outline); font: 900 12px var(--disp); font-style: normal; }
  .meter { height: 16px; border-radius: 99px; background: #0b1030; border: 3px solid var(--outline); overflow: hidden; }
  .meter i { display: block; height: 100%; background: linear-gradient(90deg, var(--ok), var(--gold)); }
</style>
