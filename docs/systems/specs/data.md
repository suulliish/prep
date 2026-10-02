# Спецификация: данные, синхронизация, безопасность выпусков (сжатый пересказ)

## Неделя 1: облако без потерь (cloud.svelte.ts, sync.ts)
Подтверждено: pull только при входе (:128), push — слепой batch.set главного документа (:63) и месяца ответов (:66). Ещё баг: смена аккаунта на одном устройстве сливает чужое сохранение (pull выбирает по updatedAt) — закрыть до двойника.
- pull(): вход, visibilitychange→visible, focus, online, перед любым действием командира; не чаще SYNC_PULL_MIN_MS=30000.
- push() → runTransaction: tx.get(main); если remote.v > CLIENT_SCHEMA → SchemaAhead → cloud.readOnly, «Жаңарту керек» + перезагрузка (локально игра идёт, в облако не пишет); если remote.rev ≠ lastRev → mergeSave(base, local, remote); проверка размера; tx.set(main, {save, updatedAt, app, v, rev+1, by: deviceId, appVersion, att, epoch}).
- Ответы по месяцам: в главном документе att:{'2026-10': n}; если remote.att[m] === pushedCount[m] — писать без чтения (любой писатель месяца поднимает rev в той же транзакции); иначе tx.get(attempts/m) → mergeAttempts → запись; месяц не уменьшается. usage — то же (use:{m: len}).
- Тело транзакции чистое (до 5 повторов); результат применяется после commit; если ребёнок в задании — отложить до корабля, base и lastRev не двигать. Применение через persistLocal() без afterPersist.
- Трёхстороннее слияние: base = копия облака после последней синхронизации (localStorage razlom.base.<uid>). pick3(b,l,r,tie): l≡r→l; l≡b→r; r≡b→l; иначе tie. Без базы — монотонные правила, при равенстве новее updatedAt. Пустая сторона (isBlank) не побеждает.
- MERGE_RULES: Record<keyof Save, Rule> (тест сверяет с типом Save; неизвестные поля — pick3, при равенстве новее). attempts — объединение; usage — по дню (числа max, steps/reviews/events объединение по at+k); skills[id] — у кого больше attempts; days[d]: blocksDone ИЛИ, tally[b] — больше n, honest[b] с той же стороны, stars/coins/extra — max, exception/hard — pick3, plan — облачный, если есть (первый план дня побеждает), потом settleDay; repairShop — объединение по source|skill|addedDay, fixed ИЛИ; shipOwned/worldsCleared — объединение; diagnosticDone/introSeen — ИЛИ; coins(v1) — max(0, b+(l−b)+(r−b)), без базы max; settings.*, heroName, world, outfit, style.*, shipPet, lessonPos, kzReview — pick3; recall[id] — история объединением, step/due более длинной; notebook — wrote ИЛИ, check с большим at; aiLog — объединение, последние 100.
- Без автосоздания аккаунта: signInPassword (:144–152) без createUserWithEmailAndPassword (:150); createAccount(email, pass) — только из командира (кнопка, повтор пароля, «прогресс с нуля»); verifyPassword(pass) — для PIN.
- Сохранение привязано к аккаунту: razlom.save.v1.<uid> и .local; другой аккаунт — свой ключ, без слияния; прогресс без входа + непустое облако → командир «Объединить / Оставить отдельно».

