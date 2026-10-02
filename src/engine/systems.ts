// Проверки целостности систем (инварианты): по карте механик (content/systems.mjs) и симуляции ученика (src/engine/sim.ts).
// Каждая проверка — правило «так в проекте должно быть всегда». Нарушенные сейчас перечислены в KNOWN_RED (content/systems.mjs):
// тест tests/systems.test.ts требует, чтобы список нарушений совпадал с KNOWN_RED — новая поломка валит тест, починка тоже
// (её надо вычеркнуть из списка). Так картина не врёт и не устаревает молча.
import type { SimResult } from './sim';

export interface Mechanic {
  id: string; name: string; group: string;
  kind: 'action' | 'currency' | 'progress' | 'unlock' | 'rule' | 'loop' | 'view';
  inputs: string[]; outputs: string[];
  shown: 'child' | 'parent' | 'both' | 'none';
  code: string[]; data?: string[]; notes?: string;
  /** корень (ни из чего не следует: действие ребёнка) или итог (ничего не открывает по замыслу: минуты игры, учёба) */
  root?: boolean; terminal?: boolean;
}
export interface RuleDef { id: string; name: string; defs: { where: string; how: string }[] }
export interface FieldIssue { field: string; issue: string }
export interface Check { id: string; name: string; ok: boolean; detail: string }

/** «2 определения», «5 определений» */
export const defsWord = (n: number) => `${n} ${n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? 'определения' : n % 10 === 1 && n % 100 !== 11 ? 'определение' : 'определений'}`;

const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5);

export function checkSystems(
  m: Mechanic[], rules: RuleDef[], sim: SimResult,
  facts: { saveFields: string[]; fileExists: (f: string) => boolean; outfitsMax: number; worldsMax: number; arenaOpen: boolean; fieldIssues: { field: string; issue: string }[] },
): Check[] {
  const ids = new Set(m.map(x => x.id));
  const out: Check[] = [];
  const add = (id: string, name: string, ok: boolean, detail: string) => out.push({ id, name, ok, detail });
  const exam = sim.params.exam;
  const lastSchool = sim.days.filter(d => d.n > 0).at(-1)!;

  // ---- карта механик ----
  const dangling = m.flatMap(x => [...x.inputs, ...x.outputs].filter(i => !ids.has(i)).map(i => `${x.id}→${i}`));
  add('map-links', 'Все связи на карте ведут к существующим механикам', !dangling.length, dangling.join(', ') || 'ок');
  const noIn = m.filter(x => !x.root && !x.inputs.length).map(x => x.id);
  add('map-inputs', 'У каждой механики есть вход (что её питает)', !noIn.length, noIn.join(', ') || 'ок');
  const noOut = m.filter(x => !x.terminal && !x.outputs.length).map(x => x.id);
  add('map-outputs', 'Каждая механика что-то открывает или на что-то влияет (нет «сирот»)', !noOut.length, noOut.length ? `растут, но ничего не открывают: ${noOut.join(', ')}` : 'ок');
  const missingFiles = m.flatMap(x => x.code.filter(f => !facts.fileExists(f)).map(f => `${x.id}: ${f}`));
  add('map-files', 'Файлы кода на карте существуют', !missingFiles.length, missingFiles.join(', ') || 'ок');
  const mapped = new Set(m.flatMap(x => x.data ?? []));
  const unmapped = facts.saveFields.filter(f => !mapped.has(f));
  add('map-data', 'Каждое поле сохранения принадлежит механике на карте', !unmapped.length, unmapped.length ? `без механики: ${unmapped.join(', ')}` : 'ок');

  // ---- одно определение каждого правила ----
  const multi = rules.filter(r => r.defs.length > 1);
  add('one-rule', 'Каждое правило определено в одном месте', !multi.length, multi.map(r => `«${r.name}» — ${defsWord(r.defs.length)}`).join('; ') || 'ок');

  // ---- экономика на весь срок ----
  const ms = sim.milestones;
  const runway = (d: string | null) => (d ? daysBetween(d, exam) : -1);
  add('coins-sink', 'Монетам до экзамена есть на что тратиться', !ms.shopDone || runway(ms.shopDone) <= 30,
    ms.shopDone ? `магазин выкуплен ${ms.shopDone}, до экзамена ещё ${runway(ms.shopDone)} дн.; к экзамену на руках ${lastSchool.coins} монет` : 'ок');
  add('stars-sink', 'Звёзды до экзамена что-то открывают', !ms.starRewardsDone || runway(ms.starRewardsDone) <= 30,
    ms.starRewardsDone ? `все награды за звёзды получены ${ms.starRewardsDone}, потом ещё ${lastSchool.stars} звёзд впустую` : 'ок');
  const maxCrystals = sim.lessonsInContent + sim.params.knownAtStart;
  add('outfits-reachable', 'Все костюмы достижимы с текущим контентом', facts.outfitsMax <= maxCrystals, `нужно кристаллов ${facts.outfitsMax}, тем с уроками ${maxCrystals}`);
  add('worlds-reachable', 'Все миры достижимы с текущим контентом', facts.worldsMax <= 2 * maxCrystals, `нужно энергии ${facts.worldsMax}, максимум ${2 * maxCrystals}`);
  add('arena-reachable', 'У арены есть путь открытия', facts.arenaOpen, facts.arenaOpen ? 'ок' : 'арена закрыта всегда (нет режима пробников)');
  const after30 = sim.days.filter(d => d.n > 30);
  const brokenShare = after30.length ? after30.filter(d => d.integrity === 0).length / after30.length : 0;
  add('ship-recoverable', 'Корабль можно держать целым (ремонт успевает за ошибками)', brokenShare < 0.5,
    `после первого месяца корабль разбит (0%) в ${Math.round(brokenShare * 100)}% дней; к экзамену поломок ${lastSchool.broken}`);
  const minutesOk = sim.days.filter(d => d.n > 0 && d.minutes > 0);
  const avgMin = minutesOk.length ? Math.round(minutesOk.reduce((s, d) => s + d.minutes, 0) / minutesOk.length) : 0;
  add('minutes-fair', 'Хороший ученик зарабатывает не меньше 45 мин в будний день', avgMin >= 45, `в среднем ${avgMin} мин при точности ${Math.round(sim.params.accuracy * 100)}%`);
  const kb = lastSchool.mainKb;
  add('cloud-size', 'Главный документ облака не подходит к пределу Firestore (1 МБ) до экзамена', kb < 700, `к экзамену ≈ ${kb} КБ (дни с планом, поломки навсегда, журнал ИИ)`);
  add('data-clean', 'В сохранении нет мёртвых полей (пишутся, но не читаются; устаревшие)', !facts.fieldIssues.length,
    facts.fieldIssues.length ? `${facts.fieldIssues.length}: ${facts.fieldIssues.map(f => f.field).join(', ')}` : 'ок');
  return out;
}
