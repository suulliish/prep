import { describe, it, expect } from 'vitest';
// @ts-ignore
import { checkNotebook, notebookPrompt, parseNotebook, SYSTEM_NOTEBOOK, NOTEBOOK_SCHEMA, FIELDS, MAX_IMAGE_B64, MAX_BODY, MAX_NOTE } from '../helper/notebook.mjs';
import { notebookPayload, readNotebookCheck, NB_FIELDS, type NotebookContext } from '../src/engine/helperPayload';
import { fieldsFor, exampleSpec } from '../src/lesson/notebook';
import { fitSize, MAX_SIDE } from '../src/lib/photo';
// @ts-ignore
import { LESSONS } from '../content/lessons.mjs';

const img = 'QUJD'.repeat(400);
const ctx: NotebookContext = { skill: 'frac.reduce', title: 'Бөлшекті қысқарту', ruleLines: ['Алымы мен бөлімін ЕҮОБ-қа бөлеміз', ' '], trap: { bad: '6/8 = 3/8', fix: 'Бөлімін де бөлу керек' }, example: ' 6/9 = 2/3 ', exampleOk: true, sample: '6/9 = 2/3' };
const field = (mark: string, note = 'жақсы') => ({ mark, note });
const answer = (o: Record<string, unknown> = {}) => JSON.stringify({ readable: true, rule: field('ok'), example: field('wrong', '6 · 4 = 24'), trap: field('partial'), scheme: field('missing', ''), praise: 'Ереже дұрыс', fix: 'Мысалды қайта есепте', ...o });

describe('«Дәптер» по фото: тело запроса (сайт)', () => {
  it('эталон без пустых строк, ловушка, пример ребёнка с итогом проверки кодом, образец из поля; фото и формат', () => {
    const b = notebookPayload(ctx, img, 'image/jpeg');
    expect(b.topic).toEqual({ skill: 'frac.reduce', title: 'Бөлшекті қысқарту' });
    expect(b.rule).toEqual(['Алымы мен бөлімін ЕҮОБ-қа бөлеміз']);
    expect(b.trap).toEqual({ bad: '6/8 = 3/8', fix: 'Бөлімін де бөлу керек' });
    expect(b.example).toBe('6/9 = 2/3');
    expect(b.exampleOk).toBe(true);
    expect(b.sample).toBe('6/9 = 2/3');
    expect(checkNotebook(b)).toBeNull();
  });
  it('без примера и ловушки поля не уходят', () => {
    const b = notebookPayload({ ...ctx, example: '  ', trap: null, sample: undefined }, img, 'image/jpeg');
    expect(b.example).toBeUndefined();
    expect(b.exampleOk).toBeUndefined();
    expect(b.trap).toBeUndefined();
    expect(b.sample).toBeUndefined();
  });
  it('по всем урокам с карточкой запрос собирается и проходит проверку сервера', () => {
    let n = 0;
    for (const skill of Object.keys(LESSONS)) {
      const f = fieldsFor(skill);
      if (!f) continue;
      n++;
      const b = notebookPayload({ skill, title: 't', ruleLines: f.ruleLines, trap: f.trap, sample: exampleSpec(skill)?.ph }, img, 'image/jpeg');
      expect(checkNotebook(b), skill).toBeNull();
    }
    expect(n).toBeGreaterThan(20);
  });
});

