# Спецификация: движок обучения (сжатый пересказ)

> **Канон — `docs/systems/IMPLEMENTATION.md` v2.** Где этот текст расходится с ним (имена полей, константы, даты, номера PR, пометки «КОНФЛИКТ»), прав IMPLEMENTATION §1–§4.

## Факты (проверено на данных)
- Қиындық задаётся на шаблон, gen() её не принимает. Из 74 тем с генераторами у 50 один шаблон. Из 36 тем с уроком: у 18 ≥ 2 шаблонов с қиындық ≥ 2; у 13 есть и 2, и 3; у 5 максимум 1 → нужны откаты (requiredRungs, checkPair).
- У 84 из 122 шаблонов ≥ 3 постоянных меток ловушек → близнец с той же ловушкой перегенерацией.
- Правило четверга буквально («две предыдущие, включая среду, үйренді») почти всегда пропускает четверг → ~2 темы/нед, ~118 тем к ноябрю 2027 (вместо 135), деңгей ≈ 590, 34 вехи из 49. Вариант «две темы до вчерашней» → ~130 тем, 39 вех. ОТКРЫТЫЙ ВОПРОС Султану.
- Нагрузка проверок при лимите 6: в среднем 3,0–4,1 темы/день, лимит упирается в 90–230 дней из ~420, просрочка ≤ 1–5 учебных дней. До уровня 5 через пятничный мини-пробник доходят почти все.

## Данные
```
TopicState { level 0..5 (только растёт); lessonOn?; learnedOn?; since? (от него интервал); crack?: {on, practiced?}; repairedOn?; repairCoinOn? (монета за починку не чаще 30 дн); retryOn? (после 1 из 2); check?: {day, kind:'level'|'maint'|'repair'|'retry', shown, res:(boolean|null)[]} (показанная задача сразу false); rung 1..3; wrongRun; finalMiss?; mockMiss? }
Save.topics — кэш; Save.topicsBase {at, topics} — снимок, переписывается каждый понедельник; Save.exceptions
Attempt += r?:2 (версия правил), diff?: rung, step?, closed?, check?: {kind, i}; mode += 'check'|'recall'|'repair'
```
ГЛАВНОЕ: уровни = чистая свёртка foldTopics(base, attempts ≥ base.at, exceptions); save.topics — кэш. Два устройства объединяют ответы → одинаковый результат, полевое слияние тем не нужно. Снимок по понедельникам → новые правила только с понедельника. level = max(кэш, свёртка). (КОНФЛИКТ с data.md, где topics сливаются по t — решить: свёртка из ответов первична.)

## rules.ts (одна функция на понятие)
- rushLimit(chars, adaptiveMs, correct); isRushed(f) — заменяет rush.ts:17 isTooFast, Diagnostic.svelte:44 (>3000), answers.ts:8 FAST_MS, Commander.svelte:61, :296.
- isClosed(awayMs) > AWAY_CLOSE_MS 5000 — заменяет planner.ts:114 AWAY_MS 3000.
- isHonest(f): не закрыта, подсказка < 4, «Білмеймін» ≥ 1,5 с, иначе не наспех — заменяет planner.ts:116, Session.svelte:385/:489, Recall.svelte:157, analytics.ts:90/:162.
- forModel(a) → 'correct'|'wrong'|null: только hintLevel 0; закрыта → wrong; наспех: неверный → wrong, верный → null; «Білмеймін» → wrong; «Сам поймал» → wrong; урок: predict/why/quiz/bug → null, faded/final → в модель; старые ответы (без r) — прежний фильтр. Заменяет progress.ts:58, :36 windowStat.
- classify(f) → {rushed, closed, honest, verdict, pay:'paid'|'wrong'|'zero'} (закрыта → wrong, верная наспех → zero) — вход для минут и ремонта (Session.svelte:383–397, :485–496).
- requiredRungs(skill) → {2,3} из доступных; нет ≥ 2 → [max].
- isLearned(atts, skill, lessonOn) — үйренді: окно 20 последних ответов для модели с дня урока, n ≥ 15, ≥ 85% и по верному на каждой ступени из requiredRungs; BKT — только оценка, MIN_ATTEMPTS и LAST_CLEAN убрать (progress.ts:87–92).
- isSchoolDay(d, exc), addSchoolDaysX (dates.ts:6 обёртка).
- dueDate(since, gap, exc): +gap календарных дней, +1 за каждый день-исключение внутри, перенос на ближайший учебный (заменяет INTERVALS progress.ts:6, GAPS recall.ts:12, :24, WINDOWS :16).
- nextCheck(t, exc): ур. 1–3 → 'level' 7/21/60; ур. 4–5 → 'maint' 60; retryOn → 'retry'; трещина с practiced → 'repair' следующий учебный день (заменяет dueSkills progress.ts:99, fixMissingDue :19).
- checksToday(topics, day, exc): ≤ 6; порядок repair → retry → по просрочке → по уровню (низкий первым) (planner.ts:43–47, recall.ts:51).
- checkPair(skill, rand): 2 разных шаблона қиындық ≥ 2; один шаблон — тот же с новыми числами; максимум 1 — максимум + пометка командиру «упрощена» (Recall.svelte:147).
- checkOutcome([a,b]) → up (обе correct) / hold (одна) / crack (ни одной).
- applyCheck(...) (progress.ts:65–85; weakBefore, review_failed убрать).
- dengey(topics) / holding(topics).
- isReadyFromMock(t, f) — дайын: ур. 4, без трещины, верно, без подсказки, не наспех, не закрыта, первая попытка в мини-пробнике/арене.
- nextRung / isStuck / trapTags; canRepairCoin(t, day).
Уходят: recall.ts:25 isCredited, :66 часть record с расписанием (остаётся история). Album.svelte:11/46/144 и Commander.svelte:10/102/319 → уровень темы. «МЕҢГЕРІЛДІ» (Lesson.svelte:233, :310) → «Сабақ бітті».

