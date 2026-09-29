// Разбор строки урока для MathLine: [..] — подсветка, ▢ — пропуск, «3/4» и «2 3/4» — этажные дроби,
// числа с разрядами («4 030 005») склеены неразрывными пробелами. «:» (деление, время 10:30, отношение 1:2), даты и
// обычный текст остаются как есть.
import { splitFractions } from '../widgets/fracdraw';

export type RichPart =
  | { t: 'text'; s: string }
  | { t: 'frac'; whole: number | null; n: number; d: number }
  | { t: 'hl'; parts: RichPart[]; raw: string }
  | { t: 'blank' };

const NB = ' ';
/** Пробел между цифрами не рвёт число («648 210 060»), но смешанное «2 3/4» не трогает: его читает splitFractions. */
export const glueNumbers = (s: string): string => s
  .replace(/(\d) (?=\d)(?!\d+\/\d)/g, `$1${NB}`)
  .replace(/(\d) (?=[%°])/g, `$1${NB}`);

/** Дроби и склеенные числа внутри куска без [..] и ▢. */
function inline(s: string): RichPart[] {
  return splitFractions(s).map(x => (x.t === 'frac' ? x : { t: 'text' as const, s: glueNumbers(x.s) }));
}

export function parseRich(text: string): RichPart[] {
  // число, разорванное границей подсветки («4 030 [005]»), тоже не должно переноситься
  const src = text.replace(/(\d) (?=\[\d)/g, `$1${NB}`).replace(/(\d\]) (?=\d)/g, `$1${NB}`);
  const out: RichPart[] = [];
  for (const p of src.split(/(\[[^\]]+\]|▢)/)) {
    if (!p) continue;
    if (p === '▢') out.push({ t: 'blank' });
    else if (p.startsWith('[') && p.endsWith(']')) out.push({ t: 'hl', parts: inline(p.slice(1, -1)), raw: p.slice(1, -1) });
    else out.push(...inline(p));
  }
  return out;
}

/** Есть ли в строке подсвеченная часть: по ней ребёнок открывает «дальше» касанием (D12). */
export const hasHighlight = (text: string): boolean => /\[[^\]]+\]/.test(text);
