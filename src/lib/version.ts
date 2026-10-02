// Версия сборки и устройство (02.10, docs/systems/IMPLEMENTATION.md, PR S6). Версия попадает в облако (какое приложение
// стоит на каждом устройстве — видно командиру во вкладке «Данные») и в журнал сбоев. Перед исправлением облака (S1) и
// публикацией правил Firestore (S3) нужно знать, что все устройства обновились: старая копия на телефоне может затереть облако.
declare const __APP_VERSION__: string;
export const APP_VERSION: string = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'dev';

const DEVICE_KEY = 'razlom.device';
/** Постоянный id этого браузера (не связан с аккаунтом). */
export function deviceId(): string {
  try {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id) { id = Math.random().toString(36).slice(2, 10); localStorage.setItem(DEVICE_KEY, id); }
    return id;
  } catch { return 'nostore'; }
}

/** Короткая подпись устройства для командира: «Android · Chrome», «iPhone · Safari». */
export function deviceLabel(ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''): string {
  const os = /iPhone|iPad/.test(ua) ? (/iPad/.test(ua) ? 'iPad' : 'iPhone') : /Android/.test(ua) ? 'Android' : /Windows/.test(ua) ? 'Windows' : /Mac OS/.test(ua) ? 'Mac' : /Linux/.test(ua) ? 'Linux' : 'устройство';
  const br = /YaBrowser/.test(ua) ? 'Яндекс' : /Edg\//.test(ua) ? 'Edge' : /SamsungBrowser/.test(ua) ? 'Samsung' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : '';
  return br ? `${os} · ${br}` : os;
}
