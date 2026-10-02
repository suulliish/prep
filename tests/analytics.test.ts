import { describe, it, expect } from 'vitest';
import { analyze, flags, reportMarkdown, PLACE_RU } from '../src/engine/analytics';
import { usageDay, blankDay, mergeUsage, KEEP_DAYS, DETAIL_DAYS } from '../src/engine/usage';
import type { Save, Attempt, UsageDay, StepLog } from '../src/engine/types';

const T0 = Date.parse('2026-10-01T04:00:00Z');   // 09:00 по Казахстану (+5)
const att = (day: string, minute: number, o: Partial<Attempt> = {}): Attempt => ({
  at: Date.parse(`${day}T04:00:00Z`) + minute * 60000, day, skill: 'frac.reduce', source: 't', correct: true, hintLevel: 0, honest: true, timeMs: 20000, mode: 'practice', ...o,
});
const step = (type: string, ms: number, need: number, nope = 0, o: Partial<StepLog> = {}): StepLog => ({ at: T0, skill: 'frac.reduce', i: 0, type, ms, need, nope, away: 0, done: true, ...o });

function save(attempts: Attempt[], usage: UsageDay[] = [], extra: Partial<Save> = {}): Save {
  return { version: 1, heroName: 'М', xp: 0, skills: {}, attempts, days: {}, settings: { extraMissionCap: 1, extraTo: 'today', planMinutes: 40 }, diagnosticDone: true, repairShop: [], usage, ...extra };
}

describe('Аналитика: по дням и итоги', () => {
  it('день собирает ответы и поведение; окно 14 дней; диагностика не считается', () => {
    const u = { ...blankDay('2026-10-01'), activeMs: 25 * 60000, sessions: 2, firstAt: T0, lastAt: T0 + 3600000, nope: { 'lesson:rule': 3, review: 1 }, awayMs: 6 * 60000, exits: { lesson: 1 } };
    const a = analyze(save([
      att('2026-10-01', 0), att('2026-10-01', 1, { correct: false, fast: true, honest: false, tag: 'reduce_one' }), att('2026-10-01', 2, { mode: 'diagnostic' }),
      att('2026-09-10', 0),   // вне окна
    ], [u]), { today: '2026-10-02', tzMin: 300 });
    expect(a.from).toBe('2026-09-19');
    expect(a.days).toHaveLength(1);
    const d = a.days[0];
    expect(d).toMatchObject({ day: '2026-10-01', activeMin: 25, sessions: 2, from: '09:00', to: '10:00', answers: 2, correct: 50, honest: 50, fast: 50, guesses: 1, nope: 4, awayMin: 6, exits: 1 });
    expect(a.totals).toMatchObject({ answers: 2, acc: 50, guesses: 1, nope: 4 });
    expect(a.nopeBy[0]).toEqual({ place: 'lesson:rule', label: 'Урок · Правило «Есте сақта»', n: 3 });
  });
  it('шаги урока: медиана, сколько было нужно, во сколько раз дольше читал, ранние нажатия; брошенные шаги не в медиане', () => {
    const u = { ...blankDay('2026-10-01'), steps: [step('rule', 9000, 6000, 1), step('rule', 6600, 6000), step('rule', 30000, 6000, 0, { done: false }), step('widget', 40000, 0)] };
    const a = analyze(save([], [u]), { today: '2026-10-01' });
    const r = a.steps.find(s => s.type === 'rule')!;
    expect(r).toMatchObject({ n: 2, withNope: 1, needSec: 6, readRatio: 1.3 });
    expect(a.steps.find(s => s.type === 'widget')!.readRatio).toBe(0);
  });
  it('темы: слабые сверху, сравнение с прошлым окном; ошибки сгруппированы по метке с названием', () => {
    const list = [
      ...Array.from({ length: 5 }, (_, k) => att('2026-10-01', k, { skill: 'a', correct: k < 1, tag: k < 1 ? undefined : 'x' })),
      ...Array.from({ length: 5 }, (_, k) => att('2026-10-01', 10 + k, { skill: 'b' })),
      ...Array.from({ length: 4 }, (_, k) => att('2026-09-15', k, { skill: 'a' })),
    ];
    const a = analyze(save(list), { today: '2026-10-01', title: s => s.toUpperCase(), mistake: t => `ошибка ${t}` });
    expect(a.skills.map(s => s.skill)).toEqual(['a', 'b']);
    expect(a.skills[0]).toMatchObject({ title: 'A', acc: 20, prevAcc: 100 });
    expect(a.mistakes[0]).toMatchObject({ tag: 'x', name: 'ошибка x', n: 4, skills: ['A'] });
  });
  it('время суток по часовому поясу и усталость от начала занятия', () => {
    const list = [
      ...Array.from({ length: 10 }, (_, k) => att('2026-10-01', k)),                                  // 09:00–09:09, верно
      ...Array.from({ length: 10 }, (_, k) => att('2026-10-01', 50 + k, { correct: k < 3 })),          // 09:50+, 30%
    ];
    const a = analyze(save(list), { today: '2026-10-01', tzMin: 300 });
    expect(a.hours).toEqual([{ label: 'до 12:00', n: 20, acc: 65, fast: 0 }]);
    expect(a.fatigue.map(f => [f.label, f.acc])).toEqual([['0–15 мин', 100], ['45+ мин', 30]]);
    expect(a.flags.some(f => f.startsWith('Устаёт'))).toBe(true);
  });
});