## Автомат темы
- 0→1: после урока практика, isLearned на каждом ответе → learnedOn, since.
- Ур. 1/2/3, проверка через 7/21/60: up → +1, since=день; hold → retryOn = +2 учебных дня; crack → уровень тот же, crack.on.
- Ур. 4: maint раз в 60, пока мини-пробник не даст 5; ошибка в пробнике трещины не даёт, тема первой в след. пятницу.
- Ур. 5: maint раз в 60; up → +4 монеты, since; hold → повтор; crack → трещина.
- Трещина: день 1 — в «Тексеріс» карточка «Дәптер» как правило, в рейсе 2 ремонтная практика (3 задачи ступени 1→2) → practiced; след. учебный день — проверка repair: 2/2 → прежний уровень, since заново, repaired; 1/2 → завтра; 0/2 → снова практика.
- «Тексеріс»: задача 1 → задача 2 → вспоминание правила (бывший «Еске түсір», без своего расписания) → разбор.
- Сгорание: перед показом check.shown++ и res[i]=false с persist; ушёл/закрыл — неверно; перезагрузка — со следующей задачи; итог датой check.day.
- Кнопки ответа в проверке и мини-пробнике открываются только через tooFastMs(chars) — верно наспех ответить нельзя.

## Практика
items.ts: tplDifficulty(id), makeItem(skill, {rung?, wantTag?, avoidKz?, tpl?}) — ступень, иначе ближайшая ниже, потом выше; wantTag — до 8 перегенераций, потом другой шаблон с меткой. nextRung: 3 верных подряд → выше; хранится в topics[].rung; смешанные волны ступень ≥ 2. isStuck(wrongRun ≥ 5): объяснение (правило + разбор с контрастом), rung=1; уже 1 — задача с открытой первой подсказкой (в модель не идёт). trapTags: метки ≥ 2 раз за 7 дней, уверенные ошибки первыми → объяснение Бита + 2 задачи с wantTag; близнецы ремонта тоже с wantTag.

## Очередь
content/queue.mjs [{skill, week}], ~135 тем, только математика и логика. nextTopic(save, queue, day): после NEW_TOPICS_END (19.11.2027) — null (практика по слабым темам с весами); Пн, Ср — новая; Чт — только если две предыдущие үйренді; Вт — практика и схемы; Пт — мини-пробник с 4.12.2026 (до этого практика); исключение — ничего. Первая тема с уроком и предпосылками; без урока — пропуск + тревога «запас < 3 нед». finalMiss вчера → в рейсе 1 первым повтор финала (правило + новая задача, одна попытка), новую тему не отменяет. miniMock(save, day): 10 задач, ≤ 6 тем ур. 4 без трещины (по давности since), остальные ур. ≥ 2 по весам, қиындық 2–3, позже банк; +4/−1, пропуск можно, без подсказок и близнецов.

