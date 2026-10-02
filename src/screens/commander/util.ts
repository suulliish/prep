// Общие мелочи вкладок командира (K0, 02.10: экран разнесён по вкладкам без изменения поведения).
import { game, skillDefs } from '../../lib/store.svelte';

export const dm = (d: string) => `${d.slice(8, 10)}.${d.slice(5, 7)}`;
export const secs = (ms: number) => (ms / 1000).toFixed(ms < 10000 ? 1 : 0);
export const skillRu = (id: string) => skillDefs.find(d => d.id === id)?.title.ru ?? id;
export const dayName = (d: string) => (d === game.day ? 'сегодня' : dm(d));
export const fmtTime = (t: number) => (t ? new Date(t).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');
/** Модуль облака грузится лениво (Firebase — отдельный кусок сайта). */
export type CloudMod = typeof import('../../lib/cloud.svelte');
