// Печатает по несколько сгенерированных задач на каждый шаблон рядом с оригиналом из банка.
import { templates } from '../content/templates/index.mjs';
import { rng } from '../content/templates/lib.mjs';
import { writeFileSync } from 'node:fs';

const per = +(process.argv[2] || 3), out = process.argv[3] || 'bank/similar/daryn2023_samples.md';
const L = 'ABCDE';
let md = `# Похожие задачи по «Дарын» 2023 — образцы генераторов\n\n` +
  `Сгенерировано: \`node scripts/sample-templates.mjs ${per}\`. Шаблонов: ${templates.length}. ` +
  `Ответы вычислены кодом точными дробями; каждый неправильный вариант — типичная ошибка (метка в скобках).\n\n` +
  `Казахский текст — черновик: **нужна проверка носителем языка** перед показом ученику.\n\n`;
const r = rng(2026);
for (const t of templates) {
  md += `## ${t.title.kz}\n\n*${t.title.ru}* · \`${t.id}\` · тип: ${t.examType} · сложность ${t.difficulty}/3 · по образцу: ${t.from.join(', ')}\n\n`;
  for (let i = 1; i <= per; i++) {
    const it = t.gen(r);
    md += `**Вариант ${i}.** ${it.kz.replace(/\n/g, '  \n')}\n\n`;
    if (it.figure?.svg) md += `*(рисунок генерируется: ${it.figure.kind})*\n\n`;
    md += it.choices.map((c, k) => `${L[k]}) ${c.text}${k === it.answer ? ' ✅' : ` *(${c.tag})*`}`).join('  \n') + '\n\n';
    md += `> **Шешуі:** ${it.sol.kz}\n>\n> *RU:* ${it.ru.replace(/\n/g, ' ')} — ${it.sol.ru}\n\n`;
  }
}
writeFileSync(out, md);
console.log('written', out, md.length, 'chars');
