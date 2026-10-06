// Общие независимые вычислители для tests/equations5.test.ts и tests/lessons_week10.test.ts (не тест: vitest берёт только *.test.ts).
// Разбор условий и подстановка делаются здесь, без кода шаблонов content/templates/equations5.mjs.
export const LETTER = /(?<![A-Za-z])[a-z](?![A-Za-z])/g;

/** Компилирует выражение с буквами («5n + 2», «3 · x − 4», «a(b − 2)», «(m + 3) · 2») в функцию от значений букв. Деление дробное. */
const cache = new Map<string, Function>();
export function compile(src: string): { f: Function; names: string[] } {
  const names = [...new Set(src.match(/[a-z]/g) ?? [])];
  const key = src;
  if (!cache.has(key)) {
    const s = src.replace(/−/g, '-').replace(/·/g, '*').replace(/:/g, '/').replace(/,/g, '.')
      .replace(/(\d|\))\s*(?=[a-z(])/g, '$1*').replace(/([a-z])\s*(?=\()/g, '$1*').replace(/([a-z])(?=[a-z])/g, '$1*');
    cache.set(key, new Function(...names, `return (${s})`));
  }
  return { f: cache.get(key)!, names };
}
export function evalExpr(src: string, vars: Record<string, number>): number {
  const { f, names } = compile(src);
  return f(...names.map(n => { if (!(n in vars)) throw new Error('нет значения ' + n + ' в ' + src); return vars[n]; }));
}
export const sides = (eq: string) => eq.split('=').map(x => x.trim()) as [string, string];
/** Корни уравнения от одной буквы среди натуральных 1..1500. */
export function roots(eq: string): number[] {
  const v = eq.match(LETTER)![0], [l, r] = sides(eq), L = compile(l).f, R = compile(r).f, out: number[] = [];
  for (let x = 1; x <= 1500; x++) if (Math.abs(L(x) - R(x)) < 1e-9) out.push(x);
  return out;
}

/** Разбор условия «составь выражение»: возвращает функцию n → ожидаемое значение. Независимо от шаблона, по ключевым словам текста. */
export function compose1(kz: string): (n: number) => number {
  const a = (re: RegExp) => +re.exec(kz)![1];
  if (/есе көп/.test(kz)) { const k = a(/(\d+) есе көп/); return n => k * n; }
  if (/тең бөлді/.test(kz)) { const k = a(/(\d+) балаға/); return n => n / k; }
  if (/артық\./.test(kz)) { const k = a(/(\d+) \S+ артық/); return n => n + k; }
  if (/кем\./.test(kz)) { const k = a(/(\d+) \S+ кем/); return n => n - k; }
  if (/Оған тағы/.test(kz)) { const k = a(/Оған тағы (\d+)/); return n => n + k; }
  if (/Одан (\d+)/.test(kz)) { const k = a(/Одан (\d+)/); return n => n - k; }
  if (/Әр қорапта/.test(kz)) { const k = a(/\. (\d+) қорапта/); return n => k * n; }
  throw new Error('не распознано: ' + kz);
}
export function compose2(kz: string): (n: number) => number {
  const a = (re: RegExp) => +re.exec(kz)![1];
  if (/есе көп/.test(kz) && /алды/.test(kz)) { const k = a(/(\d+) есе көп/), b = a(/(\d+) \S+ алды/); return n => k * n - b; }
  if (/бөлек жатыр/.test(kz)) { const k = a(/^(\d+) қорапта/), b = a(/тағы (\d+)/); return n => k * n + b; }
  if (/Екі қорапта/.test(kz) && /артық/.test(kz)) { const b = a(/(\d+) \S+ артық/); return n => n + (n + b); }
  if (/Екі қорапта/.test(kz) && /кем/.test(kz)) { const b = a(/(\d+) \S+ кем/); return n => n + (n - b); }
  throw new Error('не распознано: ' + kz);
}

/** Составляет уравнение по тексту задачи (свой разбор) и возвращает функцию «левая часть − правая» от x. */
export function storyEq(kz: string): (x: number) => number {
  let m: RegExpExecArray | null;
  if ((m = /Одан (\d+) \S+ алғанда, (\d+) \S+ қалды/.exec(kz)) && /^Қорапта бірнеше/.test(kz)) return x => x - +m![1] - +m![2];
  if ((m = /Оған (\d+) \S+ қосқанда, барлығы (\d+)/.exec(kz))) return x => x + +m![1] - +m![2];
  if ((m = /бірдей (\d+) \S+ бар\. Барлығы (\d+)/.exec(kz))) return x => +m![1] * x - +m![2];
  if ((m = /(\d+) балаға тең бөлгенде, әр балаға (\d+)/.exec(kz))) return x => x / +m![1] - +m![2];
  // два шага
  if ((m = /^(\d+) қорапта бірдей санда \S+ бар, тағы (\d+) \S+ бөлек жатыр\. Барлығы (\d+)/.exec(kz))) return x => +m![1] * x + +m![2] - +m![3];
  if ((m = /^(\d+) қорапта бірдей санда \S+ болды\. Одан (\d+) \S+ алғанда, (\d+)/.exec(kz))) return x => +m![1] * x - +m![2] - +m![3];
  if ((m = /(\d+) дәптер мен (\d+) теңгелік қарындаш .*барлығы (\d+) теңге/.exec(kz))) return x => +m![1] * x + +m![2] - +m![3];
  // задуманное число
  if ((m = /Ойлаған санды (\d+)-\S+ (көбейтіп|бөліп), нәтижеге (\d+) қосқанда (\d+) шықты/.exec(kz))) { const [a, op, b, c] = [+m[1], m[2], +m[3], +m[4]]; return x => (op === 'көбейтіп' ? a * x : x / a) + b - c; }
  if ((m = /Ойлаған санды (\d+)-\S+ (көбейтіп|бөліп), нәтижеден (\d+) азайтқанда (\d+) шықты/.exec(kz))) { const [a, op, b, c] = [+m[1], m[2], +m[3], +m[4]]; return x => (op === 'көбейтіп' ? a * x : x / a) - b - c; }
  throw new Error('не распознано: ' + kz);
}
