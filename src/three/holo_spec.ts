// «Тірі түсіндіру»: что именно Бит проецирует голограммой над островом. Чистая функция из данных урока (без three.js и DOM):
// шаг + кадр → HoloSpec. Строки берутся из тех же полей, что рисует 2D-карточка (math кадра, s сцены), поэтому голограмма
// не может «проговориться»: закрытое пропуском (D11) число остаётся закрытым, пока ребёнок его не выберет.

export interface HoloRow { n: number; d: number; eat?: number }
export type HoloSpec =
  /** Выражение плитками: [..] подсвечено, ▢ — пропуск (fill — его значение после решения). */
  | { kind: 'text'; text: string; fill?: string | null; icon?: 'lock' | 'star'; hold?: number }
  /** Дробь настоящей геометрией: пицца (round) или полоски; stage: 0 целое, 1 порезано, 2 закрашено, 3 + подпись. */
  | { kind: 'frac'; rows: HoloRow[]; stage: number; round: boolean; broken: boolean; guide: boolean; hold?: number };

export interface SpecOpts {
  frame?: number;
  /** Текст кадра/строки правила с ▢ (из planGaps), пока пропуск не решён — вместо настоящего. */
  gapText?: string | null;
  /** Значение пропуска после решения. */
  gapFill?: string | null;
  /** Номер строки правила, в которой стоит пропуск. */
  gapLine?: number | null;
}

/** Сколько секунд голограмма цели висит, потом гаснет («на секунду показать замок»). */
export const GOAL_HOLD = 4.5;

const isNumStr = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Дробная сцена → геометрия. FracBars — как есть; FracLine — полоска (число n/d), прямая остаётся в 2D. */
export function fracSpec(scene: string | undefined, s: any): HoloSpec | null {
  s = s ?? {};
  if (scene === 'FracBars') {
    const rows: HoloRow[] = (Array.isArray(s.rows) && s.rows.length ? s.rows : [{ n: 3, d: 4 }]).slice(0, 3)
      .map((r: any) => ({ n: r.n, d: Math.max(1, r.d), ...(r.eat ? { eat: r.eat } : {}) }));
    return { kind: 'frac', rows, stage: isNumStr(s.stage) ? s.stage : 3, round: !!s.round, broken: !!s.broken, guide: !!s.guide };
  }
  if (scene === 'FracLine' && isNumStr(s.n) && isNumStr(s.d) && s.d > 0) {
    return { kind: 'frac', rows: [{ n: s.n, d: s.d }], stage: Math.max(1, Math.min(3, isNumStr(s.stage) ? s.stage : 3)), round: false, broken: !!s.broken, guide: false };
  }
  return null;
}

const groups3 = (digits: string): string[] => {
  const out: string[] = [];
  for (let end = digits.length; end > 0; end -= 3) out.unshift(digits.slice(Math.max(0, end - 3), end));
  return out;
};
/** Простые множители по одному отщеплению наименьшего (как дерево Tree.svelte): [{p, rest}]. */
export function factorChain(n: number): { p: number; rest: number }[] {
  const out: { p: number; rest: number }[] = []; let m = n;
  while (m > 1) { let p = 2; while (m % p) p++; if (p === m) break; out.push({ p, rest: m / p }); m /= p; }
  return out;
}

/** Строка из «картинки» сцены, когда у кадра нет своей math: разряды поезда, дерево множителей, плитки. */
export function sceneText(scene: string | undefined, s: any): string | null {
  s = s ?? {};
  if (scene === 'Tiles' && typeof s.math === 'string') return s.math;
  if (scene === 'Train' && typeof s.digits === 'string' && !s.broken) {
    const g = groups3(s.digits), at = s.hl === 'u' ? g.length - 1 : s.hl === 't' ? g.length - 2 : s.hl === 'm' ? 0 : -1;
    return g.map((x, k) => (k === at ? `[${x}]` : x)).join(' ');
  }
  if (scene === 'Tree' && isNumStr(s.n) && !s.broken) {
    const depth = s.depth ?? 0, chain = factorChain(s.n).slice(0, depth);
    if (!chain.length) return String(s.n);
    const leaves = chain.map((c, k) => (k === chain.length - 1 ? `[${c.p}]` : String(c.p)));
    return `${s.n} = ${[...leaves, chain[chain.length - 1].rest].join(' · ')}`;
  }
  if (scene === 'Crystals' && isNumStr(s.n) && isNumStr(s.d) && s.d > 0) {
    const q = Math.floor(s.n / s.d), r = s.n % s.d, st = s.stage ?? 0;
    return st === 0 ? String(s.n) : `${s.n} = ${s.d} · ${q}${st >= 2 && r ? ` + [${r}]` : ''}`;
  }
  return null;
}

/** Ключевое равенство правила: самое длинное «математическое» место со знаком =, ≠, <, > (без слов). null — в правиле нет формулы. */
export function keyMath(lines: string[]): string | null {
  const re = /[\[\]▢\d][\[\]▢\d\s/·×:+−*=≠<>²³⁰¹⁴-⁹().,]*[\]▢\d²³⁰¹⁴-⁹)]/g;
  let best: string | null = null;
  for (const l of lines) for (const m of l.matchAll(re)) {
    const t = m[0].trim();
    if (!/[=≠<>]/.test(t) || t.length < 5 || t.length > 40) continue;
    if (!best || t.length > best.length) best = t;
  }
  return best;
}

export function holoSpecFor(step: any, o: SpecOpts = {}): HoloSpec | null {
  if (!step) return null;
  if (step.type === 'goal') {
    const g = fracSpec(step.scene, step.s);
    if (g) return { ...g, hold: GOAL_HOLD };
    const t: string | null = typeof step.s?.math === 'string' ? step.s.math : typeof step.task === 'string' && step.task.length <= 30 ? step.task : null;
    return { kind: 'text', text: t ?? '?', icon: 'lock', hold: GOAL_HOLD };
  }
  if (step.type === 'example') {
    const fr = step.frames?.[o.frame ?? 0]; if (!fr) return null;
    const scene = fr.scene ?? step.scene, f = fracSpec(scene, fr.s);
    if (f) return f;
    const text = o.gapText ?? fr.math ?? sceneText(scene, fr.s);
    return text ? { kind: 'text', text, fill: o.gapText ? o.gapFill ?? null : null } : null;
  }
  if (step.type === 'rule') {
    const lines: string[] = Array.isArray(step.lines) ? [...step.lines] : [];
    if (o.gapText && o.gapLine != null && o.gapLine >= 0 && o.gapLine < lines.length) lines[o.gapLine] = o.gapText;
    const t = keyMath(lines);
    return t ? { kind: 'text', text: t, fill: o.gapText && t.includes('▢') ? o.gapFill ?? null : null, icon: 'star' } : null;
  }
  return null;
}

/** Из какой «формы» собрана голограмма: та же форма — меняем содержимое на месте (нарезка, закраска), другая — пересобираем. */
export function holoShape(spec: HoloSpec): string {
  return spec.kind === 'text' ? 'text' : `frac:${spec.round ? 'r' : 'b'}`;
}
