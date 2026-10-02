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
    // транзакция: чтения и записи сразу в «облако» (одно устройство за раз — гонок в тесте нет)
    runTransaction: async (_db: any, fn: (tx: any) => any) => fn({
      get: async (r: { path: string }) => ({ exists: () => r.path in remote.docs, data: () => remote.docs[r.path] }),
      set: (r: { path: string }, data: any, opts?: { merge?: boolean }) => { remote.sets.push({ path: r.path, data }); remote.docs[r.path] = opts?.merge ? { ...remote.docs[r.path], ...data } : data; },
    }),
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

  // 02.10: устройство, сохранившее что-то до загрузки облака, не должно затирать облако
  it('новый телефон брата: PIN задан (сохранение «новее» облака), но прогресса нет — берётся облако, в облако ничего не пишется', async () => {
    const { game } = await import('../src/lib/store.svelte');
    const { cloud } = await import('../src/lib/cloud.svelte');
    const kid = { ...JSON.parse(JSON.stringify(game.save)), attempts: undefined, xp: 750, diagnosticDone: true, heroName: 'Муртаза', updatedAt: 1_000 };
    remote.docs['users/u3'] = { save: JSON.stringify(kid), updatedAt: 1_000 };
    remote.docs['users/u3/attempts/2026-10'] = { list: JSON.stringify([att(10, '2026-10-01'), att(20, '2026-10-01')]), n: 2 };
    game.save.attempts = []; game.save.xp = 0; game.save.diagnosticDone = false; game.save.updatedAt = 9_999_999;   // только что задан PIN
    remote.authCb!({ uid: 'u3', email: 'bro@x', displayName: 'Bro' });
    for (let i = 0; i < 20 && cloud.status !== 'ok'; i++) await tick();
    expect(game.save.xp).toBe(750);
    expect(game.save.attempts.map(a => a.at)).toEqual([10, 20]);
    expect(remote.sets.filter(x => x.path === 'users/u3')).toEqual([]);   // главное сохранение облака не тронуто
  });

  it('обе стороны с ответами, устройство новее: ответы облака не теряются — в облако уходит объединение', async () => {
    const { game } = await import('../src/lib/store.svelte');
    const { cloud } = await import('../src/lib/cloud.svelte');
    remote.docs['users/u4'] = { save: JSON.stringify({ ...JSON.parse(JSON.stringify(game.save)), attempts: undefined, xp: 5, updatedAt: 100 }), updatedAt: 100 };
    remote.docs['users/u4/attempts/2026-10'] = { list: JSON.stringify([att(1, '2026-10-01'), att(3, '2026-10-01')]), n: 2 };
    game.save.attempts = [att(1, '2026-10-01'), att(2, '2026-10-01')]; game.save.xp = 9; game.save.updatedAt = 200;
    remote.authCb!({ uid: 'u4', email: 'x', displayName: 'X' });
    for (let i = 0; i < 20 && !remote.sets.some(x => x.path === 'users/u4/attempts/2026-10'); i++) await tick();
    await tick();
    expect(cloud.status).toBe('ok');
    expect(game.save.attempts.map(a => a.at)).toEqual([1, 2, 3]);
    expect(JSON.parse(remote.docs['users/u4/attempts/2026-10'].list).map((a: Attempt) => a.at)).toEqual([1, 2, 3]);
    expect(game.save.xp).toBe(9);
  });

  it('облако новее, а на устройстве есть ответы, которых там нет: берётся облако плюс эти ответы, и они уходят в облако', async () => {
    const { game } = await import('../src/lib/store.svelte');
    const { cloud } = await import('../src/lib/cloud.svelte');
    remote.docs['users/u5'] = { save: JSON.stringify({ ...JSON.parse(JSON.stringify(game.save)), attempts: undefined, xp: 40, updatedAt: 900 }), updatedAt: 900 };
    remote.docs['users/u5/attempts/2026-10'] = { list: JSON.stringify([att(5, '2026-10-01')]), n: 1 };
    game.save.attempts = [att(5, '2026-10-01'), att(6, '2026-10-02')]; game.save.updatedAt = 800;
    remote.authCb!({ uid: 'u5', email: 'x', displayName: 'X' });
    for (let i = 0; i < 20 && !remote.sets.some(x => x.path === 'users/u5/attempts/2026-10'); i++) await tick();
    await tick();
    expect(cloud.status).toBe('ok');
    expect(game.save.xp).toBe(40);
    expect(game.save.attempts.map(a => a.at)).toEqual([5, 6]);
    expect(JSON.parse(remote.docs['users/u5/attempts/2026-10'].list).map((a: Attempt) => a.at)).toEqual([5, 6]);
  });

  // 02.10 (S1): телефон брата с копией недельной давности меняет одну настройку — дни, темы, монеты ребёнка в облаке целы
  it('старая копия на другом телефоне меняет настройку: прогресс ребёнка в облаке не откатывается, настройка доходит', async () => {
    const { game } = await import('../src/lib/store.svelte');
    const { cloud, pushNow } = await import('../src/lib/cloud.svelte');
    const old = { ...JSON.parse(JSON.stringify(game.save)), attempts: undefined, usage: undefined, xp: 100, coins: 50, diagnosticDone: true,
      days: { '2026-10-01': { date: '2026-10-01', blocksDone: { warmup: true }, planShare: 0.2, minutesToday: 10, minutesWeekend: 0, extraMissions: 0, bonuses: [] } },
      settings: { ...game.save.settings, voiceInput: true }, updatedAt: 1_000 };
    remote.docs['users/u6'] = { save: JSON.stringify(old), updatedAt: 1_000, rev: 3, v: 1 };
    remote.docs['users/u6/attempts/2026-10'] = { list: JSON.stringify([att(11, '2026-10-01')]), n: 1 };
    game.save.attempts = []; game.save.xp = 0; game.save.diagnosticDone = false; game.save.updatedAt = 0;   // пустой телефон брата
    remote.authCb!({ uid: 'u6', email: 'bro@x', displayName: 'Bro' });
    for (let i = 0; i < 20 && cloud.status !== 'ok'; i++) await tick();
    expect(game.save.xp).toBe(100);
    // неделя прошла: ребёнок на своём телефоне занимался — облако ушло вперёд
    const kid = { ...old, xp: 900, coins: 320, updatedAt: 9_000,
      days: { ...old.days, '2026-10-08': { date: '2026-10-08', blocksDone: { warmup: true, new: true, mixed: true }, planShare: 1, minutesToday: 60, minutesWeekend: 48, extraMissions: 0, bonuses: [] } },
      skills: { 'frac.add': { p: 0.97, status: 'mastered', lessonDone: true, stage: 2, attempts: 40, correct: 37, misconceptions: {} } } };
    remote.docs['users/u6'] = { save: JSON.stringify(kid), updatedAt: 9_000, rev: 9, v: 1 };
    // брат на старой копии выключает голос (копия «новее» по часам)
    game.save.settings = { ...game.save.settings, voiceInput: false }; game.save.updatedAt = 20_000;
    await pushNow();
    const saved = JSON.parse(remote.docs['users/u6'].save);
    expect(saved.xp).toBe(900);
    expect(saved.coins).toBe(320);
    expect(Object.keys(saved.days).sort()).toEqual(['2026-10-01', '2026-10-08']);
    expect(saved.days['2026-10-08'].minutesToday).toBe(60);
    expect(saved.skills['frac.add'].status).toBe('mastered');
    expect(saved.settings.voiceInput).toBe(false);       // изменение брата дошло
    expect(remote.docs['users/u6'].rev).toBe(10);
    expect(game.save.xp).toBe(900);                      // и на телефон брата пришло свежее
  });

  it('облако записано приложением новее этого — только чтение, ничего не пишем', async () => {
    const { game } = await import('../src/lib/store.svelte');
    const { cloud, pushNow } = await import('../src/lib/cloud.svelte');
    remote.docs['users/u7'] = { save: JSON.stringify({ ...JSON.parse(JSON.stringify(game.save)), attempts: undefined, version: 2 }), updatedAt: 5, rev: 1, v: 2 };
    remote.authCb!({ uid: 'u7', email: 'x', displayName: 'X' });
    for (let i = 0; i < 20 && !cloud.readOnly; i++) await tick();
    expect(cloud.readOnly).toBe(true);
    expect(cloud.error).toBe('app/outdated');
    remote.sets = [];
    await pushNow();
    expect(remote.sets).toEqual([]);
  });
});
