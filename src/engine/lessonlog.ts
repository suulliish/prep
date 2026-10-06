// Ответ шага урока в истории (L2, 02.10, src/lesson/finalTask.ts lessonAttempt): mode 'lesson' и источник `lesson:<навык>:<шаг>`.
// Без импортов: файл читают и модули, которые запускаются в чистом Node (rush.ts, analytics.ts). Старые ответы с mode 'lesson'
// без такого источника (до 02.10) — обычные ответы практики.
export const isLessonAnswer = (a: { mode?: string; source?: string }) => a.mode === 'lesson' && !!a.source?.startsWith('lesson:');
