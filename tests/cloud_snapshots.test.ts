// Облако: снимки дня и восстановление (S4). Firebase подменён заглушкой (настоящего облака тут нет): документы — в памяти,
// серверное время — переменная remote.serverMs.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Attempt } from '../src/engine/types';
// PIN в сохранении: 64 hex (старый формат SHA-256), как требует src/engine/pin.ts isStoredPin
const OLD_PIN = '0'.repeat(64), NEW_PIN = '1'.repeat(64);

const remote = vi.hoisted(() => ({
  docs: {} as Record<string, any>,
  authCb: null as null | ((u: any) => void),
  serverMs: 0 as number,
  noClock: false,
  hangClock: false,                                      // запись отметки времени не завершается (нет связи)
  failTx: null as null | ((path: string) => boolean),   // транзакция с записью в такие документы падает (нет связи)
  deleted: [] as string[],
}));

vi.mock('firebase/app', () => ({ initializeApp: () => ({}) }));
vi.mock('firebase/auth', () => ({
  getAuth: () => ({}), GoogleAuthProvider: class {}, signInWithPopup: async () => {}, signInWithRedirect: async () => {}, signOut: async () => {},
  sendSignInLinkToEmail: async () => {}, isSignInWithEmailLink: () => false, signInWithEmailLink: async () => {},
  signInWithEmailAndPassword: async () => {}, createUserWithEmailAndPassword: async () => {}, sendPasswordResetEmail: async () => {},
  onAuthStateChanged: (_a: any, cb: (u: any) => void) => { remote.authCb = cb; },
}));
vi.mock('firebase/firestore', () => ({
  getFirestore: () => ({}),
  doc: (_db: any, ...p: string[]) => ({ path: p.join('/') }),
  collection: (_db: any, ...p: string[]) => ({ path: p.join('/') }),
  serverTimestamp: () => (remote.noClock ? { pending: true } : { toMillis: () => remote.serverMs }),
  getDoc: async (r: { path: string }) => ({ exists: () => r.path in remote.docs, data: () => remote.docs[r.path] }),
  getDocs: async (c: { path: string }) => {
    const hits = Object.entries(remote.docs).filter(([k]) => k.startsWith(c.path + '/') && !k.slice(c.path.length + 1).includes('/'));
    return { forEach: (f: (d: any) => void) => hits.forEach(([k, v]) => f({ id: k.slice(c.path.length + 1), data: () => v })) };
  },
  setDoc: async (r: { path: string }, data: any) => { if (remote.hangClock && r.path.endsWith('/clock')) return new Promise(() => {}); remote.docs[r.path] = data; },
  runTransaction: async (_db: any, fn: (tx: any) => any) => {
    const writes: (() => void)[] = [], paths: string[] = [];
    const out = await fn({
      get: async (r: { path: string }) => ({ exists: () => r.path in remote.docs, data: () => remote.docs[r.path] }),
      set: (r: { path: string }, data: any, opts?: { merge?: boolean }) => { paths.push(r.path); writes.push(() => { remote.docs[r.path] = opts?.merge ? { ...remote.docs[r.path], ...data } : data; }); },
      delete: (r: { path: string }) => { paths.push(r.path); writes.push(() => { delete remote.docs[r.path]; remote.deleted.push(r.path); }); },
    });
    if (remote.failTx && paths.some(remote.failTx)) throw { code: 'unavailable' };   // всё или ничего, как в настоящей транзакции
    writes.forEach(w => w());
    return out;
  },
}));

const att = (at: number, day = '2026-10-01'): Attempt => ({ at, day, skill: 'a', source: 't', correct: true, hintLevel: 0, honest: true, timeMs: 9000, mode: 'practice' } as Attempt);
const tick = () => new Promise(r => setTimeout(r, 0));
const until = async (f: () => boolean) => { for (let i = 0; i < 60 && !f(); i++) await tick(); };
const sk = (attempts: number) => ({ p: 0.5, status: 'learning', lessonDone: false, stage: 0, attempts, correct: 0, misconceptions: {} });
const T1 = Date.UTC(2026, 9, 5, 10, 0, 0);       // 5 октября 2026
const DAY = 86_400_000;

