// «Биткә түсіндір»: чистая логика без экрана (меню объяснений, кирпичики, итог) — её проверяют тесты.
import { TEACHBACK_BANK, type TeachBankEntry } from './teachback_bank';
import { MAX_TEACH_ROUNDS, type Verdict } from '../engine/helperPayload';

export type TeachResult = 'got' | 'partial' | 'skipped';
export type CardKind = 'good' | 'typical' | 'surface';
export interface MenuCard { kind: CardKind; text: string; why: string }

// запасные поверхностные объяснения (если у темы нет своего surface в банке): «так написано» без причины
export const TEACHBACK_SURFACE = [
  'Ережеде солай жазылған, сондықтан солай істейміз.',
  'Мұғалім солай айтты, соны жаттап алу керек.',
  'Солай шығады, себебін білудің қажеті жоқ.',
];
export const WHY_SURFACE = 'Мұнда себеп айтылмаған. «Солай жазылған» деген түсіндіру емес: неге солай екенін өз сөзіңмен айту керек.';

/** Число из строки темы: одна и та же тема всегда даёт один и тот же порядок карточек. */
// FNV-1a + перемешивание битов: простой h*31 по модулю 6 давал перекос (верная карточка чаще всего третья)
const hash = (s: string) => {
  let h = 2166136261;
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^ (h >>> 16)) >>> 0;
};
const ORDERS: CardKind[][] = [
  ['surface', 'good', 'typical'], ['typical', 'surface', 'good'], ['good', 'typical', 'surface'],
  ['typical', 'good', 'surface'], ['surface', 'typical', 'good'], ['good', 'surface', 'typical'],
];

export const bankFor = (skill: string): TeachBankEntry | undefined => TEACHBACK_BANK[skill];

/** Три карточки меню в фиксированном для темы порядке; null, если для темы нет заготовки. */
export function menuCards(skill: string): MenuCard[] | null {
  const e = bankFor(skill);
  if (!e) return null;
  const h = hash(skill);
  const all: Record<CardKind, MenuCard> = {
    good: { kind: 'good', text: e.good, why: '' },
    typical: { kind: 'typical', text: e.typical, why: e.whyTypical },
    surface: { kind: 'surface', text: e.surface ?? TEACHBACK_SURFACE[h % TEACHBACK_SURFACE.length], why: WHY_SURFACE },
  };
  return ORDERS[h % ORDERS.length].map(k => all[k]);
}

/** Вопрос Бита: из заготовки темы, иначе общий — по правилу. */
export function teachQuestion(skill: string): string {
  return bankFor(skill)?.q ?? 'Осы ережені өз сөзіңмен түсіндірші: не істейміз және не үшін?';
}

export const teachOpening = (q: string) => `Енді сен мұғалімсің! Маған түсіндірші: ${q}`;

/** Кирпичики: слова темы и несколько связок («себебі», «сондықтан»…); уже использованные не повторяем. */
export const CONNECT_BRICKS = ['себебі', 'сондықтан', 'емес', 'және'];
export function bricksFor(skill: string): string[] {
  return [...(bankFor(skill)?.bricks ?? []), ...CONNECT_BRICKS];
}
/** Добавить кирпичик в поле: через пробел, без двойных пробелов, в пределах max символов. */
export function addBrick(text: string, brick: string, max = 300): string {
  const base = text.replace(/\s+$/, '');
  const next = base ? `${base} ${brick}` : brick;
  return next.length > max ? text : next + ' ';
}

/** Итог для Lesson: меню — верно с первой попытки = «got», иначе «partial»; ИИ — «got» только при вердикте got. */
export function menuResult(misses: number): TeachResult { return misses === 0 ? 'got' : 'partial'; }
export function aiResult(verdict: Verdict): TeachResult { return verdict === 'got' ? 'got' : 'partial'; }

/** Раунд ИИ закончен: понял, или это был последний ответ. */
export const aiFinished = (verdict: Verdict, answers: number) => verdict === 'got' || answers >= MAX_TEACH_ROUNDS;

/** Почему вместо ИИ меню: короткая реплика Бита (HELPER_ERR написан под разбор задач практики и тут не годится). */
export const TEACH_FALLBACK: Record<string, string> = {
  sign_in: 'Бит-көмекші облакқа кіргенде ғана тыңдайды.',
  offline: 'Интернет жоқ сияқты.',
  quota: 'Бүгінге Биттің ИИ сұрақтары таусылды.',
  ai_unavailable: 'Бит қазір жауап бере алмады.',
};
