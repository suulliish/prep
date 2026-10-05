// Проверка казахского носителем (C4, scripts/review, docs/KZ_REVIEW.md): куски текста, хэши, статусы, применение ответов, пакет.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
// @ts-ignore
import { stepTexts, lessonChunks, lessonHash, hash, glossaryHits, templateSamples, syncStatus, applyResults, patchSources, sourceVariants, blitzSamples, cleanNow, validateResults } from '../scripts/review/lib.mjs';
// @ts-ignore
import { buildData, buildHtml, pickSkills } from '../scripts/review/pack.mjs';
// @ts-ignore
import { current, chunksOf, extrasFor } from '../scripts/review/current.mjs';
// @ts-ignore
import { LESSONS } from '../content/lessons.mjs';
// @ts-ignore
import { templates } from '../content/templates/index.mjs';

const L = LESSONS as Record<string, any[]>;
const STATUS = JSON.parse(readFileSync(new URL('../content/kz_review.json', import.meta.url), 'utf8'));

describe('куски текста урока', () => {
  it('в каждом уроке есть куски, id уникальны, пустых нет', () => {
    for (const [sk, steps] of Object.entries(L)) {
      const ch = lessonChunks(sk, steps);
      expect(ch.length, sk).toBeGreaterThan(5);
      expect(new Set(ch.map((c: any) => c.id)).size, `${sk}: id`).toBe(ch.length);
      for (const c of ch) expect(c.text.trim().length, `${sk} ${c.id}`).toBeGreaterThan(0);
    }
  });
  it('все тексты, которые видит ребёнок, попадают в куски: цель, строки правила, кадры, варианты, разбор', () => {
    const ch = lessonChunks('div.primes', L['div.primes']), ids = new Set(ch.map((c: any) => c.id));
    const goal = L['div.primes'].findIndex(s => s.type === 'goal'), rule = L['div.primes'].findIndex(s => s.type === 'rule');
    expect(ids.has(`${goal}:kz`) && ids.has(`${goal}:task`)).toBe(true);
    L['div.primes'][rule].lines.forEach((_: any, k: number) => expect(ids.has(`${rule}:lines.${k}`)).toBe(true));
    const ex = L['div.primes'].findIndex(s => s.type === 'example');
    L['div.primes'][ex].frames.forEach((_: any, k: number) => expect(ids.has(`${ex}:frames.${k}.kz`)).toBe(true));
    const fin = L['div.primes'].length - 1;
    for (let k = 0; k < L['div.primes'][fin].choices.length; k++) expect([...ids].some(i => i === `${fin}:choices.${k}` || i.startsWith(`${fin}:choices.${k}`)) || !/[А-Яа-яӘәІіҢңҒғҮүҰұҚқӨөҺһ]{2,}/.test(String(L['div.primes'][fin].choices[k]))).toBe(true);
    expect(ids.has(`${fin}:why`)).toBe(true);
  });
  it('служебные поля (type, scene, w, answer) не попадают, чистая математика не попадает; параметры сцены s читаются', () => {
    const t = stepTexts({ type: 'goal', scene: 'Sieve', w: 'Виджет', answer: 'Жауап', s: { text: 'Жақсы көрінеді' }, kz: 'Сәлем, әлем', math: '2 + 3 = 5', task: 'x = 4' });
    expect(t.map((x: any) => x.path)).toEqual(['s.text', 'kz']);
  });
  it('озвучка (speak) есть только там, где отличается от текста', () => {
    const ch = lessonChunks('t', [{ type: 'say', kz: 'Сәлем' }, { type: 'say', kz: 'Бар 12 сан' }]);
    expect(ch[0].speak).toBeUndefined(); expect(ch[1].speak).toContain('он екі');
  });
  it('хэш урока стабилен и чувствителен к тексту', () => {
    const a = lessonChunks('div.primes', L['div.primes']), b = lessonChunks('div.primes', L['div.primes']);
    expect(lessonHash(a)).toBe(lessonHash(b));
    const c = a.map((x: any, i: number) => (i === 3 ? { ...x, text: x.text + '.' } : x));
    expect(lessonHash(c)).not.toBe(lessonHash(a));
  });
});

describe('словарь и образцы генераторов', () => {
  const terms = [{ kz: 'жай сан', ru: 'простое число', cat: 'числа' }, { kz: 'цифр', ru: 'цифра', cat: 'числа', avoid: ['цифра'] }];
  it('находит термины и запрещённые слова', () => {
    const r = glossaryHits(['1 — жай сан емес', 'бұл цифра екі'], terms);
    expect(r.used.map((x: any) => x.kz)).toContain('жай сан'); expect(r.bad.map((x: any) => x.word)).toEqual(['цифра']);
  });
  it('образцы детерминированы (одно зерно), хэш меняется вместе с задачами', () => {
    const t = templates.find((x: any) => x.id === 'div.which_prime');
    const a = templateSamples(t), b = templateSamples(t);
    expect(a).toEqual(b); expect(a.items.length).toBe(3); expect(a.h).toMatch(/^[0-9a-f]{8}$/);
    expect(templateSamples(templates[1]).h).not.toBe(a.h);
  });
});

