// Облачное сохранение: Firebase Auth (вход Google) + Firestore. Загружается лениво — сайт работает и без него.
// Данные: users/{uid} — сохранение без истории ответов; users/{uid}/attempts/{ГГГГ-ММ} — история по месяцам
// (у документа Firestore предел 1 МБ, а ответов за полтора года больше); users/{uid}/usage/{ГГГГ-ММ} — поведение по дням
// для аналитики командира (src/lib/track.svelte.ts). Конфликт двух устройств решается
// по времени последнего изменения (updatedAt); проигравшая копия остаётся в localStorage (…before-replace).
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signInWithRedirect, signOut, sendSignInLinkToEmail, isSignInWithEmailLink, signInWithEmailLink, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail, type User } from 'firebase/auth';
import { getFirestore, doc, getDoc, getDocs, setDoc, collection, writeBatch } from 'firebase/firestore';
import { game, afterPersist, replaceSave } from './store.svelte';
import type { Attempt, Save, UsageDay } from '../engine/types';
import { mergeUsage } from '../engine/usage';

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
});
const EMAIL_KEY = 'razlom.emailForSignIn';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
let uid: string | null = null;
let timer: number | undefined;
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

async function push(all = false) {
  if (!uid) return;
  cloud.status = 'syncing';
  try {
    const { attempts, usage = [], ...rest } = $state.snapshot(game.save) as Save;
    const batch = writeBatch(db);
    batch.set(doc(db, 'users', uid), { save: JSON.stringify(rest), updatedAt: rest.updatedAt ?? Date.now(), app: 'razlom', v: 1 });
    for (const [m, list] of Object.entries(byMonth(attempts))) {
      if (!all && pushedCount[m] === list.length) continue;
      batch.set(doc(db, 'users', uid, 'attempts', m), { list: JSON.stringify(list), n: list.length });
      pushedCount[m] = list.length;
    }
    for (const [m, list] of Object.entries(usageByMonth(usage))) {
      const json = JSON.stringify(list);
      if (!all && pushedUsage[m] === json) continue;   // пишем только изменившийся месяц (обычно текущий)
      batch.set(doc(db, 'users', uid, 'usage', m), { list: json, n: list.length });
      pushedUsage[m] = json;
    }
    await batch.commit();
    cloud.status = 'ok'; cloud.lastSync = Date.now(); cloud.error = '';
  } catch (e: any) { cloud.status = 'error'; cloud.error = e?.code ?? String(e); }
}

async function pull() {
  if (!uid) return;
  cloud.status = 'syncing';
  try {
    const main = await getDoc(doc(db, 'users', uid));
    const local = game.save.updatedAt ?? 0;
    if (!main.exists()) { await push(true); return; }
    const remoteAt = main.data().updatedAt ?? 0;
    if (remoteAt > local) {
      const rest = JSON.parse(main.data().save) as Save;
      const months = await getDocs(collection(db, 'users', uid, 'attempts'));
      const attempts: Attempt[] = [];
      months.forEach(d => { const list = JSON.parse(d.data().list) as Attempt[]; attempts.push(...list); pushedCount[d.id] = list.length; });
      attempts.sort((a, b) => a.at - b.at);
      const usage: UsageDay[] = [];
      try {
        const um = await getDocs(collection(db, 'users', uid, 'usage'));
        um.forEach(d => { pushedUsage[d.id] = d.data().list; usage.push(...(JSON.parse(d.data().list) as UsageDay[])); });
      } catch { /* поведение — не главное: без него сохранение всё равно загружается */ }
      replaceSave({ ...rest, attempts, usage: mergeUsage(usage, $state.snapshot(game.save.usage ?? []) as UsageDay[]), updatedAt: remoteAt }, true);
      cloud.status = 'ok'; cloud.lastSync = Date.now();
    } else if (remoteAt < local) {
      await push(true);
    } else { cloud.status = 'ok'; cloud.lastSync = Date.now(); }
  } catch (e: any) { cloud.status = 'error'; cloud.error = e?.code ?? String(e); }
}

/** Запуск: следим за входом; каждое сохранение уходит в облако с задержкой 4 с (чтобы не писать на каждый клик). */
export function startCloud() {
  finishEmailLink();
  onAuthStateChanged(auth, (u: User | null) => {
    uid = u?.uid ?? null;
    cloud.user = u ? { email: u.email, name: u.displayName } : null;
    cloud.status = u ? cloud.status : 'off';
    if (u) pull();
  });
  afterPersist.push(() => { if (!uid) return; clearTimeout(timer); timer = window.setTimeout(() => push(), 4000); });
  addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && uid) { clearTimeout(timer); push(); } });
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
/** Токен входа для ИИ-помощника (helper/): без входа помощник не отвечает. */
export async function idToken(): Promise<string | null> { return auth.currentUser ? auth.currentUser.getIdToken() : null; }
