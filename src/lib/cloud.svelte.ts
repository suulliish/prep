// Облачное сохранение: Firebase Auth (вход Google) + Firestore. Загружается лениво — сайт работает и без него.
// Данные: users/{uid} — сохранение без истории ответов; users/{uid}/attempts/{ГГГГ-ММ} — история по месяцам
// (у документа Firestore предел 1 МБ, а ответов за полтора года больше). Конфликт двух устройств решается
// по времени последнего изменения (updatedAt); проигравшая копия остаётся в localStorage (…before-replace).
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signInWithRedirect, signOut, sendSignInLinkToEmail, isSignInWithEmailLink, signInWithEmailLink, type User } from 'firebase/auth';
import { getFirestore, doc, getDoc, getDocs, setDoc, collection, writeBatch } from 'firebase/firestore';
import { game, afterPersist, replaceSave } from './store.svelte';
import type { Attempt, Save } from '../engine/types';

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

const monthOf = (a: Attempt) => a.day.slice(0, 7);
function byMonth(list: Attempt[]) {
  const m: Record<string, Attempt[]> = {};
  for (const a of list) (m[monthOf(a)] ??= []).push(a);
  return m;
}

async function push(all = false) {
  if (!uid) return;
  cloud.status = 'syncing';
  try {
    const { attempts, ...rest } = $state.snapshot(game.save) as Save;
    const batch = writeBatch(db);
    batch.set(doc(db, 'users', uid), { save: JSON.stringify(rest), updatedAt: rest.updatedAt ?? Date.now(), app: 'razlom', v: 1 });
    for (const [m, list] of Object.entries(byMonth(attempts))) {
      if (!all && pushedCount[m] === list.length) continue;
      batch.set(doc(db, 'users', uid, 'attempts', m), { list: JSON.stringify(list), n: list.length });
      pushedCount[m] = list.length;
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
      replaceSave({ ...rest, attempts, updatedAt: remoteAt }, true);
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
