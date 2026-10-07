export type Status = 'locked' | 'available' | 'learning' | 'learned' | 'mastered' | 'automatic';
// learned — «үйренді» (p ≥ 0,95), mastered — «меңгерді» (прошёл отложенную проверку),
// automatic — «автоматизм» (несколько успешных повторений).

export interface SkillState {
  p: number;
  status: Status;
  lessonDone: boolean;
  learnedAt?: string;        // дата «үйренді»
  strict?: boolean;          // выучена по порогу «85% с первой попытки в окне 15–20» (01.10); у старых тем флага нет — их судит окно, см. progress.ts
  due?: string;              // дата следующей проверки/повторения
  stage: number;             // ступень интервального повторения
  attempts: number;
  correct: number;
  misconceptions: Record<string, number>;
}

export interface Attempt {
  at: number;                // ms
  day: string;
  skill: string;
  source: string;            // template id или bank id
  correct: boolean;
  confidence?: 'sure' | 'maybe' | 'unsure';
  hintLevel: number;
  honest: boolean;
  timeMs: number;
  fast?: boolean;            // быстрее порога для длины условия (src/engine/rush.ts); в старых сохранениях поля нет
  away?: number;             // сколько мс приложение было свёрнуто во время задачи, с 02.10
  closed?: boolean;          // свернул дольше AWAY_CLOSE_MS (src/engine/rules.ts: isClosed) — для модели знаний это ошибка
  r?: 2;                     // версия правил (rules.ts RULES_V): с ней ответ судит forModel; без неё — прежний фильтр honest
  tag?: string;              // метка выбранной ошибки
  mode: 'lesson' | 'practice' | 'warmup' | 'mixed' | 'boss' | 'diagnostic' | 'extra' | 'mock' | 'recall';   // recall — задача после «Еске түсір» (в модель не идёт)
}

export interface DayRecord {
  date: string;
  blocksDone: Record<string, boolean>;
  planShare: number;
  minutesToday: number;
  minutesWeekend: number;
  extraMissions: number;
  /** Ответы шага за день, включая брошенные бои (02.10): выйти и начать заново больше не обнуляет плохой результат. */
  tally?: Record<string, { n: number; paid: number; wrong: number }>;
  bossTried?: boolean;       // бой с бас жау сегодня уже был (одна попытка в день, 02.10)
  awayCard?: boolean;        // карточка правила «свернул > 5 с» сегодня уже показана (раз в день, Session.svelte)
  extraHonest?: number;      // сумма долей честных ответов по доп. миссиям дня (минуты = 15 × сумма), Session.svelte finish()
  bonuses: { reason: string; minutes: number; mastery?: boolean }[];
  hard?: string; // «что было трудно» из итога дня (id темы или 'none') — для командира
  exception?: 'sick' | 'holiday' | 'vacation';
  spent?: number;            // устарело: таймер игры убран 30.09 (время выдают вне игры), поле осталось в старых сохранениях
  stars?: Record<string, number>; // звёзды уровней дня (id шага → 1..3), GAME_LOOP.md 5
  coins?: number;            // монеты, заработанные за день (для итога дня), GAME_LOOP.md 5, src/lib/ship.svelte.ts
  /** План дня, собранный утром: после перезагрузки страницы день продолжается по нему, а не по заново собранному
   *  (иначе пройденный день снова показывал «2/4», минуты и серия дней уменьшались). */
  plan?: import('./planner').Plan;
  /** Доля честных ответов шага (0..1): минуты шага умножаются на неё (research D1, 30.09). Нет записи — 1 (урок, старые сохранения). */
  honest?: Record<string, number>;
  /** Минуты по новому правилу (D2, src/engine/minutes.ts). Пока «в тени»: считаются параллельно со старыми и видны только командиру. */
  mins?: MinDay;
}

