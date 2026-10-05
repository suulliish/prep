// Слияние сохранения устройства и облака (src/lib/cloud.svelte.ts). Чистые функции — их гоняют тесты.
// Правила (02.10, после случая «новое устройство затёрло облако»; S1 docs/systems/IMPLEMENTATION.md):
// 1. Ответы не теряются никогда: история ответов — объединение обеих сторон (ответ узнаётся по времени, теме и задаче).
// 2. Пустое устройство (новый телефон брата, сброшенный браузер) никогда не побеждает облако, даже если «новее» по часам.
// 3. Остальное сливается ПО ПОЛЯМ (mergeSave): то, что только растёт (дни, пройденные шаги, открытое, купленное, история
//    вспоминаний, опыт), — объединение или максимум; темы — у кого по теме больше ответов; монеты — сумма изменений
//    обеих сторон от общей базы. Поле, которое меняют (настройки, надетый костюм…), берётся с той стороны, что его
//    изменила с последней синхронизации (база = копия облака после неё); изменили обе — новее по updatedAt.
//    Так телефон с копией недельной давности, поменяв одну настройку, не откатывает дни, темы и монеты ребёнка.
import type { Attempt, Save, DayRecord, SkillState, RecallState, NotebookEntry } from './types';
import { mergeUsage } from './usage';

export const attemptKey = (a: Attempt) => `${a.at}|${a.skill}|${a.source}`;

/** Объединение историй ответов без повторов, по времени. */
export function mergeAttempts(a: Attempt[], b: Attempt[]): Attempt[] {
  const m = new Map<string, Attempt>();
  for (const x of [...a, ...b]) if (!m.has(attemptKey(x))) m.set(attemptKey(x), x);
  return [...m.values()].sort((x, y) => x.at - y.at);
}

/** Сохранение, в котором ничего не сделано: ни ответа, ни диагностики, ни опыта. */
export const isBlank = (s: Pick<Save, 'attempts' | 'diagnosticDone' | 'xp'>) => !(s.attempts?.length) && !s.diagnosticDone && !(s.xp > 0);

/** Чья копия главная: remote — взять облачную, local — отправить свою, same — ничего не менять. */
export function chooseSide(local: { at: number; blank: boolean }, remote: { at: number; blank: boolean }): 'remote' | 'local' | 'same' {
  if (local.blank && !remote.blank) return 'remote';
  if (remote.blank && !local.blank) return 'local';
  return remote.at > local.at ? 'remote' : remote.at < local.at ? 'local' : 'same';
}

/** Локальная копия (localStorage, ~5 млн знаков на сайт) не должна переполниться: если JSON длиннее max, в неё идут ответы
 *  только за последние `months` целых месяцев (старые остаются в памяти, в облаке и в файле-копии). Месяц режется только целиком:
 *  облако пишет ответы по месяцам, и неполный месяц затёр бы облачный. */
export const LOCAL_MAX_CHARS = 3_000_000;
export function localJson(save: Save, max = LOCAL_MAX_CHARS, months = 12): string {
  const full = JSON.stringify(save);
  if (full.length <= max || !save.attempts?.length) return full;
  const last = save.attempts[save.attempts.length - 1].day.slice(0, 7);
  const [y, m] = last.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 - (months - 1), 1));
  const cut = d.toISOString().slice(0, 7);
  return JSON.stringify({ ...save, attempts: save.attempts.filter(a => a.day.slice(0, 7) >= cut) });
}

// ---------- Слияние по полям (S1) ----------

