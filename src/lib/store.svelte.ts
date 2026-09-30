// Глобальное состояние: сохранение прогресса (localStorage + файл-копия), навигация.
// Firebase-синхронизация добавится в M1 поверх этого же объекта.
import type { Save } from '../engine/types';
import { refreshAvailability, type SkillDef } from '../engine/progress';
import { today } from '../engine/dates';
// @ts-ignore — граф навыков на JS
import { skills as SKILLS } from '../../content/skills.mjs';
// @ts-ignore
import { LESSONS } from '../../content/lessons.mjs';

// lesson — есть полный урок-миссия (с целью); только такие темы планировщик даёт как новые
export const skillDefs = (SKILLS as (SkillDef & { title: { kz: string; ru: string }; figure: boolean })[])
  .map(d => ({ ...d, lesson: !!(LESSONS as Record<string, any[]>)[d.id]?.some(s => s.type === 'goal') }));
const KEY = 'razlom.save.v1';

function fresh(): Save {
  return {
    version: 1, heroName: 'Муртаза', xp: 0, skills: {}, attempts: [], days: {},
    settings: { extraMissionCap: 4, extraTo: 'today', planMinutes: 40 },
    diagnosticDone: false, repairShop: [],
    coins: 0, shipOwned: [], shipPet: null,   // старые сохранения без этих полей получают их из fresh() при загрузке
  };
}

function load(): Save {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = { ...fresh(), ...JSON.parse(raw) };
      if (s.heroName === 'Кодер') s.heroName = 'Муртаза'; // старое имя-заглушка
      return s;
    }
  } catch { /* приватный режим или испорченные данные */ }
  return fresh();
}

export type Screen =
  | { name: 'hub' }
  | { name: 'session'; block: 'warmup' | 'new' | 'mixed' | 'extra' | 'boss' | 'repair' }
  | { name: 'lesson'; skill: string; replay?: boolean }
  | { name: 'summary' }
  | { name: 'diagnostic' }
  | { name: 'album' }
  | { name: 'sound' }
  | { name: 'commander' }
  | { name: 'map' }
  | { name: 'hero' }
  | { name: 'workshop' }
  | { name: 'intro' };

export const game = $state({
  save: load(),
  screen: { name: 'hub' } as Screen,
  day: today(),
});

refreshAvailability(game.save, skillDefs);
// первый запуск — вступление-история
if (!game.save.introSeen && !game.save.diagnosticDone) game.screen = { name: 'intro' };

/** Подписчики на сохранение (облачная синхронизация, src/lib/cloud.svelte.ts). */
export const afterPersist: (() => void)[] = [];

export function persist() {
  game.save.updatedAt = Date.now();
  try { localStorage.setItem(KEY, JSON.stringify(game.save)); } catch { /* нет места/доступа */ }
  afterPersist.forEach(f => f());
}

/** Заменить сохранение целиком (импорт файла или загрузка из облака). Прежнее кладётся в резервную копию. */
export function replaceSave(data: Save, keepTime = false) {
  try { localStorage.setItem(KEY + '.before-replace', JSON.stringify(game.save)); } catch { /* */ }
  const t = data.updatedAt;
  game.save = { ...fresh(), ...data };
  if (game.save.heroName === 'Кодер') game.save.heroName = 'Муртаза';
  refreshAvailability(game.save, skillDefs);
  try { localStorage.setItem(KEY, JSON.stringify(game.save)); } catch { /* */ }
  if (keepTime) game.save.updatedAt = t; else persist();
}

export function go(screen: Screen) { game.screen = screen; }

export function exportSave(): string { return JSON.stringify(game.save, null, 1); }
export function importSave(json: string) {
  const data = JSON.parse(json);
  if (data?.version !== 1) throw new Error('Бұл файл сақталған прогресс емес');
  replaceSave(data);
}

// Уровень героя из XP: каждый следующий уровень чуть дороже
export function levelOf(xp: number) {
  let lvl = 1, need = 100, left = xp;
  while (left >= need) { left -= need; lvl++; need = Math.round(need * 1.15); }
  return { lvl, into: left, need };
}

// PIN командира хранится как SHA-256 (не в открытом виде)
export async function hashPin(pin: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('razlom:' + pin));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

export function downloadSave() {
  const blob = new Blob([exportSave()], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = `razlom-progress-${game.day}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  game.save.lastBackup = game.day; persist();
}

/** Просим браузер не удалять данные сайта при нехватке места (без облака это главная защита). */
export async function protectStorage(): Promise<boolean> {
  try { return (await navigator.storage?.persisted?.()) || !!(await navigator.storage?.persist?.()); } catch { return false; }
}
/** Сколько дней без копии в файл (null — копии не было). */
export function daysSinceBackup(): number | null {
  if (!game.save.lastBackup) return null;
  return Math.round((Date.parse(game.day) - Date.parse(game.save.lastBackup)) / 864e5);
}
