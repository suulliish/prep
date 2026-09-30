// Текст голограммы: строка выкладки («60 = [2] · 30», «3/4», «4 030 [005]», «▢») → атомы → раскладка по строкам → рисунок на канвасе.
// Раскладка отделена от рисования и принимает измеритель ширины: её можно проверить без браузера (tests/holo.test.ts).
import { parseRich, type RichPart } from '../lesson/rich';

export type Atom =
  | { k: 'word'; s: string; sp: boolean }
  | { k: 'frac'; whole: number | null; n: number; d: number; sp: boolean }
  | { k: 'hl'; items: Atom[]; sp: boolean }
  | { k: 'blank'; fill: Atom[] | null; sp: boolean };

/** Разбор строки в атомы; sp — перед атомом был пробел (внутри слова и числа пробела нет: числа склеены неразрывным пробелом в rich.ts). */
export function toAtoms(text: string, fill: string | null = null): Atom[] {
  let pending = false;
  const flat = (parts: RichPart[], out: Atom[]) => {
    for (const p of parts) {
      if (p.t === 'text') {
        for (const m of p.s.matchAll(/( +)|([^ ]+)/g)) {   // только обычный пробел: неразрывный склеивает число «4 030»
          if (m[1]) pending = true;
          else { out.push({ k: 'word', s: m[2], sp: pending && out.length + 1 > 1 }); pending = false; }
        }
      } else if (p.t === 'frac') { out.push({ k: 'frac', whole: p.whole, n: p.n, d: p.d, sp: pending && out.length > 0 }); pending = false; }
      else if (p.t === 'blank') { out.push({ k: 'blank', fill: fill === null ? null : toAtoms(fill), sp: pending && out.length > 0 }); pending = false; }
      else {
        const sp = pending; pending = false;
        const items: Atom[] = []; flat(p.parts, items); pending = false;
        if (items.length) items[0] = { ...items[0], sp: false };
        out.push({ k: 'hl', items, sp: sp && out.length > 0 });
      }
    }
  };
  const out: Atom[] = []; flat(parseRich(text), out);
  if (out.length) out[0] = { ...out[0], sp: false };
  return out;
}

export type Measure = (s: string, px: number) => number;
export interface Placed { atom: Atom; x: number; w: number; h: number }
export interface Line { items: Placed[]; w: number; h: number }
export interface Layout { F: number; lines: Line[]; w: number; h: number }

const FRAC_K = 0.66, GAP_K = 0.32;
/** Ширина и высота атома при кегле F. */
export function sizeOf(a: Atom, F: number, m: Measure): { w: number; h: number } {
  switch (a.k) {
    case 'word': return { w: m(a.s, F), h: F * 1.15 };
    case 'frac': {
      const f = F * FRAC_K, ww = a.whole === null ? 0 : m(String(a.whole), F) + F * 0.16;
      return { w: ww + Math.max(m(String(a.n), f), m(String(a.d), f)) + F * 0.34, h: F * 1.62 };
    }
    case 'blank': {
      const inner = a.fill ? rowSize(a.fill, F, m) : { w: F * 0.7, h: F * 1.15 };
      return { w: Math.max(F * 1.1, inner.w + F * 0.5), h: Math.max(F * 1.15, inner.h) + F * 0.1 };
    }
    case 'hl': { const r = rowSize(a.items, F, m); return { w: r.w + F * 0.5, h: r.h + F * 0.12 }; }
  }
}
function rowSize(items: Atom[], F: number, m: Measure): { w: number; h: number } {
  let w = 0, h = 0;
  items.forEach((a, i) => { const s = sizeOf(a, F, m); w += s.w + (i > 0 && a.sp ? F * GAP_K : 0); h = Math.max(h, s.h); });
  return { w, h };
}

