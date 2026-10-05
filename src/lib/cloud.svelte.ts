// Облачное сохранение: Firebase Auth (вход Google) + Firestore. Загружается лениво — сайт работает и без него.
// Данные: users/{uid} — сохранение без истории ответов; users/{uid}/attempts/{ГГГГ-ММ} — история по месяцам
// (у документа Firestore предел 1 МБ, а ответов за полтора года больше); users/{uid}/usage/{ГГГГ-ММ} — поведение по дням
// для аналитики командира (src/lib/track.svelte.ts).
// Два устройства (S1, 02.10): облако перечитывается при каждом возврате в приложение; запись — транзакцией с номером
// версии документа (rev): если облако изменилось с тех пор, как его видело устройство, обе копии сливаются по полям
// (src/engine/sync.ts mergeSave) и в облако уходит слияние — ничего не перезаписывается вслепую. Документ более новой
// схемы, чем знает это приложение, только читается («Жаңарту керек»).
// Снимки (S4, 05.10): раз в серверные сутки облако запоминает состояние ДО первой записи дня (users/{uid}/snapshots/{день}, 14 дней),
// командир может восстановить сохранение из снимка (restoreSnapshot) — перед этим копия «до»; логика — src/engine/snapshots.ts.
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signInWithRedirect, signOut, sendSignInLinkToEmail, isSignInWithEmailLink, signInWithEmailLink, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail, type User } from 'firebase/auth';
import { getFirestore, doc, getDoc, getDocs, collection, runTransaction, setDoc, serverTimestamp } from 'firebase/firestore';
import { APP_VERSION, deviceId, deviceLabel } from './version';
import { game, afterPersist, replaceSave, persistLocal } from './store.svelte';
import type { Attempt, Save, UsageDay } from '../engine/types';
import { mergeUsage } from '../engine/usage';
import { mergeAttempts, mergeSave, sameSave, isBlank } from '../engine/sync';
import { parseIndex, planDaily, planBefore, checkSnapshotDoc, compareSaves, restoredSave, isSnapId, type SnapIndex, type SnapPlan, type CompareRow } from '../engine/snapshots';

// Конфиг веб-приложения Firebase — не секрет (доступ к данным закрывают правила Firestore, см. docs/CLOUD.md)
const firebaseConfig = {
  apiKey: 'AIzaSyCVyGq8K4uQZABYckbI6Br_zOjWXAi_ooM',
  authDomain: 'prep-b72a9.firebaseapp.com',
  projectId: 'prep-b72a9',
  storageBucket: 'prep-b72a9.firebasestorage.app',
  messagingSenderId: '356843321023',
  appId: '1:356843321023:web:3dac1123467101abc3f80a',
};

export const cloud = $state({
  user: null as { email: string | null; name: string | null } | null,
  status: 'off' as 'off' | 'syncing' | 'ok' | 'error',
  lastSync: 0,
  error: '',
  linkSent: '' as string, // почта, куда ушла ссылка для входа
  // какая версия приложения на каждом устройстве аккаунта и когда оно последний раз писало в облако (S6): видно командиру
  devices: {} as Record<string, { app: string; at: number; label: string }>,
  readOnly: false,   // в облаке схема новее, чем знает это приложение: только читаем, пока страница не обновится
  snaps: {} as SnapIndex,   // список снимков облака (S4): users/{uid}/meta/snaps, обновляется loadSnaps()
});
/** Какую схему сохранения понимает это приложение (Save.version). */
export const CLIENT_SCHEMA = 1;
const EMAIL_KEY = 'razlom.emailForSignIn';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
let uid: string | null = null;
// в облако не пишем, пока не загрузили облачную копию: иначе устройство, сохранившее что-то до загрузки
// (экран корабля, PIN командира на новом телефоне), выглядит «новее» и затирает облако (src/engine/sync.ts)
let pulled = false;
let timer: number | undefined;
let snapBusy = false, snapCheckedAt = 0;   // S4: снимок дня — не чаще раза в час за сеанс, одна проверка за раз
let restoring = false;                      // S4: восстановление идёт — вторую не начинаем
const pushedCount: Record<string, number> = {}; // сколько ответов месяца уже в облаке
const pushedUsage: Record<string, string> = {};  // что из поведения месяца уже в облаке (строка JSON)

