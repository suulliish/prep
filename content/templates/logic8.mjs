// Шаблоны логики 8-й недели: ребусы (әріп = цифр). «Бірдей әріп — бірдей цифр, әртүрлі әріп — әртүрлі цифр, сан нөлден басталмайды.»
// Контракт как у logic7.mjs: gen(r) -> { kz, ru, choices (5), answer, hints (3 ступени без ответа), sol{kz,ru} }.
// Главное требование: у каждой задачи ЕДИНСТВЕННЫЙ ответ. Генератор сам перебирает все расстановки цифр (solveCrypt: столбик справа налево
// с переносом, оптимум — полным перебором) и отбрасывает задачу, если вопрос имеет больше одного ответа. Полное решение ребуса может
// быть не единственным (как в реальных задачах): единственным должен быть ответ на вопрос.
// Формы ребусов (SHAPES_*) выбраны перебором (запуск один раз): в каждой у какого-то вопроса единственный ответ, решений немного.
// Метки ошибок лежат в content/misconceptions.mjs (в конце файла).
import { choices5 } from './lib.mjs';

const T = (kz, ru) => ({ kz, ru });
const S = x => String(x);
const MINUS = '−';
const POOL = ['А', 'Б', 'В', 'Г', 'Д', 'Е', 'Ж', 'К', 'Л', 'М', 'Н', 'П', 'Р', 'С', 'Т', 'Х'];

// ============================================================ решатель ============================================================
/** Все расстановки цифр для words[0] + words[1] + … = sum. Столбик справа налево с переносом.
 *  opts: lead (первая цифра многозначного числа ≠ 0, по умолчанию да), distinct (разные буквы — разные цифры, по умолчанию да),
 *  limit (остановиться после стольких решений; truncated.length === limit значит «их больше»). */
export function solveCrypt(words, sum, { lead = true, distinct = true, limit = 5000 } = {}) {
  const all = [...words, sum];
  const leadSet = new Set(lead ? all.filter(w => w.length > 1).map(w => w[0]) : []);
  const L = Math.max(sum.length, ...words.map(w => w.length));
  const cols = [];
  for (let c = 0; c < L; c++) cols.push({ add: words.map(w => w[w.length - 1 - c]).filter(x => x !== undefined), s: sum[sum.length - 1 - c] });
  const asg = {}, used = Array(10).fill(0), out = [];
  const col = (c, carry) => {
    if (out.length >= limit) return;
    if (c === L) { if (carry === 0) out.push({ ...asg }); return; }
    const { add, s } = cols[c];
    const need = [...new Set([...add, ...(s ? [s] : [])])].filter(x => asg[x] === undefined);
    const go = i => {
      if (out.length >= limit) return;
      if (i === need.length) {
        const tot = add.reduce((a, x) => a + asg[x], 0) + carry;
        if (tot % 10 === (s === undefined ? 0 : asg[s])) col(c + 1, Math.floor(tot / 10));
        return;
      }
      const x = need[i];
      for (let d = leadSet.has(x) ? 1 : 0; d <= 9; d++) {
        if (distinct && used[d]) continue;
        used[d]++; asg[x] = d; go(i + 1); used[d]--; delete asg[x];
      }
    };
    go(0);
  };
  col(0, 0);
  return out;
}
const numOf = (w, a) => Number(w.split('').map(l => a[l]).join(''));
const holdsEq = (words, sum, a) => words.reduce((s, w) => s + numOf(w, a), 0) === numOf(sum, a);

/** Полный перебор оптимума для линейного выражения Σ coef[l]·цифра(l): mode 'max' | 'min'; leadSet — буквы, которые ≠ 0. */
export function optimize(coef, leadSet, mode, distinct = true) {
  const ls = Object.keys(coef), used = Array(10).fill(0), cur = {};
  let best = null, arg = null;
  const go = (i, val) => {
    if (i === ls.length) { if (best === null || (mode === 'max' ? val > best : val < best)) { best = val; arg = { ...cur }; } return; }
    const l = ls[i];
    for (let d = leadSet.has(l) ? 1 : 0; d <= 9; d++) {
      if (distinct && used[d]) continue;
      used[d]++; cur[l] = d; go(i + 1, val + coef[l] * d); used[d]--;
    }
  };
  go(0, 0);
  return { value: best, arg };
}