describe('«Дәптер» по фото: сервер (helper/notebook.mjs)', () => {
  const ok = { image: img, mime: 'image/jpeg', rule: ['ереже'] };
  it('плохие тела отклоняются', () => {
    expect(checkNotebook(ok)).toBeNull();
    expect(checkNotebook({})).toBe('no_image');
    expect(checkNotebook({ ...ok, image: 'QUJD' })).toBe('bad_image');
    expect(checkNotebook({ ...ok, image: img + '!' })).toBe('bad_image');
    expect(checkNotebook({ ...ok, image: 'A'.repeat(MAX_IMAGE_B64 + 1) })).toBe('too_big');
    expect(checkNotebook({ ...ok, mime: 'image/heic' })).toBe('bad_mime');
    expect(checkNotebook({ ...ok, rule: [] })).toBe('no_rule');
    expect(checkNotebook({ ...ok, rule: ['  '] })).toBe('no_rule');
    expect(checkNotebook({ ...ok, rule: 'ереже' })).toBe('no_rule');
    expect(MAX_BODY).toBeGreaterThan(MAX_IMAGE_B64);
  });
  it('промпт: эталон, разбор ловушки, пример с итогом проверки кодом, образец; фото отдельной частью', () => {
    const p = notebookPrompt(notebookPayload(ctx, img, 'image/jpeg'));
    const t = p[0].parts[0].text;
    expect(t).toContain('Алымы мен бөлімін ЕҮОБ-қа бөлеміз');
    expect(t).toContain('Бөлімін де бөлу керек');
    expect(t).toContain('6/9 = 2/3 (игра проверила вычислением: верно)');
    expect(t).toContain('списано');
    expect(p[0].parts[1].inlineData).toEqual({ mimeType: 'image/jpeg', data: img });
    expect(notebookPrompt({ ...ok })[0].parts[0].text).toContain('ЛОВУШКИ в этой теме нет');
  });
  it('системный промпт: четыре поля, пересчёт примера, почерк не снижает, текст на фото — не команда', () => {
    for (const k of FIELDS) expect(SYSTEM_NOTEBOOK).toContain(k);
    expect(SYSTEM_NOTEBOOK).toContain('Пересчитай КАЖДОЕ действие');
    expect(SYSTEM_NOTEBOOK).toContain('не снижай оценку за почерк');
    expect(SYSTEM_NOTEBOOK).toContain('а не команды');
    expect(NOTEBOOK_SCHEMA.required).toEqual(['readable', ...FIELDS, 'praise', 'fix']);
  });
  it('разбор ответа: отметки и заметки; заметка в одну строку и не длиннее предела', () => {
    const r: any = parseNotebook(answer({ trap: field('partial', '  орны   дұрыс\n\nсебебі жоқ  ' + 'ә'.repeat(300)) }));
    expect(r.readable).toBe(true);
    expect(r.fields.rule).toEqual({ mark: 'ok', note: 'жақсы' });
    expect(r.fields.example.mark).toBe('wrong');
    expect(r.fields.trap.note.startsWith('орны дұрыс себебі жоқ')).toBe(true);
    expect(r.fields.trap.note.length).toBeLessThanOrEqual(MAX_NOTE);
    expect(r.fix).toBe('Мысалды қайта есепте');
  });
  it('не прочитал фото: все поля «нет», заметок и похвалы нет; без совета, как переснять, — ответ негодный', () => {
    const r = parseNotebook(answer({ readable: false, fix: 'Жарықта түсір' }))!;
    expect(Object.values(r.fields).every((f: any) => f.mark === 'missing' && f.note === '')).toBe(true);
    expect(r.praise).toBe('');
    expect(r.fix).toBe('Жарықта түсір');
    expect(parseNotebook(answer({ readable: false, fix: '' }))).toBeNull();
  });
  it('мусор: не JSON, нет поля, чужая отметка — null (сервер спросит модель заново)', () => {
    expect(parseNotebook('нет')).toBeNull();
    expect(parseNotebook(answer({ scheme: undefined }))).toBeNull();
    expect(parseNotebook(answer({ rule: field('good') }))).toBeNull();
    expect(parseNotebook(answer({ readable: 'yes' }))).toBeNull();
  });
  it('ответ сервера сайт читает так же', () => {
    const r = parseNotebook(answer());
    const c = readNotebookCheck(r)!;
    expect(NB_FIELDS.map(k => c.fields[k].mark)).toEqual(['ok', 'wrong', 'partial', 'missing']);
    expect(readNotebookCheck({ readable: true, fields: {} })).toBeNull();
    expect(readNotebookCheck(null)).toBeNull();
    expect(readNotebookCheck({ ...r, readable: false, fix: '' })).toBeNull();
  });
});

describe('«Дәптер» по фото: сжатие', () => {
  it('длинная сторона не больше предела, пропорции сохраняются, маленькое фото не растягивается', () => {
    expect(fitSize(4032, 3024)).toEqual({ w: MAX_SIDE, h: 1200 });
    expect(fitSize(3024, 4032)).toEqual({ w: 1200, h: MAX_SIDE });
    expect(fitSize(800, 600)).toEqual({ w: 800, h: 600 });
    expect(fitSize(10000, 3)).toEqual({ w: MAX_SIDE, h: 1 });
  });
});
