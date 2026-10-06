// PIN командира (K2): хэш с солью, перенос старого формата, лимит попыток, кто может задать PIN, слияние между устройствами.
import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { PIN_ITER, PIN_FREE_TRIES, PIN_LOCK_MS, PIN_LOCK_MAX_MS, PIN_FAIL_DECAY_MS, UNLOCK_MS, GUARD_EMPTY, validPin, isStoredPin, makePin, checkPin, needsUpgrade, newerPin, onPinFail, worseGuard, guardWait, parseGuard, planPinChange, reauthMessage } from '../src/engine/pin';
import { loadGuard, saveGuard, commanderOpen, openCommander, closeCommander } from '../src/lib/pinstate';
import { mergeSave } from '../src/engine/sync';
import type { PinRec, Save } from '../src/engine/types';

const legacy = (pin: string) => createHash('sha256').update('razlom:' + pin).digest('hex');   // как в старом hashPin
const FAST = 1000;   // итераций в тестах, чтобы не ждать (боевое значение проверяется отдельно)

describe('PIN: хэш и проверка', () => {
  it('4 цифры и только они', () => {
    for (const ok of ['0000', '1234', '9999']) expect(validPin(ok)).toBe(true);
    for (const bad of ['', '123', '12345', 'abcd', '12 4', '١٢٣٤', ' 1234']) expect(validPin(bad), bad).toBe(false);
  });
  it('верный PIN проходит, неверный нет; соль разная у одинаковых PIN', async () => {
    const a = await makePin('4821', 1000, FAST), b = await makePin('4821', 1000, FAST);
    expect(await checkPin(a, '4821')).toBe(true);
    for (const w of ['4822', '0000', '482', '48210', '']) expect(await checkPin(a, w), w).toBe(false);
    expect(a.salt).not.toBe(b.salt); expect(a.hash).not.toBe(b.hash);
    expect(a).toMatchObject({ iter: FAST, setAt: 1000 }); expect(a.salt).toMatch(/^[0-9a-f]{32}$/); expect(a.hash).toMatch(/^[0-9a-f]{64}$/);
  });
  it('боевое число итераций не меньше 100 000', async () => {
    expect(PIN_ITER).toBeGreaterThanOrEqual(100_000);
    const r = await makePin('1111');
    expect(r.iter).toBe(PIN_ITER); expect(await checkPin(r, '1111')).toBe(true);
  });
  it('старый формат (SHA-256 строкой) читается, нужен перенос; новый перенос не нужен', async () => {
    const old = legacy('2580');
    expect(await checkPin(old, '2580')).toBe(true); expect(await checkPin(old, '2581')).toBe(false);
    expect(needsUpgrade(old)).toBe(true);
    expect(needsUpgrade(await makePin('2580'))).toBe(false);
    expect(needsUpgrade({ hash: 'x', salt: 'y', iter: 10, setAt: 1 })).toBe(true);   // меньше итераций, чем сейчас
    expect(needsUpgrade(undefined)).toBe(false);
  });
  it('повреждённая запись и отсутствие PIN: вход закрыт, а не открыт', async () => {
    for (const bad of [undefined, '', { hash: 1, salt: 's', iter: 10, setAt: 1 }, { hash: 'h', salt: 5, iter: 10, setAt: 1 }, { hash: 'h', salt: 'aa', iter: 0, setAt: 1 }, { hash: 'h', salt: 'aa', iter: -5, setAt: 1 }] as any[])
      expect(await checkPin(bad, '1234'), JSON.stringify(bad)).toBe(false);
    // не-цифры не проходят, даже если хэш совпал бы (иначе проверка валидности PIN бессмысленна)
    expect(await checkPin(legacy('12a4'), '12a4')).toBe(false); expect(await checkPin(legacy('123'), '123')).toBe(false); expect(await checkPin(legacy('1234'), '١٢٣٤')).toBe(false);
    expect(await checkPin({ hash: 'ab', salt: 'cd', iter: 1e12, setAt: 1 }, '1234')).toBe(false);   // iter больше разумного: отказ, а не зависание
  });
});