// ============================================================ общее ============================================================
const RULES = {
  kz: 'Бірдей әріптердің орнында бірдей цифрлар, әртүрлі әріптердің орнында әртүрлі цифрлар тұр. Сан нөлден басталмайды.',
  ru: 'Одинаковым буквам соответствуют одинаковые цифры, разным буквам — разные. Число не начинается с нуля.',
};
const listAsg = (a, letters) => letters.map(l => `${l} = ${a[l]}`).join(', ');
const relabel = (shape, r) => {
  const letters = [...new Set(shape.replace(/[+=]/g, ''))];
  const pick = r.shuffle(POOL).slice(0, letters.length), map = Object.fromEntries(letters.map((l, i) => [l, pick[i]]));
  let [left, sum] = shape.split('='), words = left.split('+').map(w => [...w].map(c => map[c]).join(''));
  sum = [...sum].map(c => map[c]).join('');
  if (r.chance(0.5)) words = words.slice().reverse();
  return { words, sum, letters: pick };
};
const eqText = (words, sum) => `${words.join(' + ')} = ${sum}`;

// ----- ребусы «найди цифру» (T1, T2, T3) -----
/** Подсказки: 3 ступени, без цифр (чтобы не выдать ответ). */
function letterHints({ carryUp, mirror, target }) {
  return [
    T(carryUp
      ? 'Алдымен бірліктер бағанын қара: онда қандай әріптер қосылады? Нәтиженің соңғы цифры қандай болуы керек? Сосын қосындының ең алдыңғы әрпін ойлан: ол қайдан шығады?'
      : 'Алдымен бірліктер бағанын қара: онда қандай әріптер қосылады? Нәтиженің соңғы цифры қандай болуы керек?',
    carryUp
      ? 'Сначала посмотри на столбец единиц: какие буквы там складываются? Какой должна быть последняя цифра результата? Затем подумай о первой букве суммы: откуда она берётся?'
      : 'Сначала посмотри на столбец единиц: какие буквы там складываются? Какой должна быть последняя цифра результата?'),
    T(mirror
      ? 'Екі қосылғыш бірдей цифрлардан тұрады, тек кері ретпен. Әр бағанда қандай қосынды шығатынын салыстыр. Ойда қалатын цифрды (ондыққа асқанын) ұмытпа.'
      : 'Бағаннан бағанға ауысатын цифрды (ондыққа асқанын) ұмытпа: әр бағанда ол қосындыға қосылады. Ол тек нөл немесе бір болады.',
    mirror
      ? 'Оба слагаемых состоят из одних и тех же цифр, только в обратном порядке. Сравни, какая сумма получается в каждом столбце. Не забудь перенос (то, что «ушло в следующий разряд»).'
      : 'Не забывай перенос из столбца в столбец: в каждом столбце он прибавляется к сумме. Он бывает только нулём или единицей.'),
    T(target === 'sum'
      ? 'Әр әріпке цифрларды бір-бірлеп қойып көр: әртүрлі әріптерге әртүрлі цифрлар, санның бірінші цифры нөл емес. Қосындысы әрқашан бірдей болатын екі әріпті тап.'
      : 'Әр әріпке мүмкін цифрларды бір-бірлеп қойып көр: әртүрлі әріптерге әртүрлі цифрлар, санның бірінші цифры нөл емес. Шешімдер бірнешеу болуы мүмкін, бірақ сұралған әріптің цифры бірдей.',
    target === 'sum'
      ? 'Подставляй цифры по очереди: разным буквам разные цифры, первая цифра числа не нуль. Найди две буквы, сумма которых во всех решениях одна и та же.'
      : 'Пробуй возможные цифры по очереди: разным буквам разные цифры, первая цифра числа не нуль. Решений может быть несколько, но цифра нужной буквы одна и та же.'),
  ];
}

