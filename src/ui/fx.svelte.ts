// Эффекты поверх интерфейса: всплывающие надписи и пиксельные искры (canvas).
export interface Float { id: number; text: string; x: number; y: number; color: string; big?: boolean }
export const fx = $state({ floats: [] as Float[], flash: '' as string });
let id = 0;
type Spark = { x: number; y: number; vx: number; vy: number; life: number; color: string; s: number };
const sparks: Spark[] = [];
let ctx: CanvasRenderingContext2D | null = null, running = false;

export function attachCanvas(c: HTMLCanvasElement) {
  ctx = c.getContext('2d');
  const fit = () => { c.width = innerWidth * devicePixelRatio; c.height = innerHeight * devicePixelRatio; };
  fit(); addEventListener('resize', fit);
}

function loop() {
  if (!ctx) return;
  const c = ctx.canvas, dpr = devicePixelRatio;
  ctx.clearRect(0, 0, c.width, c.height);
  for (let i = sparks.length - 1; i >= 0; i--) {
    const p = sparks[i]; p.life -= 1 / 60; p.vy += 0.35; p.x += p.vx; p.y += p.vy;
    if (p.life <= 0) { sparks.splice(i, 1); continue; }
    ctx.globalAlpha = Math.min(1, p.life * 2); ctx.fillStyle = p.color;
    ctx.fillRect(Math.round(p.x * dpr), Math.round(p.y * dpr), p.s * dpr, p.s * dpr);
  }
  ctx.globalAlpha = 1;
  if (sparks.length) requestAnimationFrame(loop); else running = false;
}

export function sparksAt(x: number, y: number, colors = ['#3ff0ff', '#ffc94a', '#ff4fb8'], n = 36, power = 7) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) n = Math.min(n, 8);
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, v = Math.random() * power + 2;
    sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 4, life: 0.8 + Math.random() * 0.6, color: colors[i % colors.length], s: 3 + Math.floor(Math.random() * 4) });
  }
  if (!running) { running = true; requestAnimationFrame(loop); }
}

export function floatText(text: string, x: number, y: number, color = '#ffc94a', big = false) {
  const f = { id: ++id, text, x, y, color, big };
  fx.floats.push(f);
  setTimeout(() => { fx.floats = fx.floats.filter(q => q.id !== f.id); }, 1100);
}

export function centerOf(el: Element | null) {
  const r = el?.getBoundingClientRect();
  return r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : { x: innerWidth / 2, y: innerHeight / 2 };
}

export function flash(color: string) { fx.flash = color; setTimeout(() => (fx.flash = ''), 250); }

/** Центр 3D-сцены: на широком экране панель справа (см. .stage в app.css), иначе — верхняя часть экрана. */
export function sceneCenter(yFrac = 0.3) {
  // телефон в горизонтали: 3D сужен до левой части экрана (html.lsplit, src/app.css) — центр по его ширине
  if (document.documentElement.classList.contains('lsplit')) {
    const c = document.querySelector('canvas.world')?.getBoundingClientRect();
    if (c) return { x: c.left + c.width / 2, y: innerHeight * yFrac };
  }
  const side = innerWidth >= 1000 && innerWidth / innerHeight >= 1.15;
  const panel = side ? Math.min(540, innerWidth * 0.42) + 24 : 0;
  return { x: (innerWidth - panel) / 2, y: innerHeight * yFrac };
}
