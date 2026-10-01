import { describe, it, expect } from 'vitest';
// @ts-ignore
import { LESSONS as LS } from '../content/lessons.mjs';
// @ts-ignore
import { checkLesson, lessonPrompt, ANSWER_FIRST, LESSON_TYPES } from '../helper/lesson.mjs';
import { lessonPayload, type LessonContext } from '../src/engine/helperPayload';
import { planGaps, revealed, maskText } from '../src/lesson/gap';
const LESSONS = LS as Record<string, any[]>;

// все шаги-«Көр» и «Есте сақта» всех уроков, где planGaps закрыл число
const gapped: { skill: string; i: number; step: any; frame: number; gaps: NonNullable<ReturnType<typeof planGaps>>; answer: string; mask: boolean }[] = [];
for (const [skill, steps] of Object.entries(LESSONS)) steps.forEach((step, i) => {
  const gaps = planGaps(skill, i, step);
  if (!gaps) return;
  if (gaps.frames) gaps.frames.forEach((g, k) => { if (g) gapped.push({ skill, i, step, frame: k, gaps, answer: g.answer, mask: !!g.mask }); });
  if (gaps.rule) gapped.push({ skill, i, step, frame: 0, gaps, answer: gaps.rule.gap.answer, mask: false });
});
const ctx = (g: (typeof gapped)[number], more: Partial<LessonContext> = {}): LessonContext => ({ skill: g.skill, title: 'тема', step: g.step, frame: g.frame, gaps: g.gaps, ...more });

describe('режим «урок»: скрытое число не уходит на сервер', () => {
  it('в уроках есть пропуски, среди них с подписью, которая называет ответ', () => {
    expect(gapped.length).toBeGreaterThan(30);
    expect(gapped.some(g => g.mask)).toBe(true);
  });
  it('на реальном шаге: пропуск уходит как ▢, ответа нет ни в одной строке запроса', () => {
    const g = gapped.find(x => x.mask && x.step.type === 'example')!;
    const raw = g.step.frames[g.frame];
    expect(revealed(raw.kz, g.answer)).toBe(true);   // без маски подпись кадра выдала бы число
    const b = lessonPayload(ctx(g), [], undefined);
    const wire = JSON.stringify(b);
    expect(wire).toContain('▢');
    expect(revealed(wire, g.answer)).toBe(false);
    expect(b.mode).toBe('lesson');
    expect(b.step.lines!.at(-1)).toContain('▢');
  });
  it('во всех уроках: ни в одном пропуске (кадр и правило) число не читается в теле запроса', () => {
    const leaks = gapped.filter(g => revealed(JSON.stringify(lessonPayload(ctx(g, { rule: g.step.lines?.join(' ') }), [], undefined)), g.answer));
    expect(leaks.map(g => `${g.skill}#${g.i}/${g.frame}`)).toEqual([]);
  });
  it('вопрос ребёнка и история проходят как есть, скобки подсветки [..] не уходят', () => {
    const g = gapped.find(x => x.step.type === 'example')!;
    const b = lessonPayload(ctx(g), [{ role: 'bit', text: 'a' }, { role: 'kid', text: 'b' }], '  ▢ неге тең?  ');
    expect(b.question).toBe('▢ неге тең?');
    expect(b.history.map(t => t.role)).toEqual(['bit', 'kid']);
    expect([b.step.text, ...b.step.lines!].join(' ')).not.toMatch(/[[\]]/);
  });
  it('когда ребёнок решил пропуск, число не прячется', () => {
    const g = gapped.find(x => x.step.type === 'example')!;
    const wire = JSON.stringify(lessonPayload(ctx(g, { solved: true }), [], undefined).step.lines);
    expect(revealed(wire, g.answer)).toBe(true);
  });
  it('в кадрах после текущего ничего не уходит: только уже виденные кадры', () => {
    const g = gapped.find(x => x.step.type === 'example' && x.frame === 0)!;
    expect(lessonPayload(ctx(g), [], undefined).step.lines).toHaveLength(1);
  });
  it('правило: закрытая строка идёт с ▢, остальные строки целиком', () => {
    const g = gapped.find(x => x.step.type === 'rule')!;
    const lines = lessonPayload(ctx(g), [], undefined).step.lines!;
    expect(lines).toHaveLength(g.step.lines.length);
    expect(lines[g.gaps.rule!.line]).toContain('▢');
    expect(maskText('Пицца 8 тең бөлікке', '8')).toBe('Пицца ▢ тең бөлікке');
  });
});