/** Подсказки к «первая цифра суммы»: без цифр и без самого ответа. */
function leadHints(words) {
  const one = words.every(w => w.length === 1);
  return [
    T(one ? 'Бір таңбалы екі санның қосындысы ең көбі қанша болады? Қосынды екі таңбалы болу үшін не керек?' : 'Ең үлкен қосылғыштарды ойла: олардың қосындысы шамамен қанша болады? Қосындыда қосылғыштардан бір таңба артық.',
      one ? 'Чему может быть равна сумма двух однозначных чисел, не больше скольки? Что нужно, чтобы сумма была двузначной?' : 'Представь самые большие слагаемые: чему примерно равна их сумма? В сумме на один знак больше, чем в слагаемых.'),
    T('Екі санды қосқанда келесі разрядқа қанша ауыса алады? Ең үлкен цифрларды және ойда қалған цифрды қосып тексер.',
      'Сколько может перейти в следующий разряд при сложении двух чисел? Проверь: сложи самые большие цифры и перенос.'),
    T('Сан нөлден басталмайды. Ауысатын цифр ең көбі қанша болатынын, ал нөл болмайтынын ескер: бұл әріпке қандай цифр қалады?',
      'Число не начинается с нуля. Учти, чем может быть перенос и что нулём он быть не может: какая цифра остаётся для этой буквы?'),
  ];
}

/** Значения f при нарушенных правилах: (а) ноль разрешён первой цифре, (б) разные буквы могут получить одну цифру. Так рождаются настоящие ошибки. */
function relaxedValues(words, sum, f) {
  const uniq = a => [...new Set(a.map(f))];
  return { noLead: uniq(solveCrypt(words, sum, { lead: false, limit: 1500 })), noDist: uniq(solveCrypt(words, sum, { distinct: false, limit: 1500 })) };
}

/** Ребус с единственным ответом на вопрос. cfg.pickShape(r) -> shape; cfg.mode: 'digit' | 'lead'; cfg.pairs: можно спрашивать сумму двух букв.
 *  Возвращает { words, sum, letters, sols (все решения), target ({kind:'letter', l} | {kind:'sum', x, y}), f (значение цели в решении), v (единственный ответ) }. */
export function pickPuzzle(r, cfg) {
  for (let tries = 0; tries < 60; tries++) {
    const shape = cfg.pickShape(r);
    const { words, sum, letters } = relabel(shape, r);
    const sols = solveCrypt(words, sum, { limit: 3000 });
    if (!sols.length || sols.length >= 3000) continue;
    const value = f => new Set(sols.map(f));
    const isUniq = f => value(f).size === 1;
    const carryUp = sum.length > Math.max(...words.map(w => w.length));
    const leadLetter = sum[0];
    // цели вопроса
    let target = null;
    if (cfg.mode === 'lead') {
      if (!carryUp || !isUniq(a => a[leadLetter])) continue;
      target = { kind: 'letter', l: leadLetter };
    } else {
      const uniqLetters = letters.filter(l => isUniq(a => a[l]));
      const nonLead = uniqLetters.filter(l => l !== leadLetter || !carryUp);
      const pairs = [];
      for (let i = 0; i < letters.length; i++) for (let j = i + 1; j < letters.length; j++) {
        const x = letters[i], y = letters[j];
        if (isUniq(a => a[x] + a[y]) && !(isUniq(a => a[x]) && isUniq(a => a[y]))) pairs.push([x, y]);
      }
      if (cfg.pairs && pairs.length && (r.chance(0.4) || !nonLead.length)) { const [x, y] = r.pick(pairs); target = { kind: 'sum', x, y }; }
      else if (nonLead.length) target = { kind: 'letter', l: r.pick(nonLead) };
      else continue;
    }
    const f = target.kind === 'sum' ? a => a[target.x] + a[target.y] : a => a[target.l];
    return { words, sum, letters, sols, target, f, v: f(sols[0]), carryUp, leadLetter };
  }
  throw new Error('crypt: no puzzle found');
}