async function setup() {
  vi.stubGlobal('addEventListener', () => {});
  vi.stubGlobal('location', { href: 'http://x/', origin: 'http://x', pathname: '/' });
  vi.stubGlobal('document', { visibilityState: 'visible' });
  vi.stubGlobal('window', { setTimeout: () => 0 });   // отложенную отправку после сохранения не запускаем: пишем сами (pushNow / restoreSnapshot)
  const store = await import('../src/lib/store.svelte');
  const C = await import('../src/lib/cloud.svelte');
  if (!remote.authCb) C.startCloud();
  C.cloud.readOnly = false; C.cloud.error = '';   // состояние модуля общее для всех проверок файла
  return { game: store.game, C };
}
const baseRest = (x: any = {}) => ({ version: 1, heroName: 'Муртаза', xp: 100, skills: { a: sk(10) }, days: { '2026-10-01': { date: '2026-10-01', blocksDone: {}, planShare: 0, minutesToday: 0, minutesWeekend: 0, extraMissions: 0, bonuses: [] } }, settings: { extraMissionCap: 1, extraTo: 'today', planMinutes: 40 }, diagnosticDone: true, repairShop: [], coins: 30, updatedAt: 1000, ...x });
/** Прогресс устройства без времени изменения (сверка «ничего не изменилось»: загрузка облака перед восстановлением может поправить только время). */
const fp = (s: any) => JSON.stringify({ ...JSON.parse(JSON.stringify(s)), updatedAt: 0 });
const snapsOf = (uid: string) => Object.keys(remote.docs).filter(k => k.startsWith(`users/${uid}/snapshots/`)).sort();

/** Вход: в облаке сохранение (и ответы), устройство пустое — берёт облако. */
async function login(uid: string, cloudRest: any, attempts: Attempt[] = []) {
  const { game, C } = await setup();
  remote.docs[`users/${uid}`] = { save: JSON.stringify(cloudRest), updatedAt: cloudRest.updatedAt, rev: 1, v: 1, appVersion: 'v-old' };
  if (attempts.length) remote.docs[`users/${uid}/attempts/2026-10`] = { list: JSON.stringify(attempts), n: attempts.length };
  game.save.attempts = []; game.save.xp = 0; game.save.diagnosticDone = false; game.save.updatedAt = 0; game.save.skills = {}; game.save.settings = { extraMissionCap: 1, extraTo: 'today', planMinutes: 40 };
  C.cloud.status = 'off';
  remote.authCb!({ uid, email: uid + '@x', displayName: uid });
  await until(() => C.cloud.status === 'ok');
  expect(C.cloud.status).toBe('ok');
  return { game, C };
}

