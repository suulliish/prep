# Спецификация: день ребёнка, минуты, караоке, корабль (сжатый пересказ)

> **Канон — `docs/systems/IMPLEMENTATION.md` v2.** Где этот текст расходится с ним (имена полей, константы, даты, номера PR, пометки «КОНФЛИКТ»), прав IMPLEMENTATION §1–§4.

Прототип движка минут: scratchpad/day/minutes_proto.mjs.

## Данные
DayRecord += plan2: {v:2, day, builtAt, kind:'new'|'practice'|'mock', trips:[Trip,Trip]}; Trip {n, steps: Step[]}; Step: carry | check | recall | lesson | notebook | types | wave{wave:'new'|'practice'|'mixed'|'mock', skills, items, bank} | repair; id слота `${day}:${trip}:${step}:${i}`.
trip: {n, step, t1At?, breakAt?, t2At?} (кнопка «Жалғастыру»).
mins: {planN, slots: Record<slotId, {k:'right'|'wrong'|'dunno'|'rush'|'away'|'void', at, src, skill}>, honestMs: Record<deviceId, number>, open?: {slot, shownAt, hiddenAt?}, credit?: {at, min, via:'full'|'cap'|'stop'|'sick', wk}, extra?: MinDay}.
Save.debts: Record<id, {id=slotId, skill, src, k, need:1|2, got, explained?, day, carried?}> (верхний уровень, переживает смену дня; слияние по id). Settings += pinFails, pinLockUntil.
Для новых дней больше не пишутся bonuses, honest, tally, extraHonest, stars, blocksDone (старые дни — история, без пересчёта).

## Константы
MIN {day:60, extra:15, extraPerDay:1, v:{right:1, dunno:0, rush:0, wrong:−.25, away:−.25}, twins:{wrong:2, away:2, dunno:1, rush:1}, stuckRow:5, stuckEasy:2, honestCapMin:50, extraCapMin:13, taskCapS:180, stepCapS:120, carryMax:8, wkPerDay:18, wkMax:90}; AWAY {closeMs:5000}; TRIP {breakMin:5, hopMs:1200, arriveMs:2000, portalMaxMs:1500}; EVENT {rightMs:800, wrongMs:1300, reducedMs:600}; KARAOKE {pauseComma:1.5, pauseStop:3, leadMs:120}; PIN {fails:5, delayS:30, unlockMin:10}; MOCK_FROM '2026-12-07'.

## Движок минут src/engine/minutes.ts
- slotValue: right +1; dunno 0; rush (верный наспех) 0; wrong и away −¼; void вне счёта.
- debtOf: wrong/away → 2 верных близнеца; dunno → объяснение + 1; rush → 1 близнец.
- bar(mins, debts): score = Σv + Σ долгов (1−v)·got/need; n = max(planN, ответов); min = 60·clamp(score/n). Полный ремонт = ровно 60. Порядок: верно > «Білмеймін» > неверно = свернул.
- repairQueue: сначала перенесённые, потом сегодняшние; у dunno сначала объяснение. onRepair: только честный верный — got++; неверный близнец ничего не отнимает.
- stuck: 5 неверных подряд → объяснение + 2 задачи қиындық 1 (нужен makeItem(skill,{level:1}) от обучения).
- addHonest: честный ответ ≤ 180 с; шаг урока/разбор/вспоминание ≤ 120 с; наспех и свёрнутое — 0.
- shouldCredit: 'full' (полоса 60) или 'cap' (честных ≥ 50 мин; если посреди рейса 2 — недоигранные волны отменяются).
- credit(via) → {min, wk, carry}: min = 60 при cap, иначе round(полоса); wk = round(18·min/60); незакрытые долги → carried (≤ 8 близнецов), остальное в обычный repairShop без минут. Начисление ОДИН РАЗ, неизменно, до анимации итога.
- extraBar/extraCredit: n=10, max 15, cap 13 мин, только после начисления дня; правило «7 из 10» удаляется.
- weekendBank = min(90, Σwk + доп. миссия, если «в копилку»).
- repairCoins(debt) = 0 сегодня, 1 если перенесён. (КОНФЛИКТ с DESIGN: «ремонт в тот же день — 0», перенесённый — не определено; починка трещины 3.)
- mergeMinDay: slots объединение (конфликт — раньше at); honestMs max по устройству, потом сумма; credit — раньше at, min = max; долги got max, carried ИЛИ.

