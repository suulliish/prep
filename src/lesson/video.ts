// Чистые помощники видео-объяснения «Көр» (ExampleVideo.svelte): «караоке» подписи и момент, когда голос называет главное.
// Точного времени слов у нас нет (mp3 целиком), поэтому слово получает долю реплики по своей длине и знакам препинания: приблизительно, но на слух совпадает.

export interface KWord { w: string; a: number; b: number }

/** Пауза в речи после знака: запятая короче, точка длиннее (в «символах» веса). */
const PAUSE: Record<string, number> = { ',': 2, ';': 3, ':': 3, '—': 2, '.': 4, '!': 4, '?': 4, '…': 4 };

/** Слова подписи с долей реплики [a, b) у каждого; сумма долей = 1. */
export function karaoke(text: string): KWord[] {
  const raw = text.split(/\s+/).filter(Boolean);
  if (!raw.length) return [];
  const wt = raw.map(w => Math.max(1, w.replace(/[^\p{L}\p{N}]/gu, '').length) + (PAUSE[w.slice(-1)] ?? 0));
  const sum = wt.reduce((x, y) => x + y, 0);
  let acc = 0;
  return raw.map((w, k) => { const a = acc / sum; acc += wt[k]; return { w, a, b: k === raw.length - 1 ? 1 : acc / sum }; });
}

/** Индекс слова, которое звучит при доле реплики p (0..1). */
export function wordAt(words: KWord[], p: number): number {
  if (!words.length) return -1;
  if (p <= 0) return 0;
  const k = words.findIndex(x => p < x.b);
  return k < 0 ? words.length - 1 : k;
}

/** Подсвеченные части выкладки [..] по порядку (для дробей и разрядов это сырой текст: «5/8», «005»). */
export const highlights = (math: string | undefined): string[] => [...(math ?? '').matchAll(/\[([^\]]+)\]/g)].map(m => m[1]);

const strip = (w: string) => w.replace(/^[^\p{L}\p{N}▢]+|[^\p{L}\p{N}▢]+$/gu, '');

/** Доля реплики, при которой голос называет подсвеченное: первое слово подписи, начинающееся с этого числа («2-ге» для «2»), иначе середина. */
export function cueFor(kz: string, hl: string, words: KWord[] = karaoke(kz)): number {
  const tok = hl.replace(/[\s  ]/g, '');
  if (!tok) return 0.5;
  const esc = tok.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
  const re = new RegExp(`^${esc}(?![\\d/,])`);
  const k = words.findIndex(x => re.test(strip(x.w).replace(/[\s  ]/g, '')));
  return k < 0 ? 0.5 : Math.min(0.9, words[k].a);
}

/** По доле на каждую подсвеченную часть кадра. */
export function cuesFor(kz: string, math: string | undefined): number[] {
  const words = karaoke(kz);
  return highlights(math).map(h => cueFor(kz, h, words));
}
