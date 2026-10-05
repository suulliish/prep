// Офлайн-кэш «Жарық» (S7, docs/CLOUD.md → «Офлайн-кэш»). Это ШАБЛОН: при сборке (vite.config.ts → scripts/swbuild.mjs) в него
// подставляются версия сборки и хэши файлов голоса/моделей, получается dist/sw.js. Тест: tests/sw_cache.test.ts.
//
// Три кэша (все имена начинаются с «zharyq», чужие кэши на этом домене не трогаем):
// - zharyq-shell-<сборка>   — страница и файлы сборки (хэш в имени файла). Каждая версия — свой кэш; остаются текущий и предыдущий
//                              (открытая страница ещё просит куски старой сборки), остальные удаляются при активации новой версии;
// - zharyq-media            — голос, модели, звуки, картинки из public/. Лежат под ключом «адрес?h=<хэш содержимого>»: изменился
//                              файл — старая копия не находится и при активации удаляется, неизменённые остаются (60 МБ заново не качаем).
//                              Размер ограничен списком файлов сборки: чего нет в списке, в этот кэш не попадает;
// - zharyq-meta             — какие сборки сейчас хранятся.
const BUILD = '__BUILD__';
const ASSETS = new Set(/*@assets*/ [] /*@end*/);              // файлы assets/ ЭТОЙ сборки (по именам с хэшем)
const MEDIA_MAP = /*@media-map*/ {} /*@end*/;   // путь от корня сайта → хэш содержимого (8 знаков)
const SHELL_PREFIX = 'zharyq-shell-', SHELL = SHELL_PREFIX + BUILD, MEDIA = 'zharyq-media', META = 'zharyq-meta', LEGACY = 'zharyq-v1';
const KEEP_SHELLS = 2;
const SCOPE = self.registration.scope;                     // https://хост/prep/
const BASE = new URL(SCOPE).pathname;                      // /prep/
const VERSIONS_KEY = SCOPE + '__zharyq_versions__';        // служебная запись в zharyq-meta

/** Путь внутри сайта ('voice/a.mp3') или null, если адрес вне нашей папки. */
const relOf = url => (url.pathname.startsWith(BASE) ? url.pathname.slice(BASE.length) : null);
const mediaKey = (url, hash) => url.origin + url.pathname + '?h=' + hash;

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', e => e.waitUntil((async () => {
  try { await cleanup(); } catch { /* чистка не удалась — приложение работает, повторим в следующую версию */ }
  await self.clients.claim();
})()));

/** Перед удалением старых кэшей переносим из них нужное в текущие (а не только когда файл попросят): неизменённые файлы сборки (шрифты, ленивые куски)
 *  из старых shell-кэшей (только файлы, которые есть и в этой сборке: иначе мёртвые куски копились бы, ~2,7 МБ за каждый выход версии) и голос/модели из прежнего zharyq-v1 (под хэш). Страницы (index.html) не переносим: старая страница ссылается на файлы
 *  старой сборки, которых после очистки уже нет. */
async function carryOver() {
  const cur = await caches.open(SHELL), med = await caches.open(MEDIA);
  for (const name of await caches.keys()) {
    const legacy = name === LEGACY, oldShell = name.startsWith(SHELL_PREFIX) && name !== SHELL;
    if (!legacy && !oldShell) continue;
    const from = await caches.open(name);
    for (const req of await from.keys()) {
      const u = new URL(req.url), rel = relOf(u);
      if (rel === null) continue;
      try {
        if (legacy && MEDIA_MAP[rel] !== undefined) {
          const k = mediaKey(u, MEDIA_MAP[rel]);
          if (!(await med.match(k))) { const r = await from.match(req); if (r && r.status === 200) await med.put(k, r); }
        } else if (ASSETS.has(rel) && !(await cur.match(req))) {   // только файлы, которые есть и в новой сборке: мёртвые старые куски не копим
          const r = await from.match(req); if (r && r.status === 200) await cur.put(req, r);
        }
      } catch { /* одна запись не переехала — остальные продолжаем */ }
    }
  }
}

async function cleanup() {
  const meta = await caches.open(META);
  let list = [];
  try { const r = await meta.match(VERSIONS_KEY); if (r) list = await r.json(); } catch { /* нет записи */ }
  if (!Array.isArray(list)) list = [];
  const versions = [BUILD, ...list.filter(v => typeof v === 'string' && v !== BUILD)].slice(0, KEEP_SHELLS);
  await meta.put(VERSIONS_KEY, new Response(JSON.stringify(versions)));
  try { await carryOver(); } catch { /* перенос не удался — удаляем как обычно, нужное докачается из сети */ }
  const keep = new Set([MEDIA, META, ...versions.map(v => SHELL_PREFIX + v)]);
  // первый запуск после перехода со старого кэша zharyq-v1: он ещё служит «предыдущей сборкой» (страница могла попросить из него кусок)
  if (versions.length < KEEP_SHELLS) keep.add(LEGACY);
  for (const name of await caches.keys()) if (name.startsWith('zharyq') && !keep.has(name)) await caches.delete(name);
  // голос и модели: оставляем только то, что совпадает с хэшами этой сборки
  const media = await caches.open(MEDIA);
  for (const req of await media.keys()) {
    const u = new URL(req.url), rel = relOf(u);
    if (rel === null || MEDIA_MAP[rel] === undefined || MEDIA_MAP[rel] !== u.searchParams.get('h')) await media.delete(req);
  }
}

