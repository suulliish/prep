// Кнопка ИИ-помощника в уроке: когда видна и когда разговор сбрасывается (src/lesson/helperGate.ts).
import { describe, it, expect } from 'vitest';
// @ts-ignore
import { LESSONS } from '../content/lessons.mjs';
import { helperVisible, helperKey } from '../src/lesson/helperGate';

describe('helperVisible', () => {
  it('example, why, rule: всегда', () => {
    for (const t of ['example', 'why', 'rule']) {
      expect(helperVisible(t, undefined), t).toBe(true);
      expect(helperVisible(t, false), t).toBe(true);
      expect(helperVisible(t, true), t).toBe(true);
    }
  });
  it('predict, faded, blitz, final: только после ответа (answered строго true)', () => {
    for (const t of ['predict', 'faded', 'blitz', 'final']) {
      expect(helperVisible(t, undefined), t).toBe(false);
      expect(helperVisible(t, false), t).toBe(false);
      expect(helperVisible(t, true), t).toBe(true);
    }
  });
  it('goal, widget, bug, say и неизвестное: никогда', () => {
    for (const t of ['goal', 'widget', 'bug', 'say', 'nope', '', undefined]) {
      expect(helperVisible(t as any, true), String(t)).toBe(false);
      expect(helperVisible(t as any, false), String(t)).toBe(false);
    }
  });
  it('типы шагов реальных уроков: видимость зависит только от типа и ответа', () => {
    const types = new Set<string>();
    for (const steps of Object.values(LESSONS) as any[][]) for (const s of steps) types.add(s.type);
    expect(types.size).toBeGreaterThan(5);
    for (const t of types) {
      const always = ['example', 'why', 'rule'].includes(t), after = ['predict', 'faded', 'blitz', 'final'].includes(t);
      expect(helperVisible(t, false), t).toBe(always);
      expect(helperVisible(t, true), t).toBe(always || after);
    }
  });
});

describe('helperKey', () => {
  const step = { type: 'example', kz: 'Мысал' };
  it('тот же шаг и кадр: тот же ключ; другой кадр или шаг: другой', () => {
    expect(helperKey({ step, frame: 1 })).toBe(helperKey({ step: { ...step }, frame: 1 }));
    expect(helperKey({ step, frame: 1 })).not.toBe(helperKey({ step, frame: 2 }));
    expect(helperKey({ step, frame: 0 })).not.toBe(helperKey({ step: { type: 'rule', kz: 'Мысал' }, frame: 0 }));
    expect(helperKey({ step, frame: 0 })).not.toBe(helperKey({ step: { type: 'example', kz: 'Басқа' }, frame: 0 }));
  });
  it('без frame и без kz ключ считается', () => {
    expect(helperKey({ step: { type: 'why' } })).toBe('why::0');
  });
});