// ---------- Минуты по новому правилу «точность стоит, труд возвращает» (src/engine/minutes.ts) ----------
/** Чем стал ответ для минут: верный (+1), «Білмеймін» (0), верный наспех (0), неверный (−¼), свернул (−¼), вне счёта. */
export type MinKind = 'right' | 'wrong' | 'dunno' | 'rush' | 'away' | 'void';
export interface MinSlot { k: MinKind; at: number; src: string; skill: string }
export interface MinCredit { at: number; min: number; via: 'full' | 'cap' | 'stop' | 'sick'; wk: number }
export interface MinDay {
  planN: number;                       // сколько задач в плане дня
  slots: Record<string, MinSlot>;      // слот на каждый ответ плана, по id (повторная запись ничего не меняет)
  honestMs: Record<string, number>;    // честное время по устройствам; между устройствами складывается
  hid?: Record<string, 0 | 1>;         // id ответов, чьё время уже внесено (1 — верный честный): защита от двойного вызова
  credit?: MinCredit;                  // начисление, один раз и неизменно (пока в тени не пишется)
  extra?: MinDay;                      // доп. миссия
}
/** Долг ремонта: потерянное возвращают верные близнецы (need: ошибка и «свернул» — 2, остальное — 1). */
export interface MinDebt {
  id: string; skill: string; src: string; k: 'wrong' | 'away' | 'dunno' | 'rush'; need: 1 | 2; got: number;
  day: string; at: number;
  explained?: boolean;                 // у «Білмеймін» сначала объяснение
  carried?: boolean;
  by?: string[];                       // id ответов-близнецов, которые закрыли долг (got не больше их числа)
  tr?: string[];                       // попытки ремонта: `${день}|${id ответа}` (не больше repairTries в день)
}

/** PIN командира (src/engine/pin.ts): хэш PBKDF2, соль, число итераций, когда задан (на двух устройствах побеждает больший setAt). */
export interface PinRec { hash: string; salt: string; iter: number; setAt: number; weak?: true }   // weak — задан без пароля облака (устройство без входа): при слиянии уступает PIN, заданному с паролем

export interface Settings {
  extraMissionCap: number;          // сколько доп. миссий в день
  extraTo: 'today' | 'weekend';
  planMinutes: number;
  pin?: string | PinRec;           // PIN командира: PBKDF2 с солью; строка — старый SHA-256 (до 05.10), заменяется при первом верном вводе
  voiceInput?: boolean;             // кнопка «Айтып бер» (голосовой ввод); нет поля = включено
  notebookPhoto?: boolean;          // «Дәптер»: Бит проверяет фото карточки; нет поля = включено
}

export interface Save {
  version: 1;
  heroName: string;
  xp: number;
  skills: Record<string, SkillState>;
  attempts: Attempt[];
  days: Record<string, DayRecord>;
  settings: Settings;
  diagnosticDone: boolean;
  introSeen?: boolean;
  lastBackup?: string; // дата последней копии в файл
  updatedAt?: number;  // время последнего изменения (для облачной синхронизации)
  world?: string;          // текущий мир (content/worlds.mjs)
  worldsCleared?: string[]; // миры, где побеждён босс
  outfit?: string;         // костюм героя (путь наград)
  // block / dunno — ошибка сегодняшнего шага плана (02.10): её честная починка в тот же день возвращает минуты шага (restoreFix)
  repairShop: { source: string; skill: string; tag?: string; addedDay: string; fixed?: boolean; block?: string; dunno?: boolean }[];
  shipChestFixed?: number;   // сколько починенных поломок уже «потрачено» на сундук за целый корабль (src/engine/repair.ts: claimShipChest)
  kzReview?: Record<string, 'ok' | 'fix'>;   // проверка казахских текстов носителем
  weekendSpent?: Record<string, number>;      // устарело вместе с таймером игры (30.09)
  /** Где остановился в уроке — «Жалғастыру». final — состояние «Соңғы сынақ» (L2, src/lesson/finalTask.ts): та же задача и ответ после выхода и входа,
   *  чтобы одна попытка не превращалась в сколько угодно. */
  lessonPos?: { skill: string; step: number; final?: { task: { kz: string; choices: string[]; answer: number; why: string; tags: string[] } | null; res?: 'won' | 'missed' | 'closed'; pick?: number } };
  levelStars?: Record<string, number>;
  style?: { trail?: string; cape?: string };  // выбранные награды за звёзды (STAR_REWARDS)       // лучшие звёзды уровня-темы (id темы → 1..3)
  coins?: number;                             // монеты («тиын»): за ответы и врагов, тратятся в мастерской корабля (src/lib/ship.svelte.ts)
  shipOwned?: string[];                       // id купленных украшений и питомцев (content/ship_items.mjs)
  shipPet?: string | null;                    // активный питомец (один) или null
  aiLog?: AiTurn[];                           // вопросы к ИИ-помощнику (видит командир), последние 100
  usage?: UsageDay[];                         // поведение по дням (src/lib/track.svelte.ts): время, ранние нажатия, шаги урока — для аналитики командира
  // «Еске түсір»: возвраты к правилу темы по расписанию (src/engine/recall.ts)
  recall?: Record<string, RecallState>;
  // день → какие темы предложили утром и нажали ли «Өткізу» (видит командир)
  recallOffer?: Record<string, { skills: string[]; skipped?: boolean }>;
  // «Дәптер»: что сделано на карточке темы после урока (src/lesson/NotebookCard.svelte)
  notebook?: Record<string, NotebookEntry>;
  // прогрессия «Жаңа жүйе» (docs/systems/DESIGN.md, specs/progression.md); пока только снимок открытого (src/engine/legacy.ts)
  prog?: Prog;
  // исключения командира диапазоном дат (болезнь, праздник): src/engine/exceptions.ts; слияние по id, удалённое остаётся могилой
  exceptions?: import('./exceptions').ScheduleException[];
  // долги ремонта минут по новому правилу (D2, src/engine/minutes.ts); верхний уровень — переживает смену дня; слияние по id
  debts?: Record<string, MinDebt>;
}

