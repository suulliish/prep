// Глобальное состояние: сохранение прогресса (localStorage + файл-копия), навигация.
// Firebase-синхронизация добавится в M1 поверх этого же объекта.
import type { Save } from '../engine/types';
import { localJson } from '../engine/sync';
import { refreshAvailability, fixMissingDue, type SkillDef } from '../engine/progress';
import { today } from '../engine/dates';
import { ensureLegacy } from '../engine/legacy';
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
    settings: { extraMissionCap: 1, extraTo: 'today', planMinutes: 40 },
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
      // доп. миссий в день не больше одной (+15 мин): старые сохранения хранили 4
      if (s.settings && s.settings.extraMissionCap > 1) s.settings = { ...s.settings, extraMissionCap: 1 };
      try { ensureLegacy(s, today()); } catch { /* снимок не важнее загрузки */ }   // снимок открытого: только растёт (src/engine/legacy.ts)
      return s;
    }
  } catch {
    // испорченные данные: сырую строку не теряем (следующее сохранение её бы затёрло), облако пустое устройство не перезапишет (src/engine/sync.ts)
    try { const raw = localStorage.getItem(KEY); if (raw) localStorage.setItem(KEY + '.corrupt', raw); } catch { /* приватный режим */ }
  }
  return fresh();
}

export type Screen =
  | { name: 'hub' }
  // asExtra: ремонт вместо доп. миссии (на корабле ≥ 3 поломок) — починил 3, получил её +15 минут
  | { name: 'session'; block: 'warmup' | 'new' | 'mixed' | 'extra' | 'boss' | 'repair'; asExtra?: boolean }
  | { name: 'lesson'; skill: string; replay?: boolean }
  | { name: 'summary' }
  | { name: 'diagnostic' }
  | { name: 'album'; tab?: 'cards' | 'notebook' | 'repair' }
  | { name: 'sound' }
  | { name: 'commander' }
  | { name: 'map' }
  | { name: 'hero' }
  | { name: 'workshop' }
  | { name: 'recall' }
  | { name: 'intro' };

export const game = $state({
  save: load(),
  screen: { name: 'hub' } as Screen,
  day: today(),
});

refreshAvailability(game.save, skillDefs);
fixMissingDue(game.save, game.day);   // темы скана без срока проверки (баг диагностики до 02.10)

/** Новый день, пока приложение открыто (PWA висит в фоне через полночь): день меняется при возвращении в приложение.
 *  На экранах без задания — перезагрузка (план, «Еске түсір», серия собираются заново); посреди задания — только дата, план соберётся на корабле. */
export function checkNewDay() {
  const d = today();
  if (d === game.day) return;
  game.day = d;
  if (!['lesson', 'session', 'recall', 'diagnostic'].includes(game.screen.name) && typeof location !== 'undefined') location.reload();
}
if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') checkNewDay(); });
  setInterval(() => { if (document.visibilityState === 'visible') checkNewDay(); }, 60000);
}
// первый запуск — вступление-история
if (!game.save.introSeen && !game.save.diagnosticDone) game.screen = { name: 'intro' };

/** Подписчики на сохранение (облачная синхронизация, src/lib/cloud.svelte.ts). */
export const afterPersist: (() => void)[] = [];

/** Место в браузере кончилось (запись не удалась): Hub и командир показывают предупреждение. */
export const storage = $state({ full: false });

/** Запись в localStorage; не вышло (переполнение) — флаг storage.full, прогресс остаётся в памяти и в облаке. */
function writeLocal(key: string, json: string): boolean {
  try { localStorage.setItem(key, json); storage.full = false; return true; }
  catch (e: any) { if (e?.name === 'QuotaExceededError' || e?.code === 22 || e?.code === 1014) storage.full = true; return false; }
}

/** Записать на устройство без отправки в облако и без смены времени изменения (данные пришли из облака). */
export function persistLocal() { writeLocal(KEY, localJson(game.save)); }

export function persist() {
  try { ensureLegacy(game.save, game.day); } catch { /* снимок не важнее сохранения */ }   // открылось новое — сразу в снимок, чтобы потом не закрылось
  game.save.updatedAt = Date.now();
  writeLocal(KEY, localJson(game.save));
  afterPersist.forEach(f => f());
}

/** Заменить сохранение целиком (импорт файла или загрузка из облака). Прежнее кладётся в резервную копию. */
export function replaceSave(data: Save, keepTime = false) {
  // три последние заменённые копии: .before-replace (самая свежая), .before-replace.2, .before-replace.3
  // большие копии (больше 1 млн знаков) — только одна: три полные копии съели бы всё место браузера
  try {
    const cur = localJson(game.save);
    const p1 = localStorage.getItem(KEY + '.before-replace'), p2 = localStorage.getItem(KEY + '.before-replace.2');
    if (cur.length < 1_000_000) {
      if (p2) localStorage.setItem(KEY + '.before-replace.3', p2);
      if (p1) localStorage.setItem(KEY + '.before-replace.2', p1);
    } else { localStorage.removeItem(KEY + '.before-replace.2'); localStorage.removeItem(KEY + '.before-replace.3'); }
    localStorage.setItem(KEY + '.before-replace', cur);
  } catch { /* место кончилось — без резервной копии */ }
  const t = data.updatedAt;
  game.save = { ...fresh(), ...data };
  if (game.save.heroName === 'Кодер') game.save.heroName = 'Муртаза';
  refreshAvailability(game.save, skillDefs);
  fixMissingDue(game.save, game.day);
  try { ensureLegacy(game.save, game.day); } catch { /* без снимка */ }
  writeLocal(KEY, localJson(game.save));
  if (keepTime) game.save.updatedAt = t; else persist();
}

export function go(screen: Screen) { game.screen = screen; }

export function exportSave(): string { return JSON.stringify(game.save, null, 1); }
export function importSave(json: string) {
  const data = JSON.parse(json);
  if (data?.version !== 1) throw new Error('Бұл файл сақталған прогресс емес');
  replaceSave(data);
}

// Уровень героя из XP — src/engine/level.ts (там же его считает симулятор систем)
export { levelOf } from '../engine/level';

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
