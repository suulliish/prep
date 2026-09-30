// Общие утилиты для шаблонов задач: случайность с зерном, точные дроби,
// форматирование чисел как в казахских тестах, сборка 5 вариантов ответа.

export function rng(seed = Date.now()) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const r = {
    next,
    int: (lo, hi) => lo + Math.floor(next() * (hi - lo + 1)),
    pick: arr => arr[Math.floor(next() * arr.length)],
    shuffle: arr => {
      const b = arr.slice();
      for (let i = b.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [b[i], b[j]] = [b[j], b[i]];
      }
      return b;
    },
    chance: p => next() < p,
  };
  return r;
}

// ---------- Точные дроби ----------
export const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a; };
export const lcm = (a, b) => a / gcd(a, b) * b;

export class Q {
  constructor(n, d = 1) {
    if (d === 0) throw new Error('division by zero');
    if (!Number.isInteger(n) || !Number.isInteger(d)) throw new Error('Q needs integers: ' + n + '/' + d);
    if (d < 0) { n = -n; d = -d; }
    const g = gcd(n, d) || 1;
    this.n = n / g; this.d = d / g;
  }
  static of(x) {
    if (x instanceof Q) return x;
    if (Number.isInteger(x)) return new Q(x);
    // десятичное число → дробь (до 6 знаков)
    const s = String(x); const k = (s.split('.')[1] || '').length;
    const p = 10 ** k;
    return new Q(Math.round(x * p), p);
  }
  add(o) { o = Q.of(o); return new Q(this.n * o.d + o.n * this.d, this.d * o.d); }
  sub(o) { o = Q.of(o); return new Q(this.n * o.d - o.n * this.d, this.d * o.d); }
  mul(o) { o = Q.of(o); return new Q(this.n * o.n, this.d * o.d); }
  div(o) { o = Q.of(o); return new Q(this.n * o.d, this.d * o.n); }
  neg() { return new Q(-this.n, this.d); }
  abs() { return new Q(Math.abs(this.n), this.d); }
  eq(o) { o = Q.of(o); return this.n === o.n && this.d === o.d; }
  lt(o) { o = Q.of(o); return this.n * o.d < o.n * this.d; }
  isInt() { return this.d === 1; }
  valueOf() { return this.n / this.d; }
  // конечная десятичная запись?
  isFiniteDecimal() { let d = this.d; while (d % 2 === 0) d /= 2; while (d % 5 === 0) d /= 5; return d === 1; }
}

// ---------- Форматирование ----------
const MINUS = '−';
// число как в тесте: десятичная запятая, типографский минус
export function num(x) {
  if (x instanceof Q) return x.isFiniteDecimal() ? num(x.n / x.d) : frac(x);
  const s = String(+(+x).toFixed(10));
  return s.replace('-', MINUS).replace('.', ',');
}
// обыкновенная дробь текстом: 7/8, −3/4
export function frac(q) {
  q = Q.of(q);
  if (q.isInt()) return num(q.n);
  return (q.n < 0 ? MINUS : '') + Math.abs(q.n) + '/' + q.d;
}
// смешанное число: 1 20/49
export function mixed(q) {
  q = Q.of(q);
  if (q.isInt()) return num(q.n);
  const s = q.n < 0 ? MINUS : '';
  const a = Math.abs(q.n), w = Math.floor(a / q.d), r = a % q.d;
  return s + (w ? w + ' ' : '') + r + '/' + q.d;
}
// дробь или десятичная — как удобнее читать
export function nice(q) { q = Q.of(q); return q.isFiniteDecimal() ? num(q) : frac(q); }

