<script lang="ts">
  import { onMount, tick } from 'svelte';
  import Bit from '../ui/Bit.svelte';
  import Screen from '../ui/Screen.svelte';
  import Icon from '../ui/Icon.svelte';
  import { toast } from '../ui/notify.svelte';
  import { ReadGate, readMs } from '../lib/readgate.svelte';
  import { solGap, type SolGap } from '../engine/solgap';
  import { SPOT_KZ } from '../three/spots';
  import { game, go, persist, skillDefs } from '../lib/store.svelte';
  import { W } from '../lib/world.svelte';
  import { ensurePlan, completeBlock, dayRec } from '../lib/session.svelte';
  import { makeItem, mistakeText, skillTitle, type Item } from '../engine/items';
  import { bankFor, bankToItem } from '../engine/bank';
  import { recordAttempt, isDone } from '../engine/progress';
  import { isHonest, addMasteryBonus, settleDay, taught } from '../engine/planner';
  import { showReward } from '../lib/reward.svelte';
  import { audio } from '../lib/audio';
  import { currentWorld, totalStars, STAR_REWARDS } from '../lib/look';
  import { react } from '../lib/voice';
  import { askBit, HELPER_ERR, MAX_QUESTIONS, type Turn, type HelperError } from '../lib/helper';
  // @ts-ignore
  import { LESSONS } from '../../content/lessons.mjs';
  // шпаргалка «Есте сақта» из урока темы — вернуться к правилу после ошибки
  const ruleOf = (id: string) => ((LESSONS as Record<string, any[]>)[id] ?? []).find(s => s.type === 'rule') as { lines: string[] } | undefined;
  import { sparksAt, floatText, centerOf, flash, sceneCenter } from '../ui/fx.svelte';

  type Block = 'warmup' | 'new' | 'mixed' | 'extra' | 'boss' | 'repair';
  let { block }: { block: Block } = $props();

  const plan = ensurePlan();
  const pb = plan.blocks.find(b => b.id === block);
  const battle = true; // каждая практика — бой; у новой темы музыка «фокус»

  function extraSkills(): string[] {
    const st = game.save.skills;
    const learning = skillDefs.filter(d => st[d.id]?.status === 'learning' && d.templates.length).map(d => d.id);
    const weak = skillDefs.filter(d => isDone(st[d.id]) && d.templates.length && taught(game.save, skillDefs, d.id))
      .sort((a, b) => Object.values(st[b.id].misconceptions).reduce((s, n) => s + n, 0) - Object.values(st[a.id].misconceptions).reduce((s, n) => s + n, 0))
      .map(d => d.id);
    return [...new Set([...learning, ...weak])].slice(0, 5);
  }
  const broken = game.save.repairShop.filter(r => !r.fixed);
  // Босс мира: вперемешку по всему пройденному (чередование), нужно 7 верных из 10
  const bossSkills = () => [...skillDefs.filter(d => isDone(game.save.skills[d.id]) && d.templates.length && taught(game.save, skillDefs, d.id)).map(d => d.id)].sort(() => Math.random() - 0.5).slice(0, 8);
  const BOSS_HP = 7;
  const skills = block === 'boss' ? bossSkills() : block === 'extra' ? extraSkills() : block === 'repair' ? [...new Set(broken.map(r => r.skill))].slice(0, 5) : pb?.skills ?? [];
  const total = block === 'boss' ? 10 : block === 'extra' ? 10 : block === 'repair' ? Math.min(8, broken.length + 1) : pb?.items ?? 8;
  const TITLE: Record<Block, string> = { warmup: 'Жылыну', new: 'Жаңа миссия · жаттығу', mixed: 'Аралас шайқас', extra: 'Қосымша тапсырма', boss: `Босс: ${currentWorld().kz}`, repair: 'Шеберхана: жөндеу' };

  let idx = $state(0);
  let item = $state<Item | null>(null);
  let picked = $state<number | null>(null);
  // answer — выбор; retry — первая ошибка, можно ещё раз; feedback — итог задачи
  let phase = $state<'answer' | 'retry' | 'feedback'>('answer');
  let tries = $state(0);
  let struck = $state<number[]>([]);
  let hintLevel = $state(0);
  let lastCorrect = $state(false);
  let combo = $state(0);
  let honestAll = $state(true);
  let answered = 0, guessed = 0; // ответы быстрее 5 с без подсказок = угадывание
  let twin = $state(false);
  let showSol = $state(false);
  let bitText = $state('');
  let bitMood = $state<'idle' | 'happy' | 'wow' | 'think' | 'sad'>('idle');
  // ИИ-помощник «Түсінбедім»: только после ответа (правильный ответ уже показан)
  let aiTurns = $state<Turn[]>([]);
  let aiBusy = $state(false);
  let aiErr = $state('');
  let aiQ = $state('');
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
  let busy = $state(false);      // идёт анимация боя — кнопки ждут
  let locked = $state(false);    // новый вопрос только появился — ввод закрыт 0.7 с
  let banner = $state(''), bannerId = $state(0);
  let firstTries = 0, firstRight = 0;
  // после ошибки «дальше» открывается через время чтения разбора (GAME_LOOP.md 10)
  const gate = new ReadGate();
  function nudge() {
    gate.nope(); audio.play('click'); toast('Алдымен түсіндірмені оқы — батырма зарядталып жатыр');
    document.querySelector('.sol')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  const showSolution = () => tick().then(() => document.querySelector('.sol')?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
  // пропуск в решении: реванш открывается, когда ребёнок вписал закрытое число (читал решение). Нет чисел — зарядка кнопки
  let gap = $state<SolGap | null>(null), gapDone = $state(false), gapWrong = $state<string[]>([]);
  function explain() {
    gap = item ? solGap(item.sol.kz, item.choices[item.answer].text) : null; gapDone = false; gapWrong = [];
    if (!gap) gate.start(readMs(bitText, item?.sol.kz));
    showSolution();
  }
  function fillGap(o: string, ev: MouseEvent) {
    if (!gap || gapDone || gapWrong.includes(o)) return;
    const at = centerOf(ev.currentTarget as HTMLElement);
    if (o === gap.answer) {
      gapDone = true; audio.play('correct'); sparksAt(at.x, at.y, ['#5ce39c', '#3ff0ff', '#ffc94a'], 30);
      game.save.xp += 2; floatText('+2 XP', at.x, at.y - 20, '#ffc94a'); persist();
      bitText = 'Дұрыс! Шешуді түсіндің. Енді реванш — дәл осындай есеп.'; bitMood = 'happy';
    } else {
      gapWrong = [...gapWrong, o]; audio.play('wrong');
      bitText = 'Жоқ. Шешуді басынан оқы да, осы қадамды өзің есептеп көр.'; bitMood = 'think';
    }
    showBit();
  }
  const gapOpen = $derived(!!gap && !gapDone);
  let result = $state<{ stars: number; right: number; of: number; xp: number; minutes: number; counted: boolean; note: string } | null>(null);
  const xpStart = game.save.xp;
  function say(text: string) { banner = text; bannerId++; }
  let cine = $state(true);   // катсцена: вход в локацию, мини-босс, победа — панель задачи скрыта
  const isLastWave = () => wave >= waves.length - 1;
  async function hit(sup: boolean) {
    busy = true;
    const killed = await W.world?.heroAttack(combo >= 2, sup);
    if (killed && !isLastWave()) {
      await W.world?.killMob(); audio.play('chest');
      wave++; mobHp = waves[wave];
      const boss = isLastWave(); if (boss) cine = true;
      say(boss ? (block === 'boss' ? 'Босс!' : 'Мини-босс!') : `${wave + 1}-толқын`);
      await W.world?.spawnMob(mobHp, currentWorld().mob, boss, block === 'boss' && boss);
      cine = false;
    }
    busy = false;
  }
  async function enemyTurn() { busy = true; await W.world?.enemyAttack(); busy = false; }
  let startAt = 0;
  let cardEl: HTMLElement;
  let bitEl = $state<HTMLElement>();
  // после ответа — показать реплику Бита (она ниже вариантов)
  const showBit = () => setTimeout(() => bitEl?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 60);
  let choiceEls: HTMLElement[] = $state([]);

  // Настоящие задачи экзамена (банк «Дарын»): только по пройденным темам, сначала невиданные.
  // Босс — 3 из 10, смешанный бой и доп. миссия — 2; урок новой темы и разминка — только генераторы.
  const BANK_SLOTS: Partial<Record<Block, number[]>> = { boss: [2, 5, 8], mixed: [2, 5], extra: [3, 6] };
  const seen = new Set(game.save.attempts.map(a => a.source));
  const bankQueue = BANK_SLOTS[block] ? bankFor(id => isDone(game.save.skills[id]) && taught(game.save, skillDefs, id), seen) : [];
  function nextItem() {
    const sk = block === 'new' ? skills[0] : skills[idx % Math.max(1, skills.length)];
    const fromBank = !twin && BANK_SLOTS[block]?.includes(idx) && bankQueue.length ? bankQueue.shift() : null;
    item = fromBank ? bankToItem(fromBank) : makeItem(sk);
    picked = null; phase = 'answer'; hintLevel = 0; showSol = false; tries = 0; struck = []; gate.stop(); gap = null; gapDone = false;
    aiTurns = []; aiErr = ''; aiQ = ''; aiBusy = false;
    bitText = twin ? 'Реванш! Дәл осындай есеп — енді өзің шығарып көр.' : ''; bitMood = twin ? 'think' : 'idle';
    startAt = performance.now();
  }

  onMount(() => {
    if (!skills.length) { go({ name: 'hub' }); return; }
    W.dim = false;
    W.world?.setMode('battle');
    busy = true;
    // тема = свой уголок мира; разминка и смешанный бой — уголок дня
    const v = W.world?.setSpot(block === 'new' || block === 'repair' ? skills[0] : `${block}:${game.day}`);
    if (v !== undefined) say(`${currentWorld().kz} · ${SPOT_KZ[v]}`);
    (W.world?.arrive() ?? Promise.resolve())
      .then(() => W.world?.spawnMob(mobHp, currentWorld().mob, waves.length === 1))
      .then(() => { cine = false; say(waves.length > 1 ? '1-толқын' : 'Шайқас!'); busy = false; });
    if (block === 'boss') setTimeout(() => react('boss'), 600);
    audio.setMood(block === 'new' ? 'focus' : 'battle');
    nextItem();
    const onKey = (e: KeyboardEvent) => {
      if (phase === 'answer' && /^[1-5]$/.test(e.key)) pick(+e.key - 1);
      else if (phase === 'answer' && e.key === 'Enter' && picked !== null) confirm('sure');
      else if (phase === 'retry' && e.key === 'Enter') retry();
      else if (phase === 'feedback' && e.key === 'Enter') next();
    };
    addEventListener('keydown', onKey);
    return () => { removeEventListener('keydown', onKey); W.world?.clearMob(); };
  });

  function pick(i: number) { if (phase !== 'answer' || locked || busy || struck.includes(i)) return; picked = i; audio.play('click'); }
  function needPick() { toast('Алдымен жауапты таңда'); audio.play('click'); }
  function retry() { picked = null; phase = 'answer'; bitMood = 'think'; startAt = performance.now(); }

  function hint() {
    if (phase !== 'answer' || !item) return;
    hintLevel = Math.min(4, hintLevel + 1);
    audio.play('hint');
    if (hintLevel === 4) { showSol = true; bitText = 'Толық шешуі төменде. Бұл есеп есептелмейді — келесіде реванш аласың.'; bitMood = 'think'; }
    else { bitText = item.hints[hintLevel - 1]?.kz ?? ''; bitMood = 'think'; }
    showBit();
  }

  async function confirm(confidence: 'sure' | 'maybe' | 'unsure') {
    if (!item || picked === null) return;
    const timeMs = performance.now() - startAt;
    const correct = picked === item.answer;
    tries++;
    if (tries === 2) return secondTry(correct);
    const honest = isHonest(timeMs, hintLevel);
    answered++;
    if (!twin) { firstTries++; if (correct && hintLevel === 0) firstRight++; }   // реванш — не новый вопрос, в звёзды не идёт
    if (!honest && hintLevel < 4) { honestAll = false; guessed++; }
    const events = recordAttempt(game.save, {
      at: Date.now(), day: game.day, skill: item.skill, source: item.source, correct, confidence,
      hintLevel, honest, timeMs: Math.round(timeMs), tag: item.choices[picked].tag, mode: block === 'new' ? 'practice' : block === 'extra' ? 'extra' : block === 'boss' ? 'boss' : block === 'warmup' ? 'warmup' : block === 'repair' ? 'practice' : 'mixed',
    });
    lastCorrect = correct; phase = correct || hintLevel >= 4 ? 'feedback' : 'retry';
    if (!correct) struck = [...struck, picked];
    await tick();
    const at = centerOf(choiceEls[picked]);
    if (correct) {
      combo++;
      const xp = hintLevel >= 4 ? 0 : hintLevel > 0 ? 4 : 10 + Math.min(combo - 1, 5) * 2;
      game.save.xp += xp;
      audio.play(combo >= 3 ? 'crit' : 'correct'); if (combo > 1) audio.play('combo', { combo });
      if (combo === 3 || combo === 6) react('combo'); else react('correct', 0.4);
      sparksAt(at.x, at.y, ['#5ce39c', '#3ff0ff', '#ffc94a'], combo >= 3 ? 50 : 26);
      if (xp) floatText(`+${xp} XP`, at.x, at.y - 20, '#ffc94a', combo >= 3);
      if (combo >= 3) floatText(`КОМБО ×${combo}`, sceneCenter(0.25).x, sceneCenter(0.25).y, '#3ff0ff', true);
      bitText = hintLevel ? 'Дұрыс! Кеңеспен болса да — жақсы.' : combo >= 3 ? 'Керемет серия!' : 'Дұрыс!';
      if (!honest && hintLevel < 4) bitText = 'Дұрыс, бірақ тым жылдам! Асықпа — алдымен оқы.';
      bitMood = combo >= 3 ? 'wow' : 'happy';
      if (battle) { mobHp--; hit(combo > 0 && combo % 3 === 0); if (combo % 3 === 0) say('СУПЕР СОҚҚЫ!'); }
      if (block === 'repair' && hintLevel === 0) { const r = game.save.repairShop.find(x => !x.fixed && x.skill === item!.skill); if (r) { r.fixed = true; floatText('ЖӨНДЕЛДІ', at.x, at.y - 50, '#5ce39c'); } }
      if (confidence === 'unsure') bitText += ' Білмеймін дедің, бірақ таптың — демек, түсінік бар.';
    } else {
      combo = 0;
      game.save.xp += 2;
      audio.play('wrong'); flash('#ff9a6b'); react('wrong', 0.6);
      cardEl?.classList.remove('shake'); void cardEl?.offsetWidth; cardEl?.classList.add('shake');
      const m = mistakeText(item.choices[picked].tag);
      bitText = (confidence === 'sure' ? 'Сенімді едің, бірақ қателік бар. ' : 'Әзірге қате. ') + m.kz + (phase === 'retry' ? ' Тағы бір рет көр!' : '');
      if (!honest && hintLevel < 4) bitText = 'Тым жылдам! Асықпа — алдымен шартты оқы. ' + bitText;
      bitMood = 'think';
      if (phase === 'feedback') explain(); else gate.start(readMs(bitText));
      if (battle) enemyTurn();
      if (block !== 'repair') game.save.repairShop.push({ source: item.source, skill: item.skill, tag: item.choices[picked].tag, addedDay: game.day });
    }
    for (const ev of events) {
      if (ev === 'learned') { react('learned'); audio.play('levelup'); floatText('ҮЙРЕНДІ!', sceneCenter(0.3).x, sceneCenter(0.3).y, '#3ff0ff', true); sparksAt(sceneCenter(0.3).x, sceneCenter(0.3).y, ['#3ff0ff', '#b58cff'], 70, 10); W.world?.celebrate(); bitText = `«${skillTitle(item.skill).kz}» — үйрендің! Ертең тексереміз: өтсең, кристалға айналады.`; bitMood = 'wow'; }
      if (ev === 'crystal') { react('crystal'); audio.play('crystal'); floatText('КРИСТАЛЛ!', sceneCenter(0.3).x, sceneCenter(0.3).y, '#b58cff', true); sparksAt(sceneCenter(0.3).x, sceneCenter(0.3).y, ['#b58cff', '#ffffff', '#3ff0ff'], 90, 11); bitText = `«${skillTitle(item.skill).kz}» кристалға айналды — енді бұл тақырып сенікі!`; bitMood = 'wow'; }
      if (ev === 'learned' || ev === 'crystal') {
        const rec = dayRec(), add = addMasteryBonus(rec, `${ev === 'crystal' ? 'Проверка через день пройдена' : 'Тема освоена'}: ${skillTitle(item.skill).ru}`);
        if (add) {
          settleDay(rec, plan, game.save.settings.extraTo);
          bitText += ` Сыйлық: +${add} минут ойын!`;
          // большая плашка «Қабылдау»: награду нельзя не заметить
          void showReward({ minutes: add, title: 'Сыйлық!', why: `${ev === 'crystal' ? 'Ертеңгі тексеру өтті' : 'Тақырып үйренілді'}: ${skillTitle(item.skill).kz}`, today: rec.minutesToday, weekend: rec.minutesWeekend });
        }
      }
      if (ev === 'review_failed') { bitText = 'Бұл тақырып сәл ұмытылған екен — қайта жаттығамыз, қорқынышты емес.'; bitMood = 'think'; }
    }
    twin = hintLevel >= 4;
    persist(); showBit();
  }

  // Вторая попытка: в модель знаний не идёт (там — первая), но ребёнок доводит задачу до конца
  async function secondTry(correct: boolean) {
    phase = 'feedback'; lastCorrect = correct;
    await tick();
    const at = centerOf(choiceEls[picked!]);
    if (correct) {
      game.save.xp += 3; audio.play('correct'); react('correct', 0.4);
      sparksAt(at.x, at.y, ['#5ce39c', '#3ff0ff'], 20); floatText('+3 XP', at.x, at.y - 20, '#ffc94a');
      bitText = 'Екінші әрекеттен дұрыс! Қатені өзің таптың — бұл нағыз оқу.'; bitMood = 'happy';
      if (battle) { mobHp--; hit(false); }
    } else {
      struck = [...struck, picked!]; audio.play('wrong'); flash('#ff9a6b'); if (battle) enemyTurn();
      bitText = 'Дұрыс жауабы жасылмен белгіленді. Шешуін оқы — сосын дәл осындай есепте реванш аласың.'; bitMood = 'think';
      twin = true; explain();
    }
    persist(); showBit();
  }

  async function next() {
    if (busy) return;
    if (gate.on) return nudge();
    if (gapOpen) { audio.play('click'); toast('Алдымен шешудегі бос орынды толтыр'); showSolution(); return; }
    if (!twin) idx++;
    const learnedNow = block === 'new' && game.save.skills[skills[0]]?.status === 'learned' && idx >= 6;
    if (idx >= total || learnedNow) return finish();
    nextItem();
    // новый вопрос виден сразу: перелистывание, номер, ввод закрыт 0.7 с
    locked = true; say(twin ? 'Реванш!' : `Сұрақ ${idx + 1}/${total}`); audio.play('click');
    cardEl?.closest('.body')?.scrollTo({ top: 0 });
    setTimeout(() => { locked = false; startAt = performance.now(); }, 700);
  }
  const starsOf = () => { const a = firstTries ? firstRight / firstTries : 0; return a >= 0.9 ? 3 : a >= 0.7 ? 2 : 1; };

  // Босс не даёт минут (они — за план), зато открывает путь в следующий мир
  async function finishBoss() {
    const won = mobHp <= 0, w = currentWorld();
    cine = true;
    if (won && W.world) {
      await W.world.killMob(); audio.play('chest'); await W.world.openChest(); W.world.celebrate(0xffc94a); audio.play('levelup');
      if (!game.save.worldsCleared?.includes(w.id)) (game.save.worldsCleared ??= []).push(w.id);
      game.save.xp += 50; persist();
      floatText('БОСС ЖЕҢІЛДІ!', sceneCenter(0.3).x, sceneCenter(0.3).y, '#ffc94a', true);
      bitText = `«${w.kz}» босы жеңілді! +50 XP. Келесі әлемге портал ашылуға дайын — картаны қара.`; bitMood = 'wow';
    } else {
      await W.world?.killMob();
      bitText = 'Босс шегінді, бірақ жеңілген жоқ. Қателерді шеберханада жөнде де, ертең қайта кел!'; bitMood = 'think';
    }
    phase = 'feedback'; item = null; persist(); cine = false;
    result = { stars: won ? starsOf() : 0, right: firstRight, of: firstTries, xp: game.save.xp - xpStart, minutes: 0, counted: won, note: bitText };
  }

  async function finish() {
    if (block === 'boss') return finishBoss();
    const b = block;
    // план дня засчитывается только за честную работу: если больше 30% ответов — наугад, блок не засчитан
    // план дня засчитывается за честную работу: больше 30% ответов наугад — блок не засчитан
    // доп. миссия (GAME_LOOP.md 8): 7 верных с первой попытки из 10; быстрые ответы миссию не обнуляют
    const before = dayRec().minutesToday;
    let counted = true, note = '';
    if (['warmup', 'new', 'mixed'].includes(block) && answered >= 3 && guessed / answered > 0.3) {
      counted = false; note = 'Көп жауап тым жылдам берілді (5 секундтан аз). Бұл қадам есептелмеді — асықпай қайта өт.';
    } else if (block === 'extra' && firstRight < 7) {
      counted = false; note = `Бірінші әрекеттен ${firstRight} дұрыс, керегі — 7. Миссия есептелмеді, тағы көр!`;
    }
    item = null; phase = 'feedback'; busy = true;
    if (counted && block !== 'repair') completeBlock(b as any); else persist();
    if (battle && W.world) {
      cine = true;
      await W.world.killMob();
      if (counted) { audio.play('chest'); await W.world.openChest(); audio.play('levelup'); }
    }
    busy = false; cine = false;
    const got = dayRec().minutesToday - before, stars = counted ? starsOf() : 0;
    if (got > 0) await showReward({ minutes: got, title: b === 'extra' ? 'Қосымша миссия!' : 'Қадам аяқталды!', why: TITLE[b], today: dayRec().minutesToday, weekend: dayRec().minutesWeekend });
    if (stars) {
      const r = dayRec(); (r.stars ??= {})[b] = Math.max(r.stars[b] ?? 0, stars);
      if (b === 'new' && skills[0]) (game.save.levelStars ??= {})[skills[0]] = Math.max(game.save.levelStars[skills[0]] ?? 0, stars);
      persist();
    }
    result = { stars, right: firstRight, of: firstTries, xp: game.save.xp - xpStart, minutes: Math.max(0, got), counted, note };
    audio.play(counted ? 'energy' : 'hint');
  }

  const letters = 'ABCDE';
</script>

<Screen scene="strip" cinema={cine} back={() => go({ name: result && block === 'boss' ? 'map' : 'hub' })}>
  {#snippet head()}
    <div class="hd">
      <div class="t1"><b>{TITLE[block]}</b>{#if combo >= 2}<span class="combo num">×{combo}</span>{/if}</div>
      <div class="t2">
        <span class="wv">{#each waves as _, k}<i class:done={k < wave} class:on={k === wave}></i>{/each}</span>
        <span class="bar glitch hp" aria-label="Жау күші"><i style="width:{Math.max(0, mobHp / hpMax) * 100}%"></i></span>
        <span class="cnt num">{Math.min(idx + 1, total)}/{total}</span>
      </div>
    </div>
  {/snippet}

  {#snippet overlay()}
    <div class="bn">{#key bannerId}{#if banner}<span class="banner">{banner}</span>{/if}{/key}</div>
    {#if bitText && !result && !busy}<div class="say" aria-live="polite"><Bit text={bitText} mood={bitMood} compact /></div>{/if}
  {/snippet}

  {#if result}
    <div class="win" class:lost={!result.counted}>
      <h2>{result.counted ? (block === 'boss' ? 'Босс жеңілді!' : 'Жеңіс!') : 'Бұл жолы есептелмеді'}</h2>
      {#if result.counted}
        <div class="stars" aria-label="{result.stars} жұлдыз">{#each [1, 2, 3] as k}<span class:on={result.stars >= k} style="animation-delay:{k * 180}ms"><Icon name="star" fill={result.stars >= k ? 'var(--gold)' : '#2b3a8f'} size={54} /></span>{/each}</div>
      {/if}
      <div class="loot">
        <div><b class="num">{result.right}/{result.of}</b><small>бірінші әрекеттен</small></div>
        <div><b class="num">+{result.xp}</b><small>XP</small></div>
        {#if result.minutes}<div class="gold"><b class="num">+{result.minutes}</b><small>мин ойын</small></div>{/if}
      </div>
      {#if result.counted && result.stars}
        {@const all = totalStars()}
        {@const nx = STAR_REWARDS.find(r => r.need > all)}
        {@const earned = result.stars}
        {@const got = STAR_REWARDS.filter(r => r.need > all - earned && r.need <= all)}
        {#if got.length}<p class="unlock">Жаңа сыйлық ашылды: <b>{got.map(r => r.kz).join(', ')}</b> · Кейіпкер бетінде ки!</p>
        {:else if nx}<p class="next">★ {all} · келесі сыйлық «{nx.kz}» — тағы {nx.need - all} ★</p>{/if}
      {/if}
      {#if result.note}<p class="paper note">{result.note}</p>{/if}
    </div>
  {:else if item}
    {@const maxLen = Math.max(...item.choices.map(c => c.text.length))}
    <div class="qa" class:fit={phase !== 'feedback' && !gapOpen}>
    <div class="q-sticky">
      {#key idx + (twin ? 1000 : 0)}
        <div class="paper q" class:locked bind:this={cardEl}>
          {#if item.real}<span class="real">★ Нағыз емтихан есебі · {item.source.startsWith('daryn') ? `«Дарын» ${item.source.slice(5, 9)}` : 'Bolashak'}</span>{/if}
          <p>{#each item.kz.split('\n') as line, i}{#if i}<br />{/if}<span class:formula={i > 0}>{line}</span>{/each}</p>
          {#if item.figure?.svg}<div class="fig">{@html item.figure.svg}</div>
          {:else if item.figure?.src}<div class="fig"><img src={import.meta.env.BASE_URL + item.figure.src} alt="Есептің суреті" /></div>{/if}
        </div>
      {/key}
    </div>

    <div class="choices" class:long={maxLen > 5} class:xlong={maxLen > 24} class:locked>
      {#each item.choices as c, i}
        <button bind:this={choiceEls[i]} class="ans" style="animation-delay:{locked ? i * 70 : 0}ms"
          class:sel={picked === i && phase === 'answer'}
          class:right={phase === 'feedback' && i === item.answer}
          class:wrong={(phase !== 'answer' && picked === i && i !== item.answer) || (struck.includes(i) && phase === 'feedback')}
          class:out={struck.includes(i) && phase === 'answer'}
          disabled={phase !== 'answer' || locked || struck.includes(i)} onclick={() => pick(i)}
          aria-label="{letters[i]}: {c.text}{phase === 'feedback' && i === item.answer ? ' — дұрыс' : ''}">
          <span class="l">{#if phase === 'feedback' && i === item.answer}<Icon name="check" fill="#fff" size={16} />{:else if struck.includes(i) || (phase === 'retry' && picked === i)}<Icon name="cross" fill="#fff" size={16} />{:else}{letters[i]}{/if}</span>
          <span class="ct">{c.text}</span>
        </button>
      {/each}
    </div>
    </div>

    {#if showSol || (phase === 'feedback' && !lastCorrect)}
      <details class="paper sol" open>
        <summary>Шешуі</summary>
        {#if gap}
          <p>{gap.before}<b class="gap" class:done={gapDone}>{gapDone ? gap.answer : '?'}</b>{gap.after}</p>
          {#if !gapDone}
            <p class="gq">Шешудегі <b>?</b> орнына қай сан тұрады?</p>
            <div class="gopts">{#each gap.options as o}<button class="ans" class:wrong={gapWrong.includes(o)} disabled={gapWrong.includes(o)} onclick={ev => fillGap(o, ev)}>{o}</button>{/each}</div>
          {/if}
        {:else}<p>{item.sol.kz}</p>{/if}
      </details>
      {@const rule = ruleOf(item.skill)}
      {#if rule}
        <details class="paper sol rule">
          <summary>Ережені еске түсір</summary>
          {#each rule.lines as l}<p>★ {l}</p>{/each}
        </details>
      {/if}
    {/if}

    {#if phase === 'feedback'}
      <div class="ai">
        {#each aiTurns as t}
          {#if t.role === 'bit'}<Bit text={t.text} mood="think" compact />{:else}<p class="kidq">— {t.text}</p>{/if}
        {/each}
        {#if aiErr}<p class="aierr">{aiErr}</p>{/if}
        {#if !aiTurns.length}
          <button class="btn ghost block" onclick={() => helpMe()} disabled={aiBusy}><Icon name="bulb" fill="var(--gold)" size={20} />{aiBusy ? 'Бит ойланып жатыр…' : 'Түсінбедім — Биттен сұра'}</button>
        {:else if aiAsked < MAX_QUESTIONS}
          <form class="askrow" onsubmit={(e) => { e.preventDefault(); if (aiQ.trim()) helpMe(aiQ); }}>
            <input bind:value={aiQ} maxlength="200" placeholder="Тағы сұрағың бар ма? Жаз…" disabled={aiBusy} onkeydown={(e) => e.stopPropagation()} />
            <button class="btn" disabled={aiBusy || !aiQ.trim()}>{aiBusy ? '…' : 'Сұрау'}</button>
          </form>
        {/if}
      </div>
    {/if}
  {/if}

  {#snippet footer()}
    {#if result}
      <button class="btn primary big grow" onclick={() => go({ name: block === 'boss' ? 'map' : 'hub' })}>{block === 'boss' ? 'Картаға' : 'Кемеге'}<Icon name="chevron" fill="var(--outline)" size={20} /></button>
    {:else if item && phase === 'answer'}
      <button class="ibtn lamp" onclick={hint} disabled={hintLevel >= 4 || locked} aria-label="Бит сканері — кеңес {hintLevel}/4">
        <Icon name="bulb" fill="var(--gold)" /><b class="hl num">{hintLevel}/4</b>
      </button>
      {#if picked === null}
        <button class="btn big grow wait" onclick={needPick}>Жауапты таңда</button>
      {:else}
        <button class="btn go row2 sure" onclick={() => confirm('sure')}><Icon name="check" fill="var(--outline)" size={18} />Сенімдімін</button>
        <button class="btn row2" onclick={() => confirm('maybe')}>Шамамен</button>
      {/if}
    {:else if item && phase === 'retry'}
      <button class="btn primary big grow" class:wait={busy && !gate.on} class:charging={gate.on} class:charged={gate.done} style="--gate:{gate.ms}ms"
        onclick={() => busy ? null : gate.on ? nudge() : retry()}>{gate.on ? 'Оқы…' : 'Тағы көр'}</button>
    {:else if item && phase === 'feedback'}
      <button class="btn big grow {(busy && !gate.on) || gapOpen ? 'wait' : lastCorrect ? 'go' : 'primary'}" class:charging={gate.on} class:charged={gate.done} style="--gate:{gate.ms}ms" onclick={next}>{idx + (twin ? 0 : 1) >= total ? 'Аяқтау' : twin ? 'Реванш' : 'Келесі'}<Icon name="chevron" fill="var(--outline)" size={20} /></button>
    {/if}
  {/snippet}
</Screen>

<style>
  .gap { display: inline-block; min-width: 2.2em; padding: 0 6px; text-align: center; border-radius: 8px; background: #ffe9a8; border: 2px dashed #b88a1a; color: #6b4a0a; }
  .gap.done { background: #c8f5d8; border-style: solid; border-color: var(--ok); color: #135c32; animation: flipIn .35s; }
  .gq { font-weight: 800; margin-top: 8px; }
  .unlock { margin: 0; padding: 10px 12px; border-radius: 14px; background: linear-gradient(180deg, #ffe07a, #f2b632); color: #3a2400; border: 3px solid var(--outline); font-weight: 800; text-align: center; animation: flipIn .5s; }
  .next { margin: 0; color: var(--gold); font: 800 15px var(--disp); text-align: center; }
  .gopts { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; margin-top: 6px; }
  .gopts .ans { justify-content: center; font: 900 18px var(--disp); }
  .wv { display: flex; gap: 3px; }
  .wv i { width: 10px; height: 10px; border-radius: 3px; background: #0b1030; border: 2px solid var(--outline); }
  .wv i.done { background: var(--ok); } .wv i.on { background: var(--glitch); }
  .bn { display: flex; justify-content: center; padding-top: 6px; min-height: 40px; }
  .banner { font: 900 24px var(--disp); color: var(--gold); -webkit-text-stroke: 2px var(--outline); paint-order: stroke fill; text-shadow: 0 3px 0 var(--outline);
    animation: bannerIn 1.2s var(--ease-out) both; }
  @keyframes bannerIn { 0% { opacity: 0; transform: scale(.4) translateY(10px); } 18% { opacity: 1; transform: scale(1.15); } 30% { transform: scale(1); } 80% { opacity: 1; } 100% { opacity: 0; transform: translateY(-8px); } }
  .say { padding: 0 4px 4px; width: min(480px, 100%); animation: pop-in .25s var(--ease-out) both; }
  .say :global(.bubble) { font-size: 14px !important; line-height: 1.35; padding: 7px 10px !important; max-height: 5.2em; overflow: hidden; }
  /* вопрос и ВСЕ варианты видны вместе: вопрос прокручивается внутри своей рамки, варианты закреплены внизу панели */
  .qa { display: flex; flex-direction: column; gap: 10px; }
  .qa.fit { flex: 1 1 auto; min-height: 0; }
  .qa.fit .q-sticky { flex: 0 1 auto; min-height: min(96px, 34%); overflow-y: auto; overflow-x: hidden; overscroll-behavior: contain; }
  .qa .choices { flex: none; }
  .q-sticky { min-width: 0; }
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
  .loot { display: flex; gap: 8px; width: 100%; }
  .loot > div { flex: 1; display: grid; gap: 2px; padding: 10px 4px; border-radius: 14px; background: var(--deep); border: 3px solid var(--outline); animation: pop-in .4s .5s var(--ease-out) both; }
  .loot b { font-size: 26px; text-shadow: 0 2px 0 var(--outline); }
  .loot .gold b { color: var(--gold); }
  .loot small { color: var(--dim); font-size: 12px; }

  .hd { flex: 1; min-width: 0; display: grid; gap: 6px; }
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
  .choices .ans { min-width: 0; min-height: 48px; padding: 6px 10px; gap: 8px; font-size: clamp(15px, 4.4vw, 19px); }
  .choices .ans .l { width: 26px; height: 26px; font-size: 14px; }
  .choices .ans:last-child:nth-child(odd) { grid-column: 1 / -1; }
  @media (max-height: 720px) { .choices .ans { min-height: 42px; padding: 4px 8px; } .choices .ans .l { width: 24px; height: 24px; } .choices { gap: 6px; } .qa { gap: 8px; } }
  .choices.long .ans { font-size: clamp(14px, 4vw, 17px); }
  .choices.xlong { grid-template-columns: minmax(0, 1fr); }
  .choices.xlong .ans { font-size: clamp(14px, 3.9vw, 16px); }
  .ct { min-width: 0; overflow-wrap: anywhere; line-height: 1.2; }
  .sol summary { cursor: pointer; font: 900 15px var(--disp); color: var(--code-deep); }
  .sol p { margin-top: 8px; }
  .sol.rule summary { color: var(--gold-deep); }

  .ai { display: grid; gap: 8px; }
  .kidq { color: var(--dim); font-style: italic; }
  .aierr { color: var(--gold); }
  .askrow { display: flex; gap: 8px; }
  .askrow input { flex: 1; min-width: 0; font: 700 16px var(--txt); color: var(--paper-ink); background: var(--paper); border: 3px solid var(--outline); border-radius: 12px; padding: 8px 10px; }

  .grow { flex: 1; min-width: 0; }
  .row2 { min-height: 58px; padding: 10px 8px 13px; font-size: 16px; gap: 4px; flex: 1; min-width: 0; }
  .row2.sure { flex: 1.35; }
  .lamp { width: 58px; height: 58px; position: relative; --c: #243a9e; --e: #152678; }
  .lamp:disabled { opacity: .5; }
  .hl { position: absolute; bottom: -8px; left: 50%; transform: translateX(-50%); font-size: 11px; padding: 0 5px; border-radius: 999px; background: var(--outline); color: var(--gold); }
</style>
