// Офлайн-кэш с версией (S7): настоящий scripts/sw.template.js, собранный так же, как при сборке сайта, запускается с подменёнными
// self / caches / fetch. Проверяем: старые кэши чистятся, голос под хэшем, Range, страница без сети, чужое не трогаем.
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
// @ts-ignore — сборщик на JS
import { makeSw, mediaMap } from '../scripts/swbuild.mjs';

const TPL = readFileSync(new URL('../scripts/sw.template.js', import.meta.url), 'utf8');
const SCOPE = 'https://suulliish.github.io/prep/';
const bytes = (n: number) => new Uint8Array(Array.from({ length: n }, (_, i) => i % 251));

/** Подмена Cache API: кэши по имени, ключ — полный адрес (как в браузере, запрос GET). */
function fakeCaches() {
  const stores = new Map<string, Map<string, Response>>();
  const mk = (name: string) => {
    const s = stores.get(name)!;
    const urlOf = (r: Request | string) => (typeof r === 'string' ? new URL(r, SCOPE).href : r.url);
    return {
      match: async (r: Request | string) => s.get(urlOf(r))?.clone(),
      put: async (r: Request | string, res: Response) => { if (res.status === 206) throw new TypeError('206 не кэшируется'); s.set(urlOf(r), res); },
      delete: async (r: Request | string) => s.delete(urlOf(r)),
      keys: async () => [...s.keys()].map(u => new Request(u)),
    };
  };
  return {
    stores,
    open: async (name: string) => { if (!stores.has(name)) stores.set(name, new Map()); return mk(name); },
    keys: async () => [...stores.keys()],
    delete: async (name: string) => stores.delete(name),
    match: async (r: Request | string, opts?: { cacheName?: string }) => {
      if (opts?.cacheName) return stores.has(opts.cacheName) ? mk(opts.cacheName).match(r) : undefined;   // как в браузере: кэш не создаётся
      for (const n of stores.keys()) { const h = await mk(n).match(r); if (h) return h; } return undefined;
    },
  };
}

type Worker = { handlers: Record<string, (e: any) => void>; caches: ReturnType<typeof fakeCaches>; fetched: Request[]; skipped: boolean; claimed: boolean; net: { online: boolean; files: Record<string, Response | (() => Response)> } };

/** Запустить собранный service worker версии build с картой хэшей map поверх общих кэшей caches. */
function boot(build: string, map: Record<string, string>, caches = fakeCaches(), net: Worker['net'] = { online: true, files: {} }, assets: string[] = []): Worker {
  const w: Worker = { handlers: {}, caches, fetched: [], skipped: false, claimed: false, net };
  const fetchFn = async (r: Request | string) => {
    const req = typeof r === 'string' ? new Request(r) : r;
    w.fetched.push(req);
    if (!net.online) throw new TypeError('нет сети');
    const f = net.files[new URL(req.url).pathname];
    if (!f) return new Response('нет', { status: 404 });
    const res = typeof f === 'function' ? f() : f.clone();
    Object.defineProperty(res, 'type', { value: 'basic' });   // ответ того же сайта
    // как в браузере: страница начинает читать тело сразу после respondWith, и позже клонировать нельзя («body already used»).
    // Клон, взятый синхронно при возврате ответа, проходит; клон внутри .then() после caches.open, как было в первой версии S7, падает.
    const realClone = res.clone.bind(res); let used = false;
    Promise.resolve().then(() => {}).then(() => { used = true; });
    (res as any).clone = () => { if (used) throw new TypeError('Response body is already used'); return realClone(); };
    return res;
  };
  const self = { registration: { scope: SCOPE }, addEventListener: (t: string, f: any) => { w.handlers[t] = f; }, skipWaiting: () => { w.skipped = true; }, clients: { claim: async () => { w.claimed = true; } } };
  new Function('self', 'caches', 'fetch', 'location', makeSw(TPL, build, map, assets))(self, caches, fetchFn, new URL(SCOPE + 'sw.js'));
  return w;
}
const activate = async (w: Worker) => { const ps: Promise<unknown>[] = []; w.handlers.activate({ waitUntil: (p: Promise<unknown>) => ps.push(p) }); await Promise.all(ps); };
/** Прогнать запрос через fetch-обработчик: undefined — worker запрос не берёт (браузер идёт в сеть сам). */
async function ask(w: Worker, url: string, init: RequestInit & { mode?: RequestMode } = {}) {
  // в Node нельзя создать Request с mode 'navigate' — для страницы подставляем похожий объект
  const req: any = init.mode === 'navigate' ? { url, method: 'GET', mode: 'navigate', headers: new Headers() } : new Request(url, init);
  let out: Promise<Response> | undefined; const waits: Promise<unknown>[] = [];
  w.handlers.fetch({ request: req, respondWith: (p: Promise<Response>) => { out = p; }, waitUntil: (p: Promise<unknown>) => waits.push(p) });
  const res = out ? await out : undefined;
  await Promise.all(waits);
  return res;
}
const ok = (body: BodyInit, type = 'audio/mpeg') => new Response(body, { status: 200, headers: { 'Content-Type': type } });