## Save v2 (types.ts; вложенные типы — отдельные интерфейсы, тест systems читает поля по отступу 2)
```
Save { version: 2; meta: SaveMeta; ...v1 поля до чистки;
  topics: Record<id, TopicState>; unlocked: Unlocked; milestones: {claimed: number[]; shown: number[]};
  ledger: CoinEntry[]; pets: Record<id, PetState>; collection: Collection; repairQueue: RepairTask[];
  rulesV: Record<string, {v, from}[]> }
SaveMeta { app; migrated?: {from:1, at, snap}; twin?: boolean; owner?: uid }
TopicState { lvl 0..5; due?; crack?: {since, fixPractice?}; home?: мир при lvl 1; lastCheck?: {day, res:'up'|'hold'|'crack'|'maint-ok'|'maint-crack'}; maint?; learnedAt?; lastFixMonth?; t: мс изменения }
Unlocked { outfits[]; capes[]; trails[]; worlds[]; bays[]; legacy? }
CoinEntry { id; at; day; n; why:'lvl'|'maint'|'fix'|'boss'|'mock'|'arena'|'legacy'|'buy' }  // id детерминированы: lvl:<тема>:<ур>, maint:<тема>:<день>, fix:<тема>:<месяц>, boss:<мир>, mock:<день>, buy:<предмет>, legacy:v1, legacy:chest; баланс = Σn
PetState { grown: string[] (дни роста); forms: string[] (миры-боссы); acc: string[]; wear? }
Collection { species: Record<id, первый день>; golden: string[] ('2026-W41'); trophies: string[] }
RepairTask { id (attemptKey источника); day; skill; tpl; kind:'wrong'|'dunno'; need: 1|2; done; explained? }
DayRecord += trips?: {r1?, restAt?, r2?}; mins?: {pts, lost, repaired, honestMs, carried, settledAt?}; rules?: Record<string, number> (версии правил/флаги, зафиксированные утром)
```
Слияние v2: topics — больший t, при равенстве больший lvl; unlocked/milestones/ledger(по id)/pets.grown/forms/acc/collection — объединение (только растут); repairQueue — объединение по id, done max; trips — doneAt побеждает; mins — max, settledAt — min.

## Миграция v1→v2 (src/engine/migrate.ts)
snapshotUnlocked(s) — в неделю 1, до любых изменений: костюмы OUTFITS.need ≤ crystals() ∪ надетый; плащи/следы STAR_REWARDS.need ≤ totalStars() ∪ style; миры worldOpen ∪ worldsCleared ∪ world; копия в unlocked.legacy. migrateV1toV2(s, ctx) — чистая, идемпотентная: learned→1, mastered→2, automatic→3; есть learnedAt, но сейчас learning → lvl 1 + трещина; due сохраняется; home='village'; монеты legacy:v1 = coinsOf(s) + legacy:chest; питомцы из shipOwned → pets. Удаляется только weekendSpent, days[].spent, bonuses[].mastery; xp, levelStars, style — чисткой через 2 недели. Перед миграцией — razlom.save.v1.pre-v2 и облачный снимок pre-v2.

## Флаги, двойник, снимки
- Флаги: users/{uid}/meta/flags {name: {value:'off'|'shadow'|'on', from}}, умолчания content/flags.mjs; flag(name, day) в src/lib/flags.svelte.ts; кэш в localStorage; флаги дня фиксируются в days[d].rules при сборке плана. config/app (только чтение) {minApp, schema}: сборка старше minApp — только чтение.
- Двойник: вкладка «Выпуск»: createAccount; «Клонировать ребёнка» (сохранение в память → смена аккаунта → replaceSave с meta.twin, owner); флаги по аккаунту; баннер «ДВОЙНИК»; «Обновить клон» по понедельникам.
- Снимки: первая запись дня читает snapshots/{день}; если нет — пишет состояние облака ДО записи + сводку {at, app, v, sum}; удаление −15…−21 дней; pre-v2 и before-restore-* — 60 дней. Восстановление: сводки → различия → PIN → транзакция (текущее в before-restore-<ts>, снимок главный, epoch+1); клиент с новым epoch заменяет своё (старое в .before-replace); ответы объединяются. Импорт файла — тот же путь; проверка version !== 1 (store.svelte.ts:128) → ≤ CLIENT_SCHEMA + migrate.