describe('Аналитика: выводы и отчёт', () => {
  it('спешка, пролистывание правил, самоуверенность, уходы — каждый вывод на своих данных', () => {
    const list = Array.from({ length: 20 }, (_, k) => att('2026-10-01', k, { fast: k < 8, correct: k >= 8, honest: k >= 8, confidence: 'sure' }));
    const u = { ...blankDay('2026-10-01'), awayMs: 12 * 60000, exits: { lesson: 3 }, steps: [step('rule', 7000, 6000, 2), step('rule', 7000, 6000, 1), step('rule', 9000, 6000)] };
    const f = analyze(save(list, [u]), { today: '2026-10-01' }).flags.join('\n');
    expect(f).toContain('Спешит: 40%');
    expect(f).toContain('Честных ответов только 60%');
    expect(f).toContain('«Правило «Есте сақта»»: в 67% шагов');
    expect(f).toContain('Самоуверенность');
    expect(f).toContain('Сворачивал приложение посреди задания: 12 мин');
    expect(f).toContain('Выходил из урока или задач на середине: 3 раз');
  });
  it('на малых числах выводов нет', () => {
    const a = analyze(save([att('2026-10-01', 0, { fast: true, correct: false })]), { today: '2026-10-01' });
    expect(flags(a).filter(x => !x.startsWith('Занимался'))).toEqual([]);
  });
  it('отчёт Markdown: заголовок, главное, таблица по дням, темы, память', () => {
    const list = Array.from({ length: 20 }, (_, k) => att('2026-10-01', k, { fast: k < 8, correct: k >= 8 }));
    const md = reportMarkdown(analyze(save(list, [{ ...blankDay('2026-10-01'), events: [{ at: T0, k: 'teach', v: 'got' }] }]), { today: '2026-10-01' }), 'Муртаза');
    expect(md).toContain('# Аналитика · Муртаза · 2026-09-18 — 2026-10-01');
    expect(md).toContain('## Главное');
    expect(md).toContain('| 2026-10-01 |');
    expect(md).toContain('## Темы (слабые сверху)');
    expect(md).toContain('Биткә түсіндір: понял 1');
  });
  it('пустое сохранение не падает', () => {
    const a = analyze(save([]), { today: '2026-10-01' });
    expect(a.days).toEqual([]);
    expect(reportMarkdown(a)).toContain('Ответов: 0');
    expect(PLACE_RU('review')).toBe('Разбор ошибки');
  });
});

describe('Поведение: хранение по дням', () => {
  it('день создаётся один раз; старше KEEP_DAYS удаляется, старше DETAIL_DAYS — без подробностей', () => {
    const list: UsageDay[] = [];
    const old = { ...blankDay('2025-01-01') };
    const mid = { ...blankDay('2026-04-01'), steps: [step('rule', 1, 1)], events: [{ at: 0, k: 'x' }] };
    list.push(old, mid);
    const d = usageDay(list, '2026-10-02');
    expect(usageDay(list, '2026-10-02')).toBe(d);
    expect(list.map(x => x.day)).toEqual(['2026-04-01', '2026-10-02']);
    expect(list[0].steps).toEqual([]);
    expect(list[0].events).toEqual([]);
    expect(KEEP_DAYS).toBeGreaterThan(DETAIL_DAYS);
  });
  it('слияние с облаком: по дню побеждает запись с большим активным временем', () => {
    const a = [{ ...blankDay('2026-10-01'), activeMs: 5 }, { ...blankDay('2026-10-02'), activeMs: 9 }];
    const b = [{ ...blankDay('2026-10-01'), activeMs: 7 }, { ...blankDay('2026-09-30'), activeMs: 1 }];
    expect(mergeUsage(a, b).map(d => [d.day, d.activeMs])).toEqual([['2026-09-30', 1], ['2026-10-01', 7], ['2026-10-02', 9]]);
  });
});

describe('Скрипт отчёта (scripts/analytics/report.mjs)', () => {
  it('Node запускает его на файле-копии и печатает тот же отчёт', async () => {
    const { execFileSync } = await import('node:child_process');
    const { writeFileSync, mkdtempSync } = await import('node:fs');
    const { join } = await import('node:path');
    const { tmpdir } = await import('node:os');
    const f = join(mkdtempSync(join(tmpdir(), 'an-')), 'save.json');
    writeFileSync(f, JSON.stringify(save(Array.from({ length: 5 }, (_, k) => att('2026-10-01', k)))));
    const out = execFileSync(process.execPath, ['scripts/analytics/report.mjs', f, '--days', '7'], { encoding: 'utf8' });
    expect(out).toContain('# Аналитика · М · 2026-09-25 — 2026-10-01');
    expect(out).toContain('Ответов: 5, верно 100%');
  });
});
