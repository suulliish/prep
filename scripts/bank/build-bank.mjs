// Собирает content/bank.json из bank/*.md (разные форматы) + казахский текст «Дарына» из PDF
// (bank/sources/*.split.json, делает scripts/bank/extract_kz.py).
// Правила допуска — docs/ARCHITECTURE.md 4.3: в сайт идут только verification ∈ {code, manual, key}.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const SOURCES = [
  { file: 'bank/01_daryn_2025.md', source: 'daryn2025', tier: 'A', pool: 'holdout', split: 'bank/sources/daryn2025.split.json' },
  { file: 'bank/02_daryn_2024.md', source: 'daryn2024', tier: 'A', pool: 'mock', split: 'bank/sources/daryn2024.split.json' },
  { file: 'bank/03_daryn_2023.md', source: 'daryn2023', tier: 'A', pool: 'practice', split: 'bank/sources/daryn2023.split.json' },
  { file: 'bank/04_bolashak_variant1.md', source: 'bolashak1', tier: 'B', pool: 'mock' },
  { file: 'bank/05_bolashak_variant2.md', source: 'bolashak2', tier: 'B', pool: 'mock' },
];

const L = s => s.replace('А', 'A').replace('В', 'B').replace('С', 'C').replace('Е', 'E');
const LET = '[A-EАВСЕ]';

