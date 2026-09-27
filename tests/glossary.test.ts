import { describe, it, expect } from 'vitest';
import glossary from '../content/glossary.json';
// @ts-ignore
import { templates } from '../content/templates/index.mjs';
// @ts-ignore
import { rng } from '../content/templates/lib.mjs';

const avoid = (glossary as any).terms.flatMap((t: any) => (t.avoid || []).map((a: string) => ({ a, kz: t.kz })));
const find = (text: string) =>
  avoid.filter(({ a }: any) => (a === a.toUpperCase() ? new RegExp(`(^|[^А-Яа-я])${a}([^А-Яа-я]|$)`) : new RegExp(`(^|[^а-яё])${a}`, 'i')).test(text));

describe('казахский текст шаблонов не содержит русских терминов', () => {
  for (const t of templates as any[]) {
    it(t.id, () => {
      const r = rng(11);
      for (let i = 0; i < 40; i++) {
        const it = t.gen(r);
        const text = [it.kz, it.sol.kz, t.title.kz, ...it.choices.map((c: any) => c.text.split(' / ')[0])].join('\n');
        const hits = find(text);
        expect(hits.map((h: any) => `${h.a} → ${h.kz}`), text.slice(0, 200)).toEqual([]);
      }
    });
  }
});