describe('сборка service worker', () => {
  it('хэши по содержимому файлов, скрытые файлы пропускаются, другие папки не берутся', () => {
    const d = mkdtempSync(join(tmpdir(), 'sw-'));
    try {
      mkdirSync(join(d, 'voice/react'), { recursive: true }); mkdirSync(join(d, 'models')); mkdirSync(join(d, 'other'));
      writeFileSync(join(d, 'voice/react/a.mp3'), 'AAA'); writeFileSync(join(d, 'voice/b.mp3'), 'BBB'); writeFileSync(join(d, 'voice/.DS_Store'), 'x'); writeFileSync(join(d, 'models/m.glb'), 'M'); writeFileSync(join(d, 'other/x.txt'), 'x'); writeFileSync(join(d, 'icon.png'), 'i');
      const m1 = mediaMap(d) as Record<string, string>;
      expect(Object.keys(m1).sort()).toEqual(['models/m.glb', 'voice/b.mp3', 'voice/react/a.mp3']);
      expect(m1['voice/b.mp3']).toMatch(/^[0-9a-f]{8}$/);
      expect(m1['voice/b.mp3']).not.toBe(m1['voice/react/a.mp3']);
      writeFileSync(join(d, 'voice/b.mp3'), 'BBB2');   // файл изменился — хэш другой
      expect((mediaMap(d) as Record<string, string>)['voice/b.mp3']).not.toBe(m1['voice/b.mp3']);
      expect((mediaMap(d) as Record<string, string>)['models/m.glb']).toBe(m1['models/m.glb']);
    } finally { rmSync(d, { recursive: true, force: true }); }
  });
  it('версия и хэши попадают в sw.js; шаблон без мест подстановки — ошибка сборки; настоящий шаблон разбирается как код', () => {
    const js = makeSw(TPL, '0.1.0+abc1234.20261005', { 'voice/a.mp3': 'deadbeef' });
    expect(js).toContain('"0.1.0+abc1234.20261005"'); expect(js).toContain('"voice/a.mp3":"deadbeef"'); expect(js).not.toContain('__BUILD__');
    expect(() => new Function('self', 'caches', 'fetch', 'location', js)).not.toThrow();
    expect(() => makeSw('const x = 1;', 'v', {})).toThrow(/подстановки/);
  });
  it('в проекте public/sw.js больше нет (иначе он затёр бы собранный)', async () => {
    const { existsSync } = await import('node:fs');
    expect(existsSync(new URL('../public/sw.js', import.meta.url))).toBe(false);
  });
});

