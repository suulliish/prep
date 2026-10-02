// Карта систем и инварианты (content/systems.mjs, src/engine/systems.ts, src/engine/sim.ts).
// Тест держит картину честной: список нарушений должен ТОЧНО совпадать с KNOWN_RED.
// Новая поломка — тест падает (её видно до слияния). Починка — тоже падает, пока её не вычеркнут из KNOWN_RED.
// `npm run systems` дополнительно пишет docs/SYSTEMS.md (карта, связи, правила, проверки, симуляция).
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
// @ts-ignore
import { MECHANICS, RULES, KNOWN_RED, FIELD_ISSUES } from '../content/systems.mjs';
// @ts-ignore
import { OUTFITS, WORLDS } from '../content/worlds.mjs';
import { simulateDet, type SimResult } from '../src/engine/sim';
import { checkSystems, defsWord, type Mechanic, type RuleDef, type Check } from '../src/engine/systems';

const M = MECHANICS as Mechanic[];
const R = RULES as RuleDef[];
const saveFields = (() => {
  const src = readFileSync('src/engine/types.ts', 'utf8');
  const body = src.slice(src.indexOf('export interface Save {'));
  return [...body.slice(0, body.indexOf('\n}')).matchAll(/^\s{2}([a-zA-Z]+)\??:/gm)].map(m => m[1]);
})();
const sim = simulateDet();
const arena = M.find(x => x.id === 'arena');
const checks = checkSystems(M, R, sim, {
  saveFields,
  fileExists: f => existsSync(f),
  outfitsMax: Math.max(...(OUTFITS as { need: number }[]).map(o => o.need)),
  worldsMax: Math.max(...(WORLDS as { need: number; arena?: boolean }[]).filter(w => !w.arena).map(w => w.need)),
  arenaOpen: !!arena && arena.inputs.length > 0,
  fieldIssues: FIELD_ISSUES as { field: string; issue: string }[],
});

describe('Карта систем', () => {
  it('нарушения инвариантов совпадают с KNOWN_RED (новых нет, починенные вычеркнуты)', () => {
    const red = checks.filter(c => !c.ok).map(c => c.id).sort();
    const why = checks.filter(c => !c.ok).map(c => `${c.id}: ${c.detail}`).join('\n');
    expect(red, why).toEqual([...(KNOWN_RED as string[])].sort());
  });
  it('карта цела: связи, файлы, все поля сохранения на своих местах', () => {
    for (const id of ['map-links', 'map-files', 'map-data']) {
      const c = checks.find(x => x.id === id)!;
      expect(c.ok, `${c.name}: ${c.detail}`).toBe(true);
    }
  });
  it('у механик уникальные id, у каждой есть название, группа и файлы', () => {
    expect(new Set(M.map(m => m.id)).size).toBe(M.length);
    for (const m of M) { expect(m.name, m.id).toBeTruthy(); expect(m.group, m.id).toBeTruthy(); expect(m.code.length, m.id).toBeGreaterThan(0); }
  });
  it('симулятор доходит до экзамена и считает хорошему ученику честные минуты', () => {
    expect(sim.days.at(-1)!.day).toBe(sim.params.exam);
    expect(checks.find(c => c.id === 'minutes-fair')!.ok).toBe(true);
  });
  it('docs/SYSTEMS.md собран из карты (обновить: npm run systems)', () => {
    const md = renderSystems(M, R, checks, sim);
    if (process.env.SYSTEMS_WRITE) writeFileSync('docs/SYSTEMS.md', md);
    expect(readFileSync('docs/SYSTEMS.md', 'utf8')).toBe(md);
  });
});