describe('статус-файл content/kz_review.json', () => {
  it('syncStatus: новые — draft, прежний ok остаётся, при смене хэша ok → draft, лишние убираются', () => {
    const old = { a: { st: 'ok', h: '1' }, b: { st: 'ok', h: '2' }, c: { st: 'fix', h: '3', d: [] }, gone: { st: 'ok', h: '9' } };
    const out = syncStatus(old, { a: '1', b: 'X', c: '3', n: '5' });
    expect(out.a).toEqual({ st: 'ok', h: '1' }); expect(out.b).toEqual({ st: 'draft', h: 'X' });
    expect(out.c.st).toBe('fix'); expect(out.n).toEqual({ st: 'draft', h: '5' }); expect(out.gone).toBeUndefined();
  });
  it('файл в репозитории актуален: после правки текста урока или генератора запустите node scripts/review/status.mjs --init', () => {
    const cur = current();
    expect(syncStatus(STATUS, cur.hashes), 'content/kz_review.json устарел').toEqual(STATUS);
    expect(Object.keys(cur.lessons).length).toBe(Object.keys(L).length);
    for (const id of Object.keys(L)) expect(STATUS[id], id).toBeTruthy();
  });
});

describe('применение ответов проверяющего', () => {
  const cur = { lessons: { A: { h: 'ha', chunks: ['0:kz', '1:kz'], text: { '0:kz': 'бір', '1:kz': 'екі' } }, B: { h: 'hb', chunks: ['0:kz'], text: { '0:kz': 'үш' } } }, generators: { g1: 'hg' } };
  const base = () => ({ A: { st: 'draft', h: 'ha' }, B: { st: 'draft', h: 'hb' }, g1: { st: 'draft', h: 'hg' } });
  it('все куски ok → урок ok', () => {
    const r = applyResults(base(), { lessons: { A: { h: 'ha', chunks: { '0:kz': { st: 'ok' }, '1:kz': { st: 'ok' } } } } }, cur);
    expect(r.status.A).toEqual({ st: 'ok', h: 'ha' }); expect(r.report.ok).toEqual(['A']);
  });
  it('есть правка → fix с поправками, текст «было» берётся из актуального урока', () => {
    const r = applyResults(base(), { lessons: { A: { h: 'ha', chunks: { '0:kz': { st: 'fix', now: 'бірінші', note: 'сөз' }, '1:kz': { st: 'ok' } } } } }, cur);
    expect(r.status.A).toEqual({ st: 'fix', h: 'ha', d: [{ id: '0:kz', was: 'бір', now: 'бірінші', note: 'сөз' }] });
    expect(r.fixes).toEqual([{ lesson: 'A', id: '0:kz', was: 'бір', now: 'бірінші', note: 'сөз' }]);
  });
  it('проверено не до конца → статус не меняется', () => {
    const r = applyResults(base(), { lessons: { A: { h: 'ha', chunks: { '0:kz': { st: 'ok' } } } } }, cur);
    expect(r.status.A.st).toBe('draft'); expect(r.report.partial[0]).toContain('1/2');
  });
  it('текст изменился после сборки пакета (хэш не тот) → пропуск; неизвестный id → отчёт', () => {
    const r = applyResults(base(), { lessons: { A: { h: 'старый', chunks: { '0:kz': { st: 'ok' }, '1:kz': { st: 'ok' } } }, Z: { h: 'z', chunks: {} } } }, cur);
    expect(r.status.A.st).toBe('draft'); expect(r.report.stale).toEqual(['A']); expect(r.report.unknown).toEqual(['Z']);
  });
  it('генераторы: ok, fix, stale', () => {
    expect(applyResults(base(), { generators: { g1: { st: 'ok', h: 'hg' } } }, cur).status.g1.st).toBe('ok');
    const f = applyResults(base(), { generators: { g1: { st: 'fix', h: 'hg', note: 'вариант B' } } }, cur);
    expect(f.status.g1.st).toBe('fix'); expect(f.status.g1.d[0].note).toBe('вариант B');
    expect(applyResults(base(), { generators: { g1: { st: 'ok', h: 'другой' } } }, cur).report.stale).toEqual(['g1']);
  });
  it('пустой ответ ничего не ломает', () => { expect(applyResults(base(), {}, cur).status).toEqual(base()); });
});