// ---------- Варианты ответа ----------
// correct: строка правильного ответа; wrong: [{v: строка, tag: 'типичная ошибка'}];
// filler(): запасной неправильный вариант, если типичных ошибок не хватило.
export function choices5(r, correct, wrong, filler) {
  const seen = new Set([correct]);
  const out = [];
  for (const w of wrong) {
    if (out.length === 4) break;
    if (w.v == null || seen.has(w.v)) continue;
    seen.add(w.v); out.push(w);
  }
  let guard = 0;
  while (out.length < 4) {
    if (++guard > 500) throw new Error('cannot fill choices for ' + correct);
    const v = filler();
    if (v == null || seen.has(v)) continue;
    seen.add(v); out.push({ v, tag: 'random' });
  }
  const all = r.shuffle([{ v: correct, tag: 'correct' }, ...out]);
  return { choices: all.map(c => ({ text: c.v, tag: c.tag })), answer: all.findIndex(c => c.tag === 'correct') };
}

// Числовой «шум» рядом с правильным ответом
export function near(r, x, spread = 0.3, step = 1) {
  const k = r.int(1, 4) * (r.chance(0.5) ? 1 : -1);
  const v = Math.round((x + k * Math.max(step, Math.abs(x) * spread / 4)) / step) * step;
  return v;
}

export const NAMES_KZ = ['Арман', 'Марат', 'Айжан', 'Дана', 'Әлия', 'Нұрлан', 'Бекзат', 'Аружан', 'Санжар', 'Томирис', 'Ерлан', 'Мадина'];
export const DAYS = [
  { kz: 'дүйсенбі', ru: 'понедельник' }, { kz: 'сейсенбі', ru: 'вторник' }, { kz: 'сәрсенбі', ru: 'среда' },
  { kz: 'бейсенбі', ru: 'четверг' }, { kz: 'жұма', ru: 'пятница' }, { kz: 'сенбі', ru: 'суббота' }, { kz: 'жексенбі', ru: 'воскресенье' },
];
// склонение числительных-суффиксов казахского не делаем автоматически:
// шаблоны пишут числа с дефисом и безопасным падежом (-ке/-ға не нужен).

// Казахские падежные окончания после числа, записанного цифрами: 189-ға, 5-ке, 40-қа.
// Выбор зависит от последнего слова числительного (бір, екі, үш… он, жиырма… жүз, мың).
const LAST_WORD = { 0: 'нөл', 1: 'бір', 2: 'екі', 3: 'үш', 4: 'төрт', 5: 'бес', 6: 'алты', 7: 'жеті', 8: 'сегіз', 9: 'тоғыз' };
const TENS = { 1: 'он', 2: 'жиырма', 3: 'отыз', 4: 'қырық', 5: 'елу', 6: 'алпыс', 7: 'жетпіс', 8: 'сексен', 9: 'тоқсан' };
function lastWord(n) {
  n = Math.abs(Math.trunc(n));
  if (n === 0) return 'нөл';
  if (n % 10) return LAST_WORD[n % 10];
  if (n % 100) return TENS[(n % 100) / 10];
  if (n % 1000) return 'жүз';
  if (n % 1000000) return 'мың';
  return 'миллион';
}
const BACK = /[аоұыә]/; // твёрдые гласные (ә тут не бывает в числительных; оставлено для ясности)
function harmony(word) {
  word = word.replace(/я/g, 'а').replace(/ю/g, 'у');
  const vowels = word.match(/[аәеиоөұүыіу]/g) || ['е'];
  // «у» и «и» нейтральны: смотрим на предыдущий гласный; без него «у» — твёрдый, «и» — мягкий
  // имя на «-ис», «-ир» (Томирис, Әмир): последний слог с «и» даёт мягкое окончание — Томиристің, Әмирге
  if (vowels[vowels.length - 1] === 'и' && vowels.length > 1) return 'front';
  const strong = vowels.filter(v => v !== 'у' && v !== 'и');
  if (!strong.length) return vowels[vowels.length - 1] === 'у' ? 'back' : 'front';
  return /[аоұы]/.test(strong[strong.length - 1]) ? 'back' : 'front';
}
// барыс септігі (дательный): -ға/-ге/-қа/-ке
export function dat(n) {
  const w = lastWord(n), back = harmony(w) === 'back';
  const voiceless = /[кқпстфхцчшщ]$/.test(w);
  const suf = voiceless ? (back ? 'қа' : 'ке') : (back ? 'ға' : 'ге');
  return num(n) + '-' + suf;
}
// жатыс септігі (местный): -да/-де/-та/-те
export function loc(n) {
  const w = lastWord(n), back = harmony(w) === 'back';
  const voiceless = /[кқпстфхцчшщ]$/.test(w);
  return num(n) + '-' + (voiceless ? (back ? 'та' : 'те') : (back ? 'да' : 'де'));
}
// шығыс септігі (исходный): -дан/-ден/-тан/-тен/-нан/-нен
export function abl(n) {
  const w = lastWord(n), back = harmony(w) === 'back';
  const suf = /[нмң]$/.test(w) ? (back ? 'нан' : 'нен') : /[кқпстфхцчшщ]$/.test(w) ? (back ? 'тан' : 'тен') : (back ? 'дан' : 'ден');
  return num(n) + '-' + suf;
}