function renderSystems(m: Mechanic[], rules: RuleDef[], cs: Check[], s: SimResult): string {
  const L: string[] = [];
  const byId = new Map(m.map(x => [x.id, x]));
  const name = (id: string) => byId.get(id)?.name ?? id;
  L.push('# Карта систем', '');
  L.push('Собирается автоматически из `content/systems.mjs` командой `npm run systems`; руками не править. Тест `tests/systems.test.ts` следит, чтобы карта совпадала с кодом.', '');
  L.push('**Правило проекта:** новая механика или новое поле сохранения сначала вписывается в `content/systems.mjs` (что её питает, что она открывает, где видна), потом пишется код. Числа баланса — в одном месте (см. `docs/systems/constants.md`).', '');
  const red = cs.filter(c => !c.ok), green = cs.filter(c => c.ok);
  L.push(`## Проверки: ${green.length} в порядке, ${red.length} нарушено`, '');
  L.push('| | Проверка | Подробности |', '|---|---|---|');
  for (const c of [...red, ...green]) L.push(`| ${c.ok ? '✅' : '❌'} | ${c.name} | ${c.detail.replace(/\|/g, '/')} |`);
  L.push('');
  L.push('## Связи', '', '```mermaid', 'flowchart LR');
  const groups = [...new Set(m.map(x => x.group))];
  for (const g of groups) {
    L.push(`  subgraph ${g.replace(/\s/g, '_')}["${g}"]`);
    for (const x of m.filter(y => y.group === g)) L.push(`    ${x.id.replace(/-/g, '_')}["${x.name.replace(/"/g, "'")}"]`);
    L.push('  end');
  }
  for (const x of m) for (const o of x.outputs) L.push(`  ${x.id.replace(/-/g, '_')} --> ${o.replace(/-/g, '_')}`);
  const orphans = m.filter(x => !x.terminal && !x.outputs.length).map(x => x.id.replace(/-/g, '_'));
  if (orphans.length) L.push(`  classDef orphan fill:#ffd9d4,stroke:#c7452a`, `  class ${orphans.join(',')} orphan`);
  L.push('```', '');
  for (const g of groups) {
    L.push(`## ${g[0].toUpperCase() + g.slice(1)}`, '', '| Механика | Питается от | Открывает / влияет | Видно | Данные | Код | Заметки |', '|---|---|---|---|---|---|---|');
    for (const x of m.filter(y => y.group === g)) {
      const outs = x.outputs.length ? x.outputs.map(name).join(', ') : x.terminal ? '— (итог)' : '**ничего**';
      L.push(`| **${x.name}** | ${x.inputs.map(name).join(', ') || '—'} | ${outs} | ${{ child: 'ребёнку', parent: 'командиру', both: 'обоим', none: '—' }[x.shown]} | ${(x.data ?? []).map(d => `\`${d}\``).join(', ')} | ${x.code.map(c => `\`${c}\``).join('<br>')} | ${x.notes ?? ''} |`);
    }
    L.push('');
  }
  L.push('## Мёртвые поля сохранения', '', '| Поле | Что не так |', '|---|---|');
  for (const f of FIELD_ISSUES as { field: string; issue: string }[]) L.push(`| \`${f.field}\` | ${f.issue} |`);
  L.push('');
  L.push('## Понятия, у которых должно быть одно определение', '');
  for (const r of rules) {
    L.push(`**${r.name}** — ${r.defs.length === 1 ? 'одно определение ✅' : `${defsWord(r.defs.length)} ❌`}`);
    for (const d of r.defs) L.push(`- \`${d.where}\`: ${d.how}`);
    L.push('');
  }
  L.push('## Симуляция ученика', '');
  const P = s.params;
  L.push(`Модель (\`src/engine/sim.ts\`), а не ребёнок: точность ${Math.round(P.accuracy * 100)}%, ${P.newPerWeek} новые темы в неделю, доп. миссия через день, ${P.knownAtStart} тем засчитано диагностикой, с ${P.start} до экзамена ${P.exam}. Уроков в контенте: ${s.lessonsInContent}. Магазин: ${s.shop.items} предметов на ${s.shop.total} монет.`, '');
  const ms = s.milestones;
  L.push(`- магазин выкуплен: **${ms.shopDone ?? 'не выкуплен'}**`, `- все награды за звёзды: **${ms.starRewardsDone ?? 'не все'}**`, `- уроки закончились: **${ms.lessonsDone ?? 'не закончились'}**`, `- все костюмы: **${ms.outfitsDone ?? 'недостижимы'}**`, `- все миры: **${ms.worldsDone ?? 'недостижимы'}**`, '');
  L.push('| День | Учебных дней | Монеты (на руках / потрачено) | Предметов | Звёзды | Наград за звёзды | Уровень | Тем изучено / кристаллов | Энергия | Миров | Костюмов | Поломок | Корабль | Минут в день | Облако, КБ |', '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  const pick = [7, 30, 60, 100, 200, 300, 400].map(k => Math.min(k, s.days.length - 1)).concat(s.days.length - 1);
  for (const k of [...new Set(pick)]) {
    const d = s.days[k];
    L.push(`| ${d.day} | ${d.n} | ${d.coins} / ${d.spent} | ${d.owned} | ${d.stars} | ${d.starRewards} | ${d.level} | ${d.learned} / ${d.crystals} | ${d.energy} | ${d.worlds} | ${d.outfits} | ${d.broken} | ${d.integrity}% | ${d.minutes} | ${d.mainKb} |`);
  }
  L.push('');
  return L.join('\n') + '\n';
}
