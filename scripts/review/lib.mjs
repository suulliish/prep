// Проверка казахского носителем (C4, docs/systems/specs/content.md п. 6, docs/KZ_REVIEW.md): общая часть пакета и применения ответов.
// Единица проверки — «кусок» текста урока (одна строка, кадр, вариант, разбор). Статус урока и генератора лежит в content/kz_review.json:
//   { [id урока | id шаблона]: { st: 'draft' | 'ok' | 'fix', h: хэш текста, d?: [{ id, was, now, note }] } }
// h — хэш казахского текста: текст изменился после 'ok' — статус снова 'draft'. Чистый модуль без обращений к файлам (кроме loadAll).
import { createHash } from 'node:crypto';
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { speakable } from '../voice/lesson-lines.mjs';
import { rng } from '../../content/templates/lib.mjs';

/** Названия шагов, как у ребёнка на экране (src/screens/Lesson.svelte CHIP). */
export const STEP_KZ = {
  goal: 'Мақсат', widget: 'Қолмен', predict: 'Болжа', example: 'Көр', faded: 'Өзің', why: 'Неге?', bug: 'Глитчтің қатесі',
  blitz: 'Шағын ойын', rule: 'Есте сақта', final: 'Соңғы сынақ', quiz: 'Қалай ойлайсың?', say: 'Бит',
};
const SKIP_KEYS = new Set(['type', 'scene', 'w', 'answer', 'need', 'count', 'make']);
/** Строка с казахскими/русскими словами (две буквы подряд); чистая математика и одиночные буквы-переменные не в счёте. */
const WORDY = /[А-Яа-яЁёӘәІіҢңҒғҮүҰұҚқӨөҺһ]{2,}/;

/** Запущен ли файл как скрипт (а не импортирован). Сравнение по реальным путям: на macOS /tmp — ссылка на /private/tmp. */
export const isMain = metaUrl => { try { return !!process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(metaUrl)); } catch { return false; } };

export const hash = text => createHash('sha1').update(text).digest('hex').slice(0, 8);

/** Все тексты шага: [{ path, text }] в порядке показа. path — путь внутри шага («frames.2.kz»). */
export function stepTexts(step) {
  const out = [];
  const walk = (v, path) => {
    if (typeof v === 'string') { if (WORDY.test(v)) out.push({ path, text: v }); return; }
    if (Array.isArray(v)) { v.forEach((x, k) => walk(x, path ? `${path}.${k}` : `${k}`)); return; }
    if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) { if (!SKIP_KEYS.has(k)) walk(x, path ? `${path}.${k}` : k); }
  };
  walk(step, '');
  return out;
}

const seedOf = s => parseInt(hash(s), 16) >>> 0;
const CYR = /[А-Яа-яЁёӘәІіҢңҒғҮүҰұҚқӨөҺһ]/;
/** Вопросы блица «Шағын ойын»: шаг хранит функцию make(rng), текст рождается при игре. Берём 8 образцов с постоянным зерном: вопрос и варианты. */
export function blitzSamples(step, key, n = 8) {
  if (typeof step.make !== 'function') return [];
  const r = rng(seedOf(key)), seen = new Set(), out = [];
  for (let t = 0; out.length < n && t < n * 20; t++) {
    const it = step.make(r); if (!it || seen.has(it.q)) continue; seen.add(it.q);
    const text = `${it.q}\n${(it.choices ?? []).join('  |  ')}`;
    if (CYR.test(text)) out.push(text);
  }
  return out;
}

/** Куски урока: [{ id, step, type, path, text, speak? }]. id уникален внутри урока: «<шаг>:<путь>». speak — как прочтёт Бит (числа и знаки словами), если отличается.
 *  Блиц: образцы вопросов (путь blitz.N, не в исходнике буквально). extras — тексты вне шагов урока (название темы, название приёма): [{ id, step: -1, type, text }]. */
export function lessonChunks(skill, steps, extras = []) {
  const chunks = [];
  const push = (id, step, type, path, text) => { const sp = speakable(text); chunks.push({ id, step, type, path, text, ...(sp !== text.replace(/\s+/g, ' ').trim() ? { speak: sp } : {}) }); };
  steps.forEach((s, i) => {
    for (const { path, text } of stepTexts(s)) push(`${i}:${path}`, i, s.type, path, text);
    blitzSamples(s, `${skill}:${i}`).forEach((text, k) => push(`${i}:blitz.${k}`, i, s.type, `blitz.${k}`, text));
  });
  for (const e of extras) push(e.id, e.step ?? -1, e.type, e.id, e.text);
  return chunks;
}
export const lessonHash = chunks => hash(chunks.map(c => `${c.id}\u0001${c.text}`).join('\u0002'));