describe('PIN: лимит попыток на устройстве', () => {
  it('5 промахов без паузы, шестой и дальше: 60 с, 120 с, 240 с … не больше 15 минут', () => {
    let g = GUARD_EMPTY; const t = 1_000_000, waits: number[] = [];
    for (let k = 1; k <= 12; k++) { g = onPinFail(g, t); waits.push(guardWait(g, t)); }
    // первые PIN_FREE_TRIES - 1 промахов свободны, начиная с пятого пауза
    expect(waits.slice(0, PIN_FREE_TRIES - 1)).toEqual([0, 0, 0, 0]);
    expect(waits[PIN_FREE_TRIES - 1]).toBe(PIN_LOCK_MS);
    expect(waits[PIN_FREE_TRIES]).toBe(PIN_LOCK_MS * 2); expect(waits[PIN_FREE_TRIES + 1]).toBe(PIN_LOCK_MS * 4);
    expect(Math.max(...waits)).toBe(PIN_LOCK_MAX_MS); expect(waits.at(-1)).toBe(PIN_LOCK_MAX_MS);
    expect(PIN_LOCK_MAX_MS).toBe(900_000); expect(PIN_LOCK_MS).toBe(60_000); expect(PIN_FREE_TRIES).toBe(5); expect(UNLOCK_MS).toBe(600_000);   // числа из решения семьи, а не «что в константе»
  });
  it('пауза идёт от времени ввода и кончается сама', () => {
    let g = GUARD_EMPTY; for (let k = 0; k < 5; k++) g = onPinFail(g, 5000);
    expect(guardWait(g, 5000)).toBe(PIN_LOCK_MS); expect(guardWait(g, 5000 + 30_000)).toBe(30_000); expect(guardWait(g, 5000 + PIN_LOCK_MS)).toBe(0);
    expect(guardWait(g, 5000 + 10 * PIN_LOCK_MS)).toBe(0);
  });
  it('после паузы промах снова удваивает её (счётчик не обнуляется временем)', () => {
    let g = GUARD_EMPTY; for (let k = 0; k < 5; k++) g = onPinFail(g, 0);
    g = onPinFail(g, PIN_LOCK_MS + 1); expect(guardWait(g, PIN_LOCK_MS + 1)).toBe(PIN_LOCK_MS * 2);
  });
  it('полчаса без промахов: счёт начинается заново; во время паузы счёт не сбрасывается', () => {
    let g = GUARD_EMPTY; for (let k = 0; k < 4; k++) g = onPinFail(g, 0);
    const later = onPinFail(g, PIN_FAIL_DECAY_MS + 1); expect(later.fails).toBe(1); expect(guardWait(later, PIN_FAIL_DECAY_MS + 1)).toBe(0);
    const locked = onPinFail(g, 1000);   // пятый промах
    expect(onPinFail(locked, 1000 + PIN_FAIL_DECAY_MS - 1).fails).toBe(6);   // меньше получаса с последнего промаха: счёт идёт дальше
    expect(onPinFail(locked, 1000 + PIN_FAIL_DECAY_MS + 1).fails).toBe(1);   // больше: заново
    expect(onPinFail(locked, 5000).fails).toBe(6);   // во время самой паузы счёт не сбрасывается
    expect(worseGuard({ fails: 1, until: 0 }, { fails: 6, until: 5000 })).toEqual({ fails: 6, until: 5000 });
  });
  it('parseGuard: мусор, чужие типы, отрицательное и «заблокировано до конца света» не ломают и не запирают навсегда', () => {
    const now = 10_000;
    for (const raw of [null, '', 'oops', '[]', '{}', '{"fails":"5","until":1}', '{"fails":-3,"until":1}', '{"fails":1}']) expect(parseGuard(raw, now), String(raw)).toEqual(GUARD_EMPTY);
    expect(parseGuard('{"fails":7,"until":99999999999999}', now).until).toBe(now + PIN_LOCK_MAX_MS);
    expect(parseGuard('{"fails":2.9,"until":0}', now)).toEqual({ fails: 2, until: 0 });
  });
});

describe('PIN: кто может задать или сменить', () => {
  it('с облаком — всегда с паролем', () => {
    for (const hasPin of [true, false]) expect(planPinChange({ signedIn: true, hasPin })).toEqual({ ok: true, needPassword: true });
  });
  it('без облака: первый PIN без пароля (временно, пока нет S2), сменить нельзя', () => {
    const first = planPinChange({ signedIn: false, hasPin: false });
    expect(first.ok && !first.needPassword && !!first.note).toBe(true);
    const change = planPinChange({ signedIn: false, hasPin: true });
    expect(change.ok).toBe(false); expect(!change.ok && change.why).toContain('пароль облака');
  });
  it('сообщения об ошибках пароля понятны и не раскрывают лишнего', () => {
    expect(reauthMessage('auth/invalid-credential')).toBe('Неверный пароль облака');
    expect(reauthMessage('auth/wrong-password')).toBe('Неверный пароль облака');
    expect(reauthMessage('auth/too-many-requests')).toContain('подождите');
    expect(reauthMessage('auth/network-request-failed')).toContain('Нет сети');
    expect(reauthMessage('no-user')).toContain('не подключено');
    expect(reauthMessage(undefined)).toBeTruthy(); expect(reauthMessage('auth/xyz')).toContain('auth/xyz');
  });
});

