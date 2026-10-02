// КАРТА СИСТЕМ — единственное место, где описано, как механики связаны друг с другом и с учёбой.
// Правило проекта: новая механика (или поле сохранения) не добавляется в код, пока не вписана сюда со входами и выходами.
// Тест tests/systems.test.ts сверяет карту с кодом (файлы есть, каждое поле сохранения принадлежит механике),
// гоняет симулятор ученика (src/engine/sim.ts) и проверяет инварианты (src/engine/systems.ts).
// Отчёт и docs/SYSTEMS.md: `npm run systems`.
//
// Поля механики: id; name — по-русски; group — учёба / мотивация / прогресс / родитель / техника;
// kind — action (действие ребёнка), currency (валюта), progress (шкала), unlock (что открывается), rule (правило), loop (цикл), view (экран-отчёт);
// inputs / outputs — id механик; shown — кому видно: child / parent / both / none;
// code — главные файлы; data — поля сохранения (Save), которыми механика владеет; notes — что важно знать;
// root — ни из чего не следует (действие ребёнка); terminal — по замыслу ничего не открывает (итоговая награда или отчёт).

export const MECHANICS = [
  // ---------------- учёба ----------------
  { id: 'intro', name: 'Вступление-история', group: 'учёба', kind: 'action', root: true, inputs: [], outputs: ['diagnostic'], shown: 'child',
    code: ['src/screens/Intro.svelte', 'content/intro.mjs'], data: ['introSeen'] },
  { id: 'diagnostic', name: 'Код-сканер (диагностика)', group: 'учёба', kind: 'action', inputs: ['intro'], outputs: ['skill-status'], shown: 'child',
    code: ['src/screens/Diagnostic.svelte'], data: ['diagnosticDone'], notes: 'тема «знает» = 2 верных подряд; верный быстрее 3 с считается провалом; прогресс скана не сохраняется' },
  { id: 'plan', name: 'План дня (разминка, новая тема, смешанный бой, итог)', group: 'учёба', kind: 'loop', inputs: ['skill-status', 'recall'], outputs: ['lesson', 'battle', 'minutes', 'streak', 'boss', 'extra'], shown: 'child',
    code: ['src/engine/planner.ts', 'src/lib/session.svelte.ts', 'src/screens/Hub.svelte'], data: ['days'], notes: 'шаги идут «до N верных»; «Еске түсір» обязателен перед планом' },
  { id: 'lesson', name: 'Урок-тренировка', group: 'учёба', kind: 'action', inputs: ['plan'], outputs: ['skill-status', 'xp', 'technique', 'teachback', 'notebook'], shown: 'child',
    code: ['src/screens/Lesson.svelte', 'content/lessons.mjs'], data: ['lessonPos'], notes: 'ошибки урока в модель знаний не идут' },
  { id: 'teachback', name: '«Биткә түсіндір» (объясни тему)', group: 'учёба', kind: 'action', inputs: ['lesson'], outputs: ['analytics'], shown: 'child',
    code: ['src/lesson/TeachBack.svelte', 'helper/teachback.mjs'], notes: 'итог (понял / частично) ни на что, кроме журнала, не влияет' },
  { id: 'notebook', name: '«Дәптер» (карточка в тетради, проверка по фото)', group: 'учёба', kind: 'action', inputs: ['lesson'], outputs: ['recall', 'analytics'], shown: 'child',
    code: ['src/lesson/NotebookCard.svelte', 'helper/notebook.mjs'], data: ['notebook'] },
  { id: 'battle', name: 'Бой / практика (ответ на задачу)', group: 'учёба', kind: 'action', inputs: ['plan', 'extra', 'repair', 'boss'], outputs: ['skill-status', 'xp', 'coins', 'stars', 'minutes', 'repair', 'analytics'], shown: 'child',
    code: ['src/screens/Session.svelte', 'src/engine/rush.ts', 'src/engine/confidence.ts', 'src/engine/twin.ts'], data: ['attempts'],
    notes: 'внутри: уверенность, самопроверка, ход Глитча, разбор ошибки, задачи-близнецы, подсказки' },
  { id: 'skill-status', name: 'Знание темы (BKT, окно 85%, отложенная проверка)', group: 'учёба', kind: 'progress', inputs: ['battle', 'diagnostic', 'lesson'], outputs: ['plan', 'crystals', 'energy', 'boss', 'album'], shown: 'both',
    code: ['src/engine/progress.ts', 'src/engine/bkt.ts'], data: ['skills'], notes: 'проваленная проверка снимает кристалл (откат в «изучается»)' },
  { id: 'recall', name: '«Еске түсір» (вспомнить правило)', group: 'учёба', kind: 'action', inputs: ['notebook'], outputs: ['plan', 'xp', 'album', 'analytics'], shown: 'child',
    code: ['src/screens/Recall.svelte', 'src/engine/recall.ts'], data: ['recall', 'recallOffer'],
    notes: 'своё расписание (календарные дни) отдельно от отложенной проверки (учебные дни); «зачтено» (3 возврата) не влияет на знание темы' },
  { id: 'ai-helper', name: 'Бит-помощник «Түсінбедім» (ИИ)', group: 'учёба', kind: 'action', terminal: true, inputs: ['battle', 'lesson'], outputs: [], shown: 'child',
    code: ['src/lib/helper.ts', 'helper/server.mjs'], data: ['aiLog'] },

  // ---------------- мотивация ----------------
  { id: 'minutes', name: 'Минуты игры (реальная награда)', group: 'мотивация', kind: 'currency', terminal: true, inputs: ['plan', 'battle', 'extra', 'repair', 'commander'], outputs: [], shown: 'both',
    code: ['src/engine/planner.ts'], notes: 'до 60 за план + 15 за доп. миссию; доля «как на экзамене» (+1 / −¼ / 0)' },
  { id: 'extra', name: 'Доп. миссия', group: 'мотивация', kind: 'action', inputs: ['plan', 'repair'], outputs: ['battle', 'minutes'], shown: 'child',
    code: ['src/screens/Session.svelte', 'src/engine/planner.ts'], notes: 'засчитывается при 7 верных с первой попытки из 10; при ≥3 поломках — ремонтная' },
  { id: 'repair', name: 'Поломки корабля и ремонт', group: 'мотивация', kind: 'loop', inputs: ['battle'], outputs: ['ship', 'battle', 'extra', 'minutes', 'coins'], shown: 'child',
    code: ['src/engine/repair.ts', 'src/screens/Album.svelte'], data: ['repairShop', 'shipChestFixed'], notes: 'поломка — любая ошибка, не устаревает; починка сегодняшней ошибки возвращает минуты' },
  { id: 'ship', name: 'Прочность корабля', group: 'мотивация', kind: 'progress', inputs: ['repair'], outputs: ['coins'], shown: 'both',
    code: ['src/engine/repair.ts', 'src/screens/Hub.svelte'], notes: 'с 7 поломок монеты вдвое; целый корабль после 5 починок — сундук' },
  { id: 'coins', name: 'Монеты (тиын)', group: 'мотивация', kind: 'currency', inputs: ['battle', 'boss', 'repair', 'ship'], outputs: ['workshop'], shown: 'child',
    code: ['src/lib/ship.svelte.ts', 'content/ship_items.mjs'], data: ['coins'] },
  { id: 'workshop', name: 'Мастерская корабля (декор, питомцы)', group: 'мотивация', kind: 'unlock', terminal: true, inputs: ['coins'], outputs: [], shown: 'child',
    code: ['src/screens/Workshop.svelte', 'content/ship_items.mjs'], data: ['shipOwned', 'shipPet'], notes: '22 предмета на 2235 монет — конечный каталог' },
  { id: 'xp', name: 'Опыт (XP)', group: 'мотивация', kind: 'currency', inputs: ['battle', 'lesson', 'recall', 'boss'], outputs: ['level'], shown: 'child',
    code: ['src/screens/Session.svelte', 'src/screens/Lesson.svelte'], data: ['xp'], notes: 'даётся и за верный ответ наспех' },
  { id: 'level', name: 'Уровень героя', group: 'мотивация', kind: 'progress', inputs: ['xp'], outputs: [], shown: 'child',
    code: ['src/engine/level.ts', 'src/screens/Hub.svelte'], notes: 'ничего не открывает: только окно «Жаңа деңгей»' },
  { id: 'stars', name: 'Звёзды шагов', group: 'мотивация', kind: 'currency', inputs: ['battle'], outputs: ['star-rewards', 'coins'], shown: 'child',
    code: ['src/screens/Session.svelte', 'src/lib/look.ts'], data: ['levelStars'], notes: 'levelStars пишется, но нигде не читается; звёзды босса не засчитываются' },
  { id: 'star-rewards', name: 'Награды за звёзды (след, плащ)', group: 'мотивация', kind: 'unlock', terminal: true, inputs: ['stars'], outputs: [], shown: 'child',
    code: ['content/worlds.mjs', 'src/screens/Hero.svelte'], data: ['style'], notes: 'все 8 наград — за 45 звёзд (1–2 недели)' },
  { id: 'streak', name: 'Серия дней', group: 'мотивация', kind: 'progress', inputs: ['plan', 'commander'], outputs: ['hero-stats'], shown: 'both',
    code: ['src/engine/streak.ts'], notes: 'заморозки: 2 на всю серию (комментарий обещает 2 в месяц), ребёнок их не видит' },

  // ---------------- прогресс по миру ----------------
  { id: 'crystals', name: 'Кристаллы (темы, прошедшие проверку)', group: 'прогресс', kind: 'progress', inputs: ['skill-status'], outputs: ['energy', 'outfits', 'hero-stats'], shown: 'child',
    code: ['src/lib/look.ts'], notes: 'показаны в 5 местах; при проваленной проверке отнимаются' },
  { id: 'energy', name: 'Энергия Кода', group: 'прогресс', kind: 'progress', inputs: ['skill-status', 'crystals'], outputs: ['worlds'], shown: 'child',
    code: ['content/worlds.mjs', 'src/screens/Map.svelte'], notes: 'на корабле портал светится по другой формуле (изученные темы mod 10)' },
  { id: 'worlds', name: 'Миры на карте', group: 'прогресс', kind: 'unlock', inputs: ['energy', 'boss'], outputs: ['boss'], shown: 'child',
    code: ['content/worlds.mjs', 'src/lib/look.ts', 'src/screens/Map.svelte'], data: ['world', 'worldsCleared'], notes: 'мир только меняет небо и монстров; при потере энергии может закрыться снова' },
  { id: 'boss', name: 'Бас жау (босс мира)', group: 'прогресс', kind: 'action', inputs: ['plan', 'worlds', 'skill-status'], outputs: ['worlds', 'battle', 'xp', 'coins'], shown: 'child',
    code: ['src/screens/Map.svelte', 'src/screens/Session.svelte'], notes: 'одна попытка в день; условие «босс готов» записано в двух местах по-разному' },
  { id: 'arena', name: 'Арена «Жарық» (пробники)', group: 'прогресс', kind: 'unlock', inputs: [], outputs: [], shown: 'child',
    code: ['content/worlds.mjs', 'src/lib/look.ts'], notes: 'всегда закрыта: режима пробников нет' },
  { id: 'outfits', name: 'Костюмы героя', group: 'прогресс', kind: 'unlock', terminal: true, inputs: ['crystals'], outputs: [], shown: 'child',
    code: ['content/worlds.mjs', 'src/screens/Hero.svelte', 'src/engine/legacy.ts'], data: ['outfit', 'prog'],
    notes: 'снимок открытого prog.legacy только растёт (02.10): открытый костюм, плащ, мир больше не закрываются' },
  { id: 'hero-stats', name: 'Статы и ранги героя (Күш, Ақыл, Дәлдік, Табандылық)', group: 'прогресс', kind: 'progress', inputs: ['crystals', 'skill-status', 'battle', 'streak'], outputs: [], shown: 'child',
    code: ['src/screens/Hero.svelte'], notes: 'ранги ничего не открывают' },
  { id: 'technique', name: 'Приёмы (тәсіл) тем', group: 'прогресс', kind: 'unlock', inputs: ['lesson'], outputs: ['album', 'battle'], shown: 'child',
    code: ['content/techniques.mjs', 'src/lesson/TechCard.svelte'], notes: 'только вид и цвет удара' },
  { id: 'album', name: 'Альбом (карты тем, Дәптер, ремонт)', group: 'прогресс', kind: 'view', terminal: true, inputs: ['skill-status', 'recall', 'technique', 'repair'], outputs: [], shown: 'child',
    code: ['src/screens/Album.svelte'] },

  // ---------------- родитель ----------------
  { id: 'commander', name: 'Экран командира (Султан)', group: 'родитель', kind: 'view', inputs: ['analytics', 'skill-status', 'plan'], outputs: ['minutes', 'streak', 'settings'], shown: 'parent',
    code: ['src/screens/Commander.svelte'], data: ['kzReview'], notes: 'подарки +10/+15 мин без лимита; если PIN не задан, его может придумать ребёнок' },
  { id: 'settings', name: 'Настройки (имя героя, доп. миссии, голос, фото)', group: 'родитель', kind: 'rule', terminal: true, inputs: ['commander'], outputs: [], shown: 'parent',
    code: ['src/screens/Commander.svelte', 'src/lib/store.svelte.ts'], data: ['settings', 'heroName'], notes: 'settings.planMinutes нигде не читается' },
  { id: 'analytics', name: 'Аналитика поведения', group: 'родитель', kind: 'view', inputs: ['battle', 'lesson', 'teachback', 'notebook', 'recall'], outputs: ['commander'], shown: 'parent',
    code: ['src/lib/track.svelte.ts', 'src/engine/analytics.ts'], data: ['usage'] },

  // ---------------- техника ----------------
  { id: 'storage', name: 'Сохранение и облако', group: 'техника', kind: 'rule', root: true, terminal: true, inputs: [], outputs: [], shown: 'none',
    code: ['src/lib/store.svelte.ts', 'src/lib/cloud.svelte.ts', 'src/engine/sync.ts'], data: ['version', 'updatedAt', 'lastBackup'] },
  { id: 'legacy', name: 'Устаревшие поля (таймер игры до 30.09)', group: 'техника', kind: 'rule', root: true, terminal: true, inputs: [], outputs: [], shown: 'none',
    code: ['src/engine/types.ts'], data: ['weekendSpent'], notes: 'остались в старых сохранениях; удалить миграцией' },
];

