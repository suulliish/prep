// Облако: отец входит на своём устройстве — история ответов (users/{uid}/attempts/{месяц}) подтягивается вместе с сохранением,
// чтобы вкладка «Ответы» в Командире показала те же ответы. Firebase подменён заглушкой, сеть не нужна.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Attempt } from '../src/engine/types';

const remote = vi.hoisted(() => ({
  docs: {} as Record<string, any>,        // путь → данные
  authCb: null as null | ((u: any) => void),
  sets: [] as { path: string; data: any }[],
}));

vi.mock('firebase/app', () => ({ initializeApp: () => ({}) }));
vi.mock('firebase/auth', () => ({
  getAuth: () => ({}), GoogleAuthProvider: class {}, signInWithPopup: async () => {}, signInWithRedirect: async () => {}, signOut: async () => {},
  sendSignInLinkToEmail: async () => {}, isSignInWithEmailLink: () => false, signInWithEmailLink: async () => {},
  signInWithEmailAndPassword: async () => {}, createUserWithEmailAndPassword: async () => {}, sendPasswordResetEmail: async () => {},
  onAuthStateChanged: (_a: any, cb: (u: any) => void) => { remote.authCb = cb; },
}));
vi.mock('firebase/firestore', () => {
  const path = (...p: any[]) => p.filter(x => typeof x === 'string').join('/');
  return {
    getFirestore: () => ({}),
    doc: (_db: any, ...p: string[]) => ({ path: p.join('/') }),
    collection: (_db: any, ...p: string[]) => ({ path: p.join('/') }),
    getDoc: async (r: { path: string }) => ({ exists: () => r.path in remote.docs, data: () => remote.docs[r.path] }),
    getDocs: async (c: { path: string }) => {
      const hits = Object.entries(remote.docs).filter(([k]) => k.startsWith(c.path + '/'));
      return { forEach: (f: (d: any) => void) => hits.forEach(([k, v]) => f({ id: k.slice(c.path.length + 1), data: () => v })) };
    },
    setDoc: async () => {},
    writeBatch: () => ({ set: (r: { path: string }, data: any) => { remote.sets.push({ path: r.path, data }); remote.docs[r.path] = data; }, commit: async () => {} }),
    __path: path,
  };
});

const att = (at: number, day: string, extra: Partial<Attempt> = {}): Attempt => ({ at, day, skill: 'a', source: 't', correct: true, hintLevel: 0, honest: true, timeMs: 9000, mode: 'practice', ...extra });
const tick = () => new Promise(r => setTimeout(r, 0));

describe('облако: загрузка истории ответов при входе', () => {
  beforeEach(() => { remote.docs = {}; remote.sets = []; });   // authCb не сбрасываем: startCloud вызывается один раз

  it('новое устройство получает сохранение и ответы из всех месяцев по порядку времени', async () => {
    vi.stubGlobal('addEventListener', () => {});
    vi.stubGlobal('location', { href: 'http://x/', origin: 'http://x', pathname: '/' });
    vi.stubGlobal('document', { visibilityState: 'visible' });
    const { game } = await import('../src/lib/store.svelte');
    const { startCloud, cloud } = await import('../src/lib/cloud.svelte');
    const { attempts: _drop, ...rest } = JSON.parse(JSON.stringify(game.save));
    remote.docs['users/u1'] = { save: JSON.stringify({ ...rest, heroName: 'Муртаза', updatedAt: 5_000 }), updatedAt: 5_000 };
    remote.docs['users/u1/attempts/2026-10'] = { list: JSON.stringify([att(300, '2026-10-01', { correct: false, tag: 'arith' }), att(400, '2026-10-02')]), n: 2 };
    remote.docs['users/u1/attempts/2026-09'] = { list: JSON.stringify([att(100, '2026-09-30'), att(200, '2026-09-30', { hintLevel: 1 })]), n: 2 };
    game.save.attempts = []; game.save.updatedAt = 0;

    startCloud();
    expect(remote.authCb).toBeTypeOf('function');
    remote.authCb!({ uid: 'u1', email: 'dad@x', displayName: 'Dad' });
    for (let i = 0; i < 10 && cloud.status !== 'ok'; i++) await tick();

    expect(cloud.status).toBe('ok');
    expect(game.save.attempts.map(a => a.at)).toEqual([100, 200, 300, 400]);   // оба месяца, по времени
    expect(game.save.attempts.find(a => a.at === 300)?.tag).toBe('arith');      // поля ответа не потерялись (тип ошибки, подсказка…)
    expect(game.save.attempts.find(a => a.at === 200)?.hintLevel).toBe(1);
    expect(game.save.updatedAt).toBe(5_000);
    expect(remote.sets).toEqual([]);                                             // загрузка ничего в облако не писала
  });

  it('если на устройстве копия новее облачной — уходит в облако, ответы месяцев пишутся по документам', async () => {
    const { game } = await import('../src/lib/store.svelte');
    const { cloud } = await import('../src/lib/cloud.svelte');
    remote.docs['users/u2'] = { save: JSON.stringify({ ...JSON.parse(JSON.stringify(game.save)), attempts: undefined }), updatedAt: 1 };
    game.save.attempts = [att(1, '2026-09-30'), att(2, '2026-10-01')]; game.save.updatedAt = 9_000;
    remote.authCb!({ uid: 'u2', email: 'x', displayName: 'X' });
    for (let i = 0; i < 10 && !remote.sets.length; i++) await tick();
    await tick();
    expect(cloud.status).toBe('ok');
    const months = remote.sets.filter(s => s.path.startsWith('users/u2/attempts/')).map(s => s.path).sort();
    expect(months).toEqual(['users/u2/attempts/2026-09', 'users/u2/attempts/2026-10']);
  });
});