describe('очистка старых кэшей при новой версии', () => {
  let caches: ReturnType<typeof fakeCaches>;
  beforeEach(() => { caches = fakeCaches(); });

  it('установка сразу включает новую версию', async () => {
    const w = boot('B1', {}, caches);
    w.handlers.install({}); await activate(w);
    expect(w.skipped).toBe(true); expect(w.claimed).toBe(true);
  });

  it('держим текущую и предыдущую сборку, третья версия удаляет самую старую; чужие кэши и кэш голоса не трогаются', async () => {
    await (await caches.open('other-app-v1')).put(SCOPE + 'x', ok('чужое'));
    for (const b of ['B1', 'B2', 'B3', 'B4']) { const w = boot(b, {}, caches); await activate(w); await (await caches.open('zharyq-shell-' + b)).put(SCOPE + b, ok(b)); }   // страница версии успела закэшироваться
    expect([...caches.stores.keys()].sort()).toEqual(['other-app-v1', 'zharyq-media', 'zharyq-meta', 'zharyq-shell-B3', 'zharyq-shell-B4']);
    expect(caches.stores.has('zharyq-shell-B1')).toBe(false); expect(caches.stores.has('zharyq-shell-B2')).toBe(false);
    expect(caches.stores.has('other-app-v1')).toBe(true);
  });

  it('прежний кэш zharyq-v1 доживает одну смену версии (открытая страница может ещё просить из него), потом удаляется', async () => {
    const old = await caches.open('zharyq-v1'); await old.put(SCOPE + 'assets/old.js', ok('js', 'text/javascript'));
    const w1 = boot('B1', {}, caches); await activate(w1);
    expect(caches.stores.has('zharyq-v1')).toBe(true);
    expect(await ask(w1, SCOPE + 'assets/old.js').then(r => r?.text())).toBe('js');   // отдаётся из старого кэша
    const w2 = boot('B2', {}, caches); await activate(w2);
    expect(caches.stores.has('zharyq-v1')).toBe(false);
  });

  it('голос: файл с прежним хэшем остаётся, изменённый и исчезнувший удаляются, чужие записи в кэше голоса тоже', async () => {
    const m = await caches.open('zharyq-media');
    await m.put(SCOPE + 'voice/same.mp3?h=aaaa1111', ok('s')); await m.put(SCOPE + 'voice/changed.mp3?h=old00000', ok('c'));
    await m.put(SCOPE + 'voice/gone.mp3?h=bbbb2222', ok('g')); await m.put(SCOPE + 'voice/nohash.mp3', ok('n')); await m.put('https://evil.example/voice/same.mp3?h=aaaa1111', ok('e'));
    const w = boot('B2', { 'voice/same.mp3': 'aaaa1111', 'voice/changed.mp3': 'new11111' }, caches);
    await activate(w);
    expect([...caches.stores.get('zharyq-media')!.keys()]).toEqual([SCOPE + 'voice/same.mp3?h=aaaa1111']);
  });

  it('чистка не удалась — приложение всё равно подхватывается', async () => {
    const bad = { ...caches, keys: async () => { throw new Error('сбой'); } };
    const w = boot('B1', {}, bad as any); await activate(w);
    expect(w.claimed).toBe(true);
  });
});