// Имена: родительный падеж (ілік) и союз «мен/бен/пен».
export function genKz(name) {
  const last = name.slice(-1).toLowerCase(), back = harmony(name.toLowerCase()) === 'back';
  let s;
  if (/[аәеиоөұүыіэюя]/.test(last) || /[мнң]/.test(last)) s = back ? 'ның' : 'нің';
  else if (/[жзлрйу]/.test(last)) s = back ? 'дың' : 'дің';
  else s = back ? 'тың' : 'тің';
  return name + s;
}
export function andKz(name) {
  const last = name.slice(-1).toLowerCase();
  if (/[жз]/.test(last)) return name + ' бен';
  if (/[кқпстфхцчшщ]/.test(last)) return name + ' пен';
  return name + ' мен';
}

// Падежи для слов (не чисел): барыс (-ға/-ге/-қа/-ке), шығыс (-дан/-нан/-тан…).
export function datKz(w) {
  const back = harmony(w.toLowerCase()) === 'back', last = w.slice(-1).toLowerCase();
  if (/[кқпстфхцчшщ]/.test(last)) return w + (back ? 'қа' : 'ке');
  return w + (back ? 'ға' : 'ге');
}
export function ablKz(w) {
  const back = harmony(w.toLowerCase()) === 'back', last = w.slice(-1).toLowerCase();
  if (/[мнң]/.test(last)) return w + (back ? 'нан' : 'нен');
  if (/[кқпстфхцчшщ]/.test(last)) return w + (back ? 'тан' : 'тен');
  return w + (back ? 'дан' : 'ден');
}

// Процент для варианта ответа: конечная десятичная — как есть, иначе округление до десятых (≈)
export function pct(q) {
  q = Q.of(q);
  if (q.isFiniteDecimal()) return num(q) + '%';
  return '≈' + num(Math.round(q.n / q.d * 10) / 10) + '%';
}

// Число словами по-казахски (для озвучки): 7008012 → «жеті миллион сегіз мың он екі».
const ONES = ['', 'бір', 'екі', 'үш', 'төрт', 'бес', 'алты', 'жеті', 'сегіз', 'тоғыз'];
function below1000(n) {
  const h = Math.floor(n / 100), t = Math.floor(n / 10) % 10, o = n % 10, w = [];
  if (h) w.push(h === 1 ? 'жүз' : ONES[h] + ' жүз');
  if (t) w.push(TENS[t]);
  if (o) w.push(ONES[o]);
  return w.join(' ');
}
export function kzWords(n) {
  n = Math.trunc(n);
  if (n === 0) return 'нөл';
  if (n < 0) return 'минус ' + kzWords(-n);
  const parts = [], m = Math.floor(n / 1e6), th = Math.floor(n / 1000) % 1000, u = n % 1000;
  if (m) parts.push(below1000(m) + ' миллион');
  if (th) parts.push(th === 1 ? 'мың' : below1000(th) + ' мың');
  if (u) parts.push(below1000(u));
  return parts.join(' ');
}