/** Самый крупный кегль (из лесенки), при котором строки помещаются в box (не больше 3 строк); лесенка убывает, поэтому первый подошедший — лучший. */
export function layoutAtoms(atoms: Atom[], m: Measure, boxW: number, boxH: number, sizes = [210, 180, 154, 132, 114, 98, 84, 72, 62]): Layout {
  let last: Layout | null = null;
  // первый проход — только кегли, при которых каждое звено цепочки равенств целиком влезает в строку; второй — любые
  for (const strict of [true, false]) for (const F of sizes) {
    const lines: Line[] = []; let cur: Line = { items: [], w: 0, h: 0 };
    const isOp = (p: Placed | Atom, re: RegExp) => { const t = 'atom' in p ? p.atom : p; return t.k === 'word' && re.test(t.s); };
    // цепочка равенств рвётся перед «=», а не посреди выражения: «60 = 2 · 2 · 3 · 5» / «= 2² · 3 · 5»
    const segs: Atom[][] = [];
    atoms.forEach((a, i) => { if (!segs.length || (i > 1 && isOp(a, /^=$/))) segs.push([]); segs[segs.length - 1].push(a); });
    if (strict && (segs.length < 2 || segs.some(sg => rowSize(sg, F, m).w > boxW))) continue;
    for (const seg of segs) {
      const sw = rowSize(seg, F, m).w, sg = cur.items.length && seg[0].sp ? F * GAP_K : 0;
      if (cur.items.length && cur.w + sg + sw > boxW && sw <= boxW) { lines.push(cur); cur = { items: [], w: 0, h: 0 }; }
      for (const a of seg) {
        const s = sizeOf(a, F, m), gap = cur.items.length && a.sp ? F * GAP_K : 0;
        if (cur.items.length && cur.w + gap + s.w > boxW) {
          // знак действия не остаётся в конце строки: уезжает на следующую вместе со своим числом
          const tail = cur.items.length > 1 ? cur.items[cur.items.length - 1] : null;
          const carry = tail && isOp(tail, /^[·×:+−*=≠<>]$/) ? cur.items.pop()! : null;
          if (carry) { cur.w = cur.items.reduce((t, it) => Math.max(t, it.x + it.w), 0); cur.h = cur.items.reduce((t, it) => Math.max(t, it.h), 0); }
          lines.push(cur); cur = { items: [], w: 0, h: 0 };
          if (carry) { cur.items.push({ atom: carry.atom, x: 0, w: carry.w, h: carry.h }); cur.w = carry.w; cur.h = carry.h; }
        }
        const g = cur.items.length && a.sp ? F * GAP_K : 0;
        cur.items.push({ atom: a, x: cur.w + g, w: s.w, h: s.h }); cur.w += g + s.w; cur.h = Math.max(cur.h, s.h);
      }
    }
    if (cur.items.length) lines.push(cur);
    const h = lines.reduce((t, l) => t + l.h, 0) + Math.max(0, lines.length - 1) * F * 0.12;
    const w = lines.reduce((t, l) => Math.max(t, l.w), 0);
    last = { F, lines, w, h };
    if (lines.length <= 3 && w <= boxW && h <= boxH) return last;
  }
  return last ?? { F: sizes[sizes.length - 1], lines: [], w: 0, h: 0 };
}

// ---------- рисование ----------
const FONT = (px: number) => `800 ${px}px Rubik, system-ui, sans-serif`;
const C = { ink: '#d9fdff', glow: '#3ff0ff', gold: '#ffd35c', goldBg: 'rgba(255,201,74,0.22)', pink: '#ff7bd0', okBg: 'rgba(63,240,255,0.16)', bad: '#ff5a6e', ok: '#6dff9a' };

export function ctxMeasure(ctx: CanvasRenderingContext2D): Measure {
  return (s, px) => { ctx.font = FONT(px); return ctx.measureText(s).width; };
}

function drawAtom(ctx: CanvasRenderingContext2D, a: Atom, x: number, cy: number, w: number, h: number, F: number, color: string) {
  ctx.textBaseline = 'middle'; ctx.textAlign = 'left'; ctx.fillStyle = color; ctx.strokeStyle = color;
  if (a.k === 'word') { ctx.font = FONT(F); if (a.s === '✘' || a.s === '✔') ctx.fillStyle = a.s === '✘' ? C.bad : C.ok; ctx.fillText(a.s, x, cy + F * 0.04); return; }   // ✘ красным: голубой ✘ читается как знак умножения
  if (a.k === 'frac') {
    const f = F * FRAC_K, m = ctxMeasure(ctx); let px = x;
    if (a.whole !== null) { ctx.font = FONT(F); ctx.fillText(String(a.whole), px, cy + F * 0.04); px += m(String(a.whole), F) + F * 0.16; }
    const cw = w - (px - x) - F * 0.34, mid = px + F * 0.17 + cw / 2;
    ctx.font = FONT(f); ctx.textAlign = 'center';
    ctx.fillText(String(a.n), mid, cy - f * 0.62); ctx.fillText(String(a.d), mid, cy + f * 0.66);
    ctx.lineWidth = Math.max(3, F * 0.06); ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(px + F * 0.04, cy + 1); ctx.lineTo(px + cw + F * 0.3, cy + 1); ctx.stroke();
    ctx.textAlign = 'left'; return;
  }
  if (a.k === 'blank') {
    ctx.save();
    ctx.beginPath(); ctx.roundRect(x, cy - h / 2 + F * 0.03, w, h - F * 0.06, F * 0.16);
    if (a.fill) { ctx.fillStyle = C.okBg; ctx.fill(); ctx.lineWidth = F * 0.05; ctx.strokeStyle = C.glow; ctx.stroke(); drawRow(ctx, a.fill, x + F * 0.25, cy, F, C.glow); }
    else {
      ctx.fillStyle = 'rgba(255,79,184,0.14)'; ctx.fill(); ctx.setLineDash([F * 0.14, F * 0.1]); ctx.lineWidth = F * 0.05; ctx.strokeStyle = C.pink; ctx.stroke(); ctx.setLineDash([]);
      ctx.font = FONT(F); ctx.textAlign = 'center'; ctx.fillStyle = C.pink; ctx.fillText('?', x + w / 2, cy + F * 0.04);
    }
    ctx.restore(); return;
  }
  // подсветка: золотая плашка и черта снизу — та же «горячая» часть, что жёлтая в карточке
  ctx.save();
  ctx.beginPath(); ctx.roundRect(x, cy - h / 2, w, h, F * 0.14); ctx.fillStyle = C.goldBg; ctx.fill();
  ctx.lineWidth = F * 0.07; ctx.strokeStyle = C.gold; ctx.beginPath(); ctx.moveTo(x + F * 0.08, cy + h / 2); ctx.lineTo(x + w - F * 0.08, cy + h / 2); ctx.stroke();
  ctx.restore();
  drawRow(ctx, a.items, x + F * 0.25, cy, F, C.gold);
}
function drawRow(ctx: CanvasRenderingContext2D, items: Atom[], x0: number, cy: number, F: number, color: string) {
  const m = ctxMeasure(ctx); let x = x0;
  items.forEach((a, i) => { const s = sizeOf(a, F, m); if (i > 0 && a.sp) x += F * GAP_K; drawAtom(ctx, a, x, cy, s.w, s.h, F, color); x += s.w; });
}

