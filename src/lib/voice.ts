// Голосовые реакции Бита (content/reactions.mjs). Обычные ответы озвучиваются через раз, особые события — всегда.
import { audio } from './audio';
// @ts-ignore
import { REACTIONS } from '../../content/reactions.mjs';

const R = REACTIONS as unknown as Record<string, [string, string][]>;
let last = 0;
export function react(kind: string, chance = 1) {
  const list = R[kind]; if (!list || Math.random() > chance) return;
  const now = performance.now(); if (now - last < 1500) return; // не перебивать себя
  last = now;
  const [id] = list[Math.floor(Math.random() * list.length)];
  audio.say(`${import.meta.env.BASE_URL}voice/react/${id}.mp3`);
}