/** Строка для сравнения: ключи по алфавиту (порядок ключей в объектах не важен). */
export function stable(v: unknown): string {
  if (v === undefined) return 'u';
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(stable).join(',')}]`;
  return `{${Object.keys(v as object).filter(k => (v as any)[k] !== undefined).sort().map(k => `${JSON.stringify(k)}:${stable((v as any)[k])}`).join(',')}}`;
}
const same = (a: unknown, b: unknown) => stable(a) === stable(b);

/** Поле, которое меняют: с той стороны, что изменила его с базы; изменили обе — tie (новее по времени). */
export function pick3<T>(b: T | undefined, l: T, r: T, tie: 'local' | 'remote', hasBase: boolean): T {
  if (same(l, r)) return l;
  if (hasBase && same(l, b)) return r;
  if (hasBase && same(r, b)) return l;
  return tie === 'local' ? l : r;
}

const union = (a: string[] = [], b: string[] = []) => [...new Set([...a, ...b])];
const maxN = (a?: number, b?: number) => (a === undefined ? b : b === undefined ? a : Math.max(a, b));
const maxS = (a?: string, b?: string) => (a === undefined ? b : b === undefined ? a : a > b ? a : b);
const byKey = <T>(list: T[], key: (x: T) => string) => { const m = new Map<string, T>(); for (const x of list) if (!m.has(key(x))) m.set(key(x), x); return [...m.values()]; };

function mergeDay(b: DayRecord | undefined, l: DayRecord | undefined, r: DayRecord | undefined, tie: 'local' | 'remote', hasBase: boolean): DayRecord {
  if (!l) return r!; if (!r) return l;
  const tally: DayRecord['tally'] = {}, honest: Record<string, number> = {};
  for (const k of union(Object.keys(l.tally ?? {}), Object.keys(r.tally ?? {}))) {
    const lt = l.tally?.[k], rt = r.tally?.[k];
    const fromR = !!rt && (!lt || rt.n > lt.n);   // у кого шаг пройден дальше — того и счёт, и доля честных
    tally[k] = fromR ? rt! : lt!;
    const h = fromR ? r.honest?.[k] : l.honest?.[k];
    if (h !== undefined) honest[k] = h;
  }
  for (const k of union(Object.keys(l.honest ?? {}), Object.keys(r.honest ?? {}))) if (!(k in honest)) honest[k] = (l.honest?.[k] ?? r.honest?.[k])!;
  const stars: Record<string, number> = { ...(l.stars ?? {}) };
  for (const [k, v] of Object.entries(r.stars ?? {})) stars[k] = Math.max(stars[k] ?? 0, v);
  const blocksDone: Record<string, boolean> = { ...l.blocksDone };
  for (const [k, v] of Object.entries(r.blocksDone ?? {})) blocksDone[k] = !!(blocksDone[k] || v);
  const out: DayRecord = {
    ...l,
    date: l.date ?? r.date,
    blocksDone,
    planShare: Math.max(l.planShare ?? 0, r.planShare ?? 0),
    minutesToday: Math.max(l.minutesToday ?? 0, r.minutesToday ?? 0),
    minutesWeekend: Math.max(l.minutesWeekend ?? 0, r.minutesWeekend ?? 0),
    extraMissions: Math.max(l.extraMissions ?? 0, r.extraMissions ?? 0),
    bonuses: byKey([...(l.bonuses ?? []), ...(r.bonuses ?? [])], x => stable(x)),
  };
  if (l.tally || r.tally) out.tally = tally;
  if (l.honest || r.honest) out.honest = honest;
  if (l.stars || r.stars) out.stars = stars;
  if (l.bossTried || r.bossTried) out.bossTried = true;
  if (l.awayCard || r.awayCard) out.awayCard = true;
  const eh = maxN(l.extraHonest, r.extraHonest); if (eh !== undefined) out.extraHonest = eh;
  const co = maxN(l.coins, r.coins); if (co !== undefined) out.coins = co;
  const sp = maxN(l.spent, r.spent); if (sp !== undefined) out.spent = sp;
  out.plan = r.plan ?? l.plan;                                     // первый план дня (уже в облаке) побеждает
  if (out.plan === undefined) delete out.plan;
  out.hard = pick3(b?.hard, l.hard, r.hard, tie, hasBase); if (out.hard === undefined) delete out.hard;
  out.exception = pick3(b?.exception, l.exception, r.exception, tie, hasBase); if (out.exception === undefined) delete out.exception;
  return out;
}

function mergeSkill(b: SkillState | undefined, l: SkillState | undefined, r: SkillState | undefined, tie: 'local' | 'remote', hasBase: boolean): SkillState {
  if (!l) return r!; if (!r) return l;
  if ((l.attempts ?? 0) !== (r.attempts ?? 0)) return (r.attempts ?? 0) > (l.attempts ?? 0) ? r : l;   // по теме ответили больше — эта копия дальше
  return pick3(b, l, r, tie, hasBase);
}

function mergeRecall(l: RecallState | undefined, r: RecallState | undefined): RecallState {
  if (!l) return r!; if (!r) return l;
  const longer = (r.history?.length ?? 0) > (l.history?.length ?? 0) ? r : l;
  const history = byKey([...(l.history ?? []), ...(r.history ?? [])], x => stable(x)).sort((x, y) => (x.day < y.day ? -1 : x.day > y.day ? 1 : 0));
  return { ...longer, learnedDay: (l.learnedDay ?? '') < (r.learnedDay ?? '') && l.learnedDay ? l.learnedDay : r.learnedDay ?? l.learnedDay, history };
}

function mergeNotebook(l: NotebookEntry | undefined, r: NotebookEntry | undefined): NotebookEntry {
  if (!l) return r!; if (!r) return l;
  const base = (r.check?.at ?? 0) > (l.check?.at ?? 0) ? r : l;
  return { ...base, wrote: !!(l.wrote || r.wrote) || undefined };
}

function mergeMap<T>(b: Record<string, T> | undefined, l: Record<string, T> | undefined, r: Record<string, T> | undefined, f: (b: T | undefined, l: T | undefined, r: T | undefined) => T): Record<string, T> | undefined {
  if (!l && !r) return undefined;
  const out: Record<string, T> = {};
  for (const k of union(Object.keys(l ?? {}), Object.keys(r ?? {}))) out[k] = f(b?.[k], l?.[k], r?.[k]);
  return out;
}

/** Поля, которые сливаются особым правилом; остальные — pick3 (тест сверяет список с типом Save). */
export const MERGE_RULES = {
  attempts: 'объединение', usage: 'по дню, у кого активнее', skills: 'у кого больше ответов по теме', days: 'по дню: шаги ИЛИ, счёт дальше, минуты максимум',
  repairShop: 'объединение, починено ИЛИ', shipOwned: 'объединение', worldsCleared: 'объединение', shipChestFixed: 'максимум', lastBackup: 'максимум',
  diagnosticDone: 'ИЛИ', introSeen: 'ИЛИ', coins: 'база + изменения обеих сторон', xp: 'максимум', recall: 'история объединением',
  recallOffer: 'темы объединением, пропуск ИЛИ', notebook: 'написал ИЛИ, проверка новее', aiLog: 'объединение, последние 100',
  levelStars: 'максимум по ключу', kzReview: 'по ключу, pick3', prog: 'снимок открытого объединением', updatedAt: 'максимум', version: 'максимум',
} as const;

/** Слить сохранение устройства (local) и облака (remote) по полям. base — копия облака после прошлой синхронизации
 *  (общий предок; null — нет: тогда для меняемых полей берётся сторона с бо́льшим updatedAt). Ответы и поведение
 *  сливаются тут же; пустая сторона (isBlank) не побеждает. */
export function mergeSave(base: Save | null, local: Save, remote: Save): Save {
  if (isBlank(local) && !isBlank(remote)) return { ...remote, attempts: mergeAttempts(local.attempts ?? [], remote.attempts ?? []), usage: mergeUsage(remote.usage ?? [], local.usage ?? []) };
  if (isBlank(remote) && !isBlank(local)) return { ...local, attempts: mergeAttempts(local.attempts ?? [], remote.attempts ?? []), usage: mergeUsage(remote.usage ?? [], local.usage ?? []) };
  const hasBase = !!base, b = (base ?? {}) as Partial<Save>;
  const tie: 'local' | 'remote' = (remote.updatedAt ?? 0) > (local.updatedAt ?? 0) ? 'remote' : 'local';
  const out: any = {};
  for (const k of union(Object.keys(local), Object.keys(remote)) as (keyof Save)[]) {
    if (k in MERGE_RULES) continue;
    const v = pick3((b as any)[k], (local as any)[k], (remote as any)[k], tie, hasBase);
    if (v !== undefined) out[k] = v;
  }
  out.attempts = mergeAttempts(local.attempts ?? [], remote.attempts ?? []);
  out.usage = mergeUsage(remote.usage ?? [], local.usage ?? []);
  if (!local.usage && !remote.usage) delete out.usage;
  out.skills = mergeMap(b.skills, local.skills, remote.skills, (bb, l, r) => mergeSkill(bb, l, r, tie, hasBase)) ?? {};
  out.days = mergeMap(b.days, local.days, remote.days, (bb, l, r) => mergeDay(bb, l, r, tie, hasBase)) ?? {};
  out.repairShop = (() => {
    const m = new Map<string, Save['repairShop'][number]>();
    for (const x of [...(local.repairShop ?? []), ...(remote.repairShop ?? [])]) {
      const key = `${x.source}|${x.skill}|${x.addedDay}`, o = m.get(key);
      m.set(key, o ? { ...o, ...x, fixed: !!(o.fixed || x.fixed) || undefined } : x);
    }
    return [...m.values()].map(x => { const y = { ...x }; if (!y.fixed) delete y.fixed; return y; });
  })();
  const sets = { shipOwned: union(local.shipOwned, remote.shipOwned), worldsCleared: union(local.worldsCleared, remote.worldsCleared) };
  if (local.shipOwned || remote.shipOwned) out.shipOwned = sets.shipOwned;
  if (local.worldsCleared || remote.worldsCleared) out.worldsCleared = sets.worldsCleared;
  const put = (k: string, v: unknown) => { if (v !== undefined) out[k] = v; };
  put('shipChestFixed', maxN(local.shipChestFixed, remote.shipChestFixed));
  put('lastBackup', maxS(local.lastBackup, remote.lastBackup));
  out.diagnosticDone = !!(local.diagnosticDone || remote.diagnosticDone);
  if (local.introSeen || remote.introSeen) out.introSeen = true;
  out.xp = Math.max(local.xp ?? 0, remote.xp ?? 0);
  if (local.coins !== undefined || remote.coins !== undefined) {
    const lc = local.coins ?? 0, rc = remote.coins ?? 0;
    out.coins = hasBase ? Math.max(0, (b.coins ?? 0) + (lc - (b.coins ?? 0)) + (rc - (b.coins ?? 0))) : Math.max(lc, rc);
  }
  put('recall', mergeMap(b.recall, local.recall, remote.recall, (_b, l, r) => mergeRecall(l, r)));
  put('recallOffer', mergeMap(b.recallOffer, local.recallOffer, remote.recallOffer, (_b, l, r) => {
    if (!l) return r!; if (!r) return l;
    const o: { skills: string[]; skipped?: boolean } = { skills: union(l.skills, r.skills) };
    if (l.skipped || r.skipped) o.skipped = true;
    return o;
  }));
  put('notebook', mergeMap(b.notebook, local.notebook, remote.notebook, (_b, l, r) => mergeNotebook(l, r)));
  if (local.aiLog || remote.aiLog) out.aiLog = byKey([...(local.aiLog ?? []), ...(remote.aiLog ?? [])], x => `${x.at}|${x.q}`).sort((x, y) => x.at - y.at).slice(-100);
  put('levelStars', mergeMap(undefined, local.levelStars, remote.levelStars, (_b, l, r) => Math.max(l ?? 0, r ?? 0)));
  put('kzReview', mergeMap(b.kzReview, local.kzReview, remote.kzReview, (bb, l, r) => pick3(bb, l, r, tie, hasBase)!));
  if (local.prog || remote.prog) {
    const L = local.prog?.legacy, R = remote.prog?.legacy;
    out.prog = { ...remote.prog, ...local.prog };
    if (L || R) out.prog.legacy = !L ? R : !R ? L : {
      day: L.day < R.day ? L.day : R.day,
      outfits: union(L.outfits, R.outfits), styles: union(L.styles, R.styles), worlds: union(L.worlds, R.worlds), cleared: union(L.cleared, R.cleared), owned: union(L.owned, R.owned),
    };
  }
  out.updatedAt = Math.max(local.updatedAt ?? 0, remote.updatedAt ?? 0);
  out.version = Math.max(local.version ?? 1, remote.version ?? 1);
  return out as Save;
}

/** Одинаковы ли два сохранения, не считая времени изменения (нужно ли что-то писать или применять). */
export const sameSave = (a: Partial<Save>, b: Partial<Save>) => { const { updatedAt: _a, ...x } = a; const { updatedAt: _b, ...y } = b; return stable(x) === stable(y); };