describe('голос и модели', () => {
  const MAP = { 'voice/react/a.mp3': 'h1h1h1h1', 'models/m.glb': 'm2m2m2m2' };
  const FILE = bytes(1000);
  let w: Worker;
  beforeEach(async () => {
    w = boot('B1', MAP, fakeCaches(), { online: true, files: { '/prep/voice/react/a.mp3': () => ok(FILE), '/prep/models/m.glb': () => ok(bytes(50), 'model/gltf-binary'), '/prep/voice/new.mp3': () => ok('x') } });
    await activate(w);
  });

  it('первый запрос — из сети и в кэш под хэшем; второй — из кэша, сеть не нужна', async () => {
    const r1 = await ask(w, SCOPE + 'voice/react/a.mp3');
    expect(r1!.status).toBe(200); expect((await r1!.arrayBuffer()).byteLength).toBe(1000);
    expect([...w.caches.stores.get('zharyq-media')!.keys()]).toEqual([SCOPE + 'voice/react/a.mp3?h=h1h1h1h1']);
    w.net.online = false; w.fetched.length = 0;
    const r2 = await ask(w, SCOPE + 'voice/react/a.mp3');
    expect(r2!.status).toBe(200); expect(w.fetched.length).toBe(0);
  });

  it('аудио-элемент просит Range: в сеть уходит запрос целиком, в кэш — целый файл, ответ — правильный кусок 206', async () => {
    const r = await ask(w, SCOPE + 'voice/react/a.mp3', { headers: { Range: 'bytes=10-19' } });
    expect(w.fetched.at(-1)!.headers.get('range')).toBeNull();
    expect(r!.status).toBe(206); expect(r!.headers.get('Content-Range')).toBe('bytes 10-19/1000'); expect(r!.headers.get('Content-Type')).toBe('audio/mpeg');
    expect([...new Uint8Array(await r!.arrayBuffer())]).toEqual([...FILE.slice(10, 20)]);
    expect((await w.caches.stores.get('zharyq-media')!.get(SCOPE + 'voice/react/a.mp3?h=h1h1h1h1')!.clone().arrayBuffer()).byteLength).toBe(1000);
    // из кэша, без сети: открытый конец, хвост, мимо файла
    w.net.online = false;
    const open = await ask(w, SCOPE + 'voice/react/a.mp3', { headers: { Range: 'bytes=990-' } });
    expect(open!.headers.get('Content-Range')).toBe('bytes 990-999/1000');
    const tail = await ask(w, SCOPE + 'voice/react/a.mp3', { headers: { Range: 'bytes=-5' } });
    expect(tail!.headers.get('Content-Range')).toBe('bytes 995-999/1000');
    const past = await ask(w, SCOPE + 'voice/react/a.mp3', { headers: { Range: 'bytes=5000-6000' } });
    expect(past!.status).toBe(416);
    const zero = await ask(w, SCOPE + 'voice/react/a.mp3', { headers: { Range: 'bytes=0-' } });
    expect(zero!.status).toBe(206); expect((await zero!.arrayBuffer()).byteLength).toBe(1000);
  });

  it('не 200 (ошибка сервера, 404) в кэш не кладётся', async () => {
    w.net.files['/prep/voice/react/a.mp3'] = () => new Response('ошибка', { status: 500 });
    const r = await ask(w, SCOPE + 'voice/react/a.mp3');
    expect(r!.status).toBe(500);
    expect(w.caches.stores.get('zharyq-media')!.size).toBe(0);
  });

  it('файла нет в списке сборки — worker его не берёт и в кэш голоса он не попадает (размер ограничен списком)', async () => {
    expect(await ask(w, SCOPE + 'voice/new.mp3')).toBeUndefined();
    expect(w.caches.stores.get('zharyq-media')!.size).toBe(0);
  });

  it('файл изменился в новой версии: старая копия не отдаётся, качается новая под новым хэшем, старая уходит при активации', async () => {
    await ask(w, SCOPE + 'models/m.glb');
    const w2 = boot('B2', { ...MAP, 'models/m.glb': 'newhash0' }, w.caches, w.net);
    await activate(w2);
    expect([...w.caches.stores.get('zharyq-media')!.keys()]).toEqual([]);
    w.net.files['/prep/models/m.glb'] = () => ok(bytes(77), 'model/gltf-binary');
    const r = await ask(w2, SCOPE + 'models/m.glb');
    expect((await r!.arrayBuffer()).byteLength).toBe(77);
    expect([...w.caches.stores.get('zharyq-media')!.keys()]).toEqual([SCOPE + 'models/m.glb?h=newhash0']);
  });
});