## Кэш и версии
__APP_VERSION__ = '<package.version>+<sha7>.<дата>', dist/version.json; версия в meta.app, главном документе (appVersion, devices[deviceId] = {app, at, label}), logError (App.svelte:29); командир видит версию, схему, rev, кто писал, синхр. устройств. sw.js из шаблона: кэш zharyq-shell-<BUILD> (текущий+предыдущий, zharyq-v1 удаляется), zharyq-media чистится по манифесту, в кэш только status 200 (сейчас 206 от mp3 ломает cache.put, sw.js:13). virtual:media — sha1-8 файлов public/voice|models|sfx; mediaUrl(path) → ?v=hash (voice.ts:13, Lesson.svelte:85, three/assets.ts:11, audio.ts). Обновление: при возврате читать version.json no-cache; новее → перезагрузка только на корабле; ошибка загрузки чанка → перезагрузка на корабле (сейчас import(cloud).catch молча отключает облако, App.svelte:45).

## Правила Firestore и размер
firestore.rules + firebase.json в репозитории: users/{uid} — свой uid, удалять нельзя, save string < 950000, rev == resource.rev+1 (или null), v >= resource.v (старые клиенты без rev после v2 получают отказ); attempts/{m}: n >= resource.n, < 950000, без удаления; usage — размер; snapshots — удалять только старше 13 дней; meta — свой; config — чтение. Размер: > MAIN_WARN 700000 → compactSave (дни старше 30 без plan/tally/honest/trips; починенные поломки старше 30 дней) + тревога; > 950000 — не писать, cloud.error='size'; месяц > 900000 → <m>~2. Константы TECH в balance.mjs.

## PR
- D1 (M, нед.1): облако — транзакция, rev, mergeSave, перечитывание, защита схемы. Тесты: sync_merge (каждое поле, merge(x,x,x)=x, монотонность, без базы, пустая сторона), cloud_race.test.ts (поддельный Firestore; «телефон Султана с копией недельной давности меняет настройку → у ребёнка всё цело»; два устройства в один месяц; v новее → только чтение; офлайн). Выкатка сразу; сначала обновить телефон Султана, 2 дня смотреть devices.
- D2 (S, нед.1): вход без автосоздания; сохранение по аккаунту; verifyPassword.
- D3 (S, нед.1): firestore.rules + эмулятор в CI (setup-java + firebase emulators:exec). Публикует Султан после того, как оба устройства на D1.
- D4 (S, нед.1): снимки дня (14) + восстановление. Зависит D1, D3.
- D5 (S, нед.1): снимок открытого (unlocked в v1, добавочно).
- D6 (S, нед.1–2): версия сборки везде + config/app minApp.
- D7 (M, нед.2): кэш с версией, хэши голоса/моделей. Вместе с экранным релизом пн 12.10.
- D8 (S, нед.2): флаги и двойник (вкладка «Выпуск», клон, баннер, days[d].rules).
- D9 (S, нед.2–3): обезличенная фикстура (scripts/fixture-save.mjs), compactSave, проверка размера, mainKb в sim, чистка usage > 400 дней.
- D10 (M, нед.3): Save v2 типы + migrate в тени (тень в meta/shadow, командир видит уровни).
- D11 (S, нед.6): настоящая миграция под флагом save2 — двойник 3–5 дней.
- D12 (S, пн 30.11): save2 ребёнку. D13 (через 2 нед.): чистка старых полей.

## Инварианты
merge-covers-fields; migrate-covers-fields; unlocked-monotone (sim прогоняет миграцию; unlocked, деңгей, ledger не убывают); schema-guard (CLIENT_SCHEMA = Save.version = v в rules); coins-idempotent. Закрывает cloud-size (после D9), часть data-clean (D13).

## Риски
Два устройства (rev + транзакция, первый план дня, id монет, объединение ответов); давняя копия Султана (3-стороннее слияние; устаревший клиент — отказ правил); офлайн; полночь (reload теряет отложенный push — pull сливает); исключения (pick3 по дню); старая версия (клиентская защита + minApp + правила + version.json); пустые данные (не побеждают, удаление запрещено, сброс только своего ключа); нет места (безопасные правила без базы); сдвиг часов (порядок по rev); активность Султана в аккаунте ребёнка попадает в usage — не учитывать экран commander.

## Открыто
Кто публикует правила (Султан после D1); публичный ли репозиторий (можно ли класть обезличенную фикстуру); почта двойника (+twin).