/** Общий генератор «найди цифру» для T1, T2, T3. */
function letterItem(r, cfg) {
  const { words, sum, letters, sols, target, f, v, carryUp, leadLetter } = pickPuzzle(r, cfg);
  const example = r.pick(sols);

  // ---- варианты ответа ----
  const wrong = [];
  const top = target.kind === 'sum' ? 18 : 9;                          // у одной буквы — одна цифра, у суммы двух — до 18
  const push = (x, tag) => { const s = S(x); if (Number.isInteger(x) && x >= 0 && x <= top && x !== v && !wrong.some(y => y.v === s)) wrong.push({ v: s, tag }); };
  if (cfg.mode === 'lead') {
    push(0, 'zero_first_allowed'); push(2, 'carry_more_than_one');
    r.shuffle([3, 4, 5, 8, 9]).forEach(x => push(x, 'random'));
  } else {
    const w = relaxedValues(words, sum, f);
    const nl = r.shuffle(w.noLead), nd = r.shuffle(w.noDist);
    nl.slice(0, 2).forEach(x => push(x, 'zero_first_allowed'));
    nd.slice(0, 2).forEach(x => push(x, 'same_digit_two_letters'));
    push(v + 1, 'forgot_carry'); push(v - 1, 'forgot_carry');
    if (target.kind === 'letter') r.shuffle(letters.filter(l => l !== target.l)).forEach(l => push(example[l], 'mixed_letters'));
    nl.slice(2).forEach(x => push(x, 'zero_first_allowed')); nd.slice(2).forEach(x => push(x, 'same_digit_two_letters'));
  }
  const { choices, answer } = choices5(r, S(v), wrong, () => S(r.int(0, top)));

  // ---- тексты ----
  const eq = eqText(words, sum);
  const askKz = target.kind === 'sum'
    ? `${target.x} + ${target.y} қосындысы неге тең?`
    : r.pick([`${target.l} әріпінің орнында қандай цифр тұр?`, `${target.l} әріпі қандай цифрды білдіреді?`]);
  const askRu = target.kind === 'sum'
    ? `чему равна сумма ${target.x} + ${target.y}?`
    : r.pick([`какая цифра стоит вместо буквы ${target.l}?`, `какую цифру обозначает буква ${target.l}?`]);
  const mirror = words.length === 2 && [...words[0]].reverse().join('') === words[1];
  const all = letters.filter(l => eq.includes(l));
  const check = `${words.map(x => numOf(x, example)).join(' + ')} = ${numOf(sum, example)}`;
  const many = sols.length > 1;
  const why = cfg.mode === 'lead' || (target.kind === 'letter' && target.l === leadLetter && carryUp)
    ? T('Екі санды қосқанда келесі разрядқа ең көбі бір ауысады, сондықтан қосындының ең алдыңғы цифры сол бір болады. ', 'При сложении двух чисел в следующий разряд переходит не больше единицы, поэтому первая цифра суммы равна этой единице. ')
    : T('', '');
  const ansTxt = target.kind === 'sum' ? `${target.x} + ${target.y} = ${v}` : `${target.l} = ${v}`;
  return {
    kz: `Ребус. ${RULES.kz} Төмендегі теңдікте ${askKz}\n${eq}`,
    ru: `Ребус. ${RULES.ru} В равенстве ниже ${askRu}\n${eq}`,
    choices, answer,
    hints: cfg.mode === 'lead' ? leadHints(words) : letterHints({ carryUp, mirror, target: target.kind }),
    sol: {
      kz: `${why.kz}Мысалы, ${listAsg(example, all)} болса: ${check}, теңдік дұрыс. ${many ? `Басқа шешімдер де бар, бірақ әрқашан ${ansTxt}.` : `Бұл жалғыз шешім: ${ansTxt}.`}`,
      ru: `${why.ru}Например, при ${listAsg(example, all)}: ${check}, равенство верно. ${many ? `Есть и другие решения, но всегда ${ansTxt}.` : `Это единственное решение: ${ansTxt}.`}`,
    },
  };
}