/** Прогрессия. legacy — всё открытое в старой системе (только растёт): костюмы, плащи и следы, миры, купленное. */
export interface Prog { legacy?: ProgLegacy }
export interface ProgLegacy { day: string; outfits: string[]; styles: string[]; worlds: string[]; cleared: string[]; owned: string[] }

/** Один возврат к правилу: ok — собрал правило верно; hint — подсказка (0 нет, 1 первое слово, 2 скелет, 3 показали правило: не засчитывается);
 *  conf — уверенность до показа (1 не знаю, 2 шамамен, 3 сенімдімін); task — решил ли задачу темы после сверки. */
export interface RecallEntry { day: string; ok: boolean; hint: 0 | 1 | 2 | 3; conf: 1 | 2 | 3; task?: boolean }
/** step — сколько верных возвратов без подсказки подряд (минус откаты); зачтена при step ≥ 3. due — дата следующего возврата. */
export interface RecallState { learnedDay: string; step: number; due: string; history: RecallEntry[] }
/** exampleOk: true/false — игра проверила «мой пример» вычислением; null — проверить нельзя, записано как есть. */
/** check — проверка фото карточки Битом (helper/notebook.mjs): отметки полей rule/example/trap/scheme, что исправить, сколько раз снимали. */
export interface NotebookEntry {
  day: string; wrote?: boolean; example?: string; exampleOk?: boolean | null;
  check?: { at: number; readable: boolean; marks: Record<string, 'ok' | 'partial' | 'wrong' | 'missing'>; fix: string; tries: number };
}

export interface AiTurn { at: number; day: string; skill: string; task: string; q: string; a: string; voice?: boolean }   // voice — ребёнок надиктовал, а не напечатал

// ---------- Поведение (src/lib/track.svelte.ts → аналитика командира src/engine/analytics.ts) ----------
/** Шаг урока: сколько на нём был (ms), сколько было нужно на чтение (need, 0 — шаг не читательский), ранних нажатий «дальше» (nope),
 *  сколько приложение было свёрнуто (away), дошёл ли до конца шага (done: false — ушёл из урока на этом шаге). */
export interface StepLog { at: number; skill: string; i: number; type: string; ms: number; need: number; nope: number; away: number; done: boolean }
/** Разбор ошибки в практике (ReviewPanel): время и ранние нажатия. */
export interface ReviewLog { at: number; skill: string; ms: number; nope: number }
/** Прочие события: teach (итог «Биткә түсіндір»), mic (голосовой ввод), finalMiss (промах в «Соңғы сынақ») и т. п. */
export interface UsageEvent { at: number; k: string; skill?: string; v?: string; n?: number }
export interface UsageDay {
  day: string;
  activeMs: number;                 // приложение на экране и было касание за последнюю минуту
  awayMs: number;                   // свёрнуто посреди урока, задачи или вспоминания
  sessions: number;                 // заходов (перерыв больше 30 мин — новый заход)
  firstAt: number; lastAt: number;  // первое и последнее касание дня
  screens: Record<string, number>;  // активное время по экранам, ms
  nope: Record<string, number>;     // ранние нажатия по местам (lesson:rule, review, recall, notebook…)
  exits: Record<string, number>;    // ушёл посреди: lesson, session, recall
  steps: StepLog[];
  reviews: ReviewLog[];
  events: UsageEvent[];
}