Примеры (planN 24, ответ 50 с, близнец 45 с, урок 10 мин): 0 ошибок — 60, 30 мин; 1 ошибка — 56,9 → 2 близнеца → 60, 31,5 мин; 8 ошибок — 35 → 16 близнецов → 60, 42–44 мин; 3 «Білмеймін» — 52,5 → 60, 32 мин; 15 нарочных наспех — 13,1 → 30 близнецов → 60, на 10 мин дольше; 15 нарочных медленно — 50,3 мин → cap 60, 3 близнеца завтра; 15 нарочных и бросил ремонт — 13, долг 8 близнецов на завтра.
Болезнь: exception 'sick' — если день начат, начисляется текущая полоса (via 'sick'); долги ждут; копилка и серия не страдают. Убито посреди дня: open с hiddenAt → away; без hiddenAt → void (без штрафа, близнец). День не закончен до полуночи → начислено 0, долги переносятся, командир видит «не завершён, полоса 41/60». (ВОПРОС: противоречит ли «60 трудом»? бросил ремонт — 13, не закончил до полуночи — 0.) Два устройства: план с более ранним builtAt; честное время складывается; начисление одно.

## День из двух рейсов src/engine/day.ts
buildDay(save, defs, day); nextStep(rec) → {trip, step} | 'break' | 'summary' | 'done'.
- Пн, Ср: рейс 1 — перенесённые долги → Тексеріс (до 30.11 разминка 6 задач, потом проверки ≤ 6 тем × 2) → Еске түсір (≤ 3) → урок → Дәптер; рейс 2 — новая тема 8 (қиындық 1→3) → смешанные 8 (2 из банка) → ремонт.
- Вт: долги → Тексеріс → Еске түсір → «определи тип» (минут не даёт, время в честное); рейс 2 — практика слабых и вчерашней 8 → смешанные 8 → ремонт.
- Чт: как Пн, если две прошлые үйренді, иначе как Вт.
- Пт: до 7.12 как Вт; с 7.12: долги → Тексеріс → Еске түсір; рейс 2 — мини-пробник 10 → разбор → ремонт.
- Выходные и исключения: плана нет. planN 24, по медиане времени 12–28, чтобы день 25–35 мин.
Шаги подряд: экран {name:'trip', n} → src/screens/Trip.svelte встраивает Lesson, Recall, NotebookCard, Session с embedded/onDone; Session вместо экрана результата (Session.svelte:651) — тост ~1 с; первый шаг — arrive ≤ 2 с; между шагами arena.hop(seed) ≤ 1,2 с; setSpot/arrive из Session.svelte:296 и Lesson.svelte:172 переходят в Trip. Привал Break.svelte (таймер 5 мин, «2-рейсті бастау» сразу, «жиналды 38/60 — рейс 2-ден кейін есептеледі»). Один итог Summary.svelte.
Вырезаем: возврат на корабль после шагов, точки шагов, карточку summary, showReward после шага, звёзды шагов, restoreFix/restorableFix и кнопку «Қатені түзет · минутты қайтар» (Hub.svelte:182), asExtra/REPAIR_FOR_EXTRA/repairNeed/REPAIR_EXTRA_*, StepQueue, settleDay/planShare/48 мин в копилку, «Еске түсір» как гейт (Hub.svelte:154).

## Свернул > 5 с
src/engine/away.ts: closeOnReturn(phase, hiddenMs) → 'away' если фаза ask/self/conf и > 5000; recoverOpen(open) → 'away'|'void'. track.svelte.ts:48 onReturn(cb). Session при возврате: попытка {correct:false, tag:'away'}, слот away, долг 2 близнеца; раз в день карточка «Қосымшадан 5 секундтан көп шықтың — есеп жабылды, қате саналды. Міне, егіз есеп»; сразу близнец. Выход «назад» с открытой задачей — то же. AWAY_MS 3000 удаляется (planner.ts:114, Session.svelte:385, 489). Свернул на разборе/событии — без штрафа. Финал урока: свернул = промах. Правило — на странице «Ойын заңдары».

