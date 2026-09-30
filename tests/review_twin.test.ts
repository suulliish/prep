import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
// @ts-ignore
import { templates } from '../content/templates/index.mjs';
// @ts-ignore
import { rng } from '../content/templates/lib.mjs';
// @ts-ignore
import { skillById } from '../content/skills.mjs';
import { makeItem, type Item } from '../src/engine/items';
import { makeTwin, tplOf } from '../src/engine/twin';
import { buildReview, whyCards } from '../src/engine/review';

const R = rng(42);
const fromTpl = (t: any): Item => { const it = t.gen(R); return { source: t.id, skill: Object.keys(skillById).find(k => skillById[k].templates?.includes(t.id)) ?? 'x', kz: it.kz, ru: it.ru, choices: it.choices, answer: it.answer, hints: [], sol: it.sol, figure: it.figure }; };
const withSkill = (templates as any[]).filter(t => Object.values(skillById as Record<string, any>).some(s => s.templates?.includes(t.id)));

describe('задача-близнец вместо повтора', () => {
  it('у каждого шаблона близнец — другая задача того же шаблона и навыка (не тот же текст)', () => {
    let same = 0, n = 0;
    for (const t of withSkill) {
      for (let k = 0; k < 3; k++) {
        const prev = fromTpl(t), tw = makeTwin(prev);
        expect(tw, t.id).not.toBeNull();
        expect(tw!.skill).toBe(prev.skill);
        n++; if (tw!.kz === prev.kz) same++;
      }
    }
    // шаблоны с крошечным числом вариантов могут совпасть после 6 попыток; таких единицы
    expect(same / n).toBeLessThan(0.02);
  }, 60000);
  it('близнец берёт шаблон ошибки', () => {
    const t = withSkill.find(x => Object.values(skillById as Record<string, any>).some(s => s.templates?.length === 1 && s.templates[0] === x.id));
    if (!t) return;
    const prev = fromTpl(t);
    expect(tplOf(makeTwin(prev)!)).toBe(t.id);
  });
  it('в бою нет второй попытки той же задачи: secondTry, retry и зачёркивание убраны из экрана', () => {
    const s = readFileSync('src/screens/Session.svelte', 'utf8');
    expect(s).not.toMatch(/secondTry|function retry|struck|'retry'/);
    expect(s).toContain('makeTwin(');
    expect(s).not.toMatch(/Тағы көр/);
  });
  it('Session не показывает кнопок уверенности внизу экрана (footer только на итоге боя)', () => {
    const s = readFileSync('src/screens/Session.svelte', 'utf8');
    expect(s).toContain('footer={result ? resultFoot : undefined}');
    expect(s).not.toMatch(/Жауапты таңда/);
  });
});

describe('разбор: действие, а не чтение', () => {
  it('для неверного ответа всегда есть задание, а верное объяснение в карточках ровно одно', () => {
    const kinds: Record<string, number> = {};
    for (const t of withSkill) {
      const it = fromTpl(t);
      const wrong = it.choices.findIndex((_, i) => i !== it.answer);
      const rv = buildReview(it, wrong, 'error');
      kinds[rv.kind] = (kinds[rv.kind] ?? 0) + 1;
      if (rv.kind === 'why') { expect(rv.cards.length).toBeGreaterThanOrEqual(2); expect(rv.cards.filter(c => c.ok).length).toBe(1); expect(new Set(rv.cards.map(c => c.text)).size).toBe(rv.cards.length); }
      if (rv.kind === 'find') { expect(rv.turn.lines.length).toBeGreaterThanOrEqual(3); expect(rv.turn.bad).toBeGreaterThanOrEqual(0); expect(rv.turn.lines[rv.turn.bad]).not.toBe(rv.turn.good[rv.turn.bad]); }
      if (rv.kind === 'gap') { expect(rv.gap.options).toContain(rv.gap.answer); expect(rv.gap.options.length).toBe(3); }
    }
    expect(Object.keys(kinds).length).toBeGreaterThanOrEqual(3);   // и «найди строку», и карточки, и пропуск встречаются
  }, 60000);
  it('«найди строку» испорчена именно ответом ребёнка', () => {
    let seen = 0;
    for (const t of withSkill) {
      const it = fromTpl(t);
      for (let i = 0; i < it.choices.length; i++) {
        if (i === it.answer) continue;
        const rv = buildReview(it, i, 'error');
        if (rv.kind === 'find') { seen++; expect(rv.your).toBe(it.choices[i].text.split(' / ')[0].trim()); expect(rv.turn.lines.join(' ')).toContain(rv.turn.wrong); }
      }
    }
    expect(seen).toBeGreaterThan(20);
  }, 60000);
  it('«білмеймін» и быстрый ответ не получают «найди свою ошибку»', () => {
    for (const t of withSkill.slice(0, 40)) {
      const it = fromTpl(t);
      for (const mode of ['dunno', 'fast'] as const) { const rv = buildReview(it, null, mode); expect(['gap', 'check', 'read']).toContain(rv.kind); }
    }
  });
  it('whyCards: верный выбор (метка не из словаря) — нет карточек', () => {
    const it = makeItem('nat.place_value')!;
    expect(whyCards(it, it.answer)).toBeNull();
  });
});