describe('облако: снимок дня', () => {
  beforeEach(() => { remote.docs = {}; remote.serverMs = T1; remote.noClock = false; remote.failTx = null; remote.deleted = []; vi.restoreAllMocks(); });

  it('первая запись дня: в снимок уходит состояние облака ДО записи, в списке — сводка; дальше за этот день снимков нет', async () => {
    const { game, C } = await login('s1', baseRest());
    expect(snapsOf('s1')).toEqual([]);                    // загрузка облака ничего не снимает
    game.save.xp = 150; game.save.updatedAt = 2000;       // устройство продвинулось
    await C.pushNow();
    await until(() => snapsOf('s1').length > 0);
    expect(snapsOf('s1')).toEqual(['users/s1/snapshots/2026-10-05']);
    const snap = remote.docs['users/s1/snapshots/2026-10-05'];
    expect(JSON.parse(snap.save).xp).toBe(100);           // «до», а не новое 150
    expect(JSON.parse(remote.docs['users/s1'].save).xp).toBe(150);   // а главный документ — новое
    expect(snap).toMatchObject({ at: T1, app: 'v-old', v: 1, kind: 'day', sum: { answers: 10, topics: 1, coins: 30, xp: 100, days: 1 } });
    expect(Object.keys(remote.docs['users/s1/meta/snaps'].index)).toEqual(['2026-10-05']);
    expect(Object.keys(C.cloud.snaps)).toEqual(['2026-10-05']);
    // вторая запись в тот же день, хоть и через два часа: снимок остаётся первым
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 2 * 3_600_000);
    game.save.xp = 170; game.save.updatedAt = 3000;
    await C.pushNow(); await until(() => false || true); await tick(); await tick(); await tick();
    expect(JSON.parse(remote.docs['users/s1/snapshots/2026-10-05'].save).xp).toBe(100);
    expect(snapsOf('s1').length).toBe(1);
  });

  it('новые сутки (по серверу) — новый снимок; снимки старше 14 дней удаляются, свежие остаются', async () => {
    const { game, C } = await login('s2', baseRest());
    const old = (ago: number) => { const ms = T1 - ago * DAY; return [new Date(ms + 5 * 3_600_000).toISOString().slice(0, 10), ms] as const; };
    const index: any = {};
    for (const ago of [1, 2, 3, 14, 15, 30]) { const [id, at] = old(ago); index[id] = { at, app: 'x', v: 1, sum: { answers: 1, topics: 1, coins: 1, xp: 1, days: 1 } }; remote.docs[`users/s2/snapshots/${id}`] = { save: '{}' }; }
    remote.docs['users/s2/meta/snaps'] = { index };
    game.save.xp = 150; game.save.updatedAt = 2000;
    await C.pushNow();
    await until(() => remote.deleted.length >= 2);
    expect(remote.deleted.sort()).toEqual([`users/s2/snapshots/${old(15)[0]}`, `users/s2/snapshots/${old(30)[0]}`].sort());
    expect(snapsOf('s2').map(k => k.slice(-10)).sort()).toEqual([old(14)[0], old(3)[0], old(2)[0], old(1)[0], '2026-10-05'].sort());
    expect(Object.keys(remote.docs['users/s2/meta/snaps'].index).length).toBe(5);
  });

  it('часы устройства врут (год 2031): день и просрочка считаются по серверу, настоящие снимки целы', async () => {
    const { game, C } = await login('s3', baseRest());
    remote.docs['users/s3/meta/snaps'] = { index: { '2026-10-04': { at: T1 - DAY, app: 'x', v: 1, sum: {} } } };
    remote.docs['users/s3/snapshots/2026-10-04'] = { save: '{}' };
    vi.spyOn(Date, 'now').mockReturnValue(Date.UTC(2031, 0, 1));
    game.save.xp = 150; game.save.updatedAt = 2000;
    await C.pushNow();
    await until(() => snapsOf('s3').length > 1);
    expect(snapsOf('s3')).toEqual(['users/s3/snapshots/2026-10-04', 'users/s3/snapshots/2026-10-05']);
    expect(remote.deleted).toEqual([]);
  });

  it('нет серверного времени (нет связи с часами облака) — снимка нет, синхронизация идёт', async () => {
    const { game, C } = await login('s4', baseRest());
    remote.noClock = true;
    game.save.xp = 150; game.save.updatedAt = 2000;
    await C.pushNow(); await tick(); await tick(); await tick();
    expect(C.cloud.status).toBe('ok');
    expect(JSON.parse(remote.docs['users/s4'].save).xp).toBe(150);
    expect(snapsOf('s4')).toEqual([]);
  });

  it('облако записано более новой схемой: только чтение, ни записей, ни снимков', async () => {
    const { C } = await setup();
    remote.docs['users/s5'] = { save: JSON.stringify(baseRest({ version: 2 })), updatedAt: 5, rev: 1, v: 2 };
    remote.authCb!({ uid: 's5', email: 'x', displayName: 'x' });
    await until(() => C.cloud.readOnly);
    expect(C.cloud.readOnly).toBe(true);
    await C.pushNow(); await tick(); await tick();
    expect(snapsOf('s5')).toEqual([]);
    expect(remote.docs['users/s5/meta/snaps']).toBeUndefined();
  });

  it('снимок не записался (сбой связи) — синхронизация не страдает, в следующий раз пробуем снова', async () => {
    const { game, C } = await login('s6', baseRest());
    remote.failTx = p => p.includes('/snapshots/');
    game.save.xp = 150; game.save.updatedAt = 2000;
    await C.pushNow(); await tick(); await tick(); await tick();
    expect(C.cloud.status).toBe('ok');
    expect(snapsOf('s6')).toEqual([]);
  });

  it('испорченный список снимков в облаке (число вместо объекта) не роняет: считается пустым', async () => {
    const { game, C } = await login('s7', baseRest());
    remote.docs['users/s7/meta/snaps'] = { index: 5 };
    expect(await C.loadSnaps()).toBe(true);
    expect(C.cloud.snaps).toEqual({});
    game.save.xp = 150; game.save.updatedAt = 2000;
    await C.pushNow();
    await until(() => snapsOf('s7').length > 0);
    expect(snapsOf('s7')).toEqual(['users/s7/snapshots/2026-10-05']);
  });
});