## Караоке
src/engine/karaoke.ts: tokens (из rush.ts:102–119 + «есе», «қалған»); weight = слоги в speakable(tok) (scripts/voice/lesson-lines.mjs; «245» = 6 слогов); пауза запятая 1,5, точка 3; timeline(toks, durMs), indexAt; sweepIndex(progress, n); pickCheck(toks). ReadGate (readgate.svelte.ts:50) += startedAt, progress(); таймер не меняется (2,5–18 с), подсветка без голоса доходит до конца, когда загорается «дальше». С голосом: audio.voicePos() → {url, t, d} (audio.ts:67, currentTime/duration); пока duration NaN — оценка по слогам. rAF меняет класс только при смене слова. Поправка частоты: mp3 robotRate 24000 vs модель 22050 → ×0,919 (проверить .onnx.json). Офлайн K2: make_voice.py находит паузы в WAV (< −40 дБ > 120 мс), привязывает к пунктуации, внутри фразы по слогам → public/voice/lessons/timings.json; piper include_alignments проверить. src/ui/Karaoke.svelte {text, voice?, gate?, check?}: .now, .read, .key; prefers-reduced-motion; полный текст для диктора. «Нажми на число»: раз в урок, первый say/goal после шага 2 с ≥ 2 числами, «Мәтіннен ең үлкен санды бас», неверно — «Тағы қара», минут не даёт, usage.events 'kcheck'. Где: Bit.svelte (вместо печатной машинки — все реплики), Lesson, условие задачи в Session (:757, mark.chg остаётся, варианты не запираются), ReviewPanel, Recall, NotebookCard, TeachBack, Intro, карточки правил, Summary.

## Корабль и командир
Hub.svelte:199–212: 3 счётчика — деңгей (до 30.11 уровень героя), минуты «Бүгін 0/60» (серым «жиналып жатыр 38», золотом после начисления; в выходные «Демалысқа 72/90»), монеты. Кристаллы, серия, прочность уходят (серию показывает питомец). Карточки «1-рейс», «2-рейс», после начисления «Қосымша миссия · 15 мин дейін». Подпись Hub.svelte:57 → «60 мин дейін: дұрыс +1, қате −¼, жөндеп толтырасың». Порталы по рейсам (Hub.svelte:110, Ж12). Портал ≤ 1,5 с (Hub.svelte:150); событие ответа 0,8/1,3 с (confidence.ts). Выход из Session/Trip через Confirm («Шығасың ба? Ашық есеп қате саналады, рейс сақталады»). bossTried — при показе первой задачи (Session.svelte:291 → nextItem :236). Командир: подарки удалить (111–113, 162, 172–173, planner.ts:75), подписи 164, 310, «каникулы». PIN — как в commander.md (здесь пауза 30 с — РАСХОЖДЕНИЕ с commander 60 с; выбрать одно).

## PR
- D1 (S): PIN, без подарков, подписи командира. Сразу, нед. 5.10.
- D2 (M): minutes.ts + balance MIN + тень («по новому правилу 47/60, долг 6»). minutes.test (таблица, merge коммутативен/идемпотентен, ≤ 60, кредит неизменен, перенос ≤ 8, копилка ≤ 90).
- D3 (M): 3 счётчика, копилка, подписи, подтверждение выхода, босс при показе, свернул > 5 с, короткие анимации. Двойник → пн 12.10.
- D4 (M): Karaoke + karaoke.ts + ReadGate.progress + voicePos + «нажми на число». Флаг → двойник → пн 19.10.
- D5 (S): timings.json из make_voice.
- D6 (L): day.ts, Trip.svelte, Break, один итог, arena.hop, карточки рейсов; вырезки. Флаг → двойник 5 дн → пн 26.10 (минуты по старой доле, но после итога).
- D7 (M): минуты вживую: ремонт, застрял, cap 50, перенос, доп. миссия, копилка 90; удалить restoreFix, asExtra, StepQueue. 3 нед. тени → двойник → пн 2.11.
- D8 (S): счётчик деңгей, Тексеріс в рейсе 1. С «Жаңа жүйе» пн 30.11.
(Плановый пункт «два рейса в январе на каникулах» снимается — каникул нет.)

## Инварианты
minutes-no-exploit (k = 1…20 нарочных ошибок: минуты ≤ честных, время ≥ честного); minutes-reach-60 (точность 0,5/0,7/0,9, доделал ремонт → 60; медиана честного времени ≤ 35, P90 ≤ 50); dunno-dominates; weekend-cap; no-gifts (только minutes.credit пишет минуты); trip-shape (2 рейса, начисление в итоге); map-data (plan2, trip, mins, debts).

## Открытые вопросы
1. Перенесённые близнецы входят в 50-минутный предел следующего дня? (заложено «да»)
2. «Свернул» в модель знаний как неверный? (обучение говорит: закрыта → wrong — согласовано).
