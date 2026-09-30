// Монеты летят из места события (ответ, враг) в пилюлю-счётчик ([data-coin-target], src/ui/CoinChip.svelte).
// Число на счётчике растёт, когда монета долетела: onCoin(delta) вызывается по одной на каждую монету, сумма дельт = n.
const COIN_SVG = '<svg width="22" height="22" viewBox="0 0 24 24" stroke-linejoin="round"><circle cx="12" cy="12" r="9.5" fill="#ffcb2e" stroke="#101433" stroke-width="2"/><circle cx="12" cy="12" r="5.4" fill="none" stroke="#101433" stroke-width="2"/></svg>';

/** Разделить n монет на k долей (сумма = n). */
export function splitCoins(n: number, k: number): number[] {
  return Array.from({ length: k }, (_, i) => Math.floor((n * (i + 1)) / k) - Math.floor((n * i) / k));
}

function target(): { x: number; y: number } {
  const els = [...document.querySelectorAll('[data-coin-target]')] as HTMLElement[];
  const el = els.find(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.bottom > 0 && r.top < innerHeight; });
  const r = el?.getBoundingClientRect();
  return r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : { x: innerWidth - 40, y: 40 };
}

export function flyCoins(from: { x: number; y: number }, n: number, onCoin: (delta: number) => void): void {
  const k = Math.max(1, Math.min(n, 6)), shares = splitCoins(n, k);
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const to = target();
  shares.forEach((delta, i) => {
    if (reduce || typeof Element.prototype.animate !== 'function') { onCoin(delta); return; }
    const el = document.createElement('div');
    el.innerHTML = COIN_SVG;
    el.style.cssText = 'position:fixed;left:0;top:0;z-index:60;pointer-events:none;width:22px;height:22px;will-change:transform,opacity';
    document.body.appendChild(el);
    const sx = from.x - 11 + (Math.random() - 0.5) * 40, sy = from.y - 11 + (Math.random() - 0.5) * 20;
    const ex = to.x - 11, ey = to.y - 11;
    // сначала подпрыгивает вверх («выпала»), потом летит в счётчик
    const up = { x: sx + (Math.random() - 0.5) * 30, y: sy - 30 - Math.random() * 20 };
    const anim = el.animate([
      { transform: `translate(${sx}px,${sy}px) scale(.4)`, opacity: 0 },
      { transform: `translate(${up.x}px,${up.y}px) scale(1.15)`, opacity: 1, offset: 0.28 },
      { transform: `translate(${ex}px,${ey}px) scale(.8)`, opacity: 1, offset: 0.95 },
      { transform: `translate(${ex}px,${ey}px) scale(.5)`, opacity: 0 },
    ], { duration: 850, delay: i * 90, easing: 'cubic-bezier(.4,.1,.5,1)', fill: 'both' });
    const done = () => { el.remove(); onCoin(delta); };
    anim.onfinish = done; anim.oncancel = done;
  });
}
