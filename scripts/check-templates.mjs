// Прогоняет каждый шаблон много раз и проверяет, что задачи собраны правильно.
import { templates } from '../content/templates/index.mjs';
import { rng } from '../content/templates/lib.mjs';

const N = +(process.argv[2] || 500);
let bad = 0;
const ids = new Set();
for (const t of templates) {
  if (ids.has(t.id)) { console.log('DUPLICATE id', t.id); bad++; }
  ids.add(t.id);
  const errs = new Map();
  const note = (m, it) => { if (!errs.has(m)) errs.set(m, it); };
  const r = rng(12345);
  const stems = new Set();
  for (let i = 0; i < N; i++) {
    let it;
    try { it = t.gen(r); } catch (e) { note('throws: ' + e.message, null); continue; }
    stems.add(it.kz + (it.figure ? JSON.stringify(it.figure) : ""));
    if (!it.kz || !it.ru) note('empty text', it);
    if (!Array.isArray(it.choices) || it.choices.length !== 5) note('not 5 choices', it);
    const texts = it.choices.map(c => c.text);
    if (new Set(texts).size !== texts.length) note('duplicate choices', it);
    if (!(it.answer >= 0 && it.answer < 5)) note('bad answer index', it);
    if (it.choices.filter(c => c.tag === 'correct').length !== 1) note('correct tag count', it);
    if (it.choices[it.answer]?.tag !== 'correct') note('answer not tagged correct', it);
    const all = JSON.stringify(it);
    if (/NaN|undefined|Infinity|null/.test(all.replace(/"tag":"[a-z_]+"/g, ''))) note('NaN/undefined in text', it);
    if (!it.sol?.kz || !it.sol?.ru) note('no solution', it);
  }
  const variety = stems.size;
  if (errs.size || variety < Math.min(20, N / 5)) {
    bad++;
    console.log(`✗ ${t.id}: variety ${variety}/${N}`);
    for (const [m, it] of errs) console.log('   -', m, it ? JSON.stringify({ kz: it.kz, choices: it.choices?.map(c => c.text), answer: it.answer }).slice(0, 400) : '');
  } else console.log(`✓ ${t.id}  (разных условий: ${variety}/${N})`);
}
console.log(`\n${templates.length} шаблонов, с ошибками: ${bad}`);
process.exit(bad ? 1 : 0);