describe('внесение поправок в исходники (--patch)', () => {
  const src = (body: string) => ({ 'lessons.mjs': `export const L = {\n  a: [{ kz: ${body} }],\n};\n` });
  it('заменяет единственное вхождение, сохраняя кавычки', () => {
    const r = patchSources(src("'Сәлем, әлем'"), 'Сәлем, әлем', 'Сәлем, дүние');
    expect(r.ok).toBe(true); expect(r.files['lessons.mjs']).toContain("kz: 'Сәлем, дүние'");
  });
  it('перевод строки и апостроф в тексте: исходник экранирован', () => {
    const r = patchSources(src("'Бір\\nЕкі it\\'s'"), "Бір\nЕкі it's", "Бір\nҮш it's");
    expect(r.ok).toBe(true); expect(r.files['lessons.mjs']).toContain("'Бір\\nҮш it\\'s'");
  });
  it('новый текст с апострофом экранируется в одинарных кавычках', () => {
    const r = patchSources(src("'абв'"), 'абв', "а'б");
    expect(r.ok).toBe(true); expect(r.files['lessons.mjs']).toContain("'а\\'б'");
  });
  it('два места или ни одного → не трогаем', () => {
    const two = { 'a.mjs': "x: 'Иә', y: 'Иә'" };
    const a = patchSources(two, 'Иә', 'Да'); expect(a.ok).toBe(false); expect(a.why).toContain('2'); expect(a.files).toBe(two);
    expect(patchSources(two, 'Жоқ', 'Нет').ok).toBe(false);
  });
  it('кусок внутри более длинной строки не заменяем', () => {
    const r = patchSources({ 'a.mjs': "x: 'Иә, бәлкім'" }, 'Иә', 'Да'); expect(r.ok).toBe(false);
  });
  it('двойные кавычки и шаблонная строка', () => {
    expect(patchSources({ 'a.mjs': 'x: "абв"' }, 'абв', 'ғһ').files['a.mjs']).toBe('x: "ғһ"');
    expect(patchSources({ 'a.mjs': 'x: `абв`' }, 'абв', 'ғһ').files['a.mjs']).toBe('x: `ғһ`');
  });
  it('варианты записи строки', () => { expect(sourceVariants('a\nb').map((v: any) => v.s)).toEqual(['a\\nb', 'a\\nb', 'a\\nb']); });
});