describe('страница, файлы сборки, остальное', () => {
  let w: Worker;
  beforeEach(async () => {
    w = boot('B1', {}, fakeCaches(), { online: true, files: { '/prep/': () => ok('<html>v1', 'text/html'), '/prep/assets/app-1.js': () => ok('js', 'text/javascript'), '/prep/manifest.webmanifest': () => ok('{}', 'application/manifest+json') } });
    await activate(w);
  });

  it('страница: сначала сеть и копия в кэш текущей сборки; без сети — копия, а для незнакомого адреса — корень сайта', async () => {
    const r = await ask(w, SCOPE, { mode: 'navigate' });
    expect(await r!.text()).toBe('<html>v1');
    expect(w.caches.stores.get('zharyq-shell-B1')!.has(SCOPE)).toBe(true);
    w.net.online = false;
    expect(await (await ask(w, SCOPE, { mode: 'navigate' }))!.text()).toBe('<html>v1');
    expect(await (await ask(w, SCOPE + 'index.html?x=1', { mode: 'navigate' }))!.text()).toBe('<html>v1');
  });

  it('страница обновилась в сети — отдаётся свежая, а не копия', async () => {
    await ask(w, SCOPE, { mode: 'navigate' });
    w.net.files['/prep/'] = () => ok('<html>v2', 'text/html');
    expect(await (await ask(w, SCOPE, { mode: 'navigate' }))!.text()).toBe('<html>v2');
  });

  it('файлы сборки: первый раз из сети, дальше из кэша без сети; плохой ответ не кэшируется', async () => {
    expect(await (await ask(w, SCOPE + 'assets/app-1.js'))!.text()).toBe('js');
    w.net.online = false; w.fetched.length = 0;
    expect(await (await ask(w, SCOPE + 'assets/app-1.js'))!.text()).toBe('js'); expect(w.fetched.length).toBe(0);
    w.net.online = true;
    expect((await ask(w, SCOPE + 'assets/missing.js'))!.status).toBe(404);
    expect(w.caches.stores.get('zharyq-shell-B1')!.has(SCOPE + 'assets/missing.js')).toBe(false);
  });

  it('куски предыдущей сборки доступны, пока она не удалена (открытая страница просит свой кусок)', async () => {
    const w2 = boot('B2', {}, w.caches, w.net);
    await ask(w, SCOPE + 'assets/app-1.js'); await activate(w2);
    w.net.online = false;
    expect(await (await ask(w2, SCOPE + 'assets/app-1.js'))!.text()).toBe('js');
  });

  it('манифест и значки: сначала сеть (свежее), без сети — копия', async () => {
    w.net.files['/prep/manifest.webmanifest'] = () => ok('{"a":1}', 'application/manifest+json');
    expect(await (await ask(w, SCOPE + 'manifest.webmanifest'))!.text()).toBe('{"a":1}');
    w.net.online = false;
    expect(await (await ask(w, SCOPE + 'manifest.webmanifest'))!.text()).toBe('{"a":1}');
  });

  it('не берём: не GET, чужой домен (Firebase), сам sw.js, version.json, адреса вне папки сайта', async () => {
    expect(await ask(w, SCOPE + 'assets/app-1.js', { method: 'POST' })).toBeUndefined();
    expect(await ask(w, 'https://firestore.googleapis.com/v1/x')).toBeUndefined();
    expect(await ask(w, SCOPE + 'sw.js')).toBeUndefined();
    expect(await ask(w, SCOPE + 'version.json')).toBeUndefined();
    expect(await ask(w, 'https://suulliish.github.io/other-app/a.js')).toBeUndefined();
  });
});