describe('PIN: слияние двух устройств', () => {
  const rec = (setAt: number): PinRec => ({ hash: `a${setAt}`.replace(/[^0-9a-f]/g, 'e'), salt: 'aabb', iter: 1000, setAt });
  it('newerPin: больший setAt; запись побеждает старую строку; пусто — другая сторона', () => {
    expect(newerPin(rec(5), rec(9))).toEqual(rec(9)); expect(newerPin(rec(9), rec(5))).toEqual(rec(9));
    const h64 = 'c'.repeat(64);
    expect(newerPin(h64, rec(1))).toEqual(rec(1)); expect(newerPin(rec(1), h64)).toEqual(rec(1));
    expect(newerPin(h64, h64)).toBe(h64); expect(newerPin(undefined, rec(2))).toEqual(rec(2)); expect(newerPin(rec(2), undefined)).toEqual(rec(2));
    expect(newerPin(undefined, undefined)).toBeUndefined();
  });
  it('newerPin: PIN с паролем облака побеждает PIN без пароля, даже если тот новее (ребёнок не перетянет облако)', () => {
    const strong = rec(10), weak = { ...rec(999), weak: true as const };
    expect(newerPin(strong, weak)).toEqual(strong); expect(newerPin(weak, strong)).toEqual(strong);
    expect(newerPin('oldhash'.padEnd(64, '0'), weak)).toEqual(weak);   // слабая запись всё же лучше старой строки: старая — часть прежней схемы
  });
  it('newerPin: при полном равенстве результат не зависит от порядка сторон; испорченное не побеждает', () => {
    const a = '1'.repeat(64), b = '2'.repeat(64);
    expect(newerPin(a, b)).toBe(newerPin(b, a));
    const r1 = { ...rec(5), hash: 'aa' }, r2 = { ...rec(5), hash: 'bb' }; expect(newerPin(r1, r2)).toEqual(newerPin(r2, r1));
    for (const bad of [{}, 123, true, null, [], { hash: 'x' }, { hash: 'aa', salt: 'bb', iter: 'x', setAt: 1 }, { ...rec(5), setAt: NaN }, { ...rec(5), iter: 1e12 }, 'short']) {
      expect(newerPin(bad, rec(1)), JSON.stringify(bad)).toEqual(rec(1)); expect(newerPin(rec(1), bad)).toEqual(rec(1)); expect(isStoredPin(bad)).toBe(false);
    }
    expect(newerPin({}, 123)).toBeUndefined();
  });
  const save = (pin: Save['settings']['pin'], over: Partial<Save['settings']> = {}, updatedAt = 1): Save => ({
    version: 1, heroName: 'Т', xp: 10, skills: {}, attempts: [], days: {}, diagnosticDone: true, repairShop: [], updatedAt,
    settings: { extraMissionCap: 1, extraTo: 'today', planMinutes: 40, pin, ...over },
  } as Save);
  it('mergeSave: PIN с большим setAt побеждает, даже если настройки другой стороны новее', () => {
    const local = save(rec(100), {}, 1), remote = save(rec(50), { extraMissionCap: 0 }, 999);
    const m = mergeSave(null, local, remote);
    expect(m.settings.pin).toEqual(rec(100));
    expect(m.settings.extraMissionCap).toBe(0);   // остальные настройки по прежним правилам
  });
  it('mergeSave: новый PIN с одного устройства доезжает на другое, где был старый формат', () => {
    const old = 'a'.repeat(64);
    expect(mergeSave(null, save(old), save(rec(7))).settings.pin).toEqual(rec(7));
    expect(mergeSave(null, save(rec(7)), save(old)).settings.pin).toEqual(rec(7));
  });
  it('mergeSave: без PIN нигде PIN не появляется', () => {
    expect('pin' in mergeSave(null, save(undefined), save(undefined)).settings && mergeSave(null, save(undefined), save(undefined)).settings.pin !== undefined).toBe(false);
  });
});

