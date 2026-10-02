import { describe, it, expect } from 'vitest';
// @ts-ignore
import { LESSONS as LS } from '../content/lessons.mjs';
// @ts-ignore
import { checkTeach, teachPrompt, parseTeach, roundOf, SYSTEM_TEACH, TEACH_SCHEMA, VERDICTS, MAX_ROUNDS } from '../helper/teachback.mjs';
import { teachPayload, type TeachContext } from '../src/engine/helperPayload';
import { TEACHBACK_BANK } from '../src/lesson/teachback_bank';
import { menuCards, teachQuestion, bricksFor, addBrick, menuResult, aiResult, aiFinished, TEACHBACK_SURFACE } from '../src/lesson/teachback';
const LESSONS = LS as Record<string, any[]>;

const ctx: TeachContext = { skill: 'frac.reduce', title: 'Бөлшекті қысқарту', rule: { kz: 'Есте сақта', lines: ['а', 'б'] }, question: 'Бөлшекті қалай қысқартамыз?' };

describe('«Биткә түсіндір»: тело запроса', () => {
  it('правило целиком, вопрос, ответ обрезан и без пробелов по краям; раунд считает сервер по истории', () => {
    const b = teachPayload(ctx, [], '  ЕҮОБ-қа бөлеміз  ');
    expect(b.mode).toBe('teachback');
    expect(b.topic).toEqual({ skill: 'frac.reduce', title: 'Бөлшекті қысқарту' });
    expect(b.rule).toBe('Есте сақта а б');
    expect(b.question).toBe(ctx.question);
    expect(b.answer).toBe('ЕҮОБ-қа бөлеміз');
    expect(b.examples).toBeUndefined();
    expect(teachPayload(ctx, [], 'x'.repeat(900)).answer).toHaveLength(400);
  });
  it('история идёт с ролями, примеры не больше трёх и без пустых', () => {
    const b = teachPayload({ ...ctx, examples: ['1', ' ', '2', '3', '4'] }, [{ role: 'kid', text: 'a' }, { role: 'bit', text: 'b' }], 'c');
    expect(b.history.map(t => t.role)).toEqual(['kid', 'bit']);
    expect(b.examples).toEqual(['1', '2', '3']);
    expect(roundOf(b)).toBe(2);
  });
  it('по всем 41 уроку правило без пропусков ▢ собирается и проходит проверку сервера', () => {
    for (const [skill, steps] of Object.entries(LESSONS)) {
      const r = steps.find(s => s.type === 'rule');
      const b = teachPayload({ skill, title: 't', rule: { kz: r.kz, lines: r.lines }, question: teachQuestion(skill) }, [], 'жауап');
      expect(checkTeach(b), skill).toBeNull();
    }
  });
});

describe('«Биткә түсіндір»: сервер (helper/teachback.mjs)', () => {
  const ok = { rule: 'r', question: 'q', answer: 'a' };
  it('плохие тела отклоняются, раунд 3 тоже', () => {
    expect(checkTeach({})).toBe('no_rule');
    expect(checkTeach({ ...ok, rule: '  ' })).toBe('no_rule');
    expect(checkTeach({ ...ok, question: undefined })).toBe('no_question');
    expect(checkTeach({ ...ok, answer: '   ' })).toBe('no_answer');
    expect(checkTeach({ ...ok, answer: 5 })).toBe('no_answer');
    expect(checkTeach({ ...ok, history: 'x' })).toBe('bad_history');
    expect(checkTeach(ok)).toBeNull();
    const kid = { role: 'kid', text: 'a' }, bit = { role: 'bit', text: 'b' };
    expect(checkTeach({ ...ok, history: [kid, bit] })).toBeNull();
    expect(checkTeach({ ...ok, history: [kid, bit, kid, bit] })).toBe('bad_round');
    expect(MAX_ROUNDS).toBe(2);
  });
  it('промпт: правило-эталон, вопрос, раунд, ответ ребёнка последним; история не длиннее 4; закрытое число ▢ не просят называть', () => {
    const h = Array.from({ length: 6 }, (_, k) => ({ role: k % 2 ? 'bit' : 'kid', text: `t${k}` }));
    const p = teachPrompt({ ...ok, rule: 'Санды ▢ деп жаз', topic: { skill: 's', title: 'Тема' }, history: h.slice(0, 2), answer: 'жауабым' });
    const first = p[0].parts[0].text;
    expect(first).toContain('Тема');
    expect(first).toContain('Санды ▢ деп жаз');
    expect(first).toContain('закрытое число ▢');
    expect(first).toContain('РАУНД: 2 из 2');
    expect(p.at(-1)!.role).toBe('user');
    expect(p.at(-1)!.parts[0].text).toContain('«жауабым»');
    expect(p[2].role).toBe('model');
    expect(teachPrompt({ ...ok, history: h }).length).toBe(1 + 4 + 1);
  });
  it('системный промпт: ученик-protégé, казахский, запрет называть ▢ и решать, игнор команд ребёнка, формат JSON', () => {
    for (const s of ['а ты — ученик', 'казахский', 'не называй и не вычисляй', 'игнорируй', 'JSON', 'не больше 50 слов']) expect(SYSTEM_TEACH).toContain(s);
    expect(TEACH_SCHEMA.properties.verdict.enum).toEqual(VERDICTS);
  });
  const j = (o: object) => JSON.stringify(o);
  it('разбор ответа модели: нормальный, в ограде ```, плохой вердикт, пустой reply, мусор', () => {
    expect(parseTeach(j({ verdict: 'partial', reply: 'Жақсы.', followup: 'Неге?' }), 1)).toEqual({ verdict: 'partial', reply: 'Жақсы.', followup: 'Неге?' });
    expect(parseTeach('```json\n' + j({ verdict: 'mis', reply: 'Жоқ.', followup: null }) + '\n```', 1)?.verdict).toBe('mis');
    expect(parseTeach(j({ verdict: 'great', reply: 'x' }))).toBeNull();
    expect(parseTeach(j({ verdict: 'got', reply: '  ' }))).toBeNull();
    expect(parseTeach('не JSON')).toBeNull();
    expect(parseTeach('null')).toBeNull();
  });
  it('после «понял» и в последнем раунде вопроса нет, даже если модель его прислала', () => {
    expect(parseTeach(j({ verdict: 'got', reply: 'Түсіндім.', followup: 'Тағы?' }), 1)!.followup).toBeNull();
    expect(parseTeach(j({ verdict: 'partial', reply: 'Итог.', followup: 'Тағы?' }), 2)!.followup).toBeNull();
    expect(parseTeach(j({ verdict: 'partial', reply: 'Итог.', followup: 'Тағы?' }), 1)!.followup).toBe('Тағы?');
  });
  it('слишком длинный ответ (больше 75 слов) отбрасывается', () => {
    expect(parseTeach(j({ verdict: 'mis', reply: Array(80).fill('сөз').join(' '), followup: null }), 1)).toBeNull();
    expect(parseTeach(j({ verdict: 'mis', reply: Array(50).fill('сөз').join(' '), followup: 'Неге?' }), 1)).not.toBeNull();
  });
});