## Неделя 1 (только новые ответы, r:2)
recordAttempt (progress.ts:58): forModel вместо honest. Lesson.svelte:212–237 — каждый выбор в историю (mode 'lesson', step, source 'lesson:<skill>:<i>'). Финал (Lesson.svelte:222–236): makeItem(skill, {rung ≤ 2, avoidKz: текст цели}), одна попытка (убрать блокировку 3 с и перебор), ошибка → разбор + finalMiss; урок пройден в любом случае (:259). Diagnostic.svelte:44 → !isRushed; :53–54 не ставят learned (уровень 0, урок сначала). Recall.svelte:157: mode 'recall', forModel → null (П6).

## Константы (balance.mjs, learning)
RUSH, ADAPT, AWAY_CLOSE_MS 5000, DUNNO_MIN_MS 1500, WINDOW {20, 15, .85}, LEVEL_GAP {1:7, 2:21, 3:60}, MAINT_GAP 60, HOLD_RETRY 2, CHECK_CAP 6, CHECK_MIN_DIFF 2, RUNG_UP 3, STUCK_RUN 5, TRAP {n:2, days:7}, NEW_TOPIC_WD [1,3,4], NEW_TOPICS_END '2027-11-19', MINI_MOCK_FROM '2026-12-04', MOCK_N 10, MOCK_L4_MAX 6, REPAIR_COIN_COOLDOWN 30, FINAL_RUNG_MAX 2.

## PR
- L1 (нед.1, M): наспех → модель, урок в историю, r:2, mode (rules.ts, progress.ts, types.ts, Session.svelte:383–401, Lesson, Recall, Diagnostic). rules.test.ts — таблица сочетаний. Сразу.
- L2 (нед.2, S): финал на новой задаче, одна попытка; закрыта > 5 с = неверно (Lesson, items). Двойник → пн 12.10.
- L3 (нед.2–3, M): весь словарь в rules.ts + balance.mjs; замена дублей (answers.ts, Commander, analytics, dates.ts). glossary_one_fn (grep). Сразу.
- L4 (нед.3, M): v2 в тени: foldTopics, перенос (learned→1, mastered→2, automatic→3, был выше → трещина; срок = старый due, разнесён лимитом 6), кэш, уровни у командира. Тень.
- L5 (нед.4, L): проверка, трещины, одно расписание (nextCheck, checksToday, checkPair, applyCheck, исключения). schedule.test.ts. Тень.
- L6 (нед.4–5, M): очередь queue.mjs + nextTopic (порядок сразу, ритм под флагом).
- L7 (нед.5, M): лесенка, застрял, ловушки (items.ts, rules.ts, Session). Двойник → пн 2.11.
- L8 (нед.6, M): «Тексеріс» = проверка → вспоминание; Recall без своего расписания. Флаг у двойника → ребёнку пн 30.11.
- L9 (нед.6, M): sim.ts simulateTopics + инварианты.
- L10 (нед.8–9, M): мини-пробник и уровень 5. Двойник → ребёнку пн 7.12, первый пробник пт 11.12.

## Инварианты
level-monotone; check-queue-bounded (≤ 6/день, просрочка ≤ 5 учебных дней при 70%); crack-repairable (≤ 10 учебных дней при 85%, открытых к экзамену ≤ 5%); level5-reachable (≥ 90% начатых тем на ур. 5 к экзамену); milestone-cadence (в среднем ≤ 14 дн, макс ≤ 42); queue-pace (≥ 130 тем к 19.11.2027 при 85% — КРАСНЫЙ при буквальном четверге); guess-no-gain; one-schedule. KNOWN_RED: из one-rule уходят fast, honest, schedule, mastered, progress-store; data-clean — строки attempts mode, selfCheck/kind, recall learnedDay/history task.

## Риски
Два устройства — свёртка, одинаковая проверка в один день: первая по at, вторая — практика. Офлайн — локально, сгорание сохраняется до показа. Полночь — датой начала. Болезнь — исключения задним числом, очередь сдвигается. Старая версия — ответы без r читаются старым фильтром. Пустые данные — перенос из skills, тема без генератора без проверок. Бесконечное 1 из 2 — командиру «держится > 3 повторов». Мало шаблонов — откаты.

## Открытые вопросы
1. Правило четверга: буквально (~118 тем) или «две темы до вчерашней» (~130)? Или меньший объём приемлем.
2. MAX_OPEN_TOPICS = 4: если ≥ 4 тем начаты и не үйренді, Пн и Ср тоже практика. Да/нет.
