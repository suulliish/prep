// Уверенность в бою (docs/GAME_LOOP.md 20): после выбора варианта ребёнок говорит «Сенімдімін» или «Шамамен», и у слова есть цена.
// Чистый модуль без Svelte: таблица цен, порядок кнопок, длительность события, итог калибровки и тексты. Экран: src/screens/Session.svelte.
// Урон по монстру всегда 1 («пусть всё решает ответ»): уверенность меняет только вид удара, щит героя, серию и монету.

export type Conf = 'sure' | 'maybe' | 'unsure';   // unsure — «Білмеймін» (честный выход)
/** Событие на весь экран: crit — удар с разворотом, hit — обычный удар, hold — щит держит, break — щит разбит, counter — контрудар по Глитчу. */
export type EventKind = 'crit' | 'hit' | 'hold' | 'break' | 'counter';

/** Цена каждого сочетания «верно или нет × уверенность». Білмеймін события не имеет: сразу разбор. */
export const PRICE = {
  sure: { right: 'crit', wrong: 'break' },
  maybe: { right: 'hit', wrong: 'hold' },
} as const satisfies Record<'sure' | 'maybe', { right: EventKind; wrong: EventKind }>;

export function eventOf(correct: boolean, conf: Conf): EventKind | null {
  if (conf === 'unsure') return null;
  return PRICE[conf][correct ? 'right' : 'wrong'];
}

/** Серию рвёт только ошибка при полной уверенности: «шамамен» и «білмеймін» честны, их наказывать нельзя. */
export const breaksCombo = (correct: boolean, conf: Conf) => !correct && conf === 'sure';

/** Бонусная монета за верный ответ при уверенности (сверх обычной). Без подсказок и не за слишком быстрый ответ. */
export const CRIT_COINS = 1;
export const critCoins = (correct: boolean, conf: Conf, hintLevel: number, fast: boolean) =>
  correct && conf === 'sure' && hintLevel === 0 && !fast ? CRIT_COINS : 0;

/** Сколько держится событие (мс): ожидаемое время анимации боя; полоска внизу идёт ровно столько. «Уменьшить движение» — короче. */
export const EVENT_MS: Record<EventKind, number> = { crit: 2100, hit: 1900, hold: 2300, break: 2700, counter: 2100 };
export const EVENT_MS_REDUCED = 1200;
export const eventMs = (k: EventKind, reduce: boolean) => (reduce ? EVENT_MS_REDUCED : EVENT_MS[k]);
/** Дольше этого бой не ждёт (страховка от зависшей анимации). */
export const EVENT_CAP_MS = 9000;

/** Порядок двух кнопок уверенности: true — «Сенімдімін» слева. Случайно, но не больше двух раз подряд в одну сторону (иначе ребёнок привыкнет к месту). */
export function nextSureFirst(history: boolean[], rand: () => number = Math.random): boolean {
  const n = history.length;
  if (n >= 2 && history[n - 1] === history[n - 2]) return !history[n - 1];
  return rand() < 0.5;
}

// ---------- итог боя: калибровка ----------
export interface Calib { sure: number; sureRight: number }

/** Число 0..10 в форме исходного падежа: «10-нан», «5-тен», «7-ден», «6-дан» (окончание по звучанию слова: он, бес, жеті, алты). */
export function kzFrom(n: number): string {
  const suf = n === 10 ? 'нан' : [3, 4, 5].includes(n) ? 'тен' : [6, 9].includes(n) ? 'дан' : 'ден';
  return `${n}-${suf}`;
}

/** Строка итога: «10-нан 7 дұрыс». Уверенных ответов меньше 5 — считаем по-честному в штуках («3-тен 2»), а не растягиваем на 10: три ответа десять не заменят. */
export function calibOf(c: Calib): { of: number; right: number; ratio: number; scaled: boolean } | null {
  if (c.sure <= 0) return null;
  const ratio = c.sureRight / c.sure;
  if (c.sure < 5) return { of: c.sure, right: c.sureRight, ratio, scaled: false };
  return { of: 10, right: Math.round(ratio * 10), ratio, scaled: true };
}
export function calibLine(c: Calib): string | null {
  const x = calibOf(c);
  return x ? `${kzFrom(x.of)} ${x.right} дұрыс` : null;
}

// ---------- тексты (казахский; детям) ----------
export const CONF_SAY = {
  sure: { title: 'Сенімдімін', price: '⚔ қатты соққы · қате болса, қалқан сынады' },
  maybe: { title: 'Шамамен', price: '🛡 қалыпты соққы · қалқан ұстайды' },
  dunno: 'Білмеймін — бірге қарайық',
  ask: 'Қаншалықты сенімдісің?',
} as const;

export const EVENT_SAY: Record<EventKind, { big: string; small: string; tone: 'gold' | 'white' | 'cyan' | 'red' }> = {
  crit: { big: 'КРИТ!', small: 'Сенімді едің және дұрыс!', tone: 'gold' },
  hit: { big: 'ДӘЛ!', small: 'Дұрыс жауап', tone: 'white' },
  hold: { big: 'ҚАЛҚАН', small: 'Шамамен дедің: қалқан ұстады', tone: 'cyan' },
  break: { big: 'ҚАЛҚАН СЫНДЫ!', small: 'Сенімді едің, бірақ қате. Серия үзілді', tone: 'red' },
  counter: { big: 'ҚАРСЫ СОҚҚЫ!', small: 'Глитчтің қатесін таптың', tone: 'gold' },
};

export const REVIEW_SAY = {
  sureWrong: 'Сенімді едің, демек бір жерде жаңылыстың.',
  find: 'Қате қай жолдан басталды? Түрт.',
  why: 'Қателігің не? Дұрыс түсіндірмені таңда.',
  gap: 'Жарайды, бірге қарайық. «Білмеймін» деу — қате емес. Бос орынға не тұрады?',
  gapErr: 'Шешуді бірге қарайық. Бос орынға не тұрады?',
  read: 'Жарайды, бірге қарайық. Шешуді оқы — сосын жаңа есеп.',
  readErr: 'Шешуді оқы — сосын жаңа есеп.',
  yourAnswer: 'Сенің жауабың',
  fixed: 'Дұрысы',
  gapDone: 'Дұрыс! Шешуді түсіндің.',
  whyDone: 'Дұрыс! Келесі жолы осыны тексер.',
  next: 'Жаңа есеп →',
  ask: 'Түсінбедім — Биттен сұра',
} as const;

/** Мини-экран быстрого ответа: «2 секундта жауап бердің — бір қадамын бірге жасайық». */
export const rushSec = (timeMs: number) => Math.max(1, Math.round(timeMs / 1000));
export const rushLine = (timeMs: number) => `${rushSec(timeMs)} секундта жауап бердің — бір қадамын бірге жасайық.`;
export const RUSH_STEP = { check: 'Сұрақ не туралы?', checkWrong: 'Жоқ, тағы қара: сұрақтың соңында не сұралған?', done: 'Дұрыс! Енді өзің шеш — сандары басқа.', read: 'Сұрақты соңына дейін оқып шықтың ба?', readBtn: 'Оқыдым' } as const;
export const TWIN_TAG = 'ЕГІЗ ЕСЕП';