const monthOf = (a: Attempt) => a.day.slice(0, 7);
function byMonth(list: Attempt[]) {
  const m: Record<string, Attempt[]> = {};
  for (const a of list) (m[monthOf(a)] ??= []).push(a);
  return m;
}

function usageByMonth(list: UsageDay[]) {
  const m: Record<string, UsageDay[]> = {};
  for (const d of list) (m[d.day.slice(0, 7)] ??= []).push(d);
  return m;
}

// База трёхстороннего слияния — копия облака (без ответов) после последней синхронизации этого устройства.
const baseKey = () => `razlom.base.${uid}`;
function loadBase(): Save | null { try { const t = localStorage.getItem(baseKey()); return t ? JSON.parse(t) : null; } catch { return null; } }
function saveBase(rest: Partial<Save>) { try { localStorage.setItem(baseKey(), JSON.stringify(rest)); } catch { /* места нет — слияние без базы */ } }
let lastRev = -1, lastAt = -1;   // какой документ облака видело устройство (номер версии и время)
const BUSY = ['lesson', 'session', 'recall', 'diagnostic'];
let reloadOnHub = false;          // облако изменилось, пока ребёнок решал: применить, когда вернётся на корабль

function outdated() { cloud.readOnly = true; cloud.status = 'error'; cloud.error = 'app/outdated'; }
const restOf = (s: Save): Partial<Save> => { const { attempts: _a, usage: _u, ...rest } = s; return rest; };

/** Применить слитое сохранение на устройстве. Посреди задания не трогаем экран — применим на корабле. */
function apply(merged: Save): boolean {
  const cur = $state.snapshot(game.save) as Save;
  if (sameSave(restOf(merged), restOf(cur))) {
    const t = Math.max(cur.updatedAt ?? 0, merged.updatedAt ?? 0);
    if ((merged.attempts?.length ?? 0) !== (cur.attempts?.length ?? 0) || (merged.usage?.length ?? 0) !== (cur.usage?.length ?? 0) || t !== (cur.updatedAt ?? 0)) {
      game.save.attempts = merged.attempts; game.save.usage = merged.usage; game.save.updatedAt = t; persistLocal();
    }
    return true;
  }
  if (BUSY.includes(game.screen.name)) { reloadOnHub = true; return false; }
  replaceSave(merged, true);
  return true;
}