/** Ответ на запрос с Range (аудио-элемент просит куски): режем целый ответ 200 на 206. Без Range или непонятный Range — целиком. */
async function ranged(req, full) {
  const h = req.headers.get('range');
  const m = h && /^bytes=(\d*)-(\d*)$/.exec(h.trim());
  if (!m || (m[1] === '' && m[2] === '')) return full;
  const buf = await full.arrayBuffer(), size = buf.byteLength;
  let a = m[1] === '' ? Math.max(0, size - Number(m[2])) : Number(m[1]);
  let b = m[1] === '' || m[2] === '' ? size - 1 : Math.min(Number(m[2]), size - 1);
  if (a >= size || a > b) return new Response(null, { status: 416, headers: { 'Content-Range': 'bytes */' + size } });
  return new Response(buf.slice(a, b + 1), { status: 206, headers: { 'Content-Type': full.headers.get('Content-Type') || 'application/octet-stream', 'Content-Range': `bytes ${a}-${b}/${size}`, 'Content-Length': String(b - a + 1) } });
}

async function media(e, req, url, hash) {
  const cache = await caches.open(MEDIA), key = mediaKey(url, hash);
  let full = await cache.match(key);
  if (!full) {
    // голос и модели из прежнего кэша zharyq-v1 (до перехода на хэши): берём оттуда один раз и кладём под хэш, чтобы офлайн-голос не пропал
    const old = await caches.match(url.href, { cacheName: LEGACY });
    if (old && old.status === 200) { const copy = old.clone(); e.waitUntil(cache.put(key, copy).catch(() => {})); full = old; }
  }
  if (!full) {
    full = await fetch(url.href);   // целиком и без Range: кусок (206) в кэш не положить
    if (full.status !== 200) return full;
    e.waitUntil(cache.put(key, full.clone()).catch(() => {}));   // кэш полон или закрыт — играем из сети
  }
  return ranged(req, full);
}

function shellPut(e, req, res) {
  // клон берём СРАЗУ, до первого await: пока кэш открывается, страница уже читает тело ответа, и клон потом падает «body already used»
  // (так кэш страницы оставался пустым, а без сети был белый экран)
  if (res.status === 200 && res.type === 'basic') { const copy = res.clone(); e.waitUntil(caches.open(SHELL).then(k => k.put(req, copy)).catch(() => {})); }
  return res;
}
/** Сначала кэш текущей сборки, потом любой. Найденное в кэше старой сборки копируем в текущий: старые кэши удаляются при смене версии,
 *  а неизменённый файл (css, чанк, шрифт) иначе остался бы только в сети. */
async function fromShell(req, e) {
  const cur = await caches.open(SHELL), mine = await cur.match(req);
  if (mine) return mine;
  const old = await caches.match(req);
  if (old && e && old.status === 200) { const copy = old.clone(); e.waitUntil(cur.put(req, copy).catch(() => {})); }
  return old;
}

self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;   // Firebase и прочее — мимо кэша
  const rel = relOf(url);
  if (rel === null || rel === 'sw.js' || rel === 'version.json') return;  // сам sw.js и версия — всегда из сети
  if (req.mode === 'navigate') {
    // страница: сначала сеть (обновления), нет связи — копия, потом корень сайта
    e.respondWith(fetch(req).then(r => shellPut(e, req, r)).catch(async () => (await fromShell(req, e)) || (await fromShell(SCOPE, e)) || Response.error()));
    return;
  }
  if (rel.startsWith('assets/')) {   // файлы сборки: хэш в имени, содержимое не меняется — сначала кэш
    e.respondWith(fromShell(req, e).then(hit => hit || fetch(req).then(r => shellPut(e, req, r))));
    return;
  }
  if (MEDIA_MAP[rel] !== undefined) { e.respondWith(media(e, req, url, MEDIA_MAP[rel])); return; }
  if (rel.includes('/')) return;   // незнакомая папка (в том числе голос/модели, которых нет в списке сборки): мимо кэша
  // остальное в корне сайта (манифест, значки): сначала сеть, нет связи — копия
  e.respondWith(fetch(req).then(r => shellPut(e, req, r)).catch(async () => (await fromShell(req, e)) || Response.error()));
});