/** Понятия, которые должны иметь ОДНО определение. Каждая строка defs — отдельное место, где понятие считается по-своему. */
export const RULES = [
  { id: 'fast', name: 'быстро / наугад', defs: [
    { where: 'src/engine/rush.ts + Session.svelte', how: '2,5–8 с по длине условия, личный порог 5–25 с только для неверных' },
    { where: 'src/engine/answers.ts (Commander «Ответы»)', how: 'фиксированные 5 с' },
    { where: 'src/screens/Recall.svelte', how: 'isHonest по умолчанию: 5 с' },
    { where: 'src/screens/Diagnostic.svelte', how: 'верно только если дольше 3 с' },
    { where: 'src/screens/Commander.svelte «Сегодня»', how: '«угадываний» = !honest, подпись «быстрее 5 сек»' },
  ] },
  { id: 'accuracy', name: 'точность', defs: [
    { where: 'src/screens/Hero.svelte «Дәлдік»', how: 'честные без подсказки за 14 дней, от 10 ответов' },
    { where: 'src/screens/Summary.svelte «дәлдік»', how: 'все попытки дня, включая близнецов и вспоминание' },
    { where: 'src/screens/Session.svelte звёзды', how: 'верные с первой попытки в бою' },
    { where: 'src/screens/Commander.svelte', how: '«верно с первой попытки» и «верно / честно»' },
  ] },
  { id: 'schedule', name: 'расписание повторения темы', defs: [
    { where: 'src/engine/progress.ts INTERVALS', how: '1, 3, 7, 16, 35 учебных дней' },
    { where: 'src/engine/recall.ts GAPS', how: '1, 2, 4, 7, 16, 30, 45, 60 календарных дней' },
    { where: 'src/engine/recall.ts WINDOWS (подписи в Альбоме)', how: '1, 3–4, 7–10, 14–21, 30–45 дней' },
  ] },
  { id: 'mastered', name: '«меңгерілді» (тема освоена)', defs: [
    { where: 'src/engine/progress.ts', how: 'статус mastered после отложенной проверки (кристалл)' },
    { where: 'src/engine/recall.ts isCredited', how: '3 чистых вспоминания' },
    { where: 'src/screens/Lesson.svelte', how: '«МЕҢГЕРІЛДІ!» — приём урока после финала' },
  ] },
  { id: 'energy', name: 'энергия', defs: [
    { where: 'content/worlds.mjs codeEnergy', how: 'изучена +1, освоена +2' },
    { where: 'src/screens/Hub.svelte setEnergy', how: 'изученные темы mod 10' },
  ] },
  { id: 'honest', name: '«честный ответ» и «доля честных»', defs: [
    { where: 'src/screens/Session.svelte (ответ)', how: 'не свёрнуто > 3 с, не быстрее порога спешки, без полного разбора' },
    { where: 'src/screens/Recall.svelte', how: 'жёсткие 5 с, свёрнутое приложение не учитывается' },
    { where: 'src/screens/Session.svelte звёзды', how: 'honestShare = (ответы − наспех) / ответы' },
    { where: 'DayRecord.honest', how: 'на деле балл «как на экзамене» (+1 / −¼ / 0), а не доля честных' },
    { where: 'src/engine/analytics.ts «честно %»', how: 'доля honest=true вместе с задачами вспоминания' },
  ] },
  { id: 'progress-store', name: 'где хранится «тема пройдена / изучена»', defs: [
    { where: 'skills[].lessonDone / learnedAt', how: 'урок пройден, дата изучения' },
    { where: 'recall[id].learnedDay', how: 'дата для «Еске түсір»' },
    { where: 'notebook[id].day', how: 'дата карточки «Дәптер»' },
  ] },
  { id: 'half-coins', name: 'половинные монеты при поломках', defs: [
    { where: 'src/engine/confidence.ts HALF_COINS_OVER', how: '> 6' },
    { where: 'src/engine/repair.ts COINS_HALF_FROM', how: '≥ 7' },
  ] },
  { id: 'boss-ready', name: 'босс доступен', defs: [
    { where: 'src/screens/Hub.svelte', how: 'будни, план, ≥3 изученных, мир не пройден, не пробовал' },
    { where: 'src/screens/Map.svelte', how: 'будни, план, ≥3 изученных, не пробовал (без «мир не пройден»)' },
  ] },
];