async function push(all = false) {
  if (!uid || !pulled || cloud.readOnly) return;
  cloud.status = 'syncing';
  const me = uid;
  try {
    const local = $state.snapshot(game.save) as Save;
    const { attempts, usage = [], ...localRest } = local;
    const mainRef = doc(db, 'users', me);
    const res = await runTransaction(db, async tx => {
      // чтения — до записей (правило транзакций)
      const snap = await tx.get(mainRef);
      const d = snap.exists() ? snap.data() : null;
      if (d && (d.v ?? 1) > CLIENT_SCHEMA) throw { code: 'app/outdated' };
      const rev = d?.rev ?? 0, at = d?.updatedAt ?? 0;
      let rest: Partial<Save> = localRest, mergedRemote = false;
      if (d && (rev !== lastRev || at !== lastAt)) {
        // облако изменилось с тех пор, как его видело устройство (другое устройство или старая версия приложения) — сливаем
        rest = restOf(mergeSave(loadBase(), { ...local, attempts: [], usage: [] }, { ...(JSON.parse(d.save) as Save), attempts: [], usage: [] }));
        mergedRemote = true;
      }
      const months = Object.entries(byMonth(attempts)).filter(([m, list]) => all || mergedRemote || pushedCount[m] !== list.length);
      const umonths = Object.entries(usageByMonth(usage)).filter(([m, list]) => all || mergedRemote || pushedUsage[m] !== JSON.stringify(list));
      const remoteAtt = await Promise.all(months.map(([m]) => tx.get(doc(db, 'users', me, 'attempts', m))));
      const remoteUse = await Promise.all(umonths.map(([m]) => tx.get(doc(db, 'users', me, 'usage', m))));
      const attOut = months.map(([m, list], i) => [m, remoteAtt[i].exists() ? mergeAttempts(list, JSON.parse(remoteAtt[i].data()!.list)) : list] as const);
      const useOut = umonths.map(([m, list], i) => [m, remoteUse[i].exists() ? mergeUsage(JSON.parse(remoteUse[i].data()!.list), list) : list] as const);
      const newAt = Math.max(rest.updatedAt ?? 0, at, Date.now() - 1);
      const device = { app: APP_VERSION, at: Date.now(), label: deviceLabel() };
      // merge: поле devices — по ключу на устройство, остальные устройства не стираются
      tx.set(mainRef, { save: JSON.stringify({ ...rest, updatedAt: newAt }), updatedAt: newAt, app: 'razlom', v: CLIENT_SCHEMA, rev: rev + 1, appVersion: APP_VERSION, devices: { [deviceId()]: device } }, { merge: true });
      for (const [m, list] of attOut) tx.set(doc(db, 'users', me, 'attempts', m), { list: JSON.stringify(list), n: list.length });
      for (const [m, list] of useOut) tx.set(doc(db, 'users', me, 'usage', m), { list: JSON.stringify(list), n: list.length });
      return { rest: { ...rest, updatedAt: newAt }, rev: rev + 1, at: newAt, attOut, useOut, device, mergedRemote, before: d ? { save: d.save, v: d.v, app: d.appVersion } : null };
    });
    if (uid !== me) return;   // пока писали, сменился аккаунт
    for (const [m, list] of res.attOut) pushedCount[m] = list.length;
    for (const [m, list] of res.useOut) pushedUsage[m] = JSON.stringify(list);
    cloud.devices = { ...cloud.devices, [deviceId()]: res.device };
    // ответы и поведение, пришедшие из облака при слиянии месяцев, — на устройство
    const allAtt = res.attOut.reduce((acc, [, list]) => mergeAttempts(acc, list as any), $state.snapshot(game.save.attempts) as any);
    const allUse = res.useOut.reduce((acc, [, list]) => mergeUsage(acc, list as any), ($state.snapshot(game.save.usage) ?? []) as any);
    const merged = { ...(res.rest as Save), attempts: allAtt, usage: allUse };
    if (apply(res.mergedRemote ? merged : { ...($state.snapshot(game.save) as Save), attempts: allAtt, usage: allUse })) {
      saveBase(res.rest); lastRev = res.rev; lastAt = res.at;
    }
    cloud.status = 'ok'; cloud.lastSync = Date.now(); cloud.error = '';
    void snapshotStep(me, res.before);   // S4: снимок дня (не ждём, ошибки не мешают синхронизации)
  } catch (e: any) {
    if (e?.code === 'app/outdated') outdated();
    else { cloud.status = 'error'; cloud.error = e?.code ?? String(e); }
  }
}

async function pull() {
  if (!uid) return;
  cloud.status = 'syncing';
  const me = uid;
  try {
    const main = await getDoc(doc(db, 'users', me));
    const localSave = $state.snapshot(game.save) as Save;
    if (!main.exists()) {
      pulled = true; lastRev = 0; lastAt = 0;
      if (!isBlank(localSave)) await push(true); else { cloud.status = 'ok'; cloud.lastSync = Date.now(); }
      return;
    }
    const d = main.data();
    cloud.devices = { ...(d.devices ?? {}) };
    if ((d.v ?? 1) > CLIENT_SCHEMA) { pulled = true; outdated(); return; }
    const remoteRest = JSON.parse(d.save) as Save;
    // ответы и поведение облака читаем всегда: их объединяем с устройством, а не заменяем
    const remoteAttempts: Attempt[] = [];
    const months = await getDocs(collection(db, 'users', me, 'attempts'));
    months.forEach(x => { const list = JSON.parse(x.data().list) as Attempt[]; remoteAttempts.push(...list); pushedCount[x.id] = list.length; });
    const remoteUsage: UsageDay[] = [];
    try {
      const um = await getDocs(collection(db, 'users', me, 'usage'));
      um.forEach(x => { pushedUsage[x.id] = x.data().list; remoteUsage.push(...(JSON.parse(x.data().list) as UsageDay[])); });
    } catch { /* поведение — не главное: без него сохранение всё равно загружается */ }
    if (uid !== me) return;
    const remote: Save = { ...remoteRest, attempts: remoteAttempts, usage: remoteUsage, updatedAt: d.updatedAt ?? remoteRest.updatedAt };
    const merged = mergeSave(loadBase(), localSave, remote);
    pulled = true;
    const applied = apply(merged);
    if (applied) { saveBase(restOf(remote)); lastRev = d.rev ?? 0; lastAt = d.updatedAt ?? 0; }
    // в облаке не хватает того, что есть на устройстве (ответы, дни, настройки) — туда уходит слияние
    const behind = !sameSave(restOf(merged), restOf(remote)) || (merged.attempts?.length ?? 0) > remoteAttempts.length || (merged.usage ?? []).some(u => !remoteUsage.some(r => r.day === u.day && r.activeMs >= u.activeMs));
    if (applied && behind) await push(true);
    else { cloud.status = 'ok'; cloud.lastSync = Date.now(); cloud.error = cloud.readOnly ? cloud.error : ''; }
  } catch (e: any) { cloud.status = 'error'; cloud.error = e?.code ?? String(e); }
}