function blocks(md) {
  const re = /^#{3,4} Задача (\d+)\s*$/gm;
  const out = []; let m, prev = null;
  while ((m = re.exec(md))) {
    if (prev) out.push({ n: prev.n, text: md.slice(prev.end, m.index) });
    prev = { n: +m[1], end: re.lastIndex };
  }
  if (prev) {
    // конец последнего блока — до следующего заголовка ## или ###
    const rest = md.slice(prev.end); const stop = rest.search(/^#{2,3} (?!Задача)/m);
    out.push({ n: prev.n, text: stop >= 0 ? rest.slice(0, stop) : rest });
  }
  // если номер повторяется (итоговые таблицы и т.п.) — берём первый блок
  // блок заканчивается на первом заголовке любого уровня (итоговые таблицы не должны попадать в задачу)
  for (const b of out) {
    b.text = b.text.replace(/```[\s\S]*?```/g, '');           // код решения не нужен и содержит «#»
    const k = b.text.search(/^#{1,4} /m); if (k >= 0) b.text = b.text.slice(0, k);
  }
  const seen = new Set();
  return out.filter(b => (seen.has(b.n) ? false : (seen.add(b.n), true)));
}

const STOP = /^(\*\*(Решение|Ответ|Статус|Тип|Рисунок|Кратко|Короткое|Проверка)|Решение|Ответ по ключу|Мой ответ|Статус|Тип:|Картинка|Рисунок:|Вывод|```)/;

function parseStem(t) {
  const lines = t.split('\n');
  let i = lines.findIndex(l => /^\*\*Условие[^*]*:\*\*|^Условие[^:]*:/.test(l.trim()));
  const out = [];
  if (i >= 0) { out.push(lines[i].replace(/^\*\*Условие[^*]*:\*\*\s*|^Условие[^:]*:\s*/, '')); i++; }
  else i = 0; // формат 2023: условие сразу после заголовка
  for (; i < lines.length; i++) {
    const l = lines[i].trim();
    if (/^(Варианты:)/.test(l) || new RegExp('^' + LET + '\\)').test(l) || STOP.test(l)) break;
    out.push(l);
  }
  return out.join('\n').trim().replace(/\n{2,}/g, '\n');
}

function parseChoices(t) {
  const lines = t.split('\n');
  let i = lines.findIndex(l => /^Варианты:/.test(l.trim()) || new RegExp('^' + LET + '\\)').test(l.trim()));
  if (i < 0) return null;
  const buf = [];
  for (; i < lines.length; i++) {
    const l = lines[i].trim();
    if (!l) { if (buf.length && /E\)|Е\)/.test(buf.join(' '))) break; continue; }
    if (STOP.test(l) && buf.length) break;
    buf.push(l.replace(/^Варианты:\s*/, ''));
  }
  const s = ' ' + buf.join('\n');
  const parts = s.split(new RegExp('(?:^|[\\s;])(' + LET + ')\\)\\s*'));
  const ch = {};
  for (let k = 1; k < parts.length; k += 2) {
    const letter = L(parts[k]);
    if (!ch[letter]) ch[letter] = parts[k + 1].replace(/[\s;]+$/, '').replace(/\s*\*\([^)]*\)\*\s*$/, '').trim();
  }
  let arr = ['A', 'B', 'C', 'D', 'E'].map(x => ch[x]);
  if (!arr.every(Boolean)) {
    // картинки-варианты с кириллическими буквами А Б В Г Д
    const p2 = s.split(/(?:^|[\s;])([АБВГД])\)\s*/), c2 = {};
    for (let k = 1; k < p2.length; k += 2) c2[p2[k]] ??= p2[k + 1].trim();
    const alt = ['А', 'Б', 'В', 'Г', 'Д'].map(x => c2[x]);
    if (alt.every(Boolean)) arr = alt;
  }
  return arr.every(Boolean) ? arr : arr.filter(Boolean).length ? arr : null;
}

function parseAnswer(t) {
  const pats = [
    new RegExp('\\*\\*Ответ:\\s*(' + LET + ')'),
    new RegExp('ответ\\s+\\*\\*(' + LET + ')\\)'),
    new RegExp('ответ\\s*[—–-]\\s*\\*\\*(' + LET + ')\\)'),
    new RegExp('Ответ по ключу:\\s*(' + LET + ')'),
  ];
  for (const p of pats) { const m = t.match(p); if (m) return L(m[1]); }
  return null;
}
function parseMine(t) { const m = t.match(new RegExp('Мой ответ:\\s*(' + LET + ')')); return m ? L(m[1]) : null; }

function verification(t, key, mine) {
  if (/\[НЕЧИТАЕМО/.test(t)) return 'unreadable';
  if (/\[НЕОДНОЗНАЧНО|\[НЕ СОВПАЛО|ОПЕЧАТКА|НЕОДНОЗНАЧНО:/.test(t)) return 'disputed';
  if (key && mine && key !== mine) return 'disputed';
  if (/ПРОВЕРЕНО КОДОМ|проверено кодом|перебором кодом|Решение \(код\)|Проверка кодом/i.test(t)) return 'code';
  if (/РЕШЕНО ВРУЧНУЮ|решено вручную/i.test(t)) return 'manual';
  if (/Ответ по ключу/.test(t) && key) return 'key';
  return 'unverified';
}

function field(t, name) {
  const m = t.match(new RegExp('^\\**' + name + ':\\**\\s*(.+)$', 'm'));
  return m ? m[1].replace(/\*\*/g, '').trim() : '';
}

function needsFigure(t) {
  const f = field(t, 'Рисунок') || field(t, 'Картинка');
  if (!f) return false;
  return !/^(не нуж|нет|не треб)/i.test(f);
}

function shortSolution(t) {
  return field(t, 'Короткое решение') || field(t, 'Кратко') || (t.match(/^\*\*Решение:\*\*\s*(.+)$/m)?.[1] ?? '') || (t.match(/^Решение:\s*(.+)$/m)?.[1] ?? '');
}

// Формула из русского условия: часть после последнего «:», если там почти нет слов
function formulaPart(ru) {
  const m = ru.match(/[А-Яа-яЁё]\s*:\s*([\s\S]+)$/); if (!m) return '';
  const tail = m[1].trim();
  const words = (tail.match(/[А-Яа-яЁё]{3,}/g) || []).length;
  return tail && words <= 1 ? tail : '';
}

const items = [];
const stats = {};
for (const S of SOURCES) {
  const md = readFileSync(S.file, 'utf8');
  const split = S.split && existsSync(S.split) ? JSON.parse(readFileSync(S.split, 'utf8')) : null;
  const st = (stats[S.source] = { total: 0, usable: 0, noChoices: 0, noAnswer: 0, disputed: 0, figure: 0, kz: 0 });
  for (const b of blocks(md)) {
    if (b.n > 55) continue;
    st.total++;
    const ru = parseStem(b.text);
    const choices = parseChoices(b.text);
    const key = parseAnswer(b.text), mine = parseMine(b.text);
    const answerLetter = key && mine && key !== mine ? null : (key || mine);
    let ver = verification(b.text, key, mine);
    if (!answerLetter && ver !== 'unreadable') ver = 'disputed';
    const fig = needsFigure(b.text);
    let kz = null, kzOrigin = 'missing';
    if (split && split[b.n]) {
      const sp = split[b.n];
      const f = formulaPart(ru);
      const kzText = sp.kz.split('\n').map(l => l.replace(/\s*\/\s*[А-ЯЁ][^әғқңөұүһіӘҒҚҢӨҰҮҺІ]*$/, '')).join('\n');
      kz = [kzText, f || sp.math].filter(Boolean).join('\n');
      kzOrigin = 'official';
      st.kz++;
    }
    const answer = answerLetter ? 'ABCDE'.indexOf(answerLetter) : -1;
    const okChoices = choices && choices.length === 5 && choices.every(Boolean);
    if (!okChoices) st.noChoices++;
    if (answer < 0) st.noAnswer++;
    if (ver === 'disputed' || ver === 'unreadable') st.disputed++;
    if (fig) st.figure++;
    const usable = !!okChoices && answer >= 0 && ['code', 'manual', 'key'].includes(ver);
    if (usable) st.usable++;
    items.push({
      id: `${S.source}-${String(b.n).padStart(2, '0')}`,
      source: S.source, tier: S.tier, pool: S.pool, n: b.n,
      stem: { kz, ru }, kzOrigin, kzReview: 'draft',
      choices: okChoices ? choices : choices ?? [],
      answer, verification: ver,
      figure: fig ? { kind: 'pending', note: (field(b.text, 'Рисунок') || field(b.text, 'Картинка')).slice(0, 300) } : null,
      type: field(b.text, 'Тип'),
      solution: { ru: shortSolution(b.text), kz: null },
      usable,
    });
  }
}
writeFileSync('content/bank.json', JSON.stringify({ built: new Date().toISOString().slice(0, 10), items }, null, 1));
console.table(stats);
console.log('всего', items.length, 'готовы к сайту (без рисунка):', items.filter(i => i.usable && !i.figure).length, '| с рисунком (ждут SVG):', items.filter(i => i.usable && i.figure).length);
