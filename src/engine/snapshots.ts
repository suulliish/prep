// Снимки облака и восстановление (S4, docs/systems/IMPLEMENTATION.md). Чистые функции: что и когда снимать, что удалять,
// как сравнивать и как собирать сохранение при восстановлении. Тонкая обвязка с Firestore — src/lib/cloud.svelte.ts.
//
// Устройство:
// - users/{uid}/snapshots/{ГГГГ-ММ-ДД} — снимок дня: сохранение облака (без истории ответов — та же схема, что у главного
//   документа) в том виде, каким оно было ПЕРЕД первой записью этого дня; users/{uid}/snapshots/before-restore-{мс} — копия
//   «до» перед восстановлением (чтобы восстановление можно было откатить);
// - users/{uid}/meta/snaps — список снимков с краткой сводкой (дата, ответов, тем, монет): список листается, не скачивая сами снимки;
// - день снимка считается по времени СЕРВЕРА Firestore, а не по часам устройства: сбитые часы не создадут снимок «из будущего»
//   и не удалят настоящие снимки.
// - ответы при восстановлении не теряются: в снимке их нет, остаются ответы устройства (и они же в облаке по месяцам).
import type { AiTurn, Attempt, Save } from './types';
import { mergeAttempts, isBlank } from './sync';
import { mergeUsage } from './usage';

export const SNAP_KEEP_DAYS = 14;      // снимки дня хранятся 14 дней
export const BEFORE_KEEP_DAYS = 60;    // копии «до восстановления» — 60 дней
export const SNAP_KEEP_MIN = 3;        // сколько свежих снимков дня остаётся, даже если они «старые» (приложение долго не открывали)
export const SNAP_MAX_BYTES = 950_000; // документ Firestore ≤ 1 МБ (считается в БАЙТАХ: кириллица в UTF-8 вдвое длиннее знаков): большее в снимок не берём
const byteLen = (s: string) => new TextEncoder().encode(s).length;
export const SNAP_TZ_HOURS = 5;        // Казахстан: сутки считаются по UTC+5

export type SnapKind = 'day' | 'before-restore';
/** Сводка снимка: что в нём «по теме ответов» (ответы считаются по счётчикам тем — самих ответов в снимке нет). */
export interface SnapSum { answers: number; topics: number; coins: number; xp: number; days: number }
export interface SnapMeta { at: number; app: string; v: number; kind: SnapKind; sum: SnapSum }
export type SnapIndex = Record<string, SnapMeta>;

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const BEFORE_RE = /^before-restore-\d{10,15}$/;
export const isSnapId = (id: string) => DAY_RE.test(id) || BEFORE_RE.test(id);
export const kindOfId = (id: string): SnapKind => (BEFORE_RE.test(id) ? 'before-restore' : 'day');
export const beforeId = (ms: number) => `before-restore-${Math.floor(ms)}`;

/** Сутки по серверному времени (мс) в Казахстане: 'ГГГГ-ММ-ДД'. */
export const snapDay = (ms: number) => new Date(ms + SNAP_TZ_HOURS * 3_600_000).toISOString().slice(0, 10);
const dayNum = (d: string) => Math.floor(Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) / 86_400_000);

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const num = (v: unknown, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d);

/** Сводка сохранения. Испорченные значения (не число, не объект) считаются нулём и ничего не роняют. */
export function sumOf(s: Partial<Save> | null | undefined): SnapSum {
  const skills = isObj(s?.skills) ? Object.values(s!.skills as object) : [];
  let answers = 0, topics = 0;
  for (const k of skills) {
    const n = isObj(k) ? Math.max(0, num(k.attempts)) : 0;
    answers += n; if (n > 0) topics++;
  }
  return { answers, topics, coins: Math.max(0, num(s?.coins)), xp: Math.max(0, num(s?.xp)), days: isObj(s?.days) ? Object.keys(s!.days as object).length : 0 };
}

/** Разобрать список снимков из облака: чужое и странное отбрасывается (число вместо строки, пустой объект, неверный id). */
export function parseIndex(raw: unknown): SnapIndex {
  const out: SnapIndex = {};
  if (!isObj(raw)) return out;
  for (const [id, m] of Object.entries(raw)) {
    if (!isSnapId(id) || !isObj(m)) continue;
    const at = num(m.at, -1);
    if (at <= 0) continue;
    const s = isObj(m.sum) ? m.sum : {};
    out[id] = {
      at, app: typeof m.app === 'string' ? m.app : '?', v: Math.max(1, Math.floor(num(m.v, 1))), kind: kindOfId(id),
      sum: { answers: num(s.answers), topics: num(s.topics), coins: num(s.coins), xp: num(s.xp), days: num(s.days) },
    };
  }
  return out;
}

