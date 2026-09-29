// «Влезть в экран»: сколько высоты может занять элемент карточки урока, чтобы тело панели (.body в Screen.svelte) не прокручивалось.
// Считаем от самой панели: высота тела минус всё остальное содержимое карточки. Вне панели (widgets.html) — Infinity.

/** Высота (px), которую el может занять, не вызывая прокрутки тела панели. */
export function room(el: HTMLElement): number {
  const body = el.closest<HTMLElement>('.body'), card = el.closest<HTMLElement>('.card');
  if (!body || !card) return Infinity;
  const cs = getComputedStyle(body);
  const inner = body.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
  return inner - (card.getBoundingClientRect().height - el.getBoundingClientRect().height);
}

/** Следит за размером тела и карточки; fn вызывается при любом изменении и ещё раз, когда всё осело. Возвращает отписку.
 *  Второй вызов нужен, потому что карточка появляется с масштабом (pop-in .3с) и после катсцены (display: none → block): первый замер неточен. */
export function watchRoom(el: HTMLElement, fn: () => void): () => void {
  const body = el.closest<HTMLElement>('.body'), card = el.closest<HTMLElement>('.card');
  if (!body || !card) return () => {};
  let t = 0;
  const run = () => { fn(); clearTimeout(t); t = window.setTimeout(fn, 380); };
  const ro = new ResizeObserver(run);
  ro.observe(body); ro.observe(card);
  addEventListener('resize', run);
  requestAnimationFrame(run);
  return () => { ro.disconnect(); removeEventListener('resize', run); clearTimeout(t); };
}

/** Действие Svelte: сжимает (CSS zoom) сцену урока, если она не помещается; не меньше min, не больше 1. */
export function fitZoom(node: HTMLElement, opts: { min?: number } = {}) {
  // в горизонтали (высота ≤ 560) панель низкая: сцену-иллюстрацию можно сжать сильнее
  const min = opts.min ?? (innerHeight <= 560 ? 0.4 : 0.55);
  let k = 1;
  const apply = () => {
    const h = node.getBoundingClientRect().height;
    if (!h) return;
    const nk = Math.max(min, Math.min(1, room(node) / (h / k)));
    if (Math.abs(nk - k) < 0.015) return;
    k = nk; node.style.zoom = k >= 0.995 ? '' : String(k);
  };
  const stop = watchRoom(node, apply);
  return { destroy: stop };
}