/** Замок / звезда слева от текста (цель и правило). */
export function drawIcon(ctx: CanvasRenderingContext2D, icon: 'lock' | 'star', cx: number, cy: number, s: number) {
  ctx.save(); ctx.fillStyle = C.gold; ctx.strokeStyle = C.gold; ctx.lineWidth = s * 0.14; ctx.lineJoin = 'round';
  if (icon === 'lock') {
    ctx.beginPath(); ctx.arc(cx, cy - s * 0.12, s * 0.28, Math.PI, 0); ctx.stroke();
    ctx.beginPath(); ctx.roundRect(cx - s * 0.42, cy - s * 0.12, s * 0.84, s * 0.62, s * 0.12); ctx.fill();
    ctx.fillStyle = '#12285a'; ctx.beginPath(); ctx.arc(cx, cy + s * 0.17, s * 0.09, 0, Math.PI * 2); ctx.fill();
  } else {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) { const r = i % 2 ? s * 0.22 : s * 0.5, a = -Math.PI / 2 + (i * Math.PI) / 5; ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.98 + s * 0.03); }
    ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

export interface DrawnText { w: number; h: number; F: number }
/** Нарисовать строку по центру канваса (cw × ch), со свечением. Возвращает габариты содержимого (px канваса) — по ним панель обрезается по тексту. */
export function drawHoloText(cv: HTMLCanvasElement, text: string, fill: string | null, icon?: 'lock' | 'star', opts: { color?: string; maxF?: number } = {}): DrawnText {
  const ctx = cv.getContext('2d')!, cw = cv.width, ch = cv.height;
  ctx.clearRect(0, 0, cw, ch);
  const m = ctxMeasure(ctx), atoms = toAtoms(text, fill);
  const iconW = icon ? ch * 0.30 : 0;
  const lay = layoutAtoms(atoms, m, cw * 0.94 - iconW, ch * 0.9, opts.maxF ? [210, 180, 154, 132, 114, 98, 84, 72, 62].filter(f => f <= opts.maxF!) : undefined);
  const totalW = lay.w + iconW, x0 = (cw - totalW) / 2 + iconW;
  ctx.save(); ctx.shadowColor = C.glow; ctx.shadowBlur = Math.max(6, lay.F * 0.12);
  let y = (ch - lay.h) / 2;
  for (const ln of lay.lines) {
    const cy = y + ln.h / 2, lx = x0 + (lay.w - ln.w) / 2;
    for (const p of ln.items) drawAtom(ctx, p.atom, lx + p.x, cy, p.w, p.h, lay.F, opts.color ?? C.ink);
    y += ln.h + lay.F * 0.12;
  }
  if (icon) drawIcon(ctx, icon, x0 - iconW / 2 - lay.F * 0.1, ch / 2, Math.min(ch * 0.4, lay.F * 1.1));
  ctx.restore();
  return { w: totalW, h: Math.max(lay.h, icon ? ch * 0.4 : 0), F: lay.F };
}