/** Список для экрана: свежие сверху. */
export const listSnaps = (index: SnapIndex): [string, SnapMeta][] => Object.entries(index).sort((a, b) => b[1].at - a[1].at);

/** Какие снимки пора удалить. Сутки сравниваются с серверным днём. Снимки дня старше 14 дней, копии «до» — старше 60 дней;
 *  но SNAP_KEEP_MIN свежих снимков дня остаются всегда: если приложение не открывали три недели, единственные копии не стираются. */
export function expiredIds(index: SnapIndex, serverMs: number): string[] {
  const today = dayNum(snapDay(serverMs));
  const days = Object.entries(index).filter(([, m]) => m.kind === 'day').sort((a, b) => (a[0] < b[0] ? 1 : -1));
  const protectedIds = new Set(days.slice(0, SNAP_KEEP_MIN).map(([id]) => id));
  const out: string[] = [];
  for (const [id, m] of Object.entries(index)) {
    if (m.kind === 'day') { if (!protectedIds.has(id) && today - dayNum(id) > SNAP_KEEP_DAYS) out.push(id); }
    else if (serverMs - m.at > BEFORE_KEEP_DAYS * 86_400_000) out.push(id);
  }
  return out;
}

export interface SnapPlan { id: string; doc: { save: string; at: number; app: string; v: number; kind: SnapKind; sum: SnapSum }; index: SnapIndex; expire: string[] }

/** Решить, нужен ли снимок дня. before — главный документ облака в том виде, каким он был перед записью этого устройства.
 *  Нет снимка, если: устройство не читало облако (pulled), схема облака новее приложения (readOnly), снимок за этот серверный день
 *  уже есть, облако пустое (нечего хранить), сохранение не читается или больше предела документа. */
export function planDaily(p: {
  pulled: boolean; readOnly: boolean; serverMs: number | null; index: SnapIndex;
  before: { save: unknown; v?: unknown; app?: unknown } | null; clientSchema: number;
}): SnapPlan | null {
  if (!p.pulled || p.readOnly || p.serverMs === null || !(p.serverMs > 0) || !p.before) return null;
  if (typeof p.before.save !== 'string' || byteLen(p.before.save) > SNAP_MAX_BYTES) return null;
  const v = num(p.before.v, 1);
  if (v > p.clientSchema) return null;
  const id = snapDay(p.serverMs);
  if (p.index[id]) return null;
  const chk = checkSaveJson(p.before.save, p.clientSchema);
  if (!chk.ok) return null;
  const app = typeof p.before.app === 'string' ? p.before.app : '?';
  const sum = sumOf(chk.rest);
  const meta: SnapMeta = { at: p.serverMs, app, v, kind: 'day', sum };
  const next = { ...p.index, [id]: meta };
  const expire = expiredIds(next, p.serverMs);
  for (const e of expire) delete next[e];
  return { id, doc: { save: p.before.save, at: p.serverMs, app, v, kind: 'day', sum }, index: next, expire };
}

/** Копия «до» перед восстановлением: текущее сохранение устройства (без истории ответов — они не пропадают, см. restoredSave). */
export function planBefore(p: { rest: Partial<Save>; serverMs: number; index: SnapIndex; app: string; clientSchema: number }): SnapPlan | null {
  const save = JSON.stringify(p.rest);
  if (byteLen(save) > SNAP_MAX_BYTES) return null;
  const id = beforeId(p.serverMs);
  const sum = sumOf(p.rest);
  const meta: SnapMeta = { at: p.serverMs, app: p.app, v: p.clientSchema, kind: 'before-restore', sum };
  const next = { ...p.index, [id]: meta };
  const expire = expiredIds(next, p.serverMs);
  for (const e of expire) delete next[e];
  return { id, doc: { save, at: p.serverMs, app: p.app, v: p.clientSchema, kind: 'before-restore', sum }, index: next, expire };
}

export type SnapCheck =
  | { ok: true; rest: Partial<Save> }
  | { ok: false; why: 'newer' | 'broken' | 'empty' };

