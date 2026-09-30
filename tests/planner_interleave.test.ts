import { describe, it, expect } from 'vitest';
import { sequenceSlots, tplClashes, buildPlan } from '../src/engine/planner';
import { refreshAvailability } from '../src/engine/progress';
import { rng } from '../content/templates/lib.mjs';
// @ts-ignore
import { skills as SKILLS } from '../content/skills.mjs';
import type { Save } from '../src/engine/types';

const S = (SKILLS as any[]).filter(s => s.templates?.length);
const tplOf = (id: string) => S.find(s => s.id === id)?.templates ?? [];
const multi = S.filter(s => s.templates.length >= 2).map(s => s.id);
const R = rng(42);
const pickSome = (pool: string[], n: number) => R.shuffle(pool).slice(0, n);

describe('D5: чередование в бою', () => {
  it('одна тема с несколькими шаблонами: два подряд одного шаблона не бывает, шаблоны используются поровну', () => {
    for (const id of multi) for (const total of [6, 8, 10]) {
      const seq = sequenceSlots([id], total, tplOf, R.next);
      expect(seq).toHaveLength(total);
      expect(tplClashes(seq), `${id} × ${total}`).toBe(0);
      const cnt = new Map<string, number>();
      for (const s of seq) cnt.set(s.tpl!, (cnt.get(s.tpl!) ?? 0) + 1);
      const k = tplOf(id).length, vals = [...cnt.values()];
      expect(Math.max(...vals) - (cnt.size === k ? Math.min(...vals) : 0)).toBeLessThanOrEqual(1);
    }
  });
  it('смешанный набор реальных тем (1000 случайных боёв): подряд нет одного шаблона, тем не меньше 3, круг тем соблюдён', () => {
    for (let k = 0; k < 1000; k++) {
      const n = 3 + Math.floor(R.next() * 5);
      const ids = pickSome(S.map(s => s.id), n);
      const total = [6, 8, 10][k % 3];
      const seq = sequenceSlots(ids, total, tplOf, R.next);
      expect(seq).toHaveLength(total);
      // стык возможен только если у обеих соседних тем единственный общий шаблон — тогда его чинит перестановка; проверяем, что стыков нет там, где их можно избежать
      const distinctTpl = new Set(ids.flatMap(tplOf)).size;
      if (distinctTpl >= 2 && ids.length >= 2) expect(tplClashes(seq), ids.join()).toBe(0);
      expect(new Set(seq.map(s => s.skill)).size).toBe(Math.min(ids.length, total));
      for (const s of seq) expect(tplOf(s.skill)).toContain(s.tpl);
    }
  });
  it('в смешанном бою ≥ 3 разных тем, если они есть', () => {
    const ids = multi.slice(0, 5);
    const seq = sequenceSlots(ids, 8, tplOf);
    expect(new Set(seq.map(s => s.skill)).size).toBeGreaterThanOrEqual(3);
    expect(new Set(sequenceSlots(ids.slice(0, 2), 8, tplOf).map(s => s.skill)).size).toBe(2);   // тем всего 2 — больше не взять
  });
  it('единственная тема с единственным шаблоном: подряд неизбежно, но очередь всё равно собирается', () => {
    const one = S.find(s => s.templates.length === 1)!.id;
    const seq = sequenceSlots([one], 5, tplOf);
    expect(seq.map(s => s.tpl)).toEqual(Array(5).fill(tplOf(one)[0]));
  });
  it('общий шаблон у соседних тем (искусственный случай) разводится перестановкой', () => {
    const map: Record<string, string[]> = { a: ['x'], b: ['x'], c: ['y'], d: ['z'] };
    for (let k = 0; k < 200; k++) {
      const seq = sequenceSlots(['a', 'b', 'c', 'd'], 8, s => map[s], R.next);
      expect(tplClashes(seq)).toBe(0);
    }
  });
  it('тема без шаблонов пропускается; пустой список — пустая очередь', () => {
    expect(sequenceSlots(['none', multi[0]], 4, id => (id === 'none' ? [] : tplOf(id))).every(s => s.skill === multi[0])).toBe(true);
    expect(sequenceSlots([], 5, tplOf)).toEqual([]);
  });
});

describe('D5: смешанный бой в плане дня', () => {
  const newSave = (): Save => ({ version: 1, heroName: 'К', xp: 0, skills: {}, attempts: [], days: {}, settings: { extraMissionCap: 4, extraTo: 'today', planMinutes: 40 }, diagnosticDone: false, repairShop: [] });
  it('пройдено ≥ 3 темы — в «Аралас шайқас» не меньше 3', () => {
    const defs = ['a', 'b', 'c', 'd', 'e'].map((id, i) => ({ id, prereqs: i ? [['a', 'b', 'c', 'd', 'e'][i - 1]] : [], weight: 3, cat: 'C', grade: 5, templates: ['t' + id] }));
    const s = newSave(); refreshAvailability(s, defs as any);
    for (const id of ['a', 'b', 'c', 'd']) s.skills[id] = { ...s.skills[id], status: 'learned', p: 0.9, lessonDone: true, attempts: 5, correct: 5, misconceptions: {}, stage: 0, due: '2026-10-20' } as any;
    refreshAvailability(s, defs as any);
    const mixed = buildPlan(s, defs as any, '2026-10-20').blocks.find(b => b.id === 'mixed');
    expect(mixed?.skills.length).toBeGreaterThanOrEqual(3);
  });
});
