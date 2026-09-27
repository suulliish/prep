// Глобальное состояние: сохранение прогресса (localStorage + файл-копия), навигация.
// Firebase-синхронизация добавится в M1 поверх этого же объекта.
import type { Save } from '../engine/types';
import { refreshAvailability, type SkillDef } from '../engine/progress';
import { today } from '../engine/dates';
// @ts-ignore — граф навыков на JS
import { skills as SKILLS } from '../../content/skills.mjs';

export const skillDefs = SKILLS as (SkillDef & { title: { kz: string; ru: string }; figure: boolean })[];
const KEY = 'razlom.save.v1';

function fresh(): Save {
  return {
    version: 1, heroName: 'Кодер', xp: 0, skills: {}, attempts: [], days: {},
    settings: { extraMissionCap: 4, extraTo: 'today', planMinutes: 40 },
    diagnosticDone: false, repairShop: [],
  };
}

function load(): Save {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...fresh(), ...JSON.parse(raw) };
  } catch { /* приватный режим или испорченные данные */ }
  return fresh();
}

export type Screen =
  | { name: 'hub' }
  | { name: 'session'; block: 'warmup' | 'new' | 'mixed' | 'extra' | 'boss' }
  | { name: 'lesson'; skill: string }
  | { name: 'summary' }
  | { name: 'diagnostic' }
  | { name: 'album' }
  | { name: 'sound' };

export const game = $state({
  save: load(),
  screen: { name: 'hub' } as Screen,
  day: today(),
});

refreshAvailability(game.save, skillDefs);

export function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(game.save)); } catch { /* нет места/доступа */ }
}

export function go(screen: Screen) { game.screen = screen; }

export function exportSave(): string { return JSON.stringify(game.save, null, 1); }
export function importSave(json: string) {
  const data = JSON.parse(json);
  if (data?.version !== 1) throw new Error('Бұл файл сақталған прогресс емес');
  game.save = { ...fresh(), ...data };
  refreshAvailability(game.save, skillDefs);
  persist();
}

// Уровень героя из XP: каждый следующий уровень чуть дороже
export function levelOf(xp: number) {
  let lvl = 1, need = 100, left = xp;
  while (left >= need) { left -= need; lvl++; need = Math.round(need * 1.15); }
  return { lvl, into: left, need };
}