describe('режим «урок»: верный ответ только после ответа ребёнка', () => {
  const find = (type: string) => { for (const [skill, steps] of Object.entries(LESSONS)) { const i = steps.findIndex(s => s.type === type); if (i >= 0) return { skill, step: steps[i] }; } throw new Error(type); };
  it.each(['predict', 'why', 'final'])('%s: без ответа нет ни верного ответа, ни разбора, ни выбора', type => {
    const { skill, step } = find(type);
    const b = lessonPayload({ skill, title: 't', step }, [], undefined);
    expect(b.step.answered).toBe(false);
    expect(b.step.correct).toBeUndefined();
    expect(b.step.reveal).toBeUndefined();
    expect(b.step.picked).toBeUndefined();
    expect(JSON.stringify(b)).not.toContain(step.why ?? step.reveal);
    expect(b.step.choices).toEqual(step.choices);
  });
  it.each(['predict', 'why', 'final'])('%s: после ответа уходят выбор, верный ответ и разбор', type => {
    const { skill, step } = find(type);
    const wrong = (step.answer + 1) % step.choices.length;
    const b = lessonPayload({ skill, title: 't', step, answered: true, picked: wrong }, [], undefined);
    expect(b.step.correct).toBe(step.choices[step.answer]);
    expect(b.step.picked).toBe(step.choices[wrong]);
    expect(b.step.reveal).toBe(step.reveal ?? step.why);
  });
  it('faded без ответа не отдаёт решение; после ответа — строки с вписанными числами', () => {
    const { skill, step } = find('faded');
    const before = lessonPayload({ skill, title: 't', step }, [], undefined);
    expect(before.step.lines).toBeUndefined();
    const after = lessonPayload({ skill, title: 't', step, answered: true }, [], undefined);
    expect(after.step.lines).toHaveLength(step.steps.length);
    expect(after.step.lines!.join(' ')).not.toContain('▢');
  });
  it('blitz: название и условие игры', () => {
    const { skill, step } = find('blitz');
    expect(lessonPayload({ skill, title: 't', step, answered: true }, [], undefined).step.text).toContain(step.title);
  });
});

describe('режим «урок»: сервер (helper/lesson.mjs)', () => {
  const ok = { mode: 'lesson', step: { type: 'rule', text: 'Есте сақта', lines: ['a'] } };
  it('predict/faded/blitz/final без answered=true — ошибка answer_first, остальные шаги пропускаются', () => {
    expect(ANSWER_FIRST).toEqual(['predict', 'faded', 'blitz', 'final']);
    for (const type of ANSWER_FIRST) {
      expect(checkLesson({ step: { type, text: 'x' } })).toBe('answer_first');
      expect(checkLesson({ step: { type, text: 'x', answered: 'true' } })).toBe('answer_first');
      expect(checkLesson({ step: { type, text: 'x', answered: true } })).toBeNull();
    }
    for (const type of ['example', 'why', 'rule']) expect(checkLesson({ step: { type, text: 'x' } })).toBeNull();
  });
  it('плохие тела отклоняются', () => {
    expect(checkLesson({})).toBe('no_step');
    expect(checkLesson({ step: { type: 'goal', text: 'x' } })).toBe('bad_step');
    expect(checkLesson({ step: { type: 'rule' } })).toBe('no_step');
    expect(LESSON_TYPES).toHaveLength(7);
  });
  it('промпт: шаг, ▢-правило, без верного ответа пока не ответил, история ≤ 3 уточнений', () => {
    const p = lessonPrompt({ ...ok, topic: { skill: 's', title: 'Тема' }, step: { type: 'why', text: 'Неге 8 ▢?', choices: ['a', 'b'], correct: 'SECRET', answered: false },
      history: Array.from({ length: 9 }, (_, k) => ({ role: k % 2 ? 'bit' : 'kid', text: `t${k}` })), question: 'q' });
    const first = p[0].parts[0].text;
    expect(first).toContain('Тема');
    expect(first).toContain('закрытое число ▢');
    expect(first).toContain('ЕЩЁ НЕ ОТВЕТИЛ');
    expect(first).not.toContain('SECRET');
    expect(p).toHaveLength(1 + 6 + 1);
  });
  it('промпт после ответа содержит верный ответ и разбор', () => {
    const first = lessonPrompt({ ...ok, step: { type: 'final', text: 'Задача', choices: ['a', 'b'], answered: true, picked: 'a', correct: 'b', reveal: 'потому что' } })[0].parts[0].text;
    expect(first).toContain('ВЕРНЫЙ ОТВЕТ (уже показан ребёнку): b');
    expect(first).toContain('(неверно)');
    expect(first).toContain('потому что');
  });
});
