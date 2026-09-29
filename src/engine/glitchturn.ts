// «Глитчтің қатесі» (D8, night/research-learning.md): раз в ~5 вопросов боя вместо вопроса Глитч «решает» задачу на экране,
// а ребёнок нажимает на первую неверную строку (разбор чужой ошибки: Booth 2013, Adams 2014).
// Чистый модуль без Svelte: строки берутся из готового разбора шаблона (sol), одна из них портится ответом-ловушкой
// (distractor) с настоящей меткой ошибки из content/misconceptions.mjs. Экран: src/ui/GlitchTurn.svelte, ход боя: Session.svelte.
// @ts-ignore
import { MISCONCEPTIONS } from '../../content/misconceptions.mjs';
import { mistakeText } from './items';

interface Choice { text: string; tag: string }
export interface GlitchSrc { sol: { kz: string }; choices: Choice[]; answer: number }

export interface GlitchTurn {
  lines: string[];      // что видит ребёнок: 3–5 строк, одна испорчена
  good: string[];       // те же строки без порчи
  bad: number;          // первая неверная строка
  follows: number[];    // строки после неё, которые повторяют неверный результат (тоже неверные, но это следствие)
  tag: string;          // метка ошибки (ключ в MISCONCEPTIONS)
  right: string;        // верный результат в строке
  wrong: string;        // то, что вместо него написал Глитч
  appended: boolean;    // строки «Жауабы: …» не было в разборе — она добавлена в конец
}

export const GLITCH = { minIdx: 2, gapMin: 4, gapMax: 6, minAttempts: 2, minLines: 3, maxLines: 5 } as const;

// ---------- строки из разбора ----------
/** Делит по « = » на глубине 0 (скобки не трогает), кроме первого знака: «C = 2πr = 2 · 3 · 60 = 360» → «C = 2πr», «= 2 · 3 · 60», «= 360». */
function chainSplit(p: string): string[] {
  const out: string[] = []; let depth = 0, from = 0, seen = 0;
  for (let i = 0; i < p.length; i++) {
    const c = p[i];
    if (c === '(' || c === '{' || c === '[') depth++; else if (c === ')' || c === '}' || c === ']') depth--;
    else if (depth === 0 && c === '=' && p[i - 1] === ' ' && p[i + 1] === ' ' && ++seen > 1) { out.push(p.slice(from, i - 1)); from = i; }
  }
  out.push(p.slice(from));
  return out.map(x => x.trim()).filter(Boolean);
}

/** Разбор → строки: по переносам, концам предложений и «;»; если их меньше трёх — цепочки «a = b, c = d» по запятой,
 *  потом цепочки «a = b = c» по «=», потом «пояснение: выкладка» по двоеточию. */
export function solLines(sol: string): string[] {
  const enough = (l: string[]) => l.length >= GLITCH.minLines;
  let parts = sol.split(/\n+/).flatMap(x => x.split(/(?<=[.!?;])\s+/)).map(x => x.trim().replace(/;$/, '')).filter(Boolean);
  if (!enough(parts)) parts = parts.flatMap(p => { const c = p.split(/,\s+/); return c.length > 1 && c.every(x => /[=≈↔]/.test(x)) ? c : [p]; });
  if (!enough(parts)) parts = parts.flatMap(chainSplit);
  if (!enough(parts)) parts = parts.flatMap(p => { const m = p.match(/^(.{12,}?):\s+(.*\d.*)$/); return m ? [m[1], m[2]] : [p]; });
  return parts;
}

/** Склеивает соседние строки (самую короткую пару), пока их больше `max`. */
function mergeTo(lines: string[], max: number): string[] {
  const out = lines.slice();
  while (out.length > max) {
    let at = 0, best = Infinity;
    for (let i = 0; i + 1 < out.length; i++) { const n = out[i].length + out[i + 1].length; if (n < best) { best = n; at = i; } }
    out.splice(at, 2, out[at] + ' ' + out[at + 1]);
  }
  return out;
}

// ---------- поиск результата в строке и замена ----------
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** Результат целиком, а не кусок другого числа: не «5» внутри «15», «1,5», «1/5», «−5» или «5-ке». */
function findRe(ans: string): RegExp {
  const frac = /^\d+\/\d+$/.test(ans) ? String.raw`(?<!\d[  ])` : '';
  return new RegExp(String.raw`${frac}(?<![\p{L}\d,.^/⁰¹²³⁴⁵⁶⁷⁸⁹−-])${esc(ans)}(?![\d\p{L}²³]|[,.]\d|/\d|-\p{L})`, 'u');
}
const kzPart = (s: string) => s.split(' / ')[0].trim();
/** «720 кг» → «720», «91%» → «91»: запасной вариант, если строка с единицей не найдена. */
const bare = (s: string) => s.replace(/\s*(%|°|[\p{L}²³]+\.?)$/u, '');