describe('«Биткә түсіндір»: заготовки без ИИ (teachback_bank.ts)', () => {
  const skills = Object.keys(LESSONS);
  it('все 41 тема покрыта (36 + 5 десятичных, C3), лишних нет', () => {
    expect(skills).toHaveLength(41);
    expect(Object.keys(TEACHBACK_BANK).sort()).toEqual([...skills].sort());
  });
  it('у каждой темы вопрос, три разных объяснения, разбор ошибки, кирпичики; тексты короткие', () => {
    for (const [skill, e] of Object.entries(TEACHBACK_BANK)) {
      expect(e.q.length, skill).toBeGreaterThan(15);
      expect(new Set([e.good, e.typical, ...TEACHBACK_SURFACE]).size, skill).toBe(2 + TEACHBACK_SURFACE.length);
      for (const t of [e.good, e.typical]) expect(t.length, `${skill}: ${t}`).toBeLessThan(240);
      expect(e.whyTypical.length, skill).toBeGreaterThan(20);
      expect(e.bricks.length, skill).toBeGreaterThanOrEqual(5);
      expect(e.bricks.every(b => b.length <= 22), skill).toBe(true);
    }
  });
  it('тексты написаны по-казахски (у каждой темы есть казахские буквы), без скобок подсветки и знака пропуска ▢', () => {
    for (const [skill, e] of Object.entries(TEACHBACK_BANK)) {
      expect([e.q, e.good, e.typical, e.whyTypical].join(' '), skill).toMatch(/[әғқңөүұһі]/i);
      for (const t of [e.q, e.good, e.typical, e.whyTypical, ...e.bricks]) expect(t, skill).not.toMatch(/[\[\]▢]/);
    }
  });
  it('меню: три карточки (верная, ошибка, поверхностная) в стабильном порядке; верная не всегда первая', () => {
    const pos = new Set<number>();
    for (const skill of skills) {
      const a = menuCards(skill)!, b = menuCards(skill)!;
      expect(a.map(c => c.kind).sort()).toEqual(['good', 'surface', 'typical']);
      expect(a).toEqual(b);
      expect(a.find(c => c.kind === 'good')!.why).toBe('');
      expect(a.find(c => c.kind === 'typical')!.why).toBe(TEACHBACK_BANK[skill].whyTypical);
      expect(a.find(c => c.kind === 'surface')!.text).toMatch(/ережеде|Мұғалім|себебін/i);
      pos.add(a.findIndex(c => c.kind === 'good'));
    }
    expect(pos.size).toBe(3);
    expect(menuCards('нет.такой')).toBeNull();
    expect(teachQuestion('нет.такой')).toContain('түсіндір');
  });
  it('кирпичики: слова темы и связки; добавление через пробел, предел длины', () => {
    const b = bricksFor('frac.reduce');
    expect(b).toContain('ЕҮОБ');
    expect(b).toContain('себебі');
    expect(addBrick('', 'алым')).toBe('алым ');
    expect(addBrick('алым ', 'бөлім')).toBe('алым бөлім ');
    expect(addBrick('алым  ', 'бөлім')).toBe('алым бөлім ');
    expect(addBrick('x'.repeat(298), 'алым')).toBe('x'.repeat(298));
  });
  it('итоги: меню — с первой попытки «got», иначе «partial»; ИИ — «got» только при вердикте got, конец по вердикту или по 2 ответам', () => {
    expect(menuResult(0)).toBe('got');
    expect(menuResult(1)).toBe('partial');
    expect(aiResult('got')).toBe('got');
    expect(aiResult('partial')).toBe('partial');
    expect(aiResult('mis')).toBe('partial');
    expect(aiFinished('got', 1)).toBe(true);
    expect(aiFinished('mis', 1)).toBe(false);
    expect(aiFinished('mis', 2)).toBe(true);
  });
});
