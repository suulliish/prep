// Фото тетради для проверки «Дәптер»: уменьшить до MAX_SIDE по длинной стороне и пережать в JPEG перед отправкой.
// Телефон снимает 3–12 Мп (2–6 МБ) — для чтения почерка хватает 1600 px (≈150–500 КБ), отправка быстрая и на мобильной сети.

export const MAX_SIDE = 1600;
export const JPEG_Q = 0.82;

/** Размер после уменьшения: длинная сторона не больше max, пропорции сохраняются; маленькое фото не растягиваем. */
export function fitSize(w: number, h: number, max = MAX_SIDE): { w: number; h: number } {
  const k = Math.min(1, max / Math.max(w, h));
  return { w: Math.max(1, Math.round(w * k)), h: Math.max(1, Math.round(h * k)) };
}

/** Картинка из файла (с учётом поворота EXIF там, где браузер это умеет). */
async function load(file: Blob): Promise<{ img: CanvasImageSource; w: number; h: number; done: () => void }> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions);
      return { img: bmp, w: bmp.width, h: bmp.height, done: () => bmp.close() };
    } catch { /* старый Safari: ниже через <img> */ }
  }
  const url = URL.createObjectURL(file);
  const img = new Image();
  await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = () => rej(new Error('decode')); img.src = url; });
  return { img, w: img.naturalWidth, h: img.naturalHeight, done: () => URL.revokeObjectURL(url) };
}

/** Файл с камеры → JPEG base64 (без префикса data:). Не картинка или не декодируется — ошибка. */
export async function shrinkPhoto(file: Blob): Promise<{ image: string; mime: 'image/jpeg' }> {
  const src = await load(file);
  try {
    const { w, h } = fitSize(src.w, src.h);
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d')!;
    g.fillStyle = '#fff'; g.fillRect(0, 0, w, h);   // прозрачный PNG не станет чёрным
    g.drawImage(src.img, 0, 0, w, h);
    const url = c.toDataURL('image/jpeg', JPEG_Q);
    return { image: url.slice(url.indexOf(',') + 1), mime: 'image/jpeg' };
  } finally { src.done(); }
}
