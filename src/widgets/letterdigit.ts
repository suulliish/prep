// Чистая логика виджета LetterDigit («Ребус»): проверка ребуса вида слово + слово (+ …) = сумма по столбикам с переносом.
// Правила: одинаковые буквы — одинаковые цифры, разные — разные (distinct); первая цифра многозначного числа не 0.

export type Asg = Record<string, number>;

/** Буквы ребуса в порядке первого появления (слева направо, сверху вниз). */
export const lettersOf = (words: string[], sum: string): string[] => [...new Set([...words, sum].join('').split(''))];
/** Буквы, которые не могут быть нулём: первые буквы многозначных чисел. */
export const leadSet = (words: string[], sum: string): Set<string> => new Set([...words, sum].filter(w => w.length > 1).map(w => w[0]));

export interface Col { add: string[]; s: string | undefined }
/** Столбики справа налево (0 — единицы). add — буквы слагаемых в столбике, s — буква суммы (нет, если сумма короче: такой ребус не бывает). */
export function columns(words: string[], sum: string): Col[] {
  const L = Math.max(sum.length, ...words.map(w => w.length));
  return Array.from({ length: L }, (_, c) => ({ add: words.map(w => w[w.length - 1 - c]).filter(x => x !== undefined), s: sum[sum.length - 1 - c] }));
}

export interface ColState { status: 'wait' | 'ok' | 'bad'; carryIn: number | null; carryOut: number | null }
/** Состояние каждого столбика: перенос известен, пока подряд заполнены все буквы слагаемых справа налево. */
export function evalColumns(words: string[], sum: string, asg: Asg): ColState[] {
  const out: ColState[] = [];
  let carry: number | null = 0;
  for (const col of columns(words, sum)) {
    const known: boolean = carry !== null && col.add.every(l => asg[l] !== undefined);
    const total: number | null = known ? col.add.reduce((a, l) => a + asg[l], 0) + (carry as number) : null;
    let status: ColState['status'] = 'wait';
    if (total !== null && col.s !== undefined && asg[col.s] !== undefined) status = total % 10 === asg[col.s] ? 'ok' : 'bad';
    out.push({ status, carryIn: carry, carryOut: total === null ? null : Math.floor(total / 10) });
    carry = total === null ? null : Math.floor(total / 10);
  }
  return out;
}

/** Какая буква уже держит эту цифру (кроме except). */
export function holderOf(asg: Asg, digit: number, except?: string): string | null {
  for (const [l, d] of Object.entries(asg)) if (d === digit && l !== except) return l;
  return null;
}

export type AssignResult = { ok: true; asg: Asg } | { ok: false; reason: 'used' | 'lead0'; by?: string };
/** Поставить цифру букве: нельзя, если цифра занята другой буквой или ноль первой букве числа. */
export function tryAssign(words: string[], sum: string, asg: Asg, letter: string, digit: number): AssignResult {
  const by = holderOf(asg, digit, letter);
  if (by) return { ok: false, reason: 'used', by };
  if (digit === 0 && leadSet(words, sum).has(letter)) return { ok: false, reason: 'lead0' };
  return { ok: true, asg: { ...asg, [letter]: digit } };
}

/** Ребус решён: все буквы заполнены, правила соблюдены, все столбики сходятся, перенос из последнего столбика 0. */
export function isSolved(words: string[], sum: string, asg: Asg): boolean {
  const ls = lettersOf(words, sum);
  if (!ls.every(l => asg[l] !== undefined)) return false;
  if (new Set(ls.map(l => asg[l])).size !== ls.length) return false;
  const lead = leadSet(words, sum);
  if (ls.some(l => lead.has(l) && asg[l] === 0)) return false;
  const cs = evalColumns(words, sum, asg);
  return cs.every(c => c.status === 'ok') && cs[cs.length - 1].carryOut === 0;
}

/** Следующая буква без цифры после from (по кругу); null — все заполнены. */
export function nextFree(letters: string[], asg: Asg, from?: string): string | null {
  const start = from === undefined ? -1 : letters.indexOf(from);
  for (let i = 1; i <= letters.length; i++) { const l = letters[(start + i + letters.length) % letters.length]; if (asg[l] === undefined) return l; }
  return null;
}

/** Все решения полным перебором (для проверки уроков и тестов; ребусы урока маленькие: ≤ 5 букв). */
export function allSolutions(words: string[], sum: string): Asg[] {
  const ls = lettersOf(words, sum), out: Asg[] = [];
  const go = (i: number, asg: Asg) => {
    if (i === ls.length) { if (isSolved(words, sum, asg)) out.push({ ...asg }); return; }
    for (let d = 0; d <= 9; d++) { const r = tryAssign(words, sum, asg, ls[i], d); if (r.ok) go(i + 1, r.asg); }
  };
  go(0, {});
  return out;
}

export const COLUMN_NAMES = ['Бірліктер', 'Ондықтар', 'Жүздіктер', 'Мыңдықтар', 'Он мыңдықтар'];