/** Термины словаря content/glossary.json, найденные в текстах: [{ kz, ru, cat, n }] и запрещённые слова (avoid), попавшие в казахский текст. */
export function glossaryHits(texts, terms) {
  const low = texts.map(t => t.toLowerCase());
  const used = [], bad = [];
  for (const t of terms) {
    const k = t.kz.toLowerCase();
    const n = low.reduce((a, x) => a + (x.includes(k) ? 1 : 0), 0);
    if (n) used.push({ kz: t.kz, ru: t.ru, cat: t.cat, n });
    for (const a of t.avoid ?? []) {
      const re = a === a.toUpperCase() ? new RegExp(`(^|[^А-Яа-я])${a}([^А-Яа-я]|$)`) : new RegExp(`(^|[^а-яё])${a}`, 'i');
      if (texts.some(x => re.test(x))) bad.push({ word: a, use: t.kz });
    }
  }
  return { used, bad };
}

/** Образцы генератора: по 3 задачи, зерно от id шаблона (одни и те же при каждой сборке). */
export function templateSamples(tpl, n = 3) {
  const r = rng(seedOf(tpl.id)), items = [];
  for (let k = 0; k < n; k++) {
    const it = tpl.gen(r);
    items.push({ kz: it.kz, choices: it.choices.map(c => c.text), answer: it.answer, sol: it.sol.kz, ...(it.figure ? { figure: it.figure.kind } : {}) });
  }
  return { id: tpl.id, title: tpl.title.kz, h: hash(items.map(x => `${x.kz}|${x.choices.join('|')}|${x.sol}`).join('\u0002')), items };
}

/** Статус-файл: новые ключи — draft; изменился хэш — draft (даже если было ok); исчезнувшие ключи убираются. */
export function syncStatus(old, current) {
  const out = {};
  for (const [id, h] of Object.entries(current)) {
    const o = old?.[id];
    out[id] = o && o.h === h ? o : { st: 'draft', h };
  }
  return out;
}

/** Применить ответы проверяющего к статус-файлу. results — JSON из пакета; cur — актуальные { lessons: {id: {h, chunks:[ids]}}, generators: {id: h} }.
 *  Урок 'ok', если все его куски отмечены ok; есть хоть один 'fix' — 'fix' с поправками в d; остались неотмеченные — не меняем.
 *  Если хэш в ответе не совпал с текущим — текст изменился после сборки пакета, ответ пропускаем (stale). Возвращает { status, report, fixes }. */
export function applyResults(status, results, cur) {
  const next = { ...status }, report = { ok: [], fix: [], partial: [], stale: [], unknown: [], complete: [] }, fixes = [];
  for (const [id, r] of Object.entries(results.lessons ?? {})) {
    const c = cur.lessons[id];
    if (!c) { report.unknown.push(id); continue; }
    if (r.h !== c.h) { report.stale.push(id); continue; }
    const marks = r.chunks ?? {}, bad = c.chunks.filter(k => marks[k]?.st === 'fix'), done = c.chunks.filter(k => marks[k]?.st === 'ok' || marks[k]?.st === 'fix');
    if (done.length === c.chunks.length) report.complete.push(id);   // все куски урока отмечены (ok или fix)
    if (bad.length) {
      const d = bad.map(k => ({ id: k, was: c.text[k], now: marks[k].now ?? '', note: marks[k].note ?? '' }));
      next[id] = { st: 'fix', h: c.h, d }; report.fix.push(id); fixes.push(...d.map(x => ({ lesson: id, ...x })));
    } else if (done.length === c.chunks.length) { next[id] = { st: 'ok', h: c.h }; report.ok.push(id); }
    else report.partial.push(`${id} (${done.length}/${c.chunks.length})`);
  }
  for (const [id, r] of Object.entries(results.generators ?? {})) {
    const h = cur.generators[id];
    if (h === undefined) { report.unknown.push(id); continue; }
    if (r.h !== h) { report.stale.push(id); continue; }
    if (r.st === 'ok') { next[id] = { st: 'ok', h }; report.ok.push(id); }
    else if (r.st === 'fix') { next[id] = { st: 'fix', h, d: [{ id: 'sample', was: '', now: '', note: r.note ?? '' }] }; report.fix.push(id); fixes.push({ lesson: id, id: 'generator', was: '', now: '', note: r.note ?? '' }); }
  }
  return { status: next, report, fixes };
}