/** Мёртвые поля сохранения (опись данных 02.10): пишутся, но не читаются; читаются, но не пишутся; устаревшие.
 *  Убрал поле или начал его использовать — вычеркни строку (проверка data-clean). */
export const FIELD_ISSUES = [
  { field: 'settings.planMinutes', issue: 'пишется, нигде не читается (план — 36 мин весом блоков)' },
  { field: 'levelStars', issue: 'пишется, нигде не читается; дублирует days[].stars' },
  { field: 'skills[].correct', issue: 'пишется, нигде не читается; дублирует историю ответов' },
  { field: 'repairShop[].source / .tag', issue: 'пишутся, ремонт берёт только тему' },
  { field: 'recall[].history[].task', issue: 'пишется, нигде не читается' },
  { field: 'recall[].learnedDay', issue: 'читается только при создании; дублирует skills[].learnedAt и notebook[].day' },
  { field: 'notebook[].check.fix / .tries / .at', issue: 'пишутся, нигде не читаются' },
  { field: 'aiLog[].at', issue: 'пишется, нигде не читается' },
  { field: 'usage[].screens', issue: 'пишется каждые 5 с, нигде не читается' },
  { field: 'usage events mic / finalMiss', issue: 'пишутся, аналитика их не показывает' },
  { field: 'recallOffer[].skipped', issue: 'читается командиром, но с 02.10 не пишется (пропуска нет)' },
  { field: 'attempts[].mode lesson/diagnostic/mock', issue: 'такие значения не пишутся никогда: ошибки урока и диагностики не попадают в историю' },
  { field: 'attempts[].selfCheck / .kind', issue: 'пишутся, но не объявлены в типе Attempt' },
  { field: 'weekendSpent, days[].spent, bonuses[].mastery', issue: 'устаревшие (таймер игры и бонусы за освоение убраны)' },
];

/** Нарушенные сейчас инварианты (src/engine/systems.ts). Починил — вычеркни отсюда; тест требует точного совпадения. */
export const KNOWN_RED = [
  'map-inputs',          // арена: ничего не открывает её
  'map-outputs',         // уровень героя, статы и ранги, «Биткә түсіндір» (только журнал) — растут, но ничего не открывают
  'one-rule',            // 7 понятий определены по-разному в разных местах
  'coins-sink',          // магазин выкупается за ~5 недель
  'stars-sink',          // все награды за звёзды — за 1–2 недели
  'outfits-reachable',   // последний костюм требует 45 кристаллов, тем с уроками меньше
  'worlds-reachable',    // мирам 9–11 нужно больше энергии, чем даёт контент
  'arena-reachable',     // нет режима пробников
  'ship-recoverable',    // поломки копятся быстрее, чем их можно чинить
  'cloud-size',          // главный документ облака к экзамену ≈ 1 МБ (предел Firestore)
  'data-clean',          // мёртвые и устаревшие поля сохранения (FIELD_ISSUES)
];