// ---------- Снимки облака и восстановление (S4, чистая логика — src/engine/snapshots.ts) ----------
const snapsRef = (me: string) => doc(db, 'users', me, 'meta', 'snaps');

/** Время сервера Firestore, мс (не часы устройства — они могут врать): отметка пишется в users/{uid}/meta/clock и читается обратно.
 *  null — связи нет или сервер ещё не проставил время: тогда снимок не делаем. */
async function serverNow(me: string): Promise<number | null> {
  const ask = async (): Promise<number | null> => {
    try {
      const ref = doc(db, 'users', me, 'meta', 'clock');
      await setDoc(ref, { t: serverTimestamp() });   // без связи запись встаёт в очередь и не завершается — отсюда ограничение по времени ниже
      const s = await getDoc(ref);
      const t: any = s.exists() ? s.data()?.t : null;
      const ms = typeof t?.toMillis === 'function' ? t.toMillis() : null;
      return typeof ms === 'number' && Number.isFinite(ms) && ms > 0 ? ms : null;
    } catch { return null; }
  };
  let timer: ReturnType<typeof setTimeout> | undefined;
  const limit = new Promise<null>(r => { timer = setTimeout(() => r(null), 10_000); });
  try { return await Promise.race([ask(), limit]); } finally { clearTimeout(timer); }
}

/** Одной транзакцией: прочитать список снимков, решить (plan), записать снимок + новый список + удалить просроченные. */
async function applyPlan(me: string, plan: (index: SnapIndex) => SnapPlan | null): Promise<SnapPlan | null> {
  return runTransaction(db, async tx => {
    const snap = await tx.get(snapsRef(me));
    const p = plan(parseIndex(snap.exists() ? snap.data()?.index : null));
    if (!p) return null;
    tx.set(doc(db, 'users', me, 'snapshots', p.id), p.doc);
    tx.set(snapsRef(me), { index: p.index });
    for (const id of p.expire) tx.delete(doc(db, 'users', me, 'snapshots', id));
    return p;
  });
}

/** Снимок дня: после успешной записи в облако. before — главный документ облака в том виде, каким он был ПЕРЕД этой записью.
 *  Только если устройство уже читало облако и схема не новее; день — по времени сервера; не чаще раза в час за сеанс. Ошибки молчат. */
async function snapshotStep(me: string, before: { save: unknown; v?: unknown; app?: unknown } | null) {
  if (snapBusy || !before || !uid || uid !== me || !pulled || cloud.readOnly) return;
  if (Date.now() - snapCheckedAt < 3_600_000) return;
  snapBusy = true;
  try {
    const serverMs = await serverNow(me);
    if (serverMs === null || uid !== me) return;
    snapCheckedAt = Date.now();
    const p = await applyPlan(me, index => planDaily({ pulled, readOnly: cloud.readOnly, serverMs, index, before, clientSchema: CLIENT_SCHEMA }));
    if (p && uid === me) cloud.snaps = p.index;
  } catch { /* снимок — не главное: синхронизация идёт без него */ }
  finally { snapBusy = false; }
}

export type SnapError = 'no-login' | 'busy' | 'offline' | 'outdated' | 'newer' | 'broken' | 'empty' | 'missing' | 'cancelled' | 'task' | 'before-failed';
const SNAP_ERR: Record<'newer' | 'broken' | 'empty', SnapError> = { newer: 'newer', broken: 'broken', empty: 'empty' };

/** Обновить список снимков (users/{uid}/meta/snaps). */
export async function loadSnaps(): Promise<boolean> {
  if (!uid) return false;
  const me = uid;
  try {
    const s = await getDoc(snapsRef(me));
    if (uid !== me) return false;
    cloud.snaps = parseIndex(s.exists() ? s.data()?.index : null);
    return true;
  } catch { return false; }
}