/** Варианты записи строки в исходнике .mjs: сырая, с экранированием перевода строки и каждой из кавычек. */
export function sourceVariants(text) {
  const base = text.replace(/\\/g, '\\\\').replace(/\n/g, '\\n');
  return ["'", '"', '`'].map(q => ({ q, s: (q === '`' ? base.split('${').join('\\${') : base).split(q).join('\\' + q) }));
}
/** Заменить строку `was` на `now` ровно в одном месте среди исходников { file: текст }. Берём только строку целиком (по краям одна и та же кавычка),
 *  а не кусок внутри более длинной. Возвращает { files, ok, why }: ok=false — не нашли или больше одного совпадения. */
export function patchSources(files, was, now) {
  const hits = [];
  for (const [f, src] of Object.entries(files)) {
    for (const v of sourceVariants(was)) {
      const needle = v.s; if (!needle) continue;
      let at = src.indexOf(needle);
      while (at >= 0) {
        const q = src[at - 1];
        if ((q === "'" || q === '"' || q === '`') && src[at - 2] !== '\\' && src[at + needle.length] === q) hits.push({ f, at, q, len: needle.length });
        at = src.indexOf(needle, at + 1);
      }
    }
  }
  const uniq = [...new Map(hits.map(h => [`${h.f}:${h.at}`, h])).values()];   // один и тот же литерал, найденный несколькими вариантами записи, считаем один раз
  if (uniq.length !== 1) return { files, ok: false, why: uniq.length ? `найдено ${uniq.length} мест` : 'не найдено в исходниках целой строкой' };
  const h = uniq[0], rep = sourceVariants(now).find(v => v.q === h.q).s;
  return { files: { ...files, [h.f]: files[h.f].slice(0, h.at) + rep + files[h.f].slice(h.at + h.len) }, ok: true };
}

/** Новый текст перед внесением: переводы строк CRLF → LF; пробелы по краям убираем, если в старом их не было. null — вносить нельзя
 *  (не строка, пусто или нет слов: такой кусок после замены выпал бы из пакета, а урок остался бы «принятым»). */
export function cleanNow(now, was) {
  if (typeof now !== 'string') return null;
  let t = now.replace(/\r\n?/g, '\n');
  if (t === t.trim() || was !== was.trim()) { /* как есть */ } else t = t.trim();
  return WORDY.test(t) ? t : null;
}

const BAD_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);
/** Проверка и очистка JSON из пакета. Бросает Error с понятным текстом; возвращает копию только с известными полями. */
export function validateResults(r) {
  if (!isObj(r)) throw new Error('результат должен быть JSON-объектом из кнопки «Нәтижені көшіру»');
  const sect = (name, check) => {
    const v = r[name]; if (v === undefined) return {};
    if (!isObj(v)) throw new Error(`поле «${name}» должно быть объектом`);
    const out = {};
    for (const [k, x] of Object.entries(v)) {
      if (BAD_KEYS.has(k)) throw new Error(`недопустимый ключ «${k}» в «${name}»`);
      out[k] = check(k, x);
    }
    return out;
  };
  const str = (v, what) => { if (v !== undefined && typeof v !== 'string') throw new Error(`${what}: ожидалась строка`); return v; };
  const lessons = sect('lessons', (k, x) => {
    if (!isObj(x) || typeof x.h !== 'string') throw new Error(`урок ${k}: нет поля h (хэш пакета)`);
    const chunks = {};
    if (x.chunks !== undefined && !isObj(x.chunks)) throw new Error(`урок ${k}: chunks должен быть объектом`);
    for (const [c, m] of Object.entries(x.chunks ?? {})) {
      if (BAD_KEYS.has(c)) throw new Error(`урок ${k}: недопустимый ключ «${c}»`);
      if (!isObj(m) || (m.st !== 'ok' && m.st !== 'fix')) throw new Error(`урок ${k}, кусок ${c}: st должен быть ok или fix`);
      chunks[c] = m.st === 'ok' ? { st: 'ok' } : { st: 'fix', now: str(m.now, `урок ${k}, кусок ${c}, now`) ?? '', note: str(m.note, `урок ${k}, кусок ${c}, note`) ?? '' };
    }
    return { h: x.h, chunks };
  });
  const generators = sect('generators', (k, x) => {
    if (!isObj(x) || typeof x.h !== 'string' || (x.st !== 'ok' && x.st !== 'fix')) throw new Error(`генератор ${k}: нужны st (ok/fix) и h`);
    return { st: x.st, h: x.h, note: str(x.note, `генератор ${k}, note`) ?? '' };
  });
  const terms = sect('terms', (k, x) => { if (!isObj(x)) throw new Error(`термин ${k}: ожидался объект`); return { textbook: str(x.textbook, `термин ${k}`) ?? '' }; });
  return { pack: str(r.pack, 'pack'), by: str(r.by, 'by'), exported: str(r.exported, 'exported'), lessons, generators, terms };
}