describe('облако: восстановление из снимка', () => {
  beforeEach(() => { remote.docs = {}; remote.serverMs = T1; remote.noClock = false; remote.failTx = null; remote.deleted = []; vi.restoreAllMocks(); });

  /** Ребёнок продвинулся (xp 300, 3 ответа, PIN нов), в облаке есть снимок за 1 октября (xp 40, монет 5). */
  async function withSnapshot(uid: string, snapExtra: any = {}) {
    const { game, C } = await login(uid, baseRest({ xp: 300, coins: 99, skills: { a: sk(30), b: sk(5) }, settings: { extraMissionCap: 1, extraTo: 'today', planMinutes: 40, pin: NEW_PIN } }), [att(1), att(2), att(3)]);
    const snapRest = baseRest({ xp: 40, coins: 5, skills: { a: sk(2) }, settings: { extraMissionCap: 1, extraTo: 'today', planMinutes: 25, pin: OLD_PIN }, updatedAt: 500 });
    remote.docs[`users/${uid}/snapshots/2026-10-01`] = { save: JSON.stringify(snapRest), at: T1 - 4 * DAY, app: 'old', v: 1, kind: 'day', sum: {}, ...snapExtra };
    remote.docs[`users/${uid}/meta/snaps`] = { index: { '2026-10-01': { at: T1 - 4 * DAY, app: 'old', v: 1, sum: { answers: 2, topics: 1, coins: 5, xp: 40, days: 1 } } } };
    return { game, C };
  }

  it('сравнение «сейчас → в снимке» ничего не меняет', async () => {
    const { game, C } = await withSnapshot('r0');
    const before = fp(game.save);
    const r = await C.inspectSnapshot('2026-10-01');
    expect(r.ok).toBe(true);
    if (r.ok) { expect(r.rollback).toBe(true); expect(r.rows.find(x => x.key === 'xp')).toMatchObject({ now: 300, snap: 40 }); }
    expect(fp(game.save)).toBe(before);
  });

  it('восстановление: сначала копия «до» в облаке, потом замена; ответы целы; PIN остался; облако получило восстановленное', async () => {
    const { game, C } = await withSnapshot('r1');
    const res = await C.restoreSnapshot('2026-10-01');
    expect(res).toEqual({ ok: true, synced: true });
    // копия «до»
    const befores = snapsOf('r1').filter(k => k.includes('before-restore-'));
    expect(befores.length).toBe(1);
    const b = remote.docs[befores[0]];
    expect(b.kind).toBe('before-restore');
    expect(JSON.parse(b.save)).toMatchObject({ xp: 300, coins: 99 });
    expect(JSON.parse(b.save).attempts).toBeUndefined();   // без истории ответов: она не пропадает и так
    expect(Object.keys(remote.docs['users/r1/meta/snaps'].index)).toContain(befores[0].split('/').pop());
    // устройство
    expect(game.save.xp).toBe(40); expect(game.save.coins).toBe(5); expect(game.save.settings.planMinutes).toBe(25);
    expect(game.save.settings.pin).toBe(NEW_PIN);
    expect(game.save.attempts.map(a => a.at)).toEqual([1, 2, 3]);
    // облако: главный документ стал восстановленным, ответы месяцев на месте
    expect(JSON.parse(remote.docs['users/r1'].save)).toMatchObject({ xp: 40, coins: 5 });
    expect(remote.docs['users/r1'].rev).toBeGreaterThan(1);
    expect(JSON.parse(remote.docs['users/r1/attempts/2026-10'].list).map((a: Attempt) => a.at)).toEqual([1, 2, 3]);
  });

  it('восстановление можно откатить: копия «до» восстанавливается тем же путём', async () => {
    const { game, C } = await withSnapshot('r2');
    expect((await C.restoreSnapshot('2026-10-01')).ok).toBe(true);
    expect(game.save.xp).toBe(40);
    const beforeId = snapsOf('r2').find(k => k.includes('before-restore-'))!.split('/').pop()!;
    remote.serverMs = T1 + 60_000;
    expect((await C.restoreSnapshot(beforeId)).ok).toBe(true);
    expect(game.save.xp).toBe(300); expect(game.save.coins).toBe(99);
    expect(game.save.attempts.map(a => a.at)).toEqual([1, 2, 3]);
    expect(JSON.parse(remote.docs['users/r2'].save).xp).toBe(300);
  });

  it('снимок более новой схемы не восстанавливается: ничего не изменено, копии «до» нет', async () => {
    const { game, C } = await withSnapshot('r3', { v: 2 });
    const was = fp(game.save);
    expect(await C.restoreSnapshot('2026-10-01')).toEqual({ ok: false, error: 'newer' });
    expect(fp(game.save)).toBe(was);
    expect(snapsOf('r3').filter(k => k.includes('before-restore-'))).toEqual([]);
    expect(await C.inspectSnapshot('2026-10-01')).toEqual({ ok: false, error: 'newer' });
  });

  it('испорченный снимок (сохранение — число, не JSON, пустой объект) отклоняется без последствий', async () => {
    const { game, C } = await withSnapshot('r4');
    const was = fp(game.save);
    for (const bad of [{ save: 12345 }, { save: '{не json' }, { save: '{}' }, { save: JSON.stringify({ ...baseRest(), skills: 7 }) }, {}, { save: JSON.stringify(baseRest()), v: 'x' }]) {
      remote.docs['users/r4/snapshots/2026-10-01'] = bad;
      const res = await C.restoreSnapshot('2026-10-01');
      expect(res.ok).toBe(false);
      expect(fp(game.save)).toBe(was);
    }
    expect(snapsOf('r4').filter(k => k.includes('before-restore-'))).toEqual([]);
  });

  it('нет такого снимка / чужой id — отказ', async () => {
    const { C } = await withSnapshot('r5');
    expect(await C.restoreSnapshot('2026-09-01')).toEqual({ ok: false, error: 'missing' });
    expect(await C.restoreSnapshot('../users/other')).toEqual({ ok: false, error: 'missing' });
  });

  it('копия «до» не записалась (сбой связи): восстановление не начинается, сохранение не тронуто', async () => {
    const { game, C } = await withSnapshot('r6');
    const was = fp(game.save);
    remote.failTx = p => p.includes('before-restore-');
    expect(await C.restoreSnapshot('2026-10-01')).toEqual({ ok: false, error: 'before-failed' });
    expect(fp(game.save)).toBe(was);
    expect(game.save.xp).toBe(300);
  });

  it('экран закрыли посреди работы: до замены останавливаемся и ничего не меняем', async () => {
    const { game, C } = await withSnapshot('r7');
    const was = fp(game.save);
    let n = 0;
    expect(await C.restoreSnapshot('2026-10-01', () => ++n < 2)).toEqual({ ok: false, error: 'cancelled' });   // закрыли после загрузки облака
    expect(fp(game.save)).toBe(was);
    n = 0;
    const res = await C.restoreSnapshot('2026-10-01', () => ++n < 3);   // закрыли после копии «до»: копия осталась, замены нет
    expect(res).toEqual({ ok: false, error: 'cancelled' });
    expect(fp(game.save)).toBe(was);
    expect(game.save.xp).toBe(300);
  });

  it('две нажатия подряд: вторая отклоняется (busy), замена одна', async () => {
    const { game, C } = await withSnapshot('r8');
    const [a, b] = await Promise.all([C.restoreSnapshot('2026-10-01'), C.restoreSnapshot('2026-10-01')]);
    expect([a.ok, b.ok].sort()).toEqual([false, true]);
    expect((a.ok ? b : a)).toEqual({ ok: false, error: 'busy' });
    expect(game.save.xp).toBe(40);
    expect(snapsOf('r8').filter(k => k.includes('before-restore-')).length).toBe(1);
  });

  it('идёт задание у ребёнка — не заменяем под ним', async () => {
    const { game, C } = await withSnapshot('r9');
    game.screen = { name: 'lesson', skill: 'a' } as any;
    expect(await C.restoreSnapshot('2026-10-01')).toEqual({ ok: false, error: 'task' });
    expect(game.save.xp).toBe(300);
    game.screen = { name: 'hub' };
  });

  it('облако новее приложения: восстановление запрещено', async () => {
    const { C } = await setup();
    remote.docs['users/r10'] = { save: JSON.stringify(baseRest({ version: 2 })), updatedAt: 5, rev: 1, v: 2 };
    remote.docs['users/r10/snapshots/2026-10-01'] = { save: JSON.stringify(baseRest()), v: 1 };
    remote.authCb!({ uid: 'r10', email: 'x', displayName: 'x' });
    await until(() => C.cloud.readOnly);
    expect(await C.restoreSnapshot('2026-10-01')).toEqual({ ok: false, error: 'outdated' });
  });

  it('нет связи с часами облака: восстановление не начинается', async () => {
    const { game, C } = await withSnapshot('r11');
    remote.noClock = true;
    expect(await C.restoreSnapshot('2026-10-01')).toEqual({ ok: false, error: 'offline' });
    expect(game.save.xp).toBe(300);
  });
});

describe('облако: часы сервера без связи', () => {
  it('запись отметки времени зависла (нет сети) — через 10 секунд отказ «нет связи», сохранение не тронуто', async () => {
    remote.docs = {}; remote.serverMs = T1; remote.noClock = false; remote.failTx = null;
    const { game, C } = await login('h1', baseRest({ xp: 300 }));
    remote.docs['users/h1/snapshots/2026-10-01'] = { save: JSON.stringify(baseRest({ xp: 40 })), v: 1 };
    vi.useFakeTimers();
    try {
      remote.hangClock = true;
      const p = C.restoreSnapshot('2026-10-01');
      await vi.advanceTimersByTimeAsync(11_000);
      expect(await p).toMatchObject({ ok: false });
      expect(game.save.xp).toBe(300);
    } finally { remote.hangClock = false; vi.useRealTimers(); }
  });
});