/** Сравнение «сейчас → в снимке» без каких-либо изменений. Снимок не читается или новее приложения — отказ с причиной. */
export async function inspectSnapshot(id: string): Promise<{ ok: true; rows: CompareRow[]; rollback: boolean } | { ok: false; error: SnapError }> {
  if (!uid) return { ok: false, error: 'no-login' };
  if (!isSnapId(id)) return { ok: false, error: 'missing' };
  const me = uid;
  try {
    const s = await getDoc(doc(db, 'users', me, 'snapshots', id));
    if (uid !== me) return { ok: false, error: 'cancelled' };
    if (!s.exists()) return { ok: false, error: 'missing' };
    const chk = checkSnapshotDoc(s.data(), CLIENT_SCHEMA);
    if (!chk.ok) return { ok: false, error: SNAP_ERR[chk.why] };
    return { ok: true, ...compareSaves($state.snapshot(game.save) as Save, chk.rest) };
  } catch { return { ok: false, error: 'offline' }; }
}

/** Восстановить сохранение из снимка. Порядок: свежая загрузка облака → проверка снимка → копия «до» в облаке (не вышла — стоп,
 *  ничего не изменено) → replaceSave (прежнее сохранение ещё и в трёх локальных копиях) → обычная синхронизация записывает результат
 *  транзакцией с rev. Ответы не теряются (restoredSave). alive() — экран ещё открыт: закрыли посреди работы — до замены останавливаемся. */
export async function restoreSnapshot(id: string, alive: () => boolean = () => true): Promise<{ ok: true; synced: boolean } | { ok: false; error: SnapError }> {
  if (restoring) return { ok: false, error: 'busy' };
  if (!uid) return { ok: false, error: 'no-login' };
  if (!isSnapId(id)) return { ok: false, error: 'missing' };
  if (cloud.readOnly) return { ok: false, error: 'outdated' };
  if (!pulled) return { ok: false, error: 'offline' };
  if (BUSY.includes(game.screen.name)) return { ok: false, error: 'task' };
  restoring = true;
  const me = uid;
  let replaced = false;
  const stop = (): SnapError | null => (uid !== me || !alive() ? 'cancelled' : cloud.readOnly ? 'outdated' : BUSY.includes(game.screen.name) ? 'task' : null);
  try {
    await pull();   // самое свежее из облака — в сохранение устройства (ответы объединяются), потом уже «до» и замена
    if (cloud.readOnly) return { ok: false, error: 'outdated' };
    if (cloud.status === 'error') return { ok: false, error: 'offline' };
    let bad = stop(); if (bad) return { ok: false, error: bad };
    const s = await getDoc(doc(db, 'users', me, 'snapshots', id));
    if (!s.exists()) return { ok: false, error: 'missing' };
    const chk = checkSnapshotDoc(s.data(), CLIENT_SCHEMA);
    if (!chk.ok) return { ok: false, error: SNAP_ERR[chk.why] };
    const serverMs = await serverNow(me);
    if (serverMs === null) return { ok: false, error: 'offline' };
    bad = stop(); if (bad) return { ok: false, error: bad };
    const p = await applyPlan(me, index => planBefore({ rest: restOf($state.snapshot(game.save) as Save), serverMs, index, app: APP_VERSION, clientSchema: CLIENT_SCHEMA }));
    if (!p) return { ok: false, error: 'before-failed' };
    if (uid === me) cloud.snaps = p.index;
    bad = stop(); if (bad) return { ok: false, error: bad };   // копия «до» осталась в облаке — вреда нет
    replaceSave(restoredSave($state.snapshot(game.save) as Save, chk.rest));
    replaced = true;
    clearTimeout(timer);
    await push();
    return { ok: true, synced: cloud.status === 'ok' };
  } catch (e: any) {
    if (replaced) return { ok: true, synced: false };   // сохранение уже заменено; облако обновит обычная синхронизация
    return { ok: false, error: e?.code === 'app/outdated' ? 'outdated' : 'before-failed' };
  } finally { restoring = false; }
}

let lastPull = 0;
/** Перечитать облако при возврате в приложение (не чаще раза в 30 с). */
function pullSoon() { if (!uid || Date.now() - lastPull < 30_000) return; lastPull = Date.now(); void pull(); }