// ============================================================ формы ребусов ============================================================
// два двузначных без переполнения (столбик единиц: B + B оканчивается на B)
const SHAPES_NO_CARRY = ['AA+AB=CA', 'AB+AB=CB', 'AB+AC=BA', 'AB+AC=BB', 'AB+AC=CA', 'AB+AC=CC', 'AB+CB=BA', 'AB+CB=BC'];
// зеркальные двузначные АБ + БА = 11 · (А + Б)
const SHAPES_MIRROR2 = ['AB+BA=AAC', 'AB+BA=BBC', 'AB+BA=CAC', 'AB+BA=CAD', 'AB+BA=CBC', 'AB+BA=CBD', 'AB+BA=CCD', 'AB+BA=CDC'];
// два двузначных, сумма трёхзначная
const SHAPES_2 = ['AB+CA=ADC', 'AA+AB=CDA', 'AB+AC=DBB', 'AA+BC=DBD', 'AB+CB=BBD', 'AB+BC=BCB', 'AA+BA=CBD', 'AB+CB=ADC', 'AA+BB=CDC', 'AB+CA=CCD', 'AB+BC=CAD', 'AB+AB=CDB', 'AB+AC=CCD',
  'AB+CB=BDA', 'AA+AB=CCD', 'AB+BC=DCA', 'AA+BC=BDD', 'AB+CC=BBD', 'AB+CD=CCC', 'AB+CA=DBC', 'AB+CC=DAA', 'AB+AC=DAD', 'AA+BC=ADD', 'AB+AC=BCA', 'AB+CB=DBA',
  'AB+CD=BDA', 'AB+CA=BBC', 'AB+BC=AAA', 'AB+CB=AAD', 'AA+BB=CAD', 'AB+BB=AAC', 'AB+CA=CBA', 'AB+AC=BBD', 'AB+CB=BBC', 'AB+CD=DBA', 'AB+BB=BCD', 'AB+CC=CDA', 'AA+AB=CAD',
  'AB+CB=DBB', 'AB+BC=ADA', 'AB+AC=DCC', 'AA+BC=BBB', 'AB+CA=DDA', 'AB+CC=DCD'];
// зеркальные трёхзначные АБВ + ВБА (реальный ребус с DDDD в банке сюда намеренно не входит)
const SHAPES_MIRROR3 = ['ABC+CBA=DDDE', 'ABC+CBA=DEDD', 'ABC+CBA=DEFD', 'ABC+CBA=DEFF', 'ABC+CBA=DDEF'];
// трёхзначные и смешанные
const SHAPES_3 = ['ABC+ACB=BDBB', 'ABA+BCD=AEAB', 'ABC+ACA=DAB', 'ABA+CBD=DDCC', 'ABC+ADA=BCEB', 'ABC+ADA=CEAD', 'ABC+CDE=BEAA', 'ABC+DCD=DDDE', 'ABC+ACB=DDCD', 'ABC+DAD=EBED',
  'ABC+CDC=ABCD', 'ABC+ADA=DDCA', 'ABC+BDC=AAED', 'ABA+ACB=DBEE', 'ABC+CBC=BBAD', 'ABA+ACD=CBEA', 'ABC+ACD=DBBD', 'ABC+DEC=EBEA', 'ABC+ADC=CCCB', 'ABC+BCA=BDAE', 'ABC+ADE=CECA',
  'ABA+CDA=BCC', 'ABC+DAB=CDDA', 'ABC+ACD=BDB', 'ABC+BAD=CDCB', 'AB+ACB=BAD', 'AB+ACB=CAD', 'AB+CDB=ADD', 'AB+CAC=ADA', 'ABA+CA=BBD', 'AB+CAB=AAD', 'ABA+CA=DCC', 'ABC+BD=DAA',
  'ABA+BC=BDA', 'AB+CAD=ADD', 'ABC+BA=DAA', 'ABC+DB=CCD', 'ABC+DC=BBB', 'ABC+BA=CCD'];
