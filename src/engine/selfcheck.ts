// Самопроверка «Тексер» на лёгких темах (docs/GAME_LOOP.md 20, «Строже по качеству»): после выбора варианта и до уверенности ребёнок проверяет себя,
// а не получает подсказку. Чистый модуль без Svelte. Экран: src/ui/SelfCheck.svelte, ход боя: src/screens/Session.svelte.
// Подсказка говорит только о ДЕЙСТВИИ проверки («умножил — раздели»), числа и верный вариант не называет.
import type { Item } from './items';

/** «Лёгкая» тема: выучена (learned / mastered / automatic) либо урок пройден и p ≥ 0,9 (мальчик её знает, ошибки там — от спешки). */
export const EASY_P = 0.9;
const DONE = ['learned', 'mastered', 'automatic'];
export const isEasySkill = (st?: { status: string; lessonDone?: boolean; p: number } | null): boolean =>
  !!st && DONE.includes(st.status);

/** Самопроверка не чаще одного раза в 2 вопроса, не на лёгкой теме её нет, не на боссе, не в ходе Глитча и не после полного разбора (подсказка 4/4). */
export const SELF_GAP = 2;
export const SELF_CATCH_COINS = 0;   // 02.10: было 3 — нарочно выбрать неверное и «поймать» себя выходило выгоднее верного ответа
export function selfCheckDue(a: { served: number; lastAt: number; easy: boolean; block: string; glitch: boolean }): boolean {
  return a.easy && a.block !== 'boss' && !a.glitch && a.served - a.lastAt >= SELF_GAP;
}

export type CheckOp = 'mul' | 'div' | 'add' | 'sub';
export interface SelfCheck { kind: 'reverse' | 'general'; op: CheckOp | null; text: string }

export const SELF_SAY = {
  title: 'Тексер',
  general: 'Есептеп шық: жауап шартқа сай ма?',
  mul: 'Көбейтуді бөлумен тексер: жауабыңды бір көбейткішке бөл. Екінші көбейткіш шықса, дұрыс.',
  div: 'Бөлуді көбейтумен тексер: жауабыңды бөлгішке көбейт. Бөлінетін сан шықса, дұрыс.',
  add: 'Қосуды алумен тексер: жауабыңнан бір қосылғышты ал. Екінші қосылғыш қалса, дұрыс.',
  sub: 'Алуды қосумен тексер: жауабыңа алынған санды қос. Бастапқы сан шықса, дұрыс.',
  ok: 'Тексердім, дұрыс',
  change: 'Қателесіппін, өзгертемін',
  caught: 'Өзің таптың!',
  caughtSmall: 'Қатені өзің түзеттің!',
} as const;

const NUM = String.raw`\d[\d   ]*(?:,\d+)?`;
const EQ_RE = new RegExp(`(${NUM})\\s*([·×:+−])\\s*(${NUM})\\s*=\\s*(${NUM})`, 'g');
const OPS: Record<string, CheckOp> = { '·': 'mul', '×': 'mul', ':': 'div', '+': 'add', '−': 'sub' };
const canon = (s: string) => s.replace(/[\s  ]/g, '').replace(',', '.').replace('−', '-');
const kzPart = (s: string) => s.split(' / ')[0].trim();

/** Какое действие дало ответ-число: последнее равенство «a ○ b = ответ» в разборе шаблона. null — ответ не число или действия в разборе нет. */
export function answerOp(item: Pick<Item, 'sol' | 'choices' | 'answer'>): CheckOp | null {
  // ответ — число, возможно с единицей («100 минут», «20%»); дробь, смешанное число, неравенство — не число
  const m = kzPart(item.choices[item.answer]?.text ?? '').match(/^(−?\d[\d\s\u00a0\u202f]*(?:,\d+)?)\s*([%°²³]?[\p{L}²³./]*)$/u);
  if (!m || /\d/.test(m[2])) return null;
  const ans = canon(m[1]);
  let op: CheckOp | null = null;
  for (const m of (item.sol?.kz ?? '').matchAll(EQ_RE)) if (canon(m[4]) === ans) op = OPS[m[2]];
  return op;
}

/** Текст самопроверки по типу задачи: обратное действие, если оно есть, иначе общий вопрос. */
export function selfCheckFor(item: Pick<Item, 'sol' | 'choices' | 'answer'>): SelfCheck {
  const op = answerOp(item);
  return op ? { kind: 'reverse', op, text: SELF_SAY[op] } : { kind: 'general', op: null, text: SELF_SAY.general };
}

/** Итог самопроверки для записи попытки: ok — проверил и оставил; caught — неверный сменил на верный (сам поймал); broke — верный сменил на неверный; moved — один неверный на другой. */
export type SelfNote = 'ok' | 'caught' | 'broke' | 'moved';
export function selfNote(first: number | null, final: number | null, answer: number): SelfNote | null {
  if (first === null) return null;
  if (final === null || final === first) return 'ok';
  if (first !== answer && final === answer) return 'caught';
  if (first === answer) return 'broke';
  return 'moved';
}