describe('пакет-HTML', () => {
  const data = buildData({ id: 'kz-pack-test', skills: ['div.primes', 'dec.concept'], now: '2026-10-05T00:00:00Z' });
  const html = buildHtml(data);
  it('данные пакета: уроки, куски, хэш, термины, образцы генераторов', () => {
    expect(data.lessons.map((l: any) => l.skill)).toEqual(['div.primes', 'dec.concept']);
    for (const l of data.lessons) { expect(l.chunks.length).toBeGreaterThan(20); expect(l.h).toMatch(/^[0-9a-f]{8}$/); expect(l.generators.length).toBeGreaterThan(0); expect(l.terms.length).toBeGreaterThan(0); }
    expect(data.lessons[0].h).toBe(current().lessons['div.primes'].h);   // хэш в пакете = хэш, с которым сверяет apply
  });
  it('один файл без внешних ссылок, данные читаются обратно', () => {
    expect(html).not.toMatch(/(src|href)="https?:/);
    const m = html.match(/<script type="application\/json" id="data">([\s\S]*?)<\/script>/)!;
    expect(JSON.parse(m[1]).lessons[0].skill).toBe('div.primes');
  });
  it('текст с </script> и разделителями строк не ломает страницу', () => {
    const evil = buildHtml({ ...data, lessons: [{ ...data.lessons[0], chunks: [{ id: '0:kz', step: 0, type: 'say', path: 'kz', text: 'a</script><script>alert(1)</script> b' }] }] });
    const m = evil.match(/<script type="application\/json" id="data">([\s\S]*?)<\/script>/)!;
    expect(m[1]).not.toContain('</script'); expect(JSON.parse(m[1]).lessons[0].chunks[0].text).toContain('alert(1)');
    expect(evil.split('<script').length).toBe(3);   // данные и код, больше ничего
  });
  it('выбор тем: --queue, --skills, --next, --changed', () => {
    expect(pickSkills({ queue: '6-8' })).toEqual(['div.primes', 'div.factorization', 'div.gcd']);
    expect(pickSkills({ skills: 'dec.concept,div.gcd', queue: '6-7' })).toEqual(['div.primes', 'div.factorization', 'dec.concept', 'div.gcd']);
    expect(pickSkills({ next: '2' }, { 'nat.place_value': { st: 'ok' } })[0]).toBe('nat.ops');
    expect(pickSkills({ changed: true }, Object.fromEntries(Object.keys(L).map(k => [k, { st: 'ok' }]))).length).toBe(0);
    expect(() => pickSkills({ skills: 'нет.такого' })).toThrow();
  });
});

describe('что ещё видит ребёнок в уроке и должно быть в пакете', () => {
  it('вопросы блица (функция make) идут в куски: 8 образцов с постоянным зерном, во всех 41 уроках', () => {
    let withSamples = 0;
    for (const [sk, steps] of Object.entries(L)) {
      const i = steps.findIndex((x: any) => x.type === 'blitz');
      const a = blitzSamples(steps[i], `${sk}:${i}`), b = blitzSamples(steps[i], `${sk}:${i}`);
      expect(a, sk).toEqual(b); expect(a.length).toBeLessThanOrEqual(8); if (a.length) withSamples++;   // блиц из одной математики без слов проверять нечего
    }
    expect(withSamples).toBeGreaterThanOrEqual(30);
    const ids = chunksOf('div.count_multiples').map((c: any) => c.id);
    expect(ids.some((x: string) => /^\d+:blitz\.0$/.test(x))).toBe(true);
  });
  it('название темы и приёма — отдельные куски; параметры сцены (s) с казахскими словами не теряются', () => {
    const ids = chunksOf('div.gcd').map((c: any) => c.id);
    expect(ids).toContain('skill:title'); expect(ids).toContain('tech:kz');
    expect(extrasFor('div.gcd').map((e: any) => e.type)).toEqual(['skill', 'tech']);
    expect(stepTexts({ type: 'goal', s: { math: 'ЕҮОБ(36; 60)', n: 5 }, kz: 'Сәлем' }).map((x: any) => x.path)).toEqual(['s.math', 'kz']);
  });
});

describe('защита применения ответов', () => {
  it('validateResults: понятные ошибки вместо стека, мусорные ключи отвергаются', () => {
    for (const bad of [null, [], 'x', 5, { lessons: 5 }, { lessons: { a: null } }, { lessons: { a: { chunks: {} } } }, { lessons: { a: { h: 'h', chunks: { k: { st: 'maybe' } } } } },
      { lessons: { a: { h: 'h', chunks: { k: { st: 'fix', now: { x: 1 } } } } } }, { generators: { g: { st: 'ok' } } }, { terms: { a: null } }, JSON.parse('{"lessons":{"__proto__":{"h":"h","chunks":{}}}}'), JSON.parse('{"terms":{"constructor":{}}}')])
      expect(() => validateResults(bad), JSON.stringify(bad)).toThrow();
    const ok = validateResults({ pack: 'p', lessons: { a: { h: 'h', chunks: { '0:kz': { st: 'fix', now: 'аб', note: 'n', evil: 1 } } } }, extra: 1 });
    expect(ok.lessons.a.chunks['0:kz']).toEqual({ st: 'fix', now: 'аб', note: 'n' }); expect((ok as any).extra).toBeUndefined();
  });
  it('урок с правкой, но проверенный не весь, не считается завершённым (complete)', () => {
    const cur = { lessons: { A: { h: 'ha', chunks: ['0:kz', '1:kz', '2:kz'], text: { '0:kz': 'бір', '1:kz': 'екі', '2:kz': 'үш' } } }, generators: {} };
    const part = applyResults({ A: { st: 'draft', h: 'ha' } }, { lessons: { A: { h: 'ha', chunks: { '0:kz': { st: 'fix', now: 'x', note: '' } } } } }, cur);
    expect(part.report.complete).toEqual([]); expect(part.status.A.st).toBe('fix');
    const full = applyResults({ A: { st: 'draft', h: 'ha' } }, { lessons: { A: { h: 'ha', chunks: { '0:kz': { st: 'fix', now: 'x' }, '1:kz': { st: 'ok' }, '2:kz': { st: 'ok' } } } } }, cur);
    expect(full.report.complete).toEqual(['A']);
  });
  it('cleanNow: CRLF → LF, лишние пробелы, нет слов → null, не строка → null', () => {
    expect(cleanNow('аб\r\nвг', 'x')).toBe('аб\nвг'); expect(cleanNow('  аб  ', 'аб')).toBe('аб'); expect(cleanNow('  аб ', ' аб ')).toBe('  аб ');
    for (const bad of ['', '   ', '1', 'a<b', 5, null, { a: 1 }]) expect(cleanNow(bad as any, 'аб'), String(bad)).toBeNull();
  });
  it('исходник: ${ в шаблонной строке экранируется; экранированная кавычка перед текстом не считается началом литерала', () => {
    expect(sourceVariants('а${x}б')[2].s).toBe('а\\${x}б');
    const r = patchSources({ 'a.mjs': 'x: `абв`' }, 'абв', 'а${1}б'); expect(r.files['a.mjs']).toBe('x: `а\\${1}б`');
    expect(patchSources({ 'a.mjs': "x: 'ол: \\'абв'" }, 'абв', 'ғһ').ok).toBe(false);
  });
});