// сумма длиннее слагаемых, первая буква суммы встречается один раз: там всегда единица
const SHAPES_LEAD = ['A+B=CD', 'A+B=CC', 'A+A=BC', 'AB+AC=DBC', 'AB+CB=DEB', 'AB+AC=DEE', 'AB+CB=DCE', 'AB+AC=DCE', 'AB+AB=CBD', 'AB+CA=DAE', 'AB+CB=DCC', 'AB+AB=CDA', 'AB+BC=DCA', 'AB+CD=EDC',
  'AB+CD=EAA', 'AB+BA=CBD', 'AB+CA=DEC', 'ABA+CDB=ECCD', 'ABB+BCD=EBDB', 'ABA+CCB=DEFF', 'ABA+CBB=DEAE', 'ABC+DCC=ECAF', 'ABB+BAC=DEFB', 'ABC+CAD=EBFB', 'ABC+ADE=FECD', 'ABC+DAA=EBFB',
  'ABB+ACC=DBCC', 'ABC+ABD=EACB', 'ABC+DAB=EFAA'];

export const SHAPES = { noCarry: SHAPES_NO_CARRY, mirror2: SHAPES_MIRROR2, two: SHAPES_2, mirror3: SHAPES_MIRROR3, three: SHAPES_3, lead: SHAPES_LEAD };
const weighted = (r, groups) => { const tot = groups.reduce((a, g) => a + g[0], 0); let x = r.next() * tot; for (const [w, list] of groups) { if ((x -= w) < 0) return r.pick(list); } return r.pick(groups[0][1]); };

// ============================================================ «максимум и минимум» ============================================================
/** Наибольшее/наименьшее значение: вес каждой буквы = сумма её разрядов (10 у десятков, 1 у единиц) по всем словам; полный перебор даёт оптимум.
 *  Возвращает { kind: 'max'|'min'|'diff', mode, expr, words, coef, lead, v, best ({value, arg}), traps ([{v, tag}]) }. */
