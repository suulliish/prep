// Озвучка уроков: каждый id из списка имеет mp3; голос правила с пропуском не называет закрытое число; в текст для Piper не попадают цифры и разметка.
import { describe, it, expect } from 'vitest';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
// @ts-ignore
import { LESSONS } from '../content/lessons.mjs';
// @ts-ignore
import VOICED from '../content/voice_lessons.json';
// @ts-ignore — скрипт на JS
import { buildLines, numeralLeak, UNKNOWN, speakable } from '../scripts/voice/lesson-lines.mjs';
import { planGaps } from '../src/lesson/gap';

const DIR = join(__dirname, '..', 'public', 'voice', 'lessons');
const ids = VOICED as string[];
const lines: { id: string; kz: string }[] = buildLines(LESSONS, planGaps);
const byId = new Map(lines.map(l => [l.id, l.kz]));

describe('список озвученного (content/voice_lessons.json)', () => {
  it('без повторов и отсортирован', () => {
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual([...ids].sort());
  });
  it('каждый id имеет непустой mp3 разумной длины (64 кбит/с: 0,3–60 с)', () => {
    for (const id of ids) {
      const f = join(DIR, id + '.mp3');
      expect(existsSync(f), `нет файла ${id}.mp3`).toBe(true);
      const sec = statSync(f).size / 8000;
      expect(sec, `${id}: длительность ≈ ${sec.toFixed(1)} с`).toBeGreaterThan(0.3);
      expect(sec, `${id}: длительность ≈ ${sec.toFixed(1)} с`).toBeLessThan(60);
    }
  });
  it('в папке нет лишних mp3 (каждый файл есть в списке)', () => {
    const listed = new Set(ids);
    const extra = readdirSync(DIR).filter(f => f.endsWith('.mp3') && !listed.has(f.slice(0, -4)));
    expect(extra).toEqual([]);
  });
  it('все реплики, которые собирает lesson-lines.mjs, озвучены, и наоборот', () => {
    expect(ids).toEqual(lines.map(l => l.id).sort());
  });
});