/** Проверить строку сохранения из снимка (облако не доверенное: что угодно может быть испорчено). */
export function checkSaveJson(json: unknown, clientSchema: number): SnapCheck {
  if (typeof json !== 'string') return { ok: false, why: 'broken' };
  let rest: unknown;
  try { rest = JSON.parse(json); } catch { return { ok: false, why: 'broken' }; }
  if (!isObj(rest)) return { ok: false, why: 'broken' };
  if (rest.version !== undefined) {
    if (typeof rest.version !== 'number' || !Number.isInteger(rest.version) || rest.version < 1) return { ok: false, why: 'broken' };
    if (rest.version > clientSchema) return { ok: false, why: 'newer' };
  }
  for (const k of ['skills', 'days', 'settings']) if (rest[k] !== undefined && !isObj(rest[k])) return { ok: false, why: 'broken' };
  for (const k of ['xp', 'coins']) if (rest[k] !== undefined && !(typeof rest[k] === 'number' && Number.isFinite(rest[k] as number))) return { ok: false, why: 'broken' };
  if (rest.heroName !== undefined && typeof rest.heroName !== 'string') return { ok: false, why: 'broken' };
  if (rest.diagnosticDone !== undefined && typeof rest.diagnosticDone !== 'boolean') return { ok: false, why: 'broken' };
  for (const k of ['repairShop', 'aiLog', 'usage']) if (rest[k] !== undefined && !Array.isArray(rest[k])) return { ok: false, why: 'broken' };
  if (isBlank({ attempts: [], diagnosticDone: !!rest.diagnosticDone, xp: num(rest.xp) })) return { ok: false, why: 'empty' };
  return { ok: true, rest: rest as Partial<Save> };
}

/** Документ снимка целиком: поле v (схема приложения, записавшего его) и сохранение внутри. Любое отклонение — отказ. */
export function checkSnapshotDoc(data: unknown, clientSchema: number): SnapCheck {
  if (!isObj(data)) return { ok: false, why: 'broken' };
  if (data.v !== undefined && (typeof data.v !== 'number' || !Number.isFinite(data.v))) return { ok: false, why: 'broken' };
  if (num(data.v, 1) > clientSchema) return { ok: false, why: 'newer' };
  return checkSaveJson(data.save, clientSchema);
}

export interface CompareRow { key: keyof SnapSum; label: string; now: number; snap: number; delta: number }
export const COMPARE_LABELS: Record<keyof SnapSum, string> = { answers: 'Ответов (по темам)', topics: 'Тем начато', coins: 'Монет', xp: 'Опыта', days: 'Дней занятий' };

/** «Сейчас → в снимке» по пяти показателям. */
export function compareSaves(now: Partial<Save>, snap: Partial<Save>): { rows: CompareRow[]; rollback: boolean } {
  const a = sumOf(now), b = sumOf(snap);
  const rows = (Object.keys(COMPARE_LABELS) as (keyof SnapSum)[]).map(key => ({ key, label: COMPARE_LABELS[key], now: a[key], snap: b[key], delta: b[key] - a[key] }));
  return { rows, rollback: rows.some(r => r.delta < 0) };
}

const byAt = (list: AiTurn[]) => { const m = new Map<string, AiTurn>(); for (const x of list) if (!m.has(`${x.at}|${x.q}`)) m.set(`${x.at}|${x.q}`, x); return [...m.values()].sort((x, y) => x.at - y.at).slice(-100); };

/** Сохранение после восстановления: всё из снимка, КРОМЕ того, что не должно пропасть. Остаются и объединяются с снимком:
 *  история ответов (mergeAttempts), поведение по дням, вопросы к ИИ-помощнику; PIN командира остаётся тот, что стоит на устройстве
 *  (не откатывается на старый). Время изменения ставит replaceSave (новое), чтобы обычная синхронизация записала это в облако. */
export function restoredSave(local: Save, snapRest: Partial<Save>, snapAttempts: Attempt[] = []): Save {
  const out: any = { ...snapRest };
  out.attempts = mergeAttempts(local.attempts ?? [], snapAttempts);
  const usage = mergeUsage(local.usage ?? [], (snapRest.usage ?? []) as any);
  if (usage.length || local.usage || snapRest.usage) out.usage = usage; else delete out.usage;
  const ai = byAt([...(local.aiLog ?? []), ...(snapRest.aiLog ?? [])]);
  if (ai.length) out.aiLog = ai; else delete out.aiLog;
  const pin = local.settings?.pin ?? snapRest.settings?.pin;
  out.settings = { ...(snapRest.settings ?? local.settings) };
  if (pin !== undefined) out.settings.pin = pin; else delete out.settings.pin;
  out.version = Math.max(local.version ?? 1, snapRest.version ?? 1);
  return out as Save;
}