/** Запуск: следим за входом; каждое сохранение уходит в облако с задержкой 4 с (чтобы не писать на каждый клик). */
export function startCloud() {
  finishEmailLink();
  onAuthStateChanged(auth, (u: User | null) => {
    if ((u?.uid ?? null) !== uid) { pulled = false; lastRev = -1; lastAt = -1; snapCheckedAt = 0; cloud.snaps = {}; }   // другой аккаунт или выход: сначала снова загрузка
    uid = u?.uid ?? null;
    cloud.user = u ? { email: u.email, name: u.displayName } : null;
    cloud.status = u ? cloud.status : 'off';
    if (u) { lastPull = Date.now(); pull(); }
  });
  afterPersist.push(() => { if (!uid) return; clearTimeout(timer); timer = window.setTimeout(() => push(), 4000); });
  addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && uid) { clearTimeout(timer); push(); }
    if (document.visibilityState === 'visible') pullSoon();
  });
  addEventListener('focus', pullSoon);
  addEventListener('online', () => { lastPull = 0; pullSoon(); });
  // облако изменилось посреди задания — применяем, когда ребёнок на корабле
  $effect.root(() => { $effect(() => { if (game.screen.name === 'hub' && reloadOnHub) { reloadOnHub = false; lastPull = 0; pullSoon(); } }); });
}

export async function signIn() {
  const p = new GoogleAuthProvider();
  try { await signInWithPopup(auth, p); }
  catch (e: any) {
    if (e?.code === 'auth/popup-blocked' || e?.code === 'auth/operation-not-supported-in-this-environment') await signInWithRedirect(auth, p);
    else { cloud.status = 'error'; cloud.error = e?.code ?? String(e); }
  }
}
/** Вход по почте и паролю — без писем (ссылки на бесплатном тарифе Firebase: не больше 5 писем в день на проект).
 *  Нет такого аккаунта — создаём; есть, но пароль другой — ошибка «неверный пароль». */
export async function signInPassword(email: string, password: string) {
  cloud.error = '';
  try { await signInWithEmailAndPassword(auth, email, password); return; }
  catch (e: any) {
    if (!['auth/invalid-credential', 'auth/user-not-found', 'auth/invalid-login-credentials'].includes(e?.code)) { cloud.status = 'error'; cloud.error = e?.code ?? String(e); return; }
  }
  try { await createUserWithEmailAndPassword(auth, email, password); }
  catch (e: any) { cloud.status = 'error'; cloud.error = e?.code === 'auth/email-already-in-use' ? 'auth/wrong-password' : e?.code ?? String(e); }
}
/** Забыли пароль: письмо со сбросом (лимит бесплатного тарифа — 150 писем в день). */
export async function resetPassword(email: string) {
  cloud.error = '';
  try { await sendPasswordResetEmail(auth, email); cloud.linkSent = email; }
  catch (e: any) { cloud.status = 'error'; cloud.error = e?.code ?? String(e); }
}
/** Вход по ссылке на почту (любая почта, в т. ч. iCloud; без пароля). */
export async function sendLink(email: string) {
  cloud.error = '';
  try {
    await sendSignInLinkToEmail(auth, email, { url: location.origin + location.pathname, handleCodeInApp: true });
    try { localStorage.setItem(EMAIL_KEY, email); } catch { /* */ }
    cloud.linkSent = email;
  } catch (e: any) { cloud.status = 'error'; cloud.error = e?.code ?? String(e); }
}
/** Открыли ссылку из письма: завершаем вход и убираем параметры из адреса. */
async function finishEmailLink() {
  if (!isSignInWithEmailLink(auth, location.href)) return;
  let email: string | null = null;
  try { email = localStorage.getItem(EMAIL_KEY); } catch { /* */ }
  email ??= prompt('На какую почту пришла ссылка для входа?');
  if (!email) return;
  try {
    await signInWithEmailLink(auth, email, location.href);
    try { localStorage.removeItem(EMAIL_KEY); } catch { /* */ }
    cloud.linkSent = '';
  } catch (e: any) { cloud.status = 'error'; cloud.error = e?.code ?? String(e); }
  history.replaceState(null, '', location.pathname);
}

export async function signOutCloud() { await push(); await signOut(auth); }
export const syncNow = () => pull();
/** Отправить в облако сейчас (тесты, кнопка командира). */
export const pushNow = () => push();
/** Токен входа для ИИ-помощника (helper/): без входа помощник не отвечает. */
export async function idToken(): Promise<string | null> { return auth.currentUser ? auth.currentUser.getIdToken() : null; }