describe('PIN: в коде нет старых лазеек', () => {
  const read = (f: string) => readFileSync(new URL(`../src/${f}`, import.meta.url), 'utf8');
  it('«Сменить PIN» не стирает PIN, PIN не хэшируется без соли, первый открывший PIN не задаёт без плана', () => {
    const all = ['screens/Commander.svelte', 'screens/commander/Settings.svelte', 'screens/commander/PinGate.svelte', 'lib/store.svelte.ts'].map(read).join('\n');
    expect(all).not.toMatch(/settings\.pin\s*=\s*undefined/);
    expect(all).not.toContain('hashPin');
    expect(all).not.toContain("'razlom:'");
    expect(read('screens/commander/PinGate.svelte')).toContain('planPinChange');
    expect(read('screens/commander/PinGate.svelte')).toContain('C!.reauth');
  });
  it('стрелка «назад» закрывает командира, а PIN-хэш не пишется в журнал и аналитику', () => {
    expect(read('screens/Commander.svelte')).toMatch(/closeCommander\(\);\s*go\(\{ name: 'hub' \}\)/);
    for (const f of readdirSync(new URL('../src/engine/', import.meta.url))) if (f !== 'pin.ts' && f !== 'types.ts' && f !== 'sync.ts' && f !== 'snapshots.ts') expect(read('engine/' + f), f).not.toMatch(/settings\.pin|\.pin\b.*hash/);
  });
});

describe('PIN: состояние устройства (окно и счётчик)', () => {
  it('окно «открыт»: 10 минут, закрывается сразу, продлевается', () => {
    closeCommander(); expect(commanderOpen(1000)).toBe(false);
    openCommander(1000); expect(commanderOpen(1000 + UNLOCK_MS - 1)).toBe(true); expect(commanderOpen(1000 + UNLOCK_MS)).toBe(false);
    openCommander(5000); expect(commanderOpen(5000 + UNLOCK_MS - 1)).toBe(true);   // продление
    closeCommander(); expect(commanderOpen(5001)).toBe(false);
  });
  it('счётчик без хранилища (бросает) живёт в памяти; чистка хранилища паузу не снимает', () => {
    const real = (globalThis as any).localStorage;
    try {
      const store: Record<string, string> = {};
      (globalThis as any).localStorage = { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => { store[k] = v; }, removeItem: (k: string) => { delete store[k]; } };
      let g = GUARD_EMPTY; const t = 50_000; for (let k = 0; k < 5; k++) g = onPinFail(g, t);
      saveGuard(g); expect(guardWait(loadGuard(t), t)).toBe(PIN_LOCK_MS);
      for (const k of Object.keys(store)) delete store[k];   // ребёнок очистил хранилище
      expect(guardWait(loadGuard(t), t)).toBe(PIN_LOCK_MS);
      (globalThis as any).localStorage = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('QuotaExceededError'); }, removeItem: () => { throw new Error('denied'); } };
      expect(guardWait(loadGuard(t), t)).toBe(PIN_LOCK_MS);   // хранилище недоступно вовсе
      saveGuard(GUARD_EMPTY); expect(guardWait(loadGuard(t), t)).toBe(0);   // верный ввод снимает
    } finally { (globalThis as any).localStorage = real; saveGuard(GUARD_EMPTY); }
  });
});

describe('PIN: импорт сохранения без PIN не стирает PIN устройства', () => {
  it('replaceSave оставляет текущий PIN, если в файле его нет или он испорчен', () => {
    const src = readFileSync(new URL('../src/lib/store.svelte.ts', import.meta.url), 'utf8');
    expect(src).toContain('keepPin'); expect(src).toMatch(/isStoredPin\(game\.save\.settings\?\.pin\)\s*&&\s*isStoredPin\(keepPin\)/);
  });
  it('в PinGate нет повторного входа во время проверки и записи после ухода с экрана', () => {
    const g = readFileSync(new URL('../src/screens/commander/PinGate.svelte', import.meta.url), 'utf8');
    expect(g.match(/if \(busy\) return;/g)?.length).toBe(2);   // enter и save
    expect(g).toContain('if (!alive) return;'); expect(g).toContain('if (alive) done();');
    expect(g.indexOf('saveGuard(onPinFail(g, Date.now()))')).toBeGreaterThan(0);
    expect(g.indexOf('saveGuard(onPinFail(g, Date.now()))')).toBeLessThan(g.indexOf('await checkPin(stored, pin)'));   // попытка считается ДО проверки
  });
});