export function pickExtreme(r) {
  for (let tries = 0; tries < 200; tries++) {
    const kind = r.pick(['max', 'max', 'min', 'min', 'diff']);
    let words, expr, lead, ls;
    const coef = {};
    if (kind === 'diff') {
      // разность слова и его перестановки: АБВ − БВА
      const k = r.pick([2, 3, 3]);
      ls = r.shuffle(POOL).slice(0, k);
      let perm; do perm = r.shuffle(ls); while (perm.join('') === ls.join(''));
      words = [ls.join(''), perm.join('')];
      expr = `${words[0]} ${MINUS} ${words[1]}`;
      const wgt = k === 2 ? [10, 1] : [100, 10, 1];
      ls.forEach((l, i) => { coef[l] = (coef[l] ?? 0) + wgt[i]; });
      perm.forEach((l, i) => { coef[l] = (coef[l] ?? 0) - wgt[i]; });
      lead = new Set([words[0][0], words[1][0]]);
    } else {
      // сумма двузначных слов; одно слово может повториться
      ls = r.shuffle(POOL).slice(0, r.pick([4, 5]));
      const m = r.pick([3, 4, 4, 5]);
      words = null;
      for (let g = 0; g < 60 && !words; g++) {
        const ws = Array.from({ length: m }, () => r.shuffle(ls).slice(0, 2).join(''));
        if (ls.every(l => ws.some(w => w.includes(l)))) words = ws;
      }
      if (!words) continue;
      if (m >= 4 && r.chance(0.5)) words[m - 1] = words[0];
      if (!ls.every(l => words.some(w => w.includes(l)))) continue;
      for (const w of words) { coef[w[0]] = (coef[w[0]] ?? 0) + 10; coef[w[1]] = (coef[w[1]] ?? 0) + 1; }
      expr = words.join('+');
      lead = new Set(words.map(w => w[0]));
    }
    const mode = kind === 'min' ? 'min' : 'max';
    if (kind !== 'diff' && new Set(Object.values(coef)).size < 3) continue;
    const best = optimize(coef, lead, mode);
    const v = best.value;
    if (kind === 'diff' && v <= 0) continue;
    // ловушки
    const traps = [];
    const add = (x, tag) => { if (Number.isInteger(x) && x >= 0 && x !== v && !traps.some(t => t.v === S(x))) traps.push({ v: S(x), tag }); };
    const dup = optimize(coef, lead, mode, false).value;                 // разные буквы могут получить одну цифру
    add(dup, 'same_digit_two_letters');
    const noLead = optimize(coef, new Set(), mode).value;                // ноль разрешён и первой цифре
    add(noLead, 'zero_first_allowed');
    if (kind !== 'diff') {
      const byCount = ls.slice().filter(l => coef[l] !== undefined).sort((a, b) => words.join('').split(a).length - words.join('').split(b).length).reverse();
      const digs = mode === 'max' ? [9, 8, 7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
      add(byCount.reduce((s, l, i) => s + coef[l] * digs[i], 0), 'ignored_place_value');
      const order = []; for (const ch of words.join('')) if (!order.includes(ch)) order.push(ch);
      add(order.reduce((s, l, i) => s + coef[l] * digs[i], 0), 'greedy_by_order');
      if (mode === 'min') { const asc = Object.entries(coef).sort((a, b) => b[1] - a[1]); add(asc.reduce((s, [, c], i) => s + c * (i + 1), 0), 'zero_unused'); }
    } else add(Math.max(...Object.values(coef).map(Math.abs)) * 8, 'random');
    if (mode === 'min' && !traps.some(t => t.tag === 'zero_first_allowed')) continue;   // у минимума ловушка про ноль должна существовать
    return { kind, mode, expr, words, coef, lead, v, best, traps };
  }
  throw new Error('extreme: no puzzle found');
}

function extremeItem(r) {
  const { kind, mode, expr, coef, v, best, traps } = pickExtreme(r);
  const { choices, answer } = choices5(r, S(v), traps, () => S(Math.max(1, v + r.int(-30, 30) * (kind === 'diff' ? 9 : 1))));
  const asg = best.arg, weights = Object.entries(coef).filter(([, c]) => c !== 0).map(([l, c]) => `${l} — ${c < 0 ? MINUS + (-c) : c}`).join(', ');
  const asgTxt = listAsg(asg, Object.keys(coef));
  const kzQ = kind === 'min' ? 'ең кіші' : 'ең үлкен', ruQ = kind === 'min' ? 'наименьшее' : 'наибольшее';
  const kzSol = kind === 'diff'
    ? `Айырмада әр әріптің салмағы: ${weights}. Оң салмақты әріпке үлкен цифр, теріс салмақты әріпке кіші цифр береміз, бірақ нөл бірінші цифр бола алмайды: ${asgTxt}. Нәтиже: ${v}.`
    : `Әр әріптің салмағы (ондық орнында 10, бірлік орнында 1, қосындылап): ${weights}. ${mode === 'max' ? 'Ең үлкен цифрларды ең үлкен салмаққа береміз' : 'Ең кіші цифрларды ең кіші салмаққа береміз, ал нөлді бірінші цифр бола алмайтын әріпке береміз'}: ${asgTxt}. Мәні: ${v}.`;
  const ruSol = kind === 'diff'
    ? `Вес каждой буквы в разности: ${weights}. Букве с положительным весом даём большую цифру, с отрицательным — меньшую, но нуль не может быть первой цифрой: ${asgTxt}. Итог: ${v}.`
    : `Вес каждой буквы (10 в разряде десятков, 1 в разряде единиц, суммируем): ${weights}. ${mode === 'max' ? 'Самые большие цифры отдаём самым тяжёлым буквам' : 'Самые маленькие цифры отдаём самым лёгким буквам, а нуль — букве, которая не стоит первой в числе'}: ${asgTxt}. Значение: ${v}.`;
  return {
    kz: `Ребус. Бірдей әріптердің орнына бірдей цифрларды, әртүрлі әріптердің орнына әртүрлі цифрларды қойыңыз (сан нөлден басталмайды). Мына өрнектің ${kzQ} мәнін табыңыз:\n${expr}`,
    ru: `Ребус. Вместо одинаковых букв ставьте одинаковые цифры, вместо разных — разные (число не начинается с нуля). Найдите ${ruQ} значение выражения:\n${expr}`,
    choices, answer,
    hints: [
      T('Әр әріп өрнекте қай разрядта тұр: ондықта ма, бірлікте ме? Неше рет кездеседі? Әр әріптің «салмағын» тап.', 'На каком месте стоит каждая буква: в разряде десятков или единиц? Сколько раз она встречается? Найди «вес» каждой буквы.'),
      mode === 'max'
        ? T('Үлкен цифр салмағы көп әріпке көбірек пайда береді. Цифрларды салмақ бойынша ретте.', 'Большая цифра приносит больше пользы букве с большим весом. Расставь цифры по весам.')
        : T('Кіші цифр салмағы көп әріпке көбірек пайда береді. Нөл қай әріпке бола алады, қайсысына болмайды?', 'Маленькая цифра приносит больше пользы букве с большим весом. Какой букве можно дать нуль, а какой нельзя?'),
      T('Әр әріптің салмағын оның цифрына көбейтіп, қос. Әртүрлі әріптерге бірдей цифр беруге болмайтынын ұмытпа.', 'Умножь вес каждой буквы на её цифру и сложи. Не забудь: разным буквам нельзя давать одинаковые цифры.'),
    ],
    sol: { kz: kzSol, ru: ruSol },
  };
}

// ============================================================ шаблоны ============================================================
export default [
  {
    id: 'logic.crypt_two_digit',
    examType: 'logic', skills: ['logic.cryptarithm'], from: [], difficulty: 2,
    title: { kz: 'Ребус: екі таңбалы сандар', ru: 'Ребус: двузначные числа' },
    gen(r) { return letterItem(r, { mode: 'digit', pairs: true, pickShape: rr => weighted(rr, [[3, SHAPES_MIRROR2], [1, SHAPES_NO_CARRY], [6, SHAPES_2]]) }); },
  },
  {
    id: 'logic.crypt_three_digit',
    examType: 'logic', skills: ['logic.cryptarithm'], from: [], difficulty: 3,
    title: { kz: 'Ребус: үш таңбалы сандар', ru: 'Ребус: трёхзначные числа' },
    gen(r) { return letterItem(r, { mode: 'digit', pairs: true, pickShape: rr => weighted(rr, [[4, SHAPES_MIRROR3], [6, SHAPES_3]]) }); },
  },
  {
    id: 'logic.crypt_lead',
    examType: 'logic', skills: ['logic.cryptarithm'], from: [], difficulty: 1,
    title: { kz: 'Ребус: қосындының бірінші цифры', ru: 'Ребус: первая цифра суммы' },
    gen(r) { return letterItem(r, { mode: 'lead', pickShape: rr => rr.pick(SHAPES_LEAD) }); },
  },
  {
    id: 'logic.crypt_extreme',
    examType: 'logic', skills: ['logic.cryptarithm'], from: [], difficulty: 3,
    title: { kz: 'Ребус: ең үлкен және ең кіші мән', ru: 'Ребус: наибольшее и наименьшее значение' },
    gen: extremeItem,
  },
];