describe('текст, который уходит в Piper', () => {
  it('все шаги озвученных типов собраны; id вида <skill>_<i>[_f<k>|_why|_reveal|_full]', () => {
    for (const { id } of lines) expect(id, id).toMatch(/^[a-z_]+\.[a-z_0-9]+_\d+(?:_f\d+|_why|_reveal|_full)?$/);
    for (const [skill, steps] of Object.entries(LESSONS as Record<string, any[]>)) {
      steps.forEach((s, i) => {
        const id = `${skill}_${i}`;
        if (['goal', 'widget', 'faded', 'bug', 'rule', 'why', 'predict', 'final'].includes(s.type)) expect(byId.has(id), id).toBe(true);
        if (s.type === 'predict') expect(byId.has(`${id}_reveal`), `${id}_reveal`).toBe(true);
        if (s.type === 'why') expect(byId.has(`${id}_why`), `${id}_why`).toBe(true);
        if (s.type === 'final' && s.why) expect(byId.has(`${id}_why`), `${id}_why`).toBe(true);
      });
    }
  });
  it('нет цифр, «[ ]», «▢», LaTeX, markdown, латиницы и слова undefined; текст не пустой', () => {
    for (const { id, kz } of lines) {
      expect(kz.trim().length, `${id}: пусто`).toBeGreaterThan(5);
      expect(kz, `${id}: цифры`).not.toMatch(/\d/);
      expect(kz, `${id}: скобки подсветки или пропуск`).not.toMatch(/[\[\]▢]/);
      expect(kz, `${id}: LaTeX/markdown`).not.toMatch(/[\\$`#*_{}^~|]/);
      expect(kz, `${id}: латиница (Piper её молча пропускает)`).not.toMatch(/[A-Za-z]/);
      expect(kz, `${id}: «undefined»`).not.toMatch(/undefined|NaN/);
      expect(kz, `${id}: знаки, которые Piper не произносит`).not.toMatch(/[×≤≥≈∩∪²³ⁿ−–+=<>/→≠]/);
    }
  });
});

describe('правила с пропуском: голос до решения не называет ответ', () => {
  const cases: { skill: string; i: number; answer: string; line: number }[] = [];
  for (const [skill, steps] of Object.entries(LESSONS as Record<string, any[]>)) {
    steps.forEach((s, i) => {
      const g = s.type === 'rule' ? planGaps(skill, i, s)?.rule : null;
      if (g) cases.push({ skill, i, answer: g.gap.answer, line: g.line });
    });
  }
  it('есть хотя бы одно правило с пропуском (иначе проверка пустая)', () => expect(cases.length).toBeGreaterThan(5));
  for (const c of cases) {
    const id = `${c.skill}_${c.i}`;
    it(`${id}: база без ответа «${c.answer}», полная версия отдельно`, () => {
      const base = byId.get(id)!, full = byId.get(`${id}_full`)!;
      expect(full, `нет ${id}_full`).toBeTruthy();
      expect(base).toContain(UNKNOWN);
      expect(full).not.toContain(UNKNOWN);
      expect(numeralLeak(base, c.answer), `база называет ответ ${c.answer}: «${base}»`).toBeNull();
      expect(ids).toContain(`${id}_full`);
    });
  }
  it('у правил без пропуска версии _full нет', () => {
    const gapped = new Set(cases.map(c => `${c.skill}_${c.i}`));
    for (const [skill, steps] of Object.entries(LESSONS as Record<string, any[]>)) {
      steps.forEach((s, i) => { if (s.type === 'rule' && !gapped.has(`${skill}_${i}`)) expect(byId.has(`${skill}_${i}_full`), `${skill}_${i}`).toBe(false); });
    }
  });
});

describe('numeralLeak: цифры и казахские числительные', () => {
  it('находит цифрой, словом, составным числом и классом с нулями', () => {
    expect(numeralLeak('ЕҮОБ = 1 болса', '1')).toBe('1');
    expect(numeralLeak('бір цифр', '1')).toBe('бір');
    expect(numeralLeak('бесінші күн', '5')).toBe('бесінші');
    expect(numeralLeak('жүз сексен тоғыз цифр', '189')).toBe('жүз сексен тоғыз');
    expect(numeralLeak('төрт миллион отыз мың бес', '030')).toBe('отыз');
    expect(numeralLeak('7 245 саны', '7245')).toBe('7245');
  });
  it('не путает число с частью более крупного и с однокоренными словами', () => {
    expect(numeralLeak('он екі рет сияды', '2')).toBeNull();
    expect(numeralLeak('екі жүз қырық', '2')).toBeNull();
    expect(numeralLeak('бірақ бірдей бірлік', '1')).toBeNull();
    expect(numeralLeak('18 және 180', '8')).toBeNull();
  });
});

describe('speakable: знаки и латиница читаются словами', () => {
  it('×, ≤, степени, диапазоны, переменные, суффиксы чисел', () => {
    expect(speakable('4 × 4')).toBe('төрт көбейту төрт');
    expect(speakable('0 ≤ r < b')).toBe('нөл кіші немесе тең эр кіші бэ');
    expect(speakable('k²')).toBe('ка квадрат');
    expect(speakable('1–30 аралығында')).toBe('бірден отызға дейін аралығында');
    expect(speakable('1 000 000 015 саны 5-ке')).toBe('бір миллиард он бес саны беске');
    expect(speakable('5-тер және 2-лер')).toBe('бестер және екілер');
    expect(speakable('3/8 = ?/24')).toBe('сегізден үш тең жиырма төрттен белгісіз сан');
    expect(speakable('8:00-де')).toBe('сағат сегізде');
    expect(speakable('A ∩ B')).toBe('а қиылысу бэ');
  });
});