describe('кэш страницы и переезд файлов между версиями (S7, замечания проверки)', () => {
  const html = () => ok('<html>страница</html>', 'text/html');
  const text = async (w: Worker, url: string, init: any = {}) => (await ask(w, url, init))?.text();

  it('онлайн-открытие кладёт страницу и файлы сборки в кэш, без сети они открываются', async () => {
    const caches = fakeCaches(), net: Worker['net'] = { online: true, files: { '/prep/': html, '/prep/assets/a.js': () => ok('js', 'text/javascript') } };
    const w = boot('B1', {}, caches, net); await activate(w);
    expect(await text(w, SCOPE, { mode: 'navigate' })).toContain('страница');
    expect(await text(w, SCOPE + 'assets/a.js')).toBe('js');
    expect((await (await caches.open('zharyq-shell-B1')).keys()).length).toBe(2);   // раньше здесь было 0: клон падал, кэш пустой
    net.online = false;
    expect(await text(w, SCOPE, { mode: 'navigate' })).toContain('страница');
    expect(await text(w, SCOPE + 'assets/a.js')).toBe('js');
  });

  it('неизменённый файл из кэша старой сборки переезжает в кэш новой и не пропадает через несколько версий', async () => {
    const caches = fakeCaches(), net: Worker['net'] = { online: true, files: { '/prep/assets/app.css': () => ok('css', 'text/css'), '/prep/': html } };
    const w1 = boot('B1', {}, caches, net); await activate(w1);
    await ask(w1, SCOPE + 'assets/app.css'); await ask(w1, SCOPE, { mode: 'navigate' });
    net.online = false;
    for (const b of ['B2', 'B3', 'B4', 'B5']) {
      const w = boot(b, {}, caches, net, ['assets/app.css']); await activate(w);
      expect(await text(w, SCOPE + 'assets/app.css'), `${b}: файл из прежних сборок`).toBe('css');   // при каждой смене копируется вперёд
    }
    expect([...caches.stores.keys()].filter(k => k.startsWith('zharyq-shell-')).sort()).toEqual(['zharyq-shell-B4', 'zharyq-shell-B5']);
  });

  it('голос из прежнего кэша zharyq-v1 переезжает под хэш и играет без сети', async () => {
    const caches = fakeCaches(); const old = await caches.open('zharyq-v1'); await old.put(SCOPE + 'voice/a.mp3', ok(bytes(40)));
    const net: Worker['net'] = { online: false, files: {} };
    const w = boot('B1', { 'voice/a.mp3': 'deadbeef' }, caches, net); await activate(w);
    const r = await ask(w, SCOPE + 'voice/a.mp3', { headers: { Range: 'bytes=0-9' } });
    expect(r?.status).toBe(206); expect(new Uint8Array(await r!.arrayBuffer())).toEqual(bytes(40).slice(0, 10));
    expect([...caches.stores.get('zharyq-media')!.keys()]).toEqual([SCOPE + 'voice/a.mp3?h=deadbeef']);
  });

  it('если кэша zharyq-v1 нет, его не создают пустым', async () => {
    const caches = fakeCaches(), net: Worker['net'] = { online: true, files: { '/prep/voice/a.mp3': () => ok(bytes(20)) } };
    const w = boot('B1', { 'voice/a.mp3': 'cafe0001' }, caches, net); await activate(w);
    await ask(w, SCOPE + 'voice/a.mp3');
    expect(caches.stores.has('zharyq-v1')).toBe(false);
  });

  it('прежняя версия шаблона (клон внутри .then) этот тест не проходила бы', async () => {
    // мутация: возвращаем клон внутрь .then, как было в первой версии S7
    const buggy = TPL.replace("const copy = res.clone(); e.waitUntil(caches.open(SHELL).then(k => k.put(req, copy)).catch(() => {}));", "e.waitUntil(caches.open(SHELL).then(k => k.put(req, res.clone())).catch(() => {}));");
    expect(buggy).not.toBe(TPL);
    const caches = fakeCaches(), net: Worker['net'] = { online: true, files: { '/prep/': html } };
    const w = (() => { const x = boot('B1', {}, caches, net); return x; })();
    // boot использует настоящий шаблон; собираем worker из мутированного вручную
    const w2: any = { handlers: {} };
    const self = { registration: { scope: SCOPE }, addEventListener: (t: string, f: any) => { w2.handlers[t] = f; }, skipWaiting: () => {}, clients: { claim: async () => {} } };
    const fetchFn = async (r: any) => { const res = html(); Object.defineProperty(res, 'type', { value: 'basic' }); const rc = res.clone.bind(res); let used = false; Promise.resolve().then(() => {}).then(() => { used = true; }); (res as any).clone = () => { if (used) throw new TypeError('Response body is already used'); return rc(); }; return res; };
    const c2 = fakeCaches();
    new Function('self', 'caches', 'fetch', 'location', makeSw(buggy, 'B1', {}))(self, c2, fetchFn, new URL(SCOPE + 'sw.js'));
    let out: any; const waits: Promise<unknown>[] = [];
    w2.handlers.fetch({ request: { url: SCOPE, method: 'GET', mode: 'navigate', headers: new Headers() }, respondWith: (p: any) => { out = p; }, waitUntil: (p: any) => waits.push(p) });
    await out; await Promise.all(waits);
    expect((await (await c2.open('zharyq-shell-B1')).keys()).length).toBe(0);   // с ошибкой кэш пуст: значит, настоящий тест выше действительно ловит её
    void w;
  });

  it('при активации новой версии нужное переезжает из старых кэшей само, не дожидаясь запроса (голос из zharyq-v1, файлы сборки из старого shell)', async () => {
    const caches = fakeCaches(), net: Worker['net'] = { online: true, files: { '/prep/assets/f.woff': () => ok('font', 'font/woff'), '/prep/': html } };
    const legacy = await caches.open('zharyq-v1'); await legacy.put(SCOPE + 'voice/a.mp3', ok(bytes(30))); await legacy.put(SCOPE + 'voice/b.mp3', ok(bytes(31)));
    const w1 = boot('B1', { 'voice/a.mp3': 'aaaa0001', 'voice/b.mp3': 'bbbb0002' }, caches, net); await activate(w1);
    await ask(w1, SCOPE + 'assets/f.woff'); await ask(w1, SCOPE, { mode: 'navigate' });
    // три смены версии без единого запроса к голосу и шрифту
    for (const b of ['B2', 'B3']) { const w = boot(b, { 'voice/a.mp3': 'aaaa0001', 'voice/b.mp3': 'bbbb0002' }, caches, net, ['assets/f.woff']); await activate(w); }
    expect(caches.stores.has('zharyq-v1')).toBe(false);
    net.online = false;
    const w4 = boot('B3', { 'voice/a.mp3': 'aaaa0001', 'voice/b.mp3': 'bbbb0002' }, caches, net);
    expect(await text(w4, SCOPE + 'assets/f.woff')).toBe('font');
    expect((await ask(w4, SCOPE + 'voice/a.mp3'))?.status).toBe(200); expect((await ask(w4, SCOPE + 'voice/b.mp3'))?.status).toBe(200);
  });

  it('старую страницу (index.html) в новую сборку не переносим: она ссылается на файлы старой сборки', async () => {
    const caches = fakeCaches(), net: Worker['net'] = { online: true, files: { '/prep/': html } };
    const w1 = boot('B1', {}, caches, net); await activate(w1); await ask(w1, SCOPE, { mode: 'navigate' });
    const w2 = boot('B2', {}, caches, net); await activate(w2);
    expect((await (await caches.open('zharyq-shell-B2')).keys()).length).toBe(0);
  });

  it('мёртвые куски старых сборок (их нет в списке assets новой) в новый кэш не копятся', async () => {
    const caches = fakeCaches(), net: Worker['net'] = { online: true, files: { '/prep/assets/old-AAA.js': () => ok('old', 'text/javascript'), '/prep/assets/keep.css': () => ok('css', 'text/css'), '/prep/assets/new-BBB.js': () => ok('new', 'text/javascript') } };
    const w1 = boot('B1', {}, caches, net, ['assets/old-AAA.js', 'assets/keep.css']); await activate(w1);
    await ask(w1, SCOPE + 'assets/old-AAA.js'); await ask(w1, SCOPE + 'assets/keep.css');
    const w2 = boot('B2', {}, caches, net, ['assets/new-BBB.js', 'assets/keep.css']); await activate(w2);   // old-AAA.js в новой сборке нет
    const keys = (await (await caches.open('zharyq-shell-B2')).keys()).map(r => new URL(r.url).pathname);
    expect(keys).toEqual(['/prep/assets/keep.css']);
  });
  it('makeSw подставляет список assets; шаблон без места подстановки — ошибка сборки', () => {
    const js = makeSw(TPL, 'v', {}, ['assets/a.js', 'assets/b.css']);
    expect(js).toContain('["assets/a.js","assets/b.css"]');
    expect(() => makeSw(TPL.replace('/*@assets*/', '/*x*/'), 'v', {})).toThrow(/подстановки/);
  });
});