/** Ловушки с настоящей меткой ошибки; сначала те, чьего числа нет в разборе (иначе ребёнок увидит его в двух местах и запутается). */
function pickWrong(src: GlitchSrc, good: string[], rand: () => number): Choice[] {
  const right = kzPart(src.choices[src.answer].text);
  const seen = new Set<string>();
  const used = (c: Choice) => { const re = findRe(kzPart(c.text)); return good.some(l => re.test(l)) ? 1 : 0; };
  return src.choices.filter((c, i) => {
    const t = kzPart(c.text);
    if (i === src.answer || !t || t === right || !(c.tag in MISCONCEPTIONS) || seen.has(t)) return false;
    seen.add(t); return true;
  }).map(c => ({ c, k: used(c) + rand() * 0.5 })).sort((a, b) => a.k - b.k).map(x => x.c);
}

/** Собирает ход или null (нет строк, нет подходящей ошибки — тогда в бою обычный вопрос). */
export function buildGlitch(src: GlitchSrc, rand: () => number = Math.random): GlitchTurn | null {
  const right = kzPart(src.choices[src.answer].text);
  if (!right || !src.sol?.kz) return null;
  let good = solLines(src.sol.kz);
  const wrongs = pickWrong(src, good, rand);
  if (!wrongs.length) return null;
  const hasIn = (ans: string) => good.some(l => findRe(ans).test(l));
  let appended = false;
  let ans = right, wrongOf = (w: string) => w;
  if (!hasIn(ans) && bare(ans) !== ans && hasIn(bare(ans))) { ans = bare(ans); wrongOf = bare; }
  if (!hasIn(ans)) {                       // результата в разборе нет — итоговая строка «Жауабы: …» добавляется в конец
    good = mergeTo(good, GLITCH.maxLines - 1).concat(`Жауабы: ${right}`);
    ans = right; wrongOf = w => w; appended = true;
  }
  good = mergeTo(good, GLITCH.maxLines);
  if (good.length < GLITCH.minLines) return null;
  const re = findRe(ans);
  const bad = good.findIndex(l => re.test(l));
  if (bad < 0) return null;
  const w = wrongs[0], wrong = wrongOf(kzPart(w.text));
  const gre = new RegExp(re.source, 'gu');
  const lines = good.map((l, i) => (i < bad ? l : l.replace(gre, () => wrong)));   // с первой строки с результатом и дальше: тот же неверный результат
  const follows = lines.map((l, i) => (i > bad && l !== good[i] ? i : -1)).filter(i => i >= 0);
  if (lines[bad] === good[bad] || lines.some(l => /NaN|undefined/.test(l))) return null;
  return { lines, good, bad, follows, tag: w.tag, right: ans, wrong, appended };
}

// ---------- когда ход выпадает ----------
/** Номер вопроса, начиная с которого выпадет первый ход: 3-й–5-й вопрос боя. */
export const firstGlitchAt = (rand: () => number = Math.random) => GLITCH.minIdx + Math.floor(rand() * 3);
/** После хода следующий — через 4–6 вопросов (в среднем раз в 5, два подряд не бывает). */
export const nextGlitchAt = (idx: number, rand: () => number = Math.random) => idx + GLITCH.gapMin + Math.floor(rand() * (GLITCH.gapMax - GLITCH.gapMin + 1));

export interface GlitchCtx {
  idx: number; total: number; at: number;          // номер вопроса (с 0), длина боя, с какого номера ход «созрел»
  attempts: number;                                // сколько раз ребёнок уже решал этот навык
  block: string; lastWave: boolean; mobHp: number; // босс: последний удар не отдаём ходу
  revenge: boolean; rushTwin: boolean; check: boolean; real: boolean;   // «своё» место вопроса: реванш, «егіз», мини-проверка, настоящая задача экзамена
}
export function glitchAllowed(c: GlitchCtx): boolean {
  if (c.idx < GLITCH.minIdx || c.idx < c.at) return false;
  if (c.attempts < GLITCH.minAttempts) return false;                  // навык уже встречался
  if (c.revenge || c.rushTwin || c.check || c.real) return false;
  if (c.block === 'boss' && (c.idx >= c.total - 1 || (c.lastWave && c.mobHp <= 2))) return false;   // финальный удар по боссу — только за обычный ответ
  return true;
}

// ---------- реплики Бита ----------
export const GLITCH_SAY = {
  title: 'Глитчтің қатесі!',
  ask: 'Қай жолда қате бар?',
  glitchSays: 'Мен шештім! Қай жолда қате бар?',
  wait: 'Қате жолды таңда',
  right: 'Таптың!',
  wrongLine: 'Бұл жол дұрыс еді. Қате қызыл белгімен көрсетілді.',
  followLine: 'Бұл жол да қате, бірақ ол — салдар: қате ертерек басталған.',
  mistake: 'Глитч былай қателесті:',
  fix: 'Дұрысы:',
} as const;

/** Первое предложение объяснения ошибки — короткая реплика Бита после верного удара. */
export function shortMistake(tag: string): string {
  const kz = mistakeText(tag).kz;
  const m = kz.match(/^.+?[.!?](?=\s|$)/);
  return (m ? m[0] : kz).trim();
}
